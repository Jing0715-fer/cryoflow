"use client";

/**
 * t1133 — the world health board: the footer's three numbers learn a
 * MEMORY and the engine's vitals learn a FACE.
 *
 * Provenance laws this file binds (and the unit pins):
 *   • ONE father         — every derived word comes from lib/world-vitals
 *                          (vitals, snapshots, bars, rows, ledger text,
 *                          age words). This file formats nothing itself.
 *   • the footer's own   — the board counts the SAME numbers the footer
 *     dialect              counts: useActiveWorkspaceJobs() (scoped) +
 *                          s.edges (unscoped). A board that disagreed
 *                          with the footer beside it would be a lie
 *                          with a dialog.
 *   • NO listeners       — sampling rides the store's own render wave
 *                          (the hooks the footer already pays for). No
 *                          window listeners, no store subscriptions:
 *                          the stale-listener law (t1131/t1132) is held
 *                          by ABSENCE — a closure cannot go stale when
 *                          there is no closure.
 *   • transitions, not   — the ledger writes only real changes
 *     heartbeats           (appendWorldSnapshot dedupes unchanged
 *                          worlds and returns the SAME reference, so
 *                          poll ticks and hover storms cost nothing).
 *   • honest faces       — flat timeline says "no movement yet"; a
 *                          not-yet-arrived engine status says so; zeros
 *                          that are good news still speak.
 *   • the copy chip law  — three-state flip ⧉/✓/⚠, the 1600ms breath,
 *                          the double guard, the unmount/open retirement,
 *                          refusals collapsed into one honest false.
 *   • zero raw buttons   — trigger + copy + download ride the shadcn
 *                          <Button> base (the t1123 mint table untouched).
 *
 * t1139 — the transition inspector + the ledger's download door: the
 * strip takes focus (the t1138 mirror's sixth application) and walks
 * the transitions — ← → step, Home/End jump, Escape leaves; the readout
 * speaks what MOVED at each step (transitionWords — only the movers
 * speak), hover mirrors the same readout on the pointer's channel, ONE
 * readout for both hands. The export chip exists only when the ledger
 * has a story (the honest-empty law) and rides the SAME versioned
 * envelope the tab's memory writes (one father) through the ONE
 * download father (the t191 law) under the family's stamp grammar.
 *
 * t1140 — the jobs' own health face: the last failure NAMED (the
 * failures row counts; this row names who, in the run's own first
 * words, and when), the oldest running job's age, the queue's oldest
 * wait — facts, not verdicts: a row exists only when its fact exists
 * (silence is the honest absence). The ages ride the SAME tick and the
 * ONE duration father (worldAgeWords) — no second clock, no second
 * formatter. The list renders only when it has rows.
 */

import * as React from "react";
import { Activity, AlertTriangle, Check, ClipboardCopy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useActiveWorkspaceJobs, useWorkflowStore } from "@/lib/store";
import {
  appendWorldSnapshot,
  clockWordsOf,
  readWorldLedgerTiers,
  snapshotOf,
  transitionWords,
  worldAgeWords,
  worldHealthRows,
  worldJobRows,
  worldLedgerFilename,
  worldLedgerJson,
  worldLedgerText,
  worldTimelineBars,
  worldVitalsOf,
  writeWorldLedgerTiers,
  type WorldSnapshot,
} from "@/lib/world-vitals";
import { STATUS_CHIP } from "@/lib/status-style"; // the world's own vocabulary, borrowed not reinvented
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import { copyTextToClipboard } from "@/lib/chart-export";
import { downloadText } from "@/lib/download"; // t1139 — the export door rides the ONE download father (the t191 law)

/** The ⧉ chip's breath (the t1132 law's number, spoken once here). */
const COPY_BREATH_MS = 1600;

/** The board's five status words in the footer census's speaking order. */
const VITAL_ORDER: { value: JobStatus; label: string }[] = [
  { value: "running", label: "running" },
  { value: "completed", label: "completed" },
  { value: "failed", label: "failed" },
  { value: "pending", label: "pending" },
  { value: "idle", label: "idle" },
];

type CopyFace = "idle" | "copied" | "refused";

export function WorldHealthBoard() {
  const [open, setOpen] = React.useState(false);
  const [history, setHistory] = React.useState<WorldSnapshot[]>([]);
  const [copyFace, setCopyFace] = React.useState<CopyFace>("idle");
  // t1139 — the transition inspector's two hands: the walk (keyboard,
  // sticky) and the hover (pointer, momentary). ONE readout renders
  // `hover ?? walk` — a second readout would be a second truth.
  const [walkIdx, setWalkIdx] = React.useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const copyTimer = React.useRef<number | null>(null);
  const copyBusy = React.useRef(false);
  // The restore's receipt: the write door stays shut until the restore
  // pass has run — an empty pre-restore state must never clobber the
  // tab's memory before the previous session's story lands.
  const restoredRef = React.useRef(false);

  // The ledger's RESTORE: the previous session's story enters before the
  // world's first read can append to it (declaration order IS the race
  // law — this effect runs before the commit effect below, so a restored
  // tail equal to the live world dedupes to NO transition: the t1132
  // phantom 0→N cure, now across sessions). t1141 — the restore reads
  // the TWO tiers through the lib's one father: the tab's own story
  // (sessionStorage) wins; the machine's story (localStorage — it
  // outlives the tab) fills an empty tab. The mount effect never runs on
  // the server; the null-store caller is the SSR face.
  React.useEffect(() => {
    const session = typeof window !== "undefined" ? window.sessionStorage : null;
    const local = typeof window !== "undefined" ? window.localStorage : null;
    const restored = readWorldLedgerTiers(session, local);
    restoredRef.current = true;
    if (restored.rows.length > 0) setHistory(restored.rows);
  }, []);

  // The SAME numbers the footer counts — one truth, no re-derivation.
  const jobs = useActiveWorkspaceJobs();
  const edges = useWorkflowStore((s) => s.edges);
  const project = useWorkflowStore((s) => s.project);
  const system = useWorkflowStore((s) => s.system);
  const jobsVersion = useWorkflowStore((s) => s.jobsVersion);
  // The world's READ receipt: null until load()/pollTick land their first
  // full ingest. Before it, the store's jobs array is the pre-hydration
  // phantom — the t1132 first-screen lesson (a footer read too early
  // sees 0 jobs) — and a ledger seeded on the phantom records a fake
  // 0→N transition on EVERY page load. The seed waits for the read.

  // Pure render: the full vitals census; the snapshot projects the five
  // health-bearing numbers. The stamp lands at commit time (the reducer
  // ignores t when deduping, so the stamp is the ledger's word, not the
  // render's).
  const vitals = React.useMemo(() => worldVitalsOf(jobs, edges), [jobs, edges]);
  const world = React.useMemo(() => snapshotOf(vitals, 0), [vitals]);

  // The ledger's commit: append on every world change; unchanged worlds
  // return the SAME array (identity-stable — no re-render, no growth).
  // Seeding IS appending to an empty ledger — one door, one reducer —
  // but the door opens only after the world's first READ (the gate
  // above): an empty ledger before that is "reading the world…", not
  // "a world of zero jobs".
  React.useEffect(() => {
    if (jobsVersion === null) return;
    setHistory((h) => appendWorldSnapshot(h, { ...world, t: Date.now() }));
  }, [world, jobsVersion]);

  // The ledger's PERSIST: the write rides an effect (never render — the
  // #13 law), only after the restore pass (restoredRef above), and an
  // empty ledger is never written (absence is the storage's honest face).
  // t1141 — the write goes THROUGH both tiers (the tab's memory and the
  // machine's memory get byte-equal envelopes through the ONE writer);
  // each tier keeps its own receipt and a refusal degrades that tier
  // alone — the write's false receipt — quota, privacy mode — degrades
  // to the memory-only ledger this board already is.
  React.useEffect(() => {
    if (!restoredRef.current || history.length === 0) return;
    const session = typeof window !== "undefined" ? window.sessionStorage : null;
    const local = typeof window !== "undefined" ? window.localStorage : null;
    writeWorldLedgerTiers(session, local, history);
  }, [history]);

  // The breath's retirement: the flip resets when the dialog closes and
  // the timer dies on unmount — a stale ✓ must outlive neither its
  // dialog nor its component. The inspector's walk and hover ride the
  // same retirement — a walk that survives its dialog is a ghost hand.
  React.useEffect(() => {
    if (open) return;
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
      copyTimer.current = null;
    }
    copyBusy.current = false;
    setCopyFace("idle");
    setWalkIdx(null);
    setHoverIdx(null);
  }, [open]);
  React.useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const rows = React.useMemo(() => worldHealthRows(vitals, system), [vitals, system]);
  const layout = React.useMemo(() => worldTimelineBars(history), [history]);

  const lastT = history.length > 0 ? history[history.length - 1].t : null;
  // The age ticker exists only while the dialog is open AND the world
  // has movement to age — an idle world pays zero timers (the useNow
  // doctrine). BOTH age words ride the same tick — a readout that
  // freezes mid-breath cannot be told apart from a hung one. t1140: the
  // jobs' own ages (the oldest running, the oldest waiting) ride the
  // SAME tick — a second clock would be a drift (the one-clock law).
  const hasAgeableJobs = vitals.running > 0 || vitals.pending > 0;
  const now = useNow(open && ((lastT !== null && history.length > 1) || hasAgeableJobs));
  const ageWords = lastT !== null && now > 0 ? worldAgeWords(now - lastT) : null;
  const oldestWords = history.length > 1 && now > 0 ? worldAgeWords(now - history[0].t) : null;

  // t1140 — the jobs' own facts (the last failure NAMED, the oldest
  // running's age, the queue's oldest wait): the SAME now both faces
  // ride, the ONE father supplies every word.
  const jobRows = React.useMemo(() => worldJobRows(jobs, now), [jobs, now]);

  const onCopy = async () => {
    if (copyBusy.current) return; // the double guard: a flip mid-breath refuses
    copyBusy.current = true;
    const ok = await copyTextToClipboard(worldLedgerText(history));
    setCopyFace(ok ? "copied" : "refused");
    copyTimer.current = window.setTimeout(() => {
      copyTimer.current = null;
      copyBusy.current = false;
      setCopyFace("idle");
    }, COPY_BREATH_MS);
  };

  // t1139 — the inspector's read-side clamp: the ledger only grows (and
  // slides at the cap), so a walk index can point past the tail — the
  // clamp is a READ guard, never a render-time state write (the #13 law).
  const activeIdx =
    hoverIdx != null && hoverIdx < history.length
      ? hoverIdx
      : walkIdx != null && walkIdx < history.length
        ? walkIdx
        : null;
  const readoutWords =
    activeIdx != null
      ? `${clockWordsOf(history[activeIdx].t)} · ${transitionWords(activeIdx > 0 ? history[activeIdx - 1] : null, history[activeIdx])}`
      : null;

  // The timeline's keyboard mirror (the t1138 family shape): the group
  // takes focus and walks the transitions — the first arrow lands on the
  // NEWEST transition (the walk-current law's "you are here"), ← walks
  // older, → walks newer, Home/End jump, Escape leaves. The gate is the
  // family's gatekeeper (no ctrl/meta/alt — t908's B7); every handled
  // key preventDefaults (the B5 law); unhandled keys return bare. The
  // wire is ELEMENT-level — no raw window keydown (the t908 C1 law).
  const onTimelineKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = history.length;
    if (n === 0) return;
    let next: number | null;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = activeIdx == null ? n - 1 : Math.max(0, activeIdx - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = activeIdx == null ? n - 1 : Math.min(n - 1, activeIdx + 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      case "Escape":
        next = null;
        break;
      default:
        return; // unhandled keys stay bare — the wrapper is not a key prison
    }
    e.preventDefault();
    setWalkIdx(next);
  };

  // The download door: the SAME envelope the tab's memory writes (one
  // father), the family's stamp grammar, the ONE download father (the
  // t191 law — never re-derive the anchor dance). Fire-and-honest: the
  // browser owns the receipt, so no flip face is invented here.
  const onDownload = () => {
    downloadText(worldLedgerFilename(), worldLedgerJson(history), "application/json");
  };

  const ariaSummary =
    history.length > 1
      ? `World timeline: ${history.length - 1} transition${history.length - 1 === 1 ? "" : "s"} recorded, from ${history[0].jobs} to ${history[history.length - 1].jobs} jobs`
      : "World timeline: no transitions recorded yet";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="world-health-trigger"
          aria-label="Open the world health board — the footer's numbers over time and the engine's vitals"
          title="World health board — the footer's three numbers, remembered; the engine's vitals, judged"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Activity aria-hidden="true" className="size-3.5" />
          <span className="hidden md:inline">health</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        data-testid="world-health-dialog"
        className="sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>World health</DialogTitle>
          <DialogDescription>
            The footer&apos;s three numbers, remembered as real transitions — and the
            engine&apos;s vitals, judged in place. This board counts exactly what the
            footer counts: {vitals.jobs} job{vitals.jobs === 1 ? "" : "s"} ·{" "}
            {vitals.edges} edge{vitals.edges === 1 ? "" : "s"}
            {project ? ` · ${project.name}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {/* ---- the vitals: all five words speak, zeros included — a
             health board that hides its clean bills is a board nobody
             trusts (the census's presence-derived law is for FILTERS,
             not for dashboards). ---- */}
        <div
          data-testid="world-health-vitals"
          role="group"
          aria-label="Job status vitals — every status word with its count, zeros included"
          className="flex flex-wrap items-center gap-1.5"
        >
          {VITAL_ORDER.map(({ value, label }) => {
            const count = vitals[value];
            const chip = STATUS_CHIP[value];
            return (
              <span
                key={value}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs tabular-nums",
                  count > 0 ? chip.active : "border-border/60 text-muted-foreground/70",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", chip.dot, count === 0 && "opacity-40")}
                />
                {count}
                <span>{label}</span>
              </span>
            );
          })}
        </div>

        {/* ---- the verdicts ---- */}
        <ul
          data-testid="world-health-rows"
          className="grid gap-1.5 rounded-md border bg-muted/30 p-2.5 text-xs"
          aria-label="Engine and pipeline health verdicts"
        >
          {rows.map((r) => (
            <li key={r.key} className="flex items-start gap-2">
              {r.ok ? (
                <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success-500" />
              ) : (
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-warning-500"
                />
              )}
              <span>
                <span className="font-medium text-foreground">{r.label}</span>
                <span className="text-muted-foreground"> — {r.detail}</span>
              </span>
              <span className="sr-only">{r.ok ? " (all clear)" : " (needs attention)"}</span>
            </li>
          ))}
        </ul>

        {/* ---- the jobs' own facts (t1140): the last failure NAMED, the
             oldest running's age, the queue's oldest wait — a row exists
             only when its fact exists (silence is the honest absence). ---- */}
        {jobRows.length > 0 && (
          <ul
            data-testid="world-health-job-rows"
            className="grid gap-1.5 rounded-md border bg-muted/30 p-2.5 text-xs"
            aria-label="Job health facts — the last failure named, the oldest running job's age, the queue's oldest wait"
          >
            {jobRows.map((r) => (
              <li key={r.key} className="flex items-start gap-2">
                {r.ok ? (
                  <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success-500" />
                ) : (
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-warning-500"
                  />
                )}
                <span>
                  <span className="font-medium text-foreground">{r.label}</span>
                  <span className="text-muted-foreground"> — {r.detail}</span>
                </span>
                <span className="sr-only">{r.ok ? " (all clear)" : " (needs attention)"}</span>
              </li>
            ))}
          </ul>
        )}

        {/* ---- the timeline: bars colored by the world's own state at
             each transition — danger when failures stood, running ink
             while work moved, success when all clear. The strip takes
             focus (t1139): the keyboard mirror walks the transitions and
             the readout speaks what moved — hover mirrors the same
             readout on the pointer's own channel. ---- */}
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span aria-hidden="true">transitions since this page loaded</span>
            <span data-testid="world-health-age" className="tabular-nums">
              {history.length > 1 && ageWords ? `last movement ${ageWords} ago` : history.length > 0 ? "one world, no movement yet" : "reading the world…"}
            </span>
          </div>
          {layout.flat ? (
            <div
              data-testid="world-health-timeline-flat"
              className="grid h-14 place-items-center rounded-md border border-dashed text-xs text-muted-foreground"
            >
              no transitions yet — create a job, flip a status, or draw an edge and the
              timeline starts writing
            </div>
          ) : (
            <div
              data-testid="world-health-timeline-group"
              role="group"
              tabIndex={0}
              aria-label="The transition strip — focus it and walk the ledger with the arrow keys; Home and End jump, Escape leaves. Each step speaks what moved."
              onKeyDown={onTimelineKeyDown}
              className="rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onPointerLeave={() => setHoverIdx(null)}
            >
              <svg
                data-testid="world-health-timeline"
                viewBox="0 0 100 28"
                preserveAspectRatio="none"
                role="img"
                aria-label={ariaSummary}
                className="h-14 w-full rounded-md border bg-muted/20"
              >
                <line x1="0" y1="27.5" x2="100" y2="27.5" className="stroke-border" strokeWidth="0.5" />
                {layout.bars.map((b, i) => {
                  const s = history[i];
                  const ink =
                    s.failed > 0
                      ? "fill-danger-500/80"
                      : s.running > 0
                        ? "fill-running-500/80"
                        : "fill-success-500/60";
                  return (
                    <rect
                      key={s.t + "-" + i}
                      x={b.x}
                      y={28 - b.h}
                      width={b.w}
                      height={b.h}
                      shapeRendering="crispEdges"
                      className={ink}
                      onPointerEnter={() => setHoverIdx(i)}
                    >
                      <title>{b.title}</title>
                    </rect>
                  );
                })}
                {activeIdx != null && layout.bars[activeIdx] && (
                  <rect
                    data-testid="world-health-timeline-marker"
                    x={layout.bars[activeIdx].x - 0.75}
                    y={28 - layout.bars[activeIdx].h - 0.75}
                    width={layout.bars[activeIdx].w + 1.5}
                    height={layout.bars[activeIdx].h + 0.75}
                    fill="none"
                    shapeRendering="crispEdges"
                    className="stroke-foreground"
                    strokeWidth="0.75"
                    pointerEvents="none"
                  />
                )}
              </svg>
            </div>
          )}
          <p
            data-testid="world-health-transition-readout"
            aria-live="polite"
            className={cn(
              "min-h-4 text-xs tabular-nums",
              readoutWords ? "text-foreground" : "text-muted-foreground/70",
            )}
          >
            {readoutWords ??
              (history.length > 1
                ? "focus the strip and walk with ← → — each step speaks what moved; hover reads the same words"
                : history.length === 1
                  ? "one world in the ledger — a second makes a transition to walk"
                  : "reading the world…")}
          </p>
        </div>

        {/* ---- the copy chip (the ⧉ law's second sibling) + the ledger's
             download door (t1139): the export chip exists only when the
             ledger has a story — an empty ledger's export door does not
             exist rather than existing and lying (the honest-empty law). ---- */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {history.length} sample{history.length === 1 ? "" : "s"} in the ledger
            {oldestWords ? ` · oldest ${oldestWords} ago` : ""}
          </p>
          <div className="flex items-center gap-1.5">
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                data-testid="world-health-download"
                onClick={onDownload}
                aria-label="Download the world ledger as JSON — the same versioned envelope the tab's memory writes"
                title="Export ledger (JSON) — the tab's memory, ready for a script"
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <Download aria-hidden="true" className="size-3.5" />
                Export ledger
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              data-testid="world-health-copy"
              onClick={onCopy}
              className={cn(
                "h-7 gap-1.5 px-2 text-xs",
                copyFace === "copied" && "border-success/60 text-success-600 dark:text-success-400",
                copyFace === "refused" && "border-warning/60 text-warning-600 dark:text-warning-400",
              )}
            >
              {copyFace === "idle" && (
                <>
                  <ClipboardCopy aria-hidden="true" className="size-3.5" />
                  Copy ledger
                </>
              )}
              {copyFace === "copied" && (
                <>
                  <Check aria-hidden="true" className="size-3.5" />
                  Ledger copied
                </>
              )}
              {copyFace === "refused" && (
                <>
                  <AlertTriangle aria-hidden="true" className="size-3.5" />
                  Clipboard refused
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
