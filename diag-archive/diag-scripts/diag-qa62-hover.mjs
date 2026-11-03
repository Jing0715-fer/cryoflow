// Diagnostic — qa62 hover-bold: does the CDP mouse move actually reach the
// compare row, and does React's onMouseEnter fire? Ground truth via the
// :hover chain + curve widths after a real mouse move.
import { execSync } from "node:child_process";

const AB = "agent-browser";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unq = (s) => {
  const t = String(s).trim();
  try { return JSON.parse(t); } catch { return t; }
};
const evalJs = (expr) => unq(sh(`${AB} eval '${expr.replace(/'/g, "'\\''")}'`));
const truthy = (s) => String(s).replace(/^"|"$/g, "") === "true";

sh(`${AB} close`); await sleep(1500);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open http://localhost:3000`);
await sleep(6000);
// land on the CANVAS (Shift+D from dashboard) — qa62's bootCanvas flow
for (let i = 0; i < 12; i++) {
  const probe = evalJs(`(() => {
    const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Post 320'));
    const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
    return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
  })()`);
  console.log(`boot iter ${i}:`, probe);
  if (String(probe).includes("CARD")) break;
  if (String(probe).includes("DASH")) evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
  await sleep(2200);
}
await sleep(1000);

// open inspector modal on the host card (qa62 realClick: locate → move → down/up)
const locate = (name) => evalJs(`(() => {
  const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${name}'));
  if (!card) return 'null';
  card.scrollIntoView({ block: 'center' });
  const r = card.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
})()`);
let modal = false;
for (let i = 0; i < 6 && !modal; i++) {
  const p = JSON.parse(String(locate("QA Post 320")) || "null");
  if (p) {
    sh(`${AB} mouse move ${p.x} ${p.y}`); await sleep(200);
    sh(`${AB} mouse down`); await sleep(120); sh(`${AB} mouse up`);
  } else { console.log(`iter ${i}: card not located`); }
  await sleep(2500);
  modal = evalJs(`(() => { const dl = [...document.querySelectorAll('[role=dialog]')].find(d => (d.textContent||'').includes('QA Post 320')); return JSON.stringify(!!dl); })()`) === "true";
  console.log(`inspector iter ${i}: modal=`, modal);
}
await sleep(1500);

// open the compare dialog from the FSC chip
const cmp = evalJs(`(() => { const b = document.querySelector('[data-testid=fsc-compare-open]'); if (!b) return 'NO-CHIP'; b.click(); return 'clicked'; })()`);
console.log("compare:", cmp);
await sleep(3000);

// dialog up? tick QA Post 300/385/Refine410 so 300 owns a visible curve
for (const name of ["QA Post 300", "QA Post 385", "QA Refine 410"]) {
  const r = evalJs(`(() => {
    const rows = [...document.querySelectorAll('[data-testid=fsc-compare-row]')];
    const row = rows.find(x => (x.textContent||'').includes('${name}'));
    if (!row) return 'NO-ROW';
    const cb = row.querySelector('button[role=checkbox]');
    if (!cb) return 'NO-CB';
    if (cb.getAttribute('aria-checked') !== 'true') cb.click();
    return 'toggled';
  })()`);
  console.log(`tick ${name}:`, r);
  await sleep(1200);
}
await sleep(2500);

// curve widths at rest
const widths = () => evalJs(`(() => {
  const chart = document.querySelector('[data-testid=fsc-compare-chart]');
  if (!chart) return null;
  return JSON.stringify([...chart.querySelectorAll('path.recharts-line-curve')].map(p => ({
    stroke: p.getAttribute('stroke'), w: getComputedStyle(p).strokeWidth,
  })));
})()`);
console.log("curves at rest:", widths());

// locate the QA Post 300 row + hover it with a REAL CDP move — NO
// scrollIntoView (the suite's hoverAt only scrolls when the container clips)
const pos = JSON.parse(String(evalJs(`(() => {
  const rows = [...document.querySelectorAll('[data-testid=fsc-compare-row]')];
  const row = rows.find(x => (x.textContent||'').includes('QA Post 300'));
  if (!row) return 'null';
  const r = row.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), h: Math.round(r.height), vh: innerHeight });
})()`)) || "null");
if (!pos) { console.log("row not found — abort"); process.exit(1); }
console.log("row center:", JSON.stringify(pos));

sh(`${AB} mouse move ${pos.x} ${pos.y}`);
await sleep(700);

// :hover chain + elementFromPoint + widths after hover
console.log("hover-chain:", evalJs(`(() => {
  const chain = [...document.querySelectorAll(':hover')].map(e => e.tagName + (e.getAttribute ? (e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : '') : ''));
  const rows = [...document.querySelectorAll('[data-testid=fsc-compare-row]')];
  const row = rows.find(x => (x.textContent||'').includes('QA Post 300'));
  const r = row && row.getBoundingClientRect();
  const top = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return JSON.stringify({
    chain: chain.slice(-6),
    rowInHover: chain.some(c => c.includes('fsc-compare-row')),
    topEl: top ? top.tagName + (top.getAttribute && top.getAttribute('data-testid') ? '[' + top.getAttribute('data-testid') + ']' : '') : null,
    topIsRowOrChild: top ? !!top.closest('[data-testid=fsc-compare-row]') : null,
  });
})()`));
console.log("curves after hover:", widths());

// ALSO: synthetic mouseenter dispatch — does the APP respond at all?
evalJs(`(() => {
  const rows = [...document.querySelectorAll('[data-testid=fsc-compare-row]')];
  const row = rows.find(x => (x.textContent||'').includes('QA Post 300'));
  if (!row) return 'NO-ROW';
  const r = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }));
  row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  return 'dispatched';
})()`);
await sleep(600);
console.log("curves after synthetic:", widths());
