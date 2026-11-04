import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";
import { getActiveProject } from "@/lib/projects";
import {
  allAdjacency,
  edgesWithPorts,
  persistPortEdge,
  portsValid,
} from "@/lib/edge-ports";
import { serverErrorReply } from "@/lib/server-error";
import { findCycle } from "@/lib/graph-cycle";
import { defaultPorts } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/**
 * t1179 — the wire edition of the jobs route's t393 token, one law
 * stricter: the hash input is the EXACT string this route travels (the
 * body is serialized once and returned verbatim — the hashed string IS
 * the traveled string), and the version rides the x-edges-version
 * header like an ETag. A client that sends its last-seen token as ?v=
 * gets a ~40-byte {unchanged:true} when the wire world has not moved.
 * The hash mixes the project id, so a project switch can never alias
 * another project's token.
 */
function edgesVersionOf(projectId: string, body: string): string {
  // two independent djb2-family lanes + the length + the project tail
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < body.length; i++) {
    const c = body.charCodeAt(i);
    h1 = (h1 * 33 + c) | 0;
    h2 = (h2 * 31 + c) | 0;
  }
  return `${h1.toString(36)}.${h2.toString(36)}.${body.length}.${projectId.slice(-6)}`;
}

/** GET /api/edges — all port-aware edges of the active project. */
export async function GET(request: Request) {
  // t710 — the read-half door lands (the t709 deferral's mass Origin shim
  // covered the lane first; census: scripts/t710-collection-touchers.py).
  // Doctrine in http-guard.ts.
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site edge reads are not allowed" }, { status: 403 });
  }
  try {
    const active = await getActiveProject();
    if (!active) {
      return NextResponse.json({ edges: [] });
    }
    const edges = await edgesWithPorts(active.project.id);
    // t1179 — serialized once; the hashed string IS the traveled string
    const body = JSON.stringify({ edges });
    const version = edgesVersionOf(active.project.id, body);
    const seen = new URL(request.url).searchParams.get("v");
    if (seen && seen === edgesVersionOf(active.project.id, body)) {
      return NextResponse.json({ unchanged: true, version });
    }
    return new NextResponse(body, {
      headers: {
        "content-type": "application/json",
        "x-edges-version": version,
      },
    });
  } catch (error) {
    return serverErrorReply("GET /api/edges", error);
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
 * POST /api/edges — body: { fromJobId, toJobId, fromPort?, toPort?, id? }.
 * Ports are validated against the job-type port specs; when omitted the
 * first compatible pair is chosen automatically. The optional `id` (t359)
 * lets an optimistic client pin the row to the wire it already drew —
 * UUID-shaped, collision-checked, otherwise minted here.
 */
export async function POST(request: NextRequest) {
  // t708 — the write door: an edge IS the dispatch plan (resolveInputs walks
  // these wires), so a blind wire from a no-cors JSON body would silently
  // re-route real pipelines (doctrine http-guard.ts + t252 Phase B2).
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site graph edits are not allowed" }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      fromJobId?: unknown;
      toJobId?: unknown;
      fromPort?: unknown;
      toPort?: unknown;
    };

    const fromJobId = typeof body.fromJobId === "string" ? body.fromJobId : "";
    const toJobId = typeof body.toJobId === "string" ? body.toJobId : "";
    const fromPort = typeof body.fromPort === "string" ? body.fromPort : undefined;
    const toPort = typeof body.toPort === "string" ? body.toPort : undefined;
    // t359 — optimistic wires: the client mints the edge id so the wire it
    // already drew keeps pointing at the row this POST creates (a delete
    // racing the creation hits the right id, no reconciliation swap).
    // UUID-shape-checked — anything else (legacy callers, garbage) is
    // ignored and minted here exactly as before.
    const clientId =
      typeof body.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
        ? body.id
        : null;
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

    // a client id colliding with a LIVE row (replayed request, buggy
    // caller) must never overwrite the survivor — upsertFileEdge keys by
    // id; mint fresh instead, the response carries the truth and the
    // optimistic caller swaps its wire onto it
    const id =
      clientId && !existing.some((e) => e.id === clientId)
        ? clientId
        : crypto.randomUUID();
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
    return serverErrorReply("POST /api/edges", error);
  }
}
