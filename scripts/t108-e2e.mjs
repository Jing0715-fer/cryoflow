// Task 110 QA — chart data export through the command palette + the
// single-source row-builder lift (lib/chart-rows).
//   S  SEED + REACH: qa60 seed (FSC-bearing jobs) → canvas → inspector on
//      QA Post 320 → Results tab → FSC chart renders with export buttons
//   A  PALETTE CSV: Ctrl+K → "Export chart data · QA Post 320" group →
//      FSC curve item → captured blob is CSV, toast names the file, row
//      count matches, inspector survives the palette round-trip
//   B  CROSS-SURFACE BYTE EQUALITY: the chart's own CSV button produces a
//      blob BYTE-IDENTICAL to the palette's (one row-builder, two doors)
//   N  NO-DATA HONESTY: palette "Topaz training" on a non-topaz job →
//      honest "no data yet" toast, NO download, NO fabricated zero-row file
//   F  STATIC: registry + gates exported; six charts delegate to lib
//      (no local type copies, no inline row maps); labels match the
//      charts' name props (filename contract); palette wired; print:hidden
//   Z  CLEANUP: seed --clean, console 0
// Usage: node scripts/t108-e2e.mjs
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, existsSync } from "node:fs";

const AB = "agent-browser";
const B = "http://localhost:3000";
const LOGF = "/home/z/my-project/.qa-logs/t108-trace.log";
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

// ---------- aim-verify pointer helpers (qa62 Task 108 contract) ----------
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

// ---------- toast observer (palette + chart toasts both match) ----------
const toastObserver = `(() => {
  window.__t108Toasts = [];
  window.__t108Mo && window.__t108Mo.disconnect();
  window.__t108Mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/exported|no data yet|export failed|not ready/.test(t)) window.__t108Toasts.push(t.replace(/\\s+/g, ' ').slice(0, 200));
      }
    }
  });
  window.__t108Mo.observe(document.body, { childList: true, subtree: true });
  return 'armed';
})()`;
const lastToasts = () => JSON.parse(evalJs(`(() => (window.__t108Toasts || []).slice(-3).join(' | '))()`));

// ---------- download spy (same contract as t107) ----------
const armSpy = `(() => {
  window.__t108Dls = [];
  window.__t108Blob = null;
  if (!window.__t108Orig) window.__t108Orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    const u = window.__t108Orig(blob);
    window.__t108Dls.push({ size: blob ? blob.size : 0, type: blob ? blob.type : '' });
    window.__t108Blob = blob;
    return u;
  };
  return 'spy-armed';
})()`;
const dlCount = () => J(`(() => (window.__t108Dls || []).length)()`);
const dlLast = () => J(`(() => { const d = (window.__t108Dls || []).slice(-1)[0]; return d || null; })()`);

const blobText = async () => {
  evalJs(`(() => {
    window.__t108Text = 'PENDING';
    if (!window.__t108Blob) { window.__t108Text = 'NO-BLOB'; return; }
    const r = new FileReader();
    r.onload = () => { window.__t108Text = String(r.result); };
    r.readAsText(window.__t108Blob);
  })()`);
  for (let i = 0; i < 10; i++) {
    // JSON.parse decodes the CLI's \\n escapes — unq() alone would leave
    // literal backslash-n pairs and split("\\n") would see a single line
    const t = JSON.parse(evalJs(`window.__t108Text || 'PENDING'`));
    if (t !== "PENDING") return t;
    await sleep(300);
  }
  return "TIMEOUT";
};

/** read a specific stored blob's text through a FileReader pass */
const textOf = async (blobExpr) => {
  evalJs(`(() => {
    window.__t108Text = 'PENDING';
    const blob = ${blobExpr};
    if (!blob) { window.__t108Text = 'NO-BLOB'; return; }
    const r = new FileReader();
    r.onload = () => { window.__t108Text = String(r.result); };
    r.readAsText(blob);
  })()`);
  for (let i = 0; i < 10; i++) {
    const t = JSON.parse(evalJs(`window.__t108Text || 'PENDING'`));
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

/** open the palette via its own Ctrl+K contract */
const openPalette = async () => {
  evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`);
  await sleep(900);
  for (let i = 0; i < 6; i++) {
    const open = unq(evalJs(`(() => !!document.querySelector('[cmdk-root]'))() + ''`));
    if (open === "true") return true;
    evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`);
    await sleep(900);
  }
  return false;
};

const paletteItem = (text) => `(() => {
  const items = [...document.querySelectorAll('[cmdk-item]')];
  const it = items.find(x => (x.textContent||'').includes('${text}'));
  if (!it) return 'NO-ITEM';
  it.click();
  return 'clicked';
})()`;

const groupHeading = (text) => `(() => {
  const hs = [...document.querySelectorAll('[cmdk-group-heading]')];
  const h = hs.find(x => (x.textContent||'').includes('${text}'));
  return h ? 'GROUP' : 'NO-GROUP';
})()`;

// ---------- phases ----------
const phaseS = async () => {
  console.log("== PHASE S: seed + reach the FSC chart ==");
  sh(`${SEED} >/dev/null 2>&1`);
  step("  seeded QA Post 300/320/385 + Refine 410 + Live");
  if (!(await bootCanvas())) throw new Error("canvas never showed the host card");
  if (!(await openInspector())) throw new Error("inspector modal never appeared");
  // Results tab
  let tab = "";
  for (let i = 0; i < 8 && !tab.includes("tab"); i++) {
    tab = evalJs(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Results'); t ? t.click() : 0; return t ? 'tab' : 'NO-TAB'; })()`);
    await sleep(1200);
  }
  must(tab.includes("tab"), "Results tab opened");
  let ok = null;
  for (let i = 0; i < 15 && !ok; i++) {
    await sleep(1500);
    ok = J(`(() => {
      const b = document.querySelector('[data-canvas-ui=chart-export][data-chart-name="FSC curve"]');
      if (!b) return null;
      return { rows: b.getAttribute('data-has-rows'), csv: !!b.querySelector('[data-canvas-ui=chart-export-csv]') };
    })()`);
  }
  must(ok && ok.rows === "1", `FSC export buttons present, rows honest (got ${ok && ok.rows})`);
  evalJs(toastObserver);
  evalJs(armSpy);
  step("PHASE S GREEN");
};

const phaseA = async () => {
  console.log("== PHASE A: palette export — group, item, CSV contract ==");
  if (!(await openPalette())) throw new Error("palette never opened via Ctrl+K");
  must(groupHeading("Export chart data · QA Post 320").includes("GROUP"),
    "Export group heading names the inspected job");
  const six = J(`(() => {
    const groups = [...document.querySelectorAll('[cmdk-group]')];
    const g = groups.find(x => (x.querySelector('[cmdk-group-heading]')?.textContent||'').includes('Export chart data'));
    return g ? [...g.querySelectorAll('[cmdk-item]')].length : 0;
  })()`);
  must(six === 6, `Export group carries all six charts (got ${six})`);
  const before = dlCount();
  const clicked = unq(evalJs(paletteItem("FSC curve")));
  must(clicked.includes("clicked"), "FSC curve palette item clicked");
  await sleep(1800);
  // the palette closes itself (same dance as every other entry)
  const palGone = unq(evalJs(`(() => !document.querySelector('[cmdk-root]'))() + ''`));
  must(palGone === "true", "palette closed after export entry");
  must(dlCount() > before, `createObjectURL captured (got ${dlCount()})`);
  const d = dlLast();
  must(d && d.type.includes("text/csv"), `blob is CSV-typed (got ${d && d.type})`);
  must(d && d.size > 100, `blob has real payload (got ${d && d.size} bytes)`);
  const toasts = lastToasts();
  step(`  toasts: ${toasts}`);
  const m = toasts.match(/(\d+) rows? → cryoflow-fsc-curve\.csv/);
  must(!!m, `success toast names the chart file (got ${toasts})`);
  // the inspector survives the palette round-trip
  const insp = unq(evalJs(`(() => {
    const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
    return dl ? 'MODAL' : 'NONE';
  })() + ''`));
  must(insp === "MODAL", "inspector survived the palette round-trip");
  // stash the PALETTE's blob before the chart's own download replaces
  // window.__t108Blob in phase B (stash lives in the BROWSER, not Node)
  evalJs(`(() => {
    window.__t108PaletteBlob = window.__t108Blob;
    return 'stashed';
  })()`);
  step("PHASE A GREEN");
};

const phaseB = async () => {
  console.log("== PHASE B: chart CSV — byte equality with the palette's ==");
  // re-arm so the next blob is the CHART's, not the palette's
  evalJs(armSpy);
  const before = dlCount();
  evalJs(`(() => { const b = document.querySelector('[data-canvas-ui=chart-export][data-chart-name="FSC curve"] [data-canvas-ui=chart-export-csv]'); b ? b.click() : 0; return b ? 'clicked' : 'NO-BTN'; })()`);
  await sleep(1500);
  must(dlCount() > before, `chart CSV click captured (got ${dlCount()})`);
  // read both blobs' texts through two FileReader passes
  const palCsv = await textOf("window.__t108PaletteBlob");
  const chartCsv = await textOf("window.__t108Blob");
  must(palCsv.startsWith("resolution (A),spatial frequency (1/A),fsc"),
    `palette CSV header honest (got "${palCsv.slice(0, 60)}")`);
  must(chartCsv.startsWith("resolution (A),spatial frequency (1/A),fsc"),
    `chart CSV header honest (got "${chartCsv.slice(0, 60)}")`);
  must(palCsv === chartCsv,
    "palette CSV and chart CSV are BYTE-IDENTICAL (one row-builder, two doors)");
  const csvRows = chartCsv.trim().split("\n").length - 1;
  must(csvRows >= 20, `CSV carries the real curve (${csvRows} rows)`);
  step("PHASE B GREEN");
};

const phaseN = async () => {
  console.log("== PHASE N: no-data honesty — palette does not fabricate files ==");
  if (!(await openPalette())) throw new Error("palette never opened (phase N)");
  const before = dlCount();
  const clicked = unq(evalJs(paletteItem("Topaz training")));
  must(clicked.includes("clicked"), "Topaz training palette item clicked");
  await sleep(1800);
  const toasts = lastToasts();
  step(`  toasts: ${toasts}`);
  must(/no data yet/.test(toasts), `honest no-data toast (got ${toasts})`);
  must(!/Topaz training exported/.test(toasts), "no fake success toast");
  must(dlCount() === before, `NO download fabricated (got ${dlCount()})`);
  // escape the palette for the static phase
  evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(600);
  step("PHASE N GREEN");
};

const phaseF = () => {
  console.log("== PHASE F: static contracts ==");
  const lib = readFileSync("src/lib/chart-rows.ts", "utf8");
  must(lib.includes("export const CHART_EXPORT_TARGETS"), "lib: palette registry exported");
  for (const fn of ["fscShells", "fscRenderable", "fscRows", "guinierPoints", "guinierRenderable",
    "guinierRows", "resolutionRenderable", "resolutionRows", "ctfRenderable", "ctfRows",
    "topazSeries", "topazRenderable", "topazRows", "angDistRenderable", "angDistRows"]) {
    must(lib.includes(`export function ${fn}`), `lib: ${fn} exported`);
  }
  // registry labels MUST equal the charts' own export-button names — the CSV
  // filename is fileSlug(label), a mismatch would mint a second filename
  const chartFiles = {
    fsc: "fsc-chart.tsx",
    guinier: "guinier-chart.tsx",
    resolution: "resolution-chart.tsx",
    ctf: "ctf-quality-chart.tsx",
    topaz: "topaz-training-chart.tsx",
    angdist: "angular-distribution-chart.tsx",
  };
  const labels = {
    fsc: "FSC curve", guinier: "Guinier plot", resolution: "Resolution evolution",
    ctf: "CTF fit quality", topaz: "Topaz training", angdist: "Orientation distribution",
  };
  for (const [key, file] of Object.entries(chartFiles)) {
    const src = readFileSync(`src/components/workflow/results/${file}`, "utf8");
    must(src.includes(`name="${labels[key]}"`), `${file}: export name matches registry label`);
    must(src.includes('from "@/lib/chart-rows"'), `${file}: rows sourced from the lib`);
    must(!new RegExp(`interface ${key === "fsc" ? "FscResponse" : key === "guinier" ? "GuinierResponse" : key === "resolution" ? "ResolutionResponse" : key === "ctf" ? "CtfResponse" : key === "topaz" ? "TopazTrainingResponse" : "AngDistResponse"} \\{`).test(src),
      `${file}: no local response-type copy (single source)`);
    must(!src.includes('"spatial frequency (1/A)"') || key === "fsc",
      `${file}: no inline row-map duplication outside fsc`);
  }
  for (const c of Object.values(chartFiles)) {
    const src = readFileSync(`src/components/workflow/results/${c}`, "utf8");
    must(!src.includes("createObjectURL") && !src.includes("toBlob"), `${c}: zero bespoke blob plumbing`);
  }
  const pal = readFileSync("src/components/workflow/command-palette.tsx", "utf8");
  must(pal.includes("CHART_EXPORT_TARGETS"), "palette: registry wired");
  must(pal.includes("downloadCsv"), "palette: shared CSV pipeline (no bespoke plumbing)");
  must(pal.includes("Export chart data"), "palette: Export group present");
  must(pal.includes("no data yet"), "palette: honest empty-result toast");
  const comp = readFileSync("src/components/workflow/results/chart-export-buttons.tsx", "utf8");
  must(comp.includes("print:hidden"), "component: export buttons hidden in print");
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
    await phaseN();
    phaseF();
    await phaseZ();
    console.log(`T108 ALL PASS (${PASSED} assertions)`);
    process.exit(0);
  } catch (e) {
    step(`FATAL: ${e.message}`);
    console.error(`FATAL: ${e.message}`);
    try { sh(`${AB} close`); } catch { /* already gone */ }
    process.exit(1);
  }
})();
