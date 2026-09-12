// t158 — Task 158: the workspace breathes while its jobs run.
//
// The canvas's RUNNING job cards have had their breathing teal halo since
// the .job-running glow shipped — the card is the heartbeat of the
// canvas. But the WORKSPACE SWITCHER (the sidebar listing every canvas
// inside the project) only showed a static count chip: to answer "where
// is work happening right now" you had to READ a number. Task 158 makes
// the workspace row's running chip breathe with the SAME 2.1s heartbeat
// as the card glow (.ws-running → run-breathe): motion is the headline,
// the count is the detail. color-mix against the shared --teal-glow var
// keeps both themes' hue coherent; prefers-reduced-motion freezes the
// chip at its resting tint (and the Loader2 inside is silenced with
// motion-reduce:animate-none — a continuous spinner is exactly the
// motion reduced-motion users opted out of).
//
// Phase S — ensure two workspaces + a RUNNING job in the first
//           (API POST + prisma stampEx, startedAt carried) + roster.
// Phase X — source oracles: the keyframes, the class + 2.1s cadence,
//           the reduced-motion downgrade, the color-mix/--teal-glow
//           theme coherence, the chip class wiring, the spinner's
//           motion-reduce silence, the conditional render anchor, the
//           Task 158 doc.
// Phase B — the workspace holding the running job renders the chip, and
//           its computed style IS the breathe: animation-name
//           run-breathe, duration ~2.1s, iteration infinite (CORE).
// Phase C — the idle workspace renders NO chip at all (absence is the
//           honest rest state — nothing breathes when nothing runs).
// Phase D — prefers-reduced-motion: the chip still shows the count but
//           its animation-name resolves to none (the freeze, verified
//           live in a reducedMotion context).
// Phase E — the run completes (prisma stamp) + reload → the chip is
//           gone: breathing follows the FACTS, not a memory of them.
// Phase G — screenshot: the breathing switcher.
// Phase Z — strict console + roster restored.
//
// Run: node scripts/t158-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t158-shot";
const WS_NAME = "QA WS Breathe";
const JOB_NAME = "QA Breathe Runner";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

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

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

/** flip a job's status straight in the DB (the engine's own write path —
 *  PATCH only allows idle; startedAt always carried, the runner's rule) */
const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

/** the workspace rows as the sidebar renders them: name → chip info */
const wsRows = async () =>
  p.evaluate(() => {
    const rows = [...document.querySelectorAll("[role=button]")].filter(
      (r) => r.querySelector('[aria-current="true"], .ws-running') || r.getAttribute("aria-current") != null
    );
    return [...document.querySelectorAll("div[role=button]")].map((r) => ({
      name: (r.querySelector("span, p, div")?.textContent || "").trim(),
      isCurrent: r.getAttribute("aria-current") === "true",
      chip: (() => {
        const chip = r.querySelector(".ws-running");
        if (!chip) return null;
        const cs = getComputedStyle(chip);
        return {
          text: (chip.textContent || "").trim(),
          animationName: cs.animationName,
          animationDuration: cs.animationDuration,
          animationIterationCount: cs.animationIterationCount,
        };
      })(),
    }));
  });

async function main() {
  /* ---------- Phase S — workspaces + a running job ---------------------- */
  step("--- Phase S: two workspaces + a RUNNING job in the first ---");
  const wsList0 = (await (await api("/api/workspaces")).json())?.workspaces ?? [];
  let breatheWs = wsList0.find((w) => w.name === WS_NAME);
  if (!breatheWs) {
    const r = await api("/api/workspaces", "POST", { name: WS_NAME });
    must(r.ok, "S1 the second workspace created (or already present)");
    breatheWs = (await r.json())?.workspace;
  }
  const mainWs = wsList0[0] ?? breatheWs;
  must(!!mainWs?.id && !!breatheWs?.id && mainWs.id !== breatheWs.id,
    "S2 two distinct workspaces exist");

  const roster0 = await roster();
  let runner = roster0.find((j) => j.name === JOB_NAME);
  if (!runner) {
    const r = await api("/api/jobs", "POST", {
      type: "motioncorr",
      name: JOB_NAME,
      x: 700,
      y: 420,
      workspaceId: mainWs.id,
    });
    must(r.ok, "S3 the runner job created");
    runner = (await r.json())?.job;
  }
  stampEx(runner.id, {
    status: "running",
    progress: 30,
    startedAt: new Date(Date.now() - 20_000).toISOString(),
  });
  const rosterBefore = (await roster()).length;

  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  /* ---------- Phase X — source oracles ----------------------------------- */
  step("--- Phase X: source oracle — the switcher twin ---");
  const css = execSync("cat src/app/globals.css", { cwd: "/home/z/my-project", encoding: "utf8" });
  const panel = execSync("cat src/components/workflow/workspace-panel.tsx", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/@keyframes run-breathe \{/.test(css),
    "oracle: the run-breathe keyframes exist");
  must(/\.ws-running \{\s*animation: run-breathe 2\.1s ease-in-out infinite;\s*\}/.test(css),
    "oracle: .ws-running rides the same 2.1s heartbeat as .job-running");
  must(/@media \(prefers-reduced-motion: reduce\) \{\s*\.ws-running \{\s*animation: none;\s*\}\s*\}/.test(css),
    "oracle: the reduced-motion downgrade freezes the chip");
  must(/color-mix\(in oklch, var\(--teal-glow\) 22%, transparent\)/.test(css),
    "oracle: the pulse mixes against the shared --teal-glow var (theme-coherent)");
  must(/className="ws-running inline-flex h-5 items-center gap-1 rounded-md bg-teal-500\/10/.test(panel),
    "oracle: the running chip carries the ws-running class");
  must(/Loader2 className="size-3 animate-spin motion-reduce:animate-none"/.test(panel),
    "oracle: the chip's spinner is silenced under reduced motion");
  must(/\{stats\.running > 0 && \(/.test(panel),
    "oracle: the chip renders only when running > 0 (conditional anchor)");
  must(css.includes("the switcher twin of"),
    "oracle: the Task 158 rationale lives in the source");

  /* ---------- Phase B — the breathing chip, computed ---------------------- */
  step("--- Phase B: the workspace holding the run breathes (CORE) ---");
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  // the switcher lives behind the left panel's Workspaces tab (Catalog is
  // the default) — Radix TabsTrigger takes a real click
  await p.getByRole("tab", { name: /Workspaces/ }).click({ timeout: 8000 });
  await sleep(900);
  const rows1 = await wsRows();
  const activeRow = rows1.find((r) => r.isCurrent);
  must(!!activeRow, "B1 the active workspace row is present in the sidebar");
  must(!!activeRow.chip, "B2 the active workspace (holding the run) renders the chip");
  must(activeRow.chip.animationName === "run-breathe",
    `B3 the chip's animation IS run-breathe (got ${activeRow.chip.animationName})`);
  must(Math.abs(parseFloat(activeRow.chip.animationDuration) - 2.1) < 0.05,
    `B4 the duration is the shared 2.1s heartbeat (got ${activeRow.chip.animationDuration})`);
  must(activeRow.chip.animationIterationCount === "infinite",
    "B5 the breath is continuous (iteration-count infinite)");
  const expectedRunning = (await roster()).filter(
    (j) => j.status === "running" && (j.workspaceId ?? "") === mainWs.id
  ).length;
  must(activeRow.chip.text === String(expectedRunning),
    `B6 the chip counts the workspace's runs (got "${activeRow.chip.text}", expected ${expectedRunning})`);

  /* ---------- Phase C — the idle workspace rests -------------------------- */
  step("--- Phase C: the idle workspace renders no chip ---");
  const idleRow = rows1.find((r) => !r.isCurrent && r.name.includes("QA WS Breathe"));
  must(!!idleRow, "C1 the idle QA workspace row is present");
  must(idleRow.chip === null, "C2 no chip when nothing runs there (honest rest)");

  /* ---------- Phase D — reduced motion freezes the chip ------------------- */
  step("--- Phase D: prefers-reduced-motion freezes the breath ---");
  const page2 = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page2.goto(BASE, { waitUntil: "networkidle" });
  await page2.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await page2.getByRole("tab", { name: /Workspaces/ }).click({ timeout: 8000 });
  await sleep(900);
  const rm = await page2.evaluate(() => {
    const chip = document.querySelector(".ws-running");
    if (!chip) return null;
    const cs = getComputedStyle(chip);
    return { text: (chip.textContent || "").trim(), animationName: cs.animationName };
  });
  must(rm != null, "D1 the chip still renders under reduced motion");
  must(rm.text === String(expectedRunning), "D2 the count still informs");
  must(rm.animationName === "none", `D3 the breath is frozen (animation-name ${rm.animationName})`);
  await page2.close();

  /* ---------- Phase E — breathing follows the facts ----------------------- */
  step("--- Phase E: completing runs drains the chip, zero runs rests ---");
  stampEx(runner.id, { status: "completed", progress: 100 });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await p.getByRole("tab", { name: /Workspaces/ }).click({ timeout: 8000 });
  await sleep(900);
  const afterOne = await wsRows();
  const expectedAfterOne = (await roster()).filter(
    (j) => j.status === "running" && (j.workspaceId ?? "") === mainWs.id
  ).length;
  // the INVARIANT, not a sequence: the chip's presence and count mirror
  // the workspace's actual running set — a previous run of this probe may
  // have already drained the world's other runs, and the assert holds
  // either way
  const chip1 = afterOne.find((r) => r.isCurrent)?.chip ?? null;
  if (expectedAfterOne === 0) {
    must(chip1 === null, "E1 zero runs → no chip (honest rest, world already drained)");
  } else {
    must(chip1?.text === String(expectedAfterOne),
      `E1 the count dropped with the completed run (now "${chip1?.text}", expected ${expectedAfterOne})`);
  }
  // drain the workspace to zero runs — the honest rest state
  for (const j of (await roster()).filter(
    (x) => x.status === "running" && (x.workspaceId ?? "") === mainWs.id
  )) {
    stampEx(j.id, { status: "completed", progress: 100 });
  }
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await p.getByRole("tab", { name: /Workspaces/ }).click({ timeout: 8000 });
  await sleep(900);
  const afterAll = await wsRows();
  must(afterAll.find((r) => r.isCurrent)?.chip === null,
    "E2 zero runs → no chip: the workspace rests when nothing runs");

  /* ---------- Phase G — screenshot ---------------------------------------- */
  step("--- Phase G: screenshot ---");
  execSync(`mkdir -p ${OUT}`, { cwd: "/home/z/my-project" });
  stampEx(runner.id, {
    status: "running",
    progress: 40,
    startedAt: new Date(Date.now() - 10_000).toISOString(),
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await p.getByRole("tab", { name: /Workspaces/ }).click({ timeout: 8000 });
  await sleep(900);
  const shot = await wsRows();
  must(shot.find((r) => r.isCurrent)?.chip?.animationName === "run-breathe",
    "G1 the breath is back for the shot");
  await p.screenshot({ path: `${OUT}/t158-workspace-breathing.png` });

  /* ---------- Phase Z — strict console + roster --------------------------- */
  step("--- Phase Z: strict console + roster ---");
  must(consoleErrors.length === 0, `Z1 0 console errors (got ${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")})`);
  must(pageErrors.length === 0, `Z2 0 page errors (got ${pageErrors.length})`);
  must(badResponses.length === 0, `Z3 0 responses >= 400 (got: ${badResponses.slice(0, 3).join(" | ")})`);
  const rosterAfter = (await roster()).length;
  must(rosterAfter === rosterBefore, `Z4 roster restored (${rosterAfter} == ${rosterBefore})`);

  console.log(`\nT158 ALL PASS (${PASS} assertions)`);
  await cleanup();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup();
  process.exit(1);
});
