import { execSync } from "node:child_process";
const sh = (c) => execSync(c, { encoding: "utf8", timeout: 60_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`agent-browser eval --stdin`, { encoding: "utf8", timeout: 60_000, input: expr }).trim();

const coords = evalJs(`(() => { const el=[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('QA Refine3D') && (x.textContent||'').includes('completed')); if(!el) return null; const r=el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
console.log("coords:", coords);
const { x, y } = JSON.parse(coords);
sh(`agent-browser mouse move ${x} ${y}`);
sh(`agent-browser mouse down`);
sh(`agent-browser mouse up`);
await sleep(3000);
const state = evalJs(`JSON.stringify({results: [...document.querySelectorAll('[role=tab]')].some(t => t.textContent.trim()==='Results')})`);
console.log("after node-driven click:", state);
