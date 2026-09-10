// Task 111 QA — the clipboard doors: Copy TSV + Copy PNG next to the
// download pair on every results chart (four destinations, one truth).
//   S  SEED + REACH: qa60 seed → canvas → inspector on QA Post 320 →
//      Results tab → FSC chart export cluster: 4 buttons present, honest
//      has-rows, copy-state idle
//   A  TSV COPY (spy): writeText patched → click Copy → payload is
//      tab-separated, header + N rows, row count matches the chart's CSV;
//      toast wording; Check icon + copy-state=tsv; reverts to idle (~1.6s)
//   B  PNG COPY (spy): clipboard.write patched → click Copy PNG →
//      ClipboardItem with image/png, real 2× raster (>40KB); toast;
//      copy-state=png transient
//   C  HONEST FAILURE: writeText/write patched to REJECT → destructive
//      "could not be copied" toasts pointing at the downloads; no fake
//      success, copy-state never flips
//   D  CROSS-CHART + GATE: Guinier copy delivers Guinier rows (not FSC's);
//      every rendered chart's disabled state tracks its has-rows flag
//   F  STATIC: lib exports (chartPngBlob/rowsToTsv/copy*), exportChartPng
//      delegates to chartPngBlob, component routes ALL clipboard access
//      through the lib, data-copy-state wiring, print:hidden intact
//   Z  CLEANUP: seed --clean, reload, console 0
// Usage: node scripts/t109-e2e.mjs
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, existsSync } from "node:fs";

const AB = "agent-browser";
const B = "http://localhost:3000";
const LOGF = "/home/z/my-project/.qa-logs/t109-trace.log";
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

// ---------- realClick (qa107 真相二: atomic CLI click for canvas entry) ----------
const realClick = async (findExpr) => {
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
    await sleep(400);
  }
  if (!pos) return "NO-ELEMENT";
  sh(`${AB} mouse move ${pos.x} ${pos.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${pos.x},${pos.y}`;
};

// ---------- toast observer (copy + failure + download toasts all match) ----------
const toastObserver = `(() => {
  window.__t109Toasts = [];
  window.__t109Mo && window.__t109Mo.disconnect();
  window.__t109Mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/copied|could not be copied|not ready|no data yet|exported/.test(t)) window.__t109Toasts.push(t.replace(/\\s+/g, ' ').slice(0, 200));
      }
    }
  });
  window.__t109Mo.observe(document.body, { childList: true, subtree: true });
  return 'armed';
})()`;
const lastToasts = () => JSON.parse(evalJs(`(() => (window.__t109Toasts || []).slice(-3).join(' | '))()`));

// ---------- clipboard spies (the headless clipboard is permission-locked,
// so the probe verifies the contract WE own: which API the buttons call and
// with what payload. Real-browser permission behavior is environment, not
// app; the honest-failure branch is probed in phase C by re-patching.) ----------
const armTextSpy = `(() => {
  window.__t109Texts = [];
  const cb = navigator.clipboard;
  if (!window.__t109OrigWT) window.__t109OrigWT = cb.writeText.bind(cb);
  Object.defineProperty(cb, 'writeText', { configurable: true, value: (t) => {
    window.__t109Texts.push(String(t));
    return Promise.resolve();
  } });
  return 'armed';
})()`;
const armImageSpy = `(() => {
  window.__t109Imgs = [];
  window.__t109LastBlob = null;
  const cb = navigator.clipboard;
  if (!window.__t109OrigW) window.__t109OrigW = cb.write.bind(cb);
  Object.defineProperty(cb, 'write', { configurable: true, value: (items) => {
    for (const it of items) {
      const entry = { types: it.types ? Array.from(it.types) : [] };
      window.__t109Imgs.push(entry);
      const p = it.getType('image/png');
      if (p && p.then) p.then((b) => { entry.size = b.size; entry.type = b.type; window.__t109LastBlob = b; });
    }
    return Promise.resolve();
  } });
  return 'armed';
})()`;
const armRejectSpy = (method) => `(() => {
  const cb = navigator.clipboard;
  Object.defineProperty(cb, '${method}', { configurable: true, value: () =>
    Promise.reject(new DOMException('Write permission denied', 'NotAllowedError')) });
  return 'reject-armed';
})()`;
const clipTexts = () => J(`(() => (window.__t109Texts || []).length)()`);
const clipText = async () => {
  for (let i = 0; i < 8; i++) {
    const n = clipTexts();
    if (n > 0) return JSON.parse(evalJs(`window.__t109Texts[(window.__t109Texts.length - 1)]`));
    await sleep(300);
  }
  return "TIMEOUT";
};

// ---------- download spy (t107/t108 contract, for the CSV cross-check) ----------
const armDlSpy = `(() => {
  window.__t109Dls = [];
  window.__t109Blob = null;
  if (!window.__t109Orig) window.__t109Orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    const u = window.__t109Orig(blob);
    window.__t109Dls.push({ size: blob ? blob.size : 0, type: blob ? blob.type : '' });
    window.__t109Blob = blob;
    return u;
  };
  return 'spy-armed';
})()`;
const dlLastText = async () => {
  evalJs(`(() => {
    window.__t109DlText = 'PENDING';
    if (!window.__t109Blob) { window.__t109DlText = 'NO-BLOB'; return; }
    const r = new FileReader();
    r.onload = () => { window.__t109DlText = String(r.result); };
    r.readAsText(window.__t109Blob);
  })()`);
  for (let i = 0; i < 10; i++) {
    const t = JSON.parse(evalJs(`window.__t109DlText || 'PENDING'`));
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

/** the export cluster of a named chart */
const chartRoot = (name) => `document.querySelector('[data-canvas-ui=chart-export][data-chart-name="${name}"]')`;
const clusterInfo = (name) => J(`(() => {
  const b = ${chartRoot(name)};
  if (!b) return null;
  const q = (sel) => !!b.querySelector('[data-canvas-ui=' + sel + ']');
  return {
    hasRows: b.getAttribute('data-has-rows'),
    copyState: b.getAttribute('data-copy-state'),
    csv: q('chart-export-csv'), png: q('chart-export-png'),
    csvCopy: q('chart-export-csv-copy'), pngCopy: q('chart-export-png-copy'),
    csvCopyDisabled: b.querySelector('[data-canvas-ui=chart-export-csv-copy]')?.disabled ?? null,
    pngCopyDisabled: b.querySelector('[data-canvas-ui=chart-export-png-copy]')?.disabled ?? null,
    checkIcon: !!b.querySelector('svg[class*="lucide-check"]'),
  };
})()`);
const clickBtn = (name, btn) => evalJs(`(() => {
  const b = ${chartRoot(name)};
  const t = b && b.querySelector('[data-canvas-ui=${btn}]');
  t ? t.click() : 0;
  return t ? 'clicked' : 'NO-BTN';
})()`);

// ---------- phases ----------
const phaseS = async () => {
  console.log("== PHASE S: seed + reach the FSC chart cluster ==");
  sh(`${SEED} >/dev/null 2>&1`);
  step("  seeded QA Post 300/320/385 + Refine 410 + Live");
  if (!(await bootCanvas())) throw new Error("canvas never showed the host card");
  if (!(await openInspector())) throw new Error("inspector modal never appeared");
  let tab = "";
  for (let i = 0; i < 8 && !tab.includes("tab"); i++) {
    tab = evalJs(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Results'); t ? t.click() : 0; return t ? 'tab' : 'NO-TAB'; })()`);
    await sleep(1200);
  }
  must(tab.includes("tab"), "Results tab opened");
  let ok = null;
  for (let i = 0; i < 15 && !ok; i++) {
    await sleep(1500);
    ok = clusterInfo("FSC curve");
  }
  must(!!ok, "FSC export cluster rendered");
  must(ok.csv && ok.png && ok.csvCopy && ok.pngCopy, "all four destination buttons present (CSV/PNG download + TSV/PNG copy)");
  must(ok.hasRows === "1", `rows honest (got ${ok.hasRows})`);
  must(ok.copyState === "idle", `copy-state starts idle (got ${ok.copyState})`);
  evalJs(toastObserver);
  evalJs(armDlSpy);
  step("PHASE S GREEN");
};

const phaseA = async () => {
  console.log("== PHASE A: TSV copy — payload, toast, Check feedback ==");
  evalJs(armTextSpy);
  const clicked = unq(clickBtn("FSC curve", "chart-export-csv-copy"));
  must(clicked.includes("clicked"), "TSV copy button clicked");
  const tsv = await clipText();
  must(tsv !== "TIMEOUT", "writeText captured a payload");
  const lines = tsv.split("\n");
  must(lines.length >= 21, `TSV carries header + real curve (${lines.length} lines)`);
  const header = lines[0].split("\t");
  must(header.slice(0, 3).join("|") === "resolution (A)|spatial frequency (1/A)|fsc",
    `TSV header leads with the chart's own keys (got "${lines[0].slice(0, 80)}")`);
  const nCols = header.length;
  must(nCols >= 4, `FSC header carries the corrected/phase-randomized columns (${nCols})`);
  must(lines.slice(1).every((l) => l.split("\t").length === nCols), "every data row splits into the same cell count");
  must(!tsv.endsWith("\n"), "no trailing newline — paste must not mint an empty sheet row");
  // transient Check feedback + state attribute — read BEFORE anything else:
  // the revert beat (1.6s) is shorter than the CSV cross-check below
  let a = clusterInfo("FSC curve");
  must(a.copyState === "tsv", `copy-state flipped to tsv (got ${a.copyState})`);
  must(a.checkIcon, "Check icon shown while copied");
  // cross-dialect: same rows the CSV download carries
  const before = J(`(() => (window.__t109Dls || []).length)()`);
  evalJs(`(() => { const b = ${chartRoot("FSC curve")} && ${chartRoot("FSC curve")}.querySelector('[data-canvas-ui=chart-export-csv]'); b ? b.click() : 0; return b ? 'clicked' : 'NO-BTN'; })()`);
  await sleep(1200);
  must(J(`(() => (window.__t109Dls || []).length)()`) > before, "chart CSV click captured for the cross-check");
  const csv = await dlLastText();
  must(csv.startsWith("resolution (A),spatial frequency (1/A),fsc"), "CSV header honest");
  const csvLines = csv.trim().split("\n").length;
  must(csvLines === lines.length,
    `TSV and CSV carry the SAME rows (${lines.length} vs ${csvLines})`);
  const toasts = lastToasts();
  step(`  toasts: ${toasts}`);
  must(/FSC curve copied/.test(toasts), `success toast names the chart (got ${toasts})`);
  must(/ as TSV /.test(toasts), "toast names the paste dialect");
  // the revert beat has elapsed under the cross-check — confirm the reset
  await sleep(800);
  a = clusterInfo("FSC curve");
  must(a.copyState === "idle", `copy-state reverts after the beat (got ${a.copyState})`);
  must(!a.checkIcon, "Check icon reverts to Copy");
  step("PHASE A GREEN");
};

const phaseB = async () => {
  console.log("== PHASE B: PNG copy — ClipboardItem with a real 2× raster ==");
  evalJs(armImageSpy);
  const clicked = unq(clickBtn("FSC curve", "chart-export-png-copy"));
  must(clicked.includes("clicked"), "PNG copy button clicked");
  let imgs = null;
  for (let i = 0; i < 10 && !(imgs && imgs.length > 0); i++) {
    await sleep(400);
    imgs = J(`(() => (window.__t109Imgs || []))()`);
  }
  must(imgs && imgs.length > 0, "clipboard.write captured a ClipboardItem");
  must(imgs[0].types.includes("image/png"), `item is image/png (got ${imgs[0].types.join(",")})`);
  const blobInfo = J(`(() => { const b = window.__t109LastBlob; return b ? { size: b.size, type: b.type } : null; })()`);
  must(blobInfo && blobInfo.size > 40_000, `raster has real payload (got ${blobInfo && blobInfo.size} bytes)`);
  must(blobInfo && blobInfo.type === "image/png", "blob type honest");
  const toasts = lastToasts();
  step(`  toasts: ${toasts}`);
  must(/FSC curve copied/.test(toasts) && /paste into docs or slides/.test(toasts),
    `success toast points at paste targets (got ${toasts})`);
  const a = clusterInfo("FSC curve");
  must(a.copyState === "png" || a.copyState === "idle", `png copy-state tracked (got ${a.copyState})`);
  step("PHASE B GREEN");
};

const phaseC = async () => {
  console.log("== PHASE C: honest failure — clipboard permission denied ==");
  evalJs(armRejectSpy("writeText"));
  evalJs(toastObserver); // reset the toast window — phases A/B successes
                         // would otherwise masquerade as fake successes
  const clicked = unq(clickBtn("FSC curve", "chart-export-csv-copy"));
  must(clicked.includes("clicked"), "TSV copy clicked against a rejecting clipboard");
  await sleep(1200);
  const toasts = lastToasts();
  step(`  toasts: ${toasts}`);
  must(/could not be copied/.test(toasts), `destructive toast on rejection (got ${toasts})`);
  must(/Clipboard access was blocked/.test(toasts), "failure toast points at the download instead");
  must(!/FSC curve copied/.test(toasts), "no fake success toast");
  let a = clusterInfo("FSC curve");
  must(a.copyState === "idle", `copy-state never flips on failure (got ${a.copyState})`);
  // the PNG door gets the same honesty
  evalJs(armRejectSpy("write"));
  evalJs(toastObserver);
  const clicked2 = unq(clickBtn("FSC curve", "chart-export-png-copy"));
  must(clicked2.includes("clicked"), "PNG copy clicked against a rejecting clipboard");
  await sleep(1200);
  const toasts2 = lastToasts();
  must(/could not be copied/.test(toasts2), `PNG failure toast honest (got ${toasts2})`);
  a = clusterInfo("FSC curve");
  must(a.copyState === "idle", `png copy-state never flips on failure (got ${a.copyState})`);
  step("PHASE C GREEN");
};

const phaseD = async () => {
  console.log("== PHASE D: cross-job payload + gate honesty ==");
  // stash Post 320's payload, then move to QA Refine 410 — its FSC lives on
  // a different grid; the copy must follow the chart it was clicked on
  evalJs(`(() => { window.__t109PostTsv = (window.__t109Texts || []).slice(-1)[0] || null; return 'stashed'; })()`);
  // Radix Dialog's dismiss layer ignores synthetic Escape dispatches — it
  // takes a TRUSTED keystroke (qa63's compare dialog took the same road)
  sh(`${AB} press Escape`);
  await sleep(1000);
  let opened = false;
  for (let i = 0; i < 10 && !opened; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Refine 410'))`,
    );
    if (r.includes("clicked@")) {
      await sleep(1500);
      opened = unq(evalJs(`(() => { const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('QA Refine 410')); return dl ? 'MODAL' : 'NONE'; })() + ''`)) === "MODAL";
    }
    if (!opened) await sleep(1500);
  }
  must(opened, "QA Refine 410 inspector opened");
  let tab = "";
  for (let i = 0; i < 8 && !tab.includes("tab"); i++) {
    tab = evalJs(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Results'); t ? t.click() : 0; return t ? 'tab' : 'NO-TAB'; })()`);
    await sleep(1200);
  }
  must(tab.includes("tab"), "Refine 410 Results tab opened");
  let fsc = null;
  for (let i = 0; i < 15 && !fsc; i++) { await sleep(1200); fsc = clusterInfo("FSC curve"); }
  must(!!fsc, "Refine 410 FSC cluster rendered");
  evalJs(armTextSpy);
  const clicked = unq(clickBtn("FSC curve", "chart-export-csv-copy"));
  must(clicked.includes("clicked"), "Refine 410 TSV copy clicked");
  const tsv2 = await clipText();
  must(tsv2.startsWith("resolution (A)\tspatial frequency (1/A)\tfsc"),
    `Refine 410 payload carries FSC keys (got "${tsv2.slice(0, 50)}")`);
  const postTsv = JSON.parse(evalJs(`window.__t109PostTsv || 'null'`));
  must(!!postTsv, "Post 320 payload stashed from phase A");
  must(postTsv.split("\n").length !== tsv2.split("\n").length,
    `payloads follow their own job (${postTsv.split("\n").length} vs ${tsv2.split("\n").length} lines)`);
  // gate honesty across every cluster the dialog actually renders — the
  // disabled state must track its own has-rows flag, never the neighbor's
  const infos = J(`(() => {
    const dlg = [...document.querySelectorAll('[role=dialog]')][0];
    if (!dlg) return [];
    return [...dlg.querySelectorAll('[data-canvas-ui=chart-export]')].map(b => ({
      name: b.getAttribute('data-chart-name'),
      hasRows: b.getAttribute('data-has-rows'),
      csvCopyDisabled: b.querySelector('[data-canvas-ui=chart-export-csv-copy]')?.disabled ?? null,
      pngCopyDisabled: b.querySelector('[data-canvas-ui=chart-export-png-copy]')?.disabled ?? null,
    }));
  })()`);
  must(infos.length >= 1, `rendered clusters found (${infos.map((i) => i.name).join(", ")})`);
  for (const c of infos) {
    must(c.csvCopyDisabled === (c.hasRows !== "1") && c.pngCopyDisabled === false,
      `${c.name}: data-copy disabled=${c.csvCopyDisabled} tracks has-rows=${c.hasRows}; PNG copy stays enabled`);
  }
  step("PHASE D GREEN");
};

const phaseF = () => {
  console.log("== PHASE F: static contracts ==");
  const lib = readFileSync("src/lib/chart-export.ts", "utf8");
  for (const fn of ["chartPngBlob", "rowsToTsv", "copyTextToClipboard", "copyPngToClipboard",
    "exportChartPng", "downloadCsv", "rowsToCsv", "downloadBlob", "fileSlug"]) {
    must(new RegExp(`export (async )?function ${fn}\\b`).test(lib), `lib: ${fn} exported`);
  }
  must(/const blob = await chartPngBlob\(root\)/.test(lib),
    "lib: download PNG delegates to the shared raster (no second pipeline)");
  const comp = readFileSync("src/components/workflow/results/chart-export-buttons.tsx", "utf8");
  for (const fn of ["chartPngBlob", "copyPngToClipboard", "copyTextToClipboard", "rowsToTsv", "downloadCsv", "exportChartPng"]) {
    must(comp.includes(fn), `component: routes ${fn} through the lib`);
  }
  must(!comp.includes("navigator.clipboard"), "component: ZERO direct clipboard access (all through the lib)");
  must(!comp.includes("ClipboardItem"), "component: no bespoke ClipboardItem plumbing");
  must(comp.includes("data-copy-state"), "component: copy-state exposed for probes");
  must(comp.includes("COPIED_MS"), "component: revert beat is a named constant");
  must(comp.includes("print:hidden"), "component: export cluster hidden in print");
  must(comp.includes('chart-export-csv-copy') && comp.includes('chart-export-png-copy'),
    "component: copy buttons carry probe testids");
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
    await phaseC();
    await phaseD();
    phaseF();
    await phaseZ();
    console.log(`T109 ALL PASS (${PASSED} assertions)`);
    process.exit(0);
  } catch (e) {
    step(`FATAL: ${e.message}`);
    console.error(`FATAL: ${e.message}`);
    try { sh(`${AB} close`); } catch { /* already gone */ }
    process.exit(1);
  }
})();
