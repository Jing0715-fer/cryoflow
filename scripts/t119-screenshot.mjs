// t119 visual check — self-seeds a failed job, screenshots the diagnosis
// strip (screen), removes everything after.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (c) => execSync(c, { encoding: "utf8" }).trim();
const flip = (id, status, progress) =>
  sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:'${id}'},data:{status:'${status}',progress:${progress}}}).then(()=>p.\\$disconnect())"`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
let id = "";
let wd = "";
try {
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(4500);
  const ws = (await (await fetch(`${BASE}/api/workspaces`)).json()).workspaces ?? [];
  const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  const maxY = jobs.reduce((m, j) => Math.max(m, (j.y ?? 0) + 260), 800);
  const created = await (await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "refine3d", name: "t119 Shot", workspaceId: ws[0].id, x: 140, y: maxY + 260 }),
  })).json();
  const j = created?.job ?? created;
  id = j.id;
  const proj = j.projectId;
  wd = `/home/z/my-project/data/relion/${proj}/refine3d_${id.slice(-8)}`;
  mkdirSync(wd, { recursive: true });
  writeFileSync(`${wd}/run.out`, [
    "RELION: 3D auto-refine (t119 shot)",
    "Reading 20480 particles ... done",
    "Iteration 01: E-step ... done",
    "CUDA error: out of memory when allocating workspace",
    "Iteration 05: M-step ... 0.618",
    "No such file or directory: ../MotionCorr/job008/corrected_micrographs.star",
    "Falling back to local stack ...",
  ].join("\n") + "\n");
  writeFileSync(`${wd}/run.err`, "Killed\ntouch: cannot touch 'run.out': No space left on device\ncat: results/star: Permission denied\n");
  const sp = "/home/z/my-project/data/engine-state.json";
  const state = existsSync(sp) ? JSON.parse(readFileSync(sp, "utf8")) : {};
  state[id] = { jobId: id, projectId: proj, type: "refine3d", pid: null, cmd: "t119 shot",
    workdir: wd, logFile: `${wd}/run.out`, errFile: `${wd}/run.err`,
    startedAt: new Date().toISOString(), outputs: {}, done: true, exitCode: 1 };
  writeFileSync(sp, JSON.stringify(state, null, 2));
  flip(id, "failed", 47);
  await p.reload({ waitUntil: "domcontentloaded" });
  await sleep(4500);
  await p.locator("[data-job]", { hasText: "t119 Shot" }).first().click();
  await sleep(1500);
  await p.locator('[role="tab"]').filter({ hasText: /^Log$/ }).first().click();
  await sleep(2500);
  await p.screenshot({ path: "/tmp/t119-strip.png", fullPage: false });
  // print-emulation shot: the strip re-inked
  await p.emulateMedia({ media: "print" });
  await sleep(800);
  await p.screenshot({ path: "/tmp/t119-strip-print.png", fullPage: false });
  console.log("saved /tmp/t119-strip.png + /tmp/t119-strip-print.png");
} finally {
  try { await b.close(); } catch {}
  if (id) { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }).catch(() => {}); }
  if (wd) { try { rmSync(wd, { recursive: true, force: true }); } catch {} }
}
