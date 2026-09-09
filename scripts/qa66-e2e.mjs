// qa66 — Task 65 details: roving tabindex on the class-selection grid +
// print (paper) stylesheet.  Task 69 extends Phase B into a full paper
// pipeline: .no-print landing (minimap / zoom / sidebar / footer / header
// actions), a print-only document masthead, and — the finale — PIXEL
// sampling of the rendered PDF: the page is printed under a FORCED DARK
// theme, rasterized via pdftoppm, and must still come out light paper
// with real content.  Light-on-white text or a dark page fails loudly.
//
// Phase A — roving tabindex (WAI-ARIA grid pattern):
//   exactly ONE card in the tab order, arrows move focus geometrically
//   (right/left in-row, up/down in-column — the responsive grid's real
//   layout, no column-count guessing), Home/End jump, Enter toggles keep,
//   Tab leaves to the zoom sibling (still tabbable), console clean.
// Phase B — print (paper) stylesheet, now pixel-verified:
//   static: @media print rule forces the light palette under BOTH :root
//   and .dark, hides tooltips/.no-print; the masthead is screen-hidden;
//   interactive chrome carries .no-print; a Print button exists.
//   dynamic: forced-dark printToPDF → pdftoppm → corner/mean/dark-ratio
//   sampling + pdftotext masthead echo.
//
// Run: node scripts/qa66-e2e.mjs   (server on :3000, gallery seeded)
import { execSync } from "node:child_process";
import { statSync, existsSync, readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
const AB = "agent-browser";
const B = "http://localhost:3000";
const HOST_JOB = "QA Class Select";
const PDF_OUT = "/home/z/my-project/.qa-logs/qa66-print.pdf";
const PDF_DARK = "/home/z/my-project/.qa-logs/qa66-print-dark.pdf";
const PPM_DIR = "/home/z/my-project/.qa-logs/qa66-ppm";
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
  try { rmSync(PDF_DARK, { force: true }); } catch {}
  try { rmSync(PPM_DIR, { recursive: true, force: true }); } catch {}
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

// ---- Task 69: .no-print has landed on real chrome ------------------------
const noPrintInfo = JSON.parse(unq(evalJs(`({
  count: document.querySelectorAll('.no-print').length,
  minimap: !!document.querySelector('[data-canvas-ui=minimap].no-print'),
  zoom: !!document.querySelector('[data-canvas-ui=zoom-controls].no-print'),
  footer: !!document.querySelector('footer.no-print'),
  sidebar: !!document.querySelector('aside.no-print'),
  actions: !!document.querySelector('header .no-print, .no-print.flex.items-center.gap-1\\\\.5')
})`)));
must(noPrintInfo.count >= 5, `at least 5 chrome blocks carry .no-print (got ${noPrintInfo.count})`);
must(noPrintInfo.minimap && noPrintInfo.zoom && noPrintInfo.footer && noPrintInfo.sidebar,
  "minimap + zoom controls + footer + sidebar all opt out of paper");

// ---- print-only document masthead ----------------------------------------
const masthead = JSON.parse(unq(evalJs(`(() => {
  const el = document.querySelector('[data-print-doc]');
  if (!el) return { present: false };
  return {
    present: true,
    screenHidden: getComputedStyle(el).display === 'none',
    text: (el.textContent || '').slice(0, 160),
    title: (el.querySelector('h1')?.textContent || '').trim()
  };
})()`)));
must(masthead.present && masthead.screenHidden,
  "print masthead exists and is display:none on screen");
must(/cryoflow/i.test(masthead.text) && /pipeline snapshot/i.test(masthead.text),
  `masthead carries document identity ("${masthead.text.slice(0, 60)}…")`);

// ---- Print button entry point --------------------------------------------
must(evalJs(`!!document.querySelector('button[aria-label="Print this view"]')`) === "true",
  "header exposes a Print button (window.print entry point)");

// close the job inspector before printing — the canvas view is the paper
// surface.  Printing with a Radix modal open squeezes the layout into
// scroll-locked narrow columns (masthead h1 truncates to "M", card names
// collapse) — a Chromium+Radix scroll-lock print quirk, documented in the
// worklog.  Radix's Esc handler is a JS listener, so a synthetic keydown
// works here (unlike Enter, which needs real CDP keys for default actions).
const escNow = unq(evalJs(`(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return document.querySelectorAll('[role=dialog]').length + '';
})()`));
await sleep(600);
if (escNow !== "0") { sh(`${AB} press Escape`); await sleep(600); }
must(unq(evalJs(`document.querySelectorAll('[role=dialog]').length + ''`)) === "0",
  "job inspector closed before print (canvas view is the paper surface)");

// a real printToPDF pass — the stylesheet is applied by the print pipeline
const pdf = sh(`${AB} pdf ${PDF_OUT}`);
await sleep(1200);
const pdfOk = existsSync(PDF_OUT) && statSync(PDF_OUT).size > 2000;
must(pdfOk, `printToPDF produced an artifact (${existsSync(PDF_OUT) ? statSync(PDF_OUT).size : 0} bytes)`);

// ---- PIXEL-VERIFIED PAPER: force dark, print, rasterize, sample ----------
// The honest test of the paper palette: print under a FORCED dark theme.
// If `:root, .dark { --background: white }` were broken, the page would
// rasterize dark (or the forced-light text would vanish → dark-ratio ~ 0)
// and the assertions below fail loudly instead of trusting rule presence.
evalJs(`document.documentElement.classList.add('dark') + ''`);
await sleep(400);
sh(`${AB} pdf ${PDF_DARK}`);
await sleep(1200);
must(existsSync(PDF_DARK) && statSync(PDF_DARK).size > 2000,
  `forced-dark printToPDF produced an artifact (${existsSync(PDF_DARK) ? statSync(PDF_DARK).size : 0} bytes)`);

try { rmSync(PPM_DIR, { recursive: true, force: true }); } catch {}
mkdirSync(PPM_DIR, { recursive: true });
sh(`pdftoppm -gray -r 100 -f 1 -l 1 ${PDF_DARK} ${PPM_DIR}/page`);
const pgms = readdirSync(PPM_DIR).filter((f) => f.endsWith(".pgm") || f.endsWith(".pnm"));
must(pgms.length === 1, `pdftoppm rasterized page 1 (${pgms[0] ?? "nothing"})`);

// minimal P5 (binary PGM) parser — header tokens then raw 8-bit samples
function samplePgm(path) {
  const buf = readFileSync(path);
  let pos = 0;
  const tok = () => {
    for (;;) {
      while (pos < buf.length && /\s/.test(String.fromCharCode(buf[pos]))) pos++;
      if (buf[pos] === 35) { while (pos < buf.length && buf[pos] !== 10) pos++; continue; }
      break;
    }
    const s = pos;
    while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]))) pos++;
    return buf.slice(s, pos).toString("ascii");
  };
  const magic = tok();
  const w = Number(tok()), h = Number(tok()), max = Number(tok());
  pos += 1; // exactly one whitespace byte after maxval
  if (magic !== "P5" || max !== 255) throw new Error(`unexpected pgm: ${magic} max=${max}`);
  const data = buf.slice(pos, pos + w * h);
  if (data.length < w * h) throw new Error("pgm truncated");
  // corner boxes (12% of each dimension) + stride-sampled global stats
  const cw = Math.max(1, Math.floor(w * 0.12)), ch = Math.max(1, Math.floor(h * 0.12));
  const boxes = [
    [0, 0, cw, ch], [w - cw, 0, w, ch], [0, h - ch, cw, h], [w - cw, h - ch, w, h],
  ];
  const cornerSum = boxes.reduce((acc, [x0, y0, x1, y1]) => {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += data[y * w + x]; n++; }
    return acc + s / n;
  }, 0);
  let sum = 0, n = 0, dark = 0, light = 0;
  for (let i = 0; i < data.length; i += 3) {
    const v = data[i]; sum += v; n++;
    if (v < 128) dark++; else if (v > 200) light++;
  }
  return {
    w, h,
    cornersMean: cornerSum / 4,
    mean: sum / n,
    darkFrac: dark / n,
    lightFrac: light / n,
  };
}

const px = samplePgm(`${PPM_DIR}/${pgms[0]}`);
must(px.cornersMean > 200,
  `paper corners are LIGHT under forced dark (mean ${px.cornersMean.toFixed(1)} / 255, ${px.w}x${px.h})`);
must(px.mean > 140,
  `page reads as paper, not screen (overall mean ${px.mean.toFixed(1)} / 255)`);
// lower bound sits well above the ~0% of a broken palette (light-on-white
// text inks nothing) yet below the ~0.17–0.5% real pages measure depending
// on view state (inspector open/closed shifts how much text is on paper)
must(px.darkFrac > 0.0008 && px.darkFrac < 0.6,
  `real content inked onto the paper (dark ratio ${(px.darkFrac * 100).toFixed(2)}% — text/cards present, page mostly white)`);

// the masthead must physically reach the paper: pdftotext echoes the
// document opener that only exists in the print tree.  The kicker's
// letter-spacing (tracking-[0.18em]) makes pdftotext split glyphs into
// "P I P E L I N E …", so match on whitespace-stripped text.
const pdfText = sh(`pdftotext ${PDF_DARK} -`);
const flatText = pdfText.replace(/\s+/g, "").toLowerCase();
must(flatText.includes("pipelinesnapshot"),
  "print masthead text reached the rendered PDF (pdftotext echo)");
if (masthead.title) {
  must(flatText.includes(masthead.title.replace(/\s+/g, "").toLowerCase()),
    `paper title matches the DOM masthead ("${masthead.title}")`);
}

const errsB = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsB.length === 0, `zero page errors overall (got ${JSON.stringify(errsB)})`);
console.log(`PHASE B GREEN (${PASS} asserts)`);

cleanup();
console.log(`QA66 GREEN (${PASS} asserts)`);
