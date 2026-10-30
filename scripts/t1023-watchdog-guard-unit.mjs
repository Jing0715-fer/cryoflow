#!/usr/bin/env node
/**
 * t1023 — THE THIN-HOST RECYCLE unit (node-only): the watchdog's recycle
 * reads the HOST's own numbers, the t1021 fuel law applied to the guardian.
 *
 * THE SHAPE (t1023's window): the v2 recycle line was a FIXED 2.6GB — and
 * the t1022 window's dmesg receipt caught the kernel shooting the server
 * at anon-rss 1970692kB, 630MB BELOW the line that was watching. The
 * kernel's kill point is not a fixed RSS: it is HOST EXHAUSTION. The cure
 * (v3): the loop reads MemAvailable from /proc/meminfo and recycles when
 * EITHER arm fires — the fat arm (rss >= 2.6GB, v2's law unchanged) or the
 * thin-host conjunction (rss >= 1.9GB soft AND avail <= 768MB floor), with
 * a 300s boot-clock cooldown as the storm law. The decision lives in ONE
 * pure function the unit rides via WATCHDOG_UNIT_MODE=1 — the real
 * arithmetic, never the kill paths.
 *
 * THE WINDOW'S SECOND PRODUCT — the INHERITANCE LAW (v3.1): the
 * single-keeper lock fd (exec 9>>) has no close-on-exec; the v2 boot()
 * passed it down the whole guarded tree (dev-server.sh -> node ->
 * next-server), so a keeper swap with a living server deadlocked — the
 * fresh keeper's flock failed against a lock held by the server's own
 * node launcher (witnessed live this window: the 11:17 boot leaked, the
 * 11:25 swap exited twice on the 15s flock retry, the world stood
 * unguarded until the carrier tree died). boot() now spawns its child
 * with 9>&-, and the header carries the swap amendment (kill the leak
 * carrier to free a leaked lock).
 *
 * BANDS:
 *   F  the guard at source: the host's own number (MemAvailable, one
 *      source of truth), the conjunction, the env-overridable constants
 *      with the witnesses in their comments, the four-number fire line,
 *      the storm law (the cooldown skip + the once-per-episode log), the
 *      rename law + the swap amendment, the inheritance law (9>&-), the
 *      unit seat BEFORE the lock (a sourced unit never fights the flock,
 *      the BASH_SOURCE verdict), and the v2 machinery untouched (the
 *      zombie arm, the dirty-cache quarantine, the single-keeper, the
 *      prewarm).
 *   F5b (t1080) — the v3.2 cure at source: the storm law covers the FAT
 *      arm too (the recycle-storm witness: generations murdered
 *      mid-compile at poll cadence because the fat arm was
 *      cooldown-free while the tree's compile burst outgrew the line).
 *
 * t1080 — THE STORM-LAW EXTENSION (v3.2): the fat arm now honors the
 * same boot-clock dwell as the thin-host arm, and the fat line was
 * re-seated 2600000 -> 2650000 (above the measured steady state
 * 2613212KB, below the kernel's host-starved kill zone 2722164 /
 * 2734924 witnessed). L3b rides the new skip; L2 rides the new
 * constant; L3's fire case moved OUTSIDE the dwell explicitly.
 *   L  LIVE rides: bash -n clean, the constants hand over, the decision
 *      truth table (fat arm / thin-host / healthy hold / below-soft hold /
 *      cooldown skip / inclusive boundaries), the real-world probes
 *      (MemAvailable plausible, next-server RSS > 0), the real-world
 *      verdict rendered — and the world gate (22 jobs, the DB high-water;
 *      the window's controlled recycle already swept, the keeper riding
 *      v3.1 with a clean lock).
 *
 * PROTOCOL: node-only, read-only toward the live world (the unit never
 * kills anything), the ORIGIN law on the fetch, exit honest, receipt to
 * shots-qa/.t1023-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const TMP = path.join(ROOT, "shots-qa/.t1023-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* the 404 HTML */ }
  return { status: res.status, json, text };
}
const jobsArr = (b) => (Array.isArray(b) ? b : b?.jobs ?? []);

/* ---------- the world gate (as-found) ---------- */
let world = null;
for (let i = 0; i < 15 && !world; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) world = jobsArr(r.json);
  } catch { /* the warmup — the window's recycle boot may still be prewarming */ }
}
if (!world) { console.error("FATAL: the server never answered 200"); process.exit(2); }
if (world.length !== 16) {
  console.error(`FATAL: world gate — jobs ${world.length} (want 16 — the t1075 replant census; the t1003 22-world's db died in the epoch rollback)`);
  process.exit(1);
}
console.log(`world: 16 jobs as-found (the keeper's recycle boot already prewarmed)`);

/* ---------- F band — the guard at source ---------- */
console.log("F band — the thin-host recycle at source:");
const sh = read("scripts/dev-server-watchdog.sh");

ok("F1 the HOST's own number (MemAvailable from /proc/meminfo — one source of truth, the t1021 law's analogue)",
  sh.includes("awk '/^MemAvailable:/{print $2; exit}' /proc/meminfo") &&
  sh.includes("host_avail_kb()"));

ok("F2 the conjunction rides the decision function (rss >= soft AND avail <= floor — one pure seat)",
  sh.includes('if [ "$rss" -ge "$RSS_SOFT_KB" ] && [ "$avail" -le "$HOST_FLOOR_KB" ]; then') &&
  sh.includes("recycle_decision()"));

ok("F3 the constants are env-overridable with the witnesses at their seats",
  sh.includes('RSS_SOFT_KB="${WATCHDOG_RECYCLE_SOFT_KB:-1900000}"') &&
  sh.includes('HOST_FLOOR_KB="${WATCHDOG_HOST_FLOOR_KB:-786432}"') &&
  sh.includes('RECYCLE_COOLDOWN_S="${WATCHDOG_RECYCLE_COOLDOWN_S:-300}"') &&
  sh.includes("1970692"));

ok("F4 the fire line carries ALL FOUR numbers and the arm (the log IS the verdict's receipt)",
  sh.includes("recycle: ${decision} — thresholds fat>=${RSS_RECYCLE_KB}KB soft>=${RSS_SOFT_KB}KB floor<=${HOST_FLOOR_KB}KB — controlled recycle before the kernel OOM does it"));

ok("F5 the storm law (the cooldown skip inside the decision + the once-per-episode log)",
  sh.includes('echo "skip cooldown rss=${rss}KB avail=${avail}KB since_boot=${since_boot}s"') &&
  sh.includes('if [ "$skip_logged" = 0 ]; then') &&
  sh.includes("the boot clock guards the storm"));

ok("F6 the rename law + the swap amendment live in the header (write NEW -> bash -n -> mv -> restart; the leaked-lock cure)",
  sh.includes("THE RENAME LAW (t1023") &&
  sh.includes("THE SWAP AMENDMENT (t1023") &&
  sh.includes("leak carrier is the server tree"));

ok("F7 the INHERITANCE LAW — boot() closes fd 9 toward the guarded tree (9>&-), the lock never rides node/next-server",
  sh.includes('bash scripts/dev-server.sh 9>&- >> "$LOG" 2>&1') &&
  sh.includes("THE INHERITANCE LAW"));

ok("F8 the unit seat BEFORE the lock (a sourced unit never fights the flock — the BASH_SOURCE verdict)",
  sh.indexOf("WATCHDOG_UNIT_MODE:-0") < sh.indexOf("exec 9>>") &&
  sh.includes('if [ "${BASH_SOURCE[0]}" != "$0" ]; then'));

ok("F9 the v2 machinery untouched (the zombie arm, the dirty-cache quarantine, the single-keeper, the prewarm)",
  sh.includes("lock-dead zombie, executing") &&
  sh.includes("OOM-corrupted-cache signature, quarantining .next") &&
  sh.includes("lock held through 15s of retries") &&
  sh.includes("prewarm: / answers (attempt $i)"));

ok("F5b (t1080) the storm law covers the FAT arm (the v3.2 cure: a burst above the fat line inside the dwell is growth in flight, never killed mid-compile) + the line re-seated above the measured steady state",
  sh.includes('echo "skip cooldown fat rss=${rss}KB avail=${avail}KB since_boot=${since_boot}s"') &&
  sh.includes('RSS_RECYCLE_KB="${WATCHDOG_RECYCLE_KB:-2650000}"') &&
  sh.includes("THE STORM LAW COVERS THE FAT ARM"));

/* ---------- L band — the decision live ---------- */
console.log("L band — the decision arithmetic live (WATCHDOG_UNIT_MODE=1):");

const bashRun = (script) => {
  // the ride never approaches the kill paths: UNIT_MODE returns before the
  // lock and the loop; the harness prints SENTINEL so a silent exit (the
  // old lock-fight bug) cannot pass as a verdict
  const out = execFileSync("bash", ["-c", script], { encoding: "utf8", timeout: 30000 });
  return out;
};
const harness = (body) => `export WATCHDOG_UNIT_MODE=1
source scripts/dev-server-watchdog.sh
echo "SENTINEL $?"
${body}`;

try {
  execFileSync("bash", ["-n", path.join(ROOT, "scripts/dev-server-watchdog.sh")], { timeout: 15000 });
  ok("L1 bash -n clean on the live script", true);
  const out = bashRun(harness('echo "constants: RECYCLE=$RSS_RECYCLE_KB SOFT=$RSS_SOFT_KB FLOOR=$HOST_FLOOR_KB COOLDOWN=$RECYCLE_COOLDOWN_S"'));
  ok("L2 the constants hand over (defaults + the env seats — the t1080 re-seated fat line)",
    out.includes("SENTINEL 0") &&
    out.includes("RECYCLE=2650000 SOFT=1900000 FLOOR=786432 COOLDOWN=300"));
} catch (e) {
  ok("L1 bash -n clean on the live script", false, String(e).slice(0, 120));
  ok("L2 the constants hand over", false, String(e).slice(0, 120));
}

const decide = (rss, avail, since) => {
  const out = bashRun(harness(`echo "v=$(recycle_decision ${rss} ${avail} ${since})"`));
  const m = out.match(/v=(.+)/);
  return m ? m[1].trim() : "(silent)";
};

ok("L3 the fat arm fires past the dwell (v2's law, host health irrelevant — but the t1080 dwell applies)",
  decide(2700000, 3000000, 99999).startsWith("fire fat"));
ok("L3b (t1080) the fat arm skips inside the dwell (a burst above the fat line at 60s of age is a compile in flight, not steady fat)",
  decide(2700000, 3000000, 60).startsWith("skip cooldown fat"));
ok("L3c (t1080) the re-seated boundary holds: the measured steady state 2613212KB holds past the dwell (no idle churn), a hair above it (2660000) fires",
  decide(2613212, 3000000, 99999).startsWith("hold") &&
  decide(2660000, 3000000, 99999).startsWith("fire fat"));
ok("L4 the thin-host conjunction fires (the t1022 kill shape: 2.25GB server, 730MB host)",
  decide(2254512, 747520, 99999).startsWith("fire thin-host"));
ok("L5 the healthy world holds (fat server, roomy host — no recycle)",
  decide(2254512, 3000000, 99999).startsWith("hold"));
ok("L6 the below-soft server holds (a skinny server is not the recycle's business)",
  decide(1800000, 500000, 99999).startsWith("hold"));
ok("L7 the storm law skips inside the dwell (the boot clock guards the cadence)",
  decide(2254512, 747520, 60).startsWith("skip cooldown"));
ok("L8 the boundaries are inclusive (>= soft / <= floor fire at the edge)",
  decide(1900000, 786432, 99999).startsWith("fire thin-host"));

try {
  const out = bashRun(harness(`echo "rss=$(next_server_rss_kb) avail=$(host_avail_kb)"
echo "verdict=$(recycle_decision "$(next_server_rss_kb)" "$(host_avail_kb)" 99999)"`));
  const rss = Number(out.match(/rss=(\d+)/)?.[1] ?? 0);
  const avail = Number(out.match(/avail=(\d+)/)?.[1] ?? 0);
  const verdict = out.match(/verdict=(\S+)/)?.[1] ?? "";
  ok("L9 the real-world probes answer (the server's RSS > 0, MemAvailable plausible)",
    rss > 0 && avail > 0 && avail < 4200000, `rss=${rss} avail=${avail}`);
  ok("L10 the real-world verdict renders (fire | skip | hold — never silent)",
    /^(fire|skip|hold)/.test(verdict), `verdict=${verdict}`);
} catch (e) {
  ok("L9 the real-world probes answer", false, String(e).slice(0, 120));
  ok("L10 the real-world verdict renders", false, String(e).slice(0, 120));
}

/* ---------- the world gate (as-left) ---------- */
console.log("world gate — as-left:");
let worldAfter = null;
for (let i = 0; i < 10 && !worldAfter; i++) {
  if (i > 0) await sleep(1000);
  try {
    const r = await api("GET", "/api/jobs");
    if (r.status === 200) worldAfter = jobsArr(r.json);
  } catch { /* the beat */ }
}
ok("the world as-left (16 jobs — the t1075 replant re-key; the window's controlled recycle swept clean)",
  worldAfter?.length === 16, `got ${worldAfter?.length}`);
const dbBytes = statSync(path.join(ROOT, "db/cryoflow.db")).size;
ok("the DB byte size held (the high-water — the t1080 re-key: the qa60 FSC fixtures' create/delete cycle grew the file; the WORLD stands 16)", dbBytes === 147456, `${dbBytes}`);

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1023-watchdog-guard-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["F the guard at source", "L the decision arithmetic live"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);
