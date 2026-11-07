#!/usr/bin/env node
/**
 * t918 — the resolution ARC face's LIVE WITNESS (the t918 entry's first
 * candidate): the compare family's FIFTH question — one ML run vs its
 * OWN resolution estimates ("still sharpening?") — has ridden the same
 * action cluster as the convergence door since t456, but its DIALOG has
 * never been opened live. The t916 mint is the ready law (the world's
 * class2d, 3 rounds, the seed writes a full set); the mock's t456
 * fidelity writes arc_resolution(it) = 3.2 + 24.8·exp(-it/6.5) into
 * every run_itNNN_model.star's data_model_general._rlnCurrentResolution,
 * so the arc is COMPUTABLE — the instrument measures the laws, never its
 * author's memory:
 *
 *   A (API-first, no browser) — the data plane:
 *     A1  GET /resolution-arc on the class2d: 3 rounds [0,1,2], each
 *         resolution ≈ law(it) (2dp tolerance), source "model" (the
 *         serial dialect reads the PLAIN model stars), reported ≈ law(2)
 *     A2  the empty arc honesty: a non-ML job's route answers
 *         rounds:[] reported:null (no model stars — never invents)
 *   C (wide 1280, born-at-band) — the face speaks the law:
 *     C1  the ARC door (Ruler icon) present on the completed class2d's
 *         inspector BESIDE the convergence door, its aria-label counting
 *         the route's own 3 rounds
 *     C2  click-until-effect opens "Resolution arc — <name>"; the t804
 *         region named ("Resolution arc reading — …")
 *     C3  THE FACE IS THE ARC: a recharts LINE (curve path present,
 *         teal #0d9488, one dot per round) and NO scatter symbols (the
 *         convergence twin's scatter stays in its own dialog)
 *     C4  the x ticks speak it000/it001/it002; the y ticks speak " Å"
 *     C5  the serial dialect speaks its own name: the legend says
 *         "y = the model's own estimate (Å)"; the gold name
 *         ("FSC 0.143 estimate") appears NOWHERE in the dialog
 *     C6  the summary line VERBATIM (replica of arcSummary on the
 *         route's own rounds)
 *     C7  the biggest-jump line VERBATIM (replica of biggestJump)
 *     C8  the verdict chip "still improving" + the detail line VERBATIM
 *         (replica of arcVerdict); the plateau paragraph speaks 0.3 Å
 *         and the serial tail ("a classification stops on its written
 *         iteration count, not on its estimate")
 *     C9  the verb row speaks its plan: +5/+10/+25 (+5 pressed),
 *         "Resumes from Round 002 · 2 + 5 → 7 … TOTAL"
 *   P — the door guards itself + the no-persistence law:
 *     P1  a completed NON-ML job (topazdenoise) carries NO arc door
 *         (the dialect table's null hides the door — it never asks)
 *     P2  Esc → reopen restores the whole arc (3 dots, summary again)
 *   V — the verb FIRES FROM THE ARC FACE (the row's second home, its
 *       first fire from THIS dialog — the same t455 machinery):
 *     V1  "Continue the run" (default +5) → click-until-WORLD-effect:
 *         the dialog steps aside AND the API says the run began
 *     V2  completion under the settle law (three agreeing reads); the
 *         ladder EXTENDED to 8 rounds; params.iterations === 7; the
 *         fire created NO job (the FIXED mirror wipe re-rides — the
 *         run_it* family must stay intact through the continue)
 *   V3 (the extended arc re-read, a FRESH page):
 *     V3a the door counts its own 8 iterations now
 *     V3b the face re-reads: the replica summary/verdict from a FRESH
 *         route read; the biggest jump STILL Round 000 → Round 001
 *         (the early big step outruns the tail); 8 dots; it007 tick
 *     V3c the verb's resume pointer advanced: "Resumes from Round 007
 *         · 7 + 5 → 12"
 *   W (world guard): the fire creates NO job; the mint's remove verb
 *     (run separately after GREEN) returns the world.
 *
 * RIDE LAWS inherited: born-at-band (t910); per-surface presence polls
 * (t912); the clamped-point law densified to the 1px edge (t917);
 * CLICK-UNTIL-EFFECT on every dialog door (the action cluster re-renders
 * under the live poll); the settle law (three agreeing reads — the
 * route's source flips mid-sync); a page RESET between acts; an
 * instrument measures the LAWS, never its author's memory (t915); the
 * browser is the last resident opened and the first closed.
 *
 *   node scripts/t918-resolution-arc-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const MANIFEST = path.join(ROOT, "data", "t916-class2d-mint.json");
const RECEIPT = "shots-qa/t918-resolution-arc-witness.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const realClick = async (findExpr) => {
  // the clamped-point law DENSIFIED (t914 → t916 → t917): the grid walks
  // the 1px rim — the canvas stacks new cards with a 2–3px cascade
  // offset, so the buried card's sliver IS the 1–2px edge.
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [1, 2, 6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") { await sleep(400); continue; }
    if (pos.off) return "OFF-VIEWPORT";
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const settleCensus = async () => {
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const overflowProbe = `JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`;
const dumpDialogs = () => {
  try {
    const titles = evalJson(`JSON.stringify([...document.querySelectorAll('[role="dialog"]')].map(d => (d.querySelector('h2,h1,[data-slot="dialog-title"]')?.textContent || d.textContent || '').trim().slice(0, 60)))`);
    console.log(`      [dialogs open: ${titles}]`);
  } catch { console.log("      [dialogs: unreadable]"); }
};
const closeAllDialogs = async () => {
  for (let i = 0; i < 4; i++) {
    const n = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`);
    if ((n?.n ?? 0) === 0) return i;
    sh(`${AB} press Escape`);
    await sleep(450);
  }
  return 4;
};
/** a clean slate between acts: close every dialog, reload the page, wait
 *  for the canvas — a failed step's leftover dialogs poison later polls. */
const resetPage = async (minCards) => {
  await closeAllDialogs();
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= minCards, 30);
  await settleCensus();
};
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true
  );
  ok(`inspector open for "${name}"`, opened?.open === true);
  const strip = await poll(
    `JSON.stringify({ tabs: [...document.querySelectorAll('[role="tab"]')].map(t => (t.textContent || '').trim()).filter(Boolean) })`,
    (v) => (v.tabs ?? []).length >= 3, 40, 750
  );
  ok(`the inspector's tab strip mounted (${(strip?.tabs ?? []).join("/")})`, (strip?.tabs ?? []).length >= 3);
  return opened;
};
const openInspectorQuiet = async (name) => {
  await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 16, 500
  );
};

// ---- the ground truth: the mint manifest + the arc LAW ---------------------
if (!existsSync(MANIFEST)) { console.log("FATAL: no mint manifest — run t916-class2d-mint.mjs mint first"); process.exit(2); }
const mint = JSON.parse(readFileSync(MANIFEST, "utf8"));
const C2D_ID = mint.class2d.id;
const ORIGIN = `-H "Origin: ${BASE}"`;
const shApi = (url) => execSync(`curl -s ${ORIGIN} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
// the API is the truth — the jobs LIST is the world's mouth
const jobById = (id) => {
  const d = JSON.parse(shApi("/api/jobs"));
  return (d.jobs ?? []).find((j) => j.id === id) ?? null;
};
const C2D_NAME = jobById(C2D_ID)?.name ?? "t916 class2d witness";

// the LAW: the mock's t456 fidelity — arc_resolution(it) = 3.2 + 24.8·e^(-it/6.5)
const lawRaw = (it) => 3.2 + 24.8 * Math.exp(-it / 6.5);
const TOL = 0.005 + 1e-9; // the mock writes {:.2f}; the route parses floats
const pad3 = (n) => String(n).padStart(3, "0");
const roundLabel = (r) => `Round ${pad3(r)}`;

// ---- the lib's pure functions, replicated for the face's expectations ------
// (the face must speak what resolution-arc.ts produces from the ROUTE's
// own rounds — the replicas read the route's data, never the law's)
const PLATEAU_A = 0.3, PLATEAU_W = 3;
const arcVerdict = (arc) => {
  if (arc.length < 3) return null;
  const moves = [];
  for (let i = arc.length - PLATEAU_W; i < arc.length; i++) {
    const from = arc[i - 1], to = arc[i];
    if (!from || !to) continue;
    moves.push({ from, to, delta: from.resolution - to.resolution });
  }
  if (moves.length === 0) return null;
  const last = moves[moves.length - 1];
  if (moves.every((m) => Math.abs(m.delta) < PLATEAU_A)) {
    return {
      word: "plateaued",
      detail: `the last ${moves.length} moves were all under ${PLATEAU_A} Å (${roundLabel(moves[0].from.iteration)} → ${roundLabel(last.to.iteration)} gained ${moves.reduce((s, m) => s + m.delta, 0).toFixed(1)} Å) — more iterations will not sharpen it`,
    };
  }
  if (last.delta >= 0) {
    return { word: "still improving", detail: `the estimate is still sharpening — ${roundLabel(last.from.iteration)} → ${roundLabel(last.to.iteration)} gained ${last.delta.toFixed(1)} Å` };
  }
  return { word: "still moving", detail: `the estimate is still moving — ${roundLabel(last.from.iteration)} → ${roundLabel(last.to.iteration)} worsened by ${Math.abs(last.delta).toFixed(1)} Å (mid-run sampling schedules breathe the estimate; the run is not settled)` };
};
const biggestJump = (arc) => {
  let best = null;
  for (let i = 1; i < arc.length; i++) {
    const from = arc[i - 1], to = arc[i];
    const delta = from.resolution - to.resolution;
    if (!best || delta > best.delta) best = { from, to, delta };
  }
  return best;
};
const arcSummary = (arc) => {
  const first = arc[0], last = arc[arc.length - 1];
  const best = arc.reduce((b, p) => (p.resolution < b.resolution ? p : b), arc[0]);
  return `${first.resolution.toFixed(1)} Å → ${last.resolution.toFixed(1)} Å over ${arc.length} round${arc.length === 1 ? "" : "s"} — best ${best.resolution.toFixed(1)} Å at ${roundLabel(best.iteration)}`;
};

// ---- band A: the data plane, API-first (no browser) -------------------------
console.log("== band A: the data plane (API is the truth) ==");
const arc0 = JSON.parse(shApi(`/api/jobs/${C2D_ID}/resolution-arc`));
const rounds0 = arc0.rounds ?? [];
ok("A1 the arc holds 3 rounds [0,1,2] (the seed writes a full set)",
  rounds0.length === 3 && JSON.stringify(rounds0.map((r) => r.iteration)) === JSON.stringify([0, 1, 2]),
  JSON.stringify(rounds0.map((r) => [r.iteration, r.resolution])));
for (const p of rounds0) {
  ok(`A1 it${pad3(p.iteration)} resolution ≈ law (${lawRaw(p.iteration).toFixed(2)} Å)`,
    Math.abs(p.resolution - lawRaw(p.iteration)) <= TOL, `${p.resolution}`);
}
ok("A1 every round reads the PLAIN model star (the serial dialect's source)",
  rounds0.every((p) => p.source === "model"), JSON.stringify(rounds0.map((p) => p.source)));
ok(`A1 reported ≈ law(2) (run_model.star's own value)`,
  arc0.reported != null && Math.abs(arc0.reported - lawRaw(2)) <= TOL, `${arc0.reported}`);

const nonMl = (JSON.parse(shApi("/api/jobs")).jobs ?? []).find((j) => j.type === "topazdenoise" && j.status === "completed");
ok("A2 a non-ML completed job exists for the door-guard leg", !!nonMl, nonMl?.name ?? "none");
if (nonMl) {
  const empty = JSON.parse(shApi(`/api/jobs/${nonMl.id}/resolution-arc`));
  ok("A2 the non-ML route answers an HONEST empty arc (no model stars — never invents)",
    (empty.rounds ?? []).length === 0 && empty.reported == null,
    `rounds=${(empty.rounds ?? []).length} reported=${empty.reported}`);
}

// the expected FACE strings, from the route's own rounds
const S0 = { summary: arcSummary(rounds0), verdict: arcVerdict(rounds0), jump: biggestJump(rounds0) };

// ---- band C: 1280 wide, born at band — the arc face ------------------------
console.log("== band C: 1280 wide, born at band (the face speaks the law) ==");
sh(`${AB} set viewport 1280 900`);
await resetPage(15);
await openInspector(C2D_NAME);

const ARC_REGION = "Resolution arc reading — the estimate curve and the plateau law";
const arcDoorExpr = (name) => `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Resolution arc — read this')) : null; })()`;
const convDoorExpr = (name) => `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Class convergence — read this run')) : null; })()`;

// C1 — the door: the Ruler icon beside the convergence one
const door = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${C2D_NAME}')); const b = d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Resolution arc — read this')) : null; const conv = d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Class convergence — read this run')) : null; const ruler = b ? !!b.querySelector('svg.lucide-ruler') : false; return JSON.stringify({ found: !!b, ruler, conv: !!conv, label: b ? b.getAttribute('aria-label') : null }); })()`,
  (v) => v.found === true, 24, 750
);
ok("C1 the arc door present BESIDE the convergence door (the family's shared cluster)",
  door?.found === true && door?.conv === true, `conv=${door?.conv}`);
ok("C1 the door wears the Ruler icon", door?.ruler === true);
ok(`C1 the aria-label counts the route's own ${rounds0.length} rounds`,
  door?.label === `Resolution arc — read this classification's own resolution estimate across its ${rounds0.length} iterations`, door?.label ?? "absent");

// C2 — CLICK-UNTIL-EFFECT: the dialog opens (the action cluster re-renders
// under the live poll; a hit-test-clean click can land on a neighbor)
const openArcDialog = async (name) => {
  for (let i = 0; i < 4; i++) {
    const clicked = await realClick(arcDoorExpr(name));
    const opened = await poll(
      `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => x.querySelector('[aria-label="${ARC_REGION}"]')); return JSON.stringify({ open: !!dlg }); })()`,
      (v) => v.open === true, 5, 500
    );
    if (opened?.open === true) return `open@try${i + 1} (click ${clicked})`;
    if (i < 3) { await closeAllDialogs(); await openInspectorQuiet(name); }
  }
  dumpDialogs();
  return "NEVER-OPEN";
};
const doorOpened = await openArcDialog(C2D_NAME);
ok("C2 the arc dialog OPEN (click-until-effect)", String(doorOpened).startsWith("open@"), doorOpened);

const arcFaceExpr = `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => x.querySelector('[aria-label="${ARC_REGION}"]')); if (!dlg) return JSON.stringify({ open: false }); const region = dlg.querySelector('[aria-label="${ARC_REGION}"]'); const line = dlg.querySelector('.recharts-line-curve'); const dots = dlg.querySelectorAll('.recharts-line-dots circle').length; const scatter = dlg.querySelectorAll('.recharts-scatter-symbol').length; const stroke = line ? line.getAttribute('stroke') : null; const ticks = [...dlg.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick')].map(t => (t.textContent || '').trim()); const yTicks = [...dlg.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick')].map(t => (t.textContent || '').trim()); return JSON.stringify({ open: true, region: !!region, line: !!line, dots, scatter, stroke, ticks, yTicks: yTicks.slice(0, 6), text: (dlg.textContent || '') }); })()`;
const face0 = await poll(arcFaceExpr, (v) => v.open === true && v.line === true, 20, 750);
ok("C2 the t804 region present (role=region content, its own name)", face0?.open === true && face0?.region === true);

// C3 — THE FACE IS THE ARC: a line, not a scatter
ok("C3 the face is a LINE (recharts-line-curve present)", face0?.line === true);
ok("C3 the line wears the teal (#0d9488)", face0?.stroke === "#0d9488", face0?.stroke ?? "none");
ok(`C3 one dot per round (${rounds0.length})`, face0?.dots === rounds0.length, `dots=${face0?.dots}`);
ok("C3 NO scatter symbols (the convergence twin's face stays in its own dialog)", (face0?.scatter ?? 0) === 0, `scatter=${face0?.scatter}`);

// C4 — the axes speak the run's own iterations and Å
ok("C4 the x ticks speak it000/it001/it002",
  JSON.stringify(face0?.ticks ?? []) === JSON.stringify(rounds0.map((p) => `it${pad3(p.iteration)}`)),
  JSON.stringify(face0?.ticks ?? []));
ok("C4 the y ticks speak Å units", (face0?.yTicks ?? []).length > 0 && (face0?.yTicks ?? []).every((t) => t.includes("Å")), JSON.stringify(face0?.yTicks ?? []));

// C5 — the serial dialect speaks its own name; the gold name stays absent
ok("C5 the legend speaks the serial dialect (y = the model's own estimate (Å))",
  (face0?.text ?? "").includes("y = the model's own estimate (Å)"));
ok("C5 'lower is better' spoken", (face0?.text ?? "").includes("lower is better"));
ok("C5 the GOLD name appears nowhere in the serial dialog",
  !(face0?.text ?? "").includes("FSC 0.143 estimate"));
ok("C5 the description speaks the classes sharpening (the serial noun)",
  (face0?.text ?? "").includes("the classes sharpening"));

// C6/C7/C8 — the summary, the jump, the verdict — verbatim from the route's rounds
ok("C6 the summary line verbatim (replica on the route's rounds)",
  (face0?.text ?? "").includes(S0.summary), S0.summary);
ok("C7 the biggest-jump line verbatim",
  (face0?.text ?? "").includes(`Biggest jump: ${roundLabel(S0.jump.from.iteration)} → ${roundLabel(S0.jump.to.iteration)} gained ${S0.jump.delta.toFixed(1)} Å`),
  `${roundLabel(S0.jump.from.iteration)} → ${roundLabel(S0.jump.to.iteration)} gained ${S0.jump.delta.toFixed(1)} Å`);
ok("C8 the verdict chip speaks 'still improving'",
  (face0?.text ?? "").includes(S0.verdict.word), S0.verdict.word);
ok("C8 the verdict detail verbatim", (face0?.text ?? "").includes(S0.verdict.detail), S0.verdict.detail);
ok("C8 the plateau paragraph speaks the 0.3 Å threshold + the serial tail",
  (face0?.text ?? "").includes("moves under 0.3 Å count as noise") &&
  (face0?.text ?? "").includes("a classification stops on its written iteration count, not on its estimate"));

// C9 — the verb row speaks its plan
const verb0 = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => x.querySelector('[aria-label="${ARC_REGION}"]')); if (!dlg) return JSON.stringify({}); const row = [...dlg.querySelectorAll('div')].find(x => (x.textContent || '').includes('Continue with more iterations')); const chips = row ? [...row.querySelectorAll('button')].filter(b => /^\\+\\d+$/.test((b.textContent || '').trim())) : []; return JSON.stringify({ present: !!row, chips: chips.map(b => ({ t: (b.textContent || '').trim(), pressed: b.getAttribute('aria-pressed') })), text: row ? (row.textContent || '') : '' }); })()`,
  (v) => v.present === true, 20, 750
);
ok("C9 the continue verb row present in the ARC dialog (one row, two verdicts)", verb0?.present === true);
ok("C9 the EM options +5/+10/+25, +5 default-pressed",
  JSON.stringify((verb0?.chips ?? []).map((c) => c.t)) === JSON.stringify(["+5", "+10", "+25"]) && verb0?.chips?.[0]?.pressed === "true", JSON.stringify(verb0?.chips ?? []));
ok("C9 the plan line: Resumes from Round 002 · 2 + 5 → 7 TOTAL",
  (verb0?.text ?? "").includes("Resumes from Round 002") && (verb0?.text ?? "").includes("2 + 5 → 7") && (verb0?.text ?? "").includes("TOTAL"), (verb0?.text ?? "").slice(0, 220));

// ---- band P: the door guards itself + the no-persistence law ---------------
console.log("== band P: the door guards itself; reopen restores the arc ==");
const P2D_NAME = nonMl?.name;
if (P2D_NAME) {
  await closeAllDialogs();
  await openInspectorQuiet(P2D_NAME);
  const absent = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${P2D_NAME}')); const arc = d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Resolution arc — read this')) : null; return JSON.stringify({ open: !!d, arc: !!arc }); })()`,
    (v) => v.open === true, 16, 500
  );
  ok("P1 the completed non-ML inspector carries NO arc door (the dialect table hides it — it never asks)",
    absent?.open === true && absent?.arc === false, `open=${absent?.open} arc=${absent?.arc}`);
}

await resetPage(15);
await openInspectorQuiet(C2D_NAME);
const reopened = await openArcDialog(C2D_NAME);
const faceP = await poll(arcFaceExpr, (v) => v.open === true && v.line === true, 20, 750);
ok("P2 reopen restores the WHOLE arc (no persistence: 3 dots, the summary again)",
  faceP?.dots === rounds0.length && (faceP?.text ?? "").includes(S0.summary), `dots=${faceP?.dots} via ${reopened}`);

// ---- band V: the verb FIRES from the arc face -------------------------------
console.log("== the verb fires from the ARC face: the row's second home ==");
const jobsBeforeFire = JSON.parse(shApi("/api/jobs"));
const countBefore = jobsBeforeFire.jobs.length;
const fireBtn = `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => x.querySelector('[aria-label="${ARC_REGION}"]')); return dlg ? [...dlg.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Continue the run') : null; })()`;
let fired = "NO-DIALOG";
for (let i = 0; i < 3; i++) {
  fired = await realClick(fireBtn);
  if (String(fired).startsWith("clicked@")) break;
  await sleep(600);
}
ok("V1 'Continue the run' clicked (default +5 → total 7)", String(fired).startsWith("clicked@"), String(fired));
if (String(fired).startsWith("clicked@")) {
  // CLICK-UNTIL-WORLD-EFFECT: the dialog steps aside AND the world's own
  // mouth (the API) says the run began — the click that changed nothing
  // is retried, the click that changed the world is banked.
  let started = false;
  for (let i = 0; i < 20 && !started; i++) {
    const st = jobById(C2D_ID)?.status;
    if (st === "running" || st === "pending" || st === "staging") started = true;
    else await sleep(500);
  }
  ok("V1 the run STARTED on its own lane (the API says so)", started === true);
}

// the heartbeat + the SETTLE LAW (three agreeing reads — the route's
// source flips from the cluster's live state to the mirror mid-sync)
const growth = [];
let completed = false, settleHits = 0, lastLen = -1;
for (let i = 0; i < 360 && !completed; i++) {
  try {
    const j = jobById(C2D_ID);
    const st = j ? j.status : null;
    const it = JSON.parse(shApi(`/api/jobs/${C2D_ID}/iterations`)).iterations ?? [];
    if (growth[growth.length - 1] !== it.length) growth.push(it.length);
    if (st === "completed" && it.length >= 8) {
      if (it.length === lastLen) settleHits++;
      else { settleHits = 0; lastLen = it.length; }
      if (settleHits >= 2) completed = true; // three agreeing reads
    }
  } catch { /* the route hiccups are the run's own noise */ }
  await sleep(500);
}
ok("V2 the continue run COMPLETED on its own lane", completed === true, `growth curve ${JSON.stringify(growth)}`);
ok("V2 the ladder EXTENDED to 8 rounds [0..7]", growth[growth.length - 1] === 8, `final=${growth[growth.length - 1]}`);
const jobAfter = jobById(C2D_ID);
ok("V2 the verb's receipt in the world: params.iterations === 7 (RELION's --iter is the TOTAL)",
  jobAfter?.params?.iterations === 7, `iterations=${jobAfter?.params?.iterations}`);
const jobsAfterFire = JSON.parse(shApi("/api/jobs"));
ok("W the continue verb created NO job (the count is unchanged)", jobsAfterFire.jobs.length === countBefore, `${jobsAfterFire.jobs.length} vs ${countBefore}`);

// ---- band V3: the extended arc re-read (a FRESH page — the reset law) ------
console.log("== the extended arc: the face re-reads the run's new shape ==");
await resetPage(15);
await openInspector(C2D_NAME);
const door2 = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${C2D_NAME}')); return JSON.stringify({ label: (d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Resolution arc — read this'))?.getAttribute('aria-label') : null) ?? null }); })()`,
  (v) => !!v.label, 24, 750
);
ok("V3a the door counts its own 8 iterations now",
  door2?.label === `Resolution arc — read this classification's own resolution estimate across its 8 iterations`, door2?.label ?? "absent");
const doorOpened2 = await openArcDialog(C2D_NAME);
const arc1 = JSON.parse(shApi(`/api/jobs/${C2D_ID}/resolution-arc`));
const rounds1 = arc1.rounds ?? [];
const S1 = { summary: arcSummary(rounds1), verdict: arcVerdict(rounds1), jump: biggestJump(rounds1) };
const face1 = await poll(arcFaceExpr, (v) => v.open === true && v.line === true, 24, 750);
ok("V3b the extended summary verbatim (replica on the FRESH route read)",
  (face1?.text ?? "").includes(S1.summary), S1.summary);
ok("V3b the extended verdict still 'still improving' + detail verbatim",
  (face1?.text ?? "").includes(S1.verdict.word) && (face1?.text ?? "").includes(S1.verdict.detail), S1.verdict.detail);
ok("V3b the biggest jump STILL the early step (Round 000 → Round 001 — the early big step outruns the tail)",
  S1.jump.from.iteration === 0 && S1.jump.to.iteration === 1, `${roundLabel(S1.jump.from.iteration)} → ${roundLabel(S1.jump.to.iteration)}`);
ok("V3b 8 dots on the extended face", face1?.dots === 8, `dots=${face1?.dots}`);
ok("V3b the x ticks include it007", (face1?.ticks ?? []).includes("it007"), JSON.stringify(face1?.ticks ?? []));
const verb2 = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => x.querySelector('[aria-label="${ARC_REGION}"]')); const row = dlg ? [...dlg.querySelectorAll('div')].find(x => (x.textContent || '').includes('Continue with more iterations')) : null; return JSON.stringify({ text: row ? (row.textContent || '') : '' }); })()`,
  (v) => (v.text || "").length > 0, 20, 750
);
ok("V3c the verb's resume pointer advanced: Resumes from Round 007 · 7 + 5 → 12",
  (verb2?.text ?? "").includes("Resumes from Round 007") && (verb2?.text ?? "").includes("7 + 5 → 12"), (verb2?.text ?? "").slice(0, 200));
const overC = evalJson(overflowProbe);
ok("V3 no horizontal overflow at 1280", overC.overX <= 0, `overX=${overC.overX}`);

// receipt
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(), pass, fail,
  class2d: C2D_ID, name: C2D_NAME,
  arc0: { rounds: rounds0.map((r) => [r.iteration, r.resolution]), reported: arc0.reported, summary: S0.summary, verdict: S0.verdict, jump: S0.jump ? [S0.jump.from.iteration, S0.jump.to.iteration, S0.jump.delta] : null },
  extended: { ladderFinal: growth[growth.length - 1] ?? null, growthCurve: growth, paramsIterations: jobAfter?.params?.iterations ?? null, summary: S1.summary, verdict: S1.verdict, jump: S1.jump ? [S1.jump.from.iteration, S1.jump.to.iteration, S1.jump.delta] : null },
  world: { countBefore, countAfter: jobsAfterFire.jobs.length },
}, null, 2));
console.log(`== witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
