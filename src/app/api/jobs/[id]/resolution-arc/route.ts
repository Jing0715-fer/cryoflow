import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import {
  parseCurrentResolution,
  resolutionArcOf,
  type ResolutionPoint,
} from "@/lib/resolution-arc";
import { resolutionArcFromWorkdir } from "@/lib/convergence-rows";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/resolution-arc — the fifth compare question's data
 * plane (t456): one refinement run, its OWN rounds' FSC estimates.
 *
 * The law mirrors the fsc route's model-star dialect: every
 * run_itNNN_half1_model.star (gold) / run_itNNN_model.star (plain) in the
 * run's workdir carries data_model_general._rlnCurrentResolution — the
 * iteration's own estimate. Rounds without the column simply don't join
 * the arc (an old run wrote no model stars; the arc reads what the run
 * actually wrote, never invents). The run's FINAL estimate rides as
 * `reported` (run_model.star's own value — what the card badge says).
 *
 * The workdir is the run record's own (the fsc route's law): a completed
 * run's mirror. No record, no mirror → an honest empty arc.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const empty = {
      jobId: job.id,
      rounds: [] as ResolutionPoint[],
      reported: null as number | null,
    };

    // Hardening (t251 sibling): workdir-derived data — same drive-by door
    // as the fsc route (see http-guard for the threat model). The bytes
    // come from the job workdir — the door rides along.
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to job data is not allowed" },
        { status: 403 }
      );
    }

    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }
    const workdir = run.workdir;

    // t470 — the scan itself moved to lib/convergence-rows.ts so the agent's
    // check_convergence reads the SAME points through the SAME grammar
    // (t469's one-parse-many-faces law); this route keeps guard + shape.
    const points: ResolutionPoint[] = resolutionArcFromWorkdir(workdir);

    let reported: number | null = null;
    const finalModel = path.join(workdir, "run_model.star");
    if (existsSync(finalModel)) {
      try {
        reported = parseCurrentResolution(readFileSync(finalModel, "utf8"));
      } catch {
        reported = null;
      }
    }

    return NextResponse.json({
      jobId: job.id,
      rounds: resolutionArcOf(points),
      reported,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/resolution-arc failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
