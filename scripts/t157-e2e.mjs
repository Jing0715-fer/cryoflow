// t157 — Task 157: the session position outlives the reload.
//
// The PRIMARY selection (selectedId) drives the edit panel, the F focus
// shortcut and the minimap ring — and it used to VANISH on every reload:
// the user re-opened the panel for the job they were literally looking at,
// a problem they had already solved, delivered fresh each boot. Task 157
// makes the selection the session POSITION with the strongest stay-put
// contract in the view-state family (browser tab-restore semantics).
//
// Design (and the two doctrine decisions it rests on):
//  - The seed applies ONCE, at the FIRST data landing inside load(), and
//    only if it resolves to a job ON THIS CANVAS — the same
//    jobInWorkspace predicate the canvas renders by (Bug #33's lesson:
//    visibility and selection must agree). A seed that resolves nowhere —
//    deleted job, other workspace, hand-edited garbage — is ignored: the
//    honest unknown is no selection. Boot writes NOTHING either way.
//  - The storage echo lives in a post-commit store subscription, not in
//    17+ wrapped mutation sites: one forgotten site would leave a STALE
//    seed that a reload faithfully restores as a ghost. This is not the
//    Task 13 #13 sin (side effects DURING render) — a subscription fires
//    on state commits, between renders. The two-way door writes the
//    honest none as an EMPTY STRING, not a delete.
//
// Phase S — seed two jobs idempotently ("QA Sel Alpha" class2d, "QA Sel
//           Beta" select2d, both in the FIRST workspace) + roster
//           snapshot AFTER seeding.
// Phase X — source oracles: the key, the hydrate shape (window guard,
//           trim, "" → null, no setItem in hydrate), the persist shape
//           (id ?? ""), the once-flag, the jobInWorkspace gate inside
//           load(), the subscription echo, the client-only guard, the
//           Task 157 doc.
// Phase B — fresh world: storage null after boot (writes NOTHING); click
//           "QA Sel Alpha" → the panel opens (input[aria-label="Job
//           name"] value) and storage echoes the id synchronously.
// Phase C — RELOAD: the panel reopens for Alpha — the reclaimed position
//           stays reclaimed (CORE).
// Phase D — the two-way door: "Close job panel" → storage holds ""
//           (present, not removed) → reload boots with NO selection.
// Phase E — seeds that resolve nowhere: a dead job id and a corrupt
//           string each boot the honest no-selection without a crash.
// Phase F — negative oracle: a fresh boot writes NO cryoflow.* key at
//           all (load() applies nothing, the subscription echoes
//           nothing without a transition).
// Phase G — screenshot: the restored panel after a reload.
// Phase Z — strict console (0 errors) + roster restored.
//
// Run: node scripts/t157-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t157-shot";
const SEL_KEY = "cryoflow.selectedJob.v1";
const ALPHA = "QA Sel Alpha";
const BETA = "QA Sel Beta";
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

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

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

/** seed one job idempotently by name; returns its id */
async function seedJob(type, name, x, y, workspaceId) {
  const jobs = await roster();
  const found = jobs.find((j) => j.name === name);
  if (found) return found.id;
  const r = await api("/api/jobs", "POST", { type, x, y, workspaceId });
  if (!r.ok) throw new Error(`seed POST failed: ${r.status}`);
  const { job } = await r.json();
  const pr = await api(`/api/jobs/${job.id}`, "PATCH", { name });
  if (!pr.ok) throw new Error(`seed PATCH failed: ${pr.status}`);
  return job.id;
}

/** the selected job's name as the edit panel shows it (the panel's
 *  name input is the visible "who is selected" marker) */
const panelName = async () =>
  p.evaluate(() => {
    const el = document.querySelector('input[aria-label="Job name"]');
    return el ? el.value : null;
  });

const panelOpen = async () => panelName() !== null;

/** poll the panel state until it matches `want` (or timeout) — a single
 *  instantaneous check is a race against the boot's own async landing;
 *  every OPEN sample is recorded (value + ancestor chain + storage) and
 *  the whole timeline prints on a FAILED negative */
const waitForPanel = async (want, timeoutMs = 6000) => {
  const t0 = Date.now();
  const timeline = [];
  for (;;) {
    const s = await p.evaluate(() => {
      const el = document.querySelector('input[aria-label="Job name"]');
      if (!el) return null;
      let a = el, chain = [];
      for (let d = 0; d < 8 && a; d++) {
        a = a.parentElement;
        if (a)
          chain.push(
            a.tagName +
              (a.getAttribute("aria-label") ? `[${a.getAttribute("aria-label")}]` : "") +
              (a.getAttribute("data-state") ? `(${a.getAttribute("data-state")})` : "")
          );
      }
      return { value: el.value, chain: chain.join(" < "), ls: JSON.stringify(window.localStorage) };
    });
    if (s) timeline.push({ at: Date.now() - t0, ...s });
    if ((s !== null) === want) return true;
    if (Date.now() - t0 > timeoutMs) {
      if (!want && timeline.length) console.log("  TIMELINE:", JSON.stringify(timeline, null, 1));
      return false;
    }
    await sleep(250);
  }
};

const stored = async () =>
  p.evaluate((k) => window.localStorage.getItem(k), SEL_KEY);

/** click a canvas card by the job name living in its aria-label — the
 *  card body is div[role="button"], and the canvas selection listens on
 *  the REAL pointer stream (t156 scar: untrusted .click() never opens) */
const clickCard = async (name) => {
  for (let i = 0; i < 8; i++) {
    try {
      await p
        .locator(`[role="button"][aria-label^="${name}"]`)
        .first()
        .click({ timeout: 4000 });
      await sleep(900);
      if (await panelOpen()) return true;
    } catch {
      await sleep(1500);
    }
  }
  return false;
};

const boot = async () => {
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
};

async function main() {
  /* ---------- Phase S — seed + roster snapshot -------------------------- */
  step("--- Phase S: seed Alpha/Beta in the first workspace + roster ---");
  let wsList = (await (await api("/api/workspaces")).json())?.workspaces ?? [];
  if (wsList.length === 0) {
    // fresh DB: bootstrap the default workspace (qa_lib.resolve_workspace's rule)
    await api("/api/workspaces", "POST", { name: "Main" });
    wsList = (await (await api("/api/workspaces")).json())?.workspaces ?? [];
  }
  const wsId = wsList[0]?.id ?? null;
  must(wsId != null, "S1 a workspace exists to host the seeds");
  const alphaId = await seedJob("class2d", ALPHA, 900, 640, wsId);
  const betaId = await seedJob("select2d", BETA, 1140, 640, wsId);
  must(!!alphaId && !!betaId, "S2 seeds resolved (idempotent by name)");
  const rosterBefore = (await roster()).length;

  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  /* ---------- Phase X — source oracles ----------------------------------- */
  step("--- Phase X: source oracle — the session position ---");
  const src = execSync("cat src/lib/store.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/const SELECTED_JOB_KEY = "cryoflow\.selectedJob\.v1";/.test(src),
    "oracle: the position lives under its own namespaced key");
  must(/function hydrateSelectedJob\(\): string \| null \{\s*if \(typeof window === "undefined"\) return null;/.test(src),
    "oracle: hydration is SSR-guarded");
  must(/const trimmed = raw\.trim\(\);\s*return trimmed === "" \? null : trimmed;/.test(src),
    "oracle: the trust rule trims and reads the empty string as the honest none");
  must(/window\.localStorage\.setItem\(SELECTED_JOB_KEY, id \?\? ""\);/.test(src),
    "oracle: the two-way door writes the empty string, not a delete");
  must(/let selectionSeedApplied = false;/.test(src),
    "oracle: the seed applies ONCE per page load (once-flag)");
  must(/j\.jobs\.find\(\(x\) => x\.id === seed && jobInWorkspace\(x, activeWs\)\)/.test(src),
    "oracle: the apply gate reuses the canvas's own membership predicate");
  must(/useWorkflowStore\.subscribe\(\(s\) => \{\s*if \(s\.selectedId !== prevSelected\) \{\s*prevSelected = s\.selectedId;\s*persistSelectedJob\(s\.selectedId\);/.test(src),
    "oracle: the echo lives in a post-commit subscription on selectedId");
  must(/if \(typeof window !== "undefined"\) \{\s*let prevSelected = useWorkflowStore\.getState\(\)\.selectedId;/.test(src),
    "oracle: the subscription is client-only (server module load never installs it)");
  {
    const hydrateBody = src.slice(
      src.indexOf("function hydrateSelectedJob"),
      src.indexOf("function persistSelectedJob")
    );
    must(!hydrateBody.includes("setItem"),
      "oracle: hydration reads, writes NOTHING back (Task 153 law)");
  }
  must(src.includes("Task 157 — session position: the FIRST data landing"),
    "oracle: the Task 157 rationale lives in the source");

  /* ---------- Phase B — fresh world: boot writes NOTHING ----------------- */
  step("--- Phase B: fresh boot writes nothing; select echoes synchronously ---");
  await boot();
  must((await stored()) === null, "B1 fresh boot writes NOTHING to the position key");
  must(await waitForPanel(false), "B2 fresh boot opens no panel (honest empty state)");
  must(await clickCard(ALPHA), "B3 clicking Alpha opens its panel (real pointer stream)");
  must((await panelName()) === ALPHA, "B4 the panel names Alpha (input[aria-label='Job name'])");
  must((await stored()) === alphaId, "B5 storage echoes Alpha's id synchronously");

  /* ---------- Phase C — RELOAD: the position outlives the reload --------- */
  step("--- Phase C: reload restores the session position (CORE) ---");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(
    (await waitForPanel(true)) && (await panelName()) === ALPHA,
    "C1 after reload the panel reopens for Alpha (CORE)"
  );
  must((await stored()) === alphaId, "C2 the echo survived the reload as-is");

  /* ---------- Phase D — the two-way door ---------------------------------- */
  step("--- Phase D: closing the panel writes the honest none ---");
  await p.locator('[aria-label="Close job panel"]').first().click({ timeout: 5000 });
  await sleep(600);
  must(await waitForPanel(false), "D1 the panel closed");
  must((await stored()) === "", "D2 storage holds \"\" — present, not deleted");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(await waitForPanel(false), "D3 reload honors the explicit none");

  /* ---------- Phase E — seeds that resolve nowhere ------------------------ */
  step("--- Phase E: dead / corrupt seeds boot the honest empty state ---");
  await p.evaluate((k) => window.localStorage.setItem(k, "j-vanished-000000"), SEL_KEY);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(await waitForPanel(false), "E1 a dead job id selects NOTHING (no ghost, no crash)");
  must((await panelName()) === null, "E2 the honest unknown is no panel");
  await p.evaluate((k) => window.localStorage.setItem(k, "garbage{{{"), SEL_KEY);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(await waitForPanel(false), "E3 a corrupt string selects NOTHING (no crash)");

  /* ---------- Phase F — negative oracle: boot writes NO cryoflow key ------ */
  step("--- Phase F: a fresh world gains NO cryoflow key at boot ---");
  const fresh = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await fresh.goto(BASE, { waitUntil: "networkidle" });
  await fresh.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
  const keys = await fresh.evaluate(() =>
    Object.keys(window.localStorage).filter((k) => k.startsWith("cryoflow."))
  );
  must(keys.length === 0, `F1 fresh boot writes no cryoflow.* key (got: ${keys.join(", ") || "none"})`);
  await fresh.close();

  /* ---------- Phase G — screenshot: the restored position ----------------- */
  step("--- Phase G: screenshot ---");
  execSync(`mkdir -p ${OUT}`, { cwd: "/home/z/my-project" });
  await p.evaluate(([k, v]) => window.localStorage.setItem(k, v), [SEL_KEY, alphaId]);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  must(
    (await waitForPanel(true)) && (await panelName()) === ALPHA,
    "G1 the position restored again for the shot"
  );
  await p.screenshot({ path: `${OUT}/t157-position-restored.png` });

  /* ---------- Phase Z — strict console + roster --------------------------- */
  step("--- Phase Z: strict console + roster ---");
  must(consoleErrors.length === 0, `Z1 0 console errors (got ${consoleErrors.length}: ${consoleErrors.slice(0, 3).join(" | ")})`);
  must(pageErrors.length === 0, `Z2 0 page errors (got ${pageErrors.length})`);
  must(badResponses.length === 0, `Z3 0 responses >= 400 (got: ${badResponses.slice(0, 3).join(" | ")})`);
  const rosterAfter = (await roster()).length;
  must(rosterAfter === rosterBefore, `Z4 roster restored (${rosterAfter} == ${rosterBefore})`);

  console.log(`\nT157 ALL PASS (${PASS} assertions)`);
  await cleanup();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup();
  process.exit(1);
});
