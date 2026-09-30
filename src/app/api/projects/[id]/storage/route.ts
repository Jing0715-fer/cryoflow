import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { computeStorageReport } from "@/lib/relion/storage-report";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/storage — t436: the project storage overview.
 *
 * t511 — the route is now the protocol shell only: the local gate, the
 * 404/500 wordings, and nothing else. The walk, the DB join and the
 * category ledger live in ONE well (lib/relion/storage-report's
 * computeStorageReport) — the Storage dialog drinks it through this
 * route, the agent's get_storage_report drinks it directly. Twins fork,
 * imports don't.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to storage data is not allowed" },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await computeStorageReport(id);
    if (!body) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/storage failed:", error);
    return NextResponse.json({ error: "Failed to compute storage" }, { status: 500 });
  }
}
