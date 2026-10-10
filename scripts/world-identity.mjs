// world-identity.mjs — the world key the instruments ride (t859).
//
// The restoration window (t858) left the lane on a DEV-ONLY world: the
// snapshot annihilated .next/BUILD_ID, and every instrument's provenance
// line crashed on the missing file — the whole battery died for want of a
// world key. But "which world is this?" has an honest answer in BOTH modes:
//
//   build mode → the production build's id (the t833-era key, unchanged);
//   dev mode   → a content hash of the src tree (the world the dev server
//                actually compiles and serves), prefixed dev@ so the mode
//                is IN the key, not guessed from context.
//
// The drift ledger's same-world arm (t857's three-arm law, M20–M24) keys on
// this string: two rides of the same world compare bit-for-bit; a moved key
// is arm-2 information, not a lie. A key that only exists on build days is
// not a world key — it is a fair-weather key.
//
// Usage:
//   import { worldIdentity } from "./world-identity.mjs";
//   const world = worldIdentity(ROOT);          // { mode, id, buildId, srcHash }
//   const buildId = world.id;                   // the world key, both modes
//
// The hash: sha256 over src/** files (relative path \0 bytes), sorted —
// deterministic, no timestamps, no cwd dependence. ~hundreds of files,
// single-digit milliseconds.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function hashSrcTree(root) {
  const srcDir = join(root, "src");
  if (!existsSync(srcDir)) return null;
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else files.push(p);
    }
  })(srcDir);
  files.sort();
  const h = createHash("sha256");
  for (const p of files) {
    h.update(relative(root, p));
    h.update("\0");
    h.update(readFileSync(p));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 12);
}

export function worldIdentity(root) {
  const buildIdPath = join(root, ".next/BUILD_ID");
  if (existsSync(buildIdPath)) {
    const buildId = readFileSync(buildIdPath, "utf8").trim();
    return { mode: "build", id: buildId, buildId, srcHash: null };
  }
  const srcHash = hashSrcTree(root);
  return {
    mode: "dev",
    id: `dev@${srcHash ?? "nosrc"}`,
    buildId: null,
    srcHash,
    note: "dev-server world — no production build; the world key is the src tree's content hash",
  };
}
