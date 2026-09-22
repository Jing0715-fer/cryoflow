#!/usr/bin/env bun
/**
 * t336 diag — the CryoSPARC .cs → RELION star conversion job, verified
 * live against the reference script's own workflow
 * (upload/cryosmart_relion_trans3.0.sh: pyem csparc2star --inverty + link
 * the extract dir's .mrc stacks as .mrcs).
 *
 * THE ASK:
 *   「把cryosparc的cs文件转成star文件的job，并可以在cryoflow中直接用于后续job
 *    运行的」 + 「检测star文件中需要哪些颗粒文件再link过来改名，而不是将project
 *    中所有的颗粒文件都link过来」 — the SELECTIVE-LINK optimization.
 *
 * THE IMPLEMENTATION (native, no pyem/Python anywhere):
 *   cs-npy.ts    — numpy .npy structured reader (Python-literal header,
 *                  subarray dtypes, U/S strings)
 *   cs2star.ts   — pyem's field table (verified against asarnow/pyem
 *                  master): uid join, Rodrigues→Euler (Shoemake), CTF Å
 *                  units, rad→deg, 0→1-based optics/class/subset, the
 *                  optics block, and the stack census that names the links
 *   engine lane  — SSH discover (J### → newest particles.cs + first
 *                  passthrough) → download → convert → verify the
 *                  referenced targets exist → ln -sfn ONLY those (as
 *                  .mrcs) under the project's micrographs/ → the star's
 *                  rows speak the link names
 *
 * PHASES:
 *  A. UNIT — the npy parser against a hand-built writer; the pyem math
 *     (expmap/rot2euler round-trip through pyem's OWN euler2rot); the
 *     converter's table (uid join, units, 1-based lifts, the link plan's
 *     collision suffix, unmapped fields).
 *  B. LIVE REMOTE — the reference script's exact workflow on the mock:
 *     a CS project with 3 stacks (foo/bar/baz — baz UNREFERENCED), a
 *     primary + passthrough .cs pair → the job converts, links ONLY the
 *     2 referenced stacks (baz untouched — the optimization witness),
 *     the star carries the numbers, and class2d downstream DISPATCHES to
 *     the cluster and completes off the linked stacks.
 *  C. LIVE LOCAL — the same .cs pair on this machine: local links, local
 *     star, same census.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t336";
const MODULE = "relion/5.0.1";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 800) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  }).stdout?.trim() ?? "";

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
let projectId = null;
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  if (b?.job?.projectId) projectId = b.job.projectId;
  return b?.job;
};

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

/* ================================================================== */
/* The npy WRITER — the parser's mirror (the fixture generator)         */
/* ================================================================== */

/** field spec: name + numpy typestr (+ subarray shape) */
const F = (name, dtype, shape) => ({ name, dtype, shape: shape ?? null });

function npyBuffer(fields, rows) {
  const descr = fields.map((f) =>
    f.shape ? `('${f.name}', '${f.dtype}', (${f.shape.join(",")},))` : `('${f.name}', '${f.dtype}')`
  );
  let header = `{'descr': [${descr.join(", ")}], 'fortran_order': False, 'shape': (${rows.length},), }`;
  // pad to 64-byte alignment of the total (10-byte magic+ver+len)
  const base = 10;
  let pad = 64 - ((base + header.length + 1) % 64);
  if (pad < 0) pad += 64;
  header += " ".repeat(pad) + "\n";
  const headLen = Buffer.alloc(2);
  headLen.writeUInt16LE(header.length);
  const out = [Buffer.from([0x93]), Buffer.from("NUMPY"), Buffer.from([1, 0]), headLen, Buffer.from(header, "latin1")];

  const width = (f) => {
    const m = /^([<>|])?([biufSUV])(\d+)$/.exec(f.dtype);
    const n = Number(m[3]);
    const kind = m[2];
    const prod = f.shape ? f.shape.reduce((a, b) => a * b, 1) : 1;
    return (kind === "U" ? 4 * n : n) * prod;
  };
  for (const row of rows) {
    for (const f of fields) {
      const v = row[f.name];
      const m = /^([<>|])?([biufSUV])(\d+)$/.exec(f.dtype);
      const kind = m[2];
      const n = Number(m[3]);
      if (kind === "U") {
        const chars = f.shape ? v.length / 1 : 1;
        void chars;
        const b = Buffer.alloc(4 * n);
        const s = String(v);
        for (let i = 0; i < Math.min(s.length, n); i++) b.writeUInt32LE(s.codePointAt(i) ?? 0, 4 * i);
        out.push(b);
      } else if (kind === "S") {
        const b = Buffer.alloc(n);
        b.write(String(v), 0, n, "utf8");
        out.push(b);
      } else if (kind === "f" || kind === "i" || kind === "u" || kind === "b") {
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
          else if (kind === "u" && n === 8) b.writeBigUInt64LE(BigInt(Math.round(val)), i * 8);
        }
        out.push(b);
      }
    }
  }
  void width;
  return Buffer.concat(out);
}

/* ================================================================== */
/* The fixture dataset — a CryoSPARC J42 extract + refinement export   */
/* ================================================================== */

const PRIMARY_FIELDS = [
  F("uid", "<i8"),
  F("blob/path", "<U64"),
  F("blob/idx", "<i4"),
  F("blob/shape", "<i4", [2]),
  F("alignments3D/pose", "<f4", [3]),
  F("alignments3D/shift", "<f4", [2]),
  F("alignments3D/class", "<i4"),
  F("alignments3D/split", "<i4"),
  F("alignments3D/overall_score", "<f4"), // UNMAPPED witness
];
const PT_FIELDS = [
  F("uid", "<i8"),
  F("blob/psize_A", "<f8"),
  F("ctf/df1_A", "<f8"),
  F("ctf/df2_A", "<f8"),
  F("ctf/df_angle_rad", "<f4"),
  F("ctf/phase_shift_rad", "<f4"),
  F("ctf/accel_kv", "<f4"),
  F("ctf/cs_mm", "<f4"),
  F("ctf/amp_contrast", "<f4"),
  F("ctf/exp_group_id", "<i4"),
  F("location/center_x_frac", "<f4"),
  F("location/center_y_frac", "<f4"),
  F("location/micrograph_path", "<U64"),
  F("location/micrograph_shape", "<i4", [2]),
];

// Rodrigues vectors: identity, 90° about z (→ psi=90), 180° about y
const ROD = {
  zero: [0, 0, 0],
  z90: [0, 0, Math.PI / 2],
  y180: [0, Math.PI, 0],
};

const PRIMARY_ROWS = [
  { uid: 101, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 0, "blob/shape": [128, 128], "alignments3D/pose": ROD.zero, "alignments3D/shift": [1.5, -2.0], "alignments3D/class": 0, "alignments3D/split": 0, "alignments3D/overall_score": 0.9 },
  { uid: 102, "blob/path": "J42/extract/foo_particles.mrc", "blob/idx": 1, "blob/shape": [128, 128], "alignments3D/pose": ROD.z90, "alignments3D/shift": [-0.5, 0.25], "alignments3D/class": 2, "alignments3D/split": 1, "alignments3D/overall_score": 0.8 },
  { uid: 103, "blob/path": "J42/extract/bar_particles.mrc", "blob/idx": 0, "blob/shape": [128, 128], "alignments3D/pose": ROD.y180, "alignments3D/shift": [0, 0], "alignments3D/class": 1, "alignments3D/split": 0, "alignments3D/overall_score": 0.7 },
];
const PT_ROWS = PRIMARY_ROWS.map((r, i) => ({
  uid: r.uid,
  "blob/psize_A": 0.93,
  "ctf/df1_A": 12000 + i * 500,
  "ctf/df2_A": 12500 + i * 500,
  "ctf/df_angle_rad": Math.PI / 6,
  "ctf/phase_shift_rad": 0,
  "ctf/accel_kv": 300,
  "ctf/cs_mm": 2.7,
  "ctf/amp_contrast": 0.07,
  "ctf/exp_group_id": 0,
  "location/center_x_frac": [0.25, 0.5, 0.75][i],
  "location/center_y_frac": [0.375, 0.5, 0.625][i],
  "location/micrograph_path": "J12/imported/mic_01.mrc",
  "location/micrograph_shape": [4000, 5000], // [y, x]
}));

const primaryCs = npyBuffer(PRIMARY_FIELDS, PRIMARY_ROWS);
const ptCs = npyBuffer(PT_FIELDS, PT_ROWS);

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  // ====================================================================
  console.log("== PHASE A: UNIT — the parser + the pyem math + the table ==");

  const npy = await import(`${ROOT}/src/lib/relion/cs-npy.ts`);
  const conv = await import(`${ROOT}/src/lib/relion/cs2star.ts`);

  // A1 — the parser reads our own writer's output (the round trip)
  {
    const table = npy.parseNpyHeader(primaryCs);
    must(table.rows === 3, `A1a the row count reads (got ${table.rows})`);
    must(table.itemSize === 8 + 256 + 4 + 8 + 12 + 8 + 4 + 4 + 4, `A1b the packed record width (got ${table.itemSize})`);
    const row0 = npy.npyRow(primaryCs, table, 0);
    must(row0["uid"] === 101, "A1c the <i8 uid reads");
    must(row0["blob/path"] === "J42/extract/foo_particles.mrc", `A1d the <U64 string reads (got ${JSON.stringify(row0["blob/path"])})`);
    must(JSON.stringify(row0["alignments3D/pose"]) === JSON.stringify([0, 0, 0]), "A1e the (3,) subarray reads");
    must(row0["alignments3D/class"] === 0, "A1f the scalar int reads");
    const table2 = npy.parseNpyHeader(ptCs);
    const row2 = npy.npyRow(ptCs, table2, 2);
    must(Math.abs(row2["ctf/df1_A"] - 13000) < 1e-9, `A1g the <f8 double reads (got ${row2["ctf/df1_A"]})`);
    must(JSON.stringify(row2["location/micrograph_shape"]) === JSON.stringify([4000, 5000]), "A1h the (2,) int subarray reads");
  }

  // A2 — garbage refusals are honest
  {
    const bad = Buffer.from("not an npy file at all, just text");
    let threw = false;
    try {
      npy.parseNpyHeader(bad);
    } catch {
      threw = true;
    }
    must(threw, "A2 a non-npy buffer refuses with a throw");
  }

  // A3 — the pyem math round-trip: euler2rot(rot2euler(expmap(v))) ≈ expmap(v)
  // (euler2rot below is pyem's OWN formula, retyped from geom/convert.py —
  // an independent transcription cross-validating the main implementation)
  {
    const euler2rot = (alpha, beta, gamma) => {
      const ca = Math.cos(alpha), cb = Math.cos(beta), cg = Math.cos(gamma);
      const sa = Math.sin(alpha), sb = Math.sin(beta), sg = Math.sin(gamma);
      const cc = cb * ca, cs = cb * sa, sc = sb * ca, ss = sb * sa;
      return [cg * cc - sg * sa, cg * cs + sg * ca, -cg * sb,
              -sg * cc - cg * sa, -sg * cs + cg * ca, sg * sb,
              sc, ss, cb];
    };
    // reach the module's internal rot2euler/expmap through the converter:
    // convert a 1-row table with a known pose and read the emitted angles
    // — the ONLY public seam. expmap identity → (0,0,0).
    const oneRow = [{ uid: 1, "blob/path": "x/a.mrc", "blob/idx": 0, "blob/shape": [64, 64], "alignments3D/pose": [0.1, 0.2, 0.3], "alignments3D/shift": [0, 0], "alignments3D/class": 0, "alignments3D/split": 0, "alignments3D/overall_score": 0.5 }];
    const onePt = [{ uid: 1, "blob/psize_A": 1.0, "ctf/df1_A": 10000, "ctf/df2_A": 10000, "ctf/df_angle_rad": 0, "ctf/phase_shift_rad": 0, "ctf/accel_kv": 300, "ctf/cs_mm": 2.7, "ctf/amp_contrast": 0.1, "ctf/exp_group_id": 0, "location/center_x_frac": 0.5, "location/center_y_frac": 0.5, "location/micrograph_path": "m.mrc", "location/micrograph_shape": [100, 100] }];
    const r = conv.csRowsToStar(oneRow, [onePt], {});
    const rotLine = r.starText.split("\n").find((l) => /^\d+@micrographs\//.test(l));
    const rotDeg = Number(rotLine?.split("\t")[4] ?? NaN);
    // reconstruct: with pyem's OWN euler2rot, rot/tilt/psi must rebuild the
    // original Rodrigues rotation (matrix closeness, not angle closeness)
    const D = Math.PI / 180;
    const R = euler2rot(rotDeg * D, Number(rotLine?.split("\t")[5]) * D, Number(rotLine?.split("\t")[6]) * D);
    // the original Rodrigues matrix (pyem expmap formula, retyped)
    const e = [0.1, 0.2, 0.3];
    const theta = Math.hypot(...e);
    const w = e.map((x) => x / theta);
    const k = [0, w[2], -w[1], -w[2], 0, w[0], w[1], -w[0], 0];
    const k2 = new Array(9).fill(0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let l = 0; l < 3; l++) k2[i * 3 + j] += k[i * 3 + l] * k[l * 3 + j];
    const Rexp = k.map((kv, i) => (i % 4 === 0 ? 1 : 0) + Math.sin(theta) * kv + (1 - Math.cos(theta)) * k2[i]);
    const close = R.every((v, i) => Math.abs(v - Rexp[i]) < 1e-5);
    must(close, `A3 the Rodrigues→Euler conversion round-trips through pyem's own euler2rot (rot=${rotDeg?.toFixed(3)})`);
  }

  // A4 — the conversion table: units, 1-based lifts, uid join, link plan
  {
    const r = conv.csRowsToStar(
      PRIMARY_ROWS.map((x) => ({ ...x })),
      [PT_ROWS.map((x) => ({ ...x }))],
      { invertY: false }
    );
    must(r.particles === 3, `A4a the particle count (got ${r.particles})`);
    must(r.stacks.length === 2, `A4b the stack census (got ${r.stacks.length})`);
    must(
      r.stacks.some((s) => s.linkName === "foo_particles.mrcs") && r.stacks.some((s) => s.linkName === "bar_particles.mrcs"),
      "A4c the link names carry the .mrcs swap"
    );
    must(r.alignment === "3D", "A4d the 3D alignment source");
    must(r.optics.voltage === 300 && r.optics.cs === 2.7 && Math.abs(r.optics.ac - 0.07) < 1e-9 && Math.abs(r.optics.angpix - 0.93) < 1e-9, "A4e the optics block values (passthrough-sourced)");
    must(r.optics.boxSize === 128, `A4f the box size from blob/shape (got ${r.optics.boxSize})`);
    must(r.unmapped.includes("alignments3D/overall_score"), "A4g the unmapped field is listed (the receipt)");
    must(r.opticsGroups === 1, "A4h one optics group");
    // the star text: column set + spot values
    const t = r.starText;
    must(t.includes("data_optics") && t.includes("data_particles"), "A4i the two blocks exist");
    must(t.includes("_rlnOpticsGroup #1") && t.includes("_rlnImagePixelSize #8"), "A4j the optics columns exist");
    must(t.includes("_rlnOriginXAngst") && t.includes("_rlnDefocusU"), "A4k the RELION 3.1 dialect columns");
    const rows = t.split("\n").filter((l) => /^\d+@micrographs\//.test(l));
    must(rows.length === 3, `A4l three particle rows (got ${rows.length})`);
    must(rows[0]?.startsWith("1@micrographs/foo_particles.mrcs"), `A4m row 1's ImageName (got ${rows[0]?.slice(0, 40)})`);
    must(rows[1]?.startsWith("2@micrographs/foo_particles.mrcs"), "A4n row 2's ImageName (idx+1)");
    const cols = rows[0]?.split("\t") ?? [];
    // column order: imageName, micrographName, coordX, coordY, rot, tilt, psi, originX, originY, defocusU, defocusV, angle, phase, class, subset
    must(cols[2] === "1250" && cols[3] === "1500", `A4o the absolute coordinates (swapxy + no invertY): ${cols[2]},${cols[3]}`);
    must(cols[7] === "1.395" && cols[8] === "-1.86", `A4p the origins in Å (shift × angpix): ${cols[7]},${cols[8]}`);
    must(cols[9] === "12000", `A4q defocusU in Å unchanged: ${cols[9]}`);
    must(cols[11] === "30", `A4r the defocus angle rad→deg: ${cols[11]}`);
    must(cols[13] === "1", `A4s the class 0→1-based: ${cols[13]}`);
    // row 2: class 2→3, subset 1→2, z90 Rodrigues → psi 90
    const cols2 = rows[1]?.split("\t") ?? [];
    must(cols2[13] === "3" && cols2[14] === "2", `A4t class/subset 1-based lifts: ${cols2[13]},${cols2[14]}`);
    must(Math.abs(Number(cols2[6]) - 90) < 1e-3 && Number(cols2[4]) === 0 && Number(cols2[5]) === 0, `A4u a pure-z Rodrigues decomposes to psi=90: rot=${cols2[4]} tilt=${cols2[5]} psi=${cols2[6]}`);
  }

  // A5 — invertY flips the Y coordinate
  {
    const r = conv.csRowsToStar(
      [{ ...PRIMARY_ROWS[0] }],
      [[{ ...PT_ROWS[0] }]],
      { invertY: true }
    );
    const row = r.starText.split("\n").find((l) => /^\d+@micrographs\//.test(l));
    const cols = row?.split("\t") ?? [];
    must(cols[3] === "2500", `A5 invertY: (1−0.375)×4000 = 2500 (got ${cols[3]})`);
  }

  // A6 — link-name collisions get the -2 suffix (both in plan AND star)
  {
    const rows = [
      { ...PRIMARY_ROWS[0] },
      { ...PRIMARY_ROWS[0], uid: 201, "blob/path": "J43/extract/foo_particles.mrc", "blob/idx": 0 },
    ];
    const r = conv.csRowsToStar(rows, [[{ ...PT_ROWS[0] }, { ...PT_ROWS[0], uid: 201 }]], {});
    must(
      r.stacks.some((s) => s.linkName === "foo_particles.mrcs") && r.stacks.some((s) => s.linkName === "foo_particles-2.mrcs"),
      `A6a the colliding basename suffixed (got ${r.stacks.map((s) => s.linkName).join(", ")})`
    );
    const lines = r.starText.split("\n").filter((l) => /^\d+@micrographs\//.test(l));
    must(
      lines.some((l) => l.startsWith("1@micrographs/foo_particles.mrcs")) &&
        lines.some((l) => l.startsWith("1@micrographs/foo_particles-2.mrcs")),
      "A6b the star rows speak the SAME suffixed names"
    );
  }

  // A7 — rows without blob/path are dropped honestly
  {
    const r = conv.csRowsToStar(
      [{ ...PRIMARY_ROWS[0] }, { uid: 999, "blob/idx": 0 }],
      [[{ ...PT_ROWS[0] }]],
      {}
    );
    must(r.particles === 1, `A7 a row without blob/path drops (got ${r.particles})`);
  }

  // ====================================================================
  console.log("== PHASE B: LIVE REMOTE — the reference script's workflow ==");

  const mkConn = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t336",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);
  const probeRes = await api(`/api/remote/connections/${CONN}/test`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({}),
  });
  must(probeRes.status >= 200 && probeRes.status < 300, `the probe answers (${probeRes.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t336 cs2star", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  // the CryoSPARC project on the mock: J42 (extract + refinement export),
  // THREE .mrc stacks — baz is UNREFERENCED by the .cs (the witness)
  const b64 = (b) => b.toString("base64");
  const fx = client(
    "mkdir -p /data2/csproj/J42/extract; " +
      `echo ${b64(primaryCs)} | base64 -d > /data2/csproj/J42/cryosparc_J42_particles.cs; ` +
      `echo ${b64(ptCs)} | base64 -d > /data2/csproj/J42/J42_passthrough_particles.cs; ` +
      "for s in foo bar baz; do printf 'x' > /data2/csproj/J42/extract/${s}_particles.mrc; done; " +
      "ls -1 /data2/csproj/J42/extract/"
  );
  must(/foo_particles\.mrc/.test(fx) && /baz_particles\.mrc/.test(fx), `the CS fixtures build (${fx.replace(/\n/g, " ")})`);

  // ---- THE JOB ---------------------------------------------------------
  const csJob = await mkJob({
    projectId,
    type: "cs2star",
    name: "CryoSPARC → RELION 1",
    params: { csPath: "/data2/csproj/J42", invertY: false },
  });
  must(!!csJob?.id, "the cs2star job creates");
  const runRes = await api(`/api/jobs/${csJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runRes.status >= 200 && runRes.status < 300, `the job run accepts (${runRes.status})`);
  const done = await awaitJobTerminal(csJob.id, 120_000);
  must(
    done?.status === "completed",
    `the conversion completes (${done?.status}: ${String(done?.result ?? "").slice(0, 160)})`
  );

  const resultText = String(done?.result ?? "");
  must(/3 particles converted from J42/.test(resultText), `B1 the receipt leads with the particle count (${resultText.slice(0, 80)})`);
  must(/2 of 3 \.mrc stack\(s\) linked — only the ones this star references/.test(resultText), `B2 the selective census speaks (${resultText.slice(80, 200)})`);
  must(/300 kV · Cs 2\.7 mm · ac 0\.07 · pixel 0\.93/.test(resultText), "B3 the optics ride the receipt");
  must(/3D alignments/.test(resultText), "B4 the alignment source rides the receipt");

  // the workdir's own outputs — t353: the cluster-side lane downloads
  // NOTHING and writes the star ONLY on the cluster (the record keeps the
  // local-flavored path for the twin gates; the manifest lists it for the
  // Files tab)
  const rec = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"))[csJob.id] ?? null;
  must(!!rec?.outputs?.particles_star, "B5 the record registers particles_star");
  const starLocal = rec?.outputs?.particles_star;
  must(!existsSync(starLocal ?? ""), "B6 the star lives ONLY on the cluster now (the local path is the twin gate's key, intentionally absent)");
  must(!existsSync(path.join(path.dirname(starLocal ?? ""), "particles.cs")), "B7 nothing was downloaded — no .cs copy in the workdir");
  must(existsSync(path.join(path.dirname(starLocal ?? ""), ".cf-remote-manifest.json")), "B7b the remote manifest lists the on-cluster star for the Files tab");
  const twinStarB64 = client(`base64 -w0 /projects/cryoflow/${projectId}/cs2star_${csJob.id.slice(-8)}/particles.star 2>/dev/null`);
  const starText = Buffer.from(twinStarB64, "base64").toString("utf8");
  must(starText.includes("1@micrographs/foo_particles.mrcs"), "B8 the star's rows speak the link names");
  must(starText.includes("300") && starText.includes("0.93"), "B9 the optics block landed");

  // ---- THE SELECTIVE LINKS (the optimization witness) ------------------
  const linkDir = `/projects/cryoflow/${projectId}/micrographs`;
  const rlFoo = client(`readlink ${linkDir}/foo_particles.mrcs 2>/dev/null`);
  must(
    /[/]data2[/]csproj[/]J42[/]extract[/]foo_particles[.]mrc$/.test(rlFoo),
    `B10 foo linked with the .mrcs name → the .mrc target (got ${rlFoo})`
  );
  const rlBar = client(`readlink ${linkDir}/bar_particles.mrcs 2>/dev/null`);
  must(
    /[/]data2[/]csproj[/]J42[/]extract[/]bar_particles[.]mrc$/.test(rlBar),
    `B11 bar linked (got ${rlBar})`
  );
  must(
    client(`ls ${linkDir}/baz_particles.mrcs 2>/dev/null`) === "",
    "B12 THE OPTIMIZATION: the unreferenced baz stack was NOT linked"
  );
  must(
    client(`ls /data2/csproj/J42/extract/baz_particles.mrc 2>/dev/null`) !== "",
    "B13 the unreferenced .mrc itself still sits untouched in the CS project"
  );

  // ---- DOWNSTREAM: class2d consumes the conversion directly ------------
  const c2d = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c2d?.id, "the class2d job creates");
  const edge = await api("/api/edges", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ fromJobId: csJob.id, toJobId: c2d.id, fromPort: "particles", toPort: "particles" }),
  });
  must(edge.status === 200 || edge.status === 201, `the edge wires cs2star → class2d (${edge.status})`);
  const d2d = await api(`/api/jobs/${c2d.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: MODULE, mode: "slurm" } }),
  });
  must(
    d2d.status >= 200 && d2d.status < 300 && !d2d.body?.error,
    `the class2d dispatch to the cluster is accepted (${d2d.status}: ${String(d2d.body?.error ?? "").slice(0, 120)})`
  );
  const done2d = await awaitJobTerminal(c2d.id, 240_000);
  must(
    done2d?.status === "completed",
    `the class2d COMPLETES off the converted star + linked stacks (${done2d?.status}: ${String(done2d?.result ?? "").slice(0, 100)})`
  );

  // ---- the outputs view's key numbers (the particles doctrine) ---------
  const outputs = await api(`/api/jobs/${csJob.id}/outputs`, { headers: SH });
  must(outputs.status === 200, `the outputs listing answers (${outputs.status})`);
  must(
    outputs.body?.summary?.stats?.some((s) => s.key === "particles" && /3/.test(s.value) && s.label === "particles converted"),
    `the key numbers lead with particles (${outputs.body?.summary?.stats?.map((s) => `${s.key}=${s.value}`).join(", ") ?? "none"})`
  );
  must(
    outputs.body?.summary?.stats?.some((s) => s.key === "stacks" && /2/.test(s.value)),
    "the stacks key number speaks the census"
  );

  // ---- a missing stack refuses honestly --------------------------------
  {
    const csJob2 = await mkJob({
      projectId,
      type: "cs2star",
      name: "CryoSPARC → RELION (missing stack)",
      params: { csPath: "/data2/csproj/J42", invertY: false },
    });
    client("mv /data2/csproj/J42/extract/bar_particles.mrc /data2/csproj/J42/extract/bar_particles.mrc.bak");
    const r2 = await api(`/api/jobs/${csJob2.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
    const done2 = await awaitJobTerminal(csJob2.id, 60_000);
    must(
      done2?.status === "failed" && /missing on the cluster/.test(String(done2?.result ?? "")),
      `a .cs naming a vanished stack fails honestly (${done2?.status}: ${String(done2?.result ?? "").slice(0, 100)})`
    );
    client("mv /data2/csproj/J42/extract/bar_particles.mrc.bak /data2/csproj/J42/extract/bar_particles.mrc");
  }

  // ====================================================================
  console.log("== PHASE C: LIVE LOCAL — the same .cs on this machine ==");

  const localProj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t336 cs2star local" }),
  });
  const localProjectId = localProj.body?.project?.id;
  // mirror the CS project layout: <root>/J42/{cs files} + <root>/J42/extract/
  // (the blob paths inside the .cs are CS-project-relative: J42/extract/…)
  mkdirSync("/tmp/t336-cs/J42/extract", { recursive: true });
  writeFileSync("/tmp/t336-cs/J42/extracted_particles.cs", primaryCs);
  writeFileSync("/tmp/t336-cs/J42/whatever_passthrough_particles.cs", ptCs);
  for (const s of ["foo", "bar", "baz"]) writeFileSync(`/tmp/t336-cs/J42/extract/${s}_particles.mrc`, "x");

  const csLocal = await mkJob({
    projectId: localProjectId,
    type: "cs2star",
    name: "CryoSPARC → RELION (local)",
    params: { csPath: "/tmp/t336-cs/J42/extracted_particles.cs", invertY: false },
  });
  must(!!csLocal?.id, "the local cs2star job creates");
  const runL = await api(`/api/jobs/${csLocal.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runL.status >= 200 && runL.status < 300, `the local run accepts (${runL.status})`);
  const doneL = await awaitJobTerminal(csLocal.id, 120_000);
  must(
    doneL?.status === "completed",
    `the local conversion completes (${doneL?.status}: ${String(doneL?.result ?? "").slice(0, 140)})`
  );
  must(/2 of 3 \.mrc stack\(s\) linked/.test(String(doneL?.result ?? "")), "C1 the local receipt carries the same census");
  const localMicDir = `${ROOT}/data/relion/${localProjectId}/micrographs`;
  must(existsSync(`${localMicDir}/foo_particles.mrcs`), "C2 the local link exists");
  must(!existsSync(`${localMicDir}/baz_particles.mrcs`), "C3 the unreferenced local stack stays unlinked");
  const localStar = readFileSync(`${ROOT}/data/relion/${localProjectId}/cs2star_${csLocal.id.slice(-8)}/particles.star`, "utf8");
  must(localStar.includes("1@micrographs/foo_particles.mrcs"), "C4 the local star speaks the same names");

  // ====================================================================
  console.log("== PHASE D: PINS — the source ledger ==");

  const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  const rrSrc = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const wfSrc = readFileSync(`${ROOT}/src/lib/workflow.ts`, "utf8");
  const osSrc = readFileSync(`${ROOT}/src/lib/relion/output-summary.ts`, "utf8");

  must(/runCs2StarNative/.test(engineSrc) && /job\.type === "cs2star"/.test(engineSrc), "D1 the engine dispatches the native runner");
  must(/only the ones this star references/.test(engineSrc), "D2 the receipt's census wording lives in the runner");
  must(/ln -sfn/.test(engineSrc), "D3 the links are symlinks (zero data movement)");
  must(/"cs2star", \/\/ t336/.test(rrSrc), "D4 cs2star rides NATIVE_TYPES (no sbatch, no staging)");
  must(/"cs2star",\s*$/.test(wfSrc) || /"cs2star",/.test(wfSrc), "D5 the workflow catalog carries the type");
  must(/particles converted/.test(osSrc), "D6 the key numbers speak the conversion");

  console.log(`\n${fail === 0 ? "ALL GREEN" : `${fail} FAILURE(S)`}`);
} finally {
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SHJ }).catch(() => {});
  }
  if (projectId) client(`rm -rf /projects/cryoflow/${projectId}`);
  client("rm -rf /data2/csproj");
  try {
    rmSync("/tmp/t336-cs", { recursive: true, force: true });
  } catch {}
  void readdirSync;
}
process.exit(fail === 0 ? 0 : 1);
