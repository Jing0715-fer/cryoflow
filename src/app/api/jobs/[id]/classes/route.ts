import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface ClassOccupancy {
  cls: number;
  count: number;
  /** share of total particles, 0–1 */
  fraction: number;
}

/** Column index of `label` inside the first data loop of a STAR text. */
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
 * GET /api/jobs/[id]/classes — final class occupancy of a 2D/3D
 * classification job, from the highest-iteration run_itXXX_data.star
 * (particle→class assignment). Percentages sum to 1.
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
      return NextResponse.json({ classes: [], total: 0, iteration: null });
    }

    // highest iteration data star = final particle→class assignment
    let best: { iteration: number; file: string } | null = null;
    for (const name of readdirSync(run.workdir)) {
      const m = name.match(/^run_it(\d+)_data\.star$/i);
      if (!m) continue;
      const iteration = Number(m[1]);
      if (!best || iteration > best.iteration) {
        best = { iteration, file: name };
      }
    }
    if (!best) {
      return NextResponse.json({ classes: [], total: 0, iteration: null });
    }

    const lines = readFileSync(path.join(run.workdir, best.file), "utf8").split("\n");
    const classCol = labelColumn(lines, "_rlnClassNumber");
    if (classCol < 0) {
      return NextResponse.json({ classes: [], total: 0, iteration: best.iteration });
    }

    const counts = new Map<number, number>();
    let total = 0;
    for (const raw of lines) {
      const t = raw.trim();
      if (!t || t.startsWith("#") || t.startsWith("_") || t === "loop_" || t.startsWith("data_")) continue;
      const cells = t.split(/\s+/);
      if (cells.length <= classCol) continue;
      const cls = parseInt(cells[classCol], 10);
      if (Number.isFinite(cls) && cls > 0) {
        counts.set(cls, (counts.get(cls) ?? 0) + 1);
        total++;
      }
    }

    const classes: ClassOccupancy[] = [...counts.entries()]
      .map(([cls, count]) => ({ cls, count, fraction: total > 0 ? count / total : 0 }))
      .sort((a, b) => a.cls - b.cls);

    return NextResponse.json({
      jobId: id,
      classes,
      total,
      iteration: best.iteration,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/classes failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
