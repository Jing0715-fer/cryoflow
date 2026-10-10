#!/usr/bin/env node
/**
 * t549 — bring-home live-fire for the receipt-wounded workdirs whose
 * CLUSTER SIDE still holds the originals (t548 hand-off ① verdict scan:
 * 42 wounded workdirs, exactly 3 healable — extract_nu8g3cvw 12/12,
 * motioncorr_2w5c6ex2 3/3, motioncorr_yaf038c0 3/3).
 *
 * The healing verb is the PRODUCT's own batch bring-home door:
 *   POST /api/jobs/[id]/outputs/sync   (t424; max 8 paths per call)
 * not synthetic seeding — the t531 discipline (never pollute with
 * synthetics) and the t548 wording (用产品机制治世界，而非合成播种).
 *
 * Protocol per job:
 *   1. GET  remote-remaining (truth number BEFORE)
 *   2. read the local manifest, list paths absent locally
 *   3. POST sync in chunks of ≤8 (the client-driven doctrine — small chunks)
 *   4. GET  remote-remaining (truth number AFTER)
 *   5. verdict: remaining === 0 → HEALED; else print the survivors
 *
 * Honest guards:
 *   - every path comes from the job's own manifest (the route re-checks
 *     the ledger server-side — "Not in the remote manifest" would be a
 *     plan bug, not a product bug)
 *   - the script NEVER writes to the workdir; fetch happens over the
 *     product's SSH lane (ssh.ts → mock cluster 127.0.0.1:3022)
 *
 * Run: node scripts/t549-bringhome-live-fire.mjs
 */

const BASE = process.env.CRYOFLOW_BASE ?? "http://localhost:3000";
const ORIGIN = BASE; // the guard's documented QA header

const PLAN = [
  { jobId: "cmushyvqa000xn52wnu8g3cvw", workdir: "data/relion/cmur3ti510002n5831da9zcuk/extract_nu8g3cvw" },
  { jobId: "cmusdv4u90003n5892w5c6ex2", workdir: "data/relion/cmur3ti510002n5831da9zcuk/motioncorr_2w5c6ex2" },
  { jobId: "cmus9d1va000pn57byaf038c0", workdir: "data/relion/cmur3ti510002n5831da9zcuk/motioncorr_yaf038c0" },
];

/**
 * The two runs whose QA-fixture connections were deleted by their own
 * suites' finally blocks (t308 L597, t537 L193) — the product's refusal
 * wording names the remedy itself: "re-add it". Re-adding with the SAME id
 * through POST /api/remote/connections is the product's own shape
 * (upsertConnection accepts a client-specified id; getConnection reads the
 * registry fresh from disk every call). Bodies are the suites' original
 * recipes, verbatim.
 */
const READD_CONNECTIONS = [
  {
    id: "qa-t308-downstream", name: "QA t308 Downstream", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  },
  {
    id: "qa-t537-musdv4tr", name: "QA t537 Argv", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  },
];

const MAX_PER_CALL = 8;

async function api(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: ORIGIN, ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const remainingOf = (r) => r.body?.remaining;

async function main() {
  // ---- Phase R: re-add the deleted fixture connections (the product's own
  // "re-add it" remedy, same-id, through the connections door) --------------
  const readded = [];
  for (const conn of READD_CONNECTIONS) {
    const res = await api("/api/remote/connections", {
      method: "POST",
      body: JSON.stringify(conn),
    });
    const ok = res.status === 200 || res.status === 201;
    console.log(`${ok ? "ok" : "FAIL"}: re-add ${conn.id} (${res.status})`);
    if (!ok) { console.log("  body:", JSON.stringify(res.body).slice(0, 300)); process.exitCode = 1; }
    else readded.push(conn.id);
  }

  // ---- Phase H: bring-home through the batch sync door ---------------------
  let healed = 0;
  for (const { jobId, workdir } of PLAN) {
    console.log(`\n=== ${jobId} (${workdir.split("/").pop()}) ===`);

    const before = await api(`/api/jobs/${jobId}/outputs/remote-remaining`);
    if (!before.body?.ok) {
      console.log(`  SKIP — remote-remaining not ok: ${JSON.stringify(before.body)}`);
      continue;
    }
    console.log(`  BEFORE remaining=${remainingOf(before)}/${before.body.total}`);

    const manifest = JSON.parse(
      (await import("node:fs")).readFileSync(`${workdir}/.cf-remote-manifest.json`, "utf8")
    );
    const { existsSync } = await import("node:fs");
    const missing = manifest.files.map((f) => f.path).filter((p) => !existsSync(`${workdir}/${p}`));
    console.log(`  manifest-absent paths: ${missing.length}`);

    for (let i = 0; i < missing.length; i += MAX_PER_CALL) {
      const chunk = missing.slice(i, i + MAX_PER_CALL);
      const res = await api(`/api/jobs/${jobId}/outputs/sync`, {
        method: "POST",
        body: JSON.stringify({ paths: chunk }),
      });
      if (!res.body?.ok) {
        console.log(`  SYNC CALL FAILED (${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
        process.exitCode = 1;
        break;
      }
      for (const r of res.body.results) {
        console.log(`    ${r.ok ? "HOME" : "FAIL"} ${r.path}${r.ok ? ` (${r.bytes}b new)` : ` — ${r.error}`}`);
      }
      console.log(`  after chunk: remaining=${res.body.remaining}/${res.body.total}`);
    }

    const after = await api(`/api/jobs/${jobId}/outputs/remote-remaining`);
    const rem = remainingOf(after);
    console.log(`  AFTER  remaining=${rem}/${after.body?.total}`);
    if (rem === 0) {
      healed += 1;
      console.log("  VERDICT: HEALED — the cluster ledger is fully home");
    } else {
      console.log("  VERDICT: still out (see failures above)");
      process.exitCode = 1;
    }
  }
  console.log(`\n=== bring-home done: ${healed}/${PLAN.length} workdirs healed via the product door ===`);

  // ---- Phase C: remove the re-added fixture connections again (the suites'
  // own cleanup convention — t308 L597 / t537 L193 delete them in finally).
  // With remaining=0 the healed runs no longer need a live connection: the
  // homecoming verdict reads the manifest + local files, not the wire.
  for (const id of readded) {
    const res = await api(`/api/remote/connections/${id}`, { method: "DELETE" });
    console.log(`${res.status === 200 ? "ok" : "FAIL"}: cleanup ${id} (${res.status})`);
  }

  // ---- Phase V: the healed verdict must survive the connection cleanup ----
  let stillHealed = 0;
  for (const { jobId } of PLAN) {
    const after = await api(`/api/jobs/${jobId}/outputs/remote-remaining`);
    const rem = remainingOf(after);
    console.log(`  post-cleanup ${jobId}: remaining=${rem}/${after.body?.total}`);
    if (rem === 0) stillHealed += 1; else process.exitCode = 1;
  }
  console.log(`\n=== final: ${stillHealed}/${PLAN.length} workdirs fully home and verdict connection-independent ===`);
}

main().catch((e) => {
  console.error("live-fire crashed:", e);
  process.exit(1);
});
