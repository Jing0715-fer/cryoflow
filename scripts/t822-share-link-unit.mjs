#!/usr/bin/env node
/* t822 — the shareable view link: a pose that travels inside the URL.
 *
 * The feature: "Copy view link" on the bookmark door's footer encodes the
 * CURRENT pose + optics into a base64url payload (?view=...) — self-
 * contained, no account, no bookmark row, no sync. The landing pad reads
 * the param once, cleans the address bar FIRST (reload never re-flies),
 * bounces malformed payloads with their own honest toast, and drives the
 * store's openJob dialect (the wall-jump machinery, with boot-race
 * retries). The viewer consumes the staged payload one-shot on the
 * MATCHING job and applies the pose as a GUEST — no bookmark row is born.
 *
 * The probe pins the LAWS statically (source reads — the fleet's calibre):
 *
 *   A. the payload law (what travels)
 *      1. encodeSharePayload / decodeSharePayload exist in view-link.ts
 *         — the family home, beside the PENDING_VIEW handshake
 *      2. the base64url alphabet swap (+ / =) — the payload rides a
 *         query param unmangled
 *      3. the decode is a bouncer: v / jobId / name / snapshot checked,
 *         malformed → null (never a partial pose)
 *      4. the URL budget: SHARE_PAYLOAD_MAX exists and the door checks
 *         it BEFORE the clipboard is touched
 *
 *   B. the copy door (how it speaks)
 *      5. the honest a11y name rides the footer ("Copy view link — …")
 *      6. the oversized refusal and the clipboard-deny both speak
 *         (the t669 doctrine reaches this door — every exit owes a toast)
 *      7. the payload carries the project hint (activeProjectId — the
 *         cross-project landing needs it to switch before it lands)
 *
 *   C. the landing pad (how it arrives)
 *      8. the address bar is cleaned BEFORE any await — the one-shot
 *         contract starts at the landing, reload never re-flies
 *      9. the boot-race retry loop exists (openJob re-driven, jobs
 *         re-checked) — the t407 lesson respected
 *     10. the honest miss: retries exhausted → staged key removed +
 *         could-not-land toast (nothing stale lingers)
 *     11. malformed payloads bounce at the LANDING (never staged) — the
 *         viewer's consumer only ever sees well-formed shares
 *
 *   D. the consume (how it applies)
 *     12. one-shot on the matching job: removeItem BEFORE the restore
 *     13. the guest law: NO commitBookmarks in the consume block — no
 *         bookmark row is born from a link (net 0 by construction)
 *     14. the t669 doctrine: restore failure speaks honestly
 *
 *   E. the calibre
 *     15. no new API route — 18 api dirs + src/app/api/route.ts = 19
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const viewLink = readFileSync("src/lib/view-link.ts", "utf8");
const embed = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
const landing = readFileSync("src/components/workflow/shared-view-landing.tsx", "utf8");
const page = readFileSync("src/app/page.tsx", "utf8");

let pass = 0;
const fails = [];
const ok = (cond, label) => (cond ? pass++ : fails.push(label));

// ---- A. the payload law ----
ok(
  viewLink.includes("export function encodeSharePayload") &&
    viewLink.includes("export function decodeSharePayload"),
  "A1 the codec lives in view-link.ts — the family home",
);
ok(
  viewLink.includes('replace(/\\+/g, "-")') &&
    viewLink.includes('replace(/\\//g, "_")') &&
    viewLink.includes("replace(/=+$/, \"\")"),
  "A2 the base64url alphabet swap rides the encode",
);
const decodeBody = viewLink.slice(viewLink.indexOf("export function decodeSharePayload"));
ok(
  decodeBody.includes("p.v !== 1") &&
    decodeBody.includes('typeof p.jobId !== "string"') &&
    decodeBody.includes('typeof p.name !== "string"') &&
    decodeBody.includes('typeof p.snapshot !== "object"'),
  "A3 the bouncer checks v / jobId / name / snapshot — malformed is null",
);
ok(
  viewLink.includes("SHARE_PAYLOAD_MAX = 6000") &&
    embed.includes("payload.length > SHARE_PAYLOAD_MAX") &&
    embed.indexOf("payload.length > SHARE_PAYLOAD_MAX") < embed.indexOf("navigator.clipboard.writeText"),
  "A4 the URL budget is checked BEFORE the clipboard",
);

// ---- B. the copy door ----
ok(
  embed.includes('aria-label="Copy view link — share the current pose as a URL"'),
  "B5 the door's honest a11y name rides the footer",
);
ok(
  embed.includes("This view is too large to share as a link") &&
    embed.includes("Could not reach the clipboard"),
  "B6 oversized and clipboard-deny both speak — every exit owes a toast",
);
ok(
  embed.includes("projectId: activeProjectId ?? null"),
  "B7 the payload carries the project hint for the cross-project landing",
);

// ---- C. the landing pad ----
const landingBody = landing.slice(landing.indexOf("React.useEffect"));
const cleanIdx = landingBody.indexOf("history.replaceState");
const awaitIdx = landingBody.indexOf("openJob");
ok(
  cleanIdx > 0 && awaitIdx > cleanIdx,
  "C8 the address bar is cleaned BEFORE the first await — reload never re-flies",
);
ok(
  landingBody.includes("attempt < 6") && landingBody.includes("setTimeout"),
  "C9 the boot-race retry loop exists (the t407 lesson respected)",
);
ok(
  landingBody.includes("removeItem(PENDING_SHARE_KEY)") &&
    landingBody.includes("Shared view could not land"),
  "C10 the honest miss removes the staged key and speaks",
);
ok(
  landingBody.indexOf("decodeSharePayload(raw)") < landingBody.indexOf("setItem(PENDING_SHARE_KEY"),
  "C11 malformed payloads bounce at the landing — never staged",
);
ok(
  page.includes("<SharedViewLanding />"),
  "C11b the landing pad is wired into the home route",
);

// ---- D. the consume ----
const consumeBody = embed.slice(embed.indexOf("t822 — the shareable link's landing"));
const consumeSlice = consumeBody.slice(0, consumeBody.indexOf("}, [phase, jobId])"));
ok(
  consumeSlice.indexOf("removeItem(PENDING_SHARE_KEY)") < consumeSlice.indexOf("restoreBookmarkRef"),
  "D12 one-shot on the matching job — the key is spent before the flight",
);
ok(
  !consumeSlice.includes("commitBookmarks"),
  "D13 the guest law — no bookmark row is born from a link",
);
ok(
  consumeSlice.includes("Shared view could not be restored"),
  "D14 the restore failure speaks honestly (the t669 doctrine)",
);

// ---- E. the calibre ----
let apiEntries = 0;
let apiDirs = 0;
try {
  for (const e of readdirSync("src/app/api")) {
    apiEntries += 1;
    try {
      if (statSync(`src/app/api/${e}`).isDirectory()) apiDirs += 1;
    } catch {}
  }
} catch {}
ok(
  apiEntries === 19 && apiDirs === 18,
  "E15 no new API route — 18 api dirs + src/app/api/route.ts = 19 entries",
);

console.log(`t822-share-link-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
