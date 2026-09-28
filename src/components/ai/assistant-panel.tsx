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
import Markdown from "react-markdown";
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
  LayoutDashboard,
  Link2,
  ListTree,
  Locate,
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
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { filterSessions, groupSessionsByDay, matchIndex } from "@/lib/ai/session-groups";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO } from "@/lib/types";
import type {
  AiChatResponse,
  AiEvent,
  AiMessage,
  AiSettingsResponse,
  AiSessionSummaryDto,
} from "@/lib/ai/types";

/* ------------------------------------------------------------------ */
/* Transcript items (flattened from server messages + live events)      */
/* ------------------------------------------------------------------ */

type UiItem =
  | { kind: "user"; text: string; key: string; at?: number }
  | { kind: "assistant"; text: string; key: string }
  | { kind: "notice"; variant: "stop" | "error"; text: string; key: string }
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
    // errors render as notice banners (the app's warning idiom)
    else if (e.type === "error") {
      items.push({ kind: "notice", variant: "error", text: e.message, key: `e${seq}-${i}` });
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
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <code className="font-mono text-[11px] font-medium text-foreground">{item.name}</code>
              {item.ok ? (
                <CheckCircle2
                  className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-label="succeeded"
                />
              ) : (
                <XCircle
                  className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400"
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
            <pre className="max-h-48 overflow-auto rounded bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {(() => {
                try {
                  return JSON.stringify(item.detail, null, 2).slice(0, 4000);
                } catch {
                  return String(item.detail);
                }
              })()}
            </pre>
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
  const Icon = stop ? Square : AlertTriangle;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
        stop
          ? "border-border bg-muted/40 text-muted-foreground"
          : "border-rose-600/30 bg-rose-500/[0.06] text-rose-700 dark:text-rose-300"
      )}
    >
      <Icon
        className={cn("mt-0.5 size-3 shrink-0", stop && "fill-current")}
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">{item.text}</span>
    </div>
  );
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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
        active
          ? tone === "rose"
            ? "border-rose-600/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
            : "border-teal-500/50 bg-teal-500/10 text-teal-600 dark:text-teal-400"
          : "border-transparent bg-secondary/60 text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
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
  const aiSettingsOpen = useWorkflowStore((s) => s.aiSettingsOpen);
  const setAiSettingsOpen = useWorkflowStore((s) => s.setAiSettingsOpen);
  const consumeAiPendingPrompt = useWorkflowStore((s) => s.consumeAiPendingPrompt);

  const [items, setItems] = React.useState<UiItem[]>([]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState("思考中…");
  const [needsSetup, setNeedsSetup] = React.useState(false);
  const [modelLabel, setModelLabel] = React.useState<string | null>(null);
  // ---- t424 deepening state (the dead lane's session-history work) -----
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [sessions, setSessions] = React.useState<AiSessionSummaryDto[]>([]);
  const [armedDelete, setArmedDelete] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "tools" | "fails">("all");
  const [showJump, setShowJump] = React.useState(false);
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

  // ---- rehydrate on open (once per open; the latest session of this project)
  React.useEffect(() => {
    if (!open) return;
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
        } else {
          setSessionId(null);
          setItems([]);
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
  }, [open]);

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
        toast.error("重命名失败 — 会话可能已被删除");
        return;
      }
      const data = (await res.json()) as { ok: boolean; title: string | null };
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: data.title } : s))
      );
    } catch {
      toast.error("重命名失败 — 网络不可达");
    }
  }

  async function exportSession(id: string, format: "md" | "json") {
    try {
      const res = await fetch(`/api/ai/sessions/${id}?format=${format}`);
      if (!res.ok) {
        toast.error("导出失败 — 会话可能已被删除");
        return;
      }
      const blob = await res.blob();
      // Content-Disposition carries the server's canonical ASCII name;
      // anything else (proxy stripping) falls back to a dated name.
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `ai-session-${new Date().toISOString().slice(0, 10)}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(format === "md" ? "已导出 Markdown 会话记录" : "已导出 JSON 会话记录");
    } catch {
      toast.error("导出失败 — 网络不可达");
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
    if (historyOpen) void loadSessions();
    toast.success("已开始新对话", { description: "画布上的任务不受影响" });
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
                  className="h-4 shrink-0 rounded border-teal-500/40 bg-teal-500/10 px-1 text-[9px] font-medium text-teal-700 dark:text-teal-400"
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
                    <span className="rounded-sm bg-teal-500/20 px-0.5 font-semibold text-foreground">
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
                <span className="inline-flex items-center gap-0.5 text-teal-700/80 dark:text-teal-400/80">
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
            className="h-6 shrink-0 rounded-md border border-rose-600/40 px-1.5 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
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
                className="h-6 shrink-0 rounded-md border border-rose-600/40 px-1.5 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
                onClick={() => void removeSession(s.id)}
              >
                确认
              </button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        onEscapeKeyDown={(e) => {
          // t430 — layered Esc, Radix's own door: DismissableLayer listens
          // on document CAPTURE phase (before any bubble-phase handler can
          // stop it), so the only sanctioned interception is THIS hook —
          // Radix asks before dismissing, and preventDefault vetoes. When
          // the search box owns the focus AND holds a live query, the first
          // Esc clears the query and keeps the panel; an empty query lets
          // the dismiss proceed (second Esc closes, the standard layering).
          const t = e.target as HTMLElement | null;
          if (t && t.closest("[data-session-search]") && sessionQuery.trim().length > 0) {
            e.preventDefault();
            setSessionQuery("");
          }
        }}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[540px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>AI 助手</SheetTitle>
          <SheetDescription>
            用自然语言创建、连接和运行 cryo-EM 任务
          </SheetDescription>
        </SheetHeader>

        {/* ---- panel header ---- */}
        {/* pr-14 (56px) is LAW here: SheetContent paints its own X at
            top-4 right-4 with a 14px hit-slop (46px total reach). This
            panel's own buttons must live left of that zone or the close
            eats their clicks — the overlap this rework was born to fix. */}
        <div className="flex items-center gap-2.5 border-b bg-gradient-to-r from-primary/[0.07] via-primary/[0.02] to-transparent px-4 py-3 pr-14">
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
                  className="hidden max-w-[170px] gap-1 truncate border-teal-500/40 bg-teal-500/10 px-1.5 font-mono text-[10px] font-normal text-teal-600 sm:inline-flex dark:text-teal-400"
                  title={modelLabel}
                >
                  <Cpu className="size-2.5 shrink-0" aria-hidden="true" />
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
                      // runs); the DISMISS veto lives in SheetContent's
                      // onEscapeKeyDown — Radix's document-capture listener
                      // fires before anything bubble-side can stop it
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
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/15 to-cyan-500/10 ring-1 ring-teal-500/25">
                <Bot className="size-7 text-teal-600 dark:text-teal-400" aria-hidden="true" />
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
                  <div className="text-sm leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:mt-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_hr]:my-2 [&_hr]:border-border [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:text-left [&_table]:text-xs [&_td]:border-t [&_td]:px-1.5 [&_td]:py-1 [&_td]:align-top [&_th]:border-b [&_th]:px-1.5 [&_th]:py-1 [&_th]:font-semibold">
                    <Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>
                  </div>
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
                  className="gap-1 border-teal-500/40 bg-teal-500/10 px-1 text-[10px] font-normal text-teal-600 dark:text-teal-400"
                >
                  <Sparkles className="size-2.5" aria-hidden="true" />
                  AI
                </Badge>
              </div>
            </div>
          )}

          {needsSetup && (
            <div className="rounded-lg border border-amber-600/30 bg-amber-500/10 p-3 text-xs">
              <p className="font-medium text-amber-700 dark:text-amber-400">还没有配置 AI 供应商</p>
              <p className="mt-1 text-muted-foreground">
                选择供应商并填入 API key 后即可使用（OpenAI / Claude / Gemini / DeepSeek / Kimi / GLM / Qwen …）。
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 gap-1 border-amber-600/40 text-amber-700 dark:text-amber-400"
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
      </SheetContent>
    </Sheet>
  );
}
