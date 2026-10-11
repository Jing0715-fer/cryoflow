/**
 * Read-only diagnostic: replicate the exact dispatch path for a job —
 * lineageFor + resolveInputs — and print what the engine saw.
 * Run: bun scripts/diag-lineage.ts <jobId>
 */
import { db } from "../src/lib/db";
import { lineageFor } from "../src/lib/relion/dispatch";
import { readRuns } from "../src/lib/relion/engine";
import { existsSync } from "node:fs";

async function main() {
  const jobId = process.argv[2] ?? "cmtmp8sh20001p9owo7rhleut";
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) {
    console.log("job not found:", jobId);
    process.exit(1);
  }
  console.log("job:", job.name, "| type:", job.type, "| status:", job.status);

  const upstream = await lineageFor(job.id);
  console.log("lineage (priority order):");
  const runs = readRuns();
  for (const u of upstream) {
    const state = runs[u.id];
    const outputs = state ? Object.keys(state.outputs ?? {}) : null;
    console.log(
      `  - ${u.id.slice(-8)} type=${u.type} run=${state ? `done:${state.done} exit:${state.exitCode}` : "NO-RECORD"} outputs=${JSON.stringify(outputs)}`
    );
    if (state) {
      for (const [k, p] of Object.entries(state.outputs ?? {})) {
        console.log(`      ${k} -> ${p} ${existsSync(p as string) ? "EXISTS" : "MISSING!"}`);
      }
    }
  }

  // replica of INPUTS.initialmodel requirement scan
  const REQ = {
    key: "particles_star",
    accepts: ["particles_star"],
    from: ["extract", "select", "class2d", "joinstar"],
    label: "particles.star (run Extract first)",
  };
  let resolved: string | null = null;
  for (const up of upstream) {
    if (!REQ.from.includes(up.type)) continue;
    const state = runs[up.id];
    if (!state || !state.done || state.exitCode !== 0) continue;
    for (const key of REQ.accepts) {
      const p = state.outputs[key];
      if (p && existsSync(p)) {
        resolved = p;
        break;
      }
    }
    if (resolved) break;
  }
  console.log("\nresolveInputs verdict:", resolved ?? "MISSING → would fail");
  process.exit(0);
}

void main();
