"use client";

/**
 * CryoFlow — SPA template presets dialog.
 *
 * A pre-flight dialog for the one-click standard SPA pipeline: instead of
 * silently stamping spec defaults, the user picks a preset card (Quick /
 * Standard / Deep) or tweaks the individual knobs (symmetry, 2D class
 * count, initial-model classes, refine low-pass + auto-refine) and the
 * chosen values ride along to POST /api/pipeline-template as validated
 * overrides.
 *
 * The dialog is mounted ONCE (page.tsx) and triggered from three places —
 * the canvas empty state, the command palette and the job palette — via
 * the shared `templatePresetsOpen` store flag.
 *
 * The last created configuration (preset key + form values) persists in
 * localStorage and is restored on the next open — iterative sessions
 * (screening → deep pass on the same sample) don't re-enter the same six
 * knobs every time. A "Reset" button always returns to spec defaults;
 * restored values are sanitized (whitelist + clamp) before use.
 */

import * as React from "react";
import { Download, LayoutTemplate, Loader2, Sparkles, Trash2, Upload, Wand2, Zap } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import type { CustomTemplateSummary, TemplateOverrides } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TemplateShapeHoverCard } from "@/components/workflow/template-shape-preview";
import { cn } from "@/lib/utils";

/** The symmetry selects' option list (mirrors workflow.ts / template route). */
const SYMMETRIES = ["C1", "C2", "C4", "D2", "T", "I"];

/** One-line human summary of a symmetry group for the select hints. */
const SYMMETRY_HINTS: Record<string, string> = {
  C1: "no symmetry — heterogeneous samples",
  C2: "2-fold — dimers",
  C4: "4-fold — channels, tetramers",
  D2: "D2 — many soluble proteins",
  T: "tetrahedral",
  I: "icosahedral — viruses, cages",
};

interface FormState {
  symmetry: string;
  class2dClasses: number;
  class2dIterations: number;
  initialModelClasses: number;
  refineIniHigh: number;
  refineAutoRefine: boolean;
}

/** localStorage key for the last created configuration */
const LAST_KEY = "cryoflow:template-presets:last";

/**
 * Defensive re-validation of a persisted { form, preset } pair — anything
 * written by an older version (or tampered) falls back per-field instead of
 * being trusted: symmetry is whitelisted, numbers clamped to knob ranges,
 * booleans coerced.
 */
function sanitizeLast(raw: string): { form: FormState; preset: string | null } | null {
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    const f = (r.form ?? {}) as Record<string, unknown>;
    const num = (v: unknown, min: number, max: number, fb: number) => {
      const n = typeof v === "number" ? Math.round(v) : NaN;
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
    };
    const preset = typeof r.preset === "string" && PRESETS.some((p) => p.key === r.preset)
      ? r.preset
      : null;
    return {
      preset,
      form: {
        symmetry: typeof f.symmetry === "string" && SYMMETRIES.includes(f.symmetry)
          ? f.symmetry
          : DEFAULTS.symmetry,
        class2dClasses: num(f.class2dClasses, 1, 200, DEFAULTS.class2dClasses),
        class2dIterations: num(f.class2dIterations, 1, 50, DEFAULTS.class2dIterations),
        initialModelClasses: num(f.initialModelClasses, 1, 20, DEFAULTS.initialModelClasses),
        refineIniHigh: num(f.refineIniHigh, 5, 60, DEFAULTS.refineIniHigh),
        refineAutoRefine: f.refineAutoRefine === true,
      },
    };
  } catch {
    return null;
  }
}

function loadLast(): { form: FormState; preset: string | null } | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? sanitizeLast(raw) : null;
  } catch {
    return null; // private mode / storage disabled — defaults are fine
  }
}

function saveLast(form: FormState, preset: string | null): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ form, preset }));
  } catch {
    /* storage full/disabled — memory is best-effort */
  }
}

/** Form defaults == the job spec defaults ("Standard" preset). */
const DEFAULTS: FormState = {
  symmetry: "D2",
  class2dClasses: 10,
  class2dIterations: 12,
  initialModelClasses: 4,
  refineIniHigh: 30,
  refineAutoRefine: false,
};

interface Preset {
  key: string;
  name: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  values: FormState;
}

/**
 * Three curated starting points. "Standard" equals the job-spec defaults
 * (creating a template with it == the old one-click behavior).
 */
const PRESETS: Preset[] = [
  {
    key: "quick",
    name: "Quick pass",
    blurb: "K=10 · 8 iters · IM K=1 · low-pass 40 Å — fastest feedback loop",
    icon: Zap,
    values: {
      symmetry: "D2",
      class2dClasses: 10,
      class2dIterations: 8,
      initialModelClasses: 1,
      refineIniHigh: 40,
      refineAutoRefine: false,
    },
  },
  {
    key: "standard",
    name: "Standard",
    blurb: "Job-spec defaults · IM K=4 · 15 refine iters — the RELION tutorial path",
    icon: Wand2,
    values: DEFAULTS,
  },
  {
    key: "deep",
    name: "Deep pass",
    blurb: "K=50 · 25 iters · IM K=8 · low-pass 15 Å · gold-standard auto-refine",
    icon: Sparkles,
    values: {
      symmetry: "C1",
      class2dClasses: 50,
      class2dIterations: 25,
      initialModelClasses: 8,
      refineIniHigh: 15,
      refineAutoRefine: true,
    },
  },
];

/**
 * Task 127 — the dialog's "Your templates" shelf: user-saved selection
 * snippets (project-scoped), apply-on-click, two-step inline delete.
 * Lives at module level so its confirm state resets with the dialog.
 *
 * Task 128 — the section is SELF-CONTAINED (header + import trigger +
 * rows + empty state): export rides per-row (Download, hover-reveal),
 * import lives in the header (and the empty-state hint), both through
 * the store's exportCustomTemplate / importCustomTemplateFiles. The
 * import picker is the palette's dynamic-<input> dialect — a click
 * cannot open a native picker synchronously inside React's event,
 * but a fresh detached input clicks fine.
 *
 * Task 130 — batch management once there IS a batch (≥ 2 rows):
 * "Export all" lands every template as ONE bundle .json, the trash
 * button arms a two-step "Delete all N?" confirm in the header itself
 * (the same arm → confirm dialect the rows use — no modal detour).
 */
function CustomTemplatesSection() {
  const templates = useWorkflowStore((s) => s.customTemplates);
  const applyCustomTemplate = useWorkflowStore((s) => s.applyCustomTemplate);
  const deleteCustomTemplate = useWorkflowStore((s) => s.deleteCustomTemplate);
  const exportCustomTemplate = useWorkflowStore((s) => s.exportCustomTemplate);
  const [armDeleteId, setArmDeleteId] = React.useState<string | null>(null);
  const [armClear, setArmClear] = React.useState(false);
  const [applyingId, setApplyingId] = React.useState<string | null>(null);
  const [exportingId, setExportingId] = React.useState<string | null>(null);
  const [exportingAll, setExportingAll] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const apply = (t: CustomTemplateSummary) => {
    setApplyingId(t.id);
    void useWorkflowStore
      .getState()
      .applyCustomTemplate(t.id)
      .finally(() => setApplyingId(null));
  };

  const exportOne = (t: CustomTemplateSummary) => {
    setExportingId(t.id);
    void useWorkflowStore
      .getState()
      .exportCustomTemplate(t.id)
      .finally(() => setExportingId(null));
  };

  /** Task 130 — export every template as one bundle file. */
  const exportAll = () => {
    setExportingAll(true);
    void useWorkflowStore
      .getState()
      .exportAllCustomTemplates()
      .finally(() => setExportingAll(false));
  };

  /** Task 130 — clear the shelf after the header's two-step confirm. */
  const clearAll = () => {
    setArmClear(false);
    void useWorkflowStore.getState().clearCustomTemplates();
  };

  /** native picker via a detached input (command-palette's dialect) */
  const pickImportFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      setImporting(true);
      try {
        await useWorkflowStore.getState().importCustomTemplateFiles(files);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const importButton = (testid: string) => (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 gap-1 px-2 text-[11px]"
      onClick={pickImportFiles}
      disabled={importing}
      title="Import shared template .json files into this project's shelf"
      data-testid={testid}
    >
      {importing ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <Upload className="size-3" aria-hidden="true" />
      )}
      Import
    </Button>
  );

  // Task 130 — batch tools exist only when there IS a batch: a single
  // template manages itself per-row, and the header stays quiet.
  const hasBatch = templates.length >= 2;

  const header = (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <LayoutTemplate className="size-3" aria-hidden="true" />
      Your templates
      {templates.length > 0 && (
        <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium tabular-nums">
          {templates.length}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1 normal-case">
        {hasBatch && !armClear && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={exportAll}
            disabled={exportingAll}
            title="Download every template as one bundle .json file"
            data-testid="custom-template-export-all"
          >
            {exportingAll ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-3" aria-hidden="true" />
            )}
            Export all
          </Button>
        )}
        {hasBatch && !armClear && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
            onClick={() => setArmClear(true)}
            aria-label={`Clear all ${templates.length} templates`}
            title="Remove every saved template from this shelf"
            data-testid="custom-template-clear"
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </Button>
        )}
        {hasBatch && armClear && (
          <>
            <span
              className="text-[10px] font-medium normal-case text-rose-600"
              data-testid="custom-template-clear-arm"
            >
              Delete all {templates.length}?
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
              onClick={clearAll}
              data-testid="custom-template-clear-confirm"
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Clear
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => setArmClear(false)}
              data-testid="custom-template-clear-keep"
            >
              Keep
            </Button>
          </>
        )}
        {importButton("custom-template-import")}
      </span>
    </p>
  );

  if (templates.length === 0) {
    return (
      <div className="grid gap-1.5">
        {header}
        <p
          className="rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground"
          data-canvas-ui="custom-templates-empty"
        >
          No saved templates yet — select two or more jobs on the canvas and use the selection
          toolbar's <LayoutTemplate className="inline size-3 align-[-1px]" aria-hidden="true" /> button
          to snapshot the branch (types, positions, parameters, wiring). It lands here — or share
          one in: {importButton("custom-template-import-empty")} takes a
          cryoflow-template .json file.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      {header}
      <ul className="grid max-h-44 gap-1.5 overflow-y-auto pr-0.5" data-canvas-ui="custom-templates-list">
        {templates.map((t) => {
          const armed = armDeleteId === t.id;
          const applying = applyingId === t.id;
          const exporting = exportingId === t.id;
          return (
            <li
              key={t.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 transition-colors",
                armed ? "border-rose-300 bg-rose-500/5" : "hover:border-primary/40"
              )}
              data-canvas-ui="custom-template-row"
              data-template-id={t.id}
            >
              <LayoutTemplate className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              <TemplateShapeHoverCard id={t.id} name={t.name}>
                <p className="truncate text-xs font-medium" title={t.name}>
                  {t.name}
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {t.jobCount} jobs · {t.edgeCount} wire{t.edgeCount === 1 ? "" : "s"} · {t.createdAt.slice(0, 10)}
                </p>
              </TemplateShapeHoverCard>
              {armed ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                    onClick={() => {
                      setArmDeleteId(null);
                      void deleteCustomTemplate(t.id);
                    }}
                    data-testid="custom-template-delete-confirm"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setArmDeleteId(null)}
                  >
                    Keep
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => exportOne(t)}
                    disabled={exporting}
                    aria-label={`Export template ${t.name}`}
                    title="Download this template as a shareable .json file"
                    data-testid="custom-template-export"
                  >
                    {exporting ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="size-3" aria-hidden="true" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] text-rose-600 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => setArmDeleteId(t.id)}
                    aria-label={`Delete template ${t.name}`}
                    title="Forget this template"
                    data-testid="custom-template-delete"
                  >
                    <Trash2 className="size-3" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 gap-1 px-2.5 text-[11px]"
                    disabled={applying}
                    onClick={() => apply(t)}
                    data-testid="custom-template-apply"
                  >
                    {applying ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    ) : null}
                    Apply
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TemplatePresetsDialog() {
  const open = useWorkflowStore((s) => s.templatePresetsOpen);
  const setOpen = useWorkflowStore((s) => s.setTemplatePresetsOpen);
  const [form, setForm] = React.useState<FormState>(DEFAULTS);
  const [activePreset, setActivePreset] = React.useState<string | null>("standard");
  const [restored, setRestored] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // restore the last created configuration on open (validated); first run
  // (or cleared storage) starts at Standard. Reset restores that contract.
  React.useEffect(() => {
    if (!open) return;
    setBusy(false);
    // Task 127 — the user-saved shelf refreshes on every open
    void useWorkflowStore.getState().loadCustomTemplates();
    const last = loadLast();
    if (last) {
      setForm(last.form);
      setActivePreset(last.preset);
      setRestored(true);
    } else {
      setForm(DEFAULTS);
      setActivePreset("standard");
      setRestored(false);
    }
  }, [open]);

  const pickPreset = (p: Preset) => {
    setActivePreset(p.key);
    setForm(p.values);
  };

  /** back to the spec defaults (undoes any restored memory) */
  const resetToDefaults = () => {
    setForm(DEFAULTS);
    setActivePreset("standard");
    setRestored(false);
  };

  /** editing any field manually clears the preset highlight */
  const patch = (p: Partial<FormState>) => {
    setActivePreset(null);
    setForm((f) => ({ ...f, ...p }));
  };

  const create = async () => {
    setBusy(true);
    try {
      const overrides: TemplateOverrides = {
        symmetry: form.symmetry,
        class2dClasses: form.class2dClasses,
        class2dIterations: form.class2dIterations,
        initialModelClasses: form.initialModelClasses,
        refineIniHigh: form.refineIniHigh,
        refineAutoRefine: form.refineAutoRefine,
      };
      // identical to the defaults path? then omit overrides entirely so the
      // server stamps pristine spec params (byte-identical template)
      const isDefault =
        form.symmetry === DEFAULTS.symmetry &&
        form.class2dClasses === DEFAULTS.class2dClasses &&
        form.class2dIterations === DEFAULTS.class2dIterations &&
        form.initialModelClasses === DEFAULTS.initialModelClasses &&
        form.refineIniHigh === DEFAULTS.refineIniHigh &&
        form.refineAutoRefine === DEFAULTS.refineAutoRefine;
      await useWorkflowStore
        .getState()
        .createTemplate(isDefault ? undefined : overrides);
      // persist AFTER success only — a failed request must not poison the
      // next session's starting point
      saveLast(form, activePreset);
      setRestored(false);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  /** compact number stepper: input + native number semantics */
  const NumField = ({
    id,
    label,
    hint,
    value,
    min,
    max,
    onChange,
  }: {
    id: string;
    label: string;
    hint?: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
  }) => (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : min}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="h-8 text-sm"
      />
      {hint ? <p className="text-[10px] leading-tight text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-4" data-canvas-ui="template-presets-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wand2 className="size-4 text-teal-600" aria-hidden="true" />
            Scaffold standard SPA pipeline
          </DialogTitle>
          <DialogDescription>
            10 pre-wired jobs (import → motion correction → CTF → picking → extraction → 2D →
            initial model → refine → mask → postprocess). Pick a preset or tune the key knobs —
            nothing runs until you start it.
          </DialogDescription>
        </DialogHeader>

        {/* preset cards */}
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Parameter presets">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const active = activePreset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPreset(p)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border p-2 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "bg-card hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
                  {p.name}
                </span>
                <span className="mt-1 block text-[10px] leading-tight text-muted-foreground">
                  {p.blurb}
                </span>
              </button>
            );
          })}
        </div>

        {/* editable knobs */}
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="grid gap-1">
            <Label className="text-xs">Symmetry — initial model & refinement</Label>
            <Select value={form.symmetry} onValueChange={(v) => patch({ symmetry: v })}>
              <SelectTrigger className="h-8 w-full text-sm" aria-label="Symmetry point group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYMMETRIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                    <span className="ml-2 text-[10px] text-muted-foreground">{SYMMETRY_HINTS[s]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumField
              id="tpl-class2d-k"
              label="2D classes (K)"
              hint="10–50 typical"
              value={form.class2dClasses}
              min={1}
              max={200}
              onChange={(v) => patch({ class2dClasses: v })}
            />
            <NumField
              id="tpl-class2d-iters"
              label="2D iterations"
              hint="8 quick · 25 deep"
              value={form.class2dIterations}
              min={1}
              max={50}
              onChange={(v) => patch({ class2dIterations: v })}
            />
            <NumField
              id="tpl-im-k"
              label="Initial models (K)"
              hint="1 skips ab-initio"
              value={form.initialModelClasses}
              min={1}
              max={20}
              onChange={(v) => patch({ initialModelClasses: v })}
            />
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <NumField
              id="tpl-inihigh"
              label="Refine low-pass (Å)"
              hint="initial reference filter"
              value={form.refineIniHigh}
              min={5}
              max={60}
              onChange={(v) => patch({ refineIniHigh: v })}
            />
            <div className="grid gap-1 pb-1">
              <Label htmlFor="tpl-autorefine" className="text-xs">
                Gold-standard auto-refine
              </Label>
              <div className="flex h-8 items-center gap-2">
                <Switch
                  id="tpl-autorefine"
                  checked={form.refineAutoRefine}
                  onCheckedChange={(v) => patch({ refineAutoRefine: v })}
                />
                <span className="text-[10px] leading-tight text-muted-foreground">
                  FSC-driven auto-stop
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Task 127 — the user's own saved snippets, one click to re-plant.
            Task 128 — the section is self-contained: header + import live
            inside, export rides per-row. Task 130 — batch management
            (Export all / Clear) arms in the header once there are ≥ 2. */}
        <CustomTemplatesSection />

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-[10px] text-muted-foreground">
            {restored && (
              <span className="mr-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                restored from last time
              </span>
            )}
            {activePreset
              ? `${PRESETS.find((p) => p.key === activePreset)?.name} preset`
              : "Custom parameters"}
            {" · "}
            {form.class2dClasses} 2D classes · symmetry {form.symmetry}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              disabled={busy}
              title="Return all knobs to the job-spec defaults"
            >
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void create()} disabled={busy} className="gap-1.5">
              <Wand2 className="size-3.5" aria-hidden="true" />
              {busy ? "Creating…" : "Create pipeline"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
