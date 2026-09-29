/**
 * t452 live QA — twin surgery + honest verdict fabrication.
 *
 * 1. snapshot edges (for the restore leg)
 * 2. twin Motion Correction 1 via the DUPLICATION POST (params + name)
 * 3. wire Import → twin with the ORIGINAL's exact port pair
 * 4. run the twin on the mock cluster (remote, direct mode)
 * 5. surgery on the twin's corrected_micrographs.star: bump three rows'
 *    accumulated motion (regressors when A=MC1, B=twin), shave one
 *    (improver) — the mock is deterministic, so an honest A/B needs the
 *    twin's world to differ; the surgery writes the values the run
 *    would have produced with a worse stage
 * 6. verify /api/jobs/[id]/motion re-computes (statcache keyed on
 *    size+mtime) and report the expected verdict census
 */
const APP = "http://localhost:3000";
const HDR = { "Content-Type": "application/json", Origin: APP };

async function api(method, path, body) {
  const res = await fetch(APP + path, {
    method,
    headers: HDR,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, ok: res.ok, json, text };
}

const jobsRes = await api("GET", "/api/jobs");
const jobs = jobsRes.json.jobs;
const mc1 = jobs.find((j) => j.name === "Motion Correction 1");
if (!mc1) { console.error("MC1 not found"); process.exit(1); }

const edgesRes = await api("GET", "/api/edges");
const edges = edgesRes.json.edges;
await Bun.write("/tmp/t452-edges-before.json", JSON.stringify(edges, null, 2));
console.log("snapshot:", edges.length, "edges →", "/tmp/t452-edges-before.json");

// the Import→MC1 wire (for the faithful twin line)
const importEdge = edges.find((e) => e.toJobId === mc1.id);
if (!importEdge) { console.error("MC1 has no incoming edge"); process.exit(1); }
const importJob = jobs.find((j) => j.id === importEdge.fromJobId);
console.log("upstream:", importJob.name, "ports:", importEdge.fromPort, "→", importEdge.toPort);

// 1+2 — the twin (params copied; the POST never dispatches)
const twinRes = await api("POST", "/api/jobs", {
  type: mc1.type,
  name: "Motion Correction 1 (t452 twin)",
  params: mc1.params,
  workspaceId: mc1.workspaceId,
  x: mc1.x,
  y: mc1.y + 320,
});
if (!twinRes.ok) { console.error("twin POST failed:", twinRes.status, twinRes.text?.slice(0, 200)); process.exit(1); }
const twin = twinRes.json.job;
console.log("twin:", twin.id, twin.name);

// 3 — the faithful upstream line
const wire = await api("POST", "/api/edges", {
  fromJobId: importEdge.fromJobId,
  toJobId: twin.id,
  fromPort: importEdge.fromPort,
  toPort: importEdge.toPort,
});
console.log("wire:", wire.status, wire.ok ? "ok" : wire.text?.slice(0, 200));

// 4 — the mock run (remote, direct)
const runRes = await api("POST", `/api/jobs/${twin.id}/run`, {
  remote: { connectionId: "conn-mukrkgil", module: "relion/5.0.1", mode: "direct" },
});
console.log("run:", runRes.status, JSON.stringify(runRes.json).slice(0, 220));

// poll to terminal
let final = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const st = await api("GET", "/api/jobs");
  const t = st.json.jobs.find((j) => j.id === twin.id);
  if (t && (t.status === "completed" || t.status === "failed")) { final = t; break; }
}
if (!final || final.status !== "completed") {
  console.error("twin did not complete:", final?.status);
  process.exit(1);
}
console.log("twin run:", final.status, "result:", final.result?.slice(0, 120));

// 5 — the surgery: make the twin's stage worse on three micrographs,
// better on one (rows indexed by their order in the star)
const home = `/home/z/my-project/data/relion/${mc1.projectId}`;
const glob = new Bun.Glob(`motioncorr_${twin.id.slice(-8)}/corrected_micrographs.star`);
const starPath = (await Array.fromAsync(glob.scan({ cwd: home })))[0];
if (!starPath) { console.error("twin star not found under", home); process.exit(1); }
const starFile = `${home}/${starPath}`;
console.log("star:", starFile);

const text = await Bun.file(starFile).text();
const lines = text.split("\n");
let bumped = 0;
let shaved = 0;
const out = lines.map((line) => {
  if (!line.includes(".mrcs") && !line.includes(".mrc")) return line;
  const cols = line.split("\t");
  if (cols.length < 4) return line;
  bumped++;
  const BUMP = new Set([2, 5, 8]);
  if (BUMP.has(bumped)) {
    cols[1] = (parseFloat(cols[1]) + 1.8).toFixed(2); // total
    cols[2] = (parseFloat(cols[2]) + 1.8).toFixed(2); // early
    cols[3] = (parseFloat(cols[3]) + 1.8).toFixed(2); // late
    return cols.join("\t");
  }
  if (bumped === 3 && shaved === 0) {
    shaved++;
    cols[1] = (parseFloat(cols[1]) - 0.9).toFixed(2);
    cols[2] = (parseFloat(cols[2]) - 0.9).toFixed(2);
    cols[3] = (parseFloat(cols[3]) - 0.9).toFixed(2);
    return cols.join("\t");
  }
  return line;
});
await Bun.write(starFile, out.join("\n"));
console.log("surgery: bumped rows 2,5,8 (+1.8 Å), shaved row 3 (−0.9 Å)");

// 6 — the verdict census the dialog will speak
const a = (await api("GET", `/api/jobs/${mc1.id}/motion`)).json.micrographs;
const b = (await api("GET", `/api/jobs/${twin.id}/motion`)).json.micrographs;
const byName = new Map(a.map((r) => [r.name, r]));
let improved = 0, regressed = 0, tied = 0;
const regressedNames = [];
for (const rb of b) {
  const ra = byName.get(rb.name);
  if (!ra) continue;
  const d = rb.total - ra.total;
  if (d > 1e-9) { regressed++; regressedNames.push(`${rb.name} (${ra.total}→${rb.total})`); }
  else if (d < -1e-9) improved++;
  else tied++;
}
console.log(`verdict census: ${improved} improved · ${regressed} regressed · ${tied} tied`);
console.log("regressed:", regressedNames.join(" | "));
console.log("TWIN_ID=" + twin.id);
