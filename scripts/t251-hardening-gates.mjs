// t251 — the hardening closes its ring (Task 251).
// The Task 13 recital has been re-audited by hand window after window
// because its fixes were real but UNGATED: #5's same-origin + Host-pin
// door landed on fs/browse, outputs/file and map-profile, while the
// PARSED-DATA siblings (outputs/star, outputs listing, log, the six chart
// routes, micrographs, classes, picks, particles) kept serving workdir-
// derived content through an open door — the same star bytes the file
// route guards in text format were readable parsed next door. Task 251
// sweeps the door across all 12 siblings and pins the whole ring with
// THIS gate: three denial states per surface, containment still sharp
// behind the door, and the app's own same-origin world unharmed.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  the door (#5) — on ALL 16 guarded surfaces: no fetch metadata
//      (curl-style) → 403; cross-site Origin → 403; rebound Host
//      (the DNS-rebinding backstop: Origin passes, Host pin convicts)
//      → 403; same-origin metadata → the door OPENS (the route speaks)
//   C  containment (#6/#14) — authenticated traversal refused:
//      ../ lexical, percent-encoded, nested, and the classes workdir
//      override — each rejected with the contract message
//   D  the legit user — same-origin fetches FROM the app's own page
//      (the browser's real fetch-metadata credentials) reach every
//      guarded route: the UI's world is unharmed by its own door
//   E  console clean + the frame
//
// Run: node scripts/t251-hardening-gates.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// the 16 surfaces of the ring: fs/browse + map-profile + outputs/file
// (the original three) + the 13 siblings the t251 sweep covered
let JOB_ID = null;

const SURFACES = () => [
  { name: "fs/browse", url: `${BASE}/api/fs/browse` },
  { name: "map-profile", url: `${BASE}/api/jobs/${JOB_ID}/map-profile?path=x.mrc` },
  { name: "outputs/file", url: `${BASE}/api/jobs/${JOB_ID}/outputs/file?path=x.mrc` },
  { name: "outputs/star", url: `${BASE}/api/jobs/${JOB_ID}/outputs/star?path=x.star` },
  { name: "outputs", url: `${BASE}/api/jobs/${JOB_ID}/outputs` },
  { name: "log", url: `${BASE}/api/jobs/${JOB_ID}/log` },
  { name: "fsc", url: `${BASE}/api/jobs/${JOB_ID}/fsc` },
  { name: "guinier", url: `${BASE}/api/jobs/${JOB_ID}/guinier` },
  { name: "resolution", url: `${BASE}/api/jobs/${JOB_ID}/resolution` },
  { name: "angdist", url: `${BASE}/api/jobs/${JOB_ID}/angdist` },
  { name: "motion", url: `${BASE}/api/jobs/${JOB_ID}/motion` },
  { name: "ctf", url: `${BASE}/api/jobs/${JOB_ID}/ctf` },
  { name: "micrographs", url: `${BASE}/api/jobs/${JOB_ID}/micrographs` },
  { name: "classes", url: `${BASE}/api/jobs/${JOB_ID}/classes` },
  { name: "picks", url: `${BASE}/api/jobs/${JOB_ID}/picks` },
  { name: "particles", url: `${BASE}/api/jobs/${JOB_ID}/particles` },
];

// rebound-Host probe rides curl (undici refuses to forge Host; curl doesn't)
const curlCode = (url, host, origin) => {
  try {
    const out = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -H "Host: ${host}" -H "Origin: ${origin}" "${url}"`,
      { encoding: "utf8", timeout: 15000 },
    ).trim();
    return Number(out);
  } catch {
    return 0;
  }
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1480, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// ---- Phase A: demo truth ------------------------------------------------------
console.log("== PHASE A: demo truth ==");
const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
must(res.status() === 200, `homepage 200 (got ${res.status()})`);
await sleep(2500);
const roster = await page.evaluate(async () => {
  const r = await fetch("/api/jobs");
  return (await r.json()).jobs.length;
});
must(roster === 21, `roster identity 21 (got ${roster})`);
must(consoleErrors.length === 0, `the homepage's own world is console-clean (got ${consoleErrors.length})`);
// a real job id so the guarded routes reach their route-level answers
const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
JOB_ID = (jobs.jobs ?? [])[0]?.id ?? null;
must(!!JOB_ID, `a job id for the probes (got ${JOB_ID ?? "none"})`);

// ---- Phase B: the door (#5) — three denials + one opening ----------------------
console.log("== PHASE B: the door on all surfaces ==");
const surfaces = SURFACES();
let denied = 0, opened = 0;
for (const s of surfaces) {
  // 1. no fetch metadata (curl-style client) — the sensitive door slams
  const bare = await fetch(s.url);
  const bare403 = bare.status === 403;
  // 2. cross-site Origin — an attacker page's fetch metadata
  const cross = await fetch(s.url, { headers: { Origin: "http://evil.example" } });
  const cross403 = cross.status === 403;
  // 3. rebound Host — Origin passes (attacker domain == its own Host),
  //    the HOST PIN convicts: the browser always names the truth here
  const rebind = curlCode(s.url, "attacker.com", "http://attacker.com");
  const rebind403 = rebind === 403;
  // 4. same-origin metadata — the door opens and the ROUTE answers
  const own = await fetch(s.url, { headers: { "sec-fetch-site": "same-origin" } });
  const ownOpen = own.status !== 403;
  if (bare403 && cross403 && rebind403 && ownOpen) {
    denied += 3; opened += 1;
    console.log(`  ok: ${s.name} — bare 403 / cross 403 / rebind 403 / own ${own.status}`);
  } else {
    console.log(`  FAIL: ${s.name} — bare ${bare.status}/403 cross ${cross.status}/403 rebind ${rebind}/403 own ${own.status}/open`);
    if (!bare403) fail++;
    if (!cross403) fail++;
    if (!rebind403) fail++;
    if (!ownOpen) fail++;
  }
}
must(denied === surfaces.length * 3, `three denial states x ${surfaces.length} surfaces (got ${denied})`);
must(opened === surfaces.length, `the door opens for the same-origin caller on all ${surfaces.length}`);
// the showcase: fs/browse's roots view answers a real 200 to the same-origin caller
const roots = await fetch(`${BASE}/api/fs/browse`, { headers: { "sec-fetch-site": "same-origin" } });
const rootsBody = await roots.json().catch(() => ({}));
must(roots.status === 200 && Array.isArray(rootsBody.roots), `fs/browse roots view 200 with roots for the legit caller (${roots.status})`);

// ---- Phase C: containment (#6/#14) — sharp behind the door ---------------------
console.log("== PHASE C: containment still sharp ==");
const AUTH = { "sec-fetch-site": "same-origin" };
const c1 = await fetch(`${BASE}/api/jobs/${JOB_ID}/outputs/file?path=../../../../../etc/passwd`, { headers: AUTH });
must(c1.status === 400, `outputs/file lexical traversal refused (got ${c1.status})`);
const c1b = await (await fetch(`${BASE}/api/jobs/${JOB_ID}/outputs/file?path=%2e%2e/%2e%2e/etc/passwd`, { headers: AUTH })).json().catch(() => ({}));
must(c1.status === 400 && typeof c1b.error === "string", "encoded traversal refused too (.. survives percent-decoding)");
const c2 = await fetch(`${BASE}/api/jobs/${JOB_ID}/outputs/star?path=../../../../etc/passwd`, { headers: AUTH });
must(c2.status === 400, `outputs/star traversal refused (got ${c2.status})`);
const c3 = await fetch(`${BASE}/api/jobs/${JOB_ID}/outputs/file?path=sub/../../../../etc/passwd`, { headers: AUTH });
must(c3.status === 400, `nested traversal refused (got ${c3.status})`);
const c4 = await fetch(`${BASE}/api/jobs/${JOB_ID}/classes?workdir=/etc`, { headers: AUTH });
must(c4.status === 400, `classes workdir override refused (got ${c4.status})`);
const c4b = await c4.json().catch(() => ({}));
must(typeof c4b.error === "string" && c4b.error.includes("data/relion"), "the rejection names the contract tree (data/relion)");

// ---- Phase D: the legit user — the app's own page is unharmed -------------------
console.log("== PHASE D: the UI's own world behind its door ==");
const opened_in_page = await page.evaluate(async (surfaces) => {
  const out = [];
  for (const s of surfaces) {
    try {
      const r = await fetch(s.url); // the page's own origin — browser sends real metadata
      out.push({ name: s.name, status: r.status });
    } catch {
      out.push({ name: s.name, status: 0 });
    }
  }
  return out;
}, surfaces.map((s) => ({ name: s.name, url: s.url.replace(BASE, "") })));
const harmed = opened_in_page.filter((x) => x.status === 403 || x.status === 0);
must(harmed.length === 0, `no same-origin page fetch is harmed (harmed: ${harmed.map((h) => `${h.name}:${h.status}`).join(", ") || "none"})`);
const pageRoots = opened_in_page.find((x) => x.name === "fs/browse");
must(pageRoots && pageRoots.status === 200, `the page itself still lists the roots (fs/browse ${pageRoots?.status})`);

// ---- Phase E: console — probe noise separated from real noise -------------------
console.log("== PHASE E: console ==");
// D-phase probes deliberately provoke 404s (fake paths); Chromium logs each
// as a resource error. Real failures are: any pageerror, and any console
// error that is NOT a resource-status log. The homepage world was asserted
// clean right after Phase A.
const pageErrors = consoleErrors.filter((t) => !/^Failed to load resource/.test(t));
must(pageErrors.length === 0, `no real console errors (got ${pageErrors.length}: ${pageErrors.slice(0, 2).join(" | ")})`);
must(consoleErrors.length <= surfaces.length, `probe noise bounded (${consoleErrors.length} resource logs, ${surfaces.length} deliberate probes)`);
mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: `${SHOTS}/t251-hardening-ring-2x.png` });

await browser.close();
console.log(fail === 0 ? "t251: ALL PASS" : `t251: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
