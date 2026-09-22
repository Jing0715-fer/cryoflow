/**
 * restore-demo-records.mjs — rebuild missing engine-state records from the
 * DB + disk using the engine's OWN collectOutputs (zero guessing).
 *
 * Provenance (t305 window): the t304 debugging probes' racy read-modify-write
 * clobbered data/engine-state.json and wiped the 19 demo run records; the DB
 * rows (the roster's statuses/results) and the whole data/relion/ tree
 * survived, so every record is reconstructible — workdir from the engine's
 * <type>_<id8> layout, outputs from collectOutputs, result from the DB row.
 *
 * Usage: bun scripts/restore-demo-records.mjs [--dry]
 */
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { DATA_DIR } from "../src/lib/paths.ts";
import { collectOutputs } from "../src/lib/relion/engine.ts";

const STATE_FILE = path.join(DATA_DIR, "engine-state.json");
const RELION_DIR = path.join(DATA_DIR, "relion");
const DRY = process.argv.includes("--dry");

const db = new PrismaClient();
const stateRaw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
const runs = stateRaw.runs ?? stateRaw;
const hadWrapper = "runs" in stateRaw;

const jobs = await db.job.findMany({
  orderBy: { createdAt: "asc" },
  select: { id: true, type: true, status: true, name: true, projectId: true, startedAt: true, duration: true, result: true },
});

const restored = [];
const skipped = [];
for (const job of jobs) {
  if (runs[job.id]) continue; // record alive — never touched
  const workdir = path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
  if (!existsSync(workdir)) {
    skipped.push(`${job.name}: no workdir on disk (${workdir})`);
    continue;
  }
  const collected = collectOutputs(job.type, workdir);
  const terminal = job.status === "completed" || job.status === "failed";
  const startedAt = job.startedAt ?? new Date(statSync(workdir).mtime);
  runs[job.id] = {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: null,
    cmd: `(restored) demo record rebuilt from disk after the t304-window state clobber — outputs via the engine's own collectOutputs`,
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date(startedAt).toISOString(),
    duration: job.duration ?? 5000,
    outputs: collected.outputs,
    done: terminal,
    exitCode: job.status === "failed" ? 1 : terminal ? 0 : null,
    result: job.result ?? collected.result,
  };
  restored.push(`${job.name} [${job.type}] → ${Object.keys(collected.outputs).length} output(s)`);
}

console.log(`records before: ${Object.keys(runs).length - restored.length}, restored: ${restored.length}, skipped: ${skipped.length}`);
for (const r of restored) console.log("  +", r);
for (const s of skipped) console.log("  -", s);

if (!DRY) {
  // keep the file's original top-level shape (bare map vs { runs })
  writeFileSync(STATE_FILE, JSON.stringify(hadWrapper ? { ...stateRaw, runs } : runs, null, 2));
  console.log("state file written");
} else {
  console.log("(dry — nothing written)");
}
await db.$disconnect();
