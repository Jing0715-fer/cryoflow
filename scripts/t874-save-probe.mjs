#!/usr/bin/env node
/** t874 save probe — why did the rename not persist? (diagnostic, one ride) */
import { execSync } from "node:child_process";
const ab = (a) => execSync(`agent-browser ${a}`, { encoding: "utf8", cwd: process.cwd() });
const sleep = (s) => execSync(`sleep ${s}`);
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  try { return JSON.parse(JSON.parse(raw)); } catch { return JSON.parse(raw); }
};
const SH = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", "Content-Type": "application/json" };
const getReg = async () => (await (await fetch("http://localhost:3000/api/hpc/profiles", { headers: SH })).json()).profiles;
const jobs = await (await fetch("http://localhost:3000/api/jobs", { headers: SH })).json();
const host = (jobs.jobs ?? jobs).find((j) => j.type === "refine3d" && j.status === "completed");

const FILM =
  '(() => { const dgs = document.querySelectorAll("[role=dialog]"); const top = dgs[dgs.length-1]; const nameF = top ? top.querySelector(\'input[aria-label="Profile display name"]\') : null; const st = top ? top.querySelector("[role=status]") : null; const al = top ? top.querySelector("[role=alert]") : null; const list = top ? top.querySelector(\'[role=list][aria-label="Profile list"]\') : null; return JSON.stringify({ dlg: dgs.length, topHead: top ? ((document.getElementById(top.getAttribute("aria-labelledby")||"")||{}).textContent||"").trim().slice(0,32) : null, nameVal: nameF ? nameF.value : null, status: st ? (st.textContent||"").trim().slice(0,32) : null, alert: al ? (al.textContent||"").trim().slice(0,60) : null, rows: list ? list.querySelectorAll("[role=listitem]").length : 0 }); })()';

// plant scratch
const orig = await getReg();
if (!orig.some((p) => p.id === "t874-scratch")) {
  const r = await fetch("http://localhost:3000/api/hpc/profiles", { method: "POST", headers: SH, body: JSON.stringify({ profiles: [...orig, { id: "t874-scratch", name: "T874 scratch", host: "login.scratch.example.org", partition: "scratch", account: "cryo-em", qos: "normal", timeLimitMin: 60, nodes: 1, gpusPerNode: 2, gpuModel: "V100", relionHome: "/opt/relion/5.0.1", dataRoot: "/lustre/scratch", localRoot: orig.find(p=>p.id==="slurm-gpu-cluster")?.localRoot ?? "data/relion", envLines: [], arrayConcurrency: 4, gpuSpeedup: 5 }] }) });
  console.log("plant:", r.status);
}

ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ clicked: true }); })()';
evalJson(plainClick(host.id));
sleep(3);
try { ab(`click '[aria-label="More job tools"]'`); } catch {}
sleep(1.5);
try { ab(`click '[data-testid="tools-sbatch-item"]'`); } catch {}
sleep(2.5);
console.log("stack:", JSON.stringify(evalJson(FILM)));
try { ab(`click '[aria-label="Manage cluster profiles"]'`); } catch {}
sleep(3);
console.log("editor open:", JSON.stringify(evalJson(FILM)));

// the row click + the fill
evalJson('(() => { const list = document.querySelector(\'[role=list][aria-label="Profile list"]\'); const b = Array.from(list.querySelectorAll("button")).find((x) => (x.textContent || "").includes("T874 scratch")); if (b) b.click(); return b ? "row-clicked" : "no-row"; })()');
sleep(1);
try { ab(`fill '[aria-label="Profile display name"]' 'T874 scratch renamed'`); } catch (e) { console.log("fill fail:", String(e.message).slice(0, 80)); }
sleep(1);
console.log("after fill:", JSON.stringify(evalJson(FILM)));

// the save click — with the button's disabled state filmed FIRST
const btnState = evalJson('(() => { const top = document.querySelectorAll("[role=dialog]")[document.querySelectorAll("[role=dialog]").length-1]; const b = Array.from(top.querySelectorAll("button")).find((x) => (x.textContent || "").includes("Save to server")); return JSON.stringify({ found: !!b, disabled: b ? b.disabled : null }); })()');
console.log("save button:", btnState);
evalJson('(() => { const top = document.querySelectorAll("[role=dialog]")[document.querySelectorAll("[role=dialog]").length-1]; const b = Array.from(top.querySelectorAll("button")).find((x) => (x.textContent || "").includes("Save to server")); if (b) b.click(); return "save-clicked"; })()');
for (let i = 0; i < 8; i++) {
  console.log(`t+${i}s:`, JSON.stringify(evalJson(FILM)));
  sleep(1);
}
const reg = await getReg();
console.log("registry scratch name:", (reg.find((p) => p.id === "t874-scratch") ?? {}).name);
// restore
await fetch("http://localhost:3000/api/hpc/profiles", { method: "POST", headers: SH, body: JSON.stringify({ profiles: orig }) });
const back = await getReg();
console.log("restored:", back.length === orig.length);
