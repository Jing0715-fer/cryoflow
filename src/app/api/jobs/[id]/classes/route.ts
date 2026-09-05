import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readMrcHeader } from "@/lib/mrc";

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

/** Line index of the label definition inside its loop — data rows of THAT
 *  loop start after the loop's label run. Scoping the row scan to this
 *  region is what keeps the optics-group row ("1 optGroup1 300 …") from
 *  being counted as a particle with class parseInt("2.7") = 2. */
function labelLineIndex(lines: string[], label: string): number {
  let inLoop = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "loop_") {
      inLoop = true;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    if (t.startsWith(label)) return i;
  }
  return -1;
}

/**
 * GET /api/jobs/[id]/classes — class occupancy of a 2D/3D classification
 * job from the run_itXXX_data.star (particle→class assignment).
 * Default: highest iteration; ?iter=N selects a specific round.
 * Percentages sum to 1.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
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
    // explicit ?iter= overrides (round-filtered galleries)
    const wantIter = parseInt(new URL(request.url).searchParams.get("iter") ?? "", 10);
    if (Number.isFinite(wantIter)) {
      const exact = readdirSync(run.workdir).find(
        (name) => name.toLowerCase() === `run_it${String(wantIter).padStart(3, "0")}_data.star`
      );
      if (exact) best = { iteration: wantIter, file: exact };
    }
    if (!best) {
      return NextResponse.json({ classes: [], total: 0, iteration: null });
    }

    const lines = readFileSync(path.join(run.workdir, best.file), "utf8").split("\n");
    const classCol = labelColumn(lines, "_rlnClassNumber");

    // class-averages stack for the selection gallery: RELION 5 writes the
    // final unmasked stack, falling back to the newest per-iteration stack
    let classesFile: string | null = null;
    let classesSlices: number | null = null;
    const stackNames = readdirSync(run.workdir).filter(
      (n) => /^run_it\d+_classes\.mrcs?$/i.test(n) || /^run_unmasked_classes\.mrcs?$/i.test(n)
    );
    const unmasked = stackNames.find((n) => /^run_unmasked_classes\.mrcs?$/i.test(n));
    let stackName = unmasked ?? null;
    if (!stackName) {
      let bestIter = -1;
      for (const n of stackNames) {
        const m = n.match(/run_it(\d+)_classes/i);
        if (m && Number(m[1]) > bestIter) {
          bestIter = Number(m[1]);
          stackName = n;
        }
      }
    }
    if (stackName) {
      const stackAbs = path.join(run.workdir, stackName);
      const hdr = readMrcHeader(stackAbs);
      if (hdr) {
        classesFile = stackName;
        classesSlices = hdr.nz;
      }
    }

    if (classCol < 0) {
      return NextResponse.json({ classes: [], total: 0, iteration: best.iteration, classesFile, classesSlices });
    }

    const counts = new Map<number, number>();
    let total = 0;
    // count rows ONLY inside the loop that owns _rlnClassNumber — the
    // optics row above the particles loop must never inflate a class
    const headerEnd = labelLineIndex(lines, "_rlnClassNumber");
    for (let r = headerEnd + 1; r < lines.length; r++) {
      const t = lines[r].trim();
      if (t === "loop_" || t.startsWith("data_")) break; // loop region over
      if (!t || t.startsWith("#") || t.startsWith("_")) continue;
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
      // workdir-relative class-averages stack (.mrcs) — one slice per class,
      // renderable via /outputs/file?path=<classesFile>&format=png&slice=N-1
      classesFile,
      classesSlices,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/classes failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
