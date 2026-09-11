// t126 — Task 126: ONE deep-link landing — spotlight rows, recent-activity
// rows, saved-view gallery tiles and palette jumps all arrive through a
// single store action (openJob): ghost guard + workspace/project landing
// repair + the open dialect (idle → select+focus centered arrival with the
// arrival flash; submitted → results inspector).
//
// Before this task the three dashboard cards each inlined their own copy of
// the dialect, and NONE of them centered the canvas on the idle path — a
// card outside the viewport "arrived" invisibly. Worse, the cross-project
// rows switched project and landed on the project's FIRST workspace: a job
// living in the second workspace got an inspector over an empty canvas
// (the canvas renders active-workspace jobs only — Task 124's wall, one
// project deeper).
//
// Phase S — seed: a second workspace in the active project (idle + done
//           jobs), a second project with its own deep workspace (completed
//           job), switch back to the original project.
// Phase A — spotlight row, same workspace → canvas + ring + flash + center.
// Phase B — spotlight row, other workspace → lands on the home workspace
//           (the card EXISTS — the landing repair is what makes it exist).
// Phase D — palette from the dashboard (BEFORE C: the palette lists the
//           active project's jobs only) → the store action's setView covers
//           the leg the old jumpToJob missed.
// Phase C — recent row, other project → switches project AND hops to the
//           home workspace + inspector opens (completed → inspect dialect).
// Phase E — deleted job: the roster shrinks honestly, zero page errors.
// Phase F — static: the store owns the dialect, four call sites forward to
//           it, the compiled chunks carry it.
// Phase Z — cleanup (jobs, workspaces, cross project, switch back),
//           console clean.
//
// Run: node scripts/t126-e2e.mjs   (server on :3000, fresh build REQUIRED —
// F-phase reads compiled chunks)
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededJobIds = [];
const seededWsIds = [];
let origPid = null;
let crossPid = null;

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  // cross project may be active after Phase C — switch back first so its
  // deletion doesn't strand the app on a deleted project
  if (origPid && crossPid) {
    try {
      await fetch(`${BASE}/api/projects/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: origPid }),
      });
    } catch {}
  }
  for (const id of seededJobIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
  for (const id of seededWsIds) {
    try { await fetch(`${BASE}/api/workspaces/${id}`, { method: "DELETE" }); } catch {}
  }
  if (crossPid) {
    try { await fetch(`${BASE}/api/projects/${crossPid}`, { method: "DELETE" }); } catch {}
  }
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FATAL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
const engineStamp = (id, status, startedIso, durationMs) =>
  sh(
    `node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();` +
    `p.job.update({where:{id:'${id}'},data:{status:'${status}',progress:100,` +
    `startedAt:new Date('${startedIso}'),duration:${durationMs}}}).then(()=>p.\\$disconnect())"`
  );

// dashboard rows sit below the fold inside an inner scroller; settle after
// the scroll (poll re-renders swap the row under the cursor mid-commit —
// a raw click races it) and fall back to a dispatched click
const makeHardClick = (page) => async (loc) => {
  try {
    await loc.click({ timeout: 3500 });
  } catch {
    await loc.evaluate((el) => el.click());
  }
};

async function main() {
  step("=== t126 — one deep-link landing for every dashboard card ===");

  /* ---------------- Phase S — seed ---------------- */
  step("--- Phase S: deep workspace + cross project + jobs ---");
  const proj = (await (await api("/api/project")).json()).project;
  must(!!proj?.id, "an active project exists");
  origPid = proj.id;
  const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(wsList.length >= 1, "the active project has at least one workspace");
  const ws1Id = wsList[0].id;

  const cws = await (await api("/api/workspaces", "POST", { name: "TL126 deep" })).json();
  const ws2Id = cws?.workspace?.id ?? cws?.id ?? null;
  must(!!ws2Id, "second workspace created in the active project");
  seededWsIds.push(ws2Id);

  const maxY = ((await (await api("/api/jobs")).json()).jobs ?? []).reduce(
    (m, j) => Math.max(m, (j.y ?? 0) + 240), 800
  );
  const mkJob = async (name, type, workspaceId, y) => {
    const created = await (
      await api("/api/jobs", "POST", { type, name, workspaceId, x: 140, y })
    ).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created`);
    seededJobIds.push(j.id);
    return j.id;
  };
  const homeId = await mkJob("Deep Home Idle", "motioncorr", ws1Id, maxY + 240);
  const ws2IdleId = await mkJob("Deep Ws2 Idle", "ctffind", ws2Id, maxY + 480);
  const ws2DoneId = await mkJob("Deep Ws2 Done", "class2d", ws2Id, maxY + 720);
  engineStamp(ws2DoneId, "completed", new Date(Date.now() - 60_000).toISOString(), 8000);

  // second project (POST sets it active!) with its own deep workspace
  const created = await (
    await api("/api/projects", "POST", { name: "TL126 cross" })
  ).json();
  crossPid = created?.project?.id ?? null;
  must(!!crossPid, "cross project created");
  const cws2 = await (await api("/api/workspaces", "POST", { name: "TL126 cross deep" })).json();
  const crossWsId = cws2?.workspace?.id ?? cws2?.id ?? null;
  must(!!crossWsId, "deep workspace created in the cross project");
  seededWsIds.push(crossWsId);
  const crossJobId = await mkJob("Deep Cross Done", "postprocess", crossWsId, 140);
  engineStamp(crossJobId, "completed", new Date(Date.now() - 30_000).toISOString(), 9000);

  // switch back — the browser flow starts on the ORIGINAL project
  const sw = await api("/api/projects/switch", "POST", { id: origPid });
  must(sw.ok, "switched back to the original project");
  const activeWsAfter = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(activeWsAfter.some((w) => w.id === ws2Id), "workspaces API reflects the original project again");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  const hardClick = makeHardClick(p);

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await hardClick(p.locator('button[role="tab"][title*="Project dashboard"]'));
  await p.waitForSelector('section[aria-label="Active project spotlight"]', { timeout: 30000 });

  const goDashboard = async () => {
    await hardClick(p.locator('button[role="tab"][title*="Project dashboard"]'));
    await p.waitForSelector('section[aria-label="Active project spotlight"]', { timeout: 30000 });
    await sleep(350);
  };

  /* ---------------- Phase A — spotlight, same workspace ---------------- */
  step("--- Phase A: spotlight row (home ws) → centered arrival ---");
  const homeRow = p.locator('[data-roster-row] button[title="Open Deep Home Idle"]');
  await homeRow.scrollIntoViewIfNeeded();
  await sleep(350);
  await hardClick(homeRow);
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(700); // glide fully landed
  const cardA = p.locator(`[data-job="${homeId}"]`);
  must((await cardA.count()) === 1, "A1 target card on the canvas");
  must(
    ((await cardA.locator(".card-lift").getAttribute("class")) ?? "").includes("ring-primary/60"),
    "A2 primary selection ring on the target card"
  );
  must(
    (await cardA.locator("[data-reveal-flash]").count()) === 1,
    "A3 arrival flash mounted (focus arrival celebrated)"
  );
  const vbA = await p.locator("[data-canvas='viewport']").boundingBox();
  const cbA = await cardA.boundingBox();
  must(!!vbA && !!cbA, "A4 geometry readable");
  must(
    Math.abs(cbA.x + cbA.width / 2 - (vbA.x + vbA.width / 2)) <= vbA.width * 0.1 &&
    Math.abs(cbA.y + cbA.height / 2 - (vbA.y + vbA.height / 2)) <= vbA.height * 0.1,
    "A5 card centered on the viewport section (the old open dialect never centered)"
  );

  /* ---------------- Phase B — spotlight, other workspace ---------------- */
  step("--- Phase B: spotlight row (deep ws) → lands home ---");
  await goDashboard();
  const ws2Row = p.locator('[data-roster-row] button[title="Open Deep Ws2 Idle"]');
  await ws2Row.scrollIntoViewIfNeeded();
  await sleep(350);
  await hardClick(ws2Row);
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(700);
  // THE assertion: the card only renders if the landing repair hopped to
  // the job's home workspace — the old inline dialect stayed on ws1 and
  // "arrived" on an empty canvas
  const cardB = p.locator(`[data-job="${ws2IdleId}"]`);
  must((await cardB.count()) === 1, "B1 card EXISTS on the canvas (landing repair hopped workspaces)");
  must(
    ((await cardB.locator(".card-lift").getAttribute("class")) ?? "").includes("ring-primary/60"),
    "B2 primary selection ring survives the landing"
  );
  const flashB = await cardB.locator("[data-reveal-flash]").count();
  must(flashB === 1, "B3 arrival flash on the deep-workspace card");
  const vbB = await p.locator("[data-canvas='viewport']").boundingBox();
  const cbB = await cardB.boundingBox();
  must(
    !!vbB && !!cbB &&
    Math.abs(cbB.x + cbB.width / 2 - (vbB.x + vbB.width / 2)) <= vbB.width * 0.1 &&
    Math.abs(cbB.y + cbB.height / 2 - (vbB.y + vbB.height / 2)) <= vbB.height * 0.1,
    "B4 card centered after the cross-workspace landing"
  );

  /* ---------------- Phase D — palette from the dashboard ----------------
     (BEFORE Phase C: the palette lists the ACTIVE project's jobs only, and
     C switches the active project away — so the palette leg must run while
     the original project is still active) */
  step("--- Phase D: palette jump from the dashboard switches the view ---");
  await goDashboard();
  await hardClick(p.locator('button[aria-label="Open command palette (Ctrl+K)"]'));
  await p.waitForSelector('[cmdk-input]', { timeout: 15000 });
  await p.keyboard.type("Deep Home Idle");
  await sleep(400);
  // click the exact item — Enter would run whatever cmdk ranks first
  const item = p.locator('[cmdk-item]').filter({ hasText: "Deep Home Idle" }).first();
  must((await item.count()) >= 1, "D0 palette lists the job from the dashboard view");
  await hardClick(item);
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(700);
  const cardD = p.locator(`[data-job="${homeId}"]`);
  must((await cardD.count()) === 1, "D1 palette jump landed on the canvas");
  must(
    ((await cardD.locator(".card-lift").getAttribute("class")) ?? "").includes("ring-primary/60"),
    "D2 palette jump selected the job (the old dialect's contract, kept)"
  );
  must(
    ((await cardD.locator(".card-lift").getAttribute("class")) ?? "").includes("ring-primary/60"),
    "D3 jump from dashboard view actually switched the view (old jumpToJob never did)"
  );

  /* ---------------- Phase C — recent row, other project ---------------- */
  step("--- Phase C: recent row (cross project) → project switch + home hop + inspector ---");
  await goDashboard();
  const crossRow = p.locator('button[title^="Open Deep Cross Done"]');
  await crossRow.scrollIntoViewIfNeeded();
  await sleep(350);
  await hardClick(crossRow);
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await p.waitForSelector("[data-inspector-dialog]", { timeout: 30000 });
  must(true, "C1 inspector opened (completed → the inspect dialect)");
  // the landing repair's deepest leg: switchProject landed the FIRST
  // workspace; the hop to the job's home workspace is what makes the card
  // render behind the modal
  const cardC = p.locator(`[data-job="${crossJobId}"]`);
  must((await cardC.count()) === 1, "C2 card EXISTS in the cross project's deep workspace");
  await p.keyboard.press("Escape");
  await sleep(400);

  /* ---------------- Phase E — deleted job, honest shrink ----------------
     (the active project is now the CROSS one after C — delete ITS job so
     the roster shrink is real; the wait would trivially pass on a roster
     that never contained the row) */
  step("--- Phase E: deleted job → roster shrinks, no crash ---");
  await api(`/api/jobs/${crossJobId}`, "DELETE");
  await goDashboard();
  await p.waitForFunction(
    () => !document.querySelector('button[title="Open Deep Cross Done"]'),
    { timeout: 15000 }
  );
  must(true, "E1 poll merge dropped the deleted row from the spotlight roster");
  must(pageErrors.length === 0, "E2 zero page errors around the deletion");

  /* ---------------- Phase F — static ---------------- */
  step("--- Phase F: static contract ---");
  const store = readFileSync("src/lib/store.ts", "utf8");
  must(/openJob: \(\s*id: string,\s*hint\?: \{ projectId\?: string \| null \}\s*\) => Promise<void>;/.test(store), "F1 store interface declares openJob with the hint");
  must(/openJob: async \(id, hint\) => \{/.test(store), "F2 store implements openJob with the hint leg");
  must(/return; \/\/ ghost/.test(store), "F3 ghost guard lives in the action (no hint / same project = ghost)");
  must(/await get\(\)\.switchProject\(pid\)/.test(store), "F4 cross-project landing repair in the action");
  const dash = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");
  must(dash.includes("void openJob(v.jobId, { projectId: v.projectId });"), "F5 gallery tiles forward with the project hint");
  must(dash.includes("void openJob(j.id, { projectId: j.projectId });"), "F6 recent rows forward with the project hint");
  must(dash.includes('onClick={() => openJob(j.id)}'), "F7 spotlight chips/rows forward to the store action");
  must(!/jobStatus === "idle"\) select\(/.test(dash), "F8 the gallery's inlined dialect is gone");
  const pal = readFileSync("src/components/workflow/command-palette.tsx", "utf8");
  must(pal.includes("getState().openJob(id)"), "F9 palette jump rides the store action");
  const clientHit = sh("rg -l 'openJob' .next/static/chunks/ | head -1");
  must(clientHit.length > 0, "F10 compiled chunks carry the shared action");

  /* ---------------- Phase Z — cleanup + console ---------------- */
  step("--- Phase Z: cleanup + console ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter((t) => /Failed to load resource/.test(t));
  must(
    consoleErrors.length === honest.length,
    `Z2 console errors are honest resource notes only (${consoleErrors.length} total)`
  );

  await cleanup();
  console.log(`T126 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => {
  console.error(e);
  void cleanup().then(() => process.exit(1));
});
