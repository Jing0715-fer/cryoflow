// t1097-drill-hop-ride.mjs — THE DRILL'S MIRROR HOP, LIVE (Task 1097).
// The THIRD hop seat: the AI drill's per-ring band grows the channel's
// word beside the cluster's trend clause — ring-internal like its twin.
// This harness rides the honest arc through the shelf's own dispatch:
//
//   Beat 0 — get_fleet_memory (READ-ONLY): the FIRST BREATH (whatever
//            the ring's last hop honestly is right now).
//   Beat U — mint 8 MB of real zeros into a REAL MIRROR dir
//            (data/relion/<pid>/autopick_a1gbc6xk/t1097-mint.bin — the
//            t1095/t1096 mint root; the t1097 first draft minted into
//            the mock cluster's fs by mistake and the CLUSTER channel
//            grew instead: the wrong-side arc stays in the ring's
//            interior points, honestly remembered), then TWO measures
//            through get_fleet_ledger measure:true (the push law: each
//            measure pushes the OUTGOING present — the ring-internal
//            hop speaks one measure later than the card's present hop).
//            The drill then reads "the mirrors up 8.0 MB …".
//   Beat D — the mint removed, two measures again: "the mirrors down
//            8.0 MB …".
//   Beat R — one more measure: "the mirrors unchanged …" — the arc's
//            return, the mint's rise and fall kept as interior points.
//
//   TRUST THE COUNT — the sidecar's own JSON before/after every beat;
//   every step prints a wall-clock stamp so a hang names itself.
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson): .env points
// at the image template; the living world is db/cryoflow.db.
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(ROOT, "src") },
});

const SIDECAR = path.join(ROOT, "data", "remote-fleet-ledger.json");
const MINT_DIR = path.join(ROOT, "data/relion/cmvbjl6060000srlis2ai5mb3/autopick_a1gbc6xk");
const MINT = path.join(MINT_DIR, "t1097-mint.bin");
const MINT_BYTES = 8 * 1024 * 1024; // 8,388,608 — the house mint
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
  return Object.values(hist)[0] ?? []; // newest first
};
const describeTop = (sidecar, pid, label) => {
  const pts = ringPointsOf(sidecar, pid);
  say(`[${label}] ring ${pts.length} — top3: ${pts.slice(0, 3).map((p) => `${p.at.slice(11, 19)} c${p.bytes}·m${p.mirrorBytes ?? "∅"}`).join(" | ")}`);
  return pts;
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

const HOP = /the mirrors (up|down|unchanged)( [^,]*?)? since the measure/;
const drillHopOf = (summary) => {
  const m = summary.match(HOP);
  return m ? m[0] : "(NO MIRROR HOP CLAUSE)";
};

// --- the project, discovered LIVE ---
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
const measure = async (label) => {
  const r = await withWatchdog(`measure ${label}`, executeAiTool("get_fleet_ledger", { measure: true }, ctx));
  if (!r.ok) throw new Error(`measure failed at ${label}`);
  say(`measure ${label} ok`);
  return r;
};
const drill = async (label) => {
  const r = await withWatchdog(`drill ${label}`, executeAiTool("get_fleet_memory", {}, ctx));
  if (!r.ok) throw new Error(`drill failed at ${label}`);
  say(`[${label}] HOP CLAUSE: ${drillHopOf(r.summary)}`);
  return r.summary;
};

// --- Beat 0 — the FIRST BREATH (read-only) ---
describeTop(readSidecar(), project.id, "BEFORE");
say("=== BEAT 0 — the FIRST BREATH (read-only drill) ===");
const breath0 = await drill("beat0");

// --- Beat U — the mint's rise, ring-internal ---
say("=== BEAT U — mint 8 MB (MIRROR side) → two measures → the UP face ===");
writeFileSync(MINT, Buffer.alloc(MINT_BYTES));
say(`mint written: ${MINT} (${MINT_BYTES} zeros)`);
await measure("u1");
await measure("u2");
describeTop(readSidecar(), project.id, "AFTER-U");
const breathU = await drill("beatU");

// --- Beat D — the mint's fall, ring-internal ---
say("=== BEAT D — mint removed → two measures → the DOWN face ===");
unlinkSync(MINT);
say("mint removed (the disk as-found)");
await measure("d1");
await measure("d2");
describeTop(readSidecar(), project.id, "AFTER-D");
const breathD = await drill("beatD");

// --- Beat R — the return ---
say("=== BEAT R — one more measure → the RETURN ===");
await measure("r1");
describeTop(readSidecar(), project.id, "AFTER-R");
const breathR = await drill("beatR");

// --- the verdicts (TRUST THE COUNT + TRUST THE WORDS) ---
const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);
expect("beat0 speaks a hop clause (whatever the ring's last hop is)", HOP.test(breath0) || breath0.includes("the mirrors unchanged since the measure"));
expect("beatU speaks the UP face", /the mirrors up 8388608B|the mirrors up 8\.0 MB/.test(breathU));
expect("beatD speaks the DOWN face", /the mirrors down 8388608B|the mirrors down 8\.0 MB/.test(breathD));
expect("beatR speaks the RETURN (unchanged)", /the mirrors unchanged since the measure/.test(breathR));
const after = ringPointsOf(readSidecar(), project.id);
expect("the ring holds 12/12 through every eviction", after.length === 12);
expect("every ring point carries the channel", after.every((p) => typeof p.mirrorBytes === "number"));
say(`final ring (newest→oldest): ${after.map((p) => `${p.at.slice(11, 19)} m${p.mirrorBytes ?? "∅"}`).join(" | ")}`);
process.exit(0);
