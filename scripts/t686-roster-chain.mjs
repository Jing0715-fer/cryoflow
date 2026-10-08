// t686 — the chain lens reaches the survey surface: the roster joins the
// walk family as its FOURTH mouth.
//
// t681 spoke the walk on the analytics block, t682 painted it on the
// canvas, t683 carried it to the map. But the roster — the face that
// lists EVERY job of the project across EVERY workspace — still told no
// story: with the lens on, its rows kept equal ink, the reader standing
// on the dashboard had no way to see which runs decided the finish.
//
// t686: with the lens on, the roster re-derives the SAME walk from the
// SAME lib (never stored — the fourth mouth of one walk, none of the
// mouths remembers) and splits the rows along it. Chain rows wear their
// RANK ("3/14" — the roster is a list; order is its native language, the
// one thing the dim/contrast cannot carry; the map's no-new-ink law was
// a SCALE law for dots, not a universe law). Everything the finish
// didn't wait on recedes with the same card-grade ladder rung the canvas
// cards dim by (.roster-chain-dim — recede + deep grayscale, one voice
// across faces; print resets it: the paper roster is a plain roster).
// The label row confesses the lens (the canvas chip's roster dialect)
// and doubles as the face's dismissal verb — a reader on the dashboard
// should not have to walk back to the canvas to turn a lens off.
//
// The keyboard follows the lens's reach: t682 scoped P away from the
// dashboard because "the dashboard has none (cards)". t686 ends that
// world — the roster dims ROWS now, so P works on the dashboard too.
//
// The probe's honesty anchor stays the INDEPENDENT recomputation (same
// walk law, different code, no shared import — a shared bug can't hide
// behind a shared lib). Its key contracts:
//   · the tagged rows' SET equals the mirror chain's set
//   · the tagged rows' RANK ORDER equals the mirror chain's order
//   · the roster chip's step count equals the canvas chip's — two mouths,
//     one walk, zero shared memory
//   · a DB-injected step chained from the finisher extends the roster's
//     chain LIVE (poll, no reload) — the walk is recomputed, not recalled
//
// Legs:
//   S  rest world: lens off → the roster is silent about the chain
//   A  P on the dashboard: the rows split along the chain + the chip
//      confesses
//   B  the mirror: tagged ids == mirror set; rank order == mirror order;
//      root rank 1, finisher rank n
//   C  the cross-mouth contract: canvas chip steps == roster chip steps;
//      the flag survives the view swap both ways
//   📸 the roster with the lens on (rank chips + recession, one frame)
//   E  drill step chained from the finisher: the chain extends (after a
//      full ingest — pollTick only polls /api/jobs, a new EDGE reaches
//      the client through reload), the old ranks keep their seats
//   D  dismissal verbs: chip click off, P on, P off — the rest world
//      returns byte-identical each time
//   F  teardown + world intact + noise buckets
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";
// t681's key: the probe's Prisma must see the SAME db the prod server sees
// — .env's custom.db is the template library, not the healed 20-job world.
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
// lib/critical-path WITHOUT importing them — t683's mirror verbatim) ----------
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
const chain = expectedChain(roster0, edges0);
if (!chain || chain.chain.length < 2) {
  console.error("setup: the world has no chain to speak of");
  process.exit(1);
}
const chainSet = new Set(chain.jobIds);
console.log(`· baseline: ${roster0.length} jobs, ${edges0.length} edges, chain of ${chain.chain.length} (root "${chain.chain[0].job.name}" → finisher "${chain.chain[chain.chain.length - 1].job.name}")`);

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
  await sleep(2500);
  await pollUntil(async () => (await page.locator("[data-job]").count()) > 0 || null, 15000);
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await pollUntil(async () => (await page.locator("[data-roster-row]").count()) === roster0.length || null, 15000);
};

await gotoDashboard();
const rows = page.locator("[data-roster-row]");
must((await rows.count()) === roster0.length, "S every job has a roster row", `${await rows.count()}/${roster0.length}`);
must((await page.locator("[data-roster-lens-chip]").count()) === 0,
  "S lens off — the label row does not confess any lens");
must((await page.locator("[data-roster-row][data-roster-chain]").count()) === 0,
  "S lens off — no row claims the chain");
must((await page.locator("[data-roster-row][data-roster-dim]").count()) === 0,
  "S lens off — no row recedes");
must((await page.locator("[data-roster-chain-chip]").count()) === 0,
  "S lens off — no row wears a rank chip");

// ---------- A: P on the dashboard — the rows split along the chain ----------
await page.keyboard.press("p");
const chipUp = await pollUntil(async () =>
  (await page.locator("[data-roster-lens-chip]").count()) > 0 || null, 8000);
must(!!chipUp, "A P on the dashboard turns the lens on (the key follows the lens's reach)");

const chipSteps = await pollUntil(async () => {
  const v = await page.locator("[data-roster-lens-chip]").getAttribute("data-roster-lens-steps").catch(() => null);
  return v ? Number(v) : null;
}, 8000);
must(chipSteps === chain.chain.length,
  "A the confession chip speaks the mirror's chain length", `${chipSteps} (expected ${chain.chain.length})`);

const split = await page.locator("[data-roster-row]").evaluateAll((els) => {
  const on = els
    .filter((el) => el.getAttribute("data-roster-chain") !== null)
    .map((el) => ({ id: el.getAttribute("data-job-id"), rank: Number(el.getAttribute("data-roster-chain-rank")) }));
  const dim = els.filter((el) => el.getAttribute("data-roster-dim") === "1").map((el) => el.getAttribute("data-job-id"));
  return { on, dim };
});
must(split.on.length === chain.chain.length,
  "A exactly the mirror's chain rows claim the chain", `${split.on.length}/${chain.chain.length}`);
must(split.dim.length === roster0.length - chain.chain.length,
  "A every off-chain row recedes", `${split.dim.length} dimmed (expected ${roster0.length - chain.chain.length})`);
must(split.on.every((r) => !split.dim.includes(r.id)),
  "A no chain row carries the dim");
must(split.dim.every((id) => !chainSet.has(id ?? "")),
  "A no off-chain row claims the chain mark");
must((await page.locator("[data-roster-chain-chip]").count()) === chain.chain.length,
  "A every chain row wears its rank chip");

// ---------- B: the mirror contract — ids AND order ----------
const ranked = [...split.on].sort((a, b2) => a.rank - b2.rank).map((r) => r.id);
must(JSON.stringify(ranked) === JSON.stringify(chain.jobIds),
  "B the rank order equals the mirror's walk order, step for step");
must(split.on.find((r) => r.rank === 1)?.id === chain.jobIds[0],
  "B the root stands at rank 1", chain.jobIds[0]);
must(split.on.find((r) => r.rank === chain.chain.length)?.id === chain.jobIds[chain.chain.length - 1],
  "B the finisher stands at the last rank");
must(new Set(split.on.map((r) => r.id)).size === chain.chain.length,
  "B the ranks are a permutation — no doubles, no gaps");

// ---------- C: the cross-mouth contract ----------
await page.locator('[role="tab"][title^="Workflow canvas"]').first().click().catch(() => {});
const canvasChipSteps = await pollUntil(async () => {
  const el = page.locator('[data-canvas-ui="critical-chip"]');
  if ((await el.count()) !== 1) return null;
  const v = await el.getAttribute("data-critical-steps");
  return v ? Number(v) : null;
}, 10000);
must(canvasChipSteps === chain.chain.length,
  "C the canvas chip counts the same chain", `${canvasChipSteps} (expected ${chain.chain.length})`);

await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await pollUntil(async () => (await page.locator("[data-roster-row]").count()) === roster0.length || null, 15000);
const backSteps = await pollUntil(async () => {
  const el = page.locator("[data-roster-lens-chip]");
  if ((await el.count()) !== 1) return null;
  const v = await el.getAttribute("data-roster-lens-steps");
  return v ? Number(v) : null;
}, 8000);
must(backSteps === chain.chain.length,
  "C the lens survives the view swap — the roster still speaks", `${backSteps}`);
must((await page.locator("[data-roster-row][data-roster-chain]").count()) === chain.chain.length,
  "C the rows still split along the chain after the swap");

// ---------- 📸 the roster with the lens on ----------
await page.locator("[data-spot-jobslabel]").first().scrollIntoViewIfNeeded().catch(() => {});
// the dash-motion cascade settles ~1238ms after mount (t576/t613) — shoot
// only after the rows have LANDED (an early frame shoots empty air)
await page.waitForTimeout(2600);
await page.screenshot({ path: ".qa-logs/t686-roster-chain.png" });

// ---------- E: drill step chained from the finisher — the chain extends ----------
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const DRILL_ID = "t686drillpp";
const DRILL_EDGE_ID = "t686drilledge";
const DRILL_GAP_MS = 300000; // the drill starts 5m after its driver finishes
const DRILL_DURATION = 480000; // and runs 8m — it ends last, it finishes the pipeline
const finisher = chain.chain[chain.chain.length - 1];
const drillStart = finisher.end + DRILL_GAP_MS;
await db.job.create({
  data: {
    id: DRILL_ID,
    projectId: finisher.job.projectId ?? roster0.find((j) => j.id === finisher.job.id)?.projectId,
    workspaceId: roster0.find((j) => j.id === finisher.job.id)?.workspaceId ?? null,
    type: "postprocess",
    name: "t686 drill postprocess",
    x: 2600, y: 900,
    status: "completed",
    progress: 100,
    params: "{}",
    startedAt: new Date(drillStart),
    duration: DRILL_DURATION,
  },
});
await db.edge.create({
  data: {
    id: DRILL_EDGE_ID,
    projectId: roster0.find((j) => j.id === finisher.job.id)?.projectId,
    fromJobId: finisher.job.id,
    toJobId: DRILL_ID,
  },
});
console.log(`· setup: drill step wired from "${finisher.job.name}" (+5m gap, 8m run)`);
// pollTick only polls /api/jobs (the store's own documented law) — a new
// EDGE reaches the client only through a full ingest, so the re-walk is
// witnessed after a reload (t681's E leg rode the same law).
await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await pollUntil(async () => (await page.locator("[data-roster-row]").count()) === roster0.length + 1 || null, 15000);
// the reload reset the lens flag (store state, not persisted) — press P again
await page.keyboard.press("p");
await pollUntil(async () => (await page.locator("[data-roster-lens-chip]").count()) === 1 || null, 8000);

const liveSteps = await pollUntil(async () => {
  const el = page.locator("[data-roster-lens-chip]");
  if ((await el.count()) !== 1) return null;
  const v = Number(await el.getAttribute("data-roster-lens-steps"));
  return v === chain.chain.length + 1 ? v : null;
}, 15000);
must(liveSteps === chain.chain.length + 1,
  "E the roster re-walks — the chain extends by the drill step", `${liveSteps} (expected ${chain.chain.length + 1})`);

const drillRank = await pollUntil(async () => {
  const byId = page.locator(`[data-roster-row][data-job-id="${DRILL_ID}"]`);
  if ((await byId.count()) !== 1) return null;
  const r = Number(await byId.getAttribute("data-roster-chain-rank"));
  return r === chain.chain.length + 1 ? r : null;
}, 10000);
must(drillRank === chain.chain.length + 1,
  "E the drill stands at the chain's end with the next rank", `rank ${drillRank}`);
const oldFinisherRank = await pollUntil(async () => {
  const el = page.locator(`[data-roster-row][data-job-id="${finisher.job.id}"]`);
  if ((await el.count()) !== 1) return null;
  const r = Number(await el.getAttribute("data-roster-chain-rank"));
  return r === chain.chain.length ? r : null;
}, 10000);
must(oldFinisherRank === chain.chain.length,
  "E the old finisher keeps its seat", `rank ${oldFinisherRank}`);
const dimAfter = await page.locator("[data-roster-row][data-roster-dim]").count();
must(dimAfter === (roster0.length + 1) - (chain.chain.length + 1),
  "E the recession follows the walk — one more row inks, the world count holds", `${dimAfter} dimmed`);

// ---------- D: dismissal verbs — the rest world returns ----------
await page.locator("[data-roster-lens-chip]").click();
const off = await pollUntil(async () =>
  (await page.locator("[data-roster-lens-chip]").count()) === 0 &&
  (await page.locator("[data-roster-row][data-roster-chain]").count()) === 0 &&
  (await page.locator("[data-roster-row][data-roster-dim]").count()) === 0
    ? true : null, 8000);
must(!!off, "D the chip's click turns the lens off — the roster returns to its rest world");
must((await rows.count()) === roster0.length + 1, "D the drill's seat holds while the lens leaves",
  `${await rows.count()}/${roster0.length + 1}`);

await page.keyboard.press("p");
const onAgain = await pollUntil(async () =>
  (await page.locator("[data-roster-lens-chip]").count()) === 1 ? true : null, 8000);
must(!!onAgain, "D P turns the lens back on from the dashboard");
await page.keyboard.press("p");
const offAgain = await pollUntil(async () =>
  (await page.locator("[data-roster-lens-chip]").count()) === 0 ? true : null, 8000);
must(!!offAgain, "D P turns it off again — the key toggles both ways");

// ---------- F: teardown + world intact + noise buckets ----------
await db.edge.deleteMany({ where: { id: DRILL_EDGE_ID } });
await db.job.deleteMany({ where: { id: DRILL_ID } });
await db.$disconnect();
const rosterBack = await pollUntil(async () => {
  const j = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).catch(() => null);
  return j && j.jobs.length === roster0.length ? j.jobs.length : null;
}, 15000);
must(rosterBack === roster0.length, "F teardown: the drill is gone, the world holds", `${rosterBack}/${roster0.length}`);
await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await pollUntil(async () => (await page.locator("[data-roster-row]").count()) === roster0.length || null, 15000);
must((await page.locator("[data-roster-row][data-roster-chain]").count()) === 0,
  "F the reloaded roster is silent about the chain (lens off is the default world)");
must(consoleErrors.length === 0, "F zero real console errors", consoleErrors.slice(0, 3).join(" | "));
must(chunkFlap.length === 0, "F zero chunk flaps", String(chunkFlap.length));
must(resource404.length === 0, "F zero resource 404s", String(resource404.length));
must(resourceFlap.length <= 3, "F resource flaps bounded", String(resourceFlap.length));
must(hmrNoise.length <= 3, "F hmr noise bounded", String(hmrNoise.length));

await b.close();
console.log(`\n==== t686 roster-chain: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
