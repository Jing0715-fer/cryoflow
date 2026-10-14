#!/usr/bin/env node
/* t869 — the palette-crash repro + the 14th img census.
 *
 * The t846 gate's palette face filmed a STABLE EMPTY PAGE (pageBtns=0,
 * hasDlg=false, heading="") right after the inspector's Escape — and
 * recovered on fresh load. Zero src changes this window, so a Fast-Refresh
 * recompile (the t868 ride-2 stand-in) has no fuel. This instrument asks
 * the world directly, twice:
 *
 *   1. the palette door on a FRESH load (the gate's Face P sequence from
 *      scratch): dispatch cryoflow:open-palette, measure immediately, then
 *      settled — if the palette opens and the world holds, the crash was a
 *      one-off; if the page blanks again, the crash is REAL and reproducible.
 *   2. the inspector's img census (the gate's Face I door): every img's
 *      src tail + alt + naturalWidth — WHO is the 14th img, and is it
 *      broken (naturalWidth 0)?
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
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const dlg = document.querySelector("[role=dialog]"); const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ pageBtns: btns.length, hasDlg: !!dlg, ip: ip ? { aria: ip.getAttribute("aria-label"), ph: ip.getAttribute("placeholder") } : null, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const IMGCENSUS =
  '(() => { const imgs = Array.from(document.querySelectorAll("img")); return JSON.stringify(imgs.map((i) => ({ src: (i.currentSrc || i.src || "").split("/").pop().slice(0, 48), alt: i.getAttribute("alt"), w: i.naturalWidth, inDlg: !!i.closest("[role=dialog]") }))); })()';

const settle = (what, maxIter = 16, need = 2) => {
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

const ESC =
  '(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

console.log("== part 1: the palette door on a FRESH load ==");
ab("open http://localhost:3000");
sleep(3);
const c1 = settle("the canvas");
console.log(`  canvas: pageBtns=${c1.pageBtns}`);
evalJson('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "door"; })()');
sleep(1);
const pNow = evalJson(MEASURE);
console.log(`  immediate: pageBtns=${pNow.pageBtns} hasDlg=${pNow.hasDlg} ip=${pNow.ip ? JSON.stringify(pNow.ip) : "null"}`);
const pSettled = settle("the palette", 16, 2);
console.log(`  settled:   pageBtns=${pSettled.pageBtns} hasDlg=${pSettled.hasDlg} ip=${pSettled.ip ? JSON.stringify(pSettled.ip) : "null"} heading="${pSettled.heading}"`);
const paletteVerdict = pSettled.pageBtns > 100 && pSettled.hasDlg && pSettled.ip;
console.log(`  PART 1 VERDICT: ${paletteVerdict ? "the palette OPENS and the world holds — the blank was a one-off" : "the page is BLANK again — the crash REPRODUCES"}`);
evalJson(ESC);
sleep(1);

console.log("\n== part 2: the inspector's img census (who is the 14th img?) ==");
const clickR = evalJson(
  '(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()'
);
if (!clickR.clicked) { console.log("✗ no Dashboard switcher — abort"); process.exit(1); }
sleep(2);
let card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
if (!card.found) { sleep(3); card = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim().startsWith("Centered iso view")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()'); }
if (!card.found) { console.log("✗ no saved-view card — abort"); process.exit(1); }
sleep(2);
const insp = settle("the inspector", 24, 3);
console.log(`  inspector: pageBtns=${insp.pageBtns} dlgBtns=${insp.dlgBtns}`);
const imgs = evalJson(IMGCENSUS);
console.log(`  img count: ${imgs.length} (inDialog: ${imgs.filter((i) => i.inDlg).length})`);
for (const [n, i] of imgs.entries()) {
  console.log(`   [${n}]${i.inDlg ? " (dlg)" : "      "} w=${i.w} alt=${JSON.stringify(i.alt)} src=…${i.src}`);
}
const broken = imgs.filter((i) => !i.w);
console.log(`  broken imgs (naturalWidth 0): ${broken.length}${broken.length ? " — " + broken.map((b) => b.src).join(", ") : ""}`);
evalJson(ESC);
sleep(1);
const after = evalJson(MEASURE);
console.log(`\nafterEscape: dlg=${after.hasDlg} pageBtns=${after.pageBtns}`);
