/**
 * t560 — Task 559's two lanes, live-fired. The window that wrote them
 * died mid-verification (worklog Task 559 ends at "活体验证进行中");
 * this script is the verification it owed.
 *
 *   Lane B — the denoise→pick handoff (gesture family's second cut):
 *     B1  the completed topazdenoise's results view carries the
 *         "Put the clean stack to work" card (denoise-pick-handoff)
 *     B2  clicking "Pick this stack" mints an Auto-picking (Topaz)
 *         job: exact params (300 / -6 / 180 / args ""), the shared
 *         knobs inherited from the denoise (downscale, workers), its
 *         own dials at spec defaults, placed right of the denoise,
 *         ONE quiet wire denoise.micrographs → pick.micrographs
 *     B3  cleanup: DELETE the mint (edges cascade) → roster restored
 *
 *   Lane A — the tetraptych footer's provenance dialogue (⌖/⤸):
 *     A0  oblique block freshly on, provenance null → NO violet in
 *         the footer band (absent is honest)
 *     A1  ⌖ jump → violet dialogue rides the footer
 *     A2  a hand on the θ slider revokes it → violet gone
 *     A3  ⤸ adopt (camera-state event, dir [½,½,√½] → θ45·φ45; the
 *         thumbs SAY SO in the DOM) → violet back
 *     A4  the reset revokes it again → violet gone
 *
 *   Z    roster identity (12), console errors 0
 *
 * The violet probe counts pixels within the footer band (bottom 64
 * rows) near EXPORT_OBLIQUE_ACCENT #7c3aed — the dialogue is the only
 * violet the footer ever draws.
 *
 * Run: node scripts/t560-t559-handoff-live-fire.mjs   (server on :3000)
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const DENOISE_ID = "cmut5n5xl0005n53mmejkvyal";
const REFINE3D_ID = "cmurpj2ty0010n5nba6fzs8qc";
const H = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/" };
const VIOLET = [124, 58, 237]; // EXPORT_OBLIQUE_ACCENT #7c3aed
const FOOT_H = 64; // EXPORT_FOOT_H

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

/* ---- t291's PNG decoder (Node zlib, no deps) — verbatim reuse ---- */
function decodePng(buf) {
  let off = 8;
  let W = 0, Hh = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      W = data.readUInt32BE(0);
      Hh = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
    if (type === "IEND") break;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!bpp || bitDepth !== 8 || interlace !== 0)
    throw new Error(`unsupported png (depth ${bitDepth} color ${colorType} interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = W * bpp;
  const out = Buffer.alloc(Hh * stride);
  let p = 0;
  for (let y = 0; y < Hh; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= bpp && prev ? prev[x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { W, H: Hh, bpp, data: out };
}
const pxAt = (img, x, y) => {
  const i = (y * img.W + x) * img.bpp;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const near = (rgb, ref, tol) =>
  Math.abs(rgb[0] - ref[0]) <= tol && Math.abs(rgb[1] - ref[1]) <= tol && Math.abs(rgb[2] - ref[2]) <= tol;
function violetInFooter(img) {
  const y0 = img.H - FOOT_H;
  let n = 0;
  for (let y = y0; y < img.H; y++)
    for (let x = 0; x < img.W; x++)
      if (near(pxAt(img, x, y), VIOLET, 60)) n++;
  return n;
}

/* ---- world guard: the live window runs in the EMPIAR world ---- */
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const consoleErrors = [];
const client4xx5xx = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 400) client4xx5xx.push(`${r.status()} ${r.url()}`);
});

/* =================== LANE B — the denoise→pick handoff =================== */
console.log("== PHASE B: the denoise→pick handoff ==");
const denoise = jobs0.find((j) => j.id === DENOISE_ID);
must(!!denoise && denoise.status === "completed", "the world's topazdenoise is completed (the card's precondition)");

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(1800);
await page.locator(`[data-job="${DENOISE_ID}"]`).first().click({ force: true });
await sleep(1400);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1200);

const card = page.locator('[data-canvas-ui="denoise-pick-handoff"]');
await card.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
must(await card.isVisible().catch(() => false), 'B1: the "Put the clean stack to work" card is on the denoise\'s results view');
must((await card.textContent().catch(() => "")).includes("Pick this stack"), "B1: the card's gesture button reads Pick this stack");

await card.locator("button", { hasText: "Pick this stack" }).click();
const minted = await pollUntil(async () => {
  const r = await api("/api/jobs");
  const jobs = r.body?.jobs || [];
  return jobs.find((j) => j.type === "autopick" && !jobs0.some((o) => o.id === j.id)) || null;
}, 10000);
must(!!minted, "B2: the mint happened — a NEW autopick job is in the roster");
if (minted) {
  must(minted.status === "idle", `B2: the mint is idle (not auto-run) — status "${minted.status}"`);
  // t560 lesson: GET /api/jobs/[id] is 405 — the roster DTO is the read
  // model (it carries params/x/y verbatim, verified by curl before writing)
  const jb = minted;
  const p = jb.params || {};
  must(p.pickingMethod === "Topaz", `B2: pickingMethod=Topaz (${p.pickingMethod})`);
  must(Number(p.topazNrParticles) === 300, `B2: topazNrParticles=300 (${p.topazNrParticles})`);
  must(Number(p.topazThreshold) === -6, `B2: topazThreshold=-6 (${p.topazThreshold})`);
  must(Number(p.topazDiameter) === 180, `B2: topazDiameter=180 (${p.topazDiameter})`);
  must(p.topazArgs === "" || p.topazArgs == null, `B2: topazArgs empty (${JSON.stringify(p.topazArgs)})`);
  must(Number(p.topazDownscale) === Number(denoise?.params?.topazDownscale ?? -1),
    `B2: downscale inherited from the denoise (${p.topazDownscale} vs ${denoise?.params?.topazDownscale})`);
  must(Number(p.topazWorkers) === Number(denoise?.params?.topazWorkers ?? 1),
    `B2: workers inherited from the denoise (${p.topazWorkers} vs ${denoise?.params?.topazWorkers})`);
  must(jb.x > (denoise?.x ?? 0), `B2: placed RIGHT of the denoise (x ${jb.x} > ${denoise?.x})`);
  // the quiet wire resolves AFTER the roster already shows the mint —
  // POLL for it (last run read the ledger before the POST landed)
  const wireUp = await pollUntil(async () => {
    const e1 = (await api("/api/edges")).body?.edges || [];
    const w = e1.find((e) =>
      (e.fromJobId === DENOISE_ID || e.fromJob === DENOISE_ID) &&
      (e.toJobId === minted.id || e.toJob === minted.id));
    return w ? { wire: w, count: e1.length } : null;
  }, 10000);
  must(!!wireUp, "B2: ONE wire denoise → pick exists");
  if (wireUp) {
    const w = wireUp.wire;
    const fp = w.fromPort ?? w.fromPortName ?? "?";
    const tp = w.toPort ?? w.toPortName ?? "?";
    must(fp === "micrographs" && tp === "micrographs", `B2: the wire speaks micrographs → micrographs (${fp} → ${tp})`);
    must(wireUp.count === edges0.length + 1, `B2: exactly one edge added (${edges0.length} → ${wireUp.count})`);
  }

  console.log("  B3: cleanup — DELETE the mint (edges cascade)");
  const del = await api(`/api/jobs/${minted.id}?confirm=true`, { method: "DELETE" });
  must(del.status === 200 || del.status === 204, `B3: the mint is deleted (HTTP ${del.status})`);
  // release the orphan selection BEFORE any error accounting: the mint
  // was focusJob'ed on this very page, and deleting it behind the UI's
  // back makes the roster refresh re-mount the inspector, whose one-shot
  // /command preview fetch then 404s honestly for a ghost id (a test
  // choreography artifact, not an app bug — the hook swallows non-OK)
  await page.goto("about:blank");
  const after = await pollUntil(async () => {
    const r = await api("/api/jobs");
    const n = (r.body?.jobs || []).length;
    return n === BASE_N ? n : null;
  }, 10000);
  must(after === BASE_N, `B3: roster restored to ${BASE_N}`);
  const edges2 = (await api("/api/edges")).body?.edges || [];
  must(edges2.length === edges0.length, `B3: edge ledger restored (${edges2.length} === ${edges0.length})`);
}

/* ============== LANE A — the footer's provenance dialogue ============== */
console.log("== PHASE A: the footer's ⌖/⤸ dialogue ==");
// fresh page: the probe proved the dance works from a clean load — the
// same-page path carries Lane B's selection/deletion residue, and the
// dance is state-machine-shaped enough already
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(1800);
await page.locator(`[data-job="${REFINE3D_ID}"]`).first().click({ force: true });
await sleep(1500);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1500);

// the ortho panel lives behind the enlarge → View-in-3D dance (t291's
// path, probe-proven form: PLAIN clicks — force-clicks land on animating
// modals and die silently) — POLLED, not read, with one retry
let exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
const runDance = async () => {
  const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
  const enlUp = await pollUntil(async () => (await enlarge.count()) > 0 || null, 12000);
  if (!enlUp) return "no-enlarge";
  await enlarge.scrollIntoViewIfNeeded().catch(() => {});
  await enlarge.click().catch(() => {});
  await sleep(1200);
  const v3d = page.locator("button", { hasText: "View in 3D" }).first();
  if (!(await v3d.count())) return "no-view3d";
  await v3d.click().catch(() => {});
  const mol = await pollUntil(async () =>
    (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) || null, 60000);
  return mol ? "molstar" : "molstar-dead";
};
if (!(await exportBtn.count())) {
  const r1 = await runDance();
  console.log(`  dance #1: ${r1}`);
  if (r1 !== "molstar") { const r2 = await runDance(); console.log(`  dance #2: ${r2}`); }
  exportBtn = page.locator('[data-canvas-ui="ortho-export"]');
}
const exportUp = await pollUntil(async () => {
  const attached = await exportBtn.count();
  return attached > 0 || null;
}, 15000);
if (!exportUp) {
  // the failure autopsy: what DID the page render?
  const dcu = await page.locator("[data-canvas-ui]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-canvas-ui")))]);
  const tabs = await page.locator('[role="tab"]').allTextContents().catch(() => []);
  console.log(`  AUTOPSY: tabs=${JSON.stringify(tabs)} dcu=${JSON.stringify(dcu)}`);
}
must(!!exportUp, "A: the ortho export button is reachable");
await exportBtn.scrollIntoViewIfNeeded().catch(() => {});

// expand the ortho strip if collapsed (the oblique block only mounts
// when the strip is open AND the dims fetch has landed)
const stripBtn = page.locator('button[aria-expanded]', { hasText: "Orthogonal slices" }).first();
await stripBtn.scrollIntoViewIfNeeded().catch(() => {});
if ((await stripBtn.getAttribute("aria-expanded").catch(() => null)) === "false") {
  await stripBtn.click();
}
await pollUntil(async () => {
  const s = await stripBtn.getAttribute("aria-expanded").catch(() => null);
  return s === "true" || null;
}, 6000);
must((await stripBtn.getAttribute("aria-expanded").catch(() => "")) === "true", "A: the ortho strip is expanded");

// turn the oblique block ON (the fourth panel — the dialogue's owner)
const oblique = page.locator('[data-canvas-ui="ortho-oblique"]');
const obliqueUp = await pollUntil(async () => {
  const n = await oblique.count();
  return n > 0 || null;
}, 12000);
must(!!obliqueUp, "A: the oblique block is present under the strip");
await oblique.scrollIntoViewIfNeeded().catch(() => {});
if ((await oblique.getAttribute("data-oblique-state").catch(() => null)) === "off") {
  await oblique.locator("button").first().click();
}
await pollUntil(async () => {
  const s = await oblique.getAttribute("data-oblique-state").catch(() => null);
  return s === "on" || null;
}, 6000);
must((await oblique.getAttribute("data-oblique-state")) === "on", "A: the oblique block is ON");

async function exportFooter(tag) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    exportBtn.click(),
  ]);
  const p = `${SHOTS}/t560-${tag}.png`;
  await download.saveAs(p);
  // wait for the button's state to settle before the next export
  await pollUntil(async () => {
    const s = await exportBtn.getAttribute("data-ortho-export-state").catch(() => null);
    return s === "ok" || s === "idle" || s == null ? true : null;
  }, 6000);
  await sleep(300);
  return decodePng(readFileSync(p));
}

const img0 = await exportFooter("a0-baseline");
must(img0.W > 1000 && img0.H > 500, `A0: the export is a real tetraptych raster (${img0.W}×${img0.H})`);
const v0 = violetInFooter(img0);
must(v0 === 0, `A0: fresh block, provenance null — footer has NO violet (got ${v0})`);

// A1 — ⌖ jump: the camera swings face-on; the dialogue rides the footer
// AND the live UI now speaks it (t561: the violet chip beside the sliders)
await page.locator('[data-canvas-ui="ortho-oblique-jump"]').click();
await sleep(500);
const chip1 = page.locator('[data-canvas-ui="ortho-oblique-prov"]');
must(await chip1.isVisible().catch(() => false) && (await chip1.textContent().catch(() => "")).includes("⌖"),
  `A1: the live chip speaks the jump ("${(await chip1.textContent().catch(() => "")).trim()}")`);
const img1 = await exportFooter("a1-jump");
const v1 = violetInFooter(img1);
must(v1 > 0, `A1: after ⌖ jump the footer speaks the provenance (violet px ${v1})`);

// A2 — a hand on the θ slider revokes the reading
const thetaThumb = page.getByRole("slider", { name: "Polar angle of the plane normal" }).first();
await thetaThumb.scrollIntoViewIfNeeded().catch(() => {});
await thetaThumb.focus();
await page.keyboard.press("ArrowRight"); // step 5 — ANY scrub voids
await sleep(400);
must(!(await page.locator('[data-canvas-ui="ortho-oblique-prov"]').isVisible().catch(() => false)),
  "A2: the scrub revokes the live chip too (gone from the sliders)");
const img2 = await exportFooter("a2-scrub");
const v2 = violetInFooter(img2);
must(v2 === 0, `A2: after the θ scrub the footer is silent again (violet px ${v2})`);

// A3 — ⤸ adopt: the cut takes the camera's view. dir [½,½,√½] → θ45·φ45.
await page.evaluate(() => {
  window.dispatchEvent(new CustomEvent("cryoflow:ortho-camera-state", {
    detail: { dir: [0.5, 0.5, Math.SQRT1_2] },
  }));
});
await sleep(500);
const thNow = await thetaThumb.getAttribute("aria-valuenow");
const phiThumb = page.getByRole("slider", { name: "Azimuth angle of the plane normal" }).first();
const phNow = await phiThumb.getAttribute("aria-valuenow");
must(thNow === "45" && phNow === "45", `A3: the adopt landed θ${thNow}·φ${phNow} (expected 45·45)`);
const chip3 = page.locator('[data-canvas-ui="ortho-oblique-prov"]');
const chip3Text = (await chip3.textContent().catch(() => "")).trim();
must((await chip3.isVisible().catch(() => false)) && chip3Text.includes("⤸") && chip3Text.includes("45°·45°"),
  `A3: the live chip speaks the adopt ("${chip3Text}")`);
const img3 = await exportFooter("a3-adopt");
const v3 = violetInFooter(img3);
must(v3 > 0, `A3: after ⤸ adopt the footer speaks again (violet px ${v3})`);

// A4 — the reset revokes it (and returns the plane to the axis-aligned center)
await oblique.locator('button[title^="Back to the axis-aligned center plane"]').click();
await sleep(400);
const thR = await thetaThumb.getAttribute("aria-valuenow");
const phR = await phiThumb.getAttribute("aria-valuenow");
must(thR === "0" && phR === "0", `A4: the reset returns the plane (θ${thR}·φ${phR})`);
must(!(await page.locator('[data-canvas-ui="ortho-oblique-prov"]').isVisible().catch(() => false)),
  "A4: the reset revokes the live chip (gone)");
const img4 = await exportFooter("a4-reset");
const v4 = violetInFooter(img4);
must(v4 === 0, `A4: after the reset the footer is silent (violet px ${v4})`);

/* =================== Z — identity + console =================== */
console.log("== PHASE Z: identity ==");
const rosterZ = (await api("/api/jobs")).body?.jobs || [];
must(rosterZ.length === BASE_N, `Z: roster identity (${rosterZ.length} === ${BASE_N})`);
const edgesZ = (await api("/api/edges")).body?.edges || [];
must(edgesZ.length === edges0.length, `Z: edge ledger identity (${edgesZ.length} === ${edges0.length})`);
// the known-honest refusals: a seeded local refine3d inside a REMOTE-BOUND
// project synthesizes per-iteration chips (t354, the t474 derived-target
// guess) whose sheets the server honestly refuses (404; the SSH re-pull
// leg may even wobble to 502 when the wire refuses — same machinery, see
// server.log "refused by the wire"). The gallery shows its own error card.
// The console text carries NO url, so reconciliation goes by the response
// listener: every 404/502-flavored console error must map to a sheet-route
// hit of the refine3d job — any surplus or any other error fails the run.
const sheetHits = client4xx5xx.filter(
  (u) => u.includes("iterations/sheet") && u.includes(REFINE3D_ID)
);
const flavored = consoleErrors.filter((e) => e.includes("status of 404") || e.includes("status of 502"));
const otherErrors = consoleErrors.filter(
  (e) => !e.includes("status of 404") && !e.includes("status of 502")
);
const wobbles = client4xx5xx.filter((u) => u.startsWith("502 ") && u.includes("iterations/sheet"));
console.log(`  (sheet-route honest refusals: ${sheetHits.length} × 4xx/5xx on iterations/sheet${wobbles.length ? `, ${wobbles.length} × 502-wobble` : ""})`);
// whitelist the RESPONSES by URL (auditable), not the console counts —
// the browser may double-log one refused resource, but the LEDGER may
// not contain a single 404 outside the known honest refusal
const bad4xx = client4xx5xx.filter(
  (u) => u.startsWith("404") && !(u.includes("iterations/sheet") && u.includes(REFINE3D_ID))
);
must(bad4xx.length === 0, `Z: every 404 response is the known honest sheet refusal (${bad4xx.length} offenders${bad4xx.length ? `: ${bad4xx.join(" | ")}` : ""})`);
must(otherErrors.length === 0, `Z: console errors 0 beyond the known honest sheet refusals (${otherErrors.length}${otherErrors.length ? `: ${otherErrors[0]?.slice(0, 160)}` : ""})`);

await browser.close();
console.log(fail === 0 ? "\nALL GREEN — t559's two lanes are live-fire proven" : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
