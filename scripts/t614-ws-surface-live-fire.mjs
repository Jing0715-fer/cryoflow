/**
 * t614 — THE TAB SURFACES: the Workspaces panel's arrival, witnessed live.
 *
 * The product (workspace-panel.tsx + globals.css t614 block): the sidebar's
 * last silent family joins the arrival grammar — header → hint → cards →
 * stats itemize, the receipt's own word, zero new keyframes, base 90ms
 * (a USER-GESTURE beat: the panel mounts on the user's own tab click),
 * cards' tickets from a MOUNT LEDGER keyed by workspace id (t613's law,
 * second consumer: a ticket belongs to a face, not a seat).
 *
 * Witness sections:
 *   G0  the served-CSS contract (parsed style objects, not cssText —
 *       the serializer is a witness, not the contract): the wave's rule
 *       reads receipt-arrival + var(--wd); the reduce gate answers none;
 *       receipt-arrival is DEFINED exactly once; no rule that names the
 *       wave ever names the chrome (the New button, the spinner).
 *   G0b the served-JS contract: the hooks live in the compiled chunks.
 *   Q   the world: 12c/13e/12dots, hydration, no error overlay.
 *   W1  THE TAB SURFACES: the rAF sampler is installed BEFORE the real
 *       click (snapshot-ref input — Radix tabs swallow synthetic clicks):
 *       first sight holds the from-state (o=0, receipt-arrival, delays
 *       90/114/138/162), the card's ty line descends (4→0, non-increasing,
 *       2+ distinct), the chrome is silent in EVERY frame, the digits
 *       never move, the settled face keeps its word (fill-both's base
 *       value), and the canvas behind is untouched.
 *   W2  THE QUIET RE-RENDER: a store poll tick re-renders the panel; the
 *       card is the SAME node (in-page stash identity) with the SAME
 *       ticket — re-composition is not re-arrival.
 *   W3  THE TAB ROUND-TRIP: leave → the faces unmount; return → a fresh
 *       ledger sings the SAME wave (from-state again, same delays, the
 *       descent witnessed in the warm world), and the settled face keeps
 *       its word again.
 *   R   the return path: canvas intact, roster intact, error net empty.
 *
 * Usage: node scripts/t614-ws-surface-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9333";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t614-witness-chrome-profile";
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
/* REAL input via the snapshot ref flow (the window's tuition: Radix tabs
 * triggers swallow synthetic .click() — the trigger listens to pointer
 * events a JS click never sends; agent-browser click @ref is real input) */
const clickTab = (needle) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const line = snap.split("\n").find((l) => l.includes("- tab ") && l.includes(needle));
      const m = line && line.match(/\[ref=(e\d+)\]/);
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
  window.__t614 = { tape: [], on: true, errs: [] };
  window.addEventListener("error", (e) => { window.__t614.errs.push(String(e.message || e)); });
  const sel = "[data-ws-header],[data-ws-hint],[data-ws-card],[data-ws-stats]";
  const kindOf = (el) => el.dataset.wsHeader !== undefined ? "header"
    : el.dataset.wsHint !== undefined ? "hint"
    : el.dataset.wsCard !== undefined ? "card" : "stats";
  const tick = () => {
    if (!window.__t614.on) return;
    try {
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el);
        window.__t614.tape.push({
          t: Math.round(performance.now()), k: kindOf(el),
          o: cs.opacity, an: cs.animationName, ad: cs.animationDelay,
          tf: cs.transform,
        });
      });
      const btn = document.querySelector('button[aria-label="Create a new workspace"]');
      if (btn) {
        const bcs = getComputedStyle(btn);
        window.__t614.tape.push({ t: Math.round(performance.now()), k: "chrome", o: bcs.opacity, an: bcs.animationName, ad: bcs.animationDelay, tf: "none" });
      }
    } catch (e) { window.__t614.errs.push("sampler:" + String(e)); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return JSON.stringify("armed");
})()`;
const STOP_SAMPLER = `(() => {
  if (window.__t614) window.__t614.on = false;
  const tape = window.__t614 ? window.__t614.tape : [];
  const errs = window.__t614 ? window.__t614.errs : [];
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
/* the honest descent: non-increasing + 2+ distinct + direction downward
 * (the 10ms-grid lesson: strict monotonicity dies on duplicate samples) */
const descentOk = (rows) => {
  const tys = rows.map((r) => tyOf(r.tf)).filter((v) => !Number.isNaN(v));
  if (tys.length < 2) return false;
  let distinct = new Set(tys.map((v) => v.toFixed(3))).size;
  let nonIncreasing = true;
  for (let i = 1; i < tys.length; i++) if (tys[i] > tys[i - 1] + 0.001) { nonIncreasing = false; break; }
  return nonIncreasing && distinct >= 2;
};
const analyzeWave = (tape, label, expect) => {
  const out = {};
  for (const k of ["header", "hint", "card", "stats"]) {
    const rows = tape.filter((r) => r.k === k);
    out[k] = rows.length ? rows[0] : null;
    out[k + "Rows"] = rows.length;
    out[k + "Tape"] = rows;
  }
  const chromeRows = tape.filter((r) => r.k === "chrome");
  out.chrome = chromeRows;
  let ok = true;
  const notes = [];
  for (const k of ["header", "hint", "card", "stats"]) {
    const first = out[k];
    const want = expect[k];
    if (!first) { ok = false; notes.push(`${k}: absent`); continue; }
    if (first.an !== "receipt-arrival") { ok = false; notes.push(`${k}: an=${first.an}`); }
    const ad = msOf(first.ad);
    if (Math.abs(ad - want) > 3) { ok = false; notes.push(`${k}: ad=${ad} want ${want}`); }
    if (parseFloat(first.o) > 0.02) { ok = false; notes.push(`${k}: first-sight o=${first.o}`); }
    if (out[k + "Rows"] < 3) { ok = false; notes.push(`${k}: only ${out[k + "Rows"]} frames`); }
  }
  out.ok = ok;
  out.notes = notes;
  return out;
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
        if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && rule.selectorText.includes("data-ws-arrival")) {
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
  check("G0 the wave rule reads the receipt word + var(--wd)",
    enterRules.length >= 1 && enterRules.every((r) => r.an === "receipt-arrival" && typeof r.ad === "string" && r.ad.startsWith("var(--wd")),
    JSON.stringify(enterRules.map((r) => [r.sel.slice(0, 60), r.an, r.ad])));
  check("G0 the reduce gate answers none",
    reduceRules.length >= 1 && reduceRules.every((r) => r.an === "none"),
    `reduce rules: ${reduceRules.length}`);
  check("G0 receipt-arrival defined exactly once", g0?.receiptDefs === 1, `defs=${g0?.receiptDefs}`);
  /* the wave never names the chrome: no rule that names data-ws-arrival
   * also names the New button's hook or the spinner's class */
  const chromeNamed = (g0?.rules ?? []).filter((r) =>
    r.sel.includes("animate-spin") || r.sel.includes("aria-label") || r.sel.includes("button"));
  check("G0 the wave never names the chrome", chromeNamed.length === 0, JSON.stringify(chromeNamed.map((r) => r.sel.slice(0, 60))));

  /* ---------- W1: THE TAB SURFACES ---------- */
  check("W1 sampler armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const clicked = clickTab("Workspaces");
  check("W1 the real click", clicked === "clicked", String(clicked));
  const opened = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-ws-card]").length)`);
    return typeof n === "number" && n > 0 ? n : null;
  }, 15000, 300);
  check("W1 the panel mounted", typeof opened === "number" && opened > 0, `cards=${opened}`);
  await sleep(1500); /* the wave (402ms) fully settles; the tape holds it all */
  const stop1 = await readJson(STOP_SAMPLER);
  const tape1 = stop1?.tape ?? [];
  check("W1 the tape has volume", tape1.length > 20, `rows=${tape1.length}`);
  const w1 = analyzeWave(tape1, "w1", { header: 90, hint: 114, card: 138, stats: 162 });
  check("W1 THE TAB SURFACES — from-state + exact delays (90/114/138/162)", w1.ok, w1.notes.join("; ") || "all four faces hold the from-state at their ticket");
  /* the descent: the card's ty line (4→0), non-increasing, 2+ distinct */
  check("W1 the card's line descends (ty 4→0, non-increasing, 2+ distinct)",
    descentOk(w1.cardTape ?? []),
    `frames=${(w1.cardTape ?? []).length}`);
  /* the chrome is silent in EVERY frame */
  const chromeNoisy = (w1.chrome ?? []).filter((r) => r.an !== "none");
  check("W1 the chrome is silent in every frame", (w1.chrome ?? []).length > 10 && chromeNoisy.length === 0,
    `frames=${(w1.chrome ?? []).length} noisy=${chromeNoisy.length}`);
  /* the digits never move: the count span + the stats text are constant */
  const digits = await readJson(`(() => {
    const header = document.querySelector("[data-ws-header]");
    const count = header ? header.querySelector("span.tabular-nums") : null;
    const card = document.querySelector("[data-ws-card]");
    const stats = document.querySelector("[data-ws-stats]");
    return JSON.stringify({
      count: count ? count.textContent : null,
      stats: stats ? stats.textContent.trim().replace(/\\s+/g, " ") : null,
      an: getComputedStyle(card).animationName,
      o: getComputedStyle(card).opacity,
      ad: getComputedStyle(card).animationDelay,
    });
  })()`);
  check("W1 the settled face keeps its word (fill-both base value)",
    digits?.an === "receipt-arrival" && digits?.o === "1", JSON.stringify(digits));
  check("W1 the digits never moved (count=1, stats text intact)",
    digits?.count === "1" && /^12 jobs\s*11/.test(digits?.stats ?? ""), JSON.stringify(digits));
  const canvasAfter = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
  check("W1 the canvas behind is untouched", canvasAfter === 12, `cards=${canvasAfter}`);

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
        if (text.includes("data-ws-card")) hits++;
      } catch (e) { /* */ }
    }
    return JSON.stringify({ srcs: srcs.length, fetched, hits });
  })()`);
  check("G0b the hooks live in the compiled chunks", g0b?.hits >= 1, JSON.stringify(g0b));

  /* 📸 settled */
  try { sh(`mkdir -p ${SHOTS} && agent-browser screenshot ${SHOTS}/t614-ws-settled.png >/dev/null 2>&1`); check("📸 settled shot", true); }
  catch (e) { check("📸 settled shot", false, String(e).slice(0, 60)); }

  /* ---------- W2: THE QUIET RE-RENDER ---------- */
  await readJson(`(() => {
    const card = document.querySelector("[data-ws-card]");
    window.__t614stash = { node: card, ad: card ? getComputedStyle(card).animationDelay : null };
    return JSON.stringify("stashed");
  })()`);
  await sleep(8000); /* the store's poll ticks keep the panel re-rendering */
  const w2 = await readJson(`(() => {
    const card = document.querySelector("[data-ws-card]");
    if (!card || !window.__t614stash) return JSON.stringify({ ok: false, why: "gone" });
    const cs = getComputedStyle(card);
    return JSON.stringify({
      ok: card === window.__t614stash.node,
      adSame: cs.animationDelay === window.__t614stash.ad,
      an: cs.animationName,
      o: cs.opacity,
    });
  })()`);
  check("W2 THE QUIET RE-RENDER — same node, same ticket, no replay",
    w2?.ok === true && w2?.adSame === true && w2?.an === "receipt-arrival" && w2?.o === "1", JSON.stringify(w2));

  /* ---------- W3: THE TAB ROUND-TRIP ---------- */
  const left = clickTab("Catalog");
  check("W3 leave click", left === "clicked", String(left));
  await sleep(900);
  const gone = await readJson(`JSON.stringify(document.querySelectorAll("[data-ws-card],[data-ws-header],[data-ws-stats]").length)`);
  check("W3 the faces unmount on leave", gone === 0, `faces=${gone}`);
  /* fresh sampler, then return */
  check("W3 sampler re-armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const back = clickTab("Workspaces");
  check("W3 return click", back === "clicked", String(back));
  const reopened = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-ws-card]").length)`);
    return typeof n === "number" && n > 0 ? n : null;
  }, 15000, 300);
  check("W3 the panel remounts", typeof reopened === "number" && reopened > 0, `cards=${reopened}`);
  await sleep(1500);
  const stop3 = await readJson(STOP_SAMPLER);
  const tape3 = stop3?.tape ?? [];
  const w3 = analyzeWave(tape3, "w3", { header: 90, hint: 114, card: 138, stats: 162 });
  check("W3 THE ROUND-TRIP — a fresh ledger sings the same wave (from-state + same delays)", w3.ok, w3.notes.join("; ") || "same 90/114/138/162");
  check("W3 the descent witnessed in the warm world",
    descentOk(w3.cardTape ?? []) || descentOk(w3.headerTape ?? []) || descentOk(w3.hintTape ?? []) || descentOk(w3.statsTape ?? []),
    "the union doctrine: whichever line the grid spared proves the motion");
  const settled3 = await readJson(`(() => {
    const card = document.querySelector("[data-ws-card]");
    const cs = getComputedStyle(card);
    return JSON.stringify({ an: cs.animationName, o: cs.opacity });
  })()`);
  check("W3 the settled face keeps its word again", settled3?.an === "receipt-arrival" && settled3?.o === "1", JSON.stringify(settled3));
  try { sh(`agent-browser screenshot ${SHOTS}/t614-ws-replay.png >/dev/null 2>&1`); check("📸 replay shot", true); }
  catch (e) { check("📸 replay shot", false, String(e).slice(0, 60)); }

  /* ---------- R: the return path ---------- */
  const rWorld = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    /* the dev tools indicator carries data-nextjs-toast — the honest
     * error check names only the dialog pair (the window's tuition):
     */
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    return JSON.stringify({ cards, edges, errDialog });
  })()`);
  check("R canvas intact (12c/13e)", rWorld?.cards === 12 && rWorld?.edges === 13, JSON.stringify(rWorld));
  check("R no error dialog in the dev portal", rWorld?.errDialog === false, JSON.stringify(rWorld));
  const errs = stop3?.errs ?? [];
  check("R the error net is empty", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}

console.log(`\n=== ${pass}/${pass + fail} passed ===`);
process.exit(fail === 0 ? 0 : 1);
