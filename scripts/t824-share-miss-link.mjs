#!/usr/bin/env node
/**
 * t824 — craft the two share-link exits the landing pad has never filmed
 * live, using the project's OWN codec rules (src/lib/view-link.ts):
 *
 *  1. the could-not-land honest miss — a WELL-FORMED payload whose jobId
 *     no project on this browser can reach: the bouncer passes it, the
 *     landing stages it, six openJob drives fail, the staged key is
 *     removed, and the honest toast speaks.
 *  2. the malformed bounce — a payload string that is not decodable:
 *     the bouncer returns null and the landing refuses before staging.
 *
 * The encode mirrors encodeSharePayload byte-for-byte:
 *   btoa(encodeURIComponent(json)) with the base64url alphabet swap.
 */
const encode = (payload) =>
  Buffer.from(encodeURIComponent(JSON.stringify(payload)), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// 1 — the honest miss: every field the bouncer checks is well-formed,
// but the job does not exist on this world.
const miss = {
  v: 1,
  jobId: "job-t824-unreachable",
  name: "t824 honest miss",
  snapshot: {
    position: [10.5, 8.25, 24.0],
    target: [0, 0, 0],
    up: [0, 1, 0],
  },
  view: { slice: "z", sigma: 1.2, threshold: 0.04 },
};
const missUrl = `http://localhost:3000/?view=${encode(miss)}`;

// 2 — the malformed bounce: truncated / non-decodable payload.
const malformedUrl = "http://localhost:3000/?view=t824-not-a-payload";

// 3 — the door drive: a VALID payload whose job EXISTS (the refine3d
// half-map world) — the landing's wall-jump drives the browser onto the
// trio's job so the door witness can begin.
const drive = {
  v: 1,
  jobId: "cmuwipe635000refine3d",
  projectId: "cmuwipe6350000demoproject",
  name: "t824 door drive",
  snapshot: {
    position: [10.5, 8.25, 24.0],
    target: [0, 0, 0],
    up: [0, 1, 0],
  },
};
const driveUrl = `http://localhost:3000/?view=${encode(drive)}`;

// sanity — decode back with the same rules the bouncer uses
const roundTrip = (() => {
  let b64 = missUrl.split("?view=")[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return JSON.parse(decodeURIComponent(Buffer.from(b64, "base64").toString("utf8")));
})();
if (roundTrip.jobId !== miss.jobId || roundTrip.v !== 1) {
  console.error("FATAL: round-trip mismatch — the crafted payload is not honest");
  process.exit(1);
}

console.log("the share family's two unwitnessed exits, encoded with the project's own codec rules:");
console.log(`MISS_URL: ${missUrl}`);
console.log(`MISS_URL_LEN: ${missUrl.length}`);
console.log(`MALFORMED_URL: ${malformedUrl}`);
console.log(`DRIVE_URL: ${driveUrl}`);
console.log(`DRIVE_URL_LEN: ${driveUrl.length}`);
