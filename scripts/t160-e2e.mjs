// t160 — Task 160: the LEFT RAIL joins the session-position family.
//
// Task 157 restored the selection (which card), Task 159 restored the
// canvas (which workspace) — but the sidebar's tab (Catalog | Workspaces)
// was still forgotten on every reload: boot always landed on Catalog via
// <Tabs defaultValue="catalog">, so a user working out of the Workspaces
// panel was dumped back every single time. Task 160 makes the rail's tab
// a session position: same stay-put contract, pure position (no filter —
// switching tabs hides nothing; no lens — it changes no semantics).
//
// Design (the doctrine it rests on):
//  - The trust gate is the WHITELIST ITSELF — the mirror image of Task
//    157's. A job id has no format any whitelist could name (it must
//    resolve against reality), but a tab value is a FINITE set this build
//    renders: the seed is honest only if it names a rendered tab.
//    Hand-edited garbage / a renamed tab / "" / null all resolve nowhere —
//    the honest unknown is the default Catalog.
//  - The seed applies AFTER hydration, not during it: the aside renders in
//    the SSR pass (unlike t156's gallery, born only when data arrives), so
//    an eager hydrate would fight the server HTML. useState starts on the
//    honest default; a boot-once effect applies the seed after hydration.
//  - Boot writes NOTHING either way — hydrate reads; the effect never
//    persists (t157-F fresh-boot-zero-keys negative oracle keeps holding).
//  - The echo lives at the GESTURE by topology: Radix funnels mouse clicks
//    AND keyboard arrow navigation through ONE onValueChange — the
//    funnel-wrap idiom (t159's rule: one choke point, one wrap), and there
//    is nothing else to wrap. Persist-then-set.
//
// Phase S — roster snapshot (the tab needs no seeded jobs; the world as-is).
// Phase X — source oracles: the key, the SSR guard, the whitelist, the
//           includes gate, the corrupt fallback, the persist shape, the
//           single write path, the boot-effect silence, controlled Tabs
//           (no defaultValue), persist-then-set order, the Task 160 anchor.
// Phase B — fresh world: boot writes NOTHING and lands on Catalog; a real
//           click on Workspaces flips the selection and the storage echo
//           lands synchronously; the active tabpanel is the workspaces one.
// Phase C — RELOAD (CORE): the rail reopens on Workspaces — the stay-put.
// Phase D — the door both ways: back to Catalog echoes "catalog" (a string
//           correction, never a delete); reload honors it; and KEYBOARD
//           navigation (ArrowRight) goes through the same funnel and echoes.
// Phase E — seed honesty: corrupt "nonsense" boots Catalog with the stale
//           seed NOT rewritten; "" boots Catalog; "  workspaces  " trims
//           through and boots Workspaces.
// Phase F — negative oracle: a fresh page gains NO cryoflow.* key.
// Phase G — screenshot of the restored rail.
// Phase Z — strict console (0 errors, 0 page errors, 0 bad responses) +
//           roster restored.
//
// Run: node scripts/t160-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { readFileSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t160-shot";
const TAB_KEY = "cryoflow.leftRailTab.v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () => (await (await api("/api/jobs")).json())?.jobs ?? [];

const must = (cond, label) => {
  if (!cond) {
    console.log(`FAIL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

const stored = (k) => p.evaluate((key) => window.localStorage.getItem(key), k);
const setStored = (k, v) =>
  p.evaluate(([key, val]) => window.localStorage.setItem(key, val), [k, v]);
const cryoflowKeys = () =>
  p.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => k.startsWith("cryoflow."))
  );

/** the ACTIVE tab trigger's accessible name ("Catalog" or "Workspaces…").
 *  t160 scar: the page has TWO tab sets — the header's Dashboard/Workflow
 *  view switcher AND the left rail's Catalog/Workspaces. The bare
 *  [role=tab] selector matches the header first; scope to the rail's
 *  aside. (The Workspaces trigger's textContent also carries the count
 *  badge — match by startsWith, never equality.) */
const activeTab = async () =>
  p.evaluate(() => {
    const el = document.querySelector(
      'aside [role="tab"][aria-selected="true"]'
    );
    return el ? el.textContent.trim() : null;
  });

/** the active tabpanel's identity — Radix unmounts inactive content, so
 *  the active panel is the ONLY one with data-state="active"; scope to
 *  the rail's aside for the same two-tab-sets reason */
const activePanel = async () =>
  p.evaluate(() => {
    const el = document.querySelector(
      'aside [data-slot="tabs-content"][data-state="active"]'
    );
    return el ? (el.getAttribute("id") || "present") : null;
  });

const clickTab = async (name) => {
  await p.getByRole("tab", { name }).click({ timeout: 8000 });
  await sleep(600);
};

const reloadBoot = async () => {
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
};

const boot = async () => {
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
};

async function main() {
  /* ---------- Phase S — world as-is + roster snapshot -------------------- */
  step("--- Phase S: roster snapshot (no seed needed) ---");
  const jobsBefore = await roster();
  must(Array.isArray(jobsBefore), "S1 roster API responds with a jobs array");
  console.log(`      world carries ${jobsBefore.length} jobs (any world is fine)`);

  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  /* ---------- Phase X — source oracles ------------------------------------ */
  step("--- Phase X: source oracles (page.tsx) ---");
  const src = readFileSync(
    "/home/z/my-project/src/app/page.tsx",
    "utf8"
  );
  must(src.includes('"cryoflow.leftRailTab.v1"'), "X1 key is cryoflow.leftRailTab.v1");
  must(
    /function hydrateLeftRailTab[\s\S]{0,400}typeof window === "undefined"/.test(src),
    "X2 hydrateLeftRailTab guards SSR (typeof window)"
  );
  must(
    src.includes('LEFT_RAIL_TABS = ["catalog", "workspaces"]'),
    "X3 whitelist names the rendered tabs (catalog, workspaces)"
  );
  must(
    /as readonly string\[\]\)\.includes\(tab\)/.test(src),
    "X4 trust gate is the whitelist (includes membership)"
  );
  must(
    /catch \{[\s\S]{0,80}return "catalog";/.test(src),
    "X5 corrupt storage falls back to the honest default (catch → catalog)"
  );
  must(
    /window\.localStorage\.setItem\(LEFT_RAIL_TAB_KEY, tab\)/.test(src),
    "X6 persist writes the key with the chosen tab (two-way door: a value, never a delete)"
  );
  {
    const defs = (src.match(/function persistLeftRailTab/g) || []).length;
    const calls = (src.match(/persistLeftRailTab\(/g) || []).length - defs;
    must(defs === 1 && calls === 1,
      `X7 SINGLE write path: 1 definition, exactly 1 call site (got ${defs}+${calls})`);
  }
  {
    // the boot effect must READ and SET, never PERSIST (t157-F holds)
    const m = src.match(
      /const \[leftRailTab, setLeftRailTab\][\s\S]{0,400}?\}\, \[\]\);/
    );
    must(!!m, "X8a boot-once effect exists ([] deps = the once-guard)");
    if (m) {
      const body = m[0];
      must(/setLeftRailTab\(hydrateLeftRailTab\(\)\)/.test(body),
        "X8b the effect applies the seed (hydrate → set)");
      must(!/persistLeftRailTab/.test(body),
        "X8c the effect NEVER persists (boot writes nothing)");
    }
  }
  must(
    /<Tabs\s*\n\s*value=\{leftRailTab\}/.test(src) && !/defaultValue=/.test(src),
    "X9 Tabs are CONTROLLED (value={leftRailTab}, no defaultValue)"
  );
  {
    const m = src.match(/onValueChange=\{\(v\) => \{[\s\S]*?\}\}/);
    must(!!m, "X10a the funnel-wrap exists (onValueChange)");
    if (m) {
      const body = m[0];
      must(
        body.indexOf("persistLeftRailTab") < body.indexOf("setLeftRailTab(tab)"),
        "X10b persist-then-set: the storage echoes BEFORE the state moves"
      );
    }
  }
  must(
    src.includes("Task 160 — the left rail joins the session-position family"),
    "X11 the Task 160 contract rationale is anchored in the source"
  );

  /* ---------- Phase B — fresh world: boot silence + the gesture ----------- */
  step("--- Phase B: fresh world boots silent on Catalog ---");
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.evaluate(() =>
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("cryoflow."))
      .forEach((k) => window.localStorage.removeItem(k))
  );
  await boot();
  must((await stored(TAB_KEY)) === null, "B1 fresh boot writes NOTHING (no tab key)");
  must((await activeTab())?.startsWith("Catalog"), "B2 the honest unknown is Catalog");
  await clickTab("Workspaces");
  must((await activeTab())?.startsWith("Workspaces"), "B3 a real click activates Workspaces");
  must((await stored(TAB_KEY)) === "workspaces", "B4 the storage echo lands synchronously");
  must((await activePanel()) !== null, "B5 an active tabpanel exists (workspaces content mounted)");
  const wsVisible = await p.evaluate(() => {
    const el = document.querySelector(
      'aside [data-slot="tabs-content"][data-state="active"]'
    );
    return !!el && el.textContent.length > 0;
  });
  must(wsVisible, "B6 the Workspaces panel renders its content");

  /* ---------- Phase C — RELOAD (CORE) ------------------------------------- */
  step("--- Phase C: reload — the rail reopens where you left it (CORE) ---");
  await reloadBoot();
  must((await activeTab())?.startsWith("Workspaces"), "C1 CORE: after reload the rail is on Workspaces");
  must((await stored(TAB_KEY)) === "workspaces", "C2 the seed survived the reload untouched");
  must((await activePanel()) !== null, "C3 the workspaces tabpanel is active again");

  /* ---------- Phase D — the door both ways + keyboard through the funnel -- */
  step("--- Phase D: back to Catalog + keyboard navigation ---");
  await clickTab("Catalog");
  must((await stored(TAB_KEY)) === "catalog", "D1 the door echoes 'catalog' (a correction, never a delete)");
  await reloadBoot();
  must((await activeTab())?.startsWith("Catalog"), "D2 reload honors the explicit Catalog");
  // keyboard: Radix roving focus + ArrowRight must flow through the SAME
  // onValueChange funnel (no second wrap needed — one choke point, by design)
  await p.getByRole("tab", { name: /Catalog/ }).focus();
  await p.keyboard.press("ArrowRight");
  await sleep(600);
  must((await activeTab())?.startsWith("Workspaces"), "D3 ArrowRight activates Workspaces (keyboard is a first-class gesture)");
  must((await stored(TAB_KEY)) === "workspaces", "D4 the keyboard gesture echoes through the SAME funnel");

  /* ---------- Phase E — seed honesty (whitelist gate) --------------------- */
  step("--- Phase E: corrupt / empty / spaced seeds boot honestly ---");
  await setStored(TAB_KEY, "nonsense");
  await reloadBoot();
  must((await activeTab())?.startsWith("Catalog"), "E1 a hand-edited value boots the honest default (whitelist gate)");
  must((await stored(TAB_KEY)) === "nonsense", "E2 the boot does NOT rewrite the stale seed (hydrate reads)");
  await setStored(TAB_KEY, "");
  await reloadBoot();
  must((await activeTab())?.startsWith("Catalog"), "E3 an empty string is the honest unknown → Catalog");
  await setStored(TAB_KEY, "  workspaces  ");
  await reloadBoot();
  must((await activeTab())?.startsWith("Workspaces"), "E4 a spaced value trims through the whitelist");
  must((await stored(TAB_KEY)) === "  workspaces  ", "E5 the boot never normalized the seed behind the user's back");

  /* ---------- Phase F — fresh page gains no key --------------------------- */
  step("--- Phase F: fresh page, zero keys (negative oracle) ---");
  const p2 = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p2.goto(BASE, { waitUntil: "networkidle" });
  await p2.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  const keys2 = await p2.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => k.startsWith("cryoflow."))
  );
  must(keys2.length === 0, `F1 a fresh page gains NO cryoflow.* key (got ${keys2.length})`);
  await p2.close();

  /* ---------- Phase G — screenshot ---------------------------------------- */
  step("--- Phase G: screenshot ---");
  await p.evaluate(() =>
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("cryoflow."))
      .forEach((k) => window.localStorage.removeItem(k))
  );
  await boot();
  await clickTab("Workspaces");
  await p.screenshot({ path: `${OUT}/t160-rail-restored.png`, fullPage: false });
  must(true, "G1 screenshot captured (.next/t160-shot/t160-rail-restored.png)");

  /* ---------- Phase Z — strict console + roster restored ------------------ */
  step("--- Phase Z: strict console + roster ---");
  must(consoleErrors.length === 0, `Z1 0 console errors (got ${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")})`);
  must(pageErrors.length === 0, `Z2 0 page errors (got ${pageErrors.length})`);
  must(badResponses.length === 0, `Z3 0 responses >= 400 (got: ${badResponses.slice(0, 3).join(" | ")})`);
  const jobsAfter = await roster();
  must(jobsAfter.length === jobsBefore.length, `Z4 roster restored (${jobsAfter.length} == ${jobsBefore.length})`);

  await cleanup();
  console.log(`\nT160 ALL PASS (${PASS} assertions)`);
  process.exit(0);
}

main().catch(async (e) => {
  console.log(e);
  await cleanup();
  process.exit(1);
});
