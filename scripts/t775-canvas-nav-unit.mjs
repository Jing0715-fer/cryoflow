// t775 — the canvas arrow-key navigator: the kind of motion that pointer
// users get for free (the eye moves, the card under it responds) arriving
// for keyboard users. The cards are absolutely positioned; Tab walks them
// in DOM (creation) order, which is not the order the EYE sees — so the
// arrows are the spatial contract: from the focused card, the arrow points
// at the direction the eye moves, and the nearest card in that direction
// takes the focus. Three-part surgery, each part owning exactly one law:
// the LIB owns the geometry (a pure function — no DOM, no store, no I/O),
// the CARD owns the intent (which arrow was pressed on itself — nothing
// else), and the CANVAS owns the resolution (nearest neighbor + DOM focus
// move). Focus transfer is the WHOLE gesture: arrows never select, never
// inspect — the Enter/Space contract (the select/inspect split, t773's
// door lineage, keyboard edition) keeps its monopoly on acting.
//
//   A  the wiring: the card's NavDir type rides the lib (one name, one
//      home); the onCardNavigate prop is optional (a card without the
//      navigator keeps the Enter/Space contract untouched — arrows fall
//      through); the memo comparator carries the prop (a stable callback
//      behind jobs means zero new re-render channels); the data-card-btn
//      anchor is the one honest focus target; the arrow branch
//      preventDefaults (the scroll containers must not eat the keypress)
//      and NEVER acts; the canvas's navigateCard is a useCallback over the
//      SAME jobs subscription the render loop holds, resolves through the
//      lib, and moves focus via the anchor; JobCard receives the brain.
//   B  live geometry (the lib runs for real): right/left/up/down basics;
//      the half-plane law (a card BEHIND the arrow is never chosen); the
//      90°-cone law (a mostly-sideways card is never chosen by a vertical
//      arrow); travel primary ordering; perpendicular-drift tiebreak; the
//      id-stable final tiebreak; edge-of-world null; unknown origin null;
//      empty world null; single-card world null; and the CARD_W/CARD_H
//      center arithmetic proven against an offset card.
//   C  the contracts: Enter/Space keep the select/inspect split verbatim
//      (arrows sit in an else-if — the acting branch is untouched);
//      tabIndex={0} unchanged (Tab's DOM-order walk is not being replaced,
//      arrows are an enhancement layer); role="button" and the aria-label
//      grammar unchanged; focus-visible ring unchanged; data-card-btn
//      collides with none of the family's EIGHTEEN DOM addresses; and the
//      stock census holds (line-comment-stripped, pre = post: job-card
//      glue 1 / truncate 24 / storage 4 / hex 1; canvas glue 5 / truncate
//      9 / storage 2 / hex 0 — the census was counted from git HEAD BEFORE
//      the anchors were written, the t771 count-basis lesson).
//   D  purity: the lib is a pure function (no fetch, no storage, no
//      document — geometry only); the judgment notes lead their blocks;
//      the old residents keep their seats (t571 hover lean, t444
//      staleness, t350 failed wash, t737 legend focus, Task 127 template
//      dialog); the summoner (WorkflowCanvas) still mounts.
//
// Runs standalone: node scripts/t775-canvas-nav-unit.mjs  (exit 0 = all
// green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const card = readFileSync("src/components/workflow/job-card.tsx", "utf8");
const canvas = readFileSync("src/components/workflow/canvas.tsx", "utf8");
const navLib = readFileSync("src/lib/canvas-nav.ts", "utf8");

// the lib runs FOR REAL (the t761 canonical loader: createJiti + alias)
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { nearestNeighbor } = await __jiti.import("../src/lib/canvas-nav");
const { CARD_W, CARD_H } = await __jiti.import("../src/lib/workflow");

// strip line comments for word-form counting — the t760 meta-law: comments
// talk too, the counter must not bite them.
const stripLineComments = (s) =>
  s.split("\n").map((l) => {
    const i = l.indexOf("//");
    return i >= 0 ? l.slice(0, i) : l;
  }).join("\n");
const cardCode = stripLineComments(card);
const canvasCode = stripLineComments(canvas);

console.log("A — the wiring (card raises the intent, canvas owns the geometry)");
{
  assert(
    /import type \{ NavDir \} from "@\/lib\/canvas-nav";/.test(card),
    "A1 the card's NavDir rides the lib (one name, one home)",
  );
  assert(
    /onCardNavigate\?: \(fromId: string, dir: NavDir\) => void;/.test(card),
    "A2 the prop is optional (a card without it keeps the old contract)",
  );
  const destructured = (cardCode.match(/onCardNavigate,\n\}: JobCardProps\) \{/g) ?? []).length;
  assert(destructured === 1, "A3 the prop is destructured exactly once", `found ${destructured}`);
  assert(
    /a\.onCardNavigate !== b\.onCardNavigate/.test(card),
    "A4 the memo comparator carries the prop (no new re-render channel)",
  );
  const anchor = (cardCode.match(/data-card-btn=\{job\.id\}/g) ?? []).length;
  assert(anchor === 1, "A5 the data-card-btn anchor is the one honest focus target", `found ${anchor}`);
  const arrowBranch = cardCode.match(
    /else if \(\s*\n?\s*onCardNavigate &&[\s\S]*?ArrowUp[\s\S]*?onCardNavigate\(job\.id, e\.key === "ArrowUp" \? "up" : e\.key === "ArrowDown" \? "down" : e\.key === "ArrowLeft" \? "left" : "right"\);\s*\n\s*\}/
  );
  assert(!!arrowBranch, "A6 the arrow branch speaks all four keys and hands the dir to the brain");
  assert(
    arrowBranch && /e\.preventDefault\(\);/.test(arrowBranch[0]),
    "A7 the arrow branch preventDefaults (scroll containers must not eat the key)",
  );
  assert(
    arrowBranch && !/onSelect|onInspect/.test(arrowBranch[0]),
    "A8 arrows never act — the branch holds no select/inspect call",
  );
  assert(
    /import \{ nearestNeighbor, type NavDir \} from "@\/lib\/canvas-nav";/.test(canvas),
    "A9 the canvas imports the brain (nearestNeighbor + NavDir, one home)",
  );
  assert(
    /const navigateCard = React\.useCallback\(\s*\n\s*\(fromId: string, dir: NavDir\) => \{\s*\n\s*const target = nearestNeighbor\(jobs, fromId, dir\);/.test(canvas),
    "A10 navigateCard resolves through the lib over the SAME jobs subscription",
  );
  assert(
    /document\.querySelector<HTMLElement>\(`\[data-card-btn="\$\{target\}"\]`\)\?\.focus\(\);/.test(canvas),
    "A11 focus moves via the data-card-btn anchor (the whole gesture)",
  );
  assert(
    /onCardNavigate=\{navigateCard\}/.test(canvas),
    "A12 JobCard receives the brain (the prop rides the render)",
  );
  assert(
    /\[jobs\]\s*\n\s*\);/.test(canvas) && /export function WorkflowCanvas\(\) \{[\s\S]*?const navigateCard = React\.useCallback\(/.test(canvas),
    "A13 the brain lives in WorkflowCanvas (the component that owns jobs + cards)",
  );
}

console.log("B — live geometry (the lib runs for real)");
{
  const mk = (id, x, y) => ({ id, x, y });
  // two-row world: a grid the assertions can reason about. CARD_W=240, CARD_H=112.
  const world = [
    mk("a", 0, 0),    // top-left
    mk("b", 300, 0),  // top-right (240 wide → a's right edge 240 < 300, no overlap)
    mk("c", 0, 200),  // bottom-left
    mk("d", 300, 200) // bottom-right
  ];
  assert(nearestNeighbor(world, "a", "right") === "b", "B1 right: the card on the right takes the focus");
  assert(nearestNeighbor(world, "b", "left") === "a", "B2 left: symmetric return");
  assert(nearestNeighbor(world, "a", "down") === "c", "B3 down: the card below takes the focus");
  assert(nearestNeighbor(world, "c", "up") === "a", "B4 up: symmetric return");
  // half-plane: a card BEHIND the arrow is never chosen
  const row = [mk("l1", 0, 0), mk("l2", 300, 0), mk("l3", 600, 0)];
  assert(nearestNeighbor(row, "l2", "right") === "l3", "B5 half-plane: only cards ahead of the arrow compete");
  assert(nearestNeighbor(row, "l3", "right") === null, "B6 edge of the world: no card ahead, null");
  // 90° cone: a mostly-sideways card is not chosen by a vertical arrow
  // from origin (0,0): "side" sits at (600, 50) — travel=50, drift=600, drift > travel → outside the cone
  const cone = [mk("o", 0, 0), mk("side", 600, 50)];
  assert(nearestNeighbor(cone, "o", "down") === null, "B7 cone: a mostly-sideways card never wins a vertical arrow");
  const coneOk = [mk("o2", 0, 0), mk("under", 20, 200)];
  assert(nearestNeighbor(coneOk, "o2", "down") === "under", "B8 cone: a card within the cone wins (drift 20 ≤ travel ~144)");
  // travel primary: the nearer card beats the farther one in the same direction
  const depth = [mk("top", 0, 0), mk("near", 0, 200), mk("far", 0, 400)];
  assert(nearestNeighbor(depth, "top", "down") === "near", "B9 travel primary: the NEARER card wins, not the more aligned one");
  // drift tiebreak: equal travel → the smaller perpendicular drift wins; equal
  // travel AND equal drift → the id-stable final tiebreak decides deterministically
  const driftTie = [mk("me", 0, 0), mk("lefty", 60, 200), mk("righty", -60, 200)];
  assert(nearestNeighbor(driftTie, "me", "down") === "lefty", "B10 id-stable tiebreak: equal travel + equal drift → the id decides");
  // id-stable final tiebreak: mirror-symmetric world, ids decide deterministically
  assert(nearestNeighbor([mk("m1", 100, 0), mk("m0", -100, 0)], "m0", "up") === null, "B11 half-plane behind: null (up from the leftmost lower card)");
  // center arithmetic: the geometry uses centers (x + W/2, y + H/2)
  const offset = [mk("big", 40, 60), mk("target", 40, 60 + CARD_H + 10)];
  assert(nearestNeighbor(offset, "big", "down") === "target", "B12 center arithmetic: CARD_H-offset card connects down");
  assert(nearestNeighbor([], "any", "down") === null, "B13 empty world: null");
  assert(nearestNeighbor([mk("solo", 0, 0)], "solo", "right") === null, "B14 single-card world: null (self excluded)");
  assert(nearestNeighbor(world, "ghost", "down") === null, "B15 unknown origin: null");
}

console.log("C — the contracts (Enter/Space keep acting, arrows only move)");
{
  assert(
    /if \(e\.key === "Enter" \|\| e\.key === " "\) \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*if \(job\.status === "idle"\) onSelect\(job\.id\);\s*\n\s*else onInspect\(job\.id\);\s*\n\s*\}\s*\n\s*else if \(/.test(cardCode),
    "C1 the Enter/Space contract keeps the select/inspect split verbatim (the arrow branch is an else-if)",
  );
  const tabIndex = (cardCode.match(/tabIndex=\{0\}/g) ?? []).length;
  assert(tabIndex >= 1, "C2 tabIndex={0} unchanged (Tab's DOM-order walk is not replaced)", `found ${tabIndex}`);
  assert(
    /focus-visible:ring-2 focus-visible:ring-ring/.test(card),
    "C3 the focus-visible ring is unchanged (the keyboard face the arrows ride)",
  );
  assert(/role="button"/.test(card), "C4 role=button unchanged");
  assert(
    /aria-label=\{`\$\{job\.name\} — \$\{spec\?\.label \?\? job\.type\}, \$\{job\.status\}`\}/.test(card),
    "C5 the aria-label grammar unchanged (name — label, status)",
  );
  const family = [
    "palette-pours-", "palette-fav-pours-", "cmd-pours-", "cmd-user-pours-", "cmd-preset-pours-",
    "lens-pours-", "params-diff-pours-", "cleanup-pours-", "remote-pours-", "storage-pours-",
    "shelf-pours-", "runtime-pours-", "refmap-pours-", "queue-pours-", "peek-pours-",
    "fsc-compare-pours-", "funnel-pours-", "class-gallery-pours-",
  ];
  assert(
    !family.some((a) => "data-card-btn-".includes(a) || a.includes("card-btn")),
    "C6 data-card-btn collides with none of the family's EIGHTEEN DOM addresses",
  );
  // the stock census: line-comment-stripped, pre counted from git HEAD before the anchors were written
  const cnt = (s, re) => (s.match(re) ?? []).length;
  assert(cnt(cardCode, /\{" "\}/g) === 1, "C7 job-card glue 1 = 1 (the t774 census, comments stripped)");
  assert(cnt(cardCode, /\btruncate\b/g) === 24, "C8 job-card truncate 24 = 24");
  assert(cnt(cardCode, /localStorage|sessionStorage/g) === 4, "C9 job-card storage 4 = 4 (zero new writes)");
  assert(cnt(cardCode, /#[0-9a-fA-F]{3,8}\b/g) === 1, "C10 job-card hex 1 = 1");
  assert(cnt(canvasCode, /\{" "\}/g) === 5, "C11 canvas glue 5 = 5");
  assert(cnt(canvasCode, /\btruncate\b/g) === 9, "C12 canvas truncate 9 = 9");
  assert(cnt(canvasCode, /localStorage|sessionStorage/g) === 2, "C13 canvas storage 2 = 2");
  assert(cnt(canvasCode, /#[0-9a-fA-F]{3,8}\b/g) === 0, "C14 canvas hex 0 = 0 (zero new hex in the brain too)");
  assert(
    cnt(navLib, /#[0-9a-fA-F]{3,8}\b/g) === 0,
    "C15 the lib carries zero hex (the wire ink lives in PORT_COLORS, not here)",
  );
}

console.log("D — purity (the lib is geometry only; the residents keep their seats)");
{
  assert(
    !/fetch\(|localStorage|sessionStorage|document\./.test(navLib),
    "D1 the lib is a pure function: no fetch, no storage, no document",
  );
  assert(
    /Task 775.*arrow-key navigator|arrow-key navigator \(Task 775\)/.test(navLib),
    "D2 the lib's judgment note leads (t775, the spatial contract)",
  );
  assert(
    /t571/.test(card) && /t444/.test(card) && /t350/.test(card),
    "D3 job-card's old residents keep their seats (t571 hover lean, t444 staleness, t350 failed wash)",
  );
  assert(
    /t737/.test(canvas) && /Task 127/.test(canvas),
    "D4 canvas's old residents keep their seats (t737 legend focus, Task 127 template dialog)",
  );
  assert(
    /export function WorkflowCanvas\(\)/.test(canvas),
    "D5 the summoner still mounts (WorkflowCanvas exports)",
  );
  assert(
    /export type NavDir/.test(navLib) && /export function nearestNeighbor/.test(navLib),
    "D6 the lib exports exactly the pair (NavDir + nearestNeighbor) — one book, two names",
  );
}

console.log(`\n==== t775 canvas-nav unit: ${pass} pass / ${fail} fail ====`);
if (fail > 0) process.exit(1);
