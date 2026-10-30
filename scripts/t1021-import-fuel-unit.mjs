#!/usr/bin/env node
/**
 * t1021 — THE IMPORT FUEL GATE unit (node-only): the OOM lesson hardened
 * into the product's own voice.
 *
 * THE SCAR (t1020's field record): a 500k-micrograph fixture pressed the
 * dev server past the host's memory ceiling and the KERNEL killed the
 * process mid-run — the run died "interrupted (exit unknown)", the
 * watchdog respawned an app that had lost its own run, and the honest
 * words came from dmesg instead of from the product. The gate moves the
 * arithmetic INSIDE the run: at the loop's doorstep (after the source
 * listing, before the first copy), the arc estimates the fuel
 * (count × 6 KB — the witness rounded up) against the HOST's own
 * headroom (total RAM − the server's current RSS − a floor) and refuses
 * with the math on the record when the kernel would win.
 *
 * BANDS:
 *   F  the gate at source: the constants (6 KB/file, the 512 MB floor,
 *      the t1020 witness named), the gate's seat (after the twin gate,
 *      before setProgress(60) — all three source shapes covered), the
 *      arithmetic reading os.totalmem + process.memoryUsage().rss (the
 *      host's own numbers — never a fixed cap), and the refusal's words
 *      (the number, the scaling, the two GB figures, the split guidance,
 *      the kernel's kill named)
 *   L  LIVE refusal ride: the fixture laid JUST over the host's own
 *      budget, the twin minted, the run answered — the row fails with
      the fuel math, the record closes with the same words, the server
 *      SURVIVES (the kernel never speaks), no outputs claimed, and the
 *      world gate FATALs on leftovers
 *
 * PROTOCOL: node-only, the fixture laid before the ride and swept after
 * (the t1015 law), warm the touched chain first, exit honest, receipt to
 * shots-qa/.t1021-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, symlinkSync } from "node:fs";
import os from "os";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const TMP = path.join(ROOT, "shots-qa/.t1021-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* the 404 HTML */ }
  return { status: res.status, json, text };
}
const jobsArr = (b) => (Array.isArray(b) ? b : b?.jobs ?? []);
async function apiRetry(method, url, body, tries = 4) {
  // t1023 patience law — the census rides this unit AFTER 38 siblings have
  // hammered the server, and a busy dev server answers 5xx / drops
  // connections in compile bursts; those are INFRA shapes, not verdicts.
  // Retry them. A 4xx is an honest refusal — return it immediately.
  let last = null;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(2500);
    try {
      const r = await api(method, url, body);
      if (r.status > 0 && r.status < 500) return r;
      last = r;
    } catch (e) { last = { status: 0, json: null, text: String(e) }; }
  }
  return last;
}

/* ---------- the world gate (as-found) ---------- */
let world = null;
for (let i = 0; i < 10 && !world; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) world = jobsArr(r.json);
  } catch { /* the warmup */ }
}
if (!world) { console.error("FATAL: the server never answered 200"); process.exit(2); }
if (world.length !== 16) {
  console.error(`FATAL: world gate — jobs ${world.length} (want 16 — the t1075 replant census; the t1003 22-world's db died in the epoch rollback)`);
  process.exit(1);
}
const project = world[0]?.projectId ?? null;
console.log(`world: 16 jobs as-found (project ${project})`);

/* ---------- F band — the gate at source ---------- */
console.log("F band — the fuel gate at source:");
const eng = read("src/lib/relion/engine.ts");
ok("F1 the two constants stand (6 KB per file — the witness rounded up — and the 512 MB floor)",
  eng.includes("const NATIVE_IMPORT_FUEL_BYTES_PER_FILE = 6 * 1024;") &&
  eng.includes("const NATIVE_IMPORT_FUEL_FLOOR_BYTES = 512 * 1024 * 1024;"));
ok("F2 the witness is named where the numbers live (the t1020 OOM, ≈4.8 KB/file, the kernel's receipt)",
  /t1021 — the fuel gate's two numbers/.test(eng) &&
  eng.includes("died to the OOM") && eng.includes("4.8 KB/file"));
ok("F3 the gate sits at the loop's doorstep — after the twin gate, before setProgress(60)",
  /const twinGate = importTwinGate\(hostFiles\);\s*\n\s*if \(twinGate\) return \{ ok: false, error: twinGate\.error \};\s*\n\s*\/\/ t1021 — THE FUEL GATE[\s\S]*?void setProgress\(60\)/.test(eng));
ok("F4 the arithmetic reads the HOST's own numbers (totalmem − the server's RSS − the floor), never a fixed cap",
  eng.includes("os.totalmem() - process.memoryUsage().rss - NATIVE_IMPORT_FUEL_FLOOR_BYTES") &&
  !/NATIVE_IMPORT_FUEL_[A-Z_]*\s*=.*\b250\s*000\b/.test(eng));
ok("F5 the refusal's words carry the math and the way out (the count, the scaling, the GB figures, the split guidance, the kernel named)",
  eng.includes("This import holds ${hostFiles.length.toLocaleString(\"en-US\")} ${kindWord}") &&
  eng.includes("scales ≈6 KB per file") &&
  eng.includes("Split the folder into smaller batches") &&
  eng.includes("the kernel's kill does not"));
ok("F6 the gate covers all three source shapes (one seat on the shared path — folder, pattern, file-list)",
  (eng.match(/THE FUEL GATE/g) || []).length === 1 &&
  eng.indexOf("THE FUEL GATE") < eng.indexOf("folder import — link the WHOLE directory") &&
  eng.indexOf("THE FUEL GATE") < eng.indexOf("const r = await importFileSet("));

/* ---------- the fixture: laid decisively over the host's own budget ---------- */
console.log("fixture — the fuel decisively over this host's budget:");
// the gate reads the server's own RSS at gate time (baseline + the listing)
// — this host's dev server rides ≈2 GB, so the headroom is ≈1.5 GB and the
// refusing count ≈250k. 400k fires the gate WITH margin on this box, and
// the refusal lands BEFORE any copying — the kernel never gets a turn.
const files = 400000;
const FIX = path.join(ROOT, "data/t1021-fixture");
rmSync(FIX, { force: true, recursive: true });
mkdirSync(FIX, { recursive: true });
const buf = Buffer.alloc(1024);
const t0 = Date.now();
for (let i = 0; i < files; i++) {
  writeFileSync(path.join(FIX, `fake_movie_${String(i).padStart(6, "0")}.mrc`), buf);
}
ok("the fixture stands (the fuel just over the budget — the ride's window)", existsSync(path.join(FIX, `fake_movie_${String(files - 1).padStart(6, "0")}.mrc`)), `${files} files in ${Date.now() - t0}ms`);
console.log(`  ${files} files laid (${((files * 6 * 1024) / 1024 ** 3).toFixed(1)} GB of estimated fuel — the gate's verdict decides)`);

/* ---------- L band — the live refusal ride ---------- */
console.log("L band — the refusal live (the gate speaks, the kernel never does):");
const template = world.find((j) => j.name === "Import Movies 1");
ok("the template stands (Import Movies 1)", !!template);
// the t1075 replant world: the project is BOUND (the t979 ritual's step 2 —
// the t535 feed law), and a bound project's imports ride the remote leg
// first (runImportRemoteLeg's connId gate — "imported from Cluster").
// The fuel gate guards the NATIVE lane, so the ride unbinds through the
// t300 door (null unbinds), rides, and rebinds bit-for-bit after the row.
const bind0 = (await api("GET", "/api/project"))?.json?.project?.remote?.connectionId ?? null;
if (bind0) await api("PATCH", `/api/projects/${project}`, { remoteConnectionId: null });
let twin = null;
if (template) {
  const params = { ...(template.params ?? {}), micrographsPath: FIX };
  const mint = await apiRetry("POST", "/api/jobs", {
    type: "import", name: "Import Fuel Gate Ride", workspaceId: template.workspaceId,
    x: 1080, y: 560, params,
  }, 8);
  twin = mint?.json?.job ?? null;
  ok("the twin minted (the gate's victim — the arc's own)", !!twin, twin?.id ?? `mint failed: ${mint?.status}`);
}
if (twin) {
  // the run AWAITED — the gate fires fast (listing → refuse, no copying)
  const run = await apiRetry("POST", `/api/jobs/${twin.id}/run`, undefined, 6);
  ok("the run answered", run.status === 200 || run.status === 500, `status=${run.status}`);
  // the row: failed, the fuel math as the result
  let row = null;
  for (let i = 0; i < 40 && !row; i++) {
    if (i > 0) await sleep(500);
    try {
      const r = await api("GET", "/api/jobs");
      const hit = jobsArr(r.json).find((j) => j.id === twin.id);
      if (hit && hit.status === "failed") row = hit;
    } catch { /* the beat */ }
  }
  ok("the row landed failed", !!row, row?.status);
  ok("the row's words carry the fuel math (the count, the scaling, the GB figures)",
    !!row && /This import holds .+ movies — the in-process/.test(row?.result ?? "") &&
    /scales ≈6 KB per file/.test(row?.result ?? "") &&
    /GB of headroom/.test(row?.result ?? ""),
    row?.result?.slice(0, 120));
  ok("the row's words name the way out (split the folder into smaller batches)",
    !!row && /Split the folder into smaller batches/.test(row?.result ?? ""));
  // the server SURVIVES — the gate's whole point
  const alive = await api("GET", "/api/jobs");
  ok("THE SERVER SURVIVES the refusal (the kernel never speaks)", alive.status === 200 && Array.isArray(jobsArr(alive.json)));
  // no outputs claimed — the record closed before any copy
  const rec = (() => {
    try { return JSON.parse(read("data/engine-state.json"))[twin.id] ?? null; } catch { return null; }
  })();
  ok("the record closed with the same words (no outputs claimed)",
    !!rec && rec.done === true && /This import holds/.test(rec.result ?? "") &&
    !rec.outputs?.micrographs_star,
    rec ? `done=${rec.done} result=${(rec.result ?? "").slice(0, 60)}` : "no record");
}

/* ---------- the sweep ---------- */
console.log("sweep — the ride's own residue:");
if (twin) {
  try { await api("DELETE", `/api/jobs/${twin.id}`); } catch { /* the failure is not sticky */ }
  await sleep(1000);
}
rmSync(FIX, { force: true, recursive: true });
ok("the fixture swept", !existsSync(FIX));
// the t1075 replant re-key: the EMPIAR demo dir is gone with the old epoch —
// the replant world's mics stay on the cluster (the t979 feed, zero upload),
// so the ride's link residue is SWEPT, not restored, and the binding comes
// back bit-for-bit through the t300 door instead.
if (bind0) await api("PATCH", `/api/projects/${project}`, { remoteConnectionId: bind0 });
const rebound = (await api("GET", "/api/project"))?.json?.project?.remote?.connectionId ?? null;
ok("the binding restored bit-for-bit after the native-lane ride (the t1075 re-key — the t300 door)",
  rebound === bind0, `${rebound ?? "unbound"} vs ${bind0 ?? "unbound"}`);
const MIC_LINK = path.join(ROOT, "data/relion", twin?.projectId ?? project, "micrographs");
rmSync(MIC_LINK, { force: true });
if (twin?.projectId && twin?.id) {
  rmSync(path.join(ROOT, "data/relion", twin.projectId, `import_${twin.id.slice(-8)}`), { force: true, recursive: true });
}

/* ---------- the world gate (as-left) ---------- */
console.log("world gate:");
let worldAfter = null;
for (let i = 0; i < 10 && !worldAfter; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) worldAfter = jobsArr(r.json);
  } catch { /* the beat */ }
}
ok("the world as-left (16 jobs, nothing minted standing — the t1075 replant re-key)", worldAfter?.length === 16, `got ${worldAfter?.length}`);
const dbBytes = statSync(path.join(ROOT, "db/cryoflow.db")).size;
ok("the DB byte size held (the high-water — the t1075 replant re-key)", dbBytes === 135168, `${dbBytes}`);

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1021-import-fuel-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["F the gate at source", "L the live refusal ride"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);
