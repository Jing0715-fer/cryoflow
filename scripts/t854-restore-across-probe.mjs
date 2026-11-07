#!/usr/bin/env node
/**
 * t854 probe — the NINTH SEAT's measurement pass (measure first, then
 * pin): the restore's width form. T5/T10 pin the restore at 1280 only
 * (zone + band bit-for-bit the BEFORE truth); the restore load has
 * never walked the zone's width neighborhood. This probe fresh-loads
 * the world (the T5 restore itself), then rides 1283/1286 on THAT load
 * with BOTH walks — the ninth seat's comparators are the T0 load's own
 * width rulers (liveAcross), so a green ride means TWO things at once:
 * (1) the world's EXIT state == its ENTRY state at every width the
 * table walks (T10 extended across the zone — the harness's own loop
 * closes), and (2) two independent fresh loads of the same build film
 * the same world bit-for-bit across widths (a harness-stability law
 * nobody has pinned yet).
 *
 * Questions: does the restore load's band == the live band bit-for-bit
 * at 1283 AND 1286 (leftW 610.8/613.8, rightW 628.3, seats 12)? Does
 * the zone walk agree bit-for-bit too (wrapW 114.1/112.9, wmW
 * 102.2/103)? Any drift between loads?
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
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const px = Math.min(tr.right - 0.5, cr.left + 0.5); const py = tr.top + tr.height / 2; const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : el === psWrap || psWrap.contains(el) ? 'WRAP' : 'OTHER'); const lbl = (el) => el.getAttribute('aria-label') || String(el.className).slice(0, 26); const paintEl = document.elementFromPoint(px, py); const stack = document.elementsFromPoint(px, py).slice(0, 8).map((el) => who(el) + '|' + lbl(el)); const wm = document.querySelector('div.min-w-0.leading-tight'); const wmW = wm ? Math.round(wm.getBoundingClientRect().width * 10) / 10 : null; const csW = getComputedStyle(psWrap); return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, wmW, paintAt: paintEl ? who(paintEl) + '|' + lbl(paintEl) : 'null', wrapOverflowX: csW.overflowX, innerW: window.innerWidth }); })()";

const BAND_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; const midKids = mid && mid.getBoundingClientRect().width > 0 ? [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })) : null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats: seats, midKids: midKids, innerW: window.innerWidth }); })()";

const fontsWait = () => {
  for (let i = 0; i < 6; i++) {
    if (evalJson("document.fonts.status") === "loaded") return;
    ab("wait 400");
  }
};

/* the T5 restore itself: one fresh load */
ab("open http://localhost:3000/");
ab("set viewport 1280 800");
ab("wait 500");
fontsWait();

const r0 = { zone: evalJson(MEASURE), band: evalJson(BAND_MEASURE) };
console.log(`@1280 restore zone: trigW ${r0.zone.trigW} wrapW ${r0.zone.wrapW} overlap ${r0.zone.overlap} wmW ${r0.zone.wmW} ovx ${r0.zone.wrapOverflowX}`);
console.log(`@1280 restore band: ${r0.band.leftW}/${r0.band.rightW}/${r0.band.seats}`);

const restoreAcross = {};
for (const w of [1283, 1286]) {
  ab(`set viewport ${w} 800`);
  ab("wait 400");
  restoreAcross[w] = { zone: evalJson(MEASURE), band: evalJson(BAND_MEASURE) };
  const r = restoreAcross[w];
  console.log(`@${w} restore zone: trigW ${r.zone.trigW} wrapW ${r.zone.wrapW} overlap ${r.zone.overlap} wmW ${r.zone.wmW} ovx ${r.zone.wrapOverflowX}`);
  console.log(`@${w} restore band: ${r.band.leftW}/${r.band.rightW}/${r.band.seats} midKids [${(r.band.midKids || []).map((k) => k.w).join(", ")}]`);
}
console.log("\n— expected live rulers (the T0 load): leftW 610.8/613.8, rightW 628.3, seats 12, wrapW 114.1/112.9, wmW 102.2/103 —");
console.log("— any delta above is cross-load drift; bit-for-bit equality is the ninth seat's bar —");
