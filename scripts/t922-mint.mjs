#!/usr/bin/env node
/**
 * t922 — the CTF/Motion A/B faces' world prep: two COMPLETED runs per
 * elder domain, minted through the product's real doors.
 *
 * The compare dialog's CTF and Motion domains (t439/t440) have never had
 * a live ride — the seed world holds ONE idle run of each and the stubs
 * wrote param-blind rows (two runs = byte-identical rows = the null
 * verdict). This window the stubs learned the engine's real argv (the
 * t533 law: the mock learns at the deepest layer the real binary
 * actually touches), so a B run with different params produces genuinely
 * moved rows. This script mints that world:
 *
 *   IMP-M  = "Import Movies (t922)" — a nodeType:"movies" import of the
 *            mock cluster's 6 mics. THE MOTIONCORR FEED LAW (remote-run.ts
 *            :4139, the t535 gate): MotionCorr reads only MOVIES stars —
 *            the seed's micrographs import is refused by the remote lane's
 *            own gate (a wiring mistake must not flip the row — it never
 *            even reaches sbatch). The movies import runs locally (engine-
 *            native); the MC runs stage its star remotely.
 *   MC-A   = the SEED's Motion Correction 1, re-fed IMP-M (the seed's
 *            micrographs edge is recorded and restored by remove), run
 *            with its own defaults (bfactor 150, dose 1.28) — the stub's
 *            default law keeps the classic 0.6/0.4 shape
 *   CTF-A  = the SEED's CTF Estimation 1, run with its own defaults
 *            (window 5000..50000, ResMax 5)
 *   MC-B   = "Motion Correction 2 (t922)" — bfactor 300, dose 2.0
 *            → per-mic totals: k even +1.5 Å (regressed), k odd −1.5 Å
 *              (improved); early fraction 0.636
 *   CTF-B  = "CTF Estimation 2 (t922)" — window 8000..30000, ResMax 4
 *            → defocus estimates shift inside the narrower window;
 *              FOM ±0.002 alternating (k even improves, k odd regresses)
 *
 * Verbs (the t916 mint contract):
 *   mint    movies import, run A ×2, mint B ×2 (+ their feed edges),
 *           run B ×2, verify the row deltas the dialog will eat, write
 *           manifest.json
 *   verify  re-check every manifest claim against the live world
 *   remove  undo the fire's re-wire if present (filter→CTF-A edge off,
 *           the ORIGINAL MC-A→CTF-A edge back), delete the minted jobs
 *           downstream-first (movies import last), re-wire MC-A's seed
 *           edge home, sweep local + mock-side workdirs, verify the
 *           seed trio + 2 edges + the original edge ids + statuses
 *
 *   node scripts/t922-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const MANIFEST = path.join(process.cwd(), "data", "t922-ctf-motion-mint.json");
const MOCK_PROJECTS = path.join(process.cwd(), "services", "mock-cluster", "fs", "projects", "cryoflow");

const NAME_B_MOTION = "Motion Correction 2 (t922)";
const NAME_B_CTF = "CTF Estimation 2 (t922)";
const NAME_IMPORT_MOVIES = "Import Movies (t922)";
const MOCK_MICS = path.join(process.cwd(), "services", "mock-cluster", "fs", "data2", "micrographs");

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim(); }
  catch (e) { return `ERR:${String(e.message).slice(0, 300)}`; }
};
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  const out = sh(cmd);
  try { return JSON.parse(out); } catch { return { error: out.slice(0, 200) }; }
};

const jobs = () => api("GET", "/api/jobs").jobs ?? [];
const edges = () => api("GET", "/api/edges").edges ?? [];
const findName = (n) => jobs().find((j) => j.name === n);

async function pollUntil(jobId, timeoutMs = 300_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}

/** t921 — the Mock Cluster resolves BY NAME (create-if-missing); the run
 *  lane carries the remote body EXPLICITLY (a fresh world has no binding;
 *  a bare POST takes the LOCAL lane and dies at the input gate). */
function mockClusterConn() {
  const conns = api("GET", "/api/remote/connections").connections ?? [];
  let conn = conns.find((c) => c.name === "Mock Cluster");
  if (conn) return conn;
  const mk = api("POST", "/api/remote/connections", {
    name: "Mock Cluster",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: "/projects/cryoflow",
    useSlurm: true,
    defaultModule: "relion/5.0.1",
  });
  return mk.connection ?? mk.job ?? null;
}

let REMOTE_BODY = null;
const runJob = (id) => api("POST", `/api/jobs/${id}/run`, REMOTE_BODY);

/** the stub's row laws, mirrored here so the mint MEASURES the mock, not
 *  its author's memory (the t915 lesson). */
const motionRowA = (k) => ({ total: 2.2 + 0.3 * (k % 4), early: (2.2 + 0.3 * (k % 4)) * 0.6 });
const motionRowB = (k) => {
  const total = Math.max(0.2, (2.2 + 0.3 * (k % 4)) + (300 - 150) * 0.01 * ((k % 2) * 2 - 1));
  const early = total * Math.min(0.85, Math.max(0.3, 0.6 + 0.05 * (2.0 - 1.28)));
  return { total, early };
};
const ctfRowA = (k) => ({
  // the /ctf route speaks µm (parseCtfStar converts the star's Å)
  u: (5000 + (50000 - 5000) * (0.12 + 0.04 * (k % 5))) / 10000,
  fom: 0.07 + 0.004 * (k % 4),
});
const ctfRowB = (k) => ({
  u: (8000 + (30000 - 8000) * (0.12 + 0.04 * (k % 5))) / 10000,
  fom: 0.07 + 0.004 * (k % 4) + 0.002 * (((k % 2) * 2 - 1) * (5.0 - 4.0)),
});

/** rows joined by the PARSER's own normalization: basename of the star's
 *  mic name (compare-rows.ts speaks basename — the join the dialog eats). */
const byBase = (rows) => {
  const m = new Map();
  for (const r of rows) m.set(String(r.name).split("/").pop(), r);
  return m;
};

function verifyDeltas(tag) {
  const mcA = findName("Motion Correction 1");
  const mcB = findName(NAME_B_MOTION);
  const ctfA = findName("CTF Estimation 1");
  const ctfB = findName(NAME_B_CTF);
  if (!(mcA && mcB && ctfA && ctfB)) {
    ok(`${tag} the four runs exist`, false, "missing a run");
    return { regressors: [], fomImproved: [] };
  }

  const ma = api("GET", `/api/jobs/${mcA.id}/motion`);
  const mb = api("GET", `/api/jobs/${mcB.id}/motion`);
  const ra = byBase(ma.micrographs ?? []);
  const rb = byBase(mb.micrographs ?? []);
  ok(`${tag} motion A holds 6 rows`, (ma.micrographs ?? []).length === 6, String((ma.micrographs ?? []).length));
  ok(`${tag} motion B holds 6 rows`, (mb.micrographs ?? []).length === 6, String((mb.micrographs ?? []).length));
  let motOK = 0;
  for (let k = 0; k < 6; k++) {
    const name = `mic_00${k + 1}.mrc`;
    const a = ra.get(name), b = rb.get(name);
    if (!a || !b) { ok(`${tag} motion row ${name} paired`, false); continue; }
    const wantB = motionRowB(k), wantA = motionRowA(k);
    const gotTotal = Math.abs(b.total - wantB.total) < 0.011 && Math.abs(a.total - wantA.total) < 0.011;
    const gotEarly = Math.abs(b.early - wantB.early) < 0.011 && Math.abs(a.early - wantA.early) < 0.011;
    const moved = Math.abs(b.total - a.total) > 0.5;
    if (gotTotal && gotEarly && moved) motOK++;
  }
  ok(`${tag} motion rows speak BOTH stub laws (defaults + b300/dose2) on all 6`, motOK === 6, `${motOK}/6`);
  const regressors = [...ra.keys()].filter((n) => (rb.get(n)?.total ?? 0) - (ra.get(n)?.total ?? 0) > 0).sort();
  ok(`${tag} motion verdict shape 3 regressed / 3 improved`, regressors.length === 3, regressors.join(","));

  const ca = api("GET", `/api/jobs/${ctfA.id}/ctf`);
  const cb2 = api("GET", `/api/jobs/${ctfB.id}/ctf`);
  const cra = byBase(ca.micrographs ?? []);
  const crb = byBase(cb2.micrographs ?? []);
  ok(`${tag} ctf A holds 6 rows`, (ca.micrographs ?? []).length === 6, String((ca.micrographs ?? []).length));
  ok(`${tag} ctf B holds 6 rows`, (cb2.micrographs ?? []).length === 6, String((cb2.micrographs ?? []).length));
  let ctfOK = 0;
  for (let k = 0; k < 6; k++) {
    const name = `mic_00${k + 1}.mrc`;
    const a = cra.get(name), b = crb.get(name);
    if (!a || !b) { ok(`${tag} ctf row ${name} paired`, false); continue; }
    const wantB = ctfRowB(k), wantA = ctfRowA(k);
    const gotU = Math.abs(b.defocusU - wantB.u) < 5e-4 && Math.abs(a.defocusU - wantA.u) < 5e-4;
    const gotFom = Math.abs(b.fom - wantB.fom) < 0.0006 && Math.abs(a.fom - wantA.fom) < 0.0006;
    const inWindow = b.defocusU >= 0.8 && b.defocusU <= 3.0;
    const moved = Math.abs(b.defocusU - a.defocusU) > 0.01;
    if (gotU && gotFom && inWindow && moved) ctfOK++;
  }
  ok(`${tag} ctf rows speak BOTH stub laws (window + ResMax fom) on all 6`, ctfOK === 6, `${ctfOK}/6`);
  const fomImproved = [...cra.keys()].filter((n) => (crb.get(n)?.fom ?? 0) - (cra.get(n)?.fom ?? 0) > 0).sort();
  ok(`${tag} ctf FOM verdict shape 3 improved / 3 regressed`, fomImproved.length === 3, fomImproved.join(","));
  return { regressors, fomImproved };
}

/* ------------------------------------------------------------------ */
/* mint                                                                */
/* ------------------------------------------------------------------ */
async function mint() {
  console.log("== t922 mint ==");
  ok("guard: server answers", jobs().length > 0, `${jobs().length} jobs`);
  const stale = [...jobs()].filter((j) => (j.name ?? "").includes("t922") && !["import", "motioncorr", "ctffind"].includes(j.type));
  ok("guard: no stale t922 mints (this mint's own vocabulary re-rides idempotently)", stale.length === 0, stale.length ? stale.map((j) => j.name).join(",") : "clean");
  const mcA = findName("Motion Correction 1");
  const ctfA = findName("CTF Estimation 1");
  const imp = findName("Import Movies 1");
  ok("guard: seed trio present", !!(mcA && ctfA && imp), `${imp?.name} → ${mcA?.name} → ${ctfA?.name}`);

  const conn = mockClusterConn();
  ok("mock cluster resolved by name", !!conn?.id, conn?.id ?? "missing");
  REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };

  const seedEdgeImp = edges().find((e) => e.fromJobId === imp.id && e.toJobId === mcA.id);
  const seedEdgeCtf = edges().find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
  ok("seed edge MC-A→CTF-A present", !!seedEdgeCtf, seedEdgeCtf?.id ?? "missing");
  ok("seed edge import→MC-A present-or-already-lifted (idempotent re-ride)",
    !!seedEdgeImp || !!(seedEdgeImp ?? edges().find((e) => e.fromJobId === findName(NAME_IMPORT_MOVIES)?.id && e.toJobId === mcA.id)) || findName(NAME_IMPORT_MOVIES) != null,
    seedEdgeImp?.id ?? "lifted by a prior ride");

  // 0. the MOVIES import (the motioncorr feed law) — engine-native, local.
  //    Idempotent: a prior ride's import is reused (its name is unique).
  let imJob = findName(NAME_IMPORT_MOVIES);
  if (!imJob) {
    const im = api("POST", "/api/jobs", {
      type: "import", name: NAME_IMPORT_MOVIES,
      params: { nodeType: "movies", micrographsPath: MOCK_MICS },
    });
    ok("movies import minted", !im.error && !!im.job?.id, im.error ?? im.job?.id);
    imJob = im.job;
  } else {
    ok("movies import already aboard (idempotent re-ride)", true, imJob.id);
  }
  if (imJob.status === "idle" || imJob.status === "failed") {
    const rIm = api("POST", `/api/jobs/${imJob.id}/run`);
    ok("movies import run accepted (engine-native = local by design)", !rIm.error, rIm.error ?? "");
  }
  const imDone = await pollUntil(imJob.id);
  ok("movies import completed", imDone.status === "completed", imDone.status);

  // 0b. WRONG-PROVIDER SWEEP — the first ride's residue (the seed's
  //     micrographs import wired into MC-A/MC-B) would give the motioncorr
  //     input TWO providers and the lineage BFS could pick the star the
  //     movies gate refuses. Every edge INTO the motion pair from anything
  //     that is not IMP-M comes off (the seed edges are already recorded).
  for (const e of edges()) {
    if ([mcA.id, findName(NAME_B_MOTION)?.id].filter(Boolean).includes(e.toJobId) && e.fromJobId !== imJob.id) {
      const d = api("DELETE", `/api/edges/${e.id}`);
      ok(`wrong-provider edge ${e.id.slice(0, 8)} lifted`, !d.error, d.error ?? "off");
    }
  }

  // 1. run A — re-fed by the movies import (the seed's micrographs edge
  //    comes OFF for the ride; remove puts it back)
  if (seedEdgeImp && edges().some((e) => e.id === seedEdgeImp.id)) {
    const offSeed = api("DELETE", `/api/edges/${seedEdgeImp.id}`);
    ok("seed edge import→MC-A lifted for the ride", !offSeed.error, offSeed.error ?? "off");
  }
  const liveA = edges().find((e) => e.fromJobId === imJob.id && e.toJobId === mcA.id);
  const eA = liveA ?? api("POST", "/api/edges", { fromJobId: imJob.id, toJobId: mcA.id });
  ok("edge IMP-M→MC-A", !!eA.edge?.id || !!liveA, eA.error ?? eA.edge?.id ?? liveA?.id);
  let r = runJob(mcA.id);
  ok("MC-A run accepted (remote lane)", !r.error, r.error ?? r.job?.status ?? "");
  let done = await pollUntil(mcA.id);
  ok("MC-A completed", done.status === "completed", done.status);

  r = runJob(ctfA.id);
  ok("CTF-A run accepted (remote lane)", !r.error, r.error ?? r.job?.status ?? "");
  done = await pollUntil(ctfA.id);
  ok("CTF-A completed", done.status === "completed", done.status);

  // 2. mint B — motion (bfactor 300, dose 2.0), fed by the movies import
  let mbJob = findName(NAME_B_MOTION);
  if (!mbJob) {
    const mb = api("POST", "/api/jobs", {
      type: "motioncorr", name: NAME_B_MOTION,
      params: { bfactor: 300, dosePerFrame: 2.0, patchX: 5, patchY: 5 },
    });
    ok("MC-B minted", !mb.error && !!mb.job?.id, mb.error ?? mb.job?.id);
    mbJob = mb.job;
  } else {
    ok("MC-B already aboard (idempotent re-ride)", true, mbJob.id);
  }
  const liveMb = edges().find((e) => e.fromJobId === imJob.id && e.toJobId === mbJob.id);
  const eMb = liveMb ?? api("POST", "/api/edges", { fromJobId: imJob.id, toJobId: mbJob.id });
  ok("edge IMP-M→MC-B", !!eMb.edge?.id || !!liveMb, eMb.error ?? eMb.edge?.id ?? liveMb?.id);
  r = runJob(mbJob.id);
  ok("MC-B run accepted (remote lane)", !r.error, r.error ?? r.job?.status ?? "");
  done = await pollUntil(mbJob.id);
  ok("MC-B completed", done.status === "completed", done.status);

  // 3. mint B — ctf (window 8000..30000, ResMax 4), fed by MC-B
  let cbJob = findName(NAME_B_CTF);
  if (!cbJob) {
    const cb = api("POST", "/api/jobs", {
      type: "ctffind", name: NAME_B_CTF,
      params: { box: 512, resMin: 30, resMax: 4, dFMin: 8000, dFMax: 30000, fitAstig: true },
    });
    ok("CTF-B minted", !cb.error && !!cb.job?.id, cb.error ?? cb.job?.id);
    cbJob = cb.job;
  } else {
    ok("CTF-B already aboard (idempotent re-ride)", true, cbJob.id);
  }
  const liveCb = edges().find((e) => e.fromJobId === mbJob.id && e.toJobId === cbJob.id);
  const eCb = liveCb ?? api("POST", "/api/edges", { fromJobId: mbJob.id, toJobId: cbJob.id });
  ok("edge MC-B→CTF-B", !!eCb.edge?.id || !!liveCb, eCb.error ?? eCb.edge?.id ?? liveCb?.id);
  r = runJob(cbJob.id);
  ok("CTF-B run accepted (remote lane)", !r.error, r.error ?? r.job?.status ?? "");
  done = await pollUntil(cbJob.id);
  ok("CTF-B completed", done.status === "completed", done.status);

  // 4. the deltas the dialog will eat
  const deltas = verifyDeltas("mint:");

  // 5. workdirs for the remove's sweep
  const workdirs = {};
  for (const j of [mbJob, cbJob]) {
    const outs = api("GET", `/api/jobs/${j.id}/outputs`);
    workdirs[j.id] = outs.workdir ?? null;
  }
  ok("workdirs recorded", Object.values(workdirs).every(Boolean), Object.values(workdirs).map((w) => String(w).replace(process.cwd() + "/", "")).join(" · "));

  const finalSeedImp = edges().find((e) => e.fromJobId === imp.id && e.toJobId === mcA.id);
  writeFileSync(MANIFEST, JSON.stringify({
    task: "t922", createdAt: new Date().toISOString(),
    seedEdgeImp_MCA: seedEdgeImp?.id ?? null,
    seedEdgeMCA_CTF: seedEdgeCtf?.id ?? null,
    moviesImport: imJob.id,
    mcA: mcA.id, ctfA: ctfA.id,
    minted: [imJob.id, mbJob.id, cbJob.id],
    rideEdges: [eA.edge?.id ?? liveA?.id, eMb.edge?.id ?? liveMb?.id, eCb.edge?.id ?? liveCb?.id].filter(Boolean),
    names: { impM: NAME_IMPORT_MOVIES, mcB: NAME_B_MOTION, ctfB: NAME_B_CTF },
    workdirs,
    expected: { motionRegressors: deltas.regressors, ctfFomImproved: deltas.fomImproved },
  }, null, 2));
  ok("manifest written", existsSync(MANIFEST), path.relative(process.cwd(), MANIFEST));
  ok("seed micrographs edge stays off the motioncorr feed (rides on IMP-M)", !finalSeedImp, finalSeedImp ? "STILL PRESENT" : "off");

  console.log(`MINT ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------------ */
/* verify                                                              */
/* ------------------------------------------------------------------ */
async function verify() {
  console.log("== t922 verify ==");
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const mcA = findName("Motion Correction 1");
  const ctfA = findName("CTF Estimation 1");
  const mcB = findName(m.names.mcB);
  const ctfB = findName(m.names.ctfB);
  ok("world holds the four runs", !!(mcA && ctfA && mcB && ctfB));
  ok("all four completed", [mcA, ctfA, mcB, ctfB].every((j) => j?.status === "completed"),
    [mcA, ctfA, mcB, ctfB].map((j) => j?.status).join("/"));
  verifyDeltas("verify:");
  console.log(`VERIFY ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ------------------------------------------------------------------ */
/* remove                                                              */
/* ------------------------------------------------------------------ */
function remove() {
  console.log("== t922 remove ==");
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const mcA = findName("Motion Correction 1");
  const ctfA = findName("CTF Estimation 1");

  // 1. the fire's re-wire: filter→CTF-A edge off, the ORIGINAL edge back
  //    (idempotent when the fire never happened)
  const liveEdges0 = edges();
  const rewire = liveEdges0.find((e) => e.toJobId === ctfA.id && e.fromJobId !== mcA.id);
  if (rewire) {
    const d = api("DELETE", `/api/edges/${rewire.id}`);
    ok("fire's re-wire edge deleted", !d.error, rewire.id);
  } else {
    ok("no fire re-wire to undo (idempotent)", true);
  }
  const seedBack = edges().find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
  if (!seedBack && m.seedEdgeMCA_CTF) {
    // t920 — the POST accepts a UUID-shaped client id (the t359 gate); the
    // SEED's cuid is honestly ignored and a fresh id minted — the WIRING is
    // the identity here, so send the original id and accept either outcome.
    const p = api("POST", "/api/edges", { id: m.seedEdgeMCA_CTF, fromJobId: mcA.id, toJobId: ctfA.id });
    ok("original MC-A→CTF-A edge restored", !p.error && !!p.edge?.id, p.error ?? p.edge?.id);
  } else if (seedBack) {
    ok("original MC-A→CTF-A edge wiring in place (id per the t359 UUID gate)", true, seedBack.id);
  }

  // 2. the minted jobs, downstream-first (edges cascade via Prisma);
  //    movies import LAST — its death must not orphan the sweep checks
  const order = [...m.minted].reverse();
  for (const id of order) {
    const d = api("DELETE", `/api/jobs/${id}`);
    const gone = !d.error || String(d.error).includes("not found");
    ok(`minted job ${id.slice(0, 8)} deleted`, gone, d.error ?? "gone");
  }

  // 3. the filter the FIRE minted (any excludemg left behind)
  const filters = jobs().filter((j) => j.type === "excludemg");
  for (const f of filters) {
    const d = api("DELETE", `/api/jobs/${f.id}`);
    ok(`fire's filter ${f.name} deleted`, !d.error, d.error ?? "gone");
  }
  ok("no excludemg residue", jobs().every((j) => j.type !== "excludemg"));

  // 4. MC-A's seed feed edge home (the movies import is gone by now).
  //    The ORIGINAL id may be unrecoverable (a prior ride lifted it before
  //    any manifest could record it) — the WIRING is the identity here; a
  //    fresh id is the honest fallback (the t920 id law rides where the id
  //    still exists).
  {
    const seedImp = jobs().find((j) => j.name === "Import Movies 1");
    const back = seedImp && edges().find((e) => e.fromJobId === seedImp.id && e.toJobId === mcA.id);
    if (back) {
      ok("import→MC-A edge already in place", true, back.id);
    } else if (seedImp) {
      const body = m.seedEdgeImp_MCA ? { id: m.seedEdgeImp_MCA, fromJobId: seedImp.id, toJobId: mcA.id } : { fromJobId: seedImp.id, toJobId: mcA.id };
      const p = api("POST", "/api/edges", body);
      ok("import→MC-A edge restored", !p.error && !!p.edge?.id, p.error ?? p.edge?.id);
    } else {
      ok("seed import job present for the edge restore", false, "Import Movies 1 missing");
    }
  }

  // 5. workdir sweep — local + mock side (t916's law, both legs)
  for (const [id, wd] of Object.entries(m.workdirs ?? {})) {
    if (wd && existsSync(wd)) { rmSync(wd, { recursive: true, force: true }); ok("local workdir swept", !existsSync(wd), String(wd).replace(process.cwd() + "/", "")); }
    else ok("local workdir already gone", true, id.slice(0, 8));
    const suffix = id.slice(-8);
    try {
      for (const fam of readdirSync(MOCK_PROJECTS)) {
        const famDir = path.join(MOCK_PROJECTS, fam);
        for (const jobDir of readdirSync(famDir)) {
          if (jobDir.includes(suffix)) { rmSync(path.join(famDir, jobDir), { recursive: true, force: true }); ok("mock-side workdir swept", true, `${fam}/${jobDir}`); }
        }
      }
    } catch { ok("mock-side sweep skipped (no mock projects dir)", true); }
  }

  // 6. the world's shape
  const all = jobs();
  ok("world back to the seed trio", all.length === 3, `${all.length} jobs: ${all.map((j) => j.type).join(",")}`);
  const liveEdges2 = edges();
  ok("world holds exactly 2 edges", liveEdges2.length === 2, liveEdges2.map((e) => `${e.fromJobId.slice(0, 6)}→${e.toJobId.slice(0, 6)}`).join(" · "));
  ok("original CTF edge wiring home + import edge wiring home",
    liveEdges2.some((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id) && liveEdges2.some((e) => e.toJobId === mcA.id),
    "wiring is the identity (the t359 UUID gate mints fresh ids for cuid seeds)");
  ok("A runs completed (the world's honest evolution)", mcA.status === "completed" && ctfA.status === "completed", `${mcA.status}/${ctfA.status}`);

  console.log(`REMOVE ${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

const verb = process.argv[2];
if (verb === "mint") await mint();
else if (verb === "verify") await verify();
else if (verb === "remove") remove();
else { console.error("usage: node scripts/t922-mint.mjs mint|verify|remove"); process.exit(2); }
