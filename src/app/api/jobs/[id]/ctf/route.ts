import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface CtfMicrograph {
  /** basename of _rlnMicrographName (display) */
  name: string;
  /** _rlnMicrographName as stored — relative to the job workdir (file API) */
  relPath: string;
  /** µm */
  defocusU: number;
  /** µm */
  defocusV: number;
  /** µm (|U − V|) */
  astigmatism: number;
  /** degrees */
  defocusAngle: number;
  /** ctffind figure of merit (0–1) */
  fom: number;
  /** Å, ctffind fit limit */
  maxResolution: number;
}

export interface CtfSummary {
  count: number;
  meanDefocus: number;
  minDefocus: number;
  maxDefocus: number;
  maxAstigmatism: number;
  meanFom: number;
  worstResolution: number;
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

function parseCtfStar(text: string): CtfMicrograph[] {
  // Block-aware parse: only data rows of the loop block that OWNS the
  // micrograph/defocus columns count — the optics block shares the file
  // and its rows (1 optGroup1 1.77 300 …) would otherwise leak in.
  // Columns are frozen when the FIRST data row of a loop arrives, so every
  // label of that loop is already known.
  const lines = text.split("\n");
  const rows: CtfMicrograph[] = [];

  let inLoop = false;
  let labels = new Map<string, number>();
  let cols: { name: number; u: number; v: number; astig: number; angle: number; fom: number; maxres: number } | null = null;

  const freeze = (): { name: number; u: number; v: number; astig: number; angle: number; fom: number; maxres: number } | null => {
    if (
      labels.has("_rlnMicrographName") &&
      labels.has("_rlnDefocusU") &&
      labels.has("_rlnDefocusV")
    ) {
      return {
        name: labels.get("_rlnMicrographName")!,
        u: labels.get("_rlnDefocusU")!,
        v: labels.get("_rlnDefocusV")!,
        astig: labels.get("_rlnCtfAstigmatism") ?? -1,
        angle: labels.get("_rlnDefocusAngle") ?? -1,
        fom: labels.get("_rlnCtfFigureOfMerit") ?? -1,
        maxres: labels.get("_rlnCtfMaxResolution") ?? -1,
      };
    }
    return null;
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (t === "loop_") {
      inLoop = true;
      labels = new Map();
      cols = null; // each loop is a fresh table
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      labels = new Map();
      cols = null;
      continue;
    }
    if (inLoop && t.startsWith("_")) {
      const m = /^(\S+)(?:\s+#?(\d+))?\s*$/.exec(t);
      if (m) labels.set(m[1], m[2] ? parseInt(m[2], 10) - 1 : labels.size);
      continue;
    }
    if (!t || t.startsWith("#")) continue;
    // first data row of this loop → try to freeze the column map
    if (inLoop && !cols) {
      cols = freeze();
      if (!cols) continue;
    }
    if (!cols) continue;
    const cells = t.split(/\s+/);
    if (cells.length <= Math.max(cols.name, cols.u, cols.v)) continue;
    const u = Number(cells[cols.u]);
    const v = Number(cells[cols.v]);
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    const name = cells[cols.name] ?? "";
    // RELION writes ctffind defocus (and astigmatism) in Ångström — a
    // single magnitude check keeps µm-native files untouched too.
    const inAngstrom = Math.abs(u) > 1000 || Math.abs(v) > 1000;
    const scale = inAngstrom ? 1 / 10_000 : 1;
    const astigRaw = cols.astig >= 0 ? Number(cells[cols.astig]) || Math.abs(u - v) : Math.abs(u - v);
    rows.push({
      name: name.split("/").pop() ?? name,
      relPath: name,
      defocusU: u * scale,
      defocusV: v * scale,
      astigmatism: astigRaw * scale,
      defocusAngle: cols.angle >= 0 ? Number(cells[cols.angle]) || 0 : 0,
      fom: cols.fom >= 0 ? Number(cells[cols.fom]) || 0 : 0,
      maxResolution: cols.maxres >= 0 ? Number(cells[cols.maxres]) || 0 : 0,
    });
  }
  return rows;
}

/**
 * GET /api/jobs/[id]/ctf — per-micrograph CTF fit quality of a CtfFind job
 * (defocus / astigmatism / figure-of-merit / fit resolution), straight from
 * the micrographs_ctf.star RELION writes into the job workdir.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ micrographs: [], summary: null });
    }

    // CtfFind writes micrographs_ctf.star at the workdir root; fall back to
    // any nested *ctf*.star (ctf_refine / external layouts).
    const candidates: string[] = [];
    const root = path.join(run.workdir, "micrographs_ctf.star");
    if (existsSync(root)) candidates.push(root);
    if (candidates.length === 0) {
      for (const name of readdirSync(run.workdir)) {
        if (/ctf.*\.star$/i.test(name) && !/optimiser|data\.star/i.test(name)) {
          candidates.push(path.join(run.workdir, name));
        }
      }
    }
    if (candidates.length === 0) {
      return NextResponse.json({ micrographs: [], summary: null });
    }

    const micrographs = parseCtfStar(readFileSync(candidates[0], "utf8"));
    micrographs.sort((a, b) => b.defocusU - a.defocusU);

    let summary: CtfSummary | null = null;
    if (micrographs.length > 0) {
      const defoci = micrographs.map((m) => (m.defocusU + m.defocusV) / 2);
      const foms = micrographs.filter((m) => m.fom > 0).map((m) => m.fom);
      const maxRes = micrographs.filter((m) => m.maxResolution > 0).map((m) => m.maxResolution);
      summary = {
        count: micrographs.length,
        meanDefocus: defoci.reduce((s, d) => s + d, 0) / defoci.length,
        minDefocus: Math.min(...defoci),
        maxDefocus: Math.max(...defoci),
        maxAstigmatism: Math.max(...micrographs.map((m) => m.astigmatism)),
        meanFom: foms.length > 0 ? foms.reduce((s, f) => s + f, 0) / foms.length : 0,
        worstResolution: maxRes.length > 0 ? Math.max(...maxRes) : 0,
      };
    }

    return NextResponse.json({ jobId: id, micrographs, summary });
  } catch (error) {
    console.error("GET /api/jobs/[id]/ctf failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
