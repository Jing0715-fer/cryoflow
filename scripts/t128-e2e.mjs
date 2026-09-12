// t128 — Task 128: template export/import — the share leg of the
// custom-template loop (Task 127 built save + apply, this closes
// save → apply → SHARE):
//
//   export  — a shelf row's Download button fetches GET ?id= (payload
//             included) and lands a cryoflow-template/1 file
//   import  — the shelf header's Import button takes .json files, the
//             client pre-parses (template-io, the SHARED validator the
//             POST route also runs), each valid entry POSTs into the
//             shelf exactly like a hand-saved template
//   roundtrip — delete the original, re-import the exported bytes,
//             apply the result into a fresh workspace: the branch lands
//             wired, numbered and parameterized exactly as saved
//
// Phase S — seed: 3 wired jobs in ws1 (box=384 marker) + dest workspace.
// Phase B — shift-click selection → save-as-template "T128 shared branch".
// Phase C — export: capture the download, assert the file's shape
//           (format/version/name/payload geometry/params/provenance).
// Phase D — import 4 files (valid / broken JSON / wrong format / v2
//           future-version): shelf grows by 2, server list honest.
// Phase E — roundtrip: delete the original, re-import the exported file,
//           the shelf row comes back with identical counts.
// Phase F — apply the re-imported template into the dest workspace:
//           3 jobs, 2 wires, exact ports, snapshot param, RELION numbers.
// Phase Z — cleanup + console clean.
//
// Run: node scripts/t128-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededJobIds = [];
const seededWsIds = [];
const tmp = mkdtempSync(join(tmpdir(), "t128-"));

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededJobIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
  for (const id of seededWsIds) {
    try { await fetch(`${BASE}/api/workspaces/${id}`, { method: "DELETE" }); } catch {}
  }
  // forget any T128 template rows (the failure paths of a red run must
  // not pollute the next one)
  try {
    const list = await (await fetch(`${BASE}/api/custom-template`)).json();
    for (const t of list.templates ?? []) {
      if ((t.name ?? "").startsWith("T128")) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
  } catch {}
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FAIL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

async function main() {
  step("=== t128 — template export/import (share leg) ===");

  /* ---------------- Phase S — seed ---------------- */
  step("--- Phase S: wired branch + destination workspace ---");
  // pre-clean T128 orphans a previous KILLED run may have left behind
  try {
    const pre = await (await fetch(`${BASE}/api/custom-template`)).json();
    for (const t of pre.templates ?? []) {
      if ((t.name ?? "").startsWith("T128")) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
    const preWs = (await (await fetch(`${BASE}/api/workspaces`)).json()).workspaces ?? [];
    for (const w of preWs) {
      if ((w.name ?? "").startsWith("T128")) {
        await fetch(`${BASE}/api/workspaces/${w.id}`, { method: "DELETE" });
      }
    }
    const preJobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
    for (const j of preJobs) {
      if ((j.name ?? "").startsWith("T128")) {
        await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" });
      }
    }
  } catch {}
  const proj = (await (await api("/api/project")).json()).project;
  must(!!proj?.id, "an active project exists");
  const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(wsList.length >= 1, "the active project has at least one workspace");
  const ws1Id = wsList[0].id;

  const dest = await (await api("/api/workspaces", "POST", { name: "T128 dest" })).json();
  const ws2Id = dest?.workspace?.id ?? dest?.id ?? null;
  must(!!ws2Id, "destination workspace created");
  seededWsIds.push(ws2Id);

  const mkJob = async (type, x, y, name) => {
    const created = await (await api("/api/jobs", "POST", { type, name, workspaceId: ws1Id, x, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${type}: seeded in ws1`);
    seededJobIds.push(j.id);
    return j;
  };
  // unique T-prefixed names: the reach-first helper finds ONE match —
  // default type names collide with the world's own cards
  const jImport = await mkJob("import", 140, 300, "T128 Alpha");
  const jMotion = await mkJob("motioncorr", 440, 300, "T128 Beta");
  const jCtf = await mkJob("ctffind", 740, 300, "T128 Gamma");
  const patched = await api(`/api/jobs/${jCtf.id}`, "PATCH", { params: { box: 384 } });
  must(patched.ok, "ctffind box patched to 384 (snapshot marker)");

  const e1 = await (await api("/api/edges", "POST", {
    projectId: proj.id, fromJobId: jImport.id, toJobId: jMotion.id,
    fromPort: "micrographs", toPort: "movies",
  })).json();
  const e2 = await (await api("/api/edges", "POST", {
    projectId: proj.id, fromJobId: jMotion.id, toJobId: jCtf.id,
    fromPort: "micrographs", toPort: "micrographs",
  })).json();
  must(!!(e1?.edge?.id ?? e1?.id) && !!(e2?.edge?.id ?? e2?.id), "both internal wires created");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase B — select + save ---------------- */
  step("--- Phase B: shift-click the three cards, save the template ---");
  // t139 orthodoxy + t112 reach-first, re-earned the hard way
  // (2026-09-12 block-6): the pipeline-kpi bar is a lawfully interactive
  // floating widget whose flex-wrap width grows with the live particles
  // count — and at boot-fit scale a top-left seed's whole 55×24 footprint
  // can sit INSIDE the bar's rect, leaving the offset grid no escape.
  // So: reach the card through the find lens first (Enter centers it in
  // the viewport's clear middle), THEN scan a grid of offsets and let
  // the SELECTION COUNT judge the hit — the one truth a swallowed
  // pointerdown cannot fake.
  const reachViaFind = async (name) => {
    await p.keyboard.press("Control+f");
    await p.locator('[data-testid="canvas-find-input"]').click();
    await p.keyboard.press("Control+a");
    await p.keyboard.type(name, { delay: 20 });
    await sleep(350);
    await p.keyboard.press("Enter");
    await sleep(1000);
    await p.keyboard.press("Escape");
    await sleep(350);
  };
  // The toolbar only renders at >=2 selections (canvas.tsx: sel.length < 2
  // returns null) — a TRUE first shift-click shows nothing. The per-card
  // selected ring is the honest single-card truth: ring-primary/60 (the
  // primary) or ring-primary/30 (a multi member); the running breathing
  // ring is teal-border, the find lens ring is amber — no collisions.
  const isSel = (id) =>
    p.evaluate(({ id }) => {
      const btn = document.querySelector(`[data-job="${id}"]`)?.querySelector('[role="button"]');
      const cls = btn?.className ?? "";
      return cls.includes("ring-primary/60") || cls.includes("ring-primary/30");
    }, { id });
  const shiftClickCard = async (id, name) => {
    await reachViaFind(name);
    const box = await p.locator(`[data-job="${id}"]`).boundingBox();
    if (!box) throw new Error(`card ${id} has no box (off-canvas?)`);
    const offsets = [[0.5, 0.6], [0.5, 0.4], [0.3, 0.5], [0.7, 0.5], [0.5, 0.75], [0.5, 0.3], [0.3, 0.65], [0.7, 0.65]];
    for (const [fx, fy] of offsets) {
      // t139 verbatim: verify the point hits the card BEFORE clicking —
      // the KPI bar (or any lawful overlay) must not eat the gesture
      const inside = await p.evaluate(
        ({ x, y, sel }) => !!document.elementFromPoint(x, y)?.closest(`[data-job="${sel}"]`),
        { x: box.x + box.width * fx, y: box.y + box.height * fy, sel: id },
      );
      if (!inside) continue;
      await p.keyboard.down("Shift");
      try {
        await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      } catch {}
      await p.keyboard.up("Shift");
      await sleep(350);
      if (await isSel(id)) return;
    }
    throw new Error(`shift-click never selected ${id} (ring never lit)`);
  };
  for (const [id, name] of [[jImport.id, "T128 Alpha"], [jMotion.id, "T128 Beta"], [jCtf.id, "T128 Gamma"]]) {
    await shiftClickCard(id, name);
  }
  await p.waitForSelector('[data-canvas-ui="selection-toolbar"]', { timeout: 5000 });
  must(
    (await p.locator('[data-canvas-ui="selection-toolbar"]').innerText()).includes("3 selected"),
    "B1 toolbar reports 3 selected"
  );
  await p.locator('[data-testid="toolbar-save-template"]').click();
  await p.waitForSelector('[data-canvas-ui="save-template-dialog"]', { timeout: 5000 });
  await p.locator('[data-testid="save-template-name"]').fill("T128 shared branch");
  await p.locator('[data-testid="save-template-confirm"]').click();
  await p.waitForSelector('[data-canvas-ui="save-template-dialog"]', { state: "detached", timeout: 8000 });
  const shelf0 = (await (await api("/api/custom-template")).json()).templates ?? [];
  const saved = shelf0.find((t) => t.name === "T128 shared branch");
  must(!!saved, "B2 template persisted under the active project");

  /* ---------------- Phase C — export ---------------- */
  step("--- Phase C: export via the row's Download button ---");
  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  const row = p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T128 shared branch" });
  must((await row.count()) === 1, "C0 the shelf lists the saved template");
  await row.hover();
  const [download] = await Promise.all([
    p.waitForEvent("download", { timeout: 10000 }),
    row.locator('[data-testid="custom-template-export"]').click(),
  ]);
  const suggested = download.suggestedFilename();
  must(suggested.startsWith("cryoflow-template-"), `C1 download fired (${suggested})`);
  must(suggested.endsWith(".json"), "C2 suggested name is a .json");
  const exportedPath = join(tmp, "exported.json");
  await download.saveAs(exportedPath);
  const exported = JSON.parse(readFileSync(exportedPath, "utf8"));
  must(exported.format === "cryoflow-template", `C3 format marker (${exported.format})`);
  must(exported.version === 1, `C4 version (${exported.version})`);
  must(exported.name === "T128 shared branch", `C5 name carried (${exported.name})`);
  must(typeof exported.exportedAt === "string" && exported.exportedAt.length > 0, "C6 exportedAt present");
  must(typeof exported.project === "string" && exported.project.length > 0, `C7 provenance project present (${exported.project})`);
  must(Array.isArray(exported.payload?.jobs) && exported.payload.jobs.length === 3, "C8 payload has 3 jobs");
  must(Array.isArray(exported.payload?.edges) && exported.payload.edges.length === 2, "C9 payload has 2 edges");
  const dxs = exported.payload.jobs.map((j) => j.dx).sort((a, b2) => a - b2);
  must(JSON.stringify(dxs) === JSON.stringify([0, 300, 600]), `C10 dx shape preserved (${dxs.join("/")})`);
  const ctf = exported.payload.jobs.find((j) => j.type === "ctffind");
  must(ctf?.params?.box === 384, `C11 snapshot param carried (box=${ctf?.params?.box})`);
  const portPairs = exported.payload.edges
    .map((e) => `${e.fromPort ?? ""}:${e.toPort ?? ""}`)
    .sort();
  must(
    JSON.stringify(portPairs) === JSON.stringify(["micrographs:micrographs", "micrographs:movies"]),
    `C12 port pairs carried (${portPairs.join(" | ")})`
  );

  /* ---------------- Phase D — import 4 files ---------------- */
  step("--- Phase D: import valid / broken / wrong-format / v2 ---");
  const validFile = {
    format: "cryoflow-template",
    version: 1,
    exportedAt: new Date().toISOString(),
    project: "somewhere else",
    name: "T128 imported branch",
    payload: {
      jobs: [
        { type: "motioncorr", dx: 0, dy: 0, params: {} },
        { type: "ctffind", dx: 300, dy: 0, params: { box: 256 } },
      ],
      edges: [{ from: 0, to: 1, fromPort: "micrographs", toPort: "micrographs" }],
    },
  };
  const futureFile = { ...validFile, version: 2, name: "T128 future branch" };
  const brokenFile = "{ definitely not json";
  const wrongFormat = {
    format: "cryoflow-workflow",
    version: 1,
    jobs: [{ type: "import", name: "Import 1", x: 0, y: 0, params: {} }],
    edges: [],
  };
  const fValid = join(tmp, "valid.json");
  const fFuture = join(tmp, "future.json");
  const fBroken = join(tmp, "broken.json");
  const fWrong = join(tmp, "wrong.json");
  writeFileSync(fValid, JSON.stringify(validFile));
  writeFileSync(fFuture, JSON.stringify(futureFile));
  writeFileSync(fBroken, brokenFile);
  writeFileSync(fWrong, JSON.stringify(wrongFormat));

  const [chooser] = await Promise.all([
    p.waitForEvent("filechooser", { timeout: 10000 }),
    p.locator('[data-testid="custom-template-import"]').click(),
  ]);
  await chooser.setFiles([fValid, fFuture, fBroken, fWrong]);
  // the batch POSTs then refreshes — wait for the third row to appear
  await p
    .waitForFunction(
      () => document.querySelectorAll('[data-canvas-ui="custom-template-row"]').length >= 3,
      { timeout: 15000 }
    )
    .catch(() => {});
  const rowCount = await p.locator('[data-canvas-ui="custom-template-row"]').count();
  must(rowCount === 3, `D1 shelf grew by exactly the two valid files (${rowCount})`);
  const importedRow = p
    .locator('[data-canvas-ui="custom-template-row"]')
    .filter({ hasText: "T128 imported branch" });
  must((await importedRow.count()) === 1, "D2 the valid file landed as its own row");
  must(
    /2 jobs/.test(await importedRow.innerText()) && /1 wire/.test(await importedRow.innerText()),
    "D3 imported row meta honest (2 jobs · 1 wire)"
  );
  const serverList = (await (await api("/api/custom-template")).json()).templates ?? [];
  const importedSrv = serverList.find((t) => t.name === "T128 imported branch");
  const futureSrv = serverList.find((t) => t.name === "T128 future branch");
  must(!!importedSrv && importedSrv.jobCount === 2 && importedSrv.edgeCount === 1, "D4 server persisted the valid import");
  must(!!futureSrv && futureSrv.jobCount === 2, "D5 the v2 (future) file still landed — forward-compatible");
  const names = serverList.filter((t) => (t.name ?? "").startsWith("T128")).map((t) => t.name);
  must(names.length === 3, `D6 server list holds exactly the three T128 rows (${names.join(", ")})`);

  /* ---------------- Phase E — roundtrip: delete → re-import ---------------- */
  step("--- Phase E: delete the original, re-import the exported bytes ---");
  await row.hover();
  await row.locator('[data-testid="custom-template-delete"]').click();
  await row.locator('[data-testid="custom-template-delete-confirm"]').click();
  await p
    .waitForFunction(
      (n) => document.querySelectorAll('[data-canvas-ui="custom-template-row"]').length === n,
      2,
      { timeout: 8000 }
    )
    .catch(() => {});
  must(
    (await p.locator('[data-canvas-ui="custom-template-row"]').count()) === 2,
    "E1 original deleted — two rows remain"
  );
  const [chooser2] = await Promise.all([
    p.waitForEvent("filechooser", { timeout: 10000 }),
    p.locator('[data-testid="custom-template-import"]').click(),
  ]);
  await chooser2.setFiles([exportedPath]);
  await p
    .waitForFunction(
      () => document.querySelectorAll('[data-canvas-ui="custom-template-row"]').length >= 3,
      { timeout: 15000 }
    )
    .catch(() => {});
  const backRow = p
    .locator('[data-canvas-ui="custom-template-row"]')
    .filter({ hasText: "T128 shared branch" });
  must((await backRow.count()) === 1, "E2 the exported file re-imported — row is back");
  must(
    /3 jobs/.test(await backRow.innerText()) && /2 wires/.test(await backRow.innerText()),
    "E3 roundtrip is lossless (3 jobs · 2 wires)"
  );

  /* ---------------- Phase F — apply the re-imported template ---------------- */
  step("--- Phase F: apply into the destination workspace ---");
  // Escape is unreliable here: the filechooser interaction left the page
  // focus outside the Radix dialog, and its global Esc handler missed —
  // the Cancel button is the deterministic close path
  await p.locator('[data-canvas-ui="template-presets-dialog"] button:has-text("Cancel")').click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { state: "detached", timeout: 5000 });
  // the sidebar defaults to the Catalog tab — flip to Workspaces first
  await p.locator('button[role="tab"]:has-text("Workspaces")').click();
  await sleep(350);
  await p.locator(`[role="button"][title="Switch the canvas to T128 dest"]`).click();
  await sleep(700);
  must((await p.locator("[data-job]").count()) === 0, "F0 destination canvas is empty");

  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  const applyRow = p
    .locator('[data-canvas-ui="custom-template-row"]')
    .filter({ hasText: "T128 shared branch" });
  await applyRow.locator('[data-testid="custom-template-apply"]').click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { state: "detached", timeout: 10000 }).catch(() => {});
  await sleep(900);

  const ws2Jobs = ((await (await api("/api/jobs")).json()).jobs ?? []).filter(
    (j) => j.workspaceId === ws2Id
  );
  must(ws2Jobs.length === 3, `F1 three jobs landed (${ws2Jobs.length})`);
  const types = Object.fromEntries(ws2Jobs.map((j) => [j.type, j]));
  must(!!types.import && !!types.motioncorr && !!types.ctffind, "F2 types preserved through the full roundtrip");
  const allEdges = (await (await api("/api/edges")).json()).edges ?? [];
  const ids2 = new Set(ws2Jobs.map((j) => j.id));
  const wires = allEdges.filter((e) => ids2.has(e.fromJobId) && ids2.has(e.toJobId));
  must(wires.length === 2, `F3 both wires recreated (${wires.length})`);
  const fPorts = wires.map((w) => `${w.fromPort ?? ""}:${w.toPort ?? ""}`).sort();
  must(
    JSON.stringify(fPorts) === JSON.stringify(["micrographs:micrographs", "micrographs:movies"]),
    `F4 ports exact (${fPorts.join(" | ")})`
  );
  must(types.ctffind?.params?.box === 384, `F5 snapshot param survived export→import→apply (box=${types.ctffind?.params?.box})`);
  const numbering = ws2Jobs.every((j) =>
    /^(Import Movies \/ Micrographs|Motion Correction|CTF Estimation) \d+$/.test(j.name)
  );
  must(numbering, `F6 RELION numbering intact (${ws2Jobs.map((j) => j.name).join(", ")})`);

  /* ---------------- Phase Z — cleanup + console ---------------- */
  step("--- Phase Z: cleanup + console ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  console.log(`\nT128 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
