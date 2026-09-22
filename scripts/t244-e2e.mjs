// t244 — the engine card speaks in BOTH worlds + the palette's index closes
// (Task 244).
// Task 243 made the dashboard's Active engine card speak in the NOT-FOUND
// world (guidance third mouth). But the FOUND world still had the same dead-
// card disease: RELION 5.0.0 sat in a div, and switching installs required
// finding the tiny header chip. Task 244: the card opens the engine DETAILS
// popover in the found world too (title row + InstallSwitcher + Re-detect —
// the switcher moved into engine-guidance.tsx, the engine family's shared
// home), so the card has NO dead state in either world. And the palette —
// the app's action index — gains an "Engine" group whose "Re-detect RELION
// environment" row is the keyboard-layer door of the guidance's own closing
// promise ("then press Re-detect — no restart needed").
// The found world is REAL on every host with a RELION install; the demo box
// has none, so the suite speaks for it through route interception at the
// network boundary — a synthetic well with two native installs.
// Phases:
//   A  demo truth — the REAL API says not-found (world identity); roster 23
//   B  found world (route-intercepted) — card is a button with the version;
//      popover opens: "RELION detected" + 2-install radiogroup + Re-detect
//      door; switching installs flips the card (store updates, toast receipt)
//   C  palette index (demo world, fresh page) — "Re-detect RELION
//      environment" row exists and answers Enter with the force probe
//      (?force=1 is refreshSystem's signature) + toast receipt
//   D  console clean
// Run: node scripts/t244-e2e.mjs   (server on :3000)
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

// ---- Phase A: demo world identity ------------------------------------------
console.log("== PHASE A: demo world identity ==");
const sys = await (await fetch(`${BASE}/api/system`, { headers: { "sec-fetch-site": "same-origin" } })).json();
must(sys.found === false, "real API: engine not found (demo host truth)");
const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
must((jobs.jobs ?? []).length === 23, `roster identity 23 (got ${(jobs.jobs ?? []).length})`);

// ---- Phase B: the found world (route-intercepted) ---------------------------
console.log("== PHASE B: found world ==");
const foundPayload = {
  found: true,
  execution: "native",
  version: "5.0.0",
  path: "/opt/relion-5/bin",
  source: "known-path",
  wsl: {
    available: false,
    unavailableReason: "no-wsl",
    relionPath: null,
    relionHome: null,
    version: null,
    source: null,
    distro: null,
    note: "WSL is not installed on this host.",
    mpiBinary: false,
    ctffindPath: null,
  },
  binaries: [
    { name: "relion_refine", present: true },
    { name: "relion_refine_mpi", present: true },
    { name: "relion_prepare", present: false },
    { name: "relion_extract", present: true },
  ],
  externals: [
    { name: "ctffind", present: true },
    { name: "motioncor2", present: false },
    { name: "gctf", present: false },
  ],
  checkedAt: new Date().toISOString(),
  installs: [
    {
      id: "n:/opt/relion-5/bin",
      version: "5.0.0",
      path: "/opt/relion-5/bin",
      relionHome: "/opt/relion-5",
      source: "known-path",
      execution: "native",
      distro: null,
      mpirunPath: "/usr/bin/mpirun",
      mpiBinary: true,
      ctffindPath: "/usr/local/bin/ctffind",
    },
    {
      id: "n:/home/z/relion-4.2/bin",
      version: "4.2.0",
      path: "/home/z/relion-4.2/bin",
      relionHome: "/home/z/relion-4.2",
      source: "home scan",
      execution: "native",
      distro: null,
      mpirunPath: null,
      mpiBinary: false,
      ctffindPath: null,
    },
  ],
  selectedId: "n:/opt/relion-5/bin",
  autoPicked: true,
  fromCache: false,
  hint: null,
};
const selectPayload = {
  ...foundPayload,
  version: "4.2.0",
  path: "/home/z/relion-4.2/bin",
  source: "home scan",
  selectedId: "n:/home/z/relion-4.2/bin",
  autoPicked: false,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
// regex, not glob: playwright's `*` does not cross `/`, so `**/api/system*`
// would MISS /api/system/select (the switch POST) and let it fall through to
// the real server — the synthetic world must own its whole URL family.
await page.route(/\/api\/system/, (route) => {
  const req = route.request();
  if (req.method() === "POST" && req.url().includes("/api/system/select")) {
    void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: selectPayload }) });
  } else {
    void route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(foundPayload) });
  }
});
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await page.getByRole("tab", { name: "Dashboard" }).click();
await sleep(1500);

// the card speaks the found world: version value + promise title + button.
// Anchor by the title SUFFIX ("click for engine details") — the title leads
// with version+path, which CHANGE when the switch flips the store; a
// full-title locator would dissolve under its own assertion.
const card = page.locator('button[class*="group/kpi"][title*="click for engine details"]');
must((await card.count()) === 1, "found-world card is a real button with the details promise title");
must((await card.getAttribute("title")) === "RELION 5.0.0 · /opt/relion-5/bin — click for engine details", "title leads with the active version + path");
must((await card.getByText("5.0.0").count()) >= 1, "card value shows the active version");
must((await card.getByText("real RELION runs").count()) === 1, "card sub reads the native execution honestly");
must((await card.locator("svg.lucide-info").count()) === 1, "corner info whisper present in the found world too");

await card.click();
await sleep(900);
const pop = page.locator("[data-engine-details-dashboard]");
must((await pop.count()) === 1, "found-world details popover opens");
must((await pop.getByText("RELION detected").count()) === 1, "title row: RELION detected");
const radios = pop.locator('[role="radiogroup"][aria-label="RELION installs"] [role="radio"]');
must((await radios.count()) === 2, "install switcher lists both installs (third mouth of the switcher)");
must((await radios.nth(0).getAttribute("aria-checked")) === "true", "active install pre-checked");
must((await radios.nth(0).isDisabled()) === true, "checked radio disabled (selected, not switchable onto itself)");
must((await radios.nth(1).isDisabled()) === false, "the other install is switchable");
must((await pop.getByRole("button", { name: "Re-detect" }).count()) === 1, "Re-detect door rides along in the found world too");

// switch installs: the card and the radios follow the store's new truth.
// The toast is the store's receipt — it renders at body level (Toaster
// portal), OUTSIDE the popover box, so it is asserted on the page, not pop.
await radios.nth(1).click();
await sleep(1200);
must((await page.getByText("RELION install switched").count()) >= 1, "switch toast is the action's receipt (page level, outside the popover)");
must((await radios.nth(1).getAttribute("aria-checked")) === "true", "second install now checked");
must((await card.getByText("4.2.0").count()) >= 1, "card value flips to the newly selected version (one store, every mouth follows)");
must((await card.getAttribute("title")) === "RELION 4.2.0 · /home/z/relion-4.2/bin — click for engine details", "card title re-leads with the new version + path");

// Esc closes — per the app's OWN law ("Esc — peel one layer"): the switch
// toast and the popover are two live layers, so the first Esc peels the
// toast, the second peels the popover.
await page.keyboard.press("Escape");
await sleep(500);
await page.keyboard.press("Escape");
await sleep(600);
must((await pop.count()) === 0, "Escape peels the layers — popover closes (toast first, one layer per Esc)");
await card.click();
await sleep(700);
must((await pop.count()) === 1, "re-click reopens");

// ---- Phase C: the palette's engine door (demo world, fresh page) ------------
console.log("== PHASE C: palette index ==");
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors2 = [];
page2.on("pageerror", (e) => errors2.push(String(e)));
page2.on("console", (m) => m.type() === "error" && errors2.push(m.text()));
await page2.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

await page2.keyboard.press("Control+k");
await sleep(700);
const row = page2.getByRole("option", { name: /Re-detect RELION environment/ });
must((await row.count()) === 1, "palette index carries the Re-detect row (searchable engine door)");
const probePromise = page2.waitForRequest((r) => r.url().includes("/api/system?force=1") && r.method() === "GET", { timeout: 8000 }).then(() => "probe").catch(() => "NO-PROBE");
await row.click();
await sleep(600);
must((await probePromise) === "probe", "Enter fires the force probe (?force=1 is refreshSystem's signature)");
must((await page2.getByText("Re-detecting RELION environment").count()) >= 1, "toast receipt names the action");
await page2.keyboard.press("Escape");
await sleep(400);

// ---- Phase D: console clean -------------------------------------------------
console.log("== PHASE D: console ==");
must(errors.length === 0, `console clean in found world (got ${errors.length}: ${errors.slice(0, 2).join(" | ")})`);
must(errors2.length === 0, `console clean in demo world (got ${errors2.length}: ${errors2.slice(0, 2).join(" | ")})`);

// frame: the found-world popover — the family's first found-world frame
mkdirSync(SHOTS, { recursive: true });
const cardBox = await card.boundingBox();
const popBox = await pop.boundingBox();
if (cardBox && popBox) {
  const x = Math.max(0, Math.min(cardBox.x, popBox.x) - 24);
  const y = Math.max(0, cardBox.y - 24);
  const w = Math.min(1440 - x, Math.max(cardBox.width, popBox.width) + 48);
  const h = Math.min(900 - y, popBox.y - cardBox.y + popBox.height + 48);
  await page.screenshot({
    path: `${SHOTS}/t244-engine-card-found-2x.png`,
    clip: { x, y, width: w, height: h },
  });
  console.log(`  frame: ${SHOTS}/t244-engine-card-found-2x.png`);
} else {
  must(false, "frame skipped — card or popover not measurable");
}

await browser.close();
if (fail > 0) {
  console.error(`t244: ${fail} FAIL`);
  process.exit(1);
}
console.log("t244: ALL PASS");
