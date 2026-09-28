/**
 * t427 — the autopick picks-map bench: drives the REAL GET /api/jobs/[id]/picks
 * handler in-process against the LIVE demo world (read-only — the route only
 * reads fs + DB, nothing mutates).
 *
 * Asserts:
 *   A. the autopick branch: source=autopick, 24 micrographs, 408 picks, FOMs
 *      present, dims from the upstream header, owner resolution via the edge
 *      BFS (import job owns every mic image, micPath relative to IT)
 *   B. every owner-resolved micPath exists on the owner's workdir (the map's
 *      photo door can actually render)
 *   C. the manualpick default is untouched: a job with neither layout
 *      answers the honest empty
 *   D. the local gate: a cross-site request is refused
 *
 * Run: bun scripts/t427-autopick-picks-bench.ts   (self-pins the repo DB;
 *      CRYOFLOW_DB / CRYOFLOW_DATA_DIR still override)
 */

import { existsSync } from "fs";
import path from "path";

// Self-pin the world BEFORE any src import (prisma snapshots DATABASE_URL
// at client construction). t428 lesson: an inherited shell env — start.sh's
// documented boot write of db/custom.db — silently retargeted this bench
// to an empty DB and every lookup answered "not found" while the live app
// stayed healthy. The bench owns its world now, like reboot-recover step 1.
const ROOT = process.cwd();
process.env.DATABASE_URL = process.env.CRYOFLOW_DB ?? `file:${path.join(ROOT, "db", "cryoflow.db")}`;
process.env.CRYOFLOW_DATA_DIR = process.env.CRYOFLOW_DATA_DIR ?? path.join(ROOT, "data");

const { NextRequest } = await import("next/server");
const { GET } = await import("../src/app/api/jobs/[id]/picks/route");

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass += 1;
    console.log("  ok", label);
  } else {
    fail += 1;
    console.log("  FAIL", label);
  }
}

const AUTO_ID = process.env.T427_AUTO_JOB ?? "cmukrkgjn000crjobud2kzmms";
const IMPORT_ID = process.env.T427_IMPORT_JOB ?? "cmukrk2z00002rjob254ps15r";
const POST_ID = process.env.T427_POST_JOB ?? "cmukrkglx000yrjobf05kmjc8";

function reqFor(jobId: string, crossSite = false): InstanceType<typeof NextRequest> {
  const url = `http://localhost:3000/api/jobs/${jobId}/picks`;
  const headers: Record<string, string> = crossSite
    ? { origin: "https://evil.example", host: "evil.example" }
    : { origin: "http://localhost:3000", host: "localhost:3000" };
  return new NextRequest(url, { headers });
}

async function main() {
  console.log("A. autopick branch — the live demo Auto-pick job");
  {
    const res = await GET(reqFor(AUTO_ID), {
      params: Promise.resolve({ id: AUTO_ID }),
    });
    ok(res.status === 200, `200 (got ${res.status})`);
    const body = await res.json();
    ok(body.source === "autopick", `source=autopick (got ${body.source})`);
    ok(body.micrographs?.length === 24, `24 micrographs (got ${body.micrographs?.length})`);
    ok(body.total === 408, `408 picks total (got ${body.total})`);
    const withFom = body.micrographs.filter((m: any) => (m.foms ?? []).some((f: any) => f != null));
    ok(withFom.length === 24, `all 24 entries carry FOM values (${withFom.length})`);
    ok(body.imageWidth > 0 && body.imageHeight > 0, `dims from upstream header: ${body.imageWidth}×${body.imageHeight}`);
    const allOwned = body.micrographs.every((m: any) => m.ownerJobId === IMPORT_ID);
    ok(allOwned, `every mic resolved to the import job's workdir (${IMPORT_ID})`);
    const relOk = body.micrographs.every((m: any) => m.micPath === `micrographs/${m.name}.mrc`);
    ok(relOk, "micPath = micrographs/<mic>.mrc relative to the owner");
  }

  console.log("B. the photo door can actually open — owner files exist");
  {
    const res = await GET(reqFor(AUTO_ID), { params: Promise.resolve({ id: AUTO_ID }) });
    const body = await res.json();
    let missing = 0;
    for (const m of body.micrographs) {
      const abs = path.join(ROOT, "data", "relion", "cmukrk2yy0000rjobryvy0pzu", `import_254ps15r`, m.micPath);
      if (!existsSync(abs)) missing += 1;
    }
    ok(missing === 0, `all 24 owner images exist on disk (${missing} missing)`);
  }

  console.log("C. honest empty — a job with neither pick layout");
  {
    const res = await GET(reqFor(POST_ID), { params: Promise.resolve({ id: POST_ID }) });
    ok(res.status === 200, `200 (got ${res.status})`);
    const body = await res.json();
    ok(body.source === "manualpick" && body.total === 0 && body.micrographs.length === 0,
      `source=manualpick, total=0, no micrographs`);
  }

  console.log("D. the local gate refuses cross-site reads");
  {
    const res = await GET(reqFor(AUTO_ID, true), {
      params: Promise.resolve({ id: AUTO_ID }),
    });
    ok(res.status === 403, `403 for cross-site (got ${res.status})`);
  }

  console.log(`\nt427 autopick picks bench: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

void main();
