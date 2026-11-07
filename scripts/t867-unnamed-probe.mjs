#!/usr/bin/env node
/** t867 — the minimal unnamed-controls probe (the Mol* stack, post-fix). */
import { execSync } from "node:child_process";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8" });
const sleep = (s) => execSync(`sleep ${s}`);
const ev = (js) => { const r = ab(`eval ${JSON.stringify(js)}`).trim(); try { return JSON.parse(JSON.parse(r)); } catch { try { return JSON.parse(r); } catch { return r; } } };

const PROBE =
  '(() => { const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return "aria:" + al.trim().slice(0, 40); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return "lb:" + t.slice(0, 40); } const tc = (el.textContent || "").trim(); if (tc) return "tc:" + tc.slice(0, 40); const v = (el.value || "").trim(); if (v) return "v:" + v.slice(0, 20); const p = (el.getAttribute("placeholder") || "").trim(); if (p) return "p:" + p.slice(0, 30); return null; };' +
  'const ctrls = Array.from(document.querySelectorAll("input,select,textarea"));' +
  'return JSON.stringify(ctrls.map((c) => ({ tag: c.tagName, type: c.getAttribute("type"), named: !!nameOf(c), how: nameOf(c), ariaHidden: c.getAttribute("aria-hidden"), cls: String(c.className).slice(0, 30), accept: c.getAttribute("accept"), inDlg: !!c.closest("[role=dialog]") }))); })()';

ab("open http://localhost:3000");
sleep(4);
ev('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(4);
const jobs = ev('(() => "roster")()');
console.log("boot ok");
// walk: postprocess card -> Results -> Enlarge -> View-in-3D
const card = ev('(() => { fetch("/api/jobs", { headers: { "Sec-Fetch-Site": "same-origin" } }).then(r=>r.json()).then(b => { const j = (b.jobs||[]).find(x => x.type === "postprocess"); window.__pp = j ? j.id : null; }); return "kicked"; })()');
sleep(2);
const ppId = ev('(() => window.__pp || "none")()');
console.log("pp id:", ppId);
ev('(() => { const c = document.querySelector("[data-card-btn=\\"' + ppId + '\\"]"); if (!c) return "no-card"; const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return "clicked"; })()');
sleep(3);
ev('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find(e => (e.textContent||"").trim() === "Results"); if (t) t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return "tab"; })()');
sleep(4);
ev('(() => { const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); const t = sec && Array.from(sec.querySelectorAll("button[data-tile-path]")).find(b => b.getAttribute("data-tile-path").endsWith("postprocess.mrc")); if (t) t.click(); return t ? "tile" : "no-tile"; })()');
sleep(3);
ev('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length-1]; const b = d && Array.from(d.querySelectorAll("button")).find(x => ((x.getAttribute("aria-label") || x.textContent || "")).includes("View in 3D")); if (b) b.click(); return b ? "v3d" : "no-door"; })()');
let up = false;
for (let i = 0; i < 45; i++) { const s = ev('(() => JSON.stringify({ o: !!document.querySelector("[data-canvas-ui=ortho-panel]") }))()'); if (s && s.o) { up = true; break; } sleep(1); }
console.log("ortho up:", up);
sleep(2);
// the disclosure walk (V5) + the step machine (V10/V11) — the ride's full depth
ev('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const d = Array.from(o.querySelectorAll("button")).find(b => b.getAttribute("aria-expanded") !== null); d.click(); return "open"; })()');
sleep(2.5);
ev('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const s = Array.from(o.querySelectorAll("button")).filter(b => (b.getAttribute("aria-label") || "").startsWith("Step the ")); if (s[0]) s[0].click(); return "step"; })()');
sleep(2);
ev('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const s = Array.from(o.querySelectorAll("button")).filter(b => (b.getAttribute("aria-label") || "").startsWith("Step the ")); if (s[1]) s[1].click(); return "step-back"; })()');
sleep(2);
console.log("BTNS:", ev('(() => JSON.stringify({ btns: document.querySelectorAll("button").length, unnamed: Array.from(document.querySelectorAll("button")).filter(b => { const al = b.getAttribute("aria-label"); if (al && al.trim()) return false; const lb = b.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\s+/).map(id => { const d = document.getElementById(id); return d ? (d.textContent||"").trim() : ""; }).join(" ").trim(); if (t) return false; } const tc = (b.textContent||"").trim(); if (tc) return false; return true; }).map(b => ({ cls: String(b.className).slice(0, 50), txt: (b.textContent||"").trim().slice(0, 30), inOrtho: !!b.closest("[data-canvas-ui=ortho-panel]"), inDlg: !!b.closest("[role=dialog]") })) }))()', null, 1));
console.log("CTRLS:", JSON.stringify(ev(PROBE), null, 1));
