/** t529 — the environment learns to watch the grinder.
 *
 *  t528's recipe rebuilds the REAL RELION 5.0.0 in a tree-external prefix
 *  (/home/z/relion-build). Before this window the product was blind to the
 *  whole campaign: the chip said a bare "RELION not found" while stages were
 *  actually grinding, and — worse — the moment the recipe installed
 *  bin/relion_refine, the native candidate list (which knew
 *  /home/z/relion-install/bin but not /home/z/relion-build/bin) would have
 *  MISSED the born install. Two laws now stand:
 *
 *    LAW 1 — the born install must be found: the recipe prefix's bin/ is a
 *            first-class detection candidate (candidateDirs).
 *    LAW 2 — while nothing usable is found, the recipe tree's stage progress
 *            is readable from DISK EVIDENCE ONLY (stamp files + the installed
 *            binary): "current" is the first not-done stage — exactly where
 *            the recipe would resume (make + stamps). No process sniffing,
 *            no drift from what exists; the found world outranks the birth
 *            certificate (the probe nulls the block once relion is usable).
 *
 *  The composer stays pure: buildProgress is an INJECTED fact
 *  (NativeSearchFacts.buildProgress) — fixtures without it get byte-identical
 *  output, so the t242 hint pins keep their world.
 *
 *  Fixtures live in os.tmpdir() (t503: bench bytes never land in the tree).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// the in-process door key (t523 pattern): teach node the product's two import
// dialects (@/ alias + extensionless relatives) before the engine import.
try {
  const { register } = await import("node:module");
  if (typeof register === "function") {
    register(pathToFileURL(new URL("./ts-alias-hook.mjs", import.meta.url).pathname));
  }
} catch {
  // bun (or another runtime with native path-alias eyes) — no key needed
}

const {
  candidateDirs,
  composeNativeHint,
  readBuildProgress,
} = await import("@/lib/relion/system");
type RelionBuildProgressClient = NonNullable<Awaited<ReturnType<typeof readBuildProgress>>>;

let passed = 0;
const must = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  }
  passed++;
  console.log(`PASS ${msg}`);
};

const stageStates = (bp: RelionBuildProgressClient) => bp.stages.map((s) => s.state);
const doneCount = (bp: RelionBuildProgressClient) =>
  bp.stages.filter((s) => s.state === "done").length;

/* ------------------------------------------------------------------ */
/* fixture factory                                                     */
/* ------------------------------------------------------------------ */

function freshTree(): { root: string; stamps: string; bin: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), "t529-grinder-"));
  const stamps = path.join(root, ".stamps");
  const bin = path.join(root, "bin");
  mkdirSync(stamps, { recursive: true });
  return {
    root,
    stamps,
    bin,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

/* ------------------------------------------------------------------ */
/* LAW 2 — the progress reader                                         */
/* ------------------------------------------------------------------ */

{
  const missing = path.join(tmpdir(), `t529-absent-${process.pid}-${Date.now()}`);
  must(readBuildProgress(missing) === null, "reader — absent root is not a build tree (null)");
  must(readBuildProgress(path.join(tmpdir(), "t529-absent2")) === null, "reader — second absent root null");
}

{
  const fx = freshTree();
  try {
    must(readBuildProgress(fx.root) === null, "reader — a bare directory carries no stage evidence (null)");

    // deps/ alone IS evidence (a grind started but no stage finished yet)
    mkdirSync(path.join(fx.root, "deps"), { recursive: true });
    const justStarted = readBuildProgress(fx.root);
    must(justStarted !== null, "reader — deps/ dir counts as grind evidence");
    must(
      justStarted !== null && stageStates(justStarted).join(",") === "current,queued,queued,queued",
      "reader — no stamps yet: cmake is current, the rest queued"
    );
    must(justStarted !== null && doneCount(justStarted) === 0, "reader — no stamps: 0/4 done");
  } finally {
    fx.cleanup();
  }
}

{
  const fx = freshTree();
  try {
    writeFileSync(path.join(fx.stamps, "cmake.done"), "");
    const one = readBuildProgress(fx.root);
    must(one !== null && stageStates(one).join(",") === "done,current,queued,queued",
      "reader — cmake.done: stage 1 done, libtiff current");
    must(one?.root === fx.root, "reader — the fact carries the tree root it read");
    must(one?.recipe === "bash scripts/t528-rebuild-relion.sh", "reader — the fact names the one resume command");

    writeFileSync(path.join(fx.stamps, "tiff.done"), "");
    const two = readBuildProgress(fx.root);
    must(two !== null && stageStates(two).join(",") === "done,done,current,queued" && doneCount(two) === 2,
      "reader — +tiff.done: 2/4 done, MPICH current (today's live profile)");

    writeFileSync(path.join(fx.stamps, "mpich.done"), "");
    const three = readBuildProgress(fx.root);
    must(three !== null && stageStates(three).join(",") === "done,done,done,current",
      "reader — +mpich.done: 3/4 done, RELION itself current");

    mkdirSync(fx.bin, { recursive: true });
    writeFileSync(path.join(fx.bin, "relion_refine"), "#!/bin/sh\necho 5.0.0\n");
    const four = readBuildProgress(fx.root);
    must(four !== null && stageStates(four).every((s) => s === "done") && doneCount(four) === 4,
      "reader — bin/relion_refine: 4/4 done (the found world takes over from here)");
  } finally {
    fx.cleanup();
  }
}

/* ------------------------------------------------------------------ */
/* LAW 1 — the born install is a detection candidate                   */
/* ------------------------------------------------------------------ */

{
  const dirs = candidateDirs().map((c) => c.dir);
  must(dirs.includes("/home/z/relion-build/bin"),
    "candidates — the recipe prefix's bin/ is a known detection path");
  must(candidateDirs().some((c) => c.dir === "/home/z/relion-build/bin" && c.source === "known-path"),
    "candidates — the recipe path is a DETERMINISTIC known-path entry (not scan-luck: the home scan also hits ~/*relion*/bin, but the known-path listing cannot drift)");
}

/* ------------------------------------------------------------------ */
/* the composer — pure, injected fact, t242 world preserved            */
/* ------------------------------------------------------------------ */

const baseFacts = {
  relionHome: null,
  relionHomeExists: null,
  onPath: false,
  knownDirs: [
    { dir: "/home/z/relion-install/bin", exists: false },
    { dir: "/home/z/relion-build/bin", exists: false },
  ],
  homeScanHits: 0,
};

{
  const plain = composeNativeHint(baseFacts);
  const plainAgain = composeNativeHint(baseFacts);
  must(plain === plainAgain, "composer — deterministic without the build fact (byte identity)");
  must(plain.startsWith("CryoFlow searched this host and found no usable RELION install:"),
    "composer — canonical first line intact (t242 world)");
  must(!plain.includes("rebuild is in progress"), "composer — no build section without the fact");
  must(plain.endsWith("then press Re-detect — no restart needed."),
    "composer — remedy closing line intact");

  const bp = readBuildProgress((() => {
    const fx = freshTree();
    writeFileSync(path.join(fx.stamps, "cmake.done"), "");
    writeFileSync(path.join(fx.stamps, "tiff.done"), "");
    return fx.root;
  })())!;
  const withBuild = composeNativeHint({ ...baseFacts, buildProgress: bp });
  must(withBuild.includes("2 of 4 stages done"), "composer — progress line carries done/total");
  must(withBuild.includes("stage 3 (MPICH 4.2) is current"), "composer — progress line names the current stage");
  must(withBuild.includes(bp.root), "composer — progress line names the tree root");
  must(withBuild.includes("bash scripts/t528-rebuild-relion.sh"), "composer — the resume command is in the guidance");
  must(withBuild.endsWith("then press Re-detect — no restart needed."),
    "composer — remedies still close the guidance in the build world");
  must(withBuild.startsWith("CryoFlow searched this host and found no usable RELION install:"),
    "composer — the search-facts prologue survives the appended section");
}

console.log(`\nALL PASS (${passed} assertions) — the environment watches the grinder`);
