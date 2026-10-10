// cleanup for the two diag runs + the first failed suite run's residue
const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };
const api = async (m, p) => { const r = await fetch(`${BASE}${p}`, { method: m, headers: SH }); return r.status; };
const jobs = await fetch(`${BASE}/api/jobs`, { headers: SH }).then((r) => r.json());
const mine = (jobs.jobs ?? []).filter((j) => /t416|diag/i.test(j.name));
for (const j of mine) {
  const s = await api("DELETE", `/api/jobs/${j.id}`);
  console.log("delete job", j.name, s);
}
const conns = await fetch(`${BASE}/api/remote/connections`, { headers: SH }).then((r) => r.json()).catch(() => ({}));
for (const c of conns.connections ?? conns ?? []) {
  if (/t416|diag/i.test(c.name ?? "")) { console.log("delete conn", c.name, await api("DELETE", `/api/remote/connections/${c.id}`)); }
}
const projs = await fetch(`${BASE}/api/projects`, { headers: SH }).then((r) => r.json());
for (const p of projs.projects ?? projs ?? []) {
  if (/t416diag|t416 Denoise/i.test(p.name ?? "")) {
    console.log("delete project", p.name, await api("DELETE", `/api/projects/${p.id}`));
  }
}
