/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t613 — opening QA probe (world read-only): the spotlight innards' lane.
 *
 * QA faces: hydrate 12 cards, 12c/13e, 12 dots, console clean, roster 6/1.
 * Lane recon — t612 named the active-project spotlight's remaining blocks
 * as the family's next scan ("spotlight 头部/jobs 列表/quick actions" —
 * though "quick actions" turned out to be a stale ledger entry: no such
 * block exists in the dashboard; the REAL remaining faces are the banner,
 * the stage rail's chips, the jobs label row and the roster rows, while
 * the analytics three views already speak since t611/t612).
 *
 * The gap must be real in the SERVED world, not just in source: every
 * spotlight face is measured for animationName. Expected BEFORE the fix:
 * banner / stage label / chips / chevrons / jobs label / search / status
 * chips / roster rows / sweep all mount SILENT (animationName "none")
 * inside the already-risen card — while the analytics innards (flow rows)
 * DO speak, proving the grammar works in this world (the control group).
 *
 * Usage: node scripts/t613-qa-probe.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* read-only lane needs a REAL navigation into the dashboard — CDP dedicated
 * port 9332 (9323 = t578, 9324 = t584/t604, 9325 = t605, 9326 = t607,
 * 9327 = t608, 9328 = t609, 9329 = t610, 9330 = t611, 9331 = t612) + fresh
 * profile (the t581 lesson: a dedicated port and a clean profile per suite) */
const CDP_PORT = "9332";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t613-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
let chromeProc = null;
async function launchDesktopChrome() {
  chromeProc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--window-size=1280,720",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
    "about:blank",
  ], { stdio: "ignore", detached: false });
  const ready = await pollUntil(() => {
    try { return sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200"; }
    catch { return false; }
  }, 15000, 300);
  return ready;
}
const applyShim = () => {
  try { return sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      if (typeof v === "string") {
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        else if (v === "true") v = true;
        else if (v === "false") v = false;
      }
      return v;
    } catch { await sleep(600); }
  }
  return null;
};
async function pollUntil(fn, timeoutMs = 120000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
/* the dashboard toggle: Shift+D on a plain window keydown listener — a
 * synthetic DOM event is a first-class citizen here (not a Radix
 * controlled component); the view appearing is the proof (t611 recon) */
const shiftD = () => readJson(`(() => {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "D", shiftKey: true, bubbles: true, cancelable: true }));
  return JSON.stringify(true);
})()`);

let chromeUp = false;
try {
  console.log(`[boot] close-all + desktop Chrome on ${CDP_PORT}`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  chromeUp = await launchDesktopChrome();
  if (!chromeUp) {
    console.error("FATAL: desktop Chrome never opened its CDP port");
    process.exit(2);
  }
  await sleep(400);
  let connected = false;
  for (let i = 0; i < 3 && !connected; i++) {
    try {
      const out = sh(`agent-browser connect ${CDP_PORT} 2>&1`);
      connected = !/relaunched|failed|✗/i.test(out);
      if (!connected) console.log(`  … connect attempt ${i + 1}: ${out.slice(0, 80)}`);
    } catch { await sleep(800); }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected to desktop Chrome", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("hover shim applied", applyShim());
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* world shape */
  const world = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const dots = document.querySelectorAll("[data-canvas-ui='minimap-dot']").length;
    return JSON.stringify({ cards, edges, dots });
  })()`);
  check("canvas 12 cards", world?.cards === 12, `got ${world?.cards}`);
  check("canvas 13 edges", world?.edges === 13, `got ${world?.edges}`);
  check("minimap 12 dots", world?.dots === 12, `got ${world?.dots}`);

  /* open the dashboard view */
  const dispatched = await shiftD();
  check("Shift+D dispatched", dispatched === true);
  const opened = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const spot = document.querySelector("section[aria-label='Active project spotlight']");
      return JSON.stringify(!!spot);
    })()`);
    return v === true ? v : null;
  }, 60000, 400);
  check("dashboard view opened with the spotlight section", opened === true);

  /* give the dash cascade its full settle (card at 260+240, analytics
     pour tail ~974) so every settled read below is a SETTLED read */
  await sleep(2600);

  /* THE GAP SCAN — every spotlight face, measured where it stands.
     The section's own identity: banner (gradient header + Progress),
     stage rail (label row + StageChips + chevron links), jobs block
     (label row, sweep, search, status chips), roster table rows.
     The analytics flow rows are the CONTROL: t611's grammar must be
     alive in this world, or the scan itself is untrustworthy. */
  const scan = await readJson(`(() => {
    const spot = document.querySelector("section[aria-label='Active project spotlight']");
    if (!spot) return "null";
    const anim = (el) => (el ? getComputedStyle(el).animationName : "absent");
    const banner = spot.querySelector("h2") ? spot.querySelector("h2").closest("div.relative") : null;
    const stageLabelRow = [...spot.querySelectorAll("p")].find((p) => /^Pipeline stages$/.test((p.textContent || "").trim()));
    /* the StageChip's own group class is the honest discriminator — a bare
       title substring swept in 15 unrelated buttons (analytics toolbar,
       roster rows) whose mixed anims poisoned the count (tuition ①) */
    const chips = [...spot.querySelectorAll("button")].filter((b) => (b.className || "").includes("group/stage"));
    const links = [...spot.querySelectorAll("span[aria-hidden='true']")].filter((s) => s.querySelector("svg.lucide-chevron-right"));
    const jobsLabel = [...spot.querySelectorAll("p")].find((p) => /^Jobs$/.test((p.textContent || "").trim()));
    const jobsLabelRow = jobsLabel ? jobsLabel.closest("div.flex") : null;
    const sweep = document.querySelector("[data-testid='homecoming-sweep']");
    const search = spot.querySelector("[data-testid='roster-search-input']");
    /* the chip prints label + count with a space ("All 12") — a bare ^All$
       matched nothing (tuition ②), and the \s/\d regex flavor died in the
       eval pipeline's escaping (tuition ②b): a plain startsWith needs no
       backslashes and cannot lie */
    const statusChips = [...spot.querySelectorAll("button")].filter((b) => (b.textContent || "").trim().startsWith("All "));
    const rows = [...spot.querySelectorAll("[data-roster-row]")];
    const flowRows = document.querySelectorAll("[data-analytics-arrival] [data-flow-row]");
    return JSON.stringify({
      bannerAnim: anim(banner),
      stageLabelAnim: anim(stageLabelRow ? stageLabelRow.parentElement : null),
      chipCount: chips.length,
      chipAnims: [...new Set(chips.map(anim))],
      linkCount: links.length,
      linkAnims: [...new Set(links.map(anim))],
      jobsLabelAnim: anim(jobsLabelRow),
      sweepPresent: !!sweep,
      sweepAnim: anim(sweep),
      searchPresent: !!search,
      statusChipCount: statusChips.length,
      rowCount: rows.length,
      rowAnims: [...new Set(rows.map(anim))],
      flowRowCount: flowRows.length,
      flowRowAnims: [...new Set([...flowRows].map(anim))],
    });
  })()`);
  check("gap scan returned", !!scan && typeof scan === "object", JSON.stringify(scan).slice(0, 200));
  if (scan && typeof scan === "object") {
    check("control: analytics flow rows DO speak (t611 grammar alive in this world)",
      scan.flowRowCount >= 2 && scan.flowRowAnims.every((a) => a && a !== "none"),
      `n=${scan.flowRowCount} anims=${JSON.stringify(scan.flowRowAnims)}`);
    check("lane gap: banner mounts SILENT", scan.bannerAnim === "none", `got ${scan.bannerAnim}`);
    check("lane gap: stage label row mounts SILENT", scan.stageLabelAnim === "none", `got ${scan.stageLabelAnim}`);
    check("lane gap: ALL stage chips mount SILENT",
      scan.chipCount === 12 && scan.chipAnims.every((a) => a === "none"),
      `n=${scan.chipCount} anims=${JSON.stringify(scan.chipAnims)}`);
    check("lane gap: chevron links mount SILENT",
      scan.linkCount === 11 && scan.linkAnims.every((a) => a === "none"),
      `n=${scan.linkCount}`);
    check("lane gap: jobs label row mounts SILENT", scan.jobsLabelAnim === "none", `got ${scan.jobsLabelAnim}`);
    check("sweep carries a story AND mounts SILENT (a face in the wave's path —\n      the recon corrected the design: it is NOT self-effacing here)",
      scan.sweepPresent === true && scan.sweepAnim === "none",
      `present=${scan.sweepPresent} anim=${scan.sweepAnim}`);
    check("roster rows present (12 faces)", scan.rowCount === 12 && scan.rowAnims.every((a) => a === "none"),
      `n=${scan.rowCount} anims=${JSON.stringify(scan.rowAnims)}`);
    check("chrome counted for the record (search + status chips stay instant by design)",
      scan.searchPresent === true && scan.statusChipCount >= 1,
      `search=${scan.searchPresent} chips=${scan.statusChipCount}`);
  }

  /* count recon for the wave's budget arithmetic: banner 1 + stage label 1
     + chips 12 + jobs label 1 + sweep 1 + rows 12 = 28 faces (the sweep
     DOES carry a story in this world — the "no host" guess was wrong; the
     probe corrected the design before the product was written) */
  const faces = scan && typeof scan === "object"
    ? 1 + 1 + (scan.chipCount || 0) + 1 + (scan.sweepPresent ? 1 : 0) + (scan.rowCount || 0) : 0;
  check("wave face budget recon (banner + stage label + chips + jobs label + sweep + rows)",
    faces === 28, `faces=${faces}`);

  /* leave the dashboard the way we came */
  const back = await shiftD();
  await sleep(900);
  const closed = await readJson(`JSON.stringify(!document.querySelector("section[aria-label='Active project spotlight']"))`);
  check("Shift+D returns to canvas", back === true && closed === true, `spotlight gone=${closed}`);

  /* console clean */
  await sleep(1200);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter(m => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);

  /* roster unchanged */
  const roster = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))"`).trim();
  check("roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
