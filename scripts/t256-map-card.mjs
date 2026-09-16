// t256 — the Import Map identity card (Task 256).
// t255 made the crop a pipeline CITIZEN; t256 gives its card a FACE.
// The Import Map job's Results view now opens with an identity card read
// from the map's own header (zero extra I/O — the outputs route mirrors
// the MrcHeader read it already did): grid size, voxel spacing, the
// density statistics the header records, and the sub-volume anchor
// (start fields) that says WHERE in the parent this crop lives. A crop
// sent from the 3D viewer names its parent (the SubVolumes path); a
// standalone map says so honestly.
//
//   GET /api/jobs/[id]/outputs  →  files[].map { origin, pixel, dmin, dmax, dmean, rms }
//
// The card is the box-subregion chain made legible: crop → import →
// focused refinement reads off one card — "what is it, and where did
// it come from" — while the Maps gallery keeps answering "what does
// it look like".
//
// Phases:
//   A  demo truth — homepage 200, roster 21, the seeded volume host
//   B  the ledger — MrcHeader's start/dmean/rms read-side, the outputs
//      route's map summary assembly, the card component + source
//      parsing + the honest standalone branch — all asserted at source
//   C  the live loop — a page-fetch POST subvolume-job with a box OFF
//      the origin (25%..75% so the anchor is non-zero), the native run,
//      then outputs' map truth: origin == the crop's box offset, pixel
//      == the parent's spacing, stats byte-equal to the downloaded
//      crop's own header — and the identity card renders in the UI
//      with dims, spacing, anchor and the crop-of-parent source line
//   D  cleanup + console clean
//
// Run: node scripts/t256-map-card.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// seed the volume world (t210/t253/t254/t255's recipe — idempotent, roster stays 21)
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
const parentDirName = workdir ? path.basename(workdir) : "";

// the parent's own header — the spacing truth the crop must preserve
function headerWord32(file, off, float = true) {
  const b = Buffer.alloc(1024);
  const fd = openSync(file, "r");
  try { readSync(fd, b, 0, 1024, 0); } finally { closeSync(fd); }
  return float ? b.readFloatLE(off) : b.readInt32LE(off);
}
let parentPixel = 0;
if (existsSync(parentPath)) {
  const cellaZ = headerWord32(parentPath, 48);
  const nz = headerWord32(parentPath, 8, false);
  parentPixel = cellaZ > 0 && nz > 0 ? cellaZ / nz : 0;
}

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
must(roster0 === 21, `roster identity 21 (got ${roster0})`);
must(!!host && !!workdir, "QA Refine3D in roster with an on-disk workdir");
must(existsSync(parentPath), "the parent map (orthovol.mrc) is on disk");
must(parentPixel > 0, `the parent header speaks a voxel spacing (${parentPixel.toFixed(3)} Å)`);

// ---- Phase B: the ledger -------------------------------------------------------
console.log("== PHASE B: the ledger ==");
const mrcSrc = readFileSync("src/lib/mrc.ts", "utf8");
must(
  mrcSrc.includes("start: [number, number, number]") && mrcSrc.includes("dmean: number") && mrcSrc.includes("rms: number"),
  "MrcHeader carries the identity fields (start / dmean / rms) — additive"
);
must(
  mrcSrc.includes("start: [buf.readInt32LE(16), buf.readInt32LE(20), buf.readInt32LE(24)]") &&
    mrcSrc.includes("dmean: buf.readFloatLE(84)") &&
    mrcSrc.includes("rms: buf.readFloatLE(216)"),
  "readMrcHeader reads start (16/20/24), dmean (84) and rms (216) off the buffer it already holds"
);
const routeSrc = readFileSync("src/app/api/jobs/[id]/outputs/route.ts", "utf8");
must(
  routeSrc.includes("origin: hdr.start") && routeSrc.includes("dmean: hdr.dmean") && routeSrc.includes("rms: hdr.rms"),
  "the outputs route mirrors the header read into the identity summary — zero extra I/O"
);
must(
  routeSrc.includes("hdr.cella[2] > 0 && hdr.nz > 0 ? hdr.cella[2] / hdr.nz : 0"),
  "voxel spacing is computed cella[2]/nz, 0 when the header doesn't say"
);
must(
  routeSrc.includes('.endsWith(".mrcs")'),
  "stacks (.mrcs) don't get a map summary — in-plane axes are not navigable"
);
const viewSrc = readFileSync("src/components/workflow/results/results-view.tsx", "utf8");
must(
  viewSrc.includes("function MapIdentityCard") && viewSrc.includes('aria-label="Imported map"'),
  "the identity card component exists and speaks its aria label"
);
must(
  viewSrc.includes('job.type === "mapimport" && mrcFiles[0]?.map && mrcFiles[0]?.dims'),
  "the card renders only where it belongs: mapimport jobs with a 3D map on file"
);
must(
  viewSrc.includes('"/subvolumes/"') && viewSrc.includes("kind: \"crop\""),
  "the source parser reads the SubVolumes path — a crop names its parent"
);
must(
  viewSrc.includes("Sub-volume anchor at") && viewSrc.includes("sent from the 3D viewer"),
  "the anchored branch tells the whole story: anchor + crop-of-parent"
);
must(
  viewSrc.includes("Standalone map — picked from the file browser, no parent offset."),
  "the standalone branch is honest: no parent, no anchor, no pretending"
);
must(
  viewSrc.includes("function formatStat") && viewSrc.includes("toExponential(2)"),
  "the density formatter survives raw-count and float-map ranges alike"
);

// ---- Phase C: the live loop ----------------------------------------------------
console.log("== PHASE C: the live loop ==");
// the whole live block runs under try/finally — a crash MUST still sweep
// its own probe job + crop (t255's lesson: an e2e that dies before its
// cleanup poisons the next run's roster identity)
let newJobId = null;
let cropAbs = null;
try {
  // box OFF the origin: 25%..75% on x/y (voxels 16..48) and 0..20% on z
  // (voxels 0..13) — the anchor (16, 16, 0) is non-zero, the standalone
  // branch would have hidden the very line this test exists to see
  const sendInfo = await page.evaluate(async ({ hostId }) => {
    const r = await fetch(`/api/jobs/${hostId}/outputs/subvolume-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "orthovol.mrc", x0: 0.25, x1: 0.75, y0: 0.25, y1: 0.75, z0: 0, z1: 0.2 }),
    });
    let b = null;
    try { b = await r.json(); } catch { /* no body */ }
    return { status: r.status, body: b };
  }, { hostId: host.id });
  must(sendInfo.status === 201, `the crop lands as a new job (got ${sendInfo.status})`);
  const newJob = sendInfo.body?.job;
  must(newJob?.type === "mapimport", `the created job is a mapimport (got ${newJob?.type})`);
  const cropName = sendInfo.body?.crop?.name;
  must(typeof cropName === "string" && cropName.includes("_crop_"), `the crop is materialized (${cropName})`);
  cropAbs = path.join(workdir, "SubVolumes", cropName ?? "");
  must(existsSync(cropAbs), "the crop file exists in the parent's SubVolumes folder");
  newJobId = newJob?.id ?? null;

  // run it — engine-native, synchronous
  const runRes = await page.evaluate(async (id) => {
    const r = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
    let b = null;
    try { b = await r.json(); } catch { /* no body */ }
    return { status: r.status, body: b };
  }, newJobId);
  must(runRes.status === 200 || runRes.status === 201, `the run POST speaks (got ${runRes.status})`);
  must(runRes.body?.job?.status === "completed", `the mapimport run completed natively (got ${runRes.body?.job?.status})`);

  // outputs truth — fetched FROM THE PAGE (same-origin metadata; a node-level
  // bare fetch is exactly the drive-by shape the t251 read ring refuses)
  const outs = await page.evaluate(async (id) => {
    const r = await fetch(`/api/jobs/${id}/outputs`);
    return { status: r.status, body: await r.json() };
  }, newJobId);
  must(outs.status === 200, `the outputs route opens for the import job (got ${outs.status})`);
  const mapFile = (outs.body?.files ?? []).find((f) => f.kind === "mrc");
  must(!!mapFile, "the imported map is listed as an mrc output");
  must(
    JSON.stringify(mapFile?.dims) === "[32,32,13]",
    `the crop dims ride the listing (got ${JSON.stringify(mapFile?.dims)})`
  );
  const mapMeta = mapFile?.map;
  must(!!mapMeta, "the identity summary rides the mrc file entry");

  if (mapMeta) {
    // the anchor is the crop's box offset (parent start is 0) — the header
    // answers "where do I sit in the map I was cut from"
    must(
      JSON.stringify(mapMeta.origin) === "[16,16,0]",
      `the origin is the box offset inside the parent (got ${JSON.stringify(mapMeta.origin)})`
    );
    must(
      Math.abs(mapMeta.pixel - parentPixel) < 1e-4,
      `the voxel spacing survives the crop (${mapMeta.pixel?.toFixed(4)} Å vs parent ${parentPixel.toFixed(4)} Å)`
    );

    // stats byte-truth: the summary numbers ARE the crop file's own header words
    if (existsSync(cropAbs)) {
      const cropHead = (() => {
        const b = Buffer.alloc(1024);
        const fd = openSync(cropAbs, "r");
        try { readSync(fd, b, 0, 1024, 0); } finally { closeSync(fd); }
        return b;
      })();
      must(
        cropHead.readFloatLE(76) === mapMeta.dmin && cropHead.readFloatLE(80) === mapMeta.dmax &&
          cropHead.readFloatLE(84) === mapMeta.dmean && cropHead.readFloatLE(216) === mapMeta.rms,
        "the summary's min/max/mean/σ are byte-equal to the crop's header words (76/80/84/216)"
      );
      must(mapMeta.dmax > mapMeta.dmin, `the stats are a real range (min ${mapMeta.dmin}, max ${mapMeta.dmax})`);
    }

    // the parent's own listing carries a map summary too — standalone truth:
    // orthovol.mrc was written by the seeder with start fields 0,0,0
    const hostOuts = await page.evaluate(async (id) => {
      const r = await fetch(`/api/jobs/${id}/outputs`);
      return { status: r.status, body: await r.json() };
    }, host.id);
    const hostMap = (hostOuts.body?.files ?? []).find((f) => f.name === "orthovol.mrc")?.map;
    must(
      !!hostMap && JSON.stringify(hostMap.origin) === "[0,0,0]",
      `the parent's own map summary reports a zero origin (got ${JSON.stringify(hostMap?.origin)})`
    );

    // ---- the card renders ----------------------------------------------------------
    console.log("== PHASE C2: the card renders ==");
    await page.locator(`[data-job="${newJobId}"]`).first().click({ force: true });
    await sleep(900);
    const resultsTab = page.locator('[role="tab"]', { hasText: "Results" });
    if (await resultsTab.isVisible().catch(() => false)) {
      await resultsTab.click();
      await sleep(900);
    }
    const card = page.locator('[data-canvas-ui="map-identity"]');
    must(await card.isVisible().catch(() => false), "the identity card is visible in the Results view");
    const cardText = (await card.textContent().catch(() => "")) ?? "";
    must(cardText.includes("Imported map"), `the card names itself (got "${cardText.slice(0, 60)}")`);
    must(cardText.includes(cropName), "the card shows the map's file name");
    must(cardText.includes("32 × 32 × 13 vox"), `the dims badge speaks the grid (got "${cardText.slice(0, 120)}")`);
    must(cardText.includes("Å / voxel"), "the spacing badge speaks the pixel size");
    must(cardText.includes("Sub-volume anchor at"), "the anchored branch is on the card");
    must(cardText.includes("(16, 16, 0)"), "the anchor coordinates are the box offset");
    must(cardText.includes(parentDirName), `the source line names the parent job dir (${parentDirName})`);
    must(cardText.includes("sent from the 3D viewer"), "the card remembers where the crop came from");
    must(cardText.includes("min") && cardText.includes("max"), "the density stats are on the card");
  }
} finally {
  // ---- Phase D: cleanup + console -------------------------------------------------
  console.log("== PHASE D: cleanup + console ==");
  if (newJobId) {
    const delRes = await fetch(`${BASE}/api/jobs/${newJobId}`, { method: "DELETE" });
    must(delRes.status === 200 || delRes.status === 204, `the probe job deletes (got ${delRes.status})`);
  }
  if (workdir) rmSync(path.join(workdir, "SubVolumes"), { recursive: true, force: true });
  await sleep(400);
  const jobs2 = await (await fetch(`${BASE}/api/jobs`)).json();
  must((jobs2.jobs ?? []).length === 21, `roster restored to 21 (got ${(jobs2.jobs ?? []).length})`);
  must(!cropAbs || !existsSync(cropAbs), "the materialized crop left with the cleanup");

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

  await browser.close();
}
console.log(fail === 0 ? "\nt256: ALL PASS" : `\nt256: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
