import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

interface LayoutUpdate {
  id: string;
  x: number;
  y: number;
}

function sanitize(raw: unknown): LayoutUpdate[] {
  if (!Array.isArray(raw)) return [];
  const out: LayoutUpdate[] = [];
  for (const item of raw) {
    if (item && typeof item === "object") {
      const { id, x, y } = item as { id?: unknown; x?: unknown; y?: unknown };
      if (typeof id === "string" && Number.isFinite(x) && Number.isFinite(y)) {
        out.push({ id, x: Math.round(x as number), y: Math.round(y as number) });
      }
    }
  }
  return out;
}

/**
 * POST /api/jobs/layout — batch position update (one-click auto-arrange).
 * Body: { updates: [{ id, x, y }] }. Only jobs of the active project move.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { updates?: unknown };
    const updates = sanitize(body.updates);
    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }
    const active = await getActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No active project" }, { status: 404 });
    }
    const projectId = active.project.id;

    await Promise.all(
      updates.map((u) =>
        db.job.updateMany({
          where: { id: u.id, projectId },
          data: { x: u.x, y: u.y },
        })
      )
    );
    return NextResponse.json({ ok: true, moved: updates.length });
  } catch (error) {
    console.error("POST /api/jobs/layout failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
