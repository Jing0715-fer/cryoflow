#!/usr/bin/env node
/** t299 diag — which file goes missing from the sync-back? One remote
 * ctffind run through the app's REAL dispatch, then dump BOTH sides:
 * the cluster workdir listing (test-client) vs the local mirror listing,
 * plus the record's syncedFiles/skipped/bytes. */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const STATE = `${ROOT}/data/engine-state.json`;
const SH = {
  Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", Host: "localhost:3000",
  "Content-Type": "application/json",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = (cmd) => execFileSync("node", ["services/mock-cluster/test-client.mjs", cmd], { cwd: ROOT, encoding: "utf8", timeout: 30_000 });

const CONN = `qa-diag-${Date.now().toString(36)}`;
const created = [];
let snap0 = readFileSync(STATE, "utf8");

try {
  // mock up?
  client("echo mock-ok");
  // connection
  const mk = await fetch(`${BASE}/api/remote/connections`, { method: "POST", headers: SH, body: JSON.stringify({ id: CONN, name: "QA Diag", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }) });
  console.log("conn:", mk.status);
  // six mock micrographs — written STRAIGHT onto the host-side mock fs (the
  // mock fs IS this machine's tree; going through test-client would put
  // "/projects/" inside a command body and translateCommand would double it)
  execSync(`node -e '
const fs=require("fs"),Buffer=require("buffer").Buffer;
const W=64,H=64,N=W*H;
const dir="/home/z/my-project/data/relion/t-diag-mics";
fs.mkdirSync(dir,{recursive:true});
for(let i=1;i<=6;i++){
 const buf=Buffer.alloc(1024+N*4);
 buf.writeFloatLE(1.0,0);buf.writeInt32LE(0,4);buf.writeInt32LE(0,8);buf.writeInt32LE(64,12);buf.writeInt32LE(64,16);buf.writeInt32LE(1,20);buf.writeInt32LE(0,24);buf.writeInt32LE(20,28);buf.writeFloatLE(1.77,32);buf.writeFloatLE(0,36);
 for(let p=0;p<N;p++){const x=p%W,y=(p/W)|0;buf.writeFloatLE(Math.sin(x/7)*Math.cos(y/5)*100+50,1024+p*4);}
 fs.writeFileSync(dir+"/mic"+i+".mrc",buf);
}'`, { stdio: "pipe" });
  // import job (local engine) with the mock dir
  const imp = await fetch(`${BASE}/api/jobs`, { method: "POST", headers: SH, body: JSON.stringify({ type: "import", name: "diag Import", params: { micrographsPath: "/home/z/my-project/data/relion/t-diag-mics", pixelSize: 1.77 } }) });
  const impB = await imp.json();
  created.push(impB.job.id);
  await fetch(`${BASE}/api/jobs/${impB.job.id}/run`, { method: "POST", headers: SH, body: "{}" });
  for (let i = 0; i < 40; i++) { await sleep(1000); const j = (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs.find((x) => x.id === impB.job.id); if (j?.status === "completed") break; }
  console.log("import done");
  // ctffind wired + dispatched REMOTE direct
  const ctf = await fetch(`${BASE}/api/jobs`, { method: "POST", headers: SH, body: JSON.stringify({ type: "ctffind", name: "diag Ctffind" }) });
  const ctfB = await ctf.json();
  created.push(ctfB.job.id);
  await fetch(`${BASE}/api/edges`, { method: "POST", headers: { ...SH }, body: JSON.stringify({ fromJobId: impB.job.id, toJobId: ctfB.job.id, fromPort: "micrographs", toPort: "micrographs" }) });
  const disp = await fetch(`${BASE}/api/jobs/${ctfB.job.id}/run`, { method: "POST", headers: SH, body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "direct" } }) });
  console.log("dispatch:", disp.status);
  let rec = null;
  for (let i = 0; i < 80; i++) {
    await sleep(1500);
    rec = (JSON.parse(readFileSync(STATE, "utf8")).runs ?? JSON.parse(readFileSync(STATE, "utf8")))[ctfB.job.id] ?? rec;
    const j = (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs.find((x) => x.id === ctfB.job.id);
    if (i % 8 === 0 || rec?.done) console.log(`t+${i * 1.5}s row=${j?.status}/${j?.progress} recPhase=${rec?.remote?.phase ?? "-"} done=${rec?.done ?? "-"} result=${(j?.result ?? "").slice(0, 80)}`);
    if (rec?.done) break;
  }
  console.log("record done:", rec?.done, "exit:", rec?.exitCode);
  console.log("syncedFiles:", rec?.remote?.syncedFiles, "bytes:", rec?.remote?.syncedBytes, "skipped:", JSON.stringify(rec?.remote?.skippedFiles), "note:", rec?.remote?.note);
  // local mirror listing
  const mirror = rec?.workdir;
  console.log("MIRROR", mirror, existsSync(mirror) ? readdirSync(mirror).map((f) => `${f}:${statSync(`${mirror}/${f}`).size}`).join("  ") : "(missing)");
  // remote workdir listing
  const rw = rec?.remote?.remoteWorkdir;
  console.log("REMOTE", rw);
  console.log(client(`ls -la ${rw} 2>/dev/null | tail -8`));
} catch (e) {
  console.error("DIAG ERROR:", e.message?.slice(0, 300));
} finally {
  writeFileSync(STATE, snap0);
  for (const id of [...created].reverse()) { try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }); } catch {} }
  try { await fetch(`${BASE}/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }); } catch {}
  try { execSync("rm -rf /home/z/my-project/data/relion/t-diag-mics /home/z/my-project/services/mock-cluster/fs/projects/cryoflow/t-diag", { stdio: "pipe" }); } catch {}
  console.log("cleaned");
}
