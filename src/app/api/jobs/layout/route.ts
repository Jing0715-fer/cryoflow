import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";
import { getActiveProject } from "@/lib/projects";
import { serverErrorReply } from "@/lib/server-error";

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
 *
 * t888 — the array itself is bounded (the t886 audit's observation #3:
 * the route used to accept an UNCAPPED updates array into an unbounded
 * Promise.all — the sibling restore door's 1–500 bound is the family
 * law, and the client's tidy writer chunks under it). The raw array is
 * priced before the sanitize loop spends a pass on it.
 *
 * t708 — the write door: coordinates are the t705 click-geometry lesson's
 * raw material — a blind layout write could stack cards into click-hijack
 * piles invisibly (the canvas hit-tests topmost). Doctrine http-guard.ts +
 * t252 Phase B2; one door, every write handler.
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site layout writes are not allowed" }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { updates?: unknown };
    if (Array.isArray(body.updates) && body.updates.length > 500) {
      return NextResponse.json(
        { error: "Body must be { updates: [...] } with 1–500 entries" },
        { status: 400 }
      );
    }
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
    return serverErrorReply("POST /api/jobs/layout", error);
  }
}
