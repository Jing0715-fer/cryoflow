// world-hygiene --fix — move every card that sits in an overlap pair to a
// clean grid on the world's right edge (x ≥ 1600). Cards are MOVED, never
// deleted (some suite may reference them by name); edges survive a move.
const BASE = "http://localhost:3000";
const j = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const cw = 220, ch = 96;

const overlapping = new Set();
for (let i = 0; i < j.length; i++)
  for (let k = i + 1; k < j.length; k++) {
    const a = j[i], b = j[k];
    if (a.x < b.x + cw && a.x + cw > b.x && a.y < b.y + ch && a.y + ch > b.y) {
      overlapping.add(a.id);
      overlapping.add(b.id);
    }
  }

// destination grid: 4 columns × rows at x 1600+, clear of the QA skeleton
// (x 60-1240), the qa60 row (y 780-1076), and qa58's pair (1310,780)
const COLS = [1600, 1860, 2120, 2380];
const ROWS = [160, 300, 440, 580];
let slot = 0;
for (const id of overlapping) {
  const job = j.find((x) => x.id === id);
  const x = COLS[slot % 4];
  const y = ROWS[Math.floor(slot / 4) % ROWS.length];
  slot++;
  const r = await fetch(`${BASE}/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y }),
  });
  console.log(`${r.ok ? "moved" : "FAILED"} ${job.name} (${job.x},${job.y}) → (${x},${y})`);
}
console.log(`\n${overlapping.size} cards relocated`);
