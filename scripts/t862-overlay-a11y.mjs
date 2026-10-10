#!/usr/bin/env node
/**
 * t862 — the a11y rotation's NEXT PAGE: the overlay tier's cheap pair,
 * walked live with the census's own ruler (zero src).
 *
 * The rotation so far: the census swept the four faces (t698 era), the
 * cheap pair was re-witnessed (t843: canvas + dashboard), the fragile
 * pair was walked (t844: inspector + palette, the deliberate doors),
 * the maintenance sweep stands (t846). The tier nobody has walked with
 * the ruler: the OVERLAY tier — the two doors reachable from the calm
 * canvas with zero mutation and zero fragile chains:
 *   S  the SHORTCUTS DIALOG — the "?" door (the app's own key, the
 *      typing-guarded window listener): DialogTitle "Keyboard
 *      shortcuts", the filter input (aria-label="Filter shortcuts"),
 *      the inventory region (role=region, named), Kbd chips
 *   K  the KNOCK DROPDOWN — the bell door (the header's knock seat,
 *      aria-label="Finish knock settings"): role=menu, the "Chime when
 *      hidden" checkbox (role=menuitemcheckbox + aria-checked), the
 *      permission item (browser-state — named, never gated on label),
 *      "Try the knock"
 *
 * The ruler is the census's own name computation (aria-label ->
 * aria-labelledby resolved -> textContent, img alt, input
 * value/placeholder fallbacks). The t860 settle-wait films each face
 * only after it has STOPPED moving. The filter's functionality is part
 * of the a11y claim: a named input that does nothing would be a name
 * over a corpse — type "canvas", the chips shrink; clear, they return.
 *
 * t861's law applied at birth — the LEDGER is aboard from ride one:
 * the shared helper (drift-ledger.mjs) loads the comparator, cuts the
 * three faces (shortcuts / knock / restored), records the arm verdicts.
 * A corrupt or missing predecessor is a MISSING predecessor (arm 1).
 *
 * Receipt: shots-qa/t862-overlay-a11y.json.
 *
 *   node scripts/t862-overlay-a11y.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";

const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form. */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t862-overlay-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t862 overlay a11y walk — world ${world.mode}:${buildId}, the overlay tier's cheap pair (shortcuts + knock), the census's ruler, the settle-wait\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* ---------- the measure: the census's name computation + overlay fields.
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim(); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return t; } const tc = (el.textContent || "").trim(); if (tc) return tc; if (el.tagName === "IMG") { const a = el.getAttribute("alt"); if (a !== null && a.trim()) return a.trim(); } if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const v = (el.value || "").trim(); if (v) return v; const p = (el.getAttribute("placeholder") || "").trim(); if (p) return p; } return ""; }; const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const dlg = document.querySelector("[role=dialog]"); const menu = document.querySelector("[role=menu]"); const items = menu ? Array.from(menu.querySelectorAll("[role=menuitem],[role=menuitemcheckbox]")) : []; const unItems = items.filter((i) => !nameOf(i)); const region = dlg ? dlg.querySelector("[role=region][aria-label]") : null; const ipS = dlg ? dlg.querySelector("input[aria-label=\\"Filter shortcuts\\"]") : null; const act = document.activeElement; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: !!dlg, dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null, dlgFocus: dlg ? dlg.contains(act) : null, region: region ? { label: region.getAttribute("aria-label"), kbd: region.querySelectorAll("kbd").length } : null, ipS: ipS ? { named: !!nameOf(ipS), value: ipS.value } : null, hasMenu: !!menu, menuItems: items.length, menuUnnamed: unItems.length, menuWho: unItems.slice(0, 4).map((i) => String(i.className).slice(0, 40)), menuChecks: items.filter((i) => i.getAttribute("role") === "menuitemcheckbox").map((i) => i.getAttribute("aria-checked")), menuNames: items.map((i) => nameOf(i).slice(0, 40)), active: act ? (act.getAttribute && act.getAttribute("aria-label")) || act.tagName : null, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

/* t860 — the settle-wait: measure, re-measure, require equality, bounded. */
const settle = (what) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < 6; i++) {
    sleep(0.8);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    m = next;
    if (same) break;
  }
  console.log(`  settled ${what}`);
  return m;
};

const ESC_ALL =
  '(() => { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); const a = document.activeElement || document.body; a.dispatchEvent(k); document.dispatchEvent(k); return "esc"; })()';

/* ---------- Face 0: the calm canvas (the opening count) ---------- */
console.log("Face 0 — the calm canvas (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
ok("O1 the canvas is calm and named (the census's invariant)",
  !m0.hasDlg && !m0.hasMenu && m0.pageUnnamed === 0 && m0.unCtrls === 0 && m0.altless === 0,
  `btns=${m0.pageBtns} ctrls=${m0.ctrls} imgs=${m0.imgs} — zero unnamed anywhere`);

/* ---------- Face S: the shortcuts dialog (the "?" door) ---------- */
console.log("Face S — the shortcuts dialog (the app's own ? key)");
ab(`eval ${JSON.stringify('(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true })); return "asked"; })()')}`);
sleep(1);
const s1 = settle("the shortcuts dialog");
const regionOk = s1.region && String(s1.region.label).startsWith("Keyboard shortcut inventory") && s1.region.kbd > 0;
ok("S1 the dialog arrived: title + focus inside",
  s1.hasDlg && String(s1.dlgHeading).startsWith("Keyboard shortcuts") && s1.dlgFocus === true,
  `heading="${s1.dlgHeading}" focus=${s1.active}`);
ok("S2 the inventory region is named and carries chips",
  regionOk,
  s1.region ? `label="${s1.region.label}" kbd=${s1.region.kbd}` : "region MISSING");
ok("S3 zero unnamed page-wide with the dialog up (the census's invariant holds on the overlay tier)",
  s1.pageUnnamed === 0 && s1.unCtrls === 0 && s1.altless === 0,
  `btns=${s1.pageBtns} ctrls=${s1.ctrls} unnamed=0/0/0`);
ok("S4 the filter input is named (aria-label, not the placeholder's crutch)",
  s1.ipS && s1.ipS.named === true,
  s1.ipS ? `filter value="${s1.ipS.value}"` : "filter MISSING");

/* the filter's functionality — a named input that does nothing is a name
 * over a corpse: type "canvas", the chips shrink; clear, they return. */
const filterTest =
  '(() => { const dlg = document.querySelector("[role=dialog]"); const ip = dlg && dlg.querySelector("input[aria-label=\\\"Filter shortcuts\\\"]"); if (!ip) return JSON.stringify({ found: false }); const region = dlg.querySelector("[role=region][aria-label]"); const before = region.querySelectorAll("kbd").length; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(ip, "canvas"); ip.dispatchEvent(new Event("input", { bubbles: true })); const during = region.querySelectorAll("kbd").length; setter.call(ip, ""); ip.dispatchEvent(new Event("input", { bubbles: true })); const after = region.querySelectorAll("kbd").length; return JSON.stringify({ found: true, before, during, after }); })()';
const ft = evalJson(filterTest);
ok("S5 the filter is ALIVE: 'canvas' shrinks the inventory, clearing restores it bit-for-bit",
  ft.found === true && ft.during < ft.before && ft.after === ft.before && ft.after === s1.region.kbd,
  `kbd ${ft.before} -> ${ft.during} (filtered) -> ${ft.after} (restored)`);

const s2 = settle("the shortcuts dialog (second ride)");
ok("S6 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(s2) === JSON.stringify(s1),
  "the overlay world is stable once settled");

ab(`eval ${JSON.stringify(ESC_ALL)}`);
sleep(1);
const s3 = evalJson(MEASURE);
ok("S7 Escape closes the shortcuts dialog",
  s3.hasDlg === false && s3.pageBtns === m0.pageBtns,
  `dlg=${s3.hasDlg} btns back to ${m0.pageBtns}`);

/* ---------- Face K: the knock dropdown (the bell door) ---------- */
console.log("Face K — the knock dropdown (the header's knock seat)");
ab(`eval ${JSON.stringify('(() => { const b = document.querySelector("button[aria-label=\\\"Finish knock settings\\\"]"); if (!b) return JSON.stringify({ found: false }); const r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); return JSON.stringify({ found: true }); })()')}`);
sleep(1);
const k1 = settle("the knock menu");
ok("K1 the menu arrived (role=menu, the Radix portal)", k1.hasMenu === true && k1.menuItems > 0,
  `items=${k1.menuItems} checks=${JSON.stringify(k1.menuChecks)}`);
ok("K2 every menu item is named (label/checkbox/text — zero unnamed)",
  k1.menuUnnamed === 0,
  k1.menuNames.join(" | "));
ok("K3 the chime checkbox carries a valid aria-checked state (recorded, never gated — browser/world-state)",
  k1.menuChecks.length >= 1 && k1.menuChecks.every((c) => c === "true" || c === "false"),
  `aria-checked=${JSON.stringify(k1.menuChecks)}`);
ok("K4 zero unnamed page-wide with the menu up",
  k1.pageUnnamed === 0 && k1.unCtrls === 0 && k1.altless === 0,
  `btns=${k1.pageBtns}`);

ab(`eval ${JSON.stringify(ESC_ALL)}`);
sleep(1);
const k2 = evalJson(MEASURE);
ok("K5 Escape closes the menu and focus returns to the bell trigger (the Radix contract)",
  k2.hasMenu === false && k2.active === "Finish knock settings",
  `menu=${k2.hasMenu} focus=${k2.active}`);

/* ---------- restore: fresh load back to the calm canvas ---------- */
console.log("Restore — fresh load back to the canvas");
ab("open http://localhost:3000");
sleep(3);
const r1 = settle("the restored canvas");
ok("R1 the world unharmed (canvas count == the opening count, no overlay)",
  !r1.hasDlg && !r1.hasMenu && r1.pageBtns === m0.pageBtns && r1.pageUnnamed === 0,
  `btns=${r1.pageBtns} (opening ${m0.pageBtns})`);

/* ---------- the DRIFT LEDGER (t861's law, at birth) ---------- */
const scalarOf = (m) => m.pageBtns;
const ledgerFaces = {
  shortcuts: ledgerFace(cmp.prev && cmp.prev.faces ? cmp.prev.faces.shortcuts?.live ?? null : null, s1, scalarOf),
  knock: ledgerFace(cmp.prev && cmp.prev.faces ? cmp.prev.faces.knock?.live ?? null : null, k1, scalarOf),
  restored: ledgerFace(cmp.prev && cmp.prev.faces ? cmp.prev.faces.restored?.live ?? null : null, r1, scalarOf),
};
ok("L1 the ledger is aboard at birth: three faces, each carrying prev/live/drift/identical",
  Object.values(ledgerFaces).every((f) => "prev" in f && "live" in f && "drift" in f && "identical" in f) &&
  (cmp.prevFound ? typeof prevReceipt.date === "string" : cmp.prevFound === false),
  cmp.prevFound ? `comparator ${prevReceipt.date} (key ${cmp.prevBuild})` : "first ride — no predecessor");

const verdictOf = (f) => armVerdict(cmp, world, f);
ok("L2 shortcuts face ride-drift law", verdictOf(ledgerFaces.shortcuts).ok, verdictOf(ledgerFaces.shortcuts).detail);
ok("L3 knock face ride-drift law", verdictOf(ledgerFaces.knock).ok, verdictOf(ledgerFaces.knock).detail);
ok("L4 restored face ride-drift law", verdictOf(ledgerFaces.restored).ok, verdictOf(ledgerFaces.restored).detail);

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the overlay tier holds: the shortcuts dialog (the "?" door) arrives named and focused, the inventory region speaks its name, the filter is ALIVE (shrinks and restores the chips), two settled rides bit-identical; the knock menu (the bell door) opens fully named, the chime checkbox carries its aria-checked state, Escape returns focus to the trigger; zero unnamed buttons/controls/imgs on every face; the world restored — and the ledger aboard from birth (three faces, the shared law)`
  : `${fail} red — the overlay tier's name layer moved; call the census's own instruments before any UI work`;

const receipt = {
  instrument: "scripts/t862-overlay-a11y.mjs",
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "canvas -> shortcuts (?) -> knock (bell) -> restored (one command)",
  doors: {
    shortcuts: 'window keydown "?" — the app\'s own typing-guarded listener',
    knock: 'click button[aria-label="Finish knock settings"] — the header\'s knock seat',
  },
  faces: {
    canvas: { live: m0 },
    shortcuts: { live: s1, secondRide: s2, filter: ft, afterEscape: s3 },
    knock: { live: k1, afterEscape: k2 },
    restored: { live: r1 },
  },
  driftLedger: {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    prevDate: cmp.prevFound ? prevReceipt.date : null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces: ledgerFaces,
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
};
writeFileSync(join(ROOT, "shots-qa/t862-overlay-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nOVERLAY-A11Y t862: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
