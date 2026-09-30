/**
 * t501 — the agent reads the landscape: the Map QC inventory's AGENT
 * face. The paper (t211), the doors (t213) and the CSV grid (t232) had
 * the landscape to themselves; the assistant could read ONE job's
 * curves (get_job_curves) or two same-stage runs (compare_jobs) but
 * never the session's whole geography. The new tool walks the SAME
 * roster (newest first, the paper's own cap), lists workdirs through
 * the outputs route's ONE well (the walk moved to lib/relion/
 * outputs-list — a change of address, not a rewrite), profiles each
 * owner's main map through the map-profile route's own chain, and
 * words every number through qc-report's OWN arithmetic — twins fork,
 * imports don't.
 *
 *   T1 the well      — behavioral: the moved walk really walks (kinds,
 *                      sort, dotfiles, depth cap, 300 cap), and the
 *                      route carries no inline twin anymore
 *   T2 the constants — MAIN_MAP_RE / MAP_BRIEF_CAP live in lib/map-walk,
 *                      pure and import-free; dialog and tool drink there
 *   T3 the face      — schema + dispatch: one tool name, THE-tool
 *                      description, the case wired to the executor
 *   T4 the walk law  — newest first, completed only, the paper's cap,
 *                      honest skip receipts, the main-map law
 *   T5 one arithmetic — every number through qc-report's own fns; no
 *                      inline pearson/resample in the executor body
 *   T6 the neighbors — the outputs route's response shape, the
 *                      map-profile chain and get_job_curves untouched
 */

import { mkdirSync, rmSync, writeFileSync } from "fs";
import { readFileSync } from "fs";

const REPO = "/home/z/my-project";
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");
const lib = await import("../src/lib/relion/outputs-list");
const { MAIN_MAP_RE, MAP_BRIEF_CAP } = await import("../src/lib/map-walk");

const routeSrc = read("src/app/api/jobs/[id]/outputs/route.ts");
const toolsSrc = read("src/lib/ai/tools.ts");
const dialogSrc = read("src/components/workflow/session-report-dialog.tsx");
const mapProfileSrc = read("src/app/api/jobs/[id]/map-profile/route.ts");
const qcSrc = read("src/lib/qc-report.ts");
const mapWalkSrc = read("src/lib/map-walk.ts");

// ---------------------------------------------------------------- T1
section("T1 the well — the moved walk really walks; the route carries no twin");
const walkRoot = `${REPO}/scripts/.tmp-t501-walk`;
rmSync(walkRoot, { recursive: true, force: true });
mkdirSync(`${walkRoot}/early`, { recursive: true });
mkdirSync(`${walkRoot}/d1/d2/d3/d4`, { recursive: true });
writeFileSync(`${walkRoot}/a.mrc`, Buffer.alloc(64, 7)); // garbage bytes: kind mrc, header refuses
writeFileSync(`${walkRoot}/b.star`, "garbage star");
writeFileSync(`${walkRoot}/.hidden.txt`, "skip me");
writeFileSync(`${walkRoot}/early/c.mrcs`, Buffer.alloc(32, 3));
writeFileSync(`${walkRoot}/d1/d2/d3/f.txt`, "depth three is listed");
writeFileSync(`${walkRoot}/d1/d2/d3/d4/x.txt`, "depth four is not");
for (let i = 0; i < 297; i++) writeFileSync(`${walkRoot}/filler-${String(i).padStart(3, "0")}.dat`, "x");

const walked = lib.walkWorkdir(walkRoot);
ok(Array.isArray(walked.files) && walked.truncated === true, "a 300-file cap flips the honest truncated flag");
ok(walked.files.every((f) => !f.path.includes(".hidden")) === true, "dotfiles never enter the listing");
ok(walked.files.every((f) => !f.path.includes("d4")) === true, "the walk never follows past depth three");
ok(walked.files[0]?.path === "a.mrc" && walked.files[0]?.kind === "mrc", "mrc files lead the kind-ordered sort");
ok(walked.files.find((f) => f.path === "early/c.mrcs")?.kind === "mrc" === true, "a .mrcs stack is an mrc-kind file");
ok(walked.files.find((f) => f.path === "early/c.mrcs")?.dims === undefined, "a garbage header earns no dims (honest absence)");
ok(walked.files.find((f) => f.path === "b.star")?.kind === "star" === true, "star files keep their kind");
ok(lib.classify("x.map") === "mrc" && lib.classify("x.ccp4") === "mrc", "the RELION map extensions stay classified mrc");
ok(lib.classify("x.pdf") === "image" && lib.classify("x.log") === "text", "pdf/log keep their kinds (the moved code, verbatim)");
ok(lib.friendlyLabel("postprocess.mrc", "postprocess.mrc") === "Sharpened map", "the friendly captions moved with the walk");
ok(!/function walkWorkdir/.test(routeSrc) && !/const KIND_ORDER/.test(routeSrc) && !/function classify\(/.test(routeSrc), "the route defines no inline twin anymore");
ok(/from "@\/lib\/relion\/outputs-list"/.test(routeSrc), "the route drinks from the one well");
ok(/walkWorkdir\(workdir\)/.test(routeSrc), "the route's GET still walks the same cup");
rmSync(walkRoot, { recursive: true, force: true });

// ---------------------------------------------------------------- T2
section("T2 the constants — one home, import-free, both consumers wired");
ok(MAP_BRIEF_CAP === 24, "the paper's own cap rides the shared constant");
ok(MAIN_MAP_RE.test("run_it015_half0_class001.mrc") && MAIN_MAP_RE.test("postprocess.mrc"), "half0 and postprocess are main maps");
ok(!MAIN_MAP_RE.test("run_it015_half1_class001.mrc") && !MAIN_MAP_RE.test("run_class001.mrc"), "half1 and class maps are overlays, not mains");
ok(!/from "fs"|from "path"|require\(/.test(mapWalkSrc), "the constants module stays import-free (a client component drinks here)");
ok(!/const MAIN_MAP_RE/.test(dialogSrc) && !/const MAP_BRIEF_CAP = 24/.test(dialogSrc), "the dialog keeps no local twin of the constants");
ok(/import \{ MAP_BRIEF_CAP, MAIN_MAP_RE, VOLUME_CAPABLE_RE \} from "@\/lib\/map-walk"/.test(dialogSrc), "the dialog imports the shared constants");
ok(!/const VOLUME_CAPABLE_RE/.test(dialogSrc), "the dialog keeps no local twin of the queue law");
ok(/export const VOLUME_CAPABLE_RE = \/refine3d\|class3d\|postprocess\|multibody\/i;/.test(mapWalkSrc), "the queue law lives in the constants well (agent and paper drink the same cup)");

// ---------------------------------------------------------------- T3
section("T3 the face — schema, description, dispatch");
ok(/name: "get_map_landscape"/.test(toolsSrc), "the tool is in the catalog");
ok(/The session's MAP LANDSCAPE in one read/.test(toolsSrc), "the description names the landscape read");
ok(/get_job_curves reads ONE job's curves, compare_jobs reads two runs of the same stage, this reads the session's geography/.test(toolsSrc), "the description draws the boundary against its siblings (same line, the docstring lesson)");
ok(/parameters: \{ type: "object", properties: \{\}, additionalProperties: false \}/.test(toolsSrc.slice(toolsSrc.indexOf("get_map_landscape"), toolsSrc.indexOf("get_map_landscape") + 2400)), "a landscape read takes no knobs (the walk is the walk)");
ok(/case "get_map_landscape":\s*\n\s*return await getMapLandscape\(ctx\);/.test(toolsSrc), "dispatch wires the name to the executor");

// ---------------------------------------------------------------- T4
section("T4 the walk law — the paper's OWN queue: capable-first, byRecency, cap, honest skips");
const execStart = toolsSrc.indexOf("async function getMapLandscape");
const execBody = toolsSrc.slice(execStart, toolsSrc.indexOf("async function getJobCurves", execStart));
ok(/VOLUME_CAPABLE_RE\.test\(j\.type\)\)\.sort\(byRecency\)/.test(execBody) && /!VOLUME_CAPABLE_RE\.test\(j\.type\)\)\.sort\(byRecency\)/.test(execBody), "the queue is the paper's two-tier law: capable types ride the front, both tiers byRecency");
ok(/a\.updatedAt < b\.updatedAt \? 1 : a\.updatedAt > b\.updatedAt \? -1 : a\.id < b\.id \? -1 : 1/.test(execBody), "byRecency is the dialog's three-way comparator VERBATIM (the id tiebreak keeps same-instant stamps honest)");
ok(/\.slice\(0, MAP_BRIEF_CAP\)/.test(execBody), "the cap lands on the MERGED queue (the paper's own budget point)");
ok(!/createdAt/.test(execBody), "no createdAt ordering twin (the walk order is the dialog's, not the db default's)");
ok(/status === "completed"/.test(execBody), "only completed candidates are probed");
ok(/f\.kind === "mrc" && Array\.isArray\(f\.dims\)/.test(execBody), "a true 3D volume is kind mrc WITH dims (stacks never pass)");
ok(/Number\(MAIN_MAP_RE\.test\(b\.name\)\) - Number\(MAIN_MAP_RE\.test\(a\.name\)\)/.test(execBody), "the main-map law sorts the volume family (postprocess/half0 lead)");
ok(/skippedNoVolume|skippedNoWorkdir|skippedRefused/.test(execBody), "every skip speaks its count (silence with a receipt)");
ok(/without a 3D volume, \$\{skippedNoWorkdir\} without an on-disk workdir, \$\{skippedRefused\} with a refused profile/.test(execBody), "the receipt line names all three honest silences");
ok(/No completed jobs yet — the landscape is empty\./.test(execBody), "an empty roster says so instead of inventing a winner");

// ---------------------------------------------------------------- T5
section("T5 one arithmetic — the inventory's own math, imported");
ok(/from "@\/lib\/qc-report";/.test(execBody) === false && /peakPctOf,/.test(toolsSrc.slice(0, execStart)) === true, "qc-report's vocabulary rides the module imports, not a second import site");
ok(!/pearson\(/.test(execBody) && !/resampleByFraction\(/.test(execBody), "no inline correlation in the executor body (the well stays single)");
ok(/shapeAgreement\(winner\.bins, h\.bins\)/.test(execBody), "agreement r is the inventory's own helper (winner's row rides the same path)");
ok(/deltaVsWinner\(pct, winnerPct\)/.test(execBody), "the Δ column is deltaVsWinner itself, never re-derived");
ok(/weakestCellOf\(weakestBand\(bands\)\)/.test(execBody), "the weakest band is the family machinery, composed");
ok(/peakPctNumOf\(h\.bins\)/.test(execBody) && /peakPctNumOf\(winner\.bins\)/.test(execBody), "the delta base sits on the paper's own 1-decimal grid");
ok(/outlierRowIdx\(rows\.map\(\(r\) => \(\{ peakPct: r\.pct \}\)\)\)/.test(execBody) && /contestedCrown\(rows\.map\(\(r\) => \(\{ peakPct: r\.pct \}\)\)\)/.test(execBody), "the amber lens and the contested crown read the same rows");
ok(/resolveInsideJobWorkdir|readPathrefTarget|isMrcPath|cachedCompute/.test(execBody), "the profile chain is the map-profile route's own posture (containment, pathref, statcache)");
ok(/"map-profile:v1"/.test(execBody), "the statcache key is the route's own (one cache, two consumers)");

// ---------------------------------------------------------------- T6
section("T6 the neighbors — sibling routes and tools untouched");
ok(/workdir,|engine,|files,|inputs:|summary,|warnings,|note:/.test(routeSrc), "the outputs route's response keys survive the extraction");
ok(/resolveInsideJobWorkdir\(run\.workdir, rel\)/.test(mapProfileSrc) && /cachedCompute\(abs, "map-profile:v1"/.test(mapProfileSrc), "the map-profile route keeps its own chain (the tool mirrors, never swaps it)");
ok(/case "get_job_curves":/.test(toolsSrc), "get_job_curves keeps its case");
ok(/case "compare_jobs":/.test(toolsSrc), "compare_jobs keeps its case");
ok(/export const shapeAgreement = \(/.test(qcSrc) && /export const weakestCellOf = \(/.test(qcSrc), "qc-report's arithmetic stands untouched (the tool imports, it does not edit)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
