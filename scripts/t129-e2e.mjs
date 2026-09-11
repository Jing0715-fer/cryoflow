// t129 — Task 129: post-apply connection suggestions. An applied
// template lands as a wired island BELOW the workspace's content; the
// chip (bottom-center) proposes the wires to its new neighbors and
// wires ONLY on an explicit Connect:
//
//   apply → chip lists boundary-input × free-donor pairs explicitly →
//   rows toggle inclusion → Connect POSTs /api/edges (the manual drag's
//   endpoint) → dismiss/navigation/vanished-endpoints clear silently
//
// Phase S — seed: one donor (import, free micrographs output) in ws1 +
//           template "T129 branch" (motioncorr→ctffind internal wire)
//           + empty destination workspace.
// Phase B — apply in ws1 → chip appears with exactly 1 pair
//           (import→motioncorr, micrographs→movies); row toggles
//           exclude/include (Connect reflects the count, disabled at 0).
// Phase C — Connect → chip gone, DB edge exists with exact ports.
// Phase D — apply again → the only new viable pair is the vertical
//           ctffind→ctffind chain link (import's output is busy now);
//           dismiss X → chip gone, NO edge created.
// Phase E — switch to the EMPTY destination → apply → no chip (no
//           donors in empty space); switch back → no chip (navigation
//           cleared the store).
// Phase Z — cleanup + console clean.
//
// Run: node scripts/t129-e2e.mjs   (server on :3000, fresh build REQUIRED)
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
/** Job ids present BEFORE this probe touches anything — Phase Z deletes
 *  every ws1 job NOT in this set: the APPLIED template batches (RELION-
 *  numbered, nobody else's cleanup owns them) used to leak and each run
 *  grew the world bbox until fixed-zoom suites broke (t87/t88 forensics). */
let baselineJobIds = new Set();

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededJobIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
  // baseline restore: any job this probe's APPLIES minted (the batches are
  // RELION-numbered, not T129-prefixed) — swept so the demo world's bbox
  // stays exactly as we found it
  try {
    const now = ((await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? []).map((j) => j.id);
    for (const id of now) {
      if (!baselineJobIds.has(id) && !seededJobIds.includes(id)) {
        await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }).catch(() => {});
      }
    }
  } catch {}
  for (const id of seededWsIds) {
    try { await fetch(`${BASE}/api/workspaces/${id}`, { method: "DELETE" }); } catch {}
  }
  try {
    const list = await (await fetch(`${BASE}/api/custom-template`)).json();
    for (const t of list.templates ?? []) {
      if ((t.name ?? "").startsWith("T129")) {
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
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

/** open the presets dialog via the palette (the shelf refreshes on open) */
async function openPresets() {
  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { timeout: 5000 });
}
async function applyFromShelf() {
  const row = p
    .locator('[data-canvas-ui="custom-template-row"]')
    .filter({ hasText: "T129 branch" });
  await row.locator('[data-testid="custom-template-apply"]').click();
  await sleep(900);
  // the deterministic close path (Task 128's lesson: Escape after an
  // action that re-renders the canvas is unreliable — Cancel always lands)
  await p.locator('[data-canvas-ui="template-presets-dialog"] button:has-text("Cancel")').click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { state: "detached", timeout: 5000 });
  await sleep(400);
}

async function main() {
  step("=== t129 — post-apply connection suggestions ===");

  /* ---------------- Phase S — seed ---------------- */
  step("--- Phase S: donor + branch template + empty destination ---");
  try {
    const pre = await (await fetch(`${BASE}/api/custom-template`)).json();
    for (const t of pre.templates ?? []) {
      if ((t.name ?? "").startsWith("T129")) {
        await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
      }
    }
    const preWs = (await (await fetch(`${BASE}/api/workspaces`)).json()).workspaces ?? [];
    for (const w of preWs) {
      if ((w.name ?? "").startsWith("T129")) {
        await fetch(`${BASE}/api/workspaces/${w.id}`, { method: "DELETE" });
      }
    }
    const preJobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
    for (const j of preJobs) {
      if ((j.name ?? "").startsWith("T129")) {
        await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" });
      }
    }
    // baseline AFTER pre-clean, BEFORE seeding (t87's Z-restores-to pattern)
    baselineJobIds = new Set(preJobs.map((j) => j.id));
  } catch {}
  const proj = (await (await api("/api/project")).json()).project;
  must(!!proj?.id, "an active project exists");
  const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(wsList.length >= 1, "the active project has at least one workspace");
  const ws1Id = wsList[0].id;

  const donor = await (await api("/api/jobs", "POST", {
    type: "import", workspaceId: ws1Id, x: 140, y: 300,
  })).json();
  const donorJob = donor?.job ?? donor;
  must(!!donorJob?.id, "donor import job seeded in ws1");
  seededJobIds.push(donorJob.id);

  const tpl = await (await api("/api/custom-template", "POST", {
    name: "T129 branch",
    payload: {
      jobs: [
        { type: "motioncorr", dx: 0, dy: 0, params: {} },
        { type: "ctffind", dx: 300, dy: 0, params: {} },
      ],
      edges: [{ from: 0, to: 1, fromPort: "micrographs", toPort: "micrographs" }],
    },
  })).json();
  must(!!tpl?.template?.id, "branch template saved (motioncorr→ctffind)");

  const dest = await (await api("/api/workspaces", "POST", { name: "T129 dest" })).json();
  const ws2Id = dest?.workspace?.id ?? dest?.id ?? null;
  must(!!ws2Id, "empty destination workspace created");
  seededWsIds.push(ws2Id);

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase B — apply → chip ---------------- */
  step("--- Phase B: apply lands the island, chip proposes the wire ---");
  await openPresets();
  await applyFromShelf();
  await p.waitForSelector('[data-canvas-ui="template-suggestions"]', { timeout: 8000 });
  must(true, "B1 chip appears after apply");
  const rows = p.locator('[data-testid="template-suggestion-row"]');
  must((await rows.count()) === 1, `B2 exactly one suggestion — the internal wire already feeds ctffind (${await rows.count()})`);
  const rowText = await rows.first().innerText();
  must(/micrographs/.test(rowText) && /movies/.test(rowText), `B3 pair names the ports (${rowText.replace(/\n/g, " ")})`);
  must(/Motion Correction/.test(rowText), "B4 boundary side is the applied motioncorr (donor is whichever free compatible output is nearest)");
  // donor-agnostic precision: the row's key carries the exact id pair
  const sugKey = (await rows.first().getAttribute("data-suggestion-key")) ?? "";
  const [sugFrom, sugTo] = sugKey.split(">");
  must(!!sugFrom && !!sugTo && sugTo !== donorJob.id, `B5 row key carries the id pair (${sugKey})`);
  const connectBtn = p.locator('[data-testid="template-suggestions-connect"]');
  must((await connectBtn.innerText()).trim() === "Connect 1", `B6 button counts inclusion (${(await connectBtn.innerText()).trim()})`);

  await rows.first().click(); // exclude
  await sleep(250);
  must((await rows.first().getAttribute("aria-pressed")) === "false", "B7 row click excludes (aria-pressed=false)");
  must((await connectBtn.innerText()).trim() === "Connect 0 of 1", "B8 button reflects the exclusion");
  must(await connectBtn.isDisabled(), "B9 Connect disabled at zero inclusion");

  await rows.first().click(); // include again
  await sleep(250);
  must((await rows.first().getAttribute("aria-pressed")) === "true", "B10 row click re-includes");
  must(!(await connectBtn.isDisabled()), "B11 Connect re-enabled");

  /* ---------------- Phase C — connect ---------------- */
  step("--- Phase C: Connect wires the pair ---");
  await connectBtn.click();
  await p.waitForSelector('[data-canvas-ui="template-suggestions"]', { state: "detached", timeout: 8000 });
  must(true, "C1 chip retires after Connect");
  const batch1 = ((await (await api("/api/jobs")).json()).jobs ?? []).filter(
    (j) => j.workspaceId === ws1Id && j.type === "motioncorr"
  );
  const m1 = batch1.find((j) => j.id === sugTo);
  must(!!m1, "C2 the suggested boundary job exists");
  const allEdges = (await (await api("/api/edges")).json()).edges ?? [];
  const wired = allEdges.find(
    (e) => e.fromJobId === sugFrom && e.toJobId === sugTo
  );
  must(!!wired, "C3 DB edge donor→motioncorr exists (exact ids from the row key)");
  must(wired?.fromPort === "micrographs" && wired?.toPort === "movies", `C4 ports exact (${wired?.fromPort}→${wired?.toPort})`);

  /* ---------------- Phase D — second apply: dismiss kills it ---------- */
  step("--- Phase D: second apply proposes again; dismiss wires nothing ---");
  await openPresets();
  await applyFromShelf();
  await p.waitForSelector('[data-canvas-ui="template-suggestions"]', { timeout: 8000 });
  const rows2 = p.locator('[data-testid="template-suggestion-row"]');
  must((await rows2.count()) >= 1, `D1 second batch gets a suggestion (${await rows2.count()} rows)`);
  const before = ((await (await api("/api/edges")).json()).edges ?? []).length;
  await p.locator('[data-testid="template-suggestions-dismiss"]').click();
  await p.waitForSelector('[data-canvas-ui="template-suggestions"]', { state: "detached", timeout: 5000 });
  must(true, "D2 dismiss retires the chip");
  await sleep(600);
  const after = ((await (await api("/api/edges")).json()).edges ?? []).length;
  must(after === before, `D3 dismiss created NO edge (${before} → ${after})`);

  /* ---------------- Phase E — empty space + navigation ---------------- */
  step("--- Phase E: empty workspace gets no chip; navigation clears ---");
  await p.locator('button[role="tab"]:has-text("Workspaces")').click();
  await sleep(350);
  await p.locator(`[role="button"][title="Switch the canvas to T129 dest"]`).click();
  await sleep(700);
  must((await p.locator("[data-job]").count()) === 0, "E0 destination canvas is empty");
  await openPresets();
  await applyFromShelf();
  await sleep(800);
  must(
    (await p.locator('[data-canvas-ui="template-suggestions"]').count()) === 0,
    "E1 no chip in an empty workspace (no donors exist)"
  );
  must(
    ((await (await api("/api/jobs")).json()).jobs ?? []).filter((j) => j.workspaceId === ws2Id).length === 2,
    "E2 the batch itself landed (2 jobs)"
  );

  await p.locator('button[role="tab"]:has-text("Workspaces")').click();
  await sleep(350);
  // back to ws1 (first row of the Workspaces tab)
  await p.locator('[role="button"][title^="Switch the canvas to"]').first().click();
  await sleep(700);
  must(
    (await p.locator('[data-canvas-ui="template-suggestions"]').count()) === 0,
    "E3 navigation cleared the suggestion state (no stale chip)"
  );

  /* ---------------- Phase Z — cleanup + console ---------------- */
  step("--- Phase Z: cleanup + console ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  console.log(`\nT129 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
