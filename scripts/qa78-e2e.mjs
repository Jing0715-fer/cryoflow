// qa78 — dashboard filter keyboardization + shortcuts-dialog context
// highlight e2e. Task 78 cashes in the kbd prop Task 76 left reserved:
//   A  keys drive the filter — 5 toggles the Noted property filter, 6 the
//      Unassigned location filter, same state the chips render (hoisted to
//      ProjectDashboard so the 1–4 handler's shortcutsRef pattern owns both)
//   B  chip key badges — the Noted/Unassigned chips carry tiny <kbd> badges
//      (5/6) + aria-keyshortcuts, the discoverability twin of the handler
//   C  dialog — the dashboard group lists the new rows; the group matching
//      the CURRENT view gets the "you are here" treatment (data-current-view)
//      and it MOVES when the view flips (dashboard → canvas → reopen)
//   D  honest dead keys — with zero notes the 5 key is a no-op (the chip is
//      gone; a phantom "No noted jobs" state would be a lie), same for 6
// Run: node scripts/qa78-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const BASE = "http://localhost:3000";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, opts = {}) => {
  const init = opts.body
    ? { method: opts.method ?? "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(opts.body) }
    : opts.method
      ? { method: opts.method }
      : undefined;
  const res = await fetch(BASE + path, init);
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

/* ---------------- setup: one orphan, then two notes ---------------- */
const list = (await api("/api/jobs")).json.jobs ?? [];
let orphans = list.filter((j) => !j.workspaceId);

// exactly one orphan so key 6 has a slice — reuse the legacy-stray trick
// (PATCH refuses NULL workspaceId by design, so prisma it is). Runs BEFORE
// the note seeding so the orphan can't also be a note target (its note is
// wiped here either way — Phase A asserts the 6-slice has no note badges).
const db = new PrismaClient();
if (orphans.length === 0) {
  const formerNames = ["Import Movies 1", "Motion Correction 1", "CTF Estimation 1"];
  const candidate = list.find((j) => j.workspaceId && !j.linkedJobId && formerNames.includes(j.name));
  must(!!candidate, "re-orphan candidate found");
  await db.job.update({ where: { id: candidate.id }, data: { workspaceId: null, note: null } });
} else {
  await db.job.update({ where: { id: orphans[0].id }, data: { note: null } });
  for (const o of orphans.slice(1)) {
    await db.job.update({ where: { id: o.id }, data: { workspaceId: null } });
  }
}
await db.$disconnect();
const fresh = (await api("/api/jobs")).json.jobs ?? [];
orphans = fresh.filter((j) => !j.workspaceId);

// two noted jobs (markers, cleared again in Phase D) — in-workspace rows,
// never the orphan, so the Noted and Unassigned slices stay disjoint
const wsJobs = fresh.filter((j) => j.workspaceId && j.id !== orphans[0]?.id);
must(wsJobs.length >= 3, `in-workspace jobs present (${wsJobs.length})`);
const notedA = wsJobs[0];
const notedB = wsJobs[1];
const M1 = "KEYMARKER1 annotate for key 5";
const M2 = "KEYMARKER2 annotate for key 5";
// payloads ride under `body` — the qa77 silent-GET trap (top-level opts
// turn the call into a GET) has now bitten three times; the notedCount
// assert below is the tripwire that catches it before any browser work
await api(`/api/jobs/${notedA.id}`, { body: { note: "" } });
await api(`/api/jobs/${notedB.id}`, { body: { note: "" } });
await api(`/api/jobs/${notedA.id}`, { body: { note: M1 } });
await api(`/api/jobs/${notedB.id}`, { body: { note: M2 } });

const post = (await api("/api/jobs")).json.jobs ?? [];
const notedCount = post.filter((j) => j.note).length;
must(orphans.length === 1, `exactly one orphan after setup (${orphans.length})`);
must(notedCount === 2, `exactly two noted jobs after setup (${notedCount})`);
console.log(`orphan: ${orphans[0].name} | noted: ${notedA.name}, ${notedB.name}`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(1200); // let the first poll tick surface the seeded notes

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
const ensureView = async (target) => {
  for (let i = 0; i < 4; i++) {
    if ((await curView()) === target) return true;
    await p.keyboard.press("Shift+D");
    await p.waitForTimeout(700);
  }
  return (await curView()) === target;
};
const spot = p.locator('section[aria-label="Active project spotlight"]');
const press = async (key) => {
  // dispatch through the window like the real handler (agent-browser parity
  // with qa73's keying pattern)
  await p.evaluate((k) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  }, key);
  await p.waitForTimeout(450);
};

/* ---------------- Phase A: keys drive the filter ---------------- */
console.log("Phase A — 5/6 toggle the Jobs filter");
{
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(700);
  must(await ensureView("dashboard"), "A1 dashboard view reached");
  await p.waitForTimeout(800); // poll tick: chips reflect the seeded notes

  const notedChip = spot.locator('[data-filter="noted"]');
  const unChip = spot.locator('[data-filter="unassigned"]');
  must((await notedChip.count()) === 1, "A2 Noted chip present (2 noted)");
  must((await unChip.count()) === 1, "A2b Unassigned chip present (1 orphan)");

  await press("5");
  must((await notedChip.getAttribute("aria-pressed")) === "true",
    "A3 key 5 activates the Noted filter (aria-pressed)");
  must((await spot.locator("[data-row-note-badge]").count()) === 2,
    "A3b only the two noted rows visible");
  must((await spot.locator("[data-row-orphan]").count()) === 0,
    "A3c orphan row filtered out of the noted slice");

  await press("5");
  must((await notedChip.getAttribute("aria-pressed")) === "false",
    "A4 key 5 again returns to all (toggle, not latch)");
  must((await spot.locator("[data-row-orphan]").count()) === 1,
    "A4b orphan row back in the unfiltered list");

  await press("6");
  must((await unChip.getAttribute("aria-pressed")) === "true",
    "A5 key 6 activates the Unassigned filter");
  must((await spot.locator("[data-row-orphan]").count()) === 1,
    "A5b only the orphan row visible");
  must((await spot.locator("[data-row-note-badge]").count()) === 0,
    "A5c noted rows filtered out of the orphan slice");

  await press("6");
  must((await unChip.getAttribute("aria-pressed")) === "false", "A6 key 6 again returns to all");
}

/* ---------------- Phase B: chip key badges + aria ---------------- */
console.log("Phase B — kbd badges on the chips");
{
  const kbd5 = await spot.locator('[data-filter="noted"] kbd').textContent();
  must((kbd5 ?? "").trim() === "5", "B1 Noted chip carries a <kbd>5</kbd> badge");
  const kbd6 = await spot.locator('[data-filter="unassigned"] kbd').textContent();
  must((kbd6 ?? "").trim() === "6", "B1b Unassigned chip carries a <kbd>6</kbd> badge");
  must((await spot.locator('[data-filter="noted"]').getAttribute("aria-keyshortcuts")) === "5",
    "B2 aria-keyshortcuts mirrors the badge (noted)");
  must((await spot.locator('[data-filter="unassigned"]').getAttribute("aria-keyshortcuts")) === "6",
    "B2b aria-keyshortcuts mirrors the badge (unassigned)");
  // the plain status chips stay key-free — digits 1–4 belong to the grid
  const allKbds = await spot.locator('[data-filter] kbd').count();
  must(allKbds === 2, `B3 exactly two key badges in the filter row (${allKbds})`);
}

/* ---------------- Phase C: dialog rows + context highlight ---------------- */
console.log("Phase C — shortcuts dialog: rows + you-are-here group");
{
  await p.keyboard.press("?");
  await p.waitForTimeout(600);
  const dlg = p.locator('[role="dialog"]').filter({ hasText: "Keyboard shortcuts" });
  must((await dlg.count()) === 1, "C1 dialog opens from the dashboard");
  const text = (await dlg.textContent()) ?? "";
  must(text.includes("Jobs filter — noted (annotated) jobs only"),
    "C2 dashboard group lists key 5");
  must(text.includes("Jobs filter — unassigned orphans only"),
    "C2b dashboard group lists key 6");

  const dashActive = dlg.locator('section[aria-label="Project dashboard shortcuts"][data-current-view="true"]');
  const canvasActive = dlg.locator('section[aria-label="Canvas shortcuts"][data-current-view="true"]');
  must((await dashActive.count()) === 1,
    "C3 dashboard group carries the current-view highlight");
  must((await canvasActive.count()) === 0, "C3b canvas group does not (we are on the dashboard)");

  // the highlight must MOVE with the view: close, flip to canvas, reopen
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(700);
  must(await ensureView("canvas"), "C4 flipped to the canvas");
  await p.keyboard.press("?");
  await p.waitForTimeout(600);
  must((await canvasActive.count()) === 1,
    "C5 reopening from the canvas moves the highlight to the canvas group");
  must((await dashActive.count()) === 0, "C5b dashboard group released it");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
}

/* ---------------- Phase D: honest dead keys + cleanup ---------------- */
console.log("Phase D — dead keys when the slice is empty");
{
  await ensureView("dashboard");
  await api(`/api/jobs/${notedA.id}`, { body: { note: "" } });
  await api(`/api/jobs/${notedB.id}`, { body: { note: "" } });
  await p.waitForTimeout(2500); // poll tick: chips re-render at zero notes

  must((await spot.locator('[data-filter="noted"]').count()) === 0,
    "D1 Noted chip gone at zero notes (Task 76 semantics)");
  const rowsBefore = await spot.locator("div.group\\/row").count();
  await press("5");
  const rowsAfter = await spot.locator("div.group\\/row").count();
  must(rowsAfter === rowsBefore,
    `D2 key 5 with zero noted jobs is a no-op (${rowsBefore} → ${rowsAfter} rows)`);
  const dashActive = p.locator('section[aria-label="Project dashboard shortcuts"][data-current-view="true"]');
  must((await dashActive.count()) === 0, "D2b no dialog re-opened / no stray highlight");

  must(consoleErrors.length === 0, `D3 console clean (${consoleErrors.length} errors)`);
  if (consoleErrors.length) console.log("   errors:", consoleErrors.slice(0, 5));
}

await b.close();
console.log(fail === 0 ? "\nqa78 ALL PASS" : `\nqa78 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
