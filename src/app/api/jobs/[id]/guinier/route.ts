import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface GuinierPoint {
  /** 1/d² in Å⁻² (RELION's x column) */
  x: number;
  /** ln(amplitude) of the masked map */
  lnAmp: number | null;
  /** ln(amplitude) after B-factor sharpening, when RELION writes it */
  lnAmpSharpened: number | null;
}

export interface GuinierResponse {
  jobId: string;
  sourceFile: string | null;
  points: GuinierPoint[];
  /** applied B-factor (Å²) parsed from the postprocess log, when present */
  bfactor: number | null;
}

/**
 * GET /api/jobs/[id]/guinier — Guinier plot of a PostProcess job.
 *
 * RELION writes postprocess.guinier as a plain numeric table (not a STAR
 * loop): `1/resol²  ln(Amp)  [ln(Amp·B)]` with # comment headers. The
 * classic straight-line falloff validates the applied B-factor; curvature
 * at low resolution flags mask artefacts. The B-factor itself is grepped
* from run.out ("Applied B-factor of ...") when available.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    const empty: GuinierResponse = { jobId: id, sourceFile: null, points: [], bfactor: null };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }
    const workdir = run.workdir;

    const guinierFile = path.join(workdir, "postprocess.guinier");
    if (!existsSync(guinierFile)) {
      return NextResponse.json(empty);
    }

    const points: GuinierPoint[] = [];
    for (const raw of readFileSync(guinierFile, "utf8").split(/\r?\n/)) {
      const t = raw.trim();
      if (!t || t.startsWith("#")) continue;
      const cells = t.split(/\s+/).map((c) => parseFloat(c));
      if (cells.length < 2) continue;
      const [x, y1, y2] = cells;
      if (!Number.isFinite(x) || !Number.isFinite(y1)) continue;
      points.push({
        x,
        lnAmp: y1,
        lnAmpSharpened: Number.isFinite(y2) ? y2 : null,
      });
    }
    if (points.length === 0) {
      return NextResponse.json(empty);
    }

    // B-factor: RELION prints "Applied B-factor of -59.54 Å²" in run.out
    let bfactor: number | null = null;
    const logFile = path.join(workdir, "run.out");
    if (existsSync(logFile)) {
      const text = readFileSync(logFile, "utf8");
      const m = text.match(/Applied B-factor of\s+(-?\d+(?:\.\d+)?)/i);
      if (m) bfactor = parseFloat(m[1]);
    }

    const body: GuinierResponse = {
      jobId: id,
      sourceFile: "postprocess.guinier",
      points,
      bfactor,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/jobs/[id]/guinier failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
