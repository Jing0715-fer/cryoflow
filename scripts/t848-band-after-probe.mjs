#!/usr/bin/env node
/**
 * t848 probe — the fifth seat's MEASUREMENT pass (measure first, then pin):
 * the options rehearsal's clones gain the band layer; this probe rides the
 * BAND walk on the (b88) and (c) clones to LEARN the numbers before the
 * instrument pins them. Probe rides only — no receipt, no pins.
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

const SWAP_B = (px) =>
  "(() => { const hdr = document.querySelector('header'); const cwm0 = hdr.querySelector('div.min-w-0.leading-tight'); if (!cwm0) return JSON.stringify({ error: 'no wm' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cwm = clone.querySelector('div.min-w-0.leading-tight'); if (!cwm) return JSON.stringify({ error: 'clone walk failed' }); cwm.style.maxWidth = '" + px + "px'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true }); })()";
const SWAP_C =
  "(() => { const hdr = document.querySelector('header'); const mid = hdr.children[0].children[3]; const cw = mid.children[1]; const ctrig0 = cw && cw.querySelector('button, [role=combobox]'); if (!ctrig0) return JSON.stringify({ error: 'no trig' }); const orig = document.documentElement; const clone = orig.cloneNode(true); const cmid = clone.querySelector('header').children[0].children[3]; const ctw = cmid.children[1].querySelector('button, [role=combobox]'); if (!ctw) return JSON.stringify({ error: 'clone walk failed' }); ctw.style.width = '150px'; try { document.replaceChild(clone, orig); } catch (e) { document.removeChild(orig); document.appendChild(clone); } return JSON.stringify({ swapped: true }); })()";

const freshLoad = () => {
  ab("open http://localhost:3000/");
  ab("set viewport 1280 800");
  ab("wait 500");
  for (let i = 0; i < 6; i++) {
    if (evalJson("document.fonts.status") === "loaded") return;
    ab("wait 400");
  }
};

freshLoad();
const live = evalJson(BAND_MEASURE);
console.log("LIVE :", JSON.stringify(live));

freshLoad();
console.log("swapB88:", evalJson(SWAP_B(88)).swapped);
ab("wait 500");
const b88 = evalJson(BAND_MEASURE);
console.log("B88  :", JSON.stringify(b88));

freshLoad();
console.log("swapC  :", evalJson(SWAP_C).swapped);
ab("wait 500");
const c = evalJson(BAND_MEASURE);
console.log("C    :", JSON.stringify(c));
