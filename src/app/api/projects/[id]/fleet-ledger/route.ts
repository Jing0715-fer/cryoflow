import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { computeFleetLedger } from "@/lib/remote/fleet-ledger";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/fleet-ledger — t1053: the per-connection disk
 * budget (docs/remote-relion.md §7's last standing stretch item).
 *
 *   ?measure=1 — run the live cluster probes (sequential, budgeted) and
 *                rewrite the sidecar; otherwise serve the sidecar's last
 *                measurement with fresh mirror bytes.
 *
 * The response: one band per connection — the cluster side ("N bytes
 * across M workdirs, measured at T"), the mirror side ("N bytes here,
 * against a 2.0 GB sync ceiling"), and the per-job rows heaviest first.
 * A project with no remote runs answers `connections: []` — the honest
 * empty (the section dissolves; the economy law keeps the dialog quiet).
 * Cross-site access is refused like every storage-adjacent route; 404
 * wordings follow the storage route's shell.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to fleet ledger data is not allowed" },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const measure = request.nextUrl.searchParams.get("measure") === "1";
    const body = await computeFleetLedger(id, { measure });
    if (!body) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/fleet-ledger failed:", error);
    return NextResponse.json({ error: "Failed to compute the fleet ledger" }, { status: 500 });
  }
}
