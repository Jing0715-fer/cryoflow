/**
 * t396 bench — the derived-workdir fallback + the single-file browse law.
 *
 * The field report had three teeth:
 *   「还是检测不到」— the picker stayed empty even though the job's output
 *   directory holds run_it025_optimiser.star: the picker demanded a LIVE
 *   run record, and a Reset-to-idle (the standard "failed, now
 *   re-configure" flow) clears it. The workdir is a fact about the JOB
 *   (the dispatcher's deterministic <root>/<project>/<type>_<id8>), so
 *   the picker now derives it and scans anyway.
 *   「选择文件只能选择文件夹」— the browse dialog restored its mode
 *   from the current value, and a single-path value forced FOLDER mode
 *   over the caller's files mode: files rendered inert, only folders
 *   pickable. parseBrowserSeed now honors the caller's single-file
 *   intent first.
 *
 * Sections:
 *   A  remoteWorkdirForJob — the shared formula + the source x-ray
 *      (remote-run.ts calls the helper; no inline construction remains)
 *   B  parseBrowserSeed — the single-file law (a single-path value seeds
 *      files mode, never folder mode)
 *   C  continueSourcesFor derived fallback, LOCAL lane, end-to-end in a
 *      fixture CRYOFLOW_DATA_DIR: no engine-state.json (the record was
 *      cleared) + a workdir full of rounds → the self source lists them
 *      (derived: true); the never-ran counterfactual (no dir at all)
 *      answers the honest note; a LIVE record wins over the derivation.
 *
 * Run: bun run scripts/t396-derived-fallback.ts
 */

import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// The fixture world for section C — CRYOFLOW_DATA_DIR must point at it
// BEFORE the engine modules load (DATA_DIR/STATE_FILE/RELION_DIR are
// load-time constants), so every lib import below is dynamic.
// ---------------------------------------------------------------------------
const fixtureData = mkdtempSync(path.join(tmpdir(), "cf396-data-"));
const PROJECT = "proj_fix396";
const JOB_A = "ckjobA0000000000000000001"; // 25-char, last-8 = "00000001"
const JOB_B = "ckjobB0000000000000000002"; // never ran — no directory
const JOB_C = "ckjobC0000000000000000003"; // a LIVE record wins

process.env.CRYOFLOW_DATA_DIR = fixtureData;
// lineageFor's edge query rides the repo's dev DB (read-only: the fixture
// ids match no rows → [])
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:/home/z/cryoflow/db/cryoflow.db";

const workdirA = path.join(fixtureData, "relion", PROJECT, `class2d_${JOB_A.slice(-8)}`);
const workdirCRecord = path.join(fixtureData, "relion", PROJECT, `class2d_recorddir`);
const workdirC = path.join(fixtureData, "relion", PROJECT, `class2d_${JOB_C.slice(-8)}`);

function seed2dRound(dir: string, it: string, complete: boolean, vdam: boolean): void {
  const n = (s: string) => writeFileSync(path.join(dir, s), "x".repeat(64));
  n(`run_it${it}_optimiser.star`);
  n(`run_it${it}_data.star`);
  if (complete) {
    n(`run_it${it}_model.star`);
    n(`run_it${it}_sampling.star`);
    n(`run_it${it}_classes.mrcs`);
  }
  if (vdam) {
    n(`run_it${it}_1moment.mrcs`);
    n(`run_it${it}_2moment.mrcs`);
  }
}

mkdirSync(workdirA, { recursive: true });
seed2dRound(workdirA, "024", true, false);
seed2dRound(workdirA, "025", true, false);
seed2dRound(workdirA, "026", false, false); // torn — optimiser + data only

mkdirSync(workdirCRecord, { recursive: true });
seed2dRound(workdirCRecord, "007", true, false);

mkdirSync(workdirC, { recursive: true });
seed2dRound(workdirC, "031", true, false);

const stateFile = path.join(fixtureData, "engine-state.json");
writeFileSync(
  stateFile,
  JSON.stringify(
    {
      [JOB_C]: {
        jobId: JOB_C,
        projectId: PROJECT,
        type: "class2d",
        pid: null,
        cmd: "relion_refine",
        workdir: workdirCRecord, // the record's truth — NOT the derived path
        logFile: path.join(workdirCRecord, "run.out"),
        errFile: path.join(workdirCRecord, "run.err"),
        startedAt: new Date().toISOString(),
        outputs: {},
        done: true,
        exitCode: 0,
      },
    },
    null,
    2
  )
);

const { remoteWorkdirForJob } = await import("../src/lib/relion/workdir");
const { parseBrowserSeed } = await import("../src/lib/browser-seed");
const { continueSourcesFor } = await import("../src/lib/relion/continue-sources");

console.log("A — remoteWorkdirForJob (the shared deterministic formula)");
{
  const id = "cmui4e172000cojgo2urmuczl";
  const eight = id.slice(-8);
  must(
    remoteWorkdirForJob("/data2/cf", PROJECT, "class2d", id) === `/data2/cf/${PROJECT}/class2d_${eight}`,
    "the formula spells <root>/<project>/<type>_<last-8>"
  );
  must(
    remoteWorkdirForJob("/data2/cf/", PROJECT, "class2d", id) === `/data2/cf/${PROJECT}/class2d_${eight}`,
    "one trailing slash is stripped (byte-parity with the dispatch leg's strip)"
  );
  must(
    remoteWorkdirForJob("/", PROJECT, "refine3d", id) === `/${PROJECT}/refine3d_${eight}`,
    "root '/' survives (the strip keeps a single slash)"
  );
  // the source x-ray — the dispatcher must ride the SAME function, so the
  // picker and dispatch cannot drift apart on the path
  const remoteRunSrc = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src/lib/remote/remote-run.ts"),
    "utf8"
  );
  must(
    remoteRunSrc.includes("remoteWorkdirForJob(remoteRoot, job.projectId, job.type, job.id)"),
    "x-ray: remote-run.ts dispatch builds its workdir through the shared helper"
  );
  must(
    !remoteRunSrc.includes("`${remoteProjectRoot}/${job.type}_${job.id.slice(-8)}`"),
    "x-ray: the inline construction is gone (one law, no drift)"
  );
}

console.log("B — parseBrowserSeed (the single-file browse law)");
{
  const bFolder = parseBrowserSeed("", false);
  must(bFolder.mode === "folder" && bFolder.cwd == null, "empty value + import world → folder mode");

  const bSingle = parseBrowserSeed("", true);
  must(bSingle.mode === "files", "empty value + singleFile → files mode");

  const importSingle = parseBrowserSeed("/data/movies/run_it025_optimiser.star", false);
  must(
    importSingle.mode === "folder" && importSingle.cwd === "/data/movies",
    "the micrograph import keeps its classic law: single path → folder mode"
  );

  const pickSingle = parseBrowserSeed("/data/movies/run_it025_optimiser.star", true);
  must(
    pickSingle.mode === "files" && pickSingle.cwd === "/data/movies" && pickSingle.selected.length === 0,
    "THE FIX: a single-path value + singleFile → files mode seated at its folder (t395 forced folder mode and files became unpickable)"
  );

  const pickBare = parseBrowserSeed("run_it025_optimiser.star", true);
  must(pickBare.mode === "files" && pickBare.cwd == null, "a bare filename + singleFile → files mode, no cwd");

  const pickMulti = parseBrowserSeed("/a/1.star\n/a/2.star\n/b/3.star", true);
  must(
    pickMulti.mode === "files" && pickMulti.selected.length === 3 && pickMulti.cwd === "/a",
    "a multi-line value + singleFile → files mode (selection restored, first folder)"
  );

  const pickPattern = parseBrowserSeed("/data/movies/*.star", true);
  must(
    pickPattern.mode === "files" && pickPattern.cwd === "/data/movies/*.star",
    "a wildcard stays the pattern preview"
  );
}

console.log("C — continueSourcesFor's derived fallback (LOCAL lane, fixture DATA_DIR, no run record)");
async function runC() {
  {
    const sources = await continueSourcesFor(
      { id: JOB_A, name: "Class2D · A", type: "class2d", projectId: PROJECT },
      { refresh: true }
    );
    const self = sources.find((s) => s.relation === "self");
    must(self != null, "the self source answers");
    if (!self) return;
    must(
      self.lane === "local" && self.workdir === workdirA,
      `the DERIVED workdir is scanned (got ${self.workdir})`
    );
    must(self.derived === true, "the source carries derived: true (honesty for the UI)");
    must(self.error == null, "no error — the rounds are real");
    must(self.entries.length === 3, `three rounds listed (got ${self.entries.length})`);
    const it025 = self.entries.find((e) => e.iteration === 25);
    const it026 = self.entries.find((e) => e.iteration === 26);
    must(it025 != null && it025.complete && it025.newest, "it025 complete + newest");
    must(
      it026 != null && !it026.complete && it026.missing.includes("run_it026_model.star"),
      "the torn it026 stays disabled with its missing siblings named"
    );
    must(
      self.entries.every((e) => e.path.startsWith(workdirA + path.sep)),
      "paths are host paths under the derived workdir"
    );
  }

  {
    const sources = await continueSourcesFor(
      { id: JOB_B, name: "Class2D · B", type: "class2d", projectId: PROJECT },
      { refresh: true }
    );
    const self = sources.find((s) => s.relation === "self");
    must(self != null, "the never-ran self source answers");
    if (self) {
      must(
        self.entries.length === 0 &&
          self.error === "has never run — no checkpoints exist yet" &&
          self.derived == null,
        "a derived directory that never materialized answers the honest never-ran note"
      );
    }
    must(sources.length === 1, "no upstream rows are fabricated (no edges in the fixture DB)");
  }

  {
    const sources = await continueSourcesFor(
      { id: JOB_C, name: "Class2D · C", type: "class2d", projectId: PROJECT },
      { refresh: true }
    );
    const self = sources.find((s) => s.relation === "self");
    must(self != null, "the live-record self source answers");
    if (self) {
      must(
        self.workdir === workdirCRecord && self.derived == null,
        "a LIVE record wins over the derivation (its workdir is the truth)"
      );
      const rounds = self.entries.map((e) => e.iteration).sort((a, b) => a - b);
      must(
        rounds.length === 1 && rounds[0] === 7,
        `the record's workdir rounds are listed (got [${rounds.join(",")}])`
      );
    }
  }
}
await runC();

rmSync(fixtureData, { recursive: true, force: true });

console.log("");
console.log(`t396: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
