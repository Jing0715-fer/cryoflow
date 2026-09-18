/**
 * t269 — the remote run's time ledger (the observability round, act 2).
 *
 * t268 made the PROBE's cost visible; t269 makes the RUN's two cluster-added
 * waits visible: staging (upload) and sync-back (download). Both are wall-
 * clock timed in remote-run.ts, ride the record and the DTO, and the
 * inspector's remote strip speaks them once the run is terminal — where it
 * used to keep claiming "Running on the cluster · pid N" long after the pid
 * was dead (a pre-existing honesty bug the ledger line retires).
 *
 * Phases:
 *   A  demo truth
 *   B  ledger — stagedMs/syncMs in the types, the two timers in
 *      remote-run.ts, the DTO passthrough, the strip's three-phase speech
 *   C  live loop — six micrographs → import → probeless connection →
 *      bare-API dispatch (auto-probe) → completion →
 *      - record.remote.stagedMs > 0 && syncMs > 0 (the ledger lands)
 *      - the DTO carries stagedMs/syncMs/syncedFiles (the UI's source)
 *      - the inspector strip: "Ran on the cluster" + the data-remote-ledger
 *        span with staged/synced/file counts (and NO dead "Running" claim)
 *   D  console clean
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t269-mics";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
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

function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(MOCK_PORT, "127.0.0.1");
  });
}

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};

async function deleteJob(id) {
  try {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const createdJobs = [];
const connIds = [];

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const typesSrc = src("src/lib/remote/types.ts");
  const rr = src("src/lib/remote/remote-run.ts");
  const inspSrc = src("src/components/workflow/job-inspector.tsx");

  must(
    typesSrc.includes("stagedMs?: number;") && typesSrc.includes("syncMs?: number;"),
    "RemoteRunState/RemoteRunInfo carry stagedMs + syncMs (optional — pre-t269 records lack them)"
  );
  must(
    rr.includes("const stagedT0 = Date.now();") && rr.includes("phase: \"running\", stagedBytes, stagedMs }"),
    "the staging leg is wall-clock timed and lands with the spawn handoff"
  );
  must(
    rr.includes("const syncT0 = Date.now();") && rr.includes("syncMs,"),
    "the sync-back leg is wall-clock timed and lands at finalize"
  );
  must(
    rr.includes("stagedMs: r.stagedMs") && rr.includes("syncMs: r.syncMs") && rr.includes("syncedFiles: r.syncedFiles"),
    "the time ledger rides the DTO (remoteInfoFor passthrough)"
  );
  must(
    inspSrc.includes("formatLedgerMs") && inspSrc.includes("data-remote-ledger") && inspSrc.includes("Ran on the cluster"),
    "the inspector strip speaks the ledger (and retires the dead-pid 'Running' claim) — t299: the terminal text grew the scheduler's word, so the bare double-quoted literal became a template literal and the grep follows the substring"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (a ledger that lands) ==");

  // C1 — six tiny but valid MRC micrographs + a REAL local import
  mkdirSync(MICS_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  for (const n of names) {
    const W = 64, H = 64;
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12); // mode 2 = float32
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
    writeFileSync(path.join(MICS_DIR, n), buf);
  }
  must(names.every((n) => existsSync(path.join(MICS_DIR, n))), "six mock micrographs fabricated (64x64 float32)");

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
  const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
    const r = await fetch(`${BASE}/api/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    });
    return r.status;
  };
  const readJob = async (id) => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    return (d.jobs ?? []).find((x) => x.id === id) ?? null;
  };

  const importJob = await mkJob({
    type: "import",
    name: "t269 Import",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
  });
  must(!!importJob?.id, "the import job exists");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({}),
  });
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C2 — a probeless connection (the auto-probe ceremony, t267/t268 lineage)
  const connId = `qa-t269-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t269 Ledger",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);

  // C3 — bare-API dispatch → completion → the ledger lands
  const jobM = await mkJob({ type: "motioncorr", name: "t269 MotionCorr Ledger" });
  const eM = await mkEdge(importJob.id, jobM.id, "micrographs", "movies");
  must(eM === 200 || eM === 201, `import → probeless-remote motioncorr wired (${eM})`);
  const dispatchM = await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchM.status === 200 || dispatchM.status === 201, `probeless dispatch accepted (${dispatchM.status})`);
  const completedM = await pollUntil(async () => {
    const j = await readJob(jobM.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(completedM?.status === "completed", `the cluster motioncorr completes (${completedM?.status}: ${(completedM?.result ?? "").slice(0, 60)})`);

  // the ledger in the record
  const recM = stateRuns()[jobM.id];
  must(
    typeof recM?.remote?.stagedMs === "number" && recM.remote.stagedMs > 0 &&
      typeof recM?.remote?.syncMs === "number" && recM.remote.syncMs > 0,
    `the record's ledger lands (staged ${recM?.remote?.stagedMs ?? "?"}ms · synced ${recM?.remote?.syncMs ?? "?"}ms)`
  );
  // the ledger in the DTO (what the UI reads)
  const dtoJob = await readJob(jobM.id);
  const ri = dtoJob?.runRemote ?? null;
  must(
    ri && typeof ri.stagedMs === "number" && ri.stagedMs > 0 && typeof ri.syncMs === "number" && ri.syncMs > 0 &&
      typeof ri.syncedFiles === "number",
    `the DTO carries the ledger (staged ${ri?.stagedMs ?? "?"}ms · synced ${ri?.syncMs ?? "?"}ms · ${ri?.syncedFiles ?? "?"} files)`
  );

  // C4 — the inspector strip: terminal speech + the ledger span
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await page.locator(`[data-job="${jobM.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  const strip = page.locator('[role="note"][title*="cluster workdir"]').first();
  const stripText = ((await strip.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    stripText.includes("Ran on the cluster") && !stripText.includes("Running on the cluster"),
    `the terminal strip retires the dead pid ("${stripText.slice(0, 60)}")`
  );
  const ledger = page.locator("[data-remote-ledger]").first();
  const ledgerText = ((await ledger.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    (await ledger.isVisible().catch(() => false)) &&
      /staged \d+(\.\d+)?(ms|s|m\ds)/.test(ledgerText) &&
      /synced \d+(\.\d+)?(ms|s|m\ds)/.test(ledgerText) &&
      /file\(s\) back/.test(ledgerText),
    `the ledger span speaks both legs + the harvest ("${ledgerText.slice(0, 60)}")`
  );

  // ----定妆照 ---------------------------------------------------------------
  await page.screenshot({ path: `${SHOTS}/t269-time-ledger.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt269: ALL PASS" : `\nt269: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  try { execSync("pkill -f relion_run_motioncorr", { stdio: "pipe" }); } catch { /* none */ }
  for (const id of [...createdJobs].reverse()) await deleteJob(id);
  for (const cid of [...connIds].reverse()) {
    try {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
  try { rmSync(MICS_DIR, { recursive: true, force: true }); } catch { /* gone */ }
  try {
    const fs = await import("node:fs");
    const ids = createdJobs.map((id) => id.slice(-8));
    const projDir = "/home/z/my-project/data/relion";
    for (const proj of fs.readdirSync(projDir)) {
      const inner = path.join(projDir, proj);
      let entries = [];
      try { entries = fs.readdirSync(inner); } catch { continue; }
      for (const d of entries) {
        if (!ids.some((s) => d.endsWith(`_${s}`))) continue;
        try { rmSync(path.join(inner, d), { recursive: true, force: true }); } catch { /* best effort */ }
      }
      const link = path.join(inner, "micrographs");
      try {
        const st = fs.lstatSync(link);
        if (st.isSymbolicLink() && readlinkSync(link) === MICS_DIR) rmSync(link, { force: true });
      } catch { /* not a link */ }
    }
  } catch { /* best effort */ }
  try {
    execSync(
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/motioncorr_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs'`,
      { cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000 }
    );
  } catch { /* best effort */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
  await sleep(1500);
  try {
    const after = await (await fetch(`${BASE}/api/jobs`)).json();
    const n = (after.jobs ?? []).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}
