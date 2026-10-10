/**
 * t384 — source X-ray (the merged tree carries every fix). Run:
 *   bun scripts/t384-source-xray.ts
 */
import { readFileSync, existsSync } from "node:fs";

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

const remoteRun = readFileSync("src/lib/remote/remote-run.ts", "utf8");
const iterationLive = readFileSync("src/lib/remote/iteration-live.ts", "utf8");
const storageDiag = readFileSync("src/lib/remote/storage-diag.ts", "utf8");
const cacheWitness = readFileSync("src/lib/remote/cache-witness.ts", "utf8");

// t370's original X-ray (must keep passing over the merged tree)
must(
  /od -An -tu4 -j0 -N12/.test(remoteRun) && /zeroHeaderRounds/.test(remoteRun) && /storageDiagAt/.test(remoteRun),
  "A3 remote-run: live header sniff + zeroHeaderRounds + the once-per-run diagnostic"
);
must(
  existsSync("src/lib/remote/storage-diag.ts") && /runStorageDiagnostic/.test(remoteRun),
  "A4 the storage diagnostic module + the sweep wiring"
);

// t384's additions
must(
  /cacheSafeHeaderSniffLineForVar\(\)/.test(remoteRun) && /t384 — the sniff is CACHE-SAFE/.test(remoteRun),
  "T1 remote-run: the sweep sniff is the cache-safe fragment (O_DIRECT first)"
);
must(
  /cacheSafeHeaderSniffLineForVar\(\)/.test(iterationLive),
  "T2 iteration-live: the live payload sniff is cache-safe too"
);
must(
  /witnessMrcHeader\(conn, clusterPath\)/.test(iterationLive) && /LOGIN-NODE CACHE ILLUSION/.test(iterationLive),
  "T3 verifiedStackPull: the witness ladder + the illusion verdict before any refusal"
);
must(
  /suspect\?: string/.test(storageDiag) &&
    /LOGIN-NODE CACHE ILLUSION \(t384\)/.test(storageDiag) &&
    /CF_COMPUTE_SUSPECT /.test(storageDiag),
  "T4 storage-diag: the suspect-file legs + the layered verdicts"
);
must(
  /CFW_B=/.test(cacheWitness) && /POSIX_FADV_DONTNEED/.test(cacheWitness) && /zeroHeaderWitnessed/.test(remoteRun),
  "T5 the witness module + the sweep's per-run dedup map"
);
must(/suspect: suspectFile/.test(remoteRun), "T6 the sweep passes the suspect round into the diagnostic");
must(
  /scancel -n \$\{shQuote\(jobName\)\}/.test(remoteRun) && /the ghost-submit guard/.test(remoteRun),
  "T7 the ghost-submit guard (scancel -n on a lost verdict)"
);
must(
  /DIRECT read says the file is HEALTHY/.test(remoteRun),
  "T8 the sweep witness receipt names the illusion"
);
must(
  /witnessScript/.test(cacheWitness) && /wordsAreZero/.test(cacheWitness),
  "T9 the witness script builder + the zero-shape classifier exist"
);

console.log(`t384 source X-ray: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
