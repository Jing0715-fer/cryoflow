import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureActiveProject, ensureDefaultWorkspace, toJobDTO } from "@/lib/seed";
import { jobType } from "@/lib/workflow";
import { persistPortEdge, portsValid } from "@/lib/edge-ports";
import type {
  CustomTemplatePayload,
  CustomTemplateSummary,
  EdgeDTO,
  JobDTO,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /api/custom-template — user-saved sub-pipeline snippets (Task 127).
 *
 * The built-in SPA scaffold (POST /api/pipeline-template) stamps one
 * canonical 10-job chain; this route stores SHAPES THE USER SAVED: select
 * jobs on the canvas, snapshot their types / relative positions / params
 * plus internal wires, then re-instantiate the whole branch anywhere with
 * one click — below the target workspace's existing content, numbered in
 * the project's RELION sequence, wired exactly as saved.
 *
 * REST split:
 * - GET                    → list summaries (no payload — the blob only
 *                            travels on apply, keeping the list light)
 * - POST {name, payload}   → save (validate + normalize)
 * - PUT  {id, workspaceId?} → apply into a workspace (mints fresh rows)
 * - DELETE ?id=            → forget
 *
 * Payload contract: { jobs: [{ type, dx, dy, params }],
 * edges: [{ from, to, fromPort?, toPort? }] } — from/to are INDICES into
 * the jobs array; dx/dy are offsets from the saved selection's bbox
 * top-left. A template is a shape, not a set of rows.
 */

/** Sanity cap — a selection snapshot is small; this only stops abuse. */
const MAX_PAYLOAD_BYTES = 100_000;
const MAX_NAME = 80;
/** Placement constants (mirror the SPA scaffold's placement contract). */
const ORIGIN_X = 80;
const DROP_GAP = 240;
const FIRST_Y = 140;

/** Max nodes / wires in one snippet — a template is a branch, not a project. */
const MAX_JOBS = 64;
const MAX_EDGES = 256;

interface ValidatedPayload {
  jobs: CustomTemplatePayload["jobs"];
  edges: CustomTemplatePayload["edges"];
}

/**
 * Normalize + validate a raw payload. Returns either the cleaned payload
 * or a 400 message — the route fails LOUDLY on bad input rather than
 * silently saving a template that would half-apply later.
 */
function validatePayload(raw: unknown): { payload?: ValidatedPayload; error?: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Payload must be an object" };
  }
  const p = raw as Partial<CustomTemplatePayload>;
  if (!Array.isArray(p.jobs) || p.jobs.length === 0) {
    return { error: "Payload needs at least one job" };
  }
  if (p.jobs.length > MAX_JOBS) {
    return { error: `Too many jobs in one template (max ${MAX_JOBS})` };
  }
  if (p.edges != null && Array.isArray(p.edges) && p.edges.length > MAX_EDGES) {
    return { error: `Too many edges in one template (max ${MAX_EDGES})` };
  }

  const jobs: ValidatedPayload["jobs"] = [];
  for (const [i, j] of p.jobs.entries()) {
    if (j == null || typeof j !== "object") {
      return { error: `Job #${i} is not an object` };
    }
    const type = typeof j.type === "string" ? j.type : "";
    if (!jobType(type)) {
      return { error: `Job #${i} references unknown job type: ${type || "(none)"}` };
    }
    const dx = typeof j.dx === "number" && Number.isFinite(j.dx) ? j.dx : NaN;
    const dy = typeof j.dy === "number" && Number.isFinite(j.dy) ? j.dy : NaN;
    if (Number.isNaN(dx) || Number.isNaN(dy)) {
      return { error: `Job #${i} has non-finite offsets` };
    }
    // params are re-filtered against the type's LIVE spec at APPLY time
    // (the schema may have drifted since the snapshot) — save keeps
    // scalars only, mirroring the jobs route's duplication contract
    const params: Record<string, number | string | boolean> = {};
    if (j.params != null && typeof j.params === "object" && !Array.isArray(j.params)) {
      for (const [k, v] of Object.entries(j.params as Record<string, unknown>)) {
        if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
          params[k] = v;
        }
      }
    }
    jobs.push({ type, dx, dy, params });
  }

  const edges: ValidatedPayload["edges"] = [];
  const seen = new Set<string>();
  for (const [i, e] of (p.edges ?? []).entries()) {
    if (e == null || typeof e !== "object") {
      return { error: `Edge #${i} is not an object` };
    }
    const { from, to } = e as { from?: unknown; to?: unknown };
    if (
      typeof from !== "number" || !Number.isInteger(from) || from < 0 || from >= jobs.length ||
      typeof to !== "number" || !Number.isInteger(to) || to < 0 || to >= jobs.length
    ) {
      return { error: `Edge #${i} references a job index out of range` };
    }
    if (from === to) {
      return { error: `Edge #${i} is a self-loop` };
    }
    const key = `${from}->${to}`;
    if (seen.has(key)) continue; // dedupe — (from,to) is unique like the DB
    // port pairs must satisfy the type specs at SAVE time too — a broken
    // pair fails the save loudly instead of applying half-wired
    if (
      (e.fromPort != null || e.toPort != null) &&
      !portsValid(jobs[from].type, e.fromPort ?? "", jobs[to].type, e.toPort ?? "")
    ) {
      return {
        error: `Edge #${i} wiring broken: ${jobs[from].type}:${e.fromPort ?? ""} → ${jobs[to].type}:${e.toPort ?? ""}`,
      };
    }
    seen.add(key);
    edges.push({
      from,
      to,
      ...(e.fromPort ? { fromPort: e.fromPort } : {}),
      ...(e.toPort ? { toPort: e.toPort } : {}),
    });
  }

  return { payload: { jobs, edges } };
}

/** List the active project's saved snippets (summaries only). */
export async function GET() {
  try {
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const rows = await db.customTemplate.findMany({
      where: { projectId: active.project.id },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, name: true, payload: true, createdAt: true },
    });
    const templates: CustomTemplateSummary[] = rows.map((r) => {
      let jobCount = 0;
      let edgeCount = 0;
      try {
        const parsed = JSON.parse(r.payload) as CustomTemplatePayload;
        jobCount = Array.isArray(parsed.jobs) ? parsed.jobs.length : 0;
        edgeCount = Array.isArray(parsed.edges) ? parsed.edges.length : 0;
      } catch {
        // corrupt row — keep it listed (deletable) but honest about counts
      }
      return {
        id: r.id,
        name: r.name,
        jobCount,
        edgeCount,
        createdAt: r.createdAt.toISOString(),
      };
    });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("GET /api/custom-template failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Save a selection snapshot. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      payload?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    const { payload, error } = validatePayload(body.payload);
    if (error || !payload) {
      return NextResponse.json({ error: error ?? "Invalid payload" }, { status: 400 });
    }
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 400 });
    }

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const row = await db.customTemplate.create({
      data: {
        projectId: active.project.id,
        name,
        payload: JSON.stringify(payload),
      },
    });
    const summary: CustomTemplateSummary = {
      id: row.id,
      name: row.name,
      jobCount: payload.jobs.length,
      edgeCount: payload.edges.length,
      createdAt: row.createdAt.toISOString(),
    };
    return NextResponse.json({ template: summary }, { status: 201 });
  } catch (error) {
    console.error("POST /api/custom-template failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Apply a saved snippet into a workspace: mints fresh job rows below the
 * workspace's existing content (the SPA scaffold's placement contract),
 * numbered in the project's RELION sequence, wired exactly as saved.
 * A pair the specs no longer allow is SKIPPED (the rest lands) — a saved
 * shape should never dead-end the whole apply on one drifted wire.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      workspaceId?: unknown;
    };
    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Template id is required" }, { status: 400 });
    }

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const row = await db.customTemplate.findFirst({
      where: { id: body.id, projectId: active.project.id },
    });
    if (!row) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    let payload: CustomTemplatePayload;
    try {
      payload = JSON.parse(row.payload) as CustomTemplatePayload;
    } catch {
      return NextResponse.json({ error: "Template payload is corrupt" }, { status: 500 });
    }
    if (!Array.isArray(payload.jobs) || payload.jobs.length === 0) {
      return NextResponse.json({ error: "Template has no jobs" }, { status: 500 });
    }

    // ---- workspace resolution (mirrors the SPA scaffold's healing) ------
    let workspaceId: string;
    const projectWorkspaces = await db.workspace.findMany({
      where: { projectId: active.project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    if (projectWorkspaces.length === 0) {
      // legacy seed state: provision "Main" so the very first user action
      // cannot dead-end on "No workspace available"
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

    // ---- placement: below the workspace's existing content --------------
    const existing = await db.job.findMany({
      where: { projectId: active.project.id, workspaceId },
      select: { x: true, y: true },
    });
    const baseY =
      existing.length > 0
        ? existing.reduce((m, j) => Math.max(m, j.y), 0) + DROP_GAP
        : FIRST_Y;

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

    // ---- mint the jobs (all-or-nothing) ---------------------------------
    const created = await db.$transaction(
      payload.jobs.map((j) => {
        const spec = jobType(j.type);
        if (!spec) throw new Error(`unknown type ${j.type}`);
        // re-filter the snapshot's params against the LIVE spec — the
        // schema may have drifted since save; stale/unknown keys degrade
        // to spec defaults instead of erroring (same contract as POST
        // /api/jobs' duplication path)
        const allowed = new Set((spec.params ?? []).map((p) => p.key));
        if (j.type === "import") allowed.add("empiarData");
        const filtered: Record<string, number | string | boolean> = {};
        for (const [k, v] of Object.entries(j.params ?? {})) {
          if (
            allowed.has(k) &&
            (typeof v === "number" || typeof v === "string" || typeof v === "boolean")
          ) {
            filtered[k] = v;
          }
        }
        const n = (typeCounts.get(j.type) ?? 0) + 1;
        typeCounts.set(j.type, n);
        return db.job.create({
          data: {
            projectId: active.project.id,
            workspaceId,
            type: j.type,
            name: `${spec.label} ${n}`,
            x: ORIGIN_X + j.dx,
            y: baseY + j.dy,
            params: JSON.stringify(filtered),
            duration: spec.duration,
          },
        });
      })
    );

    // ---- wire the saved edges (validated at save; spec drift re-checked) -
    const edgeDTOs: EdgeDTO[] = [];
    for (const e of payload.edges ?? []) {
      const from = created[e.from];
      const to = created[e.to];
      if (!from || !to) continue;
      if (
        (e.fromPort != null || e.toPort != null) &&
        !portsValid(from.type, e.fromPort ?? "", to.type, e.toPort ?? "")
      ) {
        continue; // spec drifted since save — skip the broken pair, land the rest
      }
      const id = crypto.randomUUID();
      await persistPortEdge({
        id,
        projectId: active.project.id,
        fromJobId: from.id,
        toJobId: to.id,
        ...(e.fromPort ? { fromPort: e.fromPort } : {}),
        ...(e.toPort ? { toPort: e.toPort } : {}),
        createdAt: new Date().toISOString(),
      });
      edgeDTOs.push({
        id,
        fromJobId: from.id,
        toJobId: to.id,
        ...(e.fromPort ? { fromPort: e.fromPort } : {}),
        ...(e.toPort ? { toPort: e.toPort } : {}),
      });
    }

    const jobs = created.map((j) => {
      const dto = toJobDTO(j);
      dto.engine = "relion";
      return dto;
    }) as JobDTO[];

    return NextResponse.json(
      { jobs, edges: edgeDTOs, workspaceId },
      { status: 201 }
    );
  } catch (error) {
    console.error("PUT /api/custom-template failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Forget a saved snippet. */
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Template id is required" }, { status: 400 });
    }
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const row = await db.customTemplate.findFirst({
      where: { id, projectId: active.project.id },
    });
    if (!row) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    await db.customTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/custom-template failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
