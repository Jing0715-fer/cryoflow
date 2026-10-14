#!/usr/bin/env node
/**
 * t872 — the rogue-job cleanup: the lens's own residue, removed through
 * the product's own door.
 *
 * The t872 ride-2/ride-3 lesson: the palette Enter (a synthetic keydown)
 * selected the FIRST item of the UNFILTERED command list — the setter +
 * input event typed into the [cmdk-input]'s DOM value but did not drive
 * cmdk's internal filter state — and the first command created an
 * "Automated Picking" job. Two rides, two rogue rows:
 *
 *   Automated Picking 2   cmv7m6wbl0001usunm8zc42sw   idle, autopick
 *   Automated Picking 3   cmv7mcz620003usunllqolq88   idle, autopick
 *
 * Both are the t871 probe-residue law's own shape (caught by the census
 * in the DB, removed through the product's own delete door). The DELETE
 * is the tombstone (t341 snapshot + restore route) — undoable by design.
 * The signature is scoped exactly as the RESIDUE law (Task 144) demands:
 * name LIKE 'Automated Picking %', type autopick, status idle, created
 * inside the t872 window. The world's baseline is 15 jobs; the census
 * must read 15 again after the sweep.
 */
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const BASE = "http://localhost:3000";

const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`);
  if (!r.ok) throw new Error(`roster read failed: HTTP ${r.status}`);
  const j = await r.json();
  return j.jobs ?? j.items ?? j;
};

const jobs = await roster();
const rogue = jobs.filter(
  (o) => /^Automated Picking \d+$/.test(o.name || "") && o.status === "idle"
);
console.log(`roster: ${jobs.length} jobs; rogue by signature: ${rogue.length}`);
for (const o of rogue) console.log(`  - "${o.name}" ${o.id} (status=${o.status}, type=${o.type})`);

let dead = 0;
for (const o of rogue) {
  const r = await fetch(`${BASE}/api/jobs/${o.id}`, { method: "DELETE" });
  if (r.ok) {
    dead++;
    console.log(`  deleted "${o.name}" (${o.id}) — the tombstone door, restore-able by design`);
  } else {
    const body = await r.text();
    console.log(`  DELETE FAILED "${o.name}" (${o.id}) HTTP ${r.status}: ${body.slice(0, 120)}`);
  }
}

const after = await roster();
const still = after.filter((o) => /^Automated Picking \d+$/.test(o.name || "") && o.status === "idle");
console.log(`after: roster ${after.length} jobs; rogue remaining: ${still.length}; deleted ${dead}/${rogue.length}`);
if (still.length > 0 || dead !== rogue.length) process.exit(1);
console.log("the census's own arithmetic restored — the lens cleaned its own residue");
