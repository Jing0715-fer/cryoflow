"use client";

/**
 * CryoFlow — the system diagnostics dialog (t530).
 *
 * The campaign's numbers come home: the watchdog's recycle line (t524),
 * the build guard's GO lines (t525), the running build's provenance stamp
 * (t525/t529) and the world's census speak in ONE panel instead of living
 * only in ops scripts and worklog prose. The panel is the human mouth of
 * /api/diagnostics; the engine's own story (found / build rail) stays
 * single-sourced from the store's /api/system status — two wells, no
 * drift (t242 mirror law).
 *
 * Honest-empty doctrine (t195 lineage): every reader that cannot read
 * (null memory, null disk, null census) gets its own speaking empty
 * state — the panel never invents a number, and it SAYS where its
 * numbers come from.
 *
 * Style: teal/amber/red verdict colors reuse the rail's grammar
 * (done=teal, current=amber); canonical lines are drawn ON the bars
 * with their own ticks, so the "why" of every threshold is visible
 * where the number is.
 */

import * as React from "react";
import { Activity, Boxes, Cpu, HardDrive, MemoryStick, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store";
import { EngineBuildRail } from "@/components/workflow/engine-guidance";
import type { DiagnosticsClient } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

const fmtMb = (mb: number) =>
  mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toLocaleString()} MB`;

/** Verdict → (dot class, label) — the rail's color grammar. */
function verdictTone(verdict: "healthy" | "watch" | "danger") {
  switch (verdict) {
    case "healthy":
      return { dot: "bg-teal-500", text: "text-running", label: "Healthy" };
    case "watch":
      return { dot: "bg-amber-500", text: "text-warning", label: "Watch" };
    case "danger":
      return { dot: "bg-danger", text: "text-danger", label: "Danger" };
  }
}

/**
 * A lane bar with its canonical line drawn ON it. `linePct` positions
 * the threshold tick; the fill's color follows the lane's verdict.
 */
function LaneBar({
  label,
  valueMb,
  maxMb,
  linePct,
  lineLabel,
  tone,
  note,
}: {
  label: string;
  valueMb: number;
  maxMb: number;
  linePct: number | null;
  lineLabel: string;
  tone: "go" | "nogo" | "warm" | "collapsed";
  note: string;
}) {
  const pct = Math.max(0, Math.min(100, (valueMb / Math.max(1, maxMb)) * 100));
  const fill =
    tone === "go" || tone === "warm"
      ? "bg-teal-500/80"
      : tone === "nogo"
        ? "bg-amber-500/80"
        : "bg-red-500/80";
  return (
    <div data-testid="diag-lane" data-lane-tone={tone} className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground/90">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground/90">{fmtMb(valueMb)}</span>
      </div>
      <div
        className="relative h-2.5 overflow-visible rounded-full bg-muted"
        role="img"
        aria-label={`${label}: ${fmtMb(valueMb)} of ${fmtMb(maxMb)}; ${lineLabel}`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", fill)}
          style={{ width: `${pct}%` }}
        />
        {linePct !== null && (
          <div
            className="absolute inset-y-[-3px] w-px bg-foreground/45"
            style={{ left: `${Math.max(0, Math.min(100, linePct))}%` }}
          >
            <span className="absolute -top-[13px] left-1 whitespace-nowrap font-mono text-[9px] text-muted-foreground">
              {lineLabel}
            </span>
          </div>
        )}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  caption,
  children,
  testid,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <section
      data-testid={testid}
      className="rounded-lg border bg-card/60 px-3.5 py-3 shadow-sm"
    >
      <header className="mb-2.5 flex items-center gap-2">
        <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{caption}</span>
      </header>
      {children}
    </section>
  );
}

function HonestEmpty({ what }: { what: string }) {
  return (
    <p data-testid="diag-empty" className="rounded-md bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
      {what} could not be read on this host — the panel says so instead of inventing a number.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* the dialog                                                          */
/* ------------------------------------------------------------------ */

export default function SystemDiagnosticsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const system = useWorkflowStore((s) => s.system);
  const [diag, setDiag] = React.useState<DiagnosticsClient | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const fetchDiag = React.useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/diagnostics");
      if (!res.ok) throw new Error(String(res.status));
      setDiag((await res.json()) as DiagnosticsClient);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open && !diag && !loading) void fetchDiag();
  }, [open, diag, loading, fetchDiag]);

  const memory = diag?.memory ?? null;
  const tone = memory ? verdictTone(memory.verdict) : null;
  const laneMax = memory ? Math.max(memory.memTotalMb, 1) : 1;
  const guardAvailablePct = memory ? (2600 / laneMax) * 100 : null;
  const guardBuffCachePct = memory ? (1450 / laneMax) * 100 : null;
  const buffMax = memory ? Math.max(memory.memTotalMb, memory.buffCacheMb, 1) : 1;
  const buffLinePct = memory ? (1450 / buffMax) * 100 : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
            System diagnostics
          </DialogTitle>
          <DialogDescription>
            The box behind the canvas — memory lanes against the build guard's canonical lines,
            disk, the running build's provenance and the world's census, read from bytes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* ---- memory lanes ------------------------------------ */}
          <SectionCard
            testid="diag-memory"
            icon={<MemoryStick />}
            title="Memory lanes"
            caption="from /proc/meminfo"
          >
            {memory ? (
              <div className="space-y-3.5">
                <div className="flex items-center gap-2" data-testid="diag-verdict">
                  <span className={cn("size-2 rounded-full", tone?.dot)} aria-hidden="true" />
                  <span className={cn("text-xs font-semibold", tone?.text)}>{tone?.label}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                    total {fmtMb(memory.memTotalMb)}
                    {memory.swapTotalMb > 0 ? ` · swap ${fmtMb(memory.swapTotalMb)}` : " · no swap"}
                  </span>
                </div>
                <LaneBar
                  label="Available"
                  valueMb={memory.memAvailableMb}
                  maxMb={laneMax}
                  linePct={guardAvailablePct}
                  lineLabel="GO 2600"
                  tone={memory.availableLane}
                  note="The build guard refuses a rebuild below this line (t525: 865MB was its first honest NO-GO)."
                />
                <LaneBar
                  label="Page cache (buff/cache)"
                  valueMb={memory.buffCacheMb}
                  maxMb={buffMax}
                  linePct={buffLinePct}
                  lineLabel="warm 1450"
                  tone={memory.cacheLane}
                  note="Below this the page cache is collapsed — the t461 21-loss profile a build cannot survive."
                />
                <p className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] leading-relaxed text-foreground/80">
                  {memory.verdictReason}
                </p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Legend: the dev watchdog recycles next-server at 2600MB RSS — that line polices one
                  process, not the box (t524), which is why it is not drawn on these bars.
                </p>
              </div>
            ) : (
              <HonestEmpty what="Memory vitals" />
            )}
          </SectionCard>

          {/* ---- engine & grinder -------------------------------- */}
          <SectionCard
            testid="diag-engine"
            icon={<Cpu />}
            title="Engine & grinder"
            caption="from /api/system"
          >
            {system?.found ? (
              <div className="space-y-1.5" data-testid="diag-engine-found">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-teal-500" aria-hidden="true" />
                  <span className="font-mono text-xs text-foreground/90">
                    RELION {system.version ?? "?"}
                  </span>
                  {system.execution && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[9px] uppercase">
                      {system.execution}
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">{system.path}</p>
                <p className="text-[10px] text-muted-foreground">
                  Selected install: {system.source ?? "unknown source"} · {system.installs.length}{" "}
                  install{system.installs.length === 1 ? "" : "s"} known
                </p>
              </div>
            ) : system?.build ? (
              <div className="space-y-2" data-testid="diag-engine-build">
                <EngineBuildRail build={system.build} />
                <p className="text-[10px] leading-snug text-muted-foreground">
                  The rail reads stamp files and the installed binary from disk — when the last stage
                  lands, press Re-detect (in the engine chip's popover) and the found world takes over.
                </p>
              </div>
            ) : system ? (
              <p data-testid="diag-engine-none" className="text-xs text-muted-foreground">
                No RELION install found and no recipe build tree on disk — the header engine chip's
                popover carries the full search guidance and the A/B remedies.
              </p>
            ) : (
              <HonestEmpty what="Engine status" />
            )}
          </SectionCard>

          {/* ---- disk --------------------------------------------- */}
          <SectionCard
            testid="diag-disk"
            icon={<HardDrive />}
            title="Disk"
            caption="statfs on the project root"
          >
            {diag?.disk ? (
              <div className="space-y-1.5">
                <LaneBar
                  label="Used"
                  valueMb={diag.disk.totalMb - diag.disk.freeMb}
                  maxMb={Math.max(diag.disk.totalMb, 1)}
                  linePct={null}
                  lineLabel=""
                  tone={diag.disk.usedPct >= 90 ? "collapsed" : diag.disk.usedPct >= 80 ? "nogo" : "warm"}
                  note={`${diag.disk.usedPct}% used · ${fmtMb(diag.disk.freeMb)} free of ${fmtMb(diag.disk.totalMb)} — tree-external assets (the RELION build tree, EMPIAR data) share this filesystem by design (t527).`}
                />
              </div>
            ) : (
              <HonestEmpty what="Disk vitals" />
            )}
          </SectionCard>

          {/* ---- build provenance + census ------------------------ */}
          <SectionCard
            testid="diag-world"
            icon={<Boxes />}
            title="World & build"
            caption="census + provenance stamp"
          >
            <div className="space-y-2.5">
              {diag?.provenance.commit ? (
                <div className="flex items-center gap-2" data-testid="diag-provenance">
                  <span className="font-mono text-[10px] text-muted-foreground">running build</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/90">
                    {diag.provenance.commit}
                  </code>
                  {diag.provenance.standalone && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[9px] uppercase">
                      standalone
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No provenance stamp on this lane — dev or legacy build (the recipe marks standalone
                  builds at bake time, t525).
                </p>
              )}
              {diag?.world ? (
                <div className="grid grid-cols-3 gap-2" data-testid="diag-census">
                  {(
                    [
                      ["Projects", diag.world.projects],
                      ["Jobs", diag.world.jobs],
                      ["Running", diag.world.runningJobs],
                    ] as const
                  ).map(([label, n]) => (
                    <div
                      key={label}
                      className="rounded-md border bg-background px-2 py-1.5 text-center"
                    >
                      <p className="font-mono text-base font-semibold tabular-nums leading-tight text-foreground">
                        {n.toLocaleString()}
                      </p>
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <HonestEmpty what="World census" />
              )}
            </div>
          </SectionCard>

          {/* ---- footer ------------------------------------------- */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="font-mono text-[10px] text-muted-foreground" data-testid="diag-generated">
              {diag ? `read at ${new Date(diag.generatedAt).toLocaleTimeString()}` : "not read yet"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => void fetchDiag()}
              disabled={loading}
              aria-label="Refresh diagnostics"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden="true" />
              {loading ? "Reading…" : "Refresh"}
            </Button>
          </div>
          {failed && (
            <p data-testid="diag-failed" className="text-[11px] text-danger">
              The diagnostics read failed — the API refused or is unreachable. Retry when the lane is healthy.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
