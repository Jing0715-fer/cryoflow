// t664 warm-up — give the dev server one clean chance to compile the
// molstar-embed chunk BEFORE the e2e asks for it under probe pressure.
//
// The box's OOM killer has executed next-server mid-compile three windows
// running (dmesg: ~2.2GB anon-rss each time — the molstar chunk compile is
// the heaviest single operation dev mode performs). Once the compile has
// COMPLETED once, turbopack's cache survives restarts and the e2e's dance
// finds the chunk already built. This script loops the open-the-3D-dialog
// dance until __molstar is alive (or attempts run out), tolerating the
// OOM-restart windows in between: server healthy → dance → dead? → wait
// → again. It asserts nothing about the app; it exists so the e2e can.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(500);
  }
};
const serverHealthy = async () => {
  try {
    const r = await fetch(`${BASE}/api/jobs`, { cache: "no-store" });
    return r.ok;
  } catch { return false; }
};

const attempts = Number(process.argv[2] ?? 3);
let done = false;
for (let i = 1; i <= attempts && !done; i++) {
  if (!(await serverHealthy())) {
    console.log(`  attempt ${i}: server down — waiting for the watchdog`);
    for (let w = 0; w < 40 && !(await serverHealthy()); w++) await sleep(3000);
  }
  console.log(`  attempt ${i}: dancing…`);
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(2500);
    const row = page.locator(`[data-job="${REFINE3D_ID}"]`).first();
    if (!(await row.isVisible().catch(() => false))) { console.log("    · no roster row"); await b.close(); continue; }
    await row.click({ force: true });
    await sleep(1500);
    await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
    await sleep(1500);
    const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
    if (!(await enlarge.count())) { console.log("    · no enlarge"); await b.close(); continue; }
    await enlarge.scrollIntoViewIfNeeded().catch(() => {});
    await enlarge.click().catch(() => {});
    await sleep(1200);
    const v3d = page.locator("button", { hasText: "View in 3D" }).first();
    if (!(await v3d.count())) { console.log("    · no view3d"); await b.close(); continue; }
    await v3d.click().catch(() => {});
    const mol = await pollUntil(async () =>
      (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) || null, 180000);
    if (mol) {
      console.log("    · molstar alive — the chunk compile is cached");
      done = true;
    } else {
      console.log("    · molstar never woke (compile window?)");
    }
  } catch (e) {
    console.log(`    · attempt died: ${String(e.message).slice(0, 120)}`);
  }
  await b.close();
  if (!done) {
    console.log("    · letting the server settle (15s)");
    await sleep(15000);
  }
}
console.log(done ? "warm-up: OK" : "warm-up: FAILED (run the e2e anyway at your peril)");
process.exit(done ? 0 : 1);
