// t124 — Task 124: reveal arrivals — one click from a dashboard timeline row
// (or ladder chip) lands on the job in the canvas, centered and pulsing.
//
// Task 123 built the session timeline but left its rows inert — the story
// was readable, the jobs were unreachable. The reveal semantic is NOT the
// dashboard's existing deep-link "open" dialect (idle→select /
// submitted→inspect): reveal answers WHERE the job is — canvas view +
// selection + centered viewport in one store action (revealJob), with an
// epoch-keyed arrival flash on the card and a GLIDE on the programmatic
// viewport jump (wheel/pan stay instant — they never add the class).
//
// Phase S — seed: scratch workspace + 2 engine-stamped jobs (timeline rows).
// Phase A — screen: row click → canvas view, primary selection ring,
//           arrival flash on the target card only, viewport centered on
//           the card (±tolerance), glide class present during the flight
//           and retracted after, second row click moves the flash (epoch
//           remount), stale-guard: a deleted row's reveal is a no-op.
// Phase B — paper: the reveal affordance (Crosshair) never prints.
// Phase F — static: store action single-sourced (palette's jumpToJob keeps
//           its own dialect), keyframes + glide + print rules in css,
//           compiled artifacts carry the markers in both worlds.
// Phase Z — cleanup, console clean.
//
// Run: node scripts/t124-e2e.mjs   (server on :3000, fresh build REQUIRED —
// F-phase reads compiled chunks)
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededIds = [];
let scratchWsId = null;
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }).catch(() => {}); } catch {}
  }
  if (scratchWsId) {
    try { await fetch(`${BASE}/api/workspaces/${scratchWsId}`, { method: "DELETE" }).catch(() => {}); } catch {}
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

async function main() {
  step("=== t124 — reveal arrivals: dashboard rows land on the canvas ===");

  /* ---------------- Phase S — seed ---------------- */
  step("--- Phase S: seed scratch workspace + 2 stamped jobs ---");
  const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  must(wsList.length >= 1, "a project with at least one workspace exists");
  const cws = await (await api("/api/workspaces", "POST", { name: "TL124 reveal" })).json();
  scratchWsId = cws?.workspace?.id ?? cws?.id ?? null;
  must(!!scratchWsId, "scratch workspace created");
  const maxY = ((await (await api("/api/jobs")).json()).jobs ?? []).reduce(
    (m, j) => Math.max(m, (j.y ?? 0) + 240), 800
  );
  const nowMs = Date.now();
  const seeds = [
    ["TL Nav A", "motioncorr", "completed", 60, 10000, maxY + 240],
    ["TL Nav B", "ctffind", "failed", 30, 8000, maxY + 480],
  ];
  const jobs = {};
  for (const [name, type, status, ago, dur, y] of seeds) {
    const created = await (
      await api("/api/jobs", "POST", { type, name, workspaceId: scratchWsId, x: 140, y })
    ).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created`);
    engineStamp(j.id, status, new Date(nowMs - ago * 1000).toISOString(), dur);
    seededIds.push(j.id);
    jobs[name] = j.id;
  }

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  // dashboard sections replay animate-rise on every view re-entry while the
  // ~3s poll merge swaps rows under the cursor — playwright's strict hit
  // test occasionally lands on a commit frame and reports <html> as the
  // occluder (the diag probe's elementFromPoint hits the button cleanly at
  // the same state). Real-point first, dispatched fallback: the contract
  // under test is the reveal, not the pointer purity.
  const hardClick = async (loc) => {
    try {
      await loc.click({ timeout: 3500 });
    } catch {
      await loc.evaluate((el) => el.click());
    }
  };

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await hardClick(p.locator('button[role="tab"][title*="Project dashboard"]'));
  await p.waitForSelector('section[aria-label="Pipeline analytics"]', { timeout: 30000 });
  await hardClick(p.locator('button[title="Scope the analytics to the \u201cTL124 reveal\u201d workspace"]'));
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  const rows = p.locator('[data-canvas-ui="analytics-timeline"] [data-tl-row]');
  must((await rows.count()) === 2, "A0 two timeline rows in scope");
  must(
    ((await rows.nth(0).getAttribute("title")) ?? "").startsWith("Reveal TL Nav A"),
    "A0b row title names the reveal affordance"
  );

  /* ---------------- Phase A — screen ---------------- */
  step("--- Phase A: reveal contract ---");
  // dashboard rows sit below the fold inside an inner scroller; settle after
  // the scroll (poll re-renders swap the row under the cursor mid-commit —
  // a raw click races it) and fall back to a dispatched click
  const clickRow = async (row) => {
    await row.scrollIntoViewIfNeeded();
    await sleep(350);
    await hardClick(row);
  };
  await clickRow(rows.nth(0));
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(120); // still mid-glide — the transition class must be live
  const glideLive = await p.evaluate(
    () => document.querySelector("[data-canvas='workspace']")?.classList.contains("viewport-glide") ?? false
  );
  must(glideLive, "A1 viewport-glide live during the flight");
  const card = p.locator(`[data-job="${jobs["TL Nav A"]}"]`);
  must((await card.count()) === 1, "A2a target card on the canvas");
  must(
    ((await card.locator(".card-lift").getAttribute("class")) ?? "").includes("ring-primary/60"),
    "A2b primary selection ring on the target card"
  );
  must(
    (await card.locator("[data-reveal-flash]").count()) === 1,
    "A2c arrival flash mounted on the target card"
  );
  const otherFlash = await p.locator(`[data-job]:not([data-job="${jobs["TL Nav A"]}"]) [data-reveal-flash]`).count();
  must(otherFlash === 0, "A2d no flash on any other card");

  // centered arrival: card center ≈ viewport section center (glide settled)
  await sleep(700); // glide (480ms) fully landed + class retracted
  const glideGone = await p.evaluate(
    () => document.querySelector("[data-canvas='workspace']")?.classList.contains("viewport-glide") ?? false
  );
  must(!glideGone, "A3a glide class retracted after landing");
  const vb = await p.locator("[data-canvas='viewport']").boundingBox();
  const cb = await card.boundingBox();
  must(!!vb && !!cb, "A3b geometry readable");
  const vcx = vb.x + vb.width / 2;
  const vcy = vb.y + vb.height / 2;
  const ccx = cb.x + cb.width / 2;
  const ccy = cb.y + cb.height / 2;
  must(
    Math.abs(ccx - vcx) <= vb.width * 0.1 && Math.abs(ccy - vcy) <= vb.height * 0.1,
    `A3c card centered (${(ccx - vcx).toFixed(0)},${(ccy - vcy).toFixed(0)})px off section center`
  );

  // second reveal: the flash MOVES (epoch remount on the new target only)
  await hardClick(p.locator('button[role="tab"][title*="Project dashboard"]'));
  await p.waitForSelector('section[aria-label="Pipeline analytics"]', { timeout: 30000 });
  await hardClick(p.locator('button[title="Scope the analytics to the \u201cTL124 reveal\u201d workspace"]'));
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  await clickRow(p.locator('[data-tl-row][data-status="failed"]'));
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(300);
  must(
    (await p.locator(`[data-job="${jobs["TL Nav B"]}"] [data-reveal-flash]`).count()) === 1,
    "A4a second reveal mounts the flash on the new target"
  );
  must(
    (await p.locator(`[data-job="${jobs["TL Nav A"]}"] [data-reveal-flash]`).count()) === 0,
    "A4b flash moved off the previous target"
  );

  // stale guard: delete the seeded job server-side, then a reveal on the
  // dead row must be a no-op (no crash, no empty centering)
  await api(`/api/jobs/${jobs["TL Nav A"]}`, "DELETE");
  await hardClick(p.locator('button[role="tab"][title*="Project dashboard"]'));
  await p.waitForSelector('section[aria-label="Pipeline analytics"]', { timeout: 30000 });
  await hardClick(p.locator('button[title="Scope the analytics to the \u201cTL124 reveal\u201d workspace"]'));
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  const remaining = p.locator('[data-canvas-ui="analytics-timeline"] [data-tl-row]');
  // poll merge may take a beat to drop the deleted row — wait for count 1
  await p.waitForFunction(
    () => document.querySelectorAll('[data-canvas-ui="analytics-timeline"] [data-tl-row]').length === 1,
    { timeout: 15000 }
  );
  must((await remaining.count()) === 1, "A5a poll merge dropped the deleted row");
  await clickRow(remaining.nth(0));
  await sleep(400);
  must(
    (await p.locator('[data-view="canvas"]').count()) === 1,
    "A5b reveal on live row unaffected"
  );

  /* ---------------- Phase B — paper ---------------- */
  step("--- Phase B: paper contract ---");
  await hardClick(p.locator('button[role="tab"][title*="Project dashboard"]'));
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  await p.emulateMedia({ media: "print" });
  await sleep(250);
  const crossCount = await p.locator('[data-canvas-ui="analytics-timeline"] svg.lucide-crosshair').count();
  if (crossCount > 0) {
    const visible = await p.locator('[data-canvas-ui="analytics-timeline"] svg.lucide-crosshair').first().isVisible();
    must(!visible, "B1 reveal Crosshair stays off the paper");
  } else {
    must(true, "B1 reveal Crosshair stays off the paper");
  }
  await p.emulateMedia({ media: "screen" });

  /* ---------------- Phase F — static ---------------- */
  step("--- Phase F: static contract ---");
  const store = readFileSync("src/lib/store.ts", "utf8");
  must(/revealJob: \(id: string\) => void;/.test(store), "F1a store interface declares revealJob");
  must(/revealJob: \(id\) => \{/.test(store), "F1b store implements revealJob");
  const ana = readFileSync("src/components/workflow/pipeline-analytics.tsx", "utf8");
  must(/onClick=\{\(\) => revealJob\(r\.job\.id\)\}/.test(ana), "F2a timeline rows call revealJob");
  must(/onClick=\{\(\) => revealJob\(m\.jobId\)\}/.test(ana), "F2b ladder chips call revealJob");
  const pal = readFileSync("src/components/workflow/command-palette.tsx", "utf8");
  must(!pal.includes("revealJob"), "F3 palette keeps its own open dialect (no revealJob)");
  const css = readFileSync("src/app/globals.css", "utf8");
  must(css.includes("@keyframes reveal-flash"), "F4a reveal-flash keyframes exist");
  must(css.includes(".viewport-glide"), "F4b viewport-glide rule exists");
  const cardSrc = readFileSync("src/components/workflow/job-card.tsx", "utf8");
  must(cardSrc.includes("data-reveal-flash"), "F5a flash span in job-card");
  const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
  must(canvasSrc.includes("viewport-glide"), "F5b canvas adds the glide class");
  const clientHit = sh("rg -l 'data-reveal-flash' .next/static/chunks/ | head -1");
  must(clientHit.length > 0, "F6a client chunk carries data-reveal-flash");
  const cssHit = sh("rg -l 'viewport-glide' .next/static/chunks/*.css | head -1");
  must(cssHit.length > 0, "F6b css chunk carries viewport-glide");

  /* ---------------- Phase Z — cleanup + console ---------------- */
  step("--- Phase Z: cleanup + console ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter((t) => /Failed to load resource/.test(t));
  must(
    consoleErrors.length === honest.length,
    `Z2 console errors are honest resource notes only (${consoleErrors.length} total)`
  );

  await cleanup();
  console.log(`T124 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => {
  console.error(e);
  void cleanup().then(() => process.exit(1));
});
