#!/usr/bin/env bun
/**
 * t342 diag — the two new failure signatures, pinned to the field
 * report's exact words (pure unit phase, no server needed).
 *
 * The follow-up ticket (after the OOM fix's class-count cut): the 50-class
 * 2D classification froze at "Expectation iteration 1 of 20" — RELION's
 * own banner said it all:
 *
 *   WARNING: Ignoring required free GPU memory amount of 800 MB, due to
 *   space insufficiency.
 *
 * and every rank banner read "Will distribute threads over devices 0"
 * (two MPI ranks on one card). The job's Log tab must answer WHY with a
 * next step, not with "no known signature":
 *   1. gpu-free-memory-warning — RELION's own starvation warning,
 *      interpreted: stale holder PIDs to kill / rank↔card mismatch /
 *      the dispatch's new clamp + refusal.
 *   2. gpu-starved-refusal — CryoFlow's own pre-flight refusal line
 *      (the job never reached RELION; the holders are named below it).
 *
 * PHASES:
 *  A. the user's verbatim warning line → the signature fires, and the
 *     finding's hint names both levers (stale PIDs, one rank per card).
 *  B. the refusal line → the second signature fires.
 *  C. the frozen-log shape ENDING on a live progress frame with the
 *     warning above it → the SIGNATURE outranks the silent-death autopsy
 *     (findings[0] is the starvation, not "the process died without an
 *     error signature" — the warning IS the signature).
 *  D. healthy RELION init chatter (rank banners, psi-sampling warnings,
 *     "Running CPU instructions in double precision") → NEITHER new
 *     signature fires; no false positives.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
let pass = 0;
let fail = 0;
const failures = [];
const must = (cond, label, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.error(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const unit = (modPath, expr) => {
  const prog = [
    `const m = await import(${JSON.stringify(path.join(ROOT, modPath))});`,
    `const out = (${expr});`,
    `console.log("__UNIT__" + JSON.stringify(out));`,
  ].join("\n");
  const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__UNIT__"));
  if (!line) return `UNIT-PARSE-ERROR: ${(r.stdout ?? "").slice(0, 120)}`;
  return JSON.parse(line.slice("__UNIT__".length));
};
const LD = "src/lib/log-diagnosis.ts";

try {
  console.log("\n== t342 diag A — the user's verbatim starvation warning ==");
  const userLine =
    "000/??? sec ~~(,_,\">                                                          [oo]WARNING: Ignoring required free GPU memory amount of 800 MB, due to space insufficiency.";
  const a = unit(LD, `m.diagnoseFailureLog(${JSON.stringify(userLine)})`);
  must(Array.isArray(a) && a.some((f) => f.id === "gpu-free-memory-warning"),
    "the warning line fires gpu-free-memory-warning", JSON.stringify(a).slice(0, 160));
  const hit = (Array.isArray(a) ? a : []).find((f) => f.id === "gpu-free-memory-warning");
  must(!!hit && /nvidia-smi --query-compute-apps/.test(hit.hint),
    "the hint names the holder-hunting command (nvidia-smi --query-compute-apps)");
  must(!!hit && /clamps the rank count/.test(hit.hint),
    "the hint names the dispatch's new clamp + refusal (the fix, not just the diagnosis)");

  console.log("\n== t342 diag B — the pre-flight refusal line ==");
  const refusal =
    "CRYOFLOW_ERR: only 612 MB free on the GPU(s) this job would use (0) — another process is holding the card(s):\n" +
    "31337, /opt/bin/relion_refine, 9000 MiB\n" +
    "CRYOFLOW_ERR: refusing to launch — RELION would print \"WARNING: Ignoring required free GPU memory\" and stall at its first Expectation step.";
  const b = unit(LD, `m.diagnoseFailureLog(${JSON.stringify(refusal)})`);
  must(Array.isArray(b) && b.some((f) => f.id === "gpu-starved-refusal"),
    "the refusal line fires gpu-starved-refusal", JSON.stringify(b).slice(0, 160));
  // the refusal's own text QUOTES the warning in its short form (no
  // "amount of N MB") — the RELION-side signature must NOT fire on the
  // quote: only the full, numbered warning line is evidence. The refusal
  // signature owns this receipt on its own.
  const bIds = (Array.isArray(b) ? b : []).map((f) => f.id);
  must(bIds.includes("gpu-starved-refusal") && !bIds.includes("gpu-free-memory-warning"),
    "the refusal signature fires alone (the quoted SHORT-form warning correctly does not fire the RELION-side pattern — only the numbered line is evidence)");

  console.log("\n== t342 diag C — the frozen log: the signature outranks the autopsy ==");
  const frozen = [
    " Will distribute threads over devices  0",
    " Thread 0 mapped to device 0",
    " Running CPU instructions in double precision.",
    " + WARNING: Changing psi sampling rate (before oversampling) to 5.625 degrees, for more efficient GPU calculations",
    " Expectation iteration 1 of 20",
    "000/??? sec ~~(,_,\">                                                          [oo]WARNING: Ignoring required free GPU memory amount of 800 MB, due to space insufficiency.",
    " Expectation iteration 1 of 20",
    "000/??? sec ~~(,_,\">                                                          [oo]",
  ].join("\n");
  const c = unit(LD, `m.diagnoseFailureLines(${JSON.stringify(frozen.split("\n"))})`);
  must(Array.isArray(c) && c.length > 0 && c[0].id === "gpu-free-memory-warning",
    "the frozen-iteration log's FIRST finding is the starvation signature (not the generic silent-death autopsy)",
    JSON.stringify((c ?? []).map((f) => f.id)).slice(0, 160));

  console.log("\n== t342 diag D — healthy init chatter: no false positives ==");
  const healthy = [
    " Will distribute threads over devices  0",
    " Thread 0 mapped to device 0",
    " Thread 1 mapped to device 0",
    " Running CPU instructions in double precision.",
    " + WARNING: Changing psi sampling rate (before oversampling) to 5.625 degrees, for more efficient GPU calculations",
    " Estimating initial noise spectra from at most 1000 particles",
    "   1/   1 sec ............................................................~~(,_,\"> yum!",
  ].join("\n");
  const d = unit(LD, `m.diagnoseFailureLog(${JSON.stringify(healthy)})`);
  const dIds = (Array.isArray(d) ? d : []).map((f) => f.id);
  must(!dIds.includes("gpu-free-memory-warning") && !dIds.includes("gpu-starved-refusal"),
    "a healthy init (psi warning, rank banners, noise spectra) fires NEITHER new signature",
    JSON.stringify(dIds).slice(0, 160));

  console.log(fail === 0 ? "\nDIAG t342: ALL GREEN" : `\nDIAG t342: ${fail} FAILURE(S)`);
  process.exit(fail === 0 ? 0 : 1);
} catch (e) {
  console.error("DIAG t342 crashed:", e);
  process.exit(1);
}
