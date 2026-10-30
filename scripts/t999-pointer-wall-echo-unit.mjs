#!/usr/bin/env node
/**
 * t999 — the POINTER WALL ECHO unit (node-only): the resize grips'
 * POINTER road joins the value plane's voice. The t997 cure taught the
 * KEYBOARD road's valuetext the three-branch words; the pointer drag
 * rode the SAME clamp walls silently — the hand parks at the floor or
 * the ceiling and nothing says so (the grip's valuetext updates, but a
 * pointer drag's focus/announcement path never speaks it).
 *
 * THE CURE (what this unit pins — VOICE-ONLY, the arithmetic untouched):
 *  - the wFace/hFace BUILDERS — the wall's ONE MOUTH: the three-branch
 *    words (floor / ceiling / human shape) live ONCE, verbatim the t997
 *    strings, and BOTH roads read them (the grips' valuetext on focus,
 *    the drag-end echo through role="status");
 *  - the drag-end ECHO in onUp: a drag that PARKS at a clamp wall
 *    speaks that wall's face — once per gesture at its end (the t638
 *    echo law's live-region form; mid-drag announcements would flood),
 *    the plain shape stays silent (the hand saw it follow), the wall
 *    test sniffs the builder's own refusal prefix (已到) — never a
 *    second arithmetic;
 *  - the live region: data-wall-echo, role="status", aria-live="polite",
 *    visually silent (sr-only), seated after the se grip inside the
 *    desktop fragment;
 *  - the mode gating: e/se speak the width face, s/se the height face,
 *    se joins both with "，";
 *  - the ARITHMETIC UNTOUCHED: onMove still floors through
 *    Math.max(GEO_MIN_*, …) and rides the SAME clampGeo; the grips'
 *    valuemax formulas stand (the t997 plane's other half).
 *
 * THE CENSUS TRIPWIRE (C1–C6, live): the cure touched
 * assistant-panel.tsx whose tags live in the disabled-refusal census —
 * the tripwire re-runs the census and pins the tallies UNMOVED
 * (population 171, stateful 116, silent-static 30, silences 55, the
 * story slots): the grips carry no disabled prop and the echo region
 * is not an interactive tag — the no-shift ruling, live.
 *
 * THE RIDE-SIDE BAND (R1–R8, the t1084 growth — the 23+-window carried
 * candidate): the Q-band's 16 needles pin the SOURCE; the walk's receipt
 * is the RIDE's own evidence, and until t1084 nothing pinned it — a stale
 * or red walk could hide behind a green unit. The R-band reads
 * shots-qa/t999-pointer-wall-echo-walk.json (the walk's own receipt, a
 * tracked artifact) and pins the RIDE: the identity (instrument + born),
 * the zero-red full leg set (fail === 0, pass >= 30 — the walk's current
 * leg grammar), the FULL axis set present (viewport, both width walls,
 * both height walls, the mid park, the se join), each wall's echo
 * AGREEING with the builders' own words (the width/height floors pinned
 * at the GEO_MIN constants, the ceilings derived from the receipt's OWN
 * viewport — no second arithmetic), the SE JOIN's combined face in the
 * source's word order (width，height), the mid park's no-word law, and
 * the leave-no-trace pair (the stored geometry restored, the world
 * fingerprint unmoved) — the walk's honest bookkeeping, pinned where the
 * unit can see it. A red or shrunken walk now turns the unit RED: the
 * ruler follows the ride.
 *
 *   node scripts/t999-pointer-wall-echo-unit.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CENSUS = path.join(ROOT, "scripts/t982-aria-refusal-census.mjs");
const TMP = path.join(ROOT, "shots-qa/.t999-unit-receipt.json");
const PANEL = "src/components/ai/assistant-panel.tsx";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* C1–C6 — the census tripwire runs FIRST (the t998 unit's law) */
let receipt = null;
try {
  execFileSync("node", [CENSUS, "--receipt", TMP], { encoding: "utf8", timeout: 60_000 });
  receipt = JSON.parse(readFileSync(TMP, "utf8"));
} catch (e) {
  console.log(`  ✗ the census child process — ${String(e).slice(0, 200)}`);
  fail++;
}
try { unlinkSync(TMP); } catch {}

ok("C1 the census's population gate stands (the disabled-refusal law)",
  (() => { try { return readFileSync(path.join(ROOT, "scripts/t982-aria-refusal-census.mjs"), "utf8").includes("if (!/\\bdisabled=\\{/.test(text)) continue;"); } catch { return false; } })());
ok("C2 population = 173 (the grips carry no disabled prop — the no-shift ruling, live; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name)",
  receipt?.population === 173, `got ${receipt?.population}`);
ok("C3 stateful = 151 (the panel's population tags unmoved; +30 from the t1005 refusal-name arm, +3 from the t1008 dynamic names, +1 from the t1096 filmstrip walk name, +1 from the t1098 ortho walk name)",
  receipt?.tally?.stateful === 151, `got ${receipt?.tally?.stateful}`);
ok("C4 silent-static = 0 (the echo region is not an interactive tag; the t1005 arm emptied the bucket)",
  receipt?.tally?.["silent-static"] === 0, `got ${receipt?.tally?.["silent-static"]}`);
ok("C5 silences = 22 (the flip bucket only — the t1005 arm retired the static half, the t1008 arm spoke three honest names)",
  receipt?.silences === 22, `got ${receipt?.silences}`);
ok("C6 the story slots hold (flip 17 · var 2 · component 1 · blind 0 · vendor 2 · unnamed 0) — flip 20 → 17: the t1008 arm moved three honest-name flips into stateful",
  receipt?.storyTally?.flip === 17 && receipt?.storyTally?.var === 2 &&
  receipt?.storyTally?.component === 1 && (receipt?.storyTally?.blind ?? 0) === 0 &&
  receipt?.storyTally?.vendor === 2 && (receipt?.storyTally?.unnamed ?? 0) === 0,
  `flip=${receipt?.storyTally?.flip} var=${receipt?.storyTally?.var} vendor=${receipt?.storyTally?.vendor}`);

const src = (() => { try { return readFileSync(path.join(ROOT, PANEL), "utf8"); } catch { return ""; } })();

/* Q1–Q4 — the builders: the wall's ONE MOUTH */
const wFaceIdx = src.indexOf("const wFace = (w: number, vw: number): string =>");
const hFaceIdx = src.indexOf("const hFace = (h: number, vh: number): string =>");
const wFaceBody = wFaceIdx > 0 ? src.slice(wFaceIdx, src.indexOf(";", wFaceIdx)) : "";
const hFaceBody = hFaceIdx > 0 ? src.slice(hFaceIdx, src.indexOf(";", hFaceIdx)) : "";
ok("Q1 the wFace and hFace builders exist (module level, one mouth)",
  wFaceIdx > 0 && hFaceIdx > 0 && wFaceIdx < hFaceIdx);
ok("Q2 the width builder speaks the three t997 words VERBATIM (floor / ceiling / human)",
  wFaceBody.includes("已到最小宽度（${GEO_MIN_W} 像素）") &&
  wFaceBody.includes("已到最大宽度（${Math.max(vw - 16, GEO_MIN_W)} 像素）") &&
  wFaceBody.includes("宽度 ${w} 像素"));
ok("Q3 the height builder speaks the three t997 words VERBATIM (floor / ceiling / human)",
  hFaceBody.includes("已到最小高度（${GEO_MIN_H} 像素）") &&
  hFaceBody.includes("已到最大高度（${Math.max(vh - 16, GEO_MIN_H)} 像素）") &&
  hFaceBody.includes("高度 ${h} 像素"));
ok("Q4 the builders ride the clamp formulas (floor owns equality, ceiling the viewport−16)",
  wFaceBody.includes("w <= GEO_MIN_W") && wFaceBody.includes("w >= Math.max(vw - 16, GEO_MIN_W)") &&
  hFaceBody.includes("h <= GEO_MIN_H") && hFaceBody.includes("h >= Math.max(vh - 16, GEO_MIN_H)"));

/* Q5–Q6 — the grips ride the builders (the one-mouth law's keyboard face) */
const eGripStart = src.indexOf('role="separator"\n              aria-orientation="vertical"');
const sGripStart = src.indexOf('role="separator"\n              aria-orientation="horizontal"');
const eGrip = eGripStart > 0 ? src.slice(eGripStart, src.indexOf("/>", eGripStart)) : "";
const sGrip = sGripStart > 0 ? src.slice(sGripStart, src.indexOf("/>", sGripStart)) : "";
ok("Q5 the E grip's valuetext rides the builder",
  eGrip.includes("aria-valuetext={geo ? wFace(geo.w, window.innerWidth) : undefined}"));
ok("Q6 the S grip's valuetext rides the builder",
  sGrip.includes("aria-valuetext={geo ? hFace(geo.h, window.innerHeight) : undefined}"));

/* Q7–Q12 — the drag-end echo (the pointer road's new voice) */
ok("Q7 the echo state exists (the live region's message)", src.includes('const [wallEcho, setWallEcho] = React.useState("")'));
ok("Q8 the echo gates on the resize modes (e/se width, s/se height)",
  src.includes('d.mode === "e" || d.mode === "se"') && src.includes('d.mode === "s" || d.mode === "se"'));
ok("Q9 the wall test sniffs the builder's own refusal prefix (已到), both axes, never a second arithmetic",
  (src.match(/face\.startsWith\("已到"\)/g) ?? []).length === 2);
ok("Q10 the echo lands once (words joined with 、-less comma, set only when non-empty)",
  src.includes("if (words.length > 0) setWallEcho(words.join(\"，\"));"));
ok("Q11 the echo's gates are the moved drag and the live shape",
  src.includes("if (dragMovedRef.current && geoRef.current) {"));
ok("Q12 the echo reads the builders (one mouth — the same words the keyboard road reads)",
  src.includes("wFace(g.w, window.innerWidth)") && src.includes("hFace(g.h, window.innerHeight)"));

/* Q13–Q14 — the live region (the seat) */
ok("Q13 the live region stands (data-wall-echo, role=status, aria-live, sr-only, the message)",
  src.includes('<span data-wall-echo="" role="status" aria-live="polite" className="sr-only">') &&
  src.includes("{wallEcho}"));
ok("Q14 the region sits after the se grip (inside the desktop fragment, the drags' home)",
  src.indexOf("cursor-nwse-resize") > 0 && src.indexOf("data-wall-echo") > src.indexOf("cursor-nwse-resize"));

/* Q15–Q16 — the arithmetic untouched (the voice-only law) */
ok("Q15 onMove's resize arithmetic is untouched (the walls did not move)",
  src.includes("Math.max(GEO_MIN_W, d.start.w + dx)") &&
  src.includes("Math.max(GEO_MIN_H, d.start.h + dy)") &&
  src.includes("clampGeo({ ...base, w, h }, vw, vh)"));
ok("Q16 the grips' valuemax formulas stand (the t997 plane's other half, unmoved)",
  eGrip.includes("aria-valuemax={geo ? Math.max(window.innerWidth - 16, GEO_MIN_W) : undefined}") &&
  sGrip.includes("aria-valuemax={geo ? Math.max(window.innerHeight - 16, GEO_MIN_H) : undefined}"));

/* R1–R8 — the ride-side band (the t1084 growth): the WALK's receipt is
 * evidence now. The walk rode 30/0 twice at t1003 and again this window;
 * nothing pinned it. A red, shrunken, or structurally-degraded ride turns
 * the unit RED — the ruler follows the ride. */
const WALK_RECEIPT = "shots-qa/t999-pointer-wall-echo-walk.json";
const ride = (() => {
  try { return JSON.parse(readFileSync(path.join(ROOT, WALK_RECEIPT), "utf8")); }
  catch { return null; }
})();
const GEO_MIN_W_PIN = 360; // the walk's own constants (the panel's GEO_MIN_W/H)
const GEO_MIN_H_PIN = 420;
const legs = ride?.legs ?? {};
const vw = legs.viewport?.vw ?? null;
const vh = legs.viewport?.vh ?? null;
ok("R1 the walk's receipt exists and names the instrument (the ride's identity, tracked)",
  ride?.walk === "t999-pointer-wall-echo-walk" && ride?.born === "2026-10-15",
  ride ? `at=${ride.at}` : "receipt missing/unparseable");
ok("R2 the last ride is zero-red at the full leg set (fail === 0, pass >= 30)",
  ride?.fail === 0 && ride?.pass >= 30,
  `pass=${ride?.pass} fail=${ride?.fail}`);
ok("R3 the legs carry the FULL axis set (viewport · both width walls · both height walls · the mid park · the se join)",
  legs.viewport != null && legs.floor != null && legs.ceiling != null &&
  legs.midPark != null && legs.sFloor != null && legs.sCeiling != null && legs.seJoin != null,
  `vw=${vw} vh=${vh}`);
ok("R4 the width walls' echoes agree with the builders' words on film (floor pinned at GEO_MIN_W, ceiling from the receipt's own viewport)",
  legs.floor?.echo === `已到最小宽度（${GEO_MIN_W_PIN} 像素）` &&
  legs.ceiling?.echo === `已到最大宽度（${vw - 16} 像素）` &&
  legs.floor?.agreed === true && legs.ceiling?.agreed === true,
  `floor="${legs.floor?.echo}" ceiling="${legs.ceiling?.echo}"`);
ok("R5 the height walls' echoes agree too (the second axis on film, same one mouth)",
  legs.sFloor?.echo === `已到最小高度（${GEO_MIN_H_PIN} 像素）` &&
  legs.sCeiling?.echo === `已到最大高度（${vh - 16} 像素）` &&
  legs.sFloor?.agreed === true && legs.sCeiling?.agreed === true,
  `sFloor="${legs.sFloor?.echo}" sCeiling="${legs.sCeiling?.echo}"`);
ok("R6 the SE JOIN speaks both walls in one breath, the source's word order (width，height)",
  legs.seJoin?.joined === true &&
  legs.seJoin?.echo === `${legs.floor?.echo}，${legs.sFloor?.echo}` &&
  legs.seJoin?.w === GEO_MIN_W_PIN && legs.seJoin?.h === GEO_MIN_H_PIN,
  `join="${legs.seJoin?.echo}"`);
ok("R7 the mid park added no word (only the refusal is news — the echo held the ceiling's face)",
  legs.midPark?.echoUnchanged === true && legs.midPark?.text != null,
  `text="${legs.midPark?.text}"`);
ok("R8 the leave-no-trace law held on film (the stored geometry restored, the world fingerprint unmoved)",
  legs.storedEcho?.restored === true && legs.worldRestored === true,
  `restored=${legs.storedEcho?.restored} world=${legs.worldRestored}`);

console.log(`VERDICT: ${fail === 0 ? `GREEN ${pass}/${pass + fail}` : `RED ${pass}/${pass + fail}`}`);
console.log(`${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
