import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectDTO } from "@/lib/seed";
import { listProjectsWithMeta, registerProject } from "@/lib/projects";
import type { ProjectEngine, ProjectMode } from "@/lib/projects";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects — all projects with mode/engine meta + createdAt + job stats merged.
 * POST /api/projects — body: { name, mode? } → create + set active.
 *
 * t259 — the metadata door. The READ names every project and its job
 * census (a rebound page's reconnaissance map); the WRITE creates and
 * ACTIVATES a project (a blind state change — and a `.catch`-tolerant
 * JSON parse a cross-site no-cors fetch can drive: the t252 ledger class
 * stops form-borne CSRF, not fetch-borne). isLocalRequest closes both;
 * the same-origin UI always passes.
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to the project registry is not allowed" },
      { status: 403 }
    );
  }
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
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site writes to the project registry are not allowed" },
      { status: 403 }
    );
  }
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
