import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { parseGuinierEps } from "@/lib/relion/guinier-eps";

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
 * RELION 5 ships the plot ONLY as PostScript (postprocess_guinier.eps);
 * RELION ≤4 also wrote the plain `postprocess.guinier` numeric table
 * (`1/resol²  ln(Amp)  [ln(Amp·B)]`). Both encodings are parsed — the EPS
 * data recovery lives in guinier-eps.ts. The classic straight-line falloff
 * validates the applied B-factor; curvature at low resolution flags mask
 * artefacts. The B-factor itself is grepped from run.out ("Applied
 * B-factor of ...") when available.
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

    // RELION 5 writes the Guinier plot ONLY as PostScript
    // (postprocess_guinier.eps) — the plain `postprocess.guinier` table
    // stopped existing in 5.0. Parse the EPS (data is embedded as absolute
    // lineto polylines over a calibratable grid); fall back to the old text
    // table for older installs. Both paths ride the mtime cache — polled
    // charts cost one statSync between writes (see statcache.ts).
    const epsFile = path.join(workdir, "postprocess_guinier.eps");
    const tableFile = path.join(workdir, "postprocess.guinier");
    let points: GuinierPoint[] = [];
    let sourceFile = "postprocess_guinier.eps";
    if (existsSync(epsFile)) {
      points = cachedFileCompute(epsFile, (text) => parseGuinierEps(text) ?? []) ?? [];
    }
    if (points.length === 0 && existsSync(tableFile)) {
      points =
        cachedFileCompute(tableFile, (text) => {
          const pts: GuinierPoint[] = [];
          for (const raw of text.split(/\r?\n/)) {
            const t = raw.trim();
            if (!t || t.startsWith("#")) continue;
            const cells = t.split(/\s+/).map((c) => parseFloat(c));
            if (cells.length < 2) continue;
            const [x, y1, y2] = cells;
            if (!Number.isFinite(x) || !Number.isFinite(y1)) continue;
            pts.push({
              x,
              lnAmp: y1,
              lnAmpSharpened: Number.isFinite(y2) ? y2 : null,
            });
          }
          return pts;
        }) ?? [];
      sourceFile = "postprocess.guinier";
    }
    if (points.length === 0) {
      return NextResponse.json(empty);
    }

    // B-factor from run.out — RELION ≤4 printed "Applied B-factor of
    // -59.54 Å²", RELION 5 prints "+ apply b-factor of: -804.776". Both
    // forms matched (mtime-cached: run.out grows per write, so the cache
    // invalidates exactly when the line could have changed).
    let bfactor: number | null = null;
    const logFile = path.join(workdir, "run.out");
    if (existsSync(logFile)) {
      bfactor = cachedFileCompute(logFile, (text) => {
        const m =
          /Applied B-factor of\s+(-?\d+(?:\.\d+)?)/i.exec(text) ??
          /apply b-factor of:\s*(-?\d+(?:\.\d+)?)/i.exec(text);
        return m ? (parseFloat(m[1]) as number | null) : null;
      }) ?? null;
    }

    const body: GuinierResponse = {
      jobId: id,
      sourceFile,
      points,
      bfactor,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/jobs/[id]/guinier failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
