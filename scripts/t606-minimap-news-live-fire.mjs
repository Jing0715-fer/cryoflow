/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t606 — the news face's THIRD distance: the minimap dot. Live fire.
 *
 * t605 taught the news face two distances (the badge at panel distance,
 * the card's floor at canvas distance). The map's dot is the farthest
 * zoom of all — the bird's-eye where a status change arrives with NO
 * finger anywhere near, and until t606 the fill swap was SILENT. Now the
 * dot is a MinimapDot: the same lib hook (use-status-news), the same
 * floor vocabulary ([data-news-floor] — one semantic, one value), one
 * brightness bloom in its own new color:
 *
 *   G0  the source contract (the hook's lib home, the minimap's
 *       MinimapDot with key={news} + data-news-floor + the queued
 *       dialect mirror, the data-mm-* door/dim/find contract preserved,
 *       the SERVED css still carrying exactly the two news keyframes)
 *   Q   the world (12c/13e + 12 dots)
 *   W1  THE RUNNING ARRIVAL at map distance: a REAL class2d probe minted
 *       and merged born-idle (the dot mounts GREY with NO news attr —
 *       the mount law live at the third distance), then run on the mock
 *       cluster — the sampler catches the dot's teal bloom mid-flight
 *   W2  THE COMPLETION ARRIVAL (poll-driven): emerald bloom mid-flight,
 *       steady emerald fill
 *   N   THE QUIET RENDER: a position write re-renders the dot (its x/y
 *       attributes change) but the DOM node keeps its identity — nothing
 *       replays
 *   W3  THE RESET FACE: completed→idle, the dot blooms slate at map
 *       distance and settles back to grey
 *   R   the world owes nothing — probe deleted, workdirs swept, roster
 *       12→12, console clean
 *
 * No pointer gestures anywhere: every merge rides the REAL poll channel
 * (the harness fires the same visibilitychange pollTick a returning tab
 * fires), and the dot is always on screen at map distance — no fit, no
 * hover shim, no clicks. The whole window is the world talking.
 *
 * Usage: node scripts/t606-minimap-news-live-fire.mjs
 */

import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync } from "node:fs";
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

const CDP_PORT = "9326"; /* 9323 = t578, 9324 = t584/t604, 9325 = t605 — fresh port, no orphans */
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t606-harness-chrome-profile";
const SHOTS = ".qa-logs/shots";

const DATA_ROOT = `/home/z/my-project/data/relion/${EMPIAR_ID}`;
const CLUSTER_PROJ = `/home/z/my-project/services/mock-cluster/fs/projects/cryoflow/${EMPIAR_ID}`;
const CONN = "t380-conn";

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

/* ---- the environment: own Chrome (no hover shim — no pointer anywhere) - */
let chromeProc = null;
async function launchDesktopChrome() {
  chromeProc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--window-size=1280,720",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "about:blank",
  ], { stdio: "ignore", detached: false });
  const ready = await pollUntil(() => {
    try { return sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200"; }
    catch { return false; }
  }, 15000, 300);
  return ready;
}

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

/* the dot sampler: a 30ms interval on the page's own clock recording the
 * PROBE'S MINIMAP DOT — its data-news-floor attr, computed filter (the
 * bloom's brightness) and fill attribute (the steady color). Runs
 * continuously; the harness reads the frames after each window. */
const dotSampler = (probeId) => `(function(){
  window.__t606 = { frames: [], t0: performance.now(), ticks: 0, maxGap: 0, _lt: performance.now(), on: true };
  window.__t606iv = setInterval(function(){
    if (!window.__t606 || !window.__t606.on) return;
    var now = performance.now();
    if (now - window.__t606._lt > window.__t606.maxGap) window.__t606.maxGap = Math.round(now - window.__t606._lt);
    window.__t606._lt = now;
    window.__t606.ticks++;
    var dot = document.querySelector('[data-canvas-ui="minimap-dot"][data-job-id="${probeId}"]');
    if (!dot) return;
    var cs = getComputedStyle(dot);
    window.__t606.frames.push({
      t: Math.round(now - window.__t606.t0),
      attr: dot.getAttribute("data-news-floor") || "",
      filter: cs.filter,
      fill: dot.getAttribute("fill") || ""
    });
  }, 30);
  return JSON.stringify({ ok: true });
})()`;

/* remember the dot's DOM node — the no-replay proof compares identity */
const rememberDot = (probeId) => `(function(){
  var dot = document.querySelector('[data-canvas-ui="minimap-dot"][data-job-id="${probeId}"]');
  if (!dot) return JSON.stringify({ err: "no dot" });
  window.__t606dot = dot;
  return JSON.stringify({ ok: true });
})()`;

const dotNodeSame = `(function(){
  var f = window.__t606dot;
  if (!f) return JSON.stringify({ same: false, err: "no memory" });
  var id = f.getAttribute("data-job-id");
  var cur = document.querySelector('[data-canvas-ui="minimap-dot"][data-job-id="' + id + '"]');
  return JSON.stringify({ same: cur === f, connected: f.isConnected });
})()`;

const stopDotSampler = `(function(){
  if (window.__t606) window.__t606.on = false;
  if (window.__t606iv) { clearInterval(window.__t606iv); window.__t606iv = null; }
  var fr = (window.__t606 && window.__t606.frames) || [];
  return JSON.stringify({ n: fr.length, ticks: window.__t606 ? window.__t606.ticks : 0, maxGap: window.__t606 ? window.__t606.maxGap : 0 });
})()`;

const readDotFrames = `(function(){
  var fr = (window.__t606 && window.__t606.frames) || [];
  return JSON.stringify({ n: fr.length, frames: fr.slice(-260) });
})()`;

/* the deterministic merge trigger: the same listener a returning tab
 * fires (app-shell's visibilitychange → immediate pollTick) */
const FIRE_POLL = `(function(){
  document.dispatchEvent(new Event("visibilitychange"));
  return JSON.stringify({ fired: true, vis: document.visibilityState });
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

  console.log(`[boot] headless Chrome`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* fresh start */ }
  const chromeReady = await launchDesktopChrome();
  if (!chromeReady) {
    console.error("FATAL: the Chrome never opened its CDP port — environment shim failed");
    process.exit(2);
  }
  check("Chrome up", true, `port ${CDP_PORT}`);
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
  check("agent-browser connected", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
  await sleep(500);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);

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
  const hookHome = sh(`test -f src/lib/use-status-news.ts && rg -c "export function useStatusNews" src/lib/use-status-news.ts || true`);
  check("the hook's lib home exists and exports", parseInt(hookHome || "0", 10) >= 1, `lib refs=${hookHome}`);
  const localDef = sh(`rg -c "^function useStatusNews" src/components/workflow/job-card.tsx || true`);
  check("job-card has NO local hook def (moved, not copied)", localDef === "", localDef ? `leftover=${localDef}` : "clean");
  const jcRefs = sh(`rg -c "useStatusNews" src/components/workflow/job-card.tsx || true`);
  check("job-card: one import, two consumers", parseInt(jcRefs || "0", 10) >= 3, `refs=${jcRefs}`);
  const mmRefs = sh(`rg -c "MinimapDot|useStatusNews" src/components/workflow/canvas-minimap.tsx || true`);
  check("minimap: the dot component + the lib hook", parseInt(mmRefs || "0", 10) >= 4, `refs=${mmRefs}`);
  const mmKey = sh(`rg -c "key=\\{news\\}" src/components/workflow/canvas-minimap.tsx || true`);
  check("the dot's rect keys on the news counter (remount = one bloom)", parseInt(mmKey || "0", 10) >= 1, `refs=${mmKey}`);
  const mmNews = sh(`rg -c "data-news-floor" src/components/workflow/canvas-minimap.tsx || true`);
  check("the dot carries the FLOOR vocabulary (one semantic, one value)", parseInt(mmNews || "0", 10) >= 1, `refs=${mmNews}`);
  const mmDialect = sh(`rg -c "isSlurmQueued\\(job\\)" src/components/workflow/canvas-minimap.tsx || true`);
  check("the display word mirrors the queued dialect (t322 at map distance)", parseInt(mmDialect || "0", 10) >= 1, `refs=${mmDialect}`);
  const mmContract = sh(`rg -c "data-mm-dim|data-mm-find|data-mm-door" src/components/workflow/canvas-minimap.tsx || true`);
  check("the data-mm-* door/dim/find contract preserved (t139/t140)", parseInt(mmContract || "0", 10) >= 3, `refs=${mmContract}`);
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
  check("SERVED css carries the news face (two keyframes, two rules — no new css)", served && served.newsRules >= 4, `rules=${served && served.newsRules}`);
  const servedJs = sh(`rg -l "status-news" .next/dev/static/chunks/ 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served artifacts carry the news family", parseInt(servedJs || "0", 10) >= 1, `js=${servedJs}`);

  /* ---- Q — the world --------------------------------------------------- */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length,
    withNews: document.querySelectorAll('[data-canvas-ui="minimap-dot"][data-news-floor]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));
  check("no canonical dot carries a news face (all mounted, none transitioned)", counts && counts.withNews === 0, `withNews=${counts && counts.withNews}`);

  /* ---- W1 — THE RUNNING ARRIVAL AT MAP DISTANCE ------------------------- */
  console.log(`\n[W1] the running arrival — the poll's word reaches the map`);

  const extract = jobsOfActive().find((j) => j.type === "extract" && j.status === "completed");
  check("canonical extract found (the wire source)", !!extract, extract ? extract.id.slice(-8) : "none");
  {
    const repaired = repairWorld(extract);
    check("cluster-side extract inputs in place", repaired.length >= 0, repaired.length ? `restored: ${repaired.join(", ")}` : "already present");
  }

  const minted = api("/api/jobs", "POST", {
    type: "class2d", name: `t606 Map News Probe ${tag}`, x: 900, y: 620,
    params: { algorithm: "em", iterations: 3, numClasses: 4 },
  });
  probe = minted.job ?? minted;
  check("probe minted (a REAL card, born idle)", !!probe?.id && probe.status === "idle", probe ? `${probe.id} status=${probe.status}` : "none");
  if (!probe?.id) throw new Error("W1: probe unavailable");
  const wire = api("/api/edges", "POST", { fromJobId: extract.id, toJobId: probe.id });
  check("wired from extract", !!(wire.id || wire.edge?.id), wire.id ?? wire.edge?.id ?? "?");

  /* the page must SEE the dot idle before the news can arrive: the mint
   * was external (curl) — one pollTick merges the 13th card AND its dot
   * as born-idle (no bloom — a born state is not news), and only THEN
   * can idle→running be news the map can acknowledge */
  await readJson(FIRE_POLL);
  const merged13 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify((function(){
      var cards = document.querySelectorAll("[data-job]").length;
      var dot = document.querySelector('[data-canvas-ui="minimap-dot"][data-job-id="${probe.id}"]');
      return JSON.stringify({ cards: cards, hasDot: !!dot, fill: dot ? dot.getAttribute("fill") : null, attr: dot ? (dot.getAttribute("data-news-floor") || null) : null });
    })())`);
    return n && n.cards === 13 && n.hasDot ? n : null;
  }, 20000, 400);
  check("probe merged as a born-idle card + dot (13 cards)", merged13 && merged13.cards === 13 && merged13.hasDot, JSON.stringify(merged13));
  check("born-idle dot: grey fill, NO news attr (the mount law at map distance)",
    merged13 && merged13.fill === "#a1a1aa" && merged13.attr === null,
    `fill=${merged13 && merged13.fill} attr=${merged13 && merged13.attr}`);

  /* arm the dot sampler BEFORE the news can arrive */
  const arm = await readJson(dotSampler(probe.id));
  check("dot sampler armed", !!(arm && arm.ok), JSON.stringify(arm));

  /* the run: POST outside the page — the page knows nothing yet */
  const runRes = api(`/api/jobs/${probe.id}/run`, "POST", { remote: { connectionId: CONN, mode: "direct" } });
  const runJob = runRes.job ?? runRes;
  check("POST run accepted (mock cluster)", !runRes.error && runJob.status === "running", `status=${runJob.status}${runRes.error ? ` err=${String(runRes.error).slice(0, 80)}` : ""}`);

  /* the deterministic merge: the same pollTick a returning tab fires */
  const fired1 = await readJson(FIRE_POLL);
  check("visibilitychange pollTick fired", !!(fired1 && fired1.fired), fired1 ? `vis=${fired1.vis}` : "no");
  await sleep(4200);

  const fr1 = await readJson(readDotFrames);
  const f1 = (fr1 && fr1.frames) || [];
  const trueFrames1 = f1.filter((f) => f.attr === "true");
  check("dot remounted with the news attr", trueFrames1.length > 0, `first t=${trueFrames1.length ? trueFrames1[0].t : "—"}ms`);
  const bright1 = trueFrames1.map((f) => brightnessOf(f.filter)).filter((b) => b != null);
  const mid1 = bright1.filter((b) => b > 1.02 && b < 1.73);
  check("teal bloom caught MID-FLIGHT at map distance (brightness strictly interior)", mid1.length > 0,
    mid1.length ? `peak≈${Math.max(...bright1).toFixed(2)} mid=${mid1.length} frames` : `readings=${JSON.stringify(bright1.slice(0, 8))}`);
  /* the settled RUNNING face: ≥2 consecutive quiet teal frames — lived
   * in, not just passed through (the mock run may complete within this
   * window; what must hold is that running was SEEN settled, not that
   * the world stopped) */
  const idx1 = Math.max(0, f1.findIndex((f) => f.attr === "true"));
  let tealSteady = 0;
  for (let i = idx1; i < f1.length; i++) {
    const f = f1[i];
    if (f.fill === "#14b8a6" && (brightnessOf(f.filter) ?? 1) <= 1.02) { tealSteady++; if (tealSteady >= 2) break; }
    else if (f.fill !== "#14b8a6") tealSteady = 0;
  }
  check("bloom retired to a lived-in teal steady (the map's own color)", tealSteady >= 2, `quiet teal stretch=${tealSteady}`);

  mkdirSync(SHOTS, { recursive: true });
  sh(`agent-browser screenshot ${SHOTS}/t606-running-dot.png >/dev/null 2>&1 || true`);

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

  const fr2 = await readJson(readDotFrames);
  const f2 = (fr2 && fr2.frames) || [];
  const trueFrames2 = f2.filter((f) => f.attr === "true");
  const bright2 = trueFrames2.map((f) => brightnessOf(f.filter)).filter((b) => b != null);
  const mid2 = bright2.filter((b) => b > 1.02 && b < 1.73);
  check("emerald bloom caught MID-FLIGHT on the dot", mid2.length > 0,
    mid2.length ? `peak≈${Math.max(...bright2).toFixed(2)} mid=${mid2.length} frames` : `readings=${JSON.stringify(bright2.slice(0, 8))}`);
  const tail2 = f2.slice(-6);
  check("steady face is emerald (completed)", tail2.length > 0 && tail2.every((f) => f.fill === "#10b981"), `fill=${tail2.length ? tail2[tail2.length - 1].fill : "—"}`);
  const settled2 = tail2.every((f) => (brightnessOf(f.filter) ?? 1) <= 1.02);
  check("second bloom retired cleanly", settled2);

  sh(`agent-browser screenshot ${SHOTS}/t606-completed-dot.png >/dev/null 2>&1 || true`);

  /* ---- N — THE QUIET RENDER (no-op re-render does not replay) ---------- */
  console.log(`\n[N] the quiet render — a position write re-renders the dot, nothing replays`);

  const mem = await readJson(rememberDot(probe.id));
  check("dot node remembered", !!(mem && mem.ok), JSON.stringify(mem));
  api(`/api/jobs/${probe.id}`, "PATCH", { x: 901, y: 621 });
  const firedN = await readJson(FIRE_POLL);
  check("position merge fired", !!(firedN && firedN.fired));
  await sleep(2500);
  const same = await readJson(dotNodeSame);
  check("dot node identity preserved (no remount → no replay)", !!(same && same.same && same.connected), JSON.stringify(same));
  const frN = await readJson(readDotFrames);
  const fN = ((frN && frN.frames) || []).slice(-60);
  const replayN = fN.some((f) => (brightnessOf(f.filter) ?? 1) > 1.02);
  check("no brightness pulse in the quiet window", !replayN, `window=${fN.length} frames`);

  /* ---- W3 — THE RESET FACE at map distance ------------------------------ */
  console.log(`\n[W3] the reset face — completed→idle, the dot blooms slate`);

  api(`/api/jobs/${probe.id}`, "PATCH", { status: "idle" });
  const fired3 = await readJson(FIRE_POLL);
  check("reset merge fired", !!(fired3 && fired3.fired));
  await sleep(4200);

  /* the frames read FIRST — every later read burns the sampler window
   * and the 260-frame tail slides past the bloom (the t605 tuition) */
  const fr3 = await readJson(readDotFrames);
  const f3 = ((fr3 && fr3.frames) || []).slice(-260);
  const slateFrames = f3.filter((f) => f.fill === "#a1a1aa");
  const mid3 = slateFrames.map((f) => brightnessOf(f.filter)).filter((b) => b != null && b > 1.02 && b < 1.73);
  check("slate bloom caught MID-FLIGHT at map distance", mid3.length > 0,
    mid3.length ? `mid=${mid3.length} frames` : `tail=${JSON.stringify(f3.slice(-4).map((f) => [f.fill, f.filter.slice(0, 30)]))}`);
  const tail3 = f3.slice(-6);
  const settled3 = tail3.every((f) => f.fill === "#a1a1aa" && (brightnessOf(f.filter) ?? 1) <= 1.02);
  check("reset face settled (idle grey, no glow)", settled3, `fill=${tail3.length ? tail3[tail3.length - 1].fill : "—"}`);
  /* the settled read polls the LIVE DOM: with `both` fill the animation
   * STAYS APPLIED — the honest settled read is the geometry (brightness
   * back to 1), not the animation's absence (the t603 base-value law) */
  const settledLive = await readJson(`JSON.stringify((function(){
    var dot = document.querySelector('[data-canvas-ui="minimap-dot"][data-job-id="${probe.id}"]');
    if (!dot) return JSON.stringify({ err: "no dot" });
    var cs = getComputedStyle(dot);
    return JSON.stringify({ filter: cs.filter, fill: dot.getAttribute("fill"), anim: cs.animationName });
  })())`);
  check("settled dot polled LIVE (brightness at rest, animation stays applied)",
    settledLive && (brightnessOf(settledLive.filter) ?? 9) <= 1.02 && settledLive.fill === "#a1a1aa",
    JSON.stringify(settledLive));

  /* ---- R — the world owes nothing -------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  const stopF = await readJson(stopDotSampler);
  check("dot sampler retired with frames on record", !!(stopF && stopF.n > 0), `frames=${stopF && stopF.n} ticks=${stopF && stopF.ticks} maxGap=${stopF && stopF.maxGap}ms`);

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
  const dotsEnd = await readJson(`JSON.stringify(document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length)`);
  const rosterEnd = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
  check("roster 12→12, jobs 12, edges 13, dots 12 (borrowed, returned)",
    rosterEnd && rosterEnd.stats.total === 12 && jobsEnd === 12 && edgeCount === 13 && dotsEnd === 12,
    `jobs=${jobsEnd} edges=${edgeCount} dots=${dotsEnd} roster=${rosterEnd ? rosterEnd.stats.total : "—"}`);
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
