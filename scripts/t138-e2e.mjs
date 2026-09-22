// t138 — Task 138: the find lens grows its TYPE half — palette workflow
// stages as chips:
//
//   stage   — a third chip row under the find bar surfaces the palette's
//             own categories (RELION job-browser tree) actually PRESENT
//             in the workspace; a stage that doesn't exist can't be a
//             filter, and a single-category workspace hides the row
//   radio   — one active stage at a time, clicking it again clears
//             (the status chips' semantics, reused verbatim)
//   triple  — text ∧ status ∧ stage are ORTHOGONAL: they narrow each
//             other through the ONE exported jobMatchesFind predicate;
//             bar count, card rings, and minimap amber all stay set-equal
//             to the API oracle — three eyes, still one truth
//   honest  — a lens armed to zero hits says "no matches"; closing the
//             bar forgets the query, the status, AND the stage
//
// Phase S — pre-clean T138 rows, snapshot the roster, seed 6 jobs across
//           5 stages × 4 statuses (prisma stamps, fresh startedAt for the
//           running pair), verify via the API.
// Phase B — the bare lens: type row renders with EXACTLY the roster's
//           present categories (palette order), none armed; "T138" reads
//           6 matches.
// Phase C — Motion chip: count/card-ring/minimap amber == live ∩ motion
//           oracle; count reads 2.
// Phase D — orthogonality: motion+running → 1 (Epsilon); clear running →
//           2; text "Alpha" + motion → 1.
// Phase E — radio: CTF replaces Motion → Beta only; re-click clears → 6.
// Phase F — honest zero (motion + "zzqq" → "no matches"); Esc forgets
//           everything; reopening shows no armed chip.
// Phase G — screenshot the armed triple lens.
// Phase Z — console clean, T138 rows deleted, roster restored.
//
// Run: node scripts/t138-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { rmSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t138-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededIds = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

/** the category key a job's type belongs to — extracted verbatim from
 *  the app's own JOB_TYPES spec (spec(...) → category:), so the probe's
 *  oracle can never drift from the product's mapping */
const CATEGORY_OF = {
  import: "import", motioncorr: "motion", ctffind: "ctf",
  manualpick: "picking", topaztrain: "picking", autopick: "picking",
  extract: "extract", subtract: "extract",
  select: "select", joinstar: "select",
  class2d: "class2d", select2d: "class2d",
  initialmodel: "class3d", class3d: "class3d",
  refine3d: "refine", multibody: "refine",
  symexpand: "orientation", rebalance: "orientation",
  maskcreate: "postprocess", postprocess: "postprocess", localres: "postprocess",
  polish: "polish", ctfrefine: "polish",
  dynamight: "external", modelangelo: "external", external: "external",
  tomo_import: "tomo", tomo_aligntiltseries: "tomo", tomo_tomograms: "tomo",
  tomo_ctfrefine: "tomo", tomo_exclude: "tomo", tomo_polish: "tomo",
  tomo_reconstruct: "tomo", tomo_denoise: "tomo", tomo_picks: "tomo",
  tomo_extract: "tomo",
};

const stamp = (id, status) => {
  const data =
    status === "running"
      ? `status:"${status}",startedAt:new Date().toISOString()`
      : `status:"${status}"`;
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:{${data}}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
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

const countText = async () =>
  (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim();

const mmFindIds = async () =>
  p.locator('[data-canvas-ui="minimap-dot"][data-mm-find="1"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job-id"))
  );

const cardRingIds = async () =>
  p.locator('[data-job][data-find-match="true"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );

const typeChip = (key) => p.locator(`[data-testid="canvas-find-type-${key}"]`);
const statusChip = (value) => p.locator(`[data-testid="canvas-find-status-${value}"]`);

async function main() {
  step("=== t138 — the type half: palette stages as find chips ===");

  /* ---------------- Phase S — baseline + seeded stage matrix ---------------- */
  step("--- Phase S: roster snapshot + T138 stage matrix ---");
  const pre = await roster();
  for (const j of pre.filter((j) => (j.name ?? "").startsWith("T138"))) {
    await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" }).catch(() => {});
  }
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const seeds = [
    ["T138 Alpha", "motioncorr", "completed"], // motion
    ["T138 Beta", "ctffind", "failed"], // ctf
    ["T138 Gamma", "refine3d", "running"], // refine
    ["T138 Delta", "import", null], // import
    ["T138 Epsilon", "motioncorr", "running"], // motion
    ["T138 Zeta", "postprocess", "completed"], // postprocess
  ];
  const seedIds = {};
  let y = maxY + 240;
  for (const [name, type, status] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type}${status ? ` → ${status}` : ", idle"})`);
    seedIds[name] = j.id;
    seededIds.push(j.id);
    if (status) stamp(j.id, status);
    y += 240;
  }
  const live = await roster();
  const statusOf = Object.fromEntries(
    live.filter((j) => (j.name ?? "").startsWith("T138")).map((j) => [j.name, j.status]),
  );
  must(
    statusOf["T138 Alpha"] === "completed" &&
      statusOf["T138 Beta"] === "failed" &&
      statusOf["T138 Gamma"] === "running" &&
      statusOf["T138 Delta"] === "idle" &&
      statusOf["T138 Epsilon"] === "running" &&
      statusOf["T138 Zeta"] === "completed",
    `S+ stamps verified via API (${JSON.stringify(statusOf)})`
  );

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await p.waitForSelector('[data-canvas-ui="minimap-dot"]', { timeout: 10000 });
  await sleep(1000);

  // the rendered canvas truth + the present-category oracle
  const onCanvas = new Set(
    await p.locator("[data-job]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job")))
  );
  const presentSet = new Set(
    live.filter((j) => onCanvas.has(j.id)).map((j) => CATEGORY_OF[j.type]).filter(Boolean)
  );
  must(presentSet.size >= 5, `S+ the world spans ${presentSet.size} palette stages (≥5)`);

  /** the oracle: ids of rendered jobs matching name-prefix + category */
  const oracle = async (prefix, category) =>
    live
      .filter((j) => onCanvas.has(j.id) && (j.name ?? "").startsWith(prefix))
      .filter((j) => !category || CATEGORY_OF[j.type] === category)
      .map((j) => j.id)
      .sort();

  /* ---------------- Phase B — the bare lens ---------------- */
  step("--- Phase B: type row renders the present stages, none armed ---");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  must(
    await p.locator('[data-testid="canvas-find-type-row"]').isVisible(),
    "B1 the type row renders (world spans >1 stage)"
  );
  const domChips = await p
    .locator('[data-testid="canvas-find-type-row"] button')
    .evaluateAll((els) => els.map((e) => (e.getAttribute("data-testid") ?? "").replace("canvas-find-type-", "")));
  // palette order is part of the contract: the row reads in the RELION
  // job-browser's own stage order, filtered to what the world contains
  const PALETTE_ORDER = [
    "import", "motion", "ctf", "picking", "extract", "select", "class2d",
    "class3d", "refine", "orientation", "postprocess", "polish", "tomo", "external",
  ];
  const expectedOrder = PALETTE_ORDER.filter((k) => presentSet.has(k));
  must(
    JSON.stringify(domChips) === JSON.stringify(expectedOrder),
    `B2 the chip set == present categories in palette order (${domChips.join(",")})`
  );
  const armedCount = await p
    .locator('[data-testid="canvas-find-type-row"] button[aria-pressed="true"]')
    .count();
  must(armedCount === 0, "B3 no chip armed on a fresh open");
  await p.keyboard.type("T138");
  await sleep(500);
  must((await countText()) === "6 matches", "B4 'T138' reads 6 matches with no stage armed");

  /* ---------------- Phase C — the Motion chip narrows everything ---------------- */
  step("--- Phase C: Motion stage — one predicate, three consumers ---");
  await typeChip("motion").click();
  await sleep(400);
  const expectedMotion = await oracle("T138", "motion");
  must((await countText()) === "2 matches", "C1 the bar reads '2 matches' (Alpha + Epsilon)");
  const uiRingsT138 = (await cardRingIds()).filter((id) => expectedMotion.includes(id)).sort();
  must(
    JSON.stringify(uiRingsT138) === JSON.stringify(expectedMotion),
    "C2 card rings == live ∩ motion oracle"
  );
  const uiAmberT138 = (await mmFindIds()).filter((id) => expectedMotion.includes(id)).sort();
  must(
    JSON.stringify(uiAmberT138) === JSON.stringify(expectedMotion),
    "C3 minimap amber == live ∩ motion oracle"
  );
  const allT138 = Object.values(seedIds);
  const ringsC = await cardRingIds();
  const strayRing = allT138.find((id) => !expectedMotion.includes(id) && ringsC.includes(id));
  must(!strayRing, "C4 no other T138 card rings under the motion lens");

  /* ---------------- Phase D — orthogonality ---------------- */
  step("--- Phase D: stage ∧ status ∧ text narrow each other ---");
  await statusChip("running").click();
  await sleep(400);
  must((await countText()) === "1 match", "D1 motion ∧ running → 1 (Epsilon)");
  const epsOnly = (await cardRingIds()).includes(seedIds["T138 Epsilon"]) &&
    !(await cardRingIds()).includes(seedIds["T138 Alpha"]);
  must(epsOnly, "D2 Epsilon rings, Alpha does not");
  await statusChip("running").click();
  await sleep(400);
  must((await countText()) === "2 matches", "D3 clearing the status restores motion's 2");
  await p.locator('[data-testid="canvas-find-input"]').fill("Alpha");
  await sleep(400);
  must((await countText()) === "1 match", "D4 text 'Alpha' ∧ motion → exactly Alpha");
  const alphaRing = (await cardRingIds()).includes(seedIds["T138 Alpha"]);
  must(alphaRing, "D5 Alpha carries the ring");
  await p.locator('[data-testid="canvas-find-input"]').fill("T138");
  await sleep(400);

  /* ---------------- Phase E — radio semantics ---------------- */
  step("--- Phase E: one stage at a time, re-click clears ---");
  await typeChip("motion").click(); // radio-clear (D left motion armed)
  await sleep(400);
  must((await countText()) === "6 matches", "E1 re-click cleared motion — back to 6");
  await typeChip("ctf").click();
  await sleep(400);
  must((await countText()) === "1 match", "E2 CTF replaces Motion → Beta only");
  must(
    (await typeChip("ctf").getAttribute("aria-pressed")) === "true" &&
      (await typeChip("motion").getAttribute("aria-pressed")) === "false",
    "E3 exactly one stage chip armed"
  );
  await typeChip("ctf").click();
  await sleep(400);
  must((await countText()) === "6 matches", "E4 re-click cleared the stage filter");

  /* ---------------- Phase F — honest zero + forget-on-close ---------------- */
  step("--- Phase F: zero is honest; Esc forgets all three halves ---");
  await typeChip("motion").click();
  await sleep(300);
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Control+a");
  await p.keyboard.type("zzqq");
  await sleep(400);
  must((await countText()) === "no matches", "F1 motion ∧ 'zzqq' reads 'no matches'");
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  must(true, "F2 Esc closed the bar");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  must((await countText()) === "", "F3 reopened bar reads no count (lens disarmed)");
  must(
    (await p.locator('[data-testid="canvas-find-type-row"] button[aria-pressed="true"]').count()) === 0 &&
      (await p.locator('[data-testid="canvas-find-status-row"] button[aria-pressed="true"]').count()) === 0,
    "F4 no stage and no status residue after close/reopen"
  );

  /* ---------------- Phase G — visual ---------------- */
  step("--- Phase G: screenshot the armed triple lens ---");
  await p.keyboard.type("T138");
  await sleep(300);
  await typeChip("motion").click();
  await statusChip("running").click();
  await sleep(500);
  rmSync(OUT, { recursive: true, force: true });
  await p.screenshot({ path: `${OUT}/t138-triple-lens.png` });
  must(true, "G1 visual: t138-triple-lens.png captured (motion ∧ running ∧ T138)");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const after = await roster();
  must(after.length === baseline.length, `Z3 T138 rows deleted, roster restored (${after.length})`);
  console.log(`\nT138 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup(); // a thrown locator never reaches Phase Z — seeds must not leak
  process.exit(1);
});
