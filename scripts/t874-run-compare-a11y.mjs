#!/usr/bin/env node
/**
 * t874 — the RUN A/B dialog's a11y walk (the compare family's second room,
 * carried by the t873 guidance) + THE ESCAPE DISEASE, filmed live.
 *
 * The room: run-compare-dialog.tsx (849 lines) — the per-row verdict
 * between two runs of the SAME stage (t439/t440/t453: CTF / Motion /
 * Class, one face). At the demo world only the CLASS domain's door
 * renders (the typeGate /class2d|class3d/ makes the 2D and 3D
 * Classification runs siblings for each other; CTF and Motion have one
 * run each — their doors honestly absent). The world's numbers: 2D =
 * 50 classes × 2 particles (fraction 0.0208), 3D = 4 classes × 24
 * (fraction 0.25) — so the pair (2D host, 3D sibling) yields 4 paired
 * classes, ALL gained (median Δ +22.9%), and 46 honest unpaired in A
 * (PAIRED OR SILENT, filmed live).
 *
 * The faces (all filmed live in the t874 window's recon, then pinned):
 *   P0  opening baseline (the bare canvas; NO clean-room wipe needed —
 *       this dialog persists NOTHING by design: "an A/B is a question
 *       about the CURRENT pair", the header's own law)
 *   P1  the entrance: dynamic pan (the t873 law) → the 2D card → the
 *       inspector → the Class A/B door (aria-label with the sibling
 *       count, title with the domain's own verdict sentence)
 *   P2  arrival: two dialogs, the heading "Class A/B — Occupancy share",
 *       the intro, and the t804 house cure: the scroll region with
 *       tabIndex=0 and its own name (keyboard-reachable scroll)
 *   P3  the name layer: zero unnamed (the four-way honest accname law)
 *   P4  the pair pickers: Run A named and holding the host ("(this
 *       run)"), Run B named and defaulting to the first sibling
 *       (derived — "one click from a verdict, zero effects")
 *   P5  the verdict chips: 4 gained / 0 lost / 0 held, median Δ +22.9%
 *       of 4 paired, and the unpaired chips ("unpaired: 46 in A · 0 in
 *       B") — the amber honesty that never lets unpaired rows vote
 *   P6  the identity scatter: 4 symbols over the dashed 45° line
 *   P7  the named witnesses: "Biggest gains" (4 rows, "Class 001 2.1%
 *       → 25.0% (+22.9%)") and "Biggest losses" with its honest empty
 *       state ("none — the whole pack moved the other way")
 *   P8  the trust line: the concentration census ("the top 5 classes
 *       hold 8.3% → 100.0% … across 4 paired classes")
 *   P9  the honest absence of the lens chips (CLASS_LENSES is one lens —
 *       "a one-lens domain speaks in its heading", the shared kit's law)
 *   P10 the adoption verbs' honest contracts: the plain verb DISABLED
 *       with the graph's own reason ("All 1 downstream wire(s) refused
 *       — cycle" — the tutorial chain's 2D→3D edge would close a loop,
 *       planAdoption refuses it); the select rider disabled with its
 *       plan; the Open run A / Open run B doors pinned, NEVER pressed
 *   P11 the A===B world: switching Run A to the sibling makes A===B —
 *       the verdict speaks 0 gained / 0 lost / 4 held, median 0.0%, the
 *       adoption title reads "Runs A and B are the same run — adoption
 *       needs two different runs", and the select rider VANISHES
 *       (improved = 0); then Run A returns to the host and the verdict
 *       is restored
 *   P12 THE ESCAPE DISEASE (the walk's core finding, filmed live on the
 *       pre-fix build): ONE press dismisses BOTH layers (dialogs 2 → 0
 *       — the inspector behind dies with the compare dialog). The
 *       sibling fsc-compare carries a React-level Escape consumer for
 *       exactly this (its lines 482–495); run-compare carried NONE, and
 *       the document-level Radix listeners of both roots fired. THE FIX
 *       IS IN SRC (the shared onEscapeClose helper, the family dialect)
 *       but the prod build predates it — this face records the disease
 *       as a KNOWN RED on this build; the t875 build-day ride expects
 *       n === 1 (the inspector survives) and turns this walk green.
 *   P13 the reopen (the disease killed the inspector too — the walk
 *       re-enters through the canvas): the door still present, Run A
 *       back on the host (the NO PERSISTENCE law: "reopening starts
 *       from the host again"), the verdict rebuilt
 *   P14 teardown: fresh load back to the opening canvas count
 *   P15 the WORLD's job count through the API, opening == closing
 *
 * The receipt lands in shots-qa/t874-run-compare-a11y.json (world key
 * per the t859 law). First ride — arm 1, no predecessor to diff.
 *
 * Usage: node scripts/t874-run-compare-a11y.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict } from "./drift-ledger.mjs";

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); }
};
const sleepNode = (s) => { execSync(`sleep ${s}`); };
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`); }
  if (typeof out === "string") out = JSON.parse(out);
  return out;
};

/* ---------- provenance ---------- */
const world = worldIdentity(ROOT);
console.log(`t874 run-compare a11y walk — world ${world.mode}:${world.id}\n`);
const cmp = loadComparator(ROOT, "shots-qa/t874-run-compare-a11y.json", world.id);
console.log(
  cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${cmp.prev.date} (world ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "world MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n"
);

const HOST = "2D Classification (tutorial)"; // the walk's host job
const CMP = `([...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('A/B —')) || null)`;
const selectOption = (labelPart) => evalJson(`(() => { const it = [...document.querySelectorAll('[role=option]')].find(i => (i.textContent||'').includes('${labelPart}')); if (!it) return JSON.stringify({ ok: false }); it.dispatchEvent(new Event('pointerdown', { bubbles: true })); it.dispatchEvent(new Event('pointerup', { bubbles: true })); it.click(); return JSON.stringify({ ok: true }); })()`);

/* ---------- P0 opening baseline ---------- */
console.log("P0 — the opening baseline (the bare canvas; no clean-room wipe — this room persists nothing)");
ab("open http://localhost:3000");
sleepNode(5);
const OPENING = evalJson("(() => JSON.stringify({ btns: document.querySelectorAll('button').length, dialogs: document.querySelectorAll('[role=dialog]').length }))()");
ok(OPENING.dialogs === 0, `P0 the canvas opens bare (${OPENING.btns} buttons, zero dialogs)`);

/* ---------- P1 the entrance ---------- */
console.log("\nP1 — the entrance (dynamic pan, the card, the inspector, the A/B door)");
const cardRect = () => evalJson(`(() => { const b = Array.from(document.querySelectorAll('div[role=button]')).find(x => (x.getAttribute('aria-label')||'').startsWith('${HOST}')); if (!b) return JSON.stringify({ ok: false }); const r = b.getBoundingClientRect(); return JSON.stringify({ ok: true, x: r.x, y: r.y, w: r.width, winW: window.innerWidth, winH: window.innerHeight }); })()`);
let panned = false;
for (let attempt = 0; attempt < 4 && !panned; attempt++) {
  const r = cardRect();
  if (!r.ok) break;
  if (r.x >= 20 && r.x + r.w <= r.winW - 20) { panned = true; break; }
  const dx = Math.round(Math.min(480, r.winW / 2) - (r.x + r.w / 2));
  const sx = Math.round(r.winW / 2), sy = Math.round(r.winH / 2);
  ab("mouse move " + sx + " " + sy); sleepNode(0.4);
  ab("mouse down"); sleepNode(0.4);
  ab("mouse move " + Math.round(sx + dx / 2) + " " + sy); sleepNode(0.4);
  ab("mouse move " + Math.round(sx + dx) + " " + sy); sleepNode(0.4);
  ab("mouse up"); sleepNode(1);
}
ok(panned === true, "P1 the canvas panned onto the host card (the pan is persisted world state — the walk drags dynamically)");
ab(`click "div[role=button][aria-label^='${HOST}']"`);
sleepNode(3);
const insp = evalJson(`(() => { const h = document.querySelector('[role=dialog] [data-slot=dialog-title]'); return JSON.stringify({ heading: h ? (h.textContent||'').trim().slice(0, 45) : null }); })()`);
ok((insp.heading || "").startsWith(`${HOST} — job inspector`), `P1 the inspector arrived ("${insp.heading}")`);
const door = evalJson(`(() => { const d = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); return JSON.stringify({ ok: !!d, al: d ? d.getAttribute('aria-label') : null, title: d ? d.title.slice(0, 50) : null }); })()`);
ok(door.ok === true && (door.al || "").includes("(1 sibling runs available)"), `P1 the Class A/B door speaks its sibling count ("${door.al}")`);
ok((door.title || "").startsWith("Class A/B — paired per-class verdict"), `P1 the door's title is the domain's own verdict sentence ("${door.title}…")`);
ab(`eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); door.click(); return 'x'; })()"`);
sleepNode(3.5);

/* ---------- P2 arrival ---------- */
console.log("\nP2 — arrival (two dialogs, the t804 keyboard-reachable region)");
const arr = evalJson(`(() => { const d = ${CMP}; if (!d) return JSON.stringify({ ok: false }); const h = d.querySelector('[data-slot=dialog-title]'); const region = d.querySelector('[role=region]'); const desc = d.querySelector('[data-slot=dialog-description]'); return JSON.stringify({ ok: true, nDialogs: document.querySelectorAll('[role=dialog]').length, heading: h ? (h.textContent||'').trim() : null, desc: desc ? (desc.textContent||'').slice(0, 40) : null, region: region ? { label: region.getAttribute('aria-label'), tabIndex: region.getAttribute('tabindex') } : null }); })()`);
ok(arr.ok === true && arr.nDialogs === 2, `P2 the A/B dialog floats OVER the inspector (${arr.nDialogs} dialogs)`);
ok(arr.heading === "Class A/B — Occupancy share", `P2 the heading speaks the domain and lens ("${arr.heading}")`);
ok((arr.desc || "").startsWith("Paired per-class verdict"), "P2 the intro asks the domain's own question");
ok(arr.region && arr.region.tabIndex === "0" && (arr.region.label || "").startsWith("Run comparison reading"), `P2 the t804 house cure present (role=region, tabIndex=0, named "${(arr.region?.label || "").slice(0, 40)}…")`);

/* ---------- P3 the name layer ---------- */
console.log("\nP3 — zero unnamed, the honest accname law");
const names = evalJson(`(() => { const d = ${CMP}; const named = (b) => !!(((b.textContent || '').trim()) || b.getAttribute('aria-label') || b.title || b.getAttribute('aria-labelledby') || (b.labels && b.labels.length > 0)); const btns = [...d.querySelectorAll('button')]; return JSON.stringify({ n: btns.length, unnamed: btns.filter(b => !named(b)).length }); })()`);
ok(names.unnamed === 0, `P3 the dialog's ${names.n} buttons all named`);

/* ---------- P4 the pair pickers ---------- */
console.log("\nP4 — the pair pickers (the host leads, B derives)");
const pickers = evalJson(`(() => { const d = ${CMP}; const combos = [...d.querySelectorAll('[role=combobox]')]; return JSON.stringify({ a: combos[0] ? { al: combos[0].getAttribute('aria-label'), text: combos[0].textContent.trim().slice(0, 40) } : null, b: combos[1] ? { al: combos[1].getAttribute('aria-label'), text: combos[1].textContent.trim().slice(0, 40) } : null }); })()`);
ok(pickers.a && pickers.a.al === "Run A" && pickers.a.text.includes("(this run)"), `P4 Run A named and leading ("${pickers.a?.text}")`);
ok(pickers.b && pickers.b.al === "Run B" && (pickers.b.text || "").includes("3D Classification"), `P4 Run B named and derived to the first sibling ("${pickers.b?.text}")`);

/* ---------- P5 the verdict chips ---------- */
console.log("\nP5 — the verdict (counts, median, the unpaired honesty)");
const verdict = evalJson(`(() => { const d = ${CMP}; const t = (d.textContent||''); return JSON.stringify({ gained: t.includes('4 gained'), lost: t.includes('0 lost'), held: t.includes('0 held'), median: t.includes('+22.9%'), pairs: t.includes('of 4 paired'), unpaired: t.match(/unpaired: (\\d+) in A · (\\d+) in B/) }); })()`);
ok(verdict.gained && verdict.lost && verdict.held, "P5 the counts speak (4 gained / 0 lost / 0 held)");
ok(verdict.median && verdict.pairs, "P5 the median rides its pair count (Δ +22.9% of 4 paired)");
ok(verdict.unpaired && verdict.unpaired[1] === "46" && verdict.unpaired[2] === "0", `P5 the unpaired chips honest ("unpaired: ${verdict.unpaired?.[1]} in A · ${verdict.unpaired?.[2]} in B" — never votes)`);

/* ---------- P6 the identity scatter ---------- */
console.log("\nP6 — the identity scatter (above the 45° line)");
const scatter = evalJson(`(() => { const d = ${CMP}; const syms = d.querySelectorAll('.recharts-scatter-symbol').length; const ref = d.querySelectorAll('.recharts-reference-line').length; return JSON.stringify({ syms, ref }); })()`);
ok(scatter.syms === 4 && scatter.ref >= 1, `P6 the 4 gained points over the dashed 45° line (${scatter.syms} symbols, ${scatter.ref} reference line)`);

/* ---------- P7 the named witnesses ---------- */
console.log("\nP7 — the named witnesses (movers, the honest empty state)");
const movers = evalJson(`(() => { const d = ${CMP}; const heads = [...d.querySelectorAll('h3,h4,[class*=font-medium]')].map(h => (h.textContent||'').trim()); const gain = heads.find(t => t.includes('Biggest gains')); const loss = heads.find(t => t.includes('Biggest losses')); const t = (d.textContent||''); return JSON.stringify({ gain, loss, hasClass001: t.includes('Class 001') && t.includes('+22.9%'), emptyLosses: t.includes('none — the whole pack moved the other way') }); })()`);
ok(movers.gain === "Biggest gains (Occupancy share)" && movers.hasClass001 === true, `P7 the gains list named and populated ("${movers.gain}", Class 001 +22.9%)`);
ok(movers.loss === "Biggest losses (Occupancy share)" && movers.emptyLosses === true, "P7 the losses list's honest empty state (none — the whole pack moved the other way)");

/* ---------- P8 the trust line ---------- */
console.log("\nP8 — the trust line (the pairing's own health check)");
const trust = evalJson(`(() => { const d = ${CMP}; const el = [...d.querySelectorAll('div')].map(x => (x.textContent||'').trim()).find(t => t.startsWith('Concentration census:')); return JSON.stringify({ text: el ? el.slice(0, 120) : null }); })()`);
ok((trust.text || "").startsWith("Concentration census:") && (trust.text || "").includes("8.3% → 100.0%"), `P8 the census speaks ("${trust.text?.slice(0, 60)}…")`);

/* ---------- P9 the lens chips' honest absence ---------- */
console.log("\nP9 — the lens chips' honest absence (one-lens domain)");
const tabs = evalJson(`(() => JSON.stringify({ n: [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('A/B —')).querySelectorAll('[role=tab]').length }))()`);
ok(tabs.n === 0, `P9 no lens chips (${tabs.n} tabs — "a one-lens domain speaks in its heading", the shared kit's law)`);

/* ---------- P10 the adoption verbs' honest contracts ---------- */
console.log("\nP10 — the adoption verbs (the graph's own truth in the titles)");
const adopt = evalJson(`(() => { const d = ${CMP}; const a = d.querySelector('[data-testid=adopt-downstream]'); const s = d.querySelector('[data-testid=adopt-with-select]'); const opens = [...d.querySelectorAll('button')].filter(b => /^Open run [AB]$/.test((b.textContent||'').trim())); return JSON.stringify({ a: a ? { disabled: a.disabled, title: a.title } : null, s: s ? { disabled: s.disabled, titled: !!s.title } : null, opens: opens.length }); })()`);
ok(adopt.a && adopt.a.disabled === true && adopt.a.title === "All 1 downstream wire(s) refused — cycle", `P10 the plain verb disabled with the graph's own reason ("${adopt.a?.title}" — the 2D→3D edge would close a loop)`);
ok(adopt.s && adopt.s.disabled === true && adopt.s.titled === true, "P10 the select rider disabled with its own plan's reason");
ok(adopt.opens === 2, `P10 the two Open run doors present — pinned, NEVER pressed (pressing one swaps the inspector's job)`);

/* ---------- P11 the A===B world ---------- */
console.log("\nP11 — the A===B world (the picker can produce it; the verdict holds)");
ab(`eval "(() => { const d = ${CMP}; const trig = [...d.querySelectorAll('[role=combobox]')][0]; trig.click(); return 'x'; })()"`);
sleepNode(1.5);
selectOption("3D Classification");
sleepNode(3);
const same = evalJson(`(() => { const d = ${CMP}; const t = (d.textContent||''); const a = d.querySelector('[data-testid=adopt-downstream]'); const s = d.querySelector('[data-testid=adopt-with-select]'); const combos = [...d.querySelectorAll('[role=combobox]')]; return JSON.stringify({ runA: combos[0].textContent.trim().slice(0, 36), held: t.includes('4 held') && t.includes('median Δ 0.0%'), sameRunTitle: a ? a.title : null, selectGone: !s }); })()`);
ok((same.runA || "").startsWith("3D Classification") && same.held === true, `P11 A===B speaks honestly (4 held, median 0.0% — run A now "${same.runA}")`);
ok(same.sameRunTitle === "Runs A and B are the same run — adoption needs two different runs", `P11 the sameRun contract ("${same.sameRunTitle}")`);
ok(same.selectGone === true, "P11 the select rider VANISHES (improved = 0 — a no-op button is noise, the t448 law)");
ab(`eval "(() => { const d = ${CMP}; const trig = [...d.querySelectorAll('[role=combobox]')][0]; trig.click(); return 'x'; })()"`);
sleepNode(1.5);
selectOption("(this r");
sleepNode(3);
const restored = evalJson(`(() => { const d = ${CMP}; const t = (d.textContent||''); return JSON.stringify({ back: t.includes('4 gained') && t.includes('+22.9%') }); })()`);
ok(restored.back === true, "P11 Run A back on the host — the verdict restored (4 gained, +22.9%)");

/* ---------- P12 THE ESCAPE DISEASE (pre-fix build) ---------- */
console.log("\nP12 — THE ESCAPE DISEASE (filmed on the pre-fix build; the fix is in src, the build lags)");
ab(`eval "(() => { const d = ${CMP}; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'x'; })()"`);
sleepNode(2);
const after = evalJson(`(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()`);
/* THE FACE'S LAW: on a build CARRYING the fix, one press peels ONE layer
   (n === 1, the inspector survives); on the PRE-FIX build both layers
   die (n === 0) — the disease the t874 recon filmed. This walk records
   EITHER as the world's truth but counts only the fixed world as green:
   the pre-fix build's 0 is the DISEASE (a real bug, the fix is in src,
   the t875 build-day ride turns this face green). */
if (after.n === 1) {
  ok(true, "P12 ONE press peeled ONE layer (the fix rides this build — the inspector survives)");
} else if (after.n === 0) {
  fail++;
  console.log(`  ✗ P12 THE ESCAPE DISEASE (pre-fix build): one press killed BOTH layers (dialogs 2 → 0 — the inspector behind dies; the fix (the shared onEscapeClose consumer) is in src, the t875 build-day ride turns this face green)`);
} else {
  ok(false, `P12 unexpected dialog count after Escape: ${after.n}`);
}

/* ---------- P13 the reopen (NO PERSISTENCE) ---------- */
console.log("\nP13 — the reopen (the walk re-enters; the host leads again)");
/* THE FIX CHANGED THIS FACE'S WORLD (the t875 build-day ride's lesson):
   on the PRE-FIX build P12's disease left a BARE canvas, so this face
   clicked the host card directly. On a build CARRYING the fix the
   inspector SURVIVES P12 (the whole point), and its Results tabpanel
   (#radix-*-content-results) covers the card's click point — the raw
   click lands on the tabpanel and agent-browser honestly refuses. The
   law the face is filming is unchanged (the collateral is undoable,
   reopening starts from the host), so the walk peels the SURVIVING
   inspector with its OWN Escape seat first (the layered law's other
   side: one press, one layer, the canvas returns), THEN walks the
   card path — the same door, now with a witness that the peel was
   exactly one layer deep. */
ab(`eval "(() => { const d = document.querySelector('[role=dialog]'); if (!d) return 'x'; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'x'; })()"`);
sleepNode(2);
const peeled = evalJson(`(() => JSON.stringify({ dialogs: document.querySelectorAll('[role=dialog]').length }))()`);
ok(peeled.dialogs === 0, `P13 the surviving inspector peels in ONE press (dialogs after: ${peeled.dialogs} — the layered law from the inspector's own seat)`);
ab("eval \"(() => { document.body.focus(); return 'x'; })()\"");
ab(`click "div[role=button][aria-label^='${HOST}']"`);
sleepNode(3);
const insp2 = evalJson(`(() => JSON.stringify({ d: !!document.querySelector('[role=dialog] [data-slot=dialog-title]') }))()`);
ok(insp2.d === true, "P13 the inspector re-opened (the disease's collateral is undoable — nothing was destroyed)");
ab(`eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); if (door) door.click(); return 'x'; })()"`);
sleepNode(3.5);
const reopen = evalJson(`(() => { const d = ${CMP}; if (!d) return JSON.stringify({ ok: false }); const combos = [...d.querySelectorAll('[role=combobox]')]; const t = (d.textContent||''); return JSON.stringify({ ok: true, runA: combos[0] ? combos[0].textContent.trim().slice(0, 40) : null, verdict: t.includes('4 gained') && t.includes('+22.9%') }); })()`);
ok(reopen.ok === true && (reopen.runA || "").includes("(this run)"), `P13 Run A back on the host ("${reopen.runA}" — the NO PERSISTENCE law: reopening starts from the host again)`);
ok(reopen.verdict === true, "P13 the verdict rebuilt from scratch (4 gained, +22.9%)");

/* ---------- P14 teardown ---------- */
console.log("\nP14 — teardown (fresh load back to the opening canvas)");
ab(`eval "(() => { const d = ${CMP}; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'x'; })()"`);
sleepNode(1.5);
ab(`eval "(() => { const d = document.querySelector('[role=dialog]'); if (!d) return 'x'; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'x'; })()"`);
sleepNode(1.5);
ab("open http://localhost:3000");
sleepNode(5);
const rest = evalJson("(() => JSON.stringify({ btns: document.querySelectorAll('button').length, dialogs: document.querySelectorAll('[role=dialog]').length }))()");
ok(rest.btns === OPENING.btns && rest.dialogs === 0, `P14 fresh load back to the opening canvas (${rest.btns} == ${OPENING.btns} buttons, zero dialogs)`);

/* ---------- P15 the world's job count ---------- */
console.log("\nP15 — the world's jobs untouched (through the API)");
let stats = null;
try {
  stats = JSON.parse(execSync(
    `curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/projects"`,
    { encoding: "utf8" }
  )).projects[0].stats;
} catch { /* the probe itself failed — recorded below */ }
ok(stats && stats.total === 15 && stats.completed === 15, `P15 the WORLD's jobs untouched (total ${stats ? stats.total : "?"}, completed ${stats ? stats.completed : "?"} — the walk pressed no adopt, no open)`);

/* ---------- the drift ledger (per-face, the t857 shape) ---------- */
console.log("\nL — the drift ledger");
const faces = {
  arrival: { nDialogs: arr.nDialogs, heading: arr.heading },
  pickers: { a: pickers.a?.text, b: pickers.b?.text },
  verdict: { unpairedA: verdict.unpaired?.[1], median: "+22.9%", pairs: 4 },
  scatter: { syms: scatter.syms, ref: scatter.ref },
  adoption: { title: adopt.a?.title, opens: adopt.opens },
  sameRun: { held: 4, selectGone: same.selectGone },
  escape: { after: after.n },
  world: { btns: rest.btns, jobs: stats ? stats.total : null },
};
const scalarOf = (m) => m.n ?? m.nDialogs ?? m.syms ?? m.opens ?? m.pairs ?? m.jobs ?? m.btns ?? m.after ?? m.held ?? (m.a != null ? 1 : 0) ?? null;
const prevFaces = cmp.prevFound ? (cmp.prev.faces || null) : null;
const details = [];
let ledgerOk = true;
for (const k of Object.keys(faces).sort()) {
  const f = ledgerFace(prevFaces ? prevFaces[k] : null, faces[k], scalarOf);
  const v = armVerdict(cmp, world, f);
  if (!v.ok) ledgerOk = false;
  const movedNote = f.identical === false && f.moved
    ? ` (moved: ${[...(f.moved.lens || []), ...(f.moved.world || [])].join(", ") || "?"})`
    : "";
  details.push(`${k} ${v.detail.split(" — ")[0]}${f.identical === true ? " identical" : movedNote}`);
}
ok(ledgerOk === true, `L ${details.join(" | ")}`);

/* ---------- receipt ---------- */
const ledger = {};
for (const k of Object.keys(faces).sort()) {
  const f = ledgerFace(prevFaces ? prevFaces[k] : null, faces[k], scalarOf);
  const v = armVerdict(cmp, world, f);
  ledger[k] = { arm: v.detail.split(" — ")[0], ok: v.ok, drift: f.drift, identical: f.identical, moved: f.moved };
}
const receipt = {
  instrument: "t874-run-compare-a11y",
  worldMode: world.mode,
  build: world.id,
  date: new Date().toISOString(),
  faces,
  ledger,
  escapeDisease: after.n === 0 ? "RECORDED (pre-fix build — the fix is in src, the t875 build-day ride turns this face green)" : "FIXED on this build",
  pass,
  fail,
};
writeFileSync(join(ROOT, "shots-qa/t874-run-compare-a11y.json"), JSON.stringify(receipt, null, 2));
console.log(`\nreceipt: shots-qa/t874-run-compare-a11y.json`);
console.log(`\nRUN-COMPARE-A11Y t874: ${pass}/${pass + fail} ${fail === 0 ? "green" : fail === 1 && after.n === 0 ? "RED (the Escape disease, recorded — fix in src)" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
