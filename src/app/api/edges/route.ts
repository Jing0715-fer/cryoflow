import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject, toEdgeDTO } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** GET /api/edges — all edges of the demo project. */
export async function GET() {
  try {
    const project = await ensureProject();
    const edges = await db.edge.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ edges: edges.map(toEdgeDTO) });
  } catch (error) {
    console.error("GET /api/edges failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Would adding from→to close a cycle?
 * DFS from `to` following outgoing edges: if `from` is reachable, refuse.
 */
async function createsCycle(from: string, to: string): Promise<boolean> {
  const visited = new Set<string>();

  async function dfs(node: string): Promise<boolean> {
    if (node === from) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    const outgoing = await db.edge.findMany({
      where: { fromJobId: node },
      select: { toJobId: true },
    });
    for (const edge of outgoing) {
      if (await dfs(edge.toJobId)) return true;
    }
    return false;
  }

  return dfs(to);
}

/** POST /api/edges — body: { fromJobId, toJobId }. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      fromJobId?: unknown;
      toJobId?: unknown;
    };

    const fromJobId = typeof body.fromJobId === "string" ? body.fromJobId : "";
    const toJobId = typeof body.toJobId === "string" ? body.toJobId : "";
    if (!fromJobId || !toJobId) {
      return NextResponse.json(
        { error: "fromJobId and toJobId are required" },
        { status: 400 }
      );
    }
    if (fromJobId === toJobId) {
      return NextResponse.json(
        { error: "Cannot connect a job to itself" },
        { status: 400 }
      );
    }

    const [fromJob, toJob] = await Promise.all([
      db.job.findUnique({ where: { id: fromJobId } }),
      db.job.findUnique({ where: { id: toJobId } }),
    ]);
    if (!fromJob || !toJob) {
      return NextResponse.json({ error: "Both jobs must exist" }, { status: 400 });
    }

    const duplicate = await db.edge.findUnique({
      where: { fromJobId_toJobId: { fromJobId, toJobId } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "This connection already exists" },
        { status: 409 }
      );
    }

    if (await createsCycle(fromJobId, toJobId)) {
      return NextResponse.json(
        { error: "Would create a cycle" },
        { status: 400 }
      );
    }

    const edge = await db.edge.create({
      data: { projectId: fromJob.projectId, fromJobId, toJobId },
    });

    return NextResponse.json({ edge: toEdgeDTO(edge) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/edges failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
