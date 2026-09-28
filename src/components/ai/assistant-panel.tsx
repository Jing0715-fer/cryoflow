"use client";

/**
 * CryoFlow — the AI assistant panel (t419).
 *
 * A right Sheet — the natural-language copilot for the canvas. The loop is
 * CLIENT-driven: every POST /api/ai/chat runs ONE model turn + its tool
 * executions and answers needsContinue; while true, the panel immediately
 * re-POSTs — each tool batch (created jobs, wired edges, VLM verdicts)
 * renders the moment it executed. No SSE, no websocket — the app's polling
 * doctrine untouched (pollTick refreshes the canvas after every round).
 *
 * Transcript survives reloads server-side (GET /api/ai/chat rehydrates the
 * project's latest session); tool cards show name + args + result summary
 * with a collapsible JSON detail; the class gallery's「AI 分析」button opens
 * the panel with a pending prompt (openAiAssistant(question)) that is sent
 * on arrival — the same one-shot contract as pendingClassFocus.
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
  Loader2,
  RotateCcw,
  Settings2,
  Sparkles,
  Wrench,
  XCircle,
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
import type { AiChatResponse, AiEvent, AiMessage } from "@/lib/ai/types";

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

function ToolCard({ item }: { item: Extract<UiItem, { kind: "tool" }> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-md border bg-card text-xs">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {open ? (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          )}
        </span>
        <span className="shrink-0">
          <Wrench className="size-3.5 text-muted-foreground" aria-hidden="true" />
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

const SUGGESTIONS = [
  "帮我搭一个完整的 SPA 流程：导入 → 运动 → CTF → 挑选 → 2D 分类",
  "分析 2D 分类结果，结合分辨率推荐保留哪些 class",
  "画布上现在有哪些任务？下一步该跑什么？",
];

export function AssistantPanel() {
  const open = useWorkflowStore((s) => s.aiAssistantOpen);
  const setOpen = useWorkflowStore((s) => s.setAiAssistantOpen);
  const setAiSettingsOpen = useWorkflowStore((s) => s.setAiSettingsOpen);
  const consumeAiPendingPrompt = useWorkflowStore((s) => s.consumeAiPendingPrompt);

  const [items, setItems] = React.useState<UiItem[]>([]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState("思考中…");
  const [needsSetup, setNeedsSetup] = React.useState(false);
  const seq = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const hydrated = React.useRef(false);
  const autoScroll = React.useRef(true);

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

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setBusyLabel("思考中…");
    setItems((prev) => [...prev, { kind: "user", text: message, key: `u${Date.now()}` }]);

    let mySession = sessionId;
    let first = true;
    let guard = 0;
    try {
      for (;;) {
        guard++;
        if (guard > 40) throw new Error("连续轮次过多，已停止 — 请发送新消息继续");
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(first ? { message } : { continue: true }),
            ...(mySession ? { sessionId: mySession } : {}),
          }),
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
      const message2 = err instanceof Error ? err.message : String(err);
      setItems((prev) => [...prev, { kind: "assistant", text: `⚠️ ${message2}`, key: `err${Date.now()}` }]);
    } finally {
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
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[500px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>AI 助手</SheetTitle>
          <SheetDescription>
            用自然语言创建、连接和运行 cryo-EM 任务
          </SheetDescription>
        </SheetHeader>

        {/* ---- panel header ---- */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Sparkles className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">AI 助手</p>
            <p className="truncate text-xs text-muted-foreground">
              {needsSetup ? "未配置 — 点击设置选择供应商" : "自然语言 · 建流程 · 判 class"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => setAiSettingsOpen(true)}
            aria-label="AI provider settings"
            title="AI 供应商设置"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
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
            <div className="space-y-3 pt-6 text-center">
              <Bot className="mx-auto size-8 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                告诉我你想做什么 — 我可以创建任务、连线、设参数、跑流程，
                <br className="hidden sm:block" />
                还能用视觉模型分析 2D 分类结果。
              </p>
              <div className="mx-auto flex max-w-sm flex-col gap-2 pt-2 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-md border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-amber-600/40 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.map((item) =>
            item.kind === "user" ? (
              <div key={item.key} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {item.text}
                </div>
              </div>
            ) : item.kind === "assistant" ? (
              <div key={item.key} className="max-w-[92%]">
                <div className="text-sm leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs [&_strong]:font-semibold">
                  <Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>
                </div>
              </div>
            ) : (
              <ToolCard key={item.key} item={item} />
            )
          )}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {busyLabel}
              <Badge variant="outline" className="gap-1 border-amber-600/30 text-[10px] text-amber-700 dark:text-amber-400">
                <Sparkles className="size-2.5" aria-hidden="true" />
                AI
              </Badge>
            </div>
          )}

          {needsSetup && (
            <div className="rounded-md border border-amber-600/30 bg-amber-500/10 p-3 text-xs">
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
        <div className={cn("border-t p-3", busy && "opacity-70")}>
          <div className="relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="描述你的任务… (Enter 发送，Shift+Enter 换行)"
              className="min-h-[44px] resize-none pr-10 text-sm"
              rows={2}
              disabled={busy}
              aria-label="Message the AI assistant"
              maxLength={8000}
            />
            <Button
              size="icon"
              className="absolute bottom-2 right-2 size-8"
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              aria-label="Send"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CornerDownLeft className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            AI 会创建真实任务并在确认后启动运行 — 操作会显示在对话与画布上。
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
