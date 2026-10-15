#!/usr/bin/env node
/**
 * t1015 — THE NATIVE STOP ARM unit (node-only): the self-kill landmine's
 * cure, pinned at source and ridden live.
 *
 * THE LANDMINE: a native in-flight run (folder/pattern/file import, cs→star,
 * map import) lives INSIDE the server — beginNativeRun stamps pid:
 * process.pid so the sweep's liveness check passes. The old stopRun fell
 * through to `tree = [pid, ...descendantsOf(pid)]` with pid = THE SERVER'S
 * OWN PID: a stop click (and the delete door's stop-first branch) on a
 * running native import SIGTERM'd (then SIGKILL'd) the whole app. The
 * t1014 rides missed it by timing luck — the delete raced the completion
 * write, after recordNativeRun had closed the record → "already-ended", no
 * tree. The "missed" prose in the t1014 record was inherited rot.
 *
 * THE ARM: stopRun grows a native branch BEFORE the tree build — pid ===
 * process.pid → requestNativeAbort (a flag), never a tree. The import loops
 * consult the flag at every breathing gate (the t1014 yield sites are the
 * abort sites — a sync stretch blocks the event loop, so the arming request
 * can only run at a yield). The run unwinds honestly: NativeAbortError →
 * abortNativeRun (the record closes "stopped by user", previous outputs
 * restored) → startJob's failure write. The P2025 belt: a row deleted
 * mid-run stands down instead of 500-ing the run route.
 *
 * BANDS:
 *   N  the arm at source (the branch before the tree, the gates at the
 *      yields, the clears, the catches, the route's honest words, the belt)
 *   L1 LIVE stop-mid-import: the twin runs, the stop lands mid-loop, the
 *      server SURVIVES, the receipt speaks (killed + nativeAbort), the row
 *      lands failed "stopped by user", the record closes with no outputs,
 *      no completion flip afterward.
 *   L2 LIVE delete-mid-run: the delete's stop-first arms the abort, the
 *      run route answers 200 (the belt — no P2025 500), the row is gone,
 *      the tombstone's record is terminal.
 *   W  the world gate: the as-found count pinned before, restored after,
 *      FATAL on leftovers (the mint gate — the arc's victims are the arc's
 *      own twins).
 *
 * PROTOCOL: node-only, one fixture (40k tiny mrcs — the breathing fuel,
 * laid BEFORE the ride and swept after), warm the touched chains first
 * (the t1014 law), exit honest, receipt to shots-qa/.t1015-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1015-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** the patient probe (the t1014 law, API face): the fixture's 40k-file
 * watcher storm churns the dev server — never read one healthy frame as
 * settled; two consecutive answers with a gap mean the storm passed. */
async function settleAfterStorm() {
  let consecutive = 0;
  for (let i = 0; i < 60 && consecutive < 2; i++) {
    try {
      const r = await fetch(BASE + "/api/jobs", { headers: { Origin: BASE } });
      await r.text();
      consecutive = r.status === 200 ? consecutive + 1 : 0;
    } catch { consecutive = 0; }
    await sleep(1500);
  }
  return consecutive >= 2;
}

/** the mint rides out a storm wave: a dropped socket mid-POST is the
 * watcher's churn, not the door's refusal — retry with patience. */
async function apiRetry(method, url, body, tries = 4) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(2500);
    try {
      const r = await api(method, url, body);
      if (r.status > 0) return r;
      last = r;
    } catch (e) { last = { status: 0, json: null, text: String(e) }; }
  }
  return last;
}

/* ---------- the server + the world gate ---------- */
const BASE = "http://localhost:3000";
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

let world = null;
for (let i = 0; i < 10 && !world; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) world = jobsArr(r.json);
  } catch { /* the warmup */ }
}
if (!world) { console.log("FATAL: the server never answered 200"); process.exit(2); }
const worldBefore = world.length;
console.log(`world: ${worldBefore} jobs as-found`);

/* ---------- N band — the arm at source ---------- */
console.log("N band — the native arm at source:");
const eng = read("src/lib/relion/engine.ts");

// N1 — the native branch sits BEFORE the tree build and keys on our own pid
const stopRunIdx = eng.indexOf("export async function stopRun(");
const nativeArmIdx = eng.indexOf("state.pid === process.pid", stopRunIdx);
const treeIdx = eng.indexOf("descendantsOf(pid)", stopRunIdx);
ok("N1 the native branch keys on the server's own pid, BEFORE the tree build",
  stopRunIdx >= 0 && nativeArmIdx > stopRunIdx && treeIdx > nativeArmIdx,
  `arm@${nativeArmIdx - stopRunIdx} tree@${treeIdx - stopRunIdx}`);

// N2 — the arm requests the abort and answers killed + nativeAbort
const armBlock = eng.slice(nativeArmIdx - 400, nativeArmIdx + 700);
ok("N2 the arm requests the abort (never a kill tree from our own pid)",
  armBlock.includes("requestNativeAbort(jobId)") && armBlock.includes("nativeAbort: true as const"));

// N3 — the registry's guards: only a native in-flight record arms
ok("N3 requestNativeAbort guards done/remote",
  eng.includes("if (!rec || rec.done || rec.remote) return false;"));

// N4 — the gates ride the yield sites (4 loop gates + the star-write boundary)
const gateSites = (eng.match(/nativeAbortGate\(job\.id\)|nativeAbortGate\(jobId\)/g) ?? []).length;
ok("N4 the abort gates stand at the breathing yields (4 loop gates + 1 boundary)",
  gateSites === 5, `gate sites=${gateSites}`);
ok("N5 each loop gate follows its breatheImport (yield first — the arming window)",
  (eng.match(/await breatheImport\(\);\n\s*nativeAbortGate\(/g) ?? []).length === 4);

// N6 — importFileSet threads the job id (the gate needs its target)
ok("N6 importFileSet carries jobId into both its loops",
  eng.includes("bridge: WslBridge | null,\n  jobId: string\n") &&
  eng.includes("await importFileSet(hostFiles, projectDir, workdir, bridge, job.id);"));

// N7 — the flag's lifecycle: a fresh run never inherits, a settled run disarms
ok("N7 the clears: beginNativeRun (fresh) / abortNativeRun (consumed) / recordNativeRun (the run won)",
  eng.includes("clearNativeAbort(job.id); // t1015 — a fresh run never inherits a stale stop flag") &&
  eng.includes("clearNativeAbort(jobId); // t1015 — the flag is consumed with the record it unwound") &&
  eng.includes("clearNativeAbort(job.id); // t1015 — a stop that raced the completion loses (the run won)"));

// N8 — runRealJob's native catch honors the unwinding (honest stop, not a crash)
const abortCatchCount = (eng.match(/if \(e instanceof NativeAbortError\) \{/g) ?? []).length;
ok("N8 the three native arcs (import / cs2star / mapimport) catch the unwinding",
  abortCatchCount === 3, `catches=${abortCatchCount}`);
ok("N9 the unwinding closes the record with the stop's own words",
  eng.includes('abortNativeRun(job.id, "stopped by user (the stop door\'s abort gate unwound the run)", begun.prevOutputs);'));

// N10 — the stop route's words: the native flip never borrows the checkpoint clause
const stopRoute = read("src/app/api/jobs/[id]/stop/route.ts");
ok("N10 the route's native flip speaks import-honest words (no checkpoint lie)",
  stopRoute.includes("outcome.nativeAbort") &&
  stopRoute.includes('"stopped by user (the in-process run unwound at its abort gate)"') &&
  stopRoute.indexOf("outcome.nativeAbort") < stopRoute.indexOf("re-run resumes from checkpoint"));
ok("N11 the receipt passes nativeAbort through to the client",
  stopRoute.includes("...(outcome.nativeAbort ? { nativeAbort: true } : {}),"));

// N12 — the P2025 belt in dispatch (the flip + three settle writes stand down)
const disp = read("src/lib/relion/dispatch.ts");
const beltCount = (disp.match(/isP2025\(/g) ?? []).length;
ok("N12 the P2025 belt covers the flip and the three settle writes",
  beltCount === 4 && disp.includes('const isP2025 = (e: unknown): boolean =>'), `sites=${beltCount}`);
ok("N13 a row deleted before the flip stands down with words, not a 500",
  disp.includes("the job was deleted before the run could start"));

/* ---------- the warm (the t1014 law — the first POST through a touched
   chain triggers a dev compile mid-arc) ---------- */
console.log("warm — the touched chains:");
const warm1 = await api("POST", "/api/jobs", {});
ok("the jobs POST chain is warm (the empty body's 400 refusal)", warm1.status === 400);
const warm2 = await api("POST", "/api/jobs/warm-stop-arm/run");
ok("the run POST chain is warm", warm2.status === 404 || warm2.status === 409 || warm2.status === 400);
const warm3 = await api("POST", "/api/jobs/warm-stop-arm/stop");
ok("the stop POST chain is warm", warm3.status === 404);
const warm4 = await api("DELETE", "/api/jobs/warm-stop-arm");
ok("the delete chain is warm", warm4.status === 404);

/* ---------- the fixture BEFORE the ride ---------- */
console.log("fixture — the breathing fuel:");
const FIX = path.join(ROOT, "data/t1015-fixture");
rmSync(FIX, { force: true, recursive: true });
mkdirSync(FIX, { recursive: true });
const buf = Buffer.alloc(1024);
for (let i = 0; i < 40000; i++) {
  writeFileSync(path.join(FIX, `fake_movie_${String(i).padStart(6, "0")}.mrc`), buf);
}
ok("the fixture stands (40k tiny mrcs — the stop's window)", existsSync(path.join(FIX, "fake_movie_039999.mrc")));
ok("the watcher storm settled (two consecutive healthy frames)", await settleAfterStorm());

/* ---------- the mint (the kit's api POST — explicit AND VISIBLE x/y) ---------- */
const template = world.find((j) => j.name === "Import Movies 1");
ok("the fixture's template stands (Import Movies 1)", !!template, template ? template.status : "none");
const statePath = path.join(ROOT, "data/engine-state.json");
const readRecord = (id) => {
  try { return JSON.parse(readFileSync(statePath, "utf8"))[id] ?? null; } catch { return null; }
};
const pollJobs = async (pred, tries, gap) => {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await api("GET", "/api/jobs");
      if (r.status === 200) {
        const hit = jobsArr(r.json).find(pred);
        if (hit) return hit;
      }
    } catch { /* the ride's own reload */ }
    await sleep(gap);
  }
  return null;
};

let twinA = null, twinB = null;
if (template) {
  const paramsA = { ...(template.params ?? {}), micrographsPath: FIX };
  const mintA = await apiRetry("POST", "/api/jobs", {
    type: "import", name: "Import Stop Arm Ride A", workspaceId: template.workspaceId,
    x: 760, y: 320, params: paramsA,
  });
  twinA = mintA?.json?.job ?? null;
  ok("twin A minted (the stop arm's victim — the arc's own)", !!twinA, twinA?.id ?? `mint failed: ${mintA?.status}`);
  const mintB = await apiRetry("POST", "/api/jobs", {
    type: "import", name: "Import Stop Arm Ride B", workspaceId: template.workspaceId,
    x: 900, y: 320, params: paramsA,
  });
  twinB = mintB?.json?.job ?? null;
  ok("twin B minted (the delete belt's victim — the arc's own)", !!twinB, twinB?.id ?? `mint failed: ${mintB?.status}`);
}

/* ---------- L1 — stop mid-import ---------- */
console.log("L1 — the stop arm live (stop mid-import, the server survives):");
if (twinA) {
  // the detached trigger — the unit continues while the run flies
  const ch = spawn("curl", ["-s", "-X", "POST", "-H", `Origin: ${BASE}`, `${BASE}/api/jobs/${twinA.id}/run`], { stdio: "ignore", detached: true });
  ch.unref();
  const running = await pollJobs((j) => j.id === twinA.id && j.status === "running", 40, 250);
  ok("the twin reached running (the flip landed)", !!running);
  if (running) {
    const stop = await api("POST", `/api/jobs/${twinA.id}/stop`);
    ok("THE STOP ANSWERED with the arm's receipt (killed + nativeAbort)",
      stop.status === 200 && stop.json?.stopped === true && stop.json?.outcome === "killed" && stop.json?.nativeAbort === true,
      stop.json ? `outcome=${stop.json.outcome} nativeAbort=${stop.json.nativeAbort}` : `status=${stop.status}`);
    ok("the receipt's words name the abort window", /abort signal delivered/.test(stop.json?.message ?? ""));
    // the server SURVIVES — the landmine's whole point
    const alive = await api("GET", "/api/jobs");
    ok("THE SERVER SURVIVES its own stop click (no self-kill)", alive.status === 200 && Array.isArray(jobsArr(alive.json)));
    // the row: failed, the stop's own words
    const row = await pollJobs((j) => j.id === twinA.id && j.status === "failed", 30, 300);
    ok("the row landed failed", !!row);
    ok("the row's words carry the user-stop", /stopped by user/.test(row?.result ?? ""), row?.result?.slice(0, 90));
    // the record: closed honestly, no outputs claimed
    let rec = null;
    for (let i = 0; i < 30 && !(rec && rec.done); i++) { await sleep(200); rec = readRecord(twinA.id); }
    ok("the run record closed (done)", !!rec && rec.done === true);
    ok("the record's exit is the user-stop stamp", rec?.exitCode === 1, `exit=${rec?.exitCode}`);
    ok("the record's words name the stop", /stopped by user/.test(rec?.result ?? ""));
    ok("the aborted import claimed NO outputs (prev outputs restored)",
      !rec?.outputs?.micrographs_star);
    // no completion flip afterward — the unwound arc never completes
    await sleep(2500);
    const after = await pollJobs((j) => j.id === twinA.id, 5, 300);
    ok("no completion flip afterward (the stop is terminal)",
      after?.status === "failed" && !/imported/.test(after?.result ?? ""), `status=${after?.status}`);
  }
} else {
  fail++; console.log("  ✗ L1 skipped — no twin A");
}

/* ---------- L2 — delete mid-run (the P2025 belt) ---------- */
console.log("L2 — the delete door live (the belt: no 500, the row is gone):");
if (twinB) {
  // the run POST as an AWAITED promise — its response is the belt's verdict
  const runPromise = api("POST", `/api/jobs/${twinB.id}/run`).catch((e) => ({ status: 0, json: null, text: String(e) }));
  const running = await pollJobs((j) => j.id === twinB.id && j.status === "running", 40, 250);
  ok("twin B reached running", !!running);
  if (running) {
    const del = await apiRetry("DELETE", `/api/jobs/${twinB.id}`);
    ok("the delete answered ok (the stop-first rode the arm)", del.status === 200 && del.json?.ok === true);
    const runRes = await Promise.race([runPromise, sleep(20000).then(() => null)]);
    ok("THE RUN ROUTE DID NOT 500 (the P2025 belt stood down honestly)",
      !!runRes && runRes.status === 200 && runRes.status < 500,
      runRes ? `status=${runRes.status}` : "the run POST never returned in 20s");
    ok("the run route's words name the stand-down", runRes?.json?.error === "stopped by user" || /stopped by user/.test(runRes?.json?.error ?? ""), runRes?.json?.error);
    const gone = await api("GET", "/api/jobs");
    ok("the row is gone from the roster", !jobsArr(gone.json).some((j) => j.id === twinB.id));
    // the tombstone's record is terminal (a stopped run must not come back live)
    try {
      const tomb = JSON.parse(readFileSync(path.join(ROOT, "data/deleted-jobs", `${twinB.id}.json`), "utf8"));
      ok("the tombstone coerced the in-flight record terminal", tomb?.record?.done === true);
    } catch (e) {
      ok("the tombstone coerced the in-flight record terminal", false, String(e).slice(0, 60));
    }
    const alive2 = await api("GET", "/api/jobs");
    ok("the server still survives the delete-mid-run arc", alive2.status === 200);
  }
} else {
  fail++; console.log("  ✗ L2 skipped — no twin B");
}

/* ---------- the sweep (the mint gate's residue) ---------- */
console.log("sweep — the arc's own residue:");
if (twinA) {
  try { await api("DELETE", `/api/jobs/${twinA.id}`); } catch { /* the stop already failed it; the delete still must land */ }
}
rmSync(FIX, { force: true, recursive: true });
for (const t of [twinA, twinB]) {
  if (t?.projectId && t?.id) {
    rmSync(path.join(ROOT, "data/relion", t.projectId, `import_${t.id.slice(-8)}`), { force: true, recursive: true });
  }
}
ok("the fixture swept", !existsSync(FIX));

/* ---------- the world gate ---------- */
console.log("world gate:");
let worldAfter = null;
for (let i = 0; i < 10 && !worldAfter; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) worldAfter = jobsArr(r.json);
  } catch { /* the ride */ }
}
const leftovers = (worldAfter ?? []).filter((j) => /Stop Arm Ride/.test(j.name));
ok("the world restored (no ride residue)", (worldAfter?.length ?? -1) === worldBefore && leftovers.length === 0,
  `${worldAfter?.length ?? "?"} jobs, leftovers=${leftovers.length}`);
if (leftovers.length > 0) {
  for (const l of leftovers) { try { await api("DELETE", `/api/jobs/${l.id}`); } catch {} }
  console.log("FATAL: ride residue had to be swept by hand — the world gate was violated");
  process.exit(3);
}

/* ---------- the receipt ---------- */
mkdirSync(path.dirname(TMP), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1015-native-stop-unit",
  at: new Date().toISOString(),
  pass, fail,
  world: { before: worldBefore, after: worldAfter?.length ?? null },
}, null, 2));
console.log(`\n${fail === 0 ? "GREEN" : "RED"} t1015-native-stop-unit: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
