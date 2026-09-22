// t147 — Task 147: the light half of the sweep speaks the same law.
//
// Task 146 cured the finished-news avalanche (collect first, announce
// after; one digest for a multi-finisher batch). But the sweep's LIGHT
// half — the auto-started notices, pending → running — still announced
// in a synchronous loop: two kickoffs in one tick swallowed the first
// notice exactly the way two completions used to swallow theirs. Task
// 147 extends the aggregation law to the kickoffs:
//   solo     one kickoff keeps its full notice — "Name auto-started" +
//            "Upstream inputs became ready — running now" — now carrying
//            the same 9s expiry every other news already has (a state
//            that lives on the card's teal ring has no reason to camp
//            on the toast slot for ~16 minutes).
//   digest   several kickoffs → ONE digest: census-count title ("3
//            auto-started"), one roster line per kicked job in the very
//            form its swallowed notice would have had, capped at 8 +
//            "… and N more". No elapsed lines — a kickoff is a
//            beginning, it has no duration to read yet. No View bridge.
//   order    kickoffs announce BEFORE the finished news — the completion
//            is the heavyweight fact and keeps winning the TOAST_LIMIT=1
//            slot (Task 146's ruling, preserved).
//
// The probe drives the CLIENT's announcement layer with atomic stamps
// (pending → running) — the announcement reads transitions, whoever
// flipped the row (engine auto-start or probe stamp) is invisible to
// it; real engine auto-start behavior stays covered by the qa suites.
//
// Phase S — pre-clean T147 rows, roster snapshot, keeper seed (holds
//           the 1.2s poll cadence; pending jobs don't count as active).
// Phase X — source oracle: both new branches carry duration 9_000.
// Phase B — two atomic pending→running stamps → digest "2 auto-started":
//           roster 2 lines verbatim ("Name auto-started"), lines carry
//           NO elapsed fragment, no View, not destructive.
// Phase C — one kickoff → full notice verbatim (title + description) —
//           the historical contract survives.
// Phase D — ten kickoffs → digest "10 auto-started", roster capped at
//           8 lines + "… and 2 more".
// Phase E — mixed tick: 2 kickoffs + 2 completions in ONE transaction →
//           the finished digest "2 completed" survives the slot (the
//           heavyweight-fact ruling holds).
// Phase G — screenshot.
// Phase Z — console clean, T147 rows deleted, roster restored.
//
// Run: node scripts/t147-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t147-shot";
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

const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

/** ATOMIC bulk stamp — a single prisma transaction so a poll GET never
 *  sees a half-flipped middle (the t146 weapon). */
const stampAtomic = (ops) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$transaction(${JSON.stringify(ops)}.map(o=>p.job.updateMany(o))).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const deleteT147Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T147"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
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

const waitForToast = async (frag, tries = 48) => {
  for (let i = 0; i < tries; i++) {
    const loc = p.locator(TOAST, { hasText: frag });
    if ((await loc.count()) > 0) return loc.first();
    await sleep(250);
  }
  return null;
};

/** create jobs (idle), returns { id, name } list */
const seedJobs = async (names, type) => {
  const world = await roster();
  let y = world.reduce((m, j) => Math.max(m, j.y ?? 0), 0) + 240;
  const out = [];
  for (const name of names) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type})`);
    seededIds.push(j.id);
    out.push({ id: j.id, name });
    y += 240;
  }
  return out;
};

/** the probe premise, explicit (t146 lesson): the announcement reads
 *  TRANSITIONS, so the client must SEE each intermediate state before
 *  the flip — pending first (a kickoff needs a before), running first
 *  (a completion needs a before). The keeper runner holds the 1.2s
 *  cadence; one sleep covers one poll cycle. */
const letClientSee = async () => { await sleep(1600); };

async function main() {
  /* ---------------- Phase S — clean world, roster, keeper ---------------- */
  step("--- Phase S: world snapshot + keeper ---");
  deleteT147Rows();
  const rosterBefore = (await roster()).length;
  const keeper = await seedJobs(["T147 Keeper"], "motioncorr");
  stampEx(keeper[0].id, { status: "running", progress: 20, startedAt: new Date(Date.now() - 20_000).toISOString() });
  must(keeper.length === 1, "S: keeper runner seeded (holds the 1.2s poll cadence)");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase X — source oracle: both branches expire --------- */
  step("--- Phase X: source oracle — the new branches carry the 9s expiry ---");
  const storeSrc = readFileSync("/home/z/my-project/src/lib/store.ts", "utf8");
  const kickedBranch = storeSrc.slice(storeSrc.indexOf("if (kicked.length === 1)"), storeSrc.indexOf("const [solo, ...rest]"));
  must(kickedBranch.includes("duration: 9_000"), "source: the solo kickoff notice expires (9s — no more ~16min camping)");
  must((kickedBranch.match(/duration: 9_000/g) ?? []).length === 2, "source: BOTH kickoff branches (solo + digest) carry the 9s expiry");

  /* ---------------- Phase B — two kickoffs → digest ----------------------- */
  step("--- Phase B: two kickoffs in one tick → digest '2 auto-started' ---");
  const bPair = await seedJobs(["T147 KA", "T147 KB"], "motioncorr");
  stampAtomic(bPair.map(({ id }) => ({ where: { id }, data: { status: "pending", progress: 0 } })));
  await letClientSee();
  stampAtomic(bPair.map(({ id }) => ({ where: { id }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } })));
  const digestB = await waitForToast("2 auto-started");
  must(!!digestB, "kickoff digest appeared with the census-count title");
  const bLines = digestB.locator("span.block");
  must((await bLines.count()) === 2, `digest roster has exactly 2 lines (got ${await bLines.count()})`);
  const bLine0 = ((await bLines.nth(0).textContent()) ?? "").trim();
  const bLine1 = ((await bLines.nth(1).textContent()) ?? "").trim();
  must(bLine0 === "T147 KA auto-started", `roster line 1 verbatim ("${bLine0}")`);
  must(bLine1 === "T147 KB auto-started", `roster line 2 verbatim ("${bLine1}")`);
  must(!/·\s*\d+s/.test(bLine0) && !/·\s*\d+s/.test(bLine1), "kickoff lines carry NO elapsed fragment (a beginning has no duration)");
  must((await digestB.getByRole("button", { name: "View" }).count()) === 0, "kickoff digest carries NO View bridge");
  const bCls = (await digestB.getAttribute("class")) ?? "";
  must(!/destructive/.test(bCls), "kickoff digest is NOT destructive");

  /* ---------------- Phase C — one kickoff keeps its full notice ----------- */
  step("--- Phase C: one kickoff → the historical notice, verbatim + expiry ---");
  const cSolo = await seedJobs(["T147 KC"], "motioncorr");
  stampAtomic(cSolo.map(({ id }) => ({ where: { id }, data: { status: "pending", progress: 0 } })));
  await letClientSee();
  stampAtomic(cSolo.map(({ id }) => ({ where: { id }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } })));
  const soloToast = await waitForToast("T147 KC auto-started");
  must(!!soloToast, "solo kickoff notice appeared");
  const soloText = ((await soloToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  must(soloText === "T147 KC auto-startedUpstream inputs became ready — running now",
    `solo notice verbatim ("${soloText}")`);
  must((await soloToast.getByRole("button", { name: "View" }).count()) === 0, "solo kickoff has no View bridge (it never did)");

  /* ---------------- Phase D — ten kickoffs → capped roster ---------------- */
  step("--- Phase D: ten kickoffs → 8 lines + '… and 2 more' ---");
  const dTen = await seedJobs(
    Array.from({ length: 10 }, (_, i) => `T147 K${String(i + 1).padStart(2, "0")}`),
    "motioncorr",
  );
  stampAtomic(dTen.map(({ id }) => ({ where: { id }, data: { status: "pending", progress: 0 } })));
  await letClientSee();
  stampAtomic(dTen.map(({ id }) => ({ where: { id }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } })));
  const digestD = await waitForToast("10 auto-started");
  must(!!digestD, 'digest counts the whole kickoff batch ("10 auto-started")');
  const dLines = digestD.locator("span.block");
  must((await dLines.count()) === 9, `roster capped: 8 lines + 1 remainder (got ${await dLines.count()})`);
  const dTail = ((await dLines.nth(8).textContent()) ?? "").trim();
  must(dTail === "… and 2 more", `remainder counts instead of reciting ("${dTail}")`);

  /* ---------------- Phase E — mixed tick: the heavyweight fact wins ------- */
  step("--- Phase E: 2 kickoffs + 2 completions in one tick → finished digest survives ---");
  const eKick = await seedJobs(["T147 KE1", "T147 KE2"], "motioncorr");
  const eFin = await seedJobs(["T147 EF1", "T147 EF2"], "ctffind");
  stampAtomic([
    ...eKick.map(({ id }) => ({ where: { id }, data: { status: "pending", progress: 0 } })),
    ...eFin.map(({ id }) => ({ where: { id }, data: { status: "running", progress: 60, startedAt: new Date(Date.now() - 30_000).toISOString() } })),
  ]);
  await letClientSee();
  stampAtomic([
    ...eKick.map(({ id }) => ({ where: { id }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } })),
    ...eFin.map(({ id }) => ({ where: { id }, data: { status: "completed", progress: 100 } })),
  ]);
  const digestE = await waitForToast("2 completed");
  must(!!digestE, "the finished digest '2 completed' won the slot (Task 146 ruling preserved)");
  const eText = ((await digestE.textContent()) ?? "").trim();
  must(eText.startsWith("2 completed"), `surviving toast is the finished digest ("${eText.slice(0, 30)}")`);

  /* ---------------- Phase G — screenshot ---------------------------------- */
  step("--- Phase G: screenshot the kickoff digest ---");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t147-kickoffs.png` });
  must(true, "screenshot recorded");

  /* ---------------- Phase Z — console + cleanup --------------------------- */
  step("--- Phase Z: console + cleanup ---");
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
  deleteT147Rows();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT147 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
