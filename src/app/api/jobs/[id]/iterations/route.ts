import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getRun, type RunRecord } from "@/lib/relion/engine";
import {
  remoteLiveIterations,
  localIterations,
  LIVE_ITERATION_TYPES,
  scheduleRemoteStackRenders,
  stackRendered,
  STACK_NAME_RE,
  type IterationsPayload,
  type StackEntry,
} from "@/lib/remote/iteration-live";
import { readRemoteManifest } from "@/lib/remote/remote-files";

export const dynamic = "force-dynamic";

/**
 * t356 — the VIEW TRIGGER: a remote run whose rounds are not yet rendered
 * locally gets its stacks scheduled for download+convert in the background
 * (the user's「下载 mrcs 到本地再转图片」architecture, extended to runs that
 * finished BEFORE the finalize pipeline existed and to cold caches after a
 * restart). Zero-cost when everything is already rendered — a stat per
 * chip, absorbed while a pipeline is in flight, and the newest rounds land
 * first inside the scheduler. Sizes come from the sync-back manifest when
 * it exists (the budget's unit); a manifest-less legacy run pulls ONLY its
 * newest round blind (bounded). */
function triggerViewRender(
  jobId: string,
  run: RunRecord,
  stacks: StackEntry[],
  classesFile?: string | null
): void {
  // candidates: every chip + the payload's chosen classesFile (the FINAL
  // unmasked stack carries no round number, so it never joins the chips —
  // without this addendum it would never render proactively)
  const names = stacks.map((s) => s.file);
  if (classesFile && !names.includes(classesFile)) names.push(classesFile);
  if (names.length === 0) return;
  const manifest = readRemoteManifest(run.workdir);
  const sizeOf = new Map((manifest?.files ?? []).map((f) => [f.path, f.size]));
  const pending = names
    .filter((f) => STACK_NAME_RE.test(f) && !stackRendered(jobId, f))
    .map((f) => ({ file: f, size: sizeOf.get(f) ?? 0 }));
  if (pending.length === 0) return;
  const list = manifest ? pending : pending.slice(-1); // blind pulls stay bounded to the newest round
  scheduleRemoteStackRenders({
    jobId,
    connectionId: run.remote!.connectionId,
    remoteWorkdir: run.remote!.remoteWorkdir,
    files: list,
    reason: "view",
  });
}

/**
 * GET /api/jobs/[id]/iterations — the per-iteration view of a
 * classification job (t350, the user's live-results ask):
 *
 *   · RUNNING remote job → ONE SSH round: the iteration file list + the
 *     newest data star's class occupancy, counted ON THE CLUSTER by awk
 *     (zero star bytes cross the wire). 12s TTL cache in-process.
 *   · otherwise (finished / synced) → the same shape answered from the
 *     LOCAL mirror, mtime-cached.
 *
 * The images live at /api/jobs/[id]/iterations/image (one PNG per class
 * slice). Never a 500 on cluster trouble — 200 with { error } so the
 * gallery degrades to an honest note (the usage-route dialect).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access to job data is not allowed" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!LIVE_ITERATION_TYPES.has(job.type)) {
      return NextResponse.json({
        iterations: [],
        latest: null,
        classes: [],
        total: 0,
        classesFile: null,
        classesSlices: null,
        stacks: [],
        remote: false,
        error: `${job.type} jobs do not write per-iteration class snapshots`,
      } satisfies IterationsPayload);
    }
    const run = getRun(job.id);
    // live leg: a REMOTE run that has not finalized yet
    if (run?.remote && !run.done && (job.status === "running" || job.status === "pending")) {
      const force = new URL(request.url).searchParams.get("refresh") === "1";
      const payload = await remoteLiveIterations(job.id, { force });
      // t356 — the live view trigger: the newest round renders in the
      // background while the user watches, no chip click needed
      if (!payload.error && run.remote) {
        triggerViewRender(job.id, run, payload.stacks, payload.classesFile);
      }
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    // local leg: the mirror (finished job, or a local run) — jobId joins so
    // the chips bar also lists rounds whose sheets the live leg rendered
    // into the preview cache (the sync-back never lands per-iteration stacks)
    const workdir = run?.workdir;
    if (!workdir) {
      return NextResponse.json({
        iterations: [],
        latest: null,
        classes: [],
        total: 0,
        classesFile: null,
        classesSlices: null,
        stacks: [],
        remote: false,
      } satisfies IterationsPayload);
    }
    const payload = localIterations(workdir, job.id);
    // t355 — the REMOTE MERGE: a cluster-run classification whose mirror is
    // cold or stackless still deserves its whole gallery. The key-files
    // policy gates the class-average stacks at keyFileMb (a real 100-class
    // 2D run writes 25–100 MB stacks — they STAY on the cluster), and a
    // tight sync budget can leave the data stars behind too; the old local
    // leg answered classesFile: null ("no image" on every card) or no
    // iterations at all (an empty chips bar). ONE 12s-TTL'd SSH round fills
    // every gap the mirror leaves — the stack name, the occupancy, the
    // iteration list — while locally-answered fields stay local (they are
    // mtime-cached and free). Only a remote run pays the round, and only
    // when its mirror actually lacks something.
    const r = run.remote;
    if (
      r &&
      (payload.classesFile == null || payload.iterations.length === 0 || payload.classes.length === 0)
    ) {
      const remote = await remoteLiveIterations(job.id, {});
      if (!remote.error) {
        if (payload.classesFile == null) {
          payload.classesFile = remote.classesFile;
          payload.classesSlices = payload.classesSlices ?? remote.classesSlices;
        }
        if (payload.classes.length === 0) {
          payload.classes = remote.classes;
          payload.total = remote.total;
        }
        if (payload.iterations.length === 0) {
          payload.iterations = remote.iterations;
          payload.latest = remote.latest;
        }
        if (remote.stacks.length > 0) {
          // union by iteration: a local stack renders locally, a
          // cluster-only round pulls on demand through the sheet route
          const have = new Set(payload.stacks.map((s) => s.iter));
          payload.stacks = [...payload.stacks, ...remote.stacks.filter((s) => !have.has(s.iter))]
            .sort((a, b) => a.iter - b.iter);
        }
        // the payload now carries cluster-answered fields — say so
        payload.remote = true;
      }
    }
    // t354 — a finished REMOTE run whose cache is cold (fresh restart): the
    // mirror holds the data stars but no per-iteration stacks (the sync-back
    // slims them), so the chips bar would render empty and the user could
    // never trigger the on-demand pull. RELION's naming law says every
    // run_itNNN_data.star has a run_itNNN_classes.mrcs sibling — synthesize
    // those chips; the sheet route re-pulls each round from the cluster
    // (run.remote survives completion) or answers an honest 404.
    if (run.remote && payload.iterations.length > 0) {
      const have = new Set(payload.stacks.map((s) => s.iter));
      const synth = payload.iterations
        .filter((it) => !have.has(it))
        .map((it) => ({ iter: it, file: `run_it${String(it).padStart(3, "0")}_classes.mrcs` }));
      if (synth.length > 0) {
        payload.stacks = [...payload.stacks, ...synth].sort((a, b) => a.iter - b.iter);
      }
    }
    // t356 — the view trigger for finished/legacy runs: rounds the local
    // cache has not rendered yet are scheduled for download+convert; the
    // finalize pipeline usually already covered this (the trigger turns
    // into a free no-op after its first pass)
    if (run.remote) {
      triggerViewRender(job.id, run, payload.stacks, payload.classesFile);
    }
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/iterations failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
