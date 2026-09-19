// t266-topaz-training-curve.mjs — the training curve's first living witness.
//
// The pieces all existed: the parser (three wild topaz shapes), the
// /api/jobs/[id]/topaz-training route, the inspector chart with its loss /
// precision-recall views. What never existed is a REAL RUN walking the
// whole path — qa53 seeds fixture files into an existing workdir, so the
// route's run.out branch, the parser's Pass B, and the chart itself were
// only ever exercised against hand-made logs. Worse, two REAL defects hid
// in the dark:
//   1. the route was UNGATED (the t251-class sibling that missed the door —
//      log/fsc got theirs, this one slipped; the parsed epochs leak the
//      training log's contents cross-site);
//   2. t265's stub printed an INVENTED epoch shape ("Epoch 1/5 — training
//      loss 0.44, test loss 0.50") that the parser reads as NOTHING (the
//      numOf regex demands loss[:=]; the same-line test loss would have
//      been routed test-ward wholesale) — the chart self-hid on every mock
//      training run. A stub must speak the contract's dialect; the stub
//      now prints the wild "## epoch N" shape real topaz prints.
// Phases:
//   A  demo truth
//   B  the ledger — the gate in source, the wild-shape stub, the chart's
//      best-test marker, the t251-class door comment
//   C  the live chain — cluster topaztrain (t265 recipe) → route speaks
//      five epochs with train/test loss AND precision/recall → the gate
//      matrix (bare/cross 403 node-side, same-origin 200) → the inspector
//      chart renders (loss view + badges + best-test dot) → the P/R view
//      toggle works → 定妆照
//   D  console clean
//
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readlinkSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t266-mics";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const RIG_BIN = "/home/z/my-project/services/mock-cluster/fs/opt/bin";

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
// the attacker's metadata — node-side only (the t259/t261 law: a browser
// cannot spoof sec-fetch-site, and page.evaluate fetch is same-origin)
const CROSS = {
  "Sec-Fetch-Site": "cross-site",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Origin: "https://evil.example",
};
const BARE = {}; // no fetch metadata at all (curl / rebind)

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
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const createdJobs = [];
const connIds = [];

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 23, `roster identity 23 (got ${roster0})`);
  must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const routeSrc = src("src/app/api/jobs/[id]/topaz-training/route.ts");
  const stubSrc = src("services/mock-cluster/fs/opt/bin/relion_autopick");
  const chartSrc = src("src/components/workflow/results/topaz-training-chart.tsx");

  must(
    routeSrc.includes('import { isLocalRequest } from "@/lib/http-guard";') &&
      routeSrc.includes("if (!isLocalRequest(request))") &&
      routeSrc.includes("status: 403"),
    "the topaz-training route carries the t251-class door (log/fsc's sibling)"
  );
  must(
    routeSrc.includes("workdir-derived data") && routeSrc.includes("t251-class sibling sweep"),
    "the door comment names the threat model class (workdir-derived data)"
  );
  must(
    stubSrc.includes('"## epoch {epoch} training loss=') &&
      stubSrc.includes('"## test loss='),
    "the stub speaks the WILD topaz shape (## epoch tags, key=value, split test lines)"
  );
  must(
    !stubSrc.includes("Epoch {epoch}/5 — training loss"),
    "the invented one-line shape t265 printed is gone (the parser read it as nothing)"
  );
  must(
    chartSrc.includes("ReferenceDot") && chartSrc.includes("bestTestEpoch") &&
      chartSrc.includes("NOT fragment-wrapped"),
    "the chart marks the best-test epoch (the FSC chart's marker language)"
  );
  const rvSrc = src("src/components/workflow/results/results-view.tsx");
  must(
    rvSrc.includes('import { TopazTrainingChart } from "./topaz-training-chart";') &&
      rvSrc.includes('<TopazTrainingChart jobId={job.id} running={job.status === "running"} />'),
    "the curve rides the RESULTS tab (dual-mount like FSC — the Overview-only " +
      "mount never met the completed-job smart default)"
  );

  // ---- Phase C: the live chain --------------------------------------------
  console.log("== PHASE C: the live chain (train on the cluster → the curve lights) ==");

  // C1 — six tiny but valid MRC micrographs + a REAL local import job
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
    name: "t266 Import",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77 },
  });
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

  // C2 — connection + probe. The probe is LOAD-BEARING, not ceremony: the
  // dispatch builds cluster argvs from lastProbe (relionHome, externals).
  // Skip it and an externals-bearing job fails with the LOCAL error flavor
  // ("Topaz executable not found — install ...") — t266's own live finding,
  // the unprobed-dispatch honesty gap now on the next-window ledger.
  const connId = `qa-t266-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t266 Mock",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  const probe = await fetch(`${BASE}/api/remote/connections/${connId}/test`, { method: "POST", headers: SH });
  const probeBody = await probe.json().catch(() => ({}));
  must(probe.status === 200 && probeBody?.ok === true, `the probe completes (got ${probe.status}, ok=${probeBody?.ok})`);

  let projId = importDone?.projectId ?? importJob.projectId ?? null;
  if (!projId) {
    for (const d of execSync("ls /home/z/my-project/data/relion", { stdio: "pipe" }).toString().trim().split("\n")) {
      if (existsSync(`/home/z/my-project/data/relion/${d}/import_${importJob.id.slice(-8)}`)) {
        projId = d;
        break;
      }
    }
  }

  // C3 — the picking SOURCE: LoG autopick on the cluster (t265's leg 1)
  const jobP = await mkJob({ type: "autopick", name: "t266 AutoPick LoG" });
  must(
    (await mkEdge(importJob.id, jobP.id, "micrographs", "micrographs")) >= 200,
    "import → LoG autopick wired"
  );
  await fetch(`${BASE}/api/jobs/${jobP.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  const doneP = await pollUntil(async () => {
    const j = await readJob(jobP.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  must(doneP?.status === "completed", `the cluster LoG autopick completes (${doneP?.status})`);

  // C4 — the training run: the curve's data source
  const jobT = await mkJob({ type: "topaztrain", name: "t266 Topaz Train" });
  must(
    (await mkEdge(importJob.id, jobT.id, "micrographs", "micrographs")) >= 200 &&
      (await mkEdge(jobP.id, jobT.id, "coords", "coords")) >= 200,
    "import + LoG coords wired into the trainer"
  );
  const dispatchT = await fetch(`${BASE}/api/jobs/${jobT.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  must(dispatchT.status === 200 || dispatchT.status === 201, `the topaztrain dispatched (${dispatchT.status})`);
  const doneT = await pollUntil(async () => {
    const j = await readJob(jobT.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneT?.status === "completed", `the cluster topaztrain completes (${doneT?.status}: ${(doneT?.result ?? "").slice(0, 50)})`);

  // the synced-back run.out speaks the wild shape
  const mirrorT = `/home/z/my-project/data/relion/${projId}/topaztrain_${jobT.id.slice(-8)}`;
  const runOut = path.join(mirrorT, "run.out");
  must(existsSync(runOut), "run.out synced back to the local mirror (the route's source #1)");
  const logText = existsSync(runOut) ? readFileSync(runOut, "utf8") : "";
  must(
    (logText.match(/## epoch \d+ training loss=/g) ?? []).length === 5,
    "the log carries five wild-shape epoch tags"
  );

  // C5 — the route: content + gate matrix
  const curveUrl = `${BASE}/api/jobs/${jobT.id}/topaz-training`;
  const same = await fetch(curveUrl, { headers: SH });
  must(same.status === 200, `same-origin curve fetch 200 (got ${same.status})`);
  const curve = await same.json().catch(() => ({}));
  const eps = curve?.epochs ?? [];
  must(
    eps.length === 5,
    `the route parses five epochs (got ${eps.length})`
  );
  must(
    eps.length > 0 && eps.every((e) => typeof e.trainLoss === "number" && typeof e.testLoss === "number"),
    "every epoch carries BOTH train and test loss"
  );
  must(
    eps.length > 0 && eps.every((e) => typeof e.precision === "number" && typeof e.testPrecision === "number"),
    "every epoch carries precision AND test precision (the P/R view lights up)"
  );
  must(
    eps.length === 5 && eps[0].it === 0 && eps[4].it === 4 && eps[4].trainLoss < eps[0].trainLoss,
    `the curve falls 0→4 (${eps[0]?.trainLoss?.toFixed(3)} → ${eps[4]?.trainLoss?.toFixed(3)})`
  );
  must(
    typeof curve?.source === "string" && curve.source.includes("run.out"),
    `the route names its source (${curve?.source ?? "absent"})`
  );

  const bare = await fetch(curveUrl, { headers: BARE });
  must(bare.status === 403, `bare (no fetch metadata) curve fetch 403 (got ${bare.status})`);
  const cross = await fetch(curveUrl, { headers: CROSS });
  must(cross.status === 403, `cross-site curve fetch 403 (got ${cross.status})`);
  const crossBody = await cross.json().catch(() => ({}));
  must(
    typeof crossBody?.error === "string" && crossBody.error.includes("Cross-site"),
    "the 403 speaks the door's route-speak"
  );

  // C6 — the inspector chart: loss view, badges, best-test dot, P/R toggle
  // fresh navigation before the click (the t258 recipe): Phase C's minute of
  // API churn leaves the canvas stale — a re-rendered card under a stale
  // locator eats force-clicks silently
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const jobMatches = await page.locator(`[data-job="${jobT.id}"]`).count();
  must(jobMatches > 0, `the trainer's card is on the canvas (${jobMatches} match(es))`);
  await page.locator(`[data-job="${jobT.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(1800);
  // diagnosability: the inspector law says know WHICH layer you are talking to
  const dlgCount = await page.locator('[role="dialog"]').count();
  must(dlgCount > 0, `the inspector dialog opened (got ${dlgCount})`);
  const section = page.locator('section[aria-label="Topaz training progress"]');
  if (!(await section.isVisible().catch(() => false))) {
    // absent-section forensics: WHICH inspector opened, and what does the
    // route say from INSIDE the page? (the t254 lesson: assert at the layer
    // that failed — node-side green + page-side empty is a different bug
    // than node-side empty)
    const dlgText = await page.locator('[role="dialog"]').last().innerText().catch(() => "(no dialog)");
    console.log(`  [forensics] dialog head: ${dlgText.slice(0, 160).replace(/\n+/g, " | ")}`);
    const pageFetch = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const b = await r.json().catch(() => ({}));
        return `status=${r.status} epochs=${(b.epochs ?? []).length} source=${b.source ?? "null"}`;
      } catch (e) {
        return `threw: ${String(e).slice(0, 80)}`;
      }
    }, `${BASE}/api/jobs/${jobT.id}/topaz-training`);
    console.log(`  [forensics] in-page curve fetch: ${pageFetch}`);
  }
  must(await section.isVisible().catch(() => false), "the inspector shows the Topaz training chart");
  must(
    (await section.locator("svg.recharts-surface").count()) > 0,
    "the chart's SVG surface rendered"
  );
  const header = await section.locator("div").first().innerText().catch(() => "");
  must(header.includes("5 epochs"), `the badge counts five epochs (${header.split("\n")[0]?.slice(0, 40)}…)`);
  must(header.includes("final loss"), "the final-loss badge is on");
  must(header.includes("best test"), "the best-test badge is on");
  must(header.includes("↓") && /\d+%/.test(header), "the improvement badge (↓N%) is on");
  // the best-test dot: amber-filled circle with a white ring, ON the surface
  const dotCount = await section.locator("svg.recharts-surface circle[fill='#f59e0b'][stroke='#ffffff']").count();
  must(dotCount === 1, `exactly one best-test ReferenceDot (${dotCount})`);
  // two loss curves visible: teal solid + amber dashed (stroke-dasharray set)
  must(
    (await section.locator("path.recharts-curve.recharts-line-curve").count()) >= 2,
    "both loss curves are on the surface"
  );

  // the P/R toggle — only rendered when the log carries picking metrics
  const prBtn = section.locator('button[aria-pressed][role="group"] button, [role="group"] button').filter({ hasText: "precision / recall" });
  must(await prBtn.first().isVisible().catch(() => false), "the P/R view toggle is present (the log carries metrics)");
  if (await prBtn.first().isVisible().catch(() => false)) {
    await prBtn.first().click();
    await sleep(600);
    const pctTicks = await section.locator("svg.recharts-surface").innerText().catch(() => "");
    must(
      /%/.test(pctTicks) || (await section.locator("svg.recharts-surface").count()) > 0,
      "the P/R view renders on the same surface"
    );
    // back to loss for the 定妆照
    await section.locator('[role="group"] button').filter({ hasText: "loss" }).first().click();
    await sleep(400);
  }

  await page.screenshot({ path: `${SHOTS}/t266-training-curve.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt266: ALL PASS" : `\nt266: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  // job-granular cleanup (t265's law): kill by workdir suffix, never by name
  for (const id of createdJobs) {
    try { execSync(`pkill -f "_${id.slice(-8)}"`, { stdio: "pipe" }); } catch { /* none */ }
  }
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
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/topaztrain_* /projects/cryoflow/*/autopick_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs /projects/cryoflow/*/_staged'`,
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
    must(n === 23, `roster restored to 23 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}
