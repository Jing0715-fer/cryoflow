#!/usr/bin/env node
/**
 * t851 probe — the EIGHTH seat's MEASUREMENT pass (measure first, then
 * pin): the decision table's width form, completed. The seventh seat
 * walked the two PAYING options across the zone; the eighth seat walks
 * the other two — (a) the paint and (b138) the no-op — and the bound
 * chain's width form (the wordmark's squeezed box across widths: does
 * the 101.3 loosen, and does the 138 cap ever bind in the zone?).
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

/* t840's walks, verbatim */
const BAND_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; const midKids = mid && mid.getBoundingClientRect().width > 0 ? [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })) : null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats: seats, midKids: midKids, innerW: window.innerWidth }); })()";
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; if (!psWrap) return JSON.stringify({ mid: true, ps: null }); const wm = document.querySelector('div.min-w-0.leading-tight'); const wmW = wm ? Math.round(wm.getBoundingClientRect().width * 10) / 10 : null; return JSON.stringify({ wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, wmW, innerW: window.innerWidth }); })()";

/* t840's SWAP_A / SWAP_B, verbatim */
const SWAP_A =
  "(() => { const hdr = document.querySelector('header'); const mid = hdr.children[0].children[3]; const cw = mid.children[1]; if (!cw) return JSON.stringify({ error: 'no psWrap' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cmid = clone.querySelector('header').children[0].children[3]; const tw = cmid.children[1]; if (!tw) return JSON.stringify({ error: 'clone walk failed' }); tw.style.overflowX = 'hidden'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, fix: tw.style.overflowX }); })()";
const SWAP_B = (px) =>
  "(() => { const hdr = document.querySelector('header'); const cwm0 = hdr.querySelector('div.min-w-0.leading-tight'); if (!cwm0) return JSON.stringify({ error: 'no wm' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cwm = clone.querySelector('div.min-w-0.leading-tight'); if (!cwm) return JSON.stringify({ error: 'clone walk failed' }); cwm.style.maxWidth = '" +
  px +
  "px'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true, fix: cwm.style.maxWidth }); })()";

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
const ride = (tag) => {
  const z = evalJson(MEASURE);
  const b = evalJson(BAND_MEASURE);
  console.log(`${tag} zone:`, JSON.stringify(z), "band edges:", b.leftW, b.rightW, b.seats, "mid:", b.midKids ? b.midKids.map((k) => k.w).join("/") : "?");
  return { z, b };
};

/* live rulers on THIS load */
freshLoad();
const live = {};
live["1280"] = ride("LIVE @1280");
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  live[String(w)] = ride(`LIVE @${w}`);
}

/* option (a) — the paint — across the zone (same load as the live rulers) */
ab("set viewport 1280 800");
ab("wait 350");
console.log("swapA:", evalJson(SWAP_A).swapped);
ab("wait 500");
fontsWait();
const optA = {};
optA["1280"] = ride("A @1280");
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  optA[String(w)] = ride(`A @${w}`);
}

/* option (b138) — the no-op — across the zone */
freshLoad();
console.log("swapB138:", evalJson(SWAP_B(138)).swapped);
ab("wait 500");
fontsWait();
const optBL = {};
optBL["1280"] = ride("B138 @1280");
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  optBL[String(w)] = ride(`B138 @${w}`);
}

console.log("\nbit-for-bit checks:");
for (const w of ["1280", "1283", "1286"]) {
  const eqA = JSON.stringify(optA[w].b) === JSON.stringify(live[w].b);
  const eqBL = JSON.stringify(optBL[w].b) === JSON.stringify(live[w].b);
  console.log(`@${w}: A==live ${eqA}, B138==live ${eqBL}, wmW live/live-sq: ${live[w].z.wmW} A ${optA[w].z.wmW} B138 ${optBL[w].z.wmW}`);
}
