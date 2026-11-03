#!/usr/bin/env node
/**
 * t875-n12-probe — the clamp footnote's disappearance, filmed at the DOM's
 * own level: open the stack, fill 999, run, and dump the form row's
 * innerHTML + every [role=status] page-wide, twice (at +2s and +8s).
 */
import { execSync } from "node:child_process";

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const sleep = (s) => execSync(`sleep ${s}`);
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  return JSON.parse(raw);
};

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ clicked: true }); })()';

console.log("probe: fresh load");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(4);

// the fetch hook: capture the UI's own POST bodies (the decisive witness)
evalJson('(() => { window.__t875posts = []; const of = window.fetch; window.fetch = function(u, o) { try { if (String(u).indexOf("/api/hpc/simulate") !== -1 && o && o.body) { window.__t875posts.push(String(o.body)); } } catch (e) {} return of.apply(this, arguments); }; return "hooked"; })()');

const jobs = JSON.parse(execSync(`curl -s http://localhost:3000/api/jobs -H 'Origin: http://localhost:3000' -H 'Sec-Fetch-Site: same-origin'`, { encoding: "utf8" })).jobs;
const host = jobs.find((j) => j.type === "refine3d" && j.status === "completed");
console.log("host:", host.id);

evalJson(plainClick(host.id));
sleep(3);
try { ab("click '[aria-label=\"More job tools\"]'"); } catch {}
sleep(2);
try { ab("click '[data-testid=\"tools-sbatch-item\"]'"); } catch {}
sleep(5);

const film = () => evalJson('(() => { const qsec = document.querySelector(\'[aria-label="Queue simulation"]\'); const row = qsec ? qsec.children[0].nextElementSibling : null; const stats = Array.from(document.querySelectorAll("[role=status]")).map((s) => (s.textContent || "").trim()); const gpus = document.querySelector(\'input[aria-label="GPUs"]\'); const posts = (window.__t875posts || []).slice(-3); return JSON.stringify({ posts: posts, qsec: !!qsec, rowCls: row ? row.className.slice(0, 40) : null, rowHtml: row ? row.innerHTML.slice(0, 400) : null, statsPageWide: stats, gpus: gpus ? gpus.value : null }); })()');

console.log("--- before fill: the CLOSED face (no form yet) ---");
console.log(JSON.stringify(film(), null, 1).slice(0, 400));

// the form's birth: the FIRST Run opens it (the sim state's own gate)
try { ab("click '[aria-label=\"Run queue simulation\"]'"); } catch {}
evalJson('(() => { const b = document.querySelector(\'button[aria-label="Run queue simulation"]\'); if (b) b.click(); return "knock"; })()');
sleep(6);
console.log("--- after first Run (form open, pristine prefill) ---");
console.log(JSON.stringify(film(), null, 1).slice(0, 500));

ab("fill '[aria-label=\"GPUs\"]' '999'");
sleep(1);
console.log("--- after fill (GPUs should read 999) ---");
console.log(JSON.stringify(film(), null, 1).slice(0, 400));

try { ab("click '[aria-label=\"Run queue simulation\"]'"); } catch {}
evalJson('(() => { const b = document.querySelector(\'button[aria-label="Run queue simulation"]\'); if (b) b.click(); return "knock"; })()');
sleep(2);
console.log("--- +2s after run ---");
console.log(JSON.stringify(film(), null, 1).slice(0, 900));
sleep(6);
console.log("--- +8s after run ---");
console.log(JSON.stringify(film(), null, 1).slice(0, 900));

// peel
evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1);
evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
console.log("probe done");
