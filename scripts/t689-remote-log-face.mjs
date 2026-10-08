// t689 — the remote log FACE gets its verdict (scripts lane, zero product build).
//
// Task 689: the rehearsal bed woke after ten dormant windows and t262's C7
// diag printed "the inspector's log tab rendered the cluster's words: false —
// the ROUTE above is the contract; the tab face is next-window's polish".
// Static analysis could not close it: the route's remote branch returns the
// same {tail} shape the face renders, the locator audit shows the Log tab is
// the only role=tab containing "Log", and remoteLogTail is cache-first for
// done records. So this probe reproduces the exact choreography with the
// face's own network traffic captured:
//   S  rig — mock cluster answering, homepage 200
//   A  world — import completes locally (engine-native), ctffind wired to it
//   B  cluster — connection created, remote dispatch accepted, run completes
//   C  contract — server-side log API carries the cluster's words (tail mode)
//   D  THE FACE — reload (full ingest), select the card, click the Log tab
//      (scoped to data-insp-face, the t681 lesson), poll the body; the probe
//      captures every /log response the browser actually received, so the
//      verdict distinguishes "the route lied to the face" from "the face
//      dropped the truth on the floor"
//   E  cleanup — jobs deleted, connection deleted, exact-path workdirs rm'd
//      (local mirror + cluster-side), the world keeps no trace
//
// Run: node scripts/t689-remote-log-face.mjs   (server on :3000, cluster up)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MICS_DIR = "/home/z/my-project/data/relion/t689-mics";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

async function pollUntil(fn, deadlineMs, intervalMs = 1200) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let pass = 0, fail = 0;
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  FAIL: ${label}`); }
};

function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });
}

const createdJobs = [];
let connId = null;

// ---- cluster-side exact-path rm (world-safe by construction: no globs) ----
const clusterRm = (dir) => {
  try {
    execSync(`node services/mock-cluster/test-client.mjs 'rm -rf ${dir}'`, {
      cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000,
    });
  } catch { /* best effort */ }
};

try {
  // ================= S — the rig =================
  console.log("== S: rig ==");
  must(await mockListening(), "the mock cluster answers on :3022");
  const home = await fetch(`${BASE}/`).then((r) => r.status).catch(() => 0);
  must(home === 200, `the homepage answers (${home})`);

  // ================= A — the world =================
  console.log("== A: world ==");
  // fabricate four 64x64 float32 MRCs (t262's fabrication, verbatim shape)
  const W = 64, H = 64;
  mkdirSync(MICS_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc"];
  for (const n of names) {
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12);
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
    writeFileSync(path.join(MICS_DIR, n), buf);
  }
  must(names.every((n) => existsSync(path.join(MICS_DIR, n))), "four mock micrographs fabricated (64x64 float32)");

  const mkJob = async (body) => {
    const r = await fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
    return b.job;
  };

  const importJob = await mkJob({
    type: "import",
    name: "t689 Import",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
  });
  must(!!importJob?.id, "the import job exists");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, {
    method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}",
  });
  const importDone = await pollUntil(async () => {
    const j = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs.find((x) => x.id === importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");
  const projId = importDone?.projectId ?? importJob.projectId ?? null;
  must(!!projId, `the project id resolves (${projId})`);

  const ctfJob = await mkJob({ type: "ctffind", name: "t689 CtfFind" });
  must(!!ctfJob?.id, "the ctffind job exists");
  const edgeRes = await fetch(`${BASE}/api/edges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromJobId: importJob.id, toJobId: ctfJob.id, fromPort: "micrographs", toPort: "micrographs" }),
  });
  must(edgeRes.status === 200 || edgeRes.status === 201, "the ctffind job is wired to the import");

  // ================= B — the cluster =================
  console.log("== B: cluster ==");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  connId = `qa-t689-${Date.now().toString(36)}`;
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const mk = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch("/api/remote/connections", {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: connId, name: "QA t689 Mock", host: "127.0.0.1", port: 3022,
        username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow",
      }),
    });
    return { status: r.status };
  }, { connId, SH });
  must(mk.status === 201, `the connection is created (${mk.status})`);

  const dispatch = await page.evaluate(async ({ jobId, connId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { jobId: ctfJob.id, connId, SH });
  must(dispatch.status === 200, `the remote dispatch is accepted (${dispatch.status})`);

  const readJob = async (id) =>
    ((await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? []).find((x) => x.id === id) ?? null;
  const completed = await pollUntil(async () => {
    const j = await readJob(ctfJob.id);
    return j?.status === "completed" ? j : null;
  }, 90_000, 1500);
  must(!!completed, "the cluster run completes end-to-end");
  const remoteWorkdir = completed?.runRemote?.remoteWorkdir ?? null;
  must(
    (completed?.result ?? "").startsWith("REMOTE["),
    `the result names its cluster origin (${(completed?.result ?? "").slice(0, 60)})`
  );

  // ================= C — the contract =================
  console.log("== C: the log contract (server-side) ==");
  const logApi = await fetch(`${BASE}/api/jobs/${ctfJob.id}/log`, { headers: SH });
  const logBody = await logApi.json().catch(() => null);
  must(
    logApi.status === 200 && (logBody?.tail ?? "").includes("cryoflow-mock ctffind"),
    `the log API streams the cluster's run.out (${logApi.status}, remote=${logBody?.remote}, "${(logBody?.tail ?? "").slice(0, 40)}")`
  );

  // ================= D — THE FACE =================
  console.log("== D: the face (the question) ==");
  // capture every /log response the browser actually receives
  const logResponses = [];
  page.on("response", async (res) => {
    if (res.url().includes("/log")) {
      let snippet = "";
      try {
        const t = await res.text();
        snippet = t.slice(0, 160);
      } catch { /* body unreadable */ }
      logResponses.push({ status: res.status(), url: res.url().split("/api/")[1], snippet });
    }
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2500);

  await page.locator(`[data-job="${ctfJob.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  const inspOpen = await page.locator('[data-insp-face="tabs"]').isVisible().catch(() => false);
  must(inspOpen, "the inspector opens on the remote job");

  const logTab = page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: "Log" }).first();
  await logTab.click().catch(() => {});
  const faceAlive = await pollUntil(async () => {
    const t = await page.locator("body").innerText().catch(() => "");
    return t.includes("cryoflow-mock ctffind") ? true : null;
  }, 12_000, 1500);
  if (!faceAlive) {
    await logTab.click().catch(() => {});
    await pollUntil(async () => {
      const t = await page.locator("body").innerText().catch(() => "");
      return t.includes("cryoflow-mock ctffind") ? true : null;
    }, 12_000, 1500);
  }
  must(!!faceAlive, "THE FACE renders the cluster's words (the t262 diag question answered)");

  // what the face actually received, verbatim — the evidence sentence
  console.log(`  (evidence) /log responses seen by the browser: ${logResponses.length}`);
  for (const r of logResponses.slice(0, 4)) {
    console.log(`    ${r.status} ${r.url} :: ${r.snippet.replace(/\n/g, "\\n").slice(0, 110)}`);
  }
  if (!faceAlive) {
    const consoleText = await page
      .locator('[data-insp-face="panel:log"]')
      .innerText()
      .catch(() => "(log panel text unreadable)");
    console.log(`  (evidence) log panel text when false: "${consoleText.replace(/\n/g, "\\n").slice(0, 220)}"`);
  }

  await page.screenshot({ path: `${SHOTS}/t689-remote-log-face.png`, fullPage: false }).catch(() => {});
  console.log("  📸 shots-qa/t689-remote-log-face.png");

  await browser.close();

  // ================= E — cleanup =================
  console.log("== E: cleanup ==");
  for (const id of createdJobs) {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => {});
  }
  if (connId) {
    await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH }).catch(() => {});
  }
  if (remoteWorkdir) clusterRm(remoteWorkdir);
  rmSync(MICS_DIR, { recursive: true, force: true });
  if (projId) {
    for (const id of createdJobs) {
      for (const kind of ["import", "ctffind"]) {
        rmSync(`/home/z/my-project/data/relion/${projId}/${kind}_${id.slice(-8)}`, { recursive: true, force: true });
      }
    }
  }
  const after = await (await fetch(`${BASE}/api/jobs`)).json().catch(() => null);
  const n = (after?.jobs ?? []).length;
  console.log(`  (cleanup) roster after: ${n} jobs · connection ${connId ? "deleted" : "never created"} · workdirs exact-path rm'd`);
} catch (err) {
  console.log(`  (fatal) ${err?.message ?? err}`);
  for (const id of createdJobs) {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => {});
  }
  if (connId) {
    await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH }).catch(() => {});
  }
  rmSync(MICS_DIR, { recursive: true, force: true });
  process.exitCode = 1;
}

console.log(`\n==== t689-remote-log-face: ${pass} pass / ${fail} fail ====`);
if (fail > 0) process.exitCode = 1;
