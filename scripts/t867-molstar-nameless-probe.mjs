#!/usr/bin/env node
/**
 * t867 probe #2 — the Mol* dialog's NAMELESS buttons, ground truth.
 *
 * The quick-look page's first ride went red on V12/B7 (nine nameless
 * `msp-btn` buttons with the Mol* stack up). Before remediating, MEASURE
 * the nameless: their class signature, their title attribute (Mol* icon
 * buttons usually carry one), their textContent, their coordinates —
 * the naming map must be born from the live DOM, not from guesswork.
 *
 *   node scripts/t867-molstar-nameless-probe.mjs
 */
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const sleep = (s) => execSync(`sleep ${s}`);

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  try {
    const out = JSON.parse(raw);
    if (typeof out === "string") {
      try { return JSON.parse(out); } catch { return out; }
    }
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
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};

const nameOf = (b) =>
  b.getAttribute("aria-label") ||
  (b.getAttribute("aria-labelledby")
    ? (document.getElementById(b.getAttribute("aria-labelledby")) || {}).textContent || ""
    : "") ||
  (b.textContent || "").trim();

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

const tileDoor = (suffix) =>
  '(() => { const sec = document.querySelector("section[aria-label=\\"Maps and images\\"]"); if (!sec) return JSON.stringify({ clicked: false }); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path").endsWith("' + suffix + '")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()';

const view3dDoor =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = Array.from(d.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || x.textContent || "")).includes("View in 3D")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

const NAMELESS =
  '(() => { const nameOf = (b) => b.getAttribute("aria-label") || (b.getAttribute("aria-labelledby") ? ((document.getElementById(b.getAttribute("aria-labelledby")) || {}).textContent || "") : "") || (b.textContent || "").trim(); const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const nameOfC = (c) => c.getAttribute("aria-label") || (c.getAttribute("aria-labelledby") ? ((document.getElementById(c.getAttribute("aria-labelledby")) || {}).textContent || "") : "") || (document.querySelector(\'label[for="\' + (CSS.escape ? CSS.escape(c.id) : c.id) + \'"\') || {}).textContent || "" || (c.value || "").trim() || (c.getAttribute("placeholder") || "").trim(); const unC = ctrls.filter((c) => !nameOfC(c)); return JSON.stringify({ total: btns.length, nameless: un.length, who: un.map((b) => ({ cls: String(b.className).slice(0, 80), title: b.getAttribute("title"), text: (b.textContent || "").trim().slice(0, 20), dlg: !!b.closest("[role=dialog]"), msp: !!b.closest("[class*=msp]"), parentCls: String(b.parentElement && b.parentElement.className).slice(0, 40) })), ctrls: ctrls.length, unCtrls: unC.length, unWhoC: unC.map((c) => ({ tag: c.tagName, type: c.getAttribute("type"), cls: String(c.className).slice(0, 60), id: c.id, aria: c.getAttribute("aria-label"), title: c.getAttribute("title"), placeholder: c.getAttribute("placeholder"), value: (c.value || "").slice(0, 20), msp: !!c.closest("[class*=msp]"), parentCls: String(c.parentElement && c.parentElement.className).slice(0, 50) })) }); })()';

const ESC_ALL =
  '(() => { let n = 0; for (let i = 0; i < 8; i++) { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) break; const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); n++; } return JSON.stringify({ esc: n, left: document.querySelectorAll("[role=dialog]").length }); })()';

const jobs = await roster();
const mapHost = jobs.find((j) => j.type === "postprocess" && j.status === "completed");
if (!mapHost) {
  console.error("no completed postprocess host — nothing to probe");
  process.exit(1);
}
console.log(`map host: ${mapHost.name} (${mapHost.id})`);

ab("open http://localhost:3000");
sleep(4);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);

console.log("open inspector:", JSON.stringify(evalJson(plainClick(mapHost.id))));
sleep(2);
console.log("results tab:", JSON.stringify(evalJson(tabMouseDown("Results"))));
sleep(3);
console.log("map tile:", JSON.stringify(evalJson(tileDoor(".mrc"))));
sleep(3);
console.log("view in 3D:", JSON.stringify(evalJson(view3dDoor)));

/* the Mol* chunk compiles + the volume downloads — bounded wait for the
 * ortho panel (the embed's own handoff), then measure the nameless. */
let m = null;
for (let i = 0; i < 45; i++) {
  sleep(1);
  m = evalJson('(() => { return JSON.stringify({ dlg: document.querySelectorAll("[role=dialog]").length, ortho: !!document.querySelector("[data-canvas-ui=ortho-panel]"), canvas: !!document.querySelector("[class*=msp] canvas, canvas") }); })()');
  if (m.ortho) break;
}
console.log("molstar arrival:", JSON.stringify(m));
sleep(4); // the plugin UI's late toolbar render

const un = evalJson(NAMELESS);
console.log(`\nbuttons total: ${un.total}, nameless: ${un.nameless}`);
for (const w of un.who || []) {
  console.log(`  - msp=${w.msp} dlg=${w.dlg} title=${JSON.stringify(w.title)} text=${JSON.stringify(w.text)}\n    cls=${w.cls}\n    parent=${w.parentCls}`);
}
console.log(`controls: ${un.ctrls}, nameless: ${un.unCtrls}`);
for (const c of un.unWhoC || []) {
  console.log(`  C <${c.tag} type=${JSON.stringify(c.type)}> msp=${c.msp} aria=${JSON.stringify(c.aria)} title=${JSON.stringify(c.title)} ph=${JSON.stringify(c.placeholder)} val=${JSON.stringify(c.value)}\n    cls=${c.cls}\n    id=${JSON.stringify(c.id)} parent=${c.parentCls}`);
}

console.log("\nescape home:", JSON.stringify(evalJson(ESC_ALL)));
ab("close");
console.log("DONE");
