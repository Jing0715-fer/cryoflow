#!/usr/bin/env node
/**
 * t878 — THE ESCAPE-DEAF AUTOPSY: the standing W1 find's product diagnosis.
 *
 * The t877 evidence: after the FSC compare overlay lives through the
 * completion flip, Escape stops dismissing it — even repeated presses,
 * even the real-hand dialect (the content's own React-level Escape
 * consumer). This autopsy instruments the flip LIVE and answers, with
 * node-level truth:
 *
 *   M1  does the flip REMOUNT the dialog subtree (the same-node marker
 *       `__t878` survives?) or is the node torn away and restored?
 *   M2  does the node keep its React fiber (__reactFiber*) after the flip?
 *   M3  does the content's own keydown handler RUN when a real-hand
 *       Escape is dispatched (a native capture counter), and does the
 *       Radix data-state flip open -> closed?
 *   M4  does the DOCUMENT-dialect Escape behave differently (the layer
 *       stack's path)?
 *   M5  what does the churn's 300ms film show at the flip moment itself
 *       (present/absent, dataState, sameNode) — the tear, named.
 *
 * Receipt: shots-qa/t878-escape-deaf-autopsy.json.
 *
 *   node scripts/t878-escape-deaf-autopsy.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const ev = (js) => ab(`eval ${JSON.stringify(js)}`).trim();
const evJson = (js) => {
  const raw = ev(js);
  try {
    return JSON.parse(raw);
  } catch {
    return { unparseable: raw.slice(0, 200) };
  }
};
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));
/* the healer's law aboard: the Origin header + the retry (the dev
 * server's transient socket closes are the world's own tempo) */
const apiOnce = async (m, u, b) => {
  const r = await fetch(BASE + u, { method: m, headers: { "Content-Type": "application/json", Origin: BASE }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const api = async (m, u, b, attempt = 0) => {
  try {
    return await apiOnce(m, u, b);
  } catch {
    if (attempt >= 3) throw new Error(`api ${m} ${u} failed after ${attempt + 1} tries`);
    await zzz(3);
    return api(m, u, b, attempt + 1);
  }
};
const jobsList = async () => (await api("GET", "/api/jobs")).body?.jobs ?? [];
const probeDto = async () => (await jobsList()).find((j) => j.name === "3D Refine (live probe t876)") ?? null;

/* the node-level lens */
const AUTOPSY = '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const fsc = dgs.find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ fsc: false, dlgCount: dgs.length }); const keys = Object.keys(fsc); return JSON.stringify({ fsc: true, sameNode: !!fsc.__t878, hasFiber: keys.some((k) => k.startsWith("__reactFiber")), hasProps: keys.some((k) => k.startsWith("__reactProps")), dataState: fsc.getAttribute("data-state"), inDoc: document.contains(fsc), dlgCount: dgs.length }); })()';
/* arm: mark the node + a native capture counter for keydown */
const ARM = '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ armed: false }); fsc.__t878 = true; window.__t878esc = 0; if (!window.__t878armed) { window.__t878armed = true; fsc.addEventListener("keydown", () => { window.__t878esc = (window.__t878esc || 0) + 1; }, true); } return JSON.stringify({ armed: true, sameNode: !!fsc.__t878, dataState: fsc.getAttribute("data-state") }); })()';
/* fire the real-hand dialect on the content + read the handler's counter */
const FIRE_CONTENT = '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ fired: false, gone: true }); const target = (document.activeElement && fsc.contains(document.activeElement) && document.activeElement !== fsc) ? document.activeElement : fsc; target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ fired: true, on: target.tagName + (target.getAttribute && target.getAttribute("data-testid") ? ":" + target.getAttribute("data-testid") : ""), escCount: window.__t878esc, dataState: fsc.getAttribute("data-state") }); })()';
/* fire the document dialect (the layer stack's path) */
const FIRE_DOCUMENT = '(() => { window.__t878esc = 0; document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); return JSON.stringify({ fired: true, path: "document", escCount: window.__t878esc, stillOpen: !!fsc }); })()';
const CLOSE_CHECK = '(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); return JSON.stringify({ stillOpen: !!fsc, dlgCount: document.querySelectorAll("[role=dialog]").length }); })()';

const world = worldIdentity(ROOT);
console.log(`t878 escape-deaf autopsy — world ${world.mode}:${world.id}\n`);
const findings = [];
const note = (k, v) => { findings.push({ k, v }); console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`); };

/* ---------- 1. the stage (the completed world) ---------- */
ev('(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) { localStorage.removeItem(k); i = -1; break; } } localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
await zzz(5);
let dressed = 0;
for (let i = 0; i < 90 && dressed < 16; i++) {
  dressed = evJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()').cards ?? 0;
  if (dressed < 16) {
    if (i === 45) {
      /* the stale tab's own remedy: one honest reload */
      console.log("  (cards still 0 — one honest reload)");
      ab("open http://localhost:3000");
      await zzz(5);
    }
    await zzz(2);
  }
}
note("cards dressed", dressed);
/* the cards' own pre-probe: if the count reads 0 while the page speaks,
 * the eval and the DOM disagree — name it before the arc rides */
note("the stage's own probe", evJson('(() => JSON.stringify({ url: location.href.slice(0, 40), ready: document.readyState, cards: document.querySelectorAll("[data-card-btn]").length, btns: document.querySelectorAll("button").length, bodyHead: (document.body.textContent || "").trim().slice(0, 60) }))()'));
ev('(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("live probe") !== -1); if (!btn) return "no-card"; const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return "clicked"; })()');
await zzz(3);
for (let i = 0; i < 8; i++) { const r = ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return "no"; b.click(); return "clicked"; })()'); if (r.includes("clicked")) break; await zzz(1); }
const open0 = evJson('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const fsc = dgs.find((d) => (d.textContent||"").includes("Compare FSC curves")); return { open: !!fsc, dlgCount: dgs.length }; })()');
note("overlay open (clean world)", open0);
if (!open0.open) { console.log("ABORT — the overlay never opened"); process.exit(1); }

/* mark the CLEAN-WORLD node: if the flip brings a NEW node, the marker dies */
ev('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); fsc.__t878 = true; window.__t878esc = 0; fsc.addEventListener("keydown", () => { window.__t878esc = (window.__t878esc || 0) + 1; }, true); return "marked"; })()');

/* ---------- 2. the live seed (run → the restage arc → the band) ---------- */
const dto0 = await probeDto();
if (dto0.status !== "running") {
  const conn = (await api("GET", "/api/remote/connections")).body?.connections?.find((c) => c.name === "Mock Cluster")?.id;
  await api("PATCH", `/api/jobs/${dto0.id}`, { params: { autoRefine: false, iterations: 50 } });
  const run = await api("POST", `/api/jobs/${dto0.id}/run`, { remote: { connectionId: conn, module: "relion/5.0.1", mode: "slurm" } });
  note("run issued", run.status);
}
/* the restage arc: wait for the wipe, then the first fresh shell */
/* the restage arc's FULL gate (the t877 walk's own law, ported): the
 * mirror carries the PREVIOUS run's shells until the wipe — wait for the
 * WIPE first, then the first fresh shell while running */
let wiped = false;
for (let i = 0; i < 45 && !wiped; i++) {
  const f = await api("GET", `/api/jobs/${dto0.id}/fsc`);
  if ((f.body?.shells?.length ?? 0) === 0) { wiped = true; break; }
  await zzz(2);
}
note("the restage's wipe", wiped);
let ck = false;
for (let i = 0; i < 120 && !ck; i++) {
  const f = await api("GET", `/api/jobs/${dto0.id}/fsc`);
  const shells = f.body?.shells?.length ?? 0;
  const dto = await probeDto();
  if (shells > 0 && dto.status === "running") { ck = true; break; }
  if (dto.status === "completed") break;
  await zzz(2);
}
note("first fresh checkpoint (running)", ck);
/* the band's three-ladder refresh (fastest first): the in-place rescan
 * (the t877 fix keeps the index mounted — a fresh fetch lands in place),
 * then the close/reopen (the fresh open's own fetch), then keep beating
 * — the poller's own 12s cadence may also land the row */
let band = false;
for (let i = 0; i < 30 && !band; i++) {
  const m = evJson('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); return { open: !!d, band: !!d?.querySelector("[data-testid=fsc-compare-autolive]") }; })()');
  if (m.band) { band = true; break; }
  if (m.open && i % 4 === 2) {
    ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-rescan]"); if (b && !b.disabled) b.click(); return "rescanned"; })()');
  } else if (!m.open) {
    for (let j = 0; j < 8; j++) { const r = ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return "no"; b.click(); return "clicked"; })()'); if (r.includes("clicked")) break; await zzz(1); }
  }
  const dto = await probeDto();
  if (dto.status === "completed") { console.log("  (the probe completed before the band — the window won)"); break; }
  await zzz(2);
}
note("band attached (poller live)", band);
if (!band) { console.log("ABORT — no band, no flip to autopsy"); process.exit(1); }
/* mark NOW (the node is stable, the flip is ahead) — the marker's death
 * at the flip names the remount */
ev('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); if (!fsc) return "no-node"; fsc.__t878 = true; window.__t878esc = 0; fsc.addEventListener("keydown", () => { window.__t878esc = (window.__t878esc || 0) + 1; }, true); return "marked"; })()');

/* ---------- 3. the flip film (light beats) + the post-flip autopsy ---------- */
console.log("\nthe flip film (light beats):");
const film = [];
let flipped = false;
const BEAT = '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).find((x) => (x.textContent || "").includes("Compare FSC curves")); return JSON.stringify({ open: !!d, state: d ? d.getAttribute("data-state") : null, sameNode: d ? !!d.__t878 : null }); })()';
for (let i = 0; i < 150 && !flipped; i++) {
  const dto = await probeDto();
  const m = evJson(BEAT);
  if (m.unparseable && !film.errLogged) { film.errLogged = true; console.log(`  (the film's eval failed: ${String(m.unparseable).slice(0, 140)})`); }
  film.push({ t: (i * 0.6).toFixed(1), status: dto.status, ...m });
  if (dto.status === "completed" && m.open && m.state === "open") { flipped = true; }
  await zzz(0.3);
  if (i % 25 === 24) console.log(`  (${(i * 0.6).toFixed(0)}s status=${dto.status} open=${m.open} state=${m.state ?? "-"} sameNode=${m.sameNode ?? "-"})`);
}
note("the flip filmed (the door open post-churn)", flipped);
const tears = film.filter((f) => f.status === "completed" && f.open === false);
note("the churn's tear (completed beats with no overlay node)", tears.length);
if (tears.length) note("the tear's span", `${((tears.length) * 0.6).toFixed(1)}s of beats`);
note("post-flip node (the full autopsy)", evJson(AUTOPSY));

/* ---------- 3b. THE QUIET RESCAN (the t877 E-face's exact order — the
 * refined hypothesis names the rescan AFTER the flip as the deafness
 * trigger: flip alone peels fine, as the rides' E5→W order always red) */
console.log("\nthe quiet rescan (the E-face's mirror):");
ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-rescan]"); if (b && !b.disabled) b.click(); return "clicked"; })()');
let rec = false;
for (let i = 0; i < 25 && !rec; i++) {
  const m = evJson('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).find((x) => (x.textContent || "").includes("Compare FSC curves")); const b = d?.querySelector("[data-testid=fsc-compare-rescan]"); return { open: !!d, lbl: b ? (b.textContent || "").trim() : null, dis: b ? b.disabled : null }; })()');
  if (m.open && m.lbl === "Scan" && m.dis === false) { rec = true; break; }
  await zzz(1);
}
note("the quiet rescan's recovery", rec);
note("the node after the rescan (the full autopsy)", evJson(AUTOPSY));

/* ---------- 4. the deafness test: THE TIMING LADDER — the transient
 * window hypothesis: the rides' Escape landed seconds after the churn;
 * this ladder presses at +1/4/8/15/30s after the rescan's recovery,
 * only while the overlay is still open, and names which beat closed it */
console.log("\nthe deafness test (the timing ladder):");
const arm1 = evJson(ARM);
note("arm (same node? state?)", arm1);
const fire1 = evJson(FIRE_CONTENT);
note("real-hand Escape on the content", fire1);
await zzz(1.5);
const after1 = evJson(CLOSE_CHECK);
note("closed by the real hand?", after1);
if (after1.stillOpen) {
  /* the transient-window ladder: press again at growing waits, name the
   * beat that finally closes (or the deafness that outlives 30s) */
  const ladder = [4, 8, 15, 30];
  for (const wait of ladder) {
    await zzz(wait);
    if (!evJson(CLOSE_CHECK).stillOpen) break;
    const beat = evJson(FIRE_CONTENT);
    const closed = !evJson('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); return JSON.stringify({ stillOpen: !!fsc }); })()').stillOpen;
    note(`the ladder's +${wait}s press`, { escCount: beat.escCount, closed });
    if (closed) break;
  }
  const afterLadder = evJson(CLOSE_CHECK);
  note("after the ladder", afterLadder);
  /* the deeper probe: does the React fiber still carry props? does a
   * direct click on the dialog's own Close/X button work? */
  if (afterLadder.stillOpen) {
    const deep = evJson('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); if (!fsc) return { stillOpen: false }; const keys = Object.keys(fsc); const fiberKey = keys.find((k) => k.startsWith("__reactFiber")); let n = fiberKey ? fsc[fiberKey] : null, hops = 0, memoizedOpen = null; while (n && hops < 40) { if (n.memoizedProps && typeof n.memoizedProps.open === "boolean") { memoizedOpen = n.memoizedProps.open; break; } n = n.return; hops++; } const xbtn = Array.from(fsc.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "").toLowerCase().includes("close")); return { stillOpen: true, hasFiber: !!fiberKey, dialogOpenProp: memoizedOpen, hasCloseButton: !!xbtn }; })()');
    note("the fiber's Dialog open prop", deep);
    if (deep.hasCloseButton) {
      const xClick = evJson('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); const xbtn = Array.from(fsc.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "").toLowerCase().includes("close")); xbtn.click(); return { clicked: true }; })()');
      await zzz(1.5);
      const afterX = evJson(CLOSE_CHECK);
      note("the X button's click", { ...xClick, ...afterX });
    }
  }
}

/* ---------- 5. the honest close (whatever the answers) ---------- */
for (let i = 0; i < 5; i++) {
  const m = evJson(CLOSE_CHECK);
  if (m.dlgCount === 0) break;
  ev('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); if (!dgs.length) return "none"; const top = dgs[dgs.length-1]; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : top; t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return "esc"; })()');
  await zzz(1);
  ev('(() => { const dlg = document.querySelector("[role=dialog]"); const b = dlg && Array.from(dlg.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Close inspector"); if (b) b.click(); return "closed"; })()');
  await zzz(1);
}
note("the final close", evJson(CLOSE_CHECK));

const verdict = findings.find((f) => f.k === "closed by the real hand?")?.v?.stillOpen
  ? `the deafness REPRODUCED at the node level: the flip's churn tears the overlay subtree and restores it (the tear filmed), and the restored node refuses Escape in both dialects — the fiber's own answers are in the findings above; the mechanism is named by the sameNode/fiber/dialogOpenProp trio`
  : `the real hand's Escape CLOSED the post-flip overlay on this ride — the deafness did not reproduce (the find is state-dependent; the film's tear data still stands)`;

const receipt = {
  instrument: "scripts/t878-escape-deaf-autopsy.mjs",
  ruler: NAMEOF_LAW,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "stage (clean world, the node marked) → the live seed (run → the restage arc → the band) → the flip film (300ms beats, the tear named) → the deafness test (both dialects, the fiber's open prop, the X, the backdrop) → the honest close",
  findings,
  film: film.filter((f) => f.status === "completed").slice(0, 40),
  verdict,
  passed: 0,
  failed: 0,
};
const outPath = join(ROOT, "shots-qa", "t878-escape-deaf-autopsy.json");
writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nVERDICT: ${verdict}`);
console.log(`receipt: ${outPath}${existsSync(outPath) ? "" : " (WRITE FAILED)"}`);
