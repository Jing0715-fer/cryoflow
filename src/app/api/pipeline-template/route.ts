import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveProject, ensureDefaultWorkspace, toJobDTO } from "@/lib/seed";
import { defaultParams, jobType } from "@/lib/workflow";
import { persistPortEdge, portsValid } from "@/lib/edge-ports";
import type { EdgeDTO, JobDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/pipeline-template — one-click standard single-particle analysis
 * scaffold: 10 jobs pre-wired in the canonical RELION order, placed in the
 * requested workspace BELOW any existing content (predictable serpentine
 * grid), with default parameters. Nothing runs — the user reviews, adjusts
 * paths (the Import job needs a real micrograph folder/pattern) and starts
 * jobs individually or via downstream auto-start.
 *
 * Body: { workspaceId? } (defaults to the project's first workspace).
 * Returns the created jobs + edges so the client can merge them straight
 * into its store without a refetch round-trip.
 */

/** The canonical SPA chain, in serpentine canvas order (row 0 left→right,
 *  row 1 right→left) — mirrors RELION's recommended first-pass workflow. */
const TEMPLATE_CHAIN = [
  "import",
  "motioncorr",
  "ctffind",
  "autopick",
  "extract",
  "class2d",
  "initialmodel",
  "refine3d",
  "maskcreate",
  "postprocess",
] as const;

/** Column per chain entry (6 on the top row, then the snake folds back). */
const TEMPLATE_COLS = [0, 1, 2, 3, 4, 5, 5, 4, 3, 2];
/** Row per chain entry. */
const TEMPLATE_ROWS = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
/** Card grid pitch (canvas px) — cards are 220×96, this leaves wire lanes. */
const DX = 300;
const DY = 210;
const ORIGIN_X = 80;
/** Vertical gap between the existing workspace content and the template. */
const DROP_GAP = 240;

/** Explicit port wiring for the chain — [fromType, fromPort, toType, toPort].
 *  Validated against the specs at request time (a spec change that breaks a
 *  pair fails the whole template loudly instead of half-wiring). */
const TEMPLATE_EDGES: [string, string, string, string][] = [
  ["import", "micrographs", "motioncorr", "movies"],
  ["motioncorr", "micrographs", "ctffind", "micrographs"],
  ["ctffind", "micrographs", "autopick", "micrographs"],
  ["ctffind", "micrographs", "extract", "micrographs"],
  ["autopick", "coords", "extract", "coords"],
  ["extract", "particles", "class2d", "particles"],
  ["class2d", "particles", "initialmodel", "particles"],
  ["class2d", "particles", "refine3d", "particles"],
  ["initialmodel", "model", "refine3d", "reference"],
  ["refine3d", "map", "maskcreate", "map"],
  ["refine3d", "half1", "postprocess", "half1"],
  ["refine3d", "half2", "postprocess", "half2"],
  ["maskcreate", "mask", "postprocess", "mask"],
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { workspaceId?: unknown };

    // all chain entries must exist in the catalog (defensive — a renamed
    // spec key should 400 here, not create a half-template)
    for (const type of TEMPLATE_CHAIN) {
      if (!jobType(type)) {
        return NextResponse.json(
          { error: `Template references unknown job type: ${type}` },
          { status: 500 }
        );
      }
    }
    for (const [fromType, fromPort, toType, toPort] of TEMPLATE_EDGES) {
      if (!portsValid(fromType, fromPort, toType, toPort)) {
        return NextResponse.json(
          { error: `Template wiring broken: ${fromType}:${fromPort} → ${toType}:${toPort}` },
          { status: 500 }
        );
      }
    }

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }

    // ---- workspace resolution (heals the legacy zero-workspace seed) ----
    let workspaceId: string;
    const projectWorkspaces = await db.workspace.findMany({
      where: { projectId: active.project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    if (projectWorkspaces.length === 0) {
      // legacy seed state: provision "Main" so the very first user action
      // (this template) cannot dead-end on "No workspace available"
      workspaceId = await ensureDefaultWorkspace(active.project.id);
    } else {
      workspaceId = projectWorkspaces[0].id;
      if (typeof body.workspaceId === "string" && body.workspaceId) {
        const target = projectWorkspaces.find((w) => w.id === body.workspaceId);
        if (!target) {
          return NextResponse.json(
            { error: "Workspace not found in this project" },
            { status: 400 }
          );
        }
        workspaceId = target.id;
      }
    }

    // ---- placement: below the workspace's existing content ---------------
    const existing = await db.job.findMany({
      where: { projectId: active.project.id, workspaceId },
      select: { y: true },
    });
    const baseY =
      existing.length > 0
        ? existing.reduce((m, j) => Math.max(m, j.y), 0) + DROP_GAP
        : 140;

    // RELION-style numbering continues from the project's existing jobs
    // ("Import 1" exists → the template's import becomes "Import 2")
    const allJobs = await db.job.findMany({
      where: { projectId: active.project.id },
      select: { type: true },
    });
    const typeCounts = new Map<string, number>();
    for (const j of allJobs) {
      typeCounts.set(j.type, (typeCounts.get(j.type) ?? 0) + 1);
    }

    // ---- create the 10 jobs (all-or-nothing) -----------------------------
    const created = await db.$transaction(
      TEMPLATE_CHAIN.map((type, i) => {
        const spec = jobType(type);
        if (!spec) throw new Error(`unknown type ${type}`);
        const n = (typeCounts.get(type) ?? 0) + 1;
        typeCounts.set(type, n);
        return db.job.create({
          data: {
            projectId: active.project.id,
            workspaceId,
            type,
            name: `${spec.label} ${n}`,
            x: ORIGIN_X + TEMPLATE_COLS[i] * DX,
            y: baseY + TEMPLATE_ROWS[i] * DY,
            params: JSON.stringify(defaultParams(type)),
            duration: spec.duration,
          },
        });
      })
    );

    // ---- wire the 13 edges (port-validated above) -------------------------
    const byType = new Map<string, (typeof created)[number]>();
    created.forEach((j) => byType.set(j.type, j)); // one instance per type
    const edgeDTOs: EdgeDTO[] = [];
    for (const [fromType, fromPort, toType, toPort] of TEMPLATE_EDGES) {
      const from = byType.get(fromType);
      const to = byType.get(toType);
      if (!from || !to) continue;
      const id = crypto.randomUUID();
      await persistPortEdge({
        id,
        projectId: active.project.id,
        fromJobId: from.id,
        toJobId: to.id,
        fromPort,
        toPort,
        createdAt: new Date().toISOString(),
      });
      edgeDTOs.push({ id, fromJobId: from.id, toJobId: to.id, fromPort, toPort });
    }

    return NextResponse.json(
      {
        jobs: created.map((j) => {
          const dto = toJobDTO(j);
          dto.engine = "relion";
          return dto;
        }) as JobDTO[],
        edges: edgeDTOs,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/pipeline-template failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
