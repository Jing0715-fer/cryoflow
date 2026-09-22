import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { readMrcHeader } from "@/lib/mrc";
import { RELION_DIR } from "@/lib/paths";
import { isLocalRequest } from "@/lib/http-guard";
import { remoteLiveIterations } from "@/lib/remote/iteration-live";
import { readRemoteManifest } from "@/lib/remote/remote-files";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface ClassOccupancy {
  cls: number;
  count: number;
  /** share of total particles, 0–1 */
  fraction: number;
}

/** Column index of `label` inside the first data loop of a STAR text. */
function labelColumn(lines: string[], label: string): number {
  let inLoop = false;
  let pos = 0; // 1-based running position in the current loop
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "loop_") {
      inLoop = true;
      pos = 0;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    pos++;
    if (t.startsWith(label)) {
      // "_rlnFoo #12" (RELION 5) or "_rlnFoo 12" (plain)
      const m = /#\s*(\d+)\s*$/.exec(t) ?? /^\S+\s+(\d+)\s*$/.exec(t);
      return m ? parseInt(m[1], 10) - 1 : pos - 1;
    }
  }
  return -1;
}

/** Line index of the label definition inside its loop — data rows of THAT
 *  loop start after the loop's label run. Scoping the row scan to this
 *  region is what keeps the optics-group row ("1 optGroup1 300 …") from
 *  being counted as a particle with class parseInt("2.7") = 2. */
function labelLineIndex(lines: string[], label: string): number {
  let inLoop = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "loop_") {
      inLoop = true;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    if (t.startsWith(label)) return i;
  }
  return -1;
}

/** the class-average stack name dialect this route accepts (mirror,
 * cluster listing or the finalize manifest all speak it) — the unmasked
 * variant outranks the plain one, the highest iteration wins the rest. */
const STACK_NAME_PATTERNS = [
  /^(?:run_it|_it)\d+_classes\.mrcs?$/i, // per-iteration masked
  /^(?:run_it|_it)\d+_unmasked_classes\.mrcs?$/i, // per-iteration unmasked
  /^run_unmasked_classes\.mrcs?$/i, // RELION 5 final unmasked
];

/** Pick the gallery's class-averages stack from a list of file names:
 * RELION 5's final unmasked stack wins, else the newest per-iteration
 * stack (the same preference the mirror leg always spoke). */
function pickStackName(names: string[]): string | null {
  const stacks = names.filter((n) => STACK_NAME_PATTERNS.some((re) => re.test(n)));
  const unmasked = stacks.find((n) =>
    /^(?:run_it|_it)\d+_unmasked_classes\.mrcs?$|^run_unmasked_classes\.mrcs?$/i.test(n)
  );
  if (unmasked) return unmasked;
  let bestIter = -1;
  let best: string | null = null;
  for (const n of stacks) {
    const m = n.match(/(?:run_it|_it)(\d+)_classes/i);
    if (m && Number(m[1]) > bestIter) {
      bestIter = Number(m[1]);
      best = n;
    }
  }
  return best;
}

/**
 * GET /api/jobs/[id]/classes — class occupancy of a 2D/3D classification
 * job from the run_itXXX_data.star (particle→class assignment).
 * Default: highest iteration; ?iter=N selects a specific round.
 * Percentages sum to 1.
 *
 * t355 — a CLUSTER-RUN classification answers here too: the key-files
 * policy keeps the class-average stacks ON the cluster (a real 100-class
 * 2D run writes 25–100 MB stacks, over the 16 MB default cap), so the
 * mirror-only lookup answered classesFile: null and the selection gallery
 * rendered “no image” on every card. The stack name (and, when the mirror
 * is cold, the occupancy itself) now comes from ONE 12s-TTL'd SSH round
 * against the run's own cluster workdir — the thumbnails then lazy-fetch
 * through the outputs/file route as they always did. When even the wire
 * is down (connection deleted), the finalize manifest still names the
 * stacks with zero SSH.
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
    // workdir resolution priority:
    // 1. ?workdir= override (for manual / externally-produced results) —
    //    CONSTRAINED to the app's data/relion subtree: an unrestricted
    //    client-supplied absolute path made this route a filesystem-existence
    //    oracle (200 + counts vs empty) that could read class data from
    //    anywhere on the host
    // 2. run record in engine-state.json (jobs dispatched through the engine)
    // 3. computed from job.type + job.id (dispatched jobs whose record was
    //    persisted to disk; manual runs also land here as a fallback)
    const url = new URL(request.url);
    // Task 184: the containment boundary and the fallback join both speak the
    // single RELION_DIR name — no private (DATA_DIR, "relion") re-derivations.
    const relionRoot = RELION_DIR;
    let workdir: string;
    const override = url.searchParams.get("workdir");
    if (override) {
      const resolved = path.resolve(override);
      const inside =
        resolved === relionRoot || resolved.startsWith(relionRoot + path.sep);
      if (!inside) {
        return NextResponse.json(
          { error: "workdir override must stay inside the data/relion project tree" },
          { status: 400 }
        );
      }
      workdir = resolved;
    } else {
      workdir =
        run?.workdir ??
        path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
    }
    // t355 — a missing mirror is no longer a hard stop: a remote run's
    // gallery can still be answered from the cluster (and its finalize
    // manifest). Everything below guards on mirrorOk.
    const mirrorOk = existsSync(workdir);

    // highest iteration data star = final particle→class assignment
    let best: { iteration: number; file: string } | null = null;
    if (mirrorOk) {
      for (const name of readdirSync(workdir)) {
        // Match both RELION standard "run_itNNN_data.star" and SGD "_itNNN_data.star"
        const m = name.match(/^(?:run_it|_it)(\d+)_data\.star$/i);
        if (!m) continue;
        const iteration = Number(m[1]);
        if (!best || iteration > best.iteration) {
          best = { iteration, file: name };
        }
      }
      // explicit ?iter= overrides (round-filtered galleries)
      const wantIter = parseInt(new URL(request.url).searchParams.get("iter") ?? "", 10);
      if (Number.isFinite(wantIter)) {
        const exact = readdirSync(workdir).find(
          (name) => name.match(new RegExp(`^(?:run_it|_it)${String(wantIter).padStart(3, "0")}_data\\.star$`, "i"))
        );
        if (exact) best = { iteration: wantIter, file: exact };
      }
    }

    // class-averages stack for the selection gallery: RELION 5 writes the
    // final unmasked stack, falling back to the newest per-iteration stack
    // (the collector below MUST know every name the finders look for —
    // a narrower filter here silently dead-codes the finders underneath:
    // found by qa58 seeding, where run_unmasked_classes.mrcs never made
    // it into candidates and the gallery rendered "no image" everywhere)
    let classesFile: string | null = null;
    let classesSlices: number | null = null;
    const stackName = mirrorOk ? pickStackName(readdirSync(workdir)) : null;
    if (stackName) {
      const stackAbs = path.join(workdir, stackName);
      const hdr = readMrcHeader(stackAbs);
      if (hdr) {
        classesFile = stackName;
        classesSlices = hdr.nz;
      }
    }

    // mtime-cached occupancy count — data stars are MB-scale and re-scanned
    // per request before; the computed map only changes when the file does
    let classes: ClassOccupancy[] = [];
    let total = 0;
    if (best) {
      const counted = cachedFileCompute(
        path.join(workdir, best.file),
        "classes:occupancy",
        (text) => {
          const lines = text.split("\n");
          const classCol = labelColumn(lines, "_rlnClassNumber");
          if (classCol < 0) return { classCol, counts: [] as [number, number][], total: 0 };
          const counts = new Map<number, number>();
          let totalCount = 0;
          // count rows ONLY inside the loop that owns _rlnClassNumber — the
          // optics row above the particles loop must never inflate a class
          const headerEnd = labelLineIndex(lines, "_rlnClassNumber");
          for (let r = headerEnd + 1; r < lines.length; r++) {
            const t = lines[r].trim();
            if (t === "loop_" || t.startsWith("data_")) break; // loop region over
            if (!t || t.startsWith("#") || t.startsWith("_")) continue;
            const cells = t.split(/\s+/);
            if (cells.length <= classCol) continue;
            const cls = parseInt(cells[classCol], 10);
            if (Number.isFinite(cls) && cls > 0) {
              counts.set(cls, (counts.get(cls) ?? 0) + 1);
              totalCount++;
            }
          }
          return { classCol, counts: [...counts.entries()], total: totalCount };
        }
      );
      if (counted) {
        total = counted.total;
        classes = counted.counts
          .map(([cls, count]) => ({ cls, count, fraction: total > 0 ? count / total : 0 }))
          .sort((a, b) => a.cls - b.cls);
      }
    }

    let iteration: number | null = best?.iteration ?? null;

    // t355 — the REMOTE FILL: a cluster-run classification whose mirror is
    // stackless (the key-files caps kept the .mrcs on the cluster) or cold
    // (the data stars stayed too) still answers the full gallery shape.
    // ONE 12s-TTL'd SSH round names the stack and — only where the mirror
    // had nothing — the occupancy itself; the thumbnails then lazy-fetch
    // through /outputs/file exactly as they always did. When the wire is
    // down (connection deleted), the finalize manifest still names the
    // stacks with zero SSH.
    if (run?.remote && (classesFile == null || classes.length === 0)) {
      const remote = await remoteLiveIterations(job.id, {});
      if (!remote.error) {
        if (classesFile == null) {
          classesFile = remote.classesFile;
          if (classesSlices == null) classesSlices = remote.classesSlices;
        }
        if (classes.length === 0 && remote.classes.length > 0) {
          classes = remote.classes.map((c) => ({ cls: c.cls, count: c.count, fraction: c.fraction }));
          total = remote.total;
          if (iteration == null) iteration = remote.latest;
        }
      }
      if (classesFile == null) {
        // the manifest leg — names only (sizes ride along but slices do
        // not; the gallery falls back to the class count for that)
        const manifest = readRemoteManifest(workdir);
        if (manifest) {
          const fromManifest = pickStackName(manifest.files.map((f) => f.path));
          if (fromManifest) classesFile = fromManifest;
        }
      }
    }

    return NextResponse.json({
      jobId: id,
      classes,
      total,
      iteration,
      // workdir-relative class-averages stack (.mrcs) — one slice per class,
      // renderable via /outputs/file?path=<classesFile>&format=png&slice=N-1
      classesFile,
      classesSlices,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/classes failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
