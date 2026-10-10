/**
 * t397 — the performance round's UNIT benches (bun host, real bash where a
 * shell is the contract):
 *
 *   A  iterationsVersion — every rendered field discriminates; equal
 *      content hashes equal; derived fields (latest/classesSlices) do not.
 *   B  livePayloadFromParts — the shared live-payload builder keeps the
 *      t350/t354/t370 semantics (iterations, occupancy fractions,
 *      pickStack's unmasked preference, chips with nz badges).
 *   C  liveSectionsScript — the sweep's live sections speak the SAME
 *      dialect as remoteLiveIterations' own round (source parity), and the
 *      script RUNS under real bash against a fixture dir: its sections
 *      parse into the same payload the route's own round would build.
 *   D  mrcRoundStatComplete — the settle fast path: complete geometry
 *      streams, torn/zero/undefined headers never do.
 *   E  twinCensusScript + parseTwinCensus — one round stats every twin
 *      (byte shape; real-bash roundtrip with existing/missing/spaced
 *      paths + the riding clock; noise lines skipped).
 *   F  source-level: the sweep wiring (prewarm call, sections append,
 *      settle gate), the dispatch diet (single-round submit, census
 *      adoption, env/walltime TTLs), the route's since/watch, the
 *      gallery's token + 5s cadence.
 *
 * Usage: bun scripts/t397-perf-units.ts
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  iterationsVersion,
  livePayloadFromParts,
  liveSectionsScript,
  type IterationsPayload,
} from "../src/lib/remote/iteration-live";
import {
  mrcRoundStatComplete,
  twinCensusScript,
  parseTwinCensus,
} from "../src/lib/remote/remote-run";

let pass = 0, fail = 0;
const fails: string[] = [];
const must = (c: unknown, label: string, extra = ""): boolean => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(`${label}${extra ? ` — ${extra}` : ""}`); console.log(`FAIL  ${label}${extra ? ` — ${String(extra).slice(0, 300)}` : ""}`); }
  return !!c;
};
const section = (t: string) => console.log(`\n== ${t} ==`);

/* ---------------- A: iterationsVersion ---------------- */
section("A: iterationsVersion — the results-lane token");
{
  const base: IterationsPayload = {
    remote: true,
    iterations: [1, 2, 3],
    latest: 3,
    classes: [{ cls: 1, count: 10, fraction: 0.5 }, { cls: 2, count: 10, fraction: 0.5 }],
    total: 20,
    classesFile: "run_it003_classes.mrcs",
    classesSlices: 2,
    stacks: [{ iter: 3, file: "run_it003_classes.mrcs", nz: 2 }],
  };
  const v0 = iterationsVersion(base);
  must(v0.length > 0, `A1 a token exists ("${v0}")`);
  const same = iterationsVersion(JSON.parse(JSON.stringify(base)) as IterationsPayload);
  must(v0 === same, "A2 equal content hashes equal");
  const flips: Array<[string, IterationsPayload]> = [
    ["iterations", { ...base, iterations: [1, 2, 3, 4], latest: 4 }],
    ["class occupancy", { ...base, classes: [{ cls: 1, count: 12, fraction: 0.6 }, { cls: 2, count: 8, fraction: 0.4 }] }],
    ["total", { ...base, total: 21 }],
    ["classesFile", { ...base, classesFile: "run_unmasked_classes.mrcs" }],
    ["stacks", { ...base, stacks: [{ iter: 3, file: "run_it003_classes.mrcs", nz: 2, zeroData: true }] }],
    ["stacks nz", { ...base, stacks: [{ iter: 3, file: "run_it003_classes.mrcs", nz: 0 }] }],
    ["zeroData", { ...base, zeroData: true }],
    ["renderError", { ...base, renderError: "the wire refused" }],
    ["error", { ...base, error: "SSH failed" }],
    ["remote", { ...base, remote: false }],
  ];
  for (const [what, p] of flips) {
    must(iterationsVersion(p) !== v0, `A3 a change in ${what} flips the token`);
  }
  // derived fields are EXCLUDED: latest is a function of iterations,
  // classesSlices of classes — equal material must hash equal
  const derived: IterationsPayload = { ...base, classesSlices: 99 };
  must(iterationsVersion(derived) === v0, "A4 classesSlices (derived) does not flip the token");
}

/* ---------------- B: livePayloadFromParts ---------------- */
section("B: livePayloadFromParts — the shared builder keeps the gallery semantics");
{
  const occ = ["TOTAL 40", "CLS 2 15", "CLS 1 25"].join("\n");
  const p = livePayloadFromParts({
    jobId: "t397-units",
    dataStarNames: ["run_it002_data.star", "run_it001_data.star", "noise.txt", "run_it010_data.star"],
    stackNames: [
      "run_it001_classes.mrcs",
      "run_it002_classes.mrcs",
      "run_it002_unmasked_classes.mrcs",
      "run_unmasked_classes.mrcs",
    ],
    nzByName: new Map([["run_it002_classes.mrcs", 7], ["run_it002_unmasked_classes.mrcs", 0]]),
    occText: occ,
  });
  must(JSON.stringify(p.iterations) === JSON.stringify([1, 2, 10]), "B1 iterations parsed + sorted, noise dropped");
  must(p.latest === 10, "B2 latest = the highest");
  must(p.total === 40, "B3 the TOTAL row lands");
  must(
    p.classes.length === 2 && p.classes[0].cls === 1 && p.classes[0].count === 25 && Math.abs(p.classes[0].fraction - 25 / 40) < 1e-9,
    "B4 classes sorted by number with fractions"
  );
  must(p.classesFile === "run_unmasked_classes.mrcs", "B5 pickStack prefers the final unmasked stack");
  must(p.classesSlices === 2, "B6 classesSlices derives from the highest class number");
  must(
    p.stacks.length === 2 && p.stacks[0].iter === 1 && p.stacks[1].iter === 2 && p.stacks[1].file === "run_it002_unmasked_classes.mrcs",
    "B7 the chips bar is per-iteration, unmasked wins a tie"
  );
  must(p.stacks[1].nz === 0, "B8 the sniffed nz badge rides the chip (0 = the zero-header shape)");
  must(p.stacks[0].nz === undefined, "B9 an unmeasured round carries no nz (renders exactly as before)");
  must(p.remote === true, "B10 the live payload is remote:true");
  must(typeof iterationsVersion(p) === "string" && iterationsVersion(p).length > 0, "B11 the builder output is token-able");
}

/* ---------------- C: liveSectionsScript ---------------- */
section("C: liveSectionsScript — the sweep's live sections (dialect parity + real bash)");
{
  const W = "/tmp/t397-does-not-exist";
  const script = liveSectionsScript(`'${W}'`);
  must(script.includes('echo "---CF:STARS---"'), "C1 the STARS marker");
  must(script.includes('echo "---CF:STACKS---"'), "C2 the STACKS marker (colon dialect — never the route's ---CF-STACKS---)");
  must(script.includes('echo "---CF:OCC---"'), "C3 the OCC marker");
  must(script.includes("data\\.star$"), "C4 the data-star grep");
  must(script.includes("classes\\.mrcs?$"), "C5 the class-stack grep");
  must(script.includes("awk '"), "C6 the occupancy awk rides the same block");
  // dialect parity with remoteLiveIterations' own round
  const il = readFileSync(path.join(__dirname, "../src/lib/remote/iteration-live.ts"), "utf8");
  const own = il.split("const script = [").slice(1)[0]?.split("].join").slice(0, 1)[0] ?? "";
  // the RUNTIME fragment (single backslashes) matches the script the
  // builder produced; the SOURCE FILE carries the same line with the
  // template-literal escapes doubled — compare each against its own world
  const dialectParity = (rt) => {
    const fileText = rt.split("\\").join("\\\\");
    return own.includes(fileText) && script.includes(rt);
  };
  must(
    dialectParity("grep -E '^(run_it|_it)[0-9]+_data\\.star$' || true"),
    "C7a the sweep and the route share the data-star grep dialect"
  );
  must(
    dialectParity("grep -E '^(run_it|_it)[0-9]+_(unmasked_)?classes\\.mrcs?$|^run_unmasked_classes\\.mrcs?$' || true"),
    "C7b the sweep and the route share the class-stack grep dialect"
  );
  // real bash: a fixture workdir with rounds + occupancy, run the EXACT
  // script bytes, split the sections, feed the shared builder
  const dir = mkdtempSync(path.join(tmpdir(), "t397-live-"));
  try {
    writeFileSync(path.join(dir, "run_it001_data.star"), "x\n");
    writeFileSync(path.join(dir, "run_it002_data.star"), "x\n");
    writeFileSync(path.join(dir, "run_it001_classes.mrcs"), "x");
    writeFileSync(path.join(dir, "run_it002_classes.mrcs"), "x");
    writeFileSync(path.join(dir, "run_unmasked_classes.mrcs"), "x");
    writeFileSync(path.join(dir, "noise.log"), "x");
    const ds = [
      "", "data_particles", "", "loop_", "_rlnClassNumber #1",
      "1@particles.mrcs", "2@particles.mrcs", "1@particles.mrcs", "",
    ].join("\n");
    writeFileSync(path.join(dir, "run_it002_data.star"), ds);
    const bashScript = `cd ${dir} && for f in $(ls -1v run_it???_classes.mrcs 2>/dev/null | tail -12) run_unmasked_classes.mrcs; do [ -f "$f" ] && { stat -c '%s %Y %n' "$f"; }; done\n` +
      liveSectionsScript(`'${dir}'`).replace(/\\\$/g, "$");
    const r = spawnSync("bash", ["-c", bashScript], { encoding: "utf8", timeout: 20_000 });
    must(r.status === 0, `C8 the combined script runs under real bash (${r.stderr.slice(0, 120)})`);
    const out = r.stdout ?? "";
    const starsM = out.indexOf("---CF:STARS---");
    const stacksM = out.indexOf("---CF:STACKS---");
    const occM = out.indexOf("---CF:OCC---");
    must(starsM >= 0 && stacksM > starsM && occM > stacksM, "C9 the three sections are present and ordered");
    const dataStars = out
      .slice(starsM + "---CF:STARS---".length, stacksM)
      .split("\n").map((l) => l.trim()).filter(Boolean);
    const stackNames = out
      .slice(stacksM + "---CF:STACKS---".length, occM)
      .split("\n").map((l) => l.trim()).filter(Boolean);
    const occText = out.slice(occM + "---CF:OCC---".length);
    must(JSON.stringify(dataStars) === JSON.stringify(["run_it001_data.star", "run_it002_data.star"]), `C10 the STARS listing (got ${JSON.stringify(dataStars)})`);
    must(stackNames.length === 3, `C11 the STACKS listing (got ${JSON.stringify(stackNames)})`);
    must(/TOTAL 3/.test(occText) && /CLS 1 2/.test(occText) && /CLS 2 1/.test(occText), `C12 the occupancy awk counted the newest star's rows (${occText.trim().replace(/\n/g, " · ")})`);
    const payload = livePayloadFromParts({
      jobId: "t397-units",
      dataStarNames: dataStars,
      stackNames,
      nzByName: new Map(),
      occText,
    });
    must(JSON.stringify(payload.iterations) === JSON.stringify([1, 2]) && payload.total === 3, "C13 the sections feed the shared builder end-to-end");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ---------------- D: mrcRoundStatComplete ---------------- */
section("D: mrcRoundStatComplete — the settle fast path");
{
  const NX = 64, NY = 64, NZ = 5;
  const full = 1024 + 4 * NX * NY * NZ;
  must(mrcRoundStatComplete({ size: full, nx: NX, ny: NY, nz: NZ }) === true, "D1 a complete stack is settled (no 20s wait)");
  must(mrcRoundStatComplete({ size: full, nx: NX, ny: NY, nz: NZ + 1 }) === false, "D2 the size does not carry the header's own geometry (mid-write)");
  must(mrcRoundStatComplete({ size: full, nx: 0, ny: NY, nz: NZ }) === false, "D3 a zero header word never passes (the disease shape waits the mtime gate)");
  must(mrcRoundStatComplete({ size: full }) === false, "D4 an unmeasured header never passes");
  must(mrcRoundStatComplete({ size: full, nx: -4, ny: NY, nz: NZ }) === false, "D5 garbage words never pass");
  must(mrcRoundStatComplete({ size: full + 8, nx: NX, ny: NY, nz: NZ }) === true, "D6 a slightly-larger size (nsymbt>0) passes the ≥ test");
}

/* ---------------- E: the twin census ---------------- */
section("E: twinCensusScript + parseTwinCensus — one round for every twin");
{
  const script = twinCensusScript(["/data/a.star", "/data/b star.star"], true);
  must(
    script.includes("for p in /data/a.star '/data/b star.star'; do"),
    "E1 every twin rides ONE for-loop (shQuote: safe paths bare, the spaced one quoted)"
  );
  must(script.includes('stat -c "%Y %n" "$p"'), "E2 the stat dialect (mtime seconds + name)");
  must(script.includes('|| echo "CF_MISSING $p"'), "E3 an absent twin speaks CF_MISSING (never a lie)");
  must(script.includes("---CF-CLOCK---") && script.includes("date +%s"), "E4 the cluster clock rides the same round");
  const noClock = twinCensusScript(["/x"], false);
  must(!noClock.includes("---CF-CLOCK---"), "E5 withClock=false drops the clock tail");

  const dir = mkdtempSync(path.join(tmpdir(), "t397-census-"));
  try {
    mkdirSync(path.join(dir, "spaced dir"));
    const p1 = path.join(dir, "a.star");
    const p2 = path.join(dir, "spaced dir", "b star.star");
    writeFileSync(p1, "x");
    writeFileSync(p2, "x");
    const bash = [
      // the login-shell noise the parse must survive (t311 discipline)
      "echo 'module: some chatter'",
      twinCensusScript([p1, p2, path.join(dir, "gone.star")], true),
    ].join("\n");
    const r = spawnSync("bash", ["-c", bash], { encoding: "utf8", timeout: 20_000 });
    must(r.status === 0, `E6 the census runs under real bash (${r.stderr.slice(0, 120)})`);
    const parsed = parseTwinCensus(r.stdout ?? "");
    must(parsed.mtimes.has(p1) && parsed.mtimes.has(p2), `E7 both twins stat (incl. the spaced path)`);
    must(!parsed.mtimes.has(path.join(dir, "gone.star")), "E8 the missing twin stays out of the map (the twin stands)");
    const st = statSync(p1);
    must(Math.abs((parsed.mtimes.get(p1) ?? 0) * 1000 - st.mtimeMs) < 2500, "E9 the parsed mtime is the file's own (seconds, ± the stat rounding)");
    must(parsed.clockSec != null && Math.abs(Date.now() / 1000 - (parsed.clockSec ?? 0)) < 30, `E10 the riding clock parsed (${parsed.clockSec})`);
    // noise immunity
    const noisy = parseTwinCensus("bash: line 1: junk: command not found\n---CF-CLOCK---\nnot-a-number\n");
    must(noisy.mtimes.size === 0 && noisy.clockSec === null, "E11 noise + a non-numeric clock tail parse to empties, never garbage");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ---------------- F: source-level wiring ---------------- */
section("F: source-level — the wiring this round installed");
{
  const rr = readFileSync(path.join(__dirname, "../src/lib/remote/remote-run.ts"), "utf8");
  must(rr.includes("scriptLines.push(liveSectionsScript(W))"), "F1 the sweep appends the live sections for running classifications");
  must(rr.includes("prewarmLiveIterations(e.job.id, pw)"), "F2 the sweep's ALIVE branch prewarms the gallery cache");
  must(rr.includes("ROUND_SETTLE_MIN_SEC <= nowSec || mrcRoundStatComplete(x)"), "F3 the settle gate: 20s OR header-complete");
  must(!rr.includes("x.mtime + 60 <= nowSec"), "F4 the old blanket 60s wait is gone");
  must(rr.includes("export function markLogWatch"), "F5 the watch mark is exported (the results lane shares the sweep floor)");
  must(rr.includes("twinCensusScript(twinCensus.map((t) => t.twin)"), "F6 the dispatch stats every twin in ONE round");
  must(!rr.includes("const twinSt = await remoteStat(conn, twin)"), "F7 the per-twin sequential remoteStat is gone");
  must(rr.includes("head -c ${scriptBuf.length} > ${shQuote(scriptPath)} && sbatch"), "F8 the sbatch lane submits in ONE round (write + submit)");
  must(!/remoteUpload\(conn, script, scriptPath\)/.test(rr), "F9 the sbatch script's three-round upload is retired");
  must(rr.includes("head -c ${wrapperBuf.length} > ${shQuote(wrapperPath)} && bash"), "F10 the direct lane spawns in ONE round");
  must(rr.includes("ENV_SNAPSHOT_TTL_MS") && rr.includes("envSnapshotCache"), "F11 the interactive-env snapshot is TTL-cached");
  must(rr.includes("WALLTIME_TTL_MS") && rr.includes("walltimeCache"), "F12 the partition walltime is TTL-cached");
  must(rr.includes("mkdir -p ${shQuote(remoteWorkdir)}${"), "F13 mkdir and the scancel reaper share one round");

  const route = readFileSync(path.join(__dirname, "../src/app/api/jobs/[id]/iterations/route.ts"), "utf8");
  must(route.includes('searchParams.get("since")') && route.includes("unchanged: true"), "F14 the iterations route speaks ?since= / unchanged (both legs)");
  must(route.includes("markLogWatch(job.id)"), "F15 an open live-results view tightens the sweep floor");
  must(route.includes("payload.version = iterationsVersion(payload)"), "F16 the version lands AFTER the route's own payload mutations");

  const gal = readFileSync(path.join(__dirname, "../src/components/workflow/results/class-iteration-gallery.tsx"), "utf8");
  must(gal.includes("?since=${encodeURIComponent(versionRef.current)}"), "F17 the gallery carries the version token");
  must(gal.includes("if (body.unchanged) return;"), "F18 an unchanged answer skips the re-render");
  must(gal.includes("setInterval(() => void load(), 5_000)"), "F19 the live poll cadence is 5s (was 12s)");

  const il = readFileSync(path.join(__dirname, "../src/lib/remote/iteration-live.ts"), "utf8");
  must(il.includes("export function iterationsVersion") && il.includes("export function prewarmLiveIterations"), "F20 the new exports exist");
  must(il.includes("const payload = livePayloadFromParts({ jobId, dataStarNames: dataStars, stackNames: stacks, nzByName, occText })"), "F21 remoteLiveIterations feeds the shared builder");

  const ji = readFileSync(path.join(__dirname, "../src/components/workflow/job-inspector.tsx"), "utf8");
  must(ji.includes("}, 6_000);"), "F22 the Results tab's refresh signal is 6s (was 15s)");
}

console.log(`\n${"-".repeat(60)}\nt397 perf-units: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
