// t1111-plural-return-ride.mjs — THE PLURAL'S RETURN THROUGH THE
// TRAILING BIRTH (Task 1111). The t1110 candidate ridden LIVE: TWO
// failed measures, one relaunch apart, and the plural that both births
// build — the drill's ring-only compact count riding 0 → 1 → 2 while
// the band speaks the ages. THE CLAIM UNDER FILM: a hole born trailing
// (the push law's own birth — the failed present pushed in by the NEXT
// measure) is the band's word FIRST (the answered present closes the
// line) and the drill's word exactly ONE PUSH LATER (the ring-only walk
// reads only holes; the trailing seat has no newer reading yet) — the
// two dialects honestly disagree at every trailing birth and re-agree
// once the push carries the hole interior. THE LIFE CYCLE, one breath:
// the singular's birth (trailing), the drill's first breath (the lag
// closes), the second trailing birth (the PLURAL, the t1073 second age
// on TWO trailing-born holes — t1108's plural rode an old interior +
// a newborn; THIS one's both ends were born trailing), the drill's
// honest 1-beside-2, the lag's close (2 beside 2), then the descent:
// the deepest hole rolls to the OLDEST edge and the plural hands down
// to the singular (the edge law, live), the last hole edges out to the
// quiet, the eviction restores the PUREST FLAT.
//
//   birth-1    — (the cluster ALREADY killed bash-side) the SECOND
//                failed measure's birth (the t1110 shape repeated as
//                the ride's first rung): the push law never pauses, the
//                failed present's three honest faces, the silences
//                clause ABSENT, the drill 0.
//   birth-2    — (the cluster ALREADY relaunched) H1 BORN TRAILING: the
//                singular (the pair rides), the drill honestly ZERO
//                (the trailing law).
//   interior-1 — one measure: H1 interior — THE DRILL'S FIRST BREATH
//                (1 honest hole in the memory): the trailing hole joins
//                the drill's count exactly one push after the band
//                first spoke it (THE DRILL'S ONE-MEASURE LAG).
//   birth-3    — (the cluster ALREADY killed AGAIN) the singular STAYS
//                beside the failed faces (the interior hole qualifies
//                regardless of the present — the t1107 law), drill 1.
//   birth-4    — (the cluster ALREADY relaunched) H2 BORN TRAILING: THE
//                PLURAL (the t1073 second age on two trailing-born
//                holes), the drill honestly ONE beside the band's TWO
//                (the trailing seat is the difference).
//   interior-2 — one measure: H2 interior — the lag CLOSES: the drill's
//                own plural (2 honest holes in the memory), the two
//                dialects re-agreed.
//   rollout    — eleven measures: k=1..6 the plural stands (the drill's
//                2 beside the band's 2); k=7 the DEEPEST hole reaches
//                the draw-order's OLDEST edge and the plural hands down
//                to the singular (the edge law, live); k=8..9 the
//                singular stands; k=10 the LAST hole edges out — the
//                clause QUIETS (the t1108 arithmetic's mirror face);
//                k=11 the eviction — the ring 12/12 ALL SPOKEN both
//                channels, ONE distinct value per channel, the PUREST
//                FLAT restored, the world as found.
//
// TRUST THE WORDS — every check reads the mouths' OWN summaries (never
// a re-implementation); the sidecar's ring is the cross-check; the flat
// constants come from the CONNECTION ROW's last spoken words (READ
// FRESH, NAME THE ENDS, NEVER ASSUME — the t1102 law; the gate must not
// mourn the film's subject, so only birth-1 demands the purest flat).
// The write is the truth, the response's silence is transport: a
// timed-out measure is polled on the sidecar before it is mourned.
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson).
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync } from "node:fs";

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

say("importing the shelf…");
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const { fmtBytes } = await __jiti.import("../src/lib/relion/disk-usage.ts");
const { fleetTrendHoleCount, fleetTrendHoleSummary } = await __jiti.import("../src/lib/remote/fleet-trend.ts");

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

// the BAND witness: the faces out of the mouths' own summaries. The
// silences span's own law: a [^.]* walk DIES at the first period inside
// fmtBytes' "1.33 GB" (the t1110 lesson — the byte-words carry their
// own periods), and the span must hear the PLURAL too (this film's
// subject): "An honest silence …" OR "N honest silences …".
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
  say(`[${label}] DELTA: ${delta}`);
  say(`[${label}] TREND: ${trend}`);
  say(`[${label}] SILENCES: ${sil}`);
  return { summary, band, mirrorClause, ceilingClause, hop, delta, trend, sil };
};
// the DRILL witness: the compact count beside the band's sentence —
// the row's own dialect ("N honest holes in the memory", the ring-only
// walk: fleetTrendHoleCount({history, currentBytes: null})).
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
// The mirror channel's nulls are NOT silences holes (the t1110 law —
// the memory's silences are the cluster side's facts).
const holeIdx = (pts) => pts.map((p, i) => (p.bytes == null ? i : -1)).filter((i) => i >= 0);
const presentOf = (sidecar) => {
  const sizes = connOf(sidecar, project.id)?.sizes ?? {};
  return Object.values(sizes).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
};

const stage = process.argv[2];
if (!stage || !["birth-1", "birth-2", "interior-1", "birth-3", "birth-4", "interior-2", "rollout"].includes(stage)) {
  console.error("usage: node scripts/t1111-plural-return-ride.mjs <birth-1|birth-2|interior-1|birth-3|birth-4|interior-2|rollout>");
  process.exit(2);
}

// --- the as-found constants (READ FRESH, NAME THE ENDS — the t1102
// law: the flat words come from the CONNECTION ROW's last spoken words,
// never from the ring's HEAD — the post-birth stages arrive with the
// world intentionally holed, and the gate must not mourn the subject) ---
const sidecar0 = readSidecar();
const asFound = ringPointsOf(sidecar0, project.id);
const conn0 = connOf(sidecar0, project.id);
const FLAT_B = asFound.find((p) => p.bytes != null)?.bytes;
const FLAT_M = conn0?.mirrorBytesTotal;
const CEILING = conn0?.syncCeilingBytes;
if (asFound.length !== 12 || FLAT_B == null || FLAT_M == null) {
  throw new Error(`the as-found world is not the expected 12-point ring with spoken words (len ${asFound.length})`);
}
const holes0 = holeIdx(asFound);
say(`as-found ring: 12 pts, holes at [${holes0}] (cluster-side), present ${presentOf(sidecar0)} (${presentOf(sidecar0) === FLAT_B ? "the flat word" : "null/other"}), cluster flat word ${FLAT_B} (${fmtBytes(FLAT_B)}), mirror ${FLAT_M} (${fmtBytes(FLAT_M)}), ceiling ${CEILING}`);
// the purest-flat gate binds ONLY birth-1 (the ground the birth needs).
if (stage === "birth-1" && holes0.length !== 0) {
  throw new Error(`the as-found ring already holds holes at [${holes0}] — the birth wants the purest flat`);
}

if (stage === "birth-1") {
  say("=== STAGE birth-1 — the SECOND failed measure (the cluster ALREADY killed bash-side) ===");
  const prevStamp = ringPointsOf(readSidecar(), project.id)[0]?.at;
  await measure("A", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  // THE PUSH LAW NEVER PAUSES (the t1110 law, repeated as the ride's
  // first rung): the failed measure pushed the OUTGOING good — the ring
  // stays 12/12 all spoken BOTH channels, the air stays out.
  expect("birth-1 THE PUSH LAW NEVER PAUSES — the failed measure pushed the OUTGOING good (12/12 all spoken both channels, no null)", pts.length === 12 && holeIdx(pts).length === 0 && pts.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M));
  expect("birth-1 the PRESENT is the honest air (the sizes sum is null — all probes refused)", presentOf(readSidecar()) === 0);
  const b = await bandOf("birth-1");
  expect("birth-1 the cluster NEVER ANSWERED (the honest hole headline)", b.band.includes("the cluster never answered at the last measure (an honest hole)"));
  expect("birth-1 the DELTA waits for an ANSWERED measure", b.delta.startsWith("the policy comparison waits for an answered measure"));
  expect("birth-1 the TREND names the newest measure's honest hole", b.trend.includes("the newest measure heard nothing from the cluster"));
  expect("birth-1 the SILENCES clause ABSENT (the failed present alone births no hole — the t1109 absence face)", b.sil === "(no silences clause)");
  const d = await drillOf("birth-1");
  expect("birth-1 the DRILL's compact count ZERO", d.count === 0);
  say(">>> beat 1 done — relaunch the cluster bash-side (launch.sh), then run birth-2.");
}

if (stage === "birth-2") {
  say("=== STAGE birth-2 — H1 BORN TRAILING (the cluster ALREADY relaunched bash-side) ===");
  const before = ringPointsOf(readSidecar(), project.id);
  if (holeIdx(before).length !== 0) throw new Error(`birth-2 wants the airless ring (holes at [${holeIdx(before)}] — run birth-1 first)`);
  const prevStamp = before[0]?.at;
  await measure("B", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  expect("birth-2 the ring 12/12 (the cap holds)", pts.length === 12);
  // THE TRAILING BIRTH (the t1110 law's fourth shape): the push puts the
  // OUTGOING (the failed present) at the ring's HEAD — the failed point
  // IS the ring's newest point; the new present never enters the ring
  // (it closes the line from OUTSIDE). The half-hole law: the hole is
  // CLUSTER-side only — the mirror cell keeps the walk's word.
  expect("birth-2 H1 at the RING'S HEAD (the trailing birth — cluster null, mirror the spoken word)", pts[0]?.bytes == null && pts[0]?.mirrorBytes === FLAT_M);
  expect("birth-2 the outgoing good right beneath (index 1 both channels the flat word)", pts[1]?.bytes === FLAT_B && pts[1]?.mirrorBytes === FLAT_M);
  expect("birth-2 exactly ONE hole (the film's first rung, no stray scars)", holeIdx(pts).length === 1);
  expect("birth-2 the PRESENT SPOKEN outside the ring (the sizes sum is the good measure's word)", presentOf(readSidecar()) === FLAT_B);
  const b = await bandOf("birth-2");
  expect("birth-2 THE SINGULAR BORN in the band (the pair rides)", b.sil.startsWith("An honest silence sits in the ring's memory — The measures on either side read"));
  expect("birth-2 the pair carries the flat word twice", b.sil.includes(`${fmtBytes(FLAT_B)} → ${fmtBytes(FLAT_B)}`));
  // faithfulness: the band's sentence is the WELL's sentence over the
  // fresh ring + the sizes-sum present (ONE walk, no fork). The
  // singular's sentence never fires the stamp dialect — byte-for-byte.
  const fresh = ringPointsOf(readSidecar(), project.id);
  const well = fleetTrendHoleSummary({ history: fresh, currentBytes: presentOf(readSidecar()), fmtBytes, stampAgo: (iso) => iso });
  expect("birth-2 the band's sentence === the well's sentence (ONE walk, no fork)", well != null && b.sil === well);
  const d = await drillOf("birth-2");
  // THE TRAILING LAW, LIVE: the drill reads the RING ALONE — a hole at
  // the ring's newest end has no newer reading and does not qualify;
  // the band speaks it BECAUSE the answered present closes the line.
  expect("birth-2 the DRILL's compact count ZERO (the trailing law — the ring-only walk never sees the present-closed hole)", d.count === 0);
  say(">>> beat 2 done — H1 wears its trailing seat. Run interior-1 (the cluster stays up).");
}

if (stage === "interior-1") {
  say("=== STAGE interior-1 — one measure carries H1 interior (the cluster stays up) ===");
  const before = ringPointsOf(readSidecar(), project.id);
  const h = holeIdx(before);
  if (!(h.length === 1 && h[0] === 0)) throw new Error(`interior-1 wants H1 at the HEAD (holes at [${h}] — run birth-2 first)`);
  const prevStamp = before[0]?.at;
  await measure("I1", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  expect("interior-1 H1 INTERIOR at index 1 (the push carried it in)", holeIdx(pts).length === 1 && pts[1]?.bytes == null && pts[1]?.mirrorBytes === FLAT_M);
  expect("interior-1 the head spoken again (the new measure's word)", pts[0]?.bytes === FLAT_B && pts[0]?.mirrorBytes === FLAT_M);
  const b = await bandOf("interior-1");
  expect("interior-1 the SINGULAR STAYS (the pair rides — H1's neighbors both the flat word)", b.sil.startsWith("An honest silence sits in the ring's memory — The measures on either side read"));
  const d = await drillOf("interior-1");
  // THE DRILL'S ONE-MEASURE LAG (this film's first new law): the
  // trailing hole joins the drill's count exactly ONE PUSH after the
  // band first spoke it — the interior seat has both in-ring
  // neighbors, the ring-only walk qualifies it at last. The two
  // dialects RE-AGREE at 1.
  expect("interior-1 THE DRILL'S FIRST BREATH — 1 honest hole in the memory (the lag closed: one push after the band's first word)", d.count === 1);
  say(">>> beat 3 done — the drill sees the hole. Stop the cluster bash-side again, then run birth-3.");
}

if (stage === "birth-3") {
  say("=== STAGE birth-3 — the SECOND failed measure beside the born silence (the cluster ALREADY killed bash-side) ===");
  const before = ringPointsOf(readSidecar(), project.id);
  const h = holeIdx(before);
  if (!(h.length === 1 && h[0] > 0)) throw new Error(`birth-3 wants H1 INTERIOR (holes at [${h}] — run interior-1 first)`);
  const prevStamp = before[0]?.at;
  await measure("C", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  expect("birth-3 the push never pauses — the outgoing good at the head, H1 carried deeper", holeIdx(pts).length === 1 && pts[0]?.bytes === FLAT_B && holeIdx(pts)[0] >= 1 && holeIdx(pts)[0] <= 11);
  expect("birth-3 the PRESENT is the honest air again", presentOf(readSidecar()) === 0);
  const b = await bandOf("birth-3");
  expect("birth-3 the failed headline beside the sentence (the t1107 law — the interior hole qualifies regardless of the present)", b.band.includes("the cluster never answered at the last measure (an honest hole)") && b.sil.startsWith("An honest silence sits in the ring's memory"));
  expect("birth-3 the DELTA waits for an ANSWERED measure (the present's air)", b.delta.startsWith("the policy comparison waits for an answered measure"));
  const d = await drillOf("birth-3");
  expect("birth-3 the DRILL's count STAYS 1 (the interior hole is the drill's own fact — the present's air moves it not)", d.count === 1);
  say(">>> beat 4 done — the singular rides through the failed present. Relaunch the cluster bash-side, then run birth-4.");
}

if (stage === "birth-4") {
  say("=== STAGE birth-4 — H2 BORN TRAILING: THE PLURAL (the cluster ALREADY relaunched bash-side) ===");
  const before = ringPointsOf(readSidecar(), project.id);
  const h = holeIdx(before);
  if (!(h.length === 1 && h[0] > 0 && presentOf(readSidecar()) === 0)) {
    throw new Error(`birth-4 wants H1 interior + the failed present (holes at [${h}], present ${presentOf(readSidecar())} — run birth-3 first)`);
  }
  const prevStamp = before[0]?.at;
  await measure("D", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  const h2 = holeIdx(pts);
  expect("birth-4 H2 at the RING'S HEAD (the second trailing birth), H1 interior beneath", h2.length === 2 && h2[0] === 0 && h2[1] > 1 && pts[0]?.mirrorBytes === FLAT_M);
  expect("birth-4 the PRESENT SPOKEN outside the ring (the good measure closes the line)", presentOf(readSidecar()) === FLAT_B);
  const b = await bandOf("birth-4");
  // THE PLURAL BORN THROUGH THE TRAILING BIRTH: the t1073 second age on
  // TWO trailing-born holes — t1108's plural rode an OLD interior hole
  // plus a newborn; THIS plural's both ends were born the push law's
  // same birth. The newborn's age is the film's own word: just now.
  expect("birth-4 THE PLURAL BORN — 2 honest silences, the newborn named", /^2 honest silences sit in the ring's memory, the newest just now, the deepest (just now|\d+[hm] ago), every one between answered measures\.$/.test(b.sil));
  // faithfulness: the count word is the WELL's count over the fresh
  // ring + the present (the band never re-implements the walk; the age
  // words are the band's own graveAgeLike — the FORM is the check).
  const fresh = ringPointsOf(readSidecar(), project.id);
  const wellCount = fleetTrendHoleCount({ history: fresh, currentBytes: presentOf(readSidecar()) });
  expect("birth-4 the band's count word === the well's count (ONE walk, no fork)", wellCount === 2);
  const d = await drillOf("birth-4");
  // THE TWO DIALECTS HONESTLY DISAGREE at the plural's birth: the band
  // speaks TWO (the trailing H2 qualifies through the answered
  // present), the drill speaks ONE (the ring-only walk sees H1 alone).
  // Both honest — the trailing seat is the difference. (The t1110
  // birth-b filmed this at the singular; the plural wears it now.)
  expect("birth-4 the DRILL honestly ONE beside the band's TWO (the trailing seat is the difference)", d.count === 1);
  say(">>> beat 5 done — the plural stands on two trailing births. Run interior-2 (the cluster stays up).");
}

if (stage === "interior-2") {
  say("=== STAGE interior-2 — one measure carries H2 interior (the cluster stays up) ===");
  const before = ringPointsOf(readSidecar(), project.id);
  const h = holeIdx(before);
  if (!(h.length === 2 && h[0] === 0)) throw new Error(`interior-2 wants H2 at the HEAD + H1 interior (holes at [${h}] — run birth-4 first)`);
  const prevStamp = before[0]?.at;
  await measure("I2", prevStamp);
  const pts = ringPointsOf(readSidecar(), project.id);
  const h2 = holeIdx(pts);
  expect("interior-2 BOTH holes INTERIOR (H2 at index 1, H1 deeper)", h2.length === 2 && h2[0] === 1 && h2[1] > 2 && pts[1]?.bytes == null && pts[1]?.mirrorBytes === FLAT_M);
  const b = await bandOf("interior-2");
  expect("interior-2 the PLURAL STAYS (the ages re-stamped — the newborn's just-now fades honestly)", /^2 honest silences sit in the ring's memory, the newest (just now|\d+[hm] ago), the deepest (just now|\d+[hm] ago), every one between answered measures\.$/.test(b.sil));
  const d = await drillOf("interior-2");
  // THE LAG CLOSES AT THE PLURAL: both holes interior — the drill's
  // own plural ("2 honest holes in the memory"), the two dialects
  // re-agreed. The count's whole life in one film: 0 → 1 → 2.
  expect("interior-2 THE DRILL'S OWN PLURAL — 2 honest holes in the memory (the lag closed; the dialects re-agree)", d.count === 2);
  say(">>> beat 6 done — the drill's plural stands. Run rollout to purge the scar (the cluster stays up).");
}

if (stage === "rollout") {
  say("=== STAGE rollout — eleven measures walk BOTH holes out (the cluster stays up) ===");
  const before = ringPointsOf(readSidecar(), project.id);
  const h = holeIdx(before);
  if (!(h.length === 2 && h[0] >= 1 && h[1] >= 2)) throw new Error(`rollout wants both holes INTERIOR (holes at [${h}] — run interior-2 first)`);
  const film = async (label) => {
    const b = await bandOf(label);
    const d = await drillOf(label);
    return { b, d };
  };
  // Each measure pushes one point: after k measures the holes sit
  // (interior-2 positions + k). The drill's ring-only count drops a
  // hole exactly when it reaches the draw-order's OLDEST edge (index
  // 11 — no older neighbor); the band's sentence follows one push
  // later through the quiet; the twelfth push evicts.
  const p1prev = ringPointsOf(readSidecar(), project.id)[0]?.at;
  await measure("p1", p1prev);
  {
    const { b, d } = await film("rollout-p1");
    expect("rollout p1 the plural's own count breathes (band 2 / drill 2)", b.sil.startsWith("2 honest silences") && d.count === 2);
  }
  for (const k of [2, 3, 4, 5]) await measure(`p${k}`, ringPointsOf(readSidecar(), project.id)[0]?.at);
  await measure("p6", ringPointsOf(readSidecar(), project.id)[0]?.at);
  {
    const pts = ringPointsOf(readSidecar(), project.id);
    const { b, d } = await film("rollout-p6");
    expect("rollout p6 the LAST plural breath (both holes still interior — the edge-adjacent stand)", b.sil.startsWith("2 honest silences") && d.count === 2 && holeIdx(pts).every((i) => i >= 1 && i <= 10));
  }
  await measure("p7", ringPointsOf(readSidecar(), project.id)[0]?.at);
  {
    const pts = ringPointsOf(readSidecar(), project.id);
    const { b, d } = await film("rollout-p7");
    // THE EDGE LAW ON THE PLURAL'S DESCENT: the deepest hole reaches
    // the draw-order's OLDEST edge — no older neighbor, it qualifies
    // no more — and the plural hands down to the singular (the pair
    // rides the surviving hole's neighbors). The drill drops it one
    // beat earlier only at the TRAILING end; here both walk the same
    // edge together — 1 beside 1.
    expect("rollout p7 THE DESCENT — the deepest hole at the OLDEST edge, the plural hands down to the singular (band 1 / drill 1)", /^An honest silence sits in the ring's memory — The measures on either side read /.test(b.sil) && d.count === 1 && holeIdx(pts).includes(11));
  }
  for (const k of [8, 9]) await measure(`p${k}`, ringPointsOf(readSidecar(), project.id)[0]?.at);
  {
    const { b, d } = await film("rollout-p9");
    expect("rollout p9 the singular stands alone (the surviving hole interior)", /^An honest silence sits in the ring's memory/.test(b.sil) && d.count === 1);
  }
  await measure("p10", ringPointsOf(readSidecar(), project.id)[0]?.at);
  {
    const pts = ringPointsOf(readSidecar(), project.id);
    const { b, d } = await film("rollout-p10");
    // THE QUIET: the last hole reaches the OLDEST edge — the sentence
    // quiets (a walk that reads only holes has nothing to say), the
    // drill's compact count quiets with it. Both dialects silent, both
    // honest.
    expect("rollout p10 THE QUIET — the last hole at the edge, the clause drops (band silent / drill 0)", b.sil === "(no silences clause)" && d.count === 0 && holeIdx(pts).includes(11));
  }
  await measure("p11", ringPointsOf(readSidecar(), project.id)[0]?.at);
  {
    const pts = ringPointsOf(readSidecar(), project.id);
    const { b, d } = await film("rollout-flat");
    expect("rollout p11 THE EVICTION — the ring 12/12 ALL SPOKEN both channels", pts.length === 12 && pts.every((p) => p.bytes != null && p.mirrorBytes != null));
    expect("rollout p11 the PUREST FLAT (one distinct value per channel, the as-found words)", pts.every((p) => p.bytes === FLAT_B && p.mirrorBytes === FLAT_M));
    expect("rollout p11 the SILENCES clause ABSENT (the absence face closes the film)", b.sil === "(no silences clause)");
    expect("rollout p11 the DRILL compact and quiet", d.count === 0);
    expect("rollout p11 the MIRROR clause normal (the walk speaks)", b.mirrorClause.startsWith(`mirrors hold ${fmtBytes(FLAT_M)} here`));
    expect("rollout p11 no unreadable / waits-words anywhere", !b.band.includes("unreadable") && !b.band.includes("waits for a spoken mirror walk"));
  }
  say(">>> the scar is purged — the world wears its purest flat again.");
}

say("stage done.");
process.exit(0);
