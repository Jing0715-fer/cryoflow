#!/usr/bin/env node
// family-run.mjs — the family batch runner: serial by law, solo-retry for the transient.
//
// WHY THIS EXISTS (the qa49 precedent, twice-observed): suites run back-to-back
// compete for resources (browser processes, port 3000, playwright workers) and a
// suite can FAIL in the batch while passing SOLO. A batch FAIL is not a verdict
// until a solo re-run has heard the case. This script makes that law executable:
//
//   1. SERIAL — suites run one at a time, never in parallel (spawnSync).
//   2. SOLO RETRY — a FAIL gets a 4s breath, then one solo re-run:
//        solo PASS  → SOLO-RECOVERY (transient, the qa49 signature)
//        solo FAIL  → REAL-FAIL (a verdict, needs a human)
//   3. EXIT CODE — 0 iff zero REAL-FAILs (SOLO-RECOVERY is honest but not a blocker).
//
// The FAMILY roster is an audited membership list (34 suites as of Task 256) —
// it is written here EXPLICITLY, not discovered by glob: diag-*/probe scripts and
// one-off hearings are not family. When a new suite joins the family, add it here.
//
// Usage:
//   node scripts/family-run.mjs                 # the whole family, serial
//   node scripts/family-run.mjs --filter t249   # only suites whose name contains "t249"
//   node scripts/family-run.mjs --batch t27     # a FIRST-CLASS batch (the decade boundary)
//   node scripts/family-run.mjs --batches       # list the batches + their members, run nothing
//   node scripts/family-run.mjs --list          # print the roster (with batch tags), run nothing
//   node scripts/family-run.mjs --summary       # print the family summary from the last reports, run nothing
//   node scripts/family-run.mjs --reset         # delete the accumulated report file, run nothing
//
// t273 — batches are first-class: the decade boundary IS the batch boundary
// (the t26 batch grew to 12 suites and HAD to be split — the 600s tool
// ceiling is a batch boundary, a law that used to live only in the agent's
// memory). Every run writes a machine-readable report
// (scripts/.family-report.json), one entry per batch key, MERGED not
// overwritten — after the seven foreground batches the file IS the family
// truth, and --summary speaks it so the worklog never hand-copies numbers
// again.
//
// Self-test hook (the runner testing its own retry law):
//   FAMILY_DRILL=t249 node scripts/family-run.mjs --filter t249
//     Forces the FIRST run of the named suite to report failure (exit 1 is
//     overridden to 1 — the transient is simulated), so the solo-retry path
//     executes for real: the solo re-run is a genuine run, and the suite should
//     come back SOLO-RECOVERY. Drill mode never fabricates the final verdict —
//     it only drills the first attempt.
//
// Per-suite timeout: 240s (t223 carries 155 assertions; the slowest family member).

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = path.join(ROOT, "scripts");

// ---- the audited family roster (Task 250) ---------------------------------
// Order matters only for readability: qa sentinels first, then the t-chronicle.
const FAMILY = [
  "qa00-data-view.mjs", // the data-view sentinel
  "qa63-smoke.mjs", // the smoke sentinel
  "qa47-e2e.mjs",
  "qa49-e2e.mjs", // the suite whose transient named the law
  "qa50-e2e.mjs",
  "qa51-e2e.mjs",
  "qa55-e2e.mjs",
  "qa57-e2e.mjs",
  "qa58-e2e.mjs",
  "qa84-e2e.mjs",
  "qa68-legacy-archive.mjs", // the quarantine sentinel: the root stays free of the era trees, the archive stays complete, and a staged intrusion flips the detector 0->2->0 (Task 274)
  "t210-e2e.mjs", // 151 assertions — the heaviest
  "t212-e2e.mjs",
  "t213-e2e.mjs",
  "t214-e2e.mjs",
  "t215-e2e.mjs",
  "t218-e2e.mjs",
  "t219-e2e.mjs",
  "t221-e2e.mjs",
  "t223-e2e.mjs", // 155 assertions — the other heavy
  "t241-run-echo.mjs",
  "t242-e2e.mjs",
  "t243-e2e.mjs",
  "t244-e2e.mjs",
  "t245-e2e.mjs",
  "t246-e2e.mjs",
  "t247-e2e.mjs",
  "t248-e2e.mjs",
  "t249-e2e.mjs",
  "t251-hardening-gates.mjs",
  "t252-write-gates.mjs",
  "t253-e2e.mjs",
  "t254-subvolume-export.mjs",
  "t255-send-to-job.mjs",
  "t256-map-card.mjs", // the Import Map identity card
  "t257-reference-card.mjs", // the consumer-side reference card (Task 257)
  "t258-view-in-3d.mjs", // the cards' View in 3D buttons (Task 258)
  "t259-metadata-gates.mjs", // the application-metadata door (Task 259)
  "t260-clip-from-card.mjs", // the cards' Show-in-parent anchored-clip doors (Task 260)
  "t261-remote-connections.mjs", // the remote-cluster registry: doors + test route + live probe (Task 261)
  "t262-remote-run-e2e.mjs", // the remote ENGINE live: stage → dispatch → poll → sync-back → stop (Task 262)
  "t263-remote-hardening.mjs", // the three t262 audit findings, witnessed: heartbeat / orphan heal / ghost door (Task 263)
  "t264-remote-externals.mjs", // externals belong to the world they run in: probe inventories cluster motioncor2/topaz, cluster argvs carry cluster paths (Task 264)
  "t265-remote-topaz-train.mjs", // the train→pick loop closed on the cluster: staged coordinate_files index, byte-identical model sync-back, twin pass-through (Task 265)
  "t266-topaz-training-curve.mjs", // the training curve's first living witness: gated route, wild-shape stub, dual-mount on Results, best-test dot (Task 266)
  "t267-probeless-dispatch.mjs", // a never-probed connection is probed BY the dispatch: auto-probe persists, honest refusal names the door (Task 267)
  "t268-probe-cost-heartbeat.mjs", // the probe's cost becomes visible (durationMs on dot/card/log) + the staging heartbeat caught beating under a tunable interval (Task 268)
  "t269-time-ledger.mjs", // the run's two cluster waits become a ledger: stagedMs at the spawn handoff, syncMs at finalize, spoken by the terminal strip (Task 269)
  "t270-run-resume.mjs", // the connection's run résumé: the dialog aggregates total/completed/failed + the ≤3 newest ledgers — a stopped run speaks only its staged leg (Task 270)
  "t271-resume-jump.mjs", // the résumé becomes an index: a jumpable entry is a real button (name + ledger + hover arrow) that closes the dialog and opens that job's inspector; a deleted job's record leaves with it (Task 271)
  "t272-cross-canvas-resume.mjs", // the cross-canvas loop closes: a second project's run renders as a history row that NAMES the canvas it lives on (per-entry existence), and deleting that project sweeps its records with it — no orphans (Task 272)
  "t273-family-report.mjs", // the runner tests itself: first-class batches (decade boundary), the merged JSON report, --summary/--reset, and the 600s-ceiling health guard (Task 273)
  "t276-empiar-fidelity.mjs", // real data speaks: EMPIAR-10017's real RELION 5.0.1 artifacts through our parsers (optics truth, FSC self-consistency, honest-zero cella) and the real bundle riding the product's import + manualpick VERBATIM (Task 276)
  "t278-ortho-crosshair.mjs", // the tri-planar focus point: crosshair lines mark where sibling planes cut, clicking an image picks the point, sliders step one voxel — and the résumé helper stops lying over gone rows (Task 278)
  "t279-ortho-export-focus.mjs", // the triptych leaves the app: one publishing-grid PNG of the three sections (crosshair + focus footer), and the focus point rides in every saved view — capture, restore, import check, server clamp (Task 279)
  "t280-ortho-sigma-chips.mjs", // σ walks over to the 2D side: the ortho panel's header chip + export footer carry the isosurface contour (pull on mount, push on change), and bookmark rows show WHERE the inspection happened (Task 280)
  "t281-density-probe.mjs", // the density probe: hovering an ortho tile reads the voxel under the cursor (format=value, a single-voxel pread) — solid sky cursor lines, a corner chip speaking value @ x,y,z, three-axes-one-voxel mapping proof (Task 281)
  "t282-updated-at-honesty.mjs", // updatedAt honesty: a same-value/empty PATCH no longer touches @updatedAt (Prisma's @updatedAt fires per update CALL) — the dashboard's 'updated X ago' answers the last REAL edit, not the last request; the idle-reset intent stays exempt (Task 282)
  "t283-histogram-sigma-pick.mjs", // the histogram speaks: the volume's density distribution as a strip (format=histogram, chunked two-pass + cache) with a σ ruler and the current contour as a cut line — CLICKING it sets the contour (ORTHO_SIGMA_SET completes the σ family), sign follows the clicked side of the mean (Task 283)
  "t284-quick-histogram.mjs", // the quick look speaks distributions: the strip lifted into density-histogram.tsx (ONE drawing truth, two consumers) and the quick-look dialog renders it read-only (default OFF, per-file reset) — plus the dialog learns to scroll (max-h/overflow: tall content was clipped, pre-existing) (Task 284)
  "t286-display-window.mjs", // the histogram COMMANDS the display: an explicit lo/hi window overrides the 2–98 percentile stretch (literal mapping, no auto-inversion), σ preset chips + draggable lo/hi handles on the dialog's strip, bars outside the window dim — the render and the strip read ONE window state (Task 286)
  "t287-stack-histogram.mjs", // the stack speaks: a .mrcs histogram is PER SLICE (&slice=N required — an unnamed stack histogram is a blur with no subject; a volume+slice is refused), the dialog grows a slice cursor (prev/next/range/readout) driving ONE slice view + the SAME instrument, and stepping the slice resets the display window (a different image is a different distribution) (Task 287)
  "t289-window-input.mjs", // the window takes orders in every dialect: the strip's readout became lo/hi TYPEABLE fields (Enter/blur commits, tab lo→hi doesn't commit early, an invalid pair restores the live window) and the stack montage follows the window ONLY through an explicit toggle (default off — sixteen images are sixteen distributions; the toggle survives slice steps, the window does not) (Task 289)
  "t291-ortho-hist-footer.mjs", // the footer carries the distribution: the triptych export fetches the map's histogram (8s timeout, honest absence) and draws it as a log-scaled thumbnail between name and stats — σ ruler + cyan cut line, measure-first layout that never collides, the raster grows 616→638; the suite decodes the PNG pixel-by-pixel (Node zlib) to prove the bars and the cut are ON the canvas (Task 291)
  "t293-remote-borrow.mjs", // the borrow gets its guard: t290's five-part cluster-borrow feature (by-value probe, Run ▾ mode switch, root hint, key-files policy + manifest, on-demand lazy fetch at the outputs/file 404 branch) rode no suite — this one guards the shared door: probe persists nothing (ok + bad-password honest), the cap skips a planted 2 MB map into the manifest, the listing shows it REMOTE (size+label, no dims), the png door pulls it byte-identical (sha256) and the tile graduates to local WITH dims (Task 292)
  "t294-resume-forget.mjs", // the résumé's forget door: a gone row grows a hover-revealed X that deletes ONE dead record — three honest refusals (404 no record / 409 not-remote / 409 job still alive, checked BEFORE the delete), the door renders only on exists===false rows, a refusal lands in a role=alert line, a success reloads the list (Task 294)
  "t295-resume-panorama.mjs", // the résumé's panorama and the bulk forget: the expand toggle serves the SAME aggregate at the wide aperture ({ all: true } — same shape, t272 grades ride along) so history past the three-row fold is visible; DELETE /api/remote/records retires every DEAD record of one connection — the whole batch's existence is settled BEFORE anything dies, live records are kept and counted, the UI door is armed two-step and renders ONLY over the full picture (a count computed from a fold would understate the blast radius); the ledger also pins launch.sh's absolute-path exec (the cleanup pattern can finally find the cmdline) (Task 295)
  "t296-big-map-viewer.mjs", // the big map's verdict: a REAL reconstruction-scale volume (256³ float32 = 64 MB, 64× the demo's voxel count) walks mapimport → identity card → Mol* — the raw route streams 67 MB flat, ParseCcp4 + isosurface commit inside the 120 s gate (~15 s live), 5σ contour recomputes on 16.7M voxels, the histogram's cold full-grid scan (~1 s) collapses to an LRU hit on the second look; the suite FOUND the out-of-tree symlink lockout (mapimport symlinked its source — the containment policy honest 400'd every png/raw/histogram fetch while the identity card spoke stats) and pins the hardlink-first materialization (Task 296)
];

// ---- batches are first-class (t273) ----------------------------------------
// The decade boundary is the batch boundary: qa sentinels, then the t-chronicle
// split at every two-digit decade (t21x / t22x / t24x / …). A NEW DECADE
// ("t28…") must be REGISTERED here — the coverage check in --batches names any
// suite that fell through, so a forgotten registration is loud, not silent.
const BATCHES = [
  { name: "qa", match: /^qa/ },
  { name: "t21", match: /^t21/ },
  { name: "t22", match: /^t22/ },
  { name: "t24", match: /^t24/ },
  { name: "t25", match: /^t25/ },
  { name: "t26", match: /^t26/ },
  { name: "t27", match: /^t27/ },
  { name: "t28", match: /^t28/ },
  { name: "t29", match: /^t29/ },
];
const batchOf = (file) => BATCHES.find((b) => b.match.test(file))?.name ?? null;

// The accumulated report (one JSON file, one entry per batch key, MERGED per
// run). scripts/.family-report.json — a dotfile: scratch data, not a deliverable.
// FAMILY_REPORT (t273's isolation law): the report path is overridable per
// process. The runner tests itself — t273 spawns REAL family-run children —
// and without an override the nested runs would read, merge into, and
// --reset the OUTER run's accumulating report (observed live: the t27
// family batch's report was wiped to a single entry by its own member's
// reset). A nested world writes its own file; the outer truth stays whole.
const REPORT_FILE = process.env.FAMILY_REPORT || path.join(SCRIPTS, ".family-report.json");
const readReport = () => {
  try {
    const parsed = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
    return parsed && typeof parsed === "object" && parsed.batches ? parsed : { batches: {} };
  } catch {
    return { batches: {} };
  }
};
const writeReport = (report) => writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);

// ---- paint (defined BEFORE the CLI reads it — the --batches/--summary
// branches above the old location would have hit the temporal dead zone)
const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};
const NO_COLOR = process.env.NO_COLOR || !process.stdout.isTTY;
const paint = NO_COLOR ? { green: (s) => s, yellow: (s) => s, red: (s) => s, dim: (s) => s, bold: (s) => s } : C;

// ---- CLI -------------------------------------------------------------------
const args = process.argv.slice(2);
const flagOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "usage: node scripts/family-run.mjs [--filter <substring>] [--batch <name>] [--batches] [--list] [--summary] [--reset]\n" +
      "  --batch <name>   run one first-class batch (qa / t21 / t22 / t24 / t25 / t26 / t27)\n" +
      "  --batches        list the batches and their members (coverage-checked), run nothing\n" +
      "  --summary        print the family summary from scripts/.family-report.json, run nothing\n" +
      "  --reset          delete the accumulated report file, run nothing\n" +
      "  FAMILY_DRILL=<suite>  drill the solo-retry path (first attempt of <suite> fails)",
  );
  process.exit(0);
}
const filter = flagOf("--filter");
const batchArg = flagOf("--batch");

// --batches — the batch registry, coverage-checked. A suite that matches NO
// batch is an orphan: the roster grew, the batch registry did not — loud red,
// not a silent skip.
if (args.includes("--batches")) {
  const orphans = FAMILY.filter((f) => batchOf(f) === null);
  console.log(`FAMILY BATCHES — ${BATCHES.length} batches over ${FAMILY.length} suites (the decade boundary is the batch boundary):`);
  for (const b of BATCHES) {
    const members = FAMILY.filter((f) => batchOf(f) === b.name);
    console.log(`  ${b.name.padEnd(4)} ${paint.dim(`${members.length} suite${members.length === 1 ? "" : "s"}`)}  ${members.join(", ")}`);
  }
  if (orphans.length) {
    console.log(paint.red(`  ORPHANS — suites matching NO batch (register the decade in BATCHES): ${orphans.join(", ")}`));
    process.exitCode = 2;
  } else {
    console.log(paint.green(`  coverage: every one of the ${FAMILY.length} suites belongs to exactly one batch`));
  }
  process.exit(process.exitCode ?? 0);
}

// --summary — the accumulated report, spoken. The worklog's regression lines
// are machine-copyable from here on.
if (args.includes("--summary")) {
  const report = readReport();
  const keys = Object.keys(report.batches);
  if (!keys.length) {
    console.log(paint.yellow("no family report yet — run a batch (--batch <name> / --filter <s>) and the report will accumulate here"));
    process.exit(0);
  }
  const line = paint.dim("─".repeat(72));
  console.log(`FAMILY REPORT — ${keys.length} batch${keys.length === 1 ? "" : "es"} on file (${REPORT_FILE.replace(ROOT + "/", "")}):`);
  console.log(line);
  let totPass = 0, totSolo = 0, totFail = 0, totWall = 0;
  for (const k of keys) {
    const b = report.batches[k];
    totPass += b.pass; totSolo += b.soloRecovery; totFail += b.realFail; totWall += b.wallMs;
    const flag = b.realFail > 0 ? paint.red("✗") : b.soloRecovery > 0 ? paint.yellow("↻") : paint.green("✓");
    console.log(
      `  ${flag} ${k.padEnd(12)} pass ${String(b.pass).padStart(2)}  solo ${b.soloRecovery}  real-fail ${b.realFail}` +
        paint.dim(`  wall ${(b.wallMs / 1000).toFixed(1)}s  ${b.lastRun}`),
    );
  }
  console.log(line);
  console.log(
    `  ${paint.bold("TOTAL")}          pass ${String(totPass).padStart(2)}  solo ${totSolo}  real-fail ${totFail}` +
      paint.dim(`  wall ${(totWall / 1000).toFixed(1)}s`),
  );
  process.exit(totFail > 0 ? 1 : 0);
}

// --reset — scratch data, scratched.
if (args.includes("--reset")) {
  try { rmSync(REPORT_FILE, { force: true }); } catch { /* already gone */ }
  console.log(`family report reset (${REPORT_FILE.replace(ROOT + "/", "")} removed)`);
  process.exit(0);
}

if (args.includes("--list")) {
  console.log(`FAMILY ROSTER — ${FAMILY.length} suites (serial by law, solo-retry for the transient):`);
  for (const s of FAMILY) console.log(`  [${batchOf(s) ?? "??"}] ${s}`);
  process.exit(0);
}

// ---- the law, executable ---------------------------------------------------
const SUITE_TIMEOUT = 240_000;
const SOLO_BREATH_MS = 4_000;
const TAIL = 8; // failure transcript lines shown per attempt

const drill = process.env.FAMILY_DRILL || null;

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- environment guards (the OOM-adaptation law) ---------------------------
// The box is a 4GB OOM-prone cage (87 kernel kills and counting). A 28-suite
// batch pressures it: the standalone server holds ~2.7GB, each suite births a
// chromium, and the OOM killer does not care WHO it reaps — the second family
// run (Task 250) was murdered mid-batch along with the watchdog and the server.
// So the runner now guards the ENVIRONMENT, not just the verdicts:
//   1. MEM GATE    — before each suite, if MemAvailable < 500MB, wait for it to
//                    recover (15s polls, max 8). Running on the edge only
//                    manufactures fake FAILs and invites the killer.
//   2. SERVER GATE — before each suite, the server must answer; if it died
//                    (OOM), wait for the watchdog to resurrect it (20 polls).
//                    A suite run against a dead server is not a verdict — it's
//                    noise; SKIPPED(SERVER) keeps that noise out of REAL-FAIL.
//   3. BREATH      — 3s between suites: let chromium fully exit and the heap
//                    settle before the next suite spikes it again.
const MEM_FLOOR_KB = 500_000;
const memAvailableKb = () => {
  try {
    const line = readFileSync("/proc/meminfo", "utf8").split("\n").find((l) => l.startsWith("MemAvailable:"));
    return Number(line?.match(/\d+/)?.[0] ?? 0);
  } catch {
    return Number.MAX_SAFE_INTEGER; // if we cannot read it, don't block on it
  }
};
const serverUp = () => {
  try {
    const res = spawnSync("curl", ["-s", "-o", "/dev/null", "--max-time", "3", "http://localhost:3000/"]);
    return res.status === 0;
  } catch {
    return false;
  }
};
async function waitEnvironment(file) {
  for (let i = 0; i < 8 && memAvailableKb() < MEM_FLOOR_KB; i++) {
    if (i === 0) console.log(paint.yellow(`  … ${file}: MemAvailable ${(memAvailableKb() / 1024).toFixed(0)}MB < ${MEM_FLOOR_KB / 1024}MB — waiting for the heap to settle`));
    await sleepMs(15_000);
  }
  for (let i = 0; i < 20 && !serverUp(); i++) {
    if (i === 0) console.log(paint.yellow(`  … ${file}: server down — waiting for the watchdog to resurrect it`));
    await sleepMs(3_000);
  }
  return serverUp();
}

// ASYNC SPAWN WITH GROUP KILL — the pipe-trap lesson, learned live in the first
// family run: a suite's browser grandchildren inherit the stdio pipes, so when
// the suite hangs, a plain child.kill() takes the node process but leaves the
// browser holding the pipe open — and an await on that pipe hangs the runner
// PAST ITS OWN TIMEOUT (observed: qa49's solo re-run froze the whole batch at
// 09:23, the 240s ceiling never fired). Root fix in two halves:
//   detached: true  — the child becomes a process-group leader, so
//                     process.kill(-pid, SIGKILL) takes the WHOLE tree
//                     (node, the agent-browser CLI, the browser) at once;
//   stream destroy  — killing the tree releases the pipe, so 'close' fires and
//                     the await returns. The 240s ceiling becomes a real
//                     ceiling, not a suggestion.
async function runSuite(file) {
  const t0 = Date.now();
  const child = spawn("node", [path.join(SCRIPTS, file)], {
    cwd: ROOT,
    detached: true, // its own process group — the group kill depends on this
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  child.stdout.on("data", (d) => chunks.push(d));
  child.stderr.on("data", (d) => chunks.push(d));
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-child.pid, "SIGKILL"); // the whole tree, not just node
    } catch {
      /* the group is already gone */
    }
    child.stdout.destroy(); // release the pipe so 'close' can fire
    child.stderr.destroy();
  }, SUITE_TIMEOUT);
  const exitCode = await new Promise((resolve) => {
    child.on("close", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
  clearTimeout(timer);
  // drill: the named suite's FIRST attempt is forced to fail (the simulated transient)
  if (drill && file.startsWith(drill) && !runSuite.drilled) {
    runSuite.drilled = true;
    return { code: 1, ms: Date.now() - t0, timedOut: false, out: Buffer.concat(chunks).toString("utf8") };
  }
  return { code: exitCode ?? 1, ms: Date.now() - t0, timedOut, out: Buffer.concat(chunks).toString("utf8") };
}

const tail = (out, n = TAIL) =>
  out
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(-n)
    .map((l) => `      │ ${l}`)
    .join("\n");

// t273 — the roster is chosen by FIRST-CLASS BATCH or by substring, and the
// report key records which world this run belongs to (a batch key replaces the
// whole batch entry; an ad-hoc filter gets its own adhoc:<filter> key).
let roster = null;
let reportKey = "all";
if (batchArg) {
  const batch = BATCHES.find((b) => b.name === batchArg);
  if (!batch) {
    console.log(
      paint.red(`no batch named "${batchArg}"`) +
        paint.dim(` — the first-class batches are: ${BATCHES.map((b) => b.name).join(", ")} (--batches lists their members)`),
    );
    process.exit(2);
  }
  roster = FAMILY.filter((f) => batchOf(f) === batchArg);
  reportKey = batchArg;
} else if (filter) {
  roster = FAMILY.filter((f) => f.includes(filter));
  reportKey = `adhoc:${filter}`;
}
if (!roster) roster = FAMILY;
if (roster.length === 0) {
  console.log(paint.red(`no family member matches --filter ${filter}`));
  process.exit(2);
}

// The batch health guard (t273): "the 600s tool ceiling is a batch boundary"
// was agent memory — now it is the runner's memory. If THIS batch key's last
// recorded wall time approached the ceiling, say so BEFORE burning the time.
const priorBatch = readReport().batches[reportKey];
if (priorBatch?.wallMs > 550_000) {
  console.log(
    paint.yellow(
      `  ⚠ the "${reportKey}" batch last took ${(priorBatch.wallMs / 1000).toFixed(0)}s — close to the 600s tool ceiling. Consider splitting at the decade boundary.`,
    ),
  );
}

console.log(
  paint.bold(`\nFAMILY RUN — ${roster.length} suite${roster.length === 1 ? "" : "s"}`) +
    paint.dim(` · batch "${reportKey}" · serial by law · solo-retry for the transient · timeout ${SUITE_TIMEOUT / 1000}s`) +
    (drill ? paint.yellow(` · DRILL=${drill} (first attempt of the drilled suite is forced to fail)`) : "") +
    "\n",
);

const verdicts = { PASS: [], "SOLO-RECOVERY": [], "REAL-FAIL": [], "SKIPPED(SERVER)": [] };
const runSuiteMs = new Map(); // the deciding attempt's wall time, per suite (the report's ledger)
const t0 = Date.now();

for (const file of roster) {
  if (!existsSync(path.join(SCRIPTS, file))) {
    verdicts["REAL-FAIL"].push(file);
    console.log(paint.red(`  ✗ ${file.padEnd(22)} MISSING — roster names a file that is not on disk`));
    continue;
  }
  const first = await (async () => {
    await sleepMs(3_000); // the inter-suite breath
    if (!(await waitEnvironment(file))) {
      verdicts["SKIPPED(SERVER)"].push(file);
      console.log(paint.yellow(`  ⊘ SKIPPED(SERVER) ${file.padEnd(22)} — the box could not host a verdict`));
      return null;
    }
    return runSuite(file);
  })();
  if (!first) continue;
  const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

  if (first.code === 0) {
    verdicts.PASS.push(file);
    runSuiteMs.set(file, first.ms);
    console.log(
      `  ${paint.green("✓ PASS")}         ${file.padEnd(22)} ${paint.dim(secs(first.ms))}`,
    );
    continue;
  }

  // first attempt failed — was it the timeout?
  if (first.timedOut) {
    console.log(paint.red(`  ✗ TIMEOUT       ${file.padEnd(22)} ${secs(first.ms)} — killed at ${SUITE_TIMEOUT / 1000}s`));
  } else {
    console.log(paint.yellow(`  … FAIL          ${file.padEnd(22)} ${secs(first.ms)} — solo re-run after ${SOLO_BREATH_MS / 1000}s breath`));
    if (first.out.trim()) console.log(paint.dim(tail(first.out)));
  }

  await sleepMs(SOLO_BREATH_MS); // the breath: let resources settle
  const envOk = await waitEnvironment(file); // the solo run deserves the same guarantees
  const solo = envOk ? await runSuite(file) : { code: 1, timedOut: false, ms: 0, out: "" };

  if (solo.code === 0 && envOk) {
    verdicts["SOLO-RECOVERY"].push(file);
    runSuiteMs.set(file, solo.ms);
    console.log(`  ${paint.yellow("↻ SOLO-RECOVERY")} ${file.padEnd(22)} ${paint.dim(`solo ${secs(solo.ms)} — the transient, caught in the act`)}`);
  } else {
    verdicts["REAL-FAIL"].push(file);
    runSuiteMs.set(file, solo.ms || first.ms);
    console.log(paint.red(`  ✗ REAL-FAIL     ${file.padEnd(22)} solo ${secs(solo.ms)} — a verdict, needs a human`));
    if (first.out.trim()) console.log(paint.dim(`      first attempt:\n${tail(first.out)}`));
    if (solo.out.trim()) console.log(paint.dim(`      solo re-run:\n${tail(solo.out)}`));
  }
}

// ---- the summary ------------------------------------------------------------
const wall = ((Date.now() - t0) / 1000).toFixed(1);
const { PASS, "SOLO-RECOVERY": soloRec, "REAL-FAIL": realFail } = verdicts;
const line = paint.dim("─".repeat(72));
console.log(`\n${line}`);
console.log(
  `  ${paint.bold("FAMILY VERDICT")}` +
    `  ${paint.green(`pass ${PASS.length}`)}` +
    `  ${paint.yellow(`solo-recovery ${soloRec.length}`)}` +
    `  ${paint.red(`real-fail ${realFail.length}`)}` +
    paint.dim(`  · wall ${wall}s`),
);
if (soloRec.length) console.log(`  ${paint.yellow("transients heard:")} ${soloRec.join(", ")}`);
if (realFail.length) console.log(`  ${paint.red("real failures:")} ${realFail.join(", ")}`);
console.log(line);

// ---- the report (t273) ------------------------------------------------------
// One JSON entry per batch key, MERGED into the accumulated file — the seven
// foreground batches build the family truth one batch at a time, and --summary
// speaks it. attempts: 1 = first-try PASS, 2 = heard (solo recovery or real
// fail), 0 = skipped (the box could not host a verdict).
try {
  const suites = roster.map((file) => {
    const verdict =
      (verdicts.PASS.includes(file) && "pass") ||
      (verdicts["SOLO-RECOVERY"].includes(file) && "solo-recovery") ||
      (verdicts["REAL-FAIL"].includes(file) && "real-fail") ||
      (verdicts["SKIPPED(SERVER)"].includes(file) && "skipped-server") ||
      "unknown";
    const ms =
      (verdicts.PASS.includes(file) && runSuiteMs.get(file)) ||
      (verdicts["SOLO-RECOVERY"].includes(file) && runSuiteMs.get(file)) ||
      (verdicts["REAL-FAIL"].includes(file) && runSuiteMs.get(file)) ||
      0;
    return { name: file, verdict, ms, attempts: verdict === "pass" ? 1 : verdict === "skipped-server" ? 0 : 2 };
  });
  const report = readReport();
  report.batches[reportKey] = {
    lastRun: new Date().toISOString(),
    suites,
    pass: PASS.length,
    soloRecovery: soloRec.length,
    realFail: realFail.length,
    skippedServer: verdicts["SKIPPED(SERVER)"].length,
    wallMs: Math.round((Date.now() - t0)),
  };
  writeReport(report);
  console.log(paint.dim(`  report → ${REPORT_FILE.replace(ROOT + "/", "")} · key "${reportKey}" (--summary speaks the accumulated truth)`));
} catch (e) {
  console.log(paint.yellow(`  report write failed (${e.message}) — the verdict above still stands`));
}

process.exit(realFail.length > 0 ? 1 : 0);
