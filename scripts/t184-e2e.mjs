/* t184 — one directory gets one name (the last cwd debt).
 *
 * Task 183 convicted the boot race and installed CRYOFLOW_DATA_DIR as the
 * absolute escape hatch for DATA_DIR — but only the run engine honored it.
 * The HPC layer kept re-deriving its own copies from process.cwd():
 * slurm.ts's private DATA_DIR + every default profile's localRoot, and the
 * sbatch route's localWorkdir. Caught red-handed at selection time: on a
 * server whose /proc/<pid>/environ carried CRYOFLOW_DATA_DIR=/home/z/
 * my-project/data, GET /api/hpc/profiles answered localRoot="/home/z/
 * my-project/.next/standalone/data/relion" — two names for one directory,
 * coincident only while the start-prod.sh symlink ritual holds.
 *
 * And the disease went deeper than routes: engine-state.json records
 * written by pre-183 servers persist workdir/logFile/outputs paths spelled
 * through .next/standalone/data — a fossil name that dies in every build
 * window and resolves only while the symlink exists. Fix ② heals them at
 * the single read boundary (readRuns → healFossilSpellings): disk keeps
 * its history, every consumer sees one name.
 *
 * Probe layers:
 *   S  baseline world (roster 21, profiles reachable, expected root
 *      resolved from the SERVER's CRYOFLOW_DATA_DIR via /proc when present)
 *   X  source oracles — after a conservative comment-strip: exactly two
 *      process.cwd() in the whole src tree (paths.ts definition + glob.ts
 *      documented anchor), exactly ONE join(DATA_DIR,"relion"), the HPC
 *      layer importing the contract names, the healing installed at the
 *      read boundary
 *   B  live wire — every profile's localRoot EQUALS the override-honoring
 *      string (pre-fix it named the standalone ghost); the classes workdir
 *      boundary rejects outside paths; dashboard console clean; and the
 *      PRIVATE STAGE (t177 doctrine): a fossil-spelled star path injected
 *      into a run record + the standalone symlink hidden — a pre-184
 *      server answers "Waiting for upstream output", the healed server
 *      resolves through the contract name and builds the script
 *   Z  restore proof — roster identity, engine-state.json restored
 *      byte-for-byte, symlink back, probe fixtures deleted, read-only
 *      registry never written
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, renameSync, rmSync } from "fs";
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const REPO = process.cwd();
const OVERRIDE = process.env.CRYOFLOW_DATA_DIR ?? null;
const DATA_DIR = OVERRIDE ?? path.join(REPO, "data");
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");

/**
 * Conservative comment stripper — NOT a parser, so it only trusts comment
 * shapes this codebase actually uses: doc blocks that START a line, and //
 * comments preceded by line start or whitespace. A first draft stripped
 * every "/*…*\/" and every "//…" and ATE CODE: glob.ts's "//wsl.localhost"
 * string literal and regex-literal stars forged comment openers, the
 * process.cwd() anchor vanished, and the oracle lied. Strings win over
 * stripper heuristics — always.
 */
const stripComments = (s) =>
  s
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, "")
    .replace(/\/\*[^*\n]*\*\//g, "")
    .replace(/^[ \t]*\/\/[^\n]*$/gm, "")
    .replace(/[ \t]\/\/[^\n]*/g, "");

let pass = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}
function section(name) {
  console.log(`== ${name} ==`);
}

const browser = await chromium.launch();
const consoleErrors = [];
const failedUrls = [];
function trackConsole(pageRef, label) {
  pageRef.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ label, text: msg.text() });
  });
  pageRef.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push({ label, url: res.url(), status: res.status() });
  });
}

/* ================= S — baseline world ================= */
section("S: baseline world");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);

const profiles0 = (await (await fetch(BASE + "/api/hpc/profiles")).json()).profiles ?? [];
must(profiles0.length >= 3, `S2 profile registry reachable (${profiles0.length} profiles)`);

// The expected root from the SERVER's env (the probe's own env is NOT the
// server's — the server was booted by start-prod.sh with the override; the
// probe shell may not carry it). /proc is sandbox-only; fall back to the
// ghost-absence contract on machines without it.
let serverRoot = null;
try {
  const { execSync } = await import("child_process");
  const pid = execSync("ss -tlnp | grep ':3000' | grep -oP 'pid=\\K[0-9]+' | head -1")
    .toString()
    .trim();
  const env = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
  const v = env.find((e) => e.startsWith("CRYOFLOW_DATA_DIR="));
  if (v) serverRoot = path.join(v.split("=")[1], "relion");
} catch {
  /* /proc or ss unavailable — ghost-absence mode */
}
must(
  true,
  serverRoot ? `S3 expected root from SERVER env (${serverRoot})` : "S3 server env unreadable — ghost-absence mode"
);

const completedJobs = jobs0.filter((j) => j.status === "completed");
must(completedJobs.length > 0, `S4 completed jobs exist for the dry-run stage (${completedJobs.length})`);

/* ================= X — source oracles ================= */
section("X: the contract is written once");
// walk the WHOLE src tree — a hand-picked file list would let a straggler
// hide behind the probe's own sampling (the mocked-contract lesson)
function walkSrc(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkSrc(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const allFiles = walkSrc("src");
const codeOf = {};
for (const p of allFiles) codeOf[p] = stripComments(src(p));

const cwdSites = [];
for (const [p, code] of Object.entries(codeOf)) {
  const n = (code.match(/process\.cwd\(\)/g) ?? []).length;
  if (n > 0) cwdSites.push({ p, n });
}
const cwdTotal = cwdSites.reduce((a, s) => a + s.n, 0);
must(cwdTotal === 2, `X1 process.cwd() after strip = 2 across the whole src tree (${cwdTotal}: ${cwdSites.map((s) => `${s.p}×${s.n}`).join(", ")})`);
must(
  cwdSites.some((s) => s.p === "src/lib/paths.ts") &&
    cwdSites.some((s) => s.p === "src/lib/relion/glob.ts"),
  "X2 the two cwd anchors are paths.ts (definition) and glob.ts (relative-pattern base)"
);

const joinSites = [];
for (const [p, code] of Object.entries(codeOf)) {
  const n = (code.match(/join\(DATA_DIR,\s*["']relion["']\)/g) ?? []).length;
  if (n > 0) joinSites.push({ p, n });
}
must(
  joinSites.length === 1 && joinSites[0].p === "src/lib/paths.ts",
  `X3 join(DATA_DIR,"relion") lives ONLY in paths.ts (${joinSites.map((s) => `${s.p}×${s.n}`).join(", ") || "none"})`
);

const pathsCode = codeOf["src/lib/paths.ts"];
must(/export const RELION_DIR = path\.join\(DATA_DIR, ["']relion["']\)/.test(pathsCode), "X4 paths.ts exports RELION_DIR");

const slurmCode = codeOf["src/lib/hpc/slurm.ts"];
must(
  /import \{ DATA_DIR, RELION_DIR \} from ["']@\/lib\/paths["']/.test(slurmCode),
  "X5 slurm.ts imports the contract names (no private derivation)"
);
must(!/localRoot:\s*path\.join\(/.test(slurmCode), "X6 no default profile builds localRoot by hand (all three speak RELION_DIR)");
must((slurmCode.match(/localRoot: RELION_DIR/g) ?? []).length === 3, "X7 all three default profiles carry localRoot: RELION_DIR");

const sbatchCode = codeOf["src/app/api/hpc/sbatch/[id]/route.ts"];
must(
  !/process\.cwd\(\)/.test(sbatchCode) && /path\.join\(RELION_DIR,/.test(sbatchCode),
  "X8 sbatch route derives localWorkdir from RELION_DIR"
);

const classesCode = codeOf["src/app/api/jobs/[id]/classes/route.ts"];
must(
  !/join\(DATA_DIR,\s*["']relion["']\)/.test(classesCode) && /RELION_DIR/.test(classesCode),
  "X9 classes route boundary + fallback speak RELION_DIR"
);

const engineRaw = src("src/lib/relion/engine.ts");
must(
  /healFossilSpellings\(value\)/.test(engineRaw) &&
    /const FOSSIL_DATA_RE = /.test(engineRaw) &&
    engineRaw.indexOf("function readRuns") < engineRaw.indexOf("healFossilSpellings(value)"),
  "X10 readRuns heals fossil spellings at the parse boundary (before caching)"
);

must(
  /Task 184 anchor audit/.test(src("src/lib/relion/glob.ts")) &&
    /Task 184 anchor audit/.test(src("src/app/api/fs/browse/route.ts")),
  "X11 both remaining cwd anchors carry the audit comment"
);

/* ================= B — live wire ================= */
section("B: every consumer honors the override");
const prof1 = (await (await fetch(BASE + "/api/hpc/profiles")).json()).profiles ?? [];
const ghostFree = prof1.every((p) => !String(p.localRoot).includes(".next"));
must(ghostFree, `B1 no profile's localRoot names the standalone ghost (${prof1.map((p) => p.localRoot).join(" | ")})`);
const allMatch = serverRoot
  ? prof1.every((p) => p.localRoot === serverRoot)
  : prof1.every((p) => p.localRoot.endsWith("/data/relion"));
must(allMatch, serverRoot ? `B2 every localRoot === ${serverRoot} (override honored)` : "B2 every localRoot ends at data/relion");

// t251: the classes route now carries the same-origin door (t251 sibling
// closure) — authenticate the probe so it still REACHES the containment
// layer it exists to test (B3/B4 assert the workdir boundary, not the door).
const outside = await fetch(`${BASE}/api/jobs/${completedJobs[0].id}/classes?workdir=/etc`, {
  headers: { Origin: BASE },
});
must(outside.status === 400, `B3 classes workdir boundary rejects outside paths (status ${outside.status})`);
const outsideMsg = await outside.json();
must(
  typeof outsideMsg.error === "string" && outsideMsg.error.includes("data/relion"),
  "B4 the rejection names the contract tree (message speaks data/relion)"
);

/* ---- the private stage: fossil records must heal at the read boundary ---- */
let stage = { ok: false, control: false, decisive: false, scriptHasRoot: false };
try {
  const statePath = path.join(DATA_DIR, "engine-state.json");
  const dataLink = path.join(REPO, ".next", "standalone", "data");
  const linkAlive = existsSync(dataLink);
  must(linkAlive, "B5 stage precondition: standalone data symlink present");
  if (linkAlive) {
    const origBytes = readFileSync(statePath);
    let fixtureFile = null;
    try {
      const runs = JSON.parse(origBytes.toString("utf8"));
      const motioncorrId = completedJobs.find((j) => j.type === "motioncorr")?.id;
      must(!!motioncorrId, `B6 stage precondition: a completed motioncorr job exists (${motioncorrId ?? "none"})`);
      // resolveInputs reads the UPSTREAM IMPORT record's outputs (the
      // provider), not the motioncorr's — resolve the provider through the
      // graph so the stage never guesses lineage from job order
      const edges = (await (await fetch(BASE + "/api/edges")).json()).edges ?? [];
      const intoMotioncorr = edges.filter((e) => String(e.toJobId ?? e.to) === motioncorrId);
      const providerId = intoMotioncorr
        .map((e) => String(e.fromJobId ?? e.from))
        .find((id) => runs[id]?.type === "import" && runs[id]?.done && runs[id]?.exitCode === 0);
      must(!!providerId, `B7 stage precondition: the wired import provider record is done (${providerId ?? "none"})`);
      if (providerId) {
        const rec = runs[providerId];
        // fossil-spelled star field + REAL file at the CONTRACT spelling —
        // the two spellings name the same inode only while the symlink lives
        const cleanStar = String(rec.workdir) + "/micrographs.star";
        const fossilStar = cleanStar.replace(DATA_DIR, path.join(REPO, ".next", "standalone", "data"));
        rec.outputs = { ...(rec.outputs ?? {}), micrographs_star: fossilStar };
        writeFileSync(statePath, JSON.stringify(runs));
        writeFileSync(cleanStar, "# STAR (t184 fossil-healing stage fixture)\nloop_\n_rlnMicrographName\nmic_001.mrc\nmic_002.mrc\n");
        fixtureFile = cleanStar;

        const dryUrl = `${BASE}/api/hpc/sbatch/${motioncorrId}?profile=local-workstation`;
        // control: symlink alive, fossil field — both spellings name the same
        // inode, so resolveInputs must get past input resolution. The sandbox
        // has no RELION binaries, so the dry-run then refuses for THAT reason
        // (an honest environmental wall AFTER the contract boundary) — the
        // assertion is the resolution boundary, not a full script.
        const c1 = await (await fetch(dryUrl)).json();
        stage.control = !String(c1.error ?? "").includes("Waiting for upstream output");
        must(stage.control, `B8 control (symlink alive): fossil field resolves past input resolution (${c1.error ? `stopped later: ${String(c1.error).slice(0, 60)}` : "script built"})`);

        // decisive: hide the symlink — the fossil name dies, the contract name survives
        renameSync(dataLink, dataLink + ".t184-hidden");
        let restored = false;
        try {
          const c2 = await (await fetch(dryUrl)).json();
          const err2 = String(c2.error ?? "");
          stage.decisive = !err2.includes("Waiting for upstream output");
          stage.scriptHasRoot = stage.decisive;
          must(stage.decisive, stage.decisive
            ? `B9 DECISIVE (symlink hidden): fossil is dead yet input resolution SUCCEEDS via the healed spelling — pre-184 said "Waiting for upstream output"; this server says: ${err2 ? String(c2.error).slice(0, 60) : "script built"}`
            : `B9 symlink hidden: resolution FAILED — error: ${err2} (pre-fix behavior: fossil ENOENT)`);
          must(stage.scriptHasRoot, "B10 resolution success IS the contract proof (script generation sits downstream of the sandbox's binary wall)");
        } finally {
          renameSync(dataLink + ".t184-hidden", dataLink);
          restored = existsSync(dataLink);
        }
        must(restored, "B11 stage restore: symlink back in place");
      }
    } finally {
      writeFileSync(statePath, origBytes);
      if (fixtureFile) rmSync(fixtureFile, { force: true });
    }
    stage.ok = readFileSync(statePath).equals(origBytes) && existsSync(dataLink);
    must(stage.ok, "B12 stage restore: engine-state.json byte-identical, fixture deleted");
  }
} catch (e) {
  must(false, `B5-B12 private stage crashed: ${e.message}`);
}

const page = await browser.newPage();
trackConsole(page, "dashboard");
try {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  must(
    consoleErrors.filter((e) => e.label === "dashboard").length === 0,
    "B13 dashboard console clean (contract imports don't disturb the bundle)"
  );
} finally {
  await browser.close();
}

/* ================= Z — restore + read-only proof ================= */
section("Z: restore + read-only proof");
const afterList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(afterList.length === jobs0.length, `Z1 roster size unchanged (${afterList.length})`);
const afterIds = new Set(afterList.map((j) => j.id));
must(jobs0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
must(!existsSync(path.join(DATA_DIR, "hpc-profiles.json")), "Z3 GET never wrote hpc-profiles.json (read-only registry)");
must(!existsSync(path.join(DATA_DIR, "relion")) || !readdirSync(path.join(DATA_DIR, "relion")).some((n) => n.includes("t184")), "Z4 no t184 fixture residue under relion/");
const badTraffic = failedUrls.filter((u) => (u.status ?? 0) >= 500 || (u.status === 404 && !u.url.includes("/favicon")));
must(badTraffic.length === 0, `Z5 no 5xx/404 browser traffic (${badTraffic.length})`);

console.log(
  failures.length === 0
    ? `\nT184 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT184 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
