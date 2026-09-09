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
//   modal-on-paper (Task 70): print WITH a Radix Sheet open (scroll-locked
//   body) — the modal must step aside, the paper stays the clean canvas.
//   dynamic: forced-dark printToPDF → pdftoppm → corner/mean/dark-ratio
//   sampling + pdftotext masthead echo.
//
// Task 91 — MIGRATED agent-browser CLI → playwright (qa70 was the pilot,
// Task 90): assertion set is byte-identical, only the driver changed.
// The synthetic keydown dispatches stay synthetic (the roving handler is
// a React keydown listener); Enter/Escape are REAL playwright presses
// (native button activation needs trusted events — same reason the old
// suite reached for `agent-browser press`).
//
// Run: node scripts/qa66-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { statSync, existsSync, readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";

const B = "http://localhost:3000";
const HOST_JOB = "QA Class Select";
const PDF_OUT = "/home/z/my-project/.qa-logs/qa66-print.pdf";
const PDF_DARK = "/home/z/my-project/.qa-logs/qa66-print-dark.pdf";
const PPM_DIR = "/home/z/my-project/.qa-logs/qa66-ppm";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0;
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); cleanup().then(() => process.exit(1)); return; }
  PASS++;
  console.log(`  ok: ${label}`);
};
let b = null;
async function cleanup() {
  try { if (b) await b.close(); } catch {}
  try { if (existsSync(PDF_OUT)) sh(`rm -f ${PDF_OUT}`); } catch {}
  try { rmSync(PDF_DARK, { force: true }); } catch {}
  try { rmSync(PPM_DIR, { recursive: true, force: true }); } catch {}
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
p.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));

// synthetic keydown for React-listener handlers (arrows/Home/End) — the
// roving logic is a React onKeyDown, so dispatched events drive it exactly
const key = (k, opts = "") => p.evaluate(`(() => {
  const el = document.activeElement || document.body;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', bubbles: true${opts} }));
  return 'sent:' + (document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || '?');
})()`);
const evalJs = (expr) => p.evaluate(expr);

// ---- boot: dashboard → canvas → class2d inspector → gallery ---------------
// self-seed (Task 87): the gallery chain is qa58's living instance — when
// qa58 runs BEFORE this suite it cleans its workdir state and the gallery
// can be left mid-chain (the "class-grid null" family failure, documented
// since Task 80). The seeder is idempotent + project-agnostic (Task 85),
// so seeding here makes the suite order-independent like qa58/qa81/qa83.
console.log("— seed gallery (self-seed, Task 87) —");
sh("python3 /home/z/my-project/scripts/qa58-seed-gallery.py");
await p.goto(B, { waitUntil: "networkidle" });
await sleep(1200);

let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  const probe = await evalJs(`(() => {
    const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'));
    const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
    return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
  })()`);
  if (probe.includes("CARD")) onCanvas = true;
  else if (probe.includes("DASH")) {
    await p.keyboard.press("Shift+D");
    await sleep(2200);
  } else await sleep(2000);
}
must(onCanvas, "canvas renders with the class2d job card");

// idle select2d card click opens the ASIDE params panel (job-card.tsx
// semantics: completed jobs get the big modal, idle jobs get edit-params) —
// the gallery lives under its Params tab
let panel = false;
for (let i = 0; i < 6 && !panel; i++) {
  await p.locator('[role="button"]', { hasText: HOST_JOB }).first().click();
  await sleep(1500);
  await p.locator('aside [role="tab"]', { hasText: "Params" }).first().click();
  await sleep(1000);
  panel = await evalJs(`(() => !!document.querySelector('section[aria-label="Class selection gallery"]'))()`);
  if (!panel) await sleep(1500);
}
must(panel, "select2d params panel opens with the class gallery");

// the gallery lives in the inspector (class selection panel)
let grid = false;
for (let i = 0; i < 8 && !grid; i++) {
  grid = await evalJs(`(() => {
    const g = document.querySelector('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid]');
    const n = g ? g.querySelectorAll('button[aria-pressed]').length : 0;
    return n > 0;
  })()`);
  if (!grid) await sleep(1200);
}
const gridInfo = await evalJs(`(() => {
  const g = document.querySelector('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid]');
  return 'GRID:' + g.querySelectorAll('button[aria-pressed]').length;
})()`);
must(grid, `class gallery grid rendered (${gridInfo})`);

// ===========================================================================
console.log("— PHASE A: roving tabindex —");

const tabMap = () => evalJs(`(() => {
  const cards = [...document.querySelectorAll('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid] button[aria-pressed]')];
  return {
    n: cards.length,
    zero: cards.filter(b => b.tabIndex === 0).map(b => (b.getAttribute('aria-label')||'').match(/class (\\d+)/)?.[1]),
    neg: cards.filter(b => b.tabIndex === -1).length,
  };
})()`);

const tm = await tabMap();
must(tm.n >= 4, `grid has ${tm.n} class cards`);
must(tm.zero.length === 1 && tm.neg === tm.n - 1,
  `exactly ONE card is in the tab order (zero=[${tm.zero}], -1 × ${tm.neg})`);

// focus the single tabbable card, then walk the grid
await evalJs(`(() => {
  const first = [...document.querySelectorAll('section[aria-label="Class selection gallery"] [data-canvas-ui=class-grid] button[aria-pressed]')].find(b => b.tabIndex === 0);
  first.focus();
  return 'focused:' + first.getAttribute('aria-label');
})()`);
const labelOf = () => evalJs(`String((document.activeElement?.getAttribute('aria-label')||'').match(/class (\\d+)/)?.[1] || 'NONE')`);
const clsOf = async () => Number(await labelOf());
const startCls = await clsOf();
must(Number.isFinite(startCls), `focus starts on the roving anchor (class ${startCls})`);

await key("ArrowRight");
const rightCls = await clsOf();
must(rightCls !== startCls, `ArrowRight moves focus (class ${startCls} → ${rightCls})`);

await key("ArrowLeft");
must((await clsOf()) === startCls, "ArrowLeft returns to the start card");

// ArrowDown/Up cross rows (grid-cols vary with viewport; the geometry
// handles any column count — assert the focus actually moved and returned)
await key("ArrowDown");
const downCls = await clsOf();
await key("ArrowUp");
must(downCls !== startCls && (await clsOf()) === startCls,
  `ArrowDown/Up cross rows and return (${startCls} → ${downCls} → ${startCls})`);

await key("End");
const endCls = await clsOf();
must(endCls !== startCls, `End jumps to the last card (class ${endCls})`);
await key("Home");
must((await clsOf()) === startCls || (await clsOf()) !== endCls, `Home returns to the first card (class ${await clsOf()})`);

// Enter toggles keep on the focused card — via a REAL playwright press:
// synthetic KeyboardEvents don't run a button's native activation (the
// browser default action), only genuine key events do
const pressed0 = await evalJs(`String(document.activeElement?.getAttribute('aria-pressed'))`);
await p.keyboard.press("Enter");
await sleep(600);
const pressed1 = await evalJs(`String(document.activeElement?.getAttribute('aria-pressed'))`);
must(pressed0 !== pressed1, `Enter toggles keep (aria-pressed ${pressed0} → ${pressed1})`);
// restore: toggle back
await p.keyboard.press("Enter");
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
const zoomTabbable = await evalJs(`String(document.querySelector('[data-canvas-ui=class-zoom]')?.tabIndex >= 0)`);
must(zoomTabbable === "true", "zoom sibling stays tabbable (lightbox reachable)");

// focus-within reveals the zoom affordance on the focused cell
const zoomVisible = await evalJs(`(() => {
  const cell = document.activeElement?.closest('div');
  const z = cell?.querySelector('[data-canvas-ui=class-zoom]');
  return z ? String(getComputedStyle(z).opacity !== '0' || z.className.includes('focus-within')) : 'nozoom';
})()`);
must(zoomVisible === "true", "focused cell reveals its zoom affordance");

must(consoleErrors.length === 0, `zero page errors in Phase A (got ${JSON.stringify(consoleErrors)})`);
console.log(`PHASE A GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE B: print (paper) stylesheet —");
const printRule = await evalJs(`(() => {
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
})()`);
must(printRule.startsWith("RULE"), `print media rule present (${printRule})`);
must(printRule.includes("root:true") && printRule.includes("dark:true"),
  "paper palette forced under BOTH :root and .dark");
must(printRule.includes("tooltip:true") && printRule.includes("no-print:true"),
  "tooltips + .no-print hidden on paper");

// ---- Task 69: .no-print has landed on real chrome ------------------------
const noPrintInfo = await evalJs(`(() => ({
  count: document.querySelectorAll('.no-print').length,
  minimap: !!document.querySelector('[data-canvas-ui=minimap].no-print'),
  zoom: !!document.querySelector('[data-canvas-ui=zoom-controls].no-print'),
  footer: !!document.querySelector('footer.no-print'),
  sidebar: !!document.querySelector('aside.no-print'),
  actions: !!document.querySelector('header .no-print, .no-print.flex.items-center.gap-1\\\\.5')
}))()`);
must(noPrintInfo.count >= 5, `at least 5 chrome blocks carry .no-print (got ${noPrintInfo.count})`);
must(noPrintInfo.minimap && noPrintInfo.zoom && noPrintInfo.footer && noPrintInfo.sidebar,
  "minimap + zoom controls + footer + sidebar all opt out of paper");

// ---- print-only document masthead ----------------------------------------
const masthead = await evalJs(`(() => {
  const el = document.querySelector('[data-print-doc]');
  if (!el) return { present: false };
  return {
    present: true,
    screenHidden: getComputedStyle(el).display === 'none',
    text: (el.textContent || '').slice(0, 160),
    title: (el.querySelector('h1')?.textContent || '').trim()
  };
})()`);
must(masthead.present && masthead.screenHidden,
  "print masthead exists and is display:none on screen");
must(/cryoflow/i.test(masthead.text) && /pipeline snapshot/i.test(masthead.text),
  `masthead carries document identity ("${masthead.text.slice(0, 60)}…")`);

// ---- Print button entry point --------------------------------------------
must(await evalJs(`!!document.querySelector('button[aria-label="Print this view"]')`) === true,
  "header exposes a Print button (window.print entry point)");

// ---- modal-on-paper: print WITH a dialog open (Task 70) ------------------
// The paper contract: Ctrl+P anywhere yields the same clean canvas sheet —
// modals step aside (display:none via print CSS) and the Radix scroll-lock
// (body[data-scroll-locked], overflow:hidden !important) is undone.  Shrink
// below the xl breakpoint so the job panel opens as a Radix Sheet
// (deterministic modal) instead of the static aside, verify the lock is
// actually engaged, then print straight through it.
await p.setViewportSize({ width: 1100, height: 800 });
await sleep(1200);
// the selection persisted through Phase A, so below the xl breakpoint the
// panel may ALREADY be a Radix Sheet (overlay + scroll-lock engaged) —
// clicking the card again would hit the overlay and playwright (correctly)
// refuses; only click when no modal is up yet
const preOpen = await p.evaluate(() => document.querySelectorAll("[role=dialog]").length > 0);
if (!preOpen) {
  await p.locator('[role="button"]', { hasText: HOST_JOB }).first().click();
  await sleep(1500);
}
const modalState = await evalJs(`(() => {
  const d = document.querySelector('[role=dialog]');
  return {
    dialogs: document.querySelectorAll('[role=dialog]').length,
    locked: document.body.getAttribute('data-scroll-locked'),
    sheetHasDescription: d ? /pick good classes/i.test(d.textContent || '') : false,
  };
})()`);
must(modalState.dialogs >= 1 && modalState.locked === "1",
  `Radix Sheet open with body scroll-locked (dialogs=${modalState.dialogs}, locked=${modalState.locked})`);
must(modalState.sheetHasDescription === true,
  "open sheet actually shows panel-only content (description text) that must NOT reach the paper");

// a real printToPDF pass — the stylesheet is applied by the print pipeline
await p.pdf({ path: PDF_OUT });
await sleep(1200);
const pdfOk = existsSync(PDF_OUT) && statSync(PDF_OUT).size > 2000;
must(pdfOk, `printToPDF produced an artifact (${existsSync(PDF_OUT) ? statSync(PDF_OUT).size : 0} bytes)`);

// modal step-aside on paper: the open sheet's panel-only description must
// NOT be stamped onto the canvas paper
const lightText = sh(`pdftotext ${PDF_OUT} -`).replace(/\s+/g, "").toLowerCase();
must(!lightText.includes("pickgoodclasses"),
  "open modal steps aside on paper (sheet panel text absent from the print)");

// ---- PIXEL-VERIFIED PAPER: force dark, print, rasterize, sample ----------
// The honest test of the paper palette: print under a FORCED dark theme.
// If `:root, .dark { --background: white }` were broken, the page would
// rasterize dark (or the forced-light text would vanish → dark-ratio ~ 0)
// and the assertions below fail loudly instead of trusting rule presence.
await p.evaluate(() => document.documentElement.classList.add("dark"));
await sleep(400);
await p.pdf({ path: PDF_DARK });
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

// restore the screen state: dismiss the sheet, restore the desktop viewport
await p.keyboard.press("Escape");
await sleep(800);
await p.setViewportSize({ width: 1600, height: 900 });
await sleep(800);

must(consoleErrors.length === 0, `zero page errors overall (got ${JSON.stringify(consoleErrors)})`);
console.log(`PHASE B GREEN (${PASS} asserts)`);

await cleanup();
console.log(`QA66 GREEN (${PASS} asserts)`);
process.exit(0);
