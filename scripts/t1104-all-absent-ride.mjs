// t1104-all-absent-ride.mjs — THE ALL-ABSENT FACE'S LIVE SEAT (Task 1104).
// The all-absent clause ("no mirrors yet — all N runs live on the cluster
// alone", t1100) has been pinned in the source since AH2, but it has
// never SPOKEN LIVE: every ride so far vanished ONE rider's mirror
// (t1101's some-absent face, "1 of 10 runs unmirrored"). This harness
// rides the clause's own threshold — EVERY rider's mirror really leaves,
// the walk still speaks (an honest zero with a named subject, never the
// gate's refused unknown), and the family's seats answer:
//
//   vanish  — resolve the TEN riders from the ONE well (remoteInfoFor +
//             getRun — the RIDERS' law: the ledger counts the connection's
//             riders, never the readdir's fourteen dirs) → mv ALL TEN
//             mirror dirs aside → measure 1: the push law pushes the
//             OUTGOING flat word, the live walk already speaks the
//             all-absent clause AND the hop speaks the REAL vanishing
//             (down ~1.31 GB — the only honest hop with no mirrors) →
//             measure 2: the ring remembers the ZERO (the sidecar's first
//             spoken zero — mirrorBytesTotalFor sums the missing rows to
//             0 because the walk SPOKE; never a null), the hop goes
//             SILENT (the t1100 guard's live debut: "the mirrors
//             unchanged" with no referent stays quiet). The share reads
//             "0% used" — the gate's NEGATIVE space: t1102's gate refuses
//             only an UNSPOKEN walk's zero; a spoken all-absent zero is
//             TRUE and the clause names its subject. LEAVES THE WORLD
//             VANISHED — the camera window sits here.
//   restore — mv all ten home → BEFORE any measure the live walk sees
//             home (the clause gone) while the ring's newest still holds
//             the zero → the hop speaks the RETURN (up ~1.31 GB — the
//             UP face exists only here) → two measures → the bare clause
//             back, the newest point EXACTLY the pre-ride total, the ends
//             flat, the interior keeping the ride's two zeros.
//   verify  — the read-only as-left audit.
//
//   TRUST THE WORDS — every clause read out of the BAND's own summary
//   (never a re-implementation); the sidecar's own points as the
//   cross-check. Every step prints a wall-clock stamp (the t1097 law).
//
// ⚠ THE RING IS NEWEST-FIRST: pts[0] is the NEWEST word, pts.at(-1) the
//   OLDEST end (the t1101 lesson — name the ends, never assume).
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync, renameSync, existsSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(ROOT, "src") },
});

const SIDECAR = path.join(ROOT, "data", "remote-fleet-ledger.json");
const PID = "cmvbjl6060000srlis2ai5mb3";
const PROJECT_DIR = path.join(ROOT, "data/relion", PID);
const ASIDE_PREFIX = ".t1104-aside-";

const stamp = () => new Date().toISOString().slice(11, 19);
const say = (msg) => console.log(`[${stamp()}] ${msg}`);
const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);

const readSidecar = () => {
  try {
    return JSON.parse(readFileSync(SIDECAR, "utf8"));
  } catch {
    return null;
  }
};
const ringPointsOf = (sidecar, pid) => {
  const proj = sidecar?.projects?.[pid];
  const hist = proj?.history ?? {};
  return Object.values(hist)[0] ?? [];
};
const withWatchdog = async (label, promise, ms = 120_000) => {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`WATCHDOG: ${label} exceeded ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
};

say("importing the shelf…");
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const { remoteInfoFor } = await __jiti.import("../src/lib/remote/remote-run.ts");
const { getRun } = await __jiti.import("../src/lib/relion/engine.ts");
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const project = await db.project.findFirst({
  where: { name: "β-Galactosidase Tutorial (demo)" },
  select: { id: true, name: true },
});
if (!project) throw new Error("demo project not found — the world is not the expected one");
await db.$disconnect();
say(`project: ${project.id} "${project.name}"`);
const ctx = { projectId: project.id };

// --- the TEN RIDERS from the ONE well: the same two sources the ledger
// drinks (remoteInfoFor → the connection's riders; getRun → the local
// mirror dir under the project dir). The RIDERS' law: never the readdir's
// own count — the walk sees sixteen dirs, the ledger counts ten riders.
const RIDERS = [];
{
  const jobs = await (async () => {
    const { PrismaClient: P } = await import("@prisma/client");
    const d = new P();
    const rows = await d.job.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    await d.$disconnect();
    return rows;
  })();
  for (const j of jobs) {
    const info = remoteInfoFor(j.id);
    if (!info) continue; // a local run — never a rider
    const rec = getRun(j.id);
    if (!rec?.workdir) continue;
    if (path.dirname(rec.workdir) !== PROJECT_DIR) continue;
    RIDERS.push({ jobId: j.id, jobName: j.name, dirName: path.basename(rec.workdir) });
  }
}
say(`riders resolved from the ONE well: ${RIDERS.length}`);
for (const r of RIDERS) say(`  rider ${r.jobName} → ${r.dirName}`);
if (RIDERS.length !== 10) {
  say(`FAIL the rider census — expected 10 riders, got ${RIDERS.length} (TRUST THE COUNT: refusing to ride a world I don't understand)`);
  process.exit(1);
}

// --- the BAND witness: every clause read out of the band's OWN summary ---
const bandWordsOf = async (label) => {
  const r = await withWatchdog(`band ${label}`, executeAiTool("get_fleet_ledger", {}, ctx));
  const summary = r?.summary ?? "";
  // the FULL clause (the bare shape read "" through the old [^·] capture —
  // the t1102 lesson: the harness's stale constants, never the world; the
  // bare clause's emptiness WAS the all-home shape, not an absence)
  const mirrorClause = summary.match(/mirrors hold [\d.]+ [KMG]B here(?: · \d+ of \d+ runs unmirrored)?/)?.[0] ?? null;
  const allAbsentVerbatim =
    summary.match(/no mirrors yet — all (\d+) runs? live on the cluster alone/)?.[0] ?? null;
  const naming = /(\d+ of \d+ runs unmirrored)/.exec(summary)?.[1] ?? null;
  const hop = summary.match(/the mirrors (?:are )?(down|up) ([\d.]+ [KMG]B) since the measure ([^·]+)/)?.[0] ?? null;
  const hopFlat = /the mirrors unchanged since the measure ([^·]+)/.test(summary);
  const share = summary.match(/\((\d+)% used, the share ([\w ]+)\)/)?.[0] ?? null;
  const unreadable = summary.includes("unreadable");
  const clusterHolds = summary.match(/cluster holds ([\d.]+ [KMG]B) across (\d+) workdirs/)?.[0] ?? null;
  say(`[${label}] allAbsent: ${allAbsentVerbatim ?? "none"} · naming: ${naming ?? "none"} · mirrorClause: ${mirrorClause ?? "none"}`);
  say(`[${label}] hop: ${hop ?? (hopFlat ? "(unchanged)" : "(SILENT)")} · share: ${share ?? "(none)"} · cluster: ${clusterHolds ?? "none"}${unreadable ? " · ⚠ UNREADABLE FACE WORN" : ""}`);
  return { mirrorClause, allAbsentVerbatim, naming, hop, hopFlat, share, unreadable, clusterHolds, summary };
};

const measure = async (label) => {
  const m = await withWatchdog(`measure ${label}`, executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m?.ok) throw new Error(`${label} measure failed`);
  say(`${label} measure ok`);
  return m;
};

const stage = process.argv[2] ?? "";

if (stage === "vanish") {
  // mv ALL TEN riders aside (honest restorable renames, inside the
  // project dir — the t1101 aside shape, scaled to the clause's threshold)
  let moved = 0;
  for (const r of RIDERS) {
    const from = path.join(PROJECT_DIR, r.dirName);
    const to = path.join(PROJECT_DIR, ASIDE_PREFIX + r.dirName);
    if (existsSync(from)) {
      renameSync(from, to);
      moved += 1;
    } else if (existsSync(to)) {
      say(`  ${r.dirName} already aside (a previous stage left the world mid-ride)`);
    } else {
      say(`  ⚠ ${r.dirName} exists NOWHERE — not home, not aside`);
    }
  }
  say(`vanish: ${moved} rider mirrors moved aside`);
  const beforePts = ringPointsOf(readSidecar(), project.id);
  const flat = beforePts[0]?.mirrorBytes ?? null; // NEWEST-first
  say(`pre-ride word (the ring's newest): ${flat} · ring ${beforePts.length} pts`);

  // measure 1 — the push law: the OUTGOING flat word enters the ring;
  // the live walk already speaks the all-absent clause; the hop speaks
  // the real vanishing (down) — the only honest hop with no mirrors.
  await measure("vanish-1");
  const w1 = await bandWordsOf("vanish-m1");
  expect("vanish-m1 the ALL-ABSENT clause speaks verbatim (all 10 runs live on the cluster alone)",
    w1.allAbsentVerbatim === "no mirrors yet — all 10 runs live on the cluster alone");
  expect("vanish-m1 the some-absent tail is REPLACED, not stacked (no 'K of N runs unmirrored')", w1.naming === null);
  expect("vanish-m1 the hop speaks the REAL vanishing (down)", !!w1.hop && w1.hop.includes("down"));
  expect("vanish-m1 the walk SPOKE (no unreadable face)", !w1.unreadable);
  expect("vanish-m1 the cluster side never moved (the bytes live there still)",
    w1.clusterHolds === "cluster holds 1.33 GB across 10 workdirs");

  // measure 2 — the ring remembers the ZERO (the sidecar's first spoken
  // zero); the hop goes SILENT — the t1100 guard's live debut.
  await measure("vanish-2");
  const w2 = await bandWordsOf("vanish-m2");
  expect("vanish-m2 the ALL-ABSENT clause still speaks", w2.allAbsentVerbatim === "no mirrors yet — all 10 runs live on the cluster alone");
  expect("vanish-m2 the hop SILENT (the t1100 guard: 'unchanged' with no referent stays quiet)", !w2.hop && !w2.hopFlat);

  // the ring + the sidecar cross-checks (TRUST THE BYTES)
  const pts = ringPointsOf(readSidecar(), project.id);
  const newest = pts[0]?.mirrorBytes ?? null;
  const oldest = pts.at(-1)?.mirrorBytes ?? null;
  expect("vanish the ring's newest point is the SPOKEN ZERO", newest === 0);
  expect("vanish the ring's oldest end still the flat word", oldest === flat);
  const sidecarConn = readSidecar()?.projects?.[project.id]?.connections?.[0];
  expect("vanish the sidecar's mirrorBytesTotal stamped 0 (never null — the walk spoke)", sidecarConn?.mirrorBytesTotal === 0);

  // the share: the gate's NEGATIVE space — the walk spoke, so the zero
  // is TRUE and the clause names its subject (t1102 refuses only the
  // UNSPOKEN walk's zero).
  expect("vanish the share reads the honest zero (0% used)", !!w2.share && w2.share.startsWith("(0% used"));
  say(`vanish the share's weather as worn: ${w2.share ?? "(none)"}`);

  say("VANISHED — the camera window is open: witness the card badge '10 unmirrored', the mirror cell 'no mirrors yet', the share at 0%, then run: node scripts/t1104-all-absent-ride.mjs restore");
  process.exit(0);
}

if (stage === "restore") {
  let home = 0;
  for (const r of RIDERS) {
    const from = path.join(PROJECT_DIR, ASIDE_PREFIX + r.dirName);
    const to = path.join(PROJECT_DIR, r.dirName);
    if (existsSync(from)) {
      renameSync(from, to);
      home += 1;
    } else if (existsSync(to)) {
      say(`  ${r.dirName} already home`);
    } else {
      say(`  ⚠ ${r.dirName} exists NOWHERE — the ride cannot restore it`);
    }
  }
  say(`restore: ${home} rider mirrors brought home`);
  const pts0 = ringPointsOf(readSidecar(), project.id);
  const preRide = pts0.at(-1)?.mirrorBytes ?? null; // OLDEST end = the pre-ride flat word
  say(`pre-ride word (the ring's oldest end): ${preRide}`);

  // THE RETURN'S OWN FILM POINT — BEFORE any measure: the live walk sees
  // home (the clause gone) while the ring's newest still holds the zero;
  // the hop speaks the RETURN (up) — the UP face exists only here.
  const wPre = await bandWordsOf("restore-pre");
  expect("restore-pre the ALL-ABSENT clause ALREADY GONE (the live walk sees home)", wPre.allAbsentVerbatim === null);
  expect("restore-pre the hop speaks the RETURN (up)", !!wPre.hop && wPre.hop.includes("up"));
  expect("restore-pre no naming tail either (all ten home)", wPre.naming === null);

  // two measures — the push law: the first pushes the outgoing ZERO,
  // the second remembers the return.
  await measure("restore-1");
  await measure("restore-2");
  const w = await bandWordsOf("restore");
  expect("restore the bare clause back (mirrors hold … here)", !!w.mirrorClause);
  expect("restore the ALL-ABSENT clause gone", w.allAbsentVerbatim === null);
  expect("restore the some-absent tail gone (all ten home)", w.naming === null);

  const pts = ringPointsOf(readSidecar(), project.id);
  const newest = pts[0]?.mirrorBytes ?? null;
  const oldest = pts.at(-1)?.mirrorBytes ?? null;
  expect("restore the newest point EXACTLY the pre-ride total", newest != null && preRide != null && newest === preRide);
  expect("restore the ring's ends flat", newest === preRide && oldest === preRide);
  const zeros = pts.filter((p) => p.mirrorBytes === 0).length;
  expect("restore the interior keeps the ride's two zeros", zeros === 2);
  const sidecarConn = readSidecar()?.projects?.[project.id]?.connections?.[0];
  expect("restore the sidecar's mirrorBytesTotal back to the flat word", sidecarConn?.mirrorBytesTotal === preRide);
  expect("restore the share back at 65% used", !!w.share && w.share.startsWith("(65% used"));
  say(`restore the share's weather as worn: ${w.share ?? "(none)"}`);
  say("RESTORED — run: node scripts/t1104-all-absent-ride.mjs verify");
  process.exit(0);
}

if (stage === "verify") {
  const w = await bandWordsOf("verify");
  expect("verify the band's bare clause (no all-absent, no naming)", w.allAbsentVerbatim === null && w.naming === null && !!w.mirrorClause);
  expect("verify the share at 65% used", !!w.share && w.share.startsWith("(65% used"));
  const pts = ringPointsOf(readSidecar(), project.id);
  expect("verify the ring 12/12 with the ends the flat word", pts.length === 12 && pts[0]?.mirrorBytes === pts.at(-1)?.mirrorBytes && pts[0]?.mirrorBytes != null);
  const zeros = pts.filter((p) => p.mirrorBytes === 0).length;
  expect("verify the interior keeps the ride's two zeros", zeros === 2);
  const sidecarConn = readSidecar()?.projects?.[project.id]?.connections?.[0];
  expect("verify the sidecar's mirrorBytesTotal the flat word", sidecarConn?.mirrorBytesTotal != null && sidecarConn.mirrorBytesTotal > 0);
  say("VERIFY done — the as-left world: all mirrors home, the ring remembering the ride");
  process.exit(0);
}

console.log("usage: node scripts/t1104-all-absent-ride.mjs <vanish|restore|verify>");
process.exit(1);
