import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { db } from "@/lib/db";
import { toProjectDTO } from "@/lib/seed";
import { getProjectMeta, removeProjectMeta, setProjectRemote } from "@/lib/projects";
import { readFileEdges, removeFileEdge } from "@/lib/edge-ports";
import { RELION_DIR } from "@/lib/paths";
import {
  clearRunRecord,
  isRunAlive,
  normalizeClusterHost,
  readRuns,
  stopRun,
} from "@/lib/relion/engine";
import { getConnection, loadConnections } from "@/lib/remote/connections";
import { exec, shSingleQuote } from "@/lib/remote/ssh";
import {
  collectMirrorTargets,
  localReclaimRootFor,
  mirrorDirFor,
} from "@/lib/remote/reclaim-targets";
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
 * edge-port sidecar entries, the projects.json meta AND — t417 — the file
 * planes the dialog's promise covers: the local workdir root
 * <RELION_DIR>/<projectId> and every cluster mirror <remoteRoot>/<projectId>
 * the run records (or the project's bound connection) can NAME. The last
 * remaining project cannot be deleted (400). When the active project is
 * deleted, the active pointer is fixed by removeProjectMeta (first
 * remaining or null).
 *
 * t272: every run record dies with its project too — db.job.deleteMany
 * bypasses the single-job DELETE route (whose clearRunRecord keeps the
 * "records only live while their job does" invariant), so the project
 * sweep performs the same ceremony per job or the résumé would count
 * jobs that no canvas can open ever again.
 *
 * t417 — why the file purge lives HERE and not in the single-job route:
 * that route keeps the workdir ON PURPOSE (POST /api/jobs/restore
 * re-attaches it — a tombstone, not a landfill); project deletion has no
 * restore route, and its dialog says "cannot be undone", so files that
 * outlive the delete are not preserved work, they are orphans (witnessed:
 * 21 cluster husks + ~35 local ones, 1.4GB, from earlier deletes). The
 * mirror targets are read from the run records BEFORE clearRunRecord
 * erases their remote state, plus the project's bound connection as the
 * records-are-all-dead fallback; a mirror we cannot NAME (connection
 * deleted AND records gone) is left behind and said so — the t325
 * same-host re-creation still rescues the records-alive case. A cluster
 * that cannot answer is NOT a failed delete (the t327 honesty contract):
 * the response's `reclaimed` block reports exactly which planes died and
 * which are orphaned on a silent host.
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

    // 0.55 t417 — collect the mirror targets BEFORE 0.5 erases the records:
    // rec.remote is the only witness of WHICH cluster root this project's
    // data was mirrored to (connectionId + host + the expanded remoteRoot
    // staging actually used). The bound connection is the fallback witness
    // for projects whose records are already gone (every job individually
    // deleted first). The judgment lives in reclaim-targets.ts (unit-tested
    // — scripts/t417-unit-reclaim.ts): the guard refuses traversal, dedup
    // collapses repeat witnesses, and a tilde root the route has not yet
    // expanded is SKIPPED, never guessed.
    const recordWitnesses = Object.values(readRuns()).filter(
      (r) => r.projectId === id
    );
    const metaBefore = getProjectMeta(id);
    const boundId = metaBefore?.remote?.connectionId ?? null;
    const bound = boundId ? getConnection(boundId) : null;
    let boundTarget: {
      id: string;
      host: string;
      port: number;
      remoteRoot: string;
    } | null = null;
    if (bound?.remoteRoot) {
      let root = bound.remoteRoot;
      if (root.startsWith("~")) {
        // same expansion shape as the engine's expandCsRemoteRoot — one
        // round-trip, best-effort: a silent host just skips this witness.
        const home = await exec(bound, "echo $HOME", { timeoutMs: 10_000 });
        const h = (home.stdout ?? "").trim().split(/\r?\n/)[0] ?? "";
        if (h && root.startsWith("~/")) root = h + root.slice(1);
        else if (h && root === "~") root = h;
      }
      if (!root.startsWith("~")) {
        boundTarget = {
          id: bound.id,
          host: bound.host,
          port: bound.port,
          remoteRoot: root,
        };
      }
    }
    const mirrorTargets = collectMirrorTargets(
      id,
      recordWitnesses,
      boundTarget
    );

    // 0.6 t417 — reclaim the file planes the dialog promised. Local first
    // (synchronous, root guarded to exactly one safe path segment under
    // RELION_DIR), then the cluster mirrors over SSH (non-fatal — each one
    // reports its own verdict). A failed rm here is REPORTED, never
    // swallowed: the response is the ledger of what actually happened.
    let localReclaimed: string | null = null;
    let localError: string | undefined;
    const localRoot = localReclaimRootFor(id, RELION_DIR);
    if (localRoot && fs.existsSync(localRoot)) {
      try {
        fs.rmSync(localRoot, { recursive: true, force: true });
        localReclaimed = localRoot;
      } catch (e) {
        localError = e instanceof Error ? e.message : String(e);
      }
    }
    const clusterMirror: Array<{
      host: string;
      path: string;
      ok: boolean;
      error?: string;
    }> = [];
    for (const t of mirrorTargets) {
      // resolve: the recorded connection first, then a same-host
      // re-creation (t325 — cleanup follows the wire, not the id).
      let conn = t.connectionId ? getConnection(t.connectionId) : null;
      if (!conn) {
        const wanted = normalizeClusterHost(t.host);
        conn =
          loadConnections().find(
            (c) =>
              normalizeClusterHost(`${c.host}:${c.port}`) === wanted
          ) ?? null;
      }
      const mirrorDir = mirrorDirFor(t, id);
      if (!conn) {
        clusterMirror.push({
          host: t.host,
          path: mirrorDir,
          ok: false,
          error: "connection not found — mirror left in place",
        });
        continue;
      }
      const r = await exec(conn, `rm -rf -- ${shSingleQuote(mirrorDir)}`, {
        timeoutMs: 30_000,
      });
      clusterMirror.push({
        host: conn.host,
        path: mirrorDir,
        ok: r.code === 0,
        ...(r.code === 0 ? {} : { error: r.error ?? `exit ${r.code}` }),
      });
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

    return NextResponse.json({
      ok: true,
      stoppedLiveRuns: stopped,
      reclaimed: {
        local: localReclaimed,
        ...(localError ? { localError } : {}),
        cluster: clusterMirror,
      },
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
