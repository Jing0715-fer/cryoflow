// t149 — Task 149: the digest roster becomes a directory of doors.
//
// Task 146 ruled "a digest is a summary, not a door" — the digest as a
// WHOLE has no single destination, so it carries no View bridge. Task
// 149 completes the doctrine instead of reversing it: each roster LINE
// names exactly one job, so a line click has exactly ONE destination —
// every line is its own door. The summary is the foyer with the
// directory. The "… and N more" tail is a census line, not a name —
// it stays inert.
//   - roster lines are <button>s inside their span.block wrappers (the
//     t146/t147 probes' span.block roster contract survives verbatim)
//   - each button: aria-label "Open <name>", hover tint, pressed state,
//     focus-visible ring that follows the toast variant (destructive
//     digest doors glow white on rose)
//   - announceNavigate is the SHARED destination resolver for the View
//     bridge AND every roster line — and the door opens into the RIGHT
//     world: a finisher in workspace B announced while the user sits in
//     A switches the lens before opening the inspector.
//
// Phase S — purge residue, roster snapshot, keeper runner (MAIN),
//           workspace B via API, client reload (t143 lesson), source
//           oracle: the bridge and the doors share announceNavigate.
// Phase B — digest doors: flip 2 MAIN runners atomically → "2 completed";
//           both lines are buttons with "Open <name>" labels; NO View
//           bridge on the digest (doctrine preserved); clicking line 1
//           lands the inspector on its job.
// Phase C — the door into the NEXT-DOOR world: "T149 Else" runs in
//           workspace B, "T149 Stay" in MAIN; one atomic flip → one
//           digest naming both; clicking the Else line switches the
//           active workspace to B and opens Else's inspector; the lens
//           switches back to MAIN explicitly afterwards.
// Phase D — alarm keeps its doors: mixed digest (1 failed) is
//           destructive and its failed line STILL navigates — the failed
//           card is where you would want to go MOST.
// Phase E — the cap keeps its doors: 10 finishers → 8 line buttons + an
//           INERT tail (span with no button inside); a recited line
//           still navigates; the tail is census, not a gate.
// Phase F — the light half speaks the same law: 2 pending → running
//           kickoffs → "2 auto-started" digest whose lines also open
//           their job's inspector.
// Phase G — screenshot.
// Phase Z — console clean (seeded /log 404 radius), purge, roster +
//           workspaces restored.
//
// Run: node scripts/t149-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t149-shot";
const WS_NAME = "T149 Next Door";
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

/** Stamp ONE job straight into the DB (t145 precedent). A "running"
 *  stamp MUST carry a fresh startedAt — the grace-window ticket. */
const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

/** ATOMIC bulk stamp: prisma $transaction over updateMany ops — a
 *  single commit, so a poll GET either sees ALL of the flip or NONE of
 *  it (the half-flipped middle would split one digest into two). */
const stampAtomic = (ops) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$transaction(${JSON.stringify(ops)}.map(o=>p.job.updateMany(o))).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

/** prisma-side purge — the strongest cleanup form (t146/t148
 *  precedent): no API guards, no fetch races, deletes the workspace by
 *  name too (a previous FAIL's cleanup never completed — clean it). */
const purgeT149 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();(async()=>{const j=await p.job.deleteMany({where:{name:{startsWith:"T149"}}});const w=await p.workspace.deleteMany({where:{name:"${WS_NAME}"}});console.log("purged jobs",j.count,"workspaces",w.count);await p.$disconnect();})()'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
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

const TOAST = 'ol > li[data-state="open"]';
const TRIGGER = '[aria-label="Active workspace"]';

/** wait for a toast whose text matches `frag` — the poll fires on a
 *  1.2s cadence while runners live; 12s of patient 250ms sampling. */
const waitForToast = async (frag, tries = 48) => {
  for (let i = 0; i < tries; i++) {
    const loc = p.locator(TOAST, { hasText: frag });
    if ((await loc.count()) > 0) return loc.first();
    await sleep(250);
  }
  return null;
};

/** seed a runner in one pass, fresh startedAt = ageMs ago (inside the
 *  120s reconcile grace window). workspaceId routes the job into a
 *  non-active workspace (the next-door world). */
const seedRunner = async (name, type, ageMs, workspaceId) => {
  const body = { type, name, x: 140, y: (await roster()).reduce((m, j) => Math.max(m, j.y ?? 0), 0) + 240 };
  if (workspaceId) body.workspaceId = workspaceId;
  const created = await (await api("/api/jobs", "POST", body)).json();
  const j = created?.job ?? created;
  must(!!j?.id, `${name}: created (${type}${workspaceId ? ", next door" : ""})`);
  seededIds.push(j.id);
  stampEx(j.id, { status: "running", progress: 50, startedAt: new Date(Date.now() - ageMs).toISOString() });
  return { id: j.id, name };
};

/** the transition-premise step (t146/t147/t148 lesson): after seeding,
 *  sleep one poll cycle so the client SEES the seeded state before the
 *  atomic flip — the sweep announces transitions, never states. */
const letClientSee = () => sleep(1600);

const openMenuAndFind = async (name) => {
  await p.locator(TRIGGER).click({ timeout: 6000 });
  await sleep(500);
  const item = p.locator('[role="option"]', { hasText: name }).first();
  await item.waitFor({ timeout: 6000 });
  return item;
};

/** the inspector dialog for a named job, awaited */
const dialogFor = async (name) => {
  const dlg = p.locator('[role="dialog"]', { hasText: name });
  await dlg.waitFor({ timeout: 8000 });
  return dlg;
};

const escDialog = async () => { await p.keyboard.press("Escape"); await sleep(500); };

async function main() {
  /* ---------------- Phase S — clean world, snapshot, keeper, B ---------- */
  step("--- Phase S: purge + roster snapshot + keeper + workspace B ---");
  purgeT149();
  const rosterBefore = (await roster()).length;
  const wsBefore = ((await (await api("/api/workspaces")).json())?.workspaces ?? []).length;
  // keeper runner in the ACTIVE workspace holds the 1.2s poll cadence
  // (t146/t147/t148 lesson — an idle world drops to 6s and every
  // "stamp then wait one cycle" step outruns the news)
  const keeper = await seedRunner("T149 Keeper", "motioncorr", 20_000);
  const created = await (await api("/api/workspaces", "POST", { name: WS_NAME })).json();
  const wsB = created?.workspace?.id ?? created?.id ?? null;
  must(!!wsB, "S: workspace B created via API");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  // reload so the client's workspace list includes the API-created B
  // (t143 lesson: load-time lists don't grow by themselves)
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase X — source oracle: one door-hinge -------------- */
  step("--- Phase X: source oracle — bridge and doors share announceNavigate ---");
  const src = execSync("cat src/lib/store.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/const announceNavigate = \(get: \(\) => WorkflowState, jobId: string\)/.test(src),
    "oracle: announceNavigate exists as the shared destination resolver");
  must(/onClick: \(\) => announceNavigate\(get, jobId\)/.test(src),
    "oracle: the View bridge delegates to announceNavigate (one door-hinge)");
  must(/"aria-label": `Open \$\{job\.name\}`/.test(src),
    "oracle: roster line buttons announce their door by name");

  /* ---------------- Phase B — digest doors ------------------------------- */
  step("--- Phase B: 2 finishers → digest whose lines are doors ---");
  const da = await seedRunner("T149 DA", "import", 38_000);
  const db = await seedRunner("T149 DB", "import", 38_000);
  await letClientSee();
  stampAtomic([
    { where: { id: da.id }, data: { status: "completed", progress: 100 } },
    { where: { id: db.id }, data: { status: "completed", progress: 100 } },
  ]);
  const digestB = await waitForToast("2 completed");
  must(!!digestB, 'digest toast with title "2 completed" appeared');
  const bLines = digestB.locator("span.block");
  must((await bLines.count()) === 2, `digest roster has exactly 2 lines (got ${await bLines.count()})`);
  const bBtn0 = digestB.getByRole("button", { name: "Open T149 DA" });
  const bBtn1 = digestB.getByRole("button", { name: "Open T149 DB" });
  must((await bBtn0.count()) === 1, "line 1 is a door (button, aria-label Open T149 DA)");
  must((await bBtn1.count()) === 1, "line 2 is a door (button, aria-label Open T149 DB)");
  must((await digestB.getByRole("button", { name: "View" }).count()) === 0,
    "digest still carries NO View bridge (the summary has no single door)");
  const bCls = (await digestB.getAttribute("class")) ?? "";
  must(!/destructive/.test(bCls), "all-completed digest is NOT destructive");
  await bBtn0.click();
  await dialogFor("T149 DA");
  must(true, "clicking line 1 lands the inspector on T149 DA");
  await escDialog();

  /* ---------------- Phase C — the door into the next-door world ---------- */
  step("--- Phase C: a next-door finisher's line switches the lens first ---");
  const stay = await seedRunner("T149 Stay", "motioncorr", 30_000);
  const els = await seedRunner("T149 Else", "ctffind", 30_000, wsB);
  await letClientSee();
  stampAtomic([
    { where: { id: stay.id }, data: { status: "completed", progress: 100 } },
    { where: { id: els.id }, data: { status: "completed", progress: 100 } },
  ]);
  // B and C digests share the census title "2 completed" — anchor the
  // wait on C's UNIQUE roster line (the next-door name), then assert
  // the census title on the toast actually found
  const digestC = await waitForToast("T149 Else");
  must(!!digestC, "digest appeared naming both worlds' finishers");
  must((((await digestC.textContent()) ?? "").trim()).startsWith("2 completed"),
    "digest title reads the census count (2 completed)");
  const cBtnElse = digestC.getByRole("button", { name: "Open T149 Else" });
  must((await cBtnElse.count()) === 1, "the next-door line is a door too");
  must(((await p.locator(TRIGGER).textContent()) ?? "").includes("Main"),
    "precondition: the lens sits on Main before the click");
  await cBtnElse.click();
  await dialogFor("T149 Else");
  must(true, "clicking the next-door line opens T149 Else's inspector");
  await sleep(600);
  must(((await p.locator(TRIGGER).textContent()) ?? "").includes(WS_NAME.replace("T149 ", "")),
    "the lens switched to the next-door workspace (the door opens into the RIGHT world)");
  await escDialog();
  // switch the lens back to Main so the later phases are deterministic
  await (await openMenuAndFind("Main")).click();
  await sleep(600);
  must(((await p.locator(TRIGGER).textContent()) ?? "").includes("Main"),
    "lens back on Main (deterministic ground for the later phases)");

  /* ---------------- Phase D — alarm keeps its doors ----------------------- */
  step("--- Phase D: destructive digest — the failed line still navigates ---");
  const ma = await seedRunner("T149 MA", "import", 41_000);
  const mf = await seedRunner("T149 MF", "ctffind", 41_000);
  await letClientSee();
  stampAtomic([
    { where: { id: ma.id }, data: { status: "completed", progress: 100 } },
    { where: { id: mf.id }, data: { status: "failed", progress: 0 } },
  ]);
  const digestD = await waitForToast("1 failed");
  must(!!digestD, 'mixed digest "1 failed" appeared');
  const dCls = (await digestD.getAttribute("class")) ?? "";
  must(/destructive/.test(dCls), "mixed digest carries the destructive variant (alarm outranks alive)");
  const dBtnFail = digestD.getByRole("button", { name: "Open T149 MF" });
  must((await dBtnFail.count()) === 1, "the failed line is a door (button, aria-label Open T149 MF)");
  await dBtnFail.click();
  await dialogFor("T149 MF");
  must(true, "clicking the failed line lands the inspector on T149 MF (alarm doesn't revoke the door)");
  await escDialog();

  /* ---------------- Phase E — the cap keeps its doors --------------------- */
  step("--- Phase E: ten finishers → 8 doors + one INERT census tail ---");
  const ten = [];
  for (let i = 1; i <= 10; i++) {
    ten.push(await seedRunner(`T149 R${String(i).padStart(2, "0")}`, "import", 35_000));
  }
  await letClientSee();
  stampAtomic(ten.map(({ id }) => ({ where: { id }, data: { status: "completed", progress: 100 } })));
  const digestE = await waitForToast("10 completed");
  must(!!digestE, 'digest title counts the whole batch ("10 completed")');
  const eLines = digestE.locator("span.block");
  must((await eLines.count()) === 9, `roster capped: 8 lines + 1 remainder line (got ${await eLines.count()})`);
  let doorCount = 0;
  for (let i = 0; i < 9; i++) {
    if ((await eLines.nth(i).locator("button").count()) === 1) doorCount++;
  }
  must(doorCount === 8, `exactly 8 lines are doors (got ${doorCount})`);
  const eTailText = ((await eLines.nth(8).textContent()) ?? "").trim();
  must(eTailText === "… and 2 more", `the tail counts instead of reciting ("${eTailText}")`);
  must((await eLines.nth(8).locator("button").count()) === 0,
    "the tail is INERT — a census line, not a gate (no button inside)");
  await digestE.getByRole("button", { name: "Open T149 R01" }).click();
  await dialogFor("T149 R01");
  must(true, "a recited line still navigates past the cap (T149 R01)");
  await escDialog();

  /* ---------------- Phase F — the light half speaks the same law ---------- */
  step("--- Phase F: kickoff digest lines are doors too ---");
  const ka = await (await api("/api/jobs", "POST", { type: "import", name: "T149 KA", x: 140, y: 900 })).json();
  const kb = await (await api("/api/jobs", "POST", { type: "import", name: "T149 KB", x: 140, y: 1140 })).json();
  const kaId = (ka?.job ?? ka)?.id;
  const kbId = (kb?.job ?? kb)?.id;
  must(!!kaId && !!kbId, "F: two kickoff jobs created");
  seededIds.push(kaId, kbId);
  // POST lands idle — stamp pending, let the client SEE it, then flip
  // running (the sweep announces transitions, never states)
  stampAtomic([
    { where: { id: kaId }, data: { status: "pending", progress: 0 } },
    { where: { id: kbId }, data: { status: "pending", progress: 0 } },
  ]);
  await letClientSee();
  stampAtomic([
    { where: { id: kaId }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } },
    { where: { id: kbId }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } },
  ]);
  const digestF = await waitForToast("2 auto-started");
  must(!!digestF, 'kickoff digest "2 auto-started" appeared');
  const fLines = digestF.locator("span.block");
  must((await fLines.count()) === 2, `kickoff roster has exactly 2 lines (got ${await fLines.count()})`);
  must((await digestF.getByRole("button", { name: "Open T149 KB" }).count()) === 1,
    "the kickoff line is a door (the light half obeys the same law)");
  await digestF.getByRole("button", { name: "Open T149 KB" }).click();
  await dialogFor("T149 KB");
  must(true, "clicking a kickoff line lands the inspector on T149 KB");
  await escDialog();

  /* ---------------- Phase G — screenshot ---------------------------------- */
  step("--- Phase G: screenshot the digest with its doors ---");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t149-roster-doors.png` });
  must(true, "screenshot recorded");

  /* ---------------- Phase Z — console + cleanup --------------------------- */
  step("--- Phase Z: console + cleanup ---");
  // Tolerance with a radius (t145 pattern): opening a seeded job's
  // inspector fetches /log?full=1 → 404 (probe-seeded rows have no log).
  // The radius matches the PATH (any query string), nothing else.
  const seedIds = [...seededIds];
  const tol = (line) => {
    const url = line.split(" ").slice(1).join(" ");
    if (!seedIds.some((id) => url.startsWith(`${BASE}/api/jobs/${id}/log`))) return true;
    return !line.startsWith("404");
  };
  const intolerable = badResponses.filter(tol);
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")})` : "no intolerable 4xx/5xx (seeded /log 404 tolerance held its radius)");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  // The browser's network layer echoes every non-2xx as a generic
  // console error with NO url — the radius lives on the network log
  // (already asserted: every 404 there is a seeded /log). The console
  // side tolerates the generic echo only while its count stays
  // accountable to those tolerated responses.
  const isGeneric404 = (t) => /Failed to load resource.*404/.test(t);
  const gen404N = consoleErrors.filter(isGeneric404).length;
  const log404N = badResponses.filter((l) => l.startsWith("404")).length;
  must(gen404N <= log404N,
    `generic 404 echoes accountable to the seeded /log radius (${gen404N} <= ${log404N})`);
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t) && !isGeneric404(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");

  await p.close(); p = null;
  await b.close(); b = null;
  purgeT149();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);
  const wsAfter = ((await (await api("/api/workspaces")).json())?.workspaces ?? []).length;
  must(wsAfter === wsBefore, `workspaces restored (${wsAfter} == ${wsBefore})`);

  console.log(`\nT149 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
