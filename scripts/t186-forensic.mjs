/* t186 B12 forensic — which wire edges does the scheduler violate, and
 * does the DB edge table (the scheduler's actual dep source) agree with
 * the wire (DB ∪ sidecar)? */
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const post = async (body) => {
  const r = await fetch(BASE + "/api/hpc/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
};
const def = await post({});
const projId = def.project.id;
const edges = (await (await fetch(`${BASE}/api/edges?projectId=${projId}`)).json()).edges ?? [];

const maxEnd = new Map(), minStart = new Map();
for (const b of def.bars) {
  maxEnd.set(b.key, Math.max(maxEnd.get(b.key) ?? -Infinity, b.end));
  minStart.set(b.key, Math.min(minStart.get(b.key) ?? Infinity, b.start));
}
const nameOf = new Map();
const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
for (const j of jobs) nameOf.set(j.id, j.name ?? j.type);

console.log(`wire edges: ${edges.length}, bars: ${def.bars.length}, jobs: ${jobs.length}`);
let v = 0;
for (const e of edges) {
  const depEnd = maxEnd.get(e.fromJobId);
  if (depEnd === undefined || minStart.get(e.toJobId) === undefined) continue;
  const start = minStart.get(e.toJobId);
  if (start < depEnd - 1e-6) {
    v++;
    console.log(
      `VIOLATION #${v}: ${nameOf.get(e.fromJobId)} (end ${depEnd.toFixed(1)}) -> ` +
      `${nameOf.get(e.toJobId)} (starts ${start.toFixed(1)})  [${e.id.slice(0, 12)} port ${e.fromPort}->${e.toPort}]`
    );
  }
}

// DB edge table ground truth
const raw = execSync(
  `sqlite3 data/cryoflow.db "SELECT id, \\"fromJobId\\", \\"toJobId\\" FROM Edge WHERE projectId='${projId}'" 2>/dev/null || true`,
  { encoding: "utf8" },
).trim();
const dbEdges = raw ? raw.split("\n").map((l) => l.split("|")) : [];
console.log(`\nDB Edge table rows: ${dbEdges.length}`);
const wireIds = new Set(edges.map((e) => e.id));
let dbV = 0;
for (const [id, from, to] of dbEdges) {
  const depEnd = maxEnd.get(from);
  if (depEnd === undefined || minStart.get(to) === undefined) continue;
  if (minStart.get(to) < depEnd - 1e-6) {
    dbV++;
    console.log(`DB-VIOLATION: ${nameOf.get(from)} -> ${nameOf.get(to)} [${id.slice(0, 12)}] wireHas=${wireIds.has(id)}`);
  }
}
console.log(`wire violations: ${v}, DB violations: ${dbV}`);
