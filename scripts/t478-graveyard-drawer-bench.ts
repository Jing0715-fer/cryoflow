/**
 * t478 — the graveyard opens its drawer (the UI's door onto the roll call).
 *
 * t477 gave the agent list_deleted and restore_deleted; this window opens
 * the SAME truth to the UI: graveRowsOf is ONE brain for BOTH faces (the
 * tool's rows and the drawer's rows can never disagree), GET /api/jobs/
 * deleted serves the roll call, and POST /api/jobs/deleted/restore takes a
 * job_id — the grave restores from its OWN server-side snapshot, never a
 * client-built body (nothing to trust, nothing to get stale).
 *
 * This bench pins:
 *  T1  one brain, two faces: list_deleted's rows and graveRowsOf's rows
 *      are field-for-field EQUAL (the drawer badge and the spoken line
 *      agree about every grave)
 *  T2  the GET door: guard on (same-origin metadata required), the roll
 *      call served with shapes only
 *  T3  the POST restore door: a job_id-only body restores from the grave's
 *      OWN snapshot (row back under the original id); a row-less grave
 *      refuses with the why; a missing tombstone is 404; a missing job_id
 *      is 400
 *  T4  the cross-door honesty: after a POST-door restore, the roll call
 *      (both faces) marks the grave occupied — no face ever promises a
 *      blocked restore
 *
 * Run: bun run scripts/t478-graveyard-drawer-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t478-graveyard-drawer-"));
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

const { executeAiTool } = await import("../src/lib/ai/tools");
const { graveRowsOf, readJobTombstone, writeJobTombstone } = await import("../src/lib/job-tombstone");
const { clearRunRecord, upsertRun } = await import("../src/lib/relion/engine");
const { db } = await import("../src/lib/db");
const { GET } = await import("../src/app/api/jobs/deleted/route");
const { POST: restorePOST } = await import("../src/app/api/jobs/deleted/restore/route");

/* a same-origin request the guard accepts (browser fetch metadata) */
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

/* ------------------------------------------------------------------ */
/* Fixture — one real grave (row snapshot) + one old grave (no row)     */
/* ------------------------------------------------------------------ */

const project = await db.project.create({ data: { name: "t478 drawer" } });
const ws = await db.workspace.create({ data: { projectId: project.id, name: "Main" } });
const ctx = { projectId: project.id };

const job = await db.job.create({
  data: {
    projectId: project.id,
    workspaceId: ws.id,
    type: "class2d",
    name: "2D Classification (drawer)",
    x: 100,
    y: 200,
    status: "completed",
    progress: 100,
    params: JSON.stringify({ threads: 8 }),
    result: "74 classes survived",
    duration: 60000,
  },
});
const witnessId = job.id;
upsertRun(witnessId, {
  jobId: witnessId,
  projectId: project.id,
  type: "class2d",
  pid: null,
  cmd: "relion_refine",
  workdir: "/data/run_it000",
  logFile: "/data/run_it000/log",
  errFile: "/data/run_it000/err",
  startedAt: "2026-09-30T02:50:00.000Z",
  outputs: {},
  done: true,
  exitCode: 0,
});
await writeJobTombstone(witnessId);
clearRunRecord(witnessId);
await db.job.delete({ where: { id: witnessId } });

const GRAVE_DIR = path.join(DATA_DIR, "deleted-jobs");
mkdirSync(GRAVE_DIR, { recursive: true });
writeFileSync(
  path.join(GRAVE_DIR, "grave-old-0000.json"),
  JSON.stringify({ id: "grave-old-0000", deletedAt: "2026-09-28T05:00:00.000Z", record: null, fileEdges: [], dbEdges: [] }, null, 2)
);

/* ------------------------------------------------------------------ */
/* T1 — one brain, two faces                                            */
/* ------------------------------------------------------------------ */

console.log("T1. the tool's rows and graveRowsOf's rows are ONE roll call");

{
  const tool = await executeAiTool("list_deleted", {}, ctx);
  const toolRows = (tool.detail as { graves: unknown[] }).graves;
  const libRows = await graveRowsOf();
  must(
    JSON.stringify(toolRows) === JSON.stringify(libRows),
    "T1a: list_deleted's detail.graves is field-for-field graveRowsOf()",
  );
  must(libRows.length === 2, `T1b: both graves answer (got ${libRows.length})`);
  const fresh = libRows.find((r) => r.id === witnessId);
  const old = libRows.find((r) => r.id === "grave-old-0000");
  must(
    fresh?.restorable === true && fresh?.name === "2D Classification (drawer)" && fresh?.run?.exitCode === 0,
    "T1c: the fresh grave is restorable with its run summary",
  );
  must(
    old?.restorable === false && old?.rowSnapshot === false && /canvas's undo/.test(old?.why ?? ""),
    "T1d: the old grave says what it cannot do",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — the GET door                                                    */
/* ------------------------------------------------------------------ */

console.log("T2. GET /api/jobs/deleted serves the same rows behind the guard");

{
  const cross = await GET(
    new Request("http://evil.example/api/jobs/deleted", {
      headers: { host: "evil.example", origin: "http://evil.example" },
    }) as never
  );
  must((cross as Response).status === 403, "T2a: a cross-site request is slammed (403)");

  const res = await GET(localReq("http://localhost:3000/api/jobs/deleted") as never);
  const json = (await (res as Response).json()) as { ok?: boolean; graves?: Array<{ id: string; name?: string }> };
  must(json.ok === true && json.graves?.length === 2, "T2b: the roll call answers ok:true with both graves");
  must(
    json.graves?.some((g) => g.id === witnessId && g.name === "2D Classification (drawer)") === true,
    "T2c: the drawer's rows carry the grave's name (shapes only, snapshot stays server-side)",
  );
}

/* ------------------------------------------------------------------ */
/* T3 — the POST restore door                                           */
/* ------------------------------------------------------------------ */

console.log("T3. POST takes a job_id and restores from the grave's OWN snapshot");

{
  const noBody = await restorePOST(
    localReq("http://localhost:3000/api/jobs/deleted/restore", { method: "POST", body: JSON.stringify({}) }) as never
  );
  must((noBody as Response).status === 400, "T3a: a body without job_id is 400");

  const noGrave = await restorePOST(
    localReq("http://localhost:3000/api/jobs/deleted/restore", {
      method: "POST",
      body: JSON.stringify({ job_id: "cmusk-never-was" }),
    }) as never
  );
  must((noGrave as Response).status === 404, "T3b: a job_id no tombstone holds is 404");

  const rowLess = await restorePOST(
    localReq("http://localhost:3000/api/jobs/deleted/restore", {
      method: "POST",
      body: JSON.stringify({ job_id: "grave-old-0000" }),
    }) as never
  );
  must((rowLess as Response).status === 409, "T3c: a row-less grave refuses with 409 (the why line rides)");

  const fire = await restorePOST(
    localReq("http://localhost:3000/api/jobs/deleted/restore", {
      method: "POST",
      body: JSON.stringify({ job_id: witnessId }),
    }) as never
  );
  const out = (await (fire as Response).json()) as {
    restored: { id: string; coerced: boolean }[];
    failed: unknown[];
  };
  must(
    out.restored?.[0]?.id === witnessId && out.restored[0].coerced === false && (out.failed ?? []).length === 0,
    "T3d: the grave comes back under its original id",
  );
  const row = await db.job.findUnique({ where: { id: witnessId } });
  must(
    row?.status === "completed" && JSON.parse(row.params).threads === 8 && row.workspaceId === ws.id,
    "T3e: the row is the grave's own snapshot — status, params, home intact",
  );
}

/* ------------------------------------------------------------------ */
/* T4 — the cross-door honesty                                          */
/* ------------------------------------------------------------------ */

console.log("T4. after the POST-door restore, every face says occupied");

{
  const libRows = await graveRowsOf();
  const fresh = libRows.find((r) => r.id === witnessId);
  must(
    fresh?.restorable === false && /already restored or re-created/.test(fresh?.why ?? ""),
    "T4a: graveRowsOf marks the grave occupied (the brain, not the face)",
  );
  const tool = await executeAiTool("list_deleted", {}, ctx);
  const toolRow = (tool.detail as { graves: Array<{ id: string; restorable: boolean }> }).graves.find(
    (r) => r.id === witnessId
  );
  must(toolRow?.restorable === false, "T4b: the agent's spoken rows agree (one brain, two faces)");

  const again = await restorePOST(
    localReq("http://localhost:3000/api/jobs/deleted/restore", {
      method: "POST",
      body: JSON.stringify({ job_id: witnessId }),
    }) as never
  );
  const out = (await (again as Response).json()) as { failed: Array<{ error: string }> };
  must(
    (out.failed?.[0]?.error ?? "").includes("already exists"),
    "T4c: a second restore through the door refuses — the id is taken",
  );
}

console.log(`\nt478: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
