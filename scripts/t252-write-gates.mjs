// t252 — the write door closes (Task 252).
// Task 251 closed the READ ring (16 surfaces, four states each). The CSRF
// review's second half is the WRITE surface, and the honest threat model
// splits it three ways:
//   1. BODYLESS ACTION POSTs — run, stop, duplicate, empiar-seed — need no
//      parseable body, so a cross-site HTML form can fire them BLIND (the
//      drive-by's only writable channel: forms POST, no-cors POSTs; but
//      forms cannot send JSON, and JSON-body routes reject urlencoded
//      bodies with a 400 — self-defended). empiar-seed is the worst of
//      the four: the ONLY id-less action in the app, an entire EMPIAR
//      project with 10 jobs and engine dispatches seedable with nothing
//      to guess. These four get the isLocalRequest door.
//   2. JSON-body POSTs — the form sends urlencoded, request.json() throws,
//      route 400s: method+content-type self-defense. Empty-tolerant
//      parsers (.catch(() => ({}))) VALIDATE the empty payload and 400 it
//      with the contract message (restore needs jobs[1–500], layout needs
//      valid updates) — the blind POST changes zero state. No door
//      needed; this suite asserts the self-defense live.
//   3. PUT/PATCH/DELETE — method-level immunity: HTML forms speak
//      GET/POST only, no-cors fetch GET/POST/HEAD only, and a CORS-mode
//      cross-origin DELETE/PATCH/PUT needs a preflight that no route
//      answers (no OPTIONS handlers exist) — blocked by spec.
// The door-open state for empiar-seed is deliberately NOT fired in QA:
// it seeds a world (project + 10 jobs + auto-runs). The door is the same
// isLocalRequest pair proven open on its three siblings — sibling-proof.
//
// Phases:
//   A  demo truth — homepage 200, roster 23, homepage console-clean
//   B  the write door — run/stop/duplicate (fake id): bare 403 / cross
//      Origin 403 / rebound Host 403 (curl forges) / same-origin → 404
//      route-speak; empiar-seed: the three denials 403
//   C  self-defense ledger — JSON routes reject a form-style urlencoded
//      body (400) and explicitly reject empty payloads with their contract
//      messages (400 + zero state change); roster unchanged throughout
//   D  the legit user — the app's own page fires the same actions from
//      its origin: fake-id run 404 route-speak, no 403 anywhere
//   E  console — probe noise bounded, no real errors, the frame
//
// Run: node scripts/t252-write-gates.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";
const FAKE_ID = "t252-nonexistent-job";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// rebound-Host probe rides curl (undici refuses to forge Host; curl doesn't)
const curlCode = (url, host, origin) => {
  try {
    return Number(
      execSync(
        `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Host: ${host}" -H "Origin: ${origin}" "${url}"`,
        { encoding: "utf8", timeout: 15000 },
      ).trim(),
    );
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
const roster0 = await page.evaluate(async () => (await (await fetch("/api/jobs")).json()).jobs.length);
must(roster0 === 23, `roster identity 23 (got ${roster0})`);
must(consoleErrors.length === 0, `the homepage's own world is console-clean (got ${consoleErrors.length})`);

// ---- Phase B: the write door ---------------------------------------------------
console.log("== PHASE B: the write door on the bodyless actions ==");
const ACTIONS = [
  { name: "run", url: `${BASE}/api/jobs/${FAKE_ID}/run` },
  { name: "stop", url: `${BASE}/api/jobs/${FAKE_ID}/stop` },
  { name: "duplicate", url: `${BASE}/api/projects/${FAKE_ID}/duplicate` },
];
for (const a of ACTIONS) {
  const bare = await fetch(a.url, { method: "POST" });
  const cross = await fetch(a.url, { method: "POST", headers: { Origin: "http://evil.example" } });
  const rebind = curlCode(a.url, "attacker.com", "http://attacker.com");
  const own = await fetch(a.url, { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
  const ok =
    bare.status === 403 && cross.status === 403 && rebind === 403 && own.status === 404;
  if (ok) {
    console.log(`  ok: ${a.name} — bare 403 / cross 403 / rebind 403 / own 404 (route speaks)`);
  } else {
    console.log(`  FAIL: ${a.name} — bare ${bare.status} cross ${cross.status} rebind ${rebind} own ${own.status}`);
    fail++;
  }
}
// empiar-seed: the three denials; the open state is sibling-proof (never fired)
const es = `${BASE}/api/projects/empiar-seed`;
const esBare = await fetch(es, { method: "POST" });
const esCross = await fetch(es, { method: "POST", headers: { Origin: "http://evil.example" } });
const esRebind = curlCode(es, "attacker.com", "http://attacker.com");
must(
  esBare.status === 403 && esCross.status === 403 && esRebind === 403,
  `empiar-seed — bare ${esBare.status} / cross ${esCross.status} / rebind ${esRebind} (all 403; open state sibling-proof, never fired)`
);
// and the roster is untouched by all that poking
const roster1 = await page.evaluate(async () => (await (await fetch("/api/jobs")).json()).jobs.length);
must(roster1 === 23, `roster still 23 after the door probes (got ${roster1})`);

// ---- Phase C: self-defense ledger ----------------------------------------------
console.log("== PHASE C: the JSON routes defend themselves ==");
// a form-style urlencoded body into a JSON route → 400 (parse fails)
const formBody = await fetch(`${BASE}/api/jobs`, {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/x-www-form-urlencoded" },
  body: "type=import&x=1",
});
must(formBody.status === 400, `urlencoded body into a JSON route → 400 (got ${formBody.status})`);
// an empty body into the empty-tolerant parsers is EXPLICITLY rejected:
// both parse .catch(() => ({})) then validate and 400 the empty payload —
// the blind form POST gets a contract message and zero state change
const noop1 = await fetch(`${BASE}/api/jobs/restore`, {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin" },
});
const noop1b = await noop1.json().catch(() => ({}));
must(
  noop1.status === 400 && String(noop1b.error ?? "").includes("jobs"),
  `restore with empty body → 400 contract rejection (got ${noop1.status}: ${noop1b.error ?? "—"})`
);
const noop2 = await fetch(`${BASE}/api/jobs/layout`, {
  method: "POST",
  headers: { "sec-fetch-site": "same-origin", "Content-Type": "application/json" },
  body: "{}",
});
const noop2b = await noop2.json().catch(() => ({}));
must(
  noop2.status === 400 && String(noop2b.error ?? "").includes("valid updates"),
  `layout with empty updates → 400 contract rejection (got ${noop2.status}: ${noop2b.error ?? "—"})`
);
const roster2 = await page.evaluate(async () => (await (await fetch("/api/jobs")).json()).jobs.length);
must(roster2 === 23, `roster still 23 after the no-ops (got ${roster2})`);

// ---- Phase D: the legit user's own page ----------------------------------------
console.log("== PHASE D: the UI's origin still drives actions ==");
const pagePosts = await page.evaluate(async (fake) => {
  const out = [];
  for (const [name, url] of [
    ["run", `/api/jobs/${fake}/run`],
    ["stop", `/api/jobs/${fake}/stop`],
    ["duplicate", `/api/projects/${fake}/duplicate`],
  ]) {
    const r = await fetch(url, { method: "POST" }); // the page's own origin
    out.push({ name, status: r.status });
  }
  return out;
}, FAKE_ID);
must(
  pagePosts.every((x) => x.status === 404),
  `the page's own POSTs reach the routes (run ${pagePosts[0].status} stop ${pagePosts[1].status} duplicate ${pagePosts[2].status} — all 404 route-speak, zero 403)`
);

// ---- Phase E: console + the frame ----------------------------------------------
console.log("== PHASE E: console ==");
const realErrors = consoleErrors.filter((t) => !/^Failed to load resource/.test(t));
must(realErrors.length === 0, `no real console errors (got ${realErrors.length}: ${realErrors.slice(0, 2).join(" | ")})`);
must(consoleErrors.length <= 8, `probe noise bounded (${consoleErrors.length} resource logs from deliberate fake-id 404s)`);
mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: `${SHOTS}/t252-write-door-2x.png` });

await browser.close();
console.log(fail === 0 ? "t252: ALL PASS" : `t252: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
