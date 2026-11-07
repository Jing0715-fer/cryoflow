#!/usr/bin/env node
/* t821 — save-as-copy: the bookmark door's fourth face.
 *
 * The feature: "Duplicate bookmark <name>" on every bookmark row — the
 * copy freezes the SAVED pose & optics (b.snapshot / b.view, NOT the
 * current canvas), takes the first free "(copy)" suffix, refuses the
 * door's cap of 8 HONESTLY (a toast, not a silent slice of someone
 * else's row), and rides commitBookmarks — the t671 single mouth — so
 * the wall and the palette hear it like every other mutation.
 *
 * The probe pins the LAWS statically (source reads — the same calibre as
 * the fleet's other units):
 *
 *   A. the copy's law (what a copy IS)
 *      1. duplicateBookmark freezes the SAVED pose — b.snapshot / b.view,
 *         and NOT a live capture (no getSnapshot inside the function)
 *      2. the first-free-suffix algorithm: "(copy)", then "(copy N)",
 *         case-insensitive taken-set
 *      3. the honest-full refusal: length >= 8 → toast "The shelf is
 *         full" and RETURN before any commit
 *      4. the name headroom: base trimmed to 30 so " (copy 99)" fits
 *         the 40-char cap the rename input enforces
 *
 *   B. the ride-the-one-path law (how it speaks)
 *      5. the copy rides commitBookmarks (the t671 single mouth — the
 *         wall and palette hear it; no private fetch, no private PUT)
 *      6. the toast teaches ("Copy saved" + the old→new name)
 *      7. no new API route: the camera-bookmarks route stays the only
 *         write mouth (the api census calibre holds: 18 dirs + route.ts)
 *
 *   C. the face (where the door speaks)
 *      8. the row grid carries the fourth button with its honest name
 *         ("Duplicate bookmark <name>") and the t821 comment pinning why
 *
 *   D. the wall keeps its glance law (the negative pin)
 *      9. NO duplicate door on the dashboard wall — the wall's own
 *         comment names the viewer as the full-featured home; its hover
 *         strip stays a trio (jump / Rename / Delete)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const embed = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
const dashboard = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");

let pass = 0;
const fails = [];
const ok = (cond, label) => (cond ? pass++ : fails.push(label));

// ---- extract the duplicateBookmark function body — bounded by the NEXT
// function declaration, not a char count: the t822 window inserted
// copyViewLink right after this function, and a fixed-width slice
// (1800 chars) reached into ITS body and read ITS getSnapshot as a
// false positive (the fleet caught it at 90/91 — the amendment is the
// t811/t815/t820 precedent's fifth performance: the assertion's truth
// never moved; the instrument's window did).
const fnStart = embed.indexOf("const duplicateBookmark");
const fnEnd = embed.indexOf("const copyViewLink");
ok(fnStart > 0, "A0 duplicateBookmark exists in the viewer");
ok(fnEnd > fnStart, "A0b the function boundary resolves (copyViewLink follows)");
const fnBody = fnStart > 0 && fnEnd > fnStart ? embed.slice(fnStart, fnEnd) : "";

// ---- A. the copy's law ----
ok(
  fnBody.includes("snapshot: b.snapshot") && fnBody.includes("view: b.view"),
  "A1 the copy freezes the SAVED pose & optics (b.snapshot / b.view)",
);
const fnSlice = fnBody.split("\ncommitBookmarks")[0]; // body up to the commit call
ok(
  fnSlice && !fnSlice.includes("getSnapshot"),
  "A1b the freeze reads the BOOKMARK's bytes — no live capture inside duplicateBookmark",
);
ok(
  fnBody.includes('`${base} (copy)`') && fnBody.includes("taken.has(nm.toLowerCase())"),
  "A2 the first-free-suffix algorithm — case-insensitive taken-set",
);
ok(
  fnBody.includes("length >= 8") && fnBody.indexOf("The shelf is full") < fnBody.indexOf("commitBookmarks"),
  "A3 the honest-full refusal speaks BEFORE any commit",
);
ok(
  fnBody.includes("slice(0, 30)"),
  "A4 the name headroom keeps ' (copy 99)' under the 40-char cap",
);

// ---- B. the ride-the-one-path law ----
ok(
  fnBody.includes("commitBookmarks(["),
  "B5 the copy rides commitBookmarks — the t671 single mouth",
);
ok(
  fnBody.includes('"Copy saved"') && fnBody.includes("same pose & optics"),
  "B6 the toast teaches the old→new name",
);
// the api census calibre: 18 dirs + the top-level route.ts = 19 entries
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
  "B7 no new API route — 18 api dirs + src/app/api/route.ts = 19 entries (the calibre holds)",
);

// ---- C. the face ----
ok(
  embed.includes('aria-label={`Duplicate bookmark ${b.name}`}') &&
    embed.includes("CopyPlus"),
  "C8 the row grid's fourth face with its honest name rides the file",
);
ok(
  embed.includes("t821 — save-as-copy: the grid's fourth face"),
  "C8b the door carries the law's comment where the next sweep reads it",
);

// ---- D. the wall keeps its glance law ----
ok(
  !dashboard.includes("Duplicate saved view") && !dashboard.includes("duplicateFromWall"),
  "D9 the wall stays a trio — the viewer remains the full-featured home (the wall's own words)",
);

console.log(`t821-duplicate-view-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
