// t1167 — THE ONE-WORLD unit: the app's own client lands on the world the
// instruments ride, no matter what the env says.
//
// The two-db trap's arc: t1114 mourned a "reset" that read .env's
// template and swept 3.1 GB of live workdirs on the misread; t1115 built
// the watchman (db-world.ts) and a launcher (dev-server.sh) whose export
// law sat at L82; the launcher died with a recycled sandbox, the
// platform's boots kept regenerating .env toward the template, the
// t1130 world-gate sat OUT of the census (an orphan — nobody heard the
// flap), and the t1166 census caught a bare `next dev` reading a 3-job
// world the instruments never saw. t1167 closes the ROOT: src/lib/db.ts
// pins its own landing (datasourceUrl = CRYOFLOW_DB_URL ||
// file:${RUNTIME_DB_BASELINE}) — no env, no launch method, no
// regenerated .env can move the world under the app. The launcher is
// reborn (belt to db.ts's suspenders; the export post is back at L82,
// the line the warn's sentence quotes); the watchman stays, now watching
// the RESOLVED world; the .env contract stays the t1130 gate's watch.
//
// DUTY SPLIT (no drift): t1053 owns the warn's PURE face (its buckets,
// its look-alikes, its production silence); t1130 (enrolled this window)
// watches the .env/CLI contract and FLAPS when the platform regenerates
// the template — the re-heal reminder; THIS seat pins the app's
// immunity — it never flaps, because the landing no longer depends on
// anything the platform owns.
//
// A — the functional proof: DATABASE_URL is deliberately pointed at the
//     TEMPLATE (the trap's exact semantics, replayed) and the imported
//     app client STILL counts the living world — equal to the REAL
//     probe's liveJobs, live, knob-agnostic (whatever CRYOFLOW_DB_URL
//     says, both sides ride it).
// B — the source law: the ONE path birthplace (RUNTIME_DB_BASELINE), the
//     ONE override knob first, the landing pinned (datasourceUrl), zero
//     env("DATABASE_URL") reliance in the client, the watchman restored
//     and watching the RESOLVED world, the instruments' own law quoted,
//     the launcher reborn at its quoted post with the x-bit on.
// C — the integration: schema.prisma's env("DATABASE_URL") stays the CLI
//     fallback of record, the census's clean-env habit, the fuel
//     family's world gate (the standing split-brain alarm), the warn's
//     production silence, the message's honest wording.
//
// node scripts/unit-runner.mjs scripts/t1167-one-world-unit.mjs
//

import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { templateWorldWarnOf } from "@/lib/db-world";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const dbSrc = readFileSync(join(ROOT, "src/lib/db.ts"), "utf8");
const worldSrc = readFileSync(join(ROOT, "src/lib/db-world.ts"), "utf8");
const snapSrc = readFileSync(join(ROOT, "scripts/world-snapshot.mjs"), "utf8");
const launcherSrc = readFileSync(join(ROOT, "dev-server.sh"), "utf8");
const exampleSrc = readFileSync(join(ROOT, ".env.example"), "utf8");
const schemaSrc = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
const censusSrc = readFileSync(join(ROOT, "scripts/t927-census.sh"), "utf8");
const fuelSrc = readFileSync(join(ROOT, "scripts/t1021-import-fuel-unit.mjs"), "utf8");

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

/** Ride the REAL probe instrument (read-only) and return its machine JSON. */
function realProbe() {
  const env = { ...process.env };
  delete env.DATABASE_URL; // the probe's own law: CRYOFLOW_DB_URL or the dev lane
  const out = execFileSync("node", [join(ROOT, "scripts/world-snapshot.mjs"), "probe"], {
    env,
    encoding: "utf8",
  });
  const line = out.split("\n").reverse().find((l) => l.trim().startsWith("{"));
  return JSON.parse(line);
}

// ── A — the functional proof (the trap replayed, now harmless) ──

// The trap's exact semantics: point DATABASE_URL at the TEMPLATE before
// the client module is born. The t1167 client must not care.
process.env.DATABASE_URL = "file:/home/z/my-project/db/custom.db";

const { db } = await import("@/lib/db");
const probe = realProbe();

ok("A1 the app client and the REAL probe read ONE world (job counts equal, live)", Number.isFinite(probe.liveJobs) && (await db.job.count()) === probe.liveJobs);
ok("A2 the probe's verdict is a ladder word and red rides a boolean", typeof probe.verdict === "string" && typeof probe.red === "boolean");

const { db: dbAgain } = await import("@/lib/db");
ok("A3 the singleton law holds (one client per process, the dev-cached global)", db === dbAgain);

// ── B — the source law ──

ok(
  "B1 the ONE path birthplace: db.ts imports RUNTIME_DB_BASELINE from ./db-world (no second path literal)",
  dbSrc.includes('import { RUNTIME_DB_BASELINE, templateWorldWarnOf } from \'./db-world\''),
);
ok(
  "B2 the ONE override knob speaks first (CRYOFLOW_DB_URL || the baseline — the instruments' own shape)",
  /process\.env\.CRYOFLOW_DB_URL \|\| `file:\$\{RUNTIME_DB_BASELINE\}`/.test(dbSrc),
);
ok("B3 the landing is pinned: the client passes datasourceUrl (the resolved world, never the env's template)", dbSrc.includes("datasourceUrl: resolvedDbUrl"));
ok("B4 zero env(\"DATABASE_URL\") reliance in the client (the schema's job, not the client's)", !dbSrc.includes('env("DATABASE_URL")'));
ok(
  "B5 the watchman restored at the call site, watching the RESOLVED world, dev-only by the caller's hand",
  dbSrc.includes("templateWorldWarnOf(resolvedDbUrl") &&
    dbSrc.includes('production: process.env.NODE_ENV === "production"'),
);
ok(
  "B6 the instruments' own law quoted: world-snapshot.mjs resolves CRYOFLOW_DB_URL first, the dev lane default",
  snapSrc.includes("process.env.CRYOFLOW_DB_URL ||") && snapSrc.includes("db/cryoflow.db"),
);
ok(
  "B7a the launcher reborn: it exists and exports the runtime world's url",
  launcherSrc.includes('export DATABASE_URL="file:${REPO}/db/cryoflow.db"'),
);
ok(
  "B7b the export post is REAL at the quoted line (dev-server.sh L82 — the sentence's address holds)",
  launcherSrc.split("\n")[81]?.startsWith("export DATABASE_URL=") === true,
);
ok("B7c the launcher carries the x-bit (the t1159 restitution law: a mode the world can run)", (statSync(join(ROOT, "dev-server.sh")).mode & 0o100) !== 0);
ok(
  "B8 the ONE path, spoken once in db-world.ts (the well's baseline quoted)",
  worldSrc.includes('path.join(process.cwd(), "db", "cryoflow.db")'),
);

// ── C — the integration ──

ok("C1 schema.prisma keeps env(\"DATABASE_URL\") — the CLI fallback of record (the t1130 gate's watch)", schemaSrc.includes('url      = env("DATABASE_URL")'));
ok(
  "C2 the census's clean-env habit stands (export DATABASE_URL=\"\" + the per-invocation unset)",
  censusSrc.includes('export DATABASE_URL=""') && censusSrc.includes("unset DATABASE_URL"),
);
ok(
  "C3 the fuel family's world gate is the standing split-brain alarm (t1021's FATAL wording)",
  fuelSrc.includes("world gate") && fuelSrc.includes("want 16"),
);
ok("C4 the warn's production silence (the dev lesson stays a dev voice)", templateWorldWarnOf("file:/home/z/my-project/db/custom.db", { production: true }) === null);
ok(
  "C5 the message's honest wording (the resolved url's mouth — 'the db url', never a var's name it did not read)",
  (() => {
    const warn = templateWorldWarnOf("file:/home/z/my-project/db/custom.db");
    return warn !== null && warn.includes("the db url points at") && !warn.includes("DATABASE_URL points at");
  })(),
);
ok(
  "C6 the example remains the template of record (the contract line verbatim — the heal's source)",
  exampleSrc.includes('DATABASE_URL="file:../db/cryoflow.db"'),
);

console.log("");
console.log(`\nONE-WORLD-UNIT t1167: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
