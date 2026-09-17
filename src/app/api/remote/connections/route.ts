import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { dropConnection } from "@/lib/remote/ssh";
import {
  loadConnections,
  toConnectionDTO,
  upsertConnection,
} from "@/lib/remote/connections";
import { withRunResume } from "@/lib/remote/remote-run";

export const dynamic = "force-dynamic";

/**
 * GET /api/remote/connections — the SSH cluster registry (secrets stripped:
 * the response carries hasPassword/hasPassphrase booleans only).
 * POST — create or replace a connection by id (upsert). Accepts a secret
 * field: non-empty string = store, empty string = CLEAR, absent = keep.
 *
 * The t260 review: even stripped, the list NAMES the cluster targets —
 * hosts, usernames, auth methods — exactly the class t259 gated on
 * /api/hpc/profiles (sbatch submission targets are not low-sensitivity).
 * A DNS-rebinding page reading the registry learns where the user's
 * compute lives before it ever tries a write. Same-origin UI passes the
 * Fetch-Metadata door by definition; drive-by readers die at 403.
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  // t270 — each connection rides its run résumé (aggregate over the run
  // records). Zero runs → the field is OMITTED: "no résumé" is the honest
  // state and the UI renders no card for it (the badge language: only
  // things that happened get badges).
  return NextResponse.json({
    connections: loadConnections().map((c) => withRunResume(toConnectionDTO(c))),
  });
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
    // t270 — same résumé contract as GET/PATCH: an edit must not erase the
    // run history the dialog already shows.
    return NextResponse.json({ connection: withRunResume(toConnectionDTO(conn)) }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection save failed" },
      { status: 500 }
    );
  }
}
