import { displayResult } from "@/components/workflow/job-card";
import type { JobDTO } from "@/lib/types";
import { jobType } from "@/lib/workflow";

/**
 * t1091 — the paper RECEIPT LEDGER, the canvas snapshot's second voice.
 *
 * THE SCAR (this window's survey, one rendered sheet): the canvas paper
 * carries the whole pipeline on ONE landscape sheet (Task 72's fit-to-
 * paper contract), and every card's receipt line truncates at the CARD's
 * layout width — text-overflow works on layout width, not on the scaled
 * ink, so the ellipsis burns into paper exactly where it burns on
 * screen. Paper is the ONE reader that cannot hover (the t1089 law):
 * "motioncor2 exited 137 — CUDA error: ou…", "the run ended in an
 * external cancellatio…", "the wrapper died before RELION started…" —
 * the failure stories a scientist archives the sheet FOR were unreachable
 * on it. The type label truncates the same way ("Import Movies /
 * Microg…") even though the t350 comment already knew the law ("paper
 * has no hover").
 *
 * WHY A LEDGER and not the t1089 wrap cure: the canvas card lives at a
 * FIXED height (CARD_H) inside an absolutely-positioned world box whose
 * geometry is computed from CARD_W/CARD_H — a wrapped receipt would
 * overflow the fixed card, collide with the neighbor below, and break
 * the fit-to-paper budget. The dashboard's flowing roster could afford
 * to wrap; the map cannot. So the card keeps its rhythm (the truncate
 * stays — rhythm on the card) and the truth takes its OWN document-flow
 * voice below the map: one line per job, name + FULL type label + FULL
 * receipt, wrapping freely. The map keeps its one-page fit BY
 * CONSTRUCTION (the scaled world box is untouched); the ledger is
 * document flow and pages naturally — a torn tail is worse than a
 * second sheet.
 *
 * THE VOICES: the receipt speaks the card's own displayResult voice
 * (the REMOTE envelope stays provenance-of-the-inspector, the payload
 * sentence speaks IN FULL — including the stay-receipt tail the card
 * trims into the homecoming chip). A receipt-less job speaks its
 * status's honest word, the SAME words the card itself falls back to.
 *
 * THE BOUNDARIES: hidden on screen (zero footprint — the ledger is
 * paper's second voice, not a screen panel); empty world prints nothing
 * (a ledger of zero jobs is a printed lie); and when the job inspector
 * is open the report IS the document — the whole [data-view] page hides
 * (Task 114's step-aside), the ledger dies with the page it belongs to.
 *
 * THE OWN SHEET (the live ride's catch): the ledger first flew as plain
 * flow under the map — and its third line ran INTO the per-sheet footer
 * strip (print:fixed repaints at every page's bottom and reserves NO
 * flow space — the same collision the Task 114 report lane cured with a
 * padding lane). The cure is the honest boundary: break-before: page —
 * the map page stays EXACTLY the map (the Task 72 one-page contract,
 * restored byte-for-byte), the words are the appendix sheet. The
 * trailing print padding keeps the appendix's own last line clear of
 * the strip if a long roster ever fills the sheet.
 */

/** The card's own fallback words, per status — the ledger never invents
 *  a sentence the card would not have spoken. */
const STATUS_FALLBACK: Record<string, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Run failed — check logs",
  pending: "Waiting for an upstream job",
  idle: "Idle",
};

function ledgerReceipt(job: JobDTO): string {
  return (
    displayResult(job.result) ??
    (job.status === "running"
      ? `Running — ${Math.round(job.progress)}%`
      : STATUS_FALLBACK[job.status] ?? job.status)
  );
}

export function PrintReceiptLedger({ jobs }: { jobs: JobDTO[] }) {
  if (jobs.length === 0) return null;
  return (
    <section
      data-print-receipt-ledger
      className="hidden print:block print:break-before-page print:pb-10"
    >
      <h2 className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Receipt ledger — {jobs.length} job{jobs.length === 1 ? "" : "s"}, the full
        sentences the map's cards could not hold
      </h2>
      <ul className="mt-1.5 space-y-[3px]">
        {jobs.map((job) => {
          // The type label speaks IN FULL — the card's truncate cut the
          // vocabulary word ("Import Movies / Microg…"); the ledger is
          // where the whole label lands (the t350 law, finally served).
          const typeLabel = jobType(job.type)?.label ?? job.type;
          return (
            <li
              key={job.id}
              data-ledger-job={job.id}
              className="text-[10px] leading-[14px] text-foreground/85"
            >
              <span className="font-semibold">{job.name}</span>
              <span className="text-muted-foreground"> — {typeLabel} — </span>
              {ledgerReceipt(job)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
