// t140 — Task 140: the footer's status census is a lens launcher.
//
// The footer stops being a mute instrument: every status the workspace
// actually has becomes a one-click trigger that arms the find lens —
// the SAME store fields, the SAME predicate, so count / rings / minimap
// amber / cycle cursor all come alive from the chrome.
//
//   census  — presence-derived (a status with zero jobs renders
//             nothing — a non-existent filter can't exist), ordered
//             like the bar's chips, counts over the workspace-scoped
//             list the canvas renders (roster == canvas invariant)
//   launch  — click opens the lens with that status armed; layered
//             over any query already typed (orthogonal dimensions
//             compose — Task 135's composition law, sixth application)
//   toggle  — "restore to the state you found": a second click on the
             // armed entry closes the lens entirely IF the lens holds
//             nothing but that filter; if the user stacked intent
//             (typed text) only the status disarms — a click never
//             destroys someone else's words
//   dialect — the census borrows the exact chip hues (teal/emerald/
//             rose/slate/amber); running's dot pulses (the world's
//             heartbeat), aria-pressed mirrors the armed chip
//
// Phase S — pre-clean T140 rows, snapshot roster, seed 6 jobs
//           (2 running with fresh startedAt — Task 135 doctrine).
// Phase B — census honesty: button set == statuses present in the
//           rendered world, counts == API oracle, order == the bar's
//           chip order, everything unpressed, bar closed.
// Phase C — one click → one lens: bar opens, chip armed on BOTH sides
//           (bar + footer), count / card rings / minimap amber all ==
//           the same rendered∩status oracle, dim == rendered − oracle.
// Phase D — composition: footer switches arm (running→completed);
//           typed text intersects the armed status; arming failed over
//           the text goes honest-zero ("no matches").
// Phase E — toggle semantics: clean-armed second click CLOSES the lens;
//           with typed text layered the second click only disarms (bar
//           stays, query survives); Esc from a footer-armed lens
//           leaves zero residue.
// Phase F — boundaries: Ctrl+F and the zoom-controls find-toggle still
//           open/close the lens (the census adds an entry, never a
//           monopoly); census unpressed whenever the bar is closed.
// Phase G — screenshot: census with an armed entry + hover.
// Phase Z — console clean, T140 rows deleted, roster restored.
//
// Run: node scripts/t140-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { mkdirSync, rmSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t140-shot";
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

const deleteT140Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T140"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
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

const sortIds = (a) => [...a].sort();

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

/** ids of all rendered cards — the stage truth (DOM 全集才是名册) */
const renderedIds = async () =>
  p.locator("[data-job]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );

/** ids of minimap chips carrying a marker */
const mmIds = async (attr) =>
  p.locator(`[data-canvas-ui="minimap-dot"][${attr}]`).evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job-id"))
  );

const bar = () => p.locator('[data-testid="canvas-find-bar"]');
const input = () => p.locator('[data-testid="canvas-find-input"]');
const chipArmed = async (value) =>
  (await p.locator(`[data-testid="canvas-find-status-${value}"]`).getAttribute("aria-pressed")) === "true";
const countText = async () =>
  (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim();
const censusBtn = (value) => p.locator(`[data-testid="footer-census-${value}"]`);
const censusArmed = async (value) =>
  (await censusBtn(value).getAttribute("aria-pressed")) === "true";

/** type a query into the find input (chip clicks / buttons steal focus —
 *  click the input first, then select-all + type — Task 135 lesson).
 *  An empty q CLEARS the field: keyboard.type("") types nothing, so the
 *  select-all must be followed by an actual Delete keypress. */
const typeQuery = async (q) => {
  await input().click();
  await p.keyboard.press("Control+a");
  if (q === "") {
    await p.keyboard.press("Delete");
  } else {
    await p.keyboard.type(q, { delay: 30 });
  }
  await sleep(250);
};

const FIND_STATUSES = ["running", "completed", "failed", "idle", "pending"];

async function main() {
  step("=== t140 — footer status census as lens launchers ===");

  /* ---------------- Phase S — baseline + seeded statuses ---------------- */
  step("--- Phase S: roster snapshot + T140 status matrix ---");
  deleteT140Rows(); // a KILLED previous run must not poison this one
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const seeds = [
    ["T140 Alpha", "motioncorr", "running"],
    ["T140 Beta", "motioncorr", "running"],
    ["T140 Gamma", "ctffind", "completed"],
    ["T140 Delta", "ctffind", "failed"],
    ["T140 Eps", "import", "idle"],
    ["T140 Zeta", "import", "idle"],
  ];
  const seedIds = {};
  let y = maxY + 240;
  for (const [name, type, status] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type} → ${status})`);
    seedIds[name] = j.id;
    seededIds.push(j.id);
    if (status) stamp(j.id, status);
    y += 240;
  }
  const stamped = await roster();
  const statusOf = Object.fromEntries(
    stamped.filter((j) => (j.name ?? "").startsWith("T140")).map((j) => [j.name, j.status]),
  );
  must(
    statusOf["T140 Alpha"] === "running" &&
      statusOf["T140 Beta"] === "running" &&
      statusOf["T140 Gamma"] === "completed" &&
      statusOf["T140 Delta"] === "failed" &&
      statusOf["T140 Eps"] === "idle" &&
      statusOf["T140 Zeta"] === "idle",
    `S+ stamps verified via API (2 running / 1 completed / 1 failed / 2 idle)`
  );

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  // stage truth: wait until every seed is actually on canvas
  let stage = null;
  for (let i = 0; i < 20; i++) {
    stage = await renderedIds();
    if (seededIds.every((id) => stage.includes(id))) break;
    await sleep(500);
  }
  must(seededIds.every((id) => stage.includes(id)), `all 6 seeds rendered on canvas (${stage.length} cards)`);

  // the census oracle: counts over the RENDERED world (roster == canvas)
  const apiById = Object.fromEntries((await roster()).map((j) => [j.id, j]));
  const stageJobs = stage.map((id) => apiById[id]).filter(Boolean);
  const countOf = (s) => stageJobs.filter((j) => j.status === s).length;

  /* ---------------- Phase B — census honesty ---------------- */
  step("--- Phase B: census set, counts, order, unpressed ---");
  const expectedPresent = FIND_STATUSES.filter((s) => countOf(s) > 0);
  const actualCensus = await p
    .locator('[data-testid^="footer-census-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  must(
    JSON.stringify(actualCensus) === JSON.stringify(expectedPresent.map((s) => `footer-census-${s}`)),
    `B1 census == present statuses in chip order (${JSON.stringify(actualCensus)})`
  );
  for (const s of expectedPresent) {
    const txt = (await censusBtn(s).innerText()).trim();
    must(txt.startsWith(String(countOf(s))), `B2 ${s} count == ${countOf(s)} (got "${txt}")`);
  }
  must(!(await bar().isVisible()), "B3 find bar closed before any census click");
  const anyPressed = await p
    .locator('[data-testid^="footer-census-"][aria-pressed="true"]')
    .count();
  must(anyPressed === 0, "B4 every census entry unpressed while the lens is closed");
  must(
    (await p.locator("footer >> text=/job/").first().isVisible().catch(() => false)) ||
      (await p.getByText(/jobs? ·/).isVisible().catch(() => false)),
    "B5 total 'jobs · edges' summary still present"
  );

  /* ---------------- Phase C — one click → one lens ---------------- */
  step("--- Phase C: census click arms the lens (count == rings == amber) ---");
  const runningOracle = sortIds(stageJobs.filter((j) => j.status === "running").map((j) => j.id));
  await censusBtn("running").click();
  await sleep(350);
  must(await bar().isVisible(), "C1 census click opened the find bar");
  must(await chipArmed("running"), "C2 bar's running chip armed");
  must(await censusArmed("running"), "C3 footer's running entry aria-pressed");
  must(
    (await countText()) === `${runningOracle.length} ${runningOracle.length === 1 ? "match" : "matches"}`,
    `C4 count == "${runningOracle.length} matches" (got "${await countText()}")`
  );
  must(JSON.stringify(sortIds(await matchIds())) === JSON.stringify(runningOracle),
    "C5 card rings == rendered ∩ running (seed anchors in)");
  must(runningOracle.filter((id) => id.startsWith("T140") === false).length >= 0 &&
    seededIds.filter((id) => runningOracle.includes(id)).length === 2,
    "C6 both seeded running jobs are ring anchors");
  const dimOracle = sortIds(stage.filter((id) => !runningOracle.includes(id)));
  must(JSON.stringify(sortIds(await dimmedIds())) === JSON.stringify(dimOracle),
    "C7 dim == rendered − matches (DOM 全集才是名册)");
  must(JSON.stringify(sortIds(await mmIds("data-mm-find"))) === JSON.stringify(runningOracle),
    "C8 minimap amber == the same oracle");

  /* ---------------- Phase D — composition & switching ---------------- */
  step("--- Phase D: footer switches arm; text intersects status ---");
  await censusBtn("completed").click();
  await sleep(350);
  const completedOracle = sortIds(stageJobs.filter((j) => j.status === "completed").map((j) => j.id));
  must(!(await censusArmed("running")) && (await censusArmed("completed")),
    "D1 footer switched the arm running→completed");
  must(!(await chipArmed("running")) && (await chipArmed("completed")),
    "D2 bar's chips mirror the switch");
  must(JSON.stringify(sortIds(await matchIds())) === JSON.stringify(completedOracle),
    "D3 rings == rendered ∩ completed");
  await typeQuery("gamma");
  const textOracle = sortIds(completedOracle.filter((id) =>
    (apiById[id]?.name ?? "").toLowerCase().includes("gamma")));
  must(
    (await countText()) === `${textOracle.length} ${textOracle.length === 1 ? "match" : "matches"}` &&
      seededIds.filter((id) => textOracle.includes(id)).includes(seedIds["T140 Gamma"]),
    `D4 completed ∧ "gamma" composes (${textOracle.length} match, seed anchor in)`
  );
  await censusBtn("failed").click();
  await sleep(350);
  must((await countText()) === "no matches",
    'D5 failed ∧ "gamma" → honest "no matches" (armed lens, zero hits)');

  /* ---------------- Phase E — toggle semantics ---------------- */
  step("--- Phase E: restore-to-found-state toggle ---");
  await typeQuery(""); // clear the text — failed armed over a clean lens
  const failedOracle = sortIds(stageJobs.filter((j) => j.status === "failed").map((j) => j.id));
  must((await countText()) === `${failedOracle.length} ${failedOracle.length === 1 ? "match" : "matches"}`,
    "E1 clean failed lens counts the failed oracle");
  await censusBtn("failed").click();
  await sleep(350);
  must(!(await bar().isVisible()), "E2 second click on clean-armed census CLOSED the lens");
  must(
    (await p.locator('[data-testid^="footer-census-"][aria-pressed="true"]').count()) === 0,
    "E3 no census entry left pressed after the close"
  );
  must((await matchIds()).length === 0 && (await dimmedIds()).length === 0,
    "E4 rings and dims cleared with the lens");
  await censusBtn("idle").click();
  await sleep(350);
  must(await bar().isVisible() && (await countText()) !== "",
    "E5 census reopens the lens (idle armed)");
  await typeQuery("zeta");
  const zetaCount1 = await countText();
  await censusBtn("idle").click();
  await sleep(350);
  must(
    (await bar().isVisible()) &&
      !(await chipArmed("idle")) &&
      !(await censusArmed("idle")) &&
      (await countText()) === zetaCount1 &&
      (await input().inputValue()) === "zeta",
    "E6 layered second click only DISARMS: bar stays, typed 'zeta' survives, count unchanged"
  );
  await input().click();
  await p.keyboard.press("Escape");
  await sleep(300);
  must(!(await bar().isVisible()), "E7 Esc closes a footer-armed lens");

  /* ---------------- Phase F — boundaries ---------------- */
  step("--- Phase F: other lens entries unaffected ---");
  await p.locator("footer p").first().click(); // neutral focus, not an input
  await p.keyboard.press("Control+f");
  await sleep(300);
  must(await bar().isVisible(), "F1 Ctrl+F still opens the lens");
  await input().click();
  await p.keyboard.press("Escape");
  await sleep(250);
  await p.locator('[data-canvas-ui="find-toggle"]').click();
  await sleep(300);
  must(await bar().isVisible(), "F2 zoom-controls find-toggle still opens");
  await p.locator('[data-canvas-ui="find-toggle"]').click();
  await sleep(250);
  must(!(await bar().isVisible()), "F3 find-toggle closes again");
  must(
    (await p.locator('[data-testid^="footer-census-"][aria-pressed="true"]').count()) === 0,
    "F4 census unpressed whenever the lens is closed (any entry path)"
  );

  /* ---------------- Phase G — screenshot ---------------- */
  step("--- Phase G: census with an armed entry ---");
  await censusBtn("failed").click();
  await sleep(400);
  await censusBtn("failed").hover();
  await sleep(300);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  await p.screenshot({ path: `${OUT}/t140-census.png` });
  must(true, "G1 visual: t140-census.png captured (armed failed entry + hover)");
  await p.keyboard.press("Escape"); // leave a clean world for Z
  await sleep(250);

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  must(consoleErrors.length === 0, `Z2 console errors honest (0): ${consoleErrors.slice(0, 3).join(" | ")}`);
  await p.close(); p = null;
  await b.close(); b = null;
  for (const id of seededIds) {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" });
  }
  const after = await roster();
  must(after.length === baseline.length, `Z3 T140 rows deleted, roster restored (${after.length})`);
  deleteT140Rows();

  console.log(`\nT140 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
