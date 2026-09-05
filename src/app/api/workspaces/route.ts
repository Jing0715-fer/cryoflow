import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveProject } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces — workspaces of the ACTIVE project (ordered), each
 * with per-workspace job stats + link count, so the sidebar panel can show
 * live mini-badges. The first workspace (lowest order) is the project's
 * default: new jobs land there and deleted workspaces' jobs fall back to it.
 */
export async function GET() {
  try {
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ workspaces: [] });
    }
    const workspaces = await db.workspace.findMany({
      where: { projectId: active.project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    const jobs = await db.job.findMany({
      where: { projectId: active.project.id },
      select: { workspaceId: true, status: true, linkedJobId: true },
    });
    const byWorkspace = new Map<
      string,
      { total: number; running: number; pending: number; completed: number; failed: number; links: number }
    >();
    for (const j of jobs) {
      const key = j.workspaceId ?? "";
      const s =
        byWorkspace.get(key) ?? { total: 0, running: 0, pending: 0, completed: 0, failed: 0, links: 0 };
      s.total++;
      if (j.linkedJobId) s.links++;
      if (j.status === "running") s.running++;
      else if (j.status === "pending") s.pending++;
      else if (j.status === "completed") s.completed++;
      else if (j.status === "failed") s.failed++;
      byWorkspace.set(key, s);
    }
    return NextResponse.json({
      workspaces: workspaces.map((w) => {
        const s =
          byWorkspace.get(w.id) ?? { total: 0, running: 0, pending: 0, completed: 0, failed: 0, links: 0 };
        return {
          id: w.id,
          projectId: w.projectId,
          name: w.name,
          order: w.order,
          createdAt: w.createdAt.toISOString(),
          stats: s,
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/workspaces failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/workspaces — body: { name } → new workspace in the ACTIVE
 * project, appended after the last one.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 60) {
      return NextResponse.json({ error: "Workspace name must be 1–60 characters" }, { status: 400 });
    }
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const last = await db.workspace.findFirst({
      where: { projectId: active.project.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const workspace = await db.workspace.create({
      data: { projectId: active.project.id, name, order: (last?.order ?? 0) + 1 },
    });
    return NextResponse.json(
      {
        workspace: {
          id: workspace.id,
          projectId: workspace.projectId,
          name: workspace.name,
          order: workspace.order,
          createdAt: workspace.createdAt.toISOString(),
          stats: { total: 0, running: 0, pending: 0, completed: 0, failed: 0, links: 0 },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/workspaces failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
