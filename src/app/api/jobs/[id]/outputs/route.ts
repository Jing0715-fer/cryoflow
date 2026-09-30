import { NextRequest, NextResponse } from "next/server";
import { closeSync, openSync, readFileSync, readSync, statSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
// t500 — the walk moved to ONE well (lib/relion/outputs-list): the agent's
// landscape read drinks the same cup, twins don't fork.
import {
  classify,
  friendlyLabel,
  KIND_ORDER,
  naturalCompare,
  walkWorkdir,
  type OutputFile,
  type OutputKind,
} from "@/lib/relion/outputs-list";
import { isLocalRequest } from "@/lib/http-guard";
import { readRemoteManifest, describeListingNote } from "@/lib/remote/remote-files";
import { parseRunWarnings, summarizeOutputs, type OutputSummary } from "@/lib/relion/output-summary";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs                                          */
/* (types + the walk live in lib/relion/outputs-list since t500 —      */
/*  the agent's landscape read walks the SAME cup)                     */
/* ------------------------------------------------------------------ */


/** Input file paths consumed by the run (parsed from the recorded argv). */
const INPUT_FLAGS = ["--i", "--ref", "--mask", "--f", "--coord_list", "--part_star"];

function inputFilesFromCmd(cmd: string): { flag: string; path: string }[] {
  const tokens = cmd.split(/\s+/);
  const out: { flag: string; path: string }[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    if (INPUT_FLAGS.includes(tokens[i])) {
      const p = tokens[i + 1];
      if (p && !p.startsWith("-")) out.push({ flag: tokens[i], path: p });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* t330 — key numbers + run warnings                                   */
/* ------------------------------------------------------------------ */

/** Read cap for the summary's star re-reads: the walk's 2 MB budget is a
 *  DISPLAY budget (row chips); the summary's counts (particles!) must
 *  survive the multi-MB particle stars real datasets write. 64 MB covers
 *  ~500k particles with room; beyond that the count is honestly absent. */
const SUMMARY_STAR_CAP = 64 * 1024 * 1024;

function readStarFileCapped(abs: string): string | null {
  try {
    const st = statSync(abs);
    if (!st.isFile() || st.size === 0 || st.size > SUMMARY_STAR_CAP) return null;
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/** run.out tail (≤1 MB) — the warnings card's source of truth. A partial
 *  tail can only miss EARLlier warnings, never invent one. */
function readRunOutTail(workdir: string): string | null {
  try {
    const p = path.join(workdir, "run.out");
    const st = statSync(p);
    if (!st.isFile() || st.size === 0) return null;
    const CAP = 1024 * 1024;
    if (st.size <= CAP) return readFileSync(p, "utf8");
    const fd = openSync(p, "r");
    try {
      const buf = Buffer.alloc(CAP);
      const n = readSync(fd, buf, 0, CAP, st.size - CAP);
      return buf.toString("utf8", 0, n);
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs                                          */
/* ------------------------------------------------------------------ */

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
    const engine: "relion" = "relion";

    if (!run || !run.workdir) {
      // t330 — a COMPLETED job without a run record is not "has not run
      // yet": the record was lost (app restart with a moved data dir, or a
      // stale database) and the honest remediation is a re-run.
      const note =
        job.status === "completed"
          ? "This job completed, but its run record is missing — re-run the job to rebuild it."
          : "No on-disk outputs (job has not run yet)";
      return NextResponse.json({
        workdir: null,
        engine,
        files: [],
        inputs: [],
        summary: null,
        warnings: [],
        note,
      });
    }

    const workdir = run.workdir;
    let exists = false;
    try {
      exists = statSync(workdir).isDirectory();
    } catch {
      exists = false;
    }
    if (!exists) {
      return NextResponse.json({
        workdir,
        engine,
        files: [],
        inputs: inputFilesFromCmd(run.cmd),
        summary: null,
        warnings: [],
        note: "Run directory no longer exists on disk",
      });
    }

    const { files, truncated } = walkWorkdir(workdir);
    // t289 — the remote manifest: files finalize left on the cluster join
    // the listing marked `remote` (sizes from the ledger — no SSH here, the
    // listing stays instant). Header facts (dims/slices) are unknown until
    // the file is fetched; the card speaks size + label + kind, honestly.
    let remoteTruncated = false;
    let ledgerTruncated = false;
    if (run.remote) {
      const manifest = readRemoteManifest(workdir);
      if (manifest) {
        // t464 — the ledger's own honesty flag: the enumeration that built
        // it hit the cap, so the cluster holds files this listing has never
        // heard of (not even as "on cluster" cards). The note names it.
        ledgerTruncated = manifest.truncated === true;
        const localSet = new Set(files.map((f) => f.path));
        let remoteAdded = 0;
        for (const entry of manifest.files) {
          if (localSet.has(entry.path)) continue;
          if (remoteAdded >= 300) {
            remoteTruncated = true;
            break;
          }
          const name = path.posix.basename(entry.path);
          files.push({
            path: entry.path,
            name,
            kind: classify(name),
            size: entry.size,
            label: friendlyLabel(name, entry.path),
            remote: true,
          });
          remoteAdded += 1;
        }
        if (remoteAdded > 0) {
          files.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || naturalCompare(a.path, b.path));
        }
      }
    }
    // t330 — the per-type key numbers (particles above all: the user's
    // "每一步都要突出 particles 的数量"). Pure computation over the listing
    // + capped star re-reads; honest nulls when a number can't be counted.
    const summary: OutputSummary | null = summarizeOutputs(job.type, files, {
      readStarText: (rel) => {
        const f = files.find((x) => x.path === rel && !x.remote);
        if (!f || f.size > SUMMARY_STAR_CAP) return null;
        return readStarFileCapped(path.join(workdir, rel));
      },
      readStarAbs: (abs) => readStarFileCapped(abs),
      cmd: run.cmd,
      // t353 — the cs2star cluster-side lane keeps its star on the cluster;
      // the receipt line is the key numbers' source then
      result: run.result ?? undefined,
    });
    const warnings = parseRunWarnings(readRunOutTail(workdir) ?? "");

    return NextResponse.json({
      workdir,
      engine,
      files,
      inputs: inputFilesFromCmd(run.cmd),
      cmd: run.cmd,
      summary,
      warnings,
      note: describeListingNote({
        localTruncated: truncated,
        ledgerTruncated,
        displayTruncated: remoteTruncated,
        count: files.length,
      }),
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
