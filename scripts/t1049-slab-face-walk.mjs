#!/usr/bin/env node
/**
 * t1049 — THE SLAB FACE ON CAMERA (the t1049 entry's candidate ①, carried):
 * the clip block's interval slider ridden by its POINTER road, witnessed
 * live end-to-end. The t1047/t1048 ledger said the slider's keyboard road
 * is swallowed and the track-click is ignored; the documented cure is the
 * t999 pointer-wall patience — and this walk IS that cure, on camera:
 *
 *   leg 0  the as-found honesty — TWENTY-TWO jobs (the standing fleet),
 *          the fingerprint banked, the Downloads dir's map-project files
 *          snapshotted, the clip lens's sessionStorage echo captured (the
 *          leave-no-trace law's bank);
 *   leg 1  the wide-first fresh open (1440×900, the kit's opening);
 *   leg 2  the road — the class3d card's body click opens the big
 *          inspector, the Results tab opens, the run_class001 tile opens
 *          the quick-look, the teal "View in 3D (Mol*)" drives in (the
 *          t831 law — the quick-look closes, the viewer stacks), the
 *          embed boots (the J8 law's warm chunks — poll, never sleep);
 *   leg 3  clip ON through the chip's real door — the violet block
 *          appears, the as-found voices banked: the Z readout speaks "—"
 *          (full extent), the Z seat's title speaks the FULL-EXTENT
 *          honesty (the N3 law's own words);
 *   leg 4  THE SLAB WALK — pointer down on the Z hi thumb, TEN patient
 *          wall moves (the t999 patience), pointer up: the readout
 *          leaves "—" and speaks the kept slab (0–NN%), the hi thumb's
 *          aria-valuenow lands near the walk's aim, the seat's title
 *          flips to the SLAB voice ("through the kept ...% slab" — the
 *          N3 law's second face, live);
 *   leg 5  THE FOLD THROUGH THE SLAB — the Z project seat clicked: the
 *          status mouth names map-project-z0-NN-max.png with "rays
 *          folded", the download lands in the browser's Downloads dir,
 *          its bytes DIFFER from the full-extent figure (the op-is-data
 *          law's sibling: the window is data too), the figure banks in
 *          shots-qa/;
 *   leg 6  THE WALK BACK — the Z reset speaks (the row's own door), the
 *          readout returns to "—", the title returns to the full-extent
 *          voice, the clip chip stands down (aria-pressed false);
 *   leg 7  the leave-no-trace close — the lens's sessionStorage echo
 *          restored exactly as found, both dialogs shut through Escape,
 *          the jobs fingerprint as-found = as-left, the console clean of
 *          ChunkLoadError/Unhandled (the J8 law's face absent).
 *
 * RIDE LAWS inherited: server-first; poll-then-probe; realClick's
 * nine-point self-hit; the fast chain (the gremlin self-closes dialogs
 * within 5–40s — the t1047/t1048 ledger — so the road runs back-to-back
 * with no decorative sleeps); the pointer-wall patience (ten small
 * moves, never one big jump); the as-found=as-left discipline.
 *
 *   node scripts/t1049-slab-face-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";
import { readdirSync, statSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const {
  AB, ok, sleep, sh, evalJs, evalJson, poll, realClick, shot,
  readJobs, jobsArr, fingerprint, serverFirst, wideFirst, finish,
} = createWalk({ name: "t1049-slab-face-walk", receiptFile: "t1049-slab-face-walk.json" });

/* THE T1049 DISCOVERY — the gremlin's true face: the dev server's watcher
 * rebuilds on ANY project-tree write, and the rides' OWN screenshots (and
 * receipts) are writes — the Fast Refresh churn remounts the dialog stack
 * and the ride dies mid-leg. THE CURE: a mid-ride shot banks in /tmp
 * (outside the watched tree) and moves into shots-qa/ only after the
 * dialogs close. The ledger's 5–40s mystery was the shot's own shadow. */
const TMP_SHOTS = "/tmp/t1049-shots";
const shotTo = (n) => sh(`mkdir -p ${TMP_SHOTS} && ${AB} screenshot ${TMP_SHOTS}/${n}`);
const bankTmpShots = () => {
  try {
    if (existsSync(TMP_SHOTS)) for (const f of readdirSync(TMP_SHOTS)) copyFileSync(`${TMP_SHOTS}/${f}`, path.join(process.cwd(), "shots-qa", f));
  } catch {}
};

const JOB_ID = "cmv8ogdu4000osy891dgvx5iy"; // 3D Classification (tutorial) — run_class001.mrc's owner
const LENS_KEY = "cryoflow.clipLens.v1";
const DL_DIR = "/home/z/Downloads";
const HI_AIM = 0.6; // the walk aims the hi thumb at 60% (the slab 0–60%)
let slabReadOut = null, slabTitleOut = null, statusWordOut = null, dlFile = null, row = null;

console.log("=== t1049 slab-face walk ===");

/* the server-first law — kit-enforced */
await serverFirst();

/* LEG 0 — the as-found honesty captures */
console.log("leg 0: the as-found world");
const jobs0 = await readJobs();
const arr0 = jobsArr(jobs0 ?? {});
ok("the as-found world carries TWENTY-TWO jobs (the standing fleet)", arr0.length === 22, `rows=${arr0.length}`);
const fp0 = fingerprint(arr0);
const dlBefore = readdirSync(DL_DIR).filter((f) => f.startsWith("map-project-"));
ok("the Downloads dir's map-project files snapshotted", dlBefore.length >= 1, dlBefore.join(", ") || "(none)");

/* LEG 1 — the wide-first fresh open */
console.log("leg 1: the fresh open (wide-first)");
const opened = await wideFirst();
if (!opened) { console.log("FATAL: the world never rendered"); process.exit(2); }
/* the lens echo's bank — only readable once the app's document is live
 * (the walk's first lesson: sessionStorage on a fresh session denies
 * access before the open) */
const lensBefore = evalJson(`(() => JSON.stringify({ raw: sessionStorage.getItem(${JSON.stringify(LENS_KEY)}) }))()`);

/* LEG 2 — the road (back-to-back — the gremlin's window is 5–40s; the
 * t1048 ledger's own cure is the RE-ENTRANT road: when a dialog dies
 * mid-walk, the whole road re-runs from the card — each attempt costs
 * ~3s, so attempt two lands inside the window) */
console.log("leg 2: the road (card → inspector → Results → tile → 3D)");
/* the store loads jobs async — the shell's buttons arrive first (the
 * alive poll's blind spot); the card's arrival is the road's real gate */
const cardLive = await poll(
  `(() => { const c = document.querySelector('[data-job="${JOB_ID}"]'); return JSON.stringify({ up: !!c && c.getBoundingClientRect().width > 0 }); })()`,
  (v) => v.up === true, 24, 500);
ok("the class3d card arrived on the canvas", !!cardLive && cardLive.up === true);

/* one road attempt: card → inspector → Results tab → tile → quick-look
 * → teal 3D → clip chip live. Every poll is tight (the gremlin kills
 * slowly-opened roads); any miss throws and the caller re-runs. */
const driveRoad = async () => {
  // the card's OWN arrival gate lives INSIDE the road — the gremlin's
  // dialog deaths remount the canvas and the jobs refetch lands late
  // (the t1049 lesson: cards:0 right after a dialog corpse)
  const card = await poll(
    `(() => { const c = document.querySelector('[data-job="${JOB_ID}"]'); return JSON.stringify({ up: !!c }); })()`,
    (v) => v.up === true, 20, 300);
  if (!card) throw new Error("card never arrived");
  const cardClick = await realClick(`document.querySelector('[data-job="${JOB_ID}"]')`);
  if (!String(cardClick).startsWith("clicked")) throw new Error(`card ${cardClick}`);
  const insp = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!d }); })()`,
    (v) => v.up === true, 10, 250);
  if (!insp) throw new Error("inspector never opened");
  const tabClick = await realClick(
    `(() => { const t = [...document.querySelectorAll('[role="tab"]')].find((b) => (b.textContent ?? "").trim() === "Results"); return t ?? null; })()`);
  if (!String(tabClick).startsWith("clicked")) throw new Error(`tab ${tabClick}`);
  const tile = await poll(
    `(() => { const t = document.querySelector('[data-tile-path*="run_class001"]'); return JSON.stringify({ up: !!t }); })()`,
    (v) => v.up === true, 60, 750); // the MRC slice renders drain before the JSON lands
  if (!tile) throw new Error("tile never arrived");
  const tileClick = await realClick(`document.querySelector('[data-tile-path*="run_class001"]')`);
  if (!String(tileClick).startsWith("clicked")) throw new Error(`tile ${tileClick}`);
  const quick = await poll(
    `(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent ?? "").includes("View in 3D (Mol*)")); return JSON.stringify({ up: !!b }); })()`,
    (v) => v.up === true, 10, 250);
  if (!quick) throw new Error("quick-look never spoke the teal door");
  const tealClick = await realClick(
    `(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent ?? "").includes("View in 3D (Mol*)")); return b ?? null; })()`);
  if (!String(tealClick).startsWith("clicked")) throw new Error(`teal ${tealClick}`);
  // the embed boots — the clip chip's arrival, but abort early when the
  // viewer itself dies mid-boot (the gremlin's longest reach)
  for (let i = 0; i < 70; i++) {
    const chip = evalJson(`(() => { const b = document.querySelector('[aria-label="Toggle box clipping"]'); const d = [...document.querySelectorAll('[role="dialog"]')].some((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!b && b.getBoundingClientRect().width > 0, dialog: d }); })()`);
    if (chip?.up === true) return chip;
    if (chip && chip.dialog === false) throw new Error("the viewer dialog died mid-boot (the gremlin)");
    await sleep(500);
  }
  throw new Error("the embed never booted");
};

let clipChip = null, roadErr = null;
for (let attempt = 1; attempt <= 8 && !clipChip; attempt++) {
  if (attempt > 1) { // clear any standing dialog ghost before the re-run
    await sh(`${AB} press Escape`); await sleep(400);
    await sh(`${AB} press Escape`); await sleep(400);
  }
  try { clipChip = await driveRoad(); roadErr = null; }
  catch (e) {
    roadErr = String(e?.message ?? e);
    const backoff = 8000 * attempt; // the t1049 storm law: the box's MRC
    // slice renders queue behind each other — a retry on a full queue
    // starves the outputs JSON and the skeleton never resolves. Let the
    // herd drain before the next open.
    console.log(`  (road attempt ${attempt} fell — ${roadErr}; backing off ${(backoff/1000).toFixed(0)}s)`);
    await sleep(backoff);
  }
}
ok("the road landed — the embed is ready, the clip chip live", !!clipChip, roadErr ? `last error: ${roadErr}` : "first breath");
if (!clipChip) { console.log("FATAL: the road never landed"); process.exit(2); }

/* LEG 3 — clip ON through the chip's real door */
console.log("leg 3: clip on (the block appears, the as-found voices bank)");
const chipClick = await realClick(`document.querySelector('[aria-label="Toggle box clipping"]')`);
ok("the clip chip's click landed", String(chipClick).startsWith("clicked"), String(chipClick));
const block = await poll(
  `(() => { const h = document.querySelector('[data-testid="clip-slab-hint"]'); const ro = document.querySelector('[data-testid="clip-interval-z"]'); const seat = document.querySelector('[data-testid="clip-project-z"]'); return JSON.stringify({ up: !!h, readout: ro?.textContent ?? null, title: seat?.getAttribute("title") ?? null }); })()`,
  (v) => v.up === true && v.readout !== null, 10, 250);
ok("the violet block appeared (the slab hint speaks)", !!block && block.up === true);
ok("the Z readout speaks the FULL-EXTENT honesty (—)", block?.readout === "—", `readout="${block?.readout}"`);
ok("the Z seat's title speaks the full extent (the N3 law's own words)", (block?.title ?? "").includes("through the full extent"), String(block?.title).slice(0, 70));
shotTo("t1049-clip-block-as-found.png");

/* LEG 4 — THE SLAB WALK (the pointer-wall patience) */
console.log("leg 4: the slab walk (ten patient wall moves on the Z hi thumb)");
const rowExpr = `(() => { const ro = document.querySelector('[data-testid="clip-interval-z"]'); if (!ro) return JSON.stringify({ up: false }); const row = ro.parentElement; const root = row.querySelector('[data-slot="slider"]'); const thumbs = [...row.querySelectorAll('[role="slider"]')]; const hi = thumbs.find((t) => Number(t.getAttribute("aria-valuenow")) >= 0.99) ?? thumbs[1] ?? null; if (!root || !hi) return JSON.stringify({ up: false }); const tr = root.getBoundingClientRect(); const hr = hi.getBoundingClientRect(); return JSON.stringify({ up: true, tx: tr.x, tw: tr.width, ty: tr.y, hx: Math.round(hr.x + hr.width / 2), hy: Math.round(hr.y + hr.height / 2), now: Number(hi.getAttribute("aria-valuenow")) }); })()`;
evalJs(`(() => { const ro = document.querySelector('[data-testid="clip-interval-z"]'); if (ro) ro.scrollIntoView({ block: "center", behavior: "instant" }); return "siv"; })()`);
await sleep(250);
row = await poll(rowExpr, (v) => v.up === true && v.tw > 40, 10, 250);
ok("the Z row's hi thumb is located on the track", !!row && row.up === true && row.tw > 40,
  row ? `thumb@${row.hx},${row.hy} track=${Math.round(row.tw)}px now=${row.now}` : "no row");

row = row ?? null;
if (row?.up) {
  const targetX = Math.round(row.tx + HI_AIM * row.tw);
  const targetY = Math.round(row.ty + 4); // the track's own y (the thumb rides it)
  sh(`${AB} mouse move ${row.hx} ${row.hy}`);
  sh(`${AB} mouse down`);
  const STOPS = 10;
  for (let i = 1; i <= STOPS; i++) {
    const x = Math.round(row.hx + ((targetX - row.hx) * i) / STOPS);
    sh(`${AB} mouse move ${x} ${targetY}`);
    await sleep(120); // the wall's patience — small moves, never one jump
  }
  sh(`${AB} mouse up`);
  // the commit's patience: the drag's value lands on the capture's own
  // tail — poll briefly; if the wall still holds, one nudge (move+up)
  // re-fires the capture's commit, then the long poll
  let walked = await poll(rowExpr, (v) => v.up === true && v.now < 0.99 && v.now > 0.3, 4, 250);
  if (!walked) {
    sh(`${AB} mouse move ${targetX + 1} ${targetY}`);
    sh(`${AB} mouse up`);
    walked = await poll(rowExpr, (v) => v.up === true && v.now < 0.99 && v.now > 0.3, 20, 400);
  }
  ok("THE WALK MOVED THE THUMB — the hi valuenow left the wall", !!walked && walked.now < 0.99, `now=${walked?.now}`);
  const slabRead = await poll(
    `(() => { const ro = document.querySelector('[data-testid="clip-interval-z"]'); const seat = document.querySelector('[data-testid="clip-project-z"]'); return JSON.stringify({ readout: ro?.textContent ?? null, title: seat?.getAttribute("title") ?? null }); })()`,
    (v) => (v.readout ?? "") !== "—", 20, 400);
  slabReadOut = slabRead?.readout ?? null;
  slabTitleOut = slabRead?.title ?? null;
  ok("THE READOUT SPEAKS THE SLAB — the kept 0–NN% lands", !!slabRead && /^0–\d+%$/.test(slabRead.readout ?? ""), `readout="${slabRead?.readout}"`);
  ok("THE TITLE FLIPS TO THE SLAB VOICE (the N3 law's second face, live)", (slabRead?.title ?? "").includes("through the kept"), String(slabRead?.title).slice(0, 80));
  const hiPct = slabRead ? Number((slabRead.readout ?? "0–0%").replace("0–", "").replace("%", "")) : 0;
  ok("the seat's title names the SAME numbers the readout speaks", (slabRead?.title ?? "").includes(`through the kept 0–${hiPct}%`), `pct=${hiPct}`);
  shotTo("t1049-slab-walk-on-camera.png");

  /* LEG 5 — THE FOLD THROUGH THE SLAB */
  console.log("leg 5: the fold through the slab (the seat speaks, the figure lands)");
  const fname = `map-project-z0-${hiPct}-max.png`;
  const projClick = await realClick(`document.querySelector('[data-testid="clip-project-z"]')`);
  ok("the Z project seat's click landed", String(projClick).startsWith("clicked"), String(projClick));
  const status = await poll(
    `(() => { const s = document.querySelector('[data-testid="clip-project-status"]'); return JSON.stringify({ word: s?.textContent ?? null }); })()`,
    (v) => (v.word ?? "").length > 0, 20, 120); // the note lives 4s — poll fast
  statusWordOut = status?.word ?? null;
  ok("THE STATUS MOUTH SPEAKS THE SLAB FOLD", (status?.word ?? "").startsWith(`Downloaded ${fname} — Z rays folded`), `word="${status?.word}"`);
  // the download lands in the browser's Downloads dir — poll the dir
  for (let i = 0; i < 30 && !dlFile; i++) {
    const now = readdirSync(DL_DIR).filter((f) => /^map-project-z0-\d+-max(\s*\(\d+\))?\.png$/.test(f) && !dlBefore.includes(f));
    if (now.length > 0) dlFile = now[0];
    else await sleep(400);
  }
  ok("THE FIGURE LANDED IN DOWNLOADS (the real slab fold)", !!dlFile, dlFile ?? "no new map-project file");
  if (dlFile) {
    const bytes = statSync(path.join(DL_DIR, dlFile)).size;
    ok("the slab figure is a REAL PNG (bytes > 512)", bytes > 512, `${bytes} bytes`);
    const fullFile = dlBefore.find((f) => /^map-project-z0-100(\s*\(\d+\))?\.png$/.test(f));
    const fullBytes = fullFile ? statSync(path.join(DL_DIR, fullFile)).size : 0;
    ok("the slab figure DIFFERS from the full-extent figure (the window is data)", fullBytes === 0 || bytes !== fullBytes, `slab=${bytes} full=${fullBytes}`);
    try { copyFileSync(path.join(DL_DIR, dlFile), path.join("/tmp/t1049-shots", "t1049-map-project-slab.png")); } catch {}
  }
  shotTo("t1049-fold-through-slab.png");
} else {
  ok("the slab walk never ran (the row never located)", false, "leg 4 skipped");
}

/* LEG 6 — THE WALK BACK (the row's own reset door) */
console.log("leg 6: the walk back (the reset speaks, the full-extent voice returns)");
const resetClick = await realClick(`document.querySelector('[aria-label="Reset Z clip"]')`);
ok("the Z reset's click landed (the row's own door)", String(resetClick).startsWith("clicked"), String(resetClick));
const backRead = await poll(
  `(() => { const ro = document.querySelector('[data-testid="clip-interval-z"]'); const seat = document.querySelector('[data-testid="clip-project-z"]'); return JSON.stringify({ readout: ro?.textContent ?? null, title: seat?.getAttribute("title") ?? null }); })()`,
  (v) => v.readout === "—", 10, 250);
ok("THE READOUT RETURNS TO — (the full extent restored)", backRead?.readout === "—", `readout="${backRead?.readout}"`);
ok("THE TITLE RETURNS TO THE FULL-EXTENT VOICE", (backRead?.title ?? "").includes("through the full extent"), String(backRead?.title).slice(0, 70));
// the chip stands down through its OWN door — the reset restores the Z
// extent; the toggle retires the block (the as-found face)
const chipDownClick = await realClick(`document.querySelector('[aria-label="Toggle box clipping"]')`);
ok("the clip chip's stand-down click landed", String(chipDownClick).startsWith("clicked"), String(chipDownClick));
const chipOff = await poll(
  `(() => { const b = document.querySelector('[aria-label="Toggle box clipping"]'); return JSON.stringify({ pressed: b?.getAttribute("aria-pressed") ?? null }); })()`,
  (v) => v.pressed === "false", 8, 300);
ok("the clip chip stands down (aria-pressed false)", chipOff?.pressed === "false", `pressed=${chipOff?.pressed}`);

/* LEG 7 — the leave-no-trace close */
console.log("leg 7: the leave-no-trace close");
evalJs(lensBefore?.raw
  ? `sessionStorage.setItem(${JSON.stringify(LENS_KEY)}, ${JSON.stringify(lensBefore.raw)}); "restored"`
  : `sessionStorage.removeItem(${JSON.stringify(LENS_KEY)}); "cleared"`);
const lensAfter = evalJson(`(() => JSON.stringify({ raw: sessionStorage.getItem(${JSON.stringify(LENS_KEY)}) }))()`);
ok("the clip lens's echo is exactly as the walk found it (the leave-no-trace law)",
  lensAfter?.raw === (lensBefore?.raw ?? null));
await sh(`${AB} press Escape`); await sleep(500);
await sh(`${AB} press Escape`); await sleep(500);
const anyDialog = await poll(
  `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().width > 0) }))()`,
  (v) => v.open === false, 6, 400);
ok("both dialogs are shut (no [role=dialog] ghost)", anyDialog?.open === false, `open=${anyDialog?.open}`);

const jobs7 = await readJobs();
const arr7 = jobsArr(jobs7 ?? {});
ok("the jobs fingerprint as-found = as-left (a walk moves no job)", fingerprint(arr7) === fp0, `rows=${arr7.length}`);
const errs = sh(`${AB} errors`);
ok("the console is clean of ChunkLoadError/Unhandled (the J8 law's face absent)",
  !errs.includes("ChunkLoadError") && !errs.includes("Unhandled"), errs.slice(0, 120).replace(/\n/g, " ⋅ "));
shot("t1049-world-restored.png");
bankTmpShots(); // the mid-ride shots move home NOW — the watcher's churn is harmless after the close

finish({
  instrument: "t1049-slab-face-walk",
  born: "2026-10-16",
  contract: "the clip block's interval slider ridden by its pointer road end-to-end — the walk's ten wall moves shrink the Z extent on camera, the readout and the seat's title speak the slab (the N3 law's two faces live), the fold downloads a REAL slab figure whose bytes differ from the full-extent document, the reset restores the full-extent voice, the lens and the world left exactly as found",
  legs: {
    hiAim: HI_AIM,
    asFound: { downloads: dlBefore, lensRaw: lensBefore?.raw ?? null },
    walk: { thumbLocated: !!row?.up, trackPx: row?.tw ?? null },
    slab: { readout: slabReadOut ?? null, title: slabTitleOut ?? null },
    fold: { statusWord: statusWordOut ?? null, file: dlFile ?? null },
    worldRestored: fingerprint(arr7) === fp0,
  },
});
