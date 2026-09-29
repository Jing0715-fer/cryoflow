import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { graveRowsOf } from "@/lib/job-tombstone";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/deleted — the graveyard's roll call for the UI (t478).
 *
 * t477 gave the agent list_deleted and restore_deleted; the STORAGE dialog
 * had no door to the same truth. This route reads graveRowsOf — the SAME
 * brain the agent's list_deleted reads — so the drawer's "restorable" badge
 * and the agent's spoken line can never disagree about a grave. Rows carry
 * shapes only (name/type/deletedAt/run summary/edges count/restorable/why):
 * the row snapshot itself stays server-side, and the restore door
 * (POST /api/jobs/deleted/restore) takes a job_id, never a client-built
 * body — the grave restores from its OWN snapshot, nothing to trust.
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  try {
    const graves = await graveRowsOf();
    return NextResponse.json({ ok: true, graves });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "graveyard roll call failed" },
      { status: 500 }
    );
  }
}
