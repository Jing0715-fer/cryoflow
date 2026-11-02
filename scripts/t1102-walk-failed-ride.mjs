// t1102-walk-failed-ride.mjs — THE WALK-FAILED FACES, LIVE (Task 1102).
// The band's walk-failed family (t1100's mirrorClause, the delta's
// waits-for-spoken-walk, the hop's spokenness gate) plus t1102's own
// cure — THE CEILING'S WALK-SPOKE GATE — ridden live through the
// shelf's own dispatch (executeAiTool). The honest trigger: chmod 000
// the project's relion dir → the walk's readdirSync throws EACCES →
// computeStorageReport throws → the ledger's catch → mirrorWalkSpoke
// false. The world was never lied to; the walk simply couldn't speak.
//
//   f1      — verify mode 775 → chmod 000 → the band's FAILED faces
//             (read-only dispatch): the unreadable mirrorClause, the
//             delta's waits-words, the hop SILENT, the ceiling's NEW
//             gate ("the share waits for a spoken mirror walk" — never
//             a fake "0% used"). LEAVES THE WORLD BROKEN (the camera
//             and f2 need it).
//   f2      — two measures (still broken): the push law's shape — the
//             first measure pushes the last GOOD word (the ring
//             remembers the OUTGOING), the second pushes the null —
//             the walk's silence enters the ring's memory. Then RESTORE
//             (chmod 755).
//   r       — measure R1 (the walk speaks again): the mirror clause
//             NORMAL back, the hop SILENT (the ring's newest remembered
//             word is the null — AD3's missing-word law LIVE), the
//             ceiling's face BARE (the arc's walk-silent-end silence —
//             the t1098 law live, now distinguishable from the gate).
//             measure R2: the hop "unchanged since the measure just
//             now" BACK, the weather "holding" BACK.
//   rollout — eleven measures: the two null words drift to the ring's
//             tail and roll off — the scar purged, the ring 12/12 all
//             the flat word again, the as-found equality.
//
// TRUST THE WORDS — every check reads the band's OWN summary (never a
// re-implementation); the sidecar's ring is the cross-check. The chmod
// is the honest trigger and is RESTORED by f2/r/rollout defensively.
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

const measure = async (label) => {
  const r = await withWatchdog(`measure ${label}`, executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!r.ok) throw new Error(`measure failed at ${label}`);
  say(`measure ${label} ok`);
};

// the BAND witness: the faces out of the band's own summary
const bandOf = async (label) => {
  const r = await withWatchdog(`band ${label}`, executeAiTool("get_fleet_ledger", {}, ctx));
  const summary = r?.summary ?? "";
  const mirrorClause = summary.match(/ · (mirrors hold [^·]*?|the mirror side unreadable[^·]*?) ·/)?.[1] ?? "(NO MIRROR CLAUSE)";
  const ceilingClause = summary.match(/sync ceiling [^·]*/)?.[0] ?? "(NO CEILING CLAUSE)";
  const hop = summary.match(/ · the mirrors (up|down|unchanged)[^·]*/)?.[0] ?? "(HOP SILENT)";
  const delta = summary.match(/\d[\d.]* [KMG]B lives only on the cluster[^·]*|the policy comparison waits[^·]*/)?.[0] ?? "(NO DELTA)";
  say(`[${label}] MIRROR: ${mirrorClause}`);
  say(`[${label}] CEILING: ${ceilingClause}`);
  say(`[${label}] HOP: ${hop}`);
  say(`[${label}] DELTA: ${delta}`);
  return { summary, mirrorClause, ceilingClause, hop, delta };
};
const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);

const restore = (why) => {
  if (modeOf(PROJECT_DIR) !== AS_FOUND_MODE) {
    chmodDir(PROJECT_DIR, AS_FOUND_MODE);
    say(`RESTORED (${why})`);
  }
};

const stage = process.argv[2];
if (!stage || !["f1", "f2", "r", "rollout"].includes(stage)) {
  console.error("usage: node scripts/t1102-walk-failed-ride.mjs <f1|f2|r|rollout>");
  process.exit(2);
}

// --- the as-found ring constants (read, never assumed) ---
// t1102's own lesson (the r stage's four FAILs were the harness's
// stale constants, never the world): the ring's HEAD may be the scar
// itself (a null word the ride just pushed), so the flat constants
// come from the CONNECTION ROW's last spoken words — never from the
// ring's ends. And the weather is checked by FAITHFULNESS (the band's
// words against the well's face over the fresh ring), never a
// hardcoded word — the ring's oldest end may still ride an older
// ride's dip, and the arc's honest word is whatever the ends say.
const asFound = ringPointsOf(readSidecar(), project.id);
const FLAT_B = asFound[0]?.bytes;
const sidecarConn = readSidecar()?.projects?.[project.id]?.connections?.[0];
const FLAT_M = sidecarConn?.mirrorBytesTotal;
const CEILING = sidecarConn?.syncCeilingBytes;
if (asFound.length !== 12 || FLAT_B == null || FLAT_M == null) throw new Error("the as-found world is not the expected 12-point spoken state");
const SHARE_PCT = Math.min((FLAT_M / CEILING) * 100, 999).toFixed(0);
const { fleetTrendCeilingFace } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
say(`as-found ring: 12/12, bytes ${FLAT_B} (${fmtBytes(FLAT_B)}), mirror ${FLAT_M} (${fmtBytes(FLAT_M)}), ceiling ${CEILING} (${fmtBytes(CEILING)}), share ${SHARE_PCT}%`);

if (stage === "f1") {
  say("=== STAGE f1 — the chmod, the FAILED faces (LEAVES THE WORLD BROKEN) ===");
  const m0 = modeOf(PROJECT_DIR);
  if (m0 !== AS_FOUND_MODE) {
    say(`unexpected as-found mode ${m0} — restoring ${AS_FOUND_MODE} first`);
    chmodDir(PROJECT_DIR, AS_FOUND_MODE);
  }
  chmodDir(PROJECT_DIR, "000");
  const b = await bandOf("f1");
  expect("f1 the MIRROR clause reads the unreadable face", b.mirrorClause.startsWith("the mirror side unreadable — the local walk failed, so the mirror faces are unverified"));
  expect("f1 the DELTA waits for a spoken mirror walk", b.delta.startsWith("the policy comparison waits for a spoken mirror walk"));
  expect("f1 the HOP is silent (no 'the mirrors up/down/unchanged')", b.hop === "(HOP SILENT)");
  expect("f1 the CEILING names the policy and REFUSES the share (the t1102 gate's live debut)", b.ceilingClause.startsWith(`sync ceiling ${fmtBytes(CEILING)} (the share waits for a spoken mirror walk)`));
  expect("f1 NO fake '0% used' anywhere in the band", !b.summary.includes("0% used"));
  expect("f1 the ring untouched (no measure yet)", ringPointsOf(readSidecar(), project.id).length === 12);
  say(">>> THE WORLD IS NOW BROKEN (chmod 000) — run the CAMERA witness, then stage f2 (which restores).");
}

if (stage === "f2") {
  say("=== STAGE f2 — two measures (still broken), the null enters the ring, then RESTORE ===");
  try {
    if (modeOf(PROJECT_DIR) !== "000") throw new Error(`expected the broken world (mode 000), found ${modeOf(PROJECT_DIR)} — run stage f1 first`);
    await measure("F1");
    let pts = ringPointsOf(readSidecar(), project.id);
    expect("F1 the push law's shape — the newest remembered word is STILL the good one", pts[0]?.mirrorBytes === FLAT_M && pts[0]?.bytes === FLAT_B);
    await measure("F2");
    pts = ringPointsOf(readSidecar(), project.id);
    expect("F2 the walk's silence ENTERED the ring (newest mirrorBytes null)", pts[0]?.mirrorBytes == null && pts[0]?.bytes === FLAT_B);
    expect("F2 the second point is the pushed good word", pts[1]?.mirrorBytes === FLAT_M);
    expect("F2 the cluster side never wavered (12/12 bytes flat)", pts.length === 12 && pts.every((p) => p.bytes === FLAT_B));
    const b = await bandOf("f2");
    expect("f2 the MIRROR clause still the unreadable face", b.mirrorClause.startsWith("the mirror side unreadable"));
    expect("f2 the CEILING still the gate's waits-words (the gate outranks the arc during the broken window)", b.ceilingClause.startsWith(`sync ceiling ${fmtBytes(CEILING)} (the share waits for a spoken mirror walk)`));
  } finally {
    restore("stage f2's own law");
  }
  const m = modeOf(PROJECT_DIR);
  expect("f2 the world RESTORED (mode 775)", m === AS_FOUND_MODE);
}

if (stage === "r") {
  say("=== STAGE r — the return: the walk speaks, the hop's missing-word silence, the weather's comeback ===");
  restore("stage r's entry safety");
  await measure("R1");
  let pts = ringPointsOf(readSidecar(), project.id);
  expect("R1 the ring's newest is the SECOND null (the F2 entry's word pushed)", pts[0]?.mirrorBytes == null && pts[1]?.mirrorBytes == null);
  const b1 = await bandOf("r1");
  expect("r1 the MIRROR clause NORMAL back (the walk spoke — the total is the connection's own last spoken word)", b1.mirrorClause.startsWith(`mirrors hold ${fmtBytes(FLAT_M)} here`));
  expect("r1 the HOP still SILENT (the ring's newest remembered word is the null — AD3's missing-word law LIVE)", b1.hop === "(HOP SILENT)");
  expect(`r1 the CEILING's share BACK (${SHARE_PCT}% used) but the weather BARE (the arc's walk-silent-end silence — the t1098 law, now gate-free)`, new RegExp(`^sync ceiling .+ \\(${SHARE_PCT}% used\\)$`).test(b1.ceilingClause));
  await measure("R2");
  pts = ringPointsOf(readSidecar(), project.id);
  expect("R2 the ring's newest SPOKEN again (the R1 entry's word pushed — spoken, whatever its word)", pts[0]?.mirrorBytes != null);
  expect("R2 the two nulls ride positions 1-2 (the scar's shape — the OLDER points' dips are the t1101 tail, not this ride's)", pts[1]?.mirrorBytes == null && pts[2]?.mirrorBytes == null && pts.slice(3).every((p) => p.mirrorBytes != null));
  const b2 = await bandOf("r2");
  expect("r2 the HOP BACK — 'the mirrors unchanged since the measure just now'", b2.hop.startsWith(" · the mirrors unchanged since the measure"));
  expect("r2 the WEATHER FAITHFUL — the band's word is the well's face over the fresh ring (holding OR climbing, whatever the ends honestly say)", (() => { const face = fleetTrendCeilingFace({ history: ringPointsOf(readSidecar(), project.id) }); if (face == null) return !b2.ceilingClause.includes("the share "); return b2.ceilingClause.includes(face); })());
}

if (stage === "rollout") {
  say("=== STAGE rollout — eleven measures purge the scar; the fresh-world verification ===");
  restore("stage rollout's entry safety");
  for (let i = 1; i <= 11; i++) await measure(`p${i}`);
  const fresh = readSidecar();
  const pts = ringPointsOf(fresh, project.id);
  const conn = fresh?.projects?.[project.id]?.connections?.[0];
  expect("rollout the ring 12/12 ALL SPOKEN (the scar purged — every mirror word a number, never a null)", pts.length === 12 && pts.every((p) => p.mirrorBytes != null));
  expect("rollout the cluster channel FLAT 12/12 (the bytes never wavered)", pts.every((p) => p.bytes === FLAT_B));
  const b = await bandOf("rollout");
  expect("rollout the MIRROR clause normal (the walk's current word)", b.mirrorClause.startsWith(`mirrors hold ${fmtBytes(conn?.mirrorBytesTotal)} here`));
  expect("rollout the HOP unchanged", b.hop.startsWith(" · the mirrors unchanged"));
  expect("rollout the WEATHER FAITHFUL (the band's word === the well's face over the fresh ring)", (() => { const face = fleetTrendCeilingFace({ history: pts }); if (face == null) return !b.ceilingClause.includes("the share "); return b.ceilingClause.includes(face); })());
  expect("rollout NO unreadable / waits-words / unmirrored anywhere", !b.summary.includes("unreadable") && !b.summary.includes("waits for a spoken mirror walk") && !b.summary.includes("unmirrored"));
  expect("rollout the world AS FOUND (mode 775)", modeOf(PROJECT_DIR) === AS_FOUND_MODE);
}

say("stage done.");
process.exit(0);
