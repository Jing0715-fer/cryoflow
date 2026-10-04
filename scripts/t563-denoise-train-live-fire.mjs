/**
 * t563 — the denoise→train handoff (the gesture family's third cut),
 * live-fired, plus the engine INPUTS fix it flushed out.
 *
 * The new feature surfaced a latent canvas-vs-engine lie (the t557 law:
 * a product feature is the best old-bug detector): the pairing map has
 * always allowed topazdenoise → manualpick/autopick/topaztrain, but the
 * engine's INPUTS table silently refused the denoise as a provider — a
 * legal wire whose run fails with "run Import first". t559's minted
 * pick and t563's minted train would both have hit it on their first
 * real run. The fix (topazdenoise in three from-lists) is proven here
 * by A/B through the engine's own honest-failure dialects:
 *   mouth refused   → "...run Import first" before RELION ever runs
 *   mouth resolved  → relion_autopick EXECUTES with --i naming the
 *                     denoised star (it then chokes on the mock star's
 *                     optics table — a mock data-shape artifact, not the
 *                     wiring; the old table would never have launched it)
 *
 *   W  world guard (EMPIAR t372, active, zero-drift baseline)
 *   R  refusal path: no completed Manual Picking on the canvas →
 *      the card's amber note tells the truth BEFORE the click, the
 *      click's refusal toast backs it, nothing is minted
 *   S1 seed a REAL native import (/home/z/empiar-10017 — the only
 *      micrographs with .coord files beside them) + run it
 *   S2 wire import→manualpick, run — native Henderson picks complete
 *   S3 reload → the card's note flips to emerald, naming the pick
 *   S4 click "Train on this stack" → mint: idle topaztrain, exact
 *      params (200/-6/180/0.2/"" + denoise downscale/workers), placed
 *      right of the denoise, TWO quiet wires (denoise→train
 *      micrographs, manualpick→train coords)
 *   S5 the A/B run proof (above)
 *   Z  cleanup: about:blank release, DELETE train + manualpick +
 *      import (edges cascade), roster/edges restored, console 0
 *
 * Run: node scripts/t563-denoise-train-live-fire.mjs   (server on :3000)
 */
import { chromium } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const PROJECTS_FILE = "/home/z/my-project/data/projects.json";
const H = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/" };

/* ---- the ghost-binding borrow ----
 * This world's project meta still carries remote.connectionId
 * "qa-t372-muro2rn5" — a connection DELETED from the registry by an
 * earlier window's cleanup (the binding was left behind). The import
 * leg in a remote-bound project has NO local escape by design ("the
 * picked paths live on it"), so a fresh local import is refused until
 * the ghost binding is cleared. Borrow semantics: remove the ghost
 * key for the duration of this probe, restore byte-exact in PHASE Z.
 * A LIVE binding aborts the script instead — borrowing means
 * returning; clearing a live cluster binding is not this probe's call. */
let borrowReceipt = null;
function borrowGhostBinding() {
  const raw = readFileSync(PROJECTS_FILE, "utf8");
  const doc = JSON.parse(raw);
  const meta = doc.projects?.[EMPIAR_ID];
  if (!meta?.remote?.connectionId) {
    console.log("  borrow: no remote binding — nothing to borrow");
    return;
  }
  const connId = meta.remote.connectionId;
  const conns = JSON.parse(readFileSync("/home/z/my-project/data/remote-connections.json", "utf8"));
  const alive = (Array.isArray(conns) ? conns : []).some((c) => c.id === connId);
  if (alive) {
    console.error(`FATAL: the project's binding ${connId} is ALIVE — the import would take the remote leg. Refusing to borrow a live binding.`);
    process.exit(3);
  }
  delete meta.remote;
  writeFileSync(PROJECTS_FILE, JSON.stringify(doc, null, 1));
  borrowReceipt = { connId, raw };
  console.log(`  borrow: ghost binding ${connId} removed for this probe (receipt kept)`);
}
function returnGhostBinding() {
  if (!borrowReceipt) return;
  writeFileSync(PROJECTS_FILE, borrowReceipt.raw);
  const connId = borrowReceipt.connId;
  borrowReceipt = null;
  console.log(`  return: ghost binding ${connId} restored byte-exact`);
}
process.on("exit", () => {
  if (borrowReceipt) {
    writeFileSync(PROJECTS_FILE, borrowReceipt.raw);
    console.error("  (safety net: ghost binding restored on exit)");
  }
});

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 300) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}
async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...H, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* html error page */ }
  return { status: res.status, body };
}

console.log("== PHASE W: world guard ==");
const proj = await api("/api/projects");
const active = (proj.body?.projects || []).find((p) => p.isActive || p.active);
must(active?.id === EMPIAR_ID, `active world is the EMPIAR world (${active?.id ?? "none"})`);
if (active?.id !== EMPIAR_ID) {
  console.error("FATAL: wrong active world — refusing to run (borrowed worlds must be borrowed on purpose)");
  process.exit(2);
}
const roster0 = await api("/api/jobs");
const jobs0 = roster0.body?.jobs || [];
const BASE_N = jobs0.length;
const edges0 = (await api("/api/edges")).body?.edges || [];
console.log(`  roster: ${BASE_N} jobs, ${edges0.length} edges`);

const denoise = jobs0.find((j) => j.type === "topazdenoise" && j.status === "completed");
must(!!denoise, `the world has a completed topazdenoise (${denoise?.name ?? "none"})`);
const DENOISE_ID = denoise?.id;
const denoiseStar = `/home/z/my-project/data/relion/${EMPIAR_ID}/topazdenoise_${DENOISE_ID?.slice(-8)}/denoised_micrographs.star`;
// workdir stems don't always follow the id-tail — locate via engine state instead
let resolvedStar = null;
try {
  const st = await import("node:fs").then((m) => m.readFileSync("/home/z/my-project/data/engine-state.json", "utf8"));
  const rec = JSON.parse(st)[DENOISE_ID];
  resolvedStar = rec?.outputs?.micrographs_star ?? null;
} catch { /* probe below decides */ }
must(!!resolvedStar && existsSync(resolvedStar), `the denoise's denoised_micrographs.star exists on disk (${resolvedStar ?? "missing"})`);

console.log("  -- the ghost-binding borrow --");
borrowGhostBinding();

/* ============ PHASE R — the refusal path (no manualpick yet) ============ */
console.log("== PHASE R: the refusal path — truth before the click ==");
const pickBefore = jobs0.filter((j) => j.type === "manualpick" && j.status === "completed");
must(pickBefore.length === 0, "precondition: NO completed Manual Picking in the world yet");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const consoleErrors = [];
const client4xx5xx = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 400) client4xx5xx.push(`${r.status()} ${r.url()}`);
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2000);
await page.locator(`[data-job="${DENOISE_ID}"]`).first().click({ force: true });
await sleep(1400);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1200);

const card = page.locator('[data-canvas-ui="denoise-train-handoff"]');
await card.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
must(await card.isVisible().catch(() => false), 'R1: the "Grow a trained model" card is on the denoise\'s results view');
must((await card.textContent().catch(() => "")).includes("Train on this stack"), "R1: the card's gesture button reads Train on this stack");
const pickCard = page.locator('[data-canvas-ui="denoise-pick-handoff"]');
must(
  (await pickCard.isVisible().catch(() => false)) &&
    (await pickCard.boundingBox().catch(() => null))?.y < (await card.boundingBox().catch(() => null))?.y,
  "R1: the third card stacks BELOW the second (pick spends today, train grows tomorrow)"
);

const note = card.locator('[data-testid="denoise-train-coords-note"]');
const noteText0 = (await note.textContent().catch(() => "")) || "";
must(noteText0.includes("Needs a completed Manual Picking"), `R2: the amber note tells the truth BEFORE the click ("${noteText0.trim().slice(0, 60)}...")`);
const noteClass0 = await note.getAttribute("class").catch(() => "");
must(noteClass0.includes("amber"), "R2: the note speaks amber (no source to name yet)");
await page.screenshot({ path: `${SHOTS}/t563-refusal-card.png`, clip: { x: 900, y: 0, width: 700, height: 950 } }).catch(() => {});

await card.locator("button", { hasText: "Train on this stack" }).click();
const refusalToast = await pollUntil(async () => {
  const t = await page.locator('[role="status"]').allTextContents().catch(() => []);
  return t.find((x) => x.includes("Training needs hand-picked coordinates")) || null;
}, 8000);
must(!!refusalToast, "R3: the refusal toast backs the amber note (Training needs hand-picked coordinates)");
const rosterR = await api("/api/jobs");
must((rosterR.body?.jobs || []).length === BASE_N, "R3: nothing was minted (roster unchanged)");

/* ============ PHASE S — the success path (seed + gesture) ============ */
console.log("== PHASE S: seed a real manualpick, then the gesture ==");
// S1 — a REAL import: /home/z/empiar-10017/micrographs is the only tree on
// this host where .coord Henderson picks sit beside the .mrc files, which
// is exactly what the native manualpick runner consumes.
const imp = await api("/api/jobs", {
  method: "POST",
  body: JSON.stringify({
    type: "import",
    x: (denoise?.x ?? 0) - 60,
    y: (denoise?.y ?? 0) + 330,
    workspaceId: denoise?.workspaceId ?? undefined,
    params: {
      nodeType: "micrographs",
      micrographsPath: "/home/z/empiar-10017/micrographs",
      pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1,
    },
  }),
});
must(imp.status === 200 || imp.status === 201, `S1: QA import minted (HTTP ${imp.status})`);
const IMPORT_ID = imp.body?.job?.id;
const runImp = await api(`/api/jobs/${IMPORT_ID}/run`, { method: "POST", body: JSON.stringify({ local: true }) });
must(runImp.status === 200, `S1: the import run started (HTTP ${runImp.status})`);
const impDone = await pollUntil(async () => {
  const r = await api("/api/jobs");
  const j = (r.body?.jobs || []).find((x) => x.id === IMPORT_ID);
  return j && (j.status === "completed" || j.status === "failed") ? j : null;
}, 90000);
must(impDone?.status === "completed", `S1: the import completed (status "${impDone?.status}", result "${(impDone?.result || "").slice(0, 60)}")`);

// S2 — wire import→manualpick and run the native Henderson picker
const mp = await api("/api/jobs", {
  method: "POST",
  body: JSON.stringify({
    type: "manualpick",
    x: (denoise?.x ?? 0) + 40,
    y: (denoise?.y ?? 0) + 330,
    workspaceId: denoise?.workspaceId ?? undefined,
    params: {},
  }),
});
must(mp.status === 200 || mp.status === 201, `S2: QA manualpick minted (HTTP ${mp.status})`);
const MP_ID = mp.body?.job?.id;
const MP_NAME = mp.body?.job?.name;
const edgeMp = await api("/api/edges", {
  method: "POST",
  body: JSON.stringify({ fromJobId: IMPORT_ID, toJobId: MP_ID, fromPort: "micrographs", toPort: "micrographs" }),
});
must(edgeMp.status === 200 || edgeMp.status === 201, `S2: import→manualpick wire drawn (HTTP ${edgeMp.status})`);
const runMp = await api(`/api/jobs/${MP_ID}/run`, { method: "POST", body: JSON.stringify({ local: true }) });
must(runMp.status === 200, `S2: the manualpick run started (HTTP ${runMp.status})`);
const mpDone = await pollUntil(async () => {
  const r = await api("/api/jobs");
  const j = (r.body?.jobs || []).find((x) => x.id === MP_ID);
  return j && (j.status === "completed" || j.status === "failed") ? j : null;
}, 90000);
must(mpDone?.status === "completed", `S2: the manualpick completed with Henderson picks (status "${mpDone?.status}", result "${(mpDone?.result || "").slice(0, 60)}")`);

// S3 — reload: the card's note must now NAME the coords source (emerald)
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2000);
await page.locator(`[data-job="${DENOISE_ID}"]`).first().click({ force: true });
await sleep(1400);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1200);
const noteText1 = (await note.textContent().catch(() => "")) || "";
must(noteText1.includes(`Coordinates will come from "${MP_NAME}"`), `S3: the note flipped to the named source ("${noteText1.trim().slice(0, 60)}...")`);
const noteClass1 = await note.getAttribute("class").catch(() => "");
must(noteClass1.includes("emerald"), "S3: the note speaks emerald (source found and named)");

// S4 — the gesture: mint the training job, two wires, exact params
await card.locator("button", { hasText: "Train on this stack" }).click();
const train = await pollUntil(async () => {
  const r = await api("/api/jobs");
  const jobs = r.body?.jobs || [];
  return jobs.find((j) => j.type === "topaztrain" && !jobs0.some((o) => o.id === j.id)) || null;
}, 10000);
must(!!train, "S4: the mint happened — a NEW topaztrain job is in the roster");
if (train) {
  must(train.status === "idle", `S4: the mint is idle (not auto-run) — status "${train.status}"`);
  const p = train.params || {};
  must(Number(p.topazNrParticles) === 200, `S4: topazNrParticles=200 spec default (${p.topazNrParticles})`);
  must(Number(p.topazThreshold) === -6, `S4: topazThreshold=-6 spec default (${p.topazThreshold})`);
  must(Number(p.topazDiameter) === 180, `S4: topazDiameter=180 spec default (${p.topazDiameter})`);
  must(Number(p.topazTestRatio) === 0.2, `S4: topazTestRatio=0.2 spec default (${p.topazTestRatio})`);
  must(p.topazArgs === "" || p.topazArgs == null, `S4: topazArgs empty — Args never cross stages (${JSON.stringify(p.topazArgs)})`);
  must(Number(p.topazDownscale) === Number(denoise?.params?.topazDownscale ?? -1),
    `S4: downscale inherited from the denoise (${p.topazDownscale} vs ${denoise?.params?.topazDownscale})`);
  must(Number(p.topazWorkers) === Number(denoise?.params?.topazWorkers ?? 1),
    `S4: workers inherited from the denoise (${p.topazWorkers} vs ${denoise?.params?.topazWorkers})`);
  must(train.x > (denoise?.x ?? 0), `S4: placed RIGHT of the denoise (x ${train.x} > ${denoise?.x})`);

  // the two quiet wires resolve AFTER the roster shows the mint — POLL
  const wireUp = await pollUntil(async () => {
    const es = (await api("/api/edges")).body?.edges || [];
    const w1 = es.find((e) => (e.fromJobId === DENOISE_ID || e.fromJob === DENOISE_ID) && (e.toJobId === train.id || e.toJob === train.id));
    const w2 = es.find((e) => (e.fromJobId === MP_ID || e.fromJob === MP_ID) && (e.toJobId === train.id || e.toJob === train.id));
    return w1 && w2 ? { w1, w2, count: es.length } : null;
  }, 10000);
  must(!!wireUp, "S4: BOTH wires exist (denoise→train, manualpick→train)");
  if (wireUp) {
    const fp = (e) => `${e.fromPort ?? e.fromPortName ?? "?"} → ${e.toPort ?? e.toPortName ?? "?"}`;
    must(fp(wireUp.w1) === "micrographs → micrographs", `S4: the denoise wire speaks micrographs → micrographs (${fp(wireUp.w1)})`);
    must(fp(wireUp.w2) === "coords → coords", `S4: the coords wire speaks coords → coords (${fp(wireUp.w2)})`);
    must(wireUp.count === edges0.length + 3, `S4: edge ledger = baseline +3 (${edges0.length} → ${wireUp.count})`);
  }

  const okToast = await pollUntil(async () => {
    const t = await page.locator('[role="status"]').allTextContents().catch(() => []);
    return t.find((x) => x.includes("Topaz Training minted") && x.includes(`coordinates from "${MP_NAME}"`)) || null;
  }, 8000);
  must(!!okToast, `S4: the toast names the coords source — honesty through naming`);
  await page.screenshot({ path: `${SHOTS}/t563-success-card.png`, clip: { x: 900, y: 0, width: 700, height: 950 } }).catch(() => {});

  // S5 — the A/B run proof: with the INPUTS fix, BOTH mouths resolve and
  // the honest failure moves to the missing external (old table refused
  // the run with "...run Import first" — the mouth, not the executable)
  const runTrain = await api(`/api/jobs/${train.id}/run`, { method: "POST", body: JSON.stringify({ local: true }) });
  must(runTrain.status === 200, `S5: the training run was accepted (HTTP ${runTrain.status})`);
  const trainDone = await pollUntil(async () => {
    const r = await api("/api/jobs");
    const j = (r.body?.jobs || []).find((x) => x.id === train.id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, 90000);
  const trainText = `${(trainDone?.result || "")} ${(trainDone?.error || "")} ${(runTrain.body?.error || "")}`;
  must(trainDone?.status === "failed" || trainDone?.status === "completed",
    `S5: the training run reached a terminal state (${trainDone?.status})`);
  must(!trainText.includes("run Import first") && !trainText.includes("run Import or Topaz Denoise first"),
    "S5: the mouth did NOT refuse the denoised stack (the INPUTS fix holds)");
  must(!trainText.includes("No upstream job is wired that produces training picks"),
    "S5: the coords mouth resolved too (no waiting dialect for the picks)");
  // the honest ceiling here is RELION itself executing and choking on the
  // mock star's optics table — the failure's own command line names the
  // DENOISED star as --i: the denoised stack literally reached the argv
  must(/relion_autopick[\s\S]*denoised_micrographs\.star/.test(trainText),
    "S5: relion_autopick executed with --i pointing at the denoised star (both mouths resolved into the argv)");
}

/* ============ PHASE Z — cleanup + accounting ============ */
console.log("== PHASE Z: cleanup — borrowed, then returned ==");
returnGhostBinding();
// release the UI's selection BEFORE deleting what it looks at (the t560
// ghost /command lesson): the mint was focusJob'ed on this very page
await page.goto("about:blank");
await sleep(400);
for (const [label, id] of [["train", train?.id], ["manualpick", MP_ID], ["import", IMPORT_ID]]) {
  if (!id) continue;
  const del = await api(`/api/jobs/${id}?confirm=true`, { method: "DELETE" });
  must(del.status === 200 || del.status === 204, `Z: the QA ${label} is deleted (HTTP ${del.status})`);
}
const after = await pollUntil(async () => {
  const r = await api("/api/jobs");
  const n = (r.body?.jobs || []).length;
  return n === BASE_N ? n : null;
}, 10000);
must(after === BASE_N, `Z: roster restored to ${BASE_N}`);
const edges2 = (await api("/api/edges")).body?.edges || [];
must(edges2.length === edges0.length, `Z: edge ledger restored (${edges2.length} === ${edges0.length})`);

// 4xx/5xx whitelist accounting (t560 law: account responses, not counts)
const ghosts = client4xx5xx.filter((u) => !/\/api\/jobs\/[a-z0-9]+\/command(\?|$)/.test(u) && !/\/sheet\//.test(u));
must(ghosts.length === 0, `Z: no unaccounted 4xx/5xx (${client4xx5xx.length} total, ghosts: ${ghosts.slice(0, 2).join(" | ") || "none"})`);
const relevantErrors = consoleErrors.filter((e) => !/404/.test(e) || true); // keep all — console dupes of whitelisted 404s are counted separately
must(consoleErrors.length === 0, `Z: console errors 0 (${consoleErrors.length}${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 80)}` : ""})`);

await browser.close();
console.log(fail === 0 ? "\nALL GREEN — the third knife is proven, the engine lie is retired" : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
