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
 *
 * Task 246 — the exemption doc lives WHERE THE QUESTION IS ASKED. Every
 * header door is indexed in the palette (t245's law), so the reader who
 * fails to find a door in ⌘K forms the question right at the Global
 * group's ⌘K row — and the "Not in ⌘K — and why" group sits directly
 * beneath it to answer. The two exemptions are honest, not oversights:
 * each row carries the door's own keyboard path plus the reason it stays
 * out of the index. The data is ONE WELL (src/lib/palette-exemptions.json)
 * with two mouths: this dialog renders the reason strings VERBATIM, and
 * t245-e2e reads the same bytes as its EXEMPT_RULES — the contract and
 * the documentation are structurally unable to drift apart.
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
import { Kbd } from "@/components/ui/kbd";
import { useWorkflowStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import exemptions from "@/lib/palette-exemptions.json";

interface ShortcutRow {
  /** key chips — split on spaces into individual <kbd>s. Optional: the
   *  exemption rows may carry NO keyboard path by design (t532 — the
   *  AI/storage/knock doors); the row then renders the honest
   *  "no keyboard path" marker instead of chips. */
  keys?: string;
  text: string;
}

interface ShortcutGroup {
  id: string;
  label: string;
  hint?: string;
  /** which view this group lives on — when the dialog opens from the same
   *  view the group gets the "you are here" treatment (Task 78): the eye
   *  lands on the shortcuts that work RIGHT NOW before scanning the rest */
  scope?: "canvas" | "dashboard";
  rows: ShortcutRow[];
}

const exemptDoors = exemptions.exemptDoors;

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
    // The doc follows the question: the Global group's ⌘K row just told the
    // reader "the palette is the index" — this group answers "what is NOT
    // in it, and why". Rows are composed FROM the exemption well, so the
    // contract (t245) and this documentation share one source of truth.
    id: "not-in-palette",
    label: "Not in ⌘K — and why",
    hint: `Every header door is indexed in the command palette (⌘K). ${exemptDoors.length} honest exemption${exemptDoors.length === 1 ? "" : "s"} — each with its reason:`,
    rows: exemptDoors.map((d) => ({
      keys: d.keys,
      text: `${d.door} — ${d.reason}`,
    })),
  },
  {
    id: "canvas",
    label: "Canvas",
    hint: "Ignored while typing in a form field",
    scope: "canvas",
    rows: [
      { keys: "F", text: "Center the selected job in the viewport" },
      { keys: "⌘/Ctrl F", text: "Find jobs on canvas — matches ring amber, Enter cycles" },
      // t248: two live keys the audit found undocumented — "/" focuses the
      // add-job palette's search (window listener in palette.tsx, alive
      // while the catalog tab is), Alt+arrows reorder favorite chips (the
      // palette's own code comment calls it "the keyboard twin of the
      // drag"). A live key with no row is a drift; both rows seat beside
      // their semantic siblings (search beside find, reorder beside
      // duplicate).
      { keys: "/", text: "Focus the palette search — type to filter the job catalog" },
      { keys: "← → ↑ ↓", text: "Walk the graph — hop the anchor to the nearest card in that direction (⇧ extends)" },
      { keys: "0", text: "Return to the origin view (100 %, glides)" },
      { keys: "1–9", text: "Jump to a bookmarked view — seats shown in the bookmarks panel" },
      { keys: "+ / −", text: "Zoom in / out around the viewport center" },
      { keys: "M", text: "Toggle the world-overview map (bottom-right)" },
      { keys: "⌘/Ctrl A", text: "Select every job in the workspace" },
      { keys: "⌘/Ctrl D", text: "Duplicate the selection (one job or a group)" },
      { keys: "Alt ← →", text: "Reorder favorite chips — the keyboard twin of dragging them" },
      { keys: "⌘/Ctrl Z", text: "Undo the last canvas change — move, align, tidy or delete" },
      { keys: "⇧ ⌘/Ctrl Z · ⌘/Ctrl Y", text: "Redo an undone change" },
      { keys: "N", text: "Note spotlight — dim jobs without a note" },
      // t682 — the chain lens rides beside its semantic sibling: N and P
      // are both "dim lenses" (recede the world, keep the story at ink),
      // so the dialog seats them together.
      { keys: "P", text: "Critical path lens — dim everything the finish didn't wait on" },
      { keys: "Delete", text: "Delete the selection (asks first)" },
      { keys: "⇧ Click", text: "Toggle a card in the selection" },
      { keys: "⇧ Drag", text: "Box-select on empty canvas" },
    ],
  },
  {
    id: "dashboard",
    label: "Project dashboard",
    scope: "dashboard",
    rows: [
      { keys: "1–4", text: "Grid filter — all · running · completed · failed" },
      { keys: "5", text: "Jobs filter — noted (annotated) jobs only" },
      { keys: "6", text: "Jobs filter — unassigned orphans only" },
      // t641: the search lens footer (t637) hints these contextually, but
      // the dialog is the single discoverable surface — a live key with
      // no row is a drift (t248's law).
      { keys: "↑↓ ↵ Esc", text: "Search lens — walk the results, open the highlighted job, dismiss" },
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
      { keys: "← →", text: "Step rounds inside the enlarged class sheet" },
    ],
  },
  {
    // t777 — the results Maps & images grid joins the spatial contract
    // (canvas cards t775, class gallery's roving). A results round can
    // hold dozens of tiles; the arrows are how the eye moves. Same law:
    // one tab stop, arrows move, Enter/Space keep the monopoly on acting.
    id: "results-gallery",
    label: "Results gallery",
    hint: "Maps & images tiles — same roving focus as the class grid",
    rows: [
      { keys: "← → ↑ ↓", text: "Walk the map / image tiles geometrically" },
      { keys: "Home End", text: "Jump to the first / last tile" },
      { keys: "Enter Space", text: "Enlarge the focused tile" },
    ],
  },
  {
    // t780 — the engine log's reading face became a focusable scroll
    // region and its legend hints the keys; a face no row names is
    // the t641 drift again (a live key with no row is a drift).
    id: "log-console",
    label: "Log console",
    hint: "Inside the job inspector's Log tab — reading has its own keys",
    rows: [
      { keys: "↑ ↓ PgUp PgDn", text: "Scroll the log natively once the console holds the focus (Tab reaches it)" },
      { keys: "Home End", text: "Jump to the window's head / tail — landing at the tail re-arms follow" },
    ],
  },
  {
    // t641 — the map viewer's keyboard layer was live but invisible:
    // 1–6 axis presets + 0 reset had an in-popover hint, but B (quick-save
    // bookmark) was spoken only by its own completion toast — you had to
    // press it once by accident to learn it existed. Same law as t248:
    // a live key with no row is a drift.
    id: "viewer3d",
    label: "3D map viewer",
    hint: "While the map viewer is open — the camera has its own keys",
    rows: [
      { keys: "1–6", text: "Snap to a standard axis view — zoom stays put" },
      { keys: "0", text: "Reset to the default ¾ view" },
      { keys: "B", text: "Quick-save the current camera as a bookmark" },
    ],
  },
  {
    id: "report",
    label: "Session QC report",
    hint: "Inside the report dialog — the document has its own keyboard",
    rows: [
      { keys: "← →", text: "Walk the section chips — Enter jumps to that section (the strip slides along)" },
      { keys: "Tab", text: "Walk the inventory rows — focus opens the magnifier glass, Enter opens that job's results" },
      { keys: "M", text: "Download the Markdown — paste straight into lab notes or an issue" },
      { keys: "H", text: "Download the portable HTML — a standalone document: styled tables, contents page, figures travel inside" },
      { keys: "⌘/Ctrl P", text: "Prints the report itself — the one dialog that becomes paper" },
    ],
  },
  {
    id: "path-browser",
    label: "Path browser",
    hint: "Inside the file/folder picker — walk a 20,000-row listing without the mouse",
    rows: [
      { keys: "↑ ↓", text: "Move the listing's cursor — ArrowDown lands on row 0, ArrowUp on the last row" },
      { keys: "Home End", text: "Jump the cursor to the first / last row — the windowed list scrolls to keep it visible" },
      { keys: "Enter Space", text: "Open the cursor folder · pick or toggle the cursor file (read-only rows stay silent)" },
    ],
  },
  {
    id: "touch",
    label: "Touch & pointer",
    rows: [
      { keys: "Long-press", text: "Hold empty canvas, then drag to box-select" },
      { keys: "Pinch", text: "Two fingers to zoom · trackpad pinch / ctrl-scroll" },
      { keys: "Right-click", text: "Quick-action menu on a card (run · duplicate · delete …)" },
      { keys: "Menu ⇧F10", text: "The keyboard's right-click — the focused card's menu, or the canvas menu when the canvas holds the focus (since t783)" },
    ],
  },
];

/** split "⌘/Ctrl K" into ["⌘/Ctrl", "K"] chips (combo atoms are space-free).
 *  t532 — exemption rows may have NO keys field by design (the AI/storage/
 *  knock doors are exempt precisely because no keyboard path reaches them);
 *  a missing keys used to crash the WHOLE app shell here (undefined.split —
 *  the client-side exception t532's dance #4 live-caught via t246's honest
 *  FAIL). Empty chips now render the honest "no keyboard path" marker. */
const toChips = (keys?: string) => (keys ?? "").split(" ").filter(Boolean);

export function ShortcutsDialog() {
  const open = useWorkflowStore((s) => s.shortcutsOpen);
  const setOpen = useWorkflowStore((s) => s.setShortcutsOpen);
  const view = useWorkflowStore((s) => s.view);
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
                (r.keys ?? "").toLowerCase().includes(q) ||
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

        {/* t802 — the shortcuts list gains the tab stop. A spans-only
            region (dl/dd rows + Kbd chips, zero buttons in the file — the
            t801 note-hover-card shape at dialog scale): below the filter
            input the keyboard had NOTHING to reach with, and on a short
            viewport the inventory overflows the region unread. The roster's
            dialect verbatim (tabIndex + role=region + honest name + visible
            ring, ring-inset edge-to-edge); the filter keeps its own stop
            ahead of it, so Tab walks input -> list. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Keyboard shortcut inventory — grouped by context"
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
        >
          {groups.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No shortcut matches “{query}”.
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => {
                const current = g.scope != null && g.scope === view;
                return (
                  <section
                    key={g.id}
                    aria-label={`${g.label} shortcuts`}
                    data-current-view={current ? "true" : undefined}
                    className={cn(
                      // "you are here" — a quiet ring + tint, not a takeover:
                      // the group still reads as part of the same list, it
                      // just answers "which of these work right now" first
                      "rounded-lg transition-colors duration-200",
                      current
                        ? "border border-primary/25 bg-primary/[0.045] px-2.5 py-2.5"
                        : "border border-transparent"
                    )}
                  >
                    <p
                      className={cn(
                        "flex items-center text-[10px] font-semibold uppercase tracking-[0.14em]",
                        current ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {g.label}
                      {current && (
                        <span
                          className="ml-auto flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-primary"
                          aria-hidden="true"
                        >
                          <span className="size-1 rounded-full bg-primary" />
                          current view
                        </span>
                      )}
                    </p>
                    {g.hint && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">{g.hint}</p>
                    )}
                    <dl className="mt-2 space-y-1.5">
                      {g.rows.map((r) => (
                        <div
                          key={r.keys ?? r.text}
                          className="flex items-center justify-between gap-4 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/50"
                        >
                          <dd className="text-xs leading-relaxed text-muted-foreground">
                            {r.text}
                          </dd>
                          <dt className="flex shrink-0 items-center gap-1">
                            {toChips(r.keys).length > 0 ? (
                              toChips(r.keys).map((chip, i) => (
                                <Kbd
                                  key={i}
                                  className={cn(
                                    "px-1.5 py-0.5 text-[10px]",
                                    current
                                      ? "border-primary/40 bg-primary/10 text-primary"
                                      : "bg-muted text-foreground/80"
                                  )}
                                >
                                  {chip}
                                </Kbd>
                              ))
                            ) : (
                              <span className="text-[10px] italic text-muted-foreground/70">no keyboard path</span>
                            )}
                          </dt>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <p className="shrink-0 border-t px-5 py-2.5 text-[10px] text-muted-foreground/80">
          Press <Kbd>?</Kbd>{" "}
          anywhere to reopen · Escape closes one layer
        </p>
      </DialogContent>
    </Dialog>
  );
}
