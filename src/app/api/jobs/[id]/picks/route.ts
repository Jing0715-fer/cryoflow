import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readMrcHeader } from "@/lib/mrc";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface PickEntry {
  /** workdir-relative micrograph path (feeds outputs/file PNG) */
  micPath: string;
  name: string;
  count: number;
  /** [x, y] detector-pixel coordinates (origin bottom-left, as picked) */
  picks: [number, number][];
  /** t427 — per-pick autopick figure-of-merit, aligned with `picks`.
   *  Present only for the RELION 5 per-micrograph autopick layout;
   *  manualpick coordinates carry no FOM. */
  foms?: (number | null)[];
  /** t427 — the job whose workdir actually holds the micrograph IMAGE
   *  (autopick workdirs carry only the coordinate stars; the image sits
   *  upstream — import/motioncorr/ctffind). Absent = this job's own. */
  ownerJobId?: string;
}

export interface PicksResponse {
  jobId: string;
  /** t427 — which layout answered: manualpick.star, or the RELION 5
   *  per-micrograph autopick coordinate stars */
  source: "manualpick" | "autopick";
  total: number;
  /** detector dimensions of the first micrograph (square frames) */
  imageWidth: number;
  imageHeight: number;
  micrographs: PickEntry[];
}

/**
 * GET /api/jobs/[id]/picks — picked-particle coordinates, grouped per
 * micrograph. Two layouts answer:
 *   manualpick — the job's own manualpick.star (X, Y, mic per row);
 *   autopick   — RELION 5's per-micrograph coordinate stars under
 *                micrographs/ (X, Y, FOM, class per row — t427). The FOM
 *                per pick is what makes the map a QA tool: scrub the
 *                threshold, watch junk appear, set the real autopick
 *                threshold accordingly.
 * Coordinates stay in detector pixel space; the client maps them onto MRC
 * thumbnails with an SVG viewBox (and flips Y — RELION .coords are origin
 * bottom-left while MRC rendering is top-down).
 *
 * t427 — the mic IMAGE may live upstream (autopick workdirs carry only
 * coordinate stars): an edge BFS (same batched shape as the particles
 * route) finds the ancestor whose workdir holds `<mic>.mrc`, and the
 * entry names that owner so the client renders through ITS file route.
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
    const empty: PicksResponse = {
      jobId: id,
      source: "manualpick",
      total: 0,
      imageWidth: 0,
      imageHeight: 0,
      micrographs: [],
    };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }
    const starPath = path.join(run.workdir, "manualpick.star");

    // ---- autopick branch (t427): RELION 5 per-micrograph coord stars ----
    // No manualpick.star but a micrographs/ dir of coordinate stars → the
    // RELION 5 autopick layout: one star per micrograph, columns X, Y,
    // FOM (optional), class. Mic identity comes from the FILENAME
    // (mic_001_autopick.star → mic_001); the image is resolved upstream.
    if (!existsSync(starPath)) {
      const coordDir = path.join(run.workdir, "micrographs");
      let coordFiles: string[] = [];
      try {
        coordFiles = existsSync(coordDir)
          ? readdirSync(coordDir).filter((f) => f.endsWith(".star")).sort()
          : [];
      } catch {
        /* unreadable dir — fall through to empty */
      }
      if (coordFiles.length > 0) {
        const parsed = parseAutopickCoordDir(coordDir, coordFiles);
        if (parsed.micrographs.length === 0) {
          return NextResponse.json(empty);
        }
        // image owner: BFS upstream (same batched shape as the particles
        // route) for the ancestor whose workdir holds `<mic>.mrc`
        const owners = await findUpstreamMicOwners(run.workdir, job.id, parsed.micNames);
        let imageWidth = 0;
        let imageHeight = 0;
        for (const m of parsed.micrographs) {
          const owner = owners.get(m.micName);
          if (!owner) continue;
          const abs = path.join(owner.workdir, owner.rel);
          const hdr = existsSync(abs) ? readMrcHeader(abs) : null;
          if (hdr) {
            imageWidth = hdr.nx;
            imageHeight = hdr.ny;
            break;
          }
        }
        const micrographs: PickEntry[] = parsed.micrographs
          .map((m) => {
            const owner = owners.get(m.micName);
            return {
              // micPath is relative to the OWNER workdir when the image
              // lives upstream — the client renders through the owner's
              // file route; absent owner → this job's own (404s honestly)
              micPath: owner?.rel ?? `micrographs/${m.micName}`,
              name: m.micName,
              count: m.picks.length,
              picks: m.picks,
              foms: m.foms,
              ...(owner ? { ownerJobId: owner.jobId } : {}),
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const total = micrographs.reduce((n, m) => n + m.count, 0);
        return NextResponse.json({
          jobId: id,
          source: "autopick",
          total,
          imageWidth,
          imageHeight,
          micrographs,
        } satisfies PicksResponse);
      }
      return NextResponse.json(empty);
    }

    const lines = readFileSync(starPath, "utf8").split(/\r?\n/);
    // columns: _rlnCoordinateX #1 _rlnCoordinateY #2 _rlnMicrographName #3
    const perMic = new Map<string, [number, number][]>();
    for (const raw of lines) {
      const t = raw.trim();
      if (!t || t.startsWith("#") || t.startsWith("_") || t === "loop_" || t.startsWith("data_")) continue;
      const cells = t.split(/\s+/);
      if (cells.length < 3) continue;
      const x = parseFloat(cells[0]);
      const y = parseFloat(cells[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const mic = cells[2].replace(/^\.?\//, "");
      let arr = perMic.get(mic);
      if (!arr) {
        arr = [];
        perMic.set(mic, arr);
      }
      arr.push([x, y]);
    }
    if (perMic.size === 0) {
      return NextResponse.json(empty);
    }

    // detector dimensions from the first available micrograph
    let imageWidth = 0;
    let imageHeight = 0;
    for (const mic of perMic.keys()) {
      const abs = path.join(run.workdir, mic);
      if (!existsSync(abs)) continue;
      const hdr = readMrcHeader(abs);
      if (hdr) {
        imageWidth = hdr.nx;
        imageHeight = hdr.ny;
      }
      break;
    }

    const micrographs: PickEntry[] = [...perMic.entries()]
      .map(([mic, picks]) => ({
        micPath: mic,
        name: path.basename(mic),
        count: picks.length,
        picks,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const total = micrographs.reduce((n, m) => n + m.count, 0);
    return NextResponse.json({
      jobId: id,
      source: "manualpick",
      total,
      imageWidth,
      imageHeight,
      micrographs,
    } satisfies PicksResponse);
  } catch (error) {
    console.error("GET /api/jobs/[id]/picks failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/* t427 — the RELION 5 per-micrograph autopick layout                  */
/* ------------------------------------------------------------------ */

interface AutopickMic {
  /** mic identity from the filename: mic_001_autopick.star → mic_001 */
  micName: string;
  picks: [number, number][];
  foms: (number | null)[];
}

/**
 * Parse a directory of per-micrograph coordinate stars. Each file's
 * header declares its own column order (RELION 5 writes X, Y, FOM,
 * class — but the loop is read by label, not by position, so a file
 * without the FOM column still parses with honest null FOMs).
 */
function parseAutopickCoordDir(
  coordDir: string,
  files: string[]
): { micrographs: AutopickMic[]; micNames: string[] } {
  const micrographs: AutopickMic[] = [];
  const micNames: string[] = [];
  for (const f of files) {
    const abs = path.join(coordDir, f);
    try {
      const head = readFileSync(abs, "utf8");
      if (!head.includes("_rlnCoordinateX")) continue; // not a coord star
      // column order from the label block
      const labels = new Map<string, number>();
      const rows: string[][] = [];
      for (const raw of head.split(/\r?\n/)) {
        const t = raw.trim();
        if (!t || t === "loop_" || t.startsWith("data_")) continue;
        if (t.startsWith("#")) continue;
        if (t.startsWith("_")) {
          const m = t.match(/^(\S+)\s+#(\d+)$/);
          if (m) labels.set(m[1], Number(m[2]) - 1);
          continue;
        }
        rows.push(t.split(/\s+/));
      }
      const ix = labels.get("_rlnCoordinateX");
      const iy = labels.get("_rlnCoordinateY");
      if (ix == null || iy == null) continue;
      const ifom = labels.get("_rlnAutopickFigureOfMerit");
      const picks: [number, number][] = [];
      const foms: (number | null)[] = [];
      for (const cells of rows) {
        const x = parseFloat(cells[ix]);
        const y = parseFloat(cells[iy]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        picks.push([x, y]);
        if (ifom != null && cells[ifom] != null) {
          const v = parseFloat(cells[ifom]);
          foms.push(Number.isFinite(v) ? v : null);
        } else {
          foms.push(null);
        }
      }
      if (picks.length === 0) continue;
      // RELION 5 names them `<mic>_autopick.star`; accept bare `<mic>.star` too
      const micName = f.replace(/\.star$/i, "").replace(/_autopick$/i, "");
      micrographs.push({ micName, picks, foms });
      micNames.push(micName);
    } catch {
      /* unreadable file — skip, the map answers from what reads */
    }
  }
  return { micrographs, micNames };
}

interface MicOwner {
  jobId: string;
  /** image path relative to that job's workdir */
  rel: string;
  workdir: string;
}

/**
 * BFS upstream over workflow edges (one edge query per depth level, one
 * job query per batch — the particles route's batching doctrine) looking
 * for the ancestor whose workdir holds each mic's IMAGE. Candidate
 * spellings mirror how the pipeline actually lays mics down:
 *   micrographs/<mic>.mrc   (import/motioncorr/ctffind output layout)
 *   <mic>.mrc               (flat workdirs)
 * The nearest ancestor wins; a mic that resolves nowhere simply has no
 * owner and the client answers honestly (no photo door).
 */
async function findUpstreamMicOwners(
  ownWorkdir: string,
  jobId: string,
  micNames: string[]
): Promise<Map<string, MicOwner>> {
  const owners = new Map<string, MicOwner>();
  const wanted = new Set(micNames);
  const candidateRels = (mic: string): string[] => [
    `micrographs/${mic}.mrc`,
    `${mic}.mrc`,
  ];

  // this job's own workdir first (the defensive default)
  for (const mic of wanted) {
    for (const rel of candidateRels(mic)) {
      if (existsSync(path.join(ownWorkdir, rel))) {
        owners.set(mic, { jobId, rel, workdir: ownWorkdir });
        break;
      }
    }
  }
  if (owners.size === wanted.size) return owners;

  const seen = new Set<string>([jobId]);
  let frontier = [jobId];
  while (frontier.length > 0 && owners.size < wanted.size) {
    const edges = await db.edge.findMany({
      where: { toJobId: { in: frontier } },
      select: { fromJobId: true },
    });
    const next: string[] = [];
    for (const e of edges) {
      if (seen.has(e.fromJobId)) continue;
      seen.add(e.fromJobId);
      next.push(e.fromJobId);
    }
    if (next.length === 0) break;
    const jobs = await db.job.findMany({
      where: { id: { in: next } },
      select: { id: true, linkedJobId: true },
    });
    const byId = new Map(jobs.map((j) => [j.id, j]));
    for (const uid of next) {
      // soft links collapse in-memory (they are collapsed at creation;
      // the hop loop is defensive only — same bounded walk as particles)
      let cur = byId.get(uid);
      for (let hops = 0; cur?.linkedJobId && hops < 16; hops++) {
        cur = byId.get(cur.linkedJobId);
      }
      const rid = cur?.id ?? uid;
      const r = getRun(rid);
      if (!r?.workdir || !existsSync(r.workdir)) continue;
      for (const mic of wanted) {
        if (owners.has(mic)) continue;
        for (const rel of candidateRels(mic)) {
          if (existsSync(path.join(r.workdir, rel))) {
            owners.set(mic, { jobId: rid, rel, workdir: r.workdir });
            break;
          }
        }
      }
    }
    frontier = next;
  }
  return owners;
}
