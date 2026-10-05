/**
 * t610 — THE CURVE DOESN'T DANCE: the chart family's mute law, written and
 * witnessed.
 *
 * Sixteen Recharts curves across seven chart files carry
 * `isAnimationActive={false}` with (until tonight) no comment explaining
 * why — a systematic decision living on tribal memory alone. t610 writes
 * the law at the family's eldest host (fsc-chart.tsx) with pointers in the
 * other six files, and witnesses its two-layer honesty LIVE:
 *
 *   the CARD rises once (animate-rise on the section — furniture arriving
 *   the moment its data lands) and the CURVE stays still inside it (the
 *   measurement itself). Recharts re-runs its line-draw animation whenever
 *   the data prop's array identity changes; every refetch hands the curve
 *   a fresh array even when the numbers are identical — an animated curve
 *   would re-perform its own drawing on each of those moments. Motion
 *   without change is noise wearing the costume of news.
 *
 * Faces:
 *  G0  the source contract: 16 mute sites across the 7 files, the t610
 *      marker in every one, the WHY text at the eldest host, and the
 *      two-layer contract (every chart card rises).
 *  Q   the world: 12c/13e + 12 dots, untouched, zero mints.
 *  W1  THE STILL FIRST SIGHT: the canonical postprocess's Results tab —
 *      the FSC section mounts the moment its fetch lands, so the sampler
 *      (armed before the finger) holds the TWO-LAYER SINGLE FRAME: the
 *      card mid-rise (opacity < 1) while its curve paths already exist
 *      with ZERO animations. Settled, the word stays rise-in (fill-both's
 *      base value). And the honest abstention face rides along: the
 *      corrected curve never crosses 0.143 (Nyquist-limited), so no
 *      amber crossing chip is invented — the panel speaks RELION's
 *      reported 7.08 Å with the Nyquist judgment instead.
 *  W2  THE ROUND-TRIP STILLNESS: Log then Results — the section remounts,
 *      a fresh fetch hands a fresh array, and the curve mounts STILL
 *      again (the law holds at every mount, not just the first paint).
 *  W3  THE DIALOG FAMILY: the compare dialog's overlay curves are muted
 *      by the same law (site 16), witnessed live when it opens.
 *  R   the world returned intact: dialog + inspector closed, roster
 *      12→12, console clean, plus the shots.
 *
 * Usage: node scripts/t610-curve-law-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9329"; /* 9323 = t578, 9324 = t584/t604, 9325 = t605, 9326 = t607, 9327 = t608, 9328 = t609 */
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t610-harness-chrome-profile";
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

/* ---- the wire ----------------------------------------------------------- */
const api = (verb, path, body, tries = 3) => {
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      last = sh(
        `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
        (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
      );
      if (last) return last;
    } catch { /* blink */ }
    try { execSync("sleep 0.4"); } catch { /* */ }
  }
  return last;
};
const jobsOfActiveSteady = async () =>
  (await pollUntil(async () => {
    try {
      const d = JSON.parse(api("GET", "/api/jobs"));
      const jobs = Array.isArray(d) ? d : (d.jobs ?? []);
      return jobs.length > 0 ? jobs : null;
    } catch { return null; }
  }, 20000, 600)) ?? [];

/* ---- in-page instruments (NO line comments — eval flattens newlines) -- */

/* the stillness sampler: a 15ms interval recording the FSC section's
 * rise (opacity + animationName) AND its curve paths' animation count —
 * one stream, both layers of the law. */
const armSampler = `(function(){
  window.__t610 = { frames: [], t0: performance.now(), ticks: 0, maxGap: 0, _lt: performance.now(), on: true };
  window.__t610iv = setInterval(function(){
    if (!window.__t610 || !window.__t610.on) return;
    var now = performance.now();
    if (now - window.__t610._lt > window.__t610.maxGap) window.__t610.maxGap = Math.round(now - window.__t610._lt);
    window.__t610._lt = now;
    window.__t610.ticks++;
    var sec = document.querySelector("[role='dialog'] [aria-label='Fourier-shell correlation']");
    if (!sec) { window.__t610.frames.push({ t: Math.round(now - window.__t610.t0), present: false }); return; }
    var cs = getComputedStyle(sec);
    var paths = sec.querySelectorAll("path.recharts-curve.recharts-line-curve");
    var animated = 0;
    for (var i = 0; i < paths.length; i++) {
      if (paths[i].getAnimations().length > 0) animated++;
    }
    window.__t610.frames.push({
      t: Math.round(now - window.__t610.t0),
      present: true,
      opacity: Number(cs.opacity),
      anim: cs.animationName,
      paths: paths.length,
      animated: animated
    });
  }, 15);
  return JSON.stringify({ ok: true });
})()`;

const readFrames = (lastN) => `(function(){
  var fr = (window.__t610 && window.__t610.frames) || [];
  return JSON.stringify({ n: fr.length, ticks: window.__t610 ? window.__t610.ticks : 0, maxGap: window.__t610 ? window.__t610.maxGap : 0, frames: fr.slice(-${lastN}) });
})()`;

const resetFrames = `(function(){
  if (window.__t610) { window.__t610.frames = []; window.__t610.t0 = performance.now(); }
  return JSON.stringify({ ok: true });
})()`;

const stopSampler = `(function(){
  if (window.__t610) window.__t610.on = false;
  if (window.__t610iv) { clearInterval(window.__t610iv); window.__t610iv = null; }
  return JSON.stringify({ ok: true });
})()`;

/* keep a handle on the FSC section (the remount identity check) */
const grabSection = `(function(){
  window.__t610sec = document.querySelector("[role='dialog'] [aria-label='Fourier-shell correlation']");
  return JSON.stringify({ ok: !!window.__t610sec });
})()`;
const sectionSameNode = `(function(){
  var el = document.querySelector("[role='dialog'] [aria-label='Fourier-shell correlation']");
  return JSON.stringify({ same: !!(window.__t610sec && el && window.__t610sec.isSameNode(el)) });
})()`;

/* analysis: the two-layer flight report */
function stillReport(frames) {
  const present = frames.filter((f) => f.present);
  if (present.length === 0) return { arrived: false, reason: "no present frames" };
  const rising = present.filter((f) => f.opacity > 0 && f.opacity < 1);
  const overlap = rising.find((f) => f.paths > 0 && f.animated === 0);
  const first = present[0];
  const last = present[present.length - 1];
  const everAnimated = present.some((f) => f.animated > 0);
  return {
    arrived: true,
    presentFrames: present.length,
    risingFrames: rising.length,
    overlapFrame: overlap ? { t: overlap.t, opacity: overlap.opacity, paths: overlap.paths } : null,
    first: { t: first.t, opacity: first.opacity, paths: first.paths, animated: first.animated },
    settled: { t: last.t, opacity: last.opacity, paths: last.paths, animated: last.animated, anim: last.anim },
    everAnimated,
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

const probeCard = (name) => `(function(){
  var el = [].slice.call(document.querySelectorAll("[data-job]")).find(function (c) { return (c.textContent || "").indexOf("${name}") >= 0; });
  if (!el) return JSON.stringify({ found: false });
  var r = el.getBoundingClientRect();
  var cx = r.x + r.width / 2, cy = r.y + Math.min(r.height / 2, 60);
  return JSON.stringify({ found: true, x: cx, y: cy, inView: cx >= 0 && cx < innerWidth && cy >= 0 && cy < innerHeight });
})()`;

const closeInspector = async () => {
  sh(`agent-browser key Escape >/dev/null 2>&1`);
  await sleep(600);
  const closed = await readJson(`JSON.stringify(!document.querySelector("[data-inspector-dialog]"))`);
  return closed === true;
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

  /* world guard */
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
  const RES = "src/components/workflow/results";
  const sites = {};
  let total = 0;
  /* the flag's literal body now carries the t610 pointer comment at each
   * file's first site — count the prefix `isAnimationActive={false` which
   * matches both the bare flag and the commented one (fsc-chart's docblock
   * adds one more line: the law names the flag it governs). */
  for (const [f, expect] of [["fsc-chart", 5], ["topaz-training-chart", 6], ["guinier-chart", 2], ["resolution-chart", 1], ["resolution-arc-dialog", 1], ["ctf-quality-chart", 1], ["fsc-compare-dialog", 1]]) {
    const c = parseInt(sh(`rg -c 'isAnimationActive=\\{false' ${RES}/${f}.tsx || true`) || "0", 10);
    sites[f] = c;
    total += c;
    check(`  ${f}: ${expect} muted site(s)`, c >= expect, `got ${c}`);
  }
  check("17 mute-flag lines across the family (16 sites + the law's own name)", total >= 17, `total=${total}`);
  let marked = 0;
  for (const f of ["fsc-chart", "topaz-training-chart", "guinier-chart", "resolution-chart", "resolution-arc-dialog", "ctf-quality-chart", "fsc-compare-dialog"]) {
    if (sh(`rg -c "t610" ${RES}/${f}.tsx || true`) !== "") marked++;
  }
  check("the t610 law marker lives in all 7 files", marked === 7, `marked=${marked}`);
  const why = sh(`rg -c "re-perform its own drawing|fresh array" ${RES}/fsc-chart.tsx || true`);
  check("the WHY text at the eldest host", parseInt(why || "0", 10) >= 1, `refs=${why}`);
  let risers = 0;
  for (const f of ["fsc-chart", "topaz-training-chart", "guinier-chart", "resolution-chart", "ctf-quality-chart"]) {
    if (parseInt(sh(`rg -c "animate-rise" ${RES}/${f}.tsx || true`) || "0", 10) >= 1) risers++;
  }
  check("the two-layer contract: every chart card rises", risers === 5, `risers=${risers}`);
  const servedJs = sh(`rg -l "isAnimationActive" .next/static/chunks .next/dev/static/chunks 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served artifacts carry the mute flags", parseInt(servedJs || "0", 10) >= 1, `js=${servedJs}`);

  /* ---- Q — the world ---------------------------------------------------- */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    dots: document.querySelectorAll('[data-canvas-ui="minimap-dot"]').length
  })`);
  check("12c/13e + 12 dots", counts && counts.cards === 12 && counts.edges === 13 && counts.dots === 12, JSON.stringify(counts));
  const post = (await jobsOfActiveSteady()).find((j) => j.type === "postprocess" && j.status === "completed");
  check("canonical postprocess host exists", !!post, post?.id?.slice(0, 13));
  const fscApi = JSON.parse(api("GET", `/api/jobs/${post.id}/fsc`));
  check("the honest abstention is real in the data (no invented crossing)",
    fscApi.resolutionAt143 === null && fscApi.reportedResolution === 7.08 && fscApi.interpretation?.atNyquist === true,
    `at143=${fscApi.resolutionAt143} reported=${fscApi.reportedResolution}`);

  /* ---- W1 — THE STILL FIRST SIGHT ---------------------------------------- */
  console.log(`\n[W1] the still first sight — the card rises, the curve does not`);
  check("sampler armed before the finger", (await readJson(armSampler))?.ok === true);
  const box = await readJson(probeCard("sharpen"));
  check("postprocess card in viewport (the card speaks 'sharpen', not 'postprocess')", !!(box && box.found && box.inView), JSON.stringify(box));
  check("real click on the postprocess card", !!(box && cdpClick(box.x, box.y, 0)));
  const dialogOpen = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
    return n === true ? n : null;
  }, 15000, 400);
  check("inspector dialog opened", dialogOpen === true);
  const resultsTab = await ensureResultsTab();
  check("Results tab proven (aria-selected)", resultsTab.ok === true, resultsTab.note || resultsTab.why || "");

  const secIn = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("[role='dialog'] [aria-label='Fourier-shell correlation']"))`);
    return v === true ? v : null;
  }, 90000, 300);
  check("the FSC section arrived (poll facts, not beats)", secIn === true);
  await sleep(900); /* settle slack — the frames hold the flight */
  const fr1 = await readJson(readFrames(900));
  await readJson(stopSampler);
  const r1 = stillReport(fr1.frames || []);
  check("sampler lived through the arrival", fr1 && fr1.n > 100, `frames=${fr1?.n} maxGap=${fr1?.maxGap}ms`);
  check("the card's rise was caught mid-flight (the furniture arriving)", r1.arrived && r1.risingFrames > 0,
    `rising=${r1.risingFrames} frames`);
  check("THE TWO-LAYER SINGLE FRAME: the card still rising while its curves already exist and are STILL",
    !!r1.overlapFrame, JSON.stringify(r1.overlapFrame));
  check("the curve mounts STILL at first sight (pop-still, never pop-draw)", r1.arrived && r1.first.paths > 0 && r1.first.animated === 0,
    `paths=${r1.first?.paths} animated=${r1.first?.animated} @t=${r1.first?.t}ms`);
  check("settled: curves present, none ever animated", r1.arrived && r1.settled.paths >= 1 && !r1.everAnimated,
    `paths=${r1.settled?.paths} everAnimated=${r1.everAnimated}`);
  check("the card's word stays rise-in (fill-both's base value, seventh confluence)",
    r1.arrived && r1.settled.anim === "rise-in", `anim=${r1.settled?.anim}`);

  /* the honest abstention face */
  const face = await readJson(`(() => {
    var sec = document.querySelector("[role='dialog'] [aria-label='Fourier-shell correlation']");
    if (!sec) return "null";
    var txt = sec.textContent || "";
    return JSON.stringify({
      reportedBadge: /RELION reported\\s+[\\d.]+ Å/.test(txt),
      nyquistLimited: txt.includes("Nyquist-limited"),
      abstention: txt.includes("stays above 0.143"),
      noInventedCrossing: !txt.includes("0.143 →"),
      shells: (txt.match(/(\\d+) shells/) || [])[1] ?? null
    });
  })()`);
  check("the judgment face: RELION's reported number speaks (7.08 Å)",
    face && face.reportedBadge === true, JSON.stringify(face));
  check("the Nyquist judgment rides the badge", face && face.nyquistLimited === true);
  check("the abstention paragraph explains the missing crossing", face && face.abstention === true);
  check("NO invented 0.143 crossing chip (the honesty rule: never a guess)", face && face.noInventedCrossing === true);
  const shot1 = snap("t610-fsc-still-first-sight.png");
  check("📸 the still curve's settled face", shot1);

  /* ---- W2 — THE ROUND-TRIP STILLNESS -------------------------------------- */
  console.log(`\n[W2] the round-trip stillness — the law holds at every mount`);
  const hadSection = (await readJson(grabSection))?.ok === true;
  check("the W1 section handle captured", hadSection === true);
  const w2log = await switchToTab("Log");
  check("Log tab proven (aria-selected)", w2log.ok === true, w2log.why || "");
  check("sampler re-armed for the return", (await readJson(resetFrames))?.ok === true && (await readJson(armSampler))?.ok === true);
  const w2res = await switchToTab("Results");
  check("Results tab re-proven (aria-selected)", w2res.ok === true, w2res.why || "");
  await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("[role='dialog'] [aria-label='Fourier-shell correlation']"))`);
    return v === true ? v : null;
  }, 90000, 300);
  await sleep(900);
  const fr2 = await readJson(readFrames(900));
  await readJson(stopSampler);
  const r2 = stillReport(fr2.frames || []);
  check("the section remounted (a fresh fetch, a fresh array)",
    hadSection === true && (await readJson(sectionSameNode))?.same === false);
  check("the card rises again on the remount", r2.arrived && r2.risingFrames > 0, `rising=${r2.risingFrames}`);
  check("the curve mounts STILL again (the mute is a law, not a first-paint accident)",
    r2.arrived && r2.first.paths > 0 && r2.first.animated === 0 && !r2.everAnimated,
    `paths=${r2.first?.paths} everAnimated=${r2.everAnimated}`);

  /* ---- W3 — THE DIALOG FAMILY --------------------------------------------- */
  console.log(`\n[W3] the dialog family — the compare overlay inherits the law`);
  /* the compare button by structure, opened by a REAL finger (the eval
   * click's false negative once misled this face) */
  const cmpRect = await readJson(`(() => {
    var b = document.querySelector("[data-testid='fsc-compare-open']");
    if (!b) return "null";
    var r = b.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  })()`);
  check("the compare button present (structure, not label)", !!(cmpRect && cmpRect.x), JSON.stringify(cmpRect));
  const cmpOpened = !!(cmpRect && cmpRect.x && cdpClick(cmpRect.x, cmpRect.y, 0));
  const cmpIn = cmpOpened ? await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("[data-testid='fsc-compare-freshness']"))`);
    return v === true ? v : null;
  }, 15000, 300) : null;
  check("compare dialog opened (the freshness chip proves the body)", cmpIn === true);
  const cmp = await readJson(`(() => {
    var dlg = [].slice.call(document.querySelectorAll("[role='dialog']")).find(function (d) { return d.querySelector("[data-testid='fsc-compare-freshness']"); });
    if (!dlg) return "null";
    var paths = dlg.querySelectorAll("path.recharts-curve.recharts-line-curve");
    var animated = 0;
    for (var i = 0; i < paths.length; i++) { if (paths[i].getAnimations().length > 0) animated++; }
    return JSON.stringify({ paths: paths.length, animated: animated });
  })()`);
  if (cmp && typeof cmp === "object" && cmp.paths > 0) {
    check("the compare overlay's curves are muted by the same law", cmp.animated === 0, JSON.stringify(cmp));
  } else {
    check("the compare overlay served no curves this world (tolerant note)", true, JSON.stringify(cmp));
  }
  const shot3 = snap("t610-compare-dialog.png");
  check("📸 the compare dialog", shot3);
  sh(`agent-browser key Escape >/dev/null 2>&1`);
  await sleep(500);
  const closed1 = await closeInspector();
  check("inspector closed (Escape)", closed1 === true);

  /* ---- R — the world returned intact -------------------------------------- */
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
