const BASE = "http://localhost:3000";
const j = async (url, opts) => {
  const r = await fetch(BASE + url, opts);
  let b = null;
  try { b = await r.json(); } catch {}
  return { status: r.status, body: b };
};
const JH = { "content-type": "application/json" };

const scratch = (await j("/api/projects", { method: "POST", headers: JH, body: JSON.stringify({ name: "diag scratch" }) })).body.project;
console.log("1 scratch:", scratch.id);
const active = (await j("/api/project")).body.project;
console.log("2 active==scratch:", active.id === scratch.id);
const wsA = (await j("/api/workspaces")).body.workspaces;
console.log("3 workspaces after create:", JSON.stringify(wsA.map(w => w.name)));
const wsB = await j("/api/workspaces", { method: "POST", headers: JH, body: JSON.stringify({ name: "diag ws2" }) });
console.log("4 wsB POST:", wsB.status, wsB.body?.workspace?.id);
const wsBId = wsB.body?.workspace?.id;
const jobA = (await j("/api/jobs", { method: "POST", headers: JH, body: JSON.stringify({ type: "motioncorr", name: "diag A", x: 100, y: 100 }) })).body.job;
console.log("5 jobA:", jobA.id, "wsId:", jobA.workspaceId);
await j(`/api/jobs/${jobA.id}`, { method: "PATCH", headers: JH, body: JSON.stringify({ note: "the good class" }) });
const jobB = (await j("/api/jobs", { method: "POST", headers: JH, body: JSON.stringify({ type: "motioncorr", name: "diag link", linkedJobId: jobA.id, workspaceId: wsBId }) })).body.job;
console.log("6 jobB:", jobB.id, "wsId:", jobB.workspaceId, "==wsBId:", jobB.workspaceId === wsBId);
const jobC = (await j("/api/jobs", { method: "POST", headers: JH, body: JSON.stringify({ type: "motioncorr", name: "diag C", x: 400, y: 100 }) })).body.job;
const edge = await j("/api/edges", { method: "POST", headers: JH, body: JSON.stringify({ fromJobId: jobA.id, toJobId: jobC.id }) });
console.log("7 edge:", edge.status);
const dup = await j(`/api/projects/${scratch.id}/duplicate`, { method: "POST" });
console.log("8 dup:", dup.status, JSON.stringify(dup.body?.counts));
const prev = active.id;
await j("/api/projects/switch", { method: "POST", headers: JH, body: JSON.stringify({ id: dup.body.project.id }) });
const cloneJobs = (await j("/api/jobs")).body.jobs;
await j("/api/projects/switch", { method: "POST", headers: JH, body: JSON.stringify({ id: prev }) });
const scA = cloneJobs.find(x => x.name === "diag A");
const scB = cloneJobs.find(x => x.name === "diag link");
console.log("9 clone A ws:", scA.workspaceId, " note:", scA.note);
console.log("10 clone B ws:", scB.workspaceId, " linked:", scB.linkedJobId);
console.log("11 B differs:", scB.workspaceId != null && scB.workspaceId !== scA.workspaceId);
// cleanup
await j(`/api/jobs/${jobB.id}`, { method: "DELETE" });
await j(`/api/jobs/${jobA.id}`, { method: "DELETE" });
await j(`/api/jobs/${jobC.id}`, { method: "DELETE" });
await j(`/api/projects/${dup.body.project.id}`, { method: "DELETE" });
console.log("cleanup:", (await j(`/api/projects/${scratch.id}`, { method: "DELETE" })).status);
