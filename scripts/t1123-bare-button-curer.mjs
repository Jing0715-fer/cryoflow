#!/usr/bin/env node
/**
 * t1123 — the bare-button curer: the per-button auditor's surgical arm.
 *
 * For every raw <button> whose className does not already speak
 * `focus-visible`, this script inserts the family mint
 *   focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring
 * with per-shape tactics:
 *
 *   className="literal…"            → insert before the closing quote
 *   className={cn(…)}               → leading string arg right after `cn(`
 *   className={cn( // comment…)}    → leading string arg before the comment
 *   className={`…${expr}…`}         → static text right after the backtick
 *   className={["a","b"].join(" ")} → leading element right after `[`
 *   className={SOME_VAR}            → cure at the variable's definition in
 *                                     the same file (when that value is a
 *                                     literal/template without the mint)
 *   anything else                   → named MANUAL, untouched
 *
 * Laws: idempotent (a ridden tag is skipped), edits within one file are
 * applied last-to-first so offsets never shift, and the script prints a
 * full ledger of every seat it touched. Pure text surgery on as-written
 * bytes — no prettier, no reformats.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tagBody, classNameOf, skipStr, skipTpl } from "./t1123-jsx-scan.mjs";

const ROOT = process.cwd();
const MINT = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = [...walk(join(ROOT, "src/components")), ...walk(join(ROOT, "src/app"))];
const touched = new Map(); // file -> count
const manual = [];

for (const f of files) {
  let text = readFileSync(f, "utf8");

  const edits = []; // {pos, len, replacement}
  let idx = text.indexOf("<button");
  while (idx !== -1) {
    const before = text.slice(Math.max(0, idx - 2), idx);
    if (!before.endsWith("/")) {
      // prose guard: a zero-attribute `<button>` is a comment mention —
      // skip (the t1123-depollute-comments lesson)
      if (/^<button\s*>/.test(text.slice(idx, idx + 12))) {
        idx = text.indexOf("<button", idx + 1);
        continue;
      }
      const body = tagBody(text, idx);
      const cls = classNameOf(body);
      if (!cls.includes("focus-visible")) {
        const lineNo = text.slice(0, idx).split("\n").length;
        // Chip-interactive rider: the ring lives in ui/chip.tsx's mint —
        // the nearest unclosed <Chip above the button must speak
        // interactive + asChild
        const lastOpen = text.lastIndexOf("<Chip", idx - 1);
        const lastClose = text.lastIndexOf("</Chip", idx - 1);
        const between = lastOpen > lastClose && lastOpen !== -1 ? text.slice(lastOpen, idx) : "";
        const chipRider = between.includes("asChild") && between.includes("interactive");
        if (chipRider) {
          idx = text.indexOf("<button", idx + 1);
          continue;
        }
        const rel = /className\s*=\s*(\{|\")/.exec(body);
        if (rel) {
          const clsStartAbs = idx + rel.index + rel[0].length - 1; // index of `{` or `"`
          const plan = planEdit(text, clsStartAbs, f, idx);
          if (plan) {
            if (plan.skip) { idx = text.indexOf("<button", idx + 1); continue; }
            edits.push(plan);
          } else {
            // exotic expression (bare ternary, variable, call) — wrap the
            // whole expression in a template that leads with the mint
            const exprEnd = exprCloseIndex(text, clsStartAbs);
            if (exprEnd !== -1) {
              edits.push({
                pos: clsStartAbs + 1,
                len: 0,
                replacement: "`" + MINT + " ${",
                wrapClose: true,
                wrapClosePos: exprEnd,
                loc: `${f.replace(ROOT + "/", "")}:${lineNo}`,
              });
            } else {
              manual.push(`${f.replace(ROOT + "/", "")}:${lineNo} — className expression could not be bounded`);
            }
          }
        } else {
          // a raw <button> with no className at all: give it one that
          // carries only the mint (visually inert until focus)
          edits.push({
            pos: idx + "<button".length,
            len: 0,
            replacement: ` className="${MINT}"`,
            loc: `${f.replace(ROOT + "/", "")}:${lineNo}`,
          });
        }
      }
    }
    idx = text.indexOf("<button", idx + 1);
  }

  if (edits.length === 0) continue;
  // wrap-closures are positions measured on the ORIGINAL text; apply all
  // edits last-position-first (wrap closes sit after their open in
  // source, so sorting by pos descending still lands them correctly —
  // the close insertion goes AFTER the open insertion offset-free)
  const ops = [];
  for (const e of edits) {
    ops.push({ pos: e.pos, len: e.len ?? 0, text: e.replacement });
    if (e.wrapClose) {
      ops.push({ pos: e.wrapClosePos, len: 0, text: "}`" });
    }
  }
  ops.sort((a, b) => b.pos - a.pos);
  for (const o of ops) {
    text = text.slice(0, o.pos) + o.text + text.slice(o.pos + o.len);
  }
  writeFileSync(f, text);
  touched.set(f, edits.length);
}

/** the index of the `}` that closes the brace expression opening at
 *  openBrace — scanner-aware (strings, templates, comments). */
function exprCloseIndex(text, openBrace) {
  let j = openBrace + 1;
  let depth = 1;
  while (j < text.length) {
    const c = text[j];
    if (c === '"' || c === "'") { j = skipStr(text, j, c); continue; }
    if (c === "`") { j = skipTpl(text, j); continue; }
    if (c === "/" && text[j + 1] === "/") { while (j < text.length && text[j] !== "\n") j += 1; continue; }
    if (c === "/" && text[j + 1] === "*") { j += 2; while (j < text.length && !(text[j] === "*" && text[j + 1] === "/")) j += 1; j += 2; continue; }
    if (c === "{") { depth += 1; j += 1; continue; }
    if (c === "}") { depth -= 1; j += 1; if (depth === 0) return j - 1; continue; }
    j += 1;
  }
  return -1;
}

/** build an insertion plan for the className attribute whose opening
 *  delimiter (a `{` or `"`) sits at clsStartAbs. */
function planEdit(text, clsStartAbs, file, tagIdx) {
  const line = text.slice(0, tagIdx).split("\n").length;
  const loc = `${file.replace(ROOT + "/", "")}:${line}`;
  if (text[clsStartAbs] === `"`) {
    // plain string attribute: insert before the closing quote
    const close = skipStr(text, clsStartAbs, `"`);
    return { pos: close - 1, len: 0, replacement: ` ${MINT}`, loc };
  }
  // brace expression — find the first non-space char after `{`
  let j = clsStartAbs + 1;
  while (j < text.length && /\s/.test(text[j])) j += 1;
  const c = text[j];
  if (c === `"`) {
    // className={"literal"} — insert before closing quote
    const close = skipStr(text, j, `"`);
    return { pos: close - 1, len: 0, replacement: ` ${MINT}`, loc };
  }
  if (c === "`") {
    return { pos: j + 1, len: 0, replacement: `${MINT} `, loc };
  }
  if (c === "[") {
    return { pos: j + 1, len: 0, replacement: `"${MINT}", `, loc };
  }
  // cn(…) — leading string argument
  if (text.startsWith("cn(", j)) {
    const afterParen = j + 3;
    return { pos: afterParen, len: 0, replacement: `\n  "${MINT}",`, loc };
  }
  // identifier (a shared variable) — cure at its definition
  const idm = /^[A-Za-z_$][\w$]*/.exec(text.slice(j));
  if (idm) {
    const name = idm[0];
    return cureDefinition(text, name, loc, tagIdx);
  }
  return null;
}

/** find `const NAME =` / `let NAME =` / `NAME =` in the same file and
 *  inject the mint into its literal/template value. */
function cureDefinition(text, name, loc, tagIdx) {
  const defRe = new RegExp(`(const|let|var)\\s+${name}\\s*=\\s*`, "g");
  let m;
  while ((m = defRe.exec(text)) !== null) {
    const vStart = m.index + m[0].length;
    const vChar = text[vStart];
    if (vChar === `"`) {
      const close = skipStr(text, vStart, `"`);
      const value = text.slice(vStart, close);
      if (value.includes("focus-visible")) return { skip: true, loc };
      return { pos: close - 1, len: 0, replacement: ` ${MINT}`, loc };
    }
    if (vChar === "`") {
      const close = skipTpl(text, vStart);
      const value = text.slice(vStart, close);
      if (value.includes("focus-visible")) return { skip: true, loc };
      // static head right after the opening tick
      return { pos: vStart + 1, len: 0, replacement: `${MINT} `, loc };
    }
  }
  return null;
}

let totalCured = 0;
for (const [f, n] of touched) {
  console.log(`CURED ${n} — ${f.replace(ROOT + "/", "")}`);
  totalCured += n;
}
console.log(`\ncured ${totalCured} seats across ${touched.size} files`);
if (manual.length > 0) {
  console.log(`\n${manual.length} MANUAL seats:`);
  for (const m of manual) console.log(`  MANUAL ${m}`);
}
