#!/usr/bin/env node
/* t881 — the delegation topology probe: the listener-side hunt (the t880
 * tail's queue, and the t880 comment's generalization put on trial).
 *
 * The t880 root read: the FSC compare dialog's own Escape consumer NEVER
 * runs (synth=0, clean and churned), the fiber path from the focused
 * element REACHES the content (3 hops), so the miss was named "the
 * delegation's listener side on the portaled content". That naming was an
 * inference. This probe measures the inference:
 *
 *   T — the MARKER TOPOLOGY: React's `listenToAllSupportedEvents` marks
 *       every container it attaches to with an own `_reactListening*`
 *       property. Walk the FSC content's ancestor chain (content → portal
 *       wrapper → body → html) and the in-root canvas stage's chain: WHERE
 *       do the markers actually sit? (If body carries the marker, React
 *       DID attach to the portal container — the structural-miss theory
 *       dies; if only the root container carries it, the miss is
 *       structural and app-wide for portal content.)
 *   S — the LIVE SYNTHETIC COUNTS on both sides: the in-root canvas
 *       stage's onKeyDown wrapped and fired (the control), the FSC
 *       content's wrapped and fired (the subject), the inspector content's
 *       read (the second portal). One ride, two verdicts.
 *   P — the PALETTE'S TYPING TEST (the user-facing judge): the command
 *       palette is a portaled Radix dialog whose cmdk input is a
 *       controlled React input. Type through the native-setter dialect —
 *       if the list filters, synthetic onChange REACHES portal content
 *       (the structural theory dies a second death and the FSC miss is
 *       per-tree); if it does not, the app-wide synthetic death is real,
 *       user-facing, and the onEscapeClose doc's claim ("stops the native
 *       event at the React root container") is false for every one of its
 *       ~15 call sites.
 *
 * Receipt: shots-qa/t881-delegation-topology.json.
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const ev = (js) => ab(`eval ${JSON.stringify(js)}`).trim();
/* the DOUBLE-UNWRAP (the t877/t880 law) */
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

const FSC = 'Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves"))';

/* the marker reader: for one node, WHICH react markers sit on it */
const MARKERS = '(node) => { const ks = Object.keys(node); return { listening: ks.filter((k) => k.indexOf("_reactListening") === 0).length > 0, fiber: ks.some((k) => k.indexOf("__reactFiber") === 0), props: ks.some((k) => k.indexOf("__reactProps") === 0), container: ks.some((k) => k.indexOf("__reactContainer") === 0) }; }';

/* T-face: the ancestor chains of an in-root element and (later) the FSC
 * content — the topology of React's delegation markers */
const CHAIN = `(() => { const read = ${MARKERS}; const chain = (el, max) => { const out = []; let n = el; let i = 0; while (n && n.nodeType === 1 && i < max) { const m = read(n); out.push({ tag: n.tagName + (n.id ? "#" + n.id : "") + (n.className && typeof n.className === "string" ? "." + n.className.split(" ").slice(0, 2).join(".") : ""), listening: m.listening, fiber: m.fiber, props: m.props, container: m.container }); n = n.parentElement; i++; } return out; }; const root = document.querySelector("#__next") || document.body.firstElementChild; const canvasEl = document.querySelector(".canvas-grid"); return JSON.stringify({ rootTag: root ? root.tagName + (root.id ? "#" + root.id : "") : null, rootMarkers: root ? read(root) : null, bodyMarkers: read(document.body), htmlMarkers: read(document.documentElement), canvasChain: canvasEl ? chain(canvasEl, 12) : null }); })()`;

/* the FSC content's ancestor chain (the portal side of the topology) */
const FSC_CHAIN = `(() => { const read = ${MARKERS}; const fsc = ${FSC}; if (!fsc) return JSON.stringify({ open: false }); const chain = []; let n = fsc; let i = 0; while (n && n.nodeType === 1 && i < 12) { const m = read(n); chain.push({ tag: n.tagName + (n.id ? "#" + n.id : "") + (n.className && typeof n.className === "string" ? "." + n.className.split(" ").slice(0, 2).join(".") : "") + (n.getAttribute && n.getAttribute("data-slot") ? "[" + n.getAttribute("data-slot") + "]" : ""), listening: m.listening, fiber: m.fiber, props: m.props }); n = n.parentElement; i++; } return JSON.stringify({ open: true, chain: chain }); })()`;

/* S-face: wrap a node's __reactProps.onKeyDown (marked) — returns armed */
const ARM_AT = `(node) => { if (!node) return { armed: false, no: "node" }; const pk = Object.keys(node).find((k) => k.indexOf("__reactProps") === 0); if (!pk) return { armed: false, no: "props" }; const cur = node[pk]; if (typeof cur.onKeyDown !== "function") return { armed: false, no: "handler", kind: typeof cur.onKeyDown }; node.__s881mark = true; window.__s881count = 0; const orig = cur.onKeyDown; cur.onKeyDown = function (e) { window.__s881count = (window.__s881count || 0) + 1; return orig.call(this, e); }; cur.__s881wrapped = true; return { armed: true }; }`;

const ARM_CANVAS = `(() => { const el = document.querySelector(".canvas-grid"); const r = (${ARM_AT})(el); return JSON.stringify(r); })()`;
const FIRE_CANVAS = `(() => { const el = document.querySelector(".canvas-grid"); if (!el) return JSON.stringify({ sent: false }); el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ sent: true, synth: window.__s881count ?? null }); })()`;

const ARM_FSC = `(() => { const fsc = ${FSC}; const r = (${ARM_AT})(fsc); return JSON.stringify(r); })()`;
const FIRE_FSC = `(() => { const fsc = ${FSC}; if (!fsc) return JSON.stringify({ sent: false, gone: true }); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs[dgs.length - 1]; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ sent: true, on: t.tagName, synth: window.__s881count ?? null }); })()`;

/* the native capture counter aboard both fires (the esc side of the story) */
const ARM_CAPTURE = `(() => { window.__s881esc = 0; const fsc = ${FSC}; if (!fsc) return JSON.stringify({ armed: false }); fsc.addEventListener("keydown", () => { window.__s881esc = (window.__s881esc || 0) + 1; }, true); return JSON.stringify({ armed: true }); })()`;

const world = worldIdentity(ROOT);
console.log(`t881 delegation topology probe — world ${world.mode}:${world.id}\n`);
const findings = [];
const note = (k, v) => { findings.push({ k, v }); console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`); };

/* ---------- the stage: clean room, dress, the FSC overlay open ---------- */
ev('(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) { localStorage.removeItem(k); i = -1; break; } } localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
await zzz(5);
let dressed = 0;
for (let i = 0; i < 90 && dressed < 16; i++) {
  dressed = evJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()').cards ?? 0;
  if (dressed < 16) {
    if (i === 45) {
      console.log("  (cards still short — one honest reload)");
      ab("open http://localhost:3000");
      await zzz(5);
    }
    await zzz(2);
  }
}
note("cards dressed", dressed);

/* ---------- T-face: the in-root marker topology (no dialog needed) ---------- */
const topo = evJson(CHAIN);
note("T the root + body markers", { rootTag: topo.rootTag, root: topo.rootMarkers, body: topo.bodyMarkers, html: topo.htmlMarkers });
note("T the in-root chain (canvas-grid upward)", topo.canvasChain);

/* ---------- S-face part 1: the in-root control (wrap + fire) ---------- */
const armCanvas = evJson(ARM_CANVAS);
note("S in-root armed", armCanvas);
const fireCanvas = evJson(FIRE_CANVAS);
note("S in-root fired", fireCanvas);

/* ---------- open the inspector + the FSC overlay ---------- */
ev('(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine (tutorial)") !== -1); if (!btn) return "no-card"; const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return "clicked"; })()');
await zzz(3);
for (let i = 0; i < 8; i++) {
  const r = ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return "no"; b.click(); return "clicked"; })()');
  if (r.includes("clicked")) break;
  await zzz(1);
}
const fscChain = evJson(FSC_CHAIN);
note("T the FSC portal chain", fscChain);

/* ---------- S-face part 2: the portal side (capture + wrap + fire) ---------- */
const armCap = evJson(ARM_CAPTURE);
note("S fsc capture armed", armCap);
const armFsc = evJson(ARM_FSC);
note("S fsc wrap armed", armFsc);
const fireFsc = evJson(FIRE_FSC);
note("S fsc fired", fireFsc);
const escAfter = evJson('(() => JSON.stringify({ esc: window.__s881esc ?? null, dlgCount: document.querySelectorAll("[role=dialog]").length, fscOpen: !!' + FSC + ' }))()');
note("S fsc aftermath (esc + the Radix path's effect)", escAfter);

/* ---------- P-face: the palette's typing test (the user-facing judge) ---------- */
/* close whatever the FSC fire left (the Radix path may have peeled it) */
ev('(() => { const dgs = document.querySelectorAll("[role=dialog]"); return "left=" + dgs.length; })()');
/* the inspector may still be open with the FSC gone — Escape once through
 * the honest dialect, then verify the canvas is bare */
ev('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs[dgs.length - 1]; if (!top) return "none"; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return "esc"; })()');
await zzz(2);
ev('(() => window.dispatchEvent(new Event("cryoflow:open-palette")))()');
await zzz(2);
const palOpen = evJson('(() => { const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ open: !!ip, items: document.querySelectorAll("[cmdk-item]").length, ph: ip ? ip.placeholder : null }); })()');
note("P palette opened", palOpen);
let typing = { tested: false };
if (palOpen.open) {
  typing = evJson(`(() => { return (async () => { const ip = document.querySelector("[cmdk-input]"); if (!ip) return JSON.stringify({ tested: false, no: "input" }); const before = document.querySelectorAll("[cmdk-item]").length; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(ip, "refine"); ip.dispatchEvent(new Event("input", { bubbles: true })); await new Promise((r) => setTimeout(r, 400)); const after = document.querySelectorAll("[cmdk-item]").length; const val = ip.value; return JSON.stringify({ tested: true, before: before, after: after, value: val, filtered: after !== before && val === "refine" }); })(); })()`);
  note("P palette typed", typing);
  /* the ArrowDown test (the NO-MUTATION disambiguator): cmdk's list
   * navigation is a pure product-level synthetic onKeyDown — if the
   * selection moves, React's synthetic keydown delegation WORKS for this
   * portal subtree, and the wrap-mutation instruments (t880/t881 synth=0)
   * become suspects themselves; if it does not move, the keydown-specific
   * delegation death is real, product-observable. */
  const arrows = evJson(`(() => { return (async () => { const ip = document.querySelector("[cmdk-input]"); if (!ip) return JSON.stringify({ tested: false, no: "input" }); const sel = () => { const s = document.querySelector('[cmdk-item][data-selected="true"]'); return s ? (s.textContent || "").trim().slice(0, 30) : null; }; const before = sel(); ip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 200)); const after = sel(); return JSON.stringify({ tested: true, before: before, after: after, moved: before !== null && after !== null && before !== after }); })(); })()`);
  note("P palette ArrowDown (no-mutation synthetic keydown)", arrows);
  typing.arrowTest = arrows;
  /* close the palette honestly */
  ev('(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs[dgs.length - 1]; if (!top) return "none"; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return "esc"; })()');
  await zzz(1);
}

/* ---------- Z-face: the ZERO-GAP wrap+fire (the instrument's own cure) ----------
 * The t880/t881 wraps armed in a SEPARATE eval from the fire — a re-render
 * between the evals replaces the __reactProps object and the wrap dies
 * silently (synth=0 reads as \'delegation dead\' when it may read as
 * \'the instrument\'s handle was replaced\'). One eval: identity-read, wrap,
 * dispatch, identity-read-after. Zero gap, no replacement window. */
const ZERO_GAP = (selJs, fireAtSelJs) => `(() => { const el = ${selJs}; if (!el) return JSON.stringify({ sent: false, no: "node" }); const pk = Object.keys(el).find((k) => k.indexOf("__reactProps") === 0); const cur = pk ? el[pk] : null; if (!cur || typeof cur.onKeyDown !== "function") return JSON.stringify({ sent: false, no: "handler", kind: cur ? typeof cur.onKeyDown : "no-props" }); window.__s881z = 0; const orig = cur.onKeyDown; const wrapper = function (e) { window.__s881z = (window.__s881z || 0) + 1; return orig.call(this, e); }; cur.onKeyDown = wrapper; el.__s881propsKey = pk; const t = ${fireAtSelJs}; t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); const identityAfter = el[pk] === wrapper; return JSON.stringify({ sent: true, identityAfter: identityAfter, synth: window.__s881z }); })()`;
const zgFsc = evJson(ZERO_GAP(FSC, '(document.activeElement && el.contains(document.activeElement)) ? document.activeElement : el'));
note("Z the FSC zero-gap wrap+fire", zgFsc);
const zgCanvas = evJson(ZERO_GAP('document.querySelector(".canvas-grid")', 'el'));
note("Z the canvas zero-gap wrap+fire", zgCanvas);

/* ---------- the verdict ---------- */
const bodyListening = !!(topo.bodyMarkers && topo.bodyMarkers.listening);
const rootListening = !!(topo.rootMarkers && topo.rootMarkers.listening);
const inRootSynth = (fireCanvas.synth ?? 0) >= 1 || (zgCanvas.synth ?? 0) >= 1;
const portalSynth = (fireFsc.synth ?? 0) >= 1 || (zgFsc.synth ?? 0) >= 1;
const zgClean = (zgFsc.identityAfter === true && zgCanvas.identityAfter === true);
const paletteWorked = typing.filtered === true;
const arrowMoved = !!(typing.arrowTest && typing.arrowTest.moved);
let verdict;
if (inRootSynth && !portalSynth && bodyListening && paletteWorked) {
  verdict = "ATTACHMENT PRESENT, PER-TREE MISS: React DID attach to the portal container (body carries the marker), in-root synthetic works, portal onChange works (the palette filters) — yet the FSC content's onKeyDown never runs. The miss is NOT structural: it is per-tree or per-handler (the collect/invoke side for THIS subtree). The t880 comment's 'portaled content' generalization needs softening; the consumer's dead-where-measured fact stands.";
} else if (arrowMoved && zgClean && (zgFsc.synth ?? 0) === 0 && (zgCanvas.synth ?? 0) === 0) {
  verdict = "KEYDOWN-SPECIFIC DELEGATION DEATH (zero-gap proven): the palette's ArrowDown moved the selection (synthetic keydown WORKS for cmdk's subtree) while BOTH zero-gap wraps (identity intact at dispatch) never ran — the delegation processes some subtrees' keydown and not others. The wrap cannot be blamed: the zero-gap protocol closed the replacement window. Read the cmdk-vs-these subtrees for the difference (the portal container? the fiber shape? the event's registration).";
} else if (inRootSynth && !portalSynth && !bodyListening) {
  verdict = "STRUCTURAL MISS CONFIRMED: React never attached to the portal container (no marker on body) — synthetic events never reach ANY portal content. The onEscapeClose doc's claim is false app-wide; the palette typing should ALSO have failed (check P) — a user-facing consequence.";
} else if (inRootSynth && !portalSynth && bodyListening && !paletteWorked) {
  verdict = "ATTACHMENT PRESENT, PORTAL DISPATCH DEAD: the marker sits on body, in-root synthetic works, but portal onChange AND the FSC onKeyDown are both dead — the delegation's portal dispatch is broken deeper than the marker (React's collect/invoke for portal subtrees). The palette typing is a user-facing bug.";
} else if (inRootSynth && portalSynth) {
  verdict = "THE CONSUMER LIVES TODAY: the FSC onKeyDown fired under the wrap (synth>=1) — the t880 read does not reproduce on this key/world; the find's mechanism reopens (ride variance or the t880 wrap landed on a stale props object).";
} else {
  verdict = "MIXED/UNEXPECTED SHAPE — read the receipt's parts together (in-root=" + inRootSynth + ", portal=" + portalSynth + ", bodyMarker=" + bodyListening + ", palette=" + paletteWorked + ", arrow=" + arrowMoved + ", zero-gap fsc synth=" + (zgFsc.synth ?? "?") + " canvas synth=" + (zgCanvas.synth ?? "?") + ")";
}
console.log(`\nVERDICT: ${verdict}`);

/* the world restored: the selection blanked, one reload */
ev('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
await zzz(3);
const restored = evJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length, dlgCount: document.querySelectorAll("[role=dialog]").length }))()');
note("the world restored", restored);

const receipt = {
  instrument: "scripts/t881-delegation-topology.mjs",
  world,
  date: new Date().toISOString(),
  question: "where does React's synthetic keydown delegation actually attach — and does it reach portal content? (the t880 comment's generalization on trial)",
  topology: { root: topo.rootMarkers, body: topo.bodyMarkers, html: topo.htmlMarkers, canvasChain: topo.canvasChain, fscChain: fscChain },
  live: { armCanvas, fireCanvas, armCapture: armCap, armFsc, fireFsc, escAfter, palette: { open: palOpen, typing } },
  verdict,
  restored,
};
const out = join(ROOT, "shots-qa", "t881-delegation-topology.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`receipt: ${out}`);
