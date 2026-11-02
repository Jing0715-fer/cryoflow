#!/usr/bin/env node
/**
 * t874 — the a11y rotation's LAST standing room, finally filmed: THE PARAM
 * PRESETS EDITOR — the profiles dialog's interior. The HPC profile registry
 * (hpc-profiles-editor.tsx) has ridden every gate as part of the sbatch
 * dialog's button census; its own face — the registry list, the six form
 * sections, the clamped numeric contract, the two-step delete, the
 * response-is-truth save — has never been walked. This walk opens it
 * through the product's own doors and films the interior, one honest
 * state at a time.
 *
 * The doors are the DEEPEST stack the rotation has yet walked — THREE
 * layers: canvas → job inspector → the tools menu's "Slurm sbatch
 * dry-run…" → the sbatch dialog → its "Manage cluster profiles" trigger
 * → the editor. t873 proved the ladder peels one layer at a time at TWO
 * deep; this walk holds the same claim to the light at THREE.
 *
 * The faces:
 *
 *   O0  the clean room (the t866 law) — the canvas calm and named, the
 *       opening count taken, and the family's carrier census filmed: the
 *       profiles family persists NOTHING client-side (the registry is the
 *       server's, via /api/hpc/profiles) — the walk films that absence.
 *   PB  the product's doors, three deep (pointer trio on the class2d
 *       card; the inspector's wrench; the tools item; the sbatch
 *       dialog's named workspace; the profiles trigger).
 *   PE  the editor's deep face: the title + count badge, the registry
 *       list (role=list, listitem buttons with aria-pressed exactly one),
 *       the Add/Duplicate doors, the named keyboard region (t804's
 *       house), all five section titles, every control named, the
 *       read-only pair honest (id + pinned localRoot), the numeric
 *       clamps riding the same min/max the server clamps with.
 *   PX  the interaction film — the honest states, never a save that
 *       lies: switch profile (aria-pressed flips); patch the name (the
 *       dirty dot speaks); revert + Save (the round-trip lands, the
 *       flash says "Saved — server view shown", the server's registry
 *       fingerprint unchanged — a save of the truth changes nothing);
 *       Duplicate (count +1 client-side, the clone selected); close
 *       UNSENT (the clone dies — closing without save discards, filmed
 *       live); the two-step delete's arm ("Confirm delete?"), its
 *       honest 3s auto-revert timer, and the confirmed client-side
 *       delete; close unsent again (restored).
 *   ES  the escape ladder at three deep — Escape peels ONE layer: the
 *       editor closes, THE SBATCH DIALOG SURVIVES; Escape again: the
 *       sbatch closes, THE INSPECTOR SURVIVES; the inspector closed
 *       through its own door.
 *   W   the world back — the canvas bit-for-bit, the server registry's
 *       fingerprint byte-for-byte the opening's.
 *
 * Born with the ledger aboard (the t861 birthright, four faces):
 * canvasFace / editorFace / sbatchFace / worldBack.
 *
 * Receipt: shots-qa/t874-profiles-editor-a11y.json.
 *
 *   node scripts/t874-profiles-editor-a11y.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
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

/** agent-browser eval unwrap — the t837 defensive form. */
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
const cmp = loadComparator(ROOT, "shots-qa/t874-profiles-editor-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t874 profiles-editor a11y walk — world ${world.mode}:${buildId}, the profiles dialog's interior filmed through the product's three-deep doors\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* ---------- the measure: ONE superset, three faces' fields. ----------
 * Canvas fields ride every face; the sb.* fields speak when the sbatch
 * dialog is open; the ed.* fields only when the editor is open. The
 * stacked-dialog detectors scan ALL [role=dialog] nodes — Radix marks
 * the covered layers aria-hidden, and the sbatch dialog must still be
 * findable beneath the editor. NO ${} inside — the shell reads this. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const inTree = (e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden && !(e.closest && e.closest("[aria-hidden=true]")); const btns = Array.from(document.querySelectorAll("button")).filter(inTree); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")).filter(inTree); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const q = (root, s) => root ? root.querySelector(s) : null; const qa = (root, s) => root ? Array.from(root.querySelectorAll(s)) : []; const titleOf = (d) => ((q(d, "[data-slot=dialog-title]") || q(d, "h1,h2") || {}).textContent || "").trim(); const regionsOf = (d) => qa(d, "[role=region]"); const ed = dgs.find((d) => regionsOf(d).some((r) => (r.getAttribute("aria-label") || "").indexOf("Profile editor") === 0)); const sb = dgs.find((d) => regionsOf(d).some((r) => (r.getAttribute("aria-label") || "").indexOf("Slurm sbatch workspace") === 0)); const edRegion = ed ? regionsOf(ed).find((r) => (r.getAttribute("aria-label") || "").indexOf("Profile editor") === 0) : null; const sbRegion = sb ? regionsOf(sb).find((r) => (r.getAttribute("aria-label") || "").indexOf("Slurm sbatch workspace") === 0) : null; const edList = ed ? qa(ed, "[role=list]").find((l) => (l.getAttribute("aria-label") || "").indexOf("Profile list") !== -1) : null; const items = edList ? qa(edList, "[role=listitem] button") : []; const edCtrls = edRegion ? qa(edRegion, "input,textarea") : []; const nums = edRegion ? qa(edRegion, "input[type=number]") : []; const combos = ed ? qa(ed, "[role=combobox]") : []; const statuses = ed ? qa(ed, "[role=status]").map((s) => (s.textContent || "").trim().slice(0, 40)) : []; const edBtns = ed ? qa(ed, "button") : []; const delBtn = ed ? edBtns.find((b) => ((b.getAttribute("aria-label") || "") === "Delete profile" || (b.getAttribute("aria-label") || "") === "Confirm delete profile")) : null; const addBtn = ed ? edBtns.find((b) => (b.textContent || "").trim().indexOf("Add") !== -1) : null; const dupBtn = ed ? q(ed, "[aria-label=" + JSON.stringify("Duplicate selected profile") + "]") : null; const edTitle = ed ? titleOf(ed) : null; const regText = edRegion ? edRegion.textContent || "" : ""; const secNames = ["Identity", "Connection", "Resources", "Cluster paths", "Environment prep"]; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 4).map((b) => (b.textContent || "").trim().slice(0, 24) || (b.getAttribute("aria-label") || "no-name").slice(0, 24)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgs.filter((i) => !i.complete).length, dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 44)), edOpen: !!ed, edTitle: edTitle ? edTitle.slice(0, 44) : null, edCount: edTitle ? ((edTitle.match(/(\\d+) \\/ 8/) || [null])[0]) : null, edSubmitting: edTitle ? edTitle.indexOf("submitting with:") !== -1 : null, edListName: edList ? edList.getAttribute("aria-label") : null, edItems: items.length, edPressed: items.map((b) => b.getAttribute("aria-pressed") === "true"), edItemNames: items.map((b) => (b.textContent || "").trim()), edAddDis: addBtn ? addBtn.disabled === true : null, edDupDis: dupBtn ? dupBtn.disabled === true : null, edRegionName: edRegion ? edRegion.getAttribute("aria-label") : null, edRegionTab: edRegion ? edRegion.getAttribute("tabindex") : null, edSections: secNames.map((s) => regText.indexOf(s) !== -1), edCtrlsN: edCtrls.length, edCtrlNames: edCtrls.map((c) => c.getAttribute("aria-label")), edUnnamedN: edCtrls.filter((c) => !c.getAttribute("aria-label")).length, edCombos: combos.length, edComboName: combos.length ? combos[0].getAttribute("aria-label") : null, edReadonly: edCtrls.filter((c) => c.readOnly).length, edNumClamped: nums.filter((n) => n.hasAttribute("min") && n.hasAttribute("max")).length, edStatus: statuses, edDelLabel: delBtn ? delBtn.getAttribute("aria-label") : null, edDelText: delBtn ? (delBtn.textContent || "").trim() : null, sbOpen: !!sb, sbRegionName: sbRegion ? sbRegion.getAttribute("aria-label") : null, sbProfileSel: sb ? !!q(sb, "[role=combobox][aria-label=" + JSON.stringify("Cluster profile") + "]") : null, sbEditorTrigger: sb ? !!q(sb, "[aria-label=" + JSON.stringify("Manage cluster profiles") + "]") : null }); })()';

/* the settle law (the t864/t865 generalization): images settled AND two
 * consecutive measures equal, bounded. */
const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (${run}x stable)`);
  return m;
};

/* the arrival door: WAIT for a predicate on the live measure (bounded) */
const waitFor = (what, probe, maxSecs = 30) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

/* the OOM corpse guard — an eval filming a dead server returns ZEROS */
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- the product's own doors ---------- */
/** the full pointer sequence (the canvas eats bare clicks — the
 *  pointerdown+pointerup+click trio is what a real hand does) */
const clickJobCard = (needle) =>
  '(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf(' + JSON.stringify(needle) + ') !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()';

/** the trio dialect for in-dialog buttons too (Radix triggers listen to
 *  the pointer stream — a bare click() is a hand without a press) */
const trio = (js) =>
  '(() => { ' + js + ' const r = el.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; el.dispatchEvent(new PointerEvent("pointerdown", o)); el.dispatchEvent(new PointerEvent("pointerup", o)); el.click(); return JSON.stringify({ clicked: true, name: el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 30) }); })()';

const openTools = trio(
  'const tops = Array.from(document.querySelectorAll("[role=dialog]")).filter((d) => d.getAttribute("aria-hidden") !== "true"); const dlg = tops[tops.length - 1] || document; const el = dlg && Array.from(dlg.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "More job tools"); if (!el) return JSON.stringify({ clicked: false });'
);
const clickSbatchItem = trio(
  'const el = document.querySelector("[data-testid=tools-sbatch-item]"); if (!el) return JSON.stringify({ clicked: false });'
);
const openProfiles = trio(
  'const el = document.querySelector("[aria-label=" + JSON.stringify("Manage cluster profiles") + "]"); if (!el) return JSON.stringify({ clicked: false });'
);
const pickSecondProfile = trio(
  'const dlg = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => Array.from(d.querySelectorAll("[role=list]")).some((l) => (l.getAttribute("aria-label") || "").indexOf("Profile list") !== -1)); const lst = dlg && Array.from(dlg.querySelectorAll("[role=list]")).find((l) => (l.getAttribute("aria-label") || "").indexOf("Profile list") !== -1); const el = lst && Array.from(lst.querySelectorAll("[role=listitem] button")).find((b) => b.getAttribute("aria-pressed") === "false"); if (!el) return JSON.stringify({ clicked: false });'
);
const clickDup = trio(
  'const el = document.querySelector("[aria-label=" + JSON.stringify("Duplicate selected profile") + "]"); if (!el) return JSON.stringify({ clicked: false });'
);
const clickDel = trio(
  'const tops = Array.from(document.querySelectorAll("[role=dialog]")).filter((d) => Array.from(d.querySelectorAll("[role=region]")).some((r) => (r.getAttribute("aria-label") || "").indexOf("Profile editor") === 0)); const dlg = tops[0]; const el = dlg && Array.from(dlg.querySelectorAll("button")).find((b) => ((b.getAttribute("aria-label") || "") === "Delete profile" || (b.getAttribute("aria-label") || "") === "Confirm delete profile")); if (!el) return JSON.stringify({ clicked: false });'
);
const clickEdClose = trio(
  'const tops = Array.from(document.querySelectorAll("[role=dialog]")).filter((d) => Array.from(d.querySelectorAll("[role=region]")).some((r) => (r.getAttribute("aria-label") || "").indexOf("Profile editor") === 0)); const dlg = tops[0]; const el = dlg && Array.from(dlg.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === "Close"); if (!el) return JSON.stringify({ clicked: false });'
);
const clickSave = trio(
  'const tops = Array.from(document.querySelectorAll("[role=dialog]")).filter((d) => Array.from(d.querySelectorAll("[role=region]")).some((r) => (r.getAttribute("aria-label") || "").indexOf("Profile editor") === 0)); const dlg = tops[0]; const el = dlg && Array.from(dlg.querySelectorAll("button")).find((b) => (b.textContent || "").trim() === "Save to server"); if (!el) return JSON.stringify({ clicked: false });'
);

/** the React controlled-input dialect: the native setter + the input
 *  event — value assignment alone is a lie React never commits */
const readNameValue = '(() => { const tops = Array.from(document.querySelectorAll("[role=dialog]")).filter((d) => Array.from(d.querySelectorAll("[role=region]")).some((r) => (r.getAttribute("aria-label") || "").indexOf("Profile editor") === 0)); const dlg = tops[0]; const inp = dlg && dlg.querySelector("[aria-label=" + JSON.stringify("Profile display name") + "]"); if (!inp) return JSON.stringify({ ok: false }); return JSON.stringify({ ok: true, value: inp.value }); })()';
const patchName = (val) =>
  '(() => { const tops = Array.from(document.querySelectorAll("[role=dialog]")).filter((d) => Array.from(d.querySelectorAll("[role=region]")).some((r) => (r.getAttribute("aria-label") || "").indexOf("Profile editor") === 0)); const dlg = tops[0]; const inp = dlg && dlg.querySelector("[aria-label=" + JSON.stringify("Profile display name") + "]"); if (!inp) return JSON.stringify({ ok: false }); const old = inp.value; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(inp, ' + JSON.stringify(val) + '); inp.dispatchEvent(new Event("input", { bubbles: true })); return JSON.stringify({ ok: true, old }); })()';

const closeInspector = '(() => { const dlg = document.querySelector("[role=dialog]"); const b = dlg && Array.from(dlg.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Close inspector"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const escKey = '(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return JSON.stringify({ sent: true }); })()';

/** the server registry's fingerprint, taken through the page's own
 *  origin (the walk rides the product's fetch, same as its UI does) */
const fpStart = '(() => { window.__t874fp = null; fetch("/api/hpc/profiles").then((r) => r.json()).then((d) => { window.__t874fp = JSON.stringify((d && d.profiles) || []); }).catch(() => { window.__t874fp = "ERR"; }); return JSON.stringify({ started: true }); })()';
const fpRead = '(() => JSON.stringify({ fp: window.__t874fp === null || window.__t874fp === undefined ? null : window.__t874fp }))()';
const fingerprint = async () => {
  evalJson(fpStart);
  for (let i = 0; i < 10; i++) {
    sleep(1);
    const v = evalJson(fpRead);
    if (v && typeof v.fp === "string") return v.fp;
  }
  return "TIMEOUT";
};

/* ================================================================== */
console.log("Face O0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
/* the clean room clears the conditions' every carrier (the t873 law).
 * THIS family's honest answer: it persists NOTHING client-side — the
 * registry is the server's. The sweep films that absence instead of
 * pretending to clear something. */
const swept = evalJson('(() => { const kill = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.indexOf("hpc") !== -1 || k.indexOf("profile") !== -1 || k.indexOf("sbatch") !== -1)) kill.push(k); } kill.forEach((k) => localStorage.removeItem(k)); return JSON.stringify({ swept: kill.length, carriers: kill }); })()');
console.log(`  (carrier sweep: ${swept.swept} hpc/profile persistence key(s) — the registry family lives server-side only)`);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(4);
const m0 = settle("the canvas");
if (corpse(m0, "O0")) process.exit(1);
ok("O1 canvas arrives and stays named", m0.pageBtns >= 100 && m0.dlgCount === 0, `btns=${m0.pageBtns} dlgs=${m0.dlgCount}`);
ok("O2 canvas zero unnamed buttons", m0.pageUnnamed === 0, m0.pageUnnamed ? `who=${m0.unWho.join("|")}` : "");
ok("O3 canvas zero unnamed form controls", m0.unCtrls === 0, `unCtrls=${m0.unCtrls}/${m0.ctrls}`);
ok("O4 canvas zero alt-less imgs", m0.altless === 0, `imgs=${m0.imgs}`);
ok("O5 the family's client-side carrier census is ZERO", swept.swept === 0, "the registry lives server-side — nothing to clear, filmed honestly");
const OPEN = m0.pageBtns;
const FP0 = await fingerprint();
ok("O6 the server registry fingerprint taken", typeof FP0 === "string" && FP0.startsWith("["), `bytes=${(FP0 || "").length}`);
/* ================================================================== */
console.log("Face PB — the product's doors, THREE deep (card → inspector → tools → sbatch → editor)");
const c1 = evalJson(clickJobCard("2D Classification"));
ok("P1 the class2d card clicked (pointer trio)", c1.found === true);
const insp = waitFor("the inspector", (m) => m.dlgHeads.some((h) => h.startsWith("2D Classification")), 20);
ok("P2 the inspector arrived", insp.dlgHeads.some((h) => h.startsWith("2D Classification")), `heads=${insp.dlgHeads.join(" / ")}`);
let t1 = { clicked: false };
for (let i = 0; i < 6 && !t1.clicked; i++) {
  sleep(1);
  t1 = evalJson(openTools);
}
ok("P3 the wrench opened the tools menu", t1.clicked === true, `aria-label="${t1.name ?? ""}"`);
let s1 = { clicked: false };
for (let i = 0; i < 6 && !s1.clicked; i++) {
  sleep(1);
  s1 = evalJson(clickSbatchItem);
}
ok("P4 the tools item clicked", s1.clicked === true, 'data-testid=tools-sbatch-item — the t757 menu home');
const sbm = waitFor("the sbatch dialog", (m) => m.sbOpen === true && m.dlgHeads.some((h) => h.indexOf("Slurm submission") === 0), 25);
ok("P5 the sbatch dialog arrived (layer 2)", sbm.sbOpen === true, `heads=${sbm.dlgHeads.join(" / ")}`);
if (corpse(sbm, "PB")) process.exit(1);
ok("P6 the sbatch workspace is a named region", (sbm.sbRegionName ?? "").indexOf("Slurm sbatch workspace") === 0, `aria-label="${(sbm.sbRegionName ?? "").slice(0, 60)}"`);
ok("P7 the cluster-profile picker named", sbm.sbProfileSel === true, 'combobox aria-label="Cluster profile"');
ok("P8 the profiles trigger aboard the sbatch dialog", sbm.sbEditorTrigger === true, 'aria-label="Manage cluster profiles"');
let e1 = { clicked: false };
for (let i = 0; i < 6 && !e1.clicked; i++) {
  sleep(1);
  e1 = evalJson(openProfiles);
}
ok("P9 the profiles trigger clicked", e1.clicked === true, `aria-label="${e1.name ?? ""}"`);
const edm = waitFor("the editor dialog", (m) => m.edOpen === true, 15);
if (corpse(edm, "PE")) process.exit(1); // a mid-ride OOM reap films zeros — the honest failure, not a red cascade
ok("P10 the editor dialog arrived (layer 3)", edm.edOpen === true, `heads=${edm.dlgHeads.join(" / ")}`);
ok("P11 all THREE layers stacked", edm.dlgCount === 3, `dlgs=${edm.dlgCount} (inspector + sbatch + editor)`);

/* ================================================================== */
console.log("Face PE — the editor's deep face (the registry's management truth)");
ok("E1 the title speaks the domain and the budget", (edm.edTitle ?? "").indexOf("Cluster profiles") === 0 && /^\d+ \/ 8$/.test(edm.edCount ?? ""), `title="${edm.edTitle}" count=${edm.edCount}`);
ok("E2 the submitting badge rides (the parent's active profile)", edm.edSubmitting === true, "activeId flows from the sbatch select");
ok("E3 the registry list is a named list", (edm.edListName ?? "") === "Profile list", `aria-label="${edm.edListName}"`);
ok("E4 registry items with EXACTLY ONE pressed", edm.edItems >= 2 && edm.edPressed.filter((p) => p === true).length === 1, `items=${edm.edItems} pressed=${JSON.stringify(edm.edPressed)}`);
ok("E5 the Add door honest (enabled under the cap)", edm.edAddDis === false, `add disabled=${edm.edAddDis}`);
ok("E6 the Duplicate door named and honest", edm.edDupDis === false, `aria-label="Duplicate selected profile" dis=${edm.edDupDis}`);
ok("E7 the editor is a named KEYBOARD region (t804's house)", (edm.edRegionName ?? "").indexOf("Profile editor") === 0 && parseInt(edm.edRegionTab, 10) === 0, `tabindex=${edm.edRegionTab}`);
ok("E8 all five section titles aboard", edm.edSections.every(Boolean), `identity=${edm.edSections[0]} connection=${edm.edSections[1]} resources=${edm.edSections[2]} paths=${edm.edSections[3]} env=${edm.edSections[4]}`);
const EXPECTED_CTRLS = [
  "Profile display name", "Profile id (read-only)", "Login host", "Slurm partition", "Slurm account", "Slurm QoS",
  "Time limit in minutes", "Node count", "GPUs per node", "Array concurrency throttle", "Simulated GPU speed multiplier",
  "Cluster RELION home", "Cluster data root", "ctffind binary path", "Local data root (pinned by server)",
  "Environment preparation lines",
];
ok("E9 every form control named (the full 16)", edm.edCtrlsN === EXPECTED_CTRLS.length && EXPECTED_CTRLS.every((n) => edm.edCtrlNames.includes(n)), `controls=${edm.edCtrlsN} missing=${EXPECTED_CTRLS.filter((n) => !edm.edCtrlNames.includes(n)).join("|") || "none"}`);
ok("E10 zero unnamed controls in the editor", edm.edUnnamedN === 0 && edm.pageUnnamed === 0 && edm.unCtrls === 0, `edUnnamed=${edm.edUnnamedN} pageUnnamed=${edm.pageUnnamed}`);
ok("E11 the GPU model combobox named", edm.edCombos >= 1 && (edm.edComboName ?? "") === "GPU model", `combos=${edm.edCombos} name="${edm.edComboName}"`);
ok("E12 the read-only pair honest (id + pinned localRoot)", edm.edReadonly === 2, `readOnly=${edm.edReadonly} — the server owns both names`);
ok("E13 the numeric clamps ride the server's contract", edm.edNumClamped === 5, `clamped=${edm.edNumClamped}/5 (time/nodes/gpus/array/sim)`);
ok("E14 the delete door speaks its current truth", edm.edDelLabel === "Delete profile" && (edm.edDelText ?? "") === "Delete", `label="${edm.edDelLabel}" text="${edm.edDelText}"`);
ok("E15 no status speaking while clean", Array.isArray(edm.edStatus) && edm.edStatus.length === 0, `statuses=${JSON.stringify(edm.edStatus)}`);
ok("E16 the editor face is fully named", censusOk(edm), `unnamed=${edm.pageUnnamed} unCtrls=${edm.unCtrls} altless=${edm.altless}`);

/* ================================================================== */
console.log("Face PX — the interaction film (the honest states; no save that lies)");
const pk = evalJson(pickSecondProfile);
ok("X1 the second profile clicked", pk.clicked === true, `name="${pk.name ?? ""}"`);
const px1 = waitFor("the pressed flip", (m) => m.edOpen && m.edPressed.filter((p) => p === true).length === 1 && m.edPressed[1] === true, 10);
ok("X2 aria-pressed flipped to the picked item", px1.edPressed[1] === true && px1.edPressed[0] === false, `pressed=${JSON.stringify(px1.edPressed)}`);

const nm0 = evalJson(readNameValue);
const ORIG_NAME = nm0.value; // the INPUT's own value — the list item's textContent also carries the GPU badge and the host, and a name derived from it would be a lie the save would keep
const nm1 = evalJson(patchName(ORIG_NAME + " (t874 probe)"));
ok("X3 the name patched through the native setter", nm1.ok === true && nm1.old === ORIG_NAME, `old="${nm1.old}"`);
const px2 = waitFor("the dirty dot", (m) => m.edOpen && m.edStatus.some((s) => s.indexOf("unsaved edits") !== -1), 8);
ok("X4 the dirty dot speaks (role=status)", px2.edStatus.some((s) => s.indexOf("unsaved edits") !== -1), `statuses=${JSON.stringify(px2.edStatus)}`);

evalJson(patchName(nm1.old)); // the revert restores THE INPUT'S OWN truth, never the measure's rendering of it
let rv = null;
for (let i = 0; i < 8 && !(rv && rv.ok && rv.value === ORIG_NAME); i++) {
  sleep(1);
  rv = evalJson(readNameValue);
}
ok("X5 the name reverted — the walk saves only the truth", !!rv && rv.ok && rv.value === ORIG_NAME, `value="${rv ? rv.value : null}"`);
const sv = evalJson(clickSave);
ok("X6 Save to server clicked", sv.clicked === true);
const px4 = waitFor("the save flash", (m) => m.edOpen && m.edStatus.some((s) => s.indexOf("Saved") !== -1), 10);
ok("X7 the flash says the server's view is shown", px4.edStatus.some((s) => s.indexOf("Saved") !== -1), `statuses=${JSON.stringify(px4.edStatus)}`);
const px5 = waitFor("the dirty dot cleared", (m) => m.edOpen && !m.edStatus.some((s) => s.indexOf("unsaved edits") !== -1), 12);
ok("X8 the round-trip cleared the dirty state", !px5.edStatus.some((s) => s.indexOf("unsaved edits") !== -1), `statuses=${JSON.stringify(px5.edStatus)}`);

const dp = evalJson(clickDup);
ok("X9 Duplicate clicked", dp.clicked === true);
const px6 = waitFor("the clone", (m) => m.edOpen && m.edItems === px1.edItems + 1, 10);
ok("X10 the count grew client-side", px6.edOpen && px6.edItems === px1.edItems + 1, `items=${px1.edItems} → ${px6.edItems} (cap badge ${px6.edCount})`);
ok("X11 the clone is selected and named a copy", (() => { const pi = px6.edPressed.indexOf(true); return pi !== -1 && px6.edPressed.filter((p) => p === true).length === 1 && px6.edItemNames[pi].indexOf("copy") !== -1; })(), `pressed=${JSON.stringify(px6.edPressed)} names=${px6.edItemNames.map((n) => n.slice(0, 22)).join(" | ")}`);
evalJson(clickEdClose);
const px7 = waitFor("the editor closed unsent", (m) => !m.edOpen && m.sbOpen === true, 10);
ok("X12 close WITHOUT save — the sbatch survives beneath", px7.edOpen === false && px7.sbOpen === true, `dlgs=${px7.dlgCount}`);
evalJson(openProfiles);
const px8 = waitFor("the editor reopened", (m) => m.edOpen === true, 15);
ok("X13 the unsent clone DIED — the server's truth returned", px8.edOpen && px8.edItems === px1.edItems, `items=${px8.edItems} (was ${px6.edItems} client-side)`);
ok("X14 the count badge back at the registry's truth", /^\d+ \/ 8$/.test(px8.edCount ?? "") && px8.edCount === px1.edCount, `count=${px8.edCount}`);

const d1 = evalJson(clickDel);
ok("X15 the delete door armed (first click)", d1.clicked === true);
const px9 = waitFor("the armed label", (m) => m.edOpen && m.edDelText === "Confirm delete?", 8);
ok("X16 the armed door speaks its question", px9.edDelText === "Confirm delete?" && px9.edDelLabel === "Confirm delete profile", `label="${px9.edDelLabel}"`);
sleep(3.4);
const px10 = evalJson(MEASURE);
ok("X17 the honest timer reverted the arm (3s)", px10.edOpen && px10.edDelText === "Delete", `text="${px10.edDelText}" — a question that un-asks itself`);
const d2 = evalJson(clickDel);
const px11 = waitFor("the re-armed label", (m) => m.edOpen && m.edDelText === "Confirm delete?", 8);
const d3 = evalJson(clickDel);
const px12 = waitFor("the confirmed delete", (m) => m.edOpen && m.edItems === px8.edItems - 1, 10);
ok("X18 arm → confirm deleted client-side", px12.edOpen && px12.edItems === px8.edItems - 1, `items=${px8.edItems} → ${px12.edItems}`);
evalJson(clickEdClose);
const px13 = waitFor("the editor closed unsent again", (m) => !m.edOpen && m.sbOpen === true, 10);
evalJson(openProfiles);
const px14 = waitFor("the editor reopened again", (m) => m.edOpen === true, 15);
ok("X19 the unsent delete DIED too — the registry restored", px14.edOpen && px14.edItems === px8.edItems, `items=${px14.edItems}`);

/* ================================================================== */
console.log("Face ES — the escape ladder at THREE deep (one layer per peel)");
evalJson(escKey);
sleep(2);
const es1 = evalJson(MEASURE);
ok("S1 Escape peeled ONE layer — the editor only", es1.edOpen === false && es1.sbOpen === true && es1.dlgHeads.some((h) => h.indexOf("Slurm submission") === 0), `dlgs=${es1.dlgCount} heads=${es1.dlgHeads.join(" / ")}`);
evalJson(escKey);
sleep(2);
const es2 = evalJson(MEASURE);
ok("S2 Escape peeled the second layer — the inspector survives", es2.sbOpen === false && es2.dlgHeads.some((h) => h.startsWith("2D Classification")), `dlgs=${es2.dlgCount} heads=${es2.dlgHeads.join(" / ")}`);
evalJson(closeInspector);
sleep(2);
const es3 = evalJson(MEASURE);
ok("S3 the inspector closed through its own door", es3.dlgCount === 0, `dlgs=${es3.dlgCount}`);

/* ================================================================== */
console.log("Face W — the world back (the t866 law's restore clause)");
const w1 = settle("the restored canvas", 16);
ok("W1 every dialog closed", w1.dlgCount === 0, `dlgs=${w1.dlgCount}`);
ok("W2 the canvas bit-for-bit", w1.pageBtns === OPEN && JSON.stringify(w1.pageUnnamed) === JSON.stringify(m0.pageUnnamed), `open=${OPEN} back=${w1.pageBtns} (drift ${w1.pageBtns - OPEN})`);
ok("W3 the world still fully named", censusOk(w1), `unnamed=${w1.pageUnnamed}`);
const FP1 = await fingerprint();
ok("W4 the server registry byte-for-byte the opening's", FP1 === FP0, `fp0=${(FP0 || "").length}B fp1=${(FP1 || "").length}B ${FP1 === FP0 ? "identical" : "MOVED — a save that lied"}`);

/* ================================================================== */
/* the drift ledger (the t861 birthright) — four faces, one law.
 * Shape adapter: the SWEEP family (t846) stores the whole live measure
 * as face.live; the WALK family (t871, this) stores the scalar. The
 * comparator accepts both — a ledger that cannot read its own family's
 * receipts would report drift null forever. */
const prevFaces = cmp.prev?.driftLedger?.faces ?? cmp.prev?.faces ?? null;
const prevFaceOf = (name) => {
  const pf = prevFaces ? prevFaces[name] : null;
  const lv = pf ? pf.live : null;
  if (lv == null) return null;
  return typeof lv === "number" ? { pageBtns: lv } : lv;
};
const scalarOf = (m) => m.pageBtns;
/* the WALK family's face projection — the scalar rides the drift line,
 * the PROJECTION rides the identical/moved comparison */
const edProj = (m) => ({ pageBtns: m.pageBtns, pageUnnamed: m.pageUnnamed, unCtrls: m.unCtrls, altless: m.altless, edOpen: m.edOpen, edTitle: m.edTitle, edCount: m.edCount, edItems: m.edItems, edPressed: m.edPressed, edAddDis: m.edAddDis, edDupDis: m.edDupDis, edSections: m.edSections, edCtrlsN: m.edCtrlsN, edUnnamedN: m.edUnnamedN, edCombos: m.edCombos, edReadonly: m.edReadonly, edNumClamped: m.edNumClamped });
const sbProj = (m) => ({ pageBtns: m.pageBtns, pageUnnamed: m.pageUnnamed, unCtrls: m.unCtrls, altless: m.altless, sbOpen: m.sbOpen, sbRegionName: m.sbRegionName, sbProfileSel: m.sbProfileSel, sbEditorTrigger: m.sbEditorTrigger });
const ledgerFaces = {
  canvasFace: ledgerFace(prevFaceOf("canvasFace"), m0, scalarOf),
  editorFace: ledgerFace(prevFaceOf("editorFace"), edProj(edm), scalarOf),
  sbatchFace: ledgerFace(prevFaceOf("sbatchFace"), sbProj(sbm), scalarOf),
  worldBack: ledgerFace(prevFaceOf("worldBack"), w1, scalarOf),
};
console.log("Drift ledger — " + LEDGER_LAW);
for (const [name, face] of Object.entries(ledgerFaces)) {
  const v = armVerdict(cmp, world, face);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ================================================================== */
const total = pass + fail;
console.log(
  `\nPROFILES-EDITOR t874: ${pass}/${total} ${fail === 0 ? "green" : "RED"} — ` +
  `the param presets editor's interior filmed through the product's three-deep doors; ` +
  `the escape ladder peels one layer at a time at THREE deep; the world and the server registry restored byte-for-byte`
);

const verdict =
  fail === 0
    ? `the profiles dialog's interior holds: the three-deep door stack opened (card → tools menu → sbatch dialog → the editor); the registry list named with exactly one pressed item; the named keyboard region, all five section titles, all sixteen named controls, the GPU combobox, the read-only pair and the five numeric clamps spoke the server's contract; the dirty dot, the save flash and the round-trip told the response-is-truth law (a save of the truth changed nothing); the duplicate and the confirmed delete lived client-side and DIED unsent on close; the two-step delete's honest timer un-asked its own question; Escape peeled one layer at a time down a THREE-deep stack, each parent surviving; and the canvas and the server registry came back byte-for-byte`
    : `${fail} red — the profiles editor's deep face moved; call the census's own instruments before any UI work`;

const receipt = {
  instrument: "scripts/t874-profiles-editor-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "O0 clean canvas + carrier census → PB three-deep doors → PE editor deep face → PX interaction film (save round-trip, duplicate, two-step delete, unsent deaths) → ES escape ladder at three deep → W world back + registry fingerprint",
  doors: {
    editor: "class2d job card (pointer trio) → the inspector's More-job-tools wrench → tools-sbatch-item → the sbatch dialog's Manage-cluster-profiles trigger",
    layers: "inspector (1) → sbatch dialog (2) → profiles editor (3) — the rotation's deepest stack yet",
  },
  verdict,
  driftLedger: {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    prevDate: prevReceipt?.date ?? null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces: ledgerFaces,
  },
  checks: results,
  passed: pass,
  failed: fail,
};
const outPath = join(ROOT, "shots-qa", "t874-profiles-editor-a11y.json");
writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`receipt: ${outPath}${existsSync(outPath) ? "" : " (WRITE FAILED)"}`);
process.exit(fail === 0 ? 0 : 1);
