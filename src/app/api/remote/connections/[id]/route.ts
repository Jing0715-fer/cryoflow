import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { dropConnection } from "@/lib/remote/ssh";
import { deleteConnection, patchConnection, toConnectionDTO } from "@/lib/remote/connections";
import { withRunResume } from "@/lib/remote/remote-run";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/remote/connections/[id] — partial update (secret semantics as POST). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ error: "Body must be a patch object" }, { status: 400 });
    }
    const conn = patchConnection(id, body);
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    dropConnection(id);
    // t270 — the patch response carries the résumé too: the dialog's upsert
    // replaces the whole row, and an edit must not erase the run history
    // ("every layer tells the same story" applies to partial writes).
    // t272 — withRunResume is async (per-entry existence check).
    return NextResponse.json({ connection: await withRunResume(toConnectionDTO(conn)) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection update failed" },
      { status: 500 }
    );
  }
}

/** DELETE /api/remote/connections/[id] — remove the connection (live runs keep their records). */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    if (!deleteConnection(id)) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    dropConnection(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection delete failed" },
      { status: 500 }
    );
  }
}
