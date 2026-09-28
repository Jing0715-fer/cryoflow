"use client";

/**
 * CryoFlow — the AI assistant panel (t419 → t420 polish round).
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
 */

import * as React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Cpu,
  FileSearch,
  Filter,
  Hourglass,
  LayoutDashboard,
  Link2,
  ListTree,
  Loader2,
  PenLine,
  Play,
  PlusCircle,
  RotateCcw,
  ScanEye,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Workflow,
  Wrench,
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
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store";
import type {
  AiChatResponse,
  AiEvent,
  AiMessage,
  AiSettingsResponse,
} from "@/lib/ai/types";

/* ------------------------------------------------------------------ */
/* Transcript items (flattened from server messages + live events)      */
/* ------------------------------------------------------------------ */

type UiItem =
  | { kind: "user"; text: string; key: string }
  | { kind: "assistant"; text: string; key: string }
  | { kind: "tool"; key: string; id: string; name: string; args: unknown; ok: boolean; summary: string; detail?: unknown };

function argsOneLine(args: unknown): string {
  try {
    const s = JSON.stringify(args ?? {});
    return s.length > 160 ? `${s.slice(0, 160)}…` : s;
  } catch {
    return String(args);
  }
}

function messagesToItems(messages: AiMessage[]): UiItem[] {
  const items: UiItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") {
      items.push({ kind: "user", text: m.content, key: `m${i}` });
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
        });
      }
    }
    // errors render as their own banner item
    else if (e.type === "error") {
      items.push({ kind: "assistant", text: `⚠️ ${e.message}`, key: `e${seq}-${i}` });
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
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-lg border bg-card text-xs shadow-sm transition-colors",
        item.ok ? "hover:border-emerald-600/30" : "border-rose-600/30 hover:border-rose-600/50"
      )}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-muted/40"
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
/* The panel                                                            */
/* ------------------------------------------------------------------ */

const SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Workflow, text: "帮我搭一个完整的 SPA 流程：导入 → 运动 → CTF → 挑选 → 2D 分类" },
  { icon: ScanEye, text: "分析 2D 分类结果，结合分辨率推荐保留哪些 class" },
  { icon: LayoutDashboard, text: "画布上现在有哪些任务？下一步该跑什么？" },
];

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
  const seq = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const hydrated = React.useRef(false);
  const autoScroll = React.useRef(true);
  /** The stop switch — checked between rounds; the in-flight fetch aborts. */
  const abortRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

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
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
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
            { kind: "assistant", text: "⏹ 已停止 — 画布上已完成的操作保留，可以继续提问。", key: `stop${Date.now()}` },
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
          { kind: "assistant", text: "⏹ 已停止 — 画布上已完成的操作保留，可以继续提问。", key: `stop${Date.now()}` },
        ]);
      } else {
        const message2 = err instanceof Error ? err.message : String(err);
        setItems((prev) => [...prev, { kind: "assistant", text: `⚠️ ${message2}`, key: `err${Date.now()}` }]);
      }
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
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
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
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
        <div className="flex items-center gap-2.5 border-b bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.02] to-transparent px-4 py-3 pr-14">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"
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
                  className="hidden max-w-[170px] gap-1 truncate border-amber-600/30 bg-amber-500/[0.06] px-1.5 font-mono text-[10px] font-normal text-amber-700 sm:inline-flex dark:text-amber-400"
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

        {/* ---- transcript ---- */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          role="log"
          aria-live="polite"
          aria-label="AI assistant transcript"
        >
          {items.length === 0 && !busy && (
            <div className="flex flex-col items-center gap-4 pt-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/15 to-orange-500/10 ring-1 ring-amber-500/20">
                <Bot className="size-7 text-amber-600 dark:text-amber-400" aria-hidden="true" />
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
                    className="group flex w-full items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-all hover:border-amber-600/40 hover:bg-amber-500/[0.04] hover:shadow-sm"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
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

          {items.map((item) =>
            item.kind === "user" ? (
              <div key={item.key} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground shadow-sm">
                  {item.text}
                </div>
              </div>
            ) : item.kind === "assistant" ? (
              <div key={item.key} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"
                  aria-hidden="true"
                >
                  <Sparkles className="size-3" />
                </span>
                <div className="min-w-0 max-w-[92%] rounded-2xl rounded-tl-sm bg-muted/50 px-3 py-2">
                  <div className="text-sm leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_strong]:font-semibold">
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
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm"
                aria-hidden="true"
              >
                <Sparkles className="size-3" />
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted/50 px-3 py-2.5">
                <span className="flex items-center gap-1" aria-hidden="true">
                  <span className="size-1.5 animate-bounce rounded-full bg-amber-500/80 [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-amber-500/80 [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-amber-500/80" />
                </span>
                <span className="text-xs text-muted-foreground">{busyLabel}</span>
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-600/30 px-1 text-[10px] font-normal text-amber-700 dark:text-amber-400"
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

        {/* ---- composer ---- */}
        <div className={cn("border-t p-3", busy && "opacity-80")}>
          <div className="relative rounded-xl border bg-muted/20 shadow-sm transition-colors focus-within:border-amber-500/40 focus-within:ring-2 focus-within:ring-amber-500/10">
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
