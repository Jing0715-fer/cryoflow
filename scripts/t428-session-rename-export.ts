/**
 * t428 — the session rename + export bench.
 *
 * The t426 leftover, verified at two depths:
 *   H1-H5 (store/agent): rename persists into summaries, a rename never
 *      bumps updatedAt (the newest-first drawer must stay chronological),
 *      empty titles clear back to the preview name, the pinning law
 *      refuses foreign sessions, the 80-char cap holds.
 *   H6-H8 (export lib): the Markdown shape (title heading, meta, one
 *      section per message, tool calls as bold lines, tool results as
 *      quotes speaking the {ok,summary} JSON), the escapeMd forgeries
 *      (headings/links/quotes in USER content must never survive as
 *      structure), the ASCII-safe download filename.
 *   H9 (route, in-process): PATCH + GET ?format=md through the REAL
 *      handlers — cross-site 403s, body validation, the attachment
 *      headers, and the pinning law answering 404 at the HTTP layer.
 *
 * Run: bun scripts/t428-session-rename-export.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t428-ai-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
execSync("bunx prisma db push --skip-generate", {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "pipe",
});

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const { createSession, saveSession, getSession, listSessionSummaries, toolCallsUsed } =
  await import("../src/lib/ai/sessions");
const { renameSessionForActiveProject } = await import("../src/lib/ai/agent");
const { sessionToMarkdown, sessionFileName } = await import("../src/lib/ai/export");
const { ensureActiveProject } = await import("../src/lib/seed");
const { NextRequest, NextResponse } = await import("next/server");
const routeMod = await import("../src/app/api/ai/sessions/[id]/route");

const LOCAL = { host: "localhost:3000", origin: "http://localhost:3000" };
const FOREIGN_ORIGIN = { host: "localhost:3000", origin: "https://evil.example" };

function req(pathname: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: init?.method ?? "GET",
    headers: { ...LOCAL, ...(init?.headers ?? {}) },
    ...(init?.body != null ? { body: init.body } : {}),
  });
}
function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/* ------------------------------------------------------------------ */
/* Fixture — a session that looks like real work                        */
/* ------------------------------------------------------------------ */

const active = await ensureActiveProject();
const pid = active!.project.id;

function makeWorkSession() {
  const s = createSession(pid);
  saveSession({
    ...s,
    messages: [
      { role: "user", content: "帮我搭一条 SPA 流程", at: Date.now() - 5_000 },
      {
        role: "assistant",
        content: "好的，先建 Import。",
        at: Date.now() - 4_000,
        toolCalls: [{ id: "call-1", name: "create_job", args: { type: "import", name: "Import Movies 1" } }],
      },
      {
        role: "tool",
        toolCallId: "call-1",
        name: "create_job",
        content: JSON.stringify({ ok: true, summary: "Import Movies 1 已创建" }),
        at: Date.now() - 3_500,
      },
      {
        role: "user",
        content: "检查这行里的伪造结构：\n## 伪标题\n[点我](https://evil.example)\n> 引用注入\n---\n正文继续",
        at: Date.now() - 3_000,
      },
      { role: "assistant", content: "流程就绪，可以跑了。", at: Date.now() - 2_000 },
    ],
  });
  return s.id;
}

const sid = makeWorkSession();

console.log("H1-H5. rename (store + agent, pinning law)");
{
  const before = getSession(sid)!;
  const r = await renameSessionForActiveProject(sid, "  SPA 主线  ");
  must(r.ok === true && r.title === "SPA 主线", "H1: rename trims and lands the title");
  const after = getSession(sid)!;
  must(after.title === "SPA 主线", "H1: the store carries the rename");
  must(after.updatedAt === before.updatedAt, "H2: a rename never bumps updatedAt (drawer stays chronological)");
  const row = listSessionSummaries(pid).find((x) => x.id === sid);
  must(row?.title === "SPA 主线", "H1: summaries carry the title");

  const cleared = await renameSessionForActiveProject(sid, "   ");
  must(cleared.ok === true && cleared.title === null && getSession(sid)!.title === null, "H3: whitespace clears the rename (preview fallback)");
  must(listSessionSummaries(pid).find((x) => x.id === sid)?.title === null, "H3: summary answers null after clear");

  const long = "长".repeat(120);
  const capped = await renameSessionForActiveProject(sid, long);
  must(capped.ok === true && capped.title!.length === 80, `H5: the 80-char cap holds (got ${capped.title!.length})`);

  const foreign = createSession("ghost-project");
  saveSession({ ...foreign, messages: [{ role: "user", content: "别项目的悄悄话", at: Date.now() }] });
  const fr = await renameSessionForActiveProject(foreign.id, "偷名");
  must(fr.ok === false && /not found/i.test(fr.error ?? ""), "H4: a foreign session cannot be renamed (pinning law)");
  const gr = await renameSessionForActiveProject("ai-no-such-session", "幽灵");
  must(gr.ok === false && /not found/i.test(gr.error ?? ""), "H4: a ghost id answers not found");
  // restore the display title for the export asserts
  await renameSessionForActiveProject(sid, "SPA 主线");
}

console.log("H6-H8. the Markdown export (lib)");
{
  const session = getSession(sid)!;
  const tools = toolCallsUsed(session);
  const md = sessionToMarkdown(session, "β-Galactosidase Tutorial", tools);
  must(md.startsWith("# SPA 主线\n"), "H6: the rename is the document heading");
  must(md.includes("- 项目：β-Galactosidase Tutorial"), "H6: the meta line names the project");
  must(md.includes(`${session.messages.length} 条消息 · ${tools} 次工具调用`), `H6: the meta line counts (${session.messages.length}/${tools})`);
  must((md.match(/^## 用户 · /gm) ?? []).length === 2, "H6: two user sections");
  must((md.match(/^## 助手 · /gm) ?? []).length === 2, "H6: two assistant sections");
  must(md.includes("**工具** `create_job`"), "H6: the assistant's tool call is a bold line");
  must(md.includes("> 工具 `create_job`（完成）：Import Movies 1 已创建"), "H6: the tool result quote speaks the {ok,summary} JSON");

  // the escapeMd forgeries — user structure must arrive as TEXT
  must(!/^## 伪标题$/m.test(md), "H6: a forged heading in user content never renders as a heading");
  must(md.includes("\\## 伪标题"), "H6: the forged heading is escaped");
  must(!/\[点我\]\(https:\/\/evil\.example\)/.test(md), "H6: a forged link never renders as a link");
  must(md.includes("\\[点我\\](https://evil.example)"), "H6: the forged link is escaped (brackets suffice to kill it)");
  must(!/^> 引用注入/m.test(md), "H6: a forged quote never renders as a quote");
  must(md.includes("\\> 引用注入"), "H6: the forged quote is escaped");
  must(!/^---$/m.test(md), "H6: a forged HR never renders as a heading divider");

  // failure dialect
  const failing = structuredClone(session);
  const toolMsg = failing.messages.find((m) => m.role === "tool") as Extract<(typeof failing.messages)[number], { role: "tool" }>;
  toolMsg.content = JSON.stringify({ ok: false, summary: "端口不匹配，连线被拒绝" });
  toolMsg.isError = true;
  const mdFail = sessionToMarkdown(failing, "P", 1);
  must(mdFail.includes("> 工具 `create_job`（失败）：端口不匹配，连线被拒绝"), "H7: isError speaks the failure dialect");
  const raw = structuredClone(session);
  (raw.messages.find((m) => m.role === "tool") as { content: string }).content = "not json at all";
  must(sessionToMarkdown(raw, "P", 1).includes("（结果）：not json at all"), "H7: unparseable tool content shows raw, honestly");
  const empty = structuredClone(session);
  (empty.messages.find((m) => m.role === "tool") as { content: string }).content = "";
  must(sessionToMarkdown(empty, "P", 1).includes("（结果）：(no detail)"), "H7: empty tool content degrades to (no detail)");

  // filename
  const fn = sessionFileName(session);
  must(/^ai-session-\d{8}-\d{4}-[a-z0-9]+\.md$/.test(fn) && !/[^\x20-\x7e]/.test(fn), `H8: ASCII-safe filename (${fn})`);
}

console.log("H9. the routes, in-process (PATCH + ?format=md)");
{
  // cross-site slams
  const patchForeign = new NextRequest(`http://localhost:3000/api/ai/sessions/${sid}`, {
    method: "PATCH",
    headers: { ...FOREIGN_ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ title: "跨站改" }),
  });
  const p403 = await routeMod.PATCH(patchForeign, routeCtx(sid));
  must(p403.status === 403, "H9: cross-site PATCH answers 403");
  const md403 = await routeMod.GET(
    new NextRequest(`http://localhost:3000/api/ai/sessions/${sid}?format=md`, { headers: FOREIGN_ORIGIN }),
    routeCtx(sid)
  );
  must(md403.status === 403, "H9: cross-site export answers 403");

  // body validation
  const badJson = await routeMod.PATCH(
    req(`/api/ai/sessions/${sid}`, { method: "PATCH", body: "{not json", headers: { "content-type": "application/json" } }),
    routeCtx(sid)
  );
  must(badJson.status === 400, "H9: malformed JSON body answers 400");
  const badType = await routeMod.PATCH(
    req(`/api/ai/sessions/${sid}`, { method: "PATCH", body: JSON.stringify({ title: 42 }), headers: { "content-type": "application/json" } }),
    routeCtx(sid)
  );
  must(badType.status === 400, "H9: non-string title answers 400");

  // the happy path
  const okPatch = await routeMod.PATCH(
    req(`/api/ai/sessions/${sid}`, { method: "PATCH", body: JSON.stringify({ title: "路由级重命名" }), headers: { "content-type": "application/json" } }),
    routeCtx(sid)
  );
  const okBody = (await okPatch.json()) as { ok: boolean; title: string | null };
  must(okPatch.status === 200 && okBody.ok === true && okBody.title === "路由级重命名", "H9: PATCH renames and echoes the normalized title");

  // export through the door
  const md = await routeMod.GET(req(`/api/ai/sessions/${sid}?format=md`), routeCtx(sid));
  must(md.status === 200, "H9: the export answers 200");
  must((md.headers.get("content-type") ?? "").includes("text/markdown"), "H9: content-type is text/markdown");
  const cd = md.headers.get("content-disposition") ?? "";
  must(/^attachment; filename="ai-session-/.test(cd), `H9: served as an attachment (${cd})`);
  const body = await md.text();
  must(body.startsWith("# 路由级重命名\n"), "H9: the file opens with the session's rename");

  // plain fetch stays JSON (the drawer's switch door unchanged)
  const plain = await routeMod.GET(req(`/api/ai/sessions/${sid}`), routeCtx(sid));
  const plainBody = (await plain.json()) as { session: { id: string; title: string | null } };
  must(plain.status === 200 && plainBody.session?.id === sid && plainBody.session.title === "路由级重命名", "H9: without format=md the door still speaks JSON (title included)");

  // the pinning law at the HTTP layer
  const foreign = createSession("ghost-project");
  saveSession({ ...foreign, messages: [{ role: "user", content: "别项目的悄悄话", at: Date.now() }] });
  const fPatch = await routeMod.PATCH(
    req(`/api/ai/sessions/${foreign.id}`, { method: "PATCH", body: JSON.stringify({ title: "x" }), headers: { "content-type": "application/json" } }),
    routeCtx(foreign.id)
  );
  must(fPatch.status === 404, "H9: renaming a foreign session through the door answers 404");
  const fMd = await routeMod.GET(req(`/api/ai/sessions/${foreign.id}?format=md`), routeCtx(foreign.id));
  must(fMd.status === 404, "H9: exporting a foreign session through the door answers 404");

  // silence unused import warning path — NextResponse re-export check
  must(typeof NextResponse.json === "function", "H9: route module speaks NextResponse");
}

console.log(`\nt428 session rename + export: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
