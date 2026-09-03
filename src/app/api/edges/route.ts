import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveProject } from "@/lib/projects";
import {
  allAdjacency,
  edgesWithPorts,
  persistPortEdge,
  portsValid,
} from "@/lib/edge-ports";
import { defaultPorts } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** GET /api/edges — all port-aware edges of the active project. */
export async function GET() {
  try {
    const active = await getActiveProject();
    if (!active) {
      return NextResponse.json({ edges: [] });
    }
    const edges = await edgesWithPorts(active.project.id);
    return NextResponse.json({ edges });
  } catch (error) {
    console.error("GET /api/edges failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Would adding from→to close a cycle? DFS over the union of DB + file edges.
 */
async function createsCycle(from: string, to: string): Promise<boolean> {
  const adj = await allAdjacency();
  const visited = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const node = stack.pop() as string;
    if (node === from) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of adj.get(node) ?? []) stack.push(next);
  }
  return false;
}

/**
 * POST /api/edges — body: { fromJobId, toJobId, fromPort?, toPort? }.
 * Ports are validated against the job-type port specs; when omitted the
 * first compatible pair is chosen automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      fromJobId?: unknown;
      toJobId?: unknown;
      fromPort?: unknown;
      toPort?: unknown;
    };

    const fromJobId = typeof body.fromJobId === "string" ? body.fromJobId : "";
    const toJobId = typeof body.toJobId === "string" ? body.toJobId : "";
    const fromPort = typeof body.fromPort === "string" ? body.fromPort : undefined;
    const toPort = typeof body.toPort === "string" ? body.toPort : undefined;
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

    const ports =
      fromPort && toPort
        ? { fromPort, toPort }
        : defaultPorts(fromJob.type, toJob.type);

    if (!portsValid(fromJob.type, ports.fromPort, toJob.type, ports.toPort)) {
      return NextResponse.json(
        {
          error: `Port mismatch: ${fromJob.type}:${ports.fromPort ?? "?"} cannot feed ${toJob.type}:${ports.toPort ?? "?"}`,
        },
        { status: 400 }
      );
    }

    // duplicate (same pair + same ports) check over the file layer
    const existing = await edgesWithPorts(fromJob.projectId);
    if (
      existing.some(
        (e) =>
          e.fromJobId === fromJobId &&
          e.toJobId === toJobId &&
          e.fromPort === ports.fromPort &&
          e.toPort === ports.toPort
      )
    ) {
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

    const id = crypto.randomUUID();
    await persistPortEdge({
      id,
      projectId: fromJob.projectId,
      fromJobId,
      toJobId,
      fromPort: ports.fromPort,
      toPort: ports.toPort,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        edge: {
          id,
          fromJobId,
          toJobId,
          fromPort: ports.fromPort,
          toPort: ports.toPort,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/edges failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
