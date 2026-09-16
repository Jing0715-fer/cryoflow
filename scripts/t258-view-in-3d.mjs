// t258 — the way back is one click (Task 258).
// t254→t257 built the box-subregion chain: crop → import → identity card
// (t256) → consumer's reference card (t257). But every card was a STORY —
// to actually LOOK at the map you detoured through gallery tile → image
// dialog → "View in 3D" (three hops on the provider side), or chip →
// inspector → Results → gallery → image dialog → 3D (worse on the
// consumer side). t258 puts a "View in 3D" button ON each card:
//   - MapIdentityCard (t256): aims the results-view's shared Mol* dialog
//     at its own map file (onView3D → setMolFile),
//   - ReferenceMapCard (t257): mounts its OWN MolViewer on the provider's
//     job object (resolved.file.path is provider-workdir-relative — the
//     exact contract MolViewer speaks) and opens it on click.
// Focus parks honestly on both paths: the shared dialog returns to the
// Maps gallery section, the card's own dialog returns to the card.
//
// Phases:
//   A  demo truth — homepage 200, roster 21, the orthovol host on disk
//   B  the ledger — both buttons, both wiring strategies, the mount-time
//      pre-warm comment, the focus-park targets — asserted at source
//   C  the live loop — REAL crop → Import Map runs natively → the t256
//      card's button opens Mol* on the crop (canvas alive, Esc closes,
//      focus lands on the gallery) → probe refine3d seeded the qa60 way →
//      the t257 card's button opens Mol* on the SAME map from the OTHER
//      side (provider job object), Esc closes, focus lands on the card
//   D  console clean
//
// Run: node scripts/t258-view-in-3d.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const TMP = "/home/z/my-project/scripts/tmp-t258";
const SHOTS = "/home/z/my-project/shots-qa";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// ---- self-healing preconditions (t255/t256/t257 doctrine: sweep the
// previous run's leftovers BEFORE they poison assertions) -----------------
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

  const resultsSrc = src("src/components/workflow/results/results-view.tsx");
  must(
    resultsSrc.includes("onView3D?: (f: OutputFile) => void;"),
    "the t256 identity card takes an onView3D callback"
  );
  must(
    resultsSrc.includes('<MapIdentityCard job={job} file={mrcFiles[0]} onView3D={setMolFile} />'),
    "the wiring aims the SHARED Mol* dialog at the card's map (one instance, two triggers)"
  );
  must(
    resultsSrc.includes('data-testid="map-card-view-3d"'),
    "the identity card's button carries its test hook"
  );
  must(
    resultsSrc.includes("onClick={() => onView3D(file)}"),
    "the identity card's button passes ITS OWN file (the map, not a neighbor's)"
  );

  const cardSrc = src("src/components/workflow/reference-map-card.tsx");
  must(
    cardSrc.includes('data-testid="reference-view-3d"'),
    "the reference card's button carries its test hook"
  );
  must(
    cardSrc.includes('import { MolViewer } from "./results/mol-viewer";'),
    "the reference card mounts the real MolViewer dialog"
  );
  must(
    cardSrc.includes("viewable = Boolean(provider && resolved && map && dims)"),
    "the button gates on a RESOLVED, viewable map (no story, no button)"
  );
  must(
    cardSrc.includes("job={provider}") && cardSrc.includes("path={resolved.file.path}"),
    "the card's dialog opens the PROVIDER's job + the provider-relative path"
  );
  must(
    cardSrc.includes("restoreFocusRef={cardRef}"),
    "the card's dialog parks focus back on the card itself"
  );
  must(
    cardSrc.includes("const [viewOpen, setViewOpen] = React.useState(false);"),
    "the card owns its dialog state"
  );
  must(
    cardSrc.includes("pre-warm compiles the molstar chunk"),
    "the mount-time pre-warm is documented (compile while reading, not while waiting)"
  );

  // ---- Phase C: the live loop ---------------------------------------------
  console.log("== PHASE C: the live loop (crop → import → both buttons) ==");

  // C1 — a REAL crop via the t255 send route (JSON-body ledger class needs
  // no door; urlencoded dies at json())
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
  created.push(importJob.id);
  must(!!importJob?.id && importJob.type === "mapimport", "the Import Map citizen was created");

  // C2 — the import runs natively (page-level fetch: the same-origin door)
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

  // C3 — the t256 card's button: identity card → Mol* on the crop
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator(`[data-job="${importJob.id}"]`).first().click({ force: true });
  await sleep(1500); // completed mapimport opens on Results by default
  const identityCard = page.locator('[data-canvas-ui="map-identity"]');
  must(await identityCard.isVisible().catch(() => false), "the mapimport's Results shows the identity card");
  const viewBtn = identityCard.locator('[data-testid="map-card-view-3d"]');
  must(await viewBtn.isVisible().catch(() => false), "the identity card's View in 3D button is there");
  must(
    ((await identityCard.innerText()) ?? "").includes("open this map in the Mol* viewer"),
    "the button speaks its intent in plain words"
  );

  const dialogsBefore = await page.locator('[role="dialog"]').count();
  await viewBtn.click();
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) > dialogsBefore,
    "clicking the card's button opens the Mol* dialog"
  );
  // the MolViewer dialog portals AFTER the inspector's own dialog — the
  // first [role=dialog] in DOM order is the INSPECTOR, not the viewer
  const dlg = page.locator('[role="dialog"]').last();
  const dlgText = ((await dlg.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(dlgText.includes(sent.crop.name), `the dialog names the crop ("${dlgText.slice(0, 90)}")`);
  // the molstar canvas comes alive (WebGL mount, like t253/t254's viewer)
  let canvasSeen = false;
  try {
    await dlg.locator("canvas").first().waitFor({ state: "visible", timeout: 20_000 });
    canvasSeen = true;
  } catch { /* below */ }
  must(canvasSeen, "the Mol* canvas mounts inside the dialog");
  if (canvasSeen) {
    await sleep(2500); // give the isosurface a beat to draw
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "t258-map-card-view3d-2x.png") });
    console.log("  (shot) t258-map-card-view3d-2x.png");
  }
  // Esc closes — the t252 write-gate lesson in reverse: the door closes too
  await page.keyboard.press("Escape");
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) === dialogsBefore,
    "Esc closes the dialog"
  );
  // focus parks on the Maps gallery section (the shared dialog's home)
  const parkedAria = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  must(
    parkedAria === "Maps and images",
    `focus parks on the Maps gallery (got "${parkedAria}")`
  );

  // C4 — the probe refine3d, seeded the qa60 way (RELION is not installed;
  // the record IS the truth)
  const mkRes = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "refine3d",
      name: "QA RefProbe t258",
      x: host.x + 240, y: host.y + 60,
      workspaceId: host.workspaceId ?? undefined,
    }),
  });
  must(mkRes.status === 200 || mkRes.status === 201, `the probe refine3d is created (got ${mkRes.status})`);
  const probeBody = await mkRes.json();
  const probe = probeBody.job ?? probeBody;
  created.push(probe.id);

  const probeWd = `/home/z/my-project/data/relion/${probe.projectId}/refine3d_t258probe`;
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

  // C5 — the t257 card's button: reference card → Mol* on the SAME map
  // from the CONSUMER side (provider job object, provider-relative path)
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await page.locator(`[data-job="${probe.id}"]`).first().click({ force: true });
  await sleep(1000);
  await page.locator('[role="tab"]', { hasText: "Overview" }).click().catch(() => {});
  await sleep(1500);
  const refCard = page.locator('[data-canvas-ui="reference-map"]');
  must(await refCard.isVisible().catch(() => false), "the probe's Overview shows the Reference map card");
  const refBtn = refCard.locator('[data-testid="reference-view-3d"]');
  must(await refBtn.isVisible().catch(() => false), "the reference card's View in 3D button is there");

  const dialogsBefore2 = await page.locator('[role="dialog"]').count();
  await refBtn.click();
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) > dialogsBefore2,
    "clicking the reference card's button opens ITS Mol* dialog"
  );
  const dlg2 = page.locator('[role="dialog"]').last();
  const dlg2Text = ((await dlg2.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
  must(dlg2Text.includes("orthovol_crop"), `the consumer-side dialog names the same crop ("${dlg2Text.slice(0, 90)}")`);
  let canvasSeen2 = false;
  try {
    await dlg2.locator("canvas").first().waitFor({ state: "visible", timeout: 20_000 });
    canvasSeen2 = true;
  } catch { /* below */ }
  must(canvasSeen2, "the consumer-side Mol* canvas mounts");
  if (canvasSeen2) {
    await sleep(2500);
    await page.screenshot({ path: path.join(SHOTS, "t258-reference-view3d-2x.png") });
    console.log("  (shot) t258-reference-view3d-2x.png");
  }
  await page.keyboard.press("Escape");
  await sleep(800);
  must(
    (await page.locator('[role="dialog"]').count()) === dialogsBefore2,
    "Esc closes the consumer-side dialog"
  );
  // focus parks on the card itself (cardRef, tabIndex=-1)
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
console.log(fail === 0 ? "\nt258: ALL PASS" : `\nt258: ${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
