// t136 — Task 136: find lens reaches the MINIMAP — the third consumer:
//
//   reach    — with the Ctrl+F bar open, matching minimap chips gain an
//              amber stroke (the canvas find ring's hue) while non-
//              matches dim with the SAME 0.13 the sel focus uses —
//              scattered matches read at a glance across viewports
//   one-match— bar count, canvas card rings, and these dots all derive
//              from the SAME exported jobMatchesFind predicate; the UI
//              sets must be set-equal to the API truth, never drift
//   priority — selection keeps its primary stroke; find-dim never stacks
//              on sel focus (stronger intent wins, as on the cards)
//   honest   — zero matches dims NOTHING anywhere (map included); a
//              closed bar leaves the map exactly as it was
//
// Phase S — pre-clean T136 orphans, snapshot the roster, seed 6 jobs
//           across 3 types × 4 statuses (prisma stamps, fresh startedAt
//           for the running pair), verify via the API.
// Phase B — the bare map: no find markers, no dims (fit mode).
// Phase C — Ctrl+F "T136": 6 matches on the bar, EXACTLY the six seeds
//           carry data-mm-find, their stroke is #f59e0b, a sampled
//           non-match is dimmed at 0.13.
// Phase D — the Running chip: the map's amber set follows the API oracle
//           (T136 ∩ running ∩ rendered) — the third consumer keeps step.
// Phase E — Esc closes the bar: map returns to bare (no find, no dims).
// Phase F — "zzqq" zero matches: map untouched (dim needs ≥1 hit).
// Phase G — screenshot the armed lens (cards + map together).
// Phase Z — console clean, T136 rows deleted, roster restored.
//
// Run: node scripts/t136-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { rmSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t136-shot";
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

/** Stamp a job's status straight into the DB (qa75 / t135 precedent).
 *  A "running" stamp MUST also write a fresh startedAt: the engine's
 *  reconcile treats a running row with no engine record older than
 *  120s as stale and honestly fails it. */
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

async function deleteT136Rows() {
  try {
    const all = await roster();
    for (const j of all) {
      if ((j.name ?? "").startsWith("T136")) {
        await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" }).catch(() => {});
      }
    }
  } catch {}
}

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

/** ids of minimap chips currently carrying the amber find stroke */
const mmFindIds = async () =>
  p.locator('[data-canvas-ui="minimap-dot"][data-mm-find="1"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job-id"))
  );

/** ids of minimap chips currently dimmed (sel focus OR find dim) */
const mmDimIds = async () =>
  p.locator('[data-canvas-ui="minimap-dot"][data-mm-dim="1"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job-id"))
  );

const mmDot = (id) => p.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${id}"]`);
const countText = async () =>
  (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim();
const chip = (value) => p.locator(`[data-testid="canvas-find-status-${value}"]`);

async function main() {
  step("=== t136 — find lens on the minimap (third consumer) ===");

  /* ---------------- Phase S — baseline + seeded statuses ---------------- */
  step("--- Phase S: roster snapshot + T136 status matrix ---");
  await deleteT136Rows();
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const seeds = [
    ["T136 Alpha", "motioncorr", "completed"],
    ["T136 Beta", "motioncorr", "failed"],
    ["T136 Gamma", "ctffind", "running"],
    ["T136 Delta", "import", null],
    ["T136 Epsilon", "ctffind", "running"],
    ["T136 Zeta", "motioncorr", "completed"],
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
  const stamped = await roster();
  const statusOf = Object.fromEntries(
    stamped.filter((j) => (j.name ?? "").startsWith("T136")).map((j) => [j.name, j.status]),
  );
  must(
    statusOf["T136 Alpha"] === "completed" &&
      statusOf["T136 Beta"] === "failed" &&
      statusOf["T136 Gamma"] === "running" &&
      statusOf["T136 Delta"] === "idle" &&
      statusOf["T136 Epsilon"] === "running" &&
      statusOf["T136 Zeta"] === "completed",
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

  /* ---------------- Phase B — the bare map ---------------- */
  step("--- Phase B: bare map — no find markers, no dims ---");
  must((await p.locator('[data-canvas-ui="minimap-dot"]').count()) > 100, "B1 the map renders the world's chips");
  must((await mmFindIds()).length === 0, "B2 no find markers with the bar closed");
  must((await mmDimIds()).length === 0, "B3 no dims in fit mode with no selection");

  /* ---------------- Phase C — the lens reaches the map ---------------- */
  step("--- Phase C: amber set == API oracle, the rest recedes ---");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("T136");
  await sleep(500);
  must((await countText()) === "6 matches", "C1 the bar reads '6 matches'");
  const onCanvas = new Set(
    await p.locator("[data-job]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job")))
  );
  const live = await roster();
  const expectedAll = live
    .filter((j) => onCanvas.has(j.id) && (j.name ?? "").startsWith("T136"))
    .map((j) => j.id)
    .sort();
  const uiAll = (await mmFindIds()).sort();
  must(
    JSON.stringify(uiAll) === JSON.stringify(expectedAll),
    `C2 map amber set == API predicate over rendered cards (${uiAll.length} chips)`
  );
  const gammaStroke = await mmDot(seedIds["T136 Gamma"]).evaluate((el) => el.getAttribute("stroke"));
  must(gammaStroke === "#f59e0b", "C3 a match's stroke is the find amber (#f59e0b)");
  const gammaFill = await mmDot(seedIds["T136 Gamma"]).evaluate((el) => el.getAttribute("fill"));
  must(gammaFill === "#14b8a6", "C4 the match KEEPS its status fill (teal running — no recolor)");
  const nonMatchId = uiAll.length
    ? [...onCanvas].find((id) => !expectedAll.includes(id))
    : null;
  must(!!nonMatchId, "C5 a non-match exists to sample");
  const nonDim = await mmDot(nonMatchId).evaluate((el) => el.getAttribute("data-mm-dim"));
  must(nonDim === "1", "C5b the sampled non-match is dim-marked");
  const nonOpacity = await mmDot(nonMatchId).evaluate((el) => parseFloat(el.getAttribute("opacity")));
  must(nonOpacity === 0.13, "C5c the non-match dims at the sel-focus value (0.13)");
  const cardRing = await p
    .locator(`[data-job="${seedIds["T136 Gamma"]}"]`)
    .evaluate((el) => el.getAttribute("data-find-match"));
  must(cardRing === "true", "C6 the same job rings on the canvas — card and map agree");

  /* ---------------- Phase D — the chip narrows the map too ---------------- */
  step("--- Phase D: Running chip — the map's amber set follows ---");
  await chip("running").click();
  await sleep(400);
  const expectedRunning = live
    .filter(
      (j) =>
        onCanvas.has(j.id) && (j.name ?? "").startsWith("T136") && j.status === "running",
    )
    .map((j) => j.id)
    .sort();
  const uiRun = (await mmFindIds()).sort();
  must(
    JSON.stringify(uiRun) === JSON.stringify(expectedRunning),
    `D1 map amber set == T136 ∩ running (${uiRun.length} chips)`
  );
  must((await countText()) === "2 matches", "D2 the bar reads '2 matches' — count and map agree");

  /* ---------------- Phase E — closing restores the bare map ---------------- */
  step("--- Phase E: Esc — the map forgets the lens ---");
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  must(true, "E1 Esc closed the bar");
  must((await mmFindIds()).length === 0, "E2 no find markers left on the map");
  must((await mmDimIds()).length === 0, "E3 no dims left on the map");

  /* ---------------- Phase F — zero matches dim nothing ---------------- */
  step("--- Phase F: 'zzqq' — the map is not punished ---");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("zzqq");
  await sleep(400);
  must((await countText()) === "no matches", "F1 the bar reads 'no matches'");
  must((await mmFindIds()).length === 0, "F2 no amber on the map");
  must((await mmDimIds()).length === 0, "F3 the map did NOT go dark (dim needs ≥1 hit)");
  await p.keyboard.press("Escape");

  /* ---------------- Phase G — visual ---------------- */
  step("--- Phase G: screenshot the armed lens ---");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("T136");
  await sleep(200);
  await chip("running").click();
  await sleep(500);
  rmSync(OUT, { recursive: true, force: true });
  await p.screenshot({ path: `${OUT}/t136-map-lens.png` });
  must(true, "G1 visual: t136-map-lens.png captured (running chip + map)");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const after = await roster();
  must(after.length === baseline.length, `Z3 T136 rows deleted, roster restored (${after.length})`);
  console.log(`\nT136 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  process.exit(1);
});
