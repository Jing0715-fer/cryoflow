// qa83 — Class annotations reach the canvas, the working surface (Task 83).
// Task 80 put notes on classes (gallery editor), 81 made them retrievable
// (palette deep link), 82 aggregated them on the dashboard roster; 83 closes
// the loop on the canvas itself:
//   • a select2d job card grows the amber class-notes count pill (the
//     dashboard badge's canvas cousin — granularity twins with the icon-only
//     job-note badge),
//   • the n8n-style hover preview carries the remarks themselves (job note
//     block + up to two class notes + "+N more"),
//   • the paper card swaps Row 3 for a class-notes digest when the ONLY
//     annotation lives in classNotes (Task 74 swap mechanism, new tenant),
//   • the note-spotlight ecosystem (header chip count + canvas lens dim)
//     reads hasJudgment — the same unified predicate as the dashboard —
//     so a card annotated only through class notes is not dimmed while the
//     lens claims to spotlight noted work.
// Phases:
//   S  setup — zombie daemon killed, gallery seeded, baseline normalized,
//      3 class notes + 1 job note planted on disjoint rows, tripwire re-read
//   A  canvas badge — count/title/aria on the select2d card; no badge on
//      unannotated or note-only cards
//   B  hover preview — class-note lines + "+N more" + job-note block
//   C  spotlight lens — chip counts the union; N key dims only unannotated
//      cards; class-notes-only card stays lit; toggle-off restores
//   D  print contract — badge no-print; excerpt swap block/none per
//      granularity; single-page PDF; digest text on paper
//   E  console clean
//   Z  cleanup verified over the API
// Run: node scripts/qa83-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const SEL_JOB = "QA Class Select";
const N3 = "qa83 ice ring artifact at the edge";
const N5 = "qa83 secondary structure visible";
const N7 = "qa83 junk class, exclude";
const NOTE_TEXT = "qa83 step-level margin note";
const OUT = "/home/z/my-project/.qa-logs/t83-canvas.pdf";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// qa77 lesson, fifth printing: the payload MUST ride the PATCH init —
// a bare helper call silently downgrades to a GET.
const api = async (path, body) => {
  const res = await fetch(BASE + path, body
    ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

// qa81 lesson: a leftover agent-browser page with a ParamsTab open holds a
// stale form whose debounced save rewrites params ~1.7s after our PATCH.
try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- seed + baseline normalization ---------------- */
execSync("python3 scripts/qa58-seed-gallery.py", { encoding: "utf8", timeout: 120_000 });
const listJobs = async () => (await api("/api/jobs")).json.jobs ?? [];
let jobs0 = await listJobs();
const sel = jobs0.find((j) => j.name === SEL_JOB && j.type === "select2d");
must(sel != null, "S1 select2d gallery job seeded");
// normalize baseline (qa78 lesson: living-instance residue must never be a
// hidden input — the annotated slice is built from zero on purpose)
let cleared = 0;
for (const j of jobs0) {
  const hadNote = !!j.note;
  const hadCls = j.params?.classNotes && j.params.classNotes !== "{}" && j.params.classNotes !== "";
  if (hadNote || hadCls) {
    await api(`/api/jobs/${j.id}`, { note: "", params: { classNotes: "{}" } });
    cleared++;
  }
}
if (cleared > 0) await sleep(2500); // outlive any zombie debounce window
jobs0 = await listJobs();
const stray = jobs0.filter((j) => j.note || (j.params?.classNotes && j.params.classNotes !== "{}"));
must(stray.length === 0, `S2 baseline normalized — zero annotated jobs (cleared ${cleared})`);

// plant the two granularities on DISJOINT rows: THREE class notes on the
// select2d (exercises the "+N more" overflow in the preview and the
// 3-entry digest on paper), a plain job note elsewhere
await api(`/api/jobs/${sel.id}`, { params: { classNotes: JSON.stringify({ 3: N3, 5: N5, 7: N7 }) } });
const noteJob = jobs0.find((j) => j.name !== SEL_JOB && j.status === "completed");
must(noteJob != null, "S3 completed non-select2d host found for the job note");
await api(`/api/jobs/${noteJob.id}`, { note: NOTE_TEXT });
// tripwire: re-read AFTER the debounce window of any zombie writer (qa81 S3)
await sleep(2500);
const selNow = (await listJobs()).find((j) => j.id === sel.id);
const noteNow = (await listJobs()).find((j) => j.id === noteJob.id);
const verifyCls = JSON.parse(selNow?.params?.classNotes ?? "{}");
must(verifyCls["3"] === N3 && verifyCls["5"] === N5 && verifyCls["7"] === N7, "S4 classNotes survived the zombie window");
must(noteNow?.note === NOTE_TEXT, "S5 job note survived the zombie window");

/* ---------------- browser ---------------- */
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(800);

// canvas probes must NOT depend on Node closures (qa73 lesson, 7th printing)
const cardProbe = (jobId) => p.evaluate((id) => {
  const card = document.querySelector(`[data-job="${id}"]`);
  if (!card) return { present: false };
  const badge = card.querySelector("[data-card-classnotes-badge]");
  const noteBadge = card.querySelector("[data-note-badge]");
  const excerpt = card.querySelector("p.italic");
  const row3 = card.querySelector("div.print\\:hidden");
  return {
    present: true,
    dimmed: card.className.includes("note-spotlight-dim"),
    badgeCount: badge?.getAttribute("data-card-classnotes-count") ?? null,
    badgeTitle: badge?.getAttribute("title") ?? null,
    badgeAria: badge?.getAttribute("aria-label") ?? null,
    badgeDisplay: badge ? getComputedStyle(badge).display : null,
    noteBadgePresent: !!noteBadge,
    excerptText: excerpt?.textContent?.trim() ?? null,
    excerptDisplay: excerpt ? getComputedStyle(excerpt).display : null,
    row3Display: row3 ? getComputedStyle(row3).display : null,
  };
}, jobId);
const bringCard = async (jobId) => {
  const card = p.locator(`[data-job="${jobId}"]`).first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  return card.boundingBox();
};

/* ---------------- Phase A: canvas badge ---------------- */
console.log("Phase A — canvas badge");
let box = await bringCard(sel.id);
must(!!box, "A0 select2d card on canvas");
let cp = await cardProbe(sel.id);
must(cp.present && cp.badgeCount === "3", `A1 badge count == 3 (got ${cp.badgeCount})`);
must(cp.badgeTitle === "Class notes on Class 3, Class 5, Class 7", `A2 title lists the classes (got ${cp.badgeTitle})`);
must(cp.badgeAria === "3 classes noted", `A3 aria reads '3 classes noted' (got ${cp.badgeAria})`);
cp = await cardProbe(noteJob.id);
must(cp.present && cp.badgeCount === null && cp.noteBadgePresent, "A4 note-only card: job-note badge yes, class badge no");
// pick a bare card from the CANVAS DOM, not from jobs0 — the jobs list
// spans every workspace while the canvas renders one (qa77 lesson)
const canvasIds = await p.evaluate(() =>
  [...document.querySelectorAll("[data-job]")].map((el) => el.getAttribute("data-job"))
);
const bareId = canvasIds.find((id) => id !== sel.id && id !== noteJob.id);
const bareProbe = await cardProbe(bareId ?? "none");
must(bareProbe.present && bareProbe.badgeCount === null && !bareProbe.noteBadgePresent, "A5 unannotated card carries neither badge");
const badgeDisplays = await p.evaluate(() =>
  [...document.querySelectorAll("[data-card-classnotes-badge]")].map((el) => getComputedStyle(el).display)
);
must(badgeDisplays.length === 1 && badgeDisplays[0] === "flex", "A6 exactly one class badge on canvas, visible on screen");

/* ---------------- Phase B: hover preview annotations ---------------- */
console.log("Phase B — hover preview");
const titleLoc = p.locator(`[data-job="${sel.id}"] .job-card-title`).first();
await titleLoc.hover();
await p.waitForTimeout(900); // openDelay is 500ms
const previewRead = await p.evaluate((texts) => {
  const body = document.body.textContent ?? "";
  return texts.map((t) => body.includes(t));
}, [N3, N5, N7, "+1 more class note", "Class 3", "Class 7"]);
must(previewRead[0] && previewRead[1] && previewRead[2], "B1 preview shows class-note remarks 3/5/7");
must(previewRead[3], "B2 overflow honesty: '+1 more class note' shown");
must(previewRead[4] && previewRead[5], "B3 'Class N' anchors present in the preview");
await p.mouse.move(5, 5); // close the hover card before the next probe
await p.waitForTimeout(400);
box = await bringCard(noteJob.id);
await p.locator(`[data-job="${noteJob.id}"] .job-card-title`).first().hover();
await p.waitForTimeout(900);
const notePreview = await p.evaluate((t) => (document.body.textContent ?? "").includes(t), NOTE_TEXT);
must(notePreview, "B4 preview shows the job-note block on the note card");
await p.mouse.move(5, 5);
await p.waitForTimeout(400);

/* ---------------- Phase C: spotlight lens (hasJudgment) ---------------- */
console.log("Phase C — spotlight lens");
const chip = await p.evaluate(() => {
  const el = document.querySelector("[data-note-spotlight]");
  return el ? { count: el.getAttribute("data-note-spotlight-count"), disabled: el.disabled } : null;
});
must(chip != null && chip.count === "2" && !chip.disabled, `C1 header chip counts the union == 2 (got ${chip && chip.count})`);
await p.keyboard.press("n");
await p.waitForTimeout(600);
const lensSel = await cardProbe(sel.id);
const lensNote = await cardProbe(noteJob.id);
must(lensSel.present && !lensSel.dimmed, "C2 lens ON: class-notes-only card stays lit (hasJudgment, not job.note)");
must(lensNote.present && !lensNote.dimmed, "C3 lens ON: job-note card stays lit");
const dimmedIds = await p.evaluate(() =>
  [...document.querySelectorAll("[data-job].note-spotlight-dim")].map((el) => el.getAttribute("data-job"))
);
must(dimmedIds.length >= 1 && !dimmedIds.includes(sel.id) && !dimmedIds.includes(noteJob.id),
  `C4 lens ON: ${dimmedIds.length} unannotated card(s) dim; both annotated cards absent from the set`);
await p.keyboard.press("n");
await p.waitForTimeout(600);
const dimmedOff = await p.evaluate(() => document.querySelectorAll("[data-job].note-spotlight-dim").length);
must(dimmedOff === 0, "C5 lens OFF: no card dimmed");

/* ---------------- Phase D: print contract ---------------- */
console.log("Phase D — print contract");
// Task 79 lesson: media emulation is persistent state — emulate print
// explicitly and never rely on the phase before this one.
await p.emulateMedia({ media: "print" });
await p.waitForTimeout(500);
cp = await cardProbe(sel.id);
must(cp.badgeDisplay === "none", "D1 class-notes badge is no-print (management cue, not paper)");
must(cp.excerptDisplay === "block" && cp.excerptText === `Notes on Class 3, 5, 7 — Class 3: ${N3} — Class 5: ${N5} — Class 7: ${N7}`,
  `D2 index-first digest swaps onto the paper card (got display ${cp.excerptDisplay})`);
must(cp.row3Display === "none", "D3 Row 3 (progress/ETA) hidden on the annotated paper card");
const np = await cardProbe(noteJob.id);
must(np.excerptDisplay === "block" && np.excerptText === NOTE_TEXT, "D4 job-note excerpt unchanged on the note card");
must(np.row3Display === "none", "D5 Row 3 hidden on the note card too (same swap)");
rmSync(OUT, { force: true });
await p.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true });
const raw = readFileSync(OUT).toString("latin1");
const counts = [...raw.matchAll(/\/Count (\d+)/g)].map((m) => +m[1]);
const pages = Math.max(...counts, 0);
must(pages === 1, `D6 canvas PDF still exactly one page (got ${pages})`);
const paper = execSync(`pdftotext ${OUT} -`, { encoding: "utf8" }).replace(/\s+/g, "");
must(paper.includes("NotesonClass3,5,7"), "D7 class index survives the clip and lands on paper");
must(paper.includes("Class3:"), "D8 first entry teaser started on paper");
must(!paper.includes("junkclass"), "D9 tail entries clip at the card edge by design (… marks continuation)");
must(paper.includes(NOTE_TEXT.replace(/\s+/g, "")), "D10 job note still on paper");
await p.emulateMedia({ media: "screen" });
await b.close();

/* ---------------- Phase E: console ---------------- */
console.log("Phase E — console");
must(consoleErrors.length === 0, `E1 console clean (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0].slice(0, 120) : ""})`);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
await api(`/api/jobs/${sel.id}`, { params: { classNotes: "{}" } });
await api(`/api/jobs/${noteJob.id}`, { note: "" });
await sleep(2500);
const selZ = (await listJobs()).find((j) => j.id === sel.id);
const noteZ = (await listJobs()).find((j) => j.id === noteJob.id);
const clsZ = selZ?.params?.classNotes;
must(clsZ === "{}" || clsZ === "" || clsZ == null || clsZ === "{}", "Z1 classNotes emptied");
must(!noteZ?.note, "Z2 job note cleared");

console.log(fail === 0 ? "QA83 ALL PASS" : `QA83 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
