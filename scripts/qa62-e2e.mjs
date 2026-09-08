// Task 62 QA — the FSC compare dialog learns to ACT: hover-highlight,
// jump-to-job, live badge + re-scan.
//
// Seed (qa60-seed-fsc.py, extended): five FSC-bearing jobs
//   QA Post 300   postprocess  corrected 0.143 @ ~3.00 Å  (teal   #14b8a6)
//   QA Post 320   postprocess  corrected 0.143 @ ~3.20 Å  (amber  #f59e0b)
//   QA Post 385   postprocess  corrected 0.143 @ ~3.85 Å  (violet #8b5cf6)
//   QA Refine 410 refine3d     gold-std  0.143 @ ~4.10 Å  (rose   #f43f5e)
//   QA Refine Live refine3d RUNNING, run_it014_half1_model.star (sky #0ea5e9)
//
//   A  HIGHLIGHT + LIVE: open QA Post 320's inspector → compare dialog
//      lists 5 rows (4 completed + 1 running) → running row carries the
//      pulsing live badge + header has the re-scan button → tick 3 →
//      4 curves → baseline all-opacity-1 → hover row 300: teal bolds (w3),
//      others dim to 0.15 → mouse away: restores → hover legend 385:
//      violet bolds, others dim → keyboard focus legend 410: same via
//      focus (a11y parity) → hover screenshot
//   B  JUMP + RESCAN: click the jump button on row 300 → dialog closes,
//      inspector switches to QA Post 300 (FSC section present) → reopen
//      compare: (this job) marker MOVED to 300, 320 row is now a jump
//      button, selection restored 4/6 → click re-scan: curves re-read,
//      rows still 5, lines still 4
//   C  CONSOLE: 0 page errors → cleanup (seed --clean also deletes the
//      live job)
// Usage: QA_PHASES=A node scripts/qa62-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = "/home/z/my-project/.qa-logs/qa62-trace.log";
const step = (m) => {
  const line = `[${(Date.now() / 1000).toFixed(0)}] ${m}`;
  try { appendFileSync(LOGF, line + "\n"); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig} — dying`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));
process.on("uncaughtException", (e) => { step(`uncaught: ${e.message}`); process.exit(2); });
process.on("unhandledRejection", (e) => { step(`unhandledRejection: ${e}`); process.exit(3); });

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

const B = "http://localhost:3000";
const PROJECT = "cmtrzp5x80002p8uofb9eu5pp"; // same as the seed's PROJECT
const HOST_JOB = "QA Post 320";
const SEED = "python3 /home/z/my-project/scripts/qa60-seed-fsc.py";
const SEED_CLEAN = "python3 /home/z/my-project/scripts/qa60-seed-fsc.py --clean";
const FATAL = (msg) => { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); process.exit(1); };
const must = (cond, label) => { if (!cond) FATAL(label); else step(`  ok: ${label}`); };

const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
// bare "0" through JSON.parse becomes the NUMBER 0 — string-compare via
// unq only (the qa58/qa60 trap: `J(...) === "0"` is always false)
const errCount = () => unq(evalJs(`String((window.__qaErrs||[]).length)`));
/** job ids by name, straight from the API (row targeting uses data-job-id) */
async function jobIdsByName() {
  const res = await fetch(`${B}/api/jobs`);
  const body = await res.json();
  const jobs = body.jobs ?? body;
  const out = {};
  for (const n of ["QA Post 300", "QA Post 320", "QA Post 385", "QA Refine 410", "QA Refine Live"]) {
    out[n] = (jobs.find((j) => j.name === n) || {}).id ?? null;
  }
  return out;
}

/** the dialog assigns palette colors by INDEX POSITION (postprocess group
 *  first, then createdAt order) — derive the same mapping from the index
 *  API at runtime instead of hardcoding a color per job name */
const PALETTE6 = ["#14b8a6", "#f59e0b", "#8b5cf6", "#f43f5e", "#0ea5e9", "#84cc16"];
async function paletteByJob() {
  const res = await fetch(`${B}/api/projects/${PROJECT}/fsc-index`);
  const body = await res.json();
  const map = {};
  (body.jobs ?? []).forEach((j, i) => { map[j.jobId] = PALETTE6[i % PALETTE6.length]; });
  return map;
}

const realClick = async (findExpr) => {
  const coords = evalJs(
    `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );
  if (!coords || coords === "null") return "NO-ELEMENT";
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};

/** real CDP hover (NO click) — React's onMouseEnter fires from the move */
const hoverAt = async (findExpr) => {
  const coords = evalJs(
    `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );
  if (!coords || coords === "null") return "NO-ELEMENT";
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  return `hovered@${c.x},${c.y}`;
};

const bootCanvas = async () => {
  // zombie page first — stale params auto-save can overwrite fresh state
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  evalJs(errCollector);
  for (let i = 0; i < 12; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'));
      const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
      return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
    })()`);
    if (probe.includes("CARD")) return true;
    if (probe.includes("DASH")) {
      evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
      step(`  bootCanvas: dashboard → canvas (Shift+D), iter ${i}`);
    }
    await sleep(2200);
  }
  return false;
};

const clearCompareStorage = () =>
  evalJs(`(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cryoflow.fsc-compare'));
    keys.forEach(k => localStorage.removeItem(k));
    return 'cleared:' + keys.length;
  })()`);

const openInspector = async () => {
  for (let i = 0; i < 10; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'))`,
    );
    if (r.includes("clicked@")) {
      await sleep(1500);
      const has = unq(evalJs(`(() => {
        // completed cards open the INSPECTOR MODAL (role=dialog); the FSC
        // card lives in its Overview tab
        const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
        return dl ? 'MODAL' : 'NONE';
      })() + ''`));
      if (has === "MODAL") return true;
    }
    step(`  openInspector iter ${i}: ${r.slice(0, 40)}`);
    await sleep(2000);
  }
  return false;
};

const fscSection = () => unq(evalJs(`(() => {
  const s = document.querySelector('section[aria-label="Fourier-shell correlation"]');
  return s ? 'YES' : 'NO';
})() + ''`));

const waitFor = async (probeFn, label, tries = 12, gap = 1200) => {
  for (let i = 0; i < tries; i++) {
    const v = await probeFn();
    if (v) return true;
    await sleep(gap);
  }
  step(`  waitFor(${label}) exhausted`);
  return false;
};

const openCompare = async () => {
  const r = unq(evalJs(`(() => {
    const b = document.querySelector('[data-testid=fsc-compare-open]');
    if (!b) return 'NO-CHIP';
    b.click();
    return 'clicked';
  })()`));
  await sleep(700);
  const open = unq(evalJs(`(() => !!document.querySelector('[data-testid=fsc-compare-list]'))() + ''`));
  return { r, open: open === "true" };
};

/** dialog probe — rows, picked states, counter, legend, curve paths,
 *  jump buttons, live badges (Task 62 surface) */
const dialogProbe = (ids) => J(`(() => {
  const list = document.querySelector('[data-testid=fsc-compare-list]');
  if (!list) return null;
  const rows = [...list.querySelectorAll('[data-testid=fsc-compare-row]')];
  const chart = document.querySelector('[data-testid=fsc-compare-chart]');
  const byId = {};
  for (const id of ${JSON.stringify(ids)}) {
    const row = rows.find(r => r.getAttribute('data-job-id') === id);
    byId[id] = row ? {
      checked: row.querySelector('button[role=checkbox]')?.getAttribute('aria-checked') ?? null,
      res: (row.querySelector('[data-testid^=fsc-compare-res-]')?.textContent || '').trim(),
      jump: !!row.querySelector('[data-testid^=fsc-compare-jump-]'),
      live: !!row.querySelector('[data-testid=fsc-compare-live]'),
      text: row.textContent.replace(/\\s+/g, ' ').trim(),
    } : null;
  }
  return {
    rowCount: rows.length,
    byId,
    counter: [...document.querySelectorAll('[role=dialog]')].map(d => (d.textContent.match(/\\d+\\/6/) || [])[0]).find(Boolean) ?? null,
    lines: chart ? chart.querySelectorAll('.recharts-line-curve').length : -1,
    legend: [...document.querySelectorAll('[data-testid^=fsc-compare-legend-]')].map(b => ({
      id: b.getAttribute('data-testid').replace('fsc-compare-legend-', ''),
      pressed: b.getAttribute('aria-pressed'),
      text: b.textContent.replace(/\\s+/g, ' ').trim(),
    })),
    rescan: !!document.querySelector('[data-testid=fsc-compare-rescan]'),
    liveBadges: list.querySelectorAll('[data-testid=fsc-compare-live]').length,
  };
})()`);

/** per-curve strokeOpacity/strokeWidth keyed by palette stroke color */
const curveOps = () => J(`(() => {
  const chart = document.querySelector('[data-testid=fsc-compare-chart]');
  if (!chart) return null;
  return [...chart.querySelectorAll('path.recharts-line-curve')].map(p => ({
    stroke: p.getAttribute('stroke'),
    opacity: getComputedStyle(p).strokeOpacity,
    width: getComputedStyle(p).strokeWidth,
  }));
})()`);

const opOf = (ops, stroke) => {
  const hit = (ops || []).find((o) => (o.stroke || "").toLowerCase() === stroke.toLowerCase());
  return hit ? hit.opacity : null;
};
const widthOf = (ops, stroke) => {
  const hit = (ops || []).find((o) => (o.stroke || "").toLowerCase() === stroke.toLowerCase());
  return hit ? hit.width : null;
};

const COMPLETED = ["QA Post 300", "QA Post 320", "QA Post 385", "QA Refine 410"];

/** toggle a row checkbox by job id (JS click + aria-checked verify) */
const toggleRow = async (id, want) => {
  for (let i = 0; i < 3; i++) {
    unq(evalJs(`(() => {
      const row = document.querySelector('[data-testid=fsc-compare-row][data-job-id=${id}]');
      if (!row) return 'NO-ROW';
      const cb = row.querySelector('button[role=checkbox]');
      if (!cb) return 'NO-CB';
      cb.click();
      return 'clicked';
    })()`));
    await sleep(500);
    const got = unq(evalJs(`(() => {
      const row = document.querySelector('[data-testid=fsc-compare-row][data-job-id=${id}]');
      return row ? (row.querySelector('button[role=checkbox]')?.getAttribute('aria-checked') ?? 'NONE') : 'NO-ROW';
    })()`));
    if (got === want) return "verified";
    step(`  toggleRow(${id} → ${want}) retry ${i}: got ${got}`);
    await sleep(600);
  }
  return "FAILED";
};

const closeCompareEsc = async () => {
  evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-testid=fsc-compare-list]'));
    if (dl) dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'esc';
  })()`);
  await sleep(700);
  return unq(evalJs(`(() => !document.querySelector('[data-testid=fsc-compare-list]'))() + ''`)) === "true";
};

const closeInspector = async (jobName) => {
  // Radix close button in the inspector modal header
  const r = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${jobName}'));
    if (!dl) return 'NO-MODAL';
    const btn = dl.querySelector('button[aria-label*="lose"], button[title*="lose"]') ||
      [...dl.querySelectorAll('button')].find(b => (b.querySelector('svg.lucide-x')));
    if (!btn) return 'NO-CLOSE';
    btn.click();
    return 'clicked';
  })()`));
  await sleep(900);
  const gone = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${jobName}'));
    return dl ? 'false' : 'true';
  })() + ''`));
  if (r === "clicked" && gone === "true") return true;
  step(`  closeInspector: ${r} gone=${gone}`);
  return false;
};

const parseRes = (s) => {
  const m = (s || "").match(/([\d.]+)\s*Å/);
  return m ? parseFloat(m[1]) : null;
};

// ============================================================ phase A
async function phaseA() {
  step("== PHASE A: hover highlight + live badge + re-scan affordance ==");
  if (!(await bootCanvas())) FATAL("canvas never appeared");
  // a stale persisted selection would pre-tick rows and poison the
  // toggle dance — the compare restore reads this key at OPEN time
  clearCompareStorage();
  if (!(await openInspector())) FATAL("inspector modal for QA Post 320 never appeared");
  if (!(await waitFor(async () => fscSection() === "YES", "FSC section"))) FATAL("FSC section never rendered");

  const ids = await jobIdsByName();
  const pal = await paletteByJob();
  step(`  ids: ${JSON.stringify(ids)}`);
  step(`  palette: ${JSON.stringify(pal)}`);
  const all = Object.values(ids).filter(Boolean);
  must(Object.values(ids).every(Boolean), "all five seeded jobs resolve by name");

  const { open } = await openCompare();
  must(open, "compare dialog opens");

  let p = await waitFor(async () => (await dialogProbe(all))?.rowCount >= 5, "index rows (5)");
  must(p, "index lists 5 rows (4 completed + 1 running)");
  p = await dialogProbe(all);
  must(p.liveBadges === 1, `exactly one pulsing live badge (got ${p.liveBadges})`);
  must(p.byId[ids["QA Refine Live"]]?.live === true, "live badge sits on the QA Refine Live row");
  must((p.byId[ids["QA Refine Live"]].text.match(/half-maps/) || []).length === 1, "live row carries half-maps badge");
  must(p.byId[ids["QA Refine Live"]].jump === true, "running row exposes a jump button too");
  must(p.rescan === true, "header re-scan button present");

  // host preselected (storage was wiped), others unticked
  must(p.byId[ids[HOST_JOB]]?.checked === "true", "host job (QA Post 320) preselected");
  must(p.counter === "1/6", `count chip reads 1/6 (got ${p.counter})`);

  // tick the other three completed → 4 curves
  for (const name of ["QA Post 300", "QA Post 385", "QA Refine 410"]) {
    must((await toggleRow(ids[name], "true")) === "verified", `ticked ${name}`);
  }
  must((await waitFor(async () => {
    const d = await dialogProbe(all);
    return d && d.lines >= 4;
  }, "4 curves")), "overlay draws 4 curves");

  // ---- baseline: every curve full opacity ----
  let ops = await curveOps();
  must(ops && ops.length === 4, `4 curve paths probed (got ${ops?.length})`);
  for (const name of COMPLETED) {
    must(opOf(ops, pal[ids[name]]) === "1", `baseline ${name} opacity 1 (got ${opOf(ops, pal[ids[name]])})`);
  }

  // ---- hover the QA Post 300 ROW → its curve bolds, others dim ----
  const h1 = await hoverAt(
    `document.querySelector('[data-testid=fsc-compare-row][data-job-id=${ids["QA Post 300"]}]')`,
  );
  must(h1.includes("hovered@"), "row hover dispatched (CDP mouse move)");
  await sleep(600);
  ops = await curveOps();
  const s300 = pal[ids["QA Post 300"]];
  must(opOf(ops, s300) === "1", `hovered 300 stays opacity 1 (got ${opOf(ops, s300)})`);
  must(widthOf(ops, s300) === "3px", `hovered 300 bolds to 3px (got ${widthOf(ops, s300)})`);
  for (const name of ["QA Post 320", "QA Post 385", "QA Refine 410"]) {
    must(opOf(ops, pal[ids[name]]) === "0.15", `${name} dims to 0.15 (got ${opOf(ops, pal[ids[name]])})`);
  }
  // the hovered row's legend chip gets the highlight ring
  const ringOn = unq(evalJs(`(() => {
    const b = document.querySelector('[data-testid=fsc-compare-legend-${ids["QA Post 300"]}]');
    return b ? (b.className.includes('ring-1') ? 'RINGED' : 'NO-RING') : 'NO-CHIP';
  })() + ''`));
  must(ringOn === "RINGED", "hovering the row rings its legend chip");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa62-hover.png`);
  step("  screenshot: qa62-hover.png (3 dimmed + hovered bold)");

  // ---- mouse away → all restored ----
  sh(`${AB} mouse move 10 10`);
  await sleep(600);
  ops = await curveOps();
  must(opOf(ops, s300) === "1" && widthOf(ops, s300) === "2px", "mouse away restores opacity + width");
  must(opOf(ops, pal[ids["QA Post 320"]]) === "1", "mouse away restores the others");

  // ---- hover the 385 LEGEND chip → its curve bolds, others dim ----
  const s385 = pal[ids["QA Post 385"]];
  const h2 = await hoverAt(
    `document.querySelector('[data-testid=fsc-compare-legend-${ids["QA Post 385"]}]')`,
  );
  must(h2.includes("hovered@"), "legend hover dispatched");
  await sleep(600);
  ops = await curveOps();
  must(opOf(ops, s385) === "1" && widthOf(ops, s385) === "3px", "legend hover bolds 385");
  must(opOf(ops, s300) === "0.15" && opOf(ops, pal[ids["QA Refine 410"]]) === "0.15", "legend hover dims 300 + 410");

  // ---- keyboard parity: FOCUS the 410 legend chip ----
  const s410 = pal[ids["QA Refine 410"]];
  sh(`${AB} mouse move 10 10`);
  await sleep(400);
  evalJs(`(() => {
    const b = document.querySelector('[data-testid=fsc-compare-legend-${ids["QA Refine 410"]}]');
    if (b) b.focus();
    return 'focused';
  })()`);
  await sleep(600);
  ops = await curveOps();
  must(opOf(ops, s410) === "1" && widthOf(ops, s410) === "3px", "keyboard FOCUS bolds 410 (a11y parity)");
  must(opOf(ops, s300) === "0.15", "focus dims 300 too");
  evalJs(`(() => { const b = document.querySelector('[data-testid=fsc-compare-legend-${ids["QA Refine 410"]}]'); if (b) b.blur(); return 'blurred'; })()`);
  await sleep(400);
  ops = await curveOps();
  must(opOf(ops, s410) === "1" && opOf(ops, s300) === "1", "blur restores everything");

  // ---- unpicked row hover must NOT dim the world ----
  const h3 = await hoverAt(
    `document.querySelector('[data-testid=fsc-compare-row][data-job-id=${ids["QA Refine Live"]}]')`,
  );
  must(h3.includes("hovered@"), "unpicked live-row hover dispatched");
  await sleep(500);
  ops = await curveOps();
  must(opOf(ops, s300) === "1" && opOf(ops, s410) === "1", "hovering a curve-less row dims NOTHING (guard)");
  sh(`${AB} mouse move 10 10`);
}

// ============================================================ phase B
async function phaseB() {
  step("== PHASE B: jump-to-job + re-scan ==");
  const ids = await jobIdsByName();
  const all = Object.values(ids).filter(Boolean);

  // dialog should still be open from phase A (same browser session);
  // a standalone B run starts with a fresh browser (A's tail closes the
  // daemon) — rebuild phase A's end state first: clear storage, open the
  // inspector + dialog, tick the other three so localStorage carries the
  // same [320,300,385,410] selection the jump asserts rely on
  let p = await dialogProbe(all);
  if (!p) {
    if (!(await bootCanvas())) FATAL("canvas never appeared (B setup)");
    clearCompareStorage();
    if (!(await openInspector())) FATAL("inspector never appeared (B setup)");
    if (!(await waitFor(async () => fscSection() === "YES", "FSC section (B setup)"))) FATAL("no FSC section (B setup)");
    const { open: openA } = await openCompare();
    must(openA, "compare dialog opens (B setup)");
    await waitFor(async () => (await dialogProbe(all))?.rowCount >= 5, "rows (B setup)");
    for (const name of ["QA Post 300", "QA Post 385", "QA Refine 410"]) {
      must((await toggleRow(ids[name], "true")) === "verified", `B setup ticked ${name}`);
    }
    must(await waitFor(async () => {
      const d = await dialogProbe(all);
      return d && d.lines >= 4;
    }, "B setup 4 curves"), "B setup: 4 curves drawn");
    p = await dialogProbe(all);
  }

  // ---- click the jump button on QA Post 300's row ----
  evalJs(`(() => {
    const b = document.querySelector('[data-testid=fsc-compare-jump-${ids["QA Post 300"]}]');
    if (!b) return 'NO-BTN';
    b.click();
    return 'jumped';
  })()`);
  await sleep(1500);

  // dialog peeled, inspector switched to QA Post 300, FSC card present
  const gone = unq(evalJs(`(() => !document.querySelector('[data-testid=fsc-compare-list]'))() + ''`));
  must(gone === "true", "compare dialog closes on jump");
  const modal = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('QA Post 300'));
    return dl ? 'MODAL-300' : 'NONE';
  })() + ''`));
  must(modal === "MODAL-300", "inspector modal now shows QA Post 300");
  const oldGone = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}') && (d.textContent||'').includes('Compare FSC curves'));
    return dl ? 'false' : 'true';
  })() + ''`));
  must(oldGone === "true", "no compare dialog for the old host lingers");
  must((await waitFor(async () => fscSection() === "YES", "FSC section of Post 300")), "Post 300's FSC card rendered");

  // ---- reopen compare: (this job) marker moved, selection restored ----
  const { open } = await openCompare();
  must(open, "compare dialog reopens under the NEW host");
  p = await waitFor(async () => {
    const d = await dialogProbe(all);
    return d && d.lines >= 4;
  }, "restored 4 curves");
  must(p, "localStorage restore re-ticks all four under new host");
  p = await dialogProbe(all);
  must(p.counter === "4/6", `count chip reads 4/6 (got ${p.counter})`);
  must((p.byId[ids["QA Post 300"]].text.match(/this job/) || []).length === 1, "(this job) marker moved to QA Post 300");
  must((p.byId[ids[HOST_JOB]].text.match(/this job/) || []).length === 0, "old host row no longer carries the marker");
  must(p.byId[ids[HOST_JOB]].jump === true, "old host row became a jump button");
  must(p.byId[ids["QA Post 300"]].jump === false, "new host row has no jump button");
  const res300 = parseRes(p.byId[ids["QA Post 300"]].res);
  must(res300 != null && Math.abs(res300 - 3.0) <= 0.15, `new host row shows its own 0.143 ≈ 3.0 Å (got ${res300})`);

  // ---- re-scan: curves dropped and re-read, rows survive ----
  evalJs(`(() => {
    const b = document.querySelector('[data-testid=fsc-compare-rescan]');
    if (!b) return 'NO-BTN';
    b.click();
    return 'rescanning';
  })()`);
  await sleep(400);
  const mid = unq(evalJs(`(() => {
    // either still scanning (list present, chart possibly gone) or already done
    return document.querySelector('[data-testid=fsc-compare-list]') ? 'LIST-OK' : 'NO-LIST';
  })() + ''`));
  must(mid === "LIST-OK", "list survives the re-scan");
  p = await waitFor(async () => {
    const d = await dialogProbe(all);
    return d && d.lines >= 4 && d.rowCount >= 5;
  }, "re-scan repopulates");
  must(p, "after re-scan: 5 rows + 4 curves back");
  p = await dialogProbe(all);
  must(p.counter === "4/6", `selection survives re-scan (got ${p.counter})`);
}

// ============================================================ phase C
async function phaseC() {
  step("== PHASE C: console + cleanup ==");
  const errs = errCount();
  must(errs === "0", `0 page errors (got ${errs})`);
  step("cleanup: seed --clean (also deletes the live job)");
  try { sh(SEED_CLEAN); } catch (e) { step(`cleanup warn: ${String(e).slice(0, 120)}`); }
  // verify the live job is really gone
  const ids = await jobIdsByName();
  must(ids["QA Refine Live"] === null, "QA Refine Live deleted from the canvas");
}

// ============================================================ main
const phases = { A: phaseA, B: phaseB, C: phaseC };
(async () => {
  for (const ph of PHASES) {
    if (ph === "C") { await phaseC(); continue; }
    await phases[ph]();
  }
  sh(`${AB} close`);
  step("ALL GREEN");
})().catch((e) => { step(`fatal: ${e.message}`); try { sh(`${AB} close`); } catch {} process.exit(1); });
