import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { sanitizeConnection } from "@/lib/remote/connections";
import { probeConnection } from "@/lib/remote/probe";
import { dropConnection } from "@/lib/remote/ssh";

export const dynamic = "force-dynamic";

/**
 * POST /api/remote/connections/test — probe a connection BY VALUE (nothing
 * is persisted). t289: the create form's Test & probe answers the user who
 * wants to know the login WORKS before committing anything to the registry
 * — "save first, then test" made the first test a leap of faith.
 *
 * Contract mirrors the saved-connection variant ([id]/test):
 *   - gated like every remote route (the probe reveals the cluster's
 *     software inventory);
 *   - body is the same connection object POST /api/remote/connections takes
 *     (host/username required; three-state secrets never round-trip — the
 *     create form holds the raw values, the edit form's stored ones cannot
 *     be echoed back and must go through the [id] route instead);
 *   - an unreachable cluster is ok:false + the probe's error line, NOT a 500;
 *   - the transient connection id is dropped from the SSH pool afterwards
 *     (a probe opens a session keyed by id; a phantom id must not squat it).
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  try {
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
    const conn = sanitizeConnection(body);
    const probe = await probeConnection(conn);
    // the transient id must not keep an SSH session alive in the pool
    dropConnection(conn.id);
    return NextResponse.json({ ok: probe.ok, probe });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection probe failed" },
      { status: 500 }
    );
  }
}
