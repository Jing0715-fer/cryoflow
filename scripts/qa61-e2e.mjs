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
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
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
// self-seeded host (Task 86 doctrine): a throwaway refine3d row created at
// setup — its default label is "3D Auto-Refine N" (count-suffixed, so the
// REAL name is captured from the POST response) and it is deleted at exit.
// The suite only OPENS the inspector (dialogs are opened and peeled; the
// job itself is never mutated). The old hardcoded "3D Auto-Refine 1"
// pointed at a world generation that no longer exists.
let hostJob = "";
let hostJobId = "";
const seedHost = () => {
  // the canvas renders the ACTIVE workspace's jobs only — a host row
  // without workspaceId is an orphan (dashboard "Unassigned" roster) and
  // NEVER appears as a card (the hard way: six NO-CARD iters, Task 101).
  // The custom name is also load-bearing: numbered defaults collide with
  // rows leaked by crashed runs, and clickCard's first-match would hit the
  // idle leak instead of the completed host (the second hard way).
  const wsId = ((JSON.parse(sh(`curl -s ${B}/api/workspaces`)).workspaces) || [])[0]?.id ?? "";
  if (!wsId) FATAL("no workspace to host the seed job");
  // drop the host BELOW the world's bbox (t98 doctrine: the empty band is
  // the one spot fit-all always frames and no neighbor card intercepts)
  const jobs = JSON.parse(sh(`curl -s ${B}/api/jobs`));
  const list = Array.isArray(jobs) ? jobs : (jobs.jobs ?? []);
  const maxY = list.reduce((m, j) => Math.max(m, (j.y ?? 0) + 260), 800);
  const created = JSON.parse(sh(`curl -s -X POST ${B}/api/jobs -H "Content-Type: application/json" -d '{"type":"refine3d","name":"qa61 Host","workspaceId":"${wsId}","x":140,"y":${maxY + 260}}'`));
  const j = created?.job ?? created;
  hostJobId = j?.id ?? "";
  hostJob = j?.name ?? "";
  if (!hostJobId || !hostJob) FATAL("host job seed failed");
  // an IDLE job's click opens the side editing panel (invisible on the xl
  // viewport this suite runs at) — only a SUBMITTED job opens the big
  // inspector modal the layer-peel matrix peels. PATCH only allows
  // status:"idle" (reset), so flip completed straight in the DB — the same
  // mechanism qa58-seed-gallery.py uses ("the row is the source of truth
  // for status, the workdir for output"). VERIFY the flip: a silently
  // no-op'd status write turns the whole suite into a dead-key walk.
  sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:'${hostJobId}'},data:{status:'completed',progress:100}}).then(()=>p.\\$disconnect())"`);
  const st = (JSON.parse(sh(`curl -s ${B}/api/jobs`))?.jobs ?? []).find((x) => x.id === hostJobId)?.status;
  if (st !== "completed") FATAL(`host status flip failed (got ${st})`);
  // Results-tab volume enlarge needs a Sharpened map on disk AND an
  // engine-state record (outputs route reads getRun(id).workdir — a row
  // without one reports "job has not run yet", the third hard way). Write
  // a 64³ mode-2 float32 gradient (qa67's MRC dialect) + register.
  const proj = j.projectId;
  const tail = hostJobId.slice(-8);
  const wd = `/home/z/my-project/data/relion/${proj}/refine3d_${tail}`;
  mkdirSync(wd, { recursive: true });
  const N = 64;
  const hdr = Buffer.alloc(1024);
  hdr.writeInt32LE(N, 0); hdr.writeInt32LE(N, 4); hdr.writeInt32LE(N, 8);
  hdr.writeInt32LE(2, 12);                       // mode 2 = float32
  hdr.writeInt32LE(N, 28); hdr.writeInt32LE(N, 32); hdr.writeInt32LE(N, 36);
  hdr.writeFloatLE(1.77 * N, 40); hdr.writeFloatLE(1.77 * N, 44); hdr.writeFloatLE(1.77 * N, 48);
  hdr.writeFloatLE(90, 52); hdr.writeFloatLE(90, 56); hdr.writeFloatLE(90, 60);
  hdr.writeInt32LE(1, 64); hdr.writeInt32LE(2, 68); hdr.writeInt32LE(3, 72);
  hdr.writeFloatLE(0, 76); hdr.writeFloatLE(1, 80);
  const voxels = Buffer.alloc(N * N * N * 4);
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        voxels.writeFloatLE((x + y + z) / (3 * N), (z * N * N + y * N + x) * 4);
  writeFileSync(`${wd}/postprocess.mrc`, Buffer.concat([hdr, voxels]));
  const statePath = "/home/z/my-project/data/engine-state.json";
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  state[hostJobId] = {
    jobId: hostJobId, projectId: proj, type: "refine3d", pid: null,
    cmd: "qa61 seed (layer-peel host)", workdir: wd,
    logFile: `${wd}/run.out`, errFile: `${wd}/run.err`,
    startedAt: new Date().toISOString(), outputs: {}, done: true, exitCode: 0,
  };
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  // self-verify through the SAME api the Results tab reads — the button
  // renders only when the outputs route labels postprocess.mrc
  const outs = JSON.parse(sh(`curl -s ${B}/api/jobs/${hostJobId}/outputs`));
  const hasMap = (outs.files ?? []).some((f) => f.label === "Sharpened map");
  if (!hasMap) FATAL("outputs api does not list a Sharpened map for the host");
  step(`  host seeded: ${hostJob} (${hostJobId}, completed, sharpened map on disk)`);
};
const hostCleanup = () => {
  if (!hostJobId) return;
  try {
    const code = sh(`curl -s -X DELETE ${B}/api/jobs/${hostJobId} -o /dev/null -w "%{http_code}"`);
    step(`  host deleted (got ${code})`);
  } catch (e) { step(`  host cleanup warn: ${String(e).slice(0, 100)}`); }
  // DELETE does not sweep disk (t97 doctrine) — the workdir and the
  // engine-state record are ours, so remove them here
  try {
    const statePath = "/home/z/my-project/data/engine-state.json";
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      if (state[hostJobId]) {
        const wd = state[hostJobId]?.workdir;
        delete state[hostJobId];
        writeFileSync(statePath, JSON.stringify(state, null, 2));
        if (wd) rmSync(wd, { recursive: true, force: true });
      }
    }
  } catch (e) { step(`  host state cleanup warn: ${String(e).slice(0, 100)}`); }
  hostJobId = "";
};
const FATAL = (msg) => { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); hostCleanup(); process.exit(1); };
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
  // the daemon relaunch RACES set-viewport — a lost race leaves the page on
  // the default 1600px window, where phase B's narrow-Sheet flow silently
  // becomes the xl inspector flow (both have a Params tab; the sheet probe
  // then crashes on undefined). Verify the width actually applied.
  const wantW = viewport.split(" ")[0];
  for (let i = 0; i < 5; i++) {
    const gotW = unq(evalJs(`String(window.innerWidth)`));
    if (gotW === wantW) break;
    step(`  viewport race (want ${wantW}, got ${gotW}) — re-applying`);
    sh(`${AB} set viewport ${viewport}`);
    await sleep(1200);
  }
  evalJs(errCollector);
  for (let i = 0; i < 10; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${hostJob}'));
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
  seedHost();
  if (!(await boot("1600 900"))) FATAL("canvas never appeared");
  if (!(await clickCard(hostJob))) FATAL("inspector never opened");

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
  try {
    for (const ph of PHASES) await phases[ph]();
    sh(`${AB} close`);
    step("ALL GREEN");
  } finally {
    // the deletion must HAPPEN, not be attempted — a leftover host row
    // would pollute every suite after us (t100 Z doctrine)
    hostCleanup();
  }
})().catch((e) => { step(`fatal: ${e.message}`); try { sh(`${AB} close`); } catch {} hostCleanup(); process.exit(1); });
