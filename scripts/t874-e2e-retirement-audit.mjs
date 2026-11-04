/**
 * t874-e2e-retirement-audit — the retirement audit the t873 tail named:
 * the e2e walk instruments of the pre-restore era pin world ids
 * (`cmuwipe635000class2d` et al.) that the snapshot restore annihilated
 * — the jobs are gone from the DB. The fleet must not carry a dead
 * fixture's shadow: an instrument whose pinned world no longer exists
 * must self-report RETIRED (exit 3) on any future run, never fail as
 * the world's red.
 *
 * The audit:
 *   1. scans scripts/*.mjs for pinned `cmuwipe*` literals (the
 *      pre-restore demo world's id family),
 *   2. queries the live roster API for each pinned id,
 *   3. verdicts each pinning instrument: RETIRED-SHADOW (pinned id
 *      absent) or ALIVE (all its pinned ids present),
 *   4. records the receipt shots-qa/t874-e2e-retirement.json.
 *
 * The seeder (qa-t635-demo-skeleton-seed.mjs) is NOT a walk — it is the
 * fixture's parent, recorded for provenance, never retired.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
// the origin door's own dialect (the family's SH shape): a cross-site
// roster read is refused without the app's own Origin/Referer.
const SH = { Origin: BASE, Referer: `${BASE}/` };
const RECEIPT = "shots-qa/t874-e2e-retirement.json";
const PIN_RE = /cmuwipe[0-9a-z]*/g;
const SEEDERS = ["qa-t635-demo-skeleton-seed.mjs"];

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) { pass++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { fail++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

// ---------- 1. the census of pins ----------
const files = readdirSync(join(ROOT, "scripts")).filter((f) => f.endsWith(".mjs")).sort();
const pins = []; // { file, ids: [...] }
for (const f of files) {
  const txt = readFileSync(join(ROOT, "scripts", f), "utf8");
  const ids = [...new Set(txt.match(PIN_RE) ?? [])];
  if (ids.length) pins.push({ file: f, ids, seeder: SEEDERS.includes(f) });
}
ok(pins.length > 0, "the pin census found the pre-restore id family", `${pins.length} files pin cmuwipe* ids`);

// ---------- 2. the live roster ----------
const rosterRaw = await fetch(`${BASE}/api/jobs`, { headers: SH, cache: "no-store" }).then((r) => r.json()).catch(() => null);
const roster = rosterRaw?.jobs ?? rosterRaw;
ok(Array.isArray(roster) && roster.length > 0, "the live roster answered", `${Array.isArray(roster) ? roster.length : 0} jobs`);
const liveIds = new Set((roster ?? []).map((j) => j.id));

// ---------- 3. the verdicts ----------
// The census's honest partition (the t874 lesson itself): a cmuwipe literal
// in source is a SHADOW, not a runtime dependency — t826-bookmark-net-read
// pins the id in a comment and ran green THIS window. The GUARD demand
// lands only on the e2e WALK generation (the t65x–t68x instruments a
// future window might deliberately re-run); diag-*/smoke-*/patch one-shots
// and measured-not-pinned readers are recorded, never guarded.
const SELF = "t874-e2e-retirement-audit.mjs";
const WALKS = [
  "t651-e2e.mjs", "t652-e2e.mjs", "t657-e2e.mjs", "t658-e2e.mjs", "t660-e2e.mjs",
  "t661-e2e.mjs", "t662-e2e.mjs", "t664-e2e.mjs", "t665-e2e.mjs", "t668-saved-view-deeplink.mjs",
  "t669-saved-view-notfound.mjs", "t670-palette-delete.mjs", "t671-third-mouth.mjs",
  "t673-rename-mouth.mjs", "t674-rename-wall-palette.mjs", "t675-fourth-ear.mjs",
  "t676-toast-eclipse.mjs", "t679-third-exit.mjs", "t680-judge-storm.mjs",
];
const walks = pins.filter((p) => !p.seeder && p.file !== SELF);
const walkVerdicts = walks.filter((w) => WALKS.includes(w.file));
const others = walks.filter((w) => !WALKS.includes(w.file));
const verdicts = walkVerdicts.map((w) => {
  const present = w.ids.filter((id) => liveIds.has(id));
  const absent = w.ids.filter((id) => !liveIds.has(id));
  return {
    file: w.file,
    pinnedIds: w.ids,
    present,
    absent,
    verdict: absent.length === 0 ? "ALIVE" : absent.length === w.ids.length ? "RETIRED-SHADOW (every pinned id gone)" : "PARTIAL-SHADOW (some pinned ids gone — the walk needs them all)",
  };
});
const shadows = verdicts.filter((v) => v.verdict !== "ALIVE");
ok(shadows.length > 0, "the dead fixture's shadow is real among the walks (not imagined)", `${shadows.length}/${walkVerdicts.length} walk instruments shadowed`);
ok(shadows.every((s) => s.verdict.startsWith("RETIRED-SHADOW")), "every walked shadow is a FULL shadow so far as its own ids go", shadows.filter((s) => s.verdict.startsWith("PARTIAL-SHADOW")).map((s) => `${s.file}: ${s.absent.join(",")}`).join("; ") || "no partials");
ok(others.length > 0, "the census's non-walk shadows recorded, no guard demanded (one-shot diag/probe/patch or measured-not-pinned)", `${others.length} files, e.g. ${others.slice(0, 3).map((o) => o.file).join(", ")}`);

// ---------- 4. the guards' PROOF: the guard is not text, it FIRES ----------
// Every WALK shadow is EXECUTED: the guard fetches the pinned job, finds it
// absent, and exits 3 (RETIRED) before any browser launches. Exit 3 is the
// proof; a red (exit 1) or a hang is the audit's own failure. The census's
// non-walk files that ALSO carry the guard (the propagator reached every
// BASE-anchored instrument) get the same execution proof.
const guardWord = "RETIRED (the t874 audit)";
const guards = {};
const proveOne = (file) => {
  const txt = readFileSync(join(ROOT, "scripts", file), "utf8");
  if (!txt.includes(guardWord) || !/process\.exit\(3\)/.test(txt)) { guards[file] = "NO GUARD"; return; }
  const r = spawnSync("node", [join(ROOT, "scripts", file)], { encoding: "utf8", timeout: 60_000 });
  guards[file] = r.status === 3 ? "FIRES (exit 3)" : `exit ${r.status}${r.stderr ? ` — ${String(r.stderr).slice(0, 120)}` : ""}`;
};
for (const s of shadows) proveOne(s.file);
for (const o of others) proveOne(o.file);
ok(shadows.length > 0 && shadows.every((s) => guards[s.file] === "FIRES (exit 3)"), "every walk shadow's retirement guard FIRES (exit 3 = RETIRED, not red)", shadows.map((s) => `${s.file}: ${guards[s.file]}`).join("; "));
ok(Object.values(guards).every((v) => v === "FIRES (exit 3)" || v.startsWith("NO GUARD")), "the census's guarded set is all-fire, and the guard-less are exactly the no-fetch partition (seeders, DB-direct readers, measured-not-pinned — no weird exit anywhere)", `${Object.values(guards).filter((v) => v === "FIRES (exit 3)").length} fires / ${Object.values(guards).filter((v) => v && v.startsWith("NO GUARD")).length} guard-less (recorded) / ${Object.keys(guards).length} proven`);

// ---------- 5. the receipt ----------
const receipt = {
  instrument: "scripts/t874-e2e-retirement-audit.mjs",
  date: new Date().toISOString(),
  build: process.env.BUILD_KEY ?? null,
  question: "the e2e walk instruments of the pre-restore era pin world ids the snapshot restore annihilated — the fleet must not carry a dead fixture's shadow",
  answer: `${shadows.length} of the ${walkVerdicts.length} e2e walks shadowed (every pinned id gone from the live roster): ${shadows.map((s) => s.file).join(", ")} — each carries the t874 retirement guard and the guard FIRES (exit 3 = RETIRED, distinct from the exit-1 red, proven by execution in this audit); the census's other ${others.length} cmuwipe-bearing files are recorded without guards (one-shot diag/probe/patch or measured-not-pinned readers — a literal in source is a shadow, not a dependency); the seeder qa-t635-demo-skeleton-seed.mjs is the fixture's parent, recorded for provenance, never retired`,
  pins,
  verdicts,
  guards,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict: fail === 0 ? `the retirement audit holds: ${shadows.length} pre-restore e2e walks shadowed and their guards PROVEN (exit 3), the census partitioned honestly, the fleet carries no unmarked shadow` : `${fail} red — the shadow census disagrees with the guards; call the census's own instruments before any UI work`,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nE2E-RETIREMENT-AUDIT t874: ${pass}/${pass + fail}${fail ? " RED" : " green"}`);
process.exit(fail === 0 ? 0 : 1);
