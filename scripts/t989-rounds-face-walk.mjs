#!/usr/bin/env node
/**
 * t989 — the ROUNDS-FACE WALK (the continue-picker's ROUND POPOVER faces —
 * the t988 entry's recorded-not-faked ①, minted honest by the interrupted
 * window's `t989-rounds-face-mint.mjs`, finished by this window): the
 * popover is the picker's densest message plane and NO walk had ever
 * opened it. One idle refine3d face ("Rounds Face (t989)",
 * cmv86xfmq0001usha0t85mcfb — already minted, verify GREEN 5/5) hosts
 * every face; the walk's own fixtures (a run record, a workdir, crafted
 * rounds, two edges — each swept at close) bring them alive:
 *
 *   leg 3  THE NEVER-RAN REFUSAL — the popover's ready face on a fresh
 *          idle job: the self header ("This job" · local) with the italic
 *          error "has never run — no checkpoints exist yet", and the
 *          DESIGNED NEGATIVE — the "No checkpoints yet" empty face stays
 *          HIDDEN while an error stands (pickableRounds===0 is not
 *          enough; sources.every(!error) must hold too);
 *   leg 4  THE EMPTY-WORKDIR LANE — a run record + an existing but empty
 *          workdir (the walk's own fixture) flips the self row to
 *          entries=0/error=null: the "No checkpoints yet." empty face
 *          blooms and the header row stays hidden (both designed);
 *   leg 5  THE CRAFTED ROUNDS — it001 complete (optimiser + data + model
 *          + sampling + class001.mrc, the refine3d plain dialect) and
 *          it002 optimiser-only: the incomplete round's disabled refusal
 *          (aria "Iteration 2 … is incomplete and cannot be continued
 *          from" + "incomplete — missing run_it002_data.star +3"), the
 *          complete round's "newest" badge, the "2 rounds" chip;
 *   leg 6  THE PICK + THE START-FRESH DOOR — the it001 click lands the
 *          path in fn_cont and the t397 label flips to "Continue"; the
 *          reopen shows the "Start fresh" door and the picked row's
 *          check; the Start-fresh click clears the field and the label
 *          returns to "Run";
 *   leg 7  THE UPSTREAM READS — the designed negative first (an edge
 *          from the never-ran Continue Face (t988) adds NO upstream row:
 *          the upstream honesty rule silences a source with no entries
 *          and no error), then the REAL read (an edge from the completed
 *          class2d demo — real run record, real it200 family on disk):
 *          "Upstream · 2D Classification (tutorial)" · local · the
 *          "Continue from iteration 200 …" row with its newest badge;
 *   leg 8  THE DRAG-RAISE WITNESS (the interrupted window's t989
 *          cosmetic, already committed and unit-verified — t799 D6 32/32,
 *          tsc/eslint 0/0 — now witnessed rendered): the AI-settings
 *          dialog summoned from INSIDE the companion keeps the front and
 *          BURIES the window (lastPtrInCompanion); a pointerdown on the
 *          titlebar + the FIRST REAL MOVE raises the window ABOVE the
 *          dialog MID-DRAG (the raise rides the move, never the
 *          pointerdown — the t986 dissection's law honored), the
 *          round-trip drag leaves the geometry byte-identical, and the
 *          companion interaction never dismisses the dialog (the t501
 *          non-modal contract, met alive);
 *   leg 9  cleanup + world honesty — the fixtures swept (the run record,
 *          the workdir, both edges), the face pristine (the mint's own
 *          verify GREEN), nineteen jobs, the standing eighteen untouched
 *          by a byte-identical id:status:name fingerprint.
 *
 * RIDE LAWS inherited (the t987/t988 birth laws, executable): WIDE-FIRST
 * viewport; the palette's ENTER mouth; the landing read through
 * input[aria-label="Job name"]; the FOCUS GATE; the CONDITIONAL Escape;
 * the HEADER-ANCHORED badge; fresh `agent-browser open` before the leg-8
 * rider; the popover is [role="dialog"][aria-label="Rounds you can
 * continue from"] — the dialog probes scope to [data-slot="dialog-content"]
 * so the two planes never blur; fixture mutations re-read through the
 * popover's own refresh button (the ?refresh=1 lane — the 12s server TTL
 * and the 8s client TTL both bypassed by the product's own affordance).
 *
 *   node scripts/t989-rounds-face-walk.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t989-rounds-face-walk.json");
const FACE_NAME = "Rounds Face (t989)";
const FACE_ID = "cmv86xfmq0001usha0t85mcfb";
const T988_ID = "cmv863x9a0001usvbkt5ky1k0";
const CLASS2D_ID = "cmv79wlxs000gusbulpq820bh";
const CLASS2D_NAME = "2D Classification (tutorial)";
const PROJECT_ID = "cmv79wd4e0000usbucn0sncqa";
const WORKDIR = path.join(ROOT, "data", "relion", PROJECT_ID, `refine3d_${FACE_ID.slice(-8)}`);
const STATE_FILE = path.join(ROOT, "data", "engine-state.json");
const CONT_ID = `param-${FACE_ID}-fn_cont`;
const PICKED = `${WORKDIR}/run_it001_optimiser.star`;

let pass = 0, fail = 0;
const results = [];
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
  results.push({ label, ok: !!cond, extra });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
function evalJs(expr) {
  try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { return String(e?.stdout ?? "") || "null"; }
}
function evalJson(expr) {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
}
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && v !== "null" && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
/* the t982 realClick: probe visibility AND self-hit over a nine-point
 * grid, scroll into view when off, click through the real mouse path */
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [4, 10, 20]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    await sleep(400);
  }
  return "NEVER-OWN";
};
const shot = (name) => sh(`${AB} screenshot ${path.join(QA_DIR, name)}`);

console.log("=== t989 rounds-face walk ===");

/* the server-first law */
let serverUp = false;
for (let i = 0; i < 24 && !serverUp; i++) {
  try { const c = execSync(`curl -s -o /dev/null -w '%{http_code}' ${BASE}/ --max-time 5`, { encoding: "utf8" }); serverUp = c.trim() === "200"; }
  catch { serverUp = false; }
  if (!serverUp) await sleep(2500);
}
if (!serverUp) { console.log("FATAL: the server never answered 200"); process.exit(2); }
console.log("server: 200");
/* the standing world's fingerprint, captured BEFORE any leg rides */
const apiPre = (url) => execSync(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`, { encoding: "utf8", timeout: 30_000 });
let standingBody = null;
try { standingBody = JSON.parse(apiPre("/api/jobs")); } catch { standingBody = null; }
const standingArr = Array.isArray(standingBody) ? standingBody : standingBody?.jobs ?? [];
const standingFingerprint = standingArr
  .filter((j) => j.name !== FACE_NAME)
  .map((j) => `${j.id}:${j.status}:${j.name}`)
  .sort()
  .join("|");

/* LEG 1 — the fresh open (the WIDE-FIRST law, executable) */
console.log("leg 1: the fresh open (wide-first)");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const companionShut = await poll(
  `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
  (v) => v.shut, 4, 400);
ok("the companion is shut (the ride plane is clear)", !!companionShut && companionShut.shut);

/* LEG 2 — the palette jump (the t987 ENTER mouth, executable) */
console.log("leg 2: the Cmd+K palette jump to the rounds face");
sh(`${AB} press Control+K`);
await sleep(700);
await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400);
evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`);
sh(`${AB} keyboard type "Rounds Face"`);
const row = await poll(
  `(() => { const items = [...document.querySelectorAll('[cmdk-item]')]; const hit = items.find((it) => (it.textContent ?? '').includes('Rounds Face')); return JSON.stringify({ found: !!hit }); })()`,
  (v) => v.found, 12, 400);
ok("the palette's Jobs group answers the face's name", !!row && row.found);
let jumpLanded = false;
let jumpDetail = "";
for (let attempt = 1; attempt <= 3 && !jumpLanded; attempt++) {
  sh(`${AB} press Enter`);
  const landed = await poll(
    `(() => { const name = document.querySelector('input[aria-label="Job name"]'); return JSON.stringify({ shut: !document.querySelector('[cmdk-input]'), hosted: !!name && name.value === ${JSON.stringify(FACE_NAME)} }); })()`,
    (v) => v.shut && v.hosted, 10, 500);
  if (landed) { jumpLanded = true; jumpDetail += `attempt ${attempt}: Enter on the selected row, landed`; }
  else {
    jumpDetail += `attempt ${attempt}: Enter, no landing; `;
    const pal = evalJson(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`);
    if (pal?.up) { sh(`${AB} press Escape`); await sleep(500); sh(`${AB} press Control+K`); await sleep(700); await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400); evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`); sh(`${AB} keyboard type "Rounds Face"`); await sleep(800); }
  }
}
ok("the jump landed — the edit panel hosts the face", jumpLanded, jumpDetail.trim());
/* the HEADER-ANCHORED badge (the t987 law #4) */
const headerBadge = (words) => `(() => { const name = document.querySelector('input[aria-label="Job name"]'); if (!name || name.value !== ${JSON.stringify(FACE_NAME)}) return JSON.stringify({ word: null, panel: false }); const header = name.closest('div[class*="border-b"]'); const badge = header ? [...header.querySelectorAll('span')].find((sp) => ${JSON.stringify(words)}.includes(sp.textContent.trim().toLowerCase()) && (sp.className ?? '').includes('rounded-full')) : null; return JSON.stringify({ word: badge ? badge.textContent.trim().toLowerCase() : null, panel: true }); })()`;
const badgeIdle = await poll(headerBadge(["idle"]), (v) => v.panel && v.word === "idle", 10, 500);
ok("the panel's badge says idle (the header-scoped read)", !!badgeIdle && badgeIdle.panel && badgeIdle.word === "idle");

/* the popover's own organs (the picker's planes — scoped so they never
 * blur with the settings dialog's [data-slot="dialog-content"]) */
const POPOVER_SEL = `[aria-label="Rounds you can continue from"]`;
const TRIGGER_SEL = `button[aria-label="Pick which previous round to continue from"]`;
const REFRESH_SEL = `button[aria-label="Re-read the rounds from the engine and the cluster"]`;
const popoverUp = () => poll(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); return JSON.stringify({ up: !!p && p.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.up, 12, 500);
const refreshClick = async () => {
  const c = await realClick(`[...document.querySelectorAll(${JSON.stringify(REFRESH_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
  return String(c).startsWith("clicked@");
};

/* LEG 3 — THE NEVER-RAN REFUSAL (the popover's ready face on a fresh idle job) */
console.log("leg 3: the never-ran refusal plane (the self row's honest error)");
const trigClick = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the Rounds trigger clicked through the real mouse path", String(trigClick).startsWith("clicked@"), String(trigClick));
const popUp = await popoverUp();
ok("the rounds popover opened (the picker's own plane)", !!popUp && popUp.up);
const neverRan = await poll(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const err = [...p.querySelectorAll('p')].find((x) => (x.textContent ?? '').includes('has never run')); const head = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === 'This job'); const local = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === 'local'); return JSON.stringify({ up: true, err: err ? err.textContent.trim() : null, head: !!head, local: !!local }); })()`,
  (v) => v.up && v.err, 16, 500);
ok("THE NEVER-RAN REFUSAL SPEAKS (the self row's italic error)",
  !!neverRan && neverRan.up && neverRan.err === "has never run — no checkpoints exist yet",
  `err=${JSON.stringify(neverRan?.err)}`);
ok("the self header rides the error row (\"This job\" · local)",
  !!neverRan && neverRan.head && neverRan.local);
const negEmpty = evalJson(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); return JSON.stringify({ emptyFace: p ? (p.textContent ?? '').includes('No checkpoints yet') : null }); })()`);
ok("the DESIGNED NEGATIVE holds — the empty face stays hidden while an error stands",
  !!negEmpty && negEmpty.emptyFace === false, `emptyFace=${JSON.stringify(negEmpty?.emptyFace)}`);
const tail = evalJson(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const typed = (p.textContent ?? '').includes('typed paths ride'); const rf = !!p.querySelector('button[aria-label=\"Re-read the rounds from the engine and the cluster\"]'); return JSON.stringify({ up: true, typed, rf }); })()`);
ok("the footer's --continue tail and the refresh affordance are up",
  !!tail && tail.up && tail.typed && tail.rf);
shot("t989-neverran.png");

/* LEG 4 — THE EMPTY-WORKDIR LANE (the "No checkpoints yet" empty face) */
console.log("leg 4: the empty-workdir lane (a run record + an existing but empty workdir)");
mkdirSync(WORKDIR, { recursive: true });
const runs = JSON.parse(readFileSync(STATE_FILE, "utf8"));
runs[FACE_ID] = {
  jobId: FACE_ID,
  projectId: PROJECT_ID,
  type: "refine3d",
  pid: null,
  cmd: "t989 walk fixture — the picker's lane record (not a real dispatch)",
  workdir: WORKDIR,
  logFile: "",
  errFile: "",
  startedAt: new Date().toISOString(),
  outputs: {},
  done: true,
  exitCode: 0,
};
const tmpState = `${STATE_FILE}.t989.tmp`;
writeFileSync(tmpState, JSON.stringify(runs, null, 2));
execSync(`mv "${tmpState}" "${STATE_FILE}"`);
ok("the lane fixture landed (a run record + an empty workdir)", existsSync(WORKDIR), WORKDIR);
const rf1 = await refreshClick();
const noCk = await poll(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const empty = [...p.querySelectorAll('div')].find((x) => (x.textContent ?? '').includes('No checkpoints yet')); const head = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === 'This job'); return JSON.stringify({ up: true, empty: !!empty, head: !!head }); })()`,
  (v) => v.up && v.empty, 20, 500);
ok("THE \"No checkpoints yet.\" EMPTY FACE BLOOMS (entries=0, no error — its first live witness)",
  !!noCk && noCk.up && noCk.empty);
ok("the header row stays hidden under the empty face (the second designed negative)",
  !!noCk && noCk.up && noCk.head === false, `head=${JSON.stringify(noCk?.head)}`);
shot("t989-nocheckpoints.png");

/* LEG 5 — THE CRAFTED ROUNDS (the completeness law's two faces) */
console.log("leg 5: the crafted rounds (it001 complete, it002 optimiser-only)");
writeFileSync(path.join(WORKDIR, "run_it001_optimiser.star"), "# t989 walk fixture\n");
writeFileSync(path.join(WORKDIR, "run_it001_data.star"), "# t989 walk fixture\n");
writeFileSync(path.join(WORKDIR, "run_it001_model.star"), "# t989 walk fixture\n");
writeFileSync(path.join(WORKDIR, "run_it001_sampling.star"), "# t989 walk fixture\n");
writeFileSync(path.join(WORKDIR, "run_it001_class001.mrc"), "# t989 walk fixture\n");
writeFileSync(path.join(WORKDIR, "run_it002_optimiser.star"), "# t989 walk fixture — torn flush\n");
const rf2 = await refreshClick();
const mixed = await poll(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const chip = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === '2 rounds'); const it2 = [...p.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Iteration 2 of ${FACE_NAME}')); const it1 = [...p.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Continue from iteration 1 of ${FACE_NAME}')); return JSON.stringify({ up: true, chip: !!chip, it2: it2 ? { disabled: it2.disabled, label: it2.getAttribute('aria-label'), text: (it2.textContent ?? '').trim() } : null, it1: it1 ? { disabled: it1.disabled, label: it1.getAttribute('aria-label'), hasNewest: (it1.textContent ?? '').includes('newest') } : null }); })()`,
  (v) => v.up && v.chip && v.it2 && v.it1, 20, 500);
ok("the \"2 rounds\" chip speaks (the self source's count)",
  !!mixed && mixed.up && mixed.chip);
ok("THE INCOMPLETE REFUSAL IS LIVE (it002 shown but disabled, the torn-flush law's own voice)",
  !!mixed && mixed.it2 && mixed.it2.disabled === true
    && mixed.it2.label === `Iteration 2 of ${FACE_NAME} is incomplete and cannot be continued from`,
  `label=${JSON.stringify(mixed?.it2?.label)}`);
ok("the incomplete line names the first missing sibling (+3)",
  !!mixed && mixed.it2 && /incomplete — missing run_it002_data\.star \+3/.test(mixed.it2.text),
  `text=${JSON.stringify(mixed?.it2?.text)}`);
ok("THE COMPLETE ROUND IS PICKABLE (it001 enabled, the exact --continue path in its name)",
  !!mixed && mixed.it1 && mixed.it1.disabled === false
    && mixed.it1.label === `Continue from iteration 1 of ${FACE_NAME}: ${PICKED}`,
  `label=${JSON.stringify(mixed?.it1?.label)}`);
ok("the newest badge rides the first COMPLETE round (it001, not the torn it002)",
  !!mixed && mixed.it1 && mixed.it1.hasNewest === true);
shot("t989-rounds-mixed.png");

/* LEG 6 — THE PICK + THE START-FRESH DOOR (the t397 label rides again) */
console.log("leg 6: the pick click (fn_cont lands, \"Continue\" blooms) + the Start-fresh door");
const pickRow = await realClick(`[...document.querySelectorAll('button[aria-label^="Continue from iteration 1 of ${FACE_NAME}"]')].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the it001 round clicked through the real mouse path", String(pickRow).startsWith("clicked@"), String(pickRow));
const pickLanded = await poll(
  `(() => { const c = document.getElementById(${JSON.stringify(CONT_ID)}); const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); const b = [...document.querySelectorAll('button')].find((x) => { const t = (x.textContent ?? '').trim(); return ['Run','Re-run','Continue'].includes(t) && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().x > 1000; }); return JSON.stringify({ shut: !p || p.getBoundingClientRect().width === 0, value: c ? c.value : null, runLabel: b ? b.textContent.trim() : null }); })()`,
  (v) => v.shut && v.value === PICKED && v.runLabel === "Continue", 16, 500);
ok("THE PICK LANDED (the popover shut, the path in fn_cont, the t397 label flipped to \"Continue\")",
  !!pickLanded && pickLanded.shut && pickLanded.value === PICKED && pickLanded.runLabel === "Continue",
  `fn_cont=${JSON.stringify(pickLanded?.value)} label="${pickLanded?.runLabel}"`);
shot("t989-pick-continue.png");
/* reopen — the Start-fresh door + the picked row's check */
const reTrig = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the Rounds trigger reopened the popover", String(reTrig).startsWith("clicked@"), String(reTrig));
const startFresh = await poll(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const sf = [...p.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Start fresh')); const it1 = [...p.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Continue from iteration 1 of ${FACE_NAME}')); return JSON.stringify({ up: true, sf: !!sf, check: !!it1 && it1.querySelectorAll('svg').length > 0 }); })()`,
  (v) => v.up && v.sf, 16, 500);
ok("THE START-FRESH DOOR IS UP (a continue target owns the popover's top door)",
  !!startFresh && startFresh.up && startFresh.sf);
ok("the picked row wears its check (the value's own attribution)",
  !!startFresh && startFresh.check === true);
shot("t989-start-fresh.png");
const sfClick = await realClick(`[...document.querySelectorAll(${JSON.stringify(POPOVER_SEL)})].flatMap((p) => [...p.querySelectorAll('button')]).find((b) => (b.textContent ?? '').includes('Start fresh'))`);
ok("the Start-fresh door clicked", String(sfClick).startsWith("clicked@"), String(sfClick));
const sfLanded = await poll(
  `(() => { const c = document.getElementById(${JSON.stringify(CONT_ID)}); const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); const b = [...document.querySelectorAll('button')].find((x) => { const t = (x.textContent ?? '').trim(); return ['Run','Re-run','Continue'].includes(t) && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().x > 1000; }); return JSON.stringify({ shut: !p || p.getBoundingClientRect().width === 0, value: c ? c.value : null, runLabel: b ? b.textContent.trim() : null }); })()`,
  (v) => v.shut && v.value === "" && v.runLabel === "Run", 16, 500);
ok("THE FIELD IS FRESH AGAIN (fn_cont empty, the popover shut, the label back to \"Run\")",
  !!sfLanded && sfLanded.shut && sfLanded.value === "" && sfLanded.runLabel === "Run",
  `fn_cont=${JSON.stringify(sfLanded?.value)} label="${sfLanded?.runLabel}"`);

/* LEG 7 — THE UPSTREAM READS (the designed negative, then the real demo read) */
console.log("leg 7: the upstream reads (the silent never-ran negative, then the real class2d rounds)");
const api = (method, url, body) => execSync(`curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`, { encoding: "utf8", timeout: 30_000 });
/* sweep EVERY edge touching the face (both directions) — duplicate-proof */
const sweepFaceEdges = () => {
  let swept = 0;
  try {
    const body = JSON.parse(api("GET", "/api/edges"));
    const list = Array.isArray(body) ? body : body.edges ?? [];
    for (const e of list) {
      if (e.fromJobId === FACE_ID || e.toJobId === FACE_ID) { api("DELETE", `/api/edges/${e.id}`); swept++; }
    }
  } catch { /* edges route untouched — fine */ }
  return swept;
};
const edgeIdFor = (fromId, toId) => {
  try {
    const body = JSON.parse(api("GET", "/api/edges"));
    const list = Array.isArray(body) ? body : body.edges ?? [];
    const hit = list.find((e) => (e.fromJobId === fromId && e.toJobId === toId) || (e.fromJobId === toId && e.toJobId === fromId));
    return hit?.id ?? null;
  } catch { return null; }
};
const addEdge = (fromId, toId) => api("POST", "/api/edges", { fromJobId: fromId, toJobId: toId });
const delEdge = (id) => api("DELETE", `/api/edges/${id}`);
/* reopen the popover for the upstream legs */
const preSwept = sweepFaceEdges();
console.log(`  (pre-swept ${preSwept} survivor edge(s) on the face — the duplicate-proof lane)`);
const upTrig = await realClick(`[...document.querySelectorAll(${JSON.stringify(TRIGGER_SEL)})].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the popover reopened for the upstream legs", String(upTrig).startsWith("clicked@"), String(upTrig));
addEdge(T988_ID, FACE_ID);
ok("the negative's edge EXISTS (the POST answered an id — the negative is not vacuous)", !!edgeIdFor(T988_ID, FACE_ID));
const negUp1 = await refreshClick();
ok("the refresh clicked (the ?refresh=1 lane, both TTLs bypassed)", negUp1);
const negUp = await poll(
  `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const chip = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === '2 rounds'); return JSON.stringify({ up: true, ready: !!chip, upstream: (p.textContent ?? '').includes('Upstream ·') }); })()`,
  (v) => v.up && v.ready, 16, 500);
ok("THE DESIGNED NEGATIVE HOLDS — the never-ran upstream (Continue Face t988) adds NO row (graph-visible, silent)",
  !!negUp && negUp.up && negUp.ready && negUp.upstream === false, `ready=${JSON.stringify(negUp?.ready)} upstream=${JSON.stringify(negUp?.upstream)}`);
const t988Edge = edgeIdFor(T988_ID, FACE_ID);
if (t988Edge) delEdge(t988Edge);
ok("the negative's edge swept (the world back to edgeless)", !edgeIdFor(T988_ID, FACE_ID));
/* the REAL upstream: the completed class2d demo — its run record is a
 * MOCK-CLUSTER record, so the lane is REMOTE (the violet "cluster" badge,
 * the find answered 201 rounds over the mock SSH; the probe named the
 * miss on the first ride: the row was healthy, the assert demanded local) */
addEdge(CLASS2D_ID, FACE_ID);
ok("the real read's edge EXISTS (the POST answered an id)", !!edgeIdFor(CLASS2D_ID, FACE_ID));
const realUp1 = await refreshClick();
ok("the real read's refresh clicked (the ?refresh=1 lane)", realUp1);
/* the SSH round rides the mock's serialized queue — a wedged round eats its
 * 20s timeout window, so the read polls through the phases and pays ONE
 * retry through the product's own refresh door (the affordance invites it);
 * every sight is recorded for the receipt (the phase trace) */
const phaseTrace = [];
const realState = `(() => { const p = document.querySelector(${JSON.stringify(POPOVER_SEL)}); if (!p) return JSON.stringify({ up: false }); const head = [...p.querySelectorAll('span')].find((x) => (x.textContent ?? '').trim() === 'Upstream · ${CLASS2D_NAME}'); const cluster = head ? [...p.querySelectorAll('span')].some((x) => (x.textContent ?? '').trim() === 'cluster') : false; const it200 = [...p.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Continue from iteration 200 of ${CLASS2D_NAME}')); const loading = (p.textContent ?? '').includes('Reading checkpoints'); const errBox = [...p.querySelectorAll('p')].find((x) => (x.textContent ?? '').includes('could not read the rounds')); return JSON.stringify({ up: true, loading, err: errBox ? errBox.textContent.trim().slice(0, 80) : null, head: !!head, cluster, it200: it200 ? { label: it200.getAttribute('aria-label'), disabled: it200.disabled, hasNewest: (it200.textContent ?? '').includes('newest') } : null }); })()`;
let realUp = null;
for (let round = 0; round < 2 && !realUp; round++) {
  if (round > 0) {
    const again = await refreshClick();
    phaseTrace.push(`retry#${round} refresh=${again}`);
  }
  for (let i = 0; i < 18; i++) {
    const v = evalJson(realState);
    if (i % 4 === 0) phaseTrace.push(`r${round}i${i}: ${JSON.stringify(v).slice(0, 140)}`);
    if (v && v.up && v.head && v.it200) { realUp = v; break; }
    await sleep(500);
  }
}
ok("THE UPSTREAM SETTLED READ IS LIVE (\"Upstream · 2D Classification (tutorial)\" · the cluster lane badge)",
  !!realUp && realUp.head && realUp.cluster, `head=${JSON.stringify(realUp?.head)} cluster=${JSON.stringify(realUp?.cluster)}`);
ok("the upstream's own newest round reads (it200, the real demo family, pickable)",
  !!realUp && realUp.it200 && realUp.it200.disabled === false
    && String(realUp.it200.label).startsWith(`Continue from iteration 200 of ${CLASS2D_NAME}: `),
  `label=${JSON.stringify(String(realUp?.it200?.label).slice(0, 90))}`);
ok("the upstream round wears the newest badge",
  !!realUp && realUp.it200 && realUp.it200.hasNewest === true);
shot("t989-upstream.png");
const sweptReal = sweepFaceEdges();
ok("the real read's edge swept (the world back to edgeless)", !edgeIdFor(CLASS2D_ID, FACE_ID) && !edgeIdFor(T988_ID, FACE_ID), `swept=${sweptReal}`);

/* LEG 8 — THE DRAG-RAISE WITNESS (the interrupted window's cosmetic, met rendered) */
console.log("leg 8: the drag-raise witness (raise rides the FIRST REAL MOVE, mid-drag, above a buried dialog)");
/* the fresh-open law: a new rider, a fresh open */
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
await poll(`(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`, (v) => v.n > 0, 24, 500);
const openDoor = await realClick(`[...document.querySelectorAll('button[aria-label="AI assistant"]')].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the companion summoned through the header's own door", String(openDoor).startsWith("clicked@"), String(openDoor));
const compUp = await poll(
  `(() => { const r = document.querySelector('[data-companion-window]'); return JSON.stringify({ up: !!r && r.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.up, 12, 500);
ok("the companion window is up (the body-level citizen)", !!compUp && compUp.up);
/* the AI-settings door — a dialog summoned FROM INSIDE keeps the front */
const setDoor = await realClick(`[...document.querySelectorAll('button[aria-label="AI provider settings"]')].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the AI-settings door clicked (a companion-summoned dialog)", String(setDoor).startsWith("clicked@"), String(setDoor));
const dlgUp = await poll(
  `(() => { const d = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!d }); })()`,
  (v) => v.up, 20, 500);
ok("the settings dialog is up (the shared DialogContent plane)", !!dlgUp && dlgUp.up);
const buried = await poll(
  `(() => { const root = document.querySelector('[data-companion-window]'); const dlg = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ rootUp: !!root && root.getBoundingClientRect().width > 0, dlgUp: !!dlg && dlg.getBoundingClientRect().width > 0, buried: !!root && !!dlg && document.body.lastElementChild !== root }); })()`,
  (v) => v.rootUp && v.dlgUp && v.buried, 16, 500);
ok("THE BURIAL IS REAL (the dialog keeps the front — lastElementChild is not the companion)",
  !!buried && buried.buried === true);
shot("t989-buried.png");
/* the drag bar probe: a point over a NON-CONTROL inside the drag surface */
const barPoint = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); if (!root) return JSON.stringify({ up: false }); const bar = root.querySelector('.cursor-grab'); if (!bar) return JSON.stringify({ up: false, bar: false }); const r = bar.getBoundingClientRect(); for (const dx of [90, 120, 60, 150, 40, 180, 220, 260]) { const x = Math.round(r.x + Math.min(dx, r.width - 8)); const y = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(x, y); if (hit && bar.contains(hit) && !hit.closest('button, input, a, textarea, [data-nodrag]')) return JSON.stringify({ up: true, x, y }); } return JSON.stringify({ up: true, x: null }); })()`);
ok("the drag bar answers with a non-control point (beginDrag's filter will pass it)",
  !!barPoint && barPoint.up && barPoint.x != null, `point=${barPoint?.x},${barPoint?.y}`);
const geoBefore = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); return JSON.stringify({ left: parseFloat(root?.style?.left ?? \"NaN\"), top: parseFloat(root?.style?.top ?? \"NaN\") }); })()`);
/* the round-trip drag: down → +14px (the first REAL MOVE — the raise fires) →
 * the MID-DRAG read → back → up (the geometry ends byte-identical) */
sh(`${AB} mouse move ${barPoint.x} ${barPoint.y}`);
sh(`${AB} mouse down`);
await sleep(150);
sh(`${AB} mouse move ${barPoint.x + 14} ${barPoint.y + 14}`);
const midDrag = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); return JSON.stringify({ raised: !!root && document.body.lastElementChild === root, left: parseFloat(root?.style?.left ?? \"NaN\"), top: parseFloat(root?.style?.top ?? \"NaN\") }); })()`);
shot("t989-dragraise.png");
ok("THE RAISE RODE THE FIRST REAL MOVE (the window is lastElementChild MID-DRAG, before any release)",
  !!midDrag && midDrag.raised === true);
ok("the raise did not eat the gesture (the window MOVED with the pointer, +14px)",
  !!midDrag && Number.isFinite(midDrag.left) && Number.isFinite(geoBefore.left)
    && Math.abs(midDrag.left - (geoBefore.left + 14)) <= 2
    && Math.abs(midDrag.top - (geoBefore.top + 14)) <= 2,
  `left ${geoBefore.left} → ${midDrag.left}`);
sh(`${AB} mouse move ${barPoint.x} ${barPoint.y}`);
await sleep(150);
sh(`${AB} mouse up`);
const afterUp = evalJson(
  `(() => { const root = document.querySelector('[data-companion-window]'); const dlg = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ left: parseFloat(root?.style?.left ?? \"NaN\"), top: parseFloat(root?.style?.top ?? \"NaN\"), dlgUp: !!dlg && dlg.getBoundingClientRect().width > 0, stillLast: !!root && document.body.lastElementChild === root }); })()`);
ok("the round trip restored the geometry (the echo writes the same coords)",
  !!afterUp && Number.isFinite(afterUp.left) && Math.abs(afterUp.left - geoBefore.left) <= 1
    && Math.abs(afterUp.top - geoBefore.top) <= 1,
  `left=${afterUp?.left} top=${afterUp?.top}`);
ok("the t501 contract met alive — the companion interaction never dismissed the dialog",
  !!afterUp && afterUp.dlgUp === true);
ok("the window keeps the front after the release (the raise's own durability)",
  !!afterUp && afterUp.stillLast === true);
/* the close: the conditional Escape (a dialog verifiably up), then the companion's own door */
sh(`${AB} press Escape`);
const dlgShut = await poll(
  `(() => { const d = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!d }); })()`,
  (v) => v.up === false, 10, 500);
if (!dlgShut || dlgShut.up !== false) {
  const xClick = await realClick(`[...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((d) => d.getBoundingClientRect().width > 0)?.querySelector('[data-slot=\"dialog-close\"]')`);
  await poll(`(() => { const d = [...document.querySelectorAll('[data-slot=\"dialog-content\"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!d }); })()`, (v) => v.up === false, 8, 500);
  ok("the dialog closed (the fallback close button)", String(xClick).startsWith("clicked@"), String(xClick));
} else {
  ok("the dialog closed (the conditional Escape — a dialog was verifiably up)", true);
}
const shutDoor = await realClick(`[...document.querySelectorAll('button[aria-label=\"关闭 AI 助手\"]')].find((b) => b.getBoundingClientRect().width > 0)`);
const compShut = await poll(
  `(() => { const r = document.querySelector('[data-companion-window]'); return JSON.stringify({ shut: !r || r.getBoundingClientRect().width === 0 }); })()`,
  (v) => v.shut, 10, 500);
ok("the companion shut through its own door (the t797 law)",
  String(shutDoor).startsWith("clicked@") && !!compShut && compShut.shut);

/* LEG 9 — CLEANUP + WORLD HONESTY (the fixtures swept, the world byte-honest) */
console.log("leg 9: cleanup + the world's honesty");
try {
  const raw = readFileSync(STATE_FILE, "utf8");
  const runs9 = JSON.parse(raw);
  delete runs9[FACE_ID];
  const tmp9 = `${STATE_FILE}.t989.tmp`;
  writeFileSync(tmp9, JSON.stringify(runs9, null, 2));
  execSync(`mv "${tmp9}" "${STATE_FILE}"`);
  console.log("  run record swept");
} catch { /* state untouched — fine */ }
if (existsSync(WORKDIR)) { rmSync(WORKDIR, { recursive: true, force: true }); console.log("  workdir swept"); }
sweepFaceEdges(); // the defensive re-sweep — a wedged round may have eaten leg 7's own
let edgesOk = false, faceEdgeLeft = null;
for (let attempt = 0; attempt < 3 && !edgesOk; attempt++) {
  if (attempt > 0) await sleep(4000);
  try {
    const eBody = JSON.parse(api("GET", "/api/edges"));
    const eList = Array.isArray(eBody) ? eBody : eBody.edges ?? [];
    if (eList.length > 0) { // the GET must ANSWER (the demo pipeline's own 14 edges) before the absence means anything
      edgesOk = true;
      faceEdgeLeft = eList.find((e) => e.fromJobId === FACE_ID || e.toJobId === FACE_ID)?.id ?? null;
    }
  } catch { /* the wedge — retry */ }
}
ok("no edge touches the face (the reads' edges swept; the edges GET answered)", edgesOk && !faceEdgeLeft, `left=${faceEdgeLeft ?? "none"}`);
let body9 = null;
for (let attempt = 0; attempt < 3 && !body9; attempt++) {
  if (attempt > 0) await sleep(4000); // a wedged SSH round holds the dev server up to its 20s window — the read retries past it
  try { body9 = JSON.parse(api("GET", "/api/jobs")); } catch { body9 = null; }
  if (body9 && typeof body9 === "object") { const a = Array.isArray(body9) ? body9 : body9.jobs ?? []; if (a.length === 0) body9 = null; }
}
const arr9 = Array.isArray(body9) ? body9 : body9?.jobs ?? [];
ok("the world carries NINETEEN jobs (18 standing + the face)", arr9.length === 19, `rows=${arr9.length}`);
const face9 = arr9.find((j) => j.name === FACE_NAME);
ok("the face is pristine (idle, no run evidence, no continue target — the t445 law)",
  !!face9 && face9.status === "idle" && face9.ranParams == null && face9.result == null && !face9.params?.fn_cont,
  face9 ? `status=${face9.status} fn_cont=${JSON.stringify(face9.params?.fn_cont)}` : "missing");
const mintVerify = sh(`node scripts/t989-rounds-face-mint.mjs verify 2>&1 | tail -1`);
ok("the mint's own verify answers GREEN after the sweep", /GREEN/.test(mintVerify), mintVerify.trim());
const fingerprint9 = arr9.filter((j) => j.name !== FACE_NAME).map((j) => `${j.id}:${j.status}:${j.name}`).sort().join("|");
ok("the standing eighteen untouched (byte-identical id:status:name fingerprint)",
  fingerprint9 === standingFingerprint, `rows=${fingerprint9.split("|").length}`);

/* the receipt */
mkdirSync(QA_DIR, { recursive: true });
writeFileSync(RECEIPT, JSON.stringify({
  walk: "t989-rounds-face-walk",
  at: new Date().toISOString(),
  face: { name: FACE_NAME, jobId: FACE_ID },
  pass, fail,
  phaseTrace,
  results,
}, null, 2));
console.log(`receipt: ${RECEIPT}`);

console.log(`== t989 rounds-face walk ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);



