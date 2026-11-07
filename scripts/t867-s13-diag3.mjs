#!/usr/bin/env node
/** t867 S13 diag 3 — is the stack histogram's data loaded, and what does
 * the preset click throw (window.onerror hook)? */
import { execSync } from "node:child_process";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8", cwd: "/home/z/my-project" });
const sleep = (s) => execSync(`sleep ${s}`);
const ej = (js) => {
  const r = ab(`eval ${JSON.stringify(js)}`).trim();
  try {
    const p = JSON.parse(r);
    return typeof p === "string" ? JSON.parse(p) : p;
  } catch {
    return { raw: r.slice(0, 200) };
  }
};

// arm the error hook
ej('(() => { window.__errs = []; window.addEventListener("error", (e) => window.__errs.push(String(e.message || e).slice(0, 120))); return 1 })()');

const probe =
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const canv = d ? d.querySelector("canvas") : null; const stripEls = d ? Array.from(d.querySelectorAll("[data-canvas-ui]")).map(e => e.getAttribute("data-canvas-ui")).filter(u => u && u.startsWith("quick-hist")) : []; return JSON.stringify({ hasCanvas: !!canv, canvasW: canv ? canv.width : null, stripEls: stripEls.slice(0, 6) }); })()';
console.log("strip state:", JSON.stringify(ej(probe)));

// click via the full pointer sequence (pointerdown -> pointerup -> click)
console.log("pointer-seq click:", JSON.stringify(ej('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const b = d.querySelector(\'button[data-win-preset="1"]\'); if (!b) return JSON.stringify({ f: 0 }); const r = b.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; b.dispatchEvent(new PointerEvent("pointerdown", o)); b.dispatchEvent(new PointerEvent("pointerup", o)); b.click(); return JSON.stringify({ f: 1, disabled: b.disabled, std: null }); })()')));
sleep(2);
console.log("row after pointer-seq:", JSON.stringify(ej('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const row = d.querySelector(\'[data-canvas-ui$="-win"]\'); const p1 = row.querySelector(\'button[data-win-preset="1"]\'); return JSON.stringify({ state: row.getAttribute("data-win-state"), p1: p1.getAttribute("aria-pressed") }); })()')));
console.log("errors:", JSON.stringify(ej('(() => { return JSON.stringify(window.__errs || []); })()')));
