// t416 glamor shot: the demo chain's next-step menu proposes Topaz Denoise
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(3500);
// find the demo chain's Motion Correction node and open its next-step menu
const mc = page.getByText("Motion Correction 1", { exact: false }).first();
await mc.click();
await sleep(1200);
// the + / connect button on the selected node — the next-step universe
const addBtn = page.getByRole("button", { name: /connect|add|next step/i }).first();
let menuOpened = false;
try { await addBtn.click({ timeout: 4000 }); menuOpened = true; } catch { /* the node's menu may auto-open on selection */ }
await sleep(900);
const body = await page.locator("body").textContent();
const proposes = body.includes("Topaz Denoise");
console.log("menu opened:", menuOpened, "| proposes Topaz Denoise:", proposes);
await page.screenshot({ path: "/home/z/my-project/shots-qa/t416-next-step-menu.png" });
console.log("page errors:", errors.length);
await browser.close();
