import { NextResponse } from "next/server";
import { detectRelion } from "@/lib/relion/system";

export const dynamic = "force-dynamic";

/** GET /api/system — RELION 5 environment status (incl. WSL probe). */
export async function GET() {
  try {
    const status = await detectRelion();
    return NextResponse.json(status);
  } catch (error) {
    console.error("GET /api/system failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
