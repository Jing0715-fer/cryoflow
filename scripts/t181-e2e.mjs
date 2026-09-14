/* t181 — the dashboard feed speaks the wire's scale (the 4200% lesson).
 *
 * GET /api/activity/recent returns progress on the app-wide 0–100 scale
 * (the DB column — the same number the canvas chip shows), but the Recent
 * activity feed was built fraction-native (bar ×100, label ×100, aria
 * ×100, sparkline pct ×100, trend ×100): the wire value flowed through
 * untouched and every running row rendered "4200%" with a bar pinned at
 * full width. The original probe MISSED it because it fed a mocked 42%
 * FRACTION into the component's data path — a mocked contract is not the
 * wire's contract. This probe pins the fix at the real boundary:
 *
 *   wire (0–100)  --toFractionFrame-->  state (0–1)  --×100-->  paint
 *
 * X oracles: the route's SCALE CONTRACT comment, ONE translation point
 * (toFractionFrame) that BOTH fetch frames flow through, the fraction
 * machinery intact at the paint sites (the ×100 lives there — deleting it
 * in a panic would break the sparkline thresholds), and the interface
 * documenting the internal scale. B live: the REAL wire read from the
 * API and the REAL paint read from the DOM must agree (label == aria ==
 * bar == round(wire)), no four-digit percent anywhere in the feed, the
 * sparkline tap chip speaks ≤100 percents, and the 4s POLL frame (the
 * second toFractionFrame consumer) stays sane. Z: roster identity,
 * read-only proof.
 */
import { readFileSync } from "fs";
import path from "path";
import { chromium } from "playwright";

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
  pageRef.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push({ label, url: res.url(), status: res.status() });
  });
}

/* ================= S — baseline ================= */
section("S: baseline world");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);

const recent0 = (await (await fetch(BASE + "/api/activity/recent?limit=8")).json()).jobs ?? [];
const liveRow = recent0.find((j) => j.status === "running");
must(!!liveRow, "S2 a running row exists in the feed wire");
const wire = liveRow?.progress ?? -1;
must(
  typeof wire === "number" && wire >= 0 && wire <= 100,
  `S3 wire progress is 0–100 scale (${wire})`
);
const wireRound = Math.round(wire);

/* ================= X — source oracles ================= */
section("X: the boundary owns the translation");
const routeSrc = src("src/app/api/activity/recent/route.ts");
const dashSrc = src("src/components/workflow/project-dashboard.tsx");

must(/SCALE CONTRACT:/.test(routeSrc), "X1 route declares the SCALE CONTRACT");
must(
  /const toFractionFrame = \(jobs: RecentJob\[\]\): RecentJob\[\] =>/.test(dashSrc),
  "X2 toFractionFrame exists (one translation point)"
);
must(
  (dashSrc.match(/toFractionFrame\(Array\.isArray\(/g) ?? []).length === 2,
  "X3 BOTH fetch frames flow through toFractionFrame (mount + poll)"
);
must(
  /INTERNAL: fraction 0–1 \(see toFractionFrame\)\. The wire is 0–100\./.test(dashSrc),
  "X4 the interface documents the internal scale"
);
// the fraction machinery must SURVIVE at the paint sites — the ×100 belongs
// there; the bug was the boundary, not the paint
must(
  /Math\.min\(100, Math\.max\(2, j\.progress \* 100\)\)/.test(dashSrc),
  "X5 bar width keeps its fraction ×100 clamp"
);
must(
  (dashSrc.match(/Math\.round\(j\.progress \* 100\)/g) ?? []).length === 2,
  "X6 aria + label keep fraction ×100 (exactly two sites)"
);
must(
  /j\.progress < last - 0\.05/.test(dashSrc),
  "X7 sparkline restart threshold stays fraction-native"
);
// the OTHER consumers of the jobs API (0–100) must stay UNSCALED
must(
  /\{Math\.round\(job\.progress\)\}%/.test(dashSrc),
  "X8 JobRow (jobs-API 0–100) keeps its direct label"
);

/* ================= B — live wire vs live paint ================= */
section("B: the wire and the paint agree");
const page = await browser.newPage();
trackConsole(page, "dashboard");
try {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const dashTab = page.getByRole("tab", { name: "Dashboard" });
  await dashTab.click();
  await sleep(1800); // feed fetch + paint

  const feedSection = page.locator('section[aria-label="Recent activity across all projects"]');
  must((await feedSection.count()) === 1, "B1 feed section renders");

  // the 4200% canary — the assertion that FAILED before the fix, against
  // the REAL wire (no mock anywhere in this probe)
  const sectionText = await feedSection.textContent();
  must(!/\d{4,}%/.test(sectionText ?? ""), "B2 no four-digit percent in the feed");

  const liveAria = feedSection.locator('span[aria-label^="Progress "]').first();
  const ariaText = (await liveAria.getAttribute("aria-label")) ?? "";
  must(
    ariaText === `Progress ${wireRound}%`,
    `B3 aria-label carries round(wire) — "${ariaText}" vs Progress ${wireRound}%`
  );

  const bar = liveAria.locator("span[style*='width']").first();
  const barWidth = (await bar.evaluate((el) => el.style.width)) ?? "";
  must(
    barWidth === `${wireRound}%`,
    `B4 bar width is round(wire) — "${barWidth}" vs ${wireRound}%`
  );

  const labelText = ((await liveAria.textContent()) ?? "").trim();
  must(
    labelText.startsWith(`${wireRound}%`),
    `B5 label carries round(wire) — "${labelText.slice(0, 12)}"`
  );

  // the sparkline tap chip: ≤100 percents only (hover-free touch affordance)
  const spark = feedSection.locator('span[role="img"][aria-label^="Progress history"]').first();
  await spark.dispatchEvent("pointerdown");
  await sleep(350);
  const chip = page.locator('span[role="status"]').last();
  const chipText = (await chip.textContent().catch(() => "")) ?? "";
  const chipPcts = (chipText.match(/\d+%(\()?/g) ?? []).map((s) => parseInt(s, 10));
  must(
    chipText === "" || chipPcts.every((p) => p <= 100),
    `B6 tap chip percents ≤100 ("${chipText.slice(0, 48)}")`
  );
  await page.keyboard.press("Escape");

  // the POLL frame: the second toFractionFrame consumer (4s interval) —
  // let a tick land, then re-run the canary
  await sleep(4600);
  const recent1 = (await (await fetch(BASE + "/api/activity/recent?limit=8")).json()).jobs ?? [];
  const live1 = recent1.find((j) => j.status === "running");
  const wire1 = Math.round(live1?.progress ?? -1);
  const text1 = await feedSection.textContent();
  must(
    !/\d{4,}%/.test(text1 ?? ""),
    "B7 after a poll tick the feed is still four-digit-free"
  );
  const aria1 = ((await liveAria.getAttribute("aria-label")) ?? "");
  const paintRound = parseInt(aria1.replace(/\D+/g, ""), 10);
  must(
    Number.isFinite(paintRound) && Math.abs(paintRound - wire1) <= 1,
    `B8 poll-frame paint follows the advancing wire (paint ${paintRound} vs wire ${wire1} ±1)`
  );

  must(consoleErrors.filter((e) => e.label === "dashboard").length === 0, "B9 dashboard console clean");
} finally {
  await browser.close();
}

/* ================= Z — roster identity + read-only proof ================= */
section("Z: roster identity");
const afterList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(afterList.length === jobs0.length, `Z1 roster size unchanged (${afterList.length})`);
const afterIds = new Set(afterList.map((j) => j.id));
must(jobs0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
const badTraffic = failedUrls.filter((u) => (u.status ?? 0) >= 500 || u.status === 404);
must(badTraffic.length === 0, `Z3 no 5xx/404 browser traffic (${badTraffic.length})`);

console.log(
  failures.length === 0
    ? `\nT181 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT181 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
