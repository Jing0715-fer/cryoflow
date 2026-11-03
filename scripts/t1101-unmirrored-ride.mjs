// t1101-unmirrored-ride.mjs — THE UNMIRRORED NAMING, LIVE (Task 1101).
// The orphaned t1100 window built the naming (fleetUnmirroredRuns, the
// walk's spokenness, the six mouths) but was interrupted before its
// worklog entry; this harness rides the naming's honest arc through the
// shelf's own dispatch (executeAiTool — the exact call the chat's tool
// shelf makes), one run REALLY losing its local mirror and REALLY
// coming home:
//
//   vanish  — mv refine3d_xxe3896f aside → TWO measures (the push law:
//             the ring remembers the OUTGOING measurement — the first
//             measure pushes the outgoing flat word, the second pushes
//             the vanished word) → the BAND grows
//             " · 1 of 10 runs unmirrored", the hop speaks the real
//             vanishing (DOWN — a real vanishing is news), the ring's
//             newest point carries the drop (the cluster side flat —
//             the bytes never left THERE). LEAVES THE WORLD VANISHED:
//             the camera window sits here (the card badge "1 unmirrored",
//             the share line easing, the dialog's twin chip + the row's
//             "no mirror" span).
//   restore — mv back → one measure → the BAND back to the bare clause
//             (the tail gone), the hop speaks the return (UP), the
//             newest point EXACTLY the pre-ride total, the ring's ends
//             flat (the arc face "holding" — the ride's memory riding
//             interior).
//   verify  — the read-only as-left audit: the bare clause, the ring's
//             ends the flat word, the interior keeping the dip.
//
//   TRUST THE WORDS — every clause read out of the BAND's own summary
//   (never a re-implementation); the sidecar's own points as the
//   cross-check. Every step prints a wall-clock stamp (the t1097 law).
//
// ⚠ THE RING IS NEWEST-FIRST ([outgoing, ...seed] — unshift semantics):
// pts[0] is the NEWEST word, pts.at(-1) the OLDEST end. The first draft
// read the ends swapped (the t1101 lesson — name the ends, never assume).
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
// The victim must be one of the CONNECTION'S RIDERS (the ten runs the
// ledger's connection row carries — the t1100 naming counts the RIDERS'
// mirrors; the first draft's victim, import_q77uq52z, never rode the
// connection and its vanishing moved nothing — the honest lesson: the
// walk sees fourteen dirs, the ledger counts ten riders).
const VICTIM = path.join(ROOT, "data/relion", PID, "refine3d_xxe3896f");
const ASIDE = path.join(ROOT, "data/relion", PID, ".t1101-aside-refine3d_xxe3896f");

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
const withWatchdog = async (label, promise, ms = 90_000) => {
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

// --- the BAND witness: the mirror clause + the naming tail + the hop,
// read out of the band's OWN summary (never a re-implementation) ---
const bandWordsOf = async (label) => {
  const r = await withWatchdog(`band ${label}`, executeAiTool("get_fleet_ledger", {}, ctx));
  const summary = r?.summary ?? "";
  const mirrorClause = summary.match(/mirrors hold ([\d.]+ [KMG]B) here([^·]*)/)?.[2]?.trim() ?? "(NO MIRROR CLAUSE)";
  const naming = /(\d+ of \d+ runs unmirrored)/.exec(summary)?.[1] ?? null;
  const allAbsent = /no mirrors yet — all \d+ runs live on the cluster alone/.test(summary);
  const hop = summary.match(/the mirrors (?:are )?(down|up) ([\d.]+ [KMG]B) since the measure ([^·]+)/)?.[0] ?? null;
  const hopFlat = /the mirrors unchanged since the measure ([^·]+)/.test(summary);
  const share = summary.match(/\((\d+)% used, the share (\w+) across the reach\)/)?.[0] ?? null;
  say(`[${label}] mirror tail: "${mirrorClause}" · naming: ${naming ?? "none"} · allAbsent: ${allAbsent}`);
  say(`[${label}] hop: ${hop ?? (hopFlat ? "(unchanged)" : "(NO HOP)")} · ceiling: ${share ?? "(none)"}`);
  return { mirrorClause, naming, allAbsent, hop, hopFlat, share, summary };
};

const stage = process.argv[2] ?? "";

if (stage === "vanish") {
  if (existsSync(VICTIM)) {
    renameSync(VICTIM, ASIDE);
    say("victim vanished: refine3d_xxe3896f → .t1101-aside-refine3d_xxe3896f");
  } else {
    say("already vanished (a previous stage left the world mid-ride) — measuring on");
  }
  const beforePts = ringPointsOf(readSidecar(), project.id);
  const before = beforePts[0]?.mirrorBytes ?? null; // NEWEST-first: pts[0] is the newest word
  say(`pre-ride total (the ring's newest word): ${before}`);
  // TWO measures — the push law: the ring remembers the OUTGOING
  // measurement (the past), so the first measure pushes the flat word
  // and only the second remembers the vanished word.
  const m1 = await withWatchdog("measure vanish-1", executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m1.ok) throw new Error("vanish measure 1 failed");
  say("measure 1 ok — the outgoing flat word pushed");
  const m2 = await withWatchdog("measure vanish-2", executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m2.ok) throw new Error("vanish measure 2 failed");
  say("measure 2 ok — the vanished word pushed into the ring");
  const w = await bandWordsOf("vanish");
  expect("vanish the BAND names the unmirrored run (1 of N runs unmirrored)", /^1 of \d+ runs unmirrored$/.test(w.naming ?? ""));
  expect("vanish the hop speaks the REAL vanishing (down)", !!w.hop && w.hop.includes("down"));
  expect("vanish the cluster side never moved (the bytes live there still)", /cluster holds 1\.33 GB across 10 workdirs/.test(w.summary));
  const pts = ringPointsOf(readSidecar(), project.id);
  const newest = pts[0]?.mirrorBytes ?? null;
  expect("vanish the ring's newest point carries the drop", newest != null && before != null && newest < before);
  expect("vanish the ring's oldest end still the flat word", pts.at(-1)?.mirrorBytes === before);
  say(`VANISHED — the camera window is open: witness the card badge, the share line, the dialog's chip + "no mirror" span, then run: node scripts/t1101-unmirrored-ride.mjs restore`);
  process.exit(0);
}

if (stage === "restore") {
  if (existsSync(ASIDE)) {
    renameSync(ASIDE, VICTIM);
    say("victim home: .t1101-aside-refine3d_xxe3896f → refine3d_xxe3896f");
  } else {
    say("already home (a previous stage left the world mid-ride) — measuring on");
  }
  const beforePts = ringPointsOf(readSidecar(), project.id);
  const preRide = beforePts.at(-1)?.mirrorBytes ?? null; // OLDEST end = the pre-ride flat word
  const vanished = beforePts.find((p) => preRide != null && p.mirrorBytes != null && p.mirrorBytes < preRide)?.mirrorBytes ?? null;
  // THE RETURN'S OWN FILM POINT — BEFORE any measure: the live walk sees
  // the home dir (the naming gone) while the ring's newest still holds
  // the vanished word — the hop speaks the RETURN (up). After the
  // measures the delta is already same-vs-same (the push law's blind
  // spot) and the hop says unchanged — the UP face only exists here.
  const wPre = await bandWordsOf("restore-pre");
  expect("restore-pre the naming tail ALREADY GONE (the live walk sees home)", wPre.naming === null && !wPre.allAbsent);
  expect("restore-pre the hop speaks the RETURN (up)", !!wPre.hop && wPre.hop.includes("up"));
  // TWO measures — the same push law: the first pushes the vanished
  // word (outgoing), the second remembers the return.
  const m1 = await withWatchdog("measure restore-1", executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m1.ok) throw new Error("restore measure 1 failed");
  say("measure 1 ok — the outgoing vanished word pushed");
  const m2 = await withWatchdog("measure restore-2", executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m2.ok) throw new Error("restore measure 2 failed");
  say("measure 2 ok — the return pushed into the ring");
  const w = await bandWordsOf("restore");
  expect("restore the naming tail GONE (the bare clause again)", w.naming === null && !w.allAbsent);
  const pts = ringPointsOf(readSidecar(), project.id);
  const newest = pts[0]?.mirrorBytes ?? null;
  expect("restore the newest point EXACTLY the pre-ride total", newest != null && preRide != null && newest === preRide);
  expect("restore the ring's ends flat (the arc face holding)", pts.at(-1)?.mirrorBytes === preRide && newest === preRide);
  expect("restore the ride's memory rides interior (the vanished word kept)", vanished != null && pts.some((p) => p.mirrorBytes === vanished && p.mirrorBytes !== newest));
  say("RESTORED — run: node scripts/t1101-unmirrored-ride.mjs verify");
  process.exit(0);
}

if (stage === "hopdance") {
  // THE HOP'S OWN FILM — the two faces the push law hides from the
  // post-measure reads: DOWN (the vanished live word against the ring's
  // flat memory) and UP (the returned live word against the ring's
  // vanished memory). Three measures land the ring clean (ends flat,
  // the dips riding interior).
  const prePts = ringPointsOf(readSidecar(), project.id);
  const flat = prePts[0]?.mirrorBytes ?? null;
  expect("hopdance the world starts all-mirrored with the ends flat", prePts.at(-1)?.mirrorBytes === flat && !existsSync(ASIDE));
  const w0 = await bandWordsOf("dance-pre");
  expect("dance-pre the hop unchanged (flat against flat)", w0.hopFlat);
  renameSync(VICTIM, ASIDE);
  say("victim vanished — the DOWN read next");
  const m1 = await withWatchdog("dance measure 1", executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m1.ok) throw new Error("dance measure 1 failed");
  const wA = await bandWordsOf("dance-down");
  expect("dance-down the hop speaks the vanishing (down)", !!wA.hop && wA.hop.includes("down"));
  expect("dance-down the naming present", /^1 of \d+ runs unmirrored$/.test(wA.naming ?? ""));
  renameSync(ASIDE, VICTIM);
  say("victim home — the UP read next (before the ring forgets the dip)");
  const m2 = await withWatchdog("dance measure 2", executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m2.ok) throw new Error("dance measure 2 failed");
  const wB = await bandWordsOf("dance-up");
  expect("dance-up the hop speaks the return (up)", !!wB.hop && wB.hop.includes("up"));
  expect("dance-up the naming gone", wB.naming === null);
  const m3 = await withWatchdog("dance measure 3", executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!m3.ok) throw new Error("dance measure 3 failed");
  const pts = ringPointsOf(readSidecar(), project.id);
  expect("dance-end the ring's ends flat (the newest the return's word)", pts[0]?.mirrorBytes === flat && pts.at(-1)?.mirrorBytes === flat);
  const dip = pts.filter((p) => p.mirrorBytes != null && flat != null && p.mirrorBytes < flat);
  expect("dance-end the interior keeps the dips", dip.length >= 1);
  const wC = await bandWordsOf("dance-end");
  expect("dance-end the hop back to unchanged", wC.hopFlat);
  expect("dance-end the share holding at 65%", !!wC.share && wC.share.includes("65% used, the share holding"));
  say("HOPDANCE done — both faces filmed, the ring landed clean");
  process.exit(0);
}

if (stage === "verify") {
  const w = await bandWordsOf("verify");
  expect("verify the band's bare clause (no naming tail)", w.naming === null && !w.allAbsent);
  expect("verify the share back at 65% holding", !!w.share && w.share.includes("65% used, the share holding"));
  const pts = ringPointsOf(readSidecar(), project.id);
  expect("verify the ring 12/12 with the ends the flat word", pts.length === 12 && pts[0]?.mirrorBytes === pts.at(-1)?.mirrorBytes);
  const dip = pts.filter((p) => p.mirrorBytes != null && pts[0] != null && p.mirrorBytes < pts[0].mirrorBytes);
  expect("verify the interior keeps the ride's dip", dip.length >= 1);
  say("VERIFY done — the as-left world: all mirrors home, the ring remembering");
  process.exit(0);
}

console.log("usage: node scripts/t1101-unmirrored-ride.mjs <vanish|restore|hopdance|verify>");
process.exit(1);
