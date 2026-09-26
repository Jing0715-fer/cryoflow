import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import {
  CONTINUE_FAMILY_TYPES,
  continueSourcesFor,
} from "@/lib/relion/continue-sources";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[id]/continue-sources — the "Continue from here:" round
 * picker's data (t394):
 *
 *   { sources: [{ jobId, jobName, jobType, relation: "self"|"upstream",
 *                lane: "local"|"remote", workdir, connectionId?,
 *                entries: [{ iteration, name, path, size, complete,
 *                           missing[], newest, mtimeMs? }],
 *                truncated?, error? }] }
 *
 * The refine family only (class2d / class3d / refine3d / initialmodel /
 * multibody — the types whose RELION windows carry fn_cont). Every entry's
 * `path` lives in the coordinate system of the run that wrote the round:
 * a remote run speaks CLUSTER paths, a local run host paths. `complete` is
 * the engine's own --continue legality law (continueCompanions) — an
 * incomplete round is shown but disabled by the picker.
 *
 * Never a 500 (the usage-route dialect): cluster trouble answers 200 with
 * the per-source error so the picker degrades to an honest note.
 * ?refresh=1 bypasses the 12s TTL cache (the refresh affordance).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access to job data is not allowed" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!CONTINUE_FAMILY_TYPES.has(job.type)) {
      return NextResponse.json({
        sources: [],
        note: `${job.type} jobs have no "Continue from here:" — only the refine family (class2d, class3d, refine3d, initialmodel, multibody) carries fn_cont`,
      });
    }
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const sources = await continueSourcesFor(
      { id: job.id, name: job.name, type: job.type },
      { refresh }
    );
    return NextResponse.json({ sources }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/jobs/[id]/continue-sources failed:", error);
    return NextResponse.json(
      { sources: [], error: "Internal server error" },
      { status: 200 }
    );
  }
}
