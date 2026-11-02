// t1110-walk-silences-ride.mjs — THE WALK-FAILED WORLD'S SILENCES FACE
// (Task 1110). The t1109 band's silences seat rides its STRESS world:
// the ring holds a qualifying CLUSTER hole (born the t1107 way — one
// stop-cluster + one relaunch apart) AND the local walk fails (the
// t1102 trigger — chmod 000 the project's relion dir). THE CLAIM UNDER
// FILM: the silences are CLUSTER-side facts (the walk reads the CLUSTER
// series only — seq[i].bytes), so the walk's failure must never silence
// the sentence, and the sentence must never FAKE a silence from the
// walk's own mirror-nulls. The COEXISTENCE: the band speaks the delta's
// waits-words (mirror-side) AND the silences sentence (cluster-side) in
// ONE band; the drill's compact count agrees beside them.
//
//   birth-a  — (the cluster ALREADY killed bash-side) one measure:true:
//              the failed present's three honest faces (the cluster
//              never answered / the policy comparison waits for an
//              answered measure / the silences clause ABSENT — the
//              t1109 absence face) and the ring UNTOUCHED (the push law:
//              the failed measure pushes nothing yet).
//   birth-b  — (the cluster ALREADY relaunched bash-side) one
//              measure:true: the failed point pushed INTERIOR — the
//              SINGULAR born (the band + the drill's compact count
//              agree: 1 honest hole in the memory).
//   coexist  — chmod 000 → the COEXISTENCE face: the unreadable mirror
//              clause, the ceiling's gate, the delta's waits-words, and
//              the SINGULAR STAYS (faithfulness: the count word matches
//              the well over the fresh ring + the sizes-sum present; the
//              walk's failure added no fake silence) + the drill's
//              compact count unchanged. RESTORES 775 in finally.
//   rollout  — ten measures: F1 drifts to the draw-order's OLDEST edge
//              → the sentence quiets (the edge law, live); one more
//              measure evicts F1 → the ring 12/12 ALL SPOKEN both
//              channels, one distinct value per channel — the purest
//              flat restored, the world as found (mode 775).
//
// TRUST THE WORDS — every check reads the mouths' OWN summaries (never
// a re-implementation); the sidecar's ring is the cross-check; the flat
// constants come from the CONNECTION ROW's last spoken words (READ
// FRESH, NAME THE ENDS, NEVER ASSUME — the t1102 lesson). The write is
// the truth, the response's silence is transport: a timed-out measure
// is polled on the sidecar before it is mourned.
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson).
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(ROOT, "src") },
});

const SIDECAR = path.join(ROOT, "data", "remote-fleet-ledger.json");
const WATCHDOG_MS = 120_000;

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

const modeOf = (dir) => (statSync(dir).mode & 0o777).toString(8).padStart(3, "0");
const chmodDir = (dir, mode) => {
  execSync(`chmod ${mode} "${dir}"`);
  say(`chmod ${mode} ${dir} (now ${modeOf(dir)})`);
};

say("importing the shelf…");
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const { fmtBytes } = await __jiti.import("../src/lib/relion/disk-usage.ts");
const { fleetTrendHoleCount, fleetTrendHoleSummary } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const project = await db.project.findFirst({
  where: { name: "β-Galactosidase Tutorial (demo)" },
  select: { id: true, name: true },
});
if (!project) throw new Error("demo project not found — the world is not the expected one");
await db.$disconnect();
say(`project: ${project.id} "${project.name}"`);

const PROJECT_DIR = path.join(ROOT, "data", "relion", project.id);
const AS_FOUND_MODE = "775";
const ctx = { projectId: project.id };

// the measure's write-is-the-truth wrapper: await the dispatch; on a
// watchdog timeout, poll the sidecar for a FRESH present stamp before
// mourning (the t1109 law — the response's silence is transport).
const measure = async (label, prevStamp) => {
  try {
    await withWatchdog(`measure ${label}`, executeAiTool("get_fleet_ledger", { measure: true }, ctx));
    say(`measure ${label} ok (the dispatch answered)`);
  } catch (e) {
    say(`measure ${label}: the dispatch did not answer (${e.message.slice(0, 60)}) — polling the sidecar (the write is the truth)`);
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2_000));
      const pts = ringPointsOf(readSidecar(), project.id);
      if (pts[0]?.at && pts[0].at !== prevStamp) {
        say(`measure ${label} LANDED (the sidecar stamped ${pts[0].at})`);
        return;
      }
    }
    throw new Error(`measure ${label}: no sidecar stamp within 60s of the timeout`);
  }
};

// the BAND witness: the faces out of the mouths' own summaries
const bandOf = async (label) => {
  const r = await withWatchdog(`band ${label}`, executeAiTool("get_fleet_ledger", {}, ctx));
  const summary = r?.summary ?? "";
  const band = summary.split(" | ")[0] ?? "";
  const mirrorClause = band.match(/ · (mirrors hold [^·]*?|the mirror side unreadable[^·]*?|no mirrors yet[^·]*?) ·/)?.[1] ?? "(NO MIRROR CLAUSE)";
  const ceilingClause = band.match(/sync ceiling [^·]*/)?.[0] ?? "(NO CEILING CLAUSE)";
  const hop = band.match(/ · the mirrors (up|down|unchanged)[^·]*/)?.[0] ?? "(HOP SILENT)";
  const delta = band.match(/\d[\d.]* [KMG]B lives only on the cluster[^·]*|the policy comparison waits[^·]*/)?.[0] ?? "(NO DELTA)";
  const trend = band.match(/ · (up|down|unchanged) [^·]*| · the (newest|previous) measure heard nothing[^·]*| · the trend begins[^·]*/)?.[0] ?? "(NO TREND)";
  // the sentence's span: between the delta's period and ' Heaviest' —
  // a [^.]* walk dies at the FIRST period inside fmtBytes' '1.33 GB'
  // (the t1110 lesson: the byte-words carry their own periods).
  const sil = band.match(/(An honest silence[\s\S]*?) Heaviest workdir/)?.[1] ?? "(no silences clause)";
  say(`[${label}] MIRROR: ${mirrorClause}`);
  say(`[${label}] CEILING: ${ceilingClause}`);
  say(`[${label}] DELTA: ${delta}`);
  say(`[${label}] TREND: ${trend}`);
  say(`[${label}] SILENCES: ${sil}`);
  return { summary, band, mirrorClause, ceilingClause, hop, delta, trend, sil };
};
// the DRILL witness: the compact count beside the band's sentence
const drillOf = async (label) => {
  const r = await withWatchdog(`drill ${label}`, executeAiTool("get_fleet_memory", {}, ctx));
  const summary = r?.summary ?? "";
  const row = summary.match(/Mock Cluster: ring [^|]*/)?.[0]?.trim() ?? "(NO ROW)";
  say(`[${label}] DRILL ROW: ${row}`);
  return { summary, row };
};
const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);

const restore = (why) => {
  if (modeOf(PROJECT_DIR) !== AS_FOUND_MODE) {
    chmodDir(PROJECT_DIR, AS_FOUND_MODE);
    say(`RESTORED (${why})`);
  }
};

const stage = process.argv[2];
if (!stage || !["birth-a", "birth-b", "coexist", "rollout"].includes(stage)) {
  console.error("usage: node scripts/t1110-walk-silences-ride.mjs <birth-a|birth-b|coexist|rollout>");
  process.exit(2);
}

// --- the as-found ring constants (READ FRESH, NAME THE ENDS) ---
// THE T1102 LAW, re-learned at the gate itself: the flat constants come
// from the CONNECTION ROW's last spoken words — never from the ring's
// HEAD (the head may be the birth's own trailing hole: the coexist and
// rollout stages arrive POST-birth, the world intentionally holed).
const asFound = ringPointsOf(readSidecar(), project.id);
const sidecar0 = readSidecar();
const conn0 = connOf(sidecar0, project.id);
const FLAT_B = asFound.find((p) => p.bytes != null)?.bytes;
const FLAT_M = conn0?.mirrorBytesTotal;
const CEILING = conn0?.syncCeilingBytes;
if (asFound.length !== 12 || FLAT_B == null || FLAT_M == null) {
  throw new Error(`the as-found world is not the expected 12-point ring with spoken words (len ${asFound.length})`);
}
say(`as-found ring: 12/12 (head ${asFound[0]?.bytes == null ? "the birth's trailing hole" : "spoken"}), cluster flat word ${FLAT_B} (${fmtBytes(FLAT_B)}), mirror ${FLAT_M} (${fmtBytes(FLAT_M)}), ceiling ${CEILING}`);
// the well's count over the as-found ring + the sizes-sum present: the
// flat world says NOTHING (count 0). If the world arrives holed, the
// birth stages refuse — the ride wants the purest flat as its ground.
const presentOf = (sidecar) => {
  const sizes = connOf(sidecar, project.id)?.sizes ?? {};
  return Object.values(sizes).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
};
// the purest-flat gate binds ONLY birth-a (the ground the birth needs);
// coexist and rollout arrive POST-birth — the world intentionally wears
// its one honest hole, and the gate must not mourn the film's subject.
const asFoundCount = fleetTrendHoleCount({ history: asFound, currentBytes: presentOf(readSidecar()) });
if (stage === "birth-a" && asFoundCount !== 0) {
  throw new Error(`the as-found ring already holds ${asFoundCount} qualifying silences — the birth wants the purest flat`);
}

if (stage === "birth-a") {
  say("=== STAGE birth-a — the failed present (the cluster ALREADY killed bash-side) ===");
  const prevStamp = ringPointsOf(readSidecar(), project.id)[0]?.at;
  await measure("A", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  // THE WORLD CORRECTED THE MODEL (the t1108 lesson's third ride): the
  // failed measure STILL PUSHES the outgoing — the push law never
  // pauses. The outgoing here is the as-found PRESENT (good words,
  // stamped with the present's own stamp — a stamp the ring never held
  // in-ring), so the honest claim is the ring's WORDS, never a stamp
  // equality: 12 points, every one SPOKEN, both channels the flat word,
  // NO null anywhere (the air's own shape stays out of the ring).
  expect("birth-a THE PUSH LAW NEVER PAUSES — the failed measure pushed the OUTGOING good (12/12 all spoken both channels, no null — the air stays out)", pts.length === 12 && pts.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M));
  const b = await bandOf("birth-a");
  expect("birth-a the cluster NEVER ANSWERED (the honest hole headline)", b.band.includes("the cluster never answered at the last measure (an honest hole)"));
  expect("birth-a the DELTA waits for an ANSWERED measure (the walk spoke — the wait is the cluster's)", b.delta.startsWith("the policy comparison waits for an answered measure"));
  expect("birth-a the TREND names the newest measure's honest hole", b.trend.includes("the newest measure heard nothing from the cluster"));
  expect("birth-a the SILENCES clause ABSENT (the t1109 absence face — the failed present alone births no hole)", b.sil === "(no silences clause)");
  const d = await drillOf("birth-a");
  expect("birth-a the DRILL's compact count ZERO (no honest hole in the memory)", !d.row.includes("honest hole"));
  say(">>> beat A done — relaunch the cluster bash-side (launch.sh), then run birth-b.");
}

if (stage === "birth-b") {
  say("=== STAGE birth-b — the good push (the cluster ALREADY relaunched bash-side) ===");
  const prev = ringPointsOf(readSidecar(), project.id);
  const prevStamp = prev[0]?.at;
  await measure("B", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  expect("birth-b the ring 12/12 (the cap holds)", pts.length === 12);
  // THE WORLD CORRECTED THE MODEL (the fourth shape): the push puts the
  // OUTGOING at the ring's HEAD — the failed point IS the ring's newest
  // point; the new present never enters the ring (it closes the line
  // from OUTSIDE — the docblock's own law). F1 is the TRAILING hole.
  expect("birth-b F1 at the RING'S HEAD (the outgoing IS the newest — cluster null, mirror the spoken word)", pts[0]?.bytes == null && pts[0]?.mirrorBytes === FLAT_M);
  expect("birth-b the outgoing good right beneath (index 1 both channels the flat word)", pts[1]?.bytes === FLAT_B && pts[1]?.mirrorBytes === FLAT_M);
  expect("birth-b the PRESENT SPOKEN outside the ring (the sizes sum is the good measure's word)", presentOf(readSidecar()) === FLAT_B);
  const b = await bandOf("birth-b");
  expect("birth-b THE SINGULAR BORN in the band", b.sil.startsWith("An honest silence sits in the ring's memory — The measures on either side read"));
  // faithfulness: the band's sentence is the WELL's sentence over the
  // fresh ring + the sizes-sum present (the band never re-implements)
  const fresh = ringPointsOf(readSidecar(), project.id);
  const well = fleetTrendHoleSummary({ history: fresh, currentBytes: presentOf(readSidecar()), fmtBytes, stampAgo: (iso) => iso });
  expect("birth-b the band's sentence === the well's sentence (ONE walk, no fork)", well != null && b.sil === well);
  const d = await drillOf("birth-b");
  // THE TRAILING LAW, LIVE (the t1092 law through the band's seat): the
  // drill reads the RING ALONE — a hole at the ring's newest end has no
  // newer reading and does not qualify; the band speaks it BECAUSE the
  // answered present closes the line. The two dialects are both honest:
  // the compact count stays ZERO while the sentence speaks.
  expect("birth-b the DRILL's compact count ZERO (the trailing law — the ring-only walk never sees the present-closed hole)", !/\d honest holes? in the memory/.test(d.row));
  say(">>> beat B done — the world wears its honest hole. Run coexist (it restores its own chmod).");
}

if (stage === "coexist") {
  say("=== STAGE coexist — the walk fails BESIDE the born silence (restores its own chmod) ===");
  const m0 = modeOf(PROJECT_DIR);
  if (m0 !== AS_FOUND_MODE) {
    say(`unexpected as-found mode ${m0} — restoring ${AS_FOUND_MODE} first`);
    chmodDir(PROJECT_DIR, AS_FOUND_MODE);
  }
  try {
    chmodDir(PROJECT_DIR, "000");
    const before = ringPointsOf(readSidecar(), project.id);
    const b = await bandOf("coexist");
    expect("coexist the MIRROR clause reads the unreadable face", b.mirrorClause.startsWith("the mirror side unreadable — the local walk failed, so the mirror faces are unverified"));
    expect("coexist the CEILING's gate ('the share waits for a spoken mirror walk')", b.ceilingClause.startsWith(`sync ceiling ${fmtBytes(CEILING)} (the share waits for a spoken mirror walk)`));
    expect("coexist the DELTA waits for a SPOKEN MIRROR WALK (the mirror-side wait)", b.delta.startsWith("the policy comparison waits for a spoken mirror walk"));
    expect("coexist THE SILENCES SENTENCE STAYS (the cluster-side memory is not the walk's subject)", b.sil.startsWith("An honest silence sits in the ring's memory"));
    expect("coexist no FAKE silence (exactly one — the walk's failure added none)", !b.band.includes("2 honest silences") && !b.band.includes("3 honest silences"));
    // faithfulness under the broken walk: the well over the fresh ring
    // + the sizes-sum present says ONE — the band agrees
    const fresh = ringPointsOf(readSidecar(), project.id);
    const count = fleetTrendHoleCount({ history: fresh, currentBytes: presentOf(readSidecar()) });
    expect("coexist the well's count over the fresh ring + the answered present is ONE", count === 1);
    expect("coexist the band's sentence === the well's sentence (the count word agrees whatever the walk wears)", b.sil.startsWith("An honest silence") && count === 1);
    const d = await drillOf("coexist");
    expect("coexist the DRILL's compact count STILL ZERO (the trailing law holds through the broken walk — the compact count never saw this hole; the row's '(an honest hole)' is the TREND clause's own word)", !/\d honest holes? in the memory/.test(d.row));
    expect("coexist the ring UNTOUCHED (no measure rode the broken window)", (() => { const pts = ringPointsOf(readSidecar(), project.id); return pts.length === 12 && pts[0]?.at === before[0]?.at && pts[0]?.bytes == null; })());
  } finally {
    restore("stage coexist's own law");
  }
  expect("coexist the world RESTORED (mode 775)", modeOf(PROJECT_DIR) === AS_FOUND_MODE);
  say(">>> beat C done — the coexistence is on film. Run rollout to purge the scar.");
}

if (stage === "rollout") {
  say("=== STAGE rollout — eleven measures walk F1 to the edge, one more evicts it ===");
  restore("stage rollout's entry safety");
  const prevStamp = ringPointsOf(readSidecar(), project.id)[0]?.at;
  // F1 starts at the ring's HEAD (index 0 — the trailing hole); each
  // measure pushes one point, so after k measures F1 sits at index k.
  // Eleven measures walk it to index 11 — the draw-order's OLDEST end
  // (no older neighbor → the edge law quiets the sentence); the twelfth
  // evicts it. The drill's ring-only count meanwhile rides its own life
  // cycle: 0 (trailing) → 1 (interior) → … → 1 → 0 (the edge).
  for (let i = 1; i <= 11; i++) await measure(`p${i}`, ringPointsOf(readSidecar(), project.id)[0]?.at ?? prevStamp);
  let pts = ringPointsOf(readSidecar(), project.id);
  expect("rollout F1 at the draw-order's OLDEST edge (index 11 — no older neighbor)", pts.length === 12 && pts[11]?.bytes == null && pts.slice(0, 11).every((p) => p.bytes != null));
  const bEdge = await bandOf("rollout-edge");
  expect("rollout the sentence QUIET at the edge (the trailing law's mirror face — the t1108 law live)", bEdge.sil === "(no silences clause)");
  const dEdge = await drillOf("rollout-edge");
  expect("rollout the DRILL's compact count quiet at the edge too (the ring-only walk reads only holes)", !/\d honest holes? in the memory/.test(dEdge.row));
  await measure("p11", ringPointsOf(readSidecar(), project.id)[0]?.at);
  pts = ringPointsOf(readSidecar(), project.id);
  expect("rollout F1 EVICTED — the ring 12/12 ALL SPOKEN both channels", pts.length === 12 && pts.every((p) => p.bytes != null && p.mirrorBytes != null));
  expect("rollout the PUREST FLAT (one distinct value per channel, the as-found words)", pts.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M));
  const b = await bandOf("rollout-flat");
  expect("rollout the SILENCES clause ABSENT (the t1109 absence face closes the film)", b.sil === "(no silences clause)");
  expect("rollout the MIRROR clause normal (the walk speaks)", b.mirrorClause.startsWith(`mirrors hold ${fmtBytes(FLAT_M)} here`));
  expect("rollout no unreadable / waits-words anywhere", !b.band.includes("unreadable") && !b.band.includes("waits for a spoken mirror walk"));
  expect("rollout the world AS FOUND (mode 775)", modeOf(PROJECT_DIR) === AS_FOUND_MODE);
  say(">>> the scar is purged — the world wears its purest flat again.");
}

say("stage done.");
process.exit(0);
