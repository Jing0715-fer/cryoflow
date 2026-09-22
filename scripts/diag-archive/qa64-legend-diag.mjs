// qa64-legend-diag — qa62 legend hover still fails after the overflow fix:
// where does the mouse at the 385 chip's center actually land?
import { execSync } from "node:child_process";
const AB = "agent-browser";
const B = "http://localhost:3000";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 60_000, input: expr }).trim();
const click = async (find, label) => {
  const c = evalJs(`(() => { const el = (${find}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`);
  if (!c || c === "null") { console.log(label, "NO-ELEMENT"); return; }
  const p = JSON.parse(c);
  sh(`${AB} mouse move ${p.x} ${p.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(900);
  console.log(label, JSON.stringify(p));
};

sh(`${AB} close`); await sleep(1200);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`); await sleep(5000);
await click(`[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Post 320'))`, "card");
await click(`[...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('compare') || (b.title||'').includes('compare'))`, "compare-btn");

// tick 300 + 385 + 410 (qa62 Phase A combo)
const rows = JSON.parse(evalJs(`[...document.querySelectorAll('[data-testid=fsc-compare-row]')].map(r => ({ id: r.dataset.jobId, t: (r.textContent||'').slice(0, 16) }))`));
for (const name of ["QA Post 300", "QA Post 385", "QA Refine 410"]) {
  const row = rows.find(r => r.t.includes(name));
  await click(`document.querySelector('[data-testid=fsc-compare-row][data-job-id="${row.id}"]')?.querySelector('button[role=checkbox]')`, `tick ${name}`);
}
await sleep(800);

const dump = evalJs(`(() => {
  const dlg = document.querySelector('[data-testid=fsc-compare-list]')?.closest('[role=dialog]');
  const chip = document.querySelector('[data-testid^=fsc-compare-legend-]'); // any legend chip
  const chips = [...document.querySelectorAll('[data-testid^=fsc-compare-legend-]')];
  const r = chip.getBoundingClientRect();
  const cx = Math.round(r.x + r.width/2), cy = Math.round(r.y + r.height/2);
  const hit = document.elementFromPoint(cx, cy);
  const params = document.querySelector('[data-testid=fsc-params-diff]');
  return {
    dlgClass: dlg.className.slice(0, 120),
    dlgScroll: { sh: dlg.scrollHeight, ch: dlg.clientHeight, st: dlg.scrollTop },
    dlgRect: { top: Math.round(dlg.getBoundingClientRect().top), bot: Math.round(dlg.getBoundingClientRect().bottom) },
    chipCount: chips.length,
    chipRect: { t: Math.round(r.top), b: Math.round(r.bottom), x: cx, y: cy },
    hit: hit ? hit.tagName + '|' + (hit.className || '').toString().slice(0, 60) : 'none',
    hitIsChip: hit ? chip.contains(hit) : false,
    paramsRect: params ? { t: Math.round(params.getBoundingClientRect().top), b: Math.round(params.getBoundingClientRect().bottom), h: Math.round(params.scrollHeight) } : null,
    paramsScroll: params ? { sh: params.scrollHeight, ch: params.clientHeight } : null,
  };
})()`);
console.log(JSON.stringify(dump, null, 1));
sh(`${AB} close`);
