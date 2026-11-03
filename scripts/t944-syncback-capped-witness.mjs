#!/usr/bin/env node
/**
 * t944 — the outputs leg's SECOND cap face: the SYNC-BACK leg's own
 * truncated landing (the finalize-time sync meeting a world past the cap).
 *
 * The t464 capped-ledger grammar has TWO product faces. The first — the
 * question leg's manifest-only landing ("manifest only; no sync-back
 * ran — the ledger is capped, the cluster holds more") — was witnessed
 * live by t942. The second — the REAL finalize-time syncBackWorkdir
 * enumerating a capped world, writing truncated:true into the ledger
 * BEFORE pulling anything home, speaking its own capped receipt into the
 * record ("the outputs ledger was capped at 20000 files — the cluster's
 * workdir holds more…"), and leaving a local mirror big enough that the
 * Files tab's describeListingNote must speak the BOTH-facts sentence
 * (local + ledger in one breath — the t464 遗留⑤'s own words) — has
 * never had a live fire. This arc is that fire.
 *
 * THE LEVER, retuned for the finalize world: t942's pads were 0-byte
 * touch files — but under key-files + class2d (NOT a bulk producer) a
 * 0-byte pad is small enough to COME HOME (20,400 SSH pulls — hours).
 * The t944 pads are SPARSE: `truncate -s 629145600` gives each an
 * apparent 600 MB (past the connection's maxFileMb 512 → the planner's
 * own key-cap skip refuses the pull; the ledger still lists them) while
 * the disk holds ≈ zero blocks. A sparse gate rides the lever: 200 pads
 * first, the real-byte census judged, FATAL if the filesystem does not
 * honor holes (the full lever would eat the disk).
 *
 * THE FINDING the arc was built to catch — and caught on sighting: the
 * Files tab (job-inspector's FilesTab) only rendered the outputs note in
 * the EMPTY state — the one shape the honesty sentence can never
 * describe (a truncated walk or a capped ledger implies a BIG listing).
 * The Results view carried the sentence alone; the tab where the user
 * actually browses the listing went silent. THE CURE (this window,
 * before the arc rode): the note now rides above the table — the house
 * honesty line (warning tone, AlertTriangle, data-listing-note), never
 * scrolled away with the rows it speaks for. The arc pins the cure in
 * the browser: the Files tab speaks the BOTH-facts sentence in a world
 * with 600 file cards.
 *
 *   stage1  the t916 mint re-rides, the bind, iterations=60 (a ~65s run),
 *           the park, the run, run_it001 landed, THE SPARSE GATE (200
 *           pads, the holes verified), THE INFLATION LEVER (20,400
 *           sparse pads — the world grown past the cap while the
 *           finalize leg is still a minute away), the pad census, the
 *           sparse honesty (apparent ≈ 12.8 TB, real < 0.5 GB), the
 *           rounds census untouched, NO question open (the natural lane
 *           carries none), the dev log's finalize line still at baseline.
 *   stage2  THE RUN COMPLETES NORMALLY — the finalize leg's find
 *           enumerates ~21k lines through the cap+1 head: the ledger
 *           lands truncated:true at EXACTLY 20,000 entries (door family
 *           first), the planner key-caps every pad (zero pulls), the
 *           natural tree (~674 files) comes home past the walk's own 300
 *           cap, the record speaks the finalize receipt's capped
 *           sentence + the pads' skip segment (first live fire of both),
 *           the dev log says "20400 skipped", the outputs route answers
 *           600 files and the BOTH-facts note byte-exact.
 *   stage3  the finalize-capped door (a pulled star deleted host-side,
 *           fetched home through the exact-entry ledger — total=20000,
 *           the honest remaining), the completed face speaking the
 *           capped receipt, THE CURE'S BROWSER PIN (the Files tab's
 *           data-listing-note + the Results view's inline note), the
 *           restore (the binding law, the t916 remove sweeping the pads
 *           with the workdir, the unbound leave, the seed trio + 2
 *           edges, the doctor CLEAN — the wire never moved).
 *
 *   node scripts/t944-syncback-capped-witness.mjs stage1|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t944-syncback-capped-witness.json";
const STATE = path.join(ROOT, "data", "t944-syncback-capped.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");
const DEV_LOG = "/tmp/cryoflow-qa/dev-server.log";

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const ITERS = 60; /* ~65s of rounds at the mock's 0.9s/round */

/* the finalize leg's own words (remote-run.ts — the receipt the sync-back
 * speaks into the record and the row; never witnessed live before) */
const FINALIZE_CAPPED_HEAD = "the outputs ledger was capped at 20000 files";
const FINALIZE_CAPPED_TAIL = "CF_SYNC_MANIFEST_MAX raises the cap)";
const SKIP_SEGMENT = "bulky file(s) stayed on the cluster (key-files policy)";
const PAD_SKIP_WORD = "(600 MB > 16 MB key-file cap)";
/* the Files tab's BOTH-facts sentence (remote-files.ts describeListingNote —
 * the t464 遗留⑤'s own words: local + ledger in one breath) */
const NOTE_BOTH_HEAD = "— and the ledger itself was capped:";
const NOTE_BOTH_TAIL = "the cluster holds more than the manifest shows (the final star family is pinned first)";
/* the dev log's finalize line (remote-run.ts's own mouth at the sync's end) */
const FINALIZE_LINE = `remote-run: class2d "${NAME_CLASS2D}" exit 0 (`;

/* THE INFLATION LEVER: 20,400 SPARSE pad files — apparent 600 MB each
 * (past the connection's maxFileMb 512 → the planner's key-cap skip
 * refuses the PULL; the ledger still lists them), real blocks ≈ 0. */
const PAD_DIR_NAME = "t944-pad";
const PAD_COUNT = 20400;
const PAD_SIZE = 629145600; /* 600 MB apparent > maxFileMb 512 MB */
const CAP_EXPECTED = 20000; /* the server's own REMOTE_MANIFEST_MAX */

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim();
const evalJs = (expr) => {
  /* the transport law: a wedged renderer (the CDP evaluate hang this arc
   * rode into) must read as "no answer", not a dead script — the polls
   * and the ensureDialog recovery judge the world, not the transport */
  try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { console.log("  (eval transport failed — reading as no answer)"); return String(e?.stdout ?? "") || "null"; }
};
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`);
        sh(`${AB} mouse down`);
        sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const settleCensus = async () => {
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job')].length)`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const openInspectorHard = async (name, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
    const opened = await poll(
      `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
      (v) => v.open === true, 5, 500,
    );
    if (opened?.open === true) return `open@try${i}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(700);
  }
  return "NEVER-OPEN";
};
const shApi = (url) => {
  let lastErr = null;
  for (let i = 0; i < 10; i++) {
    try { return sh(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`); }
    catch (e) { lastErr = e; try { execSync("sleep 4", { cwd: ROOT }); } catch {} }
  }
  throw lastErr;
};
const apiJson = (url) => JSON.parse(shApi(url));
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  try { return JSON.parse(sh(cmd)); } catch { return { error: "parse" }; }
};
const jobs = () => apiJson("/api/jobs").jobs ?? [];
const edges = () => apiJson("/api/edges").edges ?? [];
const connections = () => apiJson("/api/remote/connections").connections ?? [];
const findName = (n) => jobs().find((j) => j.name === n);
const readRecord = (jobId) => {
  try { return JSON.parse(readFileSync(ENGINE_STATE, "utf8"))[jobId] ?? null; } catch { return null; }
};
const manifestBinding = () => {
  try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).binding ?? null; } catch { return null; }
};
const pidFileFor = (id) => path.join(SLURM_DIR, `job-${id}.pid`);
const mockRounds = (dir) => {
  try { return readdirSync(dir).filter((f) => /^run_it\d+_optimiser\.star$/.test(f)).sort(); } catch { return []; }
};
const logStat = (needle) => {
  try {
    const lines = readFileSync(DEV_LOG, "utf8").split("\n").filter((l) => l.includes(needle));
    return { count: lines.length, last: lines[lines.length - 1] ?? "" };
  } catch { return { count: 0, last: "" }; }
};
const finalizeLineCount = () => logStat(FINALIZE_LINE).count;
const padDirOf = (mockDir) => path.join(mockDir, PAD_DIR_NAME);
const padCount = (mockDir) => {
  try { return readdirSync(padDirOf(mockDir)).length; } catch { return 0; }
};
const duReal = (p) => {
  /* -b implies --apparent-size (coreutils) — real usage needs -B1 */
  try { return Number(sh(`du -sB1 ${shQ(p)} 2>/dev/null | cut -f1`).split("\n").pop()) || 0; } catch { return 0; }
};
const duApparent = (p) => {
  try { return Number(sh(`du -sb --apparent-size ${shQ(p)} 2>/dev/null | cut -f1`).split("\n").pop()) || 0; } catch { return 0; }
};
/* the lever's own cut: pads [from, to] as SPARSE 600 MB files — one
 * truncate invocation per xargs batch, the disk never feels it */
const inflateSparse = (mockDir, from, to) => {
  const padDir = padDirOf(mockDir);
  mkdirSync(padDir, { recursive: true });
  sh(`cd ${shQ(padDir)} && seq -f "f%05.0f.pad" ${from} ${to} | xargs truncate -s ${PAD_SIZE}`);
};
const localMirrorCount = (workdir) => {
  try { return readdirSync(workdir).filter((f) => !f.startsWith(".")).length; } catch { return 0; }
};
const shQ = (p) => `'${p.replace(/'/g, `'\\''`)}'`;
const readManifest = (workdir) => {
  try { return JSON.parse(readFileSync(path.join(workdir, ".cf-remote-manifest.json"), "utf8")); } catch { return null; }
};
const writeReceipt = (obj) => {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
};
const writeState = (obj) => {
  mkdirSync(path.dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(obj, null, 2));
};
const readState = () => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } };

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";

/* ============================ prep ======================================== */
console.log(`== t944 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE SETUP + THE LEVER: the mint re-rides, the bind, the run, the
 * sparse gate, the 20,400-pad inflation — the world grown past the cap
 * while the finalize leg is still a minute away. */
console.log("== stage 1: the mint, the bind, the run, the sparse inflation ==");
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ resetAt: new Date().toISOString() }, null, 2));

/* the standing law: a crashed arc leaves its litter — sweep the orphan
 * asides HERE ONLY (this arc's lever lives INSIDE the class2d workdir
 * and dies with the remove; the asides are prior arcs') */
try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/class2d_*.t939-aside ${MOCK_PROJECTS}/${projId}/class2d_*.t940-aside ${MOCK_PROJECTS}/${projId}/*.swept.* 2>/dev/null`); } catch {}

let c2d = findName(NAME_CLASS2D);
if (c2d) {
  const healBinding = manifestBinding();
  try { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: healBinding }); } catch {}
  try { sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch {}
  c2d = findName(NAME_CLASS2D);
  if (c2d) {
    console.log("  (self-heal: the remove refused — the manual downstream-first delete rides)");
    for (const nm of [NAME_CLASS2D, "2D Class Selection", "t929 select child", "t916 select witness", "Automated Picking 1 (t926)"]) {
      const j = findName(nm);
      if (j) { try { api("DELETE", `/api/jobs/${j.id}`); } catch {} }
    }
    for (const j of jobs().filter((x) => ["autopick", "extract", "class2d", "select2d"].includes(x.type)).reverse()) {
      try { api("DELETE", `/api/jobs/${j.id}`); } catch {}
    }
    try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/class2d_* ${MOCK_PROJECTS}/${projId}/extract_* ${MOCK_PROJECTS}/${projId}/autopick_* ${ROOT}/data/relion/${projId}/class2d_* ${ROOT}/data/relion/${projId}/extract_* ${ROOT}/data/relion/${projId}/autopick_*`); } catch {}
    c2d = findName(NAME_CLASS2D);
  }
}
ok("S1 the world starts class2d-free (the self-heal)", !c2d);
let mintOut = "(never ran)";
try { mintOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs mint 2>&1`); } catch (e) { mintOut = String(e); }
ok("S1 the t916 mint GREEN", /mint GREEN — \d+ ok, 0 fail/.test(mintOut), (mintOut.match(/== mint .*/) ?? ["?"])[0]);
c2d = findName(NAME_CLASS2D);
ok("S1 the class2d witness completed (the mint's own run)", c2d?.status === "completed", c2d?.status);
if (!c2d || c2d.status !== "completed") { console.log("FATAL: no class2d witness — aborting"); writeReceipt({ fatal: "no class2d" }); process.exit(2); }

const standingConn = connections().find((x) => x.name === "Mock Cluster");
ok("S1 the standing wire present (the finalize leg's precondition — the wire answers all arc long)", !!standingConn?.id, standingConn?.id ?? "none");
if (!standingConn?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
ok("S1 the wire's caps read (the lever's arithmetic hangs off them)", standingConn?.maxFileMb === 512 && standingConn?.keyFileMb === 16 && standingConn?.syncPolicy === "key-files", `maxFileMb=${standingConn?.maxFileMb} keyFileMb=${standingConn?.keyFileMb} policy=${standingConn?.syncPolicy}`);

const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: standingConn.id });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok(`S1 the class2d's iterations pinned at ${ITERS} through the PATCH door`, !!patchP.job?.id && String(patchP.job?.params?.iterations) === String(ITERS), JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the dev log's finalize-line baseline — captured AFTER the mint's own
 * run (the mint's finalize already spoke; only the ARC's line counts) */
const LOG_BASE = { finalize: finalizeLineCount() };
ok("S1 the dev log baseline captured (post-mint, pre-arc)", true, `finalizeLines=${LOG_BASE.finalize}`);

/* the discipline holds (the park keeps the GET cadence out of the arc's
 * timing on principle) */
sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S1 dispatch attempt ${attempt} --`);
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  ok(`S1 attempt ${attempt} the bare POST accepted (the binding's lane)`, true, "");
  let fresh = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      const f = (() => {
        try {
          return readdirSync(SLURM_DIR)
            .filter((x) => /^job-\d+\.pid$/.test(x))
            .map((x) => { const full = path.join(SLURM_DIR, x); return { file: x, id: readFileSync(full, "utf8").trim().split(/\s+/)[0], mtime: statSync(full).mtimeMs }; })
            .filter((x) => Date.now() - x.mtime < 120_000)
            .sort((a, b) => b.mtime - a.mtime)[0];
        } catch { return null; }
      })();
      if (f?.id) { fresh = f; break; }
      await sleep(300);
    }
  }
  if (!fresh?.id) { ok(`S1 attempt ${attempt} the launcher pid file found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid file read (slurm ${fresh.id})`, true, "");
  let depth = 0;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 45_000) {
      depth = mockRounds(c2dMockDir).length;
      if (depth >= 1) break;
      await sleep(300);
    }
  }
  if (depth < 1) { ok(`S1 attempt ${attempt} run_it001 landed before the lever`, false, "no rounds in 45s"); continue; }
  ok(`S1 attempt ${attempt} run_it001 landed (the run mid-flight before the lever)`, true, "");
  arc = { slurmId: fresh.id, attempt, dispatchedAt: Date.now() };
  break;
}
if (!arc) { console.log("FATAL: the dispatch never landed — aborting"); writeReceipt({ fatal: "dispatch never landed" }); process.exit(2); }

/* THE SPARSE GATE — 200 pads first, the holes verified: a filesystem
 * that does not honor sparse files would turn the full lever into
 * 12.8 TB of real zeros (FATAL before the disk ever feels it) */
const tLever = Date.now();
inflateSparse(c2dMockDir, 1, 200);
const gateReal = duReal(padDirOf(c2dMockDir));
ok("S1 THE SPARSE GATE — 200 pads, the holes verified (real bytes per pad < 1 MB — the FS honors holes)", gateReal > 0 && gateReal < 200 * 1024 * 1024, `200 pads real=${(gateReal / 1024 / 1024).toFixed(1)} MB`);
if (gateReal <= 0 || gateReal >= 200 * 1024 * 1024) {
  console.log("FATAL: the filesystem does not honor sparse files — the full lever would eat the disk");
  writeReceipt({ fatal: "no sparse support", gateReal });
  process.exit(2);
}

/* THE INFLATION LEVER — the world grown PAST THE CAP: 20,200 more pads,
 * the whole family in ONE subdir (deep — invisible to the rounds
 * census, irrelevant to the launcher, enumerated only by the find's
 * deep band). Apparent 600 MB each: the planner's key-cap skip refuses
 * every pull; the ledger still names them. */
inflateSparse(c2dMockDir, 201, PAD_COUNT);
const padLanded = padCount(c2dMockDir);
ok(`S1 THE INFLATION LEVER THROWN — ${PAD_COUNT} sparse pads in ${PAD_DIR_NAME}/ (the world past the ${CAP_EXPECTED}-file cap)`, padLanded === PAD_COUNT, `${padLanded}/${PAD_COUNT} in ${((Date.now() - tLever) / 1000).toFixed(1)}s`);
const padApparent = duApparent(padDirOf(c2dMockDir));
const padReal = duReal(padDirOf(c2dMockDir));
ok("S1 THE SPARSE HONESTY — the lever's whole mass is apparent (≈12.8 TB claimed, < 0.5 GB real)", padApparent > 1e13 && padReal < 5e8, `apparent=${(padApparent / 1024 / 1024 / 1024).toFixed(0)} GB real=${(padReal / 1024 / 1024).toFixed(1)} MB`);

/* the natural lane's hygiene: the rounds census untouched, NO question
 * open (no lost handle — the run finishes on its own), the finalize
 * line still at baseline */
const roundsAfterLever = mockRounds(c2dMockDir).length;
ok("S1 the pad is invisible to the rounds census (deep files, root rounds untouched)", roundsAfterLever >= 1, `rounds=${roundsAfterLever}`);
const recLever = readRecord(c2d.id);
ok("S1 NO QUESTION OPEN at lever time (the natural lane carries none — no lost handle, no missed stop)", recLever?.remote?.accountingPending === undefined && recLever?.remote?.outputsLedgerPending === undefined, `accounting=${JSON.stringify(recLever?.remote?.accountingPending ?? null)} ledger=${JSON.stringify(recLever?.remote?.outputsLedgerPending ?? null)}`);
ok("S1 the dev log's finalize line STILL AT BASELINE (the arc's own finalize has not spoken)", finalizeLineCount() === LOG_BASE.finalize, `${finalizeLineCount()}/${LOG_BASE.finalize}`);

writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, standingConnId: standingConn.id, logBase: LOG_BASE, padCountAtLever: padLanded, padSize: PAD_SIZE, ...arc });
writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, lever: "sparse-20400x600MB", padCount: padLanded, padRealMB: Number((padReal / 1024 / 1024).toFixed(1)), leverSeconds: Number(((Date.now() - tLever) / 1000).toFixed(1)) } });
console.log(`== t944 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * THE FINALIZE'S OWN TRUNCATED LANDING: the run completes naturally,
 * the sync-back's find enumerates ~21k lines through the cap+1 head,
 * the ledger lands truncated:true at exactly 20,000 (door first), the
 * pads key-cap-skipped (zero pulls), the natural tree comes home past
 * the walk's 300 cap, the record speaks the finalize receipt's capped
 * sentence, the outputs route answers 600 files + the BOTH-facts note. */
console.log("== stage 2: the run completes, the capped ledger lands, the both-facts note speaks ==");
const st2 = readState();
const c2dId = st2.c2dId;
const SLURM_ID = String(st2.slurmId ?? "");
if (!c2dId || !st2.padCountAtLever) { console.log("FATAL(stage2): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);

/* THE RUN COMPLETES NORMALLY — poll the row (the finalize chain runs
 * inside the flip: the sync fields stamp before the row turns) */
let done = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 300_000) {
    try { jobs(); } catch {}
    const j = jobs().find((x) => x.id === c2dId);
    if (j?.status === "completed") { done = j; break; }
    if (j?.status === "failed") { console.log("FATAL(stage2): the run FAILED — the natural lane broke"); writeReceipt({ fatal: "run failed", stage2: { pass, fail }, result: String(j?.result ?? "").slice(0, 200) }); process.exit(2); }
    await sleep(2500);
  }
}
ok("S2 THE RUN COMPLETED NORMALLY (the natural lane — no stop, no heal, the finalize leg's own world)", !!done, done ? `progress=${done.progress}` : "never completed in 300s");
if (!done) { console.log("FATAL(stage2): the run never completed — aborting"); writeReceipt({ fatal: "never completed", stage2: { pass, fail } }); process.exit(2); }

/* the journal row landed (the launcher's own verdict) */
const journalRows = (() => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter((l) => l.startsWith(`${SLURM_ID}|`)); } catch { return []; }
})();
ok("S2 THE JOURNAL ROW LANDED (the launcher's own COMPLETED verdict — the ledger knew first)", journalRows.length > 0 && /COMPLETED/.test(journalRows[journalRows.length - 1] ?? ""), journalRows.join(" ; ").slice(0, 100) || "journal silent");

/* the record — the finalize receipt's own words (FIRST LIVE FIRE of the
 * sync-back leg's capped sentence) */
const rec = readRecord(c2dId);
ok("S2 the record's exit honest (exitCode 0 — the wrapper's own accounting)", rec?.exitCode === 0, `exit=${JSON.stringify(rec?.exitCode ?? null)}`);
ok("S2 THE FINALIZE RECEIPT'S CAPPED SENTENCE VERBATIM ('the outputs ledger was capped at 20000 files' — the sync-back leg's own confession, never spoken before this arc)", String(rec?.result ?? "").includes(FINALIZE_CAPPED_HEAD), String(rec?.result ?? "none").slice(0, 170));
ok("S2 the capped sentence names the cure (the door family pinned first + the cap tunable — the receipt's whole ethic)", String(rec?.result ?? "").includes(FINALIZE_CAPPED_TAIL), String(rec?.result ?? "").slice(-140));
ok("S2 THE PADS' SKIP SEGMENT VERBATIM ('bulky file(s) stayed on the cluster (key-files policy)' — the planner's own class for the lever)", String(rec?.result ?? "").includes(SKIP_SEGMENT), "");
ok("S2 THE PAD'S OWN SKIP WORD ('600 MB > 16 MB key-file cap' — the sparse lever's arithmetic spoken by the planner)", String(rec?.result ?? "").includes(PAD_SKIP_WORD), String(rec?.result ?? "").slice(0, 120));
ok("S2 the row completed with the receipt riding (status + progress + the sync note suffix)", done?.status === "completed" && done?.progress === 100 && String(done?.result ?? "").includes(FINALIZE_CAPPED_HEAD), `${done?.status}/${done?.progress}`);
ok("S2 NO QUESTION EVER OPENED (accountingPending AND outputsLedgerPending both absent — the natural lane's whole discipline)", rec?.remote?.accountingPending === undefined && rec?.remote?.outputsLedgerPending === undefined, `accounting=${JSON.stringify(rec?.remote?.accountingPending ?? null)} ledger=${JSON.stringify(rec?.remote?.outputsLedgerPending ?? null)}`);

/* the sync fields — the leg's own wall-clock and its two counts */
ok("S2 THE NATURAL TREE CAME HOME (syncedFiles > 300 — past the walk's own cap, the local half of the note made REAL)", (rec?.remote?.syncedFiles ?? 0) > 300, `syncedFiles=${rec?.remote?.syncedFiles ?? "none"}`);
ok("S2 THE SKIPPED LIST CAPPED AT 50 (the record's own hygiene — 20,400 verdicts ride the ledger, the record keeps the head)", Array.isArray(rec?.remote?.skippedFiles) && rec.remote.skippedFiles.length > 0 && rec.remote.skippedFiles.length <= 50, `skippedFiles=${rec?.remote?.skippedFiles?.length ?? "none"}`);
ok("S2 THE SKIP LIST IS THE PAD CLASS PURE (every kept verdict a pad line with the key-cap word — the planner's own class for the lever; the first line is readdir's business, not ours)", Array.isArray(rec?.remote?.skippedFiles) && rec.remote.skippedFiles.length > 0 && rec.remote.skippedFiles.every((s) => String(s).startsWith(`${PAD_DIR_NAME}/`) && String(s).includes(PAD_SKIP_WORD)), `n=${rec?.remote?.skippedFiles?.length ?? "none"} first=${String(rec?.remote?.skippedFiles?.[0] ?? "none").slice(0, 90)}`);
ok("S2 the sync's wall-clock aboard (syncMs — the t269 ledger's second entry)", (rec?.remote?.syncMs ?? 0) > 0, `syncMs=${rec?.remote?.syncMs ?? "none"}`);
ok("S2 THE RECORD'S REMOTE NOTE carries the whole receipt (skip segment + capped sentence, one breath)", String(rec?.remote?.note ?? "").includes(SKIP_SEGMENT) && String(rec?.remote?.note ?? "").includes(FINALIZE_CAPPED_HEAD) && String(rec?.remote?.note ?? "").endsWith(FINALIZE_CAPPED_TAIL), String(rec?.remote?.note ?? "none").slice(-120));

/* the dev log's finalize line (+1, named for this job; the skipped
 * count is the CAP's own arithmetic: synced + skipped = the cap — the
 * pads cut by the ledger never reach the planner, and the log line
 * testifies the sum) */
{
  const ls = logStat(FINALIZE_LINE);
  ok("S2 THE DEV LOG'S FINALIZE LINE (+1, named for this job)", ls.count === (st2.logBase?.finalize ?? 0) + 1 && ls.last.includes(`exit 0 (`), ls.last.slice(-160));
  const synced = rec?.remote?.syncedFiles ?? 0;
  ok(`S2 THE LOG LINE'S ARITHMETIC IS THE CAP'S OWN (synced ${synced} + skipped = ${CAP_EXPECTED} — the pads the ledger cut never reached the planner)`, ls.last.includes(`${CAP_EXPECTED - synced} skipped)`), ls.last.slice(-120));
}

/* the manifest itself — the finalize leg's own canary testimony */
const man = readManifest(rec?.workdir ?? "");
ok("S2 THE MANIFEST EXISTS at the run's local workdir (written BEFORE the pulls — the t289 ledger-first doctrine)", !!man, String(rec?.workdir ?? "no workdir").slice(-46));
ok("S2 THE CANARY FIRED — the ledger carries truncated:true (the t464 honesty riding the REAL finalize)", man?.truncated === true, `truncated=${JSON.stringify(man?.truncated ?? null)}`);
ok(`S2 THE CAP KEPT EXACTLY ${CAP_EXPECTED} ENTRIES (the server's own REMOTE_MANIFEST_MAX — head took cap+1, parser kept the cap)`, (man?.files?.length ?? 0) === CAP_EXPECTED, `${man?.files?.length ?? 0}/${CAP_EXPECTED}`);
{
  const paths = new Set((man?.files ?? []).map((f) => f.path));
  const door = ["run_data.star", "run_model.star", "run_optimiser.star"];
  ok("S2 THE DOOR FAMILY LEADS THE CAPPED LEDGER (band a first — the cap spends itself on the files every route reads)", door.every((d) => paths.has(d)), door.map((d) => `${d}:${paths.has(d)}`).join(" "));
  ok("S2 THE ROUND HISTORY ENUMERATED (run_it001_data.star rides band b — the spine before the deep)", paths.has("run_it001_data.star"), `run_it001_data.star:${paths.has("run_it001_data.star")}`);
  const padKept = [...paths].filter((p) => p.startsWith(`${PAD_DIR_NAME}/`)).length;
  ok("S2 THE PAD FAMILY ENUMERATED (the cut fell INSIDE the pad band — the mass judged, never a guessed line)", paths.has(`${PAD_DIR_NAME}/f00001.pad`) && padKept > 15_000 && padKept < PAD_COUNT, `f00001:${paths.has(`${PAD_DIR_NAME}/f00001.pad`)} kept=${padKept}/${PAD_COUNT}`);
  const padEntry = (man?.files ?? []).find((f) => f.path === `${PAD_DIR_NAME}/f00001.pad`);
  ok("S2 THE LEDGER SPEAKS THE SPARSE SIZE (600 MB apparent — the find's %s, the planner's own arithmetic input)", padEntry?.size === PAD_SIZE, `size=${padEntry?.size ?? "none"}`);
  ok("S2 THE LEDGER ITSELF NEVER LISTED (the .cf-* exclusion holds at 20k scale)", ![...paths].some((p) => p.startsWith(".cf-")), "");
}

/* the local mirror — the walk's own cap made REAL */
const mirrorCount = localMirrorCount(rec?.workdir ?? "");
ok("S2 THE LOCAL MIRROR HOLDS MORE THAN THE WALK'S CAP (the local half of the note is a REAL world, not a vacuous flag)", mirrorCount > 300, `mirror=${mirrorCount} non-dot files (the walk stops at 300)`);
ok("S2 THE DOOR FAMILY IS HOME (run_data.star pulled — the finalize's own output)", existsSync(path.join(rec?.workdir ?? "", "run_data.star")), "");

/* the outputs route — the BOTH-facts sentence byte-exact */
{
  const outP = apiJson(`/api/jobs/${c2dId}/outputs`);
  ok("S2 THE OUTPUTS ROUTE ANSWERS (the Files tab's well, at the finalize-capped world)", outP?.status === "ok" && Array.isArray(outP?.files), `status=${outP?.status ?? "none"} files=${outP?.files?.length ?? "none"}`);
  const expectedNote = `Listing truncated at ${outP?.files?.length ?? "?"} files ${NOTE_BOTH_HEAD} ${NOTE_BOTH_TAIL}`;
  ok("S2 THE BOTH-FACTS NOTE BYTE-EXACT ('Listing truncated at N files — and the ledger itself was capped: the cluster holds more…' — the t464 遗留⑤'s own words, local + ledger in one breath, first live fire)", outP?.note === expectedNote, `${String(outP?.note ?? "none").slice(0, 150)}`);
  ok("S2 THE TWO-CAPS ARITHMETIC (300 local walk + 300 remote cards = 600 — both display caps hit at once)", (outP?.files?.length ?? 0) === 600, `files=${outP?.files?.length ?? "none"}`);
  const padCard = (outP?.files ?? []).find((f) => String(f?.path ?? "").startsWith(`${PAD_DIR_NAME}/`) && f?.remote === true && f?.size === PAD_SIZE);
  const remoteCards = (outP?.files ?? []).filter((f) => f?.remote === true);
  ok("S2 THE DISPLAY'S BUDGET SPENDS ITSELF BY BAND (300 remote cards, ALL root history — the deep band rides the LEDGER but the display's card budget ends before it: the find's own door→spine→front→deep priority mirrored by the display; the t942 world showed pads only because its mirror was empty and nothing local competed)", padCard === undefined && remoteCards.length === 300 && remoteCards.every((f) => !String(f.path).startsWith(`${PAD_DIR_NAME}/`)), `remote=${remoteCards.length} deep-in-display=${padCard !== undefined} allRoot=${remoteCards.every((f) => !String(f.path).includes("/"))}`);
  const starCard = (outP?.files ?? []).find((f) => f?.path === "run_data.star");
  ok("S2 THE DOOR FAMILY'S CARD IS LOCAL (came home — the sync-back's own take, not a remote card)", !!starCard && starCard?.remote !== true, `local=${!!starCard && starCard?.remote !== true}`);
}

writeState({ ...st2, completedDone: true, manifestFiles: man?.files?.length ?? 0, mirrorCount });
writeReceipt({ stage2: { pass, fail, syncedFiles: rec?.remote?.syncedFiles ?? null, skippedFirst: String(rec?.remote?.skippedFiles?.[0] ?? ""), manifestTruncated: man?.truncated === true, manifestFiles: man?.files?.length ?? 0, mirrorCount, noteByteExact: true } });
console.log(`== t944 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE FINALIZE-CAPPED DOOR (a pulled star deleted host-side, fetched
 * home through the exact-entry ledger), the completed face speaking the
 * capped receipt, THE CURE'S BROWSER PIN (the Files tab's
 * data-listing-note + the Results view's inline note), the restore. */
console.log("== stage 3: the finalize-capped door, the honest faces, the standing leave ==");
const st3 = readState();
const c2dId = st3.c2dId;
if (!c2dId || !st3.completedDone) { console.log("FATAL(stage3): no state or stage2 has not passed — run stages 1–2 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);

const rec3 = readRecord(c2dId);
ok("S3 the record's receipt still stands", rec3?.exitCode === 0 && String(rec3?.result ?? "").includes(FINALIZE_CAPPED_HEAD), String(rec3?.result ?? "none").slice(0, 110));

/* THE FINALIZE-CAPPED DOOR — the manifest the REAL sync-back wrote
 * names 20,000 cluster files; the exact-entry door serves them. The
 * probe is a star the sync-back PULLED home: deleted host-side first
 * (the mirror's own pruning), then fetched — the door's lazy leg, live,
 * at the second cap face (t942 proved the door at the question leg's
 * capped ledger; this is the finalize leg's own). */
const man3 = readManifest(rec3?.workdir ?? "");
ok("S3 THE CAPPED MANIFEST RE-READ (truncated:true, the cap's own count — the door's authorization source)", man3?.truncated === true && (man3?.files?.length ?? 0) === CAP_EXPECTED, `truncated=${JSON.stringify(man3?.truncated ?? null)} files=${man3?.files?.length ?? 0}`);
const probeRel = "run_it001_sampling.star";
{
  const probeHome0 = existsSync(path.join(rec3?.workdir ?? "", probeRel));
  ok("S3 the door probe pulled home by the sync-back (the ledger named it, the planner took it)", probeHome0, "");
  if (probeHome0) {
    rmSync(path.join(rec3?.workdir ?? "", probeRel), { force: true });
    ok("S3 the probe deleted host-side (the mirror pruned — the door's lazy leg is the only way home)", !existsSync(path.join(rec3?.workdir ?? "", probeRel)), "");
    const syncP = api("POST", `/api/jobs/${c2dId}/outputs/sync`, { paths: [probeRel] });
    ok("S3 THE FINALIZE-CAPPED DOOR OPENS (the exact-entry authorization serves the pruned file)", syncP?.ok === true && Array.isArray(syncP?.results) && syncP.results.length === 1 && syncP.results[0]?.ok === true && (syncP.results[0]?.bytes ?? 0) > 0, JSON.stringify(syncP?.results ?? syncP).slice(0, 140));
    ok(`S3 THE DOOR'S TOTAL IS THE CAP ITSELF (total=${CAP_EXPECTED} — the finalize-capped ledger IS the authorization, whole)`, syncP?.total === CAP_EXPECTED, `total=${syncP?.total ?? "none"} remaining=${syncP?.remaining ?? "none"}`);
    ok("S3 THE REMAINING HONEST (the pad family still remote — the remaining count names the capped world)", typeof syncP?.remaining === "number" && syncP.remaining > 15_000 && syncP.remaining < syncP?.total, `remaining=${syncP?.remaining ?? "none"} / total=${syncP?.total ?? "none"}`);
    ok("S3 THE PROBE HOME AGAIN (fetched through the capped door — the cap never killed the door at the second face)", existsSync(path.join(rec3?.workdir ?? "", probeRel)), "");
    writeReceipt({ stage3Door: { shape: "finalize-capped-200", probe: probeRel, total: syncP?.total ?? null, remaining: syncP?.remaining ?? null } });
  }
}

/* the resurrect ride-out: the OOM killer has taken the dev server at
 * exactly this arc-weight before (the t941 law) — and this arc's own
 * first ride proved the DIALOG decays the same way mid-inspector (the
 * second ride's diagnostic: dialog=false between clicks). The patience
 * helpers live ABOVE the browser pins now: the face and the note pins
 * re-open and re-ask; the pins judge the WORLD, not the transport. */
const serverUp = async (label) => {
  for (let i = 0; i < 30; i++) {
    try {
      const probe = sh(`curl -s -o /dev/null -w "%{http_code}" -H "Origin: ${BASE}" "${BASE}/api/jobs" --max-time 8`);
      if (probe === "200") { if (i > 0) console.log(`  (server answered after ${i * 3}s — ${label})`); return true; }
    } catch {}
    await sleep(3000);
  }
  return false;
};
const retryApi = async (label, fn) => {
  for (let i = 0; i < 3; i++) {
    await serverUp(label);
    const r = fn();
    if (r && r.ok === true) return r;
    await sleep(4000);
  }
  return fn();
};
const ensureDialog = async () => {
  const st = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ open: !!d }); })()`);
  if (st?.open === true) return true;
  /* a wedged renderer reads as null — navigate fresh before re-opening
   * (the CDP-hang recovery this arc's third ride taught) */
  if (st === null || st === "null") {
    try { sh(`${AB} open ${BASE}/`); } catch {}
    await sleep(2500);
  }
  await serverUp("the dialog's return");
  const reopened = await openInspectorHard(NAME_CLASS2D, 8);
  return String(reopened).startsWith("open@try");
};

/* THE COMPLETED FACE: the warm-up reload law, then the climb */
let carded = null;
for (let i = 0; i < 3 && !carded; i++) {
  sh(`${AB} open ${BASE}/`);
  carded = await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 40, 600);
  await sleep(800);
}
ok("S3 the workspace renders (the cards on the page — the warm-up reload law)", !!carded && carded.cards >= 3, `cards=${carded?.cards ?? "none"}`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 40, 600);
await sleep(1500);
await settleCensus();
const faceDiag = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, hasC2d: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent||'').includes('${NAME_CLASS2D}')) })`);
ok("S3 the completed card is on the page before the climb", faceDiag?.hasC2d === true, JSON.stringify(faceDiag));
const insp3 = await openInspectorHard(NAME_CLASS2D, 8);
ok("S3 the COMPLETED job's inspector opens", String(insp3).startsWith("open@try"), String(insp3));
await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`,
  (v) => v.tabs?.includes("Overview") === true, 12, 600,
);
const ov3 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
ok("S3 the Overview climb clicked", String(ov3).startsWith("clicked@"), String(ov3));
let face3 = null;
for (let round = 0; round < 3 && !face3; round++) {
  if (!(await ensureDialog())) { console.log(`  (face round ${round + 1}: the dialog would not return)`); continue; }
  face3 = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ capped: t.includes('${FINALIZE_CAPPED_HEAD}'), completed: t.includes('Completed'), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`,
    (v) => v.capped === true && v.completed === true, 10, 600,
  );
  if (!face3) console.log(`  (face round ${round + 1}: the face never spoke — re-opening)`);
}
ok("S3 THE COMPLETED FACE SPEAKS THE FINALIZE RECEIPT (the sync-back leg's capped sentence visible on the card — the arc's whole knowledge, user-visible)", face3?.capped === true && face3?.completed === true, `capped=${face3?.capped} completed=${face3?.completed}`);
ok("S3 THE COMPLETED FACE HAS NO STOP VERB (Re-run stands where Stop stood)", face3?.stopBtn === false && face3?.rerun === true, `stop=${face3?.stopBtn} rerun=${face3?.rerun}`);

/* THE CURE'S BROWSER PIN — the Files tab speaks the BOTH-facts sentence
 * in a world with 600 cards (the arc's own product change, witnessed in
 * the surface it was written for). The tab triggers carry COUNT BADGES
 * ("Files99+" — the first ride's NO-ELEMENT lesson): match by prefix,
 * and re-open the inspector if the dialog decayed mid-arc. */
const clickTab = async (label, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('${label}')) ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    const tabList = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ open: !!d, tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`);
    console.log(`  (tab '${label}' try ${i + 1}: ${clicked}; dialog=${tabList?.open} tabs=${JSON.stringify(tabList?.tabs ?? [])})`);
    if (!tabList?.open) {
      const reopened = await openInspectorHard(NAME_CLASS2D, 6);
      console.log(`  (the inspector re-opened: ${reopened})`);
    }
    await sleep(800);
  }
  return "NEVER-CLICKED";
};
const filesTab3 = await clickTab("Files");
ok("S3 the Files tab clicked", String(filesTab3).startsWith("clicked@"), String(filesTab3));
let notePin = null;
for (let round = 0; round < 3 && !notePin; round++) {
  if (!(await ensureDialog())) { console.log(`  (note round ${round + 1}: the dialog would not return)`); continue; }
  if (round > 0) { await clickTab("Files", 2); }
  notePin = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const n = d?.querySelector('[data-listing-note]'); return JSON.stringify({ present: !!n, both: !!n && n.textContent.includes('${NOTE_BOTH_HEAD}') && n.textContent.includes('${NOTE_BOTH_TAIL}'), tableRows: (d?.querySelectorAll('[data-files-table] tbody tr') ?? []).length }); })()`,
    (v) => v.present === true, 10, 700,
  );
  if (!notePin) console.log(`  (note round ${round + 1}: the note never rendered — re-opening)`);
}
ok("S3 THE CURE WITNESSED — the Files tab renders the listing note above the table (data-listing-note; the honesty line the empty state once monopolized)", notePin?.present === true, `present=${notePin?.present}`);
ok("S3 THE NOTE SPEAKS BOTH FACTS IN ONE BREATH (local truncation + capped ledger — the t464 遗留⑤'s own sentence, in the UI)", notePin?.both === true, `both=${notePin?.both}`);
ok("S3 THE TABLE STILL SERVES (file rows under the note — the note never replaced the listing)", (notePin?.tableRows ?? 0) > 0, `rows=${notePin?.tableRows ?? "none"}`);

/* the Results view's inline note (the surface that carried the sentence
 * alone before the cure — still speaking, now with company) */
const resultsTab3 = await clickTab("Results");
ok("S3 the Results tab clicked", String(resultsTab3).startsWith("clicked@"), String(resultsTab3));
let resultsNote3 = null;
for (let round = 0; round < 3 && !resultsNote3; round++) {
  if (!(await ensureDialog())) { console.log(`  (results round ${round + 1}: the dialog would not return)`); continue; }
  if (round > 0) { await clickTab("Results", 2); }
  resultsNote3 = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ note: t.includes('${NOTE_BOTH_TAIL}') }); })()`,
    (v) => v.note === true, 10, 700,
  );
  if (!resultsNote3) console.log(`  (results round ${round + 1}: the inline note never spoke — re-opening)`);
}
ok("S3 THE RESULTS VIEW STILL SPEAKS IT (the header's inline note — both surfaces, one sentence)", resultsNote3?.note === true, `note=${resultsNote3?.note}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* the restore: the manifest-word binding law, the t916 remove (the pads
 * die with the workdir), the standing leave, the seed trio, the
 * doctor */
const mBinding = manifestBinding();
const rebind3 = await retryApi("the rebind", () => api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding }));
ok(`S3 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind3.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
let removeOut = "(never ran)";
for (let i = 0; i < 3; i++) {
  await serverUp("the remove");
  try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
  if (/remove GREEN — \d+ ok, 0 fail/.test(removeOut)) break;
  await sleep(4000);
}
ok("S3 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
/* the litter sweep — the pads die with the class2d_* dirs on BOTH sides;
 * pin the pad dir GONE (the arc's own lever cleaned up) */
try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/class2d_* ${MOCK_PROJECTS}/${projId}/extract_* ${MOCK_PROJECTS}/${projId}/autopick_* ${ROOT}/data/relion/${projId}/class2d_* ${ROOT}/data/relion/${projId}/extract_* ${ROOT}/data/relion/${projId}/autopick_* 2>/dev/null`); } catch {}
ok("S3 THE PADS SWEPT (the inflation's litter died with the workdir — no residue past the arc)", padCount(st3.mockDir) === 0, `pad=${padCount(st3.mockDir)}`);
const unbind3 = await retryApi("the unbind", () => api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null }));
ok("S3 THE STANDING LEAVE — unbound after the ledger is consumed (the t929/t930 law)", unbind3.ok === true, JSON.stringify(unbind3).slice(0, 60));
const connsRestored = connections();
ok(`S3 THE WIRE NEVER MOVED (the registry's standing shape: exactly one Mock Cluster at ${st3.standingConnId})`, connsRestored.length === 1 && connsRestored[0]?.id === st3.standingConnId, `conns=${connsRestored.length} id=${connsRestored[0]?.id ?? "none"}`);
const jobsAfter = jobs();
const edgesAfter = edges();
ok("S3 the world back to the seed trio (3 jobs)", jobsAfter.length === 3, String(jobsAfter.length));
ok("S3 the world holds exactly 2 edges", edgesAfter.length === 2, String(edgesAfter.length));

/* the browser smoke */
sh(`${AB} open ${BASE}/`);
const smoke = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, overX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`,
  (g) => g.cards >= 3, 30,
);
ok("S3 the browser smoke clean (3+ cards, overX 0)", !!smoke && smoke.cards >= 3 && smoke.overX === false, `cards=${smoke?.cards} overX=${smoke?.overX}`);

let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S3 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);
writeReceipt({ stage3: { pass, fail, door: "finalize-capped-200", curePins: { filesTabNote: notePin?.both === true, resultsNote: resultsNote3?.note === true }, restore: "done" } });
console.log(`== t944 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t944 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
