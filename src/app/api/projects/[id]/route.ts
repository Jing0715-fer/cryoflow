import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectDTO } from "@/lib/seed";
import { getProjectMeta, removeProjectMeta, setProjectRemote } from "@/lib/projects";
import { readFileEdges, removeFileEdge } from "@/lib/edge-ports";
import { clearRunRecord, isRunAlive, stopRun } from "@/lib/relion/engine";
import { getConnection } from "@/lib/remote/connections";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/projects/[id] — body: { name } (1–80 chars) → rename, and/or
 * { remoteConnectionId } (t300) → bind the project to a saved cluster
 * (string id) or unbind it back to local (null). A binding change is a
 * data-location move in intent: paths already picked on the old cluster
 * stay valid only there, so the honest answer for a re-bind is a NEW
 * project — the door exists for the early mistake (created local, meant
 * remote) and for unbinding after the data moved.
 *
 * DELETE /api/projects/[id] — stop its live runs, remove edges, delete.
 *
 * t259 — the metadata door: both handlers are blind STATE CHANGES
 * (rename — a `.catch`-tolerant JSON parse a cross-site no-cors fetch
 * can drive; delete — a cascading teardown of runs, edges and rows). The
 * t252 ledger class stops form-borne CSRF, not fetch-borne; a rebound
 * page passes the origin check entirely. isLocalRequest closes both.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site writes to projects are not allowed" },
      { status: 403 }
    );
  }
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      /** t300 — "" | null | absent = no change is NOT true for null: null
       * UNBINDS. Absent = leave the binding alone (rename-only PATCH). */
      remoteConnectionId?: unknown;
    };

    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ---- t300 — the binding leg (absent = untouched) --------------------
    let remoteTouched = false;
    if ("remoteConnectionId" in body) {
      const raw = body.remoteConnectionId;
      const bindId =
        raw === null || raw === ""
          ? null
          : typeof raw === "string" && raw.trim()
            ? raw.trim()
            : undefined;
      if (bindId === undefined) {
        return NextResponse.json(
          { error: "remoteConnectionId must be a saved connection id, or null to unbind" },
          { status: 400 }
        );
      }
      if (bindId && !getConnection(bindId)) {
        return NextResponse.json(
          { error: "remoteConnectionId does not match a saved cluster connection — add or re-save it in Remote clusters first" },
          { status: 400 }
        );
      }
      if (!setProjectRemote(id, bindId)) {
        return NextResponse.json(
          { error: "Project has no meta entry yet — open it once, then rebind" },
          { status: 409 }
        );
      }
      remoteTouched = true;
    }

    // ---- the rename leg (absent = untouched) ----------------------------
    let project = existing;
    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 1 || name.length > 80) {
        return NextResponse.json(
          { error: "Project name must be 1–80 characters" },
          { status: 400 }
        );
      }
      project = await db.project.update({
        where: { id },
        data: { name },
      });
    }

    const meta = getProjectMeta(id);
    return NextResponse.json({
      ok: true,
      project: toProjectDTO(project, meta?.mode ?? "spa", "relion"),
      ...(remoteTouched ? { rebound: true } : {}),
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
 * t272: every run record dies with its project too — db.job.deleteMany
 * bypasses the single-job DELETE route (whose clearRunRecord keeps the
 * "records only live while their job does" invariant), so the project
 * sweep performs the same ceremony per job or the résumé would count
 * jobs that no canvas can open ever again.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site project deletion is not allowed" },
      { status: 403 }
    );
  }
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

    // 0. STOP any live process trees before purging — otherwise deleting a
    //    project with a running refine leaves an untracked mpirun/wsl tree
    //    writing into a deleted workdir, and a later re-run stacks a second
    //    tree on the same outputs (the orphan bug fixed for single-job DELETE
    //    in jobs/[id]/route.ts — the same protection belongs here).
    const projectJobs = await db.job.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    let stopped = 0;
    for (const { id: jobId } of projectJobs) {
      if (isRunAlive(jobId)) {
        await stopRun(jobId);
        stopped += 1;
      }
    }

    // 0.5 t272 — the record lifecycle is the job's, at project granularity
    // too. The single-job DELETE route runs clearRunRecord on every exit
    // path; this route's db.job.deleteMany used to bypass it, leaving orphan
    // records in the GLOBAL engine-state.json — a cluster's résumé would
    // count and render entries no canvas could ever open again.
    for (const { id: jobId } of projectJobs) clearRunRecord(jobId);

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

    return NextResponse.json({ ok: true, stoppedLiveRuns: stopped });
  } catch (error) {
    console.error("DELETE /api/projects/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
