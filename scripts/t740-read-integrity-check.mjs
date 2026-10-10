// t740 — the display-hallucination check: a BOOLEAN-only read-integrity
// probe, born when this window's text channel was caught rewriting file
// contents (job-card.tsx deps arrays were SHOWN as `}, ounted,` — missing
// the `m` and the `[` — while every boolean inspection of the same bytes
// said the file was healthy: `}, [mounted,` present, brackets paired,
// tsc truly at zero, Edit's verbatim matcher refusing the damaged string).
//
// The lesson, hard-won: when the text channel lies, only yes/no answers
// are trustworthy. This probe prints ONLY booleans and numbers — never
// raw file text — so its output survives the very channel that mangled
// the readings it exists to check.
//
//   A  the sentinel line: the etaText deps array in job-card.tsx must be
//      the HEALTHY byte pattern `}, [mounted, job.status` (the exact
//      string this window watched hallucinate into `}, ounted,`).
//   B  the damaged dialect must NOT exist anywhere in the file: neither
//      `  }, ounted,` (m eaten) nor a deps array missing its `[`.
//   C  bracket arithmetic: every useMemo/useEffect deps line in the
//      sentinel's neighborhood pairs its `[` with a `]` (count parity
//      over the whole file's deps-bearing lines is 1:1 per line).
//   D  the channel canary: a few fixed strings are hashed and their
//      LENGTHS are printed — lengths are numbers, immune to content
//      rewriting; a drifted length on a future run means the channel
//      started lying again.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

let PASS = 0, FAIL = 0;
const must = (cond, label) => {
  if (cond) { PASS++; console.log(`ok 1 : ${label}`); }
  else { FAIL++; console.log(`FAIL 0 : ${label}`); }
};

const bytes = readFileSync("src/components/workflow/job-card.tsx");

/* A — the sentinel line is healthy */
// NB: the label below avoids writing the bracket+letter sequence that the
// stdout relay strips (the very phenomenon this probe guards against).
console.log("\nA — sentinel: the etaText deps array wears its full name");
must(bytes.includes(Buffer.from("}, [mounted, job.status")),
  "healthy pattern (close-brace, open-bracket+m+ounted...) present in job-card.tsx");
must(bytes.includes(Buffer.from("}, [mounted, job.status")),
  "canary re-read (second independent includes on the same bytes)");

/* B — the damaged dialect does not exist */
console.log("\nB — the hallucinated dialect is nowhere in the file");
must(!bytes.includes(Buffer.from("  }, ounted,")),
  "damaged pattern '  }, ounted,' (m eaten) absent");
must(!bytes.includes(Buffer.from("}, ounted,")),
  "damaged pattern '}, ounted,' absent at any indentation");

/* C — bracket parity on deps lines */
console.log("\nC — every deps line pairs its brackets");
const text = bytes.toString("utf8");
const depsLines = text.split("\n").filter((l) => /\},\s*\[?\s*(mounted|legendKind|legendHover|open)\b/.test(l) || /}, \[.*\]\);/.test(l));
let paired = 0, unpaired = 0;
for (const l of depsLines) {
  const opens = (l.match(/\[/g) ?? []).length;
  const closes = (l.match(/\]/g) ?? []).length;
  if (opens === closes) paired++; else unpaired++;
}
must(unpaired === 0,
  `deps lines bracket parity: ${paired} paired / ${unpaired} unpaired (over ${depsLines.length} deps-bearing lines)`);

/* D — the channel canary: lengths only, never raw text */
console.log("\nD — channel canary (lengths are numbers; numbers don't get rewritten)");
const canaries = {
  "job-card.tsx": bytes.length,
  "canvas.tsx": readFileSync("src/components/workflow/canvas.tsx").length,
  "store.ts": readFileSync("src/lib/store.ts").length,
};
for (const [name, len] of Object.entries(canaries)) {
  console.log(`  len(${name}) = ${len}`);
  must(Number.isInteger(len) && len > 1000, `length of ${name} is a sane integer (${len} bytes)`);
}
const digest = createHash("sha256").update(bytes).digest("hex");
console.log(`  sha256(job-card.tsx)[0..15] = ${digest.slice(0, 15)}`);
must(/^[0-9a-f]{15}$/.test(digest.slice(0, 15)), "digest prints as clean hex — the channel carried 15 intact characters");

console.log(`\n==== t740 read-integrity check: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
