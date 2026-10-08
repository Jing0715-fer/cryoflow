// qa-refine-host.mjs — the JS twin of qa_lib.resolve_refine_host (+qa67's tiers).
//
// WHY THIS EXISTS (t705): the five qa-batch suites (qa49/50/51/55/57) pinned
// `JOB = "QA Refine3D"` — a name from the pre-t531 world that the canonical
// 17-node roster cannot hold (the t405 seesaw verdict, restated in qa67's
// t407 comment: "the name was only ever one world's spelling of it"). The
// Python side learned the manifest contract at t532 (qa_lib) and the type
// fallback at t407 (qa67); the JS side kept clicking a ghost. The qa batch's
// first whole-batch run since t525 (t705's bed rotation) lit the latent
// disease: 5 REAL-FAILs, one cause.
//
// The law (t703): a probe's expectations are derived from the world, not
// pinned from history. Resolution tiers, mirroring the Python side:
//   1. the manifest contract (data/old-world.json chain.refine3d — written
//      by qa-t531-old-world-seed.mjs) matched against the ACTIVE world's
//      /api/jobs by id — deterministic across renames and reseeds;
//   2. type fallback (the canonical roster carries exactly one refine3d);
//   3. an honest throw — never a fabricated ghost job.
// The NAME is returned, never pinned: suites derive every UI string and
// report assertion from the host object itself.
//
// Usage:
//   import { resolveRefineHost } from "./qa-refine-host.mjs";
//   const host = resolveRefineHost();       // { id, name, type, ... }
//   const JOB = host.name;                  // the world's own spelling

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MANIFEST = "/home/z/my-project/data/old-world.json";
const BASE = "http://localhost:3000";

export function resolveRefineHost() {
  const raw = execSync(`curl -s --max-time 20 "${BASE}/api/jobs"`, {
    encoding: "utf8",
    timeout: 30_000,
  });
  const arr = (() => {
    try {
      const d = JSON.parse(raw);
      return Array.isArray(d) ? d : d.jobs ?? [];
    } catch {
      return [];
    }
  })();

  let contractId = null;
  try {
    contractId = JSON.parse(readFileSync(MANIFEST, "utf8"))?.chain?.refine3d ?? null;
  } catch {
    // no manifest — the type fallback is the only witness left
  }

  const host =
    (contractId && arr.find((j) => j.id === contractId)) ||
    arr.find((j) => j.type === "refine3d");

  if (!host) {
    throw new Error(
      "qa-refine-host: no refine3d host in the active world " +
        "(manifest id miss + no type match) — run scripts/qa-t531-old-world-seed.mjs",
    );
  }
  if (host.type !== "refine3d") {
    throw new Error(`qa-refine-host: resolved job type '${host.type}', expected refine3d`);
  }
  return host;
}
