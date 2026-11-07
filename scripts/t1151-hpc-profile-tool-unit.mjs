#!/usr/bin/env node
/**
 * t1151 — THE HPC-PROFILE-TOOL unit: the profile registry, the AGENT
 * face.
 *
 * The user's tuned sbatch vocabulary learned to speak in t259 (the
 * metadata door) and the profiles editor gives every field a face.
 * Thirty-six agent tools could read the connections' roster
 * (list_clusters), the param shelf (get_param_presets) and the template
 * shelf (get_custom_templates) — none could quote the SUBMISSION
 * TARGETS: a user asking 「什么分区」 or "how many GPUs / what walltime"
 * forced the model to invent a sbatch vocabulary. The cure rides the
 * t530/t1148/t1149/t1150 shape: a PURE presenter
 * (src/lib/ai/hpc-profile-present.ts) speaking the editor's own words,
 * the well riding the lib's OWN loader through the NEW verdict father
 * (loadProfilesVerdict — loadProfiles' silent fall-through made
 * speakable at the SOURCE, one birthplace, no second loader), and the
 * prompt's PROFILE LAW (never invent a partition — the defaults'
 * .example.org hosts are EXAMPLES).
 *
 * A — the presenter run FOR REAL: the rows face (the editor's own
 *     order and words, host null = submit locally, the env lines byte
 *     for byte), the THREE honest faces (never-persisted = the house
 *     defaults WITH the examples word / corrupt / emptied), the
 *     determinism, the no-age law, the wear and scope lines.
 * B — the tools.ts + slurm.ts source-pinned: the zero-knob schema, the
 *     cousins named, the case routed, the well's feed (no fs, no
 *     parsing, no sorting), the verdict father's ONE birthplace
 *     (loadProfiles rides it; the silent fall-through is dead).
 * C — the doctrine: the prompt's PROFILE LAW, the defaults-are-examples
 *     word, the purity laws (no clock, no db, no fs in the presenter,
 *     the editor's word cup).
 *
 * node scripts/unit-runner.mjs scripts/t1151-hpc-profile-tool-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { presentHpcProfiles } from "@/lib/ai/hpc-profile-present";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const toolsSrc = readFileSync(join(ROOT, "src/lib/ai/tools.ts"), "utf8");
const promptSrc = readFileSync(join(ROOT, "src/lib/ai/prompt.ts"), "utf8");
const presentSrc = readFileSync(join(ROOT, "src/lib/ai/hpc-profile-present.ts"), "utf8");
const slurmSrc = readFileSync(join(ROOT, "src/lib/hpc/slurm.ts"), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- fixtures ---------- */

// The registry's own order is the array's order — the fixture uses a
// distinctive order (a local profile between two cluster profiles) to
// prove the presenter rides it without sorting.
const PROFILE = (over) => ({
  id: "p-x",
  name: "Profile X",
  host: "login.x.org",
  partition: "gpu",
  account: "cryo-em",
  qos: "normal",
  timeLimitMin: 720,
  nodes: 4,
  gpusPerNode: 4,
  gpuModel: "A100",
  relionHome: "/opt/relion/5.0.1",
  dataRoot: "/lustre/project/cryoflow",
  localRoot: "/data/relion",
  envLines: ["module purge", "module load relion/5.0.1 cuda/12.2"],
  ctffind: "/opt/ctffind/4.1.14/bin/ctffind",
  arrayConcurrency: 16,
  gpuSpeedup: 25,
  ...over,
});

const ROWS = [
  PROFILE({ id: "p-1", name: "The box itself", host: null, partition: "none", gpusPerNode: 0, gpuModel: "RTX4090" }),
  PROFILE({ id: "p-2", name: "Big A100 partition" }),
  PROFILE({ id: "p-3", name: "H100 burst", host: "h100.x.org", partition: "burst", gpuModel: "H100", qos: "burst", nodes: 2, gpusPerNode: 8 }),
];

const feed = (profiles, persisted = true, corrupt = false) =>
  presentHpcProfiles({ profiles, persisted, corrupt });

/* ---------- A — the presenter run FOR REAL ---------- */

console.log("A — the presenter run FOR REAL (the registry's own words, composed)");

const spoken = feed(ROWS);
const rows = spoken.detail?.profiles ?? [];

// A1 — the rows face: ok, every profile named with the editor's words.
ok("A1 the read speaks ok and names every profile with the editor's words",
  spoken.ok === true &&
    spoken.summary.includes('"The box itself"') &&
    spoken.summary.includes('"Big A100 partition"') &&
    spoken.summary.includes('"H100 burst"'));
ok("A1 the summary speaks the partition/host/resources word",
  spoken.summary.includes("gpu on login.x.org (4 nodes × 4 GPUs/node A100)") &&
    spoken.summary.includes("the editor's own order"));

// A2 — the registry's OWN order (no sort law exists here — the editor
// sidebar's order rides untouched).
ok("A2 the annex rides the registry's own order (no re-sort)",
  rows.length === 3 &&
    rows[0].name === "The box itself" &&
    rows[1].name === "Big A100 partition" &&
    rows[2].name === "H100 burst");

// A3 — host null speaks its own meaning (submit locally).
ok("A3 host null = the local submit word (hostMode local)",
  rows[0].hostMode === "local" && rows[0].host === null &&
    spoken.summary.includes("submits locally"));
ok("A3 a host set = cluster mode",
  rows[1].hostMode === "cluster" && rows[1].host === "login.x.org");

// A4 — the env lines byte for byte (the user's module loads are the
// identity of the profile's environment).
ok("A4 the env lines ride byte for byte (the t1149 snapshot law)",
  JSON.stringify(rows[1].envLines) ===
    JSON.stringify(["module purge", "module load relion/5.0.1 cuda/12.2"]));

// A5 — the never-persisted face: the house defaults WITH the examples
// word (the .example.org hosts are EXAMPLES, never a reachable target).
const never = feed(ROWS, false, false);
ok("A5 the never-persisted face speaks the house defaults + the examples word",
  never.ok === true &&
    never.summary.includes("HOUSE DEFAULTS") &&
    never.summary.includes(".example.org") &&
    never.summary.includes("never as a reachable submission target") &&
    never.detail.persisted === false && never.detail.profiles.length === 3);

// A6 — the corrupt face: the silent fall-through, said aloud.
const corrupt = feed(ROWS, true, true);
ok("A6 the corrupt registry says so and quotes nothing as the user's tuning",
  corrupt.ok === true &&
    corrupt.summary.includes("could not be read or parsed") &&
    corrupt.summary.includes("Quote nothing") &&
    corrupt.detail.corrupt === true && corrupt.detail.persisted === true);

// A7 — the emptied face: the deletion's truth.
const empty = feed([], true, false);
ok("A7 the emptied registry is the deletion's truth (not a missing sync)",
  empty.ok === true &&
    empty.summary.includes("holds 0 profiles") &&
    empty.summary.includes("the deletion's truth"));

// A8 — determinism: the same rows speak the same words, byte for byte.
const again = feed(ROWS);
ok("A8 the read is deterministic (the same rows, the same bytes)",
  JSON.stringify(spoken) === JSON.stringify(again));

// A9 — the wear and scope lines: the dry-run door, the connection's
// cousin, the SERVER's registry.
ok("A9 the summary teaches the wear line (the dry-run door, the connection's cousin)",
  spoken.summary.includes("sbatch dry-run door") &&
    spoken.summary.includes("the connection's own Slurm settings") &&
    spoken.summary.includes("list_clusters"));
ok("A9 the scope line says the registry is the SERVER's",
  spoken.summary.includes("the SERVER's") &&
    spoken.summary.includes("across projects"));

// A10 — the no-age law: a profile does not rot (no Fresh, no Marathon,
// no "ago").
ok("A10 the face speaks no age verdict (no ago, no Fresh, no Marathon)",
  !spoken.summary.includes("ago") && !spoken.summary.includes("Fresh") &&
    !spoken.summary.includes("Marathon"));

/* ---------- B — the well and the schema, source-pinned ---------- */

console.log("B — the well, the schema and the verdict father, source-pinned");

const schemaStart = toolsSrc.indexOf('name: "get_hpc_profiles"');
const schemaEnd = toolsSrc.indexOf('name: "get_continue_sources"', schemaStart);
const schemaSlice = schemaStart > -1 && schemaEnd > schemaStart ? toolsSrc.slice(schemaStart, schemaEnd) : "";
const wellStart = toolsSrc.indexOf("async function getHpcProfiles");
const wellEnd = toolsSrc.indexOf("/* ---- get_continue_sources", wellStart);
const wellSlice = wellStart > -1 && wellEnd > wellStart ? toolsSrc.slice(wellStart, wellEnd) : "";

ok("B1 the tool is registered with ZERO knobs (the registry is the registry)",
  schemaSlice.length > 0 &&
    schemaSlice.includes('parameters: { type: "object", properties: {}, additionalProperties: false }') &&
    !schemaSlice.includes("required:"));
ok("B2 the description names its cousins and its own cup",
  schemaSlice.includes("list_clusters") && schemaSlice.includes("THE tool for") &&
    schemaSlice.includes("Read-only QUOTER") && schemaSlice.includes(".example.org"));
ok("B3 the switch routes the read to its well",
  toolsSrc.includes('case "get_hpc_profiles":') &&
    toolsSrc.includes("return await getHpcProfiles();"));
ok("B4 the well drinks the PURE presenter (the t530 shape)",
  toolsSrc.includes('import { presentHpcProfiles } from "@/lib/ai/hpc-profile-present";'));
ok("B5 the well rides the verdict father (the lib's OWN loader — no second read)",
  wellSlice.includes("loadProfilesVerdict()") &&
    wellSlice.includes("persisted: verdict.persisted") &&
    wellSlice.includes("corrupt: verdict.corrupt"));
ok("B6 the well only feeds — no fs, no parsing, no sorting inside",
  wellSlice.length > 0 &&
    !wellSlice.includes("existsSync") && !wellSlice.includes("JSON.parse") &&
    !wellSlice.includes(".sort(") && !wellSlice.includes(".filter(") &&
    !wellSlice.includes("readFileSync"));
ok("B7 the verdict father has ONE birthplace — loadProfiles rides it, the silent fall-through is dead",
  slurmSrc.includes("export function loadProfilesVerdict") &&
    slurmSrc.includes("export function loadProfiles(): SlurmProfile[] {\n  return loadProfilesVerdict().profiles;\n}") &&
    !/catch \{\s*\/\* fall through to defaults \*\/\s*\}/.test(slurmSrc));

/* ---------- C — the doctrine + the purity laws ---------- */

console.log("C — the doctrine source-pinned, the fathers' exclusivity");

const presentCode = presentSrc.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

ok("C1 the prompt's PROFILE LAW names the tool and the invention refusal",
  promptSrc.includes("20. THE PROFILE LAW") &&
    promptSrc.includes("get_hpc_profiles FIRST") &&
    promptSrc.includes("NEVER invent a partition"));
ok("C2 the law teaches the defaults-are-examples word",
  promptSrc.includes(".example.org") && promptSrc.includes("EXAMPLES") &&
    promptSrc.includes("never present them as a reachable cluster"));
ok("C3 the law draws the cousin lines (the connections' roster; the CONNECTION's own Slurm settings)",
  promptSrc.includes("list_clusters") &&
    promptSrc.includes("CONNECTION's own Slurm settings"));
ok("C4 the presenter is pure — no clock, no db, no fs, no react",
  !/\bDate\.now\(\)/.test(presentCode) &&
    !presentSrc.includes("@/lib/db") && !presentSrc.includes("from \"react\"") &&
    !presentSrc.includes("existsSync") && !presentSrc.includes("readFileSync") &&
    !presentSrc.includes("useEffect"));
ok("C5 the no-age law at the door — the jobs' age fathers stay out",
  !presentSrc.includes("worldAgeWords") && !presentSrc.includes("durationMsOf") &&
    !presentSrc.includes("clockWordsOf"));
ok("C6 the presenter never imports the engine-carrying lib (the rows come fed)",
  !presentSrc.includes("@/lib/hpc/slurm"));
ok("C7 the display dialect is the editor's own word cup",
  presentSrc.includes("Time limit (min)") && presentSrc.includes("Array throttle") &&
    presentSrc.includes("Sim speed") && presentSrc.includes("ctffind binary"));

/* ---------- receipt ---------- */
console.log(`\nHPC-PROFILE-TOOL-UNIT t1151: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
