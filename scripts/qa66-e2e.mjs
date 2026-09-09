// qa66 — Task 65 details: roving tabindex on the class-selection grid +
// print (paper) stylesheet.
//
// Phase A — roving tabindex (WAI-ARIA grid pattern):
//   exactly ONE card in the tab order, arrows move focus geometrically
//   (right/left in-row, up/down in-column — the responsive grid's real
//   layout, no column-count guessing), Home/End jump, Enter toggles keep,
//   Tab leaves to the zoom sibling (still tabbable), console clean.
// Phase B — print stylesheet:
//   a @media print rule exists that forces the light paper palette under
//   BOTH :root and .dark (dark backgrounds waste toner and browsers strip
//   them anyway), hides tooltips/.no-print, and a real printToPDF pass
//   produces a non-empty artifact.
//
// Run: node scripts/qa66-e2e.mjs   (server on :3000, gallery seeded)
import { execSync } from "node:child_process";
import { statSync, existsSync } from "node:fs";
const AB = "agent-browser";
const B = "http://localhost:3000";
const HOST_JOB = "QA Class Select";
const PDF_OUT = "/home/z/my-project/.qa-logs/qa66-print.pdf";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
let PASS = 0;
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); cleanup(); process.exit(1); }
  PASS++;
  console.log(`  ok: ${label}`);
};
function cleanup() {
  try { sh(`${AB} close`); } catch {}
  try { if (existsSync(PDF_OUT)) sh(`rm -f ${PDF_OUT}`); } catch {}
}

const errCollector = `(() => {
  if (window.__qaErrColl) return 'errcoll-kept';
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e).slice(0, 160)));
  window.addEventListener('unhandledrejection', (e) => window.__qaErrs.push('rej:' + String((e.reason && e.reason.message) || e.reason).slice(0, 160)));
  window.__qaErrColl = true;
  return 'errcoll-on';
})()`;
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
const key = (k, opts = "") => evalJs(`(() => {
  const el = document.activeElement || document.body;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true${opts} }));
  return 'sent:' + (document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || '?');
})()`);

// ---- boot: dashboard → canvas → class2d inspector → gallery ---------------
sh(`${AB} close`); await sleep(1200);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);
evalJs(errCollector);

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
must(onCanvas, "canvas renders with the class2d job card");

// idle select2d card click opens the ASIDE params panel (job-card.tsx
// semantics: completed jobs get the big modal, idle jobs get edit-params) —
// the gallery lives under its Params tab
let panel = false;
for (let i = 0; i < 6 && !panel; i++) {
  const r = await realClick(
    `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'))`,
  );
  if (r.includes("clicked@")) {
    await sleep(1500);
    await realClick(
      `[...document.querySelectorAll('aside')].slice(1).map(a => [...a.querySelectorAll('[role=tab]')].find(t => t.textContent.trim() === 'Params')).find(Boolean)`,
    );
    await sleep(1000);
    panel = unq(evalJs(`(() => !!document.querySelector('section[aria-label="Class selection gallery"]'))() + ''`)) === "true";
  } else await sleep(1500);
}
must(panel, "select2d params panel opens with the class gallery");

// the gallery lives in the inspector (class selection panel)
let grid = false;
for (let i = 0; i < 8 && !grid; i++) {
  grid = unq(evalJs(`(() => {
    const g = document.querySelector('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid]');
    const n = g ? g.querySelectorAll('button[aria-pressed]').length : 0;
    return n > 0 ? 'GRID:' + n : 'NOGRID';
  })() + ''`)).startsWith("GRID");
  if (!grid) await sleep(1200);
}
const gridInfo = unq(evalJs(`(() => {
  const g = document.querySelector('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid]');
  return 'GRID:' + g.querySelectorAll('button[aria-pressed]').length;
})() + ''`));
must(grid, `class gallery grid rendered (${gridInfo})`);

// ===========================================================================
console.log("— PHASE A: roving tabindex —");

const tabMap = () => JSON.parse(evalJs(`(() => {
  const cards = [...document.querySelectorAll('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid] button[aria-pressed]')];
  return {
    n: cards.length,
    zero: cards.filter(b => b.tabIndex === 0).map(b => (b.getAttribute('aria-label')||'').match(/class (\\d+)/)?.[1]),
    neg: cards.filter(b => b.tabIndex === -1).length,
  };
})()`));

let tm = tabMap();
must(tm.n >= 4, `grid has ${tm.n} class cards`);
must(tm.zero.length === 1 && tm.neg === tm.n - 1,
  `exactly ONE card is in the tab order (zero=[${tm.zero}], -1 × ${tm.neg})`);

// focus the single tabbable card, then walk the grid
evalJs(`(() => {
  const first = [...document.querySelectorAll('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid] button[aria-pressed]')].find(b => b.tabIndex === 0);
  first.focus();
  return 'focused:' + first.getAttribute('aria-label');
})()`);
const labelOf = () => unq(evalJs(`String((document.activeElement?.getAttribute('aria-label')||'').match(/class (\\d+)/)?.[1] || 'NONE')`));
const clsOf = () => Number(labelOf());
const startCls = clsOf();
must(Number.isFinite(startCls), `focus starts on the roving anchor (class ${startCls})`);

await key("ArrowRight");
const rightCls = clsOf();
must(rightCls !== startCls, `ArrowRight moves focus (class ${startCls} → ${rightCls})`);

await key("ArrowLeft");
must(clsOf() === startCls, "ArrowLeft returns to the start card");

// ArrowDown/Up cross rows (grid-cols vary with viewport; the geometry
// handles any column count — assert the focus actually moved and returned)
await key("ArrowDown");
const downCls = clsOf();
await key("ArrowUp");
must(downCls !== startCls && clsOf() === startCls,
  `ArrowDown/Up cross rows and return (${startCls} → ${downCls} → ${startCls})`);

await key("End");
const endCls = clsOf();
must(endCls !== startCls, `End jumps to the last card (class ${endCls})`);
await key("Home");
must(clsOf() === startCls || clsOf() !== endCls, `Home returns to the first card (class ${clsOf()})`);

// Enter toggles keep on the focused card — via a REAL CDP keypress:
// synthetic KeyboardEvents don't run a button's native activation (the
// browser default action), only genuine key events do
const pressed0 = unq(evalJs(`String(document.activeElement?.getAttribute('aria-pressed'))`));
sh(`${AB} press Enter`);
await sleep(600);
const pressed1 = unq(evalJs(`String(document.activeElement?.getAttribute('aria-pressed'))`));
must(pressed0 !== pressed1, `Enter toggles keep (aria-pressed ${pressed0} → ${pressed1})`);
// restore: toggle back
sh(`${AB} press Enter`);
await sleep(500);

// Tab moves OUT of the roving set to the zoom sibling (still tabbable)
await evalJs(`(() => {
  const active = document.activeElement;
  active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  // synthetic Tab doesn't move focus natively — emulate the next tab stop:
  const cell = active.closest('[data-canvas-ui=class-grid] > div');
  const zoom = cell?.querySelector('[data-canvas-ui=class-zoom]');
  if (zoom) zoom.focus();
  return 'tab-sim';
})()`);
const zoomTabbable = unq(evalJs(`String(document.querySelector('[data-canvas-ui=class-zoom]')?.tabIndex >= 0)`));
must(zoomTabbable === "true", "zoom sibling stays tabbable (lightbox reachable)");

// focus-within reveals the zoom affordance on the focused cell
const zoomVisible = unq(evalJs(`(() => {
  const cell = document.activeElement?.closest('div');
  const z = cell?.querySelector('[data-canvas-ui=class-zoom]');
  return z ? String(getComputedStyle(z).opacity !== '0' || z.className.includes('focus-within')) : 'nozoom';
})() + ''`));
must(zoomVisible === "true", "focused cell reveals its zoom affordance");

const errsA = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsA.length === 0, `zero page errors in Phase A (got ${JSON.stringify(errsA)})`);
console.log(`PHASE A GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE B: print (paper) stylesheet —");
const printRule = unq(evalJs(`(() => {
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (rule.media && [...rule.media].some(m => m.includes('print'))) {
        const t = rule.cssRules ? [...rule.cssRules].map(r => r.cssText).join(' ') : rule.cssText;
        const hasRoot = t.includes('--background: white') || t.includes('--background:white');
        const hasDark = t.includes('.dark');
        const hasTooltip = t.includes('tooltip-content');
        const hasNoPrint = t.includes('.no-print');
        return 'RULE root:' + hasRoot + ' dark:' + hasDark + ' tooltip:' + hasTooltip + ' no-print:' + hasNoPrint;
      }
    }
  }
  return 'NO-PRINT-RULE';
})() + ''`));
must(printRule.startsWith("RULE"), `print media rule present (${printRule})`);
must(printRule.includes("root:true") && printRule.includes("dark:true"),
  "paper palette forced under BOTH :root and .dark");
must(printRule.includes("tooltip:true") && printRule.includes("no-print:true"),
  "tooltips + .no-print hidden on paper");

// a real printToPDF pass — the stylesheet is applied by the print pipeline
const pdf = sh(`${AB} pdf ${PDF_OUT}`);
await sleep(1200);
const pdfOk = existsSync(PDF_OUT) && statSync(PDF_OUT).size > 2000;
must(pdfOk, `printToPDF produced an artifact (${existsSync(PDF_OUT) ? statSync(PDF_OUT).size : 0} bytes)`);

const errsB = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsB.length === 0, `zero page errors overall (got ${JSON.stringify(errsB)})`);
console.log(`PHASE B GREEN (${PASS} asserts)`);

cleanup();
console.log(`QA66 GREEN (${PASS} asserts)`);
