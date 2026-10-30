#!/usr/bin/env node
/**
 * t1091 — THE RECEIPT LEDGER unit (node-only): the canvas paper face's
 * second voice.
 *
 * THE SCAR (this window's survey, one rendered sheet): the canvas paper
 * carries the whole pipeline on ONE landscape sheet (Task 72), and the
 * cards' receipt lines truncate at CARD layout width — the OOM kill
 * story ("motioncor2 exited 137 — CUDA error: ou…"), the SLURM external
 * cancellation, the wrapper's death were ellipsized on the very sheet a
 * scientist archives. The type label truncates too ("Import Movies /
 * Microg…"). Paper is the ONE reader that cannot hover (t1089's law).
 *
 * THE CURE: the t1089 wrap cure does NOT transfer (the card lives at a
 * fixed CARD_H inside an absolutely-positioned world box — a wrapped
 * receipt collides with the neighbor below), so the card keeps its
 * rhythm and the truth takes its own document-flow voice: the paper
 * RECEIPT LEDGER below the map — one line per job, FULL name + FULL
 * type label + FULL receipt (the card's own displayResult voice), zero
 * screen footprint, empty world prints nothing, and the Task 114
 * inspector step-aside kills it with the page.
 *
 * BANDS:
 *   A  the ledger exists and speaks in full (component, the full
 *      receipt voice, the full type label, the card's own fallback
 *      words, the print-scoped mount)
 *   B  the mount is honest (after the trigger — a flow sibling of the
 *      viewport section, NOT inside it; the workspace snapshot jobs;
 *      the empty-world guard; the ledger hook)
 *   C  the laws preserved (the map's fit-to-paper scale law intact, the
 *      title unwrap law intact, the card keeps its truncate rhythm, the
 *      inspector step-aside survives)
 *
 * PROTOCOL: node-only, readFileSync over the components + stylesheet,
 * exit honest, receipt to shots-qa/.t1091-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1091-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const ledger = read("src/components/workflow/print-receipt-ledger.tsx");
const canvas = read("src/components/workflow/canvas.tsx");
const card = read("src/components/workflow/job-card.tsx");
const css = read("src/app/globals.css");

/* ---------- A band — the ledger speaks in full ---------- */
console.log("A band — the ledger speaks in full:");
ok("A1 the ledger component exists and is a paper section (data-print-receipt-ledger, hidden print:block)",
  ledger.includes('data-print-receipt-ledger') &&
  /className="hidden print:block print:break-before-page print:pb-10"/.test(ledger));
ok("A2 the receipt speaks the FULL displayResult voice (the card's own envelope law, no slice)",
  /ledgerReceipt\(job: JobDTO\)[\s\S]*?displayResult\(job\.result\)/.test(ledger) &&
  !/\.slice\(0,/.test(ledger.split("export function PrintReceiptLedger")[0].split("function ledgerReceipt")[1] ?? ""));
ok("A3 the type label speaks IN FULL (jobType label, no truncate in the ledger line)",
  ledger.includes("jobType(job.type)?.label ?? job.type") &&
  !/truncate/.test(ledger.split("const typeLabel")[1] ?? ""));
ok("A4 the receipt-less fallbacks are the card's OWN words (never invented sentences)",
  ledger.includes('failed: "Run failed — check logs"') &&
  ledger.includes('pending: "Waiting for an upstream job"'));
ok("A5 the running job's receipt is the world's own arithmetic (progress %, not a promise)",
  ledger.includes("Running — ${Math.round(job.progress)}%"));
ok("A6 the empty world prints nothing (a ledger of zero jobs is a printed lie)",
  ledger.includes("if (jobs.length === 0) return null;"));
ok("A7 the ledger takes its OWN sheet (break-before: page — the map page stays exactly the map; the Task 72 contract restored)",
  ledger.includes("hidden print:block print:break-before-page print:pb-10") &&
  ledger.includes("its third line ran INTO the per-sheet footer"));

/* ---------- B band — the mount is honest ---------- */
console.log("B band — the mount is honest:");
const mountIdx = canvas.indexOf("<PrintReceiptLedger jobs={jobs} />");
const triggerClose = canvas.indexOf("</ContextMenuTrigger>");
const viewportClose = canvas.indexOf('        </section>\n      </ContextMenuTrigger>');
ok("B1 the ledger mounts in canvas.tsx (the map's own paper tree)",
  mountIdx > 0);
ok("B2 the ledger is a flow sibling AFTER the viewport section (not inside the clip'd box)",
  mountIdx > triggerClose && viewportClose > 0);
ok("B3 the ledger rides the WORKSPACE snapshot (jobs, not allJobs — the paper is one workspace's map)",
  canvas.includes("<PrintReceiptLedger jobs={jobs} />"));
ok("B4 the ledger hook rides the section (data-ledger-job per line — machine-verifiable roster)",
  /data-ledger-job=\{job\.id\}/.test(ledger));
ok("B5 the mount comment names the law (paper cannot hover; a torn tail is worse than a second sheet)",
  canvas.includes("a torn tail is worse than a\n          second sheet") &&
  canvas.includes("the paper RECEIPT LEDGER"));

/* ---------- C band — the laws preserved ---------- */
console.log("C band — the laws preserved:");
ok("C1 the map keeps its fit-to-paper scale law (the Task 72 box math untouched)",
  css.includes("width: calc(var(--print-w, 0px) * var(--print-z, 1)) !important;") &&
  css.includes("transform: scale(var(--print-z, 1)) !important;"));
ok("C2 the title unwrap law intact (names are identity — the t84-era cure survives)",
  css.includes('[data-view="canvas"] .job-card-title') &&
  css.includes("white-space: normal !important;"));
ok("C3 the card keeps its truncate rhythm (the completed + failed receipt lines untouched)",
  card.includes('className="truncate text-[11px] leading-[15px] text-foreground/80"') &&
  card.includes('className="truncate text-[11px] leading-[15px] text-danger"'));
ok("C4 the Task 114 inspector step-aside survives (the report is the document — the ledger dies with the page)",
  css.includes('html:has([data-inspector-dialog][data-state="open"]) [data-view]') &&
  css.includes("display: none !important;"));

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1091-receipt-ledger-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["A the ledger speaks in full", "B the mount is honest", "C the laws preserved"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);
