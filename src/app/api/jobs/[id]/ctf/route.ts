import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { ctfMicrographRows } from "@/lib/compare-rows";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// t469 — the row shape and its block-aware parse moved to
// lib/compare-rows.ts (ONE grammar under the route, the dialog and the
// agent's compare_jobs); the route re-exports the shape for its readers.
export type { CtfMicrograph } from "@/lib/compare-rows";

export interface CtfSummary {
  count: number;
  meanDefocus: number;
  minDefocus: number;
  maxDefocus: number;
  maxAstigmatism: number;
  meanFom: number;
  worstResolution: number;
}

/**
 * GET /api/jobs/[id]/ctf — per-micrograph CTF fit quality of a CtfFind job
 * (defocus / astigmatism / figure-of-merit / fit resolution), straight from
 * the micrographs_ctf.star RELION writes into the job workdir.
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
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ micrographs: [], summary: null });
    }

    // t469 — the file hunt + cached parse live in lib/compare-rows.ts
    // (ONE grammar under the route, the dialog and the agent's tool)
    const parsed = ctfMicrographRows(run.workdir);
    if (parsed.length === 0) {
      return NextResponse.json({ micrographs: [], summary: null });
    }
    // the sort must NOT mutate the lib's cached array
    const micrographs = [...parsed].sort((a, b) => b.defocusU - a.defocusU);

    let summary: CtfSummary | null = null;
    if (micrographs.length > 0) {
      const defoci = micrographs.map((m) => (m.defocusU + m.defocusV) / 2);
      const foms = micrographs.filter((m) => m.fom > 0).map((m) => m.fom);
      const maxRes = micrographs.filter((m) => m.maxResolution > 0).map((m) => m.maxResolution);
      summary = {
        count: micrographs.length,
        meanDefocus: defoci.reduce((s, d) => s + d, 0) / defoci.length,
        minDefocus: Math.min(...defoci),
        maxDefocus: Math.max(...defoci),
        maxAstigmatism: Math.max(...micrographs.map((m) => m.astigmatism)),
        meanFom: foms.length > 0 ? foms.reduce((s, f) => s + f, 0) / foms.length : 0,
        worstResolution: maxRes.length > 0 ? Math.max(...maxRes) : 0,
      };
    }

    return NextResponse.json({ jobId: id, micrographs, summary });
  } catch (error) {
    console.error("GET /api/jobs/[id]/ctf failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
