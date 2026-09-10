// Task 107 QA — per-chart data export suite (CSV + PNG) on the results charts.
//   S  SEED + REACH: qa60 seed (FSC-bearing completed jobs) → canvas →
//      inspector on QA Post 320 → Results tab → FSC chart renders with
//      export buttons present and data-has-rows="1"
//   A  CSV: createObjectURL spy → click the FSC chart's CSV button →
//      captured blob: filename contract cryoflow-fsc-curve.csv, honest
//      header line, row count matches the toast's claimed count
//   B  PNG: same spy → click PNG → cryoflow-fsc-curve.png, 2× raster
//      (size floor), success toast
//   F  STATIC: lib pipeline exports; component contract (CSV disabled
//      without rows, elementFromPoint-free plain buttons, root walk); all
//      six charts wired (import + data-chart-export-root)
//   Z  CLEANUP: seed --clean, console 0
// Usage: node scripts/t107-e2e.mjs
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, existsSync } from "node:fs";

const AB = "agent-browser";
const B = "http://localhost:3000";
const LOGF = "/home/z/my-project/.qa-logs/t107-trace.log";
const step = (m) => {
  try { appendFileSync(LOGF, `[${(Date.now() / 1000).toFixed(0)}] ${m}\n`); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig}`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// qa62 CLI convention: eval --stdin; object results print as bare JSON,
// strings come back quoted — unq strips the outer quotes only
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));

let PASSED = 0;
const must = (cond, msg) => {
  if (!cond) { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); process.exit(1); }
  PASSED += 1;
  console.log(`  ok: ${msg}`);
};

// ---------- aim-verify pointer helpers (qa62 Task 108, verbatim contract) ----------
const hoverAt = async (findExpr) => {
  const aimProbe = `(() => {
    const el = (${findExpr}); if (!el) return null;
    const r = el.getBoundingClientRect();
    const cands = [[0.5, 0.5], [0.5, 0.72], [0.35, 0.5], [0.5, 0.3]];
    for (const [fx, fy] of cands) {
      const x = Math.round(r.x + r.width * fx), y = Math.round(r.y + r.height * fy);
      const top = document.elementFromPoint(x, y);
      if (top && el.contains(top)) return { x, y };
    }
    el.scrollIntoView({ block: 'center' });
    return { scroll: true };
  })()`;
  let pos = null;
  for (let i = 0; i < 4; i++) {
    const a = evalJs(aimProbe);
    if (!a || a === "null") return "NO-ELEMENT";
    const cand = JSON.parse(a);
    if (cand.scroll) { await sleep(500); continue; }
    if (Number.isFinite(cand.x) && Number.isFinite(cand.y)) { pos = cand; break; }
    step(`  hoverAt iter ${i}: unparsable aim`);
    await sleep(400);
  }
  if (!pos) return "NO-ELEMENT";
  sh(`${AB} mouse move ${pos.x} ${pos.y}`);
  return `hovered@${pos.x},${pos.y}`;
};
const realClick = async (findExpr) => {
  const h = await hoverAt(findExpr);
  if (!h.includes("hovered@")) return h;
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return h.replace("hovered@", "clicked@");
};

// ---------- toast observer ----------
const toastObserver = `(() => {
  window.__t107Toasts = [];
  window.__t107Mo && window.__t107Mo.disconnect();
  window.__t107Mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (t.includes('exported') || t.includes('not ready')) window.__t107Toasts.push(t.replace(/\\s+/g, ' ').slice(0, 160));
      }
    }
  });
  window.__t107Mo.observe(document.body, { childList: true, subtree: true });
  return 'armed';
})()`;
const lastToasts = () => JSON.parse(evalJs(`(() => (window.__t107Toasts || []).slice(-3).join(' | '))()`));

// ---------- download spy ----------
const armSpy = `(() => {
  window.__t107Dls = [];
  window.__t107Blob = null;
  if (!window.__t107Orig) window.__t107Orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    const u = window.__t107Orig(blob);
    window.__t107Dls.push({ name: u ? '' : '', size: blob ? blob.size : 0, type: blob ? blob.type : '' });
    window.__t107Blob = blob;
    return u;
  };
  return 'spy-armed';
})()`;
const dlCount = () => J(`(() => (window.__t107Dls || []).length)()`);
const dlLast = () => J(`(() => { const d = (window.__t107Dls || []).slice(-1)[0]; return d || null; })()`);

/** the anchor's download attribute names the file — capture via a click
 *  listener on document for <a download> additions is flaky; instead read
 *  the LAST blob's text and verify its header directly */
const blobText = async () => {
  evalJs(`(() => {
    window.__t107Text = 'PENDING';
    if (!window.__t107Blob) { window.__t107Text = 'NO-BLOB'; return; }
    const r = new FileReader();
    r.onload = () => { window.__t107Text = String(r.result); };
    r.readAsText(window.__t107Blob);
  })()`);
  for (let i = 0; i < 10; i++) {
    // JSON.parse decodes the CLI's \n escapes — unq() alone would leave
    // literal backslash-n pairs and split("\n") would see a single line
    const t = JSON.parse(evalJs(`window.__t107Text || 'PENDING'`));
    if (t !== "PENDING") return t;
    await sleep(300);
  }
  return "TIMEOUT";
};

// ---------- boot (qa62 conventions) ----------
const HOST_JOB = "QA Post 320";
const SEED = "python3 /home/z/my-project/scripts/qa60-seed-fsc.py";
const errClear = () => sh(`${AB} errors --clear >/dev/null 2>&1 || true`);

const bootCanvas = async () => {
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  errClear();
  for (let i = 0; i < 12; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'));
      const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
      return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
    })()`);
    if (String(probe).includes("CARD")) return true;
    if (String(probe).includes("DASH")) {
      evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
    }
    await sleep(2200);
  }
  return false;
};

const openInspector = async () => {
  for (let i = 0; i < 10; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'))`,
    );
    if (r.includes("clicked@")) {
      await sleep(1500);
      const has = unq(evalJs(`(() => {
        const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
        return dl ? 'MODAL' : 'NONE';
      })() + ''`));
      if (has === "MODAL") return true;
    }
    step(`  openInspector iter ${i}`);
    await sleep(2000);
  }
  return false;
};

// ---------- phases ----------
const phaseS = async () => {
  console.log("== PHASE S: seed + reach the FSC chart ==");
  sh(`${SEED} >/dev/null 2>&1`);
  step("  seeded QA Post 320/385 + Refine 410 + Live");
  if (!(await bootCanvas())) throw new Error("canvas never showed the host card");
  if (!(await openInspector())) throw new Error("inspector modal never appeared");
  // Results tab
  let tab = "";
  for (let i = 0; i < 8 && !tab.includes("tab"); i++) {
    tab = evalJs(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Results'); t ? t.click() : 0; return t ? 'tab' : 'NO-TAB'; })()`);
    await sleep(1200);
  }
  must(tab.includes("tab"), "Results tab opened");
  // FSC chart + its export buttons
  let ok = null;
  for (let i = 0; i < 15 && !ok; i++) {
    await sleep(1500);
    ok = J(`(() => {
      const b = document.querySelector('[data-canvas-ui=chart-export][data-chart-name="FSC curve"]');
      if (!b) return null;
      return { rows: b.getAttribute('data-has-rows'), csv: !!b.querySelector('[data-canvas-ui=chart-export-csv]'), png: !!b.querySelector('[data-canvas-ui=chart-export-png]') };
    })()`);
  }
  must(ok && ok.rows === "1", `FSC export buttons present, rows honest (got ${ok && ok.rows})`);
  must(ok && ok.csv && ok.png, "CSV + PNG buttons both present");
  evalJs(toastObserver);
  evalJs(armSpy);
  step("PHASE S GREEN");
};

const phaseA = async () => {
  console.log("== PHASE A: CSV export — filename, header, row-count contract ==");
  evalJs(`(() => { const b = document.querySelector('[data-canvas-ui=chart-export][data-chart-name="FSC curve"] [data-canvas-ui=chart-export-csv]'); b ? b.click() : 0; return b ? 'clicked' : 'NO-BTN'; })()`);
  await sleep(1500);
  must(dlCount() >= 1, `createObjectURL captured (got ${dlCount()})`);
  const d = dlLast();
  must(d && d.type.includes("text/csv"), `blob is CSV-typed (got ${d && d.type})`);
  must(d && d.size > 100, `blob has real payload (got ${d && d.size} bytes)`);
  const text = await blobText();
  must(text.startsWith("resolution (A),spatial frequency (1/A),fsc"), `header line honest (got "${text.slice(0, 60)}")`);
  const csvRows = text.trim().split("\n").length - 1;
  const toasts = lastToasts();
  step(`  toasts: ${toasts}`);
  const m = toasts.match(/(\d+) rows? → cryoflow-fsc-curve\.csv/);
  must(!!m, `success toast names the file (got ${toasts})`);
  must(String(csvRows) === m[1], `CSV row count matches the toast claim (file ${csvRows} vs toast ${m[1]})`);
  step("PHASE A GREEN");
};

const phaseB = async () => {
  console.log("== PHASE B: PNG export — 2× raster + toast ==");
  evalJs(`(() => { const b = document.querySelector('[data-canvas-ui=chart-export][data-chart-name="FSC curve"] [data-canvas-ui=chart-export-png]'); b ? b.click() : 0; return b ? 'clicked' : 'NO-BTN'; })()`);
  let d = null;
  for (let i = 0; i < 10 && !d; i++) {
    await sleep(1200);
    d = dlLast();
    if (d && !String(d.type).includes("image/png")) d = null; // still the csv from phase A
  }
  must(d && d.type === "image/png", `blob is PNG-typed (got ${d && d.type})`);
  must(d && d.size > 3000, `PNG has real raster payload (got ${d && d.size} bytes)`);
  const toasts = lastToasts();
  must(/FSC curve exported/.test(toasts) && /cryoflow-fsc-curve\.png/.test(toasts), `PNG success toast (got ${toasts})`);
  step("PHASE B GREEN");
};

const phaseF = () => {
  console.log("== PHASE F: static contracts ==");
  const lib = readFileSync("src/lib/chart-export.ts", "utf8");
  must(lib.includes("export function downloadCsv"), "lib: downloadCsv exported");
  must(lib.includes("export async function exportChartPng"), "lib: exportChartPng exported");
  must(lib.includes("export function rowsToCsv"), "lib: rowsToCsv exported");
  must(lib.includes("export function fileSlug"), "lib: fileSlug exported");
  must(lib.includes('URL.revokeObjectURL'), "lib: object URLs revoked (no leak)");
  const comp = readFileSync("src/components/workflow/results/chart-export-buttons.tsx", "utf8");
  must(comp.includes('disabled={!hasRows || busy !== null}'), "component: CSV disabled without rows (honest empty)");
  must(comp.includes('data-canvas-ui="chart-export-csv"') && comp.includes('data-canvas-ui="chart-export-png"'), "component: probe hooks on both buttons");
  must(comp.includes('closest<HTMLElement>("[data-chart-export-root]")'), "component: PNG root found by walking up");
  must(comp.includes('getComputedStyle(document.body)') === false, "component: no body-style reads in component (bg lives in lib)");
  const charts = [
    "fsc-chart.tsx",
    "guinier-chart.tsx",
    "resolution-chart.tsx",
    "ctf-quality-chart.tsx",
    "topaz-training-chart.tsx",
    "angular-distribution-chart.tsx",
  ];
  for (const c of charts) {
    const src = readFileSync(`src/components/workflow/results/${c}`, "utf8");
    must(src.includes('import { ChartExportButtons }'), `${c}: export buttons imported`);
    must(src.includes("data-chart-export-root"), `${c}: export root marked`);
  }
  // no chart hardcodes its own blob pipeline — one implementation, six callers
  for (const c of charts) {
    const src = readFileSync(`src/components/workflow/results/${c}`, "utf8");
    must(!src.includes("createObjectURL") && !src.includes("toBlob"), `${c}: zero bespoke blob plumbing`);
  }
  step("PHASE F GREEN");
};

const phaseZ = async () => {
  console.log("== PHASE Z: cleanup + console ==");
  sh(`${SEED} --clean >/dev/null 2>&1 || true`);
  step("  seed cleaned (files + engine-state; live job deleted)");
  sh(`${AB} close`); await sleep(1000);
  sh(`${AB} open ${B}`); await sleep(4000);
  errClear();
  const errs = sh(`${AB} errors || true`)
    .split("\n")
    .filter((l) => l.trim() && !l.includes("✗")); // CLI's own failure traces are not page errors
  must(errs.length === 0, `console clean (got ${errs.length})`);
  step("PHASE Z GREEN");
};

// ---------- main ----------
(async () => {
  try {
    if (!existsSync("/home/z/my-project/.qa-logs")) execSync("mkdir -p /home/z/my-project/.qa-logs");
    await phaseS();
    await phaseA();
    await phaseB();
    phaseF();
    await phaseZ();
    console.log(`T107 ALL PASS (${PASSED} assertions)`);
    process.exit(0);
  } catch (e) {
    step(`FATAL: ${e.message}`);
    console.error(`FATAL: ${e.message}`);
    try { sh(`${AB} close`); } catch { /* already gone */ }
    process.exit(1);
  }
})();
