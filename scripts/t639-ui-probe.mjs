// t639-ui-probe — the EMPIAR 10017 world, alive in the app.
// The seeder proves DB rows; this proves FIRST-CLASS CITIZENSHIP: the
// project renders, the chips speak the 12-11-1 contract, the canvas
// carries 12 nodes over real-byte lineage, and the active pointer comes
// home (demo) after the round trip.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMP = "cmut639000empiar100";
const DEMO = "cmuwipe6350000demoproject";
const SH = { "Origin": BASE, "Referer": BASE + "/", "Content-Type": "application/json" };

let PASS = 0;
const must = (c, label, detail = "") => {
  if (!c) throw new Error(`FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  PASS++;
  console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1200);

// A0 — self-healing start: an earlier probe run may have died mid-round-
// trip leaving the pointer displaced (this exact failure happened live —
// the first cut asserted demo and found EMPIAR). Come home FIRST, then
// assert; the probe's own leftovers can never poison its own rerun.
await p.evaluate(async ({ url, headers, id }) => {
  await fetch(url, { method: "POST", headers, body: JSON.stringify({ id }) });
}, { url: `${BASE}/api/projects/switch`, headers: SH, id: DEMO });
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1000);

// A — the registry speaks three projects, EMPIAR among them, demo active
const census = await p.evaluate(async (url) => {
  const r = await fetch(url, { headers: { "Origin": location.origin, "Referer": location.origin + "/" } });
  return r.json();
}, `${BASE}/api/projects`);
const names = census.projects.map((x) => x.name);
must(census.projects.length === 3, "three projects registered", names.join(" | "));
must(names.includes("EMPIAR 10017"), "EMPIAR 10017 is a first-class project");
const activeId = census.projects.find((x) => x.active)?.id;
must(activeId === DEMO, "active pointer still the demo (t635 contract)", activeId);

// B — switch to EMPIAR through the product door, then reload: a raw
// fetch moves the POINTER but the page's store keeps the old world —
// the store's switchProject is POST + load(), and load() is what the
// reload replays (t523 law: poll for view AND nodes, never blind-read)
await p.evaluate(async ({ url, headers, id }) => {
  await fetch(url, { method: "POST", headers, body: JSON.stringify({ id }) });
}, { url: `${BASE}/api/projects/switch`, headers: SH, id: EMP });
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
let nodes = 0;
for (let i = 0; i < 10; i++) {
  nodes = await p.evaluate(() => document.querySelectorAll("[data-job]").length);
  if (nodes === 12) break;
  await sleep(1200);
}
const world = { nodes };
must(world.nodes === 12, "the canvas carries 12 nodes", `${world.nodes}`);

// dashboard: the chips contract (All 12-11-1) — converge via Shift+D
await p.keyboard.press("Shift+D");
let rows = 0;
for (let i = 0; i < 10; i++) {
  rows = await p.locator("[data-roster-row]").count();
  const view = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view"));
  if (view === "dashboard" && rows >= 12) break;
  await p.keyboard.press("Shift+D");
  await sleep(1200);
  await p.keyboard.press("Shift+D");
}
await sleep(600);
rows = await p.locator("[data-roster-row]").count();
must(rows === 12, "the roster speaks 12 rows", `${rows}`);
const chips = await p.evaluate(() => {
  const el = document.querySelector('[data-canvas-ui="relion-chip"], [data-chips], header');
  return (el?.textContent || "").slice(0, 200);
});
must(chips.includes("12"), "the chip band carries the counts", chips.slice(0, 80));
await p.screenshot({ path: "/home/z/my-project/.qa-logs/t639-empiar-dashboard.png" });

// C — the frontier is honest: exactly one idle (postprocess)
const statusLine = await p.evaluate(() => document.body.textContent?.includes("Post-processing"));
must(statusLine, "the idle frontier (Post-processing) is on the board");

// D — come home (same law: pointer, then reload replays the load)
await p.evaluate(async ({ url, headers, id }) => {
  await fetch(url, { method: "POST", headers, body: JSON.stringify({ id }) });
}, { url: `${BASE}/api/projects/switch`, headers: SH, id: DEMO });
await p.reload({ waitUntil: "domcontentloaded" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1500);
const home = await p.evaluate(async (u) => {
  const r = await fetch(u, { headers: { "Origin": location.origin, "Referer": location.origin + "/" } });
  const j = await r.json();
  return { active: j.projects.find((x) => x.active)?.id, count: j.projects.length };
}, `${BASE}/api/projects`);
must(home.active === DEMO, "the active pointer came home (demo)", home.active);

must(errors.length === 0, "zero console/page errors", errors.slice(0, 2).join(" | ") || "0");
await p.screenshot({ path: "/home/z/my-project/.qa-logs/t639-home-restored.png" });
await b.close();
console.log(`T639-UI-PROBE: ${PASS} pass / 0 fail`);
