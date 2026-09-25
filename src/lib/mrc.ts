/**
 * CryoFlow — MRC2014 / CCP4 map reader + slice → PNG rendering (SERVER ONLY).
 *
 * Real RELION outputs on disk are classic MRC2014 files:
 *  - mode 0 (int8), 1 (int16), 2 (float32), 6 (uint16)
 *  - nx/ny/nz at byte offsets 0/4/8, mode at 12, nsymbt (extended header
 *    size) at 92, voxel data starts at 1024 + nsymbt.
 *  - image stacks (.mrcs) stack images along z.
 *
 * Rendering: nearest-neighbour downsample to ≤ MAX_W px, 2–98 percentile
 * contrast stretch, grayscale PNG via sharp (raw 1-channel buffer input).
 */

import { closeSync, openSync, readSync, statSync } from "fs";
import sharp from "sharp";

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/** bytes per voxel for the MRC modes we support */
const MODE_BYTES: Record<number, number> = { 0: 1, 1: 2, 2: 4, 6: 2 };

export interface MrcHeader {
  nx: number;
  ny: number;
  nz: number;
  /** 0 int8 · 1 int16 · 2 float32 · 6 uint16 */
  mode: number;
  /** extended header bytes (data starts at 1024 + nsymbt) */
  nsymbt: number;
  bytesPerVoxel: number;
  /** cell length in Å per axis (header floats at 40/44/48) — voxel spacing
   *  is cella[axis] / n[axis]; additive field, consumers may ignore it */
  cella: [number, number, number];
  /** start fields (header ints at 16/20/24) — the voxel offset of this grid
   *  inside its parent map. All zero for a standalone map; non-zero for a
   *  sub-volume crop, whose header answers "where do I sit in the map I
   *  was cut from" (readMrcSubvolume writes parent start + box offset). */
  start: [number, number, number];
  dmin: number;
  dmax: number;
  /** header word at 84 — mean density as written by the producer */
  dmean: number;
  /** MRC2014 RMS at word 216 — 0 when the producer didn't write it */
  rms: number;
}

/**
 * t360 — parse + validate a 1024-byte MRC2014 header that is already in
 * memory. `size` is the WHOLE file's byte count (the voxel-count sanity
 * check needs it). The remote map-import lane reads the header over SSH
 * (`head -c 1024 | base64`) and never holds the file locally — this pure
 * parser is the same field layout readMrcHeader reads off the disk.
 */
export function parseMrcHeaderBytes(buf: Buffer, size: number): MrcHeader | null {
  if (!buf || buf.length < 1024) return null;
  const nx = buf.readInt32LE(0);
  const ny = buf.readInt32LE(4);
  const nz = buf.readInt32LE(8);
  const mode = buf.readInt32LE(12);
  const nsymbt = buf.readInt32LE(92);
  const bpp = MODE_BYTES[mode];
  if (
    !Number.isFinite(nx) || nx <= 0 || ny <= 0 || nz <= 0 ||
    nx > 65536 || ny > 65536 || nz > 1_000_000 ||
    nsymbt < 0 || nsymbt > 16_000_000 || bpp === undefined
  ) {
    return null;
  }
  if (!Number.isFinite(size) || 1024 + nsymbt + nx * ny * nz * bpp > size + bpp) return null;
  return {
    nx, ny, nz, mode, nsymbt,
    bytesPerVoxel: bpp,
    cella: [buf.readFloatLE(40), buf.readFloatLE(44), buf.readFloatLE(48)],
    start: [buf.readInt32LE(16), buf.readInt32LE(20), buf.readInt32LE(24)],
    dmin: buf.readFloatLE(76),
    dmax: buf.readFloatLE(80),
    dmean: buf.readFloatLE(84),
    rms: buf.readFloatLE(216),
  };
}

/**
 * t387 — the EXACT byte count a complete file for this header must carry:
 * 1024 header + nsymbt extended + nx·ny·nz·bytesPerVoxel data. The remote
 * pull paths compare the landed byte account against this number, because a
 * mid-write file can stat FULL-SIZE while its data pages are still in
 * flight (and a torn pull that matches the pre-pull stat can still be
 * shorter than the header's own geometry — the parser's tolerance would
 * only refuse it later, with a message that names the wrong world).
 */
export function mrcExpectedBytes(h: MrcHeader): number {
  return 1024 + h.nsymbt + h.nx * h.ny * h.nz * h.bytesPerVoxel;
}

/** Read + validate the 1024-byte MRC2014 header. Returns null when not a map we can read. */
export function readMrcHeader(file: string): MrcHeader | null {
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const buf = Buffer.alloc(1024);
    const got = readSync(fd, buf, 0, 1024, 0);
    if (got < 1024) return null;
    return parseMrcHeaderBytes(buf, statSync(file).size);
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* Slices                                                              */
/* ------------------------------------------------------------------ */

/** Read one 2D slice (image index for stacks / section for volumes) as float values. */
export function readMrcSlice(file: string, z: number, header?: MrcHeader): Float32Array | null {
  const h = header ?? readMrcHeader(file);
  if (!h) return null;
  const zi = Math.max(0, Math.min(Math.trunc(z), h.nz - 1));
  const count = h.nx * h.ny;
  const nbytes = count * h.bytesPerVoxel;
  const offset = 1024 + h.nsymbt + zi * nbytes;
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const raw = Buffer.alloc(nbytes);
    const got = readSync(fd, raw, 0, nbytes, offset);
    if (got < nbytes) return null;
    const out = new Float32Array(count);
    switch (h.mode) {
      case 0:
        for (let i = 0; i < count; i++) out[i] = raw.readInt8(i);
        break;
      case 1:
        for (let i = 0; i < count; i++) out[i] = raw.readInt16LE(i * 2);
        break;
      case 6:
        for (let i = 0; i < count; i++) out[i] = raw.readUInt16LE(i * 2);
        break;
      default: // 2 — float32
        for (let i = 0; i < count; i++) out[i] = raw.readFloatLE(i * 4);
        break;
    }
    return out;
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* Axis density profiles (t189 — the cross-section's instrument)        */
/* ------------------------------------------------------------------ */

/** caps for the profile scan: ≤ MAX_PROFILE_PLANES planes visited, */
/** ≤ MAX_PROFILE_SAMPLES_PER_PLANE voxels sampled inside each plane    */
const MAX_PROFILE_PLANES = 320;
const MAX_PROFILE_SAMPLES_PER_PLANE = 49_152;

export interface MrcAxisProfiles {
  /** mean density per sampled column (length ≤ ceil(nx / sx)) */
  x: number[];
  /** mean density per sampled row (length ≤ ceil(ny / sy)) */
  y: number[];
  /** mean density per visited plane (length = ceil(nz / sz)) */
  z: number[];
  /** planes actually visited (z profile's ground truth) */
  planes: number;
  /** total voxels sampled (bounded work's receipt) */
  samples: number;
}

/**
 * Mean density per plane along EVERY axis in one bounded pass — the
 * density landscape the cross-section slider scrubs through.
 *
 * I/O is PLANE-WISE (readSync per z section, one plane buffer alive at a
 * time): a 700³ float32 map is ~1.4 GB and whole-file reads OOM'd this
 * server once already (the outputs/file raw-format comment). Work is
 * additionally STRIDED so the scan cost is bounded regardless of map
 * size — ≤320 planes × ≤48K voxels ≈ 15M voxel samples worst case,
 * statistically identical for a landscape sparkline. Caller caches via
 * statcache's cachedCompute (the scan must run once per map version,
 * not once per poll).
 */
export function readMrcAxisProfiles(file: string, header?: MrcHeader): MrcAxisProfiles | null {
  const h = header ?? readMrcHeader(file);
  if (!h) return null;
  const sz = Math.max(1, Math.ceil(h.nz / MAX_PROFILE_PLANES));
  const sxy = Math.max(1, Math.round(Math.sqrt((h.nx * h.ny) / MAX_PROFILE_SAMPLES_PER_PLANE)));
  const xCount = Math.ceil(h.nx / sxy);
  const yCount = Math.ceil(h.ny / sxy);
  const zCount = Math.ceil(h.nz / sz);
  const xSum = new Float64Array(xCount);
  const ySum = new Float64Array(yCount);
  const zSum = new Float64Array(zCount);
  const xN = new Float64Array(xCount);
  const yN = new Float64Array(yCount);
  const zN = new Float64Array(zCount);
  const count = h.nx * h.ny;
  const nbytes = count * h.bytesPerVoxel;
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const raw = Buffer.alloc(nbytes);
    let samples = 0;
    let planes = 0;
    for (let zi = 0; zi < h.nz; zi += sz) {
      const offset = 1024 + h.nsymbt + zi * nbytes;
      const got = readSync(fd, raw, 0, nbytes, offset);
      if (got < nbytes) break;
      const k = Math.floor(zi / sz);
      planes++;
      for (let yi = 0; yi < h.ny; yi += sxy) {
        for (let xi = 0; xi < h.nx; xi += sxy) {
          const vi = yi * h.nx + xi;
          let v: number;
          switch (h.mode) {
            case 0: v = raw.readInt8(vi); break;
            case 1: v = raw.readInt16LE(vi * 2); break;
            case 6: v = raw.readUInt16LE(vi * 2); break;
            default: v = raw.readFloatLE(vi * 4); break;
          }
          if (!Number.isFinite(v)) continue;
          const xk = Math.floor(xi / sxy);
          const yk = Math.floor(yi / sxy);
          xSum[xk] += v; xN[xk]++;
          ySum[yk] += v; yN[yk]++;
          zSum[k] += v; zN[k]++;
          samples++;
        }
      }
    }
    const means = (sum: Float64Array, n: Float64Array): number[] =>
      Array.from(sum, (s, i) => (n[i] > 0 ? s / n[i] : 0));
    return { x: means(xSum, xN), y: means(ySum, yN), z: means(zSum, zN), planes, samples };
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/** average-pool a profile to ≤ maxBins entries (the sparkline's wire size). */
export function poolProfile(src: number[], maxBins = 160): number[] {
  if (src.length <= maxBins) return src;
  const out: number[] = [];
  const per = src.length / maxBins;
  for (let b = 0; b < maxBins; b++) {
    const a = Math.floor(b * per);
    const z = Math.max(a + 1, Math.floor((b + 1) * per));
    let s = 0;
    for (let i = a; i < z; i++) s += src[i];
    out.push(s / (z - a));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Grayscale rendering helpers                                         */
/* ------------------------------------------------------------------ */

/** max output PNG width (slice) and cell size (montage) */
const MAX_W = 384;
const MONTAGE_COLS = 4;
const MONTAGE_CELL = 128;
const MONTAGE_GAP = 2;

/** nearest-neighbour downsample of a slice to ≤ maxW columns. */
function downsample(
  data: Float32Array,
  nx: number,
  ny: number,
  maxW: number
): { values: Float32Array; width: number; height: number } {
  const step = Math.max(1, Math.ceil(nx / maxW));
  const w = Math.ceil(nx / step);
  const h = Math.ceil(ny / step);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(ny - 1, y * step);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(nx - 1, x * step);
      out[y * w + x] = data[sy * nx + sx];
    }
  }
  return { values: out, width: w, height: h };
}

/**
 * An explicit display window — t286 lets the histogram COMMAND the
 * display: lo renders black, hi renders white, everything outside is
 * clipped. Validated by the caller (finite, hi > lo) before it gets
 * here; the stretch trusts it.
 */
export interface MrcWindow {
  lo: number;
  hi: number;
}

/**
 * Display polarity for the auto-inversion heuristic (t380).
 *
 * - "auto" (default): cryo-EM convention — when the negative side of the
 *   distribution dominates, flip so the particle renders bright-on-black.
 *   Covers cryo class averages AND normalized particle stacks.
 * - "negativeStain": NEVER flip — stained particles are positive density
 *   (bright voids in a dark metal sea); the direct stretch already shows
 *   them bright. Pinned by the import job's "negative stain" checkbox so
 *   every downstream render of that dataset follows it.
 */
export type MrcPolarity = "auto" | "negativeStain";

/**
 * 2–98 percentile contrast stretch → 8-bit grayscale buffer.
 *
 * RELION cryo-EM convention: the particle signal is NEGATIVE density —
 * both in class averages (particle as negative density over flattened
 * solvent) and in extracted particle stacks. When the negative side of
 * the distribution carries more swing than the positive side
 * (> 1.0×), the signal lives below the mean: flip and renormalize so the
 * particle renders BRIGHT ON BLACK (what RELION's own display does).
 *
 * All-positive images (raw micrographs, CTF power spectra, soft masks)
 * never satisfy `lo < 0` and are never flipped. Measured on the EMPIAR
 * beta-gal dataset: class averages flip at ratio 2.7–3.0, particle stacks
 * at 1.24, micrographs are all-positive, CTF .ctf diagnostics sit at 0.56.
 *
 * t380 — the gate's threshold was 1.2×, which left a DEAD ZONE: unmasked
 * class averages and barely-normalised stacks measure 1.0–1.1 — clearly
 * negative-dominant, but the old gate refused to flip and the particles
 * rendered BLACK. The gate now fires at any strict negative dominance
 * (> 1.0×). A pinned `polarity: "negativeStain"` (import-time flag)
 * disables the flip entirely: negative-stain particles are POSITIVE
 * density (bright metal-surrounded voids) and must render as-is.
 *
 * t286 — an explicit `window` overrides the percentile entirely: lo maps
 * to black, hi maps to white, LITERAL mapping (no auto-inversion — the
 * heuristic second-guesses an auto range, but a range the user typed or
 * dragged is an explicit command, and silently flipping it would betray
 * the drag). The percentile + inversion path is the AUTO default and is
 * untouched when no window is given.
 */
function stretchToGray(data: Float32Array, window?: MrcWindow, polarity?: MrcPolarity): Buffer {
  const n = data.length;
  const gray = Buffer.alloc(n);

  if (window) {
    const span = window.hi - window.lo;
    if (!(span > 0)) {
      gray.fill(128);
      return gray;
    }
    for (let i = 0; i < n; i++) {
      const v = (data[i] - window.lo) / span;
      gray[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    return gray;
  }

  const sorted = Float32Array.from(data).sort();
  const lo = sorted[Math.floor(0.02 * (n - 1))];
  const hi = sorted[Math.ceil(0.98 * (n - 1))];

  // inverted reference: the negative side carries the particle signal
  // (median-zero check from v1 was dropped — real class averages settle
  // at med −0.1…−1.0 after solvent flattening, never exactly 0, which
  // silently disabled the flip and rendered particles BLACK)
  // t380: 1.2 → 1.0 — the dead zone left unmasked classes (ratio ~1.0–1.1)
  // unflipped and BLACK; a strict > 1.0 dominance flips them. A pinned
  // negativeStain polarity keeps the direct mapping (particles are
  // naturally bright in stained data).
  const inverted =
    polarity !== "negativeStain" &&
    lo < 0 &&
    -lo > 1.0 * Math.max(hi, Number.EPSILON);
  if (inverted) {
    const loSig = sorted[Math.floor(0.005 * (n - 1))]; // robust signal floor
    const span = -loSig;
    if (!(span > 0)) {
      gray.fill(128);
      return gray;
    }
    for (let i = 0; i < n; i++) {
      const v = -data[i] / span;
      gray[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    return gray;
  }

  const span = hi - lo;
  if (!(span > 0)) {
    gray.fill(128);
    return gray;
  }
  for (let i = 0; i < n; i++) {
    const v = (data[i] - lo) / span;
    gray[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  return gray;
}

async function grayToPng(gray: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(gray, { raw: { width, height, channels: 1 } })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/* ------------------------------------------------------------------ */
/* Public render API                                                   */
/* ------------------------------------------------------------------ */

/**
 * Render one slice as a grayscale PNG (≤384 px wide).
 * `slice` defaults to the middle section for volumes, 0 for stacks.
 * `window` (t286) overrides the 2–98 percentile stretch.
 */
export async function renderMrcSlicePng(
  file: string,
  slice?: number,
  window?: MrcWindow,
  polarity?: MrcPolarity
): Promise<Buffer | null> {
  const h = readMrcHeader(file);
  if (!h) return null;
  const z = slice !== undefined && Number.isFinite(slice) ? Math.trunc(slice) : Math.floor(h.nz / 2);
  const data = readMrcSlice(file, z, h);
  if (!data) return null;
  const small = downsample(data, h.nx, h.ny, MAX_W);
  const gray = stretchToGray(small.values, window, polarity);
  return grayToPng(gray, small.width, small.height);
}

/**
 * Render the first `count` (≤16) images of a .mrcs stack as a 4-column
 * montage PNG: white background, 2 px gaps, each cell ≤128 px.
 */
export async function renderMrcMontagePng(
  file: string,
  count = 8,
  window?: MrcWindow,
  polarity?: MrcPolarity
): Promise<Buffer | null> {
  const h = readMrcHeader(file);
  if (!h) return null;
  const n = Math.max(1, Math.min(16, Math.trunc(count) || 8, h.nz));
  const cellW = Math.min(MONTAGE_CELL, h.nx);
  const cellH = Math.min(MONTAGE_CELL, h.ny);
  const rows = Math.ceil(n / MONTAGE_COLS);
  const gap = MONTAGE_GAP;
  const gw = MONTAGE_COLS * cellW + (MONTAGE_COLS + 1) * gap;
  const gh = rows * cellH + (rows + 1) * gap;
  const grid = Buffer.alloc(gw * gh, 0); // black background — cryo-EM convention (bright particle on dark)

  for (let i = 0; i < n; i++) {
    const data = readMrcSlice(file, i, h);
    if (!data) continue;
    const small = downsample(data, h.nx, h.ny, MONTAGE_CELL);
    const cell = stretchToGray(small.values, window, polarity);
    const cx = gap + (i % MONTAGE_COLS) * (cellW + gap);
    const cy = gap + Math.floor(i / MONTAGE_COLS) * (cellH + gap);
    for (let y = 0; y < small.height && y < cellH; y++) {
      for (let x = 0; x < small.width && x < cellW; x++) {
        grid[(cy + y) * gw + (cx + x)] = cell[y * small.width + x];
      }
    }
  }
  return grayToPng(grid, gw, gh);
}

/* ------------------------------------------------------------------ */
/* Per-iteration class SHEET (t354) — one image per iteration round     */
/* ------------------------------------------------------------------ */

/** the sheet's cell edge — big enough to judge class quality at a glance */
const SHEET_CELL = 160;
/** defensive ceiling: a class2d with >200 classes renders its first 200 */
const SHEET_MAX_SLICES = 200;
/** a sheet never exceeds this on its long side (keeps the PNG KB-scale) */
const SHEET_MAX_LONG = 1400;

/**
 * t354 — render EVERY slice of a per-iteration class-average stack as ONE
 * grid image — the user's 「每一轮的 2D 结果生成一张图片」: RELION writes
 * `run_itNNN_classes.mrcs` once per Expectation round, and this is that
 * stack rendered the way `relion_display` would show it — all class
 * averages side by side, bright on black, per-class percentile contrast.
 *
 * Columns adapt to the class count (4…8, near-square layout), gaps and the
 * background follow the cryo-EM convention (2 px, black). If the naive
 * grid would exceed SHEET_MAX_SLICES slices or SHEET_MAX_LONG px on its
 * long side, the sheet keeps the FIRST classes and says so via `rendered`.
 */
export async function renderClassSheetPng(
  file: string,
  window?: MrcWindow,
  polarity?: MrcPolarity
): Promise<{ png: Buffer; rendered: number; total: number } | null> {
  const h = readMrcHeader(file);
  if (!h) return null;
  const total = h.nz;
  const n = Math.max(1, Math.min(SHEET_MAX_SLICES, total));
  const gap = MONTAGE_GAP;
  let cols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(n))));
  let cell = Math.min(SHEET_CELL, h.nx, h.ny);
  const dims = () => {
    const r = Math.ceil(n / cols);
    return { rows: r, w: cols * cell + (cols + 1) * gap, h: r * cell + (r + 1) * gap };
  };
  // fit BOTH sides inside SHEET_MAX_LONG: height overflow spends the width
  // budget on more columns first, then shrinks cells (width overflow can
  // only shrink cells — more columns would make it worse)
  let d = dims();
  while ((d.w > SHEET_MAX_LONG || d.h > SHEET_MAX_LONG) && (cols < 8 || cell > 48)) {
    if (cols < 8 && d.h > SHEET_MAX_LONG) cols++;
    else if (cell > 48) cell -= 16;
    else break;
    d = dims();
  }
  const rows = d.rows;
  const gw = d.w;
  const gh = d.h;
  const grid = Buffer.alloc(gw * gh, 0); // black background — cryo-EM convention

  for (let i = 0; i < n; i++) {
    const data = readMrcSlice(file, i, h);
    if (!data) continue;
    const small = downsample(data, h.nx, h.ny, cell);
    const cellGray = stretchToGray(small.values, window, polarity);
    const cx = gap + (i % cols) * (cell + gap);
    const cy = gap + Math.floor(i / cols) * (cell + gap);
    for (let y = 0; y < small.height && y < cell; y++) {
      for (let x = 0; x < small.width && x < cell; x++) {
        grid[(cy + y) * gw + (cx + x)] = cellGray[y * small.width + x];
      }
    }
  }
  const png = await grayToPng(grid, gw, gh);
  return { png, rendered: n, total };
}

/** Render one slice of a stack enlarged for the dialog view (≤ 768 px). */
export async function renderMrcLargePng(
  file: string,
  slice: number,
  window?: MrcWindow,
  polarity?: MrcPolarity
): Promise<Buffer | null> {
  const h = readMrcHeader(file);
  if (!h) return null;
  const data = readMrcSlice(file, slice, h);
  if (!data) return null;
  const small = downsample(data, h.nx, h.ny, 768);
  const gray = stretchToGray(small.values, window, polarity);
  return grayToPng(gray, small.width, small.height);
}

/* ------------------------------------------------------------------ */
/* Decimated previews (t322) — the pixels arrive pre-thinned           */
/* ------------------------------------------------------------------ */

/**
 * Decode a run of raw little-endian MRC voxels (mode-dispatched) into
 * Float32 values. The decimation ladder's cluster-side scripts emit RAW
 * strided bytes — decoding happens here, on the app side, so the remote
 * leg needs nothing beyond POSIX shell (t322).
 */
export function decodeRawVoxels(raw: Buffer, mode: number, count: number): Float32Array {
  const out = new Float32Array(count);
  switch (mode) {
    case 0:
      for (let i = 0; i < count; i++) out[i] = raw.readInt8(i);
      break;
    case 1:
      for (let i = 0; i < count; i++) out[i] = raw.readInt16LE(i * 2);
      break;
    case 6:
      for (let i = 0; i < count; i++) out[i] = raw.readUInt16LE(i * 2);
      break;
    default: // 2 — float32
      for (let i = 0; i < count; i++) out[i] = raw.readFloatLE(i * 4);
  }
  return out;
}

/**
 * Column decimation for row-thinned payloads — the dd tier of the ladder
 * sends FULL-width rows (strided row reads only), so the columns are
 * thinned here. The step math is downsample()'s own (step from nx vs
 * maxW, nearest neighbour, no clamping needed — (ceil(nx/step)-1)*step
 * < nx always), which is why ALL THREE tiers of the preview ladder pick
 * the SAME pixels and render byte-identical PNGs (t322).
 */
function decimateColumns(
  data: Float32Array,
  nx: number,
  ny: number,
  maxW: number
): { values: Float32Array; width: number; height: number } {
  const step = Math.max(1, Math.ceil(nx / maxW));
  const w = Math.ceil(nx / step);
  const out = new Float32Array(w * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < w; x++) {
      out[y * w + x] = data[y * nx + x * step];
    }
  }
  return { values: out, width: w, height: ny };
}

/**
 * Render an ALREADY-thinned pixel grid (t322's decimated preview ladder):
 * `data` is row-major `nx × ny` (the python tier sends both axes thinned,
 * the dd tier sends full-width strided rows — this render thins the
 * columns only when nx still exceeds maxW). Contrast stretch and PNG
 * encoding are the SAME pipeline as every other thumbnail, so a
 * decimated preview is pixel-identical to a full-file render.
 */
export async function renderDecimatedPng(
  data: Float32Array,
  nx: number,
  ny: number,
  maxW: number,
  window?: MrcWindow,
  polarity?: MrcPolarity
): Promise<Buffer | null> {
  if (!(nx > 0) || !(ny > 0) || data.length < nx * ny) return null;
  const grid = nx > maxW ? decimateColumns(data, nx, ny, maxW) : { values: data, width: nx, height: ny };
  const gray = stretchToGray(grid.values, window, polarity);
  return grayToPng(gray, grid.width, grid.height);
}

/* ------------------------------------------------------------------ */
/* Orthogonal planes (3D volumes only)                                 */
/* ------------------------------------------------------------------ */

/** Decode one voxel at a byte offset (mode-dispatched). */
function decodeVoxel(raw: Buffer, off: number, mode: number): number {
  switch (mode) {
    case 0:
      return raw.readInt8(off);
    case 1:
      return raw.readInt16LE(off);
    case 6:
      return raw.readUInt16LE(off);
    default: // 2 — float32
      return raw.readFloatLE(off);
  }
}

export type OrthoAxis = "x" | "y";

/** upper bound on raw bytes touched by one X-plane extraction (IO guard —
 *  the X axis needs a full section read per Z; anything beyond this is a
 *  "use a smaller map" situation, not a job for a thumbnail renderer) */
const ORTHO_MAX_BYTES = 512 * 1024 * 1024;

/**
 * Read one plane perpendicular to the X or Y axis through a 3D volume.
 *
 *  - axis "y" → image width = nx, height = nz. One row pread per Z
 *    section (cheap: nz seeks of nx·bpp bytes).
 *  - axis "x" → image width = ny, height = nz. Voxels at fixed x are
 *    strided nx·bpp apart inside each section, so per section we read the
 *    whole plane once into a reused buffer and sample the column (nz
 *    sections of nx·ny·bpp — the ORTHO_MAX_BYTES guard caps the total).
 *
 * Z-perpendicular planes are NOT handled here — a .map volume's Z
 * sections are already contiguous (readMrcSlice), and for .mrcs stacks
 * the "ortho" X/Y planes are meaningless (in-plane axes of each image).
 */
export function readMrcOrthoSlice(
  file: string,
  axis: OrthoAxis,
  idx: number,
  header?: MrcHeader
): { values: Float32Array; width: number; height: number } | null {
  const h = header ?? readMrcHeader(file);
  if (!h) return null;
  if (h.nz < 2) return null; // a 1-section file has no ortho plane

  const dataStart = 1024 + h.nsymbt;
  const bytesPerSection = h.nx * h.ny * h.bytesPerVoxel;
  if (bytesPerSection * h.nz > ORTHO_MAX_BYTES) return null;

  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }

  try {
    if (axis === "y") {
      const yi = Math.max(0, Math.min(Math.trunc(idx), h.ny - 1));
      const rowBytes = h.nx * h.bytesPerVoxel;
      const row = Buffer.alloc(rowBytes);
      const out = new Float32Array(h.nx * h.nz);
      for (let zi = 0; zi < h.nz; zi++) {
        const off = dataStart + zi * bytesPerSection + yi * rowBytes;
        const got = readSync(fd, row, 0, rowBytes, off);
        if (got < rowBytes) return null;
        for (let x = 0; x < h.nx; x++) {
          out[zi * h.nx + x] = decodeVoxel(row, x * h.bytesPerVoxel, h.mode);
        }
      }
      return { values: out, width: h.nx, height: h.nz };
    }

    const xi = Math.max(0, Math.min(Math.trunc(idx), h.nx - 1));
    const section = Buffer.alloc(bytesPerSection);
    const out = new Float32Array(h.ny * h.nz);
    for (let zi = 0; zi < h.nz; zi++) {
      const got = readSync(fd, section, 0, bytesPerSection, dataStart + zi * bytesPerSection);
      if (got < bytesPerSection) return null;
      for (let yi = 0; yi < h.ny; yi++) {
        out[zi * h.ny + yi] = decodeVoxel(section, (yi * h.nx + xi) * h.bytesPerVoxel, h.mode);
      }
    }
    return { values: out, width: h.ny, height: h.nz };
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/**
 * Read ONE voxel's density value (t281 — the density probe's backend).
 *
 * Fractional coordinates (0…1, the tiles' own pick/probe frame) resolve
 * to the nearest voxel with the SAME rounding the plane renderer uses
 * (round(p * (dim-1))), so the number shown under the cursor is the
 * density of what the cursor is actually on. The read is a single
 * `bytesPerVoxel` pread at the computed offset — no plane buffer, no
 * section scan; hover-frequency polling stays free.
 *
 * MRC native layout: x fastest, then y, z slowest —
 *   offset = 1024 + nsymbt + ((iz·ny + iy)·nx + ix) · bytesPerVoxel
 * (the same layout every other reader in this file walks section-wise).
 * Returns null for unreadable files / non-finite fractions — the probe
 * chip just stays silent rather than showing a lie.
 */
export function readMrcVoxel(
  file: string,
  fx: number,
  fy: number,
  fz: number,
  header?: MrcHeader
): { value: number; ix: number; iy: number; iz: number } | null {
  const h = header ?? readMrcHeader(file);
  if (!h) return null;
  if (h.nz < 1 || h.ny < 1 || h.nx < 1) return null;
  if (![fx, fy, fz].every((v) => Number.isFinite(v))) return null;
  const clamp = (v: number, dim: number) =>
    Math.max(0, Math.min(Math.round(v * (dim - 1)), dim - 1));
  const ix = clamp(fx, h.nx);
  const iy = clamp(fy, h.ny);
  const iz = clamp(fz, h.nz);
  const offset =
    1024 + h.nsymbt + ((iz * h.ny + iy) * h.nx + ix) * h.bytesPerVoxel;
  const raw = Buffer.alloc(h.bytesPerVoxel);
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const got = readSync(fd, raw, 0, h.bytesPerVoxel, offset);
    if (got < h.bytesPerVoxel) return null;
    return { value: decodeVoxel(raw, 0, h.mode), ix, iy, iz };
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* Volume histogram (t283)                                             */
/* ------------------------------------------------------------------ */

export interface MrcHistogram {
  /** every voxel in the grid, finite or not */
  nTotal: number;
  /** voxels that entered the stats and the bins (NaN/Inf excluded) */
  nFinite: number;
  min: number;
  max: number;
  /** mean density over the finite voxels */
  mean: number;
  /** population std over the finite voxels — the σ the contour slider
   *  speaks (mol*'s IsoValue.relative resolves against the same stats) */
  std: number;
  lo: number;
  hi: number;
  bins: number[];
}

const HIST_BINS = 256;
/** 262,144 voxels = 1 MB of float32 per chunk — memory stays flat no
 *  matter the map size (the OOM doctrine at histogram scale). */
const HIST_CHUNK_VOXELS = 1 << 18;
const HIST_CACHE_MAX = 8;
/** key: realpath + mtime + size — a re-rendered map is a new histogram */
const histCache = new Map<string, MrcHistogram>();

/**
 * The whole volume's density distribution in one payload (t283 — the
 * histogram instrument's backend). "Where should the contour cut?" is
 * answered by SEEING the distribution: the noise peak, the particle
 * shoulder, and where Nσ lands inside it.
 *
 * t287 — an optional `slice` narrows the read to ONE section along z:
 * for a .mrcs stack that is one particle IMAGE (nz = the image count),
 * and "is this particle even usable?" is answered by THAT image's
 * distribution, not the stack-wide blur of thousands of them. A volume
 * with a slice speaks that z-plane's distribution (same read shape).
 *
 * I/O shape: the histogram NEEDS every voxel in its scope — that is the
 * semantic floor — so this walks the file in chunks, TWICE (pass 1:
 * min/max/mean/σ accumulators, pass 2: binning over the now-known
 * [min,max] range) with O(1) memory; a 700³ float32 map costs ~2.8 GB
 * of sequential read but never 2.8 GB of RAM. The result is cached per
 * (path, mtime, size, slice) and LRU-capped: hover-frequency it is not,
 * panel-open frequency it absolutely is — the second look is free.
 */
export function readMrcHistogram(file: string, slice?: number): MrcHistogram | null {
  const h = readMrcHeader(file);
  if (!h) return null;
  // t287 — resolve the slice: undefined = the whole grid (the t283
  // semantics, every caller's default); a finite integer = one z section
  // (nx×ny voxels starting at slice*nx*ny). Out of range → null (the
  // route turns that into an actionable 400 with the header's real nz).
  let sliceOffset = 0;
  let count = h.nx * h.ny * h.nz;
  if (slice !== undefined) {
    if (!Number.isFinite(slice)) return null;
    const s = Math.trunc(slice);
    if (s < 0 || s >= h.nz) return null;
    sliceOffset = s * h.nx * h.ny;
    count = h.nx * h.ny;
  }
  if (count < 1) return null;
  let cacheKey: string | null = null;
  try {
    const st = statSync(file);
    cacheKey = `${file}|${st.mtimeMs}|${st.size}|s${slice === undefined ? "all" : Math.trunc(slice)}`;
    const hit = histCache.get(cacheKey);
    if (hit) {
      // Map-as-LRU: re-insert to mark the entry freshly used
      histCache.delete(cacheKey);
      histCache.set(cacheKey, hit);
      return hit;
    }
  } catch {
    /* unreadable stat — proceed uncached */
  }

  const dataStart = 1024 + h.nsymbt + sliceOffset * h.bytesPerVoxel;
  const bpp = h.bytesPerVoxel;
  const chunkVox = Math.max(1, Math.min(HIST_CHUNK_VOXELS, count));
  const raw = Buffer.alloc(chunkVox * bpp);
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    // pass 1 — accumulators (float64; finite voxels only)
    let nFinite = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumsq = 0;
    for (let done = 0; done < count; ) {
      const take = Math.min(chunkVox, count - done);
      const want = take * bpp;
      const got = readSync(fd, raw, 0, want, dataStart + done * bpp);
      if (got < want) return null;
      for (let i = 0; i < take; i++) {
        const v = decodeVoxel(raw, i * bpp, h.mode);
        if (!Number.isFinite(v)) continue;
        nFinite++;
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        sumsq += v * v;
      }
      done += take;
    }
    if (nFinite === 0) return null;
    const mean = sum / nFinite;
    const variance = Math.max(0, sumsq / nFinite - mean * mean);
    const std = Math.sqrt(variance);

    // pass 2 — bin the finite values over the known [min, max]
    const bins = new Array<number>(HIST_BINS).fill(0);
    const span = max - min;
    const scale = span > 0 ? HIST_BINS / span : 0;
    for (let done = 0; done < count; ) {
      const take = Math.min(chunkVox, count - done);
      const want = take * bpp;
      const got = readSync(fd, raw, 0, want, dataStart + done * bpp);
      if (got < want) return null;
      for (let i = 0; i < take; i++) {
        const v = decodeVoxel(raw, i * bpp, h.mode);
        if (!Number.isFinite(v)) continue;
        let b = span > 0 ? Math.trunc((v - min) * scale) : 0;
        if (b >= HIST_BINS) b = HIST_BINS - 1; // v === max lands in the last bin
        if (b < 0) b = 0;
        bins[b]++;
      }
      done += take;
    }

    const out: MrcHistogram = {
      nTotal: count,
      nFinite,
      min,
      max,
      mean,
      std,
      lo: min,
      hi: max,
      bins,
    };
    if (cacheKey) {
      histCache.delete(cacheKey);
      histCache.set(cacheKey, out);
      if (histCache.size > HIST_CACHE_MAX) {
        const oldest = histCache.keys().next().value;
        if (oldest !== undefined) histCache.delete(oldest);
      }
    }
    return out;
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/**
 * Render one plane through a map as a grayscale PNG (≤384 px wide).
 * `axis` is the plane's NORMAL (movement) axis: "z" → native sections,
 * "x"/"y" → orthogonal reconstruction planes. `pos` ∈ 0…1 positions the
 * plane inside the box fractionally (0.5 = centre).
 */
export async function renderMrcOrthoPng(
  file: string,
  axis: "x" | "y" | "z",
  pos: number,
  header?: MrcHeader,
  window?: MrcWindow,
  polarity?: MrcPolarity
): Promise<Buffer | null> {
  const h = header ?? readMrcHeader(file);
  if (!h) return null;
  const p = Number.isFinite(pos) ? Math.min(1, Math.max(0, pos)) : 0.5;

  if (axis === "z") {
    const z = Math.round(p * (h.nz - 1));
    const data = readMrcSlice(file, z, h);
    if (!data) return null;
    const small = downsample(data, h.nx, h.ny, MAX_W);
    return grayToPng(stretchToGray(small.values, window, polarity), small.width, small.height);
  }

  const idx =
    axis === "y" ? Math.round(p * (h.ny - 1)) : Math.round(p * (h.nx - 1));
  const plane = readMrcOrthoSlice(file, axis, idx, h);
  if (!plane) return null;
  const small = downsample(plane.values, plane.width, plane.height, MAX_W);
  return grayToPng(stretchToGray(small.values, window, polarity), small.width, small.height);
}

/* ------------------------------------------------------------------ */
/* Sub-volume export (t254 — the clip box learns to write .mrc)         */
/* ------------------------------------------------------------------ */

/** hard cap on the exported sub-volume's DATA bytes — the crop is built
 *  in memory (bounded by design, unlike the raw file stream) so the cap
 *  is what keeps a "select everything" box from OOM-ing the 4 GB host */
const MAX_SUBVOLUME_BYTES = 256 * 1024 * 1024;

/** half-open voxel ranges [lo, hi) along each axis of the parent map */
export interface MrcSubvolumeBox {
  ix0: number; ix1: number;
  iy0: number; iy1: number;
  iz0: number; iz1: number;
}

export type MrcSubvolumeResult =
  | {
      ok: true;
      /** the complete .mrc file bytes — fresh 1024-byte header + cropped voxels */
      bytes: Buffer;
      dims: [number, number, number];
      /** voxel offset of the crop inside the PARENT (goes into the sub
       *  header's start fields, so ChimeraX/RELION place the crop back
       *  where it came from) */
      origin: [number, number, number];
      dmin: number; dmax: number; dmean: number; rms: number;
    }
  | { ok: false; error: string; status: number };

/**
 * Crop a box out of an MRC map and emit a standalone .mrc file's bytes.
 *
 * The RELION box-subregion workflow: a region of interest picked in the
 * 3D viewer (the ChimeraX-style clip) becomes its own map for focused
 * processing. Voxel values are copied bit-faithful (mode preserved); the
 * new header is fresh and classic — dims from the box, start fields
 * recording WHERE in the parent the crop lives (parent start + box
 * offset), cella lengths rescaled to the crop's share of the parent grid
 * so voxel spacing survives, angles/mapc-mapr-maps carried over, and
 * dmin/dmax/dmean/RMS recomputed from the actual cropped voxels (the
 * parent's stats lie for a sub-region).
 *
 * I/O is SECTION-WISE: one parent z-section (nx·ny·bpp) in memory at a
 * time — the outputs/file OOM doctrine; the output buffer itself is the
 * only large allocation and is capped by MAX_SUBVOLUME_BYTES.
 */
export function readMrcSubvolume(file: string, box: MrcSubvolumeBox): MrcSubvolumeResult {
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return { ok: false, error: "Map file is not readable", status: 404 };
  }
  try {
    const head = Buffer.alloc(1024);
    if (readSync(fd, head, 0, 1024, 0) < 1024) {
      return { ok: false, error: "Map file is too small for an MRC header", status: 400 };
    }
    const nx = head.readInt32LE(0);
    const ny = head.readInt32LE(4);
    const nz = head.readInt32LE(8);
    const mode = head.readInt32LE(12);
    const nsymbt = head.readInt32LE(92);
    const bpp = MODE_BYTES[mode];
    if (
      !Number.isFinite(nx) || nx <= 0 || ny <= 0 || nz <= 0 ||
      nx > 65536 || ny > 65536 || nz > 1_000_000 ||
      nsymbt < 0 || nsymbt > 16_000_000 || bpp === undefined
    ) {
      return { ok: false, error: "Map header is not a supported MRC volume", status: 400 };
    }

    // clamp the box into the grid, half-open
    const clamp = (v: number, n: number) => Math.max(0, Math.min(n, Math.trunc(v)));
    const ix0 = clamp(box.ix0, nx), ix1 = clamp(box.ix1, nx);
    const iy0 = clamp(box.iy0, ny), iy1 = clamp(box.iy1, ny);
    const iz0 = clamp(box.iz0, nz), iz1 = clamp(box.iz1, nz);
    const sx = ix1 - ix0, sy = iy1 - iy0, sz = iz1 - iz0;
    if (sx <= 0 || sy <= 0 || sz <= 0) {
      return { ok: false, error: "Crop box is empty along at least one axis", status: 400 };
    }
    if (sx * sy * sz * bpp > MAX_SUBVOLUME_BYTES) {
      return {
        ok: false,
        error: `Sub-volume crop exceeds the export cap (${Math.round(MAX_SUBVOLUME_BYTES / 1024 / 1024)} MB of voxel data)`,
        status: 400,
      };
    }

    // parent fields the sub header continues (start + grid spacing)
    const pStart = [head.readInt32LE(16), head.readInt32LE(20), head.readInt32LE(24)] as const;
    const pmx = Math.max(1, head.readInt32LE(28));
    const pmy = Math.max(1, head.readInt32LE(32));
    const pmz = Math.max(1, head.readInt32LE(36));
    const cella = [head.readFloatLE(40), head.readFloatLE(44), head.readFloatLE(48)];
    const cellb = [head.readFloatLE(52), head.readFloatLE(56), head.readFloatLE(60)];

    const rowBytes = sx * bpp;
    const outRowBytes = rowBytes;
    const sectionBytes = nx * ny * bpp;
    const data = Buffer.alloc(sx * sy * sz * bpp);
    const section = Buffer.alloc(sectionBytes);
    const dataStart = 1024 + nsymbt;

    let min = Infinity, max = -Infinity;
    let sum = 0, sumSq = 0;
    let count = 0;

    for (let zk = 0; zk < sz; zk++) {
      const zSrc = iz0 + zk;
      const got = readSync(fd, section, 0, sectionBytes, dataStart + zSrc * sectionBytes);
      if (got < sectionBytes) {
        return { ok: false, error: "Map file is truncated (section read failed)", status: 400 };
      }
      for (let yk = 0; yk < sy; yk++) {
        const ySrc = iy0 + yk;
        const srcOff = (ySrc * nx + ix0) * bpp;
        section.copy(data, (zk * sy + yk) * outRowBytes, srcOff, srcOff + rowBytes);
        // stats over the copied voxels — the crop's own truth
        for (let xk = 0; xk < sx; xk++) {
          const v = decodeVoxel(section, srcOff + xk * bpp, mode);
          if (!Number.isFinite(v)) continue;
          if (v < min) min = v;
          if (v > max) max = v;
          sum += v;
          sumSq += v * v;
          count++;
        }
      }
    }

    const mean = count > 0 ? sum / count : 0;
    const variance = count > 0 ? Math.max(0, sumSq / count - mean * mean) : 0;

    // fresh classic header — every field position explicit (the seeder's
    // auditable layout, now on the writing side too)
    const out = Buffer.alloc(1024);
    const i32 = (off: number, v: number) => out.writeInt32LE(v | 0, off);
    const f32 = (off: number, v: number) => out.writeFloatLE(v, off);
    i32(0, sx); i32(4, sy); i32(8, sz);
    i32(12, mode);
    i32(16, pStart[0] + ix0); i32(20, pStart[1] + iy0); i32(24, pStart[2] + iz0);
    i32(28, sx); i32(32, sy); i32(36, sz);
    f32(40, cella[0] * (sx / pmx));
    f32(44, cella[1] * (sy / pmy));
    f32(48, cella[2] * (sz / pmz));
    f32(52, cellb[0]); f32(56, cellb[1]); f32(60, cellb[2]);
    i32(64, head.readInt32LE(64)); i32(68, head.readInt32LE(68)); i32(72, head.readInt32LE(72));
    f32(76, count > 0 ? min : 0);
    f32(80, count > 0 ? max : 0);
    f32(84, mean);
    i32(88, 1); // ispg — a volume, not a stack
    i32(92, 0); // nsymbt — fresh clean header, extended symbols dropped
    out.write("MAP ", 208, "ascii");
    out.writeInt32LE(16777214, 212); // little-endian float machine stamp
    f32(216, Math.sqrt(variance)); // RMS
    i32(220, 0); // nlabl

    return {
      ok: true,
      bytes: Buffer.concat([out, data]),
      dims: [sx, sy, sz],
      origin: [ix0, iy0, iz0],
      dmin: count > 0 ? min : 0,
      dmax: count > 0 ? max : 0,
      dmean: mean,
      rms: Math.sqrt(variance),
    };
  } catch {
    return { ok: false, error: "Sub-volume crop failed while reading the map", status: 400 };
  } finally {
    closeSync(fd);
  }
}

/** MRC-format extensions (ctffind .ctf diagnostics are classic MRC too) */
export function mrcExtensions(): string[] {
  return [".mrc", ".mrcs", ".map", ".ccp4", ".ctf"];
}

export function isMrcPath(p: string): boolean {
  const lower = p.toLowerCase();
  return mrcExtensions().some((ext) => lower.endsWith(ext));
}
