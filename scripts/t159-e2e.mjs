// t159 — Task 159: the WORKSPACE is the other half of the session position.
//
// Task 157 restored the selection (which card you were looking at), but
// the canvas it lives on was still forgotten on every reload: boot always
// landed on the project's FIRST workspace. Worse, that forgetting
// silently defeated the Task 157 seed whenever the selected job lived in
// any other workspace — its trust gate (jobInWorkspace) resolves against
// the booted canvas, so a selection in workspace #2 never survived.
// Task 159 folds a workspace seed into the same first landing, BEFORE
// the selection seed evaluates, so both halves of "where you were"
// restore together.
//
// Design (the doctrine it rests on):
//  - Same bare-string seed, same trust gate = reality itself: the seed
//    applies ONCE at the first landing and only if it resolves to a
//    workspace of THIS project's list. Deleted workspace / other
//    project / hand-edited garbage resolve nowhere — the honest unknown
//    is the first workspace. Boot writes NOTHING either way.
//  - The echo lives at the GESTURES that move the user: switchWorkspace
//    (the funnel every tab/palette/jump path goes through) plus the
//    three set() sites that relocate the canvas as part of a user action
//    (link-copy, import auto-switch, undo's step back). Boot landing and
//    refreshWorkspaces fallbacks stay SILENT — a fresh boot gains no
//    key (Task 157's negative oracle must keep holding).
//  - Two-way door: "" (explicitly none) is written, never a delete.
//
// Phase S — ensure two workspaces (first + "QA WS Pos Two") and two jobs
//           ("QA Pos Beta" in the second, "QA Pos Alpha" in the first),
//           all idempotent by name; roster snapshot after seeding.
// Phase X — source oracles: the key, the SSR-guarded hydrate, the trim
//           trust rule, the two-way door, the once-flag, the wsList gate,
//           the ORDER contract (ws seed folds before the selection seed
//           evaluates), the funnel echo in switchWorkspace, the exact
//           echo-site count (1 def + 4 gesture sites), load() stays
//           silent, hydrate reads-only, the Task 159 rationale.
// Phase B — fresh world: boot writes NOTHING and lands on the FIRST
//           workspace; a real row click switches to the second and the
//           storage echo lands synchronously; clicking Beta's card opens
//           its panel and the selection key echoes too.
// Phase C — RELOAD (CORE): the canvas lands on the SECOND workspace AND
//           the panel reopens for Beta — the cross-seed synergy, which
//           is exactly the case Task 157 alone could not restore. Beta's
//           card renders, Alpha's does not (visibility = membership).
// Phase D — the door both ways: switching back echoes the first
//           workspace and the cleared selection echoes ""; a dead ws id
//           and a corrupt string each boot the honest FIRST workspace
//           with the boot still silent (the stale seed is NOT rewritten).
// Phase E — cross-seed honesty: selection seed = Alpha (lives in the
//           first) while ws seed = the second → the canvas restores the
//           second workspace and the gate drops the off-canvas selection:
//           no panel, no ghost (visibility and selection agree).
// Phase F — negative oracle: a fresh page gains NO cryoflow.* key.
// Phase G — screenshot: the restored two-workspace position + panel.
// Phase Z — strict console (0 errors) + roster restored.
//
// Run: node scripts/t159-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t159-shot";
const WS_KEY = "cryoflow.activeWorkspace.v1";
const SEL_KEY = "cryoflow.selectedJob.v1";
const WS_B_NAME = "QA WS Pos Two";
// t159 scar: the seed names must NOT carry tokens other probes type into
// the find bar — the find is a SUBSTRING match (jobMatchesQuery uses
// includes) and t138's D4 lens is motion ∧ "Alpha"; a motioncorr named
// "… Alpha" on the canvas inflates that count and fails it. Choose names
// no probe ever types.
const JOB_B = "QA WSPos Hollow";
const JOB_A = "QA WSPos Ridgeline";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

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

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

/** seed one job idempotently by name; returns its id */
async function seedJob(type, name, x, y, workspaceId) {
  const jobs = await roster();
  const found = jobs.find((j) => j.name === name);
  if (found) return found.id;
  const r = await api("/api/jobs", "POST", { type, name, x, y, workspaceId });
  if (!r.ok) throw new Error(`seed POST failed: ${r.status}`);
  const { job } = await r.json();
  return job.id;
}

const stored = (k) => p.evaluate((key) => window.localStorage.getItem(key), k);
const setStored = (k, v) =>
  p.evaluate(([key, val]) => window.localStorage.setItem(key, val), [k, v]);

/** the panel's name input is the visible "who is selected" marker */
const panelName = async () =>
  p.evaluate(() => {
    const el = document.querySelector('input[aria-label="Job name"]');
    return el ? el.value : null;
  });
const panelOpen = async () => panelName() !== null;

const waitForPanel = async (want, timeoutMs = 6000) => {
  const t0 = Date.now();
  for (;;) {
    if ((await panelOpen()) === want) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(250);
  }
};

/** workspace rows of the sidebar switcher (t158 recipe): name +
 *  aria-current as the active marker */
const wsRows = async () =>
  p.evaluate(() =>
    [...document.querySelectorAll("div[role=button]")]
      .filter((r) => r.getAttribute("aria-current") != null)
      .map((r) => ({
        name: (r.querySelector("span, p, div")?.textContent || "").trim(),
        isCurrent: r.getAttribute("aria-current") === "true",
      }))
  );

/** open the Workspaces tab (Catalog is the default — Radix TabsTrigger
 *  takes a real click) and return the rows */
const openWsPanel = async () => {
  await p.getByRole("tab", { name: /Workspaces/ }).click({ timeout: 8000 });
  await sleep(700);
  return wsRows();
};

/** real-click the workspace row whose name matches (exact) */
const clickWsRow = async (name) => {
  await p
    .locator('div[role="button"]')
    .filter({ hasText: name })
    .first()
    .click({ timeout: 5000 });
  await sleep(900);
};

/** click a canvas card by the job name living in its aria-label — the
 *  canvas selection listens on the REAL pointer stream (t156 scar) */
const clickCard = async (name) => {
  for (let i = 0; i < 8; i++) {
    try {
      await p
        .locator(`[role="button"][aria-label^="${name}"]`)
        .first()
        .click({ timeout: 4000 });
      await sleep(900);
      if (await panelOpen()) return true;
    } catch {
      await sleep(1500);
    }
  }
  return false;
};

const cardPresent = async (name) =>
  p.evaluate(
    (n) =>
      [...document.querySelectorAll('[role="button"][aria-label]')].some(
        (el) => (el.getAttribute("aria-label") || "").startsWith(n)
      ),
    name
  );

const reloadBoot = async () => {
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
};

const boot = async () => {
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
};

async function main() {
  /* ---------- Phase S — workspaces + jobs, idempotent -------------------- */
  step("--- Phase S: two workspaces + one job each ---");
  let wsList = (await (await api("/api/workspaces")).json())?.workspaces ?? [];
  if (wsList.length === 0) {
    await api("/api/workspaces", "POST", { name: "Main" });
    wsList = (await (await api("/api/workspaces")).json())?.workspaces ?? [];
  }
  let wsB = wsList.find((w) => w.name === WS_B_NAME);
  if (!wsB) {
    const r = await api("/api/workspaces", "POST", { name: WS_B_NAME });
    must(r.ok, "S1 the second workspace created (or already present)");
    wsB = (await r.json())?.workspace;
  }
  wsList = (await (await api("/api/workspaces")).json())?.workspaces ?? [];
  const wsA = wsList.find((w) => w.id !== wsB.id);
  must(!!wsA && !!wsB && wsA.id !== wsB.id, "S2 two distinct workspaces exist");
  const betaId = await seedJob("class2d", JOB_B, 900, 620, wsB.id);
  const alphaId = await seedJob("motioncorr", JOB_A, 700, 420, wsA.id);
  must(!!betaId && !!alphaId && betaId !== alphaId, "S3 one job seeded per workspace");
  const rosterBefore = (await roster()).length;

  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  /* ---------- Phase X — source oracles ----------------------------------- */
  step("--- Phase X: source oracle — the workspace half of the position ---");
  const src = execSync("cat src/lib/store.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/const ACTIVE_WS_KEY = "cryoflow\.activeWorkspace\.v1";/.test(src),
    "oracle: the workspace position lives under its own namespaced key");
  must(/function hydrateActiveWorkspace\(\): string \| null \{\s*if \(typeof window === "undefined"\) return null;/.test(src),
    "oracle: hydration is SSR-guarded");
  must(/const trimmed = raw\.trim\(\);\s*return trimmed === "" \? null : trimmed;/.test(src),
    "oracle: the trust rule trims and reads the empty string as the honest none");
  must(/window\.localStorage\.setItem\(ACTIVE_WS_KEY, id \?\? ""\);/.test(src),
    "oracle: the two-way door writes the empty string, not a delete");
  must(/let wsSeedApplied = false;/.test(src),
    "oracle: the seed applies ONCE per page load (once-flag)");
  must(/wsList\.find\(\(w\) => w\.id === wsSeed\)/.test(src),
    "oracle: the apply gate resolves the seed against THIS project's list");
  {
    const loadBody = src.slice(
      src.indexOf("load: async"),
      src.indexOf("refreshWorkspaces: async")
    );
    const idxWs = loadBody.indexOf("hydrateActiveWorkspace()");
    const idxSel = loadBody.indexOf("hydrateSelectedJob()");
    must(idxWs >= 0 && idxSel > idxWs,
      "oracle: the ws seed folds BEFORE the selection seed evaluates (the synergy order)");
    must(!loadBody.includes("persistActiveWorkspace") && !loadBody.includes("setItem"),
      "oracle: load() stays SILENT — boot writes nothing (Task 157's negative oracle keeps holding)");
  }
  {
    const swBody = src.slice(
      src.indexOf("switchWorkspace: (id) =>"),
      src.indexOf("createWorkspace: async")
    );
    must(/if \(get\(\)\.activeWorkspaceId === id\) return;/.test(swBody) &&
         swBody.includes("persistActiveWorkspace(id)"),
      "oracle: the echo lives in the switchWorkspace funnel, after the real-transition guard");
  }
  must((src.match(/persistActiveWorkspace\(/g) || []).length === 5,
    "oracle: exactly 1 definition + 4 gesture echo sites (switch / link / import / undo)");
  {
    const hydrateBody = src.slice(
      src.indexOf("function hydrateActiveWorkspace"),
      src.indexOf("function persistActiveWorkspace")
    );
    must(!hydrateBody.includes("setItem"),
      "oracle: hydration reads, writes NOTHING back (Task 153 law)");
  }
  must(src.includes("Task 159 — the workspace is the other half of the session"),
    "oracle: the Task 159 rationale lives in the source");

  /* ---------- Phase B — fresh world: boot lands first, switch echoes ----- */
  step("--- Phase B: fresh boot silent; the row click echoes through the funnel ---");
  await boot();
  must((await stored(WS_KEY)) === null, "B1 fresh boot writes NOTHING to the ws key");
  let rows = await openWsPanel();
  must((rows.find((r) => r.isCurrent)?.name || "").includes(wsA.name),
    `B2 fresh boot lands on the FIRST workspace (got "${rows.find((r) => r.isCurrent)?.name}", want "${wsA.name}")`);
  await clickWsRow(WS_B_NAME);
  must((await stored(WS_KEY)) === wsB.id, "B3 the row click echoed wsB synchronously");
  rows = await wsRows();
  must((rows.find((r) => r.isCurrent)?.name || "").includes(WS_B_NAME), "B4 the canvas switched to wsB");
  must(await clickCard(JOB_B), "B5 clicking Beta's card opens its panel (real pointer stream)");
  must((await panelName()) === JOB_B, "B6 the panel names Beta");
  must((await stored(SEL_KEY)) === betaId, "B7 the selection key echoes Beta too (coexistence)");

  /* ---------- Phase C — RELOAD: both halves restore together (CORE) ------ */
  step("--- Phase C: reload restores the canvas AND the selection (CORE) ---");
  await reloadBoot();
  must(
    (await waitForPanel(true)) && (await panelName()) === JOB_B,
    "C1 after reload the panel reopens for Beta (CORE: the case Task 157 alone could not restore)"
  );
  must(await cardPresent(JOB_B) && !(await cardPresent(JOB_A)),
    "C2 the canvas IS wsB: Beta renders, Alpha does not (visibility = membership)");
  must((await stored(WS_KEY)) === wsB.id, "C3 the ws echo survived the reload as-is");

  /* ---------- Phase D — the door both ways + seeds that resolve nowhere -- */
  step("--- Phase D: switching back echoes; dead/corrupt seeds boot honestly ---");
  await openWsPanel();
  await clickWsRow(wsA.name);
  must((await stored(WS_KEY)) === wsA.id, "D1 switching back echoes wsA");
  must((await stored(SEL_KEY)) === "",
    "D2 the cleared selection echoed \"\" (the Task 157 subscription fired on the switch)");
  await setStored(WS_KEY, "ws-vanished-000000");
  await reloadBoot();
  rows = await openWsPanel();
  must((rows.find((r) => r.isCurrent)?.name || "").includes(wsA.name),
    "D3 a dead workspace id boots the honest FIRST workspace (no crash)");
  must((await stored(WS_KEY)) === "ws-vanished-000000",
    "D3b the boot did NOT rewrite the stale seed (boot silence holds even on a failed gate)");
  await setStored(WS_KEY, "garbage{{{");
  await reloadBoot();
  rows = await openWsPanel();
  must((rows.find((r) => r.isCurrent)?.name || "").includes(wsA.name),
    "D4 a corrupt string boots the honest FIRST workspace (no crash)");

  /* ---------- Phase E — cross-seed honesty -------------------------------- */
  step("--- Phase E: an off-canvas selection is dropped, not restored ---");
  await setStored(WS_KEY, wsB.id);
  await setStored(SEL_KEY, alphaId);
  await reloadBoot();
  must(await cardPresent(JOB_B), "E1 the canvas restored to wsB (the ws seed held)");
  {
    // poll with forensics: on a failure the last sample names the ghost
    const t0 = Date.now();
    let last = null;
    let closed = false;
    while (Date.now() - t0 < 6000) {
      last = await p.evaluate(() => ({
        name: document.querySelector('input[aria-label="Job name"]')?.value ?? null,
        ls: JSON.stringify(window.localStorage),
      }));
      if (last.name === null) { closed = true; break; }
      await sleep(250);
    }
    must(closed,
      `E2 Alpha's selection is NOT restored on Beta's canvas — the gate drops what the canvas cannot show (ghost: "${last?.name}" ls: ${last?.ls})`);
  }

  /* ---------- Phase F — negative oracle: fresh page gains no key ---------- */
  step("--- Phase F: a fresh page gains NO cryoflow key at boot ---");
  const fresh = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await fresh.goto(BASE, { waitUntil: "networkidle" });
  await fresh.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
  const keys = await fresh.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => k.startsWith("cryoflow."))
  );
  must(keys.length === 0, `F1 fresh boot writes no cryoflow.* key (got: ${keys.join(", ") || "none"})`);
  await fresh.close();

  /* ---------- Phase G — screenshot ---------------------------------------- */
  step("--- Phase G: screenshot ---");
  execSync(`mkdir -p ${OUT}`, { cwd: "/home/z/my-project" });
  await setStored(WS_KEY, wsB.id);
  await setStored(SEL_KEY, betaId);
  await reloadBoot();
  must(
    (await waitForPanel(true)) && (await panelName()) === JOB_B,
    "G1 the position restored again for the shot"
  );
  await p.screenshot({ path: `${OUT}/t159-workspace-position.png` });

  /* ---------- Phase Z — strict console + roster --------------------------- */
  step("--- Phase Z: strict console + roster ---");
  must(consoleErrors.length === 0, `Z1 0 console errors (got ${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")})`);
  must(pageErrors.length === 0, `Z2 0 page errors (got ${pageErrors.length})`);
  must(badResponses.length === 0, `Z3 0 responses >= 400 (got: ${badResponses.slice(0, 3).join(" | ")})`);
  const rosterAfter = (await roster()).length;
  must(rosterAfter === rosterBefore, `Z4 roster restored (${rosterAfter} == ${rosterBefore})`);

  console.log(`\nT159 ALL PASS (${PASS} assertions)`);
  await cleanup();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup();
  process.exit(1);
});
