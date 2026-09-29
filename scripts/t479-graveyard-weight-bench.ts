/**
 * t479 — the graveyard learns its weight (and the burial door).
 *
 * t478 opened the drawer; the graves had no WEIGHT. The storage walk is
 * physical-first: an orphaned workdir's bytes count in the map's totals
 * but nothing could name them. This window gives every grave its
 * surviving workdir's weight (graveRowsOf — one brain, both faces) and
 * opens the bulk burial door (DELETE /api/jobs/deleted): the grave dies
 * as a NAME, its workdir dies ONLY with a free id (a restored job lives
 * in that very directory), restorable graves are spared unless the armed
 * second step says otherwise.
 *
 * This bench pins:
 *  T1  the weight brain: bytes = the walked workdir sum; outside-RELION_DIR
 *      and gone-or-empty workdirs OMIT the key (the row never lies with a
 *      zero); the two faces stay JSON-equal with the new field
 *  T2  the tool face: the summary speaks the graveyard's weight (and only
 *      when there is weight)
 *  T3  the default burial door: restorable spared BY NAME; spent buried
 *      (tombstone gone, workdir reclaimed); an OCCUPIED grave's workdir is
 *      a live job's home and is NEVER burnt; a workdir outside RELION_DIR
 *      is never touched; no bulk-burial verb exists for the agent
 *  T4  the force gate: includeRestorable buries the spared (and their
 *      workdirs — the id was free)
 *  T5  the route doors: cross-site 403; DELETE without ?all=1 spares;
 *      ?all=1 buries; the empty graveyard buries zero, never errors
 *  T6  the grammar after: the empty roll reads as an honest empty
 *
 * Run: bun run scripts/t479-graveyard-weight-bench.ts
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t479-graveyard-weight-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.CRYOFLOW_DISABLE_BUILTIN_AI = "1";
execSync("bunx prisma db push --skip-generate", {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "pipe",
});

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const { executeAiTool, AI_TOOLS } = await import("../src/lib/ai/tools");
const {
  buryGraves,
  graveRowsOf,
  readJobTombstone,
  writeJobTombstone,
} = await import("../src/lib/job-tombstone");
const { upsertRun, clearRunRecord } = await import("../src/lib/relion/engine");
const { db } = await import("../src/lib/db");
const { DELETE, GET } = await import("../src/app/api/jobs/deleted/route");
const { NextRequest } = await import("next/server");

function localReq(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      host: "localhost:3000",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

const delReq = (query = "") =>
  new NextRequest(`http://localhost:3000/api/jobs/deleted${query}`, {
    method: "DELETE",
    headers: { host: "localhost:3000", "sec-fetch-site": "same-origin" },
  });

/* ------------------------------------------------------------------ */
/* Fixture — four graves, each teaching one law                         */
/*   A restorable + weighted (row, workdir under RELION_DIR, 3000 B)    */
/*   B row-less + weighted (the t341 grammar, 4000 B)                   */
/*   C occupied + weighted (the row LIVES — its workdir is a home)      */
/*   D row-less, workdir OUTSIDE RELION_DIR (never walked, never burnt) */
/* ------------------------------------------------------------------ */

const project = await db.project.create({ data: { name: "t479 weight" } });
const ws = await db.workspace.create({ data: { projectId: project.id, name: "Main" } });
const ctx = { projectId: project.id };

const RELION_ROOT = path.join(DATA_DIR, "relion");

function makeWorkdir(name: string, fileSizes: number[]): string {
  const dir = path.join(RELION_ROOT, project.id, name);
  mkdirSync(dir, { recursive: true });
  fileSizes.forEach((size, i) =>
    writeFileSync(path.join(dir, `file-${i}.mrcs`), Buffer.alloc(size, 7))
  );
  return dir;
}

async function makeGrave(opts: {
  name: string;
  workdir: string;
  keepRow?: boolean; // true = the row stays alive (occupied grave)
  stripRow?: boolean; // true = strip the row snapshot after writing (the t341 grammar)
}): Promise<string> {
  const job = await db.job.create({
    data: {
      projectId: project.id,
      workspaceId: ws.id,
      type: "extract",
      name: opts.name,
      x: 10,
      y: 20,
      status: "completed",
      progress: 100,
      params: JSON.stringify({ threads: 4 }),
      result: "6 micrographs",
      duration: 30000,
    },
  });
  upsertRun(job.id, {
    jobId: job.id,
    projectId: project.id,
    type: "extract",
    pid: null,
    cmd: "engine-native: extract particles",
    workdir: opts.workdir,
    logFile: path.join(opts.workdir, "run.out"),
    errFile: path.join(opts.workdir, "run.err"),
    startedAt: "2026-09-30T03:10:00.000Z",
    outputs: {},
    done: true,
    exitCode: 0,
  });
  await writeJobTombstone(job.id);
  clearRunRecord(job.id);
  if (!opts.keepRow) {
    await db.job.delete({ where: { id: job.id } });
  }
  if (opts.stripRow) {
    // a fresh delete always snapshots the row (the t477 law) — the OLD
    // grammar (row-less, unrestorable-from-the-graveyard) is produced by
    // stripping it, exactly the surgery time performed on the real 54
    const file = path.join(DATA_DIR, "deleted-jobs", `${job.id}.json`);
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { row?: unknown };
    delete parsed.row;
    writeFileSync(file, JSON.stringify(parsed, null, 2));
  }
  return job.id;
}

const idA = await makeGrave({ name: "Extract (t479 restorable)", workdir: makeWorkdir("extract_a", [1000, 2000]) });
const idB = await makeGrave({ name: "Extract (t479 row-less)", workdir: makeWorkdir("extract_b", [4000]), stripRow: true });
const idC = await makeGrave({ name: "Extract (t479 occupied)", workdir: makeWorkdir("extract_c", [500]), keepRow: true });

// D — the external grave, hand-written (its workdir must NOT be under RELION_DIR)
const EXTERNAL_DIR = path.join(os.tmpdir(), `t479-external-${path.basename(TMP)}`, "run");
mkdirSync(EXTERNAL_DIR, { recursive: true });
writeFileSync(path.join(EXTERNAL_DIR, "outside.star"), Buffer.alloc(123, 9));
const GRAVE_DIR = path.join(DATA_DIR, "deleted-jobs");
writeFileSync(
  path.join(GRAVE_DIR, "grave-external-0000.json"),
  JSON.stringify(
    {
      id: "grave-external-0000",
      deletedAt: "2026-09-29T00:00:00.000Z",
      record: {
        jobId: "grave-external-0000",
        projectId: project.id,
        type: "motioncorr",
        pid: null,
        cmd: "motioncorr",
        workdir: EXTERNAL_DIR,
        logFile: path.join(EXTERNAL_DIR, "run.out"),
        errFile: path.join(EXTERNAL_DIR, "run.err"),
        startedAt: "2026-09-29T00:00:00.000Z",
        outputs: {},
        done: true,
        exitCode: 0,
      },
      fileEdges: [],
      dbEdges: [],
    },
    null,
    2
  )
);

/* ------------------------------------------------------------------ */
/* T1 — the weight brain                                                */
/* ------------------------------------------------------------------ */

console.log("T1. a grave's bytes are its surviving workdir's walked truth");

{
  const rows = await graveRowsOf();
  const a = rows.find((r) => r.id === idA);
  const b = rows.find((r) => r.id === idB);
  const c = rows.find((r) => r.id === idC);
  const d = rows.find((r) => r.id === "grave-external-0000");
  must(a?.bytes === 3000, `T1a: the restorable grave weighs its walked sum (got ${a?.bytes})`);
  must(b?.bytes === 4000, `T1b: the row-less grave weighs too — weight is independent of restorability (got ${b?.bytes})`);
  must(c?.bytes === 500, `T1c: the occupied grave weighs its surviving workdir (got ${c?.bytes})`);
  must(d !== undefined && d.bytes === undefined, "T1d: a workdir outside RELION_DIR is never walked (no bytes key)");
  must(rows.every((r) => r.restorable !== undefined), "T1e: every row still answers the can-it-come-back truth");

  const tool = await executeAiTool("list_deleted", {}, ctx);
  const toolRows = (tool.detail as { graves: unknown[] }).graves;
  must(
    JSON.stringify(toolRows) === JSON.stringify(rows),
    "T1f: the two faces stay JSON-equal — the tool's rows and the drawer's rows carry the same weight",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — the tool face speaks the weight                                 */
/* ------------------------------------------------------------------ */

console.log("T2. the summary speaks the graveyard's weight — only when it has one");

{
  const tool = await executeAiTool("list_deleted", {}, ctx);
  const summary = String(tool.summary);
  must(/still on disk/.test(summary), `T2a: the weight clause is spoken — "${summary}"`);
  must(/3 workdirs/.test(summary), "T2b: the clause counts only the workdirs that weigh (3, not 4)");
  must(/7\.3 KB/.test(summary), `T2c: the clause uses the shared byte grammar (7500 B → 7.3 KB)`);
}

/* ------------------------------------------------------------------ */
/* T3 — the default burial door                                         */
/* ------------------------------------------------------------------ */

console.log("T3. the grave dies as a name; its workdir dies only with a free id");

{
  const out = await buryGraves({});
  must(out.spared.length === 1 && out.spared[0].id === idA && out.spared[0].name === "Extract (t479 restorable)",
    "T3a: the restorable grave is spared BY NAME");
  must(readJobTombstone(idA) !== null, "T3b: the spared grave's tombstone is alive");

  must(out.buried === 3, `T3c: the spent graves are buried (got ${out.buried})`);
  must(readJobTombstone(idB) === null, "T3d: the row-less grave's tombstone is gone");
  must(!existsSync(path.join(RELION_ROOT, project.id, "extract_b")), "T3e: the spent grave's workdir died with it");
  must(out.bytesReclaimed === 4000, `T3f: the reclaimed arithmetic counts only real deaths (got ${out.bytesReclaimed})`);

  must(existsSync(path.join(RELION_ROOT, project.id, "extract_c")), "T3g: the OCCUPIED grave's workdir SURVIVES — a live job's home is never burnt");
  must(out.keptWorkdirs === 1, `T3h: the kept home is counted honestly (got ${out.keptWorkdirs})`);
  must(readJobTombstone(idC) === null, "T3i: the occupied grave's tombstone still dies (the name is spent)");
  const cRow = await db.job.findUnique({ where: { id: idC } });
  must(cRow !== null, "T3j: the live job itself is untouched by the burial");

  must(existsSync(path.join(EXTERNAL_DIR, "outside.star")), "T3k: a workdir outside RELION_DIR is never touched, even with a free id");

  must(AI_TOOLS.length === 21 && !AI_TOOLS.some((t) => /bury|clear|forget/.test(t.name)),
    "T3l: no bulk-burial verb exists — the agent names graves, the user's door buries them (the t295 law)");
}

/* ------------------------------------------------------------------ */
/* T4 — the force gate                                                  */
/* ------------------------------------------------------------------ */

console.log("T4. includeRestorable is the armed second step — and it means it");

{
  const out = await buryGraves({ includeRestorable: true });
  must(out.buried === 1 && out.spared.length === 0, `T4a: the spared grave is buried on the explicit pass (got ${out.buried})`);
  must(!existsSync(path.join(RELION_ROOT, project.id, "extract_a")), "T4b: its workdir died too — the id was free");
  must(out.bytesReclaimed === 3000, `T4c: the arithmetic carries the force pass (got ${out.bytesReclaimed})`);
  const rows = await graveRowsOf();
  must(rows.length === 0, "T4d: the graveyard is empty — every tombstone (including the occupied one, T3i) has died");
  must(readJobTombstone(idC) === null, "T4e: …actually the occupied grave was already buried in T3 — only its LIVE row remains");
}

/* ------------------------------------------------------------------ */
/* T5 — the route doors                                                 */
/* ------------------------------------------------------------------ */

console.log("T5. DELETE /api/jobs/deleted — the drawer's Clear door behind the guard");

{
  const cross = await DELETE(
    new NextRequest("http://evil.example/api/jobs/deleted", {
      method: "DELETE",
      headers: { host: "evil.example", origin: "http://evil.example" },
    }) as never
  );
  must((cross as Response).status === 403, "T5a: a cross-site burial is slammed (403)");

  // fresh fixtures for the route: one restorable (E), one row-less (F)
  const idE = await makeGrave({ name: "Extract (t479 route spared)", workdir: makeWorkdir("extract_e", [800]) });
  const idF = await makeGrave({ name: "Extract (t479 route spent)", workdir: makeWorkdir("extract_f", [2000]), stripRow: true });

  const res1 = await DELETE(delReq()) as unknown as Response;
  const j1 = (await res1.json()) as { ok?: boolean; buried?: number; spared?: { id: string; name?: string }[]; bytesReclaimed?: number; keptWorkdirs?: number };
  must(j1.ok === true && j1.buried === 1, `T5b: the default door buries only the spent (got ${j1.buried})`);
  must(j1.spared?.length === 1 && j1.spared[0].id === idE && j1.spared[0].name === "Extract (t479 route spared)",
    "T5c: the response NAMES the spared grave — no face can pretend a restorable grave died");
  must(j1.bytesReclaimed === 2000, `T5d: the route's reclaimed arithmetic is the core's own (got ${j1.bytesReclaimed})`);
  must(!existsSync(path.join(RELION_ROOT, project.id, "extract_f")), "T5e: the spent grave's workdir is gone");

  const res2 = await DELETE(delReq("?all=1")) as unknown as Response;
  const j2 = (await res2.json()) as { ok?: boolean; buried?: number; bytesReclaimed?: number };
  must(j2.ok === true && j2.buried === 1 && j2.bytesReclaimed === 800,
    `T5f: ?all=1 buries the restorable one and counts its weight (got ${j2.buried}, ${j2.bytesReclaimed})`);

  const res3 = await DELETE(delReq()) as unknown as Response;
  const j3 = (await res3.json()) as { ok?: boolean; buried?: number };
  must(j3.ok === true && j3.buried === 0, "T5g: the empty graveyard buries zero — a true answer, never an error");
}

/* ------------------------------------------------------------------ */
/* T6 — the grammar after                                               */
/* ------------------------------------------------------------------ */

console.log("T6. after the burial the roll reads as an honest empty");

{
  const tool = await executeAiTool("list_deleted", {}, ctx);
  must(/empty/.test(String(tool.summary)), `T6a: the empty graveyard says so — "${tool.summary}"`);
  must(!/still on disk/.test(String(tool.summary)), "T6b: no weight clause when there is no weight (the omission law)");

  const res = await GET(localReq("http://localhost:3000/api/jobs/deleted") as never);
  const json = (await (res as Response).json()) as { ok?: boolean; graves?: unknown[] };
  must(json.ok === true && Array.isArray(json.graves) && json.graves.length === 0,
    "T6c: the GET door answers an empty roll (the drawer's section disappears)");
}

/* ------------------------------------------------------------------ */
/* Verdict                                                              */
/* ------------------------------------------------------------------ */

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
