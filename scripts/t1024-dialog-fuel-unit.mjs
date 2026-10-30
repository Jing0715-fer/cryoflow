#!/usr/bin/env node
/**
 * t1024 — THE FUEL FACE'S DIALOG-SIDE SEAT unit (node-only): the warning
 * armed BEFORE the pick, in the folder the user is still looking at.
 *
 * THE SHAPE (t1024's window): the t1022 field face speaks the fuel
 * arithmetic only AFTER the pick lands in the field (a 500 ms debounce
 * behind it); the t1024 lead candidate weighed the dialog-side seat — the
 * browse dialog holds the count (micrographs) in hand but no budget, so a
 * folder that the gate will refuse could be handed to the field without a
 * word spoken in the dialog. The honest weighing rejected the candidate's
 * own sketch (a one-shot headroom fetch + client arithmetic) because it
 * breaks the t1022 F2 law twice over (a copied 6 KB constant in the
 * client, or engine.ts — a server module — dragged into the browser
 * bundle). The landed shape rides the SAME count mode on the SAME doored
 * route on EVERY folder-mode navigation: the arithmetic stays at its ONE
 * seat in the route (single-source constants untouched), the reply ships
 * four compact numbers fresh per folder (no stale one-shot), and the cost
 * is one name-only readdir — the exact shape the field face already rides.
 *
 * BANDS:
 *   F  the seat at source: the fetch is the existing count mode (no new
 *      endpoint, no client constant), the seat is LOCAL lane + FOLDER mode
 *      only (the field face's own exclusions), the quiet arm resets to
 *      idle without an answer, the fetch lives in an effect (never a memo
 *      — the #13 lesson), the warning's words mirror the field face's
 *      dialect verbatim, the run-time gate stays the law (the staleness
 *      clause), and the listing's own micrograph sentence is unregressed.
 *   L  LIVE rides: the count mode answers for a 4-image fixture (the mode
 *      the dialog now rides, unregressed), the reply's four numbers are
 *      self-consistent, the full listing still answers (the dialog's
 *      primary fetch), a file path refused 400 (the quiet arm), /proc
 *      refused 400 (the VFS guard rides count mode), an empty folder
 *      counted 0 — and the world gate (22 jobs, the DB high-water, the
 *      fixture swept).
 *
 * PROTOCOL: node-only, the fixture laid before the ride and swept after
 * (the t1015 law), the ORIGIN law on every curl, exit honest, receipt to
 * shots-qa/.t1024-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const TMP = path.join(ROOT, "shots-qa/.t1024-unit-receipt.json");
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
// the patience law (t1023): the keeper's controlled recycle takes ~30 s —
// the gate polls THROUGH a recycle instead of verdicting on one (the
// census rides sibling units first; a busy or booting server answers when
// it answers, 40 tries × 1 s covers the longest witnessed boot)
let world = null;
for (let i = 0; i < 40 && !world; i++) {
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
    } catch { /* the warmup */ }
  }
  if (!world) { console.error("FATAL: the server never answered 200 (post-family-sweep)"); process.exit(2); }
}
if (world.length !== 16) {
  console.error(`FATAL: world gate — jobs ${world.length} (want 16 — the t1075 replant census; the t1003 22-world's db died in the epoch rollback)`);
  for (const j of world) console.error(`    · ${j.name} — ${j.status} (${j.id})`);
  process.exit(1);
}
console.log(`world: 16 jobs as-found (project ${world[0]?.projectId ?? null})`);

/* ---------- F band — the seat at source ---------- */
console.log("F band — the dialog-side seat at source:");
const dlg = read("src/components/workflow/path-browser-dialog.tsx");
const route = read("src/app/api/fs/browse/route.ts");

ok("F1 the seat rides the EXISTING count mode (no new endpoint — one fetch URL, `count=1` on the doored route)",
  /fetch\(`\/api\/fs\/browse\?path=\$\{encodeURIComponent\(cwd\)\}&count=1`/.test(dlg) &&
  route.includes(`url.searchParams.get("count") === "1"`),
  "the count-mode fetch shape");

ok("F2 no client constant (the t1022 single-source law — no 6 KB copy in the dialog)",
  !dlg.includes("6144") && !dlg.includes("6 * 1024") &&
  !dlg.includes("NATIVE_IMPORT_FUEL_BYTES_PER_FILE") &&
  !dlg.includes("importFuelHeadroomBytes"),
  "the reply carries the numbers already priced");

ok("F3 the seat is LOCAL lane + FOLDER mode only (the field face's own exclusions, mirrored)",
  /if \(!open \|\| remote \|\| mode !== "folder" \|\| !cwd\) \{/.test(dlg),
  "the fetch gate's four arms");

ok("F4 the quiet arm (a failed or non-folder answer resets to idle — the face only speaks with an answer)",
  /setFuel\(\{ phase: "idle", count: 0, fuelBytes: 0, headroomBytes: 0, overBudget: false \}\);/.test(dlg) &&
  dlg.includes("never speak a stale count"),
  "the idle reset + the abort guard");

ok("F5 the fetch lives in an effect, never a memo (the #13 lesson holds in the dialog too)",
  (() => {
    const memos = dlg.match(/useMemo\((?:[^()]|\([^()]*\))*fetch\(/g) || [];
    return memos.length === 0 && /React\.useEffect\(\(\) => \{/.test(dlg);
  })());

ok("F6 the warning's words mirror the field face's dialect verbatim (one sentence, one meaning, everywhere)",
  dlg.includes("GB headroom — the run will refuse: split into") &&
  dlg.includes("images ≈") &&
  dlg.includes("· fuel ≈") &&
  dlg.includes("GB of"),
  "the four-number sentence + the scale arm");

ok("F7 the run-time gate stays the law (the staleness clause rides the seat's own comment)",
  dlg.includes("THE RUN-TIME GATE REMAINS THE LAW") &&
  dlg.includes("the count here can go stale"),
  "the gate at Start re-computes");

ok("F8 the listing's own micrograph sentence is unregressed (the count in hand keeps its voice)",
  dlg.includes("No micrograph files directly in this folder — they may be in a subfolder") &&
  /micrograph\{microCount === 1 \? "" : "s"\} \(\.mrc\/\.mrcs\/\.tif\/\.eer\)/.test(dlg),
  "the folder view's own truth");

/* ---------- the fixture: four images, two noise files ---------- */
console.log("fixture — four images the seat can count:");
const FIX = path.join(ROOT, "data/t1024-dialog-fuel-unit");
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
console.log("L band — the count mode live (the mode the dialog's seat now rides):");

const r1 = await api("GET", `${FIX_URL}&count=1`);
ok("L1 the count ride answers (ok, count=4)", r1.status === 200 && r1.json?.ok === true && r1.json?.count === 4,
  `status ${r1.status} count ${r1.json?.count}`);
ok("L2 the reply's four numbers are self-consistent (overBudget IS fuel > headroom, the headroom a living number)",
  typeof r1.json?.fuelBytes === "number" && typeof r1.json?.headroomBytes === "number" &&
  r1.json.headroomBytes > 0 && r1.json.overBudget === (r1.json.fuelBytes > r1.json.headroomBytes),
  `fuel ${r1.json?.fuelBytes} headroom ${r1.json?.headroomBytes} over ${r1.json?.overBudget}`);

const r2 = await api("GET", FIX_URL);
ok("L3 the dialog's primary fetch is unregressed (entries + micrographs still ride the no-count request)",
  r2.status === 200 && r2.json?.ok === true && Array.isArray(r2.json?.entries) && r2.json.entries.length === 6 &&
  r2.json?.micrographs === 4, `entries ${r2.json?.entries?.length} micrographs ${r2.json?.micrographs}`);

const r3 = await api("GET", `/api/fs/browse?path=${encodeURIComponent(path.join(FIX, "fake_movie_001.mrc"))}&count=1`);
ok("L4 a file path is refused 400 (the seat's quiet arm — the dialog's error line is the voice)",
  r3.status === 400 && r3.json?.ok === false, `status ${r3.status}`);

const r4 = await api("GET", `/api/fs/browse?path=${encodeURIComponent("/proc")}&count=1`);
ok("L5 the VFS guard rides count mode (/proc refused 400 before any readdir)",
  r4.status === 400, `status ${r4.status}`);

const EMPTY = path.join(ROOT, "data/t1024-dialog-fuel-unit-empty");
rmSync(EMPTY, { force: true, recursive: true });
mkdirSync(EMPTY, { recursive: true });
const r5 = await api("GET", `/api/fs/browse?path=${encodeURIComponent(EMPTY)}&count=1`);
ok("L6 an empty folder counts 0 (the zero arm — the listing's own line speaks, the verdict stays quiet)",
  r5.status === 200 && r5.json?.count === 0 && r5.json?.fuelBytes === 0, `count ${r5.json?.count}`);
rmSync(EMPTY, { force: true, recursive: true });

/* ---------- the world gate (as-left) ---------- */
console.log("world gate:");
rmSync(FIX, { force: true, recursive: true });
ok("the fixture swept (the t1015 law)", !statSyncSafe(FIX), FIX);

let worldAfter = null;
for (let i = 0; i < 40 && !worldAfter; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) worldAfter = jobsArr(r.json);
  } catch { /* the beat */ }
}
ok("the world as-left (16 jobs, nothing minted standing — the t1075 replant re-key)", worldAfter?.length === 16, `got ${worldAfter?.length}`);
const dbBytes = statSync(path.join(ROOT, "db/cryoflow.db")).size;
ok("the DB byte size held (the high-water — the t1080 re-key: the qa60 FSC fixtures' create/delete cycle grew the file; the WORLD stands 16)", dbBytes === 147456, `${dbBytes}`);

function statSyncSafe(p) {
  try { statSync(p); return true; } catch { return false; }
}

/* ---------- the receipt ---------- */
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
const verdict = pass > 0 && fail === 0 ? "GREEN" : "RED";
writeFileSync(TMP, JSON.stringify({
  unit: "t1024-dialog-fuel-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["F the dialog-side seat at source", "L the count mode live"],
}, null, 2));
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
console.log(`receipt: ${TMP}`);
process.exit(fail === 0 ? 0 : 1);
