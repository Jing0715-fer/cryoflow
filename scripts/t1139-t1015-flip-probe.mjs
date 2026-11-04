#!/usr/bin/env node
/**
 * t1139 — the t1015 L1 variance probe: WHERE does the flip go?
 *
 * The t1137 fleet ride reddened t1015's L1 ("the twin reached running");
 * the t1139 quiet-world dedicated re-ride REPRODUCED it standalone (31/32).
 * So the variance is not fleet load. The unit's poll hunts ONLY
 * status==="running" (40×250ms) — a run whose flip lands late, or one
 * that completes/fails inside the window, reads as "never reached
 * running". This probe rides the SAME protocol (fixture → mint → the
 * SAME detached curl) but records the FULL status trace at 100ms with
 * timestamps, plus the run record's lifecycle, to name the shape.
 *
 * node-only; the world gate: as-found pinned, the twin swept, FATAL on
 * leftovers. Receipt: shots-qa/.t1139-t1015-flip-probe.json
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const statePath = path.join(ROOT, "data/engine-state.json");
const readRecord = (id) => {
  try { return JSON.parse(readFileSync(statePath, "utf8"))[id] ?? null; } catch { return null; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 404 HTML */ }
  return { status: res.status, json, text };
}
const jobsArr = (b) => (Array.isArray(b) ? b : b?.jobs ?? []);

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---------- the world as-found ---------- */
let world = null;
for (let i = 0; i < 10 && !world; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) world = jobsArr(r.json);
  } catch { /* warmup */ }
}
if (!world) { console.log("FATAL: the server never answered 200"); process.exit(2); }
const worldBefore = world.length;
console.log(`world: ${worldBefore} jobs as-found`);
const template = world.find((j) => j.name === "Import Movies 1");
if (!template) { console.log("FATAL: the template 'Import Movies 1' is absent"); process.exit(2); }

/* ---------- the fixture (the unit's own protocol) ---------- */
const FIX = path.join(ROOT, "data/t1015-fixture");
rmSync(FIX, { force: true, recursive: true });
mkdirSync(FIX, { recursive: true });
const buf = Buffer.alloc(1024);
for (let i = 0; i < 40000; i++) writeFileSync(path.join(FIX, `fake_movie_${String(i).padStart(6, "0")}.mrc`), buf);
ok("the fixture stands", existsSync(path.join(FIX, "fake_movie_039999.mrc")));

// let the (possible) watcher settle — same two-healthy-frames law
// t1139: the loop LOGS every non-200/throw — the instrument self-test law
// (a silent ✗ here is the instrument's own lie, not the world's)
let consecutive = 0;
const settleLog = [];
for (let i = 0; i < 40 && consecutive < 2; i++) {
  try { const r = await api("GET", "/api/jobs"); consecutive = r.status === 200 ? consecutive + 1 : 0; if (r.status !== 200) settleLog.push({ i, status: r.status }); }
  catch (e) { consecutive = 0; settleLog.push({ i, throw: String(e).slice(0, 120) }); }
  await sleep(1500);
}
if (settleLog.length) console.log("settleLog:", JSON.stringify(settleLog.slice(0, 8)));
ok("the post-lay storm settled", consecutive >= 2);

/* ---------- mint the twin ---------- */
const params = { ...(template.params ?? {}), micrographsPath: FIX };
const mint = await api("POST", "/api/jobs", {
  type: "import", name: "Import Flip Probe", workspaceId: template.workspaceId,
  x: 760, y: 320, params,
});
const twin = mint?.json?.job ?? null;
ok("twin minted", !!twin, twin?.id ?? `status=${mint.status}`);
if (!twin) { rmSync(FIX, { force: true, recursive: true }); process.exit(2); }

/* ---------- fire the SAME detached curl ---------- */
const t0 = Date.now();
const ch = spawn("curl", ["-s", "-X", "POST", "-H", `Origin: ${BASE}`, `${BASE}/api/jobs/${twin.id}/run`], { stdio: "ignore", detached: true });
ch.unref();
ok("the detached curl spawned", ch.pid != null, `pid=${ch.pid}`);

/* ---------- the FULL status trace at 100ms ---------- */
const trace = [];
let last = null;
const rec0 = readRecord(twin.id);
const trace0 = { t: 0, status: "mint", rec: rec0 ? { pid: rec0.pid ?? null, done: rec0.done ?? null } : null };
trace.push(trace0);
let curlExit = null;
ch.on("exit", (code) => { curlExit = { atMs: Date.now() - t0, code }; });

let runningAtMs = null, endAtMs = null, endStatus = null;
for (let i = 1; i <= 300; i++) {
  await sleep(100);
  let row = null;
  try { const r = await api("GET", "/api/jobs"); if (r.status === 200) row = jobsArr(r.json).find((j) => j.id === twin.id) ?? null; } catch { /* churn */ }
  const st = row?.status ?? "(gone)";
  if (st !== last) {
    last = st;
    trace.push({ t: Date.now() - t0, status: st });
    if (st === "running" && runningAtMs == null) runningAtMs = Date.now() - t0;
    if (st !== "running" && runningAtMs != null && endAtMs == null) { endAtMs = Date.now() - t0; endStatus = st; }
  }
  if (st === "completed" || st === "failed" || st === "(gone)") break;
}
console.log("trace:", JSON.stringify(trace));
console.log("curlExit:", JSON.stringify(curlExit));

const recEnd = readRecord(twin.id);
console.log("record@end:", JSON.stringify(recEnd ? { done: recEnd.done, exitCode: recEnd.exitCode, result: String(recEnd.result ?? "").slice(0, 140), outputsKeys: Object.keys(recEnd.outputs ?? {}) } : null));

/* ---------- the verdicts ---------- */
ok("the flip to running OBSERVED at 100ms granularity", runningAtMs != null, runningAtMs != null ? `running@${runningAtMs}ms` : `trace=${JSON.stringify(trace)}`);
ok("the flip lands inside the unit's 10s patience window", runningAtMs != null && runningAtMs <= 10000,
  runningAtMs != null ? `running@${runningAtMs}ms (window 10000ms)` : "never seen running");
ok("the run reached a terminal status", endStatus != null || (recEnd && recEnd.done === true), `end=${endStatus ?? "?"} done=${recEnd?.done}`);

/* ---------- the sweep — the arc's own residue ---------- */
console.log("sweep:");
const stop = await api("POST", `/api/jobs/${twin.id}/stop`).catch((e) => ({ status: 0 }));
await sleep(500);
const del = await api("DELETE", `/api/jobs/${twin.id}`);
ok("the twin swept (stop answered, delete answered)", del.status === 200, `stop=${stop.status} del=${del.status}`);
await sleep(1500);
rmSync(FIX, { force: true, recursive: true });
let after = null;
for (let i = 0; i < 20 && !after; i++) {
  try { const r = await api("GET", "/api/jobs"); if (r.status === 200) after = jobsArr(r.json); } catch { /* churn */ }
  await sleep(500);
}
const leftovers = after ? after.length - worldBefore : -1;
ok("the world restored (no ride residue)", after && leftovers === 0, `after=${after?.length} as-found=${worldBefore}`);

const receipt = { unit: "t1139-t1015-flip-probe", at: new Date().toISOString(), pass, fail, trace, curlExit, runningAtMs, endStatus, world: { before: worldBefore, after: after?.length ?? null } };
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(path.join(ROOT, "shots-qa/.t1139-t1015-flip-probe.json"), JSON.stringify(receipt, null, 1));
console.log(fail === 0 ? `\nGREEN ${pass}/${pass + fail}` : `\nRED ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
