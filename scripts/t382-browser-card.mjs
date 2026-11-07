#!/usr/bin/env node
/**
 * t382 — browser verification: the job CARD carries the particle count and
 * the twin-import refusal is visible on its card (the user's second ask:
 * 「job卡片上显示结果在cluster上，没有显示颗粒数等比较关键信息在卡片上」).
 * Lean chromium (the 4GB doctrine): single-process, 256MB v8, no assets.
 */
import { chromium } from "playwright";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const ORIGIN = { Origin: BASE };

let pass = 0, fail = 0;
const fails = [];
const must = (c, label, extra = "") => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(label); console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); }
};
const api = async (p, opts) => {
  const r = await fetch(`${BASE}${p}`, { ...opts, headers: { ...ORIGIN, ...(opts?.body ? { "Content-Type": "application/json" } : {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

// the t382 project from the E2E run (the newest "t382 gates" project)
const projects = (await api("/api/projects")).body.projects ?? [];
const proj = projects.filter((p) => p.name?.startsWith("t382 gates")).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
must(!!proj?.id, "B0 the t382 project exists");
const sw = await api("/api/projects/switch", { method: "POST", body: JSON.stringify({ id: proj.id }) });
must(sw.status === 200, `B1 the project is switched active (${sw.status})`);

const jobs = (await api("/api/jobs")).body.jobs ?? [];
const extJob = jobs.find((j) => j.type === "extract" && j.status === "completed");
must(!!extJob, "B2a the completed extract job exists");
must(/\d[\d,]* particles extracted/i.test(extJob?.result ?? ""), "B2b the extract result carries the count", (extJob?.result ?? "").slice(0, 200));
const twinJob = jobs.find((j) => j.name === "twin import (must refuse)");
must(!!twinJob && twinJob.status === "failed", "B3a the twin-import job exists and failed");
must(/different extensions/i.test(twinJob?.result ?? ""), "B3b its result names the twin mechanism", (twinJob?.result ?? "").slice(0, 200));

const consoleErrors = [];
const browser = await chromium.launch({
  args: [
    "--single-process",
    "--js-flags=--max-old-space-size=256",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--renderer-process-limit=1",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/\.(woff2?|png|svg|jpe?g)$/i, (route) => route.fulfill({ status: 204, body: "" }));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 160)));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("text=β-gal extract", { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // the extract card face must show the particle count (target by NAME —
  // the project also holds the "dupe extract" card, never run)
  const cardText = await page
    .locator(`[aria-label*="β-gal extract"]`)
    .first()
    .innerText({ timeout: 30_000 })
    .catch(() => "");
  console.log("  (extract card text):", JSON.stringify(cardText.slice(0, 400)));
  must(/728 particles extracted/i.test(cardText), "B4 the CARD FACE shows the particle count", cardText.slice(0, 300));
  must(!/^REMOTE\[[^\]]*\]:\s*$/.test(cardText.trim()), "B5 the card is not the bare remote envelope");

  // the twin-import card shows the refusal
  const twinText = await page
    .locator(`[aria-label*="twin import"]`)
    .first()
    .innerText({ timeout: 30_000 })
    .catch(() => "");
  must(/different extensions|basename/i.test(twinText), "B6 the twin-import card names the twin refusal", twinText.slice(0, 300));

  await page.screenshot({ path: "/tmp/t382-card.png", fullPage: false });
  must(consoleErrors.length === 0, "B7 zero console errors", consoleErrors.slice(0, 4).join(" | "));
} finally {
  await browser.close().catch(() => {});
  // chrome daemons survive close on this box — take the tree down by hand
  try { const { execSync } = await import("node:child_process"); execSync("pkill -9 -f 'chrome.*--single-process' 2>/dev/null; pkill -9 -f crashpad 2>/dev/null; true"); } catch {}
}

console.log("========================================");
console.log(`t382-browser: ${pass} passed, ${fail} failed`);
if (fail > 0) { console.log("FAILURES:"); for (const f of fails) console.log(`  - ${f}`); }
process.exit(fail > 0 ? 1 : 0);
