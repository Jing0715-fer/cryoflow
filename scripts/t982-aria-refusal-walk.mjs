#!/usr/bin/env node
/**
 * t982 — the ARIA-REFUSAL WITNESS WALK (the message-quality FIFTH pass,
 * first sub-option's browser arm): the census found 110 silent refusals
 * (state-disabled buttons whose accessible name never carries the
 * reason); the targeted cures landed on 13 faces across 4 files. This
 * ride witnesses the cured faces LIVE — the refusal face of each is the
 * state the user meets first (empty input, no results, the zoom clamp).
 *
 * THE LEGS (zero minting — every face exists on the standing world):
 *   1. the dashboard loads (the page has buttons; the header door lives);
 *   2. the Send refusal face — the AI assistant opens with an EMPTY
 *      input, so the Send button's aria-label IS the refusal:
 *      "Send (type a message first)";
 *   3. the find-bar refusal faces — the find bar opens with an EMPTY
 *      query (n === 0), so both match buttons announce the refusal:
 *      "Previous match (no results yet)" / "Next match (no results yet)";
 *   4. the zoom-clamp refusal face — clicking zoom out until the clamp
 *      disables the button, whose label then names the reason:
 *      "Zoom out (already at minimum zoom)" — and the counter-face
 *      (zoom in, still enabled, plain name) witnesses the expression
 *      stays honest in BOTH branches. The world is restored: the walk
 *      clicks zoom in the same count (the leave-no-trace law).
 *
 * RIDE LAWS inherited: one fresh `agent-browser open` (the eval-hang
 * law); poll-then-probe; realClick probes vis AND own every round;
 * Escape closes panels between legs; the walk asserts (it is the cure's
 * verifier) and exits honest.
 *
 *   node scripts/t982-aria-refusal-walk.mjs
 */
/* the t991 re-ride: the walk's ORGANS moved into scripts/walk-kit.mjs
 * (the family's shared skeleton — the t990 entry's candidate ①); the
 * legs below are byte-identical to the born form. The realClick rides
 * the kit's current-family form (the own-false branch waits instead of
 * scrolling — every face this walk clicks lives in-viewport, the
 * fallback was never the road). */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, escAll, shot,
  serverFirst, finish,
} = createWalk({ name: "t982-aria-refusal-walk", receiptFile: "t982-aria-refusal-walk.json" });

console.log("=== t982 aria-refusal witness walk ===");

/* the server-first law (the t981 walk's lesson) — kit-enforced */
await serverFirst();

/* LEG 1 — the fresh open, the world present */
console.log("leg 1: the fresh open");
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const headerDoor = await poll(
  `(() => { const b = document.querySelector('[aria-label="AI assistant"]'); return JSON.stringify({ live: !!b && b.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.live === true, 10, 500);
ok("the AI assistant door lives", headerDoor?.live === true);

/* LEG 2 — the Send refusal face */
console.log("leg 2: the Send refusal face (empty input at birth)");
const openClick = await realClick(`document.querySelector('[aria-label="AI assistant"]')`);
ok("the assistant opens through its real door", String(openClick).startsWith("clicked"), String(openClick));
const sendRefusal = await poll(
  `(() => { const b = document.querySelector('button[aria-label="Send (type a message first)"]'); return JSON.stringify({ live: !!b && b.getBoundingClientRect().width > 0, disabled: b ? b.disabled : null }); })()`,
  (v) => v.live === true, 12, 500);
ok("the Send button announces the refusal", sendRefusal?.live === true,
  sendRefusal ? `disabled=${sendRefusal.disabled}` : "");
ok("the refusal face is DISABLED (empty input)", sendRefusal?.disabled === true);
const sendPlain = evalJson(`(() => { const b = document.querySelector('button[aria-label="Send"]'); return JSON.stringify({ exists: !!b }); })()`);
ok("no bare-Send ghost beside the refusal face (one button, both branches)", sendPlain?.exists !== true);
shot("t982-send-refusal.png");
/* the companion is NOT a Radix layer — Escape does not peel it (the
   t797 law: its close mouths are the layered-Esc-on-focus and the
   header X). The walk closes through the REAL door and polls it shut —
   at 320 the panel's textarea covers the canvas cluster (witnessed:
   elementFromPoint under the zoom-out center answered TEXTAREA). */
const closeClick = await realClick(`document.querySelector('[aria-label="关闭 AI 助手"]')`);
ok("the assistant closes through its real door", String(closeClick).startsWith("clicked"), String(closeClick));
const panelShut = await poll(
  `(() => { const t = document.querySelector('textarea[aria-label="Message the AI assistant"]'); return JSON.stringify({ gone: !t || t.getBoundingClientRect().width === 0 }); })()`,
  (v) => v.gone === true, 8, 400);
ok("the panel is shut (no textarea ghost)", panelShut?.gone === true);

/* LEG 3 — the find-bar refusal faces */
console.log("leg 3: the find-bar refusal faces (n === 0 at birth)");
const findClick = await realClick(`document.querySelector('[data-canvas-ui="find-toggle"]')`);
ok("the find bar opens through its canvas toggle", String(findClick).startsWith("clicked"), String(findClick));
const findFaces = await poll(
  `(() => { const p = document.querySelector('button[aria-label="Previous match (no results yet)"]'); const n = document.querySelector('button[aria-label="Next match (no results yet)"]'); return JSON.stringify({ prev: !!p && p.getBoundingClientRect().width > 0, prevDisabled: p ? p.disabled : null, next: !!n && n.getBoundingClientRect().width > 0, nextDisabled: n ? n.disabled : null }); })()`,
  (v) => v.prev === true && v.next === true, 12, 500);
ok("Previous match announces the refusal", findFaces?.prev === true, findFaces ? `disabled=${findFaces.prevDisabled}` : "");
ok("Next match announces the refusal", findFaces?.next === true, findFaces ? `disabled=${findFaces.nextDisabled}` : "");
ok("both refusal faces are DISABLED (no results yet)", findFaces?.prevDisabled === true && findFaces?.nextDisabled === true);
shot("t982-findbar-refusal.png");
/* close through the toggle's own face (one store flag: openFind/closeFind
   agree on the button — the t134 law) */
await realClick(`document.querySelector('[data-canvas-ui="find-toggle"]')`);
await sleep(400);

/* LEG 4 — the zoom-clamp refusal face */
console.log("leg 4: the zoom-clamp refusal face (the clamp reached honestly)");
const readZoom = `(() => { const out = document.querySelector('[aria-label="Zoom out"]') || document.querySelector('button[aria-label^="Zoom out ("]'); const inn = document.querySelector('[aria-label="Zoom in"]') || document.querySelector('button[aria-label^="Zoom in ("]'); return JSON.stringify({ outLabel: out ? out.getAttribute('aria-label') : null, outDisabled: out ? out.disabled : null, inLabel: inn ? inn.getAttribute('aria-label') : null, inDisabled: inn ? inn.disabled : null }); })()`;
const start = evalJson(readZoom);
ok("the plain faces at default zoom (the enabled branch is honest)", start?.outLabel === "Zoom out" && start?.inLabel === "Zoom in", `out="${start?.outLabel}" in="${start?.inLabel}"`);
let clicks = 0, clamped = null;
for (let i = 0; i < 30; i++) {
  const st = evalJson(readZoom);
  if (st.outDisabled === true) { clamped = st; break; }
  const pos = await realClick(`document.querySelector('[aria-label="Zoom out"]')`);
  if (!String(pos).startsWith("clicked")) break;
  clicks++;
  await sleep(250);
}
ok("the clamp was reached by real clicks", !!clamped, `clicks=${clicks}`);
ok("the clamped Zoom out names the reason", clamped?.outLabel === "Zoom out (already at minimum zoom)", `label="${clamped?.outLabel}"`);
ok("the counter-face stays plain while enabled (Zoom in)", clamped?.inLabel === "Zoom in" && clamped?.inDisabled === false, `in="${clamped?.inLabel}"`);
shot("t982-zoomclamp-refusal.png");
/* leave no trace: restore the zoom */
for (let i = 0; i < clicks; i++) {
  const st = evalJson(readZoom);
  if (st.inDisabled === true) break;
  await realClick(`document.querySelector('[aria-label="Zoom in"]')`);
  await sleep(200);
}
const restored = evalJson(readZoom);
ok("the world restored (zoom back in range, both plain)", restored?.outLabel === "Zoom out" && restored?.inLabel === "Zoom in", `out="${restored?.outLabel}" in="${restored?.inLabel}"`);

/* the receipt — the kit's finish (the same fields, the honest exit) */
finish({
  instrument: "t982-aria-refusal-walk",
  born: "2026-10-14",
  contract: "the message-quality FIFTH pass, first sub-option — the cured faces witnessed live",
  legs: {
    worldAlive: !!alive,
    sendRefusal: sendRefusal ?? null,
    findRefusals: findFaces ?? null,
    zoomClamp: clamped ? { clicks, outLabel: clamped.outLabel, inLabel: clamped.inLabel } : null,
    restored: restored ?? null,
  },
});
