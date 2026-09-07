import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveProject, ensureDefaultWorkspace, toJobDTO } from "@/lib/seed";
import { defaultParams, jobType } from "@/lib/workflow";
import { persistPortEdge, portsValid } from "@/lib/edge-ports";
import type { EdgeDTO, JobDTO, TemplateOverrides } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/pipeline-template — one-click standard single-particle analysis
 * scaffold: 10 jobs pre-wired in the canonical RELION order, placed in the
 * requested workspace BELOW any existing content (predictable serpentine
 * grid), with default parameters. Nothing runs — the user reviews, adjusts
 * paths (the Import job needs a real micrograph folder/pattern) and starts
 * jobs individually or via downstream auto-start.
 *
 * Body: { workspaceId?, overrides? } (workspace defaults to the project's
 * first workspace; overrides carry optional parameter presets — symmetry,
 * class counts, refine settings — validated/clamped against the job specs).
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

/** Point groups offered by the symmetry selects (mirrors workflow.ts). */
const SYMMETRY_OPTIONS = ["C1", "C2", "C4", "D2", "T", "I"];

/** Coerce a number override: non-finite → null; finite → clamped to [min,max]. */
function clampNum(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/**
 * Parse + validate the optional overrides. Returns either the cleaned
 * overrides or a 400 message — the route fails LOUDLY on bad input rather
 * than silently creating a template with ignored settings.
 */
function parseOverrides(raw: unknown): { overrides?: TemplateOverrides; error?: string } {
  if (raw == null || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: TemplateOverrides = {};

  if (o.symmetry != null) {
    if (typeof o.symmetry !== "string" || !SYMMETRY_OPTIONS.includes(o.symmetry)) {
      return { error: `Invalid symmetry: ${String(o.symmetry)}` };
    }
    out.symmetry = o.symmetry;
  }
  const class2dClasses = clampNum(o.class2dClasses, 1, 200);
  if (o.class2dClasses != null && class2dClasses == null) {
    return { error: "Invalid class2dClasses (expected a number)" };
  }
  if (class2dClasses != null) out.class2dClasses = class2dClasses;

  const class2dIterations = clampNum(o.class2dIterations, 1, 50);
  if (o.class2dIterations != null && class2dIterations == null) {
    return { error: "Invalid class2dIterations (expected a number)" };
  }
  if (class2dIterations != null) out.class2dIterations = class2dIterations;

  const initialModelClasses = clampNum(o.initialModelClasses, 1, 20);
  if (o.initialModelClasses != null && initialModelClasses == null) {
    return { error: "Invalid initialModelClasses (expected a number)" };
  }
  if (initialModelClasses != null) out.initialModelClasses = initialModelClasses;

  const refineIniHigh = clampNum(o.refineIniHigh, 5, 60);
  if (o.refineIniHigh != null && refineIniHigh == null) {
    return { error: "Invalid refineIniHigh (expected a number)" };
  }
  if (refineIniHigh != null) out.refineIniHigh = refineIniHigh;

  if (o.refineAutoRefine != null) {
    if (typeof o.refineAutoRefine !== "boolean") {
      return { error: "Invalid refineAutoRefine (expected a boolean)" };
    }
    out.refineAutoRefine = o.refineAutoRefine;
  }
  return { overrides: out };
}

/** Apply validated overrides on top of a job type's spec defaults. */
function applyOverrides(
  type: string,
  params: Record<string, number | string | boolean>,
  ov: TemplateOverrides
): void {
  if (type === "class2d") {
    if (ov.class2dClasses != null) params.numClasses = ov.class2dClasses;
    if (ov.class2dIterations != null) params.iterations = ov.class2dIterations;
  } else if (type === "initialmodel") {
    if (ov.initialModelClasses != null) params.numClasses = ov.initialModelClasses;
    if (ov.symmetry != null) params.symmetry = ov.symmetry;
  } else if (type === "refine3d") {
    if (ov.symmetry != null) params.symmetry = ov.symmetry;
    if (ov.refineIniHigh != null) params.iniHigh = ov.refineIniHigh;
    if (ov.refineAutoRefine != null) params.autoRefine = ov.refineAutoRefine;
  }
}

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
    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: unknown;
      overrides?: unknown;
    };

    const { overrides, error: ovErr } = parseOverrides(body.overrides);
    if (ovErr) {
      return NextResponse.json({ error: ovErr }, { status: 400 });
    }

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
            params: JSON.stringify(
              // spec defaults, then the caller's validated presets on top
              overrides && Object.keys(overrides).length > 0
                ? (() => {
                    const p = defaultParams(type);
                    applyOverrides(type, p, overrides);
                    return p;
                  })()
                : defaultParams(type)
            ),
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
