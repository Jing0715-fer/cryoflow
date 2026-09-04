import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface ResolutionPoint {
  iteration: number;
  /** _rlnCurrentResolution in Å (lower is better). */
  resolution: number;
}

/**
 * GET /api/jobs/[id]/resolution — per-iteration current resolution of a
 * refining job (class2d / initialmodel / refine3d / class3d …).
 *
 * Source: run_itXXX_(half1_)?model.star → _rlnCurrentResolution.
 * The half1 file is preferred (gold-standard half-map 1); plain model.star
 * covers the non-split jobs. Cheap key-value regex, no full STAR parse.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ points: [], current: null, best: null });
    }

    const points: ResolutionPoint[] = [];
    const seen = new Set<number>();
    for (const name of readdirSync(run.workdir)) {
      const m = name.match(/^run_it(\d+)_((half1_))?model\.star$/i);
      if (!m) continue;
      const iteration = Number(m[1]);
      if (seen.has(iteration)) continue;
      try {
        const text = readFileSync(path.join(run.workdir, name), "utf8");
        const res = text.match(/_rlnCurrentResolution\s+([\d.eE+-]+)/);
        if (res) {
          const value = Number(res[1]);
          if (Number.isFinite(value) && value > 0) {
            seen.add(iteration);
            points.push({ iteration, resolution: value });
          }
        }
      } catch {
        /* skip unreadable file */
      }
    }

    points.sort((a, b) => a.iteration - b.iteration);
    const current = points.length > 0 ? points[points.length - 1].resolution : null;
    const best =
      points.length > 0 ? points.reduce((min, p) => Math.min(min, p.resolution), Infinity) : null;

    return NextResponse.json({
      jobId: id,
      points,
      current,
      best: Number.isFinite(best as number) ? best : null,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/resolution failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
