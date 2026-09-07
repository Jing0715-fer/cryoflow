import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { parseTopazTraining, type TopazEpoch } from "@/lib/relion/topaz-training";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/topaz-training — per-epoch Topaz training progress.
 *
 * Sources, merged in order (later files only fill epochs the earlier ones
 * left blank — run.out is authoritative because RELION pipes topaz's own
 * stdout there):
 *   1. the run's logFile (run.out) — RELION captures topaz's per-epoch
 *      console output (loss / precision / recall) verbatim;
 *   2. any *training*.txt / *loss*.txt / topaz*.log in the workdir (some
 *      topaz versions also tee a standalone log).
 *
 * Tolerant parser (see topaz-training.ts) — a log with no recognizable
 * progress returns [] and the chart self-hides.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ epochs: [], source: null });
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

    return NextResponse.json({ epochs, source });
  } catch (error) {
    console.error("GET /api/jobs/[id]/topaz-training failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
