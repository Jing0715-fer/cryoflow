// t1099-ai-ceiling-ride.mjs — THE AI BAND'S CEILING WORDS, LIVE
// (Task 1099). The AI-side seat of the t1098 temporal face: the ledger
// band's ceiling clause grows the SAME face the UI twins drink — the
// share's own weather inside the parentheses (the band's comma
// dialect). This harness rides the honest arc through the shelf's own
// dispatch (executeAiTool — the exact call the chat's tool shelf
// makes), witnessing the BAND's clause at every beat:
//
//   BEAT 0 — the FIRST BREATH (read-only dispatch): both ends flat →
//            "(…% used, the share holding across the reach)".
//   BEAT U — the mint + two measures → the ends disagree → the band
//            reads "the share climbing across the reach".
//   FILL   — eleven more measures → the ring saturates → the band
//            back to "holding" (the climb completed — the face's own
//            timescale, the t1098 law: thirteen pushes, not twelve).
//   BEAT D — the mint removed + two measures → "the share easing
//            across the reach"; the drain's tail honestly still
//            easing after ten more.
//   BEAT R — one more measure rolls the last mint word out → the band
//            back to "holding" — the arc fully passed.
//
//   TRUST THE WORDS — the clause read out of the band's own summary
//   (never a re-implementation); the well's face computed beside it
//   as the cross-check. Every step prints a wall-clock stamp so a
//   hang names itself (the t1097 law).
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson).
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(ROOT, "src") },
});

const SIDECAR = path.join(ROOT, "data", "remote-fleet-ledger.json");
const MINT_DIR = path.join(ROOT, "data/relion/cmvbjl6060000srlis2ai5mb3/autopick_a1gbc6xk");
const MINT = path.join(MINT_DIR, "t1099-mint.bin");
const MINT_BYTES = 8 * 1024 * 1024;
const FLAT = 1405972601;
const MINTED = FLAT + MINT_BYTES;
const RING_CAP = 12;
const WATCHDOG_MS = 90_000;

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

say("importing the shelf…");
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const { fleetTrendCeilingFace } = await __jiti.import("../src/lib/remote/fleet-trend.ts");
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
const measure = async (label) => {
  const r = await withWatchdog(`measure ${label}`, executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!r.ok) throw new Error(`measure failed at ${label}`);
  say(`measure ${label} ok`);
};
// --- the BAND witness: the ceiling clause out of the band's own summary ---
const bandFaceOf = async (label) => {
  const r = await withWatchdog(`band ${label}`, executeAiTool("get_fleet_ledger", {}, ctx));
  const summary = r?.summary ?? "";
  const clause = summary.match(/sync ceiling [^·]*\(([^)]*)\)/)?.[1] ?? "(NO CEILING CLAUSE)";
  say(`[${label}] BAND's ceiling clause: (${clause})`);
  // the cross-check: the well over the sidecar's own ring
  const pts = ringPointsOf(readSidecar(), project.id);
  const face = fleetTrendCeilingFace({ history: pts });
  say(`[${label}] WELL's face: ${face ?? "(silent)"}`);
  return { clause, face };
};
const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);
const clauseHas = (clause, weather) => clause.includes(`, the share ${weather} across the reach`);
const clauseBare = (clause) => !clause.includes("the share");

const mintUp = async () => {
  if (!existsSync(MINT_DIR)) throw new Error(`mirror dir missing: ${MINT_DIR}`);
  writeFileSync(MINT, Buffer.alloc(MINT_BYTES));
  say(`mint written: ${MINT} (${MINT_BYTES} zeros)`);
  await measure("u1");
  await measure("u2");
};
const mintDown = async () => {
  if (existsSync(MINT)) {
    unlinkSync(MINT);
    say("mint removed (the disk as-found)");
  }
  await measure("d1");
  await measure("d2");
};

// --- BEAT 0 — the FIRST BREATH (read-only dispatch) ---
say("=== BEAT 0 — the FIRST BREATH (read-only dispatch) ===");
const b0 = await bandFaceOf("beat0");
expect("beat0 the BAND says HOLDING (and the well agrees)", clauseHas(b0.clause, "holding") && b0.face === "the share holding across the reach");

// --- BEAT U — the mint's rise → the band CLIMBS ---
say("=== BEAT U — mint 8 MB (MIRROR side) → two measures → the band's CLIMBING word ===");
await mintUp();
const bU = await bandFaceOf("beatU");
expect("beatU the BAND says CLIMBING (and the well agrees)", clauseHas(bU.clause, "climbing") && bU.face === "the share climbing across the reach");

// --- the FILL — eleven more measures → the band back to holding ---
say("=== THE FILL — eleven more measures → the ring saturates ===");
for (let i = 1; i <= RING_CAP - 1; i++) await measure(`fill${i}`);
const fE = await bandFaceOf("fillEnd");
expect("fillEnd the BAND back to HOLDING (the climb completed — the ends agree at the new level)", clauseHas(fE.clause, "holding") && fE.face === "the share holding across the reach");
const fPts = ringPointsOf(readSidecar(), project.id);
expect("fillEnd the ring ALL the minted word", fPts.length === RING_CAP && fPts.every((p) => p.mirrorBytes === MINTED));

// --- BEAT D — the mint's fall → the band EASES ---
say("=== BEAT D — mint removed → two measures → the band's EASING word ===");
await mintDown();
const bD = await bandFaceOf("beatD");
expect("beatD the BAND says EASING (and the well agrees)", clauseHas(bD.clause, "easing") && bD.face === "the share easing across the reach");

// --- the DRAIN's tail — ten more measures → honestly STILL easing ---
say("=== THE DRAIN — ten more measures → the tail honestly still EASING ===");
for (let i = 1; i <= RING_CAP - 2; i++) await measure(`drain${i}`);
const dE = await bandFaceOf("drainEnd");
expect("drainEnd the BAND STILL EASING (the last mint word holds the oldest end)", clauseHas(dE.clause, "easing") && dE.face === "the share easing across the reach");

// --- BEAT R — the RETURN ---
say("=== BEAT R — one more measure → the arc fully passed ===");
await measure("r1");
const bR = await bandFaceOf("beatR");
expect("beatR the BAND back to HOLDING (the return)", clauseHas(bR.clause, "holding") && bR.face === "the share holding across the reach");
const rPts = ringPointsOf(readSidecar(), project.id);
expect("beatR every point the flat word again", rPts.length === RING_CAP && rPts.every((p) => p.mirrorBytes === FLAT));

process.exit(0);
