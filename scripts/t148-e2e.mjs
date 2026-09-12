// t148 — Task 148: the world next door — cross-workspace census dots.
//
// Every census surface (card ring, footer, tab title, favicon, toast)
// speaks for the ACTIVE workspace only. A runner in workspace B is
// invisible while the user sits in workspace A — the jobs array is
// PROJECT-wide (every job carries workspaceId), the switcher just never
// spoke the status half of what it already receives. Task 148:
//   trigger  the CLOSED workspace switcher carries one small dot while
//            any NON-active workspace has running/failed jobs (rose
//            outranks teal — the favicon doctrine at workspace scope);
//            the title spells out the per-workspace facts
//            ("Elsewhere: B — 1 running · 1 failed").
//   items    each menu item carries its own dot (rose > teal), next to
//            the total badge it always had.
//   silence  a workspace with no life shows nothing — presence-derived,
//            zero-segment elision (the footer census doctrine).
// All derived from the store's existing jobs array — zero extra
// requests; poll ticks keep every dot live.
//
// Phase S — roster snapshot; workspace B created via API.
// Phase B — B empty: its item shows NO dot (presence-derived silence).
// Phase C — stamp 1 running in B (fresh startedAt) → poll brings it
//           home → B's item dot is teal AND the closed trigger's
//           elsewhere-dot is teal (B is not active).
// Phase D — stamp 1 failed in B → the dot turns rose (alarm outranks
//           alive — one dot, not two) on both item and trigger.
// Phase E — switch to B → the trigger dot disappears (B is now the
//           active workspace; its census lives in footer/tab/favicon);
//           B's own item dot stays (the menu still tells the truth).
// Phase F — complete both B jobs → B's item dot vanishes.
// Phase G — screenshot with the menu open on a rose B.
// Phase Z — console clean; B's jobs deleted; workspace B deleted;
//           roster AND workspace list restored (t143's double restore).
//
// Run: node scripts/t148-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t148-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const seededJobIds = [];
let wsB = null;
const WS_NAME = "T148 Next Door";

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () => (await (await api("/api/jobs")).json())?.jobs ?? [];

const stampEx = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

/** prisma-side purge — the strongest cleanup form (t146 precedent): no
 *  API guards, no fetch races, works even for running/failed rows. Used
 *  BOTH at probe start (a previous FAIL's cleanup never completes — the
 *  main catch's process.exit() wins the race against the async deletes,
 *  so the next run must clean its predecessor's residue itself) and in
 *  the final pass. */
const purgeT148 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();(async()=>{const j=await p.job.deleteMany({where:{name:{startsWith:"T148"}}});const w=await p.workspace.deleteMany({where:{name:"T148 Next Door"}});console.log("purged jobs",j.count,"workspaces",w.count);await p.$disconnect();})()'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  try { purgeT148(); } catch {}
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

const TRIGGER = '[aria-label="Active workspace"]';

/** open the workspace menu and return the item for `name` */
const openMenuAndFind = async (name) => {
  await p.locator(TRIGGER).click({ timeout: 6000 });
  await sleep(500);
  const item = p.locator('[role="option"]', { hasText: name }).first();
  await item.waitFor({ timeout: 6000 });
  return item;
};

const closeMenu = async () => { await p.keyboard.press("Escape"); await sleep(400); };

async function main() {
  /* ---------------- Phase S — world snapshot + workspace B --------------- */
  step("--- Phase S: roster snapshot + workspace B via API + keeper ---");
  purgeT148(); // a previous FAIL's cleanup never completes — clean its residue first
  const rosterBefore = (await roster()).length;
  // keeper runner in the ACTIVE workspace (t146/t147 lesson): without a
  // runner anywhere the poll drops to a 6s idle cadence and every
  // "stamp then wait one cycle" step outruns the news. The keeper holds
  // the 1.2s cadence. It lives OUTSIDE B, so the E/F elsewhere-oracle
  // (every workspace except B) absorbs it by construction.
  const keeper = await (await api("/api/jobs", "POST", { type: "motioncorr", name: "T148 Keeper", x: 100, y: 580 })).json();
  const keeperId = (keeper?.job ?? keeper)?.id;
  must(!!keeperId, "S: keeper job created (active workspace)");
  seededJobIds.push(keeperId);
  stampEx(keeperId, { status: "running", progress: 20, startedAt: new Date(Date.now() - 15_000).toISOString() });
  const created = await (await api("/api/workspaces", "POST", { name: WS_NAME })).json();
  wsB = created?.workspace?.id ?? created?.id ?? null;
  must(!!wsB, "S: workspace B created via API");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  // reload so the client's workspace list includes the API-created B
  // (t143 lesson: load-time lists don't grow by themselves)
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase B — an empty workspace is silent --------------- */
  step("--- Phase B: B empty → its item carries NO dot ---");
  const itemB0 = await openMenuAndFind(WS_NAME);
  must((await itemB0.locator('[data-ws-dot]').count()) === 0, "empty B: no dot on its item (presence-derived silence)");
  must((await p.locator(`${TRIGGER} [data-ws-elsewhere]`).count()) === 0, "empty B: no elsewhere dot on the closed trigger");
  await closeMenu();

  /* ---------------- Phase C — a runner next door lights teal -------------- */
  step("--- Phase C: stamp 1 running in B → teal dot on item AND trigger ---");
  const jRun = await (await api("/api/jobs", "POST", { type: "motioncorr", name: "T148 Runner", x: 100, y: 100, workspaceId: wsB })).json();
  const jRunId = (jRun?.job ?? jRun)?.id;
  must(!!jRunId, "C: runner job created inside B");
  seededJobIds.push(jRunId);
  stampEx(jRunId, { status: "running", progress: 40, startedAt: new Date(Date.now() - 20_000).toISOString() });
  await sleep(1800); // one poll cycle brings B's status home
  const itemB1 = await openMenuAndFind(WS_NAME);
  must((await itemB1.locator('[data-ws-dot="teal"]').count()) === 1, "B's item dot is teal (1 running)");
  await closeMenu();
  must((await p.locator(`${TRIGGER} [data-ws-elsewhere="teal"]`).count()) === 1, "closed trigger carries the teal elsewhere-dot");
  const trigTitle = (await p.locator(TRIGGER).getAttribute("title")) ?? "";
  must(/Elsewhere: .*1 running/.test(trigTitle), `trigger title spells the facts ("${trigTitle.slice(-40)}")`);

  /* ---------------- Phase D — an alarm next door turns rose --------------- */
  step("--- Phase D: stamp 1 failed in B → rose outranks teal (ONE dot) ---");
  const jFail = await (await api("/api/jobs", "POST", { type: "ctffind", name: "T148 Loser", x: 100, y: 340, workspaceId: wsB })).json();
  const jFailId = (jFail?.job ?? jFail)?.id;
  must(!!jFailId, "D: failed job created inside B");
  seededJobIds.push(jFailId);
  stampEx(jFailId, { status: "failed", progress: 0 });
  await sleep(1800);
  const itemB2 = await openMenuAndFind(WS_NAME);
  must((await itemB2.locator('[data-ws-dot="rose"]').count()) === 1, "B's item dot is rose (alarm outranks alive)");
  must((await itemB2.locator('[data-ws-dot="teal"]').count()) === 0, "one dot, not two (teal yields to rose)");
  await closeMenu();
  must((await p.locator(`${TRIGGER} [data-ws-elsewhere="rose"]`).count()) === 1, "trigger's elsewhere-dot is rose");

  /* ---------------- Phase E — switching home re-aims the elsewhere lens --- */
  step("--- Phase E: switch to B → the trigger's elsewhere-dot re-aims at the world OUTSIDE B (oracle) ---");
  const itemB3 = await openMenuAndFind(WS_NAME);
  await itemB3.click();
  await sleep(1200); // switch + poll
  const trigText = ((await p.locator(TRIGGER).textContent()) ?? "").trim();
  must(trigText.includes(WS_NAME), `switch landed (trigger reads "${trigText.slice(0, 30)}")`);
  // oracle relative to the WORLD (t142/t143 lesson: the qa world carries
  // its own fixture runner in Main — after switching to B the "elsewhere"
  // domain is every workspace EXCEPT B, and its hue must match that domain,
  // whatever the fixture is doing)
  const oracleHue = async () => {
    const world = await roster();
    let oRun = 0;
    let oFail = 0;
    for (const j of world) {
      if ((j.workspaceId ?? "") === wsB) continue;
      if (j.status === "running") oRun += 1;
      else if (j.status === "failed") oFail += 1;
    }
    return oFail > 0 ? "rose" : oRun > 0 ? "teal" : "none";
  };
  const hueE = await oracleHue();
  const dotLocE = p.locator(`${TRIGGER} [data-ws-elsewhere]`);
  if (hueE === "none") {
    must((await dotLocE.count()) === 0, "no elsewhere-dot (no life outside B, per oracle)");
  } else {
    must((await dotLocE.getAttribute("data-ws-elsewhere")) === hueE, `elsewhere-dot hue == oracle (${hueE} — the world outside B)`);
  }
  const itemB4 = await openMenuAndFind(WS_NAME);
  must((await itemB4.locator('[data-ws-dot="rose"]').count()) === 1, "B's own item dot persists (the menu always tells the truth)");
  await closeMenu();

  /* ---------------- Phase F — the world settles, B's dot goes dark -------- */
  step("--- Phase F: complete both B jobs → B's item dot vanishes (trigger follows the outside-B oracle) ---");
  stampEx(jRunId, { status: "completed", progress: 100 });
  stampEx(jFailId, { status: "completed", progress: 100, result: "recovered" });
  await sleep(1800);
  const itemB5 = await openMenuAndFind(WS_NAME);
  must((await itemB5.locator('[data-ws-dot]').count()) === 0, "B's item dot vanished (all quiet in B)");
  await closeMenu();
  const hueF = await oracleHue();
  const dotLocF = p.locator(`${TRIGGER} [data-ws-elsewhere]`);
  if (hueF === "none") {
    must((await dotLocF.count()) === 0, "trigger silent again (no life outside B, per oracle)");
  } else {
    must((await dotLocF.getAttribute("data-ws-elsewhere")) === hueF, `trigger still speaks for the world outside B (oracle ${hueF})`);
  }

  /* ---------------- Phase G — screenshot ---------------------------------- */
  step("--- Phase G: screenshot ---");
  // reopen one more runner so the shot shows a lit menu
  stampEx(jRunId, { status: "running", progress: 70, startedAt: new Date().toISOString() });
  await sleep(1800);
  await openMenuAndFind(WS_NAME);
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t148-next-door.png` });
  must(true, "screenshot recorded");
  await closeMenu();

  /* ---------------- Phase Z — console + cleanup --------------------------- */
  step("--- Phase Z: console + cleanup ---");
  const tol = (line) => {
    const url = line.split(" ").slice(1).join(" ");
    if (!seededJobIds.some((id) => url === `${BASE}/api/jobs/${id}/log`)) return true;
    return !line.startsWith("404");
  };
  const intolerable = badResponses.filter(tol);
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")})` : "no intolerable 4xx/5xx (seeded /log 404 tolerance held its radius)");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");

  await p.close(); p = null;
  await b.close(); b = null;
  purgeT148();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);
  const wsAfter = (await (await api("/api/workspaces")).json())?.workspaces ?? [];
  must(!wsAfter.some((w) => w.name === WS_NAME), "workspace B deleted (workspaces restored — verified against the same API the store loads from)");

  console.log(`\nT148 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
