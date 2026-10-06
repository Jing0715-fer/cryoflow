/**
 * t617 — THE INSPECTOR'S OWN WAVE: the modal's arrival, witnessed live.
 *
 * The product (job-inspector.tsx InspectorBody + globals.css t617 block):
 * the modal a card click opens joins the arrival grammar — status accent →
 * header → tabs bar → the ACTIVE tab's panel → workdir footer, the
 * receipt's own word, zero new keyframes (eighth family consumer), base
 * 90ms (the USER-GESTURE beat — the rail's pulse, t614/t616), every face's
 * ticket from the MOUNT LEDGER (t613's law, FOURTH consumer) that dies
 * with the dialog (Radix unmounts DialogContent on close — every open
 * re-issues fresh).
 *
 * THE FOLD LAW, second consumer, NEW MECHANISM: Radix TabsContent never
 * unmounts its panels — it hides the inactive ones (hidden attr) and
 * strips their children — so nomination, not mount, is the arrival: only
 * the active panel carries data-insp-face; the attribute appearing is the
 * animation's cue. A first visit pays the ledger's tail (210); a RETURN
 * replays the frozen ticket (162) on the SAME div.
 *
 * The workdir footer is DATA-GATED (mounts when the outputs fetch lands):
 * the late arrival fills the ledger's tail (186) at its own mount — the
 * t616 favorites precedent.
 *
 * Witness sections:
 *   G0  the served-CSS contract (parsed style objects): the wave's rule
 *       reads receipt-arrival + var(--insp-d); the reduce gate answers
 *       none; receipt-arrival is DEFINED exactly once; no wave rule names
 *       the chrome (button / aria-label / animate-spin / input).
 *   G0b the served-JS contract: the hooks live in the compiled chunks.
 *   Q   the world: 12c/13e, no error dialog.
 *   W1  THE MODAL SURFACES: the sampler armed BEFORE the real card click
 *       (pointer events — the card listens on pointerup): 4 faces hold
 *       the from-state at their exact tickets (90 + 24i), the descent is
 *       witnessed (union doctrine), the chrome is silent in every frame,
 *       the canvas behind is untouched, the default panel is results
 *       (the completed job's smart default, t363).
 *   W2  THE LATE FOOTER: the data-gated face mounts AFTER the wave and
 *       pays the tail (186), while the four open faces keep their frozen
 *       tickets (the ledger does not rewrite).
 *   W3  THE TAB LADDERS: first visit to Overview pays the TAIL (210, not
 *       the seat's 162 — the doctrine's negative space); returning to
 *       Results replays the FROZEN 162 on the SAME div (nomination, not
 *       mount); the footer's ticket never moves.
 *   W4  THE QUIET RE-RENDER: after the shell's poll ticks, the panel is
 *       the SAME node with the SAME ticket — re-composition is not
 *       re-arrival.
 *   W5  THE ROUND-TRIP: a real Escape closes; a fresh dialog (new node,
 *       new ledger) sings the SAME wave — determinism.
 *   R   the return path: canvas intact, error net empty.
 *
 * CDP port 9337 (9336 = t617 probe), fresh profile (t581 lesson).
 * Usage: node scripts/t617-inspector-wave-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9337";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t617-witness-chrome-profile";
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
/* REAL input via the snapshot ref flow (t614/t616 tuition: Radix triggers
 * swallow synthetic .click(); the ref regex reads ref= wherever it sits —
 * state and ref share one bracket pair). */
const clickRef = (needle, rolePrefix = "- button ") => {
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
 * faces every frame (the dialog mounts later), recording the parsed style
 * — animationName/animationDelay/opacity/transform, the mechanism layer */
const INSTALL_SAMPLER = `(() => {
  window.__t617 = { tape: [], on: true, errs: [] };
  window.addEventListener("error", (e) => { window.__t617.errs.push(String(e.message || e)); });
  const tick = () => {
    if (!window.__t617.on) return;
    try {
      document.querySelectorAll("[data-insp-arrival] [data-insp-face]").forEach((el, idx) => {
        const cs = getComputedStyle(el);
        window.__t617.tape.push({
          t: Math.round(performance.now()), k: el.dataset.inspFace, i: idx,
          o: cs.opacity, an: cs.animationName, ad: cs.animationDelay, tf: cs.transform,
        });
      });
      const trig = document.querySelector("[data-inspector-dialog] [role='tab']");
      if (trig) {
        const tcs = getComputedStyle(trig);
        window.__t617.tape.push({ t: Math.round(performance.now()), k: "chrome-trigger", i: -1, o: tcs.opacity, an: tcs.animationName, ad: tcs.animationDelay, tf: "none" });
      }
      const copy = document.querySelector("[data-inspector-dialog] footer button");
      if (copy) {
        const ccs = getComputedStyle(copy);
        window.__t617.tape.push({ t: Math.round(performance.now()), k: "chrome-copy", i: -1, o: ccs.opacity, an: ccs.animationName, ad: ccs.animationDelay, tf: "none" });
      }
    } catch (e) { window.__t617.errs.push("sampler:" + String(e)); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return JSON.stringify("armed");
})()`;
const STOP_SAMPLER = `(() => {
  if (window.__t617) window.__t617.on = false;
  const tape = window.__t617 ? window.__t617.tape : [];
  const errs = window.__t617 ? window.__t617.errs : [];
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
/* W1/W5 analysis: the faces' first sight, keyed by doc-order seat (the
 * open composition mounts all four in one render); expected = 90 + seat*24.
 * NON-mutating: the kind is copied — the caller keeps reading the raw tape
 * (the first run's panel-default assertion died because analyzeWave rewrote
 * panel:results to panel in place). */
const analyzeWave = (tape, wantCount) => {
  const firstBySeat = new Map();
  const linesBySeat = new Map();
  const chromeRows = [];
  for (const r of tape) {
    const kind = String(r.k);
    if (kind.startsWith("chrome")) { chromeRows.push(r); continue; }
    const seatKey = kind.startsWith("panel:") ? "panel" : kind;
    const seat = r.i;
    if (!firstBySeat.has(seat)) {
      firstBySeat.set(seat, { ...r, k: seatKey });
      linesBySeat.set(seat, []);
    }
    linesBySeat.get(seat).push(r);
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
    } catch { /* */ }
    if (!connected) await sleep(800);
  }
  check("agent-browser connected", connected, `port ${CDP_PORT}`);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  check("hover shim applied", applyShim());
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 180000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* ---------- Q: the world ---------- */
  const world = await readJson(`(() => {
    const cards = document.querySelectorAll("[data-job]").length;
    const edges = document.querySelectorAll("[data-edge-id]").length;
    const portal = document.querySelector("nextjs-portal");
    const errDialog = portal && portal.shadowRoot
      ? !!portal.shadowRoot.querySelector("[data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      : false;
    return JSON.stringify({ cards, edges, errDialog });
  })()`);
  check("Q canvas 12c/13e", world?.cards === 12 && world?.edges === 13, JSON.stringify(world));
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
        if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && rule.selectorText.includes("data-insp-arrival")) {
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
  check("G0 the wave rule reads the receipt word + var(--insp-d)",
    enterRules.length >= 1 && enterRules.every((r) => r.an === "receipt-arrival" && typeof r.ad === "string" && r.ad.startsWith("var(--insp-d")),
    JSON.stringify(enterRules.map((r) => [r.sel.slice(0, 60), r.an, r.ad])));
  check("G0 the reduce gate answers none",
    reduceRules.length >= 1 && reduceRules.every((r) => r.an === "none"),
    `reduce rules: ${reduceRules.length}`);
  check("G0 receipt-arrival defined exactly once", g0?.receiptDefs === 1, `defs=${g0?.receiptDefs}`);
  const chromeNamed = (g0?.rules ?? []).filter((r) =>
    r.sel.includes("animate-spin") || r.sel.includes("aria-label") || r.sel.includes("button") || r.sel.includes("input"));
  check("G0 the wave never names the chrome", chromeNamed.length === 0, JSON.stringify(chromeNamed.map((r) => r.sel.slice(0, 60))));

  /* ---------- the card needle (a completed job opens on Results) ---------- */
  const labelOf = await readJson(`(() => {
    const el = document.querySelector("[data-job] [role='button']");
    return JSON.stringify(el ? el.getAttribute("aria-label") : null);
  })()`);
  const needle = String(labelOf).split(" — ")[0].slice(0, 24);
  check("the card needle read", typeof labelOf === "string" && labelOf.length > 0, String(labelOf));

  /* ---------- WARMUP: the cold-.next chunk race, tamed ---------- */
  /* the .next rebuild (this window's dev-server cold boot) makes the results
   * tab's LAZY chunks (import-gallery & co) compile on demand — the first
   * open races the compile and dies with ChunkLoadError, which both pollutes
   * the error net and (witnessed live in run 1) closes the dialog mid-run.
   * Warm the lanes once, then RELOAD for a clean error net. */
  const warmClick = clickRef(needle, "- button ");
  const warmUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog][data-state='open']"))`);
    return n === true ? "open" : null;
  }, 15000, 200);
  check("WARMUP the dialog opened", warmUp === "open", `click=${warmClick}`);
  const warmFtr = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector('[data-insp-face="footer"]'))`);
    return n === true ? "warmed" : null;
  }, 40000, 300);
  check("WARMUP the outputs fetch landed (footer face present)", warmFtr === "warmed", String(warmFtr));
  await sleep(8000); /* the lazy chunks (import gallery & co) settle into .next */
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser reload >/dev/null 2>&1`);
  const hydrated2 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 180000, 500);
  check("WARMUP the reloaded world re-hydrated 12 cards", hydrated2 === 12, `got ${hydrated2}`);
  await sleep(1500);

  /* ---------- W1: THE MODAL SURFACES (sampler armed before the finger) ----------
   * ONE CONTINUOUS sampler through W1+W2: the footer's mount time is
   * uncontrolled (the outputs fetch), so a stop/re-arm gap can swallow its
   * from-state (run 1's W2 read o=1 at first sight — the wave finished in
   * the gap). W1 PEEKS at the tape; the sampler keeps rolling until W2's
   * footer has settled, then stops once. */
  check("W1 sampler armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const cardClick = clickRef(needle, "- button ");
  check("W1 the card clicked (real pointer input)", cardClick === "clicked", String(cardClick));
  const dialogUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog][data-state='open']"))`);
    return n === true ? "open" : null;
  }, 15000, 120);
  check("W1 the inspector modal mounted", dialogUp === "open", String(dialogUp));
  await sleep(1700); /* the wave (402ms) + the dialog's own 300ms settle fully */
  const peek1 = await readJson(`(() => {
    if (!window.__t617) return JSON.stringify({ n: 0, tape: [] });
    return JSON.stringify({ n: window.__t617.tape.length, tape: window.__t617.tape.slice() });
  })()`);
  const tape1 = peek1?.tape ?? [];
  check("W1 the tape has volume", tape1.length > 150, `rows=${tape1.length}`);
  const openRows = tape1.filter((r) => r.k !== "footer");
  const w1 = analyzeWave(openRows, 4);
  check("W1 THE MODAL SURFACES — 4 faces, from-state + exact tickets 90+24i",
    w1.ok, w1.notes.join("; ") || `kinds: ${JSON.stringify(w1.kinds)}`);
  check("W1 the kind census (accent + header + tabs + the active panel)",
    w1.kinds.accent === 1 && w1.kinds.header === 1 && w1.kinds.tabs === 1 && w1.kinds.panel === 1,
    JSON.stringify(w1.kinds));
  check("W1 the panel is the completed job's smart default (panel:results)",
    openRows.some((r) => r.k === "panel:results") && !openRows.some((r) => String(r.k).startsWith("panel:") && r.k !== "panel:results"),
    `panel faces seen: ${[...new Set(openRows.filter((r) => String(r.k).startsWith("panel:")).map((r) => r.k))].join(",")}`);
  check("W1 the descent is witnessed (union doctrine)", w1.anyDescent,
    "some face's ty line: 4→0, non-increasing, 2+ distinct");
  const chromeNoisy1 = w1.chromeRows.filter((r) => r.an !== "none");
  check("W1 the chrome is silent in every frame", w1.chromeRows.length > 30 && chromeNoisy1.length === 0,
    `frames=${w1.chromeRows.length} noisy=${chromeNoisy1.length}`);
  const settled1 = await readJson(`(() => {
    /* the OPEN composition is four faces — but the WARM world's fetch can
     * land the footer INSIDE this window (run A: count 5). Name the four
     * explicitly; the footer's own ticket is W2's business. */
    const open = Array.from(document.querySelectorAll("[data-insp-arrival] [data-insp-face]"))
      .filter((f) => f.dataset.inspFace !== "footer");
    const opac = open.map((f) => getComputedStyle(f).opacity);
    const kinds = open.map((f) => f.dataset.inspFace).sort().join(",");
    return JSON.stringify({ count: open.length, kinds, allSettled: opac.every((o) => parseFloat(o) > 0.98) });
  })()`);
  check("W1 the settled wave keeps its word (open faces, all o=1)",
    settled1?.count === 4 && settled1?.kinds === "accent,header,panel:results,tabs" && settled1?.allSettled === true, JSON.stringify(settled1));
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
        if (text.includes("data-insp-face")) hits++;
      } catch (e) { /* */ }
    }
    return JSON.stringify({ srcs: srcs.length, fetched, hits });
  })()`);
  check("G0b the hooks live in the compiled chunks", g0b?.hits >= 1, JSON.stringify(g0b));

  /* 📸 settled */
  try { sh(`mkdir -p ${SHOTS} && agent-browser screenshot ${SHOTS}/t617-inspector-settled.png >/dev/null 2>&1`); check("📸 settled shot", true); }
  catch (e) { check("📸 settled shot", false, String(e).slice(0, 60)); }

  /* ---------- W2: THE LATE FOOTER (same sampler — no gap) ---------- */
  const ftrUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector('[data-insp-face="footer"]'))`);
    return n === true ? "arrived" : null;
  }, 40000, 300);
  check("W2 the data-gated footer arrived", ftrUp === "arrived", String(ftrUp));
  await sleep(900); /* the footer's 186+240ms arrival settles */
  const stop2 = await readJson(STOP_SAMPLER);
  const tape2 = stop2?.tape ?? [];
  const ftrRows = tape2.filter((r) => r.k === "footer");
  const firstFtr = ftrRows[0];
  check("W2 THE LATE FOOTER — the tail is the ticket (186) at a from-state first sight",
    !!firstFtr && firstFtr.an === "receipt-arrival" && Math.abs(msOf(firstFtr.ad) - 186) <= 3 && parseFloat(firstFtr.o) <= 0.02,
    firstFtr ? `ad=${msOf(firstFtr.ad)} o=${firstFtr.o}` : "footer absent from tape");
  const frozen = await readJson(`(() => {
    const read = (k) => {
      const el = document.querySelector('[data-insp-face="' + k + '"]');
      return el ? getComputedStyle(el).animationDelay : null;
    };
    return JSON.stringify({ accent: read("accent"), header: read("header"), tabs: read("tabs"), panel: read("panel:results") });
  })()`);
  check("W2 the open faces' tickets are FROZEN after the footer's fill",
    Math.abs(msOf(frozen?.accent) - 90) <= 3 && Math.abs(msOf(frozen?.header) - 114) <= 3
    && Math.abs(msOf(frozen?.tabs) - 138) <= 3 && Math.abs(msOf(frozen?.panel) - 162) <= 3,
    JSON.stringify(frozen));

  /* ---------- W3: THE TAB LADDERS (first visit pays the tail; a return replays frozen) ---------- */
  check("W3 sampler re-armed", (await readJson(INSTALL_SAMPLER)) === "armed");
  const ovClick = clickRef("Overview", "- tab ");
  check("W3 the Overview trigger clicked (real input)", ovClick === "clicked", String(ovClick));
  const ovUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector('[data-insp-face="panel:overview"]'))`);
    return n === true ? "nominated" : null;
  }, 10000, 150);
  check("W3 the overview panel nominated", ovUp === "nominated", String(ovUp));
  await sleep(1000); /* the 210+240ms arrival settles */
  const stop3 = await readJson(STOP_SAMPLER);
  const tape3 = stop3?.tape ?? [];
  const firstOv = tape3.find((r) => r.k === "panel:overview");
  check("W3 THE FIRST-VISIT LADDER — the new panel pays the ledger's tail (210, not the seat's 162)",
    !!firstOv && firstOv.an === "receipt-arrival" && Math.abs(msOf(firstOv.ad) - 210) <= 3 && parseFloat(firstOv.o) <= 0.02,
    firstOv ? `ad=${msOf(firstOv.ad)} o=${firstOv.o}` : "panel:overview absent from tape");
  const ftrStill3 = await readJson(`(() => {
    const f = document.querySelector('[data-insp-face="footer"]');
    return JSON.stringify({ ad: f ? getComputedStyle(f).animationDelay : null, o: f ? getComputedStyle(f).opacity : null });
  })()`);
  check("W3 the footer's ticket NEVER moved (the ledger does not rewrite)",
    Math.abs(msOf(ftrStill3?.ad) - 186) <= 3 && ftrStill3?.o === "1", JSON.stringify(ftrStill3));

  /* the return ladder: stash the results panel's div (by its radix id) */
  const stashNode = await readJson(`(() => {
    const p = document.querySelector("[data-inspector-dialog] [role='tabpanel'][id$='-content-results']");
    window.__t617panel = p;
    return JSON.stringify(p ? "stashed" : "missing");
  })()`);
  check("W3 the results panel div stashed", stashNode === "stashed", String(stashNode));
  check("W3 sampler re-armed (return leg)", (await readJson(INSTALL_SAMPLER)) === "armed");
  const rsClick = clickRef("Results", "- tab ");
  check("W3 the Results trigger clicked (the return)", rsClick === "clicked", String(rsClick));
  const rsUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector('[data-insp-face="panel:results"]'))`);
    return n === true ? "renominated" : null;
  }, 10000, 150);
  check("W3 the results panel re-nominated", rsUp === "renominated", String(rsUp));
  await sleep(1000);
  const stop3b = await readJson(STOP_SAMPLER);
  const tape3b = stop3b?.tape ?? [];
  const firstRs = tape3b.find((r) => r.k === "panel:results");
  check("W3 THE RETURN LADDER — the SAME div replays its FROZEN ticket (162, not a new tail 234)",
    !!firstRs && firstRs.an === "receipt-arrival" && Math.abs(msOf(firstRs.ad) - 162) <= 3 && parseFloat(firstRs.o) <= 0.02,
    firstRs ? `ad=${msOf(firstRs.ad)} o=${firstRs.o}` : "panel:results absent from tape");
  const nodeSame = await readJson(`(() => {
    const p = document.querySelector("[data-inspector-dialog] [role='tabpanel'][id$='-content-results']");
    return JSON.stringify({ sameDiv: p === window.__t617panel, connected: !!(p && p.isConnected) });
  })()`);
  check("W3 the div identity persisted (NOMINATION, not mount, is the cue)",
    nodeSame?.sameDiv === true && nodeSame?.connected === true, JSON.stringify(nodeSame));

  /* ---------- W4: THE QUIET RE-RENDER ---------- */
  await readJson(`(() => {
    const p = document.querySelector('[data-insp-face="panel:results"]');
    window.__t617quiet = { node: p, ad: p ? getComputedStyle(p).animationDelay : null };
    return JSON.stringify("stashed");
  })()`);
  await sleep(8000); /* the shell's poll ticks keep re-rendering the app */
  const w4 = await readJson(`(() => {
    const p = document.querySelector('[data-insp-face="panel:results"]');
    if (!p || !window.__t617quiet) return JSON.stringify({ ok: false, why: "gone" });
    const cs = getComputedStyle(p);
    return JSON.stringify({
      ok: p === window.__t617quiet.node,
      adSame: cs.animationDelay === window.__t617quiet.ad,
      an: cs.animationName,
      o: cs.opacity,
    });
  })()`);
  check("W4 THE QUIET RE-RENDER — same node, same ticket, no replay",
    w4?.ok === true && w4?.adSame === true && w4?.an === "receipt-arrival" && w4?.o === "1", JSON.stringify(w4));

  /* ---------- W5: THE ROUND-TRIP ---------- */
  const dialogStash = await readJson(`(() => {
    const d = document.querySelector("[data-inspector-dialog]");
    window.__t617dialog = d;
    return JSON.stringify(d ? "stashed" : "missing");
  })()`);
  check("W5 the dialog node stashed", dialogStash === "stashed", String(dialogStash));
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  const closed = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog]"))`);
    return n === false ? "closed" : null;
  }, 10000, 200);
  check("W5 the real Escape closed the modal", closed === "closed", String(closed));
  check("W5 sampler re-armed (reopen leg)", (await readJson(INSTALL_SAMPLER)) === "armed");
  const cardClick2 = clickRef(needle, "- button ");
  check("W5 the card clicked again", cardClick2 === "clicked", String(cardClick2));
  const dialogUp2 = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(!!document.querySelector("[data-inspector-dialog][data-state='open']"))`);
    return n === true ? "open" : null;
  }, 15000, 120);
  check("W5 the modal re-mounted", dialogUp2 === "open", String(dialogUp2));
  await sleep(1700);
  const stop5 = await readJson(STOP_SAMPLER);
  const tape5 = stop5?.tape ?? [];
  /* the WARM world's reopen fetch lands fast: the footer face can join the
   * sample window (run 2 saw 5 seats). The open wave's assertion stays 4
   * faces — footer rows are the W2 concern; their fresh-ledger ticket gets
   * its own live-DOM check below. */
  const openRows5 = tape5.filter((r) => r.k !== "footer");
  const w5 = analyzeWave(openRows5, 4);
  check("W5 THE ROUND-TRIP — a fresh ledger sings the SAME wave (from-state + same tickets)",
    w5.ok, w5.notes.join("; ") || "determinism: the same 90+24i as W1");
  check("W5 the descent witnessed again", w5.anyDescent, "union doctrine");
  const ftr5 = await pollUntil(async () => {
    const v = await readJson(`(() => {
      const f = document.querySelector('[data-insp-face="footer"]');
      if (!f) return JSON.stringify(null);
      const cs = getComputedStyle(f);
      return JSON.stringify({ ad: cs.animationDelay, o: cs.opacity });
    })()`);
    return v ? v : null;
  }, 40000, 300);
  check("W5 the fresh ledger re-issues the footer's tail ticket (186 again)",
    Math.abs(msOf(ftr5?.ad) - 186) <= 3 && ftr5?.o === "1", JSON.stringify(ftr5));
  const dialogFresh = await readJson(`(() => {
    const d = document.querySelector("[data-inspector-dialog]");
    return JSON.stringify({ fresh: d && d !== window.__t617dialog });
  })()`);
  check("W5 the dialog is a FRESH node (the ledger died with the old body)",
    dialogFresh?.fresh === true, JSON.stringify(dialogFresh));
  try { sh(`agent-browser screenshot ${SHOTS}/t617-inspector-replay.png >/dev/null 2>&1`); check("📸 replay shot", true); }
  catch (e) { check("📸 replay shot", false, String(e).slice(0, 60)); }
  /* close for a clean world */
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(700);

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
  const errs = (stop5?.errs ?? []).concat(stop3b?.errs ?? []).concat(stop3?.errs ?? []).concat(stop2?.errs ?? []);
  check("R the error net is empty", errs.length === 0, JSON.stringify(errs.slice(0, 3)));
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { if (chromeProc) chromeProc.kill(); } catch { /* */ }
}

console.log(`\n=== ${pass}/${pass + fail} passed ===`);
process.exit(fail === 0 ? 0 : 1);
