// t643 — suite-fossil sweep. The t105/t103 FATALs (no cleanup-on-fail)
// leaked 11 seeded cards into the world: t105 A/B/C (from today's runs,
// A snapped to the 19760 WORLD_MAX−CARD_W clamp ceiling) and t103's full
// 8-card band E1..E6 + D1/D2 (leaked by t641's stash experiment yesterday
// and today's survey run). All are idle refine3d suite seeds with zero
// tenant value; qa77 law: deletion walks the product gate (DELETE
// /api/jobs/[id]). Sweep by name prefix, verify the world afterwards.
const BASE = "http://localhost:3000";
const PREFIXES = ["t105 ", "t103 "];

const listJobs = async () => {
  const r = await fetch(`${BASE}/api/jobs`);
  const j = await r.json();
  return j.jobs ?? j;
};

const all = await listJobs();
const fossils = all.filter((j) => PREFIXES.some((p) => j.name?.startsWith(p)));
console.log(`world: ${all.length} jobs; fossils matching ${PREFIXES.map((p) => `'${p}*'`).join(" / ")}: ${fossils.length}`);
fossils.forEach((f) => console.log(`  deleting ${f.id} ${f.name} @${f.x},${f.y} (${f.status})`));

let ok = 0, fail = 0;
for (const f of fossils) {
  const r = await fetch(`${BASE}/api/jobs/${f.id}`, { method: "DELETE" });
  if (r.ok) ok++;
  else { fail++; console.log(`  DELETE ${f.name} -> ${r.status} (kept)`); }
}
console.log(`deleted ${ok}/${fossils.length}, failures ${fail}`);

const after = await listJobs();
const residue = after.filter((j) => PREFIXES.some((p) => j.name?.startsWith(p)));
const maxX = Math.max(...after.map((j) => j.x ?? 0));
console.log(`verify: world now ${after.length} jobs; residue ${residue.length}; honest maxX = ${maxX}`);
if (residue.length === 0 && fail === 0) console.log("T643 FOSSIL SWEEP CLEAN");
else { console.log("RESIDUE REMAINS"); process.exit(1); }
