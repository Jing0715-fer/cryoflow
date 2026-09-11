// world-hygiene — probe-domain public infrastructure, three audits:
//
//   ADOPT   (Task 137) — legacy rows with workspaceId NULL render NOWHERE
//     on the canvas (the active-workspace filter is non-null whenever any
//     workspace exists), yet they sit in the API roster every probe reads.
//     roster ⊋ canvas-world breaks any suite that assumes the two are the
//     same set (t88's Phase E waited forever on an invisible card; t137's
//     stranger pick timed out on a dot that could never exist). Adopting
//     them into the FIRST workspace makes roster == canvas an invariant.
//   OVERLAP — every card sitting in an overlap pair is moved to a clean
//     grid on the world's right edge (Task 136: seed coordinates colliding
//     was a shared-world infrastructure problem, not a per-suite one).
//   EXTENT  (Task 137) — every card farther than OUTLIER_GAP from the
//     bbox of the REST of the world is an orphan (a crashed probe's seed,
//     a drag gone astray, a restore artifact). One card 8000px deep
//     inflates the world bbox so every boot fit (zoom clamps at ZOOM_MIN)
//     frames a mostly-empty tall world and pushes the QA row off-screen —
//     a seven-suite cascade of fake failures (qa58/59/60/61/62/64/66 all
//     click cards that are simply not in the viewport). Moved back beside
//     the main cluster, never deleted (suites reference cards by name).
//
// Cards are MOVED, never deleted; edges survive a move. Destination slots
// are occupancy-aware: a slot is only used if no CURRENT job rectangle
// sits on it (relocations must not manufacture the next overlap).
const BASE = "http://localhost:3000";
const j = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const cw = 220, ch = 96;

/** how far past the rest-of-world bbox a card may sit before it reads
 *  as an orphan (480 ≈ 2 card rows of deliberate emptiness) */
const OUTLIER_GAP = 480;

const hits = (a, x, y) => a.x < x + cw && a.x + cw > x && a.y < y + ch && a.y + ch > y;
/** slot occupancy: true if any live card would overlap the slot rect */
const taken = (x, y, ignore = new Set()) =>
  j.some((o) => !ignore.has(o.id) && hits(o, x, y));

// ---------- audit 0: adoption (ws=null rows render nowhere) ----------
{
  const strays = j.filter((o) => !o.workspaceId);
  if (strays.length > 0) {
    const wss = (await (await fetch(BASE + "/api/workspaces")).json()).workspaces ?? [];
    const home = wss[0]?.id;
    if (home) {
      for (const s of strays) {
        const r = await fetch(`${BASE}/api/jobs/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: home }),
        });
        console.log(`${r.ok ? "adopted" : "ADOPT FAILED"} ${s.name} (ws=null) → ${home}`);
        if (r.ok) s.workspaceId = home;
      }
    } else console.log("adopt: no workspace exists to host strays");
  } else console.log("adopt: 0 strays (roster == canvas)");
}

// ---------- audit 1: extent (orphan recall) ----------
const bboxOf = (list) => ({
  minX: Math.min(...list.map((o) => o.x)),
  maxX: Math.max(...list.map((o) => o.x + cw)),
  minY: Math.min(...list.map((o) => o.y)),
  maxY: Math.max(...list.map((o) => o.y + ch)),
});
const orphans = [];
for (const c of j) {
  const rest = bboxOf(j.filter((o) => o.id !== c.id));
  if (
    c.y > rest.maxY + OUTLIER_GAP || c.y + ch < rest.minY - OUTLIER_GAP ||
    c.x > rest.maxX + OUTLIER_GAP || c.x + cw < rest.minX - OUTLIER_GAP
  ) orphans.push(c);
}

// destination: right of everything that exists (the overlap grid below
// tops out at x 2600 — orphans land clear of it), rows march downward
const PATCH = async (job, x, y) => {
  const r = await fetch(`${BASE}/api/jobs/${job.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y }),
  });
  console.log(`${r.ok ? "moved" : "FAILED"} ${job.name} (${job.x},${job.y}) → (${x},${y})`);
  if (r.ok) { job.x = x; job.y = y; }
};
{
  const rest = bboxOf(j.filter((o) => !orphans.includes(o)));
  const baseX = Math.max(rest.maxX + 80, 2680);
  let slot = 0;
  for (const c of orphans) {
    let x = 0, y = 0, found = false;
    for (let tries = 0; tries < 40 && !found; tries++) {
      x = baseX + (slot % 4) * 260;
      y = rest.minY + Math.floor(slot / 4) * 140;
      found = !taken(x, y, new Set([c.id]));
      slot++;
    }
    if (found) await PATCH(c, x, y);
    else console.log(`SKIPPED ${c.name} — no free slot found`);
  }
  console.log(orphans.length ? `` : `extent: 0 orphans (world bbox coherent)`);
}

// ---------- audit 2: overlap (Task 136, now occupancy-aware) ----------
const overlapping = new Set();
for (let i = 0; i < j.length; i++)
  for (let k = i + 1; k < j.length; k++) {
    const a = j[i], b = j[k];
    if (hits(a, b.x, b.y)) { overlapping.add(a.id); overlapping.add(b.id); }
  }

// destination: a marching grid starting right of the world content —
// 4 columns wide, rows march DOWNWARD forever (the old 4×4 grid wrapped
// with %ROWS and stacked after 16 relocations; the adoption audit's
// newly-rendered strays exhausted it). Occupancy-checked per slot.
let slot = 0;
for (const id of overlapping) {
  const job = j.find((x) => x.id === id);
  let placed = false;
  for (let tries = 0; tries < 64 && !placed; tries++) {
    const x = 1600 + (slot % 4) * 260;
    const y = 160 + Math.floor(slot / 4) * 140;
    slot++;
    if (taken(x, y, new Set([job.id]))) continue; // never stack onto a neighbor
    await PATCH(job, x, y);
    placed = true;
  }
  if (!placed) console.log(`SKIPPED ${job.name} — overlap grid exhausted`);
}
console.log(`\n${orphans.length} orphans recalled, ${overlapping.size} overlappers relocated`);
