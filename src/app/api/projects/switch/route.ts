import { NextRequest, NextResponse } from "next/server";
import { setActiveProject, readProjectsFile } from "@/lib/projects";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";
import { serverErrorReply } from "@/lib/server-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/switch — body: { id } → set the active project.
 *
 * t259 — the metadata door. Blind project ACTIVATION (every subsequent
 * job lands in the attacker-chosen workspace) through a `.catch`-tolerant
 * JSON parse a cross-site no-cors fetch can drive — the t252 ledger class
 * stops form-borne CSRF, not fetch-borne; a rebound page passes the
 * origin check entirely. isLocalRequest closes both carriers.
 *
 * t894 — the door must not lie about PHANTOMS. `setActiveProject` validates
 * against the REGISTRY FILE ONLY, and the registry can hold meta for ids
 * the live database has never heard of (witnessed live: the demo's meta
 * survived a re-seed that changed the project id — the registry kept the
 * old id while the DB knew only the new one; the switch answered `ok:true`
 * for the ghost and wrote the pointer to it — the canvas-0-jobs FATAL
 * signature, one door away). The read path self-heals (`getActiveProject`
 * falls back to the first project when `findUnique` misses), so the lie
 * was latent — but a door that claims an activation the resolved world
 * immediately ignores is a door that cannot be trusted in any audit. The
 * DB row is now the second gate: registry-known OR not, an id without a
 * Prisma row gets the same 404 an unknown id always got.
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
    // t894 — the phantom gate: the registry file is NOT existence. Only a
    // live Prisma row makes an id activatable; ghost meta (a re-seed's
    // orphan, a swept project's survivor) is refused with the same 404 an
    // unknown id always carried.
    const exists = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Unknown project id" }, { status: 404 });
    }
    const ok = setActiveProject(id);
    if (!ok) {
      return NextResponse.json({ error: "Unknown project id" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, active: readProjectsFile().active });
  } catch (error) {
    return serverErrorReply("POST /api/projects/switch", error);
  }
}
