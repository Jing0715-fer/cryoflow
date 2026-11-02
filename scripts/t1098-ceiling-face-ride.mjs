// t1098-ceiling-face-ride.mjs — THE SYNC-CEILING'S TEMPORAL FACE, LIVE
// (Task 1098). The ceiling bar borrows the mirror channel's arc and
// speaks it in the share's OWN dialect — the ceiling is a policy
// constant, so the share moves exactly as the mirrors move. This
// harness rides the honest arc through the shelf's own dispatch:
//
//   WARM  — twelve measures pour the ring full of the flat present
//           (cap 12: the ring becomes ALL fresh flats — a known face,
//           whatever the interior arcs the earlier windows left).
//   Beat 0 — the FIRST BREATH: both ends flat → "the share holding
//           across the reach".
//   Beat U — mint 8 MB of real zeros into the REAL MIRROR dir
//           (data/relion/<pid>/autopick_a1gbc6xk/t1098-mint.bin — the
//           t1095/t1096/t1097 mint root; the t1097 first draft minted
//           into the mock cluster's fs by mistake and the CLUSTER
//           channel grew), then TWO measures → the ends disagree
//           (newest minted, oldest flat) → "the share climbing across
//           the reach". THE FACE'S OWN TIMESCALE, learned live: the
//           arc walks the RING'S ENDS — the climb is not an instant,
//           it is the FILL. The fill continues to saturation (ten more
//           measures): the ring agrees at the minted level, the face
//           back to "holding" — the climb completed.
//   Beat D — the mint removed, two measures → the ends disagree the
//           other way (newest flat, oldest minted) → "the share easing
//           across the reach". The ease too is the DRAIN: it is not
//           done until the last mint point rolls off the oldest end
//           (ten more measures — the tail honestly still "easing").
//   Beat R — one more measure rolls the last mint word out → "the
//           share holding" — the arc FULLY passed, every point the
//           flat word again.
//
//   Modes:
//     full  — WARM + all four beats (the node-side ride).
//     mint  — mint + two measures, print the face's word (the UI dance).
//     clean — mint removed + two measures, print the face's word.
//
//   TRUST THE COUNT + TRUST THE WORDS — the sidecar's own JSON before
//   and after every beat; the face's word computed through the WELL
//   itself (fleetTrendCeilingFace / fleetMirrorArc / fleetTrendSpanVoice
//   over the LIVE ring) — never a re-implementation. Every step prints
//   a wall-clock stamp so a hang names itself (the t1097 law).
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson): .env points
// at the image template; the living world is db/cryoflow.db.
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
const MINT = path.join(MINT_DIR, "t1098-mint.bin");
const MINT_BYTES = 8 * 1024 * 1024; // 8,388,608 — the house mint
const FLAT = 1405972601; // the mirrors' flat word (1.31 GB)
const MINTED = FLAT + MINT_BYTES; // 1414361209 — the mint's word (1.32 GB)
const WATCHDOG_MS = 90_000;
const RING_CAP = 12;

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
const describeEnds = (sidecar, pid, label) => {
  const pts = ringPointsOf(sidecar, pid);
  const ends =
    pts.length > 0
      ? `newest m${pts[0].mirrorBytes ?? "∅"} / oldest m${pts[pts.length - 1].mirrorBytes ?? "∅"}`
      : "(empty ring)";
  say(`[${label}] ring ${pts.length}/${RING_CAP} — ${ends}`);
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

// --- the well, imported LIVE (the face's own arithmetic — never a copy) ---
say("importing the well…");
const { fleetTrendCeilingFace, fleetMirrorArc, fleetTrendSpanVoice } = await __jiti.import(
  "../src/lib/remote/fleet-trend.ts"
);
const { fmtBytes } = await __jiti.import("../src/lib/relion/disk-usage");
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

// --- the LIVE face witness: the well over the sidecar's own ring ---
const faceOf = (label) => {
  const pts = ringPointsOf(readSidecar(), project.id);
  const face = fleetTrendCeilingFace({ history: pts });
  const arc = fleetMirrorArc({ history: pts });
  const span = fleetTrendSpanVoice({ history: pts, fmtBytes, stampAgo: () => "just now" });
  const arcWord = arc ? arc.kind : "(silent)";
  say(`[${label}] FACE: ${face ?? "(the channel is silent — the bar keeps its t1084 face)"} | arc ${arcWord}${arc ? ` ${fmtBytes(arc.deltaBytes)}` : ""}`);
  const clause = span?.match(/The mirrors held .*?across the reach\./)?.[0] ?? "(no mirror clause)";
  say(`[${label}] SPAN's mirror clause: ${clause}`);
  return { face, arc, pts };
};
const kindOfFace = (face) =>
  face == null ? null : face.includes("climbing") ? "up" : face.includes("easing") ? "down" : "same";
const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);

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

const mode = process.argv[2] ?? "full";

if (mode === "mint" || mode === "clean") {
  // --- the UI dance modes: one face move each, honestly printed ---
  await (mode === "mint" ? mintUp() : mintDown());
  faceOf(mode);
  process.exit(0);
}

// --- WARM — twelve measures pour the ring full of the flat present ---
say(`=== WARM — ${RING_CAP} measures pour the ring full of the flat present ===`);
for (let i = 1; i <= RING_CAP; i++) await measure(`warm${i}`);
const warm = describeEnds(readSidecar(), project.id, "AFTER-WARM");
expect(
  "the warm ring is 12/12, every point the flat word",
  warm.length === RING_CAP && warm.every((p) => p.mirrorBytes === FLAT)
);

// --- Beat 0 — the FIRST BREATH ---
say("=== BEAT 0 — the FIRST BREATH (read-only) ===");
const b0 = faceOf("beat0");
expect("beat0 the face says HOLDING (both ends the flat word)", b0.face === "the share holding across the reach");
expect("beat0 the face's word matches the arc's kind (the ONE arithmetic, live)", kindOfFace(b0.face) === (b0.arc?.kind ?? "?"));

// --- Beat U — the mint's rise → the face CLIMBS (the fill's mouth) ---
say("=== BEAT U — mint 8 MB (MIRROR side) → two measures → the CLIMBING face ===");
await mintUp();
const bU = faceOf("beatU");
expect("beatU the face says CLIMBING (newest minted, oldest flat — the fill's mouth)", bU.face === "the share climbing across the reach");
expect(
  "beatU the arc agrees (up, the house mint's magnitude — the same walk the span drinks)",
  bU.arc?.kind === "up" && bU.arc.deltaBytes === MINT_BYTES
);
say("=== THE FILL CONTINUES — eleven more measures → the ring saturates at the minted level ===");
// the push law's honest arithmetic: u1's own outgoing was the FLAT —
// twelve pushes later it still holds the oldest end (the climb never
// completes on twelve); the thirteenth push rolls it out.
for (let i = 1; i <= RING_CAP - 1; i++) await measure(`fill${i}`);
const fE = faceOf("fillEnd");
expect(
  "fillEnd the ring ALL the minted word (the climb completed — the ends agree at the new level)",
  fE.pts.length === RING_CAP && fE.pts.every((p) => p.mirrorBytes === MINTED)
);
expect("fillEnd the face back to HOLDING (the new level agreed)", fE.face === "the share holding across the reach");

// --- Beat D — the mint's fall → the face EASES (the drain's mouth) ---
say("=== BEAT D — mint removed → two measures → the EASING face ===");
await mintDown();
const bD = faceOf("beatD");
expect("beatD the face says EASING (newest flat, oldest minted — the drain's mouth)", bD.face === "the share easing across the reach");
expect("beatD the arc agrees (down, the house mint's magnitude)", bD.arc?.kind === "down" && bD.arc.deltaBytes === MINT_BYTES);
say("=== THE DRAIN CONTINUES — ten more measures → the tail honestly still EASING ===");
for (let i = 1; i <= RING_CAP - 2; i++) await measure(`drain${i}`);
const dE = faceOf("drainEnd");
expect(
  "drainEnd the face STILL EASING (the last mint word holds the oldest end — the ease is not done)",
  dE.face === "the share easing across the reach"
);

// --- Beat R — the RETURN: one more measure rolls the last mint word out ---
say("=== BEAT R — one more measure → the arc FULLY passed ===");
await measure("r1");
const bR = faceOf("beatR");
expect("beatR the face says HOLDING (the return)", bR.face === "the share holding across the reach");
expect(
  "beatR every point the flat word again (the arc fully passed — the memory back to the flat face)",
  bR.pts.length === RING_CAP && bR.pts.every((p) => p.mirrorBytes === FLAT)
);

say(`final ring (newest→oldest): ${bR.pts.map((p) => `${p.at.slice(11, 19)} m${p.mirrorBytes ?? "∅"}`).join(" | ")}`);
process.exit(0);
