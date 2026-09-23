/**
 * diag-t370 — the field report quartet + the UI trio, one smoke:
 *
 *   1. the 3D-class MPI segfault door — optics groups pre-sorted before
 *      dispatch (normalizeOpticsOrder, CF_OPTICS receipts)
 *   2. the extraction "write: target and source objects have different
 *      size" crash — cluster-lane collision scan + .cryoflow_prev
 *      re-dispatch hygiene
 *   3. the zero-header rounds — live MRC header sniff in the sweep
 *      (od words + zeroHeaderRounds + the auto storageDiagAt trigger)
 *   4. the automated storage diagnostic (module + route + wiring)
 *   5. the delete-flicker cure — the client tombstone filters every
 *      server-list ingest; a stale in-flight poll can no longer
 *      resurrect a deleted card
 *   6. the gallery corruption badges (zeroData / nz===0) + the idle
 *      cadence trim (8s) + the manual Storage check button
 *
 * A. source X-ray (the merged tree carries every fix)
 * B. the app boots clean, then THE FLICKER TEST: create a sibling pair,
 *    force the fast 1.2s poll cadence (a pending job makes the board
 *    active), delete one card through the REAL UI path (select → Delete
 *    key → confirm dialog → deleteJob), then watch 14 seconds of dense
 *    polls — the deleted card must never reappear while its same-type
 *    sibling stays.
 *
 * Run (single tool call, per the box's memory doctrine — the server must
 * be warm from curls BEFORE the browser lands, one browser load per
 * session):
 *   bun scripts/diag-t370-smoke.mjs
 */
import { chromium } from "playwright";
import { readFileSync, existsSync } from "fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa/";
let pass = 0,
  fail = 0;
const must = (cond, name) => {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name);
  }
};

/* ---------- A — source X-ray ---------- */
console.log("A — source X-ray (the t370 fixes are in the tree)");
const remoteRun = readFileSync("src/lib/remote/remote-run.ts", "utf8");
const store = readFileSync("src/lib/store.ts", "utf8");
const gallery = readFileSync(
  "src/components/workflow/results/class-iteration-gallery.tsx",
  "utf8"
);
const appPage = readFileSync("src/app/page.tsx", "utf8");
const clusterDialog = readFileSync(
  "src/components/workflow/remote-cluster-dialog.tsx",
  "utf8"
);

must(
  /async function normalizeOpticsOrder/.test(remoteRun) &&
    /CF_OPTICS: SORTED/.test(remoteRun) &&
    /normalizeOpticsOrder\(conn, opticsStar\)/.test(remoteRun),
  "A1 remote-run: the optics pre-sort (awk + verified rewrite + wired at the classification star sites)"
);
must(
  /\.cryoflow_prev\//.test(remoteRun) &&
    /target and source objects have different size/i.test(remoteRun),
  "A2 remote-run: extract re-dispatch hygiene (.cryoflow_prev move-aside) + the crash's honest decode"
);
must(
  /od -An -tu4 -j0 -N12/.test(remoteRun) &&
    /zeroHeaderRounds/.test(remoteRun) &&
    /storageDiagAt/.test(remoteRun),
  "A3 remote-run: live MRC header sniff in the rounds block + zeroHeaderRounds + the once-per-run diagnostic trigger"
);
must(
  existsSync("src/lib/remote/storage-diag.ts") &&
    existsSync("src/app/api/remote/diagnostics/storage/route.ts") &&
    /runStorageDiagnostic/.test(remoteRun),
  "A4 the storage diagnostic module + route + sweep wiring"
);
must(
  /recentlyDeletedJobs/.test(store) && /tombstoneJobIds/.test(store),
  "A5 store: the client delete-tombstone (all server-list ingest filtered)"
);
must(
  /zeroData/.test(gallery) && /nz === 0/.test(gallery),
  "A6 gallery: the zeroData + zero-header badges"
);
must(
  /anyActive \? 1200 : 8000/.test(appPage),
  "A7 page: the idle poll cadence relaxed to 8s (churn trim)"
);
must(
  /Storage check/.test(clusterDialog) &&
    /diagnostics\/storage/.test(clusterDialog),
  "A8 the remote-cluster dialog's manual Storage check button"
);

/* ---------- B — one browser load, shaved chromium (4GB doctrine) ---------- */
console.log("B — the app boots + THE FLICKER TEST (single-process chromium)");
const abortedUrls = new Set();
const routeLean = (route) => {
  abortedUrls.add(route.request().url());
  route.abort();
};
const consoleErrors = [];
const onConsoleError = (m) => {
  if (m.type() !== "error") return;
  const loc = m.location()?.url ?? "";
  if (abortedUrls.has(loc)) return; // our own lean-load aborts
  if (
    /net::ERR_FAILED/.test(m.text()) &&
    [...abortedUrls].some((u) => m.text().includes(u))
  )
    return;
  consoleErrors.push(m.text().slice(0, 160));
};

const browser = await chromium.launch({
  args: [
    "--single-process",
    "--js-flags=--max-old-space-size=256",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--renderer-process-limit=1",
  ],
});
let a = null,
  b = null,
  c = null;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route(/\.(woff2?|png|svg|jpe?g)$/i, routeLean);
  page.on("pageerror", (e) =>
    consoleErrors.push("pageerror: " + e.message.slice(0, 160))
  );
  page.on("console", onConsoleError);

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-job]", { timeout: 60000 });
  await page.waitForTimeout(2500);

  const domJobs = await page.evaluate(
    () => document.querySelectorAll("[data-job]").length
  );
  must(domJobs > 0, `B1 canvas renders job cards (${domJobs} on the DOM)`);

  /* ---- the user's scenario, race-forced ---- */
  // create the sibling pair (same type — the user's "同时新建了一个同类型job").
  // EXPLICIT spread coordinates: the POST defaults (x≈140+rand, y≈200+rand)
  // stacked this run's own A and B on top of each other and the card click
  // died on "subtree intercepts pointer events" — the test's cards own a
  // clear band of the canvas instead.
  const mk = (type, x, y) =>
    page.evaluate(
      (args) =>
        fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: args.t, x: args.x, y: args.y }),
        }).then((r) => r.json()),
      { t: type, x, y }
    );
  a = await mk("class2d", 420, 320);
  b = await mk("class2d", 680, 320);
  c = await mk("class3d", 940, 320);
  must(
    a?.job?.id && b?.job?.id && c?.job?.id,
    `B2 setup: the sibling pair + the cadence-forcer minted (A=${a?.job?.id?.slice(-6)} B=${b?.job?.id?.slice(-6)} C=${c?.job?.id?.slice(-6)})`
  );

  // force the FAST poll cadence: a pending job makes the board active
  // (1.2s ticks — a stale in-flight poll at delete time becomes
  // near-certain, the exact resurrection window the user hit)
  const patchRes = await page.evaluate(
    (id) =>
      fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      }).then((r) => r.status)
    , c.job.id
  );
  console.log(
    `    (cadence-forcer PATCH -> ${patchRes}${patchRes !== 200 ? " — the idle cadence still spans the window" : ""})`
  );

  await page.waitForSelector(`[data-job="${a.job.id}"]`, { timeout: 30000 });
  await page.waitForSelector(`[data-job="${b.job.id}"]`, { timeout: 30000 });
  await page.waitForTimeout(2600); // a couple of fast ticks settle the board

  // the REAL UI delete path: select card A → Delete key → confirm → deleteJob
  await page.click(`[data-job="${a.job.id}"]`, { timeout: 15000 });
  await page.keyboard.press("Delete");
  let confirmed = false;
  try {
    const dlg = page.locator('[role="alertdialog"]').first();
    await dlg.waitFor({ state: "visible", timeout: 5000 });
    await dlg.getByRole("button", { name: "Delete", exact: false }).last().click();
    confirmed = true;
  } catch {
    // some selections delete without a confirm — B2a below is the judge
  }
  await page.waitForTimeout(800);

  const gone0 = await page.evaluate(
    (id) => document.querySelector(`[data-job="${id}"]`) == null,
    a.job.id
  );
  must(
    gone0,
    `B2a the deleted card vanishes immediately (optimistic removal${confirmed ? " via the confirm dialog" : ""})`
  );

  // 14 seconds of dense polls — the resurrection window (tombstone TTL 15s)
  let resurrections = 0,
    bFrames = 0,
    cFrames = 0;
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(1000);
    const sight = await page.evaluate(
      (ids) => ({
        a: document.querySelector(`[data-job="${ids.a}"]`) != null,
        b: document.querySelector(`[data-job="${ids.b}"]`) != null,
        c: document.querySelector(`[data-job="${ids.c}"]`) != null,
      }),
      { a: a.job.id, b: b.job.id, c: c.job.id }
    );
    if (sight.a) resurrections++;
    if (sight.b) bFrames++;
    if (sight.c) cFrames++;
  }
  must(
    resurrections === 0,
    `B2b NO resurrection across 14s of polls (${resurrections} sightings — the old bug showed the card flash back for 1-2 ticks)`
  );
  must(
    bFrames === 14 && cFrames === 14,
    `B2c the same-type sibling and the pending forcer stay on the canvas (B ${bFrames}/14, C ${cFrames}/14)`
  );

  // server parity — the truth the polls were carrying
  const jobsNow = await page.evaluate(() =>
    fetch("/api/jobs").then((r) => r.json())
  );
  const ids = new Set((jobsNow?.jobs ?? []).map((j) => j.id));
  must(
    !ids.has(a.job.id) && ids.has(b.job.id) && ids.has(c.job.id),
    "B2d the server agrees (A gone, B + C alive) — the tombstone filtered STALE polls, not the truth"
  );

  await page.screenshot({ path: SHOTS + "t370-flicker-cure.png", fullPage: false });
  console.log(`    (screenshot: ${SHOTS}t370-flicker-cure.png)`);

  must(
    consoleErrors.length === 0,
    "B3 zero console/page errors" +
      (consoleErrors.length ? " — " + consoleErrors.slice(0, 3).join(" ; ") : "")
  );
} finally {
  await browser.close().catch(() => {});
  // the failure-path microscope: console/page errors collected during the
  // run (a crashed render tree or a throwing pollTick lands here — the
  // waitForSelector timeout alone says only "the DOM never changed")
  console.log(
    `    (diagnostics: ${consoleErrors.length} console/page error(s)` +
      (consoleErrors.length
        ? " — " + consoleErrors.slice(0, 4).join(" ; ")
        : "") +
      ")"
  );
  // cleanup ALWAYS runs — a failed assertion mid-test must not litter the
  // project (the first run's throw skipped a trailing cleanup and left its
  // three cards behind; those cmuejn* strays ride this sweep too)
  const strayIds = [a?.job?.id, b?.job?.id, c?.job?.id].filter(Boolean);
  try {
    const res = await fetch(BASE + "/api/jobs");
    const data = await res.json().catch(() => ({ jobs: [] }));
    for (const j of data?.jobs ?? []) {
      if (/^cmuejn/.test(j.id) && !strayIds.includes(j.id)) strayIds.push(j.id);
    }
  } catch {
    /* the best-effort sweep never blocks the verdict */
  }
  for (const id of strayIds) {
    await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }).catch(() => null);
  }
  console.log(`    (cleanup: ${strayIds.length} test job(s) removed)`);
}

console.log(
  `\n${fail === 0 ? "ALL GREEN" : "FAILURES"} — ${pass} passed, ${fail} failed (t370)`
);
process.exit(fail === 0 ? 0 : 1);
