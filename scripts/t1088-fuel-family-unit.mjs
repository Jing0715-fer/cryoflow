#!/usr/bin/env node
/**
 * t1088 — THE FUEL FAMILY LAW unit (node-only): the boot-storm transient
 * cured at its own layer.
 *
 * THE SCAR (this window's census): run 2 of a back-to-back census ride
 * went 40/44 — the fuel block RED — with t1021 reading `exit=1 count=?`
 * on the very next run. No restore had touched the box: the t1084
 * "boot tide" naming was incomplete. The post-mortem found two honest
 * defects wearing one coat:
 *   1. t1021's orphan sweep deleted through a BARE fetch (a storm
 *      swallows it with a 5xx — the twin stood anyway), and the world
 *      gate FATALed on a COUNT that hid the name;
 *   2. the family's readers (t1022/23/24) had NO orphan sweep at all —
 *      a dead ride's leftover twin FATALed every gate behind it.
 * The cures: the sweep's delete is patient (the t1023 law) and
 * verifies itself over three rounds; the readers carry the fuel-family
 * orphan law (the KNOWN twin swept through the product door, any OTHER
 * stranger named on the record); every fuel gate's FATAL prints the
 * full roster — a gate that only counts lies by omission.
 *
 * BANDS:
 *   A  the mutator's patience (t1021): the 3-round sweep, the patient
 *      DELETE, the stander FATAL, the four bare fetches now patient
 *      (bind0 / the PATCHes / alive / rebound — the run-2b shape named)
 *   B  the family law (t1022/23/24): the block in all three readers,
 *      the KNOWN-twin-only match, the patient delete shape, the
 *      post-family-sweep re-read
 *   C  the gate names what stands: the roster line in all four gates
 *   D  the stray-law audit's cure (qa55): the cleanup VERIFIES — the
 *      world-read stray law, the DELETE code assert, the audit script
 *      on disk (the 405 probe's lesson named in the comment)
 *
 * PROTOCOL: node-only, readFileSync over the five scripts (the four fuel
 * seats + qa55), exit honest, receipt to shots-qa/.t1088-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1088-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const mutator = read("scripts/t1021-import-fuel-unit.mjs");
const r1 = read("scripts/t1022-fuel-face-unit.mjs");
const r2 = read("scripts/t1023-watchdog-guard-unit.mjs");
const r3 = read("scripts/t1024-dialog-fuel-unit.mjs");
const readers = [r1, r2, r3];

/* ---------- A band — the mutator's patience ---------- */
console.log("A band — the mutator's patience (t1021):");
ok("A1 the hardening speaks its why (the bare fetch's lie named, the count's omission named)",
  mutator.includes("THE t1088 HARDENING") &&
  mutator.includes("a gate that only counts lies by omission"));
ok("A2 the orphan sweep re-reads and RE-SWEEPS (three rounds, not one bare shot)",
  mutator.includes("for (let round = 0; round < 3; round++)") &&
  /round < 3[\s\S]{0,600}apiRetry\("DELETE"/.test(mutator));
ok("A3 the sweep's DELETE is patient (the t1023 law — tries=4)",
  mutator.includes('await apiRetry("DELETE", `/api/jobs/${orphan.id}`, undefined, 4)'));
ok("A4 the stander FATAL names the twin (id + status + the three patient rounds on the record)",
  mutator.includes("the orphan's delete never landed") &&
  mutator.includes("still stands after 3 patient rounds"));
ok("A5 the bind0 leg is patient (the bare fetch would die uncaught — the run-2b shape named)",
  mutator.includes('apiRetry("GET", "/api/project", undefined, 4)') &&
  mutator.includes("the run-2b shape"));
ok("A6 the ride's other bare legs are patient (alive, the rebound pair)",
  mutator.includes('apiRetry("GET", "/api/jobs", undefined, 4)') &&
  (mutator.match(/apiRetry\("PATCH", `\/api\/projects\/\$\{project\}`/g) || []).length === 2);

/* ---------- B band — the family law ---------- */
console.log("B band — the family law (the readers):");
ok("B1 the family block stands in ALL THREE readers",
  readers.every((s) => s.includes("the fuel-family orphan law (the t1088 hardening)")),
  readers.map((s) => s.includes("the fuel-family orphan law (the t1088 hardening)")).join("/"));
ok("B2 the readers sweep ONLY the KNOWN twin (never a stranger — the name is the warrant)",
  readers.every((s) => s.includes('j.name === "Import Fuel Gate Ride"')));
ok("B3 the family delete is patient (4 tries, the 2500ms beat, 200/404 accepted)",
  readers.every((s) => /for \(let a = 0; a < 4; a\+\+\)/.test(s) && s.includes("await sleep(2500)") && s.includes("r.status === 200 || r.status === 404")));
ok("B4 the sweep re-reads the world before the gate (the post-family-sweep honest exit)",
  readers.every((s) => s.includes("post-family-sweep")));

/* ---------- C band — the gate names what stands ---------- */
console.log("C band — the gate names what stands:");
ok("C1 the mutator's 16-gate prints the roster (name — status — id, every job)",
  /FATAL: world gate — jobs \$\{world\.length\}[\s\S]{0,200}for \(const j of world\) console\.error\(`    · \$\{j\.name\} — \$\{j\.status\} \(\$\{j\.id\}\)`/.test(mutator));
ok("C2 the readers' 16-gates print the roster too (the same line in all three)",
  readers.every((s) => s.includes("for (const j of world) console.error(`    · ${j.name} — ${j.status} (${j.id})`)")));
ok("C3 the mutator verifies its own sweep before the gate (the stander check precedes the 16-count)",
  mutator.indexOf("still stands after 3 patient rounds") < mutator.indexOf("FATAL: world gate — jobs"));

/* ---------- D band — the stray-law audit's cure (qa55) ---------- */
console.log("D band — the stray-law audit's cure (qa55):");
const qa55 = read("scripts/qa55-e2e.mjs");
ok("D1 the audit script stands (the family's recurring instrument, read-only)",
  existsSync(path.join(ROOT, "scripts/t1088-qa-stray-audit.mjs")));
ok("D2 qa55's cleanup verifies the delete (DELETE must answer 200 — no more .trim() into the void)",
  qa55.includes('if (delCode !== "200" || stood.length > 0)'));
ok("D3 qa55's stray law reads the WORLD (the list is the voice — the [id] route's 405 named)",
  qa55.includes("world carries no QA t55 Honest Gap") &&
  qa55.includes("a follow-up GET answers 405"));

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1088-fuel-family-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["A the mutator's patience", "B the family law", "C the gate names what stands", "D the stray-law audit's cure"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);
