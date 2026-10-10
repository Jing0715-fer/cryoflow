/**
 * DIAG t367 (browser) — the ghost job's Results tab, the user's exact
 * journey: the re-ran 2D classification whose NEWEST round (a leftover
 * corrupt stack the run never wrote) used to show as an unexplained
 * 「could not render」 while every older round held healthy images.
 *
 * With the t367 fixes the same canvas now tells the whole story:
 *   · the default (newest = the leftover) round's sheet fetch lands the
 *     HONEST verdict — corrupt ON THE CLUSTER, the earlier-run leftover
 *     world, the re-dispatch remedy — in the gallery's error card
 *   · the run's OWN rounds (it003…) render through the mirror or the wire
 *   · zero console/page errors (the lean-chromium t359 recipe)
 *
 * Requires: diag-t367-ghost-walltime.mjs stage+walls+ghost complete (the
 * QA project + the ghost job live), the dev server warm (shell + chunks).
 */
import { chromium } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const BASE = process.env.CF_BASE ?? "http://localhost:3005";
const STATE_FILE = "/tmp/t367-state.json";
const SHOTS = "/home/z/cryoflow/shots-qa/";
/** one boot, one window (the t359/t363 doctrine): `verdict` = the ghost
 * round's honest refusal card; `rounds` = the run's own rounds render + the
 * receipt sentence. The 4GB box dies when both ride one hydration. */
const PHASE = process.argv[2] ?? "verdict";

let pass = 0, fail = 0;
const must = (cond, name) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
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

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
  : null;
if (!state?.ghostId) {
  console.error("no staged state — run diag-t367-ghost-walltime.mjs stage|walls|ghost first");
  process.exit(2);
}

// THE ADOPTED GHOST — the field report's exact world: the corrupt leftover
// ALREADY sits in the local mirror (a size-only sync-back adopted it before
// t367). The gate now refuses NEW adoptions, but a pre-existing ghost must
// still tell its truth when the user clicks its round: the chip lists it
// (the mirror holds it), the sheet render fails, the route falls through to
// the cluster, and the CLUSTER copy is equally corrupt — the honest verdict
// card shows (not the old silent 「could not render」).
const mirrorDir = path.join(
  "/home/z/cryoflow/data/relion", state.projectId, `class2d_${state.ghostId.slice(-8)}`
);
const ghostMirror = path.join(mirrorDir, "run_it004_classes.mrcs");
writeFileSync(ghostMirror, Buffer.alloc(2001024)); // right-sized, zero-header — the attachment's shape
console.log(`  (the adopted ghost plants in the mirror: ${ghostMirror} — 2,001,024 zero bytes)`);

// lean chromium — the t359 recipe (fonts aborted; images KEPT: the sheet
// proof needs the app's own PNG fetch to run)
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

const CARD = `[data-job="${state.ghostId}"]`;

try {
  console.log(`== t367 browser (${PHASE}): the ghost round tells the truth, the real rounds render ==`);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector(CARD, { timeout: 90_000 });
  // let the hydration's peak pass (the 4GB box: the sheet fetch that
  // follows rides on TOP of the freshly-hydrated client tree)
  await page.waitForTimeout(12_000);
  must(true, "the shell loads and the ghost card is on the canvas");

  await page.click(CARD);
  await page.waitForSelector("[data-class-iteration-gallery]", { timeout: 30_000 });
  must(true, "the Results gallery mounts for the finished classification");

  if (PHASE === "verdict") {
  // click the GHOST round's chip (the adopted corrupt mirror copy): the
  // sheet render fails locally, falls through to the cluster, and the
  // refusal card must carry the honest verdict
  const chip4 = await page
    .waitForSelector('[data-iter-chip="4"]', { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  must(chip4, "the ghost round's chip is listed (the mirror holds the adopted copy)");
  if (chip4) {
    await page.click('[data-iter-chip="4"]');
    const verdictOk = await page
      .waitForFunction(
        () => {
          const el = document.querySelector("[data-sheet-error]");
          return !!el && el.textContent.length > 40;
        },
        null,
        { timeout: 60_000 }
      )
      .then(() => true)
      .catch(() => false);
    const verdictText = verdictOk
      ? await page.evaluate(() => document.querySelector("[data-sheet-error]")?.textContent ?? "")
      : "";
    must(verdictOk, "the ghost round's sheet view shows the refusal card (not a silent blank)");
    must(
      /CORRUPT ON THE CLUSTER/i.test(verdictText),
      `the verdict names the corrupt-on-cluster truth (${verdictText.slice(0, 90)}…)`
    );
    must(/EARLIER run/i.test(verdictText), "the verdict names the earlier-run leftover world");
    await page.screenshot({ path: SHOTS + "t367-ghost-verdict.png" });
    must(true, "screenshot: shots-qa/t367-ghost-verdict.png");
  }
  } else if (PHASE === "rounds") {
  // 2 — the run's OWN newest round renders (click the it003 chip)
  await page.click('[data-iter-chip="3"]');
  const sheetOk = await page
    .waitForFunction(
      () => {
        const img = document.querySelector("[data-sheet-view] img");
        return !!img && img.complete && img.naturalWidth > 0;
      },
      null,
      { timeout: 60_000 }
    )
    .then(() => true)
    .catch(() => false);
  must(sheetOk, "the run's own newest round (it003) renders its class sheet");
  if (sheetOk) {
    await page.screenshot({ path: SHOTS + "t367-healthy-round.png" });
    must(true, "screenshot: shots-qa/t367-healthy-round.png");
  }

  // 3 — the receipt names the stale generation somewhere in the inspector
  const bodyText = await page.evaluate(() => document.body.textContent?.replace(/\s+/g, " ") ?? "");
  must(
    /left behind by an EARLIER run/i.test(bodyText) || /EARLIER run of this job/i.test(bodyText),
    "the sync receipt's stale-generation sentence is visible in the UI"
  );
  }

  // 4 — zero console/page errors (the lean-chromium bar)
  must(consoleErrors.length === 0, `zero console/page errors (${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);
} catch (err) {
  console.error("t367 browser diag crashed:", err);
  fail++;
} finally {
  await browser.close();
}
console.log(fail === 0 ? "t367 browser ALL GREEN" : `t367 browser ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
