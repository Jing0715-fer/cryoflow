// t539 probe — the class2d "N classes" counting-semantics exam.
//
// t538 left a pool item: the result line said "1 classes" while the card's
// stat (classes.mrcs nz) says 4. This probe steals the REAL artifacts
// mid-run (t538 method) and answers, from bytes:
//   A. run_classes.mrcs MRC header nz (what the stack physically holds)
//   B. run_it003_data.star _rlnClassNumber distribution (what the particles
//      actually populated)
//   C. the ledger's result line for the class2d job (what the app said)
// Then the fix's counting semantics can be judged on evidence, not paper.
//
// Run: node scripts/t539-class2d-count-probe.mjs   (server on :3000, mock on :3022)

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const MOCK_PROJECTS = `${ROOT}/services/mock-cluster/fs/projects/cryoflow`;
const PROBE_DIR = `${ROOT}/data/relion/t539-probe`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mrcHeaderNz(path) {
  const fd = readFileSync(path);
  // MRC2014: nx,ny,nz at bytes 0,4,8 (little-endian int32); mode at 12
  const nx = fd.readInt32LE(0), ny = fd.readInt32LE(4), nz = fd.readInt32LE(8);
  const mode = fd.readInt32LE(12);
  const mx = fd.readInt32LE(28), my = fd.readInt32LE(32), mz = fd.readInt32LE(44);
  return { nx, ny, nz, mode, mx, my, mz, bytes: fd.length };
}

function classDistribution(dataStarPath) {
  const lines = readFileSync(dataStarPath, "utf8").split("\n");
  let classCol = -1, headerEnd = -1, inLoop = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "loop_") { inLoop = true; continue; }
    if (t.startsWith("data_")) { inLoop = false; continue; }
    if (!inLoop || !t.startsWith("_")) continue;
    if (t.startsWith("_rlnClassNumber")) { classCol = i; }
    if (classCol >= 0 && headerEnd < 0) headerEnd = i; // last header row after classCol wins below
  }
  // simpler: re-scan — find the loop that owns _rlnClassNumber
  classCol = -1; headerEnd = -1; inLoop = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "loop_") { inLoop = true; continue; }
    if (t.startsWith("data_")) { inLoop = false; continue; }
    if (!inLoop || !t.startsWith("_")) continue;
    if (t.startsWith("_rlnClassNumber")) {
      classCol = t.split(/\s+/).length === 1 ? t.split(/\s+/).indexOf("_rlnClassNumber") : 0;
      // column index = position among header rows in THIS loop
      let col = 0;
      for (let j = i - 1; j >= 0; j--) {
        const tt = lines[j].trim();
        if (tt === "loop_" || tt.startsWith("data_")) break;
        if (tt.startsWith("_")) col++;
      }
      classCol = col; headerEnd = i;
      break;
    }
  }
  if (classCol < 0) return null;
  const counts = new Map(); let total = 0;
  for (let r = headerEnd + 1; r < lines.length; r++) {
    const t = lines[r].trim();
    if (t === "loop_" || t.startsWith("data_")) break;
    if (!t || t.startsWith("#") || t.startsWith("_")) continue;
    const cells = t.split(/\s+/);
    if (cells.length <= classCol) continue;
    const cls = parseInt(cells[classCol], 10);
    if (Number.isFinite(cls) && cls > 0) { counts.set(cls, (counts.get(cls) ?? 0) + 1); total++; }
  }
  return { counts, total };
}

async function main() {
  rmSync(PROBE_DIR, { recursive: true, force: true });
  mkdirSync(PROBE_DIR, { recursive: true });

  // 1. launch t308 solo in the background (it builds its own world)
  console.log("== launching t308 solo in background ==");
  const child = spawn("node", ["scripts/t308-array-downstream.mjs"], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });

  // 2. steal class2d artifacts the moment they appear on the mock fs
  let stolen = null;
  for (let i = 0; i < 240 && !stolen; i++) {
    await sleep(1000);
    if (child.exitCode !== null) break;
    let dirs = [];
    try { dirs = readdirSync(MOCK_PROJECTS).flatMap((p) => {
      const base = join(MOCK_PROJECTS, p);
      try { return readdirSync(base).filter((d) => d.startsWith("class2d_")).map((d) => join(base, d)); }
      catch { return []; }
    }); } catch { continue; }
    for (const wd of dirs) {
      // t539 — the REAL refine writes run_UNMASKED_classes.mrcs first (the
      // engine's own firstExisting order); run_classes.mrcs may never exist.
      const stack = ["run_unmasked_classes.mrcs", "run_classes.mrcs"].map((f) => join(wd, f)).find(existsSync);
      const dataStar = readdirSync(wd).filter((f) => /^run_it\d+_data\.star$/.test(f)).sort().pop();
      if (stack && dataStar) {
        stolen = { wd, stack, dataStar: join(wd, dataStar), dataStarName: dataStar };
        break;
      }
    }
  }

  if (!stolen) {
    console.log("PROBE MISS: no class2d artifacts appeared (t308 output below)");
    console.log(out.split("\n").slice(-40).join("\n"));
    process.exit(2);
  }

  console.log(`== stole artifacts from ${stolen.wd.replace(ROOT, "")} ==`);
  copyFileSync(stolen.stack, join(PROBE_DIR, "run_classes.mrcs"));
  copyFileSync(stolen.dataStar, join(PROBE_DIR, stolen.dataStarName));

  // A. the stack's physical truth
  const hdr = mrcHeaderNz(stolen.stack);
  console.log(`A. run_classes.mrcs: nx=${hdr.nx} ny=${hdr.ny} nz=${hdr.nz} mode=${hdr.mode} bytes=${hdr.bytes}`);
  // all class averages: also count any run_itNNN_classKKK.mrc siblings
  try {
    const sibs = readdirSync(stolen.wd).filter((f) => /^run_it\d+_class\d+\.mrc$/.test(f)).sort();
    console.log(`   class-map siblings: ${sibs.length ? sibs.join(", ") : "(none — refine writes the combined stack only)"}`);
  } catch { /* gone */ }

  // B. the particles' truth
  const dist = classDistribution(stolen.dataStar);
  if (dist) {
    const ranked = [...dist.counts.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`B. ${stolen.dataStarName}: total=${dist.total} distinctClassNumbers=${dist.counts.size}`);
    for (const [cls, n] of ranked) console.log(`   class ${cls}: ${n} particles (${Math.round((100 * n) / dist.total)}%)`);
  } else {
    console.log("B. no _rlnClassNumber distribution parseable");
  }

  // 3. wait for the app to finalize the class2d job, then read its result line
  console.log("== waiting for the app's class2d result line ==");
  let resultLine = null;
  for (let i = 0; i < 120 && !resultLine; i++) {
    await sleep(2000);
    try {
      const res = await fetch("http://localhost:3000/api/jobs");
      const jobs = await res.json();
      const c = (Array.isArray(jobs) ? jobs : jobs.jobs ?? []).find(
        (j) => j.type === "class2d" && j.status === "completed" && typeof j.result === "string" && j.result.includes("2D classification")
      );
      if (c) resultLine = c.result;
    } catch { /* server busy */ }
  }
  console.log(`C. ledger result line: ${resultLine ?? "(never seen)"}`);

  try { child.kill("SIGTERM"); } catch { /* done */ }
  await sleep(1500);
  try { execSync("pkill -f t308-array-downstream", { stdio: "pipe" }); } catch { /* done */ }
  console.log(`\nprobe artifacts kept at ${PROBE_DIR.replace(ROOT, "")}/`);
}

main().catch((e) => { console.error("probe crashed:", e); process.exit(1); });
