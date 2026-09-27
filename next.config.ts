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
  //
  // t406 — the build-memory diet, part two. Even with the build worker off
  // (custom webpack hook above), cpus: 1, webpackMemoryOptimizations and
  // minification disabled, the server compilation still peaked at 3.46GB
  // anon (dmesg ×4, kernel SIGKILL each time ~60s into `Creating an
  // optimized production build`). molstar is 97MB of 3D-viewer code being
  // COPIED INTO the server bundle; externalizing it means `require()` from
  // node_modules at runtime instead of bundling it into the compilation
  // graph. The other heavy barrels (lucide-react, recharts, framer-motion,
  // date-fns) CANNOT ride the same lane: optimizePackageImports (t391)
  // auto-includes them in transpilePackages, and the two lists conflict —
  // the t391 dev-compile memory win is kept, molstar is the bigger fish.
  serverExternalPackages: ["ssh2", "molstar"],
  reactStrictMode: false,
  // t406 — the production-build grinder. The e2e family cannot live on the
  // dev regime (t405: kernel OOM executes next-server at ~2.9GB anon, then
  // the .next cache dies mid-compile and the dev boot enters a
  // Ready->Compiling->silent-death loop with no kernel record). The way out
  // is `next build` + `next start`: zero compilation at steady state, no
  // compile-shaped process left for the reaper to hunt. But the build itself
  // was killed by the SAME kernel OOM (t406 dmesg, finally caught: build
  // worker "MainThread" at anon-rss 3.1GB, ~56s into `Creating an optimized
  // production build`, twice, identical signature). These three knobs are
  // the memory diet that lets the build finish inside the box:
  //   - webpackMemoryOptimizations: Next's own flag for exactly this
  //     (smaller webpack caches + fewer retained intermediate modules).
  //   - cpus: 1 — parallel build workers each carry a full module graph;
  //     the default (freemem-based) spawns several and they peak together.
  //   - minimize: false — minification is the largest post-compile memory
  //     spike, and a QA-world server gains nothing from a minified bundle
  //     (the served-build stamp, t401, is what QA reads, not the code).
  webpack: (config, { dev }) => {
    if (!dev) {
      config.optimization = { ...config.optimization, minimize: false };
    }
    return config;
  },
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
    // t406 — see the webpack hook above: the two build-regime knobs.
    webpackMemoryOptimizations: true,
    cpus: 1,
  },
};

export default nextConfig;
