#!/usr/bin/env node
/**
 * t912 — the dialog gutter's family seat (the script that applies it).
 *
 * THE FINDING (proven live by t912-star-gallery-narrow-audit's S4): the
 * base DialogContent (ui/dialog.tsx:577) spends a class on the narrow
 * gutter — `w-full max-w-[calc(100%-2rem)]` — but any caller passing a
 * BARE unprefixed `max-w-<scale>` has that base class MERGED AWAY by
 * tailwind-merge (same utility group, caller last) → below sm the dialog
 * is `w-full` against `max-w-4xl`=896 → FULL BLEED at 320/375: the star
 * dialog measured 320px wide at a 320 viewport, zero gutter, edge-glued.
 *
 * THE LAW (the base owns the gutter; a caller's cap is sm-prefixed):
 *   1. bare `max-w-X` + existing `sm:max-w-X` (same scale) → drop the bare
 *   2. bare `max-w-X` alone → `sm:max-w-X`
 * Wide behavior is bit-identical (at ≥640 the sm: cap binds exactly as
 * the bare one did); the narrow world regains its gutter. The
 * self-guttering shapes (`w-[calc(100vw-2rem)]`, arbitrary min()/calc()
 * max-widths) are exempt — they carry their own arithmetic.
 *
 * The script edits ONLY classNames inside <DialogContent ...> blocks, and
 * prints a per-site before/after line for the receipt.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const files = execSync("grep -rl '<DialogContent' src --include=*.tsx", { encoding: "utf8" })
  .trim()
  .split("\n");

const BLOCK = /<DialogContent\b[\s\S]*?>/g;
/* the lookahead must include end-of-string: a className ENDING in the
 * bare cap (hpc-profiles-editor's `p-0 max-w-4xl`) has no trailing \s or
 * quote — the unit caught the seat skipping exactly that shape. */
const BARE = /(^|\s)max-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl)(?=\s|"|$)/;
let touched = 0;

for (const f of files) {
  const path = `${ROOT}/${f}`;
  const src = readFileSync(path, "utf8");
  let out = src;
  const edits = [];
  out = out.replace(BLOCK, (block) => {
    const m = block.match(/className="([^"]*)"/);
    if (!m) return block;
    const cls = m[1];
    if (/w-\[calc\(100vw/.test(cls) || /max-w-\[[^\]]*(?:calc|min)\(/.test(cls)) return block; // self-guttering
    const bare = cls.match(BARE);
    if (!bare) return block;
    const scale = bare[2];
    let next;
    if (new RegExp(`(^|\\s)sm:max-w-${scale}(?=\\s|")`).test(cls)) {
      // rule 1: the sm: twin already carries the cap — drop the bare one
      next = cls.replace(new RegExp(`(^|\\s)max-w-${scale}(?=\\s|")`), "$1").replace(/\s{2,}/g, " ").replace(/(^| ) /g, "$1").trimEnd();
    } else {
      // rule 2: prefix the cap
      next = cls.replace(BARE, (full, pre, sc) => `${pre}sm:max-w-${sc}`);
    }
    if (next !== cls) {
      edits.push(`    "${cls}"  →  "${next}"`);
      return block.replace(`className="${cls}"`, `className="${next}"`);
    }
    return block;
  });
  if (out !== src) {
    writeFileSync(path, out);
    touched++;
    console.log(`${f}:`);
    edits.forEach((e) => console.log(e));
  }
}
console.log(`\nseated: ${touched} file(s) — the gutter law rides the family`);
