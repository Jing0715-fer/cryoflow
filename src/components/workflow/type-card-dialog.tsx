"use client";

/**
 * CryoFlow — the type card (Task 730): a dictionary page for a job TYPE.
 *
 * Seven windows of search-dialect work taught six surfaces to answer
 * "which job"; this card answers the other half of knowing a type —
 * "what IS this job, where does its data come from, where should it go
 * next, and what can I tune". The knowledge for all four answers already
 * lives in the lib as single sources; this card is their first dedicated
 * READING surface (not another editor, not the AI's private tool):
 *
 *   • what     — the spec's own `description` (verbatim, the same string
 *     the palette shows) plus the key/category/tier badges;
 *   • where from — `upstreamOf` (t730, lib/workflow.ts): the FULL
 *     port-compatibility directory derived live from portsCompatible —
 *     there is no upstream canon and this card must not invent one;
 *   • where next — `nextStepsFor` (t384): the curated RELION pipeline
 *     order, the same list the card context menu offers;
 *   • what to tune — the spec's ParamSchema list, grouped by the RELION
 *     GUI tab (tabsFor order), every `hint` fully shown: the hints are
 *     the lib's richest prose and until this card they were only
 *     readable inside an inspector of a job you already added.
 *
 * The two radii are two kinds of truth and stay labelled as such: the
 * upstream section says "derived live from the ports themselves", the
 * downstream section says "the curated RELION pipeline order" — the
 * two-honest-numbers law (t729) applied to provenance instead of counts.
 *
 * Honesty contracts:
 *   • Import's upstream is EMPTY and the card says the sentence out loud
 *     ("front door") — an empty chip row would read as a bug, a silent
 *     row as decoration;
 *   • terminal types (postprocess, localres, modelangelo) have no
 *     curated next steps and say so for the same reason;
 *   • chips navigate (click a feeder → the card becomes THAT type) so
 *     the dictionary is a graph you can walk, not pages you page through;
 *   • zero fetch, zero storage: every byte here is synchronous lib data.
 *     A dictionary that needs the network to define a word is not a
 *     dictionary, it's a search box with pretensions.
 *
 * No appearance animation: the card opens by the dialog's own focus
 * discipline and its content swaps are plain re-renders — states, not
 * arrivals (motion-reduce safe by construction, the badge family's law).
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkflowStore } from "@/lib/store";
import {
  jobType,
  nextStepsFor,
  drinkKindsOf,
  outputKindOf,
  PORT_COLORS,
  pourKindsOf,
  tabsFor,
  upstreamOf,
} from "@/lib/workflow";
import type { ParamSchema } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcon } from "./icons";
import { TierBadge } from "./tier-badge"; // t732 — the tier language's own home

/** The provenance label under the upstream heading — the radius tag. */
export const UPSTREAM_RADIUS_LABEL = "derived live from the ports themselves";

/** The provenance label under the downstream heading — the radius tag. */
export const DOWNSTREAM_RADIUS_LABEL = "the curated RELION pipeline order";

/** Import's honest upstream sentence — the front door speaks for itself. */
export const UPSTREAM_EMPTY_SENTENCE =
  "This is the pipeline's front door — nothing feeds it, every workflow starts here.";

/** A terminal type's honest downstream sentence. */
export const DOWNSTREAM_EMPTY_SENTENCE =
  "Terminal — nothing in the curated canon consumes this output.";

/**
 * Display form of a ParamSchema's default — the DICTIONARY's face, not a
 * job's live value (t728's two-honest-layers law: the schema default and
 * an instance's current value are different truths; this one is the
 * schema's). Paths default to the em dash when the spec ships no default.
 */
function formatDefault(p: ParamSchema): string {
  if (p.type === "bool") return p.default ? "Yes" : "No";
  if (p.type === "path") {
    return typeof p.default === "string" && p.default.length > 0 ? p.default : "—";
  }
  if (p.type === "number" && typeof p.default === "number") {
    return `${p.default}${p.unit ? ` ${p.unit}` : ""}`;
  }
  if (p.type === "select" || p.type === "text") {
    const raw = p.default;
    return raw === "" || raw == null ? "—" : String(raw);
  }
  const raw = p.default;
  return raw === "" || raw == null ? "—" : String(raw);
}

/**
 * t735 — the chip's kind sample: the same hex the canvas wire rests in
 * (PORT_COLORS[kind].wire via the book's own outputKindOf), or null
 * when the book is silent (unknown type/port — the chip keeps its
 * two-part voice, icon + mono pair, no sample).
 */
function chipInk(typeKey: string, fromPort: string): string | null {
  const kind = outputKindOf(typeKey, fromPort);
  return kind ? PORT_COLORS[kind].wire : null;
}

export function TypeCardDialog({
  typeKey,
  open,
  onOpenChange,
  onNavigate,
  onAdded,
}: {
  /** The type the card currently defines (null → nothing renders). */
  typeKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chip navigation: open another type's card in place. */
  onNavigate: (key: string) => void;
  /** Fired after "Add to canvas" succeeds — same mouth the palette row uses. */
  onAdded?: () => void;
}) {
  const spec = typeKey ? jobType(typeKey) : undefined;
  const addJob = useWorkflowStore((s) => s.addJob);
  const [adding, setAdding] = React.useState(false);
  const onAddedRef = React.useRef(onAdded);
  React.useEffect(() => {
    onAddedRef.current = onAdded;
  }, [onAdded]);

  // Reset the busy flag whenever the card changes subject — a failed or
  // finished add on one type must not leak a spinner into the next card.
  React.useEffect(() => {
    setAdding(false);
  }, [typeKey]);

  const upstream = React.useMemo(
    () => (spec ? upstreamOf(spec.key) : []),
    [spec]
  );
  const downstream = React.useMemo(
    () => (spec ? nextStepsFor(spec.key) : []),
    [spec]
  );

  // t746 — the water row's two radii, asked through the lib's own named
  // questions (pourKindsOf / drinkKindsOf): pours ride the output ports'
  // kind (the water's certainty), drinks ride the input sockets' capacity
  // (t738's socket semantics). The card reads the book's answers — it
  // does no port arithmetic itself (the t730 law); the wildcard-is-not-
  // a-kind and key-order rules live in the lib home too.
  const pourKinds = React.useMemo(() => (spec ? pourKindsOf(spec.key) : []), [spec]);
  const drinkKinds = React.useMemo(() => (spec ? drinkKindsOf(spec.key) : []), [spec]);

  // Parameter groups: tabsFor gives the RELION GUI order; params that
  // name no tab land in "Additional" (the spec's own default, per
  // ParamSchema.tab's contract) — appended after the named tabs so the
  // expert tail never interrupts the canonical reading order.
  const paramGroups = React.useMemo(() => {
    if (!spec) return [];
    const tabOf = (p: ParamSchema) => p.tab ?? "Additional";
    const names = [...tabsFor(spec)];
    for (const p of spec.params) {
      if (!names.includes(tabOf(p))) names.push(tabOf(p));
    }
    return names
      .map((name) => ({
        name,
        params: spec.params.filter((p) => tabOf(p) === name),
      }))
      .filter((g) => g.params.length > 0);
  }, [spec]);

  if (!spec) return null;

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addJob(spec.key);
      onAddedRef.current?.();
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="type-card"
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle
            className="flex items-center gap-2.5 pr-6 text-base"
            data-testid="type-card-title"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                spec.color.soft,
                spec.color.border
              )}
              aria-hidden="true"
            >
              <TypeIcon name={spec.icon} className="size-4" />
            </span>
            <span className="min-w-0 truncate">{spec.label}</span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span
                className="rounded bg-muted px-1.5 py-px font-mono text-[10px] text-muted-foreground"
                data-testid="type-card-key"
              >
                {spec.key}
              </span>
              <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                {spec.category}
              </span>
              {/* t732 — the tier language moved to tier-badge.tsx: same
                  hue words, one home (the full face: whole word + title). */}
              <TierBadge tier={spec.tier} testid="type-card-tier" />
              <span className="text-[10px] text-muted-foreground">
                {spec.inputs.length} in · {spec.outputs.length} out
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* t804 — the content-node census's house cure, live-witnessed on the
            frozen world (t804-typecard-frozen.png): 1353px of dictionary page
            in a 488px window, Radix's modal tabIndex=-1 on the content node,
            exactly FIVE tabbables (three downstream chips + Add + Close) —
            the description, the water row, the upstream sentence and the
            whole PARAMETER REFERENCE (the hints are the lib's richest prose
            and this card's reason to exist) were keyboard-unreachable scroll
            between the chips and the footer. The house shape hands the scroll
            to this inner region — tabIndex + role=region + its own name + the
            family's inset ring (edge-to-edge; an outward ring would clip);
            role=dialog stays (t799's law, third home); the footer pins with a
            border-t so the verb never scrolls away; space-y-4 keeps the old
            grid gap-4 rhythm. The upstream side is Import's honest front door
            (empty and saying so) — the census judged, not touched. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Type card dictionary — description, water, upstream, downstream, parameters"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
        >
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {spec.description}
        </p>

        {/* t746 — the water row: the dictionary page's ingredient line.
            The counts in the header say how many doors the type has; this
            row says what water crosses them. Dots ride the same wire hex
            the canvas rests in (PORT_COLORS[k].wire — the t735 sample,
            now at the card's face); words ride the book's own names. */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"
          data-testid="type-card-water"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">drinks</span>
            {drinkKinds.length > 0 ? (
              drinkKinds.map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ background: PORT_COLORS[k].wire }}
                  />
                  {k}
                </span>
              ))
            ) : spec.inputs.length === 0 ? (
              <span data-testid="type-card-water-nothing">nothing</span>
            ) : (
              <span data-testid="type-card-water-anything">anything</span>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">pours</span>
            {pourKinds.map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ background: PORT_COLORS[k].wire }}
                />
                {k}
              </span>
            ))}
          </span>
        </div>

        {/* ------------------------------------------------ upstream —
            the LIVE directory (upstreamOf). Every feeder is a clickable
            chip: the dictionary is a walkable graph. The port pair rides
            in the chip as mono text so the why of the compatibility is
            readable without a hover. */}
        <section
          aria-label="Job types that can feed this one"
          data-testid="type-card-upstream"
          className="rounded-lg border bg-muted/30 px-3 py-2.5"
        >
          <h3 className="text-[13px] font-semibold tracking-tight">
            Feeds this job
            <span className="ml-1.5 font-normal text-[11px] text-muted-foreground">
              {UPSTREAM_RADIUS_LABEL}
            </span>
          </h3>
          {upstream.length === 0 ? (
            <p
              className="mt-1.5 text-[12px] leading-snug text-muted-foreground"
              data-testid="type-card-upstream-empty"
            >
              {UPSTREAM_EMPTY_SENTENCE}
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {upstream.map((u) => (
                <li key={`${u.type}:${u.fromPort}:${u.toPort}`}>
                  <button
                    type="button"
                    data-testid={`type-card-upstream-chip-${u.type}`}
                    title={`${u.fromPort} → ${u.toPort}${chipInk(u.type, u.fromPort) ? ` — ${outputKindOf(u.type, u.fromPort)} data` : ""} — click to open ${u.label}`}
                    onClick={() => onNavigate(u.type)}
                    className={cn(
                      "flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-[11px] transition-colors hover:bg-accent",
                      u.type === spec.key && "border-dashed"
                    )}
                  >
                    <TypeIcon name={u.icon} className="size-3 shrink-0" />
                    <span className="truncate font-medium">{u.label}</span>
                    {/* t735 — the kind's color sample rides the port pair:
                        the same hex the canvas wire rests in (t734), so the
                        chip teaches what the wire says — hand-off data has
                        a color and the color has a word */}
                    {chipInk(u.type, u.fromPort) ? (
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: chipInk(u.type, u.fromPort) as string }}
                      />
                    ) : null}
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                      {u.fromPort}→{u.toPort}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------- downstream —
            the CURATED canon (nextStepsFor). Same chip grammar, labelled
            as a different radius: recommendations, not arithmetic. */}
        <section
          aria-label="Recommended next steps"
          data-testid="type-card-downstream"
          className="rounded-lg border bg-muted/30 px-3 py-2.5"
        >
          <h3 className="text-[13px] font-semibold tracking-tight">
            Recommended next steps
            <span className="ml-1.5 font-normal text-[11px] text-muted-foreground">
              {DOWNSTREAM_RADIUS_LABEL}
            </span>
          </h3>
          {downstream.length === 0 ? (
            <p
              className="mt-1.5 text-[12px] leading-snug text-muted-foreground"
              data-testid="type-card-downstream-empty"
            >
              {DOWNSTREAM_EMPTY_SENTENCE}
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {downstream.map((d) => (
                <li key={`${d.type}:${d.fromPort}:${d.toPort}`}>
                  <button
                    type="button"
                    data-testid={`type-card-downstream-chip-${d.type}`}
                    title={`${d.caption}${chipInk(spec.key, d.fromPort) ? ` — ${outputKindOf(spec.key, d.fromPort)} data` : ""} — click to open ${d.label}`}
                    onClick={() => onNavigate(d.type)}
                    className="flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-[11px] transition-colors hover:bg-accent"
                  >
                    <TypeIcon name={d.icon} className="size-3 shrink-0" />
                    <span className="truncate font-medium">{d.label}</span>
                    {/* t735 — same kind sample as the upstream chip: one
                        vocabulary, both radii (the wire into THIS type and
                        the wire out of it speak the same colors). The
                        downstream fromPort is THIS type's OWN output —
                        NextStep.fromPort reads the SOURCE side, so the
                        lookup keys on spec.key, not on the target type. */}
                    {chipInk(spec.key, d.fromPort) ? (
                      <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: chipInk(spec.key, d.fromPort) as string }}
                      />
                    ) : null}
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                      {d.caption}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --------------------------------------------- parameters —
            the full schema reference, grouped by RELION GUI tab. Every
            hint is shown in full: the dictionary is where prose finally
            gets a reading surface of its own. Advanced rows keep their
            hints and wear the ADV badge instead of hiding. */}
        <section
          aria-label="Parameter reference"
          data-testid="type-card-params"
        >
          <h3 className="text-[13px] font-semibold tracking-tight">
            Parameters
            <span className="ml-1.5 font-normal text-[11px] text-muted-foreground">
              {spec.params.length} setting{spec.params.length === 1 ? "" : "s"} ·{" "}
              {paramGroups.length} group{paramGroups.length === 1 ? "" : "s"}
            </span>
          </h3>
          <div className="mt-1.5 space-y-3">
            {paramGroups.map((g) => (
              <div
                key={g.name}
                data-testid={`type-card-tab-${g.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
              >
                <h4 className="mb-1 flex items-baseline gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {g.name}
                  <span className="font-mono text-[10px] normal-case tracking-normal">
                    {g.params.length}
                  </span>
                </h4>
                <dl className="divide-y divide-border/60">
                  {g.params.map((p) => (
                    <div
                      key={p.key}
                      data-testid={`type-card-param-${p.key}`}
                      className="grid gap-0.5 py-1.5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <dt
                          className={cn(
                            "min-w-0 text-[13px] font-medium",
                            p.advanced && "text-muted-foreground"
                          )}
                        >
                          {p.label}
                          {p.advanced && (
                            <span
                              className="ml-1.5 rounded bg-muted px-1 py-px align-middle font-mono text-[8px] uppercase tracking-wide text-muted-foreground"
                              data-testid={`type-card-param-adv-${p.key}`}
                            >
                              adv
                            </span>
                          )}
                        </dt>
                        <dd
                          className="shrink-0 font-mono text-[11px] text-muted-foreground"
                          title={`Default: ${formatDefault(p)}`}
                        >
                          {formatDefault(p)}
                        </dd>
                      </div>
                      {p.hint && (
                        <dd className="text-[11px] leading-snug text-muted-foreground">
                          {p.hint}
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={adding}
            data-testid="type-card-add"
          >
            {adding ? "Adding…" : "Add to canvas"}
          </Button>
        </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
