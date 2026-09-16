// t245 — the index-completeness law, wired (Task 245).
// Task 244's leftover: "存在的门必须在索引里" was doctrine and one new row —
// this window makes it a CONTRACT. The law: every interactive door on the
// header strip must have a palette row, except the honestly exempt (the
// palette's own trigger is self-referential; Print belongs to the browser's
// native Ctrl+P/⌘P). Two real gaps fell out of the audit and are closed in
// product: the Projects group (the header's project SelectTrigger had no
// index row — its Workspaces sibling was indexed long ago) and the GitHub
// row (a real door with NO platform keyboard path — so a row, not an
// exemption).
// The contract lives as DATA below: DOOR_RULES + EXEMPT_RULES. A new header
// door that matches no rule FAILS the suite — the contract must be updated,
// not silently drifted past. A rule matching no door is stale — also FAIL.
// Phases:
//   A  demo truth — engine not-found, roster 21, exactly one project
//   B  the law — enumerate the header's interactive doors from the live DOM,
//      match each against DOOR_RULES/EXEMPT_RULES, then open the palette and
//      assert every coverage rule finds its row + the group order
//      (Projects before Workspaces: parent before child) + the same-project
//      guard (clicking the active project's row closes quietly, no POST)
//   C  synthetic two-project world (route-intercepted project family) —
//      switch projects from the palette row: POST once, header trigger
//      re-titles, (active) marker flips; GitHub row answers with a real
//      popup at the repo URL
//   D  console clean + the frame (filtered palette: the three new truths)
// Run: node scripts/t245-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// ---- Phase A: demo world identity -------------------------------------------
console.log("== PHASE A: demo world identity ==");
const sys = await (await fetch(`${BASE}/api/system`)).json();
must(sys.found === false, "real API: engine not found (demo host truth)");
const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
must((jobs.jobs ?? []).length === 21, `roster identity 21 (got ${(jobs.jobs ?? []).length})`);
const projs = await (await fetch(`${BASE}/api/projects`)).json();
must((projs.projects ?? []).length === 1, `demo world has exactly one project (got ${(projs.projects ?? []).length})`);

// ---- the CONTRACT (data, not prose) -----------------------------------------
// kind "row": the door's purpose must be reachable from a palette row.
// kind "exempt": the door is honestly out of the index, with its reason.
const DOOR_RULES = [
  { name: "project switcher", re: /^Active project$/, kind: "row", live: "project" },
  { name: "engine chip (action coverage)", re: /^RELION environment status:/, kind: "row", rowRe: /Re-detect RELION environment/,
    note: "the chip's popover is a VIEW (its facts are always visible in the chip label); the family's VERB — Re-detect — is what the index carries (t244)" },
  { name: "workspace switcher", re: /^Active workspace$/, kind: "row", live: "workspace" },
  { name: "dashboard tab", re: /^Project dashboard \(Shift\+D toggles\)$/, kind: "row", rowRe: /Open project dashboard|Back to workflow canvas/ },
  { name: "canvas tab", re: /^Workflow canvas \(Shift\+D toggles\)$/, kind: "row", rowRe: /Open project dashboard|Back to workflow canvas/ },
  { name: "note spotlight", re: /^Spotlight noted jobs$/, kind: "row", rowRe: /Spotlight noted jobs|Show all jobs \(spotlight off\)/ },
  { name: "session QC report", re: /^Session QC report$/, kind: "row", rowRe: /Open the session QC report/ },
  { name: "help", re: /^Help — how to use the workflow canvas$/, kind: "row", rowRe: /Keyboard shortcuts/ },
  { name: "theme toggle", re: /^Switch to (light|dark) theme$/, kind: "row", rowRe: /Switch to (light|dark) theme/ },
  { name: "github", re: /^CryoFlow on GitHub \(opens in a new tab\)$/, kind: "row", rowRe: /Open CryoFlow on GitHub/ },
];
const EXEMPT_RULES = [
  { name: "palette trigger", re: /^Open command palette \(Ctrl\+K\)$/,
    reason: "self-referential — the palette IS the index; Ctrl+K is its own keyboard path" },
  { name: "print", re: /^Print this view$/,
    reason: "the verb already has a platform-native keyboard path (browser Ctrl+P/⌘P); the header button calls the same window.print()" },
];

// ---- Phase B: the law ---------------------------------------------------------
console.log("== PHASE B: the index-completeness law ==");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
let switchPosts = 0;
page.on("request", (r) => {
  if (r.method() === "POST" && r.url().includes("/api/projects/switch")) switchPosts++;
});
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

// enumerate the header's interactive doors — the WELL is the live DOM, not a
// hand list. label = aria-label || title (tabs carry title, the rest aria).
const doors = await page.evaluate(() => {
  const els = document.querySelectorAll("header button, header a");
  return [...els].map((el) => ({
    label: el.getAttribute("aria-label") || el.getAttribute("title") || "",
    title: el.getAttribute("title") || "",
  }));
});
must(doors.length === 12, `header door inventory pinned at 12 interactive elements (got ${doors.length})`);

// match every door against exactly one rule; flag unmapped doors.
const doorNames = doors.map((d) => d.label);
const matchedRules = new Set();
let unmapped = [];
for (const label of doorNames) {
  const cov = DOOR_RULES.find((r) => r.re.test(label));
  const ex = EXEMPT_RULES.find((r) => r.re.test(label));
  if (cov) matchedRules.add(cov.name);
  else if (ex) matchedRules.add(ex.name);
  else unmapped.push(label);
}
must(unmapped.length === 0, `every header door is covered or honestly exempt (unmapped: ${unmapped.join(" | ") || "none"})`);
must(matchedRules.size === DOOR_RULES.length + EXEMPT_RULES.length,
  `no stale rule — all ${DOOR_RULES.length + EXEMPT_RULES.length} rules matched a live door (matched ${matchedRules.size})`);

// open the palette and collect the index
await page.keyboard.press("Control+k");
await sleep(800);
const headings = await page.evaluate(() =>
  [...document.querySelectorAll("[cmdk-group-heading]")].map((el) => el.textContent.trim())
);
must(headings.includes("Projects"), "palette carries the Projects group (the gap, closed)");
must(headings.includes("Workspaces"), "Workspaces group still present (sibling dialect)");
const projIdx = headings.indexOf("Projects");
const wsIdx = headings.indexOf("Workspaces");
must(projIdx !== -1 && wsIdx !== -1 && projIdx < wsIdx, "group order: Projects before Workspaces (parent before child)");

const rowTexts = await page.evaluate(() =>
  [...document.querySelectorAll('[data-slot="command-item"]')].map((el) => el.innerText.trim())
);
must(rowTexts.length > 20, `palette index populated (got ${rowTexts.length} rows)`);

// resolve the live names from the doors' own titles
const projectDoor = doors.find((d) => /^Active project$/.test(d.label));
const projectName = projectDoor?.title?.trim() ?? "";
const wsDoor = doors.find((d) => /^Active workspace$/.test(d.label));
const wsName = (wsDoor?.title ?? "").replace(/^Workspace: /, "").split(" · ")[0].trim();
must(projectName.length > 0, `live project name read from the door's own title ("${projectName}")`);
must(wsName.length > 0, `live workspace name read from the door's own title ("${wsName}")`);

// the law, asserted per rule
for (const rule of DOOR_RULES) {
  if (rule.live === "project") {
    must(rowTexts.some((r) => r.includes(projectName) && r.includes("(active)")),
      `COVERED ${rule.name}: a Projects row carries the live project + (active)`);
  } else if (rule.live === "workspace") {
    must(rowTexts.some((r) => r.includes(wsName)),
      `COVERED ${rule.name}: a Workspaces row carries the live workspace`);
  } else {
    must(rowTexts.some((r) => rule.rowRe.test(r)), `COVERED ${rule.name}`);
  }
}
for (const rule of EXEMPT_RULES) {
  console.log(`  EXEMPT ${rule.name} — ${rule.reason}`);
}

// same-project guard: the active project's row closes quietly — no POST
const activeRow = page.locator('[data-slot="command-item"]', { hasText: "(active)" })
  .filter({ hasText: projectName }).first();
must((await activeRow.count()) === 1, "the active project's row is present");
await activeRow.click();
await sleep(800);
must(switchPosts === 0, `same-project guard: no /api/projects/switch POST fired (got ${switchPosts})`);
must((await page.locator('[data-slot="command-item"]').count()) === 0, "palette closed quietly (the honest no-op)");

// ---- the frame: the filtered palette shows the three truths at once ----------
mkdirSync(SHOTS, { recursive: true });
await page.keyboard.press("Control+k");
await sleep(600);
await page.keyboard.type("project");
await sleep(700);
const dialog = page.locator('[role="dialog"]').first();
if ((await dialog.count()) === 1) {
  await dialog.screenshot({ path: `${SHOTS}/t245-palette-index-2x.png` });
  console.log(`  frame: ${SHOTS}/t245-palette-index-2x.png`);
} else {
  must(false, "frame skipped — palette dialog not found");
}
await page.keyboard.press("Escape");
await page.close();

// ---- Phase C: synthetic two-project world + the GitHub door ------------------
console.log("== PHASE C: synthetic two-project world ==");
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page3 = await context.newPage();
const errors3 = [];
page3.on("pageerror", (e) => errors3.push(String(e)));
page3.on("console", (m) => m.type() === "error" && errors3.push(m.text()));

const projectA = {
  id: "cmu2xrrvi0000rrv49fcyhvos",
  name: "β-Galactosidase Tutorial (demo)",
  createdAt: "2026-09-15T17:18:55.710Z",
  mode: "spa",
  engine: "relion",
};
const projectB = {
  id: "synthetic-spliceosome-pilot",
  name: "Spliceosome Pilot (synthetic)",
  createdAt: "2026-09-16T06:00:00.000Z",
  mode: "spa",
  engine: "relion",
};
let switched = false;
// own the whole project URL family — by PATHNAME (the t244 glob lesson,
// refined: a URL family lives in the pathname, not in the raw URL string;
// a regex anchored ^ against the FULL url can never match — the url starts
// with "http:", not "/api"). Predicates are mutually exclusive and
// order-proof: the plural family /api/projects (GET list + POST switch),
// the singular /api/project exactly.
const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };
await page3.route((u) => pathOf(u).startsWith("/api/projects"), (route) => {
  const req = route.request();
  if (req.method() === "POST") {
    switched = true;
    void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  } else {
    void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ projects: [projectA, projectB] }) });
  }
});
await page3.route((u) => pathOf(u) === "/api/project", (route) => {
  void route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ project: switched ? projectB : projectA }),
  });
});
await context.route(/github\.com/, (route) => {
  void route.fulfill({ status: 200, contentType: "text/html", body: "<html><title>synthetic github</title></html>" });
});
await page3.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

await page3.keyboard.press("Control+k");
await sleep(800);
const rows3 = await page3.evaluate(() =>
  [...document.querySelectorAll('[data-slot="command-item"]')].map((el) => el.innerText.trim())
);
// match by NAME, not by the hint text — the hint span renders uppercase
// (text-transform), so innerText says "SWITCH PROJECT" and a lowercase
// matcher finds nothing
must(rows3.filter((r) => r.includes(projectA.name) || r.includes(projectB.name)).length === 2,
  "synthetic world: two Projects rows");
const rowA = page3.locator('[data-slot="command-item"]', { hasText: projectA.name }).first();
const rowB = page3.locator('[data-slot="command-item"]', { hasText: projectB.name }).first();
must((await rowA.innerText()).includes("(active)"), "project A carries the (active) marker");
must(!(await rowB.innerText()).includes("(active)"), "project B does not (the truth, marked once)");

// switch from the keyboard layer: click B's row → POST once → header re-titles
await rowB.click();
await sleep(2000); // POST + load() refetch
must(switched === true, "the palette row fired /api/projects/switch (the same store action the header uses)");
const trigger3 = page3.locator('header [aria-label="Active project"]');
must((await trigger3.getAttribute("title")) === projectB.name,
  "header Active-project trigger re-titled to the new project (one store, every mouth follows)");
await page3.keyboard.press("Control+k");
await sleep(800);
const rowA2 = page3.locator('[data-slot="command-item"]', { hasText: projectA.name }).first();
const rowB2 = page3.locator('[data-slot="command-item"]', { hasText: projectB.name }).first();
must((await rowB2.innerText()).includes("(active)") && !(await rowA2.innerText()).includes("(active)"),
  "reopened palette: the (active) marker flipped (the index reads the store, not a stale copy)");

// the GitHub door answers with a real popup at the repo URL — the palette
// stays open here: the row's own onSelect closes it before window.open
const ghRow = page3.getByRole("option", { name: /Open CryoFlow on GitHub/ });
must((await ghRow.count()) === 1, "GitHub row present (the door that earned a row, not an exemption)");
const popupPromise = page3.waitForEvent("popup", { timeout: 8000 });
await ghRow.click();
const popup = await popupPromise;
must(popup.url().includes("github.com/Jing0715-fer/cryoflow"), `GitHub row opens the repo in a new tab (got ${popup.url()})`);

// ---- Phase D: console ---------------------------------------------------------
console.log("== PHASE D: console ==");
must(errors.length === 0, `console clean in demo world (got ${errors.length}: ${errors.slice(0, 2).join(" | ")})`);
must(errors3.length === 0, `console clean in synthetic world (got ${errors3.length}: ${errors3.slice(0, 2).join(" | ")})`);

await context.close();
await browser.close();
if (fail > 0) {
  console.error(`t245: ${fail} FAIL`);
  process.exit(1);
}
console.log("t245: ALL PASS");
