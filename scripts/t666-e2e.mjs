// t666 — the third thumb kind rides the world's newest branch.
//
// Two faces, one window:
//   1. the palette's Denoise compare row gets the t663 family's third
//      kind — the thumb fetches the wall's OWN gate (denoise-pairs, first
//      FULLY PAIRED row — the gate the wipe card itself obeys) and shows
//      the wall's own base layer (the denoised leg), so the preview can
//      never disagree with what the jump will open.
//   2. the world grows its training branch (t666 seeder): a completed
//      Topaz Train job wired to the denoised stack lights the last two
//      shipped-dark Topaz surfaces — the t266 training curve (12 epochs,
//      the parser-diary inside run.log) and the t558 train→pick handoff
//      card (its feed = the inferred micrographs→micrographs edge).
//
// Probe contract:
//   A  the world answers: roster 17 with the training branch completed;
//      /topaz-training 12 epochs from run.log; /api/edges carries the
//      inferred micrographs→micrographs feed; /denoise-pairs first FULL
//      pair speaks the denoised leg.
//   B  the palette thumb: hover the Denoise compare row → the tile rises,
//      REALLY renders, and speaks the denoised recipe; re-activation
//      costs zero /denoise-pairs requests (the URL is the cache). The
//      honest-absence ladder is t663's contract (same code path) — one
//      denoise row in the world can't ride a route-block after the cache
//      holds it, so this window asserts the cache leg instead.
//   C  the inspector lights: the training chart renders 12 epochs, the
//      handoff card stands with an enabled gesture. 📸
//   D  the handoff gesture REALLY mints: click → a Topaz-mode autopick
//      exists with the model wired (model→topazModel) and the feed
//      inherited (denoise→micrographs); then DELETE — the world returns
//      to 17 and the wires go with it (a probe that cleans its own
//      footprints).
//   E  the console contract — five buckets. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const TRAIN_ID = "cmututold000topaztrain";
const DENOISE_ID = "cmututold000topazdenoise";
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};
const api = async (path, opts = {}, attempt = 0) => {
  try {
    const r = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: { Origin: BASE, ...(opts.headers ?? {}) },
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    // the OOM era's transient death (t664/t665 ladder): a bounded retry —
    // the server's own watchdog revives it, the probe waits it out
    if (attempt < 3) {
      await sleep(2500);
      return api(path, opts, attempt + 1);
    }
    throw e;
  }
};
const waitHealthy = async (tag) => {
  const ok = await pollUntil(async () => {
    const r = await fetch(`${BASE}/`).catch(() => null);
    return r?.status === 200 || null;
  }, 60000);
  if (!ok) console.log(`  · server never recovered (${tag})`);
  return ok;
};

// ---------- A: the world answers (node-side, no browser needed) ----------
console.log("A — the world's training branch");
const jobs = await api("/api/jobs");
const train = (jobs.body.jobs ?? []).find((j) => j.id === TRAIN_ID);
const rosterCount = (jobs.body.jobs ?? []).length;
must(!!train && train.status === "completed" && train.type === "topaztrain",
  "A the seeded training branch is completed in the roster", `${rosterCount} jobs`);
const curves = await api(`/api/jobs/${TRAIN_ID}/topaz-training`);
const epochs = curves.body.epochs ?? [];
must(epochs.length === 12, "A the curve API serves 12 epochs", `source=${curves.body.source}`);
must(curves.body.source === "run.log", "A the diary's source is run.log (the winning first source)");
must(epochs[0]?.trainLoss === 0.912 && epochs[11]?.trainLoss === 0.366,
  "A the diary's numbers ride through untouched", `${epochs[0]?.trainLoss} → ${epochs[11]?.trainLoss}`);
const edges = await api("/api/edges");
const feed = (edges.body.edges ?? []).find(
  (e) => e.fromJobId === DENOISE_ID && e.toJobId === TRAIN_ID);
must(!!feed && feed.fromPort === "micrographs" && feed.toPort === "micrographs",
  "A the feed edge's ports are inferred (micrographs→micrographs)", JSON.stringify(feed?.fromPort && feed?.toPort));
const pairs = await api(`/api/jobs/${DENOISE_ID}/denoise-pairs`);
const firstFull = (pairs.body.pairs ?? []).find((p) => p.denoised && p.original);
must(!!firstFull && firstFull.denoised.endsWith("_denoised.mrc"),
  "A denoise-pairs' first FULL pair speaks the denoised leg", firstFull?.denoised?.slice(-30));

// ---------- B: the palette's denoise thumb ----------
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
const hmrNoise = [];
const resourceFlap = [];
const resource404 = [];
const chunkFlap = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
// the thumb's own wire: the pairs route is the kind's only list fetch
const pairsRequests = [];
page.on("request", (r) => {
  if (/\/api\/jobs\/[^/]+\/denoise-pairs(\?|$)/.test(r.url())) pairsRequests.push(r.url());
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

await page.keyboard.press("Control+k");
await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
must((await page.locator("[cmdk-item]").count()) > 0, "B the palette opens");

const denoiseRow = page.locator("[cmdk-item]", { hasText: "Denoise compare — " }).first();
await pollUntil(async () => (await denoiseRow.count()) === 1 || null, 10000);
must((await denoiseRow.count()) === 1, "B the Denoise compare group has its row");
await denoiseRow.hover();
const thumbUp = await pollUntil(async () => {
  const t = await denoiseRow.locator('[data-palette-thumb]:not(.hidden)').count();
  return t === 1 || null;
}, 8000);
must(!!thumbUp, "B hovering the denoise row raises the thumb");
const imgReady = await pollUntil(async () => {
  const img = denoiseRow.locator("[data-palette-thumb] img");
  if ((await img.count()) !== 1) return null;
  const ok = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
  return ok || null;
}, 20000);
must(!!imgReady, "B the peek really renders (naturalWidth > 0)");
const src = await denoiseRow.locator("[data-palette-thumb] img").getAttribute("src").catch(() => "");
must(!!src && src.includes("/outputs/file") && src.includes("format=png") && src.includes("_denoised"),
  "B the peek speaks the denoised recipe (the wipe card's base layer)", src?.slice(0, 90));

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t666-denoise-thumb.png" });

// the cache: leave and come back — zero extra pairs requests
const navRow = page.locator("[cmdk-item]").first();
await navRow.hover();
await sleep(400);
const before = pairsRequests.length;
await denoiseRow.hover();
await pollUntil(async () => (await denoiseRow.locator('[data-palette-thumb]:not(.hidden)').count()) === 1 || null, 5000);
must(pairsRequests.length === before,
  "B re-activation costs zero /denoise-pairs requests", `${pairsRequests.length - before} extra`);
await page.keyboard.press("Escape");
await sleep(400);

// ---------- C: the inspector lights the two shipped-dark surfaces ----------
const dashTab = page.locator('[role="tab"][title^="Project dashboard"]').first();
await pollUntil(async () => (await dashTab.count()) > 0 || null, 10000);
await dashTab.click().catch(() => {});
await sleep(1500);
const openFromRoster = async (name, titlePrefix) => {
  const row = page.locator("[data-roster-row]", { hasText: name }).first();
  await pollUntil(async () => (await row.count()) > 0 || null, 12000);
  const btn = row.locator(`button[title^="${titlePrefix}"]`).first();
  if ((await btn.count()) === 0) return false;
  await btn.click();
  return true;
};
const opened = await openFromRoster("Topaz Train (seeded)", "Open Topaz Train");
must(!!opened, "C the roster speaks the training branch and its door opens");
await sleep(2200);
// the recovery ladder (t664): a mid-flight death strands the dialog
if ((await page.locator('[role="dialog"]').count()) === 0) {
  console.log("  · recovery ladder: dialog stranded — reload + reopen");
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await dashTab.click().catch(() => {});
  await sleep(1500);
  await openFromRoster("Topaz Train (seeded)", "Open Topaz Train");
  await sleep(2200);
}
must((await page.locator('[role="dialog"]').count()) > 0, "C the inspector dialog stands");

const chartSection = page.locator('[aria-label="Topaz training progress"]');
await pollUntil(async () => (await chartSection.count()) > 0 || null, 20000);
must((await chartSection.count()) > 0, "C the training chart section mounts (t266 surface lit)");
const epochText = await pollUntil(async () => {
  const t = await chartSection.textContent().catch(() => "");
  const m = /(\d+) epochs/.exec(t ?? "");
  return m ? m[1] : null;
}, 15000);
must(epochText === "12", "C the curve speaks its epoch count", `${epochText} epochs`);
// the recharts curves themselves: at least two polylines (train + test)
const curveCount = await pollUntil(async () => {
  const n = await chartSection.locator("path.recharts-curve.recharts-line-curve").count();
  return n >= 2 || null;
}, 15000);
must(!!curveCount, "C both loss curves render (train + test)");

const handoff = page.locator('[data-canvas-ui="topaz-pick-handoff"]');
await pollUntil(async () => (await handoff.count()) > 0 || null, 10000);
must((await handoff.count()) > 0, "C the train→pick handoff card mounts (t558 surface lit)");
const pickBtn = handoff.locator("button", { hasText: "Pick with this model" }).first();
await pollUntil(async () => (await pickBtn.count()) === 1 || null, 8000);
const btnEnabled = await pickBtn.isEnabled().catch(() => false);
must(btnEnabled, "C the handoff's gesture is enabled");

await page.screenshot({ path: ".qa-logs/t666-train-chart.png" });

// ---------- D: the gesture really mints (click-through + cleanup) ----------
console.log("D — the handoff's click-through");
await waitHealthy("before D");
// a mid-flight death closes the dialog — the human answer: reload +
// re-navigate + reopen + re-find the gesture (the t664 ladder, handoff cut)
if ((await page.locator('[role="dialog"]').count()) === 0) {
  console.log("  · recovery ladder: dialog stranded — reload + reopen");
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitHealthy("D recovery");
  await dashTab.click().catch(() => {});
  await sleep(1500);
  await openFromRoster("Topaz Train (seeded)", "Open Topaz Train");
  await sleep(2200);
}
const pickBtn2 = page.locator('[data-canvas-ui="topaz-pick-handoff"] button', { hasText: "Pick with this model" }).first();
const rosterBefore = (await api("/api/jobs")).body.jobs?.length ?? 0;
await pollUntil(async () => (await pickBtn2.count()) === 1 && (await pickBtn2.isEnabled()) || null, 10000);
// the click can be swallowed by a death at exactly that instant — the
// mint-poll decides, and a second click is the retry (never a third)
let minted = null;
for (let clickAttempt = 0; clickAttempt < 2 && !minted; clickAttempt++) {
  if (clickAttempt > 0) {
    console.log("  · first click landed nowhere — re-finding the gesture");
    await waitHealthy("D re-click");
    if ((await page.locator('[role="dialog"]').count()) === 0) {
      await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
      await sleep(2500);
      await dashTab.click().catch(() => {});
      await sleep(1500);
      await openFromRoster("Topaz Train (seeded)", "Open Topaz Train");
      await sleep(2200);
    }
    if ((await pickBtn2.count()) === 0) break;
  }
  await pickBtn2.click().catch(() => {});
  minted = await pollUntil(async () => {
    const j = await api("/api/jobs");
    const fresh = (j.body.jobs ?? []).find(
      (x) => x.type === "autopick" && x.status === "idle" && x.params?.pickingMethod === "Topaz");
    return fresh ?? null;
  }, 15000);
}
must(!!minted, "D the gesture mints an idle Topaz-mode autopick", minted?.id?.slice(-12));
if (minted) {
  // the wires ride the connect() POSTs, which run AFTER the mint POST —
  // the edges poll must wait for them (a bare read measures the in-flight
  // window, not the outcome). Bounded: if they never land, that IS a
  // product bug and the assertion says so.
  const mintEdges = await pollUntil(async () => {
    const mintEdges = await api("/api/edges");
    const all = mintEdges.body.edges ?? [];
    const modelWire = all.find((e) => e.fromJobId === TRAIN_ID && e.toJobId === minted.id);
    const feedWire = all.find((e) => e.fromJobId === DENOISE_ID && e.toJobId === minted.id);
    return modelWire && feedWire ? { modelWire, feedWire } : null;
  }, 12000);
  must(mintEdges?.modelWire?.fromPort === "model" && mintEdges?.modelWire?.toPort === "topazModel",
    "D the trained model is wired into the pick's Topaz mouth",
    mintEdges ? `${mintEdges.modelWire.fromPort}→${mintEdges.modelWire.toPort}` : "wire never landed");
  must(mintEdges?.feedWire?.toPort === "micrographs",
    "D the pick inherits the training's own feed (the denoised stack)",
    mintEdges?.feedWire?.fromPort);
  const rosterAfter = (await api("/api/jobs")).body.jobs?.length ?? 0;
  must(rosterAfter === rosterBefore + 1, "D the roster grew by exactly the minted pick", `${rosterBefore} → ${rosterAfter}`);
  // cleanup: the probe deletes its own footprint — the world returns
  const del = await api(`/api/jobs/${minted.id}`, { method: "DELETE" });
  must(del.status === 200 || del.status === 204, "D the minted pick is deleted", `status ${del.status}`);
  const rosterClean = (await api("/api/jobs")).body.jobs?.length ?? 0;
  must(rosterClean === rosterBefore, "D the world returns to its seeded shape", `${rosterClean}`);
  const edgesClean = await api("/api/edges");
  const gone = (edgesClean.body.edges ?? []).every((e) => e.toJobId !== minted.id);
  must(gone, "D the minted wires went with the pick (no orphan edges)");
} else {
  must(false, "D cleanup skipped — nothing minted (see above)");
}

// ---------- E: the console contract ----------
must(consoleErrors.length === 0, "E zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "E zero resource 404s", `${resource404.length}`);
must(resourceFlap.length <= 60, "E server-flap resource failures bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "E lazy-chunk fetch flaps bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 10, "E HMR socket noise bounded", `${hmrNoise.length}`);

await b.close();
console.log(`\nt666-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
