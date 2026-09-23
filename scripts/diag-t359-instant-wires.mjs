/**
 * diag-t359 — INSTANT WIRES: optimistic connect + delete on the canvas.
 *
 * The user's field receipt (after t356's render-scope fix):
 *   「卡片连线时还是会卡一会，然后触发一次 hmr 热加载后，线才能连上，
 *     删除线的时候也是」 — the wire only appeared after an HMR remount,
 *   because connect()/removeEdge() awaited the FULL API round trip before
 *   touching the store, and on a dev server that round trip sits behind a
 *   cold route compile / watcher rebuild for seconds.
 *
 * t359 fix under test (store.ts + POST /api/edges):
 *   A. drag-connect → the wire is in the DOM within ONE commit (< 250 ms),
 *      Connected toast fires immediately
 *   B. persistence lands in the background; the SERVER row keeps the
 *      CLIENT-minted id (DOM data-edge-id === API id — deletes hit the row)
 *   B2. re-dragging the same pair → "Already connected", no second wire
 *   C. hover → delete chip → the wire leaves the DOM within < 250 ms
 *   D. the DELETE lands in the background; the row is gone server-side
 *   E. THE RACE: POST held 2.5 s at the route layer → wire draws
 *      instantly, delete it BEFORE the POST lands → no ghost edge once the
 *      doomed-cleanup DELETE fires (the old code resurrected it)
 *   F. server 500 → the optimistic wire rolls back + honest toast
 *   G. reload consistency + zero console/page errors
 *
 * Run (single tool call, per the box's memory doctrine):
 *   bash scripts/dev-server-3001.sh && bun scripts/diag-t359-instant-wires.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const SHOTS = "/home/z/cryoflow/shots-qa/";
const TARGET_NAME = "t359 wire target";
/** "main" (default) — seed + the wire drills A–F. "g" — the fresh-load
 * consistency check, run in a SEPARATE server session (this 4GB box OOMs
 * when a second browser load lands on a server that already served one):
 *   bun scripts/diag-t359-instant-wires.mjs          # main
 *   bash /tmp/cf-up-t359.sh                          # restart + warm
 *   PHASE=g bun scripts/diag-t359-instant-wires.mjs  # fresh-load truth */
const PHASE = process.env.PHASE === "g" ? "g" : "main";
let pass = 0, fail = 0;
const must = (cond, name) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
};
const api = async (path, init) => {
  const res = await fetch(BASE + path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${data?.error ?? ""}`);
  return data;
};

const consoleErrors = [];
/** lean-load aborts (fonts/images) log "Failed to load resource" as
 *  console errors under --single-process — remember what WE aborted so the
 *  zero-error assertion only speaks about the APP's own errors */
const abortedUrls = new Set();
/** the F drill fulfills a 500 ON PURPOSE — the browser logs any non-2xx
 *  fetch as a console error, so the zero-error assertion must skip the
 *  failure it itself ordered (flag lives only while the interception is
 *  installed) */
let fDrillActive = false;
const routeLean = (route) => {
  abortedUrls.add(route.request().url());
  route.abort();
};
const onConsoleError = (m) => {
  if (m.type() !== "error") return;
  const loc = m.location()?.url;
  if (loc && abortedUrls.has(loc)) return; // self-inflicted lean-load abort
  if (fDrillActive && /status of 500/.test(m.text())) return; // the drill's own forced failure
  consoleErrors.push(m.text().slice(0, 120));
};

if (PHASE === "g") {
  /* ---------- G — persistence survives a remount (FRESH browser, fresh
   * server session): whatever main left in the DB/sidecar is the truth a
   * cold load shows. ---------- */
  const gBrowser = await chromium.launch({
    // 4GB-box shaving: single renderer process + tiny V8 — the dev
    // server idles at ~2.5GB after warm; a stock chromium (~600MB) makes
    // every goto a coin flip with the OOM killer
    args: [
      "--single-process",
      "--js-flags=--max-old-space-size=256",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--renderer-process-limit=1",
    ],
  });
  const gPage = await gBrowser.newPage({ viewport: { width: 1280, height: 720 } });
  await gPage.route(/\.(woff2?|png|svg|jpe?g)$/i, routeLean);
  gPage.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 120)));
  gPage.on("console", onConsoleError);
  await gPage.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await gPage.waitForSelector("[data-job]", { timeout: 60000 });
  await gPage.waitForTimeout(2000);
  const gDom = await gPage.evaluate(() =>
    document.querySelectorAll("svg[data-edges-layer] g[data-edge-id]").length
  );
  const gSrv = (await api("/api/edges")).edges.length;
  must(gDom === gSrv, `G1 DOM wires (${gDom}) === server edges (${gSrv}) after a fresh load`);
  must(consoleErrors.length === 0, "G2 zero console/page errors" + (consoleErrors.length ? " — " + consoleErrors.slice(0, 3).join(" ; ") : ""));
  await gPage.screenshot({ path: SHOTS + "t359-d-final.png" });
  await gBrowser.close();
  console.log(`\ndiag-t359[g]: ${pass} passed, ${fail} failed ${fail === 0 ? "— ALL GREEN" : "— RED"}`);
  process.exit(fail === 0 ? 0 : 1);
}

const browser = await chromium.launch({
  // same 4GB-box shaving as the g-phase browser (see above)
  args: [
    "--single-process",
    "--js-flags=--max-old-space-size=256",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--renderer-process-limit=1",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// t356 lean-load doctrine: skip fonts/images, the 4GB box needs every MB
await page.route(/\.(woff2?|png|svg|jpe?g)$/i, routeLean);
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 120)));
page.on("console", onConsoleError);

/* ---------- stage: seed a dedicated target card ---------- */
const jobs = (await api("/api/jobs")).jobs;
const sel = jobs.find((j) => j.name === "2D Class Selection");
if (!sel) { console.error("seed project missing (2D Class Selection) — run the t356 seed first"); process.exit(1); }
const baselineEdges = (await api("/api/edges")).edges;
const { job: target } = await api("/api/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "class3d", name: TARGET_NAME, x: 760, y: 340, workspaceId: sel.workspaceId ?? undefined }),
});

await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector("[data-job]", { timeout: 60000 });
await page.waitForSelector(`[data-job]:has-text("${TARGET_NAME}")`, { timeout: 20000 });
await page.waitForTimeout(1200);

const domEdges = () => page.evaluate(() =>
  Array.from(document.querySelectorAll("svg[data-edges-layer] g[data-edge-id]")).map((g) => g.getAttribute("data-edge-id"))
);
const SRC = `[data-job]:has-text("2D Class Selection") [data-port="out:particles"]`;
const DST = `[data-job]:has-text("${TARGET_NAME}") [data-port="in:particles"]`;

async function dragWireTo() {
  // everything UP TO the drop (bboxes, press, travel, settle) — kept OUTSIDE
  // the latency clock so only mouse.up→paint is measured
  const sb = await page.locator(SRC).first().boundingBox();
  const db = await page.locator(DST).first().boundingBox();
  if (!sb || !db) throw new Error("ports not visible for the drag (sb=" + !!sb + " db=" + !!db + ")");
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + 60, sb.y + 30, { steps: 4 });
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 6 });
  await page.waitForTimeout(200);
}

/** rAF clock started BEFORE the action; resolves when the DOM edge count
 *  crosses `from` in direction `dir` ("more" | "less"). Returns ms. */
const edgeCountClock = (from, dir) => page.evaluate(([n, d]) => new Promise((resolve, reject) => {
  const t0 = performance.now();
  const to = setTimeout(() => reject(new Error("edge-count clock timed out")), 4000);
  const check = () => {
    const now = document.querySelectorAll("svg[data-edges-layer] g[data-edge-id]").length;
    if ((d === "more" && now > n) || (d === "less" && now < n)) { clearTimeout(to); resolve(performance.now() - t0); }
    else requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}), [from, dir]);

/** hover the wire, click the delete chip, resolve with ms-until-gone */
async function deleteWire(edgeId) {
  const hit = page.locator(`g[data-edge-id="${edgeId}"] path.edge-hit-path`).first();
  const bb = await hit.boundingBox();
  if (!bb) throw new Error("hit path not visible for " + edgeId);
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForSelector(`g[data-edge-id="${edgeId}"] [data-canvas-ui="edge-delete"]`, { timeout: 4000 });
  const gone = page.evaluate((id) => new Promise((resolve, reject) => {
    const t0 = performance.now();
    const el = document.querySelector(`g[data-edge-id="${id}"]`);
    const to = setTimeout(() => reject(new Error("edge never left the DOM")), 4000);
    const check = () => {
      if (!el || !el.isConnected) { clearTimeout(to); resolve(performance.now() - t0); }
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }), edgeId);
  await page.click(`g[data-edge-id="${edgeId}"] [data-canvas-ui="edge-delete"]`);
  return gone;
}

async function serverHasPair(fromId, toId) {
  const es = (await api("/api/edges")).edges;
  return es.find((e) => e.fromJobId === fromId && e.toJobId === toId) ?? null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("baseline: " + baselineEdges.length + " server edges, " + (await domEdges()).length + " DOM wires");

/* ---------- A — the wire draws NOW ---------- */
console.log("A — drag-connect: the wire must appear within one commit");
const before = (await domEdges()).length;
await dragWireTo();
const clock = edgeCountClock(before, "more"); // clock starts HERE — the window holds only mouse.up→paint
await page.mouse.up();
const aMs = await clock;
const after = (await domEdges());
must(after.length === before + 1, `A1 wire count ${before}→${after.length}`);
must(aMs < 250, `A2 wire appeared in ${aMs.toFixed(0)} ms (< 250 ms — no API round trip in the way)`);
const newEdgeId = after.find((id) => !baselineEdges.some((e) => e.id === id));
must(!!newEdgeId, "A3 the new wire carries a data-edge-id");
const aToast = await page.evaluate(() => document.body.textContent || "");
must(/Connected/.test(aToast), "A4 Connected toast fired immediately");
console.log(`  (wire ${newEdgeId} in ${aMs.toFixed(0)} ms)`);
await page.screenshot({ path: SHOTS + "t359-a-instant-wire.png" });

/* ---------- B — persistence lands in the background, SAME id ---------- */
console.log("B — background persistence keeps the client-minted id");
let row = null;
for (let i = 0; i < 30 && !row; i++) { row = await serverHasPair(sel.id, target.id); if (!row) await sleep(500); }
must(!!row, "B1 the POST eventually persisted the edge");
must(row && row.id === newEdgeId, `B2 server id === DOM id (${row?.id?.slice(0, 8)} vs ${newEdgeId?.slice(0, 8)}) — delete-by-id is safe`);

/* ---------- B2 — client-side dedupe on a second identical drag ---------- */
console.log("B2 — re-dragging the same pair is refused client-side");
const beforeB2 = (await domEdges()).length;
await dragWireTo();
await page.mouse.up();
await page.waitForTimeout(400);
const b2 = await page.evaluate(() => document.body.textContent || "");
must((await domEdges()).length === beforeB2, "B2a no second wire for the same pair");
must(/Already connected/.test(b2), "B2b Already connected toast");

/* ---------- C — the wire vanishes NOW ---------- */
console.log("C — hover delete chip: the wire must leave within one commit");
const cClock = Promise.resolve(deleteWire(newEdgeId));
const cMs = await cClock;
must((await domEdges()).length === beforeB2 - 1, "C1 wire left the canvas");
must(cMs < 250, `C2 wire vanished in ${cMs.toFixed(0)} ms (< 250 ms)`);
const cToast = await page.evaluate(() => document.body.textContent || "");
must(/Edge removed/.test(cToast), "C3 Edge removed toast fired immediately");

/* ---------- D — the DELETE lands in the background ---------- */
console.log("D — background delete reaches the server");
let gone = false;
for (let i = 0; i < 30 && !gone; i++) { gone = !(await serverHasPair(sel.id, target.id)); if (!gone) await sleep(500); }
must(gone, "D1 the row is gone server-side");
await page.screenshot({ path: SHOTS + "t359-b-deleted.png" });

/* ---------- E — THE RACE: delete before the POST lands ---------- */
console.log("E — connect + immediate delete while the POST is held 2.5 s (no ghost)");
await page.route("**/api/edges", async (route) => {
  if (route.request().method() === "POST") { await sleep(2500); } // hold the wire's POST
  await route.continue();
});
const eBefore = (await domEdges()).length;
await dragWireTo();
const eClock = edgeCountClock(eBefore, "more");
await page.mouse.up();
const eMs = await eClock;
must(eMs < 250, `E1 wire drew instantly even with the POST held (${eMs.toFixed(0)} ms)`);
const eIds = await domEdges();
const raceEdgeId = eIds[eIds.length - 1];
const eDelClock = Promise.resolve(deleteWire(raceEdgeId));
const eDelMs = await eDelClock;
must(eDelMs < 250, `E2 wire deleted instantly while its POST was in flight (${eDelMs.toFixed(0)} ms)`);
await page.unroute("**/api/edges");
// the held POST lands → server row appears → the doomed-cleanup DELETE must remove it
let ghost = await serverHasPair(sel.id, target.id);
for (let i = 0; i < 24 && ghost; i++) { await sleep(500); ghost = await serverHasPair(sel.id, target.id); }
must(!ghost, "E3 no ghost edge survives (doomed-cleanup DELETE fired after the POST landed)");
must((await serverHasPair(sel.id, target.id)) === null, "E4 server pair absent — UI and store agree");
await page.screenshot({ path: SHOTS + "t359-c-race-clean.png" });

/* ---------- F — server rejection rolls the optimistic wire back ---------- */
console.log("F — a forced 500 rolls the wire back with an honest toast");
fDrillActive = true;
await page.route("**/api/edges", async (route) => {
  if (route.request().method() === "POST") {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "forced 500 for the t359 rollback drill" }) });
  } else { await route.continue(); }
});
const fBefore = (await domEdges()).length;
await dragWireTo();
const fClock = edgeCountClock(fBefore, "more");
await page.mouse.up();
const fMs = await fClock;
must(fMs < 250, `F1 wire drew instantly (${fMs.toFixed(0)} ms)`);
// then the rollback must land within a moment
let rolledBack = false, fToastText = "";
for (let i = 0; i < 20 && !rolledBack; i++) {
  await sleep(100);
  rolledBack = (await domEdges()).length === fBefore;
  fToastText = await page.evaluate(() => document.body.textContent || "");
}
must(rolledBack, "F2 the optimistic wire rolled back out of the canvas");
must(/Connection refused/.test(fToastText), "F3 Connection refused toast told the truth");
await page.unroute("**/api/edges");
fDrillActive = false;
must(consoleErrors.length === 0, "F4 zero console/page errors through the whole drill" + (consoleErrors.length ? " — " + consoleErrors.slice(0, 3).join(" ; ") : ""));

/* ---------- G ran as its own session (see PHASE=g above) ---------- */

/* ---------- cleanup the drill's card ---------- */
try { await api(`/api/jobs/${target.id}`, { method: "DELETE" }); } catch { /* the undo tombstone keeps it recoverable; sandbox db anyway */ }

await browser.close();
console.log(`\ndiag-t359[main]: ${pass} passed, ${fail} failed ${fail === 0 ? "— ALL GREEN" : "— RED"}`);
process.exit(fail === 0 ? 0 : 1);
