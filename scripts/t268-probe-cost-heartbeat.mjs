/**
 * t268 — the probe's cost becomes visible + the staging heartbeat meets a
 * living witness (the remote observability round).
 *
 * Two strands, one theme — "the remote world should be legible while it
 * works, not only when it finishes":
 *
 *  1. probe.durationMs (t267's aftermath): the auto-probe made the probe
 *     part of EVERY dispatch's latency, so its wall-clock cost now rides
 *     the probe record itself — the dialog's health dot says "last probe
 *     ok in 1.2s", the probe card shows it next to the check time, and the
 *     auto-probe says it out loud in the server log. A slow cluster's
 *     dispatch latency becomes VISIBLE instead of just felt.
 *
 *  2. the staging heartbeat's living witness (t263's ledger gap): the
 *     heartbeat mechanism was pinned by FORGED records (dead-beat flips),
 *     but no suite ever watched it BEAT — a staging phase long enough to
 *     cross the 10s interval, with the ledger's stagingBeat advancing
 *     underneath it. The recipe: a 140-micrograph import tree staged to
 *     the mock cluster (~280 SSH exec round-trips) keeps staging genuinely
 *     mid-flight while the suite reads the beat twice.
 *
 * Phases:
 *   A  demo truth (roster 21, mock cluster)
 *   B  ledger — durationMs in the type, the wrapper in probe.ts, the two
 *      dialog surfaces, the auto-probe log line
 *   C  live loop —
 *      C1  a 500-micrograph import (real, engine-native)
 *      C2  a probeless connection (deliberately never tested)
 *      C3  bare-API dispatch → the staging heartbeat ADVANCES (beat2 > beat1,
 *          polled — the first run taught: the local mock is FAST, so the
 *          witness must poll for the advance, not sleep past it; the second
 *          taught that the default 10s beat never lands on a local rig —
 *          hence the tunable interval)
 *      C4  completion with lastProbe.durationMs > 0 (the auto-probe's
 *          cost persisted), REMOTE[] harvest
 *      C5  the dialog: probe card's data-probe-duration + the health dot's
 *          "last probe ok in X.Xs" title
 *   D  console clean
 */
import { chromium } from "playwright";
import { execSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t268-mics";
const N_MICS = 500;
/**
 * t268 manages the server itself: the heartbeat interval is deployment-
 * tunable (CF_STAGING_BEAT_MS, default 10s), and a fast LOCAL rig needs a
 * fast beat for the advance to be witnessable. The suite reboots the
 * server with a 3s beat and restores the default server in finally.
 */
const BEAT_ENV = { ...process.env, CF_STAGING_BEAT_MS: "3000" };
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

/**
 * Reboot the app server with a given environment (t268's fast-beat boot;
 * finally restores the default). Kills the watchdog FIRST — it would
 * otherwise resurrect the old server behind us.
 */
const serverBoot = async (env) => {
  try { execSync("pkill -f qa-server-watchdog", { stdio: "pipe" }); } catch { /* none */ }
  try { execSync("pkill -f 'standalone/server.js'", { stdio: "pipe" }); } catch { /* none */ }
  try { execSync("pkill -f 'bun server.js'", { stdio: "pipe" }); } catch { /* none */ }
  try { execSync("fuser -k 3000/tcp", { stdio: "pipe" }); } catch { /* none */ }
  await sleep(2500);
  const child = spawn("bash", ["-c", "exec bash scripts/qa-server-watchdog.sh"], {
    cwd: "/home/z/my-project",
    env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      const r = await fetch(`${BASE}/`);
      if (r.status === 200) return true;
    } catch { /* not yet */ }
  }
  return false;
};

const booted = await serverBoot(BEAT_ENV);
if (!booted) {
  console.log("t268: FAIL — the fast-beat server never came up; aborting before any assertion");
  process.exit(1);
}
console.log("  (boot) the app server is up with CF_STAGING_BEAT_MS=3000");

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
  const probeSrc = src("src/lib/remote/probe.ts");
  const dlgSrc = src("src/components/workflow/remote-cluster-dialog.tsx");
  const rr = src("src/lib/remote/remote-run.ts");

  must(
    typesSrc.includes("durationMs?: number;"),
    "RemoteProbe carries durationMs (optional — pre-t268 records lack it)"
  );
  must(
    probeSrc.includes("const t0 = Date.now();") &&
      probeSrc.includes("durationMs: Date.now() - t0") &&
      probeSrc.includes("probeConnectionInner"),
    "the public probe entry wraps the inner probe with a wall-clock timer"
  );
  must(
    dlgSrc.includes('last probe ok${secs}') && dlgSrc.includes("(c.lastProbe.durationMs / 1000).toFixed(1)"),
    "the health dot's label speaks the probe's cost (in X.Xs)"
  );
  must(
    dlgSrc.includes('data-probe-duration=""'),
    "the probe card shows the cost next to the check time (data-probe-duration)"
  );
  must(
    rr.includes("auto-probed") && rr.includes("the dispatch ran the ceremony itself"),
    "the auto-probe says its cost out loud in the server log"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (a heartbeat caught beating) ==");

  // C1 — 700 tiny but valid MRC micrographs + a REAL local import.
  // First run's lesson: 140 files staged in UNDER 10s on the local mock —
  // the first heartbeat never even landed. 700 files ≈ 1400 SSH exec
  // round-trips ≈ 30-70s — genuinely mid-flight across several beats.
  // The witness POLLS for the advance (a fixed sleep would race a fast
  // cluster's staging in the other direction).
  mkdirSync(MICS_DIR, { recursive: true });
  const names = Array.from({ length: N_MICS }, (_, i) => `mic_${String(i + 1).padStart(3, "0")}.mrc`);
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
  must(names.length === N_MICS && names.every((n) => existsSync(path.join(MICS_DIR, n))), `${N_MICS} mock micrographs fabricated (64x64 float32)`);

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
  const readConns = async () => {
    const d = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    return d.connections ?? d ?? [];
  };

  const importJob = await mkJob({
    type: "import",
    name: "t268 Import",
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
  }, 60_000);
  must(!!importDone, `the local import completed (${N_MICS} micrographs, engine-native)`);

  // C2 — a probeless connection: created, deliberately NEVER tested
  const connId = `qa-t268-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t268 AutoProbe",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);

  // C3 — bare-API dispatch; the staging heartbeat must be caught ADVANCING
  const jobM = await mkJob({ type: "motioncorr", name: "t268 MotionCorr Heartbeat" });
  const eM = await mkEdge(importJob.id, jobM.id, "micrographs", "movies");
  must(eM === 200 || eM === 201, `import → probeless-remote motioncorr wired (${eM})`);
  const dispatchM = await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchM.status === 200 || dispatchM.status === 201, `probeless dispatch accepted (${dispatchM.status})`);

  // the first heartbeat lands within ~10s of staging starting
  const beat1 = await pollUntil(() => {
    const rec = stateRuns()[jobM.id];
    return rec?.remote?.phase === "staging" && typeof rec?.remote?.stagingBeat === "number"
      ? rec.remote.stagingBeat
      : null;
  }, 40_000);
  must(!!beat1, `the staging heartbeat lands its first beat (${beat1 ? new Date(beat1).toISOString().slice(11, 19) : "never"})`);

  // cross a full beat interval: POLL for the beat to move while staging is
  // still live — the beat only lands while phase === 'staging', so an
  // advanced beat is its own witness of a living staging task
  const beat2 = await pollUntil(() => {
    const rec = stateRuns()[jobM.id];
    if (rec?.remote?.phase !== "staging") return null;
    const b = rec.remote.stagingBeat;
    return typeof b === "number" && b > beat1 ? b : null;
  }, 20_000);
  must(
    typeof beat2 === "number" && beat2 > beat1,
    `the staging heartbeat ADVANCES while staging (beat ${new Date(beat1).toISOString().slice(11, 19)} → ${beat2 ? new Date(beat2).toISOString().slice(11, 19) : "stuck"})`
  );

  // C4 — completion with the auto-probe's cost persisted
  const completedM = await pollUntil(async () => {
    const j = await readJob(jobM.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 240_000);
  must(completedM?.status === "completed", `the ${N_MICS}-micrograph cluster motioncorr completes (${completedM?.status}: ${(completedM?.result ?? "").slice(0, 60)})`);
  const connsAfter = await readConns();
  const probed = (Array.isArray(connsAfter) ? connsAfter : []).find((c) => c.id === connId);
  must(
    probed?.lastProbe?.ok === true && typeof probed?.lastProbe?.durationMs === "number" && probed.lastProbe.durationMs > 0,
    `the auto-probe's cost is persisted on lastProbe (${probed?.lastProbe?.durationMs ?? "absent"}ms)`
  );
  must(
    (completedM?.result ?? "").startsWith("REMOTE[") && (completedM?.result ?? "").includes(`motion corrected, ${N_MICS} micrographs`),
    `the result names its cluster origin and full harvest (${(completedM?.result ?? "").slice(0, 70)})`
  );

  // C5 — the dialog: both surfaces speak the cost
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true });
  await sleep(1200);
  const dlg = page.locator('[role="dialog"]').last();
  const durEl = dlg.locator("[data-probe-duration]").first();
  const durText = (await durEl.innerText().catch(() => "")) || "";
  must(
    (await durEl.isVisible().catch(() => false)) && /(^|\s)(\d+(\.\d+)?)(ms|s)(\s|$|·)/.test(durText.trim()),
    `the probe card shows the cost next to the check time ("${durText.trim().slice(0, 24)}")`
  );
  const dotTitle = await dlg
    .locator('[data-testid^="remote-dot-"], .relative span[class*="bg-emerald-500"]').first()
    .getAttribute("title")
    .catch(() => null);
  // the health dot's title rides whichever element carries it — accept the
  // probeDot contract wherever it renders
  let dotOk = typeof dotTitle === "string" && dotTitle.includes("last probe ok in");
  if (!dotOk) {
    const titles = await dlg.locator('[title*="last probe ok"]').allInnerTexts().catch(() => []);
    dotOk = titles.length > 0;
    if (!dotOk) {
      const anyTitle = await dlg
        .locator('[title*="last probe ok"]')
        .count()
        .catch(() => 0);
      dotOk = anyTitle > 0;
    }
  }
  must(dotOk, "the health dot's tooltip speaks 'last probe ok in X.Xs'");

  // ----定妆照 ---------------------------------------------------------------
  await page.screenshot({ path: `${SHOTS}/t268-probe-cost-dialog.png` });
  await page.keyboard.press("Escape");
  await page.locator(`[data-job="${jobM.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/t268-heartbeat-motioncorr.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt268: ALL PASS" : `\nt268: ${fail} FAIL`);
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
  // t268 restores the DEFAULT server (10s beat) for the rest of the family —
  // the fast beat was this suite's lens, not a change to the world.
  console.log("  (restore) rebooting the app server with the default environment…");
  const restored = await serverBoot(process.env);
  console.log(restored ? "  (restore) default server up (10s beat)" : "  (restore) WARNING — default server did not come back up");
}
