// t150 — Task 150: the kickoff names its cause.
//
// The engine's auto-start IS the edges table (autoStartPendingDownstream
// BFS-es downstream over the very same wires the canvas draws), so the
// kickoff notice can NAME the upstream by reading the data the cause
// was written in:
//   solo kickoff   description becomes "After <upstream> completed —
//                  running now" when an inbound edge backs the claim
//                  (an upstream that finished in THIS sweep wins — the
//                  direct cause — otherwise an upstream whose status
//                  already reads completed); no verifiable cause → the
//                  generic line verbatim (the t147 contract).
//   digest roster  keeps the bare "${name} auto-started" form — the
//                  aggregation's cost is detail leaving (t146 ruling).
// The announcement never guesses: a named cause the data cannot back
// is a lie with a name in it.
//
// Phase S — purge, roster snapshot, keeper runner; build ALL fixtures
//           BEFORE the browser opens (the client's edges snapshot comes
//           from load()): upstreams stamped completed while downstreams
//           are STILL idle (the server's GET transition sweep fires
//           once per newly-observed completion and would auto-start
//           pending consumers for real — idle consumers are skipped),
//           then a settle window so the sweep's single fire is spent.
// Phase X — source oracle: kickoffUpstream reads the wires.
// Phase B — solo kickoff with a completed upstream → "After T150 Up
//           completed — running now" (the causal line, verbatim).
// Phase C — solo kickoff with NO wires → the generic line verbatim
//           (the t147 contract survives the enhancement).
// Phase D — digest keeps bare lines: one wired kickoff + one bare
//           kickoff in the same tick → "2 auto-started" with roster
//           lines "name auto-started" (no "After" — detail退场 ruling).
// Phase E — two completed upstreams on two wires → the FIRST completed
//           inbound edge in edges order wins (oracle-relative: the
//           probe computes the expectation from the same API the store
//           loads from).
// Phase F — the mixed tick ruling re-affirmed: upstream completes and
//           the child kicks in ONE atomic transaction → the kickoff
//           notice goes out first, the finished solo lands last and
//           keeps the slot (the causal line on the kicked notice is
//           spent — heavyweight news outranks light news, unchanged).
// Phase G — screenshot a causal-line notice live.
// Phase Z — console clean (strict — no inspector is opened), purge,
//           roster restored.
//
// Run: node scripts/t150-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t150-shot";
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

/** ATOMIC bulk stamp: prisma $transaction over updateMany ops. */
const stampAtomic = (ops) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$transaction(${JSON.stringify(ops)}.map(o=>p.job.updateMany(o))).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

/** prisma-side purge — jobs named T150* (edges cascade with them,
 *  schema onDelete: Cascade) — the strongest cleanup form. */
const purgeT150 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T150"}}}).then(r=>{console.log("purged",r.count);return p.$disconnect()})'`,
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

/** create a job via API (default idle) and track it for cleanup */
const makeJob = async (name, type, y) => {
  const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
  const j = created?.job ?? created;
  must(!!j?.id, `${name}: created (${type})`);
  seededIds.push(j.id);
  return j;
};

const makeEdge = async (fromJobId, toJobId) => {
  const created = await (await api("/api/edges", "POST", { fromJobId, toJobId })).json();
  const e = created?.edge ?? created;
  must(!!e?.id, `edge ${fromJobId.slice(-4)}→${toJobId.slice(-4)}: created`);
  return e;
};

/** the transition-premise step: sleep one poll cycle so the client SEES
 *  the seeded state before the flip (t146/t147/t148/t149 lesson). */
const letClientSee = () => sleep(1600);

async function main() {
  /* ---------------- Phase S — fixtures BEFORE the browser ---------------- */
  step("--- Phase S: purge + snapshot + keeper + wired fixtures (pre-browser) ---");
  purgeT150();
  const rosterBefore = (await roster()).length;
  // keeper runner holds the 1.2s poll cadence all probe long
  const keeper = await makeJob("T150 Keeper", "motioncorr", 60);
  stampEx(keeper.id, { status: "running", progress: 20, startedAt: new Date(Date.now() - 15_000).toISOString() });

  // Phase B fixture: Up (completed) → DA. Up's completion will be newly
  // observed by the NEXT GET — the sweep fires once and would auto-start
  // any PENDING consumer for real; DA must be IDLE at that moment.
  const up = await makeJob("T150 Up", "import", 300);
  const da = await makeJob("T150 DA", "motioncorr", 540);
  await makeEdge(up.id, da.id);
  stampEx(up.id, { status: "completed", progress: 100, result: "movies imported" });

  // Phase C fixture: a bare kickoff with NO wires
  const solo = await makeJob("T150 Solo", "ctffind", 780);

  // Phase D fixtures: one WIRED kickoff (edge from Up) + one BARE
  const ka = await makeJob("T150 KA", "import", 1020);
  await makeEdge(up.id, ka.id);
  const kb = await makeJob("T150 KB", "import", 1260);

  // Phase E fixture: ME with TWO completed upstreams on two wires —
  // the first completed inbound edge in edges order must win
  const eu1 = await makeJob("T150 EU1", "motioncorr", 1500);
  const eu2 = await makeJob("T150 EU2", "motioncorr", 1740);
  const me = await makeJob("T150 ME", "ctffind", 1980);
  await makeEdge(eu1.id, me.id);
  await makeEdge(eu2.id, me.id);
  stampEx(eu1.id, { status: "completed", progress: 100 });
  stampEx(eu2.id, { status: "completed", progress: 100 });

  // Phase F fixture: UpF → Kid (atomic mixed tick later)
  const upF = await makeJob("T150 UpF", "motioncorr", 2220);
  const kid = await makeJob("T150 Kid", "import", 2460);
  await makeEdge(upF.id, kid.id);

  // Phase G fixture: another wired kickoff for the live screenshot
  const pic = await makeJob("T150 Pic", "motioncorr", 2700);
  await makeEdge(up.id, pic.id);

  // settle: let the server's GET sweep observe ALL the completions and
  // spend its single auto-start fire while every consumer is IDLE
  await sleep(2500);

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase X — source oracle ------------------------------- */
  step("--- Phase X: source oracle — the kickoff reads its wires ---");
  const src = execSync("cat src/lib/store.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/const kickoffUpstream = \(/.test(src), "oracle: kickoffUpstream exists (lineage reader)");
  must(/`After \$\{up\} completed — running now`/.test(src),
    "oracle: the causal line is the enhanced description");
  must(/: "Upstream inputs became ready — running now"/.test(src),
    "oracle: the generic line survives as the no-cause fallback");

  /* ---------------- Phase B — the causal line ------------------------------ */
  step("--- Phase B: wired kickoff → 'After T150 Up completed — running now' ---");
  stampEx(da.id, { status: "pending", progress: 0 });
  await letClientSee();
  stampEx(da.id, { status: "running", progress: 5, startedAt: new Date().toISOString() });
  const bToast = await waitForToast("T150 DA auto-started");
  must(!!bToast, "kickoff notice appeared");
  const bText = ((await bToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  must(bText.includes("After T150 Up completed — running now"),
    `description names the cause ("${bText.slice(0, 90)}")`);
  must((await bToast.getByRole("button", { name: "View" }).count()) === 0,
    "kickoff notice carries no View bridge (unchanged)");

  /* ---------------- Phase C — no wires, no invented cause ------------------ */
  step("--- Phase C: bare kickoff → the generic line verbatim (t147 contract) ---");
  stampEx(solo.id, { status: "pending", progress: 0 });
  await letClientSee();
  stampEx(solo.id, { status: "running", progress: 5, startedAt: new Date().toISOString() });
  const cToast = await waitForToast("T150 Solo auto-started");
  must(!!cToast, "bare kickoff notice appeared");
  const cText = ((await cToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  must(cText.includes("Upstream inputs became ready — running now"),
    `generic line verbatim ("${cText.slice(0, 90)}")`);

  /* ---------------- Phase D — the digest keeps bare lines ------------------ */
  step("--- Phase D: wired + bare kickoffs in one tick → bare roster lines ---");
  stampAtomic([
    { where: { id: ka.id }, data: { status: "pending", progress: 0 } },
    { where: { id: kb.id }, data: { status: "pending", progress: 0 } },
  ]);
  await letClientSee();
  stampAtomic([
    { where: { id: ka.id }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } },
    { where: { id: kb.id }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } },
  ]);
  const dToast = await waitForToast("2 auto-started");
  must(!!dToast, 'digest "2 auto-started" appeared');
  const dLines = dToast.locator("span.block");
  must((await dLines.count()) === 2, `digest roster has 2 lines (got ${await dLines.count()})`);
  const dLine0 = ((await dLines.nth(0).textContent()) ?? "").trim();
  const dLine1 = ((await dLines.nth(1).textContent()) ?? "").trim();
  must(/^T150 K[AB] auto-started$/.test(dLine0) && /^T150 K[AB] auto-started$/.test(dLine1),
    `both lines keep the bare form ("${dLine0}" / "${dLine1}") — even the wired one`);

  /* ---------------- Phase E — two completed upstreams: edges order wins ---- */
  step("--- Phase E: ME with two completed upstreams → first inbound edge wins ---");
  stampEx(me.id, { status: "pending", progress: 0 });
  await letClientSee();
  stampEx(me.id, { status: "running", progress: 5, startedAt: new Date().toISOString() });
  // oracle-relative: compute the expectation from the SAME API the store
  // loads from — first inbound edge whose source reads completed
  const edgesAll = (await (await api("/api/edges")).json())?.edges ?? [];
  const jobsAll = await roster();
  const inbound = edgesAll.filter((e) => e.toJobId === me.id);
  const expectedName = inbound
    .map((e) => jobsAll.find((j) => j.id === e.fromJobId))
    .find((j) => j?.status === "completed")?.name ?? null;
  must(expectedName === "T150 EU1", `oracle: first completed inbound upstream is "${expectedName}"`);
  const eToast = await waitForToast("T150 ME auto-started");
  must(!!eToast, "ME kickoff notice appeared");
  const eText = ((await eToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  must(eText.includes(`After ${expectedName} completed — running now`),
    `description names the order-first upstream ("${eText.slice(0, 90)}")`);

  /* ---------------- Phase F — the mixed tick ruling re-affirmed ------------ */
  step("--- Phase F: upstream completes + child kicks in ONE tick → solo keeps the slot ---");
  stampEx(upF.id, { status: "running", progress: 50, startedAt: new Date(Date.now() - 30_000).toISOString() });
  stampEx(kid.id, { status: "pending", progress: 0 });
  await letClientSee();
  stampAtomic([
    { where: { id: upF.id }, data: { status: "completed", progress: 100 } },
    { where: { id: kid.id }, data: { status: "running", progress: 5, startedAt: new Date().toISOString() } },
  ]);
  const fToast = await waitForToast("T150 UpF completed");
  must(!!fToast, "the finished solo landed last and kept the TOAST_LIMIT=1 slot");
  must((await p.locator(TOAST).count()) === 1, "exactly one toast — the heavyweight news wins (t146/t147 ruling)");

  /* ---------------- Phase G — a causal-line notice, live on screen --------- */
  step("--- Phase G: screenshot the causal line ---");
  stampEx(pic.id, { status: "pending", progress: 0 });
  await letClientSee();
  stampEx(pic.id, { status: "running", progress: 5, startedAt: new Date().toISOString() });
  const gToast = await waitForToast("T150 Pic auto-started");
  must(!!gToast, "screenshot fixture notice appeared");
  const gText = ((await gToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  must(gText.includes("After T150 Up completed"), "the screenshot notice carries the causal line");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t150-causal-line.png` });
  must(true, "screenshot recorded");

  /* ---------------- Phase Z — console + cleanup ---------------------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");
  const intolerable = badResponses.filter((l) => !l.includes("/api/jobs") || !l.startsWith("40"));
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")})` : "no intolerable 4xx/5xx");

  await p.close(); p = null;
  await b.close(); b = null;
  purgeT150();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT150 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
