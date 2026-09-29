import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { ensureActiveProject } from "@/lib/seed";
import { restoreJobRows, type RestoreJobInput } from "@/lib/job-restore";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/restore — undo support for job deletion.
 *
 * Deletion removes only the DB row (the engine workdir is keyed by job id —
 * `workdirFor` derives `RELION_ROOT/projectId/{type}_{id.slice(-8)}` — and is
 * never swept), so restoring under the ORIGINAL id re-attaches every output,
 * log and engine record as if the delete never happened. A new-id restore
 * would strand all of that on disk; same-id is what makes undo honest.
 *
 * t477 — the row-level restore logic (workspace guard, scalar param filter,
 * running→idle coercion, link checks, tombstone re-apply) lives in
 * lib/job-restore.ts so the agent's restore_deleted verb and this route run
 * the SAME core — a restore the agent runs and a restore the toast runs can
 * never drift. This handler is the door: guard + body shape + the project.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { jobs?: unknown };
    const list = Array.isArray(body.jobs) ? (body.jobs as RestoreJobInput[]) : [];
    if (list.length === 0 || list.length > 500) {
      return NextResponse.json(
        { error: "Body must be { jobs: [...] } with 1–500 entries" },
        { status: 400 }
      );
    }

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }

    const outcome = await restoreJobRows(list, active.project.id);
    return NextResponse.json(outcome);
  } catch (error) {
    console.error("POST /api/jobs/restore failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
