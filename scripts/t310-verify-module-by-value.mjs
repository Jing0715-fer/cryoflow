// t310 — the verify-module door learns to speak BY VALUE (Task 310).
//
// t297 gave SAVED connections a beta/hidden-module door ([id]/verify-module):
// `module avail` hides beta installs, but a name the user KNOWS can be proven
// — load it in a login shell, require relion_refine on PATH. The CREATE form
// could not ask the question: "does this beta module name load on the cluster
// I am about to add?" — the same leap of faith t290's by-value probe retired
// for logins, still alive for module names. t310 closes it:
//
//   A  demo truth — homepage 200, roster 23, mock cluster answering
//   B  the ledger — the by-value route (gate + sanitize + transient-pool drop
//      + nothing-persisted imports), the verdict chain with execError FIRST
//      (a dead host is a different answer than a missing module), the shared
//      merge helpers (one merge, both doors), the dialog's create-mode row
//      (unconditional render, mode-branched fetch + pin + label)
//   C  the live doors —
//      C1 by-value verify of the Lmod-hidden beta name against the mock
//         (ok + relionHome + mpi + merged probe; registry byte-identical)
//      C1b the same WITHOUT a base probe (the emptyProbe skeleton speaks)
//      C2 a bogus name — Lmod's own words verbatim (no forged success)
//      C3 a dead host — "SSH failed: …" (execError first)
//      C4 validation — 400s (module name grammar, missing host)
//      C5 the cross-site gate — 403
//      C6 the SAVED door regression (t297's first family coverage): create →
//         verify+pin → DTO defaultModule + merged lastProbe → persisted →
//         delete → honest 404
//      C7 the create-form flow LIVE: the verify row renders before anything
//         exists, Verify pins the draft, the chip appears pre-selected, and
//         Create carries defaultModule into the registry
//   D  console clean + roster identity
//
// Run: node scripts/t310-verify-module-by-value.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const CONNS_FILE = "/home/z/my-project/data/remote-connections.json";
const LMOD_FILE = "/home/z/my-project/services/mock-cluster/fs/home/cryo/.lmod/loaded";
const BETA = "relion/beta_5.0_gpu_ompi5_cuda118";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash("sha256").update(s).digest("hex");

// same-origin metadata — what every same-origin browser fetch carries
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

/** node fetch probe — drains the body, returns the status (console-safe). */
async function probe(method, url, headers = {}, body) {
  const r = await fetch(`${BASE}${url}`, { method, headers, body, redirect: "manual" });
  try { await r.text(); } catch { /* ignore */ }
  return r.status;
}

const readConns = () => {
  try {
    const raw = JSON.parse(readFileSync(CONNS_FILE, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

/** TCP probe of the mock cluster's SSH port. */
function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(MOCK_PORT, "127.0.0.1");
  });
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// the mock cluster: reuse a running one, launch ours otherwise (the
// launcher orphans the server so it survives this script's shell)
let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

// the mock's module tool writes $HOME/.lmod/loaded on EVERY load (the
// probe sweep's too) — snapshot + restore keeps the mock fs as-found
// (the t309 lesson: restore what you touched)
const lmodBefore = existsSync(LMOD_FILE) ? readFileSync(LMOD_FILE, "utf8") : null;

const createdIds = []; // connection ids for cleanup (newest first)
let registryCountBefore = null; // hoisted — finally must not depend on how far the try got

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1720, height: 940 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const home = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must((await home.status()) === 200, `homepage 200 (got ${home.status()})`);
  await sleep(2200);
  const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
  must((jobs0.jobs ?? []).length === 23, `roster 23 ((${(jobs0.jobs ?? []).length}))`);
  must(await mockListening(), "the mock cluster answers on :3022");

  // ---- Phase B: the ledger (source assertions) ----------------------------
  console.log("== PHASE B: the ledger ==");
  const byValueSrc = readFileSync("/home/z/my-project/src/app/api/remote/connections/verify-module/route.ts", "utf8");
  must(byValueSrc.includes("export async function POST"), "the by-value verify route exists (POST)");
  must(
    byValueSrc.includes("isLocalRequest") && byValueSrc.includes("Cross-site access is not allowed"),
    "the by-value door is gated like every remote route"
  );
  must(byValueSrc.includes("sanitizeConnection"), "the connection is built BY VALUE (sanitizeConnection)");
  must(byValueSrc.includes("dropConnection(conn.id)"), "the transient SSH session is dropped (no pool squatting)");
  must(
    !byValueSrc.includes("getConnection") && !byValueSrc.includes("patchConnection"),
    "nothing is persisted: no getConnection / patchConnection in the by-value door"
  );
  must(
    byValueSrc.indexOf("detail.execError") >= 0 &&
      byValueSrc.indexOf("detail.execError") < byValueSrc.indexOf("detail.loadRc"),
    "the verdict chain speaks SSH FIRST (execError before loadRc)"
  );
  must(byValueSrc.includes("mergeVerifiedModule"), "the merge is the SHARED helper (one merge, no drift)");
  must(byValueSrc.includes("emptyProbe()"), "a verify without a base probe builds on the empty skeleton");

  const savedSrc = readFileSync("/home/z/my-project/src/app/api/remote/connections/[id]/verify-module/route.ts", "utf8");
  must(
    savedSrc.includes("mergeVerifiedModule") && savedSrc.includes("emptyProbe()"),
    "the SAVED door rides the same helpers (refactored, not duplicated)"
  );
  must(savedSrc.includes("detail.execError"), "the SAVED door answers SSH failures honestly too (t310's first link)");
  must(
    savedSrc.includes("patch.defaultModule = moduleName"),
    "the SAVED door still pins (defaultModule on pin:true)"
  );

  const probeSrc = readFileSync("/home/z/my-project/src/lib/remote/probe.ts", "utf8");
  must(
    probeSrc.includes("export function emptyProbe") && probeSrc.includes("export function mergeVerifiedModule"),
    "probe.ts exports the shared verify-door helpers"
  );
  must(
    probeSrc.includes("execError: string | null") && probeSrc.includes("execError: detail.error ?? null"),
    "ModuleDetail carries the SSH layer's own complaint (exec never throws — it must not be swallowed)"
  );

  const dlgSrc = readFileSync("/home/z/my-project/src/components/workflow/remote-cluster-dialog.tsx", "utf8");
  must(
    dlgSrc.includes('"/api/remote/connections/verify-module"') &&
      dlgSrc.includes("{ ...buildPayload(), module: name, probe: probeOverride }"),
    "the dialog's create mode speaks BY VALUE (draft + module + current probe)"
  );
  must(
    dlgSrc.includes("setDraftDefaultModule(body?.module ?? name)"),
    "create-mode success pins the DRAFT (defaultModule rides Create — t289's idiom)"
  );
  must(
    dlgSrc.includes("creating && !valid"),
    "the Verify button waits for a valid host+username (exactly like Test & probe)"
  );
  must(
    dlgSrc.includes('creating ? "Verify" : "Verify & pin"'),
    "the button label speaks the mode (pin is a draft concern while creating)"
  );
  must(
    dlgSrc.includes('data-verify-module-row=""') &&
      dlgSrc.includes("the CREATE form speaks") &&
      !dlgSrc.includes("saved connections only"),
    "the verify row renders on the CREATE form too (the saved-only gate is gone)"
  );

  // ---- Phase C: the live doors --------------------------------------------
  console.log("== PHASE C: the live doors ==");

  // C1 — by-value verify, hidden beta name, WITH a base probe
  registryCountBefore = readConns().length;
  const registryBefore = readConns();
  const hashBefore = sha(readFileSync(CONNS_FILE, "utf8"));
  const c1 = await page.evaluate(
    async ({ SH, BETA }) => {
      const r = await fetch("/api/remote/connections/verify-module", {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "127.0.0.1", port: 3022, username: "cryo", password: "demo",
          authMethod: "password", remoteRoot: "/projects/cryoflow",
          module: BETA,
          probe: {
            ok: true, checkedAt: new Date().toISOString(), uname: "mock", moduleSystem: "lmod",
            relionModules: ["relion/5.0.1", "relion/4.4.1"],
            relionHomes: { "relion/5.0.1": "/opt/relion-5.0.1" },
            relionMpi: { "relion/5.0.1": true }, relionCtffind: {}, externals: {},
            slurm: true, gpus: [], slurmGpus: [], homeDir: "/home/cryo",
          },
        }),
      });
      return { status: r.status, body: await r.json() };
    },
    { SH, BETA }
  );
  must(c1.status === 200 && c1.body?.ok === true, `the by-value door proves the hidden beta name (got ${c1.status}/${c1.body?.ok})`);
  must(c1.body?.module === BETA, "the module name echoes verbatim");
  must(!!c1.body?.relionHome, `relionHome resolved (${String(c1.body?.relionHome ?? "").slice(0, 60)})`);
  must(c1.body?.mpi === true, "mpirun rides the inventory");
  const m1 = c1.body?.probe ?? {};
  must(
    Array.isArray(m1.relionModules) && m1.relionModules.includes(BETA) && m1.relionModules.includes("relion/5.0.1"),
    `the verified module JOINS the client's probe list (${(m1.relionModules ?? []).join(", ")})`
  );
  must(
    m1.relionHomes?.[BETA] === c1.body?.relionHome,
    "the install root lands under the module's key"
  );
  must(m1.homeDir === "/home/cryo" && m1.slurm === true, "the base probe's OTHER facts survive the merge (uname/GPU/Slurm keep their seat)");

  // C1b — the same door WITHOUT a base probe (the skeleton speaks)
  const c1b = await page.evaluate(
    async ({ SH, BETA }) => {
      const r = await fetch("/api/remote/connections/verify-module", {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "127.0.0.1", port: 3022, username: "cryo", password: "demo",
          authMethod: "password", module: BETA,
        }),
      });
      return { status: r.status, body: await r.json() };
    },
    { SH, BETA }
  );
  must(c1b.status === 200 && c1b.body?.ok === true, "verify without Test & probe first ALSO speaks (the skeleton carries it)");
  must(
    JSON.stringify(c1b.body?.probe?.relionModules) === JSON.stringify([BETA]),
    `the merged list is exactly the verified module (${(c1b.body?.probe?.relionModules ?? []).join(", ")})`
  );
  must(readConns().length === registryBefore.length && sha(readFileSync(CONNS_FILE, "utf8")) === hashBefore,
    "the registry is BYTE-IDENTICAL after both verifies (nothing persisted)");

  // C2 — a bogus name: Lmod's own words, no forged success
  const c2 = await page.evaluate(
    async ({ SH }) => {
      const r = await fetch("/api/remote/connections/verify-module", {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "127.0.0.1", port: 3022, username: "cryo", password: "demo",
          authMethod: "password", module: "relion/nope",
        }),
      });
      return { status: r.status, body: await r.json() };
    },
    { SH }
  );
  must(c2.status === 200 && c2.body?.ok === false, `a bogus name degrades to ok:false (got ${c2.status}/${c2.body?.ok})`);
  must(
    String(c2.body?.error ?? "").includes("Unknown module: relion/nope"),
    `Lmod's own words ride the refusal ("${String(c2.body?.error ?? "").slice(0, 80)}")`
  );

  // C3 — a dead host: SSH's own complaint FIRST (not "not found on PATH")
  const c3 = await page.evaluate(
    async ({ SH, BETA }) => {
      const r = await fetch("/api/remote/connections/verify-module", {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "127.0.0.1", port: 3023, username: "cryo", password: "demo",
          authMethod: "password", module: BETA,
        }),
      });
      return { status: r.status, body: await r.json() };
    },
    { SH, BETA }
  );
  must(c3.status === 200 && c3.body?.ok === false, `a dead host degrades to ok:false (got ${c3.status}/${c3.body?.ok})`);
  must(
    String(c3.body?.error ?? "").startsWith("SSH failed:"),
    `the SSH layer's own complaint speaks FIRST ("${String(c3.body?.error ?? "").slice(0, 60)}")`
  );

  // C4 — validation: 400s (NODE-side: deliberate 4xx stays out of the console)
  must((await probe("POST", "/api/remote/connections/verify-module", { ...SH, "Content-Type": "application/json" },
    JSON.stringify({ host: "127.0.0.1", username: "cryo", module: "" }))) === 400,
    "an empty module name is refused (400)");
  must((await probe("POST", "/api/remote/connections/verify-module", { ...SH, "Content-Type": "application/json" },
    JSON.stringify({ host: "127.0.0.1", username: "cryo", module: "relion/nope; rm -rf /" }))) === 400,
    "shell metacharacters in the module name are refused (400 — the grammar IS the guard)");
  must((await probe("POST", "/api/remote/connections/verify-module", { ...SH, "Content-Type": "application/json" },
    JSON.stringify({ username: "cryo", module: "relion/5.0.1" }))) === 400,
    "a hostless body is refused (400)");

  // C5 — the cross-site gate (node-side curl-style: no fetch metadata)
  must((await probe("POST", "/api/remote/connections/verify-module",
    { Origin: "http://evil.example", "Content-Type": "application/json" },
    JSON.stringify({ host: "127.0.0.1", username: "cryo", module: "relion/5.0.1" }))) === 403,
    "cross-site access is not allowed (403)");

  // C6 — the SAVED door regression (t297's first family coverage)
  const mk = await page.evaluate(
    async ({ SH }) => {
      const r = await fetch("/api/remote/connections", {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "QA t310 Saved Door", host: "127.0.0.1", port: 3022,
          username: "cryo", password: "demo", authMethod: "password",
          remoteRoot: "/projects/cryoflow",
        }),
      });
      return { status: r.status, body: await r.json() };
    },
    { SH }
  );
  const connId = mk.body?.connection?.id;
  if (mk.status === 201 && connId) createdIds.push(connId);
  must(mk.status === 201 && !!connId, `the saved door's subject exists (created ${mk.status})`);

  const c6 = await page.evaluate(
    async ({ SH, connId, BETA }) => {
      const r = await fetch(`/api/remote/connections/${connId}/verify-module`, {
        method: "POST",
        headers: { ...SH, "Content-Type": "application/json" },
        body: JSON.stringify({ module: BETA, pin: true }),
      });
      return { status: r.status, body: await r.json() };
    },
    { SH, connId, BETA }
  );
  must(c6.status === 200 && c6.body?.ok === true, `the SAVED door verifies the hidden beta name (got ${c6.status}/${c6.body?.ok})`);
  must(c6.body?.connection?.defaultModule === BETA, "pin:true landed on the record (defaultModule)");
  must(
    c6.body?.connection?.lastProbe?.relionModules?.includes(BETA),
    "the merged probe persisted into lastProbe"
  );
  must(c6.body?.connection?.hasPassword === true, "secrets stay stripped from the DTO (hasPassword, never the password)");
  const persisted = readConns().find((c) => c.id === connId);
  must(persisted?.defaultModule === BETA, "the registry itself carries the pinned default");

  // C7 — the create-form flow LIVE (nothing exists yet, the door already does)
  console.log("== PHASE C7: the create-form flow live ==");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true });
  await sleep(1000);
  const dlg = page.locator('[role="dialog"]').last();
  must(await dlg.isVisible().catch(() => false), "the remote-clusters dialog opens");
  await dlg.locator('button:has-text("Add connection")').first().click({ force: true });
  await sleep(700);
  const row = dlg.locator('[data-verify-module-row=""]').first();
  must(await row.isVisible().catch(() => false), "the verify row renders on the CREATE form (before anything is saved)");
  const vbtn = row.locator('[data-verify-module-button=""]');
  must(await vbtn.isDisabled().catch(() => true), "Verify is disabled on an empty form (valid-gated like Test & probe)");

  await dlg.locator('[aria-label="SSH host (required)"]').first().fill("127.0.0.1");
  await dlg.locator('[aria-label="SSH port"]').first().fill("3022");
  await dlg.locator('[aria-label="SSH username (required)"]').first().fill("cryo");
  await dlg.locator('[aria-label="Password"]').first().fill("demo");
  must(
    (await vbtn.isDisabled().catch(() => true)) === true,
    "Verify stays disabled while the module name is empty (name AND creds are both required)"
  );
  must(((await vbtn.innerText().catch(() => "")) || "").includes("Verify"), "the label says Verify (not Verify & pin) while creating");

  await row.locator('[data-verify-module-input=""]').first().fill(BETA);
  await sleep(200);
  must(!(await vbtn.isDisabled().catch(() => true)), "Verify arms once creds AND a module name are present");
  await vbtn.click({ force: true });
  const okLine = dlg.locator('[data-verify-module-ok=""]').first();
  await okLine.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  const okText = (await okLine.innerText().catch(() => "")) || "";
  must(okText.includes(BETA), `the ok line names the verified module ("${okText.slice(0, 70)}")`);
  must(okText.includes("when you create the connection"), "the create-mode copy says the default RIDES Create (nothing is saved yet)");
  const chip = dlg.locator(`button[aria-pressed="true"]`, { hasText: "beta_5.0" }).first();
  must(await chip.isVisible().catch(() => false), "the verified module appears among the chips ALREADY SELECTED (draft pin)");
  must(
    ((await dlg.innerText().catch(() => "")) || "").toLowerCase().replace(/\s+/g, " ").includes("probe (not saved yet)"),
    "the probe card speaks the create-mode title"
  );
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, "t310-verify-by-value.png") });
  console.log("  (shot) t310-verify-by-value.png");

  await dlg.locator('button:has-text("Create connection")').first().click({ force: true });
  await sleep(1800);
  const uiCreated = readConns().filter((c) => !registryBefore.some((b) => b.id === c.id) && !createdIds.includes(c.id));
  const newRec = uiCreated[uiCreated.length - 1];
  must(!!newRec?.id, "Create landed the connection in the registry");
  if (newRec?.id && !createdIds.includes(newRec.id)) createdIds.push(newRec.id);
  must(newRec?.defaultModule === BETA, "defaultModule rode the Create payload (the draft pin committed)");

  // ---- Phase D: console + roster ------------------------------------------
  console.log("== PHASE D: console + roster ==");
  must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 100)}` : ""})`);
  const jobs1 = await (await fetch(`${BASE}/api/jobs`)).json();
  must((jobs1.jobs ?? []).length === 23, `roster still 23 (${(jobs1.jobs ?? []).length})`);
} finally {
  console.log("== finally: the world scrub ==");
  // created connections, newest first
  for (const id of [...createdIds].reverse()) {
    await fetch(`${BASE}/api/remote/connections/${id}`, { method: "DELETE", headers: SH }).catch(() => {});
  }
  const left = readConns().length;
  if (registryCountBefore !== null && left !== registryCountBefore) {
    console.log(`  (log) RESIDUE: registry holds ${left}, pre-suite had ${registryCountBefore} — the next window reads this line`);
  }
  // the mock's .lmod/loaded back to as-found (or gone if it never existed)
  try {
    if (lmodBefore === null) unlinkSync(LMOD_FILE);
    else writeFileSync(LMOD_FILE, lmodBefore);
  } catch { /* best effort */ }
  await browser.close().catch(() => {});
  // kill the mock only if this suite launched it
  if (weLaunchedMock) {
    try { execSync(`fuser -k ${MOCK_PORT}/tcp`); } catch { /* already down */ }
  }
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
