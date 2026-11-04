#!/usr/bin/env node
// t901 — the FSC restore's unit receipt (the t887 pattern: the meaning
// lives in lib, the unit rides the same shapes the dialog feeds).
//
// The t901 style round's fsc-compare leg: the persisted selection's
// restore can silently EDIT the user's remembered comparison — the
// launcher joins first so the 6-curve cap eats the SAVED tail, and ids
// whose jobs left the index drop outright. src/lib/fsc-restore.ts owns
// the arithmetic (the t653 law); this receipt pins its laws:
//   A  the seating order (the launcher's queue-jump, the dedupe, the
//      cap eating the SAVED TAIL, vanished ids consuming no seats)
//   B  the whisper's reason clause (counts by reason, the reading
//      order, the cap's own ceiling named)
//   C  the silence law (an exact restore is edits [] AND summary "" —
//      the component's no-render condition holds by construction)
//
// Usage: node --import ./scripts/ts-alias-register.mjs scripts/t901-fsc-restore-unit.mjs

import { collectRestoreEdits, restoreEditSummary } from "@/lib/fsc-restore";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const ids = (n, prefix = "job") =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(2, "0")}`);
const knownSet = (arr) => new Set(arr);

console.log("A — the seating order (the launcher's queue-jump, the cap's tail)");

// A1 — the empty persistence: an exact restore, silence
{
  const { picked, edits } = collectRestoreEdits([], knownSet(ids(3)), "job-A");
  ok(
    "A1 empty saved → launcher alone, edits []",
    picked.size === 1 && picked.has("job-A") && edits.length === 0
  );
}

// A2 — all saved known: every id seats, no edits
{
  const saved = ids(4);
  const { picked, edits } = collectRestoreEdits(saved, knownSet(saved), "job-A");
  ok(
    "A2 4 known saved → all 4 seat beside the launcher (5 picked), edits []",
    picked.size === 5 && edits.length === 0
  );
}

// A3 — the launcher re-persisted: a dedupe, not an edit
{
  const saved = ["job-A", "job-01", "job-02"];
  const { picked, edits } = collectRestoreEdits(saved, knownSet(saved), "job-A");
  ok(
    "A3 the launcher inside saved → seated once, no edit",
    picked.size === 3 && edits.length === 0
  );
}

// A4 — a vanished id: the edit speaks, the seat stays empty
{
  const { picked, edits } = collectRestoreEdits(
    ["job-dead", "job-01"],
    knownSet(["job-01"]),
    "job-A"
  );
  ok(
    "A4 saved id outside the index → one {vanished} edit, not seated",
    picked.size === 2 &&
      edits.length === 1 &&
      edits[0].id === "job-dead" &&
      edits[0].reason === "vanished"
  );
}

// A5 — the cap eats the SAVED TAIL (the launcher jumped the queue)
{
  const saved = ids(6); // 6 known + launcher = 7 demand, 6 seats
  const { picked, edits } = collectRestoreEdits(saved, knownSet(saved), "job-A");
  ok(
    "A5 launcher + 6 saved under cap 6 → the LAST saved id eats {cap}",
    picked.size === 6 &&
      picked.has("job-A") &&
      edits.length === 1 &&
      edits[0].id === "job-05" &&
      edits[0].reason === "cap"
  );
}

// A6 — first saved win: the tail is the cap's victim, in order
{
  const saved = ["job-A", ...ids(5), "job-99"];
  const { picked, edits } = collectRestoreEdits(
    saved,
    knownSet([...saved]),
    "job-A"
  );
  ok(
    "A6 7 seats demanded (launcher deduped) → job-99 alone {cap}, the first five saved seat",
    picked.size === 6 &&
      !picked.has("job-99") &&
      edits.length === 1 &&
      edits[0].reason === "cap"
  );
}

// A7 — the launcher mid-saved: the dedupe frees no seat, the tail still pays
{
  const saved = [...ids(2), "job-A", ...ids(4, "alt")]; // 7 ids, launcher at index 2
  const { picked, edits } = collectRestoreEdits(
    saved,
    knownSet([...saved, ...ids(2)]),
    "job-A"
  );
  // seats: L, job-00, job-01, alt-00, alt-01, alt-02 = 6; alt-03 → cap
  ok(
    "A7 launcher mid-saved → the dedupe skips silently, the tail still eats {cap}",
    picked.size === 6 &&
      edits.length === 1 &&
      edits[0].id === "alt-03" &&
      edits[0].reason === "cap"
  );
}

// A8 — vanished ids consume no seats (they never seat)
{
  const saved = ["ghost-1", "ghost-2", ...ids(6)];
  const { picked, edits } = collectRestoreEdits(
    saved,
    knownSet(ids(6)),
    "job-A"
  );
  // seats: L + job-00..job-04 = 6 (job-05 caps); the ghosts seat nothing
  ok(
    "A8 two ghosts + six known → 2 vanished edits THEN 1 cap edit (ghosts seat nothing, known fill every seat first)",
    picked.size === 6 &&
      edits.length === 3 &&
      edits[0].reason === "vanished" &&
      edits[1].reason === "vanished" &&
      edits[2].reason === "cap"
  );
}

// A9 — the launcher cannot be denied (cap 1 still seats the launcher)
{
  const { picked, edits } = collectRestoreEdits(
    ids(2),
    knownSet(ids(2)),
    "job-A",
    1
  );
  ok(
    "A9 cap 1 → the launcher seated, both saved ids {cap}",
    picked.size === 1 && picked.has("job-A") && edits.length === 2
  );
}

console.log("B — the whisper's reason clause");

ok(
  "B1 [] → \"\" (the component never renders an empty summary)",
  restoreEditSummary([]) === ""
);
ok(
  "B2 one vanished → \"1 no longer in the index\"",
  restoreEditSummary([{ id: "g", reason: "vanished" }]) ===
    "1 no longer in the index"
);
ok(
  "B3 two caps → \"2 over the 6-curve cap\" (the ceiling named)",
  restoreEditSummary(
    [
      { id: "a", reason: "cap" },
      { id: "b", reason: "cap" },
    ],
    6
  ) === "2 over the 6-curve cap"
);
ok(
  "B4 mixed → vanished first (the reading order), the separator the family speaks",
  restoreEditSummary([
    { id: "g", reason: "vanished" },
    { id: "a", reason: "cap" },
    { id: "b", reason: "cap" },
  ]) === "1 no longer in the index · 2 over the 6-curve cap"
);
ok(
  "B5 the cap rides the caller's ceiling (custom cap wording)",
  restoreEditSummary([{ id: "a", reason: "cap" }], 4) ===
    "1 over the 4-curve cap"
);

console.log("C — the silence law");

// C1 — the exact restore is silent by construction: edits [] AND "" —
// the component's no-render condition (length > 0) can never see a
// non-empty summary alone
{
  const { edits } = collectRestoreEdits([], knownSet([]), "job-A");
  ok(
    "C1 exact restore → edits [] AND summary \"\" (silence is the honest voice)",
    edits.length === 0 && restoreEditSummary(edits) === ""
  );
}

console.log(`\nt901 fsc-restore unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
