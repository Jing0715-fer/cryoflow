#!/usr/bin/env node
// t982 — the MESSAGE-QUALITY FIFTH pass, first sub-option: the ARIA-REFUSAL
// census for STATE-DISABLED buttons.
//
// The first four passes judged the refusal TEXTS (server literals t961,
// client setters/toasts t962, the ISE dialect t960, the unit tripwires).
// This pass judges a different silence: a button that refuses by STATE
// (disabled={cond} computed from running/saving/loading) and whose
// accessible name never carries the reason. A "Save" button that goes
// dead while saving announces the same name it always had — the AT user
// receives a refusal with no message, the exact dishonesty the first
// four passes hunted in words, now hunted in NAMES.
//
// MECHANICAL CLASSIFICATION (static, honest about its limits):
//   every JSX opening tag carrying `disabled={` (state-derived — a
//   literal `disabled` or `disabled={true}` is a DESIGN decision, not a
//   state refusal, and is out of scope) is classified by:
//     - NAMING: aria-label={ / aria-labelledby= / title=  → STATEFUL
//               (the name CAN vary with the state);
//               aria-label="…" (constant)               → STATIC;
//               none of the above                       → TEXT-ONLY
//               (name = visible text, if any);
//     - DESCRIBED: aria-describedby present → the reason MAY ride a live
//               region (not judged a silence on its own);
//     - the disabled CONDITION's shape (boolean / comparison / call) is
//       recorded so cures can pick sites whose reason is already in scope.
//   VERDICTS: `stateful` (explained or explainer present — no cure),
//             `described` (deferred, noted), `silent-static` (icon-only
//             or labelled, name blind to state), `silent-text`
//             (name = text, state blind).
//
// The receipt ranks silences by file, so the targeted cures can pick the
// faces whose reason variable is already in the scope line.
//
// Usage: node scripts/t982-aria-refusal-census.mjs [--receipt path]
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = "/home/z/my-project/src/components";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".tsx")) files.push(p);
  }
})(ROOT);

// one JSX opening tag = from "<Tag" to the matching ">" — a cheap scanner
// that understands strings and braces one level deep (the codebase's tags
// rarely nest braces deeper than two; the scanner tracks depth honestly
// and bails a tag it cannot close within 2000 chars).
function* openingTags(src) {
  let i = 0;
  while ((i = src.indexOf("<", i)) !== -1) {
    // skip comments and closings
    if (src.startsWith("<!--", i)) { i = src.indexOf("-->", i) + 3 || src.length; continue; }
    if (src[i + 1] === "/") { i += 1; continue; }
    const tagM = /^<([A-Za-z][A-Za-z0-9._]*)/.exec(src.slice(i, i + 60));
    if (!tagM) { i += 1; continue; }
    const start = i;
    let j = i + tagM[0].length, depth = 0, done = false;
    while (j < src.length && j - start < 2000) {
      const c = src[j];
      if (c === '"' || c === "'" || c === "`") {
        const q = c; j++;
        while (j < src.length && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      } else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth <= 0) { done = true; break; }
      j++;
    }
    if (done) yield { tag: tagM[1], text: src.slice(start, j + 1), start, bodyStart: j + 1 };
    i = j + 1;
  }
}

/* the inner-content capture (the t983 upgrade): from the opening tag's
   end, walk to the matching close tag — same-name nesting counted, strings
   skipped, bounded. The census is a RANKER, not a compiler; a body it
   cannot close within the bound is recorded as such. */
function innerBody(src, from, tag) {
  const closeTag = "</" + tag;
  let k = from, opens = 0, end = -1;
  const bound = Math.min(src.length, from + 4000);
  while (k < bound) {
    const c = src[k];
    if (c === '"' || c === "'" || c === "`") {
      const q = c; k++;
      while (k < bound && src[k] !== q) { if (src[k] === "\\") k++; k++; }
    } else if (src.startsWith("<" + tag, k) && /[\s>/]/.test(src[k + tag.length + 1] ?? ">")) opens++;
    else if (src.startsWith(closeTag, k)) {
      if (opens === 0) { end = k; break; }
      opens--;
    }
    k++;
  }
  if (end === -1) return { inner: null, unclosed: true };
  return { inner: src.slice(from, end), unclosed: false };
}

/* the NAME-STORY classification for silent-text sites (the t983 law):
   does the visible TEXT change with the state? A text button whose
   children flip ("Re-compare" vs "Compare") already tells its story;
   a spinner-only flip tells it in PICTURES (aria-hidden) — the name
   stays blind; a site with NO text node at all is not blind but
   UNNAMED — the missing-name disease, heavier than the refusal one. */
function nameStory(inner) {
  if (inner == null) return "component";
  const noComments = inner.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
  const simpleFlip = /\?\s*["][^"]*["]\s*:\s*["][^"]*["]/.test(noComments);
  const textFlip = /\?\s*(["'`])[^"'`]*\1\s*:\s*(["'`])[^"'`]*\2/.test(noComments);
  if (simpleFlip || textFlip) return "flip";
  const braceGroups = noComments.match(/\{[^{}]*\}/g) ?? [];
  const dynamicText = braceGroups.some((g) =>
    /["'`][^"'`]*["'`]/.test(g) || />\s*[^<>{}]{2,}\s*</.test(g) ||
    /^\{\s*[A-Za-z_$][\w$.]*\s*\}$/.test(g));
  const textNodes = noComments
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (dynamicText) return "var";
  if (textNodes) return "blind";
  const spin = /animate-spin|Loader2/.test(noComments);
  return spin ? "spin-icon" : "unnamed";
}

const sites = [];
for (const f of files) {
  const rel = f.replace("/home/z/my-project/", "");
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  for (const { tag, text, start } of openingTags(src)) {
    if (!/\bdisabled=\{/.test(text)) continue;
    if (/\bdisabled=\{(true|false)\}/.test(text)) continue; // design, not state
    const line = src.slice(0, start).split("\n").length;
    const condM = /\bdisabled=\{([^{}]*)\}/.exec(text);
    const cond = (condM ? condM[1] : "").trim();
    const condKind = /[=!<>]==?|\.length|\.includes\(|\.some\(|\.every\(|\?/.test(cond)
      ? "comparison"
      : /\w+\(/.test(cond) ? "call" : "boolean";
    const stateful = /aria-label=\{|aria-labelledby=\{|title=\{/.test(text);
    const staticLabel = /aria-label="([^"]*)"/.exec(text);
    const described = /aria-describedby/.test(text);
    let verdict;
    if (stateful) verdict = "stateful";
    else if (described) verdict = "described";
    else if (staticLabel) verdict = "silent-static";
    else verdict = "silent-text";
    const { inner, unclosed } = verdict === "silent-text"
      ? innerBody(src, start + text.length, tag)
      : { inner: null, unclosed: false };
    const story = verdict === "silent-text" ? nameStory(inner) : null;
    sites.push({
      f: rel, line, tag, cond, condKind,
      condChars: cond.length,
      staticLabel: staticLabel ? staticLabel[1] : null,
      described, verdict, story,
      snippet: lines[line - 1]?.trim().slice(0, 160) ?? "",
    });
  }
}

const tally = { stateful: 0, described: 0, "silent-static": 0, "silent-text": 0 };
for (const s of sites) tally[s.verdict]++;
const silences = sites.filter((s) => s.verdict.startsWith("silent"));
const storyTally = {};
for (const s of silences) if (s.story) storyTally[s.story] = (storyTally[s.story] ?? 0) + 1;
const byFile = {};
for (const s of silences) (byFile[s.f] ??= []).push(s.line);

const receipt = {
  instrument: "t982-aria-refusal-census",
  born: "2026-10-14",
  scope: "src/components/**/*.tsx — tags with state-derived disabled={…}",
  storyScope: "the t983 upgrade — silent-text sites classified by their name-story (flip/spin/unnamed/blind/unbounded)",
  population: sites.length,
  tally,
  storyTally,
  silences: silences.length,
  byFile: Object.fromEntries(Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)),
  sites,
};
console.log(`population ${sites.length} state-disabled tags`);
console.log(`verdicts: stateful ${tally.stateful} · described ${tally.described} · silent-static ${tally["silent-static"]} · silent-text ${tally["silent-text"]}`);
const storyStr = Object.entries(storyTally).map(([k, v]) => `${k} ${v}`).join(" · ") || "n/a";
console.log(`name-stories (silent-text): ${storyStr}`);
console.log(`silences ${silences.length} across ${Object.keys(byFile).length} files`);
for (const s of silences.slice(0, 80)) {
  const st = s.story ? ` story=${s.story}` : "";
  console.log(`  ${s.verdict.padEnd(13)} ${s.f}:${s.line} <${s.tag}> cond(${s.condKind},${s.condChars})${st} ${s.staticLabel ? `label="${s.staticLabel}"` : ""}`);
}
const out = process.argv.includes("--receipt")
  ? process.argv[process.argv.indexOf("--receipt") + 1]
  : "/home/z/my-project/shots-qa/t982-aria-refusal-census.json";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${out}`);
