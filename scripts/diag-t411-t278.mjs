#!/usr/bin/env node
/**
 * diag-t411-t278.mjs — reproduce t278 round 2 and dump the UI vs API truth.
 * The DTO grades exists=false correctly, but the dialog's helper still says
 * "live" after a reload. This probe dumps: how many [data-resume-helper]
 * nodes exist, their values, the résumé entries the API serves, and whether
 * the dialog actually opened.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SH = {
  Origin: BASE, Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty",
};

const connId = "t411probe" + Date.now().toString(36);
const conn = await (async () => {
  // create a probeless connection (t278's own body shape)
  const mk = await fetch(`${BASE}/api/remote/connections`, {
    method: "POST", headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ id: connId, name: "QA t411 Probe", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
  }).catch((e) => ({ ok: false, err: e.message }));
  const body = await mk.json?.().catch(() => null);
  console.log("create status:", mk.status ?? mk.err, "body id:", body?.connection?.id ?? body?.id);
  return body?.connection ?? body;
})();
console.log("connId:", connId);
if (!connId) { console.log("FAILED to create connection"); process.exit(1); }

const jobs = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
const realJobId = (jobs.jobs ?? []).find((j) => j.type === "import")?.id;
console.log("realJobId:", realJobId);
const deadId = "t411dead" + Date.now().toString(36);

const record = (jobId) => ({
  jobId, projectId: "qa-t411", type: "import", pid: null,
  cmd: "t411 probe witness", workdir: `/tmp/t411/${jobId}`,
  logFile: `/tmp/t411/${jobId}/run.out`, errFile: `/tmp/t411/${jobId}/run.err`,
  startedAt: new Date().toISOString(), done: true, exitCode: 0,
  remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct", stagedMs: 900, syncMs: 2100, syncedFiles: 2, syncedBytes: 2048 },
});

// inject live + dead
const snap = readFileSync(STATE_FILE, "utf8");
const obj = JSON.parse(snap);
obj[realJobId] = record(realJobId);
obj[deadId] = record(deadId);
writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2));

// wait for the server DTO to see both
let apiResume = null;
for (let i = 0; i < 10; i++) {
  await sleep(700);
  const list = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
  const c = (list.connections ?? list ?? []).find((x) => x.id === connId);
  if (c?.resume?.recent?.length >= 2) { apiResume = c.resume; break; }
}
console.log("\n=== API resume (connections list aperture) ===");
for (const e of apiResume?.recent ?? []) console.log(" ", e.jobId, "exists=", e.exists);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch((e) => console.log("click failed:", e.message?.slice(0, 80)));
await sleep(1500);

const helpers = page.locator("[data-resume-helper]");
const n = await helpers.count().catch(() => 0);
console.log(`\n=== UI [data-resume-helper] count: ${n} ===`);
for (let i = 0; i < n; i++) {
  console.log(`  [${i}] variant=`, await helpers.nth(i).getAttribute("data-resume-helper"), " text=", ((await helpers.nth(i).textContent()) ?? "").slice(0, 60));
}
const entries = page.locator("[data-resume-entry]");
const en = await entries.count().catch(() => 0);
console.log(`=== [data-resume-entry] count: ${en} ===`);
for (let i = 0; i < Math.min(en, 6); i++) {
  const id = await entries.nth(i).getAttribute("data-resume-entry");
  const gone = await entries.nth(i).getAttribute("data-resume-gone").catch(() => null);
  console.log(`  entry=${id} gone=${gone}`);
}

// restore
writeFileSync(STATE_FILE, snap);
await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH }).catch(() => {});
await browser.close();
console.log("\n(cleaned: state restored, connection deleted)");
