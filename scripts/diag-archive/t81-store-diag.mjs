// t81 store diag — replay the palette filter chain against the live store.
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on("console", (m) => console.log("[console]", m.text().slice(0, 200)));
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(800);

// zustand vanilla store lives on the hook — reach it through the React
// fiber of a component that subscribes (the header renders jobs count).
// Simpler: read the state via __NEXT specific? Use the exposed hook on
// window if next devtools... fallback: read from the palette DOM later.
// Direct approach: window.__store is NOT set — use React internals:
const info = await p.evaluate(() => {
  // grab any element with React fiber and walk to props/store — too fragile.
  // Instead: fetch the API fresh and replay with the SAME code path the
  // palette uses, but with store shapes we can't see. So report what the
  // DOM can tell us: workspace select value + select2d card presence.
  const card = [...document.querySelectorAll("[data-job]")].find((c) =>
    c.textContent?.includes("QA Class Select")
  );
  return { cardWorkspaceVisible: !!card };
});
console.log("dom:", JSON.stringify(info));
await b.close();
