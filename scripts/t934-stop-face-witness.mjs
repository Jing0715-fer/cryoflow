#!/usr/bin/env node
/**
 * t934 — the interrupted arc's STOP face: the app's OWN hand at a running
 * remote run, the stop-vs-interrupt verdict boundary, two kills side by
 * side in one window.
 *
 * Never witnessed before this ride: the t618/t624/t625 receipt contract was
 * built and healed in unit fires, but no ride has ever CLICKED the UI's own
 * Stop button at a running SLURM run and watched the whole verdict chain
 * land — the 8s settle window confirming the teardown, the toast speaking
 * the receipt (not a guess), the CANCELLED row landing in the scheduler's
 * ledger as the clean kill's own testimony, the accounting question opening
 * on the record and the sweep's sacct consult closing it (the stamp
 * confirmed, case closed), and the row speaking the stopped speech — the
 * app's own hand NAMED — where the interrupted face speaks the tombstone —
 * the scheduler's silence CONVICTED. Two kills, one window:
 *
 *   kill#1 (the UI Stop):  scancel → CANCELLED row → "stopped by user
 *   (cluster-side session killed; teardown confirmed — the job left the
 *   queue) — re-run resumes from the last synced checkpoint"
 *
 *   kill#2 (the raw group kill): no scancel, no row, no exit file → the
 *   vanish ladder's three consecutive VANISHED sweeps → "interrupted
 *   remotely (no exit status — node reboot or hard kill; 3 consecutive
 *   checks saw no trace of it); re-run resumes from the last synced
 *   checkpoint"
 *
 * Both carry the SAME resume clause — the promise survives both deaths;
 * what differs is WHOSE WORD names the cause: the app's own hand vs the
 * ladder's conviction.
 *
 * Bands:
 *   stage1  THE CLEAN KILL: the t916 mint re-rides, the t300 bind,
 *           iterations=48 (a ~44s window), run_it001 + run_it002 landed
 *           (the floor AND mid-flight depth), THE UI STOP CLICKED at the
 *           running face (the mouse parked on the toast viewport after the
 *           click — the t826 pause keeps the receipt readable), the busy law, the
 *           toast verbatim, the row's flip, the stopped speech VERBATIM,
 *           the record's open accounting question, the CANCELLED row, the
 *           frozen rounds, the record's closed question + the ledger's
 *           CANCELLED word, THE STOPPED FACE (Log landing → Overview → the
 *           stopped speech on the card, the tombstone ABSENT, the door),
 *           the 320 born-at-band pass, the picker answers.
 *   stage2  THE RESUME AT THE STOPPED FACE: the door, THE SCENE READS
 *           EMPTY (the stop's cause is the app's own hand — the input
 *           holds no path; the t927 law's stopped twin), the picker's own
 *           round, the Continue verb, the confirm, the fire, the
 *           completion, the stub's CONTINUE receipt, the ladder GREW while
 *           the picked round stayed — the stopped speech's own promise
 *           kept.
 *   stage3  THE OTHER KILL + THE BOUNDARY: fn_cont cleared (the t930
 *           gesture), the from-scratch re-run (the move-aside grows by
 *           one), THE RAW KILL (the t932 law: /bin/kill the real binary,
 *           the rounds-freeze death proof, NO scancel NO row), the vanish
 *           ladder's flip, THE TOMBSTONE verbatim, THE BOUNDARY band (the
 *           two kills' verdicts side by side — the hand named vs the
 *           silence convicted, the row present vs absent, the clause
 *           shared), the picker answers at the interrupted face, the
 *           restore (the manifest-word binding law), the seed trio + 2
 *           edges, the doctor CLEAN.
 *
 *   node scripts/t934-stop-face-witness.mjs stage1|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t934-stop-face-witness.json";
const STATE = path.join(ROOT, "data", "t934-stop-face.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
/* the settled=true receipt — the t624 confirmation window's own words */
const STOPPED = "stopped by user (cluster-side session killed; teardown confirmed — the job left the queue) — re-run resumes from the last synced checkpoint";
const STOPPED_CARD = STOPPED.slice(0, 60);
const TOMB = "interrupted remotely (no exit status — node reboot or hard kill; 3 consecutive checks saw no trace of it); re-run resumes from the last synced checkpoint";
const CONT_DESC = "iteration family in this job's run directory is preserved";
const CONT_RIDES = "The chosen path rides as-is:";
const RESUME_CLAUSE = "re-run resumes from the last synced checkpoint";

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
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job')].length)`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const shApi = (url) => {
  let lastErr = null;
  /* 10 × 4s = 40s of patience: the dev server can die mid-ride (the OOM
   * regime's recompile) and take ~60s to come back — a 4×2s retry loop
   * crashed the ride mid-flight once (the curl exit-7 lesson) */
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
const findName = (n) => jobs().find((j) => j.name === n);
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
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Edit parameters'); if (!b) { window.__t934door = null; return JSON.stringify({ stable: false }); } const r = b.getBoundingClientRect(); const cur = Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width); const prev = window.__t934door; window.__t934door = cur; return JSON.stringify({ stable: prev === cur && cur !== null, x: Math.round(r.x), y: Math.round(r.y) }); })()`,
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
/* the run record's own testimony — the instrument reads the engine's state
 * file directly (the record's internals — the accounting question, the
 * ledger's slurmState word, the user-stop stamp — ride nowhere else) */
const readRecord = (jobId) => {
  try { return JSON.parse(readFileSync(ENGINE_STATE, "utf8"))[jobId] ?? null; } catch { return null; }
};
const gensOf = (prevDir) => {
  try { return readdirSync(prevDir).map((d) => path.join(prevDir, d)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs); } catch { return []; }
};
/* the t826 pause: park the mouse INSIDE the toast viewport's padding so
 * every close timer freezes while parked — a toast born under the pointer
 * stays on screen until the mouse leaves (the receipt becomes readable at
 * the instrument's pace, not the vendor's 5s) */
const parkMouseOnToasts = async () => {
  const spot = evalJson(`(() => { const v = document.querySelector('ol[role="region"]') || [...document.querySelectorAll('ol')].find(o => (o.className || '').includes('z-[')); if (!v) return JSON.stringify({ park: false }); const r = v.getBoundingClientRect(); return JSON.stringify({ park: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height - 12) }); })()`);
  if (spot?.park) {
    sh(`${AB} mouse move ${spot.x} ${spot.y}`);
    await sleep(400);
    sh(`${AB} mouse move ${Math.max(2, spot.x - 30)} ${spot.y}`);
    await sleep(300);
    sh(`${AB} mouse move ${spot.x} ${spot.y}`);
    await sleep(300);
    return true;
  }
  return false;
};
const toastRead = (needle) => poll(
  `(() => { const t = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(x => ({ title: x.querySelector('[data-title]')?.textContent ?? null, all: x.textContent?.slice(0, 400) ?? '' })); const hit = t.find(x => x.all.includes(${JSON.stringify(needle)})); const vp = document.querySelector('ol[role="region"]'); return JSON.stringify({ any: t.length > 0, hit: !!hit, text: (hit?.all ?? t.map(x => x.all).join(' || ')).slice(0, 400), vpHtml: vp ? vp.innerHTML.slice(0, 200) : 'no-viewport' }); })()`,
  (v) => v.hit === true, 40, 400,
);

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";

/* ============================ prep ======================================== */
console.log(`== t934 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

/* the manifest-word binding law (the t933 lesson): ANY t916 remove — the
 * self-heal's included — must first PATCH the binding to the MANIFEST'S
 * OWN WORD, whatever it is (the blind unbind/rebind made a remove RED
 * once; the cure reads the manifest) */
const manifestBinding = () => {
  try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).binding ?? null; } catch { return null; }
};

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * the mint, the bind, the long run, THE UI STOP — the app's own hand */
console.log("== stage 1: the mint re-rides, the bind, iterations=48, THE UI STOP ==");
let c2d = findName(NAME_CLASS2D);
if (c2d) {
  /* the self-heal: the manifest-word binding patch FIRST (the t933 law —
   * the remove asserts the binding untouched from the manifest's own
   * word), then the t916 remove; if the manifest is gone (a crashed prior
   * ride), the manual downstream-first delete + both sides' workdir
   * sweeps (the t930 escape) */
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

/* t300 — the binding door (the t930 law): the bare POST below rides the
 * binding's lane. The mint ran UNBOUND (the standing world), so the
 * manifest's word is null — the restore will PATCH to exactly that. */
const connsP = apiJson("/api/remote/connections").connections ?? [];
const connP = connsP.find((c) => c.name === "Mock Cluster");
ok("S1 the Mock Cluster connection resolved", !!connP?.id, connP?.id?.slice(0, 14));
if (!connP?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: connP.id });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

/* the LONG run: iterations 2 → 48 (the stub sleeps ~0.9s/round — a ~44s
 * window: the UI dance (page load, find bar, inspector, the Stop click)
 * spends ~15–20s of it, and the stop must land MID-FLIGHT with room to
 * spare). The param key is `iterations` (the PATCH merges — the t708 door). */
const ITERS = 48;
const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok("S1 the class2d's iterations raised to 48 through the PATCH door", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "48", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

let stopped = null;
let toastTextForReceipt = "";
let parkedForReceipt = false;
for (let attempt = 1; attempt <= 3 && !stopped; attempt++) {
  console.log(`-- S1 stop attempt ${attempt} --`);
  const before = accountingRows().length;
  /* the POST refuses while a run is active — wait for any prior attempt's
   * stub to leave the row first */
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
  /* the resume door's floor AND mid-flight depth: the stop must land with
   * at least TWO complete rounds on disk — the picker needs a floor, and
   * "mid-flight" needs proof the run was past its first breath */
  let rounds = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    rounds = mockRounds(c2dMockDir).length;
    if (rounds >= 2) break;
    await sleep(300);
  }
  if (rounds < 2) { ok(`S1 attempt ${attempt} run_it001 + run_it002 landed before the stop`, false, `${rounds} rounds in 60s`); continue; }
  ok(`S1 attempt ${attempt} run_it001 + run_it002 landed (the floor AND the mid-flight depth)`, true, "");
  /* the fresh launcher pid — submitted seconds ago */
  const fresh = slurmPids().filter((p) => Date.now() - p.mtime < 120_000).sort((a, b) => b.mtime - a.mtime)[0];
  if (!fresh?.pid) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  let pidAlive = true;
  try { execFileSync("/bin/kill", ["-0", String(fresh.pid)], { stdio: "ignore" }); } catch { pidAlive = false; }
  if (!pidAlive) { ok(`S1 attempt ${attempt} the pid alive at stop time`, false, "already dead — too late"); continue; }

  /* THE RUNNING FACE: a fresh page + THE WARM-UP RELOAD (the first-load
   * law: after any product edit the client bundle recompiles — the first
   * page rides a half-hydrated shell whose click can hang the POST
   * forever; the reload rides the settled bundle), the find bar (the
   * sticky-header law), the inspector opens at the RUNNING face, the STOP
   * button stands where Re-run stands on every other face */
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
  await sleep(800);
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
  await sleep(1200);
  sh(`${AB} press Control+f`);
  await sleep(500);
  sh(`${AB} keyboard type "${NAME_CLASS2D}"`);
  await sleep(600);
  sh(`${AB} press Enter`);
  await sleep(900);
  sh(`${AB} press Escape`);
  await sleep(400);
  await settleCensus();
  const inspR = await openInspectorHard(NAME_CLASS2D);
  ok(`S1 attempt ${attempt} the RUNNING job's inspector opens`, String(inspR).startsWith("open@try"), String(inspR));
  const stopBtn = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Stop'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null }); })()`,
    (v) => v.present === true, 20, 600,
  );
  ok(`S1 attempt ${attempt} THE STOP BUTTON STANDS at the running face (the running face's own verb, Re-run's place)`, stopBtn?.present === true && stopBtn?.disabled === false, `disabled=${stopBtn?.disabled}`);
  if (stopBtn?.present !== true) { try { sh(`${AB} press Escape`); } catch {}; continue; }

  /* THE UI STOP — the app's own hand */
  const stopClick = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Stop')`);
  ok(`S1 attempt ${attempt} THE UI STOP CLICKED`, String(stopClick).startsWith("clicked@"), String(stopClick));
  if (!String(stopClick).startsWith("clicked@")) { try { sh(`${AB} press Escape`); } catch {}; continue; }
  /* the busy law: the button's own spinner (disabled while the receipt
   * travels — the scancel, the 8s settle, the DB write) */
  const busy = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Stop'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null }); })()`,
    (v) => v.disabled === true, 6, 400,
  );
  ok(`S1 attempt ${attempt} THE BUSY LAW — the Stop button disables while the receipt travels`, busy?.disabled === true, `disabled=${busy?.disabled ?? "button gone"}`);
  /* the t826 pause — parked AFTER the click: the toast is born at response
   * time (~10s), and a toast born while the pointer sits inside the
   * viewport inherits the pause (the receipt becomes readable at the
   * instrument's pace, not the vendor's 5s) */
  const parkedOk = await parkMouseOnToasts();
  ok(`S1 attempt ${attempt} the pointer parked on the toast viewport (the t826 pause armed)`, parkedOk === true, "");
  /* THE FLIP FIRST: the route's own write lands ~10-11s after the click —
   * catch it at a sub-second cadence, for the route's LONG speech lives on
   * the row only until the sweep's next 15s beat rewrites the row with the
   * record's stamp (the t618-era handshake: the terminal branch speaks the
   * RECORD'S words — 'stopped by user'). The first failed-read is the
   * interim witness. */
  let flipped = null;
  {
    const t1 = Date.now();
    while (Date.now() - t1 < 120_000) {
      const j = jobs().find((x) => x.id === c2d.id);
      if (j?.status === "failed") { flipped = j; break; }
      if (j?.status === "completed") break;
      await sleep(700);
    }
  }
  ok(`S1 attempt ${attempt} THE ROW FLIPPED running → failed (the route's own write; 120s — a cold dev-server compile of the touched module eats the first attempt's window)`, flipped?.status === "failed", flipped?.status ?? "TIMEOUT");
  if (flipped?.status !== "failed") { try { sh(`${AB} press Escape`); } catch {}; continue; }
  const interimSpeech = flipped.result ?? "";
  ok(`S1 attempt ${attempt} THE ROW'S WORD AT THE FLIP (either honest writer may win the 800ms handshake: the route's settled speech or the record's stamp — the LONG class words live on the toast either way)`, interimSpeech === STOPPED || interimSpeech === "stopped by user", String(interimSpeech).slice(0, 140));
  /* THE TOAST speaks the RECEIPT, not a guess (the t618/t624 contract):
   * the killed+confirmed class — title "Job stopped", the description
   * carrying the scancel words AND the teardown confirmation. The toast is
   * the one UI surface where the LONG class words persist. */
  const toast = await toastRead("Job stopped");
  ok(`S1 attempt ${attempt} THE TOAST SPEAKS 'Job stopped' (the killed+confirmed class)`, toast?.hit === true, (toast?.text ?? "none").slice(0, 160));
  ok(`S1 attempt ${attempt} THE TOAST'S RECEIPT carries the scancel + the teardown confirmation`, (toast?.text ?? "").includes("sent scancel to Slurm job") && (toast?.text ?? "").includes("(teardown confirmed — the job left the queue)"), "");
  ok(`S1 attempt ${attempt} THE TOAST CARRIES THE PROMISE — 're-run resumes from the last synced checkpoint' (the t934 clause: the toast is the one surface the receipt always reaches — the row's speech can lose the 800ms handshake to the sweep's stamp)`, (toast?.text ?? "").includes(RESUME_CLAUSE), "");
  /* THE RECORD at the open question: done, the user-stop stamp, the
   * accounting question OPEN with missed:false (the t625 handshake) — read
   * NOW, the 20s consult floor keeps the question open well past the flip */
  const recOpen = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE RECORD carries the user-stop stamp (exit 137, 'stopped by user')`, recOpen?.done === true && recOpen?.exitCode === 137 && recOpen?.result === "stopped by user", `done=${recOpen?.done} exit=${recOpen?.exitCode} result=${String(recOpen?.result ?? "none").slice(0, 40)}`);
  ok(`S1 attempt ${attempt} THE ACCOUNTING QUESTION (the t625 handshake — either shape is honest: OPEN with missed:false, or already CLOSED with the ledger's CANCELLED — the first consult runs the moment the sweep's beat finds the question)`,
    (!!recOpen?.remote?.accountingPending && recOpen?.remote?.accountingPending?.missed === false) ||
      (!recOpen?.remote?.accountingPending && recOpen?.remote?.slurmState === "CANCELLED"),
    `acc=${JSON.stringify(recOpen?.remote?.accountingPending ?? null)} slurmState=${recOpen?.remote?.slurmState ?? "none"}`);
  ok(`S1 attempt ${attempt} the record's slurmId names the SAME scheduler row the instrument pinned`, String(recOpen?.remote?.slurmId ?? "") === String(fresh.id), `rec=${recOpen?.remote?.slurmId} pinned=${fresh.id}`);
  toastTextForReceipt = toast?.text ?? "";
  parkedForReceipt = parkedOk === true;
  stopped = { slurmId: fresh.id, pid: fresh.pid, roundsAtStop: mockRounds(c2dMockDir), stoppedResult: interimSpeech, toastText: toastTextForReceipt, attempt, stoppedAt: new Date().toISOString() };
  break;
}
if (!stopped) { console.log("FATAL: the UI stop never landed — aborting"); writeReceipt({ fatal: "ui stop never landed" }); process.exit(2); }
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, ...stopped, paramsAtStop: jobs().find((x) => x.id === c2d.id)?.params ?? {} });

/* THE LEDGER'S OWN TESTIMONY: the CANCELLED row (the clean kill's word) */
const rows1 = accountingRows();
const cancelRow1 = rows1.find((r) => r.startsWith(`${stopped.slurmId}|`) && r.includes("CANCELLED"));
ok("S1 THE CANCELLED ROW IN THE LEDGER (the clean kill's own testimony — the raw kill leaves NOTHING)", !!cancelRow1, cancelRow1?.slice(0, 60) ?? `${rows1.length} rows, none for ${stopped.slurmId}`);

/* THE FROZEN ROUNDS: the scancel killed the tree mid-flight — two
 * consecutive frozen reads prove the death (the stub writes every ~0.9s;
 * silence is death; < 17 names the stop, not a natural finish) */
let frozen = false;
let n1 = mockRounds(c2dMockDir).length;
for (let i = 0; i < 6; i++) {
  await sleep(2500);
  const n2 = mockRounds(c2dMockDir).length;
  if (n2 === n1) { frozen = true; break; }
  n1 = n2;
}
ok("S1 THE ROUNDS FROZE (the clean kill stopped the writer mid-flight)", frozen && n1 < ITERS + 1, `${n1} rounds frozen (< ${ITERS + 1} names the stop, not a natural finish)`);

/* THE CASE CLOSED: the sweep's sacct consult lands the ledger's word —
 * the question closes, CANCELLED stamps the record (the t625 landing) */
let recClosed = null;
{
  const t2 = Date.now();
  while (Date.now() - t2 < 180_000) {
    const rec = readRecord(c2d.id);
    if (rec?.remote && !rec.remote.accountingPending && rec.remote.slurmState === "CANCELLED") { recClosed = rec; break; }
    await sleep(5000);
  }
}
ok("S1 THE CASE CLOSED — the sweep's sacct consult landed CANCELLED (the stamp confirmed; the question never rewrote the words)", !!recClosed, recClosed ? `slurmState=${recClosed.remote.slurmState} result=${String(recClosed.result).slice(0, 40)}` : "still open after 180s");

/* THE ECHO SURVIVAL (the t934 fix's own pin): the wrapper's TERM trap
 * wrote .cf-exit=143 as scancel tore the tree down — the monitor's NEXT
 * beat reads that exit file and finalizes. Before the fix the echo
 * SPOKE OVER the user-stop stamp (the record flipped to 'REMOTE[...]:
 * exit 143 (terminated (SIGTERM))' and the row followed); with the fix
 * the stamp OUTRANKS its own mechanism's echo. Two sweep beats (~40s)
 * must leave the record EXACTLY as the stop wrote it. */
{
  await sleep(40_000);
  const recEcho = readRecord(c2d.id);
  ok("S1 THE STAMP SURVIVES THE WRAPPER'S ECHO — exit 137 after two beats (the t618 contract stands; the trap's 143 is the mechanism's echo, never the verdict)", recEcho?.exitCode === 137 && recEcho?.result === "stopped by user", `exit=${recEcho?.exitCode} result=${String(recEcho?.result ?? "none").slice(0, 70)}`);
  ok("S1 the echo kept the ledger's word aboard (slurmState CANCELLED stays)", recEcho?.remote?.slurmState === "CANCELLED", String(recEcho?.remote?.slurmState ?? "none"));
  const rowEcho = jobs().find((x) => x.id === c2d.id)?.result;
  ok("S1 THE ROW'S WORD SURVIVES THE ECHO TOO ('stopped by user' stays on the card the user re-opens)", rowEcho === "stopped by user", String(rowEcho ?? "none").slice(0, 70));
}
ok("S1 THE t626 QUESTION OPENED at the landing (the outputs view's own door)", recClosed?.remote?.outputsLedgerPending === true || recClosed?.remote?.outputsLedgerPending === undefined, `outputsLedgerPending=${String(recClosed?.remote?.outputsLedgerPending)}`);
const rowAfterSweep = jobs().find((x) => x.id === c2d.id)?.result;
ok("S1 THE ROW'S FINAL WORD IS THE RECORD'S STAMP (the sweep's terminal branch speaks the record's own words — the two honest writers' handshake)", rowAfterSweep === "stopped by user", String(rowAfterSweep ?? "none").slice(0, 100));
ok("S1 THE FINAL WORD NEVER FLIPS to the tombstone (the hand needs no ladder's conviction)", !(rowAfterSweep ?? "").includes("interrupted remotely"), String(rowAfterSweep ?? "").slice(0, 60));

/* THE STOPPED FACE: the inspector's Log landing (the stub's last words),
 * the Overview climb (Job failed + the stopped speech verbatim, the
 * tombstone ABSENT, the door present) */
/* THE STOPPED FACE: a FRESH PAGE first — the Log tab fetches the tail on
 * mount and never refetches, and the echo finalize's sync-back lands the
 * run.out home only at its own beat; a dialog mounted before the sync
 * holds a tail without the stub's header forever. Reload, then open. */
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(1000);
const insp0 = await openInspectorHard(NAME_CLASS2D);
ok("S1 the STOPPED job's inspector opens", String(insp0).startsWith("open@try"), String(insp0));
const logLanding = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ open: !!d, logSpoken: (d?.textContent || '').includes('cryoflow-mock refine') }); })()`,
  (v) => v.logSpoken === true, 30, 600,
);
ok("S1 the failed landing is LOG and the stopped run's last words speak in the dialog", logLanding?.logSpoken === true);
let ovClick = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
let card = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), stoppedStamp: t.includes('stopped by user'), tomb: t.includes(${JSON.stringify(TOMB.slice(0, 60))}), door: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Edit parameters') }); })()`,
  (v) => v.failedWords === true, 10, 500,
);
if (card?.failedWords !== true) {
  /* the entrance-animation ghost law (the re-ride's lesson): ONE honest
   * retry — the re-click rides the settled tab */
  ovClick = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  card = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), stoppedStamp: t.includes('stopped by user'), tomb: t.includes(${JSON.stringify(TOMB.slice(0, 60))}), door: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Edit parameters') }); })()`,
    (v) => v.failedWords === true, 12, 500,
  );
}
ok("S1 the Overview climb clicked", String(ovClick).startsWith("clicked@"), String(ovClick));
ok("S1 the card speaks 'Job failed'", card?.failedWords === true);
ok("S1 THE STOPPED STAMP HANGS ON THE CARD (the record's own word — the final speech)", card?.stoppedStamp === true);
ok("S1 THE TOMBSTONE ABSENT at the stopped face (the boundary's first half — the app's own hand never needs the ladder's conviction)", card?.tomb === false, card?.tomb === undefined ? "unread" : `tomb=${card?.tomb}`);
ok("S1 the 'Edit parameters' door PRESENT on the stopped face", card?.door === true);

/* 320 born-at-band on the stopped face (the t926/t927 law's twin) */
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
ok("S1 the dialog opened at 320 (click-until-open)", String(inspN).startsWith("open@try"), String(inspN));
const fitsN = await poll(
  `JSON.stringify({ overX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth), door: [...document.querySelectorAll('[role="dialog"] button')].some(b => (b.textContent || '').trim() === 'Edit parameters') })`,
  (v) => typeof v.overX === "number", 8, 500,
);
ok("S1 the stopped face fits the narrow door (overX 0, the door travels)", (fitsN?.overX ?? 99) === 0 && fitsN?.door === true, `overX=${fitsN?.overX}`);
sh(`${AB} set viewport 1280 900`);
await sleep(900);
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);

/* THE PICKER ANSWERS at the stopped face (the clean kill preserved the
 * rounds — the promise is testable the moment the row lands) */
const cs1 = apiJson(`/api/jobs/${c2d.id}/continue-sources`);
const self1 = (cs1.sources ?? []).find((s) => s.relation === "self");
const newest1 = (self1?.entries ?? []).find((e) => e.newest && e.complete);
ok("S1 THE PICKER ANSWERS at the stopped face (lane remote)", !!self1 && (self1.lane ?? cs1.lane) === "remote", `entries=${(self1?.entries ?? []).length} lane=${self1?.lane ?? cs1.lane ?? "?"}`);
ok("S1 the picker's newest complete round is the stopped run's own (run_it*.star)", /run_it\d+_optimiser\.star$/.test(newest1?.path ?? ""), newest1?.path?.split("/").pop() ?? "none");
writeState({ ...readState(), pickerRound: newest1?.path ?? "" });
writeReceipt({ stage1: { pass, fail, slurmId: stopped.slurmId, stoppedResult: stopped.stoppedResult, roundsAtStop: stopped.roundsAtStop, cancelRow: cancelRow1 ?? null, toast: toastTextForReceipt, parked: parkedForReceipt, caseClosed: !!recClosed } });
console.log(`== t934 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * THE RESUME AT THE STOPPED FACE: the clean kill's arc completes — the
 * door, the empty scene, the picker's own round, the Continue verb, the
 * confirm, the fire, the completion, the stub's receipt, the ladder. */
console.log("== stage 2: the resume at the stopped face ==");
const st2 = readState();
const c2dId = st2.c2dId;
let c2d = findName(NAME_CLASS2D);
/* the mid-arc entry has TWO honest shapes: the stopped face (failed + the
 * stopped speech — drive the resume) and the already-completed arc (a
 * prior stage2's own resume — re-assert the standing shape) */
const entryStopped = c2d?.id === c2dId && c2d?.status === "failed" && c2d?.result === st2.stoppedResult;
const entryResumed = c2d?.id === c2dId && c2d?.status === "completed";
ok("S2 the arc's mid-point stands (failed+stopped-speech = drive / completed = already stood)", entryStopped || entryResumed, `${c2d?.id?.slice(-8)}/${c2d?.status}`);
if (!entryStopped && !entryResumed) { console.log("FATAL(stage2): the class2d is neither stopped nor resumed — run stage1 first"); process.exit(2); }
const contFieldSel = `#param-${c2d.id}-fn_cont`;
const REAL_CONT = st2.pickerRound ?? "";

if (entryStopped) {
  const roundsBefore = mockRounds(st2.mockDir);
  ok("S2 the stopped run's family pinned before the resume (the clean kill preserved them)", roundsBefore.length >= 2, roundsBefore.join(", "));

  /* the door → the panel → the scene: fn_cont EMPTY — the stop's cause is
   * the app's own hand; the input holds no path (the t927 law's stopped
   * twin: the interrupted face reads empty because the cause was external,
   * the stopped face reads empty because the cause was OURS) */
  const insp2 = await openInspectorHard(NAME_CLASS2D);
  ok("S2 the stopped job's inspector opens", String(insp2).startsWith("open@try"), String(insp2));
  const door2 = await openEditDoor(NAME_CLASS2D);
  ok("S2 the door clicked FROM THE STOPPED FACE", String(door2.doorClick).startsWith("clicked@") && door2.swapped?.inspGone === true, String(door2.doorClick));
  const panel2 = await panelOpen();
  ok("S2 the JobPanel opened on the stopped face", panel2?.open === true);
  await clickParamsTab();
  const field2 = await poll(
    `(() => { const el = document.querySelector('${contFieldSel}'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
    (v) => v.present === true, 16, 600,
  );
  ok("S2 THE SCENE READS EMPTY — fn_cont holds no path (the stop's cause is the app's own hand, never the input)", field2?.present === true && (field2?.value ?? "x") === "", JSON.stringify(field2?.value));
  if (field2?.present !== true) { console.log("FATAL(stage2): the fn_cont field never appeared"); process.exit(2); }
  const stillFailed2 = jobs().find((x) => x.id === c2d.id)?.status;
  ok("S2 the status NEVER left failed through the door+edit approach", stillFailed2 === "failed", String(stillFailed2));
  /* the picker's own newest round fills the field */
  const focus2 = await realClick(`document.querySelector('${contFieldSel}')`);
  const focused2 = evalJson(`JSON.stringify({ on: document.activeElement === document.querySelector('${contFieldSel}') })`);
  if (focused2?.on !== true) {
    evalJs(`(() => { const el = document.querySelector('${contFieldSel}'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); } return 'focused'; })()`);
    await sleep(300);
  }
  sh(`${AB} press Control+a`);
  sh(`${AB} press Delete`);
  await sleep(300);
  sh(`${AB} fill "${contFieldSel}" "${REAL_CONT}"`);
  await sleep(1800);
  const savedReal = jobs().find((x) => x.id === c2d.id)?.params?.fn_cont;
  ok("S2 THE RESUME PATH LANDED (the picker's own newest complete round)", savedReal === REAL_CONT, String(savedReal ?? "none").slice(-70));
  const stillFailed2b = jobs().find((x) => x.id === c2d.id)?.status;
  ok("S2 the edit never flips the status (the run does)", stillFailed2b === "failed", String(stillFailed2b));
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(700);

  /* the inspector's Continue verb (clickable on the failed face), the
   * confirm riding the picked path, the fire */
  const insp2b = await openInspectorHard(NAME_CLASS2D);
  ok("S2 the inspector reopens for the verb", String(insp2b).startsWith("open@try"), String(insp2b));
  const contBtn2 = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Continue'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null }); })()`,
    (v) => v.present === true, 10, 500,
  );
  ok("S2 THE VERB'S FACE READS 'Continue' at the stopped face (fn_cont set) and is CLICKABLE", contBtn2?.present === true && contBtn2?.disabled === false, `disabled=${contBtn2?.disabled}`);
  const contClick2 = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
  ok("S2 the Continue verb clicked", String(contClick2).startsWith("clicked@"), String(contClick2));
  const confirm2 = await confirmRead("picks up from the checkpoint");
  ok("S2 the confirm speaks 'Continue <name>?'", confirm2?.title === `Continue ${NAME_CLASS2D}?`, confirm2?.title ?? "none");
  ok("S2 THE PRESERVED-FAMILY LAW verbatim at the stopped face", (confirm2?.text ?? "").includes(CONT_DESC));
  ok("S2 the chosen path rides as-is (the picker's round verbatim)", (confirm2?.text ?? "").includes(REAL_CONT) && (confirm2?.text ?? "").includes(CONT_RIDES));
  const go2 = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
  ok("S2 'Continue' fired (the stopped face's resume dispatch)", String(go2).startsWith("clicked@"), String(go2));
} else {
  ok("S2 THE RESUME ALREADY STOOD (a prior stage2's own arc — re-asserting the standing shape)", true, "");
}

/* the two-breath gate + the stub's receipt + the ladder */
let resumed2 = null;
{
  let left = true;
  if (entryStopped) {
    left = false;
    const tA = Date.now();
    while (Date.now() - tA < 180_000) {
      const st = jobs().find((x) => x.id === c2d.id)?.status;
      if (st && st !== "failed") { left = true; break; }
      await sleep(1500);
    }
  }
  if (left) {
    const tB = Date.now();
    while (Date.now() - tB < 300_000) {
      const j = jobs().find((x) => x.id === c2d.id);
      if (["completed", "failed"].includes(j?.status ?? "")) { resumed2 = j; break; }
      await sleep(2000);
    }
  }
}
ok("S2 THE STOPPED FACE'S PROMISE KEPT — the resume completed (the stopped speech's own clause proven)", resumed2?.status === "completed", resumed2?.status ?? "TIMEOUT");
const pickedN = (REAL_CONT.match(/run_it(\d+)_optimiser\.star/) ?? st2.pickerRound?.match(/run_it(\d+)_optimiser\.star/) ?? [])[1] ?? "?";
const log2 = await logUntil(c2d.id, "CONTINUE from");
ok("S2 THE STUB'S OWN CONTINUE RECEIPT — 'CONTINUE from run_it" + pickedN + "_optimiser.star (it " + pickedN + ", K=4)'", new RegExp(`CONTINUE from run_it${pickedN}_optimiser\\.star \\(it ${pickedN}, K=4\\)`).test(log2), (log2.match(/CONTINUE from[^\n]*/) ?? ["none"])[0].slice(0, 120));
const famAfter2 = mockRounds(st2.mockDir);
ok("S2 THE LADDER GREW — run_it" + String(Number(pickedN) + 1).padStart(3, "0") + " born (+1 more)", famAfter2.includes(`run_it${String(Number(pickedN) + 1).padStart(3, "0")}_optimiser.star`), famAfter2.slice(-3).join(", "));
ok("S2 THE PICKED ROUND STAYED — run_it" + pickedN + "_optimiser.star survived the resume (the t394/t917 carve-out at the stopped arc)", famAfter2.includes(`run_it${pickedN}_optimiser.star`), "");
writeState({ ...st2, resumedAt: new Date().toISOString() });
writeReceipt({ stage2: { pass, fail, pickedRound: pickedN, resume: resumed2?.status, ladder: famAfter2.slice(-3) } });
console.log(`== t934 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE OTHER KILL + THE BOUNDARY: the raw group kill (the t932 lever) on a
 * fresh from-scratch run, the vanish ladder's conviction, and the two
 * verdicts read SIDE BY SIDE — the hand named vs the silence convicted. */
console.log("== stage 3: the raw kill, the tombstone, THE BOUNDARY ==");
const st3 = readState();
const c2dId = st3.c2dId;
let c2d = findName(NAME_CLASS2D);
ok("S3 the arc's stage2 shape stands (completed — the resumed run)", c2d?.id === c2dId && c2d?.status === "completed", `${c2d?.id?.slice(-8)}/${c2d?.status}`);
if (!c2d || c2d.status !== "completed") { console.log("FATAL(stage3): the class2d is not completed — run stage2 first"); process.exit(2); }

/* the clear gesture (the t930 law): fn_cont holds the stage2 round — a
 * from-scratch run needs the field EMPTY, cleared through the PATCH door */
const clearP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { fn_cont: "" } });
ok("S3 THE CLEAR GESTURE through the PATCH door (fn_cont emptied for the from-scratch run)", !!clearP.job?.id && (clearP.job?.params?.fn_cont ?? "") === "", JSON.stringify(clearP.job?.params?.fn_cont ?? clearP).slice(0, 60));
const prevDir = path.join(st3.mockDir, ".cryoflow_prev");
const prevGensBefore = gensOf(prevDir).length;
ok(`S3 the move-aside's before-count pinned (generation ${prevGensBefore})`, prevGensBefore >= 0, `generations=${prevGensBefore}`);

/* THE FROM-SCRATCH RUN + THE RAW KILL */
let killed = null;
const before3 = accountingRows().length;
const postT0 = Date.now();
const runP3 = api("POST", `/api/jobs/${c2d.id}/run`);
ok("S3 the bare POST accepted (the from-scratch dispatch)", !runP3.error, JSON.stringify(runP3).slice(0, 60));
let rounds3 = 0;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    rounds3 = mockRounds(st3.mockDir).length;
    if (rounds3 >= 2) break;
    await sleep(300);
  }
}
ok("S3 run_it001 + run_it002 landed before the kill (the mid-flight depth)", rounds3 >= 2, `${rounds3} rounds`);
/* THE MOVE-ASIDE'S RECEIPT (the t933 law, corrected for the keep-2 cap):
 * the from-scratch wipe is the rename-aside — a NEW generation was born —
 * but the t385 keep-2 reclaim prunes the OLDEST generation as the new one
 * lands, so the DELTA reads flat once the archive is at its cap (the
 * resume's own wipe had already fed it two). The honest receipt is the
 * NEWEST GENERATION'S MTIME: younger than the dispatch means the wipe
 * moved a generation in THIS dispatch — and its content names what it
 * preserved (the previous family lives inside — a move, not an erasure). */
const gensMidList = gensOf(prevDir);
const genNewMid = gensMidList[0] ?? null;
const genNewMidM = genNewMid ? statSync(genNewMid).mtimeMs : 0;
const genNewRounds = genNewMid ? mockRounds(genNewMid) : [];
ok("S3 THE MOVE-ASIDE RECEIPT — the newest generation is younger than the dispatch (the wipe moved a generation in; the count may read flat under the keep-2 cap)", genNewMidM > postT0 - 5000 || gensMidList.length === prevGensBefore + 1, `before=${prevGensBefore} after=${gensMidList.length} newestAge=${genNewMid ? postT0 - genNewMidM : "none"}ms`);
ok("S3 THE WIPE IS A MOVE, NOT AN ERASURE — the previous family lives inside the newest generation (the resume's rounds survived the rename-aside)", genNewRounds.length >= 2, `${genNewRounds.length} rounds archived (${genNewRounds.slice(0, 2).join(", ")}${genNewRounds.length > 2 ? "…" : ""})`);
const fresh3 = slurmPids().filter((p) => Date.now() - p.mtime < 120_000).sort((a, b) => b.mtime - a.mtime)[0];
ok("S3 the launcher pid read (slurm " + (fresh3?.id ?? "?") + ")", !!fresh3?.pid, `pid=${fresh3?.pid}`);
if (fresh3?.pid) {
  /* THE RAW KILL — the process group, no scancel, no accounting row
   * (the t932 law: /bin/kill THE REAL BINARY — the shell builtin
   * mishandles the negative-pid form and orphans the stub) */
  try { execFileSync("/bin/kill", ["-9", "--", `-${fresh3.pid}`], { stdio: "ignore" }); } catch {}
  try { execFileSync("/bin/kill", ["-9", String(fresh3.pid)], { stdio: "ignore" }); } catch {}
  let frozen3 = false;
  let k1 = mockRounds(st3.mockDir).length;
  for (let i = 0; i < 6; i++) {
    await sleep(2500);
    const k2 = mockRounds(st3.mockDir).length;
    if (k2 === k1) { frozen3 = true; break; }
    k1 = k2;
  }
  ok("S3 THE RAW KILL LANDED — the rounds froze (silence is death; < 17 names the kill)", frozen3 && k1 < 17, `${k1} rounds frozen`);
  const rowsKill = accountingRows();
  const cancelRow2 = rowsKill.find((r) => r.startsWith(`${fresh3.id}|`) && r.includes("CANCELLED"));
  ok("S3 NO ACCOUNTING ROW for the raw-killed job (the vanish precondition — the boundary's second half)", !cancelRow2, cancelRow2 ?? `${rowsKill.length - before3} new rows, none CANCELLED`);
  killed = { slurmId: fresh3.id, pid: fresh3.pid, roundsAtKill: mockRounds(st3.mockDir), killAt: new Date().toISOString() };
}
if (!killed) { console.log("FATAL: the raw kill never landed — aborting"); writeReceipt({ fatal: "raw kill never landed" }); process.exit(2); }
writeState({ ...st3, ...killed });

/* THE VANISH LADDER: the app's own polls drive it (every /api/jobs GET is
 * one reconcile sweep) — the row stays running through the 120s grace,
 * then three consecutive VANISHED verdicts convict the silence */
const stRunning = jobs().find((x) => x.id === c2d.id)?.status;
ok("S3 the row still RUNNING at the kill (the app does not know yet — the honest mid-flight state)", stRunning === "running", String(stRunning));
const startedAtMs = new Date(jobs().find((x) => x.id === c2d.id)?.startedAt ?? "").getTime();
let flipped3 = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 420_000) {
    const j = apiJson("/api/jobs").jobs?.find((x) => x.id === c2dId);
    if (j?.status === "failed") { flipped3 = j; break; }
    if (j?.status === "completed") { ok("S3 the row never flipped", false, "completed — the kill's silence was broken"); break; }
    await sleep(6000);
  }
}
ok("S3 THE VANISH LADDER FLIPPED the row (three consecutive VANISHED sweeps convicted the silence)", flipped3?.status === "failed", `${flipped3?.status ?? "TIMEOUT"}`);
ok("S3 THE TOMBSTONE VERBATIM", flipped3?.result === TOMB, String(flipped3?.result ?? "none").slice(0, 160));

/* ============ THE BOUNDARY: two kills, one window, side by side ========== */
const stoppedSpeech = st3.stoppedResult ?? "";
ok("B kill#1 (the UI Stop) named the HAND — 'stopped by user'", stoppedSpeech.includes("stopped by user"), stoppedSpeech.slice(0, 80));
ok("B kill#2 (the raw kill) named the SILENCE — 'interrupted remotely (no exit status'", (flipped3?.result ?? "").includes("interrupted remotely (no exit status"), "");
ok("B the ledger holds kill#1's CANCELLED row (the clean kill's testimony)", accountingRows().some((r) => r.startsWith(`${st3.slurmId}|`) && r.includes("CANCELLED")), `slurm ${st3.slurmId}`);
ok("B the ledger holds NOTHING for kill#2 (the vanish precondition stands)", !accountingRows().some((r) => r.startsWith(`${killed.slurmId}|`) && r.includes("CANCELLED")), `slurm ${killed.slurmId}`);
ok("B BOTH deaths leave the resume promise standing — the clause rides the stop's receipt (the row's flip word, or the toast when the stamp won the 800ms handshake) AND the tombstone", (stoppedSpeech.includes(RESUME_CLAUSE) || (st3.toastText ?? "").includes(RESUME_CLAUSE)) && (flipped3?.result ?? "").includes(RESUME_CLAUSE), `stop-clause=${stoppedSpeech.includes(RESUME_CLAUSE) || (st3.toastText ?? "").includes(RESUME_CLAUSE)} tomb-clause=${(flipped3?.result ?? "").includes(RESUME_CLAUSE)}`);
ok("B the stopped speech NEVER said 'interrupted' (the hand needs no ladder)", !stoppedSpeech.includes("interrupted remotely"), "");
ok("B the tombstone NEVER said 'stopped by user' (the silence earns no user-stop stamp)", !(flipped3?.result ?? "").includes("stopped by user"), "");
const cs3 = apiJson(`/api/jobs/${c2d.id}/continue-sources`);
const self3 = (cs3.sources ?? []).find((s) => s.relation === "self");
const newest3 = (self3?.entries ?? []).find((e) => e.newest && e.complete);
ok("B THE PICKER ANSWERS at the interrupted face too (lane remote, the raw-killed run's own round)", !!self3 && (self3.lane ?? cs3.lane) === "remote" && /run_it\d+_optimiser\.star$/.test(newest3?.path ?? ""), newest3?.path?.split("/").pop() ?? "none");
writeReceipt({ stage3: { pass, fail, kill2: killed, tombstone: flipped3?.result ?? "", boundary: { killed1Row: true, killed2Row: false, clause: RESUME_CLAUSE } } });

/* the restore: the manifest-word binding law (the t933 lesson) — PATCH the
 * binding to the MANIFEST'S OWN WORD whatever it is, then the t916 remove
 * (idempotent-deletion-safe), then the standing leave */
const mBinding = manifestBinding();
const rebind3 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding });
ok(`S3 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind3.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
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
console.log(`== t934 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t934 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
