#!/usr/bin/env node
/**
 * diag-t393 — the jobs-poll version token: the no-op heartbeat diet for
 * GET /api/jobs.
 *
 * The ask it serves: 继续优化整个项目的性能 (the t392 follow-through) —
 * every pollTick that lands on an unmoved canvas re-paid the full array's
 * serialization, wire and client parse/merge chain. The token (?v=) makes
 * the no-op tick a ~40-byte round trip.
 *
 *   A  TOKEN CORE — a full pull carries a well-formed version; the same
 *      token answers {unchanged:true} in <100 bytes; a bogus token answers
 *      in full; the version is STABLE across repeated no-op pulls (nothing
 *      churns it — reconcile/readRuns/remoteInfoFor are deterministic for
 *      an idle canvas).
 *   M  WRITE PATHS FLIP IT — POST a job, PATCH its params, PATCH its
 *      position, DELETE it: every server write must turn the token (a
 *      missed flip would freeze the client's canvas forever — the one
 *      correctness cliff of this optimization).
 *   P  PROJECT ISOLATION — two EMPTY projects have byte-identical bodies
 *      ({"jobs":[]}) yet different tokens (the hash mixes the project id);
 *      presenting project A's token to project B must answer in FULL, not
 *      unchanged — the alias that would show the wrong project's canvas.
 *   S  SOURCE-LEVEL — the route's short-circuit sits AFTER the transition
 *      sweep / pending-retry side effects (an unchanged answer must never
 *      skip correctness work); the client's unchanged early-return runs
 *      before the tombstone/held-position/merge chain; load() and
 *      switchProject→load() adopt the token.
 *
 * Usage:
 *   CF_ROOT=/home/z/cryoflow node scripts/diag-t393-jobs-version.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const ORIGIN = { Origin: BASE };
const JSON_HEADERS = { "Content-Type": "application/json" };

let pass = 0, fail = 0;
const fails = [];
const must = (c, label, extra = "") => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(`${label}${extra ? ` — ${extra}` : ""}`); console.log(`FAIL  ${label}${extra ? ` — ${String(extra).slice(0, 220)}` : ""}`); }
  return !!c;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => console.log(`\n== ${t} ==`);

async function api(path, opts) {
  for (let a = 0; a < 3; a++) {
    let r;
    try {
      r = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: { ...ORIGIN, ...(opts?.body ? JSON_HEADERS : {}) },
      });
    } catch (e) {
      console.log(`    [server-down: ${e.code ?? e.message} — resurrecting]`);
      spawnSync("bash", ["/tmp/cf-up.sh"], { encoding: "utf8", timeout: 150_000 });
      await sleep(2000);
      continue;
    }
    return { status: r.status, body: await r.json().catch(() => null), res: r };
  }
  return { status: 0, body: null, res: null };
}

/* ---------- the world: a scratch project, torn down at the end ---------- */
const scratch = { id: null, name: `t393 version world ${Date.now() % 100000}` };
const aliasWorld = { id: null, name: `t393 alias world ${Date.now() % 100000}` };
let prevActiveId = null;

async function setRawBody(path, value) {
  // PATCH /api/jobs/[id] with a raw body — reuse the app's own route
  const r = await api(path, { method: "PATCH", body: JSON.stringify(value) });
  return r;
}

/* --------------------------- A: token core ---------------------------- */
section("A: the version token — full pull, unchanged answer, bogus token, stability");

const prev = await api("/api/project");
prevActiveId = prev.body?.project?.id ?? null;

const created = await api("/api/projects", {
  method: "POST",
  body: JSON.stringify({ name: scratch.name, mode: "local" }),
});
must(created.status === 201 || created.status === 200, "scratch project created", `status ${created.status}`);
// collect the id via the projects list (the POST's shape varies by route age)
const projsAfter = await api("/api/projects");
const mine = (projsAfter.body?.projects ?? []).find((p) => p.name === scratch.name);
scratch.id = mine?.id ?? null;
must(!!scratch.id, "scratch project id resolved");
const sw = await api("/api/projects/switch", { method: "POST", body: JSON.stringify({ id: scratch.id }) });
must(sw.status === 200, "switched into the scratch project", `status ${sw.status}`);

// A1 — full pull carries a well-formed version
const full1 = await api("/api/jobs");
const v1 = full1.body?.version;
must(
  full1.status === 200 && Array.isArray(full1.body?.jobs) && typeof v1 === "string" && v1.split(".").length === 4,
  "A1: full pull carries a 4-part version token",
  `status ${full1.status} version ${v1}`
);

// A2 — the same token answers {unchanged:true} in <100 bytes
const raw2 = await fetch(`${BASE}/api/jobs?v=${encodeURIComponent(v1)}`, { headers: ORIGIN });
const text2 = await raw2.text();
const bytes2 = Buffer.byteLength(text2);
must(
  raw2.status === 200 && text2.includes('"unchanged":true') && bytes2 < 100,
  "A2: same token → unchanged in <100 bytes",
  `${bytes2}B: ${text2.slice(0, 80)}`
);

// A3 — a bogus token answers in full
const bogus = await api(`/api/jobs?v=${encodeURIComponent("0.0.0.zzzzz")}`);
must(
  bogus.status === 200 && Array.isArray(bogus.body?.jobs) && !bogus.body?.unchanged && bogus.body?.version === v1,
  "A3: bogus token → full body, same version back",
  `status ${bogus.status}`
);

// A4 — stability: three more no-op pulls agree on the token
let stable = true;
for (let i = 0; i < 3; i++) {
  const r = await fetch(`${BASE}/api/jobs?v=${encodeURIComponent(v1)}`, { headers: ORIGIN });
  const t = await r.text();
  if (!t.includes('"unchanged":true')) { stable = false; break; }
  await sleep(400);
}
must(stable, "A4: version is stable across repeated no-op pulls (no churn)");

/* ------------------- M: write paths must flip the token ------------------ */
section("M: every server write flips the token");

// M1 — POST a job
const post = await api("/api/jobs", { method: "POST", body: JSON.stringify({ type: "import", x: 100, y: 120 }) });
must(post.status === 201 && post.body?.job?.id, "M1a: job created", `status ${post.status}`);
const jobId = post.body?.job?.id ?? "";
const afterPost = await api("/api/jobs");
const vPost = afterPost.body?.version;
must(vPost !== v1, "M1b: POST flipped the version", `${v1} → ${vPost}`);
// and the job is in the full body
must((afterPost.body?.jobs ?? []).some((j) => j.id === jobId), "M1c: the new job rides the full body");

// M2 — PATCH its params (a UI-relevant write)
const patch = await setRawBody(`/api/jobs/${jobId}`, { params: { pixelSize: 1.9, voltage: 200, nodeType: "micrographs" } });
must(patch.status === 200, "M2a: params patched", `status ${patch.status}`);
const afterParams = await api("/api/jobs");
must(afterParams.body?.version !== vPost, "M2b: params write flipped the version");
const patched = (afterParams.body?.jobs ?? []).find((j) => j.id === jobId);
must(patched?.params?.voltage === 200, "M2c: the full body reflects the new value", JSON.stringify(patched?.params).slice(0, 80));

// M3 — PATCH its position (the drag commit path)
const patchPos = await setRawBody(`/api/jobs/${jobId}`, { x: 260, y: 180 });
must(patchPos.status === 200, "M3a: position patched", `status ${patchPos.status}`);
const afterPos = await api("/api/jobs");
must(afterPos.body?.version !== afterParams.body?.version, "M3b: position write flipped the version");
const moved = (afterPos.body?.jobs ?? []).find((j) => j.id === jobId);
must(moved?.x === 260, "M3c: the full body reflects the move");

// M4 — DELETE the job
const del = await api(`/api/jobs/${jobId}`, { method: "DELETE" });
must(del.status === 200 || del.status === 204, "M4a: job deleted", `status ${del.status}`);
const afterDel = await api("/api/jobs");
must(afterDel.body?.version !== afterPos.body?.version, "M4b: delete flipped the version");
must(!(afterDel.body?.jobs ?? []).some((j) => j.id === jobId), "M4c: the job left the full body");

/* ----------------- P: project isolation (the alias probe) ---------------- */
section("P: two EMPTY projects — identical bodies, different tokens");

const created2 = await api("/api/projects", {
  method: "POST",
  body: JSON.stringify({ name: aliasWorld.name, mode: "local" }),
});
must(created2.status === 201 || created2.status === 200, "alias project created", `status ${created2.status}`);
const projs2 = await api("/api/projects");
aliasWorld.id = (projs2.body?.projects ?? []).find((p) => p.name === aliasWorld.name)?.id ?? null;
must(!!aliasWorld.id, "alias project id resolved");
const sw2 = await api("/api/projects/switch", { method: "POST", body: JSON.stringify({ id: aliasWorld.id }) });
must(sw2.status === 200, "switched into the alias project");

const aliasFull = await api("/api/jobs");
const vAlias = aliasFull.body?.version;
// both projects are empty → the bodies are byte-identical; the tokens must NOT be
must(
  vAlias !== afterDel.body?.version,
  "P1: identical bodies, different tokens (project id mixed into the hash)",
  `${afterDel.body?.version} vs ${vAlias}`
);
// P2 — presenting the OTHER project's valid token must answer in full
const cross = await fetch(`${BASE}/api/jobs?v=${encodeURIComponent(afterDel.body?.version ?? "")}`, { headers: ORIGIN });
const crossText = await cross.text();
must(
  cross.status === 200 && !crossText.includes('"unchanged":true'),
  "P2: a cross-project token answers FULL (no alias)",
  crossText.slice(0, 80)
);

/* ---------------------- S: source-level assertions ---------------------- */
section("S: source-level — side effects before the short-circuit, client order, load adoption");

const route = readFileSync(`${ROOT}/src/app/api/jobs/route.ts`, "utf8");
const store = readFileSync(`${ROOT}/src/lib/store.ts`, "utf8");

// S1 — the unchanged short-circuit must sit AFTER the transition sweep and
// the pending retry (an unchanged answer never skips correctness work)
const sweepAt = route.indexOf("autoStartPendingDownstream");
const retryAt = route.indexOf("PENDING_RETRY_MS");
const shortAt = route.indexOf("unchanged: true");
must(
  sweepAt > 0 && retryAt > 0 && shortAt > sweepAt && shortAt > retryAt,
  "S1: route short-circuit sits after the sweep + pending retry",
  `sweep@${sweepAt} retry@${retryAt} short@${shortAt}`
);

// S2 — the client's unchanged early-return runs before the merge chain
const earlyAt = store.indexOf("if (data.unchanged) return;");
const tombAt = store.indexOf("withoutResurrectedJobs(fetched)");
must(
  earlyAt > 0 && tombAt > earlyAt,
  "S2: client early-return precedes the tombstone/merge chain",
  `early@${earlyAt} tomb@${tombAt}`
);

// S3 — pollTick sends the token; load() adopts it; both ingest sites set it
must(
  store.includes("/api/jobs?v=${encodeURIComponent(token)}"),
  "S3a: pollTick sends ?v=<token>"
);
must(
  /jobsVersion:\s*j\.version\b/.test(store) && /jobsVersion:\s*version\b/.test(store),
  "S3b: load() and pollTick both adopt the token"
);
must(
  store.includes("jobsVersion: string | null;"),
  "S3c: the state field is declared"
);

/* ------------------------------ teardown -------------------------------- */
section("teardown");
if (prevActiveId) {
  const back = await api("/api/projects/switch", { method: "POST", body: JSON.stringify({ id: prevActiveId }) });
  must(back.status === 200, "switched back to the original project");
}
for (const p of [scratch, aliasWorld]) {
  if (p.id) {
    const d = await api(`/api/projects/${p.id}`, { method: "DELETE" });
    must(d.status === 200 || d.status === 204, `deleted ${p.name}`, `status ${d.status}`);
  }
}

console.log(`\n${"-".repeat(60)}\nt393 jobs-version: ${pass} pass, ${fail} fail`);
if (fail > 0) {
  console.log("FAILURES:");
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("ALL GREEN");
