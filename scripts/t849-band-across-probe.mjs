#!/usr/bin/env node
/**
 * t849 probe — the sixth seat's MEASUREMENT pass (measure first, then pin):
 * does the live band's edges drift across the zone widths (1283/1286/1287),
 * and does the fix clone's band at 1286/1287 equal the live band there
 * bit-for-bit? Probe rides only — no receipt, no pins.
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

const BAND_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; const midKids = mid && mid.getBoundingClientRect().width > 0 ? [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })) : null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats: seats, midKids: midKids, innerW: window.innerWidth }); })()";

const SWAP_A =
  "(() => { const hdr = document.querySelector('header'); const mid = hdr.children[0].children[3]; const cw = mid.children[1]; if (!cw) return JSON.stringify({ error: 'no psWrap' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cmid = clone.querySelector('header').children[0].children[3]; const tw = cmid.children[1]; if (!tw) return JSON.stringify({ error: 'clone walk failed' }); tw.style.overflowX = 'hidden'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true }); })()";

const fontsWait = () => {
  for (let i = 0; i < 6; i++) {
    if (evalJson("document.fonts.status") === "loaded") return;
    ab("wait 400");
  }
};

/* live ruler across the zone */
ab("open http://localhost:3000/");
ab("set viewport 1280 800");
ab("wait 500");
fontsWait();
console.log("LIVE @1280:", JSON.stringify(evalJson(BAND_MEASURE)));
for (const w of [1283, 1286, 1287]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  console.log(`LIVE @${w}:`, JSON.stringify(evalJson(BAND_MEASURE)));
}

/* the fix clone across the zone */
ab("set viewport 1280 800");
ab("wait 350");
console.log("swapA:", evalJson(SWAP_A).swapped);
ab("wait 500");
fontsWait();
for (const w of [1286, 1287]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  console.log(`CLONE @${w}:`, JSON.stringify(evalJson(BAND_MEASURE)));
}
