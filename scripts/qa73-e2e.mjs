// qa73 — Job note (annotation) e2e.
// The note is the scientist's margin annotation: type → debounced autosave
// (600 ms) → server round-trip → amber badge on the canvas card. Three
// phases:
//   A  API matrix — echo / trim / ""→null / 501-char 400 / list flow
//   B  UI flow — real typing → dirty→saving→saved → server truth →
//      Esc-peel → badge on card → RELOAD persistence → reopen → clear;
//      plus the fast-typist guarantee (type + Esc within the debounce
//      window still lands via the unmount flush)
//   C  print contract — the note is SCREEN metadata: paper carries the
//      pipeline, not the margin notes (badge is .no-print, text lives in
//      a title attr) → pdftotext must NOT find the note text
// Run: node scripts/qa73-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t73-print.pdf";
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
must(list.length > 0, `seed present (${list.length} jobs)`);
const completed = list.filter((j) => j.status === "completed");
const target = completed.find((j) => /^class2d/i.test(j.type)) ?? completed[0] ?? list[0];
const apiTarget = completed.find((j) => j.id !== target.id) ?? list[1] ?? target;
console.log(`target: ${target.name} (${target.type}) ${target.id}`);
console.log(`apiTarget: ${apiTarget.name} (${apiTarget.type}) ${apiTarget.id}`);
// leave both targets clean before starting
await api(`/api/jobs/${target.id}`, { note: "" });
await api(`/api/jobs/${apiTarget.id}`, { note: "" });

/* ---------------- Phase A: API matrix ---------------- */
console.log("Phase A — API matrix");
{
  const NOTE = "Golden class — use for refine3d";
  let r = await api(`/api/jobs/${apiTarget.id}`, { note: NOTE });
  must(r.status === 200 && r.json.job?.note === NOTE, "A1 note echoes verbatim");

  r = await api("/api/jobs");
  const row = (r.json.jobs ?? []).find((j) => j.id === apiTarget.id);
  must(row?.note === NOTE, "A2 GET /api/jobs carries the note");

  r = await api(`/api/jobs/${apiTarget.id}`, { note: "  " + NOTE + "  " });
  must(r.status === 200 && r.json.job?.note === NOTE, "A3 trim normalization");

  r = await api(`/api/jobs/${apiTarget.id}`, { note: "" });
  must(r.status === 200 && r.json.job?.note === null, "A4 empty string clears to null");

  r = await api(`/api/jobs/${apiTarget.id}`, { note: "x".repeat(501) });
  must(r.status === 400, "A5 501 chars → 400");
  r = await api(`/api/jobs/${apiTarget.id}`, { note: "x".repeat(500) });
  must(r.status === 200 && r.json.job?.note?.length === 500, "A6 exactly 500 → 200");
  await api(`/api/jobs/${apiTarget.id}`, { note: "" });

  r = await api(`/api/jobs/${apiTarget.id}`, { note: 42 });
  must(r.status === 200 && r.json.job?.note === null, "A7 non-string note ignored (no crash)");
}

/* ---------------- Phase B: UI flow ---------------- */
console.log("Phase B — UI flow");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
p.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text().slice(0, 160)); });

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
if (!(await p.evaluate(() => !!document.querySelector("[data-canvas=workspace]")))) {
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(2000);
}
must(await p.evaluate(() => !!document.querySelector("[data-canvas=workspace]")), "B0 canvas view");

// open the inspector with a REAL mouse click on the target card
const card = p.locator(`[data-job="${target.id}"]`).first();
await card.scrollIntoViewIfNeeded().catch(() => {});
await sleep(400);
const box = await card.boundingBox();
must(!!box, "B1 target card on canvas");
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
await p.waitForTimeout(1200);
must(await p.evaluate(() => !!document.querySelector("[role=dialog]")), "B2 inspector open");

// the note editor lives in the Overview tab (completed jobs open on
// Log/Results smart defaults) — click the Overview tab first
const openOverview = async () => {
  if (await p.evaluate(() => !!document.querySelector("[data-note-editor]"))) return;
  await p.getByRole("tab", { name: /Overview/i }).click();
  await p.waitForTimeout(500);
};
await openOverview();
must(await p.evaluate(() => !!document.querySelector("[data-note-editor]")), "B2b note editor in Overview tab");

const ta = p.locator('textarea[aria-label="Job note"]');
must((await ta.count()) === 1, "B3 note textarea present");
must((await ta.inputValue()) === "", "B4 empty note starts empty");
must((await p.locator('[data-note-editor][data-note-state="idle"]').count()) === 1, "B5 idle state");

// real typing → dirty → (debounce) → saved
const NOTE = "Golden class — reuse for refine3d";
await ta.click();
await p.keyboard.type(NOTE, { delay: 12 });
must((await p.locator('[data-note-editor][data-note-state="dirty"]').count()) === 1, "B6 typing → dirty");
await p.waitForSelector('[data-note-editor][data-note-state="saved"]', { timeout: 4000 });
must(true, "B7 debounce → saved state");
const savedClock = await p.locator('[data-note-editor] .tabular-nums').first().textContent();
must(/Saved \d{1,2}:\d{2}/.test(savedClock ?? ""), `B8 saved clock (${savedClock?.trim()})`);

const server = ((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === target.id)?.note;
must(server === NOTE, "B9 server truth matches typed text");

// Esc peels exactly one layer (inspector closes, note stays saved)
await p.keyboard.press("Escape");
await p.waitForTimeout(900);
must(!(await p.evaluate(() => !!document.querySelector("[data-note-editor]"))), "B10 Esc closes inspector");
// playwright evaluate does NOT carry node closures — build selectors here
const badgeSel = (id) => `[data-job="${id}"] [data-note-badge]`;
must(await p.evaluate((s) => !!document.querySelector(s), badgeSel(target.id)), "B11 badge on canvas card");

// reload — the note follows the JOB (server-side), not the browser
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(3000);
must(await p.evaluate((s) => !!document.querySelector(s), badgeSel(target.id)), "B12 badge survives reload");

// reopen → editor restores the persisted note
const box2 = await p.locator(`[data-job="${target.id}"]`).first().boundingBox();
await p.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 3);
await p.waitForTimeout(1200);
await openOverview();
must((await ta.inputValue()) === NOTE, "B13 editor restores persisted note");

// fast-typist guarantee: type + Esc WITHIN the debounce window still lands
await ta.click();
await p.keyboard.press("Control+a");
await p.keyboard.type("Fast close flush probe", { delay: 8 });
await p.waitForTimeout(120); // < 600 ms debounce
await p.keyboard.press("Escape");
await p.waitForTimeout(1200);
const fast = ((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === target.id)?.note;
must(fast === "Fast close flush probe", "B14 unmount flush beats the debounce window");

// clear path — Clear button → server null → badge gone
const box3 = await p.locator(`[data-job="${target.id}"]`).first().boundingBox();
await p.mouse.click(box3.x + box3.width / 2, box3.y + box3.height / 3);
await p.waitForTimeout(1200);
await openOverview();
await p.locator('button[aria-label="Clear note"]').click();
await p.waitForSelector('[data-note-editor][data-note-state="saved"]', { timeout: 4000 });
const afterClear = ((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === target.id)?.note ?? null;
must(afterClear === null, "B15 clear → server null");
await p.keyboard.press("Escape");
await p.waitForTimeout(900);
must(!(await p.evaluate((s) => !!document.querySelector(s), badgeSel(target.id))), "B16 badge disappears when cleared");

/* ---------------- Phase C: print contract ---------------- */
console.log("Phase C — print contract (notes are screen-only)");
{
  await api(`/api/jobs/${target.id}`, { note: "GOLDENCLASSMARKER archival margin note" });
  // reopen the inspector so the fresh note is in view state, then close it —
  // paper shows the canvas (masthead + cards), like a user's Ctrl+P
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  const has = await p.evaluate((s) => !!document.querySelector(s), badgeSel(target.id));
  must(has, "C1 note badge visible on screen");
  await p.emulateMedia({ media: "print" });
  await p.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true });
  await p.emulateMedia({ media: "screen" });
  const txt = execSync(`pdftotext ${OUT} -`, { encoding: "utf8" }).replace(/\s+/g, "").toLowerCase();
  must(!txt.includes("goldenclassmarker"), "C2 note text absent from paper");
  must(!txt.includes("archivalmarginnote"), "C3 note tail absent from paper");
  await api(`/api/jobs/${target.id}`, { note: "" });
}

await b.close();

const errs = pageErrors.filter((e) => !e.includes("favicon"));
must(errs.length === 0, `B17 console clean (${errs.length})`);
if (errs.length) console.log(errs.slice(0, 5));

console.log(fail === 0 ? "\nQA73 GREEN" : `\nQA73 FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
