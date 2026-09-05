import { NextRequest, NextResponse } from "next/server";
import { ensureActiveProject, toProjectDTO } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** GET /api/project — active project (seeds the demo when DB is empty). */
export async function GET() {
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

/** POST kept for symmetry with older clients — same as GET. */
export async function POST(_request: NextRequest) {
  return GET();
}
