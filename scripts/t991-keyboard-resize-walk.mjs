#!/usr/bin/env node
/**
 * t991 — the KEYBOARD-RESIZE WITNESS WALK (the kit's FIRST legs-only
 * file — every organ rides scripts/walk-kit.mjs; the legs below are the
 * walk's own story): the resize grips' keyboard road, born this window.
 *
 * THE LEGS:
 *   1. the wide-first fresh open (the kit's wideFirst: viewport 1440 900,
 *      the alive poll, the companion shut);
 *   2. the E separator's keyboard resize — the companion opens through
 *      its real door, the east grip is a real separator now (vertical,
 *      named, tabbable, valuenow speaking the live width); focus rides
 *      the keyboard road (el.focus(), the Tab-equivalent); three
 *      ArrowRight presses grow the window +48px through the SAME
 *      clampGeo the pointer drag rides; three ArrowLeft presses restore
 *      the width byte-identically; the raise rides the steps (the panel
 *      is body.lastElementChild); the valuenow tracks the live shape;
 *   3. the S separator's keyboard resize — the same story on the
 *      vertical axis (ArrowDown ×3 / ArrowUp ×3, ±48px);
 *   4. the debounced echo — the t638 law's keyboard form: after the
 *      presses REST, the shape lands in localStorage ONCE (GEO_KEY's
 *      width matches the live window); the restore re-echoes; the
 *      walk leaves the stored geometry exactly as it found it.
 *
 * RIDE LAWS: server-first (kit-enforced); poll-then-probe; the
 * companion closes through its real door (the t797 law); the walk
 * witnesses and exits honest.
 *
 *   node scripts/t991-keyboard-resize-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, shot,
  serverFirst, wideFirst, finish,
} = createWalk({ name: "t991-keyboard-resize-walk", receiptFile: "t991-keyboard-resize-walk.json" });

const GEO_KEY = "cryoflow.assistant.geometry.v1";

console.log("=== t991 keyboard-resize witness walk ===");

/* LEG 1 — the wide-first fresh open (the kit's opening) */
console.log("leg 1: the wide-first fresh open");
await serverFirst();
const opened = await wideFirst();
if (!opened) { console.log("FATAL: the world never rendered"); process.exit(2); }

/* the stored geometry, captured BEFORE any leg rides (the leave-no-trace
   law: the walk restores the echo exactly as it found it) */
const geoBefore = evalJson(`(() => JSON.stringify({ raw: localStorage.getItem(${JSON.stringify(GEO_KEY)}) }))()`);

/* LEG 2 — the E separator's keyboard resize */
console.log("leg 2: the E separator (the width axis, keyboard-stepped)");
const doorClick = await realClick(`document.querySelector('[aria-label="AI assistant"]')`);
ok("the companion opens through its real door", String(doorClick).startsWith("clicked"), String(doorClick));
const panelUp = await poll(
  `(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ up: !!p && p.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.up === true, 12, 500);
ok("the companion panel is up (the resize target exists)", !!panelUp && panelUp.up);

const eSep = await poll(
  `(() => { const s = document.querySelector('[data-companion-window] [role="separator"][aria-orientation="vertical"]'); return JSON.stringify({ live: !!s, label: s ? s.getAttribute('aria-label') : null, tabbable: s ? s.tabIndex === 0 : null, valuenow: s ? Number(s.getAttribute('aria-valuenow')) : null }); })()`,
  (v) => v.live === true, 12, 500);
ok("the E grip is a real separator now (vertical, named, tabbable)",
  !!eSep && eSep.live === true && eSep.tabbable === true,
  eSep ? `label=${JSON.stringify(eSep.label)}` : "");
ok("the E separator names the keyboard road", eSep?.label === "调整助手窗口宽度（左右方向键）", JSON.stringify(eSep?.label));

const wBefore = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ w: parseFloat(p?.style?.width ?? "NaN") }); })()`);
ok("the live width is readable before the keys", !!wBefore && Number.isFinite(wBefore.w), `w=${wBefore?.w}`);
ok("the valuenow speaks the live width at rest", eSep?.valuenow === wBefore?.w, `valuenow=${eSep?.valuenow} w=${wBefore?.w}`);

evalJs(`(() => { const s = document.querySelector('[data-companion-window] [role="separator"][aria-orientation="vertical"]'); if (s) s.focus(); return s ? 'focused' : 'none'; })()`);
const focusW = evalJson(`(() => JSON.stringify({ active: document.activeElement?.getAttribute('aria-orientation') ?? null, role: document.activeElement?.getAttribute('role') ?? null }))()`);
ok("the E separator holds focus (the keyboard road is open)", focusW?.active === "vertical" && focusW?.role === "separator", JSON.stringify(focusW));

for (let i = 0; i < 3; i++) { sh(`${AB} press ArrowRight`); await sleep(250); }
const wGrown = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); const s = p?.querySelector('[role="separator"][aria-orientation="vertical"]'); return JSON.stringify({ w: parseFloat(p?.style?.width ?? "NaN"), valuenow: s ? Number(s.getAttribute('aria-valuenow')) : null }); })()`);
ok("THREE ArrowRight presses grew the window +48px (the same clamp rides)",
  !!wGrown && Math.abs(wGrown.w - (wBefore.w + 48)) <= 1,
  `w ${wBefore.w} → ${wGrown?.w}`);
ok("the valuenow tracked the growth live", wGrown?.valuenow === wGrown?.w, `valuenow=${wGrown?.valuenow}`);
const raised = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ last: !!p && document.body.lastElementChild === p }); })()`);
ok("the raise rode the keyboard step (the panel leads, the t990 law's keyboard form)", raised?.last === true);

for (let i = 0; i < 3; i++) { sh(`${AB} press ArrowLeft`); await sleep(250); }
const wBack = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ w: parseFloat(p?.style?.width ?? "NaN") }); })()`);
ok("THREE ArrowLeft presses restored the width byte-identically",
  !!wBack && Math.abs(wBack.w - wBefore.w) <= 1, `w=${wBack?.w}`);
shot("t991-keyresize-width.png");

/* LEG 3 — the S separator's keyboard resize (the height axis) */
console.log("leg 3: the S separator (the height axis, keyboard-stepped)");
const sSep = evalJson(`(() => { const s = document.querySelector('[data-companion-window] [role="separator"][aria-orientation="horizontal"]'); return JSON.stringify({ live: !!s, label: s ? s.getAttribute('aria-label') : null, tabbable: s ? s.tabIndex === 0 : null, valuenow: s ? Number(s.getAttribute('aria-valuenow')) : null }); })()`);
ok("the S grip is a real separator too (horizontal, named, tabbable)",
  !!sSep && sSep.live === true && sSep.tabbable === true,
  sSep ? `label=${JSON.stringify(sSep.label)}` : "");
ok("the S separator names the keyboard road", sSep?.label === "调整助手窗口高度（上下方向键）", JSON.stringify(sSep?.label));

const hBefore = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); const s = p?.querySelector('[role="separator"][aria-orientation="horizontal"]'); return JSON.stringify({ h: parseFloat(p?.style?.height ?? "NaN"), valuenow: s ? Number(s.getAttribute('aria-valuenow')) : null }); })()`);
ok("the S separator's valuenow speaks the live height at rest", sSep?.valuenow === hBefore?.h, `valuenow=${sSep?.valuenow} h=${hBefore?.h}`);

evalJs(`(() => { const s = document.querySelector('[data-companion-window] [role="separator"][aria-orientation="horizontal"]'); if (s) s.focus(); return s ? 'focused' : 'none'; })()`);
for (let i = 0; i < 3; i++) { sh(`${AB} press ArrowDown`); await sleep(250); }
const hGrown = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); const s = p?.querySelector('[role="separator"][aria-orientation="horizontal"]'); return JSON.stringify({ h: parseFloat(p?.style?.height ?? "NaN"), valuenow: s ? Number(s.getAttribute('aria-valuenow')) : null }); })()`);
ok("THREE ArrowDown presses grew the window +48px",
  !!hGrown && Math.abs(hGrown.h - (hBefore.h + 48)) <= 1, `h ${hBefore.h} → ${hGrown?.h}`);
ok("the S valuenow tracked the growth live", hGrown?.valuenow === hGrown?.h, `valuenow=${hGrown?.valuenow}`);

for (let i = 0; i < 3; i++) { sh(`${AB} press ArrowUp`); await sleep(250); }
const hBack = evalJson(`(() => { const p = document.querySelector('[data-companion-window]'); return JSON.stringify({ h: parseFloat(p?.style?.height ?? "NaN") }); })()`);
ok("THREE ArrowUp presses restored the height byte-identically",
  !!hBack && Math.abs(hBack.h - hBefore.h) <= 1, `h=${hBack?.h}`);
shot("t991-keyresize-height.png");

/* LEG 4 — the debounced echo (the t638 law's keyboard form) */
console.log("leg 4: the debounced echo (the shape lands when the hand rests)");
const restW = wBack?.w ?? wBefore?.w;
const rawRest = evalJson(`(() => JSON.stringify({ raw: localStorage.getItem(${JSON.stringify(GEO_KEY)}) }))()`);
const restGeo = rawRest?.raw ? JSON.parse(rawRest.raw) : null;
const restMatched = restGeo ? Math.abs((restGeo.w ?? -999) - restW) <= 1 : false;
ok("the echo landed after the presses rested (GEO_KEY's width matches the live window)",
  restMatched, restGeo ? `stored w=${restGeo.w} live w=${restW}` : "no stored geo");

/* the leave-no-trace law: the stored geometry is restored exactly as
   the walk found it (the value or its absence) */
evalJs(geoBefore?.raw
  ? `localStorage.setItem(${JSON.stringify(GEO_KEY)}, ${JSON.stringify(geoBefore.raw)}); 'restored'`
  : `localStorage.removeItem(${JSON.stringify(GEO_KEY)}); 'cleared'`);
const rawAfter = evalJson(`(() => JSON.stringify({ raw: localStorage.getItem(${JSON.stringify(GEO_KEY)}) }))()`);
ok("the stored geometry is exactly as the walk found it (the leave-no-trace law)",
  rawAfter?.raw === (geoBefore?.raw ?? null));

/* the close: the companion's real door (the t797 law). One retry with
 * an honesty read: NO-ELEMENT on the door means either the panel is
 * already gone (the close is moot — recorded, not judged) or the door
 * was mid-render (one re-locate). The panelShut poll stays the gate
 * either way. */
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
  contract: "the keyboard resize road's first live witness — the window-splitter cure, the kit's first legs-only file",
  legs: {
    eSep: eSep ?? null,
    sSep: sSep ?? null,
    width: { before: wBefore?.w ?? null, grown: wGrown?.w ?? null, back: wBack?.w ?? null },
    height: { before: hBefore?.h ?? null, grown: hGrown?.h ?? null, back: hBack?.h ?? null },
    echoRest: restGeo ?? null,
  },
});
