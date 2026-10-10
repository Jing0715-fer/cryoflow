// t683 — the chain lens reaches the minimap: the third mouth of one walk.
//
// t682 put the critical-path lens on the canvas (chain cards full ink,
// off-chain cards recede, walked wires carry the chain stroke, unwalked
// wires recede — by EDGE ID, not endpoints). t681 put the same walk's
// face on the dashboard. But the map — the bird's-eye where all 17 cards
// are dots — still told no story: every chip equal ink, every wire equal
// ink, the chain invisible at the farthest zoom of all.
//
// t683: with the lens on, the map re-derives the SAME walk from the SAME
// lib (never stored — the third mouth of one walk, none of the three
// mouths remembers) and splits along the chain: chain chips keep their
// status fill (data-mm-chain), everything the finish didn't wait on dims
// with the SAME whisper rung the find lens uses (data-mm-dim), and the
// map's wires obey the canvas's t682 edge law — walked keeps ink, every
// unwalked wire (chords included) recedes, BY EDGE ID.
//
// The probe's honesty anchor is the same INDEPENDENT recomputation t681/
// t682 flew (same walk law, different code, no shared import). Its key
// assertion is the MIRROR: the canvas chip's chain and the map's chain
// are counted independently — if the two mouths ever disagree, a shared
// bug or a shared state would show as a number mismatch.
//
// Legs:
//   S  world read; minimap visible; lens off → the map has no chain marks
//      and no dims (the baseline map is silent about the chain)
//   A  lens ON: the map's chips split along the chain — every chain chip
//      carries data-mm-chain and no dim, every off-chain chip carries
//      data-mm-dim and no chain mark (counts match the mirror)
//   B  the map's wires split along the walked path: walked wires keep
//      their ink, every unwalked wire recedes (the .mm-edge-dim rung)
//   C  the mirror: the canvas chip's data-critical-steps equals the map's
//      chain-chip count — two mouths, one walk, zero shared memory
//   D  the keyboard twin: P off → the map returns to full ink; P on →
//      the chain story returns
//   E  world intact + noise buckets + roster unchanged
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const REPO = "/home/z/my-project";
const BASE = "http://localhost:3000";

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
// lib/critical-path WITHOUT importing them — t681's mirror verbatim). ----------
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
const offChain = roster0.filter((j) => !chainSet.has(j.id)).map((j) => j.id);
const offChainEdges = edges0.filter((e) => !chain.edgeIds.includes(e.id)).map((e) => e.id);
console.log(`· baseline: ${roster0.length} jobs, ${edges0.length} edges, chain of ${chain.chain.length} (${chain.edgeIds.length} walked wires, ${offChain.length} cards off-chain)`);

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

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await pollUntil(async () => (await page.locator("[data-job]").count()) > 0 || null, 15000);

const map = page.locator('[data-canvas-ui="minimap-svg"]');
must((await map.count()) === 1, "S the minimap is on (the map is discoverable by default)");
const dots = page.locator('[data-canvas-ui="minimap-dot"]');
const dotCount = await dots.count();
must(dotCount === roster0.length, "S every job has a map dot", `${dotCount}/${roster0.length}`);
must((await page.locator('[data-canvas-ui="minimap-dot"][data-mm-chain]').count()) === 0,
  "S lens off — no map chip claims the chain");
must((await page.locator('[data-canvas-ui="minimap-dot"][data-mm-dim]').count()) === 0,
  "S lens off — no map chip is dimmed");
must((await page.locator('[data-mm-edge-id].mm-edge-dim').count()) === 0,
  "S lens off — no map wire recedes");

// ---------- A: lens ON — the map splits along the chain ----------
await page.locator('[data-canvas-ui="critical-toggle"]').click();
const chainUp = await pollUntil(async () =>
  (await page.locator('[data-canvas-ui="minimap-dot"][data-mm-chain="1"]').count()) > 0 || null, 8000);
must(!!chainUp, "A lens ON — chain chips claim the map (data-mm-chain)");

// every chain chip: marked + undimmed; every off-chain chip: dimmed + unmarked
const split = await page.locator('[data-canvas-ui="minimap-dot"]').evaluateAll((els) => {
  const chainIds = els.filter((el) => el.getAttribute("data-mm-chain") === "1").map((el) => el.getAttribute("data-job-id"));
  const dimIds = els.filter((el) => el.getAttribute("data-mm-dim") === "1").map((el) => el.getAttribute("data-job-id"));
  return { chainIds, dimIds };
});
must(split.chainIds.length === chain.chain.length && chain.jobIds.every((id) => split.chainIds.includes(id)),
  "A exactly the mirror's chain chips claim the map", `${split.chainIds.length}/${chain.chain.length}`);
must(split.chainIds.every((id) => !split.dimIds.includes(id)),
  "A no chain chip carries the dim");
must(split.dimIds.length === offChain.length && offChain.every((id) => split.dimIds.includes(id)),
  "A every off-chain chip recedes", `${split.dimIds.length} dimmed (expected ${offChain.length})`);
must(split.dimIds.every((id) => !chainSet.has(id ?? "")),
  "A no off-chain chip claims the chain mark");
const offDot = page.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${offChain[0]}"]`);
must((await offDot.getAttribute("class")).includes("mm-chip-dim"),
  "A the recession rides the whisper rung (mm-chip-dim)");
await page.screenshot({ path: ".qa-logs/t683-map-chain.png" });

// ---------- B: the map's wires split along the walked path ----------
const wireSplit = await page.locator("[data-mm-edge-id]").evaluateAll((els) => {
  const walked = els.filter((el) => !el.classList.contains("mm-edge-dim")).map((el) => el.getAttribute("data-mm-edge-id"));
  const receded = els.filter((el) => el.classList.contains("mm-edge-dim")).map((el) => el.getAttribute("data-mm-edge-id"));
  return { walked, receded };
});
must(wireSplit.walked.length === chain.edgeIds.length && chain.edgeIds.every((id) => wireSplit.walked.includes(id)),
  "B exactly the walked wires keep their ink", `${wireSplit.walked.length}/${chain.edgeIds.length}`);
must(offChainEdges.every((id) => wireSplit.receded.includes(id)),
  "B every unwalked wire recedes (chords included)", `${wireSplit.receded.length} receded (expected ${offChainEdges.length})`);
must(wireSplit.walked.every((id) => !offChainEdges.includes(id)),
  "B no unwalked wire keeps its ink (the edge-id law, not endpoints)");

// ---------- C: the mirror — canvas chip and map count the same chain ----------
const chipSteps = await page.locator('[data-canvas-ui="critical-chip"]').getAttribute("data-critical-steps");
must(chipSteps === String(split.chainIds.length),
  "C the canvas chip's steps equal the map's chain-chip count (two mouths, one walk)",
  `chip=${chipSteps} map=${split.chainIds.length}`);

// ---------- D: the keyboard twin ----------
await page.keyboard.press("p");
const mapQuiet = await pollUntil(async () =>
  ((await page.locator('[data-canvas-ui="minimap-dot"][data-mm-chain]').count()) === 0 &&
   (await page.locator('[data-canvas-ui="minimap-dot"][data-mm-dim]').count()) === 0) ? true : null, 8000);
must(!!mapQuiet, "D P off — the map returns to full ink (no chain, no dim)");
await page.keyboard.press("p");
const mapBack = await pollUntil(async () =>
  (await page.locator('[data-canvas-ui="minimap-dot"][data-mm-chain="1"]').count()) === chain.chain.length || null, 8000);
must(!!mapBack, "D P on — the chain story returns to the map");

// ---------- E: world intact + noise buckets ----------
must((await page.locator("[data-job]").count()) === roster0.length, "E the canvas roster is unchanged");
must(consoleErrors.length === 0, "F console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "F console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "F zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "F resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "F hmr noise bounded", `${hmrNoise.length}`);

console.log(`\n==== t683 minimap-chain: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
