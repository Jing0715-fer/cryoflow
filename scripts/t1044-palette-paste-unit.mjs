#!/usr/bin/env node
/**
 * t1044-palette-paste-unit — the paste door: a shared link lands from
 * inside the palette.
 *
 * The seat: t822 gave the app the pose-in-URL link and ONE door for it —
 * the landing (/?view=…), which stages PENDING_SHARE_KEY and drives
 * openJob; t1042 made the link carry the row's memory. But a colleague's
 * link pasted MID-SESSION (the app already open, no reload intended)
 * had no door: the user had to open a new tab or reload to consume it.
 * This window the command palette grows the paste face: one row whose
 * select tries the clipboard FIRST (the one-press paste), falls back to
 * the rename face's inline-input discipline, and lands the share through
 * the LANDING's own handshake — the same key, the same drive, the same
 * toasts, so the viewer's consume block only ever sees what the ?view=
 * landing would have staged (zero new restore logic; the guest law
 * holds: the paste births no row, the viewer's Save click does).
 *
 * Bands:
 *   A — the extraction half (the REAL lib, real bytes): a full URL, a
 *       bare query fragment and the bare payload all yield the same
 *       candidate; an empty paste is the honest null; extraction never
 *       judges the shape (the decode door owns the verdict).
 *   B — the palette's face (source pins on command-palette.tsx): the
 *       row's testid + keyboard value, the clipboard-first mouth, the
 *       input fallback with the rename discipline (stopPropagation,
 *       Enter the ONE commit path, Escape the cancel flag, blur the
 *       commit), the staging key, the drive with the boot-race retries,
 *       the landing's own toast words, and the guest law's negative pin
 *       (no camera-bookmarks write in the paste path).
 *   C — the full round-trip on the REAL encode expression: encode →
 *       wrap in a URL → extract → decode — the payload survives the
 *       whole paste chain, a padded src arrives trimmed, a src-less
 *       payload stays absent, and a malformed candidate bounces null.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { encodeSharePayload, decodeSharePayload, extractSharePayload } from "@/lib/view-link";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
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

console.log("A — the extraction half (the REAL lib, real bytes)");
{
  const payload = encodeSharePayload({
    jobId: "job-1",
    name: "t1044 paste ride",
    snapshot: { mode: "fullmap" },
    src: "  Initial Model (tutorial)  ",
  });

  // the three paste shapes, one mouth
  const full = `https://cryoflow.example.com/?view=${payload}&x=1`;
  const frag = `?view=${payload}`;
  ok(extractSharePayload(full) === payload, "a full URL yields the param verbatim");
  ok(extractSharePayload(frag) === payload, "a bare query fragment yields the param verbatim");
  ok(extractSharePayload(payload) === payload, "the bare payload passes through as-is");
  ok(extractSharePayload(`  ${payload}  `) === payload, "surrounding whitespace trims away");

  // the honest nothing face
  ok(extractSharePayload("") === null, "an empty paste is null (nothing to hand the door)");
  ok(extractSharePayload("   ") === null, "a whitespace paste is null");
  // @ts-expect-error — the lib is typed string; the runtime law is honest-null
  ok(extractSharePayload(undefined) === null, "an undefined paste never throws — null");

  // extraction never judges: a garbage candidate passes THROUGH (the decode door nulls it)
  const junk = extractSharePayload("not a link at all");
  ok(junk === "not a link at all", "a non-link paste passes through (the bouncer owns the verdict)");
  ok(decodeSharePayload(junk) === null, "the decode door bounces the junk honestly");
}

console.log("B — the palette's face");
{
  // the row is born, with its keyboard value and testid
  ok(palette.includes('data-testid="palette-paste-share"'), "the paste row is born (the testid)");
  ok(palette.includes('value="paste shared view link clipboard colleague fly"'), "the row's keyboard value carries the paste vocabulary");
  ok(palette.includes('heading="Shared view link"'), "the group's heading speaks the face");

  // the two mouths
  ok(palette.includes("if (navigator.clipboard?.readText) {"), "the clipboard-first mouth (the one-press paste, the API's presence checked honestly)");
  ok(palette.includes('data-testid="palette-paste-input"'), "the input fallback is born (the second mouth)");
  ok(palette.includes("setPasteOpen(true)"), "the undecodable clipboard grows the input (the honest fallback)");

  // t1046 — the unreadable clipboard's honest bounce: the permission
  // bounce and the absent API raise the flag; the toast speaks the
  // family dialect; the empty clipboard stays silent (the placeholder
  // speaks); the field still grows after the bounce (the recovery path
  // stands). Order pins: one-press first, bounce second, grow last.
  ok(palette.includes("let unreadable = false;"), "the unreadable flag is born (the bounce's own state)");
  ok(/} catch \{\s*\n\s*text = null;[^\n]*\n\s*unreadable = true;/m.test(palette), "the permission bounce raises the flag (the denied read speaks)");
  ok(palette.includes("unreadable = true; // no clipboard to ask"), "the absent API raises the flag too (the insecure context's own face)");
  {
    const bounceIdx = palette.indexOf('title: "Could not reach the clipboard"');
    const pressIdx = palette.indexOf("the one-press paste: the clipboard already holds a decodable share");
    const growIdx = palette.indexOf('setPasteDraft(text?.trim() ?? "")');
    ok(bounceIdx > 0, "the bounce toast is born (the family title verbatim — the share face's own words)");
    ok(pressIdx > 0 && bounceIdx > pressIdx, "the bounce sits AFTER the one-press return (one-press first, bounce second)");
    ok(growIdx > bounceIdx, "the grow stands after the bounce (the recovery path's order)");
    ok(palette.slice(bounceIdx - 80, bounceIdx).includes("if (unreadable) {"), "the toast gates on the flag alone (the empty clipboard keeps its silence — the placeholder speaks)");
    ok(palette.includes('description: "The browser denied clipboard access — paste the link into the field instead."'), "the description names the recovery path (the field)");
  }

  // the rename discipline on the input
  const inputIdx = palette.indexOf('data-testid="palette-paste-input"');
  const inputWindow = palette.slice(inputIdx, inputIdx + 1800);
  ok(inputWindow.includes("e.stopPropagation()"), "the input stops cmdk's key propagation (the rename face's law)");
  ok(inputWindow.includes("e.currentTarget.blur(); // the ONE commit path"), "Enter is the ONE commit path (blur commits — the rename face's law)");
  ok(inputWindow.includes("pasteCancelRef.current = true"), "Escape raises the cancel flag (the rename face's law)");
  ok(inputWindow.includes('aria-label="Paste a shared view link"'), "the input speaks its aria-label first (the t1038 F3 law)");

  // the landing handshake — the SAME key, drive, and words
  ok(palette.includes("sessionStorage.setItem(PENDING_SHARE_KEY, raw)"), "the paste stages the LANDING's own key (zero new restore logic)");
  ok(/for \(let attempt = 0; attempt < 3; attempt \+= 1\)/.test(palette), "the drive retries the boot race (the landing's own shape)");
  ok(palette.includes('title: "Shared view landed"'), "the landing's own toast speaks the arrival");
  ok(palette.includes("(from “${share.src}”)"), "the lineage tail rides the landed toast (the t1042 voice)");
  ok(palette.includes('title: "This shared link could not be read"'), "the malformed link bounces with the landing's own words");
  ok(palette.includes('title: "Shared view could not land"'), "the unreachable job speaks the honest could-not-land");
  ok(palette.includes("sessionStorage.removeItem(PENDING_SHARE_KEY)"), "the could-not-land exit unstages (nothing staged is nothing owed)");

  // the guest law — the paste path writes NO bookmark row (the window
  // ends where the delete face begins — ITS route is the delete's own)
  const pasteIdx = palette.indexOf("// t1044 — the paste door");
  const pasteWindow = palette.slice(pasteIdx, palette.indexOf("// t670 — the palette row gets the wall's delete face"));
  ok(!pasteWindow.includes("camera-bookmarks"), "the paste path touches no bookmark route (the guest law's negative pin)");
  ok(palette.includes("close === undefined") === false && palette.includes("const close = () =>"), "the palette's close stands (the face rides the existing door)");
}

console.log("C — the full round-trip on the REAL encode expression");
{
  // a padded memory rides the URL and arrives TRIMMED through the whole paste chain
  const padded = encodeSharePayload({
    jobId: "cmv8ogdv2000usy89pd12v096",
    projectId: "cmv8nhqxo0000sy8934xli45t",
    name: "t1044 paste ride",
    snapshot: { mode: "fullmap", fov: 0.876, position: [0, 0, 2.2], up: [0, 1, 0], target: [0, 0, 0] },
    view: { sigma: 2, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
    src: "  Initial Model (tutorial)  ",
  });
  const link = `http://localhost:3000/?view=${padded}`;
  const share = decodeSharePayload(extractSharePayload(link) ?? "");
  ok(share !== null, "the whole chain decodes (encode → URL → extract → decode)");
  ok(share?.src === "Initial Model (tutorial)", "the padded memory arrives TRIMMED at the paste door (the J1 law's face)");
  ok(share?.name === "t1044 paste ride", "the name survives the chain verbatim");
  ok(share?.projectId === "cmv8nhqxo0000sy8934xli45t", "the project hint rides for the cross-project drive");

  // a src-less payload stays absent (the honest no-chip face)
  const bare = encodeSharePayload({ jobId: "job-2", name: "fresh pose", snapshot: {} });
  const bareShare = decodeSharePayload(extractSharePayload(`?view=${bare}`) ?? "");
  ok(bareShare !== null && bareShare.src === undefined, "a pose fresh off the canvas carries no memory (the absent face)");

  // a truncated paste bounces null (never a half-applied pose)
  ok(decodeSharePayload(extractSharePayload(`?view=${padded.slice(0, 40)}`) ?? "") === null, "a truncated paste bounces null (the bouncer's law)");
}

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
