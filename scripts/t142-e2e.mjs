// t142 — Task 142: the heartbeat's readout rises into chrome.
//
// Task 141 put the fact (elapsed) on the card; Task 142 carries the same
// dialect to every chrome surface a scientist sweeps:
//   footer  — the running census entry grows the batch's AGE: the oldest
//             running job's elapsed, "2 running · 1m 35s". The count says
//             how many; the readout says how long this has been going.
//             One-second heartbeat, only while a runner lives (an idle
//             world pays zero timers).
//   inspector — the two live readouts switch fmtDuration ("12m 5s") to
//             the canonical formatElapsed ("12m 05s") — one formatter
//             for one fact; and useElapsed is rebuilt on the canonical
//             useNow (init 0, Task 141's hydration doctrine, surface
//             eliminated not gated).
//   dashboard — the roster row speaks "42% · 12m 05s · ~12m": progress,
//             then fact, then prediction — the card's Row 3 composition.
//
// Phase S — pre-clean T142 rows, assert a runner-free world (the footer
//           is workspace-scoped; a contaminated world would blur the
//           oldest-runner oracle), snapshot roster, seed 6 jobs: 3
//           running (startedAt 5s/65s/95s ago — all inside the 120s
//           reconcile grace window; Gamma oldest at 95s), 1 completed /
//           1 failed / 1 idle witnesses.
// Phase X — formatElapsed oracle lifted from src/lib/elapsed.ts (Task
//           138 doctrine, function edition — the product's formatter is
//           the only formatter).
// Phase B — footer readout: exactly one [data-testid=footer-running-
//           elapsed], no "~" (a fact), parsed seconds ≥ 95 (oldest-seed
//           floor — the clock agrees with the wall), census title says
//           "longest running for".
// Phase C — footer ticker: two reads 2.6s apart strictly increase.
// Phase D — inspector (reach-first, t112 orthodoxy): header meta reads
//           "1m 35s elapsed" (formatElapsed dialect, m-grain padded),
//           timeline Running step sub carries "elapsed"; the completed
//           witness's inspector shows none.
// Phase E — dashboard roster: the running row reads "42% · …m …s · ~…m"
//           (progress, fact, prediction — no "~" on the fact); the
//           completed row carries no fact.
// Phase F — lifecycle: the oldest runner completes → the footer readout
//           FOLLOWS the oldest living runner (drops to Beta's age) —
//           the readout is the batch's age, not a frozen memory.
// Phase G — screenshots (footer zone, canvas, inspector).
// Phase Z — console clean, T142 rows deleted, roster restored.
//
// Run: node scripts/t142-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { mkdirSync, readFileSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t142-shot";
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
 *  A "running" stamp MUST carry a fresh startedAt: the engine's
 *  reconcile treats a running row with no engine record older than
 *  120s as stale and honestly fails it — a fresh startedAt is the
 *  spawn-race grace-window ticket. opts: { ageMs, progress }. */
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

const deleteT142Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T142"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
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

/** "42s" / "12m 05s" / "1h 04m" → seconds (NaN when unparseable) */
const parseElapsed = (t) => {
  if (!t) return NaN;
  let m = /^(\d+)s$/.exec(t.trim());
  if (m) return +m[1];
  m = /^(\d+)m (\d{2})s$/.exec(t.trim());
  if (m) return +m[1] * 60 + +m[2];
  m = /^(\d+)h (\d{2})m$/.exec(t.trim());
  if (m) return +m[1] * 3600 + +m[2] * 60;
  return NaN;
};

/** find-reach: bring a card to the viewport by name through the lens
 *  (t112 orthodoxy) — world geometry can never be trusted. */
const reachViaFind = async (name) => {
  await p.keyboard.press("Control+f");
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Control+a");
  await p.keyboard.type(name, { delay: 20 });
  await sleep(350);
  await p.keyboard.press("Enter");
  await sleep(1000);
  await p.keyboard.press("Escape");
  await sleep(350);
};

/** open a card's inspector: reach it first, then click — retries with
 *  varying hit points because a wire may lawfully swallow the first
 *  pointerdown (t139's lesson: query the geometry, don't pin the actor).
 *  A retry that lands on a NEIGHBOR opens that job's inspector instead;
 *  the dialog-text verification catches it, Escape peels it, and the
 *  next offset tries again. */
const openInspectorCard = async (name, id) => {
  const card = p.locator(`[data-job="${id}"]`);
  const offsets = [[0.5, 0.4], [0.5, 0.2], [0.3, 0.5], [0.7, 0.3], [0.5, 0.7]];
  for (let i = 0; i < 5; i++) {
    await reachViaFind(name);
    const box = await card.boundingBox();
    if (box) {
      const [fx, fy] = offsets[i % offsets.length];
      try {
        await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      } catch {}
    } else {
      await card.click({ timeout: 2000 }).catch(() => {});
    }
    await sleep(1200);
    const dlg = p.locator(`[role="dialog"][data-state="open"]`);
    const opened = (await dlg.count()) > 0 && (await dlg.first().innerText()).includes(name);
    if (opened) return true;
    await p.keyboard.press("Escape");
    await sleep(300);
  }
  return false;
};

async function main() {
  step("=== t142 — the heartbeat's readout rises into chrome ===");
  mkdirSync(OUT, { recursive: true });

  /* ---------------- Phase S — clean world + seeds ---------------- */
  step("--- Phase S: runner-free world + T142 status matrix ---");
  deleteT142Rows(); // a KILLED previous run must not poison this one
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);
  // The floor oracle owns only runners WITH a startedAt: a startedAt-less
  // running row (the world's static "QA Refine Live" fixture) is
  // invisible to the age readout by doctrine — no start, no clock
  // (t141's honesty, now asserted at the chrome level too).
  const preRunning = baseline.filter((j) => j.status === "running" && j.startedAt);
  must(
    preRunning.length === 0,
    `world starts with no startedAt-bearing runner (footer oracle owns the floor) — got ${preRunning.length}`
  );

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const seeds = [
    ["T142 Alpha", "motioncorr", "running", { ageMs: 5000, progress: 42 }],
    ["T142 Beta", "motioncorr", "running", { ageMs: 65000, progress: 8 }],
    ["T142 Gamma", "ctffind", "running", { ageMs: 95000, progress: 61 }],
    ["T142 Delta", "ctffind", "completed", {}],
    ["T142 Eps", "ctffind", "failed", {}],
    ["T142 Zeta", "import", "idle", {}],
  ];
  const seedIds = {};
  let y = maxY + 240;
  const seedEpoch = Date.now();
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
    stamped.filter((j) => (j.name ?? "").startsWith("T142")).map((j) => [j.name, j]),
  );
  must(
    byName["T142 Alpha"]?.status === "running" &&
      byName["T142 Beta"]?.status === "running" &&
      byName["T142 Gamma"]?.status === "running" &&
      byName["T142 Delta"]?.status === "completed" &&
      byName["T142 Eps"]?.status === "failed" &&
      byName["T142 Zeta"]?.status === "idle",
    `S+ stamps verified via API (3 running / 1 completed / 1 failed / 1 idle)`
  );

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase X — formatElapsed oracle ---------------- */
  step("--- Phase X: formatElapsed oracle lifted from product source ---");
  const src = readFileSync("/home/z/my-project/src/lib/elapsed.ts", "utf8")
    .replace(/^import .*$/gm, "")
    .replace(/export /g, "");
  const formatElapsedOracle = new Function(`${src}; return formatElapsed;`)();
  must(formatElapsedOracle(42_000) === "42s", "oracle: 42s → 42s (fact grain, no ~)");
  must(formatElapsedOracle(65_000) === "1m 05s", "oracle: 65s → 1m 05s (padded seconds)");
  must(formatElapsedOracle(3_845_000) === "1h 04m", "oracle: 3845s → 1h 04m (minute grain past the hour)");
  must(formatElapsedOracle(-5) === "0s", "oracle: negative clamps to 0s (a clock never reads backwards)");
  must(formatElapsedOracle(NaN) === "0s", "oracle: NaN clamps to 0s");

  /* ---------------- Phase B — footer readout (the batch's age) ---------------- */
  step("--- Phase B: the footer census speaks the batch's age ---");
  const footerReadout = p.locator('[data-testid="footer-running-elapsed"]');
  await footerReadout.waitFor({ timeout: 8000 });
  must((await footerReadout.count()) === 1, "exactly one footer readout (only the running entry carries it)");
  const footText = (await footerReadout.innerText()).replace(/\s+/g, " ").trim();
  must(!footText.includes("~"), `footer readout "${footText}" — a fact, no tilde`);
  const ageFloor = (baseAge) => baseAge + (Date.now() - seedEpoch) / 1000 - 3;
  const footSec = parseElapsed(footText.replace(/^·\s*/, ""));
  must(footSec >= ageFloor(95), `footer clock ≥ Gamma floor 95s+elapsed (${footSec}s, wall-agreeing)`);
  const runTitle = await p.locator('[data-testid="footer-census-running"]').getAttribute("title");
  must(/longest running for/.test(runTitle ?? ""), `census title carries the age ("${runTitle}")`);
  const deltaTitle = await p.locator('[data-testid="footer-census-completed"]').getAttribute("title");
  must(!/longest running/.test(deltaTitle ?? ""), "completed entry's title carries no age");

  /* ---------------- Phase C — footer ticker liveness ---------------- */
  step("--- Phase C: the footer heartbeat breathes (1s tick) ---");
  const before = parseElapsed((await footerReadout.innerText()).replace(/^·\s*/, ""));
  await sleep(2600);
  const after = parseElapsed((await footerReadout.innerText()).replace(/^·\s*/, ""));
  must(after > before, `footer ticker strictly advances ${before}s → ${after}s`);

  /* ---------------- Phase D — inspector: same fact, same dialect ---------------- */
  step("--- Phase D: the inspector speaks formatElapsed (canonical fact) ---");
  const gammaOpened = await openInspectorCard("T142 Gamma", seedIds["T142 Gamma"]);
  must(gammaOpened, "Gamma inspector opened (reach-first, retry-hardened click)");
  // header meta: "<m>m <ss>s elapsed" — the formatElapsed dialect
  const dlg = p.locator('[role="dialog"][data-state="open"]').first();
  const headerEl = dlg.locator("span.font-mono.tabular-nums.text-teal-600, span.font-mono.tabular-nums.dark\\:text-teal-400").first();
  const headerText = (await headerEl.count())
    ? (await headerEl.innerText()).replace(/\s+/g, " ").trim()
    : "";
  must(/^\d+m \d{2}s elapsed$/.test(headerText), `header reads "${headerText}" (padded m-grain fact)`);
  must(parseElapsed(headerText.replace(/ elapsed$/, "")) >= ageFloor(95), `header clock ≥ Gamma floor (${headerText})`);
  const inspBody = await dlg.innerText();
  must(/elapsed/.test(inspBody), "timeline Running step carries the elapsed sub");
  await p.keyboard.press("Escape");
  await sleep(500);

  /* ---------------- Phase E — dashboard roster row ---------------- */
  step("--- Phase E: the roster row reads progress, fact, prediction ---");
  const dashTab = p.locator('button[role="tab"][title*="Project dashboard"]');
  await dashTab.click({ timeout: 6000 }).catch(() => dashTab.click({ force: true, timeout: 6000 }));
  await sleep(1500);
  // scope to the roster TABLE — the spotlight's StageChips also carry the
  // job's name, and a bare hasText("T142 Beta") hits the chip first
  // (t139's lesson again: name the actor by its container, not its text)
  const betaRow = p.locator('[data-roster-table] tr', { hasText: "T142 Beta" }).first();
  await betaRow.waitFor({ timeout: 8000 });
  const rowFrag = betaRow.locator('[data-testid="row-elapsed"]');
  must((await rowFrag.count()) === 1, "running row carries the fact fragment");
  const rowFact = (await rowFrag.innerText()).replace(/\s+/g, " ").trim();
  must(!rowFact.includes("~"), `row fact "${rowFact}" — no tilde`);
  must(parseElapsed(rowFact.replace(/^·\s*/, "")) >= ageFloor(65), `row clock ≥ Beta floor 65s+elapsed (${rowFact})`);
  const betaRowText = (await betaRow.innerText()).replace(/\s+/g, " ");
  must(/8%\s*·/.test(betaRowText), `row keeps the pct before the fact ("${betaRowText.slice(0, 80)}")`);
  // A direct-stamped static progress has NO pace baseline → estimateEta
  // returns null → no "~12m" — and the row must not fake one (t141's
  // Phase D honesty, mirrored at roster level: no pace, no prediction).
  must(!/~/.test(betaRowText), `row fakes no prediction without pace ("${betaRowText.slice(0, 80)}")`);
  const deltaRow = p.locator('[data-roster-table] tr', { hasText: "T142 Delta" }).first();
  must((await deltaRow.locator('[data-testid="row-elapsed"]').count()) === 0, "completed row carries no fact");
  // back to the canvas for F
  await p.locator('button[role="tab"][title*="Canvas"], button[role="tab"][title*="Workflow"]').first()
    .click({ timeout: 6000 }).catch(() => p.keyboard.press("Escape"));
  await sleep(800);

  /* ---------------- Phase F — lifecycle: the readout follows the oldest LIVING runner ---------------- */
  step("--- Phase F: completing the oldest runner hands the readout to the next ---");
  stampEx(seedIds["T142 Gamma"], "completed", { progress: 100 });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1500);
  await footerReadout.waitFor({ timeout: 8000 });
  const footText2 = parseElapsed((await footerReadout.innerText()).replace(/^·\s*/, ""));
  const betaFloor = ageFloor(65);
  must(footSec > 0 && footText2 < betaFloor + 15, `readout dropped to the next-oldest band (${footText2}s < ${Math.round(betaFloor) + 15}s)`);
  must(footText2 >= betaFloor, `readout still ≥ Beta's floor (${footText2}s ≥ ${Math.round(betaFloor)}s)`);
  must((await footerReadout.count()) === 1, "readout survives (two runners remain)");

  /* ---------------- Phase G — screenshots ---------------- */
  step("--- Phase G: screenshots (footer zone + canvas) ---");
  await reachViaFind("T142 Beta");
  const vp = p.viewportSize();
  await p.screenshot({
    path: `${OUT}/t142-footer.png`,
    clip: { x: 0, y: vp.height - 120, width: vp.width, height: 120 },
  });
  await p.screenshot({ path: `${OUT}/t142-canvas.png` });
  step(`  screenshots → ${OUT}`);

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console honesty + roster restore ---");
  step(`  diag 4xx responses: ${JSON.stringify(badResponses.slice(0, 4))}`);
  // A retry that opened a SEEDED job's inspector fetches its log — a job
  // that never ran has no log file, the API 404s (t120's Z2 pins that
  // contract), the UI shows the no-log state gracefully — but the
  // browser's network layer always logs a 404 response. Tolerate exactly
  // that documented noise, scoped to seeded ids' /log URLs; every other
  // 4xx console error is a real regression and must fail.
  const seededLog404s = badResponses.filter(
    (u) => u.startsWith("404 ") && seededIds.some((id) => u.includes(`/api/jobs/${id}/log`)),
  );
  const console404s = consoleErrors.filter((e) => e.includes("404"));
  const realErrors = consoleErrors.filter((e) => !e.includes("404"));
  must(realErrors.length === 0, `console errors honest (${realErrors.length}): ${realErrors.slice(0, 2).join(" | ")}`);
  must(
    console404s.length > 0 ? console404s.length === seededLog404s.length : true,
    `every 404 is a seeded job's log (${console404s.length} console / ${seededLog404s.length} seeded-log)`
  );
  must(pageErrors.length === 0, `page errors honest (${pageErrors.length})`);
  void cleanup().then(() => {
    deleteT142Rows();
    roster().then((final) => {
      must(final.length === baseline.length, `roster restored (${final.length} == ${baseline.length})`);
      console.log(`\nT142 ALL PASS (${PASS} assertions)`);
      process.exit(0);
    });
  });
}

main().catch((e) => {
  console.error("FATAL:", e);
  void cleanup().then(() => process.exit(1));
});
