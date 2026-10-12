#!/usr/bin/env node
/**
 * t923 — the exclude verb's DOWNSTREAM HALF: the excludemg filter's own
 * faces, ridden live. t922 fired the verb and witnessed the mint + the
 * adopt; the filter it minted then stood UNOPENED. This window the
 * filter opens its mouth:
 *
 *   prep  the t922 mint re-rides (34/34), then the filter setup rides the
 *         product's own doors the way the store's adoptWithExclude moves
 *         them: POST the excludemg job (the baked list), MC-B feeds it,
 *         MC-A→CTF-A comes OFF (recorded), the filter feeds CTF-A.
 *   E     the EDIT face (the t452 contract's spoken-but-unridden half):
 *         the filter's JobPanel (aside, anchored by "a filter, not a
 *         re-estimate") opens ON the Exclusions tab (the spec's only
 *         tab), the input holds the baked list, the hint teaches the
 *         grammar — and the debounced auto-save (~700ms) lands an EDIT
 *         (drop mic_006 from the list) into the job's params.
 *   R     the RUN face: the filter runs (engine-native, the local lane
 *         BEFORE any RELION gate) and speaks the count law verbatim —
 *         "4 of 6 micrographs kept · 2 excluded (list of 2)" — with the
 *         filtered star as its product and the log's own name ledger.
 *   X     the EMPTY refusal: the list cleared, the run refuses with the
 *         teaching error verbatim ("no exclusion names are set — bake
 *         the list from the A/B compare dialog (or type names into the
 *         Exclusions tab), then run again"); the list restored.
 *   F     the re-run with the full list: "3 of 6 kept · 3 excluded".
 *   D     the DOWNSTREAM consumes at the data layer: CTF-A re-runs fed
 *         by the filter's 3-mic star (remote lane) and its /ctf route
 *         answers 3 rows — the survivors mic_001/003/005.
 *   N     320: the Exclusions tab fits the narrow panel (overX 0).
 *   R2    the restore: the re-wire undone, the seed edge home (fresh id —
 *         the t359 UUID gate), the filter gone, the t922 remove GREEN
 *         (16/16), CTF-A re-run on the seed feed (6 rows again), the
 *         doctor CLEAN.
 *
 *   node scripts/t923-filter-run-witness.mjs main
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t923-filter-run-witness.json";
const STATE = path.join(ROOT, "data", "t923-filter-run.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_FILTER = "Exclude Micrographs (t923)";
const PANEL_ANCHOR = "a filter, not a re-estimate";
const LIST_FULL = "mic_002.mrc, mic_004.mrc, mic_006.mrc";
const LIST_TWO = "mic_002.mrc, mic_004.mrc";

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
console.log("== prep: the t922 mint re-rides, then the filter setup through the product's doors ==");
const mcA = findName(NAME_MC_A);
const mcB = findName(NAME_MC_B);
const ctfA = findName(NAME_CTF_A);
// a prior red ride may leave the world MID-ADOPT (the seed edge lifted, the
// filter feeding CTF-A) — undo that shape FIRST so the mint's own asserts
// see the seed wiring they were written against
const preFilter = findName(NAME_FILTER);
if (preFilter) {
  const preRewire = edges().find((e) => e.fromJobId === preFilter.id && e.toJobId === ctfA?.id);
  if (preRewire) { const d = api("DELETE", `/api/edges/${preRewire.id}`); ok("prep a prior ride's re-wire undone", !d.error, preRewire.id); }
}
const preSeed = ctfA && mcA ? edges().find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id) : null;
if (!preSeed && mcA && ctfA) {
  const p = api("POST", "/api/edges", { fromJobId: mcA.id, toJobId: ctfA.id });
  ok("prep the seed MC-A→CTF-A edge back for the mint", !p.error && !!p.edge?.id, p.error ?? p.edge?.id);
}
let mintOut = "";
try { mintOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs mint 2>&1`); } catch (e) { mintOut = String(e); }
ok("prep the t922 mint GREEN", /MINT \d+ pass \/ 0 fail/.test(mintOut), (mintOut.match(/MINT .*/) ?? ["?"])[0]);

ok("prep the three runs aboard and completed", !!mcA && !!mcB && !!ctfA && [mcA, mcB, ctfA].every((j) => j.status === "completed"));

const conn = (apiJson("/api/remote/connections").connections ?? []).find((c) => c.name === "Mock Cluster");
const REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };

// the filter, minted FRESH every ride: the CARD CLICK's dispatch is
// status-dependent (job-card.tsx:2192 — idle → onSelect opens the JobPanel;
// non-idle → onInspect opens the read-only inspector), so the edit face is
// only reachable on an IDLE filter. A completed leftover would open the
// wrong door — delete and re-mint.
const preF = findName(NAME_FILTER);
if (preF) { const d = api("DELETE", `/api/jobs/${preF.id}`); ok("prep a stale filter deleted (the edit face is an IDLE-filter face)", !d.error || String(d.error).includes("not found"), preF.id.slice(0, 8)); }
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

/* =========================== band E ====================================== */
console.log("== band E: the EDIT face — the Exclusions tab holds the baked list ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 4, 30);
await settleCensus();
const cardClick = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${NAME_FILTER}'))?.querySelector('[role="button"][tabindex]')`);
ok("E the filter's card clicked (own at the actual point)", String(cardClick).startsWith("clicked@"), String(cardClick));
const panelOpen = await poll(
  // the JobPanel's outer tab bar (I/O | Params | Results | Log) — the
  // t920 law: the panel opens on I/O; the PARAMS view is one click away
  `(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); const tabs = [...(a?.querySelectorAll('[role="tab"]') ?? [])].map(t => t.textContent?.trim()); return JSON.stringify({ open: tabs.includes('Params') && tabs.includes('Log'), tabs }); })()`,
  (v) => v.open === true, 12, 600,
);
ok("E the filter's JobPanel open (I/O · Params · Results · Log)", panelOpen?.open === true, (panelOpen?.tabs ?? []).join("|"));
const paramsClick = await realClick(`(() => { const a = [...document.querySelectorAll('aside')].find(x => (x.className || '').includes('border-l')); return [...(a?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Params') ?? null; })()`);
ok("E the panel's Params tab clicked (the t920 law — the form mounts under it)", String(paramsClick).startsWith("clicked@"), String(paramsClick));
const panel = await poll(
  // THE INPUT is the panel's own gate: the JobPanel's param form is the only
  // home of #param-{id}-excludeNames (the Catalog's description entry is a
  // different DOM island entirely — the t920 aside-anchor matched IT first).
  `JSON.stringify({ input: !!document.querySelector('#param-${filter.id}-excludeNames') })`,
  (v) => v.input === true, 16, 600,
);
ok("E the param form mounted (the input is the panel's own gate)", panel?.input === true);

const tabE = evalJson(`(() => { const el = document.querySelector('#param-${filter.id}-excludeNames'); if (!el) return JSON.stringify({}); let root = el; for (let i = 0; i < 12 && root; i++) { if (root.querySelector?.('[role="tablist"]')) break; root = root.parentElement; } const tabs = [...(root?.querySelectorAll('[role="tab"]') ?? [])].map(t => t.textContent?.trim()); const active = (root?.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? '').trim(); return JSON.stringify({ tabs, active }); })()`);
ok("E the panel's tab bar speaks Exclusions (the spec's only tab)", (tabE?.tabs ?? []).includes("Exclusions"), (tabE?.tabs ?? []).join("|"));
ok("E the Exclusions tab ACTIVE by default (allTabs[0])", tabE?.active === "Exclusions", tabE?.active ?? "none");

const field = await poll(
  `(() => { const el = document.querySelector('#param-${filter.id}-excludeNames'); return JSON.stringify({ present: !!el, value: el?.value ?? null, aria: el?.getAttribute('aria-label') ?? null, title: el?.getAttribute('title') ?? null }); })()`,
  (v) => v.present === true, 10, 500,
);
ok("E the excludeNames input present (param-{id}-{key} law)", field?.present === true);
ok("E the input HOLDS the baked list", field?.value === LIST_FULL, field?.value ?? "none");
const labelE = evalJson(`(() => { const l = document.querySelector('label[for="param-${filter.id}-excludeNames"]'); return JSON.stringify({ text: l?.textContent?.trim() ?? null }); })()`);
ok("E the label speaks the param's name (the htmlFor association)", labelE?.text === "Excluded micrographs", labelE?.text ?? "none");
ok("E the hint teaches the grammar (one name per line or comma-separated)", (field?.title ?? "").includes("one name per line or comma-separated"), (field?.title ?? "").slice(0, 80));

sh(`${AB} fill "#param-${filter.id}-excludeNames" "${LIST_TWO}"`);
await sleep(1500); // the debounced auto-save's own window (~700ms) plus wire
const savedTwo = apiJson(`/api/jobs`).jobs.find((j) => j.id === filter.id)?.params?.excludeNames;
ok("E the EDIT landed (the debounced save, no Save button to forget)", savedTwo === LIST_TWO, String(savedTwo));
const saveBadge = evalJson(`(() => { const el = document.querySelector('#param-${filter.id}-excludeNames'); let root = el; for (let i = 0; i < 14 && root; i++) { if (root.querySelector?.('[aria-live="polite"]')) break; root = root.parentElement; } const live = root?.querySelector('[aria-live="polite"]'); return JSON.stringify({ text: live?.textContent?.trim() ?? null }); })()`);
ok("E the auto-save status speaks (aria-live)", !!saveBadge?.text && /saved|saving|saved at/i.test(saveBadge.text), (saveBadge?.text ?? "none").slice(0, 60));

/* =========================== band R ====================================== */
console.log("== band R: the RUN face — the count law verbatim ==");
const r1 = api("POST", `/api/jobs/${filter.id}/run`);
ok("R the filter's run accepted (bare POST — engine-native is local by design)", !r1.error, r1.error ?? r1.job?.status ?? "");
const run1 = await pollUntil(filter.id, "completed");
ok("R the filter completed", run1.status === "completed", run1.status);
ok("R THE COUNT LAW verbatim (4 of 6 kept · 2 excluded)", String(run1.result ?? "").includes("4 of 6 micrographs kept · 2 excluded (list of 2)"), String(run1.result ?? "none").slice(0, 90));
const outs1 = apiJson(`/api/jobs/${filter.id}/outputs`);
const starFile = (outs1.files ?? []).find((f) => f.name === "micrographs_filtered.star");
ok("R the filtered star is the product (rows = the kept 4)", !!starFile && starFile.rows === 4, JSON.stringify(starFile ?? {}).slice(0, 100));
const log1 = apiJson(`/api/jobs/${filter.id}/log`);
const logText1 = typeof log1 === "string" ? log1 : (log1.tail ?? "");
ok("R the run log lists the exclusion ledger", logText1.includes("− mic_002.mrc") && logText1.includes("− mic_004.mrc"), "the − lines");

/* =========================== band X ====================================== */
console.log("== band X: the EMPTY refusal — the teaching error verbatim ==");
// the REAL keyboard gesture: click the input, select-all, delete — fill("")
// is a no-op in the browser driver, but a user's clear is two keystrokes
const focusClick = await realClick(`document.querySelector('#param-${filter.id}-excludeNames')`);
ok("X the input focused (own at the actual point)", String(focusClick).startsWith("clicked@"), String(focusClick));
sh(`${AB} press Control+a`);
sh(`${AB} press Delete`);
await sleep(1800);
const savedEmpty = jobs().find((j) => j.id === filter.id)?.params?.excludeNames;
ok("X the empty list landed (select-all + delete)", (savedEmpty ?? "") === "", String(savedEmpty ?? "(empty)"));
const r2 = api("POST", `/api/jobs/${filter.id}/run`);
ok("X the run POST carried the refusal (honest 200 + error)", !!r2.error, String(r2.error ?? "").slice(0, 60));
const run2 = await pollUntil(filter.id, "failed");
ok("X the filter failed honestly", run2.status === "failed", run2.status);
ok("X THE TEACHING ERROR verbatim",
  String(run2.result ?? "") === "no exclusion names are set — bake the list from the A/B compare dialog (or type names into the Exclusions tab), then run again",
  String(run2.result ?? "none").slice(0, 100));

console.log("== band F: the full list restored, the run speaks 3 ==");
sh(`${AB} fill "#param-${filter.id}-excludeNames" "${LIST_FULL}"`);
await sleep(1500);
const savedFull = jobs().find((j) => j.id === filter.id)?.params?.excludeNames;
ok("F the full list landed again", savedFull === LIST_FULL, String(savedFull));
const r3 = api("POST", `/api/jobs/${filter.id}/run`);
ok("F the re-run accepted", !r3.error, r3.error ?? "");
const run3 = await pollUntil(filter.id, "completed");
ok("F the filter completed with the full list", run3.status === "completed", run3.status);
ok("F THE COUNT LAW verbatim (3 of 6 kept · 3 excluded)", String(run3.result ?? "").includes("3 of 6 micrographs kept · 3 excluded (list of 3)"), String(run3.result ?? "none").slice(0, 90));

/* =========================== band D ====================================== */
console.log("== band D: the DOWNSTREAM consumes at the data layer ==");
const rd = api("POST", `/api/jobs/${ctfA.id}/run`, REMOTE_BODY);
ok("D CTF-A's re-run accepted (remote lane, fed by the filter)", !rd.error, rd.error ?? rd.job?.status ?? "");
const runD = await pollUntil(ctfA.id, "completed");
ok("D CTF-A completed on the filtered feed", runD.status === "completed", runD.status);
const ctfRows = apiJson(`/api/jobs/${ctfA.id}/ctf`).micrographs ?? [];
const ctfNames = ctfRows.map((r) => String(r.name).split("/").pop()).sort();
ok("D the /ctf route answers 3 rows (the survivors)", ctfRows.length === 3, ctfNames.join(","));
ok("D the survivors are mic_001/003/005 (the excluded never reached CTF-A)",
  JSON.stringify(ctfNames) === JSON.stringify(["mic_001.mrc", "mic_003.mrc", "mic_005.mrc"]), ctfNames.join(","));
const ctfB = findName(NAME_MC_B.replace("Motion", "CTF").replace("Correction 2", "Estimation 2"));
const ctfBRows = ctfB ? apiJson(`/api/jobs/${ctfB.id}/ctf`).micrographs ?? [] : [];
ok("D the sibling CTF-B untouched (6 rows — its own run's truth)", ctfBRows.length === 6, String(ctfBRows.length));

/* =========================== band N ====================================== */
console.log("== band N: 320 — the Exclusions tab fits the narrow panel ==");
sh(`${AB} set viewport 320 800`);
await settleCensus();
const narrow = await poll(
  `(() => { const el = document.querySelector('#param-${filter.id}-excludeNames'); if (!el) return JSON.stringify({ present: false }); const r = el.getBoundingClientRect(); return JSON.stringify({ present: true, fits: r.width > 0 && r.right <= window.innerWidth + 2, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`,
  (v) => v.present === true, 12, 600,
);
ok("N the excludeNames input present and fits at 320", narrow?.present === true && narrow?.fits === true, `fits=${narrow?.fits}`);
ok("N no horizontal overflow", (narrow?.overX ?? 1) <= 0, `overX=${narrow?.overX}`);
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
    edit: { from: LIST_FULL, to: LIST_TWO, backTo: LIST_FULL },
    runs: { two: run1.result, empty: run2.result, full: run3.result },
    downstream: { ctfARows: ctfNames, ctfBRows: ctfBRows.length },
    at: new Date().toISOString(),
  },
});
console.log(`== t923 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
