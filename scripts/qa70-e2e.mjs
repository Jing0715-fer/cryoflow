// qa70 — Task 71: keyboard shortcuts dialog (discoverability layer).
//
// The app's keyboard layer (canvas power moves, roving gallery, layered
// Esc) grew invisible over Tasks 61–70. The "?" dialog is its discoverable
// surface with three doors (key, help-popover CTA, command palette) fed by
// ONE store flag and ONE data source.
//
// Phase A — the dialog itself:
//   "?" opens it (global key handler, guarded), five context groups render
//   with a real row inventory, the filter input narrows and restores rows,
//   Escape peels exactly one layer, console clean.
// Phase B — the other two doors + paper contract:
//   help popover CTA opens it; command palette entry opens it; printing
//   with the dialog open leaves the dialog text OFF the paper (Task 70
//   modal step-aside generalizes to the new dialog).
//
// Run: node scripts/qa70-e2e.mjs   (server on :3000, any state)
import { execSync } from "node:child_process";
import { statSync, existsSync } from "node:fs";
const AB = "agent-browser";
const B = "http://localhost:3000";
const PDF_OUT = "/home/z/my-project/.qa-logs/qa70-print.pdf";
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
// keyboard events for JS-listener handlers dispatch fine synthetically
// (the "?" handler is a window keydown listener, like Shift+D)
const pressSynthetic = (key, opts = "") => evalJs(`(() => {
  const el = document.activeElement || document.body;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true${opts} }));
  return 'sent';
})()`);
const realClick = async (findExpr) => {
  const coords = evalJs(
    `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`,
  );
  if (!coords || coords === "null" || coords === '"null"') return "NO-ELEMENT";
  const c = JSON.parse(JSON.parse(coords));
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};
const dialogOpen = () =>
  unq(evalJs(`(() => {
    const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent || '').includes('Keyboard shortcuts'));
    return (d ? 'open' : 'none') + '';
  })()`)) === "open";
const dialogsNow = () => unq(evalJs(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')];
  return JSON.stringify({ n: d.length, labels: d.map(x => (x.textContent || '').slice(0, 40)) });
})()`));
const closeDialog = async () => {
  // Esc from whatever holds focus (Radix autofocuses the filter input);
  // real CDP press first, synthetic fallback — then report what remains
  sh(`${AB} press Escape`);
  await sleep(600);
  if (dialogOpen()) {
    evalJs(`(() => { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'sent'; })()`);
    await sleep(600);
  }
  if (dialogOpen()) console.log(`  diag: dialogs still open after Esc: ${dialogsNow()}`);
};

// ===========================================================================
console.log("— PHASE A: ? opens the shortcuts dialog —");
sh(`${AB} close`); await sleep(1000);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);
evalJs(errCollector);

must(unq(evalJs(`(() => !!document.querySelector('[data-canvas=viewport], main'))() + ''`)) === "true",
  "app rendered (canvas or dashboard main)");

await pressSynthetic("?");
await sleep(800);
must(dialogOpen(), 'pressing "?" opens the shortcuts dialog');

const inv = JSON.parse(unq(evalJs(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent || '').includes('Keyboard shortcuts'));
  if (!d) return { sections: 0 };
  return {
    sections: d.querySelectorAll('section[aria-label$=" shortcuts"]').length,
    labels: [...d.querySelectorAll('section[aria-label$=" shortcuts"]')].map(s => s.getAttribute('aria-label')),
    chips: d.querySelectorAll('kbd').length,
    hasFilter: !!d.querySelector('input[aria-label="Filter shortcuts"]'),
    title: (d.querySelector('[data-slot=dialog-title]') || {}).textContent || ''
  };
})()`)));
must(inv.sections === 5, `five context groups render (got ${inv.sections})`);
must(/global/i.test(inv.labels.join("|")) && /gallery/i.test(inv.labels.join("|")),
  "groups span global → canvas → gallery contexts");
must(inv.chips >= 20, `real row inventory (${inv.chips} key chips across all groups)`);
must(inv.hasFilter, "filter input present");

// filter narrows to matching rows, clearing restores the full inventory
evalJs(`(() => {
  const inp = document.querySelector('input[aria-label="Filter shortcuts"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, 'zoom');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
await sleep(500);
const filtered = JSON.parse(unq(evalJs(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent || '').includes('Keyboard shortcuts'));
  return { chips: d.querySelectorAll('kbd').length, sections: d.querySelectorAll('section[aria-label$=" shortcuts"]').length };
})()`)));
must(filtered.chips > 0 && filtered.chips < inv.chips,
  `filter narrows the inventory (${inv.chips} → ${filtered.chips} chips)`);

evalJs(`(() => {
  const inp = document.querySelector('input[aria-label="Filter shortcuts"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, '');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'cleared';
})()`);
await sleep(400);
const restored = unq(evalJs(`(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent || '').includes('Keyboard shortcuts'));
  return d.querySelectorAll('kbd').length + '';
})()`));
must(Number(restored) === inv.chips, `clearing the filter restores all rows (${restored} chips)`);

await closeDialog();
must(!dialogOpen(), "Escape peels the dialog layer");
must(unq(evalJs(`document.querySelectorAll('[role=dialog]').length + ''`)) === "0",
  "no dialog remains (single-layer peel)");

const errsA = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsA.length === 0, `zero page errors in Phase A (got ${JSON.stringify(errsA)})`);
console.log(`PHASE A GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE B: the other two doors + paper contract —");

// door 2: help popover CTA
await realClick(`document.querySelector('button[aria-label="Help — how to use the workflow canvas"]')`);
await sleep(900);
must(unq(evalJs(`(() => !![...document.querySelectorAll('[role=dialog], [data-slot=popover-content]')].find(x => (x.textContent || '').includes('View all keyboard shortcuts')))() + ''`)) === "true",
  "help popover carries the shortcuts CTA");
await realClick(`[...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('View all keyboard shortcuts'))`);
await sleep(900);
must(dialogOpen(), "help-popover CTA opens the dialog");
await closeDialog();

// door 3: command palette entry
evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); 'sent'`);
await sleep(900);
must(unq(evalJs(`(() => !!document.querySelector('[role=dialog] input, [cmdk-root] input'))() + ''`)) === "true",
  "command palette opens (Ctrl/Cmd K)");
evalJs(`(() => {
  const inp = document.querySelector('[cmdk-root] input, [role=dialog] input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, 'shortcuts');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
await sleep(600);
await realClick(`[...document.querySelectorAll('[cmdk-item]')].find(x => (x.textContent || '').includes('Keyboard shortcuts'))`);
await sleep(900);
must(dialogOpen(), "command-palette entry opens the dialog");

// paper contract: the open dialog must step aside on print (Task 70 rule
// generalizes — [data-slot=dialog-content] display:none covers it)
sh(`${AB} pdf ${PDF_OUT}`);
await sleep(1200);
must(existsSync(PDF_OUT) && statSync(PDF_OUT).size > 2000,
  `printToPDF with the dialog open produced an artifact (${existsSync(PDF_OUT) ? statSync(PDF_OUT).size : 0} bytes)`);
const flat = sh(`pdftotext ${PDF_OUT} -`).replace(/\s+/g, "").toLowerCase();
must(!flat.includes("keyboardshortcuts") && !flat.includes("press?anywheretoreopen"),
  "open shortcuts dialog steps aside on paper (dialog text absent)");

await closeDialog();
must(!dialogOpen(), "dialog closes cleanly after the print leg");

const errsB = JSON.parse(evalJs(`({ errs: window.__qaErrs || [] })`)).errs;
must(errsB.length === 0, `zero page errors overall (got ${JSON.stringify(errsB)})`);
console.log(`PHASE B GREEN (${PASS} asserts)`);

cleanup();
console.log(`QA70 GREEN (${PASS} asserts)`);
