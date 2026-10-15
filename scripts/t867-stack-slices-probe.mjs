#!/usr/bin/env node
/**
 * t867 probe #3 — the stack dialog's slice machine vs its own metadata.
 *
 * The fifth ride's S8/S11 filmed "slice 1 of 1" on a file whose LISTING
 * speaks slices=50 (run_classes.mrcs, 820224 bytes = 1024 + 50×64²×4).
 * The dialog's readout and the listing's header fact disagree — this
 * probe reads BOTH live: the in-page outputs fetch (the exact response
 * the inspector's load() gets) and the opened dialog's DOM (the readout,
 * the range's aria-valuemax — the t867 fix speaks the bound).
 *
 *   node scripts/t867-stack-slices-probe.mjs
 */
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const sleep = (s) => execSync(`sleep ${s}`);

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  try {
    let out = JSON.parse(raw);
    if (typeof out === "string") { try { out = JSON.parse(out); } catch {} }
    return out;
  } catch {
    return { _raw: raw.slice(0, 160) };
  }
};

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

/* the in-page listing read — same-origin, the response the page itself gets */
const PAGE_LISTING = (id) =>
  '(() => fetch("/api/jobs/' + id + '/outputs", { cache: "no-store" }).then((r) => r.json()).then((d) => JSON.stringify({ n: (d.files || []).length, mrcs: (d.files || []).filter((f) => f.name && f.name.endsWith(".mrcs")).map((f) => ({ p: f.path, slices: f.slices, remote: f.remote, size: f.size })) })))()';

const jobs = await (async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
})();
const class2d = jobs.find((j) => j.type === "class2d" && j.status === "completed");
console.log("class2d:", class2d.id, class2d.name);

ab("open http://localhost:3000");
sleep(4);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);

console.log("open:", JSON.stringify(evalJson(plainClick(class2d.id))));
sleep(2.5);
console.log("tab:", JSON.stringify(evalJson(tabMouseDown("Results"))));
sleep(3);

const listing = evalJson(PAGE_LISTING(class2d.id));
console.log("in-page listing:", JSON.stringify(listing).slice(0, 400));

const door =
  '(() => { const sec = document.querySelector("section[aria-label=\\"Maps and images\\"]"); if (!sec) return JSON.stringify({ clicked: false }); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path") === "run_classes.mrcs"); if (!t) return JSON.stringify({ clicked: false, have: Array.from(sec.querySelectorAll("button[data-tile-path]")).map((b) => b.getAttribute("data-tile-path")).slice(0, 10) }); t.click(); return JSON.stringify({ clicked: true }); })()';
console.log("door:", JSON.stringify(evalJson(door)));
sleep(4);

const dialog = evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ dlg: false }); const ro = d.querySelector("[data-canvas-ui=stack-slice-readout]"); const rg = d.querySelector("[data-canvas-ui=stack-slice-range]"); const imgs = Array.from(d.querySelectorAll("img")).map((i) => (i.getAttribute("alt") || "").slice(0, 40)); const meta = d.querySelector("[data-canvas-ui=stack-montage-meta]"); return JSON.stringify({ dlg: true, count: ds.length, head: (d.querySelector("[id]") || {}).textContent ? Array.from(d.querySelectorAll("h2,h3,h4")).map((h) => (h.textContent || "").trim().slice(0, 40)) : [], readout: ro ? (ro.textContent || "").trim() : null, rangeNow: rg ? rg.getAttribute("aria-valuenow") : null, rangeMax: rg ? rg.getAttribute("aria-valuemax") : null, rangeMin: rg ? rg.getAttribute("aria-valuemin") : null, meta: meta ? (meta.textContent || "").trim().slice(0, 80) : null, imgs: imgs.slice(0, 3) }); })()');
console.log("dialog:", JSON.stringify(dialog).slice(0, 500));

const ESC_ALL =
  '(() => { let n = 0; for (let i = 0; i < 8; i++) { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) break; const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); n++; } return JSON.stringify({ esc: n, left: document.querySelectorAll("[role=dialog]").length }); })()';
/* the S13 walk's own door: click the hist toggle, watch the strip's
 * state AND the dialog's survival second by second (the sixth ride's
 * lesson: the dialog vanished between S12 and S13a) */
console.log("toggle:", JSON.stringify(evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = d && d.querySelector("[data-canvas-ui=quick-hist-toggle]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()')));
for (let i = 0; i < 8; i++) {
  sleep(1);
  const w = evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ dlg: false }); const s = d.querySelector("[data-canvas-ui=quick-hist]"); return JSON.stringify({ dlg: true, count: ds.length, state: s ? s.getAttribute("data-hist-state") : null }); })()');
  console.log(`t+${i + 1}s:`, JSON.stringify(w));
}
console.log("esc:", JSON.stringify(evalJson(ESC_ALL)));
ab("close");
console.log("DONE");
