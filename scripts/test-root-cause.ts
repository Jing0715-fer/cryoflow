/** Quick verification of rootCauseDetail with synthetic failure logs. */
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootCauseDetail } from "../src/lib/relion/engine";

const dir = mkdtempSync(join(tmpdir(), "rc-"));

// Case 1: the user's actual failure shape — OpenMPI epilogue AFTER the real error
const case1 = [
  "WARNING: root user detected.",
  "",
  "[cmtn6aqwa:12345] 1 more process has sent help message help-btl-vader.txt",
  "ERROR: Cannot read particles from class2d/run_it012_data.star",
  "",
  "--------------------------------------------------------------------------",
  "mpirun detected that one or more processes exited with non-zero status, thus",
  "causing the job to be terminated. The first process to do so was:",
  "  Process name: [[17538,1],1]",
  "  Exit code: 1",
  "--------------------------------------------------------------------------",
].join("\n");

// Case 2: bare ERROR: with message on the next line (classic RELION)
const case2 = [
  "Reading images ...",
  "ERROR:",
  "Cannot open file Ref3D.mrc for reading",
  "",
  "--------------------------------------------------------------------------",
  "mpirun detected that one or more processes exited with non-zero status",
].join("\n");

// Case 3: ONLY the mpirun epilogue → should return "" (fall back to tail)
const case3 = [
  "--------------------------------------------------------------------------",
  "mpirun detected that one or more processes exited with non-zero status, thus",
  "causing the job to be terminated. The first process to do so was:",
  "  Process name: [[17538,1],1]",
  "  Exit code: 1",
  "--------------------------------------------------------------------------",
].join("\n");

// Case 4: C++ exception (bad_alloc under memory pressure)
const case4 = [
  "terminate called after throwing an instance of 'std::bad_alloc'",
  "  what():  std::bad_alloc",
  "SIGABRT",
].join("\n");

// Case 5: empty file
const case5 = "";

const cases: Array<[string, string, RegExp | ""]> = [
  ["case1-mmpi-epilogue", case1, /Cannot read particles from class2d\/run_it012_data\.star/],
  ["case2-bare-error", case2, /Cannot open file Ref3D\.mrc/],
  ["case3-epilogue-only", case3, ""],
  ["case4-badalloc", case4, /std::bad_alloc/],
  ["case5-empty", case5, ""],
];

let fail = 0;
for (const [name, content, expect] of cases) {
  const f = join(dir, name + ".err");
  writeFileSync(f, content);
  const got = rootCauseDetail(f);
  const ok = expect === "" ? got === "" : expect.test(got);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${JSON.stringify(got)}`);
  if (!ok) fail++;
}
process.exit(fail ? 1 : 0);
