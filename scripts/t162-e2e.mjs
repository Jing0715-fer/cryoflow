// t162 — Task 162: the panel's READING POSITION (the stay-put family's
// fourth member).
//
// Task 157 restored WHICH JOB's panel opens after a reload; this restores
// WHICH PAGE of it you were reading. The body tabs (I/O | Params |
// Results | Log) used to boot on "io" unconditionally — a user reading a
// job's log or results got thrown back to I/O on every reload even though
// the panel itself faithfully reopened. Contract: not a filter (switching
// tabs hides nothing — the other sections are one click away), no lens
// (it changes no semantics) — pure POSITION, so it joins the stay-put
// family for free (selectedId t157 → activeWorkspaceId t159 → leftRailTab
// t160 → panelTab this round).
//
//   S   seed "QA PanelTab Shop" below the pack + roster snapshot
//   X   source oracles — key, whitelist gate, lazy useState idiom, the
//       funnel's persist-then-set + gate, both gesture echoes
//   B   fresh boot writes NOTHING; opening the panel is not a tab gesture
//       (honest "io", storage still keyless); F (zero-key) merged here
//   C   CORE — click Results → storage echoes "results"; reload → the
//       panel reopens (t157's seed) AND the reading position survives
//   D   keyboard ArrowRight through the same funnel + the log-button
//       gesture echo + cross-job carry (remount re-hydrates)
//   E   seeds are honest: "nonsense" boots "io" and is NOT rewritten,
//       "" is the honest unknown, " results " trims through the gate
//   G   screenshot   Z  strict console + roster restored (id-diff delete)
//
// Run: node scripts/t162-e2e.mjs   (server on :3000, world with ≥1 card)
import { execSync } from "node:child_process";
import * as fs from "node:fs";

const BASE = "http://localhost:3000";
const KEY = "cryoflow.panelTab.v1";
const SHOP = "QA PanelTab Shop";
const SHELF = "QA PanelTab Shelf";
const SHOT_DIR = ".next/t162-shot";

let PASS = 0;
const must = (cond, label) => {
  if (!cond) throw new Error(`FATAL: ${label}`); // stop THIS instant — a half-run
  // must never keep executing (its Z-phase deletes would eat the world state
  // the forensics still need) — main().catch owns the cleanup
  PASS++;
  console.log(`  ok: ${label}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (m) => console.log(m);
async function cleanup() { try { if (b) await b.close(); } catch {} }

const { chromium } = await import("playwright");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(String(m.text() || m).slice(0, 160)); });
p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
p.on("response", (r) => {
  const u = r.url();
  if (!u.startsWith(BASE) || u.includes("_next")) return;
  // the seeded jobs have NEVER RUN — the log route's 404 is the designed
  // honest answer ("no engine run, no log file") and the LogTab renders
  // its no-log state from it; D3 clicks the log button on purpose, so
  // this specific 404 is expected, everything else stays fatal
  if (u.endsWith("/log") && r.status() === 404) return;
  if (r.status() >= 400) badResponses.push(`${r.status()} ${u.slice(BASE.length, BASE.length + 80)}`);
});

const api = async (path, method = "GET", body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { ok: r.ok, data };
};
const roster = async () => (await api("/api/jobs")).data?.jobs ?? [];

async function seedJob(type, name, workspaceId) {
  const jobs = await roster();
  const found = jobs.find((j) => j.name === name);
  let job = found ?? null;
  if (job) return await ensureRunRecord({ id: job.id, created: false }, type);
  const r = await api("/api/jobs", "POST", { type, x: 140, y: 800, workspaceId });
  if (!r.ok) throw new Error(`seed POST failed: ${JSON.stringify(r.data).slice(0, 120)}`);
  job = r.data?.job ?? r.data;
  const pr = await api(`/api/jobs/${job.id}`, "PATCH", { name });
  if (!pr.ok) throw new Error(`seed PATCH failed: ${JSON.stringify(pr.data).slice(0, 120)}`);
  return await ensureRunRecord({ id: job.id, created: true }, type);
}

/** register (idempotently — reuse paths included) a run record + EMPTY log
 *  files (qa58's registration shape): a never-run job's /log 404 is designed
 *  behavior, but the browser logs a console error for ANY 404 response and
 *  Z1 is strict; an existing empty run.out makes the route answer 200 */
async function ensureRunRecord(acc, type) {
  const projects = (await api("/api/projects")).data?.projects ?? [];
  const projectId = projects[0]?.id;
  const workdir = `/home/z/my-project/data/relion/${projectId}/${type}_${acc.id.slice(-8)}`;
  fs.mkdirSync(workdir, { recursive: true });
  for (const f of ["run.out", "run.err"]) fs.writeFileSync(`${workdir}/${f}`, "");
  const statePath = "/home/z/my-project/data/engine-state.json";
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state[acc.id] = {
    jobId: acc.id, projectId, type, pid: null,
    cmd: "qa-fixture (t162-e2e.mjs)", workdir,
    logFile: `${workdir}/run.out`, errFile: `${workdir}/run.err`,
    startedAt: new Date().toISOString(), outputs: {}, done: true, exitCode: 0,
  };
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return acc;
}

/** the probe's own cleanup radius: pop the run records it registered */
const popSeedEntries = (ids) => {
  const statePath = "/home/z/my-project/data/engine-state.json";
  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    let touched = false;
    for (const id of ids) if (state[id]) { delete state[id]; touched = true; }
    if (touched) fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch { /* the entries live on — harmless */ }
};

const relocateCardToFreeBand = async (jobId) => {
  const pack = await roster();
  const yFree = pack.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800) + 480;
  await api(`/api/jobs/${jobId}`, "PATCH", { x: 140, y: yFree });
  await sleep(600);
};

const panUntilVisible = async (id) => {
  for (let i = 0; i < 8; i++) {
    const r = await p.evaluate((jobId) => {
      const el = document.querySelector(`[data-job="${jobId}"]`);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height, vw: innerWidth, vh: innerHeight };
    }, id).catch(() => null);
    if (r == null) return;
    if (r.w > 0 && r.x >= 4 && r.y >= 110 && r.x + r.w <= r.vw - 4 && r.y + r.h <= r.vh - 110) return;
    const dx = Math.round(r.vw / 2 - (r.x + r.w / 2));
    const dy = Math.round(r.vh / 2 - (r.y + r.h / 2));
    const origin = await p.evaluate(({ vw, vh }) => {
      const empty = (x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return false;
        if (el.closest('[data-job],[role="button"],[role="toolbar"],[data-canvas-ui="minimap"],[role="dialog"]')) return false;
        return !!el.closest('[data-canvas="viewport"]');
      };
      for (let i = 0; i < 40; i++) {
        const x = 200 + Math.random() * (vw - 400);
        const y = 150 + Math.random() * (vh - 300);
        if (empty(x, y)) return { x, y };
      }
      return null;
    }, { vw: r.vw, vh: r.vh });
    if (!origin) return;
    await p.mouse.move(origin.x, origin.y);
    await p.mouse.down();
    await p.mouse.move(origin.x + dx, origin.y + dy, { steps: 12 });
    await p.mouse.up();
    await sleep(400);
  }
};

const boot = async () => {
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
};

const clickCard = async (name) => {
  for (let i = 0; i < 8; i++) {
    try {
      await p.locator(`[role="button"][aria-label^="${name}"]`).first().click({ timeout: 4000 });
      await sleep(900);
      if (await panelOpen()) return true;
    } catch { await sleep(1500); }
  }
  return false;
};

const panelOpen = () =>
  p.evaluate(() => !!document.querySelector('input[aria-label="Job name"]'));

/** the panel's reading position, scoped the t160 way: the page has OTHER
 *  tab sets (header view switcher, the INNER RELION param strip) — the
 *  outer body strip is the FIRST tablist inside the right-hand aside, and
 *  its four triggers are the only tab names this probe touches */
const reading = () =>
  p.evaluate(() => {
    const aside = document.querySelector("aside.border-l");
    if (!aside) return null;
    const list = aside.querySelector("[role=tablist]");
    if (!list) return null; // panel not open (PanelEmpty has no tablist)
    const active = list.querySelector('[role=tab][aria-selected="true"]');
    // triggers carry DISPLAY text ("I/O", "Params"…) while the contract
    // values are io|params|results|log — normalize for comparison
    const tab = active ? active.textContent.trim().toLowerCase().replace("/", "") : null;
    return { open: true, tab };
  });

const stored = () => p.evaluate((k) => window.localStorage.getItem(k), KEY);

const waitForReading = async (wantTab, timeoutMs = 8000) => {
  const t0 = Date.now();
  for (;;) {
    const s = await reading().catch(() => null);
    if (s && s.open && s.tab === wantTab) return true;
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(250);
  }
};

const clickTab = async (name) => {
  // hasText filters matched elements (first-then-filter is a no-set — the
  // first [role=tab] is "I/O", which no xpath self-filter can turn into
  // "Results"); the outer strip precedes any inner RELION strip in DOM
  // order, so .first() stays on the body strip
  await p
    .locator("aside.border-l [role=tablist] [role=tab]", { hasText: name })
    .first()
    .click({ timeout: 5000 });
  await sleep(400);
};

async function main() {
  /* ---------- Phase S — seed + roster snapshot ------------------------- */
  step("--- Phase S: seed the panel-tab shop + roster snapshot ---");
  const wsList = (await api("/api/workspaces")).data?.workspaces ?? [];
  must(wsList.length > 0, "S1 a workspace exists to host the seed");
  const roster0 = (await roster()).length; // PRE-seed count — Z4's yardstick
  const shop = await seedJob("motioncorr", SHOP, wsList[0].id);
  must(typeof shop.id === "string" && shop.id.length > 0, `S2 seed job "${SHOP}" present (${shop.id.slice(-6)}, created=${shop.created})`);
  const shelf = await seedJob("motioncorr", SHELF, wsList[0].id);
  must(typeof shelf.id === "string" && shelf.id.length > 0, `S3 seed job "${SHELF}" present (${shelf.id.slice(-6)}, created=${shelf.created})`);
  // invariant, not absolute: the delta equals what THIS run actually created
  // (a leftover pair from a FATALed earlier run is reused, not re-created)
  const seededNow = (shop.created ? 1 : 0) + (shelf.created ? 1 : 0);
  const rosterAfter = (await roster()).length;
  must(rosterAfter === roster0 + seededNow, `S4 roster delta matches creations (${roster0} + ${seededNow} = ${rosterAfter})`);

  /* ---------- Phase X — source oracles --------------------------------- */
  step("--- Phase X: source oracles (the reading-position contract) ---");
  const src = fs.readFileSync("src/components/workflow/job-panel.tsx", "utf8");
  must(src.includes('PANEL_TAB_KEY = "cryoflow.panelTab.v1"'), "X1 key is cryoflow.panelTab.v1");
  must(src.includes('PANEL_TABS = ["io", "params", "results", "log"]'), "X2 whitelist names exactly the four rendered tabs");
  must(/localStorage\.getItem\(PANEL_TAB_KEY\)\?\.trim\(\)/.test(src), "X3 hydrate reads bare string + trims");
  must(/\(PANEL_TABS as readonly string\[\]\)\.includes\(raw \?\? ""\)/.test(src), "X4 trust gate = the whitelist itself (corrupt resolves to io)");
  must(/React\.useState<PanelTab>\(hydratePanelTab\)/.test(src), "X5 lazy useState idiom (panel is client-only, t156 idiom not t160's boot effect)");
  must(/if \(!\(PANEL_TABS as readonly string\[\]\)\.includes\(t\)\) return;/.test(src), "X6 the funnel gates on the whitelist before persisting");
  must(/persistPanelTab\(t\);\s*\n\s*setTab\(t as PanelTab\);/.test(src), "X7 funnel is persist-then-set (storage echoes what the user just saw)");
  must(/persistPanelTab\("params"\);\s*\n\s*setTab\("params"\);/.test(src), "X8 the palette deep-link echoes its gesture (t159 linkJobTo reasoning)");
  must(/persistPanelTab\("log"\);\s*\n\s*setTab\("log"\);/.test(src), "X9 the log button echoes its gesture");
  must(/Task 162.*stay-put family|stay-put family.*Task 162/s.test(src), "X10 the source carries the Task 162 contract note");

  /* ---------- Phase B — fresh boot writes nothing ---------------------- */
  step("--- Phase B: fresh boot writes NOTHING; opening is not a gesture ---");
  await boot();
  must((await stored()) === null, "B1 fresh page gains no panelTab key (zero-write boot, F merged here)");
  await relocateCardToFreeBand(shop.id);
  // the canvas learns the new position from its POLLER — panning against a
  // stale render races the poll (the B2 flaps: pan centers the OLD spot,
  // the card lands in the new band afterwards, the click hits empty canvas).
  // A reload makes the next render start AT the new position — deterministic.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await panUntilVisible(shop.id);
  const b2ok = await clickCard(SHOP);
  if (!b2ok) {
    const forensics = await p.evaluate(() => ({
      cardInDom: !!document.querySelector('[role="button"][aria-label^="QA PanelTab Shop"]'),
      panelInput: !!document.querySelector('input[aria-label="Job name"]'),
      dialogOpen: !!document.querySelector('[role="dialog"][data-state="open"]'),
      asideTabs: !!document.querySelector("aside.border-l [role=tablist]"),
      storedKeys: Object.keys(window.localStorage).filter((k) => k.startsWith("cryoflow.")).join(",") || "none",
    })).catch((e) => ({ evalThrew: String(e).slice(0, 80) }));
    console.log(`  B2 FORENSICS: ${JSON.stringify(forensics)}`);
  }
  must(b2ok, `B2 the ${SHOP} card opens the panel (real pointer stream)`);
  must(await waitForReading("io"), "B3 the reading position boots on the honest default io");
  must((await stored()) === null, "B4 opening the panel is NOT a tab gesture — storage still keyless");

  /* ---------- Phase C — CORE: the position survives the reload --------- */
  step("--- Phase C: click Results → echo → reload → still Results ---");
  await clickTab("Results");
  must(await waitForReading("results"), "C1 the Results tab is active");
  must((await stored()) === "results", `C2 storage echoes results synchronously (got: ${JSON.stringify(await stored())})`);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(await waitForReading("results"), "C3 CORE: after reload the panel reopens (t157 seed) AND the reading position survives");

  /* ---------- Phase D — keyboard through the funnel + gestures --------- */
  step("--- Phase D: keyboard + log button + cross-job carry ---");
  await p.locator('aside.border-l [role=tablist] [role=tab][aria-selected="true"]').first().focus();
  await p.keyboard.press("ArrowRight");
  await sleep(400);
  must(await waitForReading("log"), "D1 ArrowRight lands on log through the same funnel");
  must((await stored()) === "log", `D2 the keyboard gesture echoes too (got: ${JSON.stringify(await stored())})`);
  await p.locator('[aria-label^="View engine log"]').first().click({ timeout: 5000 });
  await sleep(400);
  must(await waitForReading("log"), "D3 the log button keeps log active");
  await clickTab("Params");
  must(await waitForReading("params"), "D4 Params activates");
  must((await stored()) === "params", "D5 storage follows");
  await relocateCardToFreeBand(shelf.id);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await panUntilVisible(shelf.id);
  must(await clickCard(SHELF), `D6 switching to the ${SHELF} card remounts the panel body`);
  must(await waitForReading("params"), "D7 the reading position CARRIES across jobs (remount re-hydrates the global position)");

  /* ---------- Phase E — seeds are honest ------------------------------- */
  step("--- Phase E: corrupt / empty / spaced seeds boot honestly ---");
  await p.evaluate((k) => window.localStorage.setItem(k, "nonsense"), KEY);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(await waitForReading("io"), 'E1 a "nonsense" seed boots the honest default io');
  must((await stored()) === "nonsense", "E2 and the boot does NOT rewrite the stale seed");
  await p.evaluate((k) => window.localStorage.setItem(k, ""), KEY);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(await waitForReading("io"), 'E3 the empty string is the honest unknown');
  await p.evaluate((k) => window.localStorage.setItem(k, " results "), KEY);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(await waitForReading("results"), 'E4 a spaced value trims through the gate');

  /* ---------- Phase G — screenshot -------------------------------------- */
  step("--- Phase G: screenshot ---");
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await p.screenshot({ path: `${SHOT_DIR}/t162-reading-position.png`, fullPage: false });
  must(fs.existsSync(`${SHOT_DIR}/t162-reading-position.png`), "G1 screenshot saved");

  /* ---------- Phase Z — strict console + roster restored ---------------- */
  step("--- Phase Z: strict console + roster restored ---");
  must(consoleErrors.length === 0, `Z1 0 console errors (got ${consoleErrors.length}: ${JSON.stringify(consoleErrors.slice(0, 2))})`);
  must(pageErrors.length === 0, `Z2 0 pageerrors (got ${pageErrors.length})`);
  must(badResponses.length === 0, `Z3 0 responses >= 400 (got: ${badResponses.slice(0, 2).join(" | ")})`);
  await api(`/api/jobs/${shop.id}`, "DELETE");
  await api(`/api/jobs/${shelf.id}`, "DELETE");
  popSeedEntries([shop.id, shelf.id]);
  const roster1 = (await roster()).length;
  // invariant with reuse: BOTH seeds are deleted, so a REUSED leftover (it
  // was inside roster0) leaves the world roster0 − reusedCount; a fresh
  // pair nets zero. Absolute numbers lie; the accounting does not.
  const reused = (shop.created ? 0 : 1) + (shelf.created ? 0 : 1);
  const expected1 = roster0 - reused;
  must(roster1 === expected1, `Z4 roster restored (${roster1} == ${expected1}, reused ${reused}) — seeds + run records cleaned`);

  console.log(`T162 ALL PASS (${PASS} assertions)`);
  await cleanup();
}

main().catch(async (e) => {
  console.log(`FATAL: ${String(e).slice(0, 300)}`);
  await cleanup();
  process.exit(1);
});
