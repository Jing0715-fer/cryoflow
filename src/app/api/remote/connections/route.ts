import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { dropConnection } from "@/lib/remote/ssh";
import {
  loadConnections,
  toConnectionDTO,
  upsertConnection,
} from "@/lib/remote/connections";

export const dynamic = "force-dynamic";

/**
 * GET /api/remote/connections — the SSH cluster registry (secrets stripped:
 * the response carries hasPassword/hasPassphrase booleans only).
 * POST — create or replace a connection by id (upsert). Accepts a secret
 * field: non-empty string = store, empty string = CLEAR, absent = keep.
 */
export async function GET() {
  return NextResponse.json({ connections: loadConnections().map(toConnectionDTO) });
}

export async function POST(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be a connection object" }, { status: 400 });
    }
    if (typeof body.host !== "string" || !body.host.trim()) {
      return NextResponse.json({ error: "host is required" }, { status: 400 });
    }
    if (typeof body.username !== "string" || !body.username.trim()) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    const conn = upsertConnection(body);
    dropConnection(conn.id); // a saved edit invalidates any live SSH session
    return NextResponse.json({ connection: toConnectionDTO(conn) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection save failed" },
      { status: 500 }
    );
  }
}
