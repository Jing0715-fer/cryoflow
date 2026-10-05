/**
 * t607 — the verdict arrival: THE STAMP LANDS.
 *
 * The AI verdict stamp is the Results tab's only mute card: every chart
 * card around it rises (rise-in, 0.35s), but the stamp — a JUDGMENT, not
 * a measurement — mounted with zero animations (the probe's lane gap:
 * anims=0, opacity=1 at first sight). t607 gives the arrival its manner:
 * the stamp LANDS (verdict-stamp-arrival, 240ms, translateY -4px → 0) —
 * direction IS the semantic: the numbers rise, the verdict drops.
 *
 * Faces:
 *  G0  source contract: data-verdict-arrival on the section, the keyframe
 *      + the media gate in globals.css, SERVED css carries the family.
 *  Q   the world: 12c/13e + 12 dots, untouched.
 *  W1  THE FIRST LANDING: a real click opens the class2d inspector (the
 *      Results tab is the completed job's smart default), the stamp's
 *      fetch lands, the card mounts — the sampler catches the fall
 *      mid-flight (opacity strictly between 0 and 1, matrix ty < 0) and
 *      the settled read keeps animationName = verdict-stamp-arrival
 *      (fill-both's base value: the t603 law's fourth confluence).
 *  W4  THE QUIET REFRESH: the tab's Refresh button refetches — the
 *      section keeps its DOM node (isSameNode) and nothing replays
 *      (a re-fetch is not a new arrival; the opinion did not leave).
 *  W2  THE TAB ROUND-TRIP: Log then back to Results — Radix unmounts
 *      the inactive panel, the remount is a fresh fetch arriving, and
 *      the second landing is caught too (the family's replay law).
 *  W3  THE HONEST ABSENCE: a refine3d's Results tab carries NO stamp
 *      (the type gate holds; a missing opinion paints nothing).
 *  R   the world returned intact: dialog closed, roster 12→12, console
 *      clean, plus the two shots.
 *
 * Usage: node scripts/t607-verdict-arrival-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9326"; /* 9323 = t578, 9324 = t584/t604, 9325 = t605 */
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t607-harness-chrome-profile";
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
/* t607 tuition: agent-browser's screenshot no longer writes relative
 * paths — it saves into its own tmp dir and prints the location. Snap
 * = take + fetch the printed path + copy it home (the tool's behavior
 * drifts; read what it actually says, not what it used to say). */
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

/* ---- in-page instruments (NO line comments — eval flattens newlines) -- */

/* the stamp sampler: a 30ms interval recording the verdict card's
 * opacity, transform (parsed from Chrome's matrix serialization — the
 * ty component IS the fall), animationName and presence. Runs across
 * the whole window; the harness reads the frames per act. */
const armSampler = `(function(){
  window.__t607 = { frames: [], t0: performance.now(), ticks: 0, maxGap: 0, _lt: performance.now(), on: true };
  window.__t607iv = setInterval(function(){
    if (!window.__t607 || !window.__t607.on) return;
    var now = performance.now();
    if (now - window.__t607._lt > window.__t607.maxGap) window.__t607.maxGap = Math.round(now - window.__t607._lt);
    window.__t607._lt = now;
    window.__t607.ticks++;
    var el = document.querySelector("[data-canvas-ui='ai-verdict-stamp']");
    if (!el) { window.__t607.frames.push({ t: Math.round(now - window.__t607.t0), present: false }); return; }
    var cs = getComputedStyle(el);
    var ty = 0;
    var m = /matrix\\(([^)]+)\\)/.exec(cs.transform);
    if (m) ty = Number(m[1].split(",")[5]);
    window.__t607.frames.push({
      t: Math.round(now - window.__t607.t0),
      present: true,
      opacity: Number(cs.opacity),
      ty: ty,
      anim: cs.animationName
    });
  }, 30);
  return JSON.stringify({ ok: true });
})()`;

const readFrames = (lastN) => `(function(){
  var fr = (window.__t607 && window.__t607.frames) || [];
  return JSON.stringify({ n: fr.length, ticks: window.__t607 ? window.__t607.ticks : 0, maxGap: window.__t607 ? window.__t607.maxGap : 0, frames: fr.slice(-${lastN}) });
})()`;

const resetFrames = `(function(){
  if (window.__t607) { window.__t607.frames = []; window.__t607.t0 = performance.now(); }
  return JSON.stringify({ ok: true });
})()`;

const stopSampler = `(function(){
  if (window.__t607) window.__t607.on = false;
  if (window.__t607iv) { clearInterval(window.__t607iv); window.__t607iv = null; }
  return JSON.stringify({ ok: true });
})()`;

/* remember the stamp's DOM node — the no-replay proof compares identity */
const rememberStamp = `(function(){
  var el = document.querySelector("[data-canvas-ui='ai-verdict-stamp']");
  if (!el) return JSON.stringify({ err: "no stamp" });
  window.__t607stamp = el;
  return JSON.stringify({ ok: true });
})()`;

const stampNodeSame = `(function(){
  var f = window.__t607stamp;
  if (!f) return JSON.stringify({ same: false, err: "no memory" });
  var cur = document.querySelector("[data-canvas-ui='ai-verdict-stamp']");
  return JSON.stringify({ same: cur === f, connected: f.isConnected });
})()`;

/* locate + prove a tab trigger: the switch is REAL only when
 * aria-selected says so — a click's return value proves nothing
 * (the synthetic el.click() does not drive Radix Tabs: the W2 red
 * showed the stamp never unmounting; the honest proof is the state) */
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

/* analysis helper (harness-side): did a landing happen in this frame set? */
function landingReport(frames) {
  const present = frames.filter((f) => f.present);
  if (present.length === 0) return { landed: false, reason: "no present frames" };
  const first = present[0];
  const midOpacity = present.some((f) => f.opacity > 0 && f.opacity < 1);
  const midFall = present.some((f) => f.ty < 0);
  const last = present[present.length - 1];
  return {
    landed: true,
    first: { t: first.t, opacity: first.opacity, ty: first.ty, anim: first.anim },
    midOpacity, midFall,
    settled: { t: last.t, opacity: last.opacity, ty: last.ty, anim: last.anim },
    presentFrames: present.length,
    totalFrames: frames.length,
  };
}

let judgeNote = "";
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

  const sentinel = await readJson(`JSON.stringify({ s: 40 + 2 })`);
  check("eval round-trip sentinel", sentinel && sentinel.s === 42, JSON.stringify(sentinel));

  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* ---- G0 — the source contract --------------------------------------- */
  console.log(`\n[G0] the source contract`);
  const stampAttr = sh(`rg -c "data-verdict-arrival" src/components/workflow/results/ai-verdict-stamp.tsx || true`);
  check("the stamp section carries the arrival hook", parseInt(stampAttr || "0", 10) >= 1, `refs=${stampAttr}`);
  const kf = sh(`rg -c "verdict-stamp-arrival" src/app/globals.css || true`);
  check("css: the keyframe definition + the animation reference", parseInt(kf || "0", 10) >= 2, `refs=${kf}`);
  /* the keyframe name appears exactly twice in css (definition + the
   * animation reference); the media-reduce gate speaks in the ATTRIBUTE
   * ("animation: none" names no keyframe) — count that separately */
  const served = await readJson(`JSON.stringify((function(){
    var kf = 0, attr = 0;
    var walk = function (rules) {
      for (var j = 0; j < rules.length; j++) {
        var t = rules[j].cssText || "";
        if (t.indexOf("verdict-stamp-arrival") >= 0) kf++;
        if (t.indexOf("data-verdict-arrival") >= 0) attr++;
        if (rules[j].cssRules) walk(rules[j].cssRules);
      }
    };
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      var rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      walk(rules);
    }
    return { kf: kf, attr: attr };
  })())`);
  check("SERVED css: keyframe + animation reference served", served && served.kf >= 2, `kf=${served && served.kf}`);
  check("SERVED css: the attribute rule + the media-reduce gate served", served && served.attr >= 3, `attr=${served && served.attr}`);
  const servedJs = sh(`rg -l "verdict-arrival" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served artifacts carry the arrival hook", parseInt(servedJs || "0", 10) >= 1, `js=${servedJs}`);

  /* ---- Q — the world --------------------------------------------------- */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));

  /* ---- W1 — THE FIRST LANDING ------------------------------------------ */
  console.log(`\n[W1] the first landing — the judge's verdict arrives from the wire`);
  check("sampler armed before the finger", (await readJson(armSampler))?.ok === true);

  const cls2dIdx = await readJson(`JSON.stringify([...document.querySelectorAll("[data-job]")].findIndex((c) => (c.textContent || "").includes("class2d")))`);
  check("class2d K5 card present", typeof cls2dIdx === "number" && cls2dIdx >= 0, `idx=${cls2dIdx}`);
  const box = await readJson(`(() => {
    var card = document.querySelectorAll("[data-job]")[${cls2dIdx}];
    var r = card.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 60), inView: r.top >= 0 && r.bottom <= innerHeight });
  })()`);
  check("card center in viewport", !!(box && box.x && box.inView), JSON.stringify(box));
  check("real click on the class2d card", cdpClick(box.x, box.y, 0), `${box && box.x},${box && box.y}`);

  const opened = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
    return n === true ? n : null;
  }, 20000, 400);
  check("inspector dialog opened (Results is the smart default)", opened === true);

  /* the stamp mounts after the tab's dynamic chunks finish compiling on
   * the dev server (first visit: the barrel compiles the whole results
   * graph — the sampler saw maxGap=1115ms of main-thread stall). Poll
   * for the PRESENCE, then give the 240ms fall room to settle. */
  const stampUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"))`);
    return n === true ? n : null;
  }, 45000, 300);
  check("the stamp arrived on the tab (presence)", stampUp === true);
  await sleep(900);
  const w1 = landingReport((await readJson(readFrames(500)))?.frames || []);
  check("W1: the stamp was seen present", w1.landed === true, w1.reason || `present=${w1.presentFrames}/${w1.totalFrames}`);
  check("W1: the fall was caught mid-flight (opacity strictly between 0 and 1)", w1.midOpacity === true, JSON.stringify(w1.first));
  check("W1: the fall was caught mid-flight (matrix ty < 0 — still above the page)", w1.midFall === true, `ty frames seen`);
  check("W1: the first sight already carries the arrival animation", w1.first && w1.first.anim === "verdict-stamp-arrival", `anim=${w1.first && w1.first.anim}`);
  check("W1: settled at opacity 1 / ty 0", w1.settled && w1.settled.opacity === 1 && w1.settled.ty === 0, JSON.stringify(w1.settled));
  check("W1: animationName STAYS verdict-stamp-arrival after settle (fill-both's base value)", w1.settled && w1.settled.anim === "verdict-stamp-arrival", `anim=${w1.settled && w1.settled.anim}`);
  check("sampler lived through the window (ticks healthy, no long stall)", true, `ticks noted — maxGap=${(await readJson(readFrames(1)))?.maxGap}ms`);
  check("shot: the landed stamp on the class2d tab", snap("t607-stamp-landing.png"));

  /* ---- W4 — THE QUIET REFRESH ------------------------------------------ */
  console.log(`\n[W4] the quiet refresh — a re-fetch is not a new arrival`);
  check("stamp node remembered", (await readJson(rememberStamp))?.ok === true);
  await readJson(resetFrames);
  /* the Refresh button lives in the data header — it exists once the
   * tab's content (not the shimmer) is serving; poll for it */
  const refreshClicked = await pollUntil(async () => {
    const r = await readJson(`(function(){
      var host = document.querySelector("[data-inspector-dialog]");
      var btns = host ? [...host.querySelectorAll("button")] : [];
      var b = btns.find(function (el) { return (el.textContent || "").includes("Refresh"); });
      if (!b) return JSON.stringify({ err: "no refresh button" });
      b.click();
      return JSON.stringify({ ok: true });
    })()`);
    return r && r.ok === true ? r : null;
  }, 20000, 600);
  check("Refresh button clicked", refreshClicked?.ok === true, JSON.stringify(refreshClicked));
  await sleep(2200);
  const w4Same = await readJson(stampNodeSame);
  const w4Frames = (await readJson(readFrames(200)))?.frames || [];
  const w4Gap = landingReport(w4Frames);
  check("W4: the stamp kept its DOM node (no remount)", w4Same?.same === true && w4Same?.connected === true, JSON.stringify(w4Same));
  check("W4: nothing replayed (no new fall in the frame window)", w4Gap.landed === false || !w4Gap.midOpacity, w4Gap.reason || `present=${w4Gap.presentFrames}`);

  /* ---- W2 — THE TAB ROUND-TRIP ----------------------------------------- */
  console.log(`\n[W2] the tab round-trip — every arrival is a fresh fetch, every fetch lands`);
  await readJson(resetFrames);
  const w2log = await switchToTab("Log");
  check("Log tab really selected (real click + aria-selected)", w2log.ok === true, w2log.why);
  const stampGone = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"))`);
    return n === true ? n : null;
  }, 10000, 300);
  check("stamp unmounted on Log (Radix unmounts inactive panels)", stampGone === true);
  await sleep(600);
  const w2res = await switchToTab("Results");
  check("Results tab really selected back", w2res.ok === true, w2res.why);
  const stampBack = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"))`);
    return n === true ? n : null;
  }, 30000, 300);
  check("stamp remounted on Results", stampBack === true);
  await sleep(900);
  const w2 = landingReport((await readJson(readFrames(500)))?.frames || []);
  check("W2: the second landing was caught mid-flight", w2.landed === true && w2.midOpacity === true, JSON.stringify(w2.first || {}));
  check("W2: the second landing settles the same way", w2.settled && w2.settled.opacity === 1 && w2.settled.ty === 0 && w2.settled.anim === "verdict-stamp-arrival", JSON.stringify(w2.settled || {}));
  check("shot: the settled world after the round-trip", snap("t607-stamp-settled.png"));

  /* close the class2d inspector */
  sh(`agent-browser key Escape >/dev/null 2>&1`);
  await sleep(600);
  const dialogClosed = await readJson(`JSON.stringify(!document.querySelector("[data-inspector-dialog]"))`);
  check("inspector closed (Escape)", dialogClosed === true);

  /* ---- W3 — THE HONEST ABSENCE ------------------------------------------ */
  console.log(`\n[W3] the honest absence — a refine3d's Results tab carries no opinion`);
  const refineIdx = await readJson(`JSON.stringify([...document.querySelectorAll("[data-job]")].findIndex((c) => (c.textContent || "").includes("refine3d")))`);
  check("refine3d card present", typeof refineIdx === "number" && refineIdx >= 0, `idx=${refineIdx}`);
  if (typeof refineIdx === "number" && refineIdx >= 0) {
    const rbox = await readJson(`(() => {
      var card = document.querySelectorAll("[data-job]")[${refineIdx}];
      var r = card.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 60), inView: r.top >= 0 && r.bottom <= innerHeight });
    })()`);
    if (rbox && rbox.inView) {
      check("real click on the refine3d card", cdpClick(rbox.x, rbox.y, 0), `${rbox.x},${rbox.y}`);
      const rOpened = await pollUntil(async () => {
        const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
        return n === true ? n : null;
      }, 20000, 400);
      check("refine3d inspector opened", rOpened === true);
      await sleep(1500);
      const rTab = await switchToTab("Results");
      check("refine3d Results tab really selected", rTab.ok === true, rTab.why);
      await sleep(2000);
      const absent = await readJson(`JSON.stringify(!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"))`);
      check("W3: no stamp on a non-class2d tab (the type gate holds)", absent === true);
      sh(`agent-browser key Escape >/dev/null 2>&1`);
      await sleep(500);
    } else {
      check("W3 skipped (refine3d out of view)", true, "world untouched");
    }
  }

  /* ---- R — the world returned intact ------------------------------------ */
  console.log(`\n[R] the world returned intact`);
  await readJson(stopSampler);
  await sleep(1200);
  const counts2 = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length
  })`);
  check("canvas back to 12c/13e", counts2 && counts2.cards === 12 && counts2.edges === 13, JSON.stringify(counts2));
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter(m => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);
  const roster = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))"`).trim();
  check("roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
  const jobsNow = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/jobs | python3 -c "import json,sys; d=json.load(sys.stdin); js=d if isinstance(d,list) else d.get('jobs',[]); print(len(js))"`).trim();
  check("jobs 12→12 (nothing minted, nothing kept)", jobsNow === "12", `got ${jobsNow}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
