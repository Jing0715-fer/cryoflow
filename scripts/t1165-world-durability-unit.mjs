// t1165 — THE WORLD-DURABILITY unit: the chain of custody's PRODUCT face.
//
// Four windows built the durability vein (t1160 export · t1161 doctor ·
// t1162 probe · t1163 gate · t1164 vacuum) and every mouth it grew was a
// TERMINAL mouth: the family runner's ◆ lines, the doctor's prose, the
// cron receipts. The System diagnostics dialog spoke the world's census
// but never its verdict — an operator reading the panel could not answer
// "can this world be restored?". The cure rides the ONE-instrument law:
// readWorldDurability SPAWNS the probe (scripts/world-snapshot.mjs probe,
// the t1162 doorbell) and quotes its machine JSON verbatim — a second
// verdict ladder in the product would drift from the instrument the cron
// family rides. The words (age buckets, verdict prose) live in ONE
// client-safe birthplace (world-durability-words.ts) so the dialog and
// the AI presenter speak the same fathers; the card fails safe to amber
// on an unknown word, and a mute instrument speaks its WHY, never a
// guessed verdict.
//
// A — the live face: readWorldDurability runs the REAL instrument
//     (read-only — the probe is count+head, the no-trace law holds; the
//     SEAT pins the CONTRACT's shape, not the world's exact numbers —
//     the t529 law: the bench tests the logic, not the world); the pure
//     fathers on fixtures (age buckets, verdict prose, the ladder
//     order); parseProbeStdout's shape law (noise-tolerant tail, mute on
//     every malformed shape); the presenter's locator lines.
// B — the source law: argv-direct spawn with the subcommand NAMED (the
//     side-effect-default law's product face), the 10s budget, the
//     payload composition, the client mirror, the ONE-birthplace import,
//     the words module's zero node imports (client-safe).
// C — the doctrine: the card's testids, the fail-safe tone buckets, the
//     honest mute face, the region's roster, the header's law.
//
// node scripts/unit-runner.mjs scripts/t1165-world-durability-unit.mjs
//

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readWorldDurability,
  parseProbeStdout,
  findProbeScript,
  PROBE_TIMEOUT_MS,
  WORLD_DURABILITY_VERDICTS,
} from "@/lib/diagnostics";
import {
  relativeAgeWord,
  worldVerdictNote,
} from "@/lib/world-durability-words";
import { presentSystemDiagnostics } from "@/lib/diagnostics";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const diagSrc = readFileSync(join(ROOT, "src/lib/diagnostics.ts"), "utf8");
const wordsSrc = readFileSync(join(ROOT, "src/lib/world-durability-words.ts"), "utf8");
const typesSrc = readFileSync(join(ROOT, "src/lib/types.ts"), "utf8");
const dialogSrc = readFileSync(
  join(ROOT, "src/components/workflow/system-diagnostics-dialog.tsx"),
  "utf8",
);

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}`);
  }
}

console.log("A — the live face (the REAL instrument, read-only)");

const live = readWorldDurability();
const SIX = new Set(WORLD_DURABILITY_VERDICTS);
ok("A1 the probe instrument answers ok:true", live.ok === true);
if (live.ok) {
  ok("A2 the verdict is one of the six ladder words", SIX.has(live.verdict));
  ok("A3 red rides a boolean", typeof live.red === "boolean");
  ok("A4 liveJobs is a non-negative number", typeof live.liveJobs === "number" && live.liveJobs >= 0);
  ok(
    "A5 snapshotJobs is a number or honest null",
    live.snapshotJobs === null || (typeof live.snapshotJobs === "number" && live.snapshotJobs >= 0)
  );
  const hex7 = (h) => h === null || /^[0-9a-f]{7,40}$/.test(h);
  ok("A6 heads are git-shaped or honest nulls", hex7(live.snapshotHead) && hex7(live.treeHead));
  ok("A7 probedAt parses as a timestamp", !Number.isNaN(new Date(live.probedAt).getTime()));
  const again = readWorldDurability();
  ok(
    "A8 the instrument is stable (two calls, one verdict + red)",
    again.ok === true && again.verdict === live.verdict && again.red === live.red
  );
} else {
  // an honest mute is ALSO a lawful face — pin the why wording, skip the shape
  ok("A2 a mute speaks its why (worded, not empty)", typeof live.why === "string" && live.why.length > 10);
  ok("A3-a8 skipped — the instrument is mute on this lane", true);
}
ok("A9 findProbeScript lands on the repo's instrument", (findProbeScript() ?? "").endsWith(join("scripts", "world-snapshot.mjs")));
ok("A10 the spawn budget is a tight 10s", PROBE_TIMEOUT_MS === 10_000);

console.log("A — the words fathers (fixtures)");

const NOW = new Date("2026-11-03T12:00:00Z");
ok("A11 <90s speaks just now", relativeAgeWord("2026-11-03T11:59:30Z", NOW) === "just now");
ok("A12 minutes bucket", relativeAgeWord("2026-11-03T11:55:00Z", NOW) === "5m ago");
ok("A13 hours bucket", relativeAgeWord("2026-11-03T09:00:00Z", NOW) === "3h ago");
ok("A14 days bucket", relativeAgeWord("2026-11-01T12:00:00Z", NOW) === "2d ago");
ok("A15 absent stamp → null (never a guessed 0m)", relativeAgeWord(null, NOW) === null);
ok("A16 unparseable stamp → null", relativeAgeWord("not-a-date", NOW) === null);

const notes = WORLD_DURABILITY_VERDICTS.map((v) => worldVerdictNote(v));
ok("A17 the six notes are all non-empty", notes.every((n) => n.length > 20));
ok("A18 the six notes are distinct words", new Set(notes).size === 6);
ok(
  "A19 every note names a MOVE (restore or re-export or read the probe)",
  notes.every((n) => /restore|re-export|read the probe/i.test(n))
);
ok("A20 an unknown verdict fails to the unknown word", /unknown verdict/.test(worldVerdictNote("MYSTERY")));
ok("A21 the ladder rides in t1162 order", WORLD_DURABILITY_VERDICTS.join(",") === "NO-SNAPSHOT,LIED,EMPTY-LIVE,DRIFTED,STALE,FRESH");

console.log("A — parseProbeStdout (the shape law)");

const REAL_LINE = JSON.stringify({
  verdict: "STALE",
  red: false,
  snapshotJobs: 15,
  liveJobs: 15,
  snapshotHead: "6cb3556a",
  treeHead: "b4e39027",
  exportedAt: "2026-11-03T04:28:56.877Z",
  liveMaxUpdatedAt: "2026-11-03T04:14:44.898Z",
  probedAt: "2026-11-03T06:13:13.569Z",
});
const parsed = parseProbeStdout(`some banner\nnoise line\n${REAL_LINE}\n`);
ok("A22 the real probe line parses to the shape", parsed?.ok === true && parsed.verdict === "STALE" && parsed.red === false);
ok("A23 the chatty tail is tolerated (last line wins)", parsed?.treeHead === "b4e39027");
ok("A24 the probe's own extra fields are not carried", !("liveMaxUpdatedAt" in (parsed ?? {})));
ok("A25 empty stdout → null", parseProbeStdout("") === null);
ok("A26 non-JSON tail → null", parseProbeStdout("hello\nworld") === null);
ok("A27 a JSON without a verdict → null (shape law)", parseProbeStdout('{"red":false}') === null);
ok("A28 a red that is not boolean → null", parseProbeStdout('{"verdict":"FRESH","red":"no","probedAt":"t"}') === null);
ok("A29 a RED verdict's JSON still parses (exit 1 is not a mute)", parseProbeStdout('{"verdict":"DRIFTED","red":true,"probedAt":"t"}')?.red === true);

console.log("A — the presenter's locator line");

const full = presentSystemDiagnostics({
  memory: null,
  disk: null,
  provenance: { commit: null, standalone: false },
  world: null,
  durability: {
    ok: true,
    verdict: "STALE",
    red: false,
    snapshotJobs: 15,
    liveJobs: 15,
    snapshotHead: "6cb3556a",
    treeHead: "b4e39027",
    exportedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    probedAt: new Date().toISOString(),
  },
  generatedAt: NOW.toISOString(),
});
ok("A30 the summary names the verdict and its red word", /world durability STALE \(not red\)/.test(full.summary ?? ""));
ok("A31 the summary carries the counts", /snapshot 15 · live 15/.test(full.summary ?? ""));
ok("A32 the age word rides the ONE father", /exported 1h ago/.test(full.summary ?? ""));
const muted = presentSystemDiagnostics({
  memory: null,
  disk: null,
  provenance: { commit: null, standalone: false },
  world: null,
  durability: { ok: false, why: "the probe did not answer within 10s" },
  generatedAt: NOW.toISOString(),
});
ok("A33 a muted probe speaks its why, worded", /world durability unreadable \(the probe did not answer/.test(muted.summary ?? ""));
const absent = presentSystemDiagnostics({
  memory: null,
  disk: null,
  provenance: { commit: null, standalone: false },
  world: null,
  durability: null,
  generatedAt: NOW.toISOString(),
});
ok("A34 a null durability is 'unreadable', never a guess", /world durability unreadable/.test(absent.summary ?? ""));

console.log("B — the source law");

ok(
  "B1 the spawn is argv-direct with the subcommand NAMED (side-effect-default's product face)",
  diagSrc.includes('spawnSync(process.execPath, [script, "probe"]')
);
ok("B2 no shell in the spawn (code the shell edits first is the t1164 scar)", !/shell:\s*true/.test(diagSrc));
ok("B3 the payload composes durability", /durability,/.test(diagSrc) && /readWorldDurability\(\)/.test(diagSrc));
ok("B4 the guard's catch keeps null honest (the card speaks the absence)", /catch \{[\s\S]*?durability = null/.test(diagSrc));
ok(
  "B5 the client mirror carries the why face",
  typesSrc.includes("WorldDurabilityClient") && /\| \{ ok: false; why: string \}/.test(typesSrc)
);
ok("B6 DiagnosticsClient carries the durability field", /durability: WorldDurabilityClient \| null;/.test(typesSrc));
ok(
  "B7 the ONE-instrument law is spoken in the lib header",
  /ONE INSTRUMENT, MANY MOUTHS/.test(diagSrc) && /world-snapshot\.mjs probe/.test(diagSrc)
);
ok("B8 the words module imports nothing from node (client-safe)", !wordsSrc.includes('from "node:'));
ok(
  "B9 the words have ONE birthplace (the lib imports, never redefines)",
  diagSrc.includes('from "@/lib/world-durability-words"') && !/export function relativeAgeWord/.test(diagSrc)
);
ok(
  "B10 the mute face words the reason (why, not a bare null)",
  /why: "the probe instrument/.test(diagSrc) && /unreadable \(/.test(diagSrc)
);

console.log("C — the doctrine (the dialog's face)");

ok("C1 the card exists with its testid", dialogSrc.includes('testid="diag-durability"'));
ok("C2 the verdict row speaks its own testid", dialogSrc.includes('data-testid="diag-durability-verdict"'));
ok("C3 the heads line is the card's mono receipt", dialogSrc.includes('data-testid="diag-durability-heads"'));
ok("C4 the mute face exists with its testid", dialogSrc.includes('data-testid="diag-durability-mute"'));
ok(
  "C5 the mute face speaks WHY, never a guessed verdict",
  /The probe instrument is silent on this lane/.test(dialogSrc)
);
ok(
  "C6 FRESH runs teal (the rail's grammar)",
  /verdict === "FRESH"\) return \{ dot: "bg-running-500", text: "text-running" \}/.test(dialogSrc)
);
ok(
  "C7 STALE and EMPTY-LIVE ride the amber watch band",
  /verdict === "STALE" \|\| verdict === "EMPTY-LIVE"/.test(dialogSrc)
);
ok(
  "C8 the RED trio rides danger",
  /verdict === "NO-SNAPSHOT" \|\| verdict === "LIED" \|\| verdict === "DRIFTED"/.test(dialogSrc)
);
ok("C9 the card imports the words from the ONE birthplace", dialogSrc.includes('from "@/lib/world-durability-words"'));
ok(
  "C10 the region's roster names the new face",
  /memory lanes, engine, disk, world durability, world census/.test(dialogSrc)
);
ok("C11 the doctor-RED badge exists for red verdicts", /doctor-RED/.test(dialogSrc));
ok("C12 the caption names the instrument (the probe's verdict)", /the probe's verdict/.test(dialogSrc));

console.log("");
console.log(`\nWORLD-DURABILITY-UNIT t1165: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
