#!/usr/bin/env node
/**
 * t957 — the SYNTAX LANDMINE cure: picks/route.ts line 146.
 *
 * THE TRUE STORY (corrected after the forensics ride): the line —
 * `map((m) => [m.micName, m])` — only APPEARED broken through the Bash
 * capture layer, whose ANSI sanitizer eats any contiguous `[<chars>m`
 * in plain-text output (od -c, JSON lengths, and in-process asserts all
 * showed the bytes honest since t433; the "three compilers' silent
 * healing" was a display artifact). No cure was ever needed — the ride
 * ended in the harness's own pants.
 *
 * THIS SCRIPT REMAINS as the standing repair tool for a GENUINE future
 * corruption of the line (either form accepted, the fixed form written,
 * the result re-read and verified). Idempotent: on honest bytes it
 * writes nothing. The census's t957-syntax-landmine-unit is the
 * tripwire that decides when to run it.
 */
import { readFileSync, writeFileSync, statSync } from "fs";

const file = "src/app/api/jobs/[id]/picks/route.ts";
const BROKEN = "parsed.micrographs.map((m) => .micName, m]));";
const FIXED = "parsed.micrographs.map((m) => [m.micName, m]));";

const before = readFileSync(file, "utf8");
const hadBroken = before.includes(BROKEN);
const hadFixed = before.includes(FIXED);
if (!hadBroken && !hadFixed) {
  console.error("FATAL: neither line form found — the file changed under us. Aborting.");
  process.exit(1);
}
if (hadBroken && hadFixed) {
  console.error("FATAL: both forms present?! Aborting.");
  process.exit(1);
}
const st0 = statSync(file);
if (hadFixed) {
  console.log(`already-fixed (bytes honest) — no write needed. size=${st0.size}`);
  process.exit(0);
}
const after = before.replace(BROKEN, FIXED);
if (after === before) {
  console.error("FATAL: replace produced no change.");
  process.exit(1);
}
writeFileSync(file, after);
const re = readFileSync(file, "utf8");
const st1 = statSync(file);
const ok = re.includes(FIXED) && !re.includes(BROKEN);
console.log(`write landed: fixed=${re.includes(FIXED)} broken=${re.includes(BROKEN)} size ${st0.size}->${st1.size} mtime ${st0.mtimeMs}->${st1.mtimeMs}`);
console.log(ok ? "CURE OK — the source is byte-honest now" : "CURE FAILED — the flap may have swallowed the write");
process.exit(ok ? 0 : 2);
