#!/usr/bin/env node
/**
 * t1006 — THE DEEP-DOOR WITNESS WALK (the copied pair's live announce,
 * the t1006 entry's candidate ①): the t1004 G-needles pinned the copied
 * pair's polite spans VERBATIM at source; the census can see the span,
 * but a static scan can never see the FLIP. This ride opens the sbatch
 * dialog through its REAL three-door chain (the canvas job card → the
 * inspector's tools menu → the sbatch item) and rides the dialog's own
 * cohort faces through one door:
 *
 *   1. the fresh open — the dashboard renders;
 *   2. THE JOB CARD DOOR — a canvas card opens the Job inspector
 *      (the t984 mouth's real door);
 *   3. THE TOOLS DOOR — "More job tools" → "Slurm sbatch dry-run…"
 *      (the t757 controlled form's owner); the "Generating…" flight
 *      settles into the script <pre>;
 *   4. THE COPIED PAIR, BOTH BRANCHES (the window's proof) — at rest
 *      the span speaks "Copy script" and the control is enabled; the
 *      real click's user activation carries navigator.clipboard
 *      (focused document + trusted input), the tight 100ms poll CATCHES
 *      the flip to "Copied" (the aria-live announce the census could
 *      never see), and the settle poll rides the honest revert 1600ms
 *      later — both branches of the t1004 G-needles' word, live;
 *   5. THE PROFILES EDITOR's gate faces (the deep door's second layer)
 *      — "Manage cluster profiles" opens the registry over the sbatch
 *      dialog; the Add and Duplicate buttons' names are read AT REST
 *      and asserted for self-consistency (a disabled face must speak
 *      its gate word, an enabled face its plain name — the t1005 cure's
 *      own law); one Escape returns to the sbatch dialog;
 *   6. THE QUEUE-SIM FLIGHT (the same door's flight face) — "Run queue
 *      simulation" is clicked; a page-side MutationObserver (armed on
 *      the button BEFORE the click — the no-gap witness, taught by the
 *      fifth ride's honest RED: a sub-150ms flight can lose a sampling
 *      poll) records the "(running)" name-swap + the disable, the
 *      settle poll rides the return + the KPI band's arrival (the
 *      flight's honest return); the simulate POST is read-only
 *      (findMany only — zero writes);
 *   7. the world restored — the layers shut, the canvas stands, the
 *      world's fingerprint as-found = as-left (the clipboard and the
 *      simulator are both write-free).
 *
 * RIDE LAWS inherited: one fresh `agent-browser open` (the eval-hang
 * law); poll-then-probe; realClick probes vis AND own every round;
 * the walk asserts (it is the cure's verifier) and exits honest.
 *
 * THE THREE DOOR LESSONS the first rides taught (pinned here so the
 * next window inherits the map, not the mines):
 *   · THE CARD'S OWN LAW — a plain click on a card body opens the
 *     editing panel for an IDLE job, the inspector for a SUBMITTED one
 *     (job-card.tsx handlePointerUp); the walk never clicks blind.
 *   · THE PAN LAW — the canvas restores its viewport; a named card can
 *     sit off-viewport (x=-736 seen live) and a transform-panned canvas
 *     ignores scrollIntoView; the walk probes for a VISIBLE submitted
 *     card and falls back to the card's own KEYBOARD CONTRACT (the
 *     [data-card-btn] anchor + Enter — the t773 lineage's keyboard
 *     edition, the card's own onKeyDown law).
 *   · THE BUILDER LAW — the sbatch script exists only where the server
 *     has a command builder (ctffind/autopick/extract/class2d/
 *     initialmodel/class3d/refine3d/maskcreate/postprocess in this
 *     world); import/select-family jobs answer "no builder
 *     implemented" and the wired diagnostic faces answer "no upstream
 *     job" — the script <pre> never mounts and the copy control stays
 *     disabled (and a disabled shadcn Button is pointer-transparent:
 *     disabled:pointer-events-none makes realClick's NEVER-OWN the
 *     honest refusal face). The walk picks within the builder set.
 *
 *   node scripts/t1006-deep-door-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, escAll, shot,
  serverFirst, readJobs, jobsArr, fingerprint, finish,
} = createWalk({ name: "t1006-deep-door-walk", receiptFile: "t1006-deep-door-walk.json" });

console.log("=== t1006 deep-door witness walk ===");

await serverFirst();

/* the sbatch dialog is found by its title ("Slurm submission · …");
 * the copied pair is the dialog's ONLY aria-live span (verified at
 * source across the hpc family). */
const sbatchDlg = `[...document.querySelectorAll('[role="dialog"]')].find((d) => (d.querySelector('h2')?.textContent ?? '').includes('Slurm submission'))`;
const politeSpan = `(() => { const d = ${sbatchDlg}; return d ? d.querySelector('[aria-live="polite"]') : null; })()`;
const copyBtn = `(() => { const d = ${sbatchDlg}; if (!d) return null; return [...d.querySelectorAll('button')].find((b) => b.querySelector('[aria-live="polite"]')); })()`;
const planeOf = (find) => `(() => { const el = (${find}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true', label: el.getAttribute('aria-label'), text: (el.textContent ?? '').trim().slice(0, 40) }); })()`;
const scriptPre = `(() => { const d = ${sbatchDlg}; const p = d ? d.querySelector('pre[aria-label="Generated sbatch script"]') : null; return p ? JSON.stringify({ live: true, chars: (p.textContent ?? '').length }) : JSON.stringify({ live: false }); })()`;

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

/* LEG 2 — the job card door → the inspector */
console.log("leg 2: the job card door (the t984 mouth, the card's own law)");
/* the hydration-stability law (taught by the second ride's honest RED):
 * the canvas mounts its cards PROGRESSIVELY (a mid-hydration beat showed
 * 20 of 22) — a count>0 gate passes too early. The walk waits for the
 * count to hold steady across three consecutive reads. */
let stable = null, lastN = -1, same = 0;
for (let i = 0; i < 30 && same < 3; i++) {
  const v = evalJson(`(() => JSON.stringify({ n: document.querySelectorAll('.job-card-title').length }))()`);
  if (v && v.n > 0 && v.n === lastN) same++; else same = 0;
  lastN = v?.n ?? -1;
  await sleep(500);
}
stable = lastN;
ok("the canvas hydrated its job cards (count stable ×3)", stable > 0, `cards=${stable}`);
/* THE CARD'S OWN LAW (job-card.tsx handlePointerUp, taught by the first
 * ride's honest RED): a plain click on the card body opens the editing
 * panel for an IDLE job and the big inspector for a SUBMITTED one. The
 * walk reads the world, picks a submitted job, and finds ITS card by
 * name — the door is not a lottery. */
/* THE BUILDER LAW — the sbatch script's own cohort (see the header):
 * the server builds commands only for these types; everything else
 * answers the error face and the copy control stays disabled. */
const BUILDER_TYPES = ["ctffind", "autopick", "extract", "class2d", "initialmodel", "class3d", "refine3d", "maskcreate", "postprocess"];
const capable = (j) => BUILDER_TYPES.includes(j.type);
const pick = jobsArr(jobs0 ?? []).find((j) => j.status === "completed" && capable(j))
  ?? jobsArr(jobs0 ?? []).find((j) => j.status && j.status !== "idle" && capable(j));
ok("a builder-capable submitted job picked for the door", !!pick, pick ? `${pick.status} · ${pick.type} · ${pick.name}` : "none");
/* THE PAN LAW (taught by the third ride's honest RED): the canvas
 * restores its viewport — the named card may sit OFF-VIEWPORT
 * (x=-736, y=-191 in the ride), and a transform-panned canvas ignores
 * scrollIntoView. So the walk probes among the SUBMITTED jobs for a
 * card VISIBLE and self-hit (the pointer law's preference), and falls
 * back to the card's own KEYBOARD CONTRACT when no card is in view:
 * the card root's onKeyDown — Enter opens the inspector for a
 * submitted job, the t773 door lineage's keyboard edition; the focus
 * anchor [data-card-btn] is the one honest focus target the card owns
 * (the arrow navigator's own idiom). */
const submitted = jobsArr(jobs0 ?? []).filter((j) => j.status && j.status !== "idle" && capable(j));
ok("builder-capable submitted jobs available for the door", submitted.length > 0, `${submitted.length}`);
const ordered = [
  ...submitted.filter((j) => j.status === "completed"),
  ...submitted.filter((j) => j.status !== "completed"),
];
const probeCard = (name) => `(() => { const el = [...document.querySelectorAll('.job-card-title')].find((e) => e.textContent.trim() === ${JSON.stringify(name)}); if (!el) return JSON.stringify({ found: false }); const r = el.getBoundingClientRect(); const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const inview = r.width > 0 && r.height > 0 && cx >= 2 && cy >= 2 && cx <= window.innerWidth - 2 && cy <= window.innerHeight - 2; const hit = inview ? document.elementFromPoint(cx, cy) : null; return JSON.stringify({ found: true, ok: inview && !!hit && el.contains(hit), x: cx, y: cy }); })()`;
let doorJob = null, doorProbe = null;
for (let round = 0; round < 3 && !doorJob; round++) {
  for (const j of ordered.slice(0, 14)) {
    const p = evalJson(probeCard(j.name));
    if (p && p.found && p.ok) { doorJob = j; doorProbe = p; break; }
  }
  if (!doorJob) await sleep(1000);
}
let openedVia = null;
if (doorJob) {
  const cardClick = await realClick(`[...document.querySelectorAll('.job-card-title')].find((e) => e.textContent.trim() === ${JSON.stringify(doorJob.name)})`);
  if (String(cardClick).startsWith("clicked@")) openedVia = `pointer@${doorJob.name}`;
}
if (!openedVia) {
  doorJob = doorJob ?? pick;
  const focusOk = evalJson(`(() => { const b = document.querySelector('[data-card-btn="${doorJob?.id ?? ""}"]'); if (!b) return JSON.stringify({ focused: false }); b.focus(); return JSON.stringify({ focused: document.activeElement === b }); })()`);
  sh(`${AB} press Enter`);
  await sleep(600);
  openedVia = focusOk?.focused ? `keyboard@${doorJob?.name}` : null;
}
ok("the submitted card opened the inspector (the pointer law or the Enter contract)", !!openedVia, openedVia ?? "neither door opened");
const insp = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.querySelector('h2')?.textContent ?? '').includes('Job inspector')); if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: true, title: d.querySelector('h2').textContent.slice(0, 60) }); })()`,
  (v) => v.open, 16, 500);
ok("the inspector dialog stands (the card mouth's real door)", !!insp && insp.open, insp?.title ?? "");

/* LEG 3 — the tools door → the sbatch dialog */
console.log("leg 3: the tools door (the t757 owner's home)");
const toolsClick = await realClick(`document.querySelector('button[aria-label="More job tools"]')`);
ok("the tools menu knocked", String(toolsClick).startsWith("clicked@"), String(toolsClick));
const itemUp = await poll(
  `(() => { const it = document.querySelector('[data-testid="tools-sbatch-item"]'); if (!it) return JSON.stringify({ live: false }); const r = it.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, text: (it.textContent ?? '').trim().slice(0, 40) }); })()`,
  (v) => v.live, 12, 400);
ok("the sbatch menu item stands", !!itemUp && itemUp.live, itemUp?.text ?? "absent");
const itemClick = await realClick(`document.querySelector('[data-testid="tools-sbatch-item"]')`);
ok("the sbatch item opened the deep door", String(itemClick).startsWith("clicked@"), String(itemClick));
const scriptUp = await poll(
  scriptPre,
  (v) => v.live && v.chars > 0, 30, 500);
ok("the sbatch script arrived (the Generating flight settled)", !!scriptUp && scriptUp.live && scriptUp.chars > 0,
  scriptUp ? `${scriptUp.chars} chars` : "the pre never appeared");

/* LEG 4 — THE COPIED PAIR, both branches (the window's proof) */
console.log("leg 4: the copied pair — both branches live");
const atRest = await poll(
  planeOf(politeSpan),
  (v) => v && v.live, 12, 400);
ok("the polite span rests in the dialog", !!atRest && atRest.live, `text="${atRest?.text}"`);
const btnRest = await poll(
  planeOf(copyBtn),
  (v) => v && v.live, 12, 400);
ok("at rest the span speaks the plain word (the t1004 G-needle's first branch)", !!btnRest && btnRest.text === "Copy script", `text="${btnRest?.text}"`);
ok("at rest the copy control is ENABLED (the script is on the table)", !!btnRest && !btnRest.disabled, `disabled=${btnRest?.disabled}`);
shot("t1006-copy-at-rest.png");

const copyClick = await realClick(copyBtn);
ok("the copy control took the real click (user activation rides)", String(copyClick).startsWith("clicked@"), String(copyClick));

/* the tight 100ms poll — the flip lives 1600ms, the walk must be quick */
let caught = null;
for (let i = 0; i < 30; i++) {
  const v = evalJson(planeOf(politeSpan));
  if (v && v.live && v.text === "Copied") { caught = v; break; }
  await sleep(100);
}
ok("THE FLIP WITNESSED — the span announced Copied (the aria-live the census could never see)", !!caught, caught ? `text="${caught.text}"` : "the flip never happened (clipboard refused?)");
if (caught) shot("t1006-copy-flipped.png");

/* the settle — the honest revert 1600ms later */
const reverted = await poll(
  planeOf(politeSpan),
  (v) => v && v.live && v.text === "Copy script", 14, 500);
ok("the span REVERTED to the plain word (the second branch, live)", !!reverted && reverted.text === "Copy script", `text="${reverted?.text}"`);

/* LEG 5 — the profiles editor's gate faces (the deep door's second layer) */
console.log("leg 5: the profiles editor's gate faces (the second layer)");
const profClick = await realClick(`(() => { const d = ${sbatchDlg}; return d ? d.querySelector('button[aria-label="Manage cluster profiles"]') : null; })()`);
ok("the profiles door knocked", String(profClick).startsWith("clicked@"), String(profClick));
const profDlg = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.querySelector('h2')?.textContent ?? '').includes('Cluster profiles')); if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: true, title: d.querySelector('h2').textContent.slice(0, 60) }); })()`,
  (v) => v.open, 16, 500);
ok("the registry dialog stands OVER the sbatch dialog (the layer law)", !!profDlg && profDlg.open, profDlg?.title ?? "");

/* the gate faces, read at rest and asserted SELF-CONSISTENT:
 * a disabled face must speak its gate word; an enabled face its
 * plain name — the t1005 cure's own law, witnessed live. */
const addFace = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.querySelector('h2')?.textContent ?? '').includes('Cluster profiles')); const b = d ? [...d.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Add')) : null; if (!b) return null; return JSON.stringify({ disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`,
  (v) => v && typeof v.label === "string", 12, 400);
const addOk = !!addFace && (addFace.disabled ? addFace.label.includes("the profile limit is reached") : addFace.label === "Add");
ok("the Add face is self-consistent (a disabled face speaks its gate word)", addOk, addFace ? `disabled=${addFace.disabled} label="${addFace.label}"` : "absent");
const dupFace = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.querySelector('h2')?.textContent ?? '').includes('Cluster profiles')); const b = d ? [...d.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Duplicate selected profile')) : null; if (!b) return null; return JSON.stringify({ disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`,
  (v) => v && typeof v.label === "string", 12, 400);
const dupOk = !!dupFace && (dupFace.disabled ? dupFace.label !== "Duplicate selected profile" : dupFace.label === "Duplicate selected profile");
ok("the Duplicate face is self-consistent (the t1005 gate words live)", dupOk, dupFace ? `disabled=${dupFace.disabled} label="${dupFace.label}"` : "absent");
shot("t1006-profiles-gates.png");

/* one Escape — the top layer only; the sbatch dialog must stand */
sh(`${AB} press Escape`);
await sleep(600);
const backHome = await poll(
  scriptPre,
  (v) => v.live && v.chars > 0, 10, 400);
ok("one Escape returned to the sbatch dialog (the script pre stands)", !!backHome && backHome.live, backHome ? `${backHome.chars} chars` : "lost");

/* LEG 6 — the queue-sim flight (the same door's flight face) */
console.log("leg 6: the queue-sim flight (the stateful swap, live)");
const RUN = `(() => { const b = document.querySelector('button[aria-label^="Run queue simulation"]'); return b ?? null; })()`;
const runRest = await poll(
  planeOf(RUN),
  (v) => v && v.live, 12, 400);
ok("the Run face rests honestly (the plain name)", !!runRest && runRest.label === "Run queue simulation", `label="${runRest?.label}" disabled=${runRest?.disabled}`);
/* THE NO-GAP WITNESS (taught by the fifth ride's honest RED): the
 * simulate flight can complete INSIDE one poll beat (a sub-150ms
 * flight) — a sampling poll can lose it even while its own settle
 * assert proves the flight happened (KPIs arrived). The page itself
 * becomes the witness: a MutationObserver armed on the button BEFORE
 * the click records the aria-label's "(running)" sighting with zero
 * sampling gap. The record is the DOM's own word. */
const arm = evalJs(`(() => { const b = document.querySelector('button[aria-label^="Run queue simulation"]'); if (!b) return 'no-btn'; window.__t1006flight = null; window.__t1006obs = new MutationObserver(() => { const bb = document.querySelector('button[aria-label^="Run queue simulation"]'); if (!bb) return; const l = bb.getAttribute('aria-label') ?? ''; if (l.includes('(running)') && !window.__t1006flight) window.__t1006flight = { label: l, disabled: bb.disabled, at: Math.round(performance.now()) }; }); window.__t1006obs.observe(b, { attributes: true, attributeFilter: ['aria-label', 'disabled'] }); return 'armed'; })()`);
ok("the page-side witness armed on the Run control", String(arm).includes("armed"), String(arm).slice(0, 40));
const runClick = await realClick(RUN);
ok("the Run control took the real click", String(runClick).startsWith("clicked@"), String(runClick));

/* the tight 150ms poll — the LIVE catch attempt (may lose a fast flight) */
let flight = null;
for (let i = 0; i < 40; i++) {
  const v = evalJson(planeOf(RUN));
  if (v && v.live && (v.label ?? "").includes("(running)")) { flight = v; break; }
  await sleep(150);
}

/* the settle — the plain name returns + the KPI band arrives */
const runSettled = await poll(
  `(() => { const b = document.querySelector('button[aria-label^="Run queue simulation"]'); const kpi = document.querySelector('[aria-label="Simulation KPIs"]'); return JSON.stringify({ label: b ? b.getAttribute('aria-label') : null, disabled: b ? b.disabled : null, kpis: !!kpi && kpi.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.label === "Run queue simulation" && !v.disabled && v.kpis, 30, 500);
ok("the flight RETURNED — the plain name, the control re-enabled, the KPI band arrived (the honest return)", !!runSettled, runSettled ? `kpis=${runSettled.kpis}` : "never settled");

/* the witness read — the observer's record outranks the sampling poll */
const witnessed = evalJson(`(() => { const f = window.__t1006flight; window.__t1006obs?.disconnect(); delete window.__t1006flight; delete window.__t1006obs; return JSON.stringify({ f }); })()`);
ok("THE FLIGHT WITNESSED — the page-side record holds the (running) sighting (no sampling gap)", !!witnessed?.f && witnessed.f.disabled === true, witnessed?.f ? `label="${witnessed.f.label}" disabled=${witnessed.f.disabled} @${witnessed.f.at}ms` : "no record (the observer saw nothing)");
ok("the live catch agrees (or honestly defers to the record)", true, flight ? `poll caught: "${flight.label}"` : "poll lost the fast flight — the record stands");
shot("t1006-queue-sim-settled.png");

/* LEG 7 — the world restored */
console.log("leg 7: the world restored");
await escAll(3);
await sleep(800);
const noDlg = await poll(
  `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().width > 0) }))()`,
  (v) => !v.open, 10, 400);
ok("every layer shut (the ride plane is clear)", !!noDlg && !noDlg.open);
const cardsBack = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('.job-card-title').length }))()`,
  (v) => v.n > 0, 10, 400);
ok("the canvas still stands (the cards are home)", !!cardsBack && cardsBack.n > 0, `cards=${cardsBack?.n}`);
const jobs1 = await readJobs();
fpAfter = fingerprint(jobsArr(jobs1 ?? []));
ok("the world's fingerprint as-found = as-left (zero server writes)", fpBefore === fpAfter, fpBefore === fpAfter ? `${fpAfter.split("|").length} jobs` : "THE WORLD MOVED");

finish({
  legs: {
    copiedPair: { atRest: btnRest?.text ?? null, flipWitnessed: !!caught, reverted: reverted?.text ?? null },
    profilesGates: { add: addFace ?? null, duplicate: dupFace ?? null },
    queueSim: { flightWitnessed: !!(witnessed?.f), liveCatch: !!flight, settled: !!runSettled },
  },
  world: { before: fpBefore, after: fpAfter },
});
