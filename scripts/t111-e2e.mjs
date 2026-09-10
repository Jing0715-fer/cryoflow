// Task 113 QA — the clipboard door reaches the keyboard flow: the command
// palette grows a "Copy chart data" group (TSV) beside "Export chart data"
// (CSV), both fed by ONE fetchChartRows — same rows, two destinations.
//   S  SEED + REACH: qa60 seed → inspector on QA Post 320 → palette →
//      BOTH groups present (6 export rows + 6 copy rows), copy rows carry
//      the tsv·clipboard suffix and probe testids
//   A  PALETTE COPY (spy): writeText patched → click Copy FSC row →
//      palette closes, TSV payload lands (header + N rows, tabs, no
//      trailing newline), toast wording mirrors the chart domain
//   B  CROSS-SURFACE EQUALITY: the chart's own Copy TSV button produces a
//      payload STRING-IDENTICAL to the palette's (one row-builder, two
//      surfaces, three doors total now)
//   N  NO-DATA HONESTY: Copy "Topaz training" on a non-topaz job →
//      honest "no data yet" toast, NO clipboard write, no fake payload
//   C  HONEST FAILURE: writeText patched to REJECT → destructive toast
//      pointing at the palette's own CSV export door; no fake success
//   D  NO TARGET NO GROUP: no inspector, no selection → neither chart
//      group renders — the palette must not promise what it can't do
//   F  STATIC: fetchChartRows single source (one fetch call, two doors),
//      zero second row-builder in the palette, imports from chart-export,
//      probe testids, toast vocabulary, PNG copy stays palette-excluded
//   Z  CLEANUP: seed --clean, reload, console 0
// Usage: node scripts/t111-e2e.mjs
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, existsSync } from "node:fs";

const AB = "agent-browser";
const B = "http://localhost:3000";
const LOGF = "/home/z/my-project/.qa-logs/t111-trace.log";
const step = (m) => {
  try { appendFileSync(LOGF, `[${(Date.now() / 1000).toFixed(0)}] ${m}\n`); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig}`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// qa62 CLI convention: eval --stdin; OBJECT returns print as bare JSON
// (one parse), strings get re-encoded — so every readback here returns an
// object and reads a property (t110's one-fold lesson, codified)
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 180_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));

let PASSED = 0;
const must = (cond, msg) => {
  if (!cond) { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); process.exit(1); }
  PASSED += 1;
  console.log(`  ok: ${msg}`);
};

// ---------- aim-verify pointer helpers (qa62 contract) ----------
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

// ---------- toast observer (per-phase re-arm; OBJECT readback) ----------
const armToasts = `(() => {
  window.__t111Toasts = [];
  window.__t111Mo && window.__t111Mo.disconnect();
  window.__t111Mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/copied|could not be copied|no data yet|failed|exported/i.test(t)) window.__t111Toasts.push(t.replace(/\\s+/g, ' ').slice(0, 220));
      }
    }
  });
  window.__t111Mo.observe(document.body, { childList: true, subtree: true });
  return 'armed';
})()`;
const toasts = () => J(`(() => ({ t: (window.__t111Toasts || []).join(' | ') }))()`).t;

// ---------- clipboard text spy (headless clipboard is permission-locked;
// the probe verifies the contract WE own: which API, which payload) ----------
const armTextSpy = `(() => {
  window.__t111Texts = [];
  const cb = navigator.clipboard;
  if (!window.__t111OrigWT) window.__t111OrigWT = cb.writeText.bind(cb);
  Object.defineProperty(cb, 'writeText', { configurable: true, value: (t) => {
    window.__t111Texts.push(String(t));
    return Promise.resolve();
  } });
  return 'armed';
})()`;
const armRejectSpy = `(() => {
  const cb = navigator.clipboard;
  Object.defineProperty(cb, 'writeText', { configurable: true, value: () =>
    Promise.reject(new DOMException('Write permission denied', 'NotAllowedError')) });
  return 'reject-armed';
})()`;
const textCount = () => J(`(() => ({ n: (window.__t111Texts || []).length }))()`).n;
const textLast = async () => {
  for (let i = 0; i < 12; i++) {
    const o = J(`(() => { const a = window.__t111Texts || []; return { n: a.length, p: a.length ? a[a.length - 1] : '' }; })()`);
    if (o.n > 0) return o.p;
    await sleep(300);
  }
  return "TIMEOUT";
};

// ---------- palette helpers (t108 contract) ----------
const openPalette = async () => {
  evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`);
  await sleep(900);
  for (let i = 0; i < 6; i++) {
    const open = J(`(() => ({ o: !!document.querySelector('[cmdk-root]') }))()`).o;
    if (open === true) return true;
    evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`);
    await sleep(900);
  }
  return false;
};
const closePalette = async () => {
  // CDP trusted Escape — Radix Dialog only honors real keys (Task 111);
  // peels ONE layer: the palette, the inspector behind it survives
  sh(`${AB} press Escape`);
  await sleep(700);
  const open = J(`(() => ({ o: !!document.querySelector('[cmdk-root]') }))()`).o;
  return open === false;
};
/** the palette's close() is a React state write — the unmount lands a tick
 *  after the click; poll instead of asserting synchronously (t111 一折) */
const palGonePoll = async () => {
  for (let i = 0; i < 10; i++) {
    const g = J(`(() => ({ g: !document.querySelector('[cmdk-root]') }))()`).g;
    if (g === true) return true;
    await sleep(300);
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
const paletteProbe = `(() => {
  const hs = [...document.querySelectorAll('[cmdk-group-heading]')].map(h => (h.textContent || '').trim());
  const items = [...document.querySelectorAll('[cmdk-item]')];
  const copyRows = items.filter(x => (x.getAttribute('data-canvas-ui') || '').startsWith('palette-chart-copy-'));
  return {
    headings: hs,
    exportGroup: hs.some(h => h.includes('Export chart data')),
    copyGroup: hs.some(h => h.includes('Copy chart data')),
    copyRowCount: copyRows.length,
    copySuffixes: copyRows.map(x => (x.textContent || '').includes('tsv · clipboard')),
    copyIds: copyRows.map(x => x.getAttribute('data-canvas-ui')),
  };
})()`;

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
      const has = J(`(() => {
        const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('${HOST_JOB}'));
        return { m: !!dl };
      })()`).m;
      if (has === true) return true;
    }
    step(`  openInspector iter ${i}`);
    await sleep(2000);
  }
  return false;
};

const openResults = async () => {
  let tab = "";
  for (let i = 0; i < 8 && !tab.includes("tab"); i++) {
    tab = evalJs(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.trim()==='Results'); t ? t.click() : 0; return t ? 'tab' : 'NO-TAB'; })()`);
    await sleep(1200);
  }
  let ok = null;
  for (let i = 0; i < 15 && !ok; i++) {
    await sleep(1500);
    ok = J(`(() => {
      const b = document.querySelector('[data-canvas-ui=chart-export][data-chart-name="FSC curve"]');
      if (!b) return null;
      return { rows: b.getAttribute('data-has-rows') };
    })()`);
    if (ok && ok.rows === "1") return true;
  }
  return false;
};

// ---------- phases ----------
const phaseS = async () => {
  console.log("== PHASE S: seed + palette shows both chart groups ==");
  sh(`${SEED} >/dev/null 2>&1`);
  if (!(await bootCanvas())) throw new Error("canvas never showed the host card");
  must(await openInspector(), "inspector opened on the host job");
  must(await openPalette(), "palette opened via Ctrl+K");
  const p = J(paletteProbe);
  must(p.exportGroup === true, "Export chart data group present");
  must(p.copyGroup === true, "Copy chart data group present (Task 113)");
  must(p.copyRowCount === 6, `copy group carries six rows (got ${p.copyRowCount})`);
  must(p.copySuffixes.every(Boolean), "every copy row carries the tsv · clipboard suffix");
  must(p.copyIds.length === 6 && p.copyIds.every(id => /^palette-chart-copy-(fsc|guinier|resolution|ctf|topaz|angdist)$/.test(id)),
    `copy rows carry per-chart probe testids (got ${p.copyIds.join(",")})`);
  await closePalette();
  step("PHASE S GREEN");
};

const phaseA = async () => {
  console.log("== PHASE A: palette copy — spy, payload, toast ==");
  evalJs(armToasts);
  evalJs(armTextSpy);
  must(await openPalette(), "palette re-opened");
  // click by TESTID, not by text — 'FSC curve' matches BOTH groups' rows
  // and the export row would win the text find (t111's opening mistake)
  const c2 = await realClick(`document.querySelector('[data-canvas-ui="palette-chart-copy-fsc"]')`);
  must(String(c2).startsWith("clicked@"), `Copy FSC row clicked (${c2})`);
  const payload = await textLast();
  must(payload !== "TIMEOUT" && payload.length > 0, "clipboard spy captured the TSV payload");
  must(await palGonePoll(), "palette closed after the copy entry");
  must(payload.split("\n").length === 42, `header + 41 FSC rows (got ${payload.split("\n").length} lines)`);
  must(payload.includes("\t"), "payload is tab-separated");
  must(!payload.endsWith("\n"), "no trailing newline — pasting mints no empty row");
  must(payload.split("\n")[0].includes("resolution"), `header names the columns (got "${payload.split("\n")[0].slice(0, 60)}")`);
  const to = toasts();
  must(to.includes("FSC curve copied"), `success toast present (got "${to}")`);
  must(to.includes("as TSV — paste straight into a spreadsheet"), "toast wording mirrors the chart domain");
  step("PHASE A GREEN");
};

const phaseB = async () => {
  console.log("== PHASE B: chart TSV button — payload equality with the palette's ==");
  // the Results tab must be live for the chart's own buttons
  must(await openResults(), "Results tab live with FSC rows");
  // preserve the palette's payload BEFORE re-arming — armTextSpy resets the
  // recorder array (t111 二折: the re-arm wiped the very payload we came
  // to compare against)
  const palPayload = J(`(() => { const a = window.__t111Texts || []; return { p: a.length ? a[a.length - 1] : '' }; })()`).p;
  must(palPayload.length > 0, "palette payload preserved from phase A");
  evalJs(armTextSpy);
  const btn = await realClick(`document.querySelector('[data-canvas-ui=chart-export][data-chart-name="FSC curve"] [data-canvas-ui=chart-export-csv-copy]')`);
  must(String(btn).startsWith("clicked@"), `chart's Copy TSV button clicked (${btn})`);
  const chartPayload = await textLast();
  must(chartPayload !== "TIMEOUT" && chartPayload.length > 0, "chart button payload captured");
  must(palPayload === chartPayload,
    `palette and chart payloads are STRING-IDENTICAL (${chartPayload.length} chars)`);
  step("PHASE B GREEN");
};

const phaseN = async () => {
  console.log("== PHASE N: no-data honesty — Copy Topaz on a non-topaz job ==");
  evalJs(armToasts);
  must(await openPalette(), "palette opened");
  const nBefore = textCount();
  const c = await realClick(`document.querySelector('[data-canvas-ui="palette-chart-copy-topaz"]')`);
  must(String(c).startsWith("clicked@"), `Copy Topaz row clicked (${c})`);
  let to = "";
  for (let i = 0; i < 16; i++) {
    to = toasts();
    if (to.includes("no data yet")) break;
    await sleep(500);
  }
  must(to.includes("Topaz training: no data yet"), `honest empty toast (got "${to}")`);
  must(to.includes("there is nothing to copy"), "copy-flavored empty description");
  must(textCount() === nBefore, "NO clipboard write for empty rows");
  await closePalette().catch(() => {});
  step("PHASE N GREEN");
};

const phaseC = async () => {
  console.log("== PHASE C: honest failure — reject spy ==");
  evalJs(armToasts);
  evalJs(armRejectSpy);
  must(await openPalette(), "palette opened");
  const nBefore = textCount();
  const c = await realClick(`document.querySelector('[data-canvas-ui="palette-chart-copy-fsc"]')`);
  must(String(c).startsWith("clicked@"), `Copy FSC row clicked against reject spy (${c})`);
  let to = "";
  for (let i = 0; i < 16; i++) {
    to = toasts();
    if (to.includes("could not be copied")) break;
    await sleep(500);
  }
  must(to.includes("could not be copied"), `destructive toast (got "${to}")`);
  must(to.includes("use the CSV export instead"), "failure points at the palette's own CSV door");
  must(textCount() === nBefore, "reject spy captured nothing — no fake success");
  await closePalette().catch(() => {});
  step("PHASE C GREEN");
};

const phaseD = async () => {
  console.log("== PHASE D: no target — no chart groups ==");
  // peel the inspector (its Escape calls inspect(null) → inspectId gone)
  sh(`${AB} press Escape`);
  await sleep(900);
  // then clear the canvas SELECTION the way a user does: one click with no
  // movement on the background → select(null) — inspectId alone leaving
  // would NOT clear it (inspect(null) keeps the selection by design)
  const spot = J(`(() => {
    const sec = document.querySelector('[data-canvas="viewport"]');
    if (!sec) return null;
    const r = sec.getBoundingClientRect();
    const cands = [[0.16, 0.82], [0.85, 0.85], [0.12, 0.55], [0.5, 0.92]];
    for (const [fx, fy] of cands) {
      const x = Math.round(r.x + r.width * fx), y = Math.round(r.y + r.height * fy);
      const top = document.elementFromPoint(x, y);
      if (!top) continue;
      if (top.closest('[data-job]') || top.closest('[role="button"]') || top.closest('[role="dialog"]')) continue;
      if (sec.contains(top)) return { x, y };
    }
    return null;
  })()`);
  must(spot !== null && Number.isFinite(spot.x), `empty canvas spot found (${JSON.stringify(spot)})`);
  sh(`${AB} mouse move ${spot.x} ${spot.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  await sleep(700);
  must(await openPalette(), "palette opened with no target");
  const p = J(paletteProbe);
  must(p.copyGroup === false && p.exportGroup === false,
    `neither chart group renders without a target (copy=${p.copyGroup}, export=${p.exportGroup})`);
  await closePalette().catch(() => {});
  step("PHASE D GREEN");
};

const phaseF = () => {
  console.log("== PHASE F: static contracts ==");
  const src = readFileSync("/home/z/my-project/src/components/workflow/command-palette.tsx", "utf8");
  const lib = readFileSync("/home/z/my-project/src/lib/chart-export.ts", "utf8");
  const rowsLib = readFileSync("/home/z/my-project/src/lib/chart-rows.ts", "utf8");

  must((src.match(/fetchJsonRetry<unknown>/g) || []).length === 1,
    "ONE fetch-and-derive — both doors read the same fetchChartRows");
  must(src.includes("const fetchChartRows = async") && (src.match(/await fetchChartRows\(/g) || []).length === 2,
    "export + copy both consume fetchChartRows");
  must(src.includes('copyTextToClipboard, rowsToTsv, type CsvRow') , "clipboard primitives imported from chart-export");
  must(lib.includes("export function rowsToTsv(") && lib.includes("export async function copyTextToClipboard("),
    "chart-export still owns the paste dialect + the write primitive");
  must(rowsLib.includes("export const CHART_EXPORT_TARGETS"), "row registry single-sourced in chart-rows");
  must((src.match(/palette-chart-copy-/g) || []).length === 1, "copy rows carry the probe testid template");
  must(src.includes(`value={\`copy \${t.label} tsv clipboard chart data`), "search value carries copy/tsv/clipboard keywords");
  must(src.includes("tsv · clipboard"), "row suffix names the destination");
  must(src.includes("as TSV — paste straight into a spreadsheet"), "success wording mirrors the chart domain");
  must(src.includes("Clipboard access was blocked — use the CSV export instead."), "failure wording points at the palette's CSV door");
  must(src.includes("there is nothing to copy"), "empty-state wording is copy-flavored");
  must(src.includes("Copy chart data · "), "group heading names the host job");
  must(!src.includes("chartPngBlob"), "PNG copy stays palette-excluded (needs a mounted SVG — Task 110 decision)");
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
    .filter((l) => l.trim() && !l.includes("✗"));
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
    await phaseC();
    await phaseD();
    phaseF();
    await phaseZ();
    console.log(`T111 ALL PASS (${PASSED} assertions)`);
    process.exit(0);
  } catch (e) {
    step(`FATAL: ${e.message}`);
    console.error(`FATAL: ${e.message}`);
    try { sh(`${AB} close`); } catch { /* already gone */ }
    process.exit(1);
  }
})();
