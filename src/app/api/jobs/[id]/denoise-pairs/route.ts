import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { lineageFor } from "@/lib/relion/dispatch";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface DenoisePair {
  /** bare micrograph identity ("mic_001") — the denoised stem with the
   *  _denoised suffix and extension stripped (the wrapper's own recipe) */
  name: string;
  /** workdir-relative path served by THIS job's outputs/file door */
  denoised: string | null;
  /** workdir-relative path served by the PROVIDER job's outputs/file door
   *  — null when no input star was found, the row has no readable
   *  original, or the original escapes the provider's workdir */
  original: string | null;
  /** which job serves the original (the provider's id) */
  originalJobId: string | null;
}

export interface DenoisePairsResponse {
  jobId: string;
  jobType: string;
  total: number;
  /** rows whose original was located under a provider's workdir */
  paired: number;
  provider: { id: string; name: string } | null;
  pairs: DenoisePair[];
}

/** The stem recipe the wrapper itself uses (services/mock-cluster/fs/opt/
 * bin/relion_python_topaz MRC_RE): basename minus the movie/image extension.
 * The denoised file is <stem>_denoised.mrc, so stripping the suffix and the
 * extension yields the identity that matches the input star's rows. */
const MRC_EXT = /\.(mrc|mrcs|tif|tiff)$/i;

interface StarRows {
  /** raw _rlnMicrographName cells in file order */
  names: string[];
  /** directory holding the star — relative rows resolve against it */
  dir: string;
}

/** data_micrographs rows BY LABEL (the star-reading doctrine: never the
 *  first column — the optics sibling's columns must not shadow the names). */
function readMicrographRows(starPath: string): StarRows | null {
  let inMic = false;
  let inLoop = false;
  let col = -1;
  const names: string[] = [];
  try {
    for (const raw of readFileSync(starPath, "utf8").split(/\r?\n/)) {
      const t = raw.trim();
      if (!t) continue;
      if (t.startsWith("data_")) {
        inMic = t === "data_micrographs";
        inLoop = false;
        col = -1;
        continue;
      }
      if (!inMic) continue;
      if (t === "loop_") {
        inLoop = true;
        continue;
      }
      if (t.startsWith("_rln")) {
        if (inLoop && col < 0) {
          const m = /^(_rln\S+)(?:\s+#(\d+))?\s*$/.exec(t);
          if (m && m[1] === "_rlnMicrographName")
            col = m[2] ? parseInt(m[2], 10) - 1 : 0;
        }
        continue;
      }
      if (t.startsWith("#")) continue;
      if (!inLoop || col < 0) continue;
      const cells = t.split(/\s+/);
      if (cells[col]) names.push(cells[col]);
    }
  } catch {
    return null;
  }
  return { names, dir: path.dirname(starPath) };
}

/** the t658 basename reconciliation, brought to this route: the demo
 *  world's catalogues speak two dialects (bare rows in the corrected star,
 *  `micrographs/`-prefixed rows in the import star) while the frames live
 *  one level down — the micrographs route already reconciles by basename
 *  ("不逼世界改口"), and the pairing here needs the same amnesty or the
 *  provider leg answers paired=0 against exactly the star the run
 *  consumed. One bounded scan: the star dir's DIRECT subdirectories, one
 *  basename match each (RELION's own layout is workdir/<lane>/<file>);
 *  deeper trees are not the wrapper's shape. Misses cost a readdir of a
 *  handful of entries — the route runs per request, not per row-batch. */
function deepResolve(starDir: string, base: string): string | null {
  try {
    for (const ent of readdirSync(starDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const cand = path.join(starDir, ent.name, base);
      if (existsSync(cand)) return cand;
    }
  } catch {
    // unreadable star dir — the honest null the caller already speaks
  }
  return null;
}

/** resolve a star row to an existing file: absolute rows stay, relative rows
 *  try the star's dir, its parent and the process cwd (the wrapper's own
 *  resolution order — a staged star keeps relative names while the files
 *  land at the project's mapped path); last, the basename reconciliation
 *  under the star's own subdirectories. */
function resolveRow(name: string, starDir: string): string | null {
  const candidates = path.isAbsolute(name)
    ? [name]
    : [
        path.join(starDir, name),
        path.join(path.dirname(starDir), name),
        path.join(process.cwd(), name),
      ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return deepResolve(starDir, path.basename(name));
}

/** a workdir-relative serving path — for a REMOTE run the synced-home index
 *  names CLUSTER-absolute files (the key-files policy keeps images on the
 *  cluster), yet the basename still maps to the cluster workdir file the
 *  t289 lazy leg fetches on demand — so an escaping row degrades to its
 *  basename, the one name both worlds share. */
function relInside(workdir: string, abs: string): string | null {
  const rel = path.relative(workdir, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return path.basename(abs);
  }
  return rel.split(path.sep).join("/");
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Hardening (#5 family): workdir-derived data — the same drive-by door
    // + Host pin pair as every other workdir-reading route (http-guard).
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
    // empty = the honest absence the gallery self-hides on (not a wound)
    const empty: DenoisePairsResponse = {
      jobId: id,
      jobType: job.type,
      total: 0,
      paired: 0,
      provider: null,
      pairs: [],
    };
    if (job.type !== "topazdenoise") {
      return NextResponse.json(empty);
    }
    const run = getRun(job.id);
    if (!run?.workdir) {
      return NextResponse.json(empty);
    }

    // the denoised index — the run record's registered output first (the
    // remote twin path included), the on-disk fallback second (older runs)
    const registered = run.outputs?.micrographs_star;
    const starPath =
      registered && existsSync(registered)
        ? registered
        : existsSync(path.join(run.workdir, "denoised_micrographs.star"))
          ? path.join(run.workdir, "denoised_micrographs.star")
          : null;
    if (!starPath) {
      return NextResponse.json(empty);
    }
    const denoisedRows = readMicrographRows(starPath);
    if (!denoisedRows || denoisedRows.names.length === 0) {
      return NextResponse.json(empty);
    }

    // ---- the input catalogue: the provider the engine itself would pick.
    // lineageFor walks the graph BFS (direct parents first, soft links
    // collapsed); the first DONE provider carrying an EXISTING accepted
    // micrographs star is the same primary leg resolveInputs rides — so
    // the gallery pairs against exactly the star the run consumed.
    let providerJobId: string | null = null;
    let providerName: string | null = null;
    let inputRows: StarRows | null = null;
    const accepted = ["micrographs_star", "micrographs_ctf_star"] as const;
    try {
      const upstream = await lineageFor(job.id);
      for (const up of upstream) {
        const st = getRun(up.id);
        if (!st || !st.done || st.exitCode !== 0) continue;
        for (const key of accepted) {
          const p = st.outputs?.[key];
          if (!p || !existsSync(p)) continue;
          const rows = readMicrographRows(p);
          if (!rows || rows.names.length === 0) continue;
          providerJobId = up.id;
          providerName = up.name ?? up.type;
          inputRows = rows;
          break;
        }
        if (inputRows) break;
      }
    } catch {
      // lineage is best-effort: a graph hiccup degrades to denoised-only
    }

    // ---- pairing: stem identity first (order-independent — the wrapper
    // names each product after ITS OWN source, so stems match even if a
    // transformed star reordered rows), row order as the honest fallback.
    const stemMap = new Map<string, string>();
    if (inputRows && providerJobId) {
      const providerRun = getRun(providerJobId);
      if (providerRun?.workdir) {
        for (const n of inputRows.names) {
          const abs = resolveRow(n, inputRows.dir);
          if (!abs) continue;
          const rel = relInside(providerRun.workdir, abs);
          if (!rel) continue;
          const stem = path.basename(n).replace(MRC_EXT, "");
          if (!stemMap.has(stem)) stemMap.set(stem, rel);
        }
      }
    }
    const pairs: DenoisePair[] = [];
    let paired = 0;
    denoisedRows.names.forEach((row, i) => {
      const base = path.basename(row);
      const stem = base.replace(MRC_EXT, "").replace(/_denoised$/i, "");
      const denoisedRel = relInside(run.workdir, row);
      let originalRel: string | null = stemMap.get(stem) ?? null;
      if (!originalRel && inputRows && providerJobId && inputRows.names[i]) {
        // order fallback: the index preserves the input star's row order
        const abs = resolveRow(inputRows.names[i], inputRows.dir);
        const pRun = getRun(providerJobId);
        originalRel = abs && pRun?.workdir ? relInside(pRun.workdir, abs) : null;
      }
      if (originalRel) paired += 1;
      pairs.push({
        name: stem || base,
        denoised: denoisedRel,
        original: originalRel,
        originalJobId: originalRel ? providerJobId : null,
      });
    });

    // payload sanity: a denoise run over thousands of micrographs must not
    // ship the whole manifest — the gallery pages ("show more"), the count
    // stays honest in `total`
    const CAP = 200;
    const body: DenoisePairsResponse = {
      jobId: id,
      jobType: job.type,
      total: pairs.length,
      paired,
      provider: providerJobId
        ? { id: providerJobId, name: providerName ?? "upstream" }
        : null,
      pairs: pairs.slice(0, CAP),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/jobs/[id]/denoise-pairs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
