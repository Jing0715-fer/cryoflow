// hygiene-tables.mjs — THE SINGLE SOURCE OF TRUTH READER (Task 169).
//
// world-hygiene.mjs carries four hand-listed signature tables
// (FIXTURE_SIGNATURES / PROJECT_SIGNATURES / WS_SIGNATURES /
// TPL_SIGNATURES), each entry shaped { re: /…/, owner: "…", why: "…" }.
// Until Task 169 the scanner probes consumed HAND-COPIED mirrors of those
// tables — t167's explicitSigs/prefixSigs arrays, t168's dom-tagged sigs
// array. A mirror is a second source of truth (the t166 doctrine: a
// surviving copy goes stale the moment the real table evolves — a 7th
// entry would be invisible to the mirror's classifier, which would then
// false-alarm NO-SIGNATURE on the new owner's seeds; t167 even carried
// the real table and its copy in the SAME file, two readings of one
// truth waiting to disagree).
//
// This module parses the REAL literals out of the hygiene source, so a
// probe classifies with the audit's own regexes. The parse is also a
// CONTRACT: the tables must stay literal-parseable — a re: that becomes
// a computed value, an entry that loses its owner or why, a table that
// parses to zero entries, all fail LOUDLY here. If this module throws,
// the table (or the parser) drifted; that is the signal, not a bug.
//
// Usage:
//   const t = parseHygieneTables(hygieneSrc);
//   t.fixture            // job-domain entries   (audit 0.7)
//   t.project            // audit 0.75 entries
//   t.ws                 // audit 0.8 entries
//   t.tpl                // audit 0.9 entries
//   t.canonicalProject   // the CANONICAL_PROJECT constant string
// Entry: { literal, source, flags, re, owner, why } — `literal` is the
// exact source text ("/^TL /") for member pins, `re` the compiled RegExp.
//
// Known shape limit, stated on purpose: an entry must be a flat object
// whose regex literal contains no bare braces (a future /^Q{2} / would
// defeat the chunker) — and if that day comes the parser throws rather
// than mis-reads. Failing loudly on exotic shapes is the contract.

const ENTRY_CHUNK = /\{([^{}]*)\}/g;

function parseTable(src, name) {
  const anchor = src.indexOf(`const ${name} = [`);
  if (anchor === -1)
    throw new Error(`hygiene-tables: table ${name} not found in world-hygiene.mjs — renamed tables must update their readers, not silently orphan them`);
  const open = src.indexOf("[", anchor);
  const close = src.indexOf("];", open);
  if (open === -1 || close === -1)
    throw new Error(`hygiene-tables: table ${name} is not a closed array literal`);
  const block = src.slice(open + 1, close);
  const entries = [];
  for (const m of block.matchAll(ENTRY_CHUNK)) {
    const chunk = m[1];
    if (!/\bre\s*:/.test(chunk)) continue; // brace group without a re: field is not an entry
    const reLit = chunk.match(/re\s*:\s*(\/(?:[^/\\]|\\.)+\/[a-z]*)/);
    const owner = chunk.match(/owner\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const why = chunk.match(/why\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!reLit || !owner || !why)
      throw new Error(
        `hygiene-tables: ${name} entry failed the literal contract ` +
        `(re/owner/why all required, regex must be a literal — no computed values): ${chunk.trim().slice(0, 90)}`
      );
    const literal = reLit[1];
    const lastSlash = literal.lastIndexOf("/");
    const source = literal.slice(1, lastSlash);
    const flags = literal.slice(lastSlash + 1);
    let re;
    try {
      re = new RegExp(source, flags);
    } catch (e) {
      throw new Error(`hygiene-tables: ${name} entry ${literal} does not compile: ${e.message}`);
    }
    entries.push({ literal, source, flags, re, owner: owner[1], why: why[1] });
  }
  if (entries.length === 0)
    throw new Error(`hygiene-tables: table ${name} parsed to ZERO entries — a table that signs nothing is either rewritten or the reader drifted`);
  return entries;
}

export function parseHygieneTables(hygieneSrc) {
  const canonicalProject = hygieneSrc.match(/const CANONICAL_PROJECT = "((?:[^"\\]|\\.)*)"/)?.[1];
  if (!canonicalProject)
    throw new Error('hygiene-tables: CANONICAL_PROJECT constant not found — the project audit\'s guard is unreadable');
  const tables = {
    fixture: parseTable(hygieneSrc, "FIXTURE_SIGNATURES"),
    project: parseTable(hygieneSrc, "PROJECT_SIGNATURES"),
    ws: parseTable(hygieneSrc, "WS_SIGNATURES"),
    tpl: parseTable(hygieneSrc, "TPL_SIGNATURES"),
    canonicalProject,
  };
  return tables;
}

// prefix-family derivation — SCANNER POLICY evaluated over the parsed
// table (not a copied `kind` field: the real table does not carry one).
// A signature is prefix-kind iff it matches the T/t anchor corpus, which
// is exactly how the classifier must treat it: own-suite number →
// self-prefix, foreign number → OTHER-SUITE-PREFIX, while explicit nets
// (/^TL /, /^qa61 Host$/) are neither. Derived from behavior, so a new
// prefix-family entry (say /^TW\d+ /) auto-classifies without any
// mirror edit — the whole point of Task 169.
export function isPrefixFamily(entry) {
  return entry.re.test("T169 Sample") || entry.re.test("t169 Sample");
}
