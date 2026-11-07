#!/usr/bin/env node
/**
 * t1137 — the W1 STOPPER CENSUS (act 2 of the clean-state probe).
 *
 * Act 1 (t1137-w1-clean-state-synth) left a UNSHAPED verdict: the real
 * Escape reached the page (capture=1), the content's own onKeyDown was
 * never called (synth=0 with the wrap identity-verified alive), the
 * event never reached document bubble (bubble=0), and yet the dialog
 * closed fast (≤250ms). The node_modules witness already named the
 * CLOSER: Radix's useEscapeKeydown registers at document CAPTURE
 * ({ capture: true }) and closes at capture time — before the event
 * ever descends to the target. What the witness does NOT explain is
 * bubble=0: preventDefault does not stop propagation, and neither src
 * nor mol* carries stopImmediatePropagation.
 *
 * THE CENSUS: plant a level-by-level path census (window → document →
 * body → every ancestor of the dialog content → the content itself,
 * both phases) AND monkey-patch Event.prototype.stopPropagation /
 * stopImmediatePropagation / preventDefault to LOG THE CALLER'S STACK
 * on the tracked event. One real Escape later, the eater is named at
 * its exact address — the t1136 law: a conviction that survives the
 * browser.
 */
import { createWalk } from "./walk-kit.mjs";

const walk = createWalk({ name: "t1137-w1-stopper-census", receiptFile: "t1137-w1-stopper-census.json" });
const { ok, sleep, sh, evalJs, evalJson } = walk;

const CENSUS_PLANT = `(() => {
  if (!window.__w2) window.__w2 = { stops: [], prevented: [], hits: [], pressTs: 0 };
  const W = window.__w2;
  const lvl = (name, phase) => (e) => {
    if (!e || e.key !== "Escape") return;
    e.__w2 = true;
    W.hits.push({ level: name, phase, ts: Math.round(performance.now() - W.pressTs), tgt: (e.target && e.target.tagName) || "?", dp: e.defaultPrevented });
  };
  const levels = [];
  const dlg = document.querySelector("[data-fsc-compare-dialog]");
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  let node = dlg; let i = 0;
  while (node && node !== document.documentElement && i < 10) {
    levels.push({ node, name: (node.tagName || "?") + (node.getAttribute && node.getAttribute("data-fsc-compare-dialog") !== null ? "#fsc-dialog" : node.id ? "#" + node.id : node.className && typeof node.className === "string" ? "." + node.className.split(" ").slice(0, 2).join(".") : "[" + i + "]") });
    node = node.parentElement || (node.parentNode && node.parentNode.host) || null; i++;
  }
  for (const { node, name } of levels) {
    node.addEventListener("keydown", lvl(name, "capture"), true);
    node.addEventListener("keydown", lvl(name, "bubble"), false);
  }
  document.addEventListener("keydown", lvl("document", "capture"), true);
  document.addEventListener("keydown", lvl("document", "bubble"), false);
  window.addEventListener("keydown", lvl("window", "capture"), true);
  window.addEventListener("keydown", lvl("window", "bubble"), false);
  if (!W.patched) {
    W.patched = true;
    const tag = (proto, meth, kind) => {
      const orig = proto[meth];
      proto[meth] = function (...a) {
        if (this && this.__w2) W[kind].push({ meth, stack: String(new Error().stack || "").split("\\n").slice(2, 6).join(" | ").slice(0, 400) });
        return orig.apply(this, a);
      };
    };
    tag(Event.prototype, "stopPropagation", "stops");
    tag(Event.prototype, "stopImmediatePropagation", "stops");
    tag(Event.prototype, "preventDefault", "prevented");
  }
  return JSON.stringify({ planted: true, levelCount: levels.length + 3 });
})()`;

const READ = `(() => JSON.stringify({ w2: window.__w2 ? { hits: window.__w2.hits, stops: window.__w2.stops, prevented: window.__w2.prevented.length } : null, dlgOpen: !!document.querySelector("[data-fsc-compare-dialog]") }))()`;

const clickPoint = async (findExpr) => {
  const pt = evalJson(`(() => { const el = (${findExpr}); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); if (r.width === 0) return null; return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (!pt) return null;
  sh(`${walk.AB} mouse move ${pt.x} ${pt.y}`);
  sh(`${walk.AB} mouse down`);
  sh(`${walk.AB} mouse up`);
  return pt;
};

const gate = async (expr, label, tries = 30, ms = 700) => {
  const v = await walk.poll(expr, (x) => x === true, tries, ms);
  return ok(`NAV ${label}`, !!v);
};

(async () => {
  await walk.serverFirst();
  await walk.wideFirst();
  await gate(`document.body.innerText.includes('14 edges')`, "hydration gate (the footer's live numbers)", 40, 900);
  await gate(
    `(() => { const c = document.querySelector('button[aria-label^="Final FSC"]'); if (!c) return false; const pk = Object.keys(c).find((k) => k.startsWith("__reactProps")); return !!(pk && c[pk] && typeof c[pk].onClick === "function"); })()`,
    "the FSC chip's handler attached", 40, 900,
  );
  await clickPoint(`document.querySelector('button[aria-label^="Final FSC"]')`);
  await gate(`(() => { const b = document.querySelector('button[aria-label="Enlarge Sharpened map"]'); return !!b && b.getBoundingClientRect().width > 0; })()`, "the results section open");
  await gate(
    `(() => { const b = document.querySelector('button[data-testid="fsc-compare-open"]'); if (!b) return false; const pk = Object.keys(b).find((k) => k.startsWith("__reactProps")); return !!(pk && b[pk] && typeof b[pk].onClick === "function"); })()`,
    "the compare door with its hand", 30, 900,
  );
  await clickPoint(`document.querySelector('button[data-testid="fsc-compare-open"]')`);
  await gate(
    `(() => { const d = document.querySelector("[data-fsc-compare-dialog]"); return !!d && d.getAttribute("data-state") === "open" && d.getBoundingClientRect().width > 0; })()`,
    "the compare dialog OPEN", 30, 900,
  );
  await walk.poll(
    `(() => { const d = document.querySelector("[data-fsc-compare-dialog]"); if (!d) return JSON.stringify({ settled: false }); return JSON.stringify({ settled: !d.textContent.includes("Reading curves") }); })()`,
    (x) => x.settled === true, 20, 700,
  );
  await sleep(1000);

  const plant = evalJson(CENSUS_PLANT);
  ok("CENSUS the path census planted (every ancestor, both phases, + the Event.prototype patch)", plant?.planted === true, `levels=${plant?.levelCount}`);

  evalJs(`(() => { window.__w2.pressTs = performance.now(); return "1"; })()`);
  sh(`${walk.AB} press Escape`);
  await sleep(400);

  const r = evalJson(READ);
  const w2 = r?.w2 ?? {};
  ok("TRACE the event's path recorded", (w2.hits ?? []).length >= 1, `hits=${(w2.hits ?? []).length}`);
  console.log("  — the path (level by level, relative ms):");
  for (const h of w2.hits ?? []) console.log(`    ${h.ts}ms  ${h.phase.padEnd(7)} ${h.level}  tgt=${h.tgt} defaultPrevented=${h.dp}`);
  console.log(`  — stopPropagation calls on the tracked event: ${(w2.stops ?? []).length}`);
  for (const s of w2.stops ?? []) console.log(`    ${s.meth}: ${s.stack}`);
  console.log(`  — preventDefault calls: ${w2.prevented}`);
  ok("VERDICT the dialog closed", r?.dlgOpen === false, `dlgOpen=${r?.dlgOpen}`);

  walk.finish({ path: w2.hits ?? [], stops: w2.stops ?? [], preventedCount: w2.prevented ?? 0, dlgOpen: r?.dlgOpen ?? null });
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
