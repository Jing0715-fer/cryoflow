// qa64 — params A/B diff + live auto-refresh for the FSC compare dialog.
//
// Phase A: the parameter table under the overlay chart — absent for a
//          single pick, all-identical verdict for twin postprocesses,
//          one-sided/changed taxonomy as refinements join, amber hot
//          values, differences-only toggle.
// Phase B: while a running refinement is picked, the dialog polls every
//          LIVE_POLL_MS (12 s) — a new on-disk checkpoint (run_it016)
//          must surface in the UI within one cadence, fetch counters
//          prove the poll, the badge stays live.
// Phase C: console-0 across the whole journey + Esc peels one layer.
//
// Setup (idempotent, per phase): QA Refine Live's params are rewritten so
// the Live-vs-410 comparison has real changed rows (symmetry C1/D2,
// iterations 12/15, sampling 5.0/7.5); teardown restores them.
//
// Run:  QA_PHASES=A node scripts/qa64-e2e.mjs   (server on :3000)
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const AB = "agent-browser";
const B = "http://localhost:3000";
const PROJECT = "cmtrzp5x80002p8uofb9eu5pp";
const HOST_JOB = "QA Post 320";
const LIVE_WD = `/home/z/my-project/data/relion/${PROJECT}/refine3d_q8mu0tdp`;
const IT016 = `${LIVE_WD}/run_it016_model.star`;
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
let PASS = 0;
function cleanup() {
  // idempotent best-effort teardown — FATAL paths MUST run this too: a
  // leftover headless chrome on this 4 GB box degrades the next boot
  try { if (existsSync(IT016)) unlinkSync(IT016); } catch {}
  try { setLiveParams(LIVE_PARAMS_ORIG); } catch {}
  try { sh(`${AB} close`); } catch {}
}
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); cleanup(); process.exit(1); }
  PASS++;
  console.log(`  ok: ${label}`);
};

const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
const realClick = async (findExpr) => {
  // Radix Dialog's scroll-lock REVERTS programmatic scrollTop writes on
  // locked containers (first attempt: assigned list.scrollTop=43, read
  // back 0) while native wheel gestures pass through — so when the target
  // sits outside its scrollable ancestor's viewport, drive agent-browser's
  // scroll command (a CDP-level gesture) instead of assigning scrollTop.
  const locate = `(() => {
    const el = (${findExpr}); if (!el) return null;
    let p = el.parentElement, container = null;
    while (p) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) { container = p; break; }
      p = p.parentElement;
    }
    if (container) {
      const er = el.getBoundingClientRect(), cr = container.getBoundingClientRect();
      if (er.top < cr.top + 1 || er.bottom > cr.bottom - 1) {
        const tid = container.getAttribute('data-testid');
        const sel = tid ? '[data-testid=' + tid + ']' : (container.id ? '#' + container.id : null);
        if (sel) return { scrollSel: sel, dir: er.top < cr.top ? 'up' : 'down' };
      }
    }
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`;
  let probe = evalJs(locate);
  if (!probe || probe === "null") return "NO-ELEMENT";
  let pos = JSON.parse(probe);
  if (pos.scrollSel) {
    sh(`${AB} scroll ${pos.dir} 250 -s ${pos.scrollSel}`);
    await sleep(250);
    probe = evalJs(`(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    if (!probe || probe === "null") return "NO-ELEMENT";
    pos = JSON.parse(probe);
  }
  sh(`${AB} mouse move ${pos.x} ${pos.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${pos.x},${pos.y}`;
};

// ---- setup: job ids + Live params rewrite (changed-row material) ----------
const { PrismaClient } = await (async () => {
  // prisma client via node -e keeps this script dependency-free of TS paths
  return { PrismaClient: null };
})();
// node -e without the quoting hell: base64 the script (no $ expansion, no
// quote mangling — $disconnect died in bash double quotes on the first run)
function nodeRun(script, ...args) {
  const b64 = Buffer.from(script).toString("base64");
  return execSync(
    `node -e 'eval(Buffer.from("${b64}","base64").toString())' ${args.map((a) => `'${a}'`).join(" ")}`,
    { encoding: "utf8", timeout: 60_000 }
  ).trim();
}
function prismaJson(script, ...args) {
  return JSON.parse(nodeRun(script, ...args));
}
const ids = prismaJson(`
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.job.findMany({ where: { projectId: process.argv[1] }, select: { id: true, name: true } })
  .then(js => { console.log(JSON.stringify(Object.fromEntries(js.map(j => [j.name, j.id])))); return p.$disconnect(); })
  .catch(e => { console.error(e.message); process.exit(1); });
`, PROJECT);
const LIVE_ID = ids["QA Refine Live"];
const R410_ID = ids["QA Refine 410"];
const P385_ID = ids["QA Post 385"];
const HOST_ID = ids[HOST_JOB];
if (!LIVE_ID || !R410_ID || !P385_ID || !HOST_ID) { console.log("FATAL: seed jobs missing — run qa60-seed-fsc.py first"); process.exit(1); }

const LIVE_PARAMS_DIFF = { symmetry: "C1", iniHigh: 30, particleDiameter: 180, autoRefine: false, iterations: 12, samplingStep: 5, tau2Fudge: 1, padding: 2 };
const LIVE_PARAMS_ORIG = { symmetry: "D2", iniHigh: 30, particleDiameter: 180, autoRefine: false, iterations: 15, samplingStep: 7.5, tau2Fudge: 1, padding: 2 };
function setLiveParams(params) {
  nodeRun(`
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.job.update({ where: { id: process.argv[1] }, data: { params: process.argv[2] } })
  .then(() => { console.log('updated'); return p.$disconnect(); })
  .catch(e => { console.error(e.message); process.exit(1); });
`, LIVE_ID, JSON.stringify(params));
}
setLiveParams(LIVE_PARAMS_DIFF);

// synthetic model star: FSC = 0.95·e^(−8.34·f) crosses 0.143 at 4.40 Å
function it016Star() {
  const lines = [
    "data_model_class001", "", "loop_",
    "_rlnResolution #1", "_rlnAngstromResolution #2", "_rlnGoldStandardFsc #3",
  ];
  for (let i = 0; i < 48; i++) {
    const f = 0.01 + (0.49 - 0.01) * (i / 47);
    const g = Math.min(0.99, 0.95 * Math.exp(-8.34 * f));
    lines.push(`${f.toFixed(9)}  ${(1 / f).toFixed(6)}  ${g.toFixed(6)}`);
  }
  return lines.join("\n") + "\n";
}

async function bootToDialog(pickLabel) {
  sh(`${AB} close`); await sleep(1200);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  evalJs(errCollector);
  // forget the persisted selection — each phase drives its own picks
  evalJs(`localStorage.removeItem('cryoflow.fsc-compare:${PROJECT}'); 'cleared'`);

  let onCanvas = false;
  for (let i = 0; i < 10 && !onCanvas; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'));
      const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
      return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
    })()`);
    if (probe.includes("CARD")) onCanvas = true;
    else if (probe.includes("DASH")) {
      evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
      await sleep(2200);
    } else await sleep(2000);
  }
  must(onCanvas, "canvas renders with seeded job cards");

  let modal = false;
  for (let i = 0; i < 5 && !modal; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'))`,
    );
    if (r.includes("clicked@")) {
      await sleep(1500);
      modal = unq(evalJs(`(() => {
        const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
        return dl ? 'MODAL' : 'NONE';
      })() + ''`)) === "MODAL";
    } else await sleep(1500);
  }
  must(modal, "inspector modal opens for the host postprocess job");

  let dialog = false;
  for (let i = 0; i < 5 && !dialog; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('compare') || (b.title||'').includes('compare'))`,
    );
    if (r.includes("clicked@")) {
      await sleep(1800);
      dialog = unq(evalJs(`String(document.querySelectorAll('[data-testid=fsc-compare-row]').length)`)) === "5";
    } else await sleep(1500);
  }
  must(dialog, `compare dialog opens with 5 rows (${pickLabel})`);
}

/** tick (or untick with expect="false") a row's checkbox by job id */
async function pickJob(jobId, label, expect = "true") {
  const r = await realClick(
    `document.querySelector('[data-testid=fsc-compare-row][data-job-id="${jobId}"]')?.querySelector('button[role=checkbox]')`,
  );
  await sleep(900);
  // verify the React state actually flipped — a click that lands on the
  // wrong element must fail here, not three asserts later
  const checked = unq(evalJs(
    `String(document.querySelector('[data-testid=fsc-compare-row][data-job-id="${jobId}"] button[role=checkbox]')?.getAttribute('aria-checked') || 'MISSING')`,
  ));
  must(checked === expect, `picked ${label} (aria-checked=${checked})`);
}

const paramsSection = () => unq(evalJs(`(() => {
  const s = document.querySelector('[data-testid=fsc-params-diff]');
  return s ? 'SECTION' : 'NONE';
})() + ''`));
const countsText = () => unq(evalJs(`String(document.querySelector('[data-testid=fsc-params-counts]')?.textContent || '')`));
const rowKind = (key) => unq(evalJs(`String(document.querySelector('[data-testid=fsc-params-diff] tr[data-key="${key}"]')?.dataset.kind || 'ABSENT')`));

// ===========================================================================
async function phaseA() {
  console.log("— PHASE A: params A/B diff —");
  await bootToDialog("host preselected");
  must(paramsSection() === "NONE", "params section absent for a single pick");

  await pickJob(P385_ID, "QA Post 385");
  must(paramsSection() === "SECTION", "params section appears at 2 picks");
  must(countsText().includes("4 identical"), `twin postprocesses: all 4 identical (got "${countsText()}")`);
  must(unq(evalJs(`String(document.body.textContent).includes('All 4 launch parameters identical')`)) === "true",
    "all-identical verdict names the data, not the settings");
  must(unq(evalJs(`String(!!document.querySelector('[data-testid=fsc-params-diffonly]'))`)) === "false",
    "no differences-only toggle when nothing differs");

  await pickJob(R410_ID, "QA Refine 410");
  must(countsText().includes("12 one-sided"), `cross-type join: 12 one-sided rows (got "${countsText()}")`);
  must(rowKind("autoBfac") === "partial" && rowKind("symmetry") === "partial",
    "disjoint key sets render as one-sided, never as changed");

  await pickJob(LIVE_ID, "QA Refine Live");
  must(countsText().trim() === "3 differ · 9 one-sided",
    `taxonomy counts land exactly (got "${countsText()}")`);
  must(rowKind("symmetry") === "changed" && rowKind("iterations") === "changed" && rowKind("samplingStep") === "changed",
    "symmetry/iterations/sampling flagged changed (D2/C1, 15/12, 7.5/5) — absence on the postprocess rows does not demote them");
  must(rowKind("iniHigh") === "partial" && rowKind("autoBfac") === "partial",
    "agreeing-but-one-sided keys stay partial under the new taxonomy");
  must(rowKind("iniHigh").trim() !== "ABSENT", "partial rows visible under differences-only");

  const hot = unq(evalJs(`(() => {
    const tds = [...document.querySelectorAll('[data-testid=fsc-params-diff] tr[data-key=symmetry] td')];
    return String(tds.filter(td => td.className.includes('amber')).length);
  })()`));
  must(hot === "2", `both changed values carry the amber highlight (got ${hot})`);

  const miss = unq(evalJs(`String(document.querySelector('[data-testid=fsc-params-diff] tr[data-key=symmetry] td:nth-child(2)')?.textContent || '')`));
  must(miss === "—", `missing postprocess cell renders as an em-dash (got "${miss}")`);

  // strip the postprocesses: 410-vs-Live alone gets TRUE same rows — the
  // differences-only toggle finally has identical rows to hide
  await pickJob(HOST_ID, "untick QA Post 320", "false");
  await pickJob(P385_ID, "untick QA Post 385", "false");
  must(countsText().trim() === "3 differ · 5 identical",
    `pure-refine pair: 3 differ + 5 identical (got "${countsText()}")`);
  must(rowKind("iniHigh") === "ABSENT", "differences-only hides the 5 identical refine rows");

  const tgl = await realClick(`document.querySelector('[data-testid=fsc-params-diffonly]')`);
  await sleep(400);
  must(tgl.includes("clicked@"), "show-all toggle clickable");
  must(rowKind("iniHigh") === "same", "show-all reveals identical rows");

  // Esc peels the dialog, inspector survives (layered-escape contract)
  evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-testid=fsc-compare-list]'));
    if (dl) dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'esc';
  })()`);
  await sleep(1200);
  const after = unq(evalJs(`(() => {
    const cmp = !!document.querySelector('[data-testid=fsc-compare-list]');
    const insp = [...document.querySelectorAll('[role=dialog]')].some(d => (d.textContent||'').includes('${HOST_JOB}'));
    return (cmp ? 'CMP' : 'NOCMP') + '+' + (insp ? 'INSP' : 'NOINSP');
  })() + ''`));
  must(after === "NOCMP+INSP", "Esc still peels one layer with the params table mounted");
  console.log(`PHASE A GREEN (${PASS} asserts)`);
}

// ===========================================================================
async function phaseB() {
  console.log("— PHASE B: live auto-refresh —");
  await bootToDialog("host preselected");
  await pickJob(LIVE_ID, "QA Refine Live (the running job)");

  const live = unq(evalJs(`(() => {
    const notice = !!document.querySelector('[data-testid=fsc-compare-autolive]');
    const badge = !!document.querySelector('[data-testid=fsc-compare-live]');
    return (notice ? 'NOTICE' : 'NONOTICE') + '+' + (badge ? 'BADGE' : 'NOBADGE');
  })() + ''`));
  must(live === "NOTICE+BADGE", "auto-live notice + pulsing badge for the running pick");
  must(unq(evalJs(`String(document.querySelector('[data-testid=fsc-compare-autolive]')?.textContent || '').includes('12')`)) === "true",
    "notice states the 12 s cadence");

  // the live row's res cell — wait for the it014 curve to land first
  let resLiveBefore = "";
  for (let i = 0; i < 10 && !resLiveBefore.trim(); i++) {
    resLiveBefore = unq(evalJs(`String(document.querySelector('[data-testid=fsc-compare-res-${LIVE_ID}]')?.textContent || '')`));
    if (!resLiveBefore.trim()) await sleep(800);
  }
  must(/4\.5\d/.test(resLiveBefore), `live row reads the it014 checkpoint before the poll (got "${resLiveBefore}")`);

  evalJs(`(() => {
    window.__fscFetch = { index: 0, fsc: 0 };
    if (!window.__fscHooked) {
      const orig = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const u = typeof input === 'string' ? input : (input && input.url) || '';
        if (u.includes('/fsc-index')) window.__fscFetch.index++;
        else if (u.includes('/fsc')) window.__fscFetch.fsc++;
        return orig(input, init);
      };
      window.__fscHooked = true;
    }
    return 'counter-on';
  })()`);

  writeFileSync(IT016, it016Star());
  console.log("  … run_it016_model.star landed (4.40 Å) — waiting up to 25 s for a poll cadence");
  // the interval resets whenever runningPicked's identity changes, so the
  // first tick can land anywhere in [0, 12] s after the pick — poll for the
  // surfaced value instead of gambling on a fixed sleep
  let resLiveAfter = "";
  for (let i = 0; i < 13; i++) {
    await sleep(2000);
    resLiveAfter = unq(evalJs(`String(document.querySelector('[data-testid=fsc-compare-res-${LIVE_ID}]')?.textContent || '')`));
    if (/4\.3\d|4\.40/.test(resLiveAfter)) break;
  }

  const counters = JSON.parse(evalJs(`(window.__fscFetch || { index: 0, fsc: 0 })`));
  must(counters.index >= 1, `poll fetched the index (index=${counters.index})`);
  must(counters.fsc >= 1, `poll fetched the live curve (fsc=${counters.fsc})`);
  must(/4\.3\d|4\.40/.test(resLiveAfter), `live row surfaces the it016 checkpoint after the poll (got "${resLiveAfter}")`);
  const stillLive = unq(evalJs(`(() => {
    const notice = !!document.querySelector('[data-testid=fsc-compare-autolive]');
    const badge = !!document.querySelector('[data-testid=fsc-compare-live]');
    return (notice ? 'NOTICE' : 'NONOTICE') + '+' + (badge ? 'BADGE' : 'NOBADGE');
  })() + ''`));
  must(stillLive === "NOTICE+BADGE", "badge + notice survive while the job keeps running");

  evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => d.querySelector('[data-testid=fsc-compare-list]'));
    if (dl) dl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return 'esc';
  })()`);
  await sleep(1200);
  const after = unq(evalJs(`(() => {
    const cmp = !!document.querySelector('[data-testid=fsc-compare-list]');
    const insp = [...document.querySelectorAll('[role=dialog]')].some(d => (d.textContent||'').includes('${HOST_JOB}'));
    return (cmp ? 'CMP' : 'NOCMP') + '+' + (insp ? 'INSP' : 'NOINSP');
  })() + ''`));
  must(after === "NOCMP+INSP", "Esc peels the dialog, inspector survives");
  console.log(`PHASE B GREEN (${PASS} asserts)`);
}

// ===========================================================================
async function phaseC() {
  console.log("— PHASE C: console cleanliness —");
  await bootToDialog("host preselected");
  await pickJob(P385_ID, "QA Post 385");
  await pickJob(LIVE_ID, "QA Refine Live");
  await sleep(1500);
  // hover a candidate row with the params table mounted, flip the toggle
  const hv = await realClick(
    `document.querySelector('[data-testid=fsc-compare-row][data-job-id="${LIVE_ID}"]')`,
  );
  await sleep(300);
  must(hv.includes("clicked@"), "row hover-click tolerated with the params table mounted");
  await realClick(`document.querySelector('[data-testid=fsc-params-diffonly]')`);
  await sleep(1000);
  const errs = JSON.parse(unq(evalJs(`JSON.stringify(window.__qaErrs || [])`)));
  must(errs.length === 0, `zero page errors across the journey (got ${JSON.stringify(errs)})`);
  console.log(`PHASE C GREEN (${PASS} asserts)`);
}

// ===========================================================================
let ok = true;
for (const p of PHASES) {
  try {
    if (p === "A") await phaseA();
    else if (p === "B") await phaseB();
    else if (p === "C") await phaseC();
  } catch (e) {
    console.log(`PHASE ${p} FAILED: ${String(e).slice(0, 300)}`);
    ok = false;
    break;
  }
}
// teardown ALWAYS: a GREEN run must not leave the it016 checkpoint or the
// rewritten Live params behind for the next run's bootstrapping to trip on
cleanup();
console.log(ok ? `QA64 GREEN (${PASS} asserts)` : "QA64 RED");
process.exit(ok ? 0 : 1);
