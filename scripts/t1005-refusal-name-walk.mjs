#!/usr/bin/env node
/**
 * t1005 — the REFUSAL-NAME WITNESS WALK (the message-quality fifth
 * pass's second arm, browser arm): the t1005 unit pinned thirty
 * refusal-name cures at source (flights, walls, gates); this ride
 * witnesses the AI ASSISTANT PANEL's planes live — the one cohort
 * surface the standing world reaches without a server write (the
 * panel's messages are SERVER sessions, so the busy faces stay
 * unit-pinned per the t1002 precedent; the at-rest planes and the
 * first arm's BOTH BRANCHES are the live film).
 *
 * THE LEGS (zero minting, zero server writes — the t982 walk's own
 * panel, ridden one arm deeper):
 *   1. the fresh open — the dashboard renders;
 *   2. the assistant opens through its real door (the t982 header
 *      door, [aria-label="AI assistant"]);
 *   3. THE AT-REST PLANES — the second arm's two faces honest at
 *      rest: New chat ENABLED with the plain name, the textarea
 *      ENABLED with the plain name — and the FIRST arm's face
 *      re-witnessed: Send DISABLED at the empty input, its accessible
 *      name IS the refusal ("Send (type a message first)") — the
 *      t982 cure standing under the second arm's commit;
 *   4. THE COUNTER-FACE (the t982 leg-4 law: the expression stays
 *      honest in BOTH branches) — the walk types "hi" into the
 *      textarea: the Send name flips to the plain "Send" and the
 *      control ENABLES; the walk then backspaces twice: the refusal
 *      name and the disable RETURN — the first arm's both branches
 *      witnessed live, zero server writes;
 *   5. the world restored — Escape shuts the panel, the dashboard
 *      still renders, the input empty as-found, the world net-zero.
 *
 * RIDE LAWS inherited: one fresh `agent-browser open` (the eval-hang
 * law); poll-then-probe; realClick probes vis AND own every round;
 * the walk asserts (it is the cure's verifier) and exits honest.
 *
 *   node scripts/t1005-refusal-name-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, escAll, shot,
  serverFirst, finish,
} = createWalk({ name: "t1005-refusal-name-walk", receiptFile: "t1005-refusal-name-walk.json" });

console.log("=== t1005 refusal-name witness walk ===");

await serverFirst();

/* the three faces, by their at-rest accessible names; the Send face
 * reads by PREFIX so both branches answer the same locator. */
const DOOR = `document.querySelector('[aria-label="AI assistant"]')`;
const NEWCHAT = `document.querySelector('button[aria-label="New chat"]')`;
const TEXTA = `document.querySelector('textarea[aria-label="Message the AI assistant"]')`;
const SEND = `document.querySelector('button[aria-label^="Send"]')`;
const planeOf = (find) => `(() => { const el = (${find}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true', label: el.getAttribute('aria-label') }); })()`;

/* LEG 1 — the fresh open */
console.log("leg 1: the fresh open");
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);

/* LEG 2 — the assistant's real door */
console.log("leg 2: the assistant panel");
const doorAlive = await poll(
  `(() => { const el = (${DOOR}); return JSON.stringify({ live: !!el && el.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.live === true, 20, 500);
ok("the AI assistant door lives (the t982 header door)", doorAlive?.live === true);
const doorClick = await realClick(DOOR);
ok("the door click landed (vis + own)",
  typeof doorClick === "string" && doorClick.startsWith("clicked@"), String(doorClick));
const panelAlive = await poll(planeOf(NEWCHAT), (v) => v && v.live === true, 20, 500);
ok("the New chat face lives inside the panel", !!panelAlive && panelAlive.live === true);

/* LEG 3 — the at-rest planes */
console.log("leg 3: the at-rest planes");
const newchat = await poll(planeOf(NEWCHAT), (v) => v && v.live === true, 10, 500);
ok("THE SECOND ARM AT REST — New chat enabled with the plain name (the busy face is N3's unit pin)",
  !!newchat && newchat.live && newchat.disabled === false && newchat.label === "New chat",
  `label="${newchat?.label}" disabled=${newchat?.disabled}`);
const texta = await poll(planeOf(TEXTA), (v) => v && v.live === true, 10, 500);
ok("THE SECOND ARM AT REST — the textarea enabled with the plain name (the streaming face is N4's unit pin)",
  !!texta && texta.live && texta.disabled === false && texta.label === "Message the AI assistant",
  `label="${texta?.label}" disabled=${texta?.disabled}`);
const sendRefusal = await poll(planeOf(SEND), (v) => v && v.live === true && v.disabled === true, 10, 500);
ok("THE FIRST ARM RE-WITNESSED — Send disabled at the empty input, the name IS the refusal",
  !!sendRefusal && sendRefusal.disabled === true && sendRefusal.label === "Send (type a message first)",
  `label="${sendRefusal?.label}" disabled=${sendRefusal?.disabled}`);
shot("t1005-refusal-at-rest.png");

/* LEG 4 — the counter-face: both branches of the first arm, live */
console.log("leg 4: the counter-face (both branches)");
const taClick = await realClick(TEXTA);
ok("the textarea click landed (focus for typing)",
  typeof taClick === "string" && taClick.startsWith("clicked@"), String(taClick));
sh(`${AB} keyboard type "hi"`);
const sendPlain = await poll(planeOf(SEND), (v) => v && v.live === true && v.disabled === false && v.label === "Send", 12, 400);
ok("BRANCH B — typed input flips Send to the plain enabled name",
  !!sendPlain && sendPlain.disabled === false && sendPlain.label === "Send",
  `label="${sendPlain?.label}" disabled=${sendPlain?.disabled}`);
/* the clear: the textarea is a React CONTROLLED component — the native
 * setter + a real input event is the honest reset (the keyboard sub-
 * command has no press; the dance fires the same events a Backspace
 * would, and React's state moves with them) */
evalJs(`(() => { const el = document.querySelector('textarea[aria-label^="Message the AI assistant"]'); if (!el) return 'no-el'; const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; setter.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); return 'cleared'; })()`);
const sendRestored = await poll(planeOf(SEND), (v) => v && v.live === true && v.disabled === true && v.label === "Send (type a message first)", 12, 400);
ok("BRANCH A RESTORED — the cleared input returns the refusal name and the disable",
  !!sendRestored && sendRestored.disabled === true && sendRestored.label === "Send (type a message first)",
  `label="${sendRestored?.label}" disabled=${sendRestored?.disabled}`);
shot("t1005-refusal-restored.png");

/* LEG 5 — the world restored */
console.log("leg 5: the world restored");
await escAll(3);
const after = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 12, 500);
ok("the dashboard still renders (the panel shut, no scar)",
  !!after && after.n > 0, `buttons=${after?.n}`);
const textaLeft = await evalJson(planeOf(TEXTA));
ok("the textarea rests as-found (empty input, the panel may be shut — the plane's word decides)",
  textaLeft === null || (textaLeft.disabled === false && textaLeft.label === "Message the AI assistant"),
  textaLeft === null ? "panel shut — the face unmounted, the ride's words live in the receipt" : `label="${textaLeft?.label}" disabled=${textaLeft?.disabled}`);

finish({ worldNote: "zero mints, zero server writes (typed input cleared, nothing sent); the world net-zero" });
