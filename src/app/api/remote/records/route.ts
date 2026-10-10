import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { db } from "@/lib/db";
import { readRuns, clearRunRecord } from "@/lib/relion/engine";
import { getConnection } from "@/lib/remote/connections";
import { connectionRunResume } from "@/lib/remote/remote-run";

export const dynamic = "force-dynamic";

/**
 * GET /api/remote/records?connectionId=… — the résumé's PANORAMA (t295).
 *
 * The list route (GET /api/remote/connections) attaches every connection's
 * résumé at the ≤3 aperture: the reading line under the summary. A
 * connection with MANY runs has no door to its older history — total says
 * "17 runs", the rows stop at three, and history past the fold is invisible
 * and unmanageable.
 *
 * This route is the wide aperture: the SAME aggregate (connectionRunResume)
 * asked for ALL entries under the same shape — the reading line and the
 * panorama are one truth at two zoom levels, never two ledgers. Entries
 * arrive with the t272 existence grades (exists / projectName) already
 * resolved, so the card renders the full history with the same three
 * honest states it uses under the fold.
 *
 * Refusals: 400 without a connectionId (the panorama is always ONE
 * connection's history, never the global pile), 404 for an unknown
 * connection (a panorama of nothing is a lie).
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  const connectionId = request.nextUrl.searchParams.get("connectionId");
  if (!connectionId) {
    return NextResponse.json(
      { error: "connectionId is required — a panorama is one connection's history" },
      { status: 400 }
    );
  }
  if (!getConnection(connectionId)) {
    return NextResponse.json({ error: "Unknown connection" }, { status: 404 });
  }
  const resume = await connectionRunResume(connectionId, { all: true });
  return NextResponse.json({ ok: true, connectionId, resume });
}

/**
 * DELETE /api/remote/records?connectionId=… — the bulk forget (t295):
 * ONE click retires every DEAD entry of one connection ("一键清墓").
 *
 * The single door (DELETE /api/remote/records/[jobId], t294) already
 * speaks the law per row; this is the same law at collection scale, and it
 * is deliberately NARROWER, not wider — it can only ever touch records
 * whose job is GONE everywhere:
 *   - live records (the job still exists on some canvas) are KEPT, never
 *     deleted: live history belongs to the canvas that can open it, and
 *     the t272 sweep takes it when the canvas goes. The response counts
 *     them honestly (kept).
 *   - the existence check runs for ALL candidates BEFORE the first
 *     clearRunRecord — t294's order law ("refusal precedes deletion")
 *     holds at bulk scale: one findMany draws the line, then the dead
 *     records die.
 * The connection filter makes the "not a remote record" refusal moot here
 * (only records wearing this connectionId are candidates).
 *
 * Refusals: 400 without a connectionId, 404 for an unknown connection.
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const connectionId = request.nextUrl.searchParams.get("connectionId");
    if (!connectionId) {
      return NextResponse.json(
        { error: "connectionId is required — the bulk door forgets one connection's dead history" },
        { status: 400 }
      );
    }
    if (!getConnection(connectionId)) {
      return NextResponse.json({ error: "Unknown connection" }, { status: 404 });
    }
    const runs = readRuns();
    const candidateIds = Object.values(runs)
      .filter((rec) => rec.remote?.connectionId === connectionId)
      .map((rec) => rec.jobId);
    // ORDER LAW: existence is settled for the whole batch BEFORE anything
    // dies — one findMany draws the alive/dead line, then the dead sweep.
    const aliveRows = candidateIds.length
      ? await db.job.findMany({ where: { id: { in: candidateIds } }, select: { id: true } })
      : [];
    const alive = new Set(aliveRows.map((r) => r.id));
    let forgotten = 0;
    let kept = 0;
    for (const id of candidateIds) {
      if (alive.has(id)) {
        kept += 1;
        continue;
      }
      clearRunRecord(id);
      forgotten += 1;
    }
    return NextResponse.json({ ok: true, connectionId, forgotten, kept });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bulk forget failed" },
      { status: 500 }
    );
  }
}
