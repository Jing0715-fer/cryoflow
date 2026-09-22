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

    // fast path: rendered during the run (or a previous view)
    const cached = readCachedSheetPng(job.id, file);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
      });
    }

    // local mirror holds this stack (finished job whose sync-back kept it)
    // → render in place, cached under the live leg's key (survives the
    // t333 re-dispatch wipe that clears the mirror's products)
    if (localStackExists(run.workdir, file)) {
      const rendered = await renderClassSheetPng(path.join(run.workdir, file));
      if (!rendered) {
        return NextResponse.json({ error: "could not render this iteration's sheet" }, { status: 400 });
      }
      cacheSheetPng(job.id, file, rendered.png);
      return new NextResponse(new Uint8Array(rendered.png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
      });
    }

    // remote pull (running OR done — see the route doc). Done runs are the
    // restart case: cold cache, the cluster is the only source left.
    const r = run.remote;
    if (!r) {
      return NextResponse.json({ error: "iteration sheet not available locally" }, { status: 404 });
    }
    const assets = await ensureIterationAssets(r.connectionId, r.remoteWorkdir, job.id, file);
    if (assets == null) {
      return NextResponse.json(
        { error: `could not fetch ${file} from the cluster (it may not exist on this run)` },
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
