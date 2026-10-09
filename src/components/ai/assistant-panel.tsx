"use client";

/**
 * CryoFlow — the AI assistant panel (t419 → t420 polish; t424 deepens it).
 *
 * A right Sheet — the natural-language copilot for the canvas. The loop is
 * CLIENT-driven: every POST /api/ai/chat runs ONE model turn + its tool
 * executions and answers needsContinue; while true, the panel immediately
 * re-POSTs — each tool batch (created jobs, wired edges, VLM verdicts)
 * renders the moment it executed. No SSE, no websocket — the app's polling
 * doctrine untouched (pollTick refreshes the canvas after every round).
 *
 * t420 — the face lift, driven by the user's ticket:
 *  - THE OVERLAP FIX: SheetContent paints its own X at top-4 right-4 with a
 *    14px hit-slop (46px total reach) — this panel's own header buttons
 *    used to live exactly there, so the close ATE their clicks. The header
 *    now reserves the X's slot with pr-14 (56px) and every button sits
 *    left of the kill zone.
 *  - The header grows the ACTIVE MODEL badge (provider · model, from
 *    /api/ai/settings — refreshed when the settings dialog closes).
 *  - Tool cards get per-tool icons + status-tinted tiles; assistant turns
 *    get an avatar bubble; the busy row gets animated dots.
 *  - The composer's send button becomes a STOP button while busy — the
 *    client loop aborts (in-flight fetch aborted, boundary aborts between
 *    rounds; the server session stays consistent, rehydration recovers).
 *
 * Transcript survives reloads server-side (GET /api/ai/chat rehydrates the
 * project's latest session); the class gallery's「AI 分析」button opens the
 * panel with a pending prompt (openAiAssistant(question)) that is sent on
 * arrival — the same one-shot contract as pendingClassFocus.
 *
 * t424 deepening (the dead 202609281551 lane's session-history work, grafted
 * onto the t420 panel by the carrying window): a HISTORY DRAWER (past
 * conversations of this project — switch, delete with a two-click confirm;
 * summaries load from GET /api/ai/sessions), a TRANSCRIPT FILTER (全部 / 工具 /
 * 失败 — when a session carries enough tool cards to be worth filtering), a
 * jump-to-bottom affordance when the user scrolled up mid-stream, and
 * timestamps on the user bubbles.
 *
 * t423 — the consistency round (rebased atop t424; the two rounds are
 * complementary — t424 deepens the session surface, t423 polishes the
 * turn surface):
 *  - Notices stop masquerading as markdown bubbles with emoji: stops and
 *    errors render as compact status-line banners (the app's warning idiom).
 *  - Tool cards grow a locate (Locate icon) button when the result carries a
 *    job — revealJob centers + selects it on the canvas while the panel stays
 *    open; the transcript becomes a navigation surface, not just a log.
 *  - Contextual follow-up chips above the composer, computed from the live
 *    store (running → wait, completed class2d → judge, empty canvas →
 *    scaffold) — the same NEXT_STEPS canon the canvas context menu speaks.
 *  - The composer guards IME composition (Enter confirms a Chinese input
 *    instead of sending) and respects the iOS safe-area inset.
 *  - Assistant markdown gets table/heading/blockquote styling (GFM content
 *    used to render as unstyled soup).
 *
 * t427 — the identity round: the amber "AI accent" is retired — the panel
 * now wears the app's cryo teal (header tile, avatars, badges, chips, focus
 * rings, busy dots). Only the needsSetup banner keeps amber: it IS a warning,
 * and warnings are amber in this app.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  ArrowDown,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Cpu,
  FileSearch,
  Filter,
  History,
  Hourglass,
  Download,
  Info,
  LayoutDashboard,
  Link2,
  ListTree,
  Locate,
  MousePointerClick,
  PenLine,
  Play,
  PlusCircle,
  RotateCcw,
  ScanEye,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Workflow,
  Wrench,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
// t641: sonner Toaster was never mounted — these toasts were dead-ends.
// One vocabulary law: everything speaks the Radix use-toast dialect.
import { toast } from "@/hooks/use-toast";
import { downloadBlob } from "@/lib/download"; // t646 — one blob sink (this dance revoked same-tick — the Chrome truncation trap)
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompanionWindow } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { filterSessions, groupSessionsByDay, matchIndex } from "@/lib/ai/session-groups";
import { parseActionBlocks, type AssistantAction } from "@/lib/ai/action-blocks";
import { hasAgedToolHistory } from "@/lib/ai/stale-history";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkflowStore } from "@/lib/store";
import { CopyButton } from "@/components/workflow/copy-button";
import { JOB_LINK_PROTOCOL, linkifyJobs } from "@/lib/linkify-jobs";
import type { JobDTO } from "@/lib/types";
import type {
  AiChatResponse,
  AiEvent,
  AiMessage,
  AiProviderHealthDto,
  AiSettingsResponse,
  AiSessionSummaryDto,
} from "@/lib/ai/types";

/* ------------------------------------------------------------------ */
/* Transcript items (flattened from server messages + live events)      */
/* ------------------------------------------------------------------ */

type UiItem =
  | { kind: "user"; text: string; key: string; at?: number }
  | { kind: "assistant"; text: string; key: string }
  | { kind: "notice"; variant: "stop" | "error" | "info"; text: string; key: string }
  | { kind: "tool"; key: string; id: string; name: string; args: unknown; ok: boolean; summary: string; detail?: unknown; at?: number; jobId?: string | null };

function fmtTime(at?: number): string {
  if (!at || !Number.isFinite(at)) return "";
  const d = new Date(at);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** "刚刚 / N 分钟前 / N 小时前 / 昨日 / M-D" — the history row's clock. */
function fmtRel(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function argsOneLine(args: unknown): string {
  try {
    const s = JSON.stringify(args ?? {});
    return s.length > 160 ? `${s.slice(0, 160)}…` : s;
  } catch {
    return String(args);
  }
}

/** Pull a navigable job id out of a tool result — the locate button's
 * datasource. create/build/select carry it in their detail payloads; the
 * per-job tools carry it in their args (locating a FAILED target is just as
 * useful — the error report should be findable on the canvas). */
function extractJobId(name: string, args: unknown, detail: unknown): string | null {
  const a = (args ?? {}) as Record<string, unknown>;
  if (name === "create_job") {
    const j = (detail as { job?: { id?: string } } | null)?.job;
    return typeof j?.id === "string" ? j.id : null;
  }
  if (name === "build_pipeline") {
    const d = detail as { tail?: string; jobs?: { id?: string }[] } | null;
    if (typeof d?.tail === "string" && d.tail) return d.tail;
    const last = d?.jobs?.filter((j) => typeof j?.id === "string" && j.id).pop();
    return last?.id ?? null;
  }
  if (name === "select_classes") {
    const d = detail as { jobId?: string } | null;
    return typeof d?.jobId === "string" ? d.jobId : null;
  }
  if (
    name === "run_job" ||
    name === "stop_job" ||
    name === "inspect_job" ||
    name === "update_job" ||
    name === "judge_2d_classes"
  ) {
    const id = a.job_id;
    return typeof id === "string" && id ? id : null;
  }
  return null;
}

/** t495: the door's URL survival. react-markdown's default urlTransform
 *  strips unknown protocols for safety — cryoflow-job:// arrived at the
 *  override as "" (the door disarmed silently, every chip a plain
 *  link). THIS is the transform: the house protocol passes, everything
 *  else still faces the default sanitation (http/js: quarrels stay
 *  quarantined — the sanitizer's job is not undone, only extended to
 *  our own door). */
const urlTransformKeepDoors = (url: string): string =>
  url.startsWith(JOB_LINK_PROTOCOL) ? url : defaultUrlTransform(url);

/** t495: the prose door's `a` override — a module-level constant (no
 *  closure, no deps to keep honest): cryoflow-job:// links minted by
 *  linkifyJobs become pressable chips riding revealJob, the SAME
 *  deep-link engine the tool cards' locate button uses (one engine,
 *  five surfaces). Every other href passes through untouched — the
 *  model's ordinary links stay links. The chip wears the panel's teal
 *  (the speaker's own family color), not the report's violet: the
 *  door belongs to the surface it lives on. `node` is stripped from
 *  the spread — react-markdown hands the hast node over and letting
 *  it ride `{...rest}` paints `node="[object Object]"` onto the real
 *  DOM (the first live render's fingerprint). */
const PROSE_COMPONENTS: Components = {
  a: ({ href, children, node: _node, ...rest }) => {
    if (typeof href === "string" && href.startsWith(JOB_LINK_PROTOCOL)) {
      const id = href.slice(JOB_LINK_PROTOCOL.length);
      const label =
        React.Children.toArray(children)
          .map((c) => (typeof c === "string" ? c : ""))
          .join("")
          .trim() || "此作业";
      return (
        <button
          type="button"
          data-assistant-door={id}
          aria-label={`在画布中定位 ${label}`}
          title={`在画布中定位 ${label}`}
          className="rounded px-0.5 font-medium text-running-700 underline decoration-running-500/40 underline-offset-2 transition-colors hover:bg-running/10 focus-visible:bg-running/15 focus-visible:outline-none hover:decoration-running-500 dark:text-running-300"
          onClick={() => useWorkflowStore.getState().revealJob(id)}
        >
          {children}
        </button>
      );
    }
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
};

function messagesToItems(messages: AiMessage[]): UiItem[] {
  const items: UiItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") {
      items.push({ kind: "user", text: m.content, key: `m${i}`, at: m.at });
    } else if (m.role === "assistant") {
      if (m.content) items.push({ kind: "assistant", text: m.content, key: `m${i}` });
      for (let c = 0; c < (m.toolCalls?.length ?? 0); c++) {
        const call = m.toolCalls![c];
        // find the matching tool result further down the transcript
        const result = messages.find(
          (x) => x.role === "tool" && x.toolCallId === call.id
        ) as Extract<AiMessage, { role: "tool" }> | undefined;
        if (result) {
          let detail: unknown;
          try {
            detail = JSON.parse(result.content);
          } catch {
            detail = result.content;
          }
          const r = detail as { ok?: boolean; summary?: string; detail?: unknown };
          items.push({
            kind: "tool",
            key: `m${i}c${c}`,
            id: call.id,
            name: call.name,
            args: call.args,
            ok: r?.ok === true,
            summary: r?.summary ?? String(detail).slice(0, 200),
            detail: r?.detail,
            at: result.at,
            jobId: extractJobId(call.name, call.args, r?.detail),
          });
        }
      }
    }
  }
  return items;
}

function eventsToItems(events: AiEvent[], seq: number): UiItem[] {
  const items: UiItem[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === "assistant_text") {
      items.push({ kind: "assistant", text: e.text, key: `e${seq}-${i}` });
    } else if (e.type === "tool_call") {
      const result = events.find(
        (x) => x.type === "tool_result" && x.id === e.id
      ) as Extract<AiEvent, { type: "tool_result" }> | undefined;
      if (result) {
        items.push({
          kind: "tool",
          key: `e${seq}-${i}`,
          id: e.id,
          name: e.name,
          args: e.args,
          ok: result.ok,
          summary: result.summary,
          detail: result.detail,
          jobId: extractJobId(e.name, e.args, result.detail),
        });
      }
    }
    // errors render as notice banners (the app's warning idiom); t500 —
    // neutral notices (e.g. the cross-project session fallback) ride the
    // same banner with the muted info face
    else if (e.type === "error") {
      items.push({ kind: "notice", variant: "error", text: e.message, key: `e${seq}-${i}` });
    } else if (e.type === "notice") {
      items.push({ kind: "notice", variant: "info", text: e.message, key: `e${seq}-${i}` });
    }
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Tool card                                                            */
/* ------------------------------------------------------------------ */

/** Per-tool iconography — the card reads like the pipeline it touches. */
const TOOL_ICONS: Record<string, LucideIcon> = {
  create_job: PlusCircle,
  build_pipeline: Workflow,
  update_job: PenLine,
  connect_jobs: Link2,
  delete_job: Trash2,
  run_job: Play,
  stop_job: Square,
  inspect_job: FileSearch,
  judge_2d_classes: ScanEye,
  select_classes: Filter,
  get_workflow_state: LayoutDashboard,
  get_job_params: SlidersHorizontal,
  list_job_types: ListTree,
  wait_for_jobs: Hourglass,
};

function ToolCard({ item }: { item: Extract<UiItem, { kind: "tool" }> }) {
  const [open, setOpen] = React.useState(false);
  const Icon = TOOL_ICONS[item.name] ?? Wrench;
  const canLocate = typeof item.jobId === "string" && item.jobId.length > 0;
  const reveal = React.useCallback(() => {
    // revealJob = view + selection + centered viewport (the inspector's
    // Focus semantics). The sheet stays open — panel and canvas are
    // side-by-side on desktop, and on mobile the user closes the sheet to
    // see the arrival flash.
    if (item.jobId) useWorkflowStore.getState().revealJob(item.jobId);
  }, [item.jobId]);
  // t510 — the receipt's two faces: the pre is a WINDOW (the first 4,000
  // characters, so a get_workflow_state payload can't take the whole
  // panel), what Copy takes is the WHOLE payload — the same bytes the
  // well carried, untruncated. Objects speak their JSON form (the tool's
  // own voice); strings and unparseable payloads speak themselves.
  const detail = React.useMemo(() => {
    let full: string;
    try {
      full =
        typeof item.detail === "string"
          ? item.detail
          : JSON.stringify(item.detail, null, 2);
    } catch {
      full = String(item.detail);
    }
    return { window: full.slice(0, 4000), full };
  }, [item.detail]);
  const detailTruncated = detail.full.length > detail.window.length;
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card text-xs shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/30">
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="mt-1 shrink-0 text-muted-foreground/70">
            {open ? (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            )}
          </span>
          <span
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
              item.ok
                ? "bg-success/10 text-success"
                : "bg-danger-500/10 text-danger"
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <code className="font-mono text-[11px] font-medium text-foreground">{item.name}</code>
              {item.ok ? (
                <CheckCircle2
                  className="size-3.5 shrink-0 text-success"
                  aria-label="succeeded"
                />
              ) : (
                <XCircle
                  className="size-3.5 shrink-0 text-danger"
                  aria-label="failed"
                />
              )}
            </span>
            <span className="mt-0.5 block break-words text-muted-foreground">{item.summary}</span>
          </span>
        </button>
        {canLocate && (
          <Button
            variant="ghost"
            size="icon"
            className="mr-1 size-7 shrink-0 self-center rounded-md text-muted-foreground/70 hover:text-foreground"
            onClick={reveal}
            aria-label="在画布中定位"
            title="在画布中定位"
          >
            <Locate className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
      {open && (
        <div className="border-t px-2.5 py-2">
          <p className="mb-1 font-mono text-[10px] text-muted-foreground">
            args {argsOneLine(item.args)}
          </p>
          {item.detail != null && (
            <div>
              {/* t510 — the detail's caption row: the receipt gets the same
                  copy door every paper face already has ("Copy ledger",
                  "Copy report" → "Copy detail"). The one clipboard
                  affordance (t170) rides in — no second clipboard dialect. */}
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">detail</span>
                <CopyButton text={detail.full} label="Copy detail" />
              </div>
              <pre className="max-h-48 overflow-auto rounded bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {detail.window}
              </pre>
              {/* t510 — the window never lies about being a window: when
                  the payload ran past 4,000 characters the card says so
                  and names the door that takes the rest. */}
              {detailTruncated && (
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  showing the first {detail.window.length.toLocaleString()} of{" "}
                  {detail.full.length.toLocaleString()} characters — Copy takes all of it
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Notice banner (stop / error) — the app's status-line idiom           */
/* ------------------------------------------------------------------ */

function Notice({ item }: { item: Extract<UiItem, { kind: "notice" }> }) {
  const stop = item.variant === "stop";
  const info = item.variant === "info";
  const Icon = stop ? Square : info ? Info : AlertTriangle;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
        stop
          ? "border-border bg-muted/40 text-muted-foreground"
          : info
            ? "border-border bg-muted/40 text-muted-foreground"
            : "border-danger-600/30 bg-danger/[0.06] text-danger"
      )}
    >
      <Icon
        className={cn("mt-0.5 size-3 shrink-0", stop && "fill-current", info && "text-running")}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">{item.text}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action buttons (t500) — the clickable 方案 A / B / C                */
/* ------------------------------------------------------------------ */

/** The decision rendered as buttons. Each click sends `prompt` through
 * the SAME send() engine the composer uses — a click IS a user turn,
 * the agent loop executes it exactly as if typed. A fired option keeps
 * a subtle "已发送" face so the reader can see which path was taken
 * (the other options stay clickable — the user may change their mind
 * before the world does). */
function ActionButtons({
  actions,
  onPick,
  disabled,
}: {
  actions: AssistantAction[];
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  const [fired, setFired] = React.useState<Record<string, boolean>>({});
  return (
    <div className="mt-1 flex flex-col gap-1.5" role="group" aria-label="建议的操作">
      {actions.map((a, i) => {
        const isFired = fired[a.label] === true;
        return (
          <button
            key={`${a.label}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => {
              setFired((prev) => ({ ...prev, [a.label]: true }));
              onPick(a.prompt);
            }}
            title={a.prompt}
            aria-label={`执行：${a.label}`}
            className={cn(
              "flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs leading-relaxed transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isFired
                ? "border-running/40 bg-running/[0.08] text-running-700 dark:text-running-300"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/[0.05] hover:shadow-sm",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md",
                isFired
                  ? "bg-running/15 text-running"
                  : "bg-primary/10 text-primary"
              )}
            >
              {isFired ? (
                <CheckCircle2 className="size-3" aria-hidden="true" />
              ) : (
                <MousePointerClick className="size-3" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 flex-1 break-words font-medium">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The floating window geometry (t500)                                  */
/* ------------------------------------------------------------------ */

/** The user's ticket: the assistant used to be a fixed right Sheet — it
 * covered the canvas and could not be summoned without hiding what the
 * user was looking at. Now it is a FREE window: drag by its header,
 * resize from three edges/corners, double-click the header to snap back
 * home (top-right). Geometry persists in localStorage; mobile keeps the
 * honest full-screen face (a 380px-wide draggable window on a phone is
 * a joke, not a feature). */
interface WinGeo {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GEO_KEY = "cryoflow.assistant.geometry.v1";
const GEO_MIN_W = 360;
const GEO_MIN_H = 420;
/** t500's mobile breakpoint, t638 — the full-screen face ignores geometry
 * (its narrow clamp would poison the persisted desktop shape), so every
 * WRITE path re-checks the live viewport rather than the useIsMobile
 * hook (whose matchMedia effect lags the first render — the restore
 * effect's comment owns that lesson). */
const GEO_MOBILE_BP = 768;

function clampGeo(g: WinGeo, vw: number, vh: number): WinGeo {
  const w = Math.min(Math.max(g.w, GEO_MIN_W), Math.max(vw - 16, GEO_MIN_W));
  const h = Math.min(Math.max(g.h, GEO_MIN_H), Math.max(vh - 16, GEO_MIN_H));
  return {
    w,
    h,
    x: Math.min(Math.max(g.x, 8), Math.max(vw - w - 8, 8)),
    y: Math.min(Math.max(g.y, 8), Math.max(vh - h - 8, 8)),
  };
}

function defaultGeo(vw: number, vh: number): WinGeo {
  const w = Math.min(560, Math.max(vw - 32, GEO_MIN_W));
  const h = Math.min(760, Math.max(vh - 96, GEO_MIN_H));
  return clampGeo({ w, h, x: vw - w - 24, y: 64 }, vw, vh);
}

/* ------------------------------------------------------------------ */
/* The panel                                                            */
/* ------------------------------------------------------------------ */

/** t424 — the transcript filter's chip (全部 / 工具 / 失败). */
function FilterChip({
  active,
  tone = "default",
  onClick,
  children,
}: {
  active: boolean;
  tone?: "default" | "rose";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Chip
      size="md"
      interactive
      asChild
      className={cn(
        active
          ? tone === "rose"
            ? "border-danger-600/40 bg-danger-500/10 text-danger"
            : "border-running-500/50 bg-running/10 text-running"
          : "border-transparent bg-secondary/60 text-muted-foreground hover:text-foreground"
      )}
    >
      <button type="button" onClick={onClick} aria-pressed={active}>
        {children}
      </button>
    </Chip>
  );
}

const SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Workflow, text: "帮我搭一个完整的 SPA 流程：导入 → 运动 → CTF → 挑选 → 2D 分类" },
  { icon: ScanEye, text: "分析 2D 分类结果，结合分辨率推荐保留哪些 class" },
  { icon: LayoutDashboard, text: "画布上现在有哪些任务？下一步该跑什么？" },
];

/** State-driven follow-ups for a NON-empty transcript — the same
 * NEXT_STEPS canon the canvas context menu speaks, phrased as prompts.
 * First match wins (zero-noise law: at most ONE chip, never a wall). */
function buildFollowUp(jobs: JobDTO[]): { icon: LucideIcon; text: string } | null {
  if (jobs.length === 0) return SUGGESTIONS[0];
  const live = jobs.filter((j) => j.status === "running" || j.status === "pending");
  if (live.length > 0) {
    return { icon: Hourglass, text: `等「${live[0].name}」跑完，然后告诉我结果` };
  }
  // a built-but-not-started flow — the head is the next action (downstream
  // auto-starts; an unrunnable head fails honestly through the agent's own
  // report, the same education the canvas Run button gives)
  // (status vocabulary: fresh jobs are IDLE — pending waits on an upstream,
  // running executes; "live" above covers both unsettled kinds)
  const hasIdle = jobs.some((j) => j.status === "idle");
  if (hasIdle) {
    return { icon: Play, text: "把刚建好的流程跑起来，跑完告诉我结果" };
  }
  const class2d = [...jobs].reverse().find((j) => j.type === "class2d" && j.status === "completed");
  if (class2d) {
    return {
      icon: ScanEye,
      text: `分析「${class2d.name}」的分类结果，结合占比和分辨率推荐保留哪些 class`,
    };
  }
  const hasClass2d = jobs.some((j) => j.type === "class2d");
  const upstreamDone = jobs.some(
    (j) =>
      (j.type === "ctffind" || j.type === "motioncorr" || j.type === "import") &&
      j.status === "completed"
  );
  if (!hasClass2d && upstreamDone) {
    return { icon: Workflow, text: "接着搭下一步：建一个 2D 分类并跑起来" };
  }
  return null;
}

export function AssistantPanel() {
  const open = useWorkflowStore((s) => s.aiAssistantOpen);
  const setOpen = useWorkflowStore((s) => s.setAiAssistantOpen);
  // t503 — every openAiAssistant() call bumps this, even when already open:
  // the settle effect below re-runs and the window re-asserts itself at the
  // front of body. The header door always visibly answers.
  const summonSeq = useWorkflowStore((s) => s.aiSummonSeq);
  const aiSettingsOpen = useWorkflowStore((s) => s.aiSettingsOpen);
  const setAiSettingsOpen = useWorkflowStore((s) => s.setAiSettingsOpen);
  const consumeAiPendingPrompt = useWorkflowStore((s) => s.consumeAiPendingPrompt);
  const isMobile = useIsMobile();

  const [items, setItems] = React.useState<UiItem[]>([]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState("思考中…");
  const [needsSetup, setNeedsSetup] = React.useState(false);
  const [modelLabel, setModelLabel] = React.useState<string | null>(null);
  // t472 — the active provider's last probe; the badge confesses when not ok
  const [health, setHealth] = React.useState<AiProviderHealthDto | null>(null);
  // ---- t424 deepening state (the dead lane's session-history work) -----
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [sessions, setSessions] = React.useState<AiSessionSummaryDto[]>([]);
  const [armedDelete, setArmedDelete] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "tools" | "fails">("all");
  const [showJump, setShowJump] = React.useState(false);
  // t502 — the restored conversation's age face: one-time, ephemeral, not
  // an event and not persisted (the transcript itself stays plain).
  const [staleBanner, setStaleBanner] = React.useState(false);
  // ---- t428: the drawer's rename door (one row edits at a time) --------
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  // ---- t430: the drawer's search + day grouping --------------------------
  const [sessionQuery, setSessionQuery] = React.useState("");
  // the live canvas census — the follow-up chip's datasource (jobs refresh
  // with every poll tick, so the chip tracks reality, not a snapshot)
  const jobs = useWorkflowStore((s) => s.jobs);
  const seq = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const hydrated = React.useRef(false);
  const autoScroll = React.useRef(true);
  /** The stop switch — checked between rounds; the in-flight fetch aborts. */
  const abortRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const armTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- t500: the floating window (desktop) — geometry, drag, resize ----
  const [geo, setGeo] = React.useState<WinGeo | null>(null);
  // t638 — storage echoes INTENT, one echo per gesture (the Task 153 #13
  // family law this panel was quietly minting against). The old
  // persist-on-change effect had two sins: it fired ~60×/s during a drag,
  // and on FRESH BOOT the restore effect's setGeo(stored | default)
  // tripped it into writing the DEFAULT geometry under the user's name —
  // a position nobody chose, faithfully restored forever after (t157's
  // Phase F caught exactly this mint). The echo now lives at gesture END:
  // a drag persists ONCE on pointerup (and only if the hand actually
  // moved — a bare click says nothing), the double-click snap-home
  // persists once by itself. Everything else — boot restore, viewport
  // resize clamps — is a view-time accommodation, applied on read and
  // never written back: storage holds the shape the user chose, not the
  // shape the viewport lent. geoRef mirrors the live shape for the
  // unmounting-proof window listeners; dragMovedRef separates "a drag
  // happened" from "a drag moved".
  const geoRef = React.useRef<WinGeo | null>(null);
  const dragMovedRef = React.useRef(false);
  const dragRef = React.useRef<{
    mode: "move" | "e" | "s" | "se";
    px: number;
    py: number;
    start: WinGeo;
  } | null>(null);

  // ---- t501: the companion contract + click-to-front -------------------
  // While open, the window registers as a COMPANION — every Dialog in the
  // app then yields its modality (no mask, no focus trap, no body-wide
  // pointer-events siege), which is what makes「参数页 + AI 助手同时操作」
  // possible at all. The attribute half of the contract sits on the root
  // div below ([data-companion-window]) and is what the shared
  // DialogContent guards match interactions against.
  const registerCompanion = useCompanionWindow();
  React.useEffect(() => {
    if (!open) return;
    return registerCompanion();
  }, [open, registerCompanion]);

  // The window's root — a direct body child (createPortal). Click-to-front:
  // every pointerdown inside re-appends the node to the END of body, the
  // window-manager's z-tiebreaker among the body-level z-50 citizens
  // (dialogs portal there too, so LAST-MOUNTED wins — and a touch re-orders
  // without remounting, which would dump leaf state). Cheap no-op when
  // already last.
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const raiseToFront = () => {
    const el = rootRef.current;
    if (
      el &&
      el.isConnected &&
      el.parentElement === document.body &&
      document.body.lastElementChild !== el
    ) {
      document.body.appendChild(el);
    }
  };

  // t503 — the origin stamp for the dialog-raise observer below: a dialog
  // opened BY a click inside this window (the AI-settings door in the
  // header, e.g.) must land ON TOP — the user just asked for it. The
  // origin is WHERE the last pointerdown landed (companion zone or not),
  // recorded by a document-level capture listener — latency-free, unlike
  // the first draft's 150ms time window which a slow dev-mode render
  // (portal mounting 200ms+ after the click) simply outlived.
  const lastPtrInCompanion = React.useRef(false);
  React.useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      lastPtrInCompanion.current = !!(
        e.target instanceof Element &&
        e.target.closest('[data-companion-window]')
      );
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [open]);
  const onRootPointerDownCapture = () => {
    raiseToFront();
  };

  // The summon race: registering as a companion can flip an open modal
  // dialog to non-modal, and Radix's implementation swap REMOUNTS that
  // dialog's content — the fresh portal appends to body AFTER this window,
  // so the dialog the user just summoned OVER lands on top of it. One
  // delayed re-raise settles the order the way the gesture meant it: the
  // just-summoned window leads. t503: the effect also re-runs on every
  // summonSeq bump — clicking the header door while this window is
  // already open (possibly buried under a dialog that opened later) now
  // re-asserts it instead of being a silent no-op.
  React.useEffect(() => {
    if (!open) return;
    raiseToFront();
    const t = setTimeout(raiseToFront, 60);
    return () => clearTimeout(t);
  }, [open, summonSeq]);

  // t503 — the burial law: a dialog that OPENS while this window is open
  // must not stack above it. Radix portals every shared Dialog's content
  // as a DIRECT body child ([data-slot="dialog-content"]), appended at the
  // end — which paints over this window (both z-50, DOM order decides).
  // The user's ticket: the job detail page opened after the assistant and
  // completely covered it, with no way back (a covered window cannot be
  // clicked to raise itself). The observer flips the order back — the
  // companion contract says dialogs YIELD. The escape hatch: when the
  // mount follows a pointerdown INSIDE this window (the AI-settings door),
  // the dialog keeps the front — it was summoned from here on purpose.
  // AlertDialog is a separate primitive (alert-dialog-content) and stays
  // deliberately above; mobile is exempt (the full-screen face owns the
  // viewport; nothing to un-bury).
  React.useEffect(() => {
    if (!open || isMobile) return;
    const isDialogContent = (n: Node): n is Element =>
      n instanceof Element &&
      (n.matches('[data-slot="dialog-content"]') ||
        !!n.querySelector('[data-slot="dialog-content"]'));
    const mo = new MutationObserver((muts) => {
      // t503b — a DOM MOVE reports the same node in BOTH removedNodes and
      // addedNodes (one record): that is the dialog's own click-to-front
      // (dialog.tsx re-appends its content), not a fresh mount. Without
      // this filter the two laws fight — the dialog raises itself, the
      // observer reads the move as a mount, and re-buries it under this
      // window a frame later; the user could NEVER bring a dialog to the
      // front by clicking it. A move is not a mount: ignore it.
      const moved = new Set<Node>();
      for (const m of muts) for (const n of m.removedNodes) moved.add(n);
      let mounted = false;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (moved.has(n)) continue;
          if (isDialogContent(n)) mounted = true;
        }
      }
      if (!mounted) return;
      // a dialog summoned from INSIDE a companion window (the AI-settings
      // door) keeps the front — the last pointerdown was in here on
      // purpose; anything else (canvas card, header, palette) yields.
      if (lastPtrInCompanion.current) return;
      // let the dialog finish mounting (focus, measurements) before the
      // re-order — a settled move, not a race
      setTimeout(raiseToFront, 0);
    });
    mo.observe(document.body, { childList: true });
    return () => mo.disconnect();
  }, [open, isMobile]);

  // restore the persisted geometry (or take the default home position).
  // A MOBILE mount mints nothing: the full-screen face needs no geometry,
  // and a phone-shaped default must not leak into the desktop world —
  // the viewport listener mints the desktop shape when the world grows.
  // (The check is RUNTIME innerWidth, not the isMobile hook: useIsMobile
  // answers false on the first render — its matchMedia effect has not run
  // yet — and this effect would mint the phone-shaped default before the
  // hook catches up.)
  React.useEffect(() => {
    if (window.innerWidth < 768) return;
    try {
      const raw = localStorage.getItem(GEO_KEY);
      if (raw) {
        const g = JSON.parse(raw) as Partial<WinGeo>;
        if (
          typeof g?.x === "number" &&
          typeof g?.y === "number" &&
          typeof g?.w === "number" &&
          typeof g?.h === "number"
        ) {
          setGeo(clampGeo(g as WinGeo, window.innerWidth, window.innerHeight));
          return;
        }
      }
    } catch {
      /* a corrupt payload is just the default position */
    }
    setGeo(defaultGeo(window.innerWidth, window.innerHeight));
  }, []);

  // t638 — the geo mirror (the gesture listeners below close over
  // nothing; the ref is how they read the live shape at gesture end)
  React.useEffect(() => {
    geoRef.current = geo;
  }, [geo]);

  // the viewport may shrink (window resize, devtools) — the window stays
  // inside. Mobile-width viewports are EXEMPT: they render the full-screen
  // face and their narrow clamp would poison the persisted desktop shape
  // (the t500 live lane caught exactly this: 390px viewport → 374px width
  // written back → desktop reopened to a sliver).
  React.useEffect(() => {
    const MOBILE_BP = 768; // use-mobile's own breakpoint
    const onResize = () => {
      if (window.innerWidth < MOBILE_BP) return;
      // prev ?? default: a MOBILE-first session has no geometry yet — the
      // desktop arrival mints the home corner, not a phone-shaped sliver
      setGeo((prev) =>
        clampGeo(
          prev ?? defaultGeo(window.innerWidth, window.innerHeight),
          window.innerWidth,
          window.innerHeight
        )
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // one listener pair for every drag mode (move + three resize grips)
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.px;
      const dy = e.clientY - d.py;
      dragMovedRef.current = true; // t638 — this gesture actually moved
      setGeo((prev) => {
        const base = prev ?? d.start;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (d.mode === "move") {
          return clampGeo({ ...base, x: d.start.x + dx, y: d.start.y + dy }, vw, vh);
        }
        const w = d.mode === "s" ? base.w : Math.max(GEO_MIN_W, d.start.w + dx);
        const h = d.mode === "e" ? base.h : Math.max(GEO_MIN_H, d.start.h + dy);
        return clampGeo({ ...base, w, h }, vw, vh);
      });
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.userSelect = "";
        // t638 — one echo per gesture, at its end: the shape is written
        // ONCE when the hand lets go (and only if it moved), instead of
        // ~60 setItem calls a second on the way there. The live viewport
        // check (not the lagging isMobile hook) keeps a phone-shaped
        // session from ever writing desktop geometry.
        if (dragMovedRef.current && geoRef.current && window.innerWidth >= GEO_MOBILE_BP) {
          try {
            localStorage.setItem(GEO_KEY, JSON.stringify(geoRef.current));
          } catch {
            /* private mode etc — position is a session-only luxury then */
          }
        }
        dragMovedRef.current = false;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const beginDrag = (e: React.PointerEvent, mode: "move" | "e" | "s" | "se") => {
    if (e.button !== 0) return;
    // the header's own controls (the X, search, rename inputs) never drag
    if (
      mode === "move" &&
      (e.target as HTMLElement).closest("button, input, a, textarea, [data-nodrag]")
    ) {
      return;
    }
    const base = geo ?? defaultGeo(window.innerWidth, window.innerHeight);
    dragRef.current = { mode, px: e.clientX, py: e.clientY, start: base };
    dragMovedRef.current = false; // t638 — each gesture's echo is its own
    document.body.style.userSelect = "none"; // no text-selection trails
    // NOTE: no e.preventDefault() here — preventDefault on pointerdown
    // suppresses the derived mouse events (click/dblclick), and the header's
    // double-click-to-reset rides dblclick; touch scrolling is prevented by
    // the touch-none class instead (the CSS way, not the event way).
  };

  const resetGeo = () => {
    const home = defaultGeo(window.innerWidth, window.innerHeight);
    setGeo(home);
    // t638 — snap-home is the user's own choice: one echo, immediately
    if (window.innerWidth >= GEO_MOBILE_BP) {
      try {
        localStorage.setItem(GEO_KEY, JSON.stringify(home));
      } catch {
        /* private mode etc — position is a session-only luxury then */
      }
    }
  };

  // t500: double-click-to-reset rides a NATIVE listener on the header (a
  // ref, not React's onDoubleClick). React 19's synthetic lane ignored
  // programmatic dblclick dispatches in the live lane (the click/button
  // door worked, the dblclick door did not — recorded honestly); a native
  // listener is the door that always opens, and it lives/dies with the
  // header node so HMR cannot leak it.
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const hdr = headerRef.current;
    if (!hdr || isMobile) return;
    const onDbl = () => resetGeo();
    hdr.addEventListener("dblclick", onDbl);
    return () => hdr.removeEventListener("dblclick", onDbl);
    // open matters: the header node only EXISTS while the window is mounted
    // (the panel returns null when closed) — without it the listener binds
    // once against a null ref and never re-runs on reopen.
  }, [isMobile, open]);

  /** t797 — the close hand-back: the family law reaching the one floating
   *  surface Radix never adopted. The companion is not a Radix layer — no
   *  trigger-refocus machinery closes behind it — so both of its close
   *  mouths (the layered-Esc peel, the header X) learned the law by hand:
   *  the keyboard returns to the summon door after the panel unmounts
   *  (the t788 order: the DOM commits first — the rAF lands post-commit,
   *  the t794 wall-relay precedent; the t774 contract: preventScroll).
   *  Two stands-down keep the hand-back honest:
   *   • the focus guard — a close whose focus already lives elsewhere (the
   *     door toggle itself, the tab order's own journey) steals from
   *     nobody; only a close that orphans OUR focus hands anything back.
   *   • the flip guard — with a dialog-family surface open beneath, the
   *     companion's close flips the dialog back to modal and Radix
   *     REMOUNTS its content subtree (the t501-documented flip price);
   *     the remount's onMountAutoFocus owns the landing (witnessed live:
   *     the dialog's first tabbable reasserts). A hand-back here would
   *     fire AFTER the remount and steal the keyboard out of the dialog
   *     world the user is still working in — stand down.
   *  The door carries [data-dialog-live] (the t501 summon-door mark), so
   *  the landing doubles as a live-zone focusin — the t796 exemption
   *  keeps the dialog's return address armed for its own Escape. */
  const closeWithHandBack = React.useCallback(() => {
    const focusInside =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.closest("[data-companion-window]") != null;
    const dialogBeneath = document.querySelector(
      '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"]'
    );
    setOpen(false);
    if (!focusInside || dialogBeneath) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-dialog-live]")?.focus({ preventScroll: true });
    });
  }, [setOpen]);

  const onWindowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    // t430's layered Esc, floating edition: a live query in the session
    // search is cleared FIRST (the search box's own handler already
    // preventDefaults — this is the same law without Radix's capture
    // phase); an empty query closes the window.
    const t = e.target as HTMLElement | null;
    if (t && t.closest("[data-session-search]") && sessionQuery.trim().length > 0) {
      e.preventDefault();
      setSessionQuery("");
      return;
    }
    closeWithHandBack();
  };

  // ---- t424: the transcript filter's math (chips render only when the
  // session carries enough tool cards to be worth filtering)
  const toolCount = items.reduce((n, i) => (i.kind === "tool" ? n + 1 : n), 0);
  const failCount = items.reduce((n, i) => (i.kind === "tool" && !i.ok ? n + 1 : n), 0);
  const visibleItems =
    filter === "all" ? items : items.filter((i) => i.kind === "tool" && (filter === "tools" || !i.ok));

  // ---- t430: the drawer's search + day groups (pure helpers, benched) --
  const searching = sessionQuery.trim().length > 0;
  const visibleSessions = React.useMemo(() => filterSessions(sessions, sessionQuery), [sessions, sessionQuery]);
  const sessionGroups = React.useMemo(() => groupSessionsByDay(visibleSessions), [visibleSessions]);
  /** Single group + no query = the flat list the drawer has always been
   *  (a label over every row is noise when every row is 今天). */
  const flatSessions = !searching && sessionGroups.length <= 1;

  // ---- rehydrate on open AND on project/workspace switch (once per
  // change; the latest session of the active project). t500: the panel
  // used to rehydrate only on OPEN — a panel left open across a project
  // switch kept the OLD project's sessionId and the next send died on
  // the server's pinning law ("Session not found"). Now the switch
  // re-rehydrates; a live send loop belongs to the world it started in,
  // so it is stopped first.
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  React.useEffect(() => {
    if (!open) return;
    if (busy) {
      abortRef.current = true;
      abortControllerRef.current?.abort();
    }
    autoScroll.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/chat");
        if (!res.ok) return;
        const data = (await res.json()) as { session: { id: string; messages: AiMessage[] } | null };
        if (cancelled) return;
        if (data.session && data.session.messages.length > 0) {
          setSessionId(data.session.id);
          setItems(messagesToItems(data.session.messages));
          // t502 — aged tool readings in a restored transcript float the
          // banner; a fresh conversation stays silent.
          setStaleBanner(hasAgedToolHistory(data.session.messages, Date.now()));
        } else {
          setSessionId(null);
          setItems([]);
          setStaleBanner(false);
        }
      } catch {
        /* offline start with an empty transcript */
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
      hydrated.current = false;
    };
  }, [open, activeWorkspaceId]);

  // ---- the active model badge (and the honest setup state) ---------------
  // Runs when the panel opens AND when the settings dialog closes — the
  // badge reflects the provider the user just saved without a reload.
  React.useEffect(() => {
    if (!open || aiSettingsOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/settings");
        if (!res.ok) return;
        const data = (await res.json()) as AiSettingsResponse;
        if (cancelled) return;
        const id = data.settings?.activeProvider ?? null;
        setNeedsSetup(!id);
        if (!id) {
          setModelLabel(null);
          return;
        }
        const label = data.providers.find((p) => p.id === id)?.label ?? id;
        const model = data.settings.providers?.[id]?.model ?? "";
        setModelLabel(model ? `${label} · ${model}` : label);
        setHealth(data.settings.health ?? null);
      } catch {
        /* offline → no badge; the chat error path still teaches setup */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, aiSettingsOpen]);

  // ---- the one-shot pending prompt (class gallery's「AI 分析」door)
  React.useEffect(() => {
    if (!open) return;
    const pending = consumeAiPendingPrompt();
    if (pending && !busy) void send(pending);
  }, [open]);

  // ---- auto scroll while the user hasn't scrolled up --------------------
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && autoScroll.current) el.scrollTop = el.scrollHeight;
  }, [items, busyLabel]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    autoScroll.current = near;
    setShowJump(!near && items.length > 0);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    autoScroll.current = true;
    setShowJump(false);
  }

  // ---- t424: the history drawer ----------------------------------------
  async function loadSessions() {
    try {
      const res = await fetch("/api/ai/sessions");
      if (!res.ok) return;
      const data = (await res.json()) as { sessions?: AiSessionSummaryDto[] };
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      /* the drawer keeps its previous list — best-effort refresh */
    }
  }

  function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    setArmedDelete(null);
    setRenamingId(null);
    if (next) void loadSessions();
  }

  async function switchSession(id: string) {
    if (busy || id === sessionId) {
      setHistoryOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/ai/sessions/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { session?: { id: string; messages: AiMessage[] } | null };
      if (!data.session) return;
      setSessionId(data.session.id);
      setItems(messagesToItems(data.session.messages));
      // t502 — the drawer switch is a restore too: the same age law.
      setStaleBanner(hasAgedToolHistory(data.session.messages, Date.now()));
      setFilter("all");
      autoScroll.current = true;
      setShowJump(false);
      setHistoryOpen(false);
    } catch {
      /* switching is best-effort — the current transcript stays */
    }
  }

  function armDelete(id: string) {
    setArmedDelete(id);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmedDelete(null), 2600);
  }

  async function removeSession(id: string) {
    if (armedDelete !== id) {
      armDelete(id);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmedDelete(null);
    try {
      const res = await fetch(`/api/ai/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === sessionId) {
        // the open transcript just lost its storage — hand out a fresh
        // empty session (the reset door), never silently adopt another
        // past conversation on the next send
        await resetChat();
      }
    } catch {
      /* best-effort */
    }
  }

  // ---- t428: the drawer's rename + export doors -------------------------
  function beginRename(s: AiSessionSummaryDto) {
    setArmedDelete(null);
    setRenamingId(s.id);
    setRenameDraft(s.title ?? "");
    // the input mounts on the next render — focus it there
    requestAnimationFrame(() => renameInputRef.current?.select());
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameDraft("");
  }

  async function commitRename(id: string) {
    const draft = renameDraft;
    setRenamingId(null);
    setRenameDraft("");
    // unchanged draft → no round-trip (the drawer row never flickers)
    const current = sessions.find((s) => s.id === id);
    if (current && (current.title ?? "") === draft.trim()) return;
    try {
      const res = await fetch(`/api/ai/sessions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: draft }),
      });
      if (!res.ok) {
        toast({ title: "重命名失败 — 会话可能已被删除", variant: "destructive" });
        return;
      }
      const data = (await res.json()) as { ok: boolean; title: string | null };
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: data.title } : s))
      );
    } catch {
      toast({ title: "重命名失败 — 网络不可达", variant: "destructive" });
    }
  }

  async function exportSession(id: string, format: "md" | "json") {
    try {
      const res = await fetch(`/api/ai/sessions/${id}?format=${format}`);
      if (!res.ok) {
        toast({ title: "导出失败 — 会话可能已被删除", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      // Content-Disposition carries the server's canonical ASCII name;
      // anything else (proxy stripping) falls back to a dated name.
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `ai-session-${new Date().toISOString().slice(0, 10)}.${format}`;
      downloadBlob(blob, filename);
      toast({ title: format === "md" ? "已导出 Markdown 会话记录" : "已导出 JSON 会话记录" });
    } catch {
      toast({ title: "导出失败 — 网络不可达", variant: "destructive" });
    }
  }

  function stopGenerating() {
    abortRef.current = true;
    abortControllerRef.current?.abort();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setStaleBanner(false); // t502 — the user spoke: the conversation is live again
    abortRef.current = false;
    setBusyLabel("思考中…");
    setItems((prev) => [...prev, { kind: "user", text: message, key: `u${Date.now()}` }]);

    let mySession = sessionId;
    let first = true;
    let guard = 0;
    try {
      for (;;) {
        if (abortRef.current) {
          setItems((prev) => [
            ...prev,
            { kind: "notice", variant: "stop", text: "已停止 — 画布上已完成的操作保留，可以继续提问。", key: `stop${Date.now()}` },
          ]);
          break;
        }
        guard++;
        if (guard > 40) throw new Error("连续轮次过多，已停止 — 请发送新消息继续");
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(first ? { message } : { continue: true }),
            ...(mySession ? { sessionId: mySession } : {}),
            // t508 — the sweep's testimony rides EVERY request (ctx is
            // per-iteration server-side): the race is client session
            // memory, and the agent's sweep tool can only quote what the
            // client hands it. getState() = the freshest race at send time.
            sweep: useWorkflowStore.getState().lastSweep,
          }),
          signal: controller.signal,
        });
        first = false;
        const data = (await res.json()) as AiChatResponse & { error?: string; needsSetup?: boolean };
        if (data.needsSetup) setNeedsSetup(true);
        if (!res.ok) {
          throw new Error(data.error ?? `请求失败 (${res.status})`);
        }
        mySession = data.sessionId;
        setSessionId(data.sessionId);
        seq.current++;
        setItems((prev) => [...prev, ...eventsToItems(data.events, seq.current)]);
        // the canvas should hear about it immediately — jobs through the
        // poll, WIRES through the edges pull (the poll never refreshes
        // edges, and this panel's tools draw them server-side)
        void useWorkflowStore.getState().pollTick();
        void useWorkflowStore.getState().refreshEdges();
        if (!data.needsContinue) break;
        setBusyLabel("执行工具后继续…");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setItems((prev) => [
          ...prev,
          { kind: "notice", variant: "stop", text: "已停止 — 画布上已完成的操作保留，可以继续提问。", key: `stop${Date.now()}` },
        ]);
      } else {
        const message2 = err instanceof Error ? err.message : String(err);
        setItems((prev) => [
          ...prev,
          { kind: "notice", variant: "error", text: message2, key: `err${Date.now()}` },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
      if (historyOpen) void loadSessions(); // the drawer hears about the new turns
    }
  }

  async function resetChat() {
    if (busy) return;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { sessionId?: string };
        if (data.sessionId) setSessionId(data.sessionId);
      }
    } catch {
      /* reset is best-effort — an empty local transcript is the fallback */
    }
    setItems([]);
    setFilter("all");
    setStaleBanner(false); // t502 — a new chat has no history to be old
    if (historyOpen) void loadSessions();
    toast({ title: "已开始新对话", description: "画布上的任务不受影响" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // IME guard: while a Chinese input method is composing, Enter CONFIRMS
    // the composition — sending here would fire a half-typed prompt (the
    // primary audience of this panel types Chinese).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  /** t430 — one drawer row, shared by the flat and the day-grouped list
   *  (the extraction the search/group work forced: two renderings of the
   *  same row would drift). While a search is live, the matched stretch of
   *  the display line gets the amber highlight — only the match the reader
   *  can SEE in the rendered line (matchIndex's law), never a hidden one. */
  const renderSessionRow = (s: AiSessionSummaryDto) => {
    const display = s.title ?? s.preview;
    const hit = searching ? matchIndex(display, sessionQuery) : -1;
    const qLen = sessionQuery.trim().length;
    return (
      <div
        key={s.id}
        role="listitem"
        className={cn(
          "group flex items-center gap-1 rounded-md border bg-card py-1 pl-2 pr-1 transition-colors",
          s.id === sessionId ? "border-primary/50" : "border-transparent hover:border-border"
        )}
      >
        {renamingId === s.id ? (
          // t428: the inline rename editor — Enter commits
          // (IME-composition Enter never fires mid-word), Esc
          // cancels, blur commits; one row edits at a time.
          <input
            ref={renameInputRef}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                void commitRename(s.id);
              } else if (e.key === "Escape") {
                e.preventDefault();
                // t797 — the innermost layer consumes its Escape (the t430
                // layered-Esc law, rename edition): stopPropagation keeps
                // the peel handler out of this event, so cancelling a
                // rename no longer slams the whole panel shut — the NEXT
                // Escape peels. (The search input earns the same layering
                // through the root's live-query veto instead; the rename
                // editor has no veto path, so the boundary lives here.)
                e.stopPropagation();
                cancelRename();
              }
            }}
            onBlur={() => void commitRename(s.id)}
            maxLength={80}
            placeholder="命名这个对话（留空恢复原名）"
            aria-label="会话名称"
            className="my-0.5 min-w-0 flex-1 rounded border border-primary/40 bg-background px-1.5 py-1 text-xs text-foreground outline-none focus-visible:border-primary/70"
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 text-left disabled:opacity-50"
            onClick={() => void switchSession(s.id)}
            disabled={busy}
            title={s.title ? `${s.title}（原文：${s.preview}）` : s.preview}
          >
            <span className="flex items-center gap-1.5">
              {s.id === sessionId && (
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 rounded border-running/40 bg-running/10 px-1 text-[9px] font-medium text-running-700 dark:text-running-400"
                >
                  当前
                </Badge>
              )}
              <span
                className={cn(
                  "truncate text-xs",
                  s.title ? "font-medium text-foreground" : "text-foreground"
                )}
              >
                {hit >= 0 ? (
                  <>
                    {display.slice(0, hit)}
                    <span className="rounded-sm bg-running/20 px-0.5 font-semibold text-foreground">
                      {display.slice(hit, hit + qLen)}
                    </span>
                    {display.slice(hit + qLen)}
                  </>
                ) : (
                  display
                )}
              </span>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{fmtRel(s.updatedAt)}</span>
              <span aria-hidden="true">·</span>
              <span>{s.messageCount} 条消息</span>
              {s.toolCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-running-700/80 dark:text-running-400/80">
                  <Wrench className="size-2.5" aria-hidden="true" />
                  {s.toolCount}
                </span>
              )}
            </span>
          </button>
        )}
        {renamingId === s.id ? (
          <button
            type="button"
            className="h-6 shrink-0 rounded-md border border-danger-600/40 px-1.5 text-[10px] font-medium text-danger-600 transition-colors hover:bg-danger-500/10 dark:text-danger-400"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void commitRename(s.id)}
          >
            保存
          </button>
        ) : (
          <>
            {armedDelete === s.id ? (
              <button
                type="button"
                className="h-6 shrink-0 rounded-md border border-danger-600/40 px-1.5 text-[10px] font-medium text-danger-600 transition-colors hover:bg-danger-500/10 dark:text-danger-400"
                onClick={() => void removeSession(s.id)}
              >
                确认
              </button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-danger-600 focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => armDelete(s.id)}
                aria-label={`删除会话：${(s.title ?? s.preview).slice(0, 20)}`}
                disabled={busy}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              onClick={() => beginRename(s)}
              aria-label={`重命名会话：${(s.title ?? s.preview).slice(0, 20)}`}
              disabled={busy}
              title="重命名"
            >
              <PenLine className="size-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`导出会话：${(s.title ?? s.preview).slice(0, 20)}`}
                  title="导出（Markdown / JSON）"
                >
                  <Download className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onClick={() => void exportSession(s.id, "md")}>
                  <span className="flex flex-col">
                    <span className="text-xs font-medium">Markdown</span>
                    <span className="text-[10px] text-muted-foreground">报告 / ELN 可吸收的档案形制</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportSession(s.id, "json")}>
                  <span className="flex flex-col">
                    <span className="text-xs font-medium">JSON</span>
                    <span className="text-[10px] text-muted-foreground">机器可读 — 工具结果为结构化字段</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    );
  };

  if (!open) return null;

  // t501 — the window is a DIRECT BODY CHILD via portal. Dialogs (and every
  // Radix popover that leaves a dialog) portal to body as z-50 too, so the
  // stack order among them is DOM order: mount-order first, then whoever
  // was touched last (raiseToFront). A body-level window also escapes any
  // stacking context the app shell might grow (transforms, filters).
  return createPortal(
    <div
      ref={rootRef}
      // t501 — the companion contract: [data-companion-window] is what the
      // shared DialogContent guards match; data-ai-assistant is the honest
      // name for probes/benches.
      data-ai-assistant=""
      data-companion-window=""
      role="dialog"
      aria-modal="false"
      aria-label="AI 助手"
      onKeyDown={onWindowKeyDown}
      onPointerDownCapture={onRootPointerDownCapture}
      className={cn(
        // pointer-events-auto: some layer COULD still flip body-wide
        // pointer-events off (a modal Select, an AlertDialog) — the window
        // re-asserts its own liveness instead of inheriting the siege.
        // z-50 ties it with dialogs; DOM order decides (see createPortal).
        "no-print pointer-events-auto fixed z-50 flex flex-col overflow-hidden bg-card shadow-2xl outline-none",
        isMobile
          ? "inset-0"
          : "rounded-xl border animate-in fade-in-95 zoom-in-95 duration-150"
      )}
      style={
        !isMobile
          ? (() => {
              const g = geo ?? defaultGeo(window.innerWidth, window.innerHeight);
              return { left: g.x, top: g.y, width: g.w, height: g.h };
            })()
          : undefined
      }
    >
      <div className="sr-only">
        用自然语言创建、连接和运行 cryo-EM 任务。桌面端可拖动标题栏移动窗口，右下角调整大小。
      </div>

        {/* ---- panel header (the drag handle on desktop) ---- */}
        {/* t500: the header IS the drag surface — double-click snaps the
            window back to its home corner. The window's own controls are
            excluded from the drag by beginDrag's control filter, so the
            X and the tool buttons still click. */}
        <div
          ref={headerRef}
          className={cn(
            "flex shrink-0 touch-none items-center gap-2.5 border-b bg-gradient-to-r from-primary/[0.07] via-primary/[0.02] to-transparent px-4 py-3 select-none",
            !isMobile && "cursor-grab active:cursor-grabbing"
          )}
          onPointerDown={isMobile ? undefined : (e) => beginDrag(e, "move")}
          title={isMobile ? undefined : "拖动移动 · 双击复位"}
        >
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm"
            aria-hidden="true"
          >
            <Sparkles className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold leading-tight">AI 助手</p>
              {modelLabel && (
                <Badge
                  variant="outline"
                  className={cn(
                    "hidden max-w-[200px] gap-1 truncate border-running/40 bg-running/10 px-1.5 font-mono text-[10px] font-normal text-running sm:inline-flex",
                    health && health.state !== "ok" && "border-warning-500/50 bg-warning/10 text-warning-700 dark:text-warning-400"
                  )}
                  title={
                    health && health.state !== "ok"
                      ? `${modelLabel} — ${health.detail}`
                      : modelLabel
                  }
                >
                  <Cpu className="size-2.5 shrink-0" aria-hidden="true" />
                  {health && health.state !== "ok" && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        health.state === "unreachable" ? "bg-danger" : "bg-warning-500"
                      )}
                    />
                  )}
                  <span className="truncate">{modelLabel}</span>
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {needsSetup ? "未配置 — 点击设置选择供应商" : "自然语言 · 建流程 · 跑任务 · 判 class"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 shrink-0 text-muted-foreground hover:text-foreground",
              historyOpen && "bg-accent text-foreground"
            )}
            onClick={toggleHistory}
            aria-label="Session history"
            aria-expanded={historyOpen}
            title="历史会话"
          >
            <History className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setAiSettingsOpen(true)}
            aria-label="AI provider settings"
            title="AI 供应商设置"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => void resetChat()}
            disabled={busy}
            aria-label="New chat"
            title="新对话"
          >
            <RotateCcw className="size-4" />
          </Button>
          {/* the window's own X — t500's floating face replaced Radix's
              built-in (no more pr-14 kill-zone law; the button lives here,
              right of every control, and never eats their clicks) */}
          <Button
            variant="ghost"
            size="icon"
            data-nodrag=""
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => closeWithHandBack()}
            aria-label="关闭 AI 助手"
            title="关闭 (Esc)"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* ---- t424: the history drawer -------------------------------- */}
        {historyOpen && (
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">历史会话</p>
              <span className="text-[10px] text-muted-foreground/70">
                {searching
                  ? `${visibleSessions.length} / ${sessions.length} 个对话`
                  : sessions.length > 0
                    ? `${sessions.length} 个对话`
                    : ""}
              </span>
            </div>
            {/* t430 — search: one word narrows the history (title + preview,
                case-insensitive; a rename must not hide the opening words,
                an unnamed session must be findable by its first question).
                Esc clears; the row only exists when there is something to
                search — zero noise on an empty drawer. */}
            {sessions.length > 0 && (
              <div className="relative mb-1.5">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/60"
                  aria-hidden="true"
                />
                <input
                  data-session-search=""
                  value={sessionQuery}
                  onChange={(e) => setSessionQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      // the value-clear lives here (bubble phase, always
                      // runs); the CLOSE veto lives in the window's own
                      // onKeyDown (t500's floating face — no Radix layer
                      // anymore): a live query is cleared first, an empty
                      // query lets the close proceed
                      e.preventDefault();
                      setSessionQuery("");
                    }
                  }}
                  placeholder="搜索对话…"
                  aria-label="搜索历史会话"
                  className="h-6 w-full rounded-md border bg-background pl-7 pr-6 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-primary/50"
                />
                {searching && (
                  <button
                    type="button"
                    onClick={() => setSessionQuery("")}
                    aria-label="清除搜索"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground/60 transition-colors hover:text-foreground"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            <div className="max-h-56 space-y-1 overflow-y-auto" role="list" aria-label="Session history">
              {sessions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground/70">这个画布还没有更早的对话</p>
              ) : visibleSessions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground/70">
                  没有匹配「{sessionQuery.trim()}」的对话
                </p>
              ) : flatSessions ? (
                visibleSessions.map(renderSessionRow)
              ) : (
                // t430 — day buckets (今天/昨天/7 天内/更早): the wall-clock
                // words a scientist scans by; empty buckets vanish, the
                // newest-first order inside each bucket is untouched
                sessionGroups.map((g) => (
                  <div key={g.label}>
                    <p className="px-1 pb-0.5 pt-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">
                      {g.label}
                    </p>
                    {g.items.map(renderSessionRow)}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---- t424: transcript view filter (only when it has something to say) */}
        {toolCount >= 3 && (
          <div className="flex items-center gap-1.5 border-b px-4 py-1.5" role="group" aria-label="Transcript filter">
            <span className="mr-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">视图</span>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              全部 · {items.length}
            </FilterChip>
            <FilterChip active={filter === "tools"} onClick={() => setFilter("tools")}>
              <Wrench className="size-2.5" aria-hidden="true" />
              工具 · {toolCount}
            </FilterChip>
            {failCount > 0 && (
              <FilterChip active={filter === "fails"} tone="rose" onClick={() => setFilter("fails")}>
                <XCircle className="size-2.5" aria-hidden="true" />
                失败 · {failCount}
              </FilterChip>
            )}
          </div>
        )}

        {/* ---- transcript ---- */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full space-y-3 overflow-y-auto px-4 py-4"
            role="log"
            aria-live="polite"
            aria-label="AI assistant transcript"
          >
          {items.length === 0 && !busy && (
            <div className="flex flex-col items-center gap-4 pt-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/15 to-cyan-500/10 ring-1 ring-running/25">
                <Bot className="size-7 text-running" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium">用一句话指挥整条流程</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  建任务 · 连线 · 设参数 · 跑流程 · 判 class
                </p>
              </div>
              <div className="grid w-full gap-2 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => void send(s.text)}
                    className="group flex w-full items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-sm"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <s.icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground transition-colors group-hover:text-foreground">
                      {s.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {visibleItems.map((item) =>
            item.kind === "user" ? (
              <div key={item.key} className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground shadow-sm">
                  {item.text}
                </div>
                {item.at ? (
                  <span className="mr-1 mt-0.5 text-[10px] text-muted-foreground/60">{fmtTime(item.at)}</span>
                ) : null}
              </div>
            ) : item.kind === "notice" ? (
              <Notice key={item.key} item={item} />
            ) : item.kind === "assistant" ? (
              <div key={item.key} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm"
                  aria-hidden="true"
                >
                  <Sparkles className="size-3" />
                </span>
                <div className="min-w-0 max-w-[92%] rounded-2xl rounded-tl-sm bg-muted/50 px-3 py-2">
                  {/* t500 — the text is split into markdown and ACTION
                      segments (the model's :::actions fences); each md
                      segment keeps the full prose styling, each actions
                      segment renders the clickable 方案 buttons */}
                  {parseActionBlocks(item.text).map((seg, si) =>
                    seg.kind === "md" ? (
                      seg.text.trim() ? (
                        <div
                          key={si}
                          className="text-sm leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:mt-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_hr]:my-2 [&_hr]:border-border [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:text-left [&_table]:text-xs [&_td]:border-t [&_td]:px-1.5 [&_td]:py-1 [&_td]:align-top [&_th]:border-b [&_th]:px-1.5 [&_th]:py-1 [&_th]:font-semibold">
                          <Markdown remarkPlugins={[remarkGfm]} components={PROSE_COMPONENTS} urlTransform={urlTransformKeepDoors}>{linkifyJobs(seg.text, jobs)}</Markdown>
                        </div>
                      ) : null
                    ) : (
                      <ActionButtons
                        key={si}
                        actions={seg.actions}
                        onPick={(p) => void send(p)}
                        disabled={busy}
                      />
                    )
                  )}
                </div>
              </div>
            ) : (
              <ToolCard key={item.key} item={item} />
            )
          )}

          {busy && (
            <div className="flex items-start gap-2.5" aria-live="polite">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm"
                aria-hidden="true"
              >
                <Sparkles className="size-3" />
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted/50 px-3 py-2.5">
                <span className="flex items-center gap-1" aria-hidden="true">
                  <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-primary/70" />
                </span>
                <span className="text-xs text-muted-foreground">{busyLabel}</span>
                <Badge
                  variant="outline"
                  className="gap-1 border-running/40 bg-running/10 px-1 text-[10px] font-normal text-running"
                >
                  <Sparkles className="size-2.5" aria-hidden="true" />
                  AI
                </Badge>
              </div>
            </div>
          )}

          {needsSetup && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
              <p className="font-medium text-warning-700 dark:text-warning-400">还没有配置 AI 供应商</p>
              <p className="mt-1 text-muted-foreground">
                选择供应商并填入 API key 后即可使用（OpenAI / Claude / Gemini / DeepSeek / Kimi / GLM / Qwen …）。
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 gap-1 border-warning/40 text-warning-700 dark:text-warning-400"
                onClick={() => setAiSettingsOpen(true)}
              >
                <Settings2 className="size-3.5" aria-hidden="true" />
                打开设置
              </Button>
            </div>
          )}
          </div>

          {/* ---- t424: jump back to the live edge after scrolling up ---- */}
          {showJump && (
            <Button
              size="icon"
              className="absolute bottom-3 right-4 size-7 rounded-full shadow-md"
              onClick={jumpToBottom}
              aria-label="回到底部"
              title="回到底部"
            >
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>

        {/* ---- t502: the restored conversation's age banner ----
            one-time, ephemeral — cleared by a send or a new chat;
            never an event, never persisted, the transcript stays plain */}
        {staleBanner && (
          <div
            data-stale-banner
            role="status"
            className="mx-3 mb-1 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-700 dark:text-warning-400"
          >
            <History className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              这是恢复的旧对话 — 里面的测量读数可能已过期；直接提问，工具会重新测量。
            </span>
          </div>
        )}

        {/* ---- composer ---- */}
        {/* safe-area: on notched phones the composer rides the home
            indicator — the footer's pb-[max(...)] law (iOS inset) */}
        <div
          className={cn(
            "border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3",
            busy && "opacity-80"
          )}
        >
          {/* the contextual follow-up — ONE state-driven chip, never a
              wall (zero-noise law); only for a non-empty, idle transcript */}
          {(() => {
            const follow = items.length > 0 ? buildFollowUp(jobs) : null;
            if (!follow || busy) return null;
            const FIcon = follow.icon;
            return (
              <button
                type="button"
                onClick={() => void send(follow.text)}
                className="mb-2 flex max-w-full items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] leading-relaxed text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
              >
                <FIcon className="size-3 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{follow.text}</span>
              </button>
            );
          })()}
          <div className="relative rounded-xl border bg-muted/20 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="描述你的任务… (Enter 发送，Shift+Enter 换行)"
              className="min-h-[52px] resize-none border-0 bg-transparent pb-9 pl-3 pr-3 pt-2.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
              rows={2}
              disabled={busy}
              aria-label="Message the AI assistant"
              maxLength={8000}
            />
            {busy ? (
              <Button
                size="icon"
                variant="destructive"
                className="absolute bottom-2 right-2 size-8"
                onClick={stopGenerating}
                aria-label="Stop generating"
                title="停止生成"
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="absolute bottom-2 right-2 size-8"
                onClick={() => void send(input)}
                disabled={!input.trim()}
                aria-label="Send"
                title="发送 (Enter)"
              >
                <CornerDownLeft className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            AI 会创建真实任务并在确认后启动运行 — 操作会显示在对话与画布上。
          </p>
        </div>

        {/* ---- t500: the resize grips (desktop) — east, south, and the
            corner. Wide hit areas, invisible until hover; keyboard users
            reach the same geometry through the header's double-click
            reset (a resize grip is a pointer affordance). */}
        {!isMobile && (
          <>
            <div
              className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize touch-none transition-colors hover:bg-primary/20"
              onPointerDown={(e) => beginDrag(e, "e")}
              aria-hidden="true"
              role="presentation"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize touch-none transition-colors hover:bg-primary/20"
              onPointerDown={(e) => beginDrag(e, "s")}
              aria-hidden="true"
              role="presentation"
            />
            <div
              className="absolute bottom-0 right-0 size-4 cursor-nwse-resize touch-none transition-colors hover:bg-primary/25"
              onPointerDown={(e) => beginDrag(e, "se")}
              aria-hidden="true"
              role="presentation"
            >
              <span className="absolute bottom-1 right-1 block size-1.5 rounded-sm border-b border-r border-muted-foreground/50" />
            </div>
          </>
        )}
    </div>,
    document.body
  );
}
