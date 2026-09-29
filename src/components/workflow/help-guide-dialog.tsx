"use client";

/**
 * t482 — the full help guide: the door's manual catches up with the
 * product. The help popover has carried the canvas's six ancient tips
 * since the demo era; since then the app grew storage maps and a
 * graveyard, dispatch records, cluster rosters and a 21-tool assistant —
 * none of it discoverable from the "?" door. This dialog is the manual,
 * built on the shortcuts-dialog pattern: HELP_CHAPTERS is the single
 * source of truth (exported so a bench and the popover can pin it), a
 * filter walks every chapter, and the doors stay TWO — the popover's CTA
 * and the command palette. No keyboard hook of its own: "?" already owns
 * the shortcuts dialog, and an ambiguous key is a lying door (t247's
 * law) — the honest-absent beats the vague-present.
 */

import * as React from "react";
import {
  BookOpen,
  Compass,
  HardDrive,
  Keyboard,
  MousePointer2,
  Search,
  Server,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkflowStore } from "@/lib/store";

export interface HelpChapter {
  id: string;
  icon: React.ReactNode;
  title: string;
  rows: string[];
}

/** The manual's single source of truth — every row names a real door. */
export const HELP_CHAPTERS: HelpChapter[] = [
  {
    id: "canvas",
    icon: <MousePointer2 className="size-3.5 text-primary" />,
    title: "The canvas",
    rows: [
      "Click a job card to inspect and edit it in the side panel; drag to rearrange — position is saved automatically.",
      "Click an output port (right edge), then a target's input port (left edge) to connect jobs; press ESC to cancel a connection or deselect.",
      "Right-click a card for the quick-action menu — run, duplicate, delete. A deleted job keeps a tombstone, so it can come back.",
      "Run a job from the details panel — the engine drives it live and progress updates in place.",
      "Zoom with the floating controls; the minimap and the Ctrl/⌘+F find bar help on crowded canvases.",
    ],
  },
  {
    id: "assistant",
    icon: <Sparkles className="size-3.5 text-primary" />,
    title: "The AI assistant",
    rows: [
      "Open the assistant from the header and ask before you dig — questions are reads, and reads never change your canvas.",
      "It can act too: create, wire, run, stop and delete jobs — and it can bring deleted jobs back from the graveyard by name.",
      "Every cluster dispatch is recorded — ask what a cluster has been running and the answer comes from the records dialog's own ledger.",
      "Ask about disk: “what's eating space?” walks the same storage map the dialog draws.",
    ],
  },
  {
    id: "storage",
    icon: <HardDrive className="size-3.5 text-primary" />,
    title: "Storage & the graveyard",
    rows: [
      "Project storage overview walks the real files — categories are extension-honest, and orphan rows (directories without a job) wear amber.",
      "Recently deleted lists every grave: a grave with a row snapshot restores from its own snapshot under its original id; older graves restore only from the delete toast's undo.",
      "Click a row's chevron for its epitaph — what the run was, the id it comes back under, its wires, and why it cannot be restored from here.",
      "Clear is an armed two-step: the first click arms, the second buries — spent graves go first, restorable ones are spared by name.",
      "Sort the graveyard by weight to see which graves still hold the most disk.",
    ],
  },
  {
    id: "clusters",
    icon: <Server className="size-3.5 text-primary" />,
    title: "Remote clusters",
    rows: [
      "Remote clusters (SSH) keeps the roster: every saved connection wears a probe dot — reachable, unreachable, or never probed.",
      "Test a connection before the first dispatch — a never-probed connection refuses to dispatch blind.",
      "Bind a project to a connection so cluster runs land in it; the binding shows on every card that runs remote.",
      "Each cluster wears its dispatch résumé — total, completed and failed runs, plus the three newest.",
    ],
  },
  {
    id: "finding",
    icon: <Compass className="size-3.5 text-primary" />,
    title: "Finding your way",
    rows: [
      "⌘K / Ctrl+K opens the command palette — every header door is indexed there, so when a button hides, ask ⌘K first.",
      "Press ? for the full keyboard shortcut inventory.",
      "The Session QC report turns the session into a document — charts and verdicts, exportable as HTML or Markdown.",
      "Everything prints: the print stylesheet hides the chrome and lays the canvas out on paper.",
    ],
  },
];

export function HelpGuideDialog() {
  const open = useWorkflowStore((s) => s.helpGuideOpen);
  const setOpen = useWorkflowStore((s) => s.setHelpGuideOpen);
  const setShortcutsOpen = useWorkflowStore((s) => s.setShortcutsOpen);
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const chapters = React.useMemo(
    () =>
      HELP_CHAPTERS.map((c) => ({
        ...c,
        rows: q
          ? c.rows.filter(
              (r) => r.toLowerCase().includes(q) || c.title.toLowerCase().includes(q),
            )
          : c.rows,
      })).filter((c) => c.rows.length > 0),
    [q],
  );

  const total = HELP_CHAPTERS.reduce((n, c) => n + c.rows.length, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex max-h-[86dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <BookOpen className="size-4 text-primary" aria-hidden="true" />
            How to use CryoFlow
          </DialogTitle>
          <DialogDescription className="sr-only">
            All {total} guide rows across {HELP_CHAPTERS.length} chapters. Press Escape to close.
          </DialogDescription>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${total} guide rows…`}
              aria-label="Filter the help guide"
              className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {chapters.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No guide row matches “{query}”.
            </p>
          ) : (
            <div className="space-y-5">
              {chapters.map((c) => (
                <section key={c.id} aria-label={`${c.title} guide`}>
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                      {c.icon}
                    </span>
                    {c.title}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {c.rows.map((row, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                      >
                        <span
                          className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/50"
                          aria-hidden="true"
                        />
                        <span>{row}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => {
              // the same dance the palette teaches: the guide yields focus
              // before the shortcuts dialog opens
              setOpen(false);
              setShortcutsOpen(true);
            }}
          >
            <Keyboard className="size-3.5 text-primary" aria-hidden="true" />
            All keyboard shortcuts
            <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground/80">
              ?
            </kbd>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
