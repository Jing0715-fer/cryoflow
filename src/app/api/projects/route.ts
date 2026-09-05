import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectDTO } from "@/lib/seed";
import { listProjectsWithMeta, registerProject } from "@/lib/projects";
import type { ProjectEngine, ProjectMode } from "@/lib/projects";

export const dynamic = "force-dynamic";

/** GET /api/projects — all projects with mode/engine meta + createdAt + job stats merged. */
export async function GET() {
  try {
    const projects = await listProjectsWithMeta();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("GET /api/projects failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/projects — body: { name, mode? } → create + set active. The engine is always the real RELION one (legacy `engine` body values are ignored). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      mode?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json({ error: "Project name must be 1–80 characters" }, { status: 400 });
    }
    const mode: ProjectMode = body.mode === "tomo" ? "tomo" : "spa";
    const engine: ProjectEngine = "relion";

    const project = await db.project.create({ data: { name } });
    registerProject(project.id, { mode, engine }, true);

    return NextResponse.json(
      { project: toProjectDTO(project, mode, engine) },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
