import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { getConnection, patchConnection } from "@/lib/remote/connections";
import { probeConnection } from "@/lib/remote/probe";

export const dynamic = "force-dynamic";

/**
 * POST /api/remote/connections/[id]/test — run the live SSH inventory probe
 * (login → uname → module system → relion modules → homes/mpi/ctffind →
 * slurm/gpus) and persist the result as `lastProbe` so the dialog's health
 * dot and the Run-on-cluster module picker have something honest to read.
 *
 * History: the dialog's Test button originally called THIS route while the
 * route itself did not exist — the save→test→probe loop was dead at 404
 * (Task 261's second finding). Rebuilt to the t261 contract:
 *   - gated like every remote route (the probe reveals the cluster's
 *     software inventory — same sensitivity class as the registry itself);
 *   - unknown id answers 404 route-speak (never a crash);
 *   - an unreachable cluster is NOT a 500 — the probe's own ok:false +
 *     first error line degrade honestly (the UI shows a rose dot);
 *   - lastProbe is persisted via patchConnection so the state survives
 *     the dialog (and the process).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const conn = getConnection(id);
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    const probe = await probeConnection(conn);
    // Persist regardless of ok — a failed probe is a fact worth remembering
    // (the dialog's rose dot and error line read exactly this record).
    patchConnection(id, { lastProbe: probe });
    return NextResponse.json({ ok: probe.ok, probe });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection probe failed" },
      { status: 500 }
    );
  }
}
