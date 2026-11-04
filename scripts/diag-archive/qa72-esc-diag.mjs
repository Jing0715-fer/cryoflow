// qa72-esc-diag — is the qa70 Esc FATAL a real regression or a harness flake?
// Instrument: open page → press ? → confirm dialog → CDP Escape → poll
// dialog state over 2s → synthetic Escape → poll → report focus + layers.
// Also logs Radix's document-level keydown activity via a capture listener.
import { execSync } from "node:child_process";
const AB = "agent-browser";
const sh = (c) => execSync(c, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (e) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: e }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");

sh(`${AB} close`); await sleep(800);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open http://localhost:3000`);
await sleep(5000);

// instrument BEFORE opening the dialog: log every Escape keydown reaching
// document (capture) with its defaultPrevented + target
evalJs(`(function(){
  window.__escLog = [];
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') window.__escLog.push({
      phase: 'capture', prevented: e.defaultPrevented,
      target: (e.target && (e.target.tagName || 'node')) || 'null',
      ts: Date.now()
    });
  }, true);
  return 'instrumented';
})()`);

evalJs(`(function(){
  var ev = new KeyboardEvent('keydown', { key: '?', bubbles: true });
  document.body.dispatchEvent(ev);
  return 'sent';
})()`);
await sleep(900);
console.log("after ?:", unq(evalJs(`(function(){
  var d = [...document.querySelectorAll('[role=dialog]')];
  return JSON.stringify({ n: d.length, labels: d.map(x => (x.textContent || '').slice(0, 24)) });
})()`)));

console.log("focus before Esc:", unq(evalJs(`(function(){
  var a = document.activeElement;
  return JSON.stringify({ tag: a && a.tagName, cls: a && (a.className || '').slice(0, 40), inDialog: !!(a && a.closest('[role=dialog]')) });
})()`)));

// real CDP Escape
sh(`${AB} press Escape`);
for (let i = 0; i < 6; i++) {
  await sleep(350);
  const st = unq(evalJs(`(function(){ return document.querySelectorAll('[role=dialog]').length + ''; })()`));
  console.log(`t+${(i + 1) * 350}ms after CDP Esc: dialogs=${st}`);
  if (st === "0") break;
}
console.log("escLog after CDP:", unq(evalJs(`JSON.stringify(window.__escLog || [])`)));

if (unq(evalJs(`(function(){ return document.querySelectorAll('[role=dialog]').length + ''; })()`)) !== "0") {
  evalJs(`(function(){ (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'sent'; })()`);
  await sleep(900);
  console.log("after synthetic Esc:", unq(evalJs(`(function(){ return document.querySelectorAll('[role=dialog]').length + ''; })()`)));
  console.log("escLog final:", unq(evalJs(`JSON.stringify(window.__escLog || [])`)));
}
console.log("console errors:", unq(evalJs(`JSON.stringify(window.__qaErrs || [])`)));
sh(`${AB} close`);
