import { NextRequest, NextResponse } from "next/server";
import { deleteEdgeEverywhere } from "@/lib/edge-ports";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/edges/[id] — removes the edge from the DB and the port sidecar. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const touched = await deleteEdgeEverywhere(id);
    if (!touched) {
      return NextResponse.json({ error: "Edge not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/edges/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
