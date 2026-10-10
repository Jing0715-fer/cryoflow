/**
 * t413 — apply the archive retention v2 (reclaimScript, three tiers) to
 * every real .cryoflow_prev archive in the sandbox's mock-cluster fs.
 *
 * The live witness that started this: initialmodel_huefiq69's archive at
 * 830 MB (2 × 415 MB — initialmodel's real-RELION default --iter 200 ×
 * per-iteration half-maps) on a 9.9 GB disk at 79%. The v2 mechanism
 * shipped this window: tier 1 keep-2 (t385, unchanged), tier 2 a byte
 * budget that eats the OLDEST kept generation until under budget or one
 * generation remains, tier 3 the crown slim (final round of every
 * iteration family + non-iteration files survive).
 *
 * The t384 doctrine: the bench plays the login node against real local
 * files — so this janitor runs the EXACT bytes reclaimScript() emits
 * (the inner, extracted, synchronously — no nohup, the janitor waits)
 * against each workdir that has an archive.
 *
 * bun run scripts/t413-archive-retention-janitor.mjs [--budget N]
 */
// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { reclaimScript, ARCHIVE_BUDGET_BYTES } = await __jiti.import("../src/lib/remote/remote-cleanup.ts");
import { readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MOCK_FS = path.resolve(import.meta.dir, "../services/mock-cluster/fs/projects");
const budgetArg = process.argv.indexOf("--budget");
const budget = budgetArg > -1 ? Number(process.argv[budgetArg + 1]) : ARCHIVE_BUDGET_BYTES;

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function dirBytes(p) {
  let total = 0;
  try {
    for (const e of readdirSync(p)) {
      const fp = path.join(p, e);
      const st = statSync(fp);
      if (st.isDirectory()) total += dirBytes(fp);
      else total += st.size;
    }
  } catch { /* unreadable counts as 0 — the cluster lies, we count what we see */ }
  return total;
}

/** Extract the inner script (the nohup'd payload) from the outer bytes
 * and un-escape it back to plain sh — the same inversion the login
 * node's own `sh -c` performs. */
function innerOf(outer) {
  const m = outer.match(/sh -c '([\s\S]*)' >\/dev\/null/);
  if (!m) throw new Error("no inner found in the reclaim script bytes");
  return m[1].replace(/'\\''/g, "'");
}

if (!existsSync(MOCK_FS)) {
  console.log(`no mock fs at ${MOCK_FS} — nothing to reclaim`);
  process.exit(0);
}

function findArchives(root, depth = 0, acc = []) {
  if (depth > 6) return acc;
  for (const e of readdirSync(root)) {
    const p = path.join(root, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (!st.isDirectory()) continue;
    if (e === ".cryoflow_prev") acc.push(path.dirname(p));
    else findArchives(p, depth + 1, acc);
  }
  return acc;
}

let freed = 0;
const rows = [];
for (const workdir of findArchives(MOCK_FS)) {
  const archive = path.join(workdir, ".cryoflow_prev");
  const before = dirBytes(archive);
  const outer = reclaimScript(workdir, 2, budget);
  execFileSync("/bin/sh", ["-c", innerOf(outer)], { cwd: workdir, stdio: ["ignore", "ignore", "pipe"] });
  const after = existsSync(archive) ? dirBytes(archive) : 0;
  freed += before - after;
  rows.push({ job: path.relative(MOCK_FS, workdir), before, after });
}

for (const r of rows) {
  console.log(`${r.job.padEnd(28)} ${mb(r.before).padStart(10)} → ${mb(r.after).padStart(10)}`);
}
console.log(`\nbudget per workdir archive: ${mb(budget)} · workdirs touched: ${rows.length} · freed: ${mb(freed)}`);
