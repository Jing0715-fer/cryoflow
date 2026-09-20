import { NextRequest, NextResponse } from "next/server";
import { closeSync, openSync, readFileSync, readSync, readdirSync, statSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readMrcHeader } from "@/lib/mrc";
import { biggestLoop, parseStar } from "@/lib/starfile";
import { isLocalRequest } from "@/lib/http-guard";
import { readRemoteManifest } from "@/lib/remote/remote-files";
import { parseRunWarnings, summarizeOutputs, type OutputSummary } from "@/lib/relion/output-summary";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* Types + helpers                                                     */
/* ------------------------------------------------------------------ */

export type OutputKind = "mrc" | "star" | "text" | "image";

export interface OutputFile {
  /** path relative to the job's workdir */
  path: string;
  name: string;
  kind: OutputKind;
  size: number;
  /** number of images in a .mrcs stack */
  slices?: number;
  /** volume grid dimensions [nx, ny, nz] — 3D maps only (stacks' in-plane
   *  axes are not navigable) */
  dims?: [number, number, number];
  /** friendly caption for MRC files */
  label?: string;
  /** parsed row count for STAR files (small files only) */
  rows?: number;
  /**
   * t289 — this file is NOT on this machine: finalize's key-files policy
   * left it on the cluster (it is in the remote manifest). The UI renders
   * an "on cluster" card instead of auto-loading a preview, and every
   * format of the file route fetches it over SSH on demand.
   */
  remote?: boolean;
  /** map header summary for 3D volumes — the identity-card data. `dims`
   *  carries the grid size; this carries where the map sits inside its
   *  parent (origin), its voxel spacing, and the density statistics the
   *  header records. Stacks (.mrcs) don't get one; additive, consumers
   *  may ignore it. */
  map?: {
    origin: [number, number, number];
    /** Å per voxel (cella[2]/nz) — 0 when the header doesn't say */
    pixel: number;
    dmin: number;
    dmax: number;
    dmean: number;
    rms: number;
  };
}

const MRC_EXT = [".mrc", ".mrcs", ".map", ".ccp4", ".ctf"];
const TEXT_EXT = [".log", ".txt", ".out", ".err", ".json", ".bild", ".dat", ".xml", ".com", ".lst", ".coord"];

function classify(name: string): OutputKind {
  const lower = name.toLowerCase();
  if (MRC_EXT.some((e) => lower.endsWith(e))) return "mrc";
  if (lower.endsWith(".star")) return "star";
  if (lower.endsWith(".eps") || lower.endsWith(".pdf")) return "image";
  if (TEXT_EXT.some((e) => lower.endsWith(e))) return "text";
  return "text";
}

/** Human-friendly caption derived from the RELION filename conventions. */
function friendlyLabel(name: string, rel: string): string {
  const lower = name.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = name.match(/^run_it(\d+)_classes\.mrcs?$/i))) return `Class averages (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_half1_class\d+\.mrc$/i))) return `Half-map 1 (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_half2_class\d+\.mrc$/i))) return `Half-map 2 (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_half0_class\d+\.mrc$/i))) return `Full map (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_class(\d+)\.mrc$/i))) return `Class ${Number(m[2])} map (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_(\d)moment(\d+)\.mrc$/i))) return `VDAM moment ${Number(m[3])} (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_data\.star$/i))) return `Particles (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_model\.star$/i))) return `Model (iter ${Number(m[1])})`;
  if ((m = name.match(/^run_it(\d+)_optimiser\.star$/i))) return `Optimiser (iter ${Number(m[1])})`;
  if (lower === "postprocess.mrc") return "Sharpened map";
  if (lower === "postprocess_masked.mrc") return "Masked sharpened map";
  if (lower === "postprocess.star") return "Postprocess (FSC + Guinier)";
  if (lower === "mask.mrc") return "Mask";
  if (lower === "micrographs.star") return "Micrographs";
  if (lower === "micrographs_ctf.star") return "Micrographs (CTF)";
  if (lower === "particles.star") return "Particles";
  if (lower === "manualpick.star") return "Picked coordinates";
  if (lower === "run.out") return "Run log";
  if (lower === "run.err") return "Run errors";
  if (lower === "logfile.pdf") return "PDF report";
  if (lower.endsWith("_fsc.eps")) return "FSC curve plot";
  if (lower.endsWith("_guinier.eps")) return "Guinier plot";
  if (lower.endsWith(".ctf")) return `CTF diagnostic — ${name.replace(/\.ctf$/i, "").replace(/^Falcon_\d{4}_\d{2}_\d{2}-/, "")}`;
  if (lower.endsWith(".mrcs") && rel.toLowerCase().includes("micrographs")) {
    return `Particle stack — ${name.replace(/\.mrcs$/i, "").replace(/^Falcon_\d{4}_\d{2}_\d{2}-/, "")}`;
  }
  if (lower.endsWith(".mrc") && rel.toLowerCase().includes("micrographs")) {
    return `Micrograph ${name.replace(/\.mrc$/i, "").replace(/^Falcon_\d{4}_\d{2}_\d{2}-/, "")}`;
  }
  if (lower.endsWith(".mrcs")) return `Stack ${name}`;
  // generic fallback: filename without extension
  return name.replace(/\.[^.]+$/, "");
}

const KIND_ORDER: Record<OutputKind, number> = { mrc: 0, star: 1, image: 2, text: 3 };

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Walk the workdir (depth ≤ 3, ≤ 300 files, skip dotfiles). */
function walkWorkdir(workdir: string): { files: OutputFile[]; truncated: boolean } {
  const files: OutputFile[] = [];
  let truncated = false;
  let starBudget = 60; // max STAR files parsed for the row-count chips

  const visit = (dir: string, rel: string, depth: number) => {
    if (truncated || depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => naturalCompare(a.name, b.name));
    for (const entry of entries) {
      if (truncated) return;
      if (entry.name.startsWith(".") || entry.name === ".DS_Store") continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(childAbs, childRel, depth + 1);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        if (files.length >= 300) {
          truncated = true;
          return;
        }
        let st;
        try {
          st = statSync(childAbs); // follows symlinks
        } catch {
          continue; // dead link or vanished file — the listing moves on
        }
        // A symlinked DIRECTORY is not followed (loop safety; the walk
        // stays inside the workdir it was given). A symlinked FILE is
        // listed like any file — the mapimport handler links the imported
        // map into its own workdir (one copy on disk), and the Results
        // view must see the job's own map (t256: the identity card reads
        // the same listing).
        if (st.isDirectory()) continue;
        const size = st.size;
        const kind = classify(entry.name);
        const file: OutputFile = { path: childRel, name: entry.name, kind, size };
        if (kind === "mrc") {
          const hdr = readMrcHeader(childAbs);
          if (hdr) {
            file.slices = hdr.nz;
            if (!entry.name.toLowerCase().endsWith(".mrcs")) {
              file.dims = [hdr.nx, hdr.ny, hdr.nz];
              // identity-card fields ride the header read we already did —
              // zero extra I/O (t256)
              file.map = {
                origin: hdr.start,
                pixel: hdr.cella[2] > 0 && hdr.nz > 0 ? hdr.cella[2] / hdr.nz : 0,
                dmin: hdr.dmin,
                dmax: hdr.dmax,
                dmean: hdr.dmean,
                rms: hdr.rms,
              };
            }
            file.label = friendlyLabel(entry.name, childRel);
          }
        } else if (kind === "star" && size <= 2 * 1024 * 1024 && starBudget > 0) {
          starBudget--;
          try {
            const parsed = parseStar(readFileSync(childAbs, "utf8"), 200_000);
            const loop = biggestLoop(parsed);
            if (loop) file.rows = loop.rows.length;
          } catch {
            /* preview-only chip */
          }
        }
        files.push(file);
      }
    }
  };

  visit(workdir, "", 0);
  files.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || naturalCompare(a.path, b.path));
  return { files, truncated };
}

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
    if (run.remote) {
      const manifest = readRemoteManifest(workdir);
      if (manifest) {
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
      note: truncated
        ? `Listing truncated at ${files.length} files`
        : remoteTruncated
          ? `Listing truncated at ${files.length} files (remote manifest capped)`
          : undefined,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
