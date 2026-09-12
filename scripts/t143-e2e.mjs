// t143 — Task 143: the browser tab joins the census.
//
// The heartbeat arc reached every chrome layer a scientist sees while
// LOOKING at the app (cards t141, footer t140, batch age t142, roster).
// Task 143 reaches the one surface nobody sees while looking — the
// browser tab itself — which is exactly the surface a scientist sees
// when NOT looking (batch kicked off, then email, then ten tabs):
//   title   — "W2 · 2 running · 1 failed · CryoFlow". Counts only:
//             glance granularity (t142's StageChip lesson), no 1s
//             ticker, zero segments omitted (presence-derived like the
//             footer census). Quiet world restores the pristine
//             metadata title — "restore the state you found".
//   favicon — the hook-owned mark (data-cf-tab link; CryoFlow ships no
//             static icon) with a state dot: teal-400 while runners
//             live, rose-500 on any failure. Alarm outranks alive.
//
// Phase S — pre-clean T143 rows, snapshot roster + workspaces; seed 6
//           jobs in the ACTIVE workspace (the store's load() rule:
//           current-if-exists else workspaces[0] — a fresh browser has
//           no current, so workspaces[0] is the oracle's workspace):
//           2 running (fresh startedAt inside the 120s grace window),
//           1 completed / 1 failed / 2 idle witnesses.
// Phase B — title oracle: EXACT equality against an API-derived string
//           (activeWs jobs → running/failed counts, ws name, brand,
//           segment omission mirrored) — the tab's census is the
//           workspace's census, not the seeds'. Favicon: dot color
//           follows the alarm precedence derived from the same oracle.
// Phase C — lifecycle: one runner completes (direct stamp) → the title
//           recount arrives on a poll tick ("restore" not frozen
//           memory); favicon stays teal while runners remain.
// Phase D — alarm: the last runner is aged past the reconcile grace
//           window (startedAt 130s old) → the engine honestly fails it
//           (t135 doctrine, black-boxed) → the title swaps the running
//           segment for failed and the dot turns rose. Then mixed:
//           a fresh runner joins a failing world → title carries both
//           segments AND the dot stays rose (alarm > alive).
// Phase E — switch away: a new empty workspace via the sidebar row →
//           the title restores the pristine base (a census of an empty
//           roster is silence) and the dot goes quiet; switch back →
//           the census returns. The census follows the VIEWED roster.
// Phase F — lens independence: arming the find lens (Ctrl+F + query)
//           must not move the tab — the census counts statuses, it is
//           not lens-coupled. Esc restores.
// Phase G — record: the exact title + favicon href logged; canvas
//           screenshot for the human record.
// Phase Z — console honest (0 pageerror, 0 real console error), T143
//           rows deleted, roster + workspaces restored.
//
// Run: node scripts/t143-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t143-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const seededIds = [];
let createdWsId = null;

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () => (await (await api("/api/jobs")).json())?.jobs ?? [];
const workspaces = async () =>
  (await (await api("/api/workspaces")).json())?.workspaces ?? [];

/** Stamp a job straight into the DB (qa75 / t135 / t140 / t141 / t142
 *  precedent). A "running" stamp MUST carry a fresh startedAt: the
 *  engine's reconcile treats a running row with no engine record older
 *  than 120s as stale and honestly fails it — ageMs is how the D phase
 *  TURNS that honesty into a test signal. opts: { ageMs, progress }. */
const stampEx = (id, status, opts = {}) => {
  const parts = [`status:"${status}"`];
  if (status === "running")
    parts.push(`startedAt:new Date(Date.now()-${opts.ageMs ?? 0}).toISOString()`);
  if (opts.progress != null) parts.push(`progress:${opts.progress}`);
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:{${parts.join(",")}}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const deleteT143Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T143"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
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

/** the tab-census oracle — mirrors use-tab-census.ts exactly, derived
 *  from the API: activeWs jobs → counts, ws name, brand, omission. */
let activeWsId = null;
let wsName = null;
let baseTitle = null;
const censusOf = async () => {
  const jobs = await roster();
  const inWs = jobs.filter((j) => (j.workspaceId ?? "") === activeWsId);
  const r = inWs.filter((j) => j.status === "running").length;
  const f = inWs.filter((j) => j.status === "failed").length;
  const title =
    r <= 0 && f <= 0
      ? baseTitle
      : [
          ...(wsName ? [wsName] : []),
          ...(r > 0 ? [`${r} running`] : []),
          ...(f > 0 ? [`${f} failed`] : []),
          "CryoFlow",
        ].join(" · ");
  const fav = r <= 0 && f <= 0 ? "quiet" : f > 0 ? "failed" : "running";
  return { title, fav, r, f };
};

const readTitle = () => p.evaluate(() => document.title);
const readFav = () =>
  p.evaluate(() => document.querySelector('link[rel="icon"][data-cf-tab]')?.getAttribute("href") ?? "");

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

const TEAL_DOT = encodeURIComponent("#2dd4bf");
const ROSE_DOT = encodeURIComponent("#f43f5e");

async function main() {
  /* ---------------- Phase S — seeds + world snapshot ---------------- */
  step("--- Phase S: snapshot world, seed 6 jobs in the active workspace ---");
  // the PRISTINE title comes from the SSR HTML — the live DOM is already
  // hook territory milliseconds after hydration (first-run lesson: the
  // captured "pristine" value was the census itself)
  const ssrHtml = await (await fetch(BASE)).text();
  baseTitle = /<title>(.*?)<\/title>/.exec(ssrHtml)?.[1] ?? null;
  must(!!baseTitle && baseTitle.includes("CryoFlow"), `pristine SSR title captured ("${baseTitle}")`);
  must(!baseTitle.includes("running") && !baseTitle.includes("failed"), `SSR title is pre-census (metadata, not chrome)`);
  const baseline = await roster();
  const wsList0 = await workspaces();
  const wsCount0 = wsList0.length;
  // the store's load() rule: a fresh browser has no current workspace,
  // so the canvas lands on workspaces[0] — the oracle's workspace
  activeWsId = wsList0[0]?.id ?? null;
  wsName = wsList0[0]?.name ?? null;
  must(!!activeWsId, `active workspace resolved (workspaces[0] = ${wsName})`);

  const maxY = baseline.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const seeds = [
    ["T143 Alpha", "ctffind", "running", { ageMs: 5000, progress: 40 }],
    ["T143 Beta", "ctffind", "running", { ageMs: 45000, progress: 72 }],
    ["T143 Gamma", "ctffind", "completed", {}],
    ["T143 Delta", "ctffind", "failed", {}],
    ["T143 Eps", "import", "idle", {}],
    ["T143 Zeta", "motioncorr", "idle", {}],
  ];
  const seedIds = {};
  let y = maxY + 240;
  for (const [name, type, status, opts] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type} → ${status})`);
    seedIds[name] = j.id;
    seededIds.push(j.id);
    if (status) stampEx(j.id, status, opts);
    y += 240;
  }
  const stamped = await roster();
  const byName = Object.fromEntries(
    stamped.filter((j) => (j.name ?? "").startsWith("T143")).map((j) => [j.name, j]),
  );
  must(
    byName["T143 Alpha"]?.status === "running" &&
      byName["T143 Beta"]?.status === "running" &&
      byName["T143 Gamma"]?.status === "completed" &&
      byName["T143 Delta"]?.status === "failed" &&
      byName["T143 Eps"]?.status === "idle" &&
      byName["T143 Zeta"]?.status === "idle",
    `S+ stamps verified via API (2 running / 1 completed / 1 failed / 2 idle)`
  );

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });

  /* ---------------- Phase B — title + favicon oracle ---------------- */
  step("--- Phase B: title is the workspace's census (exact oracle) ---");
  let oracle = await censusOf();
  await p.waitForFunction(
    () => document.title.includes("running") || document.title.includes("failed"),
    null,
    { timeout: 30000 },
  );
  let title = await readTitle();
  must(title === oracle.title, `title == oracle ("${title}")`);
  must(title.includes(`${oracle.r} running`), `running segment present (${oracle.r} running)`);
  must(title.includes(`${oracle.f} failed`), `failed segment present (${oracle.f} failed)`);
  must(
    title.indexOf("running") < title.indexOf("failed"),
    `segment order: running before failed (census reading order)`
  );
  must(title.endsWith("· CryoFlow"), `brand anchors the tail (truncation-safe)`);
  let fav = await readFav();
  must(!!fav && fav.startsWith("data:image/svg+xml,"), `hook-owned favicon link exists`);
  must(
    oracle.fav === "failed" ? fav.includes(ROSE_DOT) : fav.includes(TEAL_DOT),
    `favicon dot follows oracle (${oracle.fav})`
  );
  must(!fav.includes(ROSE_DOT) || oracle.fav === "failed", `no rose dot unless alarm (precedence)`);

  /* ---------------- Phase C — lifecycle: recount is live ---------------- */
  step("--- Phase C: a runner completes → the title recounts ---");
  stampEx(seedIds["T143 Alpha"], "completed", { progress: 100 });
  oracle = await censusOf();
  await p.waitForFunction(
    (want) => document.title === want,
    oracle.title,
    { timeout: 30000 },
  );
  title = await readTitle();
  must(title === oracle.title, `title recounts after completion ("${title}")`);
  fav = await readFav();
  must(
    fav.includes(oracle.fav === "failed" ? ROSE_DOT : TEAL_DOT),
    `favicon still follows oracle (${oracle.fav})`
  );

  /* ---------------- Phase D — alarm: reconcile honesty + precedence ---------------- */
  step("--- Phase D: aged runner honestly fails → rose dot; alarm outranks alive ---");
  // Beta's startedAt goes 130s stale: no engine record + past the 120s
  // grace window → the next roster GET reconciles it to failed (t135's
  // "fake running is the engine's honest prey", black-boxed again).
  // WORLD-INCLUSIVE oracle (t142's S-phase lesson re-learned): the world
  // may carry its own runners — nothing here pins r to zero.
  stampEx(seedIds["T143 Beta"], "running", { ageMs: 130000, progress: 72 });
  oracle = await censusOf();
  must(oracle.f >= 2, `reconcile landed in the oracle (Beta joined the failed, f=${oracle.f})`);
  await p.waitForFunction(
    (want) => document.title === want,
    oracle.title,
    { timeout: 30000 },
  );
  title = await readTitle();
  must(title === oracle.title, `title carries the alarm ("${title}")`);
  fav = await readFav();
  must(fav.includes(ROSE_DOT), `favicon dot turns rose (alarm)`);

  // mixed world: a fresh runner joins a failing one → counts move, dot
  // stays rose (the alarm wins the pixel, not the newcomer)
  stampEx(seedIds["T143 Eps"], "running", { ageMs: 2000, progress: 10 });
  oracle = await censusOf();
  must(oracle.r >= 1 && oracle.f >= 1, `mixed oracle: runners and failures coexist (r=${oracle.r} f=${oracle.f})`);
  await p.waitForFunction(
    (want) => document.title === want,
    oracle.title,
    { timeout: 30000 },
  );
  title = await readTitle();
  must(
    title.includes(`${oracle.r} running`) && title.includes(`${oracle.f} failed`),
    `mixed world: both segments in census order ("${title}")`
  );
  fav = await readFav();
  must(fav.includes(ROSE_DOT), `mixed world: dot stays rose (alarm precedence)`);

  /* ---------------- Phase E — switch away: census follows the view ---------------- */
  step("--- Phase E: empty workspace → pristine title; back → census returns ---");
  const createdWs = await (await api("/api/workspaces", "POST", { name: "T143 Empty" })).json();
  createdWsId = createdWs?.workspace?.id ?? createdWs?.id ?? null;
  must(!!createdWsId, `empty workspace created (T143 Empty)`);
  // the ORACLE follows the same view switch the hand is about to make
  const mainWsId = activeWsId;
  activeWsId = createdWsId;
  // the client fetched its workspace list at load — the API-created row
  // must be reloaded into the store before the sidebar knows it
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  // the workspace navigator is a sidebar TAB (default is catalog)
  await p.locator('[role="tab"]:has-text("Workspaces")').click({ timeout: 8000 });
  const row = p.locator('[role="button"][title="Switch the canvas to T143 Empty"]').first();
  await row.click({ timeout: 8000 });
  await sleep(1200);
  oracle = await censusOf();
  must(oracle.r === 0 && oracle.f === 0, `empty workspace oracle: quiet (r=0 f=0)`);
  await p.waitForFunction(
    () => !document.title.includes("running") && !document.title.includes("failed"),
    null,
    { timeout: 30000 },
  );
  title = await readTitle();
  must(title === baseTitle, `empty workspace restores the pristine title ("${title}")`);
  fav = await readFav();
  must(!fav.includes(TEAL_DOT) && !fav.includes(ROSE_DOT), `dot goes quiet away from the alarm`);

  // switch back through the sidebar row (exact switch-invitation title)
  activeWsId = mainWsId;
  const backRow = p.locator(`[role="button"][title="Switch the canvas to ${wsName}"]`).first();
  await backRow.click({ timeout: 8000 });
  await sleep(1200);
  oracle = await censusOf();
  await p.waitForFunction(
    (want) => document.title === want,
    oracle.title,
    { timeout: 30000 },
  );
  title = await readTitle();
  must(title === oracle.title, `switching back returns the census ("${title}")`);

  /* ---------------- Phase F — lens independence ---------------- */
  step("--- Phase F: the find lens must not move the tab ---");
  const beforeLens = await readTitle();
  await p.keyboard.press("Control+f");
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Control+a");
  await p.keyboard.type("T143", { delay: 20 });
  await sleep(600);
  must((await readTitle()) === beforeLens, `armed lens leaves the title untouched`);
  await p.keyboard.press("Escape");
  await sleep(400);
  must((await readTitle()) === beforeLens, `Esc keeps the census ("${beforeLens}")`);

  /* ---------------- Phase G — record ---------------- */
  step("--- Phase G: record title + favicon + canvas ---");
  console.log(`  title   : ${await readTitle()}`);
  const favHref = await readFav();
  console.log(`  favicon : ${favHref.slice(0, 72)}… (${favHref.includes(ROSE_DOT) ? "rose" : favHref.includes(TEAL_DOT) ? "teal" : "quiet"})`);
  await p.screenshot({ path: `${OUT}/t143-canvas.png` });
  step(`  screenshot → ${OUT}`);

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console honesty + world restore ---");
  step(`  diag 4xx responses: ${JSON.stringify(badResponses.slice(0, 4))}`);
  must(pageErrors.length === 0, `page errors honest (${pageErrors.length})`);
  must(consoleErrors.length === 0, `console errors honest (${consoleErrors.length}): ${consoleErrors.slice(0, 2).join(" | ")}`);
  void cleanup().then(async () => {
    if (createdWsId) {
      try { await fetch(`${BASE}/api/workspaces/${createdWsId}`, { method: "DELETE" }); } catch {}
    }
    deleteT143Rows();
    const [finalRoster, finalWs] = [await roster(), await workspaces()];
    must(finalRoster.length === baseline.length, `roster restored (${finalRoster.length} == ${baseline.length})`);
    must(finalWs.length === wsCount0, `workspaces restored (${finalWs.length} == ${wsCount0})`);
    console.log(`\nT143 ALL PASS (${PASS} assertions)`);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("FATAL:", e);
  void cleanup().then(() => process.exit(1));
});
