#!/usr/bin/env node
/**
 * t869 — the results-family red-cluster probe: the t865 ride filmed three
 * clusters of red against the resurrected world (FSC candidates 0/6, the
 * funnel's pours=0, the class2d card transient). This probe walks the two
 * dialogs LIVE and films their internals — the honest diagnosis before
 * any fix (product truth vs instrument staleness).
 */
import { execSync } from "node:child_process";
import { arrivalDoor, openRetry, sleep, evalJson, fetchRetry, SH } from "./arrival-laws.mjs";

const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: process.cwd() });

const roster = async () => {
  const b = await (await fetchRetry(`${BASE}/api/jobs`, { headers: SH })).json();
  return b.jobs ?? b;
};

const MEASURE =
  '(() => { const ds = Array.from(document.querySelectorAll("[role=dialog]")); const top = ds[ds.length - 1]; ' +
  'const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 60) : null; ' +
  'const rows = top ? top.querySelectorAll("[data-candidate-row], [role=row], li[data-job-id], [data-fsc-row]").length : 0; ' +
  'const pours = top ? top.querySelectorAll("[data-pour], [data-canvas-ui=stage-pour], svg[data-pour]").length : 0; ' +
  'const svgIcons = top ? top.querySelectorAll("svg").length : 0; ' +
  'const listTxt = top ? (top.querySelector("[data-canvas-ui=fsc-candidates], [role=listbox], [data-radix-popper-content-wrapper]") || {}).textContent || "" : ""; ' +
  'return JSON.stringify({ dlg: ds.length, head: headOf(top), rows: rows, pours: pours, svgIcons: svgIcons, listTxt: String(listTxt).slice(0, 200), bodyTxt: top ? (top.textContent || "").slice(0, 300) : "" }); })()';

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';
const clickText = (txt) =>
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = Array.from((d || document).querySelectorAll("button")).find((x) => (x.textContent || "").trim().startsWith("' + txt + '")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

const m = () => evalJson(MEASURE);
const waitM = (probe, secs) => {
  let v = m();
  for (let i = 0; i < secs && !probe(v); i++) { sleep(1); v = m(); }
  return v;
};

openRetry(BASE);
sleep(3);
await arrivalDoor("the probe canvas");
const jobs = await roster();
const post = jobs.find((j) => j.type === "postprocess" && j.status === "completed");
const class2d = jobs.find((j) => j.type === "class2d");
console.log("postprocess:", post?.id, "class2d:", class2d?.id);

/* A — the FSC compare dialog */
console.log("\nA. the FSC compare dialog");
console.log("  card click:", evalJson(plainClick(post.id)).clicked);
waitM((v) => v.dlg >= 1, 20);
console.log("  results tab:", evalJson(tabMouseDown("Results")).found);
sleep(2);
const chip = evalJson('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return JSON.stringify({ found: false, txt: null }); b.click(); return JSON.stringify({ found: true, txt: (b.textContent || "").trim() }); })()');
console.log("  compare chip:", JSON.stringify(chip));
const fc = waitM((v) => (v.head || "").startsWith("Compare FSC"), 20);
console.log("  dialog:", JSON.stringify({ dlg: fc.dlg, head: fc.head, rows: fc.rows, svgIcons: fc.svgIcons, listTxt: fc.listTxt, bodyTxt: fc.bodyTxt.slice(0, 260) }));
evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length-1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1.2);
evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length-1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1.2);

/* B — the particle funnel dialog */
console.log("\nB. the particle funnel dialog");
console.log("  card click:", evalJson(plainClick(post.id)).clicked);
waitM((v) => v.dlg >= 1, 20);
const pf = evalJson(clickText("Particle funnel"));
console.log("  funnel door:", JSON.stringify(pf));
const pfv = waitM((v) => (v.head || "").startsWith("Particle funnel"), 20);
console.log("  dialog:", JSON.stringify({ dlg: pfv.dlg, head: pfv.head, pours: pfv.pours, svgIcons: pfv.svgIcons, bodyTxt: pfv.bodyTxt.slice(0, 260) }));
evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length-1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1.2);
evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length-1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1.2);

/* C — the class2d card arrival timing (the CV1 transient) */
console.log("\nC. the class2d card's presence after an inspector close (the CV1 transient)");
console.log("  card click:", evalJson(plainClick(class2d.id)).clicked);
waitM((v) => v.dlg >= 1, 20);
const escNow = () => { evalJson('(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length-1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()'); };
escNow(); sleep(1);
escNow(); sleep(1.5);
for (let i = 0; i < 8; i++) {
  const cardProbe = evalJson('(() => JSON.stringify({ has: !!document.querySelector("[data-card-btn=\\"' + class2d.id + '\\"]"), dlg: document.querySelectorAll("[role=dialog]").length, cards: document.querySelectorAll("[data-card-btn]").length }))()');
  console.log(`  +${i}: ${JSON.stringify(cardProbe)}`);
  if (cardProbe.has) break;
  sleep(1);
}
console.log("probe done");
