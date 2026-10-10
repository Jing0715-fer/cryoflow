// t860 — the ride-variance probe: name the ±6/±102 source (the t859 discovery).
//
// The t859 window's drift ledger fired arm-3 on SAME-KEY dev rides: the palette
// oscillated ±6 bimodally, the inspector moved by -1 and later ±102. Two
// hypotheses, and the probe is built to separate them:
//   H1 (door ambiguity) — the saved-view door's first-match finder lands
//      DIFFERENT views/tenants across rides (the restored world carries three
//      saved views; if their DOM order varies, so does the tenant);
//   H2 (async content) — the same tenant's page mounts different content
//      ride-to-ride (the dev overlay, async image groups, the judge worker).
//
// Method: fresh load once, then film the palette face and the inspector face
// N times each — per ride, the FULL sorted button-name list + the dialog
// heading + the palette's open state. Diffs name exactly which buttons move.
// H1 predicts the inspector's HEADING varies; H2 predicts a stable heading
// with moving button sets.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ab = (cmd) => execSync(`agent-browser ${cmd}`, { encoding: "utf8", timeout: 60000 }).trim();
const evalJson = (expr) => {
  const raw = ab(`eval "${expr.replace(/"/g, '\\"')}"`);
  // the eval output may arrive whole-JSON (possibly double-encoded) or with
  // extra log lines around it — parse whole first, brace-slice as fallback
  let out;
  const whole = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  if (whole !== null) out = whole;
  else {
    const s = raw.indexOf("{");
    out = JSON.parse(raw.slice(s));
  }
  if (typeof out === "string") {
    try { out = JSON.parse(out); } catch { /* bare string payload (e.g. "esc") — fine */ }
  }
  return out;
};
const sleep = (ms) => execSync(`sleep ${ms / 1000}`);

// the full-name measure — every button's honest name (aria-label > labelledby >
// text > alt > value > placeholder), sorted, plus the dialog heading + palette ip
const FILM =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const dlg = document.querySelector("[role=dialog]"); const ip = document.querySelector("[cmdk-input]"); const portal = document.querySelector("nextjs-portal"); return JSON.stringify({ url: location.pathname, pageBtns: btns.length, names: btns.map((b) => nameOf(b)).sort(), dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 60) : null, dlgBtns: dlg ? dlg.querySelectorAll("button").length : 0, hasPortal: !!portal, portalBtns: portal ? portal.querySelectorAll("button").length : 0, ip: ip ? "aboard" : null }); })()';

const diffNames = (a, b) => {
  const A = new Map();
  for (const n of a) A.set(n, (A.get(n) || 0) + 1);
  const B = new Map();
  for (const n of b) B.set(n, (B.get(n) || 0) + 1);
  const gone = [], born = [];
  for (const [n, c] of A) if ((B.get(n) || 0) < c) gone.push(`${n} x${c - (B.get(n) || 0)}`);
  for (const [n, c] of B) if ((A.get(n) || 0) < c) born.push(`${n} x${c - (A.get(n) || 0)}`);
  return { gone, born };
};

const rides = [];

console.log("== fresh load ==");
ab("close 2>/dev/null; true");
ab("open http://localhost:3000");
sleep(3500);

/* ---- face P: the palette, six rides ------------------------------------ */
console.log("== face P: the palette, six rides ==");
for (let i = 0; i < 6; i++) {
  evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
  sleep(600);
  evalJson('(() => { const k = new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, metaKey: true, bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); return "cmdk"; })()');
  sleep(900);
  const m = evalJson(FILM);
  rides.push({ face: "palette", ride: i + 1, ...m });
  console.log(`  P${i + 1}: page=${m.pageBtns} dlg=${m.dlgBtns} portal=${m.portalBtns} heading=${JSON.stringify((m.dlgHeading || "").slice(0, 30))}`);
}
// close the palette
evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(600);

/* ---- face I: the inspector via the saved-view door, four rides --------- */
console.log("== face I: the inspector (dashboard → Centered iso view door), four rides ==");
for (let i = 0; i < 4; i++) {
  evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
  sleep(600);
  // the door lives on the DASHBOARD (t844's own header: "dashboard → the saved-view card")
  evalJson('(() => { const t = Array.from(document.querySelectorAll("button")).find((e) => (e.textContent || "").trim() === "Dashboard"); if (!t) return JSON.stringify({ nav: false }); t.click(); return JSON.stringify({ nav: true }); })()');
  sleep(1200);
  const card = evalJson('(() => { const cards = Array.from(document.querySelectorAll("button")).filter((e) => (e.textContent || "").trim().startsWith("Centered iso view")); const b = cards[0]; if (!b) return JSON.stringify({ found: false, count: 0 }); b.click(); return JSON.stringify({ found: true, count: cards.length, label: b.textContent.trim().slice(0, 60) }); })()');
  sleep(1800);
  const m = evalJson(FILM);
  rides.push({ face: "inspector", ride: i + 1, door: card, ...m });
  console.log(`  I${i + 1}: door=${card.found ? `found x${card.count}` : "MISS"} label=${JSON.stringify((card.label || "").slice(0, 40))} page=${m.pageBtns} heading=${JSON.stringify((m.dlgHeading || "").slice(0, 40))}`);
}

/* ---- the diffs ---------------------------------------------------------- */
console.log("== palette diffs (consecutive) ==");
const pr = rides.filter((r) => r.face === "palette");
for (let i = 1; i < pr.length; i++) {
  const d = diffNames(pr[i - 1].names, pr[i].names);
  if (d.gone.length || d.born.length) {
    console.log(`  P${i}->P${i + 1}: +${d.born.length} -${d.gone.length}`);
    for (const b of d.born.slice(0, 8)) console.log(`    + ${b.slice(0, 90)}`);
    for (const g of d.gone.slice(0, 8)) console.log(`    - ${g.slice(0, 90)}`);
  } else console.log(`  P${i}->P${i + 1}: identical`);
}
console.log("== inspector diffs (consecutive) ==");
const ir = rides.filter((r) => r.face === "inspector");
for (let i = 1; i < ir.length; i++) {
  const d = diffNames(ir[i - 1].names, ir[i].names);
  const headSame = ir[i - 1].dlgHeading === ir[i].dlgHeading;
  console.log(`  I${i}->I${i + 1}: heading ${headSame ? "SAME" : "MOVED"} (${JSON.stringify(ir[i - 1].dlgHeading)} -> ${JSON.stringify(ir[i].dlgHeading)}), +${d.born.length} -${d.gone.length}`);
  for (const b of d.born.slice(0, 5)) console.log(`    + ${b.slice(0, 90)}`);
  for (const g of d.gone.slice(0, 5)) console.log(`    - ${g.slice(0, 90)}`);
}

writeFileSync("shots-qa/t860-ride-variance-probe.json", JSON.stringify({ at: new Date().toISOString(), ruler: NAMEOF_LAW, rides }, null, 2));
console.log("receipt: shots-qa/t860-ride-variance-probe.json");
