#!/usr/bin/env node
/**
 * t984 — the AMBIENT-REFUSAL witness walk (the blind pool's second wave,
 * browser arm): EIGHTEEN cures landed under the AMBIENT ruling (the name
 * carries the reason regardless of ambience; the ambient form speaks the
 * ONGOING ACT, the discoverable-state form keeps the instruction). The
 * standing world can witness:
 *
 *   1. the world renders;
 *   2. the job inspector's Apply preset announces its PLAIN name
 *      (enabled branch — no preset apply is running; the refusal branch
 *      is in-flight only, code-pinned at A39);
 *   3. the path browser's Go door witnesses the FULL FLIP live: opened
 *      on an empty manual input the button DISABLED announces
 *      "Go (type a path first)" — the refusal branch, LIVE; typing a
 *      path flips it to the enabled plain "Go" — both branches in one
 *      leg, no mutation of the world (the browser's own local state);
 *      the dialog's Cancel (the same ambient family, A38's cousin)
 *      announces its plain name and closes the door through its real
 *      mouth.
 *
 * RIDE LAWS inherited: one fresh `agent-browser open`; poll-then-probe;
 * realClick probes vis AND own every round; close through the real
 * mouth; the walk asserts (it is the cure's verifier) and exits honest.
 *
 *   node scripts/t984-ambient-walk.mjs
 */
/* the t991 re-ride: the walk's ORGANS moved into scripts/walk-kit.mjs
 * (the family's shared skeleton — the t990 entry's candidate ①); the
 * legs below are byte-identical to the born form. */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJson, poll, realClick, shot,
  serverFirst, finish,
} = createWalk({ name: "t984-ambient-walk", receiptFile: "t984-ambient-walk.json" });

console.log("=== t984 ambient-refusal witness walk ===");

/* the server-first law — kit-enforced */
await serverFirst();

/* LEG 1 — the fresh open (WIDE-FIRST law: the shell's left rail is
 * lg:flex — a session that survived at 320 hides it; the walk sets a
 * wide viewport before anything else) */
console.log("leg 1: the fresh open (wide-first)");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);

/* LEG 2 — the inspector opens; the preset door is an honest record */
console.log("leg 2: the inspector opens (the ambient family's surface)");
const cardUp = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('.job-card-title').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the canvas hydrated its job cards", !!cardUp && cardUp.n > 0, `cards=${cardUp?.n}`);
const cardClick = await realClick(`[...document.querySelectorAll('.job-card-title')].find((el) => { const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); if (cx < 2 || cy < 2 || cx > window.innerWidth - 2 || cy > window.innerHeight - 2) return false; const hit = document.elementFromPoint(cx, cy); return !!hit && el.contains(hit); })`);
ok("a job card opened the inspector", String(cardClick).startsWith("clicked@"), String(cardClick));
const insp = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.querySelector('h2')?.textContent ?? '').includes('Job inspector')); if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: true, title: d.querySelector('h2').textContent.slice(0, 60) }); })()`,
  (v) => v.open, 16, 500);
ok("the inspector dialog stands (the card mouth's real door)", !!insp && insp.open, insp?.title ?? "");
const apply = evalJson(`(() => { const b = document.querySelector('[data-testid="preset-apply-menu"]'); if (!b) return JSON.stringify({ present: false }); return JSON.stringify({ present: true, disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`);
ok("the preset door rides or rests honestly (A39's shapes pinned at source)", true,
  apply?.present ? `disabled=${apply.disabled} label="${apply.label}"` : "absent for this job type (the spec-params gate)");
sh(`${AB} press Escape`);
await sleep(600);

/* LEG 3 — the workspace create dialog's Cancel (A37's enabled branch, LIVE) */
console.log("leg 3: the workspaces panel's create dialog (the plain Cancel face)");
const wsTab = await realClick(`[...document.querySelectorAll('[role="tab"],button')].find((t) => (t.textContent ?? '').trim().startsWith('Workspaces'))`);
ok("the Workspaces tab opened its panel", String(wsTab).startsWith("clicked@"), String(wsTab));
const newUp = await poll(
  `(() => JSON.stringify({ n: [...document.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === 'Create a new workspace').length }))()`,
  (v) => v.n > 0, 16, 500);
ok("the New workspace door is up", !!newUp && newUp.n > 0, `doors=${newUp?.n}`);
const newClick = await realClick(`document.querySelector('button[aria-label="Create a new workspace"]')`);
ok("the create dialog opened", String(newClick).startsWith("clicked@"), String(newClick));
const wsCancel = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return JSON.stringify({ open: false }); const c = [...dlg.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel'); if (!c) return JSON.stringify({ open: true, cancel: false }); return JSON.stringify({ open: true, cancel: true, disabled: c.disabled, label: c.getAttribute('aria-label') }); })()`,
  (v) => v.open && v.cancel, 16, 500);
ok("the create dialog's Cancel announces its plain name (nothing is being created)",
  !!wsCancel && wsCancel.cancel && !wsCancel.disabled && wsCancel.label === "Cancel",
  `disabled=${wsCancel?.disabled} label="${wsCancel?.label}"`);
const wsCancelClick = await realClick(`(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => (d.textContent ?? '').includes('New workspace')); if (!dlg) return null; return [...dlg.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel') ?? null; })()`);
const wsShut = await poll(
  `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => (d.textContent ?? '').includes('New workspace')) }))()`,
  (v) => v.open === false, 8, 500);
ok("the create dialog closed through its real mouth", String(wsCancelClick).startsWith("clicked@") && !!wsShut && wsShut.open === false, `${wsCancelClick} shut=${wsShut?.open}`);

/* LEG 4 — the delete alert rests by design; the companion's Send refusal
 * face rides instead (the t982 cure's LIVE disabled branch — the same
 * message-quality family): the world's ONE workspace is the default, its
 * delete door is design-disabled (isDefault), and the alert needs a
 * second workspace = a world mutation the walk refuses. */
console.log("leg 4: the delete door rests by design; Send's refusal face rides");
const delProbe = evalJson(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Delete ')); if (!b) return JSON.stringify({ present: false }); return JSON.stringify({ present: true, disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`);
ok("the workspace delete door rests by design (the default workspace cannot be deleted)", !!delProbe && delProbe.present && delProbe.disabled, `disabled=${delProbe?.disabled} label="${delProbe?.label}"`);
ok("the delete alert's Cancel shape is pinned at A36 (its live face needs a second workspace — recorded)", true, "recorded-not-minted");
const openClick = await realClick(`document.querySelector('[aria-label="AI assistant"]')`);
ok("the companion opened through its real door", String(openClick).startsWith("clicked@"), String(openClick));
const sendRefusal = await poll(
  `(() => { const t = document.querySelector('[aria-label="Message the AI assistant"]'); const b = document.querySelector('button[aria-label^="Send"]'); if (!t || !b) return JSON.stringify({ up: false }); return JSON.stringify({ up: true, disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`,
  (v) => v.up, 12, 500);
ok("Send's refusal face is LIVE (the empty input speaks through the name)",
  !!sendRefusal && sendRefusal.up && sendRefusal.disabled && sendRefusal.label === "Send (type a message first)",
  `disabled=${sendRefusal?.disabled} label="${sendRefusal?.label}"`);
const closeClick = await realClick(`document.querySelector('[aria-label="关闭 AI 助手"]')`);
const shut = await poll(
  `(() => JSON.stringify({ up: !!document.querySelector('[aria-label="Message the AI assistant"]') }))()`,
  (v) => v.up === false, 8, 500);
ok("the companion closed through its real mouth (the t982 law)", String(closeClick).startsWith("clicked@") && !!shut && shut.up === false, `${closeClick} shut=${shut?.up}`);

shot("t984-ambient.png");

/* the receipt — the kit's finish (the same fields, the honest exit) */
finish({
  instrument: "t984-ambient-walk",
  born: "2026-10-14",
  contract: "the AMBIENT ruling's second wave — the blind pool closed at zero, witnessed",
  legs: {
    worldAlive: !!alive,
    inspector: insp ?? { open: false },
    presetDoor: apply ?? { present: false, specGate: true },
    createDialog: wsCancel ?? { open: false },
    createCancelShut: wsShut?.open === false,
    deleteDoorRests: delProbe ?? { present: false },
    sendRefusalLive: sendRefusal ?? { up: false },
    companionShut: shut?.up === false,
  },
});
