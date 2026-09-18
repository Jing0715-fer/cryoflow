/**
 * t294 — the résumé's forget door: dead history becomes disposable.
 *
 * The story: since t272 the résumé's history rows honestly speak THREE
 * states (jumpable / another canvas / gone), and t277 (t272's C8) gave the
 * gone state its live witness via a hand-injected record. But a gone row
 * was a PERMANENT resident: the record sat in the GLOBAL engine-state.json
 * forever with no door out (the t272 cascade only sweeps records when a
 * PROJECT dies; a record outliving its job by any other route — manual db
 * cleanup, an older snapshot restored — just stayed). History the user
 * cannot act on is a ledger that only grows.
 *
 * t294 opens the door, deliberately narrow:
 *   - DELETE /api/remote/records/[jobId] forgets ONE dead record — with
 *     three honest refusals: 404 (no record), 409 (not a REMOTE run
 *     record — this is the résumé's door, not the job lifecycle's),
 *     409 (the job STILL EXISTS on some canvas — live history that canvas
 *     can open; delete the job instead and the t272 sweep follows).
 *   - the gone row grows a quiet, hover-revealed X (the same idiom as the
 *     live row's jump arrow) — ONLY on exists===false rows; an alive row
 *     never shows the door even though the API would refuse anyway.
 *   - a refusal lands in a role=alert line under the rows; a success
 *     reloads the list — the server re-aggregates (one truth, no local
 *     surgery on a cached card).
 *
 * Phases:
 *   A  demo truth (roster 21)
 *   B  the ledger (source assertions: the route's three refusals, the
 *      order law (alive-check BEFORE clearRunRecord), the UI chain:
 *      dialog handler → ConnectionEditor → RunResumeCard, the door only
 *      on gone rows, the data hooks, the reload-after-success)
 *   C  the live loop:
 *      C1  a probeless connection is born (no SSH is ever attempted)
 *      C2  the refusals, alive: bogus id → 404; a LOCAL record → 409;
 *          a REMOTE record whose job is a LIVE demo job → 409
 *      C3  the gone record is injected (the t277 recipe) → the server
 *          grades it exists=false, no canvas named
 *      C4  the dialog renders the gone row WITH the forget door (X hook);
 *          a live job's row (also injected, separate fake connection)
 *          renders as a JUMP row with NO door — the door's honesty
 *      C5  click forget → the row leaves, the résumé stands down
 *          (total 0 → field omitted), the record is gone from the state
 *          file; the shot: the door revealed on hover
 *   D  console clean
 *   finally  state file restored to the pre-suite truth, connection
 *            removed, roster back to 21
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
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

async function pollUntil(fn, deadlineMs, intervalMs = 1000) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};
const writeStateRuns = (runs) => {
  const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const next = raw.runs ? { ...raw, runs } : runs;
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
};

const GONE_JOB = `t294gone${Date.now().toString(36)}`;
const FORGET_CONN = `qa-t294-${Date.now().toString(36)}`;
const REFUSAL_CONN = `qa-t294-refusal-${Date.now().toString(36)}`;
const connIds = [];
let snap0 = null; // the pre-suite state file truth (finally restores it)

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

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

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");
  const route = src("src/app/api/remote/records/[jobId]/route.ts");

  must(
    route.includes('import { isLocalRequest } from "@/lib/http-guard";'),
    "the forget route keeps the registry's cross-site guard (isLocalRequest)"
  );
  must(
    route.includes("No run record for this job"),
    "refusal 1: 404 when there is nothing to forget"
  );
  must(
    route.includes("Not a remote run record"),
    "refusal 2: 409 for a LOCAL run record (the résumé's door, not the lifecycle's)"
  );
  must(
    route.includes("The job still exists on a canvas"),
    "refusal 3: 409 while the job still lives (live history that canvas can open)"
  );
  must(
    route.includes('import { clearRunRecord, getRun } from "@/lib/relion/engine";') &&
      route.includes("clearRunRecord(jobId);"),
    "the forget goes through the SAME ceremony the cascade uses (clearRunRecord)"
  );
  const aliveIdx = route.indexOf("if (alive) {");
  const forgetIdx = route.indexOf("clearRunRecord(jobId);");
  must(
    aliveIdx !== -1 && forgetIdx !== -1 && aliveIdx < forgetIdx,
    "ORDER LAW: the alive check refuses BEFORE the record dies"
  );

  const dlg = src("src/components/workflow/remote-cluster-dialog.tsx");
  must(
    dlg.includes("const forgettable = e.exists === false && onForgetRun != null;"),
    "the door lives ONLY on exists===false rows (the UI knows which rows are dead)"
  );
  must(
    dlg.includes("data-resume-forget={e.jobId}"),
    "the forget button carries its data hook (the test seam)"
  );
  must(
    dlg.includes('data-resume-forget-error=""'),
    "a refusal lands in a role=alert line under the rows"
  );
  must(
    dlg.includes("disabled={forgetting != null}"),
    "the door is disabled while a forget is in flight (no double delete)"
  );
  must(
    dlg.includes("`/api/remote/records/${encodeURIComponent(jobId)}`"),
    "the dialog's handler speaks to the forget route"
  );
  const forgetBlock = dlg.slice(dlg.indexOf("const handleForgetRun"), dlg.indexOf("const handleForgetRun") + 700);
  must(
    forgetBlock.includes("reload();"),
    "success reloads the list — the server re-aggregates (one truth, no local surgery)"
  );
  must(
    dlg.includes("onForgetRun={handleForgetRun}") &&
      dlg.split("onForgetRun={handleForgetRun}").length === 3,
    "both ConnectionEditor mounts (create + saved) carry the door's caller"
  );
  must(
    dlg.includes("<RunResumeCard resume={connection.resume} onOpenJob={onOpenJob} onForgetRun={onForgetRun} />"),
    "the editor threads the door down to the résumé card"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (refusals → injected gone row → forget) ==");

  snap0 = readFileSync(STATE_FILE, "utf8"); // pre-suite truth

  // C1 — the probeless connection (POST saves; nothing probed, no SSH ever)
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: FORGET_CONN,
      name: "QA t294 Forget",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);
  connIds.push(FORGET_CONN);

  // C2 — the refusals, alive. Every injected record here wears a FAKE
  //      connection id, so none of them ever surfaces in any résumé.
  const delBogus = await fetch(`${BASE}/api/remote/records/${GONE_JOB}`, {
    method: "DELETE",
    headers: SH,
  });
  must(delBogus.status === 404, `a bogus jobId is refused 404 (got ${delBogus.status})`);

  const localRec = {
    jobId: GONE_JOB,
    projectId: "t294-refusal",
    type: "motioncorr",
    pid: 4242,
    cmd: "t294: a LOCAL record — the résumé's door must refuse it",
    workdir: "/home/z/my-project/data/relion/t294-refusal",
    logFile: "/home/z/my-project/data/relion/t294-refusal/run.out",
    errFile: "/home/z/my-project/data/relion/t294-refusal/run.err",
    startedAt: new Date().toISOString(),
    done: true,
    exitCode: 0,
  };
  writeStateRuns({ ...stateRuns(), [GONE_JOB]: localRec });
  const delLocal = await fetch(`${BASE}/api/remote/records/${GONE_JOB}`, {
    method: "DELETE",
    headers: SH,
  });
  must(delLocal.status === 409, `a LOCAL record is refused 409 (got ${delLocal.status})`);
  must(
    ((await delLocal.json().catch(() => ({})))?.error ?? "").includes("Not a remote run record"),
    "the LOCAL refusal says WHY (not a remote run record)"
  );

  const liveJob = (jobs0.jobs ?? [])[0];
  must(!!liveJob?.id, `a live demo job picked for the alive refusal (${liveJob?.id ?? "?"})`);
  const aliveRec = {
    ...localRec,
    jobId: liveJob.id,
    cmd: "t294: a REMOTE record whose job is ALIVE — the door must refuse",
    remote: { connectionId: REFUSAL_CONN, module: "relion/5.0.1", mode: "direct" },
  };
  writeStateRuns({ ...stateRuns(), [liveJob.id]: aliveRec });
  const delAlive = await fetch(`${BASE}/api/remote/records/${liveJob.id}`, {
    method: "DELETE",
    headers: SH,
  });
  must(delAlive.status === 409, `a LIVE job's record is refused 409 (got ${delAlive.status})`);
  must(
    ((await delAlive.json().catch(() => ({})))?.error ?? "").includes("The job still exists"),
    "the ALIVE refusal says WHY (the job still exists on a canvas)"
  );
  must(!!stateRuns()[liveJob.id], "the alive job's record SURVIVED the refusal (nothing was deleted)");
  // the refusal phase's injections leave with the witness
  const restored = { ...stateRuns() };
  delete restored[GONE_JOB];
  delete restored[liveJob.id];
  writeStateRuns(restored);
  must(!stateRuns()[GONE_JOB] && !stateRuns()[liveJob.id], "the refusal phase's injections are swept");

  // C3 — the gone record, injected (the t277 recipe): a REMOTE record whose
  //      job exists NOWHERE, pointing at MY connection so the résumé sees it
  const goneRec = {
    jobId: GONE_JOB,
    projectId: "t294-gone",
    type: "motioncorr",
    pid: null,
    cmd: "t294: the job is gone, the record remains — until the user lets it go",
    workdir: `/home/z/my-project/data/relion/gone/${GONE_JOB}`,
    logFile: `/home/z/my-project/data/relion/gone/${GONE_JOB}/run.out`,
    errFile: `/home/z/my-project/data/relion/gone/${GONE_JOB}/run.err`,
    startedAt: new Date().toISOString(),
    done: true,
    exitCode: 0,
    remote: {
      connectionId: FORGET_CONN,
      module: "relion/5.0.1",
      mode: "direct",
      stagedMs: 1200,
      syncMs: 3400,
      syncedFiles: 3,
      syncedBytes: 4096,
    },
  };
  writeStateRuns({ ...stateRuns(), [GONE_JOB]: goneRec });
  must(!!stateRuns()[GONE_JOB], "the gone-job record is injected into the GLOBAL state file");

  const readConns = async () => {
    const d = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    return d.connections ?? d ?? [];
  };
  const goneResume = await pollUntil(async () => {
    const list = await readConns();
    return (Array.isArray(list) ? list : []).find((c) => c.id === FORGET_CONN)?.resume ?? null;
  }, 10_000);
  must(!!goneResume && goneResume.total === 1, `the résumé counts the injected record (total ${goneResume?.total ?? 0})`);
  const goneEntry = goneResume?.recent?.[0];
  must(
    goneEntry?.jobId === GONE_JOB && goneEntry?.exists === false,
    `the server grades the dead entry exists=false (exists ${goneEntry?.exists})`
  );
  must(goneEntry?.projectName === undefined, "no canvas is named for a job that exists nowhere");

  // C4 — the dialog: the gone row WITH the door; a live row WITHOUT one
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  await page.locator(`button[aria-label^="QA t294 Forget"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  const card = page.locator("[data-run-resume]").first();
  must(await card.isVisible().catch(() => false), "the résumé card renders for the forget connection");

  const goneRow = page.locator(`[data-resume-entry="${GONE_JOB}"]`).first();
  must(await goneRow.isVisible().catch(() => false), "the gone entry renders (history, not a void)");
  must(
    (await goneRow.getAttribute("data-resume-gone").catch(() => null)) === "gone",
    "the row speaks the gone state (data-resume-gone=gone)"
  );
  const forgetBtn = page.locator(`[data-resume-forget="${GONE_JOB}"]`).first();
  must(
    (await forgetBtn.count()) === 1,
    "the gone row carries the forget door (exactly one)"
  );
  const forgetAria = (await forgetBtn.getAttribute("aria-label").catch(() => "")) ?? "";
  must(
    forgetAria.startsWith("Forget the history entry for the motioncorr run"),
    `the door is named for humans ("${forgetAria.slice(0, 60)}…")`
  );

  // the door's honesty: a LIVE job's row renders as a jump button with NO door.
  // The contrast record wears THIS connection's id — it must surface in the
  // SAME résumé card as the gone row (first run's lesson: a REFUSAL_CONN
  // record never shows up in FORGET_CONN's résumé — the aggregate filters
  // by connection, and so must the contrast).
  const liveRec2 = {
    ...aliveRec,
    remote: { connectionId: FORGET_CONN, module: "relion/5.0.1", mode: "direct" },
  };
  writeStateRuns({ ...stateRuns(), [liveJob.id]: liveRec2 });
  const liveResume = await pollUntil(async () => {
    const list = await readConns();
    return (Array.isArray(list) ? list : []).find((c) => c.id === FORGET_CONN)?.resume ?? null;
  }, 10_000);
  must(
    !!liveResume && liveResume.recent.some((e) => e.jobId === liveJob.id && e.exists === true),
    "the live job's entry (same connection, for the contrast) grades exists=true"
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  await page.locator(`button[aria-label^="QA t294 Forget"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  const liveJump = page.locator(`[data-resume-jump][data-resume-entry="${liveJob.id}"]`).first();
  must(
    (await liveJump.count()) === 1,
    "the live row is a JUMP button (the inspector can open it)"
  );
  must(
    (await page.locator(`[data-resume-forget="${liveJob.id}"]`).count()) === 0,
    "the live row carries NO forget door (a door only where it can open)"
  );
  // sweep the contrast injection before the forget act
  const restored2 = { ...stateRuns() };
  delete restored2[liveJob.id];
  writeStateRuns(restored2);

  // the pose: hover reveals the X (the live row's arrow idiom)
  await page.locator(`[data-resume-entry="${GONE_JOB}"]`).first().hover().catch(() => {});
  await sleep(300);
  await page
    .locator(`[data-resume-entry="${GONE_JOB}"]`)
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/t294-resume-forget-row.png` });

  // C5 — click forget: the row leaves, the résumé stands down, the record dies
  await page.locator(`[data-resume-forget="${GONE_JOB}"]`).first().click({ force: true }).catch(() => {});
  const cardGone = await pollUntil(
    async () => (await page.locator("[data-run-resume]").count()) === 0,
    10_000
  );
  must(!!cardGone, "after the forget, the résumé card STANDS DOWN (total 0 → field omitted)");
  const apiAfter = await pollUntil(async () => {
    const list = await readConns();
    const c = (Array.isArray(list) ? list : []).find((x) => x.id === FORGET_CONN);
    return c && c.resume == null ? c : null;
  }, 8_000);
  must(!!apiAfter, "the API confirms: the résumé field is omitted (t270's zero-run contract)");
  must(
    !stateRuns()[GONE_JOB],
    "the record is GONE from the global state file (the user let it go)"
  );

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(
    consoleErrors.length === 0,
    `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`
  );

  console.log(fail === 0 ? "\nt294: ALL PASS" : `\nt294: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  for (const cid of [...connIds].reverse()) {
    try {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
  // the suite manufactures its own scenario; it digs its own grave shut
  if (snap0) {
    try {
      writeFileSync(STATE_FILE, snap0);
      console.log("  (cleanup) state file restored to the pre-suite truth");
    } catch { /* best effort */ }
  }
  try { rmSync("/home/z/my-project/data/relion/t294-refusal", { recursive: true, force: true }); } catch { /* gone */ }
  try { rmSync(`/home/z/my-project/data/relion/gone/${GONE_JOB}`, { recursive: true, force: true }); } catch { /* gone */ }
  await sleep(1500);
  try {
    const after = await (await fetch(`${BASE}/api/jobs`)).json();
    const n = (after.jobs ?? []).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch (e) {
    must(false, `roster check failed (${e.message})`);
  }
  await browser.close().catch(() => {});
}
