// t883 — THE HARNESS CURE UNIT: the census's live-leg learns the honest
// AMBER verdict, and the cure gets its own pins.
//
// The window's story: the t1021 judgment closed last window — the seat rode
// 19/19 ALONE for the THIRD window while the census kept grading it RED,
// because the census's shared lane (the OOM war's own whale) died mid-ride
// and every live seat AFTER the death answered RED with count=? — a harness
// wound dressed as six seat wounds. The cure rides two laws:
//
//   1. THE PRECONDITION — before each live seat, probe the lane; a dead
//      lane the census OWNS reboots ONCE and re-probes; an external lane
//      is not the census's to raise (the same law that keeps it from being
//      killed). A lane that stays dead skips the seat honestly.
//   2. THE HONEST VERDICT — AMBER, not RED: the seat never ran, so the
//      seat earned no grade; the harness's own wound is the harness's own
//      line, and the seat's real record is finally believed.
//
// The URL is parameterized (CENSUS_LANE_URL) so THIS unit can drive the
// AMBER path against a dead port and the healthy path against a real
// HTTP listener — the cure is TESTED, not just pinned (a bash harness
// that only ships source pins is a drawing).
//
// node scripts/t883-harness-cure-unit.mjs
//

import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const ROOT = "/home/z/my-project";
const census = readFileSync(`${ROOT}/scripts/t927-census.sh`, "utf8");

// ── W — the source laws (the cure's text) ────────────────────────────────

ok("W1 the precondition exists", census.includes("live_lane_ok() {") && census.includes("run_live_seat() {"), "the probe and the guarded runner are named");
ok("W2 the reboot is a ONE-shot, not a loop of hope", census.includes("reboots ONCE") && /reboot_my_lane\(\) \{/.test(census), "the reboot cap is said at the source");
ok("W3 the honest verdict is AMBER, not RED", census.includes('echo "AMBER ${name}: lane-dead unavailable'), "the harness's own wound wears the harness's own line");
ok("W4 the external lane is not the census's to raise", census.includes("external lane, not mine to reboot"), "the same law that keeps the census from killing it");
ok("W5 the live-seat loop rides the guarded runner (the serverless crowd keeps the direct runner)", census.includes('run_live_seat "$idx" "${NAMES[$idx]}"') && /is_live_seat "\$\{NAMES\[\$idx\]\}" && continue\n  run_one "\$idx"/.test(census), "the probe guards the API-dependent seats only");
ok("W6 the lane URL is parameterized for the unit's dead-port drive", census.includes('CENSUS_LANE_URL="${CENSUS_LANE_URL:-http://localhost:3000}"'), "the cure is testable, not just pinned");
ok("W9 the judgment is documented at the cure", census.includes("t1021 rode 19/19 alone THREE windows") || census.includes("t1021 rode 19/19 alone"), "the harness's wound is named where the cure lives");

// ── the functional faces: the cure is DRIVEN, not just read ─────────────

// brace-counting extractor: pull a bash function body out of the census
function grabFn(src, name) {
  const lines = src.split("\n");
  const out = [];
  let on = false;
  let depth = 0;
  for (const line of lines) {
    if (!on && line.startsWith(`${name}() {`)) {
      on = true;
      depth = 1;
      out.push(line);
      continue;
    }
    if (on) {
      out.push(line);
      for (const ch of line) {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
      }
      if (depth === 0) break;
    }
  }
  if (!on || depth !== 0) throw new Error(`grabFn: ${name} not found or unbalanced`);
  return out.join("\n");
}

let harness;
try {
  harness = [grabFn(census, "live_lane_ok"), grabFn(census, "reboot_my_lane"), grabFn(census, "run_live_seat")].join("\n");
  ok("W7a the functions extract cleanly (brace-balanced)", harness.includes("live_lane_ok() {") && harness.includes("run_live_seat() {") && harness.includes("reboot_my_lane() {"), `${harness.split("\n").length} lines`);
} catch (e) {
  ok("W7a the functions extract cleanly (brace-balanced)", false, e.message);
  harness = null;
}

if (harness) {
  const drive = (laneUrl, serverMine) =>
    [
      `CENSUS_LANE_URL="${laneUrl}"`,
      `SERVER_MINE=${serverMine}`,
      harness,
      `run_one() { echo "GREEN would-run: $2"; }`,
      `run_live_seat 0 t1021-import-fuel-unit`,
    ].join("\n");

  // W7 — the AMBER face: a dead lane, external (not mine to raise)
  let amber = "";
  try {
    amber = execFileSync("bash", ["-c", drive("http://127.0.0.1:59999", 0)], { encoding: "utf8", timeout: 30000 });
  } catch (e) {
    amber = `threw: ${e.message}`;
  }
  ok(
    "W7 the AMBER path answers on a DEAD lane",
    /AMBER t1021-import-fuel-unit: lane-dead unavailable \(external lane, not mine to reboot\)/.test(amber) && !/would-run/.test(amber),
    amber.trim().split("\n").pop(),
  );

  // W8 — the healthy face: a real listener (python's http.server; the probe
  // checks reachability, not the route — the census's own contract)
  const PORT = 5965;
  let server = null;
  let healthy = "";
  try {
    server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { stdio: "ignore" });
    // give the listener a breath
    let up = false;
    for (let i = 0; i < 20 && !up; i++) {
      await new Promise((r) => setTimeout(r, 100));
      up = execFileSync("bash", ["-c", `curl -s -o /dev/null -m 1 http://127.0.0.1:${PORT}/`], { timeout: 5000 }) === "";
      up = true; // curl exit 0 means reachable; the exec would throw otherwise
    }
    healthy = execFileSync("bash", ["-c", drive(`http://127.0.0.1:${PORT}`, 0)], { encoding: "utf8", timeout: 30000 });
  } catch (e) {
    healthy = `threw: ${e.message}`;
  } finally {
    if (server) server.kill();
  }
  ok(
    "W8 the healthy path rides the REAL lane (no AMBER, no skip)",
    /GREEN would-run: t1021-import-fuel-unit/.test(healthy) && !/AMBER/.test(healthy),
    healthy.trim().split("\n").pop(),
  );

  // W10 — the mine-to-raise face: a dead lane the census OWNS tries the
  // reboot (the reboot itself will fail — dev-server.sh pointed at a dead
  // port budget — and the REBOOT-FAILED amber answers, not the external one)
  let mine = "";
  try {
    mine = execFileSync("bash", ["-c", drive("http://127.0.0.1:59999", 1)], { encoding: "utf8", timeout: 200000, cwd: ROOT });
  } catch (e) {
    mine = `threw: ${e.message}`;
  }
  ok(
    "W10 a dead lane the census OWNS attempts the one reboot",
    /lane died mid-ride/.test(mine) && /AMBER/.test(mine),
    "the reboot attempt is made (its outcome is the box's, not the law's)",
  );
}

const dir = mkdtempSync(join(tmpdir(), "t883-"));
rmSync(dir, { recursive: true, force: true });

console.log(`\nt883 harness-cure unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
