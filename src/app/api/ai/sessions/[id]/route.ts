import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { deleteSessionForActiveProject, sessionForActiveProject } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/ai/sessions/[id] — t423: fetch ONE past session for the panel's
 * history switch. Same pinning law as the iteration path: a session from
 * another project answers 404, never its transcript.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    const result = await sessionForActiveProject(id);
    if (!result.session) {
      return NextResponse.json({ error: result.error ?? "Session not found." }, { status: 404 });
    }
    return NextResponse.json({ session: result.session });
  } catch (error) {
    console.error("GET /api/ai/sessions/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/ai/sessions/[id] — t423: remove one session from the store.
 * The drawer keeps its own two-click confirm; the route only refuses what
 * the pinning law refuses.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    const result = await deleteSessionForActiveProject(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Session not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/ai/sessions/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
