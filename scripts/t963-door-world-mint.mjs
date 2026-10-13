#!/usr/bin/env node
/**
 * t963 — the DEEP-BAND DOOR's world mint (mint|verify|remove): the lightest
 * honest world that mounts the t956 deep-band door (the "Show 300 more from
 * the cluster ledger" affordance under the Files tab's table).
 *
 * WHAT THE DOOR NEEDS (the t956 law, read from joinRemotePage):
 *   a run record with `remote` + a local `.cf-remote-manifest.json` whose
 *   remote-only sequence (paths the local walk does not hold) EXCEEDS the
 *   300-card page budget. That is all — the 20,000-entry capped ledger of
 *   the t944 arc is a DIFFERENT face (finalize-time honesty, already
 *   witnessed); the door itself mounts on any ledger deeper than one page.
 *   So this mint writes the finalize's PRODUCT (the ledger) directly — the
 *   same修辞 as the t944 sparse pads: a账面 fact, honest about what it is,
 *   so the browser can witness the DOOR's behavior (mount / append / merged
 *   counts / collapse) without re-running the finalize leg t944 already
 *   certified.
 *
 * THE WORLD (all numbers the verify band re-derives from the API, never
 * remembered):
 *   job        "Remote Ledger Door (t963)" — motioncorr, x=1960 y=40
 *   workdir    data/relion/<projectId>/motioncorr_<id tail8>/
 *              run.out + run.err + corrected_micrographs.star (3 local cards)
 *   manifest   653 entries = the 3 local paths + 650 remote-only
 *              micrographs/Falcon_2012_06_12-<hh>_<mm>_<ss>_<i>.mrc
 *   run record done:true exitCode:0, a remote block copied from the
 *              standing world's own Mock Cluster finalize (connectionId
 *              conn-mv6a23lx), skippedFiles naming all 650 (the
 *              sync-metadata-only motioncorr semantics, verbatim tone)
 *
 * THE FIVE ACTS the verify band pins (API plane; the browser witness pins
 * the same five on the UI plane):
 *   act1  offset 0 (default)  → files 303 (3 local + 300 remote), next 300
 *   act2  offset 300          → files 303 (3 local + the NEXT 300), next 600
 *   act3  offset 600          → files 53  (3 local + the last 50), next NULL
 *                               (the exact-remainder honesty — no phantom page)
 *   act4  offset "garbage"    → clamps to 0 (the t956 paged-200 law)
 *   act5  offset 99999        → the empty, door-less page (3 local, next null)
 *
 *   node scripts/t963-door-world-mint.mjs mint|verify|remove
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const NAME = "Remote Ledger Door (t963)";
const REMOTE_TOTAL = 650;
const PAGE = 300;
const PROJECT_ID = "cmv6a1bda0000tzx5uaqra5le"; // the standing world (the doctor's ACTIVE)
const STATE_FILE = path.join(process.cwd(), "data", "engine-state.json");
const DATA_ROOT = path.join(process.cwd(), "data", "relion", PROJECT_ID);
const SIZE_PAD = 1049600;

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) { pass += 1; console.log(`ok ${pass} — ${label}${detail ? ` (${detail})` : ""}`); }
  else { fail += 1; console.log(`FAIL ${fail} — ${label}${detail ? ` (${detail})` : ""}`); }
};

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 60_000 }); } catch (e) { return String(e?.stdout ?? e); }
};
const api = (method, url, body) => {
  const out = execSync(
    `curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`,
    { encoding: "utf8", timeout: 60_000 }
  );
  try { return JSON.parse(out); } catch { return { raw: out }; }
};

const jobByName = () => {
  const body = api("GET", "/api/jobs");
  const arr = Array.isArray(body) ? body : body.jobs ?? [];
  return arr.find((j) => j.name === NAME) ?? null;
};
const workdirOf = (jobId) => path.join(DATA_ROOT, `motioncorr_${jobId.slice(-8)}`);

const ledgerEntries = () => {
  const entries = [
    { path: "corrected_micrographs.star", size: 997 },
    { path: "run.out", size: 1280 },
    { path: "run.err", size: 0 },
  ];
  for (let i = 1; i <= REMOTE_TOTAL; i++) {
    const hh = String(8 + Math.floor(i / 3600) % 14).padStart(2, "0");
    const mm = String(Math.floor(i / 60) % 60).padStart(2, "0");
    const ss = String(i % 60).padStart(2, "0");
    const idx = String(i).padStart(2, "0");
    entries.push({ path: `micrographs/Falcon_2012_06_12-${hh}_${mm}_${ss}_${idx}.mrc`, size: SIZE_PAD });
  }
  return entries;
};

const writeRunRecord = (jobId, workdir) => {
  const skipped = ledgerEntries().slice(3).map(
    (e) => `${e.path} (image data — this job type syncs metadata only)`
  );
  const record = {
    jobId,
    projectId: PROJECT_ID,
    type: "motioncorr",
    pid: null,
    cmd: "relion_motioncorr --i Movies/*.motiontrk --o . --j 6 --pile_mot 6  # t963 door-world mint",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date(Date.now() - 3723_000).toISOString(),
    outputs: {},
    done: true,
    exitCode: 0,
    result:
      "REMOTE[cryo@localhost · relion/5.0.1]: motion corrected, 650 micrographs — 650 image file(s) stayed on the cluster — motioncorr jobs sync metadata only under the key-files policy (STAR, logs and plots come home; image stacks never do, whatever their size). They are listed in this job's Results — open or download one to fetch it on demand — or switch the connection's sync policy to \"everything\" to bring them home",
    remote: {
      connectionId: "conn-mv6a23lx",
      connectionName: "Mock Cluster",
      host: "localhost:3022",
      user: "cryo",
      module: "relion/5.0.1",
      mode: "slurm",
      remoteRoot: "/projects/cryoflow",
      remoteWorkdir: `/projects/cryoflow/${PROJECT_ID}/motioncorr_${jobId.slice(-8)}`,
      pid: null,
      slurmId: "2",
      gpusRequested: 6,
      phase: "running",
      slurmState: "COMPLETED",
      dispatchedAtEpoch: Math.floor(Date.now() / 1000) - 3700,
      stagedBytes: 671099640,
      stagedMs: 6300,
      slurmElapsedMs: 11000,
      syncedFiles: 3,
      syncedBytes: 2277,
      skippedFiles: skipped,
      note: "the t963 door-world mint: the ledger's finalize product, written honest so the deep-band door has a world to mount in",
    },
  };
  const raw = readFileSync(STATE_FILE, "utf8");
  const runs = JSON.parse(raw);
  runs[jobId] = record;
  const tmp = `${STATE_FILE}.t963.tmp`;
  writeFileSync(tmp, JSON.stringify(runs, null, 2));
  // rename defeats the reader's half-written read; the server's mtime/size
  // cache key re-reads on the next poll
  execSync(`mv "${tmp}" "${STATE_FILE}"`);
  return record;
};

/* ---------------------------------------------------------------- mint */
const stage = process.argv[2] ?? "mint";

if (stage === "mint") {
  console.log("== t963 door-world mint ==");
  const probe = sh(`curl -s -o /dev/null -w "%{http_code}" ${ORIGIN} "${BASE}/api/jobs" --max-time 8`);
  if (probe !== "200") {
    console.log(`FATAL: the server did not answer 200 (${probe}) — the lane must be alive to mint`);
    process.exit(2);
  }

  let job = jobByName();
  if (job) {
    console.log(`(the door-world job already exists: ${job.id} — reusing)`);
  } else {
    const made = api("POST", "/api/jobs", { type: "motioncorr", name: NAME, x: 1960, y: 40 });
    job = made?.job ?? made;
    if (!job?.id) {
      console.log(`FATAL: job creation refused: ${JSON.stringify(made).slice(0, 300)}`);
      process.exit(2);
    }
    console.log(`job minted: ${job.id}`);
  }

  const workdir = workdirOf(job.id);
  mkdirSync(path.join(workdir, "micrographs"), { recursive: true });
  writeFileSync(
    path.join(workdir, "run.out"),
    [
      "RELION motioncorr (t963 door-world mint)",
      "  mock cluster: slurm job 2 · relion/5.0.1 · 6 GPUs",
      "  650 micrographs motion corrected on the cluster;",
      "  metadata synced home, image stacks stay (key-files policy).",
      "done.",
      "",
    ].join("\n")
  );
  writeFileSync(path.join(workdir, "run.err"), "");
  writeFileSync(
    path.join(workdir, "corrected_micrographs.star"),
    [
      "data_",
      "",
      "loop_",
      "_rlnMicrographName #1",
      "micrographs/Falcon_2012_06_12-08_00_01_01.mrc",
      "micrographs/Falcon_2012_06_12-08_00_02_02.mrc",
      "",
    ].join("\n")
  );
  writeFileSync(
    path.join(workdir, ".cf-remote-manifest.json"),
    JSON.stringify({ truncated: false, files: ledgerEntries() }, null, 1)
  );

  const record = writeRunRecord(job.id, workdir);
  console.log(`workdir + ledger + run record written: ${workdir}`);

  // the face: done:true records are OWNED by the remote sweep's orphan
  // heal — but that heal only touches running/pending rows (the status
  // guard keeps a live user re-run safe), and an IDLE row is ignored
  // entirely. So the finalize's row-flip is minted directly here — the
  // same words the orphan heal would speak (exitCode 0 → completed +
  // the record's own result sentence). spawnSync with an argv ARRAY and
  // an env-carried result: no shell, no quoting hell (the sentence
  // contains an apostrophe — the inline `node -e` died on it first ride).
  const flip = spawnSync(
    "node",
    [
      "-e",
      `const { PrismaClient } = require("@prisma/client");
       const db = new PrismaClient();
       db.job.update({
         where: { id: process.argv[1] },
         data: { status: "completed", progress: 100, result: process.env.T963_RESULT },
       }).then(() => db.$disconnect()).catch((e) => { console.error(String(e)); process.exit(1); });`,
      job.id,
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${process.cwd()}/db/cryoflow.db`, T963_RESULT: record.result },
      encoding: "utf8",
      timeout: 30_000,
    }
  );
  if (flip.status !== 0) {
    console.log(`FATAL: the row flip failed: ${(flip.stderr ?? "").slice(0, 300)}`);
    process.exit(2);
  }

  // the reconcile sweep flips status on the next jobs GET — ask twice
  let status = "";
  for (let i = 0; i < 10; i++) {
    status = jobByName()?.status ?? "";
    if (status === "completed") break;
    execSync("sleep 1");
  }
  ok(status === "completed", "the job's face is COMPLETED (the minted row-flip)", `status=${status}`);

  const man = JSON.parse(readFileSync(path.join(workdir, ".cf-remote-manifest.json"), "utf8"));
  ok(man.files.length === 653, "the ledger holds 653 entries (3 local + 650 remote-only)", `got ${man.files.length}`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* -------------------------------------------------------------- verify */
if (stage === "verify") {
  console.log("== t963 door-world verify ==");
  const job = jobByName();
  ok(!!job, "the door-world job exists", job ? job.id : "missing");
  if (!job) process.exit(1);
  ok(job.status === "completed", "the job's face is COMPLETED", job.status);

  const workdir = workdirOf(job.id);
  ok(existsSync(path.join(workdir, ".cf-remote-manifest.json")), "the ledger exists in the workdir", workdir);
  ok(existsSync(STATE_FILE) && Boolean(JSON.parse(readFileSync(STATE_FILE, "utf8"))[job.id]), "the run record stands in engine-state", job.id);

  const outputs = (q) => api("GET", `/api/jobs/${job.id}/outputs${q}`);
  // act1 — the standing face: 303 cards, the door speaks 300
  const a1 = outputs("");
  ok(a1.status === "ok" && a1.files?.length === 303, "act1 the standing page: 303 files (3 local + 300 remote)", `files=${a1.files?.length} status=${a1.status}`);
  ok(a1.remoteNextOffset === 300, "act1 the door speaks the next offset (300)", `next=${a1.remoteNextOffset}`);
  ok(typeof a1.note === "string" && /truncat/i.test(a1.note), "act1 the listing note speaks the truncation", a1.note?.slice(0, 90));
  // act2 — one door ride deeper: the NEXT 300, paths disjoint from act1
  const a2 = outputs("?remoteOffset=300");
  const a1Remote = new Set((a1.files ?? []).filter((f) => f.remote).map((f) => f.path));
  const a2Fresh = (a2.files ?? []).filter((f) => f.remote && !a1Remote.has(f.path));
  ok(a2.files?.length === 303 && a2Fresh.length === 300, "act2 the deep page: 303 files, 300 fresh remote cards", `files=${a2.files?.length} fresh=${a2Fresh.length}`);
  ok(a2.remoteNextOffset === 600, "act2 the door moves to 600", `next=${a2.remoteNextOffset}`);
  // act3 — the exact-remainder honesty: the last 50, then NO door
  const a3 = outputs("?remoteOffset=600");
  ok(a3.files?.length === 53 && a3.remoteNextOffset == null, "act3 the exact remainder: 53 files, the door collapses (null)", `files=${a3.files?.length} next=${a3.remoteNextOffset}`);
  // act4 — garbage clamps (the t956 paged-200 law)
  const a4 = outputs("?remoteOffset=garbage");
  ok(a4.files?.length === 303 && a4.remoteNextOffset === 300, "act4 garbage clamps to the standing face", `files=${a4.files?.length} next=${a4.remoteNextOffset}`);
  // act5 — past the ledger's end: the empty, door-less page
  const a5 = outputs("?remoteOffset=99999");
  ok(a5.files?.length === 3 && a5.remoteNextOffset == null, "act5 past the end: the door-less page (local only)", `files=${a5.files?.length} next=${a5.remoteNextOffset}`);

  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* -------------------------------------------------------------- remove */
if (stage === "remove") {
  console.log("== t963 door-world remove ==");
  const job = jobByName();
  if (job) {
    const del = api("DELETE", `/api/jobs/${job.id}`);
    ok(del?.error === undefined || del?.ok === true, `job deleted (${job.id})`, JSON.stringify(del).slice(0, 120));
  } else {
    ok(true, "no door-world job (already removed)");
  }
  // any leftover workdirs (the DELETE clears the run record; the dir is ours)
  if (existsSync(DATA_ROOT)) {
    for (const dir of execSync(`ls "${DATA_ROOT}"`, { encoding: "utf8" }).trim().split("\n")) {
      if (dir.startsWith("motioncorr_")) {
        const wd = path.join(DATA_ROOT, dir);
        const rec = (() => { try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return {}; } })();
        const orphan = !Object.values(rec).some((r) => r.workdir === wd);
        if (orphan && /_t963|motioncorr_(?!.*19v74euz)/.test(dir) && statSync(wd).isDirectory()) {
          const hasLedger = existsSync(path.join(wd, ".cf-remote-manifest.json"));
          if (hasLedger && dir !== `motioncorr_19v74euz`) {
            rmSync(wd, { recursive: true, force: true });
            console.log(`  workdir removed: ${dir}`);
          }
        }
      }
    }
  }
  console.log(`== remove ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

console.log("usage: node scripts/t963-door-world-mint.mjs mint|verify|remove");
process.exit(2);
