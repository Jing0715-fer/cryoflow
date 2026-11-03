// t1169 — THE LAUNCHER CAP UNIT: the dev server rides a heap cap, the
// box stays standing.
//
// The rebirth restitution: the t1167 window reborn dev-server.sh around
// the L82 export post — and silently DROPPED the heap cap its ancestor
// carried (scripts/dev-server.sh's own NODE_OPTIONS line, proven at 896
// MB). The 2026-11-03 22:2x census caught the consequence LIVE: an
// uncapped next-server ballooned to 2.8 GB anon on the 4 GB box, the
// kernel's global OOM killed it mid-census, and the fuel family's live
// legs died with it (t1021's world gate read `undefined` where the
// world should have spoken — the t1166 window's OOM lesson, second
// strike). This seat pins the cap so the next rebirth cannot lose it:
// a documented law the compiled file stopped speaking is a mute
// watchman — the drift between the launcher's story and its bytes is
// the bug class, and the cap is now a PINNED byte.
//
// 1 — the cap is real (NODE_OPTIONS with --max-old-space-size exported)
// 2 — the quoted export post still sits at L82 (the t1167 sentence's
//     address holds — the cap joined AFTER it, never displacing it)
// 3 — the cap precedes the exec (the spawned tree inherits it)
// 4 — the cap is override-able (DEV_HEAP_MB, the 1536 standing default)
// 5 — the exec spawns next THROUGH the cap (the launcher's last word)
// 6 — the ancestor's cap still present (the two-launcher story honest)
// 7 — the cap's why rides in the file (the OOM story, the next
//     rebirth's reading)
// 8 — the x-bit still on (the t1159 restitution law, seat 105's B7c
//     agrees)
// 9 — dev rides the SAME bundler prod builds with (--webpack in the
//     exec; Turbopack's native memory is what the cap cannot bound —
//     the second OOM strike's cure)
//
// node scripts/unit-runner.mjs scripts/t1169-launcher-cap-unit.mjs
//

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const launcherPath = join(ROOT, "dev-server.sh");
const launcherSrc = readFileSync(launcherPath, "utf8");
const lines = launcherSrc.split("\n");
const ancestorSrc = readFileSync(join(ROOT, "scripts/dev-server.sh"), "utf8");

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

const capLineIdx = lines.findIndex((l) => l.includes("--max-old-space-size="));
const execIdx = lines.findIndex((l) => l.startsWith("exec npx next dev"));

ok("1 the cap is real: NODE_OPTIONS carries --max-old-space-size", capLineIdx !== -1 && /export NODE_OPTIONS=.*--max-old-space-size=/.test(launcherSrc));
ok("2 the quoted export post still sits at L82 (the cap never displaced it)", (lines[81] ?? "").startsWith("export DATABASE_URL=") === true, `L82 = ${(lines[81] ?? "").slice(0, 40)}…`);
ok("3 the cap precedes the exec (the spawned tree inherits it)", capLineIdx !== -1 && execIdx !== -1 && capLineIdx < execIdx);
ok("4 the cap is override-able: DEV_HEAP_MB with the 2048 standing default", /\$\{DEV_HEAP_MB:-2048\}/.test(launcherSrc));
ok("5 the exec spawns next through the cap (the launcher's last meaningful line)", execIdx !== -1 && lines.slice(execIdx + 1).every((l) => l.trim() === ""));
ok("6 the ancestor's cap still present (the two-launcher story honest)", ancestorSrc.includes("--max-old-space-size="));
ok("7 the cap's why rides in the file (the OOM story for the next rebirth)", launcherSrc.includes("global OOM") && launcherSrc.includes("2.8 GB"));
ok("8 the x-bit still on (the t1159 restitution law, seat 105's B7c agrees)", (statSync(launcherPath).mode & 0o100) !== 0);
ok("9 dev rides the SAME bundler prod builds with (--webpack in the exec)", /^exec npx next dev --webpack( |$)/m.test(launcherSrc), lines[execIdx] ?? "");

console.log(`\nt1169 launcher cap unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
