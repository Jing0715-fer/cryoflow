import { chromium } from "playwright";
const b = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--disable-gpu-sandbox",
  ],
});
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const gl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  const g = c.getContext("webgl2") || c.getContext("webgl");
  return g ? (g.getParameter(g.RENDERER) ?? "yes") : null;
}).catch((e) => "eval-crash: " + e.message.slice(0, 60));
console.log("webgl:", String(gl).slice(0, 80));

const openDoor = async () => {
  await page.locator('[data-job="cmv6wl2ls000uu99xqvlodopd"]').first().click({ force: true });
  await new Promise((r) => setTimeout(r, 1500));
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  await page.locator('button[aria-label="Enlarge run_class001"]').first().click();
  await new Promise((r) => setTimeout(r, 1200));
  await page.locator("button", { hasText: "View in 3D (Mol*)" }).first().click();
};
await openDoor();
for (let i = 0; i < 14; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const st = await page.evaluate(() => {
    const mol = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector("[data-molstar-container]"));
    const t = mol?.innerText?.replace(/\s+/g, " ") ?? "";
    return {
      alive: true,
      webglFail: t.includes("WebGL does not seem"),
      ready: /\d+×\d+×\d+ vox/.test(t),
      canvas: !!mol?.querySelector("canvas"),
      anyDlg: document.querySelectorAll('[role="dialog"]').length,
    };
  }).catch(() => ({ alive: false, reload: true }));
  console.log(`t+${(i + 1) * 5}s:`, JSON.stringify(st));
  if (st.ready) break;
  if (!st.alive) { console.log("  (full reload — re-walking the door)"); await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {}); await new Promise((r) => setTimeout(r, 2500)); await openDoor(); }
}
await b.close();
