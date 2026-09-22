// t151 — Task 151: the alarm hands you a direct road.
//
// A failed job's solo notice already carries a View bridge (go read
// what happened). Task 151 adds the Retry bridge beside it — the rerun
// starts immediately (startJob IS a legal restart for a failed job;
// only linked copies and live processes are refused). View left (read),
// Retry right (act, nearest the edge), wrapped in one flex so
// justify-between doesn't split them. The rerun's own toast arrives
// right after and takes the slot (TOAST_LIMIT=1 — the news flow moves
// on). The completed notice keeps its single View (a finish has no
// retry semantics — restraint), and the digest grows no Retry (a
// summary is not a door; per-line Retry on a roster would be arbitrary
// anyway).
//
// Phase S — purge + roster snapshot + keeper runner (1.2s poll cadence).
// Phase X — source oracle: announceRetryAction exists and is wired into
//           the solo failed branch inside a flex wrapper.
// Phase B — stamp-driven failure: seeded import job runs, then fails →
//           destructive notice with fact title + result + BOTH bridges
//           (View and Retry, accessible names verified).
// Phase C — click Retry → the rerun's toast ("Job started") takes the
//           slot, the job leaves failed (the import engine completes
//           natively on this box — verified by experiment), and the
//           inspector opens on the job (runJob's CryoSPARC-style step).
// Phase D — a completed notice carries NO Retry (restraint anchor).
// Phase E — a mixed digest (1 failed) carries NO Retry (a summary is
//           not a door; the destructive variant stays roster-only).
// Phase G — screenshot the two-bridge alarm.
// Phase Z — console clean (the /log 404 radius + accounting), purge,
//           roster restored.
//
// Run: node scripts/t151-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t151-shot";
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

const stampAtomic = (ops) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$transaction(${JSON.stringify(ops)}.map(o=>p.job.updateMany(o))).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const purgeT151 = () => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T151"}}}).then(r=>{console.log("purged",r.count);return p.$disconnect()})'`,
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

const TOAST = 'ol > li[data-state="open"]';

const waitForToast = async (frag, tries = 48) => {
  for (let i = 0; i < tries; i++) {
    const loc = p.locator(TOAST, { hasText: frag });
    if ((await loc.count()) > 0) return loc.first();
    await sleep(250);
  }
  return null;
};

const makeJob = async (name, type, y) => {
  const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
  const j = created?.job ?? created;
  must(!!j?.id, `${name}: created (${type})`);
  seededIds.push(j.id);
  return j;
};

const letClientSee = () => sleep(1600);

async function main() {
  /* ---------------- Phase S — clean world + keeper ---------------------- */
  step("--- Phase S: purge + snapshot + keeper ---");
  purgeT151();
  const rosterBefore = (await roster()).length;
  const keeper = await makeJob("T151 Keeper", "motioncorr", 60);
  stampEx(keeper.id, { status: "running", progress: 20, startedAt: new Date(Date.now() - 15_000).toISOString() });

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);

  /* ---------------- Phase X — source oracle ------------------------------- */
  step("--- Phase X: source oracle — the alarm's two bridges ---");
  const src = execSync("cat src/lib/store.ts", { cwd: "/home/z/my-project", encoding: "utf8" });
  must(/const announceRetryAction = \(get: \(\) => WorkflowState, jobId: string, name: string\)/.test(src),
    "oracle: announceRetryAction exists");
  must(/void get\(\)\.runJob\(jobId\)/.test(src),
    "oracle: Retry wires straight into runJob (startJob restarts failed legally)");
  must(/announceViewAction\(get, job\.id, job\.name\),\s*\n\s*announceRetryAction\(get, job\.id, job\.name\),/.test(src),
    "oracle: the failed branch carries BOTH bridges in order (View, Retry)");

  /* ---------------- Phase B — the two-bridge alarm ------------------------- */
  step("--- Phase B: a failure notice with View AND Retry ---");
  const fx = await makeJob("T151 Fx", "import", 300);
  stampEx(fx.id, { status: "running", progress: 40, startedAt: new Date().toISOString() });
  await letClientSee();
  stampEx(fx.id, { status: "failed", progress: 0, result: "engine exploded at step 3" });
  const failToast = await waitForToast("T151 Fx failed");
  must(!!failToast, "failure notice appeared");
  const fCls = (await failToast.getAttribute("class")) ?? "";
  must(/destructive/.test(fCls), "failure notice is destructive (alarm outranks alive)");
  const fText = ((await failToast.textContent()) ?? "").replace(/\s+/g, " ").trim();
  must(/T151 Fx failed · \d+s/.test(fText) && fText.includes("engine exploded at step 3"),
    `fact title + result survive the bridge addition ("${fText.slice(0, 80)}")`);
  must((await failToast.getByRole("button", { name: "View" }).count()) === 1, "View bridge present (go read)");
  must((await failToast.getByRole("button", { name: "Retry" }).count()) === 1, "Retry bridge present (go act)");
  // DOM order: View left, Retry right (read before act, act nearest the edge)
  const btnOrder = await failToast.locator("button").evaluateAll((els) =>
    els.map((el) => el.textContent?.trim()).filter(Boolean),
  );
  must(btnOrder.indexOf("View") < btnOrder.indexOf("Retry"),
    `bridge order is View then Retry (${JSON.stringify(btnOrder)})`);

  /* ---------------- Phase C — Retry takes the road ------------------------- */
  step("--- Phase C: click Retry → rerun toast + job leaves failed + inspector opens ---");
  await failToast.getByRole("button", { name: "Retry" }).click();
  const rerunToast = await waitForToast("Job started");
  must(!!rerunToast, "the rerun's own toast arrived and took the slot (news flow moves on)");
  let status = null;
  for (let i = 0; i < 20; i++) {
    status = (await roster()).find((j) => j.id === fx.id)?.status ?? null;
    if (status && status !== "failed") break;
    await sleep(400);
  }
  must(status === "running" || status === "completed",
    `the job left failed (status now: ${status} — import completes natively on this box)`);
  const fxDialog = p.locator('[role="dialog"]', { hasText: "T151 Fx" });
  await fxDialog.waitFor({ timeout: 8000 });
  must(true, "inspector opened on the job (runJob's CryoSPARC-style step)");
  await p.keyboard.press("Escape");
  await sleep(500);

  /* ---------------- Phase D — the completed notice stays single-bridged ---- */
  step("--- Phase D: a completed notice carries NO Retry (restraint) ---");
  const ok = await makeJob("T151 Ok", "motioncorr", 540);
  stampEx(ok.id, { status: "running", progress: 50, startedAt: new Date().toISOString() });
  await letClientSee();
  stampEx(ok.id, { status: "completed", progress: 100, result: "done" });
  const okToast = await waitForToast("T151 Ok completed");
  must(!!okToast, "completed notice appeared");
  must((await okToast.getByRole("button", { name: "View" }).count()) === 1, "completed keeps its View bridge");
  must((await okToast.getByRole("button", { name: "Retry" }).count()) === 0,
    "completed carries NO Retry (a finish has no retry semantics)");

  /* ---------------- Phase E — the digest grows no Retry -------------------- */
  step("--- Phase E: mixed digest with a failed line — still no Retry ---");
  const ma = await makeJob("T151 MA", "import", 780);
  const mf = await makeJob("T151 MF", "ctffind", 1020);
  stampEx(ma.id, { status: "running", progress: 50, startedAt: new Date().toISOString() });
  stampEx(mf.id, { status: "running", progress: 50, startedAt: new Date().toISOString() });
  await letClientSee();
  stampAtomic([
    { where: { id: ma.id }, data: { status: "completed", progress: 100 } },
    { where: { id: mf.id }, data: { status: "failed", progress: 0, result: "nope" } },
  ]);
  const digest = await waitForToast("1 failed");
  must(!!digest, "mixed digest appeared");
  const dCls = (await digest.getAttribute("class")) ?? "";
  must(/destructive/.test(dCls), "mixed digest is destructive");
  must((await digest.getByRole("button", { name: "Retry" }).count()) === 0,
    "the digest grows NO Retry (a summary is not a door; roster Retry would be arbitrary)");
  must((await digest.getByRole("button", { name: "View" }).count()) === 0,
    "the digest still carries no View bridge either (t146 ruling intact)");

  /* ---------------- Phase G — screenshot ----------------------------------- */
  step("--- Phase G: screenshot the two-bridge alarm ---");
  const fx2 = await makeJob("T151 Fx2", "motioncorr", 1260);
  stampEx(fx2.id, { status: "running", progress: 40, startedAt: new Date().toISOString() });
  await letClientSee();
  stampEx(fx2.id, { status: "failed", progress: 0, result: "second failure for the camera" });
  const shotToast = await waitForToast("T151 Fx2 failed");
  must(!!shotToast, "screenshot fixture notice appeared");
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t151-retry-bridge.png` });
  must(true, "screenshot recorded");

  /* ---------------- Phase Z — console + cleanup ---------------------------- */
  step("--- Phase Z: console + cleanup ---");
  const seedIds = [...seededIds];
  const tol = (line) => {
    const url = line.split(" ").slice(1).join(" ");
    if (!seedIds.some((id) => url.startsWith(`${BASE}/api/jobs/${id}/log`))) return true;
    return !line.startsWith("404");
  };
  const intolerable = badResponses.filter(tol);
  must(intolerable.length === 0,
    intolerable.length ? `no intolerable 4xx/5xx (got: ${intolerable.slice(0, 3).join(" | ")})` : "no intolerable 4xx/5xx (seeded /log 404 tolerance held its radius)");
  must(pageErrors.length === 0, pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const isGeneric404 = (t) => /Failed to load resource.*404/.test(t);
  const gen404N = consoleErrors.filter(isGeneric404).length;
  const log404N = badResponses.filter((l) => l.startsWith("404")).length;
  must(gen404N <= log404N,
    `generic 404 echoes accountable to the seeded /log radius (${gen404N} <= ${log404N})`);
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t) && !isGeneric404(t));
  must(hardConsole.length === 0, hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");

  await p.close(); p = null;
  await b.close(); b = null;
  purgeT151();
  const after = await roster();
  must(after.length === rosterBefore, `roster restored (${after.length} == ${rosterBefore})`);

  console.log(`\nT151 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
