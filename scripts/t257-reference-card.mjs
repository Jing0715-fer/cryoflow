// t257 — the reference wears its face (Task 257).
// t256 gave the Import Map's Results view an identity card; t257 gives the
// CONSUMER side the same story: a class3d/refine3d job's Overview shows a
// Reference map card — WHAT the reference is (grid, voxel spacing, density
// stats, sub-volume anchor) and WHERE it came from (a crop sent from the
// 3D viewer / a standalone import / an upstream model job), read from the
// PROVIDER's own outputs listing (the t256 data plane, zero new I/O).
//
//   card: src/components/workflow/reference-map-card.tsx
//   gate: job.type ∈ {class3d, refine3d} AND data.inputs carries --ref
//   resolve: edges with volume-ish into ports → fetch each provider's
//   outputs → exact path match (workdir + file.path) → basename fallback
//
// Phases:
//   A  demo truth — homepage 200, roster 21, the orthovol host on disk
//   B  the ledger — the card file, its gate, its resolution strategy, the
//      provenance branches, the honest unresolved line, the inspector
//      wiring, the shared t256 helpers — all asserted at source
//   C  the live loop — a REAL crop is sent from the host map into an
//      Import Map (the t255 route), the import runs natively (model_mrc
//      declared), a probe refine3d is seeded the qa60 way (RELION is not
//      installed here — the record, not a binary, is the truth), the
//      edge is wired, and the page shows the card: identity, anchor,
//      provenance, and the chip that opens the provider — then cleanup
//      restores roster 21 and sweeps the crop
//   D  console clean
//
// Run: node scripts/t257-reference-card.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const TMP = "/home/z/my-project/scripts/tmp-t257";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// ---- self-healing preconditions (t255/t256 doctrine: a crashed
// predecessor's leftovers are assertion poison — sweep them first) ------
const pre = await (await fetch(`${BASE}/api/jobs`)).json();
const preJobs = pre.jobs ?? [];
for (const j of preJobs.filter((x) => x.type === "mapimport" || x.name.startsWith("QA RefProbe"))) {
  await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" });
  console.log(`  (self-heal) removed leftover probe "${j.name}"`);
}
// sweep t257-era probe crops from the host's SubVolumes
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
// engine-state.json maps job id → record at the TOP level (no .jobs wrapper)
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

  const cardSrc = src("src/components/workflow/reference-map-card.tsx");
  must(cardSrc.includes('data-canvas-ui="reference-map"'), "the card carries its UI test hook");
  must(cardSrc.includes("if (!refPath) return null;"), "the card self-hides without a --ref input");
  must(
    cardSrc.includes('REF_PORTS = new Set(["model_mrc", "model", "map"])'),
    "candidate providers arrive through volume-ish output ports only"
  );
  must(
    cardSrc.includes("joinPath(wd, f.path) === refPath"),
    "resolution matches the provider listing by EXACT path"
  );
  must(
    cardSrc.includes("f.name === baseName(refPath!)"),
    "fallback matches a relocated copy by basename + map identity"
  );
  must(
    cardSrc.includes('data-testid="reference-provider-chip"') &&
      cardSrc.includes(".inspect(provider.id)"),
    "the provider chip opens the provider job in the inspector"
  );
  must(
    cardSrc.includes("sent from the 3D viewer") &&
      cardSrc.includes("picked from the file browser") &&
      cardSrc.includes("produced by the"),
    "provenance speaks all three sources (crop / standalone / model job)"
  );
  must(cardSrc.includes("Sub-volume anchor at"), "the anchor line names where the crop sits");
  must(
    cardSrc.includes("identity unresolved"),
    "the unresolved state is honest about a missing provider listing"
  );
  must(
    cardSrc.includes('from "./results/results-view"'),
    "the card imports the shared t256 helpers (one source, both cards agree)"
  );

  const resultsSrc = src("src/components/workflow/results/results-view.tsx");
  must(
    resultsSrc.includes("export function formatStat") &&
      resultsSrc.includes("export function mapSourceNote"),
    "formatStat + mapSourceNote are exported from the t256 view"
  );

  const inspSrc = src("src/components/workflow/job-inspector.tsx");
  must(
    inspSrc.includes('import { ReferenceMapCard } from "./reference-map-card";'),
    "the inspector mounts the reference card"
  );
  must(
    inspSrc.includes("/^(class3d|refine3d)$/i.test(job.type)") &&
      inspSrc.includes('i.flag === "--ref"'),
    "the card is gated to class3d/refine3d and fed the --ref path from the outputs route"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (crop → import → probe refine3d) ==");

  // C1 — a REAL crop via the t255 send route (node-level POST is safe here:
  // the JSON-body ledger class needs no door — urlencoded dies at json()).
  const sendRes = await fetch(`${BASE}/api/jobs/${host.id}/outputs/subvolume-job`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "orthovol.mrc",
      x0: 0.25, x1: 0.75, y0: 0.25, y1: 0.75, z0: 0.25, z1: 0.75,
    }),
  });
  must(sendRes.status === 201, `the send route materializes the crop (got ${sendRes.status})`);
  const sent = await sendRes.json();
  const importJob = sent.job;
  const cropAbs = path.join(hostWd, "SubVolumes", sent.crop.name);
  created.push(importJob.id);
  must(!!importJob?.id && importJob.type === "mapimport", "the Import Map citizen was created");
  must(sent.crop.dims?.join("×") === "32×32×32", `crop dims 32×32×32 (got ${sent.crop.dims?.join("×")})`);
  must(sent.crop.origin.join(",") === "16,16,16", `crop origin is non-zero (got ${sent.crop.origin.join(",")})`);
  must(existsSync(cropAbs), "the crop lives in the parent's SubVolumes folder");

  // C2 — the import runs natively (mapPath param, no RELION binary needed)
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
  const stAfter = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
  const refPath = stAfter[importJob.id]?.outputs?.model_mrc;
  must(!!refPath && existsSync(refPath), `the import declares model_mrc → ${path.basename(refPath ?? "")}`);

  // C3 — the probe refine3d, seeded the qa60 way (RELION is not installed
  // here; the record IS the truth — the app's own fixtures do the same)
  const mkRes = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "refine3d",
      name: "QA RefProbe t257",
      x: host.x + 240, y: host.y + 60,
      workspaceId: host.workspaceId ?? undefined,
    }),
  });
  must(mkRes.status === 200 || mkRes.status === 201, `the probe refine3d is created (got ${mkRes.status})`);
  const probeBody = await mkRes.json();
  const probe = probeBody.job ?? probeBody;
  created.push(probe.id);
  must(!!probe?.id, "the probe has an id");

  const probeWd = `/home/z/my-project/data/relion/${probe.projectId}/refine3d_t257probe`;
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

  // C4 — the page tells the story: open the probe's inspector, switch to
  // Overview (completed jobs open on Results by default — job-inspector
  // line ~2217), and read the card
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator(`[data-job="${probe.id}"]`).first().click({ force: true });
  await sleep(1000);
  const overviewTab = page.locator('[role="tab"]', { hasText: "Overview" });
  await overviewTab.click().catch(() => {});
  await sleep(1200);
  const card = page.locator('[data-canvas-ui="reference-map"]');
  const opened = await card.isVisible().catch(() => false);
  must(opened, "the probe's inspector shows the Reference map card");
  if (opened) {
    const cardText = ((await card.innerText()) ?? "").replace(/\s+/g, " ");
    must(cardText.includes("Reference map"), "the card names itself");
    must(cardText.includes("orthovol_crop"), `the card names the crop file ("${cardText.slice(0, 80)}")`);
    must(cardText.includes("32 × 32 × 32 vox"), "the card speaks the grid");
    must(cardText.includes("Å / voxel"), "the card speaks the voxel spacing");
    must(cardText.includes("(16, 16, 16)"), "the card speaks the sub-volume anchor");
    must(cardText.includes(`crop of ${path.basename(hostWd)}`), "the card names the parent job");
    must(cardText.includes("sent from the 3D viewer"), "the card tells the crop's provenance");

    // the chip opens the provider
    await card.locator('[data-testid="reference-provider-chip"]').click();
    await sleep(1000);
    const openedName = await page
      .locator('[role="dialog"] h2[title]')
      .first()
      .getAttribute("title");
    must(
      openedName === importJob.name || (openedName ?? "").toLowerCase().includes("import"),
      `the chip opens the provider (got "${openedName}")`
    );

    // the t256 identity card still lives on the provider's Results view
    const resultsTab = page.locator('[role="tab"]', { hasText: "Results" });
    if (await resultsTab.isVisible().catch(() => false)) {
      await resultsTab.click();
      await sleep(1500);
      must(
        await page.locator('[data-canvas-ui="map-identity"]').isVisible().catch(() => false),
        "the provider's own t256 identity card still renders beside the story"
      );
    }
  }

  // C5 — the honest self-hide: a fixture class3d with no --ref shows nothing
  const cls = ((await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? []).find(
    (j) => j.type === "class3d" && j.name === "QA Class3D"
  );
  if (cls) {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await sleep(2500);
    await page.locator(`[data-job="${cls.id}"]`).first().click({ force: true });
    await sleep(1000);
    await page.locator('[role="tab"]', { hasText: "Overview" }).click().catch(() => {});
    await sleep(1200);
    must(
      (await page.locator('[data-canvas-ui="reference-map"]').count()) === 0,
      "a job without a --ref input shows no card (honest absence)"
    );
  }
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
console.log(fail === 0 ? "\nt257: ALL PASS" : `\nt257: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
