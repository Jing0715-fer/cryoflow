/**
 * t475 — the clusters answer the roll (list_clusters, the 19th tool).
 *
 * run_job's mode:'cluster' dispatches to the PROJECT-BOUND SSH cluster and
 * continue_run follows the job's own lane — but the agent could not READ
 * any of that world: which clusters exist, whether the project is bound,
 * whether the bound cluster's last probe lived or died, what RELION
 * modules a cluster offers. The dialog's rail has answered those questions
 * since t268 (probeDot's three-word law); this read hands the agent the
 * same face — the registry's own roll call, zero live probing (a probe's
 * truth has a birthday; fresh ones are the Test button's or the dispatch
 * gate's job, never the agent's).
 *
 * This bench pins:
 *  T1  the catalog wears the cluster read (21 unique tools, schema takes
 *      nothing, the description names the roll call + the birthday law)
 *  T2  an empty registry answers honestly (ok:true, an empty roster is a
 *      true answer, the local lane stays open)
 *  T3  the roster mirrors the dialog's rail: three states (reachable /
 *      probe-failed with the error line / never-tested), the probe block's
 *      inventory (modules, Slurm, gpus, durationMs) and checkedAt riding
 *      every block
 *  T4  the binding tissue: projectBound marks exactly the bound row, the
 *      summary names it (run_job mode:'cluster' would go there), an
 *      unbound project says so, a binding to a DELETED connection says
 *      "no longer exists" instead of inventing a row
 *  T5  the secret law: passwords/passphrases never cross — booleans ride
 *      instead, a marker secret never enters the payload
 *  T6  the prompt wears THE CLUSTER LAW (#11), the reads list names
 *      list_clusters, and the numbering stays contiguous 1–14
 *
 * Run: bun run scripts/t475-cluster-roster-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t475-cluster-roster-"));
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

/* a probe block shaped like RemoteProbe (only the fields the tool reads) */
function probe(shape: {
  ok: boolean;
  checkedAt: string;
  durationMs?: number;
  error?: string;
  moduleSystem?: string;
  relionModules?: string[];
  slurm?: boolean;
  gpus?: string[];
}) {
  return {
    ok: shape.ok,
    checkedAt: shape.checkedAt,
    durationMs: shape.durationMs ?? null,
    error: shape.error ?? null,
    uname: "Linux gpu-hpc 5.15.0",
    moduleSystem: shape.moduleSystem ?? "lmod",
    relionModules: shape.relionModules ?? [],
    relionHomes: {},
    relionMpi: {},
    relionCtffind: {},
    externals: {},
    slurm: shape.slurm ?? false,
    slurmPartitions: [],
    slurmGpus: null,
    gpus: shape.gpus ?? [],
  };
}

function connection(shape: {
  id: string;
  name?: string;
  host?: string;
  username?: string;
  password?: string | null;
  passphrase?: string | null;
  remoteRoot?: string;
  useSlurm?: boolean;
  defaultModule?: string | null;
  lastProbe?: unknown | null;
}) {
  return {
    id: shape.id,
    name: shape.name ?? "",
    host: shape.host ?? "hpc.example.edu",
    port: 22,
    username: shape.username ?? "qc",
    authMethod: shape.password ? "password" : "agent",
    privateKeyPath: null,
    passphrase: shape.passphrase ?? null,
    password: shape.password ?? null,
    remoteRoot: shape.remoteRoot ?? "/data/qa/cryo",
    defaultModule: shape.defaultModule ?? null,
    envLines: [],
    useSlurm: shape.useSlurm ?? false,
    lastProbe: shape.lastProbe ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* T1 — the catalog wears the cluster read                              */
/* ------------------------------------------------------------------ */

console.log("T1. the catalog wears the cluster read");

{
  const tool = AI_TOOLS.find((t) => t.name === "list_clusters");
  must(tool != null, "T1a: list_clusters is in the catalog");
  must(
    AI_TOOLS.length === 33 && new Set(AI_TOOLS.map((t) => t.name)).size === 33,
    `T1b: 33 unique tools — t522's history read is the newest birth (got ${AI_TOOLS.length})`,
  );
  const params = (tool?.parameters ?? {}) as {
    properties?: Record<string, unknown>;
    additionalProperties?: unknown;
  };
  // t484 — the roll call grew one OPTIONAL param (fullHistory): the roll
  // itself still needs nothing, the whole-book read is a bridge away.
  must(
    params.properties != null &&
      Object.keys(params.properties).join(",") === "fullHistory" &&
      params.additionalProperties === false,
    "T1c: the schema takes exactly one OPTIONAL param (fullHistory)",
  );
  const d = tool?.description ?? "";
  must(
    /registry|roll call/i.test(d) && d.includes("LAST probe") && d.includes("checkedAt") && d.includes("binding"),
    "T1d: the description names the roll call, the probe's birthday and the binding",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — an empty registry answers honestly                              */
/* ------------------------------------------------------------------ */

console.log("T2. an empty registry is a true answer, not a refusal");

const project = await db.project.create({ data: { name: "t475 cluster roll" } });
const ctx = { projectId: project.id };

{
  writeRegistry([]);
  writeProjects(project.id, null);
  const r = await executeAiTool("list_clusters", {}, ctx);
  must(r.ok === true, "T2a: an empty roster still answers ok:true");
  must(
    typeof r.summary === "string" && r.summary.includes("No clusters in the registry"),
    "T2b: the summary says the registry is empty",
  );
  must(
    (r.summary as string).includes("Remote clusters dialog"),
    "T2c: the summary points at the dialog where a cluster is saved",
  );
  const detail = r.detail as { roster: unknown[]; note?: string };
  must(Array.isArray(detail.roster) && detail.roster.length === 0 && /local/.test(detail.note ?? ""), "T2d: the local lane stays open in the note");
}

/* ------------------------------------------------------------------ */
/* T3 — the roster mirrors the dialog's rail (three states + inventory) */
/* ------------------------------------------------------------------ */

console.log("T3. three states, one roll call");

{
  writeRegistry([
    connection({
      id: "conn-ok",
      name: "GPU Cluster",
      host: "gpu-hpc.example.edu",
      username: "qc",
      defaultModule: "relion/5.0.1",
      useSlurm: true,
      lastProbe: probe({
        ok: true,
        checkedAt: "2026-09-30T02:10:00.000Z",
        durationMs: 4210,
        relionModules: ["relion/4.4.1", "relion/5.0.1"],
        slurm: true,
        gpus: ["A100", "A100", "A100", "A100"],
      }),
    }),
    connection({
      id: "conn-dead",
      name: "Old Beast",
      lastProbe: probe({
        ok: false,
        checkedAt: "2026-09-29T18:00:00.000Z",
        durationMs: 3005,
        error: "Connect timeout: tried 3 times over 3000ms",
      }),
    }),
    connection({ id: "conn-new", name: "Newbie", lastProbe: null }),
  ]);
  const r = await executeAiTool("list_clusters", {}, ctx);
  const detail = r.detail as {
    roster: Array<{
      id: string;
      name: string;
      host: string;
      projectBound: boolean;
      probe: null | {
        state: string;
        checkedAt: string;
        durationMs: number | null;
        error: string | null;
        moduleSystem: string;
        relionModules: string[];
        slurm: boolean;
        gpus: number;
      };
    }>;
  };
  must(detail.roster.length === 3, "T3a: every saved connection answers");
  const okRow = detail.roster.find((c) => c.id === "conn-ok");
  const deadRow = detail.roster.find((c) => c.id === "conn-dead");
  const newRow = detail.roster.find((c) => c.id === "conn-new");
  must(
    okRow?.probe?.state === "reachable" && okRow.probe.relionModules.length === 2 && okRow.probe.slurm === true && okRow.probe.gpus === 4,
    "T3b: the reachable row wears its inventory (modules, Slurm, gpu count)",
  );
  must(okRow?.probe?.durationMs === 4210 && okRow.probe.checkedAt === "2026-09-30T02:10:00.000Z", "T3c: the probe's birthday and cost ride the block");
  must(
    deadRow?.probe?.state === "probe-failed" && deadRow.probe.error === "Connect timeout: tried 3 times over 3000ms",
    "T3d: the failed row quotes the probe's error line verbatim",
  );
  must(newRow?.probe === null, "T3e: a never-probed connection says nothing it does not know");
  must(okRow?.name === "GPU Cluster" && okRow.host === "qc@gpu-hpc.example.edu:22", "T3f: the row speaks the dialog's own naming (name, user@host:port)");
  must(
    typeof r.summary === "string" && (r.summary as string).includes("3 clusters in the registry, 1 reachable by last probe"),
    "T3g: the summary counts the roster and the reachable",
  );
}

/* ------------------------------------------------------------------ */
/* T4 — the binding tissue                                              */
/* ------------------------------------------------------------------ */

console.log("T4. the binding says where mode:'cluster' would go");

{
  writeRegistry([
    connection({ id: "conn-ok", name: "GPU Cluster" }),
    connection({ id: "conn-b", name: "Other" }),
  ]);
  writeProjects(project.id, "conn-ok");
  const bound = await executeAiTool("list_clusters", {}, ctx);
  const detail = bound.detail as { roster: Array<{ id: string; projectBound: boolean }>; projectBinding: { connectionId: string; name: string | null; missing: boolean } | null };
  must(
    detail.roster.find((c) => c.id === "conn-ok")?.projectBound === true && detail.roster.find((c) => c.id === "conn-b")?.projectBound === false,
    "T4a: projectBound marks exactly the bound row",
  );
  must(detail.projectBinding?.connectionId === "conn-ok" && detail.projectBinding.name === "GPU Cluster" && detail.projectBinding.missing === false, "T4b: the binding block names the connection");
  must((bound.summary as string).includes('dispatches to "GPU Cluster"'), "T4c: the summary says where mode:'cluster' dispatches");

  writeProjects(project.id, null);
  const unbound = await executeAiTool("list_clusters", {}, ctx);
  must(
    (unbound.summary as string).includes("no cluster bound") && (unbound.detail as { projectBinding: unknown }).projectBinding === null,
    "T4d: an unbound project says so",
  );

  writeProjects(project.id, "conn-ghost");
  const ghost = await executeAiTool("list_clusters", {}, ctx);
  const ghostDetail = ghost.detail as { projectBinding: { missing: boolean } | null; roster: unknown[] };
  must(
    (ghost.summary as string).includes("no longer exists") && ghostDetail.projectBinding?.missing === true && ghostDetail.roster.length === 2,
    "T4e: a binding to a deleted connection confesses instead of inventing a row",
  );
}

/* ------------------------------------------------------------------ */
/* T5 — the secret law                                                  */
/* ------------------------------------------------------------------ */

console.log("T5. passwords never cross; booleans ride instead");

{
  writeRegistry([
    connection({
      id: "conn-secret",
      name: "Secret Squirrel",
      password: "PASSWORD-MARKER-4757-DO-NOT-QUOTE",
      passphrase: "PASSPHRASE-MARKER-4757-DO-NOT-QUOTE",
    }),
  ]);
  const r = await executeAiTool("list_clusters", {}, ctx);
  const payload = JSON.stringify(r);
  must(!payload.includes("PASSWORD-MARKER") && !payload.includes("PASSPHRASE-MARKER"), "T5a: neither secret enters the payload");
  const row = (r.detail as { roster: Array<{ auth: { method: string; hasPassword: boolean; hasPassphrase: boolean } }> }).roster[0];
  must(row.auth.method === "password" && row.auth.hasPassword === true && row.auth.hasPassphrase === true, "T5b: the auth SHAPE rides as booleans (the dialog DTO's contract)");
}

/* ------------------------------------------------------------------ */
/* T6 — the prompt wears the law                                        */
/* ------------------------------------------------------------------ */

console.log("T6. THE CLUSTER LAW is on the books");

{
  const prompt = buildSystemPrompt({ projectName: "t475 cluster roll", projectMode: "spa", projectRemote: null, jobCount: 0 });
  must(prompt.includes("THE CLUSTER LAW"), "T6a: the cluster law is in the doctrine");
  must(prompt.includes("11. THE CLUSTER LAW") && prompt.includes("12. After run_job or continue_run"), "T6b: the law sits at #11, the numbering contiguous");
  must(prompt.includes("list_clusters — do NOT create") || /list_clusters/.test(prompt.split("QUESTIONS ARE READS")[1]?.split("\n")[0] ?? ""), "T6c: the reads list names list_clusters");
  must(
    /checkedAt|birthday/i.test(prompt.split("THE CLUSTER LAW")[1]?.split("\n")[0] ?? ""),
    "T6d: the law carries the birthday rule (quote checkedAt, never call alive from an old probe)",
  );
}

console.log(`\nt475: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
