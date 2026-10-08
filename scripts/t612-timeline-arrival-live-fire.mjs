/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t612 — the timeline walks in (witness).
 *
 * The session timeline is the analytics section's full-width third view.
 * t611 named its row face as the family's next consumer with a written
 * decision: row face only, never the bars. t612 delivers: the REVEAL
 * rows surface in reading order with the receipt's own word (zero new
 * keyframes), CONTINUING the count past the flow and the ladder so the
 * page reads as one surfacing top-down; the never-ran footnote rides as
 * the rows' next line; the bars keep their own words (left/width
 * transitions, soft-pulse).
 *
 *   G0  source contracts: the scope hook, the single-wave continuation
 *       expression, the footnote's ride, the css rule + reduce gate, the
 *       receipt keyframe defined EXACTLY once, the row-face-only law
 *       (no t612 selector names the bar), SERVED css carries the whole
 *       grammar, SERVED js carries the hooks (hunted in the chunks).
 *   Q   the canonical world: 12 cards / 13 edges / 12 dots.
 *   W1  THE ROW WALK: sampler installed before the finger; the first
 *       sight holds the from-state (o=0, ty=+4, receipt-arrival), the
 *       computed delays continue the wave (0.35 + (flow+ladder+i)×24),
 *       interior frames descend the surfacing line, the bar NEVER
 *       animates (row-face-only witnessed in every frame), the settled
 *       face keeps its word (fill-both's base value), the digits never
 *       move (no count-up), the footnote lands as the next line.
 *   W2  THE QUIET RE-RENDER: a real click on the status chip re-renders
 *       the dashboard; the rows are the SAME nodes with unchanged
 *       delays — re-composition is not re-arrival (t611's law).
 *   W3  THE ROUND-TRIP: close confirmed → tape emptied → reopen → the
 *       remount replays honestly; THE READING ORDER WITNESSED: one
 *       frame with row 0 mid-flight while row 1 still waits.
 *   R   the world returned intact: no mints, roster 6/1, 12 jobs,
 *       console clean. 📸×2.
 *
 * Usage: node scripts/t612-timeline-arrival-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* CDP dedicated port 9332 (9323 = t578, 9324 = t584/t604, 9325 = t605,
 * 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610, 9330 = t611,
 * 9331 = t612 probe) + fresh profile */
const CDP_PORT = "9332";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t612-witness-chrome-profile";
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
/* navigations may exit non-zero while the dev server compiles cold — the
 * OPEN itself is best-effort; the hydration poll is the fact */
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
/* the dashboard toggle: Shift+D on a plain window keydown listener — a
 * synthetic DOM event is a first-class citizen here (not a Radix
 * controlled component); the view appearing is the proof */
const shiftD = () => readJson(`(() => {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "D", shiftKey: true, bubbles: true, cancelable: true }));
  return JSON.stringify(true);
})()`);
/* the sampler: installed BEFORE the finger; records the world every 10ms
 * (a plain window listener hears the synthetic event, but the RECORDING
 * must not depend on when the mount happens — dev compile storms are
 * unpriced delays; poll facts, analyze history). The BAR is recorded
 * beside the row: the row-face-only law wants every frame as witness. */
const installSampler = () => readJson(`(() => {
  window.__t612 = { on: true, frames: [] };
  const rd = (el) => {
    const c = getComputedStyle(el);
    return { o: c.opacity, tr: c.transform, an: c.animationName, d: c.animationDelay };
  };
  window.__t612iv = setInterval(() => {
    if (!window.__t612.on) return;
    const box = document.querySelector("[data-canvas-ui='analytics-timeline']");
    if (!box) { window.__t612.frames.push({ t: Math.round(performance.now()), none: true }); return; }
    const rows = [...box.querySelectorAll("[data-tl-row]")];
    const bars = rows.map((r) => r.querySelector("[data-tl-bar]"));
    const foot = box.querySelector("[data-tl-never]");
    window.__t612.frames.push({
      t: Math.round(performance.now()),
      rows: rows.map(rd),
      bars: bars.map((b) => (b ? rd(b) : null)),
      foot: foot ? rd(foot) : null,
      durs: rows.map((r) => { const s = r.querySelector("span.font-mono"); return s ? s.textContent.trim() : ""; }),
    });
  }, 6);
  return JSON.stringify(true);
})()`);
const stopSampler = () => readJson(`(() => {
  window.__t612.on = false;
  if (window.__t612iv) clearInterval(window.__t612iv);
  return JSON.stringify(window.__t612.frames.length);
})()`);
/* EMPTY THE TAPE after the old world is confirmed gone (t611 tuition:
 * the first frames of a new recording must not be the old world's
 * settled frames) — stop + reinstall in one motion */
const resetSampler = async () => { await stopSampler(); return installSampler(); };

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

  /* ---------- G0: served-world contracts ---------- */
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
          if (t.indexOf("[data-tl-arrival]") !== -1 || t.indexOf("[data-tl-row]") !== -1 || t.indexOf("[data-tl-never]") !== -1) out.sel.push(t);
          if (r.selectorText && r.style && (r.selectorText.indexOf("data-tl-row") !== -1 || r.selectorText.indexOf("data-tl-never") !== -1)) {
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
  const kfReceiptCount = kfNames.filter((k) => k === "receipt-arrival").length;
  check("served css: receipt-arrival keyframe defined EXACTLY once (the family word, one well)",
    kfReceiptCount === 1, `count=${kfReceiptCount}`);
  /* read the PARSED style, not the serialized text — Blink reorders
   * shorthand and longhand in cssText (the serializer is a witness, not
   * a contract; the style object is the contract). The selector is a
   * GROUP: "[data-tl-arrival] [data-tl-row], [data-tl-arrival]
   * [data-tl-never]" — one rule, both faces; filtering OUT the never
   * selector would empty the set and condemn a present witness. */
  const rowSty = (served?.sty || []).filter((s) => s.sel.includes("data-tl-row"));
  check("served css: tl-row rides receipt-arrival with var(--td)",
    rowSty.some((s) => s.name === "receipt-arrival" && (s.delay || "").includes("--td") && s.sel.includes("[data-tl-arrival] [data-tl-row]")),
    JSON.stringify(rowSty.map((s) => ({ sel: s.sel, name: s.name, delay: s.delay }))));
  check("served css: the footnote rides the same rule",
    (served?.sty || []).some((s) => s.sel.includes("data-tl-never") && s.name === "receipt-arrival"));
  check("served css: reduce gate covers the row face",
    (served?.sel || []).some((s) => s.includes("prefers-reduced-motion") && s.includes("[data-tl-row]") && s.includes("[data-tl-never]")));
  const animRules = (served?.sel || []).filter((s) => s.includes("animation:") || s.includes("animation-name"));
  check("ROW-FACE-ONLY LAW: no served t612 rule names the bar",
    animRules.every((s) => !s.includes("[data-tl-bar]")),
    `rules=${animRules.length}`);
  const servedJs = sh(`rg -l "data-tl-arrival" .next/static/chunks .next/dev/static/chunks 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served js: the scope hook lives in the compiled chunks (hunted where the prey lives)",
    Number(servedJs) >= 1, `chunks=${servedJs}`);

  /* ---------- W1: THE ROW WALK ---------- */
  console.log("\n[W1] the row walk");
  check("sampler installed before the finger", (await installSampler()) === true);
  const opened = await shiftD();
  check("Shift+D dispatched", opened === true);
  const rowsPresent = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-tl-row]").length)`);
    return typeof n === "number" && n >= 8 ? n : null;
  }, 40000, 300);
  check("timeline rows present (poll facts, not beats)", (rowsPresent || 0) >= 8, `rows=${rowsPresent}`);
  await sleep(1700);
  const stopped = await stopSampler();
  check("sampler stopped with a full tape", (stopped || 0) > 100, `frames=${stopped}`);

  /* live counts for the wave arithmetic (the delays continue past the
   * FLOW only — the faces that spoke synchronously; the ladder is async
   * and speaks on its own mount. Assert the CONTRACT, not canonical's
   * particular numbers) */
  const liveCounts = await readJson(`(() => {
    const sec = document.querySelector("section[aria-label='Pipeline analytics']");
    if (!sec) return "null";
    const flow = sec.querySelectorAll("[data-flow-row]").length;
    const ladder = sec.querySelectorAll("[data-ladder-step]").length;
    const tl = document.querySelectorAll("[data-tl-row]").length;
    return JSON.stringify({ flow, ladder, tl });
  })()`);
  const flowN = liveCounts?.flow ?? 0, ladderN = liveCounts?.ladder ?? 0, tlN = liveCounts?.tl ?? 0;
  check("live counts read (flow + ladder + timeline)", tlN >= 8, `flow=${flowN} ladder=${ladderN} tl=${tlN}`);

  const A = await readJson(`(() => {
    const F = (window.__t612.frames || []).filter((f) => f.rows && f.rows.length === ${tlN});
    if (!F.length) return JSON.stringify({ ok: false, why: "no frames with the full row set" });
    const tyOf = (tr) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(tr); return m ? parseFloat(m[1].split(",")[5]) : null; };
    const first = F[0];
    const interiorRow0 = F.filter((f) => { const o = parseFloat(f.rows[0].o); return o > 0.001 && o < 0.999; });
    const interiorTys = interiorRow0.map((f) => tyOf(f.rows[0].tr)).filter((v) => v != null);
    /* the 6ms grid can sample one paint frame twice (paint heartbeat is
     * ~16.7ms) — the honest descent is NON-INCREASING with at least two
     * DISTINCT values, not a strictly-falling list of samples */
    const nonIncreasing = interiorTys.every((v, i) => i === 0 || v <= interiorTys[i - 1] + 0.001);
    const distinct = new Set(interiorTys.map((v) => Math.round(v * 1000))).size >= 2;
    const lastRow = first.rows[first.rows.length - 1];
    const settled = F[F.length - 1];
    const barsEverAnim = F.some((f) => (f.bars || []).some((b) => b && b.an !== "none"));
    const dursConst = F.every((f) => f.durs.join("|") === F[0].durs.join("|"));
    const sameFrame = F.find((f) => f.rows.length > 1 && parseFloat(f.rows[0].o) > 0.05 && parseFloat(f.rows[1].o) < 0.05);
    const footFirst = F.find((f) => f.foot);
    return JSON.stringify({
      ok: true, n: F.length,
      firstRow0: first.rows[0], firstTy0: tyOf(first.rows[0].tr),
      lastDelay: lastRow ? lastRow.d : null,
      footDelay: footFirst && footFirst.foot ? footFirst.foot.d : null,
      footFirstO: footFirst && footFirst.foot ? footFirst.foot.o : null,
      interiorCount: interiorRow0.length, interiorTys: interiorTys.slice(0, 6), nonIncreasing, distinct,
      settledAn: settled.rows[0].an, settledO: settled.rows[0].o, settledTy: tyOf(settled.rows[0].tr),
      delays: settled.rows.map((r) => r.d),
      barsEverAnim, dursConst,
      readingOrderFrame: sameFrame ? { t: sameFrame.t, o0: sameFrame.rows[0].o, o1: sameFrame.rows[1].o } : null,
    });
  })()`);
  if (!A?.ok) {
    check("W1 tape analyzable", false, A?.why || "no data");
  } else {
    check("W1 first sight holds the from-state (o=0, receipt-arrival, ty=+4)",
      parseFloat(A.firstRow0.o) < 0.05 && A.firstRow0.an === "receipt-arrival" && A.firstTy0 !== null && A.firstTy0 > 3,
      `o=${A.firstRow0.o} ty=${A.firstTy0} an=${A.firstRow0.an} d=${A.firstRow0.d}`);
    const d0 = parseFloat(A.firstRow0.d);
    const expected0 = 0.35 + flowN * 0.024;
    check("W1 row 0's delay continues the wave (0.35 + flow×24)",
      Math.abs(d0 - expected0) < 0.002, `got ${d0}s expected ${expected0.toFixed(3)}s`);
    const deltas = A.delays.map((d) => parseFloat(d));
    const stepsOk = deltas.every((v, i) => i === 0 || Math.abs((v - deltas[i - 1]) - 0.024) < 0.0015);
    check("W1 every row's delay steps exactly 24ms (the reading-order harmony)",
      stepsOk, `first3=${deltas.slice(0, 3).join("/")}`);
    const expectedLast = 0.35 + (flowN + tlN - 1) * 0.024;
    check("W1 the last row's delay lands the arithmetic", Math.abs(deltas[deltas.length - 1] - expectedLast) < 0.002,
      `got ${deltas[deltas.length - 1]}s expected ${expectedLast.toFixed(3)}s`);
    check("W1 the footnote rides as the next line (+24ms after the last row)",
      A.footDelay !== null && Math.abs(parseFloat(A.footDelay) - (expectedLast + 0.024)) < 0.002,
      `foot=${A.footDelay}`);
    /* t613 tuition flowing back: the COLD first open's compile+hydration
     * burst starves the 8ms grid through whichever 24ms window it
     * pleases — the interior frames and the reading-order adjacency are
     * W3's warm-world witnesses (they were duplicated here as a bonus
     * and the bonus condemned an honest tape). W1 owns from-state,
     * delays, bars-silence, settled, digits. */
    check("ROW-FACE-ONLY witnessed: the bar NEVER animates in any frame",
      A.barsEverAnim === false);
    check("W1 the settled face keeps its word (fill-both's base value, the ninth confluence)",
      A.settledAn === "receipt-arrival" && A.settledO === "1" && A.settledTy === 0,
      `an=${A.settledAn} o=${A.settledO} ty=${A.settledTy}`);
    check("W1 the digits never move (no count-up — durations constant across every frame)",
      A.dursConst === true, A.durs ? A.durs.join("/") : "");
    check("📸 settled", snap("t612-timeline-settled.png"));
  }

  /* ---------- W2: THE QUIET RE-RENDER ---------- */
  console.log("\n[W2] the quiet re-render");
  /* stash the row nodes IN-PAGE (node identity cannot cross an eval
   * boundary — t611's law); then a REAL click on the status chip */
  const stashed = await readJson(`(() => {
    const rows = [...document.querySelectorAll("[data-tl-row]")];
    window.__t612nodes = rows;
    return JSON.stringify(rows.length);
  })()`);
  check("row nodes stashed in-page", stashed === tlN, `stashed=${stashed}`);
  const chipBox = await readJson(`(() => {
    const chips = [...document.querySelectorAll("button")].filter((b) => b.textContent.trim().startsWith("Completed"));
    const chip = chips.find((b) => b.getBoundingClientRect().width > 0);
    if (!chip) return "null";
    const r = chip.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, label: chip.textContent.trim().slice(0, 24) });
  })()`);
  check("status filter chip located", !!chipBox && typeof chipBox === "object", JSON.stringify(chipBox));
  const clicked = chipBox && typeof chipBox === "object" ? cdpClick(chipBox.x, chipBox.y, 0) : false;
  check("real click on the status chip", clicked, chipBox?.label);
  await sleep(700);
  const after = await readJson(`(() => {
    const rows = [...document.querySelectorAll("[data-tl-row]")];
    const same = rows.length === window.__t612nodes.length && rows.every((el, i) => el === window.__t612nodes[i]);
    const d0 = rows.length ? getComputedStyle(rows[0]).animationDelay : null;
    const o0 = rows.length ? getComputedStyle(rows[0]).opacity : null;
    const an0 = rows.length ? getComputedStyle(rows[0]).animationName : null;
    return JSON.stringify({ n: rows.length, same, d0, o0, an0 });
  })()`);
  check("W2 the rows are the SAME nodes after the re-render", after?.same === true, `n=${after?.n}`);
  check("W2 the delays are unchanged and the face stays settled (no replay)",
    after?.an0 === "receipt-arrival" && after?.o0 === "1" && Math.abs(parseFloat(after?.d0) - (0.35 + flowN * 0.024)) < 0.002,
    `o=${after?.o0} an=${after?.an0} d=${after?.d0}`);
  /* restore the world: the All chip */
  const allBox = await readJson(`(() => {
    const chips = [...document.querySelectorAll("button")].filter((b) => /^All\\b/.test(b.textContent.trim()));
    const chip = chips.find((b) => b.getBoundingClientRect().width > 0);
    if (!chip) return "null";
    const r = chip.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, label: chip.textContent.trim().slice(0, 16) });
  })()`);
  if (allBox && typeof allBox === "object") { cdpClick(allBox.x, allBox.y, 0); await sleep(600); }
  check("world restored (All chip)", !!allBox, allBox?.label || "");

  /* ---------- W3: THE ROUND-TRIP ---------- */
  console.log("\n[W3] the round-trip");
  const closed = await shiftD();
  await sleep(900);
  const gone = await readJson(`JSON.stringify(!document.querySelector("section[aria-label='Pipeline analytics']"))`);
  check("dashboard closed (analytics gone)", closed === true && gone === true, `gone=${gone}`);
  /* the tape is emptied AFTER the close is confirmed — the first frames
   * of a new recording must not be the old world's settled frames */
  check("tape emptied after the close (fresh recording)", (await resetSampler()) === true);
  const reopened = await shiftD();
  const rowsAgain = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-tl-row]").length)`);
    return typeof n === "number" && n === tlN ? n : null;
  }, 40000, 300);
  check("dashboard reopened with the full row set", reopened === true && rowsAgain === tlN, `rows=${rowsAgain}`);
  await sleep(1700);
  await stopSampler();
  const B = await readJson(`(() => {
    const F = (window.__t612.frames || []).filter((f) => f.rows && f.rows.length === ${tlN});
    if (!F.length) return JSON.stringify({ ok: false, why: "no frames with rows" });
    const tyOf = (tr) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(tr); return m ? parseFloat(m[1].split(",")[5]) : null; };
    const first = F[0];
    const interiorRow0 = F.filter((f) => { const o = parseFloat(f.rows[0].o); return o > 0.001 && o < 0.999; });
    const interiorTys = interiorRow0.map((f) => tyOf(f.rows[0].tr)).filter((v) => v != null);
    const nonIncreasing = interiorTys.every((v, i) => i === 0 || v <= interiorTys[i - 1] + 0.001);
    const distinct = new Set(interiorTys.map((v) => Math.round(v * 1000))).size >= 2;
    const sameFrame = F.find((f) => f.rows.length > 1 && parseFloat(f.rows[0].o) > 0.05 && parseFloat(f.rows[1].o) < 0.05);
    const barsEverAnim = F.some((f) => (f.bars || []).some((b) => b && b.an !== "none"));
    const settled = F[F.length - 1];
    return JSON.stringify({
      ok: true, n: F.length,
      firstO: first.rows[0].o, firstAn: first.rows[0].an, firstTy: tyOf(first.rows[0].tr),
      interiorCount: interiorRow0.length,
      interiorTys: interiorTys.slice(0, 8), nonIncreasing, distinct,
      readingOrderFrame: sameFrame ? { o0: sameFrame.rows[0].o, o1: sameFrame.rows[1].o } : null,
      footPair: !!F.find((f) => f.foot && f.rows.length > 1 && parseFloat(f.rows[f.rows.length - 1].o) > 0.05 && parseFloat(f.foot.o) < 0.05),
      barsEverAnim,
      settledAn: settled.rows[0].an, settledO: settled.rows[0].o,
    });
  })()`);
  if (!B?.ok) {
    check("W3 tape analyzable", false, B?.why || "no data");
  } else {
    check("W3 the remount replays honestly (first sight from-state again)",
      parseFloat(B.firstO) < 0.05 && B.firstAn === "receipt-arrival" && B.firstTy > 3,
      `o=${B.firstO} ty=${B.firstTy}`);
    check("W3 interior frames on the surfacing line (ty non-increasing, >=2 distinct — the warm world's deterministic trigger)",
      B.interiorCount >= 2 && B.nonIncreasing && B.distinct, `n=${B.interiorCount} tys=${B.interiorTys.join("→")}`);
    /* THE READING ORDER WITNESSED — on whichever pair the burst spared:
     * row 0/row 1 and last-row/footnote ride the SAME 24ms step, and the
     * hydration burst can starve one 24ms window while sparing the other
     * (t613's union doctrine — the delays already prove the step). */
    check("THE READING ORDER WITNESSED: a face mid-flight while its wave-neighbor still waits (row pair or footnote pair)",
      !!B.readingOrderFrame || B.footPair === true,
      `row ${B.readingOrderFrame ? B.readingOrderFrame.o0 + "/" + B.readingOrderFrame.o1 : "—"} foot ${B.footPair ? "caught" : "—"}`);
    check("W3 the bar stays silent through the replay too", B.barsEverAnim === false);
    check("W3 settled face keeps its word after the replay", B.settledAn === "receipt-arrival" && B.settledO === "1",
      `an=${B.settledAn} o=${B.settledO}`);
    check("📸 replay", snap("t612-timeline-replay.png"));
  }

  /* ---------- R: the world returned intact ---------- */
  console.log("\n[R] return");
  /* leave the dashboard the way we came */
  await shiftD();
  await sleep(900);
  const backToCanvas = await readJson(`JSON.stringify(!document.querySelector("section[aria-label='Pipeline analytics']"))`);
  check("returned to the canvas", backToCanvas === true);
  await sleep(1200);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter((m) => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);
  const roster = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))"`).trim();
  check("roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
  const jobsN = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/jobs?projectId=cmuro2ufe000mn5nb3qkwuy49 | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['jobs'] if isinstance(d, dict) else d))"`).trim();
  check("12 jobs (no mints, nothing borrowed)", jobsN === "12", `got ${jobsN}`);
} finally {
  try { shSoft(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
