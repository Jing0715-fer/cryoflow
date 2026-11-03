// bisect: why does Escape not close the shortcuts dialog in the harness flow?
import { execSync } from "node:child_process";
const AB = "agent-browser";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const ev = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

sh(`${AB} close`); await sleep(1000);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open http://localhost:3000`);
await sleep(5000);

// harness step 1: errCollector (identical to qa70)
ev(`(() => {
  window.__qaErrs = [];
  window.addEventListener('error', (e) => window.__qaErrs.push(String(e.message || e)));
  window.__qaErrColl = true;
  return 'on';
})()`);

// step 2: open via synthetic ?
ev(`(() => { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })); return 'sent'; })()`);
await sleep(800);
console.log("after ?:", ev(`(() => { const d = document.querySelector('[role=dialog]'); return JSON.stringify({ open: !!d, state: d ? d.getAttribute('data-state') : null, focus: document.activeElement ? document.activeElement.tagName + '.' + (document.activeElement.getAttribute('aria-label') || '') : null }); })()`));

// step 3: install a capture-phase keydown logger BEFORE Escape
ev(`(() => {
  window.__escLog = [];
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.__escLog.push({ phase: 'capture-window', defaultPrevented: e.defaultPrevented });
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.__escLog.push({ phase: 'capture-doc', defaultPrevented: e.defaultPrevented, target: e.target.tagName });
  }, true);
  return 'loggers-on';
})()`);

// step 4: type in the filter (like the harness)
ev(`(() => {
  const inp = document.querySelector('input[aria-label="Filter shortcuts"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, 'zoom');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
await sleep(500);
ev(`(() => {
  const inp = document.querySelector('input[aria-label="Filter shortcuts"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, '');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return 'cleared';
})()`);
await sleep(400);
console.log("before Esc:", ev(`(() => { const d = document.querySelector('[role=dialog]'); return JSON.stringify({ state: d ? d.getAttribute('data-state') : null, focus: document.activeElement ? document.activeElement.tagName : null }); })()`));

// step 5: REAL Escape via CDP
sh(`${AB} press Escape`);
await sleep(800);
console.log("after real Esc:", ev(`(() => JSON.stringify({ escLog: window.__escLog, dialogs: document.querySelectorAll('[role=dialog]').length, state: (document.querySelector('[role=dialog]')||{}).getAttribute ? document.querySelector('[role=dialog]').getAttribute('data-state') : null }))()`));
