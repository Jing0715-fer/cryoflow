#!/usr/bin/env node
/**
 * t897 — the far plateau's cap hunt (the J-family re-cut's measure-first leg).
 *
 * The t896-era world's wake laws (the old caps: the wrap capped 220 @1570,
 * the label 160 @1570, the wordmark 142.5, the gap −1.0/px above the caps)
 * died with the fallback metrics. The t834 ride measured the NEW wake
 * through 1600: the wrap still climbing (+0.575/px), the label climbing,
 * the wordmark climbing, the gap CONSTANT −209.7 — every cap unfound.
 *
 * This probe rides 1600 → 1920 in steps and prints the raw anatomy, so
 * the re-cut pins the plateau's REAL structure: where the wrap caps,
 * where the label caps, where the wordmark caps, where the gap's
 * constancy breaks (and its slope above the break).
 *
 * Usage: node scripts/t897-far-plateau-probe.mjs   (resident page at :3000)
 */
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error(`unparseable: ${raw.slice(0, 200)}`); }
  if (typeof out === "string") out = JSON.parse(out);
  return out;
};

// kid-level anatomy + the zone-form scalars, one eval per width
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const lbl0 = mid.children[0] ? kid(mid.children[0]) : null; const wm = document.querySelector('div.min-w-0.leading-tight'); if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); return JSON.stringify({ mid: true, label: lbl0, wrapW: kid(psWrap), trigW: Math.round(tr.width * 10) / 10, chipW: kid(chip), overlap: Math.round((tr.right - cr.left) * 10) / 10, wmW: wm ? kid(wm) : null }); })()";

const WIDTHS = [1600, 1610, 1620, 1640, 1660, 1680, 1700, 1720, 1740, 1760, 1780, 1800, 1840, 1880, 1920];
console.log("t897 far plateau probe — the cap hunt, 1600 → 1920\n");
for (const w of WIDTHS) {
  ab(`set viewport ${w} 800`);
  ab("wait 300");
  const m = evalJson(MEASURE);
  if (m.error || !m.mid) { console.log(`${w}: ${JSON.stringify(m)}`); continue; }
  console.log(
    `${w}: label ${m.label} / wrap ${m.wrapW} / trig ${m.trigW} / chip ${m.chipW} / wm ${m.wmW} / ov ${m.overlap}`
  );
}
ab("set viewport 1280 800");
console.log("\nprobe done — viewport restored 1280");
