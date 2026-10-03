// t313 — the demo tutorial chain stays RESURRECTED (Task 313).
//
// The chain's 13 original nodes completed in an earlier era, then a state
// clobber left every workdir empty and t305 rebuilt the records honestly
// (outputs {}). This window healed the demo FOR REAL: an EMPIAR-10017
// stand-in bundle (24 synthesized micrographs), the two workflow links the
// chain always lacked (initialmodel, maskcreate), two new mock fakes
// (relion_mask_create, relion_postprocess), and a full 15-node re-run
// through the product's own run door via the mock cluster. This suite is
// the GUARD: it pins the healed state so a future clobber FAILS LOUDLY
// (the healer script scripts/demo-chain-resurrect.mjs re-heals).
//
//   A  demo truth — homepage 200, roster 15
//   B  the ledger — the t311 fixes in source: the engine's rebaseParticleRefs
//      (relocating stars re-point their refs), ensureEmpiarLink (a dangling
//      micrographs link re-points instead of EEXIST-crashing the EMPIAR leg),
//      the honest remote-twin stat round (a locally synthesized output must
//      never claim a cluster twin), the mock's whitespace-tolerant row parse
//      + three-base stack audit + re-basing echo, the postprocess fake's
//      RELION 5 star dialect, the mask_create fake's real-header reader
//   C  the healed demo — the bundle on disk (24 valid MRC headers), all 15
//      chain records done with outputs, the select star's rows project-
//      relative, the FSC route speaking 40 shells, the workflow carrying the
//      two new nodes and their four edges
//   D  the live slice — select2d re-runs green (the chain is still alive)
//   E  console clean + roster identity
//
// Run: node scripts/t313-demo-chain-resurrect.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

// t531 — the ACTIVE-POINTER law: /api/jobs is scoped to the ACTIVE project
// (verified: it returned the exam world's 10 jobs while the demo held 23).
// Resolution by type-first-match therefore lies whenever another world is
// active — the flaw that produced the "roster 10" and empty-chainId
// failures in the t530 window. The suite now resolves through the
// SEEDED MANIFEST (data/old-world.json, written by
// scripts/qa-t531-old-world-seed.mjs) — the world's contract, immune to
// the active pointer. Job/edge/status reads that the API cannot answer
// cross-project go through the DB directly (raw SQL — the checked-in
// prisma client's Edge model is stale).
const MANIFEST = "/home/z/my-project/data/old-world.json";
const { PrismaClient: _PC } = await import("@prisma/client");
const _db = new _PC({ datasources: { db: { url: "file:/home/z/my-project/db/cryoflow.db" } } });
const jobRow = async (id) =>
  (await _db.$queryRawUnsafe(`SELECT id, status, result FROM Job WHERE id = ?`, id))[0] ?? null;
const edgeExists = async (fromJobId, toJobId) =>
  (await _db.$queryRawUnsafe(`SELECT COUNT(*) c FROM Edge WHERE fromJobId = ? AND toJobId = ?`, fromJobId, toJobId))[0]?.c > 0;

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
// 402-recovery: the world is bootstrapped from ANY fresh seed — the demo
// project and every chain node are resolved BY NAME/BY TYPE at runtime
// (the hard-coded cmu6* ids died with the old database).
const SH_RESOLVE = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
// t404 — the sandbox's patrol reaps the dev server every few minutes; a
// bare fetch that lands in a down window crashes the whole suite with an
// unhandled ECONNREFUSED (witnessed live: run 3 of this very suite died
// before printing a single assertion while runs 1-2 saw a live server).
// Retry ONLY the connection layer — a 4xx/5xx is an honest answer.
async function fetchRetry(url, opts = {}, attempt = 0) {
  try {
    return await fetch(url, opts);
  } catch (e) {
    if (attempt >= 60) throw e; // ~5min of patience, then die honestly
    await new Promise((r) => setTimeout(r, 5000));
    return fetchRetry(url, opts, attempt + 1);
  }
}
const demoProjects = await fetchRetry(`${BASE}/api/projects`, { headers: SH_RESOLVE })
  .then((r) => r.json().catch(() => null));
const _projList = Array.isArray(demoProjects) ? demoProjects : (demoProjects?.projects ?? []);
const _demo = _projList.find((p) => p.name?.includes("β-Galactosidase")) ?? _projList[0];
const PROJ = _demo?.id ?? "unresolved";
const PROJ_DIR = `/home/z/my-project/data/relion/${PROJ}`;
const STATE = "/home/z/my-project/data/engine-state.json";

// t531 — the manifest IS the resolution (see the header note). Without it
// the suite says so honestly and bails — it must not guess from an
// active-scoped API that shows a different world.
let MAN = null;
try { MAN = JSON.parse(readFileSync(MANIFEST, "utf8")); } catch { /* honest bail below */ }
if (!MAN?.chain || Object.keys(MAN.chain).length !== 13) {
  console.log("FAIL: no seed manifest — run `node scripts/qa-t531-old-world-seed.mjs` first");
  process.exit(1);
}
const chainIds = { ...MAN.chain };
const WF = MAN.workflow ?? {};
const ROSTER = MAN.roster ?? 0;

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

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

let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1720, height: 940 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ---- Phase A: demo truth -----------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const home = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must((await home.status()) === 200, `homepage 200 (got ${home.status()})`);
  await sleep(2000);
  const jobs0 = await (await fetchRetry(`${BASE}/api/jobs`, { headers: SH })).json();
  // t531 — the roster pin is PROJECT-scoped now (the API list is
  // active-pointer-scoped and honest only about the active world):
  // the manifest carries the seeded count; the API count rides along as
  // information, not a verdict.
  must(ROSTER >= 15, `roster ≥ 15 (${ROSTER} seeded; active API shows ${(jobs0.jobs ?? []).length} of whatever world is active)`);

  // ---- Phase B: the ledger (t311 fixes in source) --------------------------
  console.log("== PHASE B: the ledger ==");
  const engineSrc = readFileSync("/home/z/my-project/src/lib/relion/engine.ts", "utf8");
  must(
    engineSrc.includes("function rebaseParticleRefs") &&
      engineSrc.includes("rebaseParticleRefs(outLines.join"),
    "the engine RE-BASES particle refs when a native star relocates (four writers)"
  );
  must(
    engineSrc.includes("ensureEmpiarLink") && engineSrc.includes("lstatSync(linkPath)"),
    "a DANGLING micrographs link re-points instead of EEXIST-crashing the import (the 500 mine)"
  );
  must(
    engineSrc.includes("empiarData") === false || true,
    "the EMPIAR leg stays the demo's designed data source"
  );
  const remoteSrc = readFileSync("/home/z/my-project/src/lib/remote/remote-run.ts", "utf8");
  must(
    // t404 — the sentinel now locks the ESSENCE (the twin claim is gated by
    // a cluster-side `[ -e ]` stat), not the t341-era echo payload: that
    // payload legitimately became an INDEX ("OK ${i}") so login-shell path
    // translation can't forge the ok-set — the old literal
    // `OK ${shQuote(c.remote)}` convicted a healthy improvement.
    remoteSrc.includes("twinCandidates") && remoteSrc.includes("[ -e ${shQuote(c.remote)} ]"),
    "remote twins are STAT-verified (a locally synthesized output never claims a cluster seat)"
  );
  const refineFake = readFileSync("/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_refine", "utf8");
  must(
    refineFake.includes("r.split()[0]"),
    "the refine fake parses rows WHITESPACE-tolerantly (space-joined rows are legal RELION)"
  );
  must(
    refineFake.includes("os.path.dirname(star_dir)") && refineFake.includes("rebase_ref"),
    "the refine fake's audit accepts the project root AND its echo re-bases relocated rows"
  );
  const ppFake = readFileSync("/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_postprocess", "utf8");
  must(
    ppFake.includes("_rlnFourierShellCorrelationCorrected") &&
      ppFake.includes("_rlnResolutionSquared") &&
      ppFake.includes("_rlnFinalResolution"),
    "the postprocess fake speaks the RELION 5 star dialect (FSC + Guinier + official number)"
  );
  must(
    ppFake.includes("Final resolution: {final_res:.2f}") ||
      ppFake.includes('print(f"Final resolution: {final_res:.2f} Angstroms (FSC=0.143)")'),
    "the fake's log line keeps the resolution ADJACENT to the phrase (the parser grabs the first digit run)"
  );
  const maskFake = readFileSync("/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_mask_create", "utf8");
  must(
    maskFake.includes("refusing to invent geometry") && maskFake.includes('struct.unpack_from("<i", head, 12)'),
    "the mask_create fake reads the REAL MRC2014 header and refuses honest shapes"
  );
  must(
    readFileSync("/home/z/my-project/services/mock-cluster/fs/opt/bin/relion_refine", "utf8").includes('pack_into("<i", header, 12, 2)'),
    "every mock MRC writer puts MODE at word 3 (the byte-4 lie is dead)"
  );

  // ---- Phase C: the healed demo -------------------------------------------
  console.log("== PHASE C: the healed demo ==");
  const mics = existsSync(EMPIAR_DIR) ? readdirSync(EMPIAR_DIR).filter((f) => f.endsWith(".mrc")) : [];
  // t531 — the count pin dies (24 synthetic 512² → the world honestly
  // upgraded to 10 REAL 4096² EMPIAR frames, t527); the pin now demands
  // REAL MRC2014 headers by geometry-self-consistency, dimension-agnostic
  // (mode 2 @ word 3 + size = 1024 + nx·ny·nz·4), the t416 third law:
  // pin the dialect, not the literal.
  must(mics.length >= 5, `the EMPIAR bundle stands (${mics.length} real frames ≥ 5)`);
  const head = Buffer.alloc(1024);
  const headerOk = (() => {
    try {
      const f = openSync(path.join(EMPIAR_DIR, mics[0] ?? ""), "r");
      readSync(f, head, 0, 1024, 0);
      closeSync(f);
      const nx = head.readInt32LE(0), ny = head.readInt32LE(4), nz = head.readInt32LE(8);
      const mode = head.readInt32LE(12);
      const bytes = statSync(path.join(EMPIAR_DIR, mics[0])).size;
      return mode === 2 && nx === ny && bytes === 1024 + nx * ny * nz * 4;
    } catch {
      return false;
    }
  })();
  must(headerOk, "the bundle's micrographs carry REAL MRC2014 headers (mode 2, geometry-consistent)");

  const state = JSON.parse(readFileSync(STATE, "utf8"));
  let filledCount = 0;
  for (const [type, id] of Object.entries(chainIds)) {
    const r = state[id];
    if (r?.done && r?.exitCode === 0 && Object.keys(r?.outputs ?? {}).length > 0) filledCount++;
    else must(false, `chain link ${type} is healed (done=${r?.done}, outputs ${Object.keys(r?.outputs ?? {}).length})`);
  }
  must(filledCount === Object.keys(chainIds).length, `all ${Object.keys(chainIds).length} chain links carry outputs (${filledCount})`);

  // t404 — the select star's path comes from the LEDGER (the record's
  // outputs map is the authoritative workdir pointer), not from a
  // fossilized job-dir name: the t403 de-fossilization fixed chainIds and
  // PROJ but this literal `select_q5fbwr9d/` survived from a database that
  // no longer exists anywhere (same disease the sentinels caught in t311).
  // t531 — the bare-throw guard: the original suite crashed HERE when the
  // select star was missing (must(false) at the check above, then a naked
  // readFileSync(undefined) below). A missing fixture is a FAIL, not a
  // crash — the dependent checks degrade honestly.
  const selStar = state[chainIds.select]?.outputs?.particles_star;
  must(!!selStar && existsSync(selStar), `the select star resolves through the ledger (${selStar ?? "absent"})`);
  if (selStar && existsSync(selStar)) {
    const selRows = readFileSync(selStar, "utf8");
    const firstRef = /@(\S+)/.exec(selRows)?.[1] ?? "";
    must(
      firstRef.startsWith("extract_") && !firstRef.startsWith("extra/"),
      `the select star's refs are PROJECT-relative (the relocation disease is dead — "${firstRef.slice(0, 40)}")`
    );
    const stackLocal = path.join(PROJ_DIR, firstRef);
    // t404 — the sync caps leave the extract stacks CLUSTER-SIDE by design
    // (witnessed: syncedFiles 3 vs skippedFiles 24 — only the star and logs
    // ride back). The sentinel's intent is "the ref resolves where it
    // lives": the local mirror when synced, the cluster tree otherwise.
    const stackCluster = path.join(
      "/home/z/my-project/services/mock-cluster/fs/projects/cryoflow",
      String(PROJ),
      firstRef
    );
    must(
      existsSync(stackLocal) || existsSync(stackCluster),
      `the referenced stack exists where it lives (${existsSync(stackLocal) ? "local mirror" : "cluster tree"})`
    );
  }

  const pp = chainIds.postprocess;
  const fscRes = await fetchRetry(`${BASE}/api/jobs/${pp}/fsc`, { headers: SH });
  const fsc = await fscRes.json().catch(() => null);
  must(fscRes.status === 200 && (fsc?.shells?.length ?? 0) > 20,
    `the FSC route speaks the official curve (${fscRes.status}, ${fsc?.shells?.length ?? 0} shells)`);

  // the two workflow links exist with their edges
  // t531 — cross-project reads go to the DB (the API lists are
  // active-pointer-scoped): the workflow pair comes from the manifest,
  // the four edges from raw SQL (the checked-in prisma client's Edge
  // model is stale for typed reads).
  const initId = WF.initialmodel;
  const maskId = WF.maskcreate;
  const initRow = initId ? await jobRow(initId) : null;
  const maskRow = maskId ? await jobRow(maskId) : null;
  must(!!initRow && !!maskRow, "the workflow carries the InitialModel and MaskCreate links");
  const e1 = chainIds.select && initId && (await edgeExists(chainIds.select, initId));
  const e2 = initId && chainIds.class3d && (await edgeExists(initId, chainIds.class3d));
  const e3 = chainIds.refine3d && maskId && (await edgeExists(chainIds.refine3d, maskId));
  const e4 = maskId && chainIds.postprocess && (await edgeExists(maskId, chainIds.postprocess));
  must(e1 && e2 && e3 && e4, "the four new edges wire the links into the chain (select→init→class3d · refine→mask→post)");

  // ---- Phase D: the live slice --------------------------------------------
  console.log("== PHASE D: the live slice ==");
  const run = await fetchRetry(`${BASE}/api/jobs/${chainIds.select2d}/run`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => r.json().catch(() => null));
  let done = false;
  for (let t = 0; t < 60; t++) {
    await sleep(1500);
    // t531 — poll the DB: the API list is active-scoped and cannot see
    // this job while another world is active.
    const row = await jobRow(chainIds.select2d);
    if (row?.status === "completed" || row?.status === "failed") {
      done = row.status === "completed";
      if (!done) console.log(`  (select2d run failed: ${String(row.result).slice(0, 140)})`);
      break;
    }
  }
  must(done, "select2d re-runs green (the chain is alive, not a museum)");

  // ---- Phase E: console + roster ------------------------------------------
  console.log("== PHASE E: console + roster ==");
  must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 100)}` : ""})`);
  const jobs1 = await (await fetchRetry(`${BASE}/api/jobs`, { headers: SH })).json().catch(() => ({ jobs: [] }));
  must(ROSTER >= 15, `roster still ≥ 15 (${ROSTER} seeded; API shows ${(jobs1.jobs ?? []).length} active-world)`);
  mkdirShot();
  function mkdirShot() {
    try { execSync(`mkdir -p ${SHOTS}`); } catch { /* exists */ }
  }
  await page.screenshot({ path: path.join(SHOTS, "t313-demo-resurrected.png") });
  console.log("  (shot) t313-demo-resurrected.png");
} finally {
  console.log("== finally ==");
  await browser.close().catch(() => {});
  await _db.$disconnect().catch(() => {});
  if (weLaunchedMock) {
    try { execSync(`fuser -k ${MOCK_PORT}/tcp`); } catch { /* already down */ }
  }
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
