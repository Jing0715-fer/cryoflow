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
 *      clears;
 *   8. the world restored — the fingerprint as-found = as-left.
 *
 * RIDE LAWS inherited: one fresh `agent-browser open`; poll-then-probe;
 * realClick probes vis AND owns every round; the walk asserts (it is
 * the face's verifier) and exits honest. THE LITERAL-WORD LAW: the
 * asserts pin the band's words ("total compute", "wall time", "time is
 * not claimed") as LITERALS — any rewording re-keys the walk IN THE
 * SAME COMMIT.
 *
 *   node scripts/t1009-pace-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const {
  AB, BASE, ok, sleep, sh, evalJs, evalJson, poll, realClick, escAll, shot,
  serverFirst, readJobs, jobsArr, fingerprint, finish,
} = createWalk({ name: "t1009-pace-walk", receiptFile: "t1009-pace-walk.json" });

console.log("=== t1009 pace door walk ===");

await serverFirst();

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
ok("the first stage is the chain's own head (import — the demo chain's first run)",
  facts.firstStage === "import", facts.firstStage);
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
if (Array.isArray(ids) && ids.length === 2) {
  for (const id of ids) {
    await evalJs(`(() => { const b = document.querySelector('[data-card-btn="' + ${JSON.stringify(id)} + '"]'); if (!b) return 'none'; b.focus(); return document.activeElement === b ? 'focused' : 'FOCUS-FAIL'; })()`);
    sh(`${AB} press Shift+Space`);
    await sleep(400);
  }
  const selState = await evalJson(`(() => JSON.stringify({
    selected: [...document.querySelectorAll('[data-job]')].filter((e) => !e.closest('[data-canvas-ui=minimap]') && /ring-primary/.test(e.querySelector('[data-card-btn]')?.className ?? '')).length,
    paceBtn: !!document.querySelector('[data-testid=toolbar-pace-selection]'),
  }))()`);
  togglesOk = selState.selected === 2 && selState.paceBtn === true;
  ok("two Shift+Space toggles stand (the toolbar's pace button with them)",
    togglesOk, `selected=${selState.selected} paceBtn=${selState.paceBtn}`);
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

/* LEG 8 — the world restored */
console.log("leg 8: the world restored");
const jobs1 = await readJobs();
fpAfter = fingerprint(jobsArr(jobs1 ?? []));
ok("the world fingerprint as-found = as-left (a read-only ride)",
  fpBefore === fpAfter, `${fpBefore.split("|").length} jobs`);

finish({ legs: 8 });
