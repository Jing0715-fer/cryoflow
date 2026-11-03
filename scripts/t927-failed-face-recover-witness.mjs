#!/usr/bin/env node
/**
 * t927 — the door at the FAILED face: a failed filter's edit-recover loop,
 * ridden live. Carried three times into the entries (t924 → t925 → t926),
 * this is the house's own recovery arc: t923 rode the EMPTY refusal (the
 * row flips failed honestly), t924 rode the second edit door on a
 * COMPLETED face — but no one has ever come BACK from the failure through
 * the door. This window the loop closes:
 *
 *   prep  the t922 mint re-rides (34/0), the filter minted idle (the full
 *         list), wired MC-B→filter→CTF-A (the seed edge lifted), and RUNS
 *         ONCE — the completed receipt ("3 of 6 · list of 3", rows 3) is
 *         what the failure will tear.
 *   X     THE FAILURE through the second door: the completed filter's card
 *         click opens the read-only inspector; "Edit parameters" opens the
 *         JobPanel (the receipt intact); the Exclusions list is cleared by
 *         the REAL keyboard gesture (select-all + delete — fill("") is a
 *         no-op); the debounced save lands the EMPTY list; the status never
 *         leaves completed through the edit; the API re-run REFUSES and the
 *         row flips failed with the teaching error verbatim.
 *   F     THE FAILED FACE: the card click's status-dependent dispatch
 *         re-proven on the failed face — the inspector opens, the failed
 *         summary card speaks "Job failed" + the teaching error verbatim,
 *         and the "Edit parameters" door is PRESENT on the failed face
 *         (status !== "running" — failed included), its tooltip teaching
 *         the promise verbatim.
 *   N     320 born-at-band ON THE FAILED FACE: mount at 320, the find bar
 *         centers the card (the t926 law — mount memory does not know the
 *         window), the failed card and the door fit the narrow viewport,
 *         overX 0, Escape closes.
 *   R     THE RECOVER: the door click from the FAILED face — the failed
 *         receipt INTACT (status still failed — the non-destructive law's
 *         failed face); the input holds the EMPTY list (the failure's
 *         cause, readable); the recovery list typed in (DIFFERENT from the
 *         first run's — the edit drives the recovery); the status never
 *         leaves failed through the edit; then the INSPECTOR's Re-run
 *         (busy-only gate — clickable on the failed face): the confirm
 *         speaks "Re-run <name>?" + the stay-teaching, "Start again" fires,
 *         and THE FAILURE UNFLIPS — the count law speaks the edit verbatim
 *         ("4 of 6 micrographs kept · 2 excluded (list of 2)"), star rows 4,
 *         the log's − ledger.
 *   P     the recovered truth persists (reload — no failure resurrection).
 *   D     the downstream breathes: CTF-A re-runs fed by the recovered
 *         4-mic star (remote lane) and /ctf answers the 4 survivors;
 *         CTF-B untouched (6 rows).
 *   R2    the restore: the re-wire off, the seed edge home (fresh id —
 *         the t359 UUID gate), the filter gone, the t922 remove GREEN,
 *         CTF-A's seed-feed re-run (6 rows again), the doctor CLEAN.
 *
 *   node scripts/t927-failed-face-recover-witness.mjs main
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t927-failed-face-recover-witness.json";
const STATE = path.join(ROOT, "data", "t927-failed-face-recover.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_FILTER = "Exclude Micrographs (t927)";
const LIST_FULL = "mic_002.mrc, mic_004.mrc, mic_006.mrc";
const LIST_RECOVER = "mic_002.mrc, mic_004.mrc";
const TIP_DOOR = "without resetting — the completed run and its results stay until a Re-run replaces them";
const ERROR_EMPTY = "no exclusion names are set — bake the list from the A/B compare dialog (or type names into the Exclusions tab), then run again";

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
/* the hover-until-speaks law (t924): the action cluster re-renders under the
 * live poll and the tooltip's trigger can swap under the pointer between the
 * rect read and the mouse move — hover, LISTEN, dismiss, re-aim the SAME
 * button until ITS tooltip speaks. A tooltip that names a neighbor is a miss. */
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
/* the inspector-open poll rides the JOB NAME (the t926 law — the honest
 * anchor; 'job inspector' prose can drift, the name cannot) */
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 12, 600,
  );
  ok(`inspector "${name}" opened`, opened?.open === true);
  return opened?.open === true;
};
/* the card-click retry loop (the eaten-click law): click, poll, Escape the
 * stack, retry — the deck may hold the card under a dialog at re-open */
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
const clickParamsTab = async () => {
  const c = await realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`);
  return c;
};
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}

/* =========================== prep ======================================== */
console.log("== prep: the t922 mint re-rides, the filter wired and RUN ONCE (the receipt the failure will tear) ==");
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
  ok("prep a stale t927 filter deleted", !preF.error || String(preF.error).includes("not found"), preFilter0.id.slice(0, 8));
}
const preMcA0 = findName(NAME_MC_A);
const preSeed0 = ctfA0 && preMcA0 ? edges().find((e) => e.fromJobId === preMcA0.id && e.toJobId === ctfA0.id) : null;
if (!preSeed0 && ctfA0 && preMcA0) {
  const p = api("POST", "/api/edges", { fromJobId: preMcA0.id, toJobId: ctfA0.id });
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

// the filter's FIRST run — the completed receipt the failure will tear
const r0 = api("POST", `/api/jobs/${filter.id}/run`);
ok("prep the filter's first run accepted", !r0.error, r0.error ?? r0.job?.status ?? "");
const run0 = await pollUntil(filter.id, "completed");
ok("prep the filter completed (3 of 6 · list of 3)", run0.status === "completed" && String(run0.result ?? "").includes("3 of 6 micrographs kept · 3 excluded (list of 3)"), String(run0.result ?? "none").slice(0, 90));
const outs0 = apiJson(`/api/jobs/${filter.id}/outputs`);
const star0 = (outs0.files ?? []).find((f) => f.name === "micrographs_filtered.star");
ok("prep the receipt's filtered star at rows 3", !!star0 && star0.rows === 3, JSON.stringify(star0 ?? {}).slice(0, 80));

/* =========================== band X ====================================== */
console.log("== band X: the EMPTY failure — cleared through the second door, the teaching error verbatim ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await settleCensus();
const inspX = await openInspectorHard(NAME_FILTER);
ok("X the COMPLETED filter's card click opened the READ-ONLY inspector (the status-dependent dispatch)", String(inspX).startsWith("open@try"), String(inspX));
const doorsX = await poll(
  `JSON.stringify({ door: [...document.querySelectorAll('[role="dialog"] button')].some(b => (b.textContent || '').trim() === 'Edit parameters'), reset: [...document.querySelectorAll('[role="dialog"] button')].some(b => (b.textContent || '').includes('Reset & edit')) })`,
  (v) => v.door === true && v.reset === true, 10, 500,
);
ok("X the cluster holds BOTH doors on the completed face", doorsX?.door === true && doorsX?.reset === true);
const doorBtnX = `[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`;
const doorClickX = await realClick(doorBtnX);
ok("X the 'Edit parameters' door clicked", String(doorClickX).startsWith("clicked@"), String(doorClickX));
const swappedX = await poll(
  `JSON.stringify({ inspGone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${NAME_FILTER}')), aside: [...document.querySelectorAll('aside')].some(x => (x.className || '').includes('border-l')) })`,
  (v) => v.inspGone === true && v.aside === true, 16, 600,
);
ok("X the inspector closed AND the JobPanel opened", swappedX?.inspGone === true && swappedX?.aside === true);
const stillCompletedX = jobs().find((j) => j.id === filter.id)?.status;
ok("X THE NON-DESTRUCTIVE LAW — the job is STILL completed after the door", stillCompletedX === "completed", String(stillCompletedX));
const panelX = await panelOpen();
ok("X the JobPanel's outer tab bar (I/O · Params · Results · Log)", panelX?.open === true, (panelX?.tabs ?? []).join("|"));
const paramsX = await clickParamsTab();
ok("X the Params tab clicked (the t920 law)", String(paramsX).startsWith("clicked@"), String(paramsX));
const fieldX = await poll(
  `(() => { const el = document.querySelector('#param-${filter.id}-excludeNames'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
  (v) => v.present === true, 16, 600,
);
ok("X the input holds the baked list (the panel's own gate)", fieldX?.present === true && fieldX?.value === LIST_FULL, fieldX?.value ?? "none");
// the REAL keyboard gesture (the t923 law — fill("") is a no-op)
const focusX = await realClick(`document.querySelector('#param-${filter.id}-excludeNames')`);
ok("X the input focused (own at the actual point)", String(focusX).startsWith("clicked@"), String(focusX));
sh(`${AB} press Control+a`);
sh(`${AB} press Delete`);
await sleep(1800);
const savedEmptyX = jobs().find((j) => j.id === filter.id)?.params?.excludeNames;
ok("X the EMPTY list landed (select-all + delete, the debounced save)", (savedEmptyX ?? "") === "", String(savedEmptyX ?? "(empty)"));
const stillCompletedX2 = jobs().find((j) => j.id === filter.id)?.status;
ok("X the status NEVER left completed through the edit", stillCompletedX2 === "completed", String(stillCompletedX2));
// the API re-run with the empty list — the honest refusal, the row flips failed
const r2 = api("POST", `/api/jobs/${filter.id}/run`);
ok("X the run POST carried the refusal (honest 200 + error)", !!r2.error, String(r2.error ?? "").slice(0, 70));
const run2 = await pollUntil(filter.id, "failed");
ok("X the filter FAILED honestly", run2.status === "failed", run2.status);
ok("X THE TEACHING ERROR verbatim", String(run2.result ?? "") === ERROR_EMPTY, String(run2.result ?? "none").slice(0, 110));

writeReceipt({ prep: { filter: filter.id, first: run0.result, failure: run2.result } });

/* =========================== band F ====================================== */
console.log("== band F: THE FAILED FACE — the dispatch re-proven, the failure spoken, the door present ==");
const inspF = await openInspectorHard(NAME_FILTER);
ok("F the FAILED filter's card click opened the READ-ONLY inspector (the dispatch on the failed face)", String(inspF).startsWith("open@try"), String(inspF));
// the smart default: a FAILED job's inspector opens on the LOG tab (the
// failed summary card lives in the OVERVIEW tab — job-inspector.tsx's
// setTab law) — the instrument climbs the product's own tab door first
const ovClickF = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_FILTER}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
ok("F the inspector's Overview tab clicked (the failed card's home)", String(ovClickF).startsWith("clicked@"), String(ovClickF));
const failedCard = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_FILTER}')); const t = d?.textContent || ''; return JSON.stringify({ failedWords: t.includes('Job failed'), error: t.includes(${JSON.stringify(ERROR_EMPTY)}) }); })()`,
  (v) => v.failedWords === true, 10, 500,
);
ok("F the failed summary card speaks 'Job failed'", failedCard?.failedWords === true);
ok("F THE TEACHING ERROR SPOKEN IN THE INSPECTOR (job.result verbatim)", failedCard?.error === true);
const doorF = await poll(
  `JSON.stringify({ door: [...document.querySelectorAll('[role="dialog"] button')].some(b => (b.textContent || '').trim() === 'Edit parameters') })`,
  (v) => v.door === true, 10, 500,
);
ok("F the 'Edit parameters' door PRESENT on the FAILED face (status !== running)", doorF?.door === true);
const doorBtnF = `[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`;
const tipF = await hoverTip(doorBtnF, TIP_DOOR);
ok("F the door's tooltip teaches the promise on the failed face (verbatim)", !!tipF, (tipF?.tips ?? []).join(" | ").slice(0, 110));
sh(`${AB} mouse move 4 4`);
await sleep(400);
try { sh(`${AB} press Escape`); } catch {}
await sleep(800);

/* =========================== band N ====================================== */
console.log("== band N: 320 born-at-band — the FAILED face at the narrow door ==");
// the t926 law: mount AT 320 (set-viewport does not reload, and mount memory
// does not know the window) — then the FIND BAR centers the card through
// focusJob, the same door a narrow-window user reaches for.
sh(`${AB} set viewport 320 800`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(800);
sh(`${AB} press Control+f`);
await sleep(500);
sh(`${AB} keyboard type "${NAME_FILTER}"`);
await sleep(600);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
const findCentered = evalJson(`JSON.stringify({ vis: (() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME_FILTER}')); if (!c) return false; const r = c.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; })() })`);
ok("N the find bar centered the FAILED card (the unique fragment's focusJob)", findCentered?.vis === true, JSON.stringify(findCentered));
const inspN = await openInspectorHard(NAME_FILTER, 4);
ok("N the failed face opens at 320 (click-until-it-speaks)", String(inspN).startsWith("open@try"), String(inspN));
// the same smart-default climb: Log is the failed job's landing tab — the
// Overview speaks the failed summary card
const ovClickN = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_FILTER}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
ok("N the Overview tab clicked at 320", String(ovClickN).startsWith("clicked@"), String(ovClickN));
const narrowN = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_FILTER}')); const t = d?.textContent || ''; const btn = [...(d?.querySelectorAll('button') ?? [])].find(b => (b.textContent || '').trim() === 'Edit parameters'); const r = btn?.getBoundingClientRect(); return JSON.stringify({ failedWords: t.includes('Job failed'), doorPresent: !!btn, fits: r ? (r.width > 0 && r.right <= window.innerWidth + 2 && r.left >= -2) : false, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`,
  (v) => v.doorPresent === true, 12, 600,
);
ok("N the failed card speaks at 320 ('Job failed' present)", narrowN?.failedWords === true);
ok("N the 'Edit parameters' door visible and fitting at 320", narrowN?.doorPresent === true && narrowN?.fits === true, `fits=${narrowN?.fits}`);
ok("N no horizontal overflow", (narrowN?.overX ?? 1) <= 0, `overX=${narrowN?.overX}`);
sh(`${AB} press Escape`);
await sleep(800);
const inspClosedN = evalJson(`JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${NAME_FILTER}')) })`);
ok("N Escape closes the inspector (the stack law)", inspClosedN?.gone === true);
sh(`${AB} set viewport 1280 900`);

/* =========================== band R ====================================== */
console.log("== band R: THE RECOVER — the door from the FAILED face, the edit, the Re-run, the unflip ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await settleCensus();
const inspR = await openInspectorHard(NAME_FILTER);
ok("R the failed face opens again (the recover's start)", String(inspR).startsWith("open@try"), String(inspR));
const doorBtnR = `[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Edit parameters')`;
const doorClickR = await realClick(doorBtnR);
ok("R the door clicked FROM THE FAILED FACE", String(doorClickR).startsWith("clicked@"), String(doorClickR));
const swappedR = await poll(
  `JSON.stringify({ inspGone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${NAME_FILTER}')), aside: [...document.querySelectorAll('aside')].some(x => (x.className || '').includes('border-l')) })`,
  (v) => v.inspGone === true && v.aside === true, 16, 600,
);
ok("R the inspector closed AND the JobPanel opened (one door replaces the other)", swappedR?.inspGone === true && swappedR?.aside === true);
const stillFailedR = jobs().find((j) => j.id === filter.id)?.status;
ok("R THE NON-DESTRUCTIVE LAW'S FAILED FACE — the job is STILL failed after the door", stillFailedR === "failed", String(stillFailedR));
const panelR = await panelOpen();
ok("R the JobPanel open", panelR?.open === true);
const paramsR = await clickParamsTab();
ok("R the Params tab clicked", String(paramsR).startsWith("clicked@"), String(paramsR));
const fieldR = await poll(
  `(() => { const el = document.querySelector('#param-${filter.id}-excludeNames'); return JSON.stringify({ present: !!el, value: el?.value ?? null }); })()`,
  (v) => v.present === true, 16, 600,
);
ok("R THE FAILURE'S CAUSE READABLE — the input holds the EMPTY list", fieldR?.present === true && (fieldR?.value ?? "x") === "", JSON.stringify(fieldR?.value));
sh(`${AB} fill "#param-${filter.id}-excludeNames" "${LIST_RECOVER}"`);
await sleep(1800);
const savedRecover = jobs().find((j) => j.id === filter.id)?.params?.excludeNames;
ok("R the RECOVERY list landed (the debounced save)", savedRecover === LIST_RECOVER, String(savedRecover));
const stillFailedR2 = jobs().find((j) => j.id === filter.id)?.status;
ok("R the status NEVER left failed through the edit (the edit does not run)", stillFailedR2 === "failed", String(stillFailedR2));
// the re-run through the INSPECTOR's own Re-run face (busy-only — clickable
// on the failed face, where the panel's Run stays relion-gated on this host)
const inspR2 = await openInspectorHard(NAME_FILTER);
ok("R the failed face opens for the Re-run", String(inspR2).startsWith("open@try"), String(inspR2));
const rerunBtn = `[...document.querySelectorAll('[role="dialog"] button')].find(b => (b.textContent || '').trim() === 'Re-run')`;
const rerunClick = await realClick(rerunBtn);
ok("R the inspector's Re-run clicked (busy-only gate — clickable on the FAILED face)", String(rerunClick).startsWith("clicked@"), String(rerunClick));
const confirm = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="alertdialog"]')].find(x => (x.textContent || '').includes('from scratch') || (x.textContent || '').includes('restarts from scratch')); return JSON.stringify({ open: !!d, title: d?.querySelector('h2')?.textContent?.trim() ?? null, desc: (d?.textContent || '').includes('Existing downstream results stay on disk until those jobs re-run') }); })()`,
  (v) => v.open === true, 12, 600,
);
ok("R the confirm dialog speaks 'Re-run <name>?'", confirm?.title === `Re-run ${NAME_FILTER}?`, confirm?.title ?? "none");
ok("R the confirm teaches the stay-contract (downstream results stay until re-run)", confirm?.desc === true);
const startClick = await realClick(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => (b.textContent || '').trim() === 'Start again')`);
ok("R 'Start again' fired", String(startClick).startsWith("clicked@"), String(startClick));
// THE UNFLIP GATE — the pre-dispatch state is "failed" and a naive settled-
// status poll can return THAT (the first red ride's deepest lesson: the
// poll sampled BEFORE the dispatch landed and read the pre-run state as
// the verdict, while the recovery itself completed a breath later — the
// star read rows 4 two lines down). The gate waits for the recovery's OWN
// verdict: the first completed after Start again IS the unflip.
let runR = null;
const tR = Date.now();
while (Date.now() - tR < 240_000) {
  const j = jobs().find((x) => x.id === filter.id);
  if (j?.status === "completed") { runR = j; break; }
  await sleep(2000);
}
ok("R the recovery run COMPLETED — the failure unflips", runR?.status === "completed", runR?.status ?? "TIMEOUT");
ok("R THE COUNT LAW SPEAKS THE EDIT verbatim (4 of 6 · 2 excluded, list of 2)", String(runR.result ?? "").includes("4 of 6 micrographs kept · 2 excluded (list of 2)"), String(runR.result ?? "none").slice(0, 100));
const outsR = apiJson(`/api/jobs/${filter.id}/outputs`);
const starR = (outsR.files ?? []).find((f) => f.name === "micrographs_filtered.star");
ok("R the filtered star now rows 4 (the recovery became the product)", !!starR && starR.rows === 4, String(starR?.rows ?? "none"));
const logR = apiJson(`/api/jobs/${filter.id}/log`);
let logTextR = typeof logR === "string" ? logR : (logR.tail ?? "");
// the log read races the run's own file write — read-until-the-ledger-speaks
for (let i = 0; i < 10; i++) {
  if (logTextR.includes("− mic_002.mrc") && logTextR.includes("− mic_004.mrc")) break;
  await sleep(1500);
  const again = apiJson(`/api/jobs/${filter.id}/log`);
  logTextR = typeof again === "string" ? again : (again.tail ?? logTextR);
}
ok("R the run log lists the recovery's exclusion ledger", logTextR.includes("− mic_002.mrc") && logTextR.includes("− mic_004.mrc"), "the − lines");

/* =========================== band P ====================================== */
console.log("== band P: the recovered truth persists — no failure resurrection ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await settleCensus();
const statusP = jobs().find((j) => j.id === filter.id)?.status;
ok("P the filter's status at the data layer is completed (the recovery persisted)", statusP === "completed", String(statusP));
const cardP = evalJson(`JSON.stringify({ card: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME_FILTER}')) })`);
ok("P the canvas draws the recovered filter card", cardP?.card === true);
const resultP = jobs().find((j) => j.id === filter.id)?.result ?? "";
ok("P the card's receipt speaks the recovery (no failure text)", String(resultP).includes("4 of 6 micrographs kept"), String(resultP).slice(0, 80));

/* =========================== band D ====================================== */
console.log("== band D: the downstream breathes — CTF-A drinks the recovered filter ==");
const rd = api("POST", `/api/jobs/${ctfA.id}/run`, REMOTE_BODY);
ok("D CTF-A's re-run accepted (remote lane, fed by the recovered filter)", !rd.error, rd.error ?? rd.job?.status ?? "");
const runD = await pollUntil(ctfA.id, "completed");
ok("D CTF-A completed on the recovered feed", runD.status === "completed", runD.status);
const ctfRows = apiJson(`/api/jobs/${ctfA.id}/ctf`).micrographs ?? [];
const ctfNames = ctfRows.map((r) => String(r.name).split("/").pop()).sort();
ok("D the /ctf route answers 4 rows (the survivors)", ctfRows.length === 4, ctfNames.join(","));
ok("D the survivors are mic_001/003/005/006 (the excluded two never reached CTF-A)",
  JSON.stringify(ctfNames) === JSON.stringify(["mic_001.mrc", "mic_003.mrc", "mic_005.mrc", "mic_006.mrc"]), ctfNames.join(","));
const ctfB = findName(NAME_MC_B.replace("Motion", "CTF").replace("Correction 2", "Estimation 2"));
const ctfBRows = ctfB ? apiJson(`/api/jobs/${ctfB.id}/ctf`).micrographs ?? [] : [];
ok("D the sibling CTF-B untouched (6 rows — its own run's truth)", ctfBRows.length === 6, String(ctfBRows.length));

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
    loop: { first: run0.result, failure: run2.result, recovery: runR.result, recoveredList: LIST_RECOVER },
    door: { failedFaceTooltip: TIP_DOOR, nonDestructive: true },
    narrow: { viewport: "320x800", findBar: NAME_FILTER },
    downstream: { ctfARows: ctfNames, ctfBRows: ctfBRows.length },
    at: new Date().toISOString(),
  },
});
console.log(`== t927 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
