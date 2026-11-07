#!/usr/bin/env node
/**
 * t537 — the remote argv speaks the pipeliner dialect, live-fired.
 *
 * t535 made the STAGED star rows project-relative; the argv itself still
 * spoke cluster-absolute (--o /projects/…, --i twins absolute). This
 * window hands buildArgv the project-relative workdir and twins, so every
 * path the real binary derives resolves against its cwd (the script's
 * `cd remoteProjectRoot`, t316, both lanes) — and no absolute row can be
 * born downstream (the deep per-mic nesting t535's census walked 11
 * levels to reach is structurally dead).
 *
 * The proof, on the live standalone:
 *   1. movies import (nodeType:movies) completes locally
 *   2. motioncorr dispatches direct-mode to the mock cluster
 *   3. the submitted .cf-run.sh's COMMAND line carries a RELATIVE --o and
 *      a relative --i (no /projects/cryoflow token anywhere in the argv)
 *   4. the run COMPLETES and its outputs register (the mirror law holds)
 *   5. the synced-back corrected star's rows are project-relative —
 *      zero host-absolute tokens (the t535 monster, retired)
 *
 * Cleanup: jobs + connection deleted (the world-guard law).
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();


const BASE = process.env.BASE ?? "http://localhost:3000";
const ROOT = "/home/z/my-project";
const MICS_DIR = `${ROOT}/data/relion/t537-argv/mics`;
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
// the mock cluster's exec door — the same primitive every suite uses
// (test-client.mjs speaks ssh2 directly; this box has no system ssh)
const exec = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  }).stdout?.trim() ?? "";

const createdJobs = [];
const must = (ok, msg) => {
  console.log(`  ${ok ? "ok" : "FAIL"}: ${msg}`);
  if (!ok) process.exitCode = 1;
};

// 1 — four-frame 64² movie stacks (the t536 recipe)
mkdirSync(MICS_DIR, { recursive: true });
const N_FRAMES = 4;
for (let i = 1; i <= 3; i++) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4 * N_FRAMES);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(N_FRAMES, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(N_FRAMES, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77 * N_FRAMES, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let s = 0; s < N_FRAMES; s++) {
    for (let p = 0; p < W * H; p++) buf.writeFloatLE(Math.sin(p / 7 + s) * 0.1, 1024 + (s * W * H + p) * 4);
  }
  writeFileSync(join(MICS_DIR, `mic_${String(i).padStart(3, "0")}.mrc`), buf);
}
must(existsSync(join(MICS_DIR, "mic_001.mrc")), "three 4-frame movie stacks fabricated (the t536 recipe)");

const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
  return b.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
  });
  return r.status;
};
const readJob = async (id) => {
  const d = await (await fetch(`${BASE}/api/jobs`)).json();
  return (d.jobs ?? []).find((x) => x.id === id) ?? null;
};

const importJob = await mkJob({
  type: "import", name: "t537 Argv Import",
  params: { micrographsPath: MICS_DIR, pixelSize: 1.77, nodeType: "movies" },
});
must(!!importJob?.id, "the movies import exists");
await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
const importDone = await (async () => {
  for (let i = 0; i < 40; i++) {
    const j = await readJob(importJob.id);
    if (j?.status === "completed") return j;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
})();
must(!!importDone, "the local import completed");

const connId = `qa-t537-${Date.now().toString(36)}`;
const mk = await fetch(`${BASE}/api/remote/connections`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({
    id: connId, name: "QA t537 Argv", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  }),
});
must(mk.status === 201, `the probeless connection is created (got ${mk.status})`);

const jobM = await mkJob({ type: "motioncorr", name: "t537 Argv MC", params: { do_own_motioncor: true } });
const eM = await mkEdge(importJob.id, jobM.id, "movies", "movies");
must(eM === 200 || eM === 201, `import → motioncorr wired (${eM})`);
const disp = await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
  method: "POST", headers: { "Content-Type": "application/json", ...SH },
  body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
});
const dispBody = await disp.json().catch(() => ({}));
must(disp.status === 200 && !dispBody.error, `the dispatch is accepted (${disp.status}${dispBody.error ? " " + dispBody.error : ""})`);

// 3 — the submitted script's COMMAND line speaks the relative dialect
const rec = await (async () => {
  for (let i = 0; i < 60; i++) {
    const raw = readFileSync(`${ROOT}/data/engine-state.json`, "utf8");
    const runs = JSON.parse(raw);
    const r = runs[jobM.id];
    if (r?.remote?.remoteWorkdir && existsSync(`${ROOT}/data/relion`)) return r;
    await new Promise((res) => setTimeout(res, 500));
  }
  return null;
})();
const remoteWd = rec?.remote?.remoteWorkdir ?? "";
must(remoteWd.startsWith("/projects/cryoflow/"), `the record carries the cluster workdir (${remoteWd})`);
// the wrapper lands AFTER the record's remoteWorkdir is written (staging
// beats the spawn) — poll for it, never a one-shot cat (the t537 probe's
// own first lesson: a race here reads as "the script is not on the cluster")
let runSh = "";
for (let i = 0; i < 40 && !runSh; i++) {
  await new Promise((r) => setTimeout(r, i === 0 ? 0 : 1000));
  runSh = await exec(`cat ${remoteWd}/.cf-run.sh 2>/dev/null`);
}
must(runSh.length > 0, "the submitted wrapper script is on the cluster");
const cmdLine = runSh.split("\n").find((l) => l.includes("--i") && l.includes("--o")) ?? "";
must(cmdLine.length > 0, `the command line is present (${cmdLine.slice(0, 60)}…)`);
console.log(`  (cmd: ${cmdLine.slice(0, 400)})`);
// the project root the script cds to — the argv's relative dialect lives
// under THIS (the workdir segment alone; the probe's first draft wrongly
// expected the project segment inside the flag values)
const remoteProjectRoot = `/projects/cryoflow/${jobM.projectId}`;
const wdRel = remoteWd.slice(remoteProjectRoot.length + 1);
// the flag values the RELION binary itself reads — every path flag must be
// project-relative (the redirect targets after `>` are infrastructure and
// keep the absolute form by design)
const argvPortion = cmdLine.split(">")[0].split("|")[0];
const flagVals = [...argvPortion.matchAll(/(?:--o|--odir|--output-directory|--i|--part_dir|--continue)\s+('[^']*'|"[^"]*"|\S+)/g)].map((m) => m[1].replace(/^['"]|['"]$/g, ""));
must(flagVals.length >= 2, `path flags found (${flagVals.length})`);
must(flagVals.every((v) => !v.startsWith("/")), `every path flag value is project-relative (${JSON.stringify(flagVals)})`);
must(flagVals.some((v) => v === `${wdRel}/` || v === wdRel), `the --o speaks the workdir's relative name (${wdRel}/)`);

// 4 — the run completes and its outputs register (the mirror law holds)
const done = await (async () => {
  for (let i = 0; i < 120; i++) {
    const j = await readJob(jobM.id);
    if (j?.status === "completed" || j?.status === "failed") return j;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
})();
must(done?.status === "completed", `the remote motioncorr completed (got ${done?.status ?? "timeout"})`);

// 5 — the synced-back corrected star speaks relative rows
const localWd = `${ROOT}/data/relion/${jobM.projectId}/motioncorr_${jobM.id.slice(-8)}`;
const correctedStar = join(localWd, "corrected_micrographs.star");
const starTxt = existsSync(correctedStar) ? readFileSync(correctedStar, "utf8") : "";
must(starTxt.length > 0, "the corrected star synced back");
must(
  !/\/projects\/cryoflow|\/home\/z/.test(starTxt.split("\n").filter((l) => l && !l.startsWith("#") && !l.startsWith("data_") && !l.startsWith("loop_")).join("\n")),
  "the corrected star's data rows carry NO absolute tokens (relative pipeliner dialect)"
);
must(starTxt.includes("mic_001"), "the corrected star names its movies");

for (const id of createdJobs) {
  await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => {});
}
await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH }).catch(() => {});
console.log("  (cleanup: jobs + connection deleted)");
console.log(process.exitCode ? "t537 argv dialect live-fire: FAIL" : "t537 argv dialect live-fire: ALL PASS");
