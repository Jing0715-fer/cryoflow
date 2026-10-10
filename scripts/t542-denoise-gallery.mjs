// t542 — the Topaz Denoise compare gallery (a NEW results face): every
// denoised micrograph paired with its ORIGINAL under the provider job's
// workdir, rendered as a wipe card (drag the divider) or a side-by-side.
//
// The denoise job itself is t416's (the wrapper face, the remote lane, the
// chainable index star) — THIS suite is about the READ side: a route that
// walks the same lineage the engine's resolveInputs rides, pairs products
// with sources by stem identity (row order as the fallback), serves each
// half through its own job's outputs/file door (remote tiles via the t289
// lazy leg), and a gallery that self-hides on honest absence.
//
//   A  the product face — the pairs route (by-label star reading, the
//      provider scan, the stem map), the gallery component (wipe /
//      side-by-side / show-more), the lazy barrel + the type-gated mount
//   B  the live lane — fixture project, 6 local micrographs, a REAL local
//      import, the mock cluster's denoise dispatched REMOTE and COMPLETED
//   C  the pairs route — 6 rows, the import named as provider, every pair
//      carrying BOTH serving paths, both PNG doors answering image/png
//   D  honest absences — a non-denoise job answers empty (self-hide), an
//      unknown job 404s
//   E  the face in the world — the inspector shows the gallery, 6 cards,
//      the wipe input is the real control, the toggle flips to two-up,
//      console clean
//
// Run: node scripts/t542-denoise-gallery.mjs   (server on :3000, mock :3022)
import { chromium } from "playwright";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { worldProtectBasenames, worldSafeRmScript, worldGuardLine } from "./lib/world-safe-cleanup.mjs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const SHOTS = `${ROOT}/shots-qa`;
const FIXTURE = `${ROOT}/data/relion/t542-gallery`;
const CLUSTER_TREE = "/projects/cryoflow";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Content-Type": "application/json",
};

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: SH,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const b = await res.json().catch(() => ({}));
  return { status: res.status, body: b };
}

async function pollUntil(fn, ms, step = 1500) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  }).stdout?.trim() ?? "";

const createdJobs = [];
const connIds = [];
let fixtureProjectId = null;
let prevActiveProjectId = null; // the canvas-borrowing law: restored in finally
let weLaunchedMock = false;

// t265/t416's recipe — one tiny but VALID mrc (64×64 float32)
function mrcBuffer(seed = 1) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x44 + (seed % 3), 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin((i + seed) / 7) * 0.1, 1024 + i * 4);
  return buf;
}

/* ------------------------------------------------------------------ */
console.log("== PHASE A: the product face ==");
{
  const route = readFileSync(`${ROOT}/src/app/api/jobs/[id]/denoise-pairs/route.ts`, "utf8");
  must(route.includes('_rlnMicrographName') && route.includes('data_micrographs'),
    "the route reads the star BY LABEL (the star-reading doctrine)");
  must(route.includes('lineageFor') && route.includes('"micrographs_star", "micrographs_ctf_star"'),
    "the provider scan rides the engine's lineage + accepted keys");
  must(route.includes('relInside') && route.includes('path.basename(abs)'),
    "an escaping row degrades to its basename (the remote twin shape)");
  must(route.includes('isLocalRequest'),
    "the route keeps the #5 hardening door (same-origin only)");

  const comp = readFileSync(`${ROOT}/src/components/workflow/results/denoise-compare-gallery.tsx`, "utf8");
  must(comp.includes('useChartResource') && comp.includes('pollMs'),
    "the gallery rides the shared fetch state machine (t491)");
  must(comp.includes('clipPath') && comp.includes('type="range"'),
    "the wipe card's real control is a keyboard-accessible range input");
  must(comp.includes('side-by-side') && comp.includes('show more'),
    "both views and the paging door exist");
  must(comp.includes('unpaired') && comp.includes('no original'),
    "an unpaired card speaks its absence (t543 — no fake original half, no one-image wipe)");

  const lazy = readFileSync(`${ROOT}/src/components/workflow/results/results-lazy.tsx`, "utf8");
  must(lazy.includes('DenoiseCompareGallery'), "the lazy barrel carries the chunk");

  const view = readFileSync(`${ROOT}/src/components/workflow/results/results-view.tsx`, "utf8");
  must(view.includes('job.type === "topazdenoise"') && view.includes("<DenoiseCompareGallery"),
    "the mount is type-gated (the pairs fetch would be a lie for other jobs)");
}

/* ------------------------------------------------------------------ */
console.log("== PHASE B: the live lane ==");
let importJob = null;
let jobD = null;
let browser = null;
const consoleErrors = [];
try {
  const net = await import("node:net");
  const listening = await new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });
  if (!listening) {
    execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
    weLaunchedMock = true;
    await sleep(2500);
  }
  must(true, weLaunchedMock ? "the mock cluster was launched by this suite" : "the resident mock cluster is listening");

  // the canvas-borrowing law (t543): POST /api/projects ACTIVATES the new
  // project, and every roster-expecting suite after us reads the ACTIVE
  // project's world — so remember the borrower's previous active id from
  // data/projects.json and restore it in the finally below.
  try {
    const meta = JSON.parse(readFileSync("/home/z/my-project/data/projects.json", "utf8"));
    prevActiveProjectId = typeof meta.active === "string" ? meta.active : null;
  } catch { /* no ledger — nothing to restore */ }

  const proj = await api("POST", "/api/projects", { name: `t542 Gallery ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;

  mkdirSync(FIXTURE, { recursive: true });
  const micNames = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  micNames.forEach((n, i) => writeFileSync(path.join(FIXTURE, n), mrcBuffer(i + 1)));

  const mkJob = async (body) => {
    const r = await api("POST", "/api/jobs", body);
    if (r.status === 201 && r.body?.job?.id) createdJobs.push(r.body.job.id);
    return r.body?.job;
  };
  const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
    (await api("POST", "/api/edges", { fromJobId, toJobId, fromPort, toPort })).status;
  const readJob = async (id) => {
    const d = await api("GET", "/api/jobs");
    return (d.body?.jobs ?? []).find((x) => x.id === id) ?? null;
  };

  importJob = await mkJob({ type: "import", name: "t542 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed");

  const connId = `qa-t542-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId, name: "QA t542 Mock", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password", remoteRoot: CLUSTER_TREE,
  });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);

  jobD = await mkJob({ type: "topazdenoise", name: "t542 Denoise", params: {} });
  must(!!jobD?.id, "the denoise job exists");
  must(
    (await mkEdge(importJob.id, jobD.id, "micrographs", "micrographs")) >= 200,
    "import → denoise wired"
  );
  const d = await api("POST", `/api/jobs/${jobD.id}/run`, {
    remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" },
  });
  must(d.status === 200 || d.status === 201, `the denoise dispatched remote (${d.status})`);
  const doneD = await pollUntil(async () => {
    const j = await readJob(jobD.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneD?.status === "completed", `the cluster denoise COMPLETES (${doneD?.status}: ${(doneD?.result ?? "").slice(0, 70)})`);

/* ------------------------------------------------------------------ */
console.log("== PHASE C: the pairs route ==");
  const pr = await api("GET", `/api/jobs/${jobD.id}/denoise-pairs`);
  must(pr.status === 200, `the pairs route answers 200 (got ${pr.status})`);
  must(pr.body?.total === 6, `six rows counted (got ${pr.body?.total})`);
  must(pr.body?.provider?.id === importJob.id, "the provider is THE import (the engine's own pick)");
  must(pr.body?.paired === 6, `every row paired (got ${pr.body?.paired})`);
  const pairs = pr.body?.pairs ?? [];
  must(
    ["mic_01", "mic_02", "mic_03", "mic_04", "mic_05", "mic_06"].every((s) =>
      pairs.some((p) => p.name === s)
    ),
    "the stems speak the wrapper's own recipe"
  );
  must(pairs.every((p) => !!p.denoised), "every denoised half carries a serving path");
  must(pairs.every((p) => p.originalJobId === importJob.id), "every original is served by the import's door");

  // both PNG doors answer — the denoised tile rides the t289 lazy leg
  const den0 = pairs[0]?.denoised;
  const imgD = await fetch(
    `${BASE}/api/jobs/${jobD.id}/outputs/file?path=${encodeURIComponent(den0)}&format=png`,
    { headers: SH }
  );
  must(imgD.status === 200 && (imgD.headers.get("content-type") ?? "").includes("image/png"),
    `the denoised PNG door answers (got ${imgD.status} ${imgD.headers.get("content-type")})`);
  const orig0 = pairs[0]?.original;
  const imgO = await fetch(
    `${BASE}/api/jobs/${importJob.id}/outputs/file?path=${encodeURIComponent(orig0)}&format=png`,
    { headers: SH }
  );
  must(imgO.status === 200 && (imgO.headers.get("content-type") ?? "").includes("image/png"),
    `the original PNG door answers from the import (${imgO.status})`);

/* ------------------------------------------------------------------ */
console.log("== PHASE D: honest absences ==");
  const pd = await api("GET", `/api/jobs/${importJob.id}/denoise-pairs`);
  must(pd.status === 200 && pd.body?.total === 0 && (pd.body?.pairs ?? []).length === 0,
    "a non-denoise job answers EMPTY (the self-hide contract, not a wound)");
  const p404 = await fetch(`${BASE}/api/jobs/does-not-exist/denoise-pairs`, { headers: SH });
  must(p404.status === 404, `an unknown job 404s (got ${p404.status})`);

/* ------------------------------------------------------------------ */
console.log("== PHASE E: the face in the world ==");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await page.locator(`[data-job="${jobD.id}"]`).first().click({ force: true }).catch(() => {});
  await sleep(2200);
  must((await page.locator('[role="dialog"]').count()) > 0, "the inspector dialog opened");
  const section = page.locator('section[aria-label="Denoise compare"]');
  if (!(await section.isVisible().catch(() => false))) {
    const dlgText = await page.locator('[role="dialog"]').last().innerText().catch(() => "(no dialog)");
    console.log(`  [forensics] dialog head: ${dlgText.slice(0, 200).replace(/\n+/g, " | ")}`);
    const pageFetch = await page.evaluate(async (url) => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const b = await r.json().catch(() => ({}));
        return `status=${r.status} total=${b.total} paired=${b.paired}`;
      } catch (e) {
        return `threw: ${String(e).slice(0, 80)}`;
      }
    }, `${BASE}/api/jobs/${jobD.id}/denoise-pairs`);
    console.log(`  [forensics] in-page pairs fetch: ${pageFetch}`);
  }
  must(await section.isVisible().catch(() => false), "the inspector shows the Denoise compare gallery");
  must((await section.locator('[data-denoise-card]').count()) === 6, "six cards on the first page");
  must((await section.locator('input[type="range"]').count()) === 6, "every wipe card carries its range control");
  must((await section.getByText("originals: t542 Import").count()) >= 1, "the provider badge names the import");
  // the wipe responds to its control: scrub the first card's divider left.
  // The card's pos IS the original's left band width — pos 15 renders
  // clip-path inset(0 85% 0 0) (the ORIGINAL clipped over the denoised
  // base), so the honest pin asserts the complement, not the raw value.
  const firstRange = section.locator('input[type="range"]').first();
  await firstRange.focus().catch(() => {});
  await firstRange.fill("15").catch(() => {});
  await sleep(250);
  const clip = await section.locator('[data-denoise-card]').first()
    .locator("div[style*='clip-path']").first()
    .getAttribute("style").catch(() => "");
  must(clip != null && /85%/.test(clip ?? ""), `the divider scrubs (pos 15 → original band 15% → clip "${(clip ?? "").slice(0, 46)}…")`);
  // the toggle flips to two-up
  await section.locator("button").filter({ hasText: "side-by-side" }).first().click();
  await sleep(350);
  must((await section.locator("figure").first().locator("img").count()) >= 2,
    "the side-by-side view shows both halves");
  await page.screenshot({ path: `${SHOTS}/t542-denoise-gallery.png` });
  must(consoleErrors.length === 0, `console stays clean (${consoleErrors.length} errors)`);
} catch (e) {
  fail++;
  console.log(`  FAIL: unexpected: ${e?.message ?? e}`);
} finally {
  try {
    // the canvas goes back first: restore the previous active project so
    // the next roster-expecting suite reads the world it expects, then the
    // empty fixture shell dies (its jobs are already gone below)
    if (prevActiveProjectId) {
      await fetch(`${BASE}/api/projects/switch`, { method: "POST", headers: SH, body: JSON.stringify({ id: prevActiveProjectId }) }).catch(() => {});
    }
    if (fixtureProjectId) {
      await fetch(`${BASE}/api/projects/${fixtureProjectId}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
    for (const id of [...createdJobs].reverse()) {
      await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
    }
    for (const cid of connIds) {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
    let worldProtect = [];
    try {
      const wj = await api("GET", "/api/jobs");
      worldProtect = worldProtectBasenames(wj.body?.jobs ?? [], createdJobs);
    } catch { /* the API is gone — the glob degrades to plain rm */ }
    console.log(worldGuardLine(worldProtect.length));
    const parts = [
      worldSafeRmScript([`${CLUSTER_TREE}/*/topazdenoise_*`], worldProtect),
      fixtureProjectId ? `rm -rf ${CLUSTER_TREE}/${fixtureProjectId} 2>/dev/null || true` : ": no project shell",
    ];
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* gone */ }
  if (browser) { try { await browser.close(); } catch { /* gone */ } }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
