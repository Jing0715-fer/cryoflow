#!/usr/bin/env node
/* t869 — the inspector decay discriminator. The drift probe (t857) filmed
 * the inspector face at 283/282 vs the t846 gate's 289 (same build, same
 * world). The probe's Face I measures after a RAW sleep(2) — no settle —
 * while the gate deep-settles (24,3). The t860 witness says the analytics
 * surfaces mount on a long schedule (264 -> 289 with a quiet step). This
 * instrument rides the GATE's door (Dashboard -> "Centered iso view" card)
 * with the gate's deep settle, records the settled measure, then rides a
 * SECOND deep settle pass in the still-open dialog: if the world keeps
 * moving under a settled lens, the decay is real; if both passes agree at
 * 289-class values, the probe's raw-sleep lens is the guilty film (the
 * t864 false-settle lesson, wearing t857's clothes).
 *
 * Zero src — scripts-only diagnostic; the receipt is the printed verdict.
 */
import { execSync } from "node:child_process";
import { NAMEOF } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error(`unparseable: ${raw.slice(0, 200)}`); }
  if (typeof out === "string") {
    try { const inner = JSON.parse(out); if (inner && typeof inner === "object") return inner; } catch { /* plain string */ }
  }
  return out;
};

const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const dlg = document.querySelector("[role=dialog]"); const dlgBtns = dlg ? Array.from(dlg.querySelectorAll("button")) : []; return JSON.stringify({ pageBtns: btns.length, hasDlg: !!dlg, dlgBtns: dlgBtns.length, dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null }); })()';

const DUMP =
  '(() => { ' + NAMEOF + ' const dlg = document.querySelector("[role=dialog]"); if (!dlg) return JSON.stringify({ gone: true }); const counts = {}; for (const b of dlg.querySelectorAll("button")) { const n = nameOf(b) || "(unnamed)"; counts[n] = (counts[n] || 0) + 1; } return JSON.stringify({ gone: false, pageBtns: document.querySelectorAll("button").length, dlgBtns: Object.values(counts).reduce((a, b) => a + b, 0), counts }); })()';

const settle = (what, maxIter, need) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxIter; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need) break;
  }
  console.log(`  settled ${what} (${need}x stable)`);
  return m;
};

console.log("t869 — the inspector decay discriminator (the gate's door, the gate's lens)");
ab("open http://localhost:3000");
sleep(3);
const c1 = settle("the canvas", 16, 2);
console.log(`  canvas: pageBtns=${c1.pageBtns} dlg=${c1.hasDlg}`);

const clickR = evalJson(
  '(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()'
);
if (!clickR.clicked) { console.log("✗ the Dashboard switcher did not click — abort"); process.exit(1); }
sleep(2);

let card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
if (!card.found) { sleep(3); card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()'); }
if (!card.found) { console.log("✗ the saved-view card not found — abort"); process.exit(1); }
console.log("  the saved-view card clicked — the inspector opens");
sleep(2);

const A = settle("pass A (the gate's deep settle 24,3)", 24, 3);
const dumpA = evalJson(DUMP);
console.log(`  PASS A: pageBtns=${A.pageBtns} dlgBtns=${A.dlgBtns} heading="${A.dlgHeading}"`);

const B = settle("pass B (a second deep settle in the open dialog)", 24, 3);
const dumpB = evalJson(DUMP);
console.log(`  PASS B: pageBtns=${B.pageBtns} dlgBtns=${B.dlgBtns}`);

console.log("\nPASS A dialog button-name multiset:");
console.log(JSON.stringify(dumpA.counts, null, 1));

const same = JSON.stringify(dumpA.counts) === JSON.stringify(dumpB.counts);
console.log(`\nVERDICT: A=${A.dlgBtns} B=${B.dlgBtns} name-multiset ${same ? "IDENTICAL" : "MOVED between settled passes"}`);
console.log(same
  ? "  the settled world is STABLE at this value — the decay was the mount schedule (the raw-sleep lens films mid-mount; the t864 lesson, t857's clothes)"
  : "  the dialog KEEPS MOVING under a settled lens — a real decay; diff the multisets above");

/* the escape — leave the world as we found it */
evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1);
const after = evalJson(MEASURE);
console.log(`afterEscape: dlg=${after.hasDlg} pageBtns=${after.pageBtns}`);
