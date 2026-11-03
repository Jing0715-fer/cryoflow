/**
 * Markdown cell — the GFM pipe table's quoting rule (t194, promoted to a
 * shared home in t195 when the profile QC report became the second
 * consumer). A `|` inside a cell would end the column early and a newline
 * would end the row, so escape the pipe and flatten the newline: the
 * mdCell twin of csvCell (the CSV needed RFC 4180, the table needs GFM —
 * each grammar gets the escaping IT lies about). Escaping knowledge lives
 * in ONE place: twins fork, imports don't (the downloadText precedent).
 */
export const mdCell = (v: string | number | boolean | undefined | null): string =>
  String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
