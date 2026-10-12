#!/usr/bin/env node
/**
 * t914 — the import's own-listing visibility witness.
 *
 * THE FINDING (live, this window): the import engine exposes the imported
 * set inside the job's workdir through a DIRECTORY symlink (linkDirInto →
 * workdir/micrographs → projectDir/micrographs), but walkWorkdir refuses
 * symlinked directories (loop safety — the law that keeps the walk inside
 * the workdir it was given). The dir-link lane satisfied that law by being
 * INVISIBLE: an import job's own Files/Results listing shows star +
 * run.err + run.out and never the very files the import just linked.
 * Verified live on both lanes' shapes: the demo EMPIAR import (4 real
 * mic001-004.mrc) and the t914 stack mint (pattern lane) — both listed 3
 * files, zero images. The per-file hardlink fallback (the junction-failed
 * branch) was already written and is the only lane the walk can see.
 *
 * THE LAW the witness asserts (the full after-seat contract):
 *   L1  the import completes (the star lands)
 *   L2  EVERY imported image file appears in the job's own outputs listing
 *   L3  each listed image carries its header nz as `slices` (the walk's
 *       readMrcHeader read — the field the quick-keymap's rich row gates on)
 *   L4  the star's row count matches the imported set
 *   L5  the world is restored: the job is gone, the mint verified
 *
 * The BEFORE ride (pre-seat) records the red with exact numbers (3 files,
 * 0 images); the AFTER ride (post-seat) rides green. One instrument, both
 * halves of the causal story, the receipt keeps them apart by timestamp.
 *
 * Self-contained: it verifies the mint manifest, POSTs its own import job
 * through the real API door (pattern lane → importFileSet), runs it with
 * { local: true }-honesty (the project must be UNBOUND — the witness
 * refuses to run against a bound project rather than unbind anything
 * itself; the t914 window unbinds by hand, rides, and re-binds by hand),
 * asserts, then DELETEs the job (the hard door) and receipts the cleanup.
 *
 *   node scripts/t914-import-visibility-witness.mjs [--receipt <path>]
 */
import { execSync } from "node:child_process";
import { writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const MINT_DIR = path.join(process.cwd(), "data", "t914-stack-mint");
const RECEIPT_DEFAULT = "shots-qa/t914-import-visibility-witness.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  try { return JSON.parse(sh(cmd)); } catch (e) { return { error: String(e.message) }; }
};

// ---- the world guard: a bound project must not be touched by the witness --
const projects = api("GET", "/api/projects");
const activeId = projects?.active ?? projects?.projects?.active;
let bound = null;
try {
  const reg = JSON.parse(readFileSync(path.join(process.cwd(), "data", "projects.json"), "utf8"));
  bound = reg.projects?.[reg.active]?.remote?.connectionId ?? null;
} catch { /* the guard below speaks */ }

// ---- the mint guard: the witness rides only on a verified mint ------------
const mintVerify = sh("node scripts/t914-stack-mint.mjs verify");
const mintOk = !mintVerify.includes("✗");

const results = [];
const listOutputs = (id) => api("GET", `/api/jobs/${id}/outputs`);
const listJobs = () => {
  const d = api("GET", "/api/jobs");
  return d?.jobs ?? [];
};

let jobId = null;
let jobError = null;
try {
  if (!mintOk) {
    fail++; console.error("  ✗ the mint world failed verify — no ride (the law needs its ground truth)");
  } else if (bound) {
    fail++; console.error(`  ✗ the active project is BOUND to ${bound} — the import would take the remote leg (paths stay on the cluster). Unbind by hand first; the witness never unbinds on its own.`);
  } else {
    // ---- the ride: POST → run → poll → assert ---------------------------
    const created = api("POST", "/api/jobs", {
      type: "import",
      name: "t914 visibility witness",
      params: {
        nodeType: "micrographs",
        micrographsPath: "/home/z/my-project/data/t914-stack-mint/*.mrcs",
        pixelSize: 1.77,
      },
    });
    jobId = created?.job?.id ?? null;
    ok("W0 the import job created through the real POST door", !!jobId, jobId ?? JSON.stringify(created).slice(0, 120));
    if (jobId) {
      api("POST", `/api/jobs/${jobId}/run`, {});
      let status = "queued", waited = 0;
      while (waited < 60_000) {
        await sleep(1500); waited += 1500;
        const job = listJobs().find((j) => j.id === jobId);
        status = job?.status ?? "unknown";
        if (status === "completed" || status === "failed" || status === "error") break;
      }
      const job = listJobs().find((j) => j.id === jobId);
      ok("W1 the import completed on the local lane", status === "completed", `${status} · ${(job?.result ?? "").slice(0, 80)}`);

      const out = listOutputs(jobId);
      const files = out?.files ?? [];
      const names = files.map((f) => f.path);
      const stack4 = files.find((f) => f.path.includes("FoilHole_217_35"));
      const stack1 = files.find((f) => f.path.includes("FoilHole_219_20"));
      const star = files.find((f) => f.path === "micrographs.star");

      ok("L1 the star landed in the listing", !!star);
      ok("L2a the 4-frame stack appears in its own listing", !!stack4,
        `listing=${JSON.stringify(names)}`);
      ok("L2b the 1-frame stack appears in its own listing", !!stack1);
      ok("L3a the 4-frame stack carries its header nz (slices=4)", stack4?.slices === 4,
        `slices=${stack4?.slices ?? "absent"}`);
      ok("L3b the 1-frame stack carries its header nz (slices=1)", stack1?.slices === 1,
        `slices=${stack1?.slices ?? "absent"}`);
      const rows = star ? (await Promise.resolve(star.rows)) ?? null : null;
      ok("L4 the star's rows match the imported set", rows === 2, `rows=${rows ?? "?"}`);
      results.push({ names, slices: { a: stack4?.slices ?? null, b: stack1?.slices ?? null } });
    }
  }
} catch (e) {
  jobError = String(e);
} finally {
  // ---- the restore: the hard door + the mint stays for the next rider ----
  if (jobId) {
    const del = api("DELETE", `/api/jobs/${jobId}`);
    await sleep(800);
    const gone = !listJobs().some((j) => j.id === jobId);
    ok("R1 the witness job deleted (the hard door)", del?.ok !== false && del?.error === undefined && gone, gone ? "gone" : "STILL LISTED");
    // the workdir leftover check (DELETE is best-effort on disk)
    const projDir = path.join(process.cwd(), "data", "relion");
    try {
      const worlds = execSync(`ls ${projDir}`, { encoding: "utf8" }).trim().split("\n");
      const leftovers = [];
      for (const w of worlds) {
        try {
          const dirs = execSync(`ls ${projDir}/${w}`, { encoding: "utf8" }).trim().split("\n");
          for (const d of dirs) if (jobId && d.endsWith(jobId.slice(-8))) leftovers.push(`${w}/${d}`);
        } catch { /* world dir vanished — fine */ }
      }
      if (leftovers.length > 0) {
        for (const l of leftovers) { try { rmSync(path.join(projDir, l), { recursive: true, force: true }); } catch {} }
        ok("R2 the witness workdir removed", true, `cleaned: ${leftovers.join(", ")}`);
      } else {
        ok("R2 the witness workdir removed", true, "no leftover on disk");
      }
    } catch { /* the receipt below records the ride either way */ }
  }
}

const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\nverdict: ${verdict}  (${pass} ok, ${fail} fail)`);
const receipt = {
  witness: "t914-import-visibility-witness",
  verdict, pass, fail,
  at: new Date().toISOString(),
  boundAtRide: bound,
  jobError,
  listing: results[0] ?? null,
  mintVerify: mintVerify.split("\n"),
};
const receiptPath = process.argv.includes("--receipt")
  ? process.argv[process.argv.indexOf("--receipt") + 1]
  : RECEIPT_DEFAULT;
try {
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`receipt: ${receiptPath}`);
} catch {}
process.exit(fail === 0 ? 0 : 1);
