// t135 — Task 135: find bar STATUS LENS — the status half of Ctrl+F:
//
//   chips    — a chip row under the input (Running/Completed/Failed/
//              Idle/Pending); radio semantics: one active at a time,
//              clicking the active chip again clears it
//   orthogon — with a query the chip narrows those matches; with no
//              query the chip IS the lens ("show me every running job")
//   one-match— bar count and canvas ring/dim both derive from the SAME
//              jobMatchesFind predicate (a chip with zero query matches
//              every job of that status; no chip + no query = nothing)
//   honest   — armed lens with zero hits reads "no matches"; the canvas
//              never goes dark (dim needs ≥1 hit, Task 134's contract)
//   ephemeral— Esc AND × both clear query AND chip; reopen is fresh
//
// Phase S — pre-clean T135 orphans, snapshot the roster, seed 6 jobs
//           across 3 types × 4 statuses (prisma stamps: Alpha/Beta/
//           Gamma/Delta/Epsilon/Zeta), verify via the API.
// Phase B — Ctrl+F opens the two-row bar; 5 chips present, none armed;
//           "T135" reads 6 matches, 6 rings.
// Phase C — Running chip: count narrows to 2, ring set == API oracle
//           (T135 ∩ running), non-running T135 cards dim; the running
//           chip pulses (same dialect as the status badge).
// Phase D — clear the query: the chip ALONE keeps the lens ("2 matches",
//           same ring set) — status-only lens works.
// Phase E — radio: Failed replaces Running (1 match, Beta only); click
//           Failed again → chip cleared → honest empty ("" count, no
//           rings, no dims); "T135" again → 6.
// Phase F — no residue: query+chip armed → Esc closes → reopen fresh
//           (empty input, no chip armed, no count); same for ×.
// Phase G — screenshot the armed two-row lens.
// Phase Z — console clean, T135 rows deleted, roster restored.
//
// Run: node scripts/t135-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { rmSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t135-shot";
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

/** Stamp a job's status straight into the DB (qa75's engine-stamp
 *  precedent) — the POST /api/jobs route only ever creates idle rows.
 *  A "running" stamp MUST also write a fresh startedAt: the engine's
 *  reconcile treats a running row with no engine record older than
 *  120s as stale and honestly fails it — a fresh timestamp keeps the
 *  fake run inside the spawn-race grace window for the whole probe. */
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

async function deleteT135Rows() {
  try {
    const all = await roster();
    for (const j of all) {
      if ((j.name ?? "").startsWith("T135")) {
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

/** ids of cards currently carrying the find ring */
const matchIds = async () =>
  p.locator("[data-job][data-find-match='true']").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );

/** ids of cards currently dimmed by the lens */
const dimmedIds = async () =>
  p.locator("[data-job].note-spotlight-dim").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );

const chip = (value) => p.locator(`[data-testid="canvas-find-status-${value}"]`);
const chipArmed = async (value) => (await chip(value).getAttribute("aria-pressed")) === "true";
const countText = async () =>
  (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim();

async function main() {
  step("=== t135 — find bar status lens (chips × text, one predicate) ===");

  /* ---------------- Phase S — baseline + seeded statuses ---------------- */
  step("--- Phase S: roster snapshot + T135 status matrix ---");
  await deleteT135Rows(); // a KILLED previous run must not poison this one
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  // 3 types × 4 statuses: two running, two completed, one failed, one idle
  const seeds = [
    ["T135 Alpha", "motioncorr", "completed"],
    ["T135 Beta", "motioncorr", "failed"],
    ["T135 Gamma", "ctffind", "running"],
    ["T135 Delta", "import", null], // POST default = idle
    ["T135 Epsilon", "ctffind", "running"],
    ["T135 Zeta", "motioncorr", "completed"],
  ];
  const seedIds = {};
  let y = maxY + 240;
  for (const [name, type, status] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type}${status ? ` → will stamp ${status}` : ", idle"})`);
    seedIds[name] = j.id;
    seededIds.push(j.id);
    if (status) stamp(j.id, status);
    y += 240;
  }
  // the API must agree the stamps landed (the oracle's ground truth)
  const stamped = await roster();
  const statusOf = Object.fromEntries(
    stamped.filter((j) => (j.name ?? "").startsWith("T135")).map((j) => [j.name, j.status]),
  );
  must(
    statusOf["T135 Alpha"] === "completed" &&
      statusOf["T135 Beta"] === "failed" &&
      statusOf["T135 Gamma"] === "running" &&
      statusOf["T135 Delta"] === "idle" &&
      statusOf["T135 Epsilon"] === "running" &&
      statusOf["T135 Zeta"] === "completed",
    `S+ stamps verified via API (${JSON.stringify(statusOf)})`
  );

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase B — the bar carries a chip row ---------------- */
  step("--- Phase B: chips present, none armed, text lens unchanged ---");
  must((await p.locator('[data-testid="canvas-find-bar"]').count()) === 0, "B0 bar closed before any shortcut");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-status-row"]', { timeout: 5000 });
  must(true, "B1 Ctrl+F opened the two-row bar");
  for (const v of ["running", "completed", "failed", "idle", "pending"]) {
    must((await chip(v).count()) === 1, `B2 chip ${v} rendered`);
    must(!(await chipArmed(v)), `B3 chip ${v} starts unarmed`);
  }
  await p.keyboard.type("T135");
  await sleep(400);
  must((await countText()) === "6 matches", "B4 text-only lens reads '6 matches'");
  must((await matchIds()).length === 6, "B5 all six seeds ring");

  /* ---------------- Phase C — the status gate engages ---------------- */
  step("--- Phase C: Running chip narrows the matches (API oracle) ---");
  await chip("running").click();
  await sleep(400);
  must(await chipArmed("running"), "C1 the Running chip is armed");
  must((await countText()) === "2 matches", "C2 count narrowed to '2 matches'");
  const onCanvas = new Set(
    await p.locator("[data-job]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job")))
  );
  const live = await roster();
  const expected = live
    .filter((j) => onCanvas.has(j.id) && (j.name ?? "").startsWith("T135") && j.status === "running")
    .map((j) => j.id)
    .sort();
  const ui = (await matchIds()).sort();
  must(
    JSON.stringify(ui) === JSON.stringify(expected),
    `C3 ring set == API predicate (T135 ∩ running): ${ui.length} cards`
  );
  const gammaDimmed = await p
    .locator(`[data-job="${seedIds["T135 Gamma"]}"]`)
    .evaluate((el) => el.classList.contains("note-spotlight-dim"));
  must(!gammaDimmed, "C4 a matched card is NOT dimmed");
  const alphaDimmed = await p
    .locator(`[data-job="${seedIds["T135 Alpha"]}"]`)
    .evaluate((el) => el.classList.contains("note-spotlight-dim"));
  must(alphaDimmed, "C5 a non-matching (completed) seed recedes");
  const pulse = await chip("running")
    .locator("span")
    .first()
    .evaluate((el) => el.className.includes("animate-soft-pulse"));
  must(pulse, "C6 the armed running dot pulses (status-badge dialect)");

  /* ---------------- Phase D — the chip alone is the lens ---------------- */
  step("--- Phase D: status-only lens (empty query, chip armed) ---");
  // oracle-relative, not absolute: the empty query + chip lens spans the
  // WHOLE active workspace, so the expected set is "everything rendered
  // that is running" — the T135 pair must be inside it, and the UI must
  // equal it exactly (whatever else the busy demo world contributes).
  const expectedRunning = live
    .filter((j) => onCanvas.has(j.id) && j.status === "running")
    .map((j) => j.id)
    .sort();
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Control+a");
  await p.keyboard.press("Delete");
  await sleep(400);
  must(
    (await countText()) === `${expectedRunning.length} matches`,
    `D1 empty query + chip reads '${expectedRunning.length} matches' (workspace-truth)`
  );
  const uiD = (await matchIds()).sort();
  must(
    JSON.stringify(uiD) === JSON.stringify(expectedRunning),
    "D2 the ring set survives the empty query (chip IS the lens)"
  );
  must(
    expectedRunning.includes(seedIds["T135 Gamma"]) && expectedRunning.includes(seedIds["T135 Epsilon"]),
    "D3 both seeded running jobs are inside the lens"
  );

  /* ---------------- Phase E — radio semantics + honest empty ---------------- */
  step("--- Phase E: Failed replaces Running; re-click clears; empty is honest ---");
  const expectedFailed = live
    .filter((j) => onCanvas.has(j.id) && j.status === "failed")
    .map((j) => j.id)
    .sort();
  await chip("failed").click();
  await sleep(400);
  must(await chipArmed("failed"), "E1 the Failed chip is armed");
  must(!(await chipArmed("running")), "E2 radio: Running disarmed by Failed");
  must(
    (await countText()) ===
      `${expectedFailed.length} ${expectedFailed.length === 1 ? "match" : "matches"}`,
    `E3 count matches the workspace failed set (${expectedFailed.length})`
  );
  const uiE = (await matchIds()).sort();
  must(
    JSON.stringify(uiE) === JSON.stringify(expectedFailed),
    "E4 ring set == the failed predicate over rendered cards"
  );
  must(uiE.includes(seedIds["T135 Beta"]), "E5 T135 Beta (failed) is inside the lens");
  await chip("failed").click();
  await sleep(400);
  must(!(await chipArmed("failed")), "E6 re-click clears the chip (back to all)");
  must((await countText()) === "", "E7 no chip + no query = no count (not 'no matches')");
  must((await matchIds()).length === 0, "E8 no rings anywhere");
  must((await dimmedIds()).length === 0, "E9 the canvas did NOT go dark");
  // the chip click moved focus onto the button — a real user clicks the
  // input back before typing; do the same or the keystrokes go nowhere
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Control+a");
  await p.keyboard.type("T135");
  await sleep(400);
  must((await countText()) === "6 matches", "E10 back to the full six with text alone");

  /* ---------------- Phase F — closing leaves no residue ---------------- */
  step("--- Phase F: Esc and × both clear query AND chip ---");
  await chip("completed").click();
  await sleep(300);
  must(
    (await countText()) === "2 matches" && (await chipArmed("completed")),
    "F1 armed world: 'T135' + completed → '2 matches'"
  );
  // focus the input so the Esc is the INPUT's Esc (preventDefault → the
  // page-level ladder stands down), not a chip's Esc hitting the ladder
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  must(true, "F2 Esc closed the bar");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  must(
    (await p.locator('[data-testid="canvas-find-input"]').inputValue()) === "",
    "F3 reopen: query empty"
  );
  must(!(await chipArmed("completed")), "F4 reopen: chip disarmed (lens leaves no residue)");
  must((await countText()) === "", "F5 reopen: no count");
  // the same promise via the × button
  await p.keyboard.type("T135");
  await sleep(300);
  await chip("failed").click();
  await sleep(300);
  await p.locator('[data-testid="canvas-find-close"]').click();
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  must(!(await chipArmed("failed")), "F6 × path disarms the chip too");
  must((await matchIds()).length === 0, "F7 no rings after the × round-trip");

  /* ---------------- Phase G — visual ---------------- */
  step("--- Phase G: screenshot the armed two-row lens ---");
  await p.keyboard.type("T135");
  await sleep(200);
  await chip("running").click();
  await sleep(500);
  rmSync(OUT, { recursive: true, force: true });
  await p.screenshot({ path: `${OUT}/t135-status-lens.png` });
  must(true, "G1 visual: t135-status-lens.png captured (running chip armed)");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const after = await roster();
  must(after.length === baseline.length, `Z3 T135 rows deleted, roster restored (${after.length})`);
  console.log(`\nT135 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  process.exit(1);
});
