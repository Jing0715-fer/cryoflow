import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import {
  ensureIterationAssets,
  readCachedSlicePng,
  localStackExists,
  STACK_NAME_RE,
} from "@/lib/remote/iteration-live";
import { derivedRemoteTargetForJob, localMirrorWorkdirForJob } from "@/lib/remote/derived-target";
import { renderMrcSlicePng } from "@/lib/mrc";
import { displayPolarityFor } from "@/lib/render-polarity";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[id]/iterations/image?file=run_it007_classes.mrcs&slice=3
 * — one class-average PNG (t350).
 *
 *   · RUNNING remote job → the stack is pulled ONCE per iteration file
 *     name (in-flight requests share the pull), every slice rendered to a
 *     small PNG, the MB-scale stack DELETED after rendering (the t339
 *     slimming contract: thumbnails persist, stacks do not).
 *   · LOCAL stack (finished job) → rendered straight from the mirror.
 *   · t355 — a FINISHED remote run with a cold cache pulls too (the sheet
 *     route's dialect): the cluster is the only honest source left once
 *     the key-files caps kept the stacks remote and the preview cache
 *     went cold.
 *
 * Cache-Control: the stack NAME carries the iteration number, so a slice
 * URL is immutable content — private caching is safe and keeps the gallery
 * snappy across polls.
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
    const url = new URL(request.url);
    const file = url.searchParams.get("file") ?? "";
    const slice = Number(url.searchParams.get("slice") ?? "0");
    if (!STACK_NAME_RE.test(file) || !Number.isInteger(slice) || slice < 0 || slice > 100_000) {
      return NextResponse.json({ error: "invalid stack name or slice" }, { status: 400 });
    }
    const run = getRun(job.id);
    // t474 — the workdir is a fact about the JOB, not the run (the t396
    // verdict, applied to the render lane): a Reset-to-idle job whose
    // sync-back landed the stacks keeps rendering them locally instead
    // of dying on the old "No workdir for this job" 400.
    const workdir = run?.workdir ?? localMirrorWorkdirForJob(job);
    // t380 — display polarity pinned by the dataset's import job
    // (negative-stain checkbox). Keyed into the PNG cache so toggling it
    // re-renders instead of serving stale wrong-polarity bytes.
    const polarity = await displayPolarityFor(job);

    // fast path: already rendered (either leg)
    const cached = readCachedSlicePng(job.id, file, slice, polarity);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
      });
    }

    // local mirror has the stack (finished job) → render in place, and
    // cache the whole stack's slices the same way the remote leg does.
    // t367 — a local copy that FAILS to render (the ghost shape: a corrupt
    // leftover adopted by a size-only sync-back) is no longer a verdict —
    // when the run still has a cluster behind it, fall through to the
    // remote leg: the fresh pull answers the render AND (healMirrorPath)
    // replaces the corrupt mirror copy in place, so this never happens
    // twice. Only a local-only run keeps the honest 400.
    const localPath = path.join(workdir, file);
    if (localStackExists(workdir, file)) {
      const png = await renderMrcSlicePng(localPath, slice, undefined, polarity);
      if (png) {
        return new NextResponse(new Uint8Array(png), {
          headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
        });
      }
      if (!run?.remote) {
        return NextResponse.json({ error: "could not render this class average" }, { status: 400 });
      }
      // fall through: the cluster is the honest source left (t367)
    }

    // live leg: pull once, render all slices (+ the t354 sheet), keep PNGs only
    // t355 — a DONE remote run pulls too (the sheet route's dialect since
    // t354): after completion the mirror usually has no stacks (the key-files
    // caps leave them on the cluster) and a cold preview cache means the
    // cluster is the ONLY honest source left. The old `run.done` rejection
    // 404'd every per-class image of a finished cluster run — the exact
    // 「看不到结果的图片」 the field report carried.
    // t358 — a refusal carries its HONEST reason (the sheet route's dialect):
    // missing / truncated / over-cap / unreadable / stat-failed, verbatim.
    // t474 — the pull target no longer dies with the run record: a
    // record-bearing run pulls through its own remote target, a record-
    // less (reset) job through the DERIVED one (the project binding +
    // the dispatcher's formula) — the stacks did not vanish with the
    // record.
    let pullTarget: { connectionId: string; remoteWorkdir: string } | null = null;
    if (run?.remote) {
      pullTarget = { connectionId: run.remote.connectionId, remoteWorkdir: run.remote.remoteWorkdir };
    } else {
      pullTarget = await derivedRemoteTargetForJob(job);
    }
    if (!pullTarget) {
      return NextResponse.json({ error: "class stack not available locally" }, { status: 404 });
    }
    const assets = await ensureIterationAssets(pullTarget.connectionId, pullTarget.remoteWorkdir, job.id, file, {
      polarity,
      // t367 — heal the mirror copy in place when the pull lands good bytes
      ...(localStackExists(workdir, file) ? { healMirrorPath: localPath } : {}),
      // t474 — a record-less pull words the gate's refusals for the job
      // row's own world (a completed-then-reset job's stacks are settled)
      ...(run == null ? { runDoneHint: job.status === "completed" } : {}),
    });
    if (assets.failure) {
      return NextResponse.json(
        { error: assets.failure.message, reason: assets.failure.reason },
        { status: 404 }
      );
    }
    if (slice >= assets.slices) {
      return NextResponse.json({ error: `slice ${slice} outside this stack (${assets.slices} slices)` }, { status: 400 });
    }
    const png = readCachedSlicePng(job.id, file, slice, polarity);
    if (!png) {
      return NextResponse.json({ error: "rendering produced no image" }, { status: 500 });
    }
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/iterations/image failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
