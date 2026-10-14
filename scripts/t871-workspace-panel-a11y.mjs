#!/usr/bin/env node
/**
 * t871 — the WORKSPACE PANEL's faces: the ws-orphan law's own surface
 * (the aside's "workspaces" tab, src/components/workflow/workspace-panel.tsx),
 * the rotation's next un-walked room, walked live with the SHARED RULER.
 *
 * The rotation: ... -> text preview (t868) -> find bar (t870) -> THIS page.
 *
 * The surface (Radix Tabs inside the left aside; the panel unmounts on
 * tab leave, so the clean room is real):
 *
 *   O   the clean room — the catalog tab's boot: no [data-ws-header]
 *       before the door (the panel is summoned, never resident).
 *   T   the tab door — mousedown on the workspaces TabsTrigger (the t863
 *       Radix law); the panel arrives: the "Workspaces" header + count,
 *       the "Create a new workspace" door named, the list region named
 *       with its t803 keyboard stop (tabIndex 0), the row as a REAL
 *       keyboard citizen (role=button + tabIndex 0 + aria-current +
 *       Enter/Space), the Rename/Delete doors named per workspace, the
 *       stats chips honest, zero unnamed page-wide.
 *   R   the rename seat — "Rename Main" opens the inline edit (the input
 *       named "Workspace name", autoFocus -> takes focus, the value IS
 *       the world's word), Escape cancels WITHOUT a world write (the
 *       name is the census's own; the walk never renames the world).
 *   C   the create dialog — the named door opens "New workspace": the
 *       title, the label[for]-named input, the placeholder, the Create
 *       door HONESTLY DISABLED on an empty name, then "QA Second Room"
 *       typed through the React setter, the door enabled, the commit:
 *       the dialog closes, the row arrives (the header count 2).
 *   S   the switch walk — the new row takes aria-current and the canvas
 *       EMPTIES (the second workspace is a fresh canvas: pageBtns
 *       drops), the Main row takes it back and the canvas returns
 *       bit-for-bit. The world write is real; so is the return.
 *   D   the delete seat — "Delete QA Second Room" opens the AlertDialog
 *       (the title speaks the name, the description speaks the
 *       moved-not-deleted contract, Cancel + "Delete workspace" named),
 *       the confirm: the row leaves (the count 1), the world restored.
 *   W   the world back — the catalog tab again, the canvas count
 *       bit-for-bit, zero unnamed, no dialogs, and the seed hygiene
 *       (W2). The walk leaves ONE workspace named Main — the census's
 *       ws-orphan law holds by construction.
 *
 * The ledger aboard from birth (three faces: wsPanel / createDialog /
 * worldBack — the t861 birthright). The settle carries the t869 arrival
 * guard and, where the face fetches data, the t871 arrival predicate.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t871-workspace-panel-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t871 workspace-panel a11y walk — world ${world.mode}:${buildId}, the ws-orphan law's own surface through the shared ruler\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* ---------- the measures. The WORLD measure films the whole page; the
 * PANEL measure films the panel's own seats; the DIALOG measure films
 * whatever dialog is up. NO ${} inside — the shell reads these strings. */
const WORLD_MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const dlg = document.querySelector("[role=dialog], [role=alertdialog]"); const wsHeader = document.querySelector("[data-ws-header]"); return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 4).map((b) => String(b.className).slice(0, 44)), hasDlg: !!dlg, wsPanelUp: !!wsHeader, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const PANEL_MEASURE =
  '(() => { ' + NAMEOF + ' const header = document.querySelector("[data-ws-header]"); const list = document.querySelector("[aria-label=Workspaces]"); const newDoor = document.querySelector("button[aria-label=\\"Create a new workspace\\"]"); const renameDoors = Array.from(document.querySelectorAll("button[aria-label^=\\"Rename \\"]")).map((b) => b.getAttribute("aria-label")); const deleteDoors = Array.from(document.querySelectorAll("button[aria-label^=\\"Delete \\"]")).map((b) => b.getAttribute("aria-label")); /* t871 lens-cure: the rows are the LIST\'s role=button divs — the page\'s other role=button divs (the canvas job cards) are not rows; the greedy count filmed 16 (1 row + 15 job cards) */ const rowCount = header && list ? list.querySelectorAll("div[role=button]").length : 0; const active = document.querySelector("div[role=button][aria-current=true]"); const count = header ? (header.querySelector("span.tabular-nums") || {}).textContent : null; return JSON.stringify({ pageBtns: document.querySelectorAll("button").length, pageUnnamed: Array.from(document.querySelectorAll("button")).filter((b) => !nameOf(b)).length, panelUp: !!header, headerText: header ? (header.textContent || "").trim().slice(0, 30) : null, count, newDoor: !!newDoor, listNamed: list ? list.getAttribute("aria-label") : null, listTabbable: list ? list.tabIndex === 0 : null, rows: rowCount, activeRow: active ? { named: !!nameOf(active), current: active.getAttribute("aria-current"), name: ((active.querySelector("p") || {}).textContent || "").trim() } : null, renameDoors, deleteDoors }); })()';

/* t871 lens-cure: 80 chars cut the moved-not-deleted contract's tail — the world spoke more than the lens heard; the slice now reads the whole word (220) */
const DIALOG_MEASURE =
  '(() => { ' + NAMEOF + ' const dlg = document.querySelector("[role=dialog], [role=alertdialog]"); if (!dlg) return JSON.stringify({ up: false }); const ip = dlg.querySelector("input"); const btns = Array.from(dlg.querySelectorAll("button")).map((b) => ({ name: nameOf(b), disabled: b.disabled })); const act = document.activeElement; return JSON.stringify({ up: true, isAlert: dlg.getAttribute("role") === "alertdialog", pageBtns: document.querySelectorAll("button").length, title: ((dlg.querySelector("[class*=title], h2, [data-slot=dialog-title], [data-slot=alert-dialog-title]") || (dlg.querySelector("h2") || {}))).textContent ? (dlg.querySelector("h2") ? dlg.querySelector("h2").textContent.trim() : "") : (dlg.textContent || "").slice(0, 60), desc: ((dlg.querySelector("[data-slot=dialog-description], [data-slot=alert-dialog-description], p")) || {}).textContent ? (dlg.querySelector("[data-slot=dialog-description], [data-slot=alert-dialog-description], p").textContent || "").trim().slice(0, 220) : null, ip: ip ? { named: !!nameOf(ip), labelFor: ip.id ? !!document.querySelector(\'label[for="\' + ip.id + \'"]\') : false, value: ip.value, focused: act === ip } : null, btns, unnamed: btns.filter((b) => !b.name).length, focusIn: dlg.contains(act) }); })()';

const seedRead = () =>
  evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');

/* t871 — the canvas's own truth: the JOB CARD count (the role=button divs
 * outside the workspace list). History- and tab-agnostic — the undo
 * affordance and the aside's tab content cannot move it. The switch walk
 * asserts on THIS, not on pageBtns (the ride-5 lesson: the create pushes
 * an undo entry whose affordance adds exactly one button until the
 * switch clears the history — 95 vs 94 was the history speaking, not the
 * canvas). */
const cardCount = () =>
  evalJson('(() => { const cards = Array.from(document.querySelectorAll("div[role=button]")).filter((el) => !el.closest("[aria-label=Workspaces]")); return JSON.stringify({ cards: cards.length }); })()');

/* the settle: the t869 arrival guard (a stable blank is not a settled
 * world) + the t871 arrival predicate (a skeleton is not a settled face). */
const settleW = (what, maxIter = 16, need = 2, arrival = null) => {
  let m = evalJson(WORLD_MEASURE);
  let run = 1;
  for (let i = 0; i < maxIter; i++) {
    sleep(1);
    const next = evalJson(WORLD_MEASURE);
    const alive = next.pageBtns > 0;
    const arrived = arrival ? arrival(next) : true;
    const same = alive && arrived && JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need) break;
  }
  console.log(`  settled ${what} (${need}x stable)`);
  return m;
};

const ESC_ALL =
  '(() => { const d = document.querySelector("[role=dialog], [role=alertdialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* ---------- Face O: the clean room ---------- */
console.log("Face O — the clean room (the catalog tab's boot)");
ab(`open ${BASE}`);
sleep(3);
const c1 = settleW("the canvas");
const OPEN = c1.pageBtns;
const CARDS_OPEN = cardCount().cards;
ok("O0 the panel is absent before the door (summoned by the tab, never resident)",
  c1.wsPanelUp === false && c1.pageUnnamed === 0 && !c1.hasDlg,
  `pageBtns=${OPEN}`);

/* ---------- Face T: the tab door + the panel's seats ---------- */
console.log("Face T — the tab door (the t863 Radix law) and the panel's seats");
const tabR = evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => /Workspaces/.test((e.textContent || "").trim())); if (!t) return JSON.stringify({ found: false }); const r = t.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", opts)); t.dispatchEvent(new MouseEvent("mousedown", opts)); t.dispatchEvent(new PointerEvent("pointerup", opts)); t.dispatchEvent(new MouseEvent("mouseup", opts)); return JSON.stringify({ found: true, named: (t.textContent || "").trim().slice(0, 24) }); })()');
ok("T1 the workspaces tab found and pressed (mousedown door)", tabR.found === true, `trigger="${tabR.named || ""}"`);
sleep(2);
const w1 = settleW("the workspaces panel");
const p1 = evalJson(PANEL_MEASURE);
ok("T2 the panel arrived (the header speaks the room)", p1.panelUp === true && /Workspaces/.test(p1.headerText || ""), `header="${p1.headerText}"`);
ok("T3 the header count speaks the census (1 workspace in the canonical world)", p1.count === "1", `count=${JSON.stringify(p1.count)}`);
ok("T4 the Create door named (aria-label, not the visible New's crutch)", p1.newDoor === true, "");
ok("T5 the list region named with its t803 keyboard stop", p1.listNamed === "Workspaces" && p1.listTabbable === true, "");
ok("T6 the row is a real keyboard citizen (role=button, present, active)", p1.rows >= 1 && p1.activeRow && p1.activeRow.current === "true" && p1.activeRow.name === "Main", `rows=${p1.rows} active="${p1.activeRow ? p1.activeRow.name : null}"`);
ok("T7 the Rename/Delete doors named per workspace", p1.renameDoors.includes("Rename Main") && p1.deleteDoors.includes("Delete Main"), `rename=${JSON.stringify(p1.renameDoors)} delete=${JSON.stringify(p1.deleteDoors)}`);
ok("T8 zero unnamed page-wide with the panel up", p1.pageUnnamed === 0, `btns=${p1.pageBtns}`);

/* the row's keyboard door: Space on the active row is a no-op re-select that must not crash */
evalJson('(() => { const a = document.querySelector("div[role=button][aria-current=true]"); if (!a) return "no-row"; a.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); return "spaced"; })()');
sleep(1);
const w1b = settleW("the world after the row's Space");
ok("T9 the row's Space door re-selects without harm (the keyboard face works)",
  w1b.pageBtns === w1.pageBtns && w1b.wsPanelUp === true && w1b.pageUnnamed === 0,
  `btns=${w1b.pageBtns} (panel-up baseline ${w1.pageBtns})`);

/* ---------- Face R: the rename seat (open, assert, cancel — NO world write) ---------- */
console.log("Face R — the rename seat (the inline edit, cancelled)");
evalJson('(() => { const b = document.querySelector(\'button[aria-label="Rename Main"]\'); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
const r1 = evalJson(DIALOG_MEASURE);
/* the inline edit is NOT a dialog — measure the row's input directly */
const r1b = evalJson('(() => { ' + NAMEOF + ' const ip = document.querySelector(\'input[aria-label="Workspace name"]\'); return JSON.stringify({ up: !!ip, named: ip ? !!nameOf(ip) : false, value: ip ? ip.value : null, focused: ip ? document.activeElement === ip : null }); })()');
ok("R1 the inline edit arrived, named, focused, speaking the world's word",
  r1b.up === true && r1b.named === true && r1b.focused === true && r1b.value === "Main",
  `value=${JSON.stringify(r1b.value)}`);
evalJson('(() => { const ip = document.querySelector(\'input[aria-label="Workspace name"]\'); if (!ip) return "no-ip"; ip.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "escaped"; })()');
sleep(1);
const r2 = evalJson('(() => { return JSON.stringify({ inputGone: !document.querySelector(\'input[aria-label="Workspace name"]\') }); })()');
ok("R2 Escape cancelled the edit (no rename committed, no input left)", r2.inputGone === true, "");

/* ---------- Face C: the create dialog ---------- */
console.log("Face C — the create dialog (a real world write, the family's own door)");
evalJson('(() => { const b = document.querySelector(\'button[aria-label="Create a new workspace"]\'); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
const cd1 = evalJson(DIALOG_MEASURE);
ok("C1 the New workspace dialog arrived as the topmost layer, focus inside",
  cd1.up === true && cd1.isAlert === false && cd1.focusIn === true, "");
ok("C2 the input named through label[for] (the Name label's own seam)",
  cd1.ip && cd1.ip.named === true && cd1.ip.labelFor === true && cd1.ip.value === "",
  `named=${cd1.ip ? cd1.ip.named : null} labelFor=${cd1.ip ? cd1.ip.labelFor : null}`);
const createBtn = cd1.btns ? cd1.btns.find((b) => /Create workspace/.test(b.name || "")) : null;
ok("C3 the Create door HONESTLY DISABLED on an empty name",
  createBtn && createBtn.disabled === true,
  createBtn ? `disabled=${createBtn.disabled}` : "door missing");
evalJson('(() => { const ip = document.querySelector("#new-workspace-name"); if (!ip) return "no-ip"; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(ip, "QA Second Room"); ip.dispatchEvent(new Event("input", { bubbles: true })); return "typed"; })()');
sleep(1);
const cd2 = evalJson(DIALOG_MEASURE);
const createBtn2 = cd2.btns ? cd2.btns.find((b) => /Create workspace/.test(b.name || "")) : null;
ok("C4 the typed name enables the door (the disabled state follows the world)",
  createBtn2 && createBtn2.disabled === false, "");
if (createBtn2 && createBtn2.disabled === false) {
  evalJson('(() => { const b = Array.from(document.querySelectorAll("[role=dialog] button")).find((x) => /Create workspace/.test((x.textContent || "").trim())); if (!b) return "no-btn"; b.click(); return "clicked"; })()');
  sleep(2);
  /* t871 — the DOUBLE SETTLE (the transient-toast law): the create's toast
   * is a third state whose lifetime outlives one stability agreement (the
   * ride-4 lesson: need-3 landed at 95, the toast died by S2's 94). Two
   * INDEPENDENT settles demand the transient be dead in both; a toast that
   * outlives both is an honest red worth investigating. */
  settleW("the world after the create (pass 1)", 24, 2);
  const w2 = settleW("the world after the create (pass 2 — the toast must be dead here too)", 16, 2);
  const p2 = evalJson(PANEL_MEASURE);
  ok("C5 the commit closed the dialog and the row arrived (the census speaks 2)",
    w2.hasDlg === false && p2.count === "2" && p2.rows >= 2,
    `count=${JSON.stringify(p2.count)} rows=${p2.rows}`);

  /* ---------- Face S: the switch walk ---------- */
  console.log("Face S — the switch walk (the second canvas, then home)");
  evalJson('(() => { const rows = Array.from(document.querySelectorAll("div[role=button][tabindex]")); const row = rows.find((r) => ((r.querySelector("p") || {}).textContent || "").trim() === "QA Second Room"); if (!row) return JSON.stringify({ found: false }); row.click(); return JSON.stringify({ found: true }); })()');
  sleep(2);
  const s1 = settleW("the second workspace's canvas");
  const s1b = evalJson('(() => { const a = document.querySelector("div[role=button][aria-current=true]"); return JSON.stringify({ active: a ? ((a.querySelector("p") || {}).textContent || "").trim() : null }); })()');
  const s1cards = cardCount().cards;
  ok("S1 the new row took aria-current and the canvas EMPTIED (a fresh room: zero job cards)",
    s1b.active === "QA Second Room" && s1cards === 0 && s1.pageBtns < OPEN && s1.pageUnnamed === 0,
    `active=${JSON.stringify(s1b.active)} cards=${s1cards} btns=${s1.pageBtns} (opening ${OPEN})`);
  evalJson('(() => { const rows = Array.from(document.querySelectorAll("div[role=button][tabindex]")); const row = rows.find((r) => ((r.querySelector("p") || {}).textContent || "").trim() === "Main"); if (!row) return JSON.stringify({ found: false }); row.click(); return JSON.stringify({ found: true }); })()');
  sleep(2);
  const s2 = settleW("the home canvas");
  const s2b = evalJson('(() => { const a = document.querySelector("div[role=button][aria-current=true]"); return JSON.stringify({ active: a ? ((a.querySelector("p") || {}).textContent || "").trim() : null }); })()');
  const s2cards = cardCount().cards;
  ok("S2 the Main row took it back and the canvas returned (the fifteen job cards home, the history's own button immaterial)",
    s2b.active === "Main" && s2cards === CARDS_OPEN,
    `active=${JSON.stringify(s2b.active)} cards=${s2cards} (opening ${CARDS_OPEN}) btns=${s2.pageBtns}`);

  /* ---------- Face D: the delete seat ---------- */
  console.log("Face D — the delete seat (the AlertDialog's moved-not-deleted contract)");
  evalJson('(() => { const b = document.querySelector(\'button[aria-label="Delete QA Second Room"]\'); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
  sleep(1);
  const dd1 = evalJson(DIALOG_MEASURE);
  const delBtn = dd1.btns ? dd1.btns.find((b) => /Delete workspace/.test(b.name || "")) : null;
  const cancelBtn = dd1.btns ? dd1.btns.find((b) => /^Cancel$/.test(b.name || "")) : null;
  ok("D1 the AlertDialog arrived (the alert role, the name spoken, both doors named)",
    dd1.up === true && dd1.isAlert === true && /QA Second Room/.test(dd1.title || "") && !!delBtn && !!cancelBtn,
    `title=${JSON.stringify(dd1.title || "")}`);
  ok("D2 the description speaks the moved-not-deleted contract",
    dd1.desc && /moved to the project/.test(dd1.desc) && /nothing is deleted/.test(dd1.desc),
    `desc=${JSON.stringify(dd1.desc || "")}`);
  if (delBtn) {
    evalJson('(() => { const b = Array.from(document.querySelectorAll("[role=alertdialog] button")).find((x) => /Delete workspace/.test((x.textContent || "").trim())); if (!b) return "no-btn"; b.click(); return "clicked"; })()');
    sleep(2);
    const w3 = settleW("the world after the delete");
    const p3 = evalJson(PANEL_MEASURE);
    ok("D3 the confirm removed the row and the census speaks 1 again",
      w3.hasDlg === false && p3.count === "1" && p3.rows === 1,
      `count=${JSON.stringify(p3.count)} rows=${p3.rows}`);
  } else {
    ok("D3 the confirm removed the row and the census speaks 1 again", false, "delete door missing");
  }
} else {
  ok("C5 the commit closed the dialog and the row arrived (the census speaks 2)", false, "create door never enabled");
  ok("S1 the new row took aria-current and the canvas EMPTIED (a fresh room)", false, "skipped — no second room");
  ok("S2 the Main row took it back and the canvas returned bit-for-bit", false, "skipped — no second room");
  ok("D1 the AlertDialog arrived (the alert role, the name spoken, both doors named)", false, "skipped — no second room");
  ok("D2 the description speaks the moved-not-deleted contract", false, "skipped — no second room");
  ok("D3 the confirm removed the row and the census speaks 1 again", false, "skipped — no second room");
}

/* ---------- Face W: the world back ---------- */
console.log("Face W — the world back (the catalog tab, the canvas bit-for-bit)");
evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => /Workspaces/.test((e.textContent || "").trim())); if (!t) return "no-tab"; const opts = { bubbles: true, button: 0, pointerId: 1 }; t.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); return "arrowed"; })()');
sleep(2);
const w4 = evalJson(WORLD_MEASURE);
/* the Radix tab list moves with arrows; if the catalog tab did not take, click it */
if (w4.wsPanelUp === true) {
  evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => !/Workspaces/.test((e.textContent || "").trim())); if (!t) return "no-tab"; const r = t.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", opts)); t.dispatchEvent(new MouseEvent("mousedown", opts)); t.dispatchEvent(new PointerEvent("pointerup", opts)); t.dispatchEvent(new MouseEvent("mouseup", opts)); t.click(); return "clicked"; })()');
  sleep(2);
}
const w5 = settleW("the restored world", 20, 2, (m) => m.pageBtns === OPEN); /* the t871 arrival: the create/delete roundtrip's transient toast dismisses itself — the world back is the OPENING count, and the lens waits for it (the ride-1 lesson: the toast filmed 145) */
ok("W1 the world back bit-for-bit (the catalog tab, the panel down, zero unnamed)",
  w5.pageBtns === OPEN && w5.wsPanelUp === false && w5.pageUnnamed === 0 && !w5.hasDlg,
  `btns=${w5.pageBtns} (opening ${OPEN})`);
const seedAfter = seedRead();
ok("W2 the walk leaves no session seed (the t157 two-way door's honest none — the t866 lesson rides every page)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (three faces: wsPanel / createDialog / worldBack) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  wsPanel: ledgerFace(prevFaces ? prevFaces.wsPanel?.live ?? null : null, p1, scalarOf),
  createDialog: ledgerFace(prevFaces ? prevFaces.createDialog?.live ?? null : null, cd1, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w5, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the workspace-panel faces hold — the ws-orphan law's own surface walked: the clean room held (the panel summoned by the tab, never resident), the t863 Radix door opened it (the header speaks the census, the Create door named, the list named with its t803 stop, the row a real keyboard citizen whose Space re-selects without harm), the rename seat opened and CANCELLED without a world write (the name is the census's own), the create dialog's door was honestly disabled on an empty name and "QA Second Room" was born through the family's own door (the census spoke 2), the switch walk emptied and restored the canvas bit-for-bit (aria-current followed the rows), the delete seat spoke the moved-not-deleted contract and the confirm restored the census to 1, the world came back bit-for-bit with no session seed — a real world write, exercised and cleaned up inside one walk, the ledger aboard from birth (three faces, the shared law)`
  : `${fail} red — the workspace-panel layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t871-workspace-panel-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> workspaces tab (t863 mousedown) -> panel seats (rows, doors, t803 stop) -> rename seat (open + cancel, no write) -> create dialog (honest disabled -> typed -> born) -> switch walk (empty canvas -> home bit-for-bit) -> delete seat (the alert contract -> confirm) -> worldBack + seed hygiene (one command)",
  doors: {
    tab: "mousedown on the workspaces TabsTrigger — the t863 Radix law",
    row: "click / Enter / Space on the role=button row — the keyboard citizen",
    create: "the Create a new workspace door -> the label[for]-named input -> the Create workspace commit",
    delete: "the Delete door -> the AlertDialog's Delete workspace confirm",
  },
  openingCanvas: OPEN,
  faces: {
    wsPanel: { live: p1 },
    createDialog: { live: cd1 },
    worldBack: { live: w5 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t871-workspace-panel-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nWORKSPACE-PANEL-A11Y t871: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
