import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import {
  ensureClassStackPngs,
  readCachedSlicePng,
  localStackExists,
  STACK_NAME_RE,
} from "@/lib/remote/iteration-live";
import { renderMrcSlicePng } from "@/lib/mrc";
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
    if (!run?.workdir) {
      return NextResponse.json({ error: "No workdir for this job" }, { status: 400 });
    }

    // fast path: already rendered (either leg)
    const cached = readCachedSlicePng(job.id, file, slice);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
      });
    }

    // local mirror has the stack (finished job) → render in place, and
    // cache the whole stack's slices the same way the remote leg does
    const localPath = path.join(run.workdir, file);
    if (localStackExists(run.workdir, file)) {
      const png = await renderMrcSlicePng(localPath, slice);
      if (!png) {
        return NextResponse.json({ error: "could not render this class average" }, { status: 400 });
      }
      return new NextResponse(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" },
      });
    }

    // live leg: pull once, render all slices, keep PNGs only
    const r = run.remote;
    if (!r || run.done) {
      return NextResponse.json({ error: "class stack not available locally" }, { status: 404 });
    }
    const n = await ensureClassStackPngs(r.connectionId, r.remoteWorkdir, job.id, file);
    if (n == null) {
      return NextResponse.json(
        { error: `could not fetch ${file} from the cluster (the run may still be writing it)` },
        { status: 404 }
      );
    }
    if (slice >= n) {
      return NextResponse.json({ error: `slice ${slice} outside this stack (${n} slices)` }, { status: 400 });
    }
    const png = readCachedSlicePng(job.id, file, slice);
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
