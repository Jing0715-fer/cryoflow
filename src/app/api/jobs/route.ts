import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { db } from "@/lib/db";
import { ensureActiveProject, ensureDefaultWorkspace, toJobDTO, toEdgeDTO } from "@/lib/seed";
import { defaultParams, jobType } from "@/lib/workflow";
import { readRuns, reconcileRealJobs } from "@/lib/relion/engine";
import { autoStartPendingDownstream } from "@/lib/relion/dispatch";
import { reconcileRemoteJobs, remoteInfoFor } from "@/lib/remote/remote-run";
import type { JobDTO, EdgeDTO } from "@/lib/types";

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
 * t324 — the pending RETRY cadence: "runs automatically once ready" is a
 * promise, and the one-shot triggers (the finalize leg, the engine's exit
 * handler, startJob's native branch) can miss a consumer — an SSH blip at
 * the exact moment the upstream landed, a pre-t324 record whose cluster
 * twins only the lazy heal can recover, a sync that brought a file home
 * after the first attempt already flipped the row to pending. Every ~20s
 * (while any pending job exists) each pending consumer re-attempts through
 * its COMPLETED upstreams; startJob's busy/liveness guards and the
 * stampede cap make repeat rounds free — a job whose inputs are still
 * incomplete just flips back to pending with a refreshed message.
 */
let lastPendingRetryAt = 0;
const PENDING_RETRY_MS = 20_000;

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
      job.runRemote = root.runRemote;
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

    // REAL engine (the only engine). Local records first, then the remote
    // sweep (SSH-cluster records — reconcileRealJobs deliberately skips
    // them: their pids are cluster-side, and polling happens over SSH in
    // one batched round trip per connection).
    const localFinal = await reconcileRealJobs(jobs);
    // t346 — the GET never WAITS on a slow sweep: on a lagging login node
    // the sweep's SSH round trip can take tens of seconds (the t345 field
    // ticket proved a plain `cat` can outlive 15s), and awaiting it made
    // this route — and with it the whole UI's 4s cadence — feel stuck.
    // The sweep still RUNS (in-flight guard, one per connection); its
    // verdicts, progress and log tails simply land on the NEXT tick.
    // Anything the local reconcile + DB already know serves immediately.
    const sweep = reconcileRemoteJobs(localFinal).catch(() => localFinal);
    const final = await Promise.race([
      sweep,
      new Promise<typeof localFinal>((resolve) => {
        setTimeout(() => resolve(localFinal), 1_500);
      }),
    ]);

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
      // t324 — the retry leg of the same promise: pending jobs whose
      // one-shot trigger already fired (or missed) re-attempt through their
      // completed upstreams, rate-limited so a long-lived server does not
      // turn every poll into a dispatch storm. autoStartPendingDownstream
      // is idempotent (in-flight + liveness + stampede guards), so a round
      // that finds nothing ready is just a refreshed waiting message.
      if (pendingCount > 0 && Date.now() - lastPendingRetryAt > PENDING_RETRY_MS) {
        lastPendingRetryAt = Date.now();
        const pendingIds = final
          .filter((j) => j.status === "pending" && !j.linkedJobId)
          .map((j) => j.id);
        if (pendingIds.length > 0) {
          const edges = await db.edge.findMany({
            where: { toJobId: { in: pendingIds } },
            select: { fromJobId: true },
          });
          const doneIds = new Set(final.filter((j) => j.status === "completed").map((j) => j.id));
          const retryTriggers = [...new Set(edges.map((e) => e.fromJobId))].filter((id) =>
            doneIds.has(id)
          );
          for (const id of retryTriggers) {
            void autoStartPendingDownstream(id);
          }
        }
      }
    }

    const runs = readRuns();
    const jobsOut = final.map((j) => {
      const dto = toJobDTO(j);
      const state = runs[j.id];
      dto.engine = "relion";
      // remote runs stream their logs over SSH — the log tab is always live
      dto.hasLog = state ? state.remote != null || existsSync(state.logFile) : false;
      dto.runRemote = remoteInfoFor(j.id);
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
      /** t350 — the class-gallery flow: pick classes of a finished
       * upstream classification; the new job consumes their per-class
       * stars (auto-joinstar on dispatch). A top-level field because the
       * scalar-filtered `params` cannot carry the object — the server
       * validates it HERE and injects it into the stored params JSON. */
      classStarSelection?: unknown;
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
    // legacy zero-workspace seed: provision "Main" instead of 500-ing the
    // user's very first job-add action
    if (projectWorkspaces.length === 0) {
      projectWorkspaces.push({
        id: await ensureDefaultWorkspace(active.project.id),
        projectId: active.project.id,
        name: "Main",
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
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

    // t350 — validate + normalize the class selection before it enters the
    // stored params: the SOURCE must be a finished classification of THIS
    // project (its per-class stars live on the cluster that ran it), and
    // the classes must be positive integers.
    let classSelection: { jobId: string; classes: number[] } | null = null;
    if (body.classStarSelection != null) {
      const sel = body.classStarSelection as { jobId?: unknown; classes?: unknown };
      const sourceId = typeof sel.jobId === "string" ? sel.jobId : "";
      const classes = Array.isArray(sel.classes)
        ? sel.classes.map((c) => Number(c)).filter((c) => Number.isInteger(c) && c > 0 && c <= 10000)
        : [];
      if (classes.length === 0) {
        return NextResponse.json({ error: "classStarSelection.classes must be a non-empty list of class numbers" }, { status: 400 });
      }
      const source = sourceId
        ? await db.job.findFirst({ where: { id: sourceId, projectId: active.project.id } })
        : null;
      if (!source || !(source.type === "class2d" || source.type === "class3d")) {
        return NextResponse.json(
          { error: "classStarSelection.jobId must be a 2D/3D classification job of this project" },
          { status: 400 }
        );
      }
      // a LINK resolves to its original (links are aliases; the run record,
      // the per-class stars and the canvas edge all belong to the original)
      let sourceRoot = source;
      while (sourceRoot.linkedJobId) {
        const root = await db.job.findFirst({
          where: { id: sourceRoot.linkedJobId, projectId: active.project.id },
        });
        if (!root) break;
        sourceRoot = root;
      }
      classSelection = { jobId: sourceRoot.id, classes: [...new Set(classes)].sort((a, b) => a - b) };
    }

    const storedParams: Record<string, unknown> = customParams
      ? { ...customParams }
      : { ...defaultParams(type) };
    if (classSelection) storedParams.classStarSelection = classSelection;

    const job = await db.job.create({
      data: {
        projectId: active.project.id,
        workspaceId,
        type,
        name: customName ?? `${spec.label} ${count + 1}`,
        x,
        y,
        params: JSON.stringify(storedParams),
        duration: spec.duration,
      },
    });

    // the gallery flow wires the source classification to the new consumer
    // automatically — the canvas shows the lineage the dispatch will use
    // (resolveInputs scans the upstream chain through this edge)
    let createdEdge: EdgeDTO | null = null;
    if (classSelection) {
      const edge = await db.edge.create({
        data: {
          projectId: active.project.id,
          fromJobId: classSelection.jobId,
          toJobId: job.id,
        },
      });
      createdEdge = toEdgeDTO(edge);
    }

    const dto = toJobDTO(job);
    dto.engine = "relion";
    return NextResponse.json({ job: dto, ...(createdEdge ? { edge: createdEdge } : {}) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/jobs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
