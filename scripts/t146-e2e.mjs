// t146 — Task 146: the batch speaks once — the avalanche digest.
//
// TOAST_LIMIT is 1, and the poll sweep's synchronous toast loop used to
// swallow every finisher but the LAST one whenever several became final
// in the same tick: N facts landed, N-1 were never spoken. Task 146
// makes the sweep collect first, announce after:
//   solo     one finisher keeps the FULL t145 announcement (fact title
//            + result + View bridge) — the previous contract, verbatim.
//   digest   several finishers → ONE digest toast:
//              title   census dialect "2 completed · 1 failed" (the
//                      glance layer says COUNTS — footer/tab dialect)
//              roster  one line per finisher in the very form its
//                      swallowed announcement would have had
//                      ("Name completed · 42s") — the reading layer
//                      says TIME; cap 8 lines + "… and N more"
//              variant destructive whenever the batch carries any
//                      failure (alarm outranks alive — favicon doctrine)
//              action  NO View bridge — a digest is a summary, not a
//                      door; results stay one click away on the card
//   auto-started notices still go out first (light news) and the digest
//   lands last, so the heavyweight news survives the limit.
//
// Phase S — pre-clean T146 rows, roster snapshot, seed the solo runner
//           AND a keeper runner that stays running all probe long: the
//           poll's anyActive gate drops to a 6s cadence in an idle
//           world, and a runner in the world keeps the 1.2s news cycle
//           alive (probe-premise fix: the sweep announces TRANSITIONS,
//           so every seeded runner must be SEEN running before it is
//           flipped — each phase sleeps one poll cycle after seeding).
// Phase B — solo finisher: full announcement (fact title + result +
//           View) — the t145 contract survives the refactor, verbatim.
// Phase C — ATOMIC bulk flip (one prisma updateMany, single SQL) of 2
//           runners → digest "2 completed": roster 2 lines, each line
//           "Name completed · Xs" wall-agreeing, NO View, not destructive.
// Phase D — atomic transaction flips 2 completed + 1 failed → digest
//           "2 completed · 1 failed", destructive variant, the failed
//           line carries its "failed" word, 3 roster lines.
// Phase E — late-seed 10 runners, atomic flip → digest "10 completed"
//           with the roster CAPPED: 8 lines + "… and 2 more" (9 spans).
// Phase F — the news flow is still alive after a digest: a later solo
//           flip replaces the digest (TOAST_LIMIT=1 normal semantics).
// Phase G — screenshot the digest.
// Phase Z — console clean, T146 rows deleted, roster restored.
//
// Run: node scripts/t146-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t146-shot";
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
 *  it (never the half-flipped middle that would split one digest into
 *  two announcements). This is the probe-side guarantee that the batch
 *  really lands in one tick. */
const stampAtomic = (ops) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$transaction(${JSON.stringify(ops)}.map(o=>p.job.updateMany(o))).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const deleteT146Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T146"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
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

const parseElapsed = (t) => {
  if (!t) return NaN;
  let m = /^(\d+)s$/.exec(t.trim());
  if (m) return +m[1];
  m = /^(\d+)m (\d{2})s$/.exec(t.trim());
  if (m) return +m[1] * 60 + +m[2];
  return NaN;
};

const TOAST = 'ol > li[data-state="open"]';

/** wait for a toast whose text matches `frag` — the poll fires on a
 *  1.2s cadence while runners live; 12s of patient 250ms sampling
 *  covers one slow cycle plus slack. */
const waitForToast = async (frag, tries = 48) => {
  for (let i = 0; i < tries; i++) {
    const loc = p.locator(TOAST, { hasText: frag });
    if ((await loc.count()) > 0) return loc.first();
    await sleep(250);
  }
  return null;
};

/** seed N runners in one pass, fresh startedAt = ageMs ago (inside the
 *  120s reconcile grace window), returns { id, name } list. */
const seedRunners = async (names, type, ageMs) => {
  const world = await roster();
  let y = world.reduce((m, j) => Math.max(m, j.y ?? 0), 0) + 240;
  const out = [];
  for (const name of names) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type})`);
    seededIds.push(j.id);
    stampEx(j.id, { status: "running", progress: 50, startedAt: new Date(Date.now() - ageMs).toISOString() });
    out.push({ id: j.id, name });
    y += 240;
  }
  return out;
};

async function main() {
  /* ---------------- Phase S — clean world, roster snapshot, solo seed --- */
  step("--- Phase S: world snapshot + solo seed + keeper ---");
  deleteT146Rows();
  const rosterBefore = (await roster()).length;
  const solo = await seedRunners(["T146 Solo"], "import", 65_000);
  must(solo.length === 1, "S: solo runner seeded");
  const keeper = await seedRunners(["T146 Keeper"], "motioncorr", 20_000);
  must(keeper.length === 1, "S: keeper runner seeded (keeps the 1.2s poll cadence alive)");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase B — solo finisher keeps the FULL announcement -- */
  step("--- Phase B: solo finisher → the t145 contract, verbatim ---");
  stampEx(solo[0].id, { status: "completed", progress: 100, result: "solo result text" });
  const soloToast = await waitForToast("T146 Solo completed");
  must(!!soloToast, "solo announcement appeared");
  const soloText = ((await soloToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  const mSolo = /^T146 Solo completed · 1m (\d{2})s/.exec(soloText);
  must(!!mSolo, `title speaks the fact dialect ("${soloText.slice(0, 50)}")`);
  const soloSec = 60 + +mSolo[1];
  must(soloSec >= 65 && soloSec <= 90, `elapsed wall-agrees (${soloSec}s ∈ [65..90])`);
  must(soloText.includes("solo result text"), "description carries the result text");
  must((await soloToast.getByRole("button", { name: "View" }).count()) === 1, "solo keeps the View bridge");

  /* ---------------- Phase C — atomic pair flip → digest "2 completed" --- */
  step("--- Phase C: two finishers in one tick → one digest toast ---");
  const cPair = await seedRunners(["T146 CA", "T146 CB"], "motioncorr", 38_000);
  await sleep(1600); // let one poll cycle SEE the seeded runners running —
  // the sweep announces transitions, never states (a flip the client
  // never saw running is a state, not news)
  stampAtomic(cPair.map(({ id }) => ({ where: { id }, data: { status: "completed", progress: 100 } })));
  const digestC = await waitForToast("2 completed");
  must(!!digestC, 'digest toast with title "2 completed" appeared');
  const cTitle = ((await digestC.textContent()) ?? "").trim();
  must(cTitle.startsWith("2 completed"), `digest opens with the census count ("${cTitle.slice(0, 30)}")`);
  const cLines = digestC.locator("span.block");
  must((await cLines.count()) === 2, `digest roster has exactly 2 lines (got ${await cLines.count()})`);
  const cLine0 = ((await cLines.nth(0).textContent()) ?? "").trim();
  const cLine1 = ((await cLines.nth(1).textContent()) ?? "").trim();
  const mC0 = /^T146 CA completed · (\d+)s$/.exec(cLine0);
  const mC1 = /^T146 CB completed · (\d+)s$/.exec(cLine1);
  must(!!mC0 && +mC0[1] >= 38 && +mC0[1] <= 60, `roster line 1 is the swallowed announcement verbatim ("${cLine0}")`);
  must(!!mC1 && +mC1[1] >= 38 && +mC1[1] <= 60, `roster line 2 is the swallowed announcement verbatim ("${cLine1}")`);
  must((await digestC.getByRole("button", { name: "View" }).count()) === 0, "digest carries NO View bridge (a summary, not a door)");
  const cCls = (await digestC.getAttribute("class")) ?? "";
  must(!/destructive/.test(cCls), "all-completed digest is NOT destructive");

  /* ---------------- Phase D — atomic mixed flip → census + alarm --------- */
  step("--- Phase D: 2 completed + 1 failed in one tick → destructive digest ---");
  const dTrip = await seedRunners(["T146 DA", "T146 DB", "T146 DF"], "ctffind", 41_000);
  await sleep(1600); // same premise: seen running first
  stampAtomic([
    { where: { id: { in: [dTrip[0].id, dTrip[1].id] } }, data: { status: "completed", progress: 100 } },
    { where: { id: dTrip[2].id }, data: { status: "failed", progress: 0 } },
  ]);
  const digestD = await waitForToast("2 completed · 1 failed");
  must(!!digestD, 'digest title reads the census dialect "2 completed · 1 failed"');
  const dLines = digestD.locator("span.block");
  must((await dLines.count()) === 3, `digest roster has exactly 3 lines (got ${await dLines.count()})`);
  const dLine2 = ((await dLines.nth(2).textContent()) ?? "").trim();
  must(/^T146 DF failed · \d+s$/.test(dLine2), `the failed line keeps its own fact ("${dLine2}")`);
  const dCls = (await digestD.getAttribute("class")) ?? "";
  must(/destructive/.test(dCls), "mixed digest carries the destructive variant (alarm outranks alive)");

  /* ---------------- Phase E — the roster cap: a roll call must be finishable -- */
  step("--- Phase E: ten finishers → 8 roster lines + '… and 2 more' ---");
  const eTen = await seedRunners(
    Array.from({ length: 10 }, (_, i) => `T146 R${String(i + 1).padStart(2, "0")}`),
    "import", 35_000,
  );
  await sleep(1600); // seen running first
  stampAtomic(eTen.map(({ id }) => ({ where: { id }, data: { status: "completed", progress: 100 } })));
  const digestE = await waitForToast("10 completed");
  must(!!digestE, 'digest title counts the whole batch ("10 completed")');
  const eLines = digestE.locator("span.block");
  must((await eLines.count()) === 9, `roster capped: 8 lines + 1 remainder line (got ${await eLines.count()})`);
  const eTail = ((await eLines.nth(8).textContent()) ?? "").trim();
  must(eTail === "… and 2 more", `remainder line counts instead of reciting ("${eTail}")`);
  must((await digestE.getByRole("button", { name: "View" }).count()) === 0, "capped digest still carries no View bridge");

  /* ---------------- Phase F — the news flow survives a digest ------------ */
  step("--- Phase F: a later solo flip replaces the digest (news flow alive) ---");
  const late = await seedRunners(["T146 Late"], "motioncorr", 30_000);
  await sleep(1600); // seen running first
  stampEx(late[0].id, { status: "failed", progress: 0 });
  const lateToast = await waitForToast("T146 Late failed");
  must(!!lateToast, "later solo announcement appeared");
  must((await p.locator(TOAST).count()) === 1, "TOAST_LIMIT=1 semantics: the new news replaced the digest");

  /* ---------------- Phase G — screenshot ---------------------------------- */
  step("--- Phase G: screenshot the digest ---");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t146-digest.png` });
  must(true, "screenshot recorded");

  /* ---------------- Phase Z — console + cleanup --------------------------- */
  step("--- Phase Z: console + cleanup ---");
  // Tolerance with a radius (t145 pattern): seeded rows' /log fetches 404.
  const seedIds = [...seededIds];
  const tol = (line) => {
    const url = line.split(" ").slice(1).join(" ");
    if (!seedIds.some((id) => url === `${BASE}/api/jobs/${id}/log`)) return true;
    return !line.startsWith("404");
  };
  const intolerable = badResponses.filter(tol);
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")})` : "no intolerable 4xx/5xx (seeded /log 404 tolerance held its radius)");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");

  await p.close(); p = null;
  await b.close(); b = null;
  deleteT146Rows();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT146 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
