import { NextRequest, NextResponse } from "next/server";
import { detectRelion } from "@/lib/relion/system";

export const dynamic = "force-dynamic";

/**
 * GET /api/system — RELION 5 environment status (incl. WSL probe).
 * `?force=1` bypasses the 60s in-module cache (used by the Re-detect button).
 */
export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const status = await detectRelion(force);
    return NextResponse.json(status);
  } catch (error) {
    console.error("GET /api/system failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
