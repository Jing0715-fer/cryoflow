import { NextRequest, NextResponse } from "next/server";
import { findEffectiveJob } from "@/lib/link";
import { getLogTail, getRun } from "@/lib/relion/engine";
import { remoteLogTail } from "@/lib/remote/remote-run";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/log — the real engine's run.out/run.err
 *   ?full=1          → entire log (8MB safety cap) instead of the 600-line tail
 *   ?format=raw      → text/plain download (run.out) instead of JSON
 * (jobs that never ran have no log → 404). Soft links resolve to the ORIGINAL's log.
 *
 * REMOTE runs (record.remote): the log lives on the CLUSTER — the tail is
 * fetched over SSH on demand (same shape, always live).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Hardening (t251, the #5 sibling closure): workdir-derived data —
    // same drive-by door + Host pin pair as the outputs/file route
    // (see http-guard for the threat model). Parsed or rendered, the
    // bytes come from the job workdir — the door rides along.
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to job data is not allowed" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    // soft links: the log lives in the original job's run record
    const effective = (await findEffectiveJob(id)) ?? null;
    const logId = effective ? effective.id : id;
    const url = new URL(request.url);
    const full = url.searchParams.get("full") === "1";

    // ---- remote branch: stream the tail from the cluster ---------------
    const rec = getRun(logId);
    if (rec?.remote) {
      const remote = await remoteLogTail(logId, { full });
      if (remote == null) {
        return NextResponse.json({ error: "No log (job has not run)" }, { status: 404 });
      }
      if (url.searchParams.get("format") === "raw") {
        return new NextResponse(remote.text, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="run-${logId}.out"`,
            "Cache-Control": "no-store",
          },
        });
      }
      return NextResponse.json({
        jobId: id,
        mode: full ? "full" : "tail",
        remote: true,
        tail: remote.text,
        totalLines: remote.totalLines,
        truncated: remote.truncated,
      });
    }

    if (url.searchParams.get("format") === "raw") {
      const raw = getLogTail(logId, { full: true });
      if (raw === null) {
        return NextResponse.json({ error: "No log (job has not run)" }, { status: 404 });
      }
      return new NextResponse(raw.text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="run-${logId}.out"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const tail = getLogTail(logId, { full });
    if (tail === null) {
      return NextResponse.json({ error: "No log (job has not run)" }, { status: 404 });
    }
    return NextResponse.json({
      jobId: id,
      mode: full ? "full" : "tail",
      tail: tail.text,
      totalLines: tail.totalLines,
      truncated: tail.truncated,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/log failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
