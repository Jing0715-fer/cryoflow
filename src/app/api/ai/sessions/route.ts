import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { listSessionsForActiveProject } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/sessions — t423: the history drawer's list. Summaries of the
 * active project's past conversations (newest first): preview, message and
 * tool counts, timestamps. Summaries only — the transcript itself travels
 * on demand via GET /api/ai/sessions/[id] when the user switches.
 */
export async function GET(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    return NextResponse.json(await listSessionsForActiveProject());
  } catch (error) {
    console.error("GET /api/ai/sessions failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
