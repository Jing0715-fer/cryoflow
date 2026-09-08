// Task 61 QA — systematic Escape-peels-one-layer fix across the floating-
// layer tower. Every Radix Dialog/AlertDialog/Popover root owns its own
// dismissable-layer stack (no shared provider), so BEFORE this round one
// Esc press dismissed the whole tower (verified live: inspector's Re-run
// alert + volume dialog both killed the inspector behind them).
//
// Fixed sites (onKeyDown={onEscapeClose(...)} — React-level consume stops
// the event at the root container, before any document-level Radix listener):
//   results-view image/star/text dialogs, mol-viewer fullscreen, picks-map /
//   ctf-quality-chart / import-gallery / particle-browser zooms, molstar
//   import-views dialog, job-inspector Re-run alert, path-browser, hpc-sbatch
//   + the five molstar popovers (converted to CONTROLLED open state so the
//   consume handler can close exactly themselves)
//
//   A  MATRIX (inspector modal of "3D Auto-Refine 1", 1600×900):
//      1 Re-run alert → Esc: alert gone, inspector alive
//      2 Results → enlarge volume → Esc: dialog gone, inspector alive
//      3 → View in 3D fullscreen → Esc: viewer gone, inspector alive
//      4 fullscreen → turntable popover → Esc: popover gone, viewer alive
//        (skip-with-warning if the CryoFlow toolbar never renders headless)
//   B  NARROW SHEET (1200×800, idle "QA Esc Import" job): panel lives in a
//      Radix Sheet → Params → Browse → path-browser → Esc: dialog gone,
//      SHEET alive (the pre-fix behavior closed both)
//   C  CONSOLE: 0 page errors
// Usage: QA_PHASES=A node scripts/qa61-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = "/home/z/my-project/.qa-logs/qa61-trace.log";
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
const HOST_JOB = "3D Auto-Refine 1";
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
// bare "0" through JSON.parse becomes the number 0 — unq only, no J
const errCount = () => unq(evalJs(`String((window.__qaErrs||[]).length)`));

const stackProbe = () => J(`(() => {
  const dlgs = [...document.querySelectorAll('[role=dialog]')];
  return {
    inspector: dlgs.some(d => (d.textContent||'').includes('job inspector')),
    alert: document.querySelectorAll('[role=alertdialog]').length,
    volume: dlgs.some(d => (d.textContent||'').includes('Central slice')),
    viewer: dlgs.some(d => (d.textContent||'').includes('Isosurface render')),
    sheet: dlgs.some(d => (d.textContent||'').includes('Job details')),
    path: dlgs.some(d => (d.textContent||'').includes('Browse') && (d.textContent||'').includes('folder')),
    popovers: document.querySelectorAll('[data-radix-popper-content-wrapper]').length,
    turntablePop: !!document.querySelector('[data-canvas-ui=turntable-popover]'),
    dialogCount: dlgs.length,
  };
})()`);

const clickCard = async (name) => {
  for (let i = 0; i < 6; i++) {
    unq(evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${name}'));
      if (!card) return 'NO-CARD';
      card.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      card.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return 'clicked';
    })()`));
    await sleep(1800);
    const p = stackProbe();
    if (p.inspector || p.sheet) return true;
    step(`  clickCard(${name}) iter ${i}`);
  }
  return false;
};

// coordinate click — panel-body Radix tabs ignore JS el.click() (qa59 lesson:
// 'openSelectPanel' needed realClick for the Params tab)
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

const pressEscOn = (findExpr) => {
  evalJs(`(() => {
    const el = (${findExpr});
    if (!el) return 'NO-EL';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'esc';
  })()`);
  return sleep(1000);
};

const boot = async (viewport) => {
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport ${viewport}`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  evalJs(errCollector);
  for (let i = 0; i < 10; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'));
      const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
      return (card ? 'CARD' : 'WAIT') + (dash ? '+DASH' : '');
    })()`);
    if (probe.includes("CARD")) return true;
    if (probe.includes("DASH")) {
      evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
      step(`  boot: dashboard → canvas (Shift+D), iter ${i}`);
    }
    await sleep(2200);
  }
  return false;
};

// ============================================================ phase A
async function phaseA() {
  step("== PHASE A: layer-peel matrix on the inspector modal ==");
  if (!(await boot("1600 900"))) FATAL("canvas never appeared");
  if (!(await clickCard(HOST_JOB))) FATAL("inspector never opened");

  // --- 1: Re-run AlertDialog ---
  const r1 = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('job inspector'));
    const btn = [...dl.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Re-run'));
    if (!btn) return 'NO-BTN';
    btn.click();
    return 'opened';
  })()`));
  await sleep(1200);
  let p = stackProbe();
  must(r1 === "opened" && p.alert === 1, "Re-run confirm alert opens on top of the inspector");
  await pressEscOn(`document.querySelector('[role=alertdialog]')`);
  p = stackProbe();
  must(p.alert === 0, "Esc closes the alert");
  must(p.inspector, "inspector SURVIVES the alert's Escape (pre-fix: both died)");

  // --- 2: volume enlarge dialog ---
  const r2 = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('job inspector'));
    const tab = [...dl.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === 'Results');
    if (!tab) return 'NO-TAB';
    tab.click();
    return 'tab';
  })()`));
  await sleep(2500);
  must(r2 === "tab", "Results tab opens");
  const r3 = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('job inspector'));
    const btn = [...dl.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').startsWith('Click to enlarge — Sharpened map'));
    if (!btn) return 'NO-BTN';
    btn.click();
    return 'clicked';
  })()`));
  await sleep(2500);
  p = stackProbe();
  must(r3 === "clicked" && p.volume, "volume enlarge dialog opens");
  await pressEscOn(`[...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Central slice'))`);
  p = stackProbe();
  must(!p.volume, "Esc closes the volume dialog");
  must(p.inspector, "inspector SURVIVES the volume dialog's Escape");

  // --- 3: fullscreen Mol* viewer ---
  const r4 = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('job inspector'));
    const btn = [...dl.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').startsWith('Click to enlarge — Sharpened map'));
    if (!btn) return 'NO-BTN';
    btn.click();
    return 'clicked';
  })()`));
  await sleep(2000);
  const r5 = unq(evalJs(`(() => {
    const vol = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Central slice'));
    const btn = [...vol.querySelectorAll('button')].find(b => (b.textContent||'').includes('View in 3D'));
    if (!btn) return 'NO-BTN';
    btn.click();
    return 'clicked';
  })()`));
  await sleep(6000);
  p = stackProbe();
  must(r4 === "clicked" && r5 === "clicked" && p.viewer, "fullscreen Mol* viewer opens (3 layers deep)");

  // --- 4: turntable popover inside the viewer (toolbar may need extra time) ---
  let popok = false;
  for (let i = 0; i < 10 && !popok; i++) {
    await sleep(2500);
    popok = unq(evalJs(`(() => !![...document.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').startsWith('Turntable video')))() + ''`)) === "true";
  }
  if (popok) {
    unq(evalJs(`(() => {
      const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').startsWith('Turntable video'));
      t.click();
      return 'clicked';
    })()`));
    await sleep(1200);
    p = stackProbe();
    must(p.turntablePop, "turntable popover opens inside the fullscreen viewer");
    await pressEscOn(`document.querySelector('[data-canvas-ui=turntable-popover]')`);
    p = stackProbe();
    must(!p.turntablePop, "Esc closes the popover");
    must(p.viewer && p.inspector, "viewer AND inspector SURVIVE the popover's Escape");
  } else {
    step("  WARN: CryoFlow toolbar never rendered headless — popover combo covered by controlled-conversion code path, not asserted live");
  }

  // --- peel the tower manually: Esc on viewer, then close inspector ---
  await pressEscOn(`[...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Isosurface render'))`);
  p = stackProbe();
  must(!p.viewer && p.inspector, "Esc on the fullscreen viewer leaves the inspector alive");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa61-inspector-alive.png`);
}

// ============================================================ phase B
async function phaseB() {
  step("== PHASE B: narrow Sheet — path-browser peels without killing the Sheet ==");
  // idle import job so the narrow viewport opens the SHEET (not inspector)
  const res = await fetch(`${B}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "import", x: 1200, y: 560 }),
  });
  const body = await res.json();
  const job = body.job ?? body;
  await fetch(`${B}/api/jobs/${job.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "QA Esc Import" }),
  });
  step(`  idle import job: ${job.id}`);

  if (!(await boot("1200 800"))) FATAL("canvas never appeared (narrow)");
  if (!(await clickCard("QA Esc Import"))) FATAL("sheet never opened");

  // Movies/mics fields live under the Params tab (I/O is the default);
  // panel-body Radix tabs need a COORDINATE click (JS click is a no-op —
  // the qa59 openSelectPanel lesson)
  for (let i = 0; i < 5; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=dialog]')].flatMap(d => [...d.querySelectorAll('[role=tab]')]).find(t => t.textContent.trim() === 'Params')`,
    );
    await sleep(900);
    const active = unq(evalJs(`(() => {
      const sheet = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Job details'));
      return (([...(sheet?.querySelectorAll('[role=tab]') ?? [])].find(t => t.getAttribute('aria-selected') === 'true')||{}).textContent||'NONE').trim();
    })()`));
    if (active === "Params") break;
    step(`  params-tab attempt ${i}: ${r} active=${active}`);
  }
  let opened = false;
  for (let i = 0; i < 5 && !opened; i++) {
    unq(evalJs(`(() => {
      const sheet = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('Job details'));
      const btn = [...sheet.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('Browse') || (b.getAttribute('title')||'').includes('Browse'));
      if (!btn) return 'NO-BROWSE';
      btn.click();
      return 'clicked';
    })()`));
    await sleep(1500);
    opened = unq(evalJs(`(() => {
      const dlgs = [...document.querySelectorAll('[role=dialog]')];
      return dlgs.length >= 2 ? 'true' : 'false';
    })() + ''`)) === "true";
    step(`  browse attempt ${i}: ${opened}`);
  }
  must(opened, "path-browser dialog opens on top of the Sheet");
  const p0 = stackProbe();
  must(p0.sheet, "Sheet still alive under the path-browser");

  await pressEscOn(`[...document.querySelectorAll('[role=dialog]')].filter(d => !(d.textContent||'').includes('Job details'))[0]`);
  const p = stackProbe();
  must(!p.path || p.dialogCount === 1, "Esc closes the path-browser");
  must(p.sheet, "Sheet SURVIVES the path-browser's Escape (pre-fix: both died)");

  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa61-sheet-alive.png`);
}

// ============================================================ phase C
async function phaseC() {
  step("== PHASE C: console ==");
  const errs = errCount();
  must(errs === "0", `0 page errors (got ${errs})`);
}

const phases = { A: phaseA, B: phaseB, C: phaseC };
(async () => {
  for (const ph of PHASES) await phases[ph]();
  sh(`${AB} close`);
  step("ALL GREEN");
})().catch((e) => { step(`fatal: ${e.message}`); try { sh(`${AB} close`); } catch {} process.exit(1); });
