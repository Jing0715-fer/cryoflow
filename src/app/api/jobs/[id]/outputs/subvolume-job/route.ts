import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { ensureActiveProject, toJobDTO } from "@/lib/seed";
import { defaultParams, defaultPorts, jobType } from "@/lib/workflow";
import { portsValid, persistPortEdge } from "@/lib/edge-ports";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readPathrefTarget } from "@/lib/relion/pathref";
import { resolveInsideJobWorkdir } from "@/lib/relion/jobfile";
import { isMrcPath, readMrcHeader, readMrcSubvolume } from "@/lib/mrc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* POST /api/jobs/[id]/outputs/subvolume-job                           */
/* ------------------------------------------------------------------ */

/**
 * The crop joins the PIPELINE: materialize the kept clip box as a real
 * .mrc file in the parent job's SubVolumes/ folder, then create an Import
 * Map (mapimport) job pointed at it and wire the edge parent→import — the
 * RELION box-subregion workflow in one action (crop → focused processing).
 *
 * Threat-model ledger (t252 doctrine, applied to this write): the handler
 * REQUIRES a parseable JSON body — fractions and the map path live in it —
 * so a cross-site HTML form (urlencoded only) and a no-cors fetch cannot
 * reach state: request.json() throws and the route 400s before anything is
 * written. Cross-site JS with a JSON body is spec-blocked too (CORS-mode
 * POST needs a preflight; the app answers zero OPTIONS handlers). Same
 * class as restore/layout/switch — self-defending, honestly absent door.
 *
 * The geometry contract is the GET sibling's own (fractions 0…1, lo < hi,
 * floor/ceil → voxels) and the map is resolved through the SAME shared
 * containment policy (resolveInsideJobWorkdir + the pathref escape hatch),
 * so anything the viewer can show, the pipeline can consume — and nothing
 * the viewer cannot reach can be materialized.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parent = await findEffectiveJob(id); // resolves soft links to the original
    if (!parent) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(parent.id);
    if (!run?.workdir) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }

    // strict parse (no .catch tolerance): an unparseable body is exactly
    // the drive-by shape, and it must die here — ledger doctrine above
    let body: {
      path?: unknown;
      x0?: unknown;
      x1?: unknown;
      y0?: unknown;
      y1?: unknown;
      z0?: unknown;
      z1?: unknown;
      name?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON: { path, x0,x1,y0,y1,z0,z1 }" }, { status: 400 });
    }

    const rel = typeof body.path === "string" ? body.path : "";
    if (!rel) {
      return NextResponse.json({ error: "The map path is required — which map was clipped?" }, { status: 400 });
    }
    const resolved = resolveInsideJobWorkdir(run.workdir, rel);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    let { abs, name } = resolved;

    // pathref escape hatch — same policy as the GET sibling: engine-written
    // markers for UNLINKABLE import sources resolve to the real file, so
    // imported maps can be cropped and sent onward like on-disk ones.
    if (name.endsWith(".pathref")) {
      const target = readPathrefTarget(abs);
      if (!target) {
        return NextResponse.json({ error: "Broken path reference (source moved or deleted)" }, { status: 404 });
      }
      abs = target;
      name = path.basename(target);
    }

    if (!isMrcPath(name)) {
      return NextResponse.json({ error: "Sub-volume send is for MRC maps only" }, { status: 400 });
    }
    const head = readMrcHeader(abs);
    if (!head) {
      return NextResponse.json({ error: "Map header is not a supported MRC volume" }, { status: 400 });
    }

    const frac = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const x0 = frac(body.x0), x1 = frac(body.x1);
    const y0 = frac(body.y0), y1 = frac(body.y1);
    const z0 = frac(body.z0), z1 = frac(body.z1);
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

    // ---- materialize: the crop becomes a FILE in the parent workdir -----
    // Same naming convention as the GET download (stem + voxel box) —
    // identical geometry re-sent overwrites the same file (idempotent), and
    // the Files tab serves SubVolumes/ like any other output folder.
    const stem = name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]/g, "_") || "map";
    const [sx, sy, sz] = result.dims;
    const [ox, oy, oz] = result.origin;
    const cropName = `${stem}_crop_${ox}-${ox + sx}_${oy}-${oy + sy}_${oz}-${oz + sz}.mrc`;
    const subDir = path.join(run.workdir, "SubVolumes");
    mkdirSync(subDir, { recursive: true });
    const cropAbs = path.join(subDir, cropName);
    writeFileSync(cropAbs, result.bytes);

    // ---- the Import Map job ---------------------------------------------
    const spec = jobType("mapimport");
    if (!spec) {
      return NextResponse.json({ error: "mapimport job type is not registered" }, { status: 500 });
    }
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    if (parent.projectId !== active.project.id) {
      return NextResponse.json({ error: "Job not found in the active project" }, { status: 404 });
    }
    // land in the PARENT's workspace — the crop belongs where its source lives
    let workspaceId = parent.workspaceId;
    if (!workspaceId) {
      const first = await db.workspace.findFirst({
        where: { projectId: active.project.id },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
      workspaceId = first?.id ?? null;
    }

    const count = await db.job.count({
      where: { projectId: active.project.id, type: "mapimport" },
    });
    const customName =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim().slice(0, 120)
        : `Sub-volume ${stem}`;
    const nameExists = await db.job.findFirst({
      where: { projectId: active.project.id, name: customName },
      select: { id: true },
    });
    const jobName = nameExists ? `${customName} ${count + 1}` : customName;

    // place the card BELOW-RIGHT of its parent — the graph tells the
    // derivation story spatially, not by random scatter
    const job = await db.job.create({
      data: {
        projectId: active.project.id,
        workspaceId,
        type: "mapimport",
        name: jobName,
        x: parent.x + 240,
        y: parent.y + 60,
        params: JSON.stringify({ ...defaultParams("mapimport"), mapPath: cropAbs }),
        duration: spec.duration,
      },
    });

    // ---- wire the edge parent→import (the pipeliner's arrow) -------------
    const ports = defaultPorts(parent.type, "mapimport");
    let edge: { id: string; fromPort?: string; toPort?: string } | null = null;
    if (portsValid(parent.type, ports.fromPort, "mapimport", ports.toPort)) {
      const edgeId = crypto.randomUUID();
      await persistPortEdge({
        id: edgeId,
        projectId: active.project.id,
        fromJobId: parent.id,
        toJobId: job.id,
        fromPort: ports.fromPort,
        toPort: ports.toPort,
        createdAt: new Date().toISOString(),
      });
      edge = { id: edgeId, fromPort: ports.fromPort, toPort: ports.toPort };
    } else {
      // an import job still works without a drawn arrow (its map arrives
      // via mapPath) — say so honestly instead of planting a broken edge
      edge = null;
    }

    const dto = toJobDTO(job);
    dto.engine = "relion";
    return NextResponse.json(
      {
        job: dto,
        edge,
        crop: { name: cropName, path: `SubVolumes/${cropName}`, dims: result.dims, origin: result.origin },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/jobs/[id]/outputs/subvolume-job failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
