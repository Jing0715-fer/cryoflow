#!/usr/bin/env node
// t902 — the geometry restore's unit receipt (the t901 fsc-restore-unit
// pattern: the meaning lives in lib, the unit rides the same shapes the
// panel feeds).
//
// The style round three's assistant-panel leg: the persisted window
// geometry's restore can silently EDIT the user's remembered shape — a
// shrunken viewport (a smaller monitor, devtools open, a half-snapped
// window) and clampGeo hands back a smaller, pulled-in window. The
// panel whispers the edit once (the t899 grammar's fourth seat) and
// goes silent at the user's first gesture. src/lib/geo-restore.ts owns
// the arithmetic (the t653 law — the SAME clamp the drags apply);
// this receipt pins its laws:
//   A  the clamp itself (the mins, the viewport ceiling, the 8px
//      margins — the drags' law, unchanged by the move to lib)
//   B  the restore's edit receipt (which axis families the clamp moved,
//      measured AFTER the size clamp — an honest survivor is not named)
//   C  the silence law (an exact restore is edits [] AND summary "" —
//      the component's no-render condition holds by construction)
//   D  the whisper's clause line (the panel's Chinese voice, one line,
//      size before position)
//   E  the matcher law (the t653 chain: the panel imports the lib's
//      faces and no local clampGeo definition remains to drift)
//
// Usage: node --import ./scripts/ts-alias-register.mjs scripts/t902-geo-restore-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clampGeo,
  defaultGeo,
  GEO_MIN_H,
  GEO_MIN_W,
  GEO_MOBILE_BP,
  restoreGeo,
  restoreGeoSummary,
} from "@/lib/geo-restore";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const geo = (x, y, w, h) => ({ x, y, w, h });

console.log("A — the clamp itself (the drags' law, unchanged by the move)");

// A1 — an in-bounds shape passes through untouched
{
  const g = geo(100, 200, 500, 600);
  const c = clampGeo(g, 1600, 900);
  ok("A1 in-bounds shape unchanged", c.x === 100 && c.y === 200 && c.w === 500 && c.h === 600, JSON.stringify(c));
}

// A2 — the size floor: a tiny shape grows to the mins
{
  const c = clampGeo(geo(0, 0, 100, 50), 1600, 900);
  ok("A2 size floor raised to the mins", c.w === GEO_MIN_W && c.h === GEO_MIN_H, JSON.stringify(c));
}

// A3 — the viewport ceiling: a huge shape shrinks to viewport−16
{
  const c = clampGeo(geo(0, 0, 4000, 3000), 1600, 900);
  ok("A3 size ceiling viewport-16", c.w === 1584 && c.h === 884, JSON.stringify(c));
}

// A4 — the position margins: negative and overflow positions pull inside 8px
// (h=400 sits BELOW the min, so it grows to 420 first — the y margin rides
// the GROWN height)
{
  const c = clampGeo(geo(-500, 5000, 500, 400), 1600, 900);
  ok("A4 position clamped to the 8px margins (after the h floor)", c.x === 8 && c.y === 900 - 420 - 8 && c.h === GEO_MIN_H, JSON.stringify(c));
}

// A5 — a viewport smaller than the min: the min wins (the window never
// collapses below usable even on a tiny screen)
{
  const c = clampGeo(geo(0, 0, 500, 500), 300, 300);
  ok("A5 min wins over a tiny viewport", c.w === GEO_MIN_W && c.h === GEO_MIN_H, JSON.stringify(c));
}

// A6 — the home corner: defaultGeo is in-bounds at the top-right
{
  const d = defaultGeo(1600, 900);
  ok("A6 home corner in-bounds, top-right", d.x + d.w <= 1600 - 8 && d.y === 64 && d.w === 560, JSON.stringify(d));
}

// A7 — the mobile breakpoint constant rides the lib (the t638 law's
// single name)
ok("A7 GEO_MOBILE_BP is 768", GEO_MOBILE_BP === 768);

console.log("B — the restore's edit receipt (which families moved)");

// B1 — an exact fit: NO edits (silence by construction)
{
  const { geo: g, edits } = restoreGeo(geo(100, 200, 500, 600), 1600, 900);
  ok("B1 exact fit → no edits, shape unchanged", edits.length === 0 && g.w === 500, JSON.stringify(edits));
}

// B2 — a shrunken viewport clips the size past the CEILING: both families
// honestly named. The clamp's own property (first seen here — the unit's
// first draft wrongly promised one edit): the size ceiling (vw−16) leaves
// ZERO position slack (the x range [8, vw−w−8] collapses to [8, 8]), so an
// oversize shape ALWAYS moves position too — both families speak.
{
  const { geo: g, edits } = restoreGeo(geo(100, 200, 4000, 3000), 1600, 900);
  ok(
    "B2 oversize → size + position (the ceiling leaves no slack)",
    edits.length === 2 && edits[0].axis === "size" && edits[1].axis === "position" && g.w === 1584 && g.h === 884 && g.x === 8,
    JSON.stringify(edits)
  );
}

// B2b — the floor-growth survivor: the size MIN widens the position range,
// so a position can genuinely survive a size edit (the honest one-family
// case the ceiling can never produce)
{
  const { edits } = restoreGeo(geo(1000, 200, 100, 500), 1600, 900);
  ok(
    "B2b floor growth widens the range → only size named",
    edits.length === 1 && edits[0].axis === "size",
    JSON.stringify(edits)
  );
}

// B3 — a position outside with a legal size: ONE position edit (h sits
// exactly AT the min — the size family untouched)
{
  const { edits } = restoreGeo(geo(-500, 5000, 500, 420), 1600, 900);
  ok("B3 out-of-bounds position, legal size → one position edit", edits.length === 1 && edits[0].axis === "position", JSON.stringify(edits));
}

// B4 — both families via the FLOOR: a sub-min size grows AND an outside
// position pulls in — two edits, size first (the feed order never decides
// the reading order)
{
  const { edits } = restoreGeo(geo(-500, 5000, 100, 400), 1600, 900);
  ok(
    "B4 floor growth + outside position → two edits, size first",
    edits.length === 2 && edits[0].axis === "size" && edits[1].axis === "position",
    JSON.stringify(edits)
  );
}

// B5 — merged into B2b (the floor growth is the survivor case; the ceiling
// leaves no slack by construction — see B2's discovery note)

// B6 — the boundary riders: exactly-at-limit values are NOT edits
{
  const { edits } = restoreGeo(geo(8, 8, 1584, 884), 1600, 900);
  ok("B6 exactly-at-limit → no edit", edits.length === 0, JSON.stringify(edits));
}

console.log("C — the silence law");

// C1 — an exact restore is edits [] AND summary "" (the no-render pair)
{
  const { edits } = restoreGeo(geo(100, 200, 500, 600), 1600, 900);
  ok("C1 exact restore: edits [] AND summary \"\"", edits.length === 0 && restoreGeoSummary(edits) === "");
}

// C2 — the clamp is NOT a garbage filter: NaN propagates (Math.max/min
// pass it through). That is WHY the component's typeof door guards the
// JSON payload before restoreGeo ever sees it — the lib pins the hazard
// the door exists for (the honest division: the lib does arithmetic, the
// component does validation).
{
  const { geo: g } = restoreGeo(geo(NaN, NaN, NaN, NaN), 1600, 900);
  ok(
    "C2 NaN propagates — the component's typeof door is the gate",
    Number.isNaN(g.w) && Number.isNaN(g.x),
    JSON.stringify(g)
  );
}

console.log("D — the whisper's clause line (the panel's Chinese voice)");

// D1 — one size edit names the size only
{
  const s = restoreGeoSummary([{ axis: "size" }]);
  ok("D1 size-only clause", s === "记住的窗口没原样回来 — 尺寸被收紧到屏幕内", s);
}

// D2 — one position edit names the position only
{
  const s = restoreGeoSummary([{ axis: "position" }]);
  ok("D2 position-only clause", s === "记住的窗口没原样回来 — 位置被拉回屏幕内", s);
}

// D3 — both: size before position, joined by the middle dot
{
  const s = restoreGeoSummary([{ axis: "position" }, { axis: "size" }]);
  ok("D3 both clauses, size first regardless of feed order", s === "记住的窗口没原样回来 — 尺寸被收紧到屏幕内 · 位置被拉回屏幕内", s);
}

// D4 — the empty list is the empty line (the component's other half)
ok("D4 empty edits → empty summary", restoreGeoSummary([]) === "");

console.log("E — the matcher law (the t653 chain: one clamp, two faces)");

// E1 — the panel imports the lib's faces (the import block carries them)
{
  const src = readFileSync(join(process.cwd(), "src/components/ai/assistant-panel.tsx"), "utf8");
  ok(
    "E1 the panel imports restoreGeo + clampGeo + the constants from the lib",
    src.includes('from "@/lib/geo-restore"') &&
      /import\s*\{[^}]*restoreGeo[^}]*\}\s*from\s*"@\/lib\/geo-restore"/s.test(src),
  );
}

// E2 — no local clampGeo definition remains in the panel (drift impossible)
{
  const src = readFileSync(join(process.cwd(), "src/components/ai/assistant-panel.tsx"), "utf8");
  ok(
    "E2 the panel defines no local clampGeo (the lib is the ONE clamp)",
    !/function\s+clampGeo\s*\(/.test(src),
  );
}

// E3 — the boot restore rides restoreGeo (the receipt-bearing face), not
// a bare clampGeo call
{
  const src = readFileSync(join(process.cwd(), "src/components/ai/assistant-panel.tsx"), "utf8");
  ok(
    "E3 the boot restore calls restoreGeo (the edit receipt's only birthplace)",
    /restoreGeo\(\s*g as WinGeo/.test(src),
  );
}

// E4 — the whisper renders through the lib's summary (the voice cannot
// drift from the arithmetic)
{
  const src = readFileSync(join(process.cwd(), "src/components/ai/assistant-panel.tsx"), "utf8");
  ok(
    "E4 the whisper's body is restoreGeoSummary(geoEdits)",
    /data-testid="assistant-geo-whisper"/.test(src) && /\{restoreGeoSummary\(geoEdits\)\}/.test(src),
  );
}

console.log(`\nt902 geo-restore unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
