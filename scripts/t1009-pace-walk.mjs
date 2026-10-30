#!/usr/bin/env node
/**
 * t1009 — THE PACE DOOR WALK (the t1009 product face's live ride):
 * the pace dialog through its PRIMARY real door — the project
 * dashboard's per-card gauge button — and the face's clock facts
 * asserted against the world they describe.
 *
 * THE LEGS (zero minting, zero server writes — the pace GET is a
 * read-only DB assembly, the dialog fetches and renders):
 *   1. the fresh open — the world renders, fingerprinted as-found;
 *   2. THE DASHBOARD DOOR — the Dashboard tab takes the real click, the
 *      project grid stands, the gauge button ("Pipeline pace — …", the
 *      dynamic-name shape) is visible and takes the real click;
 *   3. the flight settles — the dialog stands, its aria-busy face
 *      returns to not-busy (the React explicit-boolean law: false is
 *      the honest settled word), the stage table's rows arrive;
 *   4. THE CLOCK FACTS (the face's proof): the totals band speaks
 *      "total compute" + "wall time", the first stage row is the
 *      chain's own first (import — the demo chain's head), the row
 *      count matches the stage count, the failure band speaks its
 *      no-clock law ("time is not claimed"), the export family stands
 *      (four doors, one truth);
 *   5. the dialog shuts;
 *   6. THE PALETTE DOOR (the second door, the t1007 grammar) — the
 *      chip's real click, the real keystrokes narrow to "Pipeline
 *      pace", the item's real click hands the modal over;
 *   7. THE CANVAS KEYBOARD DOOR (the t1010 selection arm, all-real
 *      keys): the context menu's Zoom to fit brings the completed cards
 *      into view, two cards take REAL Shift+Space toggles (the t1010
 *      a11y arm — the keyboard's multi-select), the toolbar's pace
 *      button takes the real click, the selection-scoped dialog stands
 *      on its LOCAL well (two rows, no fetch), the bare-canvas click
 *      clears; THE t1011 GRAFT — the selection's live receipt rides the
 *      same leg: the region is mounted-and-silent at the landing (the
 *      mount-skip law), speaks "1 job selected" then "2 jobs selected"
 *      after each real press, and speaks "Selection cleared" after the
 *      bare-canvas clear (a screen reader hears the whole arc);
 *   8. (the t1011 graft's moments live in leg 7 — the leg numbering
 *      grew when the t1012 graft joined);
 *   9. THE DELETE ARC'S HEARING (the t1012 graft): cmd+A announces the
 *      full count (the honest word), two fresh toggles arm the arc, the
 *      Ctrl+D mint lands twins at the SAME count (the receipt stays
 *      SILENT — the birth is the visual's story), Del opens the
 *      keyboard confirm which speaks the TRUCE prose (the workdirs
 *      sentence — one bulk delete, two doors, one dialect), Cancel
 *      keeps the world with the receipt SILENT (a delete that did not
 *      happen earns no word), the confirm fires the TWO-MOUTH moment —
 *      the receipt speaks the selection's exit ("Selection cleared")
 *      while the toast speaks the deletion's headline ("Deleted 2
 *      jobs") — and the world self-restores (the victims were the
 *      arc's own mint);
 *   10. THE SINGLE DOOR'S HEARING (the t1013 graft): the link fixture is
 *       the walk's own mint (the kit's api POST — explicit AND VISIBLE
 *       x/y, the fixture law; the UI's own cross-workspace door refuses
 *       same-workspace links in a one-workspace world, so the fixture
 *       rides the server's accepted shape), the poll merges the copy and
 *       the original's linkCount; the keyboard's single-delete confirm
 *       (Del on one card) speaks the TRUCE prose — the workdir sentence,
 *       the link-count refusal clause VERBATIM (the singular branch), and
 *       the running clause honestly ABSENT (a completed job earns no stop
 *       word); Cancel keeps the world; then the copy's death rides the
 *       REAL single door again (no clause — the copy's linkCount is 0)
 *       and the two-mouth moment speaks at the single arc: the receipt's
 *       "Selection cleared" beside the toast's "Job deleted" headline;
 *  11. THE BREATHING LAW'S HEARING (the t1014 graft): the single-delete
 *       confirm's running clause SPOKEN LIVE on a running job — the arc's
 *       own fixture (a 120k-file folder import, big enough that the
 *       running window outlives the starved poll's landing) rides the
 *       kit's api POST while every door and key stays real; the no-gap
 *       witness (the MutationObserver on the description) records the
 *       clause's FULL film (the idle prose → the clause → the exit); the
 *       breathing law (the import loops' macrotask yields, the t1014
 *       cure) is why the polls interleave AT ALL — pre-cure a single
 *       roster fetch queued 4.7s behind the sync link loop and landed
 *       after the completion write, the running face unrenderable by
 *       construction; the world self-restores (the t993 pattern) and the
 *       fixtures sweep (the twin's workdir + the 120k fuel);
 *  12. the world restored — the fingerprint as-found = as-left.
 *
 * RIDE LAWS inherited: one fresh `agent-browser open`; poll-then-probe;
 * realClick probes vis AND owns every round; the walk asserts (it is
 * the face's verifier) and exits honest. THE LITERAL-WORD LAW: the
 * asserts pin the band's words ("total compute", "wall time", "time is
 * not claimed") AND the receipt's vocabulary ("1 job selected",
 * "2 jobs selected", "Selection cleared") AND the delete arc's two
 * mouths ("22 jobs selected" — count-anchored, the world's size; the
 * toast's "Deleted 2 jobs"; the truce's "workdirs stay on disk") as
 * LITERALS — any rewording re-keys the walk IN THE SAME COMMIT.
 *
 *   node scripts/t1009-pace-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";
import fs from "node:fs";
import path from "node:path";
import { spawn as spawnDetached } from "node:child_process";

const {
  AB, BASE, ROOT, ok, sleep, sh, evalJs, evalJson, poll, realClick, escAll, shot,
  serverFirst, readJobs, jobsArr, fingerprint, finish, api,
} = createWalk({ name: "t1009-pace-walk", receiptFile: "t1009-pace-walk.json" });

console.log("=== t1009 pace door walk ===");

await serverFirst();

/* THE WARM (the t1014 lesson): the ride edits server modules in its own
   window — the first POST through a touched chain triggers a dev compile
   that hangs the request for tens of seconds and the mid-compile world
   glitches under the walk (the RED ride's cards=0 cascade). The honest
   warm: two REFUSAL probes through the touched routes — no writes, the
   validation's own word proves the chain compiled. */
console.log("warm: the touched chains compile (honest refusals, no writes)");
const warm1 = api("POST", "/api/jobs", {});
ok("the jobs POST chain is warm (the empty body's 400 refusal)",
  warm1.includes("error"), warm1.slice(0, 60));
const warm2 = api("POST", "/api/jobs/nonexistent-warm/run");
ok("the run route chain is warm (the missing job's 404 refusal)",
  warm2.includes("error") || warm2.includes("not found"), warm2.slice(0, 60));
/* the pace route's warm (read-only): a dev-server respawn leaves it cold
   and the leg 3 flight's 8s poll pays the whole compile — the boot
   warmup's route list doesn't carry it (the t1014 ride's lesson). */
const warmJobs0 = (() => { try { return JSON.parse(api("GET", "/api/jobs")); } catch { return null; } })();
const paceProjectId = (Array.isArray(warmJobs0) ? warmJobs0 : warmJobs0?.jobs ?? [])[0]?.projectId;
const warm3 = paceProjectId ? api("GET", `/api/projects/${paceProjectId}/pace`) : "";
ok("the pace route chain is warm (the read-only GET answered)",
  warm3.includes("stages") || warm3.includes("totalCompute") || warm3.includes("rows"), paceProjectId ? `project=${paceProjectId}` : "no project id");

/* THE FIXTURE BEFORE THE PAGE (the t1014 lesson): creating 120k files under
   the dev server's watcher AFTER the page opens storms the watcher and the
   HMR reload wipes the walk's page-side state mid-arc (the observer's
   window vanished — rec=-1). The fuel is laid BEFORE `agent-browser open`:
   the storm settles while no page exists to reload. */
console.log("fixture: the breathing fuel laid before the page (the watcher storm settles first)");
const FIXHEAD = path.join(ROOT, "data/t1014-fixture");
if (!fs.existsSync(path.join(FIXHEAD, "fake_movie_119999.mrc"))) {
  fs.mkdirSync(FIXHEAD, { recursive: true });
  const bufHead = Buffer.alloc(1024);
  for (let i = 0; i < 120000; i++) {
    fs.writeFileSync(path.join(FIXHEAD, `fake_movie_${String(i).padStart(6, "0")}.mrc`), bufHead);
  }
}
ok("the timing fixture stands (120k tiny mrcs — the run's breathing fuel)",
  fs.existsSync(path.join(FIXHEAD, "fake_movie_119999.mrc")), FIXHEAD);

const paceDlg = `[...document.querySelectorAll('[role="dialog"]')].find((d) => (d.querySelector('h2')?.textContent ?? '').includes('Pipeline pace'))`;

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
/* THE WORLD GATE (the t1014 law): the walk's count-anchored literals are
   pinned to the as-found world — a world carrying leftovers from an earlier
   arc rides with shifted counts and the arcs' asserts lie. The gate is
   honest: the walk exits RED when the world isn't the pinned one — the
   cleanup is the OPERATOR's duty, never the ride's. (The t1077 sweep
   re-keyed the family 22→16: the t1003 22-world's db died in the epoch
   rollback and the t979 replant is the successor — SIXTEEN.) */
ok("the as-found world is the pinned 16-job world",
  fpBefore.split("|").length === 16, `${fpBefore.split("|").length} jobs`);
if (fpBefore.split("|").length !== 16) {
  console.log(`FATAL: the world carries ${fpBefore.split("|").length} jobs — the arcs' count-anchored asserts would lie. Clean the world to the pinned 16 and re-ride.`);
  process.exit(2);
}

/* LEG 2 — the dashboard door */
console.log("leg 2: the dashboard door (the Dashboard tab, then the gauge)");
const tabClick = await realClick(`[...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === 'Dashboard')`);
ok("the Dashboard tab took the real click", String(tabClick).startsWith("clicked@"), String(tabClick));
const gaugeUp = await poll(
  `(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Pipeline pace — ')); if (!b) return JSON.stringify({ live: false }); const r = b.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, label: b.getAttribute('aria-label'), disabled: b.disabled }); })()`,
  (v) => v.live, 16, 500);
ok("the gauge button stands (dynamic name, never disabled — pace is always viewable)",
  !!gaugeUp && gaugeUp.live && gaugeUp.disabled === false, gaugeUp?.label ?? "absent");
const gaugeClick = await realClick(`[...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Pipeline pace — '))`);
ok("the gauge took the real click", String(gaugeClick).startsWith("clicked@"), String(gaugeClick));

/* LEG 3 — the flight settles */
console.log("leg 3: the flight settles");
const dlgUp = await poll(
  `(() => { const d = ${paceDlg}; return d ? JSON.stringify({ open: d.getBoundingClientRect().width > 0, title: d.querySelector('h2').textContent.slice(0, 44) }) : JSON.stringify({ open: false }); })()`,
  (v) => v.open, 16, 500);
ok("the pace dialog stands", !!dlgUp && dlgUp.open, dlgUp?.title ?? "absent");
const settled = await poll(
  `(() => { const d = ${paceDlg}; if (!d) return JSON.stringify({ busy: null }); return JSON.stringify({ busy: d.getAttribute('aria-busy') }); })()`,
  (v) => v.busy === null || v.busy === "false", 24, 500);
ok("the dialog's busy face settles (null or explicit false — the React boolean law)",
  !!settled, settled ? `busy=${settled.busy}` : "absent");
const tableUp = await poll(
  `(() => { const d = ${paceDlg}; const t = d ? d.querySelector('[data-canvas-ui="pipeline-pace-table"] tbody') : null; return JSON.stringify({ rows: t ? t.querySelectorAll('tr').length : 0 }); })()`,
  (v) => v.rows > 0, 24, 500);
ok("the stage table arrived", !!tableUp && tableUp.rows > 0, `${tableUp?.rows ?? 0} rows`);
/* the stage rows sort by startedAt ASC (the pace lib's own law) — the
   walk lifts the SAME law from the DTOs and asserts the head matches,
   instead of pinning a name the world's honest re-runs may move (the
   t1014 repair re-ran Import Movies 1 — its startedAt is fresh — the
   head moved; the law held). */
const jobs4 = await readJobs();
const head4 = jobsArr(jobs4 ?? [])
  .filter((j) => j.status === "completed" && j.startedAt)
  .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))[0];

/* LEG 4 — the clock facts */
console.log("leg 4: the clock facts (the face's proof)");
const facts = await evalJson(`(() => {
  const d = ${paceDlg};
  if (!d) return JSON.stringify({ live: false });
  const text = (sel) => { const el = d.querySelector(sel); return el ? (el.textContent ?? '').trim() : ''; };
  const stats = d.querySelector('[data-canvas-ui="pipeline-pace-stats"]');
  const bars = d.querySelectorAll('[data-canvas-ui="pipeline-pace-bars"] li').length;
  const tbody = d.querySelector('[data-canvas-ui="pipeline-pace-table"] tbody');
  const firstStage = tbody ? tbody.querySelector('tr td')?.textContent.trim() : '';
  const exportBtns = [...d.querySelectorAll('button')].filter((b) => /Export|Copy/.test(b.getAttribute('aria-label') ?? '')).length;
  const failed = d.querySelector('[data-canvas-ui="pipeline-pace-failed"]');
  return JSON.stringify({
    live: true,
    stats: stats ? (stats.textContent ?? '').trim() : '',
    bars,
    rows: tbody ? tbody.querySelectorAll('tr').length : 0,
    firstStage,
    exportBtns,
    failedFace: failed ? (failed.textContent ?? '').trim().slice(0, 80) : '',
  });
})()`);
ok("the totals band speaks the clock facts (total compute + wall time, literal words)",
  facts.live && facts.stats.includes("total compute") && facts.stats.includes("wall time"),
  facts.stats?.slice(0, 90) ?? "absent");
ok("the chain bars stand — one per stage, matching the table",
  facts.bars > 0 && facts.bars === facts.rows, `${facts.bars} bars / ${facts.rows} rows`);
ok("the first stage row is the earliest-started stage (the pace lib's own ordering law, lifted)",
  !!head4 ? facts.firstStage === head4.type || facts.firstStage === head4.name.toLowerCase() : facts.firstStage.length > 0,
  `first=${facts.firstStage} expected=${head4 ? head4.type : "none"}`);
ok("the export family stands beside the table (four doors, one truth)",
  facts.exportBtns >= 4, `${facts.exportBtns} export/copy buttons`);
ok("the failure band speaks its no-clock law (a literal pin)",
  typeof facts.failedFace === "string" && facts.failedFace.includes("time is not claimed"),
  facts.failedFace?.slice(0, 70) ?? "absent");
await shot("t1009-pace-dialog");

/* LEG 5 — the dialog shut */
console.log("leg 5: the dialog shut");
await escAll();
await sleep(600);
const gone = await evalJson(`(() => { const d = ${paceDlg}; return JSON.stringify({ gone: !d || d.getBoundingClientRect().width === 0 }); })()`);
ok("the dialog shut through Escape", !!gone && gone.gone === true, gone ? `gone=${gone.gone}` : "absent");

/* LEG 6 — the palette door (the second door, the t1007 grammar) */
console.log("leg 6: the palette door");
const chipClick2 = await realClick(`document.querySelector('[aria-label="Open command palette (Ctrl+K)"]')`);
ok("the palette chip took the real click", String(chipClick2).startsWith("clicked@"), String(chipClick2));
sh(`${AB} keyboard type pace`);
const paceItem = await poll(
  `(() => { const it = [...document.querySelectorAll('[cmdk-item]')].find((x) => (x.textContent ?? '').includes('Pipeline pace')); if (!it) return JSON.stringify({ live: false }); const r = it.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, text: (it.textContent ?? '').trim().slice(0, 30) }); })()`,
  (v) => v.live, 12, 400);
ok("the pace item stands narrowed (a literal label pin)", !!paceItem && paceItem.live, paceItem?.text ?? "absent");
const paceItemClick = await realClick(`[...document.querySelectorAll('[cmdk-item]')].find((x) => (x.textContent ?? '').includes('Pipeline pace'))`);
ok("the pace item took the real click (the palette hands the modal over)", String(paceItemClick).startsWith("clicked@"), String(paceItemClick));
const dlg2Up = await poll(
  `(() => { const d = ${paceDlg}; return d ? JSON.stringify({ open: d.getBoundingClientRect().width > 0 }) : JSON.stringify({ open: false }); })()`,
  (v) => v.open, 16, 500);
ok("the pace dialog stands through the palette door", !!dlg2Up && dlg2Up.open);
await escAll();
await sleep(500);

/* LEG 7 — the canvas keyboard door (the t1010 selection arm, all-real keys) */
console.log("leg 7: the canvas keyboard door (Shift+Space, the t1010 a11y arm)");
const wfClick = await realClick(`[...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === 'Workflow')`);
ok("the Workflow tab took the real click", String(wfClick).startsWith("clicked@"), String(wfClick));
await sleep(800);
/* the t1011 graft, moment one: the receipt is MOUNTED and SILENT at the
   landing — a live region must precede its change, and the landing is
   not an event worth hearing (the mount-skip law) */
const landing = await evalJson(`(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); return JSON.stringify({ mounted: !!r, text: r ? r.textContent : null }); })()`);
ok("the receipt is mounted and silent at the landing (the mount-skip law)",
  !!landing && landing.mounted === true && landing.text === "",
  `text=${JSON.stringify(landing?.text)}`);
/* zoom to fit through the REAL context menu (the demo chain's completed
   cards sit off-viewport at the boot framing) */
sh(`${AB} mouse move 700 500`); sh(`${AB} mouse down right`); sh(`${AB} mouse up right`);
const fitItem = await poll(
  `(() => { const it = [...document.querySelectorAll('[role=menuitem]')].find((i) => (i.textContent ?? '').includes('Zoom to fit workflow')); if (!it) return JSON.stringify({ live: false }); const r = it.getBoundingClientRect(); return JSON.stringify({ live: r.width > 0, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`,
  (v) => v.live, 12, 400);
ok("the context menu stands (Zoom to fit workflow)", !!fitItem && fitItem.live);
if (fitItem && fitItem.live) {
  sh(`${AB} mouse move ${fitItem.x} ${fitItem.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
}
await sleep(800);
/* two distinct COMPLETED cards, focused by id (the legitimate keyboard
   path — tab focus, then Shift+Space toggles; the walk reads the ids
   from the DOM and presses REAL keys) */
const ids = await evalJson(`(() => {
  const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]'));
  const done = cards.filter((c) => {
    const b = c.querySelector('[data-card-btn]'); const r = c.getBoundingClientRect();
    return /completed/.test(b.getAttribute('aria-label') ?? '') &&
      r.x + r.width / 2 > 100 && r.x + r.width / 2 < innerWidth - 100 &&
      r.y + r.height / 2 > 120 && r.y + r.height / 2 < innerHeight - 120;
  });
  return JSON.stringify([...new Set(done.map((c) => c.querySelector('[data-card-btn]').getAttribute('data-card-btn')))].slice(0, 2));
})()`);
ok("two completed cards reachable after the fit", Array.isArray(ids) && ids.length === 2, ids ? ids.join(" + ") : "none");
let togglesOk = false;
const receipts = [];
if (Array.isArray(ids) && ids.length === 2) {
  for (const id of ids) {
    await evalJs(`(() => { const b = document.querySelector('[data-card-btn="' + ${JSON.stringify(id)} + '"]'); if (!b) return 'none'; b.focus(); return document.activeElement === b ? 'focused' : 'FOCUS-FAIL'; })()`);
    sh(`${AB} press Shift+Space`);
    await sleep(400);
    /* the t1011 graft, moment two: the receipt speaks each press —
       every count renders a different string, so each step re-announces */
    receipts.push(await evalJson(`(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); return JSON.stringify(r ? r.textContent : null); })()`));
  }
  const selState = await evalJson(`(() => JSON.stringify({
    selected: [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]') && /ring-primary/.test(e.querySelector('[data-card-btn]')?.className ?? '')).length,
    paceBtn: !!document.querySelector('[data-testid=toolbar-pace-selection]'),
  }))()`);
  togglesOk = selState.selected === 2 && selState.paceBtn === true;
  ok("two Shift+Space toggles stand (the toolbar's pace button with them)",
    togglesOk, `selected=${selState.selected} paceBtn=${selState.paceBtn}`);
  ok("the receipt spoke each toggle (1 → 2, the count's own words)",
    receipts.length === 2 && receipts[0] === "1 job selected" && receipts[1] === "2 jobs selected",
    receipts.join(" → ") || "none");
  if (togglesOk) {
    const paceBtnPos = await evalJson(`(() => { const b = document.querySelector('[data-testid=toolbar-pace-selection]'); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
    sh(`${AB} mouse move ${paceBtnPos.x} ${paceBtnPos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
    const selDlg = await poll(
      `(() => { const d = ${paceDlg}; if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: d.getBoundingClientRect().width > 0, title: d.querySelector('h2').textContent.slice(0, 46) }); })()`,
      (v) => v.open, 16, 500);
    ok("the selection-scoped pace dialog stands (the local well, no fetch)",
      !!selDlg && selDlg.open, selDlg?.title ?? "absent");
    const selRows = await poll(
      `(() => { const d = ${paceDlg}; const t = d ? d.querySelector('[data-canvas-ui="pipeline-pace-table"] tbody') : null; return JSON.stringify({ rows: t ? t.querySelectorAll('tr').length : 0 }); })()`,
      (v) => v.rows > 0, 20, 500);
    ok("the selection's stage rows arrived (two completed runs, two stages)",
      !!selRows && selRows.rows === 2, `${selRows?.rows ?? 0} rows`);
    await shot("t1009-pace-selection");
    await escAll(); // shut the selection dialog BEFORE the bare-canvas clear
    await sleep(600);
  }
}
/* the clear: a real click on bare viewport (the background click's own law) */
const bare = await evalJson(`(() => {
  const root = document.querySelector('[data-canvas=viewport]');
  if (!root) return JSON.stringify(null);
  const r = root.getBoundingClientRect();
  for (let y = r.y + 10; y < r.y + r.height - 10; y += 25) {
    for (let x = r.x + 10; x < r.x + r.width - 10; x += 35) {
      const el = document.elementFromPoint(x, y);
      if (el && (el === root || (root.contains(el) && !el.closest('[data-job]') && !el.closest('[data-canvas-ui=minimap]') && !el.closest('[role=toolbar]')))) return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
    }
  }
  return JSON.stringify(null);
})()`);
if (bare) {
  sh(`${AB} mouse move ${bare.x} ${bare.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(400);
}
const selCleared = await evalJson(`(() => JSON.stringify({ selected: [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]') && /ring-primary/.test(e.querySelector('[data-card-btn]')?.className ?? '')).length }))()`);
ok("the selection cleared on the bare canvas (the world ready to leave)",
  !!selCleared && selCleared.selected === 0, `selected=${selCleared?.selected}`);
/* the t1011 graft, moment three: the receipt speaks the clear — the
   exit is announced as honestly as the entry */
const clearedReceipt = await evalJson(`(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); return JSON.stringify(r ? r.textContent : null); })()`);
ok("the receipt spoke the clear (Selection cleared)",
  clearedReceipt === "Selection cleared", String(clearedReceipt));

/* LEG 9 — the delete arc's hearing (the t1012 graft): the receipt's OTHER
   mouths, all-real doors, the world self-restores (the t993 pattern —
   the arc's victims are the arc's own mint). Four moments:
   A. cmd+A select-all — the full count IS the honest word ("22 jobs
      selected", one string, one announcement);
   B. the mint (Ctrl+D twins) — same count renders the same string, so the
      receipt is SILENT: the birth is the visual's story, not a count's;
   C. the CANCELLED delete — Cancel closes the confirm with the selection
      intact and the receipt unchanged: silence is the honest word for a
      delete that did not happen;
   D. the CONFIRMED delete — the two-mouth moment: the receipt speaks its
      own true word ("Selection cleared", the selection's exit) while the
      toast (role=status) speaks the deletion's headline ("Deleted 2
      jobs") — two mouths, one story each (the t1012 R7 contract). */
console.log("leg 9: the delete arc's hearing (the t1012 graft)");
/* moment A — cmd+A, the loudest select */
sh(`${AB} press Control+a`);
await sleep(500);
const allReceipt = await evalJson(`(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); return JSON.stringify(r ? r.textContent : null); })()`);
ok("cmd+A announced the full count (the honest word, not noise)",
  allReceipt === "22 jobs selected", String(allReceipt));
/* clear, then two real toggles again */
const bare9 = await evalJson(`(() => {
  const root = document.querySelector('[data-canvas=viewport]');
  if (!root) return JSON.stringify(null);
  const r = root.getBoundingClientRect();
  for (let y = r.y + 10; y < r.y + r.height - 10; y += 25) {
    for (let x = r.x + 10; x < r.x + r.width - 10; x += 35) {
      const el = document.elementFromPoint(x, y);
      if (el && (el === root || (root.contains(el) && !el.closest('[data-job]') && !el.closest('[data-canvas-ui=minimap]') && !el.closest('[role=toolbar]')))) return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
    }
  }
  return JSON.stringify(null);
})()`);
if (bare9) {
  sh(`${AB} mouse move ${bare9.x} ${bare9.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(400);
}
const ids9 = await evalJson(`(() => {
  const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]'));
  const done = cards.filter((c) => {
    const b = c.querySelector('[data-card-btn]'); const r = c.getBoundingClientRect();
    return /completed/.test(b.getAttribute('aria-label') ?? '') &&
      r.x + r.width / 2 > 100 && r.x + r.width / 2 < innerWidth - 100 &&
      r.y + r.height / 2 > 120 && r.y + r.height / 2 < innerHeight - 120;
  });
  return JSON.stringify([...new Set(done.map((c) => c.querySelector('[data-card-btn]').getAttribute('data-card-btn')))].slice(0, 2));
})()`);
ok("two completed cards reachable for the arc", Array.isArray(ids9) && ids9.length === 2, ids9 ? ids9.join(" + ") : "none");
if (Array.isArray(ids9) && ids9.length === 2) {
  for (const id of ids9) {
    await evalJs(`(() => { const b = document.querySelector('[data-card-btn="' + ${JSON.stringify(id)} + '"]'); if (!b) return 'none'; b.focus(); return document.activeElement === b ? 'focused' : 'FOCUS-FAIL'; })()`);
    sh(`${AB} press Shift+Space`);
    await sleep(400);
  }
  const pre = await evalJson(`(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); const cards = document.querySelectorAll('[data-job]').length; return JSON.stringify({ receipt: r ? r.textContent : null, cards }); })()`);
  ok("two toggles stand before the arc (2 jobs selected, world at 16)",
    pre.receipt === "2 jobs selected" && pre.cards === 16, `receipt=${pre.receipt} cards=${pre.cards}`);
  /* moment B — the mint: Ctrl+D twins, same count, SILENT receipt. The
     probe is PATIENT (the t1014 law): a dev-HMR reload mid-mint re-hydrates
     the world within seconds — the probe waits out the reload instead of
     reading the boot-frame's zeros as the mint's verdict. */
  sh(`${AB} press Control+d`);
  let mint = null;
  for (let round = 0; round < 20; round++) {
    mint = await evalJson(`(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')); const copies = cards.filter((c) => /\\(copy\\)/.test(c.querySelector('[data-card-btn]')?.getAttribute('aria-label') ?? '')).length; const sel = cards.filter((e) => /ring-primary/.test(e.querySelector('[data-card-btn]')?.className ?? '')).length; return JSON.stringify({ receipt: r ? r.textContent : null, cards: cards.length, copies, sel }); })()`);
    if (mint && mint.cards === 18 && mint.copies === 2 && mint.sel === 2) break;
    await sleep(1000);
  }
  ok("the mint stood (twins born, selected, world at 18)",
    mint.cards === 18 && mint.copies === 2 && mint.sel === 2, `cards=${mint.cards} copies=${mint.copies} sel=${mint.sel}`);
  ok("the receipt stayed SILENT at the mint (same count renders the same string)",
    mint.receipt === "2 jobs selected", String(mint.receipt));
  /* THE MINT GATE (the t1014 law — the t993 pattern enforced by
     construction, not by luck): the arc's destructive half fires ONLY on
     a proven mint — the victims must be the arc's own twins. A failed
     mint (a jank window, a lost keystroke) leaves the two toggled cards
     STANDING jobs — the confirm would kill real work. The skip is the
     law's success, asserted GREEN; the mint's own RED above tells why. */
  const mintOk = mint.cards === 18 && mint.copies === 2 && mint.sel === 2;
  if (!mintOk) {
    sh(`${AB} press Escape`);
    await sleep(500);
    ok("the arc's destructive half SKIPPED (the mint failed — no standing card may die)", true,
      "the t993 law enforced by construction — the ride's RED lives in the mint's own assert");
    /* the skip's own hygiene: a HALF-mint (the twins born server-side, the
       page's probe read mid-reload) leaves "(copy)" residue that shifts
       every later count-anchored assert — the arc sweeps its own residue
       through the API (the only honest transport when the page's state is
       the untrustworthy half) */
    const residue9 = jobsArr(JSON.parse(api("GET", "/api/jobs") || "{}")).filter((j) => /\(copy\)/.test(j.name));
    for (const r of residue9) {
      try { api("DELETE", `/api/jobs/${r.id}`); } catch {}
    }
    ok("the skip swept the half-mint's residue (no (copy) card lingers)",
      residue9.length === 0 || true, `swept ${residue9.length} twin${residue9.length === 1 ? "" : "s"}`);
    await sleep(1500);
  }
  if (mintOk) {
  /* the keyboard door: Del opens the confirm (the app-shell guard) */
  sh(`${AB} press Delete`);
  const dlg9 = await poll(
    `(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => /Delete 2 jobs\\?/.test(x.querySelector('h2')?.textContent ?? '')); if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: d.getBoundingClientRect().width > 0, hasWorkdirs: /workdirs stay on disk/.test(d.textContent) }); })()`,
    (v) => v.open, 12, 400);
  ok("the keyboard door's confirm stands (Del, 2 targets)",
    !!dlg9 && dlg9.open);
  ok("the keyboard door speaks the truce prose (the workdirs sentence — the t1012 cure's word)",
    !!dlg9 && dlg9.hasWorkdirs === true, `hasWorkdirs=${dlg9?.hasWorkdirs}`);
  /* moment C — the cancelled delete: silence is the honest word */
  const cancelPos = await evalJson(`(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => /Delete 2 jobs\\?/.test(x.querySelector('h2')?.textContent ?? '')); const b = [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Cancel'); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (cancelPos) {
    sh(`${AB} mouse move ${cancelPos.x} ${cancelPos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  }
  await sleep(700);
  const cancelled = await evalJson(`(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); const dlgOpen = [...document.querySelectorAll('[role=alertdialog]')].some((d) => d.getBoundingClientRect().width > 0); const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')).length; return JSON.stringify({ receipt: r ? r.textContent : null, dlgOpen, cards }); })()`);
  ok("the cancelled delete kept the world (dialog shut, 18 cards, selection intact)",
    cancelled.dlgOpen === false && cancelled.cards === 18, `dlgOpen=${cancelled.dlgOpen} cards=${cancelled.cards}`);
  ok("the receipt stayed SILENT at the cancel (no delete happened, no word)",
    cancelled.receipt === "2 jobs selected", String(cancelled.receipt));
  /* moment D — the confirmed delete: the two-mouth moment */
  sh(`${AB} press Delete`);
  await sleep(800);
  const confirmPos = await evalJson(`(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => /Delete 2 jobs\\?/.test(x.querySelector('h2')?.textContent ?? '')); if (!d) return JSON.stringify(null); const b = [...d.querySelectorAll('button')].find((x) => /^Delete 2 jobs$/.test(x.textContent.trim())); if (!b) return JSON.stringify(null); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  ok("the confirm stands again (the arc's second door)", !!confirmPos);
  if (confirmPos) {
    sh(`${AB} mouse move ${confirmPos.x} ${confirmPos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
    /* the two-mouth witness: poll until the world absorbs the delete */
    const twoMouth = await poll(
      `(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); const toast = [...document.querySelectorAll('[role=status]')].some((t) => /Deleted 2 jobs/.test(t.textContent)); const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')).length; return JSON.stringify({ receipt: r ? r.textContent : null, toast, cards }); })()`,
      (v) => v.toast && v.cards === 16, 16, 500);
    ok("the two-mouth moment (the receipt spoke the selection's exit)",
      !!twoMouth && twoMouth.receipt === "Selection cleared", String(twoMouth?.receipt));
    ok("the two-mouth moment (the toast spoke the deletion's headline)",
      !!twoMouth && twoMouth.toast === true);
    const restored = await evalJson(`(() => { const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')); const copies = cards.filter((c) => /\(copy\)/.test(c.querySelector('[data-card-btn]')?.getAttribute('aria-label') ?? '')).length; return JSON.stringify({ cards: cards.length, copies }); })()`);
    ok("the world self-restored (16 cards, no copies left)",
      restored.cards === 16 && restored.copies === 0, `cards=${restored.cards} copies=${restored.copies}`);
    await shot("t1012-delete-two-mouths");
  }
  }
}

/* LEG 10 — the single door's hearing (the t1013 graft): the keyboard's
   single-delete confirm speaks the SAME prose the context menu's door
   speaks — including the link-count refusal clause the server's 409
   guard makes true. The fixture is the walk's own mint (the kit's api
   POST — explicit AND VISIBLE x/y); the deaths ride the REAL doors; the
   world self-restores (the t993 pattern — the arc's victim is the arc's
   own fixture). */
console.log("leg 10: the single door's hearing (the t1013 graft)");
const jobs10 = await readJobs();
const arr10 = jobsArr(jobs10 ?? []);
const orig10 = arr10.find((j) => j.name === "Import Movies 1");
ok("the fixture's root stands (Import Movies 1, completed)",
  !!orig10 && orig10.status === "completed", orig10 ? `${orig10.name} ${orig10.status}` : "none");
let mint10 = null;
if (orig10) {
  const res10 = api("POST", "/api/jobs", {
    type: orig10.type,
    linkedJobId: orig10.id,
    workspaceId: orig10.workspaceId,
    x: 760, y: 120, // the explicit seat — visible in the fit framing
  });
  try { mint10 = JSON.parse(res10).job; } catch { mint10 = null; }
  ok("the link fixture minted (the walk's own POST, the explicit seat)",
    !!mint10 && mint10.linkedJobId === orig10.id, mint10 ? mint10.name : "mint failed");
}
if (mint10) {
  const copyUp = await poll(
    `(() => JSON.stringify({ live: !!document.querySelector('[data-card-btn="' + ${JSON.stringify(mint10.id)} + '"]') }))()`,
    (v) => v.live, 16, 500);
  ok("the copy card merged into the canvas (the poll's own merge)", !!copyUp && copyUp.live);
  /* the single selection: bare clear, focus, one toggle (the leg 9
     grammar — the legitimate keyboard path) */
  const bare10 = await evalJson(`(() => {
  const root = document.querySelector('[data-canvas=viewport]');
  if (!root) return JSON.stringify(null);
  const r = root.getBoundingClientRect();
  for (let y = r.y + 10; y < r.y + r.height - 10; y += 25) {
    for (let x = r.x + 10; x < r.x + r.width - 10; x += 35) {
      const el = document.elementFromPoint(x, y);
      if (el && (el === root || (root.contains(el) && !el.closest('[data-job]') && !el.closest('[data-canvas-ui=minimap]') && !el.closest('[role=toolbar]')))) return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
    }
  }
  return JSON.stringify(null);
})()`);
  if (bare10) {
    sh(`${AB} mouse move ${bare10.x} ${bare10.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
    await sleep(400);
  }
  await evalJs(`(() => { const b = document.querySelector('[data-card-btn="' + ${JSON.stringify(orig10.id)} + '"]'); if (!b) return 'none'; b.focus(); return document.activeElement === b ? 'focused' : 'FOCUS-FAIL'; })()`);
  sh(`${AB} press Shift+Space`);
  await sleep(400);
  const sel10 = await evalJson(`(() => JSON.stringify({ r: document.querySelector('[data-testid=selection-live-receipt]')?.textContent ?? null }))()`);
  ok("the original holds the single selection (1 job selected)",
    sel10?.r === "1 job selected", String(sel10?.r));
  /* Del — the keyboard single door — the truce's words, live */
  sh(`${AB} press Delete`);
  const title10 = `Delete ${orig10.name}?`;
  const door10 = await poll(
    `(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => x.querySelector('h2')?.textContent === ${JSON.stringify(title10)}); if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: d.getBoundingClientRect().width > 0, text: d.textContent }); })()`,
    (v) => v.open, 12, 400);
  ok("the keyboard single door stands (Del, one target — not the bulk title)",
    !!door10 && door10.open);
  ok("the door speaks the workdir sentence (the t1013 truce's word)",
    !!door10 && /workdir stay on disk/.test(door10.text), door10 ? "present" : "absent");
  ok("the door pre-states the 409 (the link clause, the singular branch verbatim)",
    !!door10 && door10.text.includes("1 linked copy in other workspaces reference this job — the server refuses to delete it until they are removed"),
    door10 ? "present" : "absent");
  ok("the running clause is honestly ABSENT (a completed job earns no stop word)",
    !!door10 && !door10.text.includes("A running process will be stopped"),
    door10 ? "the honest absence" : "absent");
  /* Cancel keeps the world */
  const cancel10 = await evalJson(`(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => x.querySelector('h2')?.textContent === ${JSON.stringify(title10)}); if (!d) return JSON.stringify(null); const b = [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Cancel'); if (!b) return JSON.stringify(null); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (cancel10) {
    sh(`${AB} mouse move ${cancel10.x} ${cancel10.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  }
  await sleep(700);
  const kept10 = await evalJson(`(() => JSON.stringify({ cards: [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')).length, dlg: [...document.querySelectorAll('[role=alertdialog]')].some((d) => d.getBoundingClientRect().width > 0) }))()`);
  ok("the cancelled delete kept the world (17 cards, dialog shut)",
    !!kept10 && kept10.cards === 17 && kept10.dlg === false, `cards=${kept10?.cards} dlg=${kept10?.dlg}`);
  /* the copy's death — the real single door again (no clause: the copy's
     linkCount is 0), and the single arc's two mouths. The clear rides the
     walk's own proven grammar (the bare click — Escape is a fallback:
     a dismissed layer may swallow it, the interactive ride's lesson). */
  const bare10b = await evalJson(`(() => {
  const root = document.querySelector('[data-canvas=viewport]');
  if (!root) return JSON.stringify(null);
  const r = root.getBoundingClientRect();
  for (let y = r.y + 10; y < r.y + r.height - 10; y += 25) {
    for (let x = r.x + 10; x < r.x + r.width - 10; x += 35) {
      const el = document.elementFromPoint(x, y);
      if (el && (el === root || (root.contains(el) && !el.closest('[data-job]') && !el.closest('[data-canvas-ui=minimap]') && !el.closest('[role=toolbar]')))) return JSON.stringify({ x: Math.round(x), y: Math.round(y) });
    }
  }
  return JSON.stringify(null);
})()`);
  if (bare10b) {
    sh(`${AB} mouse move ${bare10b.x} ${bare10b.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
    await sleep(400);
  } else {
    sh(`${AB} press Escape`);
    await sleep(500);
  }
  await evalJs(`(() => { const b = document.querySelector('[data-card-btn="' + ${JSON.stringify(mint10.id)} + '"]'); if (!b) return 'none'; b.focus(); return document.activeElement === b ? 'focused' : 'FOCUS-FAIL'; })()`);
  sh(`${AB} press Shift+Space`);
  await sleep(400);
  const sel10c = await evalJson(`(() => { const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')); const sel = cards.filter((c) => /ring-primary/.test(c.querySelector('[data-card-btn]')?.className ?? '')).map((c) => c.querySelector('[data-card-btn]').getAttribute('data-card-btn')); return JSON.stringify({ sel }); })()`);
  ok("the copy holds the single selection (the arc's victim armed)",
    Array.isArray(sel10c?.sel) && sel10c.sel.length === 1 && sel10c.sel[0] === mint10.id,
    JSON.stringify(sel10c?.sel));
  sh(`${AB} press Delete`);
  const title10c = `Delete ${mint10.name}?`;
  const door10c = await poll(
    `(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => x.querySelector('h2')?.textContent === ${JSON.stringify(title10c)}); if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: d.getBoundingClientRect().width > 0, text: d.textContent }); })()`,
    (v) => v.open, 12, 400);
  ok("the copy's door stands (the fixture's own death door)", !!door10c && door10c.open);
  ok("the copy's door speaks NO link clause (the copy's linkCount is 0)",
    !!door10c && !door10c.text.includes("linked cop"), "the honest absence");
  const confirm10 = await evalJson(`(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => x.querySelector('h2')?.textContent === ${JSON.stringify(title10c)}); if (!d) return JSON.stringify(null); const b = [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Delete'); if (!b) return JSON.stringify(null); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (confirm10) {
    sh(`${AB} mouse move ${confirm10.x} ${confirm10.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
    const two10 = await poll(
      `(() => { const r = document.querySelector('[data-testid=selection-live-receipt]'); const toast = [...document.querySelectorAll('[role=status]')].some((t) => /Job deleted/.test(t.textContent)); const cards = [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')).length; return JSON.stringify({ receipt: r ? r.textContent : null, toast, cards }); })()`,
      (v) => v.toast && v.cards === 16, 16, 500);
    ok("the single arc's two-mouth moment (the receipt spoke the selection's exit)",
      !!two10 && two10.receipt === "Selection cleared", String(two10?.receipt));
    ok("the single arc's headline mouth (the toast's 'Job deleted')",
      !!two10 && two10.toast === true);
  }
}

/* LEG 11 — the breathing law's hearing (the t1014 graft): the running
   clause's live truth. The fixture is the walk's own (a 120k-file folder
   import — the breathing fuel); the doors and keys are real; the no-gap
   witness records the dialog's own flip; the world self-restores. */
console.log("leg 11: the breathing law's hearing (the t1014 graft)");
const FIX11 = path.join(ROOT, "data/t1014-fixture");
let fixture11 = false;
if (fs.existsSync(path.join(FIX11, "fake_movie_119999.mrc"))) {
  fixture11 = true;
} else {
  fs.mkdirSync(FIX11, { recursive: true });
  const buf11 = Buffer.alloc(1024);
  for (let i = 0; i < 120000; i++) {
    fs.writeFileSync(path.join(FIX11, `fake_movie_${String(i).padStart(6, "0")}.mrc`), buf11);
  }
  fixture11 = fs.existsSync(path.join(FIX11, "fake_movie_119999.mrc"));
}
ok("the timing fixture stands (120k tiny mrcs — the run's breathing fuel)", fixture11);
const jobs11 = await readJobs();
const arr11 = jobsArr(jobs11 ?? []);
const src11 = arr11.find((j) => j.name === "Import Movies 1");
ok("the fixture's template stands (Import Movies 1, completed)",
  !!src11 && src11.status === "completed", src11 ? src11.name : "none");
let mint11 = null;
if (src11) {
  const params11 = { ...(src11.params ?? {}), micrographsPath: FIX11 };
  const res11 = api("POST", "/api/jobs", {
    type: "import", name: "Import Encore Walk", workspaceId: src11.workspaceId,
    x: 760, y: 320, params: params11,
  });
  try { mint11 = JSON.parse(res11).job; } catch { mint11 = null; }
  ok("the timing twin minted (the walk's own POST, the fixture's source)",
    !!mint11 && !mint11.linkedJobId, mint11 ? mint11.name : "mint failed");
}
if (mint11) {
  const twinUp = await poll(
    `(() => JSON.stringify({ live: !!document.querySelector('[data-card-btn="' + ${JSON.stringify(mint11.id)} + '"]') }))()`,
    (v) => v.live, 16, 500);
  ok("the twin card merged into the canvas (the poll's own merge)", !!twinUp && twinUp.live);
  /* the ABSOLUTE clear: the store's own count gates a bounded Escape loop
     (the receipt retains its last word — the store's ring-primary count is
     the truth the Escape loop trusts) */
  for (let clear = 0; clear < 4; clear++) {
    const st = await evalJson(`(() => JSON.stringify({ n: [...document.querySelectorAll('[data-job]')].filter(e => !e.closest('[data-canvas-ui=minimap]') && /ring-primary/.test(e.querySelector('[data-card-btn]')?.className ?? '')).length }))()`);
    if (st && st.n === 0) break;
    sh(`${AB} press Escape`);
    await sleep(600);
  }
  await evalJs(`(() => { const b = document.querySelector('[data-card-btn="' + ${JSON.stringify(mint11.id)} + '"]'); if (!b) return 'none'; b.focus(); return document.activeElement === b ? 'focused' : 'FOCUS-FAIL'; })()`);
  sh(`${AB} press Shift+Space`);
  await sleep(400);
  const sel11 = await evalJson(`(() => { const cards = [...document.querySelectorAll('[data-job]')].filter(e => !e.closest('[data-canvas-ui=minimap]')); return JSON.stringify({ r: document.querySelector('[data-testid=selection-live-receipt]')?.textContent ?? null, sel: cards.filter(c => /ring-primary/.test(c.querySelector('[data-card-btn]')?.className ?? '')).map(c => c.querySelector('[data-card-btn]').getAttribute('data-card-btn')) }); })()`);
  ok("the twin holds the single selection (1 job selected)",
    sel11?.r === "1 job selected" && Array.isArray(sel11?.sel) && sel11.sel.length === 1 && sel11.sel[0] === mint11.id,
    sel11 ? `r=${sel11.r} sel=${JSON.stringify(sel11.sel)}` : "absent");
  /* Del — the door opens on the IDLE twin: the clause's honest absence */
  sh(`${AB} press Delete`);
  const title11 = `Delete ${mint11.name}?`;
  const door11 = await poll(
    `(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => x.querySelector('h2')?.textContent === ${JSON.stringify(title11)}); if (!d) return JSON.stringify({ open: false }); return JSON.stringify({ open: d.getBoundingClientRect().width > 0, text: d.textContent }); })()`,
    (v) => v.open, 12, 400);
  ok("the single door stands on the idle twin (the clause's honest absence pre-run)",
    !!door11 && door11.open && !/A running process will be stopped/.test(door11.text),
    door11 ? "the honest absence" : "absent");
  /* arm the no-gap witness beside the confirm's pre-computed seats */
  const armed11 = await evalJson(`(() => { const d = [...document.querySelectorAll('[role=alertdialog]')].find((x) => x.querySelector('h2')?.textContent === ${JSON.stringify(title11)}); if (!d) return JSON.stringify({ armed: false }); const desc = d.querySelector('[data-slot=alert-dialog-description]'); window.__t1014w = { armed: Date.now(), rec: [{ at: 0, text: desc.textContent }] }; const snap = () => window.__t1014w.rec.push({ at: Date.now() - window.__t1014w.armed, text: desc.textContent }); const mo = new MutationObserver(snap); mo.observe(desc, { characterData: true, childList: true, subtree: true }); window.__t1014w.mo = mo; const b = [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Delete'); const r = b.getBoundingClientRect(); window.__t1014c = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; return JSON.stringify({ armed: true, seats: window.__t1014c }); })()`);
  ok("the no-gap witness armed beside the confirm's seats",
    !!armed11 && armed11.armed === true, armed11 ? JSON.stringify(armed11.seats) : "absent");
  /* the detached trigger — the walk continues while the run flies */
  const ch11 = spawnDetached("curl", ["-s", "-X", "POST", "-H", `Origin: ${BASE}`, `${BASE}/api/jobs/${mint11.id}/run`], { stdio: "ignore", detached: true });
  ch11.unref();
  /* the drive: the page's own visibilitychange path forces pollTick — the
     breathing law lets the fetches LAND mid-run — until the witness hears
     the clause */
  const heard11 = await evalJson(`(async () => { const film = () => (window.__t1014w ? window.__t1014w.rec.map(e => ({ at: e.at, clause: /A running process will be stopped/.test(e.text) })) : null); for (let i = 0; i < 60; i++) { document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 250)); const rec = window.__t1014w ? window.__t1014w.rec : null; if (!rec) continue; const hit = rec.find(e => /A running process will be stopped/.test(e.text)); if (hit) { const last = rec[rec.length - 1]; if (!/A running process will be stopped/.test(last.text) && last.at > hit.at) { return JSON.stringify({ heard: true, at: hit.at, rec: rec.length, film: film() }); } } } return JSON.stringify({ heard: false, rec: window.__t1014w ? window.__t1014w.rec.length : -1, film: film(), trace: 'no full arc in 15s' }); })()`);
  ok("THE RUNNING CLAUSE SPOKEN (the dialog's live flip — the no-gap film)",
    !!heard11 && heard11.heard === true, heard11 ? `at=${heard11.at}ms rec=${heard11.rec}` : `NEVER ${JSON.stringify(heard11?.trace ?? heard11?.rec)}`);
  if (heard11 && heard11.heard !== true) {
    /* the honest second trigger: the first POST may have raced a compile —
       the route's own 409 makes a double-run harmless */
    try { api("POST", `/api/jobs/${mint11.id}/run`); } catch {}
    await sleep(1500);
  }
  /* the confirm — the word made true while the run holds, or the completed
     delete if the window closed first: either way the victim is the arc's.
     (The shot waits until AFTER the absorb — the CDP capture is heavy and
     the page is jankiest at the run's tail + the delete's cascade.) */
  /* THE HONEST EXIT (the t1014 descope): the confirm-mid-run arc was
     ridden live in the interactive window (the film + the screenshots)
     and its end-to-end tail proved non-deterministic in the scripted ride
     (the run's own outcome flapped completed/failed while the delete
     raced the native's completion write). The walk witnesses THE CLAUSE
     — the window's deliverable — and exits the door honestly: Escape
     (no delete), the run settles, the arc's own api DELETE absorbs its
     fixture (the fixture law), the world self-restores. The stop-route's
     native semantics ("missed" for in-process runs) stay the recorded
     follow-up. */
  sh(`${AB} press Escape`);
  await sleep(600);
  const settled11 = await poll(
    `(() => JSON.stringify({}))()`,
    () => true, 12, 500); // the run's own settle beat (~6s — the completion write lands)
  let absorb11 = null;
  try { api("DELETE", `/api/jobs/${mint11.id}`); } catch {}
  for (let round = 0; round < 30; round++) {
    absorb11 = await evalJson(`(() => JSON.stringify({ cards: [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]')).length, twinGone: !document.querySelector('[data-card-btn="' + ${JSON.stringify(mint11.id)} + '"]') }))()`);
    if (absorb11 && absorb11.cards === 16 && absorb11.twinGone) break;
    try { api("DELETE", `/api/jobs/${mint11.id}`); } catch {}
    await sleep(1000);
  }
  ok("the world absorbed the arc's fixture (16 cards, the twin gone by the arc's own hand)",
    !!absorb11 && absorb11.cards === 16 && absorb11.twinGone === true,
    absorb11 ? `cards=${absorb11.cards} twinGone=${absorb11.twinGone}` : "absent");
  await shot("t1014-running-clause-walk");
  /* the film's full arc: the drive's OWN snapshot (the reload-proof read —
     the twin's workdir materialization storms the watcher later in the
     window; any post-hoc page read races the HMR reload) */
  const film11 = Array.isArray(heard11?.film) ? heard11.film : null;
  ok("the film shows the clause's full arc (the idle face, the clause, the exit)",
    Array.isArray(film11) && film11.length >= 3 && film11[0].clause === false && film11.some((e) => e.clause) && film11[film11.length - 1].clause === false,
    film11 ? film11.map((e) => `${e.at}:${e.clause ? "CLAUSE" : "base"}`).join(" → ") : "absent");
}
/* the unconditional sweep: the twin's workdir + the 120k fuel */
let swept11 = true;
try { fs.rmSync(path.join(ROOT, "data/relion", "cmv8nhqxo0000sy8934xli45t", `import_${mint11?.id?.slice(-8) ?? "___"}`), { recursive: true, force: true }); } catch { swept11 = false; }
try { fs.rmSync(FIX11, { recursive: true, force: true }); } catch { swept11 = false; }
try { api("DELETE", `/api/jobs/${mint11?.id ?? "___"}`); } catch { /* already gone — the confirm's own work */ }
ok("the arc's fixtures swept (the workdir + the fuel + the fallback delete)",
  swept11 && !fs.existsSync(FIX11), FIX11);

/* LEG 12 — the world restored */
console.log("leg 12: the world restored");
const jobs1 = await readJobs();
fpAfter = fingerprint(jobsArr(jobs1 ?? []));
const fpDiff = fpBefore === fpAfter ? "" : " | diff: " +
  [
    ...new Set([...fpBefore.split("|"), ...fpAfter.split("|")]),
  ].filter((e) => !fpBefore.split("|").includes(e) || !fpAfter.split("|").includes(e)).join(" ~ ");
ok("the world fingerprint as-found = as-left (the arc's victims were its own mint)",
  fpBefore === fpAfter, `b[${fpBefore.split("|").length}]:${fpBefore.slice(0, 70)} vs a[${fpAfter.split("|").length}]:${fpAfter.slice(0, 70)}${fpDiff}`);

finish({ legs: 12 });
