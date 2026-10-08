// t733 — the shelf's dictionary door: the Type Card's second home.
// The palette's rows have had an info mouth since t730 (span-as-button,
// Task 133 grammar); a preset snapshot's type line is where the same
// question gets asked on the dashboard — a preset IS tuned knowledge
// about a type, and the type's four answers (what is it / where from /
// where next / what to tune) belong next to it. t730's census judgment
// stamped the tier language in TWO homes — the census's own tell that a
// second door was coming. t732's two-sizes-one-badge law becomes the
// two-sizes-one-door law here: same grammar, same sentence, only the
// size is the card's compact dialect.
//
//   A  one card, two hosts: the shelf imports the SAME TypeCardDialog
//      (exactly two hosts in the tree), keys it by the palette's
//      cardKey law (open = key !== null, closing clears), carries zero
//      onAdded housekeeping (the dialog closes itself — the store's
//      addJob rides the active project), and the door rides the Task
//      133 grammar byte-for-byte: span-as-button, pointerdown
//      swallowed, Enter/Space spoken, aria = title, zero storage,
//      zero motion.
//   B  live-fire over the REAL lib: the door's key domain is the
//      preset's type field verbatim — every JOB_TYPES corpus key is a
//      legal door target, the unknown key gets an honest no-op (the
//      card renders null on no spec), the aria sentence is byte-equal
//      to the palette's template, the empty shelf renders zero doors,
//      and chip navigation re-assigns the key exactly like the
//      palette's host does.
//   C  the two faces: compact (size-4 dot, 10px icon — the card's
//      tight grammar) vs full (size-5, 12px icon — the palette row's
//      reading grammar); the three-state hover grammar (silent at
//      rest, 60% on card hover, full on self hover/focus); the
//      delete/info pair cohabits one card without colliding (info in
//      flow, delete absolute).
//   D  purity: zero hue-name classes (the door needs no census visa),
//      the amber two-home census is untouched, the shelf carries zero
//      tier vocabulary (t732 moved that into the badge component), and
//      the palette's own door sentence is untouched (historical string
//      fidelity).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// jiti loads the REAL lib (Node ≥24 ESM no longer resolves extensionless
// imports — the family's loader for live-fire; t653's范式 rides again)
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const { JOB_TYPES, jobType, upstreamOf, nextStepsFor } = await jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const shelf = readSrc("components/workflow/user-preset-shelf.tsx");
const pal = readSrc("components/workflow/palette.tsx");
const card = readSrc("components/workflow/type-card-dialog.tsx");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");
const codemod = readFileSync(path.join(here, "t650-solid-codemod.mjs"), "utf8");

/* ================================================================== */
/* A — one card, two hosts                                             */
/* ================================================================== */
console.log("\nA — the shelf hosts the SAME card the palette hosts");

must(/import \{ TypeCardDialog \} from "\.\/type-card-dialog"/.test(shelf)
  && /import \{ TypeCardDialog \} from "\.\/type-card-dialog"/.test(pal),
  "A both hosts import the same dialog — the shelf runs zero second card face");

const tree = ["components/workflow/user-preset-shelf.tsx", "components/workflow/palette.tsx", "components/workflow/project-dashboard.tsx", "components/workflow/app-shell.tsx", "components/workflow/job-inspector.tsx", "components/workflow/job-card.tsx"];
const legalHosts = ["components/workflow/user-preset-shelf.tsx", "components/workflow/palette.tsx"];
const otherHosts = tree.filter((f) => !legalHosts.includes(f) && /<TypeCardDialog\b/.test(readSrc(f)));
must(otherHosts.length === 0 && (shelf.match(/<TypeCardDialog\b/g) ?? []).length === 1 && (pal.match(/<TypeCardDialog\b/g) ?? []).length === 1,
  "A exactly two TypeCardDialog mounts in the tree (palette + shelf), zero strays",
  otherHosts.join(",") || "none");

must(/const \[cardKey, setCardKey\] = React\.useState<string \| null>\(null\)/.test(shelf)
  && /open=\{cardKey !== null\}/.test(shelf)
  && /if \(!o\) setCardKey\(null\)/.test(shelf),
  "A the shelf's gate is the palette's cardKey law verbatim (open = key !== null, closing clears)");

must(/onNavigate=\{\(key\) => setCardKey\(key\)\}/.test(shelf),
  "A chip navigation re-assigns the key — same-dialog page swaps work from the shelf too");

const doorStart = shelf.indexOf('data-testid={`shelf-info-');
const doorRegion = doorStart === -1 ? "" : shelf.slice(shelf.lastIndexOf("{/* t733", doorStart), shelf.indexOf("</span>", doorStart));
must(doorStart !== -1,
  "A the shelf carries a shelf-info-{key} dictionary door");

must(/onAdded=/.test(shelf) === false,
  "A zero onAdded housekeeping — the dialog closes itself after a successful add");

must(doorRegion.includes('role="button"') && doorRegion.includes("tabIndex={0}")
  && doorRegion.includes("onPointerDown"),
  "A the door rides the Task 133 grammar: span-as-button, pointerdown swallowed");

must(/onKeyDown=\{\(e\) => \{[^}]*"Enter" \|\| e\.key === " "[^}]*setCardKey\(p\.type\)/.test(shelf.replace(/\n/g, " ")),
  "A the door answers Enter/Space exactly like the palette's door and the star");

must(doorRegion.includes("aria-label={`About ${t?.label ?? p.type} — params, ports, neighbours`}")
  && doorRegion.includes("title={`About ${t?.label ?? p.type} — params, ports, neighbours`}"),
  "A aria and title are the same sentence (the row's reading order: about-the-type)");

must(/\bfetch\(|localStorage|sessionStorage|window\.|document\./.test(doorRegion) === false,
  "A the door is a pure reading surface — zero fetch, zero storage, zero DOM probes");

must(!/animate-/.test(doorRegion) && !/transition-[a-z]+-\d/.test(doorRegion.replace("transition-all", "")),
  "A no motion debt — a dictionary door is a fact, not an arrival");

/* ================================================================== */
/* B — live-fire over the REAL lib                                     */
/* ================================================================== */
console.log("\nB the door's key domain against the real JOB_TYPES corpus");

must(JOB_TYPES.length >= 35, `B corpus sanity: ${JOB_TYPES.length} types in the book`, "≥35");

must(/data-testid=\{\`shelf-info-\$\{p\.type\}\`\}/.test(shelf),
  "B the testid keys on p.type VERBATIM — the preset's own type field, no re-mapping");
must(/setCardKey\(p\.type\)/.test(shelf) && (shelf.match(/setCardKey\(p\.type\)/g) ?? []).length === 2,
  "B both mouths (click + keyboard) key the same p.type — no split-brain gate");

// every corpus key is a legal door target: jobType resolves it, the
// card's four answers are non-empty for at least the description leg
const allResolve = JOB_TYPES.every((t) => jobType(t.key)?.key === t.key);
must(allResolve, "B every corpus key resolves through jobType — the door never opens on a ghost");
const withUpstream = JOB_TYPES.filter((t) => upstreamOf(t.key).length > 0).length;
const withDownstream = JOB_TYPES.filter((t) => nextStepsFor(t.key).length > 0).length;
must(withUpstream >= 20 && withDownstream >= 20,
  `B the card's live legs have real answers for most types (upstream ${withUpstream}, downstream ${withDownstream})`);
must(upstreamOf("import").length === 0 && nextStepsFor("import").length > 0,
  "B import's upstream is honestly empty while its downstream isn't — the front door rides the same card");

// unknown keys: the card renders null on no spec (honest no-op)
must(/if \(!spec\) return null;/.test(card),
  "B an unknown preset type gets an honest no-op — the card renders null on no spec (zero invented answers)");

must(/aria-label=\{\`About \$\{t\?\.label \?\? p\.type\} — params, ports, neighbours\`\}/.test(shelf)
  && /aria-label=\{\`About \$\{t\.label\} — params, ports, neighbours\`\}/.test(pal),
  "B the two hosts speak the SAME sentence — the shelf's falls back to the raw type only when the book is silent");

// empty shelf = zero doors (the door lives INSIDE the card map)
const emptyBranch = shelf.slice(shelf.indexOf("{isEmpty ? ("), shelf.indexOf('data-atomic-grid'));
must(emptyBranch.includes("preset-import-empty-door") && !emptyBranch.includes("shelf-info-"),
  "B the empty shelf renders zero doors — the door is per-card, and zero cards is zero doors");

must(/<TypeCardDialog\n        typeKey=\{cardKey\}/.test(shelf)
  && /typeKey=\{cardKey\}/.test(pal),
  "B both hosts feed typeKey from their own cardKey state — one gate per host");

must(/const infoDoor/.test(pal) === false,
  "B the palette's door stays inline (no forced shared extraction) — two hosts, two JSX sites, one component and one grammar");

/* ================================================================== */
/* C — the two faces                                                   */
/* ================================================================== */
console.log("\nC — two sizes, one door; the card's compact dialect");

must(/flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground\/0/.test(shelf)
  && /flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground\/0/.test(pal),
  "C the size dialect: shelf compact (size-4) vs palette full (size-5) — same grammar, card-appropriate size");

must(/<Info className="size-2\.5" aria-hidden="true" \/>/.test(shelf)
  && /<Info className="size-3" aria-hidden="true" \/>/.test(shelf) === false,
  "C the compact face carries the smaller icon (10px vs the palette's 12px)");

must(/text-muted-foreground\/0 transition-all hover:text-muted-foreground group-hover\/preset:text-muted-foreground\/60 focus-visible:text-muted-foreground hover:bg-accent/.test(shelf),
  "C the three-state hover grammar: silent at rest, 60% on card hover, full on self hover/focus — plus the accent hover floor");

must(/group-hover\/item:text-muted-foreground\/60/.test(pal),
  "C the palette's face keeps its own group name (group/item) — the grammar is shared, the group scope is the host's");

must(/data-testid="preset-shelf-delete"/.test(shelf)
  && shelf.indexOf("shelf-info-") < shelf.indexOf("preset-shelf-delete"),
  "C info and delete cohabit the card: info in flow (type line), delete absolute (top-right) — reading order preserved");

must(/title=\{p\.type\}/.test(shelf),
  "C the type label keeps its raw-type tooltip — the door ADDS an answer, it doesn't remove one");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — zero new color words, zero tier vocabulary, census untouched");

must(/(?:emerald|amber|rose|sky|violet|teal|orange|red|green|blue|yellow|pink|cyan|indigo|lime|fuchsia)-\d{2,3}/.test(doorRegion) === false,
  "D the door carries zero hue-name classes — muted/accent only, no census visa needed");

must((census.match(/user-preset-shelf/g) ?? []).length === 0
  && (codemod.match(/user-preset-shelf/g) ?? []).length === 0,
  "D the census tables carry zero user-preset-shelf rows — nothing to exempt, nothing to retire");

must(/import \{ TierBadge/.test(shelf) === false && /TIER_NAMES|TIER_SHORT|tier ===/.test(shelf) === false,
  "D the shelf carries zero tier vocabulary — the badge is palette/type-card language (t732's home), the card renders it");

const amberHomes = ["components/workflow/param-dialect-badge.tsx", "components/workflow/find-mark.tsx"];
const amberCounts = amberHomes.map((f) => (readSrc(f).match(/amber-400\/35/g) ?? []).length);
must(amberCounts.every((c) => c >= 1)
  && (["components/workflow/user-preset-shelf.tsx", "components/workflow/palette.tsx", "components/workflow/type-card-dialog.tsx"].every((f) => (readSrc(f).match(/amber-400\/35/g) ?? []).length === 0)),
  "D the amber two-home census is untouched (param-dialect-badge + find-mark), the shelf family stays clean");

must(pal.includes("About ${t.label} — params, ports, neighbours")
  && /data-testid=\{\`palette-info-\$\{t\.key\}\`\}/.test(pal),
  "D the palette's own door is byte-untouched — historical string fidelity on the first host");

console.log(`\n=== t733: ${PASS} pass / ${FAIL} fail ===`);
process.exit(FAIL === 0 ? 0 : 1);
