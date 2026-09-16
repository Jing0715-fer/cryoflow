// t237 sanity: buildSessionReportHtml over a closed-subset sample md.
// Quick lamp check before the wire assertions live in t223-e2e.
import { buildSessionReportHtml, reportTocOf } from "../src/lib/report-html";

const sample = [
  "# CryoFlow session QC report",
  "",
  "Project **beta-gal** · 21 jobs — 16 succeeded · 1 running · 0 failed · 4 waiting.",
  "",
  "## Pipeline at a glance",
  "",
  "- **16** succeeded jobs feed this report's QC sections;",
  "- **1** running · **0** failed — failures stay counted here, never dropped;",
  "- **4** waiting (idle or submitted) — no verdict exists for work that has not run.",
  "",
  "## Map QC",
  "",
  "## Map QC summary — ortho\\|vol",
  "",
  "Job `QA Refine 410` · mean-density landscape along **Z** (64 bins).",
  "",
  "### Comparison maps (2)",
  "",
  "| Map | Bins | Peak at | Agreement r | Verdict |",
  "| --- | --- | --- | --- | --- |",
  "| half1.mrc | 64 | 37.5% | 1.00 | reference |",
  "| half2.mrc | 64 | 39.1% | 0.98 | corroborates |",
  "",
  "### Local agreement",
  "",
  "| Map | Q1 | Q2 | Q3 | Q4 | Weakest | Depth (fraction) |",
  "| --- | --- | --- | --- | --- | --- | --: |",
  "",
  "## Session map inventory",
  "",
  "| Job | Main map | Volumes | Peak | Δ winner | Agreement r | Weakest |",
  "|-----|----------|---------|------|----------|-------------|---------|",
  "| QA Refine 410 | run_ct18.mrc | 3 | 37.5% | +0.0 | 1.00 | Q1 (1.00) |",
  "| QA Refine 320 | run_ct15.mrc | 3 | 40.6% | +3.1 | 0.95 | Q2 (0.93) |",
  "",
  "> The outlier lens is silent here: QA Refine 320 and QA Refine 250 tie for the largest |Δ| (3.1 vs winner) — a tie for the crown is no crown, so no row wears the amber edge.",
  "",
  "## Scheduling sweep",
  "",
  "_Still measuring — the sweep has not raced._",
  "",
  "_Bound from this session's live state — the filename carries the export stamp._",
].join("\n");

const html = buildSessionReportHtml(sample);

// lamp checks
const problems: string[] = [];
const want = (cond: boolean, msg: string) => {
  if (!cond) problems.push(msg);
};

want(html.startsWith("<!DOCTYPE html>"), "starts with doctype");
want(!/<script/i.test(html), "zero script tags");
want(!/<link|@import|src="http/i.test(html), "zero external references");
want((html.match(/<h2/g) ?? []).length === 5, `five h2 incl the deep report's own (got ${(html.match(/<h2/g) ?? []).length})`);
want((html.match(/<h3/g) ?? []).length === 2, `two h3 (got ${(html.match(/<h3/g) ?? []).length})`);
want((html.match(/<table>/g) ?? []).length === 3, `three tables (got ${(html.match(/<table>/g) ?? []).length})`);
want(html.includes('id="s0"') && html.includes('href="#s0"'), "index pairing s0 both mouths");
want(html.includes('href="#s5"') && html.includes('id="s5"'), "index pairing reaches s5");
want((html.match(/href="#s(\d+)"/g) ?? []).length === reportTocOf(sample).length, "TOC link count === parse count");
want(html.includes("ortho|vol"), "mdCell escaped pipe unescaped in heading");
want(html.includes("<strong>16</strong>"), "bold renders strong");
want(html.includes("<code>QA Refine 410</code>"), "code span renders");
want(html.includes("<blockquote>"), "crown note is a blockquote");
want(html.includes("|Δ|"), "blockquote's literal pipes survive");
want(html.includes("<em>Still measuring"), "full-line emphasis");
want(html.includes('class="r"'), "right-aligned column class present");
want((html.match(/<th/g) ?? []).length > 0 && html.includes("<tbody>"), "table head+body split");
// determinism: same md → same bytes
want(buildSessionReportHtml(sample) === html, "deterministic bytes (t195 law in the echo)");

if (problems.length > 0) {
  console.error("PROBLEMS:");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("t237 sanity GREEN —", html.length, "bytes,", reportTocOf(sample).length, "toc entries");
console.log(html.split("\n").slice(9, 14).join("\n"));
