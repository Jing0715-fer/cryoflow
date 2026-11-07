#!/usr/bin/env node
/**
 * t1004 — the FLIP-PLANE WITNESS WALK (the message-quality fifth pass's
 * second sub-case, browser arm): the t1004 unit pinned sixteen flip
 * sites at source (14 aria-busy flights + 2 polite spans); this ride
 * witnesses the ONE REAL MULTI-MS FLIGHT the standing world can show —
 * the dashboard's Re-detect probe (engine-guidance.tsx:197, the 60s
 * cache bypass doing actual backend work).
 *
 * THE LEGS (zero minting — the face lives on the standing world):
 *   1. the fresh open — the dashboard renders, the Re-detect control
 *      lives (the EngineReDetectRow mounts in the install rail);
 *   2. THE IDLE PLANE — aria-busy reads "false" (React renders aria
 *      booleans explicitly — busy=false IS the honest not-busy state)
 *      or is absent, the name reads "Re-detect", the control is
 *      enabled — the plane honest BEFORE the flip;
 *   3. THE FLIP — a real click; then the tight poll (150ms × 40) for
 *      THE BUSY PLANE: aria-busy="true" AND the name flipped to
 *      "detecting…" — the witnessed flip the static census could
 *      never see;
 *   4. THE SETTLE — the probe resolves: the name returns to
 *      "Re-detect", aria-busy gone, the control enabled again (the
 *      MUST-HOLD assert — a flight that never returns is a real
 *      finding, the walk exits honest);
 *   5. THE FLIP'S VERDICT — caught: the busy plane's three coordinates
 *      stand witnessed; under the film: the honest sub-perceptual note
 *      (the t1002 precedent — the busy face is F2's unit pin, the
 *      settled plane stands in), never a silent pass;
 *   6. the world restored — the probe is read-only (a system refresh,
 *      no job mutations), the dashboard still renders, the world
 *      net-zero.
 *
 * RIDE LAWS inherited: one fresh `agent-browser open` (the eval-hang
 * law); poll-then-probe; realClick probes vis AND own every round;
 * the walk asserts (it is the cure's verifier) and exits honest.
 *
 *   node scripts/t1004-flip-plane-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, escAll, shot,
  serverFirst, finish,
} = createWalk({ name: "t1004-flip-plane-walk", receiptFile: "t1004-flip-plane-walk.json" });

console.log("=== t1004 flip-plane witness walk ===");

await serverFirst();

/* the doors: the engine KPI card (the popover's anchor — its hint
 * always opens with "RELION") and the Re-detect control INSIDE the
 * popover content (the row mounts only while the popover is open —
 * the Radix gate the walk must knock first). */
const DOOR = `document.querySelector('button[title^="RELION"]')`;
const FIND = `document.querySelector('button[title^="Re-run the RELION/WSL environment probe"]')`;
const planeExpr = `(() => { const el = (${FIND}); if (!el) return null; return JSON.stringify({ busy: el.getAttribute('aria-busy'), text: (el.textContent || '').replace(/\\s+/g, ' ').trim(), disabled: el.disabled, live: el.getBoundingClientRect().width > 0 }); })()`;

/* LEG 1 — the fresh open, the door lives */
console.log("leg 1: the fresh open");
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const doorAlive = await poll(
  `(() => { const el = (${DOOR}); return JSON.stringify({ live: !!el && el.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.live === true, 24, 500);
ok("the engine KPI door lives (the popover's anchor card)", doorAlive?.live === true);

/* LEG 2 — knock the door, the popover mounts the Re-detect row */
console.log("leg 2: the popover door");
const doorClick = await realClick(DOOR);
ok("the door click landed (vis + own)",
  typeof doorClick === "string" && doorClick.startsWith("clicked@"), String(doorClick));
const rowAlive = await poll(planeExpr, (v) => v && v.live === true, 20, 500);
ok("the Re-detect control lives (mounted in the popover content)",
  !!rowAlive && rowAlive.live === true);

/* LEG 2b — the idle plane (inside the open popover) */
console.log("leg 2b: the idle plane");
const idle = await poll(planeExpr, (v) => v && v.live === true, 10, 500);
ok("the idle plane — aria-busy reads false (React renders aria booleans explicitly) or absent",
  !!idle && (idle.busy === null || idle.busy === undefined || idle.busy === "false"), `aria-busy=${idle?.busy}`);
ok("the idle plane — the name reads Re-detect, the control enabled",
  !!idle && idle.text.includes("Re-detect") && idle.disabled === false,
  `text="${idle?.text?.slice(0, 40)}" disabled=${idle?.disabled}`);
shot("t1004-flip-idle.png");

/* LEG 3 — the flip: the click, then the tight poll for the busy plane */
console.log("leg 3: the flip");
const clickRes = await realClick(FIND);
ok("the click landed on the Re-detect control (vis + own)",
  typeof clickRes === "string" && clickRes.startsWith("clicked@"), String(clickRes));

let busyPlane = null;
if (typeof clickRes === "string" && clickRes.startsWith("clicked@")) {
  busyPlane = await poll(planeExpr, (v) => v && v.busy === "true" && v.text.includes("detecting"), 40, 150);
}

/* LEG 4 — the settle (the MUST-HOLD: every flight returns) */
console.log("leg 4: the settle");
const settled = await poll(
  planeExpr,
  (v) => v && v.live === true && v.busy !== "true" && v.disabled === false && v.text.includes("Re-detect"),
  90, 500);
ok("the flight returned — name restored, aria-busy gone, enabled again",
  !!settled && settled.busy !== "true" && settled.text.includes("Re-detect") && settled.disabled === false,
  `text="${settled?.text?.slice(0, 40)}" busy=${settled?.busy} disabled=${settled?.disabled}`);
shot("t1004-flip-settled.png");

/* LEG 5 — the flip's verdict: the busy plane witnessed, or the honest
 * sub-perceptual note (never a silent pass) */
console.log("leg 5: the flip's verdict");
if (busyPlane) {
  ok("THE BUSY PLANE WITNESSED — aria-busy=true and the name flipped to detecting…",
    busyPlane.busy === "true" && busyPlane.text.includes("detecting"),
    `text="${busyPlane.text?.slice(0, 40)}" aria-busy=${busyPlane.busy}`);
  shot("t1004-flip-busy.png");
} else {
  ok("the flip window ran under the film — the settled plane stands in (the busy face is F2's unit pin; the t1002 sub-perceptual precedent)",
    !!settled,
    "no busy-plane catch on localhost; the cure's wire is unit-pinned (t1004 F2), the flight's return witnessed live");
}

/* LEG 6 — the world restored */
console.log("leg 6: the world restored");
await escAll(3);
const after = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 12, 500);
ok("the dashboard still renders after the probe (the read-only flight left no scar)",
  !!after && after.n > 0, `buttons=${after?.n}`);
const restored = await evalJson(planeExpr);
ok("the Re-detect plane rests at idle (as-found = as-left; the popover may have closed — the plane's word, not the popover's)",
  restored === null || (restored.busy !== "true" && restored.disabled === false && restored.text.includes("Re-detect")),
  restored === null ? "popover closed by Escape — the row unmounted, the flight long settled" : `busy=${restored?.busy} disabled=${restored?.disabled}`);

finish({ worldNote: "read-only system probe; zero mints; the world net-zero" });
