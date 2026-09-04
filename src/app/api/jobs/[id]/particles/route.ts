import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface ParticleRow {
  /** 0-based slice index inside the .mrcs stack (feeds outputs/file PNG) */
  slice: number;
  /** 1-based index as written in _rlnImageName (stack@000001) */
  idx1: number;
  x: number;
  y: number;
  /** CTF fit quality at this particle's micrograph */
  fom: number | null;
  maxRes: number | null;
  /** workdir-relative stack path, resolved against ownerJobId's workdir */
  stackRel: string;
  /** job whose workdir actually contains the stack */
  ownerJobId: string;
}

export interface ParticleGroup {
  /** micrograph base name (group key) */
  name: string;
  /** full micrograph path as written in the star file */
  mic: string;
  /** workdir-relative .mrcs stack path */
  stackRel: string;
  /** job whose workdir actually contains the stack (image rendering owner) */
  ownerJobId: string;
  count: number;
  meanFom: number | null;
  worstRes: number | null;
}

export interface ParticlesResponse {
  jobId: string;
  total: number;
  optics: {
    pixelSize: number | null;
    voltage: number | null;
    cs: number | null;
    q0: number | null;
    boxSize: number | null;
  };
  groups: ParticleGroup[];
}

export interface ParticlePageResponse {
  jobId: string;
  group: string;
  offset: number;
  limit: number;
  total: number;
  particles: ParticleRow[];
}

/** Find the particles star file produced by this job (extract / select). */
function findParticlesStar(workdir: string): string | null {
  const candidates = ["particles_select.star", "particles.star"];
  for (const c of candidates) {
    const p = path.join(workdir, c);
    if (existsSync(p)) return p;
  }
  // fallback: any *.star mentioning _rlnImageName (defensive)
  try {
    for (const f of readdirSync(workdir)) {
      if (!f.endsWith(".star")) continue;
      const p = path.join(workdir, f);
      try {
        const head = readFileSync(p, "utf8").slice(0, 4000);
        if (head.includes("_rlnImageName")) return p;
      } catch {
        /* unreadable — skip */
      }
    }
  } catch {
    /* workdir unreadable */
  }
  return null;
}

/**
 * Block-aware parser: reads data_optics scalars + the data_particles loop
 * into flat row records. Reuses the label-column mapping approach used by
 * the CTF route (first row freezes the column order).
 */
interface StarRow {
  cells: string[];
  labels: Record<string, number>;
}

function parseParticlesStar(file: string): {
  optics: ParticlesResponse["optics"];
  rows: StarRow[];
} {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  const optics: ParticlesResponse["optics"] = {
    pixelSize: null,
    voltage: null,
    cs: null,
    q0: null,
    boxSize: null,
  };

  // --- data_optics scalars (single-row loop) ---
  let inOptics = false;
  let opticsLabels: Record<string, number> | null = null;
  let opticsDone = false;

  // --- data_particles rows ---
  const rows: StarRow[] = [];
  let inParticles = false;
  let labels: Record<string, number> | null = null;

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;

    if (t.startsWith("data_")) {
      const block = t.slice(5).trim();
      inOptics = block === "optics";
      inParticles = block === "particles";
      opticsLabels = null;
      labels = null;
      if (inParticles) opticsDone = true;
      continue;
    }
    if (t.startsWith("#") || t === "loop_") continue;

    if (inOptics && !opticsDone) {
      if (t.startsWith("_")) {
        opticsLabels ??= {};
        const m = t.match(/^(\S+)\s+#(\d+)$/);
        if (m) opticsLabels[m[1]] = Number(m[2]) - 1;
      } else if (opticsLabels) {
        const cells = t.split(/\s+/);
        const num = (label: string) => {
          const i = opticsLabels![label];
          if (i == null || i >= cells.length) return null;
          const v = parseFloat(cells[i]);
          return Number.isFinite(v) ? v : null;
        };
        optics.pixelSize = num("_rlnImagePixelSize") ?? optics.pixelSize;
        optics.voltage = num("_rlnVoltage") ?? optics.voltage;
        optics.cs = num("_rlnSphericalAberration") ?? optics.cs;
        optics.q0 = num("_rlnAmplitudeContrast") ?? optics.q0;
        optics.boxSize = num("_rlnImageSize") ?? optics.boxSize;
      }
      continue;
    }

    if (inParticles) {
      if (t.startsWith("_")) {
        labels ??= {};
        const m = t.match(/^(\S+)\s+#(\d+)$/);
        if (m) labels[m[1]] = Number(m[2]) - 1;
      } else if (labels) {
        const cells = t.split(/\s+/);
        if (cells.length >= Object.keys(labels).length) rows.push({ cells, labels });
      }
    }
  }
  return { optics, rows };
}

/**
 * decode an _rlnImageName cell → { stack, idx (1-based) }.
 * RELION 5 writes "00000007@/abs/path/stack.mrcs" (index first); some
 * tools write "stack.mrcs@00000007". Handle both.
 */
function parseImageName(v: string): { stack: string; idx: number } | null {
  const at = v.lastIndexOf("@");
  if (at < 0) return null;
  const head = v.slice(0, at).replace(/^\.?\//, "");
  const tail = v.slice(at + 1);
  // index-first form: head is digits, tail is the stack path
  if (/^\d+$/.test(head) && tail.length > 0) {
    const idx = parseInt(head, 10);
    if (Number.isFinite(idx) && idx > 0) return { stack: tail, idx };
  }
  // path-first form: tail is digits
  const idx = parseInt(tail, 10);
  if (/^\d+$/.test(tail) && head.length > 0 && Number.isFinite(idx) && idx > 0) {
    return { stack: head, idx };
  }
  return null;
}

/** absolutize-then-relativize: only paths inside workdir stay, others 404 later */
function relativize(workdir: string, p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(workdir, p.replace(/^\.?\//, ""));
  if (abs === workdir) return ".";
  if (abs.startsWith(workdir + path.sep)) return path.relative(workdir, abs);
  // outside the workdir — keep as-is (the file route will reject it)
  return p.replace(/^\.?\//, "");
}

const num = (c: string | undefined): number | null => {
  if (c == null) return null;
  const v = parseFloat(c);
  return Number.isFinite(v) ? v : null;
};

/**
 * GET /api/jobs/[id]/particles — particle stack inventory for Extract /
 * Select jobs: per-micrograph groups with CTF-fit stats + optics table.
 *
 * With ?group=<micrograph name>&offset=0&limit=48 returns a page of
 * individual particle rows (slice indices resolve the on-disk .mrcs
 * stack via the outputs/file PNG renderer).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }

    const workdir = run.workdir;
    const starPath = findParticlesStar(workdir);
    if (!starPath) {
      return NextResponse.json({ error: "No particles STAR file in this job" }, { status: 400 });
    }

    const { optics, rows } = parseParticlesStar(starPath);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No particle rows parsed" }, { status: 400 });
    }

    // ---- decode rows into typed records ------------------------------
    interface Decoded {
      mic: string;
      name: string;
      stackAbs: string;
      stackRel: string;
      ownerJobId: string;
      idx1: number;
      x: number;
      y: number;
      fom: number | null;
      maxRes: number | null;
    }

    // Stack ownership: Select (and friends) write star rows that point at
    // the UPSTREAM Extract job's stacks by absolute path. Resolve which
    // job's workdir actually contains each stack so the client can render
    // PNGs through that job's outputs/file route.
    const upstream = await db.edge.findMany({
      where: { toJobId: id },
      select: { fromJobId: true },
    });
    const upstreamWorkdirs = new Map<string, string>(); // jobId -> workdir
    for (const e of upstream) {
      // upstream may be a soft LINK — its stacks live in the ORIGINAL workdir
      const up = await findEffectiveJob(e.fromJobId);
      const r = getRun(up ? up.id : e.fromJobId);
      if (r?.workdir && existsSync(r.workdir)) upstreamWorkdirs.set(e.fromJobId, r.workdir);
    }
    const resolveOwner = (stackAbs: string): { ownerJobId: string; stackRel: string } => {
      if (stackAbs.startsWith(workdir + path.sep) || path.dirname(stackAbs) === workdir) {
        return { ownerJobId: id, stackRel: path.relative(workdir, stackAbs) };
      }
      for (const [ownerId, wdir] of upstreamWorkdirs) {
        if (stackAbs.startsWith(wdir + path.sep) || path.dirname(stackAbs) === wdir) {
          return { ownerJobId: ownerId, stackRel: path.relative(wdir, stackAbs) };
        }
      }
      // unresolvable — keep this job (the file route will 404 gracefully)
      return { ownerJobId: id, stackRel: path.basename(stackAbs) };
    };

    const decoded: Decoded[] = [];
    for (const r of rows) {
      const imgCell = r.cells[r.labels["_rlnImageName"]];
      const parsed = imgCell ? parseImageName(imgCell) : null;
      if (!parsed) continue;
      const micCell = r.cells[r.labels["_rlnMicrographName"]] ?? "";
      const mic = relativize(workdir, micCell);
      const stackAbs = path.isAbsolute(parsed.stack)
        ? parsed.stack
        : path.resolve(workdir, parsed.stack.replace(/^\.?\//, ""));
      const { ownerJobId, stackRel } = existsSync(stackAbs)
        ? resolveOwner(stackAbs)
        : { ownerJobId: id, stackRel: relativize(workdir, parsed.stack) };
      decoded.push({
        mic,
        name: path.basename(mic),
        stackAbs,
        stackRel,
        ownerJobId,
        idx1: parsed.idx,
        x: num(r.cells[r.labels["_rlnCoordinateX"]]) ?? 0,
        y: num(r.cells[r.labels["_rlnCoordinateY"]]) ?? 0,
        fom: num(r.cells[r.labels["_rlnCtfFigureOfMerit"]]),
        maxRes: num(r.cells[r.labels["_rlnCtfMaxResolution"]]),
      });
    }
    if (decoded.length === 0) {
      return NextResponse.json({ error: "No stack-backed particles found" }, { status: 400 });
    }

    // ---- grouped mode (default): per-micrograph inventory ------------
    const url = new URL(request.url);
    const group = url.searchParams.get("group");
    if (!group) {
      const map = new Map<
        string,
        ParticleGroup & { fomSum: number; fomN: number; resWorst: number | null }
      >();
      for (const d of decoded) {
        let g = map.get(d.name);
        if (!g) {
          g = {
            name: d.name,
            mic: d.mic,
            stackRel: d.stackRel,
            ownerJobId: d.ownerJobId,
            count: 0,
            meanFom: null,
            worstRes: null,
            fomSum: 0,
            fomN: 0,
            resWorst: null,
          };
          map.set(d.name, g);
        }
        g.count += 1;
        if (d.fom != null) {
          g.fomSum += d.fom;
          g.fomN += 1;
        }
        // _rlnCtfMaxResolution = best resolution the CTF model still fits,
        // so the *worst* micrograph is the SMALLEST value.
        if (d.maxRes != null && (g.resWorst == null || d.maxRes < g.resWorst)) {
          g.resWorst = d.maxRes;
        }
      }
      const groups: ParticleGroup[] = [...map.values()]
        .map((g) => ({
          name: g.name,
          mic: g.mic,
          stackRel: g.stackRel,
          ownerJobId: g.ownerJobId,
          count: g.count,
          meanFom: g.fomN > 0 ? g.fomSum / g.fomN : null,
          worstRes: g.resWorst,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const body: ParticlesResponse = {
        jobId: id,
        total: decoded.length,
        optics,
        groups,
      };
      return NextResponse.json(body);
    }

    // ---- paged mode: individual particles of one micrograph ----------
    const subset = decoded.filter((d) => d.name === group);
    if (subset.length === 0) {
      return NextResponse.json({ error: "Unknown group" }, { status: 404 });
    }
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(
      96,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "36", 10) || 36)
    );
    const page = subset.slice(offset, offset + limit).map<ParticleRow>((d) => ({
      slice: d.idx1 - 1,
      idx1: d.idx1,
      x: d.x,
      y: d.y,
      fom: d.fom,
      maxRes: d.maxRes,
      stackRel: d.stackRel,
      ownerJobId: d.ownerJobId,
    }));
    const body: ParticlePageResponse = {
      jobId: id,
      group,
      offset,
      limit,
      total: subset.length,
      particles: page,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/jobs/[id]/particles failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
