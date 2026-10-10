import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { isLocalRequest } from "@/lib/http-guard";
import {
  fetchRemoteFileIntoWorkdir,
  readRemoteManifest,
} from "@/lib/remote/remote-files";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/outputs/sync — batch bring-home for cluster-resident
 * outputs (t424).
 *
 * The key-files sync policy leaves bulky outputs (maps, particle stacks,
 * micrographs) on the cluster; the t289 lazy leg fetches exactly ONE file
 * per explicit click. A real session leaves HUNDREDS of stacks there —
 * clicking each tile is torture. This route is the batch leg: the client
 * drives it in small chunks (the app's client-driven doctrine — no SSE,
 * no server-side job), each call fetches up to MAX_PATHS_PER_CALL files
 * sequentially over SSH and reports per-file verdicts.
 *
 * Security posture (the family hardening law):
 *   - isLocalRequest (drive-by door + Host pin)
 *   - every requested path must be an EXACT entry of the job's remote
 *     manifest — the route cannot be talked into fetching anything the
 *     cluster finalize ledger does not already name
 *   - relative-path hygiene (no leading /, no .. segments) on top
 *
 * Body: { paths: string[] } — workdir-relative, 1..8 per call.
 * Response: {
 *   ok: true, jobId,
 *   results: [{ path, ok, bytes, error? }],   // bytes 0 + ok = already home
 *   remaining,  // manifest entries still remote after this batch
 *   total       // manifest entries the ledger names
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
    if (!run.remote) {
      return NextResponse.json(
        { error: "Not a remote run — nothing to bring home" },
        { status: 400 }
      );
    }

    const manifest = readRemoteManifest(run.workdir);
    if (!manifest || manifest.files.length === 0) {
      return NextResponse.json(
        { error: "No remote manifest for this job" },
        { status: 400 }
      );
    }

    let bodyPaths: unknown;
    try {
      bodyPaths = (await request.json())?.paths;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
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
    // dedupe while preserving order — a duplicated path is one fetch, not two
    const paths = [...new Set(bodyPaths as string[])];

    const ledger = new Map(manifest.files.map((f) => [f.path, f.size]));
    const results: { path: string; ok: boolean; bytes?: number; error?: string }[] = [];

    for (const rel of paths) {
      // defensive hygiene — the manifest is trusted (finalize wrote it), but
      // a tampered ledger must not become a traversal door
      if (rel.startsWith("/") || rel.split("/").includes("..")) {
        results.push({ path: rel, ok: false, error: "Path rejected" });
        continue;
      }
      if (!ledger.has(rel)) {
        results.push({
          path: rel,
          ok: false,
          error: "Not in the remote manifest — only files the cluster finalize ledger names can be fetched",
        });
        continue;
      }
      try {
        const res = await fetchRemoteFileIntoWorkdir(
          { workdir: run.workdir, remote: run.remote },
          rel
        );
        if (res.ok) {
          results.push({ path: rel, ok: true, bytes: res.bytes });
        } else {
          results.push({ path: rel, ok: false, error: res.error ?? "Fetch failed" });
        }
      } catch (err) {
        results.push({
          path: rel,
          ok: false,
          error: err instanceof Error ? err.message : "Fetch failed",
        });
      }
    }

    // the honest remaining count: ledger entries whose local copy is absent
    // (a failed fetch keeps its entry; a successful one leaves the set)
    let remaining = 0;
    for (const entry of manifest.files) {
      if (!existsSync(`${run.workdir}/${entry.path}`)) remaining += 1;
    }

    return NextResponse.json({
      ok: true,
      jobId: id,
      results,
      remaining,
      total: manifest.files.length,
    });
  } catch (error) {
    console.error("POST /api/jobs/[id]/outputs/sync failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
