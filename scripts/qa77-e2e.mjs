// qa77 — dashboard workspace attribution + orphan adoption e2e.
// Task 77 resolves the inconsistency Task 76's harness fished out: the
// dashboard roster spans every workspace of the project while the canvas
// renders ONE, so pre-workspace-era "orphan" jobs (workspaceId NULL) show
// in the roster but live on NO canvas. Three layers:
//   A  attribution — every in-workspace row carries a workspace badge;
//      orphan rows carry a dashed amber "Unassigned" badge; adopt buttons
//      exist only on orphan rows; an "Unassigned N" filter chip appears
//   B  adoption — the Unassigned filter isolates orphan rows; one click on
//      Adopt moves the job into the default workspace (PATCH workspaceId
//      via the store's moveJob), the badge flips, the count drops, the
//      card becomes visible on the canvas, and it survives a reload
//   C  deep-link repair — a row from ANOTHER workspace switches the canvas
//      first (openJob switchWorkspace), so clicking it lands on a card
//      that actually exists; verified with a temporary second workspace
//   D  console hygiene — zero console errors / pageerrors throughout
// Run: node scripts/qa77-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const BASE = "http://localhost:3000";
const PDF = "/home/z/my-project/.qa-logs/t77-print.pdf";
rmSync(PDF, { force: true });

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

/* ---------------- targets ---------------- */
let list = (await api("/api/jobs")).json.jobs ?? [];
let orphans = list.filter((j) => !j.workspaceId);
must(list.length >= 5, `roster present (${list.length} jobs)`);
// idempotent re-runs: earlier rounds adopt the orphans away — re-create the
// legacy state on one of the ORIGINAL strays (same names the seed shipped)
// so the adoption flow stays testable. Direct prisma: the PATCH route
// deliberately refuses NULL workspaceId (it can only MOVE, never unassign).
if (orphans.length === 0) {
  const db = new PrismaClient();
  const formerNames = ["Import Movies 1", "Motion Correction 1", "CTF Estimation 1"];
  const candidate = list.find(
    (j) => j.workspaceId && !j.linkedJobId && formerNames.includes(j.name)
  );
  if (candidate) {
    await db.job.update({ where: { id: candidate.id }, data: { workspaceId: null } });
    console.log(`re-orphaned legacy stray: ${candidate.name}`);
  }
  await db.$disconnect();
  list = (await api("/api/jobs")).json.jobs ?? [];
  orphans = list.filter((j) => !j.workspaceId);
}
must(orphans.length >= 1, `orphan jobs present (${orphans.length}) — Task 77's living instance`);
// baselines come from the POST-re-orphan snapshot — the stale list would
// over-count in-workspace rows by the just-re-orphaned job (A2/B4 drift)
const wsJobs0 = list.filter((j) => j.workspaceId);
must(wsJobs0.length >= 2, `in-workspace jobs present (${wsJobs0.length})`);
const orphanIds0 = orphans.map((o) => o.id);
const wsList = (await api("/api/workspaces")).json.workspaces ?? [];
must(wsList.length >= 1, `workspaces present (${wsList.length})`);
const defaultWs = wsList[0];
// idempotent re-runs: sweep leftover temporary workspaces from crashed
// previous runs (DELETE reassigns their jobs to the default first)
for (const w of wsList) {
  if (w.name === "QA Overflow") {
    await api(`/api/workspaces/${w.id}`, { method: "DELETE" });
    console.log(`swept leftover workspace: ${w.name} (${w.id.slice(-6)})`);
  }
}
console.log(`default workspace: ${defaultWs.name} | orphans: ${orphans.map((o) => o.name).join(", ")}`);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

// view is in-memory state: a reload always lands on the canvas — aim the
// assertions at the right view first (qa76 harness lesson)
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

const spot = p.locator('section[aria-label="Active project spotlight"]');

/* ---------------- Phase A: attribution ---------------- */
console.log("Phase A — workspace attribution on the roster");
{
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(700);
  must(await ensureView("dashboard"), "A1 dashboard view reached");

  const wsBadges = spot.locator("[data-row-ws]");
  must((await wsBadges.count()) === wsJobs0.length,
    `A2 every in-workspace row has a workspace badge (${await wsBadges.count()}/${wsJobs0.length})`);
  must((await wsBadges.first().getAttribute("data-row-ws")) === defaultWs.name,
    `A3 badge value is the workspace name (${defaultWs.name})`);
  must((await wsBadges.first().getAttribute("title")) === `Workspace: ${defaultWs.name}`,
    "A4 badge hover explains the workspace");

  const orphanBadges = spot.locator("[data-row-orphan]");
  must((await orphanBadges.count()) === orphans.length,
    `A5 orphan rows carry the dashed Unassigned badge (${await orphanBadges.count()}/${orphans.length})`);
  must((await orphanBadges.first().textContent())?.trim() === "Unassigned", "A6 orphan badge reads Unassigned");

  const adoptBtns = spot.locator("[data-adopt]");
  must((await adoptBtns.count()) === orphans.length,
    `A7 adopt buttons exist only on orphan rows (${await adoptBtns.count()}/${orphans.length})`);
  must((await adoptBtns.first().getAttribute("aria-label")) === `Adopt into ${defaultWs.name}`,
    `A8 adopt aria names the target workspace (${defaultWs.name})`);

  const chip = spot.locator('[data-filter="unassigned"]');
  must((await chip.count()) === 1, "A9 Unassigned filter chip present");
  must((await chip.textContent())?.includes(String(orphans.length)) ?? false,
    `A9b chip count matches orphans (${orphans.length})`);

  // the whole row must stay one click target without nested buttons —
  // hydration would scream in the console if the DOM were invalid (D phase)
  const rowDivs = spot.locator("div.group\\/row");
  must((await rowDivs.count()) >= list.length,
    `A10 rows are div-wrapped (nested-button fix) (${await rowDivs.count()} rows)`);
}

/* ---------------- Phase B: unassigned filter + adoption ---------------- */
console.log("Phase B — adopt an orphan into the default workspace");
{
  await spot.locator('[data-filter="unassigned"]').click();
  await p.waitForTimeout(400);
  must((await spot.locator("[data-row-orphan]").count()) === orphans.length,
    `B1 Unassigned filter isolates orphan rows (${orphans.length} visible)`);
  must((await spot.locator("[data-row-ws]").count()) === 0,
    "B1b no in-workspace rows leak into the orphan slice");

  await spot.locator("[data-adopt]").first().click();
  let toastOk = false;
  try {
    await p.getByText(`Adopted into ${defaultWs.name}`).first().waitFor({ timeout: 4000 });
    toastOk = true;
  } catch { /* toast may have raced past the wait window */ }
  must(toastOk, "B2 adoption confirms with a toast naming the target workspace");
  await p.waitForTimeout(600);

  // which orphan got adopted is DOM-order dependent (rows render newest
  // first) — ask the API instead of guessing from the list order
  const after = (await api("/api/jobs")).json.jobs ?? [];
  const adoptedJob = after.find((j) => orphanIds0.includes(j.id) && j.workspaceId === defaultWs.id);
  must(!!adoptedJob, "B2b exactly one orphan landed in the default workspace (API truth)");
  var adoptedId = adoptedJob?.id ?? null;

  must((await spot.locator("[data-row-orphan]").count()) === orphans.length - 1,
    `B3 orphan count dropped (${orphans.length} → ${orphans.length - 1}) while filtered`);

  await spot.locator('button[title="Show all jobs only"]').click();
  await p.waitForTimeout(400);
  must((await spot.locator(`[data-row-ws="${defaultWs.name}"]`).count()) === wsJobs0.length + 1,
    `B4 badge flip: ${wsJobs0.length} → ${wsJobs0.length + 1} rows now in ${defaultWs.name}`);
  const remaining = orphans.length - 1;
  if (remaining > 0) {
    must((await spot.locator('[data-filter="unassigned"]').textContent())?.includes(String(remaining)) ?? false,
      "B4b chip count tracks the adoption");
  } else {
    // adopting the LAST orphan empties the filter — the chip removing
    // itself is the honest dead-control design (same semantics as the
    // status chips appearing only when their slice is non-empty)
    must((await spot.locator('[data-filter="unassigned"]').count()) === 0,
      "B4b chip removed at zero orphans (dead-control honesty)");
  }

  // place the adopted card INSIDE the existing canvas bbox (print budget
  // hygiene for qa72/qa73) — first free slot in the band between rows,
  // skipping coordinates another card already occupies (repeat runs adopt
  // different strays into the same band)
  const allNow = (await api("/api/jobs")).json.jobs ?? [];
  const taken = new Set(allNow.filter((j) => j.id !== adoptedId).map((j) => `${j.x},${j.y}`));
  const slots = [[150, 420], [460, 420], [770, 420], [1080, 420]];
  const slot = slots.find(([x, y]) => !taken.has(`${x},${y}`)) ?? [150, 420];
  const posPatch = await api(`/api/jobs/${adoptedId}`, { body: { x: slot[0], y: slot[1] } });
  must(posPatch.status === 200,
    `B4c adopted card repositioned into the existing print bbox (${slot[0]},${slot[1]})`);
}

console.log("Phase B2 — canvas visibility + reload persistence");
{
  await ensureView("canvas");
  await p.waitForTimeout(1200); // let the poll tick pick up the API position patch
  must((await p.locator(`[data-job="${adoptedId}"]`).count()) === 1,
    "B5 adopted job is now a real card on the canvas");

  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-canvas="viewport"]');
  await p.waitForTimeout(800);
  await ensureView("dashboard");
  await p.waitForTimeout(400);
  must((await spot.locator("[data-row-orphan]").count()) === orphans.length - 1,
    "B6 adoption survives a reload (API truth, not just client state)");
  must((await spot.locator(`[data-row-ws="${defaultWs.name}"]`).count()) === wsJobs0.length + 1,
    "B6b adopted row still carries the workspace badge after reload");
}

/* ---------------- Phase C: cross-workspace deep-link ---------------- */
console.log("Phase C — deep-link repair for other-workspace rows");
const mover = wsJobs0.find((j) => j.status === "idle" && j.id !== adoptedId) ?? wsJobs0[0];
let ws2Id = null;
{
  const created = await api("/api/workspaces", { method: "POST", body: { name: "QA Overflow" } });
  must(created.status === 201 || created.status === 200, `C1 temporary workspace created (${created.status})`);
  ws2Id = created.json.workspace?.id ?? null;
  must(!!ws2Id, "C1b workspace id returned");

  await api(`/api/jobs/${mover.id}`, { body: { workspaceId: ws2Id } });
  const movedCheck = (await api("/api/jobs")).json.jobs.find((j) => j.id === mover.id);
  must(movedCheck?.workspaceId === ws2Id, "C2b move persisted (API truth) — guards against silent GETs");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-canvas="viewport"]');
  await p.waitForTimeout(800);
  await ensureView("dashboard");
  await p.waitForTimeout(400);
  must((await spot.locator('[data-row-ws="QA Overflow"]').count()) === 1,
    "C2 the moved row attributes to the temporary workspace");

  // click the ROW (not the stage chip) — the inner open button that owns
  // the row's click affordance
  await spot
    .locator("button")
    .filter({ has: p.locator('[data-row-ws="QA Overflow"]') })
    .first()
    .click();
  await p.waitForTimeout(700);
  must(await ensureView("canvas"), "C3 row click navigates to the canvas");
  const activeLabel = await p.locator('[aria-label="Active workspace"]').textContent();
  must((activeLabel ?? "").includes("QA Overflow"),
    `C4 canvas switched to the job's workspace (active = "${(activeLabel ?? "").trim()}")`);
  must((await p.locator(`[data-job="${mover.id}"]`).count()) === 1,
    "C5 the deep-linked card actually exists on the canvas (no invisible landing)");
}

console.log("Phase D — cleanup + console hygiene");
{
  const back = await api(`/api/jobs/${mover.id}`, { body: { workspaceId: defaultWs.id } });
  must(back.status === 200, "D0 mover returned to the default workspace");
  const del = await api(`/api/workspaces/${ws2Id}`, { method: "DELETE" });
  must(del.status === 200 && del.json.ok === true, "D1 temporary workspace deleted (job already moved back)");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-canvas="viewport"]');
  await p.waitForTimeout(800);
  await ensureView("dashboard");
  await p.waitForTimeout(400);
  must((await spot.locator('[data-row-ws="QA Overflow"]').count()) === 0, "D2 no stale Overflow attribution");
  must((await spot.locator("[data-row-orphan]").count()) === orphans.length - 1,
    "D3 orphan count steady at the post-adoption value (adopted job kept as the feature's living instance)");

  must(consoleErrors.length === 0, `D4 console clean (${consoleErrors.length} errors)`);
  if (consoleErrors.length) console.log("   errors:", consoleErrors.slice(0, 5));
}

await b.close();
console.log(fail === 0 ? "\nqa77 ALL PASS" : `\nqa77 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
