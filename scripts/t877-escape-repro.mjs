#!/usr/bin/env node
/* t877 escape repro — characterize the W1 finding: does one Escape peel
 * the overlay after the film lived through the completion flip? Does a
 * SECOND Escape recover? Where is focus? */
import { execSync } from "node:child_process";
const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const ev = (js) => ab(`eval ${JSON.stringify(js)}`).trim();
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));
const api = async (m, u, b) => {
  const r = await fetch(BASE + u, { method: m, headers: { "Content-Type": "application/json", Origin: BASE }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const probeDto = async () => (await api("GET", "/api/jobs")).body?.jobs?.find((j) => j.name === "3D Refine (live probe t876)") ?? null;

// 1. stage: clean, open, inspector, overlay (the completed world)
ev('(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) { localStorage.removeItem(k); i = -1; break; } } localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
await zzz(5);
// the full-dress gate: every job's card must be present before the click
let dressed = 0;
for (let i = 0; i < 30 && dressed < 16; i++) {
  dressed = JSON.parse(ev('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()')).cards;
  if (dressed < 16) await zzz(2);
}
console.log("cards dressed:", dressed);
const probeCard = ev('(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("live probe") !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()');
console.log("probe card:", probeCard.slice(0, 60));
await zzz(3);
for (let i = 0; i < 8; i++) { const r = ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return "no"; b.click(); return "clicked"; })()'); if (r.includes("clicked")) break; await zzz(1); }
const open0 = ev('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); return JSON.stringify({ dlgs: dgs.length, fsc: dgs.some((d) => (d.textContent||"").includes("Compare FSC curves")) }); })()');
console.log("overlay open:", open0);

// 2. re-issue the run, rescan to refresh the index, catch the band
const dto0 = await probeDto();
if (dto0.status !== "running") {
  const conn = (await api("GET", "/api/remote/connections")).body?.connections?.find((c) => c.name === "Mock Cluster")?.id;
  await api("PATCH", `/api/jobs/${dto0.id}`, { params: { autoRefine: false, iterations: 50 } });
  await api("POST", `/api/jobs/${dto0.id}/run`, { remote: { connectionId: conn, module: "relion/5.0.1", mode: "slurm" } });
}
// the restage law's gate: wait for the first live checkpoint BEFORE the
// rescan — the index only carries the running row once its FSC file lands
let ck = false;
for (let i = 0; i < 90; i++) {
  const f = await api("GET", `/api/jobs/${dto0.id}/fsc`);
  if ((f.body?.shells?.length ?? 0) > 0) { ck = true; break; }
  const dto = await probeDto();
  if (dto.status === "completed") break;
  await zzz(2);
}
console.log("first checkpoint:", ck);
// manual rescan to bring the running row into the index
ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-rescan]"); b.click(); return "rescanned"; })()');
await zzz(3);
// wait for the band (the running pick)
let band = false;
for (let i = 0; i < 40; i++) {
  const m = JSON.parse(ev('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); return JSON.stringify({ band: !!d?.querySelector("[data-testid=fsc-compare-autolive]"), open: !!d }); })()'));
  if (m.band) { band = true; break; }
  if (i % 3 === 2 && m.open) {
    // the user's own refresh reflex — the index's statcache needs beats
    ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-rescan]"); if (b && !b.disabled) b.click(); return "rescanned"; })()');
  }
  await zzz(2);
  const dto2 = await probeDto();
  if (dto2.status === "completed") { console.log("  (the probe completed before the band attached — the window won)"); break; }
  if (i === 20) console.log("  (still waiting for the band)");
}
console.log("band attached:", band);
if (!band) { console.log("REPRO ABORTED — no band"); process.exit(1); }

// 3. wait for the completion flip (the door open throughout)
let flipped = false;
for (let i = 0; i < 150; i++) {
  const dto = await probeDto();
  const m = JSON.parse(ev('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); return JSON.stringify({ band: !!d?.querySelector("[data-testid=fsc-compare-autolive]"), open: !!d }); })()'));
  if (dto.status === "completed" && m.open && !m.band) { flipped = true; break; }
  if (dto.status === "completed" && !m.open) { console.log("  (the overlay vanished at the flip — the churn, waiting for it to settle)"); }
  await zzz(2);
}
console.log("flip filmed, door open:", flipped);

// 4. THE TEST: one Escape, then measure; a second Escape if needed
const focus = () => ev('(() => { const a = document.activeElement; return JSON.stringify({ tag: a ? a.tagName : null, testid: a?.getAttribute?.("data-testid") ?? null, inDlg: a ? !!a.closest("[role=dialog]") : false }); })()');
console.log("focus before Escape:", focus());
ev('(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "esc1"; })()');
await zzz(2);
const after1 = JSON.parse(ev('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); return JSON.stringify({ dlgs: dgs.length, fsc: dgs.some((d) => (d.textContent||"").includes("Compare FSC curves")), heads: dgs.map((d) => (d.querySelector("[data-slot=dialog-title]")?.textContent || "").slice(0, 30) ) }); })()'));
console.log("after Escape #1:", JSON.stringify(after1), "focus:", focus());
if (after1.fsc) {
  ev('(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "esc2"; })()');
  await zzz(2);
  const after2 = JSON.parse(ev('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); return JSON.stringify({ dlgs: dgs.length, fsc: dgs.some((d) => (d.textContent||"").includes("Compare FSC curves")) }); })()'));
  console.log("after Escape #2:", JSON.stringify(after2), "focus:", focus());
  // a click into the overlay then Escape #3
  ev('(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent||"").includes("Compare FSC curves")); const b = d?.querySelector("[data-testid=fsc-compare-rescan]"); if (b) b.focus(); return "focused"; })()');
  ev('(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "esc3"; })()');
  await zzz(2);
  const after3 = JSON.parse(ev('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); return JSON.stringify({ dlgs: dgs.length, fsc: dgs.some((d) => (d.textContent||"").includes("Compare FSC curves")) }); })()'));
  console.log("after Escape #3 (focus forced into the overlay):", JSON.stringify(after3));
}
// cleanup: close everything
for (let i = 0; i < 4; i++) { const m = JSON.parse(ev('(() => JSON.stringify({ dlgs: document.querySelectorAll("[role=dialog]").length }))()')); if (m.dlgs === 0) break; ev('(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "esc"; })()'); await zzz(1); const insp = ev('(() => { const dlg = document.querySelector("[role=dialog]"); const b = dlg && Array.from(dlg.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Close inspector"); if (b) { b.click(); return "closed"; } return "none"; })()'); await zzz(1); }
console.log("cleaned");
