// t254 — the clip box learns to write .mrc (Task 254).
// The 3D viewer's ChimeraX-style clip crops the ISOSURFACE; t253 taught
// the 2D tiles to speak that state; this task gives the crop a BODY —
// the kept box downloads as a standalone .mrc (the RELION box-subregion
// workflow: a region of interest becomes its own map for focused
// processing).
//
//   GET /api/jobs/[id]/outputs/subvolume?path=…&x0,x1,y0,y1,z0,z1 (0…1)
//
// The route wears the t251 read-ring door (same-origin + Host pin — it
// serves workdir-derived bytes), resolves the path through the shared
// containment policy (resolveInsideJobWorkdir + the pathref escape
// hatch), and answers with a fresh classic MRC2014 file: dims from the
// box, start fields recording WHERE in the parent the crop lives, cella
// rescaled so voxel spacing survives, dmin/dmax/dmean/RMS recomputed
// from the actual cropped voxels. The client resolves the clip's invert
// side BEFORE calling — the API speaks plain geometry.
//
// Phases:
//   A  demo truth — homepage 200, roster 23, the seeded volume host
//   B  the ledger — route guard + containment + lib + the embed's export
//      button, all asserted at source
//   C  the door — four states on the new route (bare / cross-site /
//      rebound-Host curl → 403; same-origin → the route SPEAKS its
//      contract, which is the door-open proof)
//   D  contract + containment — traversal 400 naming data/relion,
//      non-MRC 400, missing/bad fractions 400 with contract messages
//   E  BYTE-CORRECTNESS — two crops fetched FROM THE PAGE (the browser's
//      own same-origin world), every voxel compared bit-for-bit against
//      the parent file, header continuity (start fields, dims, mode,
//      MAP magic) and recomputed dmin/dmax all verified
//   F  the UI — clip ON, Z driven to 20% by KEYBOARD, the button's dims
//      label matches the server's floor/ceil conversion EXACTLY, the
//      flip-side button re-speaks it, and the click produces a real
//      download whose bytes are the honest crop
//   G  console clean
//
// Run: node scripts/t254-subvolume-export.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";
const TMP = "/home/z/my-project/scripts/tmp-t254";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// seed the volume world (t210/t253's recipe — idempotent, roster stays 23)
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });

const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
const roster = (jobs.jobs ?? []).length;
const host = (jobs.jobs ?? []).find((j) => j.name === "QA Refine3D");

// the parent map on disk — the export's ground truth
const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const workdir = state[host.id]?.workdir;
const parentPath = path.join(workdir, "orthovol.mrc");
const parent = readFileSync(parentPath);
const PN = 64;
const parentVoxel = (i, j, k) => parent.readFloatLE(1024 + ((k * PN + j) * PN + i) * 4);

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
must(roster === 23, `roster identity 23 (got ${roster})`);
must(!!host && !!workdir, "QA Refine3D in roster with an on-disk workdir");
must(existsSync(parentPath), "the parent map (orthovol.mrc) is on disk");

// ---- Phase B: the ledger -------------------------------------------------------
console.log("== PHASE B: the ledger ==");
const routeSrc = readFileSync("src/app/api/jobs/[id]/outputs/subvolume/route.ts", "utf8");
must(
  routeSrc.includes("isLocalRequest(request)") && routeSrc.includes("resolveInsideJobWorkdir"),
  "the route wears the read-ring door + the shared containment policy"
);
must(
  routeSrc.includes("readPathrefTarget") && routeSrc.includes("isMrcPath"),
  "the pathref escape hatch + the MRC-only gate are in the route"
);
must(
  routeSrc.includes("Math.floor(x0 * head.nx)") && routeSrc.includes("Math.ceil(x1 * head.nx)"),
  "fractions become voxels by floor/ceil (every non-degenerate interval is non-empty)"
);
const libSrc = readFileSync("src/lib/mrc.ts", "utf8");
must(
  libSrc.includes("export function readMrcSubvolume") && libSrc.includes("MAX_SUBVOLUME_BYTES"),
  "the lib crops section-wise under a hard byte cap (the OOM doctrine)"
);
must(
  libSrc.includes("pStart[0] + ix0") && libSrc.includes("out.writeInt32LE(16777214, 212)"),
  "the sub header continues the parent's start fields + writes the LE machine stamp"
);
const embed = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
must(
  embed.includes("const keptFractions") && embed.includes("v >= 0.999 ? [0, 1] : st.invert ? [v, 1] : [0, v]"),
  "the embed resolves the clip's kept box — unclipped axes stay FULL even when inverted (the scene's truth)"
);
must(
  embed.includes("const exportSubvolume") && embed.includes("outputs/subvolume"),
  "the export button builds the subvolume URL and triggers the download"
);
must(
  embed.includes("Math.ceil(x1 * d[0]) - Math.floor(x0 * d[0])"),
  "the dims label uses the server's own floor/ceil conversion (the label never lies)"
);

// ---- Phase C: the door — four states -------------------------------------------
console.log("== PHASE C: the door ==");
const doorUrl = (q) => `${BASE}/api/jobs/${host.id}/outputs/subvolume?${q}`;
const GOOD_Q = "path=orthovol.mrc&x0=0.25&x1=0.75&y0=0.25&y1=0.75&z0=0.25&z1=0.75";

const bare = await fetch(doorUrl(GOOD_Q));
must(bare.status === 403, `bare request (no fetch metadata) → 403 (got ${bare.status})`);
const cross = await fetch(doorUrl(GOOD_Q), { headers: { Origin: "http://attacker.com" } });
must(cross.status === 403, `cross-site Origin → 403 (got ${cross.status})`);

const { execSync: es } = await import("node:child_process");
const rebind = es(
  `curl -s -o /dev/null -w "%{http_code}" -H "Host: attacker.com" -H "Origin: http://attacker.com" "${doorUrl(GOOD_Q)}"`,
  { encoding: "utf8" }
);
must(rebind.trim() === "403", `rebound Host (curl forges; undici refuses) → 403 (got ${rebind})`);

// same-origin → the door OPENS and the route speaks — a contract error, not 403
const own = await fetch(doorUrl("path=orthovol.mrc"), {
  headers: { Origin: BASE, "sec-fetch-site": "same-origin" },
});
const ownBody = await own.json();
must(
  own.status === 400 && typeof ownBody.error === "string" && ownBody.error.includes("x0"),
  `same-origin opens the door; the route speaks its contract (got ${own.status}: ${ownBody.error?.slice(0, 60)})`
);

// ---- Phase D: contract + containment -------------------------------------------
console.log("== PHASE D: contract + containment ==");
const H = { Origin: BASE, "sec-fetch-site": "same-origin" };
const get = async (q) => {
  const r = await fetch(doorUrl(q), { headers: H });
  let b = {};
  try { b = await r.json(); } catch { /* binary body */ }
  return { status: r.status, body: b, res: r };
};

const trav = await get(`path=${encodeURIComponent("../../../../../../etc/passwd")}&x0=0&x1=0.5&y0=0&y1=0.5&z0=0&z1=0.5`);
must(
  trav.status === 400 && /Invalid path|escapes the job directory/.test(trav.body.error ?? ""),
  `workdir traversal → 400 containment contract (got ${trav.status}: ${(trav.body.error ?? "").slice(0, 50)})`
);
// an EXISTING non-MRC file in the workdir — the containment layer's 404
// vs the MRC gate's 400 must stay distinct (the seeder's workdir carries
// only the map, so the test plants its own dummy — idempotent)
import { readdirSync, writeFileSync } from "node:fs";
const dummyTxt = path.join(workdir, "qa-notes.txt");
if (!existsSync(dummyTxt)) writeFileSync(dummyTxt, "t254's MRC-gate probe file\n");
const workdirFiles = readdirSync(workdir);
const nonMrc = workdirFiles.find((f) => !/\.(mrc|mrcs|map|ccp4|ctf|pathref)$/i.test(f) && !f.startsWith("."));
const notMrc = await get(`path=${encodeURIComponent(nonMrc ?? "definitely-absent.star")}&x0=0&x1=0.5&y0=0&y1=0.5&z0=0&z1=0.5`);
must(
  notMrc.status === 400 && (notMrc.body.error ?? "").includes("MRC"),
  `non-MRC path ("${nonMrc ?? "absent"}") → 400 MRC-only gate (got ${notMrc.status}: ${(notMrc.body.error ?? "").slice(0, 50)})`
);
const missing = await get("path=orthovol.mrc&x0=0&x1=0.5&y0=0&y1=0.5");
must(missing.status === 400, `missing fractions → 400 (got ${missing.status})`);
const degenerate = await get("path=orthovol.mrc&x0=0.5&x1=0.5&y0=0&y1=0.5&z0=0&z1=0.5");
must(
  degenerate.status === 400 && (degenerate.body.error ?? "").includes("0 ≤ lo < hi"),
  `x0 == x1 → 400 contract (got ${degenerate.status}: ${(degenerate.body.error ?? "").slice(0, 50)})`
);
const inverted = await get("path=orthovol.mrc&x0=0.8&x1=0.2&y0=0&y1=0.5&z0=0&z1=0.5");
must(inverted.status === 400, `x0 > x1 → 400 (got ${inverted.status})`);
const outOfRange = await get("path=orthovol.mrc&x0=0&x1=1.5&y0=0&y1=0.5&z0=0&z1=0.5");
must(outOfRange.status === 400, `x1 > 1 → 400 (got ${outOfRange.status})`);
const missingFile = await get("path=ghost.mrc&x0=0&x1=0.5&y0=0&y1=0.5&z0=0&z1=0.5");
must(missingFile.status === 404, `nonexistent map → 404 (got ${missingFile.status})`);

// ---- Phase E: BYTE-CORRECTNESS through the page ---------------------------------
console.log("== PHASE E: byte correctness (every voxel, two crops) ==");
const pageFetchCrop = async (q) =>
  page.evaluate(async (u) => {
    const r = await fetch(u); // the browser's own same-origin world — the door opens
    const u8 = new Uint8Array(await r.arrayBuffer());
    // no Node Buffer in the page — chunked btoa (32k chunks dodge the
    // apply() argument limit)
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    }
    return {
      status: r.status,
      disposition: r.headers.get("content-disposition") ?? "",
      length: u8.length,
      b64: btoa(s),
    };
  }, doorUrl(q));

const compareCrop = (b64, label, [ix0, ix1, iy0, iy1, iz0, iz1]) => {
  const buf = Buffer.from(b64, "base64");
  const sx = ix1 - ix0, sy = iy1 - iy0, sz = iz1 - iz0;
  let ok = true;
  // header: dims / mode / start / MAP magic / ispg / nsymbt
  ok &&= buf.readInt32LE(0) === sx && buf.readInt32LE(4) === sy && buf.readInt32LE(8) === sz;
  ok &&= buf.readInt32LE(12) === 2; // mode preserved
  ok &&= buf.readInt32LE(16) === ix0 && buf.readInt32LE(20) === iy0 && buf.readInt32LE(24) === iz0;
  ok &&= buf.toString("ascii", 208, 212) === "MAP ";
  ok &&= buf.readInt32LE(88) === 1 && buf.readInt32LE(92) === 0;
  if (!ok) { must(false, `${label}: header continuity (dims/mode/start/MAP/ispg)`); return; }
  // every voxel bit-equal to the parent at the mapped position
  for (let k = 0; k < sz; k++)
    for (let j = 0; j < sy; j++)
      for (let i = 0; i < sx; i++) {
        const got = buf.readFloatLE(1024 + ((k * sy + j) * sx + i) * 4);
        const want = parentVoxel(ix0 + i, iy0 + j, iz0 + k);
        if (got !== want) { must(false, `${label}: voxel (${i},${j},${k}) got ${got} want ${want}`); return; }
      }
  // recomputed dmin/dmax are the crop's own truth
  let mn = Infinity, mx = -Infinity;
  for (let k = 0; k < sz; k++)
    for (let j = 0; j < sy; j++)
      for (let i = 0; i < sx; i++) {
        const v = parentVoxel(ix0 + i, iy0 + j, iz0 + k);
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
  ok &&= buf.readFloatLE(76) === mn && buf.readFloatLE(80) === mx;
  must(ok, `${label}: ${sx}×${sy}×${sz} voxels bit-equal to the parent + start (${ix0},${iy0},${iz0}) + dmin/dmax recomputed`);
};

const cropA = await pageFetchCrop("path=orthovol.mrc&x0=0.25&x1=0.75&y0=0.25&y1=0.75&z0=0.25&z1=0.75");
must(cropA.status === 200 && cropA.length === 1024 + 32 * 32 * 32 * 4, `crop A arrives whole (${cropA.length} bytes)`);
must(cropA.disposition.includes("attachment") && cropA.disposition.includes("orthovol_crop_16-48_16-48_16-48"), `Content-Disposition names the box (${cropA.disposition.slice(21, 60)}…)`);
compareCrop(cropA.b64, "crop A", [16, 48, 16, 48, 16, 48]);

const cropB = await pageFetchCrop("path=orthovol.mrc&x0=0&x1=1&y0=0.5&y1=1&z0=0&z1=0.5");
compareCrop(cropB.b64, "crop B (full X)", [0, 64, 32, 64, 0, 32]);

// ---- Phase F: the UI — the clip's crop, downloaded -------------------------------
console.log("== PHASE F: the UI downloads the crop ==");
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

const exportBtn = page.locator('button', { hasText: "export sub-volume" }).first();
must(await exportBtn.isVisible().catch(() => false), "the export button lives in the clip panel");
must(
  (await exportBtn.textContent()).includes("64×64×64 vox"),
  `unclipped, the label speaks the whole box (got "${(await exportBtn.textContent()).trim()}")`
);

// drive the Z slider deterministically — keyboard (Home = 0.02, ArrowRight = 0.01)
const zSlider = page.locator('[role="slider"][aria-label="Clip position along the Z axis"]');
await zSlider.focus();
await page.keyboard.press("Home");
await sleep(120);
for (let i = 0; i < 18; i++) await page.keyboard.press("ArrowRight");
await sleep(700);
const readoutZ = await zSlider.getAttribute("aria-valuenow");
must(readoutZ !== null && Math.abs(Number(readoutZ) - 0.2) <= 0.03, `Z clip lands at ~20% (got ${readoutZ})`);

// the dims label must equal the server's own floor/ceil conversion: Z [0, 0.2] → ceil(12.8) = 13
must(
  (await exportBtn.textContent()).includes("64×64×13 vox"),
  `the label re-speaks at Z 20% — 64×64×13 vox (got "${(await exportBtn.textContent()).trim()}")`
);

// flip side — kept Z [0.2, 1] → 64 - floor(12.8) = 52
await page.locator('button', { hasText: "flip side" }).first().click();
await sleep(500);
must(
  (await exportBtn.textContent()).includes("64×64×52 vox"),
  `flip side re-speaks — Z [20%, 100%] → 64×64×52 vox (got "${(await exportBtn.textContent()).trim()}")`
);
await page.locator('button', { hasText: "flip side" }).first().click(); // back to [0, v]
await sleep(400);

// the click produces a REAL download whose bytes are the honest crop
mkdirSync(TMP, { recursive: true });
const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
await exportBtn.click();
const download = await downloadPromise;
const dlUrl = new URL(download.url());
must(
  dlUrl.pathname.endsWith(`/api/jobs/${host.id}/outputs/subvolume`),
  `the download hits the subvolume route (${dlUrl.pathname.slice(-40)})`
);
must(
  dlUrl.searchParams.get("x0") === "0" && dlUrl.searchParams.get("x1") === "1" &&
  dlUrl.searchParams.get("z1") === readoutZ,
  `the URL carries the clip's kept fractions (z1=${dlUrl.searchParams.get("z1")})`
);
const dlPath = path.join(TMP, "ui-download.mrc");
await download.saveAs(dlPath);
const dl = readFileSync(dlPath);
const nz = dl.readInt32LE(8);
must(
  dl.readInt32LE(0) === 64 && dl.readInt32LE(4) === 64 && nz === Math.ceil(Number(readoutZ) * 64),
  `the downloaded header dims are the honest crop (64×64×${nz})`
);
let voxOk = true;
for (let k = 0; k < nz && voxOk; k++)
  for (let j = 0; j < 64 && voxOk; j++)
    for (let i = 0; i < 64 && voxOk; i++)
      if (dl.readFloatLE(1024 + ((k * 64 + j) * 64 + i) * 4) !== parentVoxel(i, j, k)) voxOk = false;
must(voxOk, `all ${64 * 64 * nz} downloaded voxels are the parent's own (${nz} sections)`);

// the frame — the export button in the clip panel with its live dims label
mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: `${SHOTS}/t254-subvolume-export-2x.png` });

// ---- Phase G: console -------------------------------------------------------------
console.log("== PHASE G: console ==");
must(consoleErrors.length === 0, `console clean (got ${consoleErrors.length}: ${consoleErrors.slice(0, 2).join(" | ")})`);

await browser.close();
console.log(fail === 0 ? "t254: ALL PASS" : `t254: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
