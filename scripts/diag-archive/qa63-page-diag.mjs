// qa63-page-diag — what page are we actually on after open+Shift+D?
import { execSync } from "node:child_process";
const AB = "agent-browser";
const B = "http://localhost:3000";
const sh = (c) => execSync(c, { encoding: "utf8", timeout: 60000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 60000, input: e }).trim();

sh(`${AB} close`); await sleep(1000);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`);
await sleep(5000);

console.log("h1:", ev(`(document.querySelector('h1')||{}).textContent || 'NONE'`));
console.log("buttons:", ev(`String(document.querySelectorAll('[role=button]').length)`));
console.log("hasPost320:", ev(`String([...document.querySelectorAll('[role=button]')].some(x => (x.textContent||'').includes('QA Post 320')))`));
console.log("bodySample:", ev(`(document.body.textContent||'').replace(/\\s+/g,' ').slice(0,180)`));

ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
await sleep(3500);
console.log("after Shift+D h1:", ev(`(document.querySelector('h1')||{}).textContent || 'NONE'`));
console.log("after buttons:", ev(`String(document.querySelectorAll('[role=button]').length)`));
console.log("after hasPost320:", ev(`String([...document.querySelectorAll('[role=button]')].some(x => (x.textContent||'').includes('QA Post 320')))`));

sh(`${AB} close`);
