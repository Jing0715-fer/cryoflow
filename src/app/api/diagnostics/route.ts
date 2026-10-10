import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { readDiagnostics } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

/**
 * GET /api/diagnostics — the box's vitals in one payload (t530).
 *
 * Memory lanes (with the campaign's canonical lines), disk, the running
 * build's provenance stamp and the world's census. Facts read from bytes
 * (/proc/meminfo, statfs, .next/.built-at-commit) and cheap counts — no
 * process sniffing, no RELION re-probe (that surface stays /api/system's
 * with its own 60s cache; this payload composes with it client-side).
 *
 * t259 law applies unchanged: the payload reveals host memory topology,
 * a drive-by read is low-value but not free, so the same-origin door
 * (Fetch Metadata + Host pinning via isLocalRequest) slams cross-site
 * access exactly like /api/system.
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to system diagnostics is not allowed" },
      { status: 403 }
    );
  }
  try {
    return NextResponse.json(await readDiagnostics());
  } catch (error) {
    console.error("GET /api/diagnostics failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
