/**
 * t389 — the module-load lane bench (bun run scripts/t389-module-load-lane.ts).
 *
 * The user's field report, verbatim: 不需要 conda activate，只需要 module
 * load 就可以直接开 relion 跑 blush 的 job — blush on this cluster needs
 * NOTHING but the module. That report broke t388's framing: the snapshot
 * exported `PATH=<interactive PATH>` WHOLESALE, and a by-hand `module load`
 * that lives only in the user's interactive session (not in the rc files a
 * fresh `bash -lic env` replays) means the snapshot's PATH never saw the
 * RELION module — so the export would clobber the PATH the script's own
 * module-load block had just built, and the lane would refuse at
 * `relion_refine not found on PATH after module load` while the module
 * load itself had worked perfectly. Four contracts:
 *
 *   A  the merge form: list-shaped variables (PATH/LD_LIBRARY_PATH/
 *      PYTHONPATH/LD_PRELOAD) emit the t389 prepend-merge
 *      `${VAR:+:$VAR}` suffix, scalars never do, and the banner says
 *      "merged t389";
 *   B  the merge semantics, EXECUTED: set -u never trips on an unset
 *      variable, no trailing colon survives when the script var is unset,
 *      the snapshot lands FIRST when it is set, and — the headline — a
 *      relion_refine stub reachable only through the script's own PATH
 *      (the module-load block's product) stays reachable after the
 *      snapshot lines run, while a bare wholesale export would have
 *      wiped it;
 *   C  the builder bytes: both lanes re-play `module load <name>` BEFORE
 *      the snapshot, the blush preflight's failure wording leads with
 *      the module story (name it in the connection's Module field), the
 *      preflight block is byte-identical between the two lanes, and
 *      every combination still passes `bash -n`;
 *   D  the relion_refine gate still fires AFTER the snapshot lines, so a
 *      lane that neither the module nor the interactive shell can rescue
 *      refuses honestly instead of running on.
 */
import { mkdtempSync, writeFileSync, rmSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
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

const conn = {
  id: "c1",
  name: "bench",
  host: "192.168.2.253",
  port: 22,
  username: "lijing",
  envLines: [],
  slurmPartition: null,
} as unknown as RemoteConnection;

console.log("A — the merge form (list-shaped prepend, scalars untouched)");
{
  // the module-load-only interactive shell: a PATH that never saw the RELION
  // module (the user loads it by hand, the rc files don't)
  const fixture = [
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "LD_LIBRARY_PATH=/opt/gpu/driver/lib64",
    "PYTHONPATH=/opt/site/python",
    "LD_PRELOAD=/opt/gpu/libhooks.so",
    "RELION_BLUSH_ARGS=--skip_spectral_trailing",
    "HOME=/home/lijing",
  ].join("\n");
  const lines = parseInteractiveEnvSnapshot(fixture);
  must(
    lines.includes("export PATH=/usr/local/bin:/usr/bin:/bin${PATH:+:$PATH}"),
    "PATH rides the prepend-merge idiom"
  );
  must(
    lines.includes("export LD_LIBRARY_PATH=/opt/gpu/driver/lib64${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"),
    "LD_LIBRARY_PATH rides the prepend-merge idiom"
  );
  must(
    lines.includes("export PYTHONPATH=/opt/site/python${PYTHONPATH:+:$PYTHONPATH}"),
    "PYTHONPATH rides the prepend-merge idiom"
  );
  must(
    lines.includes("export LD_PRELOAD=/opt/gpu/libhooks.so${LD_PRELOAD:+:$LD_PRELOAD}"),
    "LD_PRELOAD rides the prepend-merge idiom"
  );
  must(
    lines.includes("export RELION_BLUSH_ARGS=--skip_spectral_trailing"),
    "a scalar variable keeps its plain export (no merge suffix)"
  );
  must(
    !lines.some((l) => l.startsWith("export RELION_BLUSH_ARGS=") && l.includes(":+")),
    "the scalar never grows a ${VAR:+:$VAR} tail"
  );
  must(
    lines.every((l) => !/export (PATH|LD_LIBRARY_PATH|PYTHONPATH|LD_PRELOAD)=[^$]*$/.test(l)),
    "no list-shaped export ever appears as a bare wholesale replacement"
  );
}

console.log("B — the merge semantics, executed");
{
  const dir = mkdtempSync(path.join(tmpdir(), "cf-t389-"));

  // (a) set -u safety + no trailing colon: execute the snapshot lines in a
  // shell where LD_LIBRARY_PATH/PYTHONPATH/LD_PRELOAD are UNSET — the
  // `:+` idiom must not trip set -u and must not leave an empty list
  // entry (a trailing colon means the current directory in PATH /
  // LD_LIBRARY_PATH search)
  const snapNoRelion = parseInteractiveEnvSnapshot(
    [
      "PATH=/usr/local/bin:/usr/bin:/bin",
      "LD_LIBRARY_PATH=/opt/gpu/driver/lib64",
      "SSH_TTY=/dev/pts/0",
    ].join("\n")
  );
  const guard = "set -u; unset LD_LIBRARY_PATH PYTHONPATH LD_PRELOAD 2>/dev/null || true;";
  const r = spawnSync(
    "bash",
    ["-c", `${guard}${snapNoRelion.join(";")}; printf '%s\\n' "$LD_LIBRARY_PATH"`],
    { encoding: "utf8" }
  );
  must(r.status === 0, "the merge lines never trip set -u on unset variables", r.stderr);
  must(
    r.stdout.trim() === "/opt/gpu/driver/lib64",
    "no trailing colon when the script-side variable is unset",
    `got: ${JSON.stringify(r.stdout)}`
  );

  // (b) prepend order: the script-side value follows the snapshot value
  // (LD_LIBRARY_PATH stays SET here — only PYTHONPATH/LD_PRELOAD clear)
  const guardKeepLd = "set -u; unset PYTHONPATH LD_PRELOAD 2>/dev/null || true;";
  const r2 = spawnSync(
    "bash",
    ["-c", `${guardKeepLd}${snapNoRelion.join(";")}; printf '%s' "$LD_LIBRARY_PATH"`],
    { encoding: "utf8", env: { ...process.env, LD_LIBRARY_PATH: "/old/module/lib" } }
  );
  must(r2.status === 0, "the merge lines run under a pre-set LD_LIBRARY_PATH");
  must(
    r2.stdout === "/opt/gpu/driver/lib64:/old/module/lib",
    "the snapshot lands FIRST, the script's own (module-load) value follows",
    `got: ${JSON.stringify(r2.stdout)}`
  );

  // (c) THE HEADLINE — the module-load lane survives a snapshot that never
  // saw the module. The script's own `module load` block put relion_refine
  // on PATH (here: a stub in a dir the snapshot PATH does not name); the
  // t388 wholesale export would have wiped it and refused at the gate —
  // the t389 merge keeps it reachable.
  const modBin = path.join(dir, "modulebin");
  mkdirSync(modBin, { recursive: true });
  writeFileSync(path.join(modBin, "relion_refine"), "#!/bin/sh\nexit 0\n");
  chmodSync(path.join(modBin, "relion_refine"), 0o755);
  const r3 = spawnSync(
    "bash",
    ["-c", `set -u;${snapNoRelion.join(";")}; command -v relion_refine`],
    { encoding: "utf8", env: { ...process.env, PATH: `${modBin}:${process.env.PATH}` } }
  );
  must(r3.status === 0, "relion_refine stays reachable after the snapshot (no clobber)", r3.stderr);
  must(
    r3.stdout.trim() === path.join(modBin, "relion_refine"),
    "the stub the module-load block provided is exactly what command -v finds",
    `got: ${JSON.stringify(r3.stdout)}`
  );
  // and the counterfactual, locked as a shape: a wholesale export (the t388
  // form) would have hidden the stub — prove the OLD form is really gone
  const wholesale = spawnSync(
    "bash",
    ["-c", `set -u; export PATH=${JSON.stringify("/usr/local/bin:/usr/bin:/bin")}; command -v relion_refine`],
    { encoding: "utf8", env: { ...process.env, PATH: `${modBin}:${process.env.PATH}` } }
  );
  must(
    wholesale.status !== 0,
    "sanity: a wholesale PATH export (the t388 shape) really does hide the stub — the merge is what saves the lane"
  );

  rmSync(dir, { recursive: true, force: true });
}

console.log("C — the builder bytes (module re-play + module-first wording)");
{
  const snapshot = parseInteractiveEnvSnapshot("PATH=/usr/local/bin:/usr/bin\nLD_LIBRARY_PATH=/opt/gpu/lib64\n");
  const dir = mkdtempSync(path.join(tmpdir(), "cf-t389-b-"));
  let n = 0;

  const build = (lane: "sbatch" | "wrapper", blushPreflight: boolean, envSnapshot: string[] | null) =>
    lane === "sbatch"
      ? buildSbatchScript({
          conn,
          module: "relion",
          relionHome: null,
          ctffind: null,
          command: "relion_refine --i particles.star --o run --blush",
          gpus: 1,
          ntasks: 1,
          threads: 4,
          jobName: "cf_bench",
          remoteProjectRoot: "/data03/bench",
          remoteWorkdir: "/data03/bench/bench",
          preflightStar: null,
          envSnapshot,
          blushPreflight,
        })
      : buildWrapperScript({
          conn,
          module: "relion",
          relionHome: null,
          ctffind: null,
          command: "relion_refine --i particles.star --o run --blush",
          preflightStar: null,
          remoteProjectRoot: "/data03/bench",
          remoteWorkdir: "/data03/bench/bench",
          envSnapshot,
          blushPreflight,
        });

  const PREFLIGHT_HEAD = "# ---- blush preflight (t388): refuse fast when the lane cannot run it ----";
  const PREFLIGHT_TAIL = "unset __blush_py";
  const preflightBlock = (s: string) =>
    s.slice(s.indexOf(PREFLIGHT_HEAD), s.indexOf(PREFLIGHT_TAIL) + PREFLIGHT_TAIL.length);

  let sharedBytes: string | null = null;
  for (const lane of ["sbatch", "wrapper"] as const) {
    const script = build(lane, true, snapshot);
    // the module re-play exists and precedes the snapshot banner
    const iModule = script.indexOf("module load relion");
    const iBanner = script.indexOf("# ---- the interactive lane's environment (t388, merged t389) ----");
    must(iModule >= 0 && iBanner >= 0 && iModule < iBanner, `[${lane}] the module re-play precedes the snapshot`);
    // the snapshot export in the BUILT script carries the merge idiom
    must(
      script.includes("export PATH=/usr/local/bin:/usr/bin${PATH:+:$PATH}"),
      `[${lane}] the built script's snapshot export is merge-shaped`
    );
    // the blush preflight wording leads with the module story
    const block = preflightBlock(script);
    must(block.includes("name it in this connection's Module field"), `[${lane}] the preflight names the connection's Module field`);
    must(block.includes("module load <module>"), `[${lane}] the preflight speaks the by-hand module-load shape`);
    must(block.includes("merges your interactive shell's PATH"), `[${lane}] the torch refusal explains the merge`);
    // the preflight block is byte-identical between the lanes
    if (sharedBytes === null) sharedBytes = block;
    must(block === sharedBytes, `[${lane}] the preflight block is byte-identical across lanes`);
    // syntax: every combination is valid bash
    let allSyntax = true;
    for (const blush of [false, true]) {
      for (const snap of [null, snapshot] as (string[] | null)[]) {
        const f = path.join(dir, `s${n++}.sh`);
        writeFileSync(f, build(lane, blush, snap));
        const r = spawnSync("bash", ["-n", f], { encoding: "utf8" });
        if (r.status !== 0) {
          allSyntax = false;
          console.log(`    bash -n failed [${lane}] blush=${blush} snap=${snap != null}:\n${r.stderr}`);
        }
      }
    }
    must(allSyntax, `[${lane}] every flag combination passes bash -n`);
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log("D — the relion_refine gate still fires AFTER the snapshot");
{
  const snapshot = parseInteractiveEnvSnapshot("PATH=/usr/local/bin:/usr/bin\n");
  const script = buildWrapperScript({
    conn,
    module: "relion",
    relionHome: null,
    ctffind: null,
    command: "relion_refine --i particles.star --o run",
    preflightStar: null,
    remoteProjectRoot: "/data03/bench",
    remoteWorkdir: "/data03/bench/bench",
    envSnapshot: snapshot,
    blushPreflight: false,
  });
  const iExport = script.indexOf("export PATH=/usr/local/bin:/usr/bin${PATH:+:$PATH}");
  const iGate = script.indexOf("CRYOFLOW_ERR: relion_refine not found on PATH after module load");
  must(
    iExport >= 0 && iGate >= 0 && iExport < iGate,
    "a lane neither the module nor the interactive shell can rescue still refuses honestly (gate after the merge)"
  );
}

console.log(`\nt389 module-load-lane bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
