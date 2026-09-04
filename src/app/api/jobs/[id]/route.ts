import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { jobType } from "@/lib/workflow";
import { clearRunRecord, stopRun, isRunAlive } from "@/lib/relion/engine";
import { removeFileEdgesTouching } from "@/lib/edge-ports";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/jobs/[id] — body may contain:
 *  - x / y (numbers)
 *  - name (trimmed, 1–60 chars)
 *  - params (object, merged with existing; keys sanitized against the schema)
 *  - status: "idle" (reset → progress 0, result null)
 *  - workspaceId (string) — MOVE the job to another workspace of the SAME
 *    project (edges are untouched: they simply render where both endpoints
 *    are visible; downstream consumers keep working through links)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      x?: unknown;
      y?: unknown;
      name?: unknown;
      params?: unknown;
      status?: unknown;
      workspaceId?: unknown;
    };

    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const isLink = existing.linkedJobId != null;

    // linked jobs are read-only mirrors — positions and (cosmetic) name stay
    // editable, but params/reset belong to the ORIGINAL
    if (isLink && (body.params != null || body.status != null)) {
      return NextResponse.json(
        {
          error:
            "Linked copies mirror their original job — edit or reset the original instead (follow the ⧉ badge)",
        },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};

    if (typeof body.x === "number" && Number.isFinite(body.x)) data.x = body.x;
    if (typeof body.y === "number" && Number.isFinite(body.y)) data.y = body.y;

    if (typeof body.workspaceId === "string" && body.workspaceId) {
      if (body.workspaceId !== existing.workspaceId) {
        const target = await db.workspace.findUnique({
          where: { id: body.workspaceId },
        });
        if (!target || target.projectId !== existing.projectId) {
          return NextResponse.json(
            { error: "Target workspace is not in this job's project" },
            { status: 400 }
          );
        }
        data.workspaceId = target.id;
      }
    }

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length < 1 || name.length > 60) {
        return NextResponse.json(
          { error: "Job name must be 1–60 characters" },
          { status: 400 }
        );
      }
      data.name = name;
    }

    if (body.params && typeof body.params === "object" && !Array.isArray(body.params)) {
      const spec = jobType(existing.type);
      const current = JSON.parse(existing.params || "{}") as Record<string, unknown>;
      const incoming = body.params as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...current };
      const allowed = new Set((spec?.params ?? []).map((p) => p.key));
      if (existing.type === "import") allowed.add("empiarData"); // engine flag, set by the EMPIAR seed
      for (const [key, value] of Object.entries(incoming)) {
        if (
          allowed.has(key) &&
          (typeof value === "number" || typeof value === "string" || typeof value === "boolean")
        ) {
          merged[key] = value;
        }
      }
      data.params = JSON.stringify(merged);
    }

    if (body.status === "idle") {
      data.status = "idle";
      data.progress = 0;
      data.result = null;
      data.startedAt = null;
      // If a live process is still attached to this job (running refine,
      // restart orphan…), kill its tree FIRST — previously the record was
      // simply cleared, leaving an untracked mpirun writing to the workdir
      // forever (and stacking with any later re-run → OOM).
      try {
        if (isRunAlive(id)) {
          await stopRun(id);
        }
      } catch {
        /* best effort — the state file is advisory */
      }
      // discard the engine run record so a later Run starts fresh
      // (rather than resuming a leftover --continue checkpoint)
      try {
        clearRunRecord(id);
      } catch {
        /* state file is advisory */
      }
    }

    const job = await db.job.update({ where: { id }, data });
    return NextResponse.json({ job: toJobDTO(job) });
  } catch (error) {
    console.error("PATCH /api/jobs/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/[id] — edges cascade via Prisma. A live process tree is
 * stopped first (the old behavior deleted the row and let the mpirun ranks
 * keep running untracked for hours). Deleting an ORIGINAL also cascades its
 * soft links in other workspaces (Prisma onDelete: Cascade).
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await db.job.findUnique({
      where: { id },
      include: { _count: { select: { links: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (existing._count.links > 0) {
      return NextResponse.json(
        {
          error: `${existing._count.links} linked cop${existing._count.links === 1 ? "y" : "ies"} in other workspaces reference this job — delete or move them away first`,
        },
        { status: 409 }
      );
    }
    try {
      if (isRunAlive(id)) {
        await stopRun(id);
      }
      clearRunRecord(id);
    } catch {
      /* best effort cleanup */
    }
    await db.job.delete({ where: { id } });
    // the Prisma cascade removed the DB edge rows, but the sidecar file has
    // no FK — sweep its edges too or they'd linger as orphans
    try {
      removeFileEdgesTouching(id);
    } catch {
      /* advisory layer */
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/jobs/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
