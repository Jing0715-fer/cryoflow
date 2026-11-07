#!/usr/bin/env node
// t1136-book-heal-ride.mjs — THE BOOK-HEAL RIDE (the t1135 named candidate).
//
// THE WORLD'S BOOKS ARE STILL CORRUPT: every run_data.star the
// classification family ever wrote carries the malformed _rlnAngleTilt
// ("90.0.2" — a float with two dots; the t1135 f-string whose colon was
// lost). The writer is cured (t1135), but the ARTIFACTS on disk stay
// corrupt until their producing lane re-runs. This ride re-runs the five
// corrupt-book jobs through the PRODUCT'S OWN RUN DOOR, in DAG order:
//
//   class2d → select → initialmodel → class3d → refine3d
//
// Each leg: BEFORE (corrupt-tilt count + map md5s) → the knock → the poll
// → AFTER (the book speaks valid floats — the CLEAN-BYTES witness; the
// maps' md5s unchanged — the seed contract). select rides class2d's healed
// rows through the app-side pass-through; the three refine-family legs
// rewrite their own books with the cured writer.
//
// THE GO GATE: legs 2..5 wait for scripts/.t1136-go — the select door's
// vaccine wiring (the t1136 leg-2 cure) must land and settle BEFORE the
// ride walks past leg 1, so the recompile never meets an in-flight run
// (the t1133 choreography: the cure's compile meets the ride's calm).
//
// A re-run refreshes, never mints: the world's job count stays 15.

import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import http from "node:http";

const BASE = "http://localhost:3000";
const REPO = "/home/z/my-project";
const PROJ = "cmvbjl6060000srlis2ai5mb3";
const CLUSTER = `${REPO}/services/mock-cluster/fs/projects/cryoflow/${PROJ}`;
const GO_FILE = `${REPO}/scripts/.t1136-go`;

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
};

let fail = 0;
const must = (cond, label) => {
  console.log(`${cond ? "  ok" : "  FAIL"}: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const md5 = (file) => createHash("md5").update(readFileSync(file)).digest("hex");
const ts = () => new Date().toISOString().slice(11, 19);

async function apiOnce(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE}${url}`,
      {
        method,
        headers: {
          ...SH,
          ...(payload !== null ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
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
    req.setTimeout(60_000, () => req.destroy(new Error(`ride api timeout on ${method} ${url}`)));
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function api(method, url, body, attempt = 0) {
  try {
    return await apiOnce(method, url, body);
  } catch (e) {
    if (attempt >= 30) throw e;
    if (attempt === 0) console.log(`  (${ts()} lane hiccup — retrying ${url})`);
    await sleep(3000);
    return api(method, url, body, attempt + 1);
  }
}

/* ---------- the strict book walk (the census script's own grammar) ----- */

const STRICT = /^-?\d+(\.\d+)?$/;

function corruptTiltCount(dir) {
  let cells = 0, corrupt = 0;
  const badFiles = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === ".cryoflow_prev") continue;
        walk(`${d}/${e.name}`);
        continue;
      }
      if (!e.name.endsWith(".star")) continue;
      const p = `${d}/${e.name}`;
      const lines = readFileSync(p, "utf8").split("\n");
      let tiltCol = -1, inLoop = false;
      let fileBad = 0;
      for (const line of lines) {
        if (line.startsWith("data_")) { tiltCol = -1; inLoop = false; continue; }
        if (line.startsWith("loop_")) { inLoop = true; continue; }
        if (inLoop && line.startsWith("_rlnAngleTilt")) {
          tiltCol = parseInt(line.split("#")[1]?.trim() || "0", 10) - 1;
          continue;
        }
        if (inLoop && line.startsWith("_rln")) continue;
        if (inLoop && tiltCol >= 0 && line.trim() && !line.startsWith("#")) {
          const c = line.trim().split(/\s+/);
          if (c.length <= tiltCol) continue;
          cells++;
          if (!STRICT.test(c[tiltCol])) { corrupt++; fileBad++; }
        }
      }
      if (fileBad > 0) badFiles.push(`${p.slice(dir.length + 1)}:${fileBad}`);
    }
  };
  walk(dir);
  return { cells, corrupt, badFiles };
}

function mapMd5s(dir) {
  const out = {};
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) continue;
    if (e.name.endsWith(".mrc") || e.name.endsWith(".mrcs")) out[e.name] = md5(`${dir}/${e.name}`);
  }
  return out;
}

/* ---------- the world's live discovery --------------------------------- */

console.log(`== ${ts()} step 1: the live discovery ==`);
const conns = (await api("GET", "/api/remote/connections")).body?.connections ?? [];
must(conns.length >= 1, `the mock cluster connection answers (${conns[0]?.name ?? "none"})`);
const conn = conns[0];
const jobs = (await api("GET", "/api/jobs")).body?.jobs ?? [];
must(jobs.filter((j) => j.projectId === PROJ).length === 15, "the world's job count stands at 15");

const LEGS = [
  { key: "class2d", id: "cmvbjl9b7000gsrli46lkfgpq", dir: `${CLUSTER}/class2d_46lkfgpq`, pollMs: 900_000, noMaps: false, movePolicy: "none" },
  { key: "select2d", id: "cmvbjl9bf000isrli64qkashd", dir: `${REPO}/data/relion/${PROJ}/select2d_64qkashd`, pollMs: 300_000, noMaps: true, movePolicy: "none" },
  { key: "select", id: "cmvbjl9bm000ksrlinlu3ijj8", dir: `${REPO}/data/relion/${PROJ}/select_nlu3ijj8`, clusterDir: `${CLUSTER}/select_nlu3ijj8`, pollMs: 300_000, noMaps: true, movePolicy: "none" },
  { key: "initialmodel", id: "cmvbjl9bu000msrlis0bx0t07", dir: `${CLUSTER}/initialmodel_s0bx0t07`, pollMs: 600_000, noMaps: false, movePolicy: "classImages" },
  { key: "class3d", id: "cmvbjl9c2000osrlig7jbyk63", dir: `${CLUSTER}/class3d_g7jbyk63`, pollMs: 600_000, noMaps: false, movePolicy: "it000" },
  { key: "refine3d", id: "cmvbjl9cw000usrlixxe3896f", dir: `${CLUSTER}/refine3d_xxe3896f`, pollMs: 600_000, noMaps: false, movePolicy: "classImages" },
];
for (const leg of LEGS) {
  const j = jobs.find((x) => x.id === leg.id);
  must(j?.type === leg.key, `${leg.key} job answers (${j?.id ?? "?"}, ${j?.status ?? "?"})`);
}

/* ---------- the BEFORE census ------------------------------------------ */
/* THE MULTIPLE-LIFE SHAPE (the t1133 precedent, extended): the ride walks
 * five legs across the Bash tool's 10-minute windows; each life re-enters
 * resume-safe (a healed leg skips its knock, an in-flight leg is never
 * knocked twice) and pays the map-md5 snapshot ONCE — the BEFORE state is
 * cached at /tmp/t1136-before.json. The launcher keeps the process in the
 * FOREGROUND of each window (the launch-shape law: detached children get
 * reaped; the arc lives across lives, not across a daemon). */

import { writeFileSync } from "fs";
const STATE_FILE = "/tmp/t1136-before.json";

console.log(`== ${ts()} step 2: the BEFORE census (the books' disease on disk) ==`);
let beforeTotal = 0;
const beforeState = new Map();
let cachedMaps = null;
if (existsSync(STATE_FILE)) {
  cachedMaps = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  console.log(`  (state cache loaded — ${Object.keys(cachedMaps).length} legs' map md5s carried from a previous life)`);
}
for (const leg of LEGS) {
  const s = corruptTiltCount(leg.dir);
  beforeState.set(leg.key, s);
  beforeTotal += s.corrupt;
  console.log(`  ${leg.key}: ${s.corrupt}/${s.cells} tilt cells corrupt`);
}
must(beforeTotal > 0 || cachedMaps != null, `the disease is on disk (BEFORE total: ${beforeTotal} corrupt tilt cells — the t1135 walk's live-world remainder)`);
for (const leg of LEGS) {
  if (leg.key === "select") continue;
  if (cachedMaps?.[leg.key]) {
    leg.beforeMaps = cachedMaps[leg.key];
    console.log(`  ${leg.key}: ${Object.keys(leg.beforeMaps).length} map md5s (from cache)`);
  } else {
    const maps = mapMd5s(leg.dir);
    leg.beforeMaps = maps;
    cachedMaps = cachedMaps ?? {};
    cachedMaps[leg.key] = maps;
    writeFileSync(STATE_FILE, JSON.stringify(cachedMaps));
    console.log(`  ${leg.key}: ${Object.keys(maps).length} map files snapshotted (md5, cached)`);
  }
}

/* ---------- the ride (five legs, DAG order) ----------------------------- */

const runBody = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };

const statusOf = async (id) => {
  const js = (await api("GET", "/api/jobs")).body?.jobs ?? [];
  return js.find((x) => x.id === id)?.status;
};

for (let li = 0; li < LEGS.length; li++) {
  const leg = LEGS[li];
  console.log(`== ${ts()} leg ${li + 1}/6: ${leg.key} (the ${li === 0 ? "first" : "next"} knock) ==`);

  // the GO gate: legs 2..5 wait for the select-door wiring to land + settle
  if (li >= 1) {
    if (!existsSync(GO_FILE)) {
      console.log(`  (${ts()} GO gate: waiting for scripts/.t1136-go — the select door's vaccine wiring must land first)`);
      const t0 = Date.now();
      while (!existsSync(GO_FILE)) {
        if (Date.now() - t0 > 900_000) { console.log("  FAIL: GO gate budget spent"); fail++; break; }
        await sleep(5000);
      }
      if (existsSync(GO_FILE)) console.log(`  (${ts()} GO gate open — the wiring is on the tree, the lane settled)`);
    }
  }

  let st = await statusOf(leg.id);
  if (st === "completed" && beforeState.get(leg.key)?.corrupt === 0) {
    console.log(`  (${ts()} ${leg.key} already healed — the books are clean, the knock is skipped)`);
  } else {
    if (st === "running" || st === "pending") {
      console.log(`  (${ts()} ${leg.key} already in flight (${st}) — the knock is not repeated)`);
    } else {
      const r1 = await api("POST", `/api/jobs/${leg.id}/run`, runBody);
      must([200, 202, 409].includes(r1.status), `the run door answers for ${leg.key} (${r1.status})`);
    }
    // the poll
    const t0 = Date.now();
    let done = false;
    for (;;) {
      await sleep(5000);
      st = await statusOf(leg.id);
      if (st === "completed") { done = true; break; }
      if (st === "failed") { console.log(`  FAIL: ${leg.key} run failed`); fail++; break; }
      if (Date.now() - t0 > leg.pollMs) { console.log(`  FAIL: ${leg.key} poll budget spent (still ${st})`); fail++; break; }
      process.stdout.write(`  … ${leg.key} ${st} (${Math.round((Date.now() - t0) / 1000)}s)\r`);
    }
    if (process.stdout.isTTY) process.stdout.write("\n");
    if (!done && st !== "completed") continue;
    console.log(`  (${ts()} ${leg.key} completed)`);
  }

  // the AFTER witness: the book speaks valid floats
  const after = corruptTiltCount(leg.dir);
  must(after.corrupt === 0, `AFTER ${leg.key}: the books speak valid floats (0/${after.cells} corrupt — was ${beforeState.get(leg.key)?.corrupt})`);
  if (after.corrupt > 0) console.log(`    residue: ${after.badFiles.slice(0, 5).join(" ")}`);
  // the select lane's cluster-side copy: the seeder's fossil shape — the
  // native writes app-side (RELION_DIR), the cluster-fs copy has no living
  // writer; name what the leg leaves there
  if (leg.clusterDir) {
    const fossil = corruptTiltCount(leg.clusterDir);
    console.log(`    (the cluster-side copy: ${fossil.corrupt}/${fossil.cells} corrupt — ${fossil.corrupt === 0 ? "clean" : "the seeder's fossil, no living writer targets it; the living book is the app-side one"})`);
  }

  // the map contract with the lane's own split (the ride's discovery):
  //   none       — every map holds (the inputs unchanged or pure-seed)
  //   all        — every map is pixel-derived (the initial-model family):
  //                the seed-era bytes carried the dead pixels, so EVERY map
  //                moves when the healed pixels flow through
  //   it000      — only the seed round's classes stack is pixel-derived
  //                (the per-iteration volumes are class_volume(seed), pure)
  //   classImages— the class-image family (run_itNNN_classNNN.mrc +
  //                run_itNNN_classes.mrcs + run_classes.mrcs) moves; the
  //                pure-seed volumes (halves, unfil, run_class001) hold
  // a move outside the family, or a held family member, is the finding.
  if (!leg.noMaps) {
    const afterMaps = mapMd5s(leg.dir);
    const family = (k) => {
      if (leg.movePolicy === "all") return true;
      if (leg.movePolicy === "it000") return k === "run_it000_classes.mrcs";
      return /(^run_it\d{3}_class\d{3}\.mrc$)|(^run_it\d{3}_classes\.mrcs$)|(^run_classes\.mrcs$)/.test(k);
    };
    const moved = Object.keys(leg.beforeMaps).filter((k) => afterMaps[k] !== leg.beforeMaps[k]);
    const outside = moved.filter((k) => !family(k));
    const held = Object.keys(leg.beforeMaps).filter((k) => afterMaps[k] === leg.beforeMaps[k]);
    const stuck = held.filter((k) => family(k));
    if (leg.movePolicy === "none") {
      must(moved.length === 0, `AFTER ${leg.key}: the map contract holds (${Object.keys(afterMaps).length} maps byte-identical${moved.length ? ` — MOVED: ${moved.slice(0, 6).join(",")}` : ""})`);
    } else {
      must(outside.length === 0 && stuck.length === 0, `AFTER ${leg.key}: the truth-gain wears the lane's own split (${moved.length} moved / ${held.length} held of ${Object.keys(afterMaps).length}${outside.length ? ` — OUTSIDE the family: ${outside.slice(0, 4).join(",")}` : ""}${stuck.length ? ` — FAMILY HELD: ${stuck.slice(0, 4).join(",")}` : ""})`);
    }
  }

  // the engine's own voice: the maps' contract word. The SOURCE's word is
  // the living one (the instrument pins it precisely); a run.out written
  // before the t1136 split speaks the t1135 word — the historical record
  // of what the lane said THEN, not a lie now.
  if (leg.key !== "select" && leg.key !== "select2d") {
    const runOut = `${leg.dir}/run.out`;
    if (existsSync(runOut)) {
      const t = readFileSync(runOut, "utf8");
      const fresh = t.includes("the class images are pixel-derived in real mode") || t.includes("every map is this stub's own seed-written contract");
      const historical = t.includes("the volume maps are this stub's own deterministic contract");
      must(fresh || historical, `${leg.key}: the summary names the maps' contract (${fresh ? "the t1136 precise split" : "the t1135 word — written before the split, the historical record"})`);
    }
  }

  // the sync door (idempotent bring-home) + the local mirror gate
  const sy = await api("POST", `/api/jobs/${leg.id}/outputs/sync`, {});
  console.log(`  (${ts()} sync door: ${sy.status})`);
}

/* ---------- the AFTER census (the whole world) -------------------------- */

console.log(`== ${ts()} step 3: the AFTER census (both trees — the blind-spot closure) ==`);
let afterTotal = 0;
for (const leg of LEGS) {
  const s = corruptTiltCount(leg.dir);
  afterTotal += s.corrupt;
  console.log(`  ${leg.key}: ${s.corrupt}/${s.cells}`);
}
// the whole app-side tree (data/relion): the mirrors + the app-side natives'
// own books — the tree the world census never walked before this window
{
  const s = corruptTiltCount(`${REPO}/data/relion/${PROJ}`);
  afterTotal += s.corrupt;
  console.log(`  data/relion (the whole app-side tree): ${s.corrupt}/${s.cells}`);
  if (s.corrupt > 0) console.log(`    residue: ${s.badFiles.slice(0, 6).join(" ")}`);
}
{
  // the cluster tree's LIVING books: every workdir the engines write. The
  // select_nlu3ijj8 dir is the SEEDER's fossil — the select native writes
  // app-side (RELION_DIR), so no living writer targets the cluster copy;
  // it is a stale TWIN the input resolution consults only when the local
  // book goes missing. Counted and named, not required clean — its
  // retirement is its own weighed window (a twin-refresh push leg).
  const s = corruptTiltCount(CLUSTER);
  const fossil = corruptTiltCount(`${CLUSTER}/select_nlu3ijj8`);
  const living = s.corrupt - fossil.corrupt;
  const livingCells = s.cells - fossil.cells;
  afterTotal += living;
  console.log(`  cluster fs (the living engine tree): ${living}/${livingCells}`);
  console.log(`  cluster fs (the seeder's stale twin, select_nlu3ijj8): ${fossil.corrupt}/${fossil.cells} — named, no living writer targets it`);
  if (living > 0) console.log(`    residue: ${s.badFiles.filter((f) => !f.startsWith("select_nlu3ijj8")).slice(0, 6).join(" ")}`);
}
const livingTotal = afterTotal;
must(livingTotal === 0, `AFTER: the world's living books are clean (0 corrupt tilt cells — was ${beforeTotal}; the stale twin is named above)`);

const jobsNow = (await api("GET", "/api/jobs")).body?.jobs ?? [];
must(jobsNow.filter((j) => j.projectId === PROJ).length === 15, "the world's job count stays 15 (a re-run refreshes, never mints)");
const dbBytes = statSync(`${REPO}/db/cryoflow.db`).size;
console.log(`  (${ts()} the DB file: ${dbBytes} bytes${dbBytes === 135168 ? " — the young floor held" : " — MOVED (named)"})`);

console.log(fail === 0 ? `\nRIDE GREEN — the books speak valid floats (t1136)` : `\nRIDE RED — ${fail} failures`);
process.exit(fail === 0 ? 0 : 1);
