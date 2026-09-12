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
//   EXTENT-NN (Task 140) — the bbox check has a mutual-shadowing blind
//     spot: TWO conspiring outliers each sit inside the other's rest-bbox
//     and both survive. The neighbour invariant doesn't blink: a card
//     whose nearest LIVE neighbour is NN_STRAY_GAP away belongs to no
//     cluster, whatever the bbox says. (Born from a real incident: a card
//     silently at x=9280 while the rest of the world ended at 2340 made
//     boot fit spill x≈150 content off-screen and t107/t108/t109's
//     reach-less inspector clicks miss ten times in a row.)
//   RESIDUE (Task 144) — the deletion power, and the only one. EXTENT and
//     NN recall singletons; Task 144 met what they cannot see: ACCRETION.
//     Every crashed suite leaves its unnamed seeds behind (POST without a
//     name auto-generates "<type label> N"), and the residue chains into
//     the world one ~140px link at a time — a salami whose every slice is
//     individually innocent (each member sits inside the rest-of-world
//     bbox; every NN gap is small) while maxY marched 1096 → 4500 and
//     the boot fit slid the QA row under the pipeline KPI bar (qa60/qa64
//     ten-iteration click loops, control build proved the product
//     innocent). Recall cannot cure accretion: relocating a hundred
//     residue rows builds a recall suburb as tall as the world it
//     replaced. Deletion is scoped to a signature nothing legitimate can
//     match — auto-name form "<exact type label> n" with n ≥ 2 (n = 1 is
//     the seeder skeleton), status idle, no startedAt, no result,
//     unlinked; labels are extracted from the product source (t138
//     doctrine — the product's word table is the only word table); a
//     per-run cap of 400 turns a signature bug into a loud abort instead
//     of a blind mass deletion.
//
// Cards are MOVED, never deleted — EXCEPT residue rows under the Task 144
// signature above. Edges survive a move (and cascade away with a deleted
// residue row: Edge.fromJob/toJob are onDelete: Cascade). Destination
// slots are occupancy-aware: a slot is only used if no CURRENT job
// rectangle sits on it (relocations must not manufacture the next
// overlap).
import { readFileSync } from "fs";
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

// ---------- audit 0.5: residue (Task 144 — the accretion janitor) ----------
{
  let labels = null;
  try {
    const wf = readFileSync("/home/z/my-project/src/lib/workflow.ts", "utf8");
    labels = {};
    for (const m of wf.matchAll(/spec\(\s*"([a-z0-9_]+)",\s*"([^"]*)"/g)) labels[m[1]] = m[2];
  } catch { /* label table unavailable → audit skipped below */ }
  if (labels && Object.keys(labels).length > 0) {
    const residue = j.filter((o) => {
      const label = labels[o.type];
      if (!label) return false; // unknown type → never auto-named residue we recognize
      const m = (o.name ?? "").match(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`));
      if (!m || +m[1] < 2) return false; // n = 1 rows are the seeder skeleton's own
      return o.status === "idle" && !o.startedAt && !o.result && !o.linkedJobId;
    });
    if (residue.length > 400) {
      console.log(`RESIDUE ABORT: ${residue.length} matches exceed the 400 cap — signature bug, not cleanup`);
    } else if (residue.length > 0) {
      let dead = 0;
      for (const o of residue) {
        const r = await fetch(`${BASE}/api/jobs/${o.id}`, { method: "DELETE" });
        if (r.ok) { o._dead = true; dead++; }
        else console.log(`DELETE FAILED residue ${o.name} (HTTP ${r.status})`);
      }
      for (let i = j.length - 1; i >= 0; i--) if (j[i]._dead) j.splice(i, 1);
      console.log(`residue: ${dead}/${residue.length} never-run auto-named rows deleted (edges cascade)`);
    } else {
      console.log("residue: 0 (world carries no accreted auto-named rows)");
    }
  } else {
    console.log("residue: skipped (no label table extracted from workflow.ts)");
  }
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

// ---------- audit 1b: nearest-neighbour strays (mutual shadowing) ----------
// Runs BEFORE the relocation block so NN strays ride the same PATCH pass.
const NN_STRAY_GAP = 1600;
const rectGap = (a, b) => {
  const dx = Math.max(0, Math.max(a.x - (b.x + cw), b.x - (a.x + cw)));
  const dy = Math.max(0, Math.max(a.y - (b.y + ch), b.y - (a.y + ch)));
  return Math.max(dx, dy);
};
for (const c of j) {
  if (orphans.includes(c)) continue; // already recalled by the bbox pass
  let best = Infinity;
  for (const o of j) {
    if (o.id === c.id) continue;
    best = Math.min(best, rectGap(c, o));
  }
  if (best > NN_STRAY_GAP) {
    orphans.push(c);
    console.log(`nn-stray: ${c.name} — nearest neighbour ${Math.round(best)}px away (belongs to no cluster)`);
  }
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
