import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { jobType } from "@/lib/workflow";
import { clearRunRecord } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/jobs/[id] — body may contain:
 *  - x / y (numbers)
 *  - name (trimmed, 1–60 chars)
 *  - params (object, merged with existing; keys sanitized against the schema)
 *  - status: "idle" (reset → progress 0, result null)
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
    };

    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (typeof body.x === "number" && Number.isFinite(body.x)) data.x = body.x;
    if (typeof body.y === "number" && Number.isFinite(body.y)) data.y = body.y;

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

/** DELETE /api/jobs/[id] — edges cascade via Prisma. */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    await db.job.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/jobs/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
