#!/usr/bin/env node
/** t873 death film 2 — replicate the instrument's FULL pre-history (W0 open ->
 * reload -> re-open) and film with the page marker to name the killer. */
import { execSync } from "node:child_process";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8", cwd: process.cwd() });
const sleep = (s) => execSync(`sleep ${s}`);
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  try { return JSON.parse(JSON.parse(raw)); } catch { return JSON.parse(raw); }
};

const FILM =
  '(() => { const dgs = document.querySelectorAll("[role=dialog]"); const dlgTop = dgs[dgs.length - 1]; const pre = dlgTop ? dlgTop.querySelector(\'pre[aria-label="Generated sbatch script"]\') : null; return JSON.stringify({ marker: window.__t873mark ?? null, dlg: dgs.length, preLen: pre ? (pre.textContent || "").length : 0, btns: document.querySelectorAll("button").length }); })()';
const MARK = '(() => { window.__t873mark = "alive"; return "marked"; })()';

ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);

const jobs = await (await fetch("http://localhost:3000/api/jobs", {
  headers: { Origin: "http://localhost:3000", Referer: "http://localhost:3000/" },
})).json();
const host = (jobs.jobs ?? jobs).find((j) => j.type === "refine3d" && j.status === "completed");

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ clicked: true }); })()';
const openDoors = async () => {
  evalJson(plainClick(host.id));
  sleep(3);
  try { ab(`click '[aria-label="More job tools"]'`); } catch {}
  sleep(1.5);
  try { ab(`click '[data-testid="tools-sbatch-item"]'`); } catch {}
  sleep(2);
};

// W0: the birth open
await openDoors();
console.log("W0-open:", JSON.stringify(evalJson(FILM)));
// the post-tax reload (the instrument's own law)
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
// Face I/T/D: the re-open, then film 40s
await openDoors();
evalJson(MARK);
for (let i = 0; i < 40; i++) {
  const f = evalJson(FILM);
  console.log(`t+${i}s: ${JSON.stringify(f)}`);
  if (f.marker === null) { console.log(">>> THE PAGE RELOADED (marker gone) — the HMR/tax second wave"); break; }
  if (f.dlg === 0) { console.log(">>> dialog gone, page NOT reloaded — an app-level close"); break; }
  sleep(1);
}
