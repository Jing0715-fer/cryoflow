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

/** ASCII-safe download filename (Content-Disposition must stay byte-clean). */
export function sessionFileName(session: Pick<AiSessionDto, "createdAt" | "id">): string {
  const d = new Date(session.createdAt);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `ai-session-${stamp}-${session.id.slice(-6)}.md`;
}
