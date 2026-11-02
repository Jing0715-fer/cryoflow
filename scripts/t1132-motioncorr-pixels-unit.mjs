#!/usr/bin/env node
// t1132-motioncorr-pixels-unit.mjs — the pixels' standing gate (the census's
// 70th slot, bare node by the census's own law).
//
// THE STORY IT GUARDS: relion_run_motioncorr's reader gated on
// os.path.isabs alone — the engine family's odd one out — so the import
// star's project-relative movie rows never read, all 24 movies fell to the
// flat-zero fallback, and the zero cascade ran the whole chain downstream:
// the corrected micrographs carried all-zero payloads, the autopick's real
// dark-blob reader found nothing in zeros and retired to its legacy
// synthetic grid, and Extract's REAL crops cropped REAL boxes of ZERO
// pixels — 24 structurally perfect, pixel-dead stacks whose quick-look
// montage rendered black tiles behind an honest header. The cure (this
// window's product change) is the family's own resolve discipline plus the
// fallback's honest word; the ride (t1132-heal-motioncorr-pixels.mjs) then
// re-ran motioncorr and extract through the product's own run door and the
// pixels were born (100% non-zero payloads, the same 96-row promise).
//
// THE PINS (what must never again be true silently):
//   A. the reader speaks the family's resolve (three bases: the star's
//      dir, the cwd, the star's parent) — and the bare isabs gate is GONE;
//   B. the flat fallback SAYS SO in the run's own log;
//   C. all 24 cluster-side corrected micrographs carry ALIVE payloads
//      (stride-sampled non-zero, mode 2, 512x512x1);
//   D. all 24 cluster-side extract stacks carry ALIVE payloads
//      (64x64x4 — the same promise the star makes);
//   E. the fetched local pair is BYTE-IDENTICAL to the cluster's bytes
//      (the fetch honesty law — what came home is what lives there);
//   F. the extract star's promise stands (96 rows, 24 stacks, 4 each);
//   G. the listing carries the 24 cards (local + remote = the world's
//      total, wherever the fetch boundary currently sits);
//   H. the extractor's real path keeps its exists gate (the ride's
//      clearing was the necessary key — regeneration is explicit).

import { existsSync, readFileSync } from "fs";
import { createHash } from "crypto";
import http from "node:http";

const BASE = "http://localhost:3000";
const ENGINE = "/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_run_motioncorr";
const EXTRACTOR = "/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_preprocess";
const CLUSTER_ROOT = "/home/z/my-project/services/mock-cluster/fs/projects/cryoflow";
const LOCAL_ROOT = "/home/z/my-project/data/relion";

let pass = 0, fail = 0;
const pin = (cond, label) => {
  console.log(`${cond ? "  ok" : "  FAIL"}: ${label}`);
  cond ? pass++ : fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiOnce(method, url) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${BASE}${url}`,
      { method, headers: { Origin: BASE, Referer: `${BASE}/`, "X-Requested-With": "XMLHttpRequest" } },
      (res) => {
        let text = "";
        res.on("data", (c) => { text += c; });
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(text); } catch { /* non-JSON */ }
          resolve({ status: res.statusCode ?? 0, body: json });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error(`unit api timeout on ${method} ${url}`)));
    req.end();
  });
}
async function api(method, url, attempt = 0) {
  try {
    return await apiOnce(method, url);
  } catch (e) {
    if (attempt >= 20) throw e;
    await sleep(3000);
    return api(method, url, attempt + 1);
  }
}

/* payload stats — the pixels' own witness (stride sample) */
function mrcPayloadStats(file) {
  const buf = readFileSync(file);
  if (buf.length < 1024) return null;
  if (buf.subarray(208, 212).toString("ascii") !== "MAP ") return null;
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
  const mode = buf.readInt32LE(12);
  const nsymbt = buf.readInt32LE(92);
  const n = nx * ny * nz;
  const off = 1024 + nsymbt;
  if (buf.length < off + n * 4) return null;
  let nonZero = 0, sampled = 0;
  for (let i = 0; i < n; i += 8) {
    if (Math.abs(buf.readFloatLE(off + i * 4)) > 1e-6) nonZero++;
    sampled++;
  }
  return { nx, ny, nz, mode, nonZero, sampled };
}

const md5 = (f) => createHash("md5").update(readFileSync(f)).digest("hex");

console.log("A band — the reader speaks the family's resolve");
const engine = readFileSync(ENGINE, "utf8");
pin(
  engine.includes("def _resolve_movie(mic):") &&
    /for cand_base in \(_star_dir, os\.getcwd\(\), os\.path\.dirname\(_star_dir\)\):/.test(engine),
  "A1 the resolve tries the star's dir, the cwd and the star's parent (the family's three bases)"
);
pin(
  !engine.includes('cf_cryo.read_mrc(mic) if os.path.isabs(mic) else None'),
  "A2 the bare isabs gate is GONE (the negative witness — the odd one out cured)"
);
pin(
  engine.includes("_resolve_movie(mic)") && engine.includes("movie_path = _resolve_movie(mic)"),
  "A3 the reader drinks the resolve (the call site rides the family law)"
);
pin(
  engine.includes("flat fallback (the honest zero word, t1132)"),
  "B1 the flat fallback SAYS SO in the run's own log (the honest zero word)"
);

console.log("C band — the corrected micrographs are alive");
let micAlive = 0, micShaped = 0;
for (let i = 1; i <= 24; i++) {
  const f = `${CLUSTER_ROOT}/cmvbjl6060000srlis2ai5mb3/motioncorr_1vdd3im1/micrographs/mic_${String(i).padStart(3, "0")}.mrc`;
  const s = existsSync(f) ? mrcPayloadStats(f) : null;
  if (s && s.nonZero > 0) micAlive++;
  if (s && s.mode === 2 && s.nx === 512 && s.ny === 512 && s.nz === 1) micShaped++;
}
pin(micAlive === 24, `C1 all 24 corrected micrographs carry ALIVE payloads (${micAlive}/24)`);
pin(micShaped === 24, `C2 the corrected shape stands (512x512x1 mode 2, ${micShaped}/24)`);

console.log("D band — the extract stacks are alive");
const stackDir = `${CLUSTER_ROOT}/cmvbjl6060000srlis2ai5mb3/extract_rnjjp9yr/extra`;
let stAlive = 0, stShaped = 0;
for (let i = 1; i <= 24; i++) {
  const f = `${stackDir}/mic_${String(i).padStart(3, "0")}_extract.mrcs`;
  const s = existsSync(f) ? mrcPayloadStats(f) : null;
  if (s && s.nonZero > 0) stAlive++;
  if (s && s.nx === 64 && s.ny === 64 && s.nz === 4) stShaped++;
}
pin(stAlive === 24, `D1 all 24 extract stacks carry ALIVE payloads (${stAlive}/24)`);
pin(stShaped === 24, `D2 the stack shape stands (64x64x4 — the promise's box, ${stShaped}/24)`);

console.log("E band — the fetched pair is byte-identical");
const pair = ["mic_001_extract.mrcs", "mic_002_extract.mrcs"];
let pairMatch = 0, pairPresent = 0;
for (const name of pair) {
  const local = `${LOCAL_ROOT}/cmvbjl6060000srlis2ai5mb3/extract_rnjjp9yr/extra/${name}`;
  const cluster = `${stackDir}/${name}`;
  if (existsSync(local) && existsSync(cluster)) {
    pairPresent++;
    if (md5(local) === md5(cluster)) pairMatch++;
  }
}
pin(pairPresent === 2, `E1 the fetched pair stands on disk (${pairPresent}/2 — the UI door's graduates)`);
pin(pairMatch === pairPresent, `E2 the pair is BYTE-IDENTICAL to the cluster's bytes (${pairMatch}/${pairPresent})`);

console.log("F band — the star's promise");
const star = readFileSync(
  `${CLUSTER_ROOT}/cmvbjl6060000srlis2ai5mb3/extract_rnjjp9yr/particles.star`,
  "utf8"
);
const rows = star.split(/\r?\n/).filter((l) => l.includes("@"));
// the row's shape is `000001@extra/mic_001_extract.mrcs<TAB>x<TAB>y` — the
// stack token ends at the first whitespace after the @ (the coords ride
// the same line and must not fork the name)
const stackOf = (l) => l.split("@")[1]?.split(/\s/, 1)[0];
const stacksNamed = new Set(rows.map(stackOf).filter(Boolean));
let fourEach = true;
for (const s of stacksNamed) {
  if (rows.filter((l) => stackOf(l) === s).length !== 4) fourEach = false;
}
pin(rows.length === 96, `F1 the promise's arithmetic stands (96 rows, found ${rows.length})`);
pin(stacksNamed.size === 24, `F2 the promise names 24 stacks (${stacksNamed.size})`);
pin(fourEach, "F3 four particles per stack, exactly (the standing dialect)");

console.log("G band — the listing's world");
const projects = (await api("GET", "/api/projects")).body;
const proj = Array.isArray(projects)
  ? projects.find((p) => /demo/i.test(p.name ?? ""))
  : projects?.projects?.find?.((p) => /demo/i.test(p.name ?? ""));
const projId = proj?.id;
pin(projId != null, "G1 the demo project answers live (no fossil ids)");
const jobs = (await api("GET", "/api/jobs")).body?.jobs ?? [];
const extractJob = jobs.find((j) => j.projectId === projId && j.type === "extract");
pin(extractJob != null, "G2 the extract job answers live");
let cards = [];
if (extractJob) {
  const outs = (await api("GET", `/api/jobs/${extractJob.id}/outputs`)).body;
  cards = (outs?.files ?? []).filter((f) => f.name.endsWith(".mrcs"));
}
pin(cards.length === 24, `G3 the listing carries the 24 cards, wherever the boundary sits (${cards.length})`);

console.log("H band — the regeneration gate");
const extractor = readFileSync(EXTRACTOR, "utf8");
pin(
  extractor.includes("not os.path.exists(stack)"),
  "H1 the real path keeps its exists gate (the ride's clearing was the key — regeneration is explicit)"
);

console.log(`t1132-motioncorr-pixels-unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
