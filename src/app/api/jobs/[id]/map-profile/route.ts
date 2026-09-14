import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readPathrefTarget } from "@/lib/relion/pathref";
import { resolveInsideJobWorkdir } from "@/lib/relion/jobfile";
import { isLocalRequest } from "@/lib/http-guard";
import { cachedCompute } from "@/lib/relion/statcache";
import { isMrcPath, poolProfile, readMrcAxisProfiles, readMrcHeader } from "@/lib/mrc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface MapProfileResponse {
  jobId: string;
  axis: "x" | "y" | "z";
  /** pooled mean-density landscape (≤160 bins, position 0…1 maps to bin index) */
  bins: number[];
  /** min/max of the returned bins — the sparkline's normalize anchors */
  stats: { min: number; max: number };
  /** native (pre-pool) profile entries */
  native: number;
  /** planes visited + voxels sampled — the bounded scan's receipt */
  planes: number;
  samples: number;
}

/**
 * GET /api/jobs/[id]/map-profile?path=<rel>&axis=x|y|z
 *
 * The density landscape along a slice axis: mean density per plane,
 * pooled to ≤160 bins. The Mol* viewer's cross-section row renders it
 * as a sparkline under the position slider — a playhead tracks the
 * plane, clicking the landscape jumps the plane there (t189).
 *
 * Safety: the SAME containment chain as outputs/file — local-request
 * guard, workdir lexical scoping + realpath, engine-written .pathref
 * markers followed. The scan is plane-wise + strided (never a whole-file
 * read — the 1.4 GB OOM lesson) and statcache-cached, so polls between
 * map writes are a statSync.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access to job outputs is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }
    const url = new URL(request.url);
    const rel = url.searchParams.get("path") ?? "";
    const axisParam = (url.searchParams.get("axis") ?? "z").toLowerCase();
    if (axisParam !== "x" && axisParam !== "y" && axisParam !== "z") {
      return NextResponse.json({ error: "axis must be x, y or z" }, { status: 400 });
    }

    const resolved = resolveInsideJobWorkdir(run.workdir, rel);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    let { abs } = resolved;
    // pathref markers: engine-written only; maps live in workdirs so this
    // is defensive — a marker's content is not an MRC and fails the header
    // check below with an honest 400.
    if (resolved.name.endsWith(".pathref")) {
      const target = readPathrefTarget(abs);
      if (!target) {
        return NextResponse.json({ error: "Broken path reference (source moved or deleted)" }, { status: 404 });
      }
      abs = target;
    }
    if (!isMrcPath(path.basename(abs))) {
      return NextResponse.json({ error: "Not a map file" }, { status: 400 });
    }
    const header = readMrcHeader(abs);
    if (!header) {
      return NextResponse.json({ error: "Not a readable MRC volume" }, { status: 400 });
    }

    const profiles = cachedCompute(abs, "map-profile:v1", () => readMrcAxisProfiles(abs, header));
    if (!profiles) {
      return NextResponse.json({ error: "Map scan failed" }, { status: 500 });
    }
    const native = profiles[axisParam];
    const bins = poolProfile(native);
    let min = Infinity;
    let max = -Infinity;
    for (const b of bins) {
      if (b < min) min = b;
      if (b > max) max = b;
    }
    const body: MapProfileResponse = {
      jobId: id,
      axis: axisParam,
      bins,
      stats: { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 },
      native: native.length,
      planes: profiles.planes,
      samples: profiles.samples,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/jobs/[id]/map-profile failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
