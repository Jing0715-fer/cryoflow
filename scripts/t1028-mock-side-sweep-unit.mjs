#!/usr/bin/env node
/**
 * t1028-mock-side-sweep-unit — the mock-side debris law's own instrument.
 *
 * The t1028 window's audit found the blind spot class t1027 named (F3: a
 * mint's remove that records only SOME of its workdirs) alive at a new seat:
 * the t915 extract mint's remove had the local legs (the suffix walk + the
 * manifest pass) but NO mock-side leg, and its manifest's pick entry was
 * born null (the poll DTO carries no workdir) — so eleven cluster-side
 * workdirs of past rides stood as debris no world gate could see (the gates
 * count jobs and edges, not cluster dirs).
 *
 * THE CURE (two cars):
 *   1. t915-extract-mint.mjs — workdirs recorded for ALL minted jobs via
 *      the OUTPUTS route (the poll DTO never carries it; the outputs
 *      listing does — the t922 shape, the t1027 law generalized), and the
 *      remove grows the mock-side leg (walk every mock family dir, sweep by
 *      the minted suffixes — the t922 shape verbatim).
 *   2. t1028-debris-sweep.mjs — the standing orphan sweeper: one-directional
 *      live-suffix test (a job-shaped mock dir whose suffix matches no live
 *      job is debris; a live twin is kept; micrographs and strangers are
 *      kept by shape), receipt, idempotent by re-audit.
 *
 * F band — source pins on both cars (the laws' words in the sources).
 * L band  — the live ride: a planted orphan swept, every live twin kept,
 *           the receipt honest, the second ride idempotent, the world
 *           untouched (jobs and edges as-found through both rides).
 *
 * Census slot 43. Run: node scripts/t1028-mock-side-sweep-unit.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = "/home/z/my-project";
const MINT = path.join(ROOT, "scripts", "t915-extract-mint.mjs");
const SWEEP = path.join(ROOT, "scripts", "t1028-debris-sweep.mjs");
const MOCK_PROJECTS = path.join(ROOT, "services", "mock-cluster", "fs", "projects", "cryoflow");
const RECEIPT = path.join(ROOT, "shots-qa", "t1028-debris-sweep.json");
const PLANTED = "autopick_debez1028";
const PLANTED_SENTINEL = ".t1028-planted";
const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (method, url) => {
  const out = execSync(`curl -s -X ${method} ${ORIGIN} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
  try { return JSON.parse(out); } catch { return { error: out.slice(0, 200) }; }
};

const pollWorld = async (want, tries = 20) => {
  for (let i = 0; i < tries; i++) {
    const j = api("GET", "/api/jobs").jobs ?? [];
    if (j.length === want) return j;
    await sleep(750);
  }
  return api("GET", "/api/jobs").jobs ?? [];
};

console.log("== t1028 mock-side sweep unit ==");

// ---------- F band: the cure's words in the sources ----------
console.log("-- F band: source pins --");
const mintSrc = readFileSync(MINT, "utf8");
const sweepSrc = readFileSync(SWEEP, "utf8");

// 1. the mint records the pick's workdir via the OUTPUTS route (the poll DTO's null cured)
ok("mint: the pick's outputs route is the workdir's seat",
  mintSrc.includes("`/api/jobs/${pick.job.id}/outputs`"));
// 2. the manifest's workdirs come from the outputs replies — pickWd, not the null-born pickDone.workdir
ok("mint: workdirs recorded from the outputs route (pickWd + extract's wd)",
  mintSrc.includes("workdirs: { pick: pickWd, extract: wd ?? null }"));
// 3. the honest belt assert — both minted workdirs must ride the manifest
ok("mint: the 'both minted workdirs recorded' assert stands",
  mintSrc.includes(`"both minted workdirs recorded"`));
// 4. the remove's mock-side leg — the t922 shape verbatim (family walk + suffix containment + rm)
ok("remove: the mock-side leg walks MOCK_PROJECTS by family",
  mintSrc.includes(`"mock-cluster", "fs", "projects", "cryoflow"`) && mintSrc.includes("for (const fam of readdirSync(MOCK_PROJECTS))"));
ok("remove: the leg sweeps by suffix containment",
  mintSrc.includes("suffixes.some((s) => dir.includes(s))") && mintSrc.includes("rm mock-side"));
// 5. the local legs kept — the belt-and-braces passes survive the cure
ok("remove: the local suffix walk kept (/^(autopick_|extract_)/)",
  mintSrc.includes("/^(autopick_|extract_)/"));
ok("remove: the manifest workdirs pass kept",
  mintSrc.includes("m.workdirs?.extract, m.workdirs?.pick"));
// 6. the F3 law's citation rides the source (the law's name travels with the cure)
ok("remove: the t1027 F3 law cited at the seat",
  mintSrc.includes("t1027") && mintSrc.includes("F3"));
// 7. the sweep's orphan test is one-directional on the LIVE suffix set
ok("sweep: the orphan test is the live-suffix set (liveSuffixes.has keeps a twin)",
  sweepSrc.includes("liveSuffixes.has(m[1])") && sweepSrc.includes("liveSuffixes = new Set(liveJobs.map((j) => String(j.id ?? \"\").slice(-8))"));
// 8. the shape guard keeps micrographs and strangers by shape, not by name
ok("sweep: the job-shape guard keeps micrographs by shape",
  sweepSrc.includes("JOB_DIR_SHAPE") && sweepSrc.includes("not job-shaped"));
// 9. the receipt is the sweep's honest word
ok("sweep: the receipt records swept/kept/orphansLeft",
  sweepSrc.includes("t1028-debris-sweep.json") && sweepSrc.includes("orphansLeft"));
// 10. the sweep speaks the ORIGIN law (curl QA against doored routes sends the header)
ok("sweep: the ORIGIN law rides the curl", sweepSrc.includes('-H "Origin: '));

// ---------- L band: the live ride ----------
console.log("-- L band: the live ride --");
// world guard (the poll — the patience law at the world gate)
const world = await pollWorld(22);
ok("guard: the world answers at its standing shape (the t1081-R young world)", world.length === 15, `${world.length} jobs`);
if (world.length !== 15) { console.log("FATAL: world gate — the unit refuses to ride a foreign world (the t1081-R young world: the reboot re-seeded the demo chain)"); process.exit(2); }
const edges0 = (api("GET", "/api/edges").edges ?? []).length;
const liveSuffixes = new Set(world.map((j) => String(j.id ?? "").slice(-8)).filter(Boolean));
ok("guard: the planted suffix matches no live job", !liveSuffixes.has(PLANTED.split("_")[1]), PLANTED);

// the live twins' snapshot — every live job's mock dir that stands before the sweep
// (t1081-R: the famDir discovers the demo project LIVE — the reboot re-seeded
// the world and minted a NEW project id; a fossil id pins a corpse)
const famDir = await (async () => {
  try {
    const res = await fetch("http://localhost:3000/api/project", { headers: { Origin: "http://localhost:3000" } });
    const body = await res.json().catch(() => null);
    const p = body?.project ?? body;
    if (p?.id) return path.join(MOCK_PROJECTS, p.id);
  } catch {}
  return path.join(MOCK_PROJECTS, "unknown");
})();
let before = [];
try { before = readdirSync(famDir); } catch { /* no family dir */ }
const liveTwins = before.filter((d) => { const m = /^[a-z0-9]+_([a-z0-9]{6,})$/.exec(d); return m && liveSuffixes.has(m[1]); });
ok("guard: live twins stand before the sweep", liveTwins.length >= 10, `${liveTwins.length} twins`);
ok("guard: micrographs stands before the sweep", before.includes("micrographs"));

// plant the orphan (the fixture the sweeper exists for — the receipt names it)
mkdirSync(path.join(famDir, PLANTED), { recursive: true });
writeFileSync(path.join(famDir, PLANTED, PLANTED_SENTINEL), "planted by t1028-mock-side-sweep-unit");
ok("fixture: the planted orphan stands with its sentinel", existsSync(path.join(famDir, PLANTED, PLANTED_SENTINEL)));

// ride 1 — the sweep
let ride1 = "";
try { ride1 = execSync(`node scripts/t1028-debris-sweep.mjs`, { encoding: "utf8", cwd: ROOT, timeout: 120_000 }); }
catch (e) { ride1 = String(e.stdout ?? "") + String(e.stderr ?? ""); }
ok("ride1: the sweep exits GREEN", /GREEN/.test(ride1), ride1.split("\n").filter((l) => l.includes("==")).join(" | ").slice(0, 140));
ok("ride1: the planted orphan swept", !existsSync(path.join(famDir, PLANTED)), PLANTED);
const receipt1 = existsSync(RECEIPT) ? JSON.parse(readFileSync(RECEIPT, "utf8")) : null;
ok("ride1: the receipt names the planted orphan",
  !!receipt1 && (receipt1.swept ?? []).some((d) => d.endsWith(`/${PLANTED}`)) // t1081-R — the family prefix is the LIVING project's id (the famDir discovery law); the receipt names the swept path under whatever family rode the sweep
  );
ok("ride1: the receipt's re-audit reads orphansLeft 0", !!receipt1 && receipt1.orphansLeft === 0);
const after1 = existsSync(famDir) ? readdirSync(famDir) : [];
ok("ride1: every live twin survived", liveTwins.every((d) => after1.includes(d)), `${liveTwins.length}/${liveTwins.length}`);
ok("ride1: micrographs survived", after1.includes("micrographs"));

// ride 2 — idempotence
let ride2 = "";
try { ride2 = execSync(`node scripts/t1028-debris-sweep.mjs`, { encoding: "utf8", cwd: ROOT, timeout: 120_000 }); }
catch (e) { ride2 = String(e.stdout ?? "") + String(e.stderr ?? ""); }
const receipt2 = existsSync(RECEIPT) ? JSON.parse(readFileSync(RECEIPT, "utf8")) : null;
ok("ride2: the sweep exits GREEN again", /GREEN/.test(ride2));
ok("ride2: nothing swept — idempotent", !!receipt2 && (receipt2.swept ?? []).length === 0,
  receipt2 ? `swept ${receipt2.swept.length}` : "no receipt");

// the world untouched through both rides (the sweeper touches no world state)
const worldAfter = await pollWorld(22);
ok("world: jobs as-found through both rides (the t1081-R young world)", worldAfter.length === 15, `${worldAfter.length} jobs`);
const edgesAfter = (api("GET", "/api/edges").edges ?? []).length;
ok("world: edges as-found through both rides", edgesAfter === edges0, `${edgesAfter} edges`);

console.log(`== t1028-mock-side-sweep-unit ${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);
