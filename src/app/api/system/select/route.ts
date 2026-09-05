import { NextRequest, NextResponse } from "next/server";
import { selectRelionInstall } from "@/lib/relion/system";

export const dynamic = "force-dynamic";

/**
 * POST /api/system/select — switch the ACTIVE RELION install.
 * Body: { installId } (an id from status.installs). The choice persists in
 * data/relion-select.json and every subsequent run dispatches to it
 * (native spawn or the WSL bridge depending on the install).
 */
export async function POST(request: NextRequest) {
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
