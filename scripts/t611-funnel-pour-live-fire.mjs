/**
 * t611 — the funnel pours: the analytics innards' arrival grammar, witnessed.
 *
 * The dashboard's PipelineAnalytics rises as furniture (rise-in) while its
 * innards have never had their own arrival. t611 lands the second layer:
 * flow rows surface in reading order (the receipt's word, 24ms step), each
 * bar POURS along the flow's own axis (scaleX from its left edge — the
 * section's only new direction, so the family's only new keyframe), ladder
 * steps surface oldest → newest. Movements:
 *
 *   G0  source contracts: four data hooks, the constants as the timing
 *       single source of truth, css rules + gates, flow-pour defined once,
 *       receipt-arrival referenced (the family word), SERVED css carries
 *       the whole grammar, SERVED js carries the hooks.
 *   W1  THE POUR: the sampler records from BEFORE the finger (a plain
 *       window keydown toggles the dashboard); the flight is read from
 *       history — first sight holds the delay's from-state (o=0), interior
 *       frames descend the surfacing line, the bar is caught mid-pour
 *       (matrix a strictly between 0 and 1), computed delays read
 *       0.35s + i×0.024s, the settled face KEEPS its animationName
 *       (fill-both's base value law, eighth confluence), and the digits
 *       are interrogated constant across every frame (no count-up).
 *   W2  THE ONE-POUR LAW: a re-render that preserves keys is not a new
 *       arrival — the status filter chip re-renders the dashboard
 *       (sorted is a fresh array every render), but the rows are
 *       isSameNode and the animations' startTimes do not move.
 *   W3  THE ROUND-TRIP: Shift+D away and back is a REMOUNT — the whole
 *       grammar replays honestly, and the warm world's 10ms grid catches
 *       THE READING ORDER WITNESSED: one frame with row 0 mid-flight
 *       while row 1 still waits (24ms step vs 10ms grid).
 *   R   the world returned intact: no mints, roster 6/1, 12 jobs,
 *       console clean. 📸×2.
 *
 * Usage: node scripts/t611-funnel-pour-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* CDP dedicated port 9330 (9323 = t578, 9324 = t584/t604, 9325 = t605,
 * 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610) + fresh profile */
const CDP_PORT = "9330";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t611-witness-chrome-profile";
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
 * unpriced delays; poll facts, analyze history) */
const installSampler = () => readJson(`(() => {
  window.__t611 = { on: true, frames: [] };
  const rd = (el) => {
    const c = getComputedStyle(el);
    return { o: c.opacity, tr: c.transform, an: c.animationName, d: c.animationDelay };
  };
  window.__t611iv = setInterval(() => {
    if (!window.__t611.on) return;
    const sec = document.querySelector("section[aria-label='Pipeline analytics']");
    if (!sec) { window.__t611.frames.push({ t: Math.round(performance.now()), none: true }); return; }
    const rows = [...sec.querySelectorAll("[data-flow-row]")];
    const bars = [...sec.querySelectorAll("[data-flow-bar]")];
    const steps = [...sec.querySelectorAll("[data-ladder-step]")];
    window.__t611.frames.push({
      t: Math.round(performance.now()),
      rows: rows.map(rd),
      bars: bars.map(rd),
      steps: steps.map(rd),
      counts: rows.map((r) => (r.querySelector("span.w-16") || r.querySelector("span.w-20")).textContent.trim()),
    });
  }, 6); /* t612 tuition回流: the denser grid survives the mount burst's
            sampler blackout — the 10ms tape starved to 1 interior frame
            in three of five cold opens */
  return JSON.stringify(true);
})()`);
const stopSampler = () => readJson(`(() => {
  window.__t611.on = false;
  if (window.__t611iv) clearInterval(window.__t611iv);
  return JSON.stringify(window.__t611.frames.length);
})()`);
/* in-page analysis of the recorded history — returns a small digest */
const analyze = (expectRows) => readJson(`(() => {
  const F = window.__t611.frames.filter((f) => f.rows && f.rows.length === ${expectRows});
  if (!F.length) return JSON.stringify({ ok: false, why: "no frames with rows" });
  const first = F[0];
  const interiorRow0 = F.filter((f) => { const o = parseFloat(f.rows[0].o); return o > 0.001 && o < 0.999; });
  const tyOf = (tr) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(tr); return m ? parseFloat(m[1].split(",")[5]) : null; };
  const pourMid = F.filter((f) => f.bars && f.bars.length && (() => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(f.bars[0].tr); if (!m) return false; const a = parseFloat(m[1].split(",")[0]); return a > 0.001 && a < 0.999; })());
  const pourAny = F.length && F[F.length - 1].bars && F[F.length - 1].bars.length ? /matrix\\(([-0-9., e]+)\\)/.exec(F[F.length - 1].bars[0].tr) : null;
  const countsConst = F.every((f) => f.counts.join("|") === F[0].counts.join("|"));
  const sameFrame = F.find((f) => parseFloat(f.rows[0].o) > 0.05 && parseFloat(f.rows[1].o) < 0.05);
  const ladderMid = F.filter((f) => f.steps && f.steps.length > 1 && (() => { const o = parseFloat(f.steps[1].o); return o > 0.001 && o < 0.999; })());
  return JSON.stringify({
    ok: true,
    n: F.length,
    firstRow0: first.rows[0],
    firstBar0: first.bars ? first.bars[0] : null,
    interiorN: interiorRow0.length,
    interiorTy: interiorRow0.slice(0, 9).map((f) => tyOf(f.rows[0].tr)),
    interiorO: interiorRow0.slice(0, 9).map((f) => parseFloat(f.rows[0].o)),
    pourMidN: pourMid.length,
    pourMidA: pourMid.slice(0, 5).map((f) => { const m = /matrix\\(([-0-9., e]+)\\)/.exec(f.bars[0].tr); return parseFloat(m[1].split(",")[0]); }),
    lastRow0: F[F.length - 1].rows[0],
    lastBar0: F[F.length - 1].bars ? F[F.length - 1].bars[0] : null,
    rowDelays: F[F.length - 1].rows.map((r) => r.d),
    barDelays: F[F.length - 1].bars ? F[F.length - 1].bars.map((r) => r.d) : [],
    stepDelays: F[F.length - 1].steps ? F[F.length - 1].steps.map((r) => r.d) : [],
    lastStep0: F[F.length - 1].steps ? F[F.length - 1].steps[0] : null,
    countsConst,
    counts: F[0].counts,
    sameFrame: sameFrame ? { o0: parseFloat(sameFrame.rows[0].o), o1: parseFloat(sameFrame.rows[1].o) } : null,
    ladderMidN: ladderMid.length,
  });
})()`);

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
  check("agent-browser connected to desktop Chrome", connected, `port ${CDP_PORT}`);
  shSoft(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(3200);
  /* dev-world compile race: the first open triggers recompiles — the DOM
   * may carry the new code while the CSS chunk link still points at the
   * pre-edit revision. A SECOND open re-fetches the CURRENT build after
   * the compile has settled (t611 tuition: the stale chunk wears the
   * old graph — reload before testifying). */
  await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n > 0 ? n : null;
  }, 60000, 500);
  shSoft(`agent-browser open ${BASE} >/dev/null 2>&1`);
  await sleep(2500);
  check("hover shim applied", applyShim());
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return typeof n === "number" && n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);

  /* ---------- G0: served-world contracts ---------- */
  console.log("\n[G0] contracts");
  const served = await readJson(`(() => {
    const out = { kf: [], sel: [], js: 0 };
    for (const sheet of document.styleSheets) {
      let rules = null;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      const walk = (list) => {
        for (const r of list) {
          const t = r.cssText || "";
          if (t.indexOf("@keyframes") !== -1) out.kf.push(t.slice(0, 60));
          if (t.indexOf("[data-analytics-arrival]") !== -1 || t.indexOf("[data-flow-row]") !== -1 || t.indexOf("[data-flow-bar]") !== -1 || t.indexOf("[data-ladder-step]") !== -1) out.sel.push(t.slice(0, 400));
          if (r.cssRules && r.cssRules.length) walk(r.cssRules);
        }
      };
      walk(rules);
    }
    out.js = document.documentElement.outerHTML.includes("data-analytics-arrival") ? 1 : 0;
    return JSON.stringify(out);
  })()`);
  const kfNames = (served?.kf || []).map((k) => /@keyframes\s+([\w-]+)/.exec(k)?.[1]).filter(Boolean);
  check("served css: flow-pour keyframe defined", kfNames.includes("flow-pour"), kfNames.filter((k) => /pour|receipt|rise/.test(k)).join(","));
  check("served css: receipt-arrival keyframe present (the family word)", kfNames.includes("receipt-arrival"));
  const selText = (served?.sel || []).join(" || ");
  check("served css: flow-row/ladder-step ride receipt-arrival", (selText.match(/receipt-arrival/g) || []).length >= 1 && selText.includes("data-flow-row") && selText.includes("data-ladder-step"));
  check("served css: flow-bar pours", selText.includes("data-flow-bar") && selText.includes("flow-pour"));
  check("served css: reduce gate covers the grammar", (served?.sel || []).some((s) => s.includes("prefers-reduced-motion") && s.includes("data-flow-bar")));
  /* the section hook rides the CLIENT bundle (the canvas has no analytics
   * DOM — the attribute must be hunted in the compiled chunks, t609's way) */
  const servedJs = sh(`rg -l "data-analytics-arrival" .next/static/chunks .next/dev/static/chunks 2>/dev/null | rg -v "\\.map" | wc -l`);
  check("served js: the section hook reached the client bundle", parseInt(servedJs || "0", 10) >= 1, `chunks=${servedJs}`);

  /* ---------- W1: THE POUR ---------- */
  console.log("\n[W1] the pour");
  check("sampler installed before the finger", (await installSampler()) === true);
  const d1 = await shiftD();
  const secUp = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("section[aria-label='Pipeline analytics']"))`);
    return v === true ? v : null;
  }, 60000, 300);
  check("dashboard opened (Shift+D → analytics section)", d1 === true && secUp === true);
  /* the ladder lands on a two-hop async (mount → 3 fetches → state):
   * poll patiently — heavy tabs' mounts arrive late (t608's lesson) */
  const ladderUp = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-ladder-step]").length)`);
    return typeof n === "number" && n >= 1 ? n : null;
  }, 45000, 400);
  check("ladder steps landed (async host)", (ladderUp || 0) >= 1, `steps=${ladderUp}`);
  const rowN = await readJson(`JSON.stringify(document.querySelectorAll("[data-flow-row]").length)`);
  check("flow rows hosted (4 canonical stages)", rowN === 4, `rows=${rowN}`);
  await sleep(1600); /* let the flight finish: 974ms tail + margin */
  const framesN = await stopSampler();
  check("sampler recorded the flight", (framesN || 0) > 100, `${framesN} frames`);
  const A = await analyze(rowN);
  check("history analyzed", A?.ok === true, JSON.stringify(A?.ok === true ? { n: A.n } : A));
  check("first sight holds the delay's from-state (o=0)", A?.firstRow0?.o === "0" && A?.firstRow0?.an === "receipt-arrival",
    `o=${A?.firstRow0?.o} an=${A?.firstRow0?.an}`);
  check("first sight: bar holds pour's from-state (scaleX 0)", A?.firstBar0?.an === "flow-pour" && /^matrix\(0, /.test(A?.firstBar0?.tr || ""),
    `an=${A?.firstBar0?.an} tr=${A?.firstBar0?.tr}`);
  check("row 0 caught mid-surfacing (interior frames)", (A?.interiorN || 0) >= 3, `${A?.interiorN} interior frames`);
  /* t612 tuition回流: the 10ms grid samples one paint frame twice
   * (heartbeat ~16.7ms) and cold-world compile storms throttle the tape
   * into the flight's tail — the line's DIRECTION is the contract
   * (non-increasing, >=2 distinct, falling); the from-state check above
   * already pins the start at ty=4 */
  check("the surfacing descends the line (ty non-increasing, >=2 distinct, falling)",
    Array.isArray(A?.interiorTy) && A.interiorTy.length >= 2 &&
    A.interiorTy.every((v, i) => i === 0 || v <= A.interiorTy[i - 1] + 0.001) &&
    new Set(A.interiorTy.map((v) => Math.round(v * 1000))).size >= 2 &&
    A.interiorTy[A.interiorTy.length - 1] < A.interiorTy[0],
    JSON.stringify(A?.interiorTy));
  check("the bar caught mid-POUR (scaleX strictly between)", (A?.pourMidN || 0) >= 2, `${A?.pourMidN} frames, a=${JSON.stringify(A?.pourMidA)}`);
  check("reading-order delays (0.35s + i×0.024s)", JSON.stringify(A?.rowDelays) === JSON.stringify(["0.35s", "0.374s", "0.398s", "0.422s"]),
    JSON.stringify(A?.rowDelays));
  check("bar delays ride their rows", JSON.stringify(A?.barDelays) === JSON.stringify(["0.35s", "0.374s", "0.398s", "0.422s"]),
    JSON.stringify(A?.barDelays));
  check("ladder steps: receipt word, reading order", A?.lastStep0?.an === "receipt-arrival" && JSON.stringify(A?.stepDelays) === JSON.stringify(["0.35s", "0.374s"]),
    `an=${A?.lastStep0?.an} d=${JSON.stringify(A?.stepDelays)}`);
  check("settled face KEEPS its word (fill-both base value, 8th confluence)",
    A?.lastRow0?.an === "receipt-arrival" && A?.lastBar0?.an === "flow-pour",
    `row=${A?.lastRow0?.an} bar=${A?.lastBar0?.an}`);
  check("digits interrogated constant across every frame (no count-up)", A?.countsConst === true,
    JSON.stringify(A?.counts));

  /* ---------- W2: THE ONE-POUR LAW ---------- */
  console.log("\n[W2] the one-pour law");
  /* stash the row nodes IN-PAGE (node identity cannot cross an eval
   * boundary — the comparison itself must live where the nodes are) */
  const before = await readJson(`(() => {
    const rows = [...document.querySelectorAll("[data-flow-row]")];
    window.__t611nodes = rows;
    return JSON.stringify(rows.map((r) => r.getAnimations().map((a) => a.startTime)));
  })()`);
  check("pre-witness: rows + startTimes stashed", Array.isArray(before) && before.length === 4 && before.every((b) => b.length === 1),
    JSON.stringify(before));
  /* find the "Completed" status chip (a REAL control) and click it with
   * the CDP finger — the dashboard re-renders (sorted is a fresh array
   * every render) but the analytics keys survive */
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
  await sleep(1200);
  const after = await readJson(`(() => {
    const rows = [...document.querySelectorAll("[data-flow-row]")];
    return JSON.stringify({
      sameCount: rows.filter((r, i) => r === window.__t611nodes[i]).length,
      st: rows.map((r) => r.getAnimations().map((a) => a.startTime)),
    });
  })()`);
  check("post-rerender: rows are the SAME nodes", after?.sameCount === 4, `same=${after?.sameCount}/4`);
  check("the pour did NOT replay (startTimes unmoved)", JSON.stringify(after?.st) === JSON.stringify(before),
    `before=${JSON.stringify(before)} after=${JSON.stringify(after?.st)}`);
  /* restore the filter so the world reads as found */
  const allBox = await readJson(`(() => {
    const chips = [...document.querySelectorAll("button")].filter((b) => /^All\\b/.test(b.textContent.trim()));
    const chip = chips.find((b) => b.getBoundingClientRect().width > 0);
    if (!chip) return "null";
    const r = chip.getBoundingClientRect();
    return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, label: chip.textContent.trim().slice(0, 16) });
  })()`);
  if (allBox && typeof allBox === "object") { cdpClick(allBox.x, allBox.y, 0); await sleep(600); }
  check("filter restored to All", !!allBox && typeof allBox === "object", allBox?.label);

  /* ---------- W3: THE ROUND-TRIP ---------- */
  console.log("\n[W3] the round-trip");
  await shiftD(); /* to canvas */
  await sleep(1000);
  const gone = await readJson(`JSON.stringify(!document.querySelector("section[aria-label='Pipeline analytics']"))`);
  check("dashboard closed (analytics unmounted)", gone === true);
  /* re-arm ONLY now — the sampler must not carry the PREVIOUS mount's
   * settled frames (t609's tuition: empty the tape before measuring the
   * new world; the first 4-row frame after this point is the REMOUNT) */
  check("sampler re-armed on the empty world", (await installSampler()) === true);
  const d2 = await shiftD(); /* back — a REMOUNT, the grammar replays */
  const sec2 = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector("section[aria-label='Pipeline analytics'] [data-flow-row]"))`);
    return v === true ? v : null;
  }, 60000, 300);
  check("dashboard re-entered (rows mounted again)", d2 === true && sec2 === true);
  await sleep(1800);
  await stopSampler();
  const B = await analyze(rowN);
  check("the grammar REPLAYED on remount (first sight o=0 again)", B?.firstRow0?.o === "0" && B?.firstRow0?.an === "receipt-arrival",
    `o=${B?.firstRow0?.o} an=${B?.firstRow0?.an}`);
  check("the bar RE-POURED (mid-flight caught in the warm world)", (B?.pourMidN || 0) >= 1, `${B?.pourMidN} frames`);
  check("THE READING ORDER WITNESSED (one frame: row 0 flying, row 1 waiting)", !!B?.sameFrame,
    JSON.stringify(B?.sameFrame));
  check("round-trip settled with the same words", B?.lastRow0?.an === "receipt-arrival" && B?.lastBar0?.an === "flow-pour",
    `row=${B?.lastRow0?.an} bar=${B?.lastBar0?.an}`);

  /* 📸 the settled grammar */
  await sleep(400);
  const shot1 = snap("t611-funnel-pour-settled.png");
  check("📸 the funnel's settled face", shot1);

  /* ---------- R: the world returned ---------- */
  console.log("\n[R] the world returned");
  await shiftD(); /* back to canvas */
  await sleep(900);
  const backCanvas = await readJson(`JSON.stringify(!!document.querySelector("[data-job]") && !document.querySelector("section[aria-label='Pipeline analytics']"))`);
  check("canvas restored (12 cards, no analytics)", backCanvas === true);
  await sleep(1200);
  const errs = await readJson(`JSON.stringify((window.__qaErrors || []).length)`);
  check("console clean (no window errors captured)", errs === 0 || errs === null, `errs=${errs}`);
  const agentErrors = await readJson(`JSON.stringify(window.__agentConsole ? window.__agentConsole.filter(m => m.level === "error").length : 0)`);
  check("console clean (agent channel)", agentErrors === 0 || agentErrors === null, `errs=${agentErrors}`);
  const roster = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/projects | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d['projects']; print(len(ps), sum(1 for p in ps if p.get('active')))"`).trim();
  check("roster 6 with exactly 1 active", roster === "6 1", `got ${roster}`);
  const jobsN = sh(`curl -s -H "Origin: ${BASE}" ${BASE}/api/jobs?projectId=cmuro2ufe000mn5nb3qkwuy49 | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['jobs'] if isinstance(d, dict) else d))"`).trim();
  check("12 jobs, zero mints", jobsN === "12", `got ${jobsN}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
