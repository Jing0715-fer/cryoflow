import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectDTO } from "@/lib/seed";
import { getProjectMeta, removeProjectMeta } from "@/lib/projects";
import { readFileEdges, removeFileEdge } from "@/lib/edge-ports";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/projects/[id] — body: { name } (1–80 chars) → rename.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { name?: unknown };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json(
        { error: "Project name must be 1–80 characters" },
        { status: 400 }
      );
    }

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = await db.project.update({
      where: { id },
      data: { name },
    });
    const meta = getProjectMeta(id);
    return NextResponse.json({
      ok: true,
      project: toProjectDTO(project, meta?.mode ?? "spa", meta?.engine ?? "sim"),
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id] — removes the project, its jobs and edges, the
 * edge-port sidecar entries and the projects.json meta. The last remaining
 * project cannot be deleted (400). When the active project is deleted, the
 * active pointer is fixed by removeProjectMeta (first remaining or null).
 * NOTE: RELION run records in data/engine-state.json are intentionally left
 * untouched (main agent owns the engine state lifecycle).
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const total = await db.project.count();
    if (total <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last project — create another one first" },
        { status: 400 }
      );
    }

    // 1. Purge port-aware sidecar edges for this project (DB rows cascade,
    //    the file sidecar does not).
    for (const fileEdge of readFileEdges().filter((e) => e.projectId === id)) {
      removeFileEdge(fileEdge.id);
    }

    // 2. Explicit deletes (defensive — the FK cascades exist, but this works
    //    regardless of cascade configuration).
    await db.edge.deleteMany({ where: { projectId: id } });
    await db.job.deleteMany({ where: { projectId: id } });
    await db.project.delete({ where: { id } });

    // 3. Meta + active pointer.
    await removeProjectMeta(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
