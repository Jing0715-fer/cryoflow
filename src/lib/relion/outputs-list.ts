/**
 * CryoFlow — the job workdir listing, ONE well (t500).
 *
 * The outputs route lived alone with this walk for its whole life; the
 * agent's new landscape read (get_map_landscape, t500) needs the SAME
 * listing — files, kinds, dims, friendly labels — and a second copy in
 * ai/tools.ts would be a twin waiting to fork. So the walk moves here
 * VERBATIM (a change of address, not a rewrite — the qc-report t197
 * precedent): same classify, same captions, same depth/cap budgets,
 * same symlink law (directories never followed, dead links skipped,
 * symlinked FILES listed — the t256 mapimport law). The route keeps
 * its own perimeter (guard, run resolution, summary/warnings) and
 * drinks from this cup; the tool drinks the same cup server-side.
 *
 * SERVER ONLY — readMrcHeader touches the filesystem. Client code must
 * never import this module; the client-side walk constants (MAIN_MAP_RE,
 * MAP_BRIEF_CAP) live in lib/map-walk.ts instead, which stays pure.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { readMrcHeader } from "@/lib/mrc";
import { biggestLoop, parseStar } from "@/lib/starfile";

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

export const MRC_EXT = [".mrc", ".mrcs", ".map", ".ccp4", ".ctf"];
const TEXT_EXT = [".log", ".txt", ".out", ".err", ".json", ".bild", ".dat", ".xml", ".com", ".lst", ".coord"];

export function classify(name: string): OutputKind {
  const lower = name.toLowerCase();
  if (MRC_EXT.some((e) => lower.endsWith(e))) return "mrc";
  if (lower.endsWith(".star")) return "star";
  if (lower.endsWith(".eps") || lower.endsWith(".pdf")) return "image";
  if (TEXT_EXT.some((e) => lower.endsWith(e))) return "text";
  return "text";
}

/** Human-friendly caption derived from the RELION filename conventions. */
export function friendlyLabel(name: string, rel: string): string {
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

export const KIND_ORDER: Record<OutputKind, number> = { mrc: 0, star: 1, image: 2, text: 3 };

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Walk the workdir (depth ≤ 3, ≤ 300 files, skip dotfiles). */
export function walkWorkdir(workdir: string): { files: OutputFile[]; truncated: boolean } {
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
