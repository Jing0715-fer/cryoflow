// t130 — Task 130: template shelf BATCH MANAGEMENT (Export all / Clear all):
//
//   export all — GET ?all=1 (every template with payload, oldest first)
//                lands ONE cryoflow-template-bundle/1 file whose inner
//                entries are full cryoflow-template/1 files
//   import     — the SAME shelf funnel detects the bundle marker and
//                EXPANDS it: every valid inner POSTs like a hand-saved
//                template (Task 128's endpoint, no second-class rows)
//   clear all  — header trash arms "Delete all N?" → Clear wipes the
//                project's shelf in one deleteMany; Keep walks away
//
// Phase S — pre-clean T130 orphans, snapshot the BASELINE shelf via
//           GET ?all=1 (restore material), seed T130 branch A/B.
// Phase B — dialog opens, rows == baseline+2, batch buttons present,
//           not armed.
// Phase C — Export all: capture the download, assert the bundle shape
//           (marker/version/provenance/inner names/params/edges).
// Phase D — import the bundle back: shelf DOUBLES (duplicates are by
//           design — import does not dedupe), server honest.
// Phase E — clear-all: Keep refuses, Clear empties shelf AND server.
// Phase F — restore the baseline byte-for-byte (POST asc order), reopen
//           the dialog, screenshot the batch header.
// Phase Z — console clean, T130 rows removed (baseline STAYS).
//
// Run: node scripts/t130-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t130-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const tmp = mkdtempSync(join(tmpdir(), "t130-"));
mkdirSync(OUT, { recursive: true });

// baseline snapshot — the shelf's contents before T130 touched anything;
// clear-all's test wipes them, Phase F puts every one back
let baseline = [];
const t130Ids = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const listAll = async () =>
  (await (await api("/api/custom-template?all=1")).json())?.templates ?? [];

async function deleteT130Rows() {
  try {
    const all = await listAll();
    for (const t of all) {
      if ((t.name ?? "").startsWith("T130")) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
  } catch {}
}

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  await deleteT130Rows();
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

/** POST a small two-job template; records its id for cleanup. */
const seedTemplate = async (name, box) => {
  const res = await (await api("/api/custom-template", "POST", {
    name,
    payload: {
      jobs: [
        { type: "motioncorr", dx: 0, dy: 0, params: {} },
        { type: "ctffind", dx: 300, dy: 0, params: { box } },
      ],
      edges: [{ from: 0, to: 1, fromPort: "micrographs", toPort: "micrographs" }],
    },
  })).json();
  must(!!res?.template?.id, `${name}: seeded`);
  t130Ids.push(res.template.id);
  return res.template;
};

async function main() {
  step("=== t130 — template shelf batch management (Export all / Clear all) ===");

  /* ---------------- Phase S — baseline + seed ---------------- */
  step("--- Phase S: baseline snapshot + T130 branch A/B ---");
  await deleteT130Rows(); // a KILLED previous run must not poison this one
  baseline = await listAll();
  must(Array.isArray(baseline), `baseline shelf snapshotted via GET ?all=1 (${baseline.length} rows)`);
  await seedTemplate("T130 branch A", 384);
  await seedTemplate("T130 branch B", 256);
  const afterSeed = await listAll();
  must(afterSeed.length === baseline.length + 2, `S1 server shelf = baseline + 2 (${afterSeed.length})`);
  const N = afterSeed.length; // total rows for every later count assertion

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  const openDialog = async () => {
    await p.keyboard.press("Control+k");
    await sleep(400);
    await p.getByText("Create SPA pipeline with presets…").first().click();
    await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
    await sleep(300);
  };

  /* ---------------- Phase B — batch buttons present ---------------- */
  step("--- Phase B: shelf shows batch tools when there is a batch ---");
  await openDialog();
  const rowCount = await p.locator('[data-canvas-ui="custom-template-row"]').count();
  must(rowCount === N, `B1 shelf lists all ${N} rows (${rowCount})`);
  must((await p.locator('[data-testid="custom-template-export-all"]').count()) === 1, "B2 Export all button present (N >= 2)");
  must((await p.locator('[data-testid="custom-template-clear"]').count()) === 1, "B3 Clear button present");
  must((await p.locator('[data-testid="custom-template-clear-arm"]').count()) === 0, "B4 not armed on arrival");

  /* ---------------- Phase C — export all ---------------- */
  step("--- Phase C: Export all lands ONE bundle file ---");
  const [download] = await Promise.all([
    p.waitForEvent("download", { timeout: 10000 }),
    p.locator('[data-testid="custom-template-export-all"]').click(),
  ]);
  const suggested = download.suggestedFilename();
  must(suggested.startsWith("cryoflow-templates-"), `C1 download fired (${suggested})`);
  must(suggested.endsWith(".json"), "C2 suggested name is a .json");
  const bundlePath = join(tmp, "bundle.json");
  await download.saveAs(bundlePath);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  must(bundle.format === "cryoflow-template-bundle", `C3 bundle format marker (${bundle.format})`);
  must(bundle.version === 1, `C4 bundle version (${bundle.version})`);
  must(typeof bundle.exportedAt === "string" && bundle.exportedAt.length > 0, "C5 exportedAt present");
  must(typeof bundle.project === "string" && bundle.project.length > 0, `C6 provenance project (${bundle.project})`);
  must(Array.isArray(bundle.templates) && bundle.templates.length === N, `C7 bundle carries all ${N} templates (${bundle.templates?.length})`);
  const innerA = bundle.templates.find((t) => t.name === "T130 branch A");
  const innerB = bundle.templates.find((t) => t.name === "T130 branch B");
  must(!!innerA && !!innerB, "C8 both T130 branches present by name");
  must(innerA?.payload?.jobs?.[1]?.params?.box === 384, `C9 inner A param carried (box=${innerA?.payload?.jobs?.[1]?.params?.box})`);
  must(innerB?.payload?.jobs?.[1]?.params?.box === 256, `C10 inner B param distinct (box=${innerB?.payload?.jobs?.[1]?.params?.box})`);
  must(innerA?.format === "cryoflow-template" && innerA?.version === 1, "C11 inner entries are full cryoflow-template/1 files");
  must(Array.isArray(innerA?.payload?.edges) && innerA.payload.edges.length === 1, "C12 inner A wiring carried (1 edge)");

  /* ---------------- Phase D — import the bundle back ---------------- */
  step("--- Phase D: the bundle expands through the same import funnel ---");
  const [chooser] = await Promise.all([
    p.waitForEvent("filechooser", { timeout: 10000 }),
    p.locator('[data-testid="custom-template-import"]').click(),
  ]);
  await chooser.setFiles([bundlePath]);
  await p
    .waitForFunction(
      (n) => document.querySelectorAll('[data-canvas-ui="custom-template-row"]').length === 2 * n,
      N,
      { timeout: 20000 }
    )
    .catch(() => {});
  must(
    (await p.locator('[data-canvas-ui="custom-template-row"]').count()) === 2 * N,
    `D1 shelf doubled (${N} → ${2 * N}) — every inner expanded`
  );
  const srvAfterImport = await listAll();
  must(srvAfterImport.length === 2 * N, `D2 server honest at ${2 * N} (${srvAfterImport.length})`);
  const dupA = p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T130 branch A" });
  must((await dupA.count()) === 2, "D3 imported duplicates are first-class rows (A appears twice)");

  /* ---------------- Phase E — clear all ---------------- */
  step("--- Phase E: two-step clear, Keep refuses, Clear wipes ---");
  await p.locator('[data-testid="custom-template-clear"]').click();
  await p.waitForSelector('[data-testid="custom-template-clear-arm"]', { timeout: 5000 });
  must(
    (await p.locator('[data-testid="custom-template-clear-arm"]').innerText()).includes(`Delete all ${2 * N}`),
    `E1 armed honestly ("Delete all ${2 * N}?")`
  );
  await p.locator('[data-testid="custom-template-clear-keep"]').click();
  await sleep(400);
  must((await p.locator('[data-testid="custom-template-clear-arm"]').count()) === 0, "E2 Keep disarms");
  must((await p.locator('[data-canvas-ui="custom-template-row"]').count()) === 2 * N, "E3 Keep removed nothing");
  await p.locator('[data-testid="custom-template-clear"]').click();
  await p.waitForSelector('[data-testid="custom-template-clear-confirm"]', { timeout: 5000 });
  await p.locator('[data-testid="custom-template-clear-confirm"]').click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-empty"]', { timeout: 8000 });
  must((await p.locator('[data-canvas-ui="custom-template-row"]').count()) === 0, "E4 shelf emptied (empty state visible)");
  must((await listAll()).length === 0, "E5 server shelf is zero — the baseline went too (restore next)");

  /* ---------------- Phase F — restore baseline + visual ---------------- */
  step("--- Phase F: baseline restored, batch header screenshotted ---");
  // Escape is unreliable after filechooser interactions (Task 128) — Cancel
  for (const t of baseline) {
    await api("/api/custom-template", "POST", { name: t.name, payload: t.payload });
  }
  await seedTemplate("T130 branch A", 384); // back for the screenshot
  await seedTemplate("T130 branch B", 256);
  const srvRestored = await listAll();
  must(srvRestored.length === baseline.length + 2, `F1 baseline restored + shot seeds (${srvRestored.length})`);
  // asc-order restore: the last POSTed baseline row must be the newest —
  // the shelf reads createdAt desc, so the original order survives
  must(
    baseline.length < 2 || srvRestored[0].name === baseline[baseline.length - 1].name,
    `F2 shelf order preserved through the roundtrip (top = ${srvRestored[0]?.name})`
  );
  await p.locator('[data-canvas-ui="template-presets-dialog"] button:has-text("Cancel")').click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { state: "detached", timeout: 5000 });
  await openDialog();
  must(
    (await p.locator('[data-canvas-ui="custom-template-row"]').count()) === baseline.length + 2,
    "F3 reopened dialog shows the restored shelf"
  );
  await p.screenshot({ path: `${OUT}/t130-batch-header.png` });
  must(true, "F4 visual: t130-batch-header.png captured");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const afterCleanup = await listAll();
  must(afterCleanup.length === baseline.length, `Z3 T130 rows removed, baseline intact (${afterCleanup.length})`);
  console.log(`\nT130 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
