// t141 — Task 141: the running card breathes — an elapsed readout.
//
// ETA (remaining, a "~" prediction) has been on the card for a while;
// the fact half was missing: HOW LONG has this job been running. The
// card's Row 3 now shows "1m 05s · ~12m" — fact first (teal, the
// running dialect the badge pulse speaks), prediction behind a muted
// dot. A 1s ticker (per-card, only while running) keeps the digits
// alive: a readout that never moves cannot be told apart from a hung
// one.
//
//   dialect  — formatElapsed differs from formatEta on purpose: a FACT
//              carries seconds ("12m 05s"), a PREDICTION must not
//              (false precision); no "~" on facts
//   honesty  — no startedAt → no elapsed (a clock without a start is
//              a lie); and the world backs this up: a running row with
//              a 2h-old startedAt gets honestly FAILED by the engine's
//              reconcile on the next roster GET (Task 135 doctrine,
//              black-boxed here) — long elapsed formats cannot survive
//              on faked data, so the probe's oracle for "1h 04m" is
//              lifted from the product source itself (Task 138
//              doctrine, function edition)
//   lifecycle— elapsed exists only while running; completion removes
//              it (the clock stops existing, it does not freeze — the
//              result line replaces it)
//
// Phase S — pre-clean T141 rows, snapshot roster, seed 6 jobs
//           (3 running, startedAt 5s/15s/30s ago — all inside the
//           120s reconcile grace window; 1 completed / 1 failed /
//           1 idle as non-running witnesses).
// Phase X — formatElapsed oracle: lifted from src/lib/elapsed.ts by
//           stripping `export ` and eval'ing — the product's formatter
//           is the only formatter. Covers s / m / h / clamp branches.
// Phase B — running cards carry [data-testid="card-elapsed"] with
//           parseable fact text; non-running witnesses carry none;
//           parsed seconds >= the seeded floor (the clock agrees with
//           the wall).
// Phase C — ticker liveness: two reads 2.6s apart strictly increase.
// Phase D — coexistence: progress-0 running card shows elapsed + the
//           % fallback (no ETA yet — pace needs a baseline).
// Phase E — reconcile honesty (negative): a running row with a 2h-old
//           startedAt is failed by the engine on the next roster GET;
//           its card shows the failed badge after reload.
// Phase F — lifecycle: stamp a running card completed (+ startedAt
//           null) → its elapsed readout disappears.
// Phase G — hover preview: reach the running card (find-reach), hover
//           its name, the preview bubble reads "… elapsed · 42% …";
//           screenshots (card close-up + canvas).
// Phase Z — console clean, T141 rows deleted, roster restored.
//
// Run: node scripts/t141-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { mkdirSync, readFileSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t141-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededIds = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

/** Stamp a job straight into the DB (qa75 / t135 / t140 precedent).
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

const deleteT141Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T141"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
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

/** ids of all rendered cards — the stage truth */
const renderedIds = async () =>
  p.locator("[data-job]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );

/** the elapsed readout on a card, or null when the card carries none */
const elapsedOf = async (id) => {
  const el = p.locator(`[data-job="${id}"] [data-testid="card-elapsed"]`);
  return (await el.count()) ? (await el.innerText()).trim() : null;
};

/** "42s" / "12m 05s" / "1h 04m" → seconds (NaN when unparseable) */
const parseElapsed = (t) => {
  if (!t) return NaN;
  let m = /^(\d+)s$/.exec(t);
  if (m) return +m[1];
  m = /^(\d+)m (\d{2})s$/.exec(t);
  if (m) return +m[1] * 60 + +m[2];
  m = /^(\d+)h (\d{2})m$/.exec(t);
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

async function main() {
  step("=== t141 — the running card breathes (elapsed readout) ===");
  mkdirSync(OUT, { recursive: true });

  /* ---------------- Phase S — baseline + seeded statuses ---------------- */
  step("--- Phase S: roster snapshot + T141 status matrix ---");
  deleteT141Rows(); // a KILLED previous run must not poison this one
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const seeds = [
    ["T141 Alpha", "motioncorr", "running", { ageMs: 5000, progress: 42 }],
    ["T141 Beta", "motioncorr", "running", { ageMs: 15000, progress: 0 }],
    ["T141 Gamma", "ctffind", "running", { ageMs: 30000, progress: 12 }],
    ["T141 Delta", "ctffind", "completed", {}],
    ["T141 Eps", "ctffind", "failed", {}],
    ["T141 Zeta", "import", "idle", {}],
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
    stamped.filter((j) => (j.name ?? "").startsWith("T141")).map((j) => [j.name, j]),
  );
  must(
    byName["T141 Alpha"]?.status === "running" &&
      byName["T141 Beta"]?.status === "running" &&
      byName["T141 Gamma"]?.status === "running" &&
      byName["T141 Delta"]?.status === "completed" &&
      byName["T141 Eps"]?.status === "failed" &&
      byName["T141 Zeta"]?.status === "idle",
    `S+ stamps verified via API (3 running / 1 completed / 1 failed / 1 idle)`
  );

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  let stage = null;
  for (let i = 0; i < 20; i++) {
    stage = await renderedIds();
    if (seededIds.every((id) => stage.includes(id))) break;
    await sleep(500);
  }
  must(seededIds.every((id) => stage.includes(id)), `all 6 seeds rendered on canvas (${stage.length} cards)`);

  /* ---------------- Phase X — formatElapsed oracle (source-lifted) ---------------- */
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

  /* ---------------- Phase B — presence + format dialect ---------------- */
  step("--- Phase B: running cards carry the readout, witnesses don't ---");
  const alphaText = await elapsedOf(seedIds["T141 Alpha"]);
  const betaText = await elapsedOf(seedIds["T141 Beta"]);
  const gammaText = await elapsedOf(seedIds["T141 Gamma"]);
  must(!!alphaText && !alphaText.startsWith("~"), `Alpha elapsed "${alphaText}" — a fact, no tilde`);
  must(!!betaText && !betaText.startsWith("~"), `Beta elapsed "${betaText}" — a fact, no tilde`);
  must(!!gammaText && !gammaText.startsWith("~"), `Gamma elapsed "${gammaText}" — a fact, no tilde`);
  const alphaSec = parseElapsed(alphaText);
  const betaSec = parseElapsed(betaText);
  const gammaSec = parseElapsed(gammaText);
  must(alphaSec >= 5 && alphaSec <= 110, `Alpha clock ≥ seeded floor 5s (${alphaSec}s, wall-agreeing)`);
  must(betaSec >= 15 && betaSec <= 110, `Beta clock ≥ seeded floor 15s (${betaSec}s)`);
  must(gammaSec >= 30 && gammaSec <= 115, `Gamma clock ≥ seeded floor 30s (${gammaSec}s)`);
  must(gammaSec >= betaSec && betaSec >= alphaSec, `clock order matches start order (${gammaSec} ≥ ${betaSec} ≥ ${alphaSec})`);
  for (const [name, label] of [["T141 Delta", "completed"], ["T141 Eps", "failed"], ["T141 Zeta", "idle"]]) {
    must((await elapsedOf(seedIds[name])) === null, `${label} witness carries no readout`);
  }

  /* ---------------- Phase C — ticker liveness ---------------- */
  step("--- Phase C: the readout breathes (1s tick) ---");
  const before = await elapsedOf(seedIds["T141 Beta"]);
  await sleep(2600);
  const after = await elapsedOf(seedIds["T141 Beta"]);
  must(parseElapsed(after) > parseElapsed(before), `ticker strictly advances "${before}" → "${after}"`);

  /* ---------------- Phase D — coexistence with the % fallback ---------------- */
  step("--- Phase D: elapsed + pct fallback (no ETA without pace) ---");
  const betaRow = await p
    .locator(`[data-job="${seedIds["T141 Beta"]}"]`)
    .evaluate((card) => {
      const row = card.querySelector(".h-4");
      return row ? row.textContent.replace(/\s+/g, " ").trim() : null;
    });
  must(/\d+s/.test(betaRow ?? "") || /\d+m \d{2}s/.test(betaRow ?? ""), `Beta row reads an elapsed (${betaRow})`);
  must(/\d+%/.test(betaRow ?? ""), `Beta row keeps the % fallback (${betaRow})`);
  const alphaRow = await p
    .locator(`[data-job="${seedIds["T141 Alpha"]}"]`)
    .evaluate((card) => {
      const row = card.querySelector(".h-4");
      return row ? row.textContent.replace(/\s+/g, " ").trim() : null;
    });
  // A directly-stamped static progress has no pace baseline → no ETA →
  // the honest % fallback renders next to the fact (no "·" separator).
  const alphaTextNow = await elapsedOf(seedIds["T141 Alpha"]);
  must(!!alphaTextNow && (alphaRow ?? "").startsWith(alphaTextNow), `Alpha row leads with the fact ("${alphaRow}" starts "${alphaTextNow}")`);
  must(/42%/.test(alphaRow ?? ""), `Alpha keeps the honest % fallback absent pace ("${alphaRow}")`);
  /* ---------------- Phase E — reconcile honesty (negative) ---------------- */
  step("--- Phase E: a 2h-old running row is honestly failed ---");
  const createdGhost = await (
    await api("/api/jobs", "POST", { type: "motioncorr", name: "T141 Ghost", x: 140, y: maxY + 240 * 7 })
  ).json();
  const ghost = createdGhost?.job ?? createdGhost;
  must(!!ghost?.id, "T141 Ghost created");
  seededIds.push(ghost.id);
  stampEx(ghost.id, "running", { ageMs: 2 * 3600 * 1000, progress: 77 });
  const afterGet = (await roster()).find((j) => j.id === ghost.id);
  must(afterGet?.status === "failed", `reconcile failed the stale row on the roster GET (${afterGet?.status})`);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  const ghostBadge = await p
    .locator(`[data-job="${ghost.id}"]`)
    .evaluate((card) => card.querySelector("[data-slot='badge']")?.textContent?.trim() ?? null);
  must(ghostBadge === "failed", `Ghost card shows the failed badge (${ghostBadge})`);
  must((await elapsedOf(ghost.id)) === null, "failed Ghost carries no readout");

  /* ---------------- Phase F — lifecycle: completion removes the clock ---------------- */
  step("--- Phase F: completion stops the clock (it does not freeze) ---");
  stampEx(seedIds["T141 Gamma"], "completed", { progress: 100 });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must((await elapsedOf(seedIds["T141 Gamma"])) === null, "completed Gamma carries no readout");

  /* ---------------- Phase G — hover preview + screenshots ---------------- */
  step("--- Phase G: the preview bubble speaks elapsed too ---");
  await reachViaFind("T141 Alpha");
  const alphaCard = p.locator(`[data-job="${seedIds["T141 Alpha"]}"]`);
  const alphaBox = await alphaCard.boundingBox();
  must(!!alphaBox, `Alpha card reachable in viewport (${JSON.stringify(alphaBox)})`);
  await alphaCard.locator("text=T141 Alpha").first().hover();
  await p.waitForSelector('[data-testid="preview-elapsed"]', { timeout: 6000 });
  const previewText = (await p.locator('[data-testid="preview-elapsed"]').innerText()).replace(/\s+/g, " ").trim();
  must(/elapsed/.test(previewText), `preview reads elapsed ("${previewText}")`);
  must(/42%/.test(previewText), `preview keeps the pct ("${previewText}")`);
  await p.screenshot({ path: `${OUT}/t141-preview.png` });
  await p.mouse.move(10, 10);
  await sleep(400);
  const cardShot = await alphaCard.boundingBox();
  await p.screenshot({
    path: `${OUT}/t141-card.png`,
    clip: { x: cardShot.x - 12, y: cardShot.y - 12, width: cardShot.width + 24, height: cardShot.height + 24 },
  });
  await p.screenshot({ path: `${OUT}/t141-canvas.png` });
  step(`  screenshots → ${OUT}`);

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console honesty + roster restore ---");
  must(consoleErrors.length === 0, `console errors honest (${consoleErrors.length}): ${consoleErrors.slice(0, 2).join(" | ")}`);
  must(pageErrors.length === 0, `page errors honest (${pageErrors.length})`);
  void cleanup().then(() => {
    deleteT141Rows();
    roster().then((final) => {
      must(final.length === baseline.length, `roster restored (${final.length} == ${baseline.length})`);
      console.log(`\nT141 ALL PASS (${PASS} assertions)`);
      process.exit(0);
    });
  });
}

main().catch((e) => {
  console.error("FATAL:", e);
  void cleanup().then(() => process.exit(1));
});
