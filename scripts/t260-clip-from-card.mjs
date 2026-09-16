// t260 — the anchor box's way home (Task 260).
// t256/t257 taught both story cards WHAT a crop is and WHERE it came from;
// t258 gave them a View in 3D door. But the door only ever opened the CROP
// — the story's other half, the PARENT context, stayed locked. t260 adds
// the door the story always implied: "Show in parent" opens the PARENT's
// map with the clip planes ALREADY anchored on the crop's box:
//   - MapIdentityCard (t256): aims the shared Mol* dialog at the parent
//     map (MolViewerTarget: job + path + box) — one dialog, many doors,
//   - ReferenceMapCard (t257): the same door on the consumer side, aimed
//     through the provider's own incoming edges,
//   - resolution = graph edges + a geometric check (parent grid must hold
//     origin+dims; half/mask/stack names and chained parents never pass),
//   - the clip gains a GENERAL box language: [lo,hi] per axis (two planes
//     per cut axis, per-plane invert) — the slider language cannot hold a
//     two-sided cut, so in box mode the sliders stand down and a violet
//     readout carries the numbers; export/send read the same intervals.
//
// Phases:
//   A  demo truth — homepage 200, roster 21, the orthovol host on disk
//   B  the ledger — the resolver hook, the general-box clip machinery,
//      both doors, the honest readout/release controls — at source
//   C  the live loop — REAL two-sided crop (X 25–75%, Y full, Z 25–50%)
//      → Import Map runs natively → the identity card's "Show in parent"
//      opens the PARENT map with the box readout speaking the crop's own
//      intervals + the 2D tiles echoing them + the export label = the
//      crop's dims → release returns the full map; the plain View in 3D
//      opens UNCLIPPED → probe refine3d seeded the qa60 way → the
//      reference card's "Show in parent" repeats the trip from the
//      consumer side
//   D  console clean
//
// Run: node scripts/t260-clip-from-card.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const TMP = "/home/z/my-project/scripts/tmp-t260";
const SHOTS = "/home/z/my-project/shots-qa";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GL-truth probe: count non-background pixels ON the Mol* canvas (the
 *  SVG wireframe and the state-driven readouts live OUTSIDE it). This is
 *  the check that caught the t253-era inert clip: every state layer spoke
 *  the box while the scene kept rendering the full volume. */
const canvasContent = () =>
  page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const c = dialogs[dialogs.length - 1]?.querySelector("canvas");
    if (!c) return null;
    const w = c.width, h = c.height;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    ctx.drawImage(c, 0, 0);
    const img = ctx.getImageData(0, 0, w, h).data;
    const px = (x, y) => {
      const i = (y * w + x) * 4;
      return [img[i], img[i + 1], img[i + 2]];
    };
    const bg = px(4, 4);
    let total = 0;
    for (let y = 0; y < h; y += 3)
      for (let x = 0; x < w; x += 3) {
        const [r, g, b] = px(x, y);
        if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 30) total++;
      }
    return total;
  });

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// ---- self-healing preconditions (t255/t258 doctrine: sweep this suite's
// own leftovers BEFORE they poison the next run's roster assertions) -------
const pre = await (await fetch(`${BASE}/api/jobs`)).json();
const preJobs = pre.jobs ?? [];
for (const j of preJobs.filter((x) => x.type === "mapimport" || x.name.startsWith("QA RefProbe"))) {
  await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" });
  console.log(`  (self-heal) removed leftover probe "${j.name}"`);
}
{
  const hostPre = preJobs.find((j) => j.name === "QA Refine3D");
  const stPre = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
  const hostWd = hostPre ? stPre[hostPre.id]?.workdir : undefined;
  if (hostWd) {
    const sub = path.join(hostWd, "SubVolumes");
    if (existsSync(sub)) {
      for (const f of execSync(`ls ${sub}`).toString().split("\n").filter((n) => n.includes("_crop_"))) {
        rmSync(path.join(sub, f), { force: true });
        console.log(`  (self-heal) swept leftover crop ${f}`);
      }
    }
  }
}

const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (jobs0.jobs ?? []).length;
const host = (jobs0.jobs ?? []).find((j) => j.name === "QA Refine3D");
const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
const hostWd = host ? state[host.id]?.workdir : undefined;
const parentMap = hostWd ? path.join(hostWd, "orthovol.mrc") : undefined;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1720, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const created = []; // probe job ids for cleanup (order: import, refine)

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 21, `roster identity 21 (got ${roster0})`);
  must(!!host && !!hostWd, "QA Refine3D in roster with an on-disk workdir");
  must(existsSync(parentMap), "the parent map (orthovol.mrc) is on disk");

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");

  const resolverSrc = src("src/components/workflow/results/anchor-parent.ts");
  must(
    resolverSrc.includes("export function useAnchorParent("),
    "the parent resolver is a shared hook (one implementation, both cards)"
  );
  must(
    resolverSrc.includes("d >= box.start[i] + box.size[i]"),
    "the geometric check: the parent grid must HOLD origin+dims on every axis"
  );
  must(
    resolverSrc.includes("/half|mask|mrcs/i"),
    "half-maps, masks and stacks never pose as the parent map"
  );
  must(
    resolverSrc.includes("chain safety"),
    "a chained parent (its own start ≠ 0) would anchor in the wrong frame — the door stays silent"
  );

  const viewerSrc = src("src/components/workflow/results/mol-viewer.tsx");
  must(
    viewerSrc.includes("export interface MolClipBox") && viewerSrc.includes("export interface MolViewerTarget"),
    "the viewer speaks a target language (job + path + optional anchored box)"
  );
  must(
    viewerSrc.includes("initialClipBox={initialClipBox ?? null}"),
    "the box rides through to the embed"
  );

  const embedSrc = src("src/components/workflow/results/molstar-embed.tsx");
  must(
    embedSrc.includes('initialClipBox?: import("./mol-viewer").MolClipBox | null'),
    "the embed takes the anchored box (type-only import — no runtime cycle with its lazy loader)"
  );
  must(
    embedSrc.includes("const applyClipBoxIntent"),
    "the box anchors through one intent applier"
  );
  must(
    embedSrc.includes("anchored-box language: two opposing planes per cut axis"),
    "a general box builds TWO planes per cut axis (per-plane invert — the slider language can't hold a two-sided cut)"
  );
  must(
    embedSrc.includes("if (st.box) return [[st.box.lo[0], st.box.hi[0]]"),
    "export/send read the SAME intervals (re-exporting the parent's view re-materializes the crop)"
  );
  must(
    embedSrc.includes("on && !clipStateRef.current.box"),
    "the anchored box is read-only: no movable faces while it owns the geometry"
  );
  must(
    embedSrc.includes("each open re-anchors"),
    "the box applies once per mount — every open re-anchors, a plain open stays untouched"
  );

  const orthoSrc = src("src/components/workflow/results/map-ortho-panel.tsx");
  must(
    orthoSrc.includes("if (clip.box) return [clip.box.lo[AX[ax]], clip.box.hi[AX[ax]]]"),
    "the 2D tiles speak the box's kept intervals (the third echo carries the box)"
  );

  const resultsSrc = src("src/components/workflow/results/results-view.tsx");
  must(
    resultsSrc.includes('data-testid="map-card-show-parent"'),
    "the identity card's show-in-parent door carries its test hook"
  );
  must(
    resultsSrc.includes("useAnchorParent(anchorBox ? job.id : null, anchorBox)"),
    "the card resolves the parent BEFORE any early return (hooks order is not negotiable)"
  );
  must(
    resultsSrc.includes("initialClipBox={molTarget?.box ?? null}"),
    "the shared dialog opens on the full target (box included)"
  );

  const cardSrc = src("src/components/workflow/reference-map-card.tsx");
  must(
    cardSrc.includes('data-testid="reference-show-parent"'),
    "the reference card's show-in-parent door carries its test hook"
  );
  must(
    cardSrc.includes("const parentOfCrop = useAnchorParent("),
    "the consumer side resolves through the provider's own incoming edges"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (two-sided crop → parent, both cards) ==");

  // C1 — a REAL crop via the t255 send route, geometry deliberately mixed:
  // X two-sided (25–75%), Y UNcut (full), Z two-sided (25–50%) — the exact
  // shape the slider language cannot re-express, so the general box does
  // the talking. The route wires the parent→import edge itself.
  const sendRes = await fetch(`${BASE}/api/jobs/${host.id}/outputs/subvolume-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "orthovol.mrc",
      x0: 0.25, x1: 0.75, y0: 0, y1: 1, z0: 0.25, z1: 0.5,
    }),
  });
  must(sendRes.status === 201, `the send route materializes the crop (got ${sendRes.status})`);
  const sent = await sendRes.json();
  const importJob = sent.job;
  created.push(importJob.id);
  must(!!importJob?.id && importJob.type === "mapimport", "the Import Map citizen was created");
  must(
    typeof sent.crop?.name === "string" && sent.crop.name.includes("orthovol_crop"),
    `the crop file speaks its voxel box in its name (${sent.crop?.name ?? "?"})`
  );

  // C2 — the import runs natively
  const runRes = await page.evaluate(async (id) => {
    const r = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
    return r.status;
  }, importJob.id);
  must(runRes === 200, `the import run fires through the same-origin door (got ${runRes})`);
  let importDone = false;
  for (let i = 0; i < 30 && !importDone; i++) {
    await sleep(1000);
    const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
    importDone = jobs.find((j) => j.id === importJob.id)?.status === "completed";
  }
  must(importDone, "the import completes natively");

  // C3 — the identity card's show-in-parent door
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator(`[data-job="${importJob.id}"]`).first().click({ force: true });
  await sleep(1500); // completed mapimport opens on Results by default
  const identityCard = page.locator('[data-canvas-ui="map-identity"]');
  must(await identityCard.isVisible().catch(() => false), "the mapimport's Results shows the identity card");

  const parentBtn = identityCard.locator('[data-testid="map-card-show-parent"]');
  let parentBtnSeen = false;
  try {
    await parentBtn.waitFor({ state: "visible", timeout: 12_000 });
    parentBtnSeen = true;
  } catch { /* below */ }
  must(parentBtnSeen, "the Show in parent door appears once the parent resolves (edges + geometry)");

  // the PLAIN door first: View in 3D opens the crop UNCLIPPED
  const dialogsBefore = await page.locator('[role="dialog"]').count();
  await identityCard.locator('[data-testid="map-card-view-3d"]').click();
  await sleep(800);
  const dlgPlain = page.locator('[role="dialog"]').last();
  let plainCanvas = false;
  try {
    await dlgPlain.locator("canvas").first().waitFor({ state: "visible", timeout: 20_000 });
    plainCanvas = true;
  } catch { /* below */ }
  must(plainCanvas, "the plain View in 3D still opens the crop in Mol*");
  must(
    !(await dlgPlain.locator('[data-testid="clip-box-readout"]').isVisible().catch(() => false)),
    "a plain open stays untouched — no anchored readout, no clip"
  );
  await page.keyboard.press("Escape");
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) === dialogsBefore,
    "Esc closes the plain dialog"
  );

  // NOW the new door: the parent map, clipped to the crop's box
  await parentBtn.click();
  await sleep(1200);
  must(
    (await page.locator('[role="dialog"]').count()) > dialogsBefore,
    "clicking Show in parent opens the Mol* dialog"
  );
  const dlg = page.locator('[role="dialog"]').last();
  const dlgText = ((await dlg.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    dlgText.includes("orthovol.mrc"),
    `the dialog names the PARENT map ("${dlgText.slice(0, 110)}")`
  );
  let canvasSeen = false;
  try {
    await dlg.locator("canvas").first().waitFor({ state: "visible", timeout: 20_000 });
    canvasSeen = true;
  } catch { /* below */ }
  must(canvasSeen, "the Mol* canvas mounts on the parent map");
  await sleep(3000); // volume load + the anchored box applying

  // the honest readout: the box's own numbers, in the clip's violet
  const readout = dlg.locator('[data-testid="clip-box-readout"]');
  let readoutSeen = false;
  try {
    await readout.waitFor({ state: "visible", timeout: 20_000 });
    readoutSeen = true;
  } catch { /* below */ }
  must(readoutSeen, "the anchored-box readout replaces the sliders");
  const readoutText = ((await readout.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(readoutText.includes("anchored to the crop"), "the readout says WHAT it is");
  must(readoutText.includes("25–75% kept"), `X speaks its two-sided cut ("${readoutText.slice(0, 140)}")`);
  must(readoutText.includes("full extent"), "Y speaks its uncut truth");
  must(
    (readoutText.match(/25–50% kept/g) ?? []).length >= 1,
    "Z speaks its two-sided cut"
  );
  must(
    !(await dlg.locator('button[aria-label^="Clip position along"]').first().isVisible().catch(() => false)),
    "the sliders stand down while the box owns the geometry"
  );
  // the export label = the crop's own dims (32×64×16) — labels never lie.
  // Read the dialog text NOW (after the readout is up): captured earlier it
  // raced the volume load and showed the "…" placeholder (run-3 flake).
  const dlgTextNow = ((await dlg.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    dlgTextNow.includes("32×64×16 vox"),
    "the export label re-states the crop's dims (re-export = the same crop, byte for byte)"
  );

  // the 2D tiles echo the box (t253's third echo carries it) — expand the strip
  await dlg.locator('button:has-text("Orthogonal slices")').first().click().catch(() => {});
  await sleep(1200);
  const keptOutlines = await dlg.locator('[aria-label^="Clip keeps"]').count();
  must(keptOutlines >= 1, `the ortho tiles draw the kept region (${keptOutlines} tiles speaking)`);

  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, "t260-show-in-parent-2x.png") });
  console.log("  (shot) t260-show-in-parent-2x.png");

  // GL truth — the anchored box must actually CUT the scene: with the box
  // [X 25–75, Z 25–50] the canvas carries a fraction of the full map; after
  // release the full map returns and the content count jumps back up. If
  // the GL clip ever goes inert again (the t253-era disease: every state
  // layer spoke while the scene ignored frac), these two numbers converge
  // and this assertion burns.
  await sleep(1500); // the surface settles under the planes
  const boxedCount = await canvasContent();
  await dlg.locator('[data-testid="clip-box-release"]').click();
  await sleep(2000); // the full isosurface rebuilds
  const releasedCount = await canvasContent();
  must(
    boxedCount != null && releasedCount != null && releasedCount > boxedCount * 1.15,
    `the scene REALLY obeys the box — release grows the canvas ${boxedCount} → ${releasedCount} px (an inert clip converges to 1.0; this box holds the main blob's lower half, so ~1.3× IS the honest magnitude)`
  );
  must(
    !(await dlg.locator('[data-testid="clip-box-readout"]').isVisible().catch(() => false)),
    "release dissolves the box — the readout goes with it"
  );
  await page.keyboard.press("Escape");
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) === dialogsBefore,
    "Esc closes the parent dialog"
  );
  const parkedAria = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  must(
    parkedAria === "Maps and images",
    `focus parks on the Maps gallery (got "${parkedAria}")`
  );

  // C4 — the probe refine3d, seeded the qa60 way (RELION is not installed;
  // the record IS the truth)
  const stAfter = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
  const refPath = stAfter[importJob.id]?.outputs?.model_mrc;
  const mkRes = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "refine3d",
      name: "QA RefProbe t260",
      x: host.x + 240, y: host.y + 60,
      workspaceId: host.workspaceId ?? undefined,
    }),
  });
  must(mkRes.status === 200 || mkRes.status === 201, `the probe refine3d is created (got ${mkRes.status})`);
  const probeBody = await mkRes.json();
  const probe = probeBody.job ?? probeBody;
  created.push(probe.id);

  const probeWd = `/home/z/my-project/data/relion/${probe.projectId}/refine3d_t260probe`;
  mkdirSync(probeWd, { recursive: true });
  {
    const st = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
    st[probe.id] = {
      jobId: probe.id,
      projectId: probe.projectId,
      type: "refine3d",
      pid: null,
      cmd: `mpirun -n 3 relion_refine_mpi --i particles.star --ref ${refPath} --ini_high 30 --sym C1 --o run`,
      workdir: probeWd,
      logFile: path.join(probeWd, "run.out"),
      errFile: path.join(probeWd, "run.err"),
      startedAt: new Date().toISOString(),
      outputs: {},
      done: true,
      exitCode: 0,
    };
    writeFileSync("data/engine-state.json", JSON.stringify(st, null, 2));
  }
  execSync(
    `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:process.argv[1]},data:{status:'completed',progress:100}}).then(()=>{console.log('flipped');return p.\\$disconnect();}).catch(e=>{console.error(e.message);process.exit(1);});" ${probe.id}`,
    { cwd: "/home/z/my-project", stdio: "pipe" }
  );
  const edgeRes = await fetch(`${BASE}/api/edges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromJobId: importJob.id,
      toJobId: probe.id,
      fromPort: "model_mrc",
      toPort: "reference",
    }),
  });
  must(edgeRes.status === 200 || edgeRes.status === 201, `the reference edge is wired (got ${edgeRes.status})`);

  // C5 — the reference card's show-in-parent door (consumer side)
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator(`[data-job="${probe.id}"]`).first().click({ force: true });
  await sleep(1000);
  await page.locator('[role="tab"]', { hasText: "Overview" }).click().catch(() => {});
  await sleep(1500);
  const refCard = page.locator('[data-canvas-ui="reference-map"]');
  must(await refCard.isVisible().catch(() => false), "the probe's Overview shows the Reference map card");
  const refParentBtn = refCard.locator('[data-testid="reference-show-parent"]');
  let refParentSeen = false;
  try {
    await refParentBtn.waitFor({ state: "visible", timeout: 15_000 });
    refParentSeen = true;
  } catch { /* below */ }
  must(refParentSeen, "the reference card's Show in parent door resolves through the provider's edges");

  const dialogsBefore2 = await page.locator('[role="dialog"]').count();
  await refParentBtn.click();
  await sleep(1200);
  must(
    (await page.locator('[role="dialog"]').count()) > dialogsBefore2,
    "clicking the reference card's door opens ITS Mol* dialog"
  );
  const dlg2 = page.locator('[role="dialog"]').last();
  const dlg2Text = ((await dlg2.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(
    dlg2Text.includes("orthovol.mrc"),
    `the consumer-side dialog ALSO names the parent map ("${dlg2Text.slice(0, 110)}")`
  );
  let canvasSeen2 = false;
  try {
    await dlg2.locator("canvas").first().waitFor({ state: "visible", timeout: 20_000 });
    canvasSeen2 = true;
  } catch { /* below */ }
  must(canvasSeen2, "the consumer-side Mol* canvas mounts");
  if (canvasSeen2) {
    // the box anchors when the volume finishes loading — the canvas mounts
    // EARLIER (plugin UI first), so a fixed sleep races the load; wait for
    // the readout itself
    const readout2 = dlg2.locator('[data-testid="clip-box-readout"]');
    let readout2Seen = false;
    try {
      await readout2.waitFor({ state: "visible", timeout: 20_000 });
      readout2Seen = true;
    } catch { /* below */ }
    must(
      readout2Seen &&
        ((await readout2.innerText().catch(() => "")) ?? "").includes("25–75% kept"),
      "the same anchored box, the same readout — one geometry, both cards"
    );
    await page.screenshot({ path: path.join(SHOTS, "t260-reference-show-parent-2x.png") });
    console.log("  (shot) t260-reference-show-parent-2x.png");
  }
  await page.keyboard.press("Escape");
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) === dialogsBefore2,
    "Esc closes the consumer-side dialog"
  );
  const parked2 = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute("aria-label") ?? "";
  });
  must(
    parked2 === "Reference map",
    `focus parks on the reference card (got "${parked2}")`
  );
} finally {
  // ---- cleanup: probes die, crops sweep, roster returns to 21 -------------
  console.log("== cleanup ==");
  for (const id of created.reverse()) {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" });
  }
  if (hostWd) {
    const sub = path.join(hostWd, "SubVolumes");
    try {
      if (existsSync(sub)) {
        for (const f of execSync(`ls ${sub}`).toString().split("\n").filter((n) => n.includes("_crop_"))) {
          rmSync(path.join(sub, f), { force: true });
        }
      }
    } catch { /* best effort */ }
  }
  rmSync(TMP, { recursive: true, force: true });
  const after = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  must(after.length === 21, `roster restored to 21 (got ${after.length})`);
}

// ---- Phase D: console clean ----------------------------------------------
console.log("== PHASE D: console ==");
must(consoleErrors.length === 0, `no real console errors (got ${consoleErrors.length}: ${consoleErrors[0] ?? ""})`);

await browser.close();
console.log(fail === 0 ? "\nt260: ALL PASS" : `\nt260: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
