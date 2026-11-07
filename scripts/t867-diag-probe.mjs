#!/usr/bin/env node
/** t867 diag probe — pin the Mol* chrome's unnamed elements' identity. */
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
const pp = roster.find((j) => j.type === "postprocess" && j.status === "completed");
console.log("host:", pp.id);

ej('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return 1 })()');
ab("open http://localhost:3000");
sleep(4);

const clickCard =
  '(() => { const el = Array.from(document.querySelectorAll("[data-card-btn]")).find(e => e.getAttribute("data-card-btn")==="' +
  pp.id +
  '"); if (!el) return JSON.stringify({f:0}); const r = el.getBoundingClientRect(); const o = {bubbles:true,button:0,pointerId:9,clientX:r.x+r.width/2,clientY:r.y+r.height/2}; el.dispatchEvent(new PointerEvent("pointerdown",o)); el.dispatchEvent(new PointerEvent("pointerup",o)); return JSON.stringify({f:1}); })()';
console.log("card:", JSON.stringify(ej(clickCard)));
sleep(4);

const tab =
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find(e => (e.textContent||"").trim()==="Results"); if (!t) return JSON.stringify({f:0}); t.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,button:0})); return JSON.stringify({f:1}); })()';
console.log("tab:", JSON.stringify(ej(tab)));
sleep(5);

const tile =
  '(() => { const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); const t = sec && Array.from(sec.querySelectorAll("[data-tile-path]")).find(e => (e.getAttribute("data-tile-path")||"").endsWith("postprocess.mrc")); if (!t) return JSON.stringify({f:0}); t.click(); return JSON.stringify({f:1}); })()';
console.log("tile:", JSON.stringify(ej(tile)));
sleep(4);

const v3 =
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const b = d && Array.from(d.querySelectorAll("button")).find(x => ((x.getAttribute("aria-label")||"") + (x.textContent||"")).includes("View in 3D")); if (!b) return JSON.stringify({f:0}); b.click(); return JSON.stringify({f:1}); })()';
console.log("view3d:", JSON.stringify(ej(v3)));
sleep(14);

const unProbe =
  '(() => { const nameOf = (e) => ((e.getAttribute("aria-label") || "") || (e.getAttribute("aria-labelledby") ? ((document.getElementById(e.getAttribute("aria-labelledby")) || {}).textContent || "") : "") || (e.textContent || "").trim() || (e.getAttribute("title") || "")).trim(); const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter(b => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")).filter(c => !nameOf(c)); return JSON.stringify({ unnamed: un.length, samples: un.slice(0, 10).map(b => ({ title: b.getAttribute("title"), html: b.outerHTML.slice(0, 130) })), unCtrls: ctrls.map(c => ({ tag: c.tagName, type: c.type, html: c.outerHTML.slice(0, 160) })) }); })()';
const un = ej(unProbe);
console.log(JSON.stringify(un, null, 1).slice(0, 3500));

const km = ej('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); return JSON.stringify({ panel: !!o, keymap: o ? !!o.querySelector("[data-canvas-ui=ortho-keymap]") : false, expanded: o ? (Array.from(o.querySelectorAll("button")).find(b => b.getAttribute("aria-expanded")!==null)||{}).getAttribute?.("aria-expanded") : null }); })()');
console.log("keymap:", JSON.stringify(km));
ab("close");
