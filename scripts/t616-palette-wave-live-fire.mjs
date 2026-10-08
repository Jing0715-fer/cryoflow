/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t616 — THE PALETTE'S OWN WAVE: the Catalog tab's arrival, witnessed live.
 *
 * The product (palette.tsx + globals.css t616 block): the sidebar's default
 * face joins the arrival grammar — header → category headers → the open
 * category's rows → footer, the receipt's own word, zero new keyframes,
 * base 90ms (the RAIL'S PULSE: one rail, one pulse, shared with the
 * Workspaces tab's t614 wave), every face's ticket from a MOUNT LEDGER
 * keyed by face id (t613's law, THIRD consumer — and its stress test:
 * favorites REORDER, recents PREPEND, categories FOLD/UNFOLD, search
 * RE-FILTERS). THE FOLD LAW: a row nominates only while its category is
 * open — unfolding nominates it at the ledger's tail (mount is arrival).
 *
 * Witness sections:
 *   G0  the served-CSS contract (parsed style objects): the wave's rule
 *       reads receipt-arrival + var(--pd); the reduce gate answers none;
 *       receipt-arrival is DEFINED exactly once; no rule that names the
 *       wave ever names the chrome (button / aria-label / animate-spin).
 *   G0b the served-JS contract: the hooks live in the compiled chunks.
 *   Q   the world: 12c/13e/12dots, no error dialog.
 *   W1  THE PALETTE SURFACES: the sampler armed BEFORE the return click
 *       (real input via snapshot refs — Radix triggers swallow synthetic
 *       clicks): 19 faces hold the from-state at their exact tickets
 *       (90 + 24i in reading order), the descent is witnessed (union
 *       doctrine), the chrome is silent in EVERY frame, the digits keep
 *       their word, the canvas behind is untouched.
 *   W2  THE QUIET RE-RENDER: after a store poll tick the face is the
 *       SAME node with the SAME ticket — re-composition is not
 *       re-arrival.
 *   W3  THE ROUND-TRIP: leave unmounts; a fresh ledger sings the SAME
 *       wave (determinism) and the descent is witnessed again.
 *   W4  THE UNFOLD LADDER: opening a folded category nominates its row
 *       at the LEDGER'S TAIL (546ms — its reading-order seat would be
 *       234ms; the ticket says the ledger, not the position — the
 *       doctrine's negative space, asserted); collapsing de-nominates.
 *   W5  THE STAR LADDER: starring a type mounts the favorites section at
 *       the tail (570/594), the footer's ticket NEVER moves (the ledger
 *       does not rewrite), and unstarring restores the world.
 *   R   the return path: canvas intact, error net empty.
 *
 * Usage: node scripts/t616-palette-wave-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* CDP dedicated port 9335 (9323 = t578, 9324 = t584/t604, 9325 = t605,
 * 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610, 9330 = t611,
 * 9331 = t612, 9332 = t613, 9333 = t614, 9334 = t615, 9335 = t616 probe)
 * + fresh profile (t581 lesson) */
const CDP_PORT = "9335";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t616-witness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
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
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
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
/* REAL input via the snapshot ref flow (t614 tuition: Radix tabs triggers
 * swallow synthetic .click()). THE WINDOW'S TUITION: state and ref share
 * ONE bracket pair in the aria snapshot — "[expanded=false, ref=e46]" —
 * so the ref extraction reads ref= wherever it sits (the t614-era
 * \[ref=eN\] regex silently failed every line carrying a state). */
const clickRef = (needle, rolePrefix = "- tab ") => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const line = snap.split("\n").find((l) => l.trimStart().startsWith(rolePrefix) && l.includes(needle));
      const m = line && line.match(/ref=(e\d+)/);
      if (m) {
        sh(`agent-browser click @${m[1]} >/dev/null 2>&1`);
        return "clicked";
      }
    } catch { /* */ }
    sleep(500);
  }
  return "no-ref";
};
/* the sampler installed BEFORE the finger: one rAF loop, re-querying the
 * faces every frame (they mount later), recording the parsed style —
 * animationName/animationDelay/opacity/transform, the mechanism layer */
const INSTALL_SAMPLER = `(() => {
  window.__t616 = { tape: [], on: true, errs: [] };
  window.addEventListener("error", (e) => { window.__t616.errs.push(String(e.message || e)); });
  const tick = () => {
    if (!window.__t616.on) return;
    try {
      document.querySelectorAll("[data-pal-arrival] [data-pal-face]").forEach((el, idx) => {
        const cs = getComputedStyle(el);
        window.__t616.tape.push({
          t: Math.round(performance.now()), k: el.dataset.palFace, i: idx,
          o: cs.opacity, an: cs.animationName, ad: cs.animationDelay, tf: cs.transform,
        });
      });
      const search = document.querySelector('input[aria-label="Search job types"]');
      if (search) {
        const scs = getComputedStyle(search);
        window.__t616.tape.push({ t: Math.round(performance.now()), k: "chrome-search", i: -1, o: scs.opacity, an: scs.animationName, ad: scs.animationDelay, tf: "none" });
      }
      const favFilter = document.querySelector('[data-testid="palette-fav-filter"]');
      if (favFilter) {
        const fcs = getComputedStyle(favFilter);
        window.__t616.tape.push({ t: Math.round(performance.now()), k: "chrome-favfilter", i: -1, o: fcs.opacity, an: fcs.animationName, ad: fcs.animationDelay, tf: "none" });
      }
    } catch (e) { window.__t616.errs.push("sampler:" + String(e)); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return JSON.stringify("armed");
})()`;
const STOP_SAMPLER = `(() => {
  if (window.__t616) window.__t616.on = false;
  const tape = window.__t616 ? window.__t616.tape : [];
  const errs = window.__t616 ? window.__t616.errs : [];
  return JSON.stringify({ n: tape.length, errs, tape });
})()`;
const msOf = (ad) => {
  if (typeof ad !== "string") return NaN;
  const m = ad.match(/^([\d.]+)(m?s)$/);
  if (!m) return NaN;
  return m[2] === "s" ? Math.round(parseFloat(m[1]) * 1000) : parseInt(m[1], 10);
};
const tyOf = (tf) => {
  if (typeof tf !== "string") return NaN;
  const m = tf.match(/matrix\(1, 0, 0, 1, 0, (-?[\d.]+)\)/);
  return m ? parseFloat(m[1]) : NaN;
};
/* the honest descent: non-increasing + 2+ distinct + direction downward */
const descentOk = (rows) => {
  const tys = rows.map((r) => tyOf(r.tf)).filter((v) => !Number.isNaN(v));
  if (tys.length < 2) return false;
  const distinct = new Set(tys.map((v) => v.toFixed(3))).size;
  let nonIncreasing = true;
  for (let i = 1; i < tys.length; i++) if (tys[i] > tys[i - 1] + 0.001) { nonIncreasing = false; break; }
  return nonIncreasing && distinct >= 2;
};
/* W1/W3 analysis: the faces' first sight, keyed by kind+docIndex (the
 * remount wave mounts all faces in one render, so doc order is the seat
 * order); expected ticket = 90 + seat*24 */
const analyzeWave = (tape, label, wantCount) => {
  const firstBySeat = new Map();
  const linesBySeat = new Map();
  const chromeRows = [];
  for (const r of tape) {
    if (r.k.startsWith("chrome")) { chromeRows.push(r); continue; }
    if (!firstBySeat.has(r.i)) {
      firstBySeat.set(r.i, r);
      linesBySeat.set(r.i, []);
    }
    linesBySeat.get(r.i).push(r);
  }
  const notes = [];
  let ok = true;
  const seats = [...firstBySeat.keys()].sort((a, b) => a - b);
  if (seats.length !== wantCount) { ok = false; notes.push(`faces=${seats.length} want ${wantCount}`); }
  const kinds = {};
  for (const seat of seats) {
    const first = firstBySeat.get(seat);
    kinds[first.k] = (kinds[first.k] || 0) + 1;
    const want = 90 + seat * 24;
    const ad = msOf(first.ad);
    if (first.an !== "receipt-arrival") { ok = false; notes.push(`seat${seat}(${first.k}): an=${first.an}`); }
    if (Math.abs(ad - want) > 3) { ok = false; notes.push(`seat${seat}(${first.k}): ad=${ad} want ${want}`); }
    if (parseFloat(first.o) > 0.02) { ok = false; notes.push(`seat${seat}(${first.k}): first-sight o=${first.o}`); }
  }
  /* the descent: union doctrine — whichever line the frame grid spared
   * proves the motion (every face's line qualifies individually) */
  const anyDescent = [...linesBySeat.values()].some((rows) => descentOk(rows));
  return { ok, notes, seats, kinds, chromeRows, linesBySeat, anyDescent };
};

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
  check("agent-browser connected", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("hover shim applied", applyShim());
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* ---------- Q: the world ---------- */
  const world = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const dots = document.querySelectorAll("[data-canvas-ui='minimap-dot']").length;
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    return JSON.stringify({ cards, edges, dots, errDialog });
  })()`);
  check("Q canvas 12c/13e/12dots", world?.cards === 12 && world?.edges === 13 && world?.dots === 12, JSON.stringify(world));
  check("Q no error dialog in the dev portal", world?.errDialog === false);

  /* ---------- G0: the served-CSS contract (parsed style objects) ---------- */
  const g0 = await readJson(`(() => {
    const rules = [];
    const keyframes = [];
    const walk = (ruleList, media) => {
      for (const rule of ruleList) {
        if (rule.type === CSSRule.KEYFRAMES_RULE || rule instanceof CSSKeyframesRule) {
          keyframes.push(rule.name);
          continue;
        }
        if (rule.type === CSSRule.MEDIA_RULE || rule instanceof CSSMediaRule) {
          walk(rule.cssRules, rule.conditionText);
          continue;
        }
        if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && rule.selectorText.includes("data-pal-arrival")) {
          rules.push({
            sel: rule.selectorText,
            an: rule.style.animationName || null,
            ad: rule.style.animationDelay || null,
            media: media || null,
          });
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules, null); } catch (e) { /* cross-origin */ }
    }
    return JSON.stringify({ rules, receiptDefs: keyframes.filter((n) => n === "receipt-arrival").length });
  })()`);
  const enterRules = (g0?.rules ?? []).filter((r) => !r.media);
  const reduceRules = (g0?.rules ?? []).filter((r) => r.media && r.media.includes("reduce"));
  check("G0 the wave rule reads the receipt word + var(--pd)",
    enterRules.length >= 1 && enterRules.every((r) => r.an === "receipt-arrival" && typeof r.ad === "string" && r.ad.startsWith("var(--pd")),
    JSON.stringify(enterRules.map((r) => [r.sel.slice(0, 60), r.an, r.ad])));
  check("G0 the reduce gate answers none",
    reduceRules.length >= 1 && reduceRules.every((r) => r.an === "none"),
    `reduce rules: ${reduceRules.length}`);
  check("G0 receipt-arrival defined exactly once", g0?.receiptDefs === 1, `defs=${g0?.receiptDefs}`);
  /* the wave never names the chrome: no rule that names data-pal-arrival
   * also names the search lens, an action verb, or the spinner's class */
  const chromeNamed = (g0?.rules ?? []).filter((r) =>
    r.sel.includes("animate-spin") || r.sel.includes("aria-label") || r.sel.includes("button") || r.sel.includes("input"));
  check("G0 the wave never names the chrome", chromeNamed.length === 0, JSON.stringify(chromeNamed.map((r) => r.sel.slice(0, 60))));

  /* ---------- W1: THE PALETTE SURFACES (warm remount on a real click) ---------- */
  /* the palette is mounted at boot (default tab) — to witness a warm
   * remount, leave via Workspaces (its own t614 wave plays, unwatched),
   * arm the sampler, then return via Catalog: the remount is the palette's
   * own surfacing on the user's click */
  const away = clickRef("Workspaces");
  check("W1 the leave click (Workspaces)", away === "clicked", String(away));
  const wsUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-ws-card]").length)`);
    return typeof n === "number" && n > 0 ? n : null;
  }, 15000, 300);
  check("W1 the workspaces panel mounted (palette unmounted)", typeof wsUp === "number" && wsUp > 0, `ws cards=${wsUp}`);
  const facesGone = await readJson(`JSON.stringify(document.querySelectorAll("[data-pal-face]").length)`);
  check("W1 the palette faces unmounted on leave", facesGone === 0, `faces=${facesGone}`);

  check("W1 sampler armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const back = clickRef("Catalog");
  check("W1 the return click (Catalog)", back === "clicked", String(back));
  const remounted = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-pal-face]").length)`);
    return typeof n === "number" && n >= 19 ? n : null;
  }, 15000, 200);
  check("W1 the palette remounted (19 faces)", typeof remounted === "number" && remounted >= 19, `faces=${remounted}`);
  await sleep(1400); /* the wave (762ms) fully settles; the tape holds it all */
  const stop1 = await readJson(STOP_SAMPLER);
  const tape1 = stop1?.tape ?? [];
  check("W1 the tape has volume", tape1.length > 150, `rows=${tape1.length}`);
  const w1 = analyzeWave(tape1, "w1", 19);
  check("W1 THE PALETTE SURFACES — 19 faces, from-state + exact tickets 90+24i",
    w1.ok, w1.notes.join("; ") || `kinds: ${JSON.stringify(w1.kinds)}`);
  check("W1 the kind census (1 hdr + 14 cat + 3 row + 1 ftr)",
    w1.kinds.hdr === 1 && w1.kinds.cat === 14 && w1.kinds.row === 3 && w1.kinds.ftr === 1, JSON.stringify(w1.kinds));
  check("W1 the descent is witnessed (union doctrine)", w1.anyDescent,
    "some face's ty line: 4→0, non-increasing, 2+ distinct");
  const chromeNoisy1 = w1.chromeRows.filter((r) => r.an !== "none");
  check("W1 the chrome is silent in every frame", w1.chromeRows.length > 30 && chromeNoisy1.length === 0,
    `frames=${w1.chromeRows.length} noisy=${chromeNoisy1.length}`);
  const settled1 = await readJson(`(() => {
    const faces = Array.from(document.querySelectorAll("[data-pal-face]"));
    const opac = faces.map((f) => getComputedStyle(f).opacity);
    const hdr = document.querySelector('[data-pal-face="hdr"]');
    const count = hdr ? hdr.querySelector("span.tabular-nums") : null;
    const ftr = document.querySelector('[data-pal-face="ftr"]');
    return JSON.stringify({
      allSettled: opac.every((o) => parseFloat(o) > 0.98),
      count: count ? count.textContent : null,
      countTitle: count ? count.getAttribute("title") : null,
      ftrDelay: ftr ? getComputedStyle(ftr).animationDelay : null,
    });
  })()`);
  check("W1 the settled wave keeps its word (all o=1)", settled1?.allSettled === true, JSON.stringify(settled1));
  check("W1 the digits keep their word (40 of 40)", settled1?.count === "40" && (settled1?.countTitle ?? "").startsWith("40 of 40"), JSON.stringify(settled1));
  check("W1 the footer's ticket reads 522ms (the last seat)", Math.abs(msOf(settled1?.ftrDelay) - 522) <= 3, `ad=${settled1?.ftrDelay}`);
  const canvasAfter1 = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
  check("W1 the canvas behind is untouched", canvasAfter1 === 12, `cards=${canvasAfter1}`);

  /* ---------- G0b: the hooks live in the compiled chunks ---------- */
  const g0b = await readJson(`(async () => {
    const srcs = Array.from(document.querySelectorAll("script[src]")).map((s) => s.src);
    let hits = 0;
    let fetched = 0;
    for (const src of srcs) {
      try {
        const res = await fetch(src);
        const text = await res.text();
        fetched++;
        if (text.includes("data-pal-face")) hits++;
      } catch (e) { /* */ }
    }
    return JSON.stringify({ srcs: srcs.length, fetched, hits });
  })()`);
  check("G0b the hooks live in the compiled chunks", g0b?.hits >= 1, JSON.stringify(g0b));

  /* 📸 settled */
  try { sh(`mkdir -p ${SHOTS} && agent-browser screenshot ${SHOTS}/t616-pal-settled.png >/dev/null 2>&1`); check("📸 settled shot", true); }
  catch (e) { check("📸 settled shot", false, String(e).slice(0, 60)); }

  /* ---------- W2: THE QUIET RE-RENDER ---------- */
  await readJson(`(() => {
    const ftr = document.querySelector('[data-pal-face="ftr"]');
    window.__t616stash = { node: ftr, ad: ftr ? getComputedStyle(ftr).animationDelay : null };
    return JSON.stringify("stashed");
  })()`);
  await sleep(8000); /* the store's poll ticks keep re-rendering the shell */
  const w2 = await readJson(`(() => {
    const ftr = document.querySelector('[data-pal-face="ftr"]');
    if (!ftr || !window.__t616stash) return JSON.stringify({ ok: false, why: "gone" });
    const cs = getComputedStyle(ftr);
    return JSON.stringify({
      ok: ftr === window.__t616stash.node,
      adSame: cs.animationDelay === window.__t616stash.ad,
      an: cs.animationName,
      o: cs.opacity,
    });
  })()`);
  check("W2 THE QUIET RE-RENDER — same node, same ticket, no replay",
    w2?.ok === true && w2?.adSame === true && w2?.an === "receipt-arrival" && w2?.o === "1", JSON.stringify(w2));

  /* ---------- W3: THE ROUND-TRIP ---------- */
  const left3 = clickRef("Workspaces");
  check("W3 leave click", left3 === "clicked", String(left3));
  const gone3 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-pal-face]").length)`);
    /* zero is the GOAL — return a truthy sentinel, pollUntil's `if (v)`
     * would treat 0 as failure and burn the whole window (the classic
     * zero-falsy trap, written down where the next harness reads it) */
    return n === 0 ? "gone" : null;
  }, 10000, 300);
  check("W3 the faces unmount on leave", gone3 === "gone", `faces=${gone3}`);
  check("W3 sampler re-armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const back3 = clickRef("Catalog");
  check("W3 return click", back3 === "clicked", String(back3));
  const reopened3 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-pal-face]").length)`);
    return typeof n === "number" && n >= 19 ? n : null;
  }, 15000, 200);
  check("W3 the palette remounts", typeof reopened3 === "number" && reopened3 >= 19, `faces=${reopened3}`);
  await sleep(1400);
  const stop3 = await readJson(STOP_SAMPLER);
  const tape3 = stop3?.tape ?? [];
  const w3 = analyzeWave(tape3, "w3", 19);
  check("W3 THE ROUND-TRIP — a fresh ledger sings the SAME wave (from-state + same tickets)",
    w3.ok, w3.notes.join("; ") || "determinism: the same 90+24i as W1");
  check("W3 the descent witnessed in the warm world", w3.anyDescent, "union doctrine");
  const settled3 = await readJson(`(() => {
    const ftr = document.querySelector('[data-pal-face="ftr"]');
    return JSON.stringify({ an: getComputedStyle(ftr).animationName, o: getComputedStyle(ftr).opacity });
  })()`);
  check("W3 the settled face keeps its word again", settled3?.an === "receipt-arrival" && settled3?.o === "1", JSON.stringify(settled3));
  try { sh(`agent-browser screenshot ${SHOTS}/t616-pal-replay.png >/dev/null 2>&1`); check("📸 replay shot", true); }
  catch (e) { check("📸 replay shot", false, String(e).slice(0, 60)); }

  /* ---------- W4: THE UNFOLD LADDER ---------- */
  /* after W3's remount the fresh ledger holds 19 tickets (hdr + 14 cats +
   * 3 import rows + ftr). Opening Motion nominates its row at the TAIL:
   * 90 + 19*24 = 546ms. Its reading-order seat would be 234ms (seat 6) —
   * the ticket says the LEDGER, not the position: the doctrine's negative
   * space, asserted. */
  check("W4 sampler armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const openM = clickRef("MOTION 1", "- button");
  check("W4 the Motion fold clicked", openM === "clicked", String(openM));
  const rowUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(Array.from(document.querySelectorAll('[data-pal-face="row"]')).filter((r) => (r.getAttribute("aria-label") || "").includes("Motion Correction")).length)`);
    return typeof n === "number" && n === 1 ? n : null;
  }, 10000, 200);
  check("W4 the motion row nominated", rowUp === 1, `rows=${rowUp}`);
  await sleep(1100); /* the row's 546+240ms arrival settles */
  const stop4 = await readJson(STOP_SAMPLER);
  const tape4 = stop4?.tape ?? [];
  const motionRows = tape4.filter((r) => {
    if (r.k !== "row") return false;
    return r.i === 6; /* the motion row's doc-order seat (after cat:motion) */
  });
  const firstMotion = motionRows[0];
  check("W4 THE UNFOLD LADDER — the row's ticket is the ledger's tail (546, not the seat's 234)",
    !!firstMotion && firstMotion.an === "receipt-arrival" && Math.abs(msOf(firstMotion.ad) - 546) <= 3 && parseFloat(firstMotion.o) <= 0.02,
    firstMotion ? `ad=${msOf(firstMotion.ad)} o=${firstMotion.o}` : "row absent from tape");
  const ftrStill = await readJson(`(() => {
    const ftr = document.querySelector('[data-pal-face="ftr"]');
    return JSON.stringify({ ad: getComputedStyle(ftr).animationDelay, o: getComputedStyle(ftr).opacity });
  })()`);
  check("W4 the footer's ticket NEVER moved (the ledger does not rewrite)", Math.abs(msOf(ftrStill?.ad) - 522) <= 3 && ftrStill?.o === "1", JSON.stringify(ftrStill));
  const closeM = clickRef("MOTION 1", "- button");
  check("W4 the Motion fold collapsed back", closeM === "clicked", String(closeM));
  const rowDown = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(Array.from(document.querySelectorAll('[data-pal-face="row"]')).filter((r) => (r.getAttribute("aria-label") || "").includes("Motion Correction")).length)`);
    return n === 0 ? "denominated" : null;
  }, 10000, 200);
  check("W4 collapsing de-nominates the row", rowDown === "denominated", `nominated rows=${rowDown}`);

  /* ---------- W5: THE STAR LADDER ---------- */
  /* the ledger now holds 20 tickets (the motion row kept its 546 — the
   * ledger never forgets). Starring an import row mounts the favorites
   * section at the tail: fav-label 570, the chip 594. */
  check("W5 sampler armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const starClick = clickRef("Star Import Movies", "- button");
  check("W5 the star clicked (real input)", starClick === "clicked", String(starClick));
  const favUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll('[data-pal-face="fav"]').length)`);
    return typeof n === "number" && n === 1 ? n : null;
  }, 10000, 200);
  check("W5 the favorites section mounted (label + 1 chip)", favUp === 1, `chips=${favUp}`);
  await sleep(1100);
  const stop5 = await readJson(STOP_SAMPLER);
  const tape5 = stop5?.tape ?? [];
  const favRows = tape5.filter((r) => r.k === "fav-label" || r.k === "fav");
  const firstFavLabel = favRows.find((r) => r.k === "fav-label");
  const firstFavChip = favRows.find((r) => r.k === "fav");
  check("W5 THE STAR LADDER — the personal faces arrive at the tail (570/594)",
    !!firstFavLabel && !!firstFavChip
    && Math.abs(msOf(firstFavLabel.ad) - 570) <= 3 && parseFloat(firstFavLabel.o) <= 0.02
    && Math.abs(msOf(firstFavChip.ad) - 594) <= 3 && parseFloat(firstFavChip.o) <= 0.02,
    `label=${firstFavLabel ? msOf(firstFavLabel.ad) : "absent"} chip=${firstFavChip ? msOf(firstFavChip.ad) : "absent"}`);
  const ftrStill5 = await readJson(`(() => {
    const ftr = document.querySelector('[data-pal-face="ftr"]');
    const storage = localStorage.getItem("cryoflow-fav-types");
    return JSON.stringify({ ad: getComputedStyle(ftr).animationDelay, favs: storage });
  })()`);
  check("W5 the footer's ticket still 522 after the shift (frozen, not positional)",
    Math.abs(msOf(ftrStill5?.ad) - 522) <= 3, JSON.stringify(ftrStill5));
  check("W5 the star persisted (the storage echo at the gesture)", (ftrStill5?.favs ?? "").includes('"import"'), (ftrStill5?.favs ?? "").slice(0, 60));
  const unstar = clickRef("Unstar Import Movies", "- button");
  check("W5 the unstar clicked (world restored)", unstar === "clicked", String(unstar));
  const favDown = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll('[data-pal-face="fav"]').length)`);
    return n === 0 ? "gone" : null;
  }, 10000, 200);
  check("W5 unstarring unmounts the favorites section", favDown === "gone", `chips=${favDown}`);

  /* ---------- R: the return path ---------- */
  const rWorld = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    return JSON.stringify({ cards, edges, errDialog });
  })()`);
  check("R canvas intact (12c/13e)", rWorld?.cards === 12 && rWorld?.edges === 13, JSON.stringify(rWorld));
  check("R no error dialog in the dev portal", rWorld?.errDialog === false, JSON.stringify(rWorld));
  const errs = (stop5?.errs ?? []).concat(stop4?.errs ?? []).concat(stop3?.errs ?? []);
  check("R the error net is empty", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}

console.log(`\n=== ${pass}/${pass + fail} passed ===`);
process.exit(fail === 0 ? 0 : 1);
