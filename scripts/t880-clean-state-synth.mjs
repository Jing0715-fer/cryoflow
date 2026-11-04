#!/usr/bin/env node
/* t880 — the clean-state synth probe: the fork's ROOT (the t879 tail's queue).
 *
 * The t879 answer read, in the CHURN state (the overlay alive through the
 * completion flip): esc=1, synth=0, the close landing ~2-2.5s late — the
 * synthetic consumer bypassed, Radix's document-level path the real closer.
 * The ROOT question this probe answers: does the FSC compare dialog's own
 * Escape consumer EVER fire?
 *
 *   synth>=1 in the CLEAN state → the consumer is alive; the bypass is
 *     churn-specific (the dispatch-target fiber walk rides the walk next).
 *   synth=0 with esc>=1 → the consumer is dead code EVERYWHERE — the
 *     t877-era comment in fsc-compare-dialog.tsx ("consuming the event
 *     before the document-level Radix listeners") describes an architecture
 *     that does not exist; Radix's top-layer rule is the real protector,
 *     and the comment fix is a product-docs fix.
 *   esc=0 → the event never reached the content: the probe's own dialect
 *     lies (the t873 law) — name it before any verdict.
 *
 * The commit-latency discriminator rides every arc: the beats sample at 0
 * (immediately post-dispatch) and 8 x 500ms. A close landing at beat 0 is
 * SYNCHRONOUS (React flushes discrete events synchronously — a consumer-
 * driven close looks exactly like that); a close landing at beat >=1 is
 * DELAYED (the churn-shaped path: the document listener + a starved commit).
 *
 * Two arcs, each a fresh clean open (the world is quiet — 16/16 completed;
 * no run is seeded: the clean state IS the subject). The dispatch-target
 * fiber walk is pre-fire intel: does the target's fiber path REACH the
 * content's fiber, and does the path carry onKeyDown?
 *
 * Receipt: shots-qa/t880-clean-state-synth.json.
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8" });
const ev = (js) => ab(`eval ${JSON.stringify(js)}`).trim();
/* the DOUBLE-UNWRAP (the t877 walk's own lesson, learned the hard way by
 * this probe's first ride): the CLI prints a string result QUOTED, so the
 * first JSON.parse yields the inner JSON as a STRING — the object needs a
 * second parse. A single-parse evJson returns strings, every `.field`
 * read goes undefined, and the stage "never dresses" while the world
 * stands fully dressed behind the lie. */
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

/* the pre-fire lens + the dispatch-target fiber walk: does the TARGET's
 * fiber path reach the content's fiber (the delegation's walk), and does
 * the path carry onKeyDown (the consumer's presence in the walk)? */
const LENS = `(() => { const fsc = ${FSC}; if (!fsc) return JSON.stringify({ open: false, dlgCount: document.querySelectorAll("[role=dialog]").length }); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs[dgs.length - 1]; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); const keys = Object.keys(fsc); const fiberKey = keys.find((k) => k.startsWith("__reactFiber")); const propsKey = keys.find((k) => k.startsWith("__reactProps")); const tfk = Object.keys(t).find((k) => k.startsWith("__reactFiber")); const cfk = fiberKey ? fsc[fiberKey] : null; let n = tfk ? t[tfk] : null, hops = 0, reached = -1, onKeyHop = -1; while (n && hops < 80) { if (cfk && n === cfk) { reached = hops; break; } if (n.memoizedProps && n.memoizedProps.onKeyDown && onKeyHop === -1) onKeyHop = hops; n = n.return; hops++; } return JSON.stringify({ open: true, dlgCount: dgs.length, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : ""), targetHasFiber: !!tfk, pathReachesContent: reached, pathOnKeyHop: onKeyHop, pathHops: hops, contentHasProps: !!propsKey, contentOwnKind: propsKey ? typeof fsc[propsKey].onKeyDown : "no-props", dataState: fsc.getAttribute("data-state") }); })()`;

/* the arm: the native capture counter + the synth-wrap (marked) */
const ARM = `(() => { const fsc = ${FSC}; if (!fsc) return JSON.stringify({ armed: false, gone: true }); const pk = Object.keys(fsc).find((k) => k.startsWith("__reactProps")); if (!pk) return JSON.stringify({ armed: false, hasProps: false }); const cur = fsc[pk]; if (typeof cur.onKeyDown !== "function") return JSON.stringify({ armed: false, hasProps: true, ownKind: typeof cur.onKeyDown }); window.__s880esc = 0; window.__s880synth = 0; fsc.addEventListener("keydown", () => { window.__s880esc = (window.__s880esc || 0) + 1; }, true); const orig = cur.onKeyDown; cur.onKeyDown = function (e) { window.__s880synth = (window.__s880synth || 0) + 1; return orig.call(this, e); }; cur.__s880wrapped = true; return JSON.stringify({ armed: true, activeEl: document.activeElement ? document.activeElement.tagName : "body" }); })()`;

/* fire (the real hand's dialect) + the commit-latency beats in ONE eval */
const FIRE_BEATS = `(() => { return (async () => { const fsc = () => ${FSC}; const dgs = () => Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs().length ? dgs()[dgs().length - 1] : document.body; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); const beats = [{ at: 0, open: !!fsc(), synth: window.__s880synth ?? null, esc: window.__s880esc ?? null }]; for (let i = 1; i <= 8; i++) { await new Promise((r) => setTimeout(r, 500)); const open = !!fsc(); beats.push({ at: i * 500, open, synth: window.__s880synth ?? null, esc: window.__s880esc ?? null }); if (!open) break; } const cur = fsc(); const pk = cur ? Object.keys(cur).find((k) => k.startsWith("__reactProps")) : null; const props = cur && pk ? cur[pk] : null; return JSON.stringify({ sent: true, target: t.tagName, beats: beats, finalOpen: !!cur, dlgCount: document.querySelectorAll("[role=dialog]").length, wrapSurvives: props ? !!props.__s880wrapped : null, dataState: cur ? cur.getAttribute("data-state") : null }); })(); })()`;

const world = worldIdentity(ROOT);
console.log(`t880 clean-state synth probe — world ${world.mode}:${world.id}\n`);
const findings = [];
const note = (k, v) => { findings.push({ k, v }); console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`); };

/* the clean room: the fsc-compare keys read then removed, the selection
 * blanked (the t873 law: the world restored as found — the key set rides
 * the receipt and the arc tail restores it) */
const readRoom = () => evJson('(() => { const ks = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) { ks[k] = localStorage.getItem(k); } } return JSON.stringify({ keys: ks, sel: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
const cleanRoom = '(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) { localStorage.removeItem(k); i = -1; break; } } localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()';
const restoreRoom = (room) => evJson('(() => { const r = JSON.parse(' + JSON.stringify(JSON.stringify(room)) + '); for (const [k, v] of Object.entries(r.keys || {})) { localStorage.setItem(k, v); } localStorage.setItem("cryoflow.selectedJob.v1", r.sel ?? ""); return "restored"; })()');

async function arc(n) {
  console.log(`Arc ${n} — the clean stage`);
  const room = readRoom();
  ev(cleanRoom);
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
  note(`arc${n} cards dressed`, dressed);
  if (dressed < 16) return { arc: n, abort: "the stage never dressed", room };
  /* the tutorial refine3d's card (completed, FSC-bearing, the quiet world's
   * own subject) through the pointer trio */
  ev('(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf("3D Refine (tutorial)") !== -1); if (!btn) return "no-card"; const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return "clicked"; })()');
  await zzz(3);
  for (let i = 0; i < 8; i++) {
    const r = ev('(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return "no"; b.click(); return "clicked"; })()');
    if (r.includes("clicked")) break;
    await zzz(1);
  }
  const lens = evJson(LENS);
  note(`arc${n} the lens (pre-fire, the fiber walk)`, lens);
  if (!lens.open) return { arc: n, abort: "the overlay never opened", lens, room };
  const arm = evJson(ARM);
  note(`arc${n} armed`, arm);
  if (!arm.armed) return { arc: n, abort: "the wrap could not arm", arm, room };
  const fire = evJson(FIRE_BEATS);
  note(`arc${n} fire + beats`, fire);
  /* the honest close: whatever remains open is closed by the reload the
   * next arc's stage performs; the quiet world owes no extra presses */
  const landAt = (fire.beats ?? []).find((b) => b.open === false)?.at ?? null;
  const beat0 = (fire.beats ?? [])[0] ?? {};
  const verdict = {
    arc: n,
    esc: beat0.esc ?? (fire.beats ?? []).map((b) => b.esc).reduce((a, b) => Math.max(a ?? 0, b ?? 0), 0),
    synth: (fire.beats ?? []).map((b) => b.synth).reduce((a, b) => Math.max(a ?? 0, b ?? 0), 0),
    closed: fire.finalOpen === false,
    closeShape: fire.finalOpen === false ? (landAt === 0 ? "synchronous (beat 0)" : `delayed (+${landAt}ms)`) : "never closed in 4s",
    wrapSurvives: fire.wrapSurvives ?? null,
  };
  note(`arc${n} VERDICT`, verdict);
  return { ...verdict, lens, arm, fire, room };
}

const a1 = await arc(1);
const a2 = await arc(2);

/* the root verdict: both arcs must agree (the two-consecutive convention) */
const synthMax = Math.max(a1.synth ?? 0, a2.synth ?? 0);
const escMin = Math.min(a1.esc ?? 0, a2.esc ?? 0);
const closedBoth = a1.closed === true && a2.closed === true;
let root;
if (escMin === 0) {
  root = "PROBE-LIE: the event never reached the content in at least one arc (the dialect/selector problem) — no verdict on the consumer";
} else if (synthMax >= 1) {
  root = "CONSUMER ALIVE in the clean state (synth fired) — the t879 bypass is churn-specific; the dispatch-target fiber walk rides the walk's churn state next";
} else if (closedBoth) {
  root = "CONSUMER DEAD CODE everywhere (synth=0 both arcs, esc>=1, both closed) — Radix's document-level path closes even cleanly; the t877-era comment in fsc-compare-dialog.tsx describes an architecture that does not exist (the comment fix is a product-docs fix; Radix's top-layer rule is the real protector)";
} else {
  root = "CONSUMER DEAD AND THE CLEAN CLOSE ALSO IMPERFECT — a bigger find than queued; the clean state's own close shape rides the receipt";
}
console.log(`\nROOT: ${root}`);

/* the world restored: the room's keys + the selection back, one reload */
const room0 = a1.room ?? { keys: {}, sel: null };
restoreRoom(room0);
ab("open http://localhost:3000");
await zzz(3);
const restored = evJson('(() => JSON.stringify({ fscKeys: Object.keys(localStorage).filter((k) => k.indexOf("cryoflow.fsc-compare:") === 0).length, cards: document.querySelectorAll("[data-card-btn]").length, dlgCount: document.querySelectorAll("[role=dialog]").length }))()');
note("the world restored", restored);

const receipt = {
  instrument: "scripts/t880-clean-state-synth.mjs",
  world: world,
  date: new Date().toISOString(),
  question: "does the FSC compare dialog's own Escape consumer EVER fire? (the t879 fork's root)",
  arcs: [a1, a2],
  root: root,
  restored: restored,
};
const out = join(ROOT, "shots-qa", "t880-clean-state-synth.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`receipt: ${out}`);
