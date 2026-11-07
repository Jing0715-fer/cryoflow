#!/usr/bin/env node
/**
 * t875 — the rotation law's missing tool: THE FLEET ROTATION CONDUCTOR.
 *
 * The a11y rotation's first full circuit closed at t874 (t843 → t874, the
 * profiles editor was the last standing room). The t874 verdict: "the
 * fleet now re-rides on ROTATION rather than opening new rooms." Until
 * now that law lived in prose — every window hand-ran its rides. This
 * conductor MAKES the law executable: one command rides the standing
 * fleet in order, keeps each ride's own receipt untouched, and writes
 * ONE fleet-level receipt — the rotation's roll-up.
 *
 * The fleet (the standing a11y walks, birth order):
 *
 *   t843  the a11y re-witness          scripts/t843-a11y-rewitness.mjs
 *   t844  the fragile pair             scripts/t844-a11y-fragile-pair.mjs
 *   t869  the text preview's face      scripts/t869-textpreview-a11y.mjs
 *   t870  the AI panel's conversation  scripts/t870-aipanel-a11y.mjs
 *   t871  the transcript copy door     scripts/t871-transcript-copy-a11y.mjs
 *   t873  the compare dialogs          scripts/t873-compare-dialogs-a11y.mjs
 *   t874  the profiles editor          scripts/t874-profiles-editor-a11y.mjs
 *
 * The t846 sweep is NOT aboard — the gate rides first, alone, by the
 * receipt-first convention; the conductor notes its receipt's date as
 * the gate's provenance.
 *
 * Usage:
 *   node scripts/t875-fleet-rotation.mjs                # the FULL fleet
 *   node scripts/t875-fleet-rotation.mjs --only t873,t874   # a slice
 *   node scripts/t875-fleet-rotation.mjs --from t870    # from a member on
 *
 * Each ride gets its own wall-clock budget (the walks' own timeouts are
 * internal; the conductor adds a hard ceiling). A ride's exit code and
 * duration are recorded; its receipt JSON stays its own — the conductor
 * aggregates verdicts, never rewrites history.
 *
 * Receipt: shots-qa/t875-fleet-rotation.json.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";

const ROOT = process.cwd();
const SHOTS = join(ROOT, "shots-qa");

/* the standing fleet, birth order — the rotation's own census */
const FLEET = [
  { id: "t843", script: "scripts/t843-a11y-rewitness.mjs", room: "the a11y re-witness" },
  { id: "t844", script: "scripts/t844-a11y-fragile-pair.mjs", room: "the fragile pair" },
  { id: "t869", script: "scripts/t869-textpreview-a11y.mjs", room: "the text preview's face" },
  { id: "t870", script: "scripts/t870-aipanel-a11y.mjs", room: "the AI panel's conversation" },
  { id: "t871", script: "scripts/t871-transcript-copy-a11y.mjs", room: "the transcript copy door" },
  { id: "t873", script: "scripts/t873-compare-dialogs-a11y.mjs", room: "the compare dialogs' deep faces" },
  { id: "t874", script: "scripts/t874-profiles-editor-a11y.mjs", room: "the profiles editor's interior" },
  { id: "t877", script: "scripts/t877-rescan-live-world.mjs", room: "the rescan's live world (the strip's manual half, born from a RUNNING seed)" },
];

/* the receipt each member writes — the conductor reads the ride's own
 * pass/failed counts back from it (a verdict quoted from the receipt,
 * not from stdout alone) */
const RECEIPT_OF = {
  t843: "t843-a11y-rewitness.json",
  t844: "t844-a11y-fragile-pair.json",
  t869: "t869-textpreview-a11y.json",
  t870: "t870-aipanel-a11y.json",
  t871: "t871-transcript-copy-a11y.json",
  t873: "t873-compare-dialogs-a11y.json",
  t874: "t874-profiles-editor-a11y.json",
  t877: "t877-rescan-live-world.json",
};

/* ---------- args ---------- */
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? "";
};
const merge = args.includes("--merge");
let roster = FLEET;
const only = flag("--only");
const from = flag("--from");
if (only) {
  const ids = only.split(",").map((s) => s.trim());
  const missing = ids.filter((id) => !FLEET.some((f) => f.id === id));
  if (missing.length) {
    console.error(`unknown fleet id(s): ${missing.join(", ")} — the fleet is ${FLEET.map((f) => f.id).join(", ")}`);
    process.exit(2);
  }
  roster = FLEET.filter((f) => ids.includes(f.id));
} else if (from) {
  const at = FLEET.findIndex((f) => f.id === from);
  if (at === -1) {
    console.error(`unknown fleet id: ${from}`);
    process.exit(2);
  }
  roster = FLEET.slice(at);
}

/* ---------- provenance ---------- */
const world = worldIdentity(ROOT);
console.log(
  `t875 fleet rotation — world ${world.mode}:${world.id}, ${roster.length} of the ${FLEET.length} standing rides ` +
  `(the t874 law's first execution: the fleet re-rides on rotation)\n` +
  `roster: ${roster.map((f) => f.id).join(" → ")}\n` +
  `gate provenance: the t846 sweep's receipt ${existsSync(join(SHOTS, "t846-a11y-maintenance.json")) ? "aboard (rides first, alone, by the receipt-first convention)" : "ABSENT — ride the gate before the rotation"}`
);

/* ---------- the gate's receipt date, read as provenance ---------- */
let gateDate = null;
try {
  gateDate = JSON.parse(readFileSync(join(SHOTS, "t846-a11y-maintenance.json"), "utf8")).date ?? null;
} catch {
  /* the gate's receipt unreadable — recorded as null, never invented */
}

/* ---------- the rides ----------
 * THE CONDUCTOR RIDES ATTACHED — the sandbox's reaper takes long-lived
 * background trees (two nohup/setsid launches died mid-ride, silent,
 * receipts untouched); one foreground call carries one slice, and
 * --merge accumulates the slices into ONE receipt honestly. */
const RIDGE_CEILING_MS = 420_000; // one ride's hard ceiling (the walks' internal timeouts are tighter)
const rides = [];
let green = 0;
for (const member of roster) {
  const started = Date.now();
  let exit = null;
  let tail = "";
  try {
    const out = execFileSync("node", [member.script], {
      encoding: "utf8",
      cwd: ROOT,
      timeout: RIDGE_CEILING_MS,
      killSignal: "SIGKILL",
    });
    exit = 0;
    tail = out.slice(-400);
  } catch (err) {
    exit = err.status ?? (err.killed ? 124 : 1);
    tail = String(err.stdout ?? "").slice(-400) + String(err.stderr ?? "").slice(-200);
  }
  const secs = Math.round((Date.now() - started) / 1000);
  /* the ride's own receipt, read back — the verdict quoted from history */
  let receipt = null;
  try {
    receipt = JSON.parse(readFileSync(join(SHOTS, RECEIPT_OF[member.id]), "utf8"));
  } catch {
    /* a ride that wrote no receipt is its own red, whatever its exit said */
  }
  const receiptGreen = receipt ? Number(receipt.failed ?? 1) === 0 && Number(receipt.passed ?? 0) > 0 : false;
  const ok = exit === 0 && receiptGreen;
  if (ok) green++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${member.id} ${member.room}  exit=${exit} ${secs}s` +
    (receipt ? `  receipt ${receipt.passed}/${(Number(receipt.passed) ?? 0) + (Number(receipt.failed) ?? 0)}` : "  receipt ABSENT") +
    (ok ? "" : `  tail: ${tail.replace(/\n+/g, " | ").slice(-220)}`)
  );
  rides.push({
    id: member.id,
    script: member.script,
    room: member.room,
    exit,
    seconds: secs,
    receipt: receipt ? { passed: receipt.passed, failed: receipt.failed, date: receipt.date, build: receipt.build } : null,
    ok,
  });
}

/* ---------- the fleet roll-up (merge: the receipt accumulates the
 * slices — same build only; a moved key starts a new receipt) ---------- */
const outPath = join(SHOTS, "t875-fleet-rotation.json");
let merged = null;
if (merge && existsSync(outPath)) {
  try {
    const prior = JSON.parse(readFileSync(outPath, "utf8"));
    if (prior.build === world.id && Array.isArray(prior.rides)) {
      merged = prior;
    }
  } catch {
    /* an unreadable prior is not history — start fresh */
  }
}
let allRides = rides;
let rosterIds = roster.map((f) => f.id);
let mode = only ? `slice (--only ${only})` : from ? `slice (--from ${from})` : "full fleet";
if (merged) {
  const byId = new Map(merged.rides.map((r) => [r.id, r]));
  for (const r of rides) byId.set(r.id, r); // this call's rides are the newer truth
  allRides = FLEET.filter((f) => byId.has(f.id)).map((f) => byId.get(f.id));
  rosterIds = Array.from(new Set([...(merged.roster ?? []), ...rosterIds]));
  mode = `${mode} + merged from ${merged.date}`;
}
const total = allRides.length;
const greenCount = allRides.filter((r) => r.ok).length;
const verdict =
  greenCount === total
    ? `the rotation re-rides green: ${greenCount}/${total} standing walks held their faces on this key ` +
      `(each ride's own receipt standing as its history; the conductor aggregates, never rewrites)`
    : `${total - greenCount} of ${total} rides RED — the rotation's re-ride found a moved face; ` +
      `call the census's own instruments before any UI work`;

console.log(`\nFLEET-ROTATION t875: ${greenCount}/${total} ${greenCount === total ? "green" : "RED"} — ${verdict}`);

const receipt = {
  instrument: "scripts/t875-fleet-rotation.mjs",
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  law: "the fleet re-rides on rotation rather than opening new rooms (the t874 verdict — the rotation's first full circuit closed)",
  gate: { instrument: "scripts/t846-a11y-maintenance.mjs", receiptDate: gateDate, ridesSeparately: "the receipt-first convention — the gate rides first, alone" },
  roster: rosterIds,
  mode,
  rides: allRides,
  green: greenCount,
  total,
  verdict,
};
writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`receipt: ${outPath}`);
process.exit(greenCount === total ? 0 : 1);
