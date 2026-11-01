#!/usr/bin/env node
/** t867 S13 diag 2 — real CDP click on the sigma preset (the session is
 * already inside the stack dialog with the histogram open). */
import { execSync } from "node:child_process";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8", cwd: "/home/z/my-project" });
const ej = (js) => {
  const r = ab(`eval ${JSON.stringify(js)}`).trim();
  try {
    const p = JSON.parse(r);
    return typeof p === "string" ? JSON.parse(p) : p;
  } catch {
    return { raw: r.slice(0, 150) };
  }
};

const winRow =
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const row = d && d.querySelector("[data-canvas-ui$=-win]"); if (!row) return JSON.stringify({ f: 0 }); const p1 = row.querySelector(\'button[data-win-preset="1"]\'); return JSON.stringify({ state: row.getAttribute("data-win-state"), lo: (row.getAttribute("data-win-lo") || "").slice(0, 10), p1: p1 ? p1.getAttribute("aria-pressed") : null }); })()';
console.log("before:", JSON.stringify(ej(winRow)));
console.log("real click:", ab('click button[data-win-preset="1"]').trim().slice(0, 60));
execSync("sleep 2");
console.log("after:", JSON.stringify(ej(winRow)));
console.log("toggle:", JSON.stringify(ej('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const b = d && d.querySelector("[data-canvas-ui=stack-montage-window]"); return JSON.stringify({ pressed: b && b.getAttribute("aria-pressed"), disabled: b && b.disabled }); })()')));
