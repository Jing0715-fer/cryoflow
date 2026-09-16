import { NextRequest, NextResponse } from "next/server";
import { detectRelion } from "@/lib/relion/system";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/system — RELION 5 environment status (incl. WSL probe).
 * `?force=1` bypasses the 60s in-module cache (used by the Re-detect button).
 *
 * t259 — the metadata door (the last t251 ledger line). This route speaks
 * APPLICATION environment (binary paths, WSL probe results) — not host file
 * bytes — so a drive-by read is low-value; the doors that matter are the
 * DNS-rebinding READ (a rebound page passes the origin check) and the
 * `?force=1` probe trigger (a cross-site no-cors GET can fire a fresh
 * WSL/subprocess probe blind). isLocalRequest closes both: Fetch Metadata
 * slams the cross-site door, Host pinning catches the rebound one.
 * Same-origin UI calls always pass — the app's own fetches carry
 * `sec-fetch-site: same-origin` by construction.
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to system status is not allowed" },
      { status: 403 }
    );
  }
  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const status = await detectRelion(force);
    return NextResponse.json(status);
  } catch (error) {
    console.error("GET /api/system failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
