/**
 * t495 — the assistant learns to point: the transcript's prose joins
 * the deep-link family. The tool cards had a locate button (revealJob)
 * since their birth, but the model's own sentences kept naming jobs as
 * inert text — "QA Refine 410 · FSC 0.143 at 4.1 Å" was a signpost,
 * not a door. Now the prose names mint doors: linkifyJobs rewrites
 * exact job-name matches into cryoflow-job:// markdown links, and the
 * panel's `a` override turns those into teal chips riding revealJob —
 * the SAME engine the locate button uses (one engine, five surfaces).
 *
 *   T1 linkify behavior — exact matches mint links; longest name wins
 *                      its prefix; code spans are immune; regex
 *                      specials and duplicates behave; empties pass
 *                      through untouched
 *   T2 the door       — the `a` override intercepts the protocol,
 *                      rides revealJob (no second engine), carries the
 *                      address + the Chinese locate promise, wears the
 *                      panel's teal; ordinary links pass through
 *   T3 the honesty    — linkify lives at RENDER time on the assistant
 *                      prose only; user turns keep their own words;
 *                      the md/json export path never calls linkify
 *                      (the exported bytes stay door-free)
 *   T4 the store      — revealJob exists (Task 126's ONE deep-link);
 *                      jobs subscribe in the panel (the render-time
 *                      well the rewrite drinks from)
 */

import { readFileSync } from "fs";

/* t503 — the checkout moves between sandbox resets (my-project era ->
 * cryoflow home); resolve the repo root from THIS file, not a
 * hardcoded absolute path that rots the bench the moment the tree moves. */
const REPO = (await import("node:path")).default.resolve(
  (await import("node:url")).fileURLToPath(new URL(".", import.meta.url)),
  "..",
);
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}
function eq(a: unknown, b: unknown, label: string): void {
  ok(a === b, `${label} (got ${JSON.stringify(a)})`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");
const panelSrc = read("src/components/ai/assistant-panel.tsx");
const libSrc = read("src/lib/linkify-jobs.ts");

// behavior: the real function, not a re-typed twin
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { linkifyJobs, JOB_LINK_PROTOCOL } = require(`${REPO}/src/lib/linkify-jobs.ts`) as {
  linkifyJobs: (text: string, jobs: { id: string; name: string }[]) => string;
  JOB_LINK_PROTOCOL: string;
};

const JOBS = [
  { id: "j-1", name: "QA Refine 410" },
  { id: "j-2", name: "Motion Correction 1" },
  { id: "j-3", name: "Motion Correction 10" },
  { id: "j-4", name: "CTF Estimation (tutorial)" },
];

// ---------------------------------------------------------------- T1
section("T1 linkify behavior — exact, longest-first, code-span immune");
eq(
  linkifyJobs("QA Refine 410 reached 4.1 Å.", JOBS),
  `[QA Refine 410](${JOB_LINK_PROTOCOL}j-1) reached 4.1 Å.`,
  "an exact name mints a protocol link",
);
eq(
  linkifyJobs("Motion Correction 10 and Motion Correction 1 both ran.", JOBS),
  `[Motion Correction 10](${JOB_LINK_PROTOCOL}j-3) and [Motion Correction 1](${JOB_LINK_PROTOCOL}j-2) both ran.`,
  "longest name wins its own prefix (both doors point right)",
);
eq(
  linkifyJobs("run `Motion Correction 1` with defaults.", JOBS),
  "run `Motion Correction 1` with defaults.",
  "a name inside a code span stays code (immune)",
);
eq(
  linkifyJobs("QA Refine 410 + QA Refine 410 again.", JOBS),
  `[QA Refine 410](${JOB_LINK_PROTOCOL}j-1) + [QA Refine 410](${JOB_LINK_PROTOCOL}j-1) again.`,
  "every occurrence links (one name, many doors)",
);
eq(
  linkifyJobs("CTF Estimation (tutorial) is fine.", JOBS),
  `[CTF Estimation (tutorial)](${JOB_LINK_PROTOCOL}j-4) is fine.`,
  "regex specials inside a name are matched literally",
);
eq(linkifyJobs("", JOBS), "", "empty text passes through");
eq(linkifyJobs("no names here", []), "no names here", "empty roster passes through");
eq(linkifyJobs("still nothing", JOBS), "still nothing", "text without names passes through untouched");
ok(
  !linkifyJobs("MotionCorr2 and QA Refine 41 are not the jobs.", JOBS).includes(JOB_LINK_PROTOCOL),
  "partial names never mint doors (a name is a promise — the t494 law at word scale)",
);

// ---------------------------------------------------------------- T2
section("T2 the door — protocol intercept, revealJob reuse, teal grammar");
ok(/const PROSE_COMPONENTS: Components = \{/.test(panelSrc), "PROSE_COMPONENTS declared (module-level — no closure, no deps to keep honest)");
ok(/href\.startsWith\(JOB_LINK_PROTOCOL\)/.test(panelSrc), "the override intercepts the protocol, not every link");
ok(/data-assistant-door=\{id\}/.test(panelSrc), "the chip carries its address (data-assistant-door = jobId)");
ok(/在画布中定位/.test(panelSrc), "the promise is spoken in the panel's own language (locate, same verb as the tool card's button)");
ok(/useWorkflowStore\.getState\(\)\.revealJob\(id\)/.test(panelSrc), "the door rides revealJob — the SAME deep-link engine as the tool cards' locate (no second engine)");
ok(/text-teal-700|text-teal-300/.test(panelSrc) && /hover:bg-teal-500\/10/.test(panelSrc), "the chip wears the panel's teal (the door belongs to the surface it lives on)");
ok(/<a href=\{href\} \{\.\.\.rest\}>/.test(panelSrc), "ordinary links pass through untouched");
ok(/urlTransformKeepDoors/.test(panelSrc) && /const urlTransformKeepDoors = \(url: string\): string =>\s*\n\s*url\.startsWith\(JOB_LINK_PROTOCOL\) \? url : defaultUrlTransform\(url\);/.test(panelSrc), "the URL transform passes the house protocol and delegates everything else to defaultUrlTransform (the sanitizer extended, not undone)");
ok(/urlTransform=\{urlTransformKeepDoors\}/.test(panelSrc), "the prose Markdown mounts the transform — without it react-markdown's default urlTransform strips cryoflow-job:// to \"\" and every door arrives DISARMED (caught live: the override read href=\"\" and fell through to the plain anchor)");
ok(/node: _node/.test(panelSrc), "the hast node is stripped from the spread (letting it ride {...rest} paints node=[object Object] onto the real DOM — caught live in the first render)");
ok(panelSrc.includes("components={PROSE_COMPONENTS}"), "the prose Markdown mounts the override");
ok(/components=\{PROSE_COMPONENTS\} urlTransform=\{urlTransformKeepDoors\}>\{linkifyJobs\((?:item|seg)\.text, jobs\)\}/.test(panelSrc), "linkify runs at RENDER on the assistant prose (derived, never stored) — override + transform mounted beside it (t500's segment loop rides the same render law)");

// ---------------------------------------------------------------- T3
section("T3 the honesty — user words stay user words, export bytes stay clean");
const userBlock = panelSrc.slice(panelSrc.indexOf('item.kind === "user"'), panelSrc.indexOf('item.kind === "notice"'));
ok(!userBlock.includes("linkifyJobs"), "user turns are not linkified (your own words are yours)");
const exportArea = panelSrc.slice(panelSrc.indexOf("已导出") - 400 > 0 ? panelSrc.indexOf("已导出") - 400 : 0, panelSrc.indexOf("已导出") + 200);
ok(!exportArea.includes("linkifyJobs"), "the md/json export path never calls linkify (render-time only — t483's door law at chat scale)");
ok(/linkify-jobs/.test(panelSrc) && /from "@\/lib\/linkify-jobs"/.test(panelSrc), "the rewrite is imported from ONE birthplace (twins fork, imports don't)");

// ---------------------------------------------------------------- T4
section("T4 the store — the deep-link engine and its render-time well");
ok(/revealJob: \(id: string\) => void;/.test(read("src/lib/store.ts")), "revealJob exists in the store (Task 126's ONE deep-link landing)");
ok(/const jobs = useWorkflowStore\(\(s\) => s\.jobs\);/.test(panelSrc), "jobs subscribe in the panel (the well the rewrite drinks from)");
ok(/五 surfaces|five\s+surfaces/.test(libSrc + panelSrc), "the fifth-surface law is written where the next reader will find it");
ok(/export const JOB_LINK_PROTOCOL/.test(libSrc), "the protocol constant is exported (the override slices it, never retypes it)");

console.log(`\n----\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
