import { NextRequest, NextResponse } from "next/server";
import { findEffectiveJob } from "@/lib/link";
import { isLocalRequest } from "@/lib/http-guard";
// t515 — the assembly moved to ONE well (lib/relion/job-outputs): the
// agent's products face drinks the same cup, twins don't fork. The route
// is now the protocol shell only — the 403 gate, the 404 voice, the
// force-dynamic flag; the walk, the manifest join, the key numbers, the
// warnings and the listing note live in the lib.
import { computeJobOutputs } from "@/lib/relion/job-outputs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs                                          */
/* (types + the walk live in lib/relion/outputs-list since t501;       */
/*  the whole assembly lives in lib/relion/job-outputs since t515)     */
/* ------------------------------------------------------------------ */

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
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(
      computeJobOutputs({ id: job.id, type: job.type, status: job.status })
    );
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
