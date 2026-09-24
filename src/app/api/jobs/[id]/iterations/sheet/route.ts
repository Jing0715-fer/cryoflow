import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import {
  ensureIterationAssets,
  readCachedSheetPng,
  cacheSheetPng,
  localStackExists,
  STACK_NAME_RE,
} from "@/lib/remote/iteration-live";
import { renderClassSheetPng } from "@/lib/mrc";
import { displayPolarityFor } from "@/lib/render-polarity";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[id]/iterations/sheet?file=run_it007_classes.mrcs
 * — ONE grid image for a whole iteration round (t354, the user's
 * 「每一轮的 2D 结果生成一张图片，可以在本地的 UI 中查看」): every class
 * average of that round side by side, the way relion_display would show
 * the stack. Lazy by design — a sheet is pulled/rendered the FIRST time
 * the user lands on its chip, never eagerly for all rounds.
 *
 *   · cache hit (the live leg rendered it during the run) → straight PNG
 *   · LOCAL stack in the mirror (finished job) → rendered in place and
 *     cached under the same key the live leg uses
 *   · REMOTE run — running OR done → one on-demand pull (a few MB, shared
 *     in-flight with the per-slice route). A finished run's history is
 *     only viewable through this door: the sync-back's slimming never
 *     lands the per-iteration stacks locally, so after a restart (cache
 *     cold) the cluster is the only honest source left.
 *
 * Cache-Control: the stack NAME carries the iteration number, so a sheet
 * URL is immutable content — private caching is safe (the image route's
 * dialect).
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
    const file = new URL(request.url).searchParams.get("file") ?? "";
    if (!STACK_NAME_RE.test(file)) {
      return NextResponse.json({ error: "invalid stack name" }, { status: 400 });
    }
    const run = getRun(job.id);
    if (!run?.workdir) {
      return NextResponse.json({ error: "No workdir for this job" }, { status: 400 });
    }
    // t367 — set by the local leg below when it fell through on a corrupt
    // mirror copy (the remote pull then heals it in place)
    let mirrorHealPath: string | null = null;
    // t380 — display polarity pinned by the dataset's import job
    const polarity = await displayPolarityFor(job);

    // fast path: rendered during the run (or a previous view)
    const cached = readCachedSheetPng(job.id, file, polarity);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
      });
    }

    // local mirror holds this stack (finished job whose sync-back kept it)
    // → render in place, cached under the live leg's key (survives the
    // t333 re-dispatch wipe that clears the mirror's products).
    // t367 — a local copy whose render FAILS (the ghost shape: a corrupt
    // leftover adopted by a size-only sync-back) falls through to the
    // remote leg when the run still has a cluster behind it: the fresh
    // pull answers the sheet AND heals the mirror copy in place. A
    // local-only run keeps the honest 400.
    if (localStackExists(run.workdir, file)) {
      const localPath = path.join(run.workdir, file);
      const rendered = await renderClassSheetPng(localPath, undefined, polarity);
      if (rendered) {
        cacheSheetPng(job.id, file, rendered.png, polarity);
        return new NextResponse(new Uint8Array(rendered.png), {
          headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
        });
      }
      if (!run.remote) {
        return NextResponse.json({ error: "could not render this iteration's sheet" }, { status: 400 });
      }
      // fall through: the cluster is the honest source left (t367)
      mirrorHealPath = localPath;
    }

    // remote pull (running OR done — see the route doc). Done runs are the
    // restart case: cold cache, the cluster is the only source left.
    // t358 — a refusal carries its HONEST reason (missing / truncated /
    // over-cap with the actual size / unreadable / stat-failed): the old
    // one-size "may not exist on the cluster" 404 made every wire failure
    // look like a missing file — the field report's invisible root cause.
    const r = run.remote;
    if (!r) {
      return NextResponse.json({ error: "iteration sheet not available locally" }, { status: 404 });
    }
    const assets = await ensureIterationAssets(r.connectionId, r.remoteWorkdir, job.id, file, {
      polarity,
      ...(mirrorHealPath ? { healMirrorPath: mirrorHealPath } : {}),
    });
    if (assets.failure) {
      return NextResponse.json(
        { error: assets.failure.message, reason: assets.failure.reason },
        { status: 404 }
      );
    }
    if (!assets.sheet) {
      return NextResponse.json({ error: "rendering produced no sheet" }, { status: 500 });
    }
    return new NextResponse(new Uint8Array(assets.sheet), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/iterations/sheet failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
