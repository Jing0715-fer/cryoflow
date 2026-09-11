// t134 — Task 134: canvas FIND BAR (Ctrl/⌘+F) — the ambient match lens:
//
//   lens     — typing rings every matching card amber (name OR type
//              label, case-insensitive) while the rest recede with the
//              SAME dim the note spotlight uses
//   honest   — the count never claims a viewport you are not looking
//              at: fresh query reads "N matches", first Enter reads
//              "1 of N", zero matches reads "no matches" and dims NOTHING
//   cycle    — Enter/Shift+Enter walk the viewport through the matches
//              via focusJob (arrival flash + ≥0.7 legibility zoom);
//   ephemeral— closing clears the query and every ring/dim; Esc in the
//              input stands down the page-level Escape ladder (the
//              selection survives — the Radix capture lesson, applied)
//
// Phase S — pre-clean T134 orphans, snapshot the roster, seed 3 uniquely
//           named jobs (Alpha motioncorr / Beta ctffind / Gamma import)
//           at staggered y in the default workspace.
// Phase B — Ctrl+F opens the bar, input focused, count blank; the zoom
//           toolbar carries the find toggle.
// Phase C — "T134": 3 matches, 3 amber-ringed cards, a non-match dimmed,
//           matches NOT dimmed.
// Phase D — Enter×3 walks 1of3→2of3→3of3 with the viewport transform
//           changing each hop; Shift+Enter walks back; Enter wraps.
// Phase E — "zzqq": honest "no matches", zero dims (no blank canvas).
// Phase F — type-LABEL oracle: "estimation" matches exactly the jobs the
//           API says are ctffind (label "CTF Estimation"), set-equal.
// Phase G — Esc closes with the selection preserved; × closes; reopen is
//           fresh (empty query).
// Phase H — screenshot with the lens active.
// Phase Z — console clean, T134 rows deleted, roster restored.
//
// Run: node scripts/t134-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { rmSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t134-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededIds = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

async function deleteT134Rows() {
  try {
    const all = await roster();
    for (const j of all) {
      if ((j.name ?? "").startsWith("T134")) {
        await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" }).catch(() => {});
      }
    }
  } catch {}
}

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
}

const must = (cond, label) => {
  if (!cond) {
    console.log(`FAIL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

/** the workspace transform "translate(xpx, ypx) scale(z)" → {x,y} */
const readViewport = async () =>
  p.locator('[data-canvas="workspace"]').evaluate((el) => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: NaN, y: NaN };
  });

/** ids of cards currently carrying the find ring */
const matchIds = async () =>
  p.locator("[data-job][data-find-match='true']").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );

/** ids of cards currently dimmed by the lens (note-spotlight-dim class) */
const dimmedIds = async () =>
  p.locator("[data-job].note-spotlight-dim").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );

async function main() {
  step("=== t134 — canvas find bar (Ctrl+F match lens) ===");

  /* ---------------- Phase S — baseline + seed ---------------- */
  step("--- Phase S: roster snapshot + T134 seeds ---");
  await deleteT134Rows(); // a KILLED previous run must not poison this one
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const seeds = [
    ["T134 Alpha", "motioncorr", maxY + 240],
    ["T134 Beta", "ctffind", maxY + 480],
    ["T134 Gamma", "import", maxY + 720],
  ];
  const seedIds = {};
  for (const [name, type, y] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type} @ y=${y})`);
    seedIds[name] = j.id;
    seededIds.push(j.id);
  }

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase B — Ctrl+F opens the bar ---------------- */
  step("--- Phase B: the shortcut arms the lens ---");
  must((await p.locator('[data-canvas-ui="find-bar"]').count()) === 0, "B0 bar closed before any shortcut");
  must((await p.locator('[data-canvas-ui="find-toggle"]').count()) === 1, "B1 find toggle lives in the zoom toolbar");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { timeout: 5000 });
  must(true, "B2 Ctrl+F opened the bar");
  await sleep(350); // the rAF focus lands a frame after mount
  const focused = await p.evaluate(
    () => document.activeElement?.getAttribute("data-testid") === "canvas-find-input"
  );
  must(focused, "B3 the find input owns focus");
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "",
    "B4 fresh bar reads no count (no query yet)"
  );
  // reopening while open is idempotent, NOT a toggle
  await p.keyboard.press("Control+f");
  await sleep(200);
  must((await p.locator('[data-testid="canvas-find-bar"]').count()) === 1, "B5 Ctrl+F twice is still one bar");

  /* ---------------- Phase C — the lens engages ---------------- */
  step("--- Phase C: matches ring, the rest recedes ---");
  await p.keyboard.type("T134");
  await sleep(400);
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "3 matches",
    "C1 fresh query reads '3 matches' (nothing centered yet)"
  );
  const mIds = await matchIds();
  must(
    JSON.stringify([...mIds].sort()) ===
      JSON.stringify([seedIds["T134 Alpha"], seedIds["T134 Beta"], seedIds["T134 Gamma"]].sort()),
    `C2 exactly the three seeded cards ring amber (${mIds.length})`
  );
  const alphaDimmed = await p
    .locator(`[data-job="${seedIds["T134 Alpha"]}"]`)
    .evaluate((el) => el.classList.contains("note-spotlight-dim"));
  must(!alphaDimmed, "C3 a matching card is NOT dimmed");
  // a non-match must be picked from the RENDERED canvas (the API roster
  // spans every workspace; only the active workspace's cards are in the
  // DOM — an off-workspace id would wait forever as a phantom locator)
  const renderedIds = await p.locator("[data-job]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job"))
  );
  const someOtherId = renderedIds.find((id) => !id.startsWith("T134") && !Object.values(seedIds).includes(id));
  const otherDimmed = await p
    .locator(`[data-job="${someOtherId}"]`)
    .evaluate((el) => el.classList.contains("note-spotlight-dim"));
  must(otherDimmed, `C4 a non-matching card recedes (${someOtherId})`);

  /* ---------------- Phase D — Enter cycles the viewport ---------------- */
  step("--- Phase D: Enter walks, Shift+Enter walks back ---");
  await p.keyboard.press("Enter");
  await sleep(750); // glide ~520ms + settle
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "1 of 3",
    "D1 first Enter centers match 1 ('1 of 3')"
  );
  const v1 = await readViewport();
  await p.keyboard.press("Enter");
  await sleep(750);
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "2 of 3",
    "D2 second Enter centers match 2 ('2 of 3')"
  );
  const v2 = await readViewport();
  await p.keyboard.press("Enter");
  await sleep(750);
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "3 of 3",
    "D3 third Enter centers match 3 ('3 of 3')"
  );
  const v3 = await readViewport();
  must(
    Math.abs(v1.y - v2.y) > 40 && Math.abs(v2.y - v3.y) > 40,
    `D4 the viewport actually hopped (y ${Math.round(v1.y)} → ${Math.round(v2.y)} → ${Math.round(v3.y)})`
  );
  await p.keyboard.press("Enter");
  await sleep(750);
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "1 of 3",
    "D5 Enter wraps to match 1"
  );
  await p.keyboard.press("Shift+Enter");
  await sleep(750);
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "3 of 3",
    "D6 Shift+Enter walks back to match 3"
  );

  /* ---------------- Phase E — zero matches stays honest ---------------- */
  step("--- Phase E: 'no matches' dims nothing ---");
  await p.keyboard.press("Control+a");
  await p.keyboard.type("zzqq");
  await sleep(400);
  must(
    (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim() === "no matches",
    "E1 zero hits read 'no matches'"
  );
  must((await matchIds()).length === 0, "E2 no rings anywhere");
  must((await dimmedIds()).length === 0, "E3 the canvas does NOT go dark (dim needs ≥1 hit)");

  /* ---------------- Phase F — the label oracle ---------------- */
  step("--- Phase F: type labels match (server-side oracle) ---");
  await p.keyboard.press("Control+a");
  await p.keyboard.type("estimation");
  await sleep(400);
  const live = await roster(); // fresh — same world the canvas polls
  const label = (t) =>
    ({ motioncorr: "Motion Correction", ctffind: "CTF Estimation", import: "Import Movies / Micrographs" }[t] ?? t);
  const onCanvas = new Set(
    await p.locator("[data-job]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job")))
  );
  const expected = live
    .filter(
      (j) =>
        onCanvas.has(j.id) && // the lens can only ever match RENDERED cards
        ((j.name ?? "").toLowerCase().includes("estimation") ||
          label(j.type).toLowerCase().includes("estimation")),
    )
    .map((j) => j.id)
    .sort();
  const uiIds = (await matchIds()).sort();
  must(
    JSON.stringify(uiIds) === JSON.stringify(expected),
    `F1 UI match set == predicate over API data (${uiIds.length} cards, incl. T134 Beta)`
  );
  must(uiIds.includes(seedIds["T134 Beta"]), "F2 T134 Beta matches via its TYPE label, not its name");

  /* ---------------- Phase G — close paths keep their promises ---------------- */
  step("--- Phase G: Esc preserves the selection; × clears; reopen is fresh ---");
  // select a card first: Esc in the find input must NOT deselect it
  await p.locator(`[data-job="${seedIds["T134 Alpha"]}"] [role="button"]`).first().click();
  await sleep(300);
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  must(true, "G1 Esc closed the bar");
  const alphaSelected = await p
    .locator(`[data-job="${seedIds["T134 Alpha"]}"] [role="button"]`)
    .first()
    .evaluate((el) => el.className.includes("ring-2"));
  must(alphaSelected, "G2 the selection SURVIVED the find Escape (ladder stood down)");
  must((await matchIds()).length === 0, "G3 rings cleared with the bar");
  must((await dimmedIds()).length === 0, "G4 dims cleared with the bar");
  // reopen → fresh empty query; × closes again
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  must(
    (await p.locator('[data-testid="canvas-find-input"]').inputValue()) === "",
    "G5 reopening starts with an empty query"
  );
  await p.keyboard.type("T134");
  await sleep(300);
  await p.locator('[data-testid="canvas-find-close"]').click();
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  must(true, "G6 × closes the bar mid-query");
  must((await matchIds()).length === 0, "G7 no residue after ×");

  /* ---------------- Phase H — visual ---------------- */
  step("--- Phase H: screenshot the lens ---");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("T134");
  await sleep(500);
  await p.screenshot({ path: `${OUT}/t134-find-bar.png` });
  must(true, "H1 visual: t134-find-bar.png captured");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const after = await roster();
  must(after.length === baseline.length, `Z3 T134 rows deleted, roster restored (${after.length})`);
  console.log(`\nT134 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
