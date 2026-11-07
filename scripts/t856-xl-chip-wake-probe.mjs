#!/usr/bin/env node
/**
 * t856 probe — the ELEVENTH SEAT's measurement pass (measure first, then
 * pin): the xl chip's WAKE EDGE. The sweep's far edge (G block, t852)
 * showed the mid row's FOURTH kid asleep at 1366/1440 (w 0) but awake at
 * 1536/1920 (w 90.3) — the wake point was never pinned. 1536 is
 * Tailwind's 2xl breakpoint, so the candidate law is "the stats chip is
 * BORN at 2xl" — but the readings rule, and the wake's exact width, the
 * chip's growth above it, and the label's response are all unpinned.
 * The t853 below zone taught the form: a local edge law (its squeeze
 * zone was [768, 770]) — the far mirror asks: is the wake a POINT or a
 * ZONE, and who pays at the wake moment?
 *
 * Second candidate law: the "Active workspace" label's width form.
 * The sweep's rows read 143.6 @1366, 160 @1440, 150.9 @1536 (a
 * WAKE-MOMENT transient — the label yields 9.1 while the chip is born),
 * 160 @1920 (recovered). Does the label pay AT the wake and recover
 * above it, or is 150.9 a plateau?
 *
 * Third question: the chip's growth law — 90.3 at 1536 AND 1920
 * (constant), or does it grow?
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

/* the walks, verbatim from the t840 family */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const px = Math.min(tr.right - 0.5, cr.left + 0.5); const py = tr.top + tr.height / 2; const who = (el) => (el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : el === psWrap || psWrap.contains(el) ? 'WRAP' : 'OTHER'); const lbl = (el) => el.getAttribute('aria-label') || String(el.className).slice(0, 26); const paintEl = document.elementFromPoint(px, py); const wm = document.querySelector('div.min-w-0.leading-tight'); const wmW = wm ? Math.round(wm.getBoundingClientRect().width * 10) / 10 : null; const csW = getComputedStyle(psWrap); return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, wmW, paintAt: paintEl ? who(paintEl) + '|' + lbl(paintEl) : 'null', wrapOverflowX: csW.overflowX, innerW: window.innerWidth }); })()";

const BAND_MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; const midKids = mid && mid.getBoundingClientRect().width > 0 ? [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })) : null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ leftW: Math.round(left.getBoundingClientRect().width * 10) / 10, rightW: Math.round(right.getBoundingClientRect().width * 10) / 10, seats: seats, midKids: midKids, innerW: window.innerWidth }); })()";

const fontsWait = () => {
  for (let i = 0; i < 6; i++) {
    if (evalJson("document.fonts.status") === "loaded") return;
    ab("wait 400");
  }
};

const ride = async (w) => {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  return { zone: evalJson(MEASURE), band: evalJson(BAND_MEASURE) };
};

const kids = (r) => (r.band.midKids || []).map((k) => k.w);

/* the T0 load itself */
ab("open http://localhost:3000/");
ab("set viewport 1280 800");
ab("wait 500");
fontsWait();

/* 1 — the bracket: where does the fourth kid wake? */
console.log("— the bracket —");
let lo = 1440, hi = 1536; /* lo asleep, hi awake (the sweep's own points) */
for (const w of [1440, 1460, 1480, 1500, 1520, 1536]) {
  const r = await ride(w);
  const k = kids(r);
  const awake = k[3] > 0;
  console.log(`@${w}: kids [${k.join(", ")}] leftW ${r.band.leftW} — chip ${awake ? "AWAKE " + k[3] : "asleep"}`);
  if (!awake && w > lo) lo = w;
  if (awake && w < hi) hi = w;
}

/* 2 — the binary search to 1px */
console.log("\n— the binary search —");
while (hi - lo > 1) {
  const w = Math.floor((lo + hi) / 2);
  const r = await ride(w);
  const k = kids(r);
  const awake = k[3] > 0;
  console.log(`@${w}: chip ${awake ? "AWAKE " + k[3] : "asleep"} (kids [${k.join(", ")}])`);
  if (awake) hi = w; else lo = w;
}
console.log(`\nWAKE POINT: last asleep ${lo}, first awake ${hi}`);

/* 3 — the wake's neighborhood: the label's response at the moment */
console.log("\n— the wake neighborhood (band + zone) —");
for (const w of [lo, hi, hi + 1]) {
  const r = await ride(w);
  const k = kids(r);
  console.log(`@${w}: kids [${k.join(", ")}] leftW ${r.band.leftW} rightW ${r.band.rightW} seats ${r.band.seats}`);
  console.log(`      zone: ${JSON.stringify(r.zone).slice(0, 150)}`);
}

/* 4 — the growth law + the label's recovery above the wake */
console.log("\n— above the wake: chip growth + label recovery —");
for (const w of [hi, hi + 100, 1536, 1600, 1720, 1920]) {
  if (w < hi) continue;
  const r = await ride(w);
  const k = kids(r);
  console.log(`@${w}: kids [${k.join(", ")}] — chip ${k[3]}, label ${k[0]}, psWrap ${k[1]} leftW ${r.band.leftW}`);
}

/* 5 — the ramps between the wake and 1600: the wrap's second step and
 * the label's recovery — measure the seam finely (the readings revealed
 * a SECOND event above the wake: psWrap 205 -> 220, label 150.9 -> 160) */
console.log("\n— the ramps (1536 -> 1600, fine) —");
for (const w of [1538, 1540, 1545, 1550, 1555, 1560, 1566, 1570, 1575, 1580, 1585, 1590, 1600]) {
  const r = await ride(w);
  const k = kids(r);
  console.log(`@${w}: label ${k[0]} psWrap ${k[1]} chip ${k[3]} leftW ${r.band.leftW} overlap ${r.zone.overlap} wmW ${r.zone.wmW}`);
}
console.log("\n— claims, not judges (the t854/t855 lesson): the wake at 1536 = 2xl is a CANDIDATE; the readings rule —");
