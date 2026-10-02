/** t523 — one-shot census: type-only exports imported as values inside the
 *  product's src/ (the dialect mismatch that node's native type stripping
 *  catches at link time and Next's SWC silently forgives). Catches the whole
 *  chain in one pass instead of one link error per run. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project/src";
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e)) files.push(p);
  }
})(ROOT);

// 1) collect type-only export names per module
const typeExports = new Map(); // file -> Set(name)
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:type|interface)\s+(\w+)/g)) names.add(m[1]);
  // export type { A, B } / export { type A } forms
  for (const m of src.matchAll(/export\s+type\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(",")) {
      const n = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  if (names.size) typeExports.set(f, names);
}

// 2) collect imports and flag type-only names imported without `type`
const hits = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
    const [, wholeType, body, spec] = m;
    if (wholeType) continue;
    const resolved = resolveSpec(f, spec);
    if (!resolved) continue;
    const exported = typeExports.get(resolved);
    if (!exported) continue;
    for (const part of body.split(",")) {
      const seg = part.trim();
      if (!seg || seg.startsWith("type ")) continue;
      const name = seg.split(/\s+as\s+/)[0].trim();
      if (exported.has(name)) {
        hits.push(`${f.replace(ROOT + "/", "")}: value-imports "${name}" (type-only) from ${spec}`);
      }
    }
  }
}

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = fromFile.slice(0, fromFile.lastIndexOf("/"));
  let target = join(base, spec);
  for (const cand of [target, `${target}.ts`, `${target}.tsx`, join(target, "index.ts")]) {
    try { if (exists(cand)) return cand; } catch {}
  }
  return null;
}
import { existsSync } from "node:fs";
function exists(p) { return existsSync(p) && statSync(p).isFile(); }

console.log(hits.length ? hits.join("\n") : "clean — no type-only value imports in src/");
console.log(`\n(${files.length} files scanned)`);
