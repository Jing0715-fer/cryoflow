/**
 * Diag — failure-message specificity + pathref markers + exit-code meanings.
 *
 * Run: bun scripts/diag-exit-reason.ts
 * Verifies the pieces behind "more specific error messages" (user-visible
 * fix for bare "Job failed / exit 127 — " results) and the import pathref
 * markers that keep the gallery populated when files cannot be linked.
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, cpSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { describeExitCode } from "../src/lib/relion/engine";
import {
  isPathrefPath,
  pathrefFor,
  readPathrefTarget,
  resolveMicrographEntry,
  writePathrefMarker,
} from "../src/lib/relion/pathref";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fails++;
    console.log(`✗ ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  } else console.log(`✓ ${name}`);
}

/* ---- exit code meanings (the "exit 127" fix) ---------------------- */
eq("127 = command not found", describeExitCode(127).startsWith("command not found"), true);
eq("127 mentions install action", describeExitCode(127).includes("Re-detect"), true);
eq("126 = not executable", describeExitCode(126).includes("not executable"), true);
eq("111 = bridge cd", describeExitCode(111).includes("WSL bridge"), true);
eq("139 = segv", describeExitCode(139).includes("segmentation"), true);
eq("137 = SIGKILL", describeExitCode(137).includes("SIGKILL"), true);
eq("1 = relion error", describeExitCode(1), "RELION reported an error");
eq("unknown code empty", describeExitCode(3), "");
eq("signal generic", describeExitCode(147), "killed by signal 19");

/* ---- pathref markers ----------------------------------------------- */
const MIC_A = "/home/z/empiar-10017/micrographs/Falcon_2012_06_12-14_33_35_0.mrc";
const MIC_B = "/home/z/empiar-10017/micrographs/Falcon_2012_06_12-14_57_34_0.mrc";
const dir = mkdtempSync(path.join(tmpdir(), "cryoflow-pathref-"));
try {
  const srcDir = path.join(dir, "src");
  mkdirSync(srcDir);
  const srcFile = path.join(srcDir, "Falcon_2012_06_12-01.mrc");
  cpSync(MIC_A, srcFile);

  const micDir = path.join(dir, "micrographs");
  mkdirSync(micDir);

  // 1) marker name is a dotfile (hidden from Files-tab walks)
  eq("pathref name", pathrefFor("a.mrc"), ".a.mrc.pathref");
  eq("isPathref detects", isPathrefPath("micrographs/.a.mrc.pathref"), true);
  eq("isPathref rejects regular", isPathrefPath("micrographs/a.mrc"), false);

  // 2) round trip: write + read back the absolute source
  eq("write marker", writePathrefMarker(micDir, "Falcon_2012_06_12-01.mrc", srcFile), true);
  eq(
    "read marker",
    readPathrefTarget(path.join(micDir, pathrefFor("Falcon_2012_06_12-01.mrc"))),
    srcFile
  );

  // 3) resolveMicrographEntry follows the marker when the file is absent
  const viaRef = resolveMicrographEntry(micDir, "Falcon_2012_06_12-01.mrc")!;
  eq("via pathref kind", viaRef.via, "pathref");
  eq("via pathref target", viaRef.abs, srcFile);
  eq("via pathref rel", viaRef.rel, "micrographs/.Falcon_2012_06_12-01.mrc.pathref");

  // 4) linked file wins over marker
  const linked = path.join(micDir, "Falcon_2012_06_12-02.mrc");
  cpSync(MIC_B, linked);
  writePathrefMarker(micDir, "Falcon_2012_06_12-02.mrc", "/nonexistent/elsewhere.mrc");
  const viaLink = resolveMicrographEntry(micDir, "Falcon_2012_06_12-02.mrc")!;
  eq("linked wins", viaLink.via, "linked");
  eq("linked abs", viaLink.abs, linked);

  // 5) missing both → null (gallery silently omits)
  eq("missing both", resolveMicrographEntry(micDir, "ghost.mrc"), null);

  // 6) corrupt marker → null (never a traversal/arbitrary file)
  writeFileSync(path.join(micDir, pathrefFor("bad.mrc")), "not a path\n", "utf8");
  eq("corrupt marker", readPathrefTarget(path.join(micDir, pathrefFor("bad.mrc"))), null);
  writeFileSync(path.join(micDir, pathrefFor("trav.mrc")), "../../etc/passwd\n", "utf8");
  eq("relative marker rejected", readPathrefTarget(path.join(micDir, pathrefFor("trav.mrc"))), null);
} finally {
  rmSync(dir, { force: true, recursive: true });
}

console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
