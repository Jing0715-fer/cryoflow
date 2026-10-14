#!/usr/bin/env node
/** t873 door probe — why did the tools menu not open? (diagnostic, one ride) */
import { execSync } from "node:child_process";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8", cwd: process.cwd() });
const sleep = (s) => execSync(`sleep ${s}`);
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  try { return JSON.parse(JSON.parse(raw)); } catch { return JSON.parse(raw); }
};

ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);

const jobs = await (await fetch("http://localhost:3000/api/jobs", {
  headers: { Origin: "http://localhost:3000", Referer: "http://localhost:3000/" },
})).json();
const host = (jobs.jobs ?? jobs).find((j) => j.type === "refine3d" && j.status === "completed");

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ clicked: true }); })()';
evalJson(plainClick(host.id));
sleep(3);

// 1. does the trigger exist?
console.log("probe1:", JSON.stringify(evalJson(`(() => { const t = document.querySelector('[aria-label="More job tools"]'); return JSON.stringify({ found: !!t, tag: t ? t.tagName : null, dlg: document.querySelectorAll('[role=dialog]').length }); })()`)));

// 2. native click with SINGLE-quoted shell arg via double-quote wrapper
try {
  const out = execSync(`agent-browser click '[aria-label="More job tools"]'`, { encoding: "utf8", cwd: process.cwd(), stderr: "pipe" });
  console.log("probe2 native single-quoted: OK", out.trim().slice(0, 80));
} catch (e) {
  console.log("probe2 native single-quoted: FAIL", String(e.stderr || e.message).slice(0, 120));
}
sleep(2);
console.log("probe3 menu after native:", JSON.stringify(evalJson('(() => { return JSON.stringify({ menu: !!document.querySelector("[role=menu]"), items: document.querySelectorAll("[role=menuitem]").length }); })()')));

// 3. if closed, close it and try the synthetic pointer pair
const closed = evalJson('(() => { return JSON.stringify({ menu: !!document.querySelector("[role=menu]") }); })()');
if (closed.menu) {
  evalJson('(() => { document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "esc"; })()');
  sleep(1.5);
}
evalJson(`(() => { const t = document.querySelector('[aria-label="More job tools"]'); if (!t) return "no-trigger"; const r = t.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, pointerType: "mouse", clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); return "dispatched"; })()`);
sleep(2);
console.log("probe4 menu after synthetic:", JSON.stringify(evalJson('(() => { return JSON.stringify({ menu: !!document.querySelector("[role=menu]"), items: document.querySelectorAll("[role=menuitem]").length }); })()')));
