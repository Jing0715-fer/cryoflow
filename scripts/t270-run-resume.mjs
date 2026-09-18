/**
 * t270 — the connection's run résumé (the observability round, act 4).
 *
 * t268 made the PROBE's cost visible, t269 made the RUN's two waits visible;
 * both live on a SINGLE run. t270 aggregates: the cluster manager's dialog
 * now carries each connection's résumé — what this cluster has DONE for the
 * user (total/completed/failed + the ≤3 newest runs speaking the time
 * ledger's dialect). Zero runs omits the field entirely: "no résumé" is the
 * honest state, and only things that happened get badges.
 *
 * Phases:
 *   A  demo truth
 *   B  ledger — ConnectionRunResume in the types, the aggregation in
 *      remote-run.ts (connectionId filter, exit-code buckets, ≤3 newest),
 *      withRunResume on EVERY connection-returning route (GET list + POST
 *      create + PATCH edit: an edit must not erase the history), the
 *      dialog's RunResumeCard speaking formatLedgerMs (the shared dialect),
 *      and the inspector ledger's precise-ms tooltip (t269's leftover)
 *   C  live loop — six micrographs → import → probeless connection →
 *      - C2 the POST response carries NO resume (zero-run omission, proven)
 *      - C3 run 1 completes → résumé: total 1, completed 1, recent[0] with
 *        stagedMs/syncMs/syncedFiles (the ledger flows into the aggregate)
 *      - C4 run 2 completes → total 2 and recent[0] IS run 2 (newest first)
 *      - C5 run 3 dispatched then STOPPED → the 137 record lands in the
 *        failed bucket: total 3 · completed 2 · failed 1, recent[0] is run 3
 *      - C6 the dialog renders the résumé card (badges + 3 entries)
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
const MICS_DIR = "/home/z/my-project/data/relion/t270-mics";
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

  // ---- Phase B: the résumé's ledger ---------------------------------------
  console.log("== PHASE B: the résumé ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const typesSrc = src("src/lib/remote/types.ts");
  const rr = src("src/lib/remote/remote-run.ts");
  const listRoute = src("src/app/api/remote/connections/route.ts");
  const idRoute = src("src/app/api/remote/connections/[id]/route.ts");
  const dlgSrc = src("src/components/workflow/remote-cluster-dialog.tsx");
  const inspSrc = src("src/components/workflow/job-inspector.tsx");

  must(
    typesSrc.includes("export interface ConnectionRunResume") &&
      typesSrc.includes("export interface ConnectionRunResumeEntry") &&
      typesSrc.includes("resume?: ConnectionRunResume"),
    "the types carry ConnectionRunResume (+entry) and the DTO's optional resume"
  );
  must(
    rr.includes("export async function connectionRunResume") &&
      rr.includes("rec.remote?.connectionId !== connectionId") &&
      rr.includes("if (rec.exitCode === 0) resume.completed += 1;") &&
      rr.includes("resume.recent.slice(0, opts?.all ? undefined : 3)"),
    "connectionRunResume filters by connectionId, buckets by exitCode, keeps ≤3 newest (t295: the aperture is opts.all-wide, default unchanged)"
  );
  must(
    rr.includes("export async function withRunResume") &&
      rr.includes("return resume.total > 0 ? { ...dto, resume } : dto;"),
    "withRunResume omits the field at zero runs (the no-résumé honesty contract)"
  );
  must(
    listRoute.includes("withRunResume(toConnectionDTO(c))") || listRoute.includes("withRunResume(toConnectionDTO(conn))"),
    "the list GET rides every connection with its résumé"
  );
  must(
    idRoute.includes("withRunResume(toConnectionDTO(conn))") &&
      listRoute.includes("withRunResume(toConnectionDTO(conn))"),
    "POST create + PATCH edit return the résumé too (an edit must not erase the history)"
  );
  must(
    dlgSrc.includes("function RunResumeCard") &&
      dlgSrc.includes('data-run-resume=""') &&
      dlgSrc.includes('from "./job-inspector"'),
    "the dialog's RunResumeCard speaks formatLedgerMs (one dialect, shared)"
  );
  must(
    inspSrc.includes("exact: staged") && inspSrc.includes("export function formatLedgerMs"),
    "the inspector's ledger tooltip carries the EXACT ms (t269's leftover), the dialect is exported"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (a résumé that grows) ==");

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
    name: "t270 Import",
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

  // C2 — a probeless connection; the POST response must carry NO résumé
  const connId = `qa-t270-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: connId,
      name: "QA t270 Résumé",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  const mkBody = await mk.json();
  must(mk.status === 201 && !!mkBody?.connection?.id, `the probeless connection is created (got ${mk.status})`);
  must(
    !("resume" in (mkBody?.connection ?? {})),
    "the zero-run POST response omits the resume field (no résumé is the honest state)"
  );

  const dispatchMotioncorr = async (label) => {
    const job = await mkJob({ type: "motioncorr", name: label });
    const e = await mkEdge(importJob.id, job.id, "micrographs", "movies");
    must(e === 200 || e === 201, `${label}: import → remote motioncorr wired (${e})`);
    const d = await fetch(`${BASE}/api/jobs/${job.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SH },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    must(d.status === 200 || d.status === 201, `${label}: probeless dispatch accepted (${d.status})`);
    return job;
  };
  const readResume = async () => {
    const list = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    return (list.connections ?? []).find((c) => c.id === connId)?.resume ?? null;
  };

  // C3 — run 1 completes → the résumé is born
  const job1 = await dispatchMotioncorr("t270 MotionCorr #1");
  const done1 = await pollUntil(async () => {
    const j = await readJob(job1.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(done1?.status === "completed", `run 1 completes (${done1?.status}: ${(done1?.result ?? "").slice(0, 50)})`);
  const resume1 = await pollUntil(async () => {
    const r = await readResume();
    return r && r.total >= 1 ? r : null;
  }, 10_000);
  must(
    !!resume1 &&
      resume1.total === 1 && resume1.completed === 1 && resume1.failed === 0 &&
      typeof resume1.lastRunAt === "string" &&
      resume1.recent[0]?.jobId === job1.id &&
      resume1.recent[0]?.stagedMs > 0 && resume1.recent[0]?.syncMs > 0 &&
      resume1.recent[0]?.syncedFiles >= 1,
    `run 1's résumé lands (total 1 · completed 1 · staged ${resume1?.recent?.[0]?.stagedMs ?? "?"}ms · ${resume1?.recent?.[0]?.syncedFiles ?? "?"} file(s) back)`
  );

  // C4 — run 2 completes → the résumé grows, newest first
  const job2 = await dispatchMotioncorr("t270 MotionCorr #2");
  const done2 = await pollUntil(async () => {
    const j = await readJob(job2.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(done2?.status === "completed", `run 2 completes (${done2?.status})`);
  const resume2 = await pollUntil(async () => {
    const r = await readResume();
    return r && r.total >= 2 ? r : null;
  }, 10_000);
  must(
    !!resume2 && resume2.total === 2 && resume2.completed === 2 &&
      resume2.recent[0]?.jobId === job2.id && resume2.recent[1]?.jobId === job1.id,
    "run 2's résumé grows to total 2 with the newest run FIRST (the reading line sorts)"
  );

  // C5 — run 3 is dispatched then STOPPED: the 137 record joins the failed bucket
  const job3 = await dispatchMotioncorr("t270 MotionCorr #3 (stopped)");
  const running3 = await pollUntil(async () => {
    const j = await readJob(job3.id);
    return j?.status === "running" ? j : null;
  }, 60_000, 500);
  must(!!running3, "run 3 reaches running (the stop window is open)");
  const stopRes = await fetch(`${BASE}/api/jobs/${job3.id}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...SH },
    body: "{}",
  });
  must(stopRes.status === 200 || stopRes.status === 201, `run 3 is stopped by user (${stopRes.status})`);
  const resume3 = await pollUntil(async () => {
    const r = await readResume();
    return r && r.total >= 3 && r.failed >= 1 ? r : null;
  }, 15_000);
  must(
    !!resume3 && resume3.total === 3 && resume3.completed === 2 && resume3.failed === 1 &&
      resume3.recent[0]?.jobId === job3.id && resume3.recent[0]?.exitCode === 137,
    `the stopped run joins the résumé (total 3 · completed 2 · failed 1 · recent[0] exit ${resume3?.recent?.[0]?.exitCode ?? "?"})`
  );

  // C6 — the dialog renders the résumé card
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  const card = page.locator("[data-run-resume]").first();
  must(await card.isVisible().catch(() => false), "the résumé card renders inside the cluster dialog");
  const totalTxt = ((await page.locator("[data-resume-total]").first().innerText().catch(() => "")) ?? "").trim();
  const okTxt = ((await page.locator("[data-resume-completed]").first().innerText().catch(() => "")) ?? "").trim();
  const badTxt = ((await page.locator("[data-resume-failed]").first().innerText().catch(() => "")) ?? "").trim();
  must(
    totalTxt === "3 runs" && okTxt === "2 completed" && badTxt === "1 stopped/failed",
    `the badges speak the aggregate ("${totalTxt}" · "${okTxt}" · "${badTxt}")`
  );
  const entryCount = await page.locator("[data-resume-entry]").count();
  must(entryCount === 3, `the résumé lists the ≤3 newest runs (got ${entryCount})`);
  // the NEWEST entry is the STOPPED run: its ledger honestly has only the
  // staging leg — the sync never happened, so speaking it would be a lie
  // (t268's lesson: verify the world matches the assertion's assumption)
  const firstEntry = ((await page.locator("[data-resume-entry]").first().innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    firstEntry.includes("motioncorr") && /staged /.test(firstEntry) && !/synced /.test(firstEntry),
    `the stopped entry speaks only its staged leg (no sync, no lie — "${firstEntry.slice(0, 40)}")`
  );
  // a COMPLETED entry speaks the full dialect: staged · synced · files back
  const secondEntry = ((await page.locator("[data-resume-entry]").nth(1).innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    /staged /.test(secondEntry) && /synced /.test(secondEntry) && /files? back/.test(secondEntry),
    `a completed entry speaks the full ledger ("${secondEntry.slice(0, 60)}")`
  );

  // ----定妆照 ---------------------------------------------------------------
  // the résumé card lives BELOW the probe card inside a 60vh scroll area —
  // bring it into the viewport first (a hero shot of what this task built)
  await page.locator("[data-run-resume]").first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/t270-run-resume.png` });

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt270: ALL PASS" : `\nt270: ${fail} FAIL`);
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
