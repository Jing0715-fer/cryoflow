/** t524 — the cleanup dialog's history strip, photographed alive (take 3).
 *  qa63's proven doctrine verbatim (Ctrl+F find-focus — Task 136 — plus
 *  real-pointer card click with retry, then the Results tab walk), extended
 *  to the cleanup dialog: the inspector is a [role=dialog], and the cleanup
 *  dialog opens FROM it, so the two layers must be told apart by content.
 *  Playwright probe this window: launch→goto is healthy once the
 *  agent-browser chrome is killed (two chromes fight over the box's 2GB
 *  headroom — the t523 take-2 120s hang, named). */
import { chromium } from "playwright";

const HOST_JOB = "QA Post-process"; // the ledger-bearing job (t522's two zero-pass entries live here; QA Post 300 has none, and the strip is conditionally rendered — an empty ledger shows no strip)
const B = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const must = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${msg}`);
  if (!cond) process.exitCode = 1;
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(B, { waitUntil: "domcontentloaded", timeout: 20000 });
await sleep(2500);

// canvas (Shift+D as long as the canvas view is not showing the host card)
for (let i = 0; i < 8; i++) {
  const ready = await p.evaluate(() => [...document.querySelectorAll("[data-job]")].some((x) => x.textContent.includes("QA Post 300")));
  if (ready) break;
  await p.keyboard.press("Shift+D");
  await sleep(2200);
}
must(await p.locator(`[data-job]`, { hasText: HOST_JOB }).count() > 0, "host card reachable on canvas");

// find-focus (Task 136: playwright cannot scroll a transformed canvas)
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

// inspector open (real pointer, retry loop — qa63 verbatim)
let modal = false;
for (let i = 0; i < 5 && !modal; i++) {
  const card = p.locator("[data-job]", { hasText: HOST_JOB }).locator('[role="button"]').first();
  try {
    await card.click({ timeout: 3000 });
    await sleep(1500);
    modal = await p.evaluate((host) => [...document.querySelectorAll("[role=dialog]")].some((d) => (d.textContent || "").includes(host)), HOST_JOB);
  } catch {
    await sleep(1500);
  }
}
must(modal, "inspector modal opens for the completed postprocess job");

// the Clean door is an ICON-ONLY button (Eraser, size-7, ghost —
// job-inspector.tsx:2789): it has NO textContent, so hasText can never see
// it — the t523 "not visible on the initial layer" verdict was a bad
// locator, not a hidden button. aria-label is the true handle. It lives in
// the inspector's header row, outside the tab body — no tab walk needed.
const cleanBtn = p.locator('[role=dialog] [aria-label^="Clean intermediates"]').first();
const cleanVisible = await cleanBtn.isVisible().catch(() => false);
console.log("eraser button visible:", cleanVisible);
let cleanSeen = "";
if (cleanVisible) {
  cleanSeen = "header row";
  await cleanBtn.click({ timeout: 3000 });
  await sleep(1800);
}
must(!!cleanSeen, `Clean intermediates surfaced (tab: ${cleanSeen || "none"})`);

// the cleanup dialog layer + its history strip
const strip = await p.evaluate(() => {
  const dlgs = [...document.querySelectorAll("[role=dialog]")];
  const dlg = dlgs.find((d) => /tier|scope|Recent cleanups/i.test(d.textContent || "") && !/Motion Correction|CTF Estimation/.test(d.textContent || ""));
  if (!dlg) return null;
  return {
    recent: /Recent cleanups/i.test(dlg.textContent),
    doorBadges: (dlg.textContent.match(/\b(dialog|agent)\b/g) ?? []).length,
    snippet: dlg.textContent.replace(/\s+/g, " ").slice(0, 320),
  };
});
console.log("cleanup dialog strip:", JSON.stringify(strip));
must(!!strip, "cleanup dialog is open");
must(!!strip?.recent, "history strip (Recent cleanups) present in the dialog");

const shot = "/home/z/my-project/.qa-logs/t524-cleanup-dialog-history.png";
await p.screenshot({ path: shot, fullPage: false });
console.log("screenshot saved:", shot);
await b.close();
