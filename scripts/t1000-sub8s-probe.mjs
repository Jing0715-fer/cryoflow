#!/usr/bin/env node
/**
 * t1000 — the SUB-8S PROBE (the t996 race branch's attribution probe,
 * the t999 entry's candidate ① taken):
 *
 * The t996 walk rode the remount branch twice: after the resurrection
 * the popover was stripped before any Try again click could land, and
 * the walk ATTRIBUTED the strip to "the app's own pollTick refetch".
 * But the source read says the attribution cannot be right:
 *
 *   - pollTick's catch is SILENT (`polling errors are transient`) — a
 *     failed tick sets NOTHING, renders NOTHING;
 *   - with 22 terminal jobs and an unchanged token the tick answers
 *     `unchanged: true` — an early return, zero set(), zero renders;
 *   - even a token flip with no UI-visible change adopts the token and
 *     returns WITHOUT a re-render (the reference-stability compare).
 *
 * So pollTick is a DOM no-op in every recovery scenario for a static
 * world. The suspect for the t996 strip is the DEV RESPAWN ITSELF: the
 * HMR client loses its websocket during the outage and the reconnect
 * reloads the page — session state (the tab latch, the popover) dies
 * with the context, and the persisted selection seed re-opens the panel
 * fresh (the tab latch at its smart default — exactly what the walk's
 * remount branch then witnessed).
 *
 * This probe separates the hypotheses with a WINDOW MARKER
 * (`window.__t1000Probe` — a JS-context liveness tripwire) and
 * `performance.timeOrigin` (a reload's fingerprint):
 *
 *   leg 2  THE VIGIL: the picker open and READY across >=2 idle
 *          heartbeats (the 8s cadence) — the popover NEVER closes, the
 *          marker NEVER resets: pollTick with the token unchanged is a
 *          DOM no-op, proven live (the t1000 entry's probe question
 *          answered YES — a failed/unchanged tick recovers without a
 *          remount, because it recovers without DOING anything);
 *   leg 3  THE ERROR FACE under the kill (the t996 face re-armed): the
 *          transport dies (zero non-terminal jobs asserted first), the
 *          refresh affordance is real-clicked IN PLACE, the destructive
 *          message blooms; an OUTAGE SAMPLE asserts the outage itself
 *          does NOT reload the page (the marker survives the dark);
 *   leg 4  THE RESURRECTION RACE (three outcomes, the receipt names
 *          one): sampled at 250ms from the first 200 —
 *            "reload"      the marker is DEAD at the first sample: the
 *                          dev respawn's reconnect reloads the world —
 *                          the t996 remount's TRUE mechanism, and the
 *                          sub-8s in-place story is structurally
 *                          unwitnessable through a server kill in dev
 *                          (it belongs to the build-day prod ride);
 *            "in-place"    the marker LIVES and Try again stands: the
 *                          walk clicks it and the READY face returns
 *                          IN PLACE — the t996 race branch finally WON,
 *                          the sub-8s story witnessed live;
 *            "dom-remount" the marker LIVES but the popover is GONE —
 *                          a real pollTick-driven DOM remount (would
 *                          CONTRADICT the source read — a discovery).
 *          The reload branch then rides the t996 remount-branch grammar
 *          (the panel's Params door re-opened, the picker re-opened
 *          through its own trigger, the fresh load lands ready, the
 *          refresh lane holds) and asserts the FRESH context (a new
 *          timeOrigin — the reload's fingerprint);
 *   leg 5  world honesty: the own-door closes, the fingerprint
 *          as-found = as-left (this walk mints NOTHING — the t992 birth
 *          law (c)), the server stands at 200, the mock's door open.
 *
 * RIDE LAWS: WIDE-FIRST; the palette's ENTER mouth; the FOCUS GATE; the
 * panel's TAB DOOR (BL2 — the tab answers only a real pointer event);
 * popover-scoped readers (never a page-wide guess); poll-then-probe;
 * the kill's pgrep self-match broken by the [v] class (BL3); the
 * byte-identical respawn (same env pin, same cwd, same flags, the
 * standing log); the WATCHER LAW honored (the script is written and
 * settled BEFORE the ride; no project-dir writes mid-ride).
 *
 *   node scripts/t1000-sub8s-probe.mjs
 */
import net from "node:net";
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, pollTraced, realClick,
  shot, api, readJobs, jobsArr, fingerprint, serverFirst, finish, phaseTrace,
} = createWalk({ name: "t1000-sub8s-probe", receiptFile: "t1000-sub8s-probe.json" });

const FACE_NAME = "Rounds Face (t989)";
const POPOVER_SEL = `[aria-label="Rounds you can continue from"]`;
const TRIGGER_SEL = `button[aria-label="Pick which previous round to continue from"]`;
const REFRESH_SEL = `button[aria-label="Re-read the rounds from the engine and the cluster"]`;

/* the popover-scoped reader + the CONTEXT reader (the marker + the
 * reload fingerprint) — every read is one round trip */
const popState = `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p || p.getBoundingClientRect().width === 0) return JSON.stringify({ up: false }); const btn = [...p.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Try again'); const err = [...p.querySelectorAll('p')].find((x) => (x.className ?? '').includes('text-destructive')); const loading = (p.textContent ?? '').includes('Reading checkpoints'); const refresh = !!p.querySelector(${JSON.stringify(REFRESH_SEL)}); return JSON.stringify({ up: true, tryAgain: !!btn, msg: err ? (err.textContent ?? '').trim() : null, loading, refresh }); })()`;

const ctxState = `(() => JSON.stringify({ marker: typeof window.__t1000Probe !== "undefined", born: window.__t1000Probe ? window.__t1000Probe.born : null, nav: performance.timeOrigin }))()`;

const raceSample = `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); const base = (!p || p.getBoundingClientRect().width === 0) ? { up: false } : (() => { const btn = [...p.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Try again'); const err = [...p.querySelectorAll('p')].find((x) => (x.className ?? '').includes('text-destructive')); return { up: true, tryAgain: !!btn, msg: err ? (err.textContent ?? '').trim() : null }; })(); return JSON.stringify({ ...base, marker: typeof window.__t1000Probe !== "undefined", nav: performance.timeOrigin }); })()`;

const mockOpen = () => new Promise((res) => {
  const s = net.connect(3022, "127.0.0.1");
  s.on("connect", () => { s.end(); res(true); });
  s.on("error", () => res(false));
  setTimeout(() => { s.destroy(); res(false); }, 4000);
});

/* BL2's executable form — the panel's Params door (the t996 organ), the
 * budgets parameterized: a RELOAD-SIZED wait (30 × 1s) for the seed's
 * re-host (the dev server recompiles the route and the jobs load lands
 * before the aside fills — the red-2 lesson), the default 6s for a
 * panel that is already on screen */
const panelOf = `(() => { const eds = [...document.querySelectorAll('aside')].filter((a) => (a.className ?? '').includes('border-l') && [...a.querySelectorAll('input[aria-label="Job name"]')].some((i) => i.value === ${JSON.stringify(FACE_NAME)})); return eds[0] ?? null; })()`;
const openParamsDoor = async (panelTries = 12, panelMs = 500) => {
  const panelUp = await poll(`(() => { const ed = (${panelOf}); return JSON.stringify({ up: !!ed && ed.getBoundingClientRect().width > 0 }); })()`, (v) => v.up, panelTries, panelMs);
  const tabClick = await realClick(`(() => { const ed = (${panelOf}); if (!ed) return null; return [...ed.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Params') ?? null; })()`);
  const tabActive = await poll(`(() => { const ed = (${panelOf}); if (!ed) return JSON.stringify({ act: false }); const tab = [...ed.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Params'); return JSON.stringify({ act: tab?.getAttribute('data-state') === 'active' }); })()`, (v) => v.act, 10, 500);
  return { panelUp: !!panelUp && panelUp.up, tabClick: String(tabClick).startsWith("clicked@"), tabActive: !!tabActive && tabActive.act, tabClickRaw: String(tabClick) };
};

/* the palette's ENTER mouth (leg 1's grammar, factored for the reload
 * branch's honest re-entry when the seed does not re-host) */
const paletteJump = async () => {
  sh(`${AB} press Control+K`);
  await sleep(700);
  await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400);
  evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`);
  sh(`${AB} keyboard type "Rounds Face"`);
  const row = await poll(
    `(() => { const items = [...document.querySelectorAll('[cmdk-item]')]; const hit = items.find((it) => (it.textContent ?? '').includes('Rounds Face')); return JSON.stringify({ found: !!hit }); })()`,
    (v) => v.found, 12, 400);
  if (!row || !row.found) return false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    sh(`${AB} press Enter`);
    const landed = await poll(
      `(() => { const name = document.querySelector('input[aria-label="Job name"]'); return JSON.stringify({ shut: !document.querySelector('[cmdk-input]'), hosted: !!name && name.value === ${JSON.stringify(FACE_NAME)} }); })()`,
      (v) => v.shut && v.hosted, 10, 500);
    if (landed) return true;
    const pal = evalJson(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`);
    if (pal?.up) { sh(`${AB} press Escape`); await sleep(500); sh(`${AB} press Control+K`); await sleep(700); await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400); evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`); sh(`${AB} keyboard type "Rounds Face"`); await sleep(800); }
  }
  return false;
};

const TERM = new Set(["completed", "failed", "cancelled", "idle"]);
const worldRead = async (tag) => {
  let body = null;
  for (let attempt = 0; attempt < 3 && !body; attempt++) {
    if (attempt > 0) await sleep(4000);
    try { body = JSON.parse(api("GET", "/api/jobs")); } catch { body = null; }
    if (body && typeof body === "object") { const a = Array.isArray(body) ? body : body.jobs ?? []; if (a.length === 0) body = null; }
  }
  const arr = Array.isArray(body) ? body : body?.jobs ?? [];
  return { arr, fp: fingerprint(arr) };
};

console.log("=== t1000 sub-8s probe ===");

/* LEG 0 — the shell bed rolls */
console.log("leg 0: the shell bed rolls");
const mock = await mockOpen();
ok("the mock cluster's door is open (:3022 TCP)", mock);
serverFirst();
const asFound = await worldRead("as-found");
ok("the world carries FIFTEEN jobs (the standing fleet, the t1002 adoption re-key)", asFound.arr.length === 15, `rows=${asFound.arr.length}`);
const live = asFound.arr.filter((j) => !TERM.has(j.status));
ok("ZERO non-terminal jobs (the kill orphans nothing)",
  live.length === 0, live.map((j) => `${j.name}:${j.status}`).join(","));

/* LEG 1 — the wide-first opening + the MARKER PLANTED */
console.log("leg 1: the wide-first opening + the marker");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(`(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`, (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const shut = await poll(
  `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
  (x) => x.shut, 4, 400);
ok("the companion is shut (the ride plane is clear)", !!shut && shut.shut);
evalJs(`(() => { window.__t1000Probe = { born: Date.now() }; return "planted"; })()`);
const planted = evalJson(ctxState);
ok("THE MARKER IS PLANTED (the JS-context tripwire lives)", !!planted && planted.marker === true, JSON.stringify(planted));
const navAtBirth = planted?.nav ?? null;
ok("the reload fingerprint recorded (performance.timeOrigin)", typeof navAtBirth === "number" && navAtBirth > 0, `nav=${navAtBirth}`);

/* the palette's ENTER mouth → the face's edit panel */
const row = await poll(
  `(() => JSON.stringify({ up: !!document.querySelector('button') }))()`,
  (v) => v.up, 4, 400);
ok("the palette door is reachable (the shell answers)", !!row && row.up);
const jumpLanded = await paletteJump();
ok("the jump landed — the edit panel hosts the face", jumpLanded);
const door1 = await openParamsDoor();
ok("the Params tab opened through the real pointer path (the panel's own door)", door1.panelUp && door1.tabClick && door1.tabActive, door1.tabClickRaw);
const trigClick = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the Rounds trigger clicked through the real mouse path", String(trigClick).startsWith("clicked@"), String(trigClick));
const happy = await pollTraced(popState, (v) => v.up && !v.loading && !v.tryAgain && !v.msg, 24, 500, "ready");
ok("THE READY FACE HOLDS (no loading, no error, no Try again)", !!happy && happy.up && !happy.tryAgain, JSON.stringify(happy));

/* LEG 2 — THE VIGIL: >=2 idle heartbeats (8s cadence) with the popover
 * open; the token is unchanged (22 terminal jobs) so every tick is
 * `unchanged: true` — the DOM must not move AT ALL */
console.log("leg 2: the unchanged-token vigil (the DOM no-op proof)");
let vigilSteady = true;
let vigilNavSteady = true;
for (let i = 0; i < 3; i++) {
  await sleep(7000); // 7s gaps — three samples span ~21s ≈ 2-3 heartbeats
  const p = evalJson(popState);
  const c = evalJson(ctxState);
  phaseTrace.push(`vigil i${i}: pop=${JSON.stringify(p)} ctx=${JSON.stringify(c)}`);
  if (!p || !p.up || p.loading || p.tryAgain || p.msg) vigilSteady = false;
  if (!c || c.marker !== true || c.nav !== navAtBirth) vigilNavSteady = false;
}
ok("THE POPOVER NEVER CLOSED ACROSS THE HEARTBEATS (pollTick is a DOM no-op at the unchanged token)", vigilSteady);
ok("THE MARKER NEVER RESET ACROSS THE HEARTBEATS (no reload, same JS context)", vigilNavSteady);
const happy2 = evalJson(popState);
ok("the ready face still holds at the vigil's end", !!happy2 && happy2.up && !happy2.tryAgain && happy2.refresh === true, JSON.stringify(happy2));

/* LEG 3 — THE TRANSPORT DIES + the error face re-armed + the outage sample */
console.log("leg 3: the kill + the error face + the outage sample");
const atKill = await worldRead("at-kill");
ok("ZERO non-terminal jobs re-asserted at the kill's door",
  atKill.arr.filter((j) => !TERM.has(j.status)).length === 0, `rows=${atKill.arr.length}`);
const pids = sh(`pgrep -f "next de[v] -p 3000"; pgrep -f "next-serve[r]"`).split("\n").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
ok("the dev server's processes found (parent + next-server)", pids.length >= 1, pids.join(","));
if (pids.length >= 1) sh(`kill -TERM ${pids.join(" ")} 2>/dev/null; true`);
let down = false;
for (let i = 0; i < 24 && !down; i++) {
  const code = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 2 ${BASE}/`).trim();
  down = code === "000";
  if (!down) await sleep(500);
}
if (!down) { sh(`kill -KILL ${pids.join(" ")} 2>/dev/null; true`); await sleep(1500); down = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 2 ${BASE}/`).trim() === "000"; }
ok("THE TRANSPORT IS DEAD (:3000 answers 000)", down);
const rfClick = await realClick(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return null; return p.querySelector(${JSON.stringify(REFRESH_SEL)}); })()`);
ok("the refresh clicked IN PLACE (the popover never closed)", String(rfClick).startsWith("clicked@"), String(rfClick));
const errFace = await pollTraced(popState, (v) => v.up && v.tryAgain && !!v.msg, 24, 500, "error");
ok("THE FETCH-ERROR FACE BLOOMS (Try again present, the destructive message speaks)",
  !!errFace && errFace.up && errFace.tryAgain === true && !!errFace.msg, `msg=${JSON.stringify(errFace?.msg)}`);
shot("t1000-probe-error-face.png");
await sleep(2000);
const outageCtx = evalJson(ctxState);
const outagePop = evalJson(popState);
phaseTrace.push(`outage: ctx=${JSON.stringify(outageCtx)} pop=${JSON.stringify(outagePop)}`);
ok("THE OUTAGE ITSELF DOES NOT RELOAD THE PAGE (the marker survives the dark)",
  !!outageCtx && outageCtx.marker === true && outageCtx.nav === navAtBirth, JSON.stringify(outageCtx));
ok("the popover survives the outage (the error face still up)",
  !!outagePop && outagePop.up && outagePop.tryAgain === true, JSON.stringify(outagePop));

/* LEG 4 — THE RESURRECTION RACE: the byte-identical respawn; from the
 * first 200, sample at 250ms — the receipt names ONE of three outcomes */
console.log("leg 4: the resurrection race (reload / in-place / dom-remount)");
sh(`DATABASE_URL="file:/home/z/my-project/db/cryoflow.db" nohup node node_modules/next/dist/bin/next dev -p 3000 >> /home/z/my-project/scripts/.t996-server.log 2>&1 &`);
let upAgain = false;
for (let i = 0; i < 240 && !upAgain; i++) {
  const code = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 3 ${BASE}/`).trim();
  if ((upAgain = code === "200")) break;
  if (i % 10 === 0) phaseTrace.push(`respawn i${i}: ${code}`);
  await sleep(500);
}
ok("THE SERVER ANSWERS 200 AGAIN (the world's process restored)", upAgain);
let outcome = null; // "reload" | "in-place" | "dom-remount"
let firstSample = null;
let ta2 = null;
for (let i = 0; i < 24; i++) {
  const v = evalJson(raceSample);
  phaseTrace.push(`race i${i}: ${JSON.stringify(v)}`);
  if (i === 0) firstSample = v;
  if (v && v.marker === false) { outcome = "reload"; break; }
  if (v && v.up && v.tryAgain && v.marker === true) { ta2 = await realClick(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return null; return [...p.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Try again'); })()`); outcome = "in-place"; break; }
  if (v && v.up === false && v.marker === true) { outcome = "dom-remount"; break; }
  await sleep(250);
}
ok("THE RACE NAMED ITS OUTCOME (one of three)", outcome === "reload" || outcome === "in-place" || outcome === "dom-remount", `outcome=${outcome} first=${JSON.stringify(firstSample)}`);

if (outcome === "in-place") {
  ok("THE SAME TRY AGAIN CLICKED AFTER THE RESURRECTION (the in-place race won — the affordance never left)",
    String(ta2).startsWith("clicked@"), String(ta2));
  const recovered = await pollTraced(popState, (v) => v.up && !v.tryAgain && !v.msg && !v.loading, 60, 2000, "recovered");
  ok("THE READY FACE RETURNS THROUGH THE AFFORDANCE (no reopen, no reload — THE SUB-8S STORY WITNESSED)",
    !!recovered && recovered.up && !recovered.tryAgain && !recovered.msg, JSON.stringify(recovered));
  const afterCtx = evalJson(ctxState);
  ok("the JS context survived the whole arc (the marker rides the recovery)",
    !!afterCtx && afterCtx.marker === true && afterCtx.nav === navAtBirth, JSON.stringify(afterCtx));
} else if (outcome === "reload") {
  ok("THE DEV RESPAWN RELOADED THE WORLD (the marker died — the t996 remount's TRUE mechanism named)",
    true, `firstSample=${JSON.stringify(firstSample)}`);
  /* the reload branch rides the t996 remount-branch grammar and asserts
   * the FRESH context. The re-entry waits a RELOAD-SIZED budget for the
   * seed's re-host (the dev route recompile + the jobs load land before
   * the aside fills — the red-2 lesson); when the seed does not re-host
   * the panel, the palette is the honest re-entry (the walk's own
   * opening organ) */
  let door4 = await openParamsDoor(30, 1000);
  let doorOk = door4.panelUp && door4.tabClick && door4.tabActive;
  if (!doorOk) {
    phaseTrace.push("reload-branch: the seed did not re-host in 30s — the palette re-entry");
    const jumped = await paletteJump();
    door4 = await openParamsDoor();
    doorOk = jumped && door4.panelUp && door4.tabClick && door4.tabActive;
  }
  ok("the panel's Params door re-opened (the seed's re-host or the palette's honest re-entry; the tab latch at its smart default)",
    doorOk, door4.tabClickRaw);
  const reTrig = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
  ok("the picker re-opened through its own trigger (the honest re-entry)", String(reTrig).startsWith("clicked@"), String(reTrig));
  const reReady = await pollTraced(popState, (v) => v.up && !v.tryAgain && !v.msg && !v.loading, 60, 2000, "reopened-ready");
  ok("THE FRESH LOAD LANDS READY (the transport's recovery through the picker's own door)",
    !!reReady && reReady.up && !reReady.tryAgain && !reReady.msg, JSON.stringify(reReady));
  const rf2 = await realClick(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return null; return p.querySelector(${JSON.stringify(REFRESH_SEL)}); })()`);
  ok("the refresh lane holds with the transport alive (load(true) answers)", String(rf2).startsWith("clicked@"), String(rf2));
  const rfReady = await pollTraced(popState, (v) => v.up && !v.tryAgain && !v.msg && !v.loading, 40, 1500, "refresh-held");
  ok("the ready face holds after the refresh (the lane's second witness)",
    !!rfReady && rfReady.up && !rfReady.tryAgain && !rfReady.msg, JSON.stringify(rfReady));
  const freshCtx = evalJson(ctxState);
  ok("THE CONTEXT IS FRESH (a new timeOrigin — the reload's fingerprint; the old marker is gone)",
    !!freshCtx && freshCtx.marker === false && typeof freshCtx.nav === "number" && freshCtx.nav !== navAtBirth, JSON.stringify(freshCtx));
} else {
  /* dom-remount — the discovery branch: the source read said pollTick
   * cannot do this; if it happens, witness it honestly and leave the
   * deep diagnosis to the entry (the walk records WHAT, the entry asks
   * WHY) */
  ok("A DOM REMOUNT STRIPPED THE POPOVER WITH THE CONTEXT ALIVE (the discovery branch — the source read contradicted)",
    true, `firstSample=${JSON.stringify(firstSample)}`);
  const stillCtx = evalJson(ctxState);
  ok("the context evidence banked (marker alive, same timeOrigin)",
    !!stillCtx && stillCtx.marker === true && stillCtx.nav === navAtBirth, JSON.stringify(stillCtx));
  const door4 = await openParamsDoor();
  ok("the panel's Params door re-opened after the strip", door4.panelUp && door4.tabClick && door4.tabActive, door4.tabClickRaw);
  const reTrig = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
  ok("the picker re-opened through its own trigger", String(reTrig).startsWith("clicked@"), String(reTrig));
  const reReady = await pollTraced(popState, (v) => v.up && !v.tryAgain && !v.msg && !v.loading, 60, 2000, "reopened-ready");
  ok("the fresh load lands ready", !!reReady && reReady.up && !reReady.tryAgain && !reReady.msg, JSON.stringify(reReady));
}
shot("t1000-probe-recovered.png");

/* LEG 5 — world honesty */
console.log("leg 5: the own-door closes + the world's honesty");
sh(`${AB} press Escape`);
await sleep(600);
const popGone = await poll(`(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); return JSON.stringify({ gone: !p || p.getBoundingClientRect().width === 0 }); })()`, (v) => v.gone, 8, 400);
ok("the popover closed by its own Escape (the Radix layer's honest door)", !!popGone && popGone.gone);
sh(`${AB} press Escape`);
await sleep(600);
const dlgGone = await poll(`(() => { const d = document.querySelector('[data-slot="dialog-content"]'); return JSON.stringify({ gone: !d || d.getBoundingClientRect().width === 0 }); })()`, (v) => v.gone, 8, 400);
ok("the edit panel closed (the dialog's own door)", !!dlgGone && dlgGone.gone);
const asLeft = await worldRead("as-left");
ok("the world carries FIFTEEN jobs as-left (nothing minted)", asLeft.arr.length === 15, `rows=${asLeft.arr.length}`);
ok("THE FINGERPRINT AS-FOUND = AS-LEFT (byte-identical)", asFound.fp === asLeft.fp);
const closeCode = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 5 ${BASE}/`).trim();
ok("the server stands at 200 at the shell (the close gate)", closeCode === "200", `code=${closeCode}`);
const mockLeft = await mockOpen();
ok("the mock cluster's door still open at the close", mockLeft);

finish({
  face: FACE_NAME,
  outcome,
  navAtBirth,
  firstRaceSample: firstSample ?? null,
  asFound: asFound.fp,
  asLeft: asLeft.fp,
});
