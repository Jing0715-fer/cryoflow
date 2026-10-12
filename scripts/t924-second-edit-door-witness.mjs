#!/usr/bin/env node
/**
 * t924 — the completed filter's SECOND EDIT DOOR, ridden live. t923's
 * deepest lesson: the card click's dispatch is status-dependent (idle →
 * the editing JobPanel, non-idle → the read-only inspector), so a
 * completed job's parameters were unreachable without paying the reset
 * toll — "Reset & edit" clears the run state to idle, DESTROYING the
 * receipt just to tweak a knob. The t452 contract says "editable", not
 * "editable until first run". This window the inspector grows the second
 * door and the witness rides it end to end:
 *
 *   prep  the t922 mint re-rides, the filter is minted idle (the full
 *         list), wired MC-B→filter→CTF-A (the seed edge lifted), and RUNS
 *         ONCE — the completed receipt ("3 of 6 · list of 3", rows 3) is
 *         the door's subject.
 *   A     THE DOOR: the completed filter's card click opens the READ-ONLY
 *         inspector; the action cluster holds BOTH doors — the new
 *         "Edit parameters" (non-destructive) beside "Reset & edit" (the
 *         toll) — with their tooltips teaching the difference; the door
 *         click closes the inspector and opens the JobPanel, and THE
 *         RECEIPT SURVIVES (job still completed, outputs still rows 3).
 *         The panel's own Run button says "Re-run" but is disabled with
 *         the honest blocked hint (this host has no RELION — the t924
 *         witness rides the re-run through the inspector's own face).
 *   E     the edit on the COMPLETED face: the Exclusions input holds the
 *         baked list, the debounced auto-save lands the edit, and the
 *         status never leaves completed.
 *   R     the re-run through the inspector's own Re-run (busy-only gate —
 *         clickable on this host): the confirm speaks "Re-run <name>?" and
 *         the stay-teaching ("Existing downstream results stay on disk
 *         until those jobs re-run"), "Start again" fires, and the count
 *         law speaks the EDITED list — "4 of 6 kept · 2 excluded (list
 *         of 2)" — with the filtered star at rows 4 and the log's ledger.
 *   D     the downstream breathes: CTF-A re-runs fed by the filter's
 *         4-mic star and /ctf answers the survivors mic_001/003/005/006.
 *   N     320: the door's own narrow face — the "Edit parameters" button
 *         visible and fitting inside the inspector at the fold, overX 0.
 *   R2    the restore: the re-wire undone, the seed edge home (fresh id —
 *         the t359 UUID gate), the filter gone, the t922 remove GREEN,
 *         CTF-A re-run on the seed feed (6 rows again), the doctor CLEAN.
 *
 *   node scripts/t924-second-edit-door-witness.mjs main
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t924-second-edit-door-witness.json";
const STATE = path.join(ROOT, "data", "t924-second-edit-door.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_FILTER = "Exclude Micrographs (t924)";
const LIST_FULL = "mic_002.mrc, mic_004.mrc, mic_006.mrc";
const LIST_TWO = "mic_002.mrc, mic_004.mrc";
const TIP_DOOR = "without resetting — the completed run and its results stay until a Re-run replaces them";
const TIP_RESET = "clears the run state (status, progress, resume checkpoint)";

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
/* the hover-until-speaks law (t924, from the eaten-click law's hover face):
 * the action cluster re-renders under the live poll and the tooltip's
 * trigger can swap under the pointer between the rect read and the mouse
 * move — so hover, LISTEN, dismiss, and re-aim the SAME button until ITS
 * tooltip speaks. A tooltip that names a neighbor is a miss, not a pass. */
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
    sh(`${AB} mouse move 4 4`); // dismiss whatever spoke — re-aim next round
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
const shApi = (url) => sh(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`);
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
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}

/* =========================== prep ======================================== */
console.log("== prep: the t922 mint re-rides, the filter wired and RUNNED ONCE (the completed subject) ==");
// the world may start at the SEED TRIO (the previous window's remove) — the
// mint-created jobs only exist AFTER the re-ride, so every lookup here is
// FRESH (the t924 first-ride lesson: names captured before the mint read
// undefined and the crash was the honest answer)
const ctfA0 = findName(NAME_CTF_A);
const preFilter0 = findName(NAME_FILTER);
if (preFilter0) {
  const preRewire = edges().find((e) => e.fromJobId === preFilter0.id && e.toJobId === ctfA0?.id);
  if (preRewire) { const d = api("DELETE", `/api/edges/${preRewire.id}`); ok("prep a prior ride's re-wire undone", !d.error, preRewire.id); }
  const preF = api("DELETE", `/api/jobs/${preFilter0.id}`);
  ok("prep a stale t924 filter deleted", !preF.error || String(preF.error).includes("not found"), preFilter0.id.slice(0, 8));
}
const preSeed0 = ctfA0 && findName(NAME_MC_A) ? edges().find((e) => e.fromJobId === findName(NAME_MC_A).id && e.toJobId === ctfA0.id) : null;
if (!preSeed0 && ctfA0 && findName(NAME_MC_A)) {
  const p = api("POST", "/api/edges", { fromJobId: findName(NAME_MC_A).id, toJobId: ctfA0.id });
  ok("prep the seed MC-A→CTF-A edge back for the mint", !p.error && !!p.edge?.id, p.error ?? p.edge?.id);
}
let mintOut = "";
try { mintOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs mint 2>&1`); } catch (e) { mintOut = String(e); }
ok("prep the t922 mint GREEN", /MINT \d+ pass \/ 0 fail/.test(mintOut), (mintOut.match(/MINT .*/) ?? ["?"])[0]);
const mcA = findName(NAME_MC_A);
const mcB = findName(NAME_MC_B);
const ctfA = findName(NAME_CTF_A);
ok("prep the three runs aboard and completed", !!mcA && !!mcB && !!ctfA && [mcA, mcB, ctfA].every((j) => j.status === "completed"));

const conn = (apiJson("/api/remote/connections").connections ?? []).find((c) => c.name === "Mock Cluster");
const REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };

let filter = api("POST", "/api/jobs", {
  type: "excludemg", name: NAME_FILTER,
  params: { excludeNames: LIST_FULL },
}).job;
ok("prep the filter minted idle", !!filter?.id && filter.status === "idle", `${filter?.id?.slice(0, 8)} · ${filter?.status}`);
const feed = edges().find((e) => e.fromJobId === mcB.id && e.toJobId === filter.id) ??
  api("POST", "/api/edges", { fromJobId: mcB.id, toJobId: filter.id }).edge;
ok("prep MC-B feeds the filter", !!feed?.id, feed?.id ?? "missing");
const seedEdge = edges().find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
ok("prep the seed MC-A→CTF-A edge present (to lift)", !!seedEdge, seedEdge?.id ?? "missing");
if (seedEdge) {
  const off = api("DELETE", `/api/edges/${seedEdge.id}`);
  ok("prep the seed edge lifted (the adopt's move)", !off.error, off.error ?? "off");
}
const rewire = edges().find((e) => e.fromJobId === filter.id && e.toJobId === ctfA.id) ??
  api("POST", "/api/edges", { fromJobId: filter.id, toJobId: ctfA.id }).edge;
ok("prep the filter feeds CTF-A (the adopt's landing)", !!rewire?.id, rewire?.id ?? "missing");
writeFileSync(STATE, JSON.stringify({
  filter: filter.id, seedEdgeMCA_CTF: seedEdge?.id ?? null,
  feedEdge: feed?.id ?? null, rewireEdge: rewire?.id ?? null,
}, null, 2));

// the filter's FIRST run — the completed receipt is the door's subject
const r0 = api("POST", `/api/jobs/${filter.id}/run`);
ok("prep the filter's first run accepted", !r0.error, r0.error ?? r0.job?.status ?? "");
const run0 = await pollUntil(filter.id, "completed");
ok("prep the filter completed (3 of 6 · list of 3)", run0.status === "completed" && String(run0.result ?? "").includes("3 of 6 micrographs kept · 3 excluded (list of 3)"), String(run0.result ?? "none").slice(0, 90));
const outs0 = apiJson(`/api/jobs/${filter.id}/outputs`);
const star0 = (outs0.files ?? []).find((f) => f.name === "micrographs_filtered.star");
ok("prep the receipt's filtered star at rows 3", !!star0 && star0.rows === 3, JSON.stringify(star0 ?? {}).slice(0, 80));

/* =========================== band A ====================================== */
console.log("== band A: THE DOOR — the completed filter's second edit door ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await settleCensus();
const cardClick = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${NAME_FILTER}'))?.querySelector('[role="button"][tabindex]')`);
ok("A the COMPLETED filter's card clicked", String(cardClick).startsWith("clicked@"), String(cardClick));
const insp = await poll(
  `JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('job inspector')) })`,
  (v) => v.open === true, 12, 600,
);
ok("A the card click opened the READ-ONLY inspector (the status-dependent dispatch)", insp?.open === true);

const doors = await poll(
  `JSON.stringify({ door: [...document.querySelectorAll('[role="dialog"] button')].some(b => (b.textContent || '').trim() === 'Edit parameters'), reset: [...document.querySelectorAll('[role="dialog"] button')].some(b => (b.textContent || '').includes('Reset & edit')) })`,
  (v) => v.door === true && v.reset === true, 10, 500,
);
ok("A the cluster holds BOTH doors — 'Edit parameters' (new) beside 'Reset & edit' (the toll)", doors?.door === true && doors?.reset === true);

// the tooltips teach the difference — hover-until-speaks (the eaten-hover law)
const doorBtn = `[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`;
const tipDoor = await hoverTip(doorBtn, TIP_DOOR);
ok("A the NEW door's tooltip teaches the promise (results stay until re-run)", !!tipDoor, (tipDoor?.tips ?? []).join(" | ").slice(0, 110));
const resetBtn = `[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').includes('Reset & edit'))`;
const tipReset = await hoverTip(resetBtn, TIP_RESET);
ok("A the TOLL door's tooltip still teaches the reset (the contrast is real)", !!tipReset, (tipReset?.tips ?? []).join(" | ").slice(0, 110));
sh(`${AB} mouse move 4 4`);
await sleep(400);

const doorClick = await realClick(doorBtn);
ok("A the 'Edit parameters' door clicked", String(doorClick).startsWith("clicked@"), String(doorClick));
const swapped = await poll(
  `JSON.stringify({ inspGone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('job inspector')), aside: [...document.querySelectorAll('aside')].some(x => (x.className || '').includes('border-l')) })`,
  (v) => v.inspGone === true && v.aside === true, 16, 600,
);
ok("A the inspector closed AND the JobPanel opened (one door replaces the other)", swapped?.inspGone === true && swapped?.aside === true);
const stillCompleted = jobs().find((j) => j.id === filter.id)?.status;
ok("A THE NON-DESTRUCTIVE LAW — the job is STILL completed after the door", stillCompleted === "completed", String(stillCompleted));
const outsAfterDoor = apiJson(`/api/jobs/${filter.id}/outputs`);
const starAfterDoor = (outsAfterDoor.files ?? []).find((f) => f.name === "micrographs_filtered.star");
ok("A THE RECEIPT SURVIVED — the filtered star still rows 3", !!starAfterDoor && starAfterDoor.rows === 3, String(starAfterDoor?.rows ?? "none"));

// the panel's own Run face: says "Re-run", disabled with the honest hint on
// THIS host (no RELION — the blocked teaching, not a silent lie)
const runFace = await poll(
  `(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); const btn = [...(a?.querySelectorAll('button') ?? [])].find(b => (b.textContent || '').trim() === 'Re-run'); const hint = a?.querySelector('#job-relion-blocked-hint'); return JSON.stringify({ present: !!btn, disabled: btn?.disabled ?? null, describedby: btn?.getAttribute('aria-describedby') ?? null, hint: (hint?.textContent || '').trim() }); })()`,
  (v) => v.present === true, 12, 600,
);
ok("A the panel's run button says 'Re-run' (the ranBefore face)", runFace?.present === true, `disabled=${runFace?.disabled}`);
ok("A the panel's run button honestly BLOCKED on this host (aria-describedby → the hint)", runFace?.disabled === true && runFace?.describedby === "job-relion-blocked-hint", String(runFace?.hint ?? "").slice(0, 80));
ok("A the blocked hint teaches 'fail to start honestly'", String(runFace?.hint ?? "").includes("fail to start honestly"), String(runFace?.hint ?? "").slice(0, 90));

/* =========================== band E ====================================== */
console.log("== band E: the edit on the COMPLETED face — the debounced save, the status unmoved ==");
const paramsClick = await realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`);
ok("E the panel's Params tab clicked (the t920 law)", String(paramsClick).startsWith("clicked@"), String(paramsClick));
const field = await poll(
  `(() => { const el = document.querySelector('#param-${filter.id}-excludeNames'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
  (v) => v.present === true, 16, 600,
);
ok("E the excludeNames input present and holds the baked list", field?.present === true && field?.value === LIST_FULL, field?.value ?? "none");
sh(`${AB} fill "#param-${filter.id}-excludeNames" "${LIST_TWO}"`);
await sleep(1500); // the debounced auto-save's own window (~700ms) plus wire
const savedTwo = jobs().find((j) => j.id === filter.id)?.params?.excludeNames;
ok("E the EDIT landed through the debounced save", savedTwo === LIST_TWO, String(savedTwo));
const stillCompleted2 = jobs().find((j) => j.id === filter.id)?.status;
ok("E the status NEVER left completed through the edit", stillCompleted2 === "completed", String(stillCompleted2));

/* =========================== band R ====================================== */
console.log("== band R: the re-run through the inspector's own Re-run face ==");
const cardClick2 = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${NAME_FILTER}'))?.querySelector('[role="button"][tabindex]')`);
ok("R the completed filter's card clicked again (the inspector's face)", String(cardClick2).startsWith("clicked@"), String(cardClick2));
const insp2 = await poll(
  `JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('job inspector')) })`,
  (v) => v.open === true, 12, 600,
);
ok("R the inspector open again", insp2?.open === true);
const rerunBtn = `[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Re-run')`;
const rerunClick = await realClick(rerunBtn);
ok("R the inspector's Re-run clicked (busy-only gate — clickable on this host)", String(rerunClick).startsWith("clicked@"), String(rerunClick));
const confirm = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="alertdialog"]')].find(x => (x.textContent || '').includes('from scratch') || (x.textContent || '').includes('restarts from scratch')); return JSON.stringify({ open: !!d, title: d?.querySelector('h2')?.textContent?.trim() ?? null, desc: (d?.textContent || '').includes('Existing downstream results stay on disk until those jobs re-run') }); })()`,
  (v) => v.open === true, 12, 600,
);
ok("R the confirm dialog speaks 'Re-run <name>?'", confirm?.title === `Re-run ${NAME_FILTER}?`, confirm?.title ?? "none");
ok("R the confirm teaches the stay-contract (downstream results stay until re-run)", confirm?.desc === true);
const startClick = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Start again')`);
ok("R 'Start again' fired", String(startClick).startsWith("clicked@"), String(startClick));
const runR = await pollUntil(filter.id, "completed");
ok("R the re-run completed with the EDITED list", runR.status === "completed", runR.status);
ok("R THE COUNT LAW speaks the edit — '4 of 6 · 2 excluded (list of 2)'", String(runR.result ?? "").includes("4 of 6 micrographs kept · 2 excluded (list of 2)"), String(runR.result ?? "none").slice(0, 90));
const outsR = apiJson(`/api/jobs/${filter.id}/outputs`);
const starR = (outsR.files ?? []).find((f) => f.name === "micrographs_filtered.star");
ok("R the filtered star now rows 4 (the edit became the product)", !!starR && starR.rows === 4, String(starR?.rows ?? "none"));
const logR = apiJson(`/api/jobs/${filter.id}/log`);
let logTextR = typeof logR === "string" ? logR : (logR.tail ?? "");
// the log read races the run's own file write — read-until-the-ledger-speaks
for (let i = 0; i < 10; i++) {
  if (logTextR.includes("− mic_002.mrc") && logTextR.includes("− mic_004.mrc")) break;
  await sleep(1500);
  const again = apiJson(`/api/jobs/${filter.id}/log`);
  logTextR = typeof again === "string" ? again : (again.tail ?? logTextR);
}
ok("R the run log lists the NEW exclusion ledger", logTextR.includes("− mic_002.mrc") && logTextR.includes("− mic_004.mrc"), "the − lines");

/* =========================== band D ====================================== */
console.log("== band D: the downstream breathes — CTF-A drinks the edited filter ==");
const rd = api("POST", `/api/jobs/${ctfA.id}/run`, REMOTE_BODY);
ok("D CTF-A's re-run accepted (remote lane, fed by the filter)", !rd.error, rd.error ?? rd.job?.status ?? "");
const runD = await pollUntil(ctfA.id, "completed");
ok("D CTF-A completed on the edited filtered feed", runD.status === "completed", runD.status);
const ctfRows = apiJson(`/api/jobs/${ctfA.id}/ctf`).micrographs ?? [];
const ctfNames = ctfRows.map((r) => String(r.name).split("/").pop()).sort();
ok("D the /ctf route answers 4 rows (the new survivors)", ctfRows.length === 4, ctfNames.join(","));
ok("D the survivors are mic_001/003/005/006 (the excluded two never reached CTF-A)",
  JSON.stringify(ctfNames) === JSON.stringify(["mic_001.mrc", "mic_003.mrc", "mic_005.mrc", "mic_006.mrc"]), ctfNames.join(","));

/* =========================== band N ====================================== */
console.log("== band N: 320 — the door's own narrow face inside the inspector ==");
// the viewport switch may or may not reload — the inspector from band R may
// still be open. ASSERT the face first; only re-open if the switch closed it.
sh(`${AB} set viewport 320 800`);
await sleep(1200);
let nOpen = await poll(
  `JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('job inspector')) })`,
  (v) => v.open === true, 6, 500,
);
if (!nOpen) {
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
  await settleCensus();
  const cardExpr = `[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${NAME_FILTER}'))?.querySelector('[role="button"][tabindex]')`;
  for (let round = 0; round < 6 && !nOpen; round++) {
    await realClick(cardExpr); // the deck stacks at 320 — click until it speaks
    nOpen = await poll(
      `JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('job inspector')) })`,
      (v) => v.open === true, 5, 500,
    );
    if (!nOpen) { try { sh(`${AB} press Escape`); } catch {} await sleep(700); }
  }
}
ok("N the door's inspector face present at 320", nOpen?.open === true);
const narrow = await poll(
  `(() => { const el = [...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters'); if (!el) return JSON.stringify({ present: false }); const r = el.getBoundingClientRect(); return JSON.stringify({ present: true, fits: r.width > 0 && r.right <= window.innerWidth + 2 && r.left >= -2, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`,
  (v) => v.present === true, 12, 600,
);
ok("N the 'Edit parameters' door visible and fitting at 320", narrow?.present === true && narrow?.fits === true, `fits=${narrow?.fits}`);
ok("N no horizontal overflow", (narrow?.overX ?? 1) <= 0, `overX=${narrow?.overX}`);
sh(`${AB} press Escape`);
await sleep(800);
const inspClosed = evalJson(`JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('job inspector')) })`);
ok("N Escape closes the inspector (the stack law)", inspClosed?.gone === true);
sh(`${AB} set viewport 1280 900`);

/* =========================== band R2 ===================================== */
console.log("== band R2: the restore — the seed world home, the doctor CLEAN ==");
try { sh(`${AB} close`); } catch {}
const st = JSON.parse(readFileSync(STATE, "utf8"));
const liveRewire = edges().find((e) => e.fromJobId === st.filter && e.toJobId === ctfA.id);
if (liveRewire) { const d = api("DELETE", `/api/edges/${liveRewire.id}`); ok("R2 the re-wire edge off", !d.error, liveRewire.id); }
else ok("R2 no re-wire to undo (idempotent)", true);
const seedBack = edges().find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
if (!seedBack) {
  const p = api("POST", "/api/edges", { fromJobId: mcA.id, toJobId: ctfA.id });
  ok("R2 the seed MC-A→CTF-A edge home (fresh id — the t359 UUID gate)", !p.error && !!p.edge?.id, p.error ?? p.edge?.id);
} else ok("R2 the seed edge already in place", true, seedBack.id);
const dFilter = api("DELETE", `/api/jobs/${st.filter}`);
const filterGone = !dFilter.error || String(dFilter.error).includes("not found");
ok("R2 the filter deleted (edges cascade)", filterGone, dFilter.error ?? "gone");
let rmOut = "";
try { rmOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs remove 2>&1`); } catch (e) { rmOut = String(e); }
ok("R2 the t922 remove GREEN", /REMOVE \d+ pass \/ 0 fail/.test(rmOut), (rmOut.match(/REMOVE .*/) ?? ["?"])[0]);
ok("R2 the world back to the seed trio (3 jobs)", jobs().length === 3);
ok("R2 the world holds exactly 2 edges", edges().length === 2);
console.log("  -- CTF-A's final re-run on the seed feed (6 rows again) --");
const rf = api("POST", `/api/jobs/${ctfA.id}/run`, REMOTE_BODY);
ok("R2 CTF-A's seed-feed re-run accepted", !rf.error, rf.error ?? "");
const runF = await pollUntil(ctfA.id, "completed");
ok("R2 CTF-A completed on the seed feed", runF.status === "completed", runF.status);
const rowsF = apiJson(`/api/jobs/${ctfA.id}/ctf`).micrographs ?? [];
ok("R2 the /ctf route answers 6 rows again (the seed's truth restored)", rowsF.length === 6, String(rowsF.length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("R2 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({
  main: {
    pass, fail,
    door: { tooltip: TIP_DOOR, nonDestructive: true },
    edit: { from: LIST_FULL, to: LIST_TWO },
    runs: { first: run0.result, rerun: runR.result },
    downstream: { ctfARows: ctfNames },
    at: new Date().toISOString(),
  },
});
console.log(`== t924 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
