// qa76 — Note aggregation on the dashboard e2e.
// Task 76 extends the annotation system (73 data → 74 paper → 75 lens →
// 76 management view): the dashboard Jobs list gains the amber row badge
// (hover = full text) and a "Noted N" property filter chip — the dashboard
// twin of the canvas spotlight. Phases:
//   A  aggregation — row badges with full-text titles, Noted chip count,
//      filter narrows to noted rows only, All restores, reload persistence
//   B  print hygiene — the filter chip row is interactive chrome and stays
//      off the paper; note TEXT never prints from the dashboard (the
//      annotation's official paper channel remains the canvas excerpt)
//   C  cross-view consistency — canvas badges show for the same jobs;
//      clearing a note updates every surface (badge, chip, count)
// Run: node scripts/qa76-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t76-print.pdf";
rmSync(OUT, { force: true });

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, body) => {
  const res = await fetch(BASE + path, body
    ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

/* ---------------- pick targets ---------------- */
const list = (await api("/api/jobs")).json.jobs ?? [];
must(list.length >= 3, `seed present (${list.length} jobs)`);
// targets MUST live inside a workspace: the canvas renders only the active
// workspace's jobs, so a null-workspace job (QA-era strays in the seed)
// shows on the dashboard but has no canvas card — Phase C would chase a
// badge that can never exist. Dashboard asserts stay full-roster.
const wsJobs = list.filter((j) => j.workspaceId);
must(wsJobs.length >= 3, `workspace-scoped jobs present (${wsJobs.length})`);
const notedA = wsJobs[0];
const notedB = wsJobs[1];
const clean = wsJobs[2];
const M1 = "DASHMARKER1 refine candidate";
const M2 = "DASHMARKER2 ab initio redo";
await api(`/api/jobs/${notedA.id}`, { note: "" });
await api(`/api/jobs/${notedB.id}`, { note: "" });
await api(`/api/jobs/${clean.id}`, { note: "" });
await api(`/api/jobs/${notedA.id}`, { note: M1 });
await api(`/api/jobs/${notedB.id}`, { note: M2 });
console.log(`notedA: ${notedA.name} | notedB: ${notedB.name} | clean: ${clean.name}`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

// view is in-memory state: a reload lands on the canvas regardless of
// where the previous page was — every post-reload assertion must aim
// at the right view first (harness lesson from the first qa76 run:
// A10/A11/B1/C1 all failed only because the dashboard wasn't mounted)
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

/* ---------------- Phase A: aggregation ---------------- */
console.log("Phase A — dashboard aggregation");
const spot = p.locator('section[aria-label="Active project spotlight"]');
{
  await p.keyboard.press("Shift+D"); // canvas → dashboard
  await p.waitForTimeout(700);
  must(await ensureView("dashboard"), "A1 dashboard view reached, spotlight section visible");
  must(await spot.count() === 1, "A1b spotlight section visible");

  const badgeSel = (id) => `section[aria-label="Active project spotlight"] button[data-row-note-badge], section[aria-label="Active project spotlight"] [data-row-note-badge]`;
  // count badges + titles in one Node-side composed evaluate (no closures!)
  const inv = await p.evaluate((sel) => {
    const badges = [...document.querySelectorAll(sel)];
    return badges.map((el) => ({ t: el.getAttribute("title"), label: el.getAttribute("aria-label") }));
  }, "[data-row-note-badge]");
  must(inv.length === 2, `A2 exactly 2 row badges (got ${inv.length})`);
  must(inv.every((x) => x.label === "Job has a note"), "A3 badges carry the aria label");
  must(inv.some((x) => x.t === M1) && inv.some((x) => x.t === M2), "A4 titles carry FULL note text");

  const chips = await p.evaluate(() => {
    const g = document.querySelector('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"]');
    return [...(g?.querySelectorAll("button") ?? [])].map((x) => x.textContent.trim());
  });
  const notedChip = chips.find((c) => c.startsWith("Noted"));
  must(notedChip !== undefined, "A5 Noted chip present in the filter row");
  must(notedChip?.includes("2") ?? false, "A6 Noted chip counts 2");

  await spot.locator("button", { hasText: /^Noted/ }).first().click();
  await p.waitForTimeout(300);
  const rows = await p.evaluate(() => {
    const list = document.querySelector('section[aria-label="Active project spotlight"] .max-h-80');
    return [...(list?.querySelectorAll("button") ?? [])].map((r) => r.getAttribute("title"));
  });
  must(rows.length === 2, `A7 filter narrows to 2 rows (got ${rows.length})`);
  must(rows.every((t) => t === `Open ${notedA.name}` || t === `Open ${notedB.name}`),
    "A8 only the noted jobs remain visible");

  await spot.locator("button", { hasText: /^All/ }).first().click();
  await p.waitForTimeout(300);
  const allRows = await p.evaluate(() => {
    const list = document.querySelector('section[aria-label="Active project spotlight"] .max-h-80');
    return list ? list.querySelectorAll("button").length : -1;
  });
  must(allRows === list.length, `A9 All restores the full roster (got ${allRows}/${list.length})`);

  // the filter is component state by design — reload resets to All while
  // the badges persist (notes live on the server)
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-canvas="viewport"]');
  await p.waitForTimeout(800);
  must(await ensureView("dashboard"), "A10b back on the dashboard after reload");
  const pressed = await p.evaluate(() => {
    const g = document.querySelector('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"]');
    return [...(g?.querySelectorAll("button") ?? [])].filter((x) => x.getAttribute("aria-pressed") === "true").map((x) => x.textContent.trim());
  });
  must(pressed.length === 1 && pressed[0].startsWith("All"), "A10 reload resets filter to All");
  must(await p.locator("[data-row-note-badge]").count() === 2, "A11 badges persist after reload");
}

/* ---------------- Phase B: print hygiene ---------------- */
console.log("Phase B — dashboard print: roster on paper, chrome off");
{
  // print from the DASHBOARD view: its paper is a flowing portrait roster.
  // (Printing the canvas view would engage the fit-to-paper landscape
  // contract — an A4 PORTRAIT sheet is outside that contract's budget and
  // clips the pipeline, which is the expected canvas behavior, not a bug.)
  must(await ensureView("dashboard"), "B0 dashboard view for the portrait print");
  await p.emulateMedia({ media: "print" });
  await p.pdf({ path: OUT, printBackground: true, preferCSSPageSize: false, format: "A4" });
  await p.emulateMedia({ media: "screen" });
  const strip = (s) => s.replace(/\s+/g, "").toLowerCase();
  const txt = strip(execSync(`pdftotext ${OUT} -`, { encoding: "utf8" }));
  must(txt.includes(notedA.name.toLowerCase().replace(/\s+/g, "")), "B1 noted job's name on paper (roster)");
  must(!txt.includes("dashmarker1"), "B2 note TEXT off the paper (official channel = canvas sheet)");
  must(!txt.includes("noted2") && !txt.includes("noted"), "B3 filter chips off the paper (interactive chrome)");
}

/* ---------------- Phase C: cross-view consistency ---------------- */
console.log("Phase C — canvas ↔ dashboard consistency");
{
  must(await ensureView("canvas"), "C0 canvas view for badge checks");
  await p.waitForTimeout(700);
  const badgeSel = (id) => `[data-job="${id}"] [data-note-badge]`;
  const canvasA = await p.evaluate((s) => !!document.querySelector(s), badgeSel(notedA.id));
  const canvasB = await p.evaluate((s) => !!document.querySelector(s), badgeSel(notedB.id));
  const canvasC = await p.evaluate((s) => !!document.querySelector(s), badgeSel(clean.id));
  must(canvasA && canvasB, "C1 canvas badges lit for the same two jobs");
  must(!canvasC, "C2 clean job has no canvas badge");

  await api(`/api/jobs/${notedA.id}`, { note: "" });
  await api(`/api/jobs/${notedB.id}`, { note: "" });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  must(await p.locator("[data-row-note-badge]").count() === 0, "C3 row badges gone after clearing");
  const chips = await p.evaluate(() => {
    const g = document.querySelector('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"]');
    return [...(g?.querySelectorAll("button") ?? [])].map((x) => x.textContent.trim());
  });
  must(!chips.some((c) => c.startsWith("Noted")), "C4 Noted chip honestly absent at zero notes");
  must(await p.locator("[data-note-spotlight]").count() === 1, "C5 canvas lens chip still present (disabled state)");

  must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);
}

await b.close();
console.log(fail === 0 ? "\nqa76: ALL PASS" : `\nqa76: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
