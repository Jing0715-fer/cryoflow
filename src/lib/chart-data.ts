/**
 * CryoFlow — the server-side LOADERS for the job curves (t486).
 *
 * chart-rows.ts owns the RENDER derivations (response → chart rows → CSV,
 * t110). The bytes themselves were loaded by private GET bodies — first
 * /api/jobs/[id]/fsc, …/guinier, …/angdist (t486), then …/ctf,
 * …/motion, …/topaz-training joined them (t487, the bridge carries six) —
 * and that was fine while the only consumer was the browser. Then the
 * agent grew a science side (judge_2d_classes, check_convergence) and
 * the curves stayed out of its reach: asked "how resolved is this map?"
 * the model could quote a result line but never the FSC the badge came
 * from. This module lifts the loading half next to the derivation half:
 *
 *   loadFsc / loadGuinier / loadAngDist            — t486, the science trio
 *   loadCtf / loadMotion / loadTopazTraining      — t487, the prep trio
 *   the six routes                                 — thin guard+json shells
 *   the agent's get_job_curves tool                — the very same functions
 *
 * so the answer the model quotes IS the data the chart draws, by
 * construction. Parse logic is moved verbatim (cachedFileCompute keys
 * unchanged — the statcache hit rate survives the refactor untouched).
 *
 * t488 adds the JUDGMENT layer: interpretCtf / interpretMotion /
 * interpretTopaz build the tool's exact grammar (worst-fitting
 * micrographs, drift triage, loss direction) once, here in the well —
 * the loaders attach it to their responses, the thin routes pass it
 * through untouched, and the panels' interpretation strips render it.
 * Panel and model quote the same numbers because there is ONE place
 * where those numbers are built.
 *
 * Not-found is a thrown ChartJobNotFound (the routes translate it to 404,
 * the tool to an honest ok:false) — "no data in the workdir" is NOT an
 * error and stays an empty response, exactly as the routes behaved.
 */

import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { parseStar, findPair } from "@/lib/starfile";
import { parseGuinierEps } from "@/lib/relion/guinier-eps";
import { summarizeOrientation } from "@/lib/relion/rebalance-core";
import { ctfMicrographRows } from "@/lib/compare-rows";
import { motionCatalogueRows } from "@/lib/compare-rows";
import { parseTopazTraining } from "@/lib/relion/topaz-training";
import type {
  FscShell,
  FscResponse,
  GuinierPoint,
  GuinierResponse,
  CtfMicrograph,
  CtfSummary,
  CtfInterpretation,
  CtfResponse,
  MotionMicrograph,
  MotionSummary,
  MotionInterpretation,
  MotionResponse,
  TopazInterpretation,
} from "@/lib/chart-rows";
import type { TopazEpoch } from "@/lib/relion/topaz-training";

/** The job (after soft-link resolution) does not exist — routes map this
 *  to 404, the agent tool to ok:false. Distinct from "job exists but the
 *  workdir holds no curve" which is an honest empty response. */
export class ChartJobNotFound extends Error {
  constructor(public jobId: string) {
    super(`Job not found: ${jobId}`);
    this.name = "ChartJobNotFound";
  }
}

/* ================================================================== */
/* FSC — Fourier shell correlation, the final report card of a 3D map  */
/* ================================================================== */

export interface FscData extends FscResponse {
  jobId: string;
  /**
   * t457 — the postprocess star's data_general trio (official resolution,
   * the sharpening B-factor, the pixel size that owns the box edge).
   * Present only when source === "postprocess".
   */
  postprocessGeneral?: {
    finalResolution: number | null;
    bfactor: number | null;
    angpix: number | null;
  } | null;
}

interface PostprocessFsc {
  shells: FscShell[];
  reported: number | null;
  general: {
    finalResolution: number | null;
    bfactor: number | null;
    angpix: number | null;
  };
}

/* minimal STAR loop parser: finds the loop_ block that defines all
 * `requiredCols` and returns its rows keyed by column name. */
function parseLoop(
  text: string,
  requiredCols: string[]
): Record<string, string>[] | null {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "loop_") {
      const cols: { name: string; idx: number }[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith("_")) {
        const m = lines[j].trim().match(/^(.+?)\s+#(\d+)$/);
        if (m) cols.push({ name: m[1], idx: Number(m[2]) });
        j++;
      }
      const names = cols.map((c) => c.name);
      if (requiredCols.every((rc) => names.includes(rc))) {
        const rows: Record<string, string>[] = [];
        while (j < lines.length) {
          const t = lines[j].trim();
          if (!t || t === "loop_" || t.startsWith("data_") || t.startsWith("_")) break;
          if (t.startsWith("#")) break;
          const parts = t.split(/\s+/);
          if (parts.length >= cols.length) {
            const row: Record<string, string> = {};
            for (const c of cols) row[c.name] = parts[c.idx - 1];
            rows.push(row);
          }
          j++;
        }
        return rows;
      }
      i = j;
    } else {
      i++;
    }
  }
  return null;
}

const num = (s: string | undefined): number => {
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
};

/** FSC-threshold crossing by linear interpolation between shells. */
function crossing(
  shells: { freq: number; fsc: number }[],
  threshold: number
): number | null {
  for (let k = 1; k < shells.length; k++) {
    const a = shells[k - 1];
    const b = shells[k];
    if (a.fsc >= threshold && b.fsc < threshold) {
      const denom = a.fsc - b.fsc;
      if (denom <= 0) continue;
      const t = (a.fsc - threshold) / denom;
      const freq = a.freq + t * (b.freq - a.freq);
      if (freq > 0) return 1 / freq;
    }
  }
  return null;
}

/* source 1 — postprocess.star (RELION 5 canonical postprocess output)
 * data_fsc carries FOUR curves per shell: corrected, mask fraction,
 * unmasked and masked maps + phase-randomized reference. data_general
 * carries the official _rlnFinalResolution. */
function shellsFromPostprocessStar(text: string): PostprocessFsc | null {
  const rows = parseLoop(text, [
    "_rlnResolution",
    "_rlnFourierShellCorrelationCorrected",
  ]);
  if (!rows || rows.length === 0) return null;
  const shells: FscShell[] = [];
  for (const r of rows) {
    const freq = num(r["_rlnResolution"]);
    const corrected = num(r["_rlnFourierShellCorrelationCorrected"]);
    const unmasked = num(r["_rlnFourierShellCorrelationUnmaskedMaps"]);
    const masked = num(r["_rlnFourierShellCorrelationMaskedMaps"]);
    const phaseRand = num(
      r["_rlnCorrectedFourierShellCorrelationPhaseRandomizedMaskedMaps"]
    );
    // _rlnAngstromResolution carries a 999 sentinel on the first shell
    const angstrom = num(r["_rlnAngstromResolution"]);
    const res = Number.isFinite(angstrom) && angstrom > 0 && angstrom < 900
      ? angstrom
      : freq > 0 ? 1 / freq : NaN;
    if (!Number.isFinite(freq) || freq <= 0 || !Number.isFinite(res)) continue;
    const head = Number.isFinite(unmasked) ? unmasked : corrected;
    if (!Number.isFinite(head)) continue;
    shells.push({
      freq,
      res,
      fsc: head,
      ...(Number.isFinite(corrected) ? { correctedFsc: corrected } : {}),
      ...(Number.isFinite(phaseRand) ? { phaseRandomizedFsc: phaseRand } : {}),
      ...(Number.isFinite(masked) ? { maskedFsc: masked } : {}),
    });
  }
  if (shells.length === 0) return null;
  // official number straight from RELION's data_general block — and the
  // t457 trio (B-factor + pixel size) rides the SAME parse (zero extra IO;
  // the verdict face eats it whole)
  const star = parseStar(text);
  const rep = parseFloat(findPair(star, "_rlnFinalResolution") ?? "");
  const bfac = parseFloat(findPair(star, "_rlnBfactorUsedForSharpening") ?? "");
  const pix = parseFloat(findPair(star, "_rlnPixelSize") ?? "");
  return {
    shells,
    reported: Number.isFinite(rep) ? rep : null,
    general: {
      finalResolution: Number.isFinite(rep) ? rep : null,
      bfactor: Number.isFinite(bfac) ? bfac : null,
      angpix: Number.isFinite(pix) ? pix : null,
    },
  };
}

function finalizeFsc(
  jobId: string,
  source: "postprocess" | "model",
  sourceFile: string,
  shells: FscShell[],
  reported?: {
    reportedResolution: number | null;
    reportedLabel: string | null;
    postprocessGeneral?: FscData["postprocessGeneral"];
  }
): FscData {
  const clean = shells.filter((s) => Number.isFinite(s.fsc));
  // RELION's official 0.143 criterion uses the MASKED+CORRECTED curve when
  // available (postprocess), the raw gold-standard curve otherwise.
  const criterion: { freq: number; fsc: number }[] = clean.some(
    (s) => s.correctedFsc != null
  )
    ? clean
        .filter((s) => s.correctedFsc != null)
        .map((s) => ({ freq: s.freq, fsc: s.correctedFsc as number }))
    : clean.map((s) => ({ freq: s.freq, fsc: s.fsc }));
  return {
    jobId,
    source,
    sourceFile,
    shells: clean,
    resolutionAt143: crossing(criterion, 0.143),
    resolutionAt05: crossing(criterion, 0.5),
    reportedResolution: reported?.reportedResolution ?? null,
    reportedLabel: reported?.reportedLabel ?? null,
    ...(reported?.postprocessGeneral
      ? { postprocessGeneral: reported.postprocessGeneral }
      : {}),
  };
}

/**
 * The FSC curve of a 3D reconstruction — the data behind the fsc chart.
 *
 * Sources, in priority order:
 *  1. postprocess.star data_fsc  (RELION 5: 4 curves + official resolution)
 *  2. postprocess_fsc.fsc        (RELION ≤4 star-style table)
 *  3. postprocess_fsc.dat        (RELION 5 plain 2-column fallback)
 *  4. run_half1_model.star       (finished gold-standard refine3d)
 *  5. run_itXXX_half1_model.star / run_itXXX_model.star (latest iteration,
 *     live while refining)
 *
 * Empty shells (silent null-source) for 2D jobs — the FSC is a 3D concept.
 * Throws ChartJobNotFound when the job (after soft-link resolution) is gone.
 */
export async function loadFsc(jobId: string): Promise<FscData> {
  const job = await findEffectiveJob(jobId); // resolves soft links to the original
  if (!job) throw new ChartJobNotFound(jobId);
  const run = getRun(job.id);
  const empty: FscData = {
    jobId,
    source: null,
    sourceFile: null,
    shells: [],
    resolutionAt143: null,
    resolutionAt05: null,
    reportedResolution: null,
    reportedLabel: null,
  };
  if (!run?.workdir || !existsSync(run.workdir)) {
    return empty;
  }
  const workdir = run.workdir;

  /* ---------- 1. postprocess.star (RELION 5 canonical) ---------- */
  const ppStar = path.join(workdir, "postprocess.star");
  if (existsSync(ppStar)) {
    const parsed = cachedFileCompute(ppStar, "fsc:pp-star", shellsFromPostprocessStar);
    if (parsed && parsed.shells.length > 0) {
      return finalizeFsc(jobId, "postprocess", "postprocess.star", parsed.shells, {
        reportedResolution: parsed.reported,
        reportedLabel:
          parsed.reported != null
            ? "RELION final resolution (masked, sharpened)"
            : null,
        postprocessGeneral: parsed.general,
      });
    }
  }

  /* ---------- 2. legacy postprocess_fsc.fsc ---------- */
  const fscFile = path.join(workdir, "postprocess_fsc.fsc");
  if (existsSync(fscFile)) {
    const rows = cachedFileCompute(
      fscFile,
      "fsc:legacy-fsc",
      (text) =>
        parseLoop(text, [
          "_rlnResolution",
          "_rlnFourierShellCorrelation",
        ]),
    );
    if (rows && rows.length > 0) {
      const shells: FscShell[] = [];
      for (const r of rows) {
        const freq = num(r["_rlnResolution"]);
        const fsc = num(r["_rlnFourierShellCorrelation"]);
        if (!Number.isFinite(freq) || !Number.isFinite(fsc) || freq <= 0) continue;
        const corrected = num(r["_rlnCorrectedFourierShellCorrelation"]);
        const phaseRand = num(r["_rlnFourierShellCorrelationPhaseRandomizedNoise"]);
        shells.push({
          freq,
          res: 1 / freq,
          fsc,
          ...(Number.isFinite(corrected) ? { correctedFsc: corrected } : {}),
          ...(Number.isFinite(phaseRand) ? { phaseRandomizedFsc: phaseRand } : {}),
        });
      }
      if (shells.length > 0) {
        return finalizeFsc(jobId, "postprocess", "postprocess_fsc.fsc", shells);
      }
    }
  }

  /* ---------- 3. plain postprocess_fsc.dat (freq + fsc) ---------- */
  const datFile = path.join(workdir, "postprocess_fsc.dat");
  if (existsSync(datFile)) {
    const shells: FscShell[] =
      cachedFileCompute(datFile, "fsc:plain-dat", (text) => {
        const out: FscShell[] = [];
        for (const raw of text.split(/\r?\n/)) {
          const t = raw.trim();
          if (!t || t.startsWith("#")) continue;
          const cells = t.split(/\s+/).map(Number);
          if (cells.length < 2) continue;
          const [freq, fsc] = cells;
          if (!Number.isFinite(freq) || !Number.isFinite(fsc) || freq <= 0) continue;
          out.push({ freq, res: 1 / freq, fsc });
        }
        return out;
      }) ?? [];
    if (shells.length > 0) {
      return finalizeFsc(jobId, "postprocess", "postprocess_fsc.dat", shells);
    }
  }

  /* ---------- 4/5. model.star gold-standard FSC ---------- */
  const files = readdirSync(workdir);
  const half1 = files.find((f) => /^run_half1_model\.star$/i.test(f));
  const iters: { name: string; iter: number; half: boolean }[] = [];
  for (const name of files) {
    const m = name.match(/^run_it(\d+)_(half1_)?model\.star$/i);
    if (m) iters.push({ name, iter: Number(m[1]), half: Boolean(m[2]) });
  }
  // best checkpoint: final half1 > latest half1 > latest plain
  iters.sort((a, b) => b.iter - a.iter || (b.half ? 1 : 0) - (a.half ? 1 : 0));
  const candidates = [
    ...(half1 ? [half1] : []),
    ...iters.map((it) => it.name),
  ];

  for (const name of candidates) {
    const full = path.join(workdir, name);
    try {
      const rows = cachedFileCompute(
        full,
        "fsc:model-star",
        (text) => parseLoop(text, ["_rlnGoldStandardFsc"]),
      );
      if (!rows || rows.length === 0) continue;
      const hasAngstrom = "_rlnAngstromResolution" in rows[0];
      const shells: FscShell[] = [];
      for (const r of rows) {
        const freq = num(r["_rlnResolution"]);
        const fsc = num(r["_rlnGoldStandardFsc"]);
        const res = hasAngstrom ? num(r["_rlnAngstromResolution"]) : freq > 0 ? 1 / freq : NaN;
        if (!Number.isFinite(freq) || !Number.isFinite(fsc)) continue;
        if (freq <= 0 || res >= 900) continue; // 999 sentinel rows
        shells.push({ freq, res, fsc });
      }
      if (shells.length > 0) {
        // RELION's own auto-refine estimate lives in the FINAL
        // run_model.star data_model_general block (_rlnCurrentResolution).
        // The raw per-iteration FSC table crosses 0.143 earlier than the
        // smoothed estimate — show both instead of contradicting the job
        // card badge.
        let reported: number | null = null;
        const finalModel = path.join(workdir, "run_model.star");
        if (existsSync(finalModel)) {
          const rep = cachedFileCompute(finalModel, "fsc:final-model-reported", (text) => {
            const v = parseFloat(
              findPair(parseStar(text), "_rlnCurrentResolution") ?? ""
            );
            return Number.isFinite(v) ? v : null;
          });
          reported = rep ?? null;
        }
        return finalizeFsc(jobId, "model", name, shells, {
          reportedResolution: reported,
          reportedLabel:
            reported != null
              ? "RELION auto-refine estimate (smoothed FSC)"
              : null,
        });
      }
    } catch {
      /* try next candidate */
    }
  }

  return empty;
}

/* ================================================================== */
/* Guinier — amplitude falloff, the B-factor validation plot           */
/* ================================================================== */

/**
 * The Guinier plot of a PostProcess job — the data behind the guinier
 * chart. Type IS chart-rows' GuinierResponse (byte-identical shape, so
 * every guinierRows consumer accepts a loader result as-is).
 *
 * Sources, best first:
 *  1. postprocess.star data_guinier  (RELION 5: exact 5-column numeric
 *     table — resolution², ln-amp original/weighted/sharpened/intercept)
 *  2. postprocess_guinier.eps        (RELION 5 plot-only fallback; lossy
 *     affine recovery via guinier-eps.ts)
 *  3. postprocess.guinier            (RELION ≤4 plain text table)
 *
 * The straight-line falloff validates the applied B-factor; curvature at
 * low resolution flags mask artefacts. The B-factor itself comes from
 * postprocess.star `data_general._rlnBfactorUsedForSharpening` when
 * present, else grepped from run.out ("apply b-factor of ...").
 * Throws ChartJobNotFound when the job is gone.
 */
export async function loadGuinier(jobId: string): Promise<GuinierResponse> {
  const job = await findEffectiveJob(jobId);
  if (!job) throw new ChartJobNotFound(jobId);
  const run = getRun(job.id);
  const empty: GuinierResponse = { jobId, sourceFile: null, points: [], bfactor: null };
  if (!run?.workdir || !existsSync(run.workdir)) {
    return empty;
  }
  const workdir = run.workdir;
  let points: GuinierPoint[] = [];
  let sourceFile = "postprocess_guinier.eps";

  // ---- 1. postprocess.star data_guinier — the exact numeric table ----
  // RELION 5 stopped writing the plain `postprocess.guinier` file but
  // quietly kept the FULL table inside postprocess.star: 1/d², ln-amp of
  // the original (masked) map, the B-weighted curve, the sharpened curve
  // and the fitted intercept. Prefer it over the EPS pixel recovery.
  const ppStar = path.join(workdir, "postprocess.star");
  if (existsSync(ppStar)) {
    const fromStar = cachedFileCompute(ppStar, "guinier:pp-star-table", (text) => {
      const star = parseStar(text);
      const block = star.blocks.find((b) => b.name === "guinier" && b.loop);
      if (!block?.loop) return [] as GuinierPoint[];
      const cols = block.loop.columns;
      const iX = cols.indexOf("_rlnResolutionSquared");
      const iOrig = cols.indexOf("_rlnLogAmplitudesOriginal");
      const iSharp = cols.indexOf("_rlnLogAmplitudesSharpened");
      if (iX < 0 || iOrig < 0) return [] as GuinierPoint[];
      const pts: GuinierPoint[] = [];
      for (const row of block.loop.rows) {
        const x = parseFloat(row[iX]);
        const y1 = parseFloat(row[iOrig]);
        if (!Number.isFinite(x) || !Number.isFinite(y1)) continue;
        const y2 = iSharp >= 0 ? parseFloat(row[iSharp]) : NaN;
        pts.push({
          x,
          lnAmp: y1,
          lnAmpSharpened: Number.isFinite(y2) ? y2 : null,
        });
      }
      return pts;
    });
    if (fromStar && fromStar.length > 0) {
      points = fromStar;
      sourceFile = "postprocess.star";
    }
  }

  // ---- 2. EPS data recovery (plot-only installs) / 3. legacy table ----
  const epsFile = path.join(workdir, "postprocess_guinier.eps");
  const tableFile = path.join(workdir, "postprocess.guinier");
  if (points.length === 0 && existsSync(epsFile)) {
    points = cachedFileCompute(epsFile, "guinier:eps", (text) => parseGuinierEps(text) ?? []) ?? [];
  }
  if (points.length === 0 && existsSync(tableFile)) {
    points =
      cachedFileCompute(tableFile, "guinier:legacy-table", (text) => {
        const pts: GuinierPoint[] = [];
        for (const raw of text.split(/\r?\n/)) {
          const t = raw.trim();
          if (!t || t.startsWith("#")) continue;
          const cells = t.split(/\s+/).map((c) => parseFloat(c));
          if (cells.length < 2) continue;
          const [x, y1, y2] = cells;
          if (!Number.isFinite(x) || !Number.isFinite(y1)) continue;
          pts.push({
            x,
            lnAmp: y1,
            lnAmpSharpened: Number.isFinite(y2) ? y2 : null,
          });
        }
        return pts;
      }) ?? [];
    sourceFile = "postprocess.guinier";
  }
  if (points.length === 0) {
    return empty;
  }

  // B-factor: exact value from postprocess.star data_general first
  // (_rlnBfactorUsedForSharpening), else the run.out log line — RELION ≤4
  // printed "Applied B-factor of -59.54 Å²", RELION 5 prints
  // "+ apply b-factor of: -804.776". Both forms matched (mtime-cached:
  // run.out grows per write, so the cache invalidates exactly when the
  // line could have changed).
  let bfactor: number | null = null;
  if (existsSync(ppStar)) {
    bfactor =
      cachedFileCompute(ppStar, "guinier:pp-star-bfactor", (text) => {
        const star = parseStar(text);
        const v = parseFloat(star.blocks.map((b) => b.pairs["_rlnBfactorUsedForSharpening"]).find((s) => s !== undefined) ?? "");
        return Number.isFinite(v) ? (v as number | null) : null;
      }) ?? null;
  }
  if (bfactor == null) {
    const logFile = path.join(workdir, "run.out");
    if (existsSync(logFile)) {
      bfactor = cachedFileCompute(logFile, "guinier:runout-bfactor", (text) => {
        const m =
          /Applied B-factor of\s+(-?\d+(?:\.\d+)?)/i.exec(text) ??
          /apply b-factor of:\s*(-?\d+(?:\.\d+)?)/i.exec(text);
        return m ? (parseFloat(m[1]) as number | null) : null;
      }) ?? null;
    }
  }

  return { jobId, sourceFile, points, bfactor };
}

/* ================================================================== */
/* Angular distribution — orientation coverage on the sphere           */
/* ================================================================== */

const ROT_BINS = 24;
const TILT_BINS = 12;

export interface AngDistData {
  jobId: string;
  /** iteration of the data star used (null for the final run_data.star) */
  iteration: number | null;
  /** total particles whose angles were binned */
  total: number;
  /** number of azimuth (rot) bins — 24 → 15° each */
  rotBins: number;
  /** number of polar (tilt) bins — 12 → 15° each */
  tiltBins: number;
  /** row-major counts: cells[rotIdx * tiltBins + tiltIdx] */
  cells: number[];
  /** hottest cell count */
  max: number;
  /** cells with at least one particle */
  occupied: number;
  /** concentration factor = max / mean over occupied cells (>6 ⇒ anisotropic) */
  anisotropy: number;
  /** point-group symmetry of the job, e.g. "D2" */
  symmetry: string | null;
  starFile: string | null;
  /** cryoSPARC-style view: Fibonacci-sphere bins (equal-area) + marginals */
  fib?: {
    bins: Array<{ x: number; y: number; z: number; count: number }>;
    maxBin: number;
    rotHist: number[];
    tiltHist: number[];
    anisotropy: number;
  };
}

/** Column index of `label` inside the particle data loop of a STAR text. */
function labelColumn(lines: string[], label: string): number {
  let inLoop = false;
  let pos = 0; // 1-based running position in the current loop
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "loop_") {
      inLoop = true;
      pos = 0;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    pos++;
    if (t.startsWith(label)) {
      // "_rlnFoo #12" (RELION 5) or "_rlnFoo 12" (plain)
      const m = /#\s*(\d+)\s*$/.exec(t) ?? /^\S+\s+(\d+)\s*$/.exec(t);
      return m ? parseInt(m[1], 10) - 1 : pos - 1;
    }
  }
  return -1;
}

/**
 * The angular distribution of a reconstruction/classification — the data
 * behind the angular-distribution chart. Throws ChartJobNotFound when the
 * job is gone; an empty response (total 0) when the workdir has no
 * particle-angle star yet.
 */
export async function loadAngDist(jobId: string): Promise<AngDistData> {
  const job = await findEffectiveJob(jobId);
  if (!job) throw new ChartJobNotFound(jobId);
  const run = getRun(job.id);
  const empty: AngDistData = {
    jobId,
    iteration: null,
    total: 0,
    rotBins: ROT_BINS,
    tiltBins: TILT_BINS,
    cells: [],
    max: 0,
    occupied: 0,
    anisotropy: 0,
    symmetry: null,
    starFile: null,
    fib: {
      bins: [],
      maxBin: 0,
      rotHist: new Array<number>(48).fill(0),
      tiltHist: new Array<number>(36).fill(0),
      anisotropy: 1,
    },
  };
  if (!run?.workdir || !existsSync(run.workdir)) {
    return empty;
  }

  // run_data.star is written ONCE at convergence — the authoritative FINAL
  // angular assignment for a completed refine; while running, the freshest
  // data lives in the highest run_itXXX_data.star. (The old loop let the
  // itXXX files override run_data.star, showing iteration-13 angles for a
  // run that had already converged.)
  let best: { iteration: number | null; file: string } | null = null;
  const files = readdirSync(run.workdir);
  const finalData = files.find((n) => /^run_data\.star$/i.test(n));
  if (finalData) {
    best = { iteration: null, file: finalData };
  } else {
    for (const name of files) {
      const m = name.match(/^run_it(\d+)_data\.star$/i);
      if (!m) continue;
      const iteration = Number(m[1]);
      if (!best || iteration > (best.iteration ?? 0)) best = { iteration, file: name };
    }
  }
  // engine-native orientation jobs (symexpand / rebalance) write their own
  // single particles star — feed the SAME polar/Mollweide views from it.
  if (!best) {
    const native = files.find(
      (n) => /^particles_(symexpand|rebalance)\.star$/i.test(n) || /^particles\.star$/i.test(n)
    );
    if (native) best = { iteration: null, file: native };
  }
  if (!best) {
    return empty;
  }

  // Poll-friendly: the star file only changes when RELION finishes an
  // iteration — cache the full parse+binning+fib pass behind its
  // (size, mtime) so 1–2 s polls cost one statSync instead of re-parsing
  // megabytes of STAR text (see statcache.ts).
  const starPath = path.join(run.workdir, best.file);
  const aggregate = cachedFileCompute(starPath, "angdist:bins", (text) => {
    const lines = text.split("\n");
    const rotCol = labelColumn(lines, "_rlnAngleRot");
    const tiltCol = labelColumn(lines, "_rlnAngleTilt");
    if (rotCol < 0 || tiltCol < 0) return null;

    const cells = new Array<number>(ROT_BINS * TILT_BINS).fill(0);
    let total = 0;
    let max = 0;
    const angles: Array<{ rot: number; tilt: number }> = [];
    for (const raw of lines) {
      const t = raw.trim();
      if (!t || t.startsWith("#") || t.startsWith("_") || t === "loop_" || t.startsWith("data_")) continue;
      const parts = t.split(/\s+/);
      if (parts.length <= Math.max(rotCol, tiltCol)) continue;
      const rot = parseFloat(parts[rotCol]);
      const tilt = parseFloat(parts[tiltCol]);
      if (!Number.isFinite(rot) || !Number.isFinite(tilt)) continue;
      // rot 0–360 (wrap negatives), tilt clamped 0–180
      const rotIdx = Math.min(ROT_BINS - 1, Math.floor((((rot % 360) + 360) % 360) / (360 / ROT_BINS)));
      const tiltIdx = Math.min(TILT_BINS - 1, Math.floor(Math.max(0, Math.min(180, tilt)) / (180 / TILT_BINS)));
      const idx = rotIdx * TILT_BINS + tiltIdx;
      cells[idx]++;
      total++;
      if (cells[idx] > max) max = cells[idx];
      angles.push({ rot, tilt });
    }
    // cryoSPARC-style equal-area summary (fib sphere + marginals) for the
    // Mollweide panel — computed from the same angle list, live-capable.
    const fib = total > 0 ? summarizeOrientation(angles, 610, 48, 36) : null;
    return { cells, total, max, rotCol, tiltCol, fib };
  });

  if (!aggregate || aggregate.rotCol < 0 || aggregate.tiltCol < 0) {
    return { ...empty, starFile: best.file, iteration: best.iteration };
  }

  const { cells, total, max, fib } = aggregate;

  const occupied = cells.reduce((n, c) => n + (c > 0 ? 1 : 0), 0);
  const anisotropy =
    occupied > 0 && total > 0 ? max / Math.max(1, total / occupied) : 0;
  let symmetry: string | null = null;
  try {
    const parsed = JSON.parse(job.params ?? "{}") as Record<string, unknown>;
    if (typeof parsed.symmetry === "string" && parsed.symmetry.trim()) {
      symmetry = parsed.symmetry.trim();
    }
  } catch {
    /* params is a JSON string; malformed ⇒ no symmetry chip */
  }

  return {
    jobId,
    iteration: best.iteration,
    total,
    rotBins: ROT_BINS,
    tiltBins: TILT_BINS,
    cells,
    max,
    occupied,
    anisotropy,
    symmetry,
    starFile: best.file,
    ...(fib
      ? {
          fib: {
            bins: fib.bins,
            maxBin: fib.maxBin,
            rotHist: fib.rotHist,
            tiltHist: fib.tiltHist,
            anisotropy: fib.anisotropy,
          },
        }
      : {}),
  };
}

/* ================================================================== */
/* CTF — per-micrograph fit quality (CtfFind), t469's one grammar      */
/* ================================================================== */

/** The ctf route's response face (micrographs + summary), with the sort
 *  and summary math the route used to own now living here verbatim. */
export interface CtfData extends CtfResponse {
  jobId: string;
}

/**
 * CTF fit rows of a CtfFind job, straight from micrographs_ctf.star
 * (moved verbatim from the route body, t487). The defocusU-descending
 * sort copies first — it must NOT mutate the lib's cached array — and
 * the summary aggregates (mean/min/max defocus, worst astigmatism, mean
 * FoM, worst fit resolution) keep the route's exact shape. Empty or
 * absent workdir → an honest empty response, never an error.
 */
export async function loadCtf(jobId: string): Promise<CtfData> {
  const job = await findEffectiveJob(jobId); // resolves soft links to the original
  if (!job) throw new ChartJobNotFound(jobId);
  const run = getRun(job.id);
  if (!run?.workdir || !existsSync(run.workdir)) {
    return { jobId, micrographs: [], summary: null, interpretation: null };
  }

  // t469 — the file hunt + cached parse live in lib/compare-rows.ts (ONE
  // grammar under the route, the dialog and the agent's compare_jobs tool)
  const parsed = ctfMicrographRows(run.workdir);
  if (parsed.length === 0) {
    return { jobId, micrographs: [], summary: null, interpretation: null };
  }
  // the sort must NOT mutate the lib's cached array
  const micrographs = [...parsed].sort((a, b) => b.defocusU - a.defocusU);

  let summary: CtfSummary | null = null;
  if (micrographs.length > 0) {
    const defoci = micrographs.map((m) => (m.defocusU + m.defocusV) / 2);
    const foms = micrographs.filter((m) => m.fom > 0).map((m) => m.fom);
    const maxRes = micrographs
      .filter((m) => m.maxResolution > 0)
      .map((m) => m.maxResolution);
    summary = {
      count: micrographs.length,
      meanDefocus: defoci.reduce((s, d) => s + d, 0) / defoci.length,
      minDefocus: Math.min(...defoci),
      maxDefocus: Math.max(...defoci),
      maxAstigmatism: Math.max(...micrographs.map((m) => m.astigmatism)),
      meanFom:
        foms.length > 0 ? foms.reduce((s, f) => s + f, 0) / foms.length : 0,
      worstResolution: maxRes.length > 0 ? Math.max(...maxRes) : 0,
    };
  }

  return { jobId, micrographs, summary, interpretation: interpretCtf(micrographs, summary) };
}

/* ================================================================== */
/* Motion — per-micrograph accumulated drift (MotionCorr)              */
/* ================================================================== */

/** The motion route's response face, with the summary math living here
 *  verbatim (mean/max total drift, the first offender's name, and the
 *  early/late split a user actually triages). */
export interface MotionData extends MotionResponse {
  jobId: string;
}

/**
 * Per-micrograph accumulated motion of a MotionCorr job, from
 * corrected_micrographs.star (moved verbatim from the route body, t487).
 * Early drift (before the stage settles) vs late drift (dose-weighting
 * window) split the total into the two halves a user triages on; both
 * are reasons to drop the movie. Block-aware parsing stays in
 * motionCatalogueRows (t469's ONE grammar). Empty or absent workdir →
 * an honest empty response, never an error.
 */
export async function loadMotion(jobId: string): Promise<MotionData> {
  const job = await findEffectiveJob(jobId); // resolves soft links to the original
  if (!job) throw new ChartJobNotFound(jobId);
  const run = getRun(job.id);
  const { sourceFile, micrographs } = motionCatalogueRows(run?.workdir ?? "");
  if (!sourceFile || micrographs.length === 0) {
    return { jobId, sourceFile: null, micrographs: [], summary: null, interpretation: null };
  }

  const n = micrographs.length;
  const sum = (sel: (m: MotionMicrograph) => number) =>
    micrographs.reduce((acc, m) => acc + sel(m), 0);
  const worst = micrographs.reduce((a, b) => (b.total > a.total ? b : a));
  const summary: MotionSummary = {
    count: n,
    meanTotal: sum((m) => m.total) / n,
    maxTotal: worst.total,
    worstName: worst.name,
    meanEarly: sum((m) => m.early) / n,
    meanLate: sum((m) => m.late) / n,
  };

  return {
    jobId,
    sourceFile: "corrected_micrographs.star",
    micrographs,
    summary,
    interpretation: interpretMotion(micrographs, summary),
  };
}

/* ================================================================== */
/* Topaz — per-epoch picker training progress                          */
/* ================================================================== */

/** The topaz-training route's response face: the merged per-epoch series
 *  (run.out is authoritative) plus the label of the file it came from,
 *  and — t488 — the judgment layer (first/last epoch + loss direction). */
export interface TopazData {
  jobId: string;
  epochs: TopazEpoch[];
  source: string | null;
  interpretation: TopazInterpretation | null;
}

/**
 * Per-epoch Topaz training progress (moved verbatim from the route body,
 * t487). Sources, merged in order (later files only fill epochs the
 * earlier ones left blank — run.out is authoritative because RELION
 * pipes topaz's own stdout there):
 *   1. the run's logFile (run.out) — RELION captures topaz's per-epoch
 *      console output (loss / precision / recall) verbatim;
 *   2. any *training*.txt / *loss*.txt / topaz*.log in the workdir.
 * Tolerant parser (topaz-training.ts) — a log with no recognizable
 * progress returns [] and the chart self-hides; the 4 MB ceiling skips
 * dumps while the statcache key "topaz-training" survives untouched.
 */
export async function loadTopazTraining(jobId: string): Promise<TopazData> {
  const job = await findEffectiveJob(jobId); // resolves soft links to the original
  if (!job) throw new ChartJobNotFound(jobId);
  const run = getRun(job.id);
  if (!run?.workdir || !existsSync(run.workdir)) {
    return { jobId, epochs: [], source: null, interpretation: null };
  }

  // candidate logs: the tracked run.out first, then training-named files
  const sources: { file: string; label: string }[] = [];
  if (run.logFile && existsSync(run.logFile)) {
    sources.push({ file: run.logFile, label: path.basename(run.logFile) });
  }
  try {
    for (const name of readdirSync(run.workdir)) {
      if (!/training|loss|topaz.*\.log$/i.test(name)) continue;
      if (!/\.(txt|log|csv)$/i.test(name)) continue;
      const abs = path.join(run.workdir, name);
      if (sources.some((s) => s.file === abs)) continue;
      sources.push({ file: abs, label: name });
    }
  } catch {
    /* workdir listing failed — proceed with what we have */
  }

  let epochs: TopazEpoch[] = [];
  let source: string | null = null;
  for (const src of sources) {
    try {
      const st = statSync(src.file);
      if (st.size > 4_000_000) continue; // a log, not a dump — skip giants
      const parsed = cachedFileCompute(src.file, "topaz-training", (text) => {
        const pts = parseTopazTraining(text);
        return pts.length > 0 ? JSON.stringify(pts) : "";
      });
      if (parsed) {
        const pts = JSON.parse(parsed) as TopazEpoch[];
        // merge: fill only epochs this source didn't cover (run.out wins)
        if (epochs.length === 0) {
          epochs = pts;
          source = src.label;
        } else {
          const have = new Set(epochs.map((e) => e.it));
          let merged = false;
          for (const p of pts) {
            if (have.has(p.it)) continue;
            epochs.push(p);
            merged = true;
          }
          if (merged) epochs.sort((a, b) => a.it - b.it);
        }
      }
    } catch {
      /* unreadable source — skip */
    }
  }

  return { jobId, epochs, source, interpretation: interpretTopaz(epochs, source) };
}

/* ================================================================== */
/* Interpretation — the tool's grammar, computed ONCE (t488)           */
/* ================================================================== */

/** The judgment layer of the ctf/motion/topaz wells. t487 moved the
 *  LOADING here; t488 moves the interpretation here too: these builders
 *  produce the exact shapes the agent's get_job_curves quotes (worst
 *  fits, drift triage, first/last epoch) and the panels' interpretation
 *  strips render. Byte-identical to the math that lived inline in
 *  tools.ts — the t486/t487 benches hold the tool faces fixed while the
 *  well absorbs the computation. Every verdict is a fact from pure
 *  comparison of the loaded rows — no threshold is invented.
 *
 *  Pure functions on the loaded data: no IO, no cache, no state. */

/** The worst-fitting micrographs, fit resolution largest first — the
 *  three rows the panel strips name and the tool's worstMicrographs
 *  carries. Defocus lands in µm (3 dp), FoM at 2 dp, matching the tool's
 *  spoken face. */
export function interpretCtf(
  micrographs: CtfMicrograph[],
  summary: CtfSummary | null
): CtfInterpretation | null {
  if (!summary || micrographs.length === 0) return null;
  const worstMicrographs = [...micrographs]
    .sort((a, b) => b.maxResolution - a.maxResolution)
    .slice(0, 3)
    .map((m) => ({
      name: m.name,
      defocusUm: Math.round(((m.defocusU + m.defocusV) / 2) * 1000) / 1000,
      astigmatismUm: Math.round(m.astigmatism * 1000) / 1000,
      fom: Math.round(m.fom * 100) / 100,
      maxResolutionA: m.maxResolution > 0 ? m.maxResolution : null,
    }));
  return { worstMicrographs };
}

/** The drift triage (which half of the movie the drift accumulates in)
 *  and the worst-drifting micrographs, total largest first — the tool's
 *  exact wording survives: "early-frames dominate (the stage settles
 *  late)" / "late-frames dominate (kept drifting to the end)" / "even
 *  split". Drift values land at 1 dp in Å. */
export function interpretMotion(
  micrographs: MotionMicrograph[],
  summary: MotionSummary | null
): MotionInterpretation | null {
  if (!summary || micrographs.length === 0) return null;
  const driftTriage =
    summary.meanEarly > summary.meanLate
      ? "early-frames dominate (the stage settles late)"
      : summary.meanLate > summary.meanEarly
        ? "late-frames dominate (kept drifting to the end)"
        : "even split";
  const worstMicrographs = [...micrographs]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((m) => ({
      name: m.name,
      totalA: Math.round(m.total * 10) / 10,
      earlyA: Math.round(m.early * 10) / 10,
      lateA: Math.round(m.late * 10) / 10,
    }));
  return { driftTriage, worstMicrographs };
}

/** The first/last epoch in the tool's exact shape (it/trainLoss/testLoss/
 *  precision/recall — the held-out P/R fields stay out, as the tool
 *  carries them) plus the train-loss direction: falling/rising/flat,
 *  present only when BOTH ends carry a finite train loss. */
export function interpretTopaz(
  epochs: TopazEpoch[],
  _source: string | null
): TopazInterpretation | null {
  if (epochs.length === 0) return null;
  const pick = (e: TopazEpoch) => ({
    it: e.it,
    trainLoss: e.trainLoss,
    testLoss: e.testLoss,
    precision: e.precision,
    recall: e.recall,
  });
  const first = epochs[0];
  const last = epochs[epochs.length - 1];
  const interp: TopazInterpretation = {
    firstEpoch: pick(first),
    lastEpoch: pick(last),
  };
  if (
    first.trainLoss != null &&
    Number.isFinite(first.trainLoss) &&
    last.trainLoss != null &&
    Number.isFinite(last.trainLoss)
  ) {
    interp.lossDirection =
      last.trainLoss < first.trainLoss
        ? "falling"
        : last.trainLoss > first.trainLoss
          ? "rising"
          : "flat";
  }
  return interp;
}
