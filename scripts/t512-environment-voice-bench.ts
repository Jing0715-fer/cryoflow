/**
 * t512-environment-voice-bench.ts — The Engine Learns to Introduce Itself.
 *
 * The RELION environment was the last big faceless host surface: the
 * engine popover answers "is RELION installed, which version, why not",
 * but the agent — asked exactly that — had no face to answer with.
 * t512 gives the environment its voice by the t511 doctrine, minus the
 * lift: the well (detectRelion) ALREADY lives in lib, the route is
 * already a protocol shell, so the only new piece is the agent face
 * that drinks the same cup the header poll serves.
 *
 *   T1  the face      — roster 28, zero knobs, the polite-read law
 *   T2  found          — locator summary, freshness rides detail first,
 *                       annex = the probe's own status (by reference)
 *   T3  not found      — absence said out loud, hint + wsl.note verbatim
 *   T4  crash          — a probe that threw has no status to quote
 *   T5  neighbors      — the route's gates, the popover's drink, t511's
 *                       grave: untouched bytes keep their promises
 */

import { readFileSync } from "fs";
import path from "path";
import { AI_TOOLS, presentEnvironmentReport } from "../src/lib/ai/tools";
import type { RelionStatus } from "../src/lib/relion/system";

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

const tools = read("src/lib/ai/tools.ts");
const route = read("src/app/api/system/route.ts");
const header = read("src/components/workflow/header.tsx");

/* The tool's own entry — schema block from its name to the next entry. */
const toolIdx = tools.indexOf('name: "get_environment_report"');
const schemaSlice = tools.slice(toolIdx, tools.indexOf("get_continue_sources", toolIdx));
/* The presenter body — from the export to the executor's docstring (the
 * t507 lesson: slice the BODY, keep the next marker in view). */
const presenterBody = tools.slice(
  tools.indexOf("export function presentEnvironmentReport"),
  tools.indexOf("/** t512 — the executor")
);
/* The executor body — from its signature to the NEXT section marker
 * (t513 planted the continue-sources section between this executor and
 * the storage marker — a slice that spans a marker swallows the
 * neighbor, the t507 slice lesson's fifth evolution). */
const executorBody = tools.slice(
  tools.indexOf("async function getEnvironmentReport"),
  tools.indexOf("/* ---- get_continue_sources")
);

/* ------------------------------------------------------------------ */
/* Fixtures — the probe's own shape, structurally typed. No wsl.exe     */
/* is spawned anywhere in this bench (the presenter is pure on purpose).*/
/* ------------------------------------------------------------------ */

const BINARIES = [
  { name: "relion_refine", present: true },
  { name: "relion_class2d", present: true },
  { name: "relion_class3d", present: true },
  { name: "relion_autopick", present: true },
  { name: "relion_extract", present: true },
  { name: "relion_reconstruct", present: true },
  { name: "relion_postprocess", present: true },
  { name: "relion_mask_create", present: true },
  { name: "relion_motion_corr", present: true },
  { name: "relion_ctf_find", present: true },
  { name: "relion_ctf_refine", present: true },
  { name: "relion_polish", present: true },
  { name: "relion_convert", present: false },
  { name: "relion_prepare", present: false },
];
const EXTERNALS = [
  { name: "ctffind", present: true },
  { name: "motioncor2", present: false },
  { name: "gctf", present: false },
];

const foundFixture: RelionStatus = {
  found: true,
  execution: "native",
  version: "5.0.0",
  path: "/home/z/relion-install/bin",
  source: "RELION_HOME",
  wsl: {
    available: false,
    unavailableReason: "no-wsl",
    relionPath: null,
    relionHome: null,
    version: null,
    source: null,
    distro: null,
    note: "WSL is not installed on this host — native installs only.",
  },
  binaries: BINARIES,
  externals: EXTERNALS,
  checkedAt: "2026-09-30T07:00:00.000Z",
  installs: [
    {
      id: "n:/home/z/relion-install/bin",
      version: "5.0.0",
      path: "/home/z/relion-install/bin",
      relionHome: "/home/z/relion-install",
      source: "RELION_HOME",
      execution: "native",
      distro: null,
      mpirunPath: null,
      mpiBinary: false,
      ctffindPath: "/home/z/relion-build/deps/ctffind/bin/ctffind",
    },
    {
      id: "n:/usr/local/bin",
      version: "4.0.1",
      path: "/usr/local/bin",
      relionHome: "/usr/local",
      source: "PATH",
      execution: "native",
      distro: null,
      mpirunPath: "/usr/bin/mpirun",
      mpiBinary: true,
      ctffindPath: null,
    },
  ],
  selectedId: "n:/home/z/relion-install/bin",
  autoPicked: false,
  fromCache: true,
  hint: null,
};

const notFoundFixture: RelionStatus = {
  found: false,
  execution: null,
  version: null,
  path: null,
  source: null,
  wsl: {
    available: false,
    unavailableReason: "no-wsl",
    relionPath: null,
    relionHome: null,
    version: null,
    source: null,
    distro: null,
    note: "WSL is not installed — searched the native host only.",
  },
  binaries: BINARIES.map((b) => ({ ...b, present: false })),
  externals: EXTERNALS.map((e) => ({ ...e, present: false })),
  checkedAt: "2026-09-30T07:05:00.000Z",
  installs: [],
  selectedId: null,
  autoPicked: false,
  hint:
    "RELION_HOME is not set; `which relion_refine` answered nothing; /home/z/relion-install/bin does not exist; the home scan found 0 candidates.",
};

/* ------------------------------------------------------------------ */

section("T1  the face — roster, knobs, laws");
{
  const env = AI_TOOLS.find((t) => t.name === "get_environment_report");
  ok(Boolean(env), "T1a: get_environment_report is on the roster");
  ok(
    AI_TOOLS.length === 29 && new Set(AI_TOOLS.map((t) => t.name)).size === 29,
    `T1b: 29 unique tools — t513's continue-sources read is the newest birth (got ${AI_TOOLS.length})`
  );
  ok(
    Object.keys(env?.parameters?.properties ?? {}).length === 0 &&
      env?.parameters?.additionalProperties === false,
    "T1c: zero knobs — the probe is the probe, not a filtered one"
  );
  ok(
    (env?.description ?? "").includes("THE tool for") &&
      (env?.description ?? "").includes("engine popover"),
    "T1d: description carries THE tool law and names its paper face"
  );
  ok(
    (env?.description ?? "").includes("Re-detect") &&
      (env?.description ?? "").includes("never fires a forced re-probe"),
    "T1e: the polite-read law is IN the description — the door belongs to the button"
  );
  ok(
    schemaSlice.includes('name: "get_environment_report"') &&
      schemaSlice.includes("additionalProperties: false"),
    "T1f: schema block slices clean around the new entry"
  );
  ok(
    tools.includes('import { detectRelion, type RelionStatus } from "@/lib/relion/system";'),
    "T1g: the well is imported by name — the lib's own detectRelion"
  );
  ok(
    executorBody.includes("await detectRelion()") && !executorBody.includes("detectRelion(true)"),
    "T1h: the executor drinks the poll's cup — no force, no subprocess storm"
  );
  ok(
    tools.includes('case "get_environment_report":') &&
      tools.includes("return await getEnvironmentReport(ctx);"),
    "T1i: dispatch case wired to the executor"
  );
}

section("T2  found — locator summary, freshness first, annex by reference");
{
  const r = presentEnvironmentReport(foundFixture);
  ok(r.ok === true, "T2a: found → ok (a positive probe answers)");
  ok(
    r.summary.includes("RELION 5.0.0 is ready") && r.summary.includes("natively"),
    "T2b: summary locates version and execution mode"
  );
  ok(
    r.summary.includes("/home/z/relion-install/bin") && r.summary.includes("found via RELION_HOME"),
    "T2c: summary locates path and discovery source"
  );
  ok(
    r.summary.includes("Binaries 12/14 present") && r.summary.includes("external tools 1/3"),
    "T2d: presence counts are filters of the status, spoken as fractions"
  );
  ok(
    r.summary.includes("2 installs known, one selected"),
    "T2e: the roster count rides the summary (multi-install world)"
  );
  ok(
    r.summary.includes("saved snapshot") && r.summary.includes("2026-09-30T07:00:00.000Z"),
    "T2f: freshness is spoken — a cached answer admits its age"
  );
  const detail = r.detail as Record<string, unknown>;
  ok(
    Object.keys(detail)[0] === "servedFrom" && Object.keys(detail)[1] === "checkedAt",
    "T2g: freshness rides detail FIRST — t511's cap law, freshness edition"
  );
  ok(
    detail.servedFrom === "saved-snapshot",
    "T2h: servedFrom says saved-snapshot when fromCache is set"
  );
  ok(
    detail.environment === foundFixture,
    "T2i: annex IS the probe status by reference — zero clone, zero re-derivation"
  );
  const auto = presentEnvironmentReport({ ...foundFixture, autoPicked: true });
  ok(auto.summary.includes("selection auto-picked"), "T2j: auto-picked selection is said, not hidden");
  const fresh = presentEnvironmentReport({ ...foundFixture, fromCache: false });
  ok(
    fresh.summary.includes("a fresh probe") &&
      (fresh.detail as Record<string, unknown>).servedFrom === "fresh-probe",
    "T2k: the fresh branch speaks fresh, both faces agree"
  );
  const unreadable = presentEnvironmentReport({ ...foundFixture, version: null });
  ok(
    unreadable.summary.includes("(version unreadable)") && !unreadable.summary.includes("undefined"),
    "T2l: an unparseable version is named, never 'undefined'"
  );
  const single = presentEnvironmentReport({ ...foundFixture, installs: [foundFixture.installs[0]] });
  ok(
    !single.summary.includes("installs known"),
    "T2m: a one-install world does not pad the summary with roster noise"
  );
  ok(
    !presenterBody.includes(".sort("),
    "T2n: locator law — the presenter never re-orders the probe's rows"
  );
}

section("T3  not found — absence out loud, guidance verbatim");
{
  const r = presentEnvironmentReport(notFoundFixture);
  ok(r.ok === true, "T3a: a negative answer is still a successful probe (ok stays true)");
  ok(r.summary.includes("RELION is not found"), "T3b: the absence is said in plain words");
  ok(
    r.summary.includes("no-wsl"),
    "T3c: the WSL unavailability reason rides the summary"
  );
  ok(
    r.summary.includes("Re-detect"),
    "T3d: the summary points at the fresh-scan door, it never pretends to scan"
  );
  const detail = r.detail as Record<string, unknown>;
  ok(
    detail.hint === notFoundFixture.hint,
    "T3e: the hint rides the annex VERBATIM — the search's own words"
  );
  ok(
    detail.found === false && Object.keys(detail)[0] === "found",
    "T3f: the verdict rides detail FIRST — the first line teaches the answer"
  );
  ok(
    (detail.wsl as { note: string }).note === notFoundFixture.wsl.note,
    "T3g: the WSL note rides verbatim too"
  );
  ok(
    !r.summary.includes("5.0"),
    "T3h: no invented version — nothing found means no version spoken"
  );
}

section("T4  crash — a probe that threw has nothing to quote");
{
  const r = presentEnvironmentReport(null);
  ok(r.ok === false, "T4a: null status → ok:false (no invented answer)");
  ok(
    r.summary.includes("probe itself failed") && r.summary.includes("Re-detect"),
    "T4b: the crash sentence names the failure and the manual door"
  );
}

section("T5  neighbors — the route, the popover, the graves");
{
  ok(
    route.includes("Cross-site access to system status is not allowed") &&
      route.includes('searchParams.get("force") === "1"'),
    "T5a: /api/system's 403 gate and force door untouched"
  );
  ok(
    header.includes("EngineHintBlock"),
    "T5b: the popover still renders the probe's own hint block"
  );
  ok(
    tools.includes("const STORAGE_TOOL_JOB_CAP = 20;"),
    "T5c: t511's storage cap stands unchanged next door"
  );
  ok(
    tools.includes("Read-only LOCATOR: it names the whales"),
    "T5d: t511's storage description keeps its law — no neighbor drifted"
  );
  ok(
    !executorBody.includes("ctx.") ,
    "T5e: the executor never touches project context — the environment is the host's, not a project's"
  );
}

/* ------------------------------------------------------------------ */

console.log(`\n=== t512 environment-voice bench: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
