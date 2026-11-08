import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readPathrefTarget, pathrefHatchApplies } from "@/lib/relion/pathref";
import { resolveInsideJobWorkdir } from "@/lib/relion/jobfile";
import { isLocalRequest } from "@/lib/http-guard";
import { isMrcPath, readMrcHeader } from "@/lib/mrc";
import { sortCrops, type SubvolumeCrop, type ParentMapGeometry } from "@/lib/subvolume-catalog";
import { serverErrorReply } from "@/lib/server-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs/subvolume-list                           */
/* ------------------------------------------------------------------ */

/**
 * The crop shelf's listing (t892): every self-describing .mrc in the job's
 * SubVolumes/ folder, each row answering from its OWN header (t892's
 * evidence law — the file is the truth, the naming convention is prose):
 * dims (nx/ny/nz), start (the voxel offset in the map it was cut from —
 * the grandparent's space when the parent is itself a crop), bytes, mtime.
 *
 * The parent map's own header geometry rides along (`parent`) — the piece
 * the viewer's client cannot see (molstar speaks the grid's dims, never
 * the file's start fields) and the one number the re-anchor math needs to
 * turn a listed crop back into the anchored box (cropBoxFractions).
 *
 * The honest silences:
 *   · a file whose header refuses (a torn write, a non-map stray) is NOT
 *     listed — the shelf speaks geometry, the Files tab remains the raw
 *     listing (every file stays visible where it always was);
 *   · no SubVolumes/ folder yet answers an empty shelf, not an error —
 *     "no crops yet" is a state, not a failure;
 *   · a parent map whose header refuses answers `parent: null` — the
 *     rows still list (provenance reading), the anchor/download actions
 *     withhold client-side (no geometry, no guess).
 *
 * Hardening (the family ring, t251/t254's identical pair): workdir-derived
 * data — same-origin fetch metadata + pinned Host header; the map path
 * resolves through the SAME shared containment policy as the sibling
 * routes (resolveInsideJobWorkdir + the t1169 hatch gate), and the listing
 * itself never leaves the job's own SubVolumes/ folder — nothing the
 * viewer cannot reach can be named here.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to job data is not allowed" },
      { status: 403 }
    );
  }
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }

    // ---- the parent map's own geometry (the re-anchor's missing number) --
    const url = new URL(request.url);
    const rel = url.searchParams.get("path") ?? "";
    let parent: ParentMapGeometry | null = null;
    const resolved = resolveInsideJobWorkdir(run.workdir, rel);
    if (!("error" in resolved)) {
      let { abs, name } = resolved;
      if (pathrefHatchApplies(rel, name)) {
        const target = readPathrefTarget(abs);
        if (target) {
          abs = target;
          name = path.basename(target);
        }
      }
      if (isMrcPath(name)) {
        const head = readMrcHeader(abs);
        if (head) {
          parent = { dims: [head.nx, head.ny, head.nz], start: head.start };
        }
      }
    }

    // ---- the shelf's rows: only self-describing crops --------------------
    const subDir = path.join(run.workdir, "SubVolumes");
    const crops: SubvolumeCrop[] = [];
    let entries: string[] = [];
    try {
      entries = readdirSync(subDir);
    } catch {
      /* no SubVolumes folder yet — an empty shelf, not an error */
    }
    for (const name of entries) {
      if (!isMrcPath(name)) continue;
      const abs = path.join(subDir, name);
      const head = readMrcHeader(abs);
      if (!head) continue; // the shelf speaks geometry; strays stay in Files
      let bytes = 0;
      let mtimeMs = 0;
      try {
        const st = statSync(abs);
        bytes = st.size;
        mtimeMs = st.mtimeMs;
      } catch {
        continue; // vanished between readdir and stat — next ride lists it
      }
      crops.push({
        name,
        rel: `SubVolumes/${name}`,
        dims: [head.nx, head.ny, head.nz],
        start: head.start,
        bytes,
        mtimeMs,
      });
    }

    return NextResponse.json({ parent, crops: sortCrops(crops) });
  } catch (error) {
    return serverErrorReply("GET /api/jobs/[id]/outputs/subvolume-list", error);
  }
}
