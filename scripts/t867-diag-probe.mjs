#!/usr/bin/env node
/**
 * t867 — the diagnostic probe: the quick-look layer's live ground truth for
 * the reds the first rides spoke. NOT an instrument — films no receipt;
 * answers questions:
 *   1. the 3 unnamed controls with the Mol* stack up (V12/B7's unCtrls=3):
 *      tag, type, class, aria-*, placeholder, label[for] association.
 *   2. the ortho keymap's arrival (V9): the sigma chip's state over time —
 *      isoSigma arrives via ORTHO_SIGMA_STATE_EVENT (the embed's answer to
 *      the mount-time REQUEST); the keymap renders only when it is non-null.
 *   3. the histogram's role=img (H2): present? labeled?
 *   4. the stack dialog's slice range (S10) + the follow-window toggle (S13):
 *      the live attributes the walks try to flip.
 * Chain: postprocess card (plain door) -> Results tab (mousedown) -> Enlarge
 * -> quick-look -> View-in-3D -> ortho open -> oblique open -> probe ->
 * Escape -> extract card -> stack dialog -> probe.
 */

import { execSync } from "node:child_process";

const ROOT = process.cwd();
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error(`unparseable: ${raw.slice(0, 160)}`); }
  if (typeof out === "string") { try { const inner = JSON.parse(out); if (inner && typeof inner === "object") return inner; } catch { /* plain */ } }
  return out;
};

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';
const tileDoor = (suffix) =>
  '(() => { const sec = document.querySelector("section[aria-label=\\"Maps and images\\"]"); if (!sec) return JSON.stringify({ clicked: false }); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path").endsWith("' + suffix + '")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()';
const view3dDoor =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = Array.from(d.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || x.textContent || "")).includes("View in 3D")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* the unnamed-control identity probe */
const UNNAMED =
  '(() => { ' +
  'const nameOf = (el) => { ' +
  'const al = el.getAttribute("aria-label"); if (al && al.trim()) return "aria-label:" + al.trim().slice(0, 30); ' +
  'const lb = el.getAttribute("aria-labelledby"); if (lb) { const n = lb.split(/\\s+/).map((i) => (document.getElementById(i) || {}).textContent || "").join(" ").trim(); if (n) return "labelledby:" + n.slice(0, 30); } ' +
  'if (el.id) { const l = document.querySelector(\'label[for="\' + CSS.escape(el.id) + \'"]\'); if (l && l.textContent.trim()) return "for:" + l.textContent.trim().slice(0, 30); } ' +
  'const wrap = el.closest("label"); if (wrap && wrap.textContent.trim()) return "wrap:" + wrap.textContent.trim().slice(0, 30); ' +
  'if ((el.textContent || "").trim()) return "text:" + el.textContent.trim().slice(0, 30); ' +
  'if (el.getAttribute("placeholder")) return "ph:" + el.getAttribute("placeholder").slice(0, 30); ' +
  'if (el.getAttribute("value")) return "value:" + el.getAttribute("value").slice(0, 30); ' +
  'return null; }; ' +
  'const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); ' +
  'return JSON.stringify(ctrls.map((c) => ({ tag: c.tagName.toLowerCase(), type: c.getAttribute("type") || "-", named: !!nameOf(c), how: nameOf(c), aria: c.getAttribute("aria-label"), ariaLabelledby: c.getAttribute("aria-labelledby"), id: c.id || "-", cls: String(c.className).slice(0, 60), visible: !!(c.offsetWidth || c.offsetHeight), inDlg: !!c.closest("[role=dialog]"), inOrtho: !!c.closest("[data-canvas-ui=ortho-panel]") }))); })()';

const ORTHO_STATE =
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); if (!o) return JSON.stringify({ ortho: false }); ' +
  'const km = !!o.querySelector("[data-canvas-ui=ortho-keymap]"); ' +
  'const chip = Array.from(o.querySelectorAll("*")).find((e) => e.children.length === 0 && /iso\\s/.test((e.textContent || "").trim())); ' +
  'const mouths = Array.from(o.querySelectorAll("button")).map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 60)).filter(Boolean); ' +
  'return JSON.stringify({ ortho: true, keymap: km, sigmaChip: chip ? (chip.textContent || "").trim().slice(0, 40) : null, mouthCount: mouths.length }); })()';

const HIST_STATE =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ dlg: false }); ' +
  'const img = d.querySelector("[role=img]"); ' +
  'const toggle = d.querySelector("[data-canvas-ui=quick-hist-toggle]"); ' +
  'return JSON.stringify({ dlg: true, roleImg: !!img, imgLabel: img ? (img.getAttribute("aria-label") || "").slice(0, 60) : null, histToggle: toggle ? toggle.getAttribute("aria-pressed") : null, canvases: d.querySelectorAll("canvas").length, svg: d.querySelectorAll("svg").length }); })()';

const STACK_STATE =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ dlg: false }); ' +
  'const range = d.querySelector("[data-canvas-ui=stack-slice-range]"); ' +
  'const fw = d.querySelector("[data-canvas-ui=stack-montage-window]"); ' +
  'const readout = d.querySelector("[data-canvas-ui=stack-slice-readout]"); ' +
  'return JSON.stringify({ dlg: true, range: range ? { tag: range.tagName, valuenow: range.getAttribute("aria-valuenow"), valuemax: range.getAttribute("aria-valuemax"), type: range.getAttribute("type"), cls: String(range.className).slice(0, 40) } : null, followWin: fw ? { tag: fw.tagName, pressed: fw.getAttribute("aria-pressed"), cls: String(fw.className).slice(0, 40) } : null, readout: readout ? (readout.textContent || "").trim() : null }); })()';

console.log("== diag 0: the clean boot ==");
ab("open http://localhost:3000");
sleep(4);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(4);

console.log("== diag 1: the postprocess quick-look ==");
const jobs = (await (await fetch("http://localhost:3000/api/jobs", { headers: { Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" } })).json()).jobs ?? [];
const mapHost = jobs.find((j) => j.type === "postprocess" && j.status === "completed");
const stackHost = jobs.find((j) => j.type === "extract" && j.status === "completed");
console.log(`hosts: map=${mapHost?.name} stack=${stackHost?.name}`);
console.log("card:", evalJson(plainClick(mapHost.id)));
sleep(2.5);
console.log("tab:", evalJson(tabMouseDown("Results")));
for (let i = 0; i < 40; i++) {
  const g = evalJson('(() => JSON.stringify({ sec: !!document.querySelector(\'section[aria-label="Maps and images"]\'), tiles: document.querySelectorAll("button[data-tile-path]").length }))()');
  if (g.sec && g.tiles >= 1) { console.log(`gallery up (${g.tiles} tiles)`); break; }
  sleep(1);
}
console.log("tile:", evalJson(tileDoor("postprocess.mrc")));
sleep(2.5);
console.log("HIST (map, fresh):", JSON.stringify(evalJson(HIST_STATE)));
console.log("hist toggle walk: click ->", (() => { const r = evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const t = ds[ds.length-1]?.querySelector("[data-canvas-ui=quick-hist-toggle]"); if (!t) return JSON.stringify({ found: false }); t.click(); return JSON.stringify({ found: true }); })()'); sleep(2); return r; })());
console.log("HIST (toggle on):", JSON.stringify(evalJson(HIST_STATE)));

console.log("== diag 2: the Mol* handoff + the sigma timeline ==");
console.log("view3d:", evalJson(view3dDoor));
let orthoSeen = false;
for (let i = 0; i < 45; i++) {
  const s = evalJson(ORTHO_STATE);
  if (s.ortho) {
    orthoSeen = true;
    if (i % 5 === 0 || s.keymap) console.log(`t+${i}s: ortho up, keymap=${s.keymap}, sigmaChip=${JSON.stringify(s.sigmaChip)}`);
    if (s.keymap) { console.log(`KEYMAP ARRIVED at t+${i}s`); break; }
  }
  sleep(1);
}
if (!orthoSeen) console.log("ORTHO NEVER APPEARED (45s)");
const disc = evalJson('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const d = Array.from(o.querySelectorAll("button")).find((b) => b.getAttribute("aria-expanded") !== null); d.click(); return JSON.stringify({ clicked: true }); })()');
console.log("ortho disclose:", disc);
sleep(2);
console.log("ORTHO (expanded):", JSON.stringify(evalJson(ORTHO_STATE)));
console.log("UNNAMED with Mol* stack:", JSON.stringify(evalJson(UNNAMED), null, 1));
const obd = evalJson('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const ds = Array.from(o.querySelectorAll("button")).filter((b) => b.getAttribute("aria-expanded") !== null); if (ds.length < 2) return JSON.stringify({ clicked: false }); ds[1].click(); return JSON.stringify({ clicked: true }); })()');
console.log("oblique disclose:", obd);
sleep(2);
console.log("ORTHO (oblique open):", JSON.stringify(evalJson(ORTHO_STATE)));
console.log("UNNAMED with oblique up:", JSON.stringify(evalJson(UNNAMED), null, 1));

console.log("== diag 3: Escape home, the stack dialog ==");
for (let i = 0; i < 8; i++) {
  const m = evalJson('(() => JSON.stringify({ dlg: document.querySelectorAll("[role=dialog]").length }))()');
  if (!m.dlg) break;
  evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); return "esc"; })()');
  sleep(1.2);
}
ab("open http://localhost:3000");
sleep(4);
console.log("card:", evalJson(plainClick(stackHost.id)));
sleep(2.5);
console.log("tab:", evalJson(tabMouseDown("Results")));
for (let i = 0; i < 40; i++) {
  const g = evalJson('(() => JSON.stringify({ sec: !!document.querySelector(\'section[aria-label="Maps and images"]\'), tiles: document.querySelectorAll("button[data-tile-path]").length }))()');
  if (g.sec && g.tiles >= 1) break;
  sleep(1);
}
console.log("tile:", evalJson(tileDoor(".mrcs")));
for (let i = 0; i < 30; i++) {
  const s = evalJson(STACK_STATE);
  if (s.dlg && s.readout && String(s.readout).startsWith("slice")) { console.log(`stack dialog up at t+${i}s`); break; }
  sleep(1);
}
console.log("STACK:", JSON.stringify(evalJson(STACK_STATE), null, 1));
console.log("UNNAMED with stack up:", JSON.stringify(evalJson(UNNAMED), null, 1));
const fw1 = evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const b = ds[ds.length-1]?.querySelector("[data-canvas-ui=stack-montage-window]"); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
console.log("followWin click:", fw1);
sleep(1.5);
console.log("STACK (after toggle):", JSON.stringify(evalJson(STACK_STATE), null, 1));
console.log("DIAG COMPLETE");