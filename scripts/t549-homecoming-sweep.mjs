// t549 — the project-level homecoming sweep: the t424 batch bar's project
// face. The per-job verb ("Results → Bring home all") serves ONE job; a
// session that left files on several jobs made homecoming a tour of
// inspectors. The bar aggregates the jobs-list annotation (t431's
// remoteRemaining, computed once per poll) into ONE verb that walks every
// owing job through the same honest listing + chunked sync loop.
//
//   A  the product face — source pins: the self-effacing contract (no
//      owing, nothing running, no failures → null render), the no-flicker
//      law (a null annotation counts NOTHING), the route cap (CHUNK ≤ 8),
//      stop-aborts-in-flight (a hung chunk cannot hold the sweep), the
//      failure rows speaking the product's refusal verbatim, the family
//      styling tokens (teal bar / amber rows), the roster mount in the
//      spotlight
//   B  the live world — the REAL homecoming over the REAL wire: the
//      healed world owes nothing (the bar self-hides on the real
//      dashboard — the t549 live-fire healed the last three), then one
//      local file re-enters debt (mic_02.mrc deleted; the mock cluster
//      still holds the original), the bar wakes with the honest census,
//      "Bring home all" fetches it home over SSH, the verdict speaks, the
//      annotation flips, the bar self-hides again
//   C  the refusal dialect — route-mocked: a fabricated owing job whose
//      sync answers the connection-deleted refusal per file; the rows
//      surface verbatim under their job's name; six failures show four
//      rows plus the honest "and 2 more" (the per-job bar shows every
//      verdict — the sweep points there)
//   D  stop is not a suggestion — route-moked: the first chunk settles,
//      the second HANGS; Stop aborts the in-flight chunk immediately (the
//      AbortController law) and the stopped verdict counts what came home
//
// Run: node scripts/t549-homecoming-sweep.mjs   (server on :3000)
import { chromium } from "playwright";
import { readFileSync, existsSync, statSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const DEMO = "cmur3ti510002n5831da9zcuk";
const REAL_JOB = "cmus9d1va000pn57byaf038c0"; // t535p5 MC — connection t535p5-mus9cx6c alive
const WORKDIR = `${ROOT}/data/relion/${DEMO}/motioncorr_yaf038c0`;
const HOSTAGE = `${WORKDIR}/micrographs/mic_02.mrc`; // the file that re-enters debt in B
const CLUSTER_SIDE = `${ROOT}/services/mock-cluster/fs/projects/cryoflow/${DEMO}/motioncorr_yaf038c0/micrographs/mic_02.mrc`;

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
  "Content-Type": "application/json",
};
const api = async (method, url, body) => {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: SH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let b = null;
  try { b = await r.json(); } catch { /* non-json */ }
  return { status: r.status, body: b };
};

let browser = null;
let realSize = 0;
const consoleErrors = [];

try {
  /* ---------------------------------------------------------------- */
  console.log("== PHASE A: the product face ==");
  const comp = readFileSync(`${ROOT}/src/components/workflow/homecoming-sweep.tsx`, "utf8");
  const dashboard = readFileSync(`${ROOT}/src/components/workflow/project-dashboard.tsx`, "utf8");
  const syncRoute = readFileSync(`${ROOT}/src/app/api/jobs/[id]/outputs/sync/route.ts`, "utf8");

  must(comp.includes("if (!hasStory) return null;"),
    "A: self-effacing — no owing, nothing running, no failures → the bar does not exist (t491)");
  must(/remoteRemaining != null && .*\.remaining > 0/.test(comp),
    "A: the no-flicker law — only annotation-bearing jobs count (null counts nothing)");
  must(/const CHUNK = (\d+);/.test(comp) && Number(comp.match(/const CHUNK = (\d+);/)[1]) <= 8,
    "A: the chunk respects the sync route's 8-path cap");
  must(comp.includes("abortRef.current?.abort()"),
    "A: Stop aborts the in-flight chunk — stop is not a suggestion");
  must(comp.includes('error: "Listing failed — connection or server error"') &&
       comp.includes('error: "Sync request failed — connection or server error"'),
    "A: wire death is a leg-level verdict, not a per-file lie (the t424 law)");
  must(comp.includes('r.error ?? "Fetch failed"'),
    "A: per-file refusals surface verbatim (the sync route's error string rides the row untouched)");
  must(comp.includes("border-teal-600/30 bg-teal-600/[0.04]") && comp.includes("bg-amber-500/10"),
    "A: the family styling tokens — teal bar, amber failure rows");
  must(dashboard.includes("<HomecomingSweepBar />") && dashboard.includes('import { HomecomingSweepBar } from "./homecoming-sweep"'),
    "A: mounted in the ActiveProjectSpotlight (the dashboard is where receipts are read)");
  must(syncRoute.includes("MAX_PATHS_PER_CALL = 8"),
    "A: the t424 route's ledger gate is the source of the cap (the pin speaks the real door)");

  /* ---------------------------------------------------------------- */
  console.log("== PHASE B: the live world ==");
  // world preconditions, spoken before anything is touched
  must(existsSync(WORKDIR), "B: the real job's workdir is home");
  must(existsSync(CLUSTER_SIDE), "B: the mock cluster still holds the original (debt is recoverable)");
  realSize = statSync(CLUSTER_SIDE).size;
  must(realSize > 0, `B: the cluster-side original carries bytes (${realSize})`);

  const jobsBefore = (await api("GET", "/api/jobs")).body?.jobs ?? [];
  const realJob = jobsBefore.find((j) => j.id === REAL_JOB);
  must(!!realJob, "B: the t535p5 MC job is in the active roster");

  // settle the world FIRST: any prior window's debris (a probe that deleted
  // the file and died, a crashed run) must not tip the bench's world
  // assumptions — the bench heals the debt through the product door before
  // it asserts the self-effacing face. (The world is not a given; it is
  // an obligation.)
  if (!existsSync(HOSTAGE) && existsSync(CLUSTER_SIDE)) {
    console.log("  (settle) local mic_02.mrc missing — restoring through the product door first");
    await api("POST", `/api/jobs/${REAL_JOB}/outputs/sync`, { paths: ["micrographs/mic_02.mrc"] });
    for (let i = 0; i < 10 && !existsSync(HOSTAGE); i++) await sleep(1000);
  }
  must(existsSync(HOSTAGE), "B: the world settled — the hostage file is home before the dance");

  const remainingNow = (await api("GET", "/api/jobs")).body?.jobs?.find((j) => j.id === REAL_JOB)?.remoteRemaining?.remaining;
  must(remainingNow === 0,
    "B: the healed world owes nothing (t549 live-fire's verdict still holds)");

  // the bar self-hides on the real dashboard — absence, not a wound
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.getByRole("tab", { name: /Dashboard/ }).first().click().catch(() => {});
  await sleep(2000);
  must((await page.locator('[data-testid="homecoming-sweep"]').count()) === 0,
    "B: the bar is absent on the real world (nothing owed — the self-effacing contract, live)");

  // one file re-enters debt; the mock cluster keeps the original
  rmSync(HOSTAGE, { force: true });
  must(!existsSync(HOSTAGE), "B: mic_02.mrc deleted — the receipt's debt is real again");
  let annotated = false;
  for (let i = 0; i < 20 && !annotated; i++) {
    await sleep(1000);
    const jobs = (await api("GET", "/api/jobs")).body?.jobs ?? [];
    annotated = jobs.find((j) => j.id === REAL_JOB)?.remoteRemaining?.remaining === 1;
  }
  must(annotated, "B: the annotation re-judged — remaining 1/30 (the poll carries the truth)");

  const bar = page.locator('[data-testid="homecoming-sweep"]');
  const barVisible = await bar.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  must(barVisible, "B: the bar WAKES on the dashboard (the census rode the poll)");
  must((await bar.getByText(/1 file on the cluster across 1 job/).count()) === 1,
    "B: the census speaks the honest numbers");
  must((await page.locator('[data-testid="homecoming-sweep-run"]').count()) === 1,
    "B: the Bring home all verb is present");

  await page.locator('[data-testid="homecoming-sweep-run"]').click();
  // the verdict races its own self-hide (a clean sweep detaches the bar as
  // soon as the poll confirms the ledger at 0) — wait for the VERDICT face
  // specifically and read it immediately, before the epilogue takes over
  let verdictText = "";
  try {
    const v = page.locator('[data-testid="homecoming-sweep-verdict"]');
    await v.waitFor({ state: "visible", timeout: 12000 });
    verdictText = (await v.textContent()) ?? "";
  } catch { /* the bar hid before the verdict could be read — caught below */ }
  must(/Sweep finished — 1 file brought home across the project\./.test(verdictText),
    `B: the verdict speaks the full story (got ${JSON.stringify(verdictText)})`);

  // the world itself: the file is HOME (bytes over the real wire)
  let home = false;
  for (let i = 0; i < 10 && !home; i++) {
    await sleep(1000);
    home = existsSync(HOSTAGE) && statSync(HOSTAGE).size === realSize;
  }
  must(home, "B: mic_02.mrc is home with its exact bytes (the SSH leg, real)");
  must((await api("GET", "/api/jobs")).body?.jobs?.find((j) => j.id === REAL_JOB)?.remoteRemaining?.remaining === 0,
    "B: the ledger answers 0 again (the product's arithmetic, post-sweep)");
  const barGone = await bar
    .waitFor({ state: "detached", timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  must(barGone, "B: the bar self-hides after the clean sweep (the epilogue chips carry the story)");
  await page.screenshot({ path: `${ROOT}/shots-qa/t549-homecoming-dashboard.png` });

  /* ---------------------------------------------------------------- */
  console.log("== PHASE C: the refusal dialect ==");
  // the mock world: one fabricated owing job over the REAL roster shape
  const mockJob = { ...realJob, id: "t549-mock-sweep-job", name: "t549 Sweep Mock" };
  const REFUSAL = "The cluster connection for this run was deleted — the file stays on the cluster";
  const owe = (n) => ({ ...mockJob, remoteRemaining: { remaining: n, total: 24 } });

  const listFiles = (n) => ({
    status: "ok",
    files: Array.from({ length: n }, (_, i) => ({
      path: `micrographs/mic_${String(i + 1).padStart(3, "0")}.mrc`,
      remote: true,
    })),
  });

  await page.route(/\/api\/jobs$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jobs: [owe(6)] }) })
  );
  await page.route(/\/api\/jobs\/t549-mock-sweep-job\/outputs$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listFiles(6)) })
  );
  await page.route(/\/api\/jobs\/t549-mock-sweep-job\/outputs\/sync$/, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    const rows = (body.paths ?? []).map((p) => ({ path: p, ok: false, error: REFUSAL }));
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, results: rows }) });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.getByRole("tab", { name: /Dashboard/ }).first().click().catch(() => {});
  await sleep(1800);
  const cBar = page.locator('[data-testid="homecoming-sweep"]');
  must((await cBar.getByText(/6 files on the cluster across 1 job/).count()) === 1,
    "C: the mocked census renders (six files, one job)");
  await page.locator('[data-testid="homecoming-sweep-run"]').click();
  const cVerdict = page.locator('[data-testid="homecoming-sweep-verdict"]');
  await cVerdict.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  must(/Sweep finished — 0 files home, 6 need attention\./.test((await cVerdict.textContent()) ?? ""),
    "C: the verdict counts honestly (zero home, six need attention)");
  const cRows = page.locator('[data-testid="homecoming-sweep-failures"] li');
  must((await cRows.count()) === 5,
    `C: four rows shown plus the "and 2 more" honest summary (got ${await cRows.count()})`);
  must((await cRows.first().textContent())?.includes(REFUSAL) ?? false,
    "C: the refusal surfaces verbatim (the product's own remedy wording)");
  must((await cRows.first().textContent())?.includes("t549 Sweep Mock") ?? false,
    "C: the failure row names its job (the group-under-job contract)");
  must((await cRows.nth(4).textContent())?.includes("and 2 more") ?? false,
    "C: the overflow line says the honest count");
  await page.screenshot({ path: `${ROOT}/shots-qa/t549-homecoming-refusals.png` });

  /* ---------------------------------------------------------------- */
  console.log("== PHASE D: stop is not a suggestion ==");
  // re-route the sync: the first chunk settles, the second HANGS
  await page.unroute(/\/api\/jobs\/t549-mock-sweep-job\/outputs\/sync$/);
  await page.route(/\/api\/jobs\/t549-mock-sweep-job\/outputs$/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listFiles(6)) })
  );
  await page.route(/\/api\/jobs\/t549-mock-sweep-job\/outputs\/sync$/, async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if ((body.paths ?? []).length > 2) {
      // chunk 1 (4 paths) — settles after a beat
      await sleep(250);
      const rows = (body.paths ?? []).map((p) => ({ path: p, ok: true, bytes: 1 }));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, results: rows }) });
      return;
    }
    // chunk 2 (2 paths) — the wire hangs forever
    await new Promise(() => {});
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.getByRole("tab", { name: /Dashboard/ }).first().click().catch(() => {});
  await sleep(1800);
  await page.locator('[data-testid="homecoming-sweep-run"]').click();
  const dProgress = page.locator('[data-testid="homecoming-sweep-progress"]');
  await dProgress.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  const settled4 = await page
    .locator('[data-testid="homecoming-sweep-progress"]')
    .getByText(/4\/6 file\(s\) settled/)
    .waitFor({ state: "visible", timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  must(settled4, "D: the first chunk settled (4/6) and the second hangs");
  await page.locator('[data-testid="homecoming-sweep-stop"]').click();
  const dVerdict = page.locator('[data-testid="homecoming-sweep-verdict"]');
  const dStopped = await dVerdict
    .waitFor({ state: "visible", timeout: 8000 })
    .then(async () => (/Stopped — 4 files brought home before the stop\./.test((await dVerdict.textContent()) ?? "")))
    .catch(() => false);
  must(dStopped, "D: Stop aborted the hung chunk NOW — the stopped verdict counts what came home");
  must((await page.locator('[data-testid="homecoming-sweep-stop"]').count()) === 0,
    "D: the Stop verb retires with the run");
  await page.screenshot({ path: `${ROOT}/shots-qa/t549-homecoming-stop.png` });

  /* ---------------------------------------------------------------- */
  // the console gate: route-aborted fetches from D's own stop are the
  // EXPECTED abort shape, not a wound; anything else is real.
  const unexpected = consoleErrors.filter((e) => !/ERR_ABORTED/.test(e));
  must(unexpected.length === 0,
    `console carries only the expected stop-abort noise (${unexpected.length} unexpected of ${consoleErrors.length})`);
  if (unexpected.length > 0) console.log("  [console]", unexpected.slice(0, 4));
} catch (e) {
  fail++;
  console.log(`  FAIL: unexpected: ${e?.message ?? e}`);
} finally {
  // world restoration: the hostage file must be home whatever happened
  try {
    if (!existsSync(HOSTAGE) && realSize > 0) {
      await api("POST", `/api/jobs/${REAL_JOB}/outputs/sync`, { paths: ["micrographs/mic_02.mrc"] });
      await sleep(1500);
    }
  } catch { /* best effort — the cluster side still holds it */ }
  try { await browser?.close(); } catch { /* gone */ }
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
