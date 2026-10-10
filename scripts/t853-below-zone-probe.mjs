#!/usr/bin/env node
/**
 * t853 probe — the BELOW-ZONE's measurement pass (measure first, then
 * pin): the band layer has never walked BELOW xl with the zone-form
 * walk. The sweep's BANDS ride 768/1024 with the BAND anatomy only
 * (totals + kids), its ZONE rows start at 1279 (E1's single asleep
 * point), and its far edge (t852's G block) rides 1366+. The twin law's
 * BELOW form is the last unmapped cross-section.
 *
 * Questions: does the mid row truly sleep at the named below tiers
 * (768/900/1024 — both walks)? What does the zone-form walk return
 * there (the residue's below-form)? What is the left row's CHILD-level
 * below anatomy (the B block pins counts, not weights)? What is the
 * wordmark's below-form (wmW) — the t837 natural 142 re-proven at 1024,
 * measured for the first time at 768?
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

/* the sweep's BAND walk, verbatim (t834's MEASURE line) */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'header not found' }); const left = hdr.children[0]; const right = hdr.children[1]; const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const kids = [...left.children].map((c) => ({ cls: (c.className || '').slice(0, 60), w: kid(c) })); const vis = kids.filter((k) => k.w > 0); const rk = [...right.children].map((c) => ({ lbl: c.getAttribute('aria-label') || (c.className || '').slice(0, 30), w: kid(c) })); const rVis = rk.filter((k) => k.w > 0); const mid = left.children[3]; let midKids = null; let ps = null; if (mid && mid.getBoundingClientRect().width > 0) { midKids = [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || (c.className || '').slice(0, 30), w: kid(c) })); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = right.children[0]; if (psTrig && chip && chip.getBoundingClientRect().width > 0) { const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); ps = { trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10 }; } } const seats = rVis.length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats, kids, vis, rightKids: rVis, midKids, ps, innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth }); })()";

/* t852's FAR_ZONE walk, verbatim (the zone-form layer + the wordmark) */
const ZONE_FORM =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const px = Math.min(tr.right - 0.5, cr.left + 0.5); const py = tr.top + tr.height / 2; const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : 'OTHER'); const paintEl = document.elementFromPoint(px, py); const wm = document.querySelector('div.min-w-0.leading-tight'); const wmW = wm ? Math.round(wm.getBoundingClientRect().width * 10) / 10 : null; return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, wmW, paintAt: paintEl ? who(paintEl) + '|' + (paintEl.getAttribute('aria-label') || String(paintEl.className).slice(0, 30)) : 'null' }); })()";

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

for (const w of [768, 900, 1024]) {
  ab(`set viewport ${w} 800`);
  ab("wait 400");
  const z = evalJson(ZONE_FORM);
  const b = evalJson(MEASURE);
  console.log(`@${w} zoneForm: ${JSON.stringify(z)}`);
  console.log(`@${w} band: left ${b.leftW} / right ${b.rightW} / seats ${b.seats} / midKids ${JSON.stringify(b.midKids)} / ps ${JSON.stringify(b.ps)}`);
  console.log(`@${w} leftKids: [${b.vis.map((k) => `${k.w}(${k.cls.slice(0, 22)})`).join(", ")}]`);
  console.log(`@${w} rightKids: [${b.rightKids.map((k) => k.w).join(", ")}]`);
}

/* the below squeeze's EDGE ride: the 768 squeeze is arithmetic (needs
 * 266.5+460+12 = 738.5 vs available 736 => 2.5 on the wordmark), so the
 * zone should end at 770.5 — last squeeze 770, first clear 771. Mirror
 * of the E-block's edge law (last paint 1286, first clear 1287). */
const WM_BOX =
  "(() => { const hdr = document.querySelector('header'); const left = hdr.children[0]; const wm = left.querySelector('div.min-w-0.leading-tight'); if (!wm) return JSON.stringify({ wm: null, leftW: Math.round(left.getBoundingClientRect().width * 10) / 10 }); return JSON.stringify({ wm: Math.round(wm.getBoundingClientRect().width * 10) / 10, leftW: Math.round(left.getBoundingClientRect().width * 10) / 10 }); })()";
console.log("\n— the below squeeze's edge ride —");
for (const w of [767, 769, 770, 771, 772]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  console.log(`@${w} ${JSON.stringify(evalJson(WM_BOX))}`);
}
ab("set viewport 1280 800");
