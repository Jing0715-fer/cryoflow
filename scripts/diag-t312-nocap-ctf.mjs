#!/usr/bin/env node
/**
 * t312 diag — the user's two tickets, end to end against the mock cluster:
 *
 *  1. NO-CAP BROWSER: a 2,054-file session folder (EPU naming) must arrive
 *     WHOLE through the remote browse route (entries 2054 = total 2054,
 *     truncated false) — the retired 400-row preview cap is the whole point.
 *  2. RAW-MOVIE CTF GUARD (t314 semantics): import that folder (2,054
 *     *_Fractions[_DW].mrc files whose REAL MRC headers say NZ=40 —
 *     genuine frame stacks), wire ctffind onto it, dispatch → the honest
 *     requestError refusal that teaches MotionCorr first, BEFORE any
 *     staging (no workdir, no row flip), now carrying the header's own
 *     numbers as evidence. The 12-file mic_*.mrcs control dispatches for
 *     real and completes — the guard has no false positives. The fixtures
 *     carry REAL 64-byte MRC headers because t314's gate verifies bytes,
 *     not names (the t312 filename smell alone can no longer refuse
 *     anything — the Beijing user's motion-corrected *_Fractions_DW.mrc
 *     micrographs proved that false positive).
 *
 * Run against the standalone prod server on :3001 (t301/t311 doctrine).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t312";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3001",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 800) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  }).stdout?.trim() ?? "";

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

/** the single-job GET route does not exist (405) — poll the LIST route and
 *  find by id (t304's getJobs pattern). */
const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
// hoisted for the finally: the project whose LOCAL workdir subtree
// (data/relion/<projectId>/…) this diag owns — nothing broader burns
let projectId = null;
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  if (b?.job?.projectId) projectId = b.job.projectId;
  return b?.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
  (
    await api("/api/edges", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    })
  ).status;

// ---------------------------------------------------------------- try/catch
try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  // ---- the connection -----------------------------------------------------
  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t312",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  // ---- the remote project -------------------------------------------------
  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t312 no-cap + ctf guard", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // ---- the fixtures (t314): REAL MRC headers, not empty touch-files -----
  // the gate now reads NZ off the bytes — a stack fixture needs a stack
  // header (5760x4092 x 40 frames, mode 1) and the control needs a single
  // image header (4096x4096, mode 2 float32). One SSH exec builds both
  // trees with cp loops.
  const mrc = (nx, ny, nz, mode) => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(nx, 0);
    b.writeInt32LE(ny, 4);
    b.writeInt32LE(nz, 8);
    b.writeInt32LE(mode, 12);
    return b;
  };
  const stackB64 = mrc(5760, 4092, 40, 1).toString("base64");
  const singleB64 = mrc(4096, 4096, 1, 2).toString("base64");
  const mkFixtures = `mkdir -p /data2/movies-t312 /data2/mics-t312; ` +
    `echo ${stackB64} | base64 -d > /tmp/.t312-stack.mrc; ` +
    `echo ${singleB64} | base64 -d > /tmp/.t312-single.mrc; ` +
    `for i in \$(seq 1 2054); do ` +
    `if [ \$((i % 2)) -eq 0 ]; then ` +
    `cp /tmp/.t312-stack.mrc /data2/movies-t312/20241031_lijing_925_neiyan_2_1_20241031_\$\{i\}_Fractions_DW.mrc; ` +
    `else cp /tmp/.t312-stack.mrc /data2/movies-t312/20241031_lijing_925_neiyan_2_1_20241031_\$\{i\}_Fractions.mrc; fi; done; ` +
    `for i in \$(seq 1 12); do cp /tmp/.t312-single.mrc /data2/mics-t312/mic_\$\{i\}.mrcs; done; ` +
    `mkdir -p /data2/movies-t311; ` +
    `for i in \$(seq 1 450); do cp /tmp/.t312-single.mrc /data2/movies-t311/t311_\$\{i\}.mrc; done`;
  const fixtureOut = client(mkFixtures);
  must(fixtureOut === "", `the fixtures build quietly (${fixtureOut.slice(0, 80)})`);

  // ======================================================================
  console.log("== PHASE 1: the 2,054-file folder arrives WHOLE ==");
  const browse = await api(
    `/api/remote/connections/${CONN}/browse?path=${encodeURIComponent("/data2/movies-t312")}`,
    { headers: SH }
  );
  must(browse.status === 200, `browse 200 (${browse.status})`);
  const entries = browse.body?.entries ?? [];
  must(entries.length === 2054, `every entry arrives: ${entries.length} (want 2054 — the 400 cap is retired)`);
  must(browse.body?.totalEntries === 2054, `totalEntries ${browse.body?.totalEntries} (want 2054)`);
  must(browse.body?.truncated === false, "truncated false — nothing is hidden");
  must(browse.body?.micrographs === 2054, `micrographs ${browse.body?.micrographs} (want 2054)`);
  const dwCount = entries.filter((e) => /DW\.mrc$/i.test(e.name)).length;
  must(dwCount === 1027, `DW subset intact: ${dwCount} (want 1027 — the filter now sees the WHOLE folder)`);
  const absOk = entries.every((e) => e.dir || String(e.abs ?? "").startsWith("/data2/movies-t312/"));
  must(absOk, "every file carries its cluster-absolute path");

  // the t311 regression: the 450-folder also arrives whole (same door)
  const browse450 = await api(
    `/api/remote/connections/${CONN}/browse?path=${encodeURIComponent("/data2/movies-t311")}`,
    { headers: SH }
  );
  must(
    (browse450.body?.entries ?? []).length === 450 && browse450.body?.truncated === false,
    "the 450-folder still arrives whole (450, untruncated)"
  );

  // the ledger: the retired cap + the shared constant
  const remoteLs = readFileSync(`${ROOT}/src/lib/remote/remote-ls.ts`, "utf8");
  must(
    remoteLs.includes("REMOTE_MAX_ENTRIES = BROWSER_LIST_MAX") &&
      readFileSync(`${ROOT}/src/lib/browse-caps.ts`, "utf8").includes("CF_BROWSER_MAX"),
    "B: the browser ceiling is the shared CF_BROWSER_MAX constant (20,000 default)"
  );
  const dialogSrc = readFileSync(`${ROOT}/src/components/workflow/path-browser-dialog.tsx`, "utf8");
  must(
    dialogSrc.includes("LIST_ROW_PX") && dialogSrc.includes("translateY("),
    "B: the dialog virtualizes the listing (windowed rows — 2,054 scroll like 40)"
  );

  // ======================================================================
  console.log("== PHASE 2: import enumerates all 2,054 ==");
  const importA = await mkJob({
    projectId,
    type: "import",
    name: "QA t312 raw movies",
    params: { micrographsPath: "/data2/movies-t312", pixelSize: 0.5, voltage: 300 },
  });
  must(!!importA?.id, "the import job creates");
  const runA = await api(`/api/jobs/${importA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA.status >= 200 && runA.status < 300, `the native import run accepts (${runA.status})`);
  const doneA = await pollUntil(async () => {
    const j = await jobById(importA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneA?.status === "completed", `the import completes (${doneA?.status})`);
  must(
    /2,?054 micrographs imported/.test(String(doneA?.result ?? "")),
    `the result speaks the full count: ${String(doneA?.result ?? "").slice(0, 120)}`
  );
  // t314 — the import SNIFFED the bytes and said so in the receipt
  must(
    /40-section frame stacks/i.test(String(doneA?.result ?? "")) && /MotionCorr/.test(String(doneA?.result ?? "")),
    `the import note names the stacks by their headers: ${String(doneA?.result ?? "").slice(0, 160)}`
  );
  // the star itself: 2,054 cluster-absolute rows, all movie-stack-named
  // (the list DTO strips outputs — the engine's own workdir is the truth:
  // data/relion/<projectId>/import_*/micrographs.star)
  const { globSync } = await import("node:fs");
  const importStars = globSync(`${ROOT}/data/relion/${projectId}/import_*/micrographs.star`);
  must(importStars.length >= 1, `the import star exists on disk (${importStars.length} found)`);
  const starA = importStars[0] ?? "";
  const starText = starA ? readFileSync(starA, "utf8") : "";
  const rows = starText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\/data2\/movies-t312\/\S+\.mrc(\s+1)?$/.test(l));
  must(rows.length === 2054, `the star carries every row: ${rows.length} (want 2054)`);
  must(rows.every((r) => /_Fractions(_DW)?\.mrc(\s+1)?$/.test(r)), "every row smells like an EPU movie stack");

  // ======================================================================
  console.log("== PHASE 3: ctffind on VERIFIED raw stacks is REFUSED pre-staging ==");
  const ctfA = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t312 doomed ctf",
    params: {},
  });
  must(!!ctfA?.id, "the ctffind job creates");
  // the edge API validates the WORKFLOW registry's port NAMES — "micrographs",
  // not the engine's output key "micrographs_star" (t304's lesson, twice
  // learned now: a 400 the dispatch then starves on)
  const edgeA = await mkEdge(importA.id, ctfA.id, "micrographs", "micrographs");
  must(edgeA === 200 || edgeA === 201, `the edge wires import → ctffind (${edgeA})`);

  // snapshot the cluster tree + the job row BEFORE the dispatch (the refusal
  // must stage NOTHING and flip NOTHING)
  const projShellBefore = client("ls /projects/cryoflow/ 2>/dev/null").split("\n").filter(Boolean);
  const dispatchA = await api(`/api/jobs/${ctfA.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
    }),
  });
  must(dispatchA.status >= 200 && dispatchA.status < 300, `the dispatch route answers (${dispatchA.status})`);
  must(!!dispatchA.body?.error, "the dispatch is refused (an error rides the response)");
  const errA = String(dispatchA.body?.error ?? "");
  must(/MotionCorr/.test(errA), "the refusal teaches the fix (MotionCorr first)");
  must(/frame stack/i.test(errA), "the refusal names the disease (raw movie frame stacks)");
  must(/40 sections/.test(errA), `the refusal carries the header's own numbers (NZ=40): ${errA.slice(0, 120)}…`);
  must(/5760×4092|5760x4092/.test(errA), "the refusal names the verified dimensions");
  must(/2,?054/.test(errA) || /2054/.test(errA), `the refusal counts the evidence (${errA.slice(0, 80)}…)`);
  must(
    dispatchA.body?.waiting === undefined,
    "the refusal rides the request lane (no `waiting` — the row is neither pending nor failed; the toast carries the why)"
  );
  const ctfAafter = await jobById(ctfA.id);
  must(
    ctfAafter?.status !== "failed",
    `the job row is NOT failed (${ctfAafter?.status})`
  );
  const projShellAfter = client("ls /projects/cryoflow/ 2>/dev/null").split("\n").filter(Boolean);
  must(
    projShellAfter.length === projShellBefore.length,
    "NOTHING landed on the cluster (refused before staging)"
  );

  // ======================================================================
  console.log("== PHASE 4: the control — mic_*.mrcs names dispatch for real ==");
  const importB = await mkJob({
    projectId,
    type: "import",
    name: "QA t312 control mics",
    params: { micrographsPath: "/data2/mics-t312", pixelSize: 1.0, voltage: 300 },
  });
  const runB = await api(`/api/jobs/${importB.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runB.status >= 200 && runB.status < 300, "the control import runs");
  const doneB = await pollUntil(async () => {
    const j = await jobById(importB.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneB?.status === "completed", `the control import completes (${doneB?.status})`);
  must(/12 micrographs imported/.test(String(doneB?.result ?? "")), `the control counts 12 (${String(doneB?.result ?? "").slice(0, 80)})`);

  const ctfB = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t312 control ctf",
    params: {},
  });
  const edgeB = await mkEdge(importB.id, ctfB.id, "micrographs", "micrographs");
  must(edgeB === 200 || edgeB === 201, "the control edge wires");
  const dispatchB = await api(`/api/jobs/${ctfB.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
    }),
  });
  must(dispatchB.body?.ok !== false, `the control dispatches (${dispatchB.body?.error ?? "accepted"})`);
  const doneCtfB = await pollUntil(async () => {
    const j = await jobById(ctfB.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(doneCtfB?.status === "completed", `the control ctffind completes on the mock (${doneCtfB?.status}: ${String(doneCtfB?.result ?? "").slice(0, 90)})`);
  must(!/frame stack/i.test(String(doneCtfB?.result ?? "")), "no movie-stack smell on the control");

  // ======================================================================
  console.log("== PHASE 5: the failure-diagnosis ledger ==");
  const diagSrc = readFileSync(`${ROOT}/src/lib/log-diagnosis.ts`, "utf8");
  must(
    /ctffind-no-fit/.test(diagSrc) &&
      /failed to estimate CTF parameters for any micrograph/.test(diagSrc),
    "B: the Log tab knows the ctffind all-failed signature (log-diagnosis pattern)"
  );
  const remoteRunSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  must(
    remoteRunSrc.includes("CTF diagnosis: ctffind rejected EVERY micrograph at once"),
    "B: the remote failure strip carries the compact CTF diagnosis (t314 wording)"
  );
  // the regex itself against the USER'S OWN pasted error text (the real
  // cluster's words, not a paraphrase)
  const userError =
    "WARNING: skipping, since cannot get CTF values for /data06/x.mrc\nERROR:\n/opt/ohpc/pub/apps/relion//deps/bin/ctffind failed to estimate CTF parameters for any micrograph, exiting...";
  must(
    /failed to estimate CTF parameters for any micrograph|cannot get CTF values for/i.test(userError),
    "the signature matches the user's real cluster error verbatim"
  );

  console.log(`\n== t312 diag: ${fail === 0 ? "ALL GREEN" : `${fail} FAIL`} ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side shells -------------------
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  if (projectId) {
    // the cluster-side project shell (workdirs + staged mirrors) AND the
    // local workdir subtree — THIS project only (t309's lesson: never a
    // broad rm that eats a sibling suite's or the demo's trees)
    try {
      client(`rm -rf /projects/cryoflow/${projectId}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    try {
      client("rm -rf /data2/movies-t312 /data2/mics-t312 /data2/movies-t311 /tmp/.t312-stack.mrc /tmp/.t312-single.mrc");
    } catch { /* fixtures are runtime, gitignored */ }
    try {
      rmSync(path.join(ROOT, "data/relion", projectId), { recursive: true, force: true });
    } catch { /* may not exist */ }
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);
