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
 *
 * t483 — the manual's rows open the doors they name. A row whose first
 * move is to reach a surface ("Open the assistant…", "⌘K opens the
 * palette…") now carries that door: GUIDE_DOORS is the registry (id,
 * label, the words the manual must name it by, and the open action),
 * chapters map row indices to door ids, and a named row renders as a
 * button that yields focus (the palette-taught dance) before the door
 * swings open. The storage map needed a new cross-open route —
 * STORAGE_OPEN_EVENT, the header owns it, the manual only rings the
 * bell. And the bench now holds the law both ways: every registered
 * door is named by a row, and every cryoflow:open-* event in the
 * codebase must be referenced by this manual — a new wing without a
 * manual row fails the build.
 */

import * as React from "react";
import {
  ArrowUpRight,
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
import { OPEN_EVENT, SESSION_REPORT_EVENT, SYSTEM_DIAGNOSTICS_EVENT } from "./command-palette";
import { REMOTE_CLUSTERS_OPEN_EVENT } from "./remote-cluster-dialog";
import { STORAGE_OPEN_EVENT } from "./header";

export interface HelpChapter {
  id: string;
  icon: React.ReactNode;
  title: string;
  rows: string[];
  /** t483 — row index → door id: a row whose first move is to reach a
   *  surface carries the door it names. Every key must be a valid row
   *  index, every value a valid GUIDE_DOORS id, and the row must still
   *  name its door in words (the bench holds all three) — a door on a
   *  row that doesn't name it is a lying row. */
  rowDoors?: Record<number, string>;
}

export interface GuideDoor {
  id: string;
  /** shown in the row's accessible name: “… — opens <label>” */
  label: string;
  /** the words the manual must name this door by — the governance
   *  bench reads them (a wing without a manual row fails the bench) */
  names: string[];
  open: () => void;
}

/** The manual's door registry — one entry per surface the guide can
 *  walk you to. Two wire kinds, both by owner-listens law: store flags
 *  for globally-owned dialogs (assistant, shortcuts), CustomEvents for
 *  owner-mounted dialogs (storage, clusters, palette, report). The
 *  guide never mounts a second copy of anything. */
export const GUIDE_DOORS: GuideDoor[] = [
  {
    id: "assistant",
    label: "the AI assistant",
    names: ["assistant"],
    open: () => useWorkflowStore.getState().setAiAssistantOpen(true),
  },
  {
    id: "storage",
    label: "the storage map",
    names: ["storage overview"],
    open: () => window.dispatchEvent(new CustomEvent(STORAGE_OPEN_EVENT)),
  },
  {
    id: "clusters",
    label: "the remote clusters roster",
    names: ["Remote clusters"],
    open: () =>
      window.dispatchEvent(new CustomEvent(REMOTE_CLUSTERS_OPEN_EVENT)),
  },
  {
    id: "palette",
    label: "the command palette",
    names: ["command palette"],
    open: () => window.dispatchEvent(new CustomEvent(OPEN_EVENT)),
  },
  {
    id: "shortcuts",
    label: "the keyboard shortcuts",
    names: ["keyboard shortcut"],
    open: () => useWorkflowStore.getState().setShortcutsOpen(true),
  },
  {
    id: "report",
    label: "the session QC report",
    names: ["Session QC report"],
    open: () => window.dispatchEvent(new CustomEvent(SESSION_REPORT_EVENT)),
  },
  {
    // t547 — the t530-born diagnostics dialog gets its manual row: the T3e
    // sweep convicted the wing without a row, and the manual answers. The
    // header owns the dialog; the door only rings its bell.
    id: "diagnostics",
    label: "the system diagnostics",
    names: ["System diagnostics", "diagnostics"],
    open: () => window.dispatchEvent(new CustomEvent(SYSTEM_DIAGNOSTICS_EVENT)),
  },
];

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
    rowDoors: { 0: "assistant" },
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
    rowDoors: { 0: "storage" },
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
    rowDoors: { 0: "clusters" },
  },
  {
    id: "finding",
    icon: <Compass className="size-3.5 text-primary" />,
    title: "Finding your way",
    rows: [
      "⌘K / Ctrl+K opens the command palette — every header door is indexed there, so when a button hides, ask ⌘K first.",
      "Press ? for the full keyboard shortcut inventory.",
      "The Session QC report turns the session into a document — charts and verdicts, exportable as HTML or Markdown.",
      "System diagnostics reads the install's health — the RELION detection, the reaper's heartbeat and the world's vitals in one dialog.",
      "Everything prints: the print stylesheet hides the chrome and lays the canvas out on paper.",
    ],
    rowDoors: { 0: "palette", 1: "shortcuts", 2: "report", 3: "diagnostics" },
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
            All {total} guide rows across {HELP_CHAPTERS.length} chapters.
            Rows with an arrow open the door they name. Press Escape to close.
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
                    {c.rows.map((row, i) => {
                      const doorId = c.rowDoors?.[i];
                      const door = doorId
                        ? GUIDE_DOORS.find((d) => d.id === doorId)
                        : undefined;
                      return (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                        >
                          <span
                            className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/50"
                            aria-hidden="true"
                          />
                          {door ? (
                            <button
                              type="button"
                              data-testid="guide-row-door"
                              data-door={door.id}
                              aria-label={`${row} — opens ${door.label}`}
                              className="group/row flex-1 rounded-sm text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                              onClick={() => {
                                // the palette-taught dance: the guide yields
                                // focus before the named door swings open
                                setOpen(false);
                                door.open();
                              }}
                            >
                              <span className="transition-colors group-hover/row:text-foreground">
                                {row}
                              </span>
                              <ArrowUpRight
                                className="ml-1 inline size-3 align-[-1px] text-primary/70"
                                aria-hidden="true"
                              />
                            </button>
                          ) : (
                            <span>{row}</span>
                          )}
                        </li>
                      );
                    })}
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
