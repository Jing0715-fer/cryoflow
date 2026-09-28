import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import {
  deleteSessionForActiveProject,
  renameSessionForActiveProject,
  sessionForActiveProject,
} from "@/lib/ai/agent";
import { sessionFileName, sessionToMarkdown } from "@/lib/ai/export";
import { toolCallsUsed } from "@/lib/ai/sessions";
import { getActiveProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/ai/sessions/[id] — t423: fetch ONE past session for the panel's
 * history switch. Same pinning law as the iteration path: a session from
 * another project answers 404, never its transcript.
 *
 * t428 — `?format=md` renders the SAME pinned session as a downloadable
 * Markdown transcript (the drawer's export button). The file speaks the
 * archival shape a report or ELN can absorb: display-name heading, meta
 * line, one section per message, tool calls/results as quotes. Served as
 * an attachment so a browser save never navigates the SPA away.
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

    const url = new URL(request.url);
    if (url.searchParams.get("format") !== "md") {
      return NextResponse.json({ session: result.session });
    }

    const active = await getActiveProject();
    const md = sessionToMarkdown(
      result.session,
      active?.project.name ?? "(unknown project)",
      toolCallsUsed(result.session)
    );
    return new NextResponse(md, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${sessionFileName(result.session)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/ai/sessions/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/ai/sessions/[id] — t428: the drawer's rename door.
 * Body { title } — trimmed to ≤80 chars; empty/whitespace clears the
 * rename (the row falls back to its first-user-message preview). A rename
 * deliberately does NOT bump updatedAt: the newest-first drawer must stay
 * chronological, renames are bookmarks not activity.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    let body: { title?: unknown };
    try {
      body = (await request.json()) as { title?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (typeof body.title !== "string") {
      return NextResponse.json({ error: "title must be a string." }, { status: 400 });
    }
    const result = await renameSessionForActiveProject(id, body.title);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Session not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, title: result.title });
  } catch (error) {
    console.error("PATCH /api/ai/sessions/[id] failed:", error);
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
