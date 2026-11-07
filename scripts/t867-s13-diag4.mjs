#!/usr/bin/env node
/** t867 S13 diag 4 — the stats text (does the strip's data carry std>0?). */
import { execSync } from "node:child_process";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8", cwd: "/home/z/my-project" });
const ej = (js) => {
  const r = ab(`eval ${JSON.stringify(js)}`).trim();
  try {
    const p = JSON.parse(r);
    return typeof p === "string" ? JSON.parse(p) : p;
  } catch {
    return { raw: r.slice(0, 200) };
  }
};
const probe =
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const st = d.querySelector("[data-canvas-ui=quick-hist-stats]"); const cv = d.querySelector("canvas"); return JSON.stringify({ stats: st ? (st.textContent || "").trim().slice(0, 140) : null, canvasTitle: cv ? (cv.getAttribute("title") || "").slice(0, 90) : null }); })()';
console.log(JSON.stringify(ej(probe), null, 1));
