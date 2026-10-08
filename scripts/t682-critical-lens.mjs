// t682 — the critical path lens: the fifth face's chain painted back onto
// the canvas.
//
// t681 gave the analytics panel the Critical path face — the walk-back
// from the finisher through each step's latest-finishing upstream. But
// the face lives on the dashboard while the story lives on the CANVAS:
// a scientist looking at 17 cards asks "which of THESE is the chain?"
// t682 adds the lens — canvas toolbar's Route button (or P): chain cards
// keep full ink, everything the finish didn't wait on recedes, the
// walked wires carry the chain stroke, and a chip above the toolbar
// speaks the same numbers the face speaks.
//
// The probe's honesty anchor is the same INDEPENDENT recomputation t681
// flew (same walk law, different code, no shared import) — extended to
// record the walked edge ids, because the lens's wire law is checkable:
// a walked hop keeps its ink at the selection's width, every other wire
// recedes, INCLUDING chords between two chain cards the walk didn't use.
//
// Legs:
//   S  canvas opens, the toggle stands enabled, the chip is away (lens off)
//   A  lens ON: chip speaks the mirror's chain; cards split dim/full-ink
//      along the chain; wires split along the walked hops
//   B  the keyboard twin: P toggles the lens twice, both faces agree
//   C  the lens survives the dashboard roundtrip (store state, spotlight law)
//   D  the dim union: with the note spotlight also ON, the chain dims too —
//      lenses dim independently, ink multiplies (spotlight's predicate wins
//      on its own terms)
//   E  lens OFF: the world returns to full ink, chip gone
//   F  world intact + noise buckets
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
// lib/critical-path WITHOUT importing them — a shared bug can't hide
// behind a shared import). t681's mirror, extended to record the walked
// edge ids (departure semantics: step i carries the wire to step i+1). ----------
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
  const busyMs = chain.reduce((a, s) => a + s.ms, 0);
  const spanMs = Math.max(entry.end - chain[0].start, 0);
  return {
    chain, spanMs, busyMs,
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
// the canvas is the default view on a fresh context — wait for cards
await pollUntil(async () => (await page.locator("[data-job]").count()) > 0 || null, 15000);

const toggle = page.locator('[data-canvas-ui="critical-toggle"]');
must((await toggle.count()) === 1, "S the critical toggle stands on the toolbar");
must((await toggle.isEnabled()) === true, "S the toggle is enabled (the world has finished runs)");
must((await toggle.getAttribute("aria-pressed")) === "false", "S the lens starts OFF");
must((await page.locator('[data-canvas-ui="critical-chip"]').count()) === 0, "S the chip is away while the lens is off");

// ---------- A: lens ON — the world splits along the chain ----------
await toggle.click();
const chip = page.locator('[data-canvas-ui="critical-chip"]');
const chipUp = await pollUntil(async () => (await chip.count()) > 0 || null, 8000);
must(!!chipUp, "A the chip rides above the toolbar");
must((await chip.getAttribute("data-critical-steps")) === String(chain.chain.length),
  "A the chip's step count matches the independent chain", `expected ${chain.chain.length}`);
must((await chip.getAttribute("data-critical-span")) === String(chain.spanMs),
  "A the chip's span matches the independent arithmetic", `${chain.spanMs}`);
const chipText = ((await chip.textContent()) ?? "").replace(/\s+/g, " ").trim();
must(chipText.includes(fmtDuration(chain.spanMs)) && chipText.toLowerCase().includes("critical path"),
  "A the chip speaks the span in words", chipText.slice(0, 90));
must((await toggle.getAttribute("aria-pressed")) === "true", "A the toggle reads pressed");

// cards: a chain card keeps full ink, an off-chain card carries the deep dim
const dimmedOk = await pollUntil(async () => {
  const on = await page.locator(`[data-job="${chain.entryId}"]`).getAttribute("class");
  const off = offChain.length > 0
    ? await page.locator(`[data-job="${offChain[0]}"]`).getAttribute("class")
    : "";
  return (on != null && !on.includes("note-spotlight-dim") && off != null && off.includes("note-spotlight-dim")) || null;
}, 8000);
must(!!dimmedOk, "A a chain card keeps full ink while an off-chain card recedes",
  `finisher="${chain.entryId}" off-chain="${offChain[0] ?? "none"}"`);
// every off-chain card dims, every chain card doesn't
const split = await page.locator("[data-job]").evaluateAll((els) => {
  const dim = els.filter((el) => el.className.includes("note-spotlight-dim")).map((el) => el.getAttribute("data-job"));
  const ink = els.filter((el) => !el.className.includes("note-spotlight-dim")).map((el) => el.getAttribute("data-job"));
  return { dim, ink };
});
must(split.dim.every((id) => !chainSet.has(id ?? "")),
  "A no chain card carries the dim", `${split.ink.length} full-ink cards`);
must(offChain.every((id) => split.dim.includes(id)),
  "A every off-chain card recedes", `${split.dim.length} dimmed cards`);

// wires: the walked hops keep their ink at the selection's width; everything
// else recedes — chords between chain cards included
const wireSplit = await page.locator("[data-edges-layer] [data-edge-id]").evaluateAll((els) => {
  const out = {};
  for (const el of els) {
    const id = el.getAttribute("data-edge-id");
    const main = el.querySelector("[data-e-main]");
    out[id] = { op: el.style.opacity, w: main ? main.getAttribute("stroke-width") : null };
  }
  return out;
});
const chainWiresOk = chain.edgeIds.every((id) => {
  const w = wireSplit[id];
  return w && (w.op === "1" || w.op === "") && w.w === "3.2";
});
must(chainWiresOk, "A every walked wire keeps full ink at the chain width",
  chain.edgeIds.map((id) => `${id}:${wireSplit[id]?.op}/${wireSplit[id]?.w}`).join(" ").slice(0, 120) || "none");
const recededOk = offChainEdges.length === 0 ||
  offChainEdges.slice(0, 5).every((id) => wireSplit[id] && wireSplit[id].op === "var(--dim-wire)");
must(recededOk, "A every unwalked wire recedes (chords included)",
  offChainEdges.slice(0, 5).map((id) => `${id}:${wireSplit[id]?.op}`).join(" "));
await page.screenshot({ path: ".qa-logs/t682-lens-on.png" });

// ---------- B: the keyboard twin ----------
await page.keyboard.press("p");
const chipGone = await pollUntil(async () => ((await chip.count()) === 0 ? true : null), 8000);
must(!!chipGone, "B P key turns the lens off (chip leaves)");
const inkBack = await pollUntil(async () => {
  const cls = await page.locator(`[data-job="${offChain[0]}"]`).getAttribute("class");
  return cls != null && !cls.includes("note-spotlight-dim") ? true : null;
}, 8000);
must(!!inkBack, "B the off-chain card returns to full ink");
await page.keyboard.press("p");
const chipBack = await pollUntil(async () => (await chip.count()) > 0 || null, 8000);
must(!!chipBack, "B P key turns the lens back on (chip returns)");

// ---------- C: the lens survives the dashboard roundtrip ----------
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(2000);
await page.getByRole("tab", { name: "Workflow" }).click().catch(() => {});
await sleep(2000);
const chipSurvives = await pollUntil(async () => (await chip.count()) > 0 || null, 10000);
must(!!chipSurvives, "C the lens survives the dashboard roundtrip (a viewing lens in the store)");

// ---------- D: the dim union — spotlight and chain dim independently ----------
await page.keyboard.press("n"); // the note spotlight over the same canvas
await sleep(800);
const unionState = await page.locator(`[data-job="${chain.entryId}"]`).getAttribute("class");
const noneNoted = (await page.locator("[data-job]").evaluateAll((els) =>
  els.filter((el) => el.className.includes("note-spotlight-dim")).length));
must(noneNoted > 0 && unionState != null && unionState.includes("note-spotlight-dim"),
  "D with the spotlight also ON, the chain dims too (lenses dim independently)",
  `${noneNoted}/${roster0.length} cards dimmed by the spotlight`);
await page.keyboard.press("n");
await sleep(800);
const chainBack = await page.locator(`[data-job="${chain.entryId}"]`).getAttribute("class");
must(chainBack != null && !chainBack.includes("note-spotlight-dim"),
  "D spotlight OFF — the chain returns to full ink under the lens");

// ---------- E: lens OFF — the world returns ----------
await toggle.click();
const chipOff = await pollUntil(async () => ((await chip.count()) === 0 ? true : null), 8000);
must(!!chipOff, "E the toggle click turns the lens off (chip leaves)");
const allInk = await pollUntil(async () => {
  const dims = await page.locator("[data-job]").evaluateAll((els) =>
    els.filter((el) => el.className.includes("note-spotlight-dim")).length);
  return dims === 0 ? true : null;
}, 8000);
must(!!allInk, "E every card returns to full ink");
const wiresBack = await page.locator("[data-edges-layer] [data-edge-id]").evaluateAll((els) =>
  els.every((el) => el.style.opacity !== "var(--dim-wire)"));
must(wiresBack, "E every wire returns to full ink");

// ---------- F: world intact + noise buckets ----------
must(consoleErrors.length === 0, "F console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "F console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "F zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "F resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "F hmr noise bounded", `${hmrNoise.length}`);

console.log(`\n==== t682 critical-lens: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
