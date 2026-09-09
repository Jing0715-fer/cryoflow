"use client";

/**
 * CryoFlow — keyboard shortcuts dialog.
 *
 * The app grew a real keyboard layer (canvas power moves, the roving
 * class-gallery, layered dialog Esc) but none of it was discoverable —
 * the help popover squeezed 15 entries into a cramped list. This dialog
 * is the single discoverable surface: "?" anywhere, the help popover CTA,
 * or the command palette all open it (one store flag, three doors).
 *
 * SHORTCUT_GROUPS is the single source of truth — rendered here with a
 * filter input; the help popover no longer keeps its own copy. Rows show
 * the description first (what does it DO) and key chips second, split on
 * spaces so multi-key combos read as distinct chips.
 *
 * The dialog is a Radix modal: the global "?" handler won't retrigger
 * while it's open (dialog[data-state=open] guard), Esc peels exactly one
 * layer, and the print stylesheet already hides it on paper (Task 70).
 */

import * as React from "react";
import { Keyboard, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkflowStore } from "@/lib/store";

interface ShortcutRow {
  /** key chips — split on spaces into individual <kbd>s */
  keys: string;
  text: string;
}

interface ShortcutGroup {
  id: string;
  label: string;
  hint?: string;
  rows: ShortcutRow[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "global",
    label: "Global",
    rows: [
      { keys: "⌘/Ctrl K", text: "Command palette — jump, add, run" },
      { keys: "⇧ D", text: "Toggle canvas ⇄ project dashboard" },
      { keys: "?", text: "This shortcuts dialog" },
      { keys: "Esc", text: "Peel one layer — cancel wire, collapse selection, close panel" },
      { keys: "⌘/Ctrl P", text: "Print the pipeline as a clean paper sheet" },
    ],
  },
  {
    id: "canvas",
    label: "Canvas",
    hint: "Ignored while typing in a form field",
    rows: [
      { keys: "F", text: "Center the selected job in the viewport" },
      { keys: "0", text: "Reset pan & zoom (100 %)" },
      { keys: "+ / −", text: "Zoom in / out around the viewport center" },
      { keys: "⌘/Ctrl A", text: "Select every job in the workspace" },
      { keys: "⌘/Ctrl D", text: "Duplicate the selection (one job or a group)" },
      { keys: "N", text: "Note spotlight — dim jobs without a note" },
      { keys: "Delete", text: "Delete the selection (asks first)" },
      { keys: "⇧ Click", text: "Toggle a card in the selection" },
      { keys: "⇧ Drag", text: "Box-select on empty canvas" },
    ],
  },
  {
    id: "dashboard",
    label: "Project dashboard",
    rows: [
      { keys: "1–4", text: "Grid filter — all · running · completed · failed" },
    ],
  },
  {
    id: "gallery",
    label: "Class gallery",
    hint: "Roving focus — one tab stop, arrows move geometrically",
    rows: [
      { keys: "← → ↑ ↓", text: "Move focus across the class grid" },
      { keys: "Enter Space", text: "Toggle keep on the focused class" },
      { keys: "Home End", text: "Jump to the first / last class" },
    ],
  },
  {
    id: "touch",
    label: "Touch & pointer",
    rows: [
      { keys: "Long-press", text: "Hold empty canvas, then drag to box-select" },
      { keys: "Pinch", text: "Two fingers to zoom · trackpad pinch / ctrl-scroll" },
      { keys: "Right-click", text: "Quick-action menu on a card (run · duplicate · delete …)" },
    ],
  },
];

/** split "⌘/Ctrl K" into ["⌘/Ctrl", "K"] chips (combo atoms are space-free) */
const toChips = (keys: string) => keys.split(" ").filter(Boolean);

export function ShortcutsDialog() {
  const open = useWorkflowStore((s) => s.shortcutsOpen);
  const setOpen = useWorkflowStore((s) => s.setShortcutsOpen);
  const [query, setQuery] = React.useState("");

  // reopening starts unfiltered — a stale filter looks like "the dialog
  // lost half its entries"
  React.useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const groups = React.useMemo(
    () =>
      SHORTCUT_GROUPS.map((g) => ({
        ...g,
        rows: q
          ? g.rows.filter(
              (r) =>
                r.text.toLowerCase().includes(q) ||
                r.keys.toLowerCase().includes(q) ||
                g.label.toLowerCase().includes(q),
            )
          : g.rows,
      })).filter((g) => g.rows.length > 0),
    [q],
  );

  const total = SHORTCUT_GROUPS.reduce((n, g) => n + g.rows.length, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex max-h-[86dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Keyboard className="size-4 text-primary" aria-hidden="true" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            All {total} keyboard shortcuts, grouped by context. Press Escape to close.
          </DialogDescription>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${total} shortcuts…`}
              aria-label="Filter shortcuts"
              className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No shortcut matches “{query}”.
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.id} aria-label={`${g.label} shortcuts`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {g.label}
                  </p>
                  {g.hint && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">{g.hint}</p>
                  )}
                  <dl className="mt-2 space-y-1.5">
                    {g.rows.map((r) => (
                      <div
                        key={r.keys}
                        className="flex items-center justify-between gap-4 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/50"
                      >
                        <dd className="text-xs leading-relaxed text-muted-foreground">
                          {r.text}
                        </dd>
                        <dt className="flex shrink-0 items-center gap-1">
                          {toChips(r.keys).map((chip, i) => (
                            <kbd
                              key={i}
                              className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground/80"
                            >
                              {chip}
                            </kbd>
                          ))}
                        </dt>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </div>

        <p className="shrink-0 border-t px-5 py-2.5 text-[10px] text-muted-foreground/80">
          Press <kbd className="rounded border bg-muted px-1 font-mono text-[9px]">?</kbd>{" "}
          anywhere to reopen · Escape closes one layer
        </p>
      </DialogContent>
    </Dialog>
  );
}
