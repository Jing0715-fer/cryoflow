#!/usr/bin/env node
/**
 * t299 — the accounting fallback: the scheduler's own testimony survives
 * the purge (sacct 兜底; FIRST persisted slurm-mode regression — t297's
 * e2e lived only inside its own window).
 *
 * The hole: squeue only knows PENDING/RUNNING — a finished job leaves it
 * within moments. Completion truth used to rest entirely on the wrapper's
 * .cf-exit file; if that write never landed (NFS lag, node gone mid-write),
 * the sweep aged the record into a FALSE "interrupted remotely" failure
 * even though the controller's accounting ledger knew the verdict all
 * along. The fix: aliveCheckScript grows a THIRD witness — sacct — whose
 * terminal words map onto the same exit contract the wrapper would have
 * written (COMPLETED→0, FAILED→exit, CANCELLED→143, TIMEOUT→124,
 * signal→128+sig), so finalize runs the ONE honest path.
 *
 * Phases:
 *   A  demo truth (roster 21, mock cluster alive)
 *   B  the ledger — src + mock + inspector source assertions
 *   C0 sacct's silence contract (unknown id → empty, exit 0)
 *   C1 sbatch a bare exit-0 script → accounting row → sacct COMPLETED|0:0
 *   C2 exit-3 script → FAILED|3:0
 *   C3 sleeping script + scancel → CANCELLED|0:15 + marker + ONE row
 *   C4 the purge witness, live: planted record (no .cf-exit, job gone from
 *      squeue) → the sweep's sacct branch finalizes COMPLETED — not the
 *      false tombstone
 *   C5 planted record, FAILED witness → exit 3
 *   C6 planted record, CANCELLED witness → exit 143
 *   C7 planted record + planted TIMEOUT journal row → exit 124
 *   C8 VANISHED stays honest: no testimony at all + past grace → the old
 *      interrupted-remotely tombstone (the fallback widens nothing)
 *   C9 the inspector strip speaks the scheduler's terminal word
 *   C10 the ledger's stopwatch + meter, end to end (6-field row → 12m34s · 1.2 GB peak)
 *   C11 t305: the wrapper path's word finally speaks — .cf-exit 0 + a
 *      COMPLETED ledger row → the EXIT branch's consistency gate passes →
 *      the record carries the word AND the strip says '· Slurm COMPLETED'
 *   C12 t305: the contradiction guard — .cf-exit 0 against a CANCELLED row →
 *      the word stays silent, the verdict stays the wrapper's, the meter rides
 *   D  console clean
 */
import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const SHOTS = `${ROOT}/shots-qa`;
const CONN = `qa-t299-${Date.now().toString(36)}`;
// PATH LESSON (t299 first passes): the mock's translateCommand rewrites any
// command containing the literal substring "/home/cryo/" (or "/projects/")
// onto the mock fs root — an absolute HOST path that happens to contain that
// substring gets DOUBLED into a tree that does not exist. And execSync +
// JSON.stringify let the LOCAL shell expand $HOME before the command ever
// reached the mock. So: execFileSync (no local shell, no re-quoting) and
// mock-native "$HOME/..." paths (the mock shell expands them exactly like
// the tools do — one HOME, one journal, no drift).

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

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

const client = (cmd) =>
  execFileSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  });

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

let rowSeq = 0;
const mkRow = async (name) => {
  // explicit canvas positions — the default random x/y drops every witness
  // into the same 60px window, and overlapping cards intercept each other's
  // clicks (the C9 lesson from the first pass)
  const i = rowSeq++;
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ type: "import", name, x: 80 + i * 260, y: 80 + i * 200 }),
  });
  const b = await r.json();
  if (b.job?.id) createdJobs.push(b.job.id);
  return b.job;
};
const flipRunning = (id) =>
  execSync(
    `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:process.argv[1]},data:{status:'running',progress:5,startedAt:new Date()}}).then(()=>p.\\$disconnect()).catch(e=>{console.error(e.message);process.exit(1);})" ${id}`,
    { cwd: ROOT, stdio: "pipe", timeout: 30_000 }
  );

/** sbatch a bare script on the mock (NO cf wrapper → NO .cf-exit ever). */
const bareSbatch = (name, body) => {
  client(
    `mkdir -p /projects/cryoflow/t299-sacct && printf '${body}' > /projects/cryoflow/t299-sacct/${name}.sh`
  );
  const sub = client(`sbatch /projects/cryoflow/t299-sacct/${name}.sh`);
  const id = Number(/Submitted batch job (\d+)/.exec(sub)?.[1]);
  if (id) sbatchIds.push(id);
  return id;
};
const journalWord = (id) => {
  try {
    return client(`sacct -j ${id} -n -P -o State,ExitCode`).trim();
  } catch {
    return "";
  }
};
const waitJournal = async (id, want, deadlineMs = 20_000) =>
  pollUntil(() => (journalWord(id).startsWith(want) ? journalWord(id) : null), deadlineMs, 700);

/** plant a running slurm record pointing at a REAL connection + mock workdir.
 *  `cfExit` (t305) pre-writes .cf-exit into the remote workdir BEFORE the
 *  sweep can poll the record — the EXIT branch then fires deterministically
 *  (never the fallback), which is the only way to witness its word gate. */
let wdSeq = 0;
const plant = (jobId, projectId, slurmId, startedAtIso, cfExit = null) => {
  const n = ++wdSeq;
  const remoteWd = `/projects/cryoflow/t299-sacct/wd-${n}`;
  const localWd = `${ROOT}/data/relion/t299-sacct/wd-${n}`;
  mkdirSync(localWd, { recursive: true });
  client(`mkdir -p ${remoteWd}`);
  if (cfExit != null) client(`printf '${cfExit}' > ${remoteWd}/.cf-exit`);
  const runs = { ...stateRuns() };
  runs[jobId] = {
    jobId,
    projectId,
    type: "import",
    pid: null,
    cmd: "t299: planted witness (no .cf-exit — the accounting must speak)",
    workdir: localWd,
    logFile: `${localWd}/run.out`,
    errFile: `${localWd}/run.err`,
    startedAt: startedAtIso,
    done: false,
    remote: {
      connectionId: CONN,
      connectionName: "QA t299 Sacct",
      host: "127.0.0.1:3022",
      user: "cryo",
      module: "",
      mode: "slurm",
      remoteRoot: "/projects/cryoflow",
      remoteWorkdir: remoteWd,
      pid: null,
      slurmId: String(slurmId),
      phase: "running",
    },
  };
  writeStateRuns(runs);
};

/** the sweep verdict: poll the jobs GET until the planted row leaves running. */
const sweepVerdict = async (jobId, deadlineMs = 45_000) =>
  pollUntil(async () => {
    const j = (await getJobs()).find((x) => x.id === jobId);
    return j && j.status !== "running" ? j : null;
  }, deadlineMs, 1800);

try {
  // ---- Phase A: demo truth -------------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(await mockListening(), "the mock cluster answers on :3022");

  snap0 = readFileSync(STATE_FILE, "utf8"); // pre-suite record truth
  try {
    accPre = client('test -f "$HOME/.slurm/accounting" && echo YES || echo NO').trim();
    if (accPre === "YES") client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t299snap"');
  } catch { accPre = "NO"; }

  // ---- the connection the planted records ride ----------------------------
  const mk = await page.evaluate(async ({ connId, SHJ }) => {
    const r = await fetch("/api/remote/connections", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({
        id: connId, name: "QA t299 Sacct", host: "127.0.0.1", port: 3022,
        username: "cryo", password: "demo", authMethod: "password",
        remoteRoot: "/projects/cryoflow",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { connId: CONN, SHJ });
  connOk = mk.status === 201 || mk.status === 200;
  must(connOk, `the probeless connection exists (${mk.status})`);

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  must(src.includes("sacct -j ${J} -n -P -o State,ExitCode,Elapsed,MaxRSS"), "B: the third witness queries the app grammar (t303: the stopwatch + meter ride the same row)");
  must(
    src.includes("const AC = ") &&
      (src.match(/sacct -j/g)?.length ?? 0) === 1 &&
      (src.match(/\$\{AC\}/g)?.length ?? 0) === 2,
    "B: ONE shared 4-column query, invoked by BOTH exit branches (EXIT enrichment + the fallback)"
  );
  must(src.includes('echo "SACCT:$__ac"'), "B: terminal accounting words ride out as SACCT:<state>|<exit>:<sig>");
  must(src.includes("PENDING*|RUNNING*|COMPLETING*"), "B: in-flight accounting words stay ALIVE (accounting lag cannot fake death)");
  must(src.includes("COMPLETED*|FAILED*|CANCELLED*|TIMEOUT*"), "B: the terminal case covers the controller's verdict family");
  must(src.includes("OUT_OF_*"), "B: OUT_OF_MEMORY (and kin) are terminal, not vanished");
  must(src.includes('*) echo VANISHED ;; esac'), "B: an EMPTY verdict is the only thing still allowed to mean VANISHED");
  must(
    src.includes("([A-Z_]+)(?:\\s+by\\s+\\d+)?\\|(\\d+):(\\d+)(?:\\|([^|]*)\\|([^|]*))?"),
    "B: the sweep parses SACCT rows (t303: optional Elapsed/MaxRSS columns; real sacct's 'CANCELLED by <uid>' tolerated)"
  );
  must(
    src.includes("function parseSlurmElapsed") && src.includes("function parseSlurmMaxRss"),
    "B: the ledger's dialects have their own parsers ([[DD-]hh:]mm:ss → ms; K/M/G/T → bytes)"
  );
  must(
    src.includes("function parseSacctRow") && src.includes("function persistSacctTestimony"),
    "B: one row parser + one testimony persist serve BOTH exit paths (wrapper-verdict + fallback)"
  );
  must(
    // t305 — the EXIT branch promotes the word CONDITIONALLY: the ledger's
    // terminal word decorates the record only when it agrees with the
    // wrapper's exit (the fallback's own mapping) — a disagreement keeps
    // the old silence and logs it. The fallback still owns the word outright.
    src.includes('wordAgreesWithExit(witness, exitCode)') &&
      src.includes('persistSacctTestimony(e, witness, agreed)') &&
      src.includes('persistSacctTestimony(e, witness, true)'),
    "B: the EXIT path promotes the word through the consistency gate; the fallback owns it outright"
  );
  must(
    src.includes('row.word === "CANCELLED"') && src.includes('row.word === "TIMEOUT"'),
    "B: the gate maps the word through the fallback's own exit contract (CANCELLED→143, TIMEOUT→124)"
  );
  must(
    src.includes('line2.startsWith("SACCT:")'),
    "B: the block parser stows a SECOND-line SACCT row (the EXIT branch's enrichment)"
  );
  must(
    src.includes("patch.slurmState = row.word") &&
      src.includes("e.remote.slurmElapsedMs == null") &&
      src.includes("e.remote.slurmMaxRssBytes == null"),
    "B: the testimony persists the word + the first-served stopwatch/meter (never a done record, never a guess)"
  );
  must(src.includes('word === "CANCELLED" ? 143'), "B: CANCELLED maps onto the stop contract (143 — the TERM-trap word)");
  must(src.includes('word === "TIMEOUT" && mapped === 0 ? 124 : mapped'), "B: TIMEOUT is a failure even when the step exited 0 (timeout(1)'s 124)");
  must(src.includes("128 + sigNum"), "B: a signal death with a clean exit rides 128+sig");
  must(src.includes("patch.slurmState = row.word"), "B: the terminal word is persisted on the record for the UI");
  must(src.includes('if (/^SACCT:/m.test(res.stdout)) return "exit";'), "B: the single poll treats a terminal verdict as an exit");

  const sb = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/sbatch`, "utf8");
  must(sb.includes('bash "$script"') && !sb.includes('exec bash "$script"'), "B: the mock launcher outlives the script by one breath (no more mute exec)");
  must(sb.includes("__rc=$?") || sb.includes("__rc=\\$?"), "B: the launcher captures the script's rc");
  must(sb.includes('job-$id.cancelled'), "B: the launcher stands down when scancel owns the accounting");
  must(sb.includes(">> \"$SLURM_DIR/accounting\""), "B: natural completion journals COMPLETED/FAILED");
  must(
    sb.includes("__t0") && sb.includes("job-$id.start"),
    "B: the launcher pins the start epoch (the stopwatch's zero)"
  );

  const sc = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/scancel`, "utf8");
  must(
    sc.indexOf('job-$id.cancelled') !== -1 &&
      sc.indexOf('job-$id.cancelled') < sc.indexOf("kill -- -\"$pid\""),
    "B: scancel writes marker + CANCELLED row BEFORE the kills"
  );
  must(
    sc.includes('job-$id.start'),
    "B: scancel's CANCELLED row reads the launcher's start epoch (the stopwatch speaks on cancel too)"
  );

  const sa = `${ROOT}/services/mock-cluster/fs/opt/bin/sacct`;
  must(existsSync(sa), "B: the sacct tool exists on the mock");
  must((statSync(sa).mode & 0o111) !== 0, "B: sacct is executable");
  const sac = readFileSync(sa, "utf8");
  must(sac.includes("tail -1"), "B: the LAST journal row wins (requeue supersede)");
  must(sac.includes('[ -f "$SLURM_DIR/accounting" ] || exit 0'), "B: no ledger → silence, never an invented verdict");
  must(
    sac.includes("Elapsed)") && sac.includes("MaxRSS)"),
    "B: the mock sacct serves the stopwatch + meter columns (t303)"
  );
  must(sac.includes("fmt_elapsed"), "B: Elapsed renders in sacct's own family ([[DD-]hh:]mm:ss)");

  const insp = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  must(insp.includes("` · Slurm ${"), "B: the terminal strip speaks the scheduler's word");
  must(insp.includes("OUT_OF_MEMORY|PREEMPTED|DEADLINE"), "B: the strip's terminal-word guard matches the sweep's family");
  must(
    insp.includes("slurmElapsedMs != null") && insp.includes("formatLedgerMs(job.runRemote.slurmElapsedMs)"),
    "B: the strip speaks the ledger's stopwatch in the ledger dialect (t303)"
  );
  must(
    insp.includes("slurmMaxRssBytes != null") && insp.includes("formatStagedBytes(job.runRemote.slurmMaxRssBytes)"),
    "B: the strip speaks the ledger's peak memory (t303)"
  );
  const tt = readFileSync(`${ROOT}/src/lib/remote/types.ts`, "utf8");
  must(
    tt.includes("slurmElapsedMs?: number") && tt.includes("slurmMaxRssBytes?: number"),
    "B: the DTO carries the stopwatch + meter (RemoteRunInfo + RemoteRunState)"
  );

  // ---- Phase C0: sacct's silence contract ----------------------------------
  console.log("== PHASE C0: silence contract ==");
  const silent = client("sacct -j 999989 -n -P -o State,ExitCode").trim();
  must(silent === "", "C0: an unknown id is SILENT (no testimony is no verdict)");

  // ---- Phase C1/C2/C3: the mock's own accounting ---------------------------
  console.log("== PHASE C1-C3: the mock journals its verdicts ==");
  const id1 = bareSbatch("ok0", "#!/usr/bin/env bash\\nexit 0\\n");
  must(Number.isFinite(id1) && id1 > 0, `C1: bare sbatch submitted (job ${id1})`);
  const j1 = await waitJournal(id1, "COMPLETED");
  must(j1 === "COMPLETED|0:0", `C1: the launcher journals the verdict (got "${j1}")`);
  const e1 = client(`sacct -j ${id1} -n -P -o Elapsed`).trim();
  must(/^\d[\d:]*$/.test(e1), `C1: the ledger speaks the stopwatch (Elapsed "${e1}", sacct's [[DD-]hh:]mm:ss family)`);

  const id2 = bareSbatch("bad3", "#!/usr/bin/env bash\\nexit 3\\n");
  const j2 = await waitJournal(id2, "FAILED");
  must(j2 === "FAILED|3:0", `C2: a failing script journals FAILED|3:0 (got "${j2}")`);

  const id3 = bareSbatch("slow", "#!/usr/bin/env bash\\nsleep 25\\n");
  await sleep(1600); // let it reach RUNNING
  client(`scancel ${id3}`);
  const j3 = await waitJournal(id3, "CANCELLED");
  must(j3 === "CANCELLED|0:15", `C3: scancel journals CANCELLED|0:15 (got "${j3}")`);
  const marker = client(`test -f "$HOME/.slurm/job-${id3}.cancelled" && echo YES || echo NO`).trim();
  must(marker === "YES", "C3: the cancel marker stands (the launcher will not double-journal)");
  const e3 = client(`sacct -j ${id3} -n -P -o Elapsed`).trim();
  must(/^\d[\d:]*$/.test(e3), `C3: the cancelled row's stopwatch speaks too (Elapsed "${e3}")`);
  const rows3 = client(`grep -c "^${id3}|" "$HOME/.slurm/accounting" 2>/dev/null || echo 0`).trim();
  must(rows3 === "1", `C3: exactly ONE accounting row for the cancelled job (got ${rows3})`);

  // ---- Phase C4-C8: the purge witness, live through the sweep --------------
  console.log("== PHASE C4: COMPLETED witness ==");
  const job4 = await mkRow("t299 Sacct Witness COMPLETED");
  must(!!job4?.id, "C4: the witness row exists");
  flipRunning(job4.id);
  plant(job4.id, job4.projectId, id1, new Date(Date.now() - 60_000).toISOString());
  const done4 = await sweepVerdict(job4.id);
  must(done4?.status === "completed", `C4: the row COMPLETED (got ${done4?.status ?? "still running"})`);
  const rec4 = stateRuns()[job4.id];
  must(rec4?.done === true && rec4?.exitCode === 0, "C4: the record finalized exit 0 — the same contract the wrapper writes");
  must(rec4?.remote?.slurmState === "COMPLETED", "C4: the record carries the scheduler's terminal word");
  must(
    typeof rec4?.remote?.slurmElapsedMs === "number" && rec4.remote.slurmElapsedMs >= 0,
    `C4: the record carries the scheduler's stopwatch (slurmElapsedMs ${rec4?.remote?.slurmElapsedMs} — a sub-second script is an honest 0, never absent)`
  );
  must(!/interrupted remotely/.test(rec4?.result ?? ""), "C4: no false interrupted-remotely tombstone");

  console.log("== PHASE C5: FAILED witness ==");
  const job5 = await mkRow("t299 Sacct Witness FAILED");
  flipRunning(job5.id);
  plant(job5.id, job5.projectId, id2, new Date(Date.now() - 60_000).toISOString());
  const done5 = await sweepVerdict(job5.id);
  must(done5?.status === "failed", `C5: the row failed (got ${done5?.status ?? "still running"})`);
  const rec5 = stateRuns()[job5.id];
  must(rec5?.exitCode === 3, `C5: exit 3 rode the sacct mapping (got ${rec5?.exitCode})`);
  must(rec5?.remote?.slurmState === "FAILED", "C5: the word FAILED is on the record");
  must(/exit 3/.test(rec5?.result ?? ""), "C5: the result speaks the exit code");

  console.log("== PHASE C6: CANCELLED witness ==");
  const job6 = await mkRow("t299 Sacct Witness CANCELLED");
  flipRunning(job6.id);
  plant(job6.id, job6.projectId, id3, new Date(Date.now() - 60_000).toISOString());
  const done6 = await sweepVerdict(job6.id);
  must(done6?.status === "failed", `C6: the row is terminal-failed (got ${done6?.status ?? "still running"})`);
  const rec6 = stateRuns()[job6.id];
  must(rec6?.exitCode === 143, `C6: CANCELLED maps to the stop contract 143 (got ${rec6?.exitCode})`);
  must(rec6?.remote?.slurmState === "CANCELLED", "C6: the word CANCELLED is on the record");

  console.log("== PHASE C7: TIMEOUT witness ==");
  client('mkdir -p "$HOME/.slurm" && printf "999903|TIMEOUT|0:0|1758220000\\n" >> "$HOME/.slurm/accounting"');
  const job7 = await mkRow("t299 Sacct Witness TIMEOUT");
  flipRunning(job7.id);
  plant(job7.id, job7.projectId, 999903, new Date(Date.now() - 60_000).toISOString());
  const done7 = await sweepVerdict(job7.id);
  must(done7?.status === "failed", `C7: the row failed (got ${done7?.status ?? "still running"})`);
  const rec7 = stateRuns()[job7.id];
  must(rec7?.exitCode === 124, `C7: TIMEOUT with a clean step-exit maps to 124 (got ${rec7?.exitCode})`);
  must(rec7?.remote?.slurmState === "TIMEOUT", "C7: the word TIMEOUT is on the record");
  must(
    rec7?.remote?.slurmElapsedMs === undefined,
    "C7: a 4-field row serves NO stopwatch — absent, not guessed (the honesty contract)"
  );

  console.log("== PHASE C8: VANISHED stays honest ==");
  const job8 = await mkRow("t299 Sacct Witness VANISHED");
  flipRunning(job8.id);
  plant(job8.id, job8.projectId, 999904, new Date(Date.now() - 10 * 60_000).toISOString());
  const done8 = await sweepVerdict(job8.id);
  must(done8?.status === "failed", `C8: no testimony + past grace still fails the row (got ${done8?.status ?? "still running"})`);
  const rec8 = stateRuns()[job8.id];
  must(rec8?.exitCode === -1 || rec8?.exitCode === 137 || rec8?.exitCode == null, `C8: the tombstone exit is the interrupted code (got ${rec8?.exitCode})`);
  must(/interrupted remotely/.test(rec8?.result ?? "") || /stopped|interrupted/.test(done8?.result ?? ""), "C8: the interrupted-remotely tombstone survives where it belongs");

  // ---- Phase C9: the strip speaks the scheduler's word ----------------------
  console.log("== PHASE C9: the strip's terminal word ==");
  await page.goto(`${BASE}`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const card = page
    .locator("[data-job]", { hasText: "t299 Sacct Witness COMPLETED" })
    .locator('[role="button"]')
    .first();
  await card.click({ timeout: 8000, force: true });
  await sleep(1500);
  const bodyText = await page.locator("body").innerText();
  must(/Ran on the cluster · Slurm COMPLETED/.test(bodyText), "C9: the strip says 'Ran on the cluster · Slurm COMPLETED'");
  await page.screenshot({ path: `${SHOTS}/t299-sacct-witness.png` });

  // ---- Phase C10: the ledger's stopwatch + meter, end to end -----------------
  // t303 — a planted 6-field row (COMPLETED, known epochs, MaxRSS 1.24G) rides
  // the REAL sweep: the record carries the scheduler's OWN wall-clock
  // (754s = 12m34s exactly) and peak memory (1.24 GiB in bytes), and the
  // inspector's strip speaks both in the ledger's dialect — deterministic
  // words, no formatting guesswork (1.24, not 1.25 — a toFixed tie must
  // never be load-bearing in a deterministic assertion).
  console.log("== PHASE C10: the ledger's stopwatch + meter ==");
  const t0c10 = Math.floor(Date.now() / 1000) - 754;
  client(`printf "999905|COMPLETED|0:0|$(( ${t0c10} + 754 ))|${t0c10}|1.24G\\n" >> "$HOME/.slurm/accounting"`);
  const job10 = await mkRow("t299 Sacct Witness LEDGER");
  flipRunning(job10.id);
  plant(job10.id, job10.projectId, 999905, new Date(Date.now() - 60_000).toISOString());
  const done10 = await sweepVerdict(job10.id);
  must(done10?.status === "completed", `C10: the ledger row COMPLETED (got ${done10?.status ?? "still running"})`);
  const rec10 = stateRuns()[job10.id];
  must(rec10?.exitCode === 0, "C10: the exit contract holds (0)");
  must(
    rec10?.remote?.slurmElapsedMs === 754_000,
    `C10: the record carries the scheduler's stopwatch (slurmElapsedMs ${rec10?.remote?.slurmElapsedMs}, want 754000)`
  );
  must(
    rec10?.remote?.slurmMaxRssBytes === Math.round(1.24 * 1024 ** 3),
    `C10: the record carries the scheduler's meter (slurmMaxRssBytes ${rec10?.remote?.slurmMaxRssBytes}, want ${Math.round(1.24 * 1024 ** 3)})`
  );
  await page.goto(`${BASE}`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const card10 = page
    .locator("[data-job]", { hasText: "t299 Sacct Witness LEDGER" })
    .locator('[role="button"]')
    .first();
  await card10.click({ timeout: 8000, force: true });
  await sleep(1500);
  const body10 = await page.locator("body").innerText();
  must(
    /Ran on the cluster · Slurm COMPLETED · 12m34s · 1\.2 GB peak/.test(body10),
    "C10: the strip speaks the stopwatch + meter in the ledger dialect ('· 12m34s · 1.2 GB peak')"
  );
  await page.screenshot({ path: `${SHOTS}/t299-sacct-ledger-stopwatch.png` });

  // ---- Phase C11: the wrapper path's word finally speaks (t305) -------------
  // A planted record whose workdir ALREADY carries .cf-exit "0" (the
  // wrapper's verdict) AND whose ledger row says COMPLETED — the EXIT branch
  // fires deterministically (never the fallback), the consistency gate sees
  // mapped 0 === exit 0, and the scheduler's word decorates the record. The
  // strip's '· Slurm COMPLETED' speaks on the HAPPY path for the first time.
  console.log("== PHASE C11: the wrapper path's word speaks ==");
  const t0c11 = Math.floor(Date.now() / 1000) - 125;
  client(`printf "999906|COMPLETED|0:0|$(( ${t0c11} + 125 ))|${t0c11}|1.24G\\n" >> "$HOME/.slurm/accounting"`);
  const job11 = await mkRow("t299 Sacct Wrapper COMPLETED");
  flipRunning(job11.id);
  plant(job11.id, job11.projectId, 999906, new Date(Date.now() - 60_000).toISOString(), "0");
  const done11 = await sweepVerdict(job11.id);
  must(done11?.status === "completed", `C11: the wrapper-verdict row COMPLETED (got ${done11?.status ?? "still running"})`);
  const rec11 = stateRuns()[job11.id];
  must(rec11?.exitCode === 0, "C11: the wrapper's exit is the verdict (0)");
  must(
    rec11?.remote?.slurmState === "COMPLETED",
    `C11: the word COMPLETED rode the EXIT path through the consistency gate (got ${rec11?.remote?.slurmState})`
  );
  must(
    rec11?.remote?.slurmElapsedMs === 125_000 && rec11?.remote?.slurmMaxRssBytes === Math.round(1.24 * 1024 ** 3),
    `C11: the stopwatch + meter still ride (elapsed ${rec11?.remote?.slurmElapsedMs}, rss ${rec11?.remote?.slurmMaxRssBytes})`
  );
  await page.goto(`${BASE}`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  const card11 = page
    .locator("[data-job]", { hasText: "t299 Sacct Wrapper COMPLETED" })
    .locator('[role="button"]')
    .first();
  await card11.click({ timeout: 8000, force: true });
  await sleep(1500);
  const body11 = await page.locator("body").innerText();
  must(
    /Ran on the cluster · Slurm COMPLETED · 2m05s · 1\.2 GB peak/.test(body11),
    "C11: the happy path's strip speaks '· Slurm COMPLETED · 2m05s · 1.2 GB peak'"
  );
  await page.screenshot({ path: `${SHOTS}/t299-wrapper-word-speaks.png` });

  // ---- Phase C12: the contradiction guard (t305) ----------------------------
  // .cf-exit says 0 but the ledger's last word is CANCELLED (a scancel in the
  // script's final breath): the gate maps CANCELLED→143 ≠ 0, keeps the word
  // silent, and the finalize still runs the wrapper's honest exit. The
  // stopwatch + meter ride regardless — only the WORD is gated.
  console.log("== PHASE C12: the contradiction stays silent ==");
  const t0c12 = Math.floor(Date.now() / 1000) - 61;
  client(`printf "999907|CANCELLED|0:0|$(( ${t0c12} + 61 ))|${t0c12}|2.50G\\n" >> "$HOME/.slurm/accounting"`);
  const job12 = await mkRow("t299 Sacct Wrapper CONTRA");
  flipRunning(job12.id);
  plant(job12.id, job12.projectId, 999907, new Date(Date.now() - 60_000).toISOString(), "0");
  const done12 = await sweepVerdict(job12.id);
  must(done12?.status === "completed", `C12: the wrapper's verdict stands (completed, got ${done12?.status ?? "still running"})`);
  const rec12 = stateRuns()[job12.id];
  must(rec12?.exitCode === 0, `C12: the exit is the wrapper's 0 (got ${rec12?.exitCode})`);
  must(
    rec12?.remote?.slurmState === undefined,
    `C12: the word CANCELLED never landed against a clean exit (slurmState ${rec12?.remote?.slurmState})`
  );
  must(
    rec12?.remote?.slurmElapsedMs === 61_000 && rec12?.remote?.slurmMaxRssBytes === Math.round(2.5 * 1024 ** 3),
    `C12: the stopwatch + meter ride ungated (elapsed ${rec12?.remote?.slurmElapsedMs}, rss ${rec12?.remote?.slurmMaxRssBytes})`
  );

  // ---- Phase D: console clean ----------------------------------------------
  console.log("== PHASE D: console ==");
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 140) : ""})`);

  console.log(fail === 0 ? "\nt299: ALL PASS" : `\nt299: ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  console.log("== cleanup ==");
  // records first (the t272 order law, suite edition): restore the state
  // file snapshot, THEN delete the rows — clearRunRecord finds nothing, no
  // orphans, no ghosts.
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
  // mock side: test dirs, my job files, the planted TIMEOUT row, the ledger
  try {
    const parts = ["rm -rf /projects/cryoflow/t299-sacct"];
    for (const id of sbatchIds) {
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
    }
    parts.push('rm -f "$HOME/.slurm/"job-*.cancelled');
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t299snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t299snap"');
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t299-sacct`, { recursive: true, force: true }); } catch { /* gone */ }
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
