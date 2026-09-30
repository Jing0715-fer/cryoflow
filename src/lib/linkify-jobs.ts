/**
 * t495 — the assistant learns to point. The prose turns already NAME
 * jobs ("QA Refine 410 · FSC 0.143 at 4.1 Å"), but a name in plain
 * text is a signpost, not a door: the reader went to find the card on
 * the canvas by hand. linkifyJobs rewrites EXACT job-name matches into
 * markdown links the transcript's renderer can turn into doors —
 * [name](cryoflow-job://<id>) — and the panel's `a` override converts
 * those into pressable chips riding revealJob, the SAME deep-link
 * engine the tool cards' locate button uses (one engine, five
 * surfaces: dashboard spotlight, recent activity, gallery, palette
 * jump, now the prose).
 *
 * Laws:
 * - LONGEST names first — "Motion Correction 10" must win over its own
 *   prefix "Motion Correction 1"; the alternation is sorted, so at any
 *   position the longest candidate is tried before its prefixes.
 * - Code spans are IMMUNE — `run_job job_id="..."` is the reader's
 *   evidence, not a door; the text splits on `...` segments and only
 *   prose segments are rewritten (markdown code spans take their
 *   content literally — a link written inside one would render as raw
 *   syntax, a torn sentence).
 * - EXACT matches only — a name is a promise; a partial match mints a
 *   door that opens the wrong room (the t494 house law at word scale).
 * - RENDER-TIME ONLY — the stored messages and the exported bytes
 *   (md/json) keep their plain text; the door lives on the screen
 *   (t483's door law, at chat scale).
 * - Duplicate names: the FIRST job wins the claim (a name maps to one
 *   door; degenerate twins are a naming disease, not a routing one).
 */

export const JOB_LINK_PROTOCOL = "cryoflow-job://";

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const linkifyJobs = (text: string, jobs: { id: string; name: string }[]): string => {
  if (!text || jobs.length === 0) return text;
  const named = jobs
    .filter((j) => typeof j.name === "string" && j.name.trim().length > 0 && typeof j.id === "string" && j.id)
    .sort((a, b) => b.name.length - a.name.length);
  if (named.length === 0) return text;
  const byName = new Map<string, string>();
  for (const j of named) if (!byName.has(j.name)) byName.set(j.name, j.id);
  const pattern = new RegExp([...byName.keys()].map(escapeRe).join("|"), "g");
  // split on code spans — even indices are prose (linkifiable), odd are
  // code (immune; the split keeps the backtick delimiters in place)
  return text
    .split(/(`[^`]*`)/)
    .map((seg, i) => {
      if (i % 2 === 1 || !seg) return seg;
      return seg.replace(pattern, (m) => `[${m}](${JOB_LINK_PROTOCOL}${byName.get(m)})`);
    })
    .join("");
};
