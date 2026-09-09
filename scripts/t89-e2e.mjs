// t89 — params diff FOURTH entry: dashboard roster row-level Compare.
// Task 88's sibling picker was inspector-private; Task 89 extracts it into
// sibling-compare-picker.tsx (one sibling list, one ordering, one chip
// brain) and mounts it on every dashboard roster row as a hover-revealed
// icon button — the survey surface, where "compare run 1 vs run 2" spans
// ALL workspaces at once.
// Phases:
//   S  setup — anchor = an EXISTING motioncorr row; seed two idle t89
//      motioncorr siblings (one local, one in a fresh "t89 Offsite"
//      workspace); expected chips/order/count all COMPUTED from the API
//      at runtime (data-driven — no hardcoded param story)
//   A  affordance — every roster row's button presence matches the API
//      census exactly (both directions); hover reveals the icon;
//      data-sibling-count matches the census
//   B  picker — popover lists siblings in the picker's canonical order
//      (same-workspace first, cross-workspace last), cross-workspace chip
//      shows the workspace name, chips match computed truth
//   C  dialog — picking a sibling opens ParamsDiffDialog with the ROW job
//      anchored left (teal); Esc closes
//   D  static contracts — hover-none opt-in (source + compiled CSS),
//      no-print on the trigger
//   E  console clean
//   Z  cleanup verified over the API (jobs + the t89 workspace gone)
// Run: node scripts/t89-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const NAME_A = "t89 Mc A";
const NAME_B = "t89 Mc B";
const WS_OFF = "t89 Offsite";
const SPOT = 'section[aria-label="Active project spotlight"]';

let fail = 0;
let pass = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (cond) pass++; else fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, method, body) => {
  const res = await fetch(BASE + path, {
    method: method ?? (body ? "PATCH" : "GET"),
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const listJobs = async () => (await api("/api/jobs")).json.jobs ?? [];
const listWs = async () =>
  (await api("/api/workspaces")).json.workspaces ??
  (await api("/api/workspaces")).json ?? [];

/** inline reimplementation of the shared diff brain (2-job summarize) —
 *  the EXPECTED chip text is derived from the API truth, not hardcoded */
const ser = (v) => JSON.stringify(v) ?? "null";
const summarize2 = (pa, pb) => {
  const keys = new Set([...Object.keys(pa ?? {}), ...Object.keys(pb ?? {})]);
  let changed = 0, partial = 0, same = 0;
  for (const k of keys) {
    const a = pa?.[k], b = pb?.[k];
    const missing = a === undefined || b === undefined;
    const distinct = new Set([a, b].filter((v) => v !== undefined).map(ser));
    if (distinct.size > 1) changed++;
    else if (missing) partial++;
    else same++;
  }
  return { changed, partial, same, total: keys.size };
};
const chipText = (pa, pb) => {
  const s = summarize2(pa, pb);
  if (s.total === 0) return "no params";
  if (s.changed === 0 && s.partial === 0) return "identical";
  const parts = [];
  if (s.changed > 0) parts.push(`${s.changed} differ`);
  if (s.partial > 0) parts.push(`${s.partial} one-sided`);
  return parts.join(" · ");
};
// the chip renders "·" as a flex-gap-separated span — textContent carries
// no spaces; normalize BOTH sides around the separator before comparing
const norm = (t) => t.replace(/\s*·\s*/g, " · ").trim();

// the picker's canonical sibling filter + ordering (mirror of the shared
// component — the EXPECTED universe is derived from API truth)
const siblingCensus = (jobs) => {
  // how many same-type non-link siblings each job has
  const map = new Map();
  for (const j of jobs) {
    const n = jobs.filter(
      (k) => k.type === j.type && k.id !== j.id && k.linkedJobId == null
    ).length;
    map.set(j.id, n);
  }
  return map;
};
const expectedOrder = (jobs, anchor, activeWsId) =>
  jobs
    .filter((j) => j.type === anchor.type && j.id !== anchor.id && j.linkedJobId == null)
    .sort((a, b) => {
      const aLocal = (a.workspaceId ?? null) === (activeWsId ?? null) ? 0 : 1;
      const bLocal = (b.workspaceId ?? null) === (activeWsId ?? null) ? 0 : 1;
      return aLocal - bLocal || a.createdAt.localeCompare(b.createdAt);
    })
    .map((j) => j.name);

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- setup ---------------- */
console.log("Phase S — setup");
// pre-clean a crashed earlier run (jobs AND the offsite workspace)
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t89 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
for (const w of (await listWs()).filter((w) => w.name === WS_OFF)) {
  await api(`/api/workspaces/${w.id}`, "DELETE");
}
await sleep(1200);
const jobsBefore = (await listJobs()).length;
const wsBefore = (await listWs()).length;

// anchor: an existing motioncorr row (any status works on the roster —
// unlike the inspector, the survey surface imposes no submitted-only rule;
// a completed anchor keeps the story realistic)
const anchor = (await listJobs()).find(
  (j) => j.type === "motioncorr" && j.status === "completed" && !j.name.startsWith("t89")
);
must(anchor != null, `S1 completed motioncorr anchor found (${anchor?.name ?? "none"})`);

// offsite workspace first (the offsite sibling needs its id)
const mkWs = await api("/api/workspaces", "POST", { name: WS_OFF });
must(mkWs.status === 200 || mkWs.status === 201, `S2 offsite workspace created (${mkWs.status})`);
const offWsId = (mkWs.json.workspace ?? mkWs.json).id;

const mainWsId = anchor.workspaceId;
const mk = async (name, extra) => {
  const r = await api("/api/jobs", "POST", {
    type: "motioncorr", name, x: anchor.x + 700, y: anchor.y + 560,
    projectId: anchor.projectId ?? undefined, ...extra,
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`POST ${name}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.job;
};
const twinA = await mk(NAME_A, { workspaceId: mainWsId, params: { patchX: 7, dosePerFrame: 1.4 } });
const twinB = await mk(NAME_B, { workspaceId: offWsId, params: { patchX: 5, dosePerFrame: 1.28, bfactor: 150 } });
must(!!twinA?.id && !!twinB?.id, "S3 two t89 siblings seeded (local + offsite)");

// tripwire: re-read AFTER the debounce window; every expectation below
// derives from what the API actually holds (the zombie-window lesson, t87 S3)
await sleep(2000);
const truth = await listJobs();
const anchorNow = truth.find((j) => j.id === anchor.id);
const aNow = truth.find((j) => j.id === twinA.id);
const bNow = truth.find((j) => j.id === twinB.id);
const expA = chipText(anchorNow.params, aNow.params);
const expB = chipText(anchorNow.params, bNow.params);
must(expA.length > 0 && expB.length > 0,
  `S4 expected chips computed from API truth (A "${expA}" · B "${expB}")`);

// census over API truth: how many rows SHOULD carry a compare button
const census = siblingCensus(truth);
const withSiblings = truth.filter((j) => (census.get(j.id) ?? 0) > 0).length;
must(withSiblings >= 2, `S5 census computed (${withSiblings} rows should carry the affordance)`);

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
await sleep(800); // roster hydration + seeds rendering

/* ---------------- Phase A: affordance census ---------------- */
console.log("Phase A — affordance census");
const dom = await p.evaluate((spotSel) => {
  const rows = [...document.querySelectorAll(`${spotSel} [data-roster-row]`)];
  return rows.map((row) => {
    const btn = row.querySelector('[data-testid="roster-compare-button"]');
    return {
      name: row.querySelector("button .truncate")?.textContent?.trim() ?? "",
      hasBtn: !!btn,
      siblingCount: btn?.getAttribute("data-sibling-count") ?? null,
      opacity: btn ? getComputedStyle(btn).opacity : null,
    };
  });
}, SPOT);
must(dom.length === truth.length,
  `A1 roster row count matches the API truth (${dom.length} == ${truth.length})`);
const domWithBtn = dom.filter((r) => r.hasBtn).length;
must(domWithBtn === withSiblings,
  `A2 button presence matches the census in BOTH directions (${domWithBtn} == ${withSiblings})`);
const rowA = dom.find((r) => r.name === NAME_A);
const rowAnchor = dom.find((r) => r.name === anchor.name);
must(rowA != null && rowAnchor != null, "A3 seeded rows render in the roster");
must(rowAnchor.siblingCount === String(census.get(anchor.id)),
  `A4 data-sibling-count matches the census (${rowAnchor?.siblingCount} == ${census.get(anchor.id)})`);

// hover-reveal: the headless browser matches (hover: none) per the
// globals.css contract, so the functional control sits at opacity 1 —
// but the assertion survives a hover-capable environment too (hover first)
const anchorRowLoc = p.locator(`${SPOT} [data-roster-row]`, { hasText: anchor.name }).first();
await anchorRowLoc.hover();
await sleep(300);
const reveal = await p.evaluate(({ spotSel, anchorName }) => {
  const row = [...document.querySelectorAll(`${spotSel} [data-roster-row]`)]
    .find((r) => r.querySelector("button .truncate")?.textContent?.trim() === anchorName);
  const btn = row?.querySelector('[data-testid="roster-compare-button"]');
  return btn ? getComputedStyle(btn).opacity : null;
}, { spotSel: SPOT, anchorName: anchor.name });
must(reveal === "1", `A5 trigger visible after hover (opacity ${reveal})`);

/* ---------------- Phase B: picker surface ---------------- */
console.log("Phase B — picker surface");
await p.locator(`${SPOT} [data-roster-row]`, { hasText: anchor.name })
  .first()
  .locator('[data-testid="roster-compare-button"]').click();
await p.waitForSelector('[data-testid="roster-compare-popover"]');
await sleep(400);
const expNames = expectedOrder(truth, anchorNow, mainWsId);
const pk = await p.evaluate(() => {
  const pop = document.querySelector('[data-testid="roster-compare-popover"]');
  const rows = [...(pop?.querySelectorAll('[data-testid="roster-compare-option"]') ?? [])];
  return rows.map((r) => ({
    name: r.getAttribute("data-sibling-name"),
    wsChip: r.querySelector('[title^="Runs in workspace"]')?.textContent?.trim() ?? null,
    chip: r.querySelector('[data-testid="roster-sibling-diff"]')?.textContent?.trim() ?? "",
    kind: r.querySelector('[data-testid="roster-sibling-diff"]')?.getAttribute("data-diff-kind") ?? "",
  }));
});
must(JSON.stringify(pk.map((r) => r.name)) === JSON.stringify(expNames),
  `B1 sibling list == API-truth order (${JSON.stringify(pk.map((r) => r.name))} vs ${JSON.stringify(expNames)})`);
const aRow = pk.find((r) => r.name === NAME_A);
const bRow = pk.find((r) => r.name === NAME_B);
must(aRow.wsChip === null, "B2 local sibling carries no workspace chip");
must(bRow.wsChip === WS_OFF, `B3 offsite sibling shows its workspace chip (${bRow.wsChip})`);
must(norm(aRow.chip) === norm(expA) && aRow.kind === (expA === "identical" ? "same" : "differs"),
  `B4 local chip matches the computed truth ("${aRow.chip}" vs "${expA}")`);
must(norm(bRow.chip) === norm(expB) && bRow.kind === (expB === "identical" ? "same" : "differs"),
  `B5 offsite chip matches the computed truth ("${bRow.chip}" vs "${expB}")`);
const chipCount = await p.evaluate(() =>
  document.querySelectorAll('[data-testid="roster-compare-popover"] [data-testid="roster-sibling-diff"]').length);
must(chipCount === pk.length, "B6 every row carries a diff chip (no naked rows)");

/* ---------------- Phase C: dialog from the roster ---------------- */
console.log("Phase C — dialog from the roster");
await p.locator(`[data-testid="roster-compare-option"][data-sibling-name="${NAME_A}"]`).click();
await p.waitForSelector('[data-testid="params-diff-dialog"]');
await p.waitForSelector('[data-testid="roster-compare-popover"]', { state: "detached" });
await sleep(400);
const dl = await p.evaluate(() => {
  const dlg = document.querySelector('[data-testid="params-diff-dialog"]');
  const section = dlg?.querySelector('[data-testid="fsc-params-diff"]');
  return {
    desc: [...(dlg?.querySelectorAll("p") ?? [])].map((x) => x.textContent?.trim() ?? "")
      .find((t) => t.includes("left column")) ?? "",
    cols: [...(section?.querySelectorAll("thead th[title]") ?? [])].map((t) => t.getAttribute("title")),
  };
});
must(dl.cols.length === 2 && dl.cols[0]?.startsWith(anchor.name),
  `C1 ROW job anchored LEFT (cols ${JSON.stringify(dl.cols.map((c) => c?.slice(0, 22)))})`);
must(dl.desc.includes(`left column: ${anchor.name}`),
  `C2 description names the left column ("${dl.desc.slice(-46)}")`);
await p.keyboard.press("Escape");
await sleep(400);
const dlgGone = await p.evaluate(() => !document.querySelector('[data-testid="params-diff-dialog"]'));
must(dlgGone, "C3 Esc closes the dialog (no inspector layer involved here)");

/* ---------------- Phase D: static contracts ---------------- */
console.log("Phase D — static contracts");
const srcDash = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");
must(srcDash.includes("hover-none:opacity-100") && srcDash.includes("no-print opacity-0"),
  "D1 roster trigger opts into hover-none reveal + no-print (source)");
const cssAll = readdirSync(".next/static/chunks")
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(`.next/static/chunks/${f}`, "utf8"))
  .join("\n");
must(cssAll.includes("@media (hover:none){.hover-none\\:opacity-100{opacity:1}}"),
  "D2 compiled CSS gates the reveal utility (qa69 contract)");
must(readFileSync("src/components/workflow/sibling-compare-picker.tsx", "utf8").length > 0,
  "D3 shared picker module exists (single source for entries 3+4)");

/* ---------------- Phase E: console ---------------- */
console.log("Phase E — console");
must(consoleErrors.length === 0, `E1 console clean (got ${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).map((e) => `    ${e.slice(0, 160)}`).join("\n"));

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
await b.close();
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t89 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
await sleep(1200);
for (const w of (await listWs()).filter((w) => w.name === WS_OFF)) {
  await api(`/api/workspaces/${w.id}`, "DELETE");
}
await sleep(1500);
const residual = (await listJobs()).filter((j) => j.name.startsWith("t89 "));
must(residual.length === 0, `Z1 t89 jobs deleted (got ${residual.length})`);
const jobsAfter = (await listJobs()).length;
must(jobsAfter === jobsBefore, `Z2 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
const wsAfter = (await listWs()).length;
must(wsAfter === wsBefore, `Z3 workspace count restored (${wsAfter} == baseline ${wsBefore})`);

console.log(fail === 0 ? `\nT89 ALL PASS (${pass} assertions)` : `\nT89 ${fail} FAIL / ${pass} pass`);
process.exit(fail === 0 ? 0 : 1);
