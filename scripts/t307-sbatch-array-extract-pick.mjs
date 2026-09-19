/**
 * t307 — the array split learns the OTHER two per-micrograph shapes: extract
 * (particle extraction) and autopick (picking). t306 taught the dispatch to
 * slice a star and merge OUTPUT STARS (motioncorr/ctffind — one row per
 * micrograph); but the two jobs that turn micrographs into PARTICLES never
 * rode the split, and they are the ones that need it (picking/extraction is
 * embarrassingly parallel per micrograph).
 *
 * The catch — their outputs are NOT one star:
 *   - autopick writes one coordinate star PER MICROGRAPH at
 *     <odir>micrographs/<mic>_autopick.star → shards are disjoint mic sets,
 *     so the merge is a file COLLECTION into the canonical micrographs/
 *     (nothing can collide), and the downstream extract sees byte-identical
 *     shapes either way;
 *   - extract writes ONE particles.star whose ImageName paths point into the
 *     shared extra/ tree → the honest design keeps --part_dir SHARED (per-mic
 *     stacks never collide) and shards only --part_star. Real RELION writes
 *     ImageName paths relative to the STAR'S OWN DIR, so each shard star says
 *     ../extra/<mic>_extract.mrcs; the merge concatenates the block>=2 rows
 *     and STRIPS that leading ../ so the merged star resolves from the
 *     workdir root. A redirected --part_dir breaks the contract — refused
 *     before staging. And the awk that touches $1 must set FS=OFS=tab, or
 *     the STAR's tab-separated columns come back space-separated.
 *
 * t307 closes it, end to end:
 *   - ARRAY_TYPES (a name → star map) became ARRAY_FLAVORS (outArg +
 *     outStar + merge DIALECT: "star" | "rows" | "coords") — the rewrite
 *     targets each flavor's own output flag (--o / --odir / --part_star);
 *   - the UI's stepper covers all four types;
 *   - the MOCK's relion_preprocess grew the same teeth: it reads the input
 *     slice (loop-aware, #N column indices with a positional fallback),
 *     writes per-mic stacks into the shared extra/ tree, and writes
 *     particles.star with relpath-based ImageName paths — so the unsplit run
 *     says extra/… and each shard says ../extra/… honestly;
 *   - the script grew `mkdir -p "$OSHARD"` (somebody must own the shard dir
 *     — the old flavors' binaries created their own, extract's part_star
 *     does not).
 *
 * Phases (all through the REAL run route + REAL sweep):
 *   A   the demo truth (app alive, roster 21, mock listening)
 *   B   the ledger (source assertions: flavors, rewrite, merge dialects,
 *       part_dir guard, mock fakes, dialog)
 *   C   the live loop — ONE PIPELINE, both new flavors:
 *       C1  autopick with shards=3 → per-task rows witnessed, per-mic coords
 *           collected into the canonical micrographs/ (12 stars home), the
 *           record says "across 12 micrographs", the strip speaks
 *           "array 1-3%4"
 *       C2  extract with shards=2 consuming C1's MERGED coords → the rows
 *           merge strips ../ (the merged star's rows reference extra/…
 *           stacks that EXIST on disk), 122 particles across all 12
 *           micrographs, master COMPLETED
 *       C3  the control: extract WITHOUT shards → same fake, no array
 *           branch, particles.star still home
 *       C4  the honest refusal: class2d + shards → refused BEFORE staging
 *   D   console clean + roster restored to 21
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
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
const CONN = "qa-t307-array-pick";
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
// cluster-side trees this suite created (the t309 lesson: the mirror rm never
// matched the workdirs — they live under <remoteRoot>/<projectId>/, and the
// API job delete cleans the LOCAL twin only; the REFUSED dispatch (C4)
// stages nothing, so it notes nothing)
const remoteWorkdirs = [];
const projShells = new Set();
const noteRemote = (j) => {
  remoteWorkdirs.push(`/projects/cryoflow/${j.projectId}/${j.type}_${j.id.slice(-8)}`);
  projShells.add(j.projectId);
};
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

const starDataRows = (txt) =>
  txt
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("data_") && !t.startsWith("loop_") && !t.startsWith("_") && !t.startsWith("#");
    });

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
    if (accPre === "YES") client('cp "$HOME/.slurm/accounting" "$HOME/.slurm/accounting.t307snap"');
  } catch { accPre = "NO"; }

  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t307 Array Pick", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  connOk = mk.status === 201 || mk.status === 200;
  must(connOk, `the probeless connection exists (${mk.status})`);

  // ---- Phase B: the ledger ----------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const dlg = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");
  const preproc = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/relion_preprocess`, "utf8");
  const autopickFake = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/relion_autopick`, "utf8");

  must(
    src.includes('const ARRAY_FLAVORS: Record<') &&
      src.includes('motioncorr: { outArg: "--o", outStar: "corrected_micrographs.star", merge: "star" }') &&
      src.includes('ctffind: { outArg: "--o", outStar: "micrographs_ctf.star", merge: "star" }') &&
      src.includes('extract: { outArg: "--part_star", outStar: "particles.star", merge: "rows" }') &&
      src.includes('autopick: { outArg: "--odir", outStar: "", merge: "coords" }'),
    "B: the flavor table names all four types with outArg/outStar/merge (t306's two keep their dialect)"
  );
  must(
    src.includes("if (shardTotal >= 2 && !ARRAY_FLAVORS[job.type])") &&
      src.includes("cannot ride an array split"),
    "B: an ineligible type + shards is still refused BEFORE staging"
  );
  must(
    src.includes('flavor.outStar && flavor.outArg === "--part_star"') &&
      src.includes('k === ii + 1 ? \'"$SHARD"\' : k === oi + 1 ? outVal : shQuote(a)'),
    "B: the rewrite targets the flavor's OWN output flag (--o / --odir / --part_star)"
  );
  must(
      src.includes('flavor && flavor.outArg === "--part_star"') &&
      src.includes('? remoteWorkdir + "/" + flavor.outStar') &&
      src.includes('pdi < 0 || String(argv[pdi + 1] ?? "") === remoteWorkdir + "/"'),
    "B: the expected output per flavor + the shared --part_dir guard (rows merge demands the canonical part dir)"
  );
  must(
    src.includes('BEGIN{FS=OFS="\\\\t"}') &&
      src.includes('substr($1,i+1,3)=="../"') &&
      src.includes("block>=2 && NF>0{ ${rowsRewrite}; print; next }"),
    "B: the rows merge strips the leading ../ AFTER the @ (FS=OFS=tab — touching $1 must not space out the STAR columns)"
  );
  must(
    src.includes('{next}\' "$__f" >> "$__merged.cf-merge" 2>/dev/null || true'),
    "B: appended donors contribute ONLY block>=2 rows (the optics block must never duplicate)"
  );
  must(
    src.includes('mkdir -p ${shQuote(W + "/micrographs")}') &&
      src.includes('cp "${W}/shard_$__k"/micrographs/*_autopick.star "${W}/micrographs/"'),
    "B: the coords merge is a file COLLECTION into the canonical micrographs/ (per-mic names never collide)"
  );
  must(
    src.includes('mkdir -p "$OSHARD" || exit 111'),
    "B: the task body owns its shard dir (extract's part_star does not mkdir it — the old flavors' binaries did)"
  );
  must(
    src.includes('exec 9>>${shQuote(W + "/.cf-merge.lock")}') &&
      src.includes('flock 9') &&
      src.includes('[ -z "$(cat ${shQuote(W + "/.cf-exit")} 2>/dev/null)" ]'),
    "B: the count gate is FLOCK-SERIALIZED — two shards can read the full tally in the same breath, the loser finds the verdict spoken and stands down"
  );
  must(
    dlg.includes('new Set(["motioncorr", "ctffind", "extract", "autopick"])'),
    "B: the dialog's stepper covers all four flavors"
  );
  must(
    preproc.includes('if not star_in or not os.path.exists(star_in):') &&
      preproc.includes('sys.exit(1)') &&
      preproc.includes('parts[1].startswith("#")') &&
      preproc.includes('col = ncols'),
    "B: the mock's extract fake reads the input slice honestly (#N column indices + a positional fallback) and errors on a missing star"
  );
  must(
    preproc.includes("os.path.relpath(stack, star_dir)") &&
      preproc.includes('os.path.join(part_dir, "extra")'),
    "B: the mock's ImageName paths are relative to the STAR'S DIR (the ../ shape the rows merge strips — the contract, not a coincidence)"
  );
  must(
    autopickFake.includes('os.path.join(odir, "micrographs")') &&
      autopickFake.includes('_{pickname}.star'),
    "B: the mock's autopick fake writes per-mic coordinate stars (the coords merge's input contract)"
  );

  // ---- Phase C: the live loop — one pipeline, both flavors --------------------
  console.log("== PHASE C: the live loop ==");
  const micsDir = `${ROOT}/data/relion/t307-array/mics`;
  mkdirSync(micsDir, { recursive: true });
  for (let i = 1; i <= MICS; i++) {
    execSync(
      `node -e "const fs=require('fs');const b=Buffer.alloc(1024+64,0);b.write('mrc ',208);b.writeInt32LE(64,0);b.writeInt32LE(64,4);b.writeInt32LE(1,8);b.writeInt32LE(0,16);b.writeInt32LE(4,92);fs.writeFileSync('${micsDir}/mic-${String(i).padStart(2, "0")}.mrc',b)"`,
      { cwd: ROOT, stdio: "pipe" }
    );
  }
  const a0 = await mkJob({ type: "import", name: "t307 Import A0", params: { micrographsPath: micsDir, pixelSize: 1.77 }, x: 80, y: 80 });
  const runA0 = await fetch(`${BASE}/api/jobs/${a0.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA0.status === 200, `A0 imports locally (${runA0.status})`);
  const a0done = await pollUntil(async () => (await getJobs()).find((j) => j.id === a0.id)?.status, 30_000);
  must(a0done === "completed", `A0 completed — the provider has ${MICS} micrographs (got ${a0done})`);

  // ---- C1: autopick with shards=3 → the coords collection --------------------
  console.log("== PHASE C1: three picking shards, one canonical micrographs/ ==");
  const c1 = await mkJob({ type: "autopick", name: "t307 Pick C1", params: { pickingMethod: "Laplacian of Gaussian" }, x: 340, y: 80 });
  must(await mkEdge(a0.id, c1.id, "micrographs", "micrographs") === 201, "C1: the provider edge stands (201)");
  const disp1 = await dispatch(c1.id, CONN, { shards: 3 });
  must(disp1.status === 200 && !disp1.body?.error,
    `C1: the split dispatch went through (status ${disp1.status}, err=${disp1.body?.error ?? "-"})`);
  noteRemote(c1);
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
  const script1 = client(`cat /projects/cryoflow/${c1.projectId}/autopick_${c1.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  must(
    script1.includes("#SBATCH --array=1-3%4") &&
      script1.includes("--i \"$SHARD\"") &&
      script1.includes("--odir \"$OSHARD/\""),
    "C1: the SUBMITTED script carries the directive + the autopick swap (--i shard, --odir task subdir)"
  );
  must(
    script1.includes('mkdir -p') && script1.includes("/micrographs") &&
      /cp "[^"]*\/shard_\$__k"\/micrographs\/\*_autopick\.star "[^"]*\/micrographs\/" 2>\/dev\/null/.test(script1) &&
      script1.includes("-ge 3"),
    "C1: the count gate's merge is the coords COLLECTION (mkdir micrographs + cp the per-mic stars home)"
  );
  const taskRow1 = await pollUntil(() => {
    const w = journalWord(`${sId1}_1`);
    return w.startsWith("COMPLETED") ? w : null;
  }, 45_000, 900);
  must(!!taskRow1, `C1: task 1's own row says COMPLETED (${taskRow1 || "no row"})`);
  const master1 = await waitJournal(sId1, "COMPLETED", 60_000);
  must((master1 ?? "").startsWith("COMPLETED"), `C1: the MASTER row is COMPLETED (every rc was 0) (${master1 ?? "no row"})`);
  const tasks1 = [1, 2, 3].every((t) => journalWord(`${sId1}_${t}`).startsWith("COMPLETED"));
  must(tasks1, "C1: all three per-task rows say COMPLETED");
  const done1 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === c1.id)?.status;
    return s === "completed" ? s : null;
  }, 90_000);
  must(done1 === "completed", `C1: the sweep finalized the array (got ${done1 ?? "still running"})`);
  const rec1b = stateRuns()[c1.id];
  must(
    rec1b?.done === true && rec1b?.exitCode === 0,
    `C1: the record finalized done/exit 0 (done ${rec1b?.done}, exit ${rec1b?.exitCode})`
  );
  must(
    typeof rec1b?.result === "string" && rec1b.result.includes(`across ${MICS} micrographs`),
    `C1: the record's result counts ALL ${MICS} micrographs (${String(rec1b?.result).slice(0, 60)})`
  );
  const micStars = client(
    `ls /projects/cryoflow/${c1.projectId}/autopick_${c1.id.slice(-8)}/micrographs/ 2>/dev/null | grep -c '_autopick\\.star'`
  );
  must(
    Number(micStars) === MICS,
    `C1: the canonical micrographs/ holds one coordinate star per micrograph (${micStars}/${MICS})`
  );
  // the strip speaks the split — terminal, on the real page
  const strip1 = await pollUntil(async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await sleep(2000);
    const card = page.locator("[data-job]", { hasText: "t307 Pick C1" }).locator('[role="button"]').first();
    try { await card.click({ timeout: 6000, force: true }); } catch { return null; }
    await sleep(1200);
    const body = await page.locator("body").innerText();
    return /array 1-3%4/.test(body) ? body : null;
  }, 45_000, 2500);
  must(!!strip1, "C1: the strip speaks the split ('· array 1-3%4')");
  await page.screenshot({ path: `${SHOTS}/t307-pick-array-strip.png` }).catch(() => {});

  // ---- C2: extract with shards=2, consuming C1's MERGED coords ---------------
  console.log("== PHASE C2: two extraction shards merge their particle rows ==");
  const c2 = await mkJob({
    type: "extract", name: "t307 Extract C2",
    params: { boxSize: 128, downsampleTo: 0 },
    x: 600, y: 80,
  });
  must(await mkEdge(a0.id, c2.id, "micrographs", "micrographs") === 201, "C2: the micrographs edge stands (201)");
  must(await mkEdge(c1.id, c2.id, "coords", "coords") === 201, "C2: the coords edge from the SPLIT pick stands (201)");
  const disp2 = await dispatch(c2.id, CONN, { shards: 2 });
  must(disp2.status === 200 && !disp2.body?.error,
    `C2: the split dispatch went through (status ${disp2.status}, err=${disp2.body?.error ?? "-"})`);
  noteRemote(c2);
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
  const script2 = client(`cat /projects/cryoflow/${c2.projectId}/extract_${c2.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  must(
    script2.includes("#SBATCH --array=1-2%4") &&
      script2.includes('--part_star "$OSHARD/particles.star"'),
    "C2: the SUBMITTED script carries the directive + the part_star swap (shard star in the task subdir)"
  );
  must(
    script2.includes(`--part_dir '${rec2?.remote?.remoteWorkdir ?? "<W>"}/'`) ||
      (script2.includes("--part_dir") && !script2.includes("--part_dir \"$")),
    "C2: --part_dir stays SHARED (the canonical extra/ tree — the whole ../ strip depends on it)"
  );
  must(
    script2.includes('substr($1,i+1,3)=="../"') && script2.includes('BEGIN{FS=OFS="\\t"}'),
    "C2: the submitted rows-merge awk strips ../ after the @ with tab columns intact (the real thing, not a template)"
  );
  const taskRow2 = await pollUntil(() => {
    const w = journalWord(`${sId2}_1`);
    return w.startsWith("COMPLETED") ? w : null;
  }, 45_000, 900);
  must(!!taskRow2, `C2: task 1's own row says COMPLETED (${taskRow2 || "no row"})`);
  const master2 = await waitJournal(sId2, "COMPLETED", 60_000);
  must((master2 ?? "").startsWith("COMPLETED"), `C2: the MASTER row is COMPLETED (${master2 ?? "no row"})`);
  const done2 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === c2.id)?.status;
    return s === "completed" ? s : null;
  }, 90_000);
  must(done2 === "completed", `C2: the sweep finalized the array (got ${done2 ?? "still running"})`);
  const rec2b = stateRuns()[c2.id];
  must(
    rec2b?.done === true && rec2b?.exitCode === 0,
    `C2: the record finalized done/exit 0 (done ${rec2b?.done}, exit ${rec2b?.exitCode})`
  );
  // the deep honesty witness: the merged star's rows reference extra/… (no
  // ../ survives) AND every referenced stack EXISTS relative to the star.
  // Expected rows, computed from the fake's own per-mic formula (n = the
  // index WITHIN a shard's slice — 6 mics per shard here): shards × Σ per(n).
  const perMic = (n) => 8 + ((n * 2) % 5);
  const perShard = 6; // 12 mics / 2 shards
  const expectRows = 2 * Array.from({ length: perShard }, (_, i) => perMic(i + 1)).reduce((a, b) => a + b, 0);
  const mergedLocal = rec2b?.outputs?.particles_star;
  let mergedRows = -1;
  let slashDotDot = -1;
  let stacksHome = -1;
  if (mergedLocal && existsSync(mergedLocal)) {
    const rows = starDataRows(readFileSync(mergedLocal, "utf8")).filter((l) => l.includes("@"));
    mergedRows = rows.length;
    slashDotDot = rows.filter((l) => l.includes("@../")).length;
    const starDir = path.dirname(mergedLocal);
    stacksHome = rows.filter((l) => existsSync(path.join(starDir, l.split("@")[1].split("\t")[0]))).length;
  }
  must(
    mergedRows === expectRows,
    `C2: the merged particles.star lists ALL ${expectRows} particles across ${MICS} mics (got ${mergedRows} in ${mergedLocal ?? "no file"})`
  );
  must(
    slashDotDot === 0,
    `C2: NO ../ survives the merge (got ${slashDotDot} shard-relative rows)`
  );
  must(
    stacksHome === mergedRows,
    `C2: every referenced stack EXISTS relative to the merged star (${stacksHome}/${mergedRows})`
  );
  const extraStacks = client(
    `ls /projects/cryoflow/${c2.projectId}/extract_${c2.id.slice(-8)}/extra/ 2>/dev/null | grep -c '_extract\\.mrcs'`
  );
  must(
    Number(extraStacks) === MICS,
    `C2: the shared extra/ tree holds one stack per micrograph — zero collisions (${extraStacks}/${MICS})`
  );

  // ---- C3: the control — extract WITHOUT shards ------------------------------
  console.log("== PHASE C3: no split, same fake, no array branch ==");
  const c3 = await mkJob({
    type: "extract", name: "t307 Extract C3",
    params: { boxSize: 128, downsampleTo: 0 },
    x: 600, y: 300,
  });
  must(await mkEdge(a0.id, c3.id, "micrographs", "micrographs") === 201, "C3: the micrographs edge stands (201)");
  must(await mkEdge(c1.id, c3.id, "coords", "coords") === 201, "C3: the coords edge stands (201)");
  const disp3 = await dispatch(c3.id, CONN);
  must(disp3.status === 200 && !disp3.body?.error, `C3: the plain dispatch went through (${disp3.status})`);
  noteRemote(c3);
  const rec3 = await pollUntil(() => {
    const r = stateRuns()[c3.id];
    return r?.remote?.slurmId ? r : null;
  }, 45_000);
  must(!!rec3, "C3: the submission has a scheduler id");
  sbatchIds.push(Number(rec3?.remote?.slurmId));
  must(rec3?.remote?.slurmArray === undefined, "C3: the record carries NO slurmArray");
  const script3 = client(`cat /projects/cryoflow/${c3.projectId}/extract_${c3.id.slice(-8)}/.cf-sbatch.sh 2>/dev/null`);
  must(
    !script3.includes("#SBATCH --array=") &&
      !script3.includes('if [ -n "${SLURM_ARRAY_TASK_ID:-}" ]; then') &&
      script3.includes("--part_star"),
    "C3: no directive, no shard branch — the single-job contract is byte-identical to pre-t306"
  );
  const done3 = await pollUntil(async () => {
    const s = (await getJobs()).find((j) => j.id === c3.id)?.status;
    return s === "completed" ? s : null;
  }, 90_000);
  must(done3 === "completed", `C3: the plain run completed (got ${done3 ?? "still running"})`);
  const rec3b = stateRuns()[c3.id];
  const local3 = rec3b?.outputs?.particles_star;
  // the unsplit fake counts per-mic n over ALL 12 micrographs (not per-shard)
  const expectUnsplit = Array.from({ length: MICS }, (_, i) => perMic(i + 1)).reduce((a, b) => a + b, 0);
  must(
    !!local3 && existsSync(local3) && starDataRows(readFileSync(local3, "utf8")).filter((l) => l.includes("@")).length === expectUnsplit,
    `C3: the unsplit run's star lists all ${expectUnsplit} particles with the fake's own extra/ paths`
  );

  // ---- C4: the honest refusal — ineligible type + shards ---------------------
  console.log("== PHASE C4: a split refine-style job is refused, not un-split ==");
  const c4 = await mkJob({ type: "class2d", name: "t307 Refuse C4", x: 600, y: 520 });
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
    const card = page.locator("[data-job]", { hasText: "t307 Extract C2" }).locator('[role="button"]').first();
    await card.click({ timeout: 6000, force: true });
    await sleep(1400);
    await page.screenshot({ path: `${SHOTS}/t307-extract-array-inspector.png` });
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
    const parts = [
      // the staged input mirror + the REAL workdirs + the project shells if
      // WE emptied them (rmdir, never rm -rf — the t309 lesson)
      "rm -rf /projects/cryoflow/t307-array",
      ...remoteWorkdirs.map((wd) => `rm -rf ${wd}`),
      // + the staged provider copies — every dispatch stages its input chain
      // at the provider's mapped path (import_* dirs), the t30 batch's own
      // residue proved no suite burned those (the t309 lesson, upgraded)
      "rm -rf /projects/cryoflow/*/autopick_* /projects/cryoflow/*/extract_* /projects/cryoflow/*/import_*",
    ];
    for (const id of sbatchIds) {
      parts.push(`rm -f "$HOME/.slurm/job-${id}."* "$HOME/.slurm/.launch-${id}.sh"`);
      parts.push(`rm -f "$HOME/.slurm/job-${id}_"* 2>/dev/null`);
    }
    parts.push('rm -f "$HOME/.slurm/"job-*.cancelled');
    if (accPre === "YES") {
      parts.push('mv "$HOME/.slurm/accounting.t307snap" "$HOME/.slurm/accounting" 2>/dev/null || true');
    } else {
      parts.push('rm -f "$HOME/.slurm/accounting"');
    }
    parts.push('rm -f "$HOME/.slurm/accounting.t307snap"');
    // dead bookkeeping sweep — accounting and next-id are the mock's MEMORY
    // and stay (the t309 lesson)
    parts.push('rm -f "$HOME/.slurm/"job-*.sh "$HOME/.slurm/"job-*.pid "$HOME/.slurm/"job-*.name "$HOME/.slurm/"job-*.start "$HOME/.slurm/"job-*.state "$HOME/.slurm/".launch-*.sh 2>/dev/null || true');
    parts.push(...[...projShells].map((p) => `rmdir /projects/cryoflow/${p} 2>/dev/null || true`));
    client(parts.join("; "));
    // the residue guard: loud, not load-bearing (the t309 lesson)
    const leftover = client("ls -A /projects/cryoflow 2>/dev/null");
    if (leftover) console.log(`  (cleanup) RESIDUE left on the cluster: ${leftover.split(/\s+/).filter(Boolean).join(", ")}`);
  } catch { /* best effort */ }
  try { rmSync(`${ROOT}/data/relion/t307-array`, { recursive: true, force: true }); } catch { /* gone */ }
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

console.log(fail === 0 ? "\nT307 ALL PASS" : `\nT307 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
