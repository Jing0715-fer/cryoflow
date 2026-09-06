import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { parseStar, findPair } from "@/lib/starfile";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface FscShell {
  /** spatial frequency in 1/Å */
  freq: number;
  /** resolution in Å (derived: 1/freq) */
  res: number;
  /** unmasked / gold-standard half-map FSC */
  fsc: number;
  /** masked + phase-corrected FSC (postprocess only) — RELION's official criterion */
  correctedFsc?: number;
  /** phase-randomized noise FSC (postprocess only) */
  phaseRandomizedFsc?: number;
  /** raw masked-maps FSC before correction (postprocess only) */
  maskedFsc?: number;
}

export interface FscResponse {
  jobId: string;
  source: "postprocess" | "model" | null;
  sourceFile: string | null;
  shells: FscShell[];
  /** FSC=0.143 crossing (gold-standard criterion) in Å */
  resolutionAt143: number | null;
  /** FSC=0.5 crossing (half-bit criterion) in Å */
  resolutionAt05: number | null;
  /**
   * RELION's own resolution estimate, read from the star metadata:
   * postprocess `data_general._rlnFinalResolution` or auto-refine
   * `run_model.star data_model_general._rlnCurrentResolution`. The raw
   * table crossing can disagree with this (RELION smooths the FSC before
   * estimating during auto-refine; postprocess may be Nyquist-limited),
   * so the UI shows both.
   */
  reportedResolution: number | null;
  /** human label for reportedResolution ("final resolution (masked)" …) */
  reportedLabel: string | null;
}

/* ------------------------------------------------------------------ */
/* minimal STAR loop parser: finds the loop_ block that defines all    */
/* `requiredCols` and returns its rows keyed by column name.           */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* source 1 — postprocess.star (RELION 5 canonical postprocess output) */
/* data_fsc carries FOUR curves per shell: corrected, mask fraction,   */
/* unmasked and masked maps + phase-randomized reference. data_general */
/* carries the official _rlnFinalResolution.                           */
/* ------------------------------------------------------------------ */
function shellsFromPostprocessStar(text: string): {
  shells: FscShell[];
  reported: number | null;
} | null {
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
  // official number straight from RELION's data_general block
  const star = parseStar(text);
  const rep = parseFloat(findPair(star, "_rlnFinalResolution") ?? "");
  return { shells, reported: Number.isFinite(rep) ? rep : null };
}

/**
 * GET /api/jobs/[id]/fsc — Fourier-shell correlation curve of a 3D
 * reconstruction, the "final report card" of a cryo-EM pipeline.
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
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    const empty: FscResponse = {
      jobId: id,
      source: null,
      sourceFile: null,
      shells: [],
      resolutionAt143: null,
      resolutionAt05: null,
      reportedResolution: null,
      reportedLabel: null,
    };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }
    const workdir = run.workdir;

    /* ---------- 1. postprocess.star (RELION 5 canonical) ---------- */
    const ppStar = path.join(workdir, "postprocess.star");
    if (existsSync(ppStar)) {
      const parsed = cachedFileCompute(ppStar, "fsc:pp-star", shellsFromPostprocessStar);
      if (parsed && parsed.shells.length > 0) {
        const res = finalize(id, "postprocess", "postprocess.star", parsed.shells, {
          reportedResolution: parsed.reported,
          reportedLabel:
            parsed.reported != null
              ? "RELION final resolution (masked, sharpened)"
              : null,
        });
        return NextResponse.json(res);
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
          return NextResponse.json(
            finalize(id, "postprocess", "postprocess_fsc.fsc", shells)
          );
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
        return NextResponse.json(
          finalize(id, "postprocess", "postprocess_fsc.dat", shells)
        );
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
          return NextResponse.json(
            finalize(id, "model", name, shells, {
              reportedResolution: reported,
              reportedLabel:
                reported != null
                  ? "RELION auto-refine estimate (smoothed FSC)"
                  : null,
            })
          );
        }
      } catch {
        /* try next candidate */
      }
    }

    return NextResponse.json(empty);
  } catch (error) {
    console.error("GET /api/jobs/[id]/fsc failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function finalize(
  jobId: string,
  source: "postprocess" | "model",
  sourceFile: string,
  shells: FscShell[],
  reported?: { reportedResolution: number | null; reportedLabel: string | null }
): FscResponse {
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
  };
}
