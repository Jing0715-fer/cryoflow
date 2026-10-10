/**
 * CryoFlow — AI session → Markdown transcript export (t428, SERVER ONLY).
 *
 * The history drawer's export button downloads one conversation as a
 * Markdown file: the archival shape a scientist can drop into an ELN,
 * paste into a report, or diff across sessions. Pure function over the
 * normalized transcript — no fs, no provider dialect, no secrets (the
 * transcript never stored keys).
 *
 * Shape:
 *   # <title | AI 会话>          — the display name (rename wins)
 *   meta line                    — project, created/updated, counts
 *   ## 用户 / ## 助手 / > 工具    — one section per message, timestamps in
 *                                  the server's local zone (the same zone
 *                                  every other timestamp in the app shows)
 */

import type { AiMessage, AiSessionDto } from "./types";

/** 2-digit pad — timestamps render by hand so the format is deterministic. */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtTime(at: number): string {
  const d = new Date(at);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Markdown has a handful of structural characters — escapes the ones that
 * could forge headings/links inside a user's message. Minimal, not
 * exhaustive: headings/bold/links/code-fence markers are the forgeries that
 * matter in a transcript someone will skim. */
function escapeMd(text: string): string {
  return text
    .replace(/^(\s*)(#{1,6}) /gm, "$1\\$2 ")
    .replace(/^\s*(-{3,}|={3,})\s*$/gm, "\\$1")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "\\[$1\\]($2)")
    .replace(/^(\s*)>/gm, "$1\\>");
}

/** Tool results carry JSON {ok,summary,detail} — the summary is the human
 * line; unparseable content falls back to a truncated raw view. */
function toolSummaryLine(m: Extract<AiMessage, { role: "tool" }>): string {
  let ok: boolean | null = m.isError ? false : null;
  let summary = "";
  try {
    const parsed = JSON.parse(m.content) as { ok?: boolean; summary?: string };
    if (typeof parsed.ok === "boolean") ok = parsed.ok;
    if (typeof parsed.summary === "string") summary = parsed.summary;
  } catch {
    summary = m.content.slice(0, 400);
  }
  const status = ok === false ? "失败" : ok === true ? "完成" : "结果";
  const body = summary.length > 0 ? summary : "(no detail)";
  return `> 工具 \`${m.name}\`（${status}）：${escapeMd(body).slice(0, 600)}`;
}

export function sessionToMarkdown(
  session: AiSessionDto,
  projectName: string,
  toolCount: number
): string {
  const title =
    session.title && session.title.trim().length > 0
      ? session.title.trim()
      : `AI 会话 ${fmtTime(session.createdAt)}`;
  const lines: string[] = [
    `# ${escapeMd(title)}`,
    "",
    `- 项目：${escapeMd(projectName)}`,
    `- 创建：${fmtTime(session.createdAt)} · 最后更新：${fmtTime(session.updatedAt)}`,
    `- ${session.messages.length} 条消息 · ${toolCount} 次工具调用`,
    "",
  ];

  for (const m of session.messages) {
    if (m.role === "user") {
      lines.push(`## 用户 · ${fmtTime(m.at)}`, "", escapeMd(m.content), "");
    } else if (m.role === "assistant") {
      const calls = m.toolCalls ?? [];
      const label = calls.length > 0 ? `（${calls.length} 次工具调用）` : "";
      lines.push(`## 助手 · ${fmtTime(m.at)} ${label}`.trimEnd(), "");
      if (m.content.trim().length > 0) {
        lines.push(escapeMd(m.content), "");
      }
      for (const c of calls) {
        const args = JSON.stringify(c.args ?? {});
        lines.push(`**工具** \`${c.name}\` — \`${escapeMd(args).slice(0, 300)}\``, "");
      }
    } else {
      lines.push(toolSummaryLine(m), "");
    }
  }

  return lines.join("\n");
}

/** ASCII-safe download filename (Content-Disposition must stay byte-clean).
 *  ext: "md" (default) or "json" — the t429 machine-readable export. */
export function sessionFileName(
  session: Pick<AiSessionDto, "createdAt" | "id">,
  ext: "md" | "json" = "md"
): string {
  const d = new Date(session.createdAt);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `ai-session-${stamp}-${session.id.slice(-6)}.${ext}`;
}

/**
 * t429 — the machine-readable twin of sessionToMarkdown. Where the
 * Markdown export renders FOR HUMANS (escaped structure, prose dialect),
 * this renders FOR PROGRAMS: the tool result's {ok,summary,detail} JSON
 * is parsed into real fields instead of quoted prose, timestamps are ISO
 * strings, and no escaping games exist because user content sits in JSON
 * string values — it cannot forge structure there (the mirror of the
 * escapeMd law: injection is impossible by construction, not by scrubbing).
 *
 * Envelope: format+version so a future shape change is detectable; the
 * session payload keeps the DTO's message order verbatim.
 */
export function sessionToExportJson(
  session: AiSessionDto,
  projectName: string,
  toolCount: number
): string {
  const messages = session.messages.map((m) => {
    if (m.role === "user") {
      return { role: "user", at: new Date(m.at).toISOString(), content: m.content };
    }
    if (m.role === "assistant") {
      return {
        role: "assistant",
        at: new Date(m.at).toISOString(),
        content: m.content,
        ...(m.toolCalls && m.toolCalls.length > 0
          ? {
              toolCalls: m.toolCalls.map((c) => ({
                name: c.name,
                args: c.args ?? {},
              })),
            }
          : {}),
      };
    }
    // tool — parse the {ok,summary,detail} envelope into real fields;
    // unparseable content degrades to raw (honest, labeled)
    let ok: boolean | null = m.isError ? false : null;
    let summary = "";
    let raw: string | undefined;
    try {
      const parsed = JSON.parse(m.content) as { ok?: unknown; summary?: unknown; detail?: unknown };
      if (typeof parsed.ok === "boolean") ok = parsed.ok;
      if (typeof parsed.summary === "string") summary = parsed.summary;
      if (typeof parsed.detail === "string" && parsed.detail.length > 0) raw = parsed.detail;
    } catch {
      raw = m.content;
    }
    return {
      role: "tool",
      at: new Date(m.at).toISOString(),
      name: m.name,
      ok,
      summary: summary.length > 0 ? summary : null,
      ...(raw !== undefined ? { raw } : {}),
    };
  });

  const envelope = {
    format: "cryoflow-ai-session",
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      title: session.title && session.title.trim().length > 0 ? session.title.trim() : null,
      project: projectName,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
      messageCount: session.messages.length,
      toolCallCount: toolCount,
      messages,
    },
  };
  return JSON.stringify(envelope, null, 2);
}
