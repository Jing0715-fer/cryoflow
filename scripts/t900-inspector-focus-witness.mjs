#!/usr/bin/env node
/**
 * t900 — THE INSPECTOR'S KEYBOARD-FOCUS FIX, WITNESSED LIVE.
 *
 * The wart (t846's M10 named it, live-captured twice): the inspector's
 * t391 law declined Radix's open auto-focus outright (to kill the ghost
 * tooltip — the header's Focus button is a tooltip trigger and Radix
 * tooltips open on focus), which left the KEYBOARD opener outside the
 * dialog they just opened — Tab from the card walks the whole page, the
 * dialog reachable only after every canvas port.
 *
 * The fix (the middle path): decline the CHILD focus (no trigger focused,
 * no tooltip born) and seat focus on the CONTENT itself (tabindex=-1).
 * The claims under witness:
 *   1. the keyboard door: Enter opens the inspector with focus INSIDE —
 *      on the content node itself;
 *   2. the t391 ghost stays dead: no [role=tooltip] exists after open;
 *   3. Tab walks the dialog's own faces (the first Tab's target is
 *      inside the dialog);
 *   4. the return-address law closes the loop: Escape closes the dialog
 *      and focus returns to the CARD — through the door it came from
 *      (the pocket spent, the t792 layer's own contract);
 *   5. the click door rides the same seat (focus inside, no ghost).
 *
 * Usage: node scripts/t900-inspector-focus-witness.mjs
 */
import { execSync } from "node:child_process";

const JOB = "cmv3x1a020002lt89biep4phx"; // the completed Import card (t846's own door target)

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const ab = (cmd) => sh(`agent-browser ${cmd}`);
const parseAb = (txt) => {
  const t = String(txt ?? "").trim();
  try {
    const v = JSON.parse(t);
    if (typeof v === "string") { try { return JSON.parse(v); } catch { return { raw: v.slice(0, 200) }; } }
    return v;
  } catch { return { raw: t.slice(0, 200) }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (js) => parseAb(ab(`eval "${js}"`));
// one probe for the whole focus truth: where focus sits, whether it is
// the content node, whether a tooltip exists, whether a dialog is open
const FOCUS_PROBE =
  "JSON.stringify({" +
  "dlg: !!document.querySelector('[role=dialog]')," +
  "activeTag: document.activeElement ? document.activeElement.tagName : null," +
  "onContent: document.activeElement === document.querySelector('[data-inspector-dialog]')," +
  "inDlg: (function(){var d=document.querySelector('[data-inspector-dialog]');return d?d.contains(document.activeElement):false})()," +
  "tooltip: !!document.querySelector('[role=tooltip]')," +
  "cardFocused: (function(){var c=document.activeElement;return c?c.hasAttribute('data-card-btn'):false})()" +
  "})";

console.log("t900 inspector focus witness — the keyboard opener lives inside\n");

try {
  ab("open http://localhost:3000/");
  ab("wait 1800");

  /* 1 — the KEYBOARD door: focus + Enter (the fire leg's proven form) */
  ab(`focus '[data-card-btn="${JOB}"]'`);
  ab("press Enter");
  await sleep(1000);
  let p = evalJs(FOCUS_PROBE);
  ok("1 the keyboard door opened the inspector", p.dlg === true, JSON.stringify(p).slice(0, 140));
  ok("1b focus sits INSIDE the dialog", p.inDlg === true, JSON.stringify(p).slice(0, 140));
  ok("1c focus sits on the CONTENT node itself", p.onContent === true, `active=${p.activeTag}`);
  ok("1d the t391 ghost stays dead (no tooltip on open)", p.tooltip === false);
  ab("press Tab");
  await sleep(400);
  p = evalJs(FOCUS_PROBE);
  ok("1e the first Tab walks the dialog's own faces", p.inDlg === true, JSON.stringify(p).slice(0, 140));

  /* 2 — the return-address law: Escape closes, focus returns to the card */
  ab("press Escape");
  await sleep(700);
  p = evalJs(FOCUS_PROBE);
  ok("2 Escape closed the inspector", p.dlg === false, JSON.stringify(p).slice(0, 140));
  ok("2b focus returned THROUGH the door (the card)", p.cardFocused === true, `active=${p.activeTag}`);

  /* 3 — the CLICK door rides the same seat */
  ab(`click '[data-card-btn="${JOB}"]'`);
  await sleep(1000);
  p = evalJs(FOCUS_PROBE);
  ok("3 the click door opened the inspector", p.dlg === true, JSON.stringify(p).slice(0, 140));
  ok("3b focus sits INSIDE (the same seat as the keyboard door)", p.inDlg === true, JSON.stringify(p).slice(0, 140));
  ok("3c the t391 ghost stays dead on the click path too", p.tooltip === false);
  ab("press Escape");
  await sleep(700);
  p = evalJs(FOCUS_PROBE);
  ok("3d the click door's close returns focus to the card", p.dlg === false && p.cardFocused === true, JSON.stringify(p).slice(0, 140));
} finally {
  try { sh("agent-browser close >/dev/null 2>&1 || true"); } catch {}
  ok("4 the browser closed (the first resident closed)", true);
}

console.log(`\nt900 inspector focus witness: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
