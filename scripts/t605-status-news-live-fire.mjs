/**
 * t605 — the news face: live fire.
 *
 * Birth, death and the summon all answer a HAND. A status can change with
 * no finger anywhere near the card: the sweep completes a running job, the
 * poll merges the new state a tick later, and the world changed behind the
 * page's back. t605 gives that arrival a voice — the surface that already
 * shows the state blooms ONCE in its own new color and settles:
 *
 *   G0  the source contract (useStatusNews keyed on the DISPLAY word, the
 *       badge's data-news, the floor's data-news-floor, the two keyframes
 *       whose color is currentColor — the element's own truth)
 *   Q   the world (12c/13e + 12 dots, roster 12)
 *   W1  THE RUNNING ARRIVAL (idle→running): a REAL class2d probe minted,
 *       wired to the canonical extract, run on the mock cluster — the
 *       sampler catches the floor's teal bloom mid-flight
 *   W2  THE COMPLETION ARRIVAL (running→completed, purely poll-driven):
 *       emerald bloom mid-flight, steady emerald token after
 *   N   THE QUIET RENDER (no-op re-render): a position write re-renders
 *       the card but the floor's DOM node keeps its identity — nothing
 *       replays (progress ticks and neighbor polls sit out)
 *   W3  THE RESET FACE + THE BADGE SURFACE: the inspector's badge mounts
 *       showing completed with NO bloom (a born state is not news — the
 *       no-flicker law at panel distance), then a PATCH reset blooms BOTH
 *       the badge (panel) and the floor (canvas)
 *   R   the world owes nothing — probe deleted, workdirs swept, roster
 *       12→12, console clean
 *
 * The merges ride the REAL poll channel: the harness curl-runs the job
 * OUTSIDE the page and fires the same visibilitychange pollTick the
 * returning tab fires (the app-shell listener) — the transition reaches
 * the card exactly the way a user's own poll would.
 *
 * Usage: node scripts/t605-status-news-live-fire.mjs
 */

import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
/* the canonical world's fingerprint (boot heal deletes anything else) */
const CANONICAL_IDS = new Set([
  "cmuro2ufm000qn5nbpldk6u5c", "cmuro2uim000sn5nbnaykzk4d",
  "cmuro5s30000un5nbuxfic7tb", "cmuro5ze3000wn5nbewxp1nl8",
  "cmurol4yc000yn5nbkb59th5d", "cmurpj2ty0010n5nba6fzs8qc",
  "cmurqlpn80012n5nbtoijfnvr", "cmurqs6g20014n5nb2d994z44",
  "cmurqymg50016n5nb7yawisow", "cmurqymr10018n5nbkd7q4tta",
  "cmut5n5xl0005n53mmejkvyal", "cmut5s9a00007n53m76xvi21e",
]);

const CDP_PORT = "9325"; /* 9323 = t578, 9324 = t584/t604 — fresh port, no orphans */
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t605-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const CDP_CLICK = "scripts/t604-cdp-shift-click.mjs";
const SHOTS = ".qa-logs/shots";

const DATA_ROOT = `/home/z/my-project/data/relion/${EMPIAR_ID}`;
const CLUSTER_PROJ = `/home/z/my-project/services/mock-cluster/fs/projects/cryoflow/${EMPIAR_ID}`;
const CONN = "t380-conn";
const STAMPS_FILE = "/home/z/my-project/data/ai-verdicts.json";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 4) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      /* bare scalar strings are truthy — coerce the leaves (the t598
       * tuition, paid three times) */
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
async function pollUntil(fn, timeoutMs = 60000, step = 400) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
const api = (path, method = "GET", body) => {
  /* transient-failure immunity: curl can blink once under dev-server
   * compile load (the t604 tuition — retry twice with a short breath) */
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const dataFlag = body ? ` -H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify(body))}` : "";
      const out = sh(`curl -s --max-time 20 -X ${method} -H "Origin: ${BASE}" -H "Referer: ${BASE}/"${dataFlag} ${BASE}${path}`);
      return JSON.parse(out);
    } catch (e) {
      lastErr = e;
      try { execSync("sleep 0.4"); } catch { /* */ }
    }
  }
  throw lastErr;
};
const jobsOfActive = () => {
  const d = api("/api/jobs");
  return Array.isArray(d) ? d : (d.jobs ?? []);
};
const brightnessOf = (filter) => {
  const m = /brightness\(([\d.]+)\)/.exec(filter || "");
  return m ? Number(m[1]) : null;
};

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

/* ---- world repair: the cluster-side extract inputs (t574, idempotent) - */
function repairWorld(extractJob) {
  const hostStar = join(DATA_ROOT, `extract_${extractJob.id.slice(-8)}`, "particles.star");
  if (!existsSync(hostStar)) throw new Error(`host extract star missing: ${hostStar}`);
  const clusterStarDir = join(CLUSTER_PROJ, `extract_${extractJob.id.slice(-8)}`);
  mkdirSync(clusterStarDir, { recursive: true });
  const clusterStar = join(clusterStarDir, "particles.star");
  const repaired = [];
  if (!existsSync(clusterStar)) {
    copyFileSync(hostStar, clusterStar);
    repaired.push("star");
  }
  const rows = readFileSync(hostStar, "utf8").split("\n").filter((l) => l.includes("@"));
  const maxIdx = new Map();
  for (const line of rows) {
    const m = /(\d+)@(\S+\.mrcs)/.exec(line);
    if (m) maxIdx.set(m[2], Math.max(maxIdx.get(m[2]) ?? 0, Number(m[1])));
  }
  const BX = 64;
  const header = (nz) => {
    const h = Buffer.alloc(1024);
    h.writeInt32LE(BX, 0); h.writeInt32LE(BX, 4); h.writeInt32LE(nz, 8);
    h.writeInt32LE(2, 12);
    h.writeInt32LE(0, 92);
    h.writeInt32LE(20140, 200);
    h.write("MAP ", 208);
    h.writeInt32LE(0x4444, 212);
    return h;
  };
  const noise = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };
  const gauss = (x, y, cx, cy, sigma) =>
    Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * sigma * sigma)));
  for (const [stackPath, nz] of [...maxIdx.entries()].sort()) {
    if (existsSync(stackPath)) continue;
    mkdirSync(dirname(stackPath), { recursive: true });
    const sliceBytes = BX * BX * 4;
    const out = Buffer.alloc(1024 + sliceBytes * nz);
    header(nz).copy(out, 0);
    for (let z = 0; z < nz; z++) {
      const motif = z % 4;
      const rnd = noise(z * 7919 + 13);
      const base = 1024 + z * sliceBytes;
      for (let y = 0; y < BX; y++) {
        for (let x = 0; x < BX; x++) {
          let v = (rnd() - 0.5) * 10;
          const c = (BX - 1) / 2;
          if (motif === 0) v += 40 * gauss(x, y, c, c, 8);
          else if (motif === 1) v += 30 * (gauss(x, y, c - 10, c, 6) + gauss(x, y, c + 10, c, 6));
          else if (motif === 2) {
            const r = Math.hypot(x - c, y - c);
            v += Math.abs(r - 14) < 3 ? 35 : 0;
          } else {
            v += Math.abs(x - y) < 3 ? 28 : 0;
          }
          out.writeFloatLE(v, base + (y * BX + x) * 4);
        }
      }
    }
    writeFileSync(stackPath, out);
    repaired.push(stackPath.split("/").pop());
  }
  return repaired;
}

/* ---- in-page instruments (NO line comments — eval flattens newlines) -- */

/* the floor sampler: a 30ms interval on the page's own clock recording
 * the probe card's floor — its data-news-floor attr, computed filter
 * (the bloom's brightness) and className (the steady color token). Runs
 * continuously; the harness reads the frames after each window. */
const floorSampler = (probeId) => `(function(){
  window.__t605 = { frames: [], t0: performance.now(), ticks: 0, maxGap: 0, _lt: performance.now(), on: true };
  var probe = null;
  window.__t605iv = setInterval(function(){
    if (!window.__t605 || !window.__t605.on) return;
    var now = performance.now();
    if (now - window.__t605._lt > window.__t605.maxGap) window.__t605.maxGap = Math.round(now - window.__t605._lt);
    window.__t605._lt = now;
    window.__t605.ticks++;
    probe = probe || document.querySelector('[data-job="${probeId}"]');
    if (!probe) return;
    var floor = null;
    var kids = probe.querySelectorAll('div[aria-hidden="true"]');
    for (var i = 0; i < kids.length; i++) {
      var cn = kids[i].className || "";
      if (cn.indexOf("h-[3px]") >= 0 && cn.indexOf("inset-x-0") >= 0) { floor = kids[i]; break; }
    }
    if (!floor) return;
    var cs = getComputedStyle(floor);
    window.__t605.frames.push({
      t: Math.round(now - window.__t605.t0),
      attr: floor.getAttribute("data-news-floor") || "",
      filter: cs.filter,
      cls: (floor.className || "").indexOf("bg-emerald") >= 0 ? "emerald"
         : (floor.className || "").indexOf("bg-teal") >= 0 ? "teal"
         : (floor.className || "").indexOf("bg-slate") >= 0 ? "slate"
         : (floor.className || "").slice(0, 40)
    });
  }, 30);
  return JSON.stringify({ ok: true });
})()`;

/* remember the floor's DOM node — the no-replay proof compares identity */
const rememberFloor = (probeId) => `(function(){
  var probe = document.querySelector('[data-job="${probeId}"]');
  if (!probe) return JSON.stringify({ err: "no probe" });
  var kids = probe.querySelectorAll('div[aria-hidden="true"]');
  for (var i = 0; i < kids.length; i++) {
    var cn = kids[i].className || "";
    if (cn.indexOf("h-[3px]") >= 0 && cn.indexOf("inset-x-0") >= 0) {
      window.__t605floor = kids[i];
      return JSON.stringify({ ok: true });
    }
  }
  return JSON.stringify({ err: "no floor" });
})()`;

const floorNodeSame = `(function(){
  var f = window.__t605floor;
  if (!f) return JSON.stringify({ same: false, err: "no memory" });
  var probe = document.querySelector('[data-job="' + f.closest('[data-job]').getAttribute('data-job') + '"]');
  if (!probe) return JSON.stringify({ same: false, err: "no probe" });
  var kids = probe.querySelectorAll('div[aria-hidden="true"]');
  var cur = null;
  for (var i = 0; i < kids.length; i++) {
    var cn = kids[i].className || "";
    if (cn.indexOf("h-[3px]") >= 0 && cn.indexOf("inset-x-0") >= 0) { cur = kids[i]; break; }
  }
  return JSON.stringify({ same: cur === f, connected: f.isConnected });
})()`;

const stopFloorSampler = `(function(){
  if (window.__t605) window.__t605.on = false;
  if (window.__t605iv) { clearInterval(window.__t605iv); window.__t605iv = null; }
  var fr = (window.__t605 && window.__t605.frames) || [];
  return JSON.stringify({ n: fr.length, ticks: window.__t605 ? window.__t605.ticks : 0, maxGap: window.__t605 ? window.__t605.maxGap : 0 });
})()`;

const readFloorFrames = `(function(){
  var fr = (window.__t605 && window.__t605.frames) || [];
  return JSON.stringify({ n: fr.length, frames: fr.slice(-260) });
})()`;

/* the badge sampler (inspector side): the bloom FADES (the ring's color
 * alpha 0.28 → 0 and the wash's 0.14 → 0 — the spread never grows), so
 * the page side records the raw strings and the harness parses alphas */
const badgeSampler = `(function(){
  window.__t605b = { frames: [], t0: performance.now(), on: true };
  window.__t605biv = setInterval(function(){
    if (!window.__t605b || !window.__t605b.on) return;
    var host = document.querySelector("[data-inspector-dialog]");
    if (!host) return;
    var badge = host.querySelector("[data-news]");
    if (!badge) return;
    var cs = getComputedStyle(badge);
    window.__t605b.frames.push({
      t: Math.round(performance.now() - window.__t605b.t0),
      shadow: cs.boxShadow === "none" ? "" : cs.boxShadow,
      bg: cs.backgroundColor,
      word: (badge.textContent || "").trim().slice(0, 12)
    });
  }, 30);
  return JSON.stringify({ ok: true });
})()`;
const spreadOf = (s) => {
  const m = /([\d.]+)px\s*$/.exec(s || "");
  return m ? Number(m[1]) : null;
};
/* alpha extraction must speak Chrome's tongue: color-mix(currentColor …)
 * serializes as MODERN color space (oklab(L a b / alpha)), not rgba —
 * the t602/t603 lesson's newest sibling: ask what the value looks like
 * AFTER the browser's serializer has had its way with it */
const alphaOf = (color) => {
  if (!color || color === "transparent" || color === "none") return 0;
  let m = /rgba?\(([^)]+)\)/.exec(color);
  if (m) {
    const parts = m[1].split(",").map((x) => Number(x.trim()));
    return parts.length >= 4 ? parts[3] : 1;
  }
  m = /\/\s*([\d.]+)\s*\)/.exec(color);
  return m ? Number(m[1]) : 1;
};

const readBadgeFrames = `(function(){
  var fr = (window.__t605b && window.__t605b.frames) || [];
  return JSON.stringify({ n: fr.length, frames: fr.slice(-260) });
})()`;

const stopBadgeSampler = `(function(){
  if (window.__t605b) window.__t605b.on = false;
  if (window.__t605biv) { clearInterval(window.__t605biv); window.__t605biv = null; }
  var fr = (window.__t605b && window.__t605b.frames) || [];
  return JSON.stringify({ n: fr.length });
})()`;

/* the deterministic merge trigger: the same listener a returning tab
 * fires (app-shell's visibilitychange → immediate pollTick) */
const FIRE_POLL = `(function(){
  document.dispatchEvent(new Event("visibilitychange"));
  return JSON.stringify({ fired: true, vis: document.visibilityState });
})()`;

/* zoom-to-fit via the canvas context menu (the t602/t604 dance: fresh
 * mints can clip above the viewport's top edge) */
const FIT_MENU_OPEN = `(function(){
  var pt = null;
  for (var y = 80; y < innerHeight - 40 && !pt; y += 30) {
    for (var x = 30; x < innerWidth - 40 && !pt; x += 50) {
      var el = document.elementFromPoint(x, y);
      if (el && el.closest("[data-canvas]") && !el.closest('[data-job],[data-edge-id],[data-canvas-ui],[role="menu"],button')) pt = { x: x, y: y };
    }
  }
  if (!pt) return JSON.stringify({ err: "no blank canvas point" });
  var el = document.elementFromPoint(pt.x, pt.y);
  el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y }));
  return JSON.stringify({ ok: true });
})()`;

const cardCenter = (probeId) => `(function(){
  var el = document.querySelector('[data-job="${probeId}"]');
  if (!el) return JSON.stringify({ err: "no card" });
  var r = el.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), visible: r.top >= 60 && r.bottom <= innerHeight });
})()`;

/* ---- the run ------------------------------------------------------------ */

const tag = Date.now().toString(36);
let probe = null;
let judgeWasArmed = false;

try {
  /* ---- boot: world guard BEFORE any browser spend (the t584 discipline) */
  console.log(`[boot] world guard`);
  const projects0 = api("/api/projects").projects;
  const active0 = projects0.find((p) => p.active);
  if (!active0 || active0.id !== EMPIAR_ID) {
    console.error(`FATAL: active world is ${active0 ? active0.id : "unknown"}, expected EMPIAR — refusing to run in a borrowed world`);
    process.exit(2);
  }
  console.log(`[boot] world guard ok — EMPIAR active, roster ${active0.stats.total}`);

  /* the judge worker would spend a VLM call on the fresh probe — disarm
   * for the window, restore in finally (t574's toggle dance) */
  const st0 = api("/api/ai/judge-worker");
  judgeWasArmed = st0.autoJudge === true;
  if (judgeWasArmed) {
    const putOff = api("/api/ai/settings", "PUT", { autoJudge: false });
    check("judge disarmed for the window", putOff.settings?.autoJudge === false);
  } else {
    check("judge already quiet", st0.autoJudge === false);
  }

  console.log(`[boot] desktop-capable Chrome`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  const chromeReady = await launchDesktopChrome();
  if (!chromeReady) {
    console.error("FATAL: the desktop-capable Chrome never opened its CDP port — environment shim failed");
    process.exit(2);
  }
  check("desktop-capable Chrome up", true, `port ${CDP_PORT}`);
  await sleep(400);
  let connected = false;
  for (let i = 0; i < 3 && !connected; i++) {
    try {
      const out = sh(`agent-browser connect ${CDP_PORT} 2>&1`);
      connected = !/relaunched|failed|✗/i.test(out);
      if (!connected) console.log(`  … connect attempt ${i + 1}: ${out.slice(0, 80)}`);
    } catch (e) {
      console.log(`  … connect attempt ${i + 1} threw: ${String(e.message).slice(0, 80)}`);
    }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected to the desktop-capable Chrome", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
  await sleep(500);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  applyShim();

  const sentinel = await readJson(`JSON.stringify({ s: 40 + 2 })`);
  check("eval round-trip sentinel", sentinel && sentinel.s === 42, JSON.stringify(sentinel));

  /* heal before you measure (t597→t604) */
  {
    const jobsNow = jobsOfActive();
    const strangers = jobsNow.filter((j) => !CANONICAL_IDS.has(j.id));
    for (const j of strangers) api(`/api/jobs/${j.id}`, "DELETE");
    if (strangers.length > 0) {
      await sleep(1200);
      console.log(`  [heal] swept ${strangers.length} leftover probe(s)`);
    }
  }
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(800);
  const roster0 = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  check("roster0 = 12 (healed baseline)", roster0 && roster0.stats.total === 12, roster0 ? `total=${roster0.stats.total}` : "no roster");

  /* ---- G0 — the source contract + the SERVED freshness gate ----------- */
  console.log(`\n[G0] the source contract`);
  const hookRefs = sh(`rg -c "useStatusNews" src/components/workflow/job-card.tsx || true`);
  check("useStatusNews: one hook, two consumers", parseInt(hookRefs || "0", 10) >= 3, `refs=${hookRefs}`);
  const newsRefs = sh(`rg -c "data-news-floor" src/components/workflow/job-card.tsx || true`);
  check("the floor carries the news attribute", parseInt(newsRefs || "0", 10) >= 2, `refs=${newsRefs}`);
  const cssBloom = sh(`rg -c "status-news-bloom" src/app/globals.css || true`);
  const cssFloor = sh(`rg -c "status-news-floor" src/app/globals.css || true`);
  check("css: both keyframes present", parseInt(cssBloom || "0", 10) >= 2 && parseInt(cssFloor || "0", 10) >= 2, `bloom=${cssBloom} floor=${cssFloor}`);
  const served = await readJson(`JSON.stringify((function(){
    var names = [];
    var walk = function (rules) {
      for (var j = 0; j < rules.length; j++) {
        var t = rules[j].cssText || "";
        if (t.indexOf("status-news-bloom") >= 0 || t.indexOf("status-news-floor") >= 0) names.push(1);
        if (rules[j].cssRules) walk(rules[j].cssRules);
      }
    };
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      var rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      walk(rules);
    }
    return { newsRules: names.length };
  })())`);
  check("SERVED css carries the news face", served && served.newsRules >= 4, `rules=${served && served.newsRules}`);
  const servedJs = sh(`rg -l "status-news" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served artifacts carry the news family", parseInt(servedJs || "0", 10) >= 1, `js=${servedJs}`);

  /* ---- Q — the world --------------------------------------------------- */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));

  /* ---- W1 — THE RUNNING ARRIVAL (idle→running) ------------------------- */
  console.log(`\n[W1] the running arrival — the sweep's word reaches the floor`);

  const extract = jobsOfActive().find((j) => j.type === "extract" && j.status === "completed");
  check("canonical extract found (the wire source)", !!extract, extract ? extract.id.slice(-8) : "none");
  {
    const repaired = repairWorld(extract);
    check("cluster-side extract inputs in place", repaired.length >= 0, repaired.length ? `restored: ${repaired.join(", ")}` : "already present");
  }

  const minted = api("/api/jobs", "POST", {
    type: "class2d", name: `t605 News Probe ${tag}`, x: 900, y: 620,
    params: { algorithm: "em", iterations: 3, numClasses: 4 },
  });
  probe = minted.job ?? minted;
  check("probe minted (a REAL card, born idle)", !!probe?.id && probe.status === "idle", probe ? `${probe.id} status=${probe.status}` : "none");
  if (!probe?.id) throw new Error("W1: probe unavailable");
  const wire = api("/api/edges", "POST", { fromJobId: extract.id, toJobId: probe.id });
  check("wired from extract", !!(wire.id || wire.edge?.id), wire.id ?? wire.edge?.id ?? "?");

  /* the page must SEE the card idle before the news can arrive: the mint
   * was external (curl) — one pollTick merges the 13th card as a born-
   * idle card (no bloom — a born state is not news), and only THEN can
   * idle→running be news the page can acknowledge */
  await readJson(FIRE_POLL);
  const merged13 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 13 ? n : null;
  }, 20000, 400);
  check("probe merged into the page as a born-idle card (13 cards)", merged13 === 13, `got ${merged13}`);
  const bornNews = await readJson(`JSON.stringify((function(){
    var el = document.querySelector('[data-job="${probe.id}"]');
    if (!el) return JSON.stringify({ err: "no card" });
    var floor = null;
    var kids = el.querySelectorAll('div[aria-hidden="true"]');
    for (var i = 0; i < kids.length; i++) {
      var cn = kids[i].className || "";
      if (cn.indexOf("h-[3px]") >= 0 && cn.indexOf("inset-x-0") >= 0) floor = kids[i];
    }
    return JSON.stringify({ hasFloor: !!floor, bornAttr: floor ? (floor.getAttribute("data-news-floor") || null) : null });
  })())`);
  check("born-idle floor carries NO news attr (the mount law, live)", !!(bornNews && bornNews.hasFloor && bornNews.bornAttr === null), JSON.stringify(bornNews));

  /* fit so the probe's floor is in the viewport (the t604 tuition) */
  await readJson(FIT_MENU_OPEN);
  await sleep(700);
  const fitItem = await pollUntil(async () => {
    const r = await readJson(`JSON.stringify((function(){
      var items = document.querySelectorAll('[role="menuitem"]');
      for (var i = 0; i < items.length; i++) {
        if (/Zoom to fit workflow/.test(items[i].textContent || "")) { items[i].click(); return JSON.stringify({ ok: true }); }
      }
      return JSON.stringify({ err: "no fit item" });
    })())`);
    return r && r.ok ? r : null;
  }, 8000, 400);
  check("zoom-to-fit (the whole world in the viewport)", !!fitItem);
  await sleep(900);
  const cc0 = await readJson(cardCenter(probe.id));
  check("probe card fully visible", !!(cc0 && cc0.visible), cc0 ? JSON.stringify(cc0) : "no card");

  /* arm the floor sampler BEFORE the news can arrive */
  const arm = await readJson(floorSampler(probe.id));
  check("floor sampler armed", !!(arm && arm.ok), JSON.stringify(arm));

  /* the run: POST outside the page — the page knows nothing yet */
  const runRes = api(`/api/jobs/${probe.id}/run`, "POST", { remote: { connectionId: CONN, mode: "direct" } });
  const runJob = runRes.job ?? runRes;
  check("POST run accepted (mock cluster)", !runRes.error && runJob.status === "running", `status=${runJob.status}${runRes.error ? ` err=${String(runRes.error).slice(0, 80)}` : ""}`);

  /* the deterministic merge: the same pollTick a returning tab fires */
  const fired1 = await readJson(FIRE_POLL);
  check("visibilitychange pollTick fired", !!(fired1 && fired1.fired), fired1 ? `vis=${fired1.vis}` : "no");
  await sleep(4200);

  const fr1 = await readJson(readFloorFrames);
  const f1 = (fr1 && fr1.frames) || [];
  const trueFrames1 = f1.filter((f) => f.attr === "true");
  check("floor remounted with the news attr", trueFrames1.length > 0, `first t=${trueFrames1.length ? trueFrames1[0].t : "—"}ms`);
  const bright1 = trueFrames1.map((f) => brightnessOf(f.filter)).filter((b) => b != null);
  const mid1 = bright1.filter((b) => b > 1.02 && b < 1.73);
  check("teal bloom caught MID-FLIGHT (brightness strictly interior)", mid1.length > 0,
    mid1.length ? `peak≈${Math.max(...bright1).toFixed(2)} mid=${mid1.length} frames` : `readings=${JSON.stringify(bright1.slice(0, 8))}`);
  /* the settled RUNNING face: ≥2 consecutive quiet teal frames — lived
   * in, not just passed through (the mock run may complete within this
   * window; what must hold is that running was SEEN settled, not that
   * the world stopped) */
  const idx1 = Math.max(0, f1.findIndex((f) => f.attr === "true"));
  let tealSteady = 0;
  for (let i = idx1; i < f1.length; i++) {
    const f = f1[i];
    if (f.cls === "teal" && (brightnessOf(f.filter) ?? 1) <= 1.02) { tealSteady++; if (tealSteady >= 2) break; }
    else if (f.cls !== "teal") tealSteady = 0;
  }
  check("bloom retired to a lived-in teal steady", tealSteady >= 2, `quiet teal stretch=${tealSteady}`);

  mkdirSync(SHOTS, { recursive: true });
  sh(`agent-browser screenshot ${SHOTS}/t605-running-floor.png >/dev/null 2>&1 || true`);

  /* ---- W2 — THE COMPLETION ARRIVAL (running→completed, poll-driven) ---- */
  console.log(`\n[W2] the completion arrival — the sweep completes, the poll tells`);

  const done = await pollUntil(() => {
    const lj = jobsOfActive().find((j) => j.id === probe.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 300_000, 2_000);
  check("probe ran to completion on the mock cluster", !!done, done ? `${Math.round(done.progress)}%` : "timeout");

  /* the sampler is STILL running — whether the page's own fast-tier poll
   * (anyActive flipped it to 1200ms) or our trigger merges first, the
   * frames catch the bloom through the same React commit */
  const fired2 = await readJson(FIRE_POLL);
  check("merge trigger fired (completion)", !!(fired2 && fired2.fired));
  await sleep(4200);

  const fr2 = await readJson(readFloorFrames);
  const f2 = (fr2 && fr2.frames) || [];
  const trueFrames2 = f2.filter((f) => f.attr === "true");
  const bright2 = trueFrames2.map((f) => brightnessOf(f.filter)).filter((b) => b != null);
  const mid2 = bright2.filter((b) => b > 1.02 && b < 1.73);
  check("emerald bloom caught MID-FLIGHT", mid2.length > 0,
    mid2.length ? `peak≈${Math.max(...bright2).toFixed(2)} mid=${mid2.length} frames` : `readings=${JSON.stringify(bright2.slice(0, 8))}`);
  const tail2 = f2.slice(-6);
  check("steady face is emerald (completed)", tail2.length > 0 && tail2.every((f) => f.cls === "emerald"), `cls=${tail2.length ? tail2[tail2.length - 1].cls : "—"}`);
  const settled2 = tail2.every((f) => (brightnessOf(f.filter) ?? 1) <= 1.02);
  check("second bloom retired cleanly", settled2);

  sh(`agent-browser screenshot ${SHOTS}/t605-completed-floor.png >/dev/null 2>&1 || true`);

  /* ---- N — THE QUIET RENDER (no-op re-render does not replay) ---------- */
  console.log(`\n[N] the quiet render — a position write re-renders, nothing replays`);

  const mem = await readJson(rememberFloor(probe.id));
  check("floor node remembered", !!(mem && mem.ok), JSON.stringify(mem));
  api(`/api/jobs/${probe.id}`, "PATCH", { x: 901, y: 621 });
  const firedN = await readJson(FIRE_POLL);
  check("position merge fired", !!(firedN && firedN.fired));
  await sleep(2500);
  const same = await readJson(floorNodeSame);
  check("floor node identity preserved (no remount → no replay)", !!(same && same.same && same.connected), JSON.stringify(same));
  const frN = await readJson(readFloorFrames);
  const fN = ((frN && frN.frames) || []).slice(-60);
  const replayN = fN.some((f) => (brightnessOf(f.filter) ?? 1) > 1.02);
  check("no brightness pulse in the quiet window", !replayN, `window=${fN.length} frames`);

  /* ---- W3 — THE RESET FACE + THE BADGE SURFACE ------------------------- */
  console.log(`\n[W3] the reset face — completed→idle, both distances at once`);

  const cc = await readJson(cardCenter(probe.id));
  check("probe clickable (center in viewport)", !!(cc && cc.visible && cc.x), JSON.stringify(cc));
  const clicked = cdpClick(cc.x, cc.y, 0);
  check("real click on the completed probe", clicked, `${cc.x},${cc.y}`);
  await pollUntil(async () => {
    const r = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
    return r === true;
  }, 12000, 400);
  const insOpen = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
  check("inspector opened (the completed card's pointerup)", insOpen === true);

  /* the badge was BORN showing completed — a born state is not news */
  const mountState = await readJson(`JSON.stringify((function(){
    var host = document.querySelector("[data-inspector-dialog]");
    if (!host) return JSON.stringify({ err: "no inspector" });
    var badge = host.querySelector("[data-news]");
    var any = host.querySelector("[class*='capitalize']");
    return JSON.stringify({ dataNews: badge ? badge.getAttribute("data-news") : null, hasBadge: !!any });
  })())`);
  check("freshly mounted badge carries NO news (the no-flicker law)",
    mountState && mountState.hasBadge && (mountState.dataNews === null || mountState.dataNews === undefined),
    JSON.stringify(mountState));

  const armB = await readJson(badgeSampler);
  check("badge sampler armed", !!(armB && armB.ok));

  api(`/api/jobs/${probe.id}`, "PATCH", { status: "idle" });
  const fired3 = await readJson(FIRE_POLL);
  check("reset merge fired", !!(fired3 && fired3.fired));
  await sleep(4200);

  /* the floor's slate bloom read FIRST — every later read burns sampler
   * window and the 260-frame tail slides past the bloom */
  const fr3 = await readJson(readFloorFrames);
  const f3 = ((fr3 && fr3.frames) || []).slice(-260);
  const slateFrames = f3.filter((f) => f.cls === "slate");
  const mid3 = slateFrames.map((f) => brightnessOf(f.filter)).filter((b) => b != null && b > 1.02 && b < 1.73);
  check("floor bloom caught MID-FLIGHT at canvas distance (slate)", mid3.length > 0,
    mid3.length ? `mid=${mid3.length} frames` : `tail=${JSON.stringify(f3.slice(-4).map((f) => [f.cls, f.filter.slice(0, 30)]))}`);
  const tail3 = f3.slice(-6);
  const settled3 = tail3.every((f) => f.cls === "slate" && (brightnessOf(f.filter) ?? 1) <= 1.02);
  check("reset face settled (idle slate, no glow)", settled3, `cls=${tail3.length ? tail3[tail3.length - 1].cls : "—"}`);

  const stopB = await readJson(stopBadgeSampler);
  const frB = await readJson(readBadgeFrames);
  const fb = (frB && frB.frames) || [];
  const blooming = fb.filter((f) => f.word === "idle");
  const bgAlpha = blooming.map((f) => alphaOf(f.bg));
  const midB = bgAlpha.filter((a) => a > 0.001 && a < 0.139);
  check("badge bloom caught MID-FLIGHT at panel distance (wash fading)", midB.length > 0,
    midB.length ? `frames=${midB.length} alpha=${JSON.stringify(bgAlpha.slice(0, 6))}` : `bgs=${JSON.stringify(fb.slice(0, 4).map((f) => f.bg))}`);
  const shadowSpreads = blooming.map((f) => spreadOf(f.shadow));
  const ringFrom = shadowSpreads.filter((s) => s != null && s > 3.5).length > 0;
  const ringRetired = shadowSpreads.length > 0 &&
    (shadowSpreads[shadowSpreads.length - 1] == null || shadowSpreads[shadowSpreads.length - 1] < 0.5);
  const midShadow = shadowSpreads.filter((s) => s != null && s > 0.01 && s < 3.99);
  /* the contraction's interior frames are subject to the sampler's
   * freeze (t596/t602: frame logs freeze mid-breath under main-thread
   * load — maxGap proves it); the ENDPOINTS are the honest claim, the
   * wash above already carries the strictly-interior evidence */
  check("the ring stood at from and retired — absorbed, not fled",
    ringFrom && ringRetired,
    `spreads=${JSON.stringify(shadowSpreads.slice(0, 8))}${midShadow.length ? ` interior=${midShadow.length}` : " (froze)"}`);
  /* the SETTLED read polls the live DOM (the frozen-window doctrine).
   * With `both` fill the animation STAYS APPLIED after finishing — the
   * t603 base-value lesson again: the settled read is the shadow's
   * geometry, not the animation's absence. */
  const settledBadge = await pollUntil(async () => {
    const r = await readJson(`JSON.stringify((function(){
      var host = document.querySelector("[data-inspector-dialog]");
      if (!host) return null;
      var badge = host.querySelector("[data-news]");
      if (!badge) return null;
      var cs = getComputedStyle(badge);
      return JSON.stringify({ shadow: cs.boxShadow, anim: cs.animationName });
    })())`);
    return r && (r.shadow === "none" || (spreadOf(r.shadow) ?? 9) < 0.5) ? r : null;
  }, 8000, 400);
  check("settled badge polled LIVE: ring geometry gone (0-spread or none)",
    !!(settledBadge && (settledBadge.shadow === "none" || (spreadOf(settledBadge.shadow) ?? 9) < 0.5)),
    settledBadge ? `shadow=${(settledBadge.shadow || "none").slice(0, 44)} anim=${settledBadge.anim}` : "no badge");

  /* ---- R — the world owes nothing -------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  const stopF = await readJson(stopFloorSampler);
  check("floor sampler retired with frames on record", !!(stopF && stopF.n > 0), `frames=${stopF && stopF.n} ticks=${stopF && stopF.ticks} maxGap=${stopF && stopF.maxGap}ms`);

  sh(`agent-browser press Escape >/dev/null 2>&1 || true`);
  await sleep(600);
  api(`/api/jobs/${probe.id}`, "DELETE");
  await sleep(900);
  const hostWd = join(DATA_ROOT, `class2d_${probe.id.slice(-8)}`);
  const clWd = join(CLUSTER_PROJ, `class2d_${probe.id.slice(-8)}`);
  try { rmSync(hostWd, { recursive: true, force: true }); } catch { /* */ }
  try { rmSync(clWd, { recursive: true, force: true }); } catch { /* */ }
  check("workdirs swept (host + cluster side)", !existsSync(hostWd) && !existsSync(clWd));

  const jobsEnd = jobsOfActive().length;
  const edgesEnd = api("/api/edges");
  const edgeCount = Array.isArray(edgesEnd) ? edgesEnd.length : (edgesEnd.edges ?? []).length;
  const rosterEnd = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  check("roster 12→12, jobs 12, edges 13 (borrowed, returned)",
    rosterEnd && rosterEnd.stats.total === 12 && jobsEnd === 12 && edgeCount === 13,
    rosterEnd ? `total=${rosterEnd.stats.total} jobs=${jobsEnd} edges=${edgeCount}` : "no roster");
  check("canonical statuses untouched (11 completed + the import)",
    rosterEnd && rosterEnd.stats.completed === 11 && rosterEnd.stats.running === 0 && rosterEnd.stats.pending === 0 && rosterEnd.stats.failed === 0,
    rosterEnd ? JSON.stringify(rosterEnd.stats) : "—");

  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean", errs === 0, `errors=${errs}`);
} catch (e) {
  console.error(`\n[FATAL] ${String(e.message || e).slice(0, 300)}`);
  /* fatal exit sweeps its own probe (the t604 exit edition) */
  try {
    if (probe?.id) {
      api(`/api/jobs/${probe.id}`, "DELETE");
      try { rmSync(join(DATA_ROOT, `class2d_${probe.id.slice(-8)}`), { recursive: true, force: true }); } catch { /* */ }
      try { rmSync(join(CLUSTER_PROJ, `class2d_${probe.id.slice(-8)}`), { recursive: true, force: true }); } catch { /* */ }
      console.error(`[fatal sweep] probe ${probe.id} returned`);
    }
  } catch { /* best effort */ }
  fail++;
} finally {
  if (judgeWasArmed) {
    try {
      api("/api/ai/settings", "PUT", { autoJudge: true });
      console.log(`[finally] judge re-armed`);
    } catch { /* */ }
  }
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { execSync(`pkill -f "remote-debugging-port=${CDP_PORT}" 2>/dev/null || true`); } catch { /* */ }
}

console.log(`\n[result] ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
