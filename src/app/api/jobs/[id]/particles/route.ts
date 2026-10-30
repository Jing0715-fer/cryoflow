import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { isLocalRequest } from "@/lib/http-guard";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { serverErrorReply } from "@/lib/server-error";
import {
  decodeParticlesRows, // t1101 — the pure decode rides the ONE lib (and the ONE cache slot with its parse)
  parseParticlesStarText,
  relativizePath, // the absent-stack fallback keeps its historic bytes (the RAW form's relativize)
  type DecodedParticleRow,
} from "@/lib/particles-star";

// t904 — the #8 audit's living remainder: the BFS N+1 the recital named
// died batches ago (one edge query per depth level, one job query per
// batch — the doctrine the picks route cites), but the SAME route carried
// a real hot path: parseParticlesStar re-read + re-parsed the WHOLE
// particles star on EVERY request — every page fetch of 48 rows paid a
// full 13k-row parse — and the decode loop stat'ed the same stack path
// once per ROW. The parse is pure text→shape (the statcache contract's
// exact fit: it changes only when the star's (size, mtime) changes); the
// decode is deliberately NOT cached across requests — its dependency
// surface (existsSync on stack files, the upstream BFS, the DB) is the
// mtime key's blind spot, so it stays per-request and only the storm
// collapses (a per-request memo keyed by stack path). The asymmetry is
// the policy, not an oversight.
//
// t1101 — the deep band's split: the decode loop is TWO halves. The
// per-row half (image-name forms, mic relativization, coordinates/fom/
// res) is as pure as the parse it fed from — a function of (text,
// workdir) alone — and now rides the SAME cache slot (the cached fn
// returns { optics, decoded }); the stack-OWNERSHIP half (existsSync per
// distinct stack, the upstream BFS, the DB) keeps the t904 policy line:
// per-request, memoized by distinct stack path. One namespace id, one
// invalidation key, the per-row storm joins the parse in the cache.

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** the route's own row: the lib's pure decode + the ownership pass's
 * two fields (the historic Decoded shape, byte-for-byte) */
type OwnedParticleRow = DecodedParticleRow & {
  ownerJobId: string;
  stackRel: string;
};

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
 * Block-aware parser, the label freeze, the image-name forms, the
 * relativize law and the pure per-row decode now live in the ONE lib
 * (src/lib/particles-star.ts — t1101): the unit imports the same seats
 * the route rides, and the decode shares the parse's cache slot.
 */

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
    // Hardening (t251, the #5 sibling closure): workdir-derived data —
    // same drive-by door + Host pin pair as the outputs/file route
    // (see http-guard for the threat model). Parsed or rendered, the
    // bytes come from the job workdir — the door rides along.
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
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }

    const workdir = run.workdir;
    const starPath = findParticlesStar(workdir);
    if (!starPath) {
      return NextResponse.json({ error: "No particles STAR file in this job" }, { status: 400 });
    }

    const parsed = cachedFileCompute(starPath, "particles:star", (text) => {
      // t1101 — the parse AND the pure decode share the ONE slot: both are
      // functions of (text, workdir) alone; the ownership pass stays
      // per-request below (the t904 policy line, unchanged)
      const { optics, rows } = parseParticlesStarText(text);
      return { optics, decoded: decodeParticlesRows(rows, workdir) };
    });
    if (!parsed) {
      // findParticlesStar just verified existence — this door only opens if
      // the file vanished between the listing and the read (honest 400)
      return NextResponse.json({ error: "No particles STAR file in this job" }, { status: 400 });
    }
    const { optics, decoded } = parsed;
    if (decoded.length === 0) {
      return NextResponse.json({ error: "No particle rows parsed" }, { status: 400 });
    }

    // ---- decode rows into typed records ------------------------------
    // t1101 — the per-row half moved to the lib (decodeParticlesRows, one
    // cache slot with the parse); what remains here is the OWNERSHIP pass
    // (the filesystem's half) and the assembly.

    // Stack ownership: Select (and friends) write star rows that point at
    // the UPSTREAM Extract job's stacks by absolute path. Resolve which
    // job's workdir actually contains each stack so the client can render
    // PNGs through that job's outputs/file route.
    // FULL upstream lineage (BFS over edges, not just direct parents):
    // symexpand/rebalance/select2d stars reference extract's stacks while
    // their direct parent is a refine/classify job — the owner can sit any
    // number of hops upstream.
    const upstreamWorkdirs = new Map<string, string>(); // jobId -> workdir
    {
      // Batched BFS: ONE edge query per depth level + ONE job query for all
      // discovered ids. The old loop awaited findEffectiveJob PER EDGE —
      // 1–2 DB round-trips × every upstream job on each ParticleBrowser
      // open (the classic N+1). Link chains are followed in-memory from
      // the same batch (they are collapsed at creation; the hop loop is
      // defensive only).
      const seen = new Set<string>([id]);
      const discovered: string[] = [];
      let frontier = [id];
      while (frontier.length > 0) {
        const edges = await db.edge.findMany({
          where: { toJobId: { in: frontier } },
          select: { fromJobId: true },
        });
        const next: string[] = [];
        for (const e of edges) {
          if (seen.has(e.fromJobId)) continue;
          seen.add(e.fromJobId);
          discovered.push(e.fromJobId);
          next.push(e.fromJobId);
        }
        frontier = next;
      }
      if (discovered.length > 0) {
        const linked = await db.job.findMany({
          where: { id: { in: discovered } },
          select: { id: true, linkedJobId: true },
        });
        const byId = new Map(linked.map((j) => [j.id, j]));
        for (const uid of discovered) {
          // upstream may be a soft LINK — its stacks live in the ORIGINAL
          // workdir; follow the chain in-memory (bounded, cycle-safe)
          let cur = byId.get(uid);
          for (let hops = 0; cur?.linkedJobId && hops < 16; hops++) {
            cur = byId.get(cur.linkedJobId);
          }
          const r = getRun(cur?.id ?? uid);
          if (r?.workdir && existsSync(r.workdir)) upstreamWorkdirs.set(uid, r.workdir);
        }
      }
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

    // t904 — the stack facts memo: a star's rows repeat the same handful
    // of stack paths (one per micrograph), but the old loop stat'ed the
    // SAME file once per ROW — 13k particles = 13k stat syscalls per
    // request, every page fetch included. One Map collapses the storm to
    // #distinct stacks; the value null = the stack is absent. The memo is
    // PER-REQUEST by design — FS state is the star mtime key's blind spot
    // (an extract still writing stacks must not be frozen by a cache).
    const stackFacts = new Map<
      string,
      { ownerJobId: string; stackRel: string } | null
    >();
    const factsFor = (stackAbs: string) => {
      let f = stackFacts.get(stackAbs);
      if (f === undefined) {
        f = existsSync(stackAbs) ? resolveOwner(stackAbs) : null;
        stackFacts.set(stackAbs, f);
      }
      return f;
    };

    // the ownership pass joins the pure decode to the route's answer:
    // ONE existsSync per DISTINCT stack (the memo), never per row — and a
    // NEW array (the statcache serves the decoded rows as a SHARED
    // instance; the route never mutates it — the t904 docblock's own law)
    const owned: OwnedParticleRow[] = decoded.map((d) => {
      const { ownerJobId, stackRel } =
        factsFor(d.stackAbs) ?? {
          ownerJobId: id,
          stackRel: relativizePath(workdir, d.stackRaw),
        };
      return { ...d, ownerJobId, stackRel };
    });
    if (owned.length === 0) {
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
      for (const d of owned) {
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
        total: owned.length,
        optics,
        groups,
      };
      return NextResponse.json(body);
    }

    // ---- paged mode: individual particles of one micrograph ----------
    const subset = owned.filter((d) => d.name === group);
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
    return serverErrorReply("GET /api/jobs/[id]/particles", error);
  }
}
