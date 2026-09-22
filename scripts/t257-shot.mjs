// t257-shot — the money shot: the Reference map card on a refine3d's
// Overview, fed by a real crop → Import Map → seeded probe (t257 world).
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/download/shots-qa/t257-reference-card-2x.png";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const jobs0 = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
const host = jobs0.find((j) => j.name === "QA Refine3D");
const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const hostWd = state[host.id]?.workdir;

const send = await fetch(`${BASE}/api/jobs/${host.id}/outputs/subvolume-job`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "orthovol.mrc", x0: 0.25, x1: 0.75, y0: 0.25, y1: 0.75, z0: 0.25, z1: 0.75 }),
});
const sent = await send.json();
const importJob = sent.job;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2000);
await page.evaluate(async (id) => { await fetch(`/api/jobs/${id}/run`, { method: "POST" }); }, importJob.id);
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  const js = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  if (js.find((j) => j.id === importJob.id)?.status === "completed") break;
}
const st = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const refPath = st[importJob.id]?.outputs?.model_mrc;
const mk = await fetch(`${BASE}/api/jobs`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "refine3d", name: "QA RefProbe shot", x: host.x + 240, y: host.y + 60, workspaceId: host.workspaceId ?? undefined }) });
const probe = (await mk.json()).job;
const probeWd = `/home/z/my-project/data/relion/${probe.projectId}/refine3d_shot`;
mkdirSync(probeWd, { recursive: true });
st[probe.id] = { jobId: probe.id, projectId: probe.projectId, type: "refine3d", pid: null,
  cmd: `mpirun -n 3 relion_refine_mpi --i particles.star --ref ${refPath} --ini_high 30 --sym C1 --o run`,
  workdir: probeWd, logFile: probeWd + "/run.out", errFile: probeWd + "/run.err",
  startedAt: new Date().toISOString(), outputs: {}, done: true, exitCode: 0 };
writeFileSync("data/engine-state.json", JSON.stringify(st, null, 2));
execSync(
  `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:process.argv[1]},data:{status:'completed',progress:100}}).then(()=>{console.log('flipped');return p.\\$disconnect();}).catch(e=>{console.error(e.message);process.exit(1);});" ${probe.id}`,
  { cwd: "/home/z/my-project", encoding: "utf8" });
await fetch(`${BASE}/api/edges`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fromJobId: importJob.id, toJobId: probe.id, fromPort: "model_mrc", toPort: "reference" }) });

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(3000);
await page.locator(`[data-job="${probe.id}"]`).first().click({ force: true });
await sleep(1000);
await page.locator('[role="tab"]', { hasText: "Overview" }).click().catch(() => {});
await sleep(1800);
const card = page.locator('[data-canvas-ui="reference-map"]');
if (await card.isVisible().catch(() => false)) {
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  await page.screenshot({ path: OUT });
  console.log("shot saved:", OUT);
} else {
  console.log("CARD NOT VISIBLE — no shot");
}
await browser.close();
// cleanup
await fetch(`${BASE}/api/jobs/${probe.id}`, { method: "DELETE" });
await fetch(`${BASE}/api/jobs/${importJob.id}`, { method: "DELETE" });
execSync(`rm -f "${hostWd}/SubVolumes/"*_crop_* 2>/dev/null; rm -rf /home/z/my-project/data/relion/${probe.projectId}/refine3d_shot`, { shell: "/bin/bash" });
const after = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
console.log("roster after cleanup:", after.length);
