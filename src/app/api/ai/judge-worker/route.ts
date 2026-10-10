import { NextResponse } from "next/server";
import { ensureJudgeWorker, judgeWorkerStatus } from "@/lib/ai/judge-worker";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/judge-worker — the auto-judge loop's honest introspection
 * (t574). The worker's own status route doubles as a defensive mount
 * (idempotent via the globalThis singleton — the reaper's dual-mount
 * doctrine, minus the heavy graph: a status read should not compile the
 * whole sweep). The body carries the product-level gates (autoJudge
 * toggle, provider presence), the cadence, the watermark and the last 20
 * judge records — the settings dialog's status line and the QA harness
 * both read the same truth.
 *
 * t709 — the reader door, and the STRONGEST of the nine: this GET is a
 * defensive mount (ensureJudgeWorker below), so a blind probe would not
 * just burn a read — it would SPIN UP the judge worker from a page that
 * never sees the answer. Idempotent for the app, still an unwanted side
 * effect for a hostile page (doctrine in http-guard.ts).
 */
export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site worker status reads are not allowed" }, { status: 403 });
  }
  try {
    ensureJudgeWorker();
    return NextResponse.json(judgeWorkerStatus());
  } catch (error) {
    console.error("GET /api/ai/judge-worker failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
