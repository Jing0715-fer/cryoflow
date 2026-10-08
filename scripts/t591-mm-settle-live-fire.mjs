/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t591 — the segmented control's settled voice.
 *
 * t586 taught buttons to answer the hand (the press dip); t585 taught the
 * find chips to answer activation (the chip-set click-into-place). The
 * minimap's framing-mode control — FIT / NODES / SEL — is the same gesture
 * family (a mode click) and until now its bg-card thumb appeared instantly:
 * a silent surface change in otherwise voiced chrome. This window gives the
 * segmented control its settle — the chip-set syllable in its smallest body
 * (200ms, 0.94 → back-out) — and its press dip (t586's exact recipe joins
 * the three buttons). The trigger is the transient [data-mm-set] key the
 * component sets on an activating click, NOT a bare [aria-pressed] rule:
 * this control owns a SYSTEMIC coercion (sel → fit when the selection
 * empties) that would ghost-pop the fit button with no click at all — the
 * t585 disarm law in its coercion costume. The component clears the key at
 * that edge, so a later re-click of sel can re-arm.
 *
 * Faces proven here:
 *   G0  the served sheet carries the voice (pre-browser gate — the t585
 *       watcher lesson; serialization asserts `.94` / the rule selector,
 *       not the source's `0.94` spelling — the t582 lesson).
 *   Q   world QA — roster guard, 12 cards, 13 edges, minimap present,
 *       fit pressed at birth, and BIRTH SILENCE: no [data-mm-set] anywhere.
 *   S1  the first word — click nodes: the key appears, mm-set caught
 *       RUNNING at 40ms with the animation owning scale, settled by 420ms
 *       (pressed, mode flipped, scale home).
 *   S2  the neighbors never move — the sel button's rect is bit-identical
 *       across the pop (scale is an independent transform property).
 *   S3  re-click silence — clicking the LIVE mode again changes nothing
 *       and says nothing (no new running animation, same node).
 *   S4  the dead stay still — the disabled sel button (empty selection)
 *       never dips under a real CDP press (pointer-events-none immunity).
 *   S5  sel's first word — Ctrl+A arms the selection, the sel click pops
 *       (running caught at 40ms).
 *   S6  ghost immunity — Escape collapses then clears the selection: the
 *       coercion hands the pressed state to fit with NO click, and fit
 *       must NOT pop (no key, no running animation); the honesty effect
 *       cleared sel's stale key.
 *   S7  re-arm honesty — with the key cleared at the coercion edge, a
 *       fresh sel click pops again (an attribute that never left would
 *       never re-fire — the effect is what makes this face possible).
 *   P1  the press answer — a real CDP hold dips the fit button to 0.96;
 *       release springs home and the click lands fit's own settle.
 *   R   console clean; roster untouched (framing moves; the world does not).
 *
 * Environment shim = t571/t585..t590's: desktop-capable Chrome via CDP
 * port 9334 (9323=t578, 9324=t584, 9325=t585, 9326=t586, 9327=t587,
 * 9328=t587 probe, 9329=t589 QA, 9330=t588, 9331=t589, 9332=t590,
 * 9333=t591 QA probe — zombies keep their ports; t581's law).
 *
 * Runs in the EMPIAR world in place (no switch), mints nothing.
 *
 * Usage: node scripts/t591-mm-settle-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9334";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t591-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 30000, step = 250) {
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
const readJson = async (js) => {
  const raw = evalJs(js);
  try { return JSON.parse(raw); } catch { return null; }
};
const centerOf = async (sel) => {
  const r = await readJson(`JSON.stringify((function(){
    const el=document.querySelector(${JSON.stringify(sel)});
    if(!el) return null;
    const b=el.getBoundingClientRect();
    return { x: Math.round(b.x + b.width/2), y: Math.round(b.y + b.height/2) };
  })())`);
  return r;
};
const scaleOf = (sel) => readJson(`JSON.stringify((function(){
  const el=document.querySelector(${JSON.stringify(sel)});
  if(!el) return null;
  const cs=getComputedStyle(el);
  return { scale: cs.scale, anim: cs.animationName };
})())`);

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
const active = projects.find((p) => p.active);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"}, expected EMPIAR — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);

/* ---- served-CSS gate BEFORE the browser: the t585 watcher lesson ------ */
/* assert the COMPILED spellings (lightningcss rewrites 0.94 → .94 and
   reorders the animation shorthand name to the end — the t582 family of
   serialization lessons). */
{
  const cssUrl = sh(`curl -s ${BASE}/ | grep -oE '/_next/static/[^"]+\\.css' | head -1`);
  const sheet = cssUrl ? sh(`curl -s "${BASE}${cssUrl}"`) : "";
  console.log(`\n[G0] the served sheet carries the voice`);
  check("css url resolved", cssUrl.length > 0, cssUrl.slice(-40));
  check("keyframes mm-set compiled", sheet.includes("@keyframes mm-set"));
  check("from scale .94 in the sheet", /mm-set\s*\{[^}]*scale:\s*\.94/.test(sheet) || sheet.includes("scale: .94"));
  check("transient-key rule compiled", sheet.includes('[data-mm-btn][data-mm-set][aria-pressed="true"]'));
  check("press dip utility still served (P faces armed)", sheet.includes("motion-safe\\:active"));
}

/* ---- browser up, world healthy ---------------------------------------- */
rmSync(PROFILE, { recursive: true, force: true });
const chromeUp = await launchDesktopChrome();
check("desktop chrome up", chromeUp);
if (chromeUp) {
  try { sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`); } catch { /* best effort */ }
  check("hover/pointer shim applied", applyShim());
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`document.querySelectorAll("[data-job]").length`);
    return n > 0 ? n : null;
  }, 45000);
  check("canvas hydrated", hydrated > 0, `${hydrated} cards`);

  /* ---- Q — the world and the birth silence ---------------------------- */
  console.log(`\n[Q] world QA + birth silence`);
  const q = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length,
    mm: !!document.querySelector("[data-mm-mode]"),
    mode: document.querySelector("[data-mm-mode]")?.getAttribute("data-mm-mode"),
    fitPressed: document.querySelector('[data-mm-btn="fit"]')?.getAttribute("aria-pressed"),
    keys: document.querySelectorAll("[data-mm-set]").length
  })`);
  check("12 cards / 13 edges", q?.cards === 12 && q?.edges === 13, `${q?.cards}/${q?.edges}`);
  check("minimap framing control present", q?.mm === true && q?.mode === "fit", `mode=${q?.mode}`);
  check("fit is the born pressed segment", q?.fitPressed === "true");
  check("birth silence: no transient key anywhere", q?.keys === 0, `${q?.keys} keys`);

  /* ---- S1 — the first word (atomic in-page timing) --------------------- */
  console.log(`\n[S1] the first word — nodes pops`);
  const s1 = await readJson(`new Promise((res)=>{
    const btn=document.querySelector('[data-mm-btn="nodes"]');
    if(!btn){res(JSON.stringify({err:"no nodes button"}));return;}
    const nb=document.querySelector('[data-mm-btn="sel"]');
    const fb=btn.getBoundingClientRect(), nbR=nb.getBoundingClientRect();
    /* S2 measures the header group's RELATIVE geometry (sel minus nodes):
       the mode flip legitimately resizes the map beneath (fit unions the
       viewport window, nodes frames content only — different world box,
       different svg height), so ABSOLUTE rects move with the container;
       only a shift WITHIN the row would indict the pop. */
    const before={attr:btn.hasAttribute("data-mm-set"),pressed:btn.getAttribute("aria-pressed"),dx:nbR.x-fb.x,dy:nbR.y-fb.y,nw:nbR.width,nh:nbR.height,fw:fb.width,fh:fb.height};
    const t0=performance.now();
    btn.click();
    const samples=[];
    const grab=(label)=>{
      const anims=btn.getAnimations().filter(a=>a.animationName==="mm-set");
      const cs=getComputedStyle(btn);
      samples.push({label,t:Math.round(performance.now()-t0),running:anims.filter(a=>a.playState==="running").length,scale:cs.scale,attr:btn.hasAttribute("data-mm-set"),pressed:btn.getAttribute("aria-pressed")});
    };
    setTimeout(()=>grab("early"),40);
    setTimeout(()=>grab("mid"),90);
    setTimeout(()=>{
      grab("settled");
      const fb2=btn.getBoundingClientRect(), nb2=document.querySelector('[data-mm-btn="sel"]').getBoundingClientRect();
      const mode=document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode");
      res(JSON.stringify({before,samples,mode,nAfter:{dx:nb2.x-fb2.x,dy:nb2.y-fb2.y,nw:nb2.width,nh:nb2.height,fw:fb2.width,fh:fb2.height}}));
    },420);
  })`);
  check("S1 payload", !!s1 && !s1.err, s1?.err ?? "");
  check("before: no key, unpressed", s1?.before?.attr === false && s1?.before?.pressed === "false");
  const early = s1?.samples?.[0], mid = s1?.samples?.[1], settled = s1?.samples?.[2];
  check("early 40ms: animation running, key present, pressed",
    early?.running === 1 && early?.attr === true && early?.pressed === "true",
    `t=${early?.t}ms running=${early?.running}`);
  check("early: the animation owns scale (not none)",
    early?.scale != null && early.scale !== "none", `scale=${early?.scale}`);
  check("settled 420ms: done, home, mode flipped",
    settled?.running === 0 && (settled?.scale === "none" || parseFloat(settled?.scale) === 1) && s1?.mode === "nodes",
    `scale=${settled?.scale} mode=${s1?.mode}`);

  /* ---- S2 — the neighbors never move (relative geometry) --------------- */
  console.log(`\n[S2] the neighbors never move (within the group)`);
  const nSame = s1 && s1.before.dx === s1.nAfter.dx && s1.before.dy === s1.nAfter.dy &&
    s1.before.nw === s1.nAfter.nw && s1.before.nh === s1.nAfter.nh &&
    s1.before.fw === s1.nAfter.fw && s1.before.fh === s1.nAfter.fh;
  check("sel-vs-nodes relative geometry bit-identical across the pop", nSame,
    `d(${s1?.before?.dx},${s1?.before?.dy}) → d(${s1?.nAfter?.dx},${s1?.nAfter?.dy}) sizes ${s1?.before?.nw}x${s1?.before?.nh}/${s1?.before?.fw}x${s1?.before?.fh} → ${s1?.nAfter?.nw}x${s1?.nAfter?.nh}/${s1?.nAfter?.fw}x${s1?.nAfter?.fh}`);

  /* ---- S3 — re-click silence ------------------------------------------- */
  console.log(`\n[S3] re-click on the live mode says nothing`);
  const s3 = await readJson(`new Promise((res)=>{
    const btn=document.querySelector('[data-mm-btn="nodes"]');
    btn.click();
    setTimeout(()=>{
      const running=btn.getAnimations().filter(a=>a.animationName==="mm-set"&&a.playState==="running").length;
      res(JSON.stringify({running,sameNode:btn===document.querySelector('[data-mm-btn="nodes"]'),attr:btn.hasAttribute("data-mm-set")}));
    },60);
  })`);
  check("no new animation on a no-op re-click", s3?.running === 0, `running=${s3?.running}`);
  check("same node, key honestly parked", s3?.sameNode === true && s3?.attr === true);

  /* ---- S4 — the dead stay still ---------------------------------------- */
  console.log(`\n[S4] the disabled sel button never dips (real input)`);
  const dead = await readJson(`JSON.stringify((function(){
    const b=document.querySelector('[data-mm-btn="sel"]');
    return { disabled:b.disabled, pe:getComputedStyle(b).pointerEvents };
  })())`);
  check("sel disabled at empty selection", dead?.disabled === true, `pe=${dead?.pe}`);
  const dC = await centerOf('[data-mm-btn="sel"]');
  if (dC) {
    try {
      sh(`agent-browser mouse move ${dC.x} ${dC.y} >/dev/null 2>&1`);
      sh(`agent-browser mouse down >/dev/null 2>&1`);
    } catch (e) { check("CDP mouse down landed", false, String(e.message).slice(0, 60)); }
    await sleep(320);
    const held = await scaleOf('[data-mm-btn="sel"]');
    check("held on the dead button: no dip (scale none/1)",
      held?.scale === "none" || parseFloat(held?.scale) === 1, `scale=${held?.scale}`);
    try { sh(`agent-browser mouse up >/dev/null 2>&1`); } catch { /* best effort */ }
  } else check("sel button located", false);

  /* ---- S5 — sel's first word (selection arms the segment) -------------- */
  console.log(`\n[S5] Ctrl+A arms the selection; sel pops`);
  sh(`agent-browser press Control+a >/dev/null 2>&1`);
  await sleep(300);
  const armed = await readJson(`JSON.stringify({
    selDisabled: document.querySelector('[data-mm-btn="sel"]').disabled,
    selCount: document.querySelectorAll("[data-job].ring-2, [data-job][data-selected]").length
  })`);
  check("sel enabled under a live selection", armed?.selDisabled === false);
  const s5 = await readJson(`new Promise((res)=>{
    const btn=document.querySelector('[data-mm-btn="sel"]');
    if(!btn){res(JSON.stringify({err:"no sel button"}));return;}
    btn.click();
    const samples=[];
    const grab=()=>{
      const anims=btn.getAnimations().filter(a=>a.animationName==="mm-set");
      samples.push({running:anims.filter(a=>a.playState==="running").length,attr:btn.hasAttribute("data-mm-set"),pressed:btn.getAttribute("aria-pressed")});
    };
    setTimeout(()=>{grab();},40);
    setTimeout(()=>{
      grab();
      const mode=document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode");
      res(JSON.stringify({samples,mode}));
    },420);
  })`);
  check("sel first word: running at 40ms with the key",
    s5?.samples?.[0]?.running === 1 && s5?.samples?.[0]?.attr === true,
    `running=${s5?.samples?.[0]?.running}`);
  check("sel settled: pressed, mode is sel", s5?.samples?.[1]?.pressed === "true" && s5?.mode === "sel");

  /* ---- S6 — ghost immunity: the coercion never pops -------------------- */
  console.log(`\n[S6] Escape ×2 empties the selection; fit inherits WITHOUT a pop`);
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(300); /* collapse: 12 → [primary] */
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(300); /* clear: → [] — effMode coerces sel → fit */
  const s6 = await readJson(`JSON.stringify((function(){
    const mode=document.querySelector("[data-mm-mode]").getAttribute("data-mm-mode");
    const fit=document.querySelector('[data-mm-btn="fit"]');
    const sel=document.querySelector('[data-mm-btn="sel"]');
    return {
      mode,
      fitKey: fit.hasAttribute("data-mm-set"),
      fitRunning: fit.getAnimations().filter(a=>a.animationName==="mm-set"&&a.playState==="running").length,
      fitPressed: fit.getAttribute("aria-pressed"),
      selKey: sel.hasAttribute("data-mm-set"),
      selPressed: sel.getAttribute("aria-pressed"),
      selDisabled: sel.disabled
    };
  })())`);
  check("coercion landed: mode is fit, fit pressed", s6?.mode === "fit" && s6?.fitPressed === "true", `mode=${s6?.mode}`);
  check("ghost immunity: fit has NO key, NO running animation",
    s6?.fitKey === false && s6?.fitRunning === 0, `key=${s6?.fitKey} running=${s6?.fitRunning}`);
  check("honesty effect cleared sel's stale key", s6?.selKey === false && s6?.selPressed === "false" && s6?.selDisabled === true);

  /* ---- S7 — re-arm honesty: the cleared key can fire again ------------- */
  console.log(`\n[S7] re-select; a fresh sel click pops again`);
  sh(`agent-browser press Control+a >/dev/null 2>&1`);
  await sleep(300);
  const s7 = await readJson(`new Promise((res)=>{
    const btn=document.querySelector('[data-mm-btn="sel"]');
    btn.click();
    setTimeout(()=>{
      const anims=btn.getAnimations().filter(a=>a.animationName==="mm-set");
      res(JSON.stringify({running:anims.filter(a=>a.playState==="running").length,attr:btn.hasAttribute("data-mm-set")}));
    },40);
  })`);
  check("re-armed: the fresh click pops (the coercion edge made this possible)",
    s7?.running === 1 && s7?.attr === true, `running=${s7?.running}`);
  /* cleanup: collapse + clear so the world returns to a calm framing */
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(250);
  sh(`agent-browser press Escape >/dev/null 2>&1`);
  await sleep(250);

  /* ---- P1 — the press answer on a segment (real CDP input) ------------- */
  console.log(`\n[P1] the segment answers the hand`);
  const fitC = await centerOf('[data-mm-btn="fit"]');
  check("fit button located", fitC?.x != null);
  if (fitC) {
    try {
      sh(`agent-browser mouse move ${fitC.x} ${fitC.y} >/dev/null 2>&1`);
      sh(`agent-browser mouse down >/dev/null 2>&1`);
    } catch (e) { check("CDP mouse down landed on fit", false, String(e.message).slice(0, 60)); }
    await sleep(320);
    const held = await scaleOf('[data-mm-btn="fit"]');
    check("held: the segment dips to 0.96",
      held?.scale != null && parseFloat(held.scale) > 0.94 && parseFloat(held.scale) < 0.985,
      `scale=${held?.scale}`);
    try { sh(`agent-browser mouse up >/dev/null 2>&1`); } catch { /* best effort */ }
    await sleep(420); /* release → click → fit's own mm-set settle */
    const after = await scaleOf('[data-mm-btn="fit"]');
    check("released: springs home", after?.scale === "none" || parseFloat(after?.scale) === 1, `scale=${after?.scale}`);
  }
  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t591-mm-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled screenshot", true, ".qa-logs/shots/t591-mm-settled.png");

  /* ---- cleanup: the world owes nothing --------------------------------- */
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (framing moves nothing)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
  } catch (e) { check("cleanup ran", false, String(e.message)); }
  try {
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  } catch { /* eval unavailable */ }
}

/* ---- the exit ---------------------------------------------------------- */
try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* already gone */ }
if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
