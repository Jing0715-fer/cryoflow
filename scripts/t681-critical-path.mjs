// t681 — Critical path: the DAG-level lens (the analytics panel's fifth face).
//
// The timeline draws every run's window; Runtime by stage aggregates the
// windows per TYPE. Neither answers the whiteboard question: WHICH CHAIN
// of dependencies decided when the pipeline could finish? t681 adds the
// Critical path block — walked backwards from the run that finished last
// through each step's latest-finishing upstream, riding the SAME honest
// windows the timeline drinks (lib/timeline-walk ms — never raw duration)
// and the canvas's OWN edges, so the chain can never disagree with the
// picture about what connects to what.
//
// The probe's honesty anchor is an INDEPENDENT recomputation: it mirrors
// the walk law (completed+failed → ms = max(1000, duration), running
// waits outside the chain) and the walk-back semantics from the API's
// own job list + edge list, then confronts the UI with the chain. One
// drill step (DB-direct: a postprocess seat whose window ends 5 minutes
// after the current finisher, wired from the finisher itself) extends
// the chain by one — the finish moved, the face must move with it —
// then torn out without a trace.
//
// Legs:
//   S  baseline world read + the block stands
//   A  the block speaks: attrs, step order, finisher chip match the mirror
//   B  spot-checked rows + gap rows match the independent chain exactly
//   C  the bars are painted on the span's own geometry
//   D  copy summary speaks the chain (toast) — the text machine face
//   E  drill step injected: the chain extends, the finisher moves
//   F  teardown: drill gone, the block returns to the baseline chain
//   G  world intact + noise buckets
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";
const DRILL_ID = "t681drillpp";
const DRILL_EDGE_ID = "t681drilledge";
const DRILL_GAP_MS = 300000; // the drill starts 5m after its driver finishes
const DRILL_DURATION = 480000; // and runs 8m — it ends last, it finishes the pipeline

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
// lib/critical-path WITHOUT importing them — a shared bug can't hide
// behind a shared import) ----------
const fmtDuration = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};
const gapPhrase = (gapMs) =>
  gapMs > 0
    ? `waited ${fmtDuration(gapMs)} after upstream finished`
    : gapMs < 0
      ? `overlapped ${fmtDuration(-gapMs)} with upstream`
      : "started as upstream finished";
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
    preds.get(t.job.id).push(f);
  }
  let entry = rows.reduce(laterOf);
  const rev = [];
  let cur = entry, guard = rows.length + 1;
  while (cur && guard-- > 0) {
    const ps = preds.get(cur.job.id) ?? [];
    const driver = ps.length ? ps.reduce(laterOf) : null;
    rev.push({
      job: cur.job, start: cur.start, end: cur.end, ms: cur.ms,
      gapBeforeMs: driver ? cur.start - driver.end : null,
    });
    if (!driver) break;
    cur = driver;
  }
  const chain = rev.reverse();
  const busyMs = chain.reduce((a, s) => a + s.ms, 0);
  const spanMs = Math.max(entry.end - chain[0].start, 0);
  return { chain, spanMs, busyMs, gapMs: spanMs - busyMs, entryId: entry.job.id };
};

// ---------- S: baseline world read ----------
mkdirSync(".qa-logs", { recursive: true });
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
// defensive restore: a killed previous flight leaves nothing behind
await db.edge.deleteMany({ where: { id: DRILL_EDGE_ID } }).catch(() => {});
await db.job.deleteMany({ where: { id: DRILL_ID } }).catch(() => {});

const roster0 = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
const edges0 = await fetch(`${BASE}/api/edges`).then((r) => r.json()).then((j) => j.edges ?? j);
const baseline = expectedChain(roster0, edges0);
if (!baseline || baseline.chain.length < 2) {
  console.error("setup: the world has no chain to speak of");
  process.exit(1);
}
console.log(`· baseline: ${roster0.length} jobs, ${edges0.length} edges, chain of ${baseline.chain.length} (finisher "${baseline.chain[baseline.chain.length - 1].job.name}")`);

// ---------- browser + instruments ----------
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1600, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"], // the copy button's own mouth
});
const page = await ctx.newPage();
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
const liveToast = () => page.evaluate(() =>
  [...document.querySelectorAll("ol > li[data-state='open']")].map((li) =>
    (li.textContent || "").replace(/\s+/g, " ").slice(0, 160))).catch(() => []);

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
const section = page.locator('section[aria-label="Pipeline analytics"]');
await pollUntil(async () => (await section.count()) > 0 || null, 15000);
must((await section.count()) === 1, "S the analytics section stands");

const block = section.locator('[data-canvas-ui="analytics-critical"]');
const blockUp = await pollUntil(async () => (await block.count()) > 0 || null, 10000);
must(!!blockUp, "S the Critical path block renders");

// ---------- A: the block speaks the mirror's chain ----------
must((await block.getAttribute("data-critical-steps")) === String(baseline.chain.length),
  "A the step count matches the independent chain", `expected ${baseline.chain.length}`);
must((await block.getAttribute("data-critical-span")) === String(baseline.spanMs),
  "A the span matches the independent arithmetic", `${baseline.spanMs}`);
must((await block.getAttribute("data-critical-busy")) === String(baseline.busyMs),
  "A the busy sum matches", `${baseline.busyMs}`);
const rowIds = await block.locator("[data-critical-row]").evaluateAll((els) =>
  els.map((el) => el.getAttribute("data-critical-row")));
must(JSON.stringify(rowIds) === JSON.stringify(baseline.chain.map((s) => s.job.id)),
  "A the rows walk root → finisher in the independent order", `${rowIds.length} rows`);
const idxSeq = await block.locator("[data-critical-row]").evaluateAll((els) =>
  els.map((el) => el.getAttribute("data-critical-index")));
must(JSON.stringify(idxSeq) === JSON.stringify(baseline.chain.map((_, i) => String(i))),
  "A the step numbers read 0..n-1 in order");
const chip = block.locator("[data-critical-finisher]");
must((await chip.count()) === 1, "A the finisher chip stands");
must((await chip.getAttribute("data-critical-finisher")) === baseline.entryId,
  "A the chip names the independent finisher", baseline.entryId);
const chipText = ((await chip.textContent()) ?? "").trim();
must(chipText === `ends with: ${baseline.chain[baseline.chain.length - 1].job.name}`,
  "A the chip speaks the finisher's name", chipText);
await block.scrollIntoViewIfNeeded().catch(() => {}); // the block lives below the fold
await sleep(600);
await page.screenshot({ path: ".qa-logs/t681-critical-block.png" });

// ---------- B: spot-check first / middle / last rows + every gap row ----------
for (const i of [0, Math.floor(baseline.chain.length / 2), baseline.chain.length - 1]) {
  const s = baseline.chain[i];
  const row = block.locator(`[data-critical-row="${s.job.id}"]`);
  const name = ((await row.locator("[data-critical-name]").textContent()) ?? "").trim();
  must(name === s.job.name, `B step ${i} row speaks its job's name`, name);
  const title = (await row.getAttribute("title")) ?? "";
  must(title.includes(`ran ${fmtDuration(s.ms)}`) && title.includes(s.job.status),
    `B step ${i} row speaks the independent duration + status`,
    `want "ran ${fmtDuration(s.ms)}" · ${s.job.status}`);
}
const gapEls = await block.locator("[data-critical-gap]").evaluateAll((els) =>
  els.map((el) => ({ i: el.getAttribute("data-critical-gap"), t: (el.textContent ?? "").trim() })));
const wantGaps = baseline.chain.slice(1).map((s) => gapPhrase(s.gapBeforeMs));
must(gapEls.length === wantGaps.length,
  "B one gap row between each pair of steps", `${gapEls.length}`);
const gapsOk = wantGaps.every((w, i) => gapEls[i] && gapEls[i].t.includes(w));
must(gapsOk, "B every gap row speaks the independent idle",
  wantGaps.map((w, i) => `${i + 1}:"${gapEls[i]?.t ?? "?"}"`).join(" | "));

// ---------- C: the bars are painted on the span's own geometry ----------
const bars = await block.locator("[data-critical-bar]").evaluateAll((els) =>
  els.map((el) => ({ w: parseFloat(el.style.width), l: parseFloat(el.style.left) })));
must(bars.length === baseline.chain.length && bars.every((x) => x.w > 0),
  "C every step's bar is painted", bars.map((x) => x.w.toFixed(1)).join(","));
must(bars.every((x) => x.l >= 0 && x.l < 100), "C every bar sits inside the span", "");

// ---------- D: the copy summary speaks the chain ----------
await section.locator('button[aria-label="Copy pipeline summary"]').click();
const copyToast = await pollUntil(async () =>
  (await liveToast()).find((t) => /summary copied/i.test(t)) || null, 8000);
must(!!copyToast, "D the copy toast speaks", copyToast ?? "none");
const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
must(/Critical path \(\d+ steps?, [^)]+ span\)/.test(clip),
  "D the clipboard carries the Critical path section", clip.split("\n").find((l) => l.includes("Critical path")) ?? "no section");
must(clip.includes(`ran ${fmtDuration(baseline.chain[baseline.chain.length - 1].ms)} --`)
  || clip.includes(`ran ${fmtDuration(baseline.chain[baseline.chain.length - 1].ms)},`),
  "D the clipboard's chain lines speak the independent durations", "");
must(clip.includes(baseline.chain[0].job.name)
  && clip.includes(baseline.chain[baseline.chain.length - 1].job.name),
  "D the clipboard's chain spans root to finisher", "");

// ---------- E: drill step injected — the chain extends, the finisher moves ----------
const finisher = baseline.chain[baseline.chain.length - 1];
const drillStart = finisher.end + DRILL_GAP_MS;
await db.job.create({
  data: {
    id: DRILL_ID,
    projectId: finisher.job.projectId ?? roster0.find((j) => j.id === finisher.job.id)?.projectId,
    workspaceId: roster0.find((j) => j.id === finisher.job.id)?.workspaceId ?? null,
    type: "postprocess",
    name: "t681 drill postprocess",
    x: 2600, y: 900,
    status: "completed",
    progress: 100,
    params: "{}",
    startedAt: new Date(drillStart),
    duration: DRILL_DURATION,
  },
});
await db.edge.create({
  data: { id: DRILL_EDGE_ID, projectId: roster0.find((j) => j.id === finisher.job.id)?.projectId,
    fromJobId: finisher.job.id, toJobId: DRILL_ID },
});
console.log(`· setup: drill step wired from "${finisher.job.name}" (+5m gap, 8m run)`);
await page.reload({ waitUntil: "networkidle", timeout: 60000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await pollUntil(async () => (await section.count()) > 0 || null, 15000);

const drillUp = await pollUntil(async () => {
  const v = await block.getAttribute("data-critical-steps").catch(() => null);
  return v === String(baseline.chain.length + 1) ? v : null;
}, 15000);
must(!!drillUp, "E the chain extends by the drill step", `expected ${baseline.chain.length + 1}`);
const newFinisher = await pollUntil(async () => {
  const v = await chip.getAttribute("data-critical-finisher").catch(() => null);
  return v === DRILL_ID ? v : null;
}, 10000);
must(!!newFinisher, "E the finisher moves to the drill step", DRILL_ID);
const lastRow = block.locator(`[data-critical-row="${DRILL_ID}"]`);
must((await lastRow.count()) === 1, "E the drill row stands at the chain's end");
const lastGapIdx = baseline.chain.length; // the gap BETWEEN the old finisher and the drill
const lastGap = block.locator(`[data-critical-gap="${lastGapIdx}"]`);
const lastGapText = ((await lastGap.textContent().catch(() => "")) ?? "").trim();
must(lastGapText.includes(gapPhrase(DRILL_GAP_MS)),
  "E the drill's gap row speaks the 5-minute wait", lastGapText || "no gap row");
const spanAfter = Number(await block.getAttribute("data-critical-span"));
must(spanAfter === baseline.spanMs + DRILL_GAP_MS + DRILL_DURATION,
  "E the span grew by the drill's gap + run", `${spanAfter}`);

// ---------- F: teardown — drill out, the chain returns to baseline ----------
await db.edge.deleteMany({ where: { id: DRILL_EDGE_ID } });
await db.job.deleteMany({ where: { id: DRILL_ID } });
await page.reload({ waitUntil: "networkidle", timeout: 60000 });
await sleep(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await pollUntil(async () => (await section.count()) > 0 || null, 15000);
const backSteps = await pollUntil(async () => {
  const v = await block.getAttribute("data-critical-steps").catch(() => null);
  return v === String(baseline.chain.length) ? v : null;
}, 15000);
must(!!backSteps, "F the chain returns to the baseline step count", `expected ${baseline.chain.length}`);
const backFinisher = await pollUntil(async () => {
  const v = await chip.getAttribute("data-critical-finisher").catch(() => null);
  return v === baseline.entryId ? v : null;
}, 10000);
must(!!backFinisher, "F the finisher returns to the baseline entry", baseline.entryId);
const rowsAfter = await block.locator("[data-critical-row]").evaluateAll((els) =>
  els.map((el) => el.getAttribute("data-critical-row")));
must(!rowsAfter.some((id) => (id ?? "").startsWith("t681")), "F no drill rows remain", rowsAfter.join(","));
const rosterAfter = await fetch(`${BASE}/api/jobs`).then((r) => r.json()).then((j) => j.jobs);
must(rosterAfter.length === roster0.length, "F the roster is back to its baseline size", `${rosterAfter.length}`);

// ---------- G: world intact + noise buckets ----------
must(consoleErrors.length === 0, "G console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "G console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "G zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "G resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "G hmr noise bounded", `${hmrNoise.length}`);
await db.$disconnect();

console.log(`\n==== t681 critical-path: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
