import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface MotionMicrograph {
  /** basename of _rlnMicrographName (display) */
  name: string;
  /** _rlnMicrographName as stored — relative to the job workdir (file API) */
  relPath: string;
  /** total accumulated drift over the whole movie, Å */
  total: number;
  /** drift accumulated over the early frames (before the stage settles), Å */
  early: number;
  /** drift accumulated over the late frames, Å */
  late: number;
}

export interface MotionSummary {
  count: number;
  meanTotal: number;
  maxTotal: number;
  /** name of the worst-drifting micrograph (the first offender) */
  worstName: string | null;
  meanEarly: number;
  meanLate: number;
}

export interface MotionResponse {
  jobId: string;
  sourceFile: string | null;
  micrographs: MotionMicrograph[];
  summary: MotionSummary | null;
}

/**
 * GET /api/jobs/[id]/motion — per-micrograph accumulated motion of a
 * MotionCorr job.
 *
 * Source: corrected_micrographs.star — the job's own catalogue, where
 * MotionCorr/RELION record _rlnAccumulatedMotionTotal / Early / Late per
 * micrograph (Å). Early drift (first frames, before the stage settles)
 * and late drift (dose-weighting window) split the total into the two
 * halves a user actually triages: a movie with a big EARLY component
 * settles late; a big LATE component kept drifting to the end. Both are
 * reasons to drop the movie — the chart's job is to make the outliers
 * unmissable.
 *
 * Block-aware: the optics block shares the file and must not leak its
 * rows into the data loop (the ctf endpoint's freeze-on-first-row rule).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    const empty: MotionResponse = {
      jobId: id,
      sourceFile: null,
      micrographs: [],
      summary: null,
    };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }
    const starPath = path.join(run.workdir, "corrected_micrographs.star");
    if (!existsSync(starPath)) {
      return NextResponse.json(empty);
    }

    const micrographs =
      cachedFileCompute(starPath, "motion:catalogue", parseMotionStar) ?? [];

    if (micrographs.length === 0) {
      return NextResponse.json(empty);
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

    return NextResponse.json({
      jobId: id,
      sourceFile: "corrected_micrographs.star",
      micrographs,
      summary,
    } satisfies MotionResponse);
  } catch (error) {
    console.error("GET /api/jobs/[id]/motion failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Block-aware parse of corrected_micrographs.star's data loop. Columns
 *  freeze on the FIRST data row of the loop that owns the micrograph
 *  label — the optics block's rows can never leak in. */
function parseMotionStar(text: string): MotionMicrograph[] {
  const lines = text.split("\n");
  const rows: MotionMicrograph[] = [];

  let inLoop = false;
  let labels = new Map<string, number>();
  let cols: { name: number; total: number; early: number; late: number } | null = null;

  const freeze = (): { name: number; total: number; early: number; late: number } | null => {
    const idx = (needle: string) => {
      for (const [label, i] of labels) {
        if (label === needle) return i;
      }
      return -1;
    };
    const name = idx("_rlnMicrographName");
    const total = idx("_rlnAccumulatedMotionTotal");
    if (name < 0 || total < 0) return null;
    return {
      name,
      total,
      early: idx("_rlnAccumulatedMotionEarly"),
      late: idx("_rlnAccumulatedMotionLate"),
    };
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (t === "loop_") {
      inLoop = true;
      labels = new Map();
      cols = null;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      cols = null;
      continue;
    }
    if (t.startsWith("#") || t.startsWith(";")) continue;
    if (t.startsWith("_")) {
      if (inLoop) {
        const m = /^(\S+)/.exec(t);
        if (m) labels.set(m[1], labels.size);
      }
      continue;
    }
    if (!inLoop) continue;
    if (!cols) {
      cols = freeze();
      if (!cols) {
        // a loop without the micrograph/motion columns — skip its rows
        cols = { name: -1, total: -1, early: -1, late: -1 };
      }
    }
    if (cols.name < 0) continue;
    const cells = t.split(/\s+/);
    const nameCell = cells[cols.name] ?? "";
    const total = parseFloat(cells[cols.total] ?? "");
    if (!nameCell || !Number.isFinite(total)) continue;
    const early = cols.early >= 0 ? parseFloat(cells[cols.early] ?? "") : NaN;
    const late = cols.late >= 0 ? parseFloat(cells[cols.late] ?? "") : NaN;
    rows.push({
      name: nameCell.split("/").pop() ?? nameCell,
      relPath: nameCell,
      total,
      early: Number.isFinite(early) ? early : Math.max(0, total / 2),
      late: Number.isFinite(late) ? late : Math.max(0, total / 2),
    });
  }
  return rows;
}
