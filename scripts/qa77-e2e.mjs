// qa77 — dashboard workspace attribution + orphan adoption e2e.
// REVIVED (t629): the suite went deterministic-deep-dormant when the
// canonical world stopped carrying pre-workspace strays (EMPIAR holds
// zero workspaceId-NULL jobs and zero legacy-named rows, and bare
// /api/jobs answers only the active project — the revival premise "the
// world already carries an orphan" died with the old seed strays).
// The revival folds in three laws that postdate the suite:
//   t628 landing fiction, now OWNED — jobs POST ignores the request's
//     projectId and assigns every create to the ACTIVE project; the
//     suite seeds its own orphan specimen through the product door and
//     unassigns it via direct prisma (the PATCH route can only MOVE,
//     never unassign — its own comment).
//   t628 census conviction — the old D3 kept the adopted job forever as
//     "the feature's living instance"; that is exactly the "harmless
//     strays" fiction the workdir census convicted. A resident specimen
//     is a permanent 13th roster row and a standing lie in the floor
//     arithmetic. The suite now runs the qa82 lifecycle instead:
//     SEED → STUDY → TAKE HOME. The orphan is a specimen, not a resident.
//   armor — t523 two-stage law (domcontentloaded + wait for the ROSTER,
//     never the network), t622 memory-institution launch args, t627
//     forensic camera + SEGMENTED BROWSERS (the userspace reaper
//     harvests chromium at ~90-100s; each segment stays inside the line).
// Layers:
//   S  self-seed — one QA-named orphan specimen (POST + prisma
//      unassign); crashed predecessors' overflow workspaces and extra
//      specimens are swept first (idempotency); workdir dir-set snapshot
//      taken for the Z-phase radius check
//   A  attribution — every in-workspace row carries a workspace badge;
//      the orphan row carries a dashed amber "Unassigned" badge; adopt
//      buttons exist only on orphan rows; an "Unassigned N" chip appears
//   B  adoption — the Unassigned filter isolates the orphan row; one
//      click on Adopt moves the job into the default workspace (PATCH
//      workspaceId via the store's moveJob), the badge flips, the chip
//      removes itself at zero, the card lands on the canvas
//   C  deep-link repair — a row from ANOTHER workspace switches the
//      canvas first (openJob switchWorkspace), so clicking it lands on
//      a card that actually exists; verified with a temporary second
//      workspace (the ambient idle job is the mover and is returned)
//   D  teardown of the browser-facing probes + console hygiene
//   Z  take the specimen home — product-door DELETE, world back to the
//      S-phase baseline (count / orphans / workspaces), zero new
//      workdir directories, zero engine-state references
// Run: node scripts/qa77-e2e.mjs   (server on :3000)
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor(); // t708 — the writers batch: 13 write routes reject headerless clients once the door activates (the t707 both-worlds doctrine)
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

// t623's env pin: the SHELL's exported DATABASE_URL is a LIAR here — the
// suite speaks the same DB the server itself speaks (.env's DATABASE_URL,
// canonical fallback). Without the pin prisma lands on a main.Job that
// does not exist (P2021) and the unassign dies before the browser boots.
const ROOT = "/home/z/my-project";
const CANONICAL_DB = "file:/home/z/my-project/db/cryoflow.db";
const envUrl = (() => {
  try {
    const m = readFileSync(`${ROOT}/.env`, "utf8").match(/^DATABASE_URL=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
})();

const BASE = "http://localhost:3000";
const RELION = "/home/z/my-project/data/relion";
const STATE = "/home/z/my-project/data/engine-state.json";
const SPECIMEN_NAME = "QA Orphan Import";
const OVERFLOW_WS = "QA Overflow";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// t629 latency armor: under memory pressure a PATCH can take longer than
// any fixed sleep — poll the API for the TRUTH instead of guessing a
// window (the fixed-window reads were how the optimistic store's
// transient state got mistaken for server truth)
const waitForApi = async (pred, timeoutMs = 12_000) => {
  const t0 = Date.now();
  for (;;) {
    const jobs = (await api("/api/jobs")).json.jobs ?? [];
    const hit = pred(jobs);
    if (hit) return hit;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(500);
  }
};
// DOM twin of waitForApi: wait for the roster to CARRY the expected
// truth, then let the must() report the real count on failure
const waitForDom = async (fnBody, arg, timeoutMs = 12_000) => {
  try {
    await p.waitForFunction(fnBody, arg, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
};
// waitForFunction's callback is SERIALIZED and evaluated in the BROWSER —
// free node-side identifiers inside its body throw ReferenceError there
// (three page-console errors in the first live run). Everything the poll
// needs must travel through the arg.
const api = async (path, opts = {}) => {
  // init is built from what the call actually needs — a method WITHOUT a
  // body (DELETE) must still ship its method. The first draft gated ALL
  // init on `opts.body`, silently turning DELETEs into GETs (a read always
  // "succeeds", so nothing screams — only the {ok:true} assert caught it).
  const init = opts.body
    ? { method: opts.method ?? "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(opts.body) }
    : opts.method
      ? { method: opts.method }
      : undefined;
  const res = await fetch(BASE + path, init);
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
// t629 radius instruments — the Z phase verifies the specimen owned
// NOTHING on disk: a never-dispatched job has no workdir and no
// engine-state entry, so the honest check is ABSENCE, not cleanup.
const workdirDirs = () => {
  const out = [];
  try {
    for (const proj of readdirSync(RELION)) {
      for (const d of readdirSync(`${RELION}/${proj}`, { withFileTypes: true })) {
        if (d.isDirectory()) out.push(`${proj}/${d.name}`);
      }
    }
  } catch { /* no workdir root yet — the empty set is still the truth */ }
  return out.sort();
};
const stateMentions = (id) => {
  try {
    return readFileSync(STATE, "utf8").includes(id);
  } catch {
    return false; // no registry file — nothing can mention the specimen
  }
};

/* ---------------- Phase S: self-seed the orphan specimen ---------------- */
console.log("Phase S — self-seeded orphan specimen (t629 revival)");
const workdirSnapshot = workdirDirs();
console.log(`  (s) workdir radius snapshot: ${workdirSnapshot.length} directories`);

let list = (await api("/api/jobs")).json.jobs ?? [];
const s0Count = list.length;
const s0Strays = list.filter((j) => j.name === SPECIMEN_NAME).length;
// the honest Z-target: the world WITHOUT any qa77 litter — this run's or
// any crashed predecessor's. Whatever strays existed at S0 belong to the
// suite lineage and are taken home; the ambient world underneath must be
// exactly what it was.
const ambientBaseline = s0Count - s0Strays;
must(list.length >= 5, `S0 roster present (${list.length} jobs)`);

// crashed predecessors first: their overflow workspaces and extra
// specimens are THIS suite's litter, not the world's. The workspace
// DELETE reassigns any job still inside to the default — a crash between
// C and D0 leaves the ambient mover there, and the reassignment is what
// brings it home.
const wsList0 = (await api("/api/workspaces")).json.workspaces ?? [];
for (const w of wsList0) {
  if (w.name === OVERFLOW_WS) {
    await api(`/api/workspaces/${w.id}`, { method: "DELETE" });
    console.log(`swept leftover workspace: ${w.name} (${w.id.slice(-6)})`);
  }
}
list = (await api("/api/jobs")).json.jobs ?? [];
const strays = list.filter((j) => j.name === SPECIMEN_NAME);
for (const extra of strays.slice(1)) {
  // keep ONE specimen; multi-crash litter goes home through the product
  // door — a never-dispatched specimen owns no workdir to leak
  await api(`/api/jobs/${extra.id}`, { method: "DELETE" });
  console.log(`swept extra specimen: ${extra.id.slice(-6)}`);
}
let specimen = strays[0] ?? null;
const db = new PrismaClient({
  datasources: { db: { url: envUrl ?? CANONICAL_DB } },
});
if (specimen && specimen.workspaceId) {
  // re-orphan OUR specimen (a predecessor crashed after adopting it):
  // direct prisma — the PATCH route deliberately refuses NULL workspaceId
  // (it can only MOVE, never unassign).
  await db.job.update({ where: { id: specimen.id }, data: { workspaceId: null } });
  console.log(`re-orphaned crashed specimen: ${specimen.id.slice(-6)}`);
} else if (!specimen) {
  // t628 landing fiction, now OWNED: POST lands in the ACTIVE project —
  // exactly where this suite wants its specimen. The job is born into
  // the default workspace (route semantics) and unassigned right below.
  const seeded = await api("/api/jobs", {
    method: "POST",
    body: { type: "import", name: SPECIMEN_NAME, x: 150, y: 420 },
  });
  must(seeded.status === 201 || seeded.status === 200,
    `S1 specimen seeded through the product door (${seeded.status})`);
  specimen = seeded.json.job ?? null;
  must(!!specimen?.id, "S1b specimen id returned");
}
if (specimen && specimen.workspaceId !== null) {
  await db.job.update({ where: { id: specimen.id }, data: { workspaceId: null } });
}
await db.$disconnect();
list = (await api("/api/jobs")).json.jobs ?? [];
const orphans = list.filter((j) => !j.workspaceId);
must(orphans.length === 1 && orphans[0].id === specimen?.id,
  `S2 exactly one orphan — the specimen (${orphans.length})`);
const baselineCount = list.length;
const wsJobs0 = list.filter((j) => j.workspaceId);
must(wsJobs0.length >= 2, `S3 in-workspace jobs present (${wsJobs0.length})`);
const orphanIds0 = orphans.map((o) => o.id);
const wsList = (await api("/api/workspaces")).json.workspaces ?? [];
must(wsList.length >= 1, `S4 workspaces present (${wsList.length})`);
const defaultWs = wsList[0];
// badge-flip baseline is PER-WORKSPACE: the world may legitimately hold
// several workspaces with jobs, so "rows in Main" counts MAIN's jobs,
// not the global in-workspace total (the old arithmetic miscounted the
// moment a sibling workspace carried a job).
const mainJobs0 = list.filter((j) => j.workspaceId === defaultWs.id).length;
console.log(`default workspace: ${defaultWs.name} | specimen: ${specimen?.id?.slice(-6)} | baseline: ${baselineCount}`);

/* ---------------- browser (t622/t627 armor) ---------------- */
// chromium's footprint grows monotonically across navigations and the
// userspace reaper harvests a browser at ~90-100s of age — so the suite
// runs SEGMENTED BROWSERS: a fresh browser per late phase keeps every
// segment's life inside the line. Launch args keep the heap small
// (t622 memory institution); the forensic camera catches who died where.
let b = await chromium.launch({
  args: ["--disable-dev-shm-usage", "--js-flags=--max-old-space-size=256", "--disable-gpu"],
});
let p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
const armForensics = () => {
  p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  p.on("pageerror", (e) => consoleErrors.push(String(e)));
  p.on("crash", () => console.log(`  [forensic] PAGE CRASHED at ${p.url()}`));
  b.on("disconnected", () => console.log("  [forensic] BROWSER DISCONNECTED"));
};
armForensics();
const relaunch = async () => {
  try { await p.close(); } catch { /* already gone */ }
  try { await b.close(); } catch { /* already gone */ }
  b = await chromium.launch({
    args: ["--disable-dev-shm-usage", "--js-flags=--max-old-space-size=256", "--disable-gpu"],
  });
  p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  armForensics();
};
process.on("uncaughtException", (e) => {
  console.log(`  [forensic] uncaught: ${e.message} | page url: ${p?.url?.() ?? "?"} | closed: ${p?.isClosed?.() ?? "?"}`);
  // a zombie suite helps nobody: the async chain that threw never resumes,
  // and the world cleanup belongs to the NEXT run's S-phase sweep (built
  // for exactly this). Exit nonzero so the runner sees the failure.
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.log(`  [forensic] unhandled rejection: ${e}`);
  process.exit(1);
});
// the watchdog: a suite that outlives its own waits is a hang — say so
// and leave (the S-phase sweep of the next run cleans up whatever this
// run left behind)
setTimeout(() => {
  console.log("  [forensic] WATCHDOG: suite exceeded 420s — exiting (world cleanup deferred to the next run's S-phase)");
  process.exit(2);
}, 420_000).unref();

// t523 law, both halves: networkidle is a PSEUDO-wait on an app that
// polls /api/jobs (a 1.2s poll cadence only sometimes leaves the 500ms
// silence networkidle demands), AND it moonlighted as "wait for the
// post-reload /api/jobs fetch to settle" — removing it must re-arm that
// second half explicitly. domcontentloaded + wait for the ROSTER to
// render, never for the network.
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
const arriveDashboard = async () => {
  await p.waitForSelector('[data-canvas="viewport"]');
  must(await ensureView("dashboard"), "  (nav) dashboard view reached");
  await p.waitForFunction(
    () => document.querySelectorAll("[data-roster-row]").length > 0,
    undefined,
    { timeout: 15_000 },
  );
  await sleep(300);
};
const reloadToDashboard = async () => {
  await p.reload({ waitUntil: "domcontentloaded" });
  await arriveDashboard();
};

await p.goto(BASE, { waitUntil: "domcontentloaded" });
await arriveDashboard();

// the spotlight locator must be rebuilt per use: relaunch swaps the page
// object, and a locator captured from the old page throws "Target page,
// context or browser has been closed" against the NEW browser (the B6
// zombie of the first run)
const spot = () => p.locator('section[aria-label="Active project spotlight"]');

/* ---------------- Phase A: attribution ---------------- */
console.log("Phase A — workspace attribution on the roster");
{
  must(await ensureView("dashboard"), "A1 dashboard view reached");

  const wsBadges = spot().locator("[data-row-ws]");
  must((await wsBadges.count()) === wsJobs0.length,
    `A2 every in-workspace row has a workspace badge (${await wsBadges.count()}/${wsJobs0.length})`);
  must((await wsBadges.first().getAttribute("data-row-ws")) === defaultWs.name,
    `A3 badge value is the workspace name (${defaultWs.name})`);
  must((await wsBadges.first().getAttribute("title")) === `Workspace: ${defaultWs.name}`,
    "A4 badge hover explains the workspace");

  const orphanBadges = spot().locator("[data-row-orphan]");
  must((await orphanBadges.count()) === orphans.length,
    `A5 orphan rows carry the dashed Unassigned badge (${await orphanBadges.count()}/${orphans.length})`);
  must((await orphanBadges.first().textContent())?.trim() === "Unassigned", "A6 orphan badge reads Unassigned");

  const adoptBtns = spot().locator("[data-adopt]");
  must((await adoptBtns.count()) === orphans.length,
    `A7 adopt buttons exist only on orphan rows (${await adoptBtns.count()}/${orphans.length})`);
  must((await adoptBtns.first().getAttribute("aria-label")) === `Adopt into ${defaultWs.name}`,
    `A8 adopt aria names the target workspace (${defaultWs.name})`);

  const chip = spot().locator('[data-filter="unassigned"]');
  must((await chip.count()) === 1, "A9 Unassigned filter chip present");
  must((await chip.textContent())?.includes(String(orphans.length)) ?? false,
    `A9b chip count matches orphans (${orphans.length})`);

  // the whole row must stay one click target without nested buttons —
  // hydration would scream in the console if the DOM were invalid (D phase)
  const rowDivs = spot().locator("div.group\\/row");
  must((await rowDivs.count()) >= list.length,
    `A10 rows are div-wrapped (nested-button fix) (${await rowDivs.count()} rows)`);
}

/* ---------------- Phase B: unassigned filter + adoption ---------------- */
console.log("Phase B — adopt the specimen into the default workspace");
{
  await spot().locator('[data-filter="unassigned"]').click();
  await sleep(400);
  must((await spot().locator("[data-row-orphan]").count()) === orphans.length,
    `B1 Unassigned filter isolates orphan rows (${orphans.length} visible)`);
  must((await spot().locator("[data-row-ws]").count()) === 0,
    "B1b no in-workspace rows leak into the orphan slice");

  // arm the toast listener BEFORE the click: under memory pressure the
  // click() resolution itself can outlive the toast's lifetime (the
  // listener used to start only after click resolved — by then the toast
  // had already died, and a successful adoption read as toast-less)
  const toastP = p
    .getByText(`Adopted into ${defaultWs.name}`)
    .first()
    .waitFor({ timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  await spot().locator("[data-adopt]").first().click();
  must(await toastP, "B2 adoption confirms with a toast naming the target workspace");

  // which orphan got adopted is DOM-order dependent (rows render newest
  // first) — ask the API instead of guessing from the list order. The
  // read POLLS: the first run's fixed read caught the PATCH still in
  // flight under memory pressure and mistook the optimistic store's
  // transient state for the server's answer.
  const adoptedJob = await waitForApi(
    (jobs) => jobs.find((j) => orphanIds0.includes(j.id) && j.workspaceId === defaultWs.id) ?? null,
    12_000,
  );
  must(!!adoptedJob, "B2b exactly one orphan landed in the default workspace (API truth)");
  var adoptedId = adoptedJob?.id ?? null;

  await waitForDom(
    (n) => document.querySelectorAll("[data-row-orphan]").length === n,
    orphans.length - 1,
  );
  must((await spot().locator("[data-row-orphan]").count()) === orphans.length - 1,
    `B3 orphan count dropped (${orphans.length} → ${orphans.length - 1}) while filtered`);

  await spot().locator('button[title="Show all jobs only"]').click();
  await waitForDom(
    (a) => document.querySelectorAll(`[data-row-ws="${a.name}"]`).length === a.n,
    { name: defaultWs.name, n: mainJobs0 + 1 },
  );
  must((await spot().locator(`[data-row-ws="${defaultWs.name}"]`).count()) === mainJobs0 + 1,
    `B4 badge flip: ${mainJobs0} → ${mainJobs0 + 1} rows now in ${defaultWs.name}`);
  const remaining = orphans.length - 1;
  if (remaining > 0) {
    must((await spot().locator('[data-filter="unassigned"]').textContent())?.includes(String(remaining)) ?? false,
      "B4b chip count tracks the adoption");
  } else {
    // adopting the LAST orphan empties the filter — the chip removing
    // itself is the honest dead-control design (same semantics as the
    // status chips appearing only when their slice is non-empty)
    must((await spot().locator('[data-filter="unassigned"]').count()) === 0,
      "B4b chip removed at zero orphans (dead-control honesty)");
  }

  // place the adopted card INSIDE the existing canvas bbox (print budget
  // hygiene for qa72/qa73) — first free slot in the band between rows,
  // skipping coordinates another card already occupies
  const allNow = (await api("/api/jobs")).json.jobs ?? [];
  const taken = new Set(allNow.filter((j) => j.id !== adoptedId).map((j) => `${j.x},${j.y}`));
  const slots = [[150, 420], [460, 420], [770, 420], [1080, 420]];
  const slot = slots.find(([x, y]) => !taken.has(`${x},${y}`)) ?? [150, 420];
  const posPatch = await api(`/api/jobs/${adoptedId}`, { body: { x: slot[0], y: slot[1] } });
  must(posPatch.status === 200,
    `B4c adopted card repositioned into the existing print bbox (${slot[0]},${slot[1]})`);

  // canvas visibility — the adopted job is a real card now (same browser;
  // the reload-persistence half runs on a fresh segment below)
  await ensureView("canvas");
  if (adoptedId) {
    // the position PATCH reaches the card through the poll tick — under
    // memory pressure that tick is late; wait for the card, don't guess
    await waitForDom((id) => !!document.querySelector(`[data-job="${id}"]`), adoptedId, 15_000);
  }
  must((await p.locator(`[data-job="${adoptedId}"]`).count()) === 1,
    "B5 adopted job is now a real card on the canvas");
}

/* ---------------- segment 2: reload persistence + deep-link ---------------- */
await relaunch();
await p.goto(BASE, { waitUntil: "domcontentloaded" });
await arriveDashboard();

console.log("Phase B6 — adoption survives a reload");
{
  must((await spot().locator("[data-row-orphan]").count()) === orphans.length - 1,
    "B6 adoption survives a reload (API truth, not just client state)");
  must((await spot().locator(`[data-row-ws="${defaultWs.name}"]`).count()) === mainJobs0 + 1,
    "B6b adopted row still carries the workspace badge after reload");
}

console.log("Phase C — deep-link repair for other-workspace rows");
const mover = wsJobs0.find((j) => j.status === "idle" && j.id !== adoptedId) ?? wsJobs0[0];
let ws2Id = null;
{
  const created = await api("/api/workspaces", { method: "POST", body: { name: OVERFLOW_WS } });
  must(created.status === 201 || created.status === 200, `C1 temporary workspace created (${created.status})`);
  ws2Id = created.json.workspace?.id ?? null;
  must(!!ws2Id, "C1b workspace id returned");

  await api(`/api/jobs/${mover.id}`, { body: { workspaceId: ws2Id } });
  const movedCheck = await waitForApi(
    (jobs) => jobs.find((j) => j.id === mover.id && j.workspaceId === ws2Id) ?? null,
    12_000,
  );
  must(!!movedCheck, "C2b move persisted (API truth) — guards against silent GETs");
  await reloadToDashboard();
  await waitForDom(
    (a) => document.querySelectorAll(`[data-row-ws="${a.name}"]`).length === a.n,
    { name: OVERFLOW_WS, n: 1 },
  );
  must((await spot().locator(`[data-row-ws="${OVERFLOW_WS}"]`).count()) === 1,
    "C2 the moved row attributes to the temporary workspace");

  // click the ROW (not the stage chip) — the inner open button that owns
  // the row's click affordance
  await spot()
    .locator("button")
    .filter({ has: p.locator(`[data-row-ws="${OVERFLOW_WS}"]`) })
    .first()
    .click();
  await sleep(700);
  must(await ensureView("canvas"), "C3 row click navigates to the canvas");
  const activeLabel = await p.locator('[aria-label="Active workspace"]').textContent();
  must((activeLabel ?? "").includes(OVERFLOW_WS),
    `C4 canvas switched to the job's workspace (active = "${(activeLabel ?? "").trim()}")`);
  must((await p.locator(`[data-job="${mover.id}"]`).count()) === 1,
    "C5 the deep-linked card actually exists on the canvas (no invisible landing)");
}

/* ---------------- segment 3: teardown + console hygiene ---------------- */
await relaunch();
await p.goto(BASE, { waitUntil: "domcontentloaded" });

console.log("Phase D — cleanup + console hygiene");
{
  const back = await api(`/api/jobs/${mover.id}`, { body: { workspaceId: defaultWs.id } });
  must(back.status === 200, "D0 mover returned to the default workspace");
  const del = await api(`/api/workspaces/${ws2Id}`, { method: "DELETE" });
  must(del.status === 200 && del.json.ok === true, "D1 temporary workspace deleted (job already moved back)");
  await reloadToDashboard();
  await waitForDom(
    (a) => document.querySelectorAll(`[data-row-ws="${a.name}"]`).length === a.n,
    { name: OVERFLOW_WS, n: 0 },
  );
  must((await spot().locator(`[data-row-ws="${OVERFLOW_WS}"]`).count()) === 0, "D2 no stale Overflow attribution");
  must((await spot().locator("[data-row-orphan]").count()) === 0,
    "D3 orphan count back to zero (the specimen was this suite's — Z takes it home)");

  must(consoleErrors.length === 0, `D4 console clean (${consoleErrors.length} errors)`);
  if (consoleErrors.length) console.log("   errors:", consoleErrors.slice(0, 5));
}

await b.close();

/* ---------------- Phase Z: the specimen goes home ---------------- */
console.log("Phase Z — take the specimen home (t629 lifecycle)");
{
  // sweep every QA-named job through the product door (normally exactly
  // the adopted specimen; a crash-mid-B world may still carry it
  // un-adopted — the sweep is name-based, not id-based)
  let removed = 0;
  let world = (await api("/api/jobs")).json.jobs ?? [];
  const targets = world.filter((j) => j.name === SPECIMEN_NAME);
  for (const t of targets) {
    const del = await api(`/api/jobs/${t.id}`, { method: "DELETE" });
    must(del.status === 200, `Z1 specimen deleted through the product door (${t.id.slice(-6)})`);
    removed++;
  }
  must(removed === 1, `Z1b exactly one specimen taken home (${removed})`);
  world = (await api("/api/jobs")).json.jobs ?? [];
  must(world.length === ambientBaseline,
    `Z2 roster back to the ambient baseline — zero qa77 litter of any run (${world.length}/${ambientBaseline})`);
  must(world.every((j) => j.name !== SPECIMEN_NAME), "Z3 no specimen rows remain");
  must(world.filter((j) => !j.workspaceId).length === 0, "Z4 zero orphans (the world's own state again)");
  const wsAfter = (await api("/api/workspaces")).json.workspaces ?? [];
  must(wsAfter.every((w) => w.name !== OVERFLOW_WS), "Z5 no QA Overflow workspace remains");
  // radius: the specimen never dispatched, so it must own NOTHING on
  // disk — zero new workdir directories, zero engine-state references
  const dirsNow = workdirDirs();
  must(JSON.stringify(dirsNow) === JSON.stringify(workdirSnapshot),
    `Z6 zero new workdir directories (${workdirSnapshot.length} before = ${dirsNow.length} after)`);
  must(!stateMentions(specimen?.id ?? SPECIMEN_NAME), "Z7 zero engine-state references to the specimen");
  const mix = {};
  for (const j of world) mix[j.status] = (mix[j.status] ?? 0) + 1;
  console.log(`  (z) world restored: ${world.length} jobs — ${JSON.stringify(mix)}`);
}

console.log(fail === 0 ? "\nqa77 ALL PASS" : `\nqa77 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
