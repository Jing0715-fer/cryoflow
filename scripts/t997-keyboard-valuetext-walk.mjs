#!/usr/bin/env node
/**
 * t997 — the KEYBOARD-VALUETEXT WITNESS WALK (the kit's legs grammar —
 * every organ rides scripts/walk-kit.mjs; the legs below are the walk's
 * own story): the resize grips' value plane, speaking since this window.
 *
 * THE LEGS:
 *   1. the wide-first fresh open (the kit's opening: viewport 1440 900,
 *      the alive poll, the companion shut) — the stored geometry
 *      captured BEFORE any leg rides (the leave-no-trace law);
 *   2. the E grip's voice — the companion opens through its real door,
 *      the east grip is focused through the keyboard road (el.focus(),
 *      the Tab-equivalent), and the valuetext is read at rest (the
 *      human shape "宽度 N 像素", agreeing with the valuenow); the
 *      ArrowLeft journey walks to the FLOOR — the face flips to
 *      "已到最小宽度（360 像素）" and HOLDS under extra shrinking
 *      presses (the clamp eats the step, the face says it — the t982
 *      zoom-clamp dialect's valuetext seat); one ArrowRight returns the
 *      human face (+16px, the wall un-speaks itself); the ArrowRight
 *      journey walks to the CEILING — "已到最大宽度（1424 像素）" at
 *      the 1440 viewport (vw-16, the clampGeo ceiling the pointer drag
 *      hits), the valuenow meets the valuemax, and extra presses hold;
 *   3. the S grip's voice — the same story on the vertical axis (floor
 *      "已到最小高度（420 像素）", ceiling "已到最大高度（884 像素）"
 *      at the 900 viewport);
 *   4. the leave-no-trace close — the presses REST (the debounced echo
 *      lands), the stored geometry is restored byte-identically, the
 *      companion closes through its real door (the t797 law), and the
 *      fingerprint as-found = as-left.
 *
 * THE SELF-HEALING PRESS (the red-1's birth law): a fresh open's early
 * commits can REPLACE the grip's DOM node (the dev-mode hydration pass)
 * and steal the focus mid-journey — the red-1's presses died after the
 * first two (560→528, then nothing; each fresh focus bought 1-2 presses).
 * The family's poll-then-probe law applied to the keyboard road: NEVER
 * trust a press — re-assert focus before every press, verify the step
 * LANDED (the valuenow moved, or the wall holds it honestly with the
 * grip still focused), and re-press with a fresh focus when the step was
 * stolen. A press eaten by the CLAMP is the road's own truth (the wall);
 * a press eaten by a STOLEN FOCUS is the walk's failure to deliver —
 * the two are told apart by the grip's own focus read.
 *
 * RIDE LAWS: server-first (kit-enforced); poll-then-probe; the
 * companion closes through its real door; the walk witnesses and exits
 * honest (the world's geometry echo is the walk's only footprint, and
 * it is erased).
 *
 *   node scripts/t997-keyboard-valuetext-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, ok, sleep, sh, evalJs, evalJson, poll, realClick, shot,
  serverFirst, wideFirst, finish,
} = createWalk({ name: "t997-keyboard-valuetext-walk", receiptFile: "t997-keyboard-valuetext-walk.json" });

const GEO_KEY = "cryoflow.assistant.geometry.v1";
const GEO_MIN_W = 360, GEO_MIN_H = 420, STEP = 16;

console.log("=== t997 keyboard-valuetext witness walk ===");

/* ---- the self-healing press organ (the red-1's birth law) ----
 * sepSel: the grip's selector; key: the arrow key; expect: (r) => bool.
 * Returns the LAST read (the caller's ok() judges) — but only after the
 * step either landed or was honestly eaten by the wall (focused + unchanged). */
const readSep = (sel) => evalJson(`(() => { const s = document.querySelector('[data-companion-window] ${sel}'); const a = document.activeElement; return JSON.stringify({ live: !!s, now: s ? Number(s.getAttribute('aria-valuenow')) : null, text: s ? s.getAttribute('aria-valuetext') : null, max: s && s.getAttribute('aria-valuemax') !== null ? Number(s.getAttribute('aria-valuemax')) : null, focused: a === s }); })()`);
const focusSep = (sel) => evalJs(`(() => { const s = document.querySelector('[data-companion-window] ${sel}'); if (s) s.focus(); return document.activeElement === s ? 'focused' : 'none'; })()`);
async function pressHeal(sel, key, expect, tries = 4, tally = null) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    focusSep(sel);
    if (tally) tally.presses++;
    sh(`${AB} press ${key}`);
    await sleep(220);
    last = readSep(sel);
    if (last && last.live && last.focused && expect(last)) return last;
    /* a stolen press (focus lost or the step not landed) is retried with
       a fresh focus; an honest wall-eat (focused + unchanged at the
       target) is returned by the expect() gate itself */
  }
  return last;
}
/* the journey: walk an axis to its target wall, self-healing per press.
 * The tally counts REAL presses (the red-2's lesson: a counter that
 * counts loop iterations while the organ presses up to four times inside
 * one iteration is a counter that lies). */
/* THE REVIVAL LANE (the red-3/4/5's birth law): the dev server watches
 * the WHOLE project dir — a receipt PNG, a unit json, or the walk's own
 * script edited seconds before the ride pushes a route recompile and a
 * FULL PAGE RELOAD mid-journey (the server log's `GET / compile: 2.5s`),
 * and the companion panel — session state — dies with the tree. The
 * family rode a remount before (the t996 law): the walk waits for the
 * reload to settle, re-opens through the panel's real door, re-focuses,
 * and CONTINUES the journey — recording every revival honestly. */
async function revivePanel() {
  await sleep(2500); // the reload lands and the world re-renders
  const click = await realClick(`document.querySelector('[aria-label="AI assistant"]')`);
  if (!String(click).startsWith("clicked")) return false;
  const up = await poll(
    `(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ up: !!p && p.getBoundingClientRect().width > 0 }); })()`,
    (v) => v.up === true, 12, 500);
  return !!up && up.up === true;
}
async function journey(sel, key, dir, target, maxPresses = 90) {
  const tally = { presses: 0, healed: 0, revivals: 0 };
  for (let i = 0; i < maxPresses; i++) {
    let before = readSep(sel);
    if (!before?.live) {
      /* the reload took the plane — revive through the real door */
      if ((await revivePanel()) !== true) return { ok: false, ...tally, last: before };
      tally.revivals++;
      before = readSep(sel);
      if (!before?.live) return { ok: false, ...tally, last: before };
    }
    if (before.focused !== true) tally.healed++;
    if (before.now === target) return { ok: true, ...tally, last: before };
    const r = await pressHeal(sel, key, (v) => v.now === target || v.now === before.now, 4, tally);
    if (r && r.live === false) { i--; continue; } // died mid-burst — the loop top revives
    if (r && r.now === before.now && r.focused) {
      /* the wall ate it honestly — either we are AT the target (the
         next iteration's early return judges) or the clamp refuses past
         it (the caller's assert judges the final face) */
      if (r.now === target) return { ok: true, ...tally, last: r };
    }
  }
  return { ok: false, ...tally, last: readSep(sel) };
}

/* LEG 1 — the wide-first fresh open (the kit's opening) */
console.log("leg 1: the wide-first fresh open");
await serverFirst();
const opened = await wideFirst();
if (!opened) { console.log("FATAL: the world never rendered"); process.exit(2); }

/* the stored geometry, captured BEFORE any leg rides (the leave-no-trace
   law: the walk restores the echo exactly as it found it) */
const geoBefore = evalJson(`(() => JSON.stringify({ raw: localStorage.getItem(${JSON.stringify(GEO_KEY)}) }))()`);

/* the viewport, read live (the ceiling is the clampGeo formula's, not
   the walk's assumption) */
const vp = evalJson(`(() => JSON.stringify({ vw: window.innerWidth, vh: window.innerHeight }))()`);
ok("the viewport is the kit's wide-first (1440 900)", vp?.vw === 1440 && vp?.vh === 900, JSON.stringify(vp));
const W_CEIL = Math.max(vp.vw - 16, GEO_MIN_W);
const H_CEIL = Math.max(vp.vh - 16, GEO_MIN_H);

/* LEG 2 — the E grip's voice (the width axis) */
console.log("leg 2: the E grip (the width axis, the value plane speaks)");
const E_SEL = '[role="separator"][aria-orientation="vertical"]';
const S_SEL = '[role="separator"][aria-orientation="horizontal"]';
const doorClick = await realClick(`document.querySelector('[aria-label="AI assistant"]')`);
ok("the companion opens through its real door", String(doorClick).startsWith("clicked"), String(doorClick));
const panelUp = await poll(
  `(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ up: !!p && p.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.up === true, 12, 500);
ok("the companion panel is up (the voice lives on the grips)", !!panelUp && panelUp.up);

const eSep = await poll(
  `(() => { const s = document.querySelector('[data-companion-window] ${E_SEL}'); return JSON.stringify({ live: !!s, valuenow: s ? Number(s.getAttribute('aria-valuenow')) : null, valuetext: s ? s.getAttribute('aria-valuetext') : null, valuemax: s && s.getAttribute('aria-valuemax') !== null ? Number(s.getAttribute('aria-valuemax')) : null }); })()`,
  (v) => v.live === true && v.valuenow !== null, 12, 500);
ok("the E grip is live and its valuenow speaks", !!eSep && eSep.live === true, eSep ? `now=${eSep.valuenow}` : "");
ok("the E grip's valuemax is spoken (the pattern's other half)", eSep?.valuemax === W_CEIL, `max=${eSep?.valuemax} expected=${W_CEIL}`);

const wBefore = eSep?.valuenow;
const humanW = (n) => `宽度 ${n} 像素`;
const wFloorFace = `已到最小宽度（${GEO_MIN_W} 像素）`;
const wCeilFace = `已到最大宽度（${W_CEIL} 像素）`;
/* the at-rest contract is the AGREEMENT (the value plane speaks the
 * truth about wherever the as-found world parks): mid-range → the human
 * shape; at a wall → that wall's refusal face. The red-2's lesson: the
 * debug scaffolds' echo had parked the world AT the floor (360) — the
 * face there was the honest refusal, and a hard-coded human-shape
 * assert would call the truth a lie. */
const wExpectedAtRest = wBefore <= GEO_MIN_W ? wFloorFace : wBefore >= W_CEIL ? wCeilFace : humanW(wBefore);
ok("the valuetext at rest AGREES with the valuenow (the value plane speaks the truth about the as-found park)",
  eSep?.valuetext === wExpectedAtRest, `text=${JSON.stringify(eSep?.valuetext)} now=${wBefore} (expected ${JSON.stringify(wExpectedAtRest)})`);

focusSep(E_SEL);
const focusW = evalJson(`(() => JSON.stringify({ active: document.activeElement?.getAttribute('aria-orientation') ?? null, role: document.activeElement?.getAttribute('role') ?? null }))()`);
ok("the E separator holds focus (the keyboard road is open)", focusW?.active === "vertical" && focusW?.role === "separator", JSON.stringify(focusW));

/* the ArrowLeft journey to the floor */
const wFloorTrip = await journey(E_SEL, "ArrowLeft", -1, GEO_MIN_W);
ok("the ArrowLeft journey lands the FLOOR (the clamp caught the last step)",
  wFloorTrip.ok === true && wFloorTrip.last?.now === GEO_MIN_W,
  `now=${wFloorTrip.last?.now} (from ${wBefore}; ${wFloorTrip.presses} real presses, ${wFloorTrip.healed} re-focuses, ${wFloorTrip.revivals} revivals)`);
ok("the valuetext FLIPPED to the floor face (the keyboard road's own refusal)",
  wFloorTrip.last?.text === wFloorFace, `text=${JSON.stringify(wFloorTrip.last?.text)}`);

/* the refusal holds: extra shrinking presses are eaten, the face stays */
const wHold1 = await pressHeal(E_SEL, "ArrowLeft", (v) => v.now === GEO_MIN_W);
const wHold2 = await pressHeal(E_SEL, "ArrowLeft", (v) => v.now === GEO_MIN_W);
ok("extra shrinking presses are EATEN at the floor (now unchanged)",
  wHold2?.now === GEO_MIN_W, `now=${wHold2?.now}`);
ok("the floor face HOLDS under the refused presses (the face says what the clamp did)",
  wHold2?.text === wFloorFace, `text=${JSON.stringify(wHold2?.text)}`);
shot("t997-width-floor-face.png");

/* one growth press un-speaks the wall */
const offFloor = await pressHeal(E_SEL, "ArrowRight", (v) => v.now === GEO_MIN_W + STEP);
ok("one ArrowRight leaves the floor (+16 through the same clamp)",
  offFloor?.now === GEO_MIN_W + STEP, `now=${offFloor?.now}`);
ok("the valuetext returns to the human shape (the wall un-speaks itself)",
  offFloor?.text === humanW(GEO_MIN_W + STEP), `text=${JSON.stringify(offFloor?.text)}`);

/* the ArrowRight journey to the ceiling */
const wCeilTrip = await journey(E_SEL, "ArrowRight", +1, W_CEIL);
ok("the ArrowRight journey lands the CEILING (the viewport wall, vw-16)",
  wCeilTrip.ok === true && wCeilTrip.last?.now === W_CEIL,
  `now=${wCeilTrip.last?.now} expected=${W_CEIL} (${wCeilTrip.presses} real presses, ${wCeilTrip.healed} re-focuses, ${wCeilTrip.revivals} revivals)`);
ok("the valuetext FLIPPED to the ceiling face (the growing road's refusal)",
  wCeilTrip.last?.text === wCeilFace, `text=${JSON.stringify(wCeilTrip.last?.text)}`);
ok("the valuenow MEETS the valuemax at the ceiling (value plane complete)",
  wCeilTrip.last?.now === wCeilTrip.last?.max, `now=${wCeilTrip.last?.now} max=${wCeilTrip.last?.max}`);
const wCHold1 = await pressHeal(E_SEL, "ArrowRight", (v) => v.now === W_CEIL);
const wCHold2 = await pressHeal(E_SEL, "ArrowRight", (v) => v.now === W_CEIL);
ok("extra growing presses are EATEN at the ceiling (now unchanged)", wCHold2?.now === W_CEIL, `now=${wCHold2?.now}`);
ok("the ceiling face HOLDS under the refused presses", wCHold2?.text === wCeilFace, `text=${JSON.stringify(wCHold2?.text)}`);
shot("t997-width-ceiling-face.png");

/* LEG 3 — the S grip's voice (the height axis) */
console.log("leg 3: the S grip (the height axis, the same voice)");
const sSep = await poll(
  `(() => { const s = document.querySelector('[data-companion-window] ${S_SEL}'); return JSON.stringify({ live: !!s, valuenow: s ? Number(s.getAttribute('aria-valuenow')) : null, valuetext: s ? s.getAttribute('aria-valuetext') : null, valuemax: s && s.getAttribute('aria-valuemax') !== null ? Number(s.getAttribute('aria-valuemax')) : null }); })()`,
  (v) => v.live === true && v.valuenow !== null, 12, 500);
ok("the S grip is live and its valuenow speaks", !!sSep && sSep.live === true, `now=${sSep?.valuenow}`);
ok("the S grip's valuemax is spoken (the pattern's other half)", sSep?.valuemax === H_CEIL, `max=${sSep?.valuemax} expected=${H_CEIL}`);
const hBefore = sSep?.valuenow;
const hFloorFace = `已到最小高度（${GEO_MIN_H} 像素）`;
const hCeilFace = `已到最大高度（${H_CEIL} 像素）`;
const hExpectedAtRest = hBefore <= GEO_MIN_H ? hFloorFace : hBefore >= H_CEIL ? hCeilFace : `高度 ${hBefore} 像素`;
ok("the S valuetext at rest AGREES with the valuenow (the same at-rest contract)",
  sSep?.valuetext === hExpectedAtRest, `text=${JSON.stringify(sSep?.valuetext)} now=${hBefore} (expected ${JSON.stringify(hExpectedAtRest)})`);

focusSep(S_SEL);
const focusH = evalJson(`(() => JSON.stringify({ active: document.activeElement?.getAttribute('aria-orientation') ?? null }))()`);
ok("the S separator holds focus", focusH?.active === "horizontal", JSON.stringify(focusH));

/* the ArrowUp journey to the floor */
const hFloorTrip = await journey(S_SEL, "ArrowUp", -1, GEO_MIN_H);
ok("the ArrowUp journey lands the FLOOR",
  hFloorTrip.ok === true && hFloorTrip.last?.now === GEO_MIN_H,
  `now=${hFloorTrip.last?.now} (from ${hBefore}; ${hFloorTrip.presses} real presses, ${hFloorTrip.healed} re-focuses, ${hFloorTrip.revivals} revivals)`);
ok("the valuetext FLIPPED to the height floor face", hFloorTrip.last?.text === hFloorFace, `text=${JSON.stringify(hFloorTrip.last?.text)}`);

const hHold1 = await pressHeal(S_SEL, "ArrowUp", (v) => v.now === GEO_MIN_H);
const hHold2 = await pressHeal(S_SEL, "ArrowUp", (v) => v.now === GEO_MIN_H);
ok("extra shrinking presses are EATEN at the height floor", hHold2?.now === GEO_MIN_H, `now=${hHold2?.now}`);
ok("the height floor face HOLDS", hHold2?.text === hFloorFace, `text=${JSON.stringify(hHold2?.text)}`);
shot("t997-height-floor-face.png");

/* the ArrowDown journey to the ceiling */
const hCeilTrip = await journey(S_SEL, "ArrowDown", +1, H_CEIL);
ok("the ArrowDown journey lands the CEILING (vh-16)",
  hCeilTrip.ok === true && hCeilTrip.last?.now === H_CEIL,
  `now=${hCeilTrip.last?.now} expected=${H_CEIL} (${hCeilTrip.presses} real presses, ${hCeilTrip.healed} re-focuses, ${hCeilTrip.revivals} revivals)`);
ok("the valuetext FLIPPED to the height ceiling face", hCeilTrip.last?.text === hCeilFace, `text=${JSON.stringify(hCeilTrip.last?.text)}`);
ok("the S valuenow MEETS the valuemax at the ceiling", hCeilTrip.last?.now === hCeilTrip.last?.max, `now=${hCeilTrip.last?.now} max=${hCeilTrip.last?.max}`);
const hCHold1 = await pressHeal(S_SEL, "ArrowDown", (v) => v.now === H_CEIL);
const hCHold2 = await pressHeal(S_SEL, "ArrowDown", (v) => v.now === H_CEIL);
ok("extra growing presses are EATEN at the height ceiling", hCHold2?.now === H_CEIL, `now=${hCHold2?.now}`);
ok("the height ceiling face HOLDS", hCHold2?.text === hCeilFace, `text=${JSON.stringify(hCHold2?.text)}`);
shot("t997-height-ceiling-face.png");

/* LEG 4 — the leave-no-trace close */
console.log("leg 4: the leave-no-trace close (the echo rests, the shape is erased)");
await sleep(700); // the debounced echo lands (the t638 law's keyboard form)
evalJs(geoBefore?.raw
  ? `localStorage.setItem(${JSON.stringify(GEO_KEY)}, ${JSON.stringify(geoBefore.raw)}); 'restored'`
  : `localStorage.removeItem(${JSON.stringify(GEO_KEY)}); 'cleared'`);
const rawAfter = evalJson(`(() => JSON.stringify({ raw: localStorage.getItem(${JSON.stringify(GEO_KEY)}) }))()`);
ok("the stored geometry is exactly as the walk found it (the leave-no-trace law)",
  rawAfter?.raw === (geoBefore?.raw ?? null));

/* the close: the companion's real door (the t797 law) */
let closeClick = await realClick(`document.querySelector('[aria-label="关闭 AI 助手"]')`);
if (String(closeClick) === "NO-ELEMENT") {
  const stillUp = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ up: !!p && p.getBoundingClientRect().width > 0 }); })()`);
  if (stillUp?.up === true) {
    await sleep(700);
    closeClick = await realClick(`document.querySelector('[aria-label="关闭 AI 助手"]')`);
    ok("the companion closes through its real door (after one honest re-locate)", String(closeClick).startsWith("clicked"), String(closeClick));
  } else {
    ok("the companion closes through its real door (the panel was already gone — recorded)", true, "pre-shut");
  }
} else {
  ok("the companion closes through its real door", String(closeClick).startsWith("clicked"), String(closeClick));
}
const shut = await poll(
  `(() => { const t = document.querySelector('textarea[aria-label="Message the AI assistant"]'); return JSON.stringify({ gone: !t || t.getBoundingClientRect().width === 0 }); })()`,
  (v) => v.gone === true, 8, 400);
ok("the panel is shut (no textarea ghost)", shut?.gone === true);

/* the receipt — the kit's finish */
finish({
  contract: "the keyboard road's value plane speaks — the human shape, the floor and ceiling refusal faces, the valuemax's other half; the walls were walked live (the self-healing press) and the walk erased its own footprint",
  legs: {
    viewport: vp ?? null,
    eGrip: { before: wBefore ?? null, floorFace: wFloorFace, ceiling: W_CEIL, floorTrip: { presses: wFloorTrip.presses, healed: wFloorTrip.healed, revivals: wFloorTrip.revivals }, ceilTrip: { presses: wCeilTrip.presses, healed: wCeilTrip.healed, revivals: wCeilTrip.revivals }, atCeil: wCeilTrip.last ?? null },
    sGrip: { before: hBefore ?? null, floorFace: hFloorFace, ceiling: H_CEIL, floorTrip: { presses: hFloorTrip.presses, healed: hFloorTrip.healed, revivals: hFloorTrip.revivals }, ceilTrip: { presses: hCeilTrip.presses, healed: hCeilTrip.healed, revivals: hCeilTrip.revivals }, atCeil: hCeilTrip.last ?? null },
    echoAsFound: geoBefore?.raw ?? null,
  },
});
