#!/usr/bin/env node
/**
 * t930 — the failed face at a REMOTE lane. Carried three times into the
 * entries (t927 → t928 → t929), this is the failed-face arc's remote twin:
 * t927 rode the failed face of a NATIVE filter lane (the empty-list refusal,
 * the local engine gate); no one has ever watched a REMOTE-lane run fail,
 * nor heard the confirm dialog's wipe speech name the cluster ("on this
 * machine and on the cluster"), nor seen the Continue-vs-Start-again modes
 * AT the failed face. Two arcs, both through the product's own doors:
 *
 *   prep  the seed trio asserted (import, MC-1, CTF-1 — completed), the
 *         t916 mint re-rides (the class graph: autopick → extract →
 *         class2d A K=4 → select2d), the mock-side run_it family pinned.
 *
 *   band B — THE SEED CTF'S FAILED REMOTE FACE (the .qa-ctf-allfail lever,
 *         the mock's ctffind stub speaking REAL RELION's own failure):
 *     the lever touched next to MC-1's micrographs star ON THE MOCK FS;
 *     CTF-1 re-runs (remote lane); the stub exits 6 with the real
 *     ctffind_runner.cpp text; the row flips FAILED; the Log tail holds
 *     the per-mic WARNINGs + the ERROR verbatim; the failed face's
 *     inspector lands on Log (the t927 law), the Overview climb speaks
 *     "Job failed" + the result; the "Edit parameters" door PRESENT on
 *     the failed REMOTE face + its tooltip; 320 born-at-band on the
 *     failed remote face (the t926 find-bar law, the t927 N band's remote
 *     twin); the confirm "Re-run CTF Estimation 1?" teaching THE WIPE —
 *     "on this machine and on the cluster" (the clause the native lane
 *     could never earn); the lever removed (the cluster fs's own cure —
 *     the cause lived OUTSIDE the params this time); "Start again" fires;
 *     the unflip gate waits for the run's OWN verdict; /ctf answers 6 rows.
 *
 *   band A — THE CLASS2D CONTINUE ARC (both confirm modes at one failed
 *     face; the stub's --continue validation; the t394/t917 wipe-preserve):
 *     the "Continue from here:" field (fn_cont — the panel's one COMPOUND
 *     widget) filled with a NONEXISTENT checkpoint (run_it009); the verb's
 *     face flips to "Continue"; the confirm "Continue <name>?" rides the
 *     path verbatim; the mock's refine stub refuses ("checkpoint … does
 *     not exist" — the GUI's own validation mirrored); the row flips
 *     FAILED ON A CONTINUE RUN; the run_it family UNTOUCHED (the
 *     keepIterations carve-out, witnessed at the failure); the failed
 *     face's door; THE CAUSE AT THE SCENE (the field holds the bad path);
 *     the recovery edit (the REAL clear gesture, then the REAL round's
 *     path taken from /continue-sources' own payload — newest complete);
 *     the confirm speaks the recovery's path; "Continue" fires; the
 *     unflip; the stub's own continue receipt ("CONTINUE from run_it002
 *     (it 002, K=4) +1 more"); THE LADDER GREW (run_it003 born) while
 *     run_it002 stayed (the preserved family); then the Start-again face:
 *     the field cleared, the button reads "Re-run" again, the confirm
 *     teaches the wipe + the cluster clause, the fresh run rewrites the
 *     ladder (it002's mtime moves — the from-scratch receipt).
 *
 *   band P  the persist reload: CTF-1 completed (6 rows), class2d
 *           completed, fn_cont EMPTY at the data layer (the clear held).
 *   band R  the restore: the t916 remove (downstream first, both sides),
 *           the seed trio + 2 edges, the lever absent, the doctor CLEAN.
 *
 *   node scripts/t930-remote-failed-face-witness.mjs main
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t930-remote-failed-face-witness.json";
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const CTF_ERROR = "failed to estimate CTF parameters for any micrograph, exiting...";
const CTF_LINE = "in: ctffind_runner.cpp, line 467";
const TIP_DOOR = "without resetting — the completed run and its results stay until a Re-run replaces them";
const WIPE_CLUSTER = "on this machine and on the cluster";
const WIPE_STAY = "Existing downstream results stay on disk until those jobs re-run";
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
const hoverTip = async (btnExpr, needle) => {
  for (let i = 0; i < 6; i++) {
    const pos = evalJson(`(() => { const el = (${btnExpr}); if (!el) return JSON.stringify({}); const r = el.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
    if (pos?.x) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      const tip = await poll(
        `JSON.stringify({ tips: [...document.querySelectorAll('[role="tooltip"]')].map(t => (t.textContent || '').trim()) })`,
        (v) => v.tips.some((t) => t.includes(needle)), 8, 500,
      );
      if (tip) return tip;
    }
    sh(`${AB} mouse move 4 4`);
    await sleep(800);
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
  /* the transient-reset law (the first ride's crash: one curl 56 killed the
   * unflip poll while the server stayed alive) — a READ retries; a click
   * never does */
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
/* the log read races the run's own file write — read-until-it-speaks */
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
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 12, 600,
  );
  ok(`card "${name}" clicked → inspector opened`, String(clicked).startsWith("clicked@") && opened?.open === true, String(clicked));
  return opened?.open === true;
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
const panelOpen = async () => poll(
  `(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); const tabs = [...(a?.querySelectorAll('[role="tab"]') ?? [])].map(t => t.textContent?.trim()); return JSON.stringify({ open: tabs.includes('Params') && tabs.includes('Log'), tabs }); })()`,
  (v) => v.open === true, 12, 600,
);
const clickParamsTab = async () => realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`);
/* the door: inspector → JobPanel swap (the t927 law — one door replaces the other) */
const openEditDoor = async (name) => {
  /* the ENTRANCE-ANIMATION law (the third ride's lesson): the dialog's
   * Radix entrance slides the door button — a rect read mid-animation
   * clicks a ghost position (the first ride's y drifted 104px). Wait for
   * the button's rect to hold still across two reads before clicking. */
  const stable = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Edit parameters'); if (!b) { window.__t930door = null; return JSON.stringify({ stable: false }); } const r = b.getBoundingClientRect(); const cur = Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width); const prev = window.__t930door; window.__t930door = cur; return JSON.stringify({ stable: prev === cur && cur !== null, x: Math.round(r.x), y: Math.round(r.y) }); })()`,
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
/* the failed-face read: Log is the failed default (the t927 law); the
 * Overview climb hangs the verdict card */
const failedFaceRead = async (name, needle) => {
  /* the log tail is fetched AFTER the dialog paints (the t929 law — a face
   * read gates on the ROW it asserts about, never the container): poll for
   * the needle's appearance — the poll proves the failed default landing
   * (Log) AND the stub's line speaking, in one honest gate */
  const logLanding = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d, logSpoken: (d?.textContent || '').includes(${JSON.stringify(needle)}) }); })()`,
    (v) => v.logSpoken === true, 14, 600,
  );
  const ovClick = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  const card = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), door: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Edit parameters') }); })()`,
    (v) => v.failedWords === true, 10, 500,
  );
  return { logLanding, ovClick, card };
};
/* the confirm dialog read — the AlertDialog floats on the inspector */
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

/* =========================== stage ========================================
 * The ride runs INLINE (the tool's process group reaps background spawns —
 * the first launch died at 79 bytes, no error, no trace) and the whole arc
 * outlives the 10-minute bash cap — so the witness speaks in TWO stages:
 *   stage1 = prep + band B (the mint, the CTF allfail arc)
 *   stage2 = band A + P + R (the class2d continue arc, the persist, the
 *            restore) — re-derives every name from the live world, so the
 *            two calls share NO state but the world itself.
 * "main" runs both in one process (the original shape).
 * ======================================================================== */
const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";

/* =========================== prep ======================================== */
console.log(`== prep (stage ${STAGE}): the seed trio, the t916 mint re-rides, the mock-side family pinned ==`);
const seedCtf0 = findName(NAME_CTF_A);
const seedMc0 = findName(NAME_MC_A);
ok("prep the seed trio present (MC-1 completed; CTF-1 healed by this arc if failed)", !!seedCtf0 && !!seedMc0 && seedMc0?.status === "completed" && ["completed", "failed"].includes(seedCtf0?.status ?? ""), `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));
const staleLever0 = path.join(MOCK_PROJECTS, "cmv4v0ue60000pp5i7i2gu10k", "motioncorr_" + (seedMc0?.id ?? "").slice(-8), ".qa-ctf-allfail");
if (existsSync(staleLever0)) { try { rmSync(staleLever0); } catch {} }
ok("prep no stale allfail lever on the mock side", !existsSync(staleLever0));

let c2d = null, c2dMockDir = null, famIt2Opt = null, famIt1Opt = null, REAL_CONT = "", BAD_CONT = "", mcMockDir = null;
const projId = "cmv4v0ue60000pp5i7i2gu10k";
if (RUN_S1) {
let mintOut = "(skipped — the chain stands)";
c2d = findName(NAME_CLASS2D);
if (c2d?.status === "completed") {
  ok("prep the t916 chain stands from a prior ride (mint skipped)", true, `class2d ${c2d.id.slice(-8)} completed`);
} else {
  if (c2d) { try { sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch {} }
  try { mintOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs mint 2>&1`); } catch (e) { mintOut = String(e); }
  ok("prep the t916 mint GREEN", /mint GREEN — \d+ ok, 0 fail/.test(mintOut), (mintOut.match(/== mint .*/) ?? ["?"])[0]);
  c2d = findName(NAME_CLASS2D);
  ok("prep the class2d witness completed", c2d?.status === "completed", c2d?.status);
  if (!c2d || c2d.status !== "completed") { console.log("FATAL: no class2d witness — aborting"); writeReceipt({ fatal: "no class2d" }); process.exit(2); }
}

/* t300 — the BINDING DOOR: the world's standing state is binding=null (the
 * t929 leave), and on an unbound world the UI's bare POST takes the LOCAL
 * lane (the first ride's honest lesson — the failure came back "RELION not
 * detected", the local gate's own word). Bind the project to the Mock
 * Cluster through the product's own PATCH door, so EVERY door's bare POST
 * (card menu / palette / inspector Re-run — the store's own words) inherits
 * the remote lane the way a bound project always has. The restore unbinds. */
const connsP = apiJson("/api/remote/connections").connections ?? [];
const connP = connsP.find((c) => c.name === "Mock Cluster");
ok("prep the Mock Cluster connection resolved", !!connP?.id, connP?.id?.slice(0, 14));
if (!connP?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: connP.id });
ok("prep THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));
const regP = (() => { try { return JSON.parse(readFileSync(path.join(ROOT, "data", "projects.json"), "utf8")); } catch { return {}; } })();
ok("prep the registry's binding reads the connection (setProjectRemote's own write)", regP?.projects?.[projId]?.remote?.connectionId === connP.id, JSON.stringify(regP?.projects?.[projId]?.remote ?? "null").slice(0, 60));

c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);
famIt2Opt = path.join(c2dMockDir, "run_it002_optimiser.star");
famIt1Opt = path.join(c2dMockDir, "run_it001_optimiser.star");
ok("prep the mock-side run_it family pinned (it001 + it002 optimisers)", existsSync(famIt1Opt) && existsSync(famIt2Opt), `${path.basename(c2dMockDir)}`);
const it2Txt = existsSync(famIt2Opt) ? readFileSync(famIt2Opt, "utf8") : "";
ok("prep the it002 optimiser carries the iteration law (_rlnCurrentIteration 2)", /_rlnCurrentIteration\s+2\b/.test(it2Txt));

/* the continue-sources payload — the picker's own law, read BEFORE anything fires */
const cs0 = apiJson(`/api/jobs/${c2d.id}/continue-sources`);
const self0 = (cs0.sources ?? []).find((s) => s.relation === "self");
const entries0 = self0?.entries ?? [];
const newest0 = entries0.find((e) => e.newest && e.complete);
ok("prep continue-sources answers (self, remote lane)", !!self0 && self0.lane === "remote", `entries=${entries0.length} lane=${self0?.lane ?? "none"}`);
ok("prep the picker's completeness law (run_it002 newest complete)", !!newest0 && /run_it002_optimiser\.star$/.test(newest0.path ?? ""), newest0?.path ?? "none");
ok("prep the picker judges EVERY round complete (the stub's family is whole)", entries0.length >= 2 && entries0.every((e) => e.complete === true), entries0.map((e) => e.iteration).join(","));
REAL_CONT = newest0?.path ?? "";
BAD_CONT = `/projects/cryoflow/${projId}/class2d_${c2d.id.slice(-8)}/run_it009_optimiser.star`;

writeReceipt({ prep: { c2d: c2d.id, realCont: REAL_CONT, badCont: BAD_CONT, entries: entries0.length } });
} else {
/* stage2/stage3: NO prep work here — the stage blocks self-derive
 * everything (stage2's A-prep mints/binds; stage3's A2 head asserts the
 * mid-arc state). The old else asserted the stage1 leave and FATALed on
 * stage3's honest failed mid-point — dead code in every mode. */
}

/* =========================== band B ====================================== */
if (RUN_S1) {
console.log("== band B: THE SEED CTF'S FAILED REMOTE FACE — the allfail lever, the real ctffind text, the wipe's cluster clause ==");
mcMockDir = path.join(MOCK_PROJECTS, projId, `motioncorr_${seedMc0.id.slice(-8)}`);
const mcStar = path.join(mcMockDir, "corrected_micrographs.star");
ok("B the mock-side MC-1 corrected_micrographs.star exists (the lever's home dir)", existsSync(mcStar), mcStar.replace(ROOT + "/", ""));
writeFileSync(path.join(mcMockDir, ".qa-ctf-allfail"), "t930 witness lever\n");
ok("B the .qa-ctf-allfail lever touched (beside the star the stub reads)", existsSync(path.join(mcMockDir, ".qa-ctf-allfail")));
/* the BARE POST — the project's binding (set through the t300 door in prep)
 * decides the lane server-side: the same shape every UI door speaks
 * (card menu / palette / inspector Re-run). The first ride proved the
 * negative: unbound, this same bare POST died at the RELION gate. */
const fireB = api("POST", `/api/jobs/${seedCtf0.id}/run`);
ok("B the CTF-1 re-run accepted (the binding fallback's remote lane)", fireB.ok === true || fireB.staging === true || fireB.started === true || !!fireB.job, JSON.stringify(fireB).slice(0, 90));
/* the two-breath gate (the class2d arc's law travelling): the CTF-1's
 * pre-state is completed — wait for the row to LEAVE completed first */
let failedB = { status: "TIMEOUT" };
{
  let leftB = false;
  const tB0 = Date.now();
  while (Date.now() - tB0 < 120_000) {
    const stB = jobs().find((x) => x.id === seedCtf0.id)?.status;
    if (stB && stB !== "completed") { leftB = true; break; }
    await sleep(1500);
  }
  if (leftB) failedB = await pollUntil(seedCtf0.id, "failed", 180_000);
}
ok("B THE SEED CTF FAILED ON THE REMOTE LANE", failedB.status === "failed", failedB.status);
ok("B the failure's result carried a line", String(failedB.result ?? "").length > 0, String(failedB.result ?? "").slice(0, 90));
const logB = await logUntil(seedCtf0.id, CTF_ERROR);
ok("B THE REAL CTFFIND ERROR VERBATIM in the log", logB.includes(CTF_ERROR), "exit 6 text");
ok("B the ctffind_runner.cpp line rides (the stub mirrors the real binary)", logB.includes(CTF_LINE));
ok("B the per-mic WARNINGs speak (6 mics, each skipped)", (logB.match(/WARNING: skipping, since cannot get CTF values for /g) ?? []).length >= 6);

/* the failed face at 1280 */
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 30);
await settleCensus();
const inspB = await openInspectorHard(NAME_CTF_A);
ok("B the FAILED CTF's card click opened the inspector (the dispatch on the failed remote face)", String(inspB).startsWith("open@try"), String(inspB));
const faceB = await failedFaceRead(NAME_CTF_A, CTF_ERROR);
ok("B the failed default landing is LOG and the stub's ERROR speaks in the dialog", faceB.logLanding?.logSpoken === true);
ok("B the Overview climb clicked", String(faceB.ovClick).startsWith("clicked@"), String(faceB.ovClick));
ok("B the failed summary card speaks 'Job failed'", faceB.card?.failedWords === true);
ok("B the 'Edit parameters' door PRESENT on the failed REMOTE face (status !== running)", faceB.card?.door === true);
const tipB = await hoverTip(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`, TIP_DOOR);
ok("B the door's tooltip teaches the promise (verbatim)", !!tipB, (tipB?.tips ?? []).join(" | ").slice(0, 90));
sh(`${AB} mouse move 4 4`);
await sleep(300);
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);

/* 320 born-at-band on the FAILED REMOTE face (the t927 N band's remote twin) */
console.log("-- B/N: 320 born-at-band on the failed remote face --");
sh(`${AB} set viewport 320 800`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 30);
await sleep(800);
sh(`${AB} press Control+f`);
await sleep(500);
sh(`${AB} keyboard type "${NAME_CTF_A}"`);
await sleep(600);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
const centeredB = evalJson(`JSON.stringify({ vis: (() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME_CTF_A}')); if (!c) return false; const r = c.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; })() })`);
ok("B/N the find bar centered the FAILED remote card at 320", centeredB?.vis === true, JSON.stringify(centeredB));
const inspBN = await openInspectorHard(NAME_CTF_A, 4);
ok("B/N the failed remote face opens at 320 (click-until-it-speaks)", String(inspBN).startsWith("open@try"), String(inspBN));
const ovClickBN = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CTF_A}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
const narrowB = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CTF_A}')); const t = d?.textContent || ''; const btn = [...(d?.querySelectorAll('button') ?? [])].find(b => (b.textContent || '').trim() === 'Edit parameters'); const r = btn?.getBoundingClientRect(); return JSON.stringify({ failedWords: t.includes('Job failed'), doorPresent: !!btn, fits: r ? (r.width > 0 && r.right <= window.innerWidth + 2 && r.left >= -2) : false, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`,
  (v) => v.doorPresent === true, 12, 600,
);
ok("B/N the failed card speaks at 320", narrowB?.failedWords === true);
ok("B/N the door visible and fitting at 320", narrowB?.doorPresent === true && narrowB?.fits === true, `fits=${narrowB?.fits}`);
ok("B/N no horizontal overflow", (narrowB?.overX ?? 1) <= 0, `overX=${narrowB?.overX}`);
sh(`${AB} press Escape`);
await sleep(700);
sh(`${AB} set viewport 1280 900`);
await sleep(500);

/* the confirm: the WIPE speech names the cluster */
const inspB2 = await openInspectorHard(NAME_CTF_A);
ok("B the failed face opens for the confirm", String(inspB2).startsWith("open@try"), String(inspB2));
const rerunB = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Re-run')`);
ok("B the inspector's Re-run clicked on the failed remote face", String(rerunB).startsWith("clicked@"), String(rerunB));
const confirmB = await confirmRead("restarts from scratch");
ok("B the confirm speaks 'Re-run CTF Estimation 1?'", confirmB?.title === `Re-run ${NAME_CTF_A}?`, confirmB?.title ?? "none");
ok("B THE WIPE SPEECH NAMES THE CLUSTER (the native lane could never earn it)", (confirmB?.text ?? "").includes(WIPE_CLUSTER), WIPE_CLUSTER);
ok("B the confirm teaches the stay-contract", (confirmB?.text ?? "").includes(WIPE_STAY));
/* CANCEL — the recovery's cure lives in the cluster fs (the lever), not the params */
const cancelB = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Cancel')`);
ok("B the confirm cancelled (the cure is the lever's removal, not an edit)", String(cancelB).startsWith("clicked@"), String(cancelB));
await sleep(600);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);
rmSync(path.join(mcMockDir, ".qa-ctf-allfail"));
ok("B THE LEVER REMOVED (the cluster fs's own cure)", !existsSync(path.join(mcMockDir, ".qa-ctf-allfail")));
const inspB3 = await openInspectorHard(NAME_CTF_A);
const rerunB2 = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Re-run')`);
const confirmB2 = await confirmRead("restarts from scratch");
ok("B the confirm re-spoken for the recovery", confirmB2?.title === `Re-run ${NAME_CTF_A}?`, confirmB2?.title ?? "none");
const startB = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Start again')`);
ok("B 'Start again' fired", String(startB).startsWith("clicked@"), String(startB));
/* THE UNFLIP GATE — wait for the run's OWN verdict, never the pre-dispatch state */
let runB = null;
const tB = Date.now();
while (Date.now() - tB < 240_000) {
  const j = jobs().find((x) => x.id === seedCtf0.id);
  if (j?.status === "completed") { runB = j; break; }
  await sleep(2000);
}
ok("B THE FAILURE UNFLIPS — the recovery completed", runB?.status === "completed", runB?.status ?? "TIMEOUT");
const ctfResp = apiJson(`/api/jobs/${seedCtf0.id}/ctf`);
const rowCount = Array.isArray(ctfResp?.micrographs) ? ctfResp.micrographs.length : 0;
ok("B /ctf answers 6 rows again (the deterministic receipt home)", rowCount === 6, `rows=${rowCount}`);

writeReceipt({ bandB: { failure: failedB.result, rows: rowCount } });
} /* === end band B === */

/* =========================== band A ====================================== */
if (RUN_S2) {
/* the arc's own mint-if-missing (the re-ride after a restore): absent →
 * mint; standing completed → skip; a mid-arc leftover (failed, fn_cont
 * set) → remove + mint — a fresh arc deserves a fresh chain */
c2d = findName(NAME_CLASS2D);
if (c2d?.status === "completed") {
  ok("A-prep the t916 chain stands (mint skipped)", true, `class2d ${c2d.id.slice(-8)} completed`);
} else {
  if (c2d) { try { sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch {} }
  let mintA = "";
  try { mintA = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs mint 2>&1`); } catch (e) { mintA = String(e); }
  ok("A-prep the t916 mint GREEN", /mint GREEN — \d+ ok, 0 fail/.test(mintA), (mintA.match(/== mint .*/) ?? ["?"])[0]);
  c2d = findName(NAME_CLASS2D);
  ok("A-prep the class2d witness completed", c2d?.status === "completed", c2d?.status);
  if (!c2d || c2d.status !== "completed") { console.log("FATAL: no class2d witness — aborting"); writeReceipt({ fatal: "no class2d(stage2)" }); process.exit(2); }
}
/* the BINDING DOOR again (idempotent): stage3's UI rides inherit the lane
 * the same way — the registry carries it across the stages */
const connsA = apiJson("/api/remote/connections").connections ?? [];
const connA = connsA.find((c) => c.name === "Mock Cluster");
if (connA?.id) { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: connA.id }); }
ok("A-prep the binding carries (the UI rides' lane)", !!connA?.id, connA?.id?.slice(0, 14));
c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);
famIt2Opt = path.join(c2dMockDir, "run_it002_optimiser.star");
famIt1Opt = path.join(c2dMockDir, "run_it001_optimiser.star");
const csA = apiJson(`/api/jobs/${c2d.id}/continue-sources`);
const selfA = (csA.sources ?? []).find((s) => s.relation === "self");
const newestA = (selfA?.entries ?? []).find((e) => e.newest && e.complete);
REAL_CONT = newestA?.path ?? "";
BAD_CONT = `/projects/cryoflow/${projId}/class2d_${c2d.id.slice(-8)}/run_it009_optimiser.star`;
ok("A-prep the picker's newest round re-read", /run_it002_optimiser\.star$/.test(REAL_CONT), REAL_CONT || "none");
console.log("== band A: THE CLASS2D CONTINUE ARC — the bad checkpoint, both confirm modes, the wipe-preserve law ==");
const it1Before = statSync(famIt1Opt).mtimeMs;
const it2Before = statSync(famIt2Opt).mtimeMs;
const famBefore = readdirSync(c2dMockDir).filter((f) => /^run_it\d+_data\.star$/.test(f)).sort();
ok("A the family before the arc (the stub's seed round + it001 + it002)", famBefore.join(",") === "run_it000_data.star,run_it001_data.star,run_it002_data.star", famBefore.join(","));

/* a FRESH page — stage1's leave left the inspector's confirm flow on the
 * deck; the class2d's card would sit UNDER the stale dialog (the first
 * ride's NEVER-OPEN). The minted chain's card also sits under its group's
 * STICKY HEADER at the canvas's rest position (the second ride's probe:
 * elementFromPoint returned the group/cat header, z-10) — the product's
 * own door for reaching it is the FIND BAR (the t926 law: the unique
 * fragment's focusJob centers the card; the header scrolls away) */
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
const centeredA = evalJson(`JSON.stringify({ vis: (() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); if (!c) return false; const b = c.querySelector('[role="button"][tabindex]'); const r = b?.getBoundingClientRect(); return !!r && r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; })() })`);
ok("A the find bar centered the class2d card (out from under the sticky header)", centeredA?.vis === true, JSON.stringify(centeredA));

/* the bad continue through the door */
const inspA0 = await openInspectorHard(NAME_CLASS2D);
ok("A the completed class2d's inspector opens", String(inspA0).startsWith("open@try"), String(inspA0));
const doorA0 = await openEditDoor(NAME_CLASS2D);
ok("A the 'Edit parameters' door clicked (completed face)", String(doorA0.doorClick).startsWith("clicked@") && doorA0.swapped?.inspGone === true, String(doorA0.doorClick));
const panelA0 = await panelOpen();
ok("A the JobPanel opened", panelA0?.open === true);
const paramsA0 = await clickParamsTab();
ok("A the Params tab clicked", String(paramsA0).startsWith("clicked@"), String(paramsA0));
const contFieldSel = `#param-${c2d.id}-fn_cont`;
const fieldA0 = await poll(
  `(() => { const el = document.querySelector('${contFieldSel}'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
  (v) => v.present === true, 16, 600,
);
ok("A THE COMPOUND WIDGET — the 'Continue from here:' field present and EMPTY", fieldA0?.present === true && (fieldA0?.value ?? "x") === "", JSON.stringify(fieldA0?.value));
sh(`${AB} fill "${contFieldSel}" "${BAD_CONT}"`);
await sleep(1800);
const savedBad = jobs().find((j) => j.id === c2d.id)?.params?.fn_cont;
ok("A THE BAD PATH LANDED (the debounced save)", savedBad === BAD_CONT, String(savedBad ?? "none").slice(-60));
const stillCompletedA = jobs().find((j) => j.id === c2d.id)?.status;
ok("A the status NEVER left completed through the edit", stillCompletedA === "completed", String(stillCompletedA));
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);

/* the verb's face flipped to Continue */
const inspA1 = await openInspectorHard(NAME_CLASS2D);
ok("A the inspector reopens (the verb's face read)", String(inspA1).startsWith("open@try"), String(inspA1));
const contBtnA = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Continue'); return JSON.stringify({ present: !!b }); })()`,
  (v) => v.present === true, 10, 500,
);
ok("A THE VERB'S FACE FLIPPED — the button reads 'Continue' (fn_cont set)", contBtnA?.present === true);
const contClickA = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
ok("A the Continue verb clicked", String(contClickA).startsWith("clicked@"), String(contClickA));
const confirmA = await confirmRead("picks up from the checkpoint");
ok("A the confirm speaks 'Continue <name>?'", confirmA?.title === `Continue ${NAME_CLASS2D}?`, confirmA?.title ?? "none");
ok("A THE CONTINUE SPEECH — the run_it* family PRESERVED law verbatim", (confirmA?.text ?? "").includes(CONT_DESC));
ok("A the chosen path rides as-is (the BAD path verbatim)", (confirmA?.text ?? "").includes(BAD_CONT) && (confirmA?.text ?? "").includes(CONT_RIDES));
const goA = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
ok("A 'Continue' fired (the continue-mode dispatch)", String(goA).startsWith("clicked@"), String(goA));

/* THE FAILURE — the stub's own --continue validation. The two-breath gate:
 * the pre-state is COMPLETED (the mint's run) and a naive terminal poll
 * reads THAT as the verdict (the same trap the t927 unflip gate was built
 * for) — wait for the row to LEAVE completed first, then for `failed`. */
let failedA = { status: "TIMEOUT" };
{
  let left = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 180_000) {
    const st = jobs().find((x) => x.id === c2d.id)?.status;
    if (st && st !== "completed") { left = true; break; }
    await sleep(1500);
  }
  if (left) failedA = await pollUntil(c2d.id, "failed", 240_000);
}
ok("A THE CLASS2D FAILED ON A CONTINUE RUN (remote lane)", failedA.status === "failed", failedA.status);
const logA = await logUntil(c2d.id, "does not exist");
/* the stub's line carries the TRANSLATED path (t387's per-occurrence mount
 * translation — /projects/… lands as the mock's fs root on the host), so
 * the assert speaks the SUFFIX (translation-agnostic): */
ok("A THE STUB'S REFUSAL VERBATIM — 'checkpoint <…>/run_it009_optimiser.star does not exist'", /checkpoint \S*run_it009_optimiser\.star does not exist/.test(logA), (logA.match(/cryoflow-mock refine: checkpoint[^\n]*/) ?? ["none"])[0].slice(0, 150));
ok("A the failure's result carried a line", String(failedA.result ?? "").length > 0, String(failedA.result ?? "").slice(0, 90));
const famAfterFail = readdirSync(c2dMockDir).filter((f) => /^run_it\d+_data\.star$/.test(f)).sort();
ok("A THE FAMILY UNTOUCHED AT THE FAILURE (the keepIterations carve-out)", famAfterFail.join(",") === famBefore.join(","), famAfterFail.join(","));
/* the failed face — the arc's mid-point; the door/cause/recovery live in stage3 */
const inspA2 = await openInspectorHard(NAME_CLASS2D);
ok("A the FAILED class2d's inspector opens", String(inspA2).startsWith("open@try"), String(inspA2));
const faceA = await failedFaceRead(NAME_CLASS2D, "does not exist");
ok("A the failed landing is LOG and the stub's refusal speaks in the dialog", faceA.logLanding?.logSpoken === true);
ok("A the Overview climb clicked", String(faceA.ovClick).startsWith("clicked@"), String(faceA.ovClick));
ok("A the failed card speaks 'Job failed'", faceA.card?.failedWords === true);
ok("A the door PRESENT on the failed CONTINUE face", faceA.card?.door === true);
writeReceipt({ bandA1: { bad: BAD_CONT, real: REAL_CONT, failure: failedA.result, ladder: famAfterFail } });
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);
} /* === end stage2 (band A part 1) === */

if (RUN_S3) {
console.log("== band A2 (stage3): THE RECOVERY — the cause at the scene, the edit, the unflip, the Start-again face ==");
/* the mid-arc entry: the class2d FAILED with the bad fn_cont — the stage2 leave */
c2d = findName(NAME_CLASS2D);
const c2dMockDirS3 = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);
c2dMockDir = c2dMockDirS3;
mcMockDir = path.join(MOCK_PROJECTS, projId, `motioncorr_${(seedMc0?.id ?? "").slice(-8)}`);
famIt2Opt = path.join(c2dMockDirS3, "run_it002_optimiser.star");
famIt1Opt = path.join(c2dMockDirS3, "run_it001_optimiser.star");
ok("A2 the arc's mid-point stands (failed, on a CONTINUE run)", c2d?.status === "failed", c2d?.status);
if (c2d?.status !== "failed") { console.log("FATAL(stage3): the class2d is not failed — run stage2 first"); process.exit(2); }
const csS3 = apiJson(`/api/jobs/${c2d.id}/continue-sources`);
const selfS3 = (csS3.sources ?? []).find((s) => s.relation === "self");
const newestS3 = (selfS3?.entries ?? []).find((e) => e.newest && e.complete);
REAL_CONT = newestS3?.path ?? "";
BAD_CONT = `/projects/cryoflow/${projId}/class2d_${c2d.id.slice(-8)}/run_it009_optimiser.star`;
ok("A2 the picker's newest complete round re-read", /run_it002_optimiser\.star$/.test(REAL_CONT), REAL_CONT || "none");
/* the arc's mid-point has TWO honest shapes: the fresh stage2 leave (the
 * BAD path in fn_cont) and the interrupted-ride state (the recovery edit
 * already landed — the REAL path in fn_cont, the recovery run never
 * fired). Both are the same arc; the entry names which one it stands in. */
const entryBad = c2d?.params?.fn_cont === BAD_CONT;
const entryReal = c2d?.params?.fn_cont === REAL_CONT;
ok("A2 the mid-point's fn_cont state (BAD = the fresh leave / REAL = the interrupted recovery)", entryBad || entryReal, entryBad ? "BAD" : (entryReal ? "REAL" : String(c2d?.params?.fn_cont ?? "none").slice(-50)));
const contFieldSel = `#param-${c2d.id}-fn_cont`;
const famBeforeS3 = readdirSync(c2dMockDirS3).filter((f) => /^run_it\d+_data\.star$/.test(f)).sort();
const it2BeforeS3 = existsSync(famIt2Opt) ? statSync(famIt2Opt).mtimeMs : 0;

/* a FRESH page + the find bar (the new process's canvas rest position) */
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

/* the failed face's door — the cause at the scene */
const inspA2 = await openInspectorHard(NAME_CLASS2D);
ok("A2 the FAILED class2d's inspector opens", String(inspA2).startsWith("open@try"), String(inspA2));
const doorA = await openEditDoor(NAME_CLASS2D);
ok("A2 the door clicked FROM THE FAILED FACE", String(doorA.doorClick).startsWith("clicked@") && doorA.swapped?.inspGone === true, String(doorA.doorClick));
const stillFailedA = jobs().find((j) => j.id === c2d.id)?.status;
ok("A2 THE NON-DESTRUCTIVE LAW'S FAILED FACE — still failed after the door", stillFailedA === "failed", String(stillFailedA));
const panelA = await panelOpen();
ok("A2 the JobPanel opened on the failed face", panelA?.open === true);
await clickParamsTab();
const fieldA = await poll(
  `(() => { const el = document.querySelector('${contFieldSel}'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
  (v) => v.present === true, 16, 600,
);
ok("A2 THE FAILURE'S CAUSE AT THE SCENE — the field holds the BAD path", entryBad ? fieldA?.value === BAD_CONT : fieldA?.value === REAL_CONT, entryBad ? "fresh-leave law" : "interrupted-recovery state");

/* the recovery edit — the REAL clear, then the picker's own newest round */
const focusA = await realClick(contFieldSel.startsWith("#") ? `document.querySelector('${contFieldSel}')` : contFieldSel);
ok("A2 the field focused (own at the actual point)", String(focusA).startsWith("clicked@"), String(focusA));
const focusedA = evalJson(`JSON.stringify({ on: document.activeElement === document.querySelector('${contFieldSel}') })`);
if (focusedA?.on !== true) {
  evalJs(`(() => { const el = document.querySelector('${contFieldSel}'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); } return 'focused'; })()`);
  await sleep(300);
}
sh(`${AB} press Control+a`);
sh(`${AB} press Delete`);
await sleep(400);
sh(`${AB} fill "${contFieldSel}" "${REAL_CONT}"`);
await sleep(1800);
const savedReal = jobs().find((j) => j.id === c2d.id)?.params?.fn_cont;
ok("A2 THE RECOVERY PATH LANDED (the picker's own newest complete round)", savedReal === REAL_CONT, String(savedReal ?? "none").slice(-70));
const stillFailedA2 = jobs().find((j) => j.id === c2d.id)?.status;
ok("A2 the status NEVER left failed through the recovery edit", stillFailedA2 === "failed", String(stillFailedA2));
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);

/* the recovery continue → the unflip */
const inspA3 = await openInspectorHard(NAME_CLASS2D);
const contClickA2 = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
const confirmA2 = await confirmRead("picks up from the checkpoint");
ok("A2 the recovery confirm speaks 'Continue <name>?'", confirmA2?.title === `Continue ${NAME_CLASS2D}?`, confirmA2?.title ?? "none");
ok("A2 the confirm rides the RECOVERY path (the edit's own word)", (confirmA2?.text ?? "").includes(REAL_CONT));
const goA2 = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Continue')`);
ok("A2 the recovery 'Continue' fired", String(goA2).startsWith("clicked@"), String(goA2));
/* the two-breath gate: the pre-state is FAILED (terminal per any naive
 * poll) — wait for the row to LEAVE failed (the dispatch's own word),
 * then for the recovery's completed verdict (the t927 unflip law) */
let runA = null;
{
  let leftA = false;
  const tA0 = Date.now();
  while (Date.now() - tA0 < 180_000) {
    const stA = jobs().find((x) => x.id === c2d.id)?.status;
    if (stA && stA !== "failed") { leftA = true; break; }
    await sleep(1500);
  }
  if (leftA) {
    const tA = Date.now();
    while (Date.now() - tA < 300_000) {
      const j = jobs().find((x) => x.id === c2d.id);
      if (j?.status === "completed") { runA = j; break; }
      if (j?.status === "failed") { runA = j; break; } /* a second failure is ALSO a verdict — named below */
      await sleep(2000);
    }
  }
}
ok("A2 THE CONTINUE UNFLIPS — the recovery completed", runA?.status === "completed", runA?.status ?? "TIMEOUT");
const logA2 = await logUntil(c2d.id, "CONTINUE from");
ok("A2 THE STUB'S OWN CONTINUE RECEIPT — 'CONTINUE from run_it002_optimiser.star (it 002, K=4)", /CONTINUE from run_it002_optimiser\.star \(it 002, K=4\)/.test(logA2), (logA2.match(/CONTINUE from[^\n]*/) ?? ["none"])[0].slice(0, 110));
const famAfterRec = readdirSync(c2dMockDir).filter((f) => /^run_it\d+_data\.star$/.test(f)).sort();
ok("A2 THE LADDER GREW — run_it003 born (+1 more)", famAfterRec.includes("run_it003_data.star"), famAfterRec.join(","));
ok("A2 THE PRESERVED FAMILY — run_it002_data.star still there", famAfterRec.includes("run_it002_data.star"));

/* the Start-again face — the mode flips back, the wipe rewrites the ladder */
const doorA2 = await openEditDoor(NAME_CLASS2D);
ok("A2 the door opens for the Start-again face", String(doorA2.doorClick).startsWith("clicked@") && doorA2.swapped?.inspGone === true, String(doorA2.doorClick));
await panelOpen();
await clickParamsTab();
await poll(
  `(() => { const el = document.querySelector('${contFieldSel}'); return JSON.stringify({ present: !!el }); })()`,
  (v) => v.present === true, 16, 600,
);
const focusA2 = await realClick(`document.querySelector('${contFieldSel}')`);
/* the FOCUS-ASSIST law (the stage3 ride's lesson): the field may sit below
 * the panel's fold — the realClick can miss, and Control+a then lands on
 * the BODY (the clear never lands; the whole Start-again face cascades).
 * Verify the focus; a miss falls back to the programmatic focus() — the
 * REAL gesture (select-all + delete keys) stays real either way. */
const focusedA2 = evalJson(`JSON.stringify({ on: document.activeElement === document.querySelector('${contFieldSel}') })`);
if (focusedA2?.on !== true) {
  evalJs(`(() => { const el = document.querySelector('${contFieldSel}'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); } return 'focused'; })()`);
  await sleep(300);
}
sh(`${AB} press Control+a`);
sh(`${AB} press Delete`);
await sleep(1800);
const clearedA = jobs().find((j) => j.id === c2d.id)?.params?.fn_cont;
ok("A2 THE FIELD CLEARED (the REAL gesture — select-all + delete)", (clearedA ?? "") === "", JSON.stringify(clearedA ?? "(empty)"));
const stillCompletedA2 = jobs().find((j) => j.id === c2d.id)?.status;
ok("A2 the status stayed completed through the clear", stillCompletedA2 === "completed", String(stillCompletedA2));
try { sh(`${AB} press Escape`); } catch {}
await sleep(700);
const inspA4 = await openInspectorHard(NAME_CLASS2D);
const rerunFaceA = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Re-run'); return JSON.stringify({ present: !!b }); })()`,
  (v) => v.present === true, 10, 500,
);
ok("A2 THE FACE FLIPPED BACK — the button reads 'Re-run' again (fn_cont empty)", rerunFaceA?.present === true);
const rerunA = await realClick(`[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Re-run')`);
const confirmA3 = await confirmRead("restarts from scratch");
ok("A2 the confirm speaks 'Re-run <name>?' (the Start-again mode)", confirmA3?.title === `Re-run ${NAME_CLASS2D}?`, confirmA3?.title ?? "none");
ok("A2 the wipe speech names the cluster on the refine job too", (confirmA3?.text ?? "").includes(WIPE_CLUSTER));
ok("A2 the confirm teaches the checkpoint alternative ('To resume from a checkpoint instead')", (confirmA3?.text ?? "").includes("To resume from a checkpoint instead"));
const startA = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Start again')`);
ok("A2 'Start again' fired", String(startA).startsWith("clicked@"), String(startA));
/* the UNFLIP GATE runs ONLY behind a fired Start-again — the pre-state is
 * completed here (the recovery just unflipped), and a naive poll would
 * read THAT as the fresh run's verdict (the t927 law's completed-state
 * twin: the gate waits for the run's OWN verdict, and the run must exist) */
let runA2 = null;
if (String(startA).startsWith("clicked@")) {
  /* the two-breath gate: the receipt text is DETERMINISTIC (the stub's own
   * words — the recovery's and the fresh run's read identical), so the gate
   * waits for the row to LEAVE completed (the dispatch's own word) and only
   * then for the new terminal state */
  let left = false;
  const tA2 = Date.now();
  while (Date.now() - tA2 < 180_000) {
    const st = jobs().find((x) => x.id === c2d.id)?.status;
    if (st && st !== "completed") {
      left = true;
      if (st === "failed") { runA2 = jobs().find((x) => x.id === c2d.id); }
      break;
    }
    await sleep(1500);
  }
  if (left && runA2 == null) {
    const tA3 = Date.now();
    while (Date.now() - tA3 < 300_000) {
      const st = jobs().find((x) => x.id === c2d.id)?.status;
      if (["completed", "failed", "cancelled"].includes(st ?? "")) { runA2 = jobs().find((x) => x.id === c2d.id); break; }
      await sleep(2000);
    }
  }
}
ok("A2 the fresh run completed", runA2?.status === "completed", runA2 ? `${runA2.status} ${String(runA2.result ?? "").slice(0, 60)}` : "NOT FIRED");
const it2AfterM = existsSync(famIt2Opt) ? statSync(famIt2Opt).mtimeMs : 0;
ok("A2 THE FROM-SCRATCH RECEIPT — it002's mtime MOVED (the fresh run rewrote the ladder)", it2AfterM > it2BeforeS3, `before=${Math.round(it2BeforeS3)} after=${Math.round(it2AfterM)}`);
const prevDir = path.join(c2dMockDir, ".cryoflow_prev");
const prevGens = existsSync(prevDir) ? readdirSync(prevDir).length : 0;
ok("A2 THE MOVE-ASIDE BORN on the cluster side (.cryoflow_prev generation(s))", prevGens >= 1, `generations=${prevGens}`);

writeReceipt({
  bandA2: {
    real: REAL_CONT,
    recovery: runA?.result, fresh: runA2?.result,
    ladder: famAfterRec, prevGens,
  },
});

/* =========================== band P ====================================== */
console.log("== band P: the persist reload — both truths hold ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 30);
await settleCensus();
const ctfP = jobs().find((j) => j.id === seedCtf0.id);
const c2dP = jobs().find((j) => j.id === c2d.id);
ok("P CTF-1 completed at the data layer (no failure resurrection)", ctfP?.status === "completed", String(ctfP?.status));
ok("P the class2d completed at the data layer", c2dP?.status === "completed", String(c2dP?.status));
ok("P the fn_cont clear HELD (empty — the Start-again face's word)", (c2dP?.params?.fn_cont ?? "") === "", JSON.stringify(c2dP?.params?.fn_cont ?? "(empty)"));
const c2dCardP = evalJson(`JSON.stringify({ card: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME_CLASS2D}')) })`);
ok("P the class2d's card rides the canvas after the reload", c2dCardP?.card === true);

/* =========================== band R ====================================== */
console.log("== band R: the restore — the unbind FIRST (the remove's binding assert), the remove, the seed world, the doctor ==");
/* the UNBIND comes FIRST: the mint's remove asserts the binding UNTOUCHED
 * from its manifest's record (null — the mint rode unbound), and the arc
 * bound the project for the UI rides. The t300 door's same word undoes it
 * before the remove reads the registry. */
const unbindR = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null });
ok("R THE PROJECT UNBOUND through the same door", unbindR.ok === true && unbindR.rebound === true, JSON.stringify(unbindR).slice(0, 80));
const regR = (() => { try { return JSON.parse(readFileSync(path.join(ROOT, "data", "projects.json"), "utf8")); } catch { return {}; } })();
ok("R the registry's binding reads null (the mint-time state back)", regR?.projects?.[projId]?.remote === null, JSON.stringify(regR?.projects?.[projId]?.remote ?? "null"));
let removeOut = "";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("R the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const jobsR = jobs();
ok("R the seed trio remains (3 jobs)", jobsR.length === 3, jobsR.map((j) => j.type).join(","));
const edgesR = edges();
const seedImportR = jobsR.find((j) => j.type === "import");
const pairAR = seedImportR && seedMc0 ? edgesR.find((e) => e.fromJobId === seedImportR.id && e.toJobId === seedMc0.id) : null;
const pairBR = seedMc0 && seedCtf0 ? edgesR.find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("R the seed edges ride (import→MC-1, MC-1→CTF-1)", edgesR.length === 2 && !!pairAR && !!pairBR, `edges=${edgesR.length} pairA=${!!pairAR} pairB=${!!pairBR}`);
ok("R the lever absent on the mock side", !existsSync(path.join(mcMockDir, ".qa-ctf-allfail")));
ok("R the class2d mock-side workdir swept", !existsSync(c2dMockDir), path.basename(c2dMockDir));
const ctfR = await pollUntil(seedCtf0.id, "completed", 30_000);
ok("R CTF-1 still completed after the restore", ctfR.status === "completed", String(ctfR.status));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("R THE DOCTOR CLEAN (one world, ghost-free, an honest door)", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT.*/) ?? ["?"])[0]);

writeReceipt({ restore: { jobs: jobsR.length, edges: edgesR.length, remove: (removeOut.match(/== remove .*/) ?? ["?"])[0] } });
} /* === end stage3 (band A2/P/R) === */

/* =========================== verdict ===================================== */
console.log(`\n== t930 witness (stage ${STAGE}): ${pass} pass / ${fail} fail ==`);
writeReceipt({ verdict: { stage: STAGE, pass, fail } });
process.exit(fail === 0 ? 0 : 1);
