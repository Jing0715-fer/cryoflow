/**
 * DIAG t352 — the cs2star CLUSTER TWIN via the FALLBACK lane (no python).
 *
 * The field report (2026-09-22, J999 · 325,549 particles): the conversion
 * linked 10,664 stacks ON the cluster but wrote particles.star ONLY to
 * the local workdir — "the cluster has no output of this job, and all
 * subsequent computation runs there". t352-c fixed the shape:
 *
 *   1. the converted star is UPLOADED to the cluster at the mirror-mapped
 *      job dir (<remoteRoot>/<projectId>/<jobKey>/particles.star), size-
 *      VERIFIED, and recorded as the run record's remoteOutputs twin —
 *      downstream cluster jobs read it IN PLACE (no re-upload);
 *   2. re-running the SAME conversion does not re-download the same .cs
 *      bytes (the workdir's cached copies are size-checked against the
 *      remote and reused when unchanged).
 *
 * t353 note: the PRIMARY cluster lane now converts ON the cluster (see
 * diag-t353-cs2star-cluster-side.mjs); this suite pins the FALLBACK lane
 * that serves clusters WITHOUT python3+numpy. The mock is made python-less
 * for the run: a failing python3/python shim lands in the mock's /opt/bin
 * (first on its PATH), so the engine's probe hears a clean "no python"
 * and takes the download → convert locally → upload lane. The shim is
 * removed in the cleanup — run this suite ALONE, not concurrently with
 * suites that need the mock's real python.
 *
 * The mock cluster (:3022) and the dev server must both be up.
 * CF_ROOT / CF_BASE override the defaults (the sandbox convention).
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t352";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 60_000,
  }).stdout?.trim() ?? "";
const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const awaitTerminal = async (id, deadlineMs) => {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === id);
    if (j && j.status !== "running" && j.status !== "pending") return j;
    await sleep(700);
  }
  return null;
};

/* ---- the npy fixture builder (the t336 generator, verbatim) ---------- */
const F = (name, dtype, shape) => ({ name, dtype, shape: shape ?? null });
function npyBuffer(fields, rows) {
  const descr = fields.map((f) =>
    f.shape ? `('${f.name}', '${f.dtype}', (${f.shape.join(",")},))` : `('${f.name}', '${f.dtype}')`
  );
  let header = `{'descr': [${descr.join(", ")}], 'fortran_order': False, 'shape': (${rows.length},), }`;
  let pad = 64 - ((10 + header.length + 1) % 64);
  if (pad < 0) pad += 64;
  header += " ".repeat(pad) + "\n";
  const headLen = Buffer.alloc(2);
  headLen.writeUInt16LE(header.length);
  const out = [Buffer.from([0x93]), Buffer.from("NUMPY"), Buffer.from([1, 0]), headLen, Buffer.from(header, "latin1")];
  for (const row of rows) {
    for (const f of fields) {
      const v = row[f.name];
      const m = /^([<>|])?([biufSUV])(\d+)$/.exec(f.dtype);
      const kind = m[2];
      const n = Number(m[3]);
      if (kind === "U") {
        const b = Buffer.alloc(4 * n);
        const s = String(v);
        for (let i = 0; i < Math.min(s.length, n); i++) b.writeUInt32LE(s.codePointAt(i) ?? 0, 4 * i);
        out.push(b);
      } else if (kind === "S") {
        const b = Buffer.alloc(n);
        b.write(String(v), 0, n, "utf8");
        out.push(b);
      } else {
        const prod = f.shape ? f.shape.reduce((a, b) => a * b, 1) : 1;
        const b = Buffer.alloc(n * prod);
        const vals = Array.isArray(v) ? v : [v];
        for (let i = 0; i < prod; i++) {
          const val = Number(vals[i] ?? 0);
          if (kind === "f") {
            if (n === 4) b.writeFloatLE(val, i * 4);
            else b.writeDoubleLE(val, i * 8);
          } else if (kind === "i" && n === 8) b.writeBigInt64LE(BigInt(Math.round(val)), i * 8);
          else if (kind === "i" && n === 4) b.writeInt32LE(Math.round(val), i * 4);
          else if (kind === "u" && n === 4) b.writeUInt32LE(Math.round(val), i * 4);
        }
        out.push(b);
      }
    }
  }
  return Buffer.concat(out);
}
const PRIMARY_FIELDS = [
  F("uid", "<i8"), F("blob/path", "<U64"), F("blob/idx", "<i4"), F("blob/shape", "<i4", [2]),
  F("alignments3D/pose", "<f4", [3]), F("alignments3D/shift", "<f4", [2]),
  F("alignments3D/class", "<i4"), F("alignments3D/split", "<i4"), F("alignments3D/overall_score", "<f4"),
];
const PT_FIELDS = [
  F("uid", "<i8"), F("blob/psize_A", "<f8"), F("ctf/df1_A", "<f8"), F("ctf/df2_A", "<f8"),
  F("ctf/df_angle_rad", "<f4"), F("ctf/phase_shift_rad", "<f4"), F("ctf/accel_kv", "<f4"),
  F("ctf/cs_mm", "<f4"), F("ctf/amp_contrast", "<f4"), F("ctf/exp_group_id", "<i4"),
  F("location/center_x_frac", "<f4"), F("location/center_y_frac", "<f4"),
  F("location/micrograph_path", "<U64"), F("location/micrograph_shape", "<i4", [2]),
];
const ROD = { zero: [0, 0, 0], z90: [0, 0, Math.PI / 2], y180: [0, Math.PI, 0] };
const PRIMARY_ROWS = [
  { uid: 101, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 0, "blob/shape": [128, 128], "alignments3D/pose": ROD.zero, "alignments3D/shift": [1.5, -2.0], "alignments3D/class": 0, "alignments3D/split": 0, "alignments3D/overall_score": 0.9 },
  { uid: 102, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 1, "blob/shape": [128, 128], "alignments3D/pose": ROD.z90, "alignments3D/shift": [-0.5, 0.25], "alignments3D/class": 2, "alignments3D/split": 1, "alignments3D/overall_score": 0.8 },
];
const PT_ROWS = PRIMARY_ROWS.map((r, i) => ({
  uid: r.uid, "blob/psize_A": 0.93, "ctf/df1_A": 12000 + i * 500, "ctf/df2_A": 12500 + i * 500,
  "ctf/phase_shift_rad": 0, "ctf/angle_rad": 0, "ctf/accel_kv": 300, "ctf/cs_mm": 2.7, "ctf/amp_contrast": 0.07,
  "ctf/df_angle_rad": Math.PI / 6, "ctf/exp_group_id": 0,
  "location/center_x_frac": [0.25, 0.5][i], "location/center_y_frac": [0.375, 0.5][i],
  "location/micrograph_path": "J12/imported/mic_01.mrc", "location/micrograph_shape": [4000, 5000],
}));
const primaryCs = npyBuffer(PRIMARY_FIELDS, PRIMARY_ROWS);
const ptCs = npyBuffer(PT_FIELDS, PT_ROWS);

let projectId = null;
let csJobId = null;
try {
  console.log("== PHASE 0: the stage ==");
  const mockUp = await new Promise((resolve) => {
    const s = new net.Socket();
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(1200);
    s.once("connect", () => done(true));
    s.once("timeout", () => done(false));
    s.once("error", () => done(false));
    s.connect(3022, "127.0.0.1");
  });
  must(mockUp, "the mock cluster answers on :3022");
  must((await api("/api/jobs", { headers: SH })).status === 200, "the dev server answers on :3001");
  if (fail > 0) throw new Error("stage not ready");

  console.log("== PHASE 1: connection + project + the J42 fixtures ==");
  // t353 — make the mock python-less so the engine's probe takes THIS
  // suite's lane: a failing python3/python shim in the mock's fs/opt/bin
  // (FIRST on the mock's command PATH — /opt/bin is not one of the
  // translated mount prefixes, so the shim is written at the HOST path
  // the mock actually resolves). Cleanup removes it.
  const shimDir = path.join(ROOT, "services/mock-cluster/fs/opt/bin");
  for (const n of ["python3", "python"]) {
    writeFileSync(path.join(shimDir, n), "#!/bin/bash\nexit 1\n", "utf8");
    chmodSync(path.join(shimDir, n), 0o755);
  }
  const shim = client("command -v python3");
  must(/[/]opt[/]bin[/]python3$/.test(shim), `the python-less shim is first on the mock's PATH (${shim})`);
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  const mkConn = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t352", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t352 cs2star twin", mode: "remote", remoteConnectionId: CONN }),
  });
  projectId = proj.body?.project?.id;
  must(!!projectId, `the remote project creates (${proj.status})`);
  const b64 = (b) => b.toString("base64");
  const fx = client(
    "mkdir -p /data2/csproj/J42/extract; " +
      `echo ${b64(primaryCs)} | base64 -d > /data2/csproj/J42/cryosparc_J42_particles.cs; ` +
      `echo ${b64(ptCs)} | base64 -d > /data2/csproj/J42/J42_passthrough_particles.cs; ` +
      "for s in foo bar; do printf 'x' > /data2/csproj/J42/extract/${s}_particles.mrc; done; " +
      "ls -1 /data2/csproj/J42/extract/"
  );
  must(/foo_particles\.mrc/.test(fx), `the CS fixtures build (${fx.replace(/\n/g, " ")})`);

  console.log("== PHASE 2: run #1 — the twin lands on the cluster ==");
  const cs = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      projectId, type: "cs2star", x: 60, y: 60, name: "CryoSPARC → RELION (t352)",
      params: { csPath: "/data2/csproj/J42", invertY: false },
    }),
  });
  csJobId = cs.body?.job?.id;
  must(!!csJobId, `the cs2star job creates (${cs.status})`);
  must((await api(`/api/jobs/${csJobId}/run`, { method: "POST", headers: SHJ, body: "{}" })).status === 200, "run #1 accepted");
  const done1 = await awaitTerminal(csJobId, 120_000);
  must(done1?.status === "completed", `run #1 completes (${done1?.status}: ${String(done1?.result ?? "").slice(0, 100)})`);

  const result = String(done1?.result ?? "");
  must(/star saved on the cluster/.test(result), "T1a the receipt says the star is saved on the cluster");
  const workdir = `${ROOT}/data/relion/${projectId}`;
  const { readdirSync } = await import("node:fs");
  const jobDir = readdirSync(workdir).find((d) => d.startsWith("cs2star_"));
  must(!!jobDir, "T1b the cs2star workdir exists");
  const runOut = readFileSync(`${workdir}/${jobDir}/run.out`, "utf8");
  const twinPath = `/projects/cryoflow/${projectId}/${jobDir}/particles.star`;
  must(/no python3\+numpy in the cluster's login shell — falling back/.test(runOut), "T0 the probe heard a clean 'no python' and the FALLBACK lane speaks it");
  must(runOut.includes(`uploading: particles.star`), "T2a run.out speaks the upload phase");
  must(runOut.includes(`output: ${twinPath} (cluster) + local mirror:`), "T2b run.out speaks BOTH paths (cluster twin first, local mirror second)");

  const rec = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[csJobId] ?? null;
  must(rec?.remote?.remoteOutputs?.particles_star === twinPath,
    `T3 the record carries the VERIFIED twin (got ${rec?.remote?.remoteOutputs?.particles_star})`);
  must(rec?.remote?.host === "127.0.0.1:3022", `T3b the twin is bound to THIS cluster's identity (${rec?.remote?.host})`);

  const twinLs = client(`stat -c '%s' ${twinPath} 2>/dev/null`);
  must(/^\d+$/.test(twinLs) && Number(twinLs) > 0, `T4 the twin file EXISTS on the cluster with size > 0 (got "${twinLs}")`);
  const localStar = readFileSync(`${workdir}/${jobDir}/particles.star`, "utf8");
  const twinStarB64 = client(`base64 -w0 ${twinPath} 2>/dev/null`);
  must(Buffer.from(twinStarB64, "base64").toString("utf8") === localStar, "T5 the twin's BYTES are the converted star (byte-identical to the local mirror)");

  console.log("== PHASE 3: run #2 (re-run) — the .cs dedupe ==");
  const r2 = await api(`/api/jobs/${csJobId}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(r2.status === 200, `re-run accepted (${r2.status})`);
  const done2 = await awaitTerminal(csJobId, 120_000);
  must(done2?.status === "completed", `run #2 completes (${done2?.status})`);
  const runOut2 = readFileSync(`${workdir}/${jobDir}/run.out`, "utf8");
  // the SECOND run's receipt block (the log appends — read after the 2nd header)
  const secondBlock = runOut2.slice(runOut2.indexOf("CryoFlow engine-native", 10));
  must(/reusing cached particles\.cs/.test(secondBlock), "D1 the re-run REUSES the cached particles.cs (no re-download)");
  must(/passthrough_particles\.cs \([^)]*remote unchanged\)/.test(secondBlock), "D2 the passthrough is reused too (the one-line receipt names both)");
  must(!/downloaded: /.test(secondBlock), "D3 run #2 downloaded NOTHING (the mock's exec audit confirms: zero cat commands)");
  must(/star saved on the cluster/.test(String(done2?.result ?? "")), "D4 the twin re-uploads + re-verifies on the re-run (idempotent)");
  const rec2 = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[csJobId] ?? null;
  must(rec2?.remote?.remoteOutputs?.particles_star === twinPath, "D5 the record still carries the twin after the re-run");
} catch (e) {
  console.error("DIAG aborted:", e);
  must(false, "the diag ran to completion", String(e?.stack ?? e));
} finally {
  console.log("== CLEANUP ==");
  for (const n of ["python3", "python"]) {
    try { rmSync(path.join(ROOT, "services/mock-cluster/fs/opt/bin", n), { force: true }); } catch {}
  }
  if (csJobId) await api(`/api/jobs/${csJobId}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  if (projectId) {
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SHJ }).catch(() => {});
    client(`rm -rf /projects/cryoflow/${projectId}`);
  }
  client("rm -rf /data2/csproj");
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  console.log("  cleaned: job, project (+cluster twin dir), CS fixtures, connection");
}

const ok = fail === 0;
console.log(`\nDIAG t352 cs2star cluster twin + dedupe: ${ok ? "ALL GREEN" : `${fail} FAILURES`}`);
process.exit(ok ? 0 : 1);
