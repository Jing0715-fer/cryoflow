/* t180 — every door that lands edges in the world carries THE one cycle
 * rule (the consistency round).
 *
 * The canvas prevents interactive cycles and POST /api/edges rejects them
 * ("Would create a cycle") — but the BATCH doors each skipped the check:
 *   POST /api/workflow-import   (a hand-edited JSON could land a cycle)
 *   POST /api/custom-template   (save accepts a client payload)
 *   PUT  /api/custom-template   (apply re-creates whatever the shelf holds)
 * A cycle in a processing pipeline is meaningless (A → B → A: neither job
 * can ever run), so the fix is rejection with the cycle NAMED, via one
 * shared pure detector (src/lib/graph-cycle.ts) — the shellJoin doctrine
 * applied to graph integrity. The workflow-io client parser pre-validates
 * too (instant feedback, no round-trip); pipeline-template's
 * TEMPLATE_EDGES stays trusted (ship-curated constant, acyclic by
 * construction — no dead branches on trusted data, verdict commented).
 *
 * Also closes Task 179's handoff correction: "cycle appendix 分支零覆盖
 * （无世界能踩到）" was WRONG — the import door could reach it. With all
 * doors guarded the appendix becomes provably-unreachable defense.
 *
 * Assertions: S baseline · X source oracles (comment-stripped where the
 * contract is behavioral) · B live API (cyclic import 400 naming the
 * cycle / diamond control passes / self-loop rule intact / edges API
 * still rejects / template save + apply both guarded, cleanup symmetric)
 * · M/D the client pre-validation face (toast, dialog stays closed, and
 * the no-false-positive control: a valid file still opens the dialog) ·
 * Z roster identity + read-only proof.
 */
import { chromium } from "playwright";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");

let pass = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}
function section(name) {
  console.log(`== ${name} ==`);
}

const browser = await chromium.launch();
const consoleErrors = [];
const failedUrls = [];
function trackConsole(pageRef, label) {
  pageRef.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ label, text: msg.text() });
  });
  pageRef.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push({ label, url: res.url(), status: res.status() });
  });
}

/* ================= S — baseline ================= */
section("S: baseline world");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
const roster0 = jobs0.map((j) => ({ id: j.id, name: j.name }));
must(roster0.length === 26, `S1 roster 26 jobs (${roster0.length})`);
const projectId = jobs0[0]?.projectId ?? "";
must(!!projectId, "S2 projectId resolvable");
const projDir = path.resolve("data/relion", projectId);
const listingBefore = readdirSync(projDir).sort().join("|");
must(readdirSync(projDir).length > 0, "S3 project dir witness readable");

try {
  const detectorSrc = src("src/lib/graph-cycle.ts");
  const ioSrc = src("src/lib/workflow-io.ts");
  const importRouteSrc = src("src/app/api/workflow-import/route.ts");
  const templateIoSrc = src("src/lib/template-io.ts");
  const customRouteSrc = src("src/app/api/custom-template/route.ts");
  const edgesRouteSrc = src("src/app/api/edges/route.ts");
  const pipelineRouteSrc = src("src/app/api/pipeline-template/route.ts");

  /* ================= X — source oracles ================= */
  section("X: source oracles");
  const has = (s, needle) => s.includes(needle);
  must(has(detectorSrc, "export function findCycle") &&
       has(detectorSrc, "export function formatCyclePath"),
    "X1 the shared detector exports findCycle + formatCyclePath");
  must(has(detectorSrc, "IN_STACK") && has(detectorSrc, "UNSEEN") && has(detectorSrc, "DONE"),
    "X2 the detector is a colored DFS (GRAY/BLACK bookkeeping present)");
  must(has(ioSrc, 'import { findCycle, formatCyclePath } from "./graph-cycle"') &&
       has(ioSrc, "Edges form a cycle:"),
    "X3 the client parser pre-validates cycles (one import, one error dialect)");
  must(has(importRouteSrc, 'import { findCycle, formatCyclePath } from "@/lib/graph-cycle"') &&
       has(importRouteSrc, "findCycle("),
    "X4 the import door carries the shared detector");
  must(has(importRouteSrc, "self-links are not allowed"),
    "X5 the self-loop rule is intact (cycle guard sits BESIDE it, not on it)");
  must(has(templateIoSrc, "export function templateCycleError") &&
       /templateCycleError\(\{ jobs, edges \}\)/.test(templateIoSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")),
    "X6 validateTemplatePayload CALLS templateCycleError (save guarded by composition)");
  must(has(templateIoSrc, "payload.edges ?? []"),
    "X7 the detector tolerates pre-guard rows without edges (apply re-parses raw JSON)");
  const putCode = customRouteSrc.slice(customRouteSrc.indexOf("export async function PUT"));
  must(has(putCode, "templateCycleError(payload)") && has(putCode, 'status: 400'),
    "X8 apply re-checks cycles (stored rows predate the save guard)");
  must(has(edgesRouteSrc, "findCycle([...nodes], pairs)") &&
       !has(edgesRouteSrc, "const stack = [to];") &&
       !has(edgesRouteSrc, "const visited = new Set<string>();"),
    "X9 the edges API delegates to the shared detector (local DFS retired)");
  must(has(pipelineRouteSrc, "Cycle-audit verdict (Task 180)"),
    "X10 pipeline-template carries its audit verdict (trusted constant, unguarded on purpose)");

  /* ================= B — live API contract ================= */
  section("B: live doors");
  const post = async (p, body) => {
    const r = await fetch(BASE + p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await r.json(); } catch { /* non-JSON */ }
    return { status: r.status, body: data };
  };
  const del = async (p) => {
    const r = await fetch(BASE + p, { method: "DELETE" });
    let data = null;
    try { data = await r.json(); } catch { /* non-JSON */ }
    return { status: r.status, body: data };
  };
  const roster = async () => {
    const b = await (await fetch(BASE + "/api/jobs")).json();
    const l = Array.isArray(b) ? b : b.jobs ?? [];
    return l;
  };

    // ---- door 1: workflow-import ----
  const cyclicBatch = {
    jobs: [
      { type: "motioncorr", name: "MC Alpha", x: 100, y: 100, params: {} },
      { type: "motioncorr", name: "MC Beta", x: 340, y: 100, params: {} },
    ],
    edges: [
      { from: 0, to: 1, fromPort: "micrographs", toPort: "movies" },
      { from: 1, to: 0, fromPort: "micrographs", toPort: "movies" },
    ],
  };
  const cyc = await post("/api/workflow-import", cyclicBatch);
  must(cyc.status === 400, `B1 cyclic import rejected (${cyc.status})`);
  must(typeof cyc.body?.error === "string" &&
       cyc.body.error.startsWith("Edges form a cycle:") &&
       cyc.body.error.includes("MC Alpha → MC Beta → MC Alpha"),
    `B2 the 400 NAMES the cycle ("${cyc.body?.error ?? "none"}")`);
  must((await roster()).length === 26, "B3 the rejected batch landed nothing (roster 26)");

  // control: the diamond (0→1, 0→2, 1→3, 2→3) is acyclic — the guard must
  // NOT over-reject shared-shape graphs
  const diamond = {
    jobs: [
      { type: "motioncorr", name: "MC D0", x: 100, y: 400, params: {} },
      { type: "motioncorr", name: "MC D1", x: 340, y: 320, params: {} },
      { type: "motioncorr", name: "MC D2", x: 340, y: 480, params: {} },
      { type: "motioncorr", name: "MC D3", x: 580, y: 400, params: {} },
    ],
    edges: [
      { from: 0, to: 1, fromPort: "micrographs", toPort: "movies" },
      { from: 0, to: 2, fromPort: "micrographs", toPort: "movies" },
      { from: 1, to: 3, fromPort: "micrographs", toPort: "movies" },
      { from: 2, to: 3, fromPort: "micrographs", toPort: "movies" },
    ],
  };
  const dia = await post("/api/workflow-import", diamond);
  const diaJobs = (dia.body?.jobs ?? []).map((j) => j.id);
  must(dia.status === 201 && diaJobs.length === 4,
    `B4 diamond control imports (${dia.status}, ${diaJobs.length} jobs)`);
  must((dia.body?.edges ?? []).length === 4, "B5 all four diamond edges wired");
  for (const id of diaJobs) await del(`/api/jobs/${id}`);
  must((await roster()).length === 26, "B6 diamond cleanup restores the roster");

  // self-loop: the pre-existing rule keeps its own message
  const selfLoop = await post("/api/workflow-import", {
    jobs: [{ type: "motioncorr", name: "MC S", x: 100, y: 700, params: {} }],
    edges: [{ from: 0, to: 0, fromPort: "micrographs", toPort: "movies" }],
  });
  must(selfLoop.status === 400 && /self-links/i.test(selfLoop.body?.error ?? ""),
    `B7 self-loop keeps its own rule ("${selfLoop.body?.error ?? "none"}")`);

  // ---- door 2: the edges API (migrated detector, live behavior) ----
  const mkA = await post("/api/jobs", { type: "motioncorr", x: 100, y: 900 });
  const mkB = await post("/api/jobs", { type: "motioncorr", x: 340, y: 900 });
  const idA = mkA.body?.job?.id ?? mkA.body?.id;
  const idB = mkB.body?.job?.id ?? mkB.body?.id;
  must(!!idA && !!idB, "B8 two scratch jobs created for the edge test");
  const e1 = await post("/api/edges", {
    fromJobId: idA, toJobId: idB, fromPort: "micrographs", toPort: "movies",
  });
  must(e1.status === 200 || e1.status === 201, `B9 forward edge accepted (${e1.status})`);
  const e2 = await post("/api/edges", {
    fromJobId: idB, toJobId: idA, fromPort: "micrographs", toPort: "movies",
  });
  must(e2.status === 400 && /Would create a cycle/.test(e2.body?.error ?? ""),
    `B10 reverse edge rejected via the SHARED detector ("${e2.body?.error ?? "none"}")`);
  await del(`/api/jobs/${idA}`);
  await del(`/api/jobs/${idB}`);
  must((await roster()).length === 26, "B11 edge-test cleanup restores the roster");

  // ---- door 3: the template shelf (save + apply) ----
  const cycTemplate = await post("/api/custom-template", {
    name: "t180 cyclic shape",
    payload: {
      jobs: [
        { type: "motioncorr", dx: 0, dy: 0, params: {} },
        { type: "motioncorr", dx: 240, dy: 0, params: {} },
      ],
      edges: [{ from: 0, to: 1 }, { from: 1, to: 0 }],
    },
  });
  must(cycTemplate.status === 400 &&
       /Template edges form a cycle:/.test(cycTemplate.body?.error ?? ""),
    `B16 cyclic template save rejected ("${cycTemplate.body?.error ?? "none"}")`);

  const okTemplate = await post("/api/custom-template", {
    name: "t180 control shape",
    payload: {
      jobs: [
        { type: "motioncorr", dx: 0, dy: 0, params: {} },
        { type: "motioncorr", dx: 240, dy: 0, params: {} },
      ],
      edges: [{ from: 0, to: 1 }],
    },
  });
  const tplId = okTemplate.body?.template?.id;
  must(okTemplate.status === 201 && !!tplId,
    `B17 acyclic template saves (${okTemplate.status})`);
  const apply = await fetch(BASE + "/api/custom-template", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: tplId }),
  });
  let applyBody = null;
  try { applyBody = await apply.json(); } catch { /* non-JSON */ }
  const applyJobs = (applyBody?.jobs ?? []).map((j) => j.id);
  must(apply.status === 201 && applyJobs.length === 2,
    `B18 acyclic apply lands (${apply.status}, ${applyJobs.length} jobs)`);
  for (const id of applyJobs) await del(`/api/jobs/${id}`);
  const tplDel = await del(`/api/custom-template?id=${tplId}`);
  must(tplDel.status === 200, `B19 template deleted (${tplDel.status})`);
  must((await roster()).length === 26, "B20 shelf-test cleanup restores the roster");

  /* ================= M — client pre-validation (390×844) ================= */
  section("M: cyclic file → toast, dialog stays closed (390)");
  const workflowFile = (jobs, edges) => ({
    format: "cryoflow-workflow",
    version: 1,
    exportedAt: "2026-09-14T00:00:00.000Z",
    project: "t180",
    workspace: "Main",
    jobs,
    edges,
  });
  const cyclicFile = workflowFile(
    [
      { type: "motioncorr", name: "MC Alpha", x: 100, y: 100, params: {} },
      { type: "motioncorr", name: "MC Beta", x: 340, y: 100, params: {} },
    ],
    [
      { from: 0, to: 1, fromPort: "micrographs", toPort: "movies" },
      { from: 1, to: 0, fromPort: "micrographs", toPort: "movies" },
    ]
  );
  const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackConsole(mpage, "mobile");
  await mpage.goto(BASE, { waitUntil: "networkidle" });
  await mpage.waitForTimeout(800);
  await mpage.setInputFiles('input[aria-label="Import workflow JSON files"]', {
    name: "cyclic.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(cyclicFile)),
  });
  await mpage.waitForTimeout(900);
  const toastM = mpage.getByText("Edges form a cycle:").first();
  must(await toastM.isVisible(),
    "M1 the destructive toast names the cycle (instant, no round-trip)");
  const dlgM = mpage.locator('[data-canvas-ui="import-workflow-dialog"]');
  must(!(await dlgM.isVisible().catch(() => false)),
    "M2 the preview dialog stays closed (entries = 0)");
  const mConsole = consoleErrors.filter((e) => e.label === "mobile");
  must(mConsole.length === 0, `M3 mobile console clean (${mConsole.length})`);
  await mpage.close();

  /* ================= D — no-false-positive face (1440×900) ================= */
  section("D: valid file still opens the dialog (1440)");
  const dpage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  trackConsole(dpage, "desktop");
  await dpage.goto(BASE, { waitUntil: "networkidle" });
  await dpage.waitForTimeout(800);
  // the cyclic face on desktop too
  await dpage.setInputFiles('input[aria-label="Import workflow JSON files"]', {
    name: "cyclic.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(cyclicFile)),
  });
  await dpage.waitForTimeout(900);
  const toastD = dpage.getByText("Edges form a cycle:").first();
  must(await toastD.isVisible(), "D1 desktop cyclic file → toast names the cycle");
  const dlgD = dpage.locator('[data-canvas-ui="import-workflow-dialog"]');
  must(!(await dlgD.isVisible().catch(() => false)), "D2 dialog stays closed");
  // the control: a VALID file must still stage + open the dialog
  const validFile = workflowFile(
    [
      { type: "motioncorr", name: "MC V0", x: 100, y: 100, params: {} },
      { type: "motioncorr", name: "MC V1", x: 340, y: 100, params: {} },
    ],
    [{ from: 0, to: 1, fromPort: "micrographs", toPort: "movies" }]
  );
  await dpage.setInputFiles('input[aria-label="Import workflow JSON files"]', {
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(validFile)),
  });
  await dpage.waitForTimeout(900);
  must(await dlgD.isVisible(), "D3 the guard does NOT over-reject: valid file opens the dialog");
  await dpage.keyboard.press("Escape");
  await dpage.waitForTimeout(400);
  must(!(await dlgD.isVisible().catch(() => false)), "D4 Escape closes the dialog (nothing POSTed)");
  const dConsole = consoleErrors.filter((e) => e.label === "desktop");
  must(dConsole.length === 0, `D5 desktop console clean (${dConsole.length})`);
  await dpage.close();

  /* ================= Z — roster identity + read-only proof ================= */
  section("Z: roster identity");
  const afterList = await roster();
  must(afterList.length === roster0.length, `Z1 roster size unchanged (${afterList.length})`);
  const afterIds = new Set(afterList.map((j) => j.id));
  must(roster0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
  must(readdirSync(projDir).sort().join("|") === listingBefore,
    "Z3 project dir listing identical (no workdir litter)");
  const badTraffic = failedUrls.filter((u) => (u.status ?? 0) >= 500 || u.status === 404);
  must(badTraffic.length === 0, `Z4 no 5xx/404 browser traffic (${badTraffic.length})`);
} finally {
  await browser.close();
}

console.log(
  failures.length === 0
    ? `\nT180 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT180 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
