/**
 * qa63-race-test — regression test for the engine-state "time travel" fix.
 *
 * The bug (Task 62 incident): writeRuns() was a BLIND full-file overwrite,
 * so any writer holding a stale snapshot (external seed script wrote in
 * between, or a second server process beside the watchdog's replacement)
 * silently DELETED every state entry it didn't know about. Completed jobs'
 * records vanished while the DB still said completed — /fsc and every
 * workdir-resolving route came up empty.
 *
 * The fix: incremental single-key writes (upsertRun / updateRun / removeRun)
 * whose base is ALWAYS a fresh on-disk read. These tests simulate exactly
 * that interleaving: populate the cache → external writer touches the file
 * → engine writes ONE key → the external entries MUST survive.
 *
 * Run: bun scripts/qa63-race-test.ts
 * (backs up data/engine-state.json and restores it afterwards)
 */

import { readFileSync, writeFileSync, existsSync, renameSync, copyFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "../src/lib/paths";
import {
  upsertRun,
  updateRun,
  removeRun,
  clearRunRecord,
  readRuns,
  getRun,
  type RunRecord,
} from "../src/lib/relion/engine";

const STATE_FILE = path.join(DATA_DIR, "engine-state.json");
const BACKUP = path.join(DATA_DIR, "engine-state.json.qa63-bak");

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function externalWrite(entries: Record<string, RunRecord>): void {
  // Simulate the seed script: a plain process-level writeFileSync that the
  // server knows nothing about (mtime/size change busts readRuns' cache).
  writeFileSync(STATE_FILE, JSON.stringify(entries, null, 2));
}

function disk(): Record<string, RunRecord> {
  return JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

function rec(jobId: string, over: Partial<RunRecord> = {}): RunRecord {
  return {
    jobId,
    projectId: "qa63-project",
    type: "refine3d",
    pid: null,
    cmd: "relion_refine --qa63",
    workdir: `/tmp/qa63/${jobId}`,
    logFile: `/tmp/qa63/${jobId}/run.out`,
    errFile: `/tmp/qa63/${jobId}/run.err`,
    startedAt: new Date().toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
    ...over,
  };
}

// ---- backup real state ----------------------------------------------------
const hadState = existsSync(STATE_FILE);
if (hadState) copyFileSync(STATE_FILE, BACKUP);

try {
  // =========================================================================
  console.log("Scenario A: external entries survive an engine upsert (THE bug)");
  externalWrite({ "ext-1": rec("ext-1", { done: true, exitCode: 0 }), "ext-2": rec("ext-2") });
  upsertRun("new-job", rec("new-job"));
  const a = disk();
  check("ext-1 survived", "ext-1" in a);
  check("ext-2 survived", "ext-2" in a);
  check("new-job landed", "new-job" in a && a["new-job"].workdir === "/tmp/qa63/new-job");
  check("exactly 3 entries", Object.keys(a).length === 3, `got ${Object.keys(a).length}`);

  // =========================================================================
  console.log("Scenario B: stale cache snapshot does NOT resurrect old content");
  // Populate the cache with a single entry…
  externalWrite({ "old-1": rec("old-1") });
  const cached = readRuns(); // cache now holds {old-1}
  check("cache populated", "old-1" in cached && Object.keys(cached).length === 1);
  // …external writer adds entries (seed-style)…
  externalWrite({
    "old-1": rec("old-1"),
    "seed-a": rec("seed-a", { done: true, exitCode: 0 }),
    "seed-b": rec("seed-b", { done: true, exitCode: 0 }),
  });
  // …engine writes ONE key (this used to write back the whole stale snapshot)
  upsertRun("live-1", rec("live-1", { pid: 4242 }));
  const b = disk();
  check("old-1 survived", "old-1" in b);
  check("seed-a survived", "seed-a" in b);
  check("seed-b survived", "seed-b" in b);
  check("live-1 landed with pid", b["live-1"]?.pid === 4242);
  check("exactly 4 entries", Object.keys(b).length === 4, `got ${Object.keys(b).length}`);

  // =========================================================================
  console.log("Scenario C: updateRun — conditional swap honors the guard");
  externalWrite({ "j-1": rec("j-1", { done: false, startedAt: "2026-09-09T00:00:00.000Z" }) });
  // guard MATCHES → swap
  const swapped = updateRun("j-1", (cur) =>
    cur.startedAt === "2026-09-09T00:00:00.000Z"
      ? { ...cur, done: true, exitCode: 0, result: "completed" }
      : null
  );
  check("guard matched, swap returned", swapped?.done === true && swapped.exitCode === 0);
  check("disk reflects swap", disk()["j-1"]?.done === true && disk()["j-1"]?.exitCode === 0);
  // guard FAILS (newer run replaced the record) → no write
  externalWrite({ "j-1": rec("j-1", { done: false, startedAt: "2026-09-09T09:99:00.000Z" }) });
  const declined = updateRun("j-1", (cur) =>
    cur.startedAt === "2026-09-09T00:00:00.000Z" ? { ...cur, done: true, exitCode: 0 } : null
  );
  check("guard declined (null returned)", declined !== null && declined.done === false);
  check("decline left newer record intact", disk()["j-1"]?.startedAt === "2026-09-09T09:99:00.000Z");
  // absent record → null, no crash
  const absent = updateRun("no-such-job", () => rec("no-such-job"));
  check("absent record → null", absent === null);

  // =========================================================================
  console.log("Scenario D: removeRun deletes ONLY its own key");
  externalWrite({ "keep-a": rec("keep-a"), "kill-me": rec("kill-me"), "keep-b": rec("keep-b") });
  removeRun("kill-me");
  const d = disk();
  check("kill-me gone", !("kill-me" in d));
  check("keep-a survived", "keep-a" in d);
  check("keep-b survived", "keep-b" in d);

  // =========================================================================
  console.log("Scenario E: clearRunRecord — no-op on absent key, no file corruption");
  const before = readFileSync(STATE_FILE, "utf8");
  clearRunRecord("never-existed");
  check("file byte-identical after no-op", readFileSync(STATE_FILE, "utf8") === before);

  // =========================================================================
  console.log("Scenario F: interleaved seed write DURING a finalize-style update");
  // The exit-handler pattern: read current → compute → updateRun. Between the
  // guard read and updateRun the seed lands a new entry; the update must
  // merge on top of it.
  externalWrite({ "fin-1": rec("fin-1", { done: false, startedAt: "T0" }) });
  const observed = getRun("fin-1"); // exit handler reads state
  externalWrite({
    "fin-1": rec("fin-1", { done: false, startedAt: "T0" }),
    "seed-during": rec("seed-during", { done: true, exitCode: 0 }),
  });
  updateRun("fin-1", (cur) =>
    cur.startedAt === observed?.startedAt ? { ...cur, done: true, exitCode: 0 } : null
  );
  const f = disk();
  check("seed-during survived the finalize", "seed-during" in f);
  check("fin-1 finalized", f["fin-1"]?.done === true && f["fin-1"]?.exitCode === 0);

  console.log(`\n=== qa63-race-test: ${passed} passed, ${failed} failed ===`);
} finally {
  // ---- restore real state ---------------------------------------------------
  try {
    if (hadState) {
      renameSync(BACKUP, STATE_FILE);
      console.log("(real engine-state.json restored)");
    } else if (existsSync(STATE_FILE)) {
      const { unlinkSync } = require("fs") as typeof import("fs");
      unlinkSync(STATE_FILE);
      console.log("(test state file removed — none existed before)");
    }
  } catch (e) {
    console.error("RESTORE FAILED — backup at", BACKUP, e);
    process.exitCode = 2;
  }
}
if (failed > 0) process.exitCode = 1;
