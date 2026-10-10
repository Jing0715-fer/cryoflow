#!/usr/bin/env node
/* t823 — the share story's next two pieces: per-ROW link copy and the
 * save-shared-view shortcut.
 *
 * The features: ① every bookmark row's button grid gains a fifth seat —
 * "Copy view link for <name>" encodes THAT row's SAVED pose & optics
 * (b.snapshot / b.view — the t821 freeze law reaching the URL: the link
 * IS the view it shares, not wherever the canvas has drifted) with the
 * row's own name riding the payload. ② the restore toast's words grow a
 * hand: "Save here" becomes a BUTTON on the toast — saveSharedView
 * adopts the guest pose as a row, freezing the SHARE's own bytes, the
 * cap of 8 refuses honestly, and explicit consent is what makes it
 * lawful (the guest law stands: the LINK births no row; the click does).
 * The door's copyViewLink keeps its capture and delegates the encode,
 * budget and clipboard to copyLinkFor — ONE mouth for the share family
 * (the t671 doctrine applied to links).
 *
 * The probe pins the LAWS statically (source reads — the fleet's
 * calibre; every window is bounded by the NEXT declaration, never a
 * fixed width — the t820/t822 instrument lesson):
 *
 *   A. the row's share law (what a row-link IS)
 *      1. copyRowViewLink freezes the SAVED bytes — b.snapshot / b.view,
 *         and NOT a live capture (no getSnapshot in the bounded window)
 *      2. the row grid carries the fifth seat with its honest a11y name
 *         ("Copy view link for <name>") and the Link2 icon
 *      3. the law's comment rides where the next sweep reads it
 *
 *   B. the one-mouth law (how the share family speaks)
 *      4. copyLinkFor exists and BOTH gestures ride it (copyViewLink
 *         delegates its capture; copyRowViewLink hands the row bytes)
 *      5. the URL budget is checked BEFORE the clipboard, inside the
 *         one mouth
 *      6. the toast NAMES what travels (the name rides the description)
 *      7. the footer's glance detail: the file-ops group and the share
 *         gesture are separated by a hairline divider
 *
 *   C. the save shortcut (how the guest is adopted)
 *      8. saveSharedView refuses the full shelf HONESTLY before any
 *         commit (the t821 law — a promise that eats a neighbour's row
 *         is a lie)
 *      9. the adoption freezes the SHARE's own bytes — share.snapshot /
 *         share.view, no getSnapshot in the bounded window
 *     10. the adoption rides commitBookmarks — the t671 single mouth —
 *         and a name collision speaks the amber honesty
 *     11. the restore toast carries the action, wired through
 *         saveSharedRef (the restoreBookmarkRef handle pattern — the
 *         ref refreshed every render), and the consume block stays
 *         commitBookmarks-free: the guest law's negative pin HOLDS with
 *         the shortcut present
 *
 *   D. the calibre
 *     12. no new API route — 18 api dirs + src/app/api/route.ts = 19
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const embed = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");

let pass = 0;
const fails = [];
const ok = (cond, label) => (cond ? pass++ : fails.push(label));

// ---- declaration-bounded windows (the fifth amendment's discipline) ----
const win = (from, to) => {
  const a = embed.indexOf(from);
  const b = embed.indexOf(to, a + 1);
  return a >= 0 && b > a ? embed.slice(a, b) : "";
};
const rowWin = win("const copyRowViewLink", "const copyViewLink");
const mouthWin = win("const copyLinkFor", "const copyRowViewLink");
const saveWin = win("const saveSharedView", "const commitRename");

// ---- A. the row's share law ----
ok(
  rowWin.includes("b.snapshot") && rowWin.includes("b.view"),
  "A1 the row-link freezes the SAVED pose & optics (b.snapshot / b.view)",
);
ok(
  rowWin !== "" && !rowWin.includes("getSnapshot"),
  "A1b no live capture inside copyRowViewLink — the link IS the view it shares",
);
ok(
  embed.includes('aria-label={`Copy view link for ${b.name}`}') &&
    embed.includes("<Link2 className=\"size-3\" />"),
  "A2 the row grid's fifth seat with its honest a11y name and the Link2 icon",
);
ok(
  embed.includes("t823 — the row's share: a link that carries THIS"),
  "A3 the law's comment rides where the next sweep reads it",
);

// ---- B. the one-mouth law ----
ok(
  mouthWin.includes("encodeSharePayload") &&
    mouthWin.includes("payload.length > SHARE_PAYLOAD_MAX"),
  "B4a the one mouth encodes and budgets",
);
ok(
  win("const copyViewLink", "const saveSharedView").includes('copyLinkFor("Shared view", snapshot, view)'),
  "B4b the door's share delegates its capture to the one mouth",
);
ok(
  mouthWin.indexOf("payload.length > SHARE_PAYLOAD_MAX") < mouthWin.indexOf("navigator.clipboard.writeText"),
  "B5 the budget is checked BEFORE the clipboard, inside the mouth",
);
ok(
  mouthWin.includes("travels inside the URL — anyone opening it lands on this exact pose & optics"),
  "B6 the toast NAMES what travels",
);
ok(
  embed.includes('aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-border/70"'),
  "B7 the footer's glance detail — file-ops and share sorted by a hairline",
);

// ---- C. the save shortcut ----
ok(
  saveWin.includes("length >= 8") &&
    saveWin.indexOf("The shelf is full") < saveWin.indexOf("commitBookmarks"),
  "C8 the honest-full refusal speaks BEFORE any commit",
);
ok(
  saveWin.includes("snapshot: share.snapshot") && saveWin.includes("view: share.view"),
  "C9 the adoption freezes the SHARE's own bytes (what arrived)",
);
ok(
  saveWin !== "" && !saveWin.includes("getSnapshot"),
  "C9b no live capture inside saveSharedView — the row keeps what arrived",
);
ok(
  saveWin.includes("commitBookmarks([") && saveWin.includes("duplicateNameToast"),
  "C10 the adoption rides the one mouth; a name collision speaks amber",
);
ok(
  embed.includes("saveSharedRef.current = saveSharedView") &&
    embed.includes("saveSharedRef.current?.(share)"),
  "C11a the toast action rides the ref handle (refreshed every render)",
);
const consumeWin = win("t822 — the shareable link's landing", "}, [phase, jobId])");
ok(
  consumeWin.includes("Save this view") && !consumeWin.includes("commitBookmarks"),
  "C11b the consume block stays row-free — the guest law's negative pin HOLDS with the shortcut present",
);

// ---- D. the calibre ----
let apiEntries = 0;
let apiDirs = 0;
try {
  for (const e of readdirSync("src/app/api")) {
    apiEntries += 1;
    try {
      if (statSync(`src/app/api/${e}`).isDirectory()) apiDirs += 1;
    } catch {}
  }
} catch {}
ok(
  apiEntries === 19 && apiDirs === 18,
  "D12 no new API route — 18 api dirs + src/app/api/route.ts = 19 entries",
);

console.log(`t823-row-share-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
