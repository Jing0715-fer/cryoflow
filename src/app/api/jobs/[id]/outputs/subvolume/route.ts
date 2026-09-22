import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readPathrefTarget } from "@/lib/relion/pathref";
import { resolveInsideJobWorkdir } from "@/lib/relion/jobfile";
import { isLocalRequest } from "@/lib/http-guard";
import { isMrcPath, readMrcHeader, readMrcSubvolume } from "@/lib/mrc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs/subvolume                                */
/* ------------------------------------------------------------------ */

/**
 * The clip box, written out: crop a box out of a job's MRC map and
 * return it as a standalone .mrc download — the RELION box-subregion
 * workflow (a region of interest becomes its own map for focused
 * processing).
 *
 * Hardening (t254, same ring as the sibling reads): this route serves
 * CONTENT BYTES derived from the job workdir — same-origin fetch
 * metadata + pinned Host header, the identical pair /outputs/file and
 * the twelve data routes wear. The browser-always-sent headers a
 * drive-by page cannot control, with Host pinning catching the
 * DNS-rebinding case the origin check alone passes.
 *
 * The box arrives as FRACTIONS (0…1 per axis, lo < hi) — the client
 * resolves the clip's invert side before calling, so the API speaks
 * plain geometry. Fractions become half-open voxel ranges by
 * floor/ceil: any non-degenerate fraction interval maps to at least
 * one voxel, and round-tripping through the 2D overlay's percentages
 * stays honest.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
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
    if (!run?.workdir) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }

    const url = new URL(request.url);
    const rel = url.searchParams.get("path") ?? "";
    const resolved = resolveInsideJobWorkdir(run.workdir, rel);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    let { abs, name } = resolved;

    // pathref escape hatch — same policy as /outputs/file: engine-written
    // markers for UNLINKABLE import sources (cross-drive/UNC) resolve to
    // the real file, so imported maps can be cropped like on-disk ones.
    if (name.endsWith(".pathref")) {
      const target = readPathrefTarget(abs);
      if (!target) {
        return NextResponse.json({ error: "Broken path reference (source moved or deleted)" }, { status: 404 });
      }
      abs = target;
      name = path.basename(target);
    }

    if (!isMrcPath(name)) {
      return NextResponse.json(
        { error: "Sub-volume export is for MRC maps only" },
        { status: 400 }
      );
    }

    const head = readMrcHeader(abs);
    if (!head) {
      return NextResponse.json(
        { error: "Map header is not a supported MRC volume" },
        { status: 400 }
      );
    }

    // fractions → half-open voxel ranges. floor/ceil keeps every
    // non-degenerate interval non-empty and clamping keeps it in-grid.
    const frac = (key: string): number | null => {
      const raw = url.searchParams.get(key);
      if (raw === null || raw.trim() === "") return null;
      const v = Number(raw);
      return Number.isFinite(v) ? v : null;
    };
    const x0 = frac("x0"), x1 = frac("x1");
    const y0 = frac("y0"), y1 = frac("y1");
    const z0 = frac("z0"), z1 = frac("z1");
    if (x0 === null || x1 === null || y0 === null || y1 === null || z0 === null || z1 === null) {
      return NextResponse.json(
        { error: "Box fractions x0,x1,y0,y1,z0,z1 are all required numbers in 0–1" },
        { status: 400 }
      );
    }
    if (
      !(x0 >= 0 && x1 <= 1 && x0 < x1) ||
      !(y0 >= 0 && y1 <= 1 && y0 < y1) ||
      !(z0 >= 0 && z1 <= 1 && z0 < z1)
    ) {
      return NextResponse.json(
        { error: "Box fractions must satisfy 0 ≤ lo < hi ≤ 1 on every axis" },
        { status: 400 }
      );
    }
    const box = {
      ix0: Math.max(0, Math.floor(x0 * head.nx)), ix1: Math.min(head.nx, Math.ceil(x1 * head.nx)),
      iy0: Math.max(0, Math.floor(y0 * head.ny)), iy1: Math.min(head.ny, Math.ceil(y1 * head.ny)),
      iz0: Math.max(0, Math.floor(z0 * head.nz)), iz1: Math.min(head.nz, Math.ceil(z1 * head.nz)),
    };

    const result = readMrcSubvolume(abs, box);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const stem = name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]/g, "_") || "map";
    const [sx, sy, sz] = result.dims;
    const [ox, oy, oz] = result.origin;
    const safeName = `${stem}_crop_${ox}-${ox + sx}_${oy}-${oy + sy}_${oz}-${oz + sz}.mrc`;
    return new NextResponse(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(result.bytes.length),
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return NextResponse.json({ error: "Sub-volume export failed" }, { status: 500 });
  }
}
