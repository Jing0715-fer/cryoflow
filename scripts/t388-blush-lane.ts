/**
 * t388 — the blush-lane bench (bun run scripts/t388-blush-lane.ts).
 *
 * The user ticket, verbatim: 手动用 RELION 提交可以开 blush，cryoflow 车道
 * exit 1 + Python traceback ×4；2D 分类的 mrcs 显示 header 为 0 但 web 图片
 * 能加载，relion_display 打不开（readMRC: Image number 1 exceeds stack
 * size 0）。Five contracts:
 *
 *   A  parseInteractiveEnvSnapshot: the whitelist extracts exactly the
 *      interactive lane's environment variables, rejects multi-line/
 *      carriage-return poison and empty values, and answers [] when
 *      nothing whitelisted matches;
 *   B  the builder bytes: BOTH script lanes (sbatch + the setsid wrapper)
 *      adopt the snapshot AFTER the module-load/RELION_HOME block and
 *      BEFORE the relion_refine 127-check, the RELION_HOME PATH fallback
 *      guard rides relionHome, the blush preflight (relion_python_blush
 *      reachable + its shebang interpreter imports torch) rides only
 *      --blush argvs, and EVERY flag combination passes `bash -n`
 *      (the quoting audit, executed rather than eyeballed);
 *   C  buildLoginCacheSweepScript: the find covers the MRC family with
 *      -print0, the fadvise drop rides the poison shape, HEALED/STILLZERO
 *      verdicts print, `bash -n` passes, and a real run in a fixture
 *      directory behaves (the zero-header file answers STILLZERO in this
 *      sandbox — there is no NFS cache illusion here, the file IS zero on
 *      disk, so the post-drop re-read is honestly still zero; the healthy
 *      file is never even mentioned);
 *   D  multibody Blush: the spec declares doBlush (default false, one
 *      knob — the raw do_blush twin stays off the form via the alias),
 *      the option table gives the twin its --blush flag, and the engine's
 *      argv carries --blush exactly when the knob is on (the no-bodies
 *      refusal keeps its exact words for rows without a body STAR);
 *   E  the diagnosis hint: blush-python-failure now names the manual-vs-
 *      lane asymmetry and the t388 snapshot remedy (bash -lic env).
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { jobType } from "../src/lib/workflow";
import { buildArgv } from "../src/lib/relion/engine";
import { diagnoseLog } from "../src/lib/log-diagnosis";
import { RELION_OPTIONS, RELION_ALIASES } from "../src/lib/relion/option-tables";
import { buildLoginCacheSweepScript } from "../src/lib/remote/cache-witness";
import {
  INTERACTIVE_ENV_WHITELIST,
  parseInteractiveEnvSnapshot,
  buildSbatchScript,
  buildWrapperScript,
} from "../src/lib/remote/remote-run";
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

/** bash -n on a real file — the exact bytes ssh would deliver. */
function bashNoOK(script: string, f: string): boolean {
  writeFileSync(f, script);
  const r = spawnSync("bash", ["-n", f], { encoding: "utf8" });
  return r.status === 0;
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

console.log("A — parseInteractiveEnvSnapshot (the whitelist)");
{
  const fixture = [
    "SSH_CLIENT=192.168.2.10 55122 22",
    "PATH=/opt/conda/envs/relion/bin:/usr/bin:/bin",
    "PYTHONPATH=/opt/py libs/site-packages",
    "LD_LIBRARY_PATH=",
    "SSH_TTY=/dev/pts/0",
    "LD_PRELOAD=/opt/gpu/libhooks.so\r",
    "RELION_BLUSH_ARGS=--skip_spectral_trailing",
    "HOME=/home/lijing",
    "TERM=xterm-256color",
  ].join("\n");
  const lines = parseInteractiveEnvSnapshot(fixture);
  must(lines.includes("export PATH=/opt/conda/envs/relion/bin:/usr/bin:/bin"), "PATH extracted, safe charset unquoted");
  must(
    lines.includes("export PYTHONPATH='/opt/py libs/site-packages'"),
    "a value with spaces is single-quoted (bash-safe export)"
  );
  must(
    lines.includes("export RELION_BLUSH_ARGS=--skip_spectral_trailing"),
    "RELION_BLUSH_ARGS rides (the wrapper's own knob)"
  );
  must(
    !lines.some((l) => l.startsWith("export LD_LIBRARY_PATH=")),
    "an empty value is never adopted (an empty export is a lane lie)"
  );
  must(
    !lines.some((l) => l.startsWith("export LD_PRELOAD=")),
    "a carriage-return-bearing value is rejected (banner poison, not env)"
  );
  must(
    !lines.some((l) => l.includes("SSH_CLIENT") || l.includes("SSH_TTY") || l.includes("TERM") || l.includes("HOME")),
    "terminal/SSH noise never rides"
  );
  must(
    INTERACTIVE_ENV_WHITELIST.includes("PATH") && INTERACTIVE_ENV_WHITELIST.includes("PYTHONPATH"),
    "the whitelist names PATH/PYTHONPATH"
  );
  must(parseInteractiveEnvSnapshot("FOO=bar\nBAZ=qux").length === 0, "no whitelist hits → []");
  must(parseInteractiveEnvSnapshot("").length === 0, "empty output → []");
}

console.log("B — the builder bytes (both lanes)");
{
  const snapFixture = "PATH=/opt/conda/envs/relion/bin:/usr/bin\nPYTHONPATH=/opt/pkgs\nSSH_CLIENT=1.2.3.4\n";
  const snapshot = parseInteractiveEnvSnapshot(snapFixture);
  must(snapshot.length === 2, "the bench snapshot parses to two lines", `got ${snapshot.length}`);

  const REFINE_CHECK = 'command -v relion_refine >/dev/null 2>&1 || { echo "CRYOFLOW_ERR: relion_refine not found on PATH after module load" >&2; exit 127; }';
  const SNAPSHOT_BANNER = "# ---- the interactive lane's environment (t388) ----";
  const PATH_FALLBACK = 'command -v relion_refine >/dev/null 2>&1 || export PATH="$RELION_HOME/bin:$PATH"';

  const dir = mkdtempSync(path.join(tmpdir(), "cf-t388-"));
  let n = 0;
  const writeTmp = (script: string): string => {
    const f = path.join(dir, `s${n++}.sh`);
    writeFileSync(f, script);
    return f;
  };

  for (const lane of ["sbatch", "wrapper"] as const) {
    const build = (o: { envSnapshot: string[] | null; blushPreflight: boolean; relionHome: string | null }) =>
      lane === "sbatch"
        ? buildSbatchScript({
            conn,
            module: "relion",
            relionHome: o.relionHome,
            ctffind: null,
            command: "relion_refine --i particles.star --o run --blush",
            gpus: 1,
            ntasks: 1,
            threads: 4,
            jobName: "cf_bench",
            remoteProjectRoot: "/data03/bench",
            remoteWorkdir: "/data03/bench/bench",
            preflightStar: null,
            envSnapshot: o.envSnapshot,
            blushPreflight: o.blushPreflight,
          })
        : buildWrapperScript({
            conn,
            module: "relion",
            relionHome: o.relionHome,
            ctffind: null,
            command: "relion_refine --i particles.star --o run --blush",
            preflightStar: null,
            remoteProjectRoot: "/data03/bench",
            remoteWorkdir: "/data03/bench/bench",
            envSnapshot: o.envSnapshot,
            blushPreflight: o.blushPreflight,
          });

    // (a) no snapshot, no preflight: neither section exists
    const bare = build({ envSnapshot: null, blushPreflight: false, relionHome: null });
    must(
      !bare.includes(SNAPSHOT_BANNER) && !bare.includes("relion_python_blush"),
      `[${lane}] null snapshot + no blush → neither section rides`
    );
    // (b) the snapshot sits AFTER module load / RELION_HOME and BEFORE the 127-check
    const withSnap = build({ envSnapshot: snapshot, blushPreflight: false, relionHome: "/opt/relion" });
    const iModule = withSnap.indexOf("module load");
    const iHome = withSnap.indexOf("export RELION_HOME=");
    const iBanner = withSnap.indexOf(SNAPSHOT_BANNER);
    const iExport = withSnap.indexOf("export PATH=/opt/conda/envs/relion/bin:/usr/bin");
    const iCheck = withSnap.indexOf(REFINE_CHECK);
    must(
      iModule >= 0 && iHome >= 0 && iBanner >= 0 && iExport >= 0 && iCheck >= 0 &&
        iModule < iHome && iHome < iBanner && iBanner < iExport && iExport < iCheck,
      `[${lane}] the snapshot adopts AFTER module/RELION_HOME, BEFORE the relion_refine check`
    );
    // (c) the blush preflight refuses loudly
    const withBlush = build({ envSnapshot: null, blushPreflight: true, relionHome: null });
    must(
      withBlush.includes("CRYOFLOW_ERR: relion_python_blush is not on this lane's PATH"),
      `[${lane}] the preflight names relion_python_blush's absence`
    );
    must(
      withBlush.includes("import torch") && withBlush.includes("cannot import torch"),
      `[${lane}] the preflight proves the shebang interpreter imports torch`
    );
    must(
      withBlush.indexOf("blush preflight (t388)") < withBlush.indexOf(REFINE_CHECK),
      `[${lane}] the preflight fires before the relion_refine 127-check`
    );
    // (d) the RELION_HOME PATH fallback guard rides relionHome
    must(
      build({ envSnapshot: null, blushPreflight: false, relionHome: "/opt/relion" }).includes(PATH_FALLBACK),
      `[${lane}] the PATH fallback guard appears when relionHome is set`
    );
    must(
      !build({ envSnapshot: null, blushPreflight: false, relionHome: null }).includes(PATH_FALLBACK),
      `[${lane}] no fallback guard without relionHome`
    );
    // (e) EVERY combination is valid bash — the quoting audit, executed
    let allSyntax = true;
    for (const envSnapshot of [null, snapshot] as (string[] | null)[]) {
      for (const blushPreflight of [false, true]) {
        for (const relionHome of [null, "/opt/relion"] as (string | null)[]) {
          const script = build({ envSnapshot, blushPreflight, relionHome });
          const f = writeTmp(script);
          const r = spawnSync("bash", ["-n", f], { encoding: "utf8" });
          if (r.status !== 0) {
            allSyntax = false;
            console.log(`    bash -n failed for [${lane}] snap=${envSnapshot != null} blush=${blushPreflight} home=${relionHome}:\n${r.stderr}`);
          }
        }
      }
    }
    must(allSyntax, `[${lane}] every flag combination passes bash -n`);
    // the snapshot lines themselves execute as exports
    const execSnap = spawnSync("bash", [writeTmp(snapshot.join("\n"))], { encoding: "utf8" });
    must(execSnap.status === 0, "the snapshot lines alone are valid bash");
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log("C — buildLoginCacheSweepScript (the login-node sweep)");
{
  const sweep = buildLoginCacheSweepScript("/data03/run_class2d_xx");
  must(
    sweep.includes("-name '*.mrcs'") && sweep.includes("-name '*.mrc'") && sweep.includes("-name '*.map'") && sweep.includes("-print0"),
    "the find covers .mrcs/.mrc/.map with -print0"
  );
  must(sweep.includes("python3 -c"), "the fadvise drop rides the ladder's own python3 stick");
  must(sweep.includes("STILLZERO:%s") && sweep.includes("HEALED:%s"), "both verdicts print");
  must(sweep.includes("cd '/data03/run_class2d_xx'"), "the workdir rides single-quoted");

  const dir = mkdtempSync(path.join(tmpdir(), "cf-t388-sweep-"));
  const f = path.join(dir, "sweep.sh");
  must(bashNoOK(sweep, f), "the sweep passes bash -n");

  // the fixture directory: a zero-header stack and a healthy one.
  // NOTE (documented deviation from the field shape): in THIS sandbox there
  // is no NFS page-cache poison — a freshly written zero-header file reads
  // zero THROUGH the cache too, so after the fadvise drop the re-read is
  // HONESTLY still zero → the fixture answers STILLZERO, not HEALED. What
  // the run proves here is the wiring: the zero shape triggers the drop,
  // the verdict prints, and the healthy file is never mentioned at all.
  const zero = Buffer.alloc(2048, 0);
  writeFileSync(path.join(dir, "run_it001_classes.mrcs"), zero);
  const healthy = Buffer.alloc(1024, 0);
  healthy.writeUInt32LE(4, 0); // nx
  healthy.writeUInt32LE(4, 4); // ny
  healthy.writeUInt32LE(2, 8); // nz
  writeFileSync(path.join(dir, "run_it002_classes.mrcs"), healthy);
  // the RUN copy targets the fixture dir itself (the workdir substitution)
  writeFileSync(f, buildLoginCacheSweepScript(dir));

  const hasPy = spawnSync("python3", ["-c", "import os; os.posix_fadvise"], { encoding: "utf8" }).status === 0;
  const run = spawnSync("bash", [f], { encoding: "utf8" });
  must(run.status === 0, "the sweep exits 0", `stderr: ${run.stderr?.slice(0, 200)}`);
  if (hasPy) {
    must(
      run.stdout.includes("STILLZERO:./run_it001_classes.mrcs"),
      "the zero-header fixture answers STILLZERO (no cache illusion in the sandbox — the file IS zero)",
      `stdout: ${JSON.stringify(run.stdout)}`
    );
    must(
      !run.stdout.includes("run_it002_classes.mrcs"),
      "the healthy file is never mentioned (12 od bytes, no drop)"
    );
    must(!run.stdout.includes("HEALED:"), "no HEALED verdict without a cache illusion to heal");
  } else {
    must(
      !run.stdout.includes("run_it002_classes.mrcs") && !run.stdout.includes("HEALED:"),
      "without python3 the sweep stays silent and honest (best-effort)"
    );
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log("D — multibody Blush (RELION's own GUI has it)");
{
  const spec = jobType("multibody")!;
  const blush = spec.params.find((p) => p.key === "doBlush");
  must(!!blush, "the multibody spec declares doBlush");
  must(
    blush?.type === "bool" && blush?.default === false,
    "doBlush is a bool defaulting to off (the family's own default)"
  );
  must(blush?.tab === "Optimisation", "doBlush sits on the Optimisation tab (beside numBodies)");
  must(
    !spec.params.some((p) => p.key === "do_blush"),
    "the raw RELION twin stays off the form (the alias owns it — one knob)"
  );
  must(
    RELION_OPTIONS.multibody.options.do_blush?.flag === "--blush",
    "the option table gives multibody's do_blush its --blush flag (matches class3d/refine3d)"
  );
  must(
    (RELION_ALIASES.multibody ?? {}).doBlush === "do_blush",
    "the alias map owns the doBlush → do_blush pair"
  );

  const base = {
    binDir: "/relion/bin",
    workdir: "/tmp/mb",
    inputs: {
      particles_star: "/tmp/mb/particles.star",
      optimiser_star: "/tmp/mb/run_it025_optimiser.star",
    },
    upstream: [],
    bridge: null,
  } as unknown as Parameters<typeof buildArgv>[0];
  const argvOn = await buildArgv({
    ...base,
    job: { id: "mb1", projectId: "p", type: "multibody", params: { doBlush: true, fn_bodies: "/tmp/mb/bodies.star" } },
  } as unknown as Parameters<typeof buildArgv>[0]);
  must(Array.isArray(argvOn), "multibody argv builds when the body STAR rides the fn_bodies param");
  if (Array.isArray(argvOn)) {
    const j = argvOn.join(" ");
    must(j.includes("--blush"), "doBlush=true rides --blush");
    must(
      j.includes("--multibody_masks /tmp/mb/bodies.star") && j.includes("--continue /tmp/mb/run_it025_optimiser.star"),
      "the multibody argv speaks RELION's own shape (--continue + --multibody_masks)"
    );
    must(
      argvOn.filter((a) => a === "--blush").length === 1,
      "--blush rides exactly once (curated builder owns it, generic layer defers to the alias)"
    );
  }
  const argvOff = await buildArgv({
    ...base,
    job: { id: "mb2", projectId: "p", type: "multibody", params: { doBlush: false, fn_bodies: "/tmp/mb/bodies.star" } },
  } as unknown as Parameters<typeof buildArgv>[0]);
  must(Array.isArray(argvOff) && !argvOff.includes("--blush"), "doBlush=false never rides --blush");
  const noBodies = await buildArgv({
    ...base,
    job: { id: "mb3", projectId: "p", type: "multibody", params: { doBlush: true } },
  } as unknown as Parameters<typeof buildArgv>[0]);
  must(
    !Array.isArray(noBodies) && typeof (noBodies as { error: string }).error === "string" &&
      (noBodies as { error: string }).error.includes("body STAR file"),
    "a row without a body STAR keeps today's honest refusal (no new silent failure mode)"
  );
}

console.log("E — the diagnosis hint names the manual-vs-lane asymmetry");
{
  const blushLog = [
    "Something went wrong in the external Python call...",
    "Command: relion_python_blush /data03/x/run_it001_class002_external_reconstruct.star ",
    "Traceback (most recent call last):",
    "ModuleNotFoundError: No module named 'blush'",
  ].join("\n");
  const findings = diagnoseLog(blushLog);
  const blush = findings.find((f) => f.id === "blush-python-failure");
  must(!!blush, "the blush signature still fires");
  must(
    !!blush?.hint.includes("bash -lic env"),
    "the hint names the t388 snapshot remedy (bash -lic env)"
  );
  must(
    !!blush?.hint.includes("If running the SAME job by hand through RELION's own GUI works"),
    "the hint names the manual-vs-lane asymmetry"
  );
  must(
    !!blush?.hint.includes("re-run once after updating"),
    "the hint tells the user to re-run after pulling the t388 build"
  );
}

console.log(`\nt388 blush-lane bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
