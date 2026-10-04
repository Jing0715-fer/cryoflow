"use client";

/**
 * CryoFlow — AI provider settings dialog (t419).
 *
 * 「直接配置好LLM设置，包含市面上常见的供应商，需要填写apikey后可以
 * 自动获取model列表」— this dialog is that sentence made UI:
 *
 *   provider catalog (13 entries, three wire dialects)
 *   → API key (write-only: undefined keeps the stored one)
 *   → the model list AUTO-FETCHES the moment a key is recognizable
 *     (≥8 chars) or a stored key exists for the provider
 *   → model + VLM model picked from the fetched list (datalist keeps it
 *     editable when the listing lags behind the provider's newest names)
 *   → Save activates the provider as the assistant's chat model.
 *
 * The API key never echoes back (hasKey + ••••abcd hint only) — the same
 * secret contract the SSH connections registry has always spoken.
 *
 * t427 — the editor-grade restyle: the one-column form becomes the app's
 * two-pane editor idiom (provider catalog rail on the left, config form on
 * the right — the hpc-profiles dialog's layout), sections speak the
 * micro-label + Separator header idiom, and the amber "AI accent" retires
 * for the app's cryo teal. Same contract underneath: same fetches, same
 * debounce auto-fetch, same save body.
 */

import * as React from "react";
import { Check, Eye, EyeOff, Loader2, RefreshCw, Sparkles, ExternalLink, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store";
import type {
  AiProviderSummary,
  AiSettingsResponse,
  AiSettingsDto,
  AiProviderHealthDto,
  AiProviderRosterResponse,
} from "@/lib/ai/types";

export function AiSettingsDialog() {
  const open = useWorkflowStore((s) => s.aiSettingsOpen);
  const setOpen = useWorkflowStore((s) => s.setAiSettingsOpen);

  const [providers, setProviders] = React.useState<AiProviderSummary[]>([]);
  const [settings, setSettings] = React.useState<AiSettingsDto | null>(null);
  const [providerId, setProviderId] = React.useState<string>("");
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState("");
  const [model, setModel] = React.useState("");
  const [vlmModel, setVlmModel] = React.useState("");
  const [autoJudge, setAutoJudge] = React.useState(true);
  const [models, setModels] = React.useState<string[]>([]);
  const [modelSource, setModelSource] = React.useState<"api" | "builtin" | null>(null);
  const [fetching, setFetching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [health, setHealth] = React.useState<Record<string, AiProviderHealthDto> | null>(null);
  const [probing, setProbing] = React.useState(false);
  const fetchSeq = React.useRef(0);

  const provider = providers.find((p) => p.id === providerId) ?? null;
  const stored = settings?.providers?.[providerId] ?? null;

  // ---- load the catalog + settings when the dialog opens ----------------
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/settings");
        if (!res.ok) throw new Error(`settings ${res.status}`);
        const data = (await res.json()) as AiSettingsResponse;
        if (cancelled) return;
        setProviders(data.providers);
        setSettings(data.settings);
        const activeId = data.settings.activeProvider ?? data.providers[0]?.id ?? "";
        setProviderId(activeId);
        setVlmModel(data.settings.vlmModel ?? "");
        setAutoJudge(data.settings.autoJudge !== false);
      } catch {
        if (!cancelled) toast.error("AI 设置加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ---- t474 the roll call: every saved provider's reachability ----------
  // Fetched when the dialog opens; `?refresh=1` on the manual re-probe.
  // A failed roster fetch keeps the dots silent — health is additive,
  // never a blocker for configuring.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/providers/health");
        if (!res.ok) return;
        const data = (await res.json()) as AiProviderRosterResponse;
        if (!cancelled) setHealth(data.providers ?? {});
      } catch {
        /* silent — the dots just don't appear */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function reprobe() {
    setProbing(true);
    try {
      const res = await fetch("/api/ai/providers/health?refresh=1");
      if (res.ok) {
        const data = (await res.json()) as AiProviderRosterResponse;
        setHealth(data.providers ?? {});
      }
    } catch {
      /* keep the previous dots */
    } finally {
      setProbing(false);
    }
  }

  // ---- provider switch: load stored config + kick the auto-fetch ---------
  React.useEffect(() => {
    if (!open || !providerId) return;
    const cfg = settings?.providers?.[providerId];
    setApiKey("");
    setShowKey(false);
    setBaseUrl(cfg?.baseUrl ?? "");
    setModel(cfg?.model ?? "");
    setModels([]);
    setModelSource(null);
    setFetchError(null);
    // a stored key auto-fetches immediately (「已保存的 key 自动刷新列表」);
    // a custom provider waits for its base URL too
    if (cfg?.hasKey && (!provider || !provider.custom || cfg.baseUrl)) {
      void fetchModels({ typedKey: "", base: cfg.baseUrl ?? "" });
    }
  }, [providerId, open]);

  const fetchModels = React.useCallback(
    async (opts?: { typedKey?: string; base?: string }) => {
      if (!providerId) return;
      const typedKey = opts?.typedKey ?? apiKey;
      const base = opts?.base ?? (provider?.custom ? baseUrl : undefined);
      if (provider?.custom && !base) return;
      const seq = ++fetchSeq.current;
      setFetching(true);
      setFetchError(null);
      try {
        const res = await fetch("/api/ai/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: providerId,
            ...(typedKey ? { apiKey: typedKey } : {}),
            ...(base ? { baseUrl: base } : {}),
          }),
        });
        const data = (await res.json()) as {
          models?: string[];
          source?: "api" | "builtin";
          error?: string;
        };
        if (seq !== fetchSeq.current) return; // a newer fetch superseded this one
        if (!res.ok) {
          setModels([]);
          setModelSource(null);
          setFetchError(data.error ?? `获取失败 (${res.status})`);
          return;
        }
        setModels(data.models ?? []);
        setModelSource(data.source ?? null);
      } catch {
        if (seq === fetchSeq.current) setFetchError("网络错误 — 无法连接模型服务");
      } finally {
        if (seq === fetchSeq.current) setFetching(false);
      }
    },
    [providerId, apiKey, baseUrl, provider]
  );

  // the auto-fetch on typed keys: debounce 700ms once the key looks real
  React.useEffect(() => {
    if (!open || !providerId) return;
    if (provider && provider.needsKey && apiKey.trim().length < 8) return;
    if (provider?.custom && !baseUrl.trim()) return;
    const t = setTimeout(() => void fetchModels({ typedKey: apiKey }), 700);
    return () => clearTimeout(t);
  }, [apiKey, baseUrl, providerId, open]);

  const datalistId = `ai-models-${providerId}`;

  async function save() {
    if (!providerId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
          ...(provider?.custom && baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
          ...(provider && !provider.custom ? { baseUrl: baseUrl.trim() } : {}),
          ...(vlmModel.trim() ? { vlmModel: vlmModel.trim() } : {}),
          autoJudge,
        }),
      });
      const data = (await res.json()) as { settings?: AiSettingsDto; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "保存失败");
        return;
      }
      if (data.settings) setSettings(data.settings);
      const label = providers.find((p) => p.id === providerId)?.label ?? providerId;
      toast.success(`AI 已配置：${label} · ${model || stored?.model || ""}`);
      setOpen(false);
    } catch {
      toast.error("保存失败 — 网络错误");
    } finally {
      setSaving(false);
    }
  }

  const keyHint = stored?.hasKey ? `已保存 ${stored.keyHint}` : "未保存";
  const listModels = models.length > 0 ? models : (provider?.curatedModels ?? []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="no-print flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* ---- header: title + the honest "current provider" status row ---- */}
        <DialogHeader className="shrink-0 gap-2 border-b px-5 pt-5 pb-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            AI 助手设置
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            选择供应商并填写 API key — 模型列表会自动获取。密钥只保存在本机 (data/ai-settings.json)。
          </DialogDescription>
          {settings?.activeProvider && (
            <div className="inline-flex max-w-full items-center gap-1.5 self-start rounded-full border border-primary/25 bg-primary/[0.06] px-2.5 py-1 text-[11px] text-muted-foreground">
              <Check className="size-3 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 truncate">
                当前使用：
                <span className="font-medium text-foreground">
                  {providers.find((p) => p.id === settings.activeProvider)?.label ??
                    settings.activeProvider}
                </span>
                <span> · {settings.providers?.[settings.activeProvider]?.model}</span>
              </span>
            </div>
          )}
          {(() => {
            // t473 — the loader's named repairs, read aloud: a hand-edited
            // settings file gets its fixes SPOKEN (t472's problems, on the
            // wire since t472, now on a face). Each sentence is already
            // secret-safe (shape is named, key content never enters one).
            const problems = settings?.problems ?? [];
            if (problems.length === 0) return null;
            return (
              <div
                data-testid="ai-settings-problems"
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-left"
              >
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />
                  设置文件已自动修复 {problems.length} 处
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[10.5px] leading-relaxed text-amber-700/90 dark:text-amber-400/90">
                  {problems.map((p, i) => (
                    <li key={i} className="font-mono break-all">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </DialogHeader>

        {/* ---- the two-pane editor: catalog rail left, config right
                (stacks on phones — the strip scrolls horizontally) ---- */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* provider catalog — the hpc-profiles rail idiom on desktop,
              a horizontal tile strip on phones */}
          <div className="flex shrink-0 flex-col border-b sm:w-56 sm:border-b-0">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2 sm:px-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                供应商
              </h4>
              <span className="text-[10px] text-muted-foreground/70">{providers.length}</span>
            </div>
            <div
              className="nice-scroll flex gap-1.5 overflow-x-auto px-3 pb-3 sm:min-h-0 sm:flex-1 sm:flex-col sm:gap-1 sm:overflow-x-hidden sm:overflow-y-auto sm:px-2.5"
              role="list"
              aria-label="AI provider"
            >
              {providers.map((p) => (
                <div key={p.id} role="listitem" className="shrink-0 sm:w-full">
                  <button
                    type="button"
                    onClick={() => setProviderId(p.id)}
                    aria-pressed={providerId === p.id}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                      providerId === p.id
                        ? "border-primary/40 bg-primary/[0.06]"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                        providerId === p.id
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                      aria-hidden="true"
                    >
                      {p.label.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.label}</span>
                    {(() => {
                      // t474 — the rail's confession dot: a SAVED provider
                      // whose endpoint is dead speaks here, before the
                      // user wastes a save on it. Healthy = silent (the
                      // zero-noise law the badge set in t472).
                      const h = health?.[p.id];
                      if (!h || h.state === "ok") return null;
                      return (
                        <span
                          data-testid={`ai-health-dot-${p.id}`}
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            h.state === "unreachable" ? "bg-red-500" : "bg-amber-500"
                          )}
                          title={h.detail}
                          aria-label={
                            h.state === "unreachable"
                              ? "端点不可达"
                              : h.state === "rejected"
                                ? "端点拒绝密钥"
                                : "端点应答异常"
                          }
                        />
                      );
                    })()}
                    {settings?.providers?.[p.id]?.hasKey ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                        title="已保存 API key"
                        aria-label="已保存 API key"
                      />
                    ) : null}
                    {settings?.activeProvider === p.id ? (
                      <Check className="size-3.5 shrink-0 text-primary" aria-label="当前使用" />
                    ) : null}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* the pane divider — h-auto! (height:auto !important) is what
              lets align-self:stretch actually fire: the Separator's own
              data-[orientation=vertical]:h-full would otherwise resolve
              against this dialog's content-driven height and collapse to 0 */}
          <Separator orientation="vertical" className="hidden self-stretch sm:h-auto! sm:block" />

          {/* the selected provider's config form */}
          <div className="nice-scroll min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* 供应商 — identity + the docs link */}
            {provider && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    供应商
                  </h4>
                  <Separator className="flex-1" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary"
                      aria-hidden="true"
                    >
                      {provider.label.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">{provider.label}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground/80">
                        {provider.id}
                      </p>
                    </div>
                  </div>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/[0.06] px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    获取 API key <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            )}

            {/* t474 — the selected provider's roll-call line: the prose face
                of the roster. Saved configs only (an unsaved draft has
                nothing probed); the refresh button re-tests EVERY saved
                provider and the fresh answers become the cache. */}
            {(() => {
              const h = providerId ? health?.[providerId] : undefined;
              const saved = settings?.providers?.[providerId] ?? null;
              if (!h || !saved) return null;
              const tone =
                h.state === "ok"
                  ? { label: "正常", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" }
                  : h.state === "unreachable"
                    ? { label: "不可达", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" }
                    : h.state === "rejected"
                      ? { label: "被拒绝", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" }
                      : { label: "应答异常", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
              return (
                <div
                  data-testid="ai-health-line"
                  className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2"
                >
                  <span className={cn("mt-[5px] size-2 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium leading-tight">
                      连通性：<span className={tone.text}>{tone.label}</span>
                      {h.latencyMs != null && (
                        <span className="ml-1 font-normal text-muted-foreground">· {h.latencyMs}ms</span>
                      )}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] leading-relaxed break-all text-muted-foreground/80">
                      {h.detail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void reprobe()}
                    disabled={probing}
                    aria-label="重新测活"
                    title="重新探测所有已保存供应商的连通性"
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={cn("size-3", probing && "animate-spin")} aria-hidden="true" />
                  </button>
                </div>
              );
            })()}

            {provider?.custom && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="ai-baseurl"
                    className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Base URL (OpenAI 兼容)
                  </Label>
                  <Separator className="flex-1" />
                </div>
                <Input
                  id="ai-baseurl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8000/v1"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-8 text-xs"
                />
              </div>
            )}

            {provider && provider.needsKey && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="ai-key"
                    className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    API Key
                  </Label>
                  <Separator className="flex-1" />
                  <span className="shrink-0 text-[10px] text-muted-foreground">{keyHint}</span>
                </div>
                <div className="relative">
                  <Input
                    id="ai-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider.keyHint}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-8 pr-9 text-xs"
                  />
                  <button
                    type="button"
                    aria-label={showKey ? "Hide the API key" : "Show the API key"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground/80">
                  留空 = 保留已保存的密钥；填写后自动获取模型列表。
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="ai-model"
                  className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  对话模型
                </Label>
                <Separator className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => void fetchModels()}
                  disabled={fetching || !providerId}
                  aria-label="Refresh the model list"
                >
                  {fetching ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="size-3" aria-hidden="true" />
                  )}
                  刷新
                </Button>
              </div>
              <Input
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                list={datalistId}
                placeholder={listModels[0] ?? "模型名"}
                autoComplete="off"
                spellCheck={false}
                className="h-8 text-xs"
              />
              <datalist id={datalistId}>
                {listModels.slice(0, 200).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <p className="text-[10px] leading-snug text-muted-foreground/80">
                {fetching
                  ? "正在获取模型列表…"
                  : models.length > 0
                    ? `已获取 ${models.length} 个模型${modelSource === "builtin" ? "（内置清单）" : ""}`
                    : provider && !provider.needsKey
                      ? "该供应商无需 API key"
                      : "填写 API key 后自动获取，或手动输入模型名"}
              </p>
              {fetchError && (
                <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
                  {fetchError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="ai-vlm"
                  className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  视觉模型 (可选)
                </Label>
                <Separator className="flex-1" />
              </div>
              <Input
                id="ai-vlm"
                value={vlmModel}
                onChange={(e) => setVlmModel(e.target.value)}
                list={datalistId}
                placeholder={
                  provider?.visionDefault ?? "默认使用对话模型（需支持图片输入）"
                }
                autoComplete="off"
                spellCheck={false}
                className="h-8 text-xs"
              />
              <p className="text-[10px] leading-snug text-muted-foreground/80">
                用于 AI 分析 2D class 平均图 — 建议选支持视觉的模型
                {provider?.visionDefault ? `（推荐 ${provider.visionDefault}）` : ""}。
              </p>
            </div>
          </div>

          {/* t574 — the judge worker's product face: finished classifications
              get their VLM verdict in the background (the stamp + card
              badge arrive on their own). Off keeps judging strictly
              on-demand (ask the assistant). The toggle rides the save —
              the worker reads the same settings file each tick. */}
          <div className="rounded-lg border bg-muted/30 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="ai-auto-judge" className="text-xs font-semibold">
                  分类完成后自动判词
                </Label>
                <p className="text-[10px] leading-snug text-muted-foreground/80">
                  2D/3D 分类跑完由 AI 自动检查并盖章（Results 页可见，卡片带 ✦ 标记）。关闭后仅在主动询问时判词。
                </p>
              </div>
              <Switch
                id="ai-auto-judge"
                checked={autoJudge}
                onCheckedChange={setAutoJudge}
                aria-label="分类完成后自动判词"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-5 py-3 sm:px-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving || !providerId}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            <Check className="size-4" aria-hidden="true" />
            保存并启用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
