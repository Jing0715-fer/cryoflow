// t884-cleanup-probe.mjs — walk the t884 cleanup sequence with every status
// visible: create a fixture project + one job, then switch-back / delete
// project / delete job / delete connection, printing each HTTP status.
const BASE = "http://localhost:3000";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
const api = async (method, p, body) => {
  const res = await fetch(`${BASE}${p}`, { method, headers: SH, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const b = await res.json().catch(() => ({}));
  return { status: res.status, body: b };
};

// current active (to restore)
const projs0 = await api("GET", "/api/projects");
const active0 = (projs0.body?.projects ?? []).find((p) => p.active)?.id ?? null;
console.log("active0", active0);

// 1. create fixture project
const proj = await api("POST", "/api/projects", { name: `t884 Probe ${Date.now().toString(36)}` });
console.log("create project:", proj.status, proj.body?.project?.id ?? proj.body?.id);
const fid = proj.body?.project?.id ?? proj.body?.id;

// 2. create a job in it
const job = await api("POST", "/api/jobs", { type: "import", name: "t884 Probe Job", params: {} });
console.log("create job:", job.status, job.body?.job?.id, "projectId:", job.body?.job?.projectId);
const jid = job.body?.job?.id;

// 3. the cleanup sequence (t884's exact order)
if (active0) {
  const sw = await api("POST", "/api/projects/switch", { id: active0 });
  console.log("switch back:", sw.status, JSON.stringify(sw.body).slice(0, 80));
}
if (fid) {
  const dp = await api("DELETE", `/api/projects/${fid}`);
  console.log("delete project:", dp.status, JSON.stringify(dp.body).slice(0, 120));
}
if (jid) {
  const dj = await api("DELETE", `/api/jobs/${jid}`);
  console.log("delete job:", dj.status, JSON.stringify(dj.body).slice(0, 120));
}

// 4. the world after
const projs1 = await api("GET", "/api/projects");
console.log("projects after:", (projs1.body?.projects ?? []).map((p) => `${p.name}:${p.active}:${p.stats?.total}`).join(" | "));
const jobs1 = await api("GET", "/api/jobs");
console.log("roster after:", (jobs1.body?.jobs ?? []).length);
