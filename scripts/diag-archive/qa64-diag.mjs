// qa64-diag — why does the 5th row's checkbox click not flip aria-checked?
import { execSync } from "node:child_process";
const AB = "agent-browser";
const B = "http://localhost:3000";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 60_000, input: expr }).trim();

sh(`${AB} close`); await sleep(1000);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`); await sleep(5000);

const clickAt = async (find, label) => {
  const coords = evalJs(`(() => { const el = (${find}); if (!el) return null;
    let p = el.parentElement;
    while (p) { const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) {
        const r = el.getBoundingClientRect(), pr = p.getBoundingClientRect();
        p.scrollTop += (r.top + r.height/2) - (pr.top + pr.clientHeight/2); break; }
      p = p.parentElement; }
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`);
  if (!coords || coords === "null") { console.log(label, "NO-ELEMENT"); return; }
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  console.log(label, JSON.stringify(c));
  await sleep(900);
};

// canvas → inspector
await clickAt(`[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Post 320'))`, "card");
// compare dialog
await clickAt(`[...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('compare') || (b.title||'').includes('compare'))`, "compare-btn");
console.log("rows:", evalJs(`String(document.querySelectorAll('[data-testid=fsc-compare-row]').length)`));

// pick 385 + 410 by CHECKBOX
const ids = evalJs(`[...document.querySelectorAll('[data-testid=fsc-compare-row]')].map(r => ({ id: r.dataset.jobId, t: r.textContent.slice(0, 24) }))`);
console.log("rows map:", ids);
const rows = JSON.parse(ids);
for (const row of rows.filter(r => r.t.includes("Post 385") || r.t.includes("Refine 410"))) {
  await clickAt(`document.querySelector('[data-testid=fsc-compare-row][data-job-id="${row.id}"]')?.querySelector('button[role=checkbox]')`, `pick ${row.t}`);
}

// now the LIVE row — inspect everything before clicking
const liveRow = rows.find(r => r.t.includes("Live"));
const probe = evalJs(`(() => {
  const row = document.querySelector('[data-testid=fsc-compare-row][data-job-id="${liveRow.id}"]');
  const cb = row?.querySelector('button[role=checkbox]');
  if (!cb) return { err: "NOCB" };
  const list = cb.closest('[data-testid=fsc-compare-list]');
  const before = { st: list.scrollTop, sh: list.scrollHeight, ch: list.clientHeight,
    top: Math.round(list.getBoundingClientRect().top), bot: Math.round(list.getBoundingClientRect().bottom) };
  let p = cb.parentElement; let scrolled = "none";
  while (p) { const cs = getComputedStyle(p);
    if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) {
      const r = cb.getBoundingClientRect(), pr = p.getBoundingClientRect();
      p.scrollTop += (r.top + r.height/2) - (pr.top + pr.clientHeight/2);
      scrolled = p.className.slice(0, 40); break; }
    p = p.parentElement; }
  const r = cb.getBoundingClientRect();
  const hit = document.elementFromPoint(Math.round(r.x + r.width/2), Math.round(r.y + r.height/2));
  return { before, after: { st: list.scrollTop },
    x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2),
    checked: cb.getAttribute('aria-checked'), disabled: cb.hasAttribute('disabled'),
    scrolled, hit: hit ? hit.tagName + "." + (hit.className || "").toString().slice(0, 40) : "none",
    rowTop: Math.round(r.top), rowH: Math.round(r.height),
    rowRect: (() => { const rr = row.getBoundingClientRect(); return { t: Math.round(rr.top), b: Math.round(rr.bottom) }; })() };
})()`);
console.log("live probe:", JSON.stringify(probe, null, 1));
const c = probe;
sh(`${AB} mouse move ${c.x} ${c.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
await sleep(900);
console.log("after click:", evalJs(`String(document.querySelector('[data-testid=fsc-compare-row][data-job-id="${liveRow.id}"] button[role=checkbox]')?.getAttribute('aria-checked'))`));
console.log("params counts:", evalJs(`String(document.querySelector('[data-testid=fsc-params-counts]')?.textContent || '')`));
sh(`${AB} close`);
