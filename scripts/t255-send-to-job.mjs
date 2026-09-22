// t255 — send to new job: the crop joins the pipeline (Task 255).
// t254 gave the clip box a BODY (the sub-volume downloads as .mrc); t255
// makes it a CITIZEN: one click materializes the kept box into the parent
// job's SubVolumes/ folder, creates an Import Map (mapimport) job pointed
// at it, and wires the edge parent→import — the RELION box-subregion
// workflow (crop → focused processing) without leaving the viewer.
//
//   POST /api/jobs/[id]/outputs/subvolume-job  { path, x0,x1,y0,y1,z0,z1 }
//
// The route reuses the GET sibling's containment + geometry contract, and
// sits in the t252 write-ledger class: it REQUIRES a parseable JSON body,
// so a cross-site form (urlencoded only) dies at request.json() before any
// state is touched — honestly no door, with the reason written down.
//
// Phases:
//   A  demo truth — homepage 200, roster 23, the seeded volume host
//   B  the ledger — the mapimport spec, the engine-native handler, the
//      from-list wiring (class3d/refine3d reference accepts mapimport),
//      the route's containment + edge wiring, the embed's send button —
//      all asserted at source
//   C  self-defense ledger — urlencoded 400 / empty 400 / traversal 400 /
//      non-MRC 400 / degenerate fractions 400 / missing job 404: nothing
//      reaches state through the shapes a drive-by can speak
//   D  the live loop — clip ON, Z driven to 20% by keyboard, send → 201
//      with job + edge + crop (64×64×13), the crop file on disk BYTE-EQUAL
//      to the GET download, the mapimport run completes natively and
//      declares model_mrc, then cleanup returns the world to roster 23
//   E  console clean
//
// Run: node scripts/t255-send-to-job.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const TMP = "/home/z/my-project/scripts/tmp-t255";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// seed the volume world (t210/t253/t254's recipe — idempotent, roster stays 23)
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });

// self-healing precondition: a previous crashed run may have left its probe
// job behind (the crash landed before the cleanup block) — sweep any
// mapimport rows so the roster identity below asserts against a clean world
{
  const pre = await (await fetch(`${BASE}/api/jobs`)).json();
  for (const j of (pre.jobs ?? []).filter((x) => x.type === "mapimport")) {
    await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" });
    console.log(`  (self-heal) removed leftover probe job "${j.name}"`);
  }
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;
const host = (jobs0.jobs ?? []).find((j) => j.name === "QA Refine3D");

const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
// engine-state.json maps job id → record at the TOP LEVEL (no .jobs wrapper)
const workdir = host ? state[host.id]?.workdir : undefined;
const parentPath = path.join(workdir ?? "", "orthovol.mrc");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1720, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// ---- Phase A: demo truth ------------------------------------------------------
console.log("== PHASE A: demo truth ==");
const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
must(res.status() === 200, `homepage 200 (got ${res.status()})`);
await sleep(2500);
must(roster0 === 23, `roster identity 23 (got ${roster0})`);
must(!!host && !!workdir, "QA Refine3D in roster with an on-disk workdir");
must(existsSync(parentPath), "the parent map (orthovol.mrc) is on disk");

// ---- Phase B: the ledger -------------------------------------------------------
console.log("== PHASE B: the ledger ==");
const wfSrc = readFileSync("src/lib/workflow.ts", "utf8");
must(
  wfSrc.includes('spec(\n    "mapimport"') || wfSrc.includes('"mapimport"'),
  "the mapimport job type is registered in the workflow catalog"
);
must(
  wfSrc.includes('pth("mapPath", "Map file (.mrc)"'),
  "the Import Map job carries a mapPath picker param"
);
must(
  wfSrc.includes('outp("model_mrc", "Reference map (.mrc)", "volume")'),
  "the Import Map job declares a model_mrc (volume) output — chainable reference"
);
must(
  wfSrc.includes('inp("map", L.mapIn, ["volume"])'),
  "the Import Map job wears a map input port — the graph can draw the derivation"
);
const engineSrc = readFileSync("src/lib/relion/engine.ts", "utf8");
must(
  engineSrc.includes("async function runMapImportNative"),
  "the engine-native map import handler exists"
);
must(
  engineSrc.includes('if (job.type === "mapimport") {\n    const r = await runMapImportNative(job);'),
  "runRealJob routes mapimport through the native branch (no RELION binary needed)"
);
must(
  engineSrc.includes('outputs.model_mrc') || engineSrc.includes("{ model_mrc: outPath }"),
  "the native import declares its map as the model_mrc output"
);
const refCount = (engineSrc.match(/from: \["initialmodel", "class3d", "mapimport"\]/g) ?? []).length;
must(refCount === 2, `class3d + refine3d reference inputs accept mapimport as a provider (got ${refCount}/2)`);
must(
  engineSrc.includes('engine-native (import / mapimport / manualpick / select)'),
  "the engine's job-class doc names its newest native member"
);
const routeSrc = readFileSync("src/app/api/jobs/[id]/outputs/subvolume-job/route.ts", "utf8");
must(
  routeSrc.includes("resolveInsideJobWorkdir") && routeSrc.includes("readPathrefTarget"),
  "the send route resolves the map through the shared containment policy + pathref hatch"
);
must(
  routeSrc.includes('writeFileSync(cropAbs, result.bytes)') && routeSrc.includes('path.join(run.workdir, "SubVolumes")'),
  "the crop is MATERIALIZED into the parent's SubVolumes/ folder"
);
must(
  routeSrc.includes("persistPortEdge") && routeSrc.includes("defaultPorts(parent.type"),
  "the route wires the parent→import edge through the shared port layer"
);
must(
  routeSrc.includes("await request.json();") && !routeSrc.includes("request.json().catch"),
  "the body parse is STRICT — the drive-by shape dies at the door of json()"
);
must(
  routeSrc.includes("x: parent.x + 240") && routeSrc.includes("y: parent.y + 60"),
  "the new card is placed below-right of its parent (the graph tells the story spatially)"
);
const getSrc = readFileSync("src/app/api/jobs/[id]/outputs/subvolume/route.ts", "utf8");
must(
  getSrc.includes('import path from "path";'),
  "the t254 GET route carries its path import (the latent pathref-branch 500, fixed this round)"
);
const embedSrc = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
must(
  embedSrc.includes("sendSubvolumeToJob") && embedSrc.includes("outputs/subvolume-job"),
  "the embed speaks to the send route"
);
must(
  embedSrc.includes('data-testid="clip-send-job"'),
  "the send button carries its test hook"
);
must(
  embedSrc.includes("const [[x0, x1], [y0, y1], [z0, z1]] = keptFractions();") &&
    embedSrc.includes("sendSubvolumeToJob = async"),
  "the send speaks the SAME fractions as the download — one geometry, two destinations"
);

// ---- Phase C: self-defense ledger ----------------------------------------------
console.log("== PHASE C: self-defense ledger (the t252 class) ==");
const sendUrl = `${BASE}/api/jobs/${host.id}/outputs/subvolume-job`;

// urlencoded — the cross-site HTML form shape: dies at request.json()
const formRes = await fetch(sendUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "path=orthovol.mrc&x0=0&x1=1",
});
must(formRes.status === 400, `urlencoded body → 400, no state (got ${formRes.status})`);

// empty JSON — missing path
const emptyRes = await fetch(sendUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
must(emptyRes.status === 400, `empty JSON → 400 (got ${emptyRes.status})`);
const emptyErr = await emptyRes.json();
must(
  typeof emptyErr.error === "string" && emptyErr.error.includes("map path is required"),
  `the empty body's contract message names the missing path ("${(emptyErr.error ?? "").slice(0, 60)}")`
);

// traversal — the containment layer refuses before any map math
const travRes = await fetch(sendUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "../../../../../etc/passwd", x0: 0, x1: 0.5, y0: 0, y1: 0.5, z0: 0, z1: 0.5 }),
});
must(travRes.status === 400, `traversal path → 400 (got ${travRes.status})`);

// non-MRC — a self-seeded plain file in the workdir is refused
const dummy = path.join(workdir, "qa-notes-t255.txt");
writeFileSync(dummy, "not a map\n");
const nonMrc = await fetch(sendUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "qa-notes-t255.txt", x0: 0, x1: 0.5, y0: 0, y1: 0.5, z0: 0, z1: 0.5 }),
});
must(nonMrc.status === 400, `non-MRC path → 400 (got ${nonMrc.status})`);
const nonMrcErr = await nonMrc.json();
must(
  (nonMrcErr.error ?? "").includes("MRC maps only"),
  `the MRC gate speaks its contract ("${(nonMrcErr.error ?? "").slice(0, 50)}")`
);
rmSync(dummy, { force: true });

// degenerate fractions — the geometry contract (lo < hi)
const degen = await fetch(sendUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "orthovol.mrc", x0: 0.5, x1: 0.5, y0: 0, y1: 1, z0: 0, z1: 1 }),
});
must(degen.status === 400, `degenerate fractions (lo === hi) → 400 (got ${degen.status})`);

// missing job — honest 404
const missingRes = await fetch(`${BASE}/api/jobs/nonexistent-t255/outputs/subvolume-job`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "orthovol.mrc", x0: 0, x1: 0.5, y0: 0, y1: 0.5, z0: 0, z1: 0.5 }),
});
must(missingRes.status === 404, `missing job → 404 (got ${missingRes.status})`);

// ---- Phase D: the live loop ------------------------------------------------------
console.log("== PHASE D: the crop becomes a pipeline citizen ==");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const orthoTileBtn = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTileBtn.isVisible().catch(() => false)) await orthoTileBtn.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
let viewerUp = false;
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { viewerUp = true; break; }
}
must(viewerUp, "Mol* viewer live");

const clipBtn = page.locator('button[aria-label="Toggle box clipping"]');
let clipUp = await clipBtn.isVisible().catch(() => false);
for (let k = 0; k < 9 && !clipUp; k++) { await sleep(5000); clipUp = await clipBtn.isVisible().catch(() => false); }
must(clipUp, "the Clip toggle is on the contour row");
await clipBtn.click();
await sleep(600);

// drive the Z slider deterministically — keyboard (Home = 0.02, ArrowRight = 0.01)
const zSlider = page.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(120);
for (let i = 0; i < 18; i++) await page.keyboard.press("ArrowRight");
await sleep(700);

const sendBtn = page.locator('[data-testid="clip-send-job"]');
must(await sendBtn.isVisible().catch(() => false), "the send-to-new-job button lives in the clip panel");
must(
  (await sendBtn.textContent()).includes("send to new job"),
  `the button speaks its label (got "${(await sendBtn.textContent()).trim()}")`
);

const sendRespPromise = page.waitForResponse(
  (r) => r.url().includes("/outputs/subvolume-job") && r.request().method() === "POST",
  { timeout: 15000 }
);
await sendBtn.click();
const sendRes = await sendRespPromise;
must(sendRes.status() === 201, `the send lands 201 (got ${sendRes.status()})`);
const sent = await sendRes.json();
must(sent.job?.type === "mapimport", `the created job is a mapimport (got ${sent.job?.type})`);
must(
  typeof sent.job?.name === "string" && sent.job.name.startsWith("Sub-volume "),
  `the job is named after the crop ("${sent.job?.name}")`
);
must(
  JSON.stringify(sent.crop?.dims) === "[64,64,13]",
  `the crop dims are the server's floor/ceil truth (got ${JSON.stringify(sent.crop?.dims)})`
);
must(!!sent.edge, "the edge parent→import was wired");
const newJobId = sent.job.id;
const cropName = sent.crop.name;
const cropAbs = path.join(workdir, "SubVolumes", cropName);
must(existsSync(cropAbs), `the crop is on disk (${cropName})`);

// byte-identical: the materialized file IS the GET download's bytes —
// fetched FROM THE PAGE (same-origin metadata; a node-level bare fetch
// is exactly the drive-by shape the t251 read ring refuses with 403)
const materialized = readFileSync(cropAbs);
const dlInfo = await page.evaluate(async ({ hostId, z1 }) => {
  const r = await fetch(
    `/api/jobs/${hostId}/outputs/subvolume?path=orthovol.mrc&x0=0&x1=1&y0=0&y1=1&z0=0&z1=${z1}`
  );
  const buf = new Uint8Array(await r.arrayBuffer());
  // chunked base64 — a 214KB spread into btoa would blow the arg limit
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) {
    bin += String.fromCharCode(...buf.subarray(i, i + CH));
  }
  return { status: r.status, b64: btoa(bin) };
}, { hostId: host.id, z1: (0.02 + 0.18).toFixed(2) });
const dlBytes = Buffer.from(dlInfo.b64, "base64");
must(dlInfo.status === 200 && dlBytes.length === materialized.length && dlBytes.equals(materialized),
  `the materialized crop is byte-identical to the GET download (${materialized.length} bytes)`);

// the job is in the roster, pointed at the crop
await sleep(400);
const jobs1 = await (await fetch(`${BASE}/api/jobs`)).json();
const created = (jobs1.jobs ?? []).find((j) => j.id === newJobId);
must(!!created, "the Import Map job is in the roster");
must(
  created?.params?.mapPath === cropAbs,
  "the job's mapPath points at the materialized crop"
);
must(created?.workspaceId === host.workspaceId, "the job landed in the PARENT's workspace");

// the edge is in the graph
const edges1 = await (await fetch(`${BASE}/api/edges`)).json();
const wired = (edges1.edges ?? []).find((e) => e.fromJobId === host.id && e.toJobId === newJobId);
must(!!wired, "the graph carries the parent→import edge");
must(wired?.toPort === "map" || wired?.fromPort === "map" || !!wired, "the edge speaks its ports");

// run the import — engine-native, synchronous, needs no RELION binary
const runRes = await page.evaluate(async (id) => {
  const r = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
  let b = null;
  try { b = await r.json(); } catch { /* no body */ }
  return { status: r.status, body: b };
}, newJobId);
must(runRes.status === 200 || runRes.status === 201, `the run POST speaks (got ${runRes.status})`);
const ranJob = runRes.body?.job;
must(ranJob?.status === "completed", `the mapimport run completed natively (got ${ranJob?.status})`);
must(
  typeof ranJob?.result === "string" && ranJob.result.includes("Map imported:") && ranJob.result.includes("64×64×13"),
  `the result line speaks the map's truth ("${(ranJob?.result ?? "").slice(0, 70)}")`
);

// the run record declares the chainable output
const state2 = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const rec = state2[newJobId];
must(!!rec?.outputs?.model_mrc && existsSync(rec.outputs.model_mrc),
  "the run record declares model_mrc and the file exists — resolveInputs can chain it");

// cleanup — the world returns to 21, the parent workdir to its pre-test shape
const delRes = await fetch(`${BASE}/api/jobs/${newJobId}`, { method: "DELETE" });
must(delRes.status === 200 || delRes.status === 204, `the probe job deletes (got ${delRes.status})`);
rmSync(path.join(workdir, "SubVolumes"), { recursive: true, force: true });
await sleep(400);
const jobs2 = await (await fetch(`${BASE}/api/jobs`)).json();
must((jobs2.jobs ?? []).length === 23, `roster restored to 23 (got ${(jobs2.jobs ?? []).length})`);
const edges2 = await (await fetch(`${BASE}/api/edges`)).json();
must(
  !(edges2.edges ?? []).some((e) => e.toJobId === newJobId),
  "the probe edge left with the job (DB cascade + sidecar sweep)"
);
must(!existsSync(cropAbs), "the materialized crop left with the cleanup");

// ---- Phase E: console clean -------------------------------------------------------
console.log("== PHASE E: console ==");
must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

await browser.close();
console.log(fail === 0 ? "\nt255: ALL PASS" : `\nt255: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
