import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveProject, ensureDefaultWorkspace, toJobDTO } from "@/lib/seed";
import { defaultParams, jobType } from "@/lib/workflow";
import { persistPortEdge, portsValid } from "@/lib/edge-ports";
import { normalizeTypeId } from "@/lib/workflow-io";
import type { EdgeDTO, JobDTO, ParamValue } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/workflow-import — recreate a graph from an exported
 * cryoflow-workflow/1 JSON file (see src/lib/workflow-io.ts).
 *
 * The client pre-validates for instant feedback; THIS route re-validates
 * everything authoritatively (never trusts the file or the client parser):
 *   - job types must exist in the catalog
 *   - params are filtered to the type's spec keys, scalars only (the same
 *     whitelist the jobs POST route applies — arbitrary keys never reach
 *     the DB, so engine-adjacent params can't be injected via a file)
 *   - edges must connect existing indexes with spec-valid ports
 *     (portsValid), self-links rejected
 *   - names are de-duplicated against the project's EXISTING names AND the
 *     incoming batch (collision → " (i2)", " (i3)" …) — display-only,
 *     graph identity is the index mapping
 *
 * Placement: the file's internal geometry is preserved (relative spacing)
 * and the whole graph is shifted BELOW the workspace's existing content —
 * importing into a busy workspace never overlaps. All-or-nothing transaction
 * (jobs + edges) mirrors the pipeline-template route.
 *
 * Body: { workspaceId?, jobs, edges } — jobs: [{type,name?,x,y,params?}],
 * edges: [{from,to,fromPort,toPort}] (indexes into jobs).
 * Returns the created jobs + edges for a direct store merge.
 */

/** vertical gap between the workspace's existing content and the import */
const DROP_GAP = 240;
const MAX_JOBS = 500;

const SCALARS = new Set(["number", "string", "boolean"]);

interface ImportJob {
  type: string;
  name: string | null;
  x: number;
  y: number;
  params: Record<string, ParamValue> | null;
}

interface ImportEdge {
  from: number;
  to: number;
  fromPort: string;
  toPort: string;
}

function parseBody(
  body: Record<string, unknown>
): { jobs: ImportJob[]; edges: ImportEdge[]; error?: string } {
  const rawJobs = body.jobs;
  if (!Array.isArray(rawJobs) || rawJobs.length === 0) {
    return { jobs: [], edges: [], error: "No jobs in the import payload" };
  }
  if (rawJobs.length > MAX_JOBS) {
    return { jobs: [], edges: [], error: `Too many jobs (max ${MAX_JOBS})` };
  }
  const jobs: ImportJob[] = [];
  for (let i = 0; i < rawJobs.length; i++) {
    const j = rawJobs[i] as Record<string, unknown>;
    const rawType = typeof j.type === "string" ? j.type : "";
    // authoritative normalization (same layer the client parser uses):
    // legacy spellings and cosmetic drift map onto canonical ids — a file
    // exported by another CryoFlow version still lands, but a genuinely
    // unknown type still fails LOUDLY (never silently skip a job)
    const type = normalizeTypeId(rawType);
    const spec = type ? jobType(type) : undefined;
    if (!type || !spec) {
      return { jobs: [], edges: [], error: `Job #${i + 1}: unknown type "${rawType}"` };
    }
    const x = typeof j.x === "number" && Number.isFinite(j.x) ? j.x : null;
    const y = typeof j.y === "number" && Number.isFinite(j.y) ? j.y : null;
    if (x == null || y == null) {
      return { jobs: [], edges: [], error: `Job #${i + 1}: bad canvas position` };
    }
    let params: Record<string, ParamValue> | null = null;
    if (j.params && typeof j.params === "object" && !Array.isArray(j.params)) {
      const allowed = new Set((spec.params ?? []).map((p) => p.key));
      if (type === "import") allowed.add("empiarData"); // engine flag parity with jobs POST
      const filtered: Record<string, ParamValue> = {};
      for (const [k, v] of Object.entries(j.params as Record<string, unknown>)) {
        if (allowed.has(k) && SCALARS.has(typeof v)) {
          filtered[k] = v as ParamValue;
        }
      }
      params = Object.keys(filtered).length > 0 ? filtered : null;
    }
    const name = typeof j.name === "string" && j.name.trim() ? j.name.trim().slice(0, 120) : null;
    jobs.push({ type, name, x, y, params });
  }

  const edges: ImportEdge[] = [];
  const rawEdges = body.edges;
  if (Array.isArray(rawEdges)) {
    for (let i = 0; i < rawEdges.length; i++) {
      const e = rawEdges[i] as Record<string, unknown>;
      const from = typeof e.from === "number" ? Math.round(e.from) : -1;
      const to = typeof e.to === "number" ? Math.round(e.to) : -1;
      if (from < 0 || from >= jobs.length || to < 0 || to >= jobs.length) {
        return { jobs: [], edges: [], error: `Link #${i + 1}: endpoint out of range` };
      }
      if (from === to) {
        return { jobs: [], edges: [], error: `Link #${i + 1}: self-links are not allowed` };
      }
      const fromPort = typeof e.fromPort === "string" ? e.fromPort : "";
      const toPort = typeof e.toPort === "string" ? e.toPort : "";
      // port VALIDITY against the spec pair (compat rules live in portsValid)
      if (!portsValid(jobs[from].type, fromPort, jobs[to].type, toPort)) {
        return {
          jobs: [],
          edges: [],
          error: `Link #${i + 1}: ${jobs[from].type}:${fromPort} → ${jobs[to].type}:${toPort} is not a valid wiring`,
        };
      }
      edges.push({ from, to, fromPort, toPort });
    }
  }
  return { jobs, edges };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { jobs: inJobs, edges: inEdges, error: parseErr } = parseBody(body);
    if (parseErr) {
      return NextResponse.json({ error: parseErr }, { status: 400 });
    }

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }

    // ---- workspace resolution (heals the legacy zero-workspace seed) ----
    const projectWorkspaces = await db.workspace.findMany({
      where: { projectId: active.project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    let workspaceId: string;
    if (projectWorkspaces.length === 0) {
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

    // ---- placement: preserve internal geometry, shift below content ------
    const minY = inJobs.reduce((m, j) => Math.min(m, j.y), 0);
    const existing = await db.job.findMany({
      where: { projectId: active.project.id, workspaceId },
      select: { y: true },
    });
    const emptyWorkspace = existing.length === 0;
    const baseY =
      emptyWorkspace
        ? 140 // empty workspace: land at the canvas' usual top-left origin
        : existing.reduce((m, j) => Math.max(m, j.y), 0) + DROP_GAP;
    const yShift = baseY - minY;

    // ---- name de-duplication (project-wide + batch-internal) -------------
    const projectJobs = await db.job.findMany({
      where: { projectId: active.project.id },
      select: { name: true },
    });
    const taken = new Set(projectJobs.map((j) => j.name));
    const uniqueName = (raw: string): string => {
      if (!taken.has(raw)) {
        taken.add(raw);
        return raw;
      }
      for (let i = 2; ; i++) {
        const candidate = `${raw} (i${i})`;
        if (!taken.has(candidate)) {
          taken.add(candidate);
          return candidate;
        }
      }
    };

    // ---- create jobs (all-or-nothing) -------------------------------------
    const created = await db.$transaction(
      inJobs.map((j) => {
        const spec = jobType(j.type);
        if (!spec) throw new Error(`unknown type ${j.type}`);
        return db.job.create({
          data: {
            projectId: active.project.id,
            workspaceId,
            type: j.type,
            name: uniqueName(j.name ?? `${spec.label} 1`),
            x: j.x,
            y: j.y + yShift,
            params: j.params
              ? JSON.stringify({ ...defaultParams(j.type), ...j.params })
              : JSON.stringify(defaultParams(j.type)),
            duration: spec.duration,
          },
        });
      })
    );

    // ---- wire edges -------------------------------------------------------
    const edgeDTOs: EdgeDTO[] = [];
    for (const e of inEdges) {
      const from = created[e.from];
      const to = created[e.to];
      if (!from || !to) continue; // parseBody guarantees range — defensive
      const id = crypto.randomUUID();
      await persistPortEdge({
        id,
        projectId: active.project.id,
        fromJobId: from.id,
        toJobId: to.id,
        fromPort: e.fromPort,
        toPort: e.toPort,
        createdAt: new Date().toISOString(),
      });
      edgeDTOs.push({
        id,
        fromJobId: from.id,
        toJobId: to.id,
        fromPort: e.fromPort,
        toPort: e.toPort,
      });
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
    console.error("POST /api/workflow-import failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
