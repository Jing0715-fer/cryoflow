/** t523 — the in-process door key. Node's type stripping runs .ts natively,
 *  but the product's lib chain speaks two dialects the bare node ESM resolver
 *  refuses: the `@/` alias (Next's tsconfig paths) and extensionless relative
 *  imports (Next's bundler resolves them, node's ESM resolver demands an
 *  explicit extension). This hook teaches node BOTH, so a script can import
 *  the product's own lib brain (engine.ts, stopRun, the cleanup wells) in
 *  process — the t522 phantom-stop live test was written for exactly this and
 *  left unrunnable for one window for the lack of the key.
 *
 *  Usage:  node --import ./scripts/ts-alias-register.mjs <script.mjs>
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC_HREF = new URL("../src/", import.meta.url).href;

/** extensionless specifier → the first candidate that exists on disk.
 *  Order mirrors ts/next resolution: exact, .ts, .tsx, /index.ts. */
function withExtension(href) {
  const candidates = [href, `${href}.ts`, `${href}.tsx`, `${href}/index.ts`];
  for (const cand of candidates) {
    try {
      const p = fileURLToPath(cand);
      if (existsSync(p) && statSync(p).isFile()) return cand;
    } catch {
      // not a file URL shape or unreadable — keep probing
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  // dialect 1 — the tsconfig paths alias: "@/lib/db" → <repo>/src/lib/db(.ts)
  if (specifier.startsWith("@/")) {
    const bare = new URL(specifier.slice(2), SRC_HREF).href;
    const resolved = withExtension(bare) ?? bare;
    return next(resolved, context);
  }
  // dialect 2 — extensionless relative imports between product sources
  // (only rewritten when the parent is one of our own .ts files)
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts")) {
    const base = context.parentURL.slice(0, context.parentURL.lastIndexOf("/"));
    const bare = new URL(specifier, `${base}/`).href;
    const resolved = withExtension(bare);
    if (resolved) return next(resolved, context);
  }
  return next(specifier, context);
}
