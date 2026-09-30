import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { latestSessionForActiveProject, runAiIteration } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/chat — rehydration: the latest session of the active project
 * (the panel reopens with its transcript; a page reload loses nothing).
 */
export async function GET(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const result = await latestSessionForActiveProject();
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/ai/chat failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/ai/chat — ONE agent iteration (one model turn + its tool
 * executions). The client drives the loop: while the response says
 * needsContinue, it immediately re-POSTs { sessionId, continue: true } —
 * each tool batch renders the moment it executed.
 *
 * Body: { sessionId?, message? } | { sessionId?, continue: true } | { action: "reset" }.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: unknown;
      message?: unknown;
      continue?: unknown;
      action?: unknown;
      sweep?: unknown; // t508 — the client's last sweep race (session memory)
    };
    const result = await runAiIteration({
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
      cont: body.continue === true,
      action: body.action === "reset" ? "reset" : undefined,
      sweep: body.sweep,
    });
    if (result.error && result.events.length === 0) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      sessionId: result.sessionId,
      events: result.events,
      needsContinue: result.needsContinue,
      ...(result.needsSetup ? { needsSetup: true } : {}),
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error("POST /api/ai/chat failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
