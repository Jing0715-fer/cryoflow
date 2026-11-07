#!/usr/bin/env node
/**
 * t855 probe — the TENTH SEAT's measurement pass (measure first, then
 * pin): the cross-load identity's FAR+BELOW form. The ninth seat (t854)
 * proved two independent fresh loads film the same world bit-for-bit
 * across the ZONE (1283/1286); the restore load has never walked
 * OUTSIDE the zone. This probe fresh-loads the world (the T5 restore
 * itself), then rides the far edge (1366/1440/1536/1920 — the sweep's
 * G block) and the below zone (768/900/1024 — the sweep's H block) on
 * THAT load with BOTH walks (zone + band). The comparators are the
 * sweep receipt's live rulers (shots-qa/t834-band-sweep.json, same
 * HEIGHT 800 — apples-to-apples), so a green ride means the ninth
 * seat's law holds across the WHOLE width axis: below, zone, far.
 *
 * Questions: does the restore load's band == the live band bit-for-bit
 * at the far edge (leftW 693.8/746.7/863.8/895, rightW 628.3, seats 12)
 * and below (leftW 264/266.5/266.5, rightW 460, seats 11, the mid row
 * asleep)? Does the zone layer agree (wrapW 149.2/170/205/220 far, the
 * mid asleep below)? Any drift between loads?
 *
 * The t854 lesson stamped: the expected-rulers footer is a CLAIM, not
 * the judge — the pins define truth, the readings rule. If this footer
 * and the world disagree, the world wins and the footer learns.
 *
 * Rides only — no receipt, no pins. Kept as provenance.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
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

/* the sweep receipt's live rulers (the T0-load world, HEIGHT 800) */
const sweep = JSON.parse(readFileSync(join(ROOT, "shots-qa/t834-band-sweep.json"), "utf8"));
const liveRows = { ...sweep.farEdge.rows, ...sweep.belowZone.rows };
const liveZone = { ...sweep.farEdge.zone, ...sweep.belowZone.zone };
const liveBandKey = (r) => JSON.stringify({ leftW: r.leftW, rightW: r.rightW, seats: r.seats, midKids: r.midKids, innerW: r.innerW });

/* the T5 restore itself: one fresh load */
ab("open http://localhost:3000/");
ab("set viewport 1280 800");
ab("wait 500");
fontsWait();

const r0 = { zone: evalJson(MEASURE), band: evalJson(BAND_MEASURE) };
console.log(`@1280 restore zone: trigW ${r0.zone.trigW} wrapW ${r0.zone.wrapW} overlap ${r0.zone.overlap} wmW ${r0.zone.wmW} ovx ${r0.zone.wrapOverflowX}`);
console.log(`@1280 restore band: ${r0.band.leftW}/${r0.band.rightW}/${r0.band.seats}`);

const restoreFarBelow = {};
let drifts = 0;
/* the sweep's zone rows carry a 6-key shape (mid, trigW, wrapW, overlap,
 * wmW, paintAt) — no wrapOverflowX/innerW. Cross-receipt comparison
 * projects BOTH sides onto the shared keys; the readings rule, the shape
 * is modeling, not drift (the t854 lesson, learned twice). */
const zoneKeys = ["mid", "trigW", "wrapW", "overlap", "wmW", "paintAt"];
const zoneProj = (z) => JSON.stringify(Object.fromEntries(zoneKeys.map((k) => [k, z[k]])));
for (const w of [1366, 1440, 1536, 1920, 768, 900, 1024]) {
  ab(`set viewport ${w} 800`);
  ab("wait 400");
  const r = { zone: evalJson(MEASURE), band: evalJson(BAND_MEASURE) };
  restoreFarBelow[String(w)] = r;
  const live = liveRows[String(w)];
  const bandEq = live && r.band.innerW === w &&
    JSON.stringify({ leftW: r.band.leftW, rightW: r.band.rightW, seats: r.band.seats, midKids: r.band.midKids, innerW: r.band.innerW }) === liveBandKey(live);
  const zoneEq = liveZone[String(w)] !== undefined &&
    zoneProj(r.zone) === zoneProj(liveZone[String(w)]);
  if (!bandEq) drifts++;
  if (liveZone[String(w)] !== undefined && !zoneEq) drifts++;
  console.log(`@${w} restore band: ${r.band.leftW}/${r.band.rightW}/${r.band.seats} midKids ${r.band.midKids ? "[" + r.band.midKids.map((k) => k.w).join(",") + "]" : "null"} — band==live ${bandEq ? "YES" : "NO"}`);
  console.log(`@${w} restore zone: ${JSON.stringify(r.zone).slice(0, 140)} — zone==live ${zoneEq ? "YES" : "NO"}`);
}
console.log("\n— expected live rulers (the sweep receipt, T0 load @800): far leftW 693.8/746.7/863.8/895 rightW 628.3 seats 12; below leftW 264/266.5/266.5 rightW 460 seats 11 —");
console.log("— the footer is a CLAIM (the t854 lesson): the readings rule; any NO above is either drift or the footer learning —");
console.log(`drifts: ${drifts}`);
