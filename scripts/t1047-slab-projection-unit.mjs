#!/usr/bin/env node
/**
 * t1047-slab-projection-unit — the slab's own export.
 *
 * The face: the clip rows keep intervals (t905's two-thumb editor), but
 * the KEPT slab itself had no export — the planes have the triptych,
 * the landscape has the profile CSV, and the slab (the ray family
 * between two faces) stayed a viewing trick. The cure: each clip row
 * grows a project seat — the rays through THAT axis' kept interval
 * fold into ONE in-plane image (max intensity, the cryo-EM standard),
 * rendered through the same window/polarity pipeline as every tile and
 * downloaded as a PNG. The server grows `plane=project` (from/to in
 * the clip rows' own fraction language, op max|mean|min with max the
 * default), the lib grows readMrcProjection (the cached full-volume
 * decode's second citizen — one decode serves every fold) and
 * renderMrcProjectionPng (downsample → stretch → gray PNG, the display
 * truth).
 *
 * Bands:
 *   A — the lib's face (mrc.ts): the fold's exports, the three ops
 *       with max first, the honest depth (voxels), the in-plane frame
 *       words (z → nx×ny, y → nx×nz, x → ny×nz), the cached decode
 *       (the oblique reader's LRU), the OOM law (clean refusal), the
 *       degenerate clamp (at least one plane), and the render riding
 *       the shared display truth (downsample → stretch → grayToPng).
 *   B — the route's face (outputs/file/route.ts): plane=project parse,
 *       the volumes-only refusal WORD for stacks, the fraction
 *       defaults (from 0, to 1 — full extent without params), the op
 *       default (max), the pngKey carrying pf/pt/po (a cache key that
 *       forgets the slab is a cache that lies), the heavy-slot ride,
 *       and the import.
 *   C — the client seat (molstar-embed.tsx): the row testids, the
 *       Layers icon (the fold's own face — NOT the loader beside it),
 *       the title's two voices (kept slab speaks its percentages, full
 *       extent says so), the "max intensity" word verbatim, the status
 *       mouth (role=status, the success/destructive dress, the 4 s
 *       flash), the filename family (map-project-<axis><lo>-<hi>), the
 *       downloadBlob sink (t646's one blob door), the busy gate (one
 *       fold at a time — the disabled law), and the URL's op=max.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const mrc = readFileSync(path.join(ROOT, "src/lib/mrc.ts"), "utf8");
const route = readFileSync(path.join(ROOT, "src/app/api/jobs/[id]/outputs/file/route.ts"), "utf8");
const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

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

console.log("A — the lib's face (the fold)");
{
  ok(mrc.includes("export function readMrcProjection("), "the fold is born (readMrcProjection exported)");
  ok(mrc.includes("export type MrcProjectionOp"), "the op type is born");
  const opIdx = mrc.indexOf("export type MrcProjectionOp");
  const opWindow = mrc.slice(opIdx - 300, opIdx + 240);
  ok(opWindow.includes('"max" | "mean" | "min"'), "the three ops in one union (max first)");
  ok(opWindow.includes("cryo-EM standard"), "the union's comment names max the standard");
  const foldIdx = mrc.indexOf("export function readMrcProjection(");
  const foldWindow = mrc.slice(foldIdx, foldIdx + 3400);
  ok(foldWindow.includes("readMrcVolumeCached(file, h)"), "the fold rides the cached full-volume decode (one decode, every fold)");
  ok(foldWindow.includes("voxels"), "the honest depth rides the result (voxels)");
  const foldDoc = mrc.slice(foldIdx - 1400, foldIdx);
  ok(foldDoc.includes("z → nx×ny, y → nx×nz, x → ny×nz"), "the in-plane frame words (the ortho slices' own frames)");
  ok(foldWindow.includes("at least one plane"), "the degenerate clamp speaks (from==to folds one plane)");
  ok(foldDoc.includes("OOM law"), "the volume cap's OOM law named at the fold's door");
  ok(mrc.includes("export async function renderMrcProjectionPng("), "the render is born");
  const rIdx = mrc.indexOf("export async function renderMrcProjectionPng(");
  const rWindow = mrc.slice(rIdx, rIdx + 900);
  ok(rWindow.includes("downsample(") && rWindow.includes("stretchToGray(") && rWindow.includes("grayToPng("), "the render rides the shared display truth (downsample → stretch → gray PNG)");
  ok(rWindow.includes("MAX_W"), "the render keeps the family's width cap");
}

console.log("B — the route's face (the verb)");
{
  ok(route.includes('renderMrcProjectionPng'), "the route imports the render");
  ok(route.includes('planeParam === "project"'), "the project plane parses");
  const stackIdx = route.indexOf('planeParam === "project" || axis !== "z"');
  ok(stackIdx > 0, "the volumes-only gate names projections beside obliques");
  const stackWindow = route.slice(stackIdx, stackIdx + 500);
  ok(stackWindow.includes("Projections are for 3D volumes — stacks browse images with slice/montage"), "the stack refusal keeps its family word");
  const projIdx = route.indexOf('if (planeParam === "project") {');
  const projWindow = route.slice(projIdx, projIdx + 700);
  ok(projWindow.includes('num(url.searchParams.get("from"), 0, 1, 0)'), "from defaults to the full extent's floor (0)");
  ok(projWindow.includes('num(url.searchParams.get("to"), 0, 1, 1)'), "to defaults to the full extent's ceiling (1)");
  ok(projWindow.includes('opRaw === "mean" || opRaw === "min" ? opRaw : "max"'), "an unknown op is a max (the standard)");
  ok(route.includes('|pf=${url.searchParams.get("from")}|pt=${url.searchParams.get("to")}|po=${url.searchParams.get("op")}'), "the pngKey carries pf/pt/po (a cache that forgets the slab lies)");
  ok(projWindow.includes("withHeavySlot") || route.slice(route.indexOf("pngKey"), projIdx).includes("withHeavySlot"), "the fold rides the heavy slot (the OOM doctrine's own door)");
  ok(projWindow.includes("renderMrcProjectionPng(abs, axis, from, to, op, undefined, win, polarity)"), "the fold inherits the request's window + polarity");
}

console.log("C — the client seat (the row's fold button)");
{
  const seatIdx = embed.indexOf('data-testid={`clip-project-${ax.toLowerCase()}`}');
  ok(seatIdx > 0, "the seat is born (the per-row testid)");
  const seatWindow = embed.slice(seatIdx - 2400, seatIdx + 1600);
  ok(seatWindow.includes("<Layers"), "the fold's own icon (Layers — NOT the loader beside it)");
  ok(seatWindow.includes("<Loader2"), "the busy face rides the row (the spinner while folding)");
  ok(seatWindow.includes("(max intensity) and the PNG downloads") === false && seatWindow.includes('projectOp === "max" ? "max intensity" : projectOp') && seatWindow.includes("and the PNG downloads"), "the title's promise rides the op (max intensity verbatim at the max default, the op's own word otherwise; the PNG promise stands)");
  ok(seatWindow.includes("through the full extent"), "the full-extent voice (an untouched row says so)");
  ok(seatWindow.includes("through the kept ${Math.round(lo * 100)}–${Math.round(hi * 100)}% slab"), "the kept-slab voice speaks its own percentages");
  ok(seatWindow.includes('aria-label={`Export the ${ax.toUpperCase()} projection as PNG`}'), "the family's aria word");
  ok(seatWindow.includes("disabled={projectBusy !== null}"), "the busy gate (one fold at a time)");
  ok(embed.includes('data-testid="clip-project-status"'), "the status mouth is born");
  const noteIdx = embed.indexOf('data-testid="clip-project-status"');
  const noteWindow = embed.slice(noteIdx - 300, noteIdx + 400);
  ok(noteWindow.includes('role="status"'), "the mouth speaks as a status (the live region family)");
  ok(noteWindow.includes("text-success") && noteWindow.includes("text-destructive"), "the saved/failed dress (the family's two words)");
  const fnIdx = embed.indexOf("map-project-");
  ok(fnIdx > 0, "the filename family (map-project-)");
  const fnWindow = embed.slice(fnIdx - 200, fnIdx + 200);
  ok(fnWindow.includes("Math.round(lo * 100)") && fnWindow.includes("Math.round(hi * 100)"), "the name carries the slab's own percentages");
  const handlerIdx = embed.indexOf("const exportProjection = async");
  const handlerWindow = embed.slice(handlerIdx, handlerIdx + 1400);
  ok(handlerWindow.includes("downloadBlob("), "the sink is the one blob door (t646)");
  ok(handlerWindow.includes('keptIntervalOf(clipStateRef.current, axisIdx)'), "the fold reads the row's own kept interval");
  ok(handlerWindow.includes("op=${projectOp}"), "the URL speaks the picker's own op (the state is the voice)");
  ok(handlerWindow.includes("-${projectOp}.png"), "the filename carries the op word (a mean figure never masquerades as a max)");
  ok(handlerWindow.includes('projectOp === "max" ? "max intensity" : projectOp'), "the status word keeps the max family verbatim and speaks the op otherwise");
  ok(handlerWindow.includes("setTimeout(() => setProjectNote(null), 4000)"), "the note flashes 4 s, then gone (the profile note's own dialect)");
}

console.log("D — the op picker (t1048, the server's union spoken in the block)");
{
  ok(embed.includes('data-testid="clip-project-ops"'), "the picker row is born");
  const opsIdx = embed.indexOf('data-testid="clip-project-ops"');
  const opsWindow = embed.slice(opsIdx, opsIdx + 1400);
  ok(opsWindow.includes("clip-project-op-${k}"), "the chip testids ride the union's key");
  ok(opsWindow.includes('k: "max"') && opsWindow.includes('k: "mean"') && opsWindow.includes('k: "min"'), "the three ops in the picker (max first — the standard keeps the first word)");
  ok(opsWindow.includes("the brightest voxel along every ray"), "max's teaching title (particles pop through depth)");
  ok(opsWindow.includes("the average density along every ray"), "mean's teaching title (the mass landscape)");
  ok(opsWindow.includes("the darkest voxel along every ray"), "min's teaching title (the floor)");
  ok(opsWindow.includes("aria-pressed={projectOp === k}"), "the chips speak the pressed contract (the σ-chips' own)");
  ok(opsWindow.includes("border-violet-700/60"), "the active chip wears the σ-chips' violet dress");
  ok(embed.includes('useState<"max" | "mean" | "min">("max")'), "the default is max (the cryo-EM standard keeps the first word)");
}

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
