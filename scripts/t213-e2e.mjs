/* t213 e2e — the roster's rows are doors. t212 put every volume owner's
 * NAME on the paper (the Session map inventory), but a name on a roster
 * you cannot press is still a dead end — t210 taught the strip that a
 * covered door is a lying door, and t213 carries that lesson onto the
 * report: each inventory BODY ROW now opens its owner's results through
 * openJob (the command palette's own engine: landing repair, workspace
 * hops, then the inspector for a completed job). The doors live ONLY on
 * the screen — the exported bytes stay plain Markdown (a door needs a
 * page to open) — keyed on the ONE table whose rendered head is exactly
 * [Job, Main map, Volumes]; thead neutralizes the context (a head row is
 * a label, not a door); every other table keeps its plain rows. A door
 * that needs a mouse is half a door: the rows are keyboard-pressable
 * (Enter/Space). The paper itself teaches the affordance (t210's legend
 * lesson).
 *   S  setup — the naked world (seeders are idempotent file-writers, NO
 *      updatedAt bumps): the four-volume capable host AND the tail-tier
 *      second owner, so a door press on the TAIL-TIER row is the tier
 *      doctrine made travelable
 *   W  wire — the walk spoken independently through the API returns both
 *      owners in walk order (the doors' promises must equal the wire)
 *   X  source oracles — the context, the head trio, the thead
 *      neutralization, the honest fallback, openJob as the engine, the
 *      dialog closing, the keyboard handler, the probe hook, the paper's
 *      teaching clause
 *   D  live — two rendered doors in walk order, aria-labels == the
 *      paper's words, press the TAIL-TIER door -> inspector on the
 *      tail-tier job, press the host door -> inspector on the host,
 *      the keyboard door, head/Comparison rows stay plain, the exported
 *      bytes keep their t212 pins and gain the teaching clause
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t213";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const LIB = readFileSync("src/lib/qc-report.ts", "utf8");
const DLG = readFileSync("src/components/workflow/session-report-dialog.tsx", "utf8");
const H = { "sec-fetch-site": "same-origin" };

const jobs = async () => {
  const d = await (await fetch(BASE + "/api/jobs", { headers: H })).json();
  return d.jobs ?? d;
};
const outputs = async (id) =>
  (await (await fetch(`${BASE}/api/jobs/${id}/outputs`, { headers: H })).json());
const isVolume = (f) => f.kind === "mrc" && Array.isArray(f.dims) && f.dims.length === 3;
const VOLUME_CAPABLE = /refine3d|class3d|postprocess|multibody/i;
const MAIN_MAP_RE = /half0|postprocess\.mrc$/i;

/* ============ S: setup — the naked world, two owners ============ */
section("S: the world, with two speaking jobs (naked — no bumps)");
execSync("python3 scripts/qa67-seed-volume.py", { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
execSync('QA_VOL_HOST="QA Class2D Source" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const rosterS = await jobs();
const host = rosterS.find((j) => j.name === "QA Refine3D");
const second = rosterS.find((j) => j.name === "QA Class2D Source");
must(!!host && !!second, "S1 both owners in roster (Refine3D the capable host, Class2D Source the tail-tier second)");
const outsH = await outputs(host.id);
const outsS = await outputs(second.id);
must((outsH.files ?? []).filter(isVolume).length === 4, "S2 the host owns FOUR volumes (orthovol + both halves + masked)");
must((outsS.files ?? []).filter(isVolume).length === 1, "S3 the second owner speaks exactly one volume (orthovol)");
must(!VOLUME_CAPABLE.test(second.type), `S4 the second owner's type (${second.type}) sits in the NEVER-VOLUME tier — pressing ITS row is the tier doctrine made travelable`);

/* ============ W: the wire feeds the doors ============ */
section("W: the walk, spoken independently — the doors' promises");
async function expectedOwners() {
  const done = (await jobs()).filter((j) => j.status === "completed");
  const rec = (a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;
  const queue = [
    ...done.filter((j) => VOLUME_CAPABLE.test(j.type)).sort(rec),
    ...done.filter((j) => !VOLUME_CAPABLE.test(j.type)).sort(rec),
  ].slice(0, 24);
  const owners = [];
  for (const j of queue) {
    const d = await outputs(j.id);
    const vols = (d.files ?? []).filter(isVolume);
    if (vols.length === 0) continue;
    const sorted = [...vols].sort(
      (a, b) => Number(MAIN_MAP_RE.test(b.name)) - Number(MAIN_MAP_RE.test(a.name)),
    );
    owners.push({
      job: j,
      mainName: sorted[0].label ?? sorted[0].name,
      volumeCount: vols.length,
    });
  }
  return owners;
}
const owners = await expectedOwners();
must(owners.length === 2, `W1 the walk hears TWO owners (${owners.length})`);
must(owners[0]?.job.id === host.id, "W2 the walk's FIRST owner is the capable host");
must(owners[1]?.job.id === second.id, "W3 the walk's SECOND owner is the tail-tier job");

/* ============ X: source oracles ============ */
section("X: the doors, rebuilt in source");
must((DLG.match(/InventoryTableContext = React\.createContext/g) ?? []).length === 1, "X1 the door context is defined ONCE (module-level, default false)");
must(DLG.includes('const OWNER_HEAD = ["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"];'), "X2 the door key is the inventory table's exact head septet (Peak, Δ winner, Agreement r, Weakest joined in turn — the key grows by design, before any probe dies)");
must(DLG.includes("OWNER_HEAD.every"), "X3 the head is matched EVERY cell at once — partial heads cannot mint doors");
must(/thead: \(\{ node, children, \.\.\.rest \}: TheadProps\) => \(\s*\n\s*<InventoryTableContext\.Provider value=\{false\}>/.test(DLG), "X4 the thead NEUTRALIZES the context — a head row is a label, not a door (and node is destructured out, never leaked to the DOM)");
must(DLG.includes("!inInventory || !owner) return <tr"), "X5 the honest fallback — an unmatched row stays plain (a door must promise what the paper says)");
must(/getState\(\)\.openJob\(owner\.jobId\)/.test(DLG), "X6 openJob is the door's engine (landing repair, workspace hops, the inspector)");
must(/void useWorkflowStore\.getState\(\)\.openJob\(owner\.jobId\);\s*\n\s*onOpenChange\(false\);/.test(DLG), "X7 the paper closes on press — the results live on the canvas, not under the dialog");
must(/e\.key === "Enter" \|\| e\.key === " "/.test(DLG) && DLG.includes("e.preventDefault();"), "X8 keyboard pressable (Enter/Space) — a door that needs a mouse is half a door");
must(DLG.includes("data-owner-door={owner.jobId}"), "X9 the probe hook rides the source (data-owner-door carries the owner's id)");
must(LIB.includes("Each row is a door — press it and the page hands you to that job's results"), "X10 the paper teaches the doors (t210's legend lesson, carried onto the report)");
must(LIB.includes("a name on a roster should never be a dead end"), "X11 the teaching clause names the doctrine (dead ends are the lie being cured)");
must(DLG.includes("components={mdComponents}"), "X12 the overrides ride the rendered document (the one ReactMarkdown tree)");
must(DLG.includes('hastKids(node).find((c) => hastTag(c) === "thead")') && DLG.includes('hastTag(c) === "td" || hastTag(c) === "th"'), "X13 the head and the cells are FOUND by tagName, never taken by position — hast interleaves whitespace text nodes between every table part (RUN=1's lesson: children[0] of a table is a newline, not the head)");

/* ============ D: live — press the doors ============ */
section("D: the doors, pressed");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 960 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await sleep(800);

const openReport = async () => {
  await page.locator('button[aria-label="Session QC report"]').click();
  await page.locator("[data-report-doc]").waitFor({ state: "visible", timeout: 15000 });
  const carrier = page.locator("[data-report-doc][data-md]");
  let md = null;
  for (let i = 0; i < 60 && !md; i++) {
    const v = await carrier.getAttribute("data-md").catch(() => null);
    if (v && v.includes("Session map inventory")) md = v;
    else await sleep(500);
  }
  return md;
};
const doors = page.locator("[data-report-body] tr[data-owner-door]");
const waitDoors = async (n) => {
  for (let i = 0; i < 40; i++) {
    if ((await doors.count()) === n) return true;
    await sleep(500);
  }
  return false;
};
const closeReport = async () => {
  await page.keyboard.press("Escape");
  await page.locator("[data-report-doc]").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await sleep(400);
};
const inspectorName = async () => {
  const ins = page.locator("[data-inspector-dialog]");
  await ins.waitFor({ state: "visible", timeout: 15000 });
  return (await ins.textContent()) ?? "";
};
const closeInspector = async () => {
  await page.keyboard.press("Escape");
  await page.locator("[data-inspector-dialog]").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  await sleep(400);
};

const md = await openReport();
must(!!md, "D1 the report opens and the inventory settles on the carrier");
must(await waitDoors(2), "D2 the rendered inventory carries TWO doors (body rows only)");

const ids = [await doors.nth(0).getAttribute("data-owner-door"), await doors.nth(1).getAttribute("data-owner-door")];
must(ids[0] === host.id && ids[1] === second.id, "D3 the doors walk in WALK ORDER — capable host first, tail-tier second");
// the doors' aria promises now include the peak (t214) — wait for the
// peaks to merge before reading the doors' words
for (let i = 0; i < 40; i++) {
  const a = (await doors.nth(0).getAttribute("aria-label").catch(() => "")) ?? "";
  if (a.includes("peak ")) break;
  await sleep(500);
}
const aria0 = (await doors.nth(0).getAttribute("aria-label")) ?? "";
const aria1 = (await doors.nth(1).getAttribute("aria-label")) ?? "";
must(/Open QA Refine3D's results — orthovol, 4 volumes, peak \d+\.\d%/.test(aria0), `D5 the host door SAYS its promise, peak included ("${aria0}")`);
must(/Open QA Class2D Source's results — orthovol, 1 volume, peak \d+\.\d%/.test(aria1), `D6 the tail-tier door SAYS its promise, singular volume honest, peak included ("${aria1}")`);
must((md ?? []).length > 0 && (md ?? "").includes("| Job | Main map | Volumes | Peak |") && (md ?? "").includes("| QA Class2D Source | orthovol | 1 |"), "D12 the exported bytes keep the t214 head and the row stems — the doors changed nothing on paper");
must((md ?? "").includes("Each row is a door"), "D13 the carrier teaches the doors");

// D7: press the TAIL-TIER door — the tier doctrine made travelable
await doors.nth(1).click();
const insName1 = await inspectorName();
must(insName1.includes("QA Class2D Source"), "D7 pressing the TAIL-TIER door lands on ITS results (the roster's second row is a road, not a label)");
await sleep(700); // let the report's fade finish — the portrait is the LANDING, not the transition
await page.screenshot({ path: `${OUT}/t213-doors-2x.png` });
await closeInspector();

// D8: reopen and press the HOST door
await closeReport();
const md2 = await openReport();
must(!!md2 && (await waitDoors(2)), "D8 the report reopens with its doors (the walk re-runs, the doors return)");
await doors.nth(0).click();
const insName2 = await inspectorName();
must(insName2.includes("QA Refine3D"), "D9 pressing the HOST door lands on the deep-report winner's results");
await closeInspector();

// D10: the keyboard door — focus the tail-tier row, press Enter
await closeReport();
await openReport();
must(await waitDoors(2), "D10 the doors return for the keyboard");
await doors.nth(1).focus();
await doors.nth(1).press("Enter");
const insName3 = await inspectorName();
must(insName3.includes("QA Class2D Source"), "D11 the KEYBOARD door lands identically (Enter — no mouse, same road)");
await closeInspector();

// D4: non-inventory tables keep their plain rows
await closeReport();
await openReport();
await waitDoors(2);
const totalDoors = await page.locator("[data-report-body] tr[data-owner-door]").count();
const headDoors = await page.locator("[data-report-body] thead tr[data-owner-door]").count();
const allTrs = await page.locator("[data-report-body] tr").count();
must(totalDoors === 2 && headDoors === 0, `D4 no door leaks outside the two body rows (doors ${totalDoors}, head doors ${headDoors} of ${allTrs} rows)`);
await closeReport();

/* ============ Z: the world read back ============ */
section("Z: the world read back");
const rosterZ = await jobs();
must(rosterZ.length === 21, `Z1 roster identity (${rosterZ.length})`);
must(errors.length === 0, `Z2 console clean (${errors.length} errors)`);

await browser.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail > 0) { console.error(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }
