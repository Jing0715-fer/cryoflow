// Task 60 QA — project-wide FSC comparison overlay.
//
// Seed: four FSC-bearing jobs on DIFFERENT resolution grids
//   QA Post 300   postprocess  corrected 0.143 @ ~3.00 Å  (45 shells, Nyq 2.78)
//   QA Post 320   postprocess  corrected 0.143 @ ~3.20 Å  (41 shells, Nyq 2.86)
//   QA Post 385   postprocess  corrected 0.143 @ ~3.85 Å  (31 shells, Nyq 3.33)
//   QA Refine 410 refine3d     gold-std  0.143 @ ~4.10 Å  (24 shells, Nyq 3.57)
//
//   A  OVERLAY: open QA Post 320's inspector → FSC card shows the compare
//      chip → dialog lists all 4 index rows (badges postprocess/half-maps,
//      "(this job)" marker) → tick the other three → per-row 0.143 values
//      land ≈ 3.00/3.85/4.10 (tolerance 0.15) → overlay chart draws 4
//      curves + count chip 4/6 + 4 legend chips with Å values → screenshot
//   B  PERSISTENCE: legend chip hides/shows a curve (line count follows) →
//      close dialog + close inspector → reopen inspector (FscChart
//      remounts) → reopen compare: 4 picked again (localStorage restore)
//   C  CONSOLE: 0 page errors → cleanup (seed --clean)
// Usage: QA_PHASES=A node scripts/qa60-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";
// Task 117: evals ride the shared transport — death detection across the
// four live-reproduced signatures (crash exit-1 / wedged hang / silent
// blank-page ""), one close→open→sentinel recovery ladder, then a tagged
// error on double death. See scripts/lib/browser-transport.mjs.
import { makeTransport } from "./lib/browser-transport.mjs";

const AB = "agent-browser";
const LOGF = "/home/z/my-project/.qa-logs/qa60-trace.log";
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
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

const B = "http://localhost:3000";
// single-source transport (Task 117): 15s hang ceiling replaces the old
// 120s per-eval slow-motion death; recovery ladder + CryoFlow-title
// sentinel per scripts/lib/browser-transport.mjs
const { evalJs, J } = makeTransport({ url: B, log: step });
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
// unq only (the qa58/qa57 trap: `J(...) === "0"` is always false)
const errCount = () => unq(evalJs(`String((window.__qaErrs||[]).length)`));

/** job ids by name, straight from the API (row targeting uses data-job-id) */
async function jobIdsByName() {
  const res = await fetch(`${B}/api/jobs`);
  const body = await res.json();
  const jobs = body.jobs ?? body;
  const out = {};
  for (const n of ["QA Post 300", "QA Post 320", "QA Post 385", "QA Refine 410"]) {
    out[n] = (jobs.find((j) => j.name === n) || {}).id ?? null;
  }
  return out;
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

/** find-reach (t144 hardening): bring the target card to the viewport
 *  CENTER through the lens before any click — boot fit frames whatever
 *  world it is handed, and a top-area card can sit lawfully under the
 *  pipeline KPI bar (Task 143 forensics, Task 144 residue incident).
 *  Coordinates are never trusted; Ctrl+F → name → Enter = focusJob
 *  centered + legibility zoom, Esc leaves the view there. */
const reachViaFind = async (name) => {
  sh(`${AB} press Control+f`);
  await sleep(500);
  sh(`${AB} type '[data-testid="canvas-find-input"]' '${name}'`);
  await sleep(700);
  sh(`${AB} press Enter`);
  await sleep(1200);
  sh(`${AB} press Escape`);
  await sleep(500);
};

const bootCanvas = async () => {
  // zombie page first — stale params auto-save can overwrite fresh state
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  evalJs(errCollector);
  // Task 62 hardening: a stale persisted compare selection (left by a
  // previous QA round in the same browser profile) would pre-tick rows
  // and poison the 1/6 assert — the compare restore reads this key at
  // OPEN time, so clearing it here is enough
  evalJs(`(() => { const ks = Object.keys(localStorage).filter(k => k.startsWith('cryoflow.fsc-compare')); ks.forEach(k => localStorage.removeItem(k)); return 'cleared'; })()`);
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

const openInspector = async () => {
  await reachViaFind(HOST_JOB); // t144: center the card first — never trust the fit
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

/** dialog probe — rows, picked states, count chip, legend, curve paths */
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
      text: row.textContent.replace(/\\s+/g, ' ').trim(),
    } : null;
  }
  return {
    rowCount: rows.length,
    byId,
    countChip: (list.closest('[role=dialog]').querySelector('[role=dialog]') ? '' : ''),
    counter: [...document.querySelectorAll('[role=dialog]')].map(d => (d.textContent.match(/\\d+\\/6/) || [])[0]).find(Boolean) ?? null,
    lines: chart ? chart.querySelectorAll('.recharts-line-curve').length : -1,
    legend: [...document.querySelectorAll('[data-testid^=fsc-compare-legend-]')].map(b => ({
      id: b.getAttribute('data-testid').replace('fsc-compare-legend-', ''),
      pressed: b.getAttribute('aria-pressed'),
      text: b.textContent.replace(/\\s+/g, ' ').trim(),
    })),
  };
})()`);

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

const toggleLegend = async (id, wantPressed) => {
  for (let i = 0; i < 3; i++) {
    unq(evalJs(`(() => {
      const b = document.querySelector('[data-testid=fsc-compare-legend-${id}]');
      if (!b) return 'NO-BTN';
      b.click();
      return 'clicked';
    })()`));
    await sleep(500);
    const got = unq(evalJs(`(() => {
      const b = document.querySelector('[data-testid=fsc-compare-legend-${id}]');
      return b ? (b.getAttribute('aria-pressed') ?? 'NONE') : 'NO-BTN';
    })()`));
    if (got === wantPressed) return "verified";
    step(`  toggleLegend(${id} → ${wantPressed}) retry ${i}: got ${got}`);
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

const closeInspector = async () => {
  // Radix close button in the inspector modal header
  const r = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
    if (!dl) return 'NO-MODAL';
    const btn = dl.querySelector('button[aria-label*="lose"], button[title*="lose"]') ||
      [...dl.querySelectorAll('button')].find(b => (b.querySelector('svg.lucide-x')));
    if (!btn) return 'NO-CLOSE';
    btn.click();
    return 'clicked';
  })()`));
  await sleep(900);
  const gone = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
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
  step("== PHASE A: FSC compare overlay (index + multi-curve merge) ==");
  // self-seed (Task 86 doctrine): the seeder is idempotent — the suite must
  // not depend on who ran before it (qa60-seed-fsc.py --clean runs in Z)
  step(`  seed: ${(sh(SEED).split("\n").slice(-1)[0] ?? "").slice(0, 100)}`);
  if (!(await bootCanvas())) FATAL("canvas never appeared");
  if (!(await openInspector())) FATAL("inspector modal for QA Post 320 never appeared");
  if (!(await waitFor(async () => fscSection() === "YES", "FSC section"))) FATAL("FSC section never rendered");

  const ids = await jobIdsByName();
  step(`  ids: ${JSON.stringify(ids)}`);
  must(Object.values(ids).every(Boolean), "all four seeded jobs resolve by name");

  // compare chip exists on the FSC card → click opens the dialog
  const chip = unq(evalJs(`(() => !!document.querySelector('[data-testid=fsc-compare-open]'))() + ''`));
  must(chip === "true", "compare chip present on the FSC card");
  const { open } = await openCompare();
  must(open, "compare dialog opens");

  let p = await waitFor(async () => (await dialogProbe(Object.values(ids).filter(Boolean)))?.rowCount >= 4, "index rows");
  must(p, "index lists 4 rows");
  p = await dialogProbe(Object.values(ids).filter(Boolean));

  // host job preselected, others not (fresh browser → no persisted state)
  must(p.byId[ids[HOST_JOB]]?.checked === "true", "host job (QA Post 320) preselected");
  must(p.byId[ids["QA Post 300"]]?.checked === "false", "QA Post 300 unticked initially");
  must(p.byId[ids["QA Refine 410"]]?.checked === "false", "QA Refine 410 unticked initially");
  must(p.counter === "1/6", `count chip reads 1/6 (got ${p.counter})`);
  must((p.byId[ids[HOST_JOB]].text.match(/this job/) || []).length === 1, "host row carries the (this job) marker");
  must((p.byId[ids["QA Post 300"]].text.match(/postprocess/) || []).length >= 1, "postprocess source badge present");
  must((p.byId[ids["QA Refine 410"]].text.match(/half-maps/) || []).length === 1, "refine row carries half-maps badge");

  // tick the other three → curves fetch → per-row 0.143 values land
  for (const name of ["QA Post 300", "QA Post 385", "QA Refine 410"]) {
    must((await toggleRow(ids[name], "true")) === "verified", `ticked ${name}`);
  }
  must((await waitFor(async () => {
    const d = await dialogProbe(Object.values(ids).filter(Boolean));
    return d && d.lines >= 4;
  }, "4 curves")), "overlay draws 4 curves");

  p = await dialogProbe(Object.values(ids).filter(Boolean));
  must(p.counter === "4/6", `count chip reads 4/6 (got ${p.counter})`);
  const expect = { "QA Post 300": 3.0, "QA Post 320": 3.2, "QA Post 385": 3.85, "QA Refine 410": 4.1 };
  for (const [name, want] of Object.entries(expect)) {
    const got = parseRes(p.byId[ids[name]].res);
    must(got != null && Math.abs(got - want) <= 0.15, `${name} row shows 0.143 ≈ ${want} Å (got ${got})`);
  }
  must(p.legend.length === 4, "4 legend chips");
  const leg320 = p.legend.find(l => l.id === ids[HOST_JOB]);
  must(leg320 && leg320.pressed === "true" && /3\.2\d Å/.test(leg320.text), `legend chip for host carries name + Å (${leg320?.text})`);
  must(p.lines === 4, `4 line curves in the overlay (got ${p.lines})`);

  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa60-compare.png`);
  step("  screenshot: qa60-compare.png");
}

// ============================================================ phase B
async function phaseB() {
  step("== PHASE B: legend toggles + selection persistence ==");
  const ids = await jobIdsByName();
  const all = Object.values(ids).filter(Boolean);

  // dialog should still be open from phase A (same browser session);
  // if not, reopen through the chip
  let p = await dialogProbe(all);
  if (!p) {
    must((await openCompare()).open, "compare dialog reopens");
    await waitFor(async () => (await dialogProbe(all))?.rowCount >= 4, "rows");
    p = await dialogProbe(all);
  }

  // legend toggle hides/shows a curve without dropping the selection
  must((await toggleLegend(ids["QA Post 385"], "false")) === "verified", "legend chip hides QA Post 385");
  p = await dialogProbe(all);
  must(p.lines === 3, `hidden curve leaves the overlay (3 lines, got ${p.lines})`);
  must(p.byId[ids["QA Post 385"]].checked === "true", "row stays ticked while hidden");
  must((await toggleLegend(ids["QA Post 385"], "true")) === "verified", "legend chip shows QA Post 385 again");
  p = await dialogProbe(all);
  must(p.lines === 4, "curve returns (4 lines)");

  // close dialog + inspector → reopen → localStorage restores the pick
  must(await closeCompareEsc(), "Esc closes the compare dialog");
  must(await closeInspector(), "inspector modal closes");
  if (!(await openInspector())) FATAL("inspector did not reopen");
  if (!(await waitFor(async () => fscSection() === "YES", "FSC section after reopen"))) FATAL("FSC section missing after reopen");
  const { open: reopened } = await openCompare();
  must(reopened, "compare dialog reopens after remount");
  p = await waitFor(async () => {
    const d = await dialogProbe(all);
    return d && d.lines >= 4;
  }, "restored 4 curves");
  must(p, "localStorage restore re-ticks all four");
  p = await dialogProbe(all);
  must(p.counter === "4/6", `count chip reads 4/6 after restore (got ${p.counter})`);
}

// ============================================================ phase C
async function phaseC() {
  step("== PHASE C: console + cleanup ==");
  const errs = errCount();
  must(errs === "0", `0 page errors (got ${errs})`);
  step("cleanup: seed --clean");
  try { sh(SEED_CLEAN); } catch (e) { step(`cleanup warn: ${String(e).slice(0, 120)}`); }
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
