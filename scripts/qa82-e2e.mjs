// qa82 — Class notes aggregated on the dashboard roster (Task 82).
// Task 80 put notes on classes (gallery editor), Task 81 made them
// retrievable (palette + deep link); Task 82 closes the aggregation loop on
// the dashboard: a select2d job whose classes carry margin notes grows an
// amber count pill on its roster row, and the Noted property filter + the
// dashboard 5-key now read BOTH annotation granularities (job note OR class
// notes) through one hasJudgment predicate.
// Phases:
//   S  setup — zombie daemon killed, gallery seeded, classNotes + a job
//      note planted on disjoint rows, zombie-window tripwire re-read
//   A  badge — count pill renders with count/title/aria; exactly the
//      annotated rows carry one; Noted chip counts the union
//   B  filter — Noted slice == both annotated rows exactly; key 5 toggles
//      both ways; live truth: partial/full note clears move the counts
//   C  paper — the badge is no-print (management summary doctrine)
//   D  resilience — malformed JSON + empty-value maps degrade to "no
//      notes" without breaking the roster (parseClassNotes contract)
//   E  dead key honesty — zero annotations: chip hidden, key 5 a no-op
//   F  console clean
//   Z  cleanup verified over the API
// Run: node scripts/qa82-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const BASE = "http://localhost:3000";
const SEL_JOB = "QA Class Select";
const N3 = "qa82 marker three — secondary structure visible";
const N5 = "ice contamination at the frost edge";
const NOTE_TEXT = "qa82 step-level margin note";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// qa77 lesson, fourth printing: the payload MUST ride the body field —
// a top-level arg silently downgrades the call to a GET.
const api = async (path, body) => {
  const res = await fetch(BASE + path, body
    ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

// qa81 lesson: a leftover agent-browser page with a ParamsTab open holds a
// stale form and its debounced save rewrites params ~1.7s after our PATCH.
try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- seed + baseline normalization ---------------- */
execSync("python3 scripts/qa58-seed-gallery.py", { encoding: "utf8", timeout: 120_000 });
const listJobs = async () => (await api("/api/jobs")).json.jobs ?? [];
let jobs0 = await listJobs();
const sel = jobs0.find((j) => j.name === SEL_JOB && j.type === "select2d");
must(sel != null, "S1 select2d gallery job seeded");
// normalize baseline: every stray note / classNotes from earlier suites
// would shift the Noted union counts — clear them all first (qa78 lesson:
// the Noted and class-noted slices must be built disjoint ON PURPOSE)
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

// plant the two annotation granularities on DISJOINT rows
await api(`/api/jobs/${sel.id}`, { params: { classNotes: JSON.stringify({ 3: N3, 5: N5 }) } });
const noteJob = jobs0.find((j) => j.name !== SEL_JOB && j.status === "completed");
must(noteJob != null, "S3 completed non-select2d host found for the job note");
await api(`/api/jobs/${noteJob.id}`, { note: NOTE_TEXT });
// tripwire: re-read AFTER the debounce window of any zombie writer
await sleep(2500);
const selNow = (await listJobs()).find((j) => j.id === sel.id);
const noteNow = (await listJobs()).find((j) => j.id === noteJob.id);
const verifyCls = JSON.parse(selNow?.params?.classNotes ?? "{}");
must(verifyCls["3"] === N3 && verifyCls["5"] === N5, "S4 classNotes survived the zombie window");
must(noteNow?.note === NOTE_TEXT, "S5 job note survived the zombie window");

/* ---------------- browser ---------------- */
// t622 memory-institution armor (3 consecutive kernel OOM kills, all
// clustered at the E-phase reload — the 5th/6th full dashboard load of one
// context): chromium's footprint grows monotonically across navigations,
// and on the 4GB/no-swap box next to a ~2.3GB next-server the late reloads
// cross the line. Keep the heap small and the tmp backing honest.
let b = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--js-flags=--max-old-space-size=256", "--disable-gpu"],
});
let p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));
// t627 forensic camera: the E-phase reload has died 4x running ("Target
// ... closed" with an empty log and NO kernel OOM in dmesg) — catch the
// death itself and print WHO died and WHERE the page was.
p.on("crash", () => console.log(`  [forensic] PAGE CRASHED at ${p.url()}`));
b.on("disconnected", () => console.log("  [forensic] BROWSER DISCONNECTED"));

// t627 — the userspace reaper's ~90-100s chromium lifetime signature (four
// consecutive deaths, position-in-suite agnostic: slow runs died in D,
// fast runs died in E — always ~100s after THIS browser's launch, never a
// kernel OOM). The suite's honest counter: SEGMENTED BROWSERS — a fresh
// browser per late phase keeps every browser's life inside the line.
const relaunch = async () => {
  try { await p.close(); } catch { /* already gone */ }
  try { await b.close(); } catch { /* already gone */ }
  b = await chromium.launch({
    args: ["--disable-dev-shm-usage", "--js-flags=--max-old-space-size=256", "--disable-gpu"],
  });
  p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  p.on("pageerror", (e) => consoleErrors.push(String(e)));
  p.on("crash", () => console.log(`  [forensic] PAGE CRASHED at ${p.url()}`));
  b.on("disconnected", () => console.log("  [forensic] BROWSER DISCONNECTED"));
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-canvas="viewport"]');
  await p.waitForTimeout(1200);
};
process.on("uncaughtException", (e) => {
  console.log(`  [forensic] uncaught: ${e.message} | page url: ${p?.url?.() ?? "?"} | closed: ${p?.isClosed?.() ?? "?"}`);
});

// t523 law (re-learned tonight the hard way): networkidle is a PSEUDO-wait
// on an app that polls /api/jobs — a 1.2s poll cadence only sometimes leaves
// the 500ms silence networkidle demands, so the wait is a timing lottery
// (both of tonight's runs lost it in Phase D). domcontentloaded + explicit
// waits is the honest arrival.
await p.goto(BASE, { waitUntil: "domcontentloaded" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(1200);
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
const ensureView = async (target) => {
  for (let i = 0; i < 4; i++) {
    if ((await curView()) === target) return true;
    await p.keyboard.press("Shift+D");
    await sleep(700);
  }
  return (await curView()) === target;
};
// qa76 lesson: the view is in-memory state — after every reload we must
// ARRIVE at the dashboard again before asserting anything about it
// t523 law: networkidle is a PSEUDO-wait on an app that polls /api/jobs —
// a 1.2s poll cadence only sometimes leaves the 500ms silence networkidle
// demands, so the wait is a timing lottery. domcontentloaded + the existing
// waitForTimeout is the honest arrival (same patch as qa82 tonight).
const reloadToDashboard = async () => {
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(400);
  must(await ensureView("dashboard"), "  (nav) dashboard view reached after reload");
  // t523 law, second half (tonight's second autopsy): arrival is not data —
  // the old networkidle was doing DOUBLE duty (arrival AND settling the
  // post-reload /api/jobs fetch); removing it exposed D1 reading a 0-row
  // roster. Wait for the ROSTER to render, never for the network.
  await p.waitForFunction(
    () => document.querySelectorAll("[data-roster-row]").length > 0,
    undefined,
    { timeout: 15_000 },
  );
  await p.waitForTimeout(300);
};
// qa73 lesson (6th printing): playwright evaluate carries NO Node closures —
// every identifier the browser side needs must ride in as an argument
const rosterProbe = (selName) => p.evaluate((SEL_JOB) => {
  const spot = 'section[aria-label="Active project spotlight"]';
  const box = document.querySelector(`${spot} .max-h-80`);
  // Task 84: rows live inside the roster table — anchor on data-roster-row
  const rows = [...(box?.querySelectorAll("[data-roster-row]") ?? [])];
  const rowFor = (name) => rows.find((r) => r.textContent?.includes(name)) ?? null;
  const badges = [...box?.querySelectorAll("[data-row-classnotes-badge]") ?? []];
  const selBadgeEl = rowFor(SEL_JOB)?.querySelector("[data-row-classnotes-badge]") ?? null;
  return {
    total: rows.length,
    selBadgePresent: !!selBadgeEl,
    selBadgeCount: selBadgeEl?.getAttribute("data-row-classnotes-count") ?? null,
    selBadgeTitle: selBadgeEl?.getAttribute("title") ?? null,
    selBadgeAria: selBadgeEl?.getAttribute("aria-label") ?? null,
    selNoteBadge: !!rowFor(SEL_JOB)?.querySelector("[data-row-note-badge]"),
    badgeTotal: badges.length,
    // the chip's textContent glues the count and the kbd digit together
    // ("Noted 2" + kbd "5" → "Noted 25") — read the count span alone for
    // an honest numeric assertion (qa79 B2 lesson: anchor the role)
    notedCount: document.querySelector('[data-filter="noted"] span.tabular-nums')?.textContent?.trim() ?? null,
    notedChip: [...document.querySelectorAll('[data-filter="noted"]')].map((c) => c.textContent?.trim() ?? ""),
    notedChipPresent: !!document.querySelector('[data-filter="noted"]'),
    notedChipPressed: document.querySelector('[data-filter="noted"]')?.getAttribute("aria-pressed") ?? null,
    emptyText: box?.querySelector("p")?.textContent?.trim() ?? null,
  };
}, selName);

/* ---------------- Phase A: badge ---------------- */
console.log("Phase A — badge");
await reloadToDashboard();
let rp = await rosterProbe(SEL_JOB);
must(rp.selBadgePresent, `A1 class-notes badge on the ${SEL_JOB} row`);
must(rp.selBadgeCount === "2", `A2 badge count == 2 (got ${rp.selBadgeCount})`);
must(rp.selBadgeTitle === "Class notes on Class 3, Class 5", `A3 title lists the classes (got ${rp.selBadgeTitle})`);
must(rp.selBadgeAria === "2 classes noted", `A4 aria-label reads '2 classes noted' (got ${rp.selBadgeAria})`);
must(rp.badgeTotal === 1, `A5 exactly one class-notes badge in the roster (got ${rp.badgeTotal})`);
const noteRowHasBadge = await p.evaluate((name) => {
  const rows = [...document.querySelectorAll('section[aria-label="Active project spotlight"] [data-roster-row]')];
  const row = rows.find((r) => r.textContent?.includes(name));
  return !!row?.querySelector("[data-row-note-badge]");
}, noteJob.name);
must(noteRowHasBadge, "A6 job-note badge intact on the note job row (granularity twins coexist)");
must(rp.notedChip.length === 1 && rp.notedCount === "2", `A7 Noted chip counts the union == 2 (got count ${rp.notedCount})`);

/* ---------------- Phase B: filter ---------------- */
console.log("Phase B — filter");
await p.locator('[data-filter="noted"]').click();
await sleep(350);
rp = await rosterProbe(SEL_JOB);
const notedNames = await p.evaluate(() =>
  [...document.querySelectorAll('section[aria-label="Active project spotlight"] [data-roster-row]')]
    .map((r) => r.querySelector("button")?.textContent ?? "")
);
must(rp.total === 2, `B1 Noted slice shows exactly 2 rows (got ${rp.total})`);
must(notedNames.some((t) => t.includes(SEL_JOB)) && notedNames.some((t) => t.includes(noteJob.name)), "B2 both granularities present in the slice");
must(rp.notedChipPressed === "true", "B3 chip aria-pressed while slice active");
await p.keyboard.press("5");
await sleep(350);
rp = await rosterProbe(SEL_JOB);
must(rp.total > 2 && rp.notedChipPressed === "false", `B4 key 5 toggles back to all (rows ${rp.total})`);
await p.keyboard.press("5");
await sleep(350);
rp = await rosterProbe(SEL_JOB);
must(rp.total === 2, "B5 key 5 re-enters the Noted slice");
await p.keyboard.press("5");
await sleep(350);

// live truth: clear ONE class note — the API contract mirrors the gallery
// editor (Task 80): a PATCH replaces the WHOLE map (per-class edit =
// rebuild the full map + PATCH), empty strings prune on read
await api(`/api/jobs/${sel.id}`, { params: { classNotes: JSON.stringify({ 3: "", 5: N5 }) } });
await sleep(2000);
await reloadToDashboard();
rp = await rosterProbe(SEL_JOB);
must(rp.selBadgeCount === "1", `B6 empty-value prune: badge count 1 (got ${rp.selBadgeCount})`);
must(rp.badgeTotal === 1 && rp.notedCount === "2", `B7 union still 2 (job note + remaining class note, got ${rp.notedCount})`);
// clear the rest — the row leaves the union entirely
await api(`/api/jobs/${sel.id}`, { params: { classNotes: "{}" } });
await sleep(2000);
await reloadToDashboard();
rp = await rosterProbe(SEL_JOB);
must(rp.selBadgePresent === false, "B8 badge gone after the last class note cleared");
must(rp.notedCount === "1", `B9 union back to 1 (job note only, got ${rp.notedCount})`);

/* ---------------- Phase C: paper ---------------- */
console.log("Phase C — paper");
// re-plant so the badge exists for the print check
await api(`/api/jobs/${sel.id}`, { params: { classNotes: JSON.stringify({ 7: "paper probe — brittle particles" }) } });
await sleep(2000);
await reloadToDashboard();
rp = await rosterProbe(SEL_JOB);
must(rp.selBadgePresent, "C0 badge re-planted for the paper check");
await p.emulateMedia({ media: "print" });
await sleep(250);
const paper = await p.evaluate(() => {
  const el = document.querySelector("[data-row-classnotes-badge]");
  return { present: !!el, hidden: el ? getComputedStyle(el).display === "none" : false };
});
await p.emulateMedia({ media: "screen" });
await sleep(250);
must(paper.present && paper.hidden, "C1 class-notes badge is no-print (management summary doctrine)");

/* ---------------- Phase D: resilience ---------------- */
console.log("Phase D — resilience");
await relaunch(); // fresh browser — the old one is ~60s old and the reaper's line is ~100s
// corrupted param must degrade to "no notes", never break the roster
await api(`/api/jobs/${sel.id}`, { params: { classNotes: "not-json{{" } });
await sleep(2000);
await reloadToDashboard();
rp = await rosterProbe(SEL_JOB);
must(rp.selBadgePresent === false && rp.total > 2, `D1 malformed classNotes → no badge, roster alive (${rp.total} rows)`);
await api(`/api/jobs/${sel.id}`, { params: { classNotes: '{"2":"   "}' } });
await sleep(2000);
await reloadToDashboard();
rp = await rosterProbe(SEL_JOB);
must(rp.selBadgePresent === false, "D2 whitespace-only note prunes to nothing");
await api(`/api/jobs/${sel.id}`, { params: { classNotes: JSON.stringify({ 7: "resilience probe" }) } });
await sleep(2000);
await reloadToDashboard();
rp = await rosterProbe(SEL_JOB);
must(rp.selBadgeCount === "1", "D3 valid note re-appears after the corruption probes");

/* ---------------- Phase E: dead key honesty ---------------- */
console.log("Phase E — dead key honesty");
await relaunch(); // fresh browser again — E's reloads were the 4x death site
await api(`/api/jobs/${sel.id}`, { params: { classNotes: "{}" } });
await api(`/api/jobs/${noteJob.id}`, { note: "" });
await sleep(2500);
const unionZero = (await listJobs()).filter((j) => j.note || (j.params?.classNotes && j.params.classNotes !== "{}"));
must(unionZero.length === 0, "E1 zero annotated jobs over the API");
await reloadToDashboard();
rp = await rosterProbe(SEL_JOB);
must(!rp.notedChipPresent, "E2 Noted chip hidden at zero");
await p.keyboard.press("5");
await sleep(350);
rp = await rosterProbe(SEL_JOB);
must(!rp.notedChipPresent && rp.total > 2, "E3 key 5 is an honest no-op at zero (no phantom slice)");
must(rp.emptyText == null || !rp.emptyText.includes("noted"), "E4 no 'noted' empty state ever rendered");

/* ---------------- Phase F/Z ---------------- */
console.log("Phase F/Z — console + cleanup");
must(consoleErrors.length === 0, `F1 console clean (got ${consoleErrors.length}${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 120)}` : ""})`);
const selAfter = (await listJobs()).find((j) => j.id === sel.id);
const noteAfter = (await listJobs()).find((j) => j.id === noteJob.id);
must(JSON.parse(selAfter?.params?.classNotes ?? "{}") && Object.keys(JSON.parse(selAfter?.params?.classNotes ?? "{}")).length === 0, "Z1 classNotes emptied");
must(!noteAfter?.note, "Z2 job note cleared");

// Z3 — the seeds go home (t628). The seeder's own --clean protocol keeps
// jobs/edges by design ("harmless" — qa58 docblock), but t628's audit
// convicted that premise: the jobs POST route assigns EVERY create to the
// ACTIVE project (the request's projectId is ignored — bare GET too), so
// qa_lib's resolve_project landing choice is a silent fiction and the
// QA Class2D/Select pair lands in whatever world is canonical that night
// (tonight: EMPIAR at 14 jobs — the t613 wave arithmetic lives at 12).
// This suite's seeds must not outlive it: delete through the product door
// (edges cascade via Prisma; the linked-copies guard is respected — the
// pair carries none). Idempotent: a crashed earlier run's seeds are
// re-found by this run's S1, used, and taken home here.
const seedNames = ["QA Class2D Source", "QA Class Select"];
// order matters: the seeder's --clean RE-RUNS the seed flow first (it needs
// the job ids), so it must come BEFORE the deletions — cleaning after would
// resurrect the pair it just buried.
try {
  execSync("python3 scripts/qa58-seed-gallery.py --clean", { encoding: "utf8", timeout: 120_000, stdio: "pipe" });
  console.log("  (z) seeder --clean ran (workdir files + engine-state radius)");
} catch (e) {
  console.log(`  (z) seeder --clean failed (continuing — radius is best-effort): ${String(e.message).slice(0, 100)}`);
}
let removed = 0;
for (const name of seedNames) {
  const stray = (await listJobs()).find((j) => j.name === name);
  if (stray) {
    const del = await fetch(`${BASE}/api/jobs/${stray.id}`, { method: "DELETE" });
    must(del.ok, `Z3 seed "${name}" deleted through the product door`);
    removed++;
  } else {
    removed++; // already gone — idempotent re-run counts it as done
  }
}
must(removed === seedNames.length, "Z4 world carries no qa82 seeds after cleanup");

await b.close();
console.log(fail === 0 ? "QA82 ALL PASS" : `QA82 FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
