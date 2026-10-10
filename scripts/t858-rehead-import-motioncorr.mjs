// t858 — surgical re-head: re-run import (now nodeType movies) + motioncorr
// through the product's own run door. The healer's skip law keys on
// outputs-on-disk, so a params-changed head needs a forced re-run; --rerun
// would re-pay the whole 7-minute chain (initialmodel 241s alone). This
// chunk runs EXACTLY the two wounded links, then leaves the healer's own
// verification to bless the rest.
const BASE = "http://localhost:3000";
const SH = {
  Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", "Content-Type": "application/json",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: SH, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

// resolve demo project + the two heads by type (the healer's own walk law)
const jobs = (await api("GET", "/api/jobs")).json?.jobs ?? [];
const importJob = jobs.find((j) => j.type === "import");
const mcJob = jobs.find((j) => j.type === "motioncorr");
if (!importJob || !mcJob) {
  console.log(`FAIL: heads not found (import=${!!importJob} motioncorr=${!!mcJob})`);
  process.exit(1);
}
console.log(`heads: import ${importJob.id.slice(-6)} · motioncorr ${mcJob.id.slice(-6)}`);

async function runAndPoll(type, id) {
  const run = await api("POST", `/api/jobs/${id}/run`, {});
  if (run.status !== 200) {
    console.log(`FAIL: ${type} run refused (${run.status}): ${JSON.stringify(run.json).slice(0, 300)}`);
    return false;
  }
  const t0 = Date.now();
  for (;;) {
    await sleep(2000);
    const dto = ((await api("GET", "/api/jobs")).json?.jobs ?? []).find((j) => j.id === id);
    if (dto && (dto.status === "completed" || dto.status === "failed" || dto.status === "error")) {
      const okRun = dto.status === "completed";
      console.log(`${okRun ? "ok" : "FAIL"}: ${type} ${dto.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (okRun && dto.result) console.log(`  result: ${String(dto.result).slice(0, 140)}`);
      return okRun;
    }
    if (Date.now() - t0 > 240000) {
      console.log(`FAIL: ${type} still unsettled after 240s`);
      return false;
    }
  }
}

const a = await runAndPoll("import", importJob.id); // native engine job (body {})
let b = false;
if (a) {
  // CLI jobs ride the mock cluster (the healer's own remote body — a bare
  // run falls back to the LOCAL engine, which honestly refuses: no RELION)
  const conns = (await api("GET", "/api/remote/connections")).json?.connections ?? [];
  const conn = conns.find((c) => /mock/i.test(c.name ?? "")) ?? conns[0];
  if (!conn) {
    console.log("FAIL: no Mock Cluster connection for the remote leg");
    process.exit(1);
  }
  console.log(`remote leg: ${conn.name} (${String(conn.id).slice(-6)}) module relion/5.0.1 slurm`);
  const run = await api("POST", `/api/jobs/${mcJob.id}/run`, {
    remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" },
  });
  if (run.status !== 200) {
    console.log(`FAIL: motioncorr remote run refused (${run.status}): ${JSON.stringify(run.json).slice(0, 300)}`);
    process.exit(1);
  }
  const t0 = Date.now();
  for (;;) {
    await sleep(2000);
    const dto = ((await api("GET", "/api/jobs")).json?.jobs ?? []).find((j) => j.id === mcJob.id);
    if (dto && (dto.status === "completed" || dto.status === "failed" || dto.status === "error")) {
      b = dto.status === "completed";
      console.log(`${b ? "ok" : "FAIL"}: motioncorr ${dto.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (!b) console.log(`  result: ${String(dto.result).slice(0, 300)}`);
      break;
    }
    if (Date.now() - t0 > 240000) { console.log("FAIL: motioncorr unsettled after 240s"); break; }
  }
}
console.log(a && b ? "RE-HEAD OK" : "RE-HEAD FAIL");
process.exit(a && b ? 0 : 1);
