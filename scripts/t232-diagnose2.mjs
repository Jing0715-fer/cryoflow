// t232 diagnosis 2: SSR HTML vs hydrated DOM text diff — the mismatching
// text reveals itself. Fetch the SSR HTML with curl-equivalent (fetch API),
// then load in playwright and walk the same tree; diff text nodes.
import { chromium } from "playwright";

const res = await fetch("http://localhost:3000");
const ssr = await res.text();
// pull visible text out of the SSR stream crudely: strip tags, collapse ws
const ssrText = ssr
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, "\n")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'")
  .split("\n").map((s) => s.trim()).filter(Boolean);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 3500));
const domText = await page.evaluate(() => {
  const out = [];
  const walk = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = (n.textContent ?? "").trim();
        if (t) out.push(t);
      } else if (n.nodeType === Node.ELEMENT_NODE && !["SCRIPT", "STYLE", "NOSCRIPT"].includes(n.tagName)) {
        walk(n);
      }
    }
  };
  walk(document.body);
  return out;
});
await browser.close();

// the SSR stream contains many pages' worth of streamed text; instead of a
// strict set diff, look for TEXTS IN SSR ABSENT FROM DOM and vice versa,
// filtered to short UI-string-looking lines (skip numbers-only noise)
const domSet = new Set(domText);
const ssrSet = new Set(ssrText);
const onlySsr = [...ssrSet].filter((t) => !domSet.has(t) && t.length < 80);
const onlyDom = [...domSet].filter((t) => !ssrSet.has(t) && t.length < 80);
console.log("=== texts only in SSR (first 30) ===");
console.log(onlySsr.slice(0, 30).join("\n"));
console.log("=== texts only in DOM (first 30) ===");
console.log(onlyDom.slice(0, 30).join("\n"));
