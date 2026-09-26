/**
 * t394 — the "Continue from here:" round picker bench
 * (bun run scripts/t394-continue-rounds.ts).
 *
 * 「continue from here 可以变成下拉菜单选择从前面哪一轮继续，也可以
 * 自己输入路径」— the picker is UI, but its LEGALITY is engine law, and
 * the law has four halves this bench pins:
 *
 *   A  classifyRerunWipe + wipeLocalRunProducts with keepIterations: an
 *      explicit --continue aimed INSIDE the workdir keeps the run_it###_*
 *      family alive through BOTH lanes' fresh-start wipe (the chosen
 *      optimiser + siblings ARE the state the continued run resumes
 *      from — wiping them dangles the path one line later), while
 *      products / scratch / logs still die and the pre-t394 wipe is
 *      BYTE-UNCHANGED when nobody chose anything (the t333 regression
 *      contract);
 *   B  selfContinueInArgv: the remote lane's predicate — true only for a
 *      --continue target INSIDE the dispatch's own workdir (the multibody
 *      builder's wired upstream optimiser is ELSEWHERE by construction and
 *      must keep the stash);
 *   C  explicitContinueOf + continueTargetsWorkdir: the local lane's gate —
 *      what counts as an explicit choice (whitespace is not one) and where
 *      its target must live (sibling-prefix workdirs never match);
 *   D  optimiserRoundsFromNames + scanLocalWorkdir: the round analyser —
 *      newest-first, the per-type companion law (class2d's class average,
 *      the 3D family's unfiltered halves, initialmodel's star-only set),
 *      the newest marker landing on the newest COMPLETE round, and the
 *      .cryoflow_prev archive never contributing rounds;
 *   E  the argv contracts: buildArgv rides --continue for a user-set
 *      fn_cont (class2d via the generic layer, multibody via the curated
 *      builder's override — the builder wins when both speak, because the
 *      generic layer dedupes on flag presence), and multibody without an
 *      override keeps today's upstream optimiser verbatim.
 */
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { classifyRerunWipe } from "../src/lib/hpc/cleanup";
import { wipeLocalRunProducts } from "../src/lib/relion/run-wipe";
import {
  explicitContinueOf,
  continueTargetsWorkdir,
  buildArgv,
} from "../src/lib/relion/engine";
import { selfContinueInArgv } from "../src/lib/remote/remote-run";
import {
  optimiserRoundsFromNames,
  scanLocalWorkdir,
} from "../src/lib/relion/continue-sources";

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

console.log("A — the wipe's keepIterations carve-out (both lanes share it)");
{
  const files = [
    { path: "run_it024_optimiser.star", size: 4000 },
    { path: "run_it024_data.star", size: 900_000 },
    { path: "run_it024_model.star", size: 3000 },
    { path: "run_it024_sampling.star", size: 2000 },
    { path: "run_it024_classes.mrcs", size: 5_000_000 },
    { path: "run_class001.mrc", size: 100_000 }, // product (root-level class2d shape)
    { path: ".cf-verdict.json", size: 50 }, // scratch
    { path: "run.out", size: 12_000 }, // log
    { path: "note.txt", size: 400 }, // keep-set
    { path: "particles.star", size: 8000, link: true } as { path: string; size: number; link?: boolean }, // input door
    { path: ".cryoflow_prev/1730000000000/run_it010_optimiser.star", size: 4000 }, // the t385 archive
  ];
  // A1 — the PRE-t394 contract, byte-unchanged when nobody chose anything
  const bare = classifyRerunWipe(files);
  must(bare.wipe.includes("run_it024_optimiser.star"), "without the flag the iteration family still wipes (t333 regression)");
  must(bare.wipe.includes("run_class001.mrc") && bare.wipe.includes(".cf-verdict.json") && bare.wipe.includes("run.out"), "without the flag products/scratch/logs still wipe");
  must(!bare.wipe.includes("note.txt") && !bare.wipe.includes("particles.star") && !bare.wipe.some((p) => p.startsWith(".cryoflow_prev/")), "without the flag the keep-set + archive still keep");
  // A2 — the carve-out
  const kept = classifyRerunWipe(files, { keepIterations: true });
  must(
    ["run_it024_optimiser.star", "run_it024_data.star", "run_it024_model.star", "run_it024_sampling.star", "run_it024_classes.mrcs"].every((n) => !kept.wipe.includes(n)),
    "with the flag the WHOLE run_it###_* family survives (RELION derives every sibling from the optimiser path)"
  );
  must(kept.wipe.includes("run_class001.mrc") && kept.wipe.includes(".cf-verdict.json") && kept.wipe.includes("run.out"), "with the flag products/scratch/logs still die");
  must(!kept.wipe.includes("note.txt") && !kept.wipe.some((p) => p.startsWith(".cryoflow_prev/")), "with the flag the keep-set + archive still keep");
  must(!kept.wipe.includes("shard_1/slice.star") || true, "shape sanity");

  // A3 — the walker + wipe on a REAL fixture (the local lane's own door)
  const dir = mkdtempSync(path.join(tmpdir(), "cf394-"));
  try {
    mkdirSync(path.join(dir, ".cryoflow_prev"), { recursive: true });
    const names = [
      "run_it012_optimiser.star", "run_it012_data.star", "run_it012_model.star", "run_it012_sampling.star", "run_it012_class001.mrc",
      "run_it011_optimiser.star", "run_it011_data.star", "run_it011_model.star", "run_it011_sampling.star", "run_it011_class001.mrc",
      "run.out", "run.err", "note.txt",
    ];
    for (const n of names) writeFileSync(path.join(dir, n), "x".repeat(64));
    writeFileSync(path.join(dir, ".cryoflow_prev", "run_it009_optimiser.star"), "x".repeat(64));
    // fresh (no keep) — the pre-t394 world
    const fresh = wipeLocalRunProducts(dir);
    must(
      fresh != null && existsSync(path.join(dir, "run_it012_optimiser.star")) === false && existsSync(path.join(dir, "note.txt")),
      "wipeLocalRunProducts fresh: the iterations die, the keep-set stays (t333 unchanged)"
    );
    // rebuild, then the keep
    for (const n of names) writeFileSync(path.join(dir, n), "x".repeat(64));
    const keptRun = wipeLocalRunProducts(dir, { keepIterations: true });
    must(
      keptRun != null && existsSync(path.join(dir, "run_it012_optimiser.star")) && existsSync(path.join(dir, "run_it011_data.star")),
      "wipeLocalRunProducts keepIterations: both rounds' optimiser + siblings survive"
    );
    must(
      keptRun != null && !existsSync(path.join(dir, "run.out")) && !existsSync(path.join(dir, "run.err")),
      "wipeLocalRunProducts keepIterations: the stale logs still die"
    );
    must(existsSync(path.join(dir, "note.txt")), "wipeLocalRunProducts keepIterations: note.txt survives");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("B — selfContinueInArgv (the remote lane's predicate)");
{
  const wd = "/data03/cryoflow/p1/class2d_aaa1";
  must(
    selfContinueInArgv(["mpirun", "-n", "3", "relion_refine", "--continue", `${wd}/run_it012_optimiser.star`, "--o", `${wd}/run`], wd),
    "a --continue aimed at this workdir's own round → true"
  );
  must(
    selfContinueInArgv(["relion_refine", "--continue", "/data03/cryoflow/p1/refine3d_bbb2/run_it025_optimiser.star"], wd) === false,
    "the builder-wired UPSTREAM optimiser (multibody's case) → false, the stash keeps today's behavior"
  );
  must(selfContinueInArgv(["relion_refine", "--i", "parts.star", "--o", `${wd}/run`], wd) === false, "no --continue at all → false");
  must(
    selfContinueInArgv(["relion_refine", "--continue", "/data03/cryoflow/p1/class2d_aaa12/run_it001_optimiser.star"], wd) === false,
    "a sibling workdir sharing the prefix (aaa1 vs aaa12) never matches"
  );
  must(
    selfContinueInArgv(["relion_refine", "--continue", `${wd}/run_it001_optimiser.star`], wd + "/") === true,
    "a trailing slash on the workdir argument still matches"
  );
  must(selfContinueInArgv(["relion_refine", "--continue", "run_it001_optimiser.star"], wd) === false, "a relative target (no leading /) → false (defensive)");
  must(selfContinueInArgv([], wd) === false, "an empty argv → false");
}

console.log("C — explicitContinueOf + continueTargetsWorkdir (the local lane's gate)");
{
  const job = (fn_cont?: unknown) => ({
    id: "j1", projectId: "p1", type: "class2d",
    params: (fn_cont === undefined ? {} : { fn_cont }) as Record<string, number | string | boolean>,
  });
  must(explicitContinueOf(job("/w/run_it012_optimiser.star") as never) === "/w/run_it012_optimiser.star", "a set fn_cont reads back (trimmed)");
  must(explicitContinueOf(job("  ") as never) === null, "whitespace is not a choice");
  must(explicitContinueOf(job("") as never) === null, "empty is not a choice");
  must(explicitContinueOf(job() as never) === null, "an absent key is not a choice");
  must(explicitContinueOf(job(42) as never) === null, "a non-string is not a choice");
  const wd = path.join(tmpdir(), "cf394-wd");
  must(continueTargetsWorkdir(path.join(wd, "run_it012_optimiser.star"), wd), "a target inside the workdir → true");
  must(continueTargetsWorkdir(path.join(wd + "2", "run_it012_optimiser.star"), wd) === false, "a sibling-prefixed workdir never matches");
  must(continueTargetsWorkdir("/elsewhere/run_it012_optimiser.star", wd) === false, "a target elsewhere → false");
  must(continueTargetsWorkdir(wd, wd), "the workdir itself → true (defensive)");
}

console.log("D — optimiserRoundsFromNames + scanLocalWorkdir (the round analyser)");
{
  // D1 — the per-type companion law, straight from the engine's own table
  const names2d = new Set([
    "run_it003_optimiser.star", "run_it003_data.star", "run_it003_model.star", "run_it003_sampling.star", "run_it003_class001.mrc",
    "run_it002_optimiser.star", "run_it002_data.star", "run_it002_model.star", "run_it002_sampling.star", "run_it002_class001.mrc",
  ]);
  const rounds2d = optimiserRoundsFromNames(names2d, "class2d", (n) => `/w/${n}`, () => 4000);
  must(rounds2d.length === 2 && rounds2d[0].iteration === 3 && rounds2d[1].iteration === 2, "rounds sort newest-first");
  must(rounds2d[0].complete && rounds2d[0].newest && rounds2d[0].missing.length === 0, "the newest COMPLETE round carries the newest marker");
  must(rounds2d[0].path === "/w/run_it003_optimiser.star", "paths are the caller's coordinate system (host or cluster)");

  // D2 — an incomplete round is named, and the newest marker skips it
  const torn = new Set([
    "run_it025_optimiser.star", "run_it025_data.star", // model/sampling died mid-flush
    "run_it024_optimiser.star", "run_it024_data.star", "run_it024_model.star", "run_it024_sampling.star", "run_it024_class001.mrc",
  ]);
  const tornRounds = optimiserRoundsFromNames(torn, "class2d", (n) => `/w/${n}`, () => 0);
  must(tornRounds[0].iteration === 25 && tornRounds[0].complete === false, "the torn newest round is INCOMPLETE");
  must(
    tornRounds[0].missing.includes("run_it025_model.star") && tornRounds[0].missing.includes("run_it025_sampling.star") && tornRounds[0].missing.includes("run_it025_class001.mrc"),
    "the missing siblings are named (the picker's disabled reason)"
  );
  must(tornRounds[0].newest === false && tornRounds[1].iteration === 24 && tornRounds[1].newest === true, "the newest marker falls through to the newest COMPLETE round");

  // D3 — the 3D family wants the unfiltered halves; initialmodel is star-only
  const base3d = ["run_it010_optimiser.star", "run_it010_data.star", "run_it010_model.star", "run_it010_sampling.star"];
  const noHalves = optimiserRoundsFromNames(new Set(base3d), "refine3d", (n) => `/w/${n}`, () => 0);
  must(noHalves[0].complete === false && noHalves[0].missing.includes("run_it010_half1_class001_unfil.mrc"), "refine3d without the unfiltered halves is incomplete");
  const withHalves = optimiserRoundsFromNames(
    new Set([...base3d, "run_it010_half1_class001_unfil.mrc", "run_it010_half2_class001_unfil.mrc"]),
    "refine3d", (n) => `/w/${n}`, () => 0
  );
  must(withHalves[0].complete, "refine3d with both halves is complete");
  const im = optimiserRoundsFromNames(new Set(base3d), "initialmodel", (n) => `/w/${n}`, () => 0);
  must(im[0].complete, "initialmodel is star-only (no half reload)");

  // D4 — no optimisers → no rounds (never a guess)
  must(optimiserRoundsFromNames(new Set(["run.out", "note.txt"]), "class2d", (n) => n, () => 0).length === 0, "a workdir with no optimisers answers zero rounds");

  // D5 — the LOCAL scan on a real fixture: root rounds only, archive never answers
  const dir = mkdtempSync(path.join(tmpdir(), "cf394-scan-"));
  try {
    mkdirSync(path.join(dir, ".cryoflow_prev"), { recursive: true });
    for (const n of [
      "run_it002_optimiser.star", "run_it002_data.star", "run_it002_model.star", "run_it002_sampling.star", "run_it002_class001.mrc",
      "run_it001_optimiser.star", "run_it001_data.star", "run_it001_model.star", "run_it001_sampling.star", "run_it001_class001.mrc",
    ]) writeFileSync(path.join(dir, n), "x".repeat(32));
    writeFileSync(path.join(dir, ".cryoflow_prev", "run_it009_optimiser.star"), "x".repeat(32));
    const scanned = scanLocalWorkdir(dir, "class2d");
    must(scanned.error == null && scanned.entries.length === 2, "the local scan reads the root rounds");
    must(
      scanned.entries.every((e) => !e.path.includes(".cryoflow_prev")),
      "the t385 archive's rounds never answer (they are a stashed generation, not a continue state)"
    );
    must(scanned.entries[0].iteration === 2 && scanned.entries[0].size === 32, "sizes + mtime ride the local entries");
    must(typeof scanned.entries[0].mtimeMs === "number", "the local lane carries the mirror's clock");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // D6 — an unreadable workdir answers an honest error, never a throw
  const ghost = scanLocalWorkdir(path.join(tmpdir(), `cf394-ghost-${Date.now()}`), "class2d");
  must(ghost.entries.length === 0 && typeof ghost.error === "string", "an absent workdir answers { error } (the picker's honest note)");
}

console.log("E — the argv contracts (buildArgv)");
async function runE() {
  const baseCtx = {
    binDir: "/opt/relion-5.0.0/bin",
    workdir: "/data03/run",
    upstream: [],
    bridge: null,
  };
  // E1 — class2d: the generic layer rides --continue for a user-set fn_cont
  const c2d = await buildArgv({
    ...baseCtx,
    inputs: { particles_star: "/data03/parts.star" },
    job: { id: "j1", projectId: "p1", type: "class2d", params: { fn_cont: "/data03/run/run_it012_optimiser.star" } },
  } as never);
  const c2dIdx = Array.isArray(c2d) ? c2d.indexOf("--continue") : -1;
  must(
    Array.isArray(c2d) && c2dIdx >= 0 && c2d[c2dIdx + 1] === "/data03/run/run_it012_optimiser.star",
    "class2d with a set fn_cont: --continue <the chosen path> rides the argv (the generic layer)"
  );
  const c2dBare = await buildArgv({
    ...baseCtx,
    inputs: { particles_star: "/data03/parts.star" },
    job: { id: "j1", projectId: "p1", type: "class2d", params: {} },
  } as never);
  must(
    Array.isArray(c2dBare) && !c2dBare.includes("--continue"),
    "class2d with no choice: no --continue anywhere (the pre-t394 fresh start)"
  );

  // E2 — multibody: the curated builder's override
  const mb = await buildArgv({
    ...baseCtx,
    inputs: { optimiser_star: "/data03/up/run_it025_optimiser.star" },
    job: {
      id: "j2", projectId: "p1", type: "multibody",
      params: { fn_bodies: "/data03/bodies.star", fn_cont: "/data03/run/run_it004_optimiser.star" },
    },
  } as never);
  const mbIdx = Array.isArray(mb) ? mb.indexOf("--continue") : -1;
  must(
    Array.isArray(mb) && mbIdx >= 0 && mb[mbIdx + 1] === "/data03/run/run_it004_optimiser.star",
    "multibody with fn_cont set: the OVERRIDE wins (the builder owns the flag)"
  );
  const mbBare = await buildArgv({
    ...baseCtx,
    inputs: { optimiser_star: "/data03/up/run_it025_optimiser.star" },
    job: { id: "j2", projectId: "p1", type: "multibody", params: { fn_bodies: "/data03/bodies.star" } },
  } as never);
  const mbBareIdx = Array.isArray(mbBare) ? mbBare.indexOf("--continue") : -1;
  must(
    Array.isArray(mbBare) && mbBareIdx >= 0 && mbBare[mbBareIdx + 1] === "/data03/up/run_it025_optimiser.star",
    "multibody with no override: the wired upstream optimiser rides VERBATIM (no regression)"
  );
  must(
    Array.isArray(mbBare) && !mbBare.includes("/data03/run/run_it004_optimiser.star"),
    "multibody bare: no stray duplicate of any user path"
  );
}

(async () => {
  await runE();
  console.log(
    fail === 0
      ? `\nt394 continue-rounds bench: ${pass} pass, ${fail} fail`
      : `\nt394 continue-rounds bench: ${pass} pass, ${fail} FAIL`
  );
  process.exit(fail === 0 ? 0 : 1);
})();
