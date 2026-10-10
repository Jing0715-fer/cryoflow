/**
 * t447 bench — the twin's name: a sibling, not a descendant.
 *
 *   T1 (the family root): exactly one trailing suffix — " (copy)" or
 *      " (copy) N" — strips off; a mid-string "(copy)", a foreign paren,
 *      and a bare "(copy)" without its leading space are part of the
 *      name, not a suffix.
 *   T2 (lowest free slot): the twin takes the family's first unoccupied
 *      seat — the source's own name occupies the namespace (duplicating
 *      "X (copy)" yields "X (copy) 2"), tombstones don't reserve seats
 *      (a deleted " (copy) 2" gets re-minted), and any live name blocks.
 *   T3 (batch reservation): every twin's claim blocks the next — two
 *      same-type sources become (copy) and (copy) 2, never a collision;
 *      the reservation never leaks across different families.
 *   T4 (the world contract): a returned name is never in the taken set
 *      it was born from; the family stays flat (duplicating any member
 *      lands on the same root); unicode names pass through untouched.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import { baseNameOf, twinName, twinNamesFor } from "../src/lib/twin-name";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

// ───────────────────────── T1 — the family root ─────────────────────────

// T1a — a plain name IS its own root
must(baseNameOf("Motion Correction 1") === "Motion Correction 1", "T1a plain name unchanged");
// T1b — the bare suffix strips
must(baseNameOf("Motion Correction 1 (copy)") === "Motion Correction 1", "T1b (copy) strips");
// T1c — the numbered suffix strips
must(baseNameOf("Motion Correction 1 (copy) 2") === "Motion Correction 1", "T1c (copy) 2 strips");
// T1d — multi-digit numbers strip too
must(baseNameOf("X (copy) 12") === "X", "T1d (copy) 12 strips");
// T1e — a mid-string "(copy)" is part of the name
must(baseNameOf("X (copy) plus") === "X (copy) plus", "T1e mid-string stays");
// T1f — a foreign paren is not a suffix
must(baseNameOf("X (draft)") === "X (draft)", "T1f foreign paren stays");
// T1g — "(copy)" without a leading space is not the family suffix
must(baseNameOf("(copy)") === "(copy)", "T1g bare (copy) stays");
// T1h — one strip lands on the root even from deep numbering
must(baseNameOf("X (copy) 3") === "X", "T1h deep numbering strips");

// ────────────────────── T2 — lowest free slot ───────────────────────────

// T2a — a fresh world mints the plain (copy)
must(twinName("X", []) === "X (copy)", "T2a fresh world → (copy)");
// T2b — an occupied seat is skipped
must(twinName("X", ["X (copy)"]) === "X (copy) 2", "T2b taken (copy) → (copy) 2");
// T2c — numbering walks to the first free seat
must(twinName("X", ["X (copy)", "X (copy) 2", "X (copy) 3"]) === "X (copy) 4", "T2c walk to free");
// T2d — tombstones don't reserve: a deleted seat is re-minted (gap-fill)
must(twinName("X", ["X (copy)", "X (copy) 3"]) === "X (copy) 2", "T2d gap-fill");
// T2e — the source's own name occupies the namespace: duplicating a copy
// yields a SIBLING, never a name collision with its own source
must(twinName("X (copy)", ["X (copy)"]) === "X (copy) 2", "T2e sibling of a copy");
// T2f — duplicating a numbered copy lands back at the family's first free seat
must(twinName("X (copy) 3", ["X (copy) 3"]) === "X (copy)", "T2f root reset from member");
// T2g — ANY live name blocks, not just family members
must(twinName("X", ["Y", "X (copy)"]) === "X (copy) 2", "T2g foreign names block too");

// ───────────────────── T3 — batch reservation ───────────────────────────

// T3a — two same-name sources never collide
const t3a = twinNamesFor([{ name: "X" }, { name: "X" }], []);
must(t3a[0] === "X (copy)" && t3a[1] === "X (copy) 2", "T3a pair sequential");
// T3b — three-way walk
const t3b = twinNamesFor([{ name: "X" }, { name: "X" }, { name: "X" }], []);
must(
  t3b[0] === "X (copy)" && t3b[1] === "X (copy) 2" && t3b[2] === "X (copy) 3",
  "T3b triple sequential"
);
// T3c — the world's names count, then the batch's claims stack on top
const t3c = twinNamesFor([{ name: "X" }, { name: "X (copy)" }], ["X (copy)"]);
must(t3c[0] === "X (copy) 2" && t3c[1] === "X (copy) 3", "T3c world + batch stack");
// T3d — different families never block each other
const t3d = twinNamesFor([{ name: "X" }, { name: "Y" }], []);
must(t3d[0] === "X (copy)" && t3d[1] === "Y (copy)", "T3d families independent");
// T3e — a family member duplicates to a sibling inside a mixed batch: the
// root's twin takes the free gap seat FIRST (lowest-free-slot is global,
// not per-source), the member's own twin takes the next one
const t3e = twinNamesFor([{ name: "X" }, { name: "X (copy) 2" }], ["X (copy)"]);
must(t3e[0] === "X (copy) 2" && t3e[1] === "X (copy) 3", "T3e member + root one family");

// ───────────────────── T4 — the world contract ──────────────────────────

// T4a — the returned name is never in the taken set it was born from
const world = ["Import Movies 1", "Motion Correction 1 (copy)", "X", "X (copy)"];
must(!world.includes(twinName("X", world)), "T4a never re-mints a live name");
// T4b — the family stays flat: duplicating ANY member lands on the root's
// family — baseNameOf(twinName(member)) is the same root for every member
const members = ["X", "X (copy)", "X (copy) 2", "X (copy) 3"];
const roots = members.map((m) => baseNameOf(twinName(m, members)));
must(roots.every((r) => r === "X"), "T4b flat family, one root");
// T4c — unicode names pass through the family law untouched
must(
  twinName("β-Gal 测试 (copy)", ["β-Gal 测试 (copy)"]) === "β-Gal 测试 (copy) 2",
  "T4c unicode family"
);
// T4d — the batch's returned names are mutually unique
const batch = twinNamesFor(
  [{ name: "X" }, { name: "X" }, { name: "X" }, { name: "X" }],
  world
);
must(new Set(batch).size === batch.length, "T4d batch names mutually unique");

console.log(`t447 twin-name bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
