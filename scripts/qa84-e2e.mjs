// qa84 — The dashboard Jobs roster is a REAL table (Task 84).
// Task 79 unrolled the roster onto paper; the one thing it deliberately
// skipped was a repeated header across pages ("thead repeats, div lists
// don't"). Probes (t84-table-probe/2) closed the question: Chromium ONLY
// repeats the header of REAL <table> elements — display:table divs and
// generated tables keep their header on page one. So the roster now ships
// a real <thead> in the DOM: neutralized to plain blocks on screen (the
// div-list look is pixel-preserved; the label row above the box speaks),
// reverted to table semantics in print, where the band "Jobs · N · newest
// first" repeats on every page the roster spans.
// Phases:
//   S  setup — filler jobs push the roster past one page (the ambient 12
//      fit on a single sheet: repetition would go UNEXERCISED); tripwire
//   A  screen parity — scaffolding neutralized, thead hidden, rows intact
//   B  print semantics — table/table-header-group/table-row/table-cell,
//      row atomicity + name unwrap survive, label row no-print
//   C  paper — every page that shows roster rows carries the band; the
//      band repeats; all names present; CTA still absent
//   D  console clean
//   Z  cleanup — fillers deleted, verified over the API
// Run: node scripts/qa84-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t84-roster.pdf";
const FILLER = "QA84 Filler";
const TARGET_ROWS = 20; // ~20 × 55px ≈ 1100px > one A4 page of roster

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// qa77 lesson: payloads ride the init, or the call silently downgrades.
const req = async (path, method, body) => {
  const res = await fetch(BASE + path, body
    ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : { method });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const api = (path, body) => body ? req(path, "PATCH", body) : req(path, "GET");
const listJobs = async () => (await api("/api/jobs")).json.jobs ?? [];

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(400);

/* ---------------- Phase S: push the roster past one page ---------------- */
console.log("Phase S — filler setup");
let jobs0 = await listJobs();
// the roster shows the ACTIVE project; ambient state has Sandbox C up —
// anchor on a known member so the fillers land in the same roster
const host = jobs0.find((j) => j.name === "QA Class Select") ?? jobs0[0];
must(host != null && !!host.projectId, "S1 host job with a project found");
const projJobs = () => listJobs().then((js) => js.filter((j) => j.projectId === host.projectId));
let before = await projJobs();
must(before.length >= 8, `S2 roster project has enough ambient rows (got ${before.length})`);
const created = [];
let i = 1;
while (before.length + created.length < TARGET_ROWS) {
  const r = await req("/api/jobs", "POST", {
    type: "import",
    x: 900 + (i % 4) * 40,
    y: 900 + i * 30,
    workspaceId: host.workspaceId ?? undefined,
    projectId: host.projectId,
  });
  const j = r.json.job ?? r.json;
  if (j?.id) {
    await api(`/api/jobs/${j.id}`, { name: `${FILLER} ${String(i).padStart(2, "0")}` });
    created.push(j.id);
  }
  i++;
  if (i > 40) break; // runaway guard
}
must(created.length > 0 || before.length >= TARGET_ROWS,
  `S3 roster pushed past one page (created ${created.length}, total ${before.length + created.length})`);
await sleep(2500); // outlive any zombie debounce window
const mid = await projJobs();
const fillerNames = mid
  .filter((j) => j.name.startsWith(FILLER))
  .map((j) => j.name)
  .sort();
must(fillerNames.length === created.length,
  `S4 fillers survived the zombie window (got ${fillerNames.length}/${created.length})`);

/* ---------------- browser ---------------- */
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 4 && (await curView()) !== "dashboard"; i++) {
  await p.keyboard.press("Shift+D");
  await sleep(700);
}
must((await curView()) === "dashboard", "A0 dashboard view reached");

/* ---------------- Phase A: screen parity ---------------- */
console.log("Phase A — screen parity");
const screen = await p.evaluate(() => {
  const spot = 'section[aria-label="Active project spotlight"]';
  const table = document.querySelector(`${spot} [data-roster-table]`);
  const head = document.querySelector(`${spot} [data-roster-head]`);
  const rows = [...document.querySelectorAll(`${spot} [data-roster-row]`)];
  const tds = [...document.querySelectorAll(`${spot} [data-roster-table] td`)];
  const labelRow = table?.closest("div")?.parentElement?.querySelector(".no-print");
  const firstName = rows[0]?.querySelector("button .truncate")?.textContent?.trim() ?? "";
  return {
    tableDisplay: table ? getComputedStyle(table).display : null,
    headDisplay: head ? getComputedStyle(head).display : null,
    rowCount: rows.length,
    tdDisplay: tds[0] ? getComputedStyle(tds[0]).display : null,
    firstRowHeight: rows[0]?.getBoundingClientRect().height ?? 0,
    firstName,
  };
});
must(screen.tableDisplay === "block", `A1 scaffolding neutralized on screen (got ${screen.tableDisplay})`);
must(screen.headDisplay === "none", "A2 thead hidden on screen (label row speaks)");
must(screen.tdDisplay === "block", "A3 td is a plain block on screen");
must(screen.rowCount >= TARGET_ROWS, `A4 roster rows include the fillers (got ${screen.rowCount})`);
must(screen.firstRowHeight > 30 && screen.firstRowHeight < 90,
  `A5 first row height sane, no layout explosion (${Math.round(screen.firstRowHeight)}px)`);
must(screen.firstName.length > 0, "A6 first row exposes its name");

/* ---------------- Phase B: print semantics ---------------- */
console.log("Phase B — print semantics");
await p.emulateMedia({ media: "print" });
await sleep(400);
const print = await p.evaluate(() => {
  const spot = 'section[aria-label="Active project spotlight"]';
  const table = document.querySelector(`${spot} [data-roster-table]`);
  const head = document.querySelector(`${spot} [data-roster-head]`);
  const row = document.querySelector(`${spot} [data-roster-row]`);
  const tr = row?.closest("tr");
  const td = row?.closest("td");
  const nameSpan = row?.querySelector("button .truncate");
  const labelRow = table?.closest("div")?.parentElement?.querySelector(".no-print");
  const cs = (el) => (el ? getComputedStyle(el) : null);
  return {
    tableDisplay: cs(table)?.display ?? "",
    tableBreak: cs(table)?.breakInside ?? "",
    headDisplay: cs(head)?.display ?? "",
    headText: head?.textContent?.trim() ?? "",
    trDisplay: cs(tr)?.display ?? "",
    trBreak: cs(tr)?.breakInside ?? "",
    tdDisplay: cs(td)?.display ?? "",
    nameWrap: cs(nameSpan)?.whiteSpace ?? "",
    labelDisplay: cs(labelRow)?.display ?? "",
  };
});
must(print.tableDisplay === "table", `B1 table is a real table in print (got ${print.tableDisplay})`);
must(print.tableBreak === "auto", `B2 table may split across pages (got ${print.tableBreak})`);
must(print.headDisplay === "table-header-group", `B3 thead is a repeating header group (got ${print.headDisplay})`);
must(print.trDisplay === "table-row" && print.trBreak === "avoid",
  `B4 rows are atomic table-rows (got ${print.trDisplay}/${print.trBreak})`);
must(print.tdDisplay === "table-cell", `B5 cells are table-cells (got ${print.tdDisplay})`);
must(print.nameWrap === "normal", `B6 name unwrap survives the restructure (got ${print.nameWrap})`);
must(print.labelDisplay === "none", "B7 screen label row is no-print (band is the only identity)");
must(print.headText === `Jobs · ${screen.rowCount} · newest first`,
  `B8 band text matches the live slice (got "${print.headText}")`);

/* ---------------- Phase C: paper ---------------- */
console.log("Phase C — paper");
rmSync(OUT, { force: true });
await p.pdf({ path: OUT, printBackground: true });
await p.emulateMedia({ media: "screen" });
const raw = readFileSync(OUT).toString("latin1");
const counts = [...raw.matchAll(/\/Count (\d+)/g)].map((m) => +m[1]);
const pages = Math.max(...counts, 0);
must(pages >= 3, `C1 dashboard paginates with the long roster (got ${pages} pages)`);
const flat = (s) => s.replace(/\s+/g, "");
// one NAME per row (the first truncate inside the open button) — the row
// also carries result/ws-badge truncates that would over-match (first-run
// lesson: `button .truncate` collected 34 "names" for 12 rows)
const names = await p.evaluate(() =>
  [...document.querySelectorAll('section[aria-label="Active project spotlight"] [data-roster-row]')]
    .map((r) => r.querySelector("button .truncate")?.textContent?.trim() ?? "")
    .filter(Boolean)
);
const paperPages = [];
let bandPageCount = 0;
let rowPageWithoutBand = 0;
// match the FULL band text ("jobs·20·newestfirst") — a bare "jobs·" also
// matches the PrintDocHeader/KPI "12 jobs · 3 edges" on every page
const bandNeedle = `jobs·${screen.rowCount}·newestfirst`;
for (let i = 1; i <= pages; i++) {
  const t = flat(execSync(`pdftotext -f ${i} -l ${i} ${OUT} -`, { encoding: "utf8" }));
  paperPages.push(t);
  const hasBand = t.toLowerCase().includes(bandNeedle); // th prints UPPERCASE — match case-blind
  // roster-page heuristic: filler name + "not started" CO-PRESENT. The
  // recent-activity feed also shows filler names (they were just touched!)
  // — first-run lesson: page 1 carried 8 filler names from the feed alone.
  // Roster idle rows render the "not started" result line; feed rows never do.
  const hasRow = fillerNames.some((f) => t.includes(flat(f))) && t.includes("notstarted");
  if (hasBand) bandPageCount++;
  if (hasRow && !hasBand) rowPageWithoutBand++;
}
must(bandPageCount >= 2, `C2 the band REPEATS (on ${bandPageCount} pages)`);
must(rowPageWithoutBand === 0, "C3 every page that shows roster rows carries the band");
const paper = paperPages.join("");
const missing = names.filter((n) => !paper.includes(flat(n)));
must(names.length >= TARGET_ROWS && missing.length === 0,
  `C4 all ${names.length} names on paper (missing: ${missing.join(", ") || "none"})`);
must(!paper.includes("Openworkflow") && !paper.includes("Switch&Open"), "C5 CTA still absent from paper");
must(!/Jobsnewestfirst/.test(paper) || bandPageCount >= 1, "C6 no unscoped label text (band is the identity)");
await b.close();

/* ---------------- Phase D: console ---------------- */
console.log("Phase D — console");
must(consoleErrors.length === 0, `D1 console clean (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 120) : ""})`);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
for (const id of created) await req(`/api/jobs/${id}`, "DELETE");
await sleep(800);
const after = await listJobs();
const leftovers = after.filter((j) => j.name.startsWith(FILLER));
must(leftovers.length === 0, `Z1 fillers deleted (got ${leftovers.length} left)`);
const restored = after.filter((j) => j.projectId === host.projectId).length;
must(restored === before.length, `Z2 roster restored to ${before.length} rows (got ${restored})`);

console.log(fail === 0 ? "QA84 ALL PASS" : `QA84 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
