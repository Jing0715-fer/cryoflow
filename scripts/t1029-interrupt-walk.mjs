#!/usr/bin/env node
/**
 * t1029-interrupt-walk — the interrupt face's walk leg (the t1025 handoff's
 * lead candidate, carried across the rollback): the vanish ladder's UI face
 * filmed through the REAL dialog.
 *
 * The vanish ladder has TWO doors; this walk films the STALE door:
 *   - the stale door (this walk): a running DB row with NO engine record,
 *     older than the 120 s boot-race window → the jobs-GET reconcile sweep
 *     convicts it "stale running state (no engine record) — re-run". That
 *     state is exactly what a crash mid-spawn leaves behind; the walk LAYS
 *     it by prisma gesture (inline-pinned DATABASE_URL — the t1078 poison
 *     lesson; the PATCH door takes only status:"idle", so the product has
 *     no door for this state by design — the gesture is named in the lay's
 *     own output), WITNESSES the convict through the product's own GET
 *     door, WALKS the failed face in the REAL inspector (the card click,
 *     the badge, the words verbatim, the action row), and SWEEPS the twin
 *     through the product DELETE door.
 *   - the interrupted door (a live run whose pid dies — the full restart
 *     dance, the checkpoint/resume contract's face) stays a separate walk:
 *     this box is chronically thin, and the t1023/t1024 films' storm law
 *     says the restart dance gets its own window, not a tail-slot gamble.
 *
 * The world gate: 17 rows during the walk (16 steady + the twin), 16
 * as-left. The 16 standing rows' fingerprint (id:status:name) must be
 * as-found = as-left — the arc's only victim is the arc's own twin.
 *
 * Usage: node scripts/t1029-interrupt-walk.mjs lay|ride|sweep
 */
import { writeFileSync, readFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { createWalk } from "./walk-kit.mjs";

const PHASE = process.argv[2] ?? "ride";
const ROOT = process.cwd();
const TWIN_NAME = "Import Interrupt Walk Leg";
const STALE_WORDS = "stale running state (no engine record) — re-run";
const SEAT = path.join(ROOT, "shots-qa/.t1029-interrupt-seat.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- the prisma gesture (self-pinned — the t894/t1078 law: the
 * session's exported DATABASE_URL beats --env-file AND beats the .env
 * file; only an explicit datasource override truly pins the world) ---------- */
const PINNED_URL = "file:/home/z/my-project/db/cryoflow.db";
async function prismaPatchTwin(twinId) {
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient({ datasources: { db: { url: PINNED_URL } } });
  const startedAt = new Date(Date.now() - 3 * 60 * 1000); // older than the 120 s race window
  const row = await p.job.update({
    where: { id: twinId },
    data: { status: "running", startedAt, progress: 40, result: null },
  });
  await p.$disconnect();
  return row;
}

/* ---------- the world gates ---------- */
async function worldGate(expect, label) {
  const res = await fetch("http://localhost:3000/api/jobs", {
    headers: { Origin: "http://localhost:3000" },
  });
  const text = await res.text();
  if (res.status !== 200) {
    console.error(`FATAL: world gate ${label} — GET /api/jobs ${res.status}`);
    process.exit(2);
  }
  let jobs = JSON.parse(text);
  if (!Array.isArray(jobs)) jobs = jobs.jobs ?? [];
  if (jobs.length !== expect) {
    console.error(`FATAL: world gate ${label} — jobs ${jobs.length} (want ${expect} — the t1078 steady census; the arc's victims are the arc's own twins)`);
    process.exit(1);
  }
  return jobs;
}

/* ==================== LAY ==================== */
if (PHASE === "lay") {
  let world = await worldGate(16, "lay");
  // the idempotency guard (the t978 mint's own law): a previous lay's twin
  // (minted, then the gesture failed) must not stack — sweep it first.
  const stale = world.find((j) => j.name === TWIN_NAME);
  if (stale) {
    console.log(`lay guard: a stale twin stands (${stale.id}, ${stale.status}) — sweeping before the re-lay`);
    await fetch(`http://localhost:3000/api/jobs/${stale.id}`, {
      method: "DELETE",
      headers: { Origin: "http://localhost:3000" },
    });
    await sleep(1200);
    world = await worldGate(16, "lay-post-guard");
  }
  const template = world.find((j) => j.name === "Import Movies 1");
  if (!template) { console.error("FATAL: the template (Import Movies 1) not found"); process.exit(1); }
  const res = await fetch("http://localhost:3000/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({
      type: "import", name: TWIN_NAME, workspaceId: template.workspaceId,
      x: 1080, y: 160, params: { ...(template.params ?? {}), micrographsPath: "" },
    }),
  });
  const mint = await res.json().catch(() => null);
  const twin = mint?.job ?? null;
  if (!twin) {
    console.error(`FATAL: the twin mint failed — status=${res.status}`);
    process.exit(1);
  }
  const patched = await prismaPatchTwin(twin.id);
  console.log(`twin minted: ${twin.id} ("${TWIN_NAME}")`);
  console.log(`the gesture named: PATCH door takes only status:"idle" — the running/startedAt/progress state laid by inline-pinned prisma (status=${patched.status}, startedAt=${patched.startedAt?.toISOString?.() ?? patched.startedAt}, progress=${patched.progress}) — the state a crash mid-spawn leaves; the PRODUCT door that convicts it is the walk's witness`);
  mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
  writeFileSync(SEAT, JSON.stringify({ twinId: twin.id, twinName: TWIN_NAME, projectId: template.projectId, laidAt: new Date().toISOString() }, null, 2));
  console.log("seat noted — the ride may open the page");
  process.exit(0);
}

/* ==================== SWEEP ==================== */
if (PHASE === "sweep") {
  const seat = JSON.parse(readFileSync(SEAT, "utf8"));
  const del = await fetch(`http://localhost:3000/api/jobs/${seat.twinId}`, {
    method: "DELETE",
    headers: { Origin: "http://localhost:3000" },
  });
  if (del.status !== 200 && del.status !== 404) {
    console.error(`FATAL: the twin's delete refused (${del.status})`);
    process.exit(1);
  }
  await sleep(1200);
  const world = await worldGate(16, "sweep");
  const dbBytes = statSync(path.join(ROOT, "db/cryoflow.db")).size;
  console.log(`twin swept (${del.status}); world as-left 16 ✓; DB ${dbBytes}`);
  process.exit(0);
}

/* ==================== RIDE ==================== */
const seat = JSON.parse(readFileSync(SEAT, "utf8"));
const w = createWalk({ name: "t1029-interrupt-walk", receiptFile: "t1029-interrupt-walk.json" });
const { ok, sleep: zzz, sh, evalJson, pollTraced, realClick, escAll, shot, api, readJobs, jobsArr, fingerprint, wideFirst, finish } = w;
void ok;

const AB = "agent-browser";
await wideFirst();
const asFound = jobsArr(await readJobs());
const fp0 = fingerprint(asFound, TWIN_NAME);
console.log(`as-found: ${asFound.length} rows (twin included) — the 16 standing pinned`);

/* W1 — the convict through the product's own door: the first jobs GET
 * after the 120 s window carries the reconcile sweep's verdict. (A plain
 * fetch loop — the kit's pollTraced speaks eval-strings, not promises.) */
let convict = null;
for (let i = 0; i < 12 && !convict; i++) {
  if (i > 0) await zzz(1000);
  try {
    // the kit's api() returns the raw STRING (readJobs JSON.parses it itself)
    const arr = jobsArr(JSON.parse(api("GET", "/api/jobs")));
    convict = arr.find((j) => j.id === seat.twinId) ?? null;
  } catch { /* the warmup */ }
}
w.ok("W1 the reconcile sweep convicts the stale row through the product's GET door", !!convict && convict.status === "failed", convict ? JSON.stringify({ status: convict.status, result: (convict.result ?? "").slice(0, 80) }) : "never convicted");
w.ok("W1b the verdict's words verbatim", convict?.result === STALE_WORDS, JSON.stringify(convict?.result ?? ""));

/* W3 — the REAL click opens the failed inspector (the t924 law: the card
 * click's dispatch is status-dependent — failed → THIS failed face).
 * THE t994 GRAMMAR: the canvas is transform-positioned and the card may
 * sit off-screen — the find bar's match button CENTERS the job first (the
 * honest user flow), then the bar goes home, then the card is clicked. */
const findAndCenter = async (needle) => {
  const box = `[aria-label="Find jobs by name, type, or key:value parameter query"]`;
  const alreadyOpen = evalJson(`(() => { const b = document.querySelector('${box}'); return JSON.stringify({ open: !!b && b.getBoundingClientRect().width > 0 }); })()`);
  if (!(alreadyOpen && alreadyOpen.open)) {
    const btn = await realClick(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Find jobs on canvas') ?? null`);
    if (!String(btn).startsWith("clicked@")) return "NO-FIND-BAR";
    await zzz(700);
  }
  sh(`${AB} fill '${box}' '${needle}'`);
  await zzz(900);
  const matchBtn = evalJson(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\d+ match(es)?$/.test((x.textContent || '').trim()) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (!matchBtn || !matchBtn.x) return "NO-MATCH";
  sh(`${AB} mouse move ${matchBtn.x} ${matchBtn.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await zzz(900);
  await realClick(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Find jobs on canvas') ?? null`);
  await zzz(500);
  return `centered:${needle}`;
};
const centered = await findAndCenter(TWIN_NAME);
console.log(`  find-bar: ${centered}`);
const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${TWIN_NAME}'))?.querySelector('[role="button"][tabindex]')`);
const opened = await pollTraced(
  `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${TWIN_NAME}')); return JSON.stringify({ open: !!d }); })()`,
  (v) => v.open === true, 8, 600, "W3",
);
w.ok("W3 the inspector opens on the twin through the real card click", String(clicked).startsWith("clicked@") && opened?.open === true, `click=${clicked}, find=${centered}`);

/* W2 — the canvas face (read AFTER the centering — the canvas renders
 * what the view shows; the as-found transform may sit the card out of
 * the DOM's rendered set until the find bar centers it) */
const cardRead = evalJson(`(() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${TWIN_NAME}')); if (!c) return JSON.stringify({ err: "no-card" }); const b = c.querySelector('[role="button"][tabindex]'); return JSON.stringify({ label: (b?.getAttribute('aria-label') || '').slice(0, 120) }); })()`);
w.ok("W2 the twin's card carries the failed aria face", !!cardRead?.label && /failed/i.test(cardRead.label), JSON.stringify(cardRead ?? {}));

/* W4 — the face's words on camera: the OVERVIEW panel first (the Log tab
 * is the smart default and the failed summary block lives on the other
 * panel — the inactive panels unmount, the t994 law) */
const clickTab = async (name, label, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('${label}')) ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    await zzz(800);
  }
  return "NEVER-CLICKED";
};
const tabClicked = await clickTab(TWIN_NAME, "Overview", 3);
console.log(`  overview tab: ${tabClicked}`);
/* the t994 red-10 grammar: a jobs refetch can flicker the dialog and a
 * remount RESETS the tab latch to the smart default (Log) — each round
 * re-clicks Overview when the latch fell back, then polls the text */
let face = null;
for (let round = 0; round < 4 && !(face && face.hasStaleWords); round++) {
  await clickTab(TWIN_NAME, "Overview", 2);
  face = await pollTraced(
    `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${TWIN_NAME}')); if (!d) return JSON.stringify({ err: "no-dialog" }); const txt = (d.textContent || ''); const btn = (label) => [...d.querySelectorAll('button')].some(b => (b.textContent || '').trim() === label); return JSON.stringify({ hasStaleWords: txt.includes('stale running state (no engine record)'), hasJobFailed: txt.includes('Job failed'), hasResetEdit: btn('Reset & edit'), hasRerunVerb: btn('Re-run') }); })()`,
    (v) => v && !v.err && v.hasStaleWords, 5, 600, `W4r${round}`,
  ) ?? null;
  if (!face || face.err) face = { hasStaleWords: false, hasJobFailed: false, hasResetEdit: false, hasRerunVerb: false };
}
w.ok("W4a the stale verdict's words rendered in the REAL dialog (Overview panel, the flicker-safe rounds)", !!face?.hasStaleWords && !!face?.hasJobFailed, JSON.stringify(face ?? {}));
w.ok("W4b the failed action row speaks (the REAL buttons: Reset & edit / Re-run — the t924/t1020 status-dependent law)", !!face?.hasResetEdit && !!face?.hasRerunVerb, JSON.stringify(face ?? {}));
/* the face's own words, on the record (the diagnosis seat for any RED) */
const dialogText = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${TWIN_NAME}')); return JSON.stringify({ text: (d?.textContent || '').replace(/\\s+/g, ' ').slice(0, 600) }); })()`);
console.log(`  dialog text: ${JSON.stringify(dialogText?.text ?? "")}`);

/* W5 — the film */
shot("t1029-interrupt-face.png");
console.log("  film: shots-qa/t1029-interrupt-face.png");

/* W6 — the standing world unregressed (as-found = as-left) */
await escAll();
await zzz(600);
const asLeft = jobsArr(await readJobs());
const fp1 = fingerprint(asLeft, TWIN_NAME);
w.ok("W6 the 16 standing rows' fingerprint as-found = as-left (the arc's only victim is the twin)", fp0 === fp1, fp0 === fp1 ? "identical" : `DIVERGED\n${fp0}\n${fp1}`);

await finish();
process.exit(w.fail === 0 ? 0 : 1);
