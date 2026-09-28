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
 */

import * as React from "react";
import { Check, Eye, EyeOff, Loader2, RefreshCw, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkflowStore } from "@/lib/store";
import type { AiProviderSummary, AiSettingsResponse, AiSettingsDto } from "@/lib/ai/types";

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
  const [models, setModels] = React.useState<string[]>([]);
  const [modelSource, setModelSource] = React.useState<"api" | "builtin" | null>(null);
  const [fetching, setFetching] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
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
      } catch {
        if (!cancelled) toast.error("AI 设置加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

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
      <DialogContent className="no-print max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            AI 助手设置
          </DialogTitle>
          <DialogDescription>
            选择供应商并填写 API key — 模型列表会自动获取。密钥只保存在本机 (data/ai-settings.json)。
          </DialogDescription>
        </DialogHeader>

        {settings?.activeProvider && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            当前使用：
            <span className="ml-1 font-medium text-foreground">
              {providers.find((p) => p.id === settings.activeProvider)?.label ??
                settings.activeProvider}
            </span>
            <span className="ml-1">
              · {settings.providers?.[settings.activeProvider]?.model}
            </span>
          </div>
        )}

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="ai-provider">供应商</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger id="ai-provider" aria-label="AI provider">
                <SelectValue placeholder="选择供应商" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                    {settings?.providers?.[p.id]?.hasKey ? " ·" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {provider && (
              <p className="text-xs text-muted-foreground">
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  获取 API key <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </p>
            )}
          </div>

          {provider?.custom && (
            <div className="grid gap-1.5">
              <Label htmlFor="ai-baseurl">Base URL (OpenAI 兼容)</Label>
              <Input
                id="ai-baseurl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/v1"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          {provider && provider.needsKey && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-key">API Key</Label>
                <span className="text-xs text-muted-foreground">{keyHint}</span>
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
                  className="pr-9"
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
              <p className="text-xs text-muted-foreground">
                留空 = 保留已保存的密钥；填写后自动获取模型列表。
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-model">对话模型</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
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
            />
            <datalist id={datalistId}>
              {listModels.slice(0, 200).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
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

          <div className="grid gap-1.5">
            <Label htmlFor="ai-vlm">视觉模型 (可选)</Label>
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
            />
            <p className="text-xs text-muted-foreground">
              用于 AI 分析 2D class 平均图 — 建议选支持视觉的模型
              {provider?.visionDefault ? `（推荐 ${provider.visionDefault}）` : ""}。
            </p>
          </div>
        </div>

        <DialogFooter>
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
