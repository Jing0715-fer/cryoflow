/**
 * CryoFlow — the session report's portable echo (t237): the md document
 * rendered as ONE self-contained HTML file.
 *
 * The session report already speaks three media: the screen (the dialog's
 * ReactMarkdown render, with the live compass t234 built), the paper (the
 * print contract t70 owns) and the raw bytes (md copy/download + the CSV
 * annex). The md download is INERT, though — a colleague who receives
 * `session-qc-report-….md` gets bare text with no styling, no contents,
 * no structure, and needs tooling to read it well. This lib adds the
 * missing medium: a standalone HTML document that opens in any browser
 * and reads like the report reads in-app — styled tables, a contents
 * page, print-ready — with NO app, NO network and NO script.
 *
 * The doctrine it obeys:
 *  - ONE WELL (t230/t234): the export parses the SAME md bytes the
 *    screen renders. Nothing here re-authors a word; `reportTocOf` —
 *    the exact parser the live compass drinks from — moved here so the
 *    dialog and the export drink the same well from the same cup.
 *  - INDEX PAIRING, ZERO INJECTION (t234): the TOC's `#s<N>` hrefs and
 *    the body's `id="s<N>"` are minted from the SAME index over the
 *    SAME heading sequence — one pass over one filter; no slug, no
 *    lookup table that could drift.
 *  - A DOCUMENT, NOT AN APP: zero <script>, zero external resources
 *    (no <link>, no @import, no http src). What works without JS must
 *    be all that is needed — anchors and styles.
 *  - NO TIMESTAMPS IN THE BYTES (t195): the same session state yields
 *    the same HTML; the filename carries the stamp.
 *  - THE EXPORTED BYTES KEEP THE NUMBERS (t213's own law for exports):
 *    the page's lenses (hero landscape, spark portraits, doors that
 *    open job results) are screen organs of the app; the echo carries
 *    the document itself and lets the reader judge.
 *
 * The converter speaks the report's CLOSED md subset — exactly what the
 * three families (buildSessionReport / buildProfileReport verbatim /
 * buildSweepReport verbatim) can emit: h1/h2/h3, one-line paragraphs,
 * single-level `-` bullets, GFM pipe tables with alignment rows, `>`
 * blockquotes, full-line `_emphasis_` paragraphs, inline `**bold**` and
 * `` `code` ``, and mdCell's `\|` escapes. Anything else falls through
 * as honestly-escaped text — the echo never guesses.
 */

/** The TOC parse — moved VERBATIM from session-report-dialog (t234):
 *  h2/h3 ATX lines only (h1 is the document's own name, not a
 *  destination), label cleaned of mdCell escapes / bold / code. */
export interface ReportTocItem {
  level: 2 | 3;
  text: string;
}

export const reportTocOf = (md: string): ReportTocItem[] =>
  md
    .split("\n")
    .filter((line) => /^#{2,3} \S/.test(line))
    .map((line) => ({
      level: line.startsWith("### ") ? 3 : 2,
      text: line
        .replace(/^#{2,3} /, "")
        .replace(/\\\|/g, "|")
        .replace(/\*\*/g, "")
        .replace(/`/g, "")
        .trim(),
    }));

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline voice for the closed subset: code spans first (protected from
 *  the bold scan), then bold, then full-line emphasis is the caller's
 *  paragraph-level concern. Input arrives RAW (unescaped) — we escape
 *  the prose around the markers so nothing forges markup. */
const inlineHtml = (raw: string): string => {
  // split on code spans first — their content must not grow markup
  const parts = raw.split(/(`[^`]+`)/g);
  return parts
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return `<code>${esc(part.slice(1, -1))}</code>`;
      }
      // bold + mdCell's escaped pipes — the closed subset never nests
      // bold inside code or vice versa; `\|` is prose for a literal pipe.
      // Bold consumes its pairs first, then single `*` pairs speak
      // emphasis (the sweep's empty state says *Compare profiles*).
      return esc(part)
        .replace(/\\\|/g, "|")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>");
    })
    .join("");
};

/** A table row's cells: split on UNESCAPED pipes, unescape `\|` after —
 *  the mdCell law in reverse (the well escapes pipes so cells survive
 *  the round trip; the echo splits on the real ones only). One leading
 *  and one trailing `|` are the row's FENCE, not cell boundaries —
 *  `| a | b |` is two cells, and a fence-less `a | b` speaks the same. */
const splitCells = (line: string): string[] => {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "\\" && row[i + 1] === "|") {
      cur += "\u0001"; // escaped-pipe token, restored after the split
      i++;
    } else if (row[i] === "|") {
      cells.push(cur);
      cur = "";
    } else {
      cur += row[i];
    }
  }
  cells.push(cur);
  return cells.map((c) => c.replace(/\u0001/g, "|").trim());
};

/** Alignment row (`| :-- | --: |` → left/right per column). */
const alignsOf = (sepLine: string): ("left" | "right" | null)[] =>
  splitCells(sepLine).map((c) => {
    const t = c.replace(/-/g, "");
    if (t === "::") return null;
    if (t.endsWith(":")) return "right";
    if (t.startsWith(":")) return "left";
    return null;
  });

const alignClass = (a: "left" | "right" | null): string =>
  a === "right" ? ' class="r"' : a === "left" ? ' class="l"' : "";

/** One table: head line + separator + body rows → <table>. The heading
 *  id counter is NOT touched — tables never mint headings. */
const tableHtml = (lines: string[], start: number): { html: string; next: number } => {
  const head = splitCells(lines[start]);
  const aligns = start + 1 < lines.length ? alignsOf(lines[start + 1]) : head.map(() => null);
  let next = start + 2;
  const rows: string[][] = [];
  while (next < lines.length && lines[next].startsWith("|")) {
    rows.push(splitCells(lines[next]));
    next++;
  }
  const th = head.map((c, i) => `<th${alignClass(aligns[i])}>${inlineHtml(c)}</th>`).join("");
  const tb = rows
    .map(
      (r) =>
        "<tr>" +
        head.map((_, i) => `<td${alignClass(aligns[i])}>${inlineHtml(r[i] ?? "")}</td>`).join("") +
        "</tr>",
    )
    .join("");
  return {
    html: `<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`,
    next,
  };
};

/** The document's own CSS — self-contained, paper-first (the export is
 *  a document: light background always), system fonts, the violet
 *  accent family the report already wears in-app. The contents page is
 *  BORN into the document (an organ of the echo itself, not a screen
 *  overlay), so unlike the app's compass (t234's `.no-print`) it
 *  prints — a multi-section document on paper deserves its map. */
const DOC_CSS = `
:root { --ink:#18181b; --mut:#52525b; --line:#e4e4e7; --vio:#7c3aed; --vio-soft:#f5f3ff; --bg:#ffffff; --chip:#fafafa; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink);
  font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; }
article { max-width:78ch; margin:0 auto; padding:2.5rem 1.25rem 4rem; }
h1 { font-size:1.35rem; line-height:1.3; margin:0 0 1.25rem; letter-spacing:-0.01em; }
h2 { font-size:1.05rem; margin:1.75rem 0 0.5rem; padding-bottom:0.3rem; border-bottom:1px solid var(--line); }
h3 { font-size:0.92rem; margin:1.25rem 0 0.4rem; }
h2,h3 { scroll-margin-top:0.75rem; }
p { margin:0.45rem 0; }
ul { margin:0.45rem 0; padding-left:1.2rem; }
li { margin:0.15rem 0; }
code { font:0.85em ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  background:var(--chip); border:1px solid var(--line); border-radius:4px; padding:0.05rem 0.3rem; }
blockquote { margin:0.7rem 0; padding:0.15rem 0.9rem; border-left:3px solid var(--vio);
  background:var(--vio-soft); color:var(--mut); border-radius:0 6px 6px 0; }
blockquote p { margin:0.35rem 0; }
table { border-collapse:collapse; width:100%; margin:0.7rem 0; font-size:0.86rem; }
th,td { border:1px solid var(--line); padding:0.3rem 0.55rem; text-align:left; vertical-align:top; }
th { background:var(--chip); font-weight:600; }
td.r,th.r { text-align:right; } td.l,th.l { text-align:left; }
tbody tr:nth-child(even) { background:#fafafa; }
nav.toc { border:1px solid var(--line); border-radius:8px; background:var(--chip);
  padding:0.8rem 1rem; margin:0 0 1.5rem; }
nav.toc p { margin:0 0 0.4rem; font-size:0.7rem; font-weight:600; letter-spacing:0.08em;
  text-transform:uppercase; color:var(--mut); }
nav.toc ul { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:0.3rem 0.35rem; }
nav.toc a { display:inline-block; font-size:0.78rem; color:var(--ink); text-decoration:none;
  background:var(--bg); border:1px solid var(--line); border-radius:999px; padding:0.1rem 0.6rem; }
nav.toc a:hover { color:var(--vio); border-color:var(--vio); }
nav.toc a.sub { font-size:0.72rem; opacity:0.85; }
a { color:var(--vio); }
footer.docnote { margin-top:2rem; padding-top:0.75rem; border-top:1px solid var(--line);
  color:var(--mut); font-size:0.78rem; font-style:italic; }
@media print {
  article { max-width:none; padding:0; }
  body { font-size:10.5pt; }
  h2 { break-after:avoid; } h3 { break-after:avoid; }
  table { break-inside:auto; } tr { break-inside:avoid; }
  nav.toc { border-color:#bbb; background:#fff; }
}
`;

/**
 * The echo itself: md bytes in, standalone HTML bytes out. Deterministic
 * (no clock, no randomness — the t195 law holds in the new medium), zero
 * script, zero external references, index-paired contents page.
 */
export const buildSessionReportHtml = (
  md: string,
  opts: { title?: string; note?: string } = {},
): string => {
  const lines = md.split("\n");
  const toc = reportTocOf(md);

  const tocHtml =
    toc.length > 0
      ? `<nav class="toc" aria-label="Contents"><p>Contents</p><ul>${toc
          .map(
            (t, idx) =>
              `<li><a class="${t.level === 3 ? "sub" : ""}" href="#s${idx}">${esc(t.text)}</a></li>`,
          )
          .join("")}</ul></nav>`
      : "";

  // ONE pass mints both mouths: the i-th heading line the filter admits
  // gets id `s<i>` in the body, and the TOC entry at index i links to it.
  let headIdx = 0;
  const body: string[] = [];
  let i = 0;
  let docTitle = opts.title ?? "CryoFlow session QC report";
  while (i < lines.length) {
    const line = lines[i];
    if (/^#{2,3} \S/.test(line)) {
      const id = `s${headIdx++}`;
      const level = line.startsWith("### ") ? 3 : 2;
      const text = line.replace(/^#{2,3} /, "");
      body.push(`<h${level} id="${id}">${inlineHtml(text)}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith("# ") && line.trim().length > 2) {
      docTitle = opts.title ?? line.replace(/^# /, "").trim();
      body.push(`<h1>${inlineHtml(line.replace(/^# /, ""))}</h1>`);
      // the contents page is born under the document's own name — the
      // compass travels with the echo (same parse, same index pairing)
      body.push(tocHtml);
      i++;
      continue;
    }
    if (line.startsWith("|") && i + 1 < lines.length && /^\|[\s:-]+\|/.test(lines[i + 1])) {
      const t = tableHtml(lines, i);
      body.push(t.html);
      i = t.next;
      continue;
    }
    if (/^-\s+\S/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s+\S/.test(lines[i])) {
        items.push(`<li>${inlineHtml(lines[i].replace(/^-\s+/, ""))}</li>`);
        i++;
      }
      body.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (line.startsWith("> ")) {
      const quotes: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quotes.push(inlineHtml(lines[i].replace(/^> /, "")));
        i++;
      }
      body.push(`<blockquote><p>${quotes.join("</p><p>")}</p></blockquote>`);
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    // standalone paragraph — the closed subset's full-line emphasis
    const italic = /^_.+_$/.test(line.trim());
    const text = italic ? line.trim().slice(1, -1) : line;
    body.push(`<p>${italic ? `<em>${inlineHtml(text)}</em>` : inlineHtml(text)}</p>`);
    i++;
  }

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(docTitle)}</title>`,
    `<style>${DOC_CSS}</style>`,
    "</head>",
    "<body>",
    "<article>",
    body.join("\n"),
    opts.note ? `<footer class="docnote">${esc(opts.note)}</footer>` : "",
    "</article>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
};
