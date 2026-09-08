import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync } from "fs";
import { db } from "@/lib/db";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface FscIndexEntry {
  jobId: string;
  name: string;
  type: string;
  status: string;
  /** which FSC flavor this job carries — postprocess = masked+corrected
   *  criterion, model = raw gold-standard half-map curve */
  source: "postprocess" | "model";
  /** the on-disk file that made this job a candidate (same priority order
   *  the per-job /api/jobs/[id]/fsc route uses) */
  sourceFile: string;
}

export interface FscIndexResponse {
  projectId: string;
  jobs: FscIndexEntry[];
}

/**
 * GET /api/projects/[id]/fsc-index — cheap project-wide discovery of jobs
 * that carry an FSC curve, the backbone of the compare-FSC overlay dialog.
 *
 * Deliberately PARSE-FREE: each job's workdir is readdir'd once and
 * classified by file-name presence, mirroring the per-job FSC route's
 * source priority (postprocess.star → postprocess_fsc.fsc → .dat →
 * run_half1_model.star → run_itNNN_model.star). Curve shells themselves
 * are only parsed when the dialog fetches /api/jobs/[id]/fsc for the
 * SELECTED jobs (statcache makes repeats cheap) — a project-wide parse
 * here would turn one dialog open into N star-file reads.
 *
 * Soft links resolve through findEffectiveJob: a linked job MIRRORS the
 * original's outputs, so both would claim the same workdir — the first
 * row wins and later mirrors are skipped (the dialog is about distinct
 * curves, not aliases).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const jobs = await db.job.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true, status: true },
    });

    const seen = new Set<string>();
    const out: FscIndexEntry[] = [];

    for (const j of jobs) {
      const eff = await findEffectiveJob(j.id);
      if (!eff) continue;
      if (seen.has(eff.id)) continue;
      seen.add(eff.id);

      const run = getRun(eff.id);
      const wd = run?.workdir;
      if (!wd || !existsSync(wd)) continue;
      let names: string[];
      try {
        names = readdirSync(wd);
      } catch {
        continue;
      }
      const has = (n: string) => names.some((f) => f.toLowerCase() === n);

      // per-iteration model checkpoints (refine3d / class3d live FSC)
      const iters = names
        .map((n) => n.match(/^run_it(\d+)_(half1_)?model\.star$/i))
        .filter((m): m is RegExpMatchArray => m !== null);

      let source: FscIndexEntry["source"] | null = null;
      let sourceFile: string | null = null;
      if (has("postprocess.star")) {
        source = "postprocess";
        sourceFile = "postprocess.star";
      } else if (has("postprocess_fsc.fsc")) {
        source = "postprocess";
        sourceFile = "postprocess_fsc.fsc";
      } else if (has("postprocess_fsc.dat")) {
        source = "postprocess";
        sourceFile = "postprocess_fsc.dat";
      } else if (has("run_half1_model.star")) {
        source = "model";
        sourceFile = "run_half1_model.star";
      } else if (iters.length > 0) {
        // best checkpoint first: highest iteration, half1 preferred —
        // the same ranking the per-job FSC route applies
        iters.sort(
          (a, b) =>
            Number(b[1]) - Number(a[1]) ||
            (b[2] ? 1 : 0) - (a[2] ? 1 : 0)
        );
        source = "model";
        sourceFile = iters[0][0];
      }
      if (!source || !sourceFile) continue;

      out.push({
        jobId: j.id,
        name: j.name,
        type: j.type,
        status: j.status,
        source,
        sourceFile,
      });
    }

    // postprocess carries the official corrected criterion — surface those
    // first; within a group keep the creation order (oldest pipelines first
    // reads naturally: refine → postprocess)
    out.sort((a, b) =>
      a.source === b.source ? 0 : a.source === "postprocess" ? -1 : 1
    );

    const body: FscIndexResponse = { projectId: id, jobs: out };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/projects/[id]/fsc-index failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
