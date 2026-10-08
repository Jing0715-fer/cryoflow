import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { ensureActiveProject, toProjectDTO } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** GET /api/project — active project (seeds the demo when DB is empty). */
export async function GET() {
  // t709 priced this read-half's door and deferred it with the collection
  // GETs (see jobs/route.ts) — the QA hot-path blast radius wants its own
  // mass-shim round before the gate lands.
  try {
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ project: null });
    }
    return NextResponse.json({
      project: toProjectDTO(active.project, active.meta.mode, active.meta.engine),
    });
  } catch (error) {
    console.error("GET /api/project failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST kept for symmetry with older clients — same as GET.
 *
 * t708 — the write door: a POST here SEEDS A PROJECT when the DB is empty
 * (the same side effect empiar-seed was doored for at t252 — state born
 * from a blind request). The GET keeps its seed-on-empty behavior this
 * batch (readers round prices the reader doors); the POST surface, being
 * the explicit write form, carries the door now.
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site project actions are not allowed" }, { status: 403 });
  }
  return GET();
}
