import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";
import { getProjectMeta } from "@/lib/projects";
import { readMrcHeader } from "@/lib/mrc";
import { biggestLoop, parseStar } from "@/lib/starfile";

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
  /** friendly caption for MRC files */
  label?: string;
  /** parsed row count for STAR files (small files only) */
  rows?: number;
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
      } else if (entry.isFile()) {
        if (files.length >= 300) {
          truncated = true;
          return;
        }
        let size = 0;
        try {
          size = statSync(childAbs).size;
        } catch {
          continue;
        }
        const kind = classify(entry.name);
        const file: OutputFile = { path: childRel, name: entry.name, kind, size };
        if (kind === "mrc") {
          const hdr = readMrcHeader(childAbs);
          if (hdr) {
            file.slices = hdr.nz;
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

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs                                          */
/* ------------------------------------------------------------------ */

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const run = getRun(job.id);
    const meta = getProjectMeta(job.projectId);
    const engine: "relion" | "sim" = run || meta?.engine === "relion" ? "relion" : "sim";

    if (!run || !run.workdir) {
      return NextResponse.json({
        workdir: null,
        engine,
        files: [],
        note: "No on-disk outputs (simulation job or not run yet)",
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
        note: "Run directory no longer exists on disk",
      });
    }

    const { files, truncated } = walkWorkdir(workdir);
    return NextResponse.json({
      workdir,
      engine,
      files,
      note: truncated ? `Listing truncated at ${files.length} files` : undefined,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
