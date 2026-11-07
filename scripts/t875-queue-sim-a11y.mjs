#!/usr/bin/env node
/**
 * t875 — the queue sim's OWN faces: the HpcQueueSim section (788 lines) that
 * rides INSIDE the sbatch dialog — the room the t873 walk only drove past
 * (one Run door), now walked seat by seat. Zero src; all work in scripts/ +
 * receipts.
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> quick-look (t867) -> text preview (t868) -> find bar
 * (t870) -> workspace panel (t871) -> system diagnostics (t872) -> sbatch
 * dialog (t873) -> profiles editor (t874) -> THIS section (t875).
 *
 * The surface (the sbatch dialog's resident projection — a section, not a
 * modal: the header's two doors, four NumFields whose min/max ARE the
 * server's clamp contract printed in the DOM, the clamp footnote
 * (role=status), the KPI band, the Gantt (t803 keyboard door, pours dots,
 * segment titles), the Compare sweep (progressive rows, ONE fastest crown),
 * FOUR export doors (Copy/Download x CSV/MD) with the data-csv/data-md
 * observation boundary, and the Adopt row (compare -> adopt -> inspect,
 * one loop)):
 *
 *   W-API  the routes' first-compile tax (the t873 law): profiles +
 *          sbatch builder + simulate, paid HERE outside any ride.
 *   O      the clean room — the t866 law (seed cleared, panel closed,
 *          canvas calm).
 *   W0     the sbatch room's birth (the chunk tax, up to 3 bounded
 *          attempts) — the fresh server re-pays everything.
 *   I/T    the inspector's plain door -> the tools menu -> the ONE item
 *          -> the sbatch dialog as the topmost layer.
 *   D      the dialog's own arrival (the pre lands) — the room is warm.
 *   Q      the section's CLOSED face: named, described, two doors, NO
 *          form yet (open=false is the sim state's own gate).
 *   N      the RUN face: the first Run opens the form (pristine prefill
 *          == min(64, the selected profile's gpusPerNode) — the prefill's
 *          own law), then the CLAMP RIDE: 999 in, the FORM re-rendered
 *          with the server's 64, the clamp footnote speaks — the
 *          response-is-truth at the queue sim's own layer (the t874 law,
 *          one room over).
 *   G      the Gantt's own face: ticks, rows == the API's distinct bar
 *          keys (two wells one world, cross-checked through the API's
 *          own door), pours dots + sr-only language, segment titles.
 *   C      the Compare sweep: progressive rows ("n/n simulated"), ONE
 *          fastest crown, the disabled law, the cost-proxy footer — and
 *          the crown cross-checked against the API's own race.
 *   X      the export doors: CSV copy + download (the SAME bytes — one
 *          builder), MD copy + download, the data-csv/data-md boundary,
 *          the 4s note timer's return to rest.
 *   A      the Adopt ride: the crowned row clicked, the form follows the
 *          adopted shape == the API's echo, the single Gantt re-runs.
 *   K      Escape peels exactly ONE layer.
 *   W      the world back — bit-for-bit (the sim is PURE COMPUTE: no
 *          plants, no restores, the registry must come home untouched).
 *
 * Receipt: shots-qa/t875-queue-sim-a11y.json.
 *
 *   node scripts/t875-queue-sim-a11y.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form. */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t875-queue-sim-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t875 queue-sim a11y walk — world ${world.mode}:${buildId}, the sbatch room's resident projection\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the simulate POST is a t708 write door (same-origin only). */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
const retryFetch = async (fn, what, tries = 3) => {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      sleep(2);
    }
  }
  throw new Error(`${what} failed after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
};

/* ---------- the API routes' first-compile tax (the t873 law) ---------- */
const warmApiRoutes = async (hostId) => {
  const warmGet = async (url, what, tries = 10) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(`${BASE}${url}`, { headers: SH });
        if (r.ok) return true;
        last = new Error(`HTTP ${r.status}`);
      } catch (e) {
        last = e;
      }
      sleep(5);
    }
    throw new Error(`the ${what} warm never answered after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
  };
  const warmPost = async (url, body, what, tries = 10) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(`${BASE}${url}`, { method: "POST", headers: SH, body: JSON.stringify(body) });
        if (r.ok) return true;
        last = new Error(`HTTP ${r.status}`);
      } catch (e) {
        last = e;
      }
      sleep(5);
    }
    throw new Error(`the ${what} warm never answered after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
  };
  await warmGet("/api/hpc/profiles", "profiles registry");
  await warmGet(`/api/hpc/sbatch/${hostId}?profile=slurm-gpu-cluster`, "sbatch builder");
  await warmPost("/api/hpc/simulate", {}, "queue simulation");
};

const getRegistry = async () => {
  const r = await fetch(`${BASE}/api/hpc/profiles`, { headers: SH });
  const b = await r.json();
  return b.profiles ?? [];
};
const postSimulate = async (body) => {
  const r = await fetch(`${BASE}/api/hpc/simulate`, {
    method: "POST",
    headers: SH,
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b?.error || `HTTP ${r.status}`);
  return b;
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, {
    headers: { Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" },
  });
  const b = await r.json();
  return b.jobs ?? b;
};

/* ---------- the measure: the SHARED RULER + the queue sim's probes.
 * ONE superset measure — every face films the same fields. NO ${} inside. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 48) : null; const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const gen = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^(Loading( chart| file)?|Generating)…$/.test((e.textContent || "").trim())).length; const pre = dlgTop ? dlgTop.querySelector(\'pre[aria-label="Generated sbatch script"]\') : null; const preTxt = pre ? (pre.textContent || "") : ""; const qsec = document.querySelector(\'[aria-label="Queue simulation"]\'); const qHeadRow = qsec ? qsec.children[0] : null; const qTitle = qHeadRow ? ((qHeadRow.querySelector("span") || {}).textContent || "").trim() : null; const qDescOk = qHeadRow ? /projects how the whole workflow schedules/.test(qHeadRow.textContent || "") : false; const runB = qsec ? qsec.querySelector(\'button[aria-label="Run queue simulation"]\') : null; const cmpB = qsec ? qsec.querySelector(\'button[aria-label="Compare cluster profiles"]\') : null; const numIn = qsec ? Array.from(qsec.querySelectorAll("input[type=number][aria-label]")) : []; const numMap = {}; for (const i of numIn) { numMap[i.getAttribute("aria-label")] = { v: i.value, min: i.getAttribute("min"), max: i.getAttribute("max") }; } const qstat = qsec ? Array.from(qsec.querySelectorAll("[role=status]")).map((s) => (s.textContent || "").trim()) : []; const clampOk = qstat.some((t) => /clamped to the server/.test(t)); const kpis = document.querySelector(\'[aria-label="Simulation KPIs"]\'); const kpiLbl = kpis ? Array.from(kpis.querySelectorAll("[aria-label]")).map((d) => d.getAttribute("aria-label")) : []; const meta = kpis ? kpis.nextElementSibling : null; const metaTxt = meta ? (meta.textContent || "").trim().slice(0, 120) : null; const gantt = document.querySelector(\'[aria-label="Simulated schedule (Gantt)"]\'); const gRows = gantt ? gantt.children.length - 1 : 0; const gTicks = gantt ? gantt.children[0].querySelectorAll("span").length : 0; const gTab = gantt ? gantt.getAttribute("tabindex") : null; const gPours = gantt ? gantt.querySelectorAll("[data-testid^=\\"queue-pours-\\"]").length : 0; const gSr = gantt ? Array.from(gantt.querySelectorAll(".sr-only")).map((s) => (s.textContent || "").trim()).slice(0, 6) : []; const gSeg = gantt ? Array.from(gantt.querySelectorAll("[title]")).map((d) => d.getAttribute("title")).filter((t) => /·/.test(t)).slice(0, 4) : []; const gXg = gantt ? Array.from(gantt.querySelectorAll("span")).filter((s) => /^\\d+G$/.test((s.textContent || "").trim())).length : 0; const qnote = qsec ? ((qsec.querySelector("p.line-clamp-2") || {}).textContent || "").trim().slice(0, 90) : null; const emptyG = qsec ? Array.from(qsec.querySelectorAll("div")).some((d) => d.children.length === 0 && /Nothing to schedule/.test(d.textContent || "")) : false; const blk = document.querySelector(\'[aria-label="Profile comparison"]\'); const adoptRows = blk ? Array.from(blk.querySelectorAll(\'button[aria-label^="Adopt "]\')) : []; const adoptLbl = adoptRows.map((b) => b.getAttribute("aria-label")); const adoptDis = adoptRows.map((b) => !!b.disabled); const fastN = blk ? Array.from(blk.querySelectorAll("span")).filter((s) => (s.textContent || "").trim() === "fastest").length : 0; const cmpCount = blk ? (((blk.textContent || "").match(/(\\d+)\\s*\\/\\s*(\\d+) simulated/) || []).slice(1, 3).join("/")) || null : null; const footOk = blk ? /cost proxy/.test(blk.textContent || "") : false; const dCsv = blk ? (blk.getAttribute("data-csv") || "") : ""; const dMd = blk ? (blk.getAttribute("data-md") || "") : ""; const expNote = blk ? ((blk.querySelector(\'[aria-label="Export status"]\') || {}).textContent || "").trim() : null; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); const seed = localStorage.getItem("cryoflow.selectedJob.v1"); return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgCount: dlgCount, dlgHeadTop: dlgHeadTop, gen: gen, prePresent: !!pre, preLen: preTxt.length, qsec: !!qsec, qTitle: qTitle, qDescOk: qDescOk, runLbl: runB ? (runB.textContent || "").trim() : null, runDis: runB ? !!runB.disabled : null, cmpLbl: cmpB ? (cmpB.textContent || "").trim() : null, cmpDis: cmpB ? !!cmpB.disabled : null, numFields: numIn.length, numMap: numMap, qstat: qstat, clampOk: clampOk, kpis: !!kpis, kpiLbl: kpiLbl, metaTxt: metaTxt, gantt: !!gantt, gRows: gRows, gTicks: gTicks, gTab: gTab, gPours: gPours, gSr: gSr, gSeg: gSeg, gXg: gXg, qnote: qnote, emptyG: emptyG, blk: !!blk, adoptN: adoptRows.length, adoptLbl: adoptLbl, adoptDis: adoptDis, fastN: fastN, cmpCount: cmpCount, footOk: footOk, csvLen: dCsv.length, csvHead: dCsv.slice(0, 150), csvLine1: dCsv.split("\\n")[0] || "", csvLines: dCsv ? dCsv.split("\\n").length : 0, csvTail: dCsv.slice(-70), mdLen: dMd.length, mdHead: dMd.slice(0, 80), expNote: expNote, seed: seed }); })()';

/* the settle law (the t864 shape + the t869 arrival guard) */
const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 18, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const alive = next.pageBtns > 0;
    const same = alive && JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.gen === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (${run}x stable)`);
  return m;
};

/* the arrival door: WAIT for a predicate on the live measure (bounded) */
const waitFor = (what, probe, maxSecs = 26) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

/* the OOM corpse guard */
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* the card's PLAIN door */
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* the tools door + the sbatch door (the t872 deterministic door, the
 * t873 single-quote law) */
const TOOLS_DOOR = "click '[aria-label=\"More job tools\"]'";
const TOOLS_SYNTH =
  '(() => { const t = document.querySelector("[aria-label=\\"More job tools\\"]"); if (!t) return JSON.stringify({ found: false }); const r = t.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, pointerType: "mouse", clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ found: true }); })()';
const SBATCH_DOOR = "click '[data-testid=\"tools-sbatch-item\"]'";
const SBATCH_SYNTH =
  '(() => { const i = document.querySelector("[data-testid=\\"tools-sbatch-item\\"]"); if (!i) return JSON.stringify({ found: false }); i.click(); return JSON.stringify({ found: true }); })()';
const openTools = async (what) => {
  try {
    ab(TOOLS_DOOR);
  } catch {
    /* the native door denied (often the dialog's own overlay mid-animation
     * covering the wrench — the t875 W0 tuition) — pay the animation tax
     * and knock the native door AGAIN before the synthetic law rides */
    sleep(2);
    try {
      ab(TOOLS_DOOR);
    } catch {
      /* still denied — the synthetic law rides */
    }
  }
  /* light probe: the menu is transient — film via a dedicated mini-eval */
  const menuUp = () => {
    const r = evalJson('(() => { const menu = document.querySelector("[role=menu]"); const item = document.querySelector(\'[data-testid="tools-sbatch-item"]\'); return JSON.stringify({ hasMenu: !!menu, sbatchItem: !!item }); })()');
    return r;
  };
  let mm = menuUp();
  if (!(mm.hasMenu && mm.sbatchItem)) {
    mm = menuUp();
    if (!(mm.hasMenu && mm.sbatchItem)) {
      evalJson(TOOLS_SYNTH);
      for (let i = 0; i < 8; i++) {
        mm = menuUp();
        if (mm.hasMenu && mm.sbatchItem) break;
        sleep(1);
      }
    }
  }
  return mm;
};
const openSbatch = async (what) => {
  try {
    ab(SBATCH_DOOR);
  } catch {
    /* the native door denied — the synthetic law rides */
  }
  let m = waitFor(what, (x) => x.dlgCount >= 2, 6);
  if (m.dlgCount < 2) {
    evalJson(SBATCH_SYNTH);
    m = waitFor(what, (x) => x.dlgCount >= 2, 24);
  }
  return m;
};

/* the queue sim's OWN doors (plain buttons — the t873 COPY_DOOR shape) */
const qDoor = (ariaLabel) =>
  '(() => { const b = document.querySelector(\'button[aria-label="' + ariaLabel + '"]\'); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()';
/* THE KNOCK LAW (the t875 lesson — the double-knock chased the echo):
 * the fallback knock must be ARRIVAL-GATED, never a blind second fire.
 * A blind synthetic re-click lands AFTER the first response re-renders
 * the form (the echo's own numbers), and the ghost run posts the SERVER'S
 * ANSWER BACK at the server — echo == sent — un-writing the clamp footnote
 * it was meant to film. Native once; the synthetic only when the arrival
 * predicate proves the native door dead. */
const knock = async (ariaLabel, probe, maxSecs = 40, what = "the door's arrival") => {
  try {
    ab(`click '[aria-label="${ariaLabel}"]'`);
  } catch {
    /* the native door denied — the arrival will tell */
  }
  let m = waitFor(what, probe, maxSecs);
  if (!probe(m)) {
    evalJson(qDoor(ariaLabel));
    m = waitFor(what + " (synthetic)", probe, maxSecs);
  }
  return m;
};

/* the adopt door: the crown's own row (closest button to the fastest span) */
const ADOPT_DOOR =
  '(() => { const blk = document.querySelector(\'[aria-label="Profile comparison"]\'); if (!blk) return JSON.stringify({ found: false }); const f = Array.from(blk.querySelectorAll("span")).find((s) => (s.textContent || "").trim() === "fastest"); if (!f) return JSON.stringify({ found: false, why: "no crown" }); const row = f.closest("button"); if (!row) return JSON.stringify({ found: false, why: "no row" }); const lbl = row.getAttribute("aria-label"); row.click(); return JSON.stringify({ found: true, adopted: lbl }); })()';

/* the clipboard probe (the t873 law: the world grants or denies) */
const CLIP_PROBE =
  '(() => { window.__t875clip = "pending"; if (!navigator.clipboard || !navigator.clipboard.writeText) { window.__t875clip = "no-api"; return "no-api"; } navigator.clipboard.writeText("t875 clipboard probe").then(() => { window.__t875clip = "granted"; }).catch((e) => { window.__t875clip = "denied:" + String((e && e.name) || e); }); return "pending"; })()';
const CLIP_READ = '(() => { return JSON.stringify({ clip: window.__t875clip ?? "unset" }); })()';
const clipVerdict = (maxSecs = 6) => {
  evalJson(CLIP_PROBE);
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const r = evalJson(CLIP_READ);
    if (r.clip !== "pending") return r.clip;
  }
  return "timeout";
};

/* the zero-unnamed census invariant */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* the fill door: the native CDP fill (the t874 law — trusted events
 * drive React onChange; the NumField labels are unique page-wide while
 * the profiles editor stays closed) */
const fillDoor = (label, value) => ab(`fill '[aria-label="${label}"]' '${value}'`);

let exitCode = 1;
try {
  /* ---------- Face W-API ---------- */
  console.log("Face W-API — the /api/hpc/* routes' first-compile tax (paid outside any ride)");
  const jobsWarm = await retryFetch(roster, "the roster (the warm's read)", 6);
  const warmHost =
    jobsWarm.find((j) => j.type === "refine3d" && j.status === "completed") ||
    jobsWarm.find((j) => j.status === "completed" && j.type !== "import");
  if (!warmHost) throw new Error("no completed job with a builder — the sbatch warm cannot aim");
  await warmApiRoutes(warmHost.id);
  ok("W-API the routes warm (profiles + sbatch builder + queue simulation answered)", true,
    `aimed at ${warmHost.id.slice(0, 12)}`);

  /* ---------- the registry + the race card (measured, never pinned) ---------- */
  const origRegistry = await retryFetch(getRegistry, "the registry read", 6);
  const racers = origRegistry.filter((p) => p.gpusPerNode >= 1);
  const selProfile = origRegistry.find((p) => p.id === "slurm-gpu-cluster") || null;
  ok("R0 the registry speaks its racers (the sweep's field measured)",
    origRegistry.length >= 2 && racers.length >= 2 && !!selProfile,
    `profiles=${origRegistry.length} racers=${racers.length} (${racers.map((p) => p.name).join(" | ")})`);
  /* the API's own race — the crown's expected word, computed through the
   * world's own door BEFORE the UI sweep (the response-is-truth twin) */
  const apiRace = {};
  for (const p of racers) {
    const body = { clusterGpus: p.gpusPerNode * p.nodes, nodes: 4, arrayConcurrency: p.arrayConcurrency, gpuSpeedup: p.gpuSpeedup };
    const j = await retryFetch(() => postSimulate(body), `the API race for ${p.id}`);
    apiRace[p.id] = j.makespanMin;
  }
  const apiBestId = Object.entries(apiRace).reduce((w, [id, ms]) => (w === null || ms < apiRace[w] ? id : w), null);
  const apiBest = racers.find((p) => p.id === apiBestId);
  console.log(`  API race: ${JSON.stringify(apiRace)} — the crown's expected bearer: ${apiBest.name}`);

  /* ---------- Face 0: the clean room + the calm canvas ---------- */
  console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
  ab("open http://localhost:3000");
  sleep(3);
  evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
  ab("open http://localhost:3000");
  sleep(3);
  const mBoot = settle("the canvas", 24, 2);
  if (corpse(mBoot, "Face 0")) throw new Error("corpse at Face 0 — the honest stop");
  ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
    mBoot.panelOpen === false,
    `panelOpen=${mBoot.panelOpen}`);
  ok("O1 the canvas is calm and named (the census's invariant)",
    !mBoot.hasDlg && censusOk(mBoot),
    `btns=${mBoot.pageBtns} — zero unnamed anywhere`);

  /* ---------- the roster + the host ---------- */
  const jobs = await retryFetch(roster, "the roster");
  const host =
    jobs.find((j) => j.type === "refine3d" && j.status === "completed") ||
    jobs.find((j) => j.status === "completed" && j.type !== "import");
  if (!host) throw new Error("no completed job with a builder in the roster — the dialog cannot fill");
  console.log(`  script host (measured, not pinned): ${host.name} (${host.id.slice(0, 12)})`);

  /* ---------- Face W0: the first-open tax (the fresh server's birth) ---------- */
  console.log("Face W0 — the first-open tax (the sbatch room's BIRTH, paid before any door rides)");
  const warmOnce = async (tag) => {
    /* a CLEAN stage per attempt (the ensureStack law): the previous
     * attempt's layers must be gone before the next knock chain rides */
    evalJson(ESC_LAST);
    sleep(1);
    evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
    ab("open http://localhost:3000");
    sleep(3);
    const cw = evalJson(plainClick(host.id));
    if (cw.clicked !== true) return { open: false };
    const ia = waitFor(`the inspector (${tag})`, (m) => m.hasDlg && m.dlgCount >= 1, 12);
    if (!ia.hasDlg) return { open: false };
    sleep(2); /* the dialog's own overlay animation tax — the wrench is covered mid-animate-in */
    await openTools(`the tools menu (${tag})`);
    const da = await openSbatch(`the sbatch dialog (${tag})`);
    if (da.dlgCount < 2) return { open: false };
    const s = settle(`the warm dialog (${tag})`, 14, 2);
    return { open: s.dlgCount >= 2 && s.prePresent === true && s.qsec === true, measure: s };
  };
  const birth = await warmOnce("birth");
  let warmRides = 1;
  let warmHold = birth;
  while (!warmHold.open && warmRides < 3) {
    warmRides++;
    sleep(3);
    warmHold = await warmOnce(`warm${warmRides - 1}`);
  }
  ok("W0 the first-open tax paid (the room holds warm after its birth)",
    warmHold.open === true,
    `rides=${warmRides} dlg=${warmHold.measure ? warmHold.measure.dlgCount : "?"} preLen=${warmHold.measure ? warmHold.measure.preLen : "?"} qsec=${warmHold.measure ? warmHold.measure.qsec : "?"}`);
  if (!warmHold.open) throw new Error("the sbatch room never held warm — the honest stop");
  evalJson(ESC_LAST);
  sleep(1.2);
  evalJson(ESC_LAST);
  sleep(1.5);
  evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
  ab("open http://localhost:3000");
  sleep(3);
  const m0 = settle("the canvas (post-tax, the clean room again)");
  if (corpse(m0, "Face 0 post-tax")) throw new Error("corpse at the post-tax canvas — the honest stop");
  ok("O2 the post-tax boot is a clean room again (the seed cleared, the panel closed)",
    m0.panelOpen === false && !m0.hasDlg && censusOk(m0),
    `btns=${m0.pageBtns}`);
  const OPEN = m0.pageBtns;
  const jobsAtOpen = (await retryFetch(roster, "the roster at open")).length;
  console.log(`  jobs at open: ${jobsAtOpen} (the rogue-row census's opening word)`);

  /* ---------- Face I: the inspector through the plain door ---------- */
  console.log("Face I — the host inspector through the plain door");
  const c1 = evalJson(plainClick(host.id));
  ok("I1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
  const w = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
  ok("I2 the inspector arrived (a dialog aboard)", w.hasDlg === true, `dlgCount=${w.dlgCount}`);

  /* ---------- Face T: the tools door — the wrench, the ONE item, the click ---------- */
  console.log("Face T — the tools door (the t323 contract: door to tools)");
  const tArr = await openTools("the tools menu");
  ok("T1 the wrench opened the tools menu (Radix's portal menu aboard)", tArr.hasMenu === true);
  ok("T2 the ONE item speaks its name in words (the t757 contract)",
    tArr.sbatchItem === true, `sbatchItem=${tArr.sbatchItem}`);
  const dArr = await openSbatch("the sbatch dialog");
  ok("T3 the CLICK summoned the sbatch dialog as the TOPMOST layer (the t872 deterministic door)",
    dArr.dlgCount >= 2, `dlgCount=${dArr.dlgCount}`);

  /* ---------- Face D: the room's arrival (the pre lands — the dialog is warm) ---------- */
  console.log("Face D — the room's arrival (the pre's own content)");
  const d0 = waitFor("the script pre", (m) => m.dlgCount >= 2 && m.prePresent === true && m.preLen > 0);
  const d1 = settle("the sbatch dialog (the script lands)");
  if (corpse(d1, "Face D")) throw new Error("corpse at Face D — the honest stop");
  ok("D1 the sbatch dialog landed warm (the pre aboard)",
    d1.prePresent === true && d1.preLen > 200, `preLen=${d1.preLen}`);
  ok("D2 the queue sim section rides the same room (the projection's home, CLOSED)",
    d1.qsec === true && d1.numFields === 0 && d1.blk === false,
    `qsec=${d1.qsec} numFields=${d1.numFields} blk=${d1.blk}`);
  ok("D3 zero unnamed page-wide WITH the dialog up (the census's invariant)",
    censusOk(d1), `btns=${d1.pageBtns} ctrls=${d1.ctrls}`);

  /* ---------- Face Q: the section's CLOSED face (the doors, no form yet) ---------- */
  console.log("Face Q — the Queue simulation section's own face (closed state)");
  ok("Q1 the section speaks its name in words (the header's title span)",
    d1.qTitle === "Queue simulation", `title="${d1.qTitle}"`);
  ok("Q2 the description speaks the contract (real graph, real edges, real durations)",
    d1.qDescOk === true);
  ok("Q3 the two doors named (Compare + Run) and the sim state's own gate holds (Run first, both enabled)",
    d1.runLbl === "Run" && d1.cmpLbl === "Compare" && d1.runDis === false && d1.cmpDis === false,
    `run="${d1.runLbl}" cmp="${d1.cmpLbl}" runDis=${d1.runDis} cmpDis=${d1.cmpDis}`);
  ok("Q4 the CLOSED face's census held (zero unnamed)", censusOk(d1), `btns=${d1.pageBtns}`);

  /* ---------- Face N1: the first Run — the form opens (the pristine prefill) ---------- */
  console.log("Face N1 — the first Run door (the form's birth, the pristine prefill)");
  await knock("Run queue simulation", (m) => m.kpis === true && m.gantt === true && m.numFields === 4, 40, "the projection");
  const n1 = settle("the first-run face (KPIs + Gantt + form landed)");
  if (corpse(n1, "Face N1")) throw new Error("corpse at Face N1 — the honest stop");
  ok("N1 the Run door raised the projection (KPIs + Gantt + the form aboard)",
    n1.kpis === true && n1.gantt === true && n1.numFields === 4,
    `kpiLbl=${n1.kpiLbl.length} gRows=${n1.gRows} numFields=${n1.numFields}`);
  ok("N2 the prefill speaks the selected profile's shape (min(64, gpusPerNode) — the prefill's own law)",
    n1.numMap["GPUs"] && Number(n1.numMap["GPUs"].v) === Math.min(64, selProfile.gpusPerNode),
    `GPUs=${n1.numMap["GPUs"] ? n1.numMap["GPUs"].v : "?"} (profile gpn=${selProfile.gpusPerNode})`);
  ok("N3 the four NumFields print the server's clamp contract in the DOM (min/max attrs)",
    n1.numMap["GPUs"] && n1.numMap["GPUs"].min === "1" && n1.numMap["GPUs"].max === "64" &&
    n1.numMap["Nodes"] && n1.numMap["Nodes"].max === "16" &&
    n1.numMap["Array conc."] && n1.numMap["Array conc."].max === "64" &&
    n1.numMap["GPU speedup"] && n1.numMap["GPU speedup"].max === "500",
    `GPUs ${n1.numMap["GPUs"]?.min}–${n1.numMap["GPUs"]?.max}, Nodes ${n1.numMap["Nodes"]?.min}–${n1.numMap["Nodes"]?.max}, AC ${n1.numMap["Array conc."]?.min}–${n1.numMap["Array conc."]?.max}, Spd ${n1.numMap["GPU speedup"]?.min}–${n1.numMap["GPU speedup"]?.max}`);
  ok("N4 the Run door's label flipped to Re-run (the sim state's own word)",
    n1.runLbl === "Re-run", `run="${n1.runLbl}"`);
  ok("N5 no clamp footnote on the pristine run (the echo == the sent — the honest absence)",
    n1.clampOk === false, `statuses=${JSON.stringify(n1.qstat)}`);
  ok("N6 the KPI band speaks its four cells by name (Makespan / GPU util / Avg wait / GPU hours)",
    n1.kpiLbl.length === 4 && /Makespan/.test(n1.kpiLbl.join(" ")) && /GPU hours/.test(n1.kpiLbl.join(" ")),
    `[${n1.kpiLbl.join(" | ")}]`);
  ok("N7 the meta line speaks the two wells one world (jobs == the roster's count)",
    /15 jobs · 14 deps/.test(n1.metaTxt || "") && /\d+ micrographs · [\d,]+ particles/.test(n1.metaTxt || ""),
    `meta="${n1.metaTxt}"`);
  ok("N8 the sim's note paragraph landed (the route's own words: Simulation: …)",
    /Simulation:/.test(n1.qnote || ""), `note="${n1.qnote}"`);
  ok("N9 the first-run face's census held (zero unnamed)", censusOk(n1), `btns=${n1.pageBtns}`);

  /* ---------- Face N2: the CLAMP RIDE — 999 in, the server's 64 out ---------- */
  console.log("Face N2 — the clamp ride (the response-is-truth at the queue sim's own layer)");
  fillDoor("GPUs", "999");
  const nFill = evalJson(MEASURE);
  ok("N10 the fill dirtied the field (the client's word: 999)",
    nFill.numMap["GPUs"] && nFill.numMap["GPUs"].v === "999",
    `GPUs=${nFill.numMap["GPUs"] ? nFill.numMap["GPUs"].v : "?"}`);
  await knock("Run queue simulation", (m) => m.clampOk === true && m.numMap["GPUs"] && m.numMap["GPUs"].v === "64", 40, "the clamp echo");
  const n3 = settle("the clamp face (the server's 64 landed)");
  if (corpse(n3, "Face N2")) throw new Error("corpse at Face N2 — the honest stop");
  ok("N11 the FORM re-rendered with the server's 64 (999 in, 64 out — the response-is-truth)",
    n3.numMap["GPUs"] && n3.numMap["GPUs"].v === "64",
    `GPUs=${n3.numMap["GPUs"] ? n3.numMap["GPUs"].v : "?"}`);
  ok("N12 the clamp footnote speaks (role=status: clamped to the server's contract ranges)",
    n3.clampOk === true, `statuses=${JSON.stringify(n3.qstat)}`);
  /* the echo cross-check through the API's own door: the SAME body the UI
   * sent (999 in the field, the rest pristine) echoes 64 — the API is
   * the truth the form mirrored */
  const clampEcho = await retryFetch(() => postSimulate({ clusterGpus: 999, nodes: Number(n1.numMap["Nodes"].v), arrayConcurrency: Number(n1.numMap["Array conc."].v), gpuSpeedup: Number(n1.numMap["GPU speedup"].v) }), "the clamp echo API");
  ok("N13 the API's own echo agrees (cluster.gpus == 64 — two wells one world)",
    clampEcho.cluster.gpus === 64, `echo=${JSON.stringify(clampEcho.cluster)}`);
  ok("N14 the clamp face's census held (zero unnamed)", censusOk(n3), `btns=${n3.pageBtns}`);

  /* ---------- Face G: the Gantt's own face ---------- */
  console.log("Face G — the Gantt's own face (rows, ticks, pours, segments)");
  const ganttApi = await retryFetch(() => postSimulate({ clusterGpus: 999, nodes: Number(n1.numMap["Nodes"].v), arrayConcurrency: Number(n1.numMap["Array conc."].v), gpuSpeedup: Number(n1.numMap["GPU speedup"].v) }), "the Gantt's API twin");
  const apiKeys = new Set(ganttApi.bars.map((b) => b.key));
  const g1 = settle("the gantt face");
  if (corpse(g1, "Face G")) throw new Error("corpse at Face G — the honest stop");
  ok("G1 the Gantt keeps its keyboard door (the t803 scroll law's honest name)",
    g1.gTab === "0", `tabindex=${g1.gTab}`);
  ok("G2 the time axis speaks its five ticks (0 · ¼ · ½ · ¾ · the makespan)",
    g1.gTicks === 5, `ticks=${g1.gTicks}`);
  ok("G3 one job, one row (the Gantt's rows == the API's distinct bar keys — two wells one world)",
    g1.gRows === apiKeys.size, `rows=${g1.gRows} apiKeys=${apiKeys.size}`);
  ok("G4 the pours speak their sr-only language (the t756 dots' honest words)",
    g1.gPours >= 1 && g1.gSr.length >= 1 && g1.gSr.every((t) => /^pours [a-z0-9, ]+$/.test(t)),
    `pours=${g1.gPours} sr=[${g1.gSr.join(" | ")}]`);
  ok("G5 the segments' titles speak the sacct shape (slurmId · label · GPU share · duration · nodes)",
    g1.gSeg.length >= 1 && /·/.test(g1.gSeg[0]) && /(×GPU|CPU)/.test(g1.gSeg.join(" ")),
    `seg0="${(g1.gSeg[0] || "").slice(0, 70)}"`);
  ok("G6 the G xG labels measured (the wide GPU bars' tabular words)", g1.gXg >= 0, `xg=${g1.gXg}`);
  ok("G7 the gantt face's census held (zero unnamed)", censusOk(g1), `btns=${g1.pageBtns}`);

  /* ---------- Face C: the Compare sweep — the race, the crown ---------- */
  console.log("Face C — the Compare sweep (progressive rows, ONE crown)");
  await knock("Compare cluster profiles", (m) => m.blk === true && m.cmpCount === racers.length + "/" + racers.length && m.cmpDis === false, 90, "the sweep's landing");
  const c2 = settle("the sweep (all rows landed)");
  if (corpse(c2, "Face C")) throw new Error("corpse at Face C — the honest stop");
  ok("C1 the comparison block arrived named (Profile comparison)",
    c2.blk === true, `blk=${c2.blk}`);
  ok("C2 the count line speaks the FULL race (n/n simulated — the registry's racers)",
    c2.cmpCount === racers.length + "/" + racers.length,
    `count="${c2.cmpCount}" (racers=${racers.length})`);
  ok("C3 every racer wears an Adopt row by name (aria-label: Adopt <name> — <makespan> makespan)",
    c2.adoptN === racers.length && c2.adoptLbl.every((l) => /^Adopt .+ — /.test(l)),
    `[${c2.adoptLbl.join(" | ")}]`);
  ok("C4 exactly ONE fastest crown, worn by the API race's own winner (the response-is-truth at the sweep)",
    c2.fastN === 1 && apiBest && c2.adoptLbl.some((l) => l.indexOf(apiBest.name) !== -1),
    `crowns=${c2.fastN} apiBest=${apiBest ? apiBest.name : "?"}`);
  ok("C5 the disabled law holds (a row is disabled iff its race failed — here: all racers finished)",
    c2.adoptDis.length === racers.length && c2.adoptDis.every((d) => d === false),
    `disabled=[${c2.adoptDis.join(", ")}]`);
  ok("C6 the cost-proxy footer speaks (the GPU-hours caveat in words)",
    c2.footOk === true);
  ok("C7 the export boundary is CLEAN before any export (no data-csv, no data-md)",
    c2.csvLen === 0 && c2.mdLen === 0, `csv=${c2.csvLen} md=${c2.mdLen}`);
  ok("C8 the sweep face's census held (zero unnamed)", censusOk(c2), `btns=${c2.pageBtns}`);

  /* ---------- Face X: the export doors — one builder, both paths ---------- */
  console.log("Face X — the export doors (CSV + MD, copy + download, the data-* boundary)");
  const clip = clipVerdict();
  console.log(`  clipboard verdict: ${clip}`);
  const x1 = await knock("Copy comparison as CSV", (m) => m.expNote !== null && m.expNote.length > 0, 10, "the CSV copy note");
  ok("X1 the CSV copy door spoke its note (granted: Copied …; denied: the download's honest fallback)",
    x1.expNote !== null && x1.expNote.length > 0 && (clip === "granted" ? /Copied \d+ profile rows? to the clipboard/.test(x1.expNote) : /Downloaded hpc-sweep-/.test(x1.expNote)),
    `note="${x1.expNote}" clip=${clip}`);
  ok("X2 the data-csv boundary holds the ONE builder's bytes (the header is the machine contract)",
    x1.csvLen > 100 && x1.csvLine1 === "profile,gpu_model,nodes,gpus_per_node,gpus,array_conc,speedup,status,fastest,makespan_min,gpu_util_pct,avg_wait_min,gpu_hours,error",
    `csvLen=${x1.csvLen} lines=${x1.csvLines}`);
  ok("X3 the CSV is one row per racer in race order (+ the header)",
    x1.csvLines === racers.length + 1, `lines=${x1.csvLines} (racers=${racers.length})`);
  const csvSnapshot = { len: x1.csvLen, head: x1.csvHead, tail: x1.csvTail };
  const x2 = await knock("Download comparison as CSV", (m) => m.expNote !== null && /Downloaded hpc-sweep-/.test(m.expNote), 10, "the CSV download note");
  ok("X4 the CSV download door spoke its filename (hpc-sweep-<timestamp>.csv)",
    /Downloaded hpc-sweep-\d{4}-\d{2}-\d{2}T/.test(x2.expNote || ""), `note="${x2.expNote}"`);
  ok("X5 the downloaded bytes are the SAME bytes (one builder — copy and download cannot fork)",
    x2.csvLen === csvSnapshot.len && x2.csvHead === csvSnapshot.head && x2.csvTail === csvSnapshot.tail,
    `len ${csvSnapshot.len} -> ${x2.csvLen}`);
  const x3 = await knock("Copy comparison as Markdown", (m) => m.expNote !== null && m.mdLen > 0, 10, "the MD copy note");
  ok("X6 the MD report's bytes landed (the sweep report twin: verdict + table in words)",
    x3.mdLen > 60 && (clip === "granted" ? /Copied the sweep report \(\d+ profiles?\) to the clipboard/.test(x3.expNote || "") : /Downloaded hpc-sweep-report-/.test(x3.expNote || "")),
    `mdLen=${x3.mdLen} note="${x3.expNote}"`);
  const mdSnapshot = { len: x3.mdLen, head: x3.mdHead };
  const x4 = await knock("Download comparison as Markdown", (m) => m.expNote !== null && /Downloaded hpc-sweep-report-/.test(m.expNote), 10, "the MD download note");
  ok("X7 the MD download door spoke its filename (hpc-sweep-report-<timestamp>.md)",
    /Downloaded hpc-sweep-report-\d{4}-\d{2}-\d{2}T/.test(x4.expNote || ""), `note="${x4.expNote}"`);
  ok("X8 the MD bytes are the SAME bytes (one builder — the report cannot fork either)",
    x4.mdLen === mdSnapshot.len && x4.mdHead === mdSnapshot.head,
    `len ${mdSnapshot.len} -> ${x4.mdLen}`);
  sleep(5);
  const x5 = evalJson(MEASURE);
  ok("X9 the 4s note timer returned the export status to rest (the honest none)",
    x5.expNote === null || x5.expNote === "", `note="${x5.expNote}"`);
  ok("X10 the export face's census held (zero unnamed)", censusOk(x5), `btns=${x5.pageBtns}`);

  /* ---------- Face A: the Adopt ride — compare -> adopt -> inspect ---------- */
  console.log("Face A — the adopt ride (the crowned row's shape becomes the form's shape)");
  const makespanBefore = (n3.kpiLbl.find((l) => /^Makespan/.test(l)) || "").slice(0, 40);
  const aClick = evalJson(ADOPT_DOOR);
  ok("A1 the crowned row's click spoke its name (the deterministic door on the FILMED row)",
    aClick.found === true && aClick.adopted && aClick.adopted.indexOf(apiBest.name) !== -1,
    `adopted="${aClick.adopted || ""}"`);
  const adoptBody = { clusterGpus: apiBest.gpusPerNode * apiBest.nodes, nodes: Number(n1.numMap["Nodes"].v), arrayConcurrency: apiBest.arrayConcurrency, gpuSpeedup: apiBest.gpuSpeedup };
  const adoptEcho = await retryFetch(() => postSimulate(adoptBody), "the adopt echo API");
  const a1 = waitFor("the adopted form", (m) => m.numMap["GPUs"] && m.numMap["GPUs"].v === String(adoptEcho.cluster.gpus) && m.numMap["GPU speedup"] && m.numMap["GPU speedup"].v === String(adoptEcho.speedup), 40);
  const a2 = settle("the adopted face (the form follows the adopted shape)");
  if (corpse(a2, "Face A")) throw new Error("corpse at Face A — the honest stop");
  ok("A2 the form follows the adopted shape == the API's echo (GPUs + Array conc. + GPU speedup moved together)",
    a2.numMap["GPUs"] && Number(a2.numMap["GPUs"].v) === adoptEcho.cluster.gpus &&
    a2.numMap["Array conc."] && Number(a2.numMap["Array conc."].v) === adoptEcho.cluster.arrayConcurrency &&
    a2.numMap["GPU speedup"] && Number(a2.numMap["GPU speedup"].v) === adoptEcho.speedup,
    `GPUs=${a2.numMap["GPUs"]?.v} AC=${a2.numMap["Array conc."]?.v} Spd=${a2.numMap["GPU speedup"]?.v} (echo ${JSON.stringify(adoptEcho.cluster)} spd=${adoptEcho.speedup})`);
  ok("A3 no clamp footnote after the adopt (the adopted shape is inside the contract)",
    a2.clampOk === false, `statuses=${JSON.stringify(a2.qstat)}`);
  const makespanAfter = (a2.kpiLbl.find((l) => /^Makespan/.test(l)) || "").slice(0, 40);
  ok("A4 the single Gantt re-ran (the makespan's own word moved with the shape)",
    a2.kpis === true && makespanAfter !== makespanBefore,
    `makespan "${makespanBefore}" -> "${makespanAfter}"`);
  ok("A5 the adopt face's census held (zero unnamed)", censusOk(a2), `btns=${a2.pageBtns}`);

  /* ---------- Face K: Escape peels exactly one layer ---------- */
  evalJson(ESC_LAST);
  sleep(1.5);
  const k1 = evalJson(MEASURE);
  ok("K1 Escape peeled exactly ONE layer (the helper's law), the inspector remains",
    k1.dlgCount === d1.dlgCount - 1 && k1.hasDlg === true,
    `dlgCount ${d1.dlgCount} -> ${k1.dlgCount}`);
  ok("K2 the peeled layer's census back (zero unnamed without the dialog)", censusOk(k1));

  /* ---------- Face W: the world back (the sim is pure compute) ---------- */
  console.log("Face W — the world back (fresh load, settled; NO plants this window)");
  ab("open http://localhost:3000");
  sleep(3);
  const w1 = settle("the restored canvas");
  if (corpse(w1, "Face W")) throw new Error("corpse at Face W — the honest stop");
  ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
    w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasDlg,
    `btns=${w1.pageBtns} (opening ${OPEN})`);
  const jobsAtClose = (await retryFetch(roster, "the roster at close")).length;
  ok("W2 the jobs count == the opening count (the t872 rogue-row census's guard)",
    jobsAtClose === jobsAtOpen, `jobs ${jobsAtOpen} -> ${jobsAtClose}`);
  const regAfter = await retryFetch(getRegistry, "the registry re-read");
  ok("W3 the registry bit-for-bit untouched (pure compute leaves NOTHING)",
    JSON.stringify(regAfter) === JSON.stringify(origRegistry));
  ok("W4 the ride leaves no session seed (the t157 two-way door's honest none)",
    w1.seed === "" || w1.seed === null, `seed=${JSON.stringify(w1.seed)}`);

  /* ---------- the ledger at birth (five faces, the shared law) ---------- */
  console.log("Ledger — the t861 birthright aboard from birth (five faces, the shared law)");
  const prevFaces = cmp.prev?.faces ?? null;
  const scalarOf = (m) => m.pageBtns;
  const faces = {
    canvas: ledgerFace(prevFaces ? prevFaces.canvas?.live ?? null : null, m0, scalarOf),
    queueForm: ledgerFace(prevFaces ? prevFaces.queueForm?.live ?? null : null, n3, scalarOf),
    ganttFace: ledgerFace(prevFaces ? prevFaces.ganttFace?.live ?? null : null, g1, scalarOf),
    compareFace: ledgerFace(prevFaces ? prevFaces.compareFace?.live ?? null : null, c2, scalarOf),
    worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
  };
  for (const [name, f] of Object.entries(faces)) {
    const v = armVerdict(cmp, world, f);
    ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
  }

  /* ---------- verdict + receipt ---------- */
  const verdict = fail === 0
    ? `the queue sim's own faces hold — the sbatch room's resident projection walked seat by seat: the routes warmed through the API's own door, the clean room held, the sbatch room's birth paid (W0), the tools door + the ONE item + the click summoned the dialog; the CLOSED section spoke its name, its description's contract and its two doors with no form yet; the first Run opened the form with the prefill speaking the selected profile's shape and the four NumFields printing the server's clamp contract in their own min/max attrs; the CLAMP RIDE made the response-is-truth visible at this layer too (999 in, the FORM re-rendered with the server's 64, the role=status footnote speaking); the Gantt held its t803 keyboard door, five axis ticks, one row per job == the API's distinct bar keys (two wells one world, cross-checked through the API), the pours' sr-only language and the sacct-shaped segment titles; the Compare sweep landed ${racers.length} rows progressively with exactly ONE fastest crown worn by the API race's own winner; the four export doors spoke (CSV copy + download the SAME bytes, MD twin likewise, the data-csv/data-md boundary holding the one builder's output, the 4s timer's return to rest); the Adopt ride moved the form to the crowned shape == the API's echo with no clamp and the Gantt re-ran; Escape peeled one layer; the world back bit-for-bit (${OPEN} == ${OPEN}) — pure compute leaves NOTHING; the ledger aboard from birth (five faces, the shared law)`
    : `${fail} red — the queue sim layer moved; call the census's own instruments before any UI work`;

  const driftLedger = {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    prevDate: prevReceipt?.date ?? null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces,
  };

  const receipt = {
    instrument: "scripts/t875-queue-sim-a11y.mjs",
    ruler: NAMEOF_LAW,
    build: buildId,
    worldMode: world.mode,
    date: new Date().toISOString(),
    chain: "clean room -> canvas -> host card (plain door) -> inspector -> tools door -> the ONE item -> sbatch dialog (topmost, the pre's arrival) -> the CLOSED queue-sim section's face (doors + no form) -> first Run (the form's birth, the pristine prefill == min(64, profile gpusPerNode)) -> the clamp ride (999 in, the server's 64 in the FORM, the role=status footnote) -> Gantt face (ticks 5, rows == API keys, pours + sr-only, sacct titles) -> Compare sweep (progressive n/n, ONE crown == the API race's winner) -> export doors (CSV copy/download same bytes, MD twin, data-* boundary, the 4s timer) -> Adopt ride (the crowned shape == the API echo, no clamp, the Gantt re-ran) -> Escape -> worldBack + jobs census + registry re-read + seed hygiene",
    doors: {
      inspector: "plain pointerdown+pointerup on the host card — the submitted law",
      toolsMenu: "trusted CDP click on [aria-label='More job tools'] — the t323 door-to-tools contract",
      sbatchDialog: "trusted CDP click on [data-testid='tools-sbatch-item'] — the t872 deterministic door",
      runDoor: "THE KNOCK LAW: native CDP click ONCE, the synthetic only when the arrival predicate proves the native door dead — a blind fallback re-click lands after the echo re-rendered the form and chases the server's own answer back at it (the ghost post that un-writes the clamp)",
      compareDoor: "trusted CDP click on [aria-label='Compare cluster profiles'] — same shape",
      fillDoor: "native CDP fill on [aria-label='GPUs'] — the t874 trusted-fill law (the label unique page-wide while the editor stays closed)",
      adoptDoor: "the fastest span's closest button, clicked — the crown's own row",
      exportDoors: "trusted CDP clicks on the four aria-named export buttons",
      close: "Escape — one layer per peel",
    },
    clipboard: clip,
    host: { name: host.name, id: host.id, measured: true },
    registry: { profiles: origRegistry.length, racers: racers.map((p) => ({ id: p.id, name: p.name, shape: p.gpusPerNode * p.nodes, ac: p.arrayConcurrency, spd: p.gpuSpeedup })) },
    apiRace,
    apiBest: apiBest ? apiBest.id : null,
    openingCanvas: OPEN,
    faces: {
      canvas: { live: m0 },
      queueForm: { live: n3 },
      ganttFace: { live: g1 },
      compareFace: { live: c2 },
      worldBack: { live: w1 },
    },
    checks: results,
    passed: pass,
    failed: fail,
    total: pass + fail,
    verdict,
    driftLedger,
  };
  writeFileSync(join(ROOT, "shots-qa/t875-queue-sim-a11y.json"), JSON.stringify(receipt, null, 2));

  console.log(`\nQUEUE-SIM-A11Y t875: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
  exitCode = fail === 0 ? 0 : 1;
} catch (e) {
  /* the honest stop: say why, write the red receipt — NO plants this
   * window, so the finally has nothing to restore (the sim is pure
   * compute; the registry is never touched) */
  console.error(`  ✗ the ride stopped honestly: ${String(e && e.message || e).slice(0, 160)}`);
  writeFileSync(
    join(ROOT, "shots-qa/t875-queue-sim-a11y.json"),
    JSON.stringify({
      instrument: "scripts/t875-queue-sim-a11y.mjs",
      ruler: NAMEOF_LAW,
      build: buildId,
      worldMode: world.mode,
      date: new Date().toISOString(),
      checks: results,
      passed: pass,
      failed: fail + 1,
      total: pass + fail + 1,
      verdict: `the honest stop: ${String(e && e.message || e).slice(0, 200)}`,
    }, null, 2)
  );
  exitCode = 1;
}
process.exit(exitCode);
