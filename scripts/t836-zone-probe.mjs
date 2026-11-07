#!/usr/bin/env node
/**
 * t836 — the t510 residue's ZONE PROBE: the stepwise measurement that
 * turns the t835 characterization ("zone [1280, ~1289], clear by 1290")
 * into a table of numbers, so the fix window's zone claim can be pinned
 * as assertions in the sweep (probe first, pin second — the house law).
 *
 *   node scripts/t836-zone-probe.mjs
 *
 * One eval per width, 1px steps 1279..1294 (1279 = just below xl, where
 * the middle tier sleeps — the zone CANNOT start below 1280), plus the
 * wide clearances (1366 / 1440) the t835 characterization named. The
 * overlap is the project trigger's right edge minus the RELION chip's
 * left edge, at 0.1px precision — the same measure the sweep's D4 pins
 * at 2.7 for the 1280 band.
 *
 * No assertions here — this is the exploratory half. The pinned truths
 * land as section E of scripts/t834-band-sweep.mjs (the fix window's
 * ratchet reads THEM, not this probe).
 */
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") out = JSON.parse(out);
  return out;
};

/* one-liner measure: mid-tier visible? trigger right vs chip left. */
const MEASURE =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: false }); const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return JSON.stringify({ mid: true, ps: null }); const tr = psTrig.getBoundingClientRect(); const cr = chip.getBoundingClientRect(); const paint = (x) => { const el = document.elementFromPoint(x, tr.top + tr.height / 2); if (!el) return 'null'; const who = el === psTrig || psTrig.contains(el) ? 'TRIGGER' : el === chip || chip.contains(el) ? 'CHIP' : 'OTHER'; return who + '|' + (el.getAttribute('aria-label') || String(el.className).slice(0, 30)); }; const cs = getComputedStyle(chip); return JSON.stringify({ mid: true, trigW: Math.round(tr.width * 10) / 10, wrapW: Math.round(psWrap.getBoundingClientRect().width * 10) / 10, overlap: Math.round((tr.right - cr.left) * 10) / 10, chipBg: cs.backgroundColor, chipZ: cs.zIndex, inZone: tr.right > cr.left, paintAt: paint(Math.min(tr.right - 0.5, cr.left + 0.5)) }); })()";

const WIDTHS = [
  1279, 1280, 1281, 1282, 1283, 1284, 1285, 1286, 1287, 1288, 1289, 1290,
  1291, 1292, 1294, 1366, 1440,
];

console.log("t836 zone probe — the t510 residue, 1px steps around the xl boundary\n");
const rows = [];
for (const w of WIDTHS) {
  ab(`set viewport ${w} 800`);
  ab("wait 250");
  const m = evalJson(MEASURE);
  if (m.error) {
    console.log(`  ${w}: ERROR ${m.error}`);
    continue;
  }
  const cell =
    m.mid === false
      ? "mid ASLEEP (below xl)"
      : m.overlap !== undefined
        ? `overlap ${String(m.overlap).padStart(6)}  (trig ${m.trigW} / wrap ${m.wrapW})  paint→ ${m.paintAt}  [bg ${m.chipBg} z ${m.chipZ}]`
        : "mid visible, ps/chip NOT FOUND";
  rows.push({ w, ...m });
  console.log(`  ${w}: ${cell}`);
}

/* restore the working band */
ab("set viewport 1280 800");

const zone = rows.filter((r) => r.mid !== false && r.overlap !== undefined);
const firstClear = zone.find((r) => r.overlap <= 0);
const lastPaint = [...zone].reverse().find((r) => r.overlap > 0);
console.log(
  `\nzone read: last paint at ${lastPaint ? lastPaint.w : "n/a"} (${lastPaint ? lastPaint.overlap : "-"}), ` +
    `first clear at ${firstClear ? firstClear.w : "n/a"} (${firstClear ? firstClear.overlap : "-"})`
);
const edge = rows.find((r) => r.w === 1366);
const wide = rows.find((r) => r.w === 1440);
console.log(`wide clearance: 1366 → ${edge ? edge.overlap : "n/a"}, 1440 → ${wide ? wide.overlap : "n/a"}`);
