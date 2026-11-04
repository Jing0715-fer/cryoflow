/**
 * t1123 — the JSX opening-tag scanner (shared by the per-button auditor
 * and its curer sibling).
 *
 * Two lessons this scanner encodes, both caught live in this window:
 *   1. NESTED TEMPLATE LITERALS — footer's census chip title carries a
 *      nested backtick inside a `${...}` interpolation; a naive
 *      "skip to the next backtick" ends at the nested one's OPENING
 *      backtick and every brace after it miscounts (db went -1, the body
 *      ran to end-of-file).
 *   2. APOSTROPHES IN COMMENTS — canvas-minimap's onClick carries a
 *      `// the click's own voice` comment; without comment awareness the
 *      apostrophe opens a phantom string and the scanner derails.
 *
 * The scanner therefore walks a tag body with: string states, a
 * template-literal state that understands `${...}` interpolations
 * (recursively), line/block comments (valid inside brace contexts and
 * interpolations), brace/paren/bracket contexts, and the `=>` arrow
 * whose `>` never closes a JSX tag.
 */

/** skip a '…' or "…" string; text[i] is the opening quote; returns the
 *  index just past the closing quote (or end of text). */
export function skipStr(text, i, quote) {
  let j = i + 1;
  const n = text.length;
  while (j < n) {
    const c = text[j];
    if (c === "\\") { j += 2; continue; }
    if (c === quote) return j + 1;
    j += 1;
  }
  return n;
}

/** skip a `…` template literal, understanding ${...} interpolations
 *  (recursively — a nested template inside an interpolation is itself
 *  skipped by skipTpl). Returns the index just past the closing tick. */
export function skipTpl(text, i) {
  let j = i + 1;
  const n = text.length;
  while (j < n) {
    const c = text[j];
    if (c === "\\") { j += 2; continue; }
    if (c === "`") return j + 1;
    if (c === "$" && text[j + 1] === "{") {
      j += 2;
      let depth = 1;
      while (j < n && depth > 0) {
        const d = text[j];
        if (d === "\\") { j += 2; continue; }
        if (d === '"' || d === "'") { j = skipStr(text, j, d); continue; }
        if (d === "`") { j = skipTpl(text, j); continue; }
        if (d === "/" && text[j + 1] === "/") { while (j < n && text[j] !== "\n") j += 1; continue; }
        if (d === "/" && text[j + 1] === "*") { j += 2; while (j < n && !(text[j] === "*" && text[j + 1] === "/")) j += 1; j += 2; continue; }
        if (d === "{") { depth += 1; j += 1; continue; }
        if (d === "}") { depth -= 1; j += 1; continue; }
        j += 1;
      }
      continue;
    }
    j += 1;
  }
  return n;
}

/** given text and the index of a '<' that opens a JSX element, return
 *  the index of the tag-body-terminating '>' (or -1 at end of text).
 *  Only a '>' outside every brace/paren/bracket/string/template closes
 *  the tag; '=>' is skipped explicitly. */
export function tagEndIndex(text, i) {
  const n = text.length;
  let j = i + 1; // past '<'
  const stack = [];
  while (j < n) {
    const c = text[j];
    const c2 = text[j + 1];
    // comments are skipped at ANY depth — a `//` prose comment may mention
    // `<button` or carry an apostrophe; both derailed the scanner
    if (c === "/" && c2 === "/") { while (j < n && text[j] !== "\n") j += 1; continue; }
    if (c === "/" && c2 === "*") {
      j += 2;
      while (j < n && !(text[j] === "*" && text[j + 1] === "/")) j += 1;
      j += 2;
      continue;
    }
    if (c === '"' || c === "'") { j = skipStr(text, j, c); continue; }
    if (c === "`") { j = skipTpl(text, j); continue; }
    if (c === "{" || c === "(" || c === "[") { stack.push(c); j += 1; continue; }
    if (c === "}" || c === ")" || c === "]") {
      if (stack.length > 0) stack.pop();
      j += 1;
      continue;
    }
    if (c === ">" && stack.length === 0) {
      if (j > i && text[j - 1] === "=") { j += 1; continue; } // the arrow's '>'
      return j;
    }
    j += 1;
  }
  return -1;
}

/** the full opening-tag text of the JSX element opening at index i. */
export function tagBody(text, i) {
  const end = tagEndIndex(text, i);
  return end === -1 ? text.slice(i, i + 2000) : text.slice(i, end);
}

/** the className expression of a tag body: the raw source between the
 *  delimiters ('…' contents, or {…} contents), or "" when absent. */
export function classNameOf(body) {
  const m = /className\s*=\s*(\{|\")/.exec(body);
  if (!m) return "";
  const start = m.index + m[0].length - 1;
  if (body[start] === '"') return skipStr(body, start, '"') - start - 2 >= 0 ? body.slice(start + 1, skipStr(body, start, '"') - 1) : "";
  // brace-balanced via the scanner
  const end = tagEndIndex(body, start + 1); // reuse: finds the '}' boundary as tag end… not exactly.
  // simpler: balance braces with the scanner's string awareness
  let j = start + 1;
  let depth = 0;
  while (j < body.length) {
    const c = body[j];
    if (c === '"' || c === "'") { j = skipStr(body, j, c); continue; }
    if (c === "`") { j = skipTpl(body, j); continue; }
    if (c === "{") { depth += 1; j += 1; continue; }
    if (c === "}") { depth -= 1; j += 1; if (depth === 0) return body.slice(start + 1, j - 1); continue; }
    j += 1;
  }
  return body.slice(start + 1);
}
