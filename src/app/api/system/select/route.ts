import { NextRequest, NextResponse } from "next/server";
import { selectRelionInstall } from "@/lib/relion/system";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/system/select — switch the ACTIVE RELION install.
 * Body: { installId } (an id from status.installs). The choice persists in
 * data/relion-select.json and every subsequent run dispatches to it
 * (native spawn or the WSL bridge depending on the install).
 *
 * t259 — the metadata door. This is a STATE-CHANGING route with a
 * `.catch`-tolerant JSON parse: a cross-site no-cors fetch can POST a
 * text/plain JSON body that request.json() happily parses (the t252
 * ledger class stops form-borne CSRF, not fetch-borne), and a rebound
 * page passes the origin check entirely. isLocalRequest closes both
 * carriers; the same-origin UI call always passes.
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site writes to the RELION selection are not allowed" },
      { status: 403 }
    );
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      installId?: unknown;
    };
    const installId = typeof body.installId === "string" ? body.installId.trim() : "";
    if (!installId) {
      return NextResponse.json({ error: "installId is required" }, { status: 400 });
    }

    const { ok, status } = await selectRelionInstall(installId);
    if (!ok) {
      return NextResponse.json(
        {
          error: `Unknown RELION install: ${installId} — press Re-detect to refresh the install list`,
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ status });
  } catch (error) {
    console.error("POST /api/system/select failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
