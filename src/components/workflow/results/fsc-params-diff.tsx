"use client";

/**
 * CryoFlow — parameter A/B diff for the FSC compare dialog.
 *
 * Two curves can only be interpreted alongside the settings that produced
 * them: a D2 refinement rescuing a resolution that C1 could not reach is a
 * *symmetry* story, and two identical postprocess runs landing 3.0 vs
 * 3.85 Å is a *data* story. This table puts each selected job's launch
 * parameters side by side so the comparison carries its own provenance.
 *
 * Row taxonomy (in display order — the interesting rows float up):
 *   changed  — at least two PROVIDED values disagree (a missing side may
 *              accompany them and renders as "—"): a D2-vs-C1 symmetry
 *              split between two refinements must not drown among the
 *              one-sided rows just because a postprocess also joined the
 *              comparison and lacks the key entirely
 *   partial  — the provided values all agree, but at least one selected
 *              job lacks the key (one-sided settings are honest
 *              differences too — a refine's `tau2Fudge` has no
 *              postprocess counterpart)
 *   same     — every job provides the key and every value agrees;
 *              collapsible via the "differences only" toggle so twelve
 *              agreeing rows don't bury the two that matter
 *
 * Colors come from the compare dialog's palette function so each column's
 * swatch matches the job's curve and legend chip exactly — a mismatched
 * swatch would quietly poison the whole comparison.
 */

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const serialize = (v: unknown): string => JSON.stringify(v) ?? "null";

/** minimal job shape every diff surface must provide */
export interface ParamDiffJob {
  jobId: string;
  name: string;
  type: string;
  params: Record<string, unknown>;
}

export type ParamDiffRowKind = "changed" | "partial" | "same";

export interface ParamDiffRow {
  key: string;
  kind: ParamDiffRowKind;
  /** per-job raw values, aligned with the jobs prop order; undefined = absent */
  values: (unknown | undefined)[];
}

/**
 * The ONE diff brain (Task 88): row classification shared by every surface
 * that compares launch parameters — the FSC dialog's provenance table, the
 * standalone compare dialog, and the inspector sibling picker's preview
 * chips. Before this lived inline in FscParamsDiff and the picker would
 * have quietly grown its own taxonomy ("1 key differs" meaning something
 * subtly different from the table's "changed" row). One brain, N readers —
 * the parseWorkflowFiles doctrine.
 */
export function classifyParamRows(jobs: ParamDiffJob[]): ParamDiffRow[] {
  const keys = new Set<string>();
  for (const j of jobs) for (const k of Object.keys(j.params)) keys.add(k);
  const out: ParamDiffRow[] = [];
  for (const key of keys) {
    const values = jobs.map((j) => j.params[key]);
    const missing = values.some((v) => v === undefined);
    const distinct = new Set(
      values.filter((v) => v !== undefined).map((v) => serialize(v))
    );
    // disagreement between PROVIDED values outranks absence: D2 vs C1 is
    // the story even when a third job doesn't set symmetry at all
    const kind: ParamDiffRowKind =
      distinct.size > 1 ? "changed" : missing ? "partial" : "same";
    out.push({ key, kind, values });
  }
  // changed rows float to the top, partial next, identical last; inside a
  // group alphabetical keeps the table scannable run over run
  const rank: Record<ParamDiffRowKind, number> = { changed: 0, partial: 1, same: 2 };
  return out.sort(
    (a, b) => rank[a.kind] - rank[b.kind] || a.key.localeCompare(b.key)
  );
}

export interface ParamDiffSummary {
  changed: number;
  partial: number;
  same: number;
  total: number;
  /** every PROVIDED value agrees AND nothing is one-sided */
  allSame: boolean;
}

/** taxonomy counts for a pair/group, computed from the shared row brain */
export function summarizeParamDiff(jobs: ParamDiffJob[]): ParamDiffSummary {
  const rows = classifyParamRows(jobs);
  const changed = rows.filter((r) => r.kind === "changed").length;
  const partial = rows.filter((r) => r.kind === "partial").length;
  const same = rows.length - changed - partial;
  return {
    changed,
    partial,
    same,
    total: rows.length,
    allSame: changed === 0 && partial === 0 && same > 0,
  };
}

/** internal aliases — FscParamsDiff predates the export names */
type DiffJob = ParamDiffJob;
type RowKind = ParamDiffRowKind;
type DiffRow = ParamDiffRow;

/** camelCase → spaced lowercase for display ("particleDiameter" →
 *  "particle diameter"); the original key stays available as the title */
function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
}

/** short mono rendering for a parameter cell */
function formatParam(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "string") return v.length > 24 ? `${v.slice(0, 23)}…` : v;
  const s = JSON.stringify(v) ?? String(v);
  return s.length > 18 ? `${s.slice(0, 17)}…` : s;
}


export function FscParamsDiff({
  jobs,
  colorOf,
}: {
  /** the selected (picked) jobs, in pick order */
  jobs: DiffJob[];
  /** jobId → curve color, shared with the overlay chart + legend chips */
  colorOf: (jobId: string) => string;
}) {
  /** differences-only view (the default — identical rows are one toggle away) */
  const [diffOnly, setDiffOnly] = useState(true);

  const rows = useMemo<DiffRow[]>(() => classifyParamRows(jobs), [jobs]);

  if (jobs.length < 2) return null;

  const changed = rows.filter((r) => r.kind === "changed").length;
  const partial = rows.filter((r) => r.kind === "partial").length;
  const same = rows.length - changed - partial;
  const visible = diffOnly ? rows.filter((r) => r.kind !== "same") : rows;
  const allSame = changed === 0 && partial === 0 && same > 0;

  return (
    <section
      data-testid="fsc-params-diff"
      aria-label="Launch parameter comparison"
      className="shrink-0 rounded-md border border-border bg-muted/20"
    >
      {/* header — taxonomy counts + the differences-only switch */}
      <div className="flex items-center gap-2 border-b border-border/70 px-2.5 py-1.5">
        <SlidersHorizontal
          className="h-3.5 w-3.5 shrink-0 text-teal-600"
          aria-hidden="true"
        />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Parameters
        </h3>
        <span
          className="rounded-full border border-muted-foreground/25 bg-background px-1.5 py-px text-[10px] font-semibold tabular-nums text-muted-foreground"
          data-testid="fsc-params-counts"
          title={`${changed} parameter(s) differ between the selected jobs, ${partial} one-sided, ${same} identical`}
        >
          {changed > 0 && <span className="text-amber-700 dark:text-amber-400">{changed} differ</span>}
          {changed > 0 && (partial > 0 || same > 0) && " · "}
          {partial > 0 && <span>{partial} one-sided</span>}
          {partial > 0 && same > 0 && " · "}
          {same > 0 && <span>{same} identical</span>}
          {rows.length === 0 && <span>no parameters recorded</span>}
        </span>
        {!allSame && rows.length > 0 && (
          <button
            type="button"
            data-testid="fsc-params-diffonly"
            aria-pressed={diffOnly}
            onClick={() => setDiffOnly((v) => !v)}
            title={diffOnly ? "Show the identical parameters too" : "Collapse to the rows that differ"}
            className={cn(
              "ml-auto rounded-full border px-2 py-px text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              diffOnly
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/30"
            )}
          >
            {diffOnly ? "differences only" : "show all"}
          </button>
        )}
      </div>

      {allSame ? (
        <p className="px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
          All {same} launch parameter{same === 1 ? "" : "s"} identical across
          the selected jobs — the curve differences come from the
          <span className="font-medium text-foreground/70"> data</span>, not
          the settings.
        </p>
      ) : visible.length === 0 ? (
        <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
          Every shared parameter agrees — toggle “show all” to see the full table.
        </p>
      ) : (
        <div className="max-h-40 overflow-y-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border/70 text-left">
                <th
                  scope="col"
                  className="px-2.5 py-1 font-medium text-muted-foreground"
                >
                  <span className="sr-only">Parameter</span>
                  <span aria-hidden="true" className="text-[10px] uppercase tracking-wide">
                    parameter
                  </span>
                </th>
                {jobs.map((j) => (
                  <th
                    key={j.jobId}
                    scope="col"
                    className="max-w-28 px-1.5 py-1 font-medium text-muted-foreground"
                    title={`${j.name} (${j.type})`}
                  >
                    <span className="flex min-w-0 items-center gap-1">
                      <span
                        className="inline-block h-0.5 w-3 shrink-0 rounded"
                        style={{ backgroundColor: colorOf(j.jobId) }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-[10px]">{j.name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.key}
                  data-key={row.key}
                  data-kind={row.kind}
                  className={cn(
                    "border-b border-border/40 last:border-b-0",
                    row.kind === "changed" && "bg-amber-500/5"
                  )}
                >
                  <td
                    className="max-w-36 truncate px-2.5 py-1 text-muted-foreground"
                    title={`${row.key} — ${
                      row.kind === "changed"
                        ? "provided values differ between the selected jobs"
                        : row.kind === "partial"
                          ? "missing on at least one selected job, identical where present"
                          : "identical across the selected jobs"
                    }`}
                  >
                    {humanizeKey(row.key)}
                  </td>
                  {row.values.map((v, i) => {
                    const absent = v === undefined;
                    const hot = row.kind === "changed" && !absent;
                    return (
                      <td
                        key={jobs[i].jobId}
                        className={cn(
                          "px-1.5 py-1 text-right font-mono tabular-nums",
                          absent && "text-muted-foreground/40",
                          hot
                            ? "font-semibold text-amber-700 dark:text-amber-400"
                            : !absent
                              ? "text-foreground/80"
                              : ""
                        )}
                        title={
                          absent
                            ? `${jobs[i].name} does not set ${row.key}`
                            : `${jobs[i].name}: ${row.key} = ${formatParam(v)}`
                        }
                      >
                        {absent ? "—" : formatParam(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
