/**
 * CryoFlow — the restore core (SERVER ONLY), t477.
 *
 * POST /api/jobs/restore owned this logic since Task 97/t341; t477 lifts it
 * into a lib so TWO callers share ONE truth: the HTTP route (the canvas's
 * undo) and restore_deleted (the agent's verb). A restore the agent runs and
 * a restore the toast runs must never drift — same workspace guard, same
 * scalar param filter, same running→idle coercion, same tombstone re-apply.
 */

import { db } from "@/lib/db";
import { jobType } from "@/lib/workflow";
import { applyJobTombstone, type RestoredTombstoneEdge } from "@/lib/job-tombstone";

export interface RestoreJobInput {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  x?: unknown;
  y?: unknown;
  params?: unknown;
  workspaceId?: unknown;
  note?: unknown;
  status?: unknown;
  progress?: unknown;
  result?: unknown;
  startedAt?: unknown;
  duration?: unknown;
  linkedJobId?: unknown;
}

export interface RestoreOutcome {
  restored: { id: string; coerced: boolean }[];
  failed: { id: string; error: string }[];
  recordRestored: string[];
  edges: RestoredTombstoneEdge[];
}

const RESTORABLE_STATUS = new Set(["idle", "pending", "completed", "failed"]);

/**
 * Restore a batch of job snapshots under a project. Contract per job
 * (each restores independently — one bad row never aborts the batch):
 *  - `id` must be free (a collision means the job was already restored —
 *    the double-click-Undo guard relies on this failing, not on the client).
 *  - `type` must be a known job type; `name` 1–120 chars.
 *  - `workspaceId` must belong to the project (a workspace deleted between
 *    delete and undo fails that job — restoring into a wrong home would be
 *    worse than refusing).
 *  - `params` scalar-filtered against the type schema — the same sanitizer
 *    POST /api/jobs applies (never trust a client-supplied map verbatim).
 *  - `status` whitelist: idle | pending | completed | failed. "running" is
 *    COERCED to idle (the live process was stopped at delete time — restoring
 *    it as running would promise a process that no longer exists).
 *  - `linkedJobId` (soft links) must reference an existing original in the
 *    same project.
 */
export async function restoreJobRows(
  list: RestoreJobInput[],
  projectId: string
): Promise<RestoreOutcome> {
  const out: RestoreOutcome = { restored: [], failed: [], recordRestored: [], edges: [] };

  const workspaces = await db.workspace.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const wsIds = new Set(workspaces.map((w) => w.id));

  for (const input of list) {
    const id = typeof input.id === "string" && input.id ? input.id : null;
    if (!id) {
      out.failed.push({ id: "", error: "Missing job id" });
      continue;
    }
    try {
      if (await db.job.findUnique({ where: { id } })) {
        out.failed.push({ id, error: "A job with this id already exists" });
        continue;
      }
      const type = typeof input.type === "string" ? input.type : "";
      const spec = jobType(type);
      if (!spec) {
        out.failed.push({ id, error: `Unknown job type: ${type}` });
        continue;
      }
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (name.length < 1 || name.length > 120) {
        out.failed.push({ id, error: "Job name must be 1–120 characters" });
        continue;
      }

      // workspace: keep the job in its home; a deleted home refuses the row
      let workspaceId = workspaces[0]?.id ?? null;
      if (typeof input.workspaceId === "string" && input.workspaceId) {
        if (!wsIds.has(input.workspaceId)) {
          out.failed.push({ id, error: "Workspace no longer exists in this project" });
          continue;
        }
        workspaceId = input.workspaceId;
      }

      // params: scalar filter mirroring POST /api/jobs (schema keys only,
      // scalars only — an unfiltered map is an execution vector). A STRING
      // params (the tombstone row's serialized dialect, t477) is parsed
      // first — the same core eats both the client object and the grave's
      // JSON string, never the raw verbatim map.
      let rawParams = input.params;
      if (typeof rawParams === "string") {
        try {
          rawParams = JSON.parse(rawParams);
        } catch {
          rawParams = {};
        }
      }
      const params: Record<string, number | string | boolean> = {};
      if (rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)) {
        const allowed = new Set((spec.params ?? []).map((p) => p.key));
        if (type === "import") allowed.add("empiarData"); // engine flag, same exception as POST
        for (const [key, value] of Object.entries(rawParams as Record<string, unknown>)) {
          if (
            allowed.has(key) &&
            (typeof value === "number" || typeof value === "string" || typeof value === "boolean")
          ) {
            params[key] = value;
          }
        }
      }

      // status: whitelist + honest coerce (a stopped process stays stopped)
      let coerced = false;
      let status = "idle";
      if (typeof input.status === "string" && input.status) {
        if (RESTORABLE_STATUS.has(input.status)) {
          status = input.status;
        } else if (input.status === "running") {
          coerced = true; // process was stopped at delete time → idle
        } else {
          out.failed.push({ id, error: `Unrestorable status: ${input.status}` });
          continue;
        }
      }
      // coerce mirrors the PATCH reset semantics — an idle row that still
      // claims 42% progress and a start timestamp would be lying
      let progress =
        typeof input.progress === "number" && Number.isFinite(input.progress)
          ? Math.min(100, Math.max(0, input.progress))
          : 0;
      let result = typeof input.result === "string" ? input.result : null;
      let startedAt =
        typeof input.startedAt === "string" && input.startedAt ? new Date(input.startedAt) : null;
      if (coerced) {
        status = "idle";
        progress = 0;
        result = null;
        startedAt = null;
      }
      if (startedAt && Number.isNaN(startedAt.getTime())) {
        out.failed.push({ id, error: "startedAt is not a valid date" });
        continue;
      }
      const duration =
        typeof input.duration === "number" && Number.isFinite(input.duration)
          ? Math.round(input.duration)
          : (spec.duration ?? 8000);

      // soft link: the original must still exist in this project (a link
      // whose original vanished is restored as... nothing — refusing is
      // more honest than silently minting a standalone look-alike)
      let linkedJobId: string | null = null;
      if (typeof input.linkedJobId === "string" && input.linkedJobId) {
        const original = await db.job.findUnique({ where: { id: input.linkedJobId } });
        if (!original || original.projectId !== projectId) {
          out.failed.push({ id, error: "Linked original no longer exists in this project" });
          continue;
        }
        linkedJobId = original.id;
      }

      await db.job.create({
        data: {
          id,
          projectId,
          workspaceId,
          linkedJobId,
          type,
          name,
          x: typeof input.x === "number" && Number.isFinite(input.x) ? input.x : 140,
          y: typeof input.y === "number" && Number.isFinite(input.y) ? input.y : 200,
          status,
          progress,
          params: JSON.stringify(params),
          result,
          note: typeof input.note === "string" && input.note.trim().length > 0 && input.note.trim().length <= 500 ? input.note.trim() : null,
          startedAt,
          duration,
        },
      });
      out.restored.push({ id, coerced });
      // t341 — re-apply the delete tombstone (run record + wires)
      // server-side. Best-effort: the row is already back; the
      // tombstone is the bonus that makes the restore whole.
      try {
        const tomb = await applyJobTombstone(id);
        if (tomb.recordRestored) out.recordRestored.push(id);
        out.edges.push(...tomb.edgesRestored);
      } catch {
        /* advisory — a tombstone hiccup never fails the restore */
      }
    } catch (err) {
      out.failed.push({
        id,
        error: err instanceof Error ? err.message : "Restore failed",
      });
    }
  }

  return out;
}
