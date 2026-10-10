// t632 — final UI probe via playwright (agent-browser daemon is in a
// CDP relaunch loop after tonight's kernel OOM; qa66 doctrine: a fresh
// playwright profile is immune to the daemon's environment disease).
// Verifies the canonical world end-to-end through the browser: 12 rows,
// 0 orphans, chips at rest, console clean — and takes the window's
// closing screenshot.
import { chromium } from "playwright";

const B = "http://127.0.0.1:3000";
const errors = [];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on("console", (m) => { if (m.type() === "error") errors.push(String(m.text()).slice(0, 120)); });
p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

await p.goto(B, { waitUntil: "domcontentloaded", timeout: 30000 });

// converge on dashboard (t90 toggle pattern; poll, don't sleep blindly)
for (let i = 0; i < 12; i++) {
  const view = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  const rows = await p.locator("[data-roster-row]").count();
  if (view === "dashboard" && rows === 12) break;
  if (view !== "dashboard") await p.keyboard.press("Shift+D");
  await p.waitForTimeout(1800);
}

const state = await p.evaluate(() => ({
  rows: document.querySelectorAll("[data-roster-row]").length,
  orphans: document.querySelectorAll('[data-row-ws="orphan"]').length,
  chips: [...document.querySelectorAll("button")].filter((x) => /^(ALL|COMPLETED|IDLE|RUNNING|FAILED) \d+$/.test(x.textContent.trim())).map((x) => x.textContent.trim()),
}));
console.log("state:", JSON.stringify(state));
console.log(`console errors: ${errors.length}${errors.length ? " " + JSON.stringify(errors.slice(0, 3)) : ""}`);

await p.screenshot({ path: "/home/z/my-project/.qa-logs/t632-final-12jobs.png" });
console.log("📸 t632-final-12jobs.png");

const ok = state.rows === 12 && state.orphans === 0 && errors.length === 0;
await b.close();
console.log(ok ? "UI PROBE GREEN" : "UI PROBE RED");
process.exit(ok ? 0 : 1);
