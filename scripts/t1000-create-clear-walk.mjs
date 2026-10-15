#!/usr/bin/env node
/**
 * t1000 — the CREATE-CLEAR WALK (the dirty-Cancel cure's live witness,
 * the t999 entry's candidate ③ carried):
 *
 * The workspace create dialog kept a dirty draft on every close path
 * except success. The cure (the one-mouth law's dialog form): EVERY
 * close path — the Cancel button, Escape, the X — routes through
 * `closeCreate`, which clears the draft and closes the dialog; the
 * success path rides the same door. This walk witnesses all THREE
 * manual doors live: type a draft, close through the door, reopen, and
 * read the input EMPTY — three times, one per door. No workspace is
 * ever created (the Create button is never clicked; the create API is
 * never called — the world's population count stays true without a
 * re-key, the t992 birth law (c)).
 *
 *   leg 0   the shell bed rolls (the server, the world's fingerprint);
 *   leg 1   the wide-first opening; the LEFT aside's Workspaces tab
 *           opens through the real pointer path (the BL2 law — tabs
 *           answer only a real pointer event); the New button
 *           ("Create a new workspace") real-clicks; the dialog hosts
 *           the name input; the input autofocuses EMPTY (the as-found);
 *   leg 2   THE CANCEL DOOR: the draft typed ("Dirty Draft (t1000)"),
 *           the dialog-scoped Cancel real-clicked, the dialog gone,
 *           reopened — the input reads EMPTY;
 *   leg 3   THE ESCAPE DOOR: the draft typed, Escape pressed (the
 *           Radix layer peels exactly one layer — the t501 fallback
 *           guard), the dialog gone, reopened — the input reads EMPTY;
 *   leg 4   THE X DOOR: the draft typed, the dialog-content's own close
 *           button ([data-slot="dialog-close"], the shadcn X —
 *           showCloseButton defaults true) real-clicked, the dialog
 *           gone, reopened — the input reads EMPTY;
 *   leg 5   world honesty: the dialog closed by its own Escape, the
 *           fingerprint as-found = as-left (NOTHING minted), the
 *           server stands at 200.
 *
 * RIDE LAWS: WIDE-FIRST; the companion shut; the BL2 tab door; real
 * clicks everywhere; poll-then-probe; the dialog reads are SCOPED to
 * the open dialog content (never a page-wide guess); the session tab
 * latch is session state (as-found ≠ as-left is the BL2 precedent —
 * the fingerprint is unaffected).
 *
 *   node scripts/t1000-create-clear-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, pollTraced, realClick,
  shot, api, readJobs, jobsArr, fingerprint, serverFirst, finish, phaseTrace,
} = createWalk({ name: "t1000-create-clear-walk", receiptFile: "t1000-create-clear-walk.json" });

const DRAFT = "Dirty Draft (t1000)";
/* realClick eats a JS EXPRESSION, never a bare selector (the red-1
 * lesson: `button[aria-label=...]` parses as an assignment inside the
 * kit's `const el = (...)` wrapper — Invalid left-hand side). */
const NEW_BTN = `(() => { const btns = [...document.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === 'Create a new workspace' && b.getBoundingClientRect().width > 0); return btns[0] ?? null; })()`;
const INPUT_SEL = `#new-workspace-name`;

/* the dialog-scoped readers — every read is scoped to the OPEN dialog
 * that hosts the name input (the family's scoping law) */
const dlgState = `(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => d.getBoundingClientRect().width > 0 && d.querySelector(${JSON.stringify(INPUT_SEL)})); if (!dlg) return JSON.stringify({ up: false }); const input = dlg.querySelector(${JSON.stringify(INPUT_SEL)}); const title = dlg.querySelector('[data-slot="dialog-title"]'); return JSON.stringify({ up: true, value: input ? input.value : null, title: title ? (title.textContent ?? '').trim() : null }); })()`;

const tabOf = `(() => { const tabs = [...document.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim().startsWith('Workspaces') && b.getBoundingClientRect().width > 0); return tabs[0] ?? null; })()`;

const typeDraft = async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const f = evalJson(`(() => { const i = document.querySelector(${JSON.stringify(INPUT_SEL)}); if (!i) return JSON.stringify({ f: false }); i.focus(); return JSON.stringify({ f: document.activeElement === i }); })()`);
    if (f && f.f === true) {
      sh(`${AB} keyboard type ${JSON.stringify(DRAFT)}`);
      await sleep(400);
      const v = evalJson(dlgState);
      if (v && v.up === true && v.value === DRAFT) return true;
    }
    await sleep(400);
  }
  return false;
};

const doorClose = async (doorExpr, label) => {
  const preUp = await poll(dlgState, (v) => v && v.up === true, 8, 400);
  if (!preUp || preUp.up !== true) return { click: "NO-DIALOG", gone: false, clickRaw: "NO-DIALOG", label };
  const click = await realClick(doorExpr);
  const gone = await poll(dlgState, (v) => v && v.up === false, 12, 500);
  return { click: String(click).startsWith("clicked@"), gone: !!gone && gone.up === false, clickRaw: String(click), label };
};

console.log("=== t1000 create-clear walk ===");

/* LEG 0 — the shell bed rolls */
console.log("leg 0: the shell bed rolls");
serverFirst();
const body = await readJobs();
const arr = jobsArr(body);
const asFound = fingerprint(arr);
ok("the world carries TWENTY-TWO jobs (the standing fleet restored (the t1003 restoration — 15 demo + seven standing faces))", arr.length === 22, `rows=${arr.length}`);

/* LEG 1 — the wide-first opening + the Workspaces tab + the dialog */
console.log("leg 1: the opening (the Workspaces tab, the New button, the dialog)");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(`(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`, (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const shut = await poll(
  `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
  (x) => x.shut, 4, 400);
ok("the companion is shut (the ride plane is clear)", !!shut && shut.shut);
const tabClick = await realClick(tabOf);
ok("the Workspaces tab clicked through the real pointer path (the BL2 door)",
  String(tabClick).startsWith("clicked@"), String(tabClick));
const panelUp = await poll(`(() => JSON.stringify({ up: !!(${NEW_BTN}) }))()`, (v) => v.up, 12, 500);
ok("the WorkspacePanel answers (the New button is on screen)", !!panelUp && panelUp.up);
const newClick = await realClick(NEW_BTN);
ok("the New button clicked through the real mouse path", String(newClick).startsWith("clicked@"), String(newClick));
const dlgOpen = await pollTraced(dlgState, (v) => v.up && v.title === "New workspace", 16, 500, "dialog");
ok("THE CREATE DIALOG OPENS (the title reads New workspace)", !!dlgOpen && dlgOpen.up, JSON.stringify(dlgOpen));
ok("the as-found input is EMPTY (the autofocus on a clean draft)",
  !!dlgOpen && dlgOpen.value === "", `value=${JSON.stringify(dlgOpen?.value)}`);
shot("t1000-create-open.png");

/* LEG 2 — THE CANCEL DOOR */
console.log("leg 2: the Cancel door (type → Cancel → reopen → EMPTY)");
const typed1 = await typeDraft();
ok("the draft typed (the input carries the text)", typed1);
const cancelExpr = `(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => d.getBoundingClientRect().width > 0 && d.querySelector(${JSON.stringify(INPUT_SEL)})); if (!dlg) return null; return [...dlg.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Cancel')) ?? null; })()`;
const door2 = await doorClose(cancelExpr, "cancel");
ok("the Cancel real-clicked", door2.click, door2.clickRaw);
ok("THE DIALOG CLOSED THROUGH THE CANCEL DOOR", door2.gone);
const reopen1 = await realClick(NEW_BTN);
const open2 = await pollTraced(dlgState, (v) => v.up && v.title === "New workspace", 16, 500, "reopen1");
ok("the dialog reopened", !!open2 && open2.up && String(reopen1).startsWith("clicked@"), JSON.stringify(open2));
ok("THE CANCEL DOOR KEEPS NO DRAFT (the input reads EMPTY)",
  !!open2 && open2.value === "", `value=${JSON.stringify(open2?.value)}`);
shot("t1000-create-after-cancel.png");

/* LEG 3 — THE ESCAPE DOOR */
console.log("leg 3: the Escape door (type → Escape → reopen → EMPTY)");
const typed2 = await typeDraft();
ok("the draft typed (the input carries the text)", typed2);
sh(`${AB} press Escape`);
await sleep(600);
const gone3 = await poll(dlgState, (v) => v && v.up === false, 12, 500);
ok("THE DIALOG CLOSED THROUGH THE ESCAPE DOOR (the Radix layer peels exactly one layer)", !!gone3 && gone3.up === false);
await realClick(NEW_BTN);
const open3 = await pollTraced(dlgState, (v) => v.up && v.title === "New workspace", 16, 500, "reopen2");
ok("the dialog reopened", !!open3 && open3.up, JSON.stringify(open3));
ok("THE ESCAPE DOOR KEEPS NO DRAFT (the input reads EMPTY)",
  !!open3 && open3.value === "", `value=${JSON.stringify(open3?.value)}`);

/* LEG 4 — THE X DOOR */
console.log("leg 4: the X door (type → the dialog's own close → reopen → EMPTY)");
const typed3 = await typeDraft();
ok("the draft typed (the input carries the text)", typed3);
const xExpr = `(() => { const dlg = [...document.querySelectorAll('[data-slot="dialog-content"]')].find((d) => d.getBoundingClientRect().width > 0 && d.querySelector(${JSON.stringify(INPUT_SEL)})); if (!dlg) return null; return dlg.querySelector('[data-slot="dialog-close"]'); })()`;
const door4 = await doorClose(xExpr, "x");
ok("the X real-clicked", door4.click, door4.clickRaw);
ok("THE DIALOG CLOSED THROUGH THE X DOOR", door4.gone);
await realClick(NEW_BTN);
const open4 = await pollTraced(dlgState, (v) => v.up && v.title === "New workspace", 16, 500, "reopen3");
ok("the dialog reopened", !!open4 && open4.up, JSON.stringify(open4));
ok("THE X DOOR KEEPS NO DRAFT (the input reads EMPTY)",
  !!open4 && open4.value === "", `value=${JSON.stringify(open4?.value)}`);
shot("t1000-create-after-x.png");

/* LEG 5 — world honesty */
console.log("leg 5: the own-door closes + the world's honesty");
sh(`${AB} press Escape`);
await sleep(600);
const dlgGone = await poll(`(() => { const d = document.querySelector('[data-slot="dialog-content"]'); return JSON.stringify({ gone: !d || d.getBoundingClientRect().width === 0 }); })()`, (v) => v.gone, 8, 400);
ok("the dialog closed by its own Escape (the Radix layer's honest door)", !!dlgGone && dlgGone.gone);
const bodyLeft = await readJobs();
const arrLeft = jobsArr(bodyLeft);
const asLeft = fingerprint(arrLeft);
ok("the world carries TWENTY-TWO jobs as-left (NOTHING minted — the Create button was never clicked)", arrLeft.length === 22, `rows=${arrLeft.length}`);
ok("THE FINGERPRINT AS-FOUND = AS-LEFT (byte-identical)", asFound === asLeft);
const closeCode = sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 5 ${BASE}/`).trim();
ok("the server stands at 200 at the shell (the close gate)", closeCode === "200", `code=${closeCode}`);

finish({
  draft: DRAFT,
  doors: ["cancel", "escape", "x"],
  asFound,
  asLeft,
});
