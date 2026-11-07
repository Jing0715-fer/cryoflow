#!/usr/bin/env node
/**
 * t373 — the CTF experiment: the SAME particles, run through class2d twice.
 *
 *   arm A (already done by t372): no CTF → classes converge with DARK
 *   centers (the raw cryo signal: protein scatters electrons away, fewer
 *   counts, negative after normalization — uncorrected amplitude+phase
 *   contrast keeps the particle dark)
 *
 *   arm B (this script): the same particles.star patched with defocus CTF
 *   columns (rlnDefocusU/V/AstigmatismAngle; the optics group already
 *   carries 300kV/2.7mm/0.1) → class2d WITH --ctf → the CTF-corrected
 *   class averages recover the structure's positive convention →
 *   WHITE particles, RELION's display convention
 *
 * This is the empirical answer to the user's question: “如果是负染照片本身
 * 颗粒是白的，而冷冻照片颗粒是黑的，可能需要反转一下才能让颗粒变成白色？”
 * — no manual inversion needed: with CTF estimation + --ctf, RELION's own
 * reconstruction flips cryo's dark raw signal into white class averages.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE, "Content-Type": "application/json" };
let pass = 0, fail = 0;
const must = (c, label) => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = async (path, opts) => {
  const r = await fetch(`${BASE}${path}`, { ...opts, headers: ORIGIN });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// find the t372 project + extract + (running) jobs
const jobs = (await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json()).jobs ?? [];
const proj = jobs.find((j) => j.type === "extract" && /β-gal extract/.test(j.name ?? ""));
must(!!proj, "the t372 extract job is found");
const projectId = proj.projectId;
const extractJob = jobs.find((j) => j.projectId === projectId && j.type === "extract");
const connJob = jobs.find((j) => j.projectId === projectId && j.type === "autopick");
const connId = connJob?.runRemote?.connectionId ?? (await (await fetch(`${BASE}/api/remote/connections`, { headers: ORIGIN })).json()).connections?.[0]?.id;
must(!!connId, `the connection id resolves (${connId})`);

// ---- patch the CLUSTER-side extract star with CTF columns ----
console.log("== patching the extract star with CTF columns ==");
const clusterStar = execSync(
  `find /home/z/cryoflow/services/mock-cluster/fs/projects/cryoflow -path "*${extractJob.id.slice(-8)}*" -name particles.star | head -1`,
  { encoding: "utf8" }
).trim();
// the job dir is extract_<last8> — find by the id suffix actually used
const clusterStar2 = clusterStar || execSync(
  `find /home/z/cryoflow/services/mock-cluster/fs/projects/cryoflow/${projectId} -maxdepth 2 -name particles.star | head -1`,
  { encoding: "utf8" }
).trim();
must(!!clusterStar2, `the cluster-side particles.star resolves (${clusterStar2})`);

const patched = (() => {
  const text = fs.readFileSync(clusterStar2, "utf8");
  if (text.includes("_rlnDefocusU")) return text; // already patched
  const lines = text.split("\n");
  const out = [];
  let inParticles = false;
  let colCount = 0;
  for (const line of lines) {
    if (line.startsWith("data_particles")) { inParticles = true; out.push(line); continue; }
    if (line.startsWith("data_")) { inParticles = false; }
    if (inParticles && line.trim().startsWith("_rlnOpticsGroup")) {
      // insert the CTF columns BEFORE the optics-group column (the row's
      // trailing value IS the optics group) and renumber it
      const n = (line.match(/#(\d+)/) ?? [])[1] ?? "8";
      out.push(`_rlnDefocusU #${n}`);
      out.push(`_rlnDefocusV #${Number(n) + 1}`);
      out.push(`_rlnDefocusAngle #${Number(n) + 2}`);
      out.push(`_rlnOpticsGroup #${Number(n) + 3}`);
      continue;
    }
    if (inParticles && line.trim().startsWith("_rln")) { colCount++; out.push(line); continue; }
    if (inParticles && /^\d/.test(line.trim())) {
      // append the defocus values BEFORE the row's trailing optics-group value
      const m = line.match(/^(.*?\S)\s+(\d+)\s*$/);
      if (m && !line.includes("\t15000")) out.push(`${m[1]}\t15000.0\t14800.0\t30.0\t${m[2]}`);
      else out.push(line);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
})();
fs.writeFileSync(clusterStar2, patched);
// also patch the LOCAL mirror twin so the dispatch doesn't re-upload a stale copy
const mirror = clusterStar2.replace("/home/z/cryoflow/services/mock-cluster/fs", "/home/z/cryoflow/data");
try {
  if (fs.existsSync(mirror)) fs.writeFileSync(mirror, patched);
} catch { /* the mirror twin may not exist for cluster-only stars */ }
must(patched.includes("_rlnDefocusU"), "the star now carries rlnDefocusU/V/AstigmatismAngle (1.5 µm)");

// ---- create + run the CTF class2d ----
console.log("== class2d WITH --ctf ==");
const c2 = (await api("/api/jobs", { method: "POST", body: JSON.stringify({
  projectId, type: "class2d", name: "class2d K5 CTF",
  params: { numClasses: 5, iterations: 3, doCtf: true, psiSampling: 6, particleDiameter: 160 },
}) })).body.job;
must(!!c2?.id, "the CTF class2d job is created");
await api("/api/edges", { method: "POST", body: JSON.stringify({ fromJobId: extractJob.id, toJobId: c2.id, fromPort: "particles", toPort: "particles" }) });
const disp = await api(`/api/jobs/${c2.id}/run`, { method: "POST", body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "slurm", partition: "long" } }) });
must(disp.status === 200, `the dispatch is accepted (${disp.status})`);

// ---- wait (25 min; real class2d on 2 shared cores) ----
let final = null;
for (let t = 0; t < 100; t++) {
  await sleep(15_000);
  const j = (await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json()).jobs.find((x) => x.id === c2.id);
  if (j?.status === "completed" || j?.status === "failed") { final = j; break; }
  if (t % 4 === 0) console.log(`   … ${j?.status ?? "?"} ${(j?.result ?? "").slice(0, 60)}`);
}
must(final?.status === "completed", `the CTF class2d COMPLETED (${final?.status ?? "timeout"})`);

// ---- compare polarity ----
console.log("== polarity comparison ==");
const stacks = execSync(
  `find /home/z/cryoflow/services/mock-cluster/fs/projects/cryoflow/${projectId} -path "*${c2.id.slice(-8)}*" -name "run_it002_classes.mrcs" | head -1`,
  { encoding: "utf8" }
).trim();
must(!!stacks, `the CTF class stack resolves (${stacks})`);
if (stacks) {
  const res = execSync(
    `python3 - <<'PYEOF'
import struct, os
f = "${stacks}"
sz = os.stat(f).st_size
with open(f,'rb') as fh: h = fh.read(1024)
nx,ny,nz = struct.unpack('<3i', h[0:12])
with open(f,'rb') as fh:
    fh.seek(1024); d = fh.read()
print(f"DIMS {nx}x{ny}x{nz} EXACT {sz == 1024+nx*ny*nz*4}")
for z in range(nz):
    cs=cn=rs=rn=0.0
    for y in range(0,ny,2):
        for x in range(0,nx,2):
            v = struct.unpack('<f', d[4*(z*nx*ny+y*nx+x):4*(z*nx*ny+y*nx+x)+4])[0]
            if 0.38*nx<=x<0.62*nx and 0.38*ny<=y<0.62*ny: cs+=v; cn+=1
            elif (x<0.2*nx or x>=0.8*nx) and (y<0.2*ny or y>=0.8*ny): rs+=v; rn+=1
    print(f"SLICE {z+1} CENTER {cs/cn:+.4f} CORNER {rs/rn:+.4f}")
PYEOF`,
    { encoding: "utf8" }
  );
  console.log(res);
  const slices = [...res.matchAll(/SLICE (\d+) CENTER ([+-][\d.]+) CORNER ([+-][\d.]+)/g)];
  const white = slices.filter((m) => parseFloat(m[2]) > parseFloat(m[3])).length;
  must(white >= Math.ceil(slices.length / 2), `the CTF-corrected classes flip to WHITE particles (${white}/${slices.length} bright)`);
  must(res.includes("EXACT True"), "the CTF class stack is byte-exact");
}

console.log(`\n== t373 RESULT: ${pass} ok, ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
