/** t530 — the box's vitals learn to speak, and the speech is tested.
 *
 *  The campaign's canonical numbers (watchdog recycle 2600 RSS, guard
 *  GO available 2600, guard warm cache 1450) lived in ops scripts;
 *  t530 promotes them into product constants and gives the host a
 *  product face: /api/diagnostics + the System diagnostics dialog + the
 *  AI's get_system_diagnostics tool. The laws this bench pins:
 *
 *    LAW 1 — composers are pure: verdicts are functions of injected
 *            numbers, never of the host they happen to run on. The
 *            canonical lines are the CAMPAIGN's numbers — a drift in
 *            either direction (1450→1500's second life, 2600→anything)
 *            must fail here before it fails a build.
 *    LAW 2 — honest nulls: a lane that cannot be read is SAID (the
 *            presenter speaks "unreadable"), never guessed; a payload
 *            that fails entirely is ok:false with a pointing summary.
 *    LAW 3 — one well, three mouths: the API route, the dialog and the
 *            AI tool all drink readDiagnostics / the same constants —
 *            the roster assertions pin the wiring, the presenter
 *            assertions pin the summary's locator lines.
 *    LAW 4 — evidence from bytes: provenance from the stamp file, disk
 *            from statfs, memory from /proc — no process sniffing.
 *
 *  Fixtures live in os.tmpdir() (t503: bench bytes never land in the
 *  tree). The live-host section is a SMOKE lane (self-consistency, not
 *  exact numbers — the box's memory moves under the bench's feet).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// the in-process door key (t523 pattern): teach node the product's two import
// dialects (@/ alias + extensionless relatives) before the lib import.
try {
  const { register } = await import("node:module");
  if (typeof register === "function") {
    register(pathToFileURL(new URL("./ts-alias-hook.mjs", import.meta.url).pathname));
  }
} catch {
  // bun (or another runtime with native path-alias eyes) — no key needed
}

const {
  composeDiskVitals,
  composeMemoryLanes,
  parseMeminfo,
  readBuildProvenance,
  MEMORY_LINES,
} = await import("@/lib/diagnostics");

let passed = 0;
const must = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  }
  passed++;
  console.log(`PASS ${msg}`);
};

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

/* ------------------------------------------------------------------ */
/* Section 1 — parseMeminfo: bytes to MB, free(1) semantics            */
/* ------------------------------------------------------------------ */
{
  const text = [
    "MemTotal:       4137000 kB",
    "MemFree:          395000 kB",
    "MemAvailable:    2579000 kB",
    "Buffers:          148000 kB",
    "Cached:          2100000 kB",
    "SwapTotal:             0 kB",
    "SwapFree:              0 kB",
    "SReclaimable:      77000 kB",
    "Shmem:             12000 kB",
  ].join("\n");
  const m = parseMeminfo(text);
  must(m.memTotalMb === 4040, `parse — MemTotal 4137000kB → 4040MB (got ${m.memTotalMb})`);
  must(m.memAvailableMb === 2519, `parse — MemAvailable → 2519MB (got ${m.memAvailableMb})`);
  // buff/cache = Buffers + Cached + SReclaimable (free(1) semantics) = 2325000kB → 2271MB
  must(
    m.buffCacheMb === 2271,
    `parse — buff/cache = Buffers+Cached+SReclaimable → 2271MB (got ${m.buffCacheMb})`
  );
  must(m.swapTotalMb === 0, "parse — SwapTotal 0 → no swap");
}

/* ------------------------------------------------------------------ */
/* Section 2 — the canonical lines: campaign numbers, product-locked   */
/* ------------------------------------------------------------------ */
{
  must(MEMORY_LINES.guardAvailable === 2600, "lines — guard GO available stays 2600 (t525)");
  must(MEMORY_LINES.guardBuffCache === 1450, "lines — guard warm cache stays 1450 (t525's self-correction)");
  must(MEMORY_LINES.recycle === 2600, "lines — dev watchdog recycle line stays 2600 (t524)");
}

{
  // healthy: both lanes green
  const h = composeMemoryLanes({ memTotalMb: 4040, memAvailableMb: 3000, buffCacheMb: 2300, swapTotalMb: 0 });
  must(h.availableLane === "go" && h.cacheLane === "warm", "verdict — 3000 avail / 2300 cache: go + warm");
  must(h.verdict === "healthy", "verdict — both green → healthy");
  must(/build guard/.test(h.verdictReason), "verdict — healthy reason names the build guard");
}

{
  // watch by available: below GO line, above collapse
  const w = composeMemoryLanes({ memTotalMb: 4040, memAvailableMb: 2599, buffCacheMb: 2300, swapTotalMb: 0 });
  must(w.availableLane === "nogo", "verdict — 2599 < 2600: the guard would refuse (nogo)");
  must(w.verdict === "watch", "verdict — 2599 avail / 2300 cache → watch, not danger");
  must(/refused|needs/.test(w.verdictReason), "verdict — watch reason quotes the guard's lines");
}

{
  // danger: below the collapse neighborhood
  const d = composeMemoryLanes({ memTotalMb: 4040, memAvailableMb: 1449, buffCacheMb: 1400, swapTotalMb: 0 });
  must(d.verdict === "danger", "verdict — 1449 avail → danger (collapse neighborhood)");
  must(d.cacheLane === "collapsed", "verdict — 1400 cache < 1450 → collapsed (t461 profile)");
  must(/t461|picking victims/.test(d.verdictReason), "verdict — danger reason carries the collapse story");
}

{
  // watch by cache: plenty available but page cache collapsed
  const wc = composeMemoryLanes({ memTotalMb: 4040, memAvailableMb: 3100, buffCacheMb: 1449, swapTotalMb: 0 });
  must(wc.cacheLane === "collapsed", "verdict — 1449 cache with 3100 avail → collapsed");
  must(wc.verdict === "watch", "verdict — cache collapse alone → watch (build refused, box alive)");
}

/* ------------------------------------------------------------------ */
/* Section 3 — composeDiskVitals: pure math over a statfs triple       */
/* ------------------------------------------------------------------ */
{
  const bsize = 4096;
  const blocks = Math.round((9.9 * 1024 * 1024) / 4); // ~9.9GB in 4k blocks
  const bavail = Math.round(blocks * 0.21);
  const v = composeDiskVitals({ bsize, blocks, bavail });
  must(v.totalMb === 10138, `disk — total rounds to MB (got ${v.totalMb})`);
  must(v.usedPct === 79, `disk — usedPct 79 (got ${v.usedPct})`);
  const zero = composeDiskVitals({ bsize: 4096, blocks: 0, bavail: 0 });
  must(zero.usedPct === 0 && zero.totalMb === 0, "disk — a zero-block fs answers zeros, not NaN");
}

/* ------------------------------------------------------------------ */
/* Section 4 — readBuildProvenance: the stamp is the truth             */
/* ------------------------------------------------------------------ */
{
  const fx = mkdtempSync(path.join(tmpdir(), "t530-prov-"));
  try {
    const absent = readBuildProvenance(fx);
    must(absent.commit === null && absent.standalone === false, "provenance — a bare tree: no stamp, not standalone");
    mkdirSync(path.join(fx, ".next"), { recursive: true });
    writeFileSync(path.join(fx, ".next", ".built-at-commit"), "93bd005\n");
    const stamped = readBuildProvenance(fx);
    must(stamped.commit === "93bd005", `provenance — stamp read + trimmed (got ${stamped.commit})`);
    must(stamped.standalone === false, "provenance — no standalone/server.js → dev lane");
    writeFileSync(path.join(fx, ".next", ".built-at-commit"), "");
    must(readBuildProvenance(fx).commit === null, "provenance — an EMPTY stamp is no stamp (honest null)");
    writeFileSync(path.join(fx, ".next", ".built-at-commit"), "deadbeef");
    mkdirSync(path.join(fx, ".next", "standalone"), { recursive: true });
    writeFileSync(path.join(fx, ".next", "standalone", "server.js"), "main();");
    const full = readBuildProvenance(fx);
    must(full.commit === "deadbeef" && full.standalone === true, "provenance — stamp + server.js → standalone with sha");
    // t530 live-caught: the standalone server chdir's into .next/standalone,
    // so the RUNNING lane's cwd is two levels below the tree's stamp — the
    // reader walks up and still lands on the authoritative bytes.
    const inner = path.join(fx, ".next", "standalone");
    const fromInside = readBuildProvenance(inner);
    must(
      fromInside.commit === "deadbeef" && fromInside.standalone === true,
      "provenance — reading from the standalone cwd walks up to the tree's stamp"
    );
  } finally {
    rmSync(fx, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/* Section 5 — presentSystemDiagnostics: the locator summary           */
/* ------------------------------------------------------------------ */
{
  const { presentSystemDiagnostics } = await import("@/lib/diagnostics");

  must(!presentSystemDiagnostics(null).ok, "presenter — a failed read is ok:false");

  const lanes = composeMemoryLanes({ memTotalMb: 4040, memAvailableMb: 2519, buffCacheMb: 2325, swapTotalMb: 0 });
  const res = presentSystemDiagnostics({
    memory: lanes,
    disk: { totalMb: 10138, freeMb: 2048, usedPct: 79 },
    provenance: { commit: "93bd005", standalone: true },
    world: { projects: 3, jobs: 32, runningJobs: 1 },
    generatedAt: new Date().toISOString(),
  });
  must(res.ok, "presenter — a full payload is ok:true");
  const summary = res.summary ?? "";
  must(/2519MB/.test(summary) && /2325MB/.test(summary), "presenter — summary carries the raw lane numbers");
  must(/93bd005/.test(summary) && /standalone/.test(summary), "presenter — summary carries provenance");
  must(/3 projects/.test(summary) && /32 jobs/.test(summary) && /1 running/.test(summary), "presenter — summary carries the census");
  must(/disk 79%/.test(summary), "presenter — summary carries disk");
  const detail = res.detail as { memory?: unknown; world?: unknown };
  must(Boolean(detail?.memory) && Boolean(detail?.world), "presenter — annex carries the payload");

  // honest nulls: unreadable lanes are SAID, not guessed
  const partial = presentSystemDiagnostics({
    memory: null,
    disk: null,
    provenance: { commit: null, standalone: false },
    world: null,
    generatedAt: new Date().toISOString(),
  });
  must(partial.ok, "presenter — a null-lane payload still answers (the read worked, the lanes didn't)");
  must(/unreadable/.test(partial.summary ?? ""), "presenter — null lanes speak 'unreadable', never a guess");
  must(/no provenance stamp/.test(partial.summary ?? ""), "presenter — a stampless lane says so");
}

/* ------------------------------------------------------------------ */
/* Section 6 — live-host smoke: consistency, not exact numbers         */
/* ------------------------------------------------------------------ */
{
  const { readMemoryLanes, readDiskVitals, readDiagnostics } = await import("@/lib/diagnostics");
  const lanes = readMemoryLanes();
  must(lanes !== null, "live — this host reads memory lanes (Linux /proc)");
  if (lanes) {
    must(lanes.memAvailableMb <= lanes.memTotalMb, "live — available ≤ total (self-consistent)");
    must(["healthy", "watch", "danger"].includes(lanes.verdict), "live — verdict is one of the three honest words");
  }
  const disk = await readDiskVitals();
  must(disk !== null && disk.freeMb >= 0 && disk.usedPct >= 0, "live — statfs reads the project root");
  const payload = await readDiagnostics();
  must(typeof payload.generatedAt === "string" && payload.provenance !== undefined, "live — the one payload assembles");
}

/* ------------------------------------------------------------------ */
/* Section 7 — the wiring: one well, three mouths                      */
/* ------------------------------------------------------------------ */
{
  const tools = read("../src/lib/ai/tools.ts");
  must(tools.includes('name: "get_system_diagnostics"'), "wiring — the AI tool is on the schema roster");
  must(tools.includes('case "get_system_diagnostics":'), "wiring — the dispatcher knows the tool");
  must(tools.includes("export { presentSystemDiagnostics }"), "wiring — the AI surface re-exports the pure presenter");
  must(tools.includes('from "@/lib/diagnostics"'), "wiring — the tool drinks the one well module");

  const route = read("../src/app/api/diagnostics/route.ts");
  must(route.includes("isLocalRequest"), "wiring — the route speaks through the same-origin door (t259 law)");
  must(route.includes("Cross-site access"), "wiring — the door slams cross-site reads with the verdict");

  const header = read("../src/components/workflow/header.tsx");
  must(header.includes("SystemDiagnosticsDialog"), "wiring — the header mounts the dialog");
  must(header.includes('aria-label="System diagnostics"'), "wiring — the header carries the button");
  must(header.includes("SYSTEM_DIAGNOSTICS_EVENT"), "wiring — the palette's door rings the header's bell");

  const dialog = read("../src/components/workflow/system-diagnostics-dialog.tsx");
  must(dialog.includes("EngineBuildRail"), "wiring — the dialog reuses the rail (the grinder's mouth, not a copy)");
  must(dialog.includes("HonestEmpty"), "wiring — unreadable lanes get the honest-empty state");
  must(dialog.includes("2600") && dialog.includes("1450"), "wiring — the canonical lines are drawn on the bars");
}

console.log(`\n${passed} checks passed — the box's vitals speak and the speech holds.`);
