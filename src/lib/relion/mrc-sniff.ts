/**
 * CryoFlow — MRC header SNIFFING (t314). Pure Buffer parsing: no fs, no
 * sharp, safe to import from client or server code.
 *
 * WHY THIS EXISTS (the t312 retrospective): the movie-stack guard used to
 * judge inputs by FILENAME (anything smelling like EPU `*_Fractions*` was
 * refused at the CTF door). The Beijing follow-up proved the false
 * positive — the user's `Micrographs/` folder holds MotionCor2 OUTPUTS,
 * and motioncor2 KEEPS the input basename: `xxx_Fractions.mrc` (aligned
 * sum) + `xxx_Fractions_DW.mrc` (dose-weighted sum) are summed
 * single-section micrographs, exactly what ctffind wants. The SAME stem
 * also names RAW frame stacks in a `Movies/` folder. A filename cannot
 * tell those two worlds apart; the MRC header can:
 *
 *   bytes 0–3   NX (int32 LE)     — columns
 *   bytes 4–7   NY                — rows
 *   bytes 8–11  NZ                — sections: 1 = a summed micrograph,
 *                                   >1 = a frame STACK (raw movie)
 *   bytes 12–15 MODE              — 0 int8 · 1 int16 · 2 float32 ·
 *                                   6 uint16 · 12 float16
 *
 * Sixty-four bytes over SSH settle what naming never could. (TIFF stacks
 * would need an IFD walk — reported honestly as unverifiable instead.)
 */

/** MRC modes we can interpret, with their bytes per voxel. */
const MODE_BYTES: Record<number, number> = {
  0: 1, // int8
  1: 2, // int16
  2: 4, // float32 — the classic micrograph dialect
  3: 4, // complex int16
  4: 16, // complex float64
  6: 2, // uint16
  12: 2, // float16 — MotionCor2's newer output; OLD ctffind builds refuse it
};

/** The four int32 words a sniff needs (NX/NY/NZ/MODE). */
export interface MrcFacts {
  nx: number;
  ny: number;
  nz: number;
  mode: number;
  bytesPerVoxel: number;
}

/**
 * Parse NX/NY/NZ/MODE out of the first bytes of an MRC file. Strict-enough
 * sanity bounds (dimensions, known mode) reject text files and truncated
 * garbage — the mock's fake fixtures of old could spoof a sniff with any
 * random bytes; these gates make "verified" mean verified. Returns null
 * when the bytes are not a plausible MRC header.
 */
export function parseMrcHeaderBytes(buf: Buffer | null | undefined): MrcFacts | null {
  if (!buf || buf.length < 16) return null;
  let nx: number, ny: number, nz: number, mode: number;
  try {
    nx = buf.readInt32LE(0);
    ny = buf.readInt32LE(4);
    nz = buf.readInt32LE(8);
    mode = buf.readInt32LE(12);
  } catch {
    return null;
  }
  const bpp = MODE_BYTES[mode];
  if (
    !Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz) ||
    nx < 16 || nx > 262_144 ||
    ny < 16 || ny > 262_144 ||
    nz < 1 || nz > 1_000_000 ||
    bpp === undefined
  ) {
    return null;
  }
  return { nx, ny, nz, mode, bytesPerVoxel: bpp };
}

/** What a sniffed input file turned out to be. */
export type SniffKind =
  | "mrc-single" // .mrc/.mrcs, header says nz === 1 — a summed micrograph
  | "mrc-stack" // .mrc/.mrcs, header says nz > 1 — a raw FRAME stack
  | "eer" // Falcon electron event records — raw movies by definition
  | "tiff" // readable TIFF, but single-vs-stack needs an IFD walk
  | "unknown"; // unreadable / not enough bytes / not a plausible MRC

export interface SniffVerdict {
  kind: SniffKind;
  facts?: MrcFacts;
}

/**
 * Verdict for one input file from its NAME (extension) plus the first
 * bytes of the file (null = could not read any bytes). `.eer` is decided
 * by extension alone — an event record file is raw frames by definition,
 * no bytes need cross the wire.
 */
export function sniffImageFile(name: string, buf: Buffer | null | undefined): SniffVerdict {
  const base = name.split(/[\\/]/).pop() ?? name;
  if (/\.eer$/i.test(base)) return { kind: "eer" };
  if (/\.(mrc|mrcs)$/i.test(base)) {
    const facts = parseMrcHeaderBytes(buf);
    if (!facts) return { kind: "unknown" };
    return facts.nz > 1 ? { kind: "mrc-stack", facts } : { kind: "mrc-single", facts };
  }
  if (/\.(tif|tiff)$/i.test(base) && buf && buf.length >= 4) {
    const little = buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00;
    const big = buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a;
    if (little || big) return { kind: "tiff" };
  }
  return { kind: "unknown" };
}

/**
 * How many files a gate bothers to sniff. Spread sampling (first / middle /
 * last) covers a mixed folder better than a prefix — one round trip either
 * way on the remote lane.
 */
export const SNIFF_SAMPLE_N = 3;

/** Pick up to N paths spread across the list (first, middle, last). */
export function spreadSample<T>(items: T[], n = SNIFF_SAMPLE_N): T[] {
  if (items.length <= n) return items.slice();
  const picks = new Set<number>();
  picks.add(0);
  picks.add(items.length - 1);
  while (picks.size < Math.min(n, items.length)) {
    picks.add(Math.floor(items.length / 2));
    if (picks.size >= Math.min(n, items.length)) break;
    picks.add(Math.floor(items.length / 4));
    if (picks.size >= Math.min(n, items.length)) break;
    picks.add(Math.floor((items.length * 3) / 4));
    break;
  }
  return [...picks].sort((a, b) => a - b).map((i) => items[i]);
}

/**
 * The lane-agnostic verifier: hand it absolute paths, it hands back a
 * verdict per path (missing paths = "unknown" — an unverifiable file is
 * NEVER a refusal; t312 blocked the user once too many on a guess).
 * Implementations: local fs reads (engine), one SSH round trip (remote).
 */
export type HeaderSniffer = (paths: string[]) => Promise<Record<string, SniffVerdict>>;
