// t161 — Task 161: the cleanup-radius protocol (the shared-workdir house rules).
//
// The incident being pinned: qa58-seed-gallery.py --clean used to pop the
// QA Class2D Source engine-state entry unconditionally, while the workdir
// hosted TENANTS — qa67-seed-volume.py's orthovol.mrc. The /outputs route
// resolves run.workdir THROUGH the entry (then readdirSyncs the disk), so
// a popped entry orphaned the volume on disk: outputs → workdir null,
// files [], qa67/qa68 dead. Full matrices survived only because qa66's
// self-seed happened to re-register the entry in between; the moment a
// round ran qa59 → qa68 back-to-back (Task 160's regression phase), the
// chain broke. The fix is the tenant-aware teardown: the entry pops only
// when the workdir holds nothing beyond the seeder's own assets.
//
// Phases (no browser — this is a seeder-contract probe; the assertion
// surface is the filesystem + the REAL /outputs route):
//   S  preflight — server up, qa58 seeder idempotent, SRC found, roster
//   X  source oracles — the tenant-aware shape exists in the seeder, the
//      doctrine block lives in qa_lib.py, qa62 documents its root shape
//   B  CORE — tenant survives the landlord's cleanup: seed orthovol →
//      qa58 --clean → star/mrcs GONE, orthovol ALIVE, entry KEPT, the
//      real /outputs lists orthovol, the file route still renders a PNG
//      (the exact chain Task 160 broke, now green without any re-seed)
//   C  honest pop — tenant leaves (qa67 --clean) → qa58 --clean → entry
//      POPPED (radius = seed radius when nobody rents), outputs honest
//   D  restore the standing world — qa58 seeder + qa67 volume back, the
//      suite leaves the base BETTER than it found it (entry + orthovol +
//      star all present), roster unchanged throughout
//
// Run: node scripts/t161-e2e.mjs   (server on :3000, qa58-seed-gallery base)
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = "/home/z/my-project";
const B = "http://localhost:3000";
const SEEDER = `${ROOT}/scripts/qa58-seed-gallery.py`;
const VOLSEED = `${ROOT}/scripts/qa67-seed-volume.py`;
const STATE = `${ROOT}/data/engine-state.json`;
const SRC_NAME = "QA Class2D Source";

let PASS = 0;
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); process.exit(1); }
  PASS++;
  console.log(`  ok: ${label}`);
};
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim();
const api = (path) => JSON.parse(execSync(`curl -s ${B}${path}`, { encoding: "utf8", timeout: 30_000 }));
const readState = () => JSON.parse(readFileSync(STATE, "utf8"));

// ---- S: preflight -----------------------------------------------------------
console.log("— S: preflight —");
const health = execSync(`curl -s -o /dev/null -w '%{http_code}' ${B}/`, { encoding: "utf8" });
must(health === "200", `server on :3000 answers 200 (got ${health})`);
sh(`python3 ${SEEDER} >/dev/null`);
console.log("  ok: qa58 seeder ran (idempotent)");
const jobs0 = (api("/api/jobs").jobs || []);
const SRC = jobs0.find((j) => j.name === SRC_NAME);
must(!!SRC, `seed job "${SRC_NAME}" present (restore-gallery.py owns the living base)`);
const roster0 = jobs0.length;
must(roster0 > 0, `roster snapshot: ${roster0} jobs`);
let srcId = SRC.id;

// ---- X: source oracles --------------------------------------------------------
console.log("— X: source oracles (the tenant-aware shape) —");
const seederSrc = readFileSync(SEEDER, "utf8");
must(seederSrc.includes("Task 161 — cleanup-radius protocol"), "seeder carries the Task 161 protocol comment");
must(seederSrc.includes("own = {os.path.basename(star_path), os.path.basename(mrcs_path)}"), "own-asset set = exactly the seeder's two files");
must(seederSrc.includes("tenants = sorted(f for f in os.listdir(workdir) if f not in own)"), "tenants = workdir entries beyond the own-asset set");
must(seederSrc.includes("entry KEPT — tenant files present"), "KEPT branch reports the tenants by name");
const keptIdx = seederSrc.indexOf("if tenants:");
const popIdx = seederSrc.indexOf("state.pop(src[\"id\"]");
must(keptIdx !== -1 && popIdx !== -1 && popIdx > keptIdx, "the pop lives AFTER the tenants guard (unconditional pop is the disease)");
const libSrc = readFileSync(`${ROOT}/scripts/qa_lib.py`, "utf8");
must(libSrc.includes("Task 161 — THE CLEANUP-RADIUS PROTOCOL"), "qa_lib.py carries the doctrine block");
must(libSrc.includes("TENANT-AWARE") && libSrc.includes("ROOT"), "doctrine names both coherent teardown shapes");
const q62 = readFileSync(`${ROOT}/scripts/qa62-offline-clean.py`, "utf8");
must(q62.includes("ROOT teardown shape"), "qa62-offline-clean documents why its unconditional pop is coherent");

// ---- B: CORE — the tenant survives the landlord's cleanup --------------------
console.log("— B: tenant survives the cleanup (the Task 160 chain, healed) —");
sh(`python3 ${VOLSEED} >/dev/null`);
console.log("  ok: qa67-seed-volume dropped orthovol.mrc into the shared workdir");
const stateEntry = readState()[srcId];
const workdir = stateEntry && stateEntry.workdir;
must(!!workdir, "engine-state entry resolves the workdir");
const starPath = join(workdir, "run_it012_data.star");
const mrcsPath = join(workdir, "run_it012_unmasked_classes.mrcs");
const volPath = join(workdir, "orthovol.mrc");
must(existsSync(starPath) && existsSync(mrcsPath) && existsSync(volPath), "all three files on disk before the clean (star + mrcs + tenant volume)");

const cleanOut = sh(`python3 ${SEEDER} --clean`);
must(cleanOut.includes("entry KEPT — tenant files present: ['orthovol.mrc']"), `clean reports the kept entry + tenant by name (got: ${cleanOut.split("\n").filter(l => l.includes("KEPT"))[0] || "?"})`);
must(!existsSync(starPath) && !existsSync(mrcsPath), "landlord's own files are GONE (radius still covers its seed)");
must(existsSync(volPath), "tenant volume STILL on disk (the orphaning is dead)");
must(!!readState()[srcId], "engine-state entry KEPT (a living job keeps its registration)");
const outs = api(`/api/jobs/${srcId}/outputs`);
must(outs.workdir === workdir, `real /outputs resolves the workdir (got ${outs.workdir})`);
const listed = (outs.files || []).map((f) => f.path || f.name || "");
must(listed.includes("orthovol.mrc"), `real /outputs lists the tenant file (files: ${JSON.stringify(listed)})`);
const png = execSync(
  `curl -s -H "Origin: ${B}" "${B}/api/jobs/${srcId}/outputs/file?path=orthovol.mrc&format=png&axis=z&pos=0.5"`,
  { encoding: "buffer", timeout: 60_000 },
);
must(png.length > 500 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47, `file route still renders the volume slice (${png.length} bytes, PNG magic) — qa67 Phase A's ride is alive`);

// ---- C: the honest pop — tenant leaves, then the radius closes ---------------
console.log("— C: tenant leaves → the honest pop —");
sh(`python3 ${VOLSEED} --clean >/dev/null`);
must(!existsSync(volPath), "tenant removed its own file (qa67's radius is its own asset)");
sh(`python3 ${SEEDER} --clean >/dev/null`);
must(!readState()[srcId], "entry POPPED once nobody rents (radius = seed radius)");
const outsEmpty = api(`/api/jobs/${srcId}/outputs`);
must(outsEmpty.workdir === null && (outsEmpty.files || []).length === 0, "outputs honest-empty for a living job without registration (pre-existing semantics)");

// ---- D: restore the standing world (leave it better than found) --------------
console.log("— D: restore the standing base —");
sh(`python3 ${SEEDER} >/dev/null`);
sh(`python3 ${VOLSEED} >/dev/null`);
const restored = readState()[srcId];
must(!!restored && restored.workdir, "entry re-registered");
must(existsSync(join(restored.workdir, "run_it012_data.star")), "star restored");
must(existsSync(join(restored.workdir, "run_it012_unmasked_classes.mrcs")), "mrcs restored");
must(existsSync(join(restored.workdir, "orthovol.mrc")), "orthovol restored");
const roster1 = (api("/api/jobs").jobs || []).length;
must(roster1 === roster0, `roster unchanged through the whole probe (${roster1} == ${roster0}) — cleans never touch job rows`);

console.log(`T161 ALL PASS (${PASS} assertions)`);
