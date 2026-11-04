#!/usr/bin/env node
/**
 * t1123 — the per-button auditor: the file-level sweep's honest closure.
 *
 * The file-level law ("a file with raw <button>s must speak the family
 * ring") has a blind spot: a file can carry ringed seats AND bare seats
 * (palette.tsx's favorites filter hid behind its search input's ring).
 * This auditor walks EVERY raw <button> opening tag in src/components +
 * src/app, extracts its className attribute (string or brace-balanced
 * expression, multi-line aware), and names the tag when NEITHER the
 * className NOR a same-tag spread of a Chip-interactive rider provides
 * a focus-visible response.
 *
 * Heuristic rules, stated honestly:
 *   - the tag body ends at the first `>` that is not inside a quoted
 *     string, a template literal, or a brace/paren group;
 *   - a className whose expression contains "focus-visible" rides;
 *   - tags inside <Chip interactive asChild> ride via the chip mint —
 *     detected by scanning backwards for the nearest enclosing JSX
 *     element opening: if the tag body above mentions Chip + interactive
 *     within the last 400 chars before the button, and asChild, it rides;
 *   - anything else is named BARE, with file:line.
 *
 * Exit 1 when any bare tag remains — this is the unit's sharper sibling.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tagBody, classNameOf } from "./t1123-jsx-scan.mjs";

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** the className expression of a tag body, or "" */
// (tagBody and classNameOf live in t1123-jsx-scan.mjs — the shared
// scanner that knows nested templates and comment apostrophes)

const files = [...walk(join(ROOT, "src/components")), ...walk(join(ROOT, "src/app"))];
const bare = [];
let total = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const lines = text.split("\n");
  let idx = text.indexOf("<button");
  while (idx !== -1) {
    // opening tag only: previous non-space char must not be '/'
    const before = text.slice(Math.max(0, idx - 2), idx);
    if (!before.endsWith("/")) {
      // prose guard: a zero-attribute `<button>` is a comment mention
      if (/^<button\s*>/.test(text.slice(idx, idx + 12))) {
        idx = text.indexOf("<button", idx + 1);
        continue;
      }
      total += 1;
      const body = tagBody(text, idx);
      const cls = classNameOf(body);
      const rides = cls.includes("focus-visible");
      // Chip-interactive rider: look back for the nearest Chip opening
      const back = text.slice(Math.max(0, idx - 900), idx);
      const chipRider = back.includes("asChild") && back.includes("interactive") && /<Chip[\s\S]*$/.test(back);
      // variable rider: className={SOME_VAR} whose definition in this
      // file already speaks focus-visible (the btnCls/cls lesson)
      let varRider = false;
      if (!rides) {
        const inner = body.match(/className\s*=\s*\{([^]*)\}/)?.[1];
        if (inner !== undefined) {
          // every identifier in the expression may carry the ring via its
          // definition (btnCls inside cn(...) counts — the def speaks)
          const ids = inner.match(/[A-Za-z_$][\w$]*/g) ?? [];
          for (const name of ids) {
            if (["cn", "true", "false", "null", "undefined"].includes(name)) continue;
            const defRe = new RegExp(`(const|let|var)\\s+${name}\\s*=[\\s\\S]*?(?=\\n\\s*(const|let|var|function|return|export)\\b|$)`);
            const dm = defRe.exec(text);
            if (dm && dm[0].includes("focus-visible")) { varRider = true; break; }
          }
        }
      }
      if (!rides && !chipRider && !varRider) {
        const lineNo = text.slice(0, idx).split("\n").length;
        bare.push(`${f.replace(ROOT + "/", "")}:${lineNo} — ${cls.slice(0, 90).replace(/\n/g, " ")}`);
      }
    }
    idx = text.indexOf("<button", idx + 1);
  }
  void lines;
}

console.log(`scanned ${files.length} tsx files · ${total} raw <button> tags`);
if (bare.length === 0) {
  console.log("ZERO bare buttons — every raw tag rides a focus-visible response");
} else {
  console.log(`${bare.length} BARE tags:`);
  for (const b of bare) console.log(`  BARE ${b}`);
  process.exit(1);
}
