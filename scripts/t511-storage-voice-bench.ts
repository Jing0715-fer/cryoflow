/**
 * t511-storage-voice-bench.ts — The Disk Learns to Speak.
 *
 * The storage overview (t436) was the last big faceless data surface:
 * the Storage dialog names the whales, but the agent — asked "what is
 * eating my disk" — had no face to answer with. t511 gives the disk its
 * voice, by the t500 doctrine: the route's assembly lifts VERBATIM into
 * ONE well (lib/relion/storage-report), the route slims to a protocol
 * shell, and a new tool drinks the same cup the dialog drinks.
 *
 *   T1  the well     — computeStorageReport: the walk, the DB join,
 *                      the orphan honesty and the caps, lifted whole
 *   T2  the face     — get_storage_report: roster 27, zero knobs,
 *                      locator summary, capped annex, honest absences
 *   T3  the laws     — raw digits in the well, the shared formatter as
 *                      the summary's voice, rows ride through unmapped
 *   T4  neighbors    — the dialog's twin, the walk caps, the graves
 *                      note: untouched bytes keep their promises
 */

import { readFileSync } from "fs";
import path from "path";
import { AI_TOOLS } from "../src/lib/ai/tools";

const REPO = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(REPO, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${msg}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${msg}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);

const lib = read("src/lib/relion/storage-report.ts");
const route = read("src/app/api/projects/[id]/storage/route.ts");
const tools = read("src/lib/ai/tools.ts");
const dialog = read("src/components/workflow/storage-dialog.tsx");
const diskWalk = read("src/lib/relion/disk-walk.ts");
const diskUsage = read("src/lib/relion/disk-usage.ts");

/* The well's function body — from the signature on (docstrings above it
 * are commentary, not law; the t507 lesson: slice the BODY, keep the
 * closing brace in view). */
const libBody = lib.slice(lib.indexOf("export async function computeStorageReport"));
/* The tool's cap + executor — from the cap's declaration to the next
 * function (the t509 lesson: a slice that swallows a neighbor's text
 * swallows its words too). */
const toolSlice = tools.slice(
  tools.indexOf("const STORAGE_TOOL_JOB_CAP"),
  tools.indexOf("async function getSessionTimeline")
);

/* ------------------------------------------------------------------ */

section("T1  the well — the route's assembly lifted verbatim");

ok(
  libBody.includes("export async function computeStorageReport"),
  "the lib exports computeStorageReport (ONE well, born in lib/relion/storage-report.ts)"
);
ok(
  lib.includes("export interface StorageResponse") &&
    lib.includes("export interface StorageJobRow") &&
    lib.includes("export interface StorageTopFileRow"),
  "the ledger's types moved with the assembly — the lib owns the shape, not the route"
);
ok(
  route.includes('from "@/lib/relion/storage-report"') &&
    route.includes("computeStorageReport(id)"),
  "the route drinks the well (imports it, calls it with the path id)"
);
ok(
  !route.includes("TopFilesCollector") &&
    !route.includes("pushRow") &&
    !route.includes("walkDirUsage"),
  "the route sheds the assembly — a protocol shell, no walk left behind"
);
ok(
  route.includes("Cross-site access to storage data is not allowed") &&
    route.includes("Project not found") &&
    route.includes("Failed to compute storage") &&
    route.includes("force-dynamic"),
  "the route keeps its gates — the 403/404/500 wordings and force-dynamic survive the slim-down"
);
ok(
  libBody.includes("walkDirUsage(") &&
    libBody.includes("WALK_MAX_ENTRIES") &&
    libBody.includes('type: meta?.type ?? "orphan"') &&
    libBody.includes("must not steal another run's row here"),
  "the walk dialect rides along verbatim — entry cap, symlink honesty, orphans visible, mirrors never double-count"
);
ok(
  libBody.includes("generatedAt: new Date().toISOString()"),
  "the ledger carries its freshness stamp — a walk without a when is a rumor"
);

section("T2  the face — get_storage_report, roster 27");

const entry = AI_TOOLS.find((t) => t.name === "get_storage_report");
ok(
  AI_TOOLS.length === 33 && new Set(AI_TOOLS.map((t) => t.name)).size === 33,
  `the roster holds 33 tools, all names unique — t522's history read is the newest birth (got ${AI_TOOLS.length})`
);
ok(
  !!entry &&
    JSON.stringify(entry.parameters) ===
      JSON.stringify({ type: "object", properties: {}, additionalProperties: false }),
  "zero knobs — the walk is the dialog's walk, not a filtered one"
);
ok(
  !!entry &&
    entry.description.includes("Read-only LOCATOR") &&
    entry.description.includes("Physical truth, not DB belief") &&
    entry.description.includes("THE tool for"),
  "the description speaks its three laws — locator, physical truth, the-dish-it-cooks"
);
ok(
  toolSlice.includes("computeStorageReport(ctx.projectId)"),
  "the executor drinks the SAME well the route pours — one assembly, two faces"
);
ok(
  toolSlice.includes("report.jobs[0]") && !toolSlice.includes(".sort("),
  "the heaviest is a LOOKUP in the pre-sorted rows — a locator, never a re-sorter"
);
ok(
  toolSlice.includes("STORAGE_TOOL_JOB_CAP = 20") &&
    toolSlice.includes("slice(0, STORAGE_TOOL_JOB_CAP)"),
  "the annex cap is a named constant, and the slice drinks it"
);
ok(
  toolSlice.includes("has never run a job") &&
    toolSlice.includes("No storage ledger could be walked"),
  "honest absences — never-ran and unwalkable each get their own sentence"
);
ok(
  toolSlice.includes("jobsShown") && toolSlice.includes("jobsTotal"),
  "a capped annex says so — jobsShown/jobsTotal ride beside the rows"
);
ok(
  (() => {
    // the cap marker must ride FIRST in every detail object — the tool
    // card's window is a 4,000-character pane (t510), a cap marker
    // buried at the tail is a cap nobody ever sees
    const heads: number[] = [];
    let i = toolSlice.indexOf("detail: {");
    while (i !== -1) {
      heads.push(i);
      i = toolSlice.indexOf("detail: {", i + 1);
    }
    return (
      heads.length === 2 &&
      heads.every((d) => {
        const seg = toolSlice.slice(d, d + 140);
        return seg.includes("jobsShown") && (seg.indexOf("jobsShown") < seg.indexOf("storage:"));
      })
    );
  })(),
  "the cap marker rides FIRST in the detail — the window's opening line teaches the cut"
);
ok(
  toolSlice.includes("fmtBytes(") && !toolSlice.includes("toFixed"),
  "the summary's human voice is the SHARED formatter — no local byte twin is born"
);

section("T3  the laws — raw digits, shared voice, untouched rows");

ok(
  !libBody.includes("toLocaleString") && !libBody.includes("fmtBytes"),
  "the well carries RAW digits — formatting is the readers' business, never the well's"
);
ok(
  libBody.includes("b.bytes - a.bytes || a.dirName.localeCompare(b.dirName)"),
  "the sort law survives verbatim — bytes descending, name as the tiebreak"
);
ok(
  !toolSlice.includes(".map("),
  "the annex rows ride through UNMAPPED — a re-shaped row is a re-derived row"
);
ok(
  route.includes("no-store"),
  "the route still refuses to cache a walk — bytes change under the cache's feet"
);
ok(
  libBody.includes("Promise<StorageResponse | null>") && libBody.includes("return null"),
  "a gone project is an honest null — the well never invents a ledger"
);

section("T4  neighbors — untouched bytes keep their promises");

ok(
  dialog.includes("interface StorageResponse") &&
    dialog.includes("/api/projects/${projectId}/storage"),
  "the dialog keeps its local twin and its route straw — this window forks nobody"
);
ok(
  diskWalk.includes("WALK_MAX_ENTRIES = 20_000"),
  "the walk's entry cap still lives in disk-walk — the well imports it, never re-declares it"
);
ok(
  diskUsage.includes("TOP_FILES_PER_CATEGORY = 8") &&
    diskUsage.includes("export function fmtBytes"),
  "disk-usage keeps the collector and the ONE formatter — the app's only byte voice"
);
ok(
  diskUsage.includes("One formatter"),
  "the one-formatter law is still written where it is enforced"
);
ok(
  tools.includes("Recently-deleted section"),
  "the graves note still points home — the reclaimed bytes live in the dialog, not the tool"
);

/* ------------------------------------------------------------------ */

console.log(`\nt511 — the disk learns to speak: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
