/**
 * t295 — the résumé's panorama and the bulk forget: history you can SEE
 * is history you can manage.
 *
 * The story: t270 gave the connection card a résumé, but the list route
 * renders it at the ≤3 aperture — a cluster with 17 runs says "17 runs"
 * and shows three rows; everything past the fold is invisible and
 * unmanageable. t294 gave dead rows a per-row forget door, but retiring
 * ten tombstones means ten hovers and ten clicks.
 *
 * t295 opens two doors for the card's own depth:
 *   - GET /api/remote/records?connectionId=… — the PANORAMA: the SAME
 *     aggregate (connectionRunResume) at the wide aperture ({ all: true }),
 *     same shape, entries pre-graded with the t272 existence truth. The
 *     card's expand toggle swaps it in wholesale; any reload re-fetches —
 *     the panorama tracks the ledger, never a snapshot.
 *   - DELETE /api/remote/records?connectionId=… — the BULK forget
 *     ("一键清墓"): retires every DEAD record of one connection. The law
 *     is t294's at collection scale and NARROWER, not wider: live records
 *     (job still exists on some canvas) are KEPT and counted (kept); the
 *     existence check runs for the whole batch BEFORE the first
 *     clearRunRecord (t294's order law, bulk edition). The UI door is
 *     armed two-step ("Forget n gone" → "Sure? Forget n") and renders
 *     ONLY over the full picture — a count computed from a three-row fold
 *     would understate the blast radius, and a door that cannot state its
 *     blast radius is never drawn.
 *
 * Also in this window's diff (asserted in the ledger): launch.sh execs
 * the mock entrypoint by ABSOLUTE path so the suites' pattern cleanup
 * (`pkill -f 'mock-cluster/server.mjs'`) matches the surviving cmdline —
 * the root cause of mock residue surviving across windows (t294's
 * closing note filed the fix direction).
 *
 * Phases:
 *   A  demo truth (roster 21)
 *   B  the ledger (source assertions: the two routes, the all variant,
 *      the order law, the UI doors, the threading, the launcher)
 *   C  the live loop:
 *      C1  a probeless connection is born (no SSH is ever attempted)
 *      C2  five records injected — 2 alive (real demo jobs) + 3 dead —
 *          all wearing OUR connection; the résumé counts 5, shows 3
 *      C3  collapsed: expand door present, bulk door ABSENT (the gate)
 *      C4  expand → panorama: 5 rows, bulk door present ("Forget 3 gone")
 *      C5  API direct: refusals (400/404) + the wide aperture truth
 *      C6  collapse → 3 rows again, door gone; re-expand
 *      C7  bulk two-step → 3 dead forgotten, 2 live kept; state file
 *          verified; the status line speaks the counts
 *   D  console clean
 *   finally  state file restored to the pre-suite truth, connection
 *            removed, roster back to 21
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

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

const PAN_CONN = `qa-t295-${Date.now().toString(36)}`;
const DEAD = [1, 2, 3].map((n) => `t295dead${n}${Date.now().toString(36)}`);
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
  const route = src("src/app/api/remote/records/route.ts");
  const lib = src("src/lib/remote/remote-run.ts");
  const dlg = src("src/components/workflow/remote-cluster-dialog.tsx");
  const launcher = src("services/mock-cluster/launch.sh");

  must(route.includes("export async function GET("), "the panorama route speaks GET");
  must(route.includes("export async function DELETE("), "the bulk route speaks DELETE");
  must(
    route.includes('import { isLocalRequest } from "@/lib/http-guard";'),
    "both collection doors keep the registry's cross-site guard (isLocalRequest)"
  );
  must(
    route.includes("connectionId is required — a panorama is one connection's history"),
    "GET refuses 400 without a connectionId (a panorama is ONE connection's)"
  );
  must(
    route.includes("the bulk door forgets one connection's dead history"),
    "DELETE refuses 400 without a connectionId (the bulk door is per-connection)"
  );
  must(
    route.split("Unknown connection").length >= 3,
    "both doors refuse 404 an unknown connection (a panorama of nothing is a lie)"
  );
  must(
    route.includes("connectionRunResume(connectionId, { all: true })"),
    "GET serves the SAME aggregate at the wide aperture ({ all: true })"
  );
  const aliveIdx = route.indexOf("const aliveRows = candidateIds.length");
  const sweepIdx = route.indexOf("clearRunRecord(id);");
  must(aliveIdx !== -1 && sweepIdx !== -1 && aliveIdx < sweepIdx,
    "ORDER LAW (bulk): the whole batch's existence is settled BEFORE anything dies");
  must(
    route.includes("forgotten, kept") || (route.includes("forgotten") && route.includes("kept")),
    "the bulk response counts BOTH fates (forgotten / kept)"
  );
  must(
    route.includes("rec.remote?.connectionId === connectionId"),
    "the bulk door only ever touches records wearing THIS connectionId"
  );
  must(
    lib.includes("opts?: { all?: boolean }"),
    "connectionRunResume grew the panorama variant (opts.all)"
  );
  must(
    lib.includes("resume.recent.slice(0, opts?.all ? undefined : 3)"),
    "the list aperture keeps ≤3; the panorama aperture keeps EVERY entry"
  );
  must(
    dlg.includes("data-resume-expand") && dlg.includes("aria-expanded={expanded}"),
    "the expand door carries its hook and its aria-expanded state"
  );
  must(
    dlg.includes("data-resume-forget-dead") && dlg.includes("data-resume-forget-dead-ok") &&
      dlg.includes("data-resume-forget-dead-error"),
    "the bulk door carries hooks for the arm, the result and the refusal"
  );
  must(
    dlg.includes("Sure? Forget"),
    "the bulk door is armed two-step (a click states the blast radius, the next one commits)"
  );
  must(
    dlg.includes("shown.recent.length >= shown.total"),
    "FULL-PICTURE GATE: the bulk door renders only when every row is on screen"
  );
  must(
    dlg.includes("}, [expanded, connectionId, resume]);"),
    "the panorama re-fetches when the connection changes (tracks the ledger, not a snapshot)"
  );
  must(
    dlg.includes("`/api/remote/records?connectionId=${encodeURIComponent(connectionId)}`"),
    "the card fetches the panorama route (one truth, no local assembly)"
  );
  must(
    dlg.includes("Show recent only") && dlg.includes("Show all ${shown.total} runs"),
    "the toggle speaks both directions of the aperture"
  );
  const bulkBlock = dlg.slice(dlg.indexOf("const handleForgetAllDead"), dlg.indexOf("const handleForgetAllDead") + 800);
  must(
    bulkBlock.includes("reload();"),
    "the bulk success reloads the list — the server re-aggregates (one truth, no local surgery)"
  );
  must(
    dlg.includes("onForgetAllDead={() => handleForgetAllDead(selected.id)}") &&
      dlg.includes("onForgetAllDead={onForgetAllDead}"),
    "the dialog hands the saved editor the bulk caller; the editor threads it to the card"
  );
  must(
    launcher.includes('$PWD/server.mjs') && !launcher.includes('bun run "$MODE"'),
    "launch.sh execs the entrypoint by ABSOLUTE path (the cleanup pattern can find the cmdline)"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (inject → expand → bulk forget) ==");

  snap0 = readFileSync(STATE_FILE, "utf8"); // pre-suite truth

  // C1 — the probeless connection (POST saves; nothing probed, no SSH ever)
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: PAN_CONN,
      name: "QA t295 Panorama",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);
  connIds.push(PAN_CONN);

  // C2 — five records, all wearing OUR connection: 3 dead (jobs nowhere)
  //      + 2 alive (real demo jobs). Timestamps interleave the dead ones
  //      into the newest three, so the COLLAPSED card already shows dead
  //      rows — the perfect stage for the full-picture gate.
  const aliveJobs = (jobs0.jobs ?? []).filter((j) => !!j?.id).slice(0, 2);
  must(aliveJobs.length === 2, `two live demo jobs picked as the kept witnesses (${aliveJobs.map((j) => j.id).join(", ")})`);
  const t = (iso) => new Date(iso).toISOString();
  const mkRec = (jobId, startedAt, cmd) => ({
    jobId,
    projectId: "t295-panorama",
    type: "motioncorr",
    pid: null,
    cmd,
    workdir: `/home/z/my-project/data/relion/gone/${jobId}`,
    logFile: `/home/z/my-project/data/relion/gone/${jobId}/run.out`,
    errFile: `/home/z/my-project/data/relion/gone/${jobId}/run.err`,
    startedAt: t(startedAt),
    done: true,
    exitCode: 0,
    remote: {
      connectionId: PAN_CONN,
      module: "relion/5.0.1",
      mode: "direct",
      stagedMs: 1100,
      syncMs: 2200,
      syncedFiles: 2,
      syncedBytes: 2048,
    },
  });
  const runs = { ...stateRuns() };
  runs[DEAD[0]] = mkRec(DEAD[0], "2026-09-01T08:00:00Z", "t295: dead record 1 (oldest)");
  runs[aliveJobs[0].id] = mkRec(aliveJobs[0].id, "2026-09-02T08:00:00Z", "t295: LIVE demo job 1's record");
  runs[DEAD[1]] = mkRec(DEAD[1], "2026-09-03T08:00:00Z", "t295: dead record 2");
  runs[aliveJobs[1].id] = mkRec(aliveJobs[1].id, "2026-09-04T08:00:00Z", "t295: LIVE demo job 2's record");
  runs[DEAD[2]] = mkRec(DEAD[2], "2026-09-05T08:00:00Z", "t295: dead record 3 (newest)");
  writeStateRuns(runs);
  must(Object.keys(stateRuns()).filter((k) => k === DEAD[0] || k === DEAD[1] || k === DEAD[2]).length === 3,
    "three dead records injected into the GLOBAL state file");

  const readConns = async () => {
    const d = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    return d.connections ?? d ?? [];
  };
  const resume5 = await pollUntil(async () => {
    const list = await readConns();
    const c = (Array.isArray(list) ? list : []).find((x) => x.id === PAN_CONN);
    return c?.resume?.total === 5 ? c.resume : null;
  }, 10_000);
  must(!!resume5, "the résumé counts all five injected records (total 5)");
  must(
    resume5?.recent?.length === 3,
    "the list aperture stays at ≤3 (the reading line under the summary)"
  );
  must(
    resume5?.recent?.[0]?.jobId === DEAD[2],
    "newest first: the reading line opens with the newest dead record"
  );
  must(
    resume5?.recent?.filter((e) => e.exists === false).length === 2,
    "the t272 grades ride along: two of the three rendered rows are dead"
  );

  // C3 — the dialog, collapsed: expand present, bulk ABSENT (the gate)
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
  await sleep(1500);
  await page.locator(`button[aria-label^="QA t295 Panorama"]`).first().click({ force: true }).catch(() => {});
  await sleep(1200);
  const card = page.locator("[data-run-resume]").first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  must(await card.isVisible().catch(() => false), "the résumé card renders for the panorama connection");
  const rowsCollapsed = await page.locator("[data-resume-entry]").count();
  must(rowsCollapsed === 3, `collapsed: three rows on screen (got ${rowsCollapsed})`);
  const expandBtn = page.locator("[data-resume-expand]").first();
  must(await expandBtn.isVisible().catch(() => false), "the expand door is present on overflow");
  must(
    ((await expandBtn.textContent().catch(() => "")) ?? "").includes("Show all 5 runs"),
    "the toggle states the full count (Show all 5 runs)"
  );
  must(
    (await expandBtn.getAttribute("aria-expanded")) === "false",
    "aria-expanded=false while collapsed (the aperture is a state, not a guess)"
  );
  must(
    (await page.locator("[data-resume-forget-dead]").count()) === 0,
    "FULL-PICTURE GATE, live: NO bulk door over a three-row fold (the count would understate)"
  );

  // C4 — expand: the panorama arrives, the bulk door may now speak
  await expandBtn.click({ force: true }).catch(() => {});
  const rowsAll = await pollUntil(async () => {
    const n = await page.locator("[data-resume-entry]").count();
    return n === 5 ? n : null;
  }, 10_000);
  must(rowsAll === 5, `expanded: the panorama swaps in ALL five rows (got ${rowsAll ?? 0})`);
  must(
    ((await expandBtn.textContent().catch(() => "")) ?? "").includes("Show recent only"),
    "the toggle flips its label once expanded"
  );
  must(
    (await expandBtn.getAttribute("aria-expanded")) === "true",
    "aria-expanded=true over the panorama"
  );
  const bulkBtn = page.locator("[data-resume-forget-dead]").first();
  await bulkBtn.scrollIntoViewIfNeeded().catch(() => {});
  must(await bulkBtn.isVisible().catch(() => false), "the bulk door renders over the FULL picture");
  must(
    ((await bulkBtn.textContent().catch(() => "")) ?? "").trim() === "Forget 3 gone",
    "the bulk label states the exact blast radius (Forget 3 gone)"
  );
  must(
    ((await page.locator("[data-resume-entry]").first().getAttribute("data-resume-entry")) ?? "") === DEAD[2],
    "the panorama keeps the newest-first order"
  );
  await sleep(600);
  await page.screenshot({ path: `${SHOTS}/t295-resume-panorama.png` }).catch(() => {});

  // C5 — the panorama route, direct: refusals + the wide aperture truth
  const getNoParam = await fetch(`${BASE}/api/remote/records`, { headers: SH });
  must(getNoParam.status === 400, `GET without connectionId → 400 (got ${getNoParam.status})`);
  const getUnknown = await fetch(`${BASE}/api/remote/records?connectionId=nope-t295`, { headers: SH });
  must(getUnknown.status === 404, `GET with an unknown connection → 404 (got ${getUnknown.status})`);
  const getOk = await fetch(`${BASE}/api/remote/records?connectionId=${encodeURIComponent(PAN_CONN)}`, { headers: SH });
  must(getOk.status === 200, `GET with the connection → 200 (got ${getOk.status})`);
  const pan = await getOk.json().catch(() => null);
  must(
    pan?.ok === true && pan?.resume?.recent?.length === 5 && pan?.resume?.total === 5,
    "the wide aperture serves ALL five entries under the same resume shape"
  );
  must(
    pan?.resume?.recent?.filter((e) => e.exists === false).length === 3,
    "the panorama's three dead rows are pre-graded exists=false (t272 rides along)"
  );
  const delNoParam = await fetch(`${BASE}/api/remote/records`, { method: "DELETE", headers: SH });
  must(delNoParam.status === 400, `DELETE without connectionId → 400 (got ${delNoParam.status})`);
  const delUnknown = await fetch(`${BASE}/api/remote/records?connectionId=nope-t295`, { method: "DELETE", headers: SH });
  must(delUnknown.status === 404, `DELETE with an unknown connection → 404 (got ${delUnknown.status})`);

  // C6 — collapse: the fold returns, the bulk door withdraws with it
  await expandBtn.click({ force: true }).catch(() => {});
  await sleep(800);
  const rowsFolded = await page.locator("[data-resume-entry]").count();
  must(rowsFolded === 3, `collapsed again: the reading line returns (got ${rowsFolded})`);
  must(
    (await page.locator("[data-resume-forget-dead]").count()) === 0,
    "the bulk door withdraws with the fold (the gate never sleeps)"
  );
  await expandBtn.click({ force: true }).catch(() => {});
  await pollUntil(async () => ((await page.locator("[data-resume-entry]").count()) === 5 ? true : null), 10_000);

  // C7 — the bulk two-step: arm → confirm → 3 dead forgotten, 2 live kept
  const bulkBtn2 = page.locator("[data-resume-forget-dead]").first();
  await bulkBtn2.click({ force: true }).catch(() => {});
  await sleep(400);
  must(
    ((await bulkBtn2.textContent().catch(() => "")) ?? "").trim() === "Sure? Forget 3",
    "first click ARMS the door (Sure? Forget 3)"
  );
  must(
    ((await bulkBtn2.getAttribute("aria-label")) ?? "").includes("Confirm forgetting the 3 dead history entries"),
    "the armed door's aria-label speaks the confirmation"
  );
  await bulkBtn2.click({ force: true }).catch(() => {});
  const statusLine = await pollUntil(async () => {
    const el = page.locator("[data-resume-forget-dead-ok]").first();
    const txt = (await el.textContent().catch(() => "")) ?? "";
    return txt.includes("Forgot 3") && txt.includes("kept 2") ? txt : null;
  }, 12_000);
  must(!!statusLine, `the status line speaks BOTH fates (${statusLine ?? "absent"})`);
  const rowsAfter = await pollUntil(async () => {
    const n = await page.locator("[data-resume-entry]").count();
    return n === 2 ? n : null;
  }, 10_000);
  must(rowsAfter === 2, `the panorama re-fetches after the reload: two live rows remain (got ${rowsAfter ?? 0})`);
  const runsAfter = stateRuns();
  must(
    !runsAfter[DEAD[0]] && !runsAfter[DEAD[1]] && !runsAfter[DEAD[2]],
    "the three dead records LEFT the global state file"
  );
  must(
    !!runsAfter[aliveJobs[0].id] && !!runsAfter[aliveJobs[1].id],
    "the two live records SURVIVED (live history belongs to its canvas)"
  );
  const resumeAfter = await pollUntil(async () => {
    const list = await readConns();
    const c = (Array.isArray(list) ? list : []).find((x) => x.id === PAN_CONN);
    return c?.resume?.total === 2 ? c.resume : null;
  }, 10_000);
  must(!!resumeAfter, "the API confirms the stand-down (total 2)");
  must(
    resumeAfter?.recent?.every((e) => e.exists === true),
    "every remaining row is graded exists=true (only live history remains)"
  );
  // idempotent bulk: nothing dead left → forgotten 0, kept 2
  const delAgain = await fetch(`${BASE}/api/remote/records?connectionId=${encodeURIComponent(PAN_CONN)}`, {
    method: "DELETE",
    headers: SH,
  });
  const delAgainBody = await delAgain.json().catch(() => null);
  must(
    delAgain.ok && delAgainBody?.forgotten === 0 && delAgainBody?.kept === 2,
    `a second bulk pass is honest idempotence (forgotten 0, kept 2 — got ${JSON.stringify(delAgainBody)})`
  );
  // the single door (t294) still refuses a live record through the same law
  const delSingle = await fetch(`${BASE}/api/remote/records/${aliveJobs[0].id}`, {
    method: "DELETE",
    headers: SH,
  });
  must(delSingle.status === 409, `the single door still refuses a LIVE record (got ${delSingle.status})`);

  // ---- Phase D: console clean ---------------------------------------------
  console.log("== PHASE D: console ==");
  must(
    consoleErrors.length === 0,
    `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`
  );

  console.log(fail === 0 ? "\nt295: ALL PASS" : `\nt295: ${fail} FAIL`);
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
  await sleep(1500);
  try {
    const jobsNow = await (await fetch(`${BASE}/api/jobs`)).json();
    const n = (jobsNow.jobs ?? []).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch { /* best effort */ }
  try { execSync("fuser -k 3022/tcp 2>/dev/null"); } catch { /* nothing on the port */ }
  await browser.close().catch(() => {});
}
