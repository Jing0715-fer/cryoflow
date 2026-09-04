import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface AngDistResponse {
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

const ROT_BINS = 24;
const TILT_BINS = 12;

/**
 * GET /api/jobs/[id]/angdist — particle orientation distribution
 * (rot φ 0–360° × tilt θ 0–180°) of the latest refine/classify data star,
 * binned server-side into a polar 24×12 heatmap grid.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    const empty: AngDistResponse = {
      jobId: id,
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
    };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }

    // prefer the highest-iteration run_itXXX_data.star; fall back to final
    // run_data.star (completed refine3d) — both carry the angular assignment
    let best: { iteration: number | null; file: string } | null = null;
    for (const name of readdirSync(run.workdir)) {
      if (/^run_data\.star$/i.test(name)) {
        if (!best || best.iteration === null) best = { iteration: null, file: name };
        continue;
      }
      const m = name.match(/^run_it(\d+)_data\.star$/i);
      if (!m) continue;
      const iteration = Number(m[1]);
      if (!best || best.iteration === null || iteration > (best.iteration ?? 0)) {
        best = { iteration, file: name };
      }
    }
    if (!best) {
      return NextResponse.json(empty);
    }

    const lines = readFileSync(path.join(run.workdir, best.file), "utf8").split("\n");
    const rotCol = labelColumn(lines, "_rlnAngleRot");
    const tiltCol = labelColumn(lines, "_rlnAngleTilt");
    if (rotCol < 0 || tiltCol < 0) {
      return NextResponse.json({ ...empty, starFile: best.file, iteration: best.iteration });
    }

    const cells = new Array<number>(ROT_BINS * TILT_BINS).fill(0);
    let total = 0;
    let max = 0;
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
    }

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

    const body: AngDistResponse = {
      jobId: id,
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
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/jobs/[id]/angdist failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
