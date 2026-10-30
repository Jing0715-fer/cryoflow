#!/usr/bin/env node
/**
 * t1001 — the DIRTY-DRAFT WALK (the second census's cure, witnessed
 * live): the second dirty-draft census swept the family's text doors
 * with the mount-model dimension and found TWO real silent survivors —
 * the bookmark popover's name field (the canvas never unmounts, the
 * close kept the draft) and the help guide's search (the dialog body
 * never unmounts, nothing reset the query). Both are cured this
 * window; this walk rides the cures through THREE doors, each proving
 * the same law live: type a draft, close through the door, reopen,
 * read the input EMPTY.
 *
 *   leg 0   the shell bed rolls (the server, the world's fingerprint);
 *   leg 1   the wide-first opening; the companion shut (the t797 law);
 *   leg 2   THE BOOKMARK ESCAPE DOOR: the bookmarks popover opens
 *           through its trigger, the name input reads EMPTY as-found,
 *           the draft typed AND PROVEN LANDED (the t1000 birth law
 *           (b)), Escape peels the Radix popover layer, the popover
 *           reopens — the input reads EMPTY (the mouth's witness);
 *   leg 3   THE BOOKMARK TOGGLE DOOR: the draft typed again, the
 *           TRIGGER real-clicked a second time (the Radix toggle —
 *           the same onOpenChange(false) mouth, a different hand),
 *           the popover reopens — the input reads EMPTY again. The
 *           Save button is NEVER clicked (no bookmark is minted — the
 *           success path's riders are pinned by the unit's Q4, not
 *           ridden here: saving is not closing, and a saved view would
 *           be a world asset);
 *   leg 4   THE GUIDE DOOR: the help popover opens through its header
 *           button, "Read the full guide" real-clicks, the guide
 *           dialog hosts the search input, the query typed AND PROVEN
 *           LANDED, Escape peels the dialog, the guide reopens through
 *           the same two real doors — the search reads EMPTY (the
 *           open-reset's witness: a fresh open owns a fresh lens);
 *   leg 5   world honesty: the fingerprint as-found = as-left
 *           (NOTHING minted — no bookmark saved, no job touched), the
 *           server stands at 200.
 *
 * RIDE LAWS: WIDE-FIRST; the companion shut; real clicks everywhere;
 * poll-then-probe; every read is SCOPED to the surface that hosts the
 * input (the popover panel / the open dialog — never a page-wide
 * guess); the draft must be PROVEN LANDED before the EMPTY read means
 * anything (the t1000 birth law (b)).
 *
 *   node scripts/t1001-dirty-draft-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, pollTraced, realClick,
  shot, readJobs, jobsArr, fingerprint, serverFirst, finish,
} = createWalk({ name: "t1001-dirty-draft-walk", receiptFile: "t1001-dirty-draft-walk.json" });

const DRAFT = "Dirty Draft (t1001)";
const QUERY = "cluster";

/* realClick eats a JS EXPRESSION, never a bare selector (the t1000
 * birth law (a) — the kit's `const el = (${findExpr})` wrapper parses
 * a bare selector as an assignment). Every finder returns the element
 * or null. */
const TRIGGER = `(() => { const el = document.querySelector('[data-canvas-ui="viewport-bookmarks-trigger"]'); return el && el.getBoundingClientRect().width > 0 ? el : null; })()`;
const HELP_BTN = `(() => { const el = document.querySelector('[aria-label="Help — how to use the workflow canvas"]'); return el && el.getBoundingClientRect().width > 0 ? el : null; })()`;
const GUIDE_CTA = `(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === 'Read the full guide' && x.getBoundingClientRect().width > 0); return b ?? null; })()`;

/* the bookmark popover's scoped reader — the panel that hosts the
 * name input (the family's scoping law) */
const bmState = `(() => { const p = document.querySelector('[data-canvas-ui="viewport-bookmarks-panel"]'); if (!p || p.getBoundingClientRect().width === 0) return JSON.stringify({ up: false }); const i = p.querySelector('[data-canvas-ui="viewport-bookmark-input"]'); return JSON.stringify({ up: true, value: i ? i.value : null }); })()`;

/* the guide dialog's scoped reader — the OPEN dialog that hosts the
 * search input */
const guideState = `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.getBoundingClientRect().width > 0 && x.querySelector('input[aria-label="Filter the help guide"]')); if (!d) return JSON.stringify({ up: false }); const i = d.querySelector('input[aria-label="Filter the help guide"]'); const sections = d.querySelectorAll('section[aria-label$=" guide"]').length; return JSON.stringify({ up: true, value: i ? i.value : null, sections }); })()`;

/* the guide's scoped input finder (the same scoping law as the reader) */
const GUIDE_INPUT = `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.getBoundingClientRect().width > 0 && x.querySelector('input[aria-label="Filter the help guide"]')); return d ? d.querySelector('input[aria-label="Filter the help guide"]') : null; })()`;

/* the bookmark popover's scoped input finder */
const BM_INPUT = `document.querySelector('[data-canvas-ui="viewport-bookmark-input"]')`;

/* the type-then-PROVE-landed organ (the t1000 birth law (b)): focus
 * the scoped input, type, poll the value back — three attempts */
const typeProve = async (stateExpr, selExpr, text) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const f = evalJson(`(() => { const i = (${selExpr}); if (!i) return JSON.stringify({ f: false }); i.focus(); return JSON.stringify({ f: document.activeElement === i }); })()`);
    if (f && f.f === true) {
      sh(`${AB} keyboard type ${JSON.stringify(text)}`);
      await sleep(400);
      const v = evalJson(stateExpr);
      if (v && v.up === true && v.value === text) return v;
    }
    await sleep(400);
  }
  return null;
};

console.log("=== t1001 dirty-draft walk ===");

/* LEG 0 — the shell bed rolls */
console.log("leg 0: the shell bed rolls");
serverFirst();
const body = await readJobs();
const arr = jobsArr(body);
const asFound = fingerprint(arr);
ok("the world carries SIXTEEN jobs (the t1075 replant re-key — the t979 world's steady census: 3 starter + nine standing faces + the t978 rider world of four; the t1003 22-world's db died in the epoch rollback and the t979 replant is the successor)", arr.length === 16, `rows=${arr.length}`);

/* LEG 1 — the wide-first opening */
console.log("leg 1: the opening (wide-first, the companion shut)");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(`(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`, (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const shut = await poll(
  `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
  (x) => x.shut, 4, 400);
ok("the companion is shut (the ride plane is clear)", !!shut && shut.shut);

/* LEG 2 — THE BOOKMARK ESCAPE DOOR */
console.log("leg 2: the bookmark popover's Escape door (type → Escape → reopen → EMPTY)");
const t1 = await realClick(TRIGGER);
ok("the bookmarks trigger real-clicked", String(t1).startsWith("clicked@"), String(t1));
const bm1 = await pollTraced(bmState, (v) => v.up === true, 12, 500, "popover");
ok("THE BOOKMARKS POPOVER OPENS (the panel hosts the name input)", !!bm1 && bm1.up === true, JSON.stringify(bm1));
ok("the as-found input is EMPTY (a clean popover at birth)", !!bm1 && bm1.value === "", `value=${JSON.stringify(bm1?.value)}`);
const typed1 = await typeProve(bmState, BM_INPUT, DRAFT);
ok("the draft typed AND PROVEN LANDED (the t1000 birth law (b))", !!typed1 && typed1.value === DRAFT, `value=${JSON.stringify(typed1?.value)}`);
shot("t1001-bookmark-draft.png");
sh(`${AB} press Escape`);
await sleep(600);
const gone2 = await poll(bmState, (v) => v && v.up === false, 12, 500);
ok("THE POPOVER CLOSED THROUGH THE ESCAPE DOOR (the Radix layer peels)", !!gone2 && gone2.up === false);
await realClick(TRIGGER);
const bm2 = await pollTraced(bmState, (v) => v.up === true, 12, 500, "reopen1");
ok("the popover reopened", !!bm2 && bm2.up === true, JSON.stringify(bm2));
ok("THE ESCAPE DOOR KEEPS NO DRAFT (the input reads EMPTY — the mouth's witness)",
  !!bm2 && bm2.value === "", `value=${JSON.stringify(bm2?.value)}`);
shot("t1001-bookmark-after-escape.png");

/* LEG 3 — THE BOOKMARK TOGGLE DOOR */
console.log("leg 3: the bookmark popover's toggle door (type → the trigger again → reopen → EMPTY)");
const typed2 = await typeProve(bmState, BM_INPUT, `${DRAFT} II`);
ok("the draft typed AND PROVEN LANDED", !!typed2 && typed2.value === `${DRAFT} II`, `value=${JSON.stringify(typed2?.value)}`);
const t2 = await realClick(TRIGGER);
ok("the trigger real-clicked again (the Radix toggle — the same mouth, a different hand)",
  String(t2).startsWith("clicked@"), String(t2));
const gone3 = await poll(bmState, (v) => v && v.up === false, 12, 500);
ok("THE POPOVER CLOSED THROUGH THE TOGGLE DOOR", !!gone3 && gone3.up === false);
await realClick(TRIGGER);
const bm3 = await pollTraced(bmState, (v) => v.up === true, 12, 500, "reopen2");
ok("the popover reopened", !!bm3 && bm3.up === true, JSON.stringify(bm3));
ok("THE TOGGLE DOOR KEEPS NO DRAFT (the input reads EMPTY again)",
  !!bm3 && bm3.value === "", `value=${JSON.stringify(bm3?.value)}`);
sh(`${AB} press Escape`);
await sleep(400);
const bmShut = await poll(bmState, (v) => v && v.up === false, 8, 400);
ok("the popover closed by its own Escape (the ride plane restored)", !!bmShut && bmShut.up === false);

/* LEG 4 — THE GUIDE DOOR */
console.log("leg 4: the guide dialog's Escape door (type → Escape → reopen → EMPTY)");
const h1 = await realClick(HELP_BTN);
ok("the help button real-clicked", String(h1).startsWith("clicked@"), String(h1));
const ctaUp = await poll(`(() => JSON.stringify({ up: !!(${GUIDE_CTA}) }))()`, (v) => v.up, 10, 400);
ok("the help popover hosts the guide CTA", !!ctaUp && ctaUp.up);
const c1 = await realClick(GUIDE_CTA);
ok("the guide CTA real-clicked (the popover's own door to the manual)",
  String(c1).startsWith("clicked@"), String(c1));
const gd1 = await pollTraced(guideState, (v) => v.up === true, 16, 500, "guide");
ok("THE GUIDE DIALOG OPENS (the dialog hosts the search input)", !!gd1 && gd1.up === true, JSON.stringify(gd1));
ok("the as-found search is EMPTY (a fresh lens at birth)", !!gd1 && gd1.value === "", `value=${JSON.stringify(gd1?.value)}`);
const typed3 = await typeProve(guideState, GUIDE_INPUT, QUERY);
ok("the query typed AND PROVEN LANDED (the lens narrows the chapters)",
  !!typed3 && typed3.value === QUERY && typed3.sections > 0 && typed3.sections < 6,
  `value=${JSON.stringify(typed3?.value)} sections=${typed3?.sections}`);
shot("t1001-guide-draft.png");
sh(`${AB} press Escape`);
await sleep(600);
const gone4 = await poll(guideState, (v) => v && v.up === false, 12, 500);
ok("THE GUIDE CLOSED THROUGH THE ESCAPE DOOR", !!gone4 && gone4.up === false);
await realClick(HELP_BTN);
await poll(`(() => JSON.stringify({ up: !!(${GUIDE_CTA}) }))()`, (v) => v.up, 10, 400);
await realClick(GUIDE_CTA);
const gd2 = await pollTraced(guideState, (v) => v.up === true, 16, 500, "reopen-guide");
ok("the guide reopened through the same two real doors", !!gd2 && gd2.up === true, JSON.stringify(gd2));
ok("THE GUIDE DOOR KEEPS NO QUERY (the search reads EMPTY — a fresh open owns a fresh lens)",
  !!gd2 && gd2.value === "", `value=${JSON.stringify(gd2?.value)}`);
shot("t1001-guide-after-escape.png");
sh(`${AB} press Escape`);
await sleep(500);
const gdShut = await poll(guideState, (v) => v && v.up === false, 8, 400);
ok("the guide closed by its own Escape (the Radix layer's honest door)", !!gdShut && gdShut.up === false);

/* LEG 5 — world honesty */
console.log("leg 5: the world's honesty");
const bodyLeft = await readJobs();
const arrLeft = jobsArr(bodyLeft);
const asLeft = fingerprint(arrLeft);
ok("the world carries SIXTEEN jobs as-left (NOTHING minted — the Save button was never clicked; the t1075 replant re-key)",
  arrLeft.length === 16, `rows=${arrLeft.length}`);
ok("THE FINGERPRINT AS-FOUND = AS-LEFT (byte-identical)", asFound === asLeft);
const closeCode = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 5 ${BASE}/`).trim();
ok("the server stands at 200 at the shell (the close gate)", closeCode === "200", `code=${closeCode}`);

finish({
  draft: DRAFT,
  query: QUERY,
  doors: ["bookmark-escape", "bookmark-toggle", "guide-escape"],
});
