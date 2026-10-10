/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t613 — the spotlight's own wave (witness).
 *
 * The active-project spotlight's remaining faces join the arrival grammar
 * their analytics siblings started (t611/t612). The probe corrected the
 * design before a line was written: the "quick actions" of the entry
 * note never existed (stale ledger), the homecoming sweep DOES carry a
 * story in this world (it is a face, not chrome). t613 delivers: banner
 * → stage label → StageChips (chevrons riding) → jobs label → sweep →
 * roster rows, all in reading order with the receipt's own word — zero
 * new keyframes. The tail keeps a MOUNT LEDGER: the roster is
 * newest-first, so a positional index would shift every delay when a
 * job prepends (re-render becoming re-arrival); tickets are assigned
 * once and never rewritten.
 *
 *   G0  served css contracts (parsed style, not cssText): the spot rule
 *       group rides receipt-arrival with var(--sd); the reduce gate
 *       covers every face; the family keyframes stay defined EXACTLY
 *       once each (no new words).
 *   Q   the canonical world: 12 cards / 13 edges / 12 dots.
 *   W1  THE SPOT WAVE: sampler installed before the finger; first sight
 *       holds the from-state across every face; the delays land the
 *       arithmetic (banner 350, label 374, chips 398+24i, jobs label
 *       686, sweep 710, rows 734+24i → last 998); chevrons ride their
 *       chips; chrome stays silent in EVERY frame; the digits never
 *       move; the analytics control still speaks (t611 undisturbed).
 *       (The descent lines and the reading-order single frames belong
 *       to W3 — the cold open's compile+hydration burst starves the
 *       8ms grid through whichever 24ms window it pleases.)
 *       G0b: served js carries the hooks (hunted after the compile).
 *   W2  THE QUIET RE-RENDER + THE LEDGER WITNESSED: a real click on the
 *       Completed chip hides the never-ran row — the 11 present rows
 *       are the SAME nodes with unchanged delays; restoring All brings
 *       the hidden row back ON ITS ORIGINAL TICKET (a positional scheme
 *       would hand it the newest slot's delay; the ledger hands back
 *       its frozen one).
 *   W3  THE ROUND-TRIP: close confirmed → tape emptied → reopen → the
 *       remount replays honestly with the SAME wave the first mount
 *       sang (fresh ledger, identical tickets).
 *   R   the world returned intact: no mints, roster 6/1, 12 jobs,
 *       console clean. 📸×2.
 *
 * Usage: node scripts/t613-spot-wave-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* CDP dedicated port 9333 (9323 = t578, 9324 = t584/t604, 9325 = t605,
 * 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610, 9330 = t611,
 * 9331 = t612 probe, 9332 = t613 probe) + fresh profile */
const CDP_PORT = "9333";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t613-witness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const CDP_CLICK = "scripts/t604-cdp-shift-click.mjs";
const SHOTS = ".qa-logs/shots";
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
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const shSoft = (cmd) => { try { return sh(cmd); } catch { return ""; } };
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
const snap = (name) => {
  try {
    const out = sh(`agent-browser screenshot 2>/dev/null || true`).trim();
    const m = /saved to (\S+)/.exec(out);
    if (m) {
      execSync(`mkdir -p ${SHOTS} && cp "${m[1]}" "${SHOTS}/${name}"`);
      return true;
    }
    return false;
  } catch { return false; }
};
/* the dashboard toggle: Shift+D on a plain window keydown listener (t611
 * recon: not a Radix controlled component — the view appearing is the
 * proof) */
const shiftD = () => readJson(`(() => {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "D", shiftKey: true, bubbles: true, cancelable: true }));
  return JSON.stringify(true);
})()`);
/* the sampler: installed BEFORE the finger, records every 8ms — the
 * spotlight's faces AND the chrome that must stay silent beside them.
 * The banner's count text rides along: the digits are the no-count-up
 * witness (the engine did the counting; the surface only arrives). */
const installSampler = () => readJson(`(() => {
  window.__t613 = { on: true, frames: [] };
  const rd = (el) => {
    if (!el) return null;
    const c = getComputedStyle(el);
    return { o: c.opacity, tr: c.transform, an: c.animationName, d: c.animationDelay };
  };
  window.__t613iv = setInterval(() => {
    if (!window.__t613.on) return;
    const spot = document.querySelector("section[aria-label='Active project spotlight']");
    if (!spot) { window.__t613.frames.push({ t: Math.round(performance.now()), none: true }); return; }
    const chips = [...spot.querySelectorAll("[data-spot-chip]")];
    const links = [...spot.querySelectorAll("[data-spot-link]")];
    const rows = [...spot.querySelectorAll("[data-spot-row]")];
    const search = spot.querySelector("[data-testid='roster-search-input']");
    const allChip = [...spot.querySelectorAll("button")].find((b) => (b.textContent || "").trim().indexOf("All ") === 0);
    const digits = spot.querySelector("[data-spot-banner] span.ml-auto");
    window.__t613.frames.push({
      t: Math.round(performance.now()),
      banner: rd(spot.querySelector("[data-spot-banner]")),
      stagelabel: rd(spot.querySelector("[data-spot-stagelabel]")),
      chips: chips.map(rd),
      links: links.map(rd),
      jobslabel: rd(spot.querySelector("[data-spot-jobslabel]")),
      sweep: rd(spot.querySelector("[data-spot-sweep]")),
      rows: rows.map(rd),
      chrome: { search: rd(search), all: rd(allChip) },
      digits: digits ? digits.textContent.trim() : "",
    });
  }, 8);
  return JSON.stringify(true);
})()`);
const stopSampler = () => readJson(`(() => {
  window.__t613.on = false;
  if (window.__t613iv) clearInterval(window.__t613iv);
  return JSON.stringify(window.__t613.frames.length);
})()`);
/* EMPTY THE TAPE after the old world is confirmed gone (t611/t612
 * tuition: the first frames of a new recording must not be the old
 * world's settled frames) */
const resetSampler = async () => { await stopSampler(); return installSampler(); };
const tyOf = (tr) => {
  const m = /matrix\(([-0-9., e]+)\)/.exec(tr || "");
  return m ? parseFloat(m[1].split(",")[5]) : null;
};

/* the wave's expected arithmetic (canonical: 12 chips + 12 rows) — the
 * contract the delays must land on, computed from the SAME constants the
 * component reads (SPOT_BASE_MS=350, SPOT_STEP_MS=24; tail base counts
 * banner + stage label + the frozen 12 chips) */
const BASE_S = 0.35, STEP_S = 0.024, TAIL_BASE_S = 0.35 + (2 + 12) * STEP_S;

let chromeUp = false;
try {
  console.log("[boot] close-all + desktop Chrome on " + CDP_PORT);
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
      const out = shSoft(`agent-browser connect ${CDP_PORT} 2>&1`);
      connected = !/relaunched|failed|✗/i.test(out);
      if (!connected) console.log(`  … connect attempt ${i + 1}: ${out.slice(0, 80)}`);
    } catch { await sleep(800); }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected to desktop Chrome", connected, `port ${CDP_PORT}`);
  shSoft(`agent-browser open ${BASE} >/dev/null 2>&1`);
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

  /* ---------- G0: served css contracts (the css chunk ships with the
     app shell, so the walk works before the dashboard ever opens) ---------- */
  console.log("\n[G0] contracts");
  const served = await readJson(`(() => {
    const out = { kf: [], sel: [], sty: [] };
    for (const sheet of document.styleSheets) {
      let rules = null;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      const walk = (list) => {
        for (const r of list) {
          const t = r.cssText || "";
          if (t.indexOf("@keyframes") !== -1) out.kf.push(t);
          if (t.indexOf("data-spot-") !== -1) out.sel.push(t);
          if (r.selectorText && r.style && r.selectorText.indexOf("data-spot-") !== -1 && r.style.animationName) {
            out.sty.push({ sel: r.selectorText, name: r.style.animationName, delay: r.style.animationDelay, dur: r.style.animationDuration });
          }
          if (r.cssRules && r.cssRules.length) walk(r.cssRules);
        }
      };
      walk(rules);
    }
    return JSON.stringify(out);
  })()`);
  const kfNames = (served?.kf || []).map((k) => /@keyframes\s+([\w-]+)/.exec(k)?.[1]).filter(Boolean);
  const once = (n) => kfNames.filter((k) => k === n).length;
  check("served css: the family's words stay defined EXACTLY once each (no new keyframe was minted)",
    once("receipt-arrival") === 1 && once("flow-pour") === 1 && once("dash-enter") === 1 && once("rise-in") === 1,
    `receipt=${once("receipt-arrival")} pour=${once("flow-pour")} dash=${once("dash-enter")} rise=${once("rise-in")}`);
  /* read the PARSED style, not the serialized text (t612 tuition ③: the
   * serializer is a witness, not the contract). The t613 rule is a GROUP
   * of seven faces — read it whole (t612 tuition ④: no exclusive
   * filtering). */
  const spotSty = (served?.sty || []).filter((s) => s.sel.includes("data-spot-arrival"));
  check("served css: the spot wave rides receipt-arrival with var(--sd)",
    spotSty.some((s) => s.name === "receipt-arrival" && (s.delay || "").includes("--sd") && s.dur === "0.24s"),
    JSON.stringify(spotSty.map((s) => ({ name: s.name, delay: s.delay, dur: s.dur }))));
  check("served css: the rule names every face (banner/label/chip/link/jobslabel/sweep/row — the group read whole)",
    spotSty.some((s) => s.sel.includes("data-spot-banner") && s.sel.includes("data-spot-stagelabel") &&
      s.sel.includes("data-spot-chip") && s.sel.includes("data-spot-link") &&
      s.sel.includes("data-spot-jobslabel") && s.sel.includes("data-spot-sweep") &&
      s.sel.includes("data-spot-row")),
    `faces in group: ${(spotSty[0]?.sel || "").split(",").length}`);
  check("served css: reduce gate covers the spot faces",
    (served?.sel || []).some((s) => s.includes("prefers-reduced-motion") && s.includes("data-spot-row") && s.includes("data-spot-banner")));
  check("served css: the wave never names the chrome (lenses are not faces)",
    (served?.sel || []).filter((s) => s.includes("data-spot-")).every((s) => !s.includes("roster-search") && !s.includes("data-filter")),
    "");

  /* ---------- W1: THE SPOT WAVE ---------- */
  console.log("\n[W1] the spot wave");
  check("sampler installed before the finger", (await installSampler()) === true);
  const opened = await shiftD();
  check("Shift+D dispatched", opened === true);
  const facesReady = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-spot-row]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 60000, 300);
  check("spotlight faces present (poll facts, not beats — the first open compiles the dashboard chunk)", facesReady === 12, `rows=${facesReady}`);
  await sleep(2200);
  const stopped = await stopSampler();
  check("sampler stopped with a full tape", (stopped || 0) > 100, `frames=${stopped}`);

  const A = await readJson(`(() => {
    const F = (window.__t613.frames || []).filter((f) => f.banner && f.rows && f.rows.length === 12 && f.chips.length === 12);
    if (!F.length) return JSON.stringify({ ok: false, why: "no frames with the full face set" });
    const first = F[0];
    const interior = (el) => F.map((f) => f[el]).filter((x) => x && parseFloat(x.o) > 0.001 && parseFloat(x.o) < 0.999);
    const bannerInt = interior("banner");
    const bannerTys = bannerInt.map((f) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(f.tr); return m ? parseFloat(m[1].split(",")[5]) : null; }).filter((v) => v != null);
    const nonIncreasing = bannerTys.every((v, i) => i === 0 || v <= bannerTys[i - 1] + 0.001);
    const distinct = new Set(bannerTys.map((v) => Math.round(v * 1000))).size >= 2;
    const row0Int = F.filter((f) => { const o = parseFloat(f.rows[0].o); return o > 0.001 && o < 0.999; });
    const row0Tys = row0Int.map((f) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(f.rows[0].tr); return m ? parseFloat(m[1].split(",")[5]) : null; }).filter((v) => v != null);
    const row0NonInc = row0Tys.every((v, i) => i === 0 || v <= row0Tys[i - 1] + 0.001);
    const row0Distinct = new Set(row0Tys.map((v) => Math.round(v * 1000))).size >= 2;
    const settled = F[F.length - 1];
    const chromeEverAnim = F.some((f) => (f.chrome.search && f.chrome.search.an !== "none") || (f.chrome.all && f.chrome.all.an !== "none"));
    const digitsConst = F.every((f) => f.digits === F[0].digits);
    const linkRides = F.every((f) => f.links.every((l, i) => Math.abs(parseFloat(l.d) - parseFloat(f.chips[i + 1].d)) < 0.0015));
    const bannerReading = F.find((f) => parseFloat(f.banner.o) > 0.05 && parseFloat(f.stagelabel.o) < 0.05);
    const rowReading = F.find((f) => parseFloat(f.rows[0].o) > 0.05 && parseFloat(f.rows[1].o) < 0.05);
    const flow = document.querySelector("[data-analytics-arrival] [data-flow-row]");
    return JSON.stringify({
      ok: true, n: F.length,
      first: {
        banner: first.banner, stagelabel: first.stagelabel,
        chip0: first.chips[0], chipLast: first.chips[11],
        jobslabel: first.jobslabel, sweep: first.sweep,
        row0: first.rows[0], rowLast: first.rows[11],
      },
      bannerTys: bannerTys.slice(0, 6), nonIncreasing, distinct,
      row0Tys: row0Tys.slice(0, 6), row0NonInc, row0Distinct,
      chipDelays: settled.chips.map((c) => c.d),
      rowDelays: settled.rows.map((r) => r.d),
      linkRides,
      chromeEverAnim, digitsConst, digitsSample: F[0].digits,
      bannerReading: bannerReading ? { bo: bannerReading.banner.o, so: bannerReading.stagelabel.o } : null,
      rowReading: rowReading ? { o0: rowReading.rows[0].o, o1: rowReading.rows[1].o } : null,
      settled: {
        banner: settled.banner, stagelabel: settled.stagelabel, jobslabel: settled.jobslabel,
        sweep: settled.sweep, chip0: settled.chips[0], row0: settled.rows[0], rowLast: settled.rows[11],
      },
      flowDelay: flow ? getComputedStyle(flow).animationDelay : null,
    });
  })()`);
  if (!A?.ok) {
    check("W1 tape analyzable", false, A?.why || "no data");
  } else {
    check("W1 first sight holds the from-state (banner o=0, receipt-arrival, d=0.35s)",
      parseFloat(A.first.banner.o) < 0.05 && A.first.banner.an === "receipt-arrival" && Math.abs(parseFloat(A.first.banner.d) - 0.35) < 0.002,
      `o=${A.first.banner.o} an=${A.first.banner.an} d=${A.first.banner.d}`);
    check("W1 the stage label rides the next beat (0.374s)",
      Math.abs(parseFloat(A.first.stagelabel.d) - (BASE_S + STEP_S)) < 0.002, `d=${A.first.stagelabel.d}`);
    const chipD = A.chipDelays.map(parseFloat);
    check("W1 the chips cascade in reading order (0.398 + 24ms × i)",
      Math.abs(chipD[0] - (BASE_S + 2 * STEP_S)) < 0.002 &&
      chipD.every((v, i) => i === 0 || Math.abs((v - chipD[i - 1]) - STEP_S) < 0.0015) &&
      Math.abs(chipD[11] - (BASE_S + 13 * STEP_S)) < 0.002,
      `first=${chipD[0]} last=${chipD[11]}`);
    check("W1 each chevron rides the chip it introduces (link i == chip i+1)",
      A.linkRides === true);
    check("W1 the tail lands the ledger's arithmetic (jobs label 0.686, sweep 0.710)",
      Math.abs(parseFloat(A.first.jobslabel.d) - TAIL_BASE_S) < 0.002 &&
      A.first.sweep !== null && Math.abs(parseFloat(A.first.sweep.d) - (TAIL_BASE_S + STEP_S)) < 0.002,
      `label=${A.first.jobslabel.d} sweep=${A.first.sweep?.d}`);
    const rowD = A.rowDelays.map(parseFloat);
    check("W1 the roster rows continue the wave (0.734 + 24ms × i, last 0.998)",
      Math.abs(rowD[0] - (TAIL_BASE_S + 2 * STEP_S)) < 0.002 &&
      rowD.every((v, i) => i === 0 || Math.abs((v - rowD[i - 1]) - STEP_S) < 0.0015) &&
      Math.abs(rowD[11] - (TAIL_BASE_S + 13 * STEP_S)) < 0.002,
      `first=${rowD[0]} last=${rowD[11]}`);
    /* the DESCENT LINES and the READING-ORDER single frames belong to the
     * WARM world (t612 tuition ⑤, met again: the cold first open's
     * compile + hydration burst starved the 8ms grid exactly through the
     * banner's 350-590ms window — the rows' later window survived). The
     * cold tape owns from-state, delays, chrome, digits, settled; W3's
     * warm remount owns the lines. */
    check("CHROME NEVER RIDES: the search box and the All chip stay silent in EVERY frame",
      A.chromeEverAnim === false);
    check("W1 the digits never move (no count-up — the engine did the counting)",
      A.digitsConst === true, A.digitsSample);
    check("W1 the settled face keeps its word (fill-both's base value, the tenth confluence)",
      ["banner", "stagelabel", "jobslabel", "sweep", "chip0", "row0", "rowLast"].every((k) =>
        A.settled[k] && A.settled[k].an === "receipt-arrival" && A.settled[k].o === "1" && tyOf(A.settled[k].tr) === 0),
      `banner o=${A.settled.banner.o} rowLast o=${A.settled.rowLast.o}`);
    check("W1 the analytics control still speaks (t611's grammar undisturbed — flow row 0 at 0.35s)",
      A.flowDelay !== null && Math.abs(parseFloat(A.flowDelay) - 0.35) < 0.002, `d=${A.flowDelay}`);
    check("📸 settled", snap("t613-spot-settled.png"));
  }

  /* ---------- G0b: served js (the dashboard chunk exists now) ---------- */
  console.log("\n[G0b] served js");
  const servedJs = sh(`rg -l "data-spot-arrival" .next/static/chunks .next/dev/static/chunks 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served js: the scope hook lives in the compiled chunks (hunted where the prey lives)",
    Number(servedJs) >= 1, `chunks=${servedJs}`);
  /* ---------- W2: THE QUIET RE-RENDER + THE LEDGER WITNESSED ---------- */
  console.log("\n[W2] the quiet re-render + the ledger");
  /* stash the row nodes AND their tickets BY ID in-page (node identity
   * cannot cross an eval boundary — t611's law; and the ledger's whole
   * point is that a ticket belongs to a JOB, not to a list position) */
  const stashed = await readJson(`(() => {
    const spot = document.querySelector("section[aria-label='Active project spotlight']");
    const trs = [...spot.querySelectorAll("tbody tr[data-spot-row]")];
    window.__t613rows = trs;
    window.__t613tickets = {};
    for (const tr of trs) {
      const btn = tr.querySelector("button[title]");
      const idGuess = tr.getAttribute("data-spot-row-id") || "";
      const key = btn ? (btn.getAttribute("title") || "").slice(0, 40) : tr.rowIndex;
      window.__t613tickets[key] = getComputedStyle(tr).animationDelay;
    }
    window.__t613keys = trs.map((tr) => {
      const btn = tr.querySelector("button[title]");
      return btn ? (btn.getAttribute("title") || "").slice(0, 40) : String(tr.rowIndex);
    });
    return JSON.stringify(trs.length);
  })()`);
  check("row nodes + tickets stashed by title-key in-page", stashed === 12, `stashed=${stashed}`);

  /* scroll, WAIT, then measure with an elementFromPoint verification —
   * run 3 measured correctly and hit; run 4 measured the same coords but
   * the compositor had not committed the scroll yet, and the CDP click
   * landed on the pre-scroll content (same coords, different world).
   * The verify-retry loop is the honest broker: the click only fires
   * when the chip is CONFIRMED under the crosshair. */
  const locateChip = async (text) => {
    for (let i = 0; i < 3; i++) {
      await readJson(`(() => {
        const spot = document.querySelector("section[aria-label='Active project spotlight']");
        const chips = [...spot.querySelectorAll("button")].filter((b) => (b.textContent || "").trim().indexOf("${text}") === 0);
        const chip = chips.find((b) => b.getBoundingClientRect().width > 0);
        if (chip) chip.scrollIntoView({ block: "center" });
        return JSON.stringify(true);
      })()`);
      await sleep(700);
      const box = await readJson(`(() => {
        const spot = document.querySelector("section[aria-label='Active project spotlight']");
        const chips = [...spot.querySelectorAll("button")].filter((b) => (b.textContent || "").trim().indexOf("${text}") === 0);
        const chip = chips.find((b) => b.getBoundingClientRect().width > 0);
        if (!chip) return "null";
        const r = chip.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        if (!hit || !chip.contains(hit)) return JSON.stringify({ miss: true });
        return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, label: chip.textContent.trim().slice(0, 24) });
      })()`);
      if (box && typeof box === "object" && !box.miss) return box;
      await sleep(500);
    }
    return null;
  };
  const chipBox = await locateChip("Completed");
  check("spotlight Completed chip located AND confirmed under the crosshair",
    !!chipBox && typeof chipBox === "object", JSON.stringify(chipBox));
  const clicked = chipBox && typeof chipBox === "object" ? cdpClick(chipBox.x, chipBox.y, 0) : false;
  check("real click on the Completed chip", clicked, chipBox?.label);
  await sleep(800);
  const after = await readJson(`(() => {
    const spot = document.querySelector("section[aria-label='Active project spotlight']");
    const trs = [...spot.querySelectorAll("tbody tr[data-spot-row]")];
    /* IDENTITY, not position: the 11 present rows must all be members of
     * the stashed 12 — and each one's delay must equal ITS OWN stashed
     * ticket. (The first run of this check compared counts and row-0
     * positions — position-brained, the exact disease the ledger cures:
     * the never-ran job is this roster's NEWEST, so row 0's OCCUPANT
     * legitimately changes when it hides, while every NODE keeps its
     * own seat.) */
    const members = trs.every((el) => window.__t613rows.indexOf(el) !== -1);
    const kept = [];
    const moved = [];
    for (const tr of trs) {
      const btn = tr.querySelector("button[title]");
      const key = btn ? (btn.getAttribute("title") || "").slice(0, 40) : String(tr.rowIndex);
      const now = getComputedStyle(tr).animationDelay;
      const was = window.__t613tickets[key];
      (was === now ? kept : moved).push(key);
    }
    const o0 = trs.length ? getComputedStyle(trs[0]).opacity : null;
    const an0 = trs.length ? getComputedStyle(trs[0]).animationName : null;
    return JSON.stringify({ n: trs.length, members, kept: kept.length, moved, o0, an0 });
  })()`);
  check("W2 the hidden row left and the 11 present rows are the SAME nodes (members of the stashed 12)",
    after?.n === 11 && after?.members === true, `n=${after?.n} members=${after?.members}`);
  check("W2 every present row holds its OWN ticket and stays settled (no replay)",
    after?.an0 === "receipt-arrival" && after?.o0 === "1" && after?.kept === 11 && (after?.moved || []).length === 0,
    `o=${after?.o0} an=${after?.an0} kept=${after?.kept} moved=${JSON.stringify(after?.moved)}`);

  /* restore: a real click on the All chip — the hidden row REMOUNTS.
   * THE LEDGER WITNESSED: it must come back ON ITS ORIGINAL TICKET
   * (its frozen slot). A positional scheme would hand it the top slot's
   * delay (0.734 — the newest-first seat it returns to); the ledger
   * hands back the seat it held at the first mount. */
  const allBox = await locateChip("All ");
  check("All chip located AND confirmed under the crosshair", !!allBox && typeof allBox === "object", JSON.stringify(allBox));
  const restored = allBox && typeof allBox === "object" ? cdpClick(allBox.x, allBox.y, 0) : false;
  check("real click on the All chip", restored);
  await sleep(800);
  const ledger = await readJson(`(() => {
    const spot = document.querySelector("section[aria-label='Active project spotlight']");
    const trs = [...spot.querySelectorAll("tbody tr[data-spot-row]")];
    if (trs.length !== 12) return JSON.stringify({ ok: false, n: trs.length });
    const kept = [];
    const changed = [];
    for (const tr of trs) {
      const btn = tr.querySelector("button[title]");
      const key = btn ? (btn.getAttribute("title") || "").slice(0, 40) : String(tr.rowIndex);
      const now = getComputedStyle(tr).animationDelay;
      const was = window.__t613tickets[key];
      (was === now ? kept : changed).push({ key, was, now });
    }
    return JSON.stringify({ ok: true, kept: kept.length, changed });
  })()`);
  check("THE LEDGER WITNESSED: every row — including the remounted one — holds its ORIGINAL ticket",
    ledger?.ok === true && ledger.kept === 12 && ledger.changed.length === 0,
    `kept=${ledger?.kept} changed=${JSON.stringify(ledger?.changed).slice(0, 120)}`);

  /* ---------- W3: THE ROUND-TRIP ---------- */
  console.log("\n[W3] the round-trip");
  const closed = await shiftD();
  await sleep(900);
  const gone = await readJson(`JSON.stringify(!document.querySelector("section[aria-label='Active project spotlight']"))`);
  check("dashboard closed (spotlight gone)", closed === true && gone === true, `gone=${gone}`);
  /* the tape is emptied AFTER the close is confirmed */
  check("tape emptied after the close (fresh recording)", (await resetSampler()) === true);
  /* the reopen is a GESTURE, the section's presence is the fact (t611
   * tuition ④); a single synthetic toggle can be swallowed by a transient
   * (run 3's tuition) — retry ONLY while the section is absent, so a
   * slow-open can never be double-toggled shut. Any dialog blocker is
   * named for the log. */
  let reopened = false;
  let rowsAgain = null;
  let blocker = "";
  for (let attempt = 0; attempt < 5 && !reopened; attempt++) {
    const sec = await readJson(`JSON.stringify(!!document.querySelector("section[aria-label='Active project spotlight']"))`);
    if (sec === true) { reopened = true; break; }
    blocker = await readJson(`JSON.stringify((() => {
      const d = document.querySelector("[role='dialog'][data-state='open'], [role='menu'][data-state='open']");
      return d ? ((d.getAttribute("aria-label") || d.className || "dialog") + "").slice(0, 60) : "";
    })())`);
    if (blocker) console.log(`  … reopen attempt ${attempt + 1} blocked by: ${blocker}`);
    await shiftD();
    await sleep(2500);
  }
  if (reopened) {
    rowsAgain = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-spot-row]").length)`);
      return typeof n === "number" && n === 12 ? n : null;
    }, 40000, 300);
  }
  check("dashboard reopened with the full face set (the toggle needed no second finger)",
    reopened === true && rowsAgain === 12, `rows=${rowsAgain} blocker=${blocker || "none"}`);
  /* W2's scrollIntoView left the window mid-page; the remounted
   * dashboard's wave is running — scroll home so the replay's eyes are
   * on the banner (the sampler reads off-screen faces fine, the
   * screenshot does not) */
  await readJson(`(() => { window.scrollTo(0, 0); return JSON.stringify(true); })()`);
  await sleep(2200);
  await stopSampler();
  const B = await readJson(`(() => {
    const F = (window.__t613.frames || []).filter((f) => f.banner && f.rows && f.rows.length === 12 && f.chips.length === 12);
    if (!F.length) return JSON.stringify({ ok: false, why: "no frames with faces" });
    const first = F[0];
    const bannerInt = F.filter((f) => { const o = parseFloat(f.banner.o); return o > 0.001 && o < 0.999; });
    const bannerTys = bannerInt.map((f) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(f.banner.tr); return m ? parseFloat(m[1].split(",")[5]) : null; }).filter((v) => v != null);
    const nonIncreasing = bannerTys.every((v, i) => i === 0 || v <= bannerTys[i - 1] + 0.001);
    const distinct = new Set(bannerTys.map((v) => Math.round(v * 1000))).size >= 2;
    const row0Int = F.filter((f) => { const o = parseFloat(f.rows[0].o); return o > 0.001 && o < 0.999; });
    const row0Tys = row0Int.map((f) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(f.rows[0].tr); return m ? parseFloat(m[1].split(",")[5]) : null; }).filter((v) => v != null);
    const row0NonInc = row0Tys.every((v, i) => i === 0 || v <= row0Tys[i - 1] + 0.001);
    const row0Distinct = new Set(row0Tys.map((v) => Math.round(v * 1000))).size >= 2;
    const bannerReading = F.find((f) => parseFloat(f.banner.o) > 0.05 && parseFloat(f.stagelabel.o) < 0.05);
    const rowReading = F.find((f) => parseFloat(f.rows[0].o) > 0.05 && parseFloat(f.rows[1].o) < 0.05);
    const settled = F[F.length - 1];
    return JSON.stringify({
      ok: true, n: F.length,
      firstO: first.banner.o, firstAn: first.banner.an, firstD: first.banner.d,
      chip0D: first.chips[0] ? first.chips[0].d : null, row0D: first.rows[0] ? first.rows[0].d : null,
      rowLastD: first.rows[11] ? first.rows[11].d : null,
      bannerTys: bannerTys.slice(0, 6), nonIncreasing, distinct,
      row0Tys: row0Tys.slice(0, 6), row0NonInc, row0Distinct,
      bannerReading: bannerReading ? { bo: bannerReading.banner.o, so: bannerReading.stagelabel.o } : null,
      rowReading: rowReading ? { o0: rowReading.rows[0].o, o1: rowReading.rows[1].o } : null,
      settledAn: settled.banner.an, settledO: settled.banner.o,
    });
  })()`);
  if (!B?.ok) {
    check("W3 tape analyzable", false, B?.why || "no data");
  } else {
    check("W3 the remount replays honestly (banner from-state again)",
      parseFloat(B.firstO) < 0.05 && B.firstAn === "receipt-arrival",
      `o=${B.firstO} an=${B.firstAn} d=${B.firstD}`);
    check("W3 the fresh ledger sings the SAME wave (tickets identical to the first mount)",
      Math.abs(parseFloat(B.chip0D) - (BASE_S + 2 * STEP_S)) < 0.002 &&
      Math.abs(parseFloat(B.row0D) - (TAIL_BASE_S + 2 * STEP_S)) < 0.002 &&
      Math.abs(parseFloat(B.rowLastD) - (TAIL_BASE_S + 13 * STEP_S)) < 0.002,
      `chip0=${B.chip0D} row0=${B.row0D} rowLast=${B.rowLastD}`);
    /* the WARM world owns the narrow witnesses: the descent lines and
     * the reading-order single frames (the cold open's burst starved
     * the grid through the banner's window — W1's tuition this run) */
    /* THE SURFACING LINE — the keyframe's own contract (ty 4→0,
     * non-increasing, ≥2 distinct) witnessed on whichever face the
     * remount burst spared: banner flight (350-590) and row-0 flight
     * (734-974) ride the SAME receipt word and the SAME line shape, but
     * the hydration burst can starve the 8ms grid through either 240ms
     * window (banner missed 2/7 runs, row 0 none). One surviving line
     * proves the word's shape; the delays prove the seats. */
    check("W3 the surfacing line witnessed (ty non-increasing, >=2 distinct — banner or row 0, whichever the burst spared)",
      (B.nonIncreasing && B.distinct) || (B.row0NonInc && B.row0Distinct),
      `banner tys=${B.bannerTys.join("→")} row tys=${B.row0Tys.join("→")}`);
    /* THE READING ORDER WITNESSED — on whichever pair the mount burst
     * spared: both pairs ride the SAME 24ms step (banner 350→label 374,
     * row 0 734→row 1 758), and the burst can starve the grid through
     * any single 24ms window (row pair: caught in runs 2/3, missed in
     * 4; banner pair: 3/3). One adjacency frame on either pair proves
     * the reading order; the delays prove the step exactly. */
    check("W3 THE READING ORDER WITNESSED (a face mid-flight while its wave-neighbor still waits)",
      !!B.bannerReading || !!B.rowReading,
      `banner ${B.bannerReading ? B.bannerReading.bo + "/" + B.bannerReading.so : "—"} row ${B.rowReading ? B.rowReading.o0 + "/" + B.rowReading.o1 : "—"}`);
    check("W3 settled face keeps its word after the replay", B.settledAn === "receipt-arrival" && B.settledO === "1",
      `an=${B.settledAn} o=${B.settledO}`);
    check("📸 replay", snap("t613-spot-replay.png"));
  }

  /* ---------- R: the world returned intact ---------- */
  console.log("\n[R] return");
  /* leave the dashboard the way we came — same resilient gesture as the
   * reopen: dispatch only while the spotlight is still present */
  for (let attempt = 0; attempt < 3; attempt++) {
    const present = await readJson(`JSON.stringify(!!document.querySelector("section[aria-label='Active project spotlight']"))`);
    if (present !== true) break;
    await shiftD();
    await sleep(2000);
  }
  await sleep(600);
  const backToCanvas = await readJson(`JSON.stringify(!document.querySelector("section[aria-label='Active project spotlight']"))`);
  check("returned to the canvas", backToCanvas === true);
  await sleep(1200);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter((m) => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);
  /* the R curls are resilient: a cold-booted dev server may hiccup on a
   * route it is still compiling — a retried fetch is the honest reader
   * (the first run died here on an empty body). The body lands on disk
   * and python reads the FILE — no shell quoting in the way. */
  const apiJson = (path, expr) => {
    for (let i = 0; i < 4; i++) {
      try {
        sh(`curl -s --max-time 15 -H "Origin: ${BASE}" "${BASE}${path}" -o /tmp/t613-api.json`);
        const size = sh(`wc -c < /tmp/t613-api.json`);
        if (Number(size) > 2) return sh(`python3 -c "${expr.replace(/"/g, '\\"')}"`);
      } catch { /* retry */ }
      sleep(1500);
    }
    return "";
  };
  const roster = apiJson("/api/projects",
    `import json; d=json.load(open('/tmp/t613-api.json')); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))`);
  check("roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
  const jobsN = apiJson("/api/jobs?projectId=cmuro2ufe000mn5nb3qkwuy49",
    `import json; d=json.load(open('/tmp/t613-api.json')); print(len(d['jobs'] if isinstance(d, dict) else d))`);
  check("12 jobs (no mints, nothing borrowed)", jobsN === "12", `got ${jobsN}`);
} finally {
  try { shSoft(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
