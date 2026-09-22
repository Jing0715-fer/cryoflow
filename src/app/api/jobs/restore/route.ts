import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveProject } from "@/lib/seed";
import { jobType } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/restore — undo support for job deletion.
 *
 * Deletion removes only the DB row (the engine workdir is keyed by job id —
 * `workdirFor` derives `RELION_ROOT/projectId/{type}_{id.slice(-8)}` — and is
 * never swept), so restoring under the ORIGINAL id re-attaches every output,
 * log and engine record as if the delete never happened. A new-id restore
 * would strand all of that on disk; same-id is what makes undo honest.
 *
 * Contract per job (each restores independently — one bad row never aborts
 * the batch; the response lists successes and failures separately so the
 * client toast can be honest about partial restores):
 *  - `id` must be free (a collision means the job was already restored —
 *    the double-click-Undo guard relies on this failing, not on the client).
 *  - `type` must be a known job type; `name` 1–120 chars.
 *  - `workspaceId` must belong to the active project (a workspace deleted
 *    between delete and undo fails that job — restoring into a wrong home
 *    would be worse than refusing).
 *  - `params` scalar-filtered against the type schema — the same sanitizer
 *    POST /api/jobs applies (never trust a client-supplied map verbatim).
 *  - `status` whitelist: idle | pending | completed | failed. "running" is
 *    COERCED to idle (the live process was stopped at delete time — restoring
 *    it as running would promise a process that no longer exists); unknown
 *    values fail rather than guess.
 *  - `linkedJobId` (soft links in the batch) must reference an existing
 *    original in the same project. A batch can never contain both a link
 *    and its original (the original's delete refuses while links exist),
 *    so the original is always a survivor here, never a same-batch row.
 */
interface RestoreJobInput {
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

const RESTORABLE_STATUS = new Set(["idle", "pending", "completed", "failed"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { jobs?: unknown };
    const list = Array.isArray(body.jobs) ? (body.jobs as RestoreJobInput[]) : [];
    if (list.length === 0 || list.length > 500) {
      return NextResponse.json(
        { error: "Body must be { jobs: [...] } with 1–500 entries" },
        { status: 400 }
      );
    }

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const workspaces = await db.workspace.findMany({
      where: { projectId: active.project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    const wsIds = new Set(workspaces.map((w) => w.id));

    const restored: { id: string; coerced: boolean }[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const input of list) {
      const id = typeof input.id === "string" && input.id ? input.id : null;
      if (!id) {
        failed.push({ id: "", error: "Missing job id" });
        continue;
      }
      try {
        if (await db.job.findUnique({ where: { id } })) {
          failed.push({ id, error: "A job with this id already exists" });
          continue;
        }
        const type = typeof input.type === "string" ? input.type : "";
        const spec = jobType(type);
        if (!spec) {
          failed.push({ id, error: `Unknown job type: ${type}` });
          continue;
        }
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (name.length < 1 || name.length > 120) {
          failed.push({ id, error: "Job name must be 1–120 characters" });
          continue;
        }

        // workspace: keep the job in its home; a deleted home refuses the row
        let workspaceId = workspaces[0]?.id ?? null;
        if (typeof input.workspaceId === "string" && input.workspaceId) {
          if (!wsIds.has(input.workspaceId)) {
            failed.push({ id, error: "Workspace no longer exists in this project" });
            continue;
          }
          workspaceId = input.workspaceId;
        }

        // params: scalar filter mirroring POST /api/jobs (schema keys only,
        // scalars only — an unfiltered map is an execution vector)
        const params: Record<string, number | string | boolean> = {};
        if (input.params && typeof input.params === "object" && !Array.isArray(input.params)) {
          const allowed = new Set((spec.params ?? []).map((p) => p.key));
          if (type === "import") allowed.add("empiarData"); // engine flag, same exception as POST
          for (const [key, value] of Object.entries(input.params as Record<string, unknown>)) {
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
            failed.push({ id, error: `Unrestorable status: ${input.status}` });
            continue;
          }
        }
        // coerce mirrors the PATCH reset semantics — an idle row that still
        // claims 42% progress and a start timestamp would be lying
        if (coerced) {
          status = "idle";
          input.progress = 0;
          input.result = null;
          input.startedAt = null;
        }

        const progress =
          typeof input.progress === "number" && Number.isFinite(input.progress)
            ? Math.min(100, Math.max(0, input.progress))
            : 0;
        const result = typeof input.result === "string" ? input.result : null;
        const noteRaw = typeof input.note === "string" ? input.note.trim() : "";
        if (noteRaw.length > 500) {
          failed.push({ id, error: "Job note must be 500 characters or fewer" });
          continue;
        }
        const startedAt =
          typeof input.startedAt === "string" && input.startedAt
            ? new Date(input.startedAt)
            : null;
        if (startedAt && Number.isNaN(startedAt.getTime())) {
          failed.push({ id, error: "startedAt is not a valid date" });
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
          if (!original || original.projectId !== active.project.id) {
            failed.push({ id, error: "Linked original no longer exists in this project" });
            continue;
          }
          linkedJobId = original.id;
        }

        await db.job.create({
          data: {
            id,
            projectId: active.project.id,
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
            note: noteRaw.length > 0 ? noteRaw : null,
            startedAt,
            duration,
          },
        });
        restored.push({ id, coerced });
      } catch (err) {
        failed.push({
          id,
          error: err instanceof Error ? err.message : "Restore failed",
        });
      }
    }

    return NextResponse.json({ restored, failed });
  } catch (error) {
    console.error("POST /api/jobs/restore failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
