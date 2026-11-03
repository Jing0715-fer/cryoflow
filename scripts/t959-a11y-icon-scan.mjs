#!/usr/bin/env node
/* t959 a11y sweep — icon-only buttons missing an accessible name.
 * A size="icon" Button has no text; its name must come from aria-label
 * (preferred) or title. Scan every <Button …size="icon" opening block
 * (8 lines) for either attribute; report the naked ones. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
};

const naked = [];
for (const f of walk(path.join(ROOT, "src/components"))) {
  const lines = readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('size="icon"')) continue;
    // only Button-ish openings (the line should contain <Button or be inside one)
    const ctx = lines.slice(Math.max(0, i - 6), i + 9).join("\n");
    if (!/<Button/.test(ctx)) continue;
    if (!/aria-label=|title=/.test(ctx)) {
      naked.push(`${path.relative(ROOT, f)}:${i + 1}`);
    }
  }
}
console.log(naked.length === 0 ? "ALL NAMED" : naked.join("\n"));
console.log(`total icon buttons scanned, naked=${naked.length}`);
