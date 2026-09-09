// qa64-net-diag — is the stale curve the BROWSER's fetch or the React state?
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const AB = "agent-browser";
const B = "http://localhost:3000";
const PROJECT = "cmtrzp5x80002p8uofb9eu5pp";
const LIVE_WD = `/home/z/my-project/data/relion/${PROJECT}/refine3d_q8mu0tdp`;
const IT016 = `${LIVE_WD}/run_it016_model.star`;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 60_000, input: expr }).trim();

sh(`${AB} close`); await sleep(1000);
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${B}`); await sleep(5000);

// in-page fetch of the live job's fsc — BEFORE any checkpoint lands
const LIVE = "cmttefupd0001p8wsq8mu0tdp";
const probe = async () => evalJs(`(async () => {
  const r = await fetch('/api/jobs/${LIVE}/fsc', { cache: 'no-store' });
  const j = await r.json();
  return { file: j.sourceFile, res: j.resolutionAt143 && Number(j.resolutionAt143.toFixed(3)) };
})()`);

console.log("fetch#1 (no it016):", await probe());

// land it016
const lines = ["data_model_class001", "", "loop_", "_rlnResolution #1", "_rlnAngstromResolution #2", "_rlnGoldStandardFsc #3"];
for (let i = 0; i < 48; i++) {
  const f = 0.01 + (0.49 - 0.01) * (i / 47);
  lines.push(`${f.toFixed(9)}  ${(1 / f).toFixed(6)}  ${Math.min(0.99, 0.95 * Math.exp(-8.34 * f)).toFixed(6)}`);
}
writeFileSync(IT016, lines.join("\n") + "\n");
console.log("it016 written");

console.log("fetch#2 (it016 on disk, in-page fetch):", await probe());
console.log("curl:   ", sh(`curl -s http://localhost:3000/api/jobs/${LIVE}/fsc | head -c 120`).slice(0, 120));

rmSync(IT016, { force: true });
sh(`${AB} close`);
