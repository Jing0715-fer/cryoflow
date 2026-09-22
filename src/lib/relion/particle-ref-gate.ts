/**
 * CryoFlow — the particle-star ↔ stack consistency gate (t338), PURE module.
 *
 * Why pure (the t326/t327/t334 recipe): the client, the server and the
 * test suites must share ONE classification, so the verdict the dispatch
 * refuses on is exactly the verdict the suite asserts — no import of the
 * engine (and its Prisma/fs spine) is needed to exercise the gate.
 *
 * THE FIELD REPORT this gate answers: a 2D classification submitted against
 * a COMPLETED extraction died ~1 minute in with
 *
 *   readMRC: Image number 341 exceeds stack size 340 of image
 *   00000341@…/extract_ufh1hg0u/micrographs/…_133825_Fractions_DW.mrcs
 *   (rwMRC.h line 178, inside relion_refine's initialiseSigma2Noise)
 *
 * The extraction job itself exited 0 — no error at extract time — yet its
 * particles.star references MORE images than the stack holds. That shape
 * is the t334 collision, SILENT variant: two rows in the extraction's
 * INPUT star whose extension-stripped names compose the SAME stack path
 * ("X.mrc" + "X.mrcs" both → part_dir + "X.mrcs"). RELION's first
 * particle per micrograph replaces the stack path BLINDLY, every later
 * particle appends — so writer A's 341 images get truncated to 1 by
 * writer B's first box, B appends its own 2..340, and the merged star
 * still carries A's rows numbered up to 341. Extract "succeeds"; the
 * poison surfaces only downstream, 20 GPU-minutes into relion_refine.
 *
 * The t334/t335 blades refuse such INPUTS at extraction dispatch — but
 * they cannot see an output that was already poisoned by an OLDER
 * dispatch (the user's very database: extract COMPLETED, star lying). This
 * gate sits at the CONSUMER side: before a particles-star-eating job is
 * staged, every "N@path" ref in the star is checked against the actual
 * stack's own MRC header — the image number must not exceed the stack's
 * NZ. The refusal carries the exact numbers RELION would die on; healthy
 * stars pass with a receipt note; anything unverifiable degrades to the
 * note, never a block (the t313/t335 conservatism: a wiring guess must
 * not flip a job row to failed).
 *
 * Resolution order for a ref's path (RELION's own grammar: a star's
 * relative refs resolve against the process CWD — the project root —
 * while this app's chains also emit absolute refs, and the mock's own
 * dialect writes star-relative refs): absolute → as-is; then
 * project-root-relative; then star-dir-relative. The first candidate
 * that EXISTS is the one judged; a ref whose candidates all miss is
 * unverifiable, not guilty.
 */

import type { HeaderSniffer, SniffVerdict } from "./mrc-sniff";

/** How many stack headers one gate bothers to sniff (per dispatch). */
export const REF_GATE_MAX_STACKS = 4096;

/** How many paths ride one sniffer call (the remote lane batches over SSH). */
export const REF_GATE_SNIFF_CHUNK = 192;

/** One "N@path" row from a particles star. */
export interface ParticleRefRow {
  /** 1-based image number inside the stack (as written in the star). */
  image: number;
  /** the stack path exactly as written in the star row. */
  ref: string;
}

/**
 * Parse "N@path" rows out of star TEXT. Only data-block rows shaped like
 * an rlnImageName value count; the optics block and headers never match.
 * The token ends at the first whitespace (real stars are tab- or
 * space-separated — same grammar as rebaseParticleRefs).
 */
export function particleRefsFromContent(text: string): ParticleRefRow[] {
  const rows: ParticleRefRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#") || t.startsWith("_") || t.startsWith("data_") || t === "loop_") {
      continue;
    }
    const m = /^(\d{1,9})@(\S+)/.exec(t);
    if (m) rows.push({ image: Number(m[1]), ref: m[2] });
  }
  return rows;
}

/** What the gate decided (the same verdict shape the other doors speak). */
export interface RefGateVerdict {
  /** non-null → refuse the dispatch with this message (the evidence). */
  refusal: string | null;
  /** non-null → allowed, and this honest receipt rides the run's log. */
  note: string | null;
}

/** A ref that violates its stack (the evidence the refusal names). */
export interface RefViolation {
  ref: string;
  image: number;
  nz: number;
}

/**
 * Verify every "N@path" ref in a particles star against the stacks' own
 * MRC headers. `candidatesOf(ref)` maps a star row's ref to the sniffable
 * paths in RELION's resolution order (absolute as-is; project-root; star
 * dir). A null sniffer degrades to the advisory note — never a block.
 *
 * The refusal fires ONLY on a found, parsed header whose NZ is smaller
 * than the star's largest image number for that stack — the exact
 * condition relion_refine dies on (rwMRC.h: "Image number N exceeds
 * stack size M"). Missing stacks, unparsable bytes and .eer refs are the
 * note's business, not the refusal's (RELION fails those fast and loudly
 * on its own; the silent 20-minute killer is the NUMBER mismatch).
 */
export async function particlesRefGate(
  starPath: string,
  starText: string,
  sniff: HeaderSniffer | null,
  candidatesOf: (ref: string) => string[]
): Promise<RefGateVerdict> {
  const clean: RefGateVerdict = { refusal: null, note: null };
  const refs = particleRefsFromContent(starText);
  if (refs.length === 0) return clean; // not a particles-star shape — nothing to verify
  if (!sniff) {
    return {
      refusal: null,
      note: `${refs.length} particle ref(s) were not verified against their stacks (no header reader) — if the upstream extraction was produced by an older version, re-run it once.`,
    };
  }
  return particlesRefGateFromRefs(refs, sniff, candidatesOf, { perRefReceipt: true });
}

/**
 * t346 — the same judging engine, fed PRE-EXTRACTED rows: the cluster lane
 * now censes the star IN PLACE (one awk pass on the cluster — see
 * remote-run's clusterParticleRefCensus) and hands back one row per UNIQUE
 * stack path carrying that stack's max image number. Zero star bytes cross
 * the wire; the verdicts, the refusal vocabulary and the candidate
 * resolution grammar are byte-identical to the text-parsed lane.
 *
 * `perRefReceipt` (the text lane's dialect) counts EVERY row for the
 * receipt ("300000 ref(s) verified"); the census lane passes false and the
 * receipt speaks in stacks + refs instead ("87 stack(s) verified across
 * 300000 particle refs") — both honest, each in its lane's own units.
 */
export async function particlesRefGateFromRefs(
  rows: ParticleRefRow[],
  sniff: HeaderSniffer | null,
  candidatesOf: (ref: string) => string[],
  opts?: { perRefReceipt?: boolean; totalRefs?: number }
): Promise<RefGateVerdict> {
  const clean: RefGateVerdict = { refusal: null, note: null };
  if (rows.length === 0) return clean;
  if (!sniff) {
    return {
      refusal: null,
      note: `${opts?.totalRefs ?? rows.length} particle ref(s) were not verified against their stacks (no header reader) — if the upstream extraction was produced by an older version, re-run it once.`,
    };
  }

  // per unique RESOLVED path: the star's largest image number
  const maxImageByPath = new Map<string, number>();
  const candidateLists: { ref: string; candidates: string[] }[] = [];
  for (const r of rows) {
    const candidates = candidatesOf(r.ref);
    if (candidates.length === 0) continue; // unresolvable dialect → the note owns it
    candidateLists.push({ ref: r.ref, candidates });
    for (const c of candidates) {
      maxImageByPath.set(c, Math.max(maxImageByPath.get(c) ?? 0, r.image));
    }
  }
  const uniquePaths = [...maxImageByPath.keys()];
  if (uniquePaths.length === 0) {
    return {
      refusal: null,
      note: `${opts?.totalRefs ?? rows.length} particle ref(s) could not be resolved to stack paths — their headers were not verified.`,
    };
  }
  if (uniquePaths.length > REF_GATE_MAX_STACKS) {
    return {
      refusal: null,
      note: `${opts?.totalRefs ?? rows.length} particle refs across ${uniquePaths.length} stacks exceed the verification budget (${REF_GATE_MAX_STACKS}) — headers were not verified.`,
    };
  }

  // sniff in chunks (the remote lane rides one SSH round trip per chunk)
  const verdicts: Record<string, SniffVerdict> = {};
  for (let i = 0; i < uniquePaths.length; i += REF_GATE_SNIFF_CHUNK) {
    const chunk = uniquePaths.slice(i, i + REF_GATE_SNIFF_CHUNK);
    try {
      const v = await sniff(chunk);
      Object.assign(verdicts, v ?? {});
    } catch {
      /* a failed chunk stays unknown — the note speaks */
    }
  }

  // judge each ref by its FIRST candidate that exists (RELION's own order);
  // violations are PER STACK (one entry per path — a 341-row poisoned stack
  // is ONE lie told 341 times, not 341 lies)
  const violationByPath = new Map<string, RefViolation>();
  let verified = 0;
  let unknown = 0;
  for (const { ref, candidates } of candidateLists) {
    let judged: { path: string; verdict: SniffVerdict } | null = null;
    for (const c of candidates) {
      const v = verdicts[c];
      if (v && v.kind !== "unknown" && v.facts) {
        judged = { path: c, verdict: v };
        break;
      }
      if (v && v.kind === "unknown") {
        // the file answered but its bytes did not parse — try the next
        // candidate before giving up on this ref
        continue;
      }
      // no verdict for this candidate (missing file / failed chunk)
      continue;
    }
    if (!judged) {
      unknown++;
      continue;
    }
    const maxImage = maxImageByPath.get(judged.path) ?? 0;
    if (judged.verdict.facts && maxImage > judged.verdict.facts.nz) {
      if (!violationByPath.has(judged.path)) {
        violationByPath.set(judged.path, { ref, image: maxImage, nz: judged.verdict.facts.nz });
      }
    } else {
      verified++;
    }
  }
  const violations = [...violationByPath.values()];

  if (violations.length > 0) {
    const shown = violations.slice(0, 3);
    const more = violations.length - shown.length;
    const evidence =
      shown.map((v) => `image ${v.image} in ${v.ref} but that stack holds ${v.nz} image(s)`).join("; ") +
      (more > 0 ? `; +${more} more` : "");
    return {
      refusal:
        `the particles STAR references ${evidence} — relion_refine dies at exactly this row ` +
        `(readMRC: "Image number exceeds stack size", rwMRC.h). The upstream extraction COMPLETED but its ` +
        `output is internally inconsistent: same-stem rows in ITS input STAR (e.g. "X.mrc" + "X.mrcs") write ` +
        `the SAME particle stack — the later writer's blind overwrite leaves fewer images than the merged STAR ` +
        `rows count. Re-run the upstream extraction job (its dispatch now refuses colliding inputs with the ` +
        `offending rows named), or make a fresh extraction from a de-duplicated import, then run this job again`,
      note: null,
    };
  }
  const unknownSuffix =
    unknown > 0
      ? `; ${unknown} ref(s) could not be verified (missing or unparsable stacks) and were not judged`
      : "";
  const receipt =
    opts?.perRefReceipt
      ? `${verified} particle ref(s) verified against their stacks' own MRC headers — every image number sits ` +
        `within its stack's size (the readMRC "exceeds stack size" door)`
      : `${verified} particle stack(s) verified against their own MRC headers — every image number sits ` +
        `within its stack's size (the readMRC "exceeds stack size" door), across ` +
        `${opts?.totalRefs ?? rows.length} particle refs`;
  return {
    refusal: null,
    note: receipt + unknownSuffix,
  };
}

/** Star-dir + project-root candidate builder (the shared resolution grammar). */
export function refCandidates(ref: string, projectRoot: string, starDir: string): string[] {
  if (ref.startsWith("/")) return [ref];
  const clean = ref.replace(/^\.\//, "");
  const root = projectRoot.replace(/[\\/]+$/, "");
  const dir = starDir.replace(/[\\/]+$/, "");
  const out: string[] = [];
  const viaRoot = `${root}/${clean}`;
  const viaStar = `${dir}/${clean}`;
  out.push(viaRoot);
  if (viaStar !== viaRoot) out.push(viaStar);
  return out;
}

/** The job types whose RELION argv consumes a particles STAR (--i and kin). */
export const PARTICLES_CONSUMER_TYPES = new Set([
  "class2d",
  "class3d",
  "refine3d",
  "initialmodel",
  "multibody",
  "polish",
  "ctfrefine",
  "subtract",
  "dynamight",
]);
