#!/usr/bin/env node
/**
 * t837 — the wordmark's width provenance: the audit's last open constant
 * DERIVED.
 *
 * Carried from the t836 tail: the band audit's closed form (A4e) had one
 * text-dependent pinned variable without its own derivation — the
 * wordmark's 142px, pinned from the t834 live sweep receipt but never
 * derived from anything. It is also the LOAD-BEARING constant: the 768
 * band's 2px squeeze law (A4e-2, natural 266 > available 264) hinges on
 * wm = 142 — if the true text width were 140, natural would be 264 and
 * the squeeze law would be void. A constant that decides a law owes the
 * law its own derivation.
 *
 * The instrument: font metrics. The wordmark box (header.tsx) is
 *
 *   <div className="min-w-0 leading-tight max-md:hidden">
 *     <p className="truncate text-sm font-semibold tracking-tight">CryoFlow</p>
 *     <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
 *       Cryo-EM Workflow Builder
 *     </p>
 *   </div>
 *
 * — two block lines, no padding, no border: the box's natural width is
 * max(line1, line2) at the band where the row does not squeeze (1024,
 * the audit's A4e-3). Each line's advance is measured on a canvas under
 * the element's OWN computed font, with the computed letter-spacing
 * applied (two independent models — canvas ctx.letterSpacing, and the
 * manual raw + ls×len under the CSS trailing-spacing rule — must agree).
 *
 * The same ride witnesses the audit's OTHER text constant: the two
 * ViewSwitcher tab labels (Dashboard / Workflow at text-xs font-medium,
 * the vsXl floor's 120).
 *
 * The t836 law applies: two rides, bit-identical, before any pin is
 * judged. The receipt lands in shots-qa/t837-wordmark-probe.json
 * (provenance: the world key — build id on build days, dev@src-hash
 * otherwise, t859). t861 — the drift ledger aboard: two faces
 * (wordmark / chip) diffed against the PREVIOUS receipt, the family's
 * shared law (scripts/drift-ledger.mjs).
 *
 *   node scripts/t837-wordmark-probe.mjs
 *
 * Sections:
 *   W0  the two-ride bit-identity (the pin precondition)
 *   W1  the seat parses live (the audit's A4d-2, live half)
 *   W2  the two-line structure live (line 2 aboard at 1024 via sm:block)
 *   W3  the derivation closes: |max(lines) − rect| ≤ 0.5
 *   W4  the pin: |round(derived) − 133| ≤ 0.5 (derived, not bare)
 *   W5  the winner is line 2 — the derivation names the 133's carrier
 *   W6  the two letter-spacing models agree (canvas set ≡ manual)
 *   W7  the fonts precondition (document.fonts loaded before the ride)
 *   W8  the labels' 115 witnessed by the same ruler (±0.5)
 *
 * t901 PREMISE AUDIT — RE-PINNED FOR THE GEIST WORLD: the t895 font law
 * (body font-sans; Geist loads AND is consumed) moved every text metric
 * this ruler prices — the fallback's 142.47/120/90.3 became the Geist
 * world's 133.21/114.82/86.97 (live-measured, two rides bit-identical).
 * The old pins ride as PROVENANCE; the C6 num cross-check is re-scoped:
 * Geist carries a REAL tabular-nums variant the canvas cannot set (no
 * ctx tnum), so the num's own rect stays the honest ruler and the
 * canvas/rect delta is bounded and NAMED, not pinned to 0.
 *
 * t912 SETTLE GATE — the fixed sleeps RETIRED (the t911 finding seated):
 * the first two rides at the t911 key died 'wordmark div not found' —
 * a freshly killed browser against a still-settling dev server raced
 * the recompile, and `wait 500`/`wait 350` bought no honesty, just a
 * fixed prayer. The t909 judge-line already owns the law: a click (or a
 * measure) lands only when it sees. Both openings now POLL for the
 * seat itself (the wordmark div; the 2xl chip) — bounded 20s, the
 * presence arm rides as W7a/C1a, and a seat that never mounts fails
 * LOUDLY instead of measuring a rumor.
 *
 * Section C (t838): the LENS CHIP's 90 — the text-constants family's
 * last seat, the audit's LAST pinned width. The chip (header.tsx, the
 * t510 yield-first law's yielder) is a BOX derivation, not a bare text:
 *
 *   border 1×2 + px-2.5 10×2 + gap-1.5 6×2 (three kids, two seams)
 *   + the StickyNote icon (size-3.5 = 14)
 *   + the noted COUNT's advance (tabular-nums — a variant canvas
 *     cannot set, so the span's own live rect is the honest ruler;
 *     the canvas advance rides along as the recorded cross-check)
 *   + the word "noted"'s canvas advance (plain text — the ruler).
 *
 * The chip rides 2xl only, so its band is 1536 (the sweep's seat
 * anatomy band). Fresh-load count = 0 (deterministic); the receipt
 * carries it so a future count change explains its own drift.
 *   C0  the two-ride bit-identity (the t836 law, again)
 *   C1  the chip visible at 1536 with its tier signature (hidden…2xl:flex)
 *   C2  the box chrome parses live: 2 + 20 + 12 (the source classes'
 *       arithmetic, computed-style witnessed)
 *   C3  the icon rides 14 (size-3.5)
 *   C4  the derivation closes: |chrome + icon + num + noted − rect| ≤ 0.5
 *   C5  the pin: |round(derived) − 87| ≤ 0.5 (count recorded)
 *   C6  the canvas cross-checks (noted ±0.5; the num bounded + NAMED —
 *       the tnum variant is the DOM's alone, the t901 re-scope)
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";

const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
};

const ab = (args) =>
  execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

/** agent-browser eval prints the JSON string-encoded; unwrap (twice).
 * One probe lesson paid en route (the t836 narrator law): agent-browser
 * prints a JSON-SHAPED string as-is but ENCODES a plain string ("loaded"
 * → "loaded" quoted) — so parse once, and re-parse only an inner
 * JSON object/array; a plain string IS the value, a second parse dies. */
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

/* ---------- provenance: the world this probe witnesses ---------- */
const world = worldIdentity(ROOT); // t859 — the world key: build id on build days, dev@src-hash otherwise (t858's dev-only world must not strand the battery)
const buildId = world.id;
console.log(`t837 wordmark probe — world ${world.mode}:${buildId}, band 1024 (natural, no squeeze)\n`);

/* viewport 1024: the audit's A4e-3 band — the wordmark sits at its
 * natural width here, the honest ruler for a natural-width constant.
 * t901 premise audit — the t849 law BACK-PORTED: this probe predates the
 * lesson and never opened its own page (in the battery it inherited the
 * previous rider's document); standalone, the fresh browser has NO
 * document and the seat walk dies ('wordmark div not found' —
 * live-captured on this window's first ride). Open first, own the world. */
ab("open http://localhost:3000/");
ab("set viewport 1024 800");

/* t912 settle gate: poll for the seat, never sleep a fixed prayer. A
 * fresh browser against a still-settling server (recompile, cold fonts,
 * hydration) needs PRESENCE, not milliseconds — the loop re-reads the
 * DOM up to ~20s and treats an unopenable page-mouth as 'not yet'. */
let seatSeen = false;
for (let i = 0; i < 40 && !seatSeen; i++) {
  try {
    const gate = evalJson(
      "JSON.stringify({ wm: !!document.querySelector('header div.min-w-0.leading-tight') })"
    );
    if (gate && gate.wm === true) seatSeen = true;
  } catch {
    /* the page's mouth is not open yet — keep polling */
  }
  if (!seatSeen) ab("wait 500");
}

/* ---------- W7 first: the fonts precondition ---------- */
ok(
  seatSeen,
  "W7a the settle gate: the wordmark seat PRESENT before the ride (polled to presence, the t911 transient's fix — no fixed sleep)"
);
let fontStatus = "";
for (let i = 0; i < 5; i++) {
  fontStatus = evalJson("document.fonts.status");
  if (fontStatus === "loaded") break;
  ab("wait 400");
}
ok(
  fontStatus === "loaded",
  `W7 fonts loaded before the metrics ride (document.fonts.status: ${fontStatus})`
);

/* ---------- the measure: one line, sync IIFE (the t834 lesson) ----------
 * ctx.letterSpacing support probed once with a non-zero value (a 0px
 * probe cannot distinguish support from an expando property); the two
 * models measured per line; the labels measured off the tab spans'
 * computed fonts (display:none resolves fonts fine — no layout needed). */
const MEASURE =
  "(() => { const wm = document.querySelector('header div.min-w-0.leading-tight'); if (!wm) return JSON.stringify({ error: 'wordmark div not found' }); const ctx = document.createElement('canvas').getContext('2d'); let lsOK = true; try { ctx.letterSpacing = '2px'; lsOK = ctx.letterSpacing === '2px'; ctx.letterSpacing = '0px'; } catch (e) { lsOK = false; } const lsPx = (cs) => (cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0); const line = (p) => { const cs = getComputedStyle(p); const font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; ctx.font = font; const raw = ctx.measureText(p.textContent).width; const ls = lsPx(cs); let wSet = raw; if (lsOK) { ctx.letterSpacing = ls + 'px'; wSet = ctx.measureText(p.textContent).width; ctx.letterSpacing = '0px'; } const wMan = raw + ls * p.textContent.length; return { text: p.textContent, font, display: cs.display, ls: cs.letterSpacing, raw: Math.round(raw * 100) / 100, wSet: Math.round(wSet * 100) / 100, wMan: Math.round(wMan * 100) / 100 }; }; const lines = [...wm.querySelectorAll('p')].map(line); const vis = lines.filter((l) => l.display !== 'none'); const derived = vis.length ? Math.max(...vis.map((l) => (lsOK ? l.wSet : l.wMan))) : 0; const labels = [...document.querySelectorAll('header [role=tablist] [role=tab] span')].map((s) => { const cs = getComputedStyle(s); const c2 = document.createElement('canvas').getContext('2d'); c2.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; const ls = lsPx(cs); return { text: s.textContent, w: Math.round((c2.measureText(s.textContent).width + ls * s.textContent.length) * 100) / 100 }; }); const labelsSum = Math.round(labels.reduce((a, b) => a + b.w, 0) * 100) / 100; return JSON.stringify({ rect: Math.round(wm.getBoundingClientRect().width * 100) / 100, cls: wm.className, lsOK, lines, derived: Math.round(derived * 100) / 100, labels, labelsSum, innerW: window.innerWidth }); })()";

const run1 = evalJson(MEASURE);
const run2 = evalJson(MEASURE);
const bit = JSON.stringify(run1) === JSON.stringify(run2);

/* ---------- the assertions ---------- */
console.log("");
ok(
  bit && !run1.error,
  `W0 two rides bit-identical (the t836 law)${run1.error ? " — " + run1.error : ""}`
);
if (run1.error) {
  console.log(`\nFLEET-SWEEP t837: ${pass}/${pass + fail} green`);
  ab("set viewport 1280 800");
  process.exit(1);
}

const r = run1;
ok(
  r.cls === "min-w-0 leading-tight max-md:hidden",
  `W1 the seat parses live (the audit's A4d-2 half) — got "${r.cls}"`
);

const [l1, l2] = r.lines;
ok(
  l1 && l2 && l1.display === "block" && l2.display === "block",
  `W2 the two-line structure live at 1024 (line 2 aboard via sm:block) — got "${l1.display}" / "${l2.display}"`
);
ok(
  Math.abs(r.derived - r.rect) <= 0.5,
  `W3 the derivation closes: |max(lines) − rect| ≤ 0.5 — derived ${r.derived} vs rect ${r.rect}`
);
ok(
  Math.abs(Math.round(r.derived) - 133) <= 0.5,
  `W4 the pin stays, now DERIVED (the t901 re-pin — the t895 font law's Geist metrics; the fallback's 142 rides as provenance): round(${r.derived}) = ${Math.round(r.derived)}`
);
ok(
  l2 && Math.max(l1.wSet, l2.wSet) === l2.wSet,
  `W5 the winner is line 2 "${l2.text}" (11px/400) — it carries the 133 (the fallback era's 142 rides as provenance); line 1 "${l1.text}" rides ${l1.wSet}`
);
const modelsAgree = r.lines.every((l) => Math.abs(l.wSet - l.wMan) <= 0.1);
ok(
  r.lsOK && modelsAgree,
  `W6 the two letter-spacing models agree (canvas set ≡ manual, ±0.1) — lsOK ${r.lsOK}, line1 ${l1.wSet}/${l1.wMan}, line2 ${l2.wSet}/${l2.wMan}`
);
ok(
  Math.abs(r.labelsSum - 115) <= 0.5,
  `W8 the labels' 115 witnessed by the same ruler (±0.5; the t901 re-pin — the fallback's 120 rides as provenance) — sum ${r.labelsSum} (${r.labels.map((l) => `${l.text} ${l.w}`).join(" + ")})`
);

/* ---------- section C: the lens chip's 90 — the family's last seat ----------
 * band 1536 (2xl — the chip's tier); SVG classNames are SVGAnimatedString
 * (the SVG lesson: cls() falls back to getAttribute). The number's advance
 * is variant-dependent (tabular-nums) — its own live rect is the honest
 * ruler; the canvas advance rides as the recorded cross-check (C6). */
ab("set viewport 1536 800");
/* t912 settle gate, the chip's leg: `set viewport` RELOADS the page
 * (the t910 law) — the chip is a fresh mount after the dance, so the
 * same presence poll replaces `wait 350`. */
let chipSeen = false;
for (let i = 0; i < 40 && !chipSeen; i++) {
  try {
    const gate = evalJson(
      "JSON.stringify({ chip: [...document.querySelectorAll('header button')].some((b) => (typeof b.className === 'string' ? b.className : b.getAttribute('class') || '').includes('2xl:flex')) })"
    );
    if (gate && gate.chip === true) chipSeen = true;
  } catch {
    /* the reload's mouth is not open yet — keep polling */
  }
  if (!chipSeen) ab("wait 500");
}
ok(
  chipSeen,
  "C1a the settle gate, chip leg: the 2xl chip PRESENT after the viewport dance (polled, the t910 reload law respected)"
);
const CHIP_MEASURE =
  "(() => { const cls = (c) => (typeof c.className === 'string' ? c.className : c.getAttribute('class') || ''); const chip = [...document.querySelectorAll('header button')].find((b) => cls(b).includes('2xl:flex')); if (!chip) return JSON.stringify({ error: 'chip not found' }); const r = chip.getBoundingClientRect(); const cs = getComputedStyle(chip); const kids = [...chip.children]; const icon = kids.find((c) => c.tagName === 'svg'); const numEl = kids.find((c) => /^[0-9]+$/.test((c.textContent || '').trim())); const notedEl = kids.find((c) => c.textContent === 'noted'); if (!icon || !numEl || !notedEl) return JSON.stringify({ error: 'chip kids incomplete' }); const ctx = document.createElement('canvas').getContext('2d'); const adv = (el) => { const s = getComputedStyle(el); ctx.font = s.fontStyle + ' ' + s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily; return Math.round(ctx.measureText(el.textContent).width * 100) / 100; }; const numRect = Math.round(numEl.getBoundingClientRect().width * 100) / 100; const notedRect = Math.round(notedEl.getBoundingClientRect().width * 100) / 100; const chrome = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.gap) * (kids.length - 1); const derived = Math.round((chrome + icon.getBoundingClientRect().width + numRect + adv(notedEl)) * 100) / 100; return JSON.stringify({ rect: Math.round(r.width * 100) / 100, cls: cls(chip).slice(0, 140), visible: r.width > 0, bw: cs.borderLeftWidth, pl: cs.paddingLeft, gap: cs.gap, kidCount: kids.length, iconW: Math.round(icon.getBoundingClientRect().width * 100) / 100, count: numEl.textContent, numRect, numCanvas: adv(numEl), notedRect, notedCanvas: adv(notedEl), chrome: Math.round(chrome * 100) / 100, derived }); })()";

const cr1 = evalJson(CHIP_MEASURE);
const cr2 = evalJson(CHIP_MEASURE);
const chipBit = JSON.stringify(cr1) === JSON.stringify(cr2);

/* ---------- the DRIFT LEDGER (t861): the family's propagation — the
 * wordmark and the chip join t846's five faces. The comparator is THIS
 * instrument's previous receipt (shape note: t837 rides its world key
 * inside provenance.buildId — loadComparator takes the accessor). Two
 * faces, scalar = rect (each face's own box), identity = the FULL
 * measurement object (lines, labels, chrome, advances). Three arms +
 * the t859 jurisdiction clause — bit-for-bit demanded only on a frozen
 * build-mode key; a dev@ same-key ride records arm-2′ information. */
const cmp = loadComparator(
  ROOT,
  "shots-qa/t837-wordmark-probe.json",
  buildId,
  (r) => (r.provenance ? r.provenance.buildId : r.build)
);
const ledgerFaces = {
  wordmark: ledgerFace(
    cmp.prev && Array.isArray(cmp.prev.runs) ? cmp.prev.runs[0] : null,
    r,
    (m) => (m ? m.rect : null)
  ),
  chip: ledgerFace(
    cmp.prev && cmp.prev.chip && Array.isArray(cmp.prev.chip.runs) ? cmp.prev.chip.runs[0] : null,
    cr1,
    (m) => (m ? m.rect : null)
  ),
};

/* ---------- the receipt (defined before the assertions so the error
 * path can persist what it saw before exiting) ---------- */
const writeReceipt = () => {
  const receipt = {
    provenance: {
      buildId,
      worldMode: world.mode,
      viewport: "1024x800 (the A4e-3 natural band); the chip at 1536x800 (2xl)",
      instrument: "canvas measureText under the elements' own computed fonts, letter-spacing applied (two models), max-of-lines for the wordmark box, chrome+icon+advances for the chip box; the tabular count's advance from its own live rect",
      date: new Date().toISOString(),
    },
    bitIdentical: bit,
    runs: [run1, run2],
    chip: { bitIdentical: chipBit, runs: [cr1, cr2] },
    driftLedger: {
      prevFound: cmp.prevFound,
      prevBuild: cmp.prevFound ? cmp.prevBuild : null,
      prevDate: cmp.prevFound ? (cmp.prev.provenance ? cmp.prev.provenance.date : cmp.prev.date) : null,
      sameBuild: cmp.sameBuild,
      law: LEDGER_LAW,
      faces: ledgerFaces,
    },
    verdict: fail === 0 ? "green" : "red",
  };
  writeFileSync(
    join(ROOT, "shots-qa/t837-wordmark-probe.json"),
    JSON.stringify(receipt, null, 2)
  );
  console.log(`\nreceipt: /home/z/my-project/shots-qa/t837-wordmark-probe.json`);
};

console.log("\nC — the lens chip's box at 1536 (2xl): the family's last seat");
ok(
  chipBit && !cr1.error,
  `C0 two rides bit-identical (the t836 law, again)${cr1.error ? " — " + cr1.error : ""}`
);
if (cr1.error) {
  ab("set viewport 1280 800");
  writeReceipt();
  console.log(`\nFLEET-SWEEP t837: ${pass}/${pass + fail} green`);
  process.exit(1);
}
const c = cr1;
ok(
  c.visible && c.cls.includes("hidden") && c.cls.includes("2xl:flex"),
  `C1 the chip visible at 1536 with its tier signature (hidden…2xl:flex) — rect ${c.rect}`
);
ok(
  c.chrome === 34 && c.kidCount === 3,
  `C2 the box chrome parses live: ${c.chrome} = border 2 + px-2.5 20 + gap-1.5 6×2 (three kids, two seams — got ${c.kidCount})`
);
ok(
  Math.abs(c.iconW - 14) <= 0.5,
  `C3 the icon rides 14 (size-3.5) — got ${c.iconW}`
);
ok(
  Math.abs(c.derived - c.rect) <= 0.5,
  `C4 the derivation closes: |${c.derived} − ${c.rect}| ≤ 0.5 (chrome ${c.chrome} + icon ${c.iconW} + count "${c.count}" ${c.numRect} + noted ${c.notedCanvas})`
);
ok(
  Math.abs(Math.round(c.derived) - 87) <= 0.5,
  `C5 the pin stays, now DERIVED (the t901 re-pin — the fallback's 90 rides as provenance): round(${c.derived}) = ${Math.round(c.derived)} (count ${c.count} recorded — a future count explains its own drift)`
);
ok(
  Math.abs(c.notedCanvas - c.notedRect) <= 0.5 &&
    c.numRect > 0 && Math.abs(c.numCanvas - c.numRect) <= 2,
  `C6 the canvas cross-checks, the t901 re-scope: noted ${c.notedCanvas} vs rect ${c.notedRect} (±0.5, plain text — the ruler agrees); the num ${c.numCanvas} vs rect ${c.numRect} bounded ≤ 2 and NAMED — Geist's tabular-nums is a REAL variant the canvas cannot set (no ctx tnum), so the span's own rect stays the num's honest ruler and the canvas rides as the recorded variant-witness (the old ±0.5 num pin was the fallback's truth: a font with no tnum variant could not disagree)`
);

/* ---------- restore the working band ---------- */
ab("set viewport 1280 800");

/* ---------- the drift ledger's own verdict (t861) ---------- */
console.log("\nL — the drift ledger (t861: the family's propagation — two faces vs the previous receipt)");
ok(
  ledgerFaces.wordmark && ledgerFaces.chip &&
    Object.values(ledgerFaces).every((f) => "prev" in f && "live" in f && "drift" in f && "identical" in f) &&
    (cmp.prevFound
      ? typeof (cmp.prev.provenance ? cmp.prev.provenance.date : cmp.prev.date) === "string" && typeof cmp.prevBuild === "string"
      : cmp.prevFound === false),
  `L1 the drift ledger is aboard: two faces, each carrying prev/live/drift/identical, the comparator's provenance recorded — ${cmp.prevFound ? `comparator ${cmp.prev.provenance ? cmp.prev.provenance.date : cmp.prev.date} (world ${cmp.prevBuild})` : "first ride — no predecessor"}`
);
for (const [name, f] of Object.entries(ledgerFaces)) {
  const v = armVerdict(cmp, world, f);
  ok(v.ok, `L face ${name} ride-drift law (same key: bit-for-bit vs the previous receipt) — ${v.detail}`);
}

writeReceipt();
console.log(`\nFLEET-SWEEP t837: ${pass}/${pass + fail} green`);
process.exit(fail ? 1 : 0);
