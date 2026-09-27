// t407 diag — open the Session QC report, dump the Map QC section state
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 940 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
const mapq = [];
page.on("response", (r) => { if (r.url().includes("map-profile")) mapq.push(`${r.status()} ${r.url().slice(-70)}`); });
const outs = [];
page.on("response", (r) => { if (r.url().includes("/outputs")) outs.push(`${r.status()} ${r.url().slice(-60)}`); });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector('button[aria-label="Open command palette (Ctrl+K)"]', { timeout: 30000 });
await page.click('button[aria-label="Open command palette (Ctrl+K)"]');
await page.waitForSelector('[cmdk-root]', { timeout: 10000 });
await sleep(500);
await page.locator('[data-slot="command-item"]', { hasText: "β-Galactosidase" }).first().click();
await sleep(2000);
await page.keyboard.press("Escape");
await sleep(800);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
// which project is active?
const active = await page.evaluate(() => {
  const el = [...document.querySelectorAll("button, [role=combobox]")].find((b) =>
    /Active project/i.test(b.getAttribute("aria-label") || b.getAttribute("title") || "")
  );
  return el ? (el.getAttribute("title") || el.textContent.trim()) : "NOT FOUND";
});
console.log("active project door:", JSON.stringify(active));
await page.locator('header [aria-label="Session QC report"]').click();
await page.locator("[data-report-doc]").waitFor({ state: "visible", timeout: 15000 });
await sleep(6000);
const state = await page.evaluate(() => {
  const body = document.querySelector("[data-report-body]");
  const h2s = [...document.querySelectorAll("[data-report-body] h2")].map((h) => h.textContent.trim().slice(0, 60));
  const hero = document.querySelectorAll("[data-report-body] .report-hero").length;
  const errEl = [...document.querySelectorAll("[data-report-body] *")].find((el) =>
    /map|error|unavailable|could not/i.test(el.textContent || "") && el.children.length === 0 && el.textContent.length < 120
  );
  const h2bytes = [...document.querySelectorAll("[data-report-body] h2")]
    .map((h) => JSON.stringify(h.textContent)).filter((t) => /^."Map QC/.test(t));
  return { hero, h2s: h2s.slice(0, 12), h2bytes, suspect: errEl ? errEl.textContent.trim().slice(0, 110) : null };
});
console.log("hero count:", state.hero);
console.log("h2s:", JSON.stringify(state.h2s, null, 1));
console.log("suspect line:", JSON.stringify(state.suspect));

// the exact walk + measure sequence, in-page
const seq = await page.evaluate(async () => {
  const jobs = (window.__store_probe = null) ?? null;
  const out = {};
  // replicate walkVolumeOwners: needs the store, which we cannot reach —
  // so replicate with the wire instead: all completed jobs
  const jobsList = (await (await fetch("/api/jobs")).json()).jobs ?? [];
  const done = jobsList.filter((j) => j.status === "completed");
  out.doneCount = done.length;
  const cap = done.filter((j) => /refine3d|class3d|postprocess|multibody/i.test(j.type)).slice(0, 4);
  out.candidates = cap.map((j) => j.id);
  // outputs probe for each
  out.outputs = {};
  for (const j of cap.slice(0, 6)) {
    try {
      const d = await (await fetch(`/api/jobs/${j.id}/outputs`)).json();
      const vols = (d.files ?? []).filter((f) => f.kind === "mrc" && Array.isArray(f.dims) && f.dims.length === 3);
      out.outputs[j.id.slice(-6)] = vols.map((f) => f.name);
    } catch (e) { out.outputs[j.id.slice(-6)] = "ERR " + String(e).slice(0, 60); }
  }
  // the deep measure on the postprocess winner
  const post = jobsList.find((j) => j.type === "postprocess" && j.status === "completed");
  if (post) {
    try {
      const d = await (await fetch(`/api/jobs/${post.id}/map-profile?path=${encodeURIComponent("postprocess.mrc")}&axis=z`)).json();
      out.profileBins = Array.isArray(d.bins) ? d.bins.length : JSON.stringify(d).slice(0, 80);
    } catch (e) { out.profileBins = "ERR " + String(e).slice(0, 80); }
  }
  return out;
});
console.log("walk+measure sequence:", JSON.stringify(seq, null, 1));

console.log("map-profile responses:", JSON.stringify(mapq, null, 1));
console.log("outputs responses:", outs.length, JSON.stringify(outs.slice(0, 4), null, 1));
console.log("console errors:", JSON.stringify(errs.slice(0, 5)));
await page.screenshot({ path: "scripts/shots-qa/t407-report-diag.png" });
await browser.close();
