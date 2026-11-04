#!/usr/bin/env node
/* t887b — THE WALK (the browser half of t887, split out after the OOM):
 * the world-building half (the template chain + the side world) already
 * stands in the sandbox project — this script rides the three ADOPTION
 * VERBS at the UI level and spends the world afterwards.
 *
 * The three flights (each: the verb's honest enabled state -> the click ->
 * the receipt toast -> the GRAPH truth via the API):
 *   1. THE PLAIN ADOPT — run A's two template wires re-parent onto run B.
 *   2. THE SELECT RIDER — mint a 2D Class Selection consuming run B (the
 *      gained classes baked at birth), wire BOTH mouths, re-parent A's
 *      fresh child onto the MINT.
 *   3. THE EXCLUDE RIDER — mint an Exclude Micrographs filter consuming
 *      the subset run B (the regressed names baked), re-parent A's CTF
 *      onto the FILTER.
 *   Plus the honest absences (the class dialog has no exclude rider; the
 *   motion dialog has no select rider) and the spent-run's honest disabled
 *   state ("no downstream jobs to re-wire").
 *
 * Teardown: DELETE the sandbox project, switch back to the tutorial, verify
 * 15/15 — the spent world leaves no residue in the demo.
 *
 *   node scripts/t887b-walk.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const JSONH = `${ORIGIN} -H "Content-Type: application/json"`;
const SANDBOX_NAME = "t887-adoption-throwaway";
let pass = 0, fail = 0;
const results = [];

const ok = (label, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`); }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try { out = JSON.parse(raw); } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch { /* a plain string */ }
  }
  return out;
};
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));

const api = (method, path, body) => {
  const bodyArg = body !== undefined ? ` -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : "";
  const out = execSync(`curl -s --max-time 30 -X ${method} ${JSONH}${bodyArg} ${BASE}${path}`, { encoding: "utf8" });
  try { return JSON.parse(out); } catch { return { raw: out }; }
};
const jobsOf = async () => api("GET", "/api/jobs").jobs || [];
const edgesNow = () => api("GET", "/api/edges").edges || [];
const hasEdge = (edges, from, to) => edges.some((e) => e.fromJobId === from && e.toJobId === to);
const newId = () => globalThis.crypto.randomUUID();

console.log("t887b — the walk: three adoption verbs filmed at the UI level\n");

/* ---- the world check: the sandbox active, every job completed ---- */
const projs = api("GET", "/api/projects");
const sandbox = (projs.projects || []).find((p) => p.name === SANDBOX_NAME);
ok("V0 the sandbox project exists and is active", !!sandbox && sandbox.active === true, `id=${sandbox?.id}`);
if (!sandbox || !sandbox.active) {
  writeFileSync(join(ROOT, "shots-qa", "t887b-walk.json"), JSON.stringify({ task: "t887b", checks: results, pass, fail }, null, 2) + "\n");
  process.exit(1);
}
const sandboxId = sandbox.id;
const jobs = await jobsOf();
const byType = {};
for (const j of jobs) { if (!byType[j.type] || j.createdAt < byType[j.type].createdAt) byType[j.type] = j; }
/* disambiguate the twins: A = the FIRST class2d (K=50, template), B = the
 * SECOND (K=10); MA = the template's Motion Correction 1, MB = the subset */
const class2ds = jobs.filter((j) => j.type === "class2d").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const mcs = jobs.filter((j) => j.type === "motioncorr").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const A = class2ds[0], B = class2ds[1], MA = mcs[0], MB = mcs[1];
const CTF = jobs.find((j) => j.type === "ctffind");
const IM = jobs.find((j) => j.type === "initialmodel");
const R3 = jobs.find((j) => j.type === "refine3d");
const allDone = jobs.length === 13 && jobs.every((j) => j.status === "completed");
ok("V1 the throwaway world stands (13/13 completed)", allDone, `jobs=${jobs.length} completed=${jobs.filter((j) => j.status === "completed").length}`);
if (!A || !B || !MA || !MB || !allDone) {
  writeFileSync(join(ROOT, "shots-qa", "t887b-walk.json"), JSON.stringify({ task: "t887b", checks: results, pass, fail }, null, 2) + "\n");
  process.exit(1);
}

/* ---- the browser dress ---- */
ab(`open ${BASE}/?t=${Date.now()}`);
let dress = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  dress = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const cards = document.querySelectorAll("[data-card-btn]").length; return JSON.stringify({ dlgs: dgs, cards }); })()');
  if (dress.dlgs === 0 && dress.cards >= 12) break;
}
evalJson('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return 1; })()');
ok("V2 the browser rides the throwaway world", dress && dress.dlgs === 0 && dress.cards >= 12, `cards=${dress?.cards}`);

const findCard = (nameRe, which) => evalJson(`(() => { const all = Array.from(document.querySelectorAll("[data-card-btn]")).filter((x) => ${nameRe}.test(x.textContent || "")); const b = all[${which}] || all[0]; if (!b) return JSON.stringify({ found: false }); const r = b.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; b.dispatchEvent(new PointerEvent("pointerdown", o)); b.dispatchEvent(new PointerEvent("pointerup", o)); b.click(); return JSON.stringify({ found: true, n: all.length }); })()`);

const openCompare = async (nameRe, which, label) => {
  findCard(nameRe, which);
  let insp = null;
  for (let i = 0; i < 15; i++) {
    zzz(1);
    insp = evalJson('(() => JSON.stringify({ n: document.querySelectorAll("[role=dialog]").length }))()');
    if (insp.n >= 1) break;
  }
  let door = null;
  for (let i = 0; i < 20; i++) {
    zzz(1);
    door = evalJson(`(() => { let d = document.querySelector("[aria-label^=\\"${label} A/B\\"]"); if (!d) { const t = Array.from(document.querySelectorAll("[role=dialog] [role=tab]")).find((x) => (x.textContent || "").trim().startsWith("Results")); if (t) t.click(); } d = document.querySelector("[aria-label^=\\"${label} A/B\\"]"); return JSON.stringify({ found: !!d, siblings: d ? (d.getAttribute("aria-label").match(/\\((\\d+)/) || [])[1] : null }); })()`);
    if (door.found) break;
  }
  if (!door.found) return { door };
  evalJson(`(() => { document.querySelector("[aria-label^=\\"${label} A/B\\"]").click(); return 1; })()`);
  let dlg = null;
  for (let i = 0; i < 15; i++) {
    zzz(1);
    dlg = evalJson('(() => { const r = document.querySelector("[role=dialog] [role=region][aria-label*=verdict]"); return JSON.stringify({ open: !!r, text: r ? (r.textContent || "").slice(0, 260) : null }); })()');
    if (dlg.open) break;
  }
  /* the verdict's paired fetch mounts the verbs AFTER the region — wait for
   * the verb row itself (the region alone is up even while loading) */
  let verbs = false;
  for (let i = 0; i < 20; i++) {
    zzz(1);
    verbs = evalJson('(() => JSON.stringify({ v: !!document.querySelector("[data-testid=\\"adopt-downstream\\"]") || !!document.querySelector("[data-testid=\\"adopt-with-select\\"]") || !!document.querySelector("[data-testid=\\"adopt-with-exclude\\"]") }))()').v;
    if (verbs) break;
  }
  return { door, dlg, verbs };
};

const closeAnyCompare = async () => {
  evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }); d.dispatchEvent(k); } return 1; })()');
  await zzz(1.5);
};

const toastOf = async () => {
  for (let i = 0; i < 16; i++) {
    await zzz(0.5);
    const t = evalJson('(() => { const ts = Array.from(document.querySelectorAll("[data-sonner-toast]")); return JSON.stringify({ n: ts.length, titles: ts.map((x) => ((x.querySelector("[data-title]") || x).textContent || "").slice(0, 80)), descs: ts.map((x) => (x.textContent || "").slice(0, 220)) }); })()');
    if (t.n > 0) return t;
  }
  return { n: 0, titles: [], descs: [] };
};

/* ---- FLIGHT 1: the plain adopt (class2d A -> class2d B) ---- */
console.log("\n  FLIGHT 1 — the plain adopt (Continue downstream from run B)");
const f1 = await openCompare(/^2D Classification/, 0, "Class");
ok("F1.1 the Class A/B door found (1 sibling)", f1.door?.found === true && f1.door?.siblings === "1", `siblings=${f1.door?.siblings}`);
ok("F1.2 the compare dialog opened with the verdict region", f1.dlg?.open === true, (f1.dlg?.text || "").slice(0, 90));
const f1verbs = evalJson('(() => { const q = (t) => document.querySelector("[data-testid=\\""+t+"\\"]"); const ad = q("adopt-downstream"); const as = q("adopt-with-select"); const ax = q("adopt-with-exclude"); return JSON.stringify({ adopt: ad ? { disabled: ad.disabled, label: (ad.textContent || "").trim().slice(0, 70) } : null, select: as ? { disabled: as.disabled, label: (as.textContent || "").trim().slice(0, 70) } : null, excludePresent: !!ax }); })()');
ok("F1.3 the plain adopt ENABLED with its move count (2 template wires)", f1verbs.adopt && f1verbs.adopt.disabled === false && /\(2\)/.test(f1verbs.adopt.label || ""), f1verbs.adopt?.label);
ok("F1.4 the select rider PRESENT and ENABLED (K=10 twin: every paired class gained)", f1verbs.select && f1verbs.select.disabled === false, f1verbs.select?.label);
ok("F1.5 the exclude rider ABSENT (the class verdict has no micrographs to exclude)", f1verbs.excludePresent === false);
evalJson('(() => { document.querySelector("[data-testid=\\"adopt-downstream\\"]").click(); return 1; })()');
const f1toast = await toastOf();
ok("F1.6 the adoption receipt spoke (the toast names the re-wire)", f1toast.n > 0 && /re-wired|adopted/i.test(f1toast.descs.join(" ")), (f1toast.titles[0] || "none").slice(0, 60));
let f1edges = [];
for (let i = 0; i < 10; i++) {
  await zzz(1);
  f1edges = edgesNow();
  if (hasEdge(f1edges, B.id, IM.id)) break;
}
ok("F1.7 THE GRAPH TRUTH: both template wires re-parented onto run B", hasEdge(f1edges, B.id, IM.id) && hasEdge(f1edges, B.id, R3.id) && !hasEdge(f1edges, A.id, IM.id) && !hasEdge(f1edges, A.id, R3.id), `B->initialmodel=${hasEdge(f1edges, B.id, IM.id)} B->refine3d=${hasEdge(f1edges, B.id, R3.id)}`);

/* ---- FLIGHT 2: the select rider (mint + wire + adopt) ---- */
console.log("\n  FLIGHT 2 — the select rider (mint the selection, wire both mouths, adopt)");
const c1 = api("POST", "/api/jobs", { type: "select2d", x: A.x + 300, y: A.y + 260, params: {} }).job;
const c1edge = api("POST", "/api/edges", { id: newId(), fromJobId: A.id, toJobId: c1.id, fromPort: "particles", toPort: "particles" });
ok("F2.1 a fresh select2d child wired on run A (the re-wire target)", !!c1?.id && !c1edge.error, `child=${c1?.id?.slice(-6)}`);
await closeAnyCompare();
const f2 = await openCompare(/^2D Classification/, 0, "Class");
const f2verbs = evalJson('(() => { const as = document.querySelector("[data-testid=\\"adopt-with-select\\"]"); return JSON.stringify({ present: !!as, disabled: as ? as.disabled : null, label: as ? (as.textContent || "").trim().slice(0, 80) : null }); })()');
ok("F2.2 the select rider ENABLED on the re-opened dialog (the plan re-derived)", f2verbs.present === true && f2verbs.disabled === false, f2verbs.label);
evalJson('(() => { document.querySelector("[data-testid=\\"adopt-with-select\\"]").click(); return 1; })()');
const f2toast = await toastOf();
ok("F2.3 the adoption receipt spoke (the selection as the new provider)", f2toast.n > 0 && /re-wired|adopted|select/i.test(f2toast.descs.join(" ")), (f2toast.titles[0] || "none").slice(0, 60));
let mint = null;
for (let i = 0; i < 12; i++) {
  await zzz(1);
  const js = await jobsOf();
  mint = js.find((j) => j.type === "select2d" && j.id !== c1.id);
  if (mint) break;
}
ok("F2.4 THE MINT: a 2D Class Selection born with the gained classes baked", !!mint && /^\d+[\d, ]*$/.test(mint.params?.selectedClasses || ""), `id=${mint?.id?.slice(-6)} selectedClasses="${mint?.params?.selectedClasses}"`);
const f2edges = edgesNow();
const mintMouths = f2edges.filter((e) => e.fromJobId === B.id && e.toJobId === mint?.id).length;
ok("F2.5 THE WIRE: run B feeds the mint through BOTH mouths (classes + particles)", mintMouths >= 2, `B->mint edges=${mintMouths}`);
ok("F2.6 THE ADOPT: run A's child re-parented onto the MINT", mint && hasEdge(f2edges, mint.id, c1.id) && !hasEdge(f2edges, A.id, c1.id), `mint->child=${mint ? hasEdge(f2edges, mint.id, c1.id) : false} A->child=${hasEdge(f2edges, A.id, c1.id)}`);

/* ---- FLIGHT 3: the exclude rider (mint + wire + adopt, micrograph dialect) ---- */
console.log("\n  FLIGHT 3 — the exclude rider (mint the filter, wire, adopt)");
await closeAnyCompare();
const f3 = await openCompare(/^Motion Correction/, 0, "Motion");
ok("F3.1 the Motion A/B door found (1 sibling)", f3.door?.found === true, `found=${f3.door?.found}`);
const f3verbs = evalJson('(() => { const ax = document.querySelector("[data-testid=\\"adopt-with-exclude\\"]"); const as = document.querySelector("[data-testid=\\"adopt-with-select\\"]"); return JSON.stringify({ exclude: ax ? { disabled: ax.disabled, label: (ax.textContent || "").trim().slice(0, 80) } : null, selectPresent: !!as }); })()');
ok("F3.2 the exclude rider PRESENT and ENABLED (the subset run grew real regressions)", f3verbs.exclude && f3verbs.exclude.disabled === false, f3verbs.exclude?.label);
ok("F3.3 the select rider ABSENT (the motion verdict has no classes to select)", f3verbs.selectPresent === false);
evalJson('(() => { document.querySelector("[data-testid=\\"adopt-with-exclude\\"]").click(); return 1; })()');
const f3toast = await toastOf();
ok("F3.4 the adoption receipt spoke (the filter as the new provider)", f3toast.n > 0 && /re-wired|adopted|exclud/i.test(f3toast.descs.join(" ")), (f3toast.titles[0] || "none").slice(0, 60));
let filter = null;
for (let i = 0; i < 12; i++) {
  await zzz(1);
  const js = await jobsOf();
  filter = js.find((j) => j.type === "excludemg" && j.id !== jobs.find((x) => x.type === "excludemg")?.id);
  if (filter) break;
}
ok("F3.5 THE MINT: an Exclude Micrographs filter born with the regressions baked", !!filter && /mic_\d+/.test(filter.params?.excludeNames || ""), `id=${filter?.id?.slice(-6)} excludeNames="${(filter?.params?.excludeNames || "").slice(0, 60)}"`);
const f3edges = edgesNow();
ok("F3.6 THE WIRE + THE ADOPT: run B feeds the filter; CTF now consumes the FILTER", filter && hasEdge(f3edges, MB.id, filter.id) && hasEdge(f3edges, filter.id, CTF.id) && !hasEdge(f3edges, MA.id, CTF.id), `B->filter=${filter ? hasEdge(f3edges, MB.id, filter.id) : false} filter->ctf=${filter ? hasEdge(f3edges, filter.id, CTF.id) : false} A->ctf=${hasEdge(f3edges, MA.id, CTF.id)}`);

/* ---- the honest absence: run A spent, the door says so ---- */
await closeAnyCompare();
const f4 = await openCompare(/^2D Classification/, 0, "Class");
const f4verbs = evalJson('(() => { const ad = document.querySelector("[data-testid=\\"adopt-downstream\\"]"); return JSON.stringify({ disabled: ad ? ad.disabled : null, title: ad ? ad.getAttribute("title") : null }); })()');
ok("F4 the spent run speaks the honest disabled state (no downstream left)", f4verbs.disabled === true && /no downstream/i.test(f4verbs.title || ""), f4verbs.title?.slice(0, 70));
await closeAnyCompare();

/* ---- the teardown: the spent world leaves no residue ---- */
console.log("\n  Teardown — the spent world leaves no residue");
const del = api("DELETE", `/api/projects/${sandboxId}`);
ok("T1 the sandbox deleted (live runs stopped, jobs and edges removed)", !del.error && !del.raw?.includes("error"), del.raw ? String(del.raw).slice(0, 60) : "ok");
const projsT = api("GET", "/api/projects");
const tProj = (projsT.projects || []).find((p) => /tutorial/i.test(p.name || ""));
const sw = tProj ? api("POST", "/api/projects/switch", { id: tProj.id }) : { error: "no tutorial project" };
ok("T2 the tutorial project active again", !sw.error && !!tProj, tProj?.name || "missing");
const demoAfter = await jobsOf();
ok("T3 the demo world untouched: 15/15 completed", demoAfter.length === 15 && demoAfter.every((j) => j.status === "completed"), `jobs=${demoAfter.length}`);
ab(`open ${BASE}/?t=${Date.now()}`);
let t4 = null;
for (let i = 0; i < 60; i++) {
  zzz(1);
  t4 = evalJson('(() => { const dgs = document.querySelectorAll("[role=dialog]").length; const cards = document.querySelectorAll("[data-card-btn]").length; return JSON.stringify({ dlgs: dgs, cards }); })()');
  if (t4.dlgs === 0 && t4.cards >= 14) break;
}
evalJson('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return 1; })()');
ok("T4 the browser rides the demo world again (15 cards, bare)", t4 && t4.dlgs === 0 && t4.cards >= 14, `cards=${t4?.cards}`);

console.log(`\nWALK t887b: ${pass}/${pass + fail} ${fail === 0 ? "green" : `(${fail} red)`}`);

const receipt = {
  task: "t887b",
  window: "cron 2026-11-02 17:05:40 +08:00 (trace 1a07549302235a99-cron-agent-loop-202611021705)",
  purpose: "the three adoption verbs filmed at the UI level on the throwaway world (built manually after the OOM split the original script): the plain adopt, the select rider, the exclude rider — each with the receipt toast and the graph truth; the honest absences; the spent world deleted",
  sandboxId, worldIds: { A: A.id, B: B.id, MA: MA.id, MB: MB.id },
  checks: results, pass, fail,
};
writeFileSync(join(ROOT, "shots-qa", "t887b-walk.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("receipt: shots-qa/t887b-walk.json");
process.exit(fail === 0 ? 0 : 1);
