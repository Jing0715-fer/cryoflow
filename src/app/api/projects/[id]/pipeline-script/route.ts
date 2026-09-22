import { NextResponse } from "next/server";
import { buildPipelineScript } from "@/lib/relion/pipeline-script";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/pipeline-script — the whole workflow as ONE
 * dependency-ordered shell script (Task 179). The project-level sibling
 * of the per-job launch contract (/api/jobs/[id]/command, Task 170):
 *
 *   • steps in topological order — every command's inputs are produced
 *     by the steps above it (Kahn + createdAt tie-break, deterministic);
 *   • the same three honest tiers per step (native comment block / real
 *     argv via buildArgv / canonical template + reason when blocked);
 *   • replay semantics by status (done+idle live, run/wait/fail
 *     commented with the reason riding along);
 *   • `set -eu` — a replay stops at its first failed command.
 *
 * THE READ-ONLY CONTRACT (the command route's, project-wide): building
 * the script must never mkdir, spawn, or write state — an export that
 * litters disk is a leak with a download button. t179 pins this the way
 * t170 pinned the per-job route (comment-stripped code scan + dir-listing
 * identity across calls).
 */
export async function GET(request: Request, context: RouteContext) {
  // t259 — the metadata door: the script enumerates EVERY job's argv,
  // workdir and inputs — the single most complete map of the project's
  // computation (paths included). Same door pair as the read routes
  // (http-guard); this handler takes a bare `Request`, which is exactly
  // why the guard's parameter is the widest request shape.
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to the pipeline script is not allowed" },
      { status: 403 }
    );
  }
  try {
    const { id } = await context.params;
    const result = await buildPipelineScript(id);
    if (!result) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/projects/[id]/pipeline-script failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
