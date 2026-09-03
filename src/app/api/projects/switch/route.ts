import { NextRequest, NextResponse } from "next/server";
import { setActiveProject, readProjectsFile } from "@/lib/projects";

export const dynamic = "force-dynamic";

/** POST /api/projects/switch — body: { id } → set the active project. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const ok = setActiveProject(id);
    if (!ok) {
      return NextResponse.json({ error: "Unknown project id" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, active: readProjectsFile().active });
  } catch (error) {
    console.error("POST /api/projects/switch failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
