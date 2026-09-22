// t94 — Task 94: roster text search (dashboard job roster).
//
// The project grid has had a search box forever; the JOB ROSTER (the
// cross-workspace table under the active-project spotlight) only had
// status chips. Task 94 adds a text search that composes with the chips:
// visible = (status filter) ∩ (haystack match), where the haystack spans
// job name + type + workspace name + status. A count chip ("N of M") is
// live screen chrome (no-print); an empty result gets its own dedicated
// note distinct from the "no jobs yet" boot state; and the query resets
// when the active project changes (render-time adjustment).
//
// Data discipline: every expected row set is computed at runtime from the
// API truth (/api/jobs + /api/workspaces) with the SAME haystack the
// product uses — hardcoded expectations would drift with the seed.
//
// Phase S — setup: API truth, boot to dashboard
// Phase A — search contract: rest state (chip absent), query narrows rows
//   to the API-truth subset, chip text "N of M" matches the DOM count
// Phase B — composition: status chip ∩ query (both directions), then reset
// Phase C — empty search: dedicated note + "0 of M" chip, clear restores
// Phase D — whitespace-insensitive: padded query matches like trimmed
// Phase E — static contract (source): testids, role=search, render-time
//   reset, haystack spans workspace name
// Phase Z — cleanup + console clean
//
// Run: node scripts/t94-e2e.mjs   (server on :3000)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    p?.close().catch(() => {});
    b?.close().catch(() => {});
    process.exit(1);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};

const api = async (path, method = "GET", body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  if (method === "DELETE") return null;
  return res.json();
};

/* ---------------- Phase S: setup ---------------- */
console.log("Phase S — setup");
const truth = await api("/api/jobs");
const jobs = truth.jobs;
const wss = (await api("/api/workspaces")).workspaces;
must(jobs.length >= 1 && wss.length >= 1, `S1 API truth reachable (${jobs.length} jobs, ${wss.length} workspaces)`);

// the SAME haystack the product computes (name + type + workspace + status)
const wsName = (id) => (id ? (wss.find((w) => w.id === id)?.name ?? "") : "");
const hay = (j) => `${j.name} ${j.type} ${j.workspaceId ? wsName(j.workspaceId) : ""} ${j.status}`.toLowerCase();
const expectFor = (query, statusFilter = null) =>
  jobs.filter((j) => hay(j).includes(query.trim().toLowerCase()) && (!statusFilter || j.status === statusFilter));

b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view]');
await sleep(600);
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 4 && (await curView()) !== "dashboard"; i++) {
  await p.keyboard.press("Shift+D");
  await sleep(700);
}
must((await curView()) === "dashboard", `S2 dashboard view active (got "${await curView()}")`);
await p.waitForSelector('[data-roster-row]', { timeout: 10_000 });

const roster = () =>
  p.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-roster-row]")];
    const vis = rows.filter((r) => getComputedStyle(r).display !== "none");
    return {
      total: rows.length,
      visible: vis.length,
      chip: document.querySelector('[data-testid="roster-count-chip"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      emptySearch: !!document.querySelector('[data-testid="roster-empty-search"]'),
      emptyBoot: (document.querySelector('[data-roster-table]') === null &&
        /jobs in this project yet/.test(document.body.textContent ?? "")),
    };
  });
const INPUT = '[data-testid="roster-search-input"]';
const rowText = () =>
  p.evaluate(() =>
    [...document.querySelectorAll("[data-roster-row]")]
      .filter((r) => getComputedStyle(r).display !== "none")
      .map((r) => (r.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120)));

/* ---------------- Phase A: search contract ---------------- */
console.log("Phase A — search contract");
must(await p.locator(INPUT).isVisible(), "A1 search input visible on the roster");
must((await roster()).chip === null, "A2 count chip absent at rest");

// pick a query guaranteed to split the roster: the most common type token
// among job TYPES (e.g. "motioncorr") — computed from API truth
const typeTokens = [...new Set(jobs.map((j) => j.type))];
const qType = typeTokens.sort((a, b) =>
  jobs.filter((j) => j.type === b).length - jobs.filter((j) => j.type === a).length
)[0];
const expectedA = expectFor(qType);
must(expectedA.length >= 1 && expectedA.length < jobs.length,
  `A3 split query available: type "${qType}" matches ${expectedA.length}/${jobs.length}`);

await p.locator(INPUT).fill(qType);
await sleep(350);
let r = await roster();
must(r.visible === expectedA.length, `A4 visible rows == API-truth subset (${r.visible} == ${expectedA.length})`);
must(r.chip === `${expectedA.length} of ${jobs.length}`,
  `A5 count chip reads truth (got "${r.chip}")`);
const namesA = expectedA.slice(0, 3).map((j) => j.name);
const txtA = await rowText();
must(namesA.every((n) => txtA.some((t) => t.includes(n))),
  `A6 expected job names present in rows (${namesA.join(" | ")})`);
must(!txtA.some((t) => t.toLowerCase().includes(jobs.find((j) => !hay(j).includes(qType))?.name.toLowerCase())),
  "A7 non-matching rows are gone, not hidden-in-place");

/* ---------------- Phase B: composition with the status chips ---------------- */
console.log("Phase B — status chip ∩ query");
await p.locator('[data-testid="roster-search-clear"]').click();
await sleep(250);
r = await roster();
must(r.chip === null && r.visible === jobs.length, `B1 clear restores the full roster (${r.visible} == ${jobs.length})`);

// a status that actually exists in the seed
const statuses = [...new Set(jobs.map((j) => j.status))];
const statusPicked = statuses.find((s) => s !== "idle") ?? statuses[0];
const chipSel = `button[role="group"] >> text=/^${statusPicked}/i`;
// the chips live in their own group; anchor by the group label
const chipBtn = p.locator('[role="group"][aria-label="Filter jobs by status"] button', { hasText: new RegExp(`^${statusPicked}`, "i") }).first();
await chipBtn.click();
await sleep(300);
const expectedChip = expectFor("", statusPicked);
r = await roster();
must(r.visible === expectedChip.length, `B2 status chip alone narrows to truth (${r.visible} == ${expectedChip.length})`);

// now a query that genuinely INTERSECTS the chip slice: a word token from
// target.name that narrows the slice (the seed shares prefixes like "QA",
// so the first word often matches every row — useless as an intersection)
const target = expectedChip[0];
const tokens = target.name.split(/\s+/).filter((w) => w.length >= 3);
const qName =
  tokens.find((w) => expectFor(w, statusPicked).length < expectedChip.length) ?? target.name;
await p.locator(INPUT).fill(qName);
await sleep(350);
const expectedBoth = expectFor(qName, statusPicked);
must(expectedBoth.length < expectedChip.length,
  `B3a the picked token truly narrows ("${qName}": ${expectedBoth.length} < ${expectedChip.length})`);
r = await roster();
must(r.visible === expectedBoth.length && expectedBoth.every((j) => j.status === statusPicked),
  `B3 chip ∩ query is the intersection (${r.visible} rows, all ${statusPicked})`);
must(r.chip === `${expectedBoth.length} of ${jobs.length}`,
  `B4 chip denominator stays the FULL roster (got "${r.chip}")`);

// reset via All chip + clear
await p.locator('[role="group"][aria-label="Filter jobs by status"] button', { hasText: /^All\b/i }).first().click();
await p.locator(INPUT).fill("");
await sleep(300);
must((await roster()).visible === jobs.length, "B5 All chip + empty query restore everything");

/* ---------------- Phase C: empty search ---------------- */
console.log("Phase C — empty search state");
await p.locator(INPUT).fill("zzz-no-such-job-9x");
await sleep(350);
r = await roster();
must(r.visible === 0 && r.emptySearch, "C1 zero rows get the dedicated empty-search note (not the boot copy)");
must(r.chip === `0 of ${jobs.length}`, `C2 chip reads 0 of M (got "${r.chip}")`);
must(!r.emptyBoot, "C3 boot-time 'no jobs yet' copy stays out of the way");
const emptyText = await p.evaluate(() =>
  document.querySelector('[data-testid="roster-empty-search"]')?.textContent ?? "");
must(emptyText.includes("zzz-no-such-job-9x"), `C4 the note echoes the query (got "${emptyText.trim().slice(0, 70)}")`);
await p.locator(INPUT).fill("");
await sleep(300);
r = await roster();
must(r.visible === jobs.length && !r.emptySearch, "C5 clearing the query restores the table");

/* ---------------- Phase D: whitespace insensitivity ---------------- */
console.log("Phase D — padded query behaves like trimmed");
await p.locator(INPUT).fill(`  ${qType}  `);
await sleep(350);
r = await roster();
must(r.visible === expectedA.length, `D1 padded query matches like trimmed (${r.visible} == ${expectedA.length})`);
await p.locator(INPUT).fill("");
await sleep(250);

/* ---------------- Phase E: static contract ---------------- */
console.log("Phase E — static contract (source)");
const { execSync } = await import("node:child_process");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const dashSrc = sh("cat src/components/workflow/project-dashboard.tsx");
const searchBlock = dashSrc.slice(dashSrc.indexOf("Task 94 — roster text search. Composes"));
must(
  searchBlock.includes('role="search"') && searchBlock.includes("no-print") &&
  searchBlock.includes('data-testid="roster-search-input"'),
  "E1 search row: role=search + no-print + testid",
);
must(
  dashSrc.includes("project.id !== prevProjectId") && dashSrc.includes('setRosterQuery("")'),
  "E2 query resets on project switch (render-time adjustment)",
);
must(dashSrc.includes("wsNameById"), "E3 haystack spans the workspace name");
must(
  dashSrc.includes('data-testid="roster-count-chip"') && dashSrc.includes('data-testid="roster-empty-search"'),
  "E4 count chip + empty-search note testids",
);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
must(consoleErrors.filter((e) => !e.includes("400")).length === 0,
  `Z1 console clean (got ${JSON.stringify(consoleErrors.slice(0, 3))})`);

await cleanup();
console.log(`T94 ALL PASS (${PASS} assertions)`);
