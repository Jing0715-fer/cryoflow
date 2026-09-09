// qa75 — Note spotlight (the lens) e2e.
// Task 75 turns Task 73's annotations into a navigation layer: the lens
// dims cards WITHOUT a note so the scientist's judgments jump out, the
// palette gains a Notes group whose SEARCH PAYLOAD is the note text, and
// the header gains a count chip. Three phases:
//   A  lens mechanics — chip count/aria-pressed/disabled-at-zero, dimmed
//      card computed opacity, N-key toggle, reload reset (in-memory)
//   B  palette — Notes group heading + rows, note-TEXT search filter,
//      Enter jumps to the job (inspector), spotlight item flips the lens
//   C  print contract — the lens is a SCREEN aid: under print emulation
//      every card renders at opacity 1 (even while dimmed on screen) and
//      the paper still carries ALL names, dimmed or not
// Run: node scripts/qa75-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t75-print.pdf";
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
// two noted jobs + one clean dim-target — ALL from the same workspace as
// notedA: the lens dims the ACTIVE workspace's canvas and the chip counts
// the active workspace only, so cross-workspace targets would flake
const notedA = list.find((j) => j.status === "completed") ?? list[0];
const inWs = list.filter((j) => (j.workspaceId ?? "") === (notedA.workspaceId ?? ""));
must(inWs.length >= 3, `notedA workspace has ${inWs.length} jobs`);
const notedB = inWs.find((j) => j.id !== notedA.id);
const dimTarget = inWs.find((j) => j.id !== notedA.id && j.id !== notedB.id);
console.log(`notedA: ${notedA.name} | notedB: ${notedB.name} | dimTarget: ${dimTarget.name}`);
await api(`/api/jobs/${notedA.id}`, { note: "" });
await api(`/api/jobs/${notedB.id}`, { note: "" });
await api(`/api/jobs/${notedA.id}`, { note: "GOLDENMARKER1 picked for refine3d" });
await api(`/api/jobs/${notedB.id}`, { note: "ABINITIOMARKER2 redo budget spent" });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

const jobSel = (id) => `[data-job="${id}"]`;
const CHIP = '[data-note-spotlight]';
// computed style of a card root — sel composed Node-side, passed as arg
// (playwright evaluate does NOT carry Node closures — qa73 lesson)
const styleOf = async (sel) =>
  p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, dim: el.classList.contains("note-spotlight-dim") };
  }, sel);

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForSelector(jobSel(notedA.id));
await sleep(600);

/* ---------------- Phase A: lens mechanics ---------------- */
console.log("Phase A — lens mechanics");
{
  const chip = p.locator(CHIP);
  must(await chip.count() === 1, "A1 header chip present");
  must((await chip.getAttribute("data-note-spotlight-count")) === "2", "A2 chip counts 2 noted jobs");
  must((await chip.getAttribute("aria-pressed")) === "false", "A3 lens starts off");
  must(await chip.isEnabled(), "A4 chip enabled with noted jobs present");

  await chip.click();
  await sleep(350); // 200ms transition
  const dim = await styleOf(jobSel(dimTarget.id));
  const lit = await styleOf(jobSel(notedA.id));
  must(dim?.dim === true, "A5 dim-target carries the spotlight class");
  must(dim?.opacity === "0.28", `A6 dim-target opacity 0.28 (got ${dim?.opacity})`);
  must(lit?.dim === false && lit?.opacity === "1", "A7 noted card stays at full strength");

  // N key toggles the lens both ways (canvas focus, no input involved)
  await p.keyboard.press("n");
  await sleep(350);
  must((await chip.getAttribute("aria-pressed")) === "false", "A8 N key turns the lens off");
  must((await styleOf(jobSel(dimTarget.id))).opacity === "1", "A9 undimmed after N");
  await p.keyboard.press("n");
  await sleep(350);
  must((await chip.getAttribute("aria-pressed")) === "true", "A10 N key turns the lens back on");

  // the lens is a viewing aid, not a document property — reload resets it
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector(jobSel(notedA.id));
  await sleep(600);
  must((await p.locator(CHIP).getAttribute("aria-pressed")) === "false", "A11 reload resets the lens (in-memory)");
}

/* ---------------- Phase B: palette Notes group ---------------- */
console.log("Phase B — palette: Notes group + text search + jump");
{
  await p.keyboard.press("Control+k");
  await p.waitForSelector('[role="dialog"] [cmdk-input]', { timeout: 5000 });
  await sleep(300);
  const dlg = p.locator('[role="dialog"]');
  const heading = await dlg.getByText(/Notes · 2 annotated jobs/).count();
  must(heading >= 1, "B1 Notes group heading with count");
  const txt = await dlg.textContent();
  must(txt.includes("GOLDENMARKER1") && txt.includes("ABINITIOMARKER2"), "B2 both note texts listed as rows");

  // the note TEXT is the searchable payload — a phrase from notedB's note
  // must keep notedB's row and drop notedA's
  await p.locator('[cmdk-input]').fill("ABINITIOMARKER2");
  await sleep(300);
  const filtered = await dlg.textContent();
  must(filtered.includes(notedB.name) && !filtered.includes("GOLDENMARKER1"),
    "B3 note-text search narrows to the matching note");

  await p.locator('[cmdk-input]').fill("zzqqnothingmatches");
  await sleep(300);
  must(await dlg.getByText(/No results/).count() === 1, "B4 gibberish query shows empty state");

  // spotlight item lives in Canvas & app and flips the lens from the palette
  await p.locator('[cmdk-input]').fill("spotlight noted");
  await sleep(300);
  await p.keyboard.press("Enter");
  await sleep(500);
  must(await p.locator('[role="dialog"]').count() === 0, "B5 palette closes after selection");
  must((await p.locator(CHIP).getAttribute("aria-pressed")) === "true", "B6 palette item turned the lens on");
  must((await styleOf(jobSel(dimTarget.id))).opacity === "0.28", "B7 canvas dimmed again via palette path");

  // Enter on a noted row jumps: completed job → results inspector
  await p.keyboard.press("Control+k");
  await p.waitForSelector('[role="dialog"] [cmdk-input]', { timeout: 5000 });
  await p.locator('[cmdk-input]').fill("GOLDENMARKER1");
  await sleep(300);
  await p.keyboard.press("Enter");
  await sleep(700);
  must(await p.locator('[role="dialog"]').count() === 1, "B8 noted row opens the inspector");
  const inspTxt = await p.locator('[role="dialog"]').textContent();
  must(inspTxt.includes(notedA.name), "B9 inspector shows the noted job");
  await p.keyboard.press("Escape");
  await sleep(400);
  must(await p.locator('[role="dialog"]').count() === 0, "B10 Esc closes the inspector");

  // leave the lens ON for the print phase; park state deterministically
  must((await p.locator(CHIP).getAttribute("aria-pressed")) === "true", "B11 lens still on after the jump");
}

/* ---------------- Phase C: print contract ---------------- */
console.log("Phase C — print: the lens never dims the paper");
{
  // while the lens dims dimTarget on screen, print emulation must show
  // FULL opacity on every card — the globals.css print override wins
  await p.emulateMedia({ media: "print" });
  await sleep(200);
  const dimPrint = await styleOf(jobSel(dimTarget.id));
  const litPrint = await styleOf(jobSel(notedA.id));
  must(dimPrint?.dim === true, "C1 class persists in print tree (override, not class removal)");
  must(dimPrint?.opacity === "1", `C2 dimmed card prints at opacity 1 (got ${dimPrint?.opacity})`);
  must(litPrint?.opacity === "1", "C3 noted card prints at opacity 1");

  await p.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true });
  await p.emulateMedia({ media: "screen" });
  const strip = (s) => s.replace(/\s+/g, "").toLowerCase();
  const txt = strip(execSync(`pdftotext ${OUT} -`, { encoding: "utf8" }));
  must(txt.includes(dimTarget.name.toLowerCase().replace(/\s+/g, "")), "C4 dimmed job's name on paper");
  must(txt.includes(notedA.name.toLowerCase().replace(/\s+/g, "")), "C5 noted job's name on paper");
  must(txt.includes("goldenmarker1"), "C6 note excerpt still on paper (Task 74 contract intact)");
}

/* ---------------- cleanup: zero-state + console ---------------- */
console.log("Cleanup — notes cleared → chip disabled at zero");
{
  await api(`/api/jobs/${notedA.id}`, { note: "" });
  await api(`/api/jobs/${notedB.id}`, { note: "" });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector(CHIP);
  await sleep(600);
  const chip = p.locator(CHIP);
  must((await chip.getAttribute("data-note-spotlight-count")) === "0", "S1 count back to 0");
  must(await chip.isDisabled(), "S2 chip disabled at zero (honest dead lens)");
  must((await chip.getAttribute("aria-pressed")) === "false", "S3 lens off after reload");

  must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);
}

await b.close();
console.log(fail === 0 ? "\nqa75: ALL PASS" : `\nqa75: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
