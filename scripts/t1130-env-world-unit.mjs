#!/usr/bin/env node
/**
 * t1130 — the ENV WORLD GATE: the .env realignment's standing witness.
 *
 * The t1114 trap's root, closed this window: .env — the last fossil of
 * the dead start.sh writer — still pointed bare prisma children at
 * db/custom.db, the 3-job Oct-16 template world, while the living world
 * (db/cryoflow.db, 15 jobs) served only through dev-server.sh's own
 * export (the chain's law). Any process WITHOUT the chain env — a unit
 * probe, a ride harness, a prisma CLI child — silently landed on the
 * template and misread the world (t1114's own probe mourned a "reset"
 * that never happened and swept 3 GB of live workdirs on the strength
 * of that misread). The t1115 guard says the trap out loud at the
 * moment of the misread; THIS window closes the trap's ROOT: .env now
 * carries .env.example's law (file:../db/cryoflow.db), and a bare child
 * lands on the living world BY CONSTRUCTION.
 *
 * This unit is the world gate: it runs BARE under the census's own law
 * (DATABASE_URL unset per invocation) — its own prisma client IS the
 * bare child. If .env ever drifts from the example's law again, the
 * gate goes red BY DESIGN (the t1081-R doctrine: a red gate is a
 * diagnosis, never noise). The 15/1/name pins are world-gated: they
 * read the LIVING world at rest, and a legitimate world change re-keys
 * them like every world-gated instrument before them.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0, fail = 0;
const pin = (name, ok) => {
  console.log(`  ${ok ? "ok" : "FAIL"}  ${name}`);
  if (ok) pass++; else fail++;
};

// (a) .env carries the example's law — and no ACTIVE line names the
// template again. The provenance comment may tell the fossil's story
// (it names the old value on purpose — a comment is history, not
// config); the gate reads only the live lines.
const envText = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const envActive = envText
  .split("\n")
  .filter((l) => !l.trim().startsWith("#"))
  .join("\n");
const urlLine = envText.split("\n").find((l) => l.trim().startsWith("DATABASE_URL=")) ?? "";
const a = urlLine.includes("file:../db/cryoflow.db") && !envActive.includes("custom.db");

// (b) .env.example remains the template of record (the contract line verbatim)
const exText = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
const b = exText.includes('DATABASE_URL="file:../db/cryoflow.db"');

// (e) the t1115 guard stays — the root is closed AND the watchman remains
// (defense in depth: closing the root never retires the guard)
const worldSrc = fs.readFileSync(path.join(ROOT, "src/lib/db-world.ts"), "utf8");
const dbSrc = fs.readFileSync(path.join(ROOT, "src/lib/db.ts"), "utf8");
const e = worldSrc.includes("templateWorldWarnOf") && dbSrc.includes("templateWorldWarnOf(");

// (c)+(d) the BARE landing: delete the env var FIRST (defense in depth —
// the census already unsets it, but a bare `node scripts/...` run may not
// have), THEN import the client, so prisma's own .env load sees the true
// bare world and the landing is decided by .env alone — the exact
// semantics the trap exploited, now pointing at the living world.
delete process.env.DATABASE_URL;
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
let c = false, d = false;
try {
  const jobs = await p.job.count();
  c = jobs === 15;
  const workspaces = await p.workspace.count();
  const proj = await p.project.findFirst();
  d = workspaces === 1 && proj?.name === "β-Galactosidase Tutorial (demo)";
} finally {
  await p.$disconnect();
}

pin("(a) .env carries the example's law (file:../db/cryoflow.db) and never names custom.db", a);
pin("(b) .env.example remains the template of record — the contract line verbatim", b);
pin("(c) the BARE child lands on the LIVING world: job.count() === 15 (the 3-job template refused)", c);
pin("(d) the landing is the living world's shape: one workspace, the demo project", d);
pin("(e) the t1115 guard stays — the root closed AND the watchman remains", e);

console.log(`t1130 env-world unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
