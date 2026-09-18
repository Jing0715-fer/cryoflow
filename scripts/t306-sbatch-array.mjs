/**
 * t306 — the array split joins the remote dispatch: ONE sbatch carrying
 * `--array=1-N%M` for the data-parallel per-micrograph types.
 *
 * The story: the HPC dialog has had an array-mode script GENERATOR for a
 * long time (hpc/slurm.ts slices the star with awk, the queue simulator
 * places array elements) — but the REAL dispatch path never spoke the
 * directive. A 10,000-micrograph MotionCorr on the cluster ran as one
 * monolithic job on one node while the scheduler's own array grammar sat
 * there unused.
 *
 * t306 closes it, end to end:
 *   - the dispatch accepts target.shards (2..64, slurm mode, eligible
 *     types only — motioncorr/ctffind today: their argv takes ONE --i star
 *     and points --o at the workdir, so shards are honest);
 *   - the submitted script carries `#SBATCH --array=1-N%M`; each task
 *     slices the input STAR round-robin by SLURM_ARRAY_TASK_ID (structure
 *     lines — data_/loop_/column defs — pass through whole, only the
 *     data-block rows rotate), runs the shard in its OWN output subdir,
 *     and appends its rc to a per-submission tally file;
 *   - the LAST task home (the count gate — nobody else knows who is last)
 *     merges the shard output stars into the canonical file collectOutputs
 *     expects and writes .cf-exit: 0 only when every rc was 0;
 *   - the EXIT trap stands down for array tasks (one shard's failure must
 *     not speak the verdict while its siblings still run); the TERM/INT
 *     trap keeps writing 143 (a scancel hits all tasks, first writer wins);
 *   - the MOCK grew the same teeth: sbatch parses --array=1-N%M, the
 *     launcher fans out N tasks capped at %M (wait -n), journals per-task
 *     rows <id>_<t> (real sacct's array grammar) and a MASTER row whose
 *     verdict is COMPLETED only when every task's rc was 0;
 *   - the record carries slurmArray {total, concurrency}, the projection
 *     lets it ride, and the inspector's strip says "· array 1-N%M" both
 *     live and terminal.
 *
 * Phases:
 *   A   the demo truth (app alive, roster 21, mock listening)
 *   B   the ledger (source assertions: types, route, dispatch, script
 *       builder, mock, strip, dialog)
 *   C   the live loop (all through the REAL run route + REAL sweep):
 *       C1  ctffind with shards=3 → directive in the submitted script,
 *           record names the split, mock runs 3 tasks (per-task rows
 *           witnessed), the merged star has every micrograph, the sweep
 *           finalizes done/exit 0, the strip speaks "array 1-3%4"
 *       C2  the mid-array scancel → the stop route's own 137 verdict on the
 *           record, the scheduler's CANCELLED row, AND the tasks' TERM trap
 *           speaking 143 into .cf-exit — three witnesses, one honest story
 *       C3  the control: no shards → no directive, no slurmArray, and a
 *           script without the array branch's variables
 *       C4  the honest refusal: class2d + shards → refused BEFORE staging
 *           (splitting refine-style jobs in name only would be a lie)
 *   D   console clean + roster restored to 21
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { chromium } from "playwright";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const SHOTS = `${ROOT}/shots-qa`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};
const SHJ = { ...SH, "Content-Type": "application/json" };
const CONN = "qa-t306-array";
const MICS = 12; // 12 micrographs: 4/shard at shards=3, 6/shard at shards=2

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 1500) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  }).stdout?.trim() ?? "";

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};
const writeStateRuns = (runs) => {
  const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  const next = raw.runs ? { ...raw, runs } : runs;
  writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
};

try { execSync("pkill -f agent-browser"); } catch { /* none */ }
await sleep(500);

let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
  for (let i = 0; i < 40 && !(await mockListening()); i++) await sleep(500);
  weLaunchedMock = true;
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

const createdJobs = [];
const sbatchIds = [];
let connOk = false;
let snap0 = null;
let accPre = "NO";
const getJobs = async () =>
  (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs ?? [];

const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  const b = await r.json();
  if (b.job?.id) createdJobs.push(b.job.id);
  return b.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  return r.status;
};

const dispatch = async (jobId, connId, extra = {}) => {
  const r = await fetch(`${BASE}/api/jobs/${jobId}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "slurm", ...extra } }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const journalWord = (id) => {
  try {
    return client(`sacct -j ${id} -n -P -o State,ExitCode`).trim();
  } catch {
    return "";
  }
};
const waitJournal = async (id, want, deadlineMs = 45_000) =>
  pollUntil(() => (journalWord(id).startsWith(want) ? journalWord(id) : null), deadlineMs, 700);

try {
  // ---- Phase A: the demo truth ------------------------------------------------
  console.log("== PHASE A: the demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), "the mock cluster answers on :3022");

  snap0 = readFileSync(STATE_FILE, "utf8");
  try {
    accPre = client('test -f "$HOME/.slurm/accounting" && echo YES || echo NO').trim();
    if (accPre === "YES") client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t306snap"');
  } catch { accPre = "NO"; }

  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t306 Array", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  connOk = mk.status === 201 || mk.status === 200;
  must(connOk, `the probeless connection exists (${mk.status})`);

  // ---- Phase B: the ledger ----------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const tt = readFileSync(`${ROOT}/src/lib/remote/types.ts`, "utf8");
  const sb = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/sbatch`, "utf8");
  const insp = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  const dlg = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");
  const route = readFileSync(`${ROOT}/src/app/api/jobs/[id]/run/route.ts`, "utf8");

  must(
    src.includes('const ARRAY_TYPES: Record<string, string> = {') &&
      src.includes('motioncorr: "corrected_micrographs.star"') &&
      src.includes('ctffind: "micrographs_ctf.star"'),
    "B: the type contract names the canonical output star per eligible type"
  );
  must(
    src.includes("const ARRAY_CONCURRENCY = 4;"),
    "B: the %M cap is ONE honest default (one knob in the dialog, not two)"
  );
  must(
    src.includes("if (shardTotal >= 2 && !ARRAY_TYPES[job.type])") &&
      src.includes("cannot ride an array split"),
    "B: an ineligible type + shards is refused BEFORE staging (never a silently un-split run)"
  );
  must(
    route.includes("const shards = Number.isFinite(shardsNum) && shardsNum >= 2 ? Math.min(64, Math.round(shardsNum)) : 0;") &&
      route.includes('body.remote.mode === "slurm" && shards >= 2 ? { shards } : {}'),
    "B: the route clamps shards 2..64 and drops the field outside slurm mode"
  );
  must(
    (tt.match(/slurmArray\?: \{ total: number; concurrency: number \}/g) ?? []).length === 2 &&
      tt.includes("shards?: number;"),
    "B: the DTO + the engine state carry slurmArray; the target carries shards"
  );
  must(
    src.includes("k === ii + 1 ? '\"$SHARD\"' : k === oi + 1 ? '\"$OSHARD/\"' : shQuote(a)"),
    "B: the argv rewrite swaps --i for the shard slice and --o for the task subdir"
  );
  must(
    src.includes("!inputStar.endsWith(\".star\") || outArg !== remoteWorkdir + \"/\" || !outStar"),
    "B: a rewrite that cannot name its targets throws (never slices the wrong file)"
  );
  must(
    src.includes("`#SBATCH --array=1-${array.total}%${array.concurrency}`"),
    "B: the script carries the directive with the %M cap"
  );
  must(
    src.includes('RCF="${W}/.cf-array-rc-$SLURM_ARRAY_JOB_ID"'),
    "B: the rc tally is named per SUBMISSION (SLURM_ARRAY_JOB_ID — a re-run never reads the old tally)"
  );
  must(
    src.includes("block>=2 && NF>0 && $1 !~ /^#/{ if(idx % n == s-1) print; idx++; next }") &&
      src.includes("/^loop_/{print; next}") && src.includes("/^_/{print; next}"),
    "B: the slicer rotates DATA rows only — structure lines (data_/loop_/columns) pass through whole"
  );
  must(
    src.includes('if [ "${"${__done:-0}"}" -ge ${N} ]; then') &&
      src.includes("__bad=\"$(awk '$2!=0{print $2; exit}' \"$RCF\""),
    "B: the LAST task home (the count gate) merges and speaks the verdict"
  );
  must(
    src.includes('[ -n "${"${"}SLURM_ARRAY_TASK_ID:-}" ] || echo "$__rc" >'),
    "B: the EXIT trap stands down for array tasks (a sibling's failure never speaks early)"
  );
  must(
    src.includes("trap 'echo 143 >") && src.includes("' TERM INT"),
    "B: the TERM/INT trap stays unguarded (a scancel hits ALL tasks — first writer wins, same word)"
  );
  must(
    src.includes("...(r.slurmArray ? { slurmArray: r.slurmArray } : {}),"),
    "B: the projection lets the split ride to the client"
  );
  must(
    (insp.match(/array 1-\$\{job\.runRemote\.slurmArray\.total\}%\$\{job\.runRemote\.slurmArray\.concurrency\}/g) ?? []).length === 2,
    "B: the strip speaks the split BOTH live and terminal"
  );
  must(
    dlg.includes('new Set(["motioncorr", "ctffind"])') &&
      dlg.includes('data-array-shards-row=""') &&
      dlg.includes("arrayEligible && shards >= 2 ? { shards: Math.min(ARRAY_MAX_SHARDS, shards) } : {}"),
    "B: the dialog gates the stepper to eligible types and sends shards only when split"
  );
  must(
    sb.includes("'#SBATCH --array=1-\\K[0-9]+'") &&
      sb.includes("'#SBATCH --array=1-[0-9]+%\\K[0-9]+'"),
    "B: the mock parses total and %M (\\K — GNU grep forbids variable-width lookbehinds)"
  );
  must(
    sb.includes('if [ -n "\\$__total" ]; then') &&
      sb.includes("wait -n") &&
      sb.includes("SLURM_ARRAY_JOB_ID=\"$id\" SLURM_ARRAY_TASK_ID=\"\\$__t\" bash \"$script\""),
    "B: the launcher fans out N tasks capped at %M with the scheduler's env"
  );
  must(
    sb.includes("'%s_%s|%s|%s:0|%s|%s|\\n'") &&
      sb.includes("__mstate=COMPLETED") &&
      sb.includes("[ \"\\$__firstbad\" -ne 0 ] && __mstate=FAILED"),
    "B: per-task rows journal as <id>_<t>; the MASTER row is COMPLETED only when every rc was 0"
  );

  // ---- Phase C: the live loop -------------------------------------------------
  console.log("== PHASE C: the live loop ==");
  // the completed provider: a LOCAL import with 12 micrographs so every
  // shard owns real rows (4 at shards=3, 6 at shards=2)
  const micsDir = `${ROOT}/data/relion/t306-array/mics`;
  mkdirSync(micsDir, { recursive: true });
  for (let i = 1; i <= MICS; i++) {
    execSync(
      `node -e "const fs=require('fs');const b=Buffer.alloc(1024+64,0);b.write('mrc ',208);b.writeInt32LE(64,0);b.writeInt32LE(64,4);b.writeInt32LE(1,8);b.writeInt32LE(0,16);b.writeInt32LE(4,92);fs.writeFileSync('${micsDir}/mic-${String(i).padStart(2, "0")}.mrc',b)"`,
      { cwd: ROOT, stdio: "pipe" }
    );
  }
  const a0 = await mkJob({ type: "import", name: "t306 Import A0", params: { micrographsPath: micsDir, pixelSize: 1.77 }, x: 80, y: 80 });
  const runA0 = await fetch(`${BASE}/api/jobs/${a0.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA0.status === 200, `A0 imports locally (${runA0.status})`);
  const a0done = await pollUntil(async () => (await getJobs()).find((j) => j.id === a0.id)?.status, 30_000);
  must(a0done === "completed", `A0 completed — the provider has ${MICS} micrographs (got ${a0done})`);

  // ---- C1: shards=3 → the fan, the merge, the done --------------------------
  console.log("== PHASE C1: one sbatch, three shards, one merged star ==");
  const c1 = await mkJob({
    type: "ctffind", name: "t306 Array C1",
    params: { box: 128, resMin: 30, resMax: 5, voltage: 300, cs: 2.7, ampContrast: 0.1 },
    x: 340, y: 80,
  });
  must(await mkEdge(a0.id, c1.id, "micrographs", "micrographs") === 201, "C1: the provider edge stands (201)");
  const disp1 = await dispatch(c1.id, CONN, { shards: 3 });
  must(disp1.status === 200 && !disp1.body?.error,
    `C1: the split dispatch went through (status ${disp1.status}, err=${disp1.body?.error ?? "-"})`);
  const rec1 = await pollUntil(() => {
    const r = stateRuns()[c1.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec1, "C1: the submission has a scheduler id");
  const sId1 = rec1?.remote?.slurmId;
  sbatchIds.push(Number(sId1));
  must(
    JSON.stringify(rec1?.remote?.slurmArray) === JSON.stringify({ total: 3, concurrency: 4 }),
    `C1: the record names the split (slurmArray ${JSON.stringify(rec1?.remote?.slurmArray)})`
  );
  const scriptTxt = client(`cat /projects/cryoflow/${c1.projectId}/ctffind_${c1.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  must(
    scriptTxt.includes("#SBATCH --array=1-3%4") &&
      scriptTxt.includes('if [ -n "${SLURM_ARRAY_TASK_ID:-}" ]; then') &&
      scriptTxt.includes("--i \"$SHARD\"") &&
      scriptTxt.includes("--o \"$OSHARD/\""),
    "C1: the SUBMITTED script carries the directive + the shard swap (the real thing, not a template)"
  );
  must(
    scriptTxt.includes(".cf-array-rc-$SLURM_ARRAY_JOB_ID") &&
      scriptTxt.includes("-ge 3") &&
      scriptTxt.includes("micrographs_ctf.star"),
    "C1: the script's count gate merges the shard stars into the canonical file"
  );
  // the fan is real: per-task rows land in the ledger (real sacct's grammar)
  const taskRow = await pollUntil(() => {
    const w = journalWord(`${sId1}_1`);
    return w.startsWith("COMPLETED") ? w : null;
  }, 45_000, 900);
  must(!!taskRow, `C1: task 1's own row says COMPLETED (${taskRow || "no row"})`);
  const masterWord = await waitJournal(sId1, "COMPLETED", 45_000);
  must(masterWord.startsWith("COMPLETED"), `C1: the MASTER row is COMPLETED (every rc was 0) (${masterWord})`);
  const tasksAll = [1, 2, 3].every((t) => journalWord(`${sId1}_${t}`).startsWith("COMPLETED"));
  must(tasksAll, "C1: all three per-task rows say COMPLETED");
  const done1 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === c1.id)?.status;
    return s === "completed" ? s : null;
  }, 90_000);
  must(done1 === "completed", `C1: the sweep finalized the array (got ${done1 ?? "still running"})`);
  // the DTO-level witness: the projection let the split ride to the client
  const dto1 = (await getJobs()).find((j) => j.id === c1.id);
  must(
    JSON.stringify(dto1?.runRemote?.slurmArray) === JSON.stringify({ total: 3, concurrency: 4 }),
    `C1: the DTO carries the split (runRemote.slurmArray ${JSON.stringify(dto1?.runRemote?.slurmArray)})`
  );
  const rec1b = stateRuns()[c1.id];
  must(
    rec1b?.done === true && rec1b?.exitCode === 0,
    `C1: the record finalized done/exit 0 (done ${rec1b?.done}, exit ${rec1b?.exitCode})`
  );
  // the merge's whole point: the LOCAL synced star lists EVERY micrograph
  const mergedLocal = rec1b?.outputs?.micrographs_ctf_star;
  let mergedRows = -1;
  if (mergedLocal && existsSync(mergedLocal)) {
    mergedRows = readFileSync(mergedLocal, "utf8")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("data_") && !l.startsWith("loop_") && !l.startsWith("_") && !l.startsWith("#"))
      .length;
  }
  must(
    mergedRows === MICS,
    `C1: the merged star made it home with ALL ${MICS} micrographs (got ${mergedRows} rows in ${mergedLocal ?? "no file"})`
  );
  // the strip speaks the split — live, then terminal
  const stripShot = await pollUntil(async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const card = page.locator("[data-job]", { hasText: "t306 Array C1" }).locator('[role="button"]').first();
    try { await card.click({ timeout: 6000, force: true }); } catch { return null; }
    await sleep(1200);
    const body = await page.locator("body").innerText();
    return /array 1-3%4/.test(body) ? body : null;
  }, 45_000, 2500);
  must(!!stripShot, "C1: the strip speaks the split ('· array 1-3%4')");
  await page.screenshot({ path: `${SHOTS}/t306-array-strip.png` }).catch(() => {});

  // ---- C2: the mid-array scancel → 143 ---------------------------------------
  console.log("== PHASE C2: a cancelled fan is honest ==");
  const c2 = await mkJob({
    type: "ctffind", name: "t306 Array C2",
    params: { box: 128, resMin: 30, resMax: 5, voltage: 300, cs: 2.7, ampContrast: 0.1 },
    x: 340, y: 300,
  });
  must(await mkEdge(a0.id, c2.id, "micrographs", "micrographs") === 201, "C2: the provider edge stands (201)");
  const disp2 = await dispatch(c2.id, CONN, { shards: 2 });
  must(disp2.status === 200 && !disp2.body?.error, `C2: the split dispatch went through (${disp2.status})`);
  const rec2 = await pollUntil(() => {
    const r = stateRuns()[c2.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec2, "C2: the submission has a scheduler id");
  const sId2 = rec2?.remote?.slurmId;
  sbatchIds.push(Number(sId2));
  must(
    JSON.stringify(rec2?.remote?.slurmArray) === JSON.stringify({ total: 2, concurrency: 4 }),
    `C2: the record names the split (${JSON.stringify(rec2?.remote?.slurmArray)})`
  );
  // wait until the fan is RUNNING, then stop it through the product door
  await pollUntil(() => (client(`squeue -j ${sId2} -h -o %T`) === "RUNNING" ? true : null), 30_000, 800);
  const stop2 = await fetch(`${BASE}/api/jobs/${c2.id}/stop`, { method: "POST", headers: SHJ, body: "{}" });
  must(stop2.status === 200 || stop2.status === 409, `C2: the stop door accepted (status ${stop2.status})`);
  const scancelWord = await waitJournal(sId2, "CANCELLED", 30_000);
  must(scancelWord.startsWith("CANCELLED"), `C2: the scheduler's word is CANCELLED (${scancelWord})`);
  const failed2 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === c2.id)?.status;
    return s === "failed" ? s : null;
  }, 60_000);
  must(failed2 === "failed", `C2: the row went failed (got ${failed2 ?? "still running"})`);
  const rec2b = stateRuns()[c2.id];
  must(
    rec2b?.done === true && rec2b?.exitCode === 137,
    `C2: the stop route owns the verdict — 137, the user's KILL word (done ${rec2b?.done}, exit ${rec2b?.exitCode})`
  );
  // the array-specific honesty: the tasks' TERM trap wrote 143 into
  // .cf-exit before the SIGKILL beat expired — the scheduler tore the
  // whole fan down and the script's contract answered on the way out
  const trapWord = await pollUntil(() => {
    const v = client(`cat /projects/cryoflow/${c2.projectId}/ctffind_${c2.id.slice(-8)}/.cf-exit 2>/dev/null`).trim();
    return v === "143" ? v : null;
  }, 15_000, 700);
  must(trapWord === "143", `C2: the tasks' TERM trap spoke 143 into .cf-exit (got ${trapWord || "nothing"})`);

  // ---- C3: the control — no shards, no directive -----------------------------
  console.log("== PHASE C3: no split, byte-shape control ==");
  const c3 = await mkJob({
    type: "ctffind", name: "t306 Plain C3",
    params: { box: 128, resMin: 30, resMax: 5, voltage: 300, cs: 2.7, ampContrast: 0.1 },
    x: 340, y: 520,
  });
  must(await mkEdge(a0.id, c3.id, "micrographs", "micrographs") === 201, "C3: the provider edge stands (201)");
  const disp3 = await dispatch(c3.id, CONN);
  must(disp3.status === 200 && !disp3.body?.error, `C3: the plain dispatch went through (${disp3.status})`);
  const rec3 = await pollUntil(() => {
    const r = stateRuns()[c3.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec3, "C3: the submission has a scheduler id");
  const sId3 = rec3?.remote?.slurmId;
  sbatchIds.push(Number(sId3));
  must(rec3?.remote?.slurmArray === undefined, "C3: the record carries NO slurmArray");
  const script3 = client(`cat /projects/cryoflow/${c3.projectId}/ctffind_${c3.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  must(
    !script3.includes("#SBATCH --array=") &&
      !script3.includes('if [ -n "${SLURM_ARRAY_TASK_ID:-}" ]; then'),
    "C3: the submitted script has no array directive and no shard branch (the trap guard stays — one trap shape for every submission)"
  );
  const done3 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === c3.id)?.status;
    return s === "completed" ? s : null;
  }, 90_000);
  must(done3 === "completed", `C3: the plain run completed (got ${done3 ?? "still running"})`);

  // ---- C4: the honest refusal — ineligible type + shards ---------------------
  console.log("== PHASE C4: a split refine3d-style job is refused, not un-split ==");
  const c4 = await mkJob({ type: "class2d", name: "t306 Refuse C4", x: 340, y: 740 });
  const disp4 = await dispatch(c4.id, CONN, { shards: 4 });
  must(
    disp4.status === 200 && typeof disp4.body?.error === "string" && disp4.body.error.includes("cannot ride an array split"),
    `C4: refused BEFORE staging with the honest word (err=${String(disp4.body?.error).slice(0, 80)}…)`
  );
  const status4 = (await getJobs()).find((j) => j.id === c4.id)?.status;
  must(status4 !== "running" && status4 !== "completed", `C4: the refused job never started (status ${status4})`);

  // ---- Phase D: the hygiene ----------------------------------------------------
  console.log("== PHASE D: the hygiene ==");
  must(consoleErrors.length === 0, `console errors 0 (got ${consoleErrors.length}${consoleErrors.length ? `: ${consoleErrors[0]}` : ""})`);

  // ---- screenshots from the green run ----
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await sleep(2200);
    const card = page.locator("[data-job]", { hasText: "t306 Array C1" }).locator('[role="button"]').first();
    await card.click({ timeout: 6000, force: true });
    await sleep(1400);
    await page.screenshot({ path: `${SHOTS}/t306-array-inspector.png` });
  } catch { /* best effort */ }
} finally {
  console.log("== cleanup ==");
  try {
    if (snap0 != null) writeStateRuns(JSON.parse(snap0).runs ?? JSON.parse(snap0));
  } catch { /* best effort */ }
  for (const id of [...createdJobs].reverse()) {
    try {
      await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
    } catch { /* best effort */ }
  }
  try {
    await fetch(`${BASE}/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH });
  } catch { /* best effort */ }
  try {
    const parts = ["rm -rf /projects/cryoflow/t306-array"];
    for (const id of sbatchIds) {
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
      parts.push(`rm -f "$HOME/.slurm/job-${id}_"* 2>/dev/null`);
    }
    parts.push('rm -f "$HOME/.slurm/"job-*.cancelled');
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t306snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t306snap"');
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t306-array`, { recursive: true, force: true }); } catch { /* gone */ }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
  await sleep(1200);
  try {
    const n = (await getJobs()).length;
    must(n === 21, `roster restored to 21 (got ${n})`);
  } catch { /* server busy */ }
  await browser.close().catch(() => {});
}

console.log(fail === 0 ? "\nT306 ALL PASS" : `\nT306 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
