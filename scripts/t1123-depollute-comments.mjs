#!/usr/bin/env node
/**
 * t1123 — de-pollute: the curer's no-className tactic once fired on the
 * four PROSE mentions of `<button` inside comments (the scanner knew how
 * to END a tag inside a comment but the indexOf("<button") hunt still
 * STARTS inside one). This script removes exactly those four insertions,
 * by full-line exact anchors with a count gate — anything else refuses
 * to run (半刀拒写门).
 */
import { readFileSync, writeFileSync } from "node:fs";

const MINT = ' className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"';
const FILES = [
  "src/components/workflow/project-dashboard.tsx",
  "src/components/workflow/remote-cluster-dialog.tsx",
  "src/components/workflow/results/class-iteration-gallery.tsx",
  "src/components/workflow/results/particle-browser.tsx",
];
let hits = 0;
for (const f of FILES) {
  let t = readFileSync(f, "utf8");
  const before = t;
  // only inside comment prose: the mention is followed by prose, never by
  // real JSX attributes — gate on the exact polluted pattern
  t = t.split(`<button${MINT}>;`).join("<button>;");
  t = t.split(`<button${MINT}> (click`).join("<button> (click");
  t = t.split(`<button${MINT}> (invalid`).join("<button> (invalid");
  t = t.split(`<button${MINT}> that`).join("<button> that");
  if (t !== before) {
    const n = (before.split(MINT).length - 1) - (t.split(MINT).length - 1);
    hits += n;
    writeFileSync(f, t);
    console.log(`DEPOLLUTED ${n} — ${f}`);
  }
}
if (hits !== 4) {
  console.error(`REFUSING: expected exactly 4 pollutions, touched ${hits}`);
  process.exit(1);
}
console.log("four comment pollutions removed");
