// qa63-smoke — post-writeRuns-migration smoke + console probe.
// Bootstraps dashboard → canvas → inspector (QA Post 320) → FSC compare
// dialog open/close, then asserts ZERO page errors. ~60 s total (fits the
// tool-call window that kept eating longer calls this window).
//
// Task 92 — MIGRATED agent-browser CLI → playwright (the last matrix
// member still on the old channel; Task 91's "zero agent-browser" claim
// missed it and qa58). Assertion set byte-identical, driver swapped per
// the qa70/qa66/qa69 migration template. The boot view depends on the
// store's persisted last view, so the Shift+D toggle loop converges on
// canvas from either start (press only while NOT canvas; t90 pattern).
//
// Run: node scripts/qa63-smoke.mjs   (server must be on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const B = "http://localhost:3000";
const HOST_JOB = "QA Post 320";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); process.exit(1); }
  console.log(`  ok: ${label}`);
};

// ---- boot -----------------------------------------------------------------
try { sh("pkill -f agent-browser"); } catch { /* none running */ }
// self-seed (Task 86 doctrine): the compare-dialog row count includes the
// RUNNING fixture, and qa62's --clean deletes exactly that job — running
// this suite right after qa62 (the matrix's alphabetical order) left 4
// rows vs the expected 5. Seed is idempotent by name, so the world this
// suite needs exists regardless of who ran before.
try { sh("python3 /home/z/my-project/scripts/qa60-seed-fsc.py >/dev/null 2>&1"); } catch { /* seed best-effort */ }
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
// dual collection replaces the old window.__qaErrs injection (qa70 template)
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(String(m.text() || m).slice(0, 160)); });
p.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));

await p.goto(B, { waitUntil: "networkidle" });
await sleep(1500);

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  if ((await curView()) === "canvas") {
    const card = await p.locator(`[data-job]`, { hasText: HOST_JOB }).count();
    if (card > 0) onCanvas = true;
  }
  if (!onCanvas) {
    await p.keyboard.press("Shift+D"); // toggle dashboard/canvas — converges
    await sleep(2200);
  }
}
must(onCanvas, "canvas renders with seeded job cards");

// ---- reach via find (Task 136 doctrine, backfilled here after the smoke
// false-failed twice: world-hygiene moves + restore events make the
// remembered viewport untrustworthy — the host card sat 474px ABOVE the
// viewport and playwright cannot scroll a transformed canvas. Ctrl+F →
// name → Enter (focusJob: center + legibility zoom) reaches any card in
// any world state; Esc leaves the selection intact (t134 contract).) ----
await p.keyboard.press("Control+f");
const findInput = p.locator('[data-testid="canvas-find-input"]');
if (await findInput.isVisible().catch(() => false)) {
  await findInput.fill(HOST_JOB);
  await sleep(300);
  await p.keyboard.press("Enter");
  await sleep(800);
  await p.keyboard.press("Escape");
  await sleep(400);
}

// ---- inspector -------------------------------------------------------------
let modal = false;
for (let i = 0; i < 5 && !modal; i++) {
  // data-job lives on the wrapper, role=button on the card body INSIDE it —
  // two elements, so the locator must chain, not compound
  const card = p.locator("[data-job]", { hasText: HOST_JOB }).locator('[role="button"]').first();
  try {
    await card.click({ timeout: 3000 });
    await sleep(1500);
    modal = await p.evaluate((host) => {
      const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => (d.textContent || "").includes(host));
      return !!dl;
    }, HOST_JOB);
  } catch { await sleep(1500); }
}
must(modal, "inspector modal opens for the completed postprocess job");

const fsc = await p.evaluate(() =>
  !!document.querySelector('section[aria-label="Fourier-shell correlation"]'));
must(fsc, "FSC section rendered inside inspector (state→workdir resolution alive post-migration)");

// ---- compare dialog open/close ---------------------------------------------
let dialog = false;
let rowCount = "0";
for (let i = 0; i < 5 && !dialog; i++) {
  try {
    await p.locator('[role=dialog] button[aria-label*="compare"], [role=dialog] button[title*="compare"]')
      .first().click({ timeout: 3000 });
    await sleep(1800);
    rowCount = String(await p.locator("[data-testid=fsc-compare-row]").count());
    dialog = Number(rowCount) >= 5;
  } catch { await sleep(1500); }
}
must(dialog, `compare dialog opens with rows (got ${rowCount}, expect 5)`);

// Esc closes only the dialog (inspector survives — qa61 layered-escape contract).
// Dispatch on the DIALOG element (qa62 pattern): target must be a DOM node on
// the React root's bubble path — a document-target event never reaches the
// Radix/React onKeyDown handlers.
const escRet = await p.evaluate(() => {
  const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => d.querySelector("[data-testid=fsc-compare-list]"));
  if (dl) dl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return dl ? "esc-dispatched" : "esc-NO-DIALOG";
});
// Radix unmounts on animation end — poll instead of a fixed sleep (a 1s
// wait raced the exit animation and false-failed this assertion once)
let cmpGone = false;
for (let i = 0; i < 10 && !cmpGone; i++) {
  await sleep(400);
  cmpGone = (await p.locator("[data-testid=fsc-compare-list]").count()) === 0;
}
const afterEsc = await p.evaluate((host) => {
  const cmp = !!document.querySelector("[data-testid=fsc-compare-row]");
  const insp = [...document.querySelectorAll("[role=dialog]")].some((d) => (d.textContent || "").includes(host));
  return (cmp ? "CMP" : "NOCMP") + (insp ? "+INSP" : "+NOINSP");
}, HOST_JOB);
must(afterEsc === "NOCMP+INSP", `Esc closes compare dialog, inspector survives - got "${afterEsc}" (dispatch: ${escRet}, cmpGone: ${cmpGone})`);

// ---- console verdict --------------------------------------------------------
must(consoleErrors.length === 0, `console errors: ${consoleErrors.length === 0 ? "0" : `**${consoleErrors.length}** ${JSON.stringify(consoleErrors.slice(0, 5))}`}`);

await b.close();
console.log("SMOKE GREEN");
