#!/usr/bin/env node
/**
 * t1022 — THE FUEL FACE unit (node-only): the import dialog's pre-count,
 * the gate's arithmetic spoken BEFORE the run starts.
 *
 * THE SHAPE (t1022's window): the t1021 gate refuses an oversized import
 * at the loop's doorstep, but its words land on the job row AFTER Start.
 * The face moves the number to the moment the user is still looking at
 * the field: the import job's path param (folder shape only) pre-counts
 * via GET /api/fs/browse?path=…&count=1 — a NEW MODE on the EXISTING
 * doored route, not a new endpoint (the honest weighing: the count branch
 * reuses the route's origin door, its VFS guard, its path resolution and
 * its readdir, and ships FOUR numbers instead of a capped listing, so
 * warning about a huge folder never itself costs a huge transfer).
 *
 * BANDS:
 *   F  the face at source: the route's count mode (the compact reply,
 *      the SAME name-only arithmetic the engine's folder branch computes,
 *      NO per-entry statSync — one readdir, not 500k stats), the
 *      single-source constants (the route imports them from engine.ts —
 *      no local 6 KB copy; exactly ONE occurrence of the host-arithmetic
 *      expression, inside the helper the gate itself now calls), the
 *      face's fetch gate (the debounce + AbortController effect in
 *      job-panel, the folder-shape condition, no fetch inside useMemo —
 *      the #13 lesson holds), the warning's words, and the seat (the
 *      import job only, local lane only).
 *   L  LIVE rides: a 4-image fixture counted (count=4, the fuel priced by
 *      the gate's own constant), the reply's arithmetic self-consistent,
 *      the full-listing face unregressed (entries + micrographs still
 *      ride the no-count request), a file path refused 400 (the quiet
 *      arm), /proc refused 400 (the VFS guard rides count mode too), an
 *      empty folder counted 0 — and the world gate (22 jobs, the DB
 *      high-water, the fixture swept).
 *
 * PROTOCOL: node-only, the fixture laid before the ride and swept after
 * (the t1015 law), the ORIGIN law on every curl, exit honest, receipt to
 * shots-qa/.t1022-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const TMP = path.join(ROOT, "shots-qa/.t1022-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* the 404 HTML */ }
  return { status: res.status, json, text };
}
const jobsArr = (b) => (Array.isArray(b) ? b : b?.jobs ?? []);

/* ---------- the world gate (as-found) ---------- */
let world = null;
for (let i = 0; i < 10 && !world; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) world = jobsArr(r.json);
  } catch { /* the warmup */ }
}
if (!world) { console.error("FATAL: the server never answered 200"); process.exit(2); }
/* the fuel-family orphan law (the t1088 hardening): t1021's twin can
   stand when its ride dies mid-flight (the reaper's shape) — the
   family's readers sweep the KNOWN twin through the product door
   (patiently — the t1023 law) instead of FATALing on a count that
   hides the name; any OTHER stranger FATALs with the full roster —
   a gate that only counts lies by omission. */
if (world.some((j) => j.name === "Import Fuel Gate Ride")) {
  const twins = world.filter((j) => j.name === "Import Fuel Gate Ride");
  console.log(`fuel-family orphan sweep — t1021's twin stands (${twins.map((j) => `${j.id} ${j.status}`).join(", ")})`);
  for (const twin of twins) {
    for (let a = 0; a < 4; a++) {
      if (a > 0) await sleep(2500);
      try {
        const r = await api("DELETE", `/api/jobs/${twin.id}`);
        if (r.status === 200 || r.status === 404) break;
      } catch { /* the storm — the t1023 patience law */ }
    }
    rmSync(path.join(ROOT, "data/relion", twin.projectId ?? world[0]?.projectId ?? "", `import_${twin.id.slice(-8)}`), { force: true, recursive: true });
  }
  await sleep(1200);
  world = null;
  for (let i = 0; i < 10 && !world; i++) {
    if (i > 0) await sleep(1000);
    try {
      const r = await api("GET", "/api/jobs");
      if (r.status === 200) world = jobsArr(r.json);
    } catch { /* the beat */ }
  }
  if (!world) { console.error("FATAL: the server never answered 200 (post-family-sweep)"); process.exit(2); }
}
if (world.length !== 16) {
  console.error(`FATAL: world gate — jobs ${world.length} (want 16 — the t1075 replant census; the t1003 22-world's db died in the epoch rollback)`);
  for (const j of world) console.error(`    · ${j.name} — ${j.status} (${j.id})`);
  process.exit(1);
}
console.log(`world: 16 jobs as-found (project ${world[0]?.projectId ?? null})`);

/* ---------- F band — the face at source ---------- */
console.log("F band — the fuel face at source:");
const route = read("src/app/api/fs/browse/route.ts");
const eng = read("src/lib/relion/engine.ts");
const panel = read("src/components/workflow/job-panel.tsx");

ok("F1 the route speaks count mode (`?count=1` — the compact four-number reply, no entries array)",
  route.includes(`url.searchParams.get("count") === "1"`) &&
  route.includes("count,") && route.includes("fuelBytes,") &&
  route.includes("headroomBytes,") && route.includes("overBudget: fuelBytes > headroomBytes,"));

ok("F2 the constants are single-source (the route imports them from engine.ts — no local 6 KB copy)",
  route.includes(`from "@/lib/relion/engine"`) &&
  route.includes("NATIVE_IMPORT_FUEL_BYTES_PER_FILE") &&
  route.includes("importFuelHeadroomBytes") &&
  !route.includes("6 * 1024"));

ok("F3 the engine exports the two constants and ONE host-arithmetic (the helper — the gate calls it too)",
  eng.includes("export const NATIVE_IMPORT_FUEL_BYTES_PER_FILE = 6 * 1024;") &&
  eng.includes("export const NATIVE_IMPORT_FUEL_FLOOR_BYTES = 512 * 1024 * 1024;") &&
  (eng.match(/os\.totalmem\(\) - process\.memoryUsage\(\)\.rss - NATIVE_IMPORT_FUEL_FLOOR_BYTES/g) || []).length === 1 &&
  /export function importFuelHeadroomBytes\(\): number \{\s*\n\s*return os\.totalmem\(\) - process\.memoryUsage\(\)\.rss - NATIVE_IMPORT_FUEL_FLOOR_BYTES;\s*\n\}/.test(eng) &&
  eng.includes("const headroomBytes = importFuelHeadroomBytes();"));

ok("F4 the count branch costs ONE readdir — no per-entry statSync, no statEntry, no sort (the O(n)-only law)",
  (() => {
    const i = route.indexOf(`url.searchParams.get("count") === "1"`);
    if (i < 0) return false;
    const branch = route.slice(route.lastIndexOf("names = readdirSync(dir);", i), i + 200);
    return !branch.includes("statEntry(") && !branch.includes("statSync(") && !branch.includes(".sort(");
  })());

ok("F5 the fetch rides an effect, never a memo (no useMemo in the panel holds a fetch — the #13 lesson holds)",
  /useMemo\((?:[^()]|\([^()]*\))*fetch\(/.test(panel) === false &&
  /const t = setTimeout\(\(\) => \{\s*\n\s*fetch\(`\/api\/fs\/browse\?path=/.test(panel));

ok("F6 the face fires only on the folder shape (one path, no wildcard, no file list) and only for the local import",
  panel.includes("const fuelActive = !!fuelFace && !remoteBrowser;") &&
  panel.includes("const folderShape = fuelActive && trimmed.length > 0 && !isPattern && !isFileList;"));

ok("F7 the seat is the import job only (both ParamField call sites pass fuelFace by spec key)",
  (panel.match(/fuelFace=\{spec\?\.key === "import"\}/g) || []).length === 2 &&
  panel.includes("fuelActive = !!fuelFace && !remoteBrowser"));

ok("F8 the face's words preview the gate's guidance (the count, the refusal, the split) and stay quiet otherwise",
  panel.includes("0 images here — the run will refuse") &&
  panel.includes("the run will refuse: split into") &&
  panel.includes("GB headroom") &&
  panel.includes("counting…") &&
  panel.includes(`aria-live="polite"`));

/* ---------- the fixture: four images, two noise files ---------- */
console.log("fixture — four images the face can count:");
const FIX = path.join(ROOT, "data/t1022-fuel-face-unit");
rmSync(FIX, { force: true, recursive: true });
mkdirSync(FIX, { recursive: true });
for (const n of ["fake_movie_001.mrc", "fake_movie_002.mrc", "fake_movie_003.mrc", "fake_004.tif"]) {
  writeFileSync(path.join(FIX, n), Buffer.alloc(1024));
}
for (const n of ["notes.txt", "other.log"]) {
  writeFileSync(path.join(FIX, n), Buffer.alloc(64));
}
const FIX_URL = `/api/fs/browse?path=${encodeURIComponent(FIX)}`;

/* ---------- L band — the live rides ---------- */
console.log("L band — the count mode live (the gate's own arithmetic on the wire):");

const r1 = await api("GET", `${FIX_URL}&count=1`);
ok("L1 the count ride answers (ok, count=4)", r1.status === 200 && r1.json?.ok === true && r1.json?.count === 4,
  `status ${r1.status} count ${r1.json?.count}`);
ok("L2 the fuel is priced by the gate's own constant (4 × 6 KB = 24576)",
  r1.json?.fuelBytes === 4 * 6144, `got ${r1.json?.fuelBytes}`);
ok("L3 the reply's arithmetic is self-consistent (overBudget IS fuel > headroom, the headroom is a living number)",
  typeof r1.json?.headroomBytes === "number" && r1.json.headroomBytes > 0 &&
  r1.json.overBudget === (r1.json.fuelBytes > r1.json.headroomBytes),
  `headroom ${r1.json?.headroomBytes} overBudget ${r1.json?.overBudget}`);

const r2 = await api("GET", FIX_URL);
ok("L4 the full-listing face is unregressed (entries + the real micrographs count still ride the no-count request)",
  r2.status === 200 && r2.json?.ok === true && Array.isArray(r2.json?.entries) && r2.json.entries.length === 6 &&
  r2.json?.micrographs === 4, `entries ${r2.json?.entries?.length} micrographs ${r2.json?.micrographs}`);

const r3 = await api("GET", `/api/fs/browse?path=${encodeURIComponent(path.join(FIX, "fake_movie_001.mrc"))}&count=1`);
ok("L5 a file path is refused 400 (the face's quiet arm — the run's own refusal stays the voice)",
  r3.status === 400 && r3.json?.ok === false, `status ${r3.status}`);

const r4 = await api("GET", `/api/fs/browse?path=${encodeURIComponent("/proc")}&count=1`);
ok("L6 the VFS guard rides count mode too (/proc refused 400 before any readdir)",
  r4.status === 400, `status ${r4.status}`);

const EMPTY = path.join(ROOT, "data/t1022-fuel-face-unit-empty");
rmSync(EMPTY, { force: true, recursive: true });
mkdirSync(EMPTY, { recursive: true });
const r5 = await api("GET", `/api/fs/browse?path=${encodeURIComponent(EMPTY)}&count=1`);
ok("L7 an empty folder counts 0 (the face's zero arm — the run will refuse)",
  r5.status === 200 && r5.json?.count === 0 && r5.json?.fuelBytes === 0, `count ${r5.json?.count}`);
rmSync(EMPTY, { force: true, recursive: true });

ok("L8 the big-folder transfer stays compact (the count reply carries NO entries array — four numbers, not a listing)",
  r1.json?.entries === undefined && r2.json?.entries !== undefined,
  `count-reply entries ${r1.json ? "entries" in r1.json : "n/a"}`);

/* ---------- the world gate (as-left) ---------- */
console.log("world gate:");
rmSync(FIX, { force: true, recursive: true });
ok("the fixture swept (the t1015 law)", !statExists(FIX), FIX);

let worldAfter = null;
for (let i = 0; i < 10 && !worldAfter; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) worldAfter = jobsArr(r.json);
  } catch { /* the beat */ }
}
ok("the world as-left (16 jobs, nothing minted standing — the t1075 replant re-key)", worldAfter?.length === 16, `got ${worldAfter?.length}`);
const dbBytes = statSync(path.join(ROOT, "db/cryoflow.db")).size;
ok("the DB byte size held (the high-water — the t1097 re-key: the fresh t979 replant world's page-quantized size — the t1075 re-key's own precedent (155648→135168); the t1080 147456 died with the epoch; the WORLD stands 16)", dbBytes === 135168, `${dbBytes}`);

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1022-fuel-face-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["F the face at source", "L the count mode live"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);

function statExists(p) {
  try { statSync(p); return true; } catch { return false; }
}
