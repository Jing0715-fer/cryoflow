import { NextRequest, NextResponse } from "next/server";
import { getLogTail } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/log — tail of the real engine's run.out/run.err
 * (sim jobs have no log → 404).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const tail = getLogTail(id);
    if (tail === null) {
      return NextResponse.json({ error: "No log (sim job)" }, { status: 404 });
    }
    return NextResponse.json({ jobId: id, tail });
  } catch (error) {
    console.error("GET /api/jobs/[id]/log failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
