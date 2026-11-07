#!/usr/bin/env node
/**
 * t997 — the KEYBOARD-VALUETEXT unit (node-only): the value plane's
 * voice cure, pinned at the source. The spec read found t991's road
 * half-spoken: aria-valuenow hands a screen reader a bare pixel count
 * ("360") — a number with no unit, no axis, no wall; and at the clamp
 * walls the shrinking/growing press is EATEN SILENTLY (Math.max +
 * clampGeo do their work with no face speaking) — the keyboard road's
 * own refusal was the one face the t982 zoom-clamp dialect had never
 * seated on a separator.
 *
 * THE CURE (what this unit pins — VOICE-ONLY, zero behavior change):
 *  - aria-valuetext on BOTH grips carries the human shape
 *    ("宽度 560 像素" / "高度 760 像素") instead of the opaque count;
 *  - the valuetext FLIPS at the walls: the FLOOR face
 *    ("已到最小宽度（360 像素）") when the axis sits at GEO_MIN,
 *    the CEILING face ("已到最大宽度（N 像素）") when it sits at the
 *    clampGeo viewport ceiling (vw-16 / vh-16, floored at GEO_MIN) —
 *    the same symmetric wall-honesty the t982 zoom family speaks;
 *  - the floor faces name the CONSTANT (GEO_MIN_W / GEO_MIN_H
 *    interpolated), never a magic number;
 *  - the valuetext exists only when geo speaks (undefined until the
 *    boot restore lands) — no "宽度 null 像素" ghost;
 *  - aria-valuemax rides the same ceiling formula — the window-splitter
 *    pattern's other half, never spoken before;
 *  - the arithmetic is UNTOUCHED: keyResize still steps ±16 through
 *    Math.max(GEO_MIN_*, …) and the SAME clampGeo the pointer drag
 *    rides (the t991 unit's needles stay green — the cure adds voice,
 *    never moves a wall).
 *
 *   node scripts/unit-runner.mjs scripts/t997-keyboard-valuetext-unit.mjs
 *
 * t999 RE-KEY: the voices' words moved into the wFace/hFace builders
 * (the pointer road's live echo reads the same strings — one mouth,
 * two roads), so the voice needles ride the builders' bodies and the
 * ride is pinned in the same needle. The count is unchanged (45) —
 * a 1:1 re-point, no new asserts. The echo plane itself is the t999
 * unit's subject (scripts/t999-pointer-wall-echo-unit.mjs).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t997-keyboard-valuetext-unit.json";
const SRC = path.join(ROOT, "src", "components", "ai", "assistant-panel.tsx");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`); }
}

const src = readFileSync(SRC, "utf8");

/* ---- both grips carry the voice (the valuetext seat) ---- */
const eGripStart = src.indexOf('role="separator"\n              aria-orientation="vertical"');
const sGripStart = src.indexOf('role="separator"\n              aria-orientation="horizontal"');
const eGrip = eGripStart > 0 ? src.slice(eGripStart, src.indexOf("/>", eGripStart)) : "";
const sGrip = sGripStart > 0 ? src.slice(sGripStart, src.indexOf("/>", sGripStart)) : "";

/* the t999 re-key — the voices' ONE MOUTH: the three-branch words moved
   into the wFace/hFace builders (the pointer road's live echo reads the
   same strings), so the voice needles below ride the BODIES; the grips
   ride the builders. The strings themselves are the t997 words VERBATIM. */
const wFaceIdx = src.indexOf("const wFace = (w: number, vw: number)");
const hFaceIdx = src.indexOf("const hFace = (h: number, vh: number)");
const wFaceBody = wFaceIdx > 0 ? src.slice(wFaceIdx, src.indexOf(";", wFaceIdx)) : "";
const hFaceBody = hFaceIdx > 0 ? src.slice(hFaceIdx, src.indexOf(";", hFaceIdx)) : "";

ok("the E grip exists (the t991 road is still in the tree)", eGripStart > 0);
ok("the S grip exists (the t991 road is still in the tree)", sGripStart > 0 && sGripStart !== eGripStart);

ok("the E grip carries aria-valuetext", eGrip.includes("aria-valuetext={"));
ok("the S grip carries aria-valuetext", sGrip.includes("aria-valuetext={"));
ok("the E grip carries aria-valuemax (the pattern's other half)", eGrip.includes("aria-valuemax={"));
ok("the S grip carries aria-valuemax (the pattern's other half)", sGrip.includes("aria-valuemax={"));

/* ---- the human shape: the plain branch speaks axis + unit (the t999
 *      re-key: the words moved into the builders — the ONE MOUTH the
 *      pointer road's live echo reads too; the ride is pinned in the
 *      same needle) ---- */
ok("the E valuetext's plain branch speaks the width in human words (builder's mouth, grip rides it)",
  wFaceBody.includes("宽度 ${w} 像素") && eGrip.includes("wFace(geo.w, window.innerWidth)"));
ok("the S valuetext's plain branch speaks the height in human words (builder's mouth, grip rides it)",
  hFaceBody.includes("高度 ${h} 像素") && sGrip.includes("hFace(geo.h, window.innerHeight)"));

/* ---- the floor faces: the refusal names the CONSTANT, not a magic number
 *      (the t999 re-key: spoken from the builders' one mouth) ---- */
ok("the E floor face speaks 已到最小宽度 with the GEO_MIN_W constant",
  wFaceBody.includes("已到最小宽度（${GEO_MIN_W} 像素）"));
ok("the S floor face speaks 已到最小高度 with the GEO_MIN_H constant",
  hFaceBody.includes("已到最小高度（${GEO_MIN_H} 像素）"));

/* ---- the ceiling faces: the wall names the clampGeo viewport ceiling ---- */
ok("the E ceiling face speaks 已到最大宽度 with the viewport ceiling number",
  wFaceBody.includes("已到最大宽度（${Math.max(vw - 16, GEO_MIN_W)} 像素）"));
ok("the S ceiling face speaks 已到最大高度 with the viewport ceiling number",
  hFaceBody.includes("已到最大高度（${Math.max(vh - 16, GEO_MIN_H)} 像素）"));

/* ---- the wall tests ride the SAME ceiling formula as the spoken number
 *      (one arithmetic, spoken and compared — no two truths; the t999
 *      re-key moves the pins to the builders' bodies) ---- */
const eWall = "w >= Math.max(vw - 16, GEO_MIN_W)";
const sWall = "h >= Math.max(vh - 16, GEO_MIN_H)";
ok("the E ceiling test rides the same formula the face speaks", wFaceBody.includes(eWall));
ok("the S ceiling test rides the same formula the face speaks", hFaceBody.includes(sWall));
ok("the E valuemax rides the same formula too (three mentions, one truth)",
  eGrip.includes("aria-valuemax={geo ? Math.max(window.innerWidth - 16, GEO_MIN_W) : undefined}"));
ok("the S valuemax rides the same formula too (three mentions, one truth)",
  sGrip.includes("aria-valuemax={geo ? Math.max(window.innerHeight - 16, GEO_MIN_H) : undefined}"));

/* ---- the floor test: <= the constant (the wall owns equality; the
 *      t999 re-key: pinned at the builders' bodies) ---- */
ok("the E floor test owns equality (w <= GEO_MIN_W)", wFaceBody.includes("w <= GEO_MIN_W"));
ok("the S floor test owns equality (h <= GEO_MIN_H)", hFaceBody.includes("h <= GEO_MIN_H"));

/* ---- the ghost guard: no valuetext before the boot restore lands ---- */
ok("the E valuetext is undefined until geo speaks (no 宽度 null 像素 ghost)",
  eGrip.includes(": undefined"));
ok("the S valuetext is undefined until geo speaks (no 高度 null 像素 ghost)",
  sGrip.includes(": undefined"));
ok("the E valuemax is undefined until geo speaks too",
  eGrip.includes("geo ? Math.max(window.innerWidth - 16, GEO_MIN_W) : undefined"));
ok("the S valuemax is undefined until geo speaks too",
  sGrip.includes("geo ? Math.max(window.innerHeight - 16, GEO_MIN_H) : undefined"));

/* ---- the arithmetic is UNTOUCHED (the voice-only law) ---- */
const keyResizeIdx = src.indexOf("const keyResize = React.useCallback");
const keyResizeBody = keyResizeIdx > 0 ? src.slice(keyResizeIdx, src.indexOf("}, [raiseToFront]);", keyResizeIdx)) : "";
ok("keyResize still exists", keyResizeIdx > 0);
ok("keyResize still floors through Math.max(GEO_MIN_W, …) — the wall did not move",
  keyResizeBody.includes("Math.max(GEO_MIN_W, base.w + delta)"));
ok("keyResize still floors through Math.max(GEO_MIN_H, …) — the wall did not move",
  keyResizeBody.includes("Math.max(GEO_MIN_H, base.h + delta)"));
ok("keyResize still rides the SAME clampGeo the pointer drag rides",
  keyResizeBody.includes("clampGeo({ ...base, w, h }, vw, vh)"));
ok("keyResize still steps ±16 (the step size did not change)",
  keyResizeBody.includes('keyResize("w", e.key === "ArrowRight" ? 16 : -16)') ||
    src.includes('keyResize("w", e.key === "ArrowRight" ? 16 : -16)'));

/* ---- the t991 plane survives the cure (the additive law) ---- */
ok("the E grip's valuenow still speaks the live width", eGrip.includes("aria-valuenow={geo?.w}"));
ok("the S grip's valuenow still speaks the live height", sGrip.includes("aria-valuenow={geo?.h}"));
ok("the E grip's valuemin still floors at GEO_MIN_W", eGrip.includes("aria-valuemin={GEO_MIN_W}"));
ok("the S grip's valuemin still floors at GEO_MIN_H", sGrip.includes("aria-valuemin={GEO_MIN_H}"));
ok("the E grip is still tabbable", eGrip.includes("tabIndex={0}"));
ok("the S grip is still tabbable", sGrip.includes("tabIndex={0}"));
ok("the E grip still carries the pointer drag (beginDrag e)", eGrip.includes('beginDrag(e, "e")'));
ok("the S grip still carries the pointer drag (beginDrag s)", sGrip.includes('beginDrag(e, "s")'));
ok("the E grip's name is unchanged", eGrip.includes('aria-label="调整助手窗口宽度（左右方向键）"'));
ok("the S grip's name is unchanged", sGrip.includes('aria-label="调整助手窗口高度（上下方向键）"'));
ok("NO aria-hidden on the E separator (a focusable element never hides)", !eGrip.includes("aria-hidden"));
ok("NO aria-hidden on the S separator (a focusable element never hides)", !sGrip.includes("aria-hidden"));

/* ---- the dialect's family law: the valuetext is a THREE-branch voice
 *      (floor face / ceiling face / human shape) — the t999 re-key pins
 *      the branches at the builders' bodies, the ONE MOUTH both roads
 *      read ---- */
ok("the E valuetext is a three-branch voice (floor → ceiling → human)",
  (wFaceBody.match(/已到最小宽度/g) ?? []).length === 1 &&
    (wFaceBody.match(/已到最大宽度/g) ?? []).length === 1 &&
    (wFaceBody.match(/宽度 \$\{w\} 像素/g) ?? []).length === 1);
ok("the S valuetext is a three-branch voice (floor → ceiling → human)",
  (hFaceBody.match(/已到最小高度/g) ?? []).length === 1 &&
    (hFaceBody.match(/已到最大高度/g) ?? []).length === 1 &&
    (hFaceBody.match(/高度 \$\{h\} 像素/g) ?? []).length === 1);

/* ---- THE OWNERSHIP GUARD (the second cure, the walk's red-1/red-4
 *      find): the arrow-walk (Task 103) had listbox and tablist guards —
 *      "the component that owns focus owns the key" — but NO separator
 *      guard, so every grip press ALSO hopped the canvas selection and
 *      panned the viewport under the user's hand (and mounted whatever
 *      the landed card dragged in — +155 buttons mid-journey, and one
 *      ride's downstream chain took the companion panel itself down).
 *      The guard rides the same layering rule, one line beside its
 *      siblings. ---- */
const SHELL = path.join(ROOT, "src", "components", "workflow", "app-shell.tsx");
const shell = readFileSync(SHELL, "utf8");
const walkGuardIdx = shell.indexOf('if (tgt instanceof HTMLElement && tgt.closest(\'[role="tablist"]\')) return;');
ok("the arrow-walk's tablist guard exists (the t162 law still stands)", walkGuardIdx > 0);
const sepGuardIdx = shell.indexOf('if (tgt instanceof HTMLElement && tgt.closest(\'[role="separator"]\')) return;');
ok("the arrow-walk's SEPARATOR guard exists (the ownership law's third sibling)", sepGuardIdx > walkGuardIdx);
ok("the separator guard sits BEFORE the walk's preventDefault (the key is yielded, not stolen then acted)",
  sepGuardIdx > 0 && sepGuardIdx < shell.indexOf("e.preventDefault();", sepGuardIdx - 1) + 40);
ok("the separator guard carries the t997 marker (the story lives at the cure)", shell.includes("a FOCUSED WINDOW SEPARATOR owns the arrows too"));

/* ---- the receipt ---- */
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(
  path.join(ROOT, RECEIPT),
  JSON.stringify({ unit: "t997-keyboard-valuetext-unit", pass, fail, green: fail === 0, at: new Date().toISOString() }, null, 2)
);

console.log(`\nKEYBOARD-VALUETEXT-UNIT t997: ${pass}/${pass + fail} ${fail === 0 ? "green — the value plane speaks, the walls are named, the arithmetic untouched" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
