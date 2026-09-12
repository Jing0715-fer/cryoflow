// t145 — Task 145: the completion announcement speaks the fact dialect.
//
// The poll's transition sweep has always announced running → completed /
// failed as a toast — but the announcement was name-only. Task 145 makes
// it speak the SAME fact dialect the card (t141), footer (t142), roster
// (t142) and tab (t143) already speak:
//   title   "T145 Alpha completed · 1m 05s" — the job's elapsed, read at
//           the moment it becomes final. formatElapsed canon, zero drift.
//   silence a job with NO startedAt (the never-engine-backed fixture
//           shape) gets NO fragment — formatElapsed would honestly clamp
//           NaN to "0s", and "ran for 0s" is a lie of precision; the
//           honest form of "unknown" is silence (无起点无读数, t142's
//           doctrine, now at announcement level). Clock skew reads as
//           silence too — a clock never reads backwards.
//   action  every announcement carries a one-tap "View" — the bridge from
//           hearing the news to reading the results: setView("canvas") +
//           inspect(job.id), verified from the DASHBOARD side (the full
//           bridge, not just the dialog).
//   expiry  news expires (duration 9s, the import-undo 12s precedent's
//           sibling) — the state itself lives in the chrome census (card,
//           footer, tab, favicon), not in a toast that piles up forever.
//
// Phase S — pre-clean T145 rows, snapshot roster, seed 4 runners (Alpha
//           startedAt 65s ago, Beta 42s, Gamma 30s — all inside the 120s
//           reconcile grace window; Mute also enters WITH a start).
// Phase B — complete Alpha (with result text) → toast "T145 Alpha
//           completed · 1m XXs" (parsed ≥ 65s floor, wall-agreeing),
//           description carries the stamped result, "View" action present.
// Phase C — click View FROM THE DASHBOARD (toasts render globally): the
//           bridge must land on the canvas with the inspector dialog open
//           on Alpha — hearing the news → reading the results.
// Phase D — complete Beta (result null) → title fact, description
//           honestly absent (no result, no fabrication).
// Phase E — fail Gamma → destructive variant (border-destructive class),
//           fact fragment parses ≥ 30s.
// Phase F — Mute flips to failed with startedAt pulled in the SAME
//           stamp → the announcement title is EXACTLY "T145 Mute failed"
//           — no "· 0s" lie. The honest unknown is silence.
// Phase G — screenshot the announcement stack.
// Phase Z — console clean (tolerance scoped to the inspector's seeded
//           /log fetch — the t142 radius), T145 rows deleted, roster
//           restored.
//
// Run: node scripts/t145-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t145-shot";
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
 *  A "running" stamp MUST carry a fresh startedAt: the engine's reconcile
 *  treats a running row with no engine record older than 120s as stale
 *  and honestly fails it — a fresh startedAt is the grace-window ticket.
 *  Mute is the deliberate exception: startedAt=null is the fixture shape
 *  whose honesty (no elapsed) this probe pins. opts: { ageMs, progress,
 *  result } ride along as prisma data. */
const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const deleteT145Rows = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T145"}}}).then(r=>{console.log("deleted",r.count);return p.$disconnect()})'`,
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

/** "42s" / "12m 05s" / "1h 04m" → seconds (NaN when unparseable) — the
 *  parse side of the t142 oracle (the format side is lifted verbatim
 *  from src/lib/elapsed.ts below). */
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

const TOAST = 'ol > li[data-state="open"]';

// Radix renders the toast li WITHOUT role/status and WITHOUT data-title —
// the title is a text PREFIX of the li (title + description + "View").
// Assertions read li.textContent and parse the prefix; the action is the
// li's own "View" button.

/** wait for a toast whose text matches `frag` — the poll fires on a 1.2s
 *  cadence while runners live, 6s in an idle world (anyActive gate); 10s
 *  of patient 250ms sampling covers one slow cycle plus slack. */
const waitForToast = async (frag, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    const loc = p.locator(TOAST, { hasText: frag });
    if ((await loc.count()) > 0) return loc.first();
    await sleep(250);
  }
  return null;
};

async function main() {
  /* ---------------- Phase S — clean world, seeds, premise ---------------- */
  step("--- Phase S: world snapshot, seeds (3 timed runners + 1 mute) ---");
  deleteT145Rows();
  const before = await roster();
  const rosterBefore = before.length;

  const maxY = before.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const seedEpoch = Date.now();
  const seeds = [
    // three timed runners — ages staggered so each oracle has its own band
    ["T145 Alpha", "import", { status: "running", progress: 80, startedAt: new Date(Date.now() - 65_000).toISOString() }],
    ["T145 Beta", "ctffind", { status: "running", progress: 55, startedAt: new Date(Date.now() - 42_000).toISOString() }],
    ["T145 Gamma", "motioncorr", { status: "running", progress: 30, startedAt: new Date(Date.now() - 30_000).toISOString() }],
    // the honest-silence oracle: enters WITH a startedAt (the client must
    // see it running), then phase F pulls the startedAt and lets the
    // RECONCILE do the honest kill — the announcement must stay silent
    ["T145 Mute", "import", { status: "running", progress: 10, startedAt: new Date().toISOString() }],
  ];
  let y = maxY + 240;
  for (const [name, type, data] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type})`);
    seededIds.push(j.id);
    stampEx(j.id, data);
    y += 240;
  }
  const stamped = await roster();
  const byName = Object.fromEntries(stamped.filter((j) => (j.name ?? "").startsWith("T145")).map((j) => [j.name, j]));
  must(
    byName["T145 Alpha"]?.status === "running" && !!byName["T145 Alpha"]?.startedAt &&
      byName["T145 Beta"]?.status === "running" && byName["T145 Gamma"]?.status === "running" &&
      byName["T145 Mute"]?.status === "running" && !!byName["T145 Mute"]?.startedAt,
    "S: stamps verified (4 runners, all with fresh startedAt — grace-window tickets)"
  );
  const ids = Object.fromEntries(seededIds.map((id) => [stamped.find((j) => j.id === id)?.name, id]));

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase X — formatElapsed oracle lifted from source ---------------- */
  step("--- Phase X: formatElapsed oracle lifted from product source ---");
  const src = readFileSync("/home/z/my-project/src/lib/elapsed.ts", "utf8")
    .replace(/^import .*$/gm, "")
    .replace(/export /g, "");
  const formatElapsedOracle = new Function(`${src}; return formatElapsed;`)();
  must(formatElapsedOracle(65_000) === "1m 05s", "oracle: 65s → 1m 05s (padded seconds)");
  must(formatElapsedOracle(42_000) === "42s", "oracle: 42s → 42s (fact grain)");
  must(formatElapsedOracle(NaN) === "0s", "oracle: NaN clamps (which is why startedAt-less rows must be SILENT, not formatted)");

  /* ---------------- Phase B — the completed announcement speaks the fact ---------------- */
  step("--- Phase B: complete Alpha → the toast reads 'completed · 1m XXs' ---");
  // fire from the DASHBOARD so phase C verifies the FULL bridge (toast →
  // canvas view + inspector), not just a dialog opening in place
  const dashTab = p.locator('button[role="tab"][title*="Project dashboard"]');
  await dashTab.click({ timeout: 6000 }).catch(() => dashTab.click({ force: true, timeout: 6000 }));
  await sleep(1000);
  stampEx(ids["T145 Alpha"], { status: "completed", progress: 100, result: "42 movies imported" });
  const alphaToast = await waitForToast("T145 Alpha completed");
  must(!!alphaToast, "announcement toast appeared (from the dashboard — toasts render globally)");
  const alphaText = (await alphaToast.textContent()) ?? "";
  const mAlpha = /^T145 Alpha completed · 1m (\d{2})s/.exec(alphaText);
  must(!!mAlpha, `title speaks the fact dialect ("${alphaText.slice(0, 60)}")`);
  const alphaSec = 60 + +mAlpha[1];
  must(alphaSec >= 65 && alphaSec <= 85, `elapsed wall-agrees (${alphaSec}s ∈ [65..85] — 65s age + poll-to-toast delay)`);
  must(alphaText.includes("42 movies imported"), "description carries the job's result text");
  must((await alphaToast.getByRole("button", { name: "View" }).count()) === 1, 'announcement carries a "View" action');

  /* ---------------- Phase C — the bridge: news → results ---------------- */
  step("--- Phase C: View lands on the canvas with Alpha's inspector open ---");
  await alphaToast.getByRole("button", { name: "View" }).click();
  await sleep(1200);
  await p.waitForSelector('[data-view="canvas"]', { timeout: 8000 });
  must(true, "view switched to the canvas (setView part of the bridge)");
  const alphaDialog = p.locator('[role="dialog"]', { hasText: "T145 Alpha" });
  await alphaDialog.waitFor({ timeout: 8000 });
  must(true, "inspector dialog open on Alpha (inspect part of the bridge)");
  await p.keyboard.press("Escape");
  await sleep(600);

  /* ---------------- Phase D — completed without a result: no fabrication ---------------- */
  step("--- Phase D: complete Beta (no result) → fact on title, silence on description ---");
  stampEx(ids["T145 Beta"], { status: "completed", progress: 100 });
  const betaToast = await waitForToast("T145 Beta completed");
  must(!!betaToast, "Beta announcement appeared");
  const betaText = ((await betaToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  const mBeta = /^T145 Beta completed · (\d+)sView$/.exec(betaText);
  must(!!mBeta && +mBeta[1] >= 42 && +mBeta[1] <= 60, `Beta fact "${betaText}" parses to ${mBeta ? mBeta[1] : "?"}s ∈ [42..60] and fabricates NO description`);

  /* ---------------- Phase E — the failed announcement: alarm dialect ---------------- */
  step("--- Phase E: fail Gamma → destructive variant with the fact ---");
  stampEx(ids["T145 Gamma"], { status: "failed", progress: 0 });
  const gammaToast = await waitForToast("T145 Gamma failed");
  must(!!gammaToast, "failure announcement appeared");
  const gammaText = ((await gammaToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  const mGamma = /^T145 Gamma failed · (\d+)s/.exec(gammaText);
  must(!!mGamma && +mGamma[1] >= 30 && +mGamma[1] <= 50, `failure fact "${gammaText.slice(0, 50)}" parses to ${mGamma ? mGamma[1] : "?"}s ∈ [30..50]`);
  const gammaCls = (await gammaToast.getAttribute("class")) ?? "";
  must(/destructive/.test(gammaCls), "failure toast carries the destructive variant (border-destructive family)");
  must((await gammaToast.getByRole("button", { name: "View" }).count()) === 1, 'failure announcement also carries "View"');

  /* ---------------- Phase F — the honest unknown: silence, not "0s" ---------------- */
  step("--- Phase F: Mute flips to failed with NO startedAt → the announcement stays SILENT about elapsed ---");
  // The client has SEEN Mute running (prev = running). One atomic stamp
  // flips it to failed AND pulls startedAt — the transition response
  // carries job.startedAt = null. formatElapsed would read "0s" — a lie
  // of precision. The honest form of unknown is silence.
  stampEx(ids["T145 Mute"], { status: "failed", progress: 0, startedAt: null });
  const muteToast = await waitForToast("T145 Mute failed");
  must(!!muteToast, "failure announcement for the start-less runner appeared");
  const muteText = ((await muteToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  // Task 151 appended the Retry bridge to every failed notice, so the
  // verbatim form grew a "Retry" tail — the point of this assertion is
  // still the ABSENCE of any "· 0s" time fragment for a start-less job.
  must(muteText === "T145 Mute failedViewRetry", `mute toast reads exactly "${muteText}" — no "· 0s" lie for a job with no start`);

  /* ---------------- Phase G — screenshots ---------------- */
  step("--- Phase G: screenshot the announcement stack ---");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t145-announcements.png` });
  must(true, "screenshot recorded");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  // Tolerance with a radius (t142 pattern): opening Alpha's inspector
  // fetches its /log — a stamped job has no engine log file, the endpoint
  // honestly 404s, and the browser network layer always records non-2xx.
  // Tolerate ONLY 404s on the seeded ids' /log URLs, all else fails.
  const seedIds = seededIds;
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
  deleteT145Rows();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT145 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
