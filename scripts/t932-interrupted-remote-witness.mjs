#!/usr/bin/env node
/**
 * t932 — the interrupted-remote-run's honest lane: a remote run KILLED
 * MID-FLIGHT with no exit testimony, the vanish ladder's honest flip, and
 * the resume door at the INTERRUPTED face.
 *
 * Never witnessed before this ride: every prior remote arc either COMPLETED
 * or FAILED through a stub's own verdict (the t930 allfail lever, the bad
 * checkpoint). No ride has ever watched the scheduler's silence convict a
 * run — the t346 vanish ladder (VANISH_AGE_MS 120s + VANISH_STREAK_N 3
 * consecutive VANISHED sweeps) flipping a LIVE row to the tombstone
 *
 *   "interrupted remotely (no exit status — node reboot or hard kill; 3
 *    consecutive checks saw no trace of it); re-run resumes from the last
 *    synced checkpoint"
 *
 * — and no ride has opened the RESUME DOOR at that face (the refine
 * family's own promise: the killed run's rounds survive the kill, the
 * checkpoint picker offers them, and a Continue completes the arc the
 * interruption tore).
 *
 * THE KILL'S LAW: scancel leaves a CANCELLED accounting row (the app's own
 * Stop path — the clean verdict). The interrupted face needs the RAW
 * process-group kill — `kill -9 -- -<pid>` against the sbatch launcher's
 * setsid group — which leaves NO journal row, NO exit file, NO squeue
 * trace: exactly the node-reboot shape the ladder was built to convict.
 * The kill waits for run_it001_optimiser.star (the first COMPLETE round —
 * the resume door must have something to offer) and lands mid-iteration.
 *
 * Bands:
 *   stage1  the t916 mint re-rides, the t300 bind, the class2d re-run with
 *           iterations=16 (a ~18s window), THE KILL between rounds, the
 *           no-CANCELLED-row negative, the surviving family pinned.
 *   stage2  the VANISH LADDER driven by hand (each /api/jobs GET is one
 *           reconcile sweep): the pre-age honesty spot-check (still running
 *           at T+90s), then the flip, the tombstone VERBATIM, the family
 *           untouched at the flip, the picker's newest complete round.
 *   stage3  the INTERRUPTED FACE (Log landing → Overview climb → the
 *           tombstone card → the door), the 320 born-at-band pass, THE
 *           RESUME through the door (fn_cont empty at the scene — the
 *           interruption's cause is external — the picker's own round, the
 *           Continue confirm, the unflip, the stub's CONTINUE receipt, the
 *           ladder GREW while the picked round stayed), the restore
 *           (unbind FIRST — the t930 law — then the t916 remove, the seed
 *           trio + 2 edges, the doctor CLEAN).
 *
 *   node scripts/t932-interrupted-remote-witness.mjs stage1|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t932-interrupted-remote-witness.json";
const STATE = path.join(ROOT, "data", "t932-interrupted-remote.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const TOMB = "interrupted remotely (no exit status — node reboot or hard kill; 3 consecutive checks saw no trace of it); re-run resumes from the last synced checkpoint";
const TIP_DOOR = "without resetting — the completed run and its results stay until a Re-run replaces them";
const CONT_DESC = "iteration family in this job's run directory is preserved";
const CONT_RIDES = "The chosen path rides as-is:";

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
async function pollUntil(jobId, want, timeoutMs = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}
async function logUntil(jobId, needle, tries = 12, ms = 1500) {
  let text = "";
  for (let i = 0; i < tries; i++) {
    const l = apiJson(`/api/jobs/${jobId}/log`);
    text = typeof l === "string" ? l : (l.tail ?? l.log ?? "");
    if (text.includes(needle)) return text;
    await sleep(ms);
  }
  return text;
}
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
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Edit parameters'); if (!b) { window.__t932door = null; return JSON.stringify({ stable: false }); } const r = b.getBoundingClientRect(); const cur = Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width); const prev = window.__t932door; window.__t932door = cur; return JSON.stringify({ stable: prev === cur && cur !== null, x: Math.round(r.x), y: Math.round(r.y) }); })()`,
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
const failedFaceRead = async (name, needle) => {
  const logLanding = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d, logSpoken: (d?.textContent || '').includes(${JSON.stringify(needle)}) }); })()`,
    (v) => v.logSpoken === true, 14, 600,
  );
  let ovClick = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  let card = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), tomb: t.includes(${JSON.stringify(TOMB.slice(0, 60))}), door: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Edit parameters') }); })()`,
    (v) => v.failedWords === true, 10, 500,
  );
  if (card?.failedWords !== true) {
    /* the entrance-animation ghost law (the re-ride's lesson): the first
     * climb's rect was read mid-slide — the click landed on a ghost and
     * the dialog stayed on Log. ONE honest retry: the re-click rides the
     * settled tab, the poll re-reads the card. */
    ovClick = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
    card = await poll(
      `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), tomb: t.includes(${JSON.stringify(TOMB.slice(0, 60))}), door: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Edit parameters') }); })()`,
      (v) => v.failedWords === true, 12, 500,
    );
  }
  return { logLanding, ovClick, card };
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

/* =========================== prep ======================================== */
console.log(`== t932 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * the mint, the bind, the long re-run, THE KILL between rounds */
console.log("== stage 1: the mint re-rides, the bind, iterations=16, THE RAW KILL ==");
let c2d = findName(NAME_CLASS2D);
if (c2d) {
  /* the self-heal: the t916 remove first (the manifest's own law); if the
   * manifest is gone (a crashed prior ride), the manual downstream-first
   * delete + both sides' workdir sweeps — the t930 deadlock escape */
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

/* t300 — the binding door (the t930 law): the world's standing state is
 * binding=null; the bare POST below rides the binding's lane. */
const connsP = apiJson("/api/remote/connections").connections ?? [];
const connP = connsP.find((c) => c.name === "Mock Cluster");
ok("S1 the Mock Cluster connection resolved", !!connP?.id, connP?.id?.slice(0, 14));
if (!connP?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: connP.id });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

/* the LONG re-run: iterations 2 → 16 (the stub sleeps 0.9s/round — a ~18s
 * window the kill can land inside). The PATCH door merges into the stored
 * params (the t708 write door's own contract). */
const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: 16 } });
ok("S1 the class2d's iterations raised to 16 through the PATCH door", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "16", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

let killed = null;
for (let attempt = 1; attempt <= 3 && !killed; attempt++) {
  console.log(`-- S1 kill attempt ${attempt} --`);
  const before = accountingRows().length;
  /* the POST refuses while a run is active — if a prior attempt's stub
   * outlived its kill, wait for the row's terminal state first */
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
  /* the first COMPLETE round is the kill's gate: the resume door must have
   * something to offer, and a PENDING-launch kill would leave nothing.
   * The gate is host-side (the mock fs) — no placeholder poll needed. */
  let firstRound = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 45_000) {
    if (existsSync(path.join(c2dMockDir, "run_it001_optimiser.star"))) { firstRound = true; break; }
    await sleep(300);
  }
  if (!firstRound) { ok(`S1 attempt ${attempt} run_it001 landed before the kill`, false, "no first round in 45s"); continue; }
  ok(`S1 attempt ${attempt} run_it001_optimiser.star landed (the resume door's floor)`, true, "");
  /* the newest launcher pid — submitted seconds ago */
  const fresh = slurmPids().filter((p) => Date.now() - p.mtime < 120_000).sort((a, b) => b.mtime - a.mtime)[0];
  if (!fresh?.pid) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  let pidAlive = true;
  try { execFileSync("/bin/kill", ["-0", String(fresh.pid)], { stdio: "ignore" }); } catch { pidAlive = false; }
  if (!pidAlive) { ok(`S1 attempt ${attempt} the pid alive at kill time`, false, "already dead — too late"); continue; }
  /* THE RAW KILL — the process group, no scancel, no accounting row.
   * /bin/kill THE REAL BINARY: the execSync shell's builtin mishandles the
   * negative-pid form and orphans the stub (the first ride's lesson — the
   * launcher died while the python kept writing rounds, and the run
   * completed under the kill's nose). */
  try { execFileSync("/bin/kill", ["-9", "--", `-${fresh.pid}`], { stdio: "ignore" }); } catch {}
  try { execFileSync("/bin/kill", ["-9", String(fresh.pid)], { stdio: "ignore" }); } catch {}
  /* THE DEATH IS PROVEN BY THE LADDER'S OWN CLOCK: the stub writes a round
   * every ~0.9s, so a live stub ALWAYS grows within a few seconds — two
   * consecutive frozen reads prove the kill (the pgrep gate was a false
   * witness: the app's own poll sweep is a transient bash whose script
   * text mentions the workdir, and pgrep caught IT — the first re-ride's
   * lesson). A natural finish also freezes the rounds — at SEVENTEEN
   * (it000 + 16 iterations); the frozen count names which death it was. */
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
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, ...killed, paramsAtKill: jobs().find((x) => x.id === c2d.id)?.params ?? {} });
writeReceipt({ stage1: { pass, fail, kill: killed, mint: (mintOut.match(/== mint [^\n]*/) ?? ["?"])[0] } });
console.log(`== t932 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * the VANISH LADDER, driven by hand: every /api/jobs GET is one reconcile
 * sweep. The pre-age honesty spot-check first (the row must stay running
 * while ageMs < VANISH_AGE_MS — no false conviction), then the ladder's
 * three consecutive VANISHED verdicts flip the row. */
console.log("== stage 2: the vanish ladder — the honest flip ==");
const st0 = readState();
const c2dId = st0.c2dId;
let c2d = findName(NAME_CLASS2D);
/* the mid-arc entry has TWO honest shapes (the t930 A2 law): the fresh
 * stage-1 leave (running — drive the ladder by hand) and the flip that
 * already stands (the app's own polls drove the ladder while the
 * instrument healed — the same conviction, an earlier witness). */
const entryRunning = c2d?.id === c2dId && c2d?.status === "running";
const entryFlipped = c2d?.id === c2dId && c2d?.status === "failed" && c2d?.result === TOMB;
ok("S2 the class2d re-derived (running = drive / failed+tombstone = the flip already stands)", entryRunning || entryFlipped, `${c2d?.id?.slice(-8)}/${c2d?.status}`);
if (!entryRunning && !entryFlipped) { console.log("FATAL(stage2): the class2d is neither running nor tombstoned — run stage1 first"); process.exit(2); }
if (entryFlipped) {
  ok("S2 THE FLIP ALREADY STANDS (the app's own polls convicted the silence)", true, "the same ladder, an earlier witness");
}
const startedAtMs = new Date(c2d.startedAt).getTime();
ok("S2 the run's startedAt read (the age gate's anchor)", Number.isFinite(startedAtMs), c2d.startedAt);

let flipped = null;
let preAgeHonest = null;
if (entryRunning) {
  const t0 = Date.now();
  while (Date.now() - t0 < 420_000) {
    const j = apiJson("/api/jobs").jobs?.find((x) => x.id === c2dId);
    const ageMs = Date.now() - startedAtMs;
    if (!preAgeHonest && ageMs > 90_000) {
      preAgeHonest = { at: new Date().toISOString(), status: j?.status };
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
writeReceipt({ stage2: { pass, fail, tombstone: flipped?.result ?? "", roundsAtFlip, realCont: newest?.path ?? "" } });
console.log(`== t932 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * the INTERRUPTED FACE (a face no ride has ever opened), the resume
 * through the door, the restore. */
console.log("== stage 3: the interrupted face, the resume door, the restore ==");
const st3 = readState();
const c2dId = st3.c2dId;
let c2d = findName(NAME_CLASS2D);
ok("S3 the arc's mid-point stands (failed, the tombstone aboard)", c2d?.id === c2dId && c2d?.status === "failed" && c2d?.result === TOMB, `${c2d?.status}/${String(c2d?.result ?? "").slice(0, 50)}`);
if (!c2d || c2d.status !== "failed") { console.log("FATAL(stage3): the class2d is not failed — run stage2 first"); process.exit(2); }
const REAL_CONT = st3.realCont ?? "";
const contFieldSel = `#param-${c2d.id}-fn_cont`;
const famBeforeS3 = mockRounds(st3.mockDir);
const pickedN = (REAL_CONT.match(/run_it(\d+)_optimiser\.star/) ?? [])[1] ?? "?";

/* a fresh page + the find bar (the sticky-header law — the minted chain's
 * card sits under its group header at the canvas's rest position) */
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
const centered = await poll(
  `(() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); if (!c) return JSON.stringify({ vis: false }); const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return JSON.stringify({ vis: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth }); })()`,
  (v) => v.vis === true, 8, 500,
);
ok("S3 the find bar centered the interrupted card (out from under the sticky header)", centered?.vis === true, JSON.stringify(centered));

/* the interrupted face — Log is the failed default (the t927 law); the
 * Overview climb hangs the verdict; the tombstone rides the card verbatim */
const insp0 = await openInspectorHard(NAME_CLASS2D);
ok("S3 the INTERRUPTED job's inspector opens", String(insp0).startsWith("open@try"), String(insp0));
/* the interrupted face — Log is the failed default (the t927 law), but the
 * INTERRUPTED run's log holds no verdict line: the stub was killed
 * mid-breath, so its log speaks the run's LAST WORDS (the cryoflow-mock
 * header + the it [NNN] progress lines) — the tombstone lives on the
 * Overview card only (the flip's verdict is the app's word, never the
 * stub's). The Log-landing gate reads the run's own header. */
const face = await failedFaceRead(NAME_CLASS2D, "cryoflow-mock refine");
ok("S3 the failed landing is LOG and the killed run's last words speak in the dialog", face.logLanding?.logSpoken === true);
ok("S3 the Overview climb clicked", String(face.ovClick).startsWith("clicked@"), String(face.ovClick));
ok("S3 the card speaks 'Job failed'", face.card?.failedWords === true);
ok("S3 THE TOMBSTONE HANGS ON THE CARD verbatim", face.card?.tomb === true);
ok("S3 the 'Edit parameters' door PRESENT on the interrupted face (the contract is status !== running)", face.card?.door === true);

/* 320 born-at-band on the interrupted face (the t926/t927 law's twin) */
sh(`${AB} set viewport 320 700`);
await sleep(900);
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);
sh(`${AB} press Control+f`);
await sleep(400);
sh(`${AB} keyboard type "${NAME_CLASS2D}"`);
await sleep(500);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
const inspN = await openInspectorHard(NAME_CLASS2D, 5);
ok("S3 the dialog opened at 320 (click-until-open)", String(inspN).startsWith("open@try"), String(inspN));
const fitsN = await poll(
  `JSON.stringify({ overX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth), door: [...document.querySelectorAll('[role="dialog"] button')].some(b => (b.textContent || '').trim() === 'Edit parameters') })`,
  (v) => typeof v.overX === "number", 8, 500,
);
ok("S3 the interrupted face fits the narrow door (overX 0, the door travels)", (fitsN?.overX ?? 99) === 0 && fitsN?.door === true, `overX=${fitsN?.overX}`);
sh(`${AB} set viewport 1280 900`);
await sleep(900);
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);

/* the 320 pass's Escape closed the inspector — the door needs it back
 * (the re-ride's lesson: the door step must open its own inspector) */
const inspDoor0 = await openInspectorHard(NAME_CLASS2D);
ok("S3 the inspector re-opens for the door (the 320 pass's Escape closed it)", String(inspDoor0).startsWith("open@try"), String(inspDoor0));

/* THE RESUME: the door opens on the failed face (the t927 law), the
 * fn_cont field is EMPTY at the scene — the interruption's cause is
 * external, the input holds no self-incrimination — and the picker's own
 * newest round fills it. */
const door3 = await openEditDoor(NAME_CLASS2D);
ok("S3 the door clicked FROM THE INTERRUPTED FACE", String(door3.doorClick).startsWith("clicked@") && door3.swapped?.inspGone === true, String(door3.doorClick));
const panel3 = await panelOpen();
ok("S3 the JobPanel opened on the interrupted face", panel3?.open === true);
await clickParamsTab();
const field3 = await poll(
  `(() => { const el = document.querySelector('${contFieldSel}'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
  (v) => v.present === true, 16, 600,
);
ok("S3 THE SCENE READS EMPTY — the field holds no path (the interruption's cause is external, the t927 law's interrupted twin)", field3?.present === true && (field3?.value ?? "x") === "", JSON.stringify(field3?.value));
if (field3?.present !== true) { console.log("FATAL(stage3): the fn_cont field never appeared — the panel is not the Params tab"); process.exit(2); }
const stillFailed3 = jobs().find((x) => x.id === c2d.id)?.status;
ok("S3 the status NEVER left failed through the door+edit approach", stillFailed3 === "failed", String(stillFailed3));
const focus3 = await realClick(`document.querySelector('${contFieldSel}')`);
const focused3 = evalJson(`JSON.stringify({ on: document.activeElement === document.querySelector('${contFieldSel}') })`);
if (focused3?.on !== true) {
  evalJs(`(() => { const el = document.querySelector('${contFieldSel}'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); } return 'focused'; })()`);
  await sleep(300);
}
sh(`${AB} press Control+a`);
sh(`${AB} press Delete`);
await sleep(300);
sh(`${AB} fill "${contFieldSel}" "${REAL_CONT}"`);
await sleep(1800);
const savedReal = jobs().find((x) => x.id === c2d.id)?.params?.fn_cont;
ok("S3 THE RESUME PATH LANDED (the picker's own newest complete round, run_it" + pickedN + ")", savedReal === REAL_CONT, String(savedReal ?? "none").slice(-70));
const stillFailed3b = jobs().find((x) => x.id === c2d.id)?.status;
ok("S3 the status stayed failed through the recovery edit (the edit never flips; the run does)", stillFailed3b === "failed", String(stillFailed3b));
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);

/* the inspector's Continue verb (busy-only — clickable on the failed face),
 * the confirm riding the picked path, the fire, the unflip */
const insp3 = await openInspectorHard(NAME_CLASS2D);
ok("S3 the inspector reopens for the verb", String(insp3).startsWith("open@try"), String(insp3));
const contBtn3 = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Continue'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null }); })()`,
  (v) => v.present === true, 10, 500,
);
ok("S3 THE VERB'S FACE READS 'Continue' at the interrupted face (fn_cont set) and is CLICKABLE", contBtn3?.present === true && contBtn3?.disabled === false, `disabled=${contBtn3?.disabled}`);
const contClick3 = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
ok("S3 the Continue verb clicked", String(contClick3).startsWith("clicked@"), String(contClick3));
const confirm3 = await confirmRead("picks up from the checkpoint");
ok("S3 the confirm speaks 'Continue <name>?'", confirm3?.title === `Continue ${NAME_CLASS2D}?`, confirm3?.title ?? "none");
ok("S3 THE PRESERVED-FAMILY LAW verbatim at the interrupted face", (confirm3?.text ?? "").includes(CONT_DESC));
ok("S3 the chosen path rides as-is (the picker's round verbatim)", (confirm3?.text ?? "").includes(REAL_CONT) && (confirm3?.text ?? "").includes(CONT_RIDES));
const go3 = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
ok("S3 'Continue' fired (the resume dispatch)", String(go3).startsWith("clicked@"), String(go3));

/* the two-breath gate: the pre-state is FAILED — wait for the row to
 * LEAVE failed (the dispatch's own word), then for the resume's verdict */
let resumed = null;
{
  let left = false;
  const tA = Date.now();
  while (Date.now() - tA < 180_000) {
    const st = jobs().find((x) => x.id === c2d.id)?.status;
    if (st && st !== "failed") { left = true; break; }
    await sleep(1500);
  }
  if (left) {
    const tB = Date.now();
    while (Date.now() - tB < 300_000) {
      const j = jobs().find((x) => x.id === c2d.id);
      if (["completed", "failed"].includes(j?.status ?? "")) { resumed = j; break; }
      await sleep(2000);
    }
  }
}
ok("S3 THE INTERRUPTION UNFLIPS — the resume completed", resumed?.status === "completed", resumed?.status ?? "TIMEOUT");
const log3 = await logUntil(c2d.id, "CONTINUE from");
ok("S3 THE STUB'S OWN CONTINUE RECEIPT — 'CONTINUE from run_it" + pickedN + "_optimiser.star (it " + pickedN + ", K=4)'", new RegExp(`CONTINUE from run_it${pickedN}_optimiser\\.star \\(it ${pickedN}, K=4\\)`).test(log3), (log3.match(/CONTINUE from[^\n]*/) ?? ["none"])[0].slice(0, 120));
const famAfter = mockRounds(st3.mockDir);
ok("S3 THE LADDER GREW — run_it" + String(Number(pickedN) + 1).padStart(3, "0") + " born (+1 more)", famAfter.includes(`run_it${String(Number(pickedN) + 1).padStart(3, "0")}_optimiser.star`), famAfter.slice(-3).join(", "));
ok("S3 THE PICKED ROUND STAYED — run_it" + pickedN + "_optimiser.star survived the resume (the t394/t917 carve-out at the interrupted arc)", famAfter.includes(`run_it${pickedN}_optimiser.star`), "");

/* the restore: the remove asserts the binding untouched from its manifest
 * — the binding must RETURN TO THE MINT-TIME VALUE, not blindly unbind
 * (the re-ride's lesson: this arc's mint ran while BOUND, so m.binding is
 * the connection id; an unbind-first made the assert RED and the remove
 * died partway). PATCH the binding home → the remove → the standing
 * leave (unbound — the t929/t930 law) AFTER the manifest is consumed. */
const connsR = apiJson("/api/remote/connections").connections ?? [];
const connR = connsR.find((c) => c.name === "Mock Cluster");
const rebind3 = connR?.id ? api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: connR.id }) : { ok: false, skip: "no conn" };
ok("S3 THE BINDING RETURNED TO THE MINT-TIME VALUE (the remove's assert needs the mint's own world)", rebind3.ok === true, JSON.stringify(rebind3).slice(0, 60));
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S3 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const unbind3 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null });
ok("S3 THE STANDING LEAVE — unbound after the manifest is consumed (the t929/t930 law)", unbind3.ok === true, JSON.stringify(unbind3).slice(0, 60));
const jobsAfter = jobs();
const edgesAfter = edges();
ok("S3 the world back to the seed trio (3 jobs)", jobsAfter.length === 3, String(jobsAfter.length));
ok("S3 the world holds exactly 2 edges", edgesAfter.length === 2, String(edgesAfter.length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S3 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);
writeReceipt({ stage3: { pass, fail, realCont: REAL_CONT, pickedRound: pickedN, resume: resumed?.status, ladder: famAfter.slice(-3) } });
console.log(`== t932 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t932 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
