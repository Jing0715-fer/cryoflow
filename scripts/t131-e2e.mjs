// t131 — Task 131: template shelf SHAPE PREVIEW (hover card):
//
//   hover    — hovering a shelf row's name/meta area opens a hover card
//              that renders the template payload as a miniature canvas:
//              chips in spec colors at (dx,dy)·s, edges as port-kind
//              colored beziers over the same fine dot grid
//   lazy     — the list endpoint carries no payload, so the FIRST hover
//              fetches GET ?id= and a module-level cache keeps every
//              later hover instant (cache outlives the dialog)
//   inert    — the trigger wraps the name block only; Apply/Download/
//              Delete stay outside it, hover-to-peek swallows no clicks
//
// Phase S — pre-clean T131 orphans, snapshot the baseline shelf, seed a
//           3-job chain (MotionCorr → CTFFind → Extract, dy-jogged) and
//           a 1-job solo (no edges).
// Phase B — hover the chain row: card appears, 3 labeled chips, 2 edges,
//           footer hint present.
// Phase C — geometry reads the shape: chip x strictly increasing, the
//           dy-jog shows as a top offset, edge stroke is the SOURCE port
//           kind's hex (micrographs → teal).
// Phase D — pointer leaves → card closes; hovering the solo row shows
//           one chip and zero edges.
// Phase E — the cache is real: repeated hovers fire ZERO extra GETs.
// Phase F — screenshot the open preview.
// Phase Z — console clean, T131 rows removed (baseline STAYS).
//
// Run: node scripts/t131-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t131-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const tmp = mkdtempSync(join(tmpdir(), "t131-"));

let baseline = [];
let idFetches = 0; // GET /api/custom-template?id= responses seen

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const listAll = async () =>
  (await (await api("/api/custom-template?all=1")).json())?.templates ?? [];

async function deleteT131Rows() {
  try {
    const all = await listAll();
    for (const t of all) {
      if ((t.name ?? "").startsWith("T131")) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
  } catch {}
}

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  await deleteT131Rows();
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

/** POST the T131 3-job chain; returns the seeded template. */
const seedChain = async () => {
  const res = await (await api("/api/custom-template", "POST", {
    name: "T131 chain",
    payload: {
      jobs: [
        { type: "motioncorr", dx: 0, dy: 0, params: {} },
        { type: "ctffind", dx: 300, dy: 40, params: {} },
        { type: "extract", dx: 600, dy: 0, params: { boxSize: 128 } },
      ],
      edges: [
        { from: 0, to: 1, fromPort: "micrographs", toPort: "micrographs" },
        { from: 1, to: 2, fromPort: "micrographs", toPort: "micrographs" },
      ],
    },
  })).json();
  must(!!res?.template?.id, "T131 chain: seeded (3 jobs · 2 wires)");
  return res.template;
};

/** POST the T131 single-node template (no edges). */
const seedSolo = async () => {
  const res = await (await api("/api/custom-template", "POST", {
    name: "T131 solo",
    payload: {
      jobs: [{ type: "import", dx: 0, dy: 0, params: {} }],
      edges: [],
    },
  })).json();
  must(!!res?.template?.id, "T131 solo: seeded (1 job · 0 wires)");
  return res.template;
};

/** hover a row's name zone; row picked by name via hasText filter */
const hoverRow = async (name) => {
  const row = p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: name });
  await row.locator('[data-testid="custom-template-hover-zone"]').hover();
  await sleep(900); // openDelay 350 + lazy fetch + render
};

const closeHover = async () => {
  await p.mouse.move(720, 140); // over the dialog header — off every trigger
  await sleep(450); // closeDelay 120 + unmount
};

async function main() {
  step("=== t131 — template shelf shape preview (hover card) ===");

  /* ---------------- Phase S — baseline + seed ---------------- */
  step("--- Phase S: baseline snapshot + T131 chain/solo ---");
  await deleteT131Rows(); // a KILLED previous run must not poison this one
  baseline = await listAll();
  must(Array.isArray(baseline), `baseline shelf snapshotted via GET ?all=1 (${baseline.length} rows)`);
  await seedChain();
  await seedSolo();
  const afterSeed = await listAll();
  must(afterSeed.length === baseline.length + 2, `S1 server shelf = baseline + 2 (${afterSeed.length})`);

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.url().includes("/api/custom-template?id=")) idFetches++; });

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

  /* ---------------- Phase B — hover opens the shape card ---------------- */
  step("--- Phase B: hovering the chain row renders its shape ---");
  await openDialog();
  must(idFetches === 0, "B0 no ?id= fetches before any hover (list stays light)");
  await hoverRow("T131 chain");
  await p.waitForSelector('[data-testid="template-shape-preview"]', { timeout: 5000 });
  must(true, "B1 hover card opened");
  must(idFetches === 1, `B2 first hover fetched the payload exactly once (${idFetches})`);
  const nodeLabels = await p.locator('[data-testid="template-preview-node"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-node-label"))
  );
  must(
    JSON.stringify(nodeLabels) ===
      JSON.stringify(["Motion Correction", "CTF Estimation", "Particle Extraction"]),
    `B3 three chips in payload order (${nodeLabels.join(" | ")})`
  );
  must((await p.locator('[data-testid="template-preview-edge"]').count()) === 2, "B4 two edge paths drawn");
  must((await p.locator('[data-testid="template-preview-diagram"]').count()) === 1, "B5 diagram box present");
  const footer = await p.locator('[data-testid="template-shape-preview"]').innerText();
  must(footer.includes("Apply drops this shape below"), "B6 footer hint present");

  /* ---------------- Phase C — geometry reads the shape ---------------- */
  step("--- Phase C: the miniature reads left-to-right, port-colored ---");
  const boxes = await p.locator('[data-testid="template-preview-node"]').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
  );
  must(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x, `C1 chips ordered left-to-right (${boxes.map((b) => Math.round(b.x)).join(" < ")})`);
  must(boxes[1].y > boxes[0].y, `C2 dy=40 jog reads as a top offset (+${Math.round(boxes[1].y - boxes[0].y)}px)`);
  must(boxes[0].w < 220, `C3 chips are scaled down, not canvas-sized (${Math.round(boxes[0].w)}px wide)`);
  const strokes = await p.locator('[data-testid="template-preview-edge"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("stroke"))
  );
  must(
    strokes.length === 2 && strokes.every((s) => s === "#14b8a6"),
    `C4 edges stroked with the micrographs port color (${strokes.join(", ")})`
  );

  /* ---------------- Phase D — close + solo row ---------------- */
  step("--- Phase D: pointer leaves → card closes; solo row previews too ---");
  await closeHover();
  await p.waitForSelector('[data-testid="template-shape-preview"]', { state: "detached", timeout: 5000 });
  must(true, "D1 card closed when the pointer left");
  await hoverRow("T131 solo");
  await p.waitForSelector('[data-testid="template-shape-preview"]', { timeout: 5000 });
  must((await p.locator('[data-testid="template-preview-node"]').count()) === 1, "D2 solo renders one chip");
  must((await p.locator('[data-testid="template-preview-edge"]').count()) === 0, "D3 solo draws zero edges");
  must(
    (await p.locator('[data-testid="template-preview-node"]').first().getAttribute("data-node-label")) ===
      "Import Movies / Micrographs",
    "D4 solo chip labeled with its spec label"
  );

  /* ---------------- Phase E — the cache is real ---------------- */
  step("--- Phase E: cached hover fires zero extra fetches ---");
  const before = idFetches;
  await closeHover();
  await hoverRow("T131 chain");
  await p.waitForSelector('[data-testid="template-preview-edge"]', { timeout: 5000 });
  await closeHover();
  await hoverRow("T131 chain");
  await p.waitForSelector('[data-testid="template-preview-edge"]', { timeout: 5000 });
  must(idFetches === before, `E1 two re-hovers, zero new ?id= fetches (${idFetches} total, was ${before})`);
  must(
    (await p.locator('[data-testid="template-preview-node"]').count()) === 3,
    "E2 cached render still complete (3 chips)"
  );

  /* ---------------- Phase F — visual ---------------- */
  step("--- Phase F: screenshot the open preview ---");
  await p.screenshot({ path: `${OUT}/t131-shape-preview.png` });
  must(true, "F1 visual: t131-shape-preview.png captured");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const afterCleanup = await listAll();
  must(afterCleanup.length === baseline.length, `Z3 T131 rows removed, baseline intact (${afterCleanup.length})`);
  console.log(`\nT131 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
