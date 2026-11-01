import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";
import { badJsonReply, serverErrorReply } from "@/lib/server-error";
import {
  validateWorldLedgerEnvelope,
  WORLD_LEDGER_ENVELOPE_MAX_BYTES,
} from "@/lib/world-vitals";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET/PUT /api/projects/[id]/world-ledger — the world ledger's SERVER
 * tier (t1142): the health board's transition memory that outlives the
 * tab (sessionStorage, t1135) and the machine (localStorage, t1141).
 *
 * The tier's law (the t1141 survey named the cost before the wiring):
 * the ENVELOPE RIDES UNCHANGED and the SAME reader reads it. So this
 * door adds no second contract —
 *   • GET hands back the stored envelope VERBATIM (the exact bytes the
 *     PUT received, never re-stringified) or `null` — the honest
 *     absence of a world that never carried a story here.
 *   • PUT stores the envelope VERBATIM after the lib's ONE trust
 *     decision (the version law's mouth): a foreign version, a half
 *     shape, an over-cap row count — each refused with the verdict's
 *     own reason, never guessed.
 * One row per project (the world's memory under its own project's
 * name); a foreign id is the phantom door's 404. The byte bound is the
 * t1141 unit's tooth made law: 64 KiB, guarded BEFORE the parse spends
 * its effort. Same door pair as the family's read routes (http-guard):
 * Fetch Metadata for the cross-site fetch, Host pinning for the
 * rebound one; same-origin UI calls always pass.
 */

const GUARD_TAG = "the world ledger";

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: `Cross-site access to ${GUARD_TAG} is not allowed` },
      { status: 403 },
    );
  }
  try {
    const { id } = await context.params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const row = await db.worldLedger.findUnique({ where: { projectId: id } });
    // The honest absence: a world with no server memory yet speaks a
    // null envelope — the client's parse father restores nothing and
    // the board keeps its own fresh story (never a guessed {}).
    return NextResponse.json({ envelope: row?.envelope ?? null });
  } catch (error) {
    return serverErrorReply("GET /api/projects/[id]/world-ledger", error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: `Cross-site access to ${GUARD_TAG} is not allowed` },
      { status: 403 },
    );
  }
  try {
    const { id } = await context.params;
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return badJsonReply("PUT /api/projects/[id]/world-ledger", error);
    }
    const envelope = (body as { envelope?: unknown } | null)?.envelope;
    if (typeof envelope !== "string") {
      return NextResponse.json(
        { error: "The world ledger door speaks one envelope: { envelope: string }" },
        { status: 400 },
      );
    }
    // The tooth (the t1141 unit's byte bound made law): a fatter body
    // is refused BEFORE the trust decision spends a parse on it.
    if (envelope.length > WORLD_LEDGER_ENVELOPE_MAX_BYTES) {
      return NextResponse.json(
        { error: "The ledger envelope exceeds the 64 KiB byte bound" },
        { status: 413 },
      );
    }
    const verdict = validateWorldLedgerEnvelope(envelope);
    if (!verdict.ok) {
      return NextResponse.json(
        { error: `The ledger envelope was refused: ${verdict.reason}` },
        { status: 400 },
      );
    }
    // The envelope rides UNCHANGED — stored verbatim (no re-stringify:
    // the GET hands back the exact bytes this PUT received).
    await db.worldLedger.upsert({
      where: { projectId: id },
      update: { envelope },
      create: { projectId: id, envelope },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverErrorReply("PUT /api/projects/[id]/world-ledger", error);
  }
}
