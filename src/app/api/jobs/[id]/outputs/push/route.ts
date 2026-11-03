import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { isLocalRequest } from "@/lib/http-guard";
import { walkWorkdir } from "@/lib/relion/outputs-list";
import {
  pushBooksToTwin,
  pushPolicyContext,
  resolvePushWitness,
  twinWorkdirFor,
} from "@/lib/remote/twin-push";
import { planPush, describePushSkip } from "@/lib/remote/push-policy";
import { badJsonReply, serverErrorReply } from "@/lib/server-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/outputs/push — the twin-refresh push leg (t1137).
 *
 * The t424 sync route brings cluster bytes home; this door is its
 * REVERSE face: an app-side native's fresh book (the engine's local
 * lane writes under RELION_DIR) refreshes the CLUSTER twin its world
 * carries. The seeder's stale twin (select's `particles_select.star`
 * cluster-side, 96 rows of the t1135 two-dot tilt) is the door's
 * reason: a fossil retires through a WRITER, not a hand edit — and the
 * writer is the product's own push (remoteUpload's head -c integrity
 * protocol), never an artifact edit.
 *
 * The twin address is the t396 deterministic formula (a fact about the
 * JOB — remoteWorkdirForJob), never client-supplied. The connection is
 * a witness question: an explicit connectionId, else the project's
 * most recent remote-run sibling. The sync policy's caps/budgets apply
 * in reverse (push-policy.ts: metadata books push, image stacks never,
 * per-file cap and whole-push budget always).
 *
 * Security posture (the family hardening law):
 *   - isLocalRequest (drive-by door + Host pin)
 *   - every path must be workdir-relative with no `..` segments — the
 *     route reads ONLY inside this job's own workdir
 *   - the twin address is DERIVED (job row + connection), so no body
 *     field can aim the write anywhere else
 *
 * Body: { paths: string[], connectionId?: string } — workdir-relative,
 * 1..8 per call (the t424 chunk doctrine, reversed).
 * Response: {
 *   ok: true, jobId, pushed,
 *   twinWorkdir,                       // the address the bytes rode to
 *   witness: { connectionId, name, source },
 *   results: [{ path, ok, bytes?, error? }]
 * }
 *
 * GET /api/jobs/[id]/outputs/push — the preflight probe: the witness,
 * the twin address and the planner's full classification of the local
 * workdir (candidates + spoken skips), so the UI bar renders only when
 * a push is real and the unit pins the ONE classification.
 * Response: {
 *   ok: true, jobId,
 *   witness: { connectionId, name, host, source } | null,
 *   twinWorkdir: string | null,
 *   candidates: [{ path, size }],          // the take-list
 *   skips: [{ path, size, why, word, remote? }],
 *   truncated
 * }
 */

const MAX_PATHS_PER_CALL = 8;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to job data is not allowed" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ error: "No local workdir for this job" }, { status: 400 });
    }

    let body: { paths?: unknown; connectionId?: unknown } = {};
    try {
      body = (await request.json()) ?? {};
    } catch (error) {
      return badJsonReply("POST /api/jobs/[id]/outputs/push", error);
    }

    const bodyPaths = body?.paths;
    if (
      !Array.isArray(bodyPaths) ||
      bodyPaths.length === 0 ||
      bodyPaths.length > MAX_PATHS_PER_CALL ||
      bodyPaths.some((p) => typeof p !== "string" || p.length === 0)
    ) {
      return NextResponse.json(
        { error: `paths must be a non-empty array of at most ${MAX_PATHS_PER_CALL} strings` },
        { status: 400 }
      );
    }
    // dedupe while preserving order — a duplicated path is one push, not two
    const paths = [...new Set(bodyPaths as string[])];

    const explicitId =
      typeof body?.connectionId === "string" && body.connectionId
        ? body.connectionId
        : undefined;
    const witness = resolvePushWitness(job.projectId, explicitId);
    if (!witness) {
      return NextResponse.json(
        { error: "No cluster connection for this project — save one in Remote clusters or dispatch one remote run first (the push leg rides a witness)" },
        { status: 400 }
      );
    }

    const { rows, pushed, twinWorkdir } = await pushBooksToTwin({
      witness,
      workdir: run.workdir,
      jobType: job.type,
      jobId: job.id,
      projectId: job.projectId,
      paths,
    });

    if (pushed > 0) {
      console.log(
        `twin-push: ${pushed} book(s) rode to ${twinWorkdir} on ${witness.conn.name} (the twin-refresh push leg, t1137)`
      );
    }

    return NextResponse.json({
      ok: true,
      jobId: id,
      pushed,
      twinWorkdir,
      witness: {
        connectionId: witness.conn.id,
        name: witness.conn.name,
        source: witness.source,
      },
      results: rows,
    });
  } catch (error) {
    return serverErrorReply("POST /api/jobs/[id]/outputs/push", error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to job data is not allowed" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ error: "No local workdir for this job" }, { status: 400 });
    }

    const witness = resolvePushWitness(job.projectId);
    if (!witness) {
      // the honest absence: an app-only project has no cluster home
      return NextResponse.json({
        ok: true,
        jobId: id,
        witness: null,
        twinWorkdir: null,
        candidates: [],
        skips: [],
        truncated: false,
      });
    }
    const twinWorkdir = await twinWorkdirFor(
      witness,
      job.projectId,
      job.type,
      job.id
    );
    const ctx = pushPolicyContext(witness, twinWorkdir);
    const walked = walkWorkdir(run.workdir);
    const plan = planPush(
      walked.files.map((f) => ({ rel: f.path, size: f.size })),
      ctx
    );

    return NextResponse.json({
      ok: true,
      jobId: id,
      witness: {
        connectionId: witness.conn.id,
        name: witness.conn.name,
        host: witness.conn.host,
        source: witness.source,
      },
      twinWorkdir,
      candidates: plan.take.map((e) => ({ path: e.rel, size: e.size })),
      skips: plan.skip.map((e) => {
        const native = walked.files.find((f) => f.path === e.rel);
        return {
          path: e.rel,
          size: e.size,
          why: e.why,
          word: describePushSkip(e, ctx),
          remote: native?.remote,
        };
      }),
      truncated: walked.truncated,
    });
  } catch (error) {
    return serverErrorReply("GET /api/jobs/[id]/outputs/push", error);
  }
}
