import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { toProjectDTO } from "@/lib/seed";
import { getProjectMeta, registerProject } from "@/lib/projects";
import { readFileEdges, upsertFileEdge } from "@/lib/edge-ports";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/duplicate — clone a project as a RERUN-READY
 * TEMPLATE (the β-Gal tutorial finished → "… copy" to screen again).
 *
 * The duplication contract, stated once:
 *  - CARRIES over: name (+" copy" suffix, numbered on collision, always
 *    ≤80 chars), every job's type/params/note/coordinates/duration, the
 *    workspace structure (names + sort order) and the FULL edge wiring —
 *    both the DB edge table AND the port-aware file sidecar (the wire
 *    truth is the MERGED view: a port-typed edge or a file-only edge
 *    (half1/half2 pairs the DB's unique shape can't hold twice) would be
 *    silently dropped otherwise — a cloned pipeline missing one of sixteen
 *    dependencies is a broken pipeline that looks complete).
 *  - RESETS: status → idle, progress → 0, startedAt/result → null. A clone
 *    that claimed "completed" would be claiming runs that never happened —
 *    the whole point of a duplicate is to run it again, fresh.
 *  - SEVERS: linkedJobId. Soft links are SAME-project mirror semantics
 *    (deleting the original cascades the link's meaning); a cross-project
 *    link is undefined behavior, so the clone's copies are independent.
 *  - META: the source's mode is copied (engine is always the real RELION
 *    one); the ACTIVE pointer stays on the source — duplicating must not
 *    teleport the user into the copy.
 *  - SOURCE: untouched, byte for byte. The "cannot delete the last
 *    project" guard does not apply here — duplication is additive.
 */
function buildCopyName(source: string, taken: Set<string>): string {
  const attempt = (suffix: string) => {
    const room = 80 - suffix.length;
    return source.slice(0, Math.max(1, room)).trimEnd() + suffix;
  };
  const first = attempt(" copy");
  if (!taken.has(first)) return first;
  let n = 2;
  let name = first;
  do {
    name = attempt(` copy ${n}`);
    n += 1;
  } while (taken.has(name));
  return name;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const source = await db.project.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const taken = new Set(
      (await db.project.findMany({ select: { name: true } })).map((p) => p.name)
    );
    const name = buildCopyName(source.name, taken);

    // snapshot BEFORE the transaction — the sidecar is a file write, it
    // cannot join the prisma tx; the copy happens after commit, with a
    // compensating delete so a sidecar failure can't strand a half clone
    const sourceFileEdges = readFileEdges().filter((e) => e.projectId === id);
    const sourceDbEdges = await db.edge.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    const sourceDbEdgeIds = new Set(sourceDbEdges.map((e) => e.id));

    const jobMap = new Map<string, string>();
    const edgeMap = new Map<string, string>(); // source DB edge id → clone DB edge id
    const result = await db.$transaction(async (tx) => {
      const project = await tx.project.create({ data: { name } });

      const workspaces = await tx.workspace.findMany({
        where: { projectId: id },
        orderBy: { order: "asc" },
      });
      const wsMap = new Map<string, string>();
      for (const w of workspaces) {
        const created = await tx.workspace.create({
          data: { projectId: project.id, name: w.name, order: w.order },
        });
        wsMap.set(w.id, created.id);
      }

      const jobs = await tx.job.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" },
      });
      for (const j of jobs) {
        const created = await tx.job.create({
          data: {
            projectId: project.id,
            workspaceId: j.workspaceId ? wsMap.get(j.workspaceId) ?? null : null,
            type: j.type,
            name: j.name,
            x: j.x,
            y: j.y,
            status: "idle",
            progress: 0,
            params: j.params,
            result: null,
            note: j.note,
            startedAt: null,
            duration: j.duration,
          },
        });
        jobMap.set(j.id, created.id);
      }

      const edges = await tx.edge.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" },
      });
      let edgeCount = 0;
      for (const e of edges) {
        const from = jobMap.get(e.fromJobId);
        const to = jobMap.get(e.toJobId);
        if (!from || !to) continue; // dangling defensively — both endpoints always exist in a consistent project
        // EXPLICIT fresh uuid — the merged wire view pairs sidecar rows to DB
        // rows BY ID, so the clone's sidecar annotations must be able to reuse
        // exactly this id (see below); the cuid default would break that pair
        const newId = randomUUID();
        edgeMap.set(e.id, newId);
        await tx.edge.create({
          data: {
            id: newId,
            projectId: project.id,
            fromJobId: from,
            toJobId: to,
          },
        });
        edgeCount += 1;
      }

      return {
        project,
        counts: {
          workspaces: workspaces.length,
          jobs: jobs.length,
          edges: edgeCount,
        },
      };
    });

    const cloneId = result.project.id;

    // port-aware sidecar edges ride the DB copy: remap endpoints, ports
    // verbatim (they are the wire's TYPED truth). An edge that ANNOTATES a
    // DB edge reuses the clone DB edge's id — the merged view pairs by id;
    // a FILE-ONLY edge (half1/half2 pairs the DB table's shape can't hold
    // twice) gets a fresh uuid. Copying every sidecar row under fresh ids
    // would leave the DB rows port-less and the merge to infer them.
    const writtenFileEdgeIds: string[] = [];
    try {
      for (const fe of sourceFileEdges) {
        const from = jobMap.get(fe.fromJobId);
        const to = jobMap.get(fe.toJobId);
        if (!from || !to) continue; // dangling defensively — same rule as the DB copy
        const pairedId = edgeMap.get(fe.id);
        upsertFileEdge({
          id: pairedId ?? randomUUID(),
          projectId: cloneId,
          fromJobId: from,
          toJobId: to,
          fromPort: fe.fromPort,
          toPort: fe.toPort,
          createdAt: new Date().toISOString(),
        });
        writtenFileEdgeIds.push(fe.id);
      }
    } catch (sidecarError) {
      // compensating action — no half clones: unwind the sidecar rows
      // written so far and delete the committed DB clone (jobs/edges
 // cascade); the source was never touched
      const { removeFileEdge } = await import("@/lib/edge-ports");
      for (const fe of readFileEdges().filter((e) => e.projectId === cloneId)) {
        try {
          removeFileEdge(fe.id);
        } catch {
          /* best effort unwind */
        }
      }
      await db
        .project.delete({ where: { id: cloneId } })
        .catch(() => null);
      console.error(
        "POST /api/projects/[id]/duplicate sidecar copy failed — clone unwound:",
        sidecarError
      );
      return NextResponse.json(
        { error: "Could not copy the port-wired edges — project not duplicated" },
        { status: 500 }
      );
    }

    const meta = getProjectMeta(id);
    const mode = meta?.mode ?? "spa";
    registerProject(cloneId, { mode, engine: "relion" }, false);

    return NextResponse.json(
      {
        ok: true,
        project: toProjectDTO(result.project, mode, "relion"),
        counts: {
          workspaces: result.counts.workspaces,
          jobs: result.counts.jobs,
          // the WIRE truth: every DB edge not superseded by a sidecar row +
          // every sidecar row (13 annotations reuse their DB edge's id, 1
          // file-only edge adds itself — 16, matching GET /api/edges)
          edges:
            result.counts.edges +
            sourceFileEdges.filter((fe) => !sourceDbEdgeIds.has(fe.id)).length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/duplicate failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
