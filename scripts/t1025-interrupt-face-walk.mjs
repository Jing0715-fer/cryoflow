#!/usr/bin/env node
/**
 * t1025 — the INTERRUPTED face's WALK LEG: the vanish ladder's UI face,
 * filmed. Carried three windows (t1022 → t1024), the lead candidate.
 *
 * The t932 ride opened the interrupted face and left through the CONTINUE
 * door; t933 rode the Start-again face at the tombstone; t934 rode the
 * STOP face and its resume. All three left JSON receipts — ZERO PNG films.
 * The interrupted face — the canvas card, the inspector's Log landing with
 * the killed run's last words, the Overview card speaking "Job failed" +
 * the tombstone verbatim, the panel's empty fn_cont scene, the picker's
 * newest round, the Continue confirm's preserved-family speech, the
 * Start-again confirm's wipe + cluster + checkpoint-alternative speech —
 * has never been FILMED through the real browser. This walk films all
 * seven faces and escapes BOTH confirms (the pick never taken — the
 * t1024 film law: zero run fired, zero field churn left standing).
 *
 * stage1  the interrupted precondition: the t916 mint re-rides (the
 *         manifest law), the t300 bind, iterations 2→16 through the PATCH
 *         door, the run POST, run_it001 lands (the resume floor), THE RAW
 *         KILL (the /bin/kill real-binary law, the process group, no
 *         scancel, no accounting row), the rounds-freeze death proof.
 * stage2  the VANISH LADDER, driven by hand: the pre-age honesty spot-check
 *         (~T+90s still running — no false conviction before the 120s
 *         grace), the three-consecutive-VANISHED conviction, THE TOMBSTONE
 *         VERBATIM, the picker answering at the interrupted face.
 * stage3  THE FILM (the walk leg proper — seven faces, seven PNGs):
 *         canvas card → Log landing → Overview tombstone → the empty
 *         fn_cont scene → the picked scene → the Continue confirm → the
 *         Start-again confirm. Every word asserted verbatim. Escape
 *         through both confirms; the fn_cont PATCHed home to "".
 * stage4  the restore: the binding to the manifest's own word, the t916
 *         remove (downstream first, both sides swept), the world back to
 *         the as-found count, the doctor CLEAN.
 *
 *   node scripts/t1025-interrupt-face-walk.mjs stage1|stage2|stage3|stage4|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t1025-interrupt-face-walk.json";
const STATE = path.join(ROOT, "data", "t1025-interrupt-face-walk.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const TOMB = "interrupted remotely (no exit status — node reboot or hard kill; 3 consecutive checks saw no trace of it); re-run resumes from the last synced checkpoint";
const TOMB_HEAD = TOMB.slice(0, 60);
const WIPE_CLUSTER = "on this machine and on the cluster";
const CHECKPOINT_ALT = "To resume from a checkpoint instead";
const CONT_NEEDLE = "picks up from the checkpoint";
const CONT_DESC = "iteration family in this job's run directory is preserved";
const CONT_RIDES = "The chosen path rides as-is:";
const STUB_WORDS = "cryoflow-mock refine";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
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
const film = async (name) => {
  try { sh(`${AB} screenshot shots-qa/${name}`); return true; }
  catch { return false; }
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
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const shApi = (url) => {
  let lastErr = null;
  for (let i = 0; i < 4; i++) {
    try { return sh(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`); }
    catch (e) { lastErr = e; try { execSync("sleep 2", { cwd: ROOT }); } catch {} }
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
const findName = (n) => jobs().find((j) => j.name === n);
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
const panelOpen = async () => poll(
  `(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); const tabs = [...(a?.querySelectorAll('[role="tab"]') ?? [])].map(t => t.textContent?.trim()); return JSON.stringify({ open: tabs.includes('Params') && tabs.includes('Log'), tabs }); })()`,
  (v) => v.open === true, 12, 600,
);
const clickParamsTab = async () => realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`);
const openEditDoor = async (name) => {
  const stable = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Edit parameters'); if (!b) { window.__t1025door = null; return JSON.stringify({ stable: false }); } const r = b.getBoundingClientRect(); const cur = Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width); const prev = window.__t1025door; window.__t1025door = cur; return JSON.stringify({ stable: prev === cur && cur !== null, x: Math.round(r.x), y: Math.round(r.y) }); })()`,
    (v) => v.stable === true, 10, 400,
  );
  await sleep(350);
  const doorClick = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`);
  const swapped = await poll(
    `JSON.stringify({ inspGone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${name}')), aside: [...document.querySelectorAll('aside')].some(x => (x.className || '').includes('border-l')) })`,
    (v) => v.inspGone === true && v.aside === true, 16, 600,
  );
  return { doorClick, swapped };
};
const confirmRead = async (needle) => poll(
  `(() => { const d = [...document.querySelectorAll('[role="alertdialog"]')].find(x => (x.textContent || '').includes(${JSON.stringify(needle)})); const t = d?.textContent || ''; return JSON.stringify({ open: !!d, title: d?.querySelector('h2')?.textContent?.trim() ?? null, text: t }); })()`,
  (v) => v.open === true, 12, 600,
);
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}
const writeState = (obj) => {
  mkdirSync(path.dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(obj, null, 2));
};
const readState = () => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } };
const mockRounds = (dir) => {
  try { return readdirSync(dir).filter((f) => /^run_it\d+_optimiser\.star$/.test(f)).sort(); } catch { return []; }
};
const slurmPids = () => {
  try {
    return readdirSync(SLURM_DIR)
      .filter((f) => /^job-\d+\.pid$/.test(f))
      .map((f) => {
        const full = path.join(SLURM_DIR, f);
        const body = readFileSync(full, "utf8").trim().split(/\s+/);
        return { file: f, id: body[0], pid: Number(body[1]), mtime: statSync(full).mtimeMs };
      });
  } catch { return []; }
};
const accountingRows = () => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter(Boolean); } catch { return []; }
};

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";
const RUN_S4 = STAGE === "main" || STAGE === "stage4";

/* =========================== prep ======================================== */
console.log(`== t1025 prep (stage ${STAGE}): the world read, the seed trio pinned ==`);
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(-8));
const worldBefore = jobs().length;
ok("prep the as-found world count pinned", worldBefore >= 20, `${worldBefore} jobs`);
/* the AS-FOUND baseline is the manifest's own preJobs (the mint's pre-state
 * is the restore's law — the chain may stand from an earlier ride this
 * window, so the API count alone is not the as-found) */
const manifestPreJobs = (() => { try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).preJobs ?? null; } catch { return null; } })();
const baseline = manifestPreJobs ?? worldBefore;
ok("prep the baseline pinned (the manifest's preJobs, else the live count)", Number.isFinite(baseline), `baseline=${baseline} live=${worldBefore} m.preJobs=${manifestPreJobs}`);
const projId = apiJson("/api/projects").projects?.[0]?.id ?? null;
ok("prep the canonical project resolved", !!projId, projId ?? "none");

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * the mint, the bind, the long re-run, THE KILL between rounds */
console.log("== stage 1: the mint re-rides, the bind, iterations=16, THE RAW KILL ==");
let c2d = findName(NAME_CLASS2D);
let mintOut = "(already stood — the verify verb is the receipt)";
if (c2d && c2d.status === "completed") {
  /* the mint ALREADY STANDS (this window's earlier ride laid the chain and
   * wrote the manifest) — re-riding the mint would tear it down for
   * nothing; the verify verb is the receipt */
  let verifyOut = "(never ran)";
  try { verifyOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs verify 2>&1`); } catch (e) { verifyOut = String(e); }
  ok("S1 the standing mint VERIFIED (the manifest's own claims)", /verify GREEN/.test(verifyOut), (verifyOut.match(/== verify [^\n]*/) ?? ["?"])[0]);
} else {
  if (c2d) {
    /* the self-heal: the t916 remove first (the manifest's own law) */
    try { sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch {}
    c2d = findName(NAME_CLASS2D);
    if (c2d) {
      console.log("  (self-heal: the remove refused — the manual downstream-first delete rides)");
      for (const nm of [NAME_CLASS2D, "2D Class Selection", "t929 select child", "t916 select witness", "Automated Picking 1 (t926)"]) {
        const j = findName(nm);
        if (j) { try { api("DELETE", `/api/jobs/${j.id}`); } catch {} }
      }
      for (const j of jobs().filter((x) => ["autopick", "extract", "class2d", "select2d"].includes(x.type) && (x.name ?? "").includes("t916")).reverse()) {
        try { api("DELETE", `/api/jobs/${j.id}`); } catch {}
      }
      try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/t916* ${ROOT}/data/relion/${projId}/t916*`); } catch {}
      c2d = findName(NAME_CLASS2D);
    }
  }
  ok("S1 the world starts t916-class2d-free (the self-heal)", !c2d);
  try { mintOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs mint 2>&1`); } catch (e) { mintOut = String(e); }
  ok("S1 the t916 mint GREEN", /mint GREEN — \d+ ok, 0 fail/.test(mintOut), (mintOut.match(/== mint .*/) ?? ["?"])[0]);
}
c2d = findName(NAME_CLASS2D);
ok("S1 the class2d witness completed (the mint's own run)", c2d?.status === "completed", c2d?.status);
if (!c2d || c2d.status !== "completed") { console.log("FATAL: no class2d witness — aborting"); writeReceipt({ fatal: "no class2d" }); process.exit(2); }

/* t300 — the binding door: bind AFTER the mint (the t933 shape — the
 * manifest records the mint-time binding; the restore reads ITS word). */
const connsP = apiJson("/api/remote/connections").connections ?? [];
const connP = connsP.find((c) => c.name === "Mock Cluster");
ok("S1 the Mock Cluster connection resolved", !!connP?.id, connP?.id?.slice(0, 14));
if (!connP?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: connP.id });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

/* the LONG re-run: iterations 2 → 16 (the stub sleeps 0.9s/round — a ~14s
 * window after it001 the kill can land inside). The PATCH door merges. */
const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: 16 } });
ok("S1 the class2d's iterations raised to 16 through the PATCH door", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "16", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

let killed = null;
for (let attempt = 1; attempt <= 3 && !killed; attempt++) {
  console.log(`-- S1 kill attempt ${attempt} --`);
  const before = accountingRows().length;
  {
    let busy = jobs().find((x) => x.id === c2d.id)?.status === "running";
    const tb = Date.now();
    while (busy && Date.now() - tb < 150_000) {
      await sleep(3000);
      const stb = jobs().find((x) => x.id === c2d.id)?.status;
      if (stb !== "running") busy = false;
    }
    if (busy) { ok(`S1 attempt ${attempt} the row left running before the POST`, false, "still running after 150s"); continue; }
  }
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  ok(`S1 attempt ${attempt} the bare POST accepted (the binding's lane)`, true, "");
  let firstRound = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 45_000) {
    if (existsSync(path.join(c2dMockDir, "run_it001_optimiser.star"))) { firstRound = true; break; }
    await sleep(300);
  }
  if (!firstRound) { ok(`S1 attempt ${attempt} run_it001 landed before the kill`, false, "no first round in 45s"); continue; }
  ok(`S1 attempt ${attempt} run_it001_optimiser.star landed (the resume door's floor)`, true, "");
  const fresh = slurmPids().filter((p) => Date.now() - p.mtime < 120_000).sort((a, b) => b.mtime - a.mtime)[0];
  if (!fresh?.pid) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  let pidAlive = true;
  try { execFileSync("/bin/kill", ["-0", String(fresh.pid)], { stdio: "ignore" }); } catch { pidAlive = false; }
  if (!pidAlive) { ok(`S1 attempt ${attempt} the pid alive at kill time`, false, "already dead — too late"); continue; }
  /* THE RAW KILL — the process group, no scancel, no accounting row.
   * /bin/kill THE REAL BINARY (the t932/t933 law: the execSync shell's
   * builtin mishandles the negative-pid form and orphans the stub). */
  try { execFileSync("/bin/kill", ["-9", "--", `-${fresh.pid}`], { stdio: "ignore" }); } catch {}
  try { execFileSync("/bin/kill", ["-9", String(fresh.pid)], { stdio: "ignore" }); } catch {}
  let frozen = false;
  let n1 = mockRounds(c2dMockDir).length;
  for (let i = 0; i < 6; i++) {
    await sleep(2500);
    const n2 = mockRounds(c2dMockDir).length;
    if (n2 === n1) { frozen = true; break; }
    n1 = n2;
  }
  ok(`S1 attempt ${attempt} THE RAW KILL LANDED — the rounds froze (the stub writes every ~0.9s; silence is death)`, frozen, `${n1} rounds frozen`);
  if (!frozen) continue;
  if (n1 >= 17) { ok(`S1 attempt ${attempt} the freeze is the run's natural finish (17 rounds), not the kill`, false, "too late — retrying"); continue; }
  const st = jobs().find((x) => x.id === c2d.id)?.status;
  if (st === "completed") { ok(`S1 attempt ${attempt} the kill beat the run's finish`, false, "row already completed — retrying"); continue; }
  const rows = accountingRows();
  const cancelRow = rows.find((r) => r.startsWith(`${fresh.id}|`) && r.includes("CANCELLED"));
  ok(`S1 attempt ${attempt} NO accounting row for the killed job (the vanish precondition)`, !cancelRow, cancelRow ?? `${rows.length - before} new rows, none CANCELLED`);
  const roundsAtKill = mockRounds(c2dMockDir);
  ok(`S1 attempt ${attempt} the surviving rounds pinned (the kill's own family)`, roundsAtKill.length >= 1, roundsAtKill.join(", "));
  ok(`S1 attempt ${attempt} the row still RUNNING (the app does not know yet — the honest mid-flight state)`, st === "running", String(st));
  killed = { slurmId: fresh.id, pid: fresh.pid, roundsAtKill, killAt: new Date().toISOString() };
}
if (!killed) { console.log("FATAL: the kill never landed — aborting"); writeReceipt({ fatal: "kill never landed" }); process.exit(2); }
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, connId: connP.id, worldBefore, baseline, ...killed });
writeReceipt({ stage1: { pass, fail, kill: killed, mint: (mintOut.match(/== mint [^\n]*/) ?? ["?"])[0], worldBefore } });
console.log(`== t1025 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * the VANISH LADDER, driven by hand: every /api/jobs GET is one reconcile
 * sweep. The pre-age honesty spot-check first, then the ladder's three
 * consecutive VANISHED verdicts flip the row. */
console.log("== stage 2: the vanish ladder — the honest flip ==");
const st0 = readState();
const c2dId = st0.c2dId;
let c2d = findName(NAME_CLASS2D);
const entryRunning = c2d?.id === c2dId && c2d?.status === "running";
const entryFlipped = c2d?.id === c2dId && c2d?.status === "failed" && c2d?.result === TOMB;
ok("S2 the class2d re-derived (running = drive / failed+tombstone = the flip already stands)", entryRunning || entryFlipped, `${c2d?.id?.slice(-8)}/${c2d?.status}`);
if (!entryRunning && !entryFlipped) { console.log("FATAL(stage2): the class2d is neither running nor tombstoned — run stage1 first"); process.exit(2); }
if (entryFlipped) ok("S2 THE FLIP ALREADY STANDS (the app's own polls convicted the silence)", true, "the same ladder, an earlier witness");
const startedAtMs = new Date(c2d.startedAt).getTime();
ok("S2 the run's startedAt read (the age gate's anchor)", Number.isFinite(startedAtMs), c2d.startedAt);

let flipped = null;
if (entryRunning) {
  const t0 = Date.now();
  let preAgeHonest = false;
  while (Date.now() - t0 < 420_000) {
    const j = apiJson("/api/jobs").jobs?.find((x) => x.id === c2dId);
    const ageMs = Date.now() - startedAtMs;
    if (!preAgeHonest && ageMs > 90_000) {
      preAgeHonest = true;
      ok("S2 THE PRE-AGE HONESTY — still running at ~T+90s (no false conviction before the 120s grace)", j?.status === "running", String(j?.status));
    }
    if (j?.status === "failed") { flipped = j; break; }
    if (j?.status === "completed") { ok("S2 the row never flipped", false, "completed — the kill's silence was broken; aborting"); break; }
    await sleep(6000);
  }
  ok("S2 THE VANISH LADDER FLIPPED the row (three consecutive VANISHED sweeps convicted the silence)", flipped?.status === "failed", `${flipped?.status ?? "TIMEOUT"} after ${Math.round((Date.now() - t0) / 1000)}s of driving`);
} else {
  flipped = c2d;
}
ok("S2 THE TOMBSTONE VERBATIM — the honest lane's own words", flipped?.result === TOMB, String(flipped?.result ?? "none").slice(0, 160));
ok("S2 the resume clause rides the tombstone (the refine family's own promise)", String(flipped?.result ?? "").includes("resumes from the last synced checkpoint"), "");

const roundsAtFlip = mockRounds(st0.mockDir);
ok("S2 THE FAMILY UNTOUCHED AT THE FLIP (the kill preserved the rounds; the flip erased nothing)", roundsAtFlip.join(",") === (st0.roundsAtKill ?? []).join(","), roundsAtFlip.join(", "));
const cs = apiJson(`/api/jobs/${c2dId}/continue-sources`);
const self = (cs.sources ?? []).find((s) => s.relation === "self");
const newest = (self?.entries ?? []).find((e) => e.newest && e.complete);
ok("S2 THE PICKER ANSWERS at the interrupted face (lane remote)", !!self && (self.lane ?? cs.lane) === "remote", `entries=${(self?.entries ?? []).length} lane=${self?.lane ?? cs.lane ?? "?"}`);
ok("S2 the picker's newest complete round is the killed run's own (run_it*.star)", /run_it\d+_optimiser\.star$/.test(newest?.path ?? ""), newest?.path?.split("/").pop() ?? "none");
writeState({ ...st0, tombstone: flipped?.result ?? "", realCont: newest?.path ?? "", flippedAt: new Date().toISOString() });
writeReceipt({ stage2: { pass, fail, tombstone: flipped?.result ?? "", realCont: newest?.path ?? "" } });
console.log(`== t1025 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE FILM — the walk leg proper: the interrupted face's seven faces,
 * seven PNGs, every word verbatim, Escape through both confirms. */
console.log("== stage 3: THE FILM — the interrupted face's walk leg ==");
const st3 = readState();
const c2dId = st3.c2dId;
const c2d = findName(NAME_CLASS2D);
ok("S3 the arc's mid-point stands (failed, the tombstone aboard)", c2d?.id === c2dId && c2d?.status === "failed" && c2d?.result === TOMB, `${c2d?.status}/${String(c2d?.result ?? "").slice(0, 50)}`);
if (!c2d || c2d.status !== "failed") { console.log("FATAL(stage3): the class2d is not tombstoned — run stage2 first"); process.exit(2); }
const contFieldSel = `#param-${c2dId}-fn_cont`;
const REAL_CONT = st3.realCont;
ok("S3 the picker's round carried from stage2", !!REAL_CONT, String(REAL_CONT ?? "none").slice(-70));

/* a fresh page + the find bar (the sticky-header law) */
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(800);
sh(`${AB} press Control+f`);
await sleep(500);
sh(`${AB} keyboard type "${NAME_CLASS2D}"`);
await sleep(600);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();

/* FILM 1 — the canvas card at the interrupted face */
const cardWords = await poll(
  `(() => { const c = [...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ present: !!c, text: (c?.textContent || '').slice(0, 200) }); })()`,
  (v) => v.present === true, 10, 500,
);
ok("S3 the interrupted card stands on the canvas", cardWords?.present === true);
const film1 = await film("t1025-interrupt-canvas.png");
ok("S3 FILM 1 the canvas at the interrupted face", film1, "shots-qa/t1025-interrupt-canvas.png");

/* the inspector — the Log landing (the killed run's last words) */
const insp = await openInspectorHard(NAME_CLASS2D);
ok("S3 the INTERRUPTED job's inspector opens", String(insp).startsWith("open@try"), String(insp));
const logLanding = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ open: !!d, logSpoken: (d?.textContent || '').includes(${JSON.stringify(STUB_WORDS)}) }); })()`,
  (v) => v.logSpoken === true, 14, 600,
);
ok("S3 the failed landing is LOG and the killed run's last words speak in the dialog", logLanding?.logSpoken === true);
const film2 = await film("t1025-interrupt-log.png");
ok("S3 FILM 2 the Log landing (the killed run's last words)", film2, "shots-qa/t1025-interrupt-log.png");

/* the Overview climb — 'Job failed' + THE TOMBSTONE VERBATIM (the
 * entrance-animation ghost law: one honest retry on a ghost click) */
let ovClick = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
let card = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), tomb: t.includes(${JSON.stringify(TOMB_HEAD)}), door: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Edit parameters') }); })()`,
  (v) => v.failedWords === true, 10, 500,
);
if (card?.failedWords !== true) {
  ovClick = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  card = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), tomb: t.includes(${JSON.stringify(TOMB_HEAD)}), door: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Edit parameters') }); })()`,
    (v) => v.failedWords === true, 12, 500,
  );
}
ok("S3 the Overview climb hangs 'Job failed'", card?.failedWords === true);
ok("S3 THE TOMBSTONE HANGS ON THE CARD verbatim", card?.tomb === true);
ok("S3 the Edit-parameters door stands on the interrupted face", card?.door === true);
const film3 = await film("t1025-interrupt-overview.png");
ok("S3 FILM 3 the Overview tombstone card", film3, "shots-qa/t1025-interrupt-overview.png");

/* the door → the panel → the empty scene */
const door = await openEditDoor(NAME_CLASS2D);
ok("S3 the door clicked FROM THE INTERRUPTED FACE", String(door.doorClick).startsWith("clicked@") && door.swapped?.inspGone === true, String(door.doorClick));
const panel = await panelOpen();
ok("S3 the JobPanel opened on the interrupted face", panel?.open === true);
await clickParamsTab();
const fieldEmpty = await poll(
  `(() => { const el = document.querySelector('${contFieldSel}'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
  (v) => v.present === true, 16, 600,
);
ok("S3 THE SCENE READS EMPTY — fn_cont born without a path (the interruption's cause is external)", fieldEmpty?.present === true && (fieldEmpty?.value ?? "x") === "", JSON.stringify(fieldEmpty?.value));
if (fieldEmpty?.present !== true) { console.log("FATAL(stage3): the fn_cont field never appeared"); process.exit(2); }
const film4 = await film("t1025-interrupt-params-empty.png");
ok("S3 FILM 4 the empty fn_cont scene (the verb born Re-run)", film4, "shots-qa/t1025-interrupt-params-empty.png");

/* the picker's own newest round fills the field (the t934 shape) */
const focus = await realClick(`document.querySelector('${contFieldSel}')`);
const focused = evalJson(`JSON.stringify({ on: document.activeElement === document.querySelector('${contFieldSel}') })`);
if (focused?.on !== true) {
  evalJs(`(() => { const el = document.querySelector('${contFieldSel}'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); } return 'focused'; })()`);
  await sleep(300);
}
sh(`${AB} press Control+a`);
sh(`${AB} press Delete`);
await sleep(300);
sh(`${AB} fill "${contFieldSel}" "${REAL_CONT}"`);
await sleep(1800);
const savedReal = jobs().find((x) => x.id === c2dId)?.params?.fn_cont;
ok("S3 THE RESUME PATH LANDED (the picker's own newest complete round)", savedReal === REAL_CONT, String(savedReal ?? "none").slice(-70));
const film5 = await film("t1025-interrupt-params-picked.png");
ok("S3 FILM 5 the picked scene (the resume path aboard)", film5, "shots-qa/t1025-interrupt-params-picked.png");
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);

/* the inspector's Continue verb — the confirm — ESCAPE (the pick never
 * taken) */
const insp2 = await openInspectorHard(NAME_CLASS2D);
ok("S3 the inspector reopens for the Continue verb", String(insp2).startsWith("open@try"), String(insp2));
const contBtn = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Continue'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null }); })()`,
  (v) => v.present === true, 10, 500,
);
ok("S3 THE VERB'S FACE READS 'Continue' at the interrupted face (fn_cont set) and is CLICKABLE", contBtn?.present === true && contBtn?.disabled === false, `disabled=${contBtn?.disabled}`);
const contClick = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
ok("S3 the Continue verb clicked", String(contClick).startsWith("clicked@"), String(contClick));
const confirmC = await confirmRead(CONT_NEEDLE);
ok("S3 the confirm speaks 'Continue <name>?'", confirmC?.title === `Continue ${NAME_CLASS2D}?`, confirmC?.title ?? "none");
ok("S3 THE PRESERVED-FAMILY LAW verbatim at the interrupted face", (confirmC?.text ?? "").includes(CONT_DESC));
ok("S3 the chosen path rides as-is (the picker's round verbatim)", (confirmC?.text ?? "").includes(REAL_CONT) && (confirmC?.text ?? "").includes(CONT_RIDES));
const film6 = await film("t1025-interrupt-continue-confirm.png");
ok("S3 FILM 6 the Continue confirm (the preserved family + the path)", film6, "shots-qa/t1025-interrupt-continue-confirm.png");
try { sh(`${AB} press Escape`); } catch {}
await sleep(900);
const confirmCGone = await poll(
  `JSON.stringify({ open: [...document.querySelectorAll('[role="alertdialog"]')].some(d => (d.textContent || '').includes(${JSON.stringify(CONT_NEEDLE)})) })`,
  (v) => v.open === false, 8, 500,
);
ok("S3 the Continue confirm DISMISSED — the pick never taken", confirmCGone?.open === false);
const stillFailedC = jobs().find((x) => x.id === c2dId)?.status;
ok("S3 the status NEVER left failed through the Continue film", stillFailedC === "failed", String(stillFailedC));

/* the field PATCHed home to "" — the as-found restore (the t1024 film
 * law: zero field churn left standing) */
const clearP = api("PATCH", `/api/jobs/${c2dId}`, { params: { fn_cont: "" } });
ok("S3 the fn_cont PATCHed home to empty", clearP.job?.params?.fn_cont === "", JSON.stringify(clearP.job?.params?.fn_cont ?? clearP).slice(0, 60));

/* the inspector's Re-run verb — born honest at the empty scene — the
 * Start-again confirm — ESCAPE (zero churn) */
const insp3 = await openInspectorHard(NAME_CLASS2D);
ok("S3 the inspector reopens for the Re-run verb", String(insp3).startsWith("open@try"), String(insp3));
const rerunFace = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Re-run'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null }); })()`,
  (v) => v.present === true, 10, 500,
);
ok("S3 THE VERB IS BORN 'Re-run' at the tombstone (fn_cont empty — the Start-again mode without a clear)", rerunFace?.present === true && rerunFace?.disabled === false, `disabled=${rerunFace?.disabled}`);
const rerunClick = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Re-run')`);
ok("S3 the Re-run verb clicked", String(rerunClick).startsWith("clicked@"), String(rerunClick));
const confirmS = await confirmRead("restarts from scratch");
ok("S3 the confirm speaks 'Re-run <name>?' (the Start-again mode)", confirmS?.title === `Re-run ${NAME_CLASS2D}?`, confirmS?.title ?? "none");
ok("S3 THE WIPE SPEECH NAMES THE CLUSTER at the tombstone", (confirmS?.text ?? "").includes(WIPE_CLUSTER));
ok("S3 the confirm teaches the checkpoint alternative (the t932 door as the OTHER word)", (confirmS?.text ?? "").includes(CHECKPOINT_ALT));
const film7 = await film("t1025-interrupt-startagain-confirm.png");
ok("S3 FILM 7 the Start-again confirm (the wipe + the cluster + the alternative)", film7, "shots-qa/t1025-interrupt-startagain-confirm.png");
try { sh(`${AB} press Escape`); } catch {}
await sleep(900);
const confirmSGone = await poll(
  `JSON.stringify({ open: [...document.querySelectorAll('[role="alertdialog"]')].some(d => (d.textContent || '').includes('restarts from scratch')) })`,
  (v) => v.open === false, 8, 500,
);
ok("S3 the Start-again confirm DISMISSED — zero churn", confirmSGone?.open === false);
const stillFailedS = jobs().find((x) => x.id === c2dId)?.status;
ok("S3 the status NEVER left failed through the Start-again film", stillFailedS === "failed", String(stillFailedS));
const paramsLeft = jobs().find((x) => x.id === c2dId)?.params?.fn_cont;
ok("S3 the fn_cont left EMPTY as-found (the film's param law)", (paramsLeft ?? "") === "", JSON.stringify(paramsLeft));

writeReceipt({ stage3: { pass, fail, films: 7 } });
console.log(`== t1025 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

if (RUN_S4) {
/* ========================= stage 4 =======================================
 * the restore: the binding to the manifest's own word, the t916 remove,
 * the world back to the as-found count, the doctor CLEAN. */
console.log("== stage 4: the restore ==");
const st4 = readState();
/* the manifest's binding is the restore's law (the t933 lesson: read the
 * manifest's word, never blind-patch the connection) */
const mBinding = (() => { try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).binding ?? null; } catch { return null; } })();
const rebind = api("PATCH", `/api/projects/${st4.projId}`, { remoteConnectionId: mBinding });
ok(`S4 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S4 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const jobsAfter = jobs();
const edgesAfter = edges();
ok(`S4 the world back to the as-found baseline (${st4.baseline})`, jobsAfter.length === st4.baseline, String(jobsAfter.length));
ok("S4 no t916 debris on the names", !jobsAfter.some((j) => (j.name ?? "").includes("t916")));
const tombLeft = jobsAfter.filter((j) => j.result === TOMB).length;
ok("S4 no interrupted tombstone left standing (the conviction was the film's own)", tombLeft === 0, String(tombLeft));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S4 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);
writeReceipt({ stage4: { pass, fail, worldAfter: jobsAfter.length, doctor: (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0] } });
console.log(`== t1025 stage4 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage4") process.exit(fail === 0 ? 0 : 1);
} /* end stage4 */

console.log(`== t1025 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
