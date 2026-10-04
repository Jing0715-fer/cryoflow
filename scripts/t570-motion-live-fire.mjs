/**
 * t570 — the door family learns to move, live end-to-end: motion as
 * wayfinding, asserted in COMPUTED STYLE, not in the class list alone.
 *
 * t567 made the footers walkable; t568 taught the receipt where its feed
 * lives; t569 gave the landing a way back. Those doors were still — hover
 * tint and an instant dotted underline, affordance by paint alone. This
 * window gives the family a motion dialect with one thesis: ARROWS POINT
 * WHERE YOU'D GO.
 *   - doors: the dotted underline no longer pops — the line is always
 *     laid, its ink fades transparent → current (a color fade, reduced-
 *     motion safe by nature), and ArrowUpRight leans up-right + brightens
 *     on hover.
 *   - chip: walks in from the left (the direction its own ArrowLeft
 *     points) via the .inspector-chip-enter keyframe, the arrow leans
 *     further back on hover, and a press settles the pill 3% down.
 * Every transform rides motion-safe; every fade rides unguarded (fades
 * are color, not movement — the house's reading since t4xx).
 *
 * THE ENVIRONMENT SHIM (why this harness spawns its own Chrome): stock
 * headless Chrome reports (hover: none)/(pointer: none) — a PHONE, not a
 * desktop — and Tailwind 4 wraps every group-hover: utility in
 * @media (hover: hover), so computed-style hover assertions are
 * unprovable out of the box. This harness launches its own Chrome with
 * the desktop capability bits (--blink-settings primaryHoverType/
 * primaryPointerType) and points agent-browser at it via `connect`.
 * The launch flags are the ENTIRE trick — a earlier shim also called
 * Emulation.setEmulatedMedia/setTouchEmulationEnabled and those calls
 * THEMSELVES flipped hover back to none (emulation state replaces the
 * real capability bits the moment it exists), so the post-open check is
 * strictly READ-ONLY. Everything lives inside this one Node process —
 * the sandbox reaps background processes between shell calls, so the
 * Chrome child must never outlive its parent.
 *
 * Faces proven here (computed style is the witness):
 *   M1  verdict door — before hover: arrow opacity .6 / translate none /
 *       decoration transparent; after hover: opacity 1 / translate
 *       1px -1px / decoration inked. Fade-in + wayfinding nudge, verified
 *       pixel-real.
 *   M2  receipt door — same dialect, emerald family, same assertions.
 *   M3  chip — animationName inspector-chip-enter @ 220ms easeOutQuint
 *       wired; hover leans ArrowLeft -1px; the door click that lands here
 *       still navigates (motion added nothing, broke nothing).
 *   M4a door transforms ride motion-safe (class-level wiring, read while
 *       the doors are still mounted);
 *   M4b chip transforms ride motion-safe (read after the landing).
 *   R   ping-pong: chip click still walks back to the probe (t569's
 *       contract survives the motion).
 *
 * Runs in the EMPIAR world in place (no switch), deletes the mint on the
 * way out (roster must return to its starting count).
 *
 * Usage: node scripts/t570-motion-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9321";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t570-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 30000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const api = (verb, path, body) =>
  sh(
    `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
    (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
  );
const jobsOfActive = () => {
  const d = JSON.parse(api("GET", "/api/jobs"));
  return Array.isArray(d) ? d : (d.jobs ?? []);
};
const evalJs = (expr) => {
  try {
    const flat = expr.replace(/\s*\n\s*/g, " ");
    const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed.trim() : raw.trim();
    } catch {
      return raw.replace(/^"|"$/g, "").trim();
    }
  } catch { return ""; }
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
/** after every agent-browser open — READ-ONLY verify that the pages still
    report a desktop (the launch flags do the work; emulation calls would
    UNDO them, so this never writes). Throws if any page lies. */
const applyShim = () => {
  try { return sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};

/* ---- world guard BEFORE any browser spend: the EMPIAR world must be
   active and the parent must be stamped (pure API reads) --------------- */
const projects = JSON.parse(api("GET", "/api/projects")).projects;
const active = projects.find((p) => p.active || p.isActive);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"} (${active?.name ?? "?"}), expected EMPIAR ${EMPIAR_ID} — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);

const class2d = jobsOfActive().find((j) => j.type === "class2d" && j.status === "completed");
if (!class2d) { console.error("FATAL: no completed class2d — no door destination."); process.exit(2); }
const stampRes = JSON.parse(api("GET", `/api/jobs/${class2d.id}/ai-verdict`));
if (!stampRes.available) {
  console.error(`FATAL: ${class2d.name} carries no AI verdict stamp — run t565b once to write one`);
  process.exit(2);
}
check("parent class2d exists and is stamped", true, class2d.name);

const gamble = [
  ...stampRes.stamp.classes.filter((c) => c.verdict === "keep").map((c) => c.cls),
  ...stampRes.stamp.classes.filter((c) => c.verdict === "maybe").map((c) => c.cls),
].sort((a, b) => a - b);
if (gamble.length === 0) { console.error("FATAL: the stamp has no keep/maybe classes"); process.exit(2); }

const VIA = "[data-canvas-ui='verdict-via-link']";
const FROM = "[data-canvas-ui='receipt-from-link']";
const CHIP = "[data-canvas-ui='inspector-return-link']";
const ARROW_PROPS = ["opacity", "translate", "transform", "transitionProperty", "transitionDuration"];

const chromeReady = await launchDesktopChrome();
if (!chromeReady) {
  console.error("FATAL: the desktop-capable Chrome never opened its CDP port — environment shim failed");
  process.exit(2);
}
check("desktop-capable Chrome up (hover:hover capability bits)", true, `port ${CDP_PORT}`);
/* clear any stale connection the daemon holds (a dead port from a past
   window makes `connect` silently fall back to its default browser) */
try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* nothing held */ }
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
const openApp = async () => {
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
  await sleep(500);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3200);
  applyShim();
};
/* where did the tabs actually go? our Chrome's target list is the truth */
const tabsOfOurChrome = () => {
  try {
    const list = JSON.parse(sh(`curl -s http://127.0.0.1:${CDP_PORT}/json/list`));
    return list.filter((t) => t.type === "page").map((t) => (t.url || "").slice(0, 40));
  } catch { return ["<chrome gone>"]; }
};
const openJob = async (name) => {
  await openApp();
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "${name}" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(1800);
};
const hover = (sel) => {
  try { sh(`agent-browser hover "${sel}" >/dev/null 2>&1`); } catch { /* poll decides */ }
};
const styleJs = (sel, props) => `JSON.stringify((function(){
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { ${props.map((p) => `${JSON.stringify(p)}: cs[${JSON.stringify(p)}]`).join(", ")} };
})())`;
const readStyle = async (sel, props) => {
  const raw = evalJs(styleJs(sel, props));
  try { return JSON.parse(raw ?? "null"); } catch { return null; }
};

const minted = [];
let browserLive = false;
try {
  await openApp();
  console.log(`  our Chrome tabs: ${JSON.stringify(tabsOfOurChrome())}`);
  const media = evalJs(`JSON.stringify({h: matchMedia('(hover: hover)').matches, p: matchMedia('(pointer: fine)').matches})`);
  let m = null; try { m = JSON.parse(media || "null"); } catch { /* stays null */ }
  check("shimmed environment reports a desktop (hover:hover, pointer:fine)", m?.h === true && m?.p === true, media);
  if (m?.h !== true) throw new Error("environment shim failed — hover assertions would be meaningless");
  browserLive = true;

  /* ============ mint + run the motion probe ========================== */
  console.log(`\n[mint] birth select ${JSON.stringify(gamble)} → run`);
  const mintA = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t570 Motion Probe",
    x: 60, y: 60,
    classStarSelection: { jobId: class2d.id, classes: gamble },
  }));
  const probeA = mintA.job ?? mintA;
  minted.push(probeA.id);
  check("minted birth select2d", !!probeA?.id, probeA?.id);

  api("POST", `/api/jobs/${probeA.id}/run`, { local: true });
  const doneA = await pollUntil(() => {
    const lj = jobsOfActive().find((x) => x.id === probeA.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 30000);
  check("ran to completed", !!doneA, doneA?.result ?? "");

  await openJob("t570 Motion Probe");
  const pairJs = `JSON.stringify((function(){
    const row = document.querySelector("[data-canvas-ui='selection-evidence-row']");
    if (!row) return { row: false };
    return {
      row: true,
      stamp: !!row.querySelector("[data-canvas-ui='ai-verdict-stamp']"),
      viaDoor: !!row.querySelector("[data-canvas-ui='verdict-via-link']"),
      receipt: !!document.querySelector("[data-canvas-ui='selection-receipt']"),
      fromDoor: !!document.querySelector("[data-canvas-ui='receipt-from-link']")
    };
  })())`;
  const pairRaw = await pollUntil(() => {
    const raw = evalJs(pairJs);
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.row && j.stamp && j.viaDoor && j.receipt && j.fromDoor ? raw : null; } catch { return null; }
  }, 25000);
  let pair = null;
  try { pair = JSON.parse(pairRaw ?? "null"); } catch { /* stays null */ }
  check("paired row + both doors mounted on the probe's tab", !!pair?.row, pair?.row ? "stamp door + receipt door in place" : "no row");

  /* ============ FACE M1 — verdict door wayfinding ==================== */
  console.log("\n[Face M1] verdict door — the underline fades in, the arrow leans out");
  const arrowBefore = await readStyle(`${VIA} svg`, ARROW_PROPS);
  const before = await readStyle(VIA, ["textDecorationLine", "textDecorationColor"]);
  check("before hover — arrow at rest (opacity .6, no translate)",
    arrowBefore && Number(arrowBefore.opacity) === 0.6 && arrowBefore.translate === "none" && arrowBefore.transform === "none",
    arrowBefore ? `opacity=${arrowBefore.opacity} translate=${arrowBefore.translate}` : "no element");
  check("before hover — underline laid but ink transparent",
    before && before.textDecorationLine === "underline" && /^rgba\(0, 0, 0, 0\)$/.test(before.textDecorationColor),
    before ? `line=${before.textDecorationLine} ink=${before.textDecorationColor}` : "no element");
  hover(VIA);
  await sleep(450); /* let the 200ms transition settle */
  const after = await readStyle(`${VIA} svg`, ARROW_PROPS);
  const inkAfter = await readStyle(VIA, ["textDecorationColor"]);
  check("after hover — arrow brightens to full ink", after && Number(after.opacity) === 1,
    after ? `opacity=${after.opacity}` : "no element");
  check("after hover — arrow leans up-right (1px, -1px)",
    after && (after.translate === "1px -1px" || after.transform === "matrix(1, 0, 0, 1, 1, -1)"),
    after ? `translate=${after.translate} transform=${after.transform}` : "no element");
  check("after hover — underline inked (fade-in witnessed)",
    inkAfter && !/^rgba\(0, 0, 0, 0\)$/.test(inkAfter.textDecorationColor ?? ""),
    inkAfter ? `ink=${inkAfter.textDecorationColor}` : "no element");
  check("arrow transition covers opacity+transform @ 200ms",
    after && /opacity/.test(after.transitionProperty ?? "") && /transform/.test(after.transitionProperty ?? "") && after.transitionDuration === "0.2s",
    after ? `${after.transitionProperty} / ${after.transitionDuration}` : "no element");

  /* ============ FACE M2 — receipt door, same dialect ================= */
  console.log("\n[Face M2] receipt door — emerald twin, same gesture");
  const fromBefore = await readStyle(FROM, ["textDecorationColor"]);
  check("before hover — receipt door ink transparent",
    fromBefore && /^rgba\(0, 0, 0, 0\)$/.test(fromBefore.textDecorationColor ?? ""),
    fromBefore ? `ink=${fromBefore.textDecorationColor}` : "no element");
  hover(FROM);
  await sleep(450);
  const fromAfter = await readStyle(`${FROM} svg`, ARROW_PROPS);
  check("after hover — receipt arrow leans up-right (1px, -1px) and brightens",
    fromAfter && Number(fromAfter.opacity) === 1 && (fromAfter.translate === "1px -1px" || fromAfter.transform === "matrix(1, 0, 0, 1, 1, -1)"),
    fromAfter ? `translate=${fromAfter.translate} opacity=${fromAfter.opacity}` : "no element");

  /* ============ FACE M4a — door transforms ride motion-safe ========== */
  console.log("\n[Face M4a] door transforms ride motion-safe (class-level wiring)");
  const doorClassJs = `JSON.stringify((function(){
    const viaArrow = document.querySelector("[data-canvas-ui='verdict-via-link'] svg");
    const fromArrow = document.querySelector("[data-canvas-ui='receipt-from-link'] svg");
    const get = (el) => (el ? (el.className.baseVal || el.getAttribute("class") || "") : "");
    return {
      viaArrowLean: get(viaArrow).includes("motion-safe:group-hover:translate-x-px") && get(viaArrow).includes("motion-safe:group-hover:-translate-y-px"),
      fromArrowLean: get(fromArrow).includes("motion-safe:group-hover:translate-x-px")
    };
  })())`;
  const m4a = await (async () => { try { return JSON.parse(evalJs(doorClassJs) ?? "null"); } catch { return null; } })();
  check("verdict door arrow lean rides motion-safe", !!m4a?.viaArrowLean);
  check("receipt door arrow lean rides motion-safe", !!m4a?.fromArrowLean);

  /* ============ FACE M3 — door click lands; the chip walks in ======== */
  console.log("\n[Face M3] door click → parent → chip entrance wired");
  hover("body"); /* park the pointer away so no hover state leaks into the click */
  await sleep(200);
  try { sh(`agent-browser click "${VIA}" >/dev/null 2>&1`); } catch { /* poll decides */ }
  const landJs = `JSON.stringify((function(){
    const c = document.querySelector("[data-canvas-ui='inspector-return-link']");
    return {
      stamp: !!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"),
      row: !!document.querySelector("[data-canvas-ui='selection-evidence-row']"),
      chip: c ? (c.innerText || "").trim() : ""
    };
  })())`;
  const land1 = await pollUntil(() => {
    try { const j = JSON.parse(evalJs(landJs) ?? "null"); return j && j.stamp && !j.row && j.chip ? j : null; } catch { return null; }
  }, 15000);
  check("landed on the parent's own tab (motion added nothing, broke nothing)",
    !!land1, land1 ? `chip="${land1.chip}"` : "no landing");

  const chipStyle = await readStyle(CHIP, ["animationName", "animationDuration", "animationTimingFunction"]);
  check("chip entrance keyframe wired (inspector-chip-enter @ 220ms)",
    chipStyle && chipStyle.animationName === "inspector-chip-enter" && chipStyle.animationDuration === "0.22s",
    chipStyle ? `${chipStyle.animationName} / ${chipStyle.animationDuration} / ${chipStyle.animationTimingFunction}` : "no chip");
  check("chip timing is the easeOutQuint settle",
    chipStyle && /cubic-bezier\(0.22, 1, 0.36, 1\)/.test(chipStyle.animationTimingFunction ?? ""),
    chipStyle?.animationTimingFunction ?? "");

  hover(CHIP);
  await sleep(450);
  const chipArrow = await readStyle(`${CHIP} svg`, ["translate", "transform"]);
  check("after hover — chip arrow leans BACK (left): arrows point where you'd go",
    chipArrow && (chipArrow.translate === "-1px" || chipArrow.translate === "-1px 0px" || chipArrow.transform === "matrix(1, 0, 0, 1, -1, 0)"),
    chipArrow ? `translate=${chipArrow.translate}` : "no chip");

  /* ============ FACE M4b — chip wiring (class level) ================= */
  console.log("\n[Face M4b] chip transforms ride motion-safe (class-level wiring)");
  const classJs = `JSON.stringify((function(){
    const chip = document.querySelector("[data-canvas-ui='inspector-return-link']");
    if (!chip) return null;
    const chipArrow = chip.querySelector("svg");
    return {
      chipPress: chip.classList.contains("motion-safe:active:scale-[0.97]"),
      chipArrowLean: !!chipArrow && (chipArrow.className.baseVal || chipArrow.getAttribute("class")).includes("motion-safe:group-hover:-translate-x-px"),
      chipEnter: chip.classList.contains("inspector-chip-enter")
    };
  })())`;
  const m4 = await (async () => { try { return JSON.parse(evalJs(classJs) ?? "null"); } catch { return null; } })();
  check("chip press rides motion-safe", !!m4?.chipPress);
  check("chip arrow lean rides motion-safe", !!m4?.chipArrowLean);
  check("chip entrance class mounted", !!m4?.chipEnter);

  /* ============ FACE R — ping-pong survives the motion =============== */
  console.log("\n[Face R] chip click still walks back (t569's contract)");
  try { sh(`agent-browser click "${CHIP}" >/dev/null 2>&1`); } catch { /* poll decides */ }
  const back = await pollUntil(() => {
    const raw = evalJs(pairJs);
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.row && j.stamp && j.viaDoor ? raw : null; } catch { return null; }
  }, 25000);
  let backJ = null;
  try { backJ = JSON.parse(back ?? "null"); } catch { /* stays null */ }
  check("back on the probe's paired row", !!backJ?.row, "row + stamp + door all home");
  try {
    sh(`agent-browser screenshot "[data-canvas-ui='selection-evidence-row']" .qa-logs/shots/t570-motion-row.png >/dev/null 2>&1`);
    console.log("  📸 .qa-logs/shots/t570-motion-row.png");
  } catch { /* best effort */ }

  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
} finally {
  try { if (browserLive) sh(`agent-browser close >/dev/null 2>&1`); } catch { /* gone */ }
  for (const id of minted) {
    try { api("DELETE", `/api/jobs/${id}?confirm=true`); } catch { /* best effort */ }
  }
  await sleep(800);
  try {
    const roster1 = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster restored", roster1.stats.total === roster0, `${roster0} → ${roster1.stats.total}`);
  } catch { /* api layer never depended on the browser */ }
  if (chromeProc) {
    try { chromeProc.kill("SIGKILL"); } catch { /* already gone */ }
    try { sh(`rm -rf ${PROFILE} 2>/dev/null`); } catch { /* best effort */ }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
