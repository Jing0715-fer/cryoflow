// t1094-shelf-live-read.mjs — the AI BAND'S HOLE READ, LIVE (Task 1094).
// t1093's candidate: the hole dialect's SIXTH seat (the AI tools) has
// never spoken on camera — every prior witness was source-pinned
// (t1053) or UI-side (the card/diagnostic/drill seats). This harness
// reads the shelf the way the agent loop does: executeAiTool dispatch,
// the real project, the real sidecar, the real cluster.
//
//   Beat A — get_fleet_ledger with measure:true THROUGH the shelf:
//            the outgoing-state push performs the FIFTH eviction
//            (02:00:27's flat forgotten, 13 → slice → 12) via the AI
//            tool's own measure path, and the band speaks the fresh
//            state live ("measured just now", ring 12/12).
//   Beat B — get_fleet_memory: the drill's per-project band with the
//            "N honest holes in the memory" clause + the locator's
//            two breaths (the memory's depth; the deepest buried
//            silence) — the qualifying count of TWO live through the
//            shelf's mouth.
//   TRUST THE COUNT — the sidecar's own JSON before/after, evictions
//   and holes named against the raw stamps.
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson): .env points
// at the image template; the living world is db/cryoflow.db.
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(ROOT, "src") },
});

const SIDECAR = path.join(ROOT, "data", "remote-fleet-ledger.json");

const readSidecar = () => {
  try {
    return JSON.parse(readFileSync(SIDECAR, "utf8"));
  } catch {
    return null;
  }
};

// the sidecar's real shape (TRUST THE FILE, not the assumption):
// {projects: {<pid>: {connections: [...], measuredAt, history: {<connId>: [newest-first]}}}}
const ringPointsOf = (sidecar, pid) => {
  const proj = sidecar?.projects?.[pid];
  const hist = proj?.history ?? {};
  return Object.values(hist)[0] ?? []; // newest first
};
const describeSidecar = (sidecar, pid, label) => {
  console.log(`=== ${label} ===`);
  if (!sidecar) return console.log("(sidecar unreadable)");
  const proj = sidecar.projects?.[pid];
  console.log(`measuredAt: ${proj?.measuredAt ?? "(none)"}`);
  const pts = ringPointsOf(sidecar, pid);
  console.log(`ring points: ${pts.length} (newest first)`);
  console.log(`ring stamps (newest→oldest): ${pts.map((p) => `${p.at.slice(11, 19)} ${p.bytes == null ? "HOLE" : p.bytes}`).join(" | ")}`);
  return pts;
};

// --- the project, discovered LIVE (the t1081-R law: name, not fossil) --
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const project = await db.project.findFirst({
  where: { name: "β-Galactosidase Tutorial (demo)" },
  select: { id: true, name: true },
});
if (!project) throw new Error("demo project not found — the world is not the expected one");
console.log(`project: ${project.id} "${project.name}"`);
await db.$disconnect();

// --- the world BEFORE ---------------------------------------------------
const before = readSidecar();
const beforePts = describeSidecar(before, project.id, "BEFORE");

// --- the shelf's own dispatch -------------------------------------------
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const ctx = { projectId: project.id };

console.log("\n=== BEAT A — get_fleet_ledger measure:true (through the shelf) ===");
const ledger = await executeAiTool("get_fleet_ledger", { measure: true }, ctx);
console.log(`ok: ${ledger.ok}`);
console.log(`BAND: ${ledger.summary}`);

console.log("\n=== BEAT B — get_fleet_memory (read-only drill) ===");
const mem = await executeAiTool("get_fleet_memory", {}, ctx);
console.log(`ok: ${mem.ok}`);
console.log(`BAND: ${mem.summary}`);

// --- the world AFTER (TRUST THE COUNT) -----------------------------------
const after = readSidecar();
const afterPts = describeSidecar(after, project.id, "AFTER");
if (beforePts && afterPts) {
  const beforeStamps = new Set(beforePts.map((p) => p.at));
  const evicted = beforePts.filter((p) => !afterPts.some((q) => q.at === p.at));
  const minted = afterPts.filter((p) => !beforeStamps.has(p.at));
  console.log(`\nevicted: ${evicted.map((p) => p.at.slice(11, 19)).join(" | ") || "(none)"}`);
  console.log(`minted:  ${minted.map((p) => `${p.at.slice(11, 19)} ${p.bytes == null ? "HOLE" : p.bytes}`).join(" | ") || "(none)"}`);
  const holes = afterPts.filter((p) => p.bytes == null);
  console.log(`holes in ring: ${holes.length} → ${holes.map((p) => p.at.slice(11, 19)).join(" | ")}`);
}
