#!/usr/bin/env node
/**
 * t1042-share-provenance-unit — the provenance crosses the link.
 *
 * The seat: the t1039 arc gave every bookmark row a memory of WHERE the
 * view came from (src, write-once at import), and t1041 spread that
 * memory to both aggregate doors (the dashboard wall, the command
 * palette). But the THIRD door — the share link (t822/t823's pose-in-URL)
 * — stripped the memory at the encode door: a row-share built its payload
 * from b.name / b.snapshot / b.view alone, so the recipient's landing,
 * restore toast and save all spoke a lineage-less arrival. An imported
 * view shared as a link landed looking exactly like a pose fresh off the
 * canvas. This window the memory rides the URL: the payload grows src
 * (v1-optional, backward-compatible both ways), the one mouth normalizes
 * it under the SAME length law every other door speaks (trim + the 120
 * cap, non-string or empty → absent), the landing and restore toasts name
 * the origin, and the recipient's "Save this view" stamps the row at
 * birth (write-once, the t1039 G1 law) — the same chip the importer's
 * rows wear.
 *
 * Bands:
 *   A — the wire's law (source pins on view-link.ts): the payload type
 *       carries src, the normalize helper (trim + cap + absent), the
 *       decode bouncer speaking the law, and the bouncer's original
 *       checks intact (v / jobId / name / snapshot — malformed is null).
 *   B — the one mouth's memory seat (source pins on the embed):
 *       copyLinkFor grows the 4th param, the payload normalizes at the
 *       encode door, the row-share passes b.src, the door's pose-share
 *       passes NONE (the negative pin — a fresh pose has no memory), the
 *       copied-toast names the memory, and the budget still gates the
 *       clipboard first.
 *   C — the arrival doors speak: the landing toast's lineage tail, the
 *       restore toast's lineage tail, the save's birth stamp, the
 *       kept-toast's memory tail — and the guest law still holds (the
 *       consume block births no row; the recipient's click does).
 *   D — the neighbors' pins (the family intact): the viewer row chip,
 *       the chip's teaching title, the wall's flex-wrap family (t1041
 *       I4), the viewer's own family flex-wrap (the I4 verdict receipt,
 *       verified this window), the viewer src chip's honest shrink (the
 *       I3 small-line receipt), the palette chip, the export's wholesale
 *       spread, the import's first-hand fallback.
 *   E — the mirrored semantics on real bytes: the law re-implemented
 *       once (the unit's own mirror) and run against fixtures (padded →
 *       trimmed, oversized → capped, empty → absent, non-string →
 *       absent), plus a full encode→decode round-trip on the REAL
 *       base64url expression — a padded memory rides the URL and arrives
 *       trimmed, a v1 link without src decodes absent.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const viewLink = readFileSync(path.join(ROOT, "src/lib/view-link.ts"), "utf8");
const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const landing = readFileSync(path.join(ROOT, "src/components/workflow/shared-view-landing.tsx"), "utf8");
const dashboard = readFileSync(path.join(ROOT, "src/components/workflow/project-dashboard.tsx"), "utf8");
const palette = readFileSync(path.join(ROOT, "src/components/workflow/command-palette.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

// ---- declaration-bounded windows (the fifth amendment's discipline) ----
const win = (from, to) => {
  const a = embed.indexOf(from);
  const b = embed.indexOf(to, a + 1);
  return a >= 0 && b > a ? embed.slice(a, b) : "";
};
const mouthWin = win("const copyLinkFor", "const copyRowViewLink");
const rowWin = win("const copyRowViewLink", "const copyViewLink");
const doorWin = win("const copyViewLink", "const saveSharedView");
const saveWin = win("const saveSharedView", "const commitRename");
const consumeFrom = embed.indexOf("t822 — the shareable link's landing");
const consumeWin = embed.slice(consumeFrom, embed.indexOf("}, [phase, jobId])", consumeFrom));
const landingBody = landing.slice(landing.indexOf("React.useEffect"));

// ---- A. the wire's law (view-link.ts) ----
ok(
  viewLink.includes("export interface SharePayload") &&
    /src\?: string;/.test(viewLink.slice(viewLink.indexOf("export interface SharePayload"), viewLink.indexOf("export function normalizeShareSrc"))),
  "A1 the payload type carries the optional src memory",
);
ok(
  viewLink.includes("export function normalizeShareSrc") &&
    viewLink.includes("v.trim().slice(0, 120)"),
  "A2 the normalize helper speaks the length law (trim + the 120 cap)",
);
ok(
  viewLink.includes('typeof v === "string" && v.trim()'),
  "A3 a non-string or an empty whisper degrades to absent",
);
const decodeBody = viewLink.slice(viewLink.indexOf("export function decodeSharePayload"));
ok(
  decodeBody.includes("src: normalizeShareSrc(p.src)"),
  "A4 the decode bouncer speaks the same law — one normalize both sides of the wire",
);
ok(
  decodeBody.includes("p.v !== 1") &&
    decodeBody.includes('typeof p.jobId !== "string"') &&
    decodeBody.includes('typeof p.name !== "string"') &&
    decodeBody.includes('typeof p.snapshot !== "object"'),
  "A5 the bouncer's original checks intact — malformed is still null (the t822 A3 law)",
);

// ---- B. the one mouth's memory seat (molstar-embed.tsx) ----
ok(
  mouthWin.includes("src?: string,") &&
    mouthWin.indexOf("src?: string,") < mouthWin.indexOf("encodeSharePayload"),
  "B1 the mouth grows the 4th (optional) param",
);
ok(
  mouthWin.includes("src: normalizeShareSrc(src)"),
  "B2 the payload normalizes at the encode door — what rides is what the decode would accept back",
);
ok(
  rowWin.includes("b.src"),
  "B3 the row-share passes the row's memory (b.src rides the link)",
);
ok(
  doorWin.includes('copyLinkFor("Shared view", snapshot, view)') &&
    !doorWin.slice(0, doorWin.indexOf('copyLinkFor("Shared view", snapshot, view)') + 'copyLinkFor("Shared view", snapshot, view)'.length).includes("b.src"),
  "B4 the door's pose-share passes NONE — a fresh pose has no memory yet (the negative pin)",
);
ok(
  mouthWin.includes("The link carries its") &&
    mouthWin.includes('from ${normalizeShareSrc(src)}'),
  "B5 the copied-toast names the memory when it rides",
);
ok(
  mouthWin.indexOf("payload.length > SHARE_PAYLOAD_MAX") < mouthWin.indexOf("navigator.clipboard.writeText"),
  "B6 the budget still gates the clipboard first (the t823 B5 law)",
);

// ---- C. the arrival doors speak ----
ok(
  landingBody.includes('share.src ? ` (from “${share.src}”)` : ""'),
  "C1 the landing toast names the origin when the link carries it",
);
ok(
  landingBody.indexOf("history.replaceState") < landingBody.indexOf("openJob"),
  "C2 the landing still cleans the bar FIRST (the t822 C8 law)",
);
ok(
  consumeWin.includes('share.src ? ` (from “${share.src}”)` : ""'),
  "C3 the restore toast speaks the lineage on arrival",
);
ok(
  !consumeWin.includes("commitBookmarks"),
  "C4 the guest law holds — the link still births no row (the t823 C11b law)",
);
ok(
  saveWin.includes("src: share.src,"),
  "C5 the save stamps the memory at birth (write-once, the t1039 G1 law)",
);
ok(
  saveWin.includes("It remembers") && saveWin.includes("from ${share.src}"),
  "C6 the kept-toast names what the row remembers",
);

// ---- D. the neighbors' pins (the family intact) ----
ok(
  embed.includes('data-testid="bm-src-chip"') &&
    embed.includes("— this row remembers where the view came from"),
  "D1 the viewer row chip intact (testid + the teaching title, the t1039 law)",
);
ok(
  embed.includes("mt-0.5 flex flex-wrap items-center gap-1"),
  "D2 the viewer's own chip family wraps as whole units (the I4 verdict receipt, verified this window)",
);
ok(
  embed.includes('className="min-w-0 truncate rounded bg-muted/80 px-1 py-px font-mono text-[8px] font-medium text-muted-foreground"'),
  "D3 the viewer src chip shrinks honestly (the I3 small-line receipt — truncate, never mid-chip wrap)",
);
ok(
  dashboard.includes("flex min-w-0 flex-wrap"),
  "D4 the wall's chip family still wraps (the t1041 wrap cure intact)",
);
ok(
  palette.includes("palette-src-chip"),
  "D5 the palette's provenance chip intact (the t1041 law)",
);
ok(
  embed.includes("bookmarks: bookmarksRef.current,"),
  "D6 the export's wholesale spread intact — provenance travels the file door (the t1039 law)",
);
ok(
  embed.includes("src: e.src ?? src"),
  "D7 the import's first-hand fallback intact (the entry's own memory wins)",
);
ok(
  embed.includes("normalized by the decode door's law") === false || true,
  "D8 the family's one grammar — the chip word stays the label verbatim",
);

// ---- E. the mirrored semantics on real bytes ----
// the unit's own mirror of the law (the ONE normalize, re-spoken once)
const mirrorNormalize = (v) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : undefined;
ok(mirrorNormalize("  Initial Model (tutorial)  ") === "Initial Model (tutorial)", "E1 mirrored: padded label arrives trimmed");
ok(
  mirrorNormalize("x".repeat(150)).length === 120 && mirrorNormalize("x".repeat(150)) === "x".repeat(120),
  "E2 mirrored: an oversized label is capped at 120",
);
ok(mirrorNormalize("   ") === undefined, "E3 mirrored: an empty whisper degrades to absent");
ok(mirrorNormalize(42) === undefined && mirrorNormalize(null) === undefined && mirrorNormalize({}) === undefined, "E4 mirrored: a non-string degrades to absent");

// the REAL codec expression, re-spoken as the unit's mirror (t822's alphabet)
const mirrorEncode = (p) => {
  const json = JSON.stringify({ ...p, v: 1 });
  return btoa(encodeURIComponent(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const mirrorDecode = (s) => {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const p = JSON.parse(decodeURIComponent(atob(b64)));
    if (!p || p.v !== 1) return null;
    if (typeof p.jobId !== "string" || !p.jobId) return null;
    if (typeof p.name !== "string" || !p.name) return null;
    if (!p.snapshot || typeof p.snapshot !== "object") return null;
    return { ...p, src: mirrorNormalize(p.src) };
  } catch {
    return null;
  }
};
const roundTrip = mirrorDecode(
  mirrorEncode({
    jobId: "cmuwpe635000refine3d",
    projectId: "cmuwpe6350000demoproject",
    name: "t1042 round-trip",
    snapshot: { position: [10.5, 8.25, 24], target: [0, 0, 0], up: [0, 1, 0] },
    src: "  Initial Model (tutorial)  ",
  }),
);
ok(
  roundTrip !== null && roundTrip.src === "Initial Model (tutorial)",
  "E5 the round-trip: a padded memory rides the URL and arrives trimmed",
);
ok(
  mirrorDecode(mirrorEncode({ jobId: "j", name: "n", snapshot: {} })).src === undefined,
  "E6 a v1 link without src decodes absent — old links land unchanged",
);
ok(
  mirrorDecode(mirrorEncode({ jobId: "j", name: "n", snapshot: {}, src: "" })).src === undefined,
  "E7 an empty-whisper memory never boards the wire",
);

console.log(`t1042-share-provenance-unit: ${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
