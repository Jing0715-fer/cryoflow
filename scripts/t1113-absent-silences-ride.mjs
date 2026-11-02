// t1113-absent-silences-ride.mjs — THE ABSENT WORLD'S OWN SILENCES
// (Task 1113). Two eras meet in one film: the ALL-ABSENT face (t1104 —
// every rider's mirror really leaves, the walk still speaks, the ring's
// first SPOKEN ZERO) and the BAND-SILENCES era (t1109–t1112 — the
// qualifying holes' own sentence, the drill's compact count, the birth
// rhythm). t1104's all-absent ride never failed a measure; every
// silences ride so far lived in a mirror-full world. THE CLAIM UNDER
// FILM: the absent world wears BOTH honesties at once — the present's
// mirror-zero (the all-absent clause, the guard's silence, the share's
// dive) and the memory's cluster-holes (the silences sentence, the
// drill's count) — and the failed measure's own record teaches the
// deepest law: THE HOLE IS ONE CHANNEL'S SILENCE. The failed record
// carries bytes: null (the cluster went quiet) BESIDE mirrorBytes: 0
// (the local walk SPOKE — the zero is the absent world's own word), so:
//
//   • the hole qualifies on the CLUSTER channel; the pairs stay the
//     cluster's words ("1.33 GB → 1.33 GB") even while the whole ride
//     lives at a 0% share — the mirror zeros never enter the pairs;
//   • the band wears the all-absent clause AND the silences sentence
//     in ONE breath (two clauses about two different channels, each
//     honest at its own seat);
//   • at the RETURN the UP FACE SPEAKS ACROSS THE HOLE — the mirror
//     delta's prev is the hole cell's SPOKEN mirror zero (never air),
//     so "the mirrors up 1.31 GB" rides where the cluster's own trend
//     must wait (the two-channel verdict fork at one cell);
//   • the descent walks the holes out the OLDEST edge one beat per
//     hole (2 → 1 → the quiet → the flat) while the share climbs home,
//     and the eviction purges the ride ENTIRELY — the as-left ring is
//     the purest flat with NO zeros, cleaner than t1104's as-left.
//
//   gate      — the read-only purest-flat audit (12/12 all spoken both
//               channels, no holes, no mirror zeros). Refuses otherwise.
//   vanish    — mv ALL TEN riders' mirrors aside (the t1104 recipe, the
//               RIDERS' law) → measure ×2: the all-absent clause verbatim,
//               the DOWN hop at v1, the guard's SILENCE at v2, the
//               silences clause ABSENT at BOTH beats (the zero is a
//               value, never a hole). LEAVES THE WORLD VANISHED.
//   fail-1    — (the cluster ALREADY killed bash-side) the failed
//               measure IN THE ABSENT WORLD: the failed headline and
//               the all-absent clause in one breath; the silences clause
//               ABSENT (the failed present alone births no hole); drill 0.
//   birth-1   — (the cluster ALREADY relaunched) H1 BORN TRAILING: the
//               singular + the all-absent clause in ONE breath; the pair
//               the CLUSTER's words; the drill honestly ZERO; the hole
//               cell carries mirror 0 (the shape the AN6 pin drinks).
//   interior-1 — one measure: the drill's first breath (1) in the absent
//               world; the singular stays; the absent clause stays.
//   fail-2    — (the cluster ALREADY killed AGAIN) the singular rides
//               through the failed present (the t1107 law in the absent
//               world); the drill stays 1.
//   birth-2   — (the cluster ALREADY relaunched) H2 BORN TRAILING: THE
//               PLURAL IN THE ABSENT WORLD (the t1073 shape at two, the
//               ages the clock's own), the drill honestly ONE.
//   restore   — mv all ten home → the return's own film point BEFORE any
//               measure (the absent clause ALREADY GONE, the plural still
//               standing) → the measure: THE UP FACE SPEAKS ACROSS THE
//               HOLE (the mirror delta's prev is the spoken zero), the
//               cluster's trend waits, the plural HOLDS, the drill's lag
//               closes (1 → 2), the share climbs home.
//   descent   — measures until the purest flat (cap 14): the counts
//               descend monotone (the oldest hole rolls first — the
//               t1112 edge law re-earned), the quiet lands, the eviction
//               purges EVERY scar (no holes, NO mirror zeros).
//   verify    — the read-only as-left audit.
//
// TRUST THE WORDS — every check reads the mouths' OWN summaries; the
// sidecar's ring is the cross-check; the flat constants come from the
// CONNECTION ROW's last spoken words (READ FRESH, NAME THE ENDS — the
// t1102 law). The write is the truth, the response's silence is
// transport: a timed-out measure is polled on the sidecar before it is
// mourned. The ring is NEWEST-FIRST (pts[0] = the newest word).
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson).
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync, renameSync, existsSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(ROOT, "src") },
});

const SIDECAR = path.join(ROOT, "data", "remote-fleet-ledger.json");
const WATCHDOG_MS = 120_000;
const AGE = "(just now|\\d+m ago)"; // graveAgeLike's own minutes dialect

const stamp = () => new Date().toISOString().slice(11, 19);
const say = (msg) => console.log(`[${stamp()}] ${msg}`);

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
const connOf = (sidecar, pid) => sidecar?.projects?.[pid]?.connections?.[0] ?? null;
const withWatchdog = async (label, promise) => {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`WATCHDOG: ${label} exceeded ${WATCHDOG_MS}ms`)), WATCHDOG_MS);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
};

say("importing the shelf…");
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const { fmtBytes } = await __jiti.import("../src/lib/relion/disk-usage.ts");
const { remoteInfoFor } = await __jiti.import("../src/lib/remote/remote-run.ts");
const { getRun } = await __jiti.import("../src/lib/relion/engine.ts");

const project = await (async () => {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const p = await db.project.findFirst({
      where: { name: "β-Galactosidase Tutorial (demo)" },
      select: { id: true, name: true },
    });
    if (!p) throw new Error("demo project not found — the world is not the expected one");
    return p;
  } finally {
    await db.$disconnect();
  }
})();
say(`project: ${project.id} "${project.name}"`);
const ctx = { projectId: project.id };

// --- the TEN RIDERS from the ONE well (the t1104 recipe, verbatim): the
// ledger counts the connection's riders, never the readdir's own count.
const PID = project.id;
const PROJECT_DIR = path.join(ROOT, "data/relion", PID);
const ASIDE_PREFIX = ".t1113-aside-";
const RIDERS = [];
{
  const { PrismaClient: P } = await import("@prisma/client");
  const d = new P();
  const rows = await d.job.findMany({
    where: { projectId: PID },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  await d.$disconnect();
  for (const j of rows) {
    const info = remoteInfoFor(j.id);
    if (!info) continue; // a local run — never a rider
    const rec = getRun(j.id);
    if (!rec?.workdir) continue;
    if (path.dirname(rec.workdir) !== PROJECT_DIR) continue;
    RIDERS.push({ jobId: j.id, jobName: j.name, dirName: path.basename(rec.workdir) });
  }
}
say(`riders resolved from the ONE well: ${RIDERS.length}`);
if (RIDERS.length !== 10) {
  say(`FAIL the rider census — expected 10 riders, got ${RIDERS.length} (TRUST THE COUNT: refusing to ride a world I don't understand)`);
  process.exit(1);
}

// the measure's write-is-the-truth wrapper (the t1109 law).
const measure = async (label, prevStamp) => {
  try {
    await withWatchdog(`measure ${label}`, executeAiTool("get_fleet_ledger", { measure: true }, ctx));
    say(`measure ${label} ok (the dispatch answered)`);
  } catch (e) {
    say(`measure ${label}: the dispatch did not answer (${e.message.slice(0, 60)}) — polling the sidecar (the write is the truth)`);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2_000));
      const pts = ringPointsOf(readSidecar(), PID);
      if (pts[0]?.at && pts[0].at !== prevStamp) {
        say(`measure ${label} LANDED (the sidecar stamped ${pts[0].at})`);
        return;
      }
    }
    throw new Error(`measure ${label}: no sidecar stamp within 60s of the timeout`);
  }
};

// the BAND witness (the t1112 idiom): the faces out of the mouth's own
// summary. The silences capture walks to the " Heaviest" delimiter — the
// byte-words carry their own periods (the t1110 lesson).
const bandOf = async (label) => {
  const r = await withWatchdog(`band ${label}`, executeAiTool("get_fleet_ledger", {}, ctx));
  const summary = r?.summary ?? "";
  const band = summary.split(" | ")[0] ?? "";
  const mirrorClause = band.match(/ · (mirrors hold [^·]*?|the mirror side unreadable[^·]*?|no mirrors yet[^·]*?) ·/)?.[1] ?? "(NO MIRROR CLAUSE)";
  const ceilingClause = band.match(/sync ceiling [^·]*/)?.[0] ?? "(NO CEILING CLAUSE)";
  const hop = band.match(/ · the mirrors (up|down|unchanged)[^·]*/)?.[0] ?? "(HOP SILENT)";
  const delta = band.match(/\d[\d.]* [KMG]B lives only on the cluster[^·]*|the policy comparison waits[^·]*/)?.[0] ?? "(NO DELTA)";
  const trend = band.match(/ · (up|down|unchanged) [^·]*| · the (newest|previous) measure heard nothing[^·]*| · the trend begins[^·]*/)?.[0] ?? "(NO TREND)";
  const sil = band.match(/((?:An honest silence|\d+ honest silences)[\s\S]*?) Heaviest workdir/)?.[1] ?? "(no silences clause)";
  say(`[${label}] MIRROR: ${mirrorClause}`);
  say(`[${label}] HOP: ${hop}`);
  say(`[${label}] DELTA: ${delta}`);
  say(`[${label}] TREND: ${trend}`);
  say(`[${label}] CEILING: ${ceilingClause}`);
  say(`[${label}] SILENCES: ${sil}`);
  return { summary, band, mirrorClause, ceilingClause, hop, delta, trend, sil };
};
// the DRILL witness (the t1112 idiom): the compact count beside the band.
const drillOf = async (label) => {
  const r = await withWatchdog(`drill ${label}`, executeAiTool("get_fleet_memory", {}, ctx));
  const summary = r?.summary ?? "";
  const row = summary.match(/Mock Cluster: ring [^|]*/)?.[0]?.trim() ?? "(NO ROW)";
  const count = Number(row.match(/, (\d+) honest holes? in the memory/)?.[1] ?? "0");
  say(`[${label}] DRILL: ${row}`);
  return { summary, row, count };
};
const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);

// the ring's CLUSTER-side hole indices (newest first, index 0 = head).
// The mirror channel's nulls are NOT silences holes (the t1110 law).
const holeIdx = (pts) => pts.map((p, i) => (p.bytes == null ? i : -1)).filter((i) => i >= 0);
const mirrorZeroIdx = (pts) => pts.map((p, i) => (p.bytes != null && p.mirrorBytes === 0 ? i : -1)).filter((i) => i >= 0);
const presentOf = (sidecar) => {
  const sizes = connOf(sidecar, PID)?.sizes ?? {};
  return Object.values(sizes).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
};
const sidecarMirrorTotal = (sidecar) => connOf(sidecar, PID)?.mirrorBytesTotal;

const stage = process.argv[2];
if (!stage || !["gate", "vanish", "fail-1", "birth-1", "interior-1", "fail-2", "birth-2", "restore", "descent", "verify"].includes(stage)) {
  console.error("usage: node scripts/t1113-absent-silences-ride.mjs <gate|vanish|fail-1|birth-1|interior-1|fail-2|birth-2|restore|descent|verify>");
  process.exit(2);
}

// --- the as-found constants (READ FRESH, NAME THE ENDS — the t1102 law;
// only gate/vanish demand the purest flat — the later stages arrive with
// the world intentionally holed and vanished, and must not mourn it) ---
const sidecar0 = readSidecar();
const asFound = ringPointsOf(sidecar0, PID);
const conn0 = connOf(sidecar0, PID);
const FLAT_B = asFound.find((p) => p.bytes != null)?.bytes;
// the MIRROR flat word: the connection row's total is the PRESENT's word
// — in the vanished world that is the spoken ZERO (the t1102 lesson:
// READ FRESH, NAME THE ENDS — the pre-ride flat lives at the ring's
// OLDEST end once the world is holed/vanished; fall back to it).
const FLAT_M = conn0?.mirrorBytesTotal || asFound.at(-1)?.mirrorBytes;
const CEILING = conn0?.syncCeilingBytes;
if (asFound.length !== 12 || FLAT_B == null || FLAT_M == null) {
  throw new Error(`the as-found world is not the expected 12-point ring with spoken words (len ${asFound.length})`);
}
const PAIR_WORDS = `The measures on either side read ${fmtBytes(FLAT_B)} → ${fmtBytes(FLAT_B)}`;
say(`as-found ring: 12 pts, holes [${holeIdx(asFound)}], mirror zeros [${mirrorZeroIdx(asFound)}], cluster flat ${FLAT_B} (${fmtBytes(FLAT_B)}), mirror flat ${FLAT_M} (${fmtBytes(FLAT_M)}), ceiling ${CEILING}, present ${presentOf(sidecar0)}`);

if (stage === "gate" || stage === "vanish") {
  const holes0 = holeIdx(asFound);
  const zeros0 = mirrorZeroIdx(asFound);
  if (holes0.length !== 0 || zeros0.length !== 0) {
    throw new Error(`the as-found ring is not the purest flat (holes [${holes0}], mirror zeros [${zeros0}]) — ${stage} wants the clean ground`);
  }
}

if (stage === "gate") {
  say("=== STAGE gate — the purest-flat audit (read-only) ===");
  expect("gate the ring 12/12 all spoken both channels", asFound.length === 12 && asFound.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M));
  const b = await bandOf("gate");
  expect("gate the band's bare mirror clause", b.mirrorClause.startsWith("mirrors hold"));
  expect("gate the SILENCES clause ABSENT (the purest flat says nothing)", b.sil === "(no silences clause)");
  const d = await drillOf("gate");
  expect("gate the DRILL's compact count ZERO", d.count === 0);
  say(">>> the ground is clean — run vanish.");
}

if (stage === "vanish") {
  say("=== STAGE vanish — ALL TEN riders' mirrors leave (the t1104 recipe) ===");
  let moved = 0;
  for (const r of RIDERS) {
    const from = path.join(PROJECT_DIR, r.dirName);
    const to = path.join(PROJECT_DIR, ASIDE_PREFIX + r.dirName);
    if (existsSync(from)) {
      renameSync(from, to);
      moved += 1;
    } else if (existsSync(to)) {
      say(`  ${r.dirName} already aside`);
    } else {
      say(`  ⚠ ${r.dirName} exists NOWHERE — not home, not aside`);
    }
  }
  say(`vanish: ${moved} rider mirrors moved aside`);

  // measure 1 — the push law pushes the OUTGOING flat word; the live
  // walk already speaks the all-absent clause; the hop speaks the REAL
  // vanishing (down); THE SILENCES CLAUSE ABSENT (no nulls anywhere).
  const prevStamp1 = asFound[0]?.at;
  await measure("v1", prevStamp1);
  const w1 = await bandOf("vanish-m1");
  expect("vanish-m1 the ALL-ABSENT clause speaks verbatim", w1.mirrorClause === "no mirrors yet — all 10 runs live on the cluster alone");
  expect("vanish-m1 the hop speaks the REAL vanishing (down)", w1.hop.includes("the mirrors down"));
  expect("vanish-m1 the SILENCES clause ABSENT (the zero is a value, never a hole — the t1104 zero never became a silence)", w1.sil === "(no silences clause)");
  expect("vanish-m1 the cluster side never moved", w1.delta.includes(`${fmtBytes(FLAT_B)} lives only on the cluster`));

  // measure 2 — the ring remembers the spoken ZERO; the hop goes SILENT
  // (the t1100 guard's live debut, re-earned in the silences era).
  const prevStamp2 = ringPointsOf(readSidecar(), PID)[0]?.at;
  await measure("v2", prevStamp2);
  const w2 = await bandOf("vanish-m2");
  expect("vanish-m2 the ALL-ABSENT clause still speaks", w2.mirrorClause === "no mirrors yet — all 10 runs live on the cluster alone");
  expect("vanish-m2 the hop SILENT (the t1100 guard: 'unchanged' with no referent stays quiet)", w2.hop === "(HOP SILENT)");
  expect("vanish-m2 the SILENCES clause ABSENT again", w2.sil === "(no silences clause)");
  const pts = ringPointsOf(readSidecar(), PID);
  expect("vanish the ring's newest point carries the SPOKEN ZERO (mirror 0, cluster unmoved)", pts[0]?.mirrorBytes === 0 && pts[0]?.bytes === FLAT_B);
  expect("vanish the ring's OLDEST end still the flat word", pts.at(-1)?.mirrorBytes === FLAT_M && pts.at(-1)?.bytes === FLAT_B);
  expect("vanish NO holes in the ring (the zero never became a null)", holeIdx(pts).length === 0);
  expect("vanish the sidecar's mirrorBytesTotal stamped 0 (never null — the walk spoke)", sidecarMirrorTotal(readSidecar()) === 0);
  say("VANISHED — run fail-1 with the cluster killed bash-side (pkill -f 'mock-cluster/server.mjs').");
}

if (stage === "fail-1") {
  say("=== STAGE fail-1 — the failed measure IN THE ABSENT WORLD (the cluster ALREADY killed) ===");
  const before = ringPointsOf(readSidecar(), PID);
  if (holeIdx(before).length !== 0) throw new Error(`fail-1 wants the zero-carrying spoken ring (holes at [${holeIdx(before)}]) — run vanish first`);
  const prevStamp = before[0]?.at;
  await measure("f1", prevStamp);
  const pts = ringPointsOf(readSidecar(), PID);
  expect("fail-1 THE PUSH LAW NEVER PAUSES — the outgoing {cluster flat, mirror zero} pushed (12/12 all spoken, no null)", pts.length === 12 && holeIdx(pts).length === 0 && pts[0]?.bytes === FLAT_B && pts[0]?.mirrorBytes === 0);
  expect("fail-1 the PRESENT is the honest air on the cluster side (all probes refused)", presentOf(readSidecar()) === 0);
  expect("fail-1 the PRESENT's mirror side is the SPOKEN ZERO (the local walk answered)", sidecarMirrorTotal(readSidecar()) === 0);
  const b = await bandOf("fail-1");
  expect("fail-1 the cluster NEVER ANSWERED (the failed headline)", b.band.includes("the cluster never answered at the last measure (an honest hole)"));
  expect("fail-1 the ALL-ABSENT clause STILL SPEAKS (two honesties in ONE breath — the present's zero beside the failed cluster)", b.mirrorClause === "no mirrors yet — all 10 runs live on the cluster alone");
  expect("fail-1 the DELTA waits for an ANSWERED measure", b.delta.startsWith("the policy comparison waits for an answered measure"));
  expect("fail-1 the TREND names the newest measure's honest hole", b.trend.includes("the newest measure heard nothing from the cluster"));
  expect("fail-1 the SILENCES clause ABSENT (the failed present alone births no hole)", b.sil === "(no silences clause)");
  const d = await drillOf("fail-1");
  expect("fail-1 the DRILL's compact count ZERO", d.count === 0);
  say(">>> beat done — relaunch the cluster bash-side (bash services/mock-cluster/launch.sh), then run birth-1.");
}

if (stage === "birth-1") {
  say("=== STAGE birth-1 — H1 BORN TRAILING IN THE ABSENT WORLD (the cluster ALREADY relaunched) ===");
  const before = ringPointsOf(readSidecar(), PID);
  if (holeIdx(before).length !== 0 || presentOf(readSidecar()) !== 0) throw new Error(`birth-1 wants the airless spoken ring — run fail-1 first`);
  const prevStamp = before[0]?.at;
  await measure("b1", prevStamp);
  const pts = ringPointsOf(readSidecar(), PID);
  expect("birth-1 the ring 12/12 (the cap holds)", pts.length === 12);
  expect("birth-1 H1 BORN TRAILING at the head with THE MIRROR'S SPOKEN ZERO IN THE HOLE CELL (the hole is ONE channel's silence)", pts[0]?.bytes === null && pts[0]?.mirrorBytes === 0);
  expect("birth-1 the ring's OLDEST end still the pure flat word", pts.at(-1)?.bytes === FLAT_B && pts.at(-1)?.mirrorBytes === FLAT_M);
  const b = await bandOf("birth-1");
  expect("birth-1 THE SINGULAR speaks with the CLUSTER'S OWN PAIR (the zeros never enter the pairs)", b.sil === `An honest silence sits in the ring's memory — ${PAIR_WORDS}.`);
  expect("birth-1 the ALL-ABSENT clause BESIDE the silences sentence (TWO clauses of ONE breath)", b.mirrorClause === "no mirrors yet — all 10 runs live on the cluster alone");
  const d = await drillOf("birth-1");
  expect("birth-1 the DRILL honestly ZERO (the trailing law — re-earned in the absent world)", d.count === 0);
  say(">>> beat done — run interior-1.");
}

if (stage === "interior-1") {
  say("=== STAGE interior-1 — the drill's first breath in the absent world ===");
  const before = ringPointsOf(readSidecar(), PID);
  if (holeIdx(before).length !== 1 || before[0]?.bytes !== null) throw new Error(`interior-1 wants H1 trailing (holes at [${holeIdx(before)}]) — run birth-1 first`);
  const prevStamp = before[0]?.at;
  await measure("i1", prevStamp);
  const pts = ringPointsOf(readSidecar(), PID);
  expect("interior-1 H1 now INTERIOR (one push in)", holeIdx(pts).length === 1 && holeIdx(pts)[0] > 0);
  const b = await bandOf("interior-1");
  expect("interior-1 the SINGULAR stays (the cluster's pair)", b.sil === `An honest silence sits in the ring's memory — ${PAIR_WORDS}.`);
  expect("interior-1 the ALL-ABSENT clause stays (the world is still vanished)", b.mirrorClause === "no mirrors yet — all 10 runs live on the cluster alone");
  const d = await drillOf("interior-1");
  expect("interior-1 THE DRILL'S FIRST BREATH IN THE ABSENT WORLD (1 honest hole in the memory)", d.count === 1 && d.row.includes("1 honest hole in the memory"));
  say(">>> beat done — kill the cluster bash-side again, then run fail-2.");
}

if (stage === "fail-2") {
  say("=== STAGE fail-2 — the singular RIDES through the failed present (the cluster ALREADY killed) ===");
  const before = ringPointsOf(readSidecar(), PID);
  if (holeIdx(before).length !== 1) throw new Error(`fail-2 wants exactly H1 interior (holes at [${holeIdx(before)}]) — run interior-1 first`);
  const prevStamp = before[0]?.at;
  await measure("f2", prevStamp);
  const pts = ringPointsOf(readSidecar(), PID);
  expect("fail-2 the ring still ONE hole (the failed present pushed the outgoing good)", holeIdx(pts).length === 1);
  expect("fail-2 the PRESENT is the honest air again", presentOf(readSidecar()) === 0);
  const b = await bandOf("fail-2");
  expect("fail-2 the SINGULAR RIDES through the failed present (the t1107 law in the absent world)", b.sil === `An honest silence sits in the ring's memory — ${PAIR_WORDS}.`);
  expect("fail-2 the ALL-ABSENT clause rides too", b.mirrorClause === "no mirrors yet — all 10 runs live on the cluster alone");
  const d = await drillOf("fail-2");
  expect("fail-2 the DRILL STAYS 1", d.count === 1);
  say(">>> beat done — relaunch the cluster bash-side, then run birth-2.");
}

if (stage === "birth-2") {
  say("=== STAGE birth-2 — H2 BORN TRAILING: THE PLURAL IN THE ABSENT WORLD (the cluster ALREADY relaunched) ===");
  const before = ringPointsOf(readSidecar(), PID);
  if (holeIdx(before).length !== 1 || presentOf(readSidecar()) !== 0) throw new Error(`birth-2 wants H1 interior + the airless present — run fail-2 first`);
  const prevStamp = before[0]?.at;
  await measure("b2", prevStamp);
  const pts = ringPointsOf(readSidecar(), PID);
  expect("birth-2 H2 BORN TRAILING at the head (the mirror's spoken zero in the hole cell again)", pts[0]?.bytes === null && pts[0]?.mirrorBytes === 0);
  expect("birth-2 H1 still interior (two holes in the ring)", holeIdx(pts).length === 2 && holeIdx(pts)[1] > 0);
  const b = await bandOf("birth-2");
  expect("birth-2 THE PLURAL IN THE ABSENT WORLD (the t1073 shape at two, the ages the clock's own)", new RegExp(`^2 honest silences sit in the ring's memory, the newest ${AGE}, the deepest ${AGE}, every one between answered measures\\.$`).test(b.sil));
  expect("birth-2 the ALL-ABSENT clause BESIDE the plural", b.mirrorClause === "no mirrors yet — all 10 runs live on the cluster alone");
  const d = await drillOf("birth-2");
  expect("birth-2 the DRILL honestly ONE beside the band's TWO (the trailing seat is the difference)", d.count === 1);
  say(">>> beat done — the camera window is OPEN (the plural + the absent world on film). Then run restore.");
}

if (stage === "restore") {
  say("=== STAGE restore — the mirrors come home (the return's own film point) ===");
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

  // THE RETURN'S OWN FILM POINT — BEFORE any measure: the live walk sees
  // home (the absent clause ALREADY GONE) while the ring holds the two
  // holes; the mirror hop speaks "unchanged" WITH a real referent (the
  // stored mirror word is the spoken zero — the t1100 guard's negative
  // space: the guard silences only the no-referent unchanged).
  const wPre = await bandOf("restore-pre");
  expect("restore-pre the ALL-ABSENT clause ALREADY GONE (the live walk sees home)", wPre.mirrorClause.startsWith("mirrors hold"));
  expect("restore-pre THE UP FACE'S FIRST BREATH (the live walk sees home BEFORE any measure — the t1104 law re-earned: the prev is the spoken zero, never air)", wPre.hop.includes(`the mirrors up ${fmtBytes(FLAT_M)}`));
  expect("restore-pre the cluster's TREND waits at the hole (the previous measure heard nothing)", wPre.trend.includes("the previous measure heard nothing"));
  expect("restore-pre the PLURAL still stands (the memory keeps its silences through the return)", new RegExp(`^2 honest silences sit in the ring's memory, the newest ${AGE}, the deepest ${AGE}, every one between answered measures\\.$`).test(wPre.sil));
  const dPre = await drillOf("restore-pre");
  expect("restore-pre the DRILL stays 1 (H2 still trailing in the ring-only dialect)", dPre.count === 1);

  // the measure — THE UP FACE SPEAKS ACROSS THE HOLE: the mirror delta's
  // prev is the hole cell's SPOKEN mirror zero (never air), so the
  // mirrors' return is SPOKEN where the cluster's own trend must wait.
  const prevStamp = ringPointsOf(readSidecar(), PID)[0]?.at;
  await measure("r1", prevStamp);
  const pts = ringPointsOf(readSidecar(), PID);
  expect("restore the ring's newest point is the OUTGOING absent word (the push law: the present's own word waits outside) — cluster flat, mirror zero", pts[0]?.bytes === FLAT_B && pts[0]?.mirrorBytes === 0);
  expect("restore the sidecar's mirrorBytesTotal is the RETURNED word", sidecarMirrorTotal(readSidecar()) === FLAT_M);
  const b = await bandOf("restore-m1");
  expect("restore THE UP FACE SPEAKS ACROSS THE ABSENT ZERO (the mirror delta's prev is the spoken zero — the two-channel verdict fork at one cell)", b.hop.includes(`the mirrors up ${fmtBytes(FLAT_M)}`));
  expect("restore the cluster's TREND speaks across the OUTGOING's answered bytes (unchanged — the push law's own shape)", b.trend.includes("unchanged"));
  expect("restore the bare mirror clause back (no naming tail)", b.mirrorClause.startsWith("mirrors hold") && !b.mirrorClause.includes("unmirrored"));
  expect("restore the PLURAL HOLDS through the return", new RegExp(`^2 honest silences sit in the ring's memory, the newest ${AGE}, the deepest ${AGE}, every one between answered measures\\.$`).test(b.sil));
  const d = await drillOf("restore-m1");
  expect("restore THE DRILL'S LAG CLOSES AT THE RETURN (1 → 2 — both holes interior now)", d.count === 2);
  say(">>> beat done — run descent.");
}

if (stage === "descent") {
  say("=== STAGE descent — the holes roll out the OLDEST edge, one beat per hole (cap 14) ===");
  const beats = [];
  let flat = false;
  for (let i = 1; i <= 14 && !flat; i++) {
    const prevStamp = ringPointsOf(readSidecar(), PID)[0]?.at;
    await measure(`d${i}`, prevStamp);
    const b = await bandOf(`d${i}`);
    const d = await drillOf(`d${i}`);
    // the count's ear: the SINGULAR's word is "An", never a digit (the
    // t1102 lesson again — the harness's own constants, never the world).
    const bandCount = b.sil === "(no silences clause)" ? 0 : b.sil.startsWith("An honest silence") ? 1 : Number(b.sil.match(/(\d+) honest silence/)?.[1] ?? 0);
    beats.push({ beat: i, band: bandCount, drill: d.count });
    say(`  descent beat ${i}: band ${bandCount} / drill ${d.count}`);
    const pts = ringPointsOf(readSidecar(), PID);
    if (holeIdx(pts).length === 0 && mirrorZeroIdx(pts).length === 0 && pts.length === 12 && pts.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M)) {
      flat = true;
      say(`  THE PUREST FLAT at beat ${i}`);
    }
  }
  expect("descent the flat LANDED within the cap", flat);
  const bandSeq = beats.map((x) => x.band);
  const monotone = bandSeq.every((c, i) => i === 0 || c <= bandSeq[i - 1]);
  expect(`descent the band's counts descend MONOTONE (${bandSeq.join(" → ")}) — the oldest hole rolls first (the t1112 edge law re-earned)`, monotone);
  expect("descent the band's counts include the TWO, the ONE and the QUIET", bandSeq[0] === 2 && bandSeq.includes(1) && bandSeq.at(-1) === 0);
  const drillSeq = beats.map((x) => x.drill);
  expect(`descent the drill's counts agree at every INTERIOR beat (${drillSeq.join(" → ")})`, drillSeq.at(-1) === 0);
  const pts = ringPointsOf(readSidecar(), PID);
  expect("descent the eviction PURGED EVERY SCAR — 12/12 all spoken, NO holes, NO mirror zeros", pts.length === 12 && holeIdx(pts).length === 0 && mirrorZeroIdx(pts).length === 0 && pts.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M));
  const bEnd = await bandOf("descent-end");
  expect("descent-end the SILENCES clause ABSENT (the purest flat says nothing)", bEnd.sil === "(no silences clause)");
  expect("descent-end the mirror hop 'unchanged' (the flat word against itself)", bEnd.hop.includes("the mirrors unchanged"));
  say(">>> the descent done — run verify.");
}

if (stage === "verify") {
  say("=== STAGE verify — the read-only as-left audit ===");
  const pts = ringPointsOf(readSidecar(), PID);
  expect("verify the ring 12/12 ALL SPOKEN both channels — THE PUREST FLAT, no zeros (cleaner than t1104's as-left)", pts.length === 12 && holeIdx(pts).length === 0 && mirrorZeroIdx(pts).length === 0 && pts.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M));
  const b = await bandOf("verify");
  expect("verify the band's bare mirror clause, no all-absent, no silences", b.mirrorClause.startsWith("mirrors hold") && b.sil === "(no silences clause)");
  expect("verify the mirror hop 'unchanged'", b.hop.includes("the mirrors unchanged"));
  expect("verify the share's weather holding", b.ceilingClause.includes("the share holding across the reach"));
  const d = await drillOf("verify");
  expect("verify the DRILL's compact count ZERO", d.count === 0);
  expect("verify the sidecar's mirrorBytesTotal the flat word", sidecarMirrorTotal(readSidecar()) === FLAT_M);
  say("VERIFY done — the as-left world: all mirrors home, the ring remembering NOTHING of the ride.");
}

// the measure's SSH pool keeps the event loop alive after the stage's
// verdicts are printed — the t1104 law (each stage EXITS explicitly).
// The verdicts are in the log; rc 0 means the stage's own asserts spoke.
process.exit(0);
