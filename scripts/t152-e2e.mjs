// t152 — Task 152: a duplicate click doesn't steal the slot; being alive is
// not an accident.
//
// Both HTTP 409 busy cases used to wear ONE destructive face: api() threw on
// the non-2xx and runJob's catch toasted "Something went wrong" — so a rapid
// double-click on Retry stole the first click's "Job started" slot under
// TOAST_LIMIT=1 (the user's last impression was RED while the job WAS
// running), and a genuinely live process was painted as an accident. Task 152
// splits the faces: the route 409 body now carries busyKind — "inflight"
// (duplicate click: the client stays SILENT, the first start's own toast
// keeps the slot) vs "live" (a live process: a neutral "Already running"
// heads-up, pid named). Real refusals (linked-copy 400, honest engine
// failures) keep their alarm.
//
// Phase S — purge + roster snapshot + keeper runner (1.2s poll cadence).
// Phase X — source oracle: StartOutcome.busyKind, both return sites, the
//           route spread, and the client's three faces (silent / neutral /
//           alarm).
// Phase B — server contract: two POSTs dispatched in the SAME tick (raw
//           fetch pair from the page) → exactly one 200 + one 409 whose body
//           carries busyKind "inflight" and the exact in-flight message.
// Phase C — the live branch through the REAL Retry bridge: forge a runs-
//           state record {done:false, pid:<live sleep>} for the job, stamp a
//           failure, click Retry → the notice is the neutral "Already
//           running" (non-destructive, pid named), the job stays failed,
//           nothing started.
// Phase D — the inflight branch through the REAL Retry bridge: same-tick
//           DOUBLE click on Retry → the /run listener must see the 409, no
//           destructive toast may EVER appear during the watch window, the
//           "Job started" toast survives at the end, and the job leaves
//           failed.
// Phase E — the honest failure stays an alarm: an import with an
//           inaccessible source honest-fails on Retry → the destructive
//           "Real engine refused to start" face is unchanged.
// Phase G — screenshot the neutral "Already running" notice.
// Phase Z — console radius (seeded /log 404s by PATH prefix + generic-echo
//           accounting), purge, roster restored.
//
// Run: node scripts/t152-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t152-shot";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const runResponses = [];
const seededIds = [];
let liveProc = null;

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const purgeT152 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T152"}}}).then(r=>{console.log("purged",r.count);return p.$disconnect()})'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (liveProc) { liveProc.kill("KILL"); liveProc = null; } } catch {}
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

const must = (cond, label) => {
  if (!cond) {
    console.log(`FAIL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const TOAST = 'ol > li[data-state="open"]';

const waitForToast = async (frag, tries = 48) => {
  for (let i = 0; i < tries; i++) {
    const loc = p.locator(TOAST, { hasText: frag });
    if ((await loc.count()) > 0) return loc.first();
    await sleep(250);
  }
  return null;
};

const makeJob = async (name, type, y) => {
  const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
  const j = created?.job ?? created;
  must(!!j?.id, `${name}: created (${type})`);
  seededIds.push(j.id);
  return j;
};

const letClientSee = () => sleep(1600);

/** Stamp a job into a fresh failure (running → seen → failed) so the poll
 *  observes the transition and the announcement layer raises the toast. */
const seedFailure = async (job, result) => {
  stampEx(job.id, { status: "running", progress: 40, startedAt: new Date().toISOString() });
  await letClientSee();
  stampEx(job.id, { status: "failed", progress: 0, result });
  const t = await waitForToast(`${job.name} failed`);
  must(!!t, `${job.name}: failure notice appeared`);
  return t;
};

async function main() {
  /* ---------------- Phase S — clean world + keeper ---------------------- */
  step("--- Phase S: purge + snapshot + keeper ---");
  purgeT152();
  const rosterBefore = (await roster()).length;
  const keeper = await makeJob("T152 Keeper", "motioncorr", 60);
  stampEx(keeper.id, { status: "running", progress: 20, startedAt: new Date(Date.now() - 15_000).toISOString() });

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
    const u = r.url();
    if (u.includes("/api/jobs/") && u.endsWith("/run") && r.request().method() === "POST") {
      runResponses.push({ status: r.status(), t: Date.now() });
    }
  });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase X — source oracle ------------------------------- */
  step("--- Phase X: source oracle — three faces for three truths ---");
  const dispatchSrc = execSync("cat src/lib/relion/dispatch.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/busyKind\?: "inflight" \| "live";/.test(dispatchSrc),
    "oracle: StartOutcome carries the busyKind marker");
  must(/busy: "a start for this job is already in flight", busyKind: "inflight"/.test(dispatchSrc),
    "oracle: the duplicate-click case is named \"inflight\"");
  must(/return \{ job, busy, busyKind: "live" \};/.test(dispatchSrc),
    "oracle: the live-process case is named \"live\"");
  const routeSrc = execSync("cat 'src/app/api/jobs/[id]/run/route.ts'", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/\.\.\.\(busyKind \? \{ busyKind \} : \{\}\)/.test(routeSrc),
    "oracle: the 409 body carries busyKind through to the client");
  const storeSrc = execSync("cat src/lib/store.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/res\.status === 409 && data\.busyKind === "inflight"/.test(storeSrc),
    "oracle: the client has a dedicated inflight branch");
  must(/title: "Already running",/.test(storeSrc),
    "oracle: the live branch gets a neutral \"Already running\" notice");
  must(/throw new Error\(data\?\.error \?\? `Request failed \(\$\{res\.status\}\)`\)/.test(storeSrc),
    "oracle: real refusals still throw (the alarm stays armed)");
  must(/title: "Real engine refused to start",/.test(storeSrc),
    "oracle: the honest-failure destructive face is unchanged");

  /* ---------------- the lineage chain — the window widener ---------------- */
  // lineageFor queries layer by layer (2 DB round-trips per layer), so a
  // 120-layer upstream chain widens startJob's in-flight window to ~100ms+ —
  // wide enough for a SECOND post over a DIFFERENT connection to land inside
  // it. Real path timing, no mocks. Both B (contract) and D (Fl) hang off it.
  step("--- lineage chain: 120 layers of real BFS weight ---");
  const chainJobs = [];
  for (let i = 1; i <= 120; i++) {
    const created = await (await api("/api/jobs", "POST", {
      type: "import", name: `T152 Chain ${String(i).padStart(3, "0")}`, x: -2600, y: -2600 + i * 7,
    })).json();
    chainJobs.push(created?.job ?? created);
    seededIds.push(chainJobs[i - 1].id);
  }
  for (let i = 0; i < 119; i++) {
    await api("/api/edges", "POST", { fromJobId: chainJobs[i].id, toJobId: chainJobs[i + 1].id });
  }
  must(chainJobs.length === 120 && chainJobs.every((c) => !!c?.id),
    "120-layer chain built (parked off-canvas — lineage weight, not scenery)");

  /* ---------------- Phase B — the server contract -------------------------- */
  step("--- Phase B: concurrent double POST → one spawn, one named refusal ---");
  const contract = await makeJob("T152 Contract", "import", 300);
  await api("/api/edges", "POST", { fromJobId: chainJobs[119].id, toJobId: contract.id });
  let pair = null;
  let contractHit = false;
  for (let attempt = 1; attempt <= 3 && !contractHit; attempt++) {
    // two concurrent POSTs from the probe's own side — undici races them
    // over separate connections, both landing inside the widened window
    const post = () => api(`/api/jobs/${contract.id}/run`, "POST").then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const [x, y] = await Promise.all([post(), post()]);
    pair = [x, y];
    const statuses = pair.map((r) => r.status).sort((a, z) => a - z);
    if (statuses[0] === 200 && statuses[1] === 409) contractHit = true;
    else {
      // window missed (the first start fully completed before the second
      // arrived) — reset to idle and race again
      await api(`/api/jobs/${contract.id}`, "PATCH", { status: "idle" });
      await sleep(700);
    }
  }
  must(contractHit, "the concurrent pair produced exactly {200, 409}");
  const refused = pair.find((r) => r.status === 409);
  must(refused?.body?.busyKind === "inflight",
    `the 409 body names its case (busyKind: ${refused?.body?.busyKind})`);
  must(refused?.body?.error === "a start for this job is already in flight",
    "the 409 message is the in-flight truth, not an engine failure");
  await api(`/api/jobs/${contract.id}`, "PATCH", { status: "idle" });
  await sleep(400);

  /* ---------------- Phase C — the live branch, through the real bridge ----- */
  step("--- Phase C: forge a live process → Retry → neutral heads-up ---");
  const liveJob = await makeJob("T152 Live", "motioncorr", 540);
  await seedFailure(liveJob, "the camera hiccuped (forged-live fixture)");
  // Forge a runs-state record with a LIVE pid — the same layer isRunAlive
  // reads. A `sleep` process guarantees /proc/<pid> exists.
  const stateBefore = readFileSync(STATE_FILE, "utf8");
  liveProc = spawn("sleep", ["180"], { stdio: "ignore" });
  const state = JSON.parse(stateBefore);
  state[liveJob.id] = {
    jobId: liveJob.id,
    projectId: liveJob.projectId ?? "",
    type: liveJob.type,
    pid: liveProc.pid,
    cmd: "t152-forged-live (sleep)",
    workdir: "/tmp/t152-forged",
    logFile: "/tmp/t152-forged/run.out",
    errFile: "/tmp/t152-forged/run.err",
    startedAt: new Date().toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
    result: null,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
  const liveToast = await waitForToast("T152 Live failed");
  must(!!liveToast, "the failure toast is still on screen for the Retry click");
  await liveToast.getByRole("button", { name: "Retry" }).click();
  const aliveToast = await waitForToast("Already running");
  must(!!aliveToast, "the live refusal speaks: \"Already running\"");
  const aCls = (await aliveToast.getAttribute("class")) ?? "";
  must(!/destructive/.test(aCls), "the live refusal is NOT destructive (healthy ≠ accident)");
  const aText = ((await aliveToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  must(/pid \d+/.test(aText), `the pid is named in the notice ("${aText.slice(0, 90)}")`);
  const liveStatus = (await roster()).find((j) => j.id === liveJob.id)?.status;
  must(liveStatus === "failed", `nothing started — the job stays failed (status: ${liveStatus})`);
  must((await p.locator(TOAST, { hasText: "Job started" }).count()) === 0,
    "no \"Job started\" lie was told");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t152-already-running.png` });
  // restore the engine state so the forge outlives nothing
  writeFileSync(STATE_FILE, stateBefore);
  await sleep(300);

  /* ---------------- Phase D — the inflight branch: silence is the courtesy - */
  step("--- Phase D: the duplicate start meets a named 409 and stays silent ---");
  const fl = await makeJob("T152 Fl", "import", 780);
  await api("/api/edges", "POST", { fromJobId: chainJobs[119].id, toJobId: fl.id });

  let dHit = false;
  for (let attempt = 1; attempt <= 3 && !dHit; attempt++) {
    await p.keyboard.press("Escape").catch(() => {}); // a prior success may have opened the inspector
    await sleep(400);
    await api(`/api/jobs/${fl.id}`, "PATCH", { status: "idle" });
    await sleep(400);
    await seedFailure(fl, "duplicate-click fixture failure");
    const failToast = await waitForToast("T152 Fl failed");
    const retryBtn = failToast.getByRole("button", { name: "Retry" });
    runResponses.length = 0;
    // the racer: a raw POST from the probe's OWN connection (not the page's)
    // — two different TCP connections genuinely race the starting window
    const racerT0 = Date.now();
    const racer = api(`/api/jobs/${fl.id}/run`, "POST").then((r) => r.status).catch(() => 0);
    await retryBtn.click(); // runJob's POST arrives over the page connection
    const racerStatus = await racer;
    const racerRtt = Date.now() - racerT0; // ≈ the in-flight window width
    await sleep(1200);
    const browserStatuses = runResponses.map((r) => r.status);
    if (browserStatuses.includes(409)) {
      dHit = true;
      must(racerStatus === 200, `the racer won the window and started the job (status ${racerStatus})`);
      let theftSeen = false;
      for (let i = 0; i < 15; i++) {
        if ((await p.locator(TOAST, { hasText: "Something went wrong" }).count()) > 0) theftSeen = true;
        if ((await p.locator(TOAST, { hasText: "Job started" }).count()) > 0) theftSeen = true;
        await sleep(100);
      }
      must(!theftSeen, `the duplicate's client went SILENT — no theft, no alarm, no "Job started" (window ≈ ${racerRtt}ms)`);
      const flStatus = (await roster()).find((j) => j.id === fl.id)?.status;
      must(flStatus === "running" || flStatus === "completed",
        `the racer's start left failed behind (status: ${flStatus})`);
    } else {
      console.log(`  … attempt ${attempt} missed the window (browser saw: ${browserStatuses.join(",") || "none"}; racer RTT ≈ ${racerRtt}ms)`);
    }
  }
  must(dHit, "the UI click met the named 409 and stayed silent (within 3 attempts)");

  /* ---------------- Phase D2 — the real double-click feel ------------------ */
  step("--- Phase D2: a genuine double-click — whatever the race does, no alarm ---");
  await p.keyboard.press("Escape").catch(() => {});
  await sleep(400);
  await api(`/api/jobs/${fl.id}`, "PATCH", { status: "idle" });
  await sleep(400);
  await seedFailure(fl, "double-click feel fixture");
  const feelToast = await waitForToast("T152 Fl failed");
  const feelBtn = feelToast.getByRole("button", { name: "Retry" });
  await feelBtn.evaluate((el) => { el.click(); el.click(); });
  await sleep(1500);
  let theft2 = false;
  for (let i = 0; i < 12; i++) {
    if ((await p.locator(TOAST, { hasText: "Something went wrong" }).count()) > 0) theft2 = true;
    await sleep(100);
  }
  must(!theft2, "no destructive \"Something went wrong\" ever appeared");
  must((await p.locator(TOAST, { hasText: "Job started" }).count()) > 0,
    "a \"Job started\" toast survives at the slot (the first click's, or a legal restart's)");
  const fl2Status = (await roster()).find((j) => j.id === fl.id)?.status;
  must(fl2Status === "running" || fl2Status === "completed",
    `the job left failed (status: ${fl2Status})`);
  const flDialog = p.locator('[role="dialog"]', { hasText: "T152 Fl" });
  await flDialog.waitFor({ timeout: 8000 });
  must(true, "inspector opened on the job (runJob's CryoSPARC-style step)");
  await p.keyboard.press("Escape");
  await sleep(500);

  /* ---------------- Phase E — the honest failure stays an alarm ------------ */
  step("--- Phase E: an honest engine failure keeps its destructive face ---");
  const bad = await makeJob("T152 Bad", "import", 1020);
  await api(`/api/jobs/${bad.id}`, "PATCH", { params: { micrographsPath: "/nonexistent/t152/*.mrc" } });
  await seedFailure(bad, "seeded failure so the Retry bridge appears");
  const badToast = await waitForToast("T152 Bad failed");
  await badToast.getByRole("button", { name: "Retry" }).click();
  const refusedToast = await waitForToast("Real engine refused to start");
  must(!!refusedToast, "the honest failure still says \"Real engine refused to start\"");
  const rCls = (await refusedToast.getAttribute("class")) ?? "";
  must(/destructive/.test(rCls), "the honest failure IS destructive (the alarm stays where it belongs)");
  const badStatus = (await roster()).find((j) => j.id === bad.id)?.status;
  must(badStatus === "failed", `the bad-source job honest-failed again (status: ${badStatus})`);

  /* ---------------- Phase G — screenshot recorded in C --------------------- */
  step("--- Phase G: screenshot ---");
  must(execSync(`test -f ${OUT}/t152-already-running.png && echo yes`).toString().trim() === "yes",
    "the \"Already running\" screenshot is on disk");

  /* ---------------- Phase Z — console + cleanup ---------------------------- */
  step("--- Phase Z: console + cleanup ---");
  const seedIds = [...seededIds];
  // tol = the TOLERABLE predicate (deliberately provoked 409s ARE the
  // round's subject; a seeded job that never ran may 404 its log pull).
  // NOTE: t151's `tol` was actually the INTOLERABLE predicate — the name
  // misled and an un-negated filter here kept exactly the tolerated lines.
  const tol = (line) => {
    const url = line.split(" ").slice(1).join(" ");
    if (line.startsWith("409") && seedIds.some((id) => url.startsWith(`${BASE}/api/jobs/${id}/run`))) return true;
    if (line.startsWith("404") && seedIds.some((id) => url.startsWith(`${BASE}/api/jobs/${id}/log`))) return true;
    return false;
  };
  const intolerable = badResponses.filter((line) => !tol(line));
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")}; seedIds=${seedIds.length}; membership=${intolerable.slice(0, 3).map((l) => seedIds.some((id) => l.split(" ").slice(1).join(" ").startsWith(`${BASE}/api/jobs/${id}/`)))})` : "no intolerable 4xx/5xx (seeded /log 404 tolerance held its radius)");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const isGenericRadiusEcho = (t) => /Failed to load resource.*(404|409)/.test(t);
  const genN = consoleErrors.filter(isGenericRadiusEcho).length;
  const radiusN = badResponses.filter((l) => l.startsWith("404") || l.startsWith("409")).length;
  must(genN <= radiusN,
    `generic non-2xx echoes accountable to the seeded radius (${genN} <= ${radiusN})`);
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t) && !isGenericRadiusEcho(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");

  await p.close(); p = null;
  await b.close(); b = null;
  purgeT152();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT152 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
