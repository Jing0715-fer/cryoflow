// t144 — Task 144: the glance layer folds — the pipeline KPI bar gets a
// compact pill and an explicit chevron.
//
// Task 143's forensics: the floating KPI bar is a lawful overlay, but its
// width grows with the world (particle counts, resolution + verdict pills)
// and a boot-fit canvas can hide a WHOLE card under it (t127/t128 block-6
// double failure). The product-level answer (deferred until now, with
// forensics as the垫底) is the FOLD: an explicit chevron collapses the bar
// to completion ring + count + the live runner chip; the world-detail pills
// (particles / resolution / verdict) go back behind the chevron. The fold
// reclaims canvas without losing the glance — and the ALARM never folds
// away: a failed job keeps the count rose in both modes.
//
// Doctrine carried:
//   explicit, never hover — hiding content on hover hides it from the
//   people who need it most; the chevron is a real button with
//   aria-expanded. Ephemeral like the find lens: store, not storage —
//   survives view switches within the session, forgets on reload.
//   Side repair: the hand-placed hairline separators used to DOUBLE UP
//   whenever the particle item was absent ([ring][sep][sep][res]) —
//   separators now render between neighbors only (items array).
//
// Phase S — pre-clean T144 rows, snapshot roster count, seed 6 jobs
//           (select completed with "2417 of 5539" result → particles pill;
//           refine3d running fresh startedAt → runner chip; import failed
//           → the alarm), build the FULL roster oracle: completion counts,
//           first-running name (the world may put QA Refine Live first —
//           never pin the actor), first select-completed particles, and
//           the resolution path fetched exactly as the product fetches it.
// Phase X — fmtNum oracle anchored to the product source by regex (the
//           copy is guarded: if the source line moves, the probe fails).
// Phase B — expanded default: data-collapsed=false, aria-expanded=true,
//           count text == oracle, particles pill presence+text == oracle,
//           resolution/verdict presence == oracle (absent here — the
//           stamped runner has no engine files and /resolution honestly
//           answers {current:null} 200), runner chip name (title attr,
//           truncation-proof) + pct, hairline count == item count (the
//           double-separator cure), rose count iff failed > 0, width
//           snapshot.
// Phase C — fold: data-collapsed=true, aria-expanded=false, world-detail
//           pills GONE, completion + runner persist, hairlines == 2,
//           rose SURVIVES (the alarm never folds away), width strictly
//           smaller.
// Phase D — the fold survives a view switch (store, not component state):
//           dashboard → back to canvas → still collapsed.
// Phase E — unfold: pills restored per oracle, width reclaims (>>
//           collapsed), data-collapsed=false, hairlines back to oracle.
// Phase F — rapid double-toggle robustness: two clicks end expanded,
//           no stuck state.
// Phase G — screenshots (expanded + collapsed).
// Phase Z — console clean (tolerance scoped to the resSource fetch URL
//           only, 404 only — the product's own poll is the one URL that
//           may honestly 4xx on a stamped job), T144 rows deleted,
//           roster restored.
//
// Run: node scripts/t144-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t144-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const seededIds = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

/** Stamp a job straight into the DB (qa75 / t135 / t140 / t141 precedent).
 *  A "running" stamp MUST carry a fresh startedAt: the engine's reconcile
 *  treats a running row with no engine record older than 120s as stale
 *  and honestly fails it — a fresh startedAt is the grace-window ticket.
 *  Extra data (result text) rides along for the particles oracle. */
const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const deleteT144Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T144"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
}

const must = (cond, label) => {
  if (!cond) {
    console.log(`FAIL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const CONT = '[data-canvas-ui="pipeline-kpi"]';
const TOGGLE = '[data-testid="pipeline-kpi-toggle"]';
const RUNNER_TITLE = " — running · click to open its results";

/** fmtNum copied from pipeline-kpi.tsx — guarded against drift by the
 *  Phase X regex anchor against the product source. */
const fmtNum = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString());

/** Count the hairline separators currently inside the bar — the
 *  double-separator cure asserts hairlines == items (one between each
 *  pair, plus the fold control's own). */
const hairlines = () => p.locator(`${CONT} span.h-4.w-px`).count();

const countText = async () =>
  (await p.locator(`${CONT} button[title*="Pipeline completion"]`).innerText())
    .replace(/\s+/g, " ")
    .trim();

async function main() {
  /* ---------------- Phase S — clean world, seeds, roster oracle ---------------- */
  step("--- Phase S: world snapshot, seeds, roster oracle ---");
  deleteT144Rows();
  const before = await roster();
  const rosterBefore = before.length;

  const maxY = before.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const seeds = [
    ["T144 Import", "import", { status: "completed", progress: 100 }],
    ["T144 Motion", "motioncorr", { status: "completed", progress: 100 }],
    ["T144 Ctf", "ctffind", { status: "completed", progress: 100 }],
    // the particles oracle source: a completed select whose result text
    // matches /(\d+)\s+of\s+(\d+)/ — the bar parses THIS, not the DB
    ["T144 Pick", "select", { status: "completed", progress: 100, result: "2417 of 5539 particles picked" }],
    // the live runner: fresh startedAt = the reconcile grace-window ticket
    ["T144 Refine", "refine3d", { status: "running", progress: 37, startedAt: new Date().toISOString() }],
    // the alarm
    ["T144 Sick", "import", { status: "failed", progress: 0 }],
  ];
  let y = maxY + 240;
  for (const [name, type, data] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type})`);
    seededIds.push(j.id);
    stampEx(j.id, data);
    y += 240;
  }

  // oracle from the same source the store loads — the FULL roster
  // (the bar counts every workspace; never derive from seeds alone)
  const jobs = await roster();
  const total = jobs.length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  must(failed > 0, "oracle: the world carries ≥1 failed job (the alarm is load-bearing)");
  const runningJob = jobs.find((j) => j.status === "running") ?? null;
  must(!!runningJob, "oracle: a runner exists (seed or world fixture — the chip follows whoever is first)");
  const selectJob = jobs.find((j) => /select/i.test(j.type) && j.status === "completed") ?? null;
  let particles = null;
  if (selectJob) {
    const m = (selectJob.result ?? "").match(/(\d+)\s+of\s+(\d+)/);
    if (m) particles = Number(m[1]);
  }
  // relative, not pinned: if the world's FIRST completed select carries no
  // parsable result text, the product honestly shows no pill — so may we
  step(`  oracle: particles=${particles != null ? particles : "none (first select-completed has no parsable result)"}`);

  // resolution path — fetched EXACTLY as the product fetches it:
  // postprocess-completed FSC first, else the active refine's /resolution
  const refines = jobs.filter((j) => /refine3d|class3d|multibody/i.test(j.type));
  const post = jobs.find((j) => /postprocess/i.test(j.type) && j.status === "completed");
  const activeRefine =
    refines.find((j) => j.status === "running") ??
    [...refines].reverse().find((j) => j.status === "completed") ??
    null;
  const resSource = post ?? activeRefine;
  const wantFsc = Boolean(post);
  let resValue = null;
  let resSourceId = null;
  if (resSource) {
    resSourceId = resSource.id;
    // fetch EXACTLY the endpoint the product would fetch (wantFsc splits it)
    const r = await api(`/api/jobs/${resSource.id}/${wantFsc ? "fsc" : "resolution"}`, "GET");
    const d = await r.json().catch(() => ({}));
    const v = wantFsc ? d?.resolutionAt143 : d?.current;
    if (v != null) resValue = v;
  }
  step(`  oracle: total=${total} completed=${completed} failed=${failed} particles=${particles} ` +
       `runner="${runningJob.name}" resSource=${resSource ? (wantFsc ? "fsc" : "resolution") : "none"} resValue=${resValue}`);

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await p.locator(CONT).waitFor({ timeout: 8000 });
  await sleep(1000);

  /* ---------------- Phase X — fmtNum anchor ---------------- */
  step("--- Phase X: fmtNum oracle anchored to the product source ---");
  const srcTxt = readFileSync("/home/z/my-project/src/components/workflow/pipeline-kpi.tsx", "utf8");
  must(
    /const fmtNum = \(n: number\) =>\s*\n\s*n >= 10000 \? `\$\{\(n \/ 1000\)\.toFixed\(1\)\}k` : n\.toLocaleString\(\);/.test(srcTxt),
    "oracle anchor: fmtNum source line matches the probe's copy (drift fails here)"
  );
  must(fmtNum(2417) === "2,417" && fmtNum(55390) === "55.4k", "oracle: fmtNum locale + k-grain");

  /* ---------------- Phase B — expanded default ---------------- */
  step("--- Phase B: the bar opens expanded, every pill == oracle ---");
  const bar = p.locator(CONT);
  must((await bar.getAttribute("data-collapsed")) === "false", "data-collapsed=false (default expanded)");
  const toggle = p.locator(TOGGLE);
  must((await toggle.getAttribute("aria-expanded")) === "true", "toggle aria-expanded=true");
  must(
    (await toggle.getAttribute("aria-label")) === "Collapse pipeline summary",
    'toggle offers "Collapse pipeline summary" when open'
  );
  must((await countText()) === `${completed}/${total}`, `count text == oracle ${completed}/${total}`);
  // particles pill — presence follows the oracle (a completed select with a
  // parsable "N of M" result), text follows the number
  const particlesLoc = p.locator(`${CONT} [title="Particles fed into 2D/3D classification"]`);
  must((await particlesLoc.count()) === (particles != null ? 1 : 0),
    `particles pill presence == oracle (${particles != null ? "present" : "absent — first select-completed has no parsable result"})`);
  if (particles != null) {
    must(
      (await particlesLoc.innerText()).includes(fmtNum(particles)),
      `particles pill reads ${fmtNum(particles)}`
    );
  }
  // resolution + verdict — presence matches the oracle's fetch of the same URL
  const resLoc = p.locator(`${CONT} [title*="resolution — click to open"]`);
  must((await resLoc.count()) === (resValue != null ? 1 : 0),
    `resolution pill presence == oracle (${resValue != null ? "present" : "absent — the product's own poll answered null"})`);
  const verdictLoc = p.locator(`${CONT} [title^="EMPIAR-10017"]`);
  must((await verdictLoc.count()) === (wantFsc && resValue != null ? 1 : 0),
    "verdict pill presence == oracle (only a FINAL FSC can crown)");
  // runner chip — name via title (truncation-proof), pct well-formed
  const runChip = p.locator(`${CONT} button[title$="${RUNNER_TITLE}"]`).first();
  must((await runChip.count()) === 1, "runner chip present");
  must(
    (await runChip.getAttribute("title")).startsWith(`${runningJob.name}${RUNNER_TITLE}`),
    `runner chip title carries the FIRST roster runner ("${runningJob.name}") — not a pinned seed`
  );
  must(/^\d+%$/.test((await runChip.innerText()).match(/(\d+%)/)?.[1] ?? ""), "runner chip carries a pct readout");
  // the double-separator cure: hairlines == items
  const expectedItemsB = 1 /* completion */ + (particles != null ? 1 : 0) +
    (resValue != null ? 1 : 0) + (wantFsc && resValue != null ? 1 : 0) + 1 /* runner */;
  must((await hairlines()) === expectedItemsB,
    `hairlines (${await hairlines()}) == items (${expectedItemsB}) — separators between neighbors only, none doubled`);
  // the alarm, expanded — pin the COUNT span by its rose class (the ring's
  // span also lives in this button; .first() would read the wrong actor)
  must(
    (await p.locator(`${CONT} button[title*="Pipeline completion"] span.text-rose-600`).count()) === 1,
    "expanded: failed > 0 → count speaks rose (the alarm is on)"
  );
  const wExpanded = (await bar.boundingBox()).width;
  must(wExpanded > 200, `expanded width snapshot ${Math.round(wExpanded)}px`);

  /* ---------------- Phase C — the fold ---------------- */
  step("--- Phase C: the fold — detail pills leave, the glance stays ---");
  await toggle.click();
  await sleep(400);
  must((await bar.getAttribute("data-collapsed")) === "true", "data-collapsed=true after the fold");
  must((await toggle.getAttribute("aria-expanded")) === "false", "toggle aria-expanded=false");
  must(
    (await toggle.getAttribute("aria-label")) === "Expand pipeline summary",
    'toggle now offers "Expand pipeline summary"'
  );
  must((await particlesLoc.count()) === 0, "particles pill gone behind the chevron");
  must((await resLoc.count()) === 0, "resolution pill gone");
  must((await verdictLoc.count()) === 0, "verdict pill gone");
  must((await countText()) === `${completed}/${total}`, `completion survives the fold (${completed}/${total})`);
  must((await p.locator(`${CONT} button[title$="${RUNNER_TITLE}"]`).count()) === 1, "runner chip survives the fold");
  must((await hairlines()) === 2, `hairlines == 2 (completion · runner · chevron), got ${await hairlines()}`);
  must(
    (await p.locator(`${CONT} button[title*="Pipeline completion"] span.text-rose-600`).count()) === 1,
    "COLLAPSED: the alarm never folds away — count still rose"
  );
  const wCollapsed = (await bar.boundingBox()).width;
  must(wCollapsed < wExpanded - 40, `folded width ${Math.round(wCollapsed)}px strictly < expanded ${Math.round(wExpanded)}px — canvas reclaimed`);

  /* ---------------- Phase D — the fold survives a view switch ---------------- */
  step("--- Phase D: store, not component state — the fold survives view switches ---");
  const dashTab = p.locator('button[role="tab"][title*="Project dashboard"]');
  await dashTab.click({ timeout: 6000 }).catch(() => dashTab.click({ force: true, timeout: 6000 }));
  await sleep(1200);
  must((await p.locator('[data-roster-table]').count()) > 0, "dashboard view reached (the bar unmounted with the canvas)");
  await p.locator('button[role="tab"][title*="Canvas"], button[role="tab"][title*="Workflow"]').first()
    .click({ timeout: 6000 }).catch(() => p.keyboard.press("Escape"));
  await sleep(1000);
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await p.locator(CONT).waitFor({ timeout: 8000 });
  must((await p.locator(CONT).getAttribute("data-collapsed")) === "true",
    "back on canvas: STILL collapsed — ephemeral state lives in the store, not the unmounted component");

  /* ---------------- Phase E — unfold restores the world ---------------- */
  step("--- Phase E: unfold — the world-detail pills come back ---");
  await p.locator(TOGGLE).click();
  await sleep(400);
  must((await p.locator(CONT).getAttribute("data-collapsed")) === "false", "unfolded: data-collapsed=false");
  must((await particlesLoc.count()) === (particles != null ? 1 : 0), "particles pill restored per oracle");
  must((await resLoc.count()) === (resValue != null ? 1 : 0), "resolution pill restored per oracle");
  must((await p.locator(`${CONT} button[title$="${RUNNER_TITLE}"]`).count()) === 1, "runner chip still present");
  must((await hairlines()) === expectedItemsB, `hairlines back to ${expectedItemsB}`);
  const wExpanded2 = (await bar.boundingBox()).width;
  must(wExpanded2 > wCollapsed + 40, `width reclaimed: ${Math.round(wExpanded2)}px >> collapsed ${Math.round(wCollapsed)}px`);

  /* ---------------- Phase F — rapid double-toggle robustness ---------------- */
  step("--- Phase F: two rapid clicks end where they started ---");
  await p.locator(TOGGLE).click();
  await sleep(120);
  await p.locator(TOGGLE).click();
  await sleep(300);
  must((await p.locator(CONT).getAttribute("data-collapsed")) === "false",
    "fold→unfold in 120ms ends expanded — no stuck toggle, no race");

  /* ---------------- Phase G — screenshots ---------------- */
  step("--- Phase G: screenshots (expanded + collapsed) ---");
  mkdirSafe(OUT);
  await p.screenshot({ path: `${OUT}/t144-expanded.png` });
  await p.locator(TOGGLE).click();
  await sleep(400);
  await p.screenshot({ path: `${OUT}/t144-collapsed.png` });
  must(true, "screenshots recorded");
  await p.locator(TOGGLE).click(); // leave expanded for the next visitor
  await sleep(250);

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  // Tolerance scoped with a半径: only the product's own resSource poll may
  // 4xx on a stamped job (no engine files), only 404, only that URL.
  const resTol = resSourceId
    ? new RegExp(`/api/jobs/${resSourceId}/(fsc|resolution)$`)
    : null;
  const intolerable = badResponses.filter((line) => {
    if (!resTol) return true;
    if (!resTol.test(line.split(" ")[1] ?? "")) return true;
    if (!line.startsWith("404")) return true;
    return false;
  });
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")})` : "no intolerable 4xx/5xx (resSource poll tolerance held its radius)");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");

  await p.close(); p = null;
  await b.close(); b = null;
  deleteT144Rows();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT144 ALL PASS (${PASS} assertions)`);
}

function mkdirSafe(dir) {
  try { execSync(`mkdir -p ${dir}`); } catch {}
}

main().catch((e) => { console.error(e); process.exit(1); });
