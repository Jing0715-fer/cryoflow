#!/usr/bin/env node
/* t806 — the pointer-face debt AUDIT: the t803 census named a debt
 * ("workspace rows, mol* entry rows, particle cards — clickable divs,
 * the t784 family's, noted not cured") and this window walks back to it
 * with evidence instead of a cure. What the walk found:
 *
 *   A  the workspace rows carried their keyboard face ALL ALONG —
 *      role=button + tabIndex + Enter/Space, on the row since the
 *      workspace architecture landed (acdd4ed). The real residue was
 *      the INVISIBLE focus: tabbing to a row showed no ring anywhere.
 *      Cured this window with the card family's ring.
 *   B  the row can never be a real <button> — it legally holds nested
 *      interactive children (Rename/Delete buttons, the rename Input),
 *      so the div+role form IS the correct face. Asserted, not assumed.
 *   C  the mol* entry rows are label+Checkbox pairs — the native form
 *      face, keyboard-reachable by the checkbox itself. No div-click
 *      debt ever lived there.
 *   D  the particle browser is a real-button household end to end:
 *      six type="button" elements, every one labeled.
 *
 * The debt name is retired BY EVIDENCE. The t803 gate is amended to
 * speak the retirement (F4/G3); this probe stands as the audit record.
 *
 * Runs against the source tree — a census probe, not a browser test. */

import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const ws = read("src/components/workflow/workspace-panel.tsx");
const molstar = read("src/components/workflow/results/molstar-embed.tsx");
const particle = read("src/components/workflow/results/particle-browser.tsx");
const jobCard = read("src/components/workflow/job-card.tsx");
const census = read("scripts/t803-scroll-census-second-pass-unit.mjs");

let pass = 0;
const fails = [];
const ok = (cond, msg) => {
  if (cond) pass++;
  else fails.push(msg);
};

/* slice — the two-anchor window (t803's tool, verbatim) */
const slice = (s, a, b) => {
  const i = s.indexOf(a);
  if (i < 0) return "";
  const j = s.indexOf(b, i + a.length);
  return j < 0 ? s.slice(i) : s.slice(i, j);
};

/* A — the workspace row's keyboard face (the whole WorkspaceRow) */
const row = slice(ws, "function WorkspaceRow({", "export function WorkspacePanel");
ok(
  row.includes('role="button"') && row.includes("tabIndex={0}"),
  "A1 the row's keyboard face was on file all along (role=button + tabIndex — the architecture's own work)",
);
ok(
  row.includes('e.key === "Enter"') && row.includes('e.key === " "'),
  "A2 Enter and Space both speak the row (the manual activation the role demands)",
);
ok(
  row.includes("aria-current={isActive"),
  "A3 the row's aria-current kept (the active canvas still announces itself)",
);
ok(
  row.includes("outline-none") &&
    row.includes("focus-visible:ring-2") &&
    row.includes("focus-visible:ring-ring"),
  "A4 the INVISIBLE focus CURED (t806) — the row wears the card family's focus ring",
);
ok(
  !row.includes("ring-inset"),
  "A5 the row's ring rides the OUTSIDE edge (a rounded-xl card ring, not the list's inset dialect — each face keeps its own)",
);

/* B — the boundary honesty: the row can never be a real <button> */
ok(
  row.includes("<Button") && row.includes("Rename ") && row.includes("Delete "),
  "B1 the row legally holds nested interactive children (Rename/Delete buttons aboard)",
);
ok(
  row.includes("<Input") && row.includes("Workspace name"),
  "B2 the rename Input lives inside the row too (editing is an in-row state)",
);
ok(
  !row.includes("<button"),
  "B3 the row stays a div — a real <button> could not legally hold its nested children, so the div+role form IS the correct face",
);
ok(
  row.includes("data-ws-card") && row.includes("data-ws-stats"),
  "B4 the arrival wave survives the cure (the t614 mount ledger's faces untouched)",
);

/* C — the mol* entry rows' native face (label + Checkbox pairs) */
const lblIdx = molstar.indexOf('key={`${e.name}-${gi2}`}');
const lblWindow = lblIdx > -1 ? molstar.slice(lblIdx, lblIdx + 2400) : "";
ok(
  lblIdx > -1 && lblWindow.includes("<Checkbox") && lblWindow.includes("</label>"),
  "C1 the entry row is a label+Checkbox pair — the native form face (t806 audit, evidence not edits)",
);
ok(
  lblWindow.includes("Import “"),
  "C2 the checkbox carries the honest per-row name (Import “…” — the row speaks through its control)",
);
ok(
  lblWindow.includes("cursor-not-allowed") && lblWindow.includes("opacity-45"),
  "C3 the locked-row semantics kept verbatim (the full list's lock still reads)",
);
ok(
  molstar.includes("aria-label={`Toggle all views from"),
  "C4 the source toggles keep their own honest names (the header checkbox was never the debt)",
);

/* D — the particle browser: a real-button household end to end */
const typeBtns = (particle.match(/type="button"/g) || []).length;
ok(
  typeBtns === 6,
  "D1 the particle browser runs SIX type=\"button\" elements (group head, grid tile, page retry, prev, next, first-page retry)",
);
ok(
  particle.includes('aria-label="Previous particle page"') &&
    particle.includes('aria-label="Next particle page"'),
  "D2 the pagination speaks (both arrows carry honest names)",
);
ok(
  particle.includes('aria-label="Retry loading this page"'),
  "D3 the retry speaks (the mid-page and first-page retries both labeled)",
);
ok(
  particle.includes("focus-visible:ring-2 focus-visible:ring-ring"),
  "D4 the grid tiles wear the family ring (the zoom tile's focus face on file)",
);
ok(
  particle.includes("data-page-error-retry"),
  "D5 the t492 mid-paging blip verdict survives the audit (stale-but-alive, unchanged)",
);

/* E — the amendments on record (the t803 gate speaks the retirement) */
ok(
  census.includes("F4 AMENDED t806") && census.includes("G3 AMENDED t806"),
  "E1 the t803 gate's two amendments are on record (the map follows the world)",
);
ok(
  !census.includes("named, not cured") && census.includes("RETIRED BY AUDIT"),
  "E2 the retired asserts are gone (the gate's old message retired with them; the new message speaks the audit)",
);
ok(
  census.includes('h.includes("pointer-first")'),
  "E3 the particle stack's pointer-first verdict stands untouched (it described a real button household — it was never wrong)",
);

/* F — the scope honesty (the audit adds one ring, takes nothing) */
ok(
  (ws.match(/focus-visible:ring-2/g) || []).length === 2,
  "F1 the panel holds exactly TWO ring-2 faces (the list's inset ground + the row's outer ring) — one cure, no blanket",
);
ok(
  !ws.includes("RovingFocusGroup") &&
    !particle.includes("RovingFocusGroup") &&
    !molstar.includes("aria-activedescendant"),
  "F2 no roving machinery crept in (the audit found faces, not debt — nothing to rove)",
);
ok(
  jobCard.includes("focus-visible:ring-2 focus-visible:ring-ring"),
  "F3 the dialect's elder confirmed (the canvas card's ring, the pattern the row now speaks)",
);
ok(
  ws.includes("tabIndex={0}") &&
    ws.includes('aria-label="Workspaces"'),
  "F4 the t803 ground's stop + name untouched (the audit cured the row, never the ground's record)",
);

console.log(`t806-pointer-debt-audit-unit: ${pass} pass / ${failCount(fails)} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
function failCount(f) {
  return f.length;
}
