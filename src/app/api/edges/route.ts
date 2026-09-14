import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveProject } from "@/lib/projects";
import {
  allAdjacency,
  edgesWithPorts,
  persistPortEdge,
  portsValid,
} from "@/lib/edge-ports";
import { findCycle } from "@/lib/graph-cycle";
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
 * Would adding from→to close a cycle? DFS over the union of DB + file
 * edges — now delegated to the SHARED detector (Task 180): the batch
 * doors (workflow-import, custom-template save/apply) run the same one
 * implementation, so the doors cannot drift. Node set must union in
 * `from`/`to` themselves — an isolated pair carries no adjacency entries
 * and would otherwise be silently skipped by the dangling-endpoint rule
 * (a false negative exactly when the new edge closes the loop).
 */
async function createsCycle(from: string, to: string): Promise<boolean> {
  const adj = await allAdjacency();
  const nodes = new Set(adj.keys());
  nodes.add(from);
  nodes.add(to);
  const pairs: { from: string; to: string }[] = [];
  for (const [f, ts] of adj) for (const t of ts) pairs.push({ from: f, to: t });
  pairs.push({ from, to });
  return findCycle([...nodes], pairs) !== null;
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
    // edges live inside one project — cross-project pairs would persist
    // under fromJob.projectId while the cycle guard + uniqueness checks run
    // across ALL projects (cross-project false positives and hidden edges)
    if (fromJob.projectId !== toJob.projectId) {
      return NextResponse.json(
        { error: "Cannot connect jobs from different projects" },
        { status: 400 }
      );
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
