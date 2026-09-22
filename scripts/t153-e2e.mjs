// t153 — Task 153: the fold outlives the reload.
//
// The pipeline-KPI fold (Task 144) used to be ephemeral store state —
// "survives view switches, forgets on reload" — which meant the Task 143
// occlusion the user fixed by folding came back EVERY reload: the bar's
// width grows with the world and a boot-fit canvas hid a whole card under
// it, so reloading re-ran the very occlusion the user had already solved.
// Task 153 reclassifies the fold: it is a SPATIAL preference (dashboard
// sort / export scale family), not lens state (the find bar's contract IS
// to close clean — the fold's contract is to stay put). The chevron
// writes localStorage synchronously; boot hydrates the seed; only the
// exact string "true" arms the fold (the honest unknown is unfolded).
//
// Phase S — purge + roster snapshot + keeper runner (1.2s poll cadence).
// Phase X — source oracle: the storage key, the hydrate trust rule, the
//           explicit-action write path, the ONLY-write-path comment.
// Phase B — fresh world: bar expanded, storage EMPTY (hydrate READS,
//           never writes); fold → data-collapsed=true + storage "true"
//           (synchronous, the chevron's own echo); RELOAD → the bar
//           comes back COLLAPSED (the reclaimed canvas stays reclaimed).
// Phase C — unfold → storage "false" → RELOAD → expanded.
// Phase D — corrupt defense: garbage in storage → reload → expanded
//           default, no crash (the honest unknown hides nothing).
// Phase G — screenshots: the collapsed pill that survived the reload.
// Phase Z — strict console (no inspector this round, no /log pulls),
//           purge, roster restored.
//
// Run: node scripts/t153-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t153-shot";
const KPI_KEY = "cryoflow.kpiCollapsed.v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const seededIds = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const purgeT153 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T153"}}}).then(r=>{console.log("purged",r.count);return p.$disconnect()})'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

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

const BAR = '[data-canvas-ui="pipeline-kpi"]';
const TOGGLE = '[data-testid="pipeline-kpi-toggle"]';

/** Open the app and wait until the KPI bar is actually rendered (it only
 *  mounts once jobs have loaded — stats.total > 0). Returns cleanly so
 *  callers read data-collapsed AFTER the mount, not during a swap. */
const openAndWaitForKpi = async () => {
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await p.waitForSelector(BAR, { timeout: 30000 });
  await sleep(400);
};

const makeJob = async (name, type, y) => {
  const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
  const j = created?.job ?? created;
  must(!!j?.id, `${name}: created (${type})`);
  seededIds.push(j.id);
  return j;
};

async function main() {
  /* ---------------- Phase S — clean world + keeper ---------------------- */
  step("--- Phase S: purge + snapshot + keeper ---");
  purgeT153();
  const rosterBefore = (await roster()).length;
  const keeper = await makeJob("T153 Keeper", "motioncorr", 60);
  stampEx(keeper.id, { status: "running", progress: 20, startedAt: new Date(Date.now() - 15_000).toISOString() });

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  /* ---------------- Phase X — source oracle ------------------------------- */
  step("--- Phase X: source oracle — the fold becomes a stored preference ---");
  const storeSrc = execSync("cat src/lib/store.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(storeSrc.includes('const KPI_COLLAPSED_KEY = "cryoflow.kpiCollapsed.v1";'),
    "oracle: the fold has its own namespaced storage key");
  must(/function hydrateKpiCollapsed\(\): boolean \{[\s\S]*?raw === "true"[\s\S]*?return false;/.test(storeSrc),
    "oracle: hydrate trusts ONLY the exact string \"true\" (honest unknown = unfolded)");
  must(/function persistKpiCollapsed\(collapsed: boolean\) \{[\s\S]*?setItem\(KPI_COLLAPSED_KEY, String\(collapsed\)\)/.test(storeSrc),
    "oracle: persist writes the boolean as its exact string echo");
  must(/setKpiCollapsed: \(c\) => \{\s*persistKpiCollapsed\(c\);/.test(storeSrc),
    "oracle: the chevron action is the ONLY write path (storage echoes intent)");
  must(/kpiCollapsed: hydrateKpiCollapsed\(\),/.test(storeSrc),
    "oracle: the store boots from the seed, not from a hardcoded false");
  const kpiSrc = execSync("cat src/components/workflow/pipeline-kpi.tsx", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(kpiSrc.includes("Task 153 — the fold outlives the reload"),
    "oracle: the component doc records the reclassification (spatial, not lens)");

  /* ---------------- Phase B — fold, reload, still folded ------------------ */
  step("--- Phase B: fold once — the reload must not un-reclaim the canvas ---");
  await openAndWaitForKpi();
  must((await p.locator(BAR).getAttribute("data-collapsed")) === "false",
    "fresh world: data-collapsed=false (default expanded)");
  must((await p.evaluate((k) => window.localStorage.getItem(k), KPI_KEY)) === null,
    "boot hydrate READS and writes NOTHING (storage still empty)");

  await p.locator(TOGGLE).click();
  await sleep(200);
  must((await p.locator(BAR).getAttribute("data-collapsed")) === "true",
    "the fold happened: data-collapsed=true");
  must((await p.evaluate((k) => window.localStorage.getItem(k), KPI_KEY)) === "true",
    "the chevron's write is synchronous — storage already says \"true\"");

  // THE core: the reload must NOT undo the user's spatial decision.
  await openAndWaitForKpi();
  must((await p.locator(BAR).getAttribute("data-collapsed")) === "true",
    "RELOAD: the bar comes back COLLAPSED — the reclaimed canvas stays reclaimed");
  must((await p.locator(TOGGLE).getAttribute("aria-expanded")) === "false",
    "aria-expanded=false after the reload (AT hears the same truth)");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t153-folded-survives.png` });

  /* ---------------- Phase C — unfold, reload, still expanded -------------- */
  step("--- Phase C: unfold — the preference is a two-way door ---");
  await p.locator(TOGGLE).click();
  await sleep(200);
  must((await p.locator(BAR).getAttribute("data-collapsed")) === "false",
    "unfolded again: data-collapsed=false");
  must((await p.evaluate((k) => window.localStorage.getItem(k), KPI_KEY)) === "false",
    "the unfold is persisted too (\"false\", not a delete)");
  await openAndWaitForKpi();
  must((await p.locator(BAR).getAttribute("data-collapsed")) === "false",
    "RELOAD: still expanded — the door swings both ways");

  /* ---------------- Phase D — corrupt storage falls open, not over -------- */
  step("--- Phase D: a corrupt seed is an honest unknown — the bar opens ---");
  await p.evaluate((k) => window.localStorage.setItem(k, "garbage{{{"), KPI_KEY);
  await openAndWaitForKpi();
  must((await p.locator(BAR).getAttribute("data-collapsed")) === "false",
    "garbage seed → the expanded default (the state that hides nothing)");
  must(pageErrors.length === 0,
    pageErrors.length ? `no crash on corrupt storage (got: ${pageErrors[0]})` : "no crash on corrupt storage");

  /* ---------------- Phase G — screenshot ---------------------------------- */
  step("--- Phase G: screenshot ---");
  // Re-fold so the recorded artifact is the SURVIVING fold, then reload and
  // shoot the pill again — the screenshot pair tells the whole story.
  await p.locator(TOGGLE).click();
  await sleep(200);
  await openAndWaitForKpi();
  must((await p.locator(BAR).getAttribute("data-collapsed")) === "true",
    "re-fold + reload → still collapsed (the pair closes)");
  await p.screenshot({ path: `${OUT}/t153-folded-survives-2.png` });
  must(execSync(`test -f ${OUT}/t153-folded-survives.png && echo yes`).toString().trim() === "yes",
    "the surviving-fold screenshot is on disk");

  /* ---------------- Phase Z — strict console + cleanup -------------------- */
  step("--- Phase Z: console + cleanup ---");
  const seedIds = [...seededIds];
  const tol = (line) => {
    const url = line.split(" ").slice(1).join(" ");
    if (line.startsWith("404") && seedIds.some((id) => url.startsWith(`${BASE}/api/jobs/${id}/log`))) return true;
    return false;
  };
  const intolerable = badResponses.filter((line) => !tol(line));
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")})` : "no intolerable 4xx/5xx (no inspector this round — the world stayed clean)");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const isGenericRadiusEcho = (t) => /Failed to load resource.*404/.test(t);
  const genN = consoleErrors.filter(isGenericRadiusEcho).length;
  const radiusN = badResponses.filter((l) => l.startsWith("404")).length;
  must(genN <= radiusN,
    `generic 404 echoes accountable to the seeded radius (${genN} <= ${radiusN})`);
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t) && !isGenericRadiusEcho(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors (no hydration mismatch either)");

  await p.close(); p = null;
  await b.close(); b = null;
  purgeT153();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT153 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
