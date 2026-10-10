#!/usr/bin/env node
/**
 * t852 probe — the FAR EDGE's measurement pass (measure first, then
 * pin): the band layer has never walked ABOVE the zone's neighborhood —
 * the sweep's BANDS stop at 1536 (its MACRO pins) and its ZONE rows at
 * 1440 (the t835 named points). This probe rides the live world at
 * 1366 / 1440 / 1536 / 1920 with BOTH walks (the band anatomy + the
 * zone's MEASURE layer: trigW/wrapW/overlap/paint STACK/wmW), so the
 * far edge's laws can be pinned where they live.
 *
 * Questions: does the cross-layer identity (band wrapper kid == the
 * zone's wrapW) survive 2xl, where THREE mid kids are awake (the chip
 * aboard)? What do the edges/seats do at 1366/1920 (no band walk has
 * ever ridden them)? Is the paint clean at the far edge (the t510
 * residue's far form)?
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

/* the sweep's BAND walk, verbatim (t839's BAND_MEASURE line) */
const BAND_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; const midKids = mid && mid.getBoundingClientRect().width > 0 ? [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })) : null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats: seats, midKids: midKids, innerW: window.innerWidth }); })()";

/* t840's MEASURE walk, verbatim (the zone layer + the wordmark) */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const px = Math.min(tr.right - 0.5, cr.left + 0.5); const py = tr.top + tr.height / 2; const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : el === psWrap || psWrap.contains(el) ? 'WRAP' : 'OTHER'); const lbl = (el) => el.getAttribute('aria-label') || String(el.className).slice(0, 26); const paintEl = document.elementFromPoint(px, py); const stack = document.elementsFromPoint(px, py).slice(0, 8).map((el) => who(el) + '|' + lbl(el)); const wm = document.querySelector('div.min-w-0.leading-tight'); const wmW = wm ? Math.round(wm.getBoundingClientRect().width * 10) / 10 : null; const csW = getComputedStyle(psWrap); return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, wmW, paintAt: paintEl ? who(paintEl) + '|' + lbl(paintEl) : 'null', stack, wrapOverflowX: csW.overflowX, innerW: window.innerWidth }); })()";

const fontsWait = () => {
  for (let i = 0; i < 6; i++) {
    if (evalJson("document.fonts.status") === "loaded") return;
    ab("wait 400");
  }
};

ab("open http://localhost:3000/");
ab("set viewport 1280 800");
ab("wait 500");
fontsWait();

for (const w of [1366, 1440, 1536, 1920]) {
  ab(`set viewport ${w} 800`);
  ab("wait 400");
  const z = evalJson(MEASURE);
  const b = evalJson(BAND_MEASURE);
  const vis = b.midKids ? b.midKids.filter((k) => k.w > 0) : [];
  console.log(`@${w} zone: trigW ${z.trigW} wrapW ${z.wrapW} overlap ${z.overlap} wmW ${z.wmW} paint ${z.paintAt} ovx ${z.wrapOverflowX}`);
  console.log(`@${w} band: ${b.leftW}/${b.rightW}/${b.seats} visibleKids ${vis.length}: [${vis.map((k) => k.w).join(", ")}]`);
  if (vis.length >= 2) {
    const wrapperKid = b.midKids.find((k) => k.lbl.startsWith("flex min-w-0"));
    console.log(`@${w} identity: band wrapper kid ${wrapperKid ? wrapperKid.w : "?"} vs zone wrapW ${z.wrapW} => ${wrapperKid && wrapperKid.w === z.wrapW ? "TWIN" : "SPLIT"}`);
  }
}
