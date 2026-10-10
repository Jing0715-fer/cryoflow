import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { buryGraves, graveRowsOf } from "@/lib/job-tombstone";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/deleted — the graveyard's roll call for the UI (t478).
 *
 * t477 gave the agent list_deleted and restore_deleted; the STORAGE dialog
 * had no door to the same truth. This route reads graveRowsOf — the SAME
 * brain the agent's list_deleted reads — so the drawer's "restorable" badge
 * and the agent's spoken line can never disagree about a grave. Rows carry
 * shapes only (name/type/deletedAt/run summary/edges count/restorable/why,
 * plus t479's bytes — what the grave's surviving workdir still weighs):
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

/**
 * DELETE /api/jobs/deleted — the bulk burial (t479, the drawer's Clear
 * door; the records dialog's bulk-forget law ported to the graveyard:
 * a write door behind the same-origin guard, scoped by what can come
 * back). The route takes NO body and NO grave list — the server reads
 * the graveyard itself and buries what the spare law allows, so a stale
 * or hostile client has nothing to aim at:
 *
 *   without `?all=1`  restorable graves are SPARED — only spent ones
 *                     (row-less, or already-restored ids) are buried;
 *                     the response names the spared so no face can
 *                     pretend a restorable grave died
 *   with `?all=1`     everything is buried — the UI only sends this as
 *                     the armed second step over graves that are all
 *                     restorable ("they can never come back")
 *
 * A buried grave's workdir dies ONLY when its id is free (a restored job
 * lives in that directory — buryGraves never burns a living home; the
 * response's keptWorkdirs counts the homes it refused to touch).
 */
export async function DELETE(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  const includeRestorable = request.nextUrl.searchParams.get("all") === "1";
  try {
    const out = await buryGraves({ includeRestorable });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bulk burial failed" },
      { status: 500 }
    );
  }
}
