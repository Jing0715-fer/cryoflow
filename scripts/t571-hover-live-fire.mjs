/**
 * t571 — the canvas answers hover: the wire glow + the card lean, live.
 *
 * t567–t570 taught the DOORS to move (footer doors, return chip, motion
 * dialect). This window brings the same grammar to the CANVAS itself:
 *   - the lean (style): a canvas card is cursor-grab — on hover it rises
 *     2px on the CSS `translate` property (never `transform`: the drag
 *     loop patches transform on the host one level up; translate composes
 *     independently and can never fight the drag) while its shadow
 *     deepens. Timing = the door family's easeOutQuint.
 *   - the wire glow (function): hovering a card lights the wires that
 *     touch it ("what feeds this job?"). The grammar is deliberately NOT
 *     selection's: hover lights the touched wires (2.9 width, active ink)
 *     and leaves the world alone; selection additionally dims every
 *     unrelated wire. HOVER ASKS, SELECTION ANSWERS.
 *
 * Faces proven here:
 *   L1  the lean — computed `translate` on the card body goes none →
 *       "0px -2px" under hover, box-shadow changes with it, and the
 *       transition-timing-function is the family's cubic-bezier
 *       (0.22, 1, 0.36, 1) (the lean rides the .card-hover-lean class,
 *       suppressed while dragging — a carried card should not also
 *       float; the !dragging conditional is code-level, noted honestly
 *       in the header: drag simulation is a gesture harness of its own).
 *   W1  the glow — every wire touching the hovered card: stroke-width
 *       attr 2.9 (the React hover branch chose it), computed stroke
 *       differs from a resting wire's; an unrelated wire stays 2.25 and
 *       its group opacity stays 1 (hover does NOT dim the world).
 *   W2  unhover — the wires release: back to 2.25.
 *   W3  hover asks under selection — an idle probe card is selected
 *       (everything dims); hovering the class2d now lights its wires to
 *       2.9 THROUGH the dim (group opacity still var(--dim-wire)):
 *       the question is still answerable inside a dimmed world.
 *   R   zero console errors, roster returns 12 → 12.
 *
 * The environment shim is t570's, unchanged in spirit: stock headless
 * Chrome reports (hover: none) — and the lean's :hover rule lives behind
 * @media (hover: hover) by design (touch taps must not leave cards stuck
 * in the air) — so this harness spawns its own Chrome with desktop
 * capability bits and points agent-browser at it via `connect`. The
 * launch flags are the ENTIRE trick; the post-open check is READ-ONLY.
 * Everything lives inside this one Node process (the sandbox reaps
 * background processes between shell calls).
 *
 * Runs in the EMPIAR world in place (no switch), deletes the mint on the
 * way out (roster must return to its starting count).
 *
 * Usage: node scripts/t571-hover-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9322";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t571-harness-chrome-profile";
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
const applyShim = () => {
  try { return sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};

/* ---- world guard BEFORE any browser spend ----------------------------- */
const projects = JSON.parse(api("GET", "/api/projects")).projects;
const active = projects.find((p) => p.active || p.isActive);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"}, expected EMPIAR — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);

const edges = JSON.parse(api("GET", "/api/edges"));
const edgeList = Array.isArray(edges) ? edges : (edges.edges ?? []);
const class2d = jobsOfActive().find((j) => j.type === "class2d" && j.status === "completed");
if (!class2d) { console.error("FATAL: no completed class2d in the active world."); process.exit(2); }
const touching = edgeList.filter((e) => e.fromJobId === class2d.id || e.toJobId === class2d.id);
const untouched = edgeList.filter((e) => e.fromJobId !== class2d.id && e.toJobId !== class2d.id);
if (touching.length === 0) { console.error(`FATAL: ${class2d.name} has no wires — nothing to light.`); process.exit(2); }
if (untouched.length === 0) { console.error("FATAL: every wire touches the class2d — no control wire."); process.exit(2); }
check("hover target picked", true, `${class2d.name} · ${touching.length} wires touch it, ${untouched.length} control wire(s)`);

const K5SEL = `[data-job="${class2d.id}"]`;
const BODYSEL = `${K5SEL} div[role="button"]`;

/* ---- browser scaffolding ---------------------------------------------- */
const hover = (sel) => {
  try { sh(`agent-browser hover "${sel}" >/dev/null 2>&1`); } catch { /* poll decides */ }
};
const readStyle = async (sel, props) => {
  const js = `JSON.stringify((function(){ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const cs=getComputedStyle(el); return { ${props.map((p) => `${JSON.stringify(p)}: cs[${JSON.stringify(p)}]`).join(", ")} }; })())`;
  const raw = evalJs(js);
  try { return JSON.parse(raw ?? "null"); } catch { return null; }
};
/** the wire's MAIN path inside its group: data-e="d" paths carry the hit
    corridor (transparent, w16), the optional glow (w8/9) and the wire
    itself (w≤3.2) — pick the sub-5 one. */
const wireJs = (edgeId) => `JSON.stringify((function(){
  const g=document.querySelector('g[data-edge-id="${edgeId}"]');
  if(!g) return null;
  let main=null;
  for(const p of g.querySelectorAll('path[data-e="d"]')){
    const w=parseFloat(p.getAttribute('stroke-width')||'0');
    if(w>0 && w<5) main=p;
  }
  if(!main) return null;
  return { w: main.getAttribute('stroke-width'), stroke: getComputedStyle(main).stroke, gop: g.style.opacity };
})())`;
const readWire = async (edgeId) => {
  const raw = evalJs(wireJs(edgeId));
  try { return JSON.parse(raw ?? "null"); } catch { return null; }
};
const centerCard = async (jobId, jobName) => {
  // palette → openJob (completed → inspector opens) → Focus → Escape.
  // The palette path needs no on-screen card: before the first Focus the
  // card may sit anywhere, even off-viewport — a card click would be a
  // coin flip, the palette never misses.
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "${jobName}" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(2200);
  const clicked = evalJs(`JSON.stringify((function(){
    const dlg=document.querySelector('[data-inspector-dialog]');
    if(!dlg) return {open:false};
    const btn=[...dlg.querySelectorAll('button')].find((b)=>b.textContent.trim()==='Focus');
    if(!btn) return {open:true,focus:false};
    btn.click();
    return {open:true,focus:true};
  })())`);
  await sleep(1100);
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(900);
  // park the pointer away: it is still ON the card from the click — the
  // lean's :hover and the hover channel would both still be live, and
  // the "pre-hover" reads below would start mid-hover (false failure).
  hover("header");
  await sleep(420);
  // evalJs unwraps only the CLI's outer encoding — the eval body itself
  // returned JSON.stringify(...), so what comes back is a STRING holding
  // JSON. Parse it here (the t567 double-encoding lesson, again).
  try { return JSON.parse(clicked); } catch { return { open: false, focus: false }; }
};

const minted = [];
let browserLive = false;
try {
  const chromeReady = await launchDesktopChrome();
  if (!chromeReady) {
    console.error("FATAL: the desktop-capable Chrome never opened its CDP port — environment shim failed");
    process.exit(2);
  }
  check("desktop-capable Chrome up (hover:hover capability bits)", true, `port ${CDP_PORT}`);
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
  await openApp();
  const media = evalJs(`JSON.stringify({h: matchMedia('(hover: hover)').matches, p: matchMedia('(pointer: fine)').matches})`);
  let m = null; try { m = JSON.parse(media || "null"); } catch { /* stays null */ }
  check("shimmed environment reports a desktop (hover:hover, pointer:fine)", m?.h === true && m?.p === true, media);
  if (m?.h !== true) throw new Error("environment shim failed — hover assertions would be meaningless");
  browserLive = true;

  /* ---- hydration guard (t578 lesson): the fixed 3200ms open sleep was a
          prod-era assumption. On a dev-regime server (cold compile, host
          pressure, mid-window OOM restarts) hydration can land seconds to
          minutes after load — and every keystroke fired pre-hydration
          (Ctrl+K, typing, Enter) vanishes without a trace, reading as
          {"open":false} on the focus face while every post-sleep face
          passes. Poll for actual canvas cards before the first palette
          interaction, not just a loaded page. ------------------------- */
  const hydrated = await pollUntil(async () => {
    const raw = evalJs(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`);
    let v = null; try { v = JSON.parse(raw || "null"); } catch { /* stays null */ }
    return v?.cards > 0 ? v : null;
  }, 90000, 1000);
  check("canvas hydrated (cards in DOM)", hydrated?.cards > 0, `${hydrated?.cards} cards`);

  /* ============ center the hover target on the canvas ================== */
  console.log(`\n[center] ${class2d.name} → inspector Focus → Escape`);
  const centered = await centerCard(class2d.id, class2d.name);
  check("focus flow: inspector opened and Focus fired", centered?.open === true && centered?.focus === true, JSON.stringify(centered));
  const onScreen = evalJs(`JSON.stringify((function(){
    const el=document.querySelector(${JSON.stringify(K5SEL)});
    if(!el) return {found:false};
    const r=el.getBoundingClientRect();
    return {found:true, x:r.x, y:r.y, w:r.width, h:r.height, vis: r.x>-10 && r.y>-10 && r.x+r.width<1290 && r.y+r.height<730};
  })())`);
  let pos = null; try { pos = JSON.parse(onScreen || "null"); } catch { /* stays null */ }
  check("hover target on screen after focus", pos?.found === true && pos?.vis === true, JSON.stringify(pos));

  /* ============ L1 — the lean ========================================== */
  console.log(`\n[L1] the lean: hover ${class2d.name}`);
  const before = await readStyle(BODYSEL, ["translate", "boxShadow", "transitionProperty", "transitionTimingFunction"]);
  check("pre-hover: translate none", before?.translate === "none", before?.translate);
  hover(K5SEL);
  await sleep(420);
  const during = await readStyle(BODYSEL, ["translate", "boxShadow", "transitionTimingFunction"]);
  check("hover: card leans −2px on `translate`", during?.translate === "0px -2px", during?.translate);
  check("hover: shadow answers with the lean", before?.boxShadow !== during?.boxShadow, `${String(before?.boxShadow).slice(0, 40)} → ${String(during?.boxShadow).slice(0, 40)}`);
  check("lean timing is the family's easeOutQuint", (during?.transitionTimingFunction ?? "").includes("cubic-bezier(0.22, 1, 0.36, 1)"), during?.transitionTimingFunction);

  /* ============ W1 — the glow ========================================== */
  console.log(`\n[W1] the glow: wires touch-hovered vs control`);
  const litWires = [];
  for (const e of touching) {
    const w = await readWire(e.id);
    litWires.push({ id: e.id, ...w });
  }
  const allLit = litWires.every((w) => w && w.w === "2.9");
  check("every touching wire raised to 2.9", allLit, litWires.map((w) => `${w.id.slice(-6)}:${w.w}`).join(" "));
  const control = await readWire(untouched[0].id);
  check("control wire unchanged at 2.25", control && control.w === "2.25", control?.w);
  check("control ink is not the lit ink", control && litWires[0] && control.stroke !== litWires[0].stroke, `${String(control?.stroke).slice(0, 30)} vs ${String(litWires[0]?.stroke).slice(0, 30)}`);
  check("hover does NOT dim the world (control opacity 1)", control?.gop === "1", control?.gop);
  check("hovered wires undimmed too (nothing selected)", litWires.every((w) => w.gop === "1"), litWires[0]?.gop);

  /* ============ W2 — the release ======================================= */
  console.log(`\n[W2] unhover: the wires release`);
  hover("header");
  await sleep(420);
  const released = await readWire(touching[0].id);
  const leanGone = await readStyle(BODYSEL, ["translate"]);
  check("wire falls back to 2.25", released?.w === "2.25", released?.w);
  check("card settles back to translate none", leanGone?.translate === "none", leanGone?.translate);

  /* ============ W3 — hover asks under selection dim ==================== */
  console.log(`\n[W3] hover asks under selection dim`);
  const k5xy = { x: class2d.x, y: class2d.y };
  const mint = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t571 Hover Probe",
    x: k5xy.x + 300, y: k5xy.y + 40,
  }));
  const probe = mint.job ?? mint;
  minted.push(probe.id);
  check("idle probe minted beside the target", !!probe?.id, probe?.id);
  await sleep(600);
  // the palette reads the STORE's jobs, and the store learns about a new
  // mint on its own poll cadence (~2s) — a palette typed at +600ms (the
  // first live-fire's mistake) matches NOTHING and Enter is a silent
  // no-op. Wait until the canvas has actually rendered the probe (data-job
  // in the DOM = store knows it), THEN invoke the palette.
  let probeOnCanvas = false;
  for (let i = 0; i < 16 && !probeOnCanvas; i++) {
    probeOnCanvas = evalJs(`JSON.stringify(!!document.querySelector('[data-job="${probe.id}"]'))`) === "true";
    if (!probeOnCanvas) await sleep(500);
  }
  check("probe reached the store/canvas", probeOnCanvas, `polled ${probeOnCanvas}`);
  // SELECT VIA THE PALETTE, not a card click: a canvas click is a coin
  // flip even with the card in the DOM (off-viewport = the dispatch
  // lands on empty page — the first live-fire's silent no-op). The
  // probe is IDLE, so openJob takes the select+focus branch (no dialog
  // opens, nothing to Escape) — and select() is what sets selectedId,
  // the exact slice the wire dim reads. The first live-fire clicked
  // and "verified" selection via className.includes("ring-") — a false
  // positive: the card body's base class list always carries
  // focus-visible:ring-2. The dim histogram below is the honest witness.
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "${probe.name}" >/dev/null 2>&1`);
  await sleep(900);
  const paletteHit = evalJs(`JSON.stringify((function(){
    const r=document.querySelector('[cmdk-root]');
    if(!r) return {open:false, first:null};
    const it=r.querySelector('[cmdk-item]');
    return {open:true, first: it ? it.textContent.slice(0, 60) : null};
  })())`);
  let hit = null; try { hit = JSON.parse(paletteHit || "null"); } catch { /* stays null */ }
  check("palette names the probe before Enter", hit?.open === true && (hit?.first ?? "").includes(probe.name), paletteHit);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(2200);
  const dimState = evalJs(`JSON.stringify((function(){
    const gs=[].slice.call(document.querySelectorAll('g[data-edge-id]'));
    const dimmed=gs.filter(function(g){return g.style.opacity==='var(--dim-wire)'}).length;
    return {total: gs.length, dimmed: dimmed};
  })())`);
  let dim = null; try { dim = JSON.parse(dimState || "null"); } catch { /* stays null */ }
  check("probe selected — the world dims", dim?.total > 0 && dim?.dimmed === dim?.total, dimState);
  // hover the class2d under the dim
  hover(K5SEL);
  await sleep(420);
  const dimLit = await readWire(touching[0].id);
  check("hovered wire lights THROUGH the dim (2.9)", dimLit?.w === "2.9", dimLit?.w);
  check("the dim still answers (group opacity is the dim rung)", dimLit?.gop === "var(--dim-wire)", dimLit?.gop);
  const dimControl = await readWire(untouched[0].id);
  check("control stays 2.25 and dimmed", dimControl?.w === "2.25" && dimControl?.gop === "var(--dim-wire)", `${dimControl?.w} @ ${dimControl?.gop}`);

  /* ============ 📸 the question inside a dimmed world =================== */
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t571-hover-ask-dim.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 canvas hover-under-dim screenshot", true, ".qa-logs/shots/t571-hover-ask-dim.png");
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing ------------------------------- */
  try {
    for (const id of minted) {
      api("DELETE", `/api/jobs/${id}?confirm=true`);
    }
    if (minted.length) {
      await sleep(400);
      const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
      check("roster returned to its starting count", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
    } else {
      check("roster untouched (nothing minted)", true, String(roster0));
    }
  } catch (e) { check("cleanup ran", false, String(e.message)); }
  try {
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  } catch { /* eval unavailable */ }
  if (browserLive) {
    try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* already gone */ }
  }
  if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
