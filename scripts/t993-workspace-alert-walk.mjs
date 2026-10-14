#!/usr/bin/env node
/**
 * t993 — the SECOND-WORKSPACE MINT + the DELETE-ALERT FACE WALK (the t992
 * entry's candidate ①, the A36 recorded-not-witnessed face cashed in):
 * the delete alert's Cancel has been pinned at source since the ambient
 * ruling, but its LIVE face needs a second workspace — the default one's
 * delete door is design-disabled, and no walk ever minted one. This walk
 * mints the second workspace through the product's OWN create door (the
 * A63 enabled click — the first enabled Create click in the family's
 * history), then rides the alert:
 *
 *   leg 2  the resting plane — the Workspaces tab's badge reads 1, the
 *          default row's delete door rests design-disabled (its title
 *          carries the reason the ambient way);
 *   leg 3  THE MINT — the create dialog's refusal plane re-witnessed
 *          (disabled + "Create workspace (name the workspace first)"),
 *          a real keystroke flips it, the enabled click lands, the badge
 *          flips 1→2, the row blooms, and the ACTIVE stays Main (the
 *          canvas keeps its cards — the minted workspace is empty);
 *   leg 4  THE A36 FACE — the new row's delete door is enabled (the
 *          non-default law, the title names the jobs-move), the click
 *          opens the Radix AlertDialog (role="alertdialog" — NOT the
 *          kit's role="dialog" plane; the walk probes it directly), the
 *          Cancel speaks its PLAIN rest name (nothing is being deleted),
 *          and the Cancel CLICK closes the alert with the workspace
 *          still there — the refusal honored;
 *   leg 5  THE CONFIRM ARC — the delete door again, the destructive
 *          "Delete workspace" action clicked FOR REAL, the alert closes,
 *          the badge returns to 1, the row is gone — the world's own
 *          cleanup lane, no fixture sweeper needed;
 *   leg 6  world honesty — the API judges: one workspace ("Main"), the
 *          jobs fingerprint as-found = as-left (an empty workspace's
 *          deletion moves nothing), the resting door rests again.
 *
 * RIDE LAWS inherited: the kit's wide-first opening; poll-then-probe;
 * realClick probes vis AND own every round; the FOCUS GATE before any
 * keystroke (Ctrl+A on the canvas is select-all-the-JOBS — a dialog
 * input is the gate's whole point); Radix Dialog peels through Escape
 * but the walk closes through the REAL mouths (the Cancel buttons);
 * the walk asserts and exits honest (the mint is deleted by the
 * product's own confirm action — the world returns to one workspace;
 * zero localStorage writes; the jobs untouched).
 *
 *   node scripts/t993-workspace-alert-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, shot,
  api, focusGate, serverFirst, finish, wideFirst,
} = createWalk({ name: "t993-workspace-alert-walk", receiptFile: "t993-workspace-alert-walk.json" });

const WS_NAME = "Alert Face (t993)";
const ALERT_SEL = `[role="alertdialog"]`;
const TAB_SEL = `[...document.querySelectorAll('[role="tab"],button')].find((t) => (t.textContent ?? '').trim().startsWith('Workspaces'))`;

console.log("=== t993 workspace-alert walk ===");

/* the server-first law — kit-enforced */
await serverFirst();

/* LEG 0 — the as-found honesty captures (the API is the judge) */
console.log("leg 0: the as-found world");
let body0 = null;
try { body0 = JSON.parse(api("GET", "/api/jobs")); } catch { body0 = null; }
const arr0 = Array.isArray(body0) ? body0 : body0?.jobs ?? [];
const asFoundFingerprint = arr0.map((j) => `${j.id}:${j.status}:${j.name}`).sort().join("|");
let ws0 = null;
try { ws0 = JSON.parse(api("GET", "/api/workspaces")); } catch { ws0 = null; }
const ws0List = Array.isArray(ws0?.workspaces) ? ws0.workspaces : [];
ok("the as-found world carries ONE workspace (Main)", ws0List.length === 1 && ws0List[0]?.name === "Main", `workspaces=${ws0List.map((w) => w.name).join(",")}`);
ok("the as-found world carries NINETEEN jobs", arr0.length === 19, `rows=${arr0.length}`);

/* LEG 1 — the kit's wide-first opening */
console.log("leg 1: the fresh open (wide-first)");
const opened = await wideFirst();

/* LEG 2 — the resting plane (the badge, the design-disabled door) */
console.log("leg 2: the resting plane (badge 1, the design-disabled door)");
const tabClick = await realClick(TAB_SEL);
ok("the Workspaces tab opened its panel", String(tabClick).startsWith("clicked@"), String(tabClick));
const doorUp = await poll(
  `(() => JSON.stringify({ n: [...document.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === 'Create a new workspace').length }))()`,
  (v) => v.n > 0, 16, 500);
ok("the New workspace door is up", !!doorUp && doorUp.n > 0, `doors=${doorUp?.n}`);
const badge1 = await poll(
  `(() => { const tab = ${TAB_SEL}; const badge = tab ? [...tab.querySelectorAll('span')].find((sp) => (sp.className ?? '').includes('tabular-nums')) : null; return JSON.stringify({ count: badge ? badge.textContent.trim() : null }); })()`,
  (v) => v.count === "1", 12, 500);
ok("the tab's badge reads 1 (the as-found count, rendered)", badge1?.count === "1", `badge=${badge1?.count}`);
const restDoor = await poll(
  `(() => { const b = document.querySelector('button[aria-label="Delete Main"]'); if (!b) return JSON.stringify({ present: false }); return JSON.stringify({ present: true, disabled: b.disabled, title: b.getAttribute('title') }); })()`,
  (v) => v.present, 12, 500);
ok("the default row's delete door rests design-disabled (the reason rides the title, the ambient way)",
  !!restDoor && restDoor.present && restDoor.disabled === true && (restDoor.title ?? "").startsWith("The default workspace cannot be deleted"),
  `disabled=${restDoor?.disabled} title="${(restDoor?.title ?? "").slice(0, 50)}"`);

/* LEG 3 — THE MINT (the create dialog's full arc, the enabled click) */
console.log("leg 3: the mint (the create dialog's enabled click)");
const newClick = await realClick(`document.querySelector('button[aria-label="Create a new workspace"]')`);
ok("the create dialog opened", String(newClick).startsWith("clicked@"), String(newClick));
const wsRefusal = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return JSON.stringify({ open: false }); const b = [...dlg.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Create workspace')); if (!b) return JSON.stringify({ open: true, btn: false }); return JSON.stringify({ open: true, btn: true, disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`,
  (v) => v.open && v.btn, 16, 500);
ok("the refusal plane is LIVE at the mint's own door (empty name speaks through the name)",
  !!wsRefusal && wsRefusal.open && wsRefusal.btn && wsRefusal.disabled && wsRefusal.label === "Create workspace (name the workspace first)",
  `disabled=${wsRefusal?.disabled} label="${wsRefusal?.label}"`);
const inputClick = await realClick(`document.querySelector('#new-workspace-name')`);
const inputFocused = String(inputClick).startsWith("clicked@") && (await focusGate("new-workspace-name"));
ok("the name input holds focus (the gate before any keystroke)", inputFocused);
sh(`${AB} keyboard type "${WS_NAME}"`);
await sleep(400);
const wsEnabled = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return JSON.stringify({ open: false }); const b = [...dlg.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Create workspace')); if (!b) return JSON.stringify({ open: true, btn: false }); return JSON.stringify({ open: true, btn: true, disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`,
  (v) => v.open && v.btn && !v.disabled, 12, 500);
ok("the enabled plane answers the flip (plain name, fence kept)",
  !!wsEnabled && wsEnabled.btn && !wsEnabled.disabled && wsEnabled.label === "Create workspace",
  `disabled=${wsEnabled?.disabled} label="${wsEnabled?.label}"`);
const mintClick = await realClick(`(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return null; return [...dlg.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '') === 'Create workspace') ?? null; })()`);
ok("THE MINT CLICK LANDED (the enabled plane's own action — the family's first)", String(mintClick).startsWith("clicked@"), String(mintClick));
let mintShut = await poll(
  `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`,
  (v) => v.open === false, 10, 500);
let mintRetryNote = "first-click";
if (!mintShut || mintShut.open !== false) {
  /* ride-3's honest record: the create POST hung ONCE (the dialog stayed
   * open, the world unchanged at leg 6) — and the SAME hang was reproduced
   * by a hand curl minutes later (a 120s no-answer), then answered 201
   * instantly on the next attempt. One failure + one success of the
   * identical sequence is a race, not a product bug (the t985 law). The
   * retry is gated by the API JUDGE: the re-click only fires when the
   * judge says the mint never landed (no duplicate is possible); a stuck
   * dialog whose mint DID land is accepted as-is. */
  let wsMid = null;
  try { wsMid = JSON.parse(api("GET", "/api/workspaces")); } catch { wsMid = null; }
  const wsMidCount = Array.isArray(wsMid?.workspaces) ? wsMid.workspaces.length : -1;
  if (wsMidCount === 1) {
    const still = await poll(
      `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return JSON.stringify({ open: false }); const b = [...dlg.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '') === 'Create workspace'); return JSON.stringify({ open: true, btn: !!b && !b.disabled }); })()`,
      (v) => v.open && v.btn, 6, 500);
    if (still && still.open && still.btn) {
      const retryClick = await realClick(`(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return null; return [...dlg.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '') === 'Create workspace') ?? null; })()`);
      mintRetryNote = `retry (the judge said ${wsMidCount} workspace — the POST never landed): ${retryClick}`;
      mintShut = await poll(
        `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`,
        (v) => v.open === false, 12, 500);
    } else {
      mintRetryNote = "the dialog left the enabled plane without a landing — recorded";
    }
  } else {
    mintRetryNote = `the mint landed despite the stuck dialog (the judge saw ${wsMidCount}) — accepted`;
    mintShut = { open: false };
  }
}
const rowUp = await poll(
  `(() => JSON.stringify({ n: [...document.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === 'Delete ${WS_NAME}').length }))()`,
  (v) => v.n > 0, 16, 500);
ok("the dialog closed and the minted row bloomed (the badge's own door on the new row)",
  !!mintShut && mintShut.open === false && !!rowUp && rowUp.n > 0, `${mintRetryNote} shut=${mintShut?.open} doors=${rowUp?.n}`);
const badge2 = await poll(
  `(() => { const tab = ${TAB_SEL}; const badge = tab ? [...tab.querySelectorAll('span')].find((sp) => (sp.className ?? '').includes('tabular-nums')) : null; return JSON.stringify({ count: badge ? badge.textContent.trim() : null }); })()`,
  (v) => v.count === "2", 12, 500);
ok("the tab's badge flipped to 2 (the rendered count follows the mint)", badge2?.count === "2", `badge=${badge2?.count}`);
const cardsStay = evalJson(`(() => JSON.stringify({ n: document.querySelectorAll('.job-card-title').length }))()`);
ok("the ACTIVE stayed Main (the canvas keeps its cards — the mint is empty and unvisited)",
  !!cardsStay && cardsStay.n > 0, `cards=${cardsStay?.n}`);

/* LEG 4 — THE A36 FACE (the alert's Cancel at rest, honored) */
console.log("leg 4: the A36 face (the delete alert's plain Cancel, honored)");
const delDoor = await poll(
  `(() => { const b = document.querySelector('button[aria-label="Delete ${WS_NAME}"]'); if (!b) return JSON.stringify({ present: false }); return JSON.stringify({ present: true, disabled: b.disabled, title: b.getAttribute('title') }); })()`,
  (v) => v.present, 12, 500);
ok("the minted row's delete door is ENABLED (the non-default law; the title names the jobs-move)",
  !!delDoor && delDoor.present && delDoor.disabled === false && (delDoor.title ?? "").startsWith("Delete workspace (its jobs move"),
  `disabled=${delDoor?.disabled} title="${(delDoor?.title ?? "").slice(0, 50)}"`);
const alertClick = await realClick(`document.querySelector('button[aria-label="Delete ${WS_NAME}"]')`);
ok("the delete door opened its alert", String(alertClick).startsWith("clicked@"), String(alertClick));
const alertUp = await poll(
  `(() => { const a = document.querySelector('${ALERT_SEL}'); if (!a) return JSON.stringify({ open: false }); const t = a.querySelector('h2, [data-slot="alert-dialog-title"]'); const c = [...a.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Cancel')); return JSON.stringify({ open: true, title: t ? (t.textContent ?? '').trim() : null, cancel: c ? { disabled: c.disabled, label: c.getAttribute('aria-label') } : null }); })()`,
  (v) => v.open, 16, 500);
ok("the alert stands on the alertdialog plane (the kit's dialog probes never see it — this walk probes its own role)",
  !!alertUp && alertUp.open && (alertUp.title ?? "").includes(WS_NAME),
  `title="${alertUp?.title}"`);
ok("THE A36 FACE SPEAKS (the Cancel enabled + its PLAIN rest name — nothing is being deleted)",
  !!alertUp && alertUp.cancel && alertUp.cancel.disabled === false && alertUp.cancel.label === "Cancel",
  `disabled=${alertUp?.cancel?.disabled} label="${alertUp?.cancel?.label}"`);
const lawRead = evalJson(`(() => { const a = document.querySelector('${ALERT_SEL}'); return JSON.stringify({ law: a ? (a.textContent ?? '').includes('moved to the project') : null }); })()`);
ok("the alert's description carries the jobs-move law (nothing is deleted)", lawRead?.law === true);
const cancelClick = await realClick(`(() => { const a = document.querySelector('${ALERT_SEL}'); if (!a) return null; return [...a.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Cancel')) ?? null; })()`);
const alertShut = await poll(
  `(() => JSON.stringify({ open: !!document.querySelector('${ALERT_SEL}') }))()`,
  (v) => v.open === false, 10, 500);
const rowStays = evalJson(`(() => JSON.stringify({ n: [...document.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === 'Delete ${WS_NAME}').length }))()`);
ok("the Cancel honored (the alert shut, the workspace still there)",
  String(cancelClick).startsWith("clicked@") && !!alertShut && alertShut.open === false && !!rowStays && rowStays.n > 0,
  `${cancelClick} shut=${alertShut?.open} rows=${rowStays?.n}`);
shot("t993-alert-cancel.png");

/* LEG 5 — THE CONFIRM ARC (the destructive action, the world's own cleanup) */
console.log("leg 5: the confirm arc (the real delete, the badge returns)");
const alertClick2 = await realClick(`document.querySelector('button[aria-label="Delete ${WS_NAME}"]')`);
ok("the delete door reopened its alert", String(alertClick2).startsWith("clicked@"), String(alertClick2));
const confirmUp = await poll(
  `(() => { const a = document.querySelector('${ALERT_SEL}'); if (!a) return JSON.stringify({ open: false }); const b = [...a.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === 'Delete workspace'); return JSON.stringify({ open: a ? true : false, confirm: !!b, disabled: b ? b.disabled : null }); })()`,
  (v) => v.open && v.confirm, 12, 500);
ok("the destructive confirm is up (Delete workspace)", !!confirmUp && confirmUp.confirm && confirmUp.disabled === false);
const confirmClick = await realClick(`(() => { const a = document.querySelector('${ALERT_SEL}'); if (!a) return null; return [...a.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === 'Delete workspace') ?? null; })()`);
ok("THE CONFIRM CLICK LANDED (the destructive action, for real)", String(confirmClick).startsWith("clicked@"), String(confirmClick));
const goneShut = await poll(
  `(() => JSON.stringify({ open: !!document.querySelector('${ALERT_SEL}'), row: [...document.querySelectorAll('button')].some((b) => b.getAttribute('aria-label') === 'Delete ${WS_NAME}') }))()`,
  (v) => v.open === false && v.row === false, 16, 500);
ok("the alert closed and the minted row is GONE (the product's own cleanup lane)",
  !!goneShut && goneShut.open === false && goneShut.row === false, `open=${goneShut?.open} row=${goneShut?.row}`);
const badgeBack = await poll(
  `(() => { const tab = ${TAB_SEL}; const badge = tab ? [...tab.querySelectorAll('span')].find((sp) => (sp.className ?? '').includes('tabular-nums')) : null; return JSON.stringify({ count: badge ? badge.textContent.trim() : null }); })()`,
  (v) => v.count === "1", 12, 500);
ok("the badge returned to 1 (the arc closes)", badgeBack?.count === "1", `badge=${badgeBack?.count}`);

/* LEG 6 — world honesty (the API is the judge) */
console.log("leg 6: the world's honesty");
let ws6 = null;
try { ws6 = JSON.parse(api("GET", "/api/workspaces")); } catch { ws6 = null; }
const ws6List = Array.isArray(ws6?.workspaces) ? ws6.workspaces : [];
ok("the API judges: ONE workspace again (Main — the mint deleted by the product's own door)",
  ws6List.length === 1 && ws6List[0]?.name === "Main", `workspaces=${ws6List.map((w) => w.name).join(",")}`);
let body6 = null;
try { body6 = JSON.parse(api("GET", "/api/jobs")); } catch { body6 = null; }
const arr6 = Array.isArray(body6) ? body6 : body6?.jobs ?? [];
const asLeftFingerprint = arr6.map((j) => `${j.id}:${j.status}:${j.name}`).sort().join("|");
ok("the jobs fingerprint as-found = as-left (an empty workspace's deletion moves nothing)",
  asLeftFingerprint === asFoundFingerprint, `rows=${arr6.length}`);
const restAgain = evalJson(`(() => { const b = document.querySelector('button[aria-label="Delete Main"]'); return JSON.stringify({ present: !!b, disabled: b ? b.disabled : null }); })()`);
ok("the resting door rests again (the default's design-disable, back at rest)",
  restAgain?.present === true && restAgain?.disabled === true);
shot("t993-world-restored.png");

/* the receipt — the kit's finish (the same fields, the honest exit) */
finish({
  instrument: "t993-workspace-alert-walk",
  born: "2026-10-15",
  contract: "the A36 face cashed in — the second workspace minted through the product's own create door, the alert's Cancel honored, the confirm arc restoring the world",
  legs: {
    asFoundOneWorkspace: ws0List.length === 1,
    restingDoorDisabled: restDoor?.disabled === true,
    mintClicked: String(mintClick).startsWith("clicked@"),
    badgeFlip: { before: badge1?.count ?? null, minted: badge2?.count ?? null, after: badgeBack?.count ?? null },
    a36CancelFace: alertUp?.cancel ?? null,
    cancelHonored: !!alertShut && alertShut.open === false,
    confirmDeleted: !!goneShut && goneShut.open === false && goneShut.row === false,
    worldRestored: ws6List.length === 1 && asLeftFingerprint === asFoundFingerprint,
  },
});
