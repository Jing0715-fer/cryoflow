import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface FscShell {
  /** spatial frequency in 1/Å */
  freq: number;
  /** resolution in Å (derived: 1/freq) */
  res: number;
  /** unmasked / gold-standard half-map FSC */
  fsc: number;
  /** masked + phase-corrected FSC (postprocess only) */
  correctedFsc?: number;
  /** phase-randomized noise FSC (postprocess only) */
  phaseRandomizedFsc?: number;
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

/**
 * GET /api/jobs/[id]/fsc — Fourier-shell correlation curve of a 3D
 * reconstruction, the "final report card" of a cryo-EM pipeline.
 *
 * Sources, in priority order:
 *  1. postprocess_fsc.fsc  (RELION postprocess: masked + corrected FSC)
 *  2. run_half1_model.star (finished gold-standard refine3d)
 *  3. run_itXXX_half1_model.star / run_itXXX_model.star (latest iteration,
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
    };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }
    const workdir = run.workdir;

    /* ---------- 1. postprocess_fsc.fsc ---------- */
    const fscFile = path.join(workdir, "postprocess_fsc.fsc");
    if (existsSync(fscFile)) {
      const rows = parseLoop(readFileSync(fscFile, "utf8"), [
        "_rlnResolution",
        "_rlnFourierShellCorrelation",
      ]);
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
          return NextResponse.json(finalize(id, "postprocess", "postprocess_fsc.fsc", shells));
        }
      }
    }

    /* ---------- 2/3. model.star gold-standard FSC ---------- */
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
        const rows = parseLoop(readFileSync(full, "utf8"), [
          "_rlnGoldStandardFsc",
        ]);
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
          return NextResponse.json(finalize(id, "model", name, shells));
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
  shells: FscShell[]
): FscResponse {
  const clean = shells.filter((s) => Number.isFinite(s.fsc));
  return {
    jobId,
    source,
    sourceFile,
    shells: clean,
    resolutionAt143: crossing(clean, 0.143),
    resolutionAt05: crossing(clean, 0.5),
  };
}
