/**
 * t429 — the stay-receipt's bring-home awareness + the JSON session export.
 *
 * Two deliverables, verified at the family's depths:
 *
 *   S1 (lib): isStayReceipt's dialect matrix — the sync-policy stay
 *      wordings (metadata-only, key-cap, caps, the remote-run names
 *      dialect) are receipts a bring-home can resolve; the ssh-loss note
 *      and the stale-generation verdict are NOT (bringing files home
 *      cannot resolve either), and a mixed stayed+EARLIER note stays
 *      amber because one resolved segment must not silence the other.
 *   S2-S6 (route, in-process): GET /api/jobs/[id]/outputs/remote-remaining
 *      through the REAL handler against a REAL workdir + manifest —
 *      cross-site 403, ghost 404, no-run 400, non-remote 0/0, the honest
 *      count (1 of 3 out) flipping to 0 when the last file lands.
 *
 *   J1 (lib): sessionToExportJson — the machine-readable twin: envelope
 *      format/version, ISO timestamps, the tool result's {ok,summary}
 *      envelope parsed into real FIELDS (not quoted prose), unparseable
 *      content degrading to a labeled raw, cleared titles answering null.
 *   J2-J5 (route, in-process): ?format=json serves an application/json
 *      attachment with the .json filename whose body parses to the
 *      envelope; ?format=xml answers 400 (an honest contract, not a
 *      silent fallback); the plain door still speaks inline session;
 *      the pinning law covers the new format too.
 *
 * Run: bun scripts/t429-stay-note-json-export.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t429-stay-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
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

const { db } = await import("../src/lib/db");
const { upsertRun } = await import("../src/lib/relion/engine");
const { writeRemoteManifest } = await import("../src/lib/remote/remote-files");
const { isStayReceipt } = await import("../src/lib/remote/stay-receipt");
const { sessionToExportJson, sessionFileName, sessionToMarkdown } = await import("../src/lib/ai/export");
const { createSession, saveSession, getSession, toolCallsUsed } = await import("../src/lib/ai/sessions");
const { ensureActiveProject } = await import("../src/lib/seed");
const { NextRequest, NextResponse } = await import("next/server");
const stayRoute = await import("../src/app/api/jobs/[id]/outputs/remote-remaining/route");
const sessionRoute = await import("../src/app/api/ai/sessions/[id]/route");

const LOCAL = { host: "localhost:3000", origin: "http://localhost:3000" };
const FOREIGN_ORIGIN = { host: "localhost:3000", origin: "https://evil.example" };

function req(pathname: string, init?: { headers?: Record<string, string> }) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: "GET",
    headers: { ...LOCAL, ...(init?.headers ?? {}) },
  });
}
function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/* ------------------------------------------------------------------ */
/* S1 — the stay-receipt dialect matrix                                 */
/* ------------------------------------------------------------------ */

console.log("S1. isStayReceipt — the dialects a bring-home can and cannot resolve");
{
  must(
    isStayReceipt(
      "24 image file(s) stayed on the cluster — extract jobs sync metadata only under the key-files policy (STAR, logs and plots come home; image stacks never do, whatever their size). They are listed in this job's Results — open or download one to fetch it on demand — or switch the connection's sync policy to \"everything\" to bring them home"
    ),
    "S1: the metadata-only receipt is a stay-receipt"
  );
  must(
    isStayReceipt(
      "2 bulky file(s) stayed on the cluster (key-files policy): map.mrc, half.map — they are listed in this job's Results; preview or download them there on demand"
    ),
    "S1: the key-cap receipt is a stay-receipt"
  );
  must(
    isStayReceipt(
      "3 file(s) stayed on the cluster (caps): a.mrc (300 MB > 200 MB cap), b.mrc (310 MB > 200 MB cap), c.mrc (320 MB > 200 MB cap) — raise the sync caps in the connection settings or fetch them manually from the cluster workdir"
    ),
    "S1: the caps receipt is a stay-receipt"
  );
  must(
    isStayReceipt(
      "mic_001_extract.mrcs stayed on the cluster (verified there) — downstream cluster jobs chain off the cluster copy in place; raise the connection's sync caps to bring it home"
    ),
    "S1: the remote-run names dialect is a stay-receipt"
  );
  must(
    !isStayReceipt(
      "sync-back failed (workdir unreadable over SSH) — outputs remain on the cluster"
    ),
    "S1: the ssh-loss note is NOT a stay-receipt (bring-home cannot resolve an unreachable cluster)"
  );
  must(
    !isStayReceipt(
      "2 file(s) in the workdir were left behind by an EARLIER run of this job (old.map, older.map) — they predate this dispatch (the pre-run wipe could not remove them), so they were NOT synced back as this run's outputs"
    ),
    "S1: the stale-generation verdict is NOT a stay-receipt"
  );
  must(
    !isStayReceipt(
      "2 file(s) in the workdir were left behind by an EARLIER run of this job (old.map) — NOT synced back as this run's outputs — 4 image file(s) stayed on the cluster — extract jobs sync metadata only"
    ),
    "S1: a mixed stayed+EARLIER note stays amber (one resolved segment must not silence the other)"
  );
  must(!isStayReceipt(""), "S1: the empty note is nothing");
}

/* ------------------------------------------------------------------ */
/* Fixtures — jobs, workdirs, manifests                                 */
/* ------------------------------------------------------------------ */

const active = await ensureActiveProject();
const pid = active!.project.id;

async function makeJob(name: string, type: string): Promise<string> {
  const j = await db.job.create({
    data: {
      projectId: pid,
      type,
      name,
      x: 0,
      y: 0,
      status: "completed",
      params: "{}",
      duration: 1000,
    },
  });
  return j.id;
}

const remoteJobId = await makeJob("Extract (bench)", "extract");
const bareJobId = await makeJob("Import (no run)", "import");
const localJobId = await makeJob("Motion (local run)", "motioncorr");

// the remote run: workdir holds 2 of 3 manifest files
const workdir = path.join(TMP, "wd-extract");
mkdirSync(path.join(workdir, "extra"), { recursive: true });
writeFileSync(path.join(workdir, "extra", "mic_001_extract.mrcs"), "stack-1");
writeFileSync(path.join(workdir, "extra", "mic_002_extract.mrcs"), "stack-2");
writeFileSync(path.join(workdir, "particles.star"), "data_star");
writeRemoteManifest(workdir, {
  connectionId: "conn-bench",
  remoteWorkdir: "/home/cryo/cryoflow/extract_bench",
  files: [
    { path: "extra/mic_001_extract.mrcs", size: 7 },
    { path: "extra/mic_002_extract.mrcs", size: 7 },
    { path: "extra/mic_003_extract.mrcs", size: 7 },
  ],
});

function makeRun(jobId: string, type: string, workdirPath: string | null, remote: boolean) {
  upsertRun(jobId, {
    jobId,
    projectId: pid,
    type,
    pid: null,
    cmd: `relion_${type} --bench`,
    workdir: workdirPath ?? path.join(TMP, "wd-missing"),
    logFile: path.join(TMP, "run.out"),
    errFile: path.join(TMP, "run.err"),
    startedAt: new Date().toISOString(),
    outputs: {},
    done: true,
    exitCode: 0,
    ...(remote
      ? {
          remote: {
            connectionId: "conn-bench",
            connectionName: "Mock Cluster",
            host: "127.0.0.1:3022",
            user: "cryo",
            module: "relion/5.0.1",
            mode: "slurm" as const,
            remoteRoot: "/home/cryo/cryoflow",
            remoteWorkdir: "/home/cryo/cryoflow/extract_bench",
            pid: null,
            slurmId: "1001",
            phase: "running" as const,
            note: "3 image file(s) stayed on the cluster — extract jobs sync metadata only",
          },
        }
      : {}),
  });
}

makeRun(remoteJobId, "extract", workdir, true);
mkdirSync(path.join(TMP, "wd-local"), { recursive: true });
makeRun(localJobId, "motioncorr", path.join(TMP, "wd-local"), false);

/* ------------------------------------------------------------------ */
/* S2-S6 — the remote-remaining route, in-process                       */
/* ------------------------------------------------------------------ */

console.log("S2-S6. GET /api/jobs/[id]/outputs/remote-remaining");
{
  const foreign = await stayRoute.GET(req("/api/jobs/x/outputs/remote-remaining", { headers: FOREIGN_ORIGIN }), routeCtx("x"));
  must(foreign.status === 403, "S2: cross-site probe answers 403");

  const ghost = await stayRoute.GET(req("/api/jobs/ai-ghost/outputs/remote-remaining"), routeCtx("ai-ghost"));
  must(ghost.status === 404, "S3: a ghost job answers 404");

  const bare = await stayRoute.GET(req(`/api/jobs/${bareJobId}/outputs/remote-remaining`), routeCtx(bareJobId));
  must(bare.status === 400, "S4: a job with no run record answers 400 (no workdir, no presence truth)");

  const local = await stayRoute.GET(req(`/api/jobs/${localJobId}/outputs/remote-remaining`), routeCtx(localJobId));
  const localBody = (await local.json()) as { ok: boolean; remaining: number; total: number };
  must(
    local.status === 200 && localBody.remaining === 0 && localBody.total === 0,
    "S5: a non-remote run answers 0/0 (vacuously all-home)"
  );

  const remote = await stayRoute.GET(req(`/api/jobs/${remoteJobId}/outputs/remote-remaining`), routeCtx(remoteJobId));
  const remoteBody = (await remote.json()) as { ok: boolean; remaining: number; total: number };
  must(
    remote.status === 200 && remoteBody.remaining === 1 && remoteBody.total === 3,
    `S6: the honest count reads the disk (1 of 3 still out, got ${remoteBody.remaining}/${remoteBody.total})`
  );

  // the bring-home lands: the count must flip to 0 — the resolved stamp's truth
  writeFileSync(path.join(workdir, "extra", "mic_003_extract.mrcs"), "stack-3");
  const after = await stayRoute.GET(req(`/api/jobs/${remoteJobId}/outputs/remote-remaining`), routeCtx(remoteJobId));
  const afterBody = (await after.json()) as { remaining: number; total: number };
  must(
    afterBody.remaining === 0 && afterBody.total === 3,
    "S6: after the last file lands the count flips to 0/3 — the receipt may now resolve"
  );
}

/* ------------------------------------------------------------------ */
/* J1 — the machine-readable export (lib)                               */
/* ------------------------------------------------------------------ */

console.log("J1. sessionToExportJson — the envelope");
{
  const s = createSession(pid);
  saveSession({
    ...s,
    title: "结构化出口演练",
    messages: [
      { role: "user", content: "看这行 ## 伪造标题 [x](y) — JSON 里必须是纯字符串", at: Date.now() - 4_000 },
      {
        role: "assistant",
        content: "建好了。",
        at: Date.now() - 3_000,
        toolCalls: [{ id: "c1", name: "create_job", args: { type: "import", name: "Import 1" } }],
      },
      {
        role: "tool",
        toolCallId: "c1",
        name: "create_job",
        content: JSON.stringify({ ok: true, summary: "Import 1 已创建", detail: "job id j-1" }),
        at: Date.now() - 2_500,
      },
      { role: "assistant", content: "完成。", at: Date.now() - 2_000 },
    ],
  });
  const session = getSession(s.id)!;
  const tools = toolCallsUsed(session);
  const json = sessionToExportJson(session, "β-Galactosidase Tutorial", tools);
  const parsed = JSON.parse(json) as {
    format: string;
    version: number;
    exportedAt: string;
    session: {
      id: string;
      title: string | null;
      project: string;
      messageCount: number;
      toolCallCount: number;
      messages: Array<Record<string, unknown>>;
    };
  };
  must(parsed.format === "cryoflow-ai-session" && parsed.version === 1, "J1: the envelope is versioned");
  must(!Number.isNaN(Date.parse(parsed.exportedAt)), "J1: exportedAt is a real ISO instant");
  must(parsed.session.id === s.id && parsed.session.title === "结构化出口演练", "J1: the rename is the structured title");
  must(parsed.session.project === "β-Galactosidase Tutorial", "J1: the project name rides along");
  must(parsed.session.messageCount === 4 && parsed.session.toolCallCount === tools, "J1: the counts are live-counted");

  const user = parsed.session.messages[0] as { role: string; content: string; at: string };
  must(
    user.role === "user" && user.content.includes("## 伪造标题") && !Number.isNaN(Date.parse(user.at)),
    "J1: user content stays a pure string (JSON needs no escapeMd — structure forgery is impossible by construction)"
  );
  const assistant = parsed.session.messages[1] as { toolCalls?: Array<{ name: string; args: Record<string, unknown> }> };
  must(
    assistant.toolCalls?.[0]?.name === "create_job" && assistant.toolCalls[0].args.type === "import",
    "J1: tool call args ride as real objects"
  );
  const tool = parsed.session.messages[2] as { role: string; name: string; ok: boolean; summary: string; raw?: string };
  must(
    tool.role === "tool" && tool.ok === true && tool.summary === "Import 1 已创建",
    "J1: the tool result's {ok,summary} envelope is parsed into FIELDS, not quoted prose"
  );
  must((tool as { raw?: string }).raw === "job id j-1", "J1: the detail field survives as raw context");
  must(!sessionToMarkdown(session, "P", tools).includes('"cryoflow-ai-session"'), "J1: the md twin keeps its own shape (no envelope leak)");

  // failure + unparseable + cleared title
  const failing = structuredClone(session);
  const toolMsg = failing.messages.find((m) => m.role === "tool") as Extract<(typeof failing.messages)[number], { role: "tool" }>;
  toolMsg.content = JSON.stringify({ ok: false, summary: "端口不匹配" });
  toolMsg.isError = true;
  const failParsed = JSON.parse(sessionToExportJson(failing, "P", 1)) as { session: { messages: Array<{ ok: boolean | null }> } };
  const failTool = failParsed.session.messages.find((m) => "ok" in m)!;
  must(failTool.ok === false, "J1: isError speaks ok:false — failures are data, not dialect");

  const raw = structuredClone(session);
  (raw.messages.find((m) => m.role === "tool") as { content: string }).content = "not json at all";
  const rawParsed = JSON.parse(sessionToExportJson(raw, "P", 1)) as { session: { messages: Array<{ summary: string | null; raw?: string }> } };
  const rawTool = rawParsed.session.messages.find((m) => "raw" in m)!;
  must(rawTool.summary === null && rawTool.raw === "not json at all", "J1: unparseable content degrades to a labeled raw, honestly");

  const cleared = structuredClone(session);
  cleared.title = null;
  must(
    (JSON.parse(sessionToExportJson(cleared, "P", 1)) as { session: { title: string | null } }).session.title === null,
    "J1: a cleared rename answers null (the reader falls back to its own display law)"
  );

  const fnJ = sessionFileName(session, "json");
  const fnMd = sessionFileName(session);
  must(/^ai-session-\d{8}-\d{4}-[a-z0-9]+\.json$/.test(fnJ) && !/[^\x20-\x7e]/.test(fnJ), `J1: ASCII-safe json filename (${fnJ})`);
  must(fnMd.endsWith(".md"), "J1: the md default is unchanged");
}

/* ------------------------------------------------------------------ */
/* J2-J5 — the export route, in-process                                 */
/* ------------------------------------------------------------------ */

console.log("J2-J5. GET /api/ai/sessions/[id]?format=json");
{
  const sid = (() => {
    const s = createSession(pid);
    saveSession({
      ...s,
      title: "路由级导出",
      messages: [{ role: "user", content: "导出我", at: Date.now() }],
    });
    return s.id;
  })();

  const foreignReq = await sessionRoute.GET(req(`/api/ai/sessions/${sid}?format=json`, { headers: FOREIGN_ORIGIN }), routeCtx(sid));
  must(foreignReq.status === 403, "J2: cross-site JSON export answers 403");

  const res = await sessionRoute.GET(req(`/api/ai/sessions/${sid}?format=json`), routeCtx(sid));
  must(res.status === 200, "J2: the JSON export answers 200");
  must((res.headers.get("content-type") ?? "").includes("application/json"), "J2: content-type is application/json");
  const cd = res.headers.get("content-disposition") ?? "";
  must(/^attachment; filename="ai-session-.*\.json"$/.test(cd), `J2: served as a .json attachment (${cd})`);
  const body = JSON.parse(await res.text()) as { format: string; session: { id: string; title: string | null } };
  must(body.format === "cryoflow-ai-session" && body.session.id === sid && body.session.title === "路由级重命名".slice(0, 0) + "路由级导出", "J2: the body parses to the envelope with the session inside");

  const xml = await sessionRoute.GET(req(`/api/ai/sessions/${sid}?format=xml`), routeCtx(sid));
  must(xml.status === 400, "J3: an unsupported explicit format answers 400 (no silent fallback)");

  const plain = await sessionRoute.GET(req(`/api/ai/sessions/${sid}`), routeCtx(sid));
  const plainBody = (await plain.json()) as { session: { id: string } };
  must(plain.status === 200 && plainBody.session?.id === sid, "J4: the plain door still speaks inline session (drawer switch unchanged)");

  const foreign = createSession("ghost-project");
  saveSession({ ...foreign, messages: [{ role: "user", content: "别项目的悄悄话", at: Date.now() }] });
  const fRes = await sessionRoute.GET(req(`/api/ai/sessions/${foreign.id}?format=json`), routeCtx(foreign.id));
  must(fRes.status === 404, "J5: a foreign session cannot be exported as JSON either (pinning law)");

  must(typeof NextResponse.json === "function", "J5: route module speaks NextResponse");
}

console.log(`\nt429 stay-note + JSON export: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
