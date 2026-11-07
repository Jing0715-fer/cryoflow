#!/usr/bin/env node
/* t882 — the keydown-reach probe: the WHY under the split, judged by the
 * REAL HAND (the t877 law: the real hand's Escape is the dialect that
 * cannot lie). Re-landed on the post-rollback world (the t871-881 epoch's
 * artifacts were lost in the sandbox recycle; this probe's findings,
 * source reads, and verdict logic are re-landed from the window's own
 * record).
 *
 * The prior epoch concluded "the split is by EVENT TYPE through portals"
 * (portal input/onChange works, portal keydown does not) — but that ride's
 * instruments were voided in part (the frozen-props law killed the synth
 * metric) and the surviving leg (cmdk's ArrowDown "no-mutation" read) was
 * a SYNTHETIC keydown whose same-eval read fired BEFORE React's discrete
 * flush landed. The source read flags two truths the epoch missed:
 *   (1) React 19's resolveUpdatePriority() reads window.event — a setState
 *       from a NATIVE listener DURING a real keydown gets DISCRETE
 *       priority and flushes synchronously; the epoch's "default-lane
 *       late close" theory is wrong at the source level.
 *   (2) cmdk's root handler opens with `if (!(t.defaultPrevented || ...))
 *       switch (t.key)` — any earlier preventDefault eats a synthetic
 *       event; the app's window-capture ladder is exactly such an ear.
 *
 * Four faces, each settling one question:
 *
 *   R — the topology read: the React root container identity (the fiber
 *       walk to the HostRoot), the delegation markers on document/html/body.
 *       Source truth (read this window, vendored react-dom 19.3.0-canary):
 *       nonDelegatedEvents = beforetoggle/cancel/close/invalid/load/
 *       scroll/scrollend/toggle + media — NO keydown, NO input; the
 *       HostPortal mount (completeWork case 4) attaches ALL delegated
 *       events at the portal container; Next vendors react-dom and
 *       hydrates the DOCUMENT as the root container.
 *
 *   K — the palette's REAL HAND (the product-level judge): a REAL
 *       ArrowDown (agent-browser press — trusted, no dispatch dialect)
 *       that MOVES the palette's selection proves React's keydown
 *       dispatch reaches portal content; the "portal keydown is dead"
 *       claim dies with it. A real Escape closes via Radix's
 *       document-capture listener (use-escape-keydown, capture:true).
 *
 *   P2 — the synthetic autopsy: the same ArrowDown re-fired SYNTHETICALLY
 *       with witnesses (document capture + document bubble counters, the
 *       post-dispatch defaultPrevented read, a post-eval selection read).
 *       Names the prior epoch's artifact if K moved: the same-eval read
 *       was one microtask too early (the discrete flush lands after the
 *       dispatchEvent call returns).
 *
 *   F1 — the FSC dialog's clean anatomy (the consumer's alive-or-dead
 *       check, no frozen-props trap): three native witnesses (document
 *       capture; body bubble WITH a defaultPrevented read — the
 *       consumer's preventDefault rides the native event, so the body
 *       witness's fingerprint is ALIVE/DEAD; document bubble) + an
 *       EVENT-DRIVEN rAF recorder (self-arming on the first Escape, 120
 *       frames ≈ 2s of stamps) reading the PINNED content node (the
 *       text-finder's first match can be the inspector beneath — every
 *       dialog is identified by its dialog-title at every mark). The
 *       matrix:
 *         bodyDefPrev === true → the React dispatch at body ran a
 *           preventDefault-er → the consumer RAN (its preventDefault +
 *           stopPropagation are its purpose: the app-shell's window
 *           Escape ladder stands down, one layer peels).
 *         bodyDefPrev === false with docBub === 0 → someone stopped
 *           propagation without preventDefault — name the actor before
 *           any verdict.
 *         docBub === 1 → nothing stopped the event at/below body → the
 *           consumer is dead code (Radix's document-capture is the only
 *           closer) — the prior epoch's claim stands on this leg.
 *       The rAF marks give the TRUE close anatomy (the pinned node's
 *       data-state flip vs its unmount — the duration-200 exit animation
 *       explains a node that outlives the state flip; the STATE flip is
 *       the close's truth, the node unmount is the ANIMATION's cadence).
 *
 * Receipt: shots-qa/t882-keydown-reach.json.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const ev = (js) => ab(`eval ${JSON.stringify(js)}`).trim();
/* the DOUBLE-UNWRAP (the t880 law): the CLI prints a string result QUOTED */
const evJson = (js) => {
  const raw = ev(js);
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    return { unparseable: raw.slice(0, 200) };
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));

const world = worldIdentity(ROOT);
console.log(`t882 keydown-reach probe — world ${world.mode}:${world.id}\n`);
const findings = [];
const note = (k, v) => { findings.push({ k, v }); console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`); };
let pass = 0, fail = 0;
const ok = (label, cond, detail) => { if (cond) { pass++; console.log(`  ✓ ${label}  ${detail ?? ""}`); } else { fail++; console.log(`  ✗ ${label}  ${detail ?? ""}`); } };

/* ---------------- R — the topology read ---------------- */
console.log("R — the topology read (fresh load)");
ab(`open ${BASE}`);
await zzz(6);
let dressed = 0;
for (let i = 0; i < 60 && dressed < 16; i++) {
  dressed = evJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()').cards ?? 0;
  if (dressed < 16) await zzz(2);
}
note("R cards dressed", dressed);
const topo = evJson(`(() => { const probe = (el) => Object.keys(el).filter((k) => k.indexOf("_reactListening") === 0).length > 0; const out = { docMarker: probe(document), htmlMarker: probe(document.documentElement), bodyMarker: probe(document.body) }; const stage = document.querySelector("[data-card-btn]"); if (stage) { const fk = Object.keys(stage).find((k) => k.indexOf("__reactFiber") === 0); let n = fk ? stage[fk] : null, hops = 0; while (n && hops < 200) { if (n.tag === 3) { const c = n.stateNode.containerInfo; out.rootContainer = c === document ? "DOCUMENT(nodeType9)" : c.nodeName + (c.id ? "#" + c.id : ""); out.rootHops = hops; break; } n = n.return; hops++; } } return JSON.stringify(out); })()`);
note("R topology", topo);
ok("R the root container is the DOCUMENT (Next App Router hydrates the document)", topo.rootContainer === "DOCUMENT(nodeType9)", `${topo.rootContainer ?? "?"} @ ${topo.rootHops ?? "?"} hops`);
ok("R the delegation markers: document + body (the portal mount), not html", topo.docMarker === true && topo.bodyMarker === true && topo.htmlMarker === false, `doc=${topo.docMarker} body=${topo.bodyMarker} html=${topo.htmlMarker}`);

/* ---------------- K — the palette's REAL HAND ---------------- */
console.log("K — the palette's real hand (the product-level judge)");
ev('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "sent"; })()');
await zzz(2);
const palRead = `(() => { const root = document.querySelector("[cmdk-root]"); const inp = document.querySelector("[cmdk-input]"); const sel = document.querySelector('[cmdk-item][aria-selected="true"]'); return JSON.stringify({ open: !!root, items: document.querySelectorAll("[cmdk-item]").length, sel: sel ? sel.getAttribute("data-value") : null, inputFocused: document.activeElement === inp }); })()`;
const pal1 = evJson(palRead);
note("K palette opened", pal1);
ok("K palette is a portal dialog with items", pal1.open === true && pal1.items > 0, `items=${pal1.items ?? "?"}`);
let kMoved = false;
if (pal1.open) {
  if (!pal1.inputFocused) { ev('(() => { const i = document.querySelector("[cmdk-input]"); if (i) i.focus(); return "focused"; })()'); await zzz(1); }
  ab("press ArrowDown");
  await zzz(1);
  const pal2 = evJson(palRead);
  note("K after REAL ArrowDown", pal2);
  kMoved = pal1.sel !== pal2.sel;
  ok("K REAL ArrowDown moved the palette selection (portal keydown dispatch REACHES)", kMoved, `before=${(pal1.sel ?? "").slice(0, 30)} after=${(pal2.sel ?? "").slice(0, 30)}`);
  ab("press Escape");
  await zzz(1);
  const pal3 = evJson('(() => JSON.stringify({ open: !!document.querySelector("[cmdk-root]"), dlgN: document.querySelectorAll("[role=dialog]").length }))()');
  note("K after REAL Escape", pal3);
  ok("K REAL Escape closed the palette", pal3.open === false, `dlgN=${pal3.dlgN ?? "?"}`);
}

/* ---------------- P2 — the synthetic autopsy ---------------- */
console.log("P2 — the synthetic ArrowDown autopsy (the prior epoch's artifact hunt)");
ev('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "sent"; })()');
await zzz(2);
const p2Arm = evJson(`(() => { const inp = document.querySelector("[cmdk-input]"); if (!inp) return JSON.stringify({ armed: false, gone: true }); window.__p882 = { cap: 0, capKey: null, bub: 0, defPrev: null }; window.__p882cap = (e) => { window.__p882.cap++; window.__p882.capKey = e.key; }; window.__p882bub = (e) => { window.__p882.bub++; window.__p882.defPrev = e.defaultPrevented; }; document.addEventListener("keydown", window.__p882cap, true); document.addEventListener("keydown", window.__p882bub, false); if (document.activeElement !== inp) inp.focus(); const sel = document.querySelector('[cmdk-item][aria-selected="true"]'); return JSON.stringify({ armed: true, selBefore: sel ? sel.getAttribute("data-value") : null, inputFocused: document.activeElement === inp }); })()`);
note("P2 armed", p2Arm);
if (p2Arm.armed) {
  const p2Fire = evJson(`(() => { const inp = document.querySelector("[cmdk-input]"); if (!inp) return JSON.stringify({ sent: false }); inp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); const sel = document.querySelector('[cmdk-item][aria-selected="true"]'); return JSON.stringify({ sent: true, selSameEval: sel ? sel.getAttribute("data-value") : null, witness: window.__p882 }); })()`);
  note("P2 synthetic ArrowDown fired (same-eval read)", p2Fire);
  const p2Post = evJson(`(() => { const sel = document.querySelector('[cmdk-item][aria-selected="true"]'); return JSON.stringify({ selPostEval: sel ? sel.getAttribute("data-value") : null, witness: window.__p882 }); })()`);
  note("P2 post-eval read", p2Post);
  const movedSameEval = p2Fire.selSameEval !== p2Arm.selBefore;
  const movedPostEval = p2Post.selPostEval !== p2Arm.selBefore;
  ok("P2 the same-eval read (the prior epoch's early read reproduced?)", true, `same-eval moved=${movedSameEval} post-eval moved=${movedPostEval} defPrev=${p2Fire.witness?.defPrev ?? "?"} (cmdk's own handler preventDefaults — the guard-artifact theory's proof)`);
  ab("press Escape");
  await zzz(1);
  ev('(() => { document.removeEventListener("keydown", window.__p882cap, true); document.removeEventListener("keydown", window.__p882bub, false); return "cleaned"; })()');
}

/* ---------------- F1 — the FSC dialog's clean anatomy ---------------- */
console.log("F1 — the FSC dialog's clean anatomy (the consumer's alive-or-dead check)");
const readRoom = () => evJson('(() => { const ks = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) { ks[k] = localStorage.getItem(k); } } return JSON.stringify({ keys: ks, sel: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
const room = readRoom();
ev('(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) { localStorage.removeItem(k); i = -1; break; } } localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab(`open ${BASE}`);
await zzz(6);
dressed = 0;
for (let i = 0; i < 90 && dressed < 16; i++) {
  dressed = evJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()').cards ?? 0;
  if (dressed < 16) {
    if (i === 45) { console.log("  (cards still short — one honest reload)"); ab(`open ${BASE}`); await zzz(5); }
    await zzz(2);
  }
}
note("F1 cards dressed", dressed);
let f1Ran = false;
if (dressed >= 16) {
  ev('(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine (tutorial)") !== -1); if (!btn) return "no-card"; const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return "clicked"; })()');
  await zzz(3);
  for (let i = 0; i < 8; i++) {
    const r = ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return "no"; b.click(); return "clicked"; })()');
    if (r.includes("clicked")) break;
    await zzz(1);
  }
  await zzz(2);
  /* the pre-fire read: EVERY dialog identified by its dialog-title (the
   * text-finder's first match can be the inspector beneath) */
  const fscPre = evJson(`(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const idOf = (d) => { const t = d.querySelector("[data-slot=dialog-title]"); return { title: t ? (t.textContent || "").trim().slice(0, 40) : null, state: d.getAttribute("data-state") }; }; const byTitle = dgs.find((d) => { const t = d.querySelector("[data-slot=dialog-title]"); return t && (t.textContent || "").indexOf("Compare FSC curves") !== -1; }); return JSON.stringify({ dlgN: dgs.length, dialogs: dgs.map(idOf), fscByTitle: !!byTitle, parentIsBody: byTitle ? byTitle.parentElement === document.body : null }); })()`);
  note("F1 overlay opened (all dialogs identified by title)", fscPre);
  if (fscPre.fscByTitle) {
    /* the witnesses + the event-driven rAF recorder (see the header) */
    const arm = evJson(`(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const fsc = dgs.find((d) => { const t = d.querySelector("[data-slot=dialog-title]"); return t && (t.textContent || "").indexOf("Compare FSC curves") !== -1; }); if (!fsc) return JSON.stringify({ armed: false, gone: true }); window.__f882node = fsc; window.__f882 = { cap: 0, capKey: null, bodyBub: 0, bodyDefPrev: null, docBub: 0, docDefPrev: null }; window.__f882cap = (e) => { window.__f882.cap++; window.__f882.capKey = e.key; }; window.__f882body = (e) => { window.__f882.bodyBub++; window.__f882.bodyDefPrev = e.defaultPrevented; }; window.__f882doc = (e) => { window.__f882.docBub++; window.__f882.docDefPrev = e.defaultPrevented; }; document.addEventListener("keydown", window.__f882cap, true); document.body.addEventListener("keydown", window.__f882body, false); document.addEventListener("keydown", window.__f882doc, false); window.__f882trace = null; const read = () => { const n = window.__f882node; const dgs2 = Array.from(document.querySelectorAll("[role=dialog]")); return { nodeConnected: !!(n && n.isConnected), state: n && n.isConnected ? n.getAttribute("data-state") : null, dlgN: dgs2.length, dlgStates: dgs2.map((d) => { const t = d.querySelector("[data-slot=dialog-title]"); return (t ? (t.textContent || "").trim().slice(0, 16) : "?") + ":" + d.getAttribute("data-state"); }) }; }; window.__f882rec = (e) => { if (e.key !== "Escape") return; document.removeEventListener("keydown", window.__f882rec, true); (async () => { const t0 = performance.now(); const marks = []; let last = JSON.stringify(read()); marks.push({ t: 0, ...read() }); for (let i = 0; i < 120; i++) { await new Promise((r) => requestAnimationFrame(r)); const cur = read(); const s = JSON.stringify(cur); if (s !== last) { marks.push({ t: Math.round(performance.now() - t0), ...cur }); last = s; } if (i % 30 === 29) marks.push({ t: Math.round(performance.now() - t0), cadence: true, ...cur }); } window.__f882trace = { marks, witnesses: window.__f882, activeAfter: (document.activeElement || {}).tagName || null }; })(); }; document.addEventListener("keydown", window.__f882rec, true); return JSON.stringify({ armed: true, pinnedState: fsc.getAttribute("data-state"), dlgTitles: dgs.map((d) => { const t = d.querySelector("[data-slot=dialog-title]"); return t ? (t.textContent || "").trim().slice(0, 24) : "?"; }), activeEl: (document.activeElement || {}).tagName || null }); })()`);
    note("F1 armed (witnesses + rAF recorder, node pinned)", arm);
    if (arm.armed) {
      ab("press Escape");
      await zzz(3);
      const trace = evJson('(() => JSON.stringify({ trace: window.__f882trace, w: window.__f882 }))()');
      note("F1 trace + witnesses", trace);
      ev('(() => { document.removeEventListener("keydown", window.__f882cap, true); document.body.removeEventListener("keydown", window.__f882body, false); document.removeEventListener("keydown", window.__f882doc, false); return "cleaned"; })()');
      const w = trace.w ?? {};
      const marks = trace.trace?.marks ?? [];
      const stateFlip = marks.find((m) => m.state === "closed");
      const nodeGone = marks.find((m) => m.nodeConnected === false);
      ok("F1 the real Escape was seen at document capture", (w.cap ?? 0) >= 1 && w.capKey === "Escape", `cap=${w.cap ?? "?"} key=${w.capKey ?? "?"}`);
      const bodyDef = w.bodyDefPrev;
      f1Ran = bodyDef === true;
      ok("F1 the consumer's fingerprint (defaultPrevented at the body dispatch)", true, `bodyBub=${w.bodyBub ?? "?"} bodyDefPrev=${bodyDef} docBub=${w.docBub ?? "?"} → ${bodyDef === true ? "the consumer RAN (its preventDefault rode the native event through the body dispatch)" : bodyDef === false ? "the body dispatch ran NO preventDefault-er" : "unreadable"}`);
      ok("F1 the close anatomy recorded", marks.length > 0, `marks=${JSON.stringify(marks.slice(0, 6))}`);
      note("F1 pinned-node state flip at ms", stateFlip?.t ?? null);
      note("F1 pinned-node unmount at ms", nodeGone?.t ?? null);
    }
  }
  /* the clean room's keys restored (the t873 law) */
  const restore = evJson('(() => { const r = JSON.parse(' + JSON.stringify(JSON.stringify(room)) + '); for (const [k, v] of Object.entries(r.keys || {})) { localStorage.setItem(k, v); } localStorage.setItem("cryoflow.selectedJob.v1", r.sel ?? ""); return JSON.stringify({ fscKeys: Object.keys(localStorage).filter((k) => k.indexOf("cryoflow.fsc-compare:") === 0).length }); })()');
  note("F1 room restored", restore);
}

/* ---------------- the receipt ---------------- */
const verdict =
  (kMoved
    ? "PORTAL KEYDOWN REACHES: the real hand moved the palette selection — React's keydown dispatch reaches portal content; the prior epoch's 'portal keydown is dead' claim was the instrument's early read (P2)"
    : "PORTAL KEYDOWN UNPROVEN: the real hand did not move the palette selection — the death is product-level; the witnesses name the death site") +
  " | " +
  "F1 the consumer's fate: " +
  (f1Ran
    ? "ALIVE — the body dispatch carried a preventDefault (the consumer's own); the 'dead code everywhere' claim dies"
    : "DEAD-or-unproven in the clean state (no preventDefault rode the body dispatch; Radix's document-capture path is the closer)");

const receipt = {
  instrument: "scripts/t882-keydown-reach.mjs",
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  verdict,
  findings,
  checks: findings.length,
  passed: pass,
  failed: fail,
};
const outPath = join(ROOT, "shots-qa", "t882-keydown-reach.json");
writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nt882 keydown-reach: ${pass} ok / ${fail} fail — verdict: ${verdict}`);
console.log(`receipt: ${outPath}`);
