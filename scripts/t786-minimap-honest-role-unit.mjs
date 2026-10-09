/**
 * t786-minimap-honest-role-unit — the minimap retires the role=application
 * lie: a pointer instrument confesses to being a picture.
 *
 * The old world, judged live (t784 scouting + t786 surgery): the SVG wore
 * role="application" — telling screen readers an application-mode keyboard
 * surface lived here — while it has no tabIndex, no key handlers, and
 * pointer-only wiring. An SR user who trusted the role switched into app
 * mode and found silence. The t784 scouting verdict stands: no keyboard
 * roaming will be built (the canvas itself, palette, find bar and grid-nav
 * are the keyboard's doors — a second navigation path needs a second
 * maintenance), so the semantics must confess instead of promising.
 * role="img" claims what the map truly is: a labeled picture you look at;
 * the label now leads with the pointer-instrument confession and points
 * keyboard users to the canvas's own door.
 *
 *   A  the honest role — role="img" stands, role="application" is gone
 *      (judged on the stripped channel where comments are silent), the
 *      verdict note leads its block on the raw channel (single-line
 *      anchors only — the t781/t783 anchor lesson).
 *   B  the pointer instrument's confession — the label leads with the
 *      pointer-instrument prefix, names the canvas as the keyboard door,
 *      and all four branch tails survive verbatim (the lens-state labels
 *      still speak find/sel focus).
 *   C  the old contracts untouched — the contextmenu swallow still guards
 *      the touch long-press (t783 C4's twin), the viewBox still IS the
 *      canvas coordinate system, the cursor-pointer face, the map's own
 *      testid.
 *   D  the keyboard face it does NOT touch — the framing group stays a
 *      real button row (role=group + aria-pressed toggles), and the SVG
 *      itself carries zero tabIndex (a picture holds no focus).
 *   E  the history in the margins — the t784 scouting verdict quoted, the
 *      t743 borrowed-ink law and Task 176's desktop-instrument note still
 *      on the record.
 *
 * Run:  node scripts/t786-minimap-honest-role-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let pass = 0;
let fail = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(label);
  }
};

const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const strip = (s) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join("\n");
const norm = (s) => s.replace(/\s+/g, " ");

const mmRaw = read("src/components/workflow/canvas-minimap.tsx");
const mm = strip(mmRaw);
const mmNorm = norm(mmRaw);

/* ------------------------------------------------------------------ */
/* A — the honest role                                                 */
/* ------------------------------------------------------------------ */

// A1 — the picture claims itself: role="img" on the SVG (the stripped
// channel — code word-forms only, comments are silent here).
ok(mm.includes('role="img"'),
  "A1 the SVG wears role=img (the picture's own role)");

// A2 — the lie is retired: role="application" is gone from the code
// (the comment channel may quote it; the live attribute must not).
ok(!mm.includes('role="application"'),
  "A2 role=application is retired from the code (zero hits on the stripped channel)");

// A3 — the verdict note leads the block on the raw channel: WHY the role
// changed must live beside the change (single-line word-form anchor).
ok(mmNorm.includes("the honest role"),
  "A3 the verdict note is on the record (the honest role)");

// A4 — the note names the failure mode and the cure: a promise of a
// keyboard that will never come is the thing being retired.
ok(mmNorm.includes("promising a keyboard that will never come"),
  "A4 the note names the retired promise (never-come keyboard)");

/* ------------------------------------------------------------------ */
/* B — the pointer instrument's confession                             */
/* ------------------------------------------------------------------ */

// B1 — the label leads with the instrument's confession: pointer-only,
// said out loud where the old label said nothing about its own limits.
ok(mm.includes("Pointer instrument — workflow overview:"),
  "B1 the label confesses the pointer instrument");

// B2 — keyboard users are pointed to the real door: the canvas itself,
// not this map (the t784 verdict's honest redirect).
ok(mm.includes("The canvas itself is the keyboard door; this map answers the mouse only"),
  "B2 the label names the canvas as the keyboard's door");

// B3 — all four lens-state tails survive verbatim: the find lens and the
// sel focus still speak through the label (count the tails, 4).
const tails = [
  "click an amber or selected chip to jump to that job.",
  "click an amber chip to jump to that match.",
  "click a selected chip to jump to that job.",
  "Click to navigate.",
];
for (const t of tails) ok(mm.includes(t), `B3 the label tail survives: "${t.slice(0, 32)}..."`);

/* ------------------------------------------------------------------ */
/* C — the old contracts untouched                                     */
/* ------------------------------------------------------------------ */

// C1 — the contextmenu swallow still guards the touch long-press (the
// t783 C4 contract, unchanged by the role surgery).
ok(/contextmenu/.test(mm), "C1 the minimap's contextmenu guard stands");

// C2 — the map's own testid: the live body can still find the SVG.
ok(mm.includes('data-canvas-ui="minimap-svg"'),
  "C2 the map's testid stands (minimap-svg)");

// C3 — the viewBox IS the canvas coordinate system: the map draws in
// workspace coordinates for free (the founding contract).
ok(mm.includes("viewBox={`") && mm.includes("${world.x} ${world.y} ${world.w} ${world.h}`}"),
  "C3 the viewBox is still the canvas coordinate system");

// C4 — the pointer face: a cursor-pointer instrument looks like one.
ok(mm.includes("cursor-pointer"), "C4 the pointer cursor face stands");

/* ------------------------------------------------------------------ */
/* D — the keyboard face it does NOT touch                             */
/* ------------------------------------------------------------------ */

// D1 — the framing group stays a real button row: the header's segmented
// control is the map's honest keyboard surface (buttons, not the SVG).
ok(mm.includes('role="group"') && mm.includes("Minimap framing mode"),
  "D1 the framing group keeps its role + label");

// D2 — the toggles keep their pressed state: the settle contract's CSS
// key reads aria-pressed (the segmented control's own law).
ok(/aria-pressed=\{/.test(mm), "D2 the framing toggles keep aria-pressed");

// D3 — a picture holds no focus: the SVG carries zero tabIndex anywhere
// (the honest role's other half — img is not focusable, and nothing
// pretends otherwise).
ok(!/tabIndex/.test(mm), "D3 the SVG carries zero tabIndex (a picture holds no focus)");

/* ------------------------------------------------------------------ */
/* E — the history in the margins                                      */
/* ------------------------------------------------------------------ */

// E1 — the note quotes the verdict that booked this debt: t784's scouting
// said "record the hygiene, do not build the roaming".
ok(mmNorm.includes("the t784 scouting"),
  "E1 the t784 scouting verdict is quoted");

// E2 — the borrowed-ink law still on the record: the map's wires borrow
// the canvas's ink (t743) — history survives the surgery.
ok(mmNorm.includes("the borrowed ink"),
  "E2 the t743 borrowed-ink law still on the record");

// E3 — the desktop-instrument note still on the record (Task 176): the
// map's responsive contract predates and outlives the role fix.
ok(mmNorm.includes("DESKTOP instrument"),
  "E3 the Task 176 desktop-instrument note still on the record");

/* ------------------------------------------------------------------ */

console.log(`\nt786-minimap-honest-role-unit: ${pass} passed, ${fail} failed`);
if (fails.length) {
  console.log("failures:");
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
