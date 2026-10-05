/**
 * t609 — the tally walks the row: THE COUNTED FACE ARRIVES IN READING ORDER.
 *
 * The key-numbers strip leads the Results view (t330), the inspector's
 * Overview (t347) and — as the run-receipt fallback face — a third host.
 * The counts were taken from the star at count time; the wire merely
 * delivers them, so the geometry is the receipt's own word (receipt-arrival
 * reused: +4px surfacing, 240ms, the family bezier — t606's doctrine, no
 * new keyframe). What is NEW is the chorus: the cards surface in READING
 * ORDER, each 24ms after the one before (t584's chip step), a tally being
 * taken left to right; the amber coverage footnote joins as the next line.
 * No count-up on the digits — the number is already counted, a rolling
 * digit would pretend computation the engine already did.
 *
 * Faces:
 *  G0  the source contract: the arrival hook on both strip hosts, the
 *      --kd per-card delays, the css rule + media gate, SERVED css
 *      carrying the whole arrival family (stamp + receipt + tally — the
 *      reuse contract: receipt-arrival's keyframe defined exactly once).
 *  Q   the world: 12c/13e + 12 dots, untouched, zero mints this window.
 *  W1  THE TALLY WALK: the canonical extract's Results tab (smart
 *      default), the 15ms sampler (a tighter grid for the narrow 24ms
 *      stagger) catches the row mid-flight — the first card already
 *      surfacing while the second still holds the delay's from-state
 *      (reading order as testimony), interior frames strictly between,
 *      settled with animationName STAYING receipt-arrival (fill-both's
 *      base value, the law's sixth confluence), delays 0s/0.024s, and
 *      the digits NEVER changing mid-flight (no count-up — honesty).
 *  W4  THE QUIET REFRESH: the outputs header's Refresh re-fetches — the
 *      strip keeps its DOM node and nothing replays; a re-fetch is not a
 *      new arrival, the count never left.
 *  W2  THE ROUND-TRIP: Log then Results — Radix unmounts the panel, the
 *      remount lands again, caught mid-flight a second time (every
 *      arrival deserves the same manner).
 *  W3  THE RECEIPT FACE: the refine3d's Overview — summary null, the
 *      receipt's own counted numbers (parseResultCounts: 10,866
 *      particles) lead as the fallback strip, mounted with its tab
 *      panel (the tab switch is the event), and the tally walks it the
 *      same way (data-receipt-counts as the face's identity).
 *  R   the world returned intact: dialog closed, roster 12→12, console
 *      clean, plus the shots.
 *
 * Usage: node scripts/t609-key-tally-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9328"; /* 9323 = t578, 9324 = t584/t604, 9325 = t605, 9326 = t607, 9327 = t608 */
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t609-harness-chrome-profile";
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
async function pollUntil(fn, timeoutMs = 120000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
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

/* ---- chrome boot ------------------------------------------------------- */
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
let chromeProc = null;
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

/* ---- the wire: api() with retries -------------------------------------- */
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
/* the wire can blink an empty body under dev-compile load (t604's tuition,
 * roster edition): poll until the parse LIVES, never trust one read */
const jobsOfActiveSteady = async () =>
  (await pollUntil(async () => {
    try {
      const jobs = jobsOfActive();
      return jobs.length > 0 ? jobs : null;
    } catch { return null; }
  }, 20000, 600)) ?? [];

/* ---- in-page instruments (NO line comments — eval flattens newlines) -- */

/* the tally sampler: a 15ms interval (a tighter grid than t608's 30ms —
 * the stagger window is only 24ms wide) recording EVERY stat card's
 * opacity, transform ty, animationName, computed delay and the digits'
 * text (the no-count-up honesty check rides along for free). */
const armSampler = `(function(){
  window.__t609 = { frames: [], t0: performance.now(), ticks: 0, maxGap: 0, _lt: performance.now(), on: true };
  window.__t609iv = setInterval(function(){
    if (!window.__t609 || !window.__t609.on) return;
    var now = performance.now();
    if (now - window.__t609._lt > window.__t609.maxGap) window.__t609.maxGap = Math.round(now - window.__t609._lt);
    window.__t609._lt = now;
    window.__t609.ticks++;
    var section = document.querySelector("[data-key-arrival]");
    var cards = section ? [].slice.call(section.querySelectorAll("[data-stat]")) : [];
    var arr = [];
    for (var i = 0; i < cards.length; i++) {
      var cs = getComputedStyle(cards[i]);
      var ty = 0;
      var m = /matrix\\(([^)]+)\\)/.exec(cs.transform);
      if (m) ty = Number(m[1].split(",")[5]);
      var ps = cards[i].querySelectorAll("p");
      arr.push({
        stat: cards[i].getAttribute("data-stat"),
        opacity: Number(cs.opacity),
        ty: ty,
        anim: cs.animationName,
        delay: cs.animationDelay,
        value: ps[0] ? ps[0].textContent : "",
        label: ps[1] ? ps[1].textContent : ""
      });
    }
    window.__t609.frames.push({
      t: Math.round(now - window.__t609.t0),
      n: arr.length,
      receiptFace: section ? section.getAttribute("data-receipt-counts") !== null : null,
      cards: arr
    });
  }, 15);
  return JSON.stringify({ ok: true });
})()`;

const readFrames = (lastN) => `(function(){
  var fr = (window.__t609 && window.__t609.frames) || [];
  return JSON.stringify({ n: fr.length, ticks: window.__t609 ? window.__t609.ticks : 0, maxGap: window.__t609 ? window.__t609.maxGap : 0, frames: fr.slice(-${lastN}) });
})()`;

const resetFrames = `(function(){
  if (window.__t609) { window.__t609.frames = []; window.__t609.t0 = performance.now(); }
  return JSON.stringify({ ok: true });
})()`;

const stopSampler = `(function(){
  if (window.__t609) window.__t609.on = false;
  if (window.__t609iv) { clearInterval(window.__t609iv); window.__t609iv = null; }
  return JSON.stringify({ ok: true });
})()`;

/* keep a handle on the strip (the quiet-refresh identity check) */
const grabStrip = `(function(){
  window.__t609strip = document.querySelector("[data-key-arrival]");
  return JSON.stringify({ ok: !!window.__t609strip });
})()`;
const stripSameNode = `(function(){
  var el = document.querySelector("[data-key-arrival]");
  return JSON.stringify({ same: !!(window.__t609strip && el && window.__t609strip.isSameNode(el)) });
})()`;

/* analysis (harness-side): one stat card's flight report */
function cardReport(frames, stat) {
  const present = frames.filter((f) => f.n > 0 && f.cards.some((c) => c.stat === stat));
  if (present.length === 0) return { arrived: false, reason: "no present frames" };
  const of = (f) => f.cards.find((c) => c.stat === stat);
  const first = of(present[0]);
  const last = of(present[present.length - 1]);
  const interior = present.map(of).filter((c) => c.opacity > 0 && c.opacity < 1);
  const values = [...new Set(present.map((f) => of(f).value))];
  const labels = [...new Set(present.map((f) => of(f).label))];
  const delays = [...new Set(present.map((f) => of(f).delay))];
  return {
    arrived: true,
    presentFrames: present.length,
    first: { t: present[0].t, opacity: first.opacity, ty: first.ty, anim: first.anim, delay: first.delay },
    interiorCount: interior.length,
    interiorTy: interior.map((c) => c.ty),
    settled: { t: present[present.length - 1].t, opacity: last.opacity, ty: last.ty, anim: last.anim },
    values, labels, delays,
  };
}

/* tab trigger locate + prove (t607: the switch is proven by state) */
const tabRect = (label) => `(function(){
  var host = document.querySelector("[data-inspector-dialog]");
  var tabs = host ? [].slice.call(host.querySelectorAll("[role='tab']")) : [];
  var t = tabs.find(function (el) { return (el.textContent || "").trim().indexOf("${label}") === 0; });
  if (!t) return JSON.stringify({ err: "no tab" });
  var r = t.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
})()`;
const tabSelected = (label) => `(function(){
  var host = document.querySelector("[data-inspector-dialog]");
  var tabs = host ? [].slice.call(host.querySelectorAll("[role='tab']")) : [];
  var t = tabs.find(function (el) { return (el.textContent || "").trim().indexOf("${label}") === 0; });
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
const ensureResultsTab = async () => {
  const sel = await readJson(tabSelected("Results"));
  if (sel && sel.selected === "true") return { ok: true, note: "smart default" };
  return switchToTab("Results");
};

/* the probe's card locator + viewport check */
const probeCard = (name) => `(function(){
  var el = [].slice.call(document.querySelectorAll("[data-job]")).find(function (c) { return (c.textContent || "").indexOf("${name}") >= 0; });
  if (!el) return JSON.stringify({ found: false });
  var r = el.getBoundingClientRect();
  return JSON.stringify({ found: true, x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 60), inView: r.top >= 0 && r.top < innerHeight && r.left >= 0 && r.right <= innerWidth });
})()`;

const closeInspector = async () => {
  sh(`agent-browser key Escape >/dev/null 2>&1`);
  await sleep(600);
  const closed = await readJson(`JSON.stringify(!document.querySelector("[data-inspector-dialog]"))`);
  return closed === true;
};

/* open the inspector on a canonical card: real finger when in view */
const openCardInspector = async (name) => {
  const box = await readJson(probeCard(name));
  if (box && box.found && box.inView && cdpClick(box.x, box.y, 0)) {
    const opened = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
      return n === true ? n : null;
    }, 15000, 400);
    if (opened) return true;
  }
  return false;
};

/* ---- main -------------------------------------------------------------- */
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
  const attrLive = sh(`rg -c "data-key-arrival" src/components/workflow/results/results-view.tsx || true`);
  check("the live strip carries the arrival hook", parseInt(attrLive || "0", 10) >= 1, `refs=${attrLive}`);
  const attrFallback = sh(`rg -c "data-key-arrival" src/components/workflow/job-inspector.tsx || true`);
  check("the receipt fallback strip carries the same hook", parseInt(attrFallback || "0", 10) >= 1, `refs=${attrFallback}`);
  const kd = sh(`rg -c '\\"--kd\\"' src/components/workflow/results/results-view.tsx || true`);
  check("the live strip's per-card delays (--kd card + footnote)", parseInt(kd || "0", 10) >= 2, `refs=${kd}`);
  const step = sh(`rg -c "TALLY_STEP_MS" src/components/workflow/results/results-view.tsx || true`);
  check("the tally's step is a named constant (24ms)", parseInt(step || "0", 10) >= 3, `refs=${step}`);
  const rule = sh(`rg -c "key-arrival" src/app/globals.css || true`);
  check("css: the tally rule + the media gate", parseInt(rule || "0", 10) >= 4, `refs=${rule}`);
  const kfOnce = sh(`rg -c "@keyframes receipt-arrival" src/app/globals.css || true`);
  check("css: receipt-arrival's keyframe defined EXACTLY ONCE (the reuse contract)", kfOnce.trim() === "1", `defs=${kfOnce}`);
  const kfRefs = sh(`rg -c "receipt-arrival" src/app/globals.css || true`);
  check("css: the tally's animation references the receipt's word", parseInt(kfRefs || "0", 10) >= 4, `refs=${kfRefs}`);
  const served = await readJson(`JSON.stringify((function(){
    var count = { kAttr: 0, rKf: 0, rAttr: 0, vKf: 0, vAttr: 0 };
    var walk = function (rules) {
      for (var j = 0; j < rules.length; j++) {
        var t = rules[j].cssText || "";
        if (t.indexOf("data-key-arrival") >= 0) count.kAttr++;
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
  check("SERVED css: the tally rule + gate served", served && served.kAttr >= 2, `attr=${served && served.kAttr}`);
  check("SERVED css: the receipt word + the tally's reference served", served && served.rKf >= 5, `kf=${served && served.rKf}`);
  check("SERVED css: the receipt section's own rule still served", served && served.rAttr >= 3, `attr=${served && served.rAttr}`);
  check("SERVED css: the verdict family still served (the pair intact)", served && served.vKf >= 2 && served.vAttr >= 3, `kf=${served && served.vKf}/attr=${served && served.vAttr}`);
  const servedJs = sh(`rg -l "key-arrival" .next/static/chunks .next/dev/static/chunks 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served artifacts carry the tally hook", parseInt(servedJs || "0", 10) >= 1, `js=${servedJs}`);

  /* ---- Q — the world ---------------------------------------------------- */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));
  const extract = jobsOfActive().find((j) => j.type === "extract" && j.status === "completed");
  const refine3d = jobsOfActive().find((j) => j.type === "refine3d" && j.status === "completed");
  check("canonical hosts exist (extract + refine3d, completed)", !!extract && !!refine3d,
    `${extract?.id?.slice(0, 13)} / ${refine3d?.id?.slice(0, 13)}`);

  /* ---- W1 — THE TALLY WALK ---------------------------------------------- */
  console.log(`\n[W1] the tally walk — the count surfaces in reading order`);
  check("sampler armed before the finger", (await readJson(armSampler))?.ok === true);
  const opened = await openCardInspector("extract");
  check("extract inspector opened (real click)", opened);
  const resultsTab = await ensureResultsTab();
  check("Results tab proven (aria-selected)", resultsTab.ok === true, resultsTab.note || resultsTab.why || "");

  /* poll facts, not beats (t607): the first visit after an edit re-compiles
   * the results barrel — a dead 2.2s lost to a 729ms stall once already.
   * The sampler has been recording the whole time, so whenever the strip
   * mounts, its mid-flight frames are already history. */
  const stripIn = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("[data-key-arrival]"))`);
    return v === true ? v : null;
  }, 60000, 300);
  check("the strip's arrival hook in the served DOM", stripIn === true);
  await sleep(900); /* settle slack — the frames hold the flight */
  const fr1 = await readJson(readFrames(600));
  await readJson(stopSampler);
  check("sampler lived through the arrival", fr1 && fr1.n > 100, `frames=${fr1?.n} ticks=${fr1?.ticks} maxGap=${fr1?.maxGap}ms`);
  const p1 = cardReport(fr1.frames || [], "particles");
  const m1 = cardReport(fr1.frames || [], "micrographs");
  check("both stat cards arrived", p1.arrived && m1.arrived,
    `p=${p1.presentFrames}f m=${m1.presentFrames}f`);
  check("the tally is the live-counted face (not the receipt fallback)", fr1.frames.some((f) => f.n > 0 && f.receiptFace === false),
    `receiptFace=${fr1.frames.find((f) => f.n > 0)?.receiptFace}`);
  check("first card's first sight holds the from-state (opacity ≈ 0)", p1.arrived && p1.first.opacity <= 0.1,
    `o=${p1.first?.opacity} ty=${p1.first?.ty} @t=${p1.first?.t}ms`);
  check("first card caught strictly mid-flight", p1.arrived && p1.interiorCount > 0, `interior=${p1.interiorCount} frames`);
  const p1ty = p1.arrived ? p1.interiorTy : [];
  check("mid-flight the card is still BELOW the line (ty > 0 — the receipt word's geometry)",
    p1.arrived && p1.interiorTy.some((ty) => ty > 0.05), `ty=${JSON.stringify(p1ty.slice(0, 6))}`);
  check("first card settles at the reading line, word staying receipt-arrival (fill-both, sixth confluence)",
    p1.arrived && p1.settled.opacity === 1 && Math.abs(p1.settled.ty) < 0.5 && p1.settled.anim === "receipt-arrival",
    `o=${p1.settled?.opacity} ty=${p1.settled?.ty} anim=${p1.settled?.anim}`);
  check("delays: card 0 starts now, card 1 starts 24ms later (the step)",
    p1.arrived && m1.arrived && p1.delays.join(",") === "0s" && m1.delays.join(",") === "0.024s",
    `p=[${p1.delays}] m=[${m1.delays}]`);
  check("the second card's first sight holds the delay's from-state", m1.arrived && m1.first.opacity <= 0.1,
    `o=${m1.first?.opacity}`);
  check("the digits never change mid-flight (no count-up — the count was already taken)",
    p1.arrived && m1.arrived && p1.values.join("|") === "10,866" && m1.values.join("|") === "5",
    `p=${JSON.stringify(p1.values)} m=${JSON.stringify(m1.values)}`);
  const shot1 = snap("t609-tally-settled.png");
  check("📸 the settled tally", shot1);

  /* ---- W4 — THE QUIET REFRESH ------------------------------------------- */
  console.log(`\n[W4] the quiet refresh — a re-fetch is not a new arrival`);
  await readJson(grabStrip);
  check("sampler re-armed with EMPTY frames for the refresh",
    (await readJson(resetFrames))?.ok === true && (await readJson(armSampler))?.ok === true);
  check("refresh clicked (the outputs header's own button)",
    sh(`agent-browser eval "JSON.stringify((function(){ var b = document.querySelector(\\"[role='dialog'] button[aria-label='Refresh outputs']\\"); if (!b) return \\"no-button\\"; b.click(); return \\"clicked\\"; })())" 2>/dev/null`).includes("clicked"));
  await sleep(2500);
  const same = await readJson(stripSameNode);
  const fr4 = await readJson(readFrames(200));
  check("the strip kept its DOM node through the re-fetch", same?.same === true, `same=${same?.same}`);
  const replayed = (fr4.frames || []).some((f) => f.n > 0 && f.cards.some((c) => c.opacity < 0.95));
  check("nothing replayed (the count never left)", !replayed);

  /* ---- W2 — THE ROUND-TRIP ----------------------------------------------- */
  console.log(`\n[W2] the round-trip — every arrival deserves the same manner`);
  const w2log = await switchToTab("Log");
  check("Log tab proven (aria-selected)", w2log.ok === true, w2log.why || "");
  check("sampler re-armed for the return", (await readJson(resetFrames))?.ok === true && (await readJson(armSampler))?.ok === true);
  const w2res = await switchToTab("Results");
  check("Results tab re-proven (aria-selected)", w2res.ok === true, w2res.why || "");
  await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("[data-key-arrival]"))`);
    return v === true ? v : null;
  }, 60000, 300);
  await sleep(900);
  const fr2 = await readJson(readFrames(600));
  await readJson(stopSampler);
  const p2 = cardReport(fr2.frames || [], "particles");
  check("the tally replays on the remount (interior frames again)", p2.arrived && p2.interiorCount > 0,
    `interior=${p2.interiorCount} settled anim=${p2.settled?.anim}`);
  check("the replay settles with the same word", p2.arrived && p2.settled.opacity === 1 && p2.settled.anim === "receipt-arrival",
    `o=${p2.settled?.opacity} anim=${p2.settled?.anim}`);
  /* the reading-order same-frame catch lives HERE (the warm remount): the
   * first visit's compile storm widened the sampler's real grid past the
   * 24ms step (W1's tuition — a 729ms stall swallowed the window once);
   * warm, the 15ms grid lands inside it. */
  const m2 = cardReport(fr2.frames || [], "micrographs");
  /* t613 tuition — the adjacency is witnessed on whichever PAIR the
   * hydration burst spared: every neighboring pair rides the same 24ms
   * step, so the union over the whole row is the honest contract (the
   * fixed card-0/card-1 pair starved once in seven runs). */
  const stagger2 = (fr2.frames || []).some((f) =>
    f.cards.some((c, i) => {
      const nxt = f.cards[i + 1];
      return nxt && c.opacity > 0.05 && nxt.opacity < 0.05;
    }));
  check("THE READING ORDER WITNESSED: a frame holds a card mid-flight while its next neighbor still waits",
    stagger2, `p interior=${p2.interiorCount} m first o=${m2.first?.opacity}`);

  /* leave the extract world */
  const closed1 = await closeInspector();
  check("extract inspector closed (Escape)", closed1 === true);

  /* ---- W3 — THE RECEIPT FACE --------------------------------------------- */
  console.log(`\n[W3] the receipt face — the run's own counted numbers lead the Overview`);
  const opened3 = await openCardInspector("refine3d");
  check("refine3d inspector opened (real click)", opened3);
  await sleep(800);
  check("sampler armed for the Overview switch", (await readJson(armSampler))?.ok === true);
  const w3ov = await switchToTab("Overview");
  check("Overview tab proven (aria-selected)", w3ov.ok === true, w3ov.why || "");
  await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("[data-key-arrival]"))`);
    return v === true ? v : null;
  }, 60000, 300);
  await sleep(900);
  const fr3 = await readJson(readFrames(600));
  await readJson(stopSampler);
  const p3 = cardReport(fr3.frames || [], "particles");
  check("the receipt fallback strip arrived", p3.arrived, `presentFrames=${p3.presentFrames}`);
  check("it IS the receipt face (data-receipt-counts)", fr3.frames.some((f) => f.n > 0 && f.receiptFace === true),
    `receiptFace=${fr3.frames.find((f) => f.n > 0)?.receiptFace}`);
  check("the label says where the number came from", p3.arrived && p3.labels.join("|").includes("run receipt"),
    JSON.stringify(p3.labels));
  check("the receipt tally replays the same manner (mid-flight caught)", p3.arrived && p3.interiorCount > 0,
    `interior=${p3.interiorCount}`);
  check("the receipt tally settles with the receipt's word", p3.arrived && p3.settled.opacity === 1 && p3.settled.anim === "receipt-arrival",
    `o=${p3.settled?.opacity} anim=${p3.settled?.anim}`);
  check("the digits honest here too", p3.arrived && p3.values.join("|") === "10,866", JSON.stringify(p3.values));
  const shot3 = snap("t609-receipt-tally.png");
  check("📸 the receipt face's tally", shot3);

  const closed3 = await closeInspector();
  check("refine3d inspector closed (Escape)", closed3 === true);

  /* ---- R — the world returned intact ------------------------------------- */
  console.log(`\n[R] the world returned intact`);
  await sleep(1200);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter(m => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);
  const rosterAfter = (await jobsOfActiveSteady()).length;
  check("roster untouched (zero mints this window)", rosterAfter === roster0, `${roster0}→${rosterAfter}`);
  const roster = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))"`).trim();
  check("project roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
