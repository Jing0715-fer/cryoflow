// qa80 — Class-level annotations e2e (Task 80).
// The annotation system reaches its fourth surface: Job.note notes the job
// (73-79), the CLASS note annotates the judgment INSIDE the job — stored as
// the classNotes param (JSON map cls→text) on the select2d job, edited in
// the gallery lightbox, filtered by a Noted-only lens. Phases:
//   A  card surface — amber badges on noted classes with full-text labels,
//      Noted chip counts + filters, zoom button yields its corner
//   B  lightbox editor — opens focused, loads existing text, debounced
//      persistence to the params JSON, textarea keyboard isolation
//      (arrows/Enter type, not navigate), Esc returns to the gallery
//   C  self-heal — deleting the last note under an active Noted-only lens
//      revokes the lens instead of showing a dead grid; chip disables at 0
//   D  persistence round-trip — reload → reopen → badges match the API
// Run: node scripts/qa80-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const SEL_JOB = "QA Class Select";
const N3 = "qa80 marker three — secondary structure";
const N5a = "ice contamination at the frost edge";
const N5b = "ice contamination at the frost edge — discard before refine";

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

/* ---------------- seed + API truth ---------------- */
execSync("python3 scripts/qa58-seed-gallery.py", { encoding: "utf8", timeout: 120_000 });
const jobs0 = (await api("/api/jobs")).json.jobs ?? [];
const sel = jobs0.find((j) => j.name === SEL_JOB && j.type === "select2d");
must(sel != null, "S1 select2d gallery job seeded");
const upstream = jobs0.find((j) => j.type === "class2d");
must(upstream != null, "S2 upstream class2d job seeded");

const setNotes = (obj) => api(`/api/jobs/${sel.id}`, { params: { classNotes: JSON.stringify(obj) } });
const r1 = await setNotes({ 3: N3, 5: N5a });
must(r1.status === 200, "S3 classNotes PATCH accepted (spec-allowed param)");
const after = ((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === sel.id);
const notesFromApi = JSON.parse(after?.params?.classNotes ?? "{}");
must(notesFromApi["3"] === N3 && notesFromApi["5"] === N5a, "S4 API round-trips both notes");

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

const openPanel = async () => {
  for (let i = 0; i < 6; i++) {
    const card = p.locator('[role="button"]', { hasText: SEL_JOB }).first();
    if ((await card.count()) > 0) {
      await card.click();
      await sleep(1000);
      const tab = p.getByRole("tab", { name: "Params" });
      if ((await tab.count()) > 0) {
        await tab.first().click();
        await sleep(700);
      }
      if (await p.locator('section[aria-label="Class selection gallery"]').count()) return true;
    }
    await sleep(1500);
  }
  return false;
};
const probe = (fn, arg) => p.evaluate(fn, arg);

must(await openPanel(), "S5 gallery visible in the select2d Params panel");

/* ---------------- Phase A: card surface ---------------- */
console.log("Phase A — card surface");
const gridInfo = await probe((arg) => {
  const { n3, n5 } = arg;
  const grid = document.querySelector('[data-canvas-ui="class-grid"]');
  const cards = [...(grid?.querySelectorAll("button[aria-pressed]") ?? [])];
  const noted = [...document.querySelectorAll('[data-canvas-ui="class-note"][data-noted="true"]')];
  const notedLabels = noted.map((x) => x.getAttribute("aria-label"));
  const chip = document.querySelector('[data-canvas-ui="noted-only"]');
  return {
    cards: cards.length,
    noted: noted.length,
    has3: notedLabels.some((l) => l?.includes("Class 3") && l?.includes(n3.slice(0, 16))),
    has5: notedLabels.some((l) => l?.includes("Class 5") && l?.includes(n5.slice(0, 16))),
    chipText: chip?.textContent?.trim() ?? "",
    chipDisabled: chip?.disabled ?? null,
    chipPressed: chip?.getAttribute("aria-pressed"),
  };
}, { n3: N3, n5: N5a });
must(gridInfo.cards === 8, `A1 gallery renders 8 cards (got ${gridInfo.cards})`);
must(gridInfo.noted === 2, `A2 exactly 2 noted badges (got ${gridInfo.noted})`);
must(gridInfo.has3 && gridInfo.has5, "A3 badge labels carry the FULL note text");
must(gridInfo.chipText === "Noted · 2", `A4 Noted chip counts 2 (${gridInfo.chipText})`);
must(gridInfo.chipDisabled === false && gridInfo.chipPressed === "false", "A5 chip enabled and unpressed");

await p.locator('[data-canvas-ui="noted-only"]').click();
await sleep(300);
const filtered = await probe(() => {
  const grid = document.querySelector('[data-canvas-ui="class-grid"]');
  const cards = [...(grid?.querySelectorAll("button[aria-pressed]") ?? [])];
  const vis = document.querySelector('[data-canvas-ui="class-visible-count"]');
  const cls = cards.map((c) => {
    const m = c.getAttribute("aria-label")?.match(/Toggle class (\d+)/);
    return m ? +m[1] : null;
  });
  return { n: cards.length, cls, vis: vis?.textContent?.trim() ?? "" };
});
must(filtered.n === 2 && filtered.cls.includes(3) && filtered.cls.includes(5), `A6 Noted-only narrows to classes 3+5 (got ${filtered.cls.join(",")})`);
must(filtered.vis.includes("2") && filtered.vis.includes("8"), `A7 visible-count chip reports the slice (${filtered.vis})`);
const pressedNow = await probe(() => document.querySelector('[data-canvas-ui="noted-only"]')?.getAttribute("aria-pressed"));
must(pressedNow === "true", "A8 chip pressed while the lens is on");
await p.locator('[data-canvas-ui="noted-only"]').click();
await sleep(250);
const backTo8 = await probe(() => document.querySelectorAll('[data-canvas-ui="class-grid"] button[aria-pressed]').length);
must(backTo8 === 8, `A9 lens off restores all 8 (got ${backTo8})`);

// corner policy: a noted card parks the note badge top-right and the zoom
// button slides to right-8; a clean card keeps zoom in the corner
const corners = await probe(() => {
  const zooms = [...document.querySelectorAll('[data-canvas-ui="class-zoom"]')];
  const byLabel = (cls) => zooms.find((z) => z.previousElementSibling === null || true)
    ? zooms.filter((z) => z.className.includes(`right-${cls}`)).length
    : 0;
  return { right8: byLabel("8"), right15: byLabel("1.5") };
});
must(corners.right8 === 2 && corners.right15 === 6, `A10 zoom yields the corner on noted cards (r8=${corners.right8}, r1.5=${corners.right15})`);

/* ---------------- Phase B: lightbox editor ---------------- */
console.log("Phase B — lightbox editor");
await p.locator('[data-canvas-ui="class-note"][data-noted="true"]').filter({ hasText: "" }).nth(1).click();
await p.waitForSelector('[data-canvas-ui="class-note-editor"]');
await sleep(300);
const lb1 = await probe(() => ({
  title: document.querySelector('[data-canvas-ui="lightbox-title"]')?.textContent?.trim(),
  focus: document.activeElement?.getAttribute("data-canvas-ui") ?? null,
  val: document.querySelector('[data-canvas-ui="class-note-editor"]')?.value ?? "",
}));
must(lb1.title === "Class 5", `B1 note button opens the lightbox on that class (${lb1.title})`);
must(lb1.focus === "class-note-editor", `B2 editor autofocuses (${lb1.focus})`);
must(lb1.val === N5a, "B3 editor loads the existing note");

await p.locator('[data-canvas-ui="class-note-editor"]').fill(N5b);
await sleep(200);
const chipAfterEdit = await probe(() => document.querySelector('[data-canvas-ui="noted-only"]')?.textContent?.trim());
must(chipAfterEdit === "Noted · 2", `B4 editing keeps the count (${chipAfterEdit})`);

// keyboard isolation: arrows move the caret, Enter makes a newline — the
// lightbox must NOT navigate classes while typing in the editor
await p.locator('[data-canvas-ui="class-note-editor"]').fill("line one");
await p.locator('[data-canvas-ui="class-note-editor"]').press("End");
await p.keyboard.press("ArrowLeft");
await p.keyboard.press("ArrowRight");
await p.keyboard.press("Enter");
await p.keyboard.insertText("line two");
const kb = await probe(() => ({
  val: document.querySelector('[data-canvas-ui="class-note-editor"]')?.value ?? "",
  title: document.querySelector('[data-canvas-ui="lightbox-title"]')?.textContent?.trim(),
  focus: document.activeElement?.getAttribute("data-canvas-ui") ?? null,
}));
must(kb.val === "line one\nline two", `B5 arrows/Enter type inside the editor (${JSON.stringify(kb.val)})`);
must(kb.title === "Class 5" && kb.focus === "class-note-editor", "B6 lightbox stayed on class 5, editor focused");

// restore the intended class-5 note, then Esc back to the gallery
await p.locator('[data-canvas-ui="class-note-editor"]').fill(N5b);
await p.keyboard.press("Escape");
await sleep(300);
const lbGone = await probe(() => ({
  lb: !!document.querySelector('[data-canvas-ui="class-note-editor"]'),
  grid: !!document.querySelector('[data-canvas-ui="class-grid"]'),
}));
must(!lbGone.lb && lbGone.grid, "B7 Esc closes the lightbox, gallery survives");

// debounced persistence to the API (700ms debounce + settle)
await sleep(1600);
const persisted = JSON.parse(
  (((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === sel.id)?.params?.classNotes) ?? "{}"
);
must(persisted["5"] === N5b && persisted["3"] === N3, "B8 debounced save landed in the API (param JSON)");

/* ---------------- Phase C: self-heal + dead-control honesty ---------------- */
console.log("Phase C — self-heal");
const openNoteEditor = async (cls) => {
  // noted cards carry a permanent amber badge; clean cards expose a hover
  // pen (opacity-0 but interactive) — force-click covers both
  await p.locator(`[data-canvas-ui="class-note"][aria-label*="${cls}"]`).first().click({ force: true });
  await p.waitForSelector('[data-canvas-ui="class-note-editor"]');
};
await p.locator('[data-canvas-ui="noted-only"]').click();
await sleep(250);
// clear note 3 while the lens is on — note 5 survives, so the lens stays
// legally narrow (grid = the remaining noted class, NOT revoked)
await openNoteEditor(3);
await p.locator('[data-canvas-ui="class-note-editor"]').fill("");
await p.keyboard.press("Escape");
await sleep(400);
const narrowed = await probe(() => document.querySelectorAll('[data-canvas-ui="class-grid"] button[aria-pressed]').length);
must(narrowed === 1, `C1 lens legally stays on while another note survives (grid ${narrowed})`);
// clear the LAST note → the lens must revoke itself instead of showing
// a dead empty grid
await openNoteEditor(5);
await p.locator('[data-canvas-ui="class-note-editor"]').fill("");
await p.keyboard.press("Escape");
await sleep(500);
const healed = await probe(() => {
  const chip = document.querySelector('[data-canvas-ui="noted-only"]');
  return {
    cards: document.querySelectorAll('[data-canvas-ui="class-grid"] button[aria-pressed]').length,
    pressed: chip?.getAttribute("aria-pressed"),
    disabled: chip?.disabled,
    text: chip?.textContent?.trim() ?? "",
  };
});
must(healed.cards === 8, `C2 lens revoked when its last note vanished (grid ${healed.cards})`);
must(healed.pressed === "false" && healed.disabled === true, "C3 chip disabled at zero notes (dead-control honesty)");
must(healed.text === "Noted", `C4 chip shows no count at zero (${healed.text})`);

/* ---------------- Phase D: persistence round-trip ---------------- */
console.log("Phase D — persistence round-trip");
// re-seed note 5 through the UI (the same path a scientist uses)
await openNoteEditor(5);
await p.locator('[data-canvas-ui="class-note-editor"]').fill(N5b);
await p.keyboard.press("Escape");
await sleep(1600); // debounce + settle
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);
must(await openPanel(), "D1 panel reopened after reload");
const rt = await probe(() => {
  const noted = [...document.querySelectorAll('[data-canvas-ui="class-note"][data-noted="true"]')];
  const chip = document.querySelector('[data-canvas-ui="noted-only"]');
  return { n: noted.length, label: noted[0]?.getAttribute("aria-label") ?? "", chip: chip?.textContent?.trim() ?? "" };
});
must(rt.n === 1, `D1b exactly 1 noted badge after reload (got ${rt.n})`);
must(rt.label.includes("Class 5") && rt.label.includes(N5b.slice(0, 20)), "D2 badge carries the updated note text");
must(rt.chip === "Noted · 1", `D3 chip matches (${rt.chip})`);
const apiFinal = JSON.parse(
  (((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === sel.id)?.params?.classNotes) ?? "{}"
);
must(apiFinal["5"] === N5b && apiFinal["3"] == null, "D4 API agrees with the paper (note 3 gone, note 5 updated)");

must(consoleErrors.length === 0, `E1 console clean (got ${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));

await b.close();
// cleanup: clear class notes (browser closed first — no stale-form writer)
await setNotes({});
const cleaned = JSON.parse(
  (((await api("/api/jobs")).json.jobs ?? []).find((j) => j.id === sel.id)?.params?.classNotes) ?? "{}"
);
must(Object.keys(cleaned).length === 0, "Z1 cleanup: classNotes emptied");

console.log(fail === 0 ? "QA80 ALL PASS" : `QA80 FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
