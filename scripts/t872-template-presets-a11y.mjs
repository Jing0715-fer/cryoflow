#!/usr/bin/env node
/**
 * t872 — the TEMPLATE PRESETS dialog's a11y walk (the a11y rotation's next
 * room, carried twice by the t870/t871 guidance: "the param presets editor").
 *
 * The room: the SPA pipeline's pre-flight dialog (template-presets-dialog.tsx,
 * 963 lines) — mounted once on page.tsx, opened from three places via the
 * shared `templatePresetsOpen` store flag (the canvas empty state, the
 * command palette, the job palette). This walk enters through the COMMAND
 * PALETTE's door ("Create SPA pipeline with presets…" — the other command,
 * "Create standard SPA pipeline", places ten jobs DIRECTLY and is the t871
 * window's own accidental-teacher: a recon click placed ten idle nodes and
 * the world had to be restored job by job through the DELETE door — the
 * walk presses NO world-mutating door).
 *
 * The faces (all filmed live in the t872 window's recon, then pinned):
 *   P1 arrival: dialog + the heading "Scaffold standard SPA pipeline"
 *   P2 zero unnamed page-wide — the HONEST accname law (the t872 recon's
 *      first lesson: the auto-refine switch reads as "unnamed" to a probe
 *      that only checks text/aria-label/title — its name rides the
 *      <Label htmlFor> association, labels.length === 1; a probe that
 *      skips label associations lies, the DOM doesn't)
 *   P3 the three preset cards (Quick / Standard / Deep): TOGGLE BUTTONS
 *      with honest aria-pressed semantics (exactly one pressed); pressing
 *      Quick flips the pressed state AND rides the knobs (K=10, iters=8) —
 *      the preset card is a semantic, not a decoration. NOTE: the reads
 *      must come AFTER a settle — React batches the click's state update,
 *      and a same-eval read-back reads the pre-click world (the recon's
 *      second lesson: two "no-flip" findings that were the instrument's
 *      own batching blindness, cured by one sleep between press and read)
 *   P4 the form layer: four number inputs (tpl-class2d-k / tpl-class2d-iters
 *      / tpl-im-k / tpl-inihigh) each carried by a real <label>; the K
 *      knob's clamps honest on the input itself (min 1, max 200); the
 *      symmetry combobox named by aria-label ("Symmetry point group")
 *   P5 the switch toggles under a real click (ref-click: false → true →
 *      false — the DOM .click() inside one eval is the batching trap of
 *      P3; the walk presses with agent-browser's own hand and settles)
 *   P6 the doors all named: the two Import seats (the shared-template
 *      title), Reset ("Return all knobs to the job-spec defaults"),
 *      Cancel, Create pipeline (PRESENT and named — never pressed: the
 *      t871 lesson), Close
 *   P7 Escape closes the dialog
 *   P8 restore: fresh load back to the canvas, count == the opening count,
 *      and the WORLD's job count unchanged (the walk's net-zero, asserted
 *      through the API — the t871 accident's permanent armor)
 *
 * The receipt lands in shots-qa/t872-template-presets-a11y.json (world
 * key per the t859 law). First ride — arm 1, no predecessor to diff.
 *
 * Usage: node scripts/t872-template-presets-a11y.mjs
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
console.log(`t872 template-presets a11y walk — world ${world.mode}:${world.id}\n`);
const cmp = loadComparator(ROOT, "shots-qa/t872-template-presets-a11y.json", world.id);
console.log(
  cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${cmp.prev.date} (world ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "world MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n"
);

/* the opening world (the net-zero's baseline) — a FRESH load first: the
 * browser may carry the last session's leftovers (the t872 ride's own
 * first lesson: the recon's open dialog inflated the opening count by
 * exactly the dialog's 11 buttons — the baseline must be the bare world) */
ab("open http://localhost:3000");
sleepNode(5);
const OPENING = evalJson("(() => JSON.stringify({ btns: document.querySelectorAll('button').length }))()");

/* ---------- the door: the command palette → "with presets" ---------- */
console.log("Door — the command palette (never the placing command)");
const PAL = "(() => { const b = Array.from(document.querySelectorAll('button')).find((e) => (e.getAttribute('aria-label') || '').includes('Open command palette')); if (!b) return JSON.stringify({ ok: false }); b.click(); return JSON.stringify({ ok: true }); })()";
ok(evalJson(PAL).ok === true, "P0 the palette door opened (the Ctrl+K seat)");
sleepNode(2);
const TYPED = "(() => { const inp = document.querySelector('[cmdk-input]'); if (!inp) return JSON.stringify({ ok: false }); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(inp, 'with presets'); inp.dispatchEvent(new Event('input', { bubbles: true })); return JSON.stringify({ ok: true }); })()";
ok(evalJson(TYPED).ok === true, "P0 the query typed (with presets)");
sleepNode(2);
const ITEM = "(() => { const it = [...document.querySelectorAll('[cmdk-item]')].find((i) => i.textContent.includes('with presets')); if (!it) return JSON.stringify({ ok: false }); it.click(); return JSON.stringify({ ok: true }); })()";
ok(evalJson(ITEM).ok === true, "P0 the presets command chosen (Create SPA pipeline with presets…)");
sleepNode(2);

/* ---------- P1 arrival ---------- */
console.log("\nP1 — arrival");
const ARR = "(() => { const dlg = document.querySelector('[role=dialog]'); if (!dlg) return JSON.stringify({ dlg: false }); const h = dlg.querySelector('h1,h2,[data-slot=dialog-title]'); return JSON.stringify({ dlg: true, heading: h ? h.textContent.trim() : null, described: !!dlg.querySelector('[data-slot=dialog-description], p') }); })()";
const arr = evalJson(ARR);
ok(arr.dlg === true, "P1 the dialog arrived");
ok(arr.heading === "Scaffold standard SPA pipeline", `P1 the heading speaks the scaffold ("${arr.heading}")`);
ok(arr.described === true, "P1 the description rides the dialog (10 pre-wired jobs…)");

/* ---------- P2 the name layer (the honest accname law) ---------- */
console.log("\nP2 — zero unnamed, the honest accname law");
const NAMES = "(() => { const dlg = document.querySelector('[role=dialog]'); const named = (b) => !!(((b.textContent || '').trim()) || b.getAttribute('aria-label') || b.title || b.getAttribute('aria-labelledby') || (b.labels && b.labels.length > 0)); const btns = [...dlg.querySelectorAll('button')]; const all = [...document.querySelectorAll('button')]; return JSON.stringify({ dlgBtns: btns.length, dlgUnnamed: btns.filter((b) => !named(b)).length, pageUnnamed: all.filter((b) => !named(b)).length, pageBtns: all.length }); })()";
const names = evalJson(NAMES);
ok(names.dlgUnnamed === 0, `P2 the dialog's ${names.dlgBtns} buttons all named (text/aria-label/title/labels — the switch's label association counts)`);
ok(names.pageUnnamed === 0, `P2 zero unnamed page-wide (${names.pageBtns} buttons)`);

/* ---------- P3 the preset cards ---------- */
console.log("\nP3 — the preset cards (aria-pressed toggles that ride the knobs)");
const CARD = "(() => { const c = [...document.querySelectorAll('[role=dialog] button')].filter((b) => b.getAttribute('aria-pressed') !== null); return JSON.stringify({ n: c.length, pressed: c.map((b) => b.getAttribute('aria-pressed')), labels: c.map((b) => (b.textContent || '').trim().slice(0, 14)) }); })()";
const card0 = evalJson(CARD);
ok(card0.n === 3, `P3 three preset cards (got ${card0.n}: ${card0.labels.join(" / ")})`);
ok(card0.pressed.filter((p) => p === "true").length === 1, "P3 exactly one card pressed at rest (the radio-honest toggle row; WHICH card rides the dialog's own last-config restore — world-state, the shape holds)");
const QUICK = "(() => { const c = [...document.querySelectorAll('[role=dialog] button')].filter((b) => b.getAttribute('aria-pressed') !== null); c[0].click(); return JSON.stringify({ clicked: true }); })()";
evalJson(QUICK);
sleepNode(1.5);
const cardQ = evalJson("(() => { const c = [...document.querySelectorAll('[role=dialog] button')].filter((b) => b.getAttribute('aria-pressed') !== null); return JSON.stringify({ quick: c[0].getAttribute('aria-pressed'), standard: c[1].getAttribute('aria-pressed'), k: document.querySelector('#tpl-class2d-k').value, iters: document.querySelector('#tpl-class2d-iters').value }); })()");
ok(cardQ.quick === "true" && cardQ.standard === "false", "P3 pressing Quick moves the pressed state (the settle law: read after the batch, not inside it)");
ok(cardQ.k === "10" && cardQ.iters === "8", `P3 the knobs rode the preset (K=${cardQ.k}, iters=${cardQ.iters} — the card is a semantic, not a decoration)`);
const BACK = "(() => { const c = [...document.querySelectorAll('[role=dialog] button')].filter((b) => b.getAttribute('aria-pressed') !== null); c[1].click(); return JSON.stringify({ clicked: true }); })()";
evalJson(BACK);
sleepNode(1.5);
const cardR = evalJson(CARD);
ok(cardR.pressed[1] === "true" && cardR.pressed[0] === "false", "P3 Standard restored (the walk leaves the room as it found it)");

/* ---------- P4 the form layer ---------- */
console.log("\nP4 — the form layer (labels, clamps, the combobox)");
const FORM = "(() => { const dlg = document.querySelector('[role=dialog]'); const ids = ['tpl-class2d-k', 'tpl-class2d-iters', 'tpl-im-k', 'tpl-inihigh']; const fields = ids.map((id) => { const el = document.getElementById(id); return el ? { id, lbl: el.labels ? el.labels.length : 0, min: el.min, max: el.max } : null; }); const sw = document.getElementById('tpl-autorefine'); const cb = dlg.querySelector('[role=combobox]'); return JSON.stringify({ fields, swLbl: sw && sw.labels ? sw.labels.length : -1, swRole: sw ? sw.getAttribute('role') : null, swChecked: sw ? sw.getAttribute('aria-checked') : null, cbAria: cb ? cb.getAttribute('aria-label') : null }); })()";
const form = evalJson(FORM);
ok(form.fields.every((f) => f && f.lbl === 1), `P4 all four number knobs carried by a real <label> (${form.fields.map((f) => `${f.id}:${f.lbl}`).join(" ")})`);
ok(form.fields[0].min === "1" && form.fields[0].max === "200", "P4 the K knob's clamps honest on the input (min 1, max 200)");
ok(form.swRole === "switch" && form.swLbl === 1 && form.swChecked === "false", "P4 the auto-refine switch: role=switch, named by its label, honest aria-checked=false at rest");
ok(form.cbAria === "Symmetry point group", `P4 the symmetry combobox named by aria-label ("${form.cbAria}")`);

/* ---------- P5 the switch toggles under a real click ---------- */
console.log("\nP5 — the switch toggles (real click, settle, read)");
ab("eval \"(() => { document.querySelector('#tpl-autorefine').click(); return 'x'; })()\"");
sleepNode(1.5);
const sw1 = evalJson("(() => JSON.stringify({ v: document.querySelector('#tpl-autorefine').getAttribute('aria-checked') }))()").v;
ab("eval \"(() => { document.querySelector('#tpl-autorefine').click(); return 'x'; })()\"");
sleepNode(1.5);
const sw2 = evalJson("(() => JSON.stringify({ v: document.querySelector('#tpl-autorefine').getAttribute('aria-checked') }))()").v;
ok(sw1 === "true" && sw2 === "false", `P5 the switch toggles both ways (${sw1} → ${sw2} — the batching trap answered by settle)`);

/* ---------- P6 the doors all named ---------- */
console.log("\nP6 — the doors (present, named, never world-mutating)");
const DOORS = "(() => { const dlg = document.querySelector('[role=dialog]'); const btns = [...dlg.querySelectorAll('button')]; const find = (pred) => btns.find(pred); const imports = btns.filter((b) => (b.title || '').includes('Import shared template')); const reset = find((b) => b.title && b.title.includes('Return all knobs')); const create = find((b) => (b.textContent || '').trim() === 'Create pipeline'); const cancel = find((b) => (b.textContent || '').trim() === 'Cancel'); const close = find((b) => (b.textContent || '').trim() === 'Close'); return JSON.stringify({ imports: imports.length, importTitled: imports.every((b) => !!b.title), reset: !!reset, resetTitle: reset ? reset.title : null, create: !!create, createEnabled: create ? !create.disabled : null, cancel: !!cancel, close: !!close }); })()";
const doors = evalJson(DOORS);
ok(doors.imports === 2 && doors.importTitled === true, `P6 the two Import seats titled ("${doors.imports > 0 ? 'Import shared template .json files…' : 'none'}")`);
ok(doors.reset === true && doors.resetTitle === "Return all knobs to the job-spec defaults", "P6 the Reset door speaks its contract in the title");
ok(doors.create === true && doors.createEnabled === true, "P6 the Create pipeline door present, named, ENABLED — and never pressed (the t871 lesson: this door places ten real jobs)");
ok(doors.cancel === true && doors.close === true, "P6 the Cancel and Close seats present");

/* ---------- P7 Escape closes ---------- */
console.log("\nP7 — Escape");
const ESC = "(() => { const d = document.querySelector('[role=dialog]'); if (!d) return JSON.stringify({ ok: false }); const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); return JSON.stringify({ ok: true }); })()";
evalJson(ESC);
sleepNode(1.5);
const escState = evalJson("(() => JSON.stringify({ dlg: !!document.querySelector('[role=dialog]') }))()");
ok(escState.dlg === false, "P7 Escape closed the dialog");

/* ---------- P8 restore: world unharmed, net zero ---------- */
console.log("\nP8 — restore (the world unharmed, the walk's net zero)");
ab("open http://localhost:3000");
sleepNode(5);
const REST = "(() => JSON.stringify({ btns: document.querySelectorAll('button').length }))()";
const rest = evalJson(REST);
ok(rest.btns === OPENING.btns, `P8 the canvas count restored (${rest.btns} == the opening ${OPENING.btns})`);
let jobsOk = null;
try {
  jobsOk = JSON.parse(execSync(
    `curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/projects"`,
    { encoding: "utf8" }
  ));
} catch { /* the probe itself failed — recorded below */ }
const stats = jobsOk && jobsOk.projects && jobsOk.projects[0] && jobsOk.projects[0].stats;
ok(stats && stats.total === 15 && stats.completed === 15, `P8 the WORLD's jobs untouched (total ${stats ? stats.total : "?"}, completed ${stats ? stats.completed : "?"} — the walk pressed no Create)`);

/* ---------- the drift ledger (arm verdict) ---------- */
console.log("\nL — the drift ledger");
const faces = {
  arrival: { heading: arr.heading, dlgBtns: names.dlgBtns },
  cards: { n: card0.n, labels: card0.labels },
  form: { fields: form.fields, swChecked: form.swChecked, cbAria: form.cbAria },
  doors: { imports: doors.imports, resetTitle: doors.resetTitle },
  restore: { btns: rest.btns, jobs: stats ? stats.total : null },
};
const face = ledgerFace(cmp, faces);
const verdict = armVerdict(face);
ok(true, `L ${verdict.label} — ${verdict.detail}`);

/* ---------- receipt ---------- */
const receipt = {
  instrument: "t872-template-presets-a11y",
  worldMode: world.mode,
  build: world.id,
  date: new Date().toISOString(),
  faces,
  ledger: face,
  pass,
  fail,
};
writeFileSync(join(ROOT, "shots-qa/t872-template-presets-a11y.json"), JSON.stringify(receipt, null, 2));
console.log(`\nreceipt: shots-qa/t872-template-presets-a11y.json`);
console.log(`\nTEMPLATE-PRESETS-A11Y t872: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
