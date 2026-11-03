// t1170 — THE WARMUP'S API-LANE UNIT: the boot warm-up never compiles
// the whale.
//
// The t1170 certification census caught the app's own boot warm-up
// defeating the census's live-lane law: instrumentation.ts's warmBoot
// once fetched "/" ("the page itself (the canvas's own graph)") at every
// boot — and the canvas page's dev compile is a ~3.4 GB RESIDENCY on the
// 4 GB box. The measured bill, verbatim from the ride: `GET / 200 in 58s
// (compile: 58s)` in the server log, then dmesg's `Out of memory: Killed
// process 795 (next-server) … anon-rss:3379696kB` — the kernel's GLOBAL
// OOM, past the launcher's 2048 MB heap cap (the cap bounds the V8 heap;
// the whale's compiled graph stays resident outside it) — and the census's
// fuel family died with it: t1022's socket error, t1023/t1024's "FATAL:
// the server never answered 200", t1164's python leg reading a refused
// connection. The census's own comment (t927) says the canvas page is
// NEVER compiled by the census — but the law had only ONE mouth: the
// census never REQUESTS the page, while the warmup compiled it anyway on
// every boot the census made. A warm-up that kills the server is not a
// warm-up.
//
// THE CURE: the warmup rides the API lane ONLY — the "/" warm is gone;
// the canvas compiles when a real visitor opens it, once, on demand. The
// law now has TWO mouths that say the same thing: the census never
// requests the page, and the boot never compiles it.
//
// node scripts/t1170-warmup-api-lane-unit.mjs
//

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── A — the warmup's source law (src/instrumentation.ts) ────────────────

const warmSrc = read("src/instrumentation.ts");

ok("A1 the bare page warm is gone — no get(\"/\") anywhere in the file", !warmSrc.includes('get("/")'), "the whale never compiles at boot");
ok(
  "A2 the API lane intact — the five fetches remain",
  ["/api/jobs", "/log", "/api/projects", "/api/ai/settings", "/api/ai/judge-worker"].every((p) => warmSrc.includes(p)),
  "jobs · log · projects · ai/settings · judge-worker",
);
ok("A3 the whale strike's measured bill rides in the file", warmSrc.includes("anon-rss") && warmSrc.includes("Out of memory"), "the 3.38 GB residency, verbatim for the next window that asks why");
ok("A4 the census's live-lane law named as the second mouth", warmSrc.includes("NEVER compiled"), "one law, two mouths");
ok("A5 the t637 edge law intact — no static @/lib import", (() => {
  // strip comments first: the header PROSE quotes the poison
  // (`await import("@/lib/...")`) as the law's documentation — the
  // quote is the guard's sentence, not the guard's breach.
  const code = warmSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return !/from\s+["']@\/lib/.test(code) && !/import\(\s*["']@\/lib/.test(code);
})(), "the edge bundler never sees the node graph");
ok("A6 the compile budget survives — the 180s AbortSignal timeout", warmSrc.includes("AbortSignal.timeout(180_000)"), "webpack's compiles are slow; the warm must outlive them");
ok("A7 the warmup's receipt still prints", warmSrc.includes("[warmup] boot routes precompiled"), "the marks line is the boot's own witness");

// ── B — the census agreement (the two mouths, one law) ──────────────────

const censusSrc = read("scripts/t927-census.sh");

ok("B1 the census still names the live-lane law", censusSrc.includes("NEVER compiled by the census"), "the canvas page is never compiled by the census");

// The six live seats stay API-only: no bare-origin fetch, and every
// :3000/<path> literal is an /api path.
const LIVE_SEATS = [
  "t911-canvas-strip-unit",
  "t1021-import-fuel-unit",
  "t1022-fuel-face-unit",
  "t1023-watchdog-guard-unit",
  "t1024-dialog-fuel-unit",
  "t1164-takehome-proof-unit",
];
let bareFetch = null;
let nonApiPath = null;
for (const seat of LIVE_SEATS) {
  const src = read(`scripts/${seat}.mjs`);
  if (/fetch\(\s*(BASE|base|`\$\{base\}`|["'`]https?:\/\/(?:localhost|127\.0\.0\.1):3000\/?["'`])\s*[,)]/.test(src)) {
    bareFetch = seat;
  }
  const urlLiterals = src.match(/:3000(\/[a-zA-Z][^"'`\s)]*)?/g) ?? [];
  for (const lit of urlLiterals) {
    const p = lit.slice(5); // after ":3000"
    if (p && !p.startsWith("/api")) nonApiPath = `${seat}: ${p}`;
  }
}
ok("B2 the live seats never fetch the bare origin", bareFetch === null, bareFetch ? `${bareFetch} fetches the bare origin` : "all six seats");
ok("B3 every :3000 URL in the live seats is an /api path", nonApiPath === null, nonApiPath ?? "the API lane is the only lane");

ok("B4 the launcher still carries the heap cap (the API-lane boot's bound)", /export NODE_OPTIONS=.*--max-old-space-size=/.test(read("dev-server.sh")), "the cap + the API lane = the boot's whole memory story");

// ── C — the continuity (the warmup's surviving contracts) ───────────────

ok("C1 the reaper's defensive mount intact — the jobs GET stays the first warm", warmSrc.includes('await get("/api/jobs")'), "ensureGlobalReconciler mounts through it");
ok("C2 the judge worker's defensive mount intact — the status route stays warm", warmSrc.includes("/api/ai/judge-worker"), "the t574 boot-mount contract");
ok("C3 register() still gates the runtime and fires warmBoot fire-and-forget", warmSrc.includes('process.env.NEXT_RUNTIME !== "nodejs"') && warmSrc.includes("void warmBoot()"), "the listener never waits");
ok("C4 the Origin header still carried — the http-guard's same-origin door", warmSrc.includes("Origin: base") || /headers\s*=\s*\{\s*Origin:\s*base\s*\}/.test(warmSrc), "a headerless warm would 403 the guarded routes");

console.log(`\nt1170 warmup api-lane unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
