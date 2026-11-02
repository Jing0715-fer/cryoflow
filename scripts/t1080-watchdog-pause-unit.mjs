#!/usr/bin/env node
/**
 * t1080 — THE PAUSE DOOR (the build day's own law, instrumented).
 *
 * The t1079 constitution verdict named the build day's enemy: the keeper's
 * own RESURRECT law (the build stops the dev lane, the keeper reads the
 * silence as a corpse, the dev server boots MID-BUILD, the kernel draws —
 * the walk's death, on the build lane). This window:
 *
 *   1. the watchdog's v4 PAUSE DOOR — the FLAG file for the RUNNING keeper
 *      (touch → every arm holds, the log speaks ONCE per episode) and the
 *      ENV birth control for a keeper not yet born
 *      (CRYOFLOW_NO_WATCHDOG=1, executed mode only);
 *   2. the guard's CONSTITUTION AMENDMENT — the wall's LIVE witness
 *      (dmesg's most recent OOM kill beside the era notes), the PAUSE-FIRST
 *      verdict (a live keeper + no flag refuses the build with the exact
 *      commands), and both doors named in the recipe;
 *   3. the LIVE receipt — the pause door fired on camera this window:
 *      flag touched 21:35:13Z → the PAUSED line at 21:35:21Z (8s, once)
 *      → flag lifted 21:35:28Z. L1 pins that receipt's existence in the
 *      keeper's own log.
 *
 * PROTOCOL: node-only, no imports from src — readFileSync pins on the two
 * scripts + the live log receipt, exit honest.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const wd = readFileSync(path.join(ROOT, "scripts/dev-server-watchdog.sh"), "utf8");
const guard = readFileSync(path.join(ROOT, "scripts/build-guard.sh"), "utf8");
const PAUSE_LOG = "/tmp/cryoflow-qa/dev-watchdog.log";

let pass = 0, fail = 0;
const pin = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* ---- W band — the watchdog's v4 door ---- */
console.log("W band — the watchdog's pause door (the RUNNING keeper's and the unborn's)");
pin("W1 the flag constant rides the shared QA_LOG_DIR shape (one door, both scripts derive the same path)",
  wd.includes('WATCHDOG_PAUSE_FILE="$QA_LOG_DIR/dev-watchdog.pause"') &&
    wd.includes('QA_LOG_DIR="${CRYOFLOW_QA_LOG_DIR:-/tmp/cryoflow-qa}"') &&
    guard.includes('PAUSE_FILE="${CRYOFLOW_QA_LOG_DIR:-/tmp/cryoflow-qa}/dev-watchdog.pause"'));
pin("W2 pause_decision is the file's existence law and nothing else (the pure-decision seat, the recycle_decision pattern)",
  /pause_decision\(\) \{\s*\n\s*if \[ -f "\$WATCHDOG_PAUSE_FILE" \]; then echo "paused"; else echo "live"; fi\s*\n\}/.test(wd));
pin("W3 the loop's pause seat is FIRST (before the health curl — the paused keeper does zero work), speaks ONCE per episode, and sleeps through",
  wd.includes('if [ "$(pause_decision)" = "paused" ]; then') &&
    wd.indexOf('if [ "$(pause_decision)" = "paused" ]; then') < wd.indexOf("if curl -s -o /dev/null --max-time 3") &&
    /PAUSED — flag file seen \(\$WATCHDOG_PAUSE_FILE\); every arm holds\. Lift with: rm \$WATCHDOG_PAUSE_FILE/.test(wd) &&
    /pause_logged=1\s*\n\s*fi\s*\n\s*sleep 10\s*\n\s*continue\s*\n\s*fi\s*\n\s*pause_logged=0/.test(wd));
pin("W4 the birth control: CRYOFLOW_NO_WATCHDOG=1 declines the birth AFTER the unit-mode return (sourced units never exit) and BEFORE the flock (a declined keeper never takes the lock)",
  /if \[ "\$\{CRYOFLOW_NO_WATCHDOG:-0\}" = "1" \]; then\s*\n\s*echo "[^"]*declines to be born/.test(wd) &&
    wd.indexOf('CRYOFLOW_NO_WATCHDOG:-0') > wd.indexOf("WATCHDOG_UNIT_MODE:-0") &&
    wd.indexOf('CRYOFLOW_NO_WATCHDOG:-0') < wd.indexOf('exec 9>>'));

/* ---- G band — the guard's constitution amendment ---- */
console.log("G band — the guard's amendment (the witness, the verdict, the doors)");
pin("G1 the wall's LIVE witness: dmesg's most recent OOM kill printed beside the era notes (the line is the BOX's — the t415 float law's words in the verdict's face)",
  guard.includes('dmesg 2>/dev/null | grep "Out of memory: Killed" | tail -1') &&
    guard.includes("anon-rss:") &&
    guard.includes("the line is the BOX's, it floats with the load (t415)") &&
    guard.includes("the t461/t524 build kills sat at ~3.0GB, the t1079 serving kills at ~2.3GB"));
pin("G2 the PAUSE-FIRST verdict: a live keeper + no flag refuses the build (exit 3) with the exact touch/rm commands",
  guard.includes('if pgrep -f "bash scripts/dev-server-watchdog.sh" > /dev/null && [ ! -f "$PAUSE_FILE" ]; then') &&
    guard.includes("touch $PAUSE_FILE") &&
    guard.includes("rm $PAUSE_FILE") &&
    /exit 3/.test(guard));
pin("G3 the PAUSE-FIRST verdict's story names the resurrect race (the t1079 walk's death, on the build lane)",
  guard.includes("it WILL resurrect the dev server mid-build") &&
    guard.includes("the keeper's RESURRECT law reads the"));
pin("G4 the NO-GO cure names the v4 door (the flag touch), not the ghost env alone — the guard's own instruction must be IMPLEMENTED law",
  guard.includes("pause the keeper (touch $PAUSE_FILE — the v4 door)"));
pin("G5 the recipe names BOTH doors: the flag STAYS through the build; the env covers a keeper not yet born",
  guard.includes("During the build: the pause flag STAYS (the keeper's arms hold) and the dev lane") &&
    guard.includes("CRYOFLOW_NO_WATCHDOG=1 (v4 birth control)"));

/* ---- L band — the LIVE receipt ---- */
console.log("L band — the pause door fired on camera this window");
if (existsSync(PAUSE_LOG)) {
  const log = readFileSync(PAUSE_LOG, "utf8");
  pin("L1 the keeper's own log carries the LIVE PAUSED receipt (flag touched 21:35:13Z → the line at 21:35:21Z → lifted 21:35:28Z) — the door verified on the RUNNING keeper",
    /PAUSED — flag file seen \(\/tmp\/cryoflow-qa\/dev-watchdog\.pause\); every arm holds/.test(log));
} else {
  pin("L1 the keeper's log exists (the LIVE receipt's home)", false, `${PAUSE_LOG} missing — the receipt rotted; re-fire the door (touch the flag, wait a cycle) and re-run`);
}

/* the receipt */
console.log(`t1080-watchdog-pause-unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
