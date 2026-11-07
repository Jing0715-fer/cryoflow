#!/usr/bin/env node
/* t808 — the house dialect's next batch: the two manager faces that
 * still rode the OLD shape. The t802/t804 verdict described the disease
 * exactly (the DialogContent IS the scroll surface; Radix pins the
 * dialog to tabIndex=-1; everything between the header's last tabbable
 * and the body's first is keyboard-unreachable) — and this batch found
 * the disease still alive on two surfaces the census had not yet walked:
 *
 *   remote-cluster-dialog — the SSH manager (the biggest dialog on
 *     file): the t383 default overflow-y-auto rode on the card, the
 *     header floated unpinned, and the twin inner grounds (the list's
 *     54vh, the editor's 60vh) scrolled INSIDE a surface the keyboard
 *     could not reach.
 *   hpc-sbatch-dialog — the Slurm submission card: inherited the same
 *     default cap (max-h + overflow-y-auto) with no override at all.
 *
 * The cure speaks the t804 house dialect verbatim (flex col + gap-0 +
 * overflow-hidden + p-0, the header pinned, ONE inner region with the
 * stop + the honest name + the inset ring, role=dialog kept) — and
 * keeps the family's discipline: the inner grounds keep their own
 * scrolls (one law per window), the widths are the cards' own. */

import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const remote = read("src/components/workflow/remote-cluster-dialog.tsx");
const sbatch = read("src/components/workflow/hpc-sbatch-dialog.tsx");

let pass = 0;
const fails = [];
const ok = (cond, msg) => {
  if (cond) pass++;
  else fails.push(msg);
};

/* A — the remote manager's house */
ok(
  remote.includes('className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"'),
  "A1 the remote card wears the house shape (flex col + gap-0 + overflow-hidden + p-0; the 5xl width is the card's own)",
);
ok(
  remote.includes('<DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">'),
  "A2 the header pinned (shrink-0 + the border that holds the scroll's top edge)",
);
ok(
  remote.includes('role="region"') &&
    remote.includes('aria-label="Remote cluster manager — the connection list and the selected editor"'),
  "A3 ONE inner region with the honest name (the manager's two halves named in one breath)",
);
ok(
  remote.includes(
    "min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
  ),
  "A4 the region carries stop + scroll + the inset ring (the t802 verse, verbatim)",
);
ok(
  (remote.match(/role="region"/g) || []).length === 1,
  "A5 exactly one region in the file (the inner grounds keep their list/editor semantics — no role inflation)",
);
ok(
  remote.includes('role="dialog"') || remote.includes("<DialogContent"),
  "A6 the Radix dialog role kept (the t799 third-family law — the wrapper still answers 'what am I')",
);

/* B — the remote card's inner grounds stand untouched */
ok(
  remote.includes('max-h-[54vh] space-y-1 overflow-y-auto pr-0.5'),
  "B1 the list's 54vh ground kept (one law per window — the inner scrolls are not this batch's law)",
);
ok(
  remote.includes('style={{ maxHeight: "60vh" }}'),
  "B2 the editor's 60vh ground kept (its inline form survives; a future census may dress it, this one did not)",
);
ok(
  remote.includes('aria-label="SSH cluster connections"') &&
    remote.includes("aria-pressed={active}"),
  "B3 the rows' faces kept (the real buttons with their pressed state — the t806 audit's evidence, still on file)",
);

/* C — the sbatch card's house */
ok(
  sbatch.includes('className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"'),
  "C1 the sbatch card wears the house (the 3xl width is the card's own)",
);
ok(
  sbatch.includes('<DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">'),
  "C2 the header pinned",
);
ok(
  sbatch.includes('aria-label="Slurm sbatch workspace — the profile row, the generated script, and the scheduling projection"'),
  "C3 the region's honest name (the three blocks the workspace holds, named in one breath)",
);
ok(
  sbatch.includes("min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-4"),
  "C4 the region scrolls and keeps the old gap-4 rhythm (space-y-4 — the t804 spacing verse)",
);
ok(
  sbatch.includes('tabIndex={0} aria-label="Generated sbatch script"') ||
    (sbatch.includes('aria-label="Generated sbatch script"') && sbatch.includes("max-h-80 overflow-auto")),
  "C5 the script pre's own ground kept (max-h-80 + its stop — the inner face this batch never touched)",
);

/* D — the dialect's consistency (the house is recognizable from the street) */
ok(
  !remote.includes('className="max-h-[85vh] overflow-y-auto sm:max-w-5xl"') &&
    !sbatch.includes('className="max-w-3xl"'),
  "D1 the old shapes retired (no card still carries the body-scroll override this batch cured)",
);
ok(
  remote.includes("onEscapeClose") && sbatch.includes("onEscapeClose"),
  "D2 the t797 escape law rides on both cards (the hand-back chain untouched by the surgery)",
);
ok(
  remote.includes("px-6 pb-6 pt-4") && sbatch.includes("px-6 pb-6 pt-4"),
  "D3 both regions share the padding dialect (the house's rooms measure the same)",
);

console.log(`t808-house-batch-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
