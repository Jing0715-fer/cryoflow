// t102 diag2 — is localStorage shared across pages of ONE browser context
// in this playwright/chromium? (sessionStorage is not — t99 C1; if
// localStorage is also per-page here, deliverSync read null and the
// synthetic event carried null — matching the A1 FATAL exactly.)
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p1 = await b.newPage();
const p2 = await b.newPage();
await p1.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p2.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p1.evaluate(() => localStorage.setItem("share.probe", "from-p1"));
await sleep(300);
const seen = await p2.evaluate(() => localStorage.getItem("share.probe"));
console.log("p2 sees p1's write:", JSON.stringify(seen));
await p1.evaluate(() => localStorage.removeItem("share.probe"));
await b.close();
