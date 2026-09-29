import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { readJobTombstone } from "@/lib/job-tombstone";
import { restoreJobRows, type RestoreJobInput } from "@/lib/job-restore";
import { ensureActiveProject } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/deleted/restore — the drawer's restore door (t478).
 *
 * The storage dialog's graveyard drawer and the agent's restore_deleted
 * verb are the SAME restore: both feed the grave's OWN row snapshot into
 * restoreJobRows (t477's core — workspace guard, scalar param filter,
 * running→idle coercion, tombstone re-apply). The body takes a job_id,
 * never a client-built job: the grave restores from its server-side
 * snapshot, so there is nothing for a stale or hostile client to get
 * wrong. Refusals mirror the roll call's why lines (no tombstone / no
 * row snapshot / id taken / workspace gone).
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { job_id?: unknown };
    const id = typeof body.job_id === "string" ? body.job_id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "job_id is required" }, { status: 400 });
    }
    const tomb = readJobTombstone(id);
    if (!tomb) {
      return NextResponse.json({ error: "No tombstone for this id" }, { status: 404 });
    }
    if (!tomb.row) {
      return NextResponse.json(
        { error: "This grave holds no row snapshot — restore it from the canvas's undo while the session remembers, or recreate it" },
        { status: 409 }
      );
    }
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const row = tomb.row;
    const input: RestoreJobInput = {
      id: tomb.id,
      type: row.type,
      name: row.name,
      x: row.x,
      y: row.y,
      params: row.params,
      workspaceId: row.workspaceId ?? undefined,
      note: row.note ?? undefined,
      status: row.status,
      progress: row.progress,
      result: row.result ?? undefined,
      startedAt: row.startedAt ?? undefined,
      duration: row.duration,
      linkedJobId: row.linkedJobId ?? undefined,
    };
    const outcome = await restoreJobRows([input], active.project.id);
    return NextResponse.json(outcome);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "restore failed" },
      { status: 500 }
    );
  }
}
