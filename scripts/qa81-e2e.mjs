// qa81 — Class notes in the command palette + deep link (Task 81).
// Task 80 put notes on classes; Task 81 makes them NAVIGABLE from anywhere:
// the palette gains a "Class notes" group (one row per noted class,
// searchable by note text) and selecting a row lands on the host job's edit
// panel with the gallery lightbox open on that class, editor focused — via
// a one-shot pendingClassFocus handshake in the store. Phases:
//   A  retrieval — note-text queries surface the right class rows; heading
//      counts; job-note rows unaffected
//   B  deep link — entry click → canvas → panel on Params tab → lightbox
//      open on the right class, editor focused with existing text;
//      handshake is repeatable (second entry jumps to the other class)
//   C  honesty — deleting a note removes its palette row (live store truth)
// Run: node scripts/qa81-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const SEL_JOB = "QA Class Select";
const N3 = "qa81 marker three — secondary structure visible";
const N5 = "ice contamination at the frost edge";

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

// kill any zombie agent-browser daemon BEFORE seeding/PATCHing: a leftover
// page with the select2d ParamsTab open holds a stale form (classNotes
// "{}") and its debounced save rewrites the whole params ~1.7s after our
// PATCH lands — the qa58 zombie-page lesson, param-channel edition
try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- seed + API truth ---------------- */
execSync("python3 scripts/qa58-seed-gallery.py", { encoding: "utf8", timeout: 120_000 });
const jobs0 = (await api("/api/jobs")).json.jobs ?? [];
const sel = jobs0.find((j) => j.name === SEL_JOB && j.type === "select2d");
must(sel != null, "S1 select2d gallery job seeded");
must(sel.status === "idle", `S2 host is idle (edit panel hosts the gallery)`);
await api(`/api/jobs/${sel.id}`, { params: { classNotes: JSON.stringify({ 3: N3, 5: N5 }) } });
// tripwire: re-read AFTER the debounce window of any zombie writer
await sleep(2500);
const verify = JSON.parse(
  (((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === sel.id)?.params?.classNotes) ?? "{}"
);
must(verify["3"] === N3 && verify["5"] === N5, `S3 seeded classNotes survived the zombie window (got ${JSON.stringify(verify)})`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

const openPalette = async () => {
  await p.keyboard.press("Control+KeyK");
  await p.waitForSelector('[cmdk-input]');
  await sleep(250);
};
const paletteProbe = () => p.evaluate(() => {
  const groups = [...document.querySelectorAll("[cmdk-group]")];
  const headings = groups.map((g) => g.querySelector("[cmdk-group-heading]")?.textContent?.trim() ?? "");
  const items = [...document.querySelectorAll("[cmdk-group] [cmdk-item]")].map((x) => x.textContent?.trim() ?? "");
  // role-anchored class-annotation rows (Task 86 re-anchor): the Notes
  // group's host rows now ALSO carry "Class N" text (index fallback +
  // fused payload), so "item text includes 'Class 3'" no longer identifies
  // a class-annotation row — the chip does
  const classRows = [...document.querySelectorAll("[cmdk-group] [cmdk-item]")]
    .filter((x) => x.querySelector("[data-palette-classnote-chip]"))
    .map((x) => x.textContent?.trim() ?? "");
  return { headings, items, classRows };
});

/* ---------------- Phase A: retrieval ---------------- */
console.log("Phase A — retrieval");
await openPalette();
await p.keyboard.type("ice contamination");
await sleep(400);
let pal = await paletteProbe();
const classHeading = pal.headings.find((h) => h.startsWith("Class notes"));
must(classHeading !== undefined, "A1 Class notes group present");
must(classHeading === "Class notes · 2 annotations", `A2 heading counts both (${classHeading})`);
const classItems = pal.classRows.filter((t) => t.includes("Class 5"));
must(classItems.length === 1 && classItems[0].includes("Class 5"), `A3 "ice contamination" lands on Class 5 (${classItems[0]?.slice(0, 60)})`);
must(classItems[0]?.includes(N5.slice(0, 16)) && classItems[0]?.includes(SEL_JOB), "A4 row carries note text + host job name");

await p.locator("[cmdk-input]").fill("");
await p.keyboard.type("qa81 marker");
await sleep(400);
pal = await paletteProbe();
const three = pal.classRows.find((t) => t.includes("Class 3"));
must(three !== undefined && three.includes(N3.slice(0, 16)), "A5 note-text query surfaces Class 3");

await p.locator("[cmdk-input]").fill("");
await sleep(300);
pal = await paletteProbe();
must(!pal.items.some((t) => t.includes("not started") && t.includes("note") && !t.includes("Class")), "A6 job Notes group honest at zero job notes");
// Task 86 upgrade: with class notes planted, the Notes group LEGITIMATELY
// exists now (hasJudgment) — the old "no Notes group heading" contract only
// held when the palette read the raw j.note. New contract: exactly the one
// class-notes-only host, index-first fallback, count badge.
const notesHeading = pal.headings.find((h) => h.startsWith("Notes ·"));
must(notesHeading === "Notes · 1 annotated job", `A7 Notes group lists the class-notes-only host (${notesHeading})`);
must(pal.items.some((t) => t.includes(SEL_JOB) && t.includes("class notes on Class 3, Class 5")), "A7b host row carries the index-first fallback");

/* ---------------- Phase B: deep link ---------------- */
console.log("Phase B — deep link");
await p.locator("[cmdk-input]").fill(N5.slice(0, 20));
await sleep(400);
pal = await paletteProbe();
must(pal.items.some((t) => t.includes("Class 5")), "B1 searching by note text finds the class row");
// click the Class 5 ANNOTATION row — anchored by its chip, not bare text:
// the Notes group's host row also contains "Class 5" since Task 86's
// payload fusion (qa79 B2 doctrine — anchor the role, not the string)
await p.locator("[cmdk-item]").filter({ has: p.locator("[data-palette-classnote-chip]") }).filter({ hasText: "Class 5" }).first().click();
await sleep(1200); // panel mount + gallery fetch
const dl = await p.evaluate(() => {
  // the header also renders tabs (Canvas/Workflow/Dashboard) — scope to the
  // PANEL's own tablist, then read which of its triggers is selected
  const panelTabs = [...document.querySelectorAll('[role="tablist"]')]
    .find((t) => [...t.querySelectorAll('[role="tab"]')].some((x) => x.textContent?.trim() === "Params"));
  return {
    paletteOpen: !!document.querySelector("[cmdk-input]"),
    paramsSelected:
      [...(panelTabs?.querySelectorAll('[role="tab"]') ?? [])]
        .find((t) => t.getAttribute("aria-selected") === "true")?.textContent?.trim() ?? null,
    lightbox: document.querySelector('[data-canvas-ui="lightbox-title"]')?.textContent?.trim() ?? null,
    focus: document.activeElement?.getAttribute("data-canvas-ui") ?? null,
    val: document.querySelector('[data-canvas-ui="class-note-editor"]')?.value ?? "",
    grid: !!document.querySelector('[data-canvas-ui="class-grid"]'),
  };
});
must(!dl.paletteOpen, "B2 palette closed after the jump");
must(dl.paramsSelected === "Params", `B3 panel landed on the Params tab (${dl.paramsSelected})`);
must(dl.lightbox === "Class 5", `B4 lightbox open on the noted class (${dl.lightbox})`);
must(dl.focus === "class-note-editor" && dl.val === N5, "B5 editor focused with the existing note loaded");
must(dl.grid, "B6 gallery grid alive behind the lightbox");

// Esc back to the gallery, then jump again to Class 3 — the handshake must
// be repeatable (no stale one-shot state)
await p.keyboard.press("Escape");
await sleep(300);
await openPalette();
await p.locator("[cmdk-item]").filter({ has: p.locator("[data-palette-classnote-chip]") }).filter({ hasText: "Class 3" }).first().click();
await sleep(1200);
const dl2 = await p.evaluate(() => ({
  lightbox: document.querySelector('[data-canvas-ui="lightbox-title"]')?.textContent?.trim() ?? null,
  focus: document.activeElement?.getAttribute("data-canvas-ui") ?? null,
  val: document.querySelector('[data-canvas-ui="class-note-editor"]')?.value ?? "",
}));
must(dl2.lightbox === "Class 3" && dl2.focus === "class-note-editor" && dl2.val === N3, "B7 second jump lands on Class 3 (handshake repeatable)");

// Esc: lightbox closes, panel survives (the Task 80 defaultPrevented guard)
await p.keyboard.press("Escape");
await sleep(300);
const survived = await p.evaluate(() => ({
  lb: !!document.querySelector('[data-canvas-ui="class-note-editor"]'),
  grid: !!document.querySelector('[data-canvas-ui="class-grid"]'),
}));
must(!survived.lb && survived.grid, "B8 Esc closes the lightbox, panel survives");

/* ---------------- Phase C: live truth ---------------- */
console.log("Phase C — live truth");
// delete note 3 through the gallery's own editor (no palette detour), then
// verify the palette's store-truth reflects the deletion
await p.locator('[data-canvas-ui="class-note"][aria-label*="Class 3"]').first().click({ force: true });
await p.waitForSelector('[data-canvas-ui="class-note-editor"]');
await p.locator('[data-canvas-ui="class-note-editor"]').fill("");
await p.keyboard.press("Escape");
await sleep(1500); // debounce settle
await openPalette();
pal = await paletteProbe();
const head3 = pal.headings.find((h) => h.startsWith("Class notes"));
must(head3 === "Class notes · 1 annotation", `C1 palette reflects the deletion (${head3})`);
must(!pal.items.some((t) => t.includes("Class 3")), "C2 deleted class row gone from the palette");
await p.keyboard.press("Escape");
await sleep(200);

must(consoleErrors.length === 0, `D1 console clean (got ${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));

await b.close();
await api(`/api/jobs/${sel.id}`, { params: { classNotes: "{}" } });
const cleaned = JSON.parse(
  (((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === sel.id)?.params?.classNotes) ?? "{}"
);
must(Object.keys(cleaned).length === 0, "Z1 cleanup: classNotes emptied");

console.log(fail === 0 ? "QA81 ALL PASS" : `QA81 FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
