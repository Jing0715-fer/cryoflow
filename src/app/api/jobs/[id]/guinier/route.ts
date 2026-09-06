import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { parseGuinierEps } from "@/lib/relion/guinier-eps";
import { parseStar } from "@/lib/starfile";

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
 * Sources, best first:
 *  1. postprocess.star data_guinier  (RELION 5: exact 5-column numeric
 *     table — resolution², ln-amp original/weighted/sharpened/intercept)
 *  2. postprocess_guinier.eps        (RELION 5 plot-only fallback; lossy
 *     affine recovery via guinier-eps.ts)
 *  3. postprocess.guinier            (RELION ≤4 plain text table)
 *
 * The straight-line falloff validates the applied B-factor; curvature at
 * low resolution flags mask artefacts. The B-factor itself comes from
 * postprocess.star `data_general._rlnBfactorUsedForSharpening` when
 * present, else grepped from run.out ("apply b-factor of ...").
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
    let points: GuinierPoint[] = [];
    let sourceFile = "postprocess_guinier.eps";

    // ---- 1. postprocess.star data_guinier — the exact numeric table ----
    // RELION 5 stopped writing the plain `postprocess.guinier` file but
    // quietly kept the FULL table inside postprocess.star: 1/d², ln-amp of
    // the original (masked) map, the B-weighted curve, the sharpened curve
    // and the fitted intercept. Prefer it over the EPS pixel recovery.
    const ppStar = path.join(workdir, "postprocess.star");
    if (existsSync(ppStar)) {
      const fromStar = cachedFileCompute(ppStar, "guinier:pp-star-table", (text) => {
        const star = parseStar(text);
        const block = star.blocks.find((b) => b.name === "guinier" && b.loop);
        if (!block?.loop) return [] as GuinierPoint[];
        const cols = block.loop.columns;
        const iX = cols.indexOf("_rlnResolutionSquared");
        const iOrig = cols.indexOf("_rlnLogAmplitudesOriginal");
        const iSharp = cols.indexOf("_rlnLogAmplitudesSharpened");
        if (iX < 0 || iOrig < 0) return [] as GuinierPoint[];
        const pts: GuinierPoint[] = [];
        for (const row of block.loop.rows) {
          const x = parseFloat(row[iX]);
          const y1 = parseFloat(row[iOrig]);
          if (!Number.isFinite(x) || !Number.isFinite(y1)) continue;
          const y2 = iSharp >= 0 ? parseFloat(row[iSharp]) : NaN;
          pts.push({
            x,
            lnAmp: y1,
            lnAmpSharpened: Number.isFinite(y2) ? y2 : null,
          });
        }
        return pts;
      });
      if (fromStar && fromStar.length > 0) {
        points = fromStar;
        sourceFile = "postprocess.star";
      }
    }

    // ---- 2. EPS data recovery (plot-only installs) / 3. legacy table ----
    const epsFile = path.join(workdir, "postprocess_guinier.eps");
    const tableFile = path.join(workdir, "postprocess.guinier");
    if (points.length === 0 && existsSync(epsFile)) {
      points = cachedFileCompute(epsFile, "guinier:eps", (text) => parseGuinierEps(text) ?? []) ?? [];
    }
    if (points.length === 0 && existsSync(tableFile)) {
      points =
        cachedFileCompute(tableFile, "guinier:legacy-table", (text) => {
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

    // B-factor: exact value from postprocess.star data_general first
    // (_rlnBfactorUsedForSharpening), else the run.out log line — RELION ≤4
    // printed "Applied B-factor of -59.54 Å²", RELION 5 prints
    // "+ apply b-factor of: -804.776". Both forms matched (mtime-cached:
    // run.out grows per write, so the cache invalidates exactly when the
    // line could have changed).
    let bfactor: number | null = null;
    if (existsSync(ppStar)) {
      bfactor =
        cachedFileCompute(ppStar, "guinier:pp-star-bfactor", (text) => {
          const star = parseStar(text);
          const v = parseFloat(star.blocks.map((b) => b.pairs["_rlnBfactorUsedForSharpening"]).find((s) => s !== undefined) ?? "");
          return Number.isFinite(v) ? (v as number | null) : null;
        }) ?? null;
    }
    if (bfactor == null) {
      const logFile = path.join(workdir, "run.out");
      if (existsSync(logFile)) {
        bfactor = cachedFileCompute(logFile, "guinier:runout-bfactor", (text) => {
          const m =
            /Applied B-factor of\s+(-?\d+(?:\.\d+)?)/i.exec(text) ??
            /apply b-factor of:\s*(-?\d+(?:\.\d+)?)/i.exec(text);
          return m ? (parseFloat(m[1]) as number | null) : null;
        }) ?? null;
      }
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
