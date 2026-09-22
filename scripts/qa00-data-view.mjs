// qa00 — data-view sentinel (Task 99 lesson, retired in Task 100).
//
// The standalone server resolves DATA_DIR against ITS cwd (.next/standalone),
// and every `next build` regenerates that dir as a FROZEN SNAPSHOT of the
// real data/ tree. If the start-prod symlink restoration is ever skipped
// (direct `bun start`, pm2, a new launch method), the server and every probe
// script diverge SILENTLY: seeded workdirs invisible, engine-state records
// unread, hydration text mismatches appear under matrix load.
//
// This sentinel makes the divergence LOUD in one cheap check: create a
// uniquely-named directory on the REAL disk, then ask the SERVER to list
// data/relion via the (same-origin-guarded) fs/browse route — the probe
// name must be visible. Runs in ~2s, belongs at the head of every matrix.
//
// Run: node scripts/qa00-data-view.mjs   (server on :3000)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PROBE = `_viewprobe_${process.pid}_${Date.now()}`;

// 1. plant the probe on the REAL disk (the tree probes write to)
try {
  mkdirSync(`data/relion/${PROBE}`, { recursive: true });
  writeFileSync(`data/relion/${PROBE}/sentinel.txt`, "qa00");
} catch (e) {
  console.log(`QA00 SETUP FAIL: cannot write data/relion (${e.message})`);
  process.exit(1);
}

const b = await chromium.launch();
try {
  const p = await b.newPage();
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  // same-origin fetch from the page — the only client fs/browse accepts
  const res = await p.evaluate(async (probe) => {
    const r = await fetch(`/api/fs/browse?path=${encodeURIComponent("/home/z/my-project/data/relion")}`);
    if (!r.ok) return { ok: false, status: r.status, body: await r.text() };
    return { ok: true, body: await r.json() };
  }, PROBE);

  if (!res.ok) {
    console.log(`QA00 FAIL: fs/browse unreachable (${res.status}) ${String(res.body).slice(0, 120)}`);
    process.exit(1);
  }
  const names = JSON.stringify(res.body);
  if (!names.includes(PROBE)) {
    console.log(
      `QA00 FAIL: DATA VIEW DIVERGED — server does not see the real data/ tree.\n` +
      `  probe dir data/relion/${PROBE} missing from the listing.\n` +
      `  Fix: run scripts/start-prod.sh (restores the standalone data symlink) — do NOT boot via raw 'bun start'.`
    );
    process.exit(1);
  }
  console.log(`QA00 DATA-VIEW SENTINEL GREEN (probe "${PROBE}" visible to the server)`);
} finally {
  // world-restoring: the probe must not outlive the check
  try { rmSync(`data/relion/${PROBE}`, { recursive: true, force: true }); } catch {}
  await b.close().catch(() => {});
}
