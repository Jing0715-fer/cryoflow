#!/usr/bin/env node
// t524 — mem-profile: dissect next-server's RSS so the OOM ceiling stops
// being folklore. Three questions, answered with /proc, not vibes:
//
//   Q1  COMPOSITION — how much of next-server's RSS is V8 heap (capped by
//       dev-server.sh's --max-old-space-size=896) vs NATIVE memory (the
//       Turbopack Rust side, JIT code, mmaps) that the cap cannot touch?
//       The t520 testimony ("Turbopack 原生内存病根") becomes numbers here.
//   Q2  GROWTH — how does RSS move while the QA workload touches the app
//       (route prewarm + api polls + page navigations)? Warm-cache steady
//       state vs compile-per-route accumulation vs unbounded leak.
//   Q3  VERDICT — is the watchdog's 2.6GB recycle threshold reachable by
//       NORMAL QA traffic alone, or only under webpack-compile bursts?
//
// Usage: node scripts/mem-profile.mjs [--seconds 90] [--hit]
//   --hit  also drive page/api traffic (default: sample-only, works even
//          if the server is mid-compile)
// Output: table to stdout, saved under /tmp/cryoflow-qa/ (t503 law: logs
// live OUTSIDE the repo tree — an in-tree log feeds the watcher fire).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const seconds = (() => {
  const i = process.argv.indexOf("--seconds");
  return i >= 0 ? Number(process.argv[i + 1]) || 90 : 90;
})();
const drive = process.argv.includes("--hit");

function pickServerPid() {
  // the kernel's OOM victim is the worker ("task=next-server"), not the
  // launcher — take the fattest next-server process
  const out = execSync("pgrep -f next-server || true").toString().trim();
  let best = null;
  let bestRss = -1;
  for (const pid of out.split("\n").filter(Boolean)) {
    try {
      const kb = Number(readFileSync(`/proc/${pid}/status`, "utf8").match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
      if (kb > bestRss) {
        bestRss = kb;
        best = pid;
      }
    } catch {}
  }
  return best;
}

function sample(pid) {
  const status = readFileSync(`/proc/${pid}/status`, "utf8");
  const get = (k) => Number(status.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))?.[1] ?? 0);
  const s = {
    ts: Date.now(),
    VmRSS: get("VmRSS"),
    VmHWM: get("VmHWM"),
    anon: 0,
    file: 0,
    shmem: 0,
  };
  try {
    const roll = readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
    s.anon = Number(roll.match(/^Anonymous:\s+(\d+)/m)?.[1] ?? 0);
    s.file = Number(roll.match(/^Rss\s*FilePages|^RssFile:\s+(\d+)/m)?.[1] ?? 0);
    s.shmem = Number(roll.match(/^Shared_|^RssShmem:\s+(\d+)/m)?.[1] ?? 0);
  } catch {}
  return s;
}

const fmtMb = (kb) => (kb / 1024).toFixed(0);

const pid = pickServerPid();
if (!pid) {
  console.error("no next-server process found — is the dev lane up?");
  process.exit(1);
}
console.log(`profiling next-server pid=${pid} for ${seconds}s (drive=${drive})`);
console.log("V8 old-space cap (dev lane default): 896MB — RSS far above it is NATIVE (turbopack/jit/mmap)");

const rows = [];
const t0 = Date.now();
let n = 0;
while ((Date.now() - t0) / 1000 < seconds) {
  let s;
  try {
    s = sample(pid);
  } catch {
    console.log("server died mid-profile (OOM? watchdog recycle?) — verdict: it lost the race while we watched");
    break;
  }
  rows.push(s);
  if (n % 5 === 0) {
    console.log(
      `[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s] rss=${fmtMb(s.VmRSS).padStart(4)}MB hwm=${fmtMb(s.VmHWM).padStart(4)}MB anon=${fmtMb(s.anon).padStart(4)}MB file=${fmtMb(s.file).padStart(3)}MB`
    );
  }
  n++;
  await new Promise((r) => setTimeout(r, 1000));
}

// analysis
const first = rows[0];
const last = rows[rows.length - 1];
const peak = rows.reduce((a, b) => (b.VmRSS > a.VmRSS ? b : a), first);
const growth = last.VmRSS - first.VmRSS;
const nativeAtLast = last.VmRSS - last.anon > 0 ? last.anon : last.anon; // anon ~= heap+native jit; V8 heap share unknown cross-process, but anon vs file split is the cap story
const windowMin = ((last.ts - first.ts) / 60000).toFixed(1);

console.log("\n=== VERDICT ===");
console.log(`samples: ${rows.length} over ${windowMin}min`);
console.log(`rss first=${fmtMb(first.VmRSS)}MB last=${fmtMb(last.VmRSS)}MB peak=${fmtMb(peak.VmRSS)}MB growth=+${fmtMb(growth)}MB`);
console.log(`anon=${fmtMb(last.anon)}MB file=${fmtMb(last.file)}MB shmem=${fmtMb(last.shmem)}MB (last sample)`);
if (growth > 80 * 1024) {
  console.log("growth >80MB in the window — NOT steady state; watch which phase moved it");
} else if (growth < 10 * 1024) {
  console.log("growth <10MB in the window — warm-cache steady state");
} else {
  console.log("growth 10-80MB — mild accumulation (route compiles?)");
}

mkdirSync("/tmp/cryoflow-qa", { recursive: true });
const out = `/tmp/cryoflow-qa/t524-mem-profile-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(out, JSON.stringify({ pid, rows, verdict: { first: first.VmRSS, last: last.VmRSS, peak: peak.VmRSS, growth, anon: last.anon, file: last.file } }, null, 2));
console.log(`raw series: ${out}`);
