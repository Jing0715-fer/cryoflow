import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { getConnection } from "@/lib/remote/connections";
import { runStorageDiagnostic } from "@/lib/remote/storage-diag";

export const dynamic = "force-dynamic";

/**
 * POST /api/remote/diagnostics/storage — t370, the AUTOMATED storage
 * diagnostic (the decisive t369 experiment, behind one button):
 *
 *   body: { connectionId: string }
 *
 * Runs the two-leg probe against the connection's storage — a 2 MB
 * urandom write + md5 from the LOGIN node, an 8 MB write + sync + md5
 * from a COMPUTE node via a minimal sbatch (--time=2:00, 1 task, no
 * GPU), then the login node reads the SAME file back and the digests
 * decide:
 *
 *   { ok: true,  verdict: "COMPUTE→STORAGE WRITE LOST — …", lines: […] }
 *   { ok: true,  verdict: "STORAGE WRITE PATH HEALTHY — …", lines: […] }
 *   { ok: false, verdict: "storage diagnostic could not run (…)", lines: […] }
 *
 * `ok` means the EXPERIMENT ran to a decisive verdict — a LOST storage
 * path is a successful diagnostic with a damning result, not an error.
 * `lines` carries the df/quota/md5 evidence to hand a storage admin.
 * The verdict also persists in the storage-diag sidecar (per
 * connection) so the sweep's automatic trigger and this manual door
 * never disagree about when it last ran.
 *
 * The sweep fires the same function automatically at the FIRST live
 * zero-header round of a classification run (guarded once per run by
 * the record's storageDiagAt stamp) — this route exists for the "run
 * it NOW, on demand" ask and for connections whose runs predate t370.
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access to this data is not allowed" }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be { connectionId }" }, { status: 400 });
    }
    const connectionId = typeof body.connectionId === "string" ? body.connectionId.trim().slice(0, 60) : "";
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }
    const conn = getConnection(connectionId);
    if (!conn) {
      return NextResponse.json({ error: `No connection with id ${connectionId}` }, { status: 404 });
    }
    // runStorageDiagnostic NEVER throws (its own contract) — every
    // failure is an honest { ok: false, verdict } the UI can show as-is
    const result = await runStorageDiagnostic({ connectionId });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "storage diagnostic failed" },
      { status: 500 }
    );
  }
}
