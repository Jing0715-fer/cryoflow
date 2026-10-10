/**
 * t391 — the MPI-launcher lane bench (bun run scripts/t391-mpirun-lane.ts).
 *
 * The user's field report, verbatim: a 7-rank class2d submitted through the
 * sbatch lane died at
 *
 *   /var/spool/slurm/d/job124714/slurm_script: line 145: mpirun: command
 *   not found
 *
 * …with the receipt blaming "the executable … is missing from the selected
 * RELION install (Re-detect or switch installs)". Both halves were wrong:
 * the script's 127-gates proved relion_refine and relion_refine_mpi resolve
 * (they live in RELION_HOME/bin), and the thing bash could not find was
 * mpirun — the MPI RUNTIME, which never ships inside a RELION install. The
 * probe had SEEN it (relionMpi=true is what routed the job onto the mpirun
 * lane in the first place) but recorded only a boolean. The same report's
 * tail convicted the run's OWN run.out/run.err as "left behind by an
 * EARLIER run" — the t367 generation gate compared cluster mtimes against
 * the APP HOST's clock. Six contracts:
 *
 *   A  the probe records the LOCATION: the ceremony's mpirun line is the
 *      path (mpi derives from the same find), mergeVerifiedModule folds it
 *      into relionMpirunPath, emptyProbe carries the empty map;
 *   B  the builder bytes: both lanes emit the t391 leg ONLY for mpirun
 *      commands, the PATH fallback only when the probe recorded a path,
 *      the two lanes' blocks are byte-identical, the leg follows the
 *      relion_refine_mpi gate, and every combination passes bash -n;
 *   C  the leg EXECUTED: the fallback rescues a lane whose PATH lacks
 *      mpirun (probed dir + -x), never overrides a lane that already has
 *      one, the -x miss refuses with the teaching 127 (Module field, MPI
 *      LAUNCHER, not part of the RELION install), and the null-path
 *      upgrade window names the re-probe;
 *   D  the 127 verdict decodes by the missing command's name: the user's
 *      exact stderr line → the MPI verdict (not the install verdict), our
 *      own gate's line → the same, relion_* keeps the install story,
 *      anything else gets the PATH story;
 *   E  the generation gate's clock: the dispatch reads the CLUSTER's date
 *      once before staging, the finalize prefers it over the app host's
 *      startedAt — and the arithmetic shows why (an app clock 10 minutes
 *      ahead convicts the run's own 5-second-old run.out under the old
 *      reference, not under the cluster one);
 *   F  the sync-back find, executed from the source's own bytes: the
 *      t385 archive (.cryoflow_prev) is excluded, real files are not.
 */
import { mkdtempSync, writeFileSync, rmSync, chmodSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildSbatchScript,
  buildWrapperScript,
  missingCommandFromEvidence,
  describeMissingCommand,
} from "../src/lib/remote/remote-run";
import { emptyProbe, mergeVerifiedModule } from "../src/lib/remote/probe";
import type { RemoteConnection } from "../src/lib/remote/types";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const conn = {
  id: "c1",
  name: "bench",
  host: "192.168.2.253",
  port: 22,
  username: "lijing",
  envLines: [],
  slurmPartition: null,
} as unknown as RemoteConnection;

// the field report's own command shape: 7 ranks, the t345 launcher, the MPI
// binary — what argv[0] === "mpirun" produced on the failing dispatch.
const MPI_COMMAND =
  'mpirun -n "$CF_RANKS" /data03/Lijing/cryoflow/s1/class2d_ab2f/.cf-rank-launch.sh relion_refine_mpi --i particles.star --o run --gpu 0';
const SERIAL_COMMAND = "relion_refine --i particles.star --o run --gpu 0,1,2,3,4,5 --j 6";

const build = (lane: "sbatch" | "wrapper", args: {
  command: string;
  mpiLaunch: boolean;
  mpirunPath: string | null;
}) =>
  lane === "sbatch"
    ? buildSbatchScript({
        conn,
        module: "relion",
        relionHome: "/data2/home/relion5/relion2/relion-master/build",
        ctffind: null,
        command: args.command,
        gpus: 6,
        ntasks: 7,
        threads: 4,
        jobName: "cf_bench",
        remoteProjectRoot: "/data03/Lijing/cryoflow/s1",
        remoteWorkdir: "/data03/Lijing/cryoflow/s1/class2d_ab2f",
        preflightStar: null,
        mpiLaunch: args.mpiLaunch,
        mpirunPath: args.mpirunPath,
      })
    : buildWrapperScript({
        conn,
        module: "relion",
        relionHome: "/data2/home/relion5/relion2/relion-master/build",
        ctffind: null,
        command: args.command,
        preflightStar: null,
        remoteProjectRoot: "/data03/Lijing/cryoflow/s1",
        remoteWorkdir: "/data03/Lijing/cryoflow/s1/class2d_ab2f",
        mpiLaunch: args.mpiLaunch,
        mpirunPath: args.mpirunPath,
      });

const T391_HEAD = "# ---- t391: the MPI launcher — mpirun is NOT part of the RELION install ----";
/** the leg's span: from its banner to the teaching gate's last line. */
function t391Block(s: string): string | null {
  const head = s.indexOf(T391_HEAD);
  if (head < 0) return null;
  const gate = s.indexOf("exit 127; }", head);
  if (gate < 0) return null;
  return s.slice(head, gate + "exit 127; }".length);
}

console.log("A — the probe records the LOCATION (module → mpirun path)");
{
  // the ceremony's stdout: what `module load relion/5.0.1; command -v …`
  // prints on a module that bundles MPI — the mpirun line is the PATH.
  // The parse lives inside probeModuleDetail (bench-covered live by the
  // t310 E2E against the mock); here the CONTRACT is the merge + the
  // source's own parse line.
  const probe = mergeVerifiedModule(emptyProbe(), "relion/5.0.1", {
    home: "/opt/relion-5.0.1",
    mpi: true,
    mpirunPath: "/opt/ohpc/pub/utils/openmpi/4.1.5/bin/mpirun",
    ctffind: null,
    externals: {},
    loadRc: null,
    loadError: null,
    execError: null,
  });
  must(
    probe.relionMpirunPath?.["relion/5.0.1"] === "/opt/ohpc/pub/utils/openmpi/4.1.5/bin/mpirun",
    "mergeVerifiedModule folds the sighting into relionMpirunPath"
  );
  must(Array.isArray(probe.relionModules) && probe.relionModules.includes("relion/5.0.1"), "the module joins the roster (the merge stands)");
  must(
    probe.relionMpi["relion/5.0.1"] === true,
    "the boolean keeps its old shape (the MPI lane still routes on it)"
  );
  must(emptyProbe().relionMpirunPath != null && Object.keys(emptyProbe().relionMpirunPath!).length === 0, "emptyProbe carries the empty map");

  // a module with NO mpirun: the merge must not invent an entry
  const noMpi = mergeVerifiedModule(emptyProbe(), "relion/4.4.1", {
    home: "/opt/relion-4.4.1",
    mpi: false,
    mpirunPath: null,
    ctffind: null,
    externals: {},
    loadRc: null,
    loadError: null,
    execError: null,
  });
  must(!("relion/4.4.1" in (noMpi.relionMpirunPath ?? {})), "a module without mpirun leaves no map entry");

  // the parse's own shape (source truth): the line IS the location
  const probeSrc = readFileSync("src/lib/remote/probe.ts", "utf8");
  must(
    probeSrc.includes('const mpirunLine = lines.find((l) => l.startsWith("/") && /\\/mpirun$/.test(l)) ?? null;'),
    "the ceremony's mpirun line is found as an absolute path (the line IS the location)"
  );
  must(probeSrc.includes("mpi: mpirunLine != null,"), "the boolean derives from the same find (one truth)");
  must(probeSrc.includes("base.relionMpirunPath = mpirunPath;"), "the sweep's probe carries the map");
}

console.log("B — the builder bytes (the leg rides only mpirun commands)");
{
  const PROBED = "/opt/ohpc/pub/utils/openmpi/4.1.5/bin/mpirun";
  let sbatchBytes: string | null = null;
  let wrapperBytes: string | null = null;
  for (const lane of ["sbatch", "wrapper"] as const) {
    const withPath = build(lane, { command: MPI_COMMAND, mpiLaunch: true, mpirunPath: PROBED });
    const block = t391Block(withPath);
    must(block != null, `[${lane}] the t391 leg is present for an mpirun command`);
    if (!block) continue;
    must(
      block.includes(`[ -x ${PROBED.slice(0, PROBED.lastIndexOf("/"))}/mpirun ]`),
      `[${lane}] the PATH fallback names the probed binary (guarded by -x)`
    );
    const binDir = PROBED.slice(0, PROBED.lastIndexOf("/"));
    must(
      block.includes(`export PATH=${binDir}:$PATH`) || block.includes(`export PATH='${binDir}':$PATH`),
      `[${lane}] the fallback exports the probed bin dir (prepended — shQuote keeps safe paths bare)`
    );
    must(
      block.includes("CRYOFLOW_ERR: mpirun is not on this lane's PATH"),
      `[${lane}] the teaching 127 gate exists`
    );
    must(
      block.includes("not part of the RELION install"),
      `[${lane}] the gate says the launcher is not RELION's to ship`
    );
    must(
      block.includes("connection's Module field"),
      `[${lane}] the gate names the Module field (the fix)`
    );
    must(
      block.includes(`resolved mpirun at ${PROBED}`),
      `[${lane}] the sighting sentence quotes the probed path`
    );
    // ordering: the leg follows the relion_refine_mpi gate
    const iMpiGate = withPath.indexOf("relion_refine_mpi not found on PATH");
    must(
      iMpiGate >= 0 && withPath.indexOf(T391_HEAD) > iMpiGate,
      `[${lane}] the launcher gate follows the relion_refine_mpi gate`
    );

    // the null-path upgrade window: no -x fallback, the re-probe wording
    const nullPath = build(lane, { command: MPI_COMMAND, mpiLaunch: true, mpirunPath: null });
    const nullBlock = t391Block(nullPath);
    must(nullBlock != null && !nullBlock.includes("[ -x "), `[${lane}] a null probe path emits no -x fallback`);
    must(
      nullBlock != null && nullBlock.includes("re-run Test & probe"),
      `[${lane}] the null-path gate names the re-probe (the upgrade window)`
    );

    // a command that does NOT ride mpirun never sees the leg (the VDAM
    // single-rank lane, CPU jobs, serial refinements)
    const serial = build(lane, { command: SERIAL_COMMAND, mpiLaunch: false, mpirunPath: PROBED });
    must(t391Block(serial) == null, `[${lane}] a non-mpirun command carries no t391 leg`);
    must(!serial.includes("mpirun is not on this lane's PATH"), `[${lane}] no mpirun gate text leaks into serial lanes`);

    if (lane === "sbatch") sbatchBytes = block;
    else wrapperBytes = block;
  }
  must(
    sbatchBytes != null && sbatchBytes === wrapperBytes,
    "the two lanes' t391 legs are byte-identical (one shared helper, no drift)"
  );

  // bash -n every combination (the scripts must at least PARSE)
  const dir = mkdtempSync(path.join(tmpdir(), "cf-t391-n-"));
  let n = 0;
  for (const lane of ["sbatch", "wrapper"] as const) {
    for (const command of [MPI_COMMAND, SERIAL_COMMAND]) {
      for (const mpiLaunch of [true, false]) {
        for (const mpirunPath of [PROBED, null]) {
          const script = build(lane, { command, mpiLaunch, mpirunPath });
          const f = path.join(dir, `s${n++}.sh`);
          writeFileSync(f, script);
          const r = spawnSync("bash", ["-n", f], { encoding: "utf8" });
          must(r.status === 0, `bash -n [${lane} mpiLaunch=${mpiLaunch} path=${mpirunPath ? "yes" : "null"}]`, r.stderr?.slice(0, 200));
        }
      }
    }
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log("C — the leg EXECUTED (real bash, the builder's own bytes)");
{
  const dir = mkdtempSync(path.join(tmpdir(), "cf-t391-x-"));

  // a fixture world the probed path can rescue: a fake mpirun in a dir the
  // lane's PATH does not name
  const probedBin = path.join(dir, "ohpc", "openmpi", "bin");
  mkdirSync(probedBin, { recursive: true });
  const fakeMpirun = path.join(probedBin, "mpirun");
  writeFileSync(fakeMpirun, "#!/bin/sh\necho 'mock mpirun ranks dispatched'\n");
  chmodSync(fakeMpirun, 0o755);

  // the builder's leg for a probe that resolved THIS path (POSIX-ized for
  // the sandbox: the contract is the bytes' behaviour, not the mount)
  const probed = fakeMpirun.split(path.sep).join("/");
  const leg = t391Block(
    build("sbatch", { command: MPI_COMMAND, mpiLaunch: true, mpirunPath: probed })
  )!;

  // (a) the rescue: PATH without mpirun → the fallback adds it, the NOTE
  // speaks, command -v resolves to the probed binary
  const rescue = spawnSync("bash", ["-c", `${leg}\ncommand -v mpirun`], {
    encoding: "utf8",
    env: { ...process.env, PATH: "/usr/bin:/bin" },
  });
  must(rescue.status === 0, "the fallback rescues a PATH-less lane (gate silent)", rescue.stderr?.slice(0, 200));
  must(rescue.stdout.trim().endsWith(probed), "command -v finds the probed binary after the fallback", `got: ${JSON.stringify(rescue.stdout)}`);
  must(rescue.stdout.includes("CRYOFLOW_NOTE: mpirun was not on this lane's PATH"), "the rescue prints its receipt");

  // (b) PATH-first priority: a lane that ALREADY has an mpirun keeps it —
  // the -x fallback never overrides a world that works
  const otherBin = path.join(dir, "other");
  mkdirSync(otherBin, { recursive: true });
  const otherMpirun = path.join(otherBin, "mpirun");
  writeFileSync(otherMpirun, "#!/bin/sh\necho 'the PATH one'\n");
  chmodSync(otherMpirun, 0o755);
  const keep = spawnSync("bash", ["-c", `${leg}\ncommand -v mpirun`], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${otherBin}:/usr/bin:/bin` },
  });
  must(keep.status === 0, "a lane that already has mpirun passes the gate");
  must(keep.stdout.trim().endsWith(otherMpirun.split(path.sep).join("/")), "the PATH's own mpirun wins (the fallback never overrides)");
  must(!keep.stdout.includes("CRYOFLOW_NOTE"), "no rescue receipt when nothing needed rescuing");

  // (c) the -x miss: the probed binary is not executable HERE → the gate
  // refuses with the teaching 127 (the field report's one-liner, replaced)
  rmSync(fakeMpirun);
  const miss = spawnSync("bash", ["-c", leg], {
    encoding: "utf8",
    env: { ...process.env, PATH: "/usr/bin:/bin" },
  });
  must(miss.status === 127, "a lane the probe cannot rescue exits 127 (one second, not one allocation)");
  must(
    (miss.stderr ?? "").includes("CRYOFLOW_ERR: mpirun is not on this lane's PATH"),
    "the refusal speaks the CRYOFLOW_ERR dialect (the receipt reads it)"
  );
  must(
    (miss.stderr ?? "").includes("not part of the RELION install") &&
      (miss.stderr ?? "").includes("Module field"),
    "the refusal teaches: not RELION's to ship + the Module field fix"
  );
  must(
    (miss.stderr ?? "").includes(`resolved mpirun at ${probed}`),
    "the refusal quotes where the probe last saw it"
  );

  // (d) the upgrade window: a pre-t391 saved probe (null path) — the gate
  // names the re-probe instead of a location
  const nullLeg = t391Block(
    build("wrapper", { command: MPI_COMMAND, mpiLaunch: true, mpirunPath: null })
  )!;
  const nullRun = spawnSync("bash", ["-c", nullLeg], {
    encoding: "utf8",
    env: { ...process.env, PATH: "/usr/bin:/bin" },
  });
  must(nullRun.status === 127, "the upgrade-window gate also refuses honestly");
  must(
    (nullRun.stderr ?? "").includes("re-run Test & probe"),
    "the upgrade window names the re-probe (the location was never recorded)"
  );

  rmSync(dir, { recursive: true, force: true });
}

console.log("D — the 127 verdict decodes by the missing command's name");
{
  // the user's exact stderr line (the field report)
  const evidence = [
    "CRYOFLOW_NOTE: starting 7 MPI ranks — 1 CPU master plus 6 workers",
    "----- stderr -----",
    "/var/spool/slurm/d/job124714/slurm_script: line 145: mpirun: command not found",
  ].join("\n");
  const cmd = missingCommandFromEvidence(evidence);
  must(cmd === "mpirun", "the user's exact line decodes to 'mpirun'", `got: ${JSON.stringify(cmd)}`);

  const meaning = cmd ? describeMissingCommand(cmd) : null;
  must(meaning != null, "mpirun gets its own verdict (not the install story)");
  must(
    meaning != null && meaning.includes("NOT part of the RELION install"),
    "the verdict says the launcher is not RELION's to ship"
  );
  must(
    meaning != null && meaning.includes("Module field"),
    "the verdict names the Module field fix"
  );
  must(
    meaning != null && !meaning.includes("Re-detect or switch installs"),
    "the verdict no longer sends the user hunting installs (the old wrong story)"
  );

  // our own gate's line decodes the same way (the receipt never sees bash's
  // one-liner — only ours)
  must(
    missingCommandFromEvidence("CRYOFLOW_ERR: mpirun is not on this lane's PATH — this job runs the MPI layout") === "mpirun",
    "the teaching gate's own line decodes to 'mpirun'"
  );

  // an absolute invocation keeps the basename
  must(
    missingCommandFromEvidence("/bin/bash: line 9: /opt/x/bin/mpirun: command not found") === "mpirun",
    "an absolute invocation decodes by basename"
  );

  // a relion_* binary keeps the install story (describeExitCode's word)
  must(
    describeMissingCommand("relion_refine_mpi") === null,
    "a relion_* absence keeps the install verdict (null = describeExitCode speaks)"
  );

  // any other command gets the PATH story
  const other = describeMissingCommand("somedep_tool");
  must(
    other != null && other.includes("somedep_tool") && other.includes("environment lines"),
    "a non-relion, non-MPI absence gets the PATH verdict"
  );

  // no signature at all
  must(missingCommandFromEvidence("Segmentation fault (core dumped)") === null, "no command-not-found signature decodes to null");
  must(missingCommandFromEvidence("") === null, "empty evidence decodes to null");
}

console.log("E — the generation gate's clock (the cluster's, not the app host's)");
{
  const src = readFileSync("src/lib/remote/remote-run.ts", "utf8");
  // the dispatch reads the cluster clock BEFORE any staging byte lands.
  // t397 re-plumbed the read: it rides the twin-freshness census round
  // (twinCensusScript's clock tail) with a standalone `date +%s` fallback
  // when no twin needs checking — both BEFORE the uploads plan, and the
  // value is grafted onto remoteState by assignment (absent on failure,
  // never a refusal — the same contract, one serialized round fewer).
  const iCensus = src.indexOf("twinCensusScript(twinCensus.map((t) => t.twin)");
  const iFallback = src.indexOf('await exec(conn, "date +%s", { timeoutMs: 10_000 })');
  const iUploads = src.indexOf("let needsStaging = false;");
  const iGraft = src.indexOf("if (dispatchClusterSec != null) remoteState.dispatchClusterSec = dispatchClusterSec;");
  must(
    (iCensus >= 0 || iFallback >= 0) && iUploads > Math.max(iCensus, iFallback),
    "the dispatch reads the cluster's date before any staging is planned"
  );
  must(iGraft > 0, "the reading rides the remote state (absent on failure, never a refusal)");
  // the finalize prefers it over the app host's startedAt
  must(
    src.includes("typeof r.dispatchClusterSec === \"number\" && r.dispatchClusterSec > 0\n      ? r.dispatchClusterSec * 1000\n      : Date.parse(rec.startedAt)"),
    "syncBackWorkdir's reference prefers the cluster clock, falling back to the app host's startedAt"
  );

  // the arithmetic, executed: the field report's own numbers. An app host
  // running 10 minutes AHEAD of the cluster; the run's own run.out written
  // 5 seconds after the (cluster-clock) dispatch. The old reference
  // (Date.parse(startedAt)) convicts it; the cluster reference does not.
  const dispatchClusterSec = 1_767_000_000; // the cluster's date +%s
  const appClockAheadMs = 10 * 60 * 1000;
  const appStartedAtMs = dispatchClusterSec * 1000 + appClockAheadMs;
  const fileMtimeSec = dispatchClusterSec + 5; // the run's own run.out
  const GRACE_MS = 90_000;
  const stale = (notBeforeMs: number) => fileMtimeSec * 1000 < notBeforeMs - GRACE_MS;
  must(
    stale(appStartedAtMs),
    "sanity: under the OLD app-clock reference the run's own run.out is convicted (the field report)"
  );
  must(
    !stale(dispatchClusterSec * 1000),
    "under the cluster-clock reference the run's own run.out is fresh (the fix)"
  );
  // and a genuine leftover (an hour old) stays convicted under BOTH
  const leftoverMtimeSec = dispatchClusterSec - 3600;
  must(
    leftoverMtimeSec * 1000 < dispatchClusterSec * 1000 - GRACE_MS,
    "a genuine hour-old leftover stays convicted under the cluster clock"
  );
}

console.log("F — the sync-back find, executed from the source's own bytes");
{
  const src = readFileSync("src/lib/remote/remote-run.ts", "utf8");
  const m = /find \. -type f -not -name '\.cf-\*' -not -path '\.\/\.cryoflow_prev\/\*' -printf '%P\\\\t%s\\\\t%T@\\\\n'/.exec(src);
  must(m != null, "the find carries the archive exclusion (-not -path './.cryoflow_prev/*')");
  if (m != null) {
    // execute the source's own find (with ${W} substituted for a fixture)
    const dir = mkdtempSync(path.join(tmpdir(), "cf-t391-f-"));
    mkdirSync(path.join(dir, ".cryoflow_prev", "1767000000"), { recursive: true });
    writeFileSync(path.join(dir, "run.out"), "this run's own log\n");
    writeFileSync(path.join(dir, "run.err"), "this run's own stderr\n");
    writeFileSync(path.join(dir, ".cf-exit"), "0\n");
    writeFileSync(path.join(dir, ".cryoflow_prev", "1767000000", "run.out"), "the PREVIOUS run's log\n");
    writeFileSync(path.join(dir, "run_it001_classes.mrcs"), "classes-bytes\n");
    const findExpr = m[0].replace(/\\\\/g, "\\"); // source-level \\t → the emitted \t
    const r = spawnSync("bash", ["-c", `cd ${JSON.stringify(dir)} && ${findExpr} 2>/dev/null | head -4000`], {
      encoding: "utf8",
    });
    must(r.status === 0, "the find runs", r.stderr?.slice(0, 200));
    const lines = r.stdout.trim() ? r.stdout.trim().split("\n") : [];
    const rels = lines.map((l) => l.split("\t")[0]);
    must(rels.includes("run.out") && rels.includes("run.err"), "the run's own logs are listed (this run's outputs)");
    must(rels.includes("run_it001_classes.mrcs"), "real products are listed");
    must(
      !rels.some((p) => p.startsWith(".cryoflow_prev/")),
      "the t385 archive is NOT listed (the wipe's own product, not the job's workdir)"
    );
    must(!rels.some((p) => p.startsWith(".cf-")), "scratch verdict files stay excluded (the old contract)");
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
