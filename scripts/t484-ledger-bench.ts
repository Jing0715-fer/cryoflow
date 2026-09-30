/**
 * t484 — the ledger opens its whole book (list_clusters grows fullHistory).
 *
 * t476 gave the agent the résumé — but only its reading line: the ≤3
 * newest runs. "Show me everything this cluster has run / 这台集群的完整
 * 历史" had no tool answer (list_clusters is the ONLY dispatch-history
 * read in the agent's 21-tool lane; the records dialog is a user-facing
 * HTTP door the agent cannot walk through). Meanwhile the panorama
 * aperture has existed at the library level since t272 —
 * connectionRunResume(id, { all: true }) is exactly what the records
 * route reads. t484 is that bridge, one optional param wide:
 *
 *   list_clusters({ fullHistory: true })
 *
 * This bench pins:
 *  T1  the catalog: the description names the whole-book verb (fullHistory,
 *      the 50 cap, the 完整历史 question); the prompt law teaches WHEN to
 *      reach for it and numbering stays contiguous 1–14
 *  T2  the default face is UNTOUCHED: no args → 3 newest, total intact,
 *      no cappedAt key, the summary still says "(3 newest in detail)"
 *  T3  the whole book: fullHistory:true → every run, newest first, the
 *      summary flips to "(all N in detail)", the note addresses the
 *      panorama and hands the beyond-cap overflow back to the records
 *      dialog
 *  T4  the cap law: 55 records → fullHistory shows 50 + cappedAt:50,
 *      total stays 55 (a truncated read never pretends to be the whole
 *      book); the default face never grows a cappedAt (the cap must not
 *      leak into the résumé face)
 *  T5  arithmetic holds in both apertures: done/exitCode buckets and
 *      lastRunAt agree between the 3-newest read and the whole book
 *
 * Run: bun run scripts/t484-ledger-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t484-ledger-"));
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
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");
const { db } = await import("../src/lib/db");

const REGISTRY = path.join(DATA_DIR, "remote-connections.json");
const PROJECTS = path.join(DATA_DIR, "projects.json");
const STATE = path.join(DATA_DIR, "engine-state.json");

function writeRegistry(list: unknown[]): void {
  writeFileSync(REGISTRY, JSON.stringify(list, null, 2));
}

function writeProjects(active: string | null, boundConnectionId: string | null): void {
  writeFileSync(
    PROJECTS,
    JSON.stringify({
      active,
      projects: active
        ? {
            [active]: {
              mode: "spa",
              engine: "relion",
              ...(boundConnectionId ? { remote: { connectionId: boundConnectionId } } : {}),
            },
          }
        : {},
    }),
  );
}

function writeState(runs: Record<string, unknown>): void {
  writeFileSync(STATE, JSON.stringify(runs, null, 2));
}

function runRecord(shape: {
  jobId: string;
  type: string;
  startedAt: string;
  done: boolean;
  exitCode: number | null;
  connectionId: string;
}) {
  return {
    jobId: shape.jobId,
    projectId: "ledger-project",
    type: shape.type,
    pid: null,
    cmd: "relion_refine --t484",
    workdir: "/projects/qa/run_it000",
    logFile: "/projects/qa/run_it000/log",
    errFile: "/projects/qa/run_it000/err",
    startedAt: shape.startedAt,
    outputs: {},
    done: shape.done,
    exitCode: shape.exitCode,
    remote: { connectionId: shape.connectionId },
  };
}

function connection(shape: { id: string; name?: string }) {
  return {
    id: shape.id,
    name: shape.name ?? "",
    host: "hpc.example.edu",
    port: 22,
    username: "qc",
    authMethod: "agent",
    privateKeyPath: null,
    passphrase: null,
    password: null,
    remoteRoot: "/data/qa/cryo",
    defaultModule: null,
    envLines: [],
    useSlurm: true,
    lastProbe: null,
  };
}

type DispatchRow = {
  jobId: string;
  jobType: string;
  done: boolean;
  exitCode: number | null;
  startedAt: string;
  exists: boolean;
  projectName?: string;
};
type RosterRow = {
  id: string;
  dispatches?: {
    total: number;
    completed: number;
    failed: number;
    lastRunAt: string | null;
    cappedAt?: number;
    recent: DispatchRow[];
  };
};

const CONN = "conn-ledger-book";

/* ------------------------------------------------------------------ */
/* World: one connection, bound project, and the 7-run ledger           */
/* ------------------------------------------------------------------ */

const project = await db.project.create({ data: { name: "Ledger Book" } });

writeRegistry([connection({ id: CONN, name: "Mock Cluster" })]);
writeProjects(project.id, CONN);

// seven runs — more than the 3-newest reading line can hold. Newest is a
// running job (lastRunAt must include it, neither bucket may count it);
// job-1 and job-2 live in the db (exists truth), the rest are ledger-only.
const ledger: Array<{ jobId: string; type: string; startedAt: string; done: boolean; exitCode: number | null }> = [
  { jobId: "job-7", type: "relion.refine3d", startedAt: "2026-09-30T04:20:00.000Z", done: false, exitCode: null },
  { jobId: "job-6", type: "relion.refine3d", startedAt: "2026-09-30T03:50:00.000Z", done: true, exitCode: 137 },
  { jobId: "job-5", type: "relion.class2d", startedAt: "2026-09-30T03:20:00.000Z", done: true, exitCode: 0 },
  { jobId: "job-4", type: "relion.class2d", startedAt: "2026-09-30T02:50:00.000Z", done: true, exitCode: 0 },
  { jobId: "job-3", type: "relion.extract", startedAt: "2026-09-30T02:20:00.000Z", done: true, exitCode: 0 },
  { jobId: "job-2", type: "relion.extract", startedAt: "2026-09-30T01:50:00.000Z", done: true, exitCode: 0 },
  { jobId: "job-1", type: "relion.import", startedAt: "2026-09-30T01:20:00.000Z", done: true, exitCode: 0 },
];
writeState(
  Object.fromEntries(
    ledger.map((r, i) => [`run-${i}`, runRecord({ ...r, connectionId: CONN })]),
  ),
);

// job-1 and job-2 live on a canvas; the ledger remembers the other five
for (const j of ["job-1", "job-2"]) {
  await db.job.create({
    data: {
      id: j,
      projectId: project.id,
      type: "relion.import",
      name: `Seed ${j}`,
      x: 0,
      y: 0,
    },
  });
}

/* ------------------------------------------------------------------ */
/* T1 — the catalog and the law name the whole book                     */
/* ------------------------------------------------------------------ */

console.log("T1. the catalog and the law name the whole-book verb");

{
  const tool = AI_TOOLS.find((t) => t.name === "list_clusters");
  const d = tool?.description ?? "";
  must(
    d.includes("fullHistory") && d.includes("50 entries") && d.includes("完整历史"),
    "T1a: the description names fullHistory, the 50-entry cap and the 完整历史 question",
  );
  const params = (tool?.parameters ?? {}) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const fh = params.properties?.fullHistory as { type?: string; description?: string } | undefined;
  must(
    fh?.type === "boolean" && typeof fh.description === "string" && fh.description.length > 20,
    "T1b: the fullHistory param is an optional boolean with a real description",
  );
  must(
    !params.required || params.required.length === 0,
    "T1c: nothing is required — the résumé face stays a zero-arg read",
  );
  const prompt = buildSystemPrompt({ projectName: "Ledger Book", projectMode: "spa", projectRemote: null, jobCount: 0 });
  must(
    prompt.includes("fullHistory:true") && prompt.includes("完整历史") && prompt.includes("needs no fullHistory"),
    "T1d: THE CLUSTER LAW teaches when to open the whole book — and that recent-history questions need no fullHistory",
  );
  const nums = Array.from(prompt.matchAll(/^(\d+)\. /gm)).map((m) => Number(m[1]));
  must(
    nums.join(",") === Array.from({ length: 16 }, (_, i) => i + 1).join(","),
    "T1e: the laws stay contiguous 1–16 (the curve law grew the book, t486; the action law grew it again, t500 — still no renumbering)",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — the default face is untouched                                   */
/* ------------------------------------------------------------------ */

console.log("T2. the default face stays the 3-newest reading line");

{
  const r = (await executeAiTool("list_clusters", {}, {} as never)) as {
    detail: { roster: RosterRow[] };
  };
  const row = r.detail.roster[0];
  const dis = row.dispatches!;
  must(
    dis.recent.length === 3 && dis.total === 7,
    "T2a: no args → 3 newest of 7 total (the résumé face is byte-compatible)",
  );
  must(
    dis.recent.map((e) => e.jobId).join(",") === "job-7,job-6,job-5",
    "T2b: the reading line is still the 3 NEWEST, newest first",
  );
  must(
    dis.cappedAt === undefined,
    "T2c: no cappedAt on the default face — the cap must not leak into the résumé",
  );
  must(
    (r as { summary?: string }).summary?.includes("(3 newest in detail)") === true,
    "T2d: the spoken line still says '(3 newest in detail)'",
  );
}

/* ------------------------------------------------------------------ */
/* T3 — the whole book                                                  */
/* ------------------------------------------------------------------ */

console.log("T3. fullHistory:true opens every page, newest first");

{
  const r = (await executeAiTool("list_clusters", { fullHistory: true }, {} as never)) as {
    summary: string;
    detail: { roster: RosterRow[]; note: string };
  };
  const row = r.detail.roster[0];
  const dis = row.dispatches!;
  must(
    dis.recent.length === 7 && dis.total === 7,
    "T3a: the whole book holds all 7 runs",
  );
  must(
    dis.recent.map((e) => e.jobId).join(",") === "job-7,job-6,job-5,job-4,job-3,job-2,job-1",
    "T3b: the pages are newest first across the WHOLE ledger",
  );
  must(
    dis.cappedAt === undefined,
    "T3c: 7 ≤ 50 — no cappedAt on an uncapped ledger (the cap speaks only when it bites)",
  );
  must(
    r.summary.includes('(all 7 in detail)'),
    `T3d: the spoken line flips to '(all 7 in detail)' (got: ${r.summary})`,
  );
  must(
    r.detail.note.includes("WHOLE ledger") && r.detail.note.includes("capped at 50"),
    "T3e: the note addresses the panorama and names its cap",
  );
  must(
    dis.recent.find((e) => e.jobId === "job-1")?.exists === true &&
      dis.recent.find((e) => e.jobId === "job-1")?.projectName === "Ledger Book" &&
      dis.recent.find((e) => e.jobId === "job-7")?.exists === false,
    "T3f: the existence truth rides every page — canvas rows name their project, ledger-only rows stay honest",
  );
}

/* ------------------------------------------------------------------ */
/* T4 — the cap law: a truncated read never pretends to be whole        */
/* ------------------------------------------------------------------ */

console.log("T4. 55 runs → 50 shown + cappedAt, total stays honest");

{
  const flood: Record<string, unknown> = {};
  for (let i = 0; i < 55; i++) {
    flood[`run-f${i}`] = runRecord({
      jobId: `flood-${i}`,
      type: "relion.class2d",
      startedAt: new Date(Date.parse("2026-09-30T05:00:00.000Z") + i * 1000).toISOString(),
      done: true,
      exitCode: 0,
      connectionId: CONN,
    });
  }
  writeState({ ...flood, "run-keep": runRecord({ jobId: "keep-old", type: "relion.import", startedAt: "2026-09-01T00:00:00.000Z", done: true, exitCode: 0, connectionId: CONN }) });

  const full = (await executeAiTool("list_clusters", { fullHistory: true }, {} as never)) as {
    detail: { roster: RosterRow[] };
  };
  const row = full.detail.roster[0];
  const fdis = row.dispatches!;
  must(
    fdis.total === 56 && fdis.recent.length === 50 && fdis.cappedAt === 50,
    "T4a: total 56, 50 pages shown, cappedAt:50 — the book admits its truncation",
  );
  must(
    fdis.recent[0]?.jobId === "flood-54",
    "T4b: the capped book still reads newest first from the top",
  );
  must(
    !fdis.recent.some((e) => e.jobId === "keep-old"),
    "T4c: the oldest page is beyond the cap — the ledger remembers it (total) but the read says so",
  );

  const def = (await executeAiTool("list_clusters", {}, {} as never)) as {
    detail: { roster: RosterRow[] };
  };
  const drow = def.detail.roster[0];
  must(
    drow.dispatches?.recent.length === 3 && drow.dispatches.cappedAt === undefined,
    "T4d: the default face stays 3 pages and cap-free even in a flooded world",
  );

  // restore the 7-run world for T5
  writeState(
    Object.fromEntries(
      ledger.map((r, i) => [`run-${i}`, runRecord({ ...r, connectionId: CONN })]),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* T5 — the arithmetic agrees between the two apertures                 */
/* ------------------------------------------------------------------ */

console.log("T5. the buckets agree — one ledger, two apertures, one truth");

{
  const def = (await executeAiTool("list_clusters", {}, {} as never)) as {
    detail: { roster: RosterRow[] };
  };
  const full = (await executeAiTool("list_clusters", { fullHistory: true }, {} as never)) as {
    detail: { roster: RosterRow[] };
  };
  const d = def.detail.roster[0].dispatches;
  const f = full.detail.roster[0].dispatches;
  must(
    d?.completed === 5 && d?.failed === 1,
    "T5a: the résumé's buckets (5 completed, 1 failed) match the seeded arithmetic",
  );
  must(
    f?.completed === d?.completed && f?.failed === d?.failed && f?.total === d?.total,
    "T5b: the whole book's buckets are the SAME numbers — the aperture never changes the arithmetic",
  );
  must(
    d?.lastRunAt === "2026-09-30T04:20:00.000Z" && f?.lastRunAt === d?.lastRunAt,
    "T5c: lastRunAt includes the still-running job in both apertures",
  );
  must(
    f?.recent.find((e) => e.jobId === "job-6")?.exitCode === 137 &&
      f?.recent.find((e) => e.jobId === "job-6")?.done === true &&
      f?.recent.find((e) => e.jobId === "job-7")?.done === false,
    "T5d: exit 137 is a failed page, the running page counts nowhere",
  );
}

/* ------------------------------------------------------------------ */

console.log(`\nt484 ledger bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
