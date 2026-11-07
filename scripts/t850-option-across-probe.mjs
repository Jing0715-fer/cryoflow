#!/usr/bin/env node
/**
 * t850 probe — the SEVENTH seat's MEASUREMENT pass (measure first, then
 * pin): the t849 tail's candidate — t840's (b88) slope rows at 1283/1286
 * gain BAND walks. Does the mid-row-pays law (equalize / diverge) hold
 * WIDTH-INDEXED on an OPTION world, and do the option clones' band edges
 * ride the live rulers at every width (the sixth seat's width-free PAINT,
 * tested on the decision table's clones)?
 *
 * Rides only — no receipt, no pins. Kept as provenance.
 */
import { execSync } from "node:child_process";

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error(raw.slice(0, 200)); }
  if (typeof out === "string") {
    try { const inner = JSON.parse(out); if (inner && typeof inner === "object") return inner; } catch {}
  }
  return out;
};

/* t840's BAND walk, verbatim */
const BAND_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; const midKids = mid && mid.getBoundingClientRect().width > 0 ? [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })) : null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats: seats, midKids: midKids, innerW: window.innerWidth }); })()";

/* t840's zone walk, verbatim (we only need wrapW/overlap here) */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; if (!psWrap) return JSON.stringify({ mid: true, ps: null }); return JSON.stringify({ wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, innerW: window.innerWidth }); })()";

/* t840's SWAP_B / SWAP_C, verbatim */
const SWAP_B = (px) =>
  "(() => { const hdr = document.querySelector('header'); const cwm0 = hdr.querySelector('div.min-w-0.leading-tight'); if (!cwm0) return JSON.stringify({ error: 'no wm' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cwm = clone.querySelector('div.min-w-0.leading-tight'); if (!cwm) return JSON.stringify({ error: 'clone walk failed' }); cwm.style.maxWidth = '" +
  px +
  "px'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, fix: cwm.style.maxWidth }); })()";
const SWAP_C =
  "(() => { const hdr = document.querySelector('header'); const mid = hdr.children[0].children[3]; const cw = mid.children[1]; const ctrig0 = cw && cw.querySelector('button, [role=combobox]'); if (!ctrig0) return JSON.stringify({ error: 'no trig' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cmid = clone.querySelector('header').children[0].children[3]; const ctw = cmid.children[1].querySelector('button, [role=combobox]'); if (!ctw) return JSON.stringify({ error: 'clone walk failed' }); ctw.style.width = '150px'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, fix: ctw.style.width }); })()";

const fontsWait = () => {
  for (let i = 0; i < 6; i++) {
    if (evalJson("document.fonts.status") === "loaded") return;
    ab("wait 400");
  }
};
const freshLoad = () => {
  ab("open http://localhost:3000/");
  ab("set viewport 1280 800");
  ab("wait 500");
  fontsWait();
};

const mid2 = (b) => (b && b.midKids ? b.midKids.map((k) => k.w).join("/") : "?");

/* live rulers on THIS load */
freshLoad();
console.log("LIVE @1280:", JSON.stringify(evalJson(BAND_MEASURE)));
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  console.log(`LIVE @${w}:`, JSON.stringify(evalJson(BAND_MEASURE)));
}

/* option (b88) across the zone */
ab("set viewport 1280 800");
ab("wait 350");
console.log("swapB88:", evalJson(SWAP_B(88)).swapped);
ab("wait 500");
fontsWait();
console.log("B88 @1280 zone:", JSON.stringify(evalJson(MEASURE)), "band:", mid2(evalJson(BAND_MEASURE)));
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  const z = evalJson(MEASURE);
  const b = evalJson(BAND_MEASURE);
  console.log(`B88 @${w} zone:`, JSON.stringify(z), "band:", mid2(b), "edges:", b.leftW, b.rightW, b.seats);
}

/* option (c) across the zone */
freshLoad();
console.log("swapC:", evalJson(SWAP_C).swapped);
ab("wait 500");
fontsWait();
console.log("C @1280 zone:", JSON.stringify(evalJson(MEASURE)), "band:", mid2(evalJson(BAND_MEASURE)));
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  const z = evalJson(MEASURE);
  const b = evalJson(BAND_MEASURE);
  console.log(`C @${w} zone:`, JSON.stringify(z), "band:", mid2(b), "edges:", b.leftW, b.rightW, b.seats);
}
