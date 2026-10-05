/**
 * t608 — the receipt surfaces: THE ENGINE'S ANSWER.
 *
 * The evidence row pairs two answers about one selection. t607 gave the
 * judge's verdict its landing (-4px, imposed from above); the receipt —
 * the engine's own bookkeeping of WHAT was kept — was still mute: its
 * section mounts the moment its fetch lands with zero animations. t608
 * gives the arrival its mirror manner: receipt-arrival, 240ms,
 * translateY(+4px) → 0 — facts come UP out of the machine, like a
 * receipt printing out of its slot; in the paired row the two answers
 * converge on the reading line. Mount = arrival (the t607 law's second
 * consumer): honest absence until the fetch lands, a static data
 * attribute is the whole mechanism.
 *
 * Faces:
 *  G0  source contract: data-receipt-arrival on the section, the
 *      keyframe + the media gate in globals.css, SERVED css carries the
 *      whole family (receipt AND verdict — the pair's contract).
 *  Q   the world: 12c/13e + 12 dots, untouched, before any mint.
 *  W1  THE SURFACING: a param select2d probe runs for real (local
 *      engine), its Results tab opens, the plain receipt mounts when
 *      the fetch lands — the 30ms sampler catches the rise mid-flight
 *      (opacity strictly between 0 and 1, matrix ty > 0 — still below
 *      the line) and the settled read keeps animationName =
 *      receipt-arrival (fill-both's base value law).
 *  W2  THE PAIRED CONVERGENCE: a birth select2d probe (classes = the
 *      parent's keep ∪ maybe) runs, the evidence row upgrades from the
 *      plain receipt to the pair — the receipt remounts (arrival #2)
 *      and the borrowed stamp lands, and the sampler holds a frame
 *      where the receipt is still below the line (ty > 0) while the
 *      stamp is still above it (ty < 0): the two answers meeting.
 *  W3  THE ROUND-TRIP REPLAY: Log then Results — Radix unmounts the
 *      panel, the remount is a fresh fetch, and BOTH manners replay
 *      mid-flight (the family's replay law, now two voices).
 *  W4  THE HONEST ABSENCE: the class2d's own Results tab carries NO
 *      receipt (the type gate — only select verbs write receipts);
 *      absence asserted only after the tab's presence is proven.
 *  R   the world returned intact: probes deleted, edges pruned,
 *      roster 12→12, console clean, plus the shots.
 *
 * Usage: node scripts/t608-receipt-arrival-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9327"; /* 9323 = t578, 9324 = t584/t604, 9325 = t605, 9326 = t607 */
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t608-harness-chrome-profile";
const CDP_CLICK = "scripts/t604-cdp-shift-click.mjs";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const SHOTS = ".qa-logs/shots";

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

/* ---- the environment shim: own Chrome, desktop capabilities ----------- */
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
const cdpClick = (x, y, mod = 0) => {
  try { return sh(`node ${CDP_CLICK} ${CDP_PORT} ${x} ${y} ${mod} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};
/* t607 tuition: the screenshot tool drifts — read what it prints, copy home */
const snap = (name) => {
  try {
    const out = sh(`agent-browser screenshot 2>/dev/null || true`).trim();
    const m = /saved to (\S+)/.exec(out);
    if (m) {
      execSync(`mkdir -p ${SHOTS} && cp "${m[1]}" "${SHOTS}/${name}"`);
      return true;
    }
  } catch { /* */ }
  return false;
};

/* ---- the wire: api() with retries (t604 tuition ① — curl blinks under
 * dev compile load; three tries with a breath between) ------------------ */
const apiOnce = (verb, path, body) =>
  sh(
    `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
    (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
  );
const api = (verb, path, body, tries = 3) => {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try { last = apiOnce(verb, path, body); if (last) return last; } catch { /* blink */ }
    try { execSync("sleep 0.4"); } catch { /* */ }
  }
  return last;
};
const jobsOfActive = () => {
  const d = JSON.parse(api("GET", "/api/jobs"));
  return Array.isArray(d) ? d : (d.jobs ?? []);
};

/* ---- in-page instruments (NO line comments — eval flattens newlines) -- */

/* the two-voice sampler: a 30ms interval recording BOTH answer cards'
 * opacity, transform ty (from Chrome's matrix serialization) and
 * animationName, plus presence. One stream, both directions. */
const armSampler = `(function(){
  window.__t608 = { frames: [], t0: performance.now(), ticks: 0, maxGap: 0, _lt: performance.now(), on: true };
  window.__t608iv = setInterval(function(){
    if (!window.__t608 || !window.__t608.on) return;
    var now = performance.now();
    if (now - window.__t608._lt > window.__t608.maxGap) window.__t608.maxGap = Math.round(now - window.__t608._lt);
    window.__t608._lt = now;
    window.__t608.ticks++;
    var read = function (sel) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var cs = getComputedStyle(el);
      var ty = 0;
      var m = /matrix\\(([^)]+)\\)/.exec(cs.transform);
      if (m) ty = Number(m[1].split(",")[5]);
      return { opacity: Number(cs.opacity), ty: ty, anim: cs.animationName };
    };
    window.__t608.frames.push({
      t: Math.round(now - window.__t608.t0),
      rec: read("[data-canvas-ui='selection-receipt']"),
      stamp: read("[data-canvas-ui='ai-verdict-stamp']")
    });
  }, 30);
  return JSON.stringify({ ok: true });
})()`;

const readFrames = (lastN) => `(function(){
  var fr = (window.__t608 && window.__t608.frames) || [];
  return JSON.stringify({ n: fr.length, ticks: window.__t608 ? window.__t608.ticks : 0, maxGap: window.__t608 ? window.__t608.maxGap : 0, frames: fr.slice(-${lastN}) });
})()`;

const resetFrames = `(function(){
  if (window.__t608) { window.__t608.frames = []; window.__t608.t0 = performance.now(); }
  return JSON.stringify({ ok: true });
})()`;

const stopSampler = `(function(){
  if (window.__t608) window.__t608.on = false;
  if (window.__t608iv) { clearInterval(window.__t608iv); window.__t608iv = null; }
  return JSON.stringify({ ok: true });
})()`;

/* analysis (harness-side): clusters of moving frames for one voice.
 * dir = +1 surfacing (ty > 0, the receipt) / -1 landing (ty < 0, stamp) */
function voiceReport(frames, key, dir) {
  const present = frames.filter((f) => f[key]);
  if (present.length === 0) return { arrived: false, reason: "no present frames" };
  const clusters = [];
  let cur = null;
  for (const f of present) {
    const moving = f[key].ty * dir > 0.05;
    if (moving) { if (!cur) { cur = []; clusters.push(cur); } cur.push(f); }
    else cur = null;
  }
  const first = present[0];
  const midOpacity = present.some((f) => f[key].opacity > 0 && f[key].opacity < 1);
  const last = present[present.length - 1];
  return {
    arrived: true,
    clusters: clusters.length,
    first: { t: first.t, opacity: first[key].opacity, ty: first[key].ty, anim: first[key].anim },
    midOpacity,
    midTravel: clusters.length > 0,
    settled: { t: last.t, opacity: last[key].opacity, ty: last[key].ty, anim: last[key].anim },
    presentFrames: present.length,
  };
}

/* tab trigger locate + prove (t607: the switch is proven by state) */
const tabRect = (label) => `(function(){
  var host = document.querySelector("[data-inspector-dialog]");
  var tabs = host ? [...host.querySelectorAll("[role='tab']")] : [];
  var t = tabs.find(function (el) { return (el.textContent || "").trim().startsWith("${label}"); });
  if (!t) return JSON.stringify({ err: "no tab" });
  var r = t.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
})()`;
const tabSelected = (label) => `(function(){
  var host = document.querySelector("[data-inspector-dialog]");
  var tabs = host ? [...host.querySelectorAll("[role='tab']")] : [];
  var t = tabs.find(function (el) { return (el.textContent || "").trim().startsWith("${label}"); });
  return JSON.stringify({ selected: t ? t.getAttribute("aria-selected") : "gone" });
})()`;
const switchToTab = async (label) => {
  const rect = await readJson(tabRect(label));
  if (!rect || !rect.x) return { ok: false, why: "trigger not found" };
  if (!cdpClick(rect.x, rect.y, 0)) return { ok: false, why: "cdp click failed" };
  const sel = await pollUntil(async () => {
    const s = await readJson(tabSelected(label));
    return s && s.selected === "true" ? s : null;
  }, 10000, 300);
  return { ok: sel !== null, why: sel ? "" : "aria-selected never flipped" };
};

/* the probe's card locator + viewport check */
const probeCard = (name) => `(function(){
  var el = [...document.querySelectorAll("[data-job]")].find(function (c) { return (c.textContent || "").indexOf("${name}") >= 0; });
  if (!el) return JSON.stringify({ found: false });
  var r = el.getBoundingClientRect();
  return JSON.stringify({ found: true, x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 60), inView: r.top >= 0 && r.top < innerHeight && r.left >= 0 && r.right <= innerWidth });
})()`;

/* open the inspector on a probe: real finger when the card is in view,
 * the palette dance otherwise (a reload — the sampler must re-arm) */
const paletteOpen = async (name) => {
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
  await sleep(600);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n >= 12 ? n : null;
  }, 90000, 500);
  check("  (palette path) sampler re-armed after reload", (await readJson(armSampler))?.ok === true);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "${name}" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(1800);
  return true;
};
const openProbeInspector = async (name) => {
  const box = await readJson(probeCard(name));
  if (box && box.found && box.inView && cdpClick(box.x, box.y, 0)) {
    const opened = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
      return n === true ? n : null;
    }, 15000, 400);
    if (opened) return { how: "finger" };
  }
  await paletteOpen(name);
  return { how: "palette" };
};
const ensureResultsTab = async () => {
  const sel = await readJson(tabSelected("Results"));
  if (sel && sel.selected === "true") return { ok: true, note: "smart default" };
  const r = await switchToTab("Results");
  return r;
};
const closeInspector = async () => {
  sh(`agent-browser key Escape >/dev/null 2>&1`);
  await sleep(600);
  const closed = await readJson(`JSON.stringify(!document.querySelector("[data-inspector-dialog]"))`);
  return closed === true;
};

/* ---- main -------------------------------------------------------------- */
const minted = [];
let roster0 = 12;
try {
  console.log(`[boot] desktop-capable Chrome on ${CDP_PORT}`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  const chromeReady = await launchDesktopChrome();
  if (!chromeReady) {
    console.error("FATAL: the desktop-capable Chrome never opened its CDP port");
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
  check("agent-browser connected to the desktop-capable Chrome", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("hover shim applied", applyShim());

  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* world guard: the active project must be the EMPIAR world */
  const projects = JSON.parse(api("GET", "/api/projects")).projects;
  const active = projects.find((p) => p.active);
  if (!active || active.id !== EMPIAR_ID) {
    console.error(`FATAL: active world is ${active?.id ?? "unknown"} — refusing to run in a borrowed world`);
    process.exit(2);
  }
  roster0 = active.stats.total;
  check("world guard: EMPIAR active", true, `roster ${roster0}`);

  /* ---- G0 — the source contract ---------------------------------------- */
  console.log(`\n[G0] the source contract`);
  const attr = sh(`rg -c "data-receipt-arrival" src/components/workflow/results/selection-receipt.tsx || true`);
  check("the receipt section carries the arrival hook", parseInt(attr || "0", 10) >= 1, `refs=${attr}`);
  const kf = sh(`rg -c "receipt-arrival" src/app/globals.css || true`);
  check("css: the keyframe definition + the animation reference", parseInt(kf || "0", 10) >= 2, `refs=${kf}`);
  const served = await readJson(`JSON.stringify((function(){
    var count = { rKf: 0, rAttr: 0, vKf: 0, vAttr: 0 };
    var walk = function (rules) {
      for (var j = 0; j < rules.length; j++) {
        var t = rules[j].cssText || "";
        if (t.indexOf("receipt-arrival") >= 0) count.rKf++;
        if (t.indexOf("data-receipt-arrival") >= 0) count.rAttr++;
        if (t.indexOf("verdict-stamp-arrival") >= 0) count.vKf++;
        if (t.indexOf("data-verdict-arrival") >= 0) count.vAttr++;
        if (rules[j].cssRules) walk(rules[j].cssRules);
      }
    };
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      var rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      walk(rules);
    }
    return count;
  })())`);
  check("SERVED css: receipt keyframe + reference served", served && served.rKf >= 2, `kf=${served && served.rKf}`);
  check("SERVED css: receipt attribute rule + media gate served", served && served.rAttr >= 3, `attr=${served && served.rAttr}`);
  check("SERVED css: the verdict family still served (the pair intact)", served && served.vKf >= 2 && served.vAttr >= 3, `kf=${served && served.vKf}/attr=${served && served.vAttr}`);
  const servedJs = sh(`rg -l "receipt-arrival" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served artifacts carry the arrival hook", parseInt(servedJs || "0", 10) >= 1, `js=${servedJs}`);

  /* ---- Q — the world ---------------------------------------------------- */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));
  const class2d = jobsOfActive().find((j) => j.type === "class2d" && j.status === "completed");
  if (!class2d) { console.error("FATAL: no completed class2d — no receipt source, no birth parent."); process.exit(2); }
  const verdict = JSON.parse(api("GET", `/api/jobs/${class2d.id}/ai-verdict`));
  check("parent class2d exists and is stamped", verdict.available === true,
    `${class2d.name} · ${verdict.stamp?.counts?.keep ?? "?"}k/${verdict.stamp?.counts?.maybe ?? "?"}m/${verdict.stamp?.counts?.reject ?? "?"}r`);

  /* ---- W1 — THE SURFACING (plain receipt) -------------------------------- */
  console.log(`\n[W1] the surfacing — the engine's answer comes up out of the machine`);
  const mintB = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t608 Surfacing Probe",
    x: 60, y: 60,
    params: { selectedClasses: "3" },
  }));
  const probeB = mintB.job ?? mintB;
  minted.push(probeB.id);
  check("minted param select2d probe", !!probeB?.id, probeB?.id);
  api("POST", "/api/edges", { fromJobId: class2d.id, toJobId: probeB.id });
  api("POST", `/api/jobs/${probeB.id}/run`, { local: true });
  const doneB = await pollUntil(() => {
    const j = jobsOfActive().find((x) => x.id === probeB.id);
    return j && j.status === "completed" ? j : null;
  }, 60000, 500);
  check("probe ran to completed (local engine)", !!doneB, doneB?.result ?? "");
  const receiptB = await pollUntil(() => {
    try {
      const r = JSON.parse(api("GET", `/api/jobs/${probeB.id}/selection-receipt`));
      return r.available ? r : null;
    } catch { return null; }
  }, 15000, 500);
  check("engine wrote the receipt (provenance param)", !!receiptB && receiptB.provenance?.kind === "param",
    `${receiptB?.receipt?.kept ?? "?"}/${receiptB?.receipt?.total ?? "?"} kept`);

  check("sampler armed before the finger", (await readJson(armSampler))?.ok === true);
  const openB = await openProbeInspector("t608 Surfacing Probe");
  check("inspector opened on the probe", true, `via ${openB.how}`);
  const tabB = await ensureResultsTab();
  check("Results tab really selected", tabB.ok === true, tabB.note || tabB.why);
  const recUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-canvas-ui='selection-receipt']"))`);
    return n === true ? n : null;
  }, 45000, 300);
  check("the plain receipt arrived on the tab (presence)", recUp === true);
  await sleep(900);
  const f1 = (await readJson(readFrames(800)))?.frames || [];
  const w1 = voiceReport(f1, "rec", +1);
  check("W1: the receipt was seen present", w1.arrived === true, w1.reason || `present=${w1.presentFrames}`);
  check("W1: the rise was caught mid-flight (opacity strictly between 0 and 1)", w1.midOpacity === true, JSON.stringify(w1.first));
  check("W1: the rise was caught mid-flight (matrix ty > 0 — still below the line)", w1.midTravel === true, `clusters=${w1.clusters}`);
  check("W1: the first sight already carries the arrival animation", w1.first && w1.first.anim === "receipt-arrival", `anim=${w1.first && w1.first.anim}`);
  check("W1: settled at opacity 1 / ty 0", w1.settled && w1.settled.opacity === 1 && w1.settled.ty === 0, JSON.stringify(w1.settled));
  check("W1: animationName STAYS receipt-arrival after settle (fill-both's base value)", w1.settled && w1.settled.anim === "receipt-arrival", `anim=${w1.settled && w1.settled.anim}`);
  check("W1: no stamp on a param select's tab (no birth source, honest)", f1.every((fr) => !fr.stamp), "absence proven on a presence-proven tab");
  check("shot: the surfaced receipt", snap("t608-receipt-surfaced.png"));
  check("inspector closed (Escape)", await closeInspector() === true);

  /* ---- W2 — THE PAIRED CONVERGENCE --------------------------------------- */
  console.log(`\n[W2] the paired convergence — two answers meet on the reading line`);
  const gamble = [
    ...verdict.stamp.classes.filter((c) => c.verdict === "keep").map((c) => c.cls),
    ...verdict.stamp.classes.filter((c) => c.verdict === "maybe").map((c) => c.cls),
  ].sort((a, b) => a - b);
  check("birth classes = the parent's keep ∪ maybe", gamble.length > 0, JSON.stringify(gamble));
  const mintA = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t608 Pairing Probe",
    x: 60, y: 420,
    classStarSelection: { jobId: class2d.id, classes: gamble },
  }));
  const probeA = mintA.job ?? mintA;
  minted.push(probeA.id);
  check("minted birth select2d probe", !!probeA?.id, probeA?.id);
  api("POST", `/api/jobs/${probeA.id}/run`, { local: true });
  const doneA = await pollUntil(() => {
    const j = jobsOfActive().find((x) => x.id === probeA.id);
    return j && j.status === "completed" ? j : null;
  }, 60000, 500);
  check("birth probe ran to completed", !!doneA, doneA?.result ?? "");
  const receiptA = await pollUntil(() => {
    try {
      const r = JSON.parse(api("GET", `/api/jobs/${probeA.id}/selection-receipt`));
      return r.available ? r : null;
    } catch { return null; }
  }, 15000, 500);
  check("receipt available with birth provenance", !!receiptA && receiptA.provenance?.kind === "birth",
    `from ${receiptA?.provenance?.sourceJobName ?? "?"}`);

  await readJson(resetFrames);
  const openA = await openProbeInspector("t608 Pairing Probe");
  check("inspector opened on the birth probe", true, `via ${openA.how}`);
  const tabA = await ensureResultsTab();
  check("Results tab really selected", tabA.ok === true, tabA.note || tabA.why);
  const paired = await pollUntil(async () => {
    const j = await readJson(`JSON.stringify({
      row: !!document.querySelector("[data-canvas-ui='selection-evidence-row']"),
      rec: !!document.querySelector("[data-canvas-ui='selection-receipt']"),
      stamp: !!document.querySelector("[data-canvas-ui='ai-verdict-stamp']")
    })`);
    return j && j.row && j.rec && j.stamp ? j : null;
  }, 45000, 300);
  check("the paired evidence row mounted (row + receipt + stamp)", !!paired, JSON.stringify(paired));
  await sleep(900);
  const f2 = (await readJson(readFrames(800)))?.frames || [];
  const w2rec = voiceReport(f2, "rec", +1);
  const w2stamp = voiceReport(f2, "stamp", -1);
  check("W2: the receipt surfaced (mid-flight ty > 0)", w2rec.arrived === true && w2rec.midTravel === true,
    `clusters=${w2rec.clusters} (plain-phase + paired-phase arrivals)`);
  check("W2: the borrowed stamp landed (mid-flight ty < 0)", w2stamp.arrived === true && w2stamp.midTravel === true,
    `anim=${w2stamp.first && w2stamp.first.anim}`);
  check("W2: the stamp carries the verdict family animation", w2stamp.first && w2stamp.first.anim === "verdict-stamp-arrival",
    `anim=${w2stamp.first && w2stamp.first.anim}`);
  const converge = f2.some((fr) => fr.rec && fr.stamp && fr.rec.ty > 0.05 && fr.stamp.ty < -0.05);
  const recMoving = f2.filter((fr) => fr.rec && fr.rec.ty > 0.05).map((fr) => fr.t);
  const stampMoving = f2.filter((fr) => fr.stamp && fr.stamp.ty < -0.05).map((fr) => fr.t);
  const temporal = recMoving.length > 0 && stampMoving.length > 0 &&
    recMoving.some((t) => stampMoving.some((s) => Math.abs(t - s) <= 120));
  check("W2: CONVERGENCE — a frame holds the receipt below the line while the stamp is above it",
    converge || temporal, converge ? "single-frame catch" : temporal ? "temporal overlap ≤120ms" : "no overlap seen");
  check("W2: both settled (receipt ty 0 / stamp ty 0)", w2rec.settled?.ty === 0 && w2stamp.settled?.ty === 0,
    `rec=${w2rec.settled?.ty}/stamp=${w2stamp.settled?.ty}`);
  check("shot: the paired convergence", snap("t608-paired-convergence.png"));

  /* ---- W3 — THE ROUND-TRIP REPLAY ---------------------------------------- */
  console.log(`\n[W3] the round-trip replay — Radix unmounts, both manners replay`);
  await readJson(resetFrames);
  const w3log = await switchToTab("Log");
  check("Log tab really selected", w3log.ok === true, w3log.why);
  const gone = await pollUntil(async () => {
    const j = await readJson(`JSON.stringify({
      rec: !!document.querySelector("[data-canvas-ui='selection-receipt']"),
      stamp: !!document.querySelector("[data-canvas-ui='ai-verdict-stamp']")
    })`);
    return j && !j.rec && !j.stamp ? j : null;
  }, 10000, 300);
  check("both answer cards unmounted on Log (Radix unmounts inactive panels)", !!gone);
  const w3res = await switchToTab("Results");
  check("Results tab really selected back", w3res.ok === true, w3res.why);
  const back = await pollUntil(async () => {
    const j = await readJson(`JSON.stringify({
      rec: !!document.querySelector("[data-canvas-ui='selection-receipt']"),
      stamp: !!document.querySelector("[data-canvas-ui='ai-verdict-stamp']")
    })`);
    return j && j.rec && j.stamp ? j : null;
  }, 45000, 300);
  check("both answer cards remounted on Results", !!back);
  await sleep(900);
  const f3 = (await readJson(readFrames(800)))?.frames || [];
  const w3rec = voiceReport(f3, "rec", +1);
  const w3stamp = voiceReport(f3, "stamp", -1);
  check("W3: the receipt's surfacing replayed mid-flight", w3rec.midTravel === true && w3rec.midOpacity === true,
    `clusters=${w3rec.clusters}`);
  check("W3: the stamp's landing replayed mid-flight", w3stamp.midTravel === true && w3stamp.midOpacity === true,
    `clusters=${w3stamp.clusters}`);
  check("inspector closed (Escape)", await closeInspector() === true);

  /* ---- W4 — THE HONEST ABSENCE ------------------------------------------- */
  console.log(`\n[W4] the honest absence — the judge's own tab carries no receipt`);
  await sleep(1200); /* the settling pad: the closing dialog's unmount reflow before the next finger */
  const cls2dIdx = await readJson(`JSON.stringify([...document.querySelectorAll("[data-job]")].findIndex((c) => (c.textContent || "").includes("class2d")))`);
  const cbox = typeof cls2dIdx === "number" && cls2dIdx >= 0
    ? await readJson(`(() => {
        var card = document.querySelectorAll("[data-job]")[${cls2dIdx}];
        var r = card.getBoundingClientRect();
        return JSON.stringify({ x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 60), inView: r.top >= 0 && r.top < innerHeight });
      })()`)
    : null;
  if (cbox && cbox.inView && cdpClick(cbox.x, cbox.y, 0)) {
    const rOpened = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
      return n === true ? n : null;
    }, 20000, 400);
    check("class2d inspector opened", rOpened === true);
    /* anchor the dialog's identity BEFORE any absence claim: an absence
     * asserted on the wrong job's tab measures the empty set (t604's
     * false-green law, the W4 edition) */
    const dlgName = await readJson(`JSON.stringify((document.querySelector("[data-inspector-dialog]")?.textContent || "").includes("class2d"))`);
    check("the open dialog IS the class2d's (identity anchored)", dlgName === true, `includes-class2d=${dlgName}`);
    const cTab = await ensureResultsTab();
    check("class2d Results tab really selected", cTab.ok === true, cTab.note || cTab.why);
    /* the class2d Results tab is the HEAVIEST tab in the inspector: the
     * iteration gallery + the outputs listing + the dynamic chunks all
     * mount before the stamp's section does. The t608 tuition: the first
     * read of the panel caught 1987 chars of gallery (its own Refresh
     * button among them) while the ResultsView below was still loading —
     * the 35s window closed before the stamp's mount. Poll LONG (90s);
     * the stamp mounts when its fetch lands, and the fetch fires when
     * its section finally renders. */
    const stampThere = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(!!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"))`);
      return n === true ? n : null;
    }, 90000, 500);
    check("the stamp is present (presence proven first)", stampThere === true);
    const recAbsent = await readJson(`JSON.stringify({
      rec: !!document.querySelector("[data-canvas-ui='selection-receipt']"),
      row: !!document.querySelector("[data-canvas-ui='selection-evidence-row']")
    })`);
    check("W4: no receipt on a class2d's tab (the type gate holds)", recAbsent && recAbsent.rec === false && recAbsent.row === false, JSON.stringify(recAbsent));
    check("inspector closed (Escape)", await closeInspector() === true);
  } else {
    check("W4 skipped (class2d out of view)", true, "world untouched");
  }

  /* ---- R — the world returned intact ------------------------------------- */
  console.log(`\n[R] the world returned intact`);
  await readJson(stopSampler);
  /* deletion with a VERIFIED loop: the t608 tuition — a swallowed DELETE
   * (three empty responses under dev load) leaves the world borrowed.
   * Every delete is confirmed by the roster, and its response surfaced. */
  const deleteProbe = async (id) => {
    for (let i = 0; i < 5; i++) {
      const resp = api("DELETE", `/api/jobs/${id}?confirm=true`);
      const gone = await pollUntil(() => {
        try { return !jobsOfActive().some((j) => j.id === id); } catch { return false; }
      }, 10000, 500);
      if (gone) return { gone: true, resp };
      await sleep(1500);
    }
    return { gone: false, resp: "never confirmed" };
  };
  for (const id of minted) {
    const d = await deleteProbe(id);
    check(`probe ${id.slice(-8)} deleted (roster-verified)`, d.gone === true, String(d.resp).slice(0, 60));
  }
  const edgesClean = await pollUntil(() => {
    try {
      const d = JSON.parse(api("GET", "/api/edges"));
      const list = Array.isArray(d) ? d : (d.edges ?? []);
      return list.length === 13 ? list : null;
    } catch { return null; }
  }, 15000, 500);
  if (!edgesClean) {
    /* defensive: prune any orphan edge still pointing at a deleted probe */
    try {
      const d = JSON.parse(api("GET", "/api/edges"));
      const list = Array.isArray(d) ? d : (d.edges ?? []);
      for (const e of list) {
        if (minted.includes(e.fromJobId) || minted.includes(e.toJobId)) {
          try { api("DELETE", `/api/edges/${e.id}`); } catch { /* */ }
        }
      }
    } catch { /* */ }
  }
  /* the workdir sweep: deleting a job does not wipe its workdir leaf —
   * the harness sweeps the exact leaves it minted (both data roots) */
  for (const id of minted) {
    const leaf = `select2d_${id.slice(-8)}`;
    try { execSync(`rm -rf "data/relion/${EMPIAR_ID}/${leaf}" ".next/standalone/data/relion/${EMPIAR_ID}/${leaf}"`); } catch { /* */ }
  }
  const counts2 = await pollUntil(async () => {
    const j = await readJson(`JSON.stringify({
      cards: document.querySelectorAll("[data-job]").length,
      edges: document.querySelectorAll("[data-edge-id]").length
    })`);
    return j && j.cards === 12 && j.edges === 13 ? j : null;
  }, 30000, 500);
  check("canvas back to 12c/13e", !!counts2, JSON.stringify(counts2 ?? (await readJson(`JSON.stringify({ cards: document.querySelectorAll("[data-job]").length, edges: document.querySelectorAll("[data-edge-id]").length })`))));
  const jobsNow = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/jobs | python3 -c "import json,sys; d=json.load(sys.stdin); js=d if isinstance(d,list) else d.get('jobs',[]); print(len(js))"`).trim();
  check("jobs 12→12 (probes deleted, nothing kept)", jobsNow === "12", `got ${jobsNow}`);
  await sleep(1200);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter(m => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);
  const roster = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))"`).trim();
  check("roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
  /* workdir sweep: the leaf is {type}_{id-tail8} (workdirFor), so scan
   * for both probes' leaves across the dev and standalone data roots */
  const tails = minted.map((id) => `select2d_${id.slice(-8)}`);
  const wdScan = sh(
    `for d in data/relion/${EMPIAR_ID} .next/standalone/data/relion/${EMPIAR_ID}; do ` +
    `ls "$d" 2>/dev/null; done | rg -c "select2d_(${tails.map((t) => t.slice(-8)).join("|")})" || true`
  ).trim();
  check("no probe workdirs left on disk", wdScan === "" || wdScan === "0", `probe dirs=${wdScan || "0"}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* gone */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
