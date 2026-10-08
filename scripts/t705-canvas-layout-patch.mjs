// t705-canvas-layout-patch.mjs — the canvas layout surgery.
//
// DISEASE (live-proven by scripts/t705-fsc-forensics.mjs): clicking the
// refine3d canvas node's center opens the Topaz Train inspector. The five
// qa-batch suites (qa49/50/51/55/57) click nodes by text+rect — the world
// made that ambiguous: the seeded aux nodes squat inside the canonical
// chain's band, and TWO of them sit exactly on another node:
//   initialmodel (160,320) == maskcreate (160,320)   — exact stack
//   topaztrain   (420,500)  ~ refine3d   (340,520)   — the click-steal
//   topazdenoise (380,330)  ~ select2d   (340,340)   — same class
// The t531 seeder learned the t665 lesson for topazdenoise ("three nodes on
// one coordinate would render as one blob") but left the pair stacked and
// pushed the topaz branch INTO the occupied 320–340 band. A human clicking
// refine3d gets Topaz Train too — a product bug, not a probe artifact.
//
// SURGERY: the four aux nodes move to a clean AUX BAND (y=680) at the
// chain's own x pitch (260 — the spacing every chain row already proves):
//   initialmodel → (80,680)   maskcreate → (340,680)
//   topazdenoise → (600,680)  topaztrain → (860,680)
// Edge topology is untouched (edges encode the relationships; the canvas is
// only their geometry). The seeder adopts existing nodes on re-run, so a
// re-seed will NOT drag them back; the seeder's own placement code is fixed
// in the same window.
//
// IDEMPOTENT: a node already at its target seat (or anywhere collision-free)
// is left alone; the overlap audit re-runs before and after.
// READ/WRITE: Job.x/y only. Records, workdirs, outputs, edges: untouched.

process.env.DATABASE_URL = `file:/home/z/my-project/db/cryoflow.db`;

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

// conservative node world-box (screen 173x81 at ~0.67 zoom ⇒ ~258x121;
// rounded up) — anything non-overlapping at this box is safe at any zoom
const W = 240, H = 140;

const AUX = {
  initialmodel: { x: 80, y: 680 },
  maskcreate: { x: 340, y: 680 },
  topazdenoise: { x: 600, y: 680 },
  topaztrain: { x: 860, y: 680 },
};

const collides = (a, b) =>
  Math.min(a.x + W, b.x + W) - Math.max(a.x, b.x) > 8 &&
  Math.min(a.y + H, b.y + H) - Math.max(a.y, b.y) > 8;

const audit = (nodes, label) => {
  const list = Object.entries(nodes).map(([id, n]) => ({ id, ...n }));
  const bad = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (collides(list[i], list[j])) bad.push(`${list[i].id}×${list[j].id}`);
  console.log(`  [${label}] ${list.length} nodes, ${bad.length} overlapping pairs${bad.length ? ": " + bad.join(", ") : " — clean"}`);
  return bad;
};

(async () => {
  const manifest = JSON.parse((await import("node:fs")).readFileSync("/home/z/my-project/data/old-world.json", "utf8"));
  const projectId = manifest.project.id;

  const jobs = await db.job.findMany({
    where: { projectId },
    select: { id: true, type: true, name: true, x: true, y: true },
  });
  console.log(`world: ${jobs.length} jobs in project ${projectId}`);

  const nodes = Object.fromEntries(jobs.map((j) => [j.id, { x: j.x, y: j.y }]));
  const before = audit(nodes, "before");

  // idempotent guard: nothing to do for a clean world
  const moving = jobs
    .filter((j) => AUX[j.type])
    .filter((j => nodes[j.id].x !== AUX[j.type].x || nodes[j.id].y !== AUX[j.type].y))
    .map((j) => j.type);
  if (before.length === 0 && moving.length === 0) {
    console.log("already clean — nothing to move (idempotent skip)");
    await db.$disconnect();
    return;
  }

  for (const j of jobs) {
    const seat = AUX[j.type];
    if (!seat) continue;
    if (j.x === seat.x && j.y === seat.y) {
      console.log(`  ${j.type} (${j.id.slice(-8)}) already at (${seat.x},${seat.y}) — skip`);
      continue;
    }
    console.log(`  ${j.type} (${j.id.slice(-8)}): (${j.x},${j.y}) → (${seat.x},${seat.y})`);
    await db.job.update({ where: { id: j.id }, data: { x: seat.x, y: seat.y } });
    nodes[j.id] = { x: seat.x, y: seat.y };
  }

  const after = audit(nodes, "after");
  await db.$disconnect();
  if (after.length > 0) {
    console.error("STILL OVERLAPPING — the aux band itself collides; investigate");
    process.exit(1);
  }
  console.log("surgery done: aux band seated, zero overlaps");
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
