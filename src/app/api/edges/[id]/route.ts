import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { deleteEdgeEverywhere } from "@/lib/edge-ports";
import { serverErrorReply } from "@/lib/server-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/edges/[id] — removes the edge from the DB and the port sidecar.
 *
 * t708 — the write door for uniformity: DELETE is spec-immune to drive-by
 * forms and no-cors fetches (and no route answers a CORS preflight), but
 * the write surface carries one policy — one door, every write handler.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site graph edits are not allowed" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const touched = await deleteEdgeEverywhere(id);
    if (!touched) {
      return NextResponse.json({ error: "Edge not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverErrorReply("DELETE /api/edges/[id]", error);
  }
}
