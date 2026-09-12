// t127 — Task 127: custom sub-pipeline templates. Select jobs on the
// canvas, snapshot the selection (types / relative positions / params /
// internal wires) into a NAMED, PROJECT-SCOPED template, then re-instantiate
// the whole branch anywhere with one click.
//
// Before this task the only scaffold was the built-in 10-job SPA chain —
// a user's tuned branch (e.g. their Extract→Class2D settings) could only be
// duplicated job-by-job, wires re-drawn by hand. The template loop:
//
//   select → toolbar "Save as template" → name → shelf row →
//   apply into another workspace → fresh jobs land BELOW the content,
//   numbered in the RELION sequence, wired exactly as saved →
//   two-step inline delete forgets it.
//
// Phase S — seed: 3 wired jobs in ws1 (import→motioncorr→ctffind, one
//           patched param as a snapshot marker), a destination workspace.
// Phase B — shift-click the three cards → toolbar shows "3 selected".
// Phase C — save-as-template dialog is honest about 3 jobs · 2 wires; save.
// Phase D — the presets dialog's "Your templates" shelf lists the row.
// Phase E — apply into the EMPTY destination workspace: 3 jobs, both wires
//           with exact ports, x left-aligned at ORIGIN_X, dy preserved,
//           params carried, RELION numbering continues.
// Phase F — second apply: lands exactly DROP_GAP below the first batch.
// Phase G — shelf delete flow (arm → confirm) empties the shelf.
// Phase Z — cleanup + console clean.
//
// Run: node scripts/t127-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededJobIds = [];
const seededWsIds = [];

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededJobIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
  for (const id of seededWsIds) {
    try { await fetch(`${BASE}/api/workspaces/${id}`, { method: "DELETE" }); } catch {}
  }
  // forget any T127 template rows (Phase G deletes them; this guards the
  // failure paths so a red run doesn't pollute the next one)
  try {
    const list = await (await fetch(`${BASE}/api/custom-template`)).json();
    for (const t of list.templates ?? []) {
      if ((t.name ?? "").startsWith("T127")) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
  } catch {}
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
const ok = must; // non-fatal variant alias for late phases
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
  step("=== t127 — custom sub-pipeline templates ===");

  /* ---------------- Phase S — seed ---------------- */
  step("--- Phase S: wired branch + destination workspace ---");
  // pre-clean any T127 orphans a previous CRASHED run may have left behind
  // (a killed run never reaches its cleanup — start from a known state)
  try {
    const pre = await (await fetch(`${BASE}/api/custom-template`)).json();
    for (const t of pre.templates ?? []) {
      if ((t.name ?? "").startsWith("T127")) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
    // orphan workspaces / jobs from a previous KILLED run keep polluting
    // the sidebar and the canvas roster — sweep them too
    const preWs = (await (await fetch(`${BASE}/api/workspaces`)).json()).workspaces ?? [];
    for (const w of preWs) {
      if ((w.name ?? "").startsWith("T127")) {
        await fetch(`${BASE}/api/workspaces/${w.id}`, { method: "DELETE" });
      }
    }
    const preJobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
    for (const j of preJobs) {
      if ((j.name ?? "").startsWith("T127")) {
        await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" });
      }
    }
  } catch {}
  const proj = (await (await api("/api/project")).json()).project;
  must(!!proj?.id, "an active project exists");
  const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(wsList.length >= 1, "the active project has at least one workspace");
  const ws1Id = wsList[0].id;

  const dest = await (await api("/api/workspaces", "POST", { name: "T127 dest" })).json();
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
  const jImport = await mkJob("import", 140, 300, "T127 Alpha");
  const jMotion = await mkJob("motioncorr", 440, 300, "T127 Beta");
  const jCtf = await mkJob("ctffind", 740, 300, "T127 Gamma");

  // a distinctive param value — the applied copy must carry 384, not the
  // spec default 512 (the snapshot is the contract, not the spec)
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

  /* ---------------- Phase B — shift-click selection ---------------- */
  step("--- Phase B: shift-click the three cards ---");
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
  for (const [id, name] of [[jImport.id, "T127 Alpha"], [jMotion.id, "T127 Beta"], [jCtf.id, "T127 Gamma"]]) {
    await shiftClickCard(id, name);
  }
  await p.waitForSelector('[data-canvas-ui="selection-toolbar"]', { timeout: 5000 });
  must(
    (await p.locator('[data-canvas-ui="selection-toolbar"]').innerText()).includes("3 selected"),
    "B1 toolbar reports 3 selected"
  );

  /* ---------------- Phase C — save the template ---------------- */
  step("--- Phase C: save-as-template dialog ---");
  await p.locator('[data-testid="toolbar-save-template"]').click();
  await p.waitForSelector('[data-canvas-ui="save-template-dialog"]', { timeout: 5000 });
  const dialogText = await p.locator('[data-canvas-ui="save-template-dialog"]').innerText();
  must(/3 jobs/.test(dialogText), "C1 dialog counts the jobs");
  must(/2 internal wires/.test(dialogText), "C2 dialog counts the internal wires");
  await p.locator('[data-testid="save-template-name"]').fill("T127 tuned branch");
  await p.locator('[data-testid="save-template-confirm"]').click();
  await p.waitForSelector('[data-canvas-ui="save-template-dialog"]', { state: "detached", timeout: 8000 });
  const shelf = await (await api("/api/custom-template")).json();
  const saved = (shelf.templates ?? []).find((t) => t.name === "T127 tuned branch");
  must(!!saved, "C3 template persisted under the active project");
  must(saved?.jobCount === 3 && saved?.edgeCount === 2, `C4 summary honest (${saved?.jobCount} jobs / ${saved?.edgeCount} wires)`);

  /* ---------------- Phase D — the shelf lists it ---------------- */
  step("--- Phase D: presets dialog shelf ---");
  await p.keyboard.press("Control+k");
  await p.waitForSelector('[role="dialog"] [cmdk-root], [cmdk-root]', { timeout: 5000 }).catch(() => {});
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { timeout: 5000 });
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  const row = p.locator('[data-canvas-ui="custom-template-row"]');
  must((await row.count()) === 1, "D1 exactly one shelf row (pre-cleaned state)");
  const rowText = await row.first().innerText();
  must(/T127 tuned branch/.test(rowText), `D2 row shows the name`);
  must(/3 jobs/.test(rowText) && /2 wires/.test(rowText), `D3 row meta carries counts`);
  // leave the dialog OPEN across the workspace switch? The overlay blocks
  // the sidebar — close it first, switch, reopen (the shelf refreshes on
  // every open by design)
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { state: "detached", timeout: 5000 });

  /* ---------------- Phase E — apply into the empty destination ------- */
  step("--- Phase E: apply into the destination workspace ---");
  // the sidebar defaults to the Catalog tab — flip to Workspaces first
  await p.locator('button[role="tab"]:has-text("Workspaces")').click();
  await sleep(350);
  await p.locator(`[role="button"][title="Switch the canvas to T127 dest"]`).click();
  await sleep(700);
  must((await p.locator("[data-job]").count()) === 0, "E1 destination canvas is empty");

  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  await row.first().locator('[data-testid="custom-template-apply"]').click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { state: "detached", timeout: 10000 }).catch(() => {});
  await sleep(900);

  const ws2Jobs = ((await (await api("/api/jobs")).json()).jobs ?? []).filter(
    (j) => j.workspaceId === ws2Id
  );
  must(ws2Jobs.length === 3, `E2 three jobs landed in the destination (${ws2Jobs.length})`);
  const types = Object.fromEntries(ws2Jobs.map((j) => [j.type, j]));
  must(!!types.import && !!types.motioncorr && !!types.ctffind, "E3 types preserved");
  const minX = Math.min(...ws2Jobs.map((j) => j.x));
  must(minX === 80, `E4 left-aligned at ORIGIN_X (min x=${minX})`);
  // dy preserved: the branch sat on one row → all copies on one row
  const ys = new Set(ws2Jobs.map((j) => j.y));
  must(ys.size === 1, `E5 dy preserved — one row (${[...ys].join(",")})`);
  const y0 = [...ys][0];
  must(y0 === 140, `E6 empty workspace drops at FIRST_Y (y=${y0})`);
  // dx preserved: 0 / 300 / 600 offsets
  const dxs = ws2Jobs.map((j) => Math.round(j.x - 80)).sort((a, b2) => a - b2);
  must(JSON.stringify(dxs) === JSON.stringify([0, 300, 600]), `E7 relative shape preserved (${dxs.join("/")})`);

  const allEdges = (await (await api("/api/edges")).json()).edges ?? [];
  const ids2 = new Set(ws2Jobs.map((j) => j.id));
  const wires = allEdges.filter((e) => ids2.has(e.fromJobId) && ids2.has(e.toJobId));
  must(wires.length === 2, `E8 both wires recreated (${wires.length})`);
  const portPairs = wires.map((w) => `${w.fromPort ?? ""}:${w.toPort ?? ""}`).sort();
  must(
    JSON.stringify(portPairs) === JSON.stringify(["micrographs:micrographs", "micrographs:movies"]),
    `E9 ports carried exactly as saved (${portPairs.join(" | ")})`
  );
  must(types.ctffind?.params?.box === 384, `E10 snapshot param carried (box=${types.ctffind?.params?.box})`);
  const nameOk = ws2Jobs.every((j) =>
    /^(Import Movies \/ Micrographs|Motion Correction|CTF Estimation) \d+$/.test(j.name)
  );
  must(nameOk, `E11 RELION numbering continues (${ws2Jobs.map((j) => j.name).join(", ")})`);
  const namesUniq = new Set(ws2Jobs.map((j) => j.name)).size === 3;
  must(namesUniq, "E12 names are unique (no double-stamped sequence)");

  /* ---------------- Phase F — second apply: below content ------------ */
  step("--- Phase F: second apply lands below the first ---");
  const maxY1 = Math.max(...ws2Jobs.map((j) => j.y));
  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  await row.first().locator('[data-testid="custom-template-apply"]').click();
  await sleep(1200);
  const ws2Jobs2 = ((await (await api("/api/jobs")).json()).jobs ?? []).filter(
    (j) => j.workspaceId === ws2Id
  );
  must(ws2Jobs2.length === 6, `F1 six jobs total (${ws2Jobs2.length})`);
  const minNew = Math.min(...ws2Jobs2.map((j) => j.y).filter((y) => y > maxY1));
  must(minNew - maxY1 === 240, `F2 second batch exactly DROP_GAP below (gap=${minNew - maxY1})`);

  /* ---------------- Phase G — delete flow ---------------------------- */
  step("--- Phase G: shelf delete (arm → confirm) ---");
  await row.first().hover();
  await row.first().locator('[data-testid="custom-template-delete"]').click();
  must(
    (await row.first().locator('[data-testid="custom-template-delete-confirm"]').count()) === 1,
    "G1 trash arms the inline confirm"
  );
  await row.first().locator('[data-testid="custom-template-delete-confirm"]').click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-empty"]', { timeout: 5000 });
  must(true, "G2 confirm deletes — empty-state hint shows");
  const shelfAfter = (await (await api("/api/custom-template")).json()).templates ?? [];
  must(shelfAfter.length === 0, "G3 server list empty after delete");
  await p.keyboard.press("Escape");

  /* ---------------- Phase Z — cleanup + console ---------------------- */
  step("--- Phase Z: cleanup + console ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  console.log(`\nT127 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
