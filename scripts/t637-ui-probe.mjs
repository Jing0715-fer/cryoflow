// t637 — the post-fix UI probe: the edge-instrumentation compile poison
// is gone from the server, so the page must land FAST and console-CLEAN
// on a freshly-booted dev server (no route had been visited by a real
// browser yet — this probe pays the on-demand compiles and watches for
// the old disease's signature: 40+ node-module-in-edge-runtime errors
// re-emitted per request, seconds-long "compile:" overhead on every hit).
//
// Verdicts:
//   A  landing speed — / renders in <5s on the cold dev server (the old
//      poison made even warm routes pay ~600ms each; the homepage's own
//      graph compile dominates a cold first paint, so the bar is generous)
//   B  world identity — roster rows present, workspace chip intact
//   C  console hygiene — zero product console errors / pageerrors
//   D  API stickiness from a real page session — a second /api/jobs
//      fetch must stay cheap (<100ms); the old disease recompiled it
//      every hit (~600ms)
//   E  server log — zero node-module-in-edge-runtime lines in the window
//      between probe start and verdict D
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
let PASS = 0;
let FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) {
    PASS++;
    console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    FAIL++;
    console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
};

const logPath = "/tmp/cryoflow-qa/dev-server.log";
// t673 — the log source follows the SERVING LANE, not a habit. This probe
// was born in the dev regime and read the dev log; since t524/t529 QA rides
// the standalone (prod-3001.log at the repo root), and this window's fresh
// box had no stale dev log to read — errCount() returned -1 for BOTH
// baselines and the leg convicted an absent file, twice, deterministically.
// Count the poison across whichever lane logs exist (both is fine: the
// disease can surface in either), and only report -1 when NO log exists.
const logPaths = [logPath, "/home/z/my-project/prod-3001.log"];
const errCount = () => {
  let n = 0, seen = false;
  for (const p of logPaths) {
    try { n += readFileSync(p, "utf8").split("node-module-in-edge-runtime").length - 1; seen = true; }
    catch { /* a lane that never ran has no log — not a crime */ }
  }
  return seen ? n : -1;
};

const errorsBefore = errCount();

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

// A — landing speed on the cold server
const t0 = Date.now();
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
const landingMs = Date.now() - t0;
must(landingMs < 5_000, "A landing under 5s on the cold dev server", `${landingMs}ms`);

// B — world identity: converge on the dashboard view (t90 toggle pattern;
// the app lands on the canvas — the roster table lives behind Shift+D —
// and t523 law applies twice over: poll for view AND rows, never blind-read)
let rows = 0;
for (let i = 0; i < 12; i++) {
  const view = await page.evaluate(() =>
    document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  rows = await page.locator('[data-roster-row]').count();
  if (view === "dashboard" && rows >= 12) break;
  if (view !== "dashboard") await page.keyboard.press("Shift+D");
  await page.waitForTimeout(1_800);
}
must(rows >= 12, "B roster rendered (dashboard converged via Shift+D)", `${rows} rows`);
const orphanRows = await page.locator('[data-row-ws="orphan"]').count();
must(orphanRows === 0, "B zero orphan rows", `${orphanRows}`);

// C — console hygiene
must(consoleErrors.length === 0, "C zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

// D — API stickiness from the live session (server now warm from the visit)
const sticky = await page.evaluate(async ({ url, headers }) => {
  const t = performance.now();
  const r = await fetch(url, { headers, cache: "no-store" });
  await r.json();
  return Math.round(performance.now() - t);
}, { url: `${BASE}/api/jobs`, headers: SH });
must(sticky < 100, "D second /api/jobs fetch stays cheap in-session", `${sticky}ms`);

// E — server log stayed free of the edge poison during the whole visit
const errorsAfter = errCount();
must(errorsAfter >= 0 && errorsAfter === errorsBefore, "E zero edge-runtime errors during visit",
  `before=${errorsBefore} after=${errorsAfter}`);

await page.screenshot({ path: ".qa-logs/t637-home-postfix.png" });
console.log(`t637-ui-probe: ${PASS} pass / ${FAIL} fail`);
writeFileSync("/tmp/cryoflow-qa/t637-probe-verdict.json", JSON.stringify({ PASS, FAIL, landingMs, rows, sticky, errorsAfter }, null, 2));
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
