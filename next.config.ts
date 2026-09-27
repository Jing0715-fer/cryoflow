import { createRequire } from "module";
import { execSync } from "node:child_process";
import path from "path";
import type { NextConfig } from "next";

/* ---------------------------------------------------------------------- */
/* Build stamp (t401) — which code is this app actually running?         */
/* ---------------------------------------------------------------------- */
/* The recurring support loop (「git pull 后看到的还是旧的 UI」) has one
 * honest root: a `next start` process serves the code it was BUILT from
 * — .next/standalone is a compiled snapshot, and `git pull` only swaps
 * the source it came from. A dev server can likewise ride a stale
 * Turbopack cache past a pull. The stamp resolves the checkout's git
 * SHA once, at config-load time (dev boot AND build boot), and the
 * footer prints it: "build 303afa4" in the corner ends the guessing —
 * compare it to `git rev-parse --short HEAD` and you know in one glance
 * whether the serving process owes you a restart (dev) or a rebuild
 * (production). The value is a snapshot of process birth, on purpose:
 * the stamp answers "what was this process fed", not "what's on disk"
 * — the disk is `git log`'s job. */
function resolveBuildStamp(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
      .slice(0, 7);
  } catch {
    // not a git checkout (exported archive, detached CI copy) — say so
    // instead of dying: the footer prints "build ?" and the tooltip
    // still teaches the restart/rebuild contract.
    return "?";
  }
}
const buildStamp = resolveBuildStamp();

/* ---------------------------------------------------------------------- */
/* Dependency guard (t274) — say the fix before the overlay does.         */
/* ---------------------------------------------------------------------- */
/* The remote-cluster feature added `ssh2` to package.json. A checkout
 * whose node_modules predates that (git pull without a reinstall) compiles
 * every page fine, then detonates on the FIRST /api/remote/* touch with
 * Turbopack's "Module not found: Can't resolve 'ssh2'" — an overlay that
 * names the package but not the remedy. Resolving the package HERE, at
 * config-load time (dev AND build boot), lets the server print the remedy
 * before the user ever reaches the overlay. Warn-only on purpose: without
 * ssh2 the app is fully usable except the remote routes, so a hard exit
 * would punish exactly the local-only users who don't need the dep.
 *
 * createRequire is anchored at <cwd>/package.json — the process root for
 * `next dev`, `next build` and the standalone server alike — so it never
 * accidentally resolves through Next's own node_modules. */
const resolveFromRoot = createRequire(path.join(process.cwd(), "package.json")).resolve;
const missingDeps = ["ssh2"].filter((dep) => {
  try {
    resolveFromRoot(dep);
    return false;
  } catch {
    return true;
  }
});
if (missingDeps.length > 0) {
  console.warn(
    [
      "",
      "--------------------------------------------------------------------------",
      " CryoFlow: node_modules is out of date — missing " + missingDeps.join(", "),
      "",
      " This checkout gained dependencies your install does not have yet",
      " (ssh2 is the SSH transport for the remote-RELION feature).",
      " Fix, from the repo root:",
      "",
      "     npm install        # or: bun install / pnpm install",
      "",
      " Then restart the dev server. Until then, every /api/remote/* route",
      " fails with \"Module not found: Can't resolve 'ssh2'\".",
      "--------------------------------------------------------------------------",
      "",
    ].join("\n"),
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  // t401 — inlined at compile time (client) / build time (standalone):
  // the footer's "build <sha>" is the served process's own version.
  env: {
    NEXT_PUBLIC_BUILD_SHA: buildStamp,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  // t273: the box's environment layer drops root-owned scratch dirs into the
  // repo root (observed: tool-results/, mode 700 root:root) — the file
  // tracer enumerates the project tree, hits EACCES, and the whole build
  // dies with "Failed to write app endpoint /page". Excluded by name: the
  // tracer never needs scratch data, and a directory the shell cannot even
  // list must not be able to take the build hostage.
  // t274: the early-era data trees (persist/, relion-projects/,
  // mini-services/ — 3.3G of untracked runtime data the product never
  // reads) moved into the single _legacy-archive/ quarantine root, so the
  // tracer excludes ONE name instead of three; tailwind's @source not in
  // globals.css mirrors this one-for-one. The qa68 detector fails loudly
  // if any legacy name ever reappears in the repo root.
  outputFileTracingExcludes: {
    "*": ["tool-results/**", "_legacy-archive/**"],
  },
  // ssh2 (t261-remote's transport) is a Node-only lib whose dynamic
  // requires Turbopack cannot place into ESM chunks ("non-ecmascript
  // placeable asset" on lib/protocol/crypto.js) — keep it OUT of the
  // bundle: the standalone server requires it from node_modules at
  // runtime, which is exactly where it lives.
  serverExternalPackages: ["ssh2"],
  reactStrictMode: false,
  experimental: {
    // t391 — barrel-file tree shaking for the three big icon/chart barrels:
    // lucide-react exports ~1500 icons through one index, recharts pulls the
    // whole d3-family surface, framer-motion re-exports its entire runtime.
    // Without this flag every dev compile walks the full graph (the OOM
    // pressure on small boxes) and the client bundle ships imports it never
    // renders. Verified shape-preserving: named imports keep working, the
    // module graph just shrinks to what each module actually names.
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
    // 4GB box shared with a Chrome QA session — the default (6 GiB) lets the
    // Turbopack engine balloon until the kernel OOM-kills next-server mid-QA
    // (observed 4× on 2026-09-08: RSS 2.7-2.8 GB at kill time). 1400 MiB for
    // the Rust engine + 1536 MiB V8 old-space (dev-server.sh) keeps the
    // server under the ceiling; compiles get slower, not broken.
    turbopackMemoryLimit: 256,
  },
};

export default nextConfig;
