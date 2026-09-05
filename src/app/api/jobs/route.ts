import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { db } from "@/lib/db";
import { ensureActiveProject, toJobDTO } from "@/lib/seed";
import { defaultParams, jobType } from "@/lib/workflow";
import { readRuns, reconcileRealJobs } from "@/lib/relion/engine";
import { autoStartPendingDownstream } from "@/lib/relion/dispatch";
import type { JobDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Last-known statuses (module scope) for the GET transition sweep: a job
 * flipping TO completed between polls fires the pending-downstream
 * auto-start — the catch-all trigger for completions the engine's exit
 * handler and startJob's native branch couldn't announce (server restart,
 * WSL relay timing, a completed-before-poll race). Pruned each poll, so
 * deleted jobs don't accumulate.
 */
const prevStatuses = new Map<string, string>();

/**
 * Project a LINKED job onto its ORIGINAL: status/progress/result/startedAt
 * mirror the original (links are read-only aliases, never run themselves).
 * Multi-hop chains are collapsed (links always point at originals, but stay
 * defensive). Called after reconcile so the original is already up to date.
 */
function projectLinks(jobs: JobDTO[], workspaces: Map<string, string>): void {
  // index originals by id for O(1) mirror lookups
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const linkCount = new Map<string, number>();
  for (const job of jobs) {
    if (!job.linkedJobId) continue;
    const root = byId.get(job.linkedJobId) ?? null;
    // mirror the root's run state (root may be null: cross-project / deleted
    // — cascading delete makes that rare; keep the link inert)
    if (root) {
      job.status = root.status;
      job.progress = root.progress;
      job.result = root.result;
      job.startedAt = root.startedAt;
      job.engine = root.engine;
      job.hasLog = root.hasLog;
      job.linkedName = root.name;
      job.linkedWorkspaceName =
        (root.workspaceId ? workspaces.get(root.workspaceId) : undefined) ?? "Main";
      linkCount.set(root.id, (linkCount.get(root.id) ?? 0) + 1);
    }
  }
  for (const [id, count] of linkCount) {
    const orig = byId.get(id);
    if (orig) orig.linkCount = count;
  }
}

/** GET /api/jobs — jobs of the ACTIVE project, reconciled against the REAL RELION engine records. */
export async function GET() {
  try {
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ jobs: [] });
    }
    const jobs = await db.job.findMany({
      where: { projectId: active.project.id },
      orderBy: { createdAt: "asc" },
    });
    const workspaces = await db.workspace.findMany({
      where: { projectId: active.project.id },
      select: { id: true, name: true },
    });
    const workspaceNames = new Map(workspaces.map((w) => [w.id, w.name]));

    const final = await reconcileRealJobs(jobs); // REAL engine (the only engine)

    // ---- transition sweep: completed → auto-start pending downstream -----
    // Fire-and-forget (never blocks the response); autoStartPendingDownstream
    // is idempotent (in-flight + liveness guards) so double triggers with the
    // engine's exit handler are free. On a fresh server the map is empty —
    // every completed job counts as "newly completed", which conveniently
    // recovers pending jobs orphaned by a restart.
    {
      let pendingCount = 0;
      const completedNow: string[] = [];
      const next = new Map<string, string>();
      for (const j of final) {
        if (j.status === "pending") pendingCount += 1;
        if (j.status === "completed" && prevStatuses.get(j.id) !== "completed") {
          completedNow.push(j.id);
        }
        next.set(j.id, j.status);
      }
      prevStatuses.clear();
      for (const [k, v] of next) prevStatuses.set(k, v);
      if (completedNow.length > 0 && pendingCount > 0) {
        for (const id of completedNow) {
          void autoStartPendingDownstream(id);
        }
      }
    }

    const runs = readRuns();
    const jobsOut = final.map((j) => {
      const dto = toJobDTO(j);
      const state = runs[j.id];
      dto.engine = "relion";
      dto.hasLog = state ? existsSync(state.logFile) : false;
      return dto;
    });
    projectLinks(jobsOut, workspaceNames);
    return NextResponse.json({ jobs: jobsOut });
  } catch (error) {
    console.error("GET /api/jobs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/jobs — body: { type, x?, y?, params?, name?, workspaceId?, linkedJobId? }
 * → created in the ACTIVE project.
 * - `params` (plain object) + `name` enable job duplication.
 * - `workspaceId` places the job in a specific workspace (validated against
 *   the project; defaults to its first workspace).
 * - `linkedJobId` creates a SOFT LINK (copy-to-workspace): the new job
 *   mirrors the original and downstream jobs consume the original's outputs.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: unknown;
      x?: unknown;
      y?: unknown;
      params?: unknown;
      name?: unknown;
      workspaceId?: unknown;
      linkedJobId?: unknown;
    };

    const type = typeof body.type === "string" ? body.type : "";
    const spec = jobType(type);
    if (!spec) {
      return NextResponse.json({ error: `Unknown job type: ${type}` }, { status: 400 });
    }

    // optional explicit params (duplication) — must be a plain object of
    // SCALARS restricted to the type's schema keys (the PATCH route applies
    // the same filter; accepting arbitrary keys here used to let the
    // `interpreter` engine param leak through — an arbitrary-binary
    // execution vector for external job types)
    let customParams: Record<string, number | string | boolean> | null = null;
    if (body.params && typeof body.params === "object" && !Array.isArray(body.params)) {
      const allowed = new Set((spec.params ?? []).map((p) => p.key));
      if (type === "import") allowed.add("empiarData"); // engine flag, set by the EMPIAR seed
      const incoming = body.params as Record<string, unknown>;
      const filtered: Record<string, number | string | boolean> = {};
      for (const [key, value] of Object.entries(incoming)) {
        if (
          allowed.has(key) &&
          (typeof value === "number" || typeof value === "string" || typeof value === "boolean")
        ) {
          filtered[key] = value;
        }
      }
      customParams = Object.keys(filtered).length > 0 ? filtered : null;
    }
    const customName =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 120)
        : null;

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }

    // ---- workspace resolution (validated against the ACTIVE project) ----
    const projectWorkspaces = await db.workspace.findMany({
      where: { projectId: active.project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    if (projectWorkspaces.length === 0) {
      return NextResponse.json({ error: "No workspace available" }, { status: 500 });
    }
    let workspaceId = projectWorkspaces[0].id;
    if (typeof body.workspaceId === "string" && body.workspaceId) {
      const target = projectWorkspaces.find((w) => w.id === body.workspaceId);
      if (!target) {
        return NextResponse.json({ error: "Workspace not found in this project" }, { status: 400 });
      }
      workspaceId = target.id;
    }

    // ---- soft link mode: copy-as-link into this workspace ---------------
    if (typeof body.linkedJobId === "string" && body.linkedJobId) {
      const original = await db.job.findUnique({ where: { id: body.linkedJobId } });
      if (!original || original.projectId !== active.project.id) {
        return NextResponse.json(
          { error: "Linked job not found in this project" },
          { status: 400 }
        );
      }
      // collapse chains: a link of a link points at the ROOT original
      const rootLinkedId = original.linkedJobId ?? original.id;
      const root =
        original.linkedJobId != null
          ? ((await db.job.findUnique({ where: { id: rootLinkedId } })) ?? original)
          : original;
      const x =
        typeof body.x === "number" && Number.isFinite(body.x)
          ? body.x
          : 140 + Math.random() * 60;
      const y =
        typeof body.y === "number" && Number.isFinite(body.y)
          ? body.y
          : 200 + Math.random() * 60;
      const link = await db.job.create({
        data: {
          projectId: active.project.id,
          workspaceId,
          linkedJobId: root.id,
          type: root.type,
          name: customName ?? `${root.name} ⧉`,
          x,
          y,
          // links mirror the original's CURRENT state (GET re-projects every
          // poll anyway; storing it keeps non-GET readers honest)
          status: root.status,
          progress: root.progress,
          params: root.params,
          result: root.result,
          startedAt: root.startedAt,
          duration: root.duration,
        },
      });
      const dto = toJobDTO(link);
      dto.engine = "relion";
      // the POST response feeds an optimistic store update — include the
      // projection fields GET computes so the UI banner shows the original's
      // name immediately (a poll may never fire when nothing is running)
      const wsNames = new Map(projectWorkspaces.map((w) => [w.id, w.name]));
      dto.linkedName = root.name;
      dto.linkedWorkspaceName =
        (root.workspaceId ? wsNames.get(root.workspaceId) : undefined) ?? null;
      dto.linkCount =
        (await db.job.count({ where: { linkedJobId: root.id } })) + 1;
      return NextResponse.json({ job: dto }, { status: 201 });
    }

    const count = await db.job.count({
      where: { projectId: active.project.id, type },
    });

    const x =
      typeof body.x === "number" && Number.isFinite(body.x)
        ? body.x
        : 140 + Math.random() * 60;
    const y =
      typeof body.y === "number" && Number.isFinite(body.y)
        ? body.y
        : 200 + Math.random() * 60;

    const job = await db.job.create({
      data: {
        projectId: active.project.id,
        workspaceId,
        type,
        name: customName ?? `${spec.label} ${count + 1}`,
        x,
        y,
        params: customParams ? JSON.stringify(customParams) : JSON.stringify(defaultParams(type)),
        duration: spec.duration,
      },
    });

    const dto = toJobDTO(job);
    dto.engine = "relion";
    return NextResponse.json({ job: dto }, { status: 201 });
  } catch (error) {
    console.error("POST /api/jobs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
