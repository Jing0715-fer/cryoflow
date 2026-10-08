// t687 — the dashboard's two mouths meet on one screen: the analytics
// critical block and the roster's rank chips read the SAME walk, and the
// block finally says so in its own ink.
//
// The family's contract so far was asserted mouth-by-mouth: t681 pinned
// the analytics block against an independent mirror, t686 pinned the
// roster against the mirror AND the roster chip against the canvas chip.
// But the two dashboard mouths share a SCREEN and never shared an
// assertion — nothing pinned "roster chip steps == analytics block
// steps" while both are visible at once. t687 pins the same-screen
// contract where the reader actually stands.
//
// Three honest additions:
//   · step numbers in ink — the bar's title always said "step i+1 of N"
//     but only on hover; the roster's rank chips made the order visible
//     from across the dashboard; the chain's own REPORT should not be
//     the one face where the sequence needs a tooltip. A report's row
//     number is its native tongue (t686's law, at home).
//   · the scoped confession — with a workspace chip carving the world,
//     the block's chain is the chain WITHIN the scope (the walk drinks
//     the scoped rows) and can legitimately differ from the project-wide
//     chain the roster speaks. Silence would let a reader read "the"
//     critical path when the block is speaking "a" one; the header now
//     says "within <scope>".
//   · the lens-stays-out guarantee — the critical lens dims job
//     ENTITIES (cards, dots, rows); the analytics block is an aggregate
//     face and the chain's ally (all ink, no recession). Asserted: with
//     the lens on, the block's computed opacity stays 1.
//
// Legs:
//   S  rest world: scope=all — the block stands, the numbers read 1..N,
//      no "within" footnote, the roster confesses nothing
//   A  P on the dashboard: the SAME SCREEN carries both mouths and both
//      count the mirror's chain
//   B  rank mutual recognition: analytics (id → num) equals roster
//      (id → rank) step for step; the row order IS the walk order
//   C  the scoped truth: a workspace chip re-speaks the block (scoped
//      mirror), the footnote confesses, the roster chip doesn't move
//   📸 the block with the lens on — numbers, bars, the roster dimmed behind
//   D  the lens-stays-out guarantee + dismissal still alive
//   E  teardown + noise buckets
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";
// t681's key: the probe's Prisma must see the SAME db the prod server sees
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};

// ---------- the independent arithmetic (mirrors lib/timeline-walk +
// lib/critical-path WITHOUT importing them — the family mirror verbatim) ----------
const laterOf = (a, b) => {
  if (a.end !== b.end) return a.end > b.end ? a : b;
  if (a.start !== b.start) return a.start > b.start ? a : b;
  return a.job.name.localeCompare(b.job.name) <= 0 ? a : b;
};
const expectedChain = (jobs, edges) => {
  const rows = jobs
    .filter((j) => j.startedAt && (j.status === "completed" || j.status === "failed"))
    .map((j) => {
      const start = new Date(j.startedAt).getTime();
      const end = start + Math.max(1000, j.duration ?? 0);
      return { job: j, start, end, ms: Math.max(1000, end - start) };
    })
    .filter((r) => Number.isFinite(r.start) && r.end > r.start);
  if (rows.length === 0) return null;
  const byId = new Map(rows.map((r) => [r.job.id, r]));
  const preds = new Map();
  for (const e of edges) {
    const f = byId.get(e.fromJobId), t = byId.get(e.toJobId);
    if (!f || !t) continue;
    if (!preds.has(t.job.id)) preds.set(t.job.id, []);
    preds.get(t.job.id).push({ row: f, edgeId: e.id ?? null });
  }
  let entry = rows.reduce(laterOf);
  const rev = [];
  let cur = entry, via = null, guard = rows.length + 1;
  while (cur && guard-- > 0) {
    const ps = preds.get(cur.job.id) ?? [];
    const driver = ps.length ? ps.reduce((a, b) => (laterOf(a.row, b.row) === b.row ? b : a)) : null;
    rev.push({ job: cur.job, start: cur.start, end: cur.end, ms: cur.ms, viaEdgeId: via });
    if (!driver) break;
    cur = driver.row;
    via = driver.edgeId;
  }
  const chain = rev.reverse();
  return {
    chain,
    jobIds: chain.map((s) => s.job.id),
    edgeIds: chain.map((s) => s.viaEdgeId).filter((x) => x != null),
    entryId: entry.job.id,
  };
};

// ---------- S: world read ----------
mkdirSync(".qa-logs", { recursive: true });
const roster0 = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
const edges0 = await fetch(`${BASE}/api/edges`).then((r) => r.json()).then((j) => j.edges ?? j);
const wss = await fetch(`${BASE}/api/workspaces`).then((r) => r.json()).then((w) => w.workspaces ?? w);
const chain = expectedChain(roster0, edges0);
if (!chain || chain.chain.length < 2) {
  console.error("setup: the world has no chain to speak of");
  process.exit(1);
}
const N = chain.chain.length;
console.log(`· baseline: ${roster0.length} jobs, ${edges0.length} edges, ${wss.length} workspaces, chain of ${N} (root "${chain.chain[0].job.name}" → finisher "${chain.chain[N - 1].job.name}")`);

// ---------- browser + instruments ----------
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [], hmrNoise = [], resourceFlap = [], resource404 = [], chunkFlap = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => {
  if (/Failed to load chunk/.test(e.message)) { chunkFlap.push(e.message); return; }
  consoleErrors.push(`pageerror: ${e.message}`);
});

const gotoDashboard = async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await switchDashboard();
};
const switchDashboard = async (expectedRows = roster0.length) => {
  await sleep(2500);
  await pollUntil(async () => (await page.locator("[data-job]").count()) > 0 || null, 15000);
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await pollUntil(async () => (await page.locator("[data-roster-row]").count()) === expectedRows || null, 15000);
};

const readBlockSteps = async () => {
  const el = page.locator('[data-canvas-ui="analytics-critical"]');
  if ((await el.count()) !== 1) return null;
  const v = await el.getAttribute("data-critical-steps");
  return v ? Number(v) : null;
};
const readRosterChipSteps = async () => {
  const el = page.locator("[data-roster-lens-chip]");
  if ((await el.count()) !== 1) return null;
  const v = await el.getAttribute("data-roster-lens-steps");
  return v ? Number(v) : null;
};

await gotoDashboard();

// ---------- S: rest world — the block stands, silent about any scope ----------
const blockUp = await pollUntil(async () => (await readBlockSteps()) === N || null, 12000);
must(!!blockUp, "S the analytics critical block stands at the mirror's count (scope=all)", `${await readBlockSteps()} (expected ${N})`);

const nums = await page.locator("[data-critical-row]").evaluateAll((els) =>
  els.map((el) => ({
    id: el.getAttribute("data-critical-row"),
    idx: Number(el.getAttribute("data-critical-index")),
    num: Number(el.getAttribute("data-critical-step-num")),
  }))
);
must(nums.length === N, "S every step wears its number in ink", `${nums.length}/${N}`);
must(nums.every((r) => r.num === r.idx + 1), "S each number equals its index + 1 (no off-by-one)");
must(nums.map((r) => r.num).join(",") === Array.from({ length: N }, (_, i) => i + 1).join(","),
  "S the numbers read 1..N with no gaps");
must((await page.locator("[data-critical-scope]").count()) === 0,
  "S scope=all — the block confesses no scope (the whole world needs no footnote)");
must((await page.locator("[data-roster-lens-chip]").count()) === 0,
  "S lens off — the roster confesses nothing (the rest world is quiet)");

// ---------- A: the same-screen contract ----------
await page.keyboard.press("p");
const chipSteps = await pollUntil(async () => (await readRosterChipSteps()) === N ? N : null, 8000);
must(chipSteps === N, "A P turns the lens on — the roster chip counts the mirror's chain", `${chipSteps} (expected ${N})`);
const blockStepsOnLens = await readBlockSteps();
must(blockStepsOnLens === N,
  "A the analytics block, same screen, counts the same chain", `${blockStepsOnLens} (expected ${N})`);
must(chipSteps === N && blockStepsOnLens === N,
  "A the same-screen contract: roster chip == analytics block == mirror — two mouths, one walk, zero shared memory");

// ---------- B: rank mutual recognition ----------
const rosterRanks = await page.locator("[data-roster-row][data-roster-chain]").evaluateAll((els) =>
  els.map((el) => ({ id: el.getAttribute("data-job-id"), rank: Number(el.getAttribute("data-roster-chain-rank")) }))
);
const rosterByRank = new Map(rosterRanks.map((r) => [r.rank, r.id]));
const agree = nums.every((r) => rosterByRank.get(r.num) === r.id);
must(agree, "B analytics (id → num) equals roster (id → rank), step for step — the ranks recognize each other across the screen");
must(nums[0]?.id === chain.jobIds[0], "B the block's first row is the walk's root", chain.jobIds[0]);
must(nums[N - 1]?.id === chain.jobIds[N - 1], "B the block's last row is the walk's finisher");
must(JSON.stringify(nums.map((r) => r.id)) === JSON.stringify(chain.jobIds),
  "B the block's row order IS the mirror's walk order (data-critical-index sequence)");

// ---------- 📸 the block with the lens on ----------
await page.locator('[data-canvas-ui="analytics-critical"]').first().scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(2600); // the dash-motion cascade settles ~1238ms after mount (t576/t613)
await page.screenshot({ path: ".qa-logs/t687-critical-handshake.png" });

// ---------- C: the scoped truth ----------
// The demo world holds ONE workspace — the scope chips render only when
// more than one option exists, so the leg opens that world itself: two
// jobs chained A→B in the legacy-unassigned workspace (""), timed to
// finish BEFORE the project-wide finisher so the project-wide chain and
// the roster's ranks stay untouched. The scoped walk then has a chain of
// its own (2 steps) to speak — and the header must confess "within
// Unassigned" while the roster keeps the project-wide truth.
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const WSA = "t687wsa", WSB = "t687wsb", WSE = "t687wsedge";
const finisherEnd = chain.chain[N - 1].end;
const MIN = 60_000;
const wsAStart = finisherEnd - 20 * MIN; // ends 16m before the finisher
const wsBStart = wsAStart + 4 * MIN + 2 * MIN; // 2m gap, then 5m run → ends 9m before
const projId = roster0.find((j) => j.id === chain.chain[N - 1].job.id)?.projectId;
// a previous flight that crashed before teardown leaves the pair behind
// (P2002 on re-run) — the injection opens with its own sweep, idempotent
await db.job.deleteMany({ where: { id: { in: [WSA, WSB] } } });
await db.edge.deleteMany({ where: { id: WSE } });
await db.edge.deleteMany({ where: { fromJobId: WSA, toJobId: WSB } });
const mk = (id, name, startedAt, duration, x) => ({
  data: {
    id, projectId: projId, workspaceId: null, type: "postprocess", name,
    x, y: 2400, status: "completed", progress: 100, params: "{}",
    startedAt: new Date(startedAt), duration,
  },
});
await db.job.create(mk(WSA, "t687 unassigned step A", wsAStart, 4 * MIN, 2600));
await db.job.create(mk(WSB, "t687 unassigned step B", wsBStart, 5 * MIN, 2900));
await db.edge.create({
  data: { id: WSE, projectId: projId, fromJobId: WSA, toJobId: WSB },
}).catch(async () => {
  // some schemas derive the id — retry without pinning it
  await db.edge.create({ data: { projectId: projId, fromJobId: WSA, toJobId: WSB } });
});
console.log(`· injected the unassigned pair (A ends ${Math.round((finisherEnd - (wsAStart + 4 * MIN)) / MIN)}m before the finisher)`);

// the MIRROR's scoped world = everything with NO workspace (the same
// filter the scope chip applies) — the injected pair are its only members
// in this world, but the mirror derives that, it does not assume it
const scopedJobs = roster0
  .filter((j) => (j.workspaceId ?? "") === "")
  .concat([
    { id: WSA, workspaceId: null, status: "completed", startedAt: new Date(wsAStart).toISOString(), duration: 4 * MIN, name: "t687 unassigned step A" },
    { id: WSB, workspaceId: null, status: "completed", startedAt: new Date(wsBStart).toISOString(), duration: 5 * MIN, name: "t687 unassigned step B" },
  ]);
const scopedChain = expectedChain(scopedJobs, edges0.concat([{ id: WSE, fromJobId: WSA, toJobId: WSB }]));
const scopedN = scopedChain ? scopedChain.chain.length : 0;
const scopedIds = scopedChain ? scopedChain.jobIds : [];
console.log(`· scoped mirror: chain of ${scopedN} (${scopedIds.map((id) => id === WSA ? "A" : id === WSB ? "B" : "?").join("→")})`);

// the new jobs AND the new EDGE reach the client through a FULL INGEST
// (t686's own law: pollTick only polls /api/jobs — a fresh edge never
// arrives through the poll). Reload, then wait for the block to speak
// the project-wide chain again on the healed world.
await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
await switchDashboard(roster0.length + 2); // the injected pair are roster rows now
await pollUntil(async () => (await readBlockSteps()) === N || null, 20000);
const chipUp = await pollUntil(async () =>
  (await page.locator('[data-analytics-scope-chip="unassigned"]').count()) > 0 || null, 20000);
must(!!chipUp, "C the injected unassigned jobs raise the scope chips (the full ingest feeds the options)");

await page.locator('[data-analytics-scope-chip="unassigned"]').first().click();
let diagSeen = null;
const scopedSteps = await pollUntil(async () => {
  const cnt = await page.locator('[data-canvas-ui="analytics-critical"]').count();
  const vals = await page.locator('[data-canvas-ui="analytics-critical"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-critical-steps")));
  diagSeen = { cnt, vals };
  return vals.length === 1 && Number(vals[0]) === scopedN ? Number(vals[0]) : null;
}, 12000);
if (scopedSteps == null) console.log(`· diag: ${JSON.stringify(diagSeen)}`);
must(scopedSteps === scopedN,
  "C the block re-speaks the SCOPED chain (the walk drinks the scoped rows)",
  `${scopedSteps} (scoped mirror ${scopedN}, project-wide ${N})`);

const scopedRows = await page.locator("[data-critical-row]").evaluateAll((els) =>
  els.map((el) => ({
    id: el.getAttribute("data-critical-row"),
    num: Number(el.getAttribute("data-critical-step-num")),
  }))
);
must(JSON.stringify(scopedRows.map((r) => r.id)) === JSON.stringify(scopedIds),
  "C the scoped rows walk the scoped mirror's order, step for step", scopedIds.join("→"));
must(scopedRows.every((r) => r.num === scopedRows.indexOf(r) + 1) && scopedRows.length === scopedN,
  "C the scoped numbers also read 1..N (the ink follows the walk, whatever the scope)");

const footnote = await page.locator("[data-critical-scope]").first().textContent().catch(() => null);
must(footnote != null && footnote.includes("Unassigned"),
  "C the header confesses its world — 'within Unassigned'", (footnote ?? "").trim());

const rosterDuring = await page.locator("[data-roster-lens-chip]").count();
must(rosterDuring === 0,
  "C with the lens off, the scoped block speaks and the roster stays silent — no cross-talk");

// then the lens comes back ON — the STRONGEST frame: the scoped block
// (a 2-step chain within Unassigned) and the roster's project-wide chip
// (13) on ONE screen, each mouth speaking its own world's truth
await page.keyboard.press("p");
const rosterOnScoped = await pollUntil(async () => (await readRosterChipSteps()) === N ? N : null, 8000);
must(rosterOnScoped === N,
  "C lens on: the roster keeps the project-wide truth while the block speaks the scoped one", `${rosterOnScoped} vs block ${await readBlockSteps()}`);
must((await readBlockSteps()) === scopedN,
  "C the same screen holds two worlds: the scoped block and the project-wide roster chip");

await page.locator('[data-analytics-scope-chip="all"]').first().click();
const backSteps = await pollUntil(async () => (await readBlockSteps()) === N || null, 12000);
must(!!backSteps, "C back to all — the block re-speaks the project-wide chain", `${await readBlockSteps()}`);
must((await page.locator("[data-critical-scope]").count()) === 0,
  "C back to all — the scope footnote withdraws (silence, not an empty shell)");

// ---------- D: the lens-stays-out guarantee + dismissal alive ----------
// the lens is ON here (pressed mid-C for the two-worlds frame)
{
  const opacity = await page.locator('[data-canvas-ui="analytics-critical"]').first()
    .evaluate((el) => getComputedStyle(el).opacity);
  must(opacity === "1",
    "D the lens does not enter the aggregate face — the chain's report keeps full ink (the ally)", `opacity ${opacity}`);
  must((await page.locator("[data-critical-row]").count()) === N,
    "D every step row stays visible with the lens on", `${await page.locator("[data-critical-row]").count()}/${N}`);
  await page.keyboard.press("p");
  const chipGone = await pollUntil(async () => (await page.locator("[data-roster-lens-chip]").count()) === 0 || null, 8000);
  must(!!chipGone, "D P turns the lens off — the dismissal verb survives the new anchors");
}

// ---------- E: teardown + noise buckets ----------
await db.job.deleteMany({ where: { id: { in: [WSA, WSB] } } });
await db.edge.deleteMany({ where: { id: WSE } });
await db.edge.deleteMany({ where: { fromJobId: WSA, toJobId: WSB } }); // the derived-id retry path
await pollUntil(async () =>
  (await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs.length)) === roster0.length || null, 15000);
console.log("· teardown: the unassigned pair and its edge are gone, the API world is back to baseline");

await gotoDashboard();
must((await page.locator('[data-canvas-ui="analytics-critical"]').count()) === 1,
  "E the world intact — the block stands after the full revisit");
must((await page.locator("[data-roster-lens-chip]").count()) === 0,
  "E the world intact — the rest roster confesses nothing");
must((await page.locator("[data-analytics-scope-group]").count()) === 0,
  "E the world intact — the scope chips withdraw with the injected world (silence, not an empty shell)");
must(consoleErrors.length === 0, "E console: zero real errors (clean)", `${consoleErrors.length}`);
must(resource404.length === 0, "E console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "E zero chunk flaps", `${chunkFlap.length}`);
must(hmrNoise.length === 0, "E hmr noise bounded", `${hmrNoise.length}`);
must(resourceFlap.length === 0, "E resource flaps bounded", `${resourceFlap.length}`);

console.log(`\n==== t687 critical-block handshake: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
