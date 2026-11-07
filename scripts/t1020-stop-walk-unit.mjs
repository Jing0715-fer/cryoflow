#!/usr/bin/env node
/**
 * t1020 — THE STOP WALK LEG unit (node-only): the native stop arm's UI
 * face pinned at source — the real dialog's door that the walk leg
 * drives on camera (the t1015 unit rode the arm via API; this face is
 * the door a HUMAN clicks).
 *
 * THE WALK LEG: the t1020 window walks the stop door's key path through
 * the REAL inspector — a minted native import runs (the Run door's
 * confirm), the inspector's Stop button is clicked mid-flight, the
 * receipt's words land on camera (the toast's title, the row's failed
 * speech), and the world sweeps. The t1014 walk's leg-11 descope is now
 * fully paid for the stop face.
 *
 * THE LAWS PINNED HERE (the UI face — engine/route laws live in t1015):
 *   W  the door at source: the inspector's Stop button (its busy
 *      aria-label ternary, its aria-busy confession, the store's stopJob
 *      call, the Square icon + the word), the store's receipt dialect
 *      (the four titles verbatim, the legacy fallback, the t934 promise
 *      clause riding only confirmed kills of the remote resumable
 *      family), the route's native speech (the words the walk leg
 *      verifies on the row), and the honest catch-all
 *
 * PROTOCOL: node-only, readFileSync includes, exit honest, receipt to
 * shots-qa/.t1020-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1020-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const insp = read("src/components/workflow/job-inspector.tsx");
const store = read("src/lib/store.ts");
const route = read("src/app/api/jobs/[id]/stop/route.ts");

/* ---------- W band — the door at source ---------- */
console.log("W band — the stop door at source (the inspector's own button):");
ok("W1 the inspector carries the stop door (the busy aria-label ternary)",
  insp.includes('aria-label={busy ? "Stop (the stop request is in flight)" : "Stop"}'));
ok("W2 the door confesses busy (aria-busy) and calls the store's stopJob",
  /aria-busy=\{busy\}/.test(insp) &&
  insp.includes("void stopJob(job.id).finally(() => setBusy(false));"));
ok("W3 the door's visual voice — the Square icon and the word, in the running branch",
  insp.includes('<Square className="size-3.5" aria-hidden="true" />') &&
  insp.includes("<span>Stop</span>"));
ok("W4 the store's receipt — the four titles verbatim (t618's three classes, t624's verdict)",
  store.includes('"Job stopped"') &&
  store.includes('"Stop accepted — the cluster is tearing it down"') &&
  store.includes('"Stop missed — nothing to kill"') &&
  store.includes('"Job already ended"'));
ok("W5 the legacy fallback keeps old shapers honest",
  store.includes('data.stopped\n                ? "Job stopped"') ||
  /data\.stopped\s*\?\s*"Job stopped"\s*:\s*"Job already ended"/.test(store));
ok("W6 the t934 promise clause rides only confirmed kills of the remote resumable family",
  store.includes('data.outcome === "killed" && !!data.job?.runRemote && resumeFamily.includes(data.job?.type ?? "")') &&
  store.includes("re-run resumes from the last synced checkpoint`") &&
  store.includes('const resumeFamily = ["class2d", "class3d", "refine3d", "initialmodel", "multibody"];'));
ok("W7 the route's native speech — the words the walk leg verifies on the row (t1015's own)",
  route.includes('"stopped by user (the in-process run unwound at its abort gate)"'));
ok("W8 the killed+unsettled title is the plain stop (the verdict ternary's default arm)",
  /data\.outcome === "killed"\s*\n\s*\? data\.settled === false\s*\n\s*\? "Stop accepted — the cluster is tearing it down"\s*\n\s*: "Job stopped"/.test(store));
ok("W9 the catch-all speaks honestly (the errToast fallback)",
  store.includes('"Failed to stop job"'));

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1020-stop-walk-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["W the stop door at source (inspector button, receipt dialect, route words)"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);
