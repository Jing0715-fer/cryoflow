#!/usr/bin/env node
/**
 * t994 — the D1 no-dialog probe (the red-3/red-5 mechanism hunt):
 * replays the walk's segment-B sequence by hand and reads the DOM at
 * every beat, so the dialog's death moment names itself.
 *   node scripts/t994-d1-probe.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const w = createWalk({ name: "t994-d1-probe", receiptFile: "t994-d1-probe.json" });
const { AB, sh, evalJs, evalJson, poll, sleep, realClick, serverFirst, wideFirst, finish } = w;

const WALL_NAME = "Negative Diagnosis Face (t972)";
await serverFirst();
await wideFirst();

const dlgCount = `(() => JSON.stringify({ dlgs: [...document.querySelectorAll('[data-inspector-dialog]')].map(d => (d.textContent || '').includes('${WALL_NAME}') ? 'WALL' : 'other'), findbar: !!document.querySelector('[aria-label="Find jobs by name, type, or key:value parameter query"]')?.getBoundingClientRect?.().width }))()`;
const read = async (tag) => console.log(`  [${tag}] ${JSON.stringify(await evalJson(dlgCount))}`);

await read("fresh");

/* open the t976 inspector and land it on Log/Full (segment A's end state) */
const centered = await (async () => {
  const btn = await realClick(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Find jobs on canvas') ?? null`);
  await sleep(700);
  sh(`${AB} fill '[aria-label="Find jobs by name, type, or key:value parameter query"]' 'Cancelled Diagnosis'`);
  await sleep(900);
  const m = await evalJson(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\d+ match(es)?$/.test((x.textContent || '').trim()) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  sh(`${AB} mouse move ${m.x} ${m.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(900);
  return "centered";
})();
console.log(`  findAndCenter(t976): ${centered}`);
const c1 = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('Cancelled Diagnosis Face (t976)'))?.querySelector('[role="button"][tabindex]')`);
console.log(`  card click: ${c1}`);
await sleep(1200);
await read("t976 open?");

/* jump leg's end state: Log tab via the teaser's jump button */
const j = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('Cancelled Diagnosis Face (t976)')); const b = [...(d?.querySelectorAll('[data-overview-diagnosis] button') ?? [])].find(x => (x.textContent || '').includes('Open the full diagnosis')); return b ?? null; })()`);
console.log(`  jump: ${j}`);
await sleep(1500);
await read("after jump");

/* segment B's opening: Escape, find-bar, walltime card */
sh(`${AB} press Escape`);
await sleep(800);
await read("after escape");

const btn2 = await realClick(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Find jobs on canvas') ?? null`);
console.log(`  find-bar open: ${btn2}`);
await sleep(700);
sh(`${AB} fill '[aria-label="Find jobs by name, type, or key:value parameter query"]' 'Negative Diagnosis'`);
await sleep(900);
const m2 = await evalJson(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\d+ match(es)?$/.test((x.textContent || '').trim()) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), label: (b.textContent || '').trim() }); })()`);
console.log(`  match button: ${JSON.stringify(m2)}`);
if (m2?.x) { sh(`${AB} mouse move ${m2.x} ${m2.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`); await sleep(900); }
await read("after match click");

const c2 = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${WALL_NAME}'))?.querySelector('[role="button"][tabindex]')`);
console.log(`  walltime card click: ${c2}`);
for (let i = 0; i < 6; i++) {
  await sleep(800);
  await read(`t+${(i + 1) * 800}ms`);
}

finish({});
