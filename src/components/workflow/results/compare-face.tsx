"use client";

/**
 * CryoFlow — the compare family's shared face kit (t454).
 *
 * t439 built the A/B verdict face inline in one dialog; t440 proved two
 * domains can share it; t453 proved a third. t454 opens a FOURTH question
 * that pairs one run with itself across iterations — and copying the
 * scatter/chips JSX into a second dialog would have been the lie of
 * architecture t440's core already refused. This module is the face's
 * shared vocabulary: the lens chips, the verdict chips, the identity
 * scatter and the mover lists — pure presentation, every word handed in
 * by the caller (words, names, digits, units). Two dialogs, one face.
 */

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { TriangleAlert } from "lucide-react";
import type { VerdictWords } from "@/lib/class-compare";
import type { LensSpec, Verdict, Delta } from "@/lib/paired-compare";
import { fmtDelta } from "@/lib/paired-compare";

/** The lens switcher — one chip per lens, the active one filled. */
export function LensChips<R>({
  lenses,
  activeKey,
  onPick,
}: {
  lenses: LensSpec<R>[];
  activeKey: string;
  onPick: (key: string) => void;
}) {
  if (lenses.length <= 1) return null; // a one-lens domain speaks in its heading
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Comparison metric">
      {lenses.map((l) => {
        const active = l.key === activeKey;
        return (
          <button
            key={l.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPick(l.key)}
            className={
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors " +
              (active
                ? "border-primary/50 bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground")
            }
            title={
              l.higherIsBetter
                ? `${l.label} — higher is better`
                : `${l.label} — lower is better`
            }
          >
            {l.label}
            <span className="ml-1 font-normal opacity-70">
              {l.higherIsBetter ? "↑ better" : "↓ better"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The verdict chips — counts first, then the median, then the unpaired
 *  census (amber only when the join actually left someone out). */
export function VerdictChips({
  v,
  words,
  digits,
  unit,
  pairsCount,
  onlyA,
  onlyB,
}: {
  v: Verdict;
  words: VerdictWords;
  digits: number;
  unit: string;
  pairsCount: number;
  onlyA: string[];
  onlyB: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full bg-teal-600/10 px-2 py-0.5 font-medium text-teal-700 dark:text-teal-400">
        {v.improved} {words.better}
      </span>
      <span className="rounded-full bg-rose-600/10 px-2 py-0.5 font-medium text-rose-700 dark:text-rose-400">
        {v.regressed} {words.worse}
      </span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
        {v.tied} {words.same}
      </span>
      <span className="font-medium text-foreground">
        median Δ {fmtDelta(v.medianDelta, digits)}
        {unit}
      </span>
      <span className="text-muted-foreground">of {pairsCount} paired</span>
      {(onlyA.length > 0 || onlyB.length > 0) && (
        <span
          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400"
          title={
            `Only in A: ${onlyA.slice(0, 6).join(", ")}` +
            (onlyA.length > 6 ? "…" : "") +
            "\n" +
            `Only in B: ${onlyB.slice(0, 6).join(", ")}` +
            (onlyB.length > 6 ? "…" : "")
          }
        >
          unpaired: {onlyA.length} in A · {onlyB.length} in B
        </span>
      )}
    </div>
  );
}

/** The identity scatter — above the 45° line B beats A (or loses, when
 *  the lens says lower is better; the SERIES are pre-split by kind so
 *  the palette never lies). Shared verbatim by the sibling face and the
 *  convergence face: both axes are the same lens's value. */
export function IdentityScatter({
  domain,
  improved,
  regressed,
  tied,
  words,
  nameA,
  nameB,
  digits,
}: {
  domain: [number, number];
  improved: Delta[];
  regressed: Delta[];
  tied: Delta[];
  words: VerdictWords;
  nameA: string;
  nameB: string;
  digits: number;
}) {
  return (
    <>
      <div className="h-64 w-full rounded-lg border bg-card p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
            <XAxis
              type="number"
              dataKey="a"
              domain={domain}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => v.toFixed(digits)}
              name={`A · ${nameA}`}
            />
            <YAxis
              type="number"
              dataKey="b"
              domain={domain}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => v.toFixed(digits)}
              width={52}
              name={`B · ${nameB}`}
            />
            <ZAxis range={[36, 36]} />
            <ReferenceLine
              segment={[
                { x: domain[0], y: domain[0] },
                { x: domain[1], y: domain[1] },
              ]}
              stroke="currentColor"
              strokeDasharray="4 4"
              className="text-muted-foreground/60"
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{ fontSize: 11 }}
              formatter={(value, name) => [value, name]}
              labelFormatter={() => ""}
            />
            <Scatter
              name={`${words.better} (${improved.length})`}
              data={improved}
              dataKey="b"
              fill="#0d9488"
              fillOpacity={0.75}
            />
            <Scatter
              name={`${words.worse} (${regressed.length})`}
              data={regressed}
              dataKey="b"
              fill="#e11d48"
              fillOpacity={0.75}
            />
            <Scatter
              name={`${words.same} (${tied.length})`}
              data={tied}
              dataKey="b"
              fill="#94a3b8"
              fillOpacity={0.6}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-teal-600" aria-hidden="true" /> {words.better}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-rose-600" aria-hidden="true" /> {words.worse}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-slate-400" aria-hidden="true" /> {words.same}
        </span>
        <span>· dashed line = no change (B equals A)</span>
      </div>
    </>
  );
}

/** The named witnesses — a verdict you can act on is names. */
export function MoverList({
  title,
  deltas,
  digits,
  unit,
  tone,
}: {
  title: string;
  deltas: Delta[];
  digits: number;
  unit: string;
  tone: "teal" | "rose";
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <div
        className={
          "mb-1.5 text-[11px] font-medium " +
          (tone === "teal" ? "text-teal-700 dark:text-teal-400" : "text-rose-700 dark:text-rose-400")
        }
      >
        {title}
      </div>
      {deltas.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">none — the whole pack moved the other way</div>
      ) : (
        <ul className="space-y-1">
          {deltas.map((d) => (
            <li key={d.name} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-foreground" title={d.name}>
                {d.name}
              </span>
              <span className="shrink-0 font-mono text-muted-foreground">
                {d.a.toFixed(digits)}
                {unit} → {d.b.toFixed(digits)}
                {unit}{" "}
                <span
                  className={
                    tone === "teal"
                      ? "font-medium text-teal-700 dark:text-teal-400"
                      : "font-medium text-rose-700 dark:text-rose-400"
                  }
                >
                  ({fmtDelta(d.delta, digits)}
                  {unit})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The pairing-refused banner — shared empty-state when a route or a
 *  round list cannot answer. */
export function CompareNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </div>
  );
}
