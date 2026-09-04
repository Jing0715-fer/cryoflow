import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveProject } from "@/lib/seed";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/workspaces/[id] — body: { name } (rename, 1–60 chars).
 * Only workspaces of the ACTIVE project can be touched.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 60) {
      return NextResponse.json({ error: "Workspace name must be 1–60 characters" }, { status: 400 });
    }
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const existing = await db.workspace.findUnique({ where: { id } });
    if (!existing || existing.projectId !== active.project.id) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const workspace = await db.workspace.update({ where: { id }, data: { name } });
    return NextResponse.json({
      workspace: {
        id: workspace.id,
        projectId: workspace.projectId,
        name: workspace.name,
        order: workspace.order,
        createdAt: workspace.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/workspaces/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/workspaces/[id] — removes an EMPTY-able workspace:
 * its jobs (including links) are MOVED to the project's default (first)
 * workspace first, so nothing is ever lost. The default workspace itself
 * cannot be deleted — a project always keeps at least one canvas.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const existing = await db.workspace.findUnique({ where: { id } });
    if (!existing || existing.projectId !== active.project.id) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const first = await db.workspace.findFirst({
      where: { projectId: active.project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    if (!first) {
      return NextResponse.json({ error: "No fallback workspace" }, { status: 500 });
    }
    if (first.id === id) {
      return NextResponse.json(
        { error: "This is the project's default workspace — it cannot be deleted" },
        { status: 400 }
      );
    }
    const moved = await db.job.updateMany({
      where: { workspaceId: id },
      data: { workspaceId: first.id },
    });
    await db.workspace.delete({ where: { id } });
    return NextResponse.json({ ok: true, movedCount: moved.count, fallback: first.name });
  } catch (error) {
    console.error("DELETE /api/workspaces/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
