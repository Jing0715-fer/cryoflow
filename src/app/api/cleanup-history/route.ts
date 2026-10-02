import { NextRequest, NextResponse } from "next/server";
import { readCleanupHistory, CLEANUP_HISTORY_MAX } from "@/lib/relion/cleanup-history";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

// t522 — the ledger's browser face. The lib owns everything (the cap, the
// shape, the atomic writes — cleanup-history.ts); this shell keeps only
// the door laws: the same-origin guard (t251) and the newest-first slice
// the dialog's Recent-cleanups strip renders. The agent's get_cleanup_
// history tool drinks the SAME well — one ledger, three faces.
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to the cleanup ledger is not allowed" },
      { status: 403 }
    );
  }
  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, CLEANUP_HISTORY_MAX) : undefined;
    return NextResponse.json({ entries: readCleanupHistory(limit) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
