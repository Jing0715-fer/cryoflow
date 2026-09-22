import { NextRequest, NextResponse } from "next/server";
import { setActiveProject, readProjectsFile } from "@/lib/projects";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/switch — body: { id } → set the active project.
 *
 * t259 — the metadata door. Blind project ACTIVATION (every subsequent
 * job lands in the attacker-chosen workspace) through a `.catch`-tolerant
 * JSON parse a cross-site no-cors fetch can drive — the t252 ledger class
 * stops form-borne CSRF, not fetch-borne; a rebound page passes the
 * origin check entirely. isLocalRequest closes both carriers.
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site project switching is not allowed" },
      { status: 403 }
    );
  }
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
