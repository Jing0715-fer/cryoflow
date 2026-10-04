import { NextResponse } from "next/server";
import { ensureJudgeWorker, judgeWorkerStatus } from "@/lib/ai/judge-worker";

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
 */
export async function GET() {
  try {
    ensureJudgeWorker();
    return NextResponse.json(judgeWorkerStatus());
  } catch (error) {
    console.error("GET /api/ai/judge-worker failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
