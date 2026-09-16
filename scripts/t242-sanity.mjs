// t242 sanity — the native not-found guidance composer, checked BEFORE any
// wire (lamps before wires, t237's law). The composer is pure: structure,
// honesty branches, determinism — all provable without a server.
//   • the four searched-lines always speak (RELION_HOME / PATH / known / home scan)
//   • honesty branches: RELION_HOME unset vs set-but-empty vs set-but-missing;
//     known dirs all-missing vs some-exist vs all-exist; home scan 0 vs N hits
//   • the A/B remedies + Re-detect closing (the promise the chip title makes)
//   • determinism: same facts → byte-identical hint (the converter has no clock)
import { composeNativeHint } from "../src/lib/relion/system.ts";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const base = {
  relionHome: null,
  relionHomeExists: null,
  onPath: false,
  knownDirs: [],
  homeScanHits: 0,
};

// ---- 1. the demo-host shape (no RELION_HOME, no hits) --------------------
const demo = composeNativeHint(base);
const demoLines = demo.split("\n");
must(demoLines[0].includes("searched this host"), "opens with the searched-this-host line");
must(demoLines.some((l) => l.includes("RELION_HOME — not set")), "RELION_HOME unset line");
must(demoLines.some((l) => l.includes("PATH — no relion_refine on PATH")), "PATH miss line");
// zero known dirs → the composer honestly omits the line (the real probe
// always carries 5; the all-missing branch is exercised below)
must(!demoLines.some((l) => l.includes("Known locations")), "no known-locations line when none probed");
must(
  composeNativeHint({ ...base, knownDirs: [{ dir: "/opt/relion/bin", exists: false }] }).includes(
    "(none exists)"
  ),
  "known-locations line reports none-exists when all missing"
);
must(
  demoLines.some((l) => l.includes("Home scan") && l.includes("nothing matched")),
  "home-scan line reports nothing-matched at 0 hits"
);
must(demoLines.some((l) => /^A\)/.test(l.trim())), "remedy A present");
must(demoLines.some((l) => /^B\)/.test(l.trim())), "remedy B present");
must(demoLines.some((l) => l.includes("Re-detect")), "closing names Re-detect");
must(!demo.includes("undefined") && !demo.includes("null"), "no leaked undefined/null");
must(!demo.includes("https://") && !demo.includes("http://"), "no network dependency in guidance");

// ---- 2. honesty branches ---------------------------------------------------
const homeSet = composeNativeHint({
  ...base,
  relionHome: "/opt/relion",
  relionHomeExists: true,
  knownDirs: [{ dir: "/usr/local/bin", exists: true }],
  homeScanHits: 2,
});
must(homeSet.includes("set to /opt/relion, but no relion_refine in it"), "RELION_HOME set-but-empty branch");
must(homeSet.includes("(exist, no relion_refine)"), "known dir exists-but-empty branch");
must(homeSet.includes("2 *relion* bin dir(s) under ~"), "home-scan hit count spoken");

const homeMissing = composeNativeHint({
  ...base,
  relionHome: "/nope/relion",
  relionHomeExists: false,
});
must(homeMissing.includes("set to /nope/relion, but the directory does not exist"), "RELION_HOME set-but-missing branch");

const mixed = composeNativeHint({
  ...base,
  knownDirs: [
    { dir: "/usr/local/bin", exists: true },
    { dir: "/opt/relion/bin", exists: false },
  ],
});
must(
  mixed.includes("/usr/local/bin (exist, no relion_refine); /opt/relion/bin (missing)"),
  "mixed known dirs split exist vs missing"
);

// ---- 3. determinism ---------------------------------------------------------
const again = composeNativeHint(base);
must(again === demo, "same facts → byte-identical hint (no clock, no randomness)");

// ---- verdict ----------------------------------------------------------------
if (fail > 0) {
  console.error(`t242-sanity: ${fail} FAIL`);
  process.exit(1);
}
console.log("t242-sanity GREEN");
