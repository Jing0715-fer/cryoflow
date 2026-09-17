// qa68-legacy-archive — the QUARANTINE SENTINEL (Task 274).
//
// Task 273's rebuild window proved the hard way that the repo root is
// build-critical surface: 3.3G of early-era untracked data trees
// (persist/, relion-projects/, mini-services/ — the real-RELION validation
// era's runtime data, commit 5a72d14 is in our history) blew ALL THREE
// memory bills in one window — the turbopack file tracer (EACCES), the
// tailwind v4 content scan (OOM, three identical PostCSS panics), and any
// future tool that scans the repo. Task 274 quarantined them into the
// single _legacy-archive/ root (README inside carries the ownership
// verdict) and collapsed the build exclusions to one line each.
//
// This suite is the immune system for that verdict:
//   A — the product is alive while we police the tree (GET / 200).
//   B — the detector's static verdict: root clean, archive complete,
//       exclusions single-root, gitignore hides the archive.
//   C — the LIVING PROOF: stage a fake root intrusion (persist/.probe),
//       watch the detector's exit code flip 0 -> 2 with the intruder
//       NAMED, heal, watch it return to 0. A detector that cannot fail
//       is a decorative string.
//   D — the healed world leaves no litter (the fake intrusion is gone).
//
// Run: node scripts/qa68-legacy-archive.mjs   (server should be on :3000)
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const B = "http://localhost:3000";
const ROOT = process.cwd();
const CHECKER = join(ROOT, "scripts", "check-foreign-trees.mjs");
const INTRUDER = "persist"; // the fake root intrusion (era name)

let pass = 0;
const ok = (label) => { pass += 1; console.log(`  ok: ${label}`); };
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); process.exit(1); }
  pass += 1; console.log(`  ok: ${label}`);
};
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const runChecker = () => spawnSync("node", [CHECKER], { encoding: "utf8", cwd: ROOT });

console.log("== PHASE A: product alive ==");

// ---- A: the server answers while we guard the tree ------------------------
const home = await fetch(B, { headers: { Origin: B, Referer: `${B}/` } }).catch(() => null);
must(home?.status === 200, `GET / is 200 (got ${home?.status ?? "no response"})`);

console.log("== PHASE B: the detector's verdict ==");

// ---- B: the static verdict, spoken by the checker --------------------------
const clean = runChecker();
must(clean.status === 0, `detector exits 0 on the healed tree (got ${clean.status})`);
must(clean.stdout.includes("FOREIGN-TREE CHECK GREEN"), "detector speaks GREEN");
for (const name of ["persist/", "relion-projects/", "mini-services/", "qa-shots/", "qa-shots-17/"]) {
  must(clean.stdout.includes(`root is free of "${name}"`), `ledger names the root free of ${name}`);
}
for (const name of ["molstar", "molstar.css"]) {
  must(clean.stdout.includes(`public/ is free of "${name}"`), `ledger names public/ free of ${name}`);
}
must(clean.stdout.includes("quarantine root _legacy-archive/ exists"), "ledger names the archive root");
must(clean.stdout.includes("README.md carries the ownership verdict"), "ledger names the verdict README");
const memberCount = (clean.stdout.match(/_legacy-archive\/\S+ present/g) || []).length;
must(memberCount === 7, `all 7 archived members witnessed present (got ${memberCount})`);
must(clean.stdout.includes('next.config.ts outputFileTracingExcludes names "_legacy-archive/**"'), "tracer exclusion is single-root");
must(clean.stdout.includes('globals.css @source not names "../../_legacy-archive"'), "tailwind exclusion is single-root");
must(!clean.stdout.includes('"persist/**"') && !clean.stdout.includes('"relion-projects/**"'), "no stale per-tree tracer exclusions remain");
must(clean.stdout.includes('.gitignore hides /_legacy-archive/'), "gitignore hides the archive");
must(clean.stdout.includes('tsconfig exclude hides _legacy-archive/'), "tsc exclusion is single-root (t276: the fourth layer)");

console.log("== PHASE C: the living proof — an intrusion must flip the verdict ==");

// ---- C: stage a fake intrusion, watch 0 -> 2, heal, watch 2 -> 0 -----------
try {
  mkdirSync(join(ROOT, INTRUDER), { recursive: true });
  writeFileSync(join(ROOT, INTRUDER, ".qa68-probe"), "the era tree is back\n");
  must(existsSync(join(ROOT, INTRUDER)), `fake intrusion staged (${INTRUDER}/.qa68-probe)`);

  const dirty = runChecker();
  must(dirty.status === 2, `detector exits 2 under intrusion (got ${dirty.status})`);
  must(dirty.stdout.includes(`legacy tree "${INTRUDER}/" is BACK in the repo root`), "the FAIL line NAMES the intruder");
  must(dirty.stdout.includes("FOREIGN-TREE CHECK: 1 FAIL"), "the verdict line counts the failure");

  rmSync(join(ROOT, INTRUDER), { recursive: true, force: true });
  const healed = runChecker();
  must(healed.status === 0, "detector returns to 0 after the heal");
  must(healed.stdout.includes("FOREIGN-TREE CHECK GREEN"), "the healed world speaks GREEN again");
} finally {
  // the suite must never LEAVE an intrusion behind — that would poison
  // every future run of this suite and the real build alike
  rmSync(join(ROOT, INTRUDER), { recursive: true, force: true });
}

console.log("== PHASE D: no litter ==");

// ---- D: the fake intrusion is really gone ----------------------------------
must(!existsSync(join(ROOT, INTRUDER)), "the fake intrusion left no litter");
must(!existsSync(join(ROOT, "relion-projects")) && !existsSync(join(ROOT, "mini-services")), "the real era trees remain quarantined");

console.log(`\nqa68: ALL PASS (${pass} assertions) — the quarantine verdict is guarded`);
