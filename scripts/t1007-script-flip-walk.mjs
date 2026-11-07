#!/usr/bin/env node
/**
 * t1007 — THE SCRIPT-FLIP SIBLING WALK (the t1007 entry's candidate ①):
 * the t1006 deep-door walk rode the sbatch dialog's copied pair; THIS
 * walk rides the OTHER G-needle face — the pipeline-script dialog's
 * `<span aria-live="polite">{copied ? "Copied" : "Copy script"}</span>`
 * (the t1004 unit's G16 needle, verbatim) through its OWN real door:
 * the command palette's export family.
 *
 * THE LEGS (zero minting, zero server writes — the pipeline-script GET
 * is a read-only assembly, the clipboard touches nothing):
 *   1. the fresh open — the dashboard renders;
 *   2. THE PALETTE DOOR — the header chip ("Open command palette
 *      (Ctrl+K)") opens the cmdk palette; the walk types "pipeline"
 *      (real keystrokes into the palette's own focused input) and the
 *      family narrows to "Export pipeline as shell script";
 *   3. the item takes the real click — the palette drops itself (the
 *      onSelect's own close()), the dialog becomes the next modal;
 *   4. the "Assembling the pipeline…" flight settles into the script
 *      <pre> + the stats band;
 *   5. THE COPIED PAIR, BOTH BRANCHES (the window's proof — the t1006
 *      grammar, the sibling face): at rest the span speaks "Copy
 *      script" and the control is enabled; the real click's user
 *      activation carries navigator.clipboard; the tight 100ms poll
 *      CATCHES the flip to "Copied"; the settle poll rides the honest
 *      revert 1600ms later;
 *   6. the sibling faces at rest — the Download control's honest name
 *      asserted SELF-CONSISTENT (a disabled face must speak its gate
 *      word, an enabled face its plain name — the t1005 law), the
 *      stats band's badge census recorded, the RELION-detection face
 *      recorded honestly (present or absent, both honest);
 *   7. the world restored — the dialog shuts, the canvas stands, the
 *      world's fingerprint as-found = as-left.
 *
 * RIDE LAWS inherited: one fresh `agent-browser open` (the eval-hang
 * law); poll-then-probe; realClick probes vis AND own every round;
 * the walk asserts (it is the cure's verifier) and exits honest.
 * THE LITERAL-WORD LAW (the t1006 entry's re-key note): this walk's
 * asserts pin the copied pair's words AND the palette item's label as
 * LITERALS — any rewording re-keys the walk IN THE SAME COMMIT.
 *
 *   node scripts/t1007-script-flip-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, escAll, shot,
  serverFirst, readJobs, jobsArr, fingerprint, finish,
} = createWalk({ name: "t1007-script-flip-walk", receiptFile: "t1007-script-flip-walk.json" });

console.log("=== t1007 script-flip sibling walk ===");

await serverFirst();

/* the pipeline-script dialog is found by its title ("Pipeline replay
 * script · …"); its polite span is scoped INSIDE it. */
const scriptDlg = `[...document.querySelectorAll('[role="dialog"]')].find((d) => (d.querySelector('h2')?.textContent ?? '').includes('Pipeline replay script'))`;
const politeSpan = `(() => { const d = ${scriptDlg}; return d ? d.querySelector('[aria-live="polite"]') : null; })()`;
const copyBtn = `(() => { const d = ${scriptDlg}; if (!d) return null; return [...d.querySelectorAll('button')].find((b) => b.querySelector('[aria-live="polite"]')); })()`;
const planeOf = (find) => `(() => { const el = (${find}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true', label: el.getAttribute('aria-label'), text: (el.textContent ?? '').trim().slice(0, 40) }); })()`;
const scriptPre = `(() => { const d = ${scriptDlg}; const p = d ? d.querySelector('pre[aria-label="Generated pipeline replay script"]') : null; return p ? JSON.stringify({ live: true, chars: (p.textContent ?? '').length }) : JSON.stringify({ live: false }); })()`;

let fpBefore = null, fpAfter = null;

/* LEG 1 — the fresh open */
console.log("leg 1: the fresh open");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const jobs0 = await readJobs();
fpBefore = fingerprint(jobsArr(jobs0 ?? []));
ok("the world fingerprinted (as-found)", fpBefore.length > 0, `${fpBefore.split("|").length} jobs`);

/* LEG 2 — the palette door */
console.log("leg 2: the palette door (the header chip)");
const chipClick = await realClick(`document.querySelector('[aria-label="Open command palette (Ctrl+K)"]')`);
ok("the palette chip took the real click", String(chipClick).startsWith("clicked@"), String(chipClick));
const palUp = await poll(
  `(() => { const i = document.querySelector('[cmdk-input]'); if (!i) return JSON.stringify({ open: false }); const r = i.getBoundingClientRect(); return JSON.stringify({ open: r.width > 0, focused: document.activeElement === i, placeholder: i.getAttribute('placeholder') ?? '' }); })()`,
  (v) => v.open, 16, 500);
ok("the cmdk palette stands (its own input focused)", !!palUp && palUp.open, palUp ? `focused=${palUp.focused}` : "absent");

/* LEG 3 — type "pipeline", take the item */
console.log("leg 3: the export family narrows");
sh(`${AB} keyboard type pipeline`);
const itemUp = await poll(
  `(() => { const items = [...document.querySelectorAll('[cmdk-item]')]; const it = items.find((x) => (x.textContent ?? '').includes('Export pipeline as shell script')); if (!it) return JSON.stringify({ live: false }); const r = it.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, text: (it.textContent ?? '').trim().slice(0, 40) }); })()`,
  (v) => v.live, 12, 400);
ok("the export item stands narrowed (the family's own label, a literal pin)", !!itemUp && itemUp.live, itemUp?.text ?? "absent");
const itemClick = await realClick(`[...document.querySelectorAll('[cmdk-item]')].find((x) => (x.textContent ?? '').includes('Export pipeline as shell script'))`);
ok("the item took the real click (the palette drops itself, the dialog is next)", String(itemClick).startsWith("clicked@"), String(itemClick));

/* LEG 4 — the assembly flight settles into the script */
console.log("leg 4: the assembly flight");
const dlgUp = await poll(
  `(() => { const d = ${scriptDlg}; return d ? JSON.stringify({ open: d.getBoundingClientRect().width > 0, title: d.querySelector('h2').textContent.slice(0, 50) }) : JSON.stringify({ open: false }); })()`,
  (v) => v.open, 16, 500);
ok("the pipeline-script dialog stands", !!dlgUp && dlgUp.open, dlgUp?.title ?? "absent");
const scriptUp = await poll(
  scriptPre,
  (v) => v.live && v.chars > 0, 30, 500);
ok("the replay script arrived (the Assembling flight settled)", !!scriptUp && scriptUp.live && scriptUp.chars > 0,
  scriptUp ? `${scriptUp.chars} chars` : "the pre never appeared");
const statsUp = await poll(
  `(() => { const d = ${scriptDlg}; const s = d ? d.querySelector('[data-canvas-ui="pipeline-script-stats"]') : null; return JSON.stringify({ live: !!s && s.getBoundingClientRect().width > 0, badges: s ? s.querySelectorAll('span[data-slot="badge"], [data-slot="badge"]').length : 0 }); })()`,
  (v) => v.live, 12, 400);
ok("the stats band stands beside the script", !!statsUp && statsUp.live, statsUp ? `${statsUp.badges} badges` : "absent");

/* LEG 5 — THE COPIED PAIR, both branches (the window's proof) */
console.log("leg 5: the copied pair — both branches live (the sibling face)");
const atRest = await poll(
  planeOf(politeSpan),
  (v) => v && v.live, 12, 400);
ok("the polite span rests in the dialog", !!atRest && atRest.live, `text="${atRest?.text}"`);
const btnRest = await poll(
  planeOf(copyBtn),
  (v) => v && v.live, 12, 400);
ok("at rest the span speaks the plain word (the G16 needle's first branch)", !!btnRest && btnRest.text === "Copy script", `text="${btnRest?.text}"`);
ok("at rest the copy control is ENABLED (the script is on the table)", !!btnRest && !btnRest.disabled, `disabled=${btnRest?.disabled}`);
shot("t1007-copy-at-rest.png");

const copyClick = await realClick(copyBtn);
ok("the copy control took the real click (user activation rides)", String(copyClick).startsWith("clicked@"), String(copyClick));

/* the tight 100ms poll — the flip lives 1600ms */
let caught = null;
for (let i = 0; i < 30; i++) {
  const v = evalJson(planeOf(politeSpan));
  if (v && v.live && v.text === "Copied") { caught = v; break; }
  await sleep(100);
}
ok("THE FLIP WITNESSED — the span announced Copied (the sibling face's own flight)", !!caught, caught ? `text="${caught.text}"` : "the flip never happened (clipboard refused?)");
if (caught) shot("t1007-copy-flipped.png");

const reverted = await poll(
  planeOf(politeSpan),
  (v) => v && v.live && v.text === "Copy script", 14, 500);
ok("the span REVERTED to the plain word (the second branch, live)", !!reverted && reverted.text === "Copy script", `text="${reverted?.text}"`);

/* LEG 6 — the sibling faces at rest */
console.log("leg 6: the sibling faces at rest");
const dlFace = await poll(
  `(() => { const d = ${scriptDlg}; const b = d ? d.querySelector('[data-canvas-ui="pipeline-script-download"]') : null; if (!b) return null; return JSON.stringify({ disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`,
  (v) => v && typeof v.label === "string", 12, 400);
const dlOk = !!dlFace && (dlFace.disabled ? dlFace.label.includes("no script yet") : dlFace.label === "Download .sh");
ok("the Download face is self-consistent (a disabled face speaks its gate word — the t1005 law)", dlOk, dlFace ? `disabled=${dlFace.disabled} label="${dlFace.label}"` : "absent");
const warnFace = evalJson(`(() => { const d = ${scriptDlg}; const w = d ? [...d.querySelectorAll('div')].find((x) => (x.textContent ?? '').startsWith('RELION is not detected')) : null; return JSON.stringify({ present: !!w && w.getBoundingClientRect().width > 0 }); })()`);
ok("the RELION-detection face recorded honestly (both states are honest)", true, warnFace?.present ? "the not-detected warning stands" : "no warning (the engine is detected — the honest absence)");
shot("t1007-script-dialog.png");

/* LEG 7 — the world restored */
console.log("leg 7: the world restored");
await escAll(2);
await sleep(800);
const noDlg = await poll(
  `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().width > 0) }))()`,
  (v) => !v.open, 10, 400);
ok("the dialog shut (the ride plane is clear)", !!noDlg && !noDlg.open);
const cardsBack = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('.job-card-title').length }))()`,
  (v) => v.n > 0, 10, 400);
ok("the canvas still stands (the cards are home)", !!cardsBack && cardsBack.n > 0, `cards=${cardsBack?.n}`);
const jobs1 = await readJobs();
fpAfter = fingerprint(jobsArr(jobs1 ?? []));
ok("the world's fingerprint as-found = as-left (zero server writes)", fpBefore === fpAfter, fpBefore === fpAfter ? `${fpAfter.split("|").length} jobs` : "THE WORLD MOVED");

finish({
  legs: {
    paletteDoor: { chip: String(chipClick), item: itemUp?.text ?? null },
    copiedPair: { atRest: btnRest?.text ?? null, flipWitnessed: !!caught, reverted: reverted?.text ?? null },
    siblingFaces: { download: dlFace ?? null, relionWarning: !!warnFace?.present },
  },
  world: { before: fpBefore, after: fpAfter },
});
