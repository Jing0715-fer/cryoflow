/** t539 — the result-receipt counting bench: one word, two numbers, never again.
 *
 *  t538's pool item convicted the class2d receipt's "1 classes" — a parse
 *  hiccup that was really a SEMANTICS split: the stack's header nz counts
 *  every class average RELION wrote (K, populated or not — the probe read
 *  run_unmasked_classes.mrcs nz=4 while all 72 particles sat in class 2),
 *  while the data star's distinct _rlnClassNumber counts only the POPULATED
 *  classes. The receipt now speaks both ("1 of 4 classes populated") and
 *  the card's stack stat is relabeled "class averages". This bench pins the
 *  receipt-dialect laws on the parser that feeds the canvas chips:
 *
 *    LAW 1 — the populated shape wins: "1 of 4 classes populated" parses
 *            the POPULATED count (the select "kept" precedent — the number
 *            the data actually spread into), through both lane prefixes
 *            (REAL / REMOTE[origin]).
 *    LAW 2 — select's "40/50 classes" parses the KEPT count: what the
 *            output star actually carries (the particles lane already
 *            obeyed this rule; the generic shape was silently parsing 50).
 *    LAW 3 — historical receipts keep parsing: "50 classes · …" (old
 *            class2d lines) read through the generic shape unchanged.
 *    LAW 4 — honesty: a receipt without counts yields null; invalid
 *            entries (0, negative, NaN) drop rather than display.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

// the in-process door key (t523 pattern): teach node the product's two import
// dialects (@/ alias + extensionless relatives) before the lib import.
try {
  const { register } = await import("node:module");
  if (typeof register === "function") {
    register(pathToFileURL(new URL("./ts-alias-hook.mjs", import.meta.url).pathname));
  }
} catch {
  // bun (or another runtime with native path-alias eyes) — no key needed
}

const { parseResultCounts } = await import("@/lib/result-counts");

let pass = 0;
const fail = (msg: string): never => {
  console.error(`FAIL ${msg}`);
  process.exit(1);
};
const ok = (cond: unknown, msg: string): void => {
  if (!cond) fail(msg);
  pass++;
  console.log(`ok: ${msg}`);
};

/* ---- LAW 1: the populated shape wins --------------------------------- */

const t539Local = "REAL: 2D classification finished — 1 of 4 classes populated · 72 particles · top: class 2 100%";
const c1 = parseResultCounts(t539Local);
ok(c1?.classes === 1, `L1 local receipt parses the POPULATED count (got ${c1?.classes})`);
ok(c1?.particles === 72, `L1 the particle count rides along (got ${c1?.particles})`);

const t539Remote =
  "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 2D classification finished — 1 of 4 classes populated · 72 particles · top: class 2 100%";
const c2 = parseResultCounts(t539Remote);
ok(c2?.classes === 1, "L1 the REMOTE lane speaks the same dialect (populated = 1)");
ok(c2?.particles === 72, "L1 the REMOTE lane's particle count survives the prefix strip");

const t539Many =
  "REAL: 2D classification finished — 3 of 12 classes populated · 1,024 particles · top: class 1 46%, class 2 31%, class 3 12%";
const c3 = parseResultCounts(t539Many);
ok(c3?.classes === 3, "L1 multi-digit populated counts parse (got 3)");

/* ---- LAW 2: select keeps the KEPT count ------------------------------ */

const selA = "12,345 of 82,000 particles kept · 40/50 classes (occupancy)";
const s1 = parseResultCounts(selA);
ok(s1?.particles === 12345, "L2 the particles lane's kept rule holds (12,345)");
ok(s1?.classes === 40, `L2 "40/50 classes" parses the KEPT count (got ${s1?.classes}, the generic shape used to say 50)`);

const selB = "REAL: 512 of 72,000 particles selected · kept 40/50 classes (occupancy ≥ 3× best)";
const s2 = parseResultCounts(selB);
ok(s2?.classes === 40, "L2 the 'kept N/M classes' variant parses kept too");

/* ---- LAW 3: historical receipts keep parsing -------------------------- */

const hist = "REAL: 2D classification finished — 50 classes · 82,000 particles · top: class 1 40%, class 2 30%";
const h1 = parseResultCounts(hist);
ok(h1?.classes === 50, "L3 an old '50 classes ·' receipt reads through the generic shape");
ok(h1?.particles === 82000, "L3 the old receipt's particle count holds");

const histRemote = "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 2D classification finished — 12 classes · 24 particles";
const h2 = parseResultCounts(histRemote);
ok(h2?.classes === 12 && h2?.particles === 24, "L3 a historical remote record parses unchanged");

/* ---- LAW 4: honesty — no count, no badge ------------------------------ */

ok(parseResultCounts(null) === null, "L4 null in, null out");
ok(parseResultCounts("") === null, "L4 empty in, null out");
ok(parseResultCounts("REMOTE[cryo@host]: exited 0 but no expected outputs appeared — check the log tab") === null,
  "L4 a receipt without counts yields null (never a guess)");
const zero = parseResultCounts("REAL: 2D classification finished — 0 classes · 0 particles");
ok(zero === null, "L4 zero-count entries drop (the card shows no badge)");

console.log(`\nT539 RESULT-COUNTS BENCH: ${pass} assertions, all pass`);
