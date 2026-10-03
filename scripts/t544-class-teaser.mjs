// t544 — the Overview tab's class-averages teaser: the t539 receipt said
// "1 of 4 classes populated"; this face makes the two numbers VISIBLE —
// K tiles in class order, populated bright, empty a dimmed ghost.
//
//   A  the product face — the component (two lanes: stack slices vs
//      per-class volumes, the t539 labels, the populated chip, the dim
//      vocabulary), the lazy barrel, the type-gated Overview mount
//   B  the live lane — fixture project, a REAL local import, three classify
//      jobs that land PENDING (the resolver's own voice: "no upstream job
//      is wired that produces particles.star" — t540's waiting verdict),
//      and the computed workdirs seeded with the exact dialect the
//      mock/real refine writes (run_unmasked_classes.mrcs + it000
//      data/model star; per-class volumes for the 3D lane) — the binary
//      lanes stay t307/t308's territory, this suite is the READ side
//   C  the doors — /classes answers classesFile + slices + occupancy from
//      the seeded workdirs; the outputs/file door renders through the
//      RECORD-BACKED import job (a pending job has no run record by
//      design, and the door speaks records — the door dialects are the
//      same renderers either way); the empty job answers the absence shape
//   D  the face in the world — the Overview teaser renders 4 tiles, 2
//      bright + 2 ghosts, the "2 of 4 populated" chip (tile bytes come as
//      MrcImage error placeholders here — the bytes are proven in C); the
//      empty job self-hides; the import job never mounts one; console
//      clean. A resident-world class2d gets the real-bytes screenshot.
//
// Run: node scripts/t544-class-teaser.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const RELION_DIR = `${ROOT}/data/relion`;
const FIXTURE = `${ROOT}/data/relion/t544-teaser`;

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Content-Type": "application/json",
};
const api = async (method, url, body) => {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: SH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let b = null;
  try { b = await r.json(); } catch { /* binary */ }
  return { status: r.status, body: b };
};

/** one MRC header (1024B) + float32 payload — mode 2, little-endian */
function mrcBytes(nx, ny, nz, fill) {
  const h = Buffer.alloc(1024);
  h.writeInt32LE(nx, 0); h.writeInt32LE(ny, 4); h.writeInt32LE(nz, 8);
  h.writeInt32LE(2, 12); // mode 2 = float32
  const data = Buffer.alloc(nx * ny * nz * 4);
  for (let i = 0; i < nx * ny * nz; i++) data.writeFloatLE(fill, i * 4);
  return Buffer.concat([h, data]);
}

/** the settled-round star dialect: data rows + the model.star witness */
function starText(rows) {
  return (
    "data_particles\n\nloop_\n_rlnImageName #1\n_rlnClassNumber #2\n" +
    rows.map(([img, cls]) => `${img} ${cls}`).join("\n") + "\n"
  );
}
const MODEL_STAR =
  "data_model_general\n\nloop_\n_rlnSpectralOcupancy #1\n1.0\n";
const OPTIMISER_STAR =
  "data_optimiser_general\n\nloop_\n_rlnIterations #1\n1\n";

// ---- fixture bookkeeping ----------------------------------------------------
const createdJobs = [];
let fixtureProjectId = null;
let prevActiveProjectId = null;
let browser = null;
const consoleErrors = [];

// the classes route's workdir resolution #3: computed from type + id suffix
const workdirOf = (jobType, jobId) =>
  path.join(RELION_DIR, fixtureProjectId, `${jobType}_${jobId.slice(-8)}`);

async function runAndWaitNonIdle(jobId, label) {
  await api("POST", `/api/jobs/${jobId}/run`, {});
  // the resolver's honest voice: an inputless classify job lands PENDING
  // ("No upstream job is wired that produces particles.star") — the t540
  // waiting verdict, not a failure. Any non-idle status mounts the teaser.
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const d = await api("GET", `/api/jobs`);
    const j = (d.body?.jobs ?? []).find((x) => x.id === jobId);
    if (j && j.status !== "idle") {
      must(j.status === "pending" || j.status === "failed" || j.status === "completed",
        `${label} reaches a non-idle status (${j.status})`);
      return;
    }
  }
  must(false, `${label} leaves idle`);
}

try {
  // ---- Phase A: the product face -------------------------------------------
  console.log("== PHASE A: the product face ==");
  const comp = readFileSync(`${ROOT}/src/components/workflow/results/class-averages-teaser.tsx`, "utf8");
  must(comp.includes("useChartResource") && comp.includes("pollMs"),
    "the teaser rides the shared fetch state machine (t491)");
  must(comp.includes('"Class averages"') && comp.includes('"Class maps"'),
    "the t539 double label speaks (averages for stacks, maps for volumes)");
  must(comp.includes("of") && comp.includes("populated"),
    "the populated chip carries the t539 sentence shape");
  must(comp.includes("montage=0&slice=") && comp.includes("axis=z&pos=0.5"),
    "both door dialects named (stack slices + volume planes)");
  must(comp.includes("grayscale") && comp.includes("opacity-25"),
    "the empty class speaks as a dimmed ghost");
  must(comp.includes("ChartErrorStrip") && comp.includes("return null"),
    "the self-hide contract: wound is a strip, absence is silence");

  const lazy = readFileSync(`${ROOT}/src/components/workflow/results/results-lazy.tsx`, "utf8");
  must(lazy.includes("ClassAveragesTeaser"), "the lazy barrel carries the chunk");

  const view = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  must(view.includes("ClassAveragesTeaser") && view.includes("initialmodel"),
    "the mount is type-gated under the Overview (class2d/class3d/initialmodel)");

  // ---- Phase B: the live lane ----------------------------------------------
  console.log("== PHASE B: the live lane ==");
  // the canvas-borrowing law (t543): remember, restore, delete
  try {
    const meta = JSON.parse(readFileSync(`${ROOT}/data/projects.json`, "utf8"));
    prevActiveProjectId = typeof meta.active === "string" ? meta.active : null;
  } catch { /* no ledger */ }

  const proj = await api("POST", "/api/projects", { name: `t544 Teaser ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;
  must(!!fixtureProjectId, "the fixture project has an id");

  const mkJob = async (body) => {
    const r = await api("POST", "/api/jobs", body);
    if (r.status === 201 && r.body?.job?.id) createdJobs.push(r.body.job.id);
    return r.body?.job;
  };
  // spread positions: an edge-less fixture canvas stacks every node at the
  // same point, and a canvas click then opens the WRONG job's inspector
  // (the t544 forensics caught the force-click punching through to "t544
  // Empty") — positions make every node its own hit target
  const SPREAD = [
    { x: 120, y: 120 },
    { x: 620, y: 120 },
    { x: 120, y: 520 },
    { x: 620, y: 520 },
  ];
  let spreadIdx = 0;
  const mkSpreadJob = async (body) => mkJob({ ...body, ...(SPREAD[spreadIdx++] ?? { x: 900, y: 120 }) });

  // a REAL local import — the non-classify completed face
  mkdirSync(FIXTURE, { recursive: true });
  for (let i = 1; i <= 4; i++) writeFileSync(path.join(FIXTURE, `mic_0${i}.mrc`), mrcBytes(64, 64, 1, i));
  const importJob = await mkSpreadJob({ type: "import", name: "t544 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    const d = await api("GET", "/api/jobs");
    const j = (d.body?.jobs ?? []).find((x) => x.id === importJob.id);
    if (j?.status === "completed") break;
  }
  const d0 = await api("GET", "/api/jobs");
  must((d0.body?.jobs ?? []).find((x) => x.id === importJob.id)?.status === "completed",
    "the local import completed");

  // class2d — fails at dispatch (no extract inputs), then its computed
  // workdir receives the exact dialect the mock/real refine writes
  const j2d = await mkSpreadJob({ type: "class2d", name: "t544 Class2D", params: {} });
  must(!!j2d?.id, "the class2d job exists");
  await runAndWaitNonIdle(j2d.id, "the class2d dispatch");
  const wd2d = workdirOf("class2d", j2d.id);
  mkdirSync(wd2d, { recursive: true });
  // 4-slice stack: RELION wrote 4 class slots; slices carry distinct fills
  writeFileSync(path.join(wd2d, "run_unmasked_classes.mrcs"), mrcBytes(64, 64, 4, 0));
  const rows = [];
  for (let i = 1; i <= 8; i++) rows.push([`${String(i).padStart(6, "0")}@extract/mic_01_extract.mrcs`, 2]);
  for (let i = 9; i <= 12; i++) rows.push([`${String(i).padStart(6, "0")}@extract/mic_01_extract.mrcs`, 3]);
  writeFileSync(path.join(wd2d, "run_it000_data.star"), starText(rows));
  writeFileSync(path.join(wd2d, "run_it000_model.star"), MODEL_STAR);
  writeFileSync(path.join(wd2d, "run_it000_optimiser.star"), OPTIMISER_STAR);
  must(existsSync(path.join(wd2d, "run_unmasked_classes.mrcs")), "the class2d fixture stack is seeded");

  // class3d — the per-class VOLUME lane (real RELION dialect)
  const j3d = await mkSpreadJob({ type: "class3d", name: "t544 Class3D", params: {} });
  must(!!j3d?.id, "the class3d job exists");
  await runAndWaitNonIdle(j3d.id, "the class3d dispatch");
  const wd3d = workdirOf("class3d", j3d.id);
  mkdirSync(wd3d, { recursive: true });
  writeFileSync(path.join(wd3d, "run_it000_class001.mrc"), mrcBytes(8, 8, 8, 1));
  writeFileSync(path.join(wd3d, "run_it000_class002.mrc"), mrcBytes(8, 8, 8, 2));
  writeFileSync(path.join(wd3d, "run_it000_data.star"), starText([["000001@extract/particles.mrcs", 1], ["000002@extract/particles.mrcs", 2]]));
  writeFileSync(path.join(wd3d, "run_it000_model.star"), MODEL_STAR);
  writeFileSync(path.join(wd3d, "run_it000_optimiser.star"), OPTIMISER_STAR);

  // the honest empty: a class2d whose workdir never materializes
  const jempty = await mkSpreadJob({ type: "class2d", name: "t544 Empty", params: {} });
  must(!!jempty?.id, "the empty class2d job exists");
  await runAndWaitNonIdle(jempty.id, "the empty class2d dispatch");

  // ---- Phase C: the doors ---------------------------------------------------
  console.log("== PHASE C: the doors ==");
  const c2d = await api("GET", `/api/jobs/${j2d.id}/classes`);
  must(c2d.status === 200, `the classes route answers for class2d (${c2d.status})`);
  must(c2d.body?.classesFile === "run_unmasked_classes.mrcs",
    `the stack is named (${c2d.body?.classesFile ?? "null"})`);
  must(c2d.body?.classesSlices === 4, `K = the stack's nz (${c2d.body?.classesSlices})`);
  const occ = c2d.body?.classes ?? [];
  must(occ.length === 2 && occ[0].cls === 2 && occ[0].count === 8,
    "the occupancy counts the data star's own classes (8×cls2, 4×cls3)");

  const c3d = await api("GET", `/api/jobs/${j3d.id}/classes`);
  must(c3d.status === 200 && (c3d.body?.volumeFiles ?? []).length === 2,
    `the volume lane names both class maps (${(c3d.body?.volumeFiles ?? []).length})`);
  must(!(c3d.body?.classesFile), "the class3d workdir keeps the volume lane (no combined stack)");

  // the door dialects, through the RECORD-BACKED import job: a pending job
  // has no run record by design (t540) and the door speaks records — the
  // teaser's tile URLs hit the SAME renderers either way (stack + montage=0
  // + slice=N falls through to renderMrcSlicePng; volumes ride axis=z).
  // The import workdir is the record-backed stage: seed both probe shapes
  // there (imports reference their sources — no mrc lands in the listing).
  const importWd = (await api("GET", `/api/jobs/${importJob.id}/outputs`)).body?.workdir;
  must(!!importWd, `the outputs route names the import workdir (${importWd ?? "none"})`);
  if (importWd) {
    writeFileSync(path.join(importWd, "probe_stack.mrcs"), mrcBytes(64, 64, 4, 0));
    writeFileSync(path.join(importWd, "probe_vol.mrc"), mrcBytes(8, 8, 8, 3));
    const slice0 = await fetch(`${BASE}/api/jobs/${importJob.id}/outputs/file?path=${encodeURIComponent("probe_stack.mrcs")}&format=png&montage=0&slice=2`, { headers: SH });
    must(slice0.status === 200 && (slice0.headers.get("content-type") ?? "").includes("image/png"),
      `the stack-slice door dialect answers (${slice0.status})`);
    const vol0 = await fetch(`${BASE}/api/jobs/${importJob.id}/outputs/file?path=${encodeURIComponent("probe_vol.mrc")}&format=png&axis=z&pos=0.5`, { headers: SH });
    must(vol0.status === 200 && (vol0.headers.get("content-type") ?? "").includes("image/png"),
      `the volume-plane door dialect answers (${vol0.status})`);
  }

  const cempty = await api("GET", `/api/jobs/${jempty.id}/classes`);
  must(cempty.status === 200 && !cempty.body?.classesFile && (cempty.body?.classes ?? []).length === 0,
    "the empty job answers the absence shape (not a wound)");

  // ---- Phase D: the face in the world --------------------------------------
  console.log("== PHASE D: the face in the world ==");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(3000);

  // no force: a force-click punches through overlapping canvas nodes and
  // opens the WRONG job's inspector (the t544 forensics caught exactly
  // that — the dialog said "t544 Empty"). Actionability keeps the hit
  // honest; the identity assertion below convicts any relapse.
  await page.locator(`[data-job="${j2d.id}"]`).first().click().catch(() => {});
  await sleep(2500);
  must((await page.locator('[role="dialog"]').count()) > 0, "the inspector dialog opened");
  must((await page.locator('[role="dialog"]').getByText("t544 Class2D", { exact: true }).count()) >= 1,
    "the inspector is THE class2d job's (identity, not just a dialog)");
  // t363's auto-tab law lands classifications on RESULTS — the teaser is an
  // OVERVIEW face, so the suite clicks the Overview trigger like a user
  await page.getByRole("tab").filter({ hasText: "Overview" }).first().click().catch(() => {});
  await sleep(1800);
  const teaser = page.locator('section[aria-label="Class averages"]');
  if (!(await teaser.isVisible().catch(() => false))) {
    // forensics — the probe passes with identical steps; catch the delta
    const sel = await page.locator('[role="dialog"] [role="tab"][aria-selected="true"]').first().textContent().catch(() => "?");
    const anySel = await page.locator('[role="tab"][aria-selected="true"]').allTextContents().catch(() => []);
    const secs = await page.locator('[role="dialog"] section').allTextContents().catch(() => []);
    await page.screenshot({ path: `${ROOT}/.qa-logs/t544-phase-d-forensics.png` });
    console.log(`  [forensics] selected tab: ${JSON.stringify(sel)} | page-wide selected: ${JSON.stringify(anySel)} | sections: ${JSON.stringify(secs.map((s) => s.slice(0, 36)))}`);
  }
  must(await teaser.isVisible().catch(() => false), "the Overview shows the class-averages teaser");
  const tiles = teaser.locator("[data-class-tile]");
  must((await tiles.count()) === 4, `four class tiles (got ${await tiles.count()})`);
  must((await teaser.getByText("2 of 4 populated", { exact: true }).count()) === 1,
    "the chip speaks the t539 sentence (2 of 4 populated)");
  must((await teaser.getByText("8", { exact: true }).count()) >= 1 && (await teaser.getByText("—", { exact: true }).count()) === 2,
    "two tiles carry counts, two ghosts carry the dash");
  await page.screenshot({ path: `${ROOT}/shots-qa/t544-class-teaser.png` });

  // the resident world's REAL bytes: back to the borrowed canvas's original
  // owner (where the completed classify jobs live), then the same face with
  // actual class-average images (best effort: the resident world may evolve,
  // the fixture contract above is the law)
  if (prevActiveProjectId) {
    await fetch(`${BASE}/api/projects/switch`, { method: "POST", headers: SH, body: JSON.stringify({ id: prevActiveProjectId }) }).catch(() => {});
    await sleep(2500);
  }
  const all = (await api("GET", "/api/jobs")).body?.jobs ?? [];
  const resident = all.find(
    (j) => /^(class2d|class3d)$/i.test(j.type) && j.status === "completed"
  );
  if (resident) {
    const rc = await api("GET", `/api/jobs/${resident.id}/classes`);
    const answerable = rc.body?.classesFile || (rc.body?.volumeFiles ?? []).length > 0;
    if (answerable) {
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(600);
      await page.locator(`[data-job="${resident.id}"]`).first().click().catch(() => {});
      await sleep(2500);
      await page.getByRole("tab").filter({ hasText: "Overview" }).first().click().catch(() => {});
      await sleep(1800);
      const rt = page.locator('section[aria-label="Class averages"]');
      if (await rt.isVisible().catch(() => false)) {
        const imgs = rt.locator("img");
        must((await imgs.count()) >= 1, `the resident ${resident.type} teaser mounts with image tiles`);
        await page.screenshot({ path: `${ROOT}/shots-qa/t544-class-teaser-resident.png` });
      } else {
        console.log("  (skip) the resident job's teaser stayed hidden — world-dependent, the fixture face is the law");
      }
    } else {
      console.log("  (skip) the resident classify job has no answerable classes data");
    }
  } else {
    console.log("  (skip) no completed classify job in the resident world");
  }

  // the empty job self-hides
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(600);
  await page.locator(`[data-job="${jempty.id}"]`).first().click().catch(() => {});
  await sleep(2000);
  must((await page.locator('section[aria-label="Class averages"]').count()) === 0,
    "the empty job's Overview stays silent (absence, not a wound)");

  // the import job never mounts one
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(600);
  await page.locator(`[data-job="${importJob.id}"]`).first().click().catch(() => {});
  await sleep(1500);
  must((await page.locator('section[aria-label="Class averages"]').count()) === 0,
    "the import job never mounts a teaser (the type gate)");

  // the fixture's pending class2d has no run record (t540), so its four
  // tile-byte requests answer 400 — the EXPECTED placeholder shape, not a
  // wound. Anything else on the console is a real error and fails.
  const unexpected = consoleErrors.filter((e) => !/400 \(Bad Request\)/.test(e));
  must(unexpected.length === 0,
    `console carries only the expected fixture tile 400s (${unexpected.length} unexpected of ${consoleErrors.length})`);
} catch (e) {
  fail++;
  console.log(`  FAIL: unexpected: ${e?.message ?? e}`);
} finally {
  try {
    if (prevActiveProjectId) {
      await fetch(`${BASE}/api/projects/switch`, { method: "POST", headers: SH, body: JSON.stringify({ id: prevActiveProjectId }) }).catch(() => {});
    }
    if (fixtureProjectId) {
      await fetch(`${BASE}/api/projects/${fixtureProjectId}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
    for (const id of [...createdJobs].reverse()) {
      await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
  } catch { /* best effort */ }
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* gone */ }
  if (browser) { try { await browser.close(); } catch { /* gone */ } }
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
