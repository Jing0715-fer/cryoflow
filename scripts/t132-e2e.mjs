// t132 — Task 132: template shelf ORGANIZATION (inline rename + search):
//
//   rename  — PATCH ?id= {name}: the row's ONE editable field. Enter
//             commits, Escape cancels, blur cancels; empty/unchanged
//             edits cancel quietly; the server's trimmed name lands in
//             the shelf and createdAt (the reading order) never moves
//   search  — a name filter that exists only when there is something to
//             search (N >= 5): case-insensitive substring, honest
//             "k of N" counter, one-click clear, honest no-match state
//
// Phase S — pre-clean T132 orphans, snapshot the baseline shelf, seed
//           FIVE named templates (alpha..epsilon) to cross the search
//           threshold with the empty dev baseline.
// Phase B — search box present at N>=5; "alpha" filters to 1 row with an
//           honest "1 of 5"; "ALPHA" matches case-insensitively; "zzz"
//           shows the no-match state; X clears back to 5.
// Phase C — rename: pencil opens an inline input pre-filled and focused;
//           Enter commits → row + server carry the new name; Escape
//           cancels; empty Enter cancels quietly (name unchanged).
// Phase D — rename under an active filter: row updates in place and
//           stays visible when the new name still matches the query.
// Phase E — the renamed name flows into the hover shape preview header.
// Phase F — screenshot (filter active + renamed row).
// Phase Z — console clean, T132 rows removed (baseline STAYS).
//
// Run: node scripts/t132-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t132-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const tmp = mkdtempSync(join(tmpdir(), "t132-"));

let baseline = [];
const t132Ids = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const listAll = async () =>
  (await (await api("/api/custom-template?all=1")).json())?.templates ?? [];

async function deleteT132Rows() {
  try {
    const all = await listAll();
    for (const t of all) {
      // renamed rows escape the T132 prefix (C3 renames one to "T32 …") —
      // the tracked id list is the authoritative cleanup net
      if ((t.name ?? "").startsWith("T132") || (t.name ?? "").startsWith("T32 ") || t132Ids.includes(t.id)) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
  } catch {}
}

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  await deleteT132Rows();
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

/** POST a tiny named template; records its id for cleanup. */
const seed = async (name, box) => {
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
  t132Ids.push(res.template.id);
  return res.template;
};

async function main() {
  step("=== t132 — template shelf organization (rename + search) ===");

  /* ---------------- Phase S — baseline + seed ---------------- */
  step("--- Phase S: baseline snapshot + five T132 seeds ---");
  await deleteT132Rows(); // a KILLED previous run must not poison this one
  baseline = await listAll();
  must(Array.isArray(baseline), `baseline shelf snapshotted via GET ?all=1 (${baseline.length} rows)`);
  await seed("T132 alpha", 384);
  await seed("T132 beta", 320);
  await seed("T132 gamma", 256);
  await seed("T132 delta", 192);
  await seed("T132 epsilon", 128);
  const N = baseline.length + 5;
  const afterSeed = await listAll();
  must(afterSeed.length === N, `S1 server shelf = baseline + 5 (${afterSeed.length})`);

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

  /* ---------------- Phase B — search filters honestly ---------------- */
  step("--- Phase B: the filter exists at N>=5 and counts honestly ---");
  await openDialog();
  const searchBox = p.locator('[data-testid="custom-template-search"]');
  must((await searchBox.count()) === 1, `B1 search box present at ${N} rows (threshold 5)`);
  const rowCount = await p.locator('[data-canvas-ui="custom-template-row"]').count();
  must(rowCount === N, `B2 all ${N} rows listed unfiltered (${rowCount})`);
  await searchBox.fill("alpha");
  await sleep(300);
  must((await p.locator('[data-canvas-ui="custom-template-row"]').count()) === 1, "B3 'alpha' filters to 1 row");
  must(
    (await p.locator('[data-testid="custom-template-search-count"]').innerText()).replace(/\s+/g, " ") ===
      `1 of ${N}`,
    `B4 honest counter ("1 of ${N}")`
  );
  await searchBox.fill("ALPHA");
  await sleep(300);
  must((await p.locator('[data-canvas-ui="custom-template-row"]').count()) === 1, "B5 filter is case-insensitive");
  await searchBox.fill("zzz-nothing");
  await sleep(300);
  must((await p.locator('[data-canvas-ui="custom-templates-no-match"]').count()) === 1, "B6 no-match state honest");
  await p.locator('[data-testid="custom-template-search-clear"]').click();
  await sleep(300);
  must((await p.locator('[data-canvas-ui="custom-template-row"]').count()) === N, `B7 X clears back to ${N} rows`);

  /* ---------------- Phase C — rename flows ---------------- */
  step("--- Phase C: inline rename — commit, cancel, empty-noop ---");
  const oldAlpha = () => p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T132 alpha" });
  const newAlpha = () => p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T32 alpha renamed" });
  await oldAlpha().hover();
  await sleep(250);
  await oldAlpha().locator('[data-testid="custom-template-rename"]').click();
  const input = p.locator('[data-testid="custom-template-rename-input"]');
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { timeout: 5000 });
  must((await input.inputValue()) === "T132 alpha", "C1 edit input pre-filled with the current name");
  const focused = await input.evaluate((el) => el === document.activeElement);
  must(focused, "C2 edit input is focused (autofocus)");
  await input.fill("T32 alpha renamed");
  await input.press("Enter");
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { state: "detached", timeout: 5000 });
  await sleep(500);
  must((await newAlpha().count()) === 1, "C3 renamed row visible under its NEW name");
  must((await oldAlpha().count()) === 0, "C3b the old name is gone from the shelf");
  const srvRename = await listAll();
  const srvAlpha = srvRename.find((t) => t.id === t132Ids[0]);
  must(srvAlpha?.name === "T32 alpha renamed", `C4 server carries the new name (${srvAlpha?.name})`);
  const srvOrder = srvRename.map((t) => t.id);
  must(
    // ?all=1 serves createdAt ASC (oldest first) — alpha must still open
    // the list and epsilon close it, i.e. rename moved nothing
    srvOrder[0] === t132Ids[0] && srvOrder[4] === t132Ids[4],
    "C5 reading order never moved (createdAt untouched by rename, asc endpoint)"
  );

  // Escape leg — a started edit walks away with no change
  const betaRow = () => p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T132 beta" });
  await betaRow().hover();
  await sleep(250);
  await betaRow().locator('[data-testid="custom-template-rename"]').click();
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { timeout: 5000 });
  await p.locator('[data-testid="custom-template-rename-input"]').fill("T132 beta EDITED");
  await p.locator('[data-testid="custom-template-rename-input"]').press("Escape");
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { state: "detached", timeout: 5000 });
  await sleep(400);
  must(
    (await listAll()).find((t) => t.id === t132Ids[1])?.name === "T132 beta",
    "C6 Escape cancels — server name unchanged"
  );

  // empty leg — Enter on an empty input is a quiet no-op (no toast noise)
  const gammaRow = () => p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T132 gamma" });
  await gammaRow().hover();
  await sleep(250);
  await gammaRow().locator('[data-testid="custom-template-rename"]').click();
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { timeout: 5000 });
  await p.locator('[data-testid="custom-template-rename-input"]').fill("   ");
  await p.locator('[data-testid="custom-template-rename-input"]').press("Enter");
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { state: "detached", timeout: 5000 });
  await sleep(400);
  must(
    (await listAll()).find((t) => t.id === t132Ids[2])?.name === "T132 gamma",
    "C7 whitespace-only Enter cancels quietly — server name unchanged"
  );

  /* ---------------- Phase D — rename under an active filter ---------------- */
  step("--- Phase D: rename while filtered — the row stays in view ---");
  await searchBox.fill("gamma");
  await sleep(300);
  must((await p.locator('[data-canvas-ui="custom-template-row"]').count()) === 1, "D1 filtered to the gamma row");
  await gammaRow().hover();
  await sleep(250);
  await gammaRow().locator('[data-testid="custom-template-rename"]').click();
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { timeout: 5000 });
  await p.locator('[data-testid="custom-template-rename-input"]').fill("T132 gamma noble");
  await p.locator('[data-testid="custom-template-rename-input"]').press("Enter");
  await p.waitForSelector('[data-testid="custom-template-rename-input"]', { state: "detached", timeout: 5000 });
  await sleep(500);
  must(
    (await p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T132 gamma noble" }).count()) === 1,
    "D2 renamed in place and still visible under the matching filter"
  );
  must((await listAll()).find((t) => t.id === t132Ids[2])?.name === "T132 gamma noble", "D3 server honest after filtered rename");
  await p.locator('[data-testid="custom-template-search-clear"]').click();
  await sleep(300);

  /* ---------------- Phase E — preview header follows the name ---------------- */
  step("--- Phase E: the shape preview reads the NEW name ---");
  await p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T32 alpha renamed" }).hover();
  await sleep(900);
  const previewHead = p.locator('[data-testid="template-shape-preview"]');
  await previewHead.waitFor({ timeout: 5000 });
  must(
    (await previewHead.innerText()).includes("T32 alpha renamed"),
    "E1 preview card header carries the renamed name"
  );

  /* ---------------- Phase F — visual ---------------- */
  step("--- Phase F: screenshot (filter active + renamed rows) ---");
  await p.locator('[data-testid="custom-template-search"]').fill("T132");
  await sleep(300);
  await p.mouse.move(720, 140);
  await sleep(300);
  await p.screenshot({ path: `${OUT}/t132-organize.png` });
  must(true, "F1 visual: t132-organize.png captured");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const afterCleanup = await listAll();
  must(afterCleanup.length === baseline.length, `Z3 T132 rows removed, baseline intact (${afterCleanup.length})`);
  console.log(`\nT132 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
