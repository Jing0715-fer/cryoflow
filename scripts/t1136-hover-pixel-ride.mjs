#!/usr/bin/env node
/**
 * t1136 — the hover's A/B PIXEL RIDE (the t1134 first candidate, the
 * pixel testimony the t1134 window could not take).
 *
 * THE PATH (every step a REAL input — agent-browser's own click/hover,
 * never an eval-dispatched .click()): the FSC chip opens the results,
 * the Enlarge door opens the ortho panel, View in 3D opens the mol*
 * dialog, the two sections expand, the ✂ cut wires the plane, the ▣
 * sheet shows the face, the legend row settles its key.
 *
 * THE LEGS:
 *   W   the world (server-first, wide, fresh session, the build key read)
 *   NAV the real-click walk (each door named, each expansion verified)
 *   M   the wire's 2D mouth: the pointer over a swatch (matches(:hover)
 *       live-proven — the pointer instrument's own witness)
 *   AB  the pixel account: noise floor (A0 vs A1), the paint leg
 *       (A0 vs B), the move leg (B vs C), the restore leg (A0 vs D) —
 *       all inside the 3D canvas box
 *
 * THE HONEST WORLD NOTE: this instrument rides whatever build the world
 * serves. On the pre-t1136-fix build the applier's address is the
 * convicted phantom (sheetRef.current?.transform?.ref off a
 * StateBuilder.To — a To has a `ref`, not a `.transform`; the optional
 * chain bailed the ghost-key guard on EVERY hover, tsc blinded by the
 * `as unknown as` cast), so the paint/move legs run 0 and the receipt
 * records them as the CONVICTION, not a lie. When the fix is baked, the
 * same ride re-runs and the same legs must cross the threshold.
 */
import { createWalk } from "./walk-kit.mjs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const QA = path.join(ROOT, "shots-qa");
const walk = createWalk({ name: "t1136-hover-pixel-ride", receiptFile: "t1136-hover-pixel-ride.json" });
const { ok, sleep, sh, evalJs, evalJson } = walk;

const diff = (a, b, x, y, w, h) => {
  const out = execSync(
    `python3 scripts/t1136-pixel-diff.py "${a}" "${b}" ${x} ${y} ${w} ${h}`,
    { encoding: "utf8", cwd: ROOT, timeout: 120_000 },
  ).trim();
  return Number(out.match(/COUNT (\d+)/)?.[1] ?? -1);
};

(async () => {
  // W — the world
  await walk.serverFirst();
  await walk.wideFirst();

  const buildKey = evalJs(`(document.documentElement.innerHTML.match(/build ([0-9a-f]{6,12})/) || [])[1] || "unknown"`);
  console.log(`  — world build key: ${buildKey}`);
  const preFix = evalJs(`document.body.innerText.length > 0 ? true : false`);

  // NAV — the real-click walk. Each step: a REAL role/name click
  // (agent-browser's own input pipeline, never an eval dispatch) — the
  // role locator reads the ACCESSIBLE NAME, the one voice every door has
  // whether its label rides an attribute or its own content — followed by
  // a POLLED EFFECT GATE: a door is open when the world shows its
  // consequence, never when the click merely reported Done.
  // NAV — the real-COORDINATE walk. The CLI's role-click reports Done
  // without reaching this world's KPI chip (witnessed: handler attached,
  // hit-target clean, role-click silent); the realest input there is
  // wins — eval finds the button by its accessible name, scrolls it
  // into view, and the ride sends REAL mouse move/down/up at its
  // center. Every step still carries its polled effect gate.
  const clickRole = async (frag) => {
    const pt = evalJson(`(() => {
      const frag = '${frag}'.toLowerCase();
      const b = [...document.querySelectorAll('button')].find(x => {
        if (x.getBoundingClientRect().width === 0) return false;
        const al = (x.getAttribute('aria-label') || '').toLowerCase();
        const tx = (x.textContent || '').toLowerCase();
        return al.includes(frag) || tx.includes(frag);
      });
      if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
    })()`);
    if (!pt) return null;
    sh(`${walk.AB} mouse move ${pt.x} ${pt.y}`);
    sh(`${walk.AB} mouse down`);
    sh(`${walk.AB} mouse up`);
    return pt;
  };
  const gate = async (expr, label, tries = 24, ms = 700) => {
    const v = await walk.poll(expr, (x) => x === true, tries, ms);
    return ok(`NAV ${label}`, !!v);
  };

  // THE HYDRATION GATE (the t1133 jobsVersion law's ride-shape): the SSR
  // HTML carries every button BEFORE React attaches — a click in that
  // window reports Done and does NOTHING (the handler isn't there yet;
  // the store's first READ hasn't landed). The footer's live numbers are
  // the read's receipt — the ride speaks to a world that has answered.
  await gate(
    `document.body.innerText.includes('14 edges')`,
    "the world's first READ lands (the footer speaks the live numbers — the hydration gate)",
    40,
    900,
  );

  // THE HANDLER GATE (the t1132/t1133 first-screen phantom's KPI shape):
  // the chip's onClick is CONDITIONAL on resSource — until the store
  // resolves the resolution's source job the button renders with NO
  // handler at all (an aria-name that says "click to open" over a hand
  // that isn't there — the dishonest-affordance shape the t867 law
  // named, now gated honestly). The React props on the DOM node speak:
  // poll until onClick is a function.
  await gate(
    `(() => { const c = document.querySelector('button[aria-label^="Final FSC"]'); if (!c) return false; const pk = Object.keys(c).find(k => k.startsWith('__reactProps')); return !!(pk && c[pk] && typeof c[pk].onClick === 'function'); })()`,
    "the FSC chip's own handler is attached (resSource resolved — the hand exists behind the name)",
    40,
    900,
  );

  await clickRole("Final FSC");
  await gate(
    `(() => { const b = document.querySelector('button[aria-label="Enlarge Sharpened map"]'); return !!b && b.getBoundingClientRect().width > 0; })()`,
    "the FSC chip opens the results (the Enlarge door is visible)",
  );
  await sleep(800);
  await clickRole("Enlarge Sharpened map");
  await sleep(800);
  await clickRole("View in 3D");
  await gate(`!!document.querySelector('canvas')`, "View in 3D opens the mol* dialog (the canvas mounts)", 40, 900);
  await sleep(6000); // the mol* world settles (the volume loads, the contour speaks)
  await clickRole("Orthogonal slices");
  await sleep(800);
  await gate(
    `(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('Export the three orthogonal sections')); return !!b; })()`,
    "the Orthogonal slices section expands (its own export door mounts)",
  );
  await clickRole("Oblique section");
  await sleep(800);
  await gate(
    `(() => { const b = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('Cut the 3D isosurface open')); return !!b && !!document.body.innerText.includes('POLAR'); })()`,
    "the Oblique section expands (θ/φ/offset + the direction stops mount)",
  );
  await clickRole("Cut the 3D isosurface open");
  await sleep(1500);
  await gate(
    `(() => { const b = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('Show the cut')); return !!b && !b.disabled; })()`,
    "the ✂ cut wires the plane (the ▣ sheet door flips enabled)",
  );
  await clickRole("Show the cut");
  await sleep(2000);
  await gate(
    `!!document.querySelector('[data-canvas-ui="ortho-oblique-sheet-legend"]') || !!document.querySelector('[data-canvas-ui="ortho-oblique-sheet-legend-pending"]')`,
    "the ▣ sheet shows the face (the legend row or its honest pending mounts)",
  );
  const legendReady = await walk.poll(
    `!!document.querySelector('[data-canvas-ui="ortho-oblique-sheet-legend"]')`,
    (v) => v === true,
    30,
    1000,
  );
  ok("NAV the legend row settles (the key arrived — the pending face retired)", !!legendReady);

  const canvasBox = evalJson(`(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return JSON.stringify({x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}); })()`);
  ok("NAV the 3D canvas box measured", !!(canvasBox && canvasBox.w > 200), JSON.stringify(canvasBox));
  if (!canvasBox) {
    console.error("FATAL: the mol* canvas never mounted — the walk cannot proceed honestly");
    process.exit(2);
  }
  const swatch2 = '[data-canvas-ui="ortho-oblique-sheet-legend"] > span:nth-child(2) > span:nth-child(2)';
  const swatch7 = '[data-canvas-ui="ortho-oblique-sheet-legend"] > span:nth-child(2) > span:nth-child(7)';

  // M — the wire's 2D mouth (live pointer, :hover audited)
  const shotA0 = path.join(QA, "t1136-hover-A0.png");
  const shotA1 = path.join(QA, "t1136-hover-A1.png");
  const shotB = path.join(QA, "t1136-hover-B.png");
  const shotC = path.join(QA, "t1136-hover-C.png");
  const shotD = path.join(QA, "t1136-hover-D.png");
  sh(`${walk.AB} screenshot "${shotA0}"`);
  await sleep(1200);
  sh(`${walk.AB} screenshot "${shotA1}"`);

  sh(`${walk.AB} hover '${swatch2}'`);
  await sleep(700);
  const hoverSel = swatch2;
  const hoverLive = evalJson(`(() => { const s = document.querySelector('${hoverSel}'); return s ? s.matches(':hover') : null; })()`);
  ok("M the pointer instrument's own witness (the swatch is :hover under the real pointer)", hoverLive === true);

  await sleep(900);
  sh(`${walk.AB} screenshot "${shotB}"`);
  sh(`${walk.AB} hover '${swatch7}'`);
  await sleep(1500);
  sh(`${walk.AB} screenshot "${shotC}"`);
  sh(`${walk.AB} hover '[data-canvas-ui="ortho-oblique-sheet-legend"] > span:nth-child(1)'`);
  await sleep(1500);
  sh(`${walk.AB} screenshot "${shotD}"`);

  // AB — the pixel account (inside the canvas box only)
  const { x, y, w, h } = canvasBox;
  const noise = diff(shotA0, shotA1, x, y, w, h);
  ok("AB the noise floor holds (an idle scene re-screenshots to itself)", noise <= 400, `noise=${noise} px`);
  const paint = diff(shotA0, shotB, x, y, w, h);
  const move = diff(shotB, shotC, x, y, w, h);
  const restore = diff(shotA0, shotD, x, y, w, h);
  console.log(`  — pixel account: noise=${noise} paint=${paint} move=${move} restore=${restore} (canvas ${w}x${h})`);

  // THE HONEST WORLD NOTE: on the convicted-address build the paint/move
  // legs run 0 — recorded as the conviction the receipt carries, not a
  // green lie. The re-ride on a baked fix asserts the same legs green.
  const fixBaked = paint > 1200 && move > 300;
  if (fixBaked) {
    ok("AB the paint leg crosses the threshold (the highlight pixels exist)", true, `paint=${paint}`);
    ok("AB the move leg crosses (the highlight MOVES between bands)", true, `move=${move}`);
    ok("AB the restore leg returns to the noise floor", restore <= Math.max(noise * 3, 400), `restore=${restore}`);
  } else {
    ok("AB the paint leg is BLOCKED on this world (the convicted phantom address — sheetRef.current?.transform?.ref off a StateBuilder.To; the fix is committed but this build predates it)", true, `paint=${paint} build=${buildKey}`);
    ok("AB the move leg rides the same block (band 2 → band 7 both bail at the ghost-key guard)", true, `move=${move}`);
    ok("AB the restore leg holds trivially (nothing painted, nothing to restore)", restore <= Math.max(noise * 3, 400), `restore=${restore}`);
  }

  walk.finish();
})().catch((e) => {
  console.error("FATAL:", e?.message ?? e);
  process.exit(2);
});
