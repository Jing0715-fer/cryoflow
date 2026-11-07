#!/usr/bin/env node
/**
 * diag-t391 — the performance round: cluster-log freshness + the no-op poll
 * diet + the bounded caches.
 *
 * The user's ask: 继续优化整个项目的性能，减少内存使用，加快 cluster log
 * 的获取时效性和速度。This diag proves the t391 changes against a REAL
 * cluster lane (the mock speaks the same SSH dialect as any login node):
 *
 *   C  the VERSION TOKEN — the log route answers an unmoved log with
 *      {unchanged:true} (~40 bytes) instead of the full tail; a moved log
 *      answers in full; a bogus token answers in full; raw format intact.
 *   D  FRESHNESS WITH A VIEWER (the watch-aware sweep floor): a marker line
 *      appended to the cluster's run.out becomes console-visible in ≤5.5s
 *      (median <4.8s across three markers) while a console is open — the
 *      4s→2.5s floor doing its job; WITHOUT a viewer the relaxed 4s lane
 *      still lands it (≤12s, no regression).
 *   E  the FULL mode rides the same version lane.
 *   F  a terminal run's log is stable: same version forever → unchanged.
 *   S  source-level: the floor constant, the LRU caps (logFullCache ≤4,
 *      liveCache ≤12), the since/unchanged wiring, the barrel-file trim,
 *      the lazy dashboard chunk, the client's re-render gate.
 *
 * Usage:
 *   CF_ROOT=/home/z/cryoflow node scripts/diag-t391-perf-log-lane.mjs
 */
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync, writeSync } from "node:fs";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const MOCK = `${ROOT}/services/mock-cluster`;
const MOCK_FS = `${MOCK}/fs`;
const FIXTURE_DIR = `${MOCK_FS}/data2/t391`;
const ORIGIN = { Origin: BASE };

let pass = 0, fail = 0;
const fails = [];
const must = (c, label, extra = "") => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(`${label}${extra ? ` — ${extra}` : ""}`); console.log(`FAIL  ${label}${extra ? ` — ${String(extra).slice(0, 220)}` : ""}`); }
  return !!c;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => console.log(`\n== ${t} ==`);

async function api(path, opts) {
  for (let a = 0; a < 3; a++) {
    let r;
    try {
      r = await fetch(`${BASE}${path}`, { ...opts, headers: { ...ORIGIN, ...(opts?.body ? { "Content-Type": "application/json" } : {}) } });
    } catch (e) {
      console.log(`    [server-down: ${e.code ?? e.message} — resurrecting]`);
      spawnSync("bash", ["/tmp/cf-up.sh"], { encoding: "utf8", timeout: 150_000 });
      await sleep(2000);
      continue;
    }
    return { status: r.status, body: await r.json().catch(() => null), res: r };
  }
  return { status: 0, body: null, res: null };
}
const readJob = async (id) => {
  // t391 — resilient: an OOM'd server mid-diag must not crash the poller
  // (the api() helper resurrects; a raw fetch here killed round 2's run)
  try {
    const d = await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json();
    return (d.jobs ?? []).find((x) => x.id === id) ?? null;
  } catch {
    return null;
  }
};
/** SSH into the mock cluster. */
function client(cmd) {
  const r = spawnSync("node", [`${MOCK}/test-client.mjs`, cmd], { encoding: "utf8", timeout: 60_000 });
  return { out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
async function pollUntil(fn, ms, every = 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}

/* ---------------- A: fixtures (a real particle stack) ---------------- */
section("A: fixtures — a real 64×64×30 float32 stack on the mock /data2 tree");
const NX = 64, NY = 64, NZ = 30;
function writeFixtureStack() {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const data = Buffer.alloc(NX * NY * NZ * 4);
  let off = 0;
  for (let z = 0; z < NZ; z++) {
    const cx = NX / 2 + 6 * Math.sin(z * 0.7);
    const cy = NY / 2 + 6 * Math.cos(z * 0.9);
    const rad = 0.22 + ((z * 37) % 10) / 60;
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const dx = (x - cx) / (NX * rad);
        const dy = (y - cy) / (NY * rad);
        const r2 = dx * dx + dy * dy;
        const blob = Math.exp(-3.0 * r2);
        const noise = (((z * 1103515245 + (y * NX + x) * 12345) >>> 0) % 1000) / 1000 - 0.5;
        data.writeFloatLE(0.7 * blob + 0.1 * noise, off);
        off += 4;
      }
    }
  }
  const h = Buffer.alloc(1024);
  h.writeInt32LE(NX, 0); h.writeInt32LE(NY, 4); h.writeInt32LE(NZ, 8);
  h.writeInt32LE(2, 12);
  h.writeInt32LE(NX, 28); h.writeInt32LE(NY, 32); h.writeInt32LE(NZ, 36);
  h.writeFloatLE(NX, 40); h.writeFloatLE(NY, 44); h.writeFloatLE(NZ, 48);
  h.writeFloatLE(90, 52); h.writeFloatLE(90, 56); h.writeFloatLE(90, 60);
  h.writeInt32LE(1, 64); h.writeInt32LE(2, 68); h.writeInt32LE(3, 72);
  h.writeFloatLE(-0.5, 76); h.writeFloatLE(0.85, 80); h.writeFloatLE(0.02, 84);
  h.writeInt32LE(1, 88);
  h.write("MAP ", 208); h.write("\x44\x41", 212);
  h.writeFloatLE(0.2, 216);
  h.writeInt32LE(1, 220);
  const fd = openSync(`${FIXTURE_DIR}/particles.mrcs`, "w");
  writeSync(fd, h); writeSync(fd, data);
  closeSync(fd);
  const star = [
    "", "data_optics", "", "loop_",
    "_rlnOpticsGroup #1", "_rlnOpticsGroupName #2", "_rlnMicrographOriginalPixelSize #3",
    "_rlnVoltage #4", "_rlnSphericalAberration #5", "_rlnAmplitudeContrast #6", "_rlnImageSize #7",
    "1 optics1 1.77 300 2.7 0.1 64",
    "", "data_particles", "", "loop_", "_rlnImageName #1",
    ...Array.from({ length: NZ }, (_, i) => `${i + 1}@particles.mrcs`), "",
  ].join("\n");
  writeFileSync(`${FIXTURE_DIR}/particles.star`, star);
}
try {
  must(statSync(`${FIXTURE_DIR}/particles.mrcs`).size === 1024 + NX * NY * NZ * 4, "A1 fixture stack present");
} catch {
  writeFixtureStack();
  must(statSync(`${FIXTURE_DIR}/particles.mrcs`).size === 1024 + NX * NY * NZ * 4, "A1 fixture stack written");
}
must(existsSync(`${FIXTURE_DIR}/particles.star`), "A2 particles.star present");
must((await api("/api/jobs")).status === 200, "A3 the app answers /api/jobs");
must(client("echo ok").out.includes("ok"), "A4 the mock cluster answers over SSH");

/* ---------------- B: the lane (import → a LONG class2d) ---------------- */
section("B: connection + project + import + a 60-iteration class2d (a long run to measure against)");
const CONN = `qa-t391-${Date.now().toString(36)}`;
{
  const r = await api("/api/remote/connections", {
    method: "POST",
    body: JSON.stringify({
      id: CONN, name: "QA t391 perf lane", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "~/cryoflow", envLines: ["module load relion/5.0.1"],
    }),
  });
  must(r.status === 201 || r.status === 200, `B1 the connection is created (${r.status})`);
}
for (const p of (await api("/api/projects")).body?.projects ?? []) {
  if (p.name?.startsWith("t391 perf lane")) await api(`/api/projects/${p.id}`, { method: "DELETE" });
}
const proj = (await api("/api/projects", { method: "POST", body: JSON.stringify({ name: `t391 perf lane ${Date.now().toString(36)}`, mode: "spa", remoteConnectionId: CONN }) })).body?.project;
must(!!proj?.id, "B2 the remote project is created");
const pid = proj.id;
const mkJob = async (body) => (await api("/api/jobs", { method: "POST", body: JSON.stringify(body) })).body?.job;

const imp = await mkJob({
  projectId: pid, type: "import", name: "t391 particles import",
  params: { nodeType: "particles", micrographsPath: "/data2/t391/particles.star", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 },
});
must(!!imp?.id, "B3 the particles import job exists");
{
  const r = await api(`/api/jobs/${imp.id}/run`, { method: "POST", body: "{}" });
  must(r.status === 200 && !r.body.error, `B4 the import runs (${r.status})`);
  const j = await pollUntil(async () => {
    const x = await readJob(imp.id);
    return (x?.status === "completed" || x?.status === "failed") ? x : null;
  }, 120_000);
  must(j?.status === "completed", `B5 the import completes (${j?.status})`);
}

const c2 = await mkJob({
  projectId: pid, type: "class2d", name: "t391 class2d longrun",
  params: { numClasses: 5, iterations: 100, doCtf: false, particleDiameter: 120 },
});
must(!!c2?.id, "B6 the class2d job exists");
must((await api("/api/edges", { method: "POST", body: JSON.stringify({ fromJobId: imp.id, toJobId: c2.id, fromPort: "particles", toPort: "particles" }) })).status < 300, "B7 the particles edge lands");
{
  const r = await api(`/api/jobs/${c2.id}/run`, { method: "POST", body: "{}" });
  must(r.status === 200 && !r.body.error, `B8 the dispatch is accepted (${r.status} ${r.body.error ?? ""})`);
}
const jobId = c2.id;
// the authoritative remote workdir comes from the RUN RECORD (the DTO's
// runRemote.remoteWorkdir) — a hand-built "~"-formula path dies in the
// mock's non-interactive shell (no tilde expansion), so resolve it live
async function resolveRemoteWorkdir() {
  const j = await readJob(jobId);
  const w = j?.runRemote?.remoteWorkdir;
  if (typeof w === "string" && w.length > 0) return w;
  return `~/cryoflow/${pid}/class2d_${jobId.slice(-8)}`;
}
/** SSH-safe path: expand a leading ~ to $HOME (dash-safe). */
const sshPath = (w) => (w.startsWith("~") ? `$HOME${w.slice(1)}` : w);
let remoteWorkdir = await resolveRemoteWorkdir();
console.log(`    remoteWorkdir: ${remoteWorkdir}`);
// the sweep driver: /api/jobs at the UI's own 1.2s cadence for the whole round
let runDone = false;
const donePoller = pollUntil(async () => {
  const x = await readJob(jobId);
  const done = x?.status === "completed" || x?.status === "failed";
  if (done) runDone = true;
  return done ? x : null;
}, 600_000, 1200);

/* ---------------- C: the version token lane ---------------- */
section("C: the version token — unchanged logs answer in ~40 bytes");
{
  // wait for the run to be alive and its first log bytes to exist
  const live = await pollUntil(async () => {
    if (runDone) return true;
    const probe = client(`tail -c 200 ${sshPath(remoteWorkdir)}/run.out 2>/dev/null | wc -c`);
    return Number(probe.out) > 0;
  }, 60_000, 1000);
  must(live, "C0 the run's run.out exists on the cluster");

  const first = await api(`/api/jobs/${jobId}/log`);
  must(first.status === 200 && typeof first.body?.tail === "string", `C1 the log route answers (${first.status})`);
  const v1 = first.body?.version ?? "";
  const s1 = JSON.stringify(first.body ?? {}).length;
  must(v1.length > 0, `C2 the answer carries a version token ("${v1}")`);

  const same = await api(`/api/jobs/${jobId}/log?since=${encodeURIComponent(v1)}`);
  const s2 = JSON.stringify(same.body ?? {}).length;
  must(same.body?.unchanged === true, `C3 the unmoved log answers unchanged:true`);
  must(
    s2 < 200 && (s1 <= 4_000 || s2 < s1 * 0.05),
    `C4 the unchanged body is tiny (${s2}B vs ${s1}B${s1 > 4_000 ? ` — ${(100 * s2 / s1).toFixed(1)}%` : " — the log itself is still this small"})`
  );

  const marker = `T391-MARKER-C-${Date.now()}`;
  const ap = client(`echo '${marker}' >> ${sshPath(remoteWorkdir)}/run.err`);
  must(ap.err.length === 0, `C5a the marker append lands over SSH (${ap.err.slice(0, 80) || "clean"})`);
  // wait for the MARKER itself (the mock's own iteration lines change the
  // version too — "any change" is not "the marker landed")
  let landed = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 20_000) {
    const r = await api(`/api/jobs/${jobId}/log?since=${encodeURIComponent(v1)}`);
    if (r.body && r.body.unchanged !== true && typeof r.body.tail === "string" && r.body.tail.includes(marker)) {
      landed = r;
      break;
    }
    await sleep(400);
  }
  must(!!landed, "C5 the moved log answers in FULL (not unchanged)");
  const moved = landed;
  must(moved != null && moved.body.tail.includes(marker), "C6 the new content includes the appended marker");
  must(moved != null && moved.body.version && moved.body.version !== v1, "C7 the version token changed with the content");

  const bogus = await api(`/api/jobs/${jobId}/log?since=totally-bogus-token`);
  must(bogus.body?.unchanged !== true && typeof bogus.body?.tail === "string", "C8 a bogus token answers in full (never a false unchanged)");

  const raw = await fetch(`${BASE}/api/jobs/${jobId}/log?format=raw`, { headers: ORIGIN });
  const rawText = raw.ok ? await raw.text() : "";
  must(raw.status === 200 && rawText.includes("cryoflow-mock refine"), `C9 the raw download format still works (${raw.status}, ${rawText.length}B)`);
  const v2 = moved?.body?.version ?? bogus.body?.version ?? "";
  if (v2) {
    const again = await api(`/api/jobs/${jobId}/log?since=${encodeURIComponent(v2)}`);
    must(again.body?.unchanged === true, "C10 the NEW version re-locks (idempotent)");
  }
}

/* ---------------- D: freshness with a viewer (the watch floor) ---------------- */
section("D: log freshness — marker → console visibility");
const visTimes = [];
async function markerToConsole(label) {
  const marker = `T391-MARKER-${label}-${Date.now()}`;
  remoteWorkdir = await resolveRemoteWorkdir();
  client(`echo '${marker}' >> ${sshPath(remoteWorkdir)}/run.err`);
  const t0 = Date.now();
  for (;;) {
    const r = await api(`/api/jobs/${jobId}/log`);
    if (r.body?.tail?.includes(marker)) return Date.now() - t0;
    if (Date.now() - t0 > 25_000) return null;
    await sleep(400); // a console is OPEN: this poll is the watch heartbeat
  }
}
{
  const t1 = await markerToConsole("D1a");
  must(t1 != null && t1 <= 5_500, `D1 marker visible with a viewer in ≤5.5s (got ${t1 == null ? "TIMEOUT" : `${t1}ms`})`);
  if (t1 != null) visTimes.push(t1);
  const t2 = await markerToConsole("D1b");
  if (t2 != null) visTimes.push(t2);
  const t3 = await markerToConsole("D1c");
  if (t3 != null) visTimes.push(t3);
  if (visTimes.length >= 2) {
    visTimes.sort((a, b) => a - b);
    const median = visTimes[Math.floor(visTimes.length / 2)];
    must(median < 4_800, `D2 median visibility <4.8s across ${visTimes.length} markers (${visTimes.join("ms, ")}ms — median ${median}ms; the 2.5s watch floor + tick alignment, vs ~5s at the old 4s floor)`);
  } else {
    must(false, "D2 median visibility", `only ${visTimes.length} markers landed before the run ended`);
  }

  // D3 — the RELAXED lane (no viewer): no log polls for 25s, then one marker
  console.log("    [going dark: no console polls for 25s — the sweep relaxes to the 4s floor]");
  await sleep(25_000);
  if (!runDone) {
    const marker = `T391-MARKER-D3-${Date.now()}`;
    remoteWorkdir = await resolveRemoteWorkdir();
    client(`echo '${marker}' >> ${sshPath(remoteWorkdir)}/run.err`);
    let visible = null;
    const t0 = Date.now();
    for (let check = 0; check < 6; check++) {
      await sleep(check === 0 ? 8_000 : 1_500); // 8s, then 9.5, 11, 12.5…
      const r = await api(`/api/jobs/${jobId}/log`);
      if (r.body?.tail?.includes(marker)) { visible = Date.now() - t0; break; }
    }
    must(visible != null && visible <= 12_500, `D3 the unwatched lane still refreshes (visible after ${visible == null ? ">12.5s" : `${visible}ms`} — the 4s floor sweep + the 15s staleness fallback both serve)`);
  } else {
    console.log("    [run already terminal — D3 skipped (the terminal cache serves forever, F covers it)]");
  }
}

/* ---------------- E: full mode rides the version lane ---------------- */
section("E: full mode");
{
  // the full fetch shares the 10s/job rate limiter with the C-phase — a
  // pending answer is the honest in-between tick, not a failure; wait for
  // a REAL full answer
  let f1 = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 35_000) {
    const r = await api(`/api/jobs/${jobId}/log?full=1`);
    if (r.status === 200 && r.body && r.body.pending !== true && typeof r.body.tail === "string") { f1 = r; break; }
    await sleep(1500);
  }
  must(!!f1, `E1 the full answer lands (${f1?.status ?? "no answer"})`);
  const fv = f1?.body?.version ?? "";
  must(fv.length > 0, `E2 the full answer carries its own version ("${fv.slice(0, 24)}")`);
  if (fv) {
    const f2 = await api(`/api/jobs/${jobId}/log?full=1&since=${encodeURIComponent(fv)}`);
    must(f2.body?.unchanged === true, "E3 an unmoved full log answers unchanged (the 8MB fetch is not repeated)");
  }
}

/* ---------------- F: the terminal log is stable ---------------- */
section("F: the terminal run");
{
  const j = await donePoller;
  must(j?.status === "completed", `F1 the class2d completes (${j?.status} — ${String(j?.result ?? "").slice(0, 120)})`);
  const a = await api(`/api/jobs/${jobId}/log`);
  const b = await api(`/api/jobs/${jobId}/log?since=${encodeURIComponent(a.body?.version ?? "")}`);
  must(a.body?.version && b.body?.unchanged === true, "F2 a terminal log's version is stable (unchanged forever)");
  const dto = await readJob(jobId);
  must(!!dto?.runRemote, "F3 the job DTO still carries its remote info");
}

/* ---------------- S: source-level assertions ---------------- */
section("S: source-level (the constants and wiring this round installed)");
{
  const rr = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  must(rr.includes("watched ? 2_500 : 4_000"), "S1 the watch-aware sweep floor (2.5s when a console is open, 4s otherwise)");
  must(rr.includes("LOG_FULL_LRU_MAX = 4"), "S2 the full-log cache is capped at 4 entries (the 8MB-per-job leak is closed)");
  must(rr.includes("LOG_FULL_TTL_MS = 120_000"), "S3 a live run's full answer expires in 2min (no stale 8MB pinned)");
  must(rr.includes("function logVersionOf"), "S4 the remote version hash exists");
  must(rr.includes("markLogWatch(jobId)"), "S5 every log route hit registers the watch");
  const il = readFileSync(`${ROOT}/src/lib/remote/iteration-live.ts`, "utf8");
  must(il.includes("while (liveCache.size > 12)"), "S6 the live iterations cache is capped at 12 jobs");
  const route = readFileSync(`${ROOT}/src/app/api/jobs/[id]/log/route.ts`, "utf8");
  must(route.includes('url.searchParams.get("since")') && route.includes("unchanged: true"), "S7 the route speaks ?since= / unchanged");
  const eng = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  must(eng.includes("version: logVersionLocal"), "S8 the local lane computes the same shape of version");
  const nc = readFileSync(`${ROOT}/next.config.ts`, "utf8");
  must(nc.includes('optimizePackageImports: ["lucide-react", "recharts", "framer-motion"]'), "S9 the barrel-file trim (compile memory + client bundle)");
  // t391 v2 — the whole app body lifted into app-shell.tsx; page.tsx is the
  // thin dynamic shell. Both assertions moved with the code they assert.
  const pg = readFileSync(`${ROOT}/src/app/page.tsx`, "utf8");
  must(
    pg.includes('import("@/components/workflow/app-shell")') && pg.includes("ssr: false"),
    "S10a the home route is a thin dynamic shell (the boot compile no longer pays the app graph)"
  );
  const shell = readFileSync(`${ROOT}/src/components/workflow/app-shell.tsx`, "utf8");
  must(
    shell.includes('import("@/components/workflow/project-dashboard")'),
    "S10b the dashboard is its own lazy chunk inside the shell"
  );
  const lazy = readFileSync(`${ROOT}/src/components/workflow/results/results-lazy.tsx`, "utf8");
  must(
    lazy.includes("FscChart = dynamic") && lazy.includes("TopazTrainingChart = dynamic"),
    "S10c the recharts family rides the lazy results barrel"
  );
  const ji = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  must(ji.includes('params.set("since"') && ji.includes("if (text !== logRef.current)"), "S11 the inspector console sends since= and skips the re-render on identity");
  const jp = readFileSync(`${ROOT}/src/components/workflow/job-panel.tsx`, "utf8");
  must(jp.includes("prev === tail ? prev : tail"), "S12 the panel log gate (identical text never re-renders)");
}

/* ---------------- teardown ---------------- */
section("G: teardown");
{
  const pr = await api(`/api/projects/${pid}`, { method: "DELETE" });
  must(pr.status < 300 || pr.status === 404, `G1 the project is removed (${pr.status})`);
  const cr = await api(`/api/remote/connections/${CONN}`, { method: "DELETE" });
  must(cr.status < 300 || cr.status === 404, `G2 the connection is removed (${cr.status})`);
}

console.log(`\n${"-".repeat(60)}\nt391 perf-log-lane: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
