/* t178 — Motion drift panel (the MotionCorr surface earns its chart).
 *
 * The world's MotionCorr jobs have never had a per-micrograph motion view:
 * corrected_micrographs.star carries _rlnAccumulatedMotionTotal/Early/Late
 * (Å) per movie, and nobody reads it. Task 178 adds
 *   /api/jobs/[id]/motion   (block-aware STAR parse)
 *   MotionDriftChart        (stacked early/late bars, worst-first, mean+2σ
 *                            offender badge + detail table)
 *   report section          (buildMotionDriftSvg + motionTableMarkdown)
 * This probe pins the whole chain — API contract, in-app panel, report
 * builder — and OWNS its fixture: the mock catalogue it seeds into the
 * QA MotionCorr workdir is removed at the end (self-seed/self-clean, the
 * Task 87 doctrine: a consumer must not depend on accidents).
 *
 * Assertions: S baseline · X source oracles · M/D live panel (mobile +
 * desktop) · Z roster identity + fixture cleanup proof.
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import path from "path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");

let pass = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}
function section(name) {
  console.log(`== ${name} ==`);
}

const browser = await chromium.launch();
const consoleErrors = [];
const failedUrls = [];
function trackConsole(pageRef, label) {
  pageRef.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ label, text: msg.text() });
  });
  pageRef.on("requestfailed", (req) => {
    failedUrls.push({ label, url: req.url() });
  });
  pageRef.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push({ label, url: res.url(), status: res.status() });
  });
}

/* ============ fixture: self-seed the mock catalogue ============ */
const MOCK = readFileSync(path.resolve("scripts/qa-fixtures/mock-motion.star"), "utf8");

function motionWorkdirFor(jobId) {
  const state = JSON.parse(readFileSync(path.resolve("data/engine-state.json"), "utf8"));
  const entry = state[jobId] ?? Object.values(state).find((j) => j?.id === jobId);
  return entry?.workdir ?? null;
}

const list0 = await (await fetch(BASE + "/api/jobs")).json();
const roster0 = (Array.isArray(list0) ? list0 : list0.jobs ?? []).map((j) => ({ id: j.id, name: j.name }));
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
const motionJob = jobs0.find((j) => /^motioncorr$/i.test(j.type) && j.status === "completed");
const seedDir = motionJob ? motionWorkdirFor(motionJob.id) : null;
const seedFile = seedDir ? path.join(seedDir, "corrected_micrographs.star") : null;
let weSeeded = false;
if (seedFile && !existsSync(seedFile)) {
  writeFileSync(seedFile, MOCK);
  weSeeded = true;
} else if (seedFile) {
  // a real catalogue lives there — leave it untouched, we don't own it
  weSeeded = false;
}

try {
  /* ============ S: baseline ============ */
  section("S: baseline");
  must(roster0.length === 23, `S1 roster 23 jobs (${roster0.length})`);
  must(!!motionJob, `S2 a completed MotionCorr job exists (${motionJob?.name ?? "none"})`);
  must(!!seedDir, "S3 the engine-state entry carries a workdir");

  /* ============ X: source oracles ============ */
  section("X: source oracles");
  const apiSrc = src("src/app/api/jobs/[id]/motion/route.ts");
  must(apiSrc.includes("corrected_micrographs.star"), "X1 the motion API reads corrected_micrographs.star");
  must(
    apiSrc.includes("_rlnAccumulatedMotionTotal") && apiSrc.includes("_rlnAccumulatedMotionEarly") && apiSrc.includes("_rlnAccumulatedMotionLate"),
    "X2 the parser freezes the three accumulated-motion columns"
  );
  must(
    apiSrc.includes("data_") && apiSrc.includes("loop_") && apiSrc.includes("cols = freeze()"),
    "X3 block-aware parse (optics rows can never leak — the ctf freeze rule)"
  );
  const rowsSrc = src("src/lib/chart-rows.ts");
  must(rowsSrc.includes("motionRows") && rowsSrc.includes('"total drift (A)"'), "X4 motionRows derivation + CSV columns");
  must(rowsSrc.includes('key: "motion"') && rowsSrc.includes("/api/jobs/${id}/motion"), "X5 motion registered in the export targets");
  const chartSrc = src("src/components/workflow/results/motion-drift-chart.tsx");
  must(chartSrc.includes("data-motion-panel") && chartSrc.includes("data-motion-offender-badge"), "X6 the panel + offender badge carry probe markers");
  must(chartSrc.includes("mean + 2 * sd"), "X7 the outlier threshold is mean + 2σ (the run's own scale)");
  must(chartSrc.includes("stackId=\"drift\"") && chartSrc.includes('dataKey="early"') && chartSrc.includes('dataKey="late"'), "X8 the bars stack early+late (the diagnosis split)");
  const inspSrc = src("src/components/workflow/job-inspector.tsx");
  must(
    inspSrc.includes("isMotionType = /^motioncorr$/i") && inspSrc.includes("<MotionDriftChart jobId={job.id} />"),
    "X9 the inspector mounts the panel for motioncorr jobs"
  );
  const rvSrc = src("src/components/workflow/results/results-view.tsx");
  must(
    rvSrc.includes("buildMotionDriftSvg") && rvSrc.includes("motionTableMarkdown") && rvSrc.includes('"## Accumulated motion"'),
    "X10 the report grows its motion section (svg + table + heading)"
  );
  const snapSrc = src("src/lib/report-snapshots.ts");
  must(
    snapSrc.includes("buildMotionDriftSvg") && snapSrc.includes("sort((a, b) => b.total - a.total)"),
    "X11 the report SVG sorts worst-first (the offender is the first bar)"
  );

  /* ============ M: live panel at 390 (mobile) ============ */
  section("M: live panel (390 mobile)");
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const mpage = await mctx.newPage();
  trackConsole(mpage, "mobile");
  await mpage.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2200);

  // open the completed MotionCorr job's sheet (tap the card). On mobile the
  // job detail is the SHEET (Task 171) — the motion panel lives in the
  // desktop inspector's Overview tab (the same convention as every other
  // chart panel: CTF/Guinier/FSC). Here we pin the honest absence: the
  // sheet opens, its Results body renders, and no motion panel pretends
  // to exist.
  const opened = await mpage.evaluate(async (want) => {
    const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    if (!card) return { ok: false, why: "card-not-found" };
    const r = card.getBoundingClientRect();
    const body = document.querySelector('[data-canvas="workspace"]');
    const t = body ? getComputedStyle(body).transform : "none";
    const m = new DOMMatrixReadOnly(t === "none" ? "" : t);
    if (r.left < 0 || r.right > innerWidth) {
      // compute a pan so the card lands on-canvas (Task 176 doctrine:
      // placement must be computed, not wandered)
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const wantX = innerWidth * 0.55, wantY = innerHeight * 0.45;
      return { ok: true, pan: { dx: wantX - cx, dy: wantY - cy } };
    }
    return { ok: true, pan: null, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, motionJob.id);
  must(opened.ok, `M0 the MotionCorr card is locatable (${JSON.stringify(opened).slice(0, 60)})`);

  const cardPoint = async (pageRef, id) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      // spiral within the card until elementFromPoint BELONGS to this card
      // (t177 doctrine: the 16px edge corridors eat the center of a small
      // card — 28 points sweep the whole body)
      const spot = await pageRef.evaluate((want) => {
        const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
        if (!card) return null;
        const r = card.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const offs = [];
        for (const dx of [-45, -30, -15, 0, 15, 30, 45]) for (const dy of [-15, -5, 5, 15]) offs.push([dx, dy]);
        for (const [dx, dy] of offs) {
          const px = Math.min(Math.max(cx + dx, r.left + 3), r.left + r.width - 3);
          const py = Math.min(Math.max(cy + dy, r.top + 3), r.top + r.height - 3);
          const el = document.elementFromPoint(px, py);
          if (el && el.closest(`[data-job="${want}"]`)) return {
            x: px, y: py,
            inVp: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          };
        }
        return null;
      }, id);
      if (spot && spot.inVp) return spot;
      // pan the canvas toward the card's world slot (computed delta)
      const delta = await pageRef.evaluate((want) => {
        const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
        if (!card) return null;
        const r = card.getBoundingClientRect();
        const w = document.querySelector('[data-canvas="workspace"]');
        const t = w ? getComputedStyle(w).transform : "none";
        const m = new DOMMatrixReadOnly(t === "none" ? "" : t);
        return { dx: innerWidth * 0.55 - (r.left + r.width / 2), dy: innerHeight * 0.45 - (r.top + r.height / 2), zoom: m.a };
      }, id);
      if (!delta) break;
      const start = await pageRef.evaluate(() => {
        const cands = [[0.5, 0.42], [0.5, 0.66], [0.28, 0.42], [0.72, 0.42], [0.5, 0.82], [0.3, 0.8]]
          .map(([fx, fy]) => [Math.round(innerWidth * fx), Math.round(innerHeight * fy)]);
        for (const [sx, sy] of cands) {
          const el = document.elementFromPoint(sx, sy);
          if (el && el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button")) return [sx, sy];
        }
        return null;
      });
      if (!start) break;
      await pageRef.mouse.move(start[0], start[1]);
      await pageRef.mouse.down();
      await pageRef.mouse.move(start[0] + delta.dx, start[1] + delta.dy, { steps: 8 });
      await pageRef.mouse.up();
      await sleep(900);
    }
    return null;
  };
  const spot = await cardPoint(mpage, motionJob.id);
  must(!!spot, `M1 the card is placed into the viewport (${spot ? `${Math.round(spot.x)},${Math.round(spot.y)}` : "never"})`);
  await mpage.mouse.click(spot.x, spot.y);
  await sleep(2400);
  const sheetState = await mpage.evaluate(() => {
    const sheet = document.querySelector("[data-panel-sheet]");
    const dlg = document.querySelector("[data-inspector-dialog]");
    const panel = document.querySelector("[data-motion-panel]");
    return { sheet: !!sheet, dialog: !!dlg, panel: !!panel };
  });
  must(sheetState.sheet || sheetState.dialog, "M2 the job detail surface opens on mobile");
  must(!sheetState.panel, "M3 the motion panel is honestly ABSENT from the mobile sheet (charts live in the desktop inspector — the standing convention)\n");
  const mConsole = consoleErrors.filter((e) => e.label === "mobile");
  must(mConsole.length === 0, `M4 mobile console clean (${mConsole.length})`);
  await mctx.close();

  /* ============ D: live panel at 1440 + report chain ============ */
  section("D: desktop + report");
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dpage = await dctx.newPage();
  trackConsole(dpage, "desktop");
  await dpage.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2200);
  // zoom in FIRST — at the 25% floor the 16px hover corridors eat the card
  // bodies and the spiral has nowhere honest to click (t177 doctrine ③)
  for (let i = 0; i < 3; i++) {
    await dpage.evaluate(() => document.querySelector('button[aria-label="Zoom in"]')?.click());
    await sleep(450);
  }
  const dspot = await cardPoint(dpage, motionJob.id);
  must(!!dspot, `D0 the card is placed on desktop (${dspot ? `${Math.round(dspot.x)},${Math.round(dspot.y)}` : "never"})`);
  if (dspot) {
    await dpage.mouse.click(dspot.x, dspot.y);
    await sleep(2400);
    // completed jobs open on the RESULTS tab (report view) — the charts
    // live on the Overview tab. Radix triggers activate on REAL pointer
    // events: el.click() in evaluate never flips the tab (t176 doctrine)
    await dpage.locator('[data-inspector-dialog] [role="tab"]', { hasText: "Overview" }).first().click({ timeout: 4000 });
    await sleep(1600);
    const dpanel = await dpage.evaluate(() => {
      const p = document.querySelector("[data-motion-panel]");
      const svg = p?.querySelector("svg.recharts-surface");
      const bars = document.querySelectorAll(".recharts-bar-rectangle path");
      const badge = document.querySelector("[data-motion-offender-badge]");
      const rows = document.querySelectorAll("[data-motion-panel] button[aria-expanded]");
      return {
        panel: !!p,
        svgW: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
        bars: bars.length,
        badge: badge ? (badge.textContent || "").trim() : null,
        toggles: rows.length,
      };
    });
    must(dpanel.panel, "D1 the panel mounts on the Overview tab");
    must(dpanel.svgW >= 600, `D2 the chart fills the card (${dpanel.svgW}px)`);
    must(dpanel.bars >= 3, `D3 bar segments alive (${dpanel.bars})`);
    must(dpanel.badge && /1 outlier/.test(dpanel.badge), `D4 the offender badge names 1 outlier ≥ threshold (“${dpanel.badge}”)`);
    // expand the detail table — worst-first is the sort contract
    await dpage.evaluate(() => {
      const p = document.querySelector("[data-motion-panel]");
      const btn = [...(p?.querySelectorAll("button") ?? [])].find((b) => b.getAttribute("aria-expanded") != null);
      btn?.click();
    });
    await sleep(600);
    const table = await dpage.evaluate(() => {
      const t = document.querySelector("[data-motion-table]");
      if (!t) return null;
      const rows = [...t.querySelectorAll("tbody tr")];
      return { rows: rows.length, first: rows[0]?.textContent ?? "" };
    });
    must(!!table && table.rows === 24, `D5 the detail table lists all 24 micrographs (${table?.rows ?? 0})`);
    must(!!table && table.first.includes("movie_011"), "D6 the table sorts worst-first (movie_011 tops it)");
  }
  const dConsole = consoleErrors.filter((e) => e.label === "desktop");
  must(dConsole.length === 0, `D7 desktop console clean (${dConsole.length})`);
  await dctx.close();

  /* ============ R: API contract math (the report builder's input) ======= */
  section("R: API contract math");
  {
    const d = await (await fetch(`${BASE}/api/jobs/${motionJob.id}/motion`)).json();
    must(d.sourceFile === "corrected_micrographs.star" && d.micrographs.length === 24, `R1 the API serves the catalogue (${d.micrographs.length} rows from ${d.sourceFile})`);
    const ms = d.micrographs;
    must(ms.every((m) => Math.abs(m.early + m.late - m.total) < 1e-6), "R2 every row: early + late == total (the stacked split is honest)");
    const mean = ms.reduce((a, m) => a + m.total, 0) / ms.length;
    const worst = ms.reduce((a, m) => (m.total > a.total ? m : a));
    must(Math.abs(d.summary.meanTotal - mean) < 1e-9 && d.summary.worstName === worst.name, "R3 the summary's mean/worst recompute identically client-side");
    const worstFirst = [...ms].sort((a, b) => b.total - a.total)[0];
    must(worstFirst.name === "movie_011.mrcs" && worstFirst.total === 25.6, "R4 worst-first order puts movie_011 (25.6 Å) on top");
    // the optics block must never leak: 24 rows, not 25 (one optics row)
    must(!ms.some((m) => m.name.includes("optGroup")), "R5 the optics block's rows never leak into the data loop");
  }

  /* ============ Z: fixture cleanup + roster identity ============ */
  section("Z: cleanup + roster identity");
  if (weSeeded && seedFile && existsSync(seedFile)) {
    unlinkSync(seedFile);
    must(!existsSync(seedFile), "Z1 the seeded catalogue is removed (self-seed, self-clean)");
  } else {
    must(true, "Z1 no fixture to clean (a real catalogue lives there — untouched)");
  }
  const after = await (await fetch(BASE + "/api/jobs")).json();
  const afterList = (Array.isArray(after) ? after : after.jobs ?? []);
  must(afterList.length === roster0.length, `Z2 roster size unchanged (${afterList.length})`);
  const afterIds = new Set(afterList.map((j) => j.id));
  must(roster0.every((j) => afterIds.has(j.id)), "Z3 roster identity — no job created or deleted");
  must(!afterList.some((j) => (j.name || "").includes("mock") || (j.name || "").includes("fixture")), "Z4 no fixture-signature rows");
} finally {
  // belt-and-braces: the fixture must never outlive the probe
  if (weSeeded && seedFile && existsSync(seedFile)) {
    try { unlinkSync(seedFile); } catch { /* already gone */ }
  }
  await browser.close();
}

console.log(
  failures.length === 0
    ? `\nT178 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT178 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
