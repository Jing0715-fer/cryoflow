#!/usr/bin/env node
/**
 * t873 — the COMPARE FSC CURVES dialog's a11y walk (the a11y rotation's next
 * room, carried by the t872 guidance: "the compare dialogs' deep faces" —
 * the t864-era walk covered their openings, the interiors remained un-filmed).
 *
 * The room: fsc-compare-dialog.tsx (968 lines) — the overlay that lines up
 * the project's FSC receipts ("which reconstruction is actually better?").
 * It floats ON TOP of the job inspector modal (two Radix Dialog roots, two
 * dismissable-layer stacks), entered through the FSC card's "compare" chip
 * inside the inspector. The world: 5 FSC-bearing jobs, all completed
 * (postprocess 7.78 Å / 2D 3.18 Å / initial model / 3D class / 3D refine
 * 7.08 Å) — the atCap and autolive branches are honest absences at this
 * world (5 < MAX_CURVES=6, zero running picks).
 *
 * The faces (all filmed live in the t873 window's recon, then pinned):
 *   P0  opening baseline: fresh load, the bare canvas (the t872 law)
 *   P1  the entrance: canvas pan (the SVG canvas is transform-panned —
 *       scrollIntoView is a lie here; the walk drags with the mouse) →
 *       the job card div[role=button] → the inspector → the compare door
 *   P2  arrival: TWO dialogs (the layered structure itself is the first
 *       face), the heading, the picked/6 badge, the description
 *   P3  the name layer: zero unnamed under the HONEST accname law (four
 *       ways), the two role=group aria-labels, the Scan door (aria-label +
 *       title contract + enabled)
 *   P4  the candidate rows: five "Compare {name}" checkboxes, the host row
 *       marked "(this job)", four jump doors titled, the five pours sr-only
 *       sentences (t771's 29th reader), the res span's THREE states (value
 *       for fetched picks, "" for unpicked), the source chip vocabulary
 *   P5  the chart: one line at rest, the toggle group present
 *   P6  the settle law pick: click → settle → read (the t872 batching law)
 *   P7  the params diff table (pickedCount >= 2): the A/B parameter sheet
 *   P8  the interpretation footnote (pickedCount >= 2 && anyData)
 *   P9  the legend chips' aria-pressed hide/show: pressed flips, the
 *       line-through rides, the title flips its contract, the curve leaves
 *       and returns, the params table HOLDS (hidden never touches picked)
 *   P10 the jump doors: present, titled, enabled — and NEVER pressed
 *       (pressing one closes the dialog and swaps the inspector's job —
 *       the t871 lesson inked into this walk too)
 *   P11 the Scan door: pressed (world-safe — it only re-reads the index);
 *       the disabled transient is faster than the shoot window (the
 *       statcache-hot index computes in ms — an honest measurement note),
 *       so the walk pins the RECOVERY: rows intact, picks retained
 *   P12 THE ESCAPE LAYERED TESTIMONY — the room's core deep face: one
 *       Escape peels ONE layer (the compare dialog dies, the inspector
 *       behind survives). The dialog's own onKeyDown consumer (preventDefault
 *       + stopPropagation) lands at the React level before the document-
 *       level Radix listeners; the second press belongs to the inspector's
 *       own Esc seat — a different room, pressed only in P14's teardown.
 *   P13 the reopen restore: the persisted selection survives the close
 *       (localStorage) — badge and legend restored
 *   P14 teardown: picks restored to the opening truth, the localStorage key
 *       written back VERBATIM, the second Escape peels the inspector (each
 *       layer dismissed by its own seat), fresh load back to the opening
 *       canvas count — the walk's net zero
 *   P15 the WORLD's job count through the API, opening == closing (the
 *       t871 accident's permanent armor)
 *
 * The receipt lands in shots-qa/t873-compare-dialogs-a11y.json (world key
 * per the t859 law). First ride — arm 1, no predecessor to diff.
 *
 * Usage: node scripts/t873-compare-dialogs-a11y.mjs
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
console.log(`t873 compare-dialogs a11y walk — world ${world.mode}:${world.id}\n`);
const cmp = loadComparator(ROOT, "shots-qa/t873-compare-dialogs-a11y.json", world.id);
console.log(
  cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${cmp.prev.date} (world ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "world MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n"
);

const PROJECT = "cmvyndf5g0000ou96cbtov6s6"; // the demo world's standing project
const HOST = "Post-process (tutorial)";      // the walk's host job (the official postprocess receipt)
const LS_KEY = `cryoflow.fsc-compare:${PROJECT}`;
/* an embeddable JS EXPRESSION string — interpolated into every probe as
   `const d = ${CMP};` (a function's SOURCE would carry backticks and
   detonate the shell; the t872 lesson: probes are composed, not pasted) */
const CMP = `([...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Compare FSC curves')) || null)`;

/* ---------- P0 opening baseline ---------- */
console.log("P0 — the opening baseline (the bare canvas)");
ab("open http://localhost:3000");
sleepNode(5);
const OPENING = evalJson("(() => JSON.stringify({ btns: document.querySelectorAll('button').length, dialogs: document.querySelectorAll('[role=dialog]').length }))()");
ok(OPENING.dialogs === 0, `P0 the canvas opens bare (${OPENING.btns} buttons, zero dialogs)`);
const savedPick0 = evalJson(`(() => JSON.stringify({ v: localStorage.getItem('${LS_KEY}') }))()`).v;
/* CLEAN ROOM (the t866 law's third teach): the persisted selection is the
   walk's own prior crashes' residue — a walk that reads its starting picks
   from localStorage measures its own history, not the room. The opening
   truth is read VERBATIM (restored at P14), then the bench is wiped: the
   walk always starts host-only, whatever previous rides left behind. */
ab(`eval "(() => { localStorage.removeItem('${LS_KEY}'); return 'x'; })()"`);
sleepNode(0.5);

/* ---------- P1 the entrance (canvas pan — scrollIntoView lies on a transform canvas) ---------- */
console.log("\nP1 — the entrance (pan, the card, the inspector, the compare door)");
/* the canvas PAN is persisted across loads (the workspace's own viewport
   memory) — the card may sit left or right of the viewport; the walk pans
   DYNAMICALLY: read the card's rect, drag the canvas toward center-left,
   repeat until reachable. The catalog drawer (a right-edge overlay) is
   collapsed only when the click reports covered (a pure view state). */
const cardRect = () => evalJson(`(() => { const b = document.querySelector("div[role=button][aria-label^='${HOST}']"); if (!b) return JSON.stringify({ ok: false }); const r = b.getBoundingClientRect(); return JSON.stringify({ ok: true, x: r.x, y: r.y, w: r.width, h: r.height, winW: window.innerWidth, winH: window.innerHeight }); })()`);
let panned = false;
for (let attempt = 0; attempt < 4 && !panned; attempt++) {
  const r = cardRect();
  if (!r.ok) break;
  const inVp = r.x >= 20 && r.x + r.w <= r.winW - 20;
  if (inVp) { panned = true; break; }
  const targetCx = Math.min(480, r.winW / 2);
  const dx = Math.round(targetCx - (r.x + r.w / 2));
  const sx = Math.round(r.winW / 2), sy = Math.round(r.winH / 2);
  ab("mouse move " + sx + " " + sy); sleepNode(0.4);
  ab("mouse down"); sleepNode(0.4);
  ab("mouse move " + Math.round(sx + dx / 2) + " " + sy); sleepNode(0.4);
  ab("mouse move " + Math.round(sx + dx) + " " + sy); sleepNode(0.4);
  ab("mouse up"); sleepNode(1);
}
ok(panned === true, "P1 the canvas panned onto the host card (the pan is persisted world state — the walk drags dynamically, not scrollIntoView)");
let clicked = false;
for (let attempt = 0; attempt < 2 && !clicked; attempt++) {
  try { ab(`click "div[role=button][aria-label^='${HOST}']"`); clicked = true; }
  catch (e) {
    if (String(e).includes("covered")) {
      // the catalog drawer covers the card — collapse it (pure view state)
      ab(`eval "(() => { const c = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'Catalog'); if (c) c.click(); return 'x'; })()"`);
      sleepNode(1.2);
    } else throw e;
  }
}
sleepNode(3);
const insp = evalJson(`(() => { const h = document.querySelector('[role=dialog] [data-slot=dialog-title]'); return JSON.stringify({ heading: h ? (h.textContent||'').trim().slice(0, 45) : null }); })()`);
ok((insp.heading || "").startsWith(`${HOST} — job inspector`), `P1 the inspector arrived ("${insp.heading}")`);
const door = evalJson(`(() => { const d = document.querySelector('[data-testid=fsc-compare-open]'); return JSON.stringify({ ok: !!d, title: d ? d.title.slice(0, 40) : null }); })()`);
ok(door.ok === true && (door.title || "").startsWith("Overlay FSC curves"), `P1 the compare door titled ("${door.title}…")`);
ab('click "[data-testid=fsc-compare-open]"');
sleepNode(3.5);

/* ---------- P2 arrival: TWO dialogs (the layered structure) ---------- */
console.log("\nP2 — arrival (two dialogs, the layering IS the first face)");
const arr = evalJson(`(() => { const d = ${CMP}; if (!d) return JSON.stringify({ ok: false }); const h = d.querySelector('[data-slot=dialog-title]'); const badge = h ? h.querySelector('span') : null; const desc = d.querySelector('[data-slot=dialog-description]'); return JSON.stringify({ ok: true, nDialogs: document.querySelectorAll('[role=dialog]').length, heading: h ? (h.textContent||'').replace(/\\d+\\/6/, '').trim() : null, badge: badge ? badge.textContent.trim() : null, desc: desc ? (desc.textContent||'').slice(0, 40) : null }); })()`);
ok(arr.ok === true && arr.nDialogs === 2, `P2 the compare dialog floats OVER the inspector (${arr.nDialogs} dialogs — the dismissable-layer stack it must respect)`);
ok(arr.heading === "Compare FSC curves", `P2 the heading speaks the overlay ("${arr.heading}")`);
ok(arr.badge === "1/6", `P2 the badge speaks the clean room ("${arr.badge}" — host-only: the bench was wiped at P0, whatever prior rides left)`);
ok((arr.desc || "").startsWith("Overlay the official criterion curve"), "P2 the description rides the dialog");
const badgeAtArrival = arr.badge;

/* ---------- P3 the name layer (the honest accname law) ---------- */
console.log("\nP3 — zero unnamed, the honest accname law");
const names = evalJson(`(() => { const d = ${CMP}; const named = (b) => !!(((b.textContent || '').trim()) || b.getAttribute('aria-label') || b.title || b.getAttribute('aria-labelledby') || (b.labels && b.labels.length > 0)); const btns = [...d.querySelectorAll('button')]; const groups = [...d.querySelectorAll('[role=group]')].map(g => g.getAttribute('aria-label')); const scan = d.querySelector('[data-testid=fsc-compare-rescan]'); return JSON.stringify({ n: btns.length, unnamed: btns.filter(b => !named(b)).length, groups, scan: scan ? { al: scan.getAttribute('aria-label'), titled: !!scan.title, enabled: !scan.disabled } : null }); })()`);
ok(names.unnamed === 0, `P3 the dialog's ${names.n} buttons all named (text/aria-label/title/labels — the four-way law)`);
ok(names.groups.includes("Select jobs to compare") && names.groups.includes("Toggle curves"), `P3 both role=group layers labelled (${names.groups.join(" / ")})`);
ok(names.scan && names.scan.al === "Re-scan the project for FSC curves" && names.scan.titled && names.scan.enabled, "P3 the Scan door: aria-label, title contract, enabled");

/* ---------- P4 the candidate rows ---------- */
console.log("\nP4 — the candidate rows (checkboxes, host mark, jumps, pours, res states)");
const rows = evalJson(`(() => { const d = ${CMP}; const rowEls = [...d.querySelectorAll('[data-testid=fsc-compare-row]')]; const cbs = [...d.querySelectorAll('[role=checkbox]')]; const jumps = [...d.querySelectorAll('[data-testid^=fsc-compare-jump-]')]; const pours = [...d.querySelectorAll('[data-testid^=fsc-compare-pours-]')]; return JSON.stringify({ n: rowEls.length, cbNames: cbs.map(c => c.getAttribute('aria-label')), cbChecked: cbs.map(c => c.getAttribute('aria-checked')), hostMarked: rowEls.some(r => (r.textContent||'').includes('(this job)')), jumps: jumps.map(j => ({ titled: !!j.title, enabled: !j.disabled })), pours: pours.map(p => ({ id: p.getAttribute('data-testid').replace('fsc-compare-pours-',''), sr: (p.querySelector('.sr-only')||{}).textContent || null })), res: rowEls.map(r => (r.querySelector('[data-testid^=fsc-compare-res-]')||{}).textContent), chips: rowEls.map(r => { const c = [...r.querySelectorAll('span')].find(s => /^(postprocess|half-maps)$/.test((s.textContent||'').trim())); return c ? c.textContent.trim() : null; }) }); })()`);
ok(rows.n === 5, `P4 five candidate rows (the project's five FSC-bearing jobs)`);
ok(rows.cbNames.length === 5 && rows.cbNames.every(a => a.startsWith("Compare ")), `P4 all checkboxes named "Compare {job}" (${rows.cbNames[0]}…)`);
ok(rows.hostMarked === true, "P4 the host row marked (this job)");
ok(rows.jumps.length === 4 && rows.jumps.every(j => j.titled && j.enabled), `P4 the four jump doors titled and enabled — pinned, NEVER pressed`);
ok(rows.pours.length === 5 && rows.pours.every(p => (p.sr || "").startsWith("pours ")), `P4 the five pours speak sr-only ("${rows.pours[4].sr}" on refine3d)`);
const resValued = rows.res.filter(r => /^\d+\.\d{2} Å$/.test(r)).length;
ok(resValued >= 1 && rows.res.filter(r => r === "").length >= 1, `P4 the res span's THREE states live (${resValued} fetched, ${rows.res.filter(r => r === "").length} unfetched "" — the honest emptiness)`);
ok(rows.chips.filter(c => c === "postprocess").length === 1 && rows.chips.filter(c => c === "half-maps").length === 4, "P4 the source chip vocabulary (postprocess vs half-maps)");

/* ---------- P5 the chart at rest ---------- */
console.log("\nP5 — the chart at rest");
const chart0 = evalJson(`(() => { const d = ${CMP}; const c = d.querySelector('[data-testid=fsc-compare-chart]'); return JSON.stringify({ present: !!c, lines: c ? c.querySelectorAll('path.recharts-curve.recharts-line-curve').length : 0, toggle: !!d.querySelector('[aria-label="Toggle curves"]'), refLines: c ? [...c.querySelectorAll('.recharts-reference-line')].length : 0 }); })()`);
/* the rest picks ride the persisted selection (the restore latch) — the
   walk pins the INVARIANT (lines == the badge's numerator), not a
   world-specific count */
const restPicks = parseInt(badgeAtArrival, 10);
ok(chart0.present && chart0.lines === restPicks, `P5 the overlay's curves == the badge's picks (${chart0.lines} lines == ${restPicks})`);
ok(chart0.toggle === true, "P5 the toggle group present (aria-label='Toggle curves')");
ok(chart0.refLines >= 2, `P5 the criterion lines drawn (0.143 amber / 0.5 noise — ${chart0.refLines} reference lines)`);

/* ---------- P6 the settle-law pick ---------- */
console.log("\nP6 — the settle law pick (3D Refine joins)");
const PICK = "Compare 3D Refine (tutorial)";
ab(`scrollintoview "button[aria-label='${PICK}']"`); sleepNode(1);
/* the idempotent pick: checked === 'false' is the ONLY state that clicks
   (a toggle fired at a checked box would UN-pick — the 40/46 lesson) */
const ensurePick = (label) => evalJson(`(() => { const cb = document.querySelector("button[aria-label='${label}']"); if (cb && cb.getAttribute('aria-checked') === 'false') cb.click(); return JSON.stringify({ ok: true }); })()`);
ensurePick(PICK.replace("Compare ", "Compare "));
sleepNode(2.5);
const picked = evalJson(`(() => { const d = ${CMP}; const cb = d.querySelector("button[aria-label='${PICK}']"); const badge = d.querySelector('[data-slot=dialog-title] span'); const legend = [...d.querySelectorAll('[data-testid^=fsc-compare-legend-]')]; const c = d.querySelector('[data-testid=fsc-compare-chart]'); const row = [...d.querySelectorAll('[data-testid=fsc-compare-row]')].find(r => r.textContent.includes('3D Refine')); return JSON.stringify({ checked: cb.getAttribute('aria-checked'), badge: badge.textContent.trim(), legendN: legend.length, lines: c.querySelectorAll('path.recharts-curve.recharts-line-curve').length, res: (row.querySelector('[data-testid^=fsc-compare-res-]')||{}).textContent }); })()`);
ok(picked.checked === "true", "P6 the checkbox flipped (read AFTER the settle — the batching trap answered)");
ok(picked.badge !== badgeAtArrival && /^\d\/6$/.test(picked.badge), `P6 the badge moved (${badgeAtArrival} → ${picked.badge})`);
ok(picked.lines === restPicks + 1, `P6 the overlay grew its curve (${restPicks} → ${picked.lines})`);
ok(/^\d+\.\d{2} Å$/.test(picked.res || ""), `P6 the row's res span woke ("${picked.res}")`);

/* ---------- P7 the params diff table ---------- */
console.log("\nP7 — the params diff table (pickedCount >= 2)");
const params = evalJson(`(() => { const d = ${CMP}; const t = d.querySelector('table'); if (!t) return JSON.stringify({ ok: false }); const heads = [...t.querySelectorAll('thead th')].map(th => (th.textContent||'').trim()); return JSON.stringify({ ok: true, heads: heads.slice(0, 4), bodyRows: t.querySelectorAll('tbody tr').length }); })()`);
ok(params.ok === true, "P7 the A/B parameter sheet arrived (the second pick's payload)");
ok(params.heads.length >= 3 && params.heads[0].startsWith("Parameter"), `P7 the sheet columns named (${params.heads.join(" | ").slice(0, 60)}…)`);
ok(params.bodyRows >= 20, `P7 the parameter rows dense (${params.bodyRows} rows)`);

/* ---------- P8 the interpretation footnote ---------- */
console.log("\nP8 — the interpretation footnote");
const foot = evalJson(`(() => { const d = ${CMP}; const p = [...d.querySelectorAll('p')].find(p => (p.textContent||'').includes('stays higher at the right edge')); return JSON.stringify({ ok: !!p }); })()`);
ok(foot.ok === true, "P8 the footnote teaches the reading (the mask's climb vs the divergence)");

/* ---------- P9 the legend chips' aria-pressed hide/show ---------- */
console.log("\nP9 — the legend chips (hide/show, the pressed semantics)");
const chipOf = (name) => `[...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Compare FSC curves')).querySelectorAll('[data-testid^=fsc-compare-legend-]') && [...[...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Compare FSC curves')).querySelectorAll('[data-testid^=fsc-compare-legend-]')].find(l => (l.textContent||'').includes('${name}'))`;
ab(`eval "(() => { const c = ${chipOf("Post-process")}; c.click(); return 'x'; })()"`);
sleepNode(2);
const hid = evalJson(`(() => { const d = ${CMP}; const c = ${chipOf("Post-process")}; const chart = d.querySelector('[data-testid=fsc-compare-chart]'); return JSON.stringify({ pressed: c.getAttribute('aria-pressed'), struck: c.className.includes('line-through'), title: c.title, lines: chart.querySelectorAll('path.recharts-curve.recharts-line-curve').length, tables: d.querySelectorAll('table').length }); })()`);
ok(hid.pressed === "false" && hid.struck === true, `P9 hide: aria-pressed flips false, the line-through rides (${hid.pressed})`);
ok(hid.title.endsWith("click to show this curve"), `P9 the title's contract flips ("…${hid.title.slice(-24)}")`);
ok(hid.lines === picked.lines - 1, `P9 the curve left the overlay (${picked.lines} → ${hid.lines})`);
ok(hid.tables === 1, "P9 the params table HOLDS (hidden never touches picked — the semantics stay honest)");
ab(`eval "(() => { const c = ${chipOf("Post-process")}; c.click(); return 'x'; })()"`);
sleepNode(2);
const shown = evalJson(`(() => { const d = ${CMP}; const c = ${chipOf("Post-process")}; const chart = d.querySelector('[data-testid=fsc-compare-chart]'); return JSON.stringify({ pressed: c.getAttribute('aria-pressed'), struck: c.className.includes('line-through'), lines: chart.querySelectorAll('path.recharts-curve.recharts-line-curve').length }); })()`);
ok(shown.pressed === "true" && shown.struck === false && shown.lines === picked.lines, `P9 show: the curve returns (${shown.lines} lines, pressed ${shown.pressed})`);

/* ---------- P10 the jump doors: pinned, never pressed ---------- */
console.log("\nP10 — the jump doors (present, titled, NEVER pressed)");
const jumps2 = evalJson(`(() => { const d = ${CMP}; const js = [...d.querySelectorAll('[data-testid^=fsc-compare-jump-]')]; return JSON.stringify({ n: js.length, all: js.every(j => !!j.title && !j.disabled && (j.title||'').startsWith('Open ')) }); })()`);
ok(jumps2.n === 4 && jumps2.all === true, `P10 the ${jumps2.n} jump doors present, titled ("Open {job} in the inspector…"), enabled — and never pressed (pressing one swaps the inspector's job; the t871 lesson)`);

/* ---------- P11 the Scan door (world-safe) ---------- */
console.log("\nP11 — the Scan door pressed (world-safe: re-reads the index only)");
ab(`eval "(() => { const d = ${CMP}; d.querySelector('[data-testid=fsc-compare-rescan]').click(); return 'x'; })()"`);
sleepNode(4);
const scanAfter = evalJson(`(() => { const d = ${CMP}; const s = d.querySelector('[data-testid=fsc-compare-rescan]'); const rowEls = [...d.querySelectorAll('[data-testid=fsc-compare-row]')]; const legend = [...d.querySelectorAll('[data-testid^=fsc-compare-legend-]')]; return JSON.stringify({ enabled: !s.disabled, text: (s.textContent||'').trim(), rows: rowEls.length, legendKept: legend.length, pressedKept: legend.every(l => l.getAttribute('aria-pressed') === 'true') }); })()`);
ok(scanAfter.enabled === true && scanAfter.text === "Scan", `P11 the Scan door recovered ("${scanAfter.text}" — the disabled transient is faster than the shoot window: the statcache-hot index computes in ms, an honest measurement note)`);
ok(scanAfter.rows === 5 && scanAfter.legendKept === restPicks + 1 && scanAfter.pressedKept === true, `P11 the re-scan kept the world (rows ${scanAfter.rows}, picks retained)`);

/* ---------- P12 THE ESCAPE LAYERED TESTIMONY ---------- */
console.log("\nP12 — the Escape layered testimony (the core deep face)");
const escBefore = evalJson("(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()").n;
ab(`eval "(() => { const d = ${CMP}; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'x'; })()"`);
sleepNode(2);
const escAfter = evalJson(`(() => { const h = document.querySelector('[role=dialog] [data-slot=dialog-title]'); return JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length, inspectorHeading: h ? (h.textContent||'').trim().slice(0, 45) : null }); })()`);
ok(escBefore === 2 && escAfter.n === 1, `P12 ONE press peeled ONE layer (dialogs ${escBefore} → ${escAfter.n} — the compare dialog's own onKeyDown consumer lands before the document-level Radix listeners)`);
ok((escAfter.inspectorHeading || "").startsWith(`${HOST} — job inspector`), `P12 the inspector behind SURVIVES ("${escAfter.inspectorHeading}")`);

/* ---------- P13 the reopen restore ---------- */
console.log("\nP13 — the reopen restore (persistence across the close)");
ab('scrollintoview "[data-testid=fsc-compare-open]"'); sleepNode(1);
ab('click "[data-testid=fsc-compare-open]"');
sleepNode(3.5);
const reopen = evalJson(`(() => { const d = ${CMP}; const badge = d.querySelector('[data-slot=dialog-title] span'); const legend = [...d.querySelectorAll('[data-testid^=fsc-compare-legend-]')]; return JSON.stringify({ badge: badge.textContent.trim(), legendN: legend.length, allPressed: legend.every(l => l.getAttribute('aria-pressed') === 'true') }); })()`);
ok(reopen.badge === `${restPicks + 1}/6`, `P13 the persisted selection restored (${reopen.badge} — localStorage survives the close-path cache reset)`);
ok(reopen.legendN === restPicks + 1 && reopen.allPressed === true, `P13 the ${reopen.legendN} legend chips all restored pressed`);

/* ---------- P14 teardown: the walk's net zero ---------- */
console.log("\nP14 — teardown (picks restored, the key verbatim, the layers peeled)");
/* the PICKED axis is the rows' checkboxes — the legend chips toggle the
   orthogonal HIDDEN axis (P9); un-picking rides the checkboxes, idempotently.
   ONLY the walk's own addition leaves: the host is the clean-room's own
   starting member (it was checked before the walk picked anything). */
const unpick = (label) => evalJson(`(() => { const cb = document.querySelector("button[aria-label='${label}']"); if (cb && cb.getAttribute('aria-checked') === 'true') cb.click(); return JSON.stringify({ ok: true }); })()`);
unpick("Compare 3D Refine (tutorial)");
sleepNode(1.8);
const badge2 = evalJson(`(() => { const d = ${CMP}; return JSON.stringify({ badge: d.querySelector('[data-slot=dialog-title] span').textContent.trim() }); })()`).badge;
ok(badge2 === "1/6", `P14 the picks back to the host alone (${badge2})`);
ab(`eval "(() => { const d = ${CMP}; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'x'; })()"`);
sleepNode(2);
// the localStorage key written back VERBATIM (the opening truth)
ab(`eval "(() => { localStorage.setItem('${LS_KEY}', ${JSON.stringify(JSON.stringify(savedPick0))}); return 'x'; })()"`);
// the second press belongs to the inspector's own Esc seat (a different room)
ab(`eval "(() => { const d = document.querySelector('[role=dialog]'); const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'x'; })()"`);
sleepNode(2);
const torn = evalJson("(() => JSON.stringify({ dialogs: document.querySelectorAll('[role=dialog]').length }))()");
ok(torn.dialogs === 0, "P14 the second press peeled the inspector (each layer dismissed by its own seat) — the room closed");
ab("open http://localhost:3000");
sleepNode(5);
const rest = evalJson("(() => JSON.stringify({ btns: document.querySelectorAll('button').length, dialogs: document.querySelectorAll('[role=dialog]').length }))()");
ok(rest.btns === OPENING.btns && rest.dialogs === 0, `P14 fresh load back to the opening canvas (${rest.btns} == ${OPENING.btns} buttons, zero dialogs)`);

/* ---------- P15 the world's job count (the API armor) ---------- */
console.log("\nP15 — the world's jobs untouched (through the API)");
let stats = null;
try {
  stats = JSON.parse(execSync(
    `curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/projects"`,
    { encoding: "utf8" }
  )).projects[0].stats;
} catch { /* the probe itself failed — recorded below */ }
ok(stats && stats.total === 15 && stats.completed === 15, `P15 the WORLD's jobs untouched (total ${stats ? stats.total : "?"}, completed ${stats ? stats.completed : "?"} — the walk pressed no jump, no create)`);

/* ---------- the drift ledger (arm verdict) ---------- */
console.log("\nL — the drift ledger");
const faces = {
  arrival: { nDialogs: arr.nDialogs, badge: badgeAtArrival },
  rows: { n: rows.n, jumps: rows.jumps.length, pours: rows.pours.map(p => p.sr), res: rows.res },
  chart: { lines: chart0.lines, refLines: chart0.refLines },
  pick: { badge: picked.badge, lines: picked.lines, res: picked.res },
  params: { heads: params.heads.slice(0, 4), bodyRows: params.bodyRows },
  escape: { before: escBefore, after: escAfter.n },
  restore: { badge: reopen.badge, legendN: reopen.legendN },
  world: { btns: rest.btns, jobs: stats ? stats.total : null },
};
/* the PER-FACE ledger (the t857 shape): each face one ledgerFace + one
   armVerdict, the scalar named per face (a composite faces object has no
   single number — the family's counts are the scalars) */
const scalarOf = (m) => m.n ?? m.nDialogs ?? m.bodyRows ?? m.legendN ?? m.after ?? m.jobs ?? m.btns ?? m.lines ?? null;
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
/* the per-face verdicts are recomputed for the receipt (the same ledgerFace
   calls the ok() gated on — recorded, not re-derived by hand) */
const ledger = {};
for (const k of Object.keys(faces).sort()) {
  const f = ledgerFace(prevFaces ? prevFaces[k] : null, faces[k], scalarOf);
  const v = armVerdict(cmp, world, f);
  ledger[k] = { arm: v.detail.split(" — ")[0], ok: v.ok, drift: f.drift, identical: f.identical, moved: f.moved };
}
const receipt = {
  instrument: "t873-compare-dialogs-a11y",
  worldMode: world.mode,
  build: world.id,
  date: new Date().toISOString(),
  faces,
  ledger,
  pass,
  fail,
};
writeFileSync(join(ROOT, "shots-qa/t873-compare-dialogs-a11y.json"), JSON.stringify(receipt, null, 2));
console.log(`\nreceipt: shots-qa/t873-compare-dialogs-a11y.json`);
console.log(`\nCOMPARE-DIALOGS-A11Y t873: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
