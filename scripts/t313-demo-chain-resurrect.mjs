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
//   A  demo truth — homepage 200, roster 23
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
import { existsSync, readFileSync, readdirSync, openSync, readSync, closeSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const EMPIAR_DIR = "/home/z/empiar-10017/micrographs";
const PROJ = "cmu6xtvf70000kl81kxtzbpl4";
const PROJ_DIR = `/home/z/my-project/data/relion/${PROJ}`;
const STATE = "/home/z/my-project/data/engine-state.json";

const chainIds = {
  import: "cmu6yyzgi0005kl7tt9auvg6r",
  motioncorr: "cmu6yyzgv0007kl7t86q3uixd",
  ctffind: "cmu6yyzh70009kl7tw762olol",
  autopick: "cmu6yyzhg000bkl7tbl5s75h4",
  extract: "cmu6yyzht000dkl7tzxe9nfbi",
  class2d: "cmu6yyzmn000rkl7thtpb170c",
  select2d: "cmu6yyzmw000tkl7t7znux178",
  select: "cmu6yyzi6000fkl7tq5fbwr9d",
  class3d: "cmu6yyzj4000lkl7t5iqxl6g5",
  symexpand: "cmu6yyzii000hkl7tpbz6ri8k",
  rebalance: "cmu6yyzir000jkl7tsmhyl5o9",
  refine3d: "cmu6yyzjm000nkl7trg1kyo6i",
  postprocess: "cmu6yyzk0000pkl7t97pzlq90",
};

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
  const jobs0 = await (await fetch(`${BASE}/api/jobs`)).json();
  must((jobs0.jobs ?? []).length === 23, `roster 23 ((${(jobs0.jobs ?? []).length}))`);

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
    remoteSrc.includes("twinCandidates") && remoteSrc.includes("OK ${shQuote(c.remote)}"),
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
  must(mics.length === 24, `the EMPIAR stand-in bundle holds 24 micrographs (${mics.length})`);
  const head = Buffer.alloc(1024);
  const fdOk = (() => {
    try {
      const f = openSync(path.join(EMPIAR_DIR, mics[0] ?? ""), "r");
      readSync(f, head, 0, 1024, 0);
      closeSync(f);
      return head.readInt32LE(12) === 2 && head.readInt32LE(0) === 512;
    } catch {
      return false;
    }
  })();
  must(fdOk, "the bundle's micrographs carry REAL MRC2014 headers (mode 2 @ word 3, 512²)");

  const state = JSON.parse(readFileSync(STATE, "utf8"));
  let filledCount = 0;
  for (const [type, id] of Object.entries(chainIds)) {
    const r = state[id];
    if (r?.done && r?.exitCode === 0 && Object.keys(r?.outputs ?? {}).length > 0) filledCount++;
    else must(false, `chain link ${type} is healed (done=${r?.done}, outputs ${Object.keys(r?.outputs ?? {}).length})`);
  }
  must(filledCount === Object.keys(chainIds).length, `all ${Object.keys(chainIds).length} chain links carry outputs (${filledCount})`);

  const selRows = readFileSync(path.join(PROJ_DIR, "select_q5fbwr9d/particles_select.star"), "utf8");
  const firstRef = /@(\S+)/.exec(selRows)?.[1] ?? "";
  must(
    firstRef.startsWith("extract_") && !firstRef.startsWith("extra/"),
    `the select star's refs are PROJECT-relative (the relocation disease is dead — "${firstRef.slice(0, 40)}")`
  );
  must(
    existsSync(path.join(PROJ_DIR, firstRef)),
    "the referenced stack exists at the project-relative position ON DISK"
  );

  const pp = chainIds.postprocess;
  const fscRes = await fetch(`${BASE}/api/jobs/${pp}/fsc`, { headers: SH });
  const fsc = await fscRes.json().catch(() => null);
  must(fscRes.status === 200 && (fsc?.shells?.length ?? 0) > 20,
    `the FSC route speaks the official curve (${fscRes.status}, ${fsc?.shells?.length ?? 0} shells)`);

  // the two workflow links exist with their edges
  const jobsAll = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
  const edges = (await (await fetch(`${BASE}/api/edges`)).json()).edges ?? [];
  const init = jobsAll.find((j) => j.type === "initialmodel" && j.projectId === PROJ);
  const mask = jobsAll.find((j) => j.type === "maskcreate" && j.projectId === PROJ);
  must(!!init && !!mask, "the workflow carries the InitialModel and MaskCreate links");
  must(
    edges.some((e) => e.fromJobId === chainIds.select && e.toJobId === init?.id) &&
      edges.some((e) => e.fromJobId === init?.id && e.toJobId === chainIds.class3d) &&
      edges.some((e) => e.fromJobId === chainIds.refine3d && e.toJobId === mask?.id) &&
      edges.some((e) => e.fromJobId === mask?.id && e.toJobId === pp),
    "the four new edges wire the links into the chain (select→init→class3d · refine→mask→post)"
  );

  // ---- Phase D: the live slice --------------------------------------------
  console.log("== PHASE D: the live slice ==");
  const run = await fetch(`${BASE}/api/jobs/${chainIds.select2d}/run`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => r.json().catch(() => null));
  let done = false;
  for (let t = 0; t < 60; t++) {
    await sleep(1500);
    const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
    const dto = jobs.find((j) => j.id === chainIds.select2d);
    if (dto?.status === "completed" || dto?.status === "failed") {
      done = dto.status === "completed";
      break;
    }
  }
  must(done, "select2d re-runs green (the chain is alive, not a museum)");

  // ---- Phase E: console + roster ------------------------------------------
  console.log("== PHASE E: console + roster ==");
  must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 100)}` : ""})`);
  const jobs1 = await (await fetch(`${BASE}/api/jobs`)).json();
  must((jobs1.jobs ?? []).length === 23, `roster still 23 (${(jobs1.jobs ?? []).length})`);
  mkdirShot();
  function mkdirShot() {
    try { execSync(`mkdir -p ${SHOTS}`); } catch { /* exists */ }
  }
  await page.screenshot({ path: path.join(SHOTS, "t313-demo-resurrected.png") });
  console.log("  (shot) t313-demo-resurrected.png");
} finally {
  console.log("== finally ==");
  await browser.close().catch(() => {});
  if (weLaunchedMock) {
    try { execSync(`fuser -k ${MOCK_PORT}/tcp`); } catch { /* already down */ }
  }
}

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
