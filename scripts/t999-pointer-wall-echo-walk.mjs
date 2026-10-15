#!/usr/bin/env node
/**
 * t999 — the POINTER WALL ECHO walk (the t999 entry's candidate ①,
 * carried): the resize grips' POINTER road, witnessed live — a real
 * mouse drag parks at the clamp floor and the wall's word appears in
 * the live region; the same drag parks at the ceiling and the other
 * wall speaks; a mid-range park adds NO word (the hand saw it follow);
 * and the grip's own valuetext AGREES with the echo at every park (the
 * one-mouth law, live — two roads, one voice):
 *
 *   leg 0  the as-found honesty (the API is the judge): FIFTEEN
 *          jobs (the t1002 adoption re-key — the fork line's fresh
 *          chain), the fingerprint banked, the stored geometry's raw
 *          echo captured (the leave-no-trace law's bank);
 *   leg 1  the wide-first fresh open (the kit's opening — 1440×900,
 *          the ceiling is the clampGeo formula's, read live);
 *   leg 2  the companion opens through its real door; the E grip is
 *          live; the as-found width is read off the valuenow; the
 *          at-rest valuetext speaks the AGREEMENT (mid-range → the
 *          human shape; at a wall → that wall's face);
 *   leg 3  THE FLOOR DRAG — a real drag (down at the grip, one honest
 *          move past the wall, up) parks the width at 360: the echo
 *          speaks 已到最小宽度（360 像素）, the valuenow lands on 360,
 *          and the grip's own valuetext says the SAME words;
 *   leg 4  THE CEILING DRAG — the drag parks at vw−16: the echo speaks
 *          已到最大宽度（1424 像素）, the valuenow MEETS the valuemax,
 *          the valuetext agrees;
 *   leg 5  THE MID PARK — a drag ending mid-range adds NO word (the
 *          echo holds the ceiling's words) while the valuetext returns
 *          to the human shape — only the refusal is news;
 *   leg 6  the leave-no-trace close — the stored geometry's raw echo
 *          restored exactly as found (or cleared if never there), the
 *          companion shut through its real door (the t797 law), the
 *          jobs fingerprint as-found = as-left.
 *
 * RIDE LAWS inherited: the kit's wide-first opening; poll-then-probe;
 * real mouse paths (down/move/up — the t990 drag grammar); the stored
 * geometry is the walk's ONLY persistence footprint and it is restored
 * verbatim; the walk asserts and exits honest.
 *
 *   node scripts/t999-pointer-wall-echo-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, shot,
  readJobs, jobsArr, fingerprint, serverFirst, wideFirst, finish,
} = createWalk({ name: "t999-pointer-wall-echo-walk", receiptFile: "t999-pointer-wall-echo-walk.json" });

const GEO_KEY = "cryoflow.assistant.geometry.v1";
const GEO_MIN_W = 360;
const E_SEL = '[data-companion-window] [role="separator"][aria-orientation="vertical"]';
const ECHO_SEL = `(() => { const e = document.querySelector('[data-wall-echo]'); return e ? (e.textContent ?? "").trim() : null; })()`;

/* the E grip's live read (valuenow / valuetext / valuemax) */
const readE = `(() => { const s = document.querySelector('${E_SEL}'); const a = document.activeElement; return JSON.stringify({ live: !!s, now: s ? Number(s.getAttribute('aria-valuenow')) : null, text: s ? s.getAttribute('aria-valuetext') : null, max: s && s.getAttribute('aria-valuemax') !== null ? Number(s.getAttribute('aria-valuemax')) : null, focused: a === s }); })()`;
/* the E grip's center point (re-read before EVERY drag — the panel moves) */
const gripPoint = `(() => { const s = document.querySelector('${E_SEL}'); if (!s) return JSON.stringify({ up: false }); const r = s.getBoundingClientRect(); const x = Math.round(r.x + r.width / 2); const y = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(x, y); return JSON.stringify({ up: true, x, y, own: !!hit && s.contains(hit) }); })()`;

const dragGripBy = async (dx) => {
  const p = evalJson(gripPoint);
  if (!p || !p.up || !p.own) return null;
  sh(`${AB} mouse move ${p.x} ${p.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse move ${p.x + dx} ${p.y}`);
  sh(`${AB} mouse up`);
  return p;
};

console.log("=== t999 pointer-wall-echo walk ===");

/* the server-first law — kit-enforced */
await serverFirst();

/* LEG 0 — the as-found honesty captures */
console.log("leg 0: the as-found world");
const jobs0 = await readJobs();
const arr0 = jobsArr(jobs0 ?? {});
ok("the as-found world carries FIFTEEN jobs (the t1002 adoption re-key)", arr0.length === 15, `rows=${arr0.length}`);
const fp0 = fingerprint(arr0);
ok("the fingerprint banked (non-empty)", fp0.length > 0, `chars=${fp0.length}`);
const geoBefore = evalJson(`(() => JSON.stringify({ raw: localStorage.getItem(${JSON.stringify(GEO_KEY)}) }))()`);

/* LEG 1 — the wide-first fresh open */
console.log("leg 1: the fresh open (wide-first)");
const opened = await wideFirst();
if (!opened) { console.log("FATAL: the world never rendered"); process.exit(2); }
const vp = evalJson(`(() => JSON.stringify({ vw: window.innerWidth, vh: window.innerHeight }))()`);
ok("the viewport is the kit's wide-first (1440 900)", vp?.vw === 1440 && vp?.vh === 900, JSON.stringify(vp));
const W_CEIL = Math.max(vp.vw - 16, GEO_MIN_W);

/* LEG 2 — the companion opens; the as-found width; the AGREEMENT */
console.log("leg 2: the companion opens (the at-rest agreement)");
const doorClick = await realClick(`document.querySelector('[aria-label="AI assistant"]')`);
ok("the companion opens through its real door", String(doorClick).startsWith("clicked"), String(doorClick));
const eSep = await poll(readE, (v) => v.live === true && v.now !== null, 12, 500);
ok("the E grip is live and its valuenow speaks", !!eSep && eSep.live === true, eSep ? `now=${eSep.now}` : "");
const w0 = eSep?.now;
const humanW = (n) => `宽度 ${n} 像素`;
const expectedRest = w0 <= GEO_MIN_W
  ? `已到最小宽度（${GEO_MIN_W} 像素）`
  : w0 >= W_CEIL
    ? `已到最大宽度（${W_CEIL} 像素）`
    : humanW(w0);
ok("the at-rest valuetext speaks the AGREEMENT (the builder's word for wherever the world parks)",
  eSep?.text === expectedRest, `text="${eSep?.text}" expected="${expectedRest}"`);

/* LEG 3 — THE FLOOR DRAG */
console.log("leg 3: the floor drag (the wall's word arrives)");
const floorDx = -(w0 - GEO_MIN_W) - 60; // one honest move PAST the wall — the clamp eats it
const floorDrag = await dragGripBy(floorDx);
ok("the floor drag's real mouse path landed", !!floorDrag, `from=${floorDrag?.x},${floorDrag?.y} dx=${floorDx}`);
const floorEcho = await poll(ECHO_SEL, (v) => v === `已到最小宽度（${GEO_MIN_W} 像素）`, 12, 400);
ok("THE ECHO SPEAKS THE FLOOR — 已到最小宽度（360 像素）in the live region", floorEcho === `已到最小宽度（${GEO_MIN_W} 像素）`, `echo="${floorEcho}"`);
const floorRead = await poll(readE, (v) => v.live && v.now === GEO_MIN_W, 12, 400);
ok("the width landed on the floor (360) and the grip's own face AGREES (one mouth, live)",
  !!floorRead && floorRead.now === GEO_MIN_W && floorRead.text === `已到最小宽度（${GEO_MIN_W} 像素）`,
  `now=${floorRead?.now} text="${floorRead?.text}"`);
shot("t999-echo-floor.png");

/* LEG 4 — THE CEILING DRAG */
console.log("leg 4: the ceiling drag (the other wall speaks)");
const ceilDx = W_CEIL - GEO_MIN_W + 60; // from the floor, one honest move PAST the ceiling
const ceilDrag = await dragGripBy(ceilDx);
ok("the ceiling drag's real mouse path landed", !!ceilDrag, `from=${ceilDrag?.x},${ceilDrag?.y} dx=${ceilDx}`);
const ceilEcho = await poll(ECHO_SEL, (v) => v === `已到最大宽度（${W_CEIL} 像素）`, 12, 400);
ok(`THE ECHO SPEAKS THE CEILING — 已到最大宽度（${W_CEIL} 像素）in the live region`, ceilEcho === `已到最大宽度（${W_CEIL} 像素）`, `echo="${ceilEcho}"`);
const ceilRead = await poll(readE, (v) => v.live && v.now === W_CEIL, 12, 400);
ok("the width MEETS the valuemax at the ceiling and the grip's face AGREES",
  !!ceilRead && ceilRead.now === W_CEIL && ceilRead.max === W_CEIL && ceilRead.text === `已到最大宽度（${W_CEIL} 像素）`,
  `now=${ceilRead?.now} max=${ceilRead?.max} text="${ceilRead?.text}"`);
shot("t999-echo-ceiling.png");

/* LEG 5 — THE MID PARK (only the refusal is news) */
console.log("leg 5: the mid park (the plain shape adds no word)");
const midDx = -200;
const midDrag = await dragGripBy(midDx);
ok("the mid drag's real mouse path landed", !!midDrag, `from=${midDrag?.x},${midDrag?.y} dx=${midDx}`);
await sleep(600); // the gesture's end settles (the echo's moment)
const midEcho = evalJson(ECHO_SEL);
const midRead = await poll(readE, (v) => v.live && v.text === humanW(W_CEIL - 200), 12, 400);
ok("THE MID PARK ADDS NO WORD — the echo holds the ceiling's face, the valuetext returns to the human shape",
  midEcho === `已到最大宽度（${W_CEIL} 像素）` && !!midRead && midRead.text === humanW(W_CEIL - 200),
  `echo="${midEcho}" text="${midRead?.text}"`);

/* LEG 6 — the leave-no-trace close */
console.log("leg 6: the leave-no-trace close (the echo rests, the shape is erased)");
evalJs(geoBefore?.raw
  ? `localStorage.setItem(${JSON.stringify(GEO_KEY)}, ${JSON.stringify(geoBefore.raw)}); 'restored'`
  : `localStorage.removeItem(${JSON.stringify(GEO_KEY)}); 'cleared'`);
const rawAfter = evalJson(`(() => JSON.stringify({ raw: localStorage.getItem(${JSON.stringify(GEO_KEY)}) }))()`);
ok("the stored geometry is exactly as the walk found it (the leave-no-trace law)",
  rawAfter?.raw === (geoBefore?.raw ?? null));

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

const jobs6 = await readJobs();
const arr6 = jobsArr(jobs6 ?? {});
const fp6 = fingerprint(arr6);
ok("the jobs fingerprint as-found = as-left (a resize moves no job)", fp6 === fp0, `rows=${arr6.length}`);
shot("t999-world-restored.png");

/* the receipt — the kit's finish */
finish({
  instrument: "t999-pointer-wall-echo-walk",
  born: "2026-10-15",
  contract: "the pointer road's wall echo witnessed live — the floor and ceiling drags speak the builders' words through the live region, the mid park adds no word, the grip's valuetext agrees at every park (one mouth), the stored geometry restored verbatim",
  legs: {
    viewport: vp ?? null,
    asFoundWidth: w0 ?? null,
    floor: { echo: floorEcho ?? null, now: floorRead?.now ?? null, agreed: floorRead?.text === `已到最小宽度（${GEO_MIN_W} 像素）` },
    ceiling: { echo: ceilEcho ?? null, now: ceilRead?.now ?? null, max: ceilRead?.max ?? null, agreed: ceilRead?.text === `已到最大宽度（${W_CEIL} 像素）` },
    midPark: { echoUnchanged: midEcho === `已到最大宽度（${W_CEIL} 像素）`, text: midRead?.text ?? null },
    storedEcho: { asFound: geoBefore?.raw ?? null, asLeft: rawAfter?.raw ?? null, restored: rawAfter?.raw === (geoBefore?.raw ?? null) },
    worldRestored: fp6 === fp0,
  },
});
