#!/usr/bin/env node
/**
 * diag-t397 — the results/log timeliness + submission-wait round, proven on
 * a REAL cluster lane (the mock speaks the same SSH dialect as any login
 * node, sbatch included):
 *
 *   B  the lane: connection → project → particles import → a LONG class2d
 *      (60 iterations ≈ 1 min on the mock), with the POST's wall time
 *      measured. (A 160-round run was tried first — it rendered ~800
 *      PNGs and OOM'd the 4GB DEV box; production rounds are minutes
 *      apart, the rig's are 0.9s — the rig, not the product.)
 *   C  the RESULTS version token: a fresh payload carries a version; an
 *      unmoved run answers {unchanged:true} in ~40 bytes; a bogus token
 *      answers in full.
 *   D  RESULTS FRESHNESS (the round trip the user asked to tighten): for
 *      every round that appears while the gallery polls, the time from the
 *      round's OWN cluster mtime (ground truth via SSH stat) to the first
 *      payload that carries it — the sweep's prewarm must land it within
 *      one heartbeat + poll, median < 5s, max < 8s (the old world paid a
 *      12s TTL + its own SSH round — the worst case was 24s+).
 *   D2 the PREWARM's wire proof: while a viewer polls, the route's OWN
 *      SSH round (fingerprint: ---CF-STACKS--- in the mock's exec audit)
 *      runs ZERO times — the sweep's heartbeats (===CF:START:) own the
 *      reads.
 *   E  the SETTLE fast path: a round whose stack is header-complete
 *      streams on the heartbeat that first sees it — the local preview
 *      cache's .done marker lands within 15s of the round's cluster
 *      mtime (the old blanket settle was 60s), and the image route
 *      serves the rendered PNG.
 *   F  the log lane's regression: a terminal log version stays stable.
 *   G  SUBMISSION WAIT forensics (the mock's exec audit): the dispatch
 *      window shows the round-diet shapes — mkdir+scancel in ONE exec,
 *      the sbatch script written AND submitted in ONE exec — and none of
 *      the old separate shapes.
 *
 * Usage: CF_BASE=http://localhost:3001 node scripts/diag-t397-results-lane.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const MOCK = `${ROOT}/services/mock-cluster`;
const MOCK_FS = `${MOCK}/fs`;
const AUDIT = `${MOCK_FS}/home/cryo/.slurm/exec-audit.log`;
const PREVIEW = `${ROOT}/data/remote-preview/live`;
const FIXTURE_DIR = `${MOCK_FS}/data2/t397`;
const ORIGIN = { Origin: BASE };

let pass = 0, fail = 0;
const fails = [];
const must = (c, label, extra = "") => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(`${label}${extra ? ` — ${extra}` : ""}`); console.log(`FAIL  ${label}${extra ? ` — ${String(extra).slice(0, 260)}` : ""}`); }
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
      console.log(`    [server-down: ${e.code ?? e.message} — retrying]`);
      await sleep(2000);
      continue;
    }
    return { status: r.status, body: await r.json().catch(() => null), res: r };
  }
  return { status: 0, body: null, res: null };
}
const readJob = async (id) => {
  try {
    const d = await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json();
    return (d.jobs ?? []).find((x) => x.id === id) ?? null;
  } catch {
    return null;
  }
};
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
/** the exec audit, sliced from a byte offset; returns [lines, newOffset]. */
function auditSlice(offset) {
  try {
    const buf = readFileSync(AUDIT);
    const text = buf.slice(offset).toString("utf8");
    return { lines: text.split("\n").filter((l) => l.length > 0), offset: buf.length };
  } catch {
    return { lines: [], offset };
  }
}

/* ---------------- A: fixtures ---------------- */
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
  writeFileSync(`${FIXTURE_DIR}/particles.mrcs`, Buffer.concat([h, data]));
  const star = [
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

/* ---------------- B: the lane ---------------- */
section("B: connection + project + import + a 60-iteration class2d");
const CONN = `qa-t397-${Date.now().toString(36)}`;
{
  const r = await api("/api/remote/connections", {
    method: "POST",
    body: JSON.stringify({
      id: CONN, name: "QA t397 results lane", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "~/cryoflow", envLines: ["module load relion/5.0.1"],
    }),
  });
  must(r.status === 201 || r.status === 200, `B1 the connection is created (${r.status})`);
}
for (const p of (await api("/api/projects")).body?.projects ?? []) {
  if (p.name?.startsWith("t397 results lane")) await api(`/api/projects/${p.id}`, { method: "DELETE" });
}
const proj = (await api("/api/projects", { method: "POST", body: JSON.stringify({ name: `t397 results lane ${Date.now().toString(36)}`, mode: "spa", remoteConnectionId: CONN }) })).body?.project;
must(!!proj?.id, "B2 the remote project is created");
const pid = proj.id;
const mkJob = async (body) => (await api("/api/jobs", { method: "POST", body: JSON.stringify(body) })).body?.job;

const imp = await mkJob({
  projectId: pid, type: "import", name: "t397 particles import",
  params: { nodeType: "particles", micrographsPath: "/data2/t397/particles.star", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 },
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
  projectId: pid, type: "class2d", name: "t397 class2d longrun",
  params: { numClasses: 5, iterations: 60, doCtf: false, particleDiameter: 120 },
});
must(!!c2?.id, "B6 the class2d job exists");
must((await api("/api/edges", { method: "POST", body: JSON.stringify({ fromJobId: imp.id, toJobId: c2.id, fromPort: "particles", toPort: "particles" }) })).status < 300, "B7 the particles edge lands");
const jobId = c2.id;

// the dispatch, with the POST's wall time measured + the audit window opened
const auditBefore = existsSync(AUDIT) ? statSync(AUDIT).size : 0;
const tPost0 = Date.now();
let postMs = null;
{
  // an EXPLICIT slurm target: the project binding's default lane is
  // direct (nohup), and the G forensics witness the SBATCH lane's round
  // diet — the lane the user's real clusters run
  const r = await api(`/api/jobs/${jobId}/run`, {
    method: "POST",
    body: JSON.stringify({ remote: { connectionId: CONN, mode: "slurm", gpus: 2 } }),
  });
  postMs = Date.now() - tPost0;
  must(r.status === 200 && !r.body.error, `B8 the dispatch is accepted (${r.status} ${r.body.error ?? ""}) in ${postMs}ms`);
  console.log(`    POST /run wall time: ${postMs}ms (first dispatch on a fresh connection pays the module probe ceremony — the audit forensics in G is the shape that matters)`);
}
async function resolveRemoteWorkdir() {
  const j = await readJob(jobId);
  const w = j?.runRemote?.remoteWorkdir;
  if (typeof w === "string" && w.length > 0) return w;
  return `~/cryoflow/${pid}/class2d_${jobId.slice(-8)}`;
}
const sshPath = (w) => (w.startsWith("~") ? `$HOME${w.slice(1)}` : w);
const remoteWorkdir = await resolveRemoteWorkdir();
console.log(`    remoteWorkdir: ${remoteWorkdir}`);

// the sweep driver: /api/jobs at the UI's own cadence for the whole round
let runDone = false;
const donePoller = pollUntil(async () => {
  const x = await readJob(jobId);
  const done = x?.status === "completed" || x?.status === "failed";
  if (done) runDone = true;
  return done ? x : null;
}, 400_000, 1200);

/* ---------------- C: the results version token ---------------- */
section("C: the results version token");
{
  // wait for the run to be ALIVE and the first round to exist
  const live = await pollUntil(async () => {
    if (runDone) return true;
    const probe = client(`ls ${sshPath(remoteWorkdir)}/run_it001_data.star 2>/dev/null | wc -l`);
    return probe.out.trim() === "1";
  }, 90_000, 1000);
  must(live, "C0 the run's first round exists on the cluster");

  const first = await api(`/api/jobs/${jobId}/iterations`);
  must(first.status === 200 && Array.isArray(first.body?.iterations), `C1 the iterations route answers (${first.status})`);
  const v1 = first.body?.version ?? "";
  const s1 = JSON.stringify(first.body ?? {}).length;
  must(v1.length > 0, `C2 the payload carries a version token ("${v1}")`);

  // the unchanged short-circuit: within one round's quiet gap the same
  // version must answer tiny — race the 0.9s round cadence by retrying
  let unchangedSeen = false, tinyBytes = 0;
  for (let i = 0; i < 12 && !unchangedSeen; i++) {
    const r = await api(`/api/jobs/${jobId}/iterations?since=${encodeURIComponent(v1)}`);
    if (r.body?.unchanged === true) {
      unchangedSeen = true;
      tinyBytes = JSON.stringify(r.body ?? {}).length;
    } else if (r.body?.version && r.body.version !== v1) {
      break; // a new round landed mid-loop — the token lane moved on
    }
    await sleep(200);
  }
  must(unchangedSeen, "C3 an unmoved run answers unchanged:true");
  must(unchangedSeen && tinyBytes < 200, `C4 the unchanged body is tiny (${tinyBytes}B vs ${s1}B full)`);

  const bogus = await api(`/api/jobs/${jobId}/iterations?since=totally-bogus-token`);
  must(bogus.body?.unchanged !== true && Array.isArray(bogus.body?.iterations), "C5 a bogus token answers in full (never mistaken for unchanged)");
  must(!!bogus.body?.version, "C6 the full answer carries the token home");
}

/* --------- D: results freshness + the prewarm's wire proof --------- */
section("D: results freshness — round mtime → gallery payload");
{
  // warm the viewer: one full poll marks the watch; give the sweep a
  // couple of heartbeats to adopt the prewarm
  await api(`/api/jobs/${jobId}/iterations`);
  await sleep(6000);
  const auditMark = existsSync(AUDIT) ? statSync(AUDIT).size : 0;

  // 22s window: poll every 400ms with the token, record first-seen times
  const t0 = Date.now();
  const firstSeen = new Map();
  let version = "";
  let unchangedCount = 0, fullCount = 0;
  while (Date.now() - t0 < 22_000 && !runDone) {
    const q = version ? `?since=${encodeURIComponent(version)}` : "";
    const r = await api(`/api/jobs/${jobId}/iterations${q}`);
    if (r.body?.unchanged === true) {
      unchangedCount++;
    } else if (Array.isArray(r.body?.iterations)) {
      fullCount++;
      if (r.body.version) version = r.body.version;
      for (const it of r.body.iterations) {
        if (!firstSeen.has(it)) firstSeen.set(it, Date.now());
      }
    }
    await sleep(400);
  }

  // ground truth: every round's own cluster mtime
  const statOut = client(
    `cd ${sshPath(remoteWorkdir)} && for f in run_it???_data.star; do [ -f "$f" ] && stat -c '%Y %n' "$f"; done`
  ).out;
  const mtimeOf = new Map();
  for (const line of statOut.split("\n")) {
    const m = /^(\d+)\s+(run_it(\d+)_data\.star)$/.exec(line.trim());
    if (m) mtimeOf.set(Number(m[3]), Number(m[1]) * 1000);
  }
  must(mtimeOf.size >= 3, `D1 the cluster's own mtimes resolve (${mtimeOf.size} rounds)`);

  // freshness per round that FIRST APPEARED during the window (the rounds
  // that existed before it are pre-warmed by definition)
  const fresh = [];
  for (const [it, seen] of firstSeen) {
    const mt = mtimeOf.get(it);
    if (mt != null && mt > t0 - 500) fresh.push(seen - mt);
  }
  fresh.sort((a, b) => a - b);
  console.log(`    freshness (mtime → payload visible): ${fresh.map((x) => `${(x / 1000).toFixed(1)}s`).join(", ") || "(none)"} · unchanged ${unchangedCount} / full ${fullCount}`);
  must(fresh.length >= 2, `D2 enough rounds landed inside the window to measure (${fresh.length})`);
  if (fresh.length >= 2) {
    const med = fresh[Math.floor(fresh.length / 2)];
    const max = fresh[fresh.length - 1];
    must(med < 5_000, `D3 median freshness < 5s (${(med / 1000).toFixed(1)}s — the old world's TTL alone was 12s)`);
    must(max < 8_000, `D4 worst freshness < 8s (${(max / 1000).toFixed(1)}s — the old worst case stacked 12s TTL + its own SSH round)`);
  }

  // the prewarm's wire proof: the route's OWN round never ran during the
  // window — the sweep's heartbeats owned the reads
  const win = auditSlice(auditMark);
  const routeOwnRounds = win.lines.filter((l) => l.includes("---CF-STACKS---")).length;
  const heartbeats = win.lines.filter((l) => l.includes("===CF:START:")).length;
  must(heartbeats >= 3, `D5 the sweep ran its heartbeats (${heartbeats} in the window)`);
  must(routeOwnRounds === 0, `D6 the gallery route paid ZERO SSH rounds of its own (${routeOwnRounds} × ---CF-STACKS--- in the audit) — the sweep's prewarm owns the reads`);
  must(unchangedCount >= 1, `D7 the token diet held between rounds (${unchangedCount} unchanged answers)`);
}

/* ---------------- E: the settle fast path + the render ---------------- */
section("E: round → streamed render (the settle fast path)");
{
  // pick rounds that landed 3–8s ago (fresh, complete — the mock writes
  // whole stacks in one go, so the header-complete path applies)
  const statOut = client(
    `cd ${sshPath(remoteWorkdir)} && for f in run_it???_classes.mrcs; do [ -f "$f" ] && stat -c '%Y %s %n' "$f"; done`
  ).out;
  const rounds = [];
  for (const line of statOut.split("\n")) {
    const m = /^(\d+)\s+(\d+)\s+(run_it(\d+)_classes\.mrcs)$/.exec(line.trim());
    if (m) rounds.push({ mtimeMs: Number(m[1]) * 1000, size: Number(m[2]), iter: Number(m[4]), file: m[3] });
  }
  must(rounds.length >= 2, `E1 the cluster's round stacks stat (${rounds.length})`);
  // the newest round that is at least 3s old (a heartbeat has seen it)
  const now = Date.now();
  const target = [...rounds].reverse().find((r) => now - r.mtimeMs >= 3_000 && now - r.mtimeMs <= 30_000);
  must(!!target, `E2 a fresh round to watch (newest age ${((now - rounds[rounds.length - 1].mtimeMs) / 1000).toFixed(1)}s)`);
  if (target) {
    const donePath = `${PREVIEW}/${jobId}/${target.file.replace(/\.mrcs?$/, "")}/.done`;
    const appeared = await pollUntil(() => existsSync(donePath) ? Date.now() : null, 40_000, 500);
    must(!!appeared, `E3 the round's render pipeline landed locally (${target.file})`);
    if (appeared) {
      const dt = appeared - target.mtimeMs;
      console.log(`    ${target.file}: cluster mtime → local .done = ${(dt / 1000).toFixed(1)}s`);
      must(dt < 15_000, `E4 the render streamed within 15s of the round's mtime (${(dt / 1000).toFixed(1)}s — the old blanket settle alone waited 60s)`);
    }
    // the image route serves the rendered class PNG
    const img = await fetch(`${BASE}/api/jobs/${jobId}/iterations/image?file=${encodeURIComponent(target.file)}&slice=0`, { headers: ORIGIN });
    const buf = Buffer.from(await img.arrayBuffer());
    must(img.status === 200 && buf.length > 100 && buf.subarray(1, 4).toString() === "PNG", `E5 the image route serves the round's class PNG (${img.status}, ${buf.length}B)`);
  }
}

/* ---------------- F: the log lane regression ---------------- */
section("F: the log lane still tokens (regression)");
{
  const j = await donePoller;
  must(j?.status === "completed", `F1 the class2d completes (${j?.status} — ${String(j?.result ?? "").slice(0, 120)})`);
  const a = await api(`/api/jobs/${jobId}/log`);
  const b = await api(`/api/jobs/${jobId}/log?since=${encodeURIComponent(a.body?.version ?? "")}`);
  must(a.body?.version && b.body?.unchanged === true, "F2 a terminal log's version is stable (the t391 lane untouched)");
}

/* ---------------- G: submission-wait forensics ---------------- */
section("G: the dispatch window in the mock's exec audit (the round diet)");
{
  // the window: from the audit mark to the FIRST .cf-sbatch.sh exec (the
  // submit) — the rest of the slice is the run's own traffic (renders,
  // sync-back, finalize), never the dispatch itself
  const whole = auditSlice(auditBefore);
  const submitIdx = whole.lines.findIndex((l) => l.includes(".cf-sbatch.sh"));
  const win = { lines: submitIdx >= 0 ? whole.lines.slice(0, submitIdx + 1) : whole.lines };
  console.log(`    dispatch window: ${win.lines.length} exec(s)`);
  const esc = (l) => l.replace(/^\d+ /, "");
  // the window runs from the audit mark to the submit receipt. shQuote
  // leaves "safe" paths bare and quotes the rest — every fingerprint is
  // quote-agnostic by design.
  const submitLine = win.lines.find((l) => /head -c \d+ > \S+\.cf-sbatch\.sh && sbatch /.test(l));
  must(
    !!submitLine,
    `G1 the single-round submit exists (head -c write && sbatch in ONE exec — got ${win.lines.filter((l) => l.includes("sbatch")).length} sbatch-touching execs)`
  );
  must(win.lines.some((l) => /; scancel -n cf_class2d_/.test(l)), "G2 mkdir and the scancel reaper share one exec");
  const bareMkdir = win.lines.filter((l) => {
    const b = esc(l);
    return b === `mkdir -p ${remoteWorkdir}` || b === `mkdir -p '${remoteWorkdir}'`;
  });
  must(bareMkdir.length === 0, `G3 no standalone mkdir of the workdir (${bareMkdir.length} — it rode the scancel round)`);
  // the OLD shape was a bare `sbatch <path>` exec of its own; the module
  // probe's `command -v sbatch` and the submit's `&& sbatch` are NOT that
  const bareSbatch = win.lines.filter((l) => /^sbatch /.test(esc(l)));
  must(bareSbatch.length === 0, `G4 no standalone sbatch exec (${bareSbatch.length})`);
  const bareWrite = win.lines.filter((l) => /head -c \d+ > \S+\.cf-sbatch\.sh/.test(l) && !l.includes("&& sbatch"));
  must(bareWrite.length === 0, `G5 no upload-only write of the sbatch script (${bareWrite.length})`);
  // the whole window's round count, for the record
  const dispatchExecs = win.lines.filter((l) => !l.includes("===CF:START:")).length;
  console.log(`    dispatch-window execs (excluding sweep heartbeats): ${dispatchExecs}`);
}

/* ---------------- teardown ---------------- */
section("H: teardown");
{
  try { rmSync(`${PREVIEW}/${jobId}`, { recursive: true, force: true }); } catch { /* best effort */ }
  const pr = await api(`/api/projects/${pid}`, { method: "DELETE" });
  must(pr.status < 300 || pr.status === 404, `H1 the project is removed (${pr.status})`);
  const cr = await api(`/api/remote/connections/${CONN}`, { method: "DELETE" });
  must(cr.status < 300 || cr.status === 404, `H2 the connection is removed (${cr.status})`);
}

console.log(`\n${"-".repeat(60)}\nt397 results-lane: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
