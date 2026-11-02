#!/usr/bin/env node
/** t867 S13 diag — why doesn't the follow-window toggle flip after the arm? */
import { execSync } from "node:child_process";

const ROOT = "/home/z/my-project";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);
const ej = (js) => {
  const r = ab(`eval ${JSON.stringify(js)}`).trim();
  try {
    const p = JSON.parse(r);
    return typeof p === "string" ? JSON.parse(p) : p;
  } catch {
    console.log("RAW:", r.slice(0, 200));
    return {};
  }
};

const SH = { Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" };
const jobs = await (await fetch("http://localhost:3000/api/jobs", { headers: SH })).json();
const roster = jobs.jobs ?? jobs;
const ex = roster.find((j) => j.type === "extract" && j.status === "completed");

ab("open http://localhost:3000");
sleep(5);
ej('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return 1 })()');
ab("open http://localhost:3000");
sleep(4);
const clickCard =
  '(() => { const el = Array.from(document.querySelectorAll("[data-card-btn]")).find(e => e.getAttribute("data-card-btn")==="' + ex.id + '"); if (!el) return JSON.stringify({f:0}); const r = el.getBoundingClientRect(); const o = {bubbles:true,button:0,pointerId:9,clientX:r.x+r.width/2,clientY:r.y+r.height/2}; el.dispatchEvent(new PointerEvent("pointerdown",o)); el.dispatchEvent(new PointerEvent("pointerup",o)); return JSON.stringify({f:1}); })()';
console.log("card:", JSON.stringify(ej(clickCard)));
sleep(4);
console.log("tab:", JSON.stringify(ej('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find(e => (e.textContent||"").trim()==="Results"); if (!t) return JSON.stringify({f:0}); t.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0})); return JSON.stringify({f:1}); })()')));
sleep(5);
console.log("tile:", JSON.stringify(ej('(() => { const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); const t = sec && Array.from(sec.querySelectorAll("[data-tile-path]")).find(e => (e.getAttribute("data-tile-path")||"").endsWith(".mrcs")); if (!t) return JSON.stringify({f:0}); t.click(); return JSON.stringify({f:1}); })()')));
sleep(5);

const dumpToggle =
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const b = d && d.querySelector("[data-canvas-ui=stack-montage-window]"); if (!b) return JSON.stringify({f:0}); return JSON.stringify({ pressed: b.getAttribute("aria-pressed"), disabled: b.disabled, html: b.outerHTML.slice(0, 200) }); })()';
console.log("toggle before arm:", JSON.stringify(ej(dumpToggle), null, 1));

console.log("hist open:", JSON.stringify(ej('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const b = d && d.querySelector("[data-canvas-ui=quick-hist-toggle]"); if (!b) return JSON.stringify({f:0, dlgBtns: d.querySelectorAll("button").length}); b.click(); return JSON.stringify({f:1}); })()')));
sleep(8);
const winRow =
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const row = d && d.querySelector("[data-canvas-ui$=-win]"); if (!row) return JSON.stringify({f:0}); const bs = Array.from(row.querySelectorAll("button")).map(b => ({ t: (b.textContent||"").trim(), p: b.getAttribute("aria-pressed"), dis: b.disabled, preset: b.getAttribute("data-win-preset") })); return JSON.stringify({ state: row.getAttribute("data-win-state"), loS: row.getAttribute("data-win-lo-sigma"), bs }); })()';
console.log("win row after hist open:", JSON.stringify(ej(winRow), null, 1));
console.log("arm:", JSON.stringify(ej('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const row = d && d.querySelector("[data-canvas-ui$=-win]"); if (!row) return JSON.stringify({f:0}); const b = Array.from(row.querySelectorAll("button")).find(x => x.getAttribute("aria-pressed") === "false" && !x.disabled && x.getAttribute("data-win-preset") !== "auto"); if (!b) return JSON.stringify({f:0, why:"none"}); b.click(); return JSON.stringify({f:1, preset:(b.textContent||"").trim()}); })()')));
sleep(2);
console.log("win row after arm:", JSON.stringify(ej(winRow), null, 1));
console.log("toggle after arm:", JSON.stringify(ej(dumpToggle), null, 1));
console.log("click toggle:", JSON.stringify(ej('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const b = d && d.querySelector("[data-canvas-ui=stack-montage-window]"); if (!b) return JSON.stringify({f:0}); b.click(); return JSON.stringify({f:1}); })()')));
sleep(1.5);
console.log("toggle after click:", JSON.stringify(ej(dumpToggle), null, 1));
ab("close");
