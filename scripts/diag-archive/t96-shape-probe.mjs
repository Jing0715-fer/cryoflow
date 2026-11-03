// t96 shape probe — nail the server's ACTUAL rename mechanics (Task 96
// topic research). Doctrine: behavior is measured, never remembered.
//
// Experiments:
//   E1 fresh name in ws1            -> kept as-is?
//   E2 same name again in ws1       -> renamed (i2)?
//   E3 same name in ws2 (same proj) -> renamed (i3)?  [project-wide discriminator]
//   E4 two same-name jobs in ONE request -> batch-internal rename?
// Cleanup: deletes every t96-prefixed job + both workspaces.

const BASE = "http://localhost:3000";

const api = async (path, opts = {}) => {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* leave text */ }
  return { status: res.status, body, text: text.slice(0, 300) };
};

const NAME = "T96 Dup Probe A";

const postImport = (workspaceId, names) =>
  api("/api/workflow-import", {
    method: "POST",
    body: JSON.stringify({
      workspaceId,
      jobs: names.map((name, i) => ({
        type: "import",
        name,
        x: 100 + i * 40,
        y: 100,
        params: { micrographsPath: "/tmp/x.mrc" },
      })),
      edges: [],
    }),
  });

const run = async () => {
  // ---- setup: two fresh workspaces ----
  const mk1 = await api("/api/workspaces", { method: "POST", body: JSON.stringify({ name: "t96-ws-1" }) });
  const mk2 = await api("/api/workspaces", { method: "POST", body: JSON.stringify({ name: "t96-ws-2" }) });
  if (mk1.status !== 200 && mk1.status !== 201) { console.log("WS1 FAIL", mk1.status, mk1.text); process.exit(1); }
  const ws1 = mk1.body?.workspace?.id ?? mk1.body?.id;
  const ws2 = mk2.body?.workspace?.id ?? mk2.body?.id;
  console.log(`ws1=${ws1} ws2=${ws2}`);

  const r1 = await postImport(ws1, [NAME]);
  const n1 = r1.body?.jobs?.[0]?.name;
  console.log(`E1 fresh name in ws1        -> "${n1}" (status ${r1.status})`);

  const r2 = await postImport(ws1, [NAME]);
  const n2 = r2.body?.jobs?.[0]?.name;
  console.log(`E2 same name again in ws1   -> "${n2}" (status ${r2.status})`);

  const r3 = await postImport(ws2, [NAME]);
  const n3 = r3.body?.jobs?.[0]?.name;
  console.log(`E3 same name in ws2         -> "${n3}" (status ${r3.status})  <-- project-wide discriminator`);

  const r4 = await postImport(ws1, [NAME, NAME]);
  const n4 = r4.body?.jobs?.map((j) => j.name);
  console.log(`E4 two same-name in ONE req -> ${JSON.stringify(n4)} (status ${r4.status})`);

  // ---- cleanup: t96 jobs + workspaces ----
  const jobsRes = await api("/api/jobs");
  const jobs = jobsRes.body?.jobs ?? [];
  const t96jobs = jobs.filter((j) => (j.name ?? "").startsWith("T96"));
  let deleted = 0;
  for (const j of t96jobs) {
    const d = await api(`/api/jobs/${j.id}`, { method: "DELETE" });
    if (d.status === 200) deleted++;
  }
  for (const [label, id] of [["ws1", ws1], ["ws2", ws2]]) {
    if (id) {
      const d = await api(`/api/workspaces/${id}`, { method: "DELETE" });
      console.log(`cleanup ${label}: ${d.status}`);
    }
  }
  console.log(`cleanup: ${deleted}/${t96jobs.length} t96 jobs deleted`);
};

run().catch((e) => { console.error("PROBE CRASH", e); process.exit(1); });
