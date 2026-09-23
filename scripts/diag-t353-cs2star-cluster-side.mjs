/**
 * DIAG t353 — the CLUSTER-SIDE cs2star conversion (params here, bytes there).
 *
 * The user's architecture call (2026-10): 「本地设好参数把脚本传到
 * cluster上运行，直接output在cluster上就好了，没有必要像现在这么麻烦」 —
 * the .cs datasets and the stacks live on the cluster, the star must live
 * there too, so the CONVERSION runs there: a few-KB self-contained python
 * script (the byte-faithful twin of csRowsToStar) is uploaded and exec'd
 * over SSH; the star is written straight to its cluster twin and the link
 * farm is built in-process. This suite walks the whole shape:
 *
 *   A. the run — no .cs download (workdir clean, audit has no cat of the
 *      .cs), the python invocation on the wire, the twin verified and
 *      recorded, the link farm linked, the remote manifest for the Files
 *      tab, the key numbers off the receipt line;
 *   B. BYTE-IDENTITY — the same fixture bytes through the LOCAL lane
 *      produce the identical particles.star the cluster lane wrote;
 *   C. downstream class2d consumes the twin IN PLACE (no star upload);
 *   D. re-run — idempotent, still zero download.
 *
 * The mock cluster (:3022) and the dev server must both be up.
 * CF_ROOT / CF_BASE override the defaults (the sandbox convention).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t353";
const MODULE = "relion/5.0.1";
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
const auditText = () => {
  try {
    return readFileSync(path.join(ROOT, "services/mock-cluster/fs/home/cryo/.slurm/exec-audit.log"), "utf8");
  } catch {
    return "";
  }
};

/* ---- the npy fixture builder (the t336/t352 generator, verbatim) ------ */
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
const ROD = { zero: [0, 0, 0], z90: [0, 0, Math.PI / 2] };
const PRIMARY_ROWS = [
  { uid: 101, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 0, "blob/shape": [128, 128], "alignments3D/pose": ROD.zero, "alignments3D/shift": [1.5, -2.0], "alignments3D/class": 0, "alignments3D/split": 0, "alignments3D/overall_score": 0.9 },
  { uid: 102, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 1, "blob/shape": [128, 128], "alignments3D/pose": ROD.z90, "alignments3D/shift": [-0.5, 0.25], "alignments3D/class": 2, "alignments3D/split": 1, "alignments3D/overall_score": 0.8 },
];
const PT_ROWS = PRIMARY_ROWS.map((r, i) => ({
  uid: r.uid, "blob/psize_A": 0.93, "ctf/df1_A": 12000 + i * 500, "ctf/df2_A": 12500 + i * 500,
  "ctf/phase_shift_rad": 0, "ctf/accel_kv": 300, "ctf/cs_mm": 2.7, "ctf/amp_contrast": 0.07,
  "ctf/df_angle_rad": Math.PI / 6, "ctf/exp_group_id": 0,
  "location/center_x_frac": [0.25, 0.5][i], "location/center_y_frac": [0.375, 0.5][i],
  "location/micrograph_path": "J12/imported/mic_01.mrc", "location/micrograph_shape": [4000, 5000],
}));
const primaryCs = npyBuffer(PRIMARY_FIELDS, PRIMARY_ROWS);
const ptCs = npyBuffer(PT_FIELDS, PT_ROWS);

// t366 — a REAL mode-2 float32 stack (header + zero voxels): the probe
// parses true bytes, so the fixture cannot lie its way past the gate
function mrcStackBuf(box, angpix, nz) {
  const buf = Buffer.alloc(1024 + box * box * nz * 4);
  buf.writeInt32LE(box, 0); buf.writeInt32LE(box, 4); buf.writeInt32LE(nz, 8);
  buf.writeInt32LE(2, 12); // mode 2 = float32
  buf.writeFloatLE(box * angpix, 40); buf.writeFloatLE(box * angpix, 44); buf.writeFloatLE(nz * angpix, 48);
  buf.write("MAP ", 208, "ascii");
  return buf;
}
const MOCK_FS = `${ROOT}/services/mock-cluster/fs`;
const writeMockStack = (rel, buf) => {
  const p = `${MOCK_FS}/${rel}`;
  mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  writeFileSync(p, buf);
};

let projectId = null;
let localProjectId = null;
let csJobId = null;
let csLieJobId = null;
let csMixJobId = null;
let csDegJobId = null;
let c2dJobId = null;
let localCsJobId = null;
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
  must((await api("/api/jobs", { headers: SH })).status === 200, `the dev server answers on ${BASE}`);
  if (fail > 0) throw new Error("stage not ready");

  console.log("== PHASE 1: connection + project + the J42 fixtures ==");
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  const mkConn = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t353", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t353 cs2star cluster-side", mode: "remote", remoteConnectionId: CONN }),
  });
  projectId = proj.body?.project?.id;
  must(!!projectId, `the remote project creates (${proj.status})`);
  // fresh exec audit — the wire-traffic assertions below read it
  client("rm -f ~/.slurm/exec-audit.log");
  const b64 = (b) => b.toString("base64");
  // t366 — J42's referenced stack gets a REAL header: 128 px @ 0.93 Å
  // (nz 2 — two particles), exactly what the .cs metadata claims → the
  // VERIFIED lane. The unreferenced bar stays a 1-byte stub.
  writeMockStack("data2/csproj/J42/extract/foo_particles.mrc", mrcStackBuf(128, 0.93, 2));
  writeMockStack("data2/csproj/J42/extract/bar_particles.mrc", Buffer.from("x"));
  const fx = client(
    "mkdir -p /data2/csproj/J42/extract; " +
      `echo ${b64(primaryCs)} | base64 -d > /data2/csproj/J42/cryosparc_J42_particles.cs; ` +
      `echo ${b64(ptCs)} | base64 -d > /data2/csproj/J42/J42_passthrough_particles.cs; ` +
      "ls -1 /data2/csproj/J42/extract/"
  );
  must(/foo_particles\.mrc/.test(fx), `the CS fixtures build (${fx.replace(/\n/g, " ")})`);

  console.log("== PHASE 2: the conversion runs ON the cluster ==");
  const cs = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      projectId, type: "cs2star", x: 60, y: 60, name: "CryoSPARC → RELION (t353)",
      params: { csPath: "/data2/csproj/J42", invertY: false },
    }),
  });
  csJobId = cs.body?.job?.id;
  must(!!csJobId, `the cs2star job creates (${cs.status})`);
  must((await api(`/api/jobs/${csJobId}/run`, { method: "POST", headers: SHJ, body: "{}" })).status === 200, "the run accepts");
  const done1 = await awaitTerminal(csJobId, 120_000);
  must(done1?.status === "completed", `run #1 completes (${done1?.status}: ${String(done1?.result ?? "").slice(0, 140)})`);

  const result = String(done1?.result ?? "");
  must(/2 particles converted from J42/.test(result), `T1a the receipt leads with the count (${result.slice(0, 80)})`);
  must(/converted ON the cluster in place/.test(result), "T1b the receipt says the conversion ran on the cluster");
  must(/1 of 2 \.mrc stack\(s\) linked/.test(result), "T1c the selective census speaks (foo referenced, bar not)");
  must(
    /optics verified against the stacks' own MRC headers — all 1 stack\(s\) are 128 px @ 0\.93 Å/.test(result),
    `T1d the receipt verifies the sampling against the stacks' own headers (t366: ${result.slice(80, 200)})`
  );

  const workdir = `${ROOT}/data/relion/${projectId}`;
  const jobDir = readdirSync(workdir).find((d) => d.startsWith("cs2star_"));
  must(!!jobDir, "T2a the cs2star workdir exists");
  const runOut = readFileSync(`${workdir}/${jobDir}/run.out`, "utf8");
  must(/converting ON the cluster \(/.test(runOut), "T2b run.out speaks the cluster-side phase");
  must(/cluster python: \S+python/.test(runOut), "T2c run.out names the interpreter the probe found");
  must(/--- converter output \(on the cluster\) ---/.test(runOut), "T2d the converter's own log rides the witness");
  must(/star written on the cluster:/.test(runOut), "T2e the twin verification phase speaks");
  must(
    /stack headers probed: 1 readable, 0 unreadable, 1 sampling vote/.test(runOut),
    "T2f run.out carries the stack-header probe phase (t366)"
  );

  must(!existsSync(`${workdir}/${jobDir}/particles.cs`), "T3a the primary .cs was NEVER downloaded");
  must(!existsSync(`${workdir}/${jobDir}/passthrough_particles.cs`), "T3b the passthrough .cs was NEVER downloaded");
  must(!existsSync(`${workdir}/${jobDir}/particles.star`), "T3c no local star mirror (the output lives on the cluster by design)");

  const audit1 = auditText();
  must(!/cat\s+'\/data2\/csproj\/J42\/[^']*\.cs'/.test(audit1), "T4a ZERO .cs bytes crossed the wire (no cat of either .cs in the audit)");
  must(/cs2star_cf\.py/.test(audit1), "T4b the converter script itself ran on the cluster (the exec audit shows it)");
  must(/head -c \d+ > '[^']*cs2star_cf\.py'/.test(audit1), "T4c the only upload was the few-KB converter script");

  const twinPath = `/projects/cryoflow/${projectId}/${jobDir}/particles.star`;
  const twinLs = client(`stat -c '%s' ${twinPath} 2>/dev/null`);
  must(/^\d+$/.test(twinLs) && Number(twinLs) > 0, `T5a the twin star EXISTS on the cluster (got "${twinLs}")`);
  const rec = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[csJobId] ?? null;
  must(rec?.remote?.remoteOutputs?.particles_star === twinPath, `T5b the record carries the verified twin (${rec?.remote?.remoteOutputs?.particles_star})`);
  must(rec?.remote?.mode === "direct", `T5c mode direct — the record names where the file lives, not a live session (${rec?.remote?.mode})`);

  const twinStarB64 = client(`base64 -w0 ${twinPath} 2>/dev/null`);
  const twinStar = Buffer.from(twinStarB64, "base64").toString("utf8");
  must(/1@micrographs\/foo_particles\.mrcs/.test(twinStar) && /2@micrographs\/foo_particles\.mrcs/.test(twinStar), "T6a the twin star's rows speak the link names");
  must(twinStar.includes("data_optics") && twinStar.includes("0.93") && twinStar.includes("0.07"), "T6b the optics block landed in the twin");
  must(
    twinStar.includes("_rlnOpticsGroup #16") && /\t1$/.test(twinStar.split("\n").find((l) => l.startsWith("1@")) ?? ""),
    "T6c every particle is TAGGED with its optics group (t366)"
  );

  const linkDir = `/projects/cryoflow/${projectId}/micrographs`;
  const rlFoo = client(`readlink ${linkDir}/foo_particles.mrcs 2>/dev/null`);
  must(/[/]data2[/]csproj[/]J42[/]extract[/]foo_particles[.]mrc$/.test(rlFoo), `T7a foo linked → the .mrc target (got ${rlFoo})`);
  must(client(`ls ${linkDir}/bar_particles.mrcs 2>/dev/null`) === "", "T7b the unreferenced bar stack stays unlinked (the census is honest)");

  must(existsSync(`${workdir}/${jobDir}/.cf-remote-manifest.json`), "T8a the remote manifest lets the Files tab list the star");
  const manifest = JSON.parse(readFileSync(`${workdir}/${jobDir}/.cf-remote-manifest.json`, "utf8"));
  must(
    manifest?.files?.some((f) => f.path === "particles.star" && f.size > 0) && manifest?.remoteWorkdir === twinPath.slice(0, twinPath.lastIndexOf("/")),
    "T8b the manifest names the twin dir + the verified size"
  );
  const outputs = await api(`/api/jobs/${csJobId}/outputs`, { headers: SH });
  must(
    outputs.body?.summary?.stats?.some((s) => s.key === "particles" && s.value === "2") &&
      outputs.body?.summary?.stats?.some((s) => s.key === "stacks" && s.value === "1"),
    `T9 the key numbers ride the receipt line (got ${outputs.body?.summary?.stats?.map((s) => `${s.key}=${s.value}`).join(", ") ?? "none"})`
  );

  console.log("== PHASE 2b: the CORRECTED lane — the .cs lies, the stacks do not (t366) ==");
  // the user's field report in miniature: the .cs claims 256 px @ 0.808 Å
  // (stale full-resolution metadata) over stacks that are physically the
  // 4×-binned truth (100 px @ 3.232 Å)
  const liePrim = npyBuffer(PRIMARY_FIELDS, PRIMARY_ROWS.map((r) => ({ ...r, "blob/path": "J43/extract/lie_particles.mrc", "blob/shape": [256, 256] })));
  const liePt = npyBuffer(PT_FIELDS, PT_ROWS.map((r) => ({ ...r, "blob/psize_A": 0.808 })));
  writeMockStack("data2/csproj/J43/extract/lie_particles.mrc", mrcStackBuf(100, 3.232, 2));
  client(
    `echo ${liePrim.toString("base64")} | base64 -d > /data2/csproj/J43/cryosparc_J43_particles.cs; ` +
      `echo ${liePt.toString("base64")} | base64 -d > /data2/csproj/J43/J43_passthrough_particles.cs`
  );
  const csLie = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      projectId, type: "cs2star", x: 60, y: 60, name: "CryoSPARC → RELION (t366 lie)",
      params: { csPath: "/data2/csproj/J43", invertY: false },
    }),
  });
  csLieJobId = csLie.body?.job?.id;
  must(!!csLieJobId, `the lying-.cs cs2star job creates (${csLie.status})`);
  must((await api(`/api/jobs/${csLieJobId}/run`, { method: "POST", headers: SHJ, body: "{}" })).status === 200, "the lying-.cs run accepts");
  const doneLie = await awaitTerminal(csLieJobId, 120_000);
  must(doneLie?.status === "completed", `the lying-.cs conversion completes (${doneLie?.status}: ${String(doneLie?.result ?? doneLie?.error ?? "").slice(0, 120)})`);
  const lieResult = String(doneLie?.result ?? "");
  must(
    /optics CORRECTED from the stacks' own MRC headers — all 1 stack\(s\) are 100 px @ 3\.232 Å; the \.cs metadata claimed 1 sampling variant\(s\) \(256 px @ 0\.808 Å\), every optics group now speaks the stacks' truth/.test(lieResult),
    `C1 the receipt speaks the correction (${lieResult.slice(60, 240)})`
  );
  const lieTwinPath = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[csLieJobId]?.remote?.remoteOutputs?.particles_star ?? "";
  const lieTwin = client(`base64 -w0 ${lieTwinPath} 2>/dev/null`);
  const lieStar = Buffer.from(lieTwin, "base64").toString("utf8");
  must(
    /\t100\t2\t3\.232(\r?\n|$)/.test(lieStar) && !/\t256\t2\t0\.808(\r?\n|$)/.test(lieStar),
    "C2 the corrected star's optics speak the stacks' truth (100 px @ 3.232), the lie is gone"
  );

  console.log("== PHASE 2c: the MIXED refusal — stacks that physically differ (t366) ==");
  const mixPrim = npyBuffer(PRIMARY_FIELDS, [
    { ...PRIMARY_ROWS[0], "blob/path": "J44/extract/mixfoo_particles.mrc" },
    { ...PRIMARY_ROWS[1], "blob/path": "J44/extract/mixbar_particles.mrc", "blob/idx": 0 },
  ]);
  writeMockStack("data2/csproj/J44/extract/mixfoo_particles.mrc", mrcStackBuf(100, 3.232, 2));
  writeMockStack("data2/csproj/J44/extract/mixbar_particles.mrc", mrcStackBuf(128, 0.93, 2));
  client(`echo ${mixPrim.toString("base64")} | base64 -d > /data2/csproj/J44/cryosparc_J44_particles.cs; echo ${ptCs.toString("base64")} | base64 -d > /data2/csproj/J44/J44_passthrough_particles.cs`);
  const csMix = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      projectId, type: "cs2star", x: 60, y: 60, name: "CryoSPARC → RELION (t366 mix)",
      params: { csPath: "/data2/csproj/J44", invertY: false },
    }),
  });
  csMixJobId = csMix.body?.job?.id;
  must(!!csMixJobId, `the mixed cs2star job creates (${csMix.status})`);
  must((await api(`/api/jobs/${csMixJobId}/run`, { method: "POST", headers: SHJ, body: "{}" })).status === 200, "the mixed run accepts");
  const doneMix = await awaitTerminal(csMixJobId, 120_000);
  must(doneMix?.status === "failed", `the mixed conversion FAILS honestly (${doneMix?.status})`);
  const mixErr = `${String(doneMix?.result ?? "")} ${String(doneMix?.error ?? "")}`;
  must(
    /MIX samplings/.test(mixErr) && /100 px @ 3\.232/.test(mixErr) && /128 px @ 0\.93/.test(mixErr),
    `M1 the refusal censuses both samplings (${mixErr.slice(0, 220)})`
  );

  console.log("== PHASE 2d: the DEGRADED lane — an unreadable stack, a note never a block (t366) ==");
  const degPrim = npyBuffer(PRIMARY_FIELDS, PRIMARY_ROWS.map((r) => ({ ...r, "blob/path": "J45/extract/deg_particles.mrc" })));
  writeMockStack("data2/csproj/J45/extract/deg_particles.mrc", Buffer.from("x"));
  client(`echo ${degPrim.toString("base64")} | base64 -d > /data2/csproj/J45/cryosparc_J45_particles.cs; echo ${ptCs.toString("base64")} | base64 -d > /data2/csproj/J45/J45_passthrough_particles.cs`);
  const csDeg = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      projectId, type: "cs2star", x: 60, y: 60, name: "CryoSPARC → RELION (t366 deg)",
      params: { csPath: "/data2/csproj/J45", invertY: false },
    }),
  });
  csDegJobId = csDeg.body?.job?.id;
  must(!!csDegJobId, `the degraded cs2star job creates (${csDeg.status})`);
  must((await api(`/api/jobs/${csDegJobId}/run`, { method: "POST", headers: SHJ, body: "{}" })).status === 200, "the degraded run accepts");
  const doneDeg = await awaitTerminal(csDegJobId, 120_000);
  must(doneDeg?.status === "completed", `the degraded conversion completes — a note, never a block (${doneDeg?.status})`);
  must(
    /optics from the \.cs metadata \(1 stack header\(s\) unreadable — the sampling is unverified\)/.test(String(doneDeg?.result ?? "")),
    `D1 the honest degraded note rides the receipt (${String(doneDeg?.result ?? "").slice(60, 200)})`
  );

  console.log("== PHASE 3: BYTE-IDENTITY — the local lane on the same .cs bytes ==");
  const localProj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t353 cs2star local" }),
  });
  localProjectId = localProj.body?.project?.id;
  mkdirSync("/tmp/t353-cs/J42/extract", { recursive: true });
  writeFileSync("/tmp/t353-cs/J42/extracted_particles.cs", primaryCs);
  writeFileSync("/tmp/t353-cs/J42/whatever_passthrough_particles.cs", ptCs);
  // t366 — the SAME real stack bytes the mock holds: both lanes must
  // derive the same override, or the byte-identity below is a lie
  writeFileSync("/tmp/t353-cs/J42/extract/foo_particles.mrc", mrcStackBuf(128, 0.93, 2));
  writeFileSync("/tmp/t353-cs/J42/extract/bar_particles.mrc", "x");
  const csLocal = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      projectId: localProjectId, type: "cs2star", x: 60, y: 60, name: "CryoSPARC → RELION (local twin)",
      params: { csPath: "/tmp/t353-cs/J42/extracted_particles.cs", invertY: false },
    }),
  });
  localCsJobId = csLocal.body?.job?.id;
  must(!!localCsJobId, `the local cs2star job creates (${csLocal.status})`);
  must((await api(`/api/jobs/${localCsJobId}/run`, { method: "POST", headers: SHJ, body: "{}" })).status === 200, "the local run accepts");
  const doneL = await awaitTerminal(localCsJobId, 120_000);
  must(doneL?.status === "completed", `the local conversion completes (${doneL?.status}: ${String(doneL?.result ?? "").slice(0, 120)})`);
  const localWorkdir = `${ROOT}/data/relion/${localProjectId}`;
  const localJobDir = readdirSync(localWorkdir).find((d) => d.startsWith("cs2star_"));
  const localStar = readFileSync(`${localWorkdir}/${localJobDir}/particles.star`, "utf8");
  must(localStar === twinStar, "T10 BYTE-IDENTITY: the cluster lane's star === the local lane's star on the same .cs bytes");

  // job creation + the /api/jobs listing speak the ACTIVE project — the
  // local project just took the pointer; hand it back before the remote
  // project's downstream walk
  const sw = await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  must(sw.status === 200 && sw.body?.active === projectId, `the active project returns to the remote one (${sw.status})`);

  console.log("== PHASE 4: downstream class2d consumes the twin IN PLACE ==");
  const c2d = await api("/api/jobs", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ projectId, type: "class2d", x: 200, y: 60, name: "2D Classification (t353)", params: { numClasses: 2, iterations: 2 } }),
  });
  c2dJobId = c2d.body?.job?.id;
  must(!!c2dJobId, `the class2d job creates (${c2d.status})`);
  const edge = await api("/api/edges", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ fromJobId: csJobId, toJobId: c2dJobId, fromPort: "particles", toPort: "particles" }),
  });
  must(edge.status === 200 || edge.status === 201, `the edge wires cs2star → class2d (${edge.status}: ${JSON.stringify(edge.body).slice(0, 200)})`);
  const d2d = await api(`/api/jobs/${c2dJobId}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: MODULE, mode: "slurm" } }),
  });
  must(d2d.status >= 200 && d2d.status < 300 && !d2d.body?.error, `the class2d dispatch accepts (${d2d.status}: ${String(d2d.body?.error ?? "").slice(0, 120)})`);
  const done2d = await awaitTerminal(c2dJobId, 240_000);
  must(done2d?.status === "completed", `the class2d COMPLETES off the twin + linked stacks (${done2d?.status ?? "stuck"}: ${String(done2d?.result ?? "").slice(0, 140)})`);
  const audit4 = auditText();
  must(!/head -c \d+ > '[^']*particles\.star'/.test(audit4), "T11 the star was NEVER uploaded for the downstream job (the twin is consumed in place)");
  must(new RegExp(twinPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(audit4), "T12 the dispatch's wire traffic names the twin path (the argv reads it)");

  console.log("== PHASE 5: re-run — idempotent, still zero download ==");
  const r2 = await api(`/api/jobs/${csJobId}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(r2.status === 200, `the re-run accepts (${r2.status})`);
  const done2 = await awaitTerminal(csJobId, 120_000);
  must(done2?.status === "completed", `the re-run completes (${done2?.status ?? "stuck"}: ${String(done2?.result ?? "").slice(0, 140)})`);
  must(/converted ON the cluster in place/.test(String(done2?.result ?? "")), "T13 the re-run converts on the cluster again (idempotent)");
  must(!existsSync(`${workdir}/${jobDir}/particles.cs`), "T14 the re-run STILL downloaded nothing");
} catch (e) {
  console.error("DIAG aborted:", e);
  must(false, "the diag ran to completion", String(e?.stack ?? e));
} finally {
  console.log("== CLEANUP ==");
  for (const id of [csJobId, csLieJobId, csMixJobId, csDegJobId, c2dJobId, localCsJobId]) {
    if (id) await api(`/api/jobs/${id}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  }
  if (projectId) {
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SHJ }).catch(() => {});
    client(`rm -rf /projects/cryoflow/${projectId}`);
  }
  if (localProjectId) await api(`/api/projects/${localProjectId}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  client("rm -rf /data2/csproj");
  try { rmSync("/tmp/t353-cs", { recursive: true, force: true }); } catch {}
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  console.log("  cleaned: jobs, projects (+cluster twin dirs), CS fixtures, connection");
}

const ok = fail === 0;
console.log(`\nDIAG t353 cs2star cluster-side: ${ok ? "ALL GREEN" : `${fail} FAILURES`}`);
process.exit(ok ? 0 : 1);
