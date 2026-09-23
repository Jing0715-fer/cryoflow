/**
 * DIAG t363 (browser) — the live-results ticket's UI half, on the 4GB box's
 * own terms (the t359 lean-chromium recipe: --single-process + 256MB V8 —
 * a stock chromium next to the warm dev server is a coin flip with the OOM
 * killer, as the agent-browser passes of this very ticket proved three
 * times over).
 *
 * Phases:
 *   live    — dispatch the staged class2d (see diag-t363-live-gallery.mjs
 *             stage), then in the browser: click the RUNNING card and prove
 *             the t363 asks end-to-end — the inspector lands on RESULTS
 *             (not Log), the LIVE iteration gallery mounts with the empty-
 *             mirror note, rounds stream in as chips while the run is up,
 *             and the newest round's SHEET image renders MID-RUN (a real
 *             cluster pull, not a cache answer — the phase clears the
 *             preview cache first).
 *   landing — after `finish` + `bulk 26`: a cold load must render EVERY
 *             card (t364's chunked reveal catches up), with zero console/
 *             page errors — the smooth-landing regression.
 *
 * The dev server must be up and warm (see the t359 cf-up recipe: SSR shell
 * + every /_next/ client chunk curled with the browser closed).
 */
import { chromium } from "playwright";
import { existsSync, readFileSync, rmSync } from "fs";

const BASE = process.env.CF_BASE ?? "http://localhost:3005";
const STATE_FILE = "/tmp/t363-state.json";
const SHOTS = "/home/z/cryoflow/shots-qa/";
const PHASE = process.argv[2] ?? "live";

const st = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : null;
if (!st?.class2dId) {
  console.error("no staged state — run diag-t363-live-gallery.mjs stage first");
  process.exit(2);
}

let pass = 0, fail = 0;
const must = (cond, name) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
};
const api = async (path, init) => {
  const res = await fetch(BASE + path, init);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const consoleErrors = [];
const abortedUrls = new Set();
const routeLean = (route) => {
  abortedUrls.add(route.request().url());
  route.abort();
};
const onConsole = (m) => {
  if (m.type() !== "error") return;
  const loc = m.location()?.url;
  if (loc && abortedUrls.has(loc)) return;
  consoleErrors.push(m.text().slice(0, 140));
};

// lean chromium — the t359 recipe (fonts aborted; images KEPT: the live
// sheet proof needs the app's own PNG fetch to run)
const browser = await chromium.launch({
  args: [
    "--single-process",
    "--js-flags=--max-old-space-size=256",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--renderer-process-limit=1",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.route(/\.(woff2?)$/i, routeLean);
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 140)));
page.on("console", onConsole);

const CARD = `[data-job="${st.class2dId}"]`;

try {
  if (PHASE === "live") {
    console.log("== t363 browser LIVE: the running 2D card opens on its rounds ==");
    // a REAL pull for the sheet proof — the preview cache must be empty
    const previewDir = `/home/z/cryofflow/data/remote-preview/live/${st.class2dId}`.replace("cryofflow", "cryoflow");
    if (existsSync(previewDir)) rmSync(previewDir, { recursive: true, force: true });
    console.log("  (preview cache cleared — the sheet must come over the wire)");

    // fresh canvas first (idle card), then dispatch — the real user's order
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector(CARD, { timeout: 60_000 });
    const dispatch = await api(`/api/jobs/${st.class2dId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ remote: { connectionId: st.conn, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
    });
    must(dispatch.status >= 200 && dispatch.status < 300 && !dispatch.data?.error,
      `the class2d dispatch is accepted (${dispatch.status}${dispatch.data?.error ? " " + String(dispatch.data.error).slice(0, 90) : ""})`);

    // the card flips to running on the next poll (≤6s idle cadence)
    await page.waitForSelector(`${CARD}:has-text("running")`, { timeout: 25_000 });
    await page.click(CARD);
    await page.waitForSelector('[role="tablist"] [role="tab"][aria-selected="true"]', { timeout: 15_000 });

    // A1 — the inspector's smart default: RESULTS for a running classification
    const activeTab = await page.evaluate(() => {
      const tls = Array.from(document.querySelectorAll('[role=tablist]'));
      const insp = tls.find((t) => {
        const tabs = Array.from(t.querySelectorAll('[role=tab]')).map((b) => b.textContent);
        return tabs.includes("Files") && tabs.includes("Log");
      });
      return insp?.querySelector('[role=tab][aria-selected=true]')?.textContent ?? null;
    });
    must(activeTab === "Results", `the RUNNING classification lands on Results (got: ${activeTab})`);

    // A2 — the gallery mounts while the mirror is still empty. NOTE: with
    // zero rounds on the cluster yet (staging/sbatch warm-up) the gallery
    // renders its WAITING note without the section wrapper — wait for the
    // section, which appears with the first rounds (≤2 polls of 12s)
    await page.waitForSelector("[data-class-iteration-gallery]", { timeout: 32_000 });
    must(true, "the live gallery mounts during the run (the old gate showed No on-disk outputs)");

    // A3 — the panel speaks both truths: the live badge + the empty-mirror note
    const note = await page.evaluate(() => {
      const tls = Array.from(document.querySelectorAll("[role=tablist]"));
      const insp = tls.find((t) => {
        const tabs = Array.from(t.querySelectorAll("[role=tab]")).map((b) => b.textContent);
        return tabs.includes("Files") && tabs.includes("Log");
      });
      const panel = insp?.parentElement?.parentElement?.querySelector('[role=tabpanel][data-state=active]');
      return (panel?.textContent ?? "").replace(/\s+/g, " ");
    });
    must(/No on-disk outputs yet/.test(note), "the empty-mirror note explains the absent file listing");
    must(/\blive\b/.test(note), "the live badge shows");

    // A4 — rounds STREAM while the run is up (chips appear over time)
    await page.waitForFunction(
      () => document.querySelectorAll("[data-iter-chip]").length >= 2,
      null,
      { timeout: 35_000 }
    );
    // the showcase shot lands EARLY (the 4GB box has ended two live windows
    // mid-assertion — the picture must not depend on surviving to the end)
    await page.screenshot({ path: SHOTS + "t363-live-rounds.png" });
    must(true, "screenshot (early): shots-qa/t363-live-rounds.png");
    const earlyRounds = await page.evaluate(() => document.querySelectorAll("[data-iter-chip]").length);
    await page.waitForFunction(
      (prev) => document.querySelectorAll("[data-iter-chip]").length > prev,
      earlyRounds,
      { timeout: 18_000 }
    );
    const grownRounds = await page.evaluate(() => document.querySelectorAll("[data-iter-chip]").length);
    must(grownRounds > earlyRounds, `rounds stream live (${earlyRounds} → ${grownRounds} chips)`);

    // A5 — the newest round's SHEET renders MID-RUN (a real wire pull)
    const sheetOk = await page.waitForFunction(() => {
      const img = document.querySelector("[data-sheet-view] img");
      return !!img && img.complete && img.naturalWidth > 0;
    }, null, { timeout: 30_000 }).then(() => true).catch(() => false);
    must(sheetOk, `the newest round's sheet image renders MID-RUN (${grownRounds}+ rounds in)`);

    if (sheetOk) {
      await page.screenshot({ path: SHOTS + "t363-live-sheet.png" });
      must(true, "screenshot: shots-qa/t363-live-sheet.png");
    }
  } else if (PHASE === "landing") {
    console.log("== t364 browser LANDING: a >20-card canvas cold-loads whole ==");
    const serverJobs = (await api("/api/jobs")).data?.jobs?.filter((j) => j.projectId === st.projectId) ?? [];
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector("[data-job]", { timeout: 60_000 });
    // the chunked reveal catches up: poll until the DOM count is stable
    let stable = 0, last = -1, domCount = 0;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && stable < 3) {
      domCount = await page.evaluate(() => document.querySelectorAll("[data-job]").length);
      if (domCount === last && domCount > 0) stable++;
      else stable = 0;
      last = domCount;
      await page.waitForTimeout(400);
    }
    must(domCount === serverJobs.length,
      `every card renders on the cold load (DOM ${domCount} === server ${serverJobs.length})`);
    must(serverJobs.length > 20, `the landing is in reveal territory (${serverJobs.length} cards > 20)`);
    await page.screenshot({ path: SHOTS + "t364-landing.png" });
    must(true, "screenshot: shots-qa/t364-landing.png");
  } else {
    console.error("usage: node scripts/diag-t363-live-browser.mjs live|landing");
    process.exit(2);
  }
  must(consoleErrors.length === 0,
    "zero console/page errors" + (consoleErrors.length ? " — " + consoleErrors.slice(0, 3).join(" ; ") : ""));
} catch (err) {
  console.error("t363 browser diag crashed:", err?.message ?? err);
  fail++;
} finally {
  await browser.close().catch(() => {});
}

console.log(`diag-t363[${PHASE}]: ${pass} passed, ${fail} failed ${fail === 0 ? "— ALL GREEN" : "— RED"}`);
process.exit(fail === 0 ? 0 : 1);
