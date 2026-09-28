#!/usr/bin/env node
/**
 * t419 — the mock LLM server (live QA lane).
 *
 * An OpenAI-compatible endpoint (chat/completions + models) that speaks the
 * scripted assistant: enough brain to drive the REAL UI end-to-end without
 * a real API key. The bench (t419-ai-assistant.ts) covers the same state
 * machine in-process; this server exists so the BROWSER can ride the full
 * settings → chat → tool-cards → canvas-updates loop against the real Next
 * server.
 *
 * Run: bun scripts/t419-mock-llm.mjs   (port 3999)
 */

import { createServer } from "node:http";

const PORT = 3999;

function mockToolCall(id, name, args) {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function decideTurn(messages) {
  const body = JSON.stringify(messages);
  // vision lane — the VLM judge's one-shot (image rides the content array)
  if (body.includes("data:image/png;base64") || body.includes('"type":"image"') || body.includes("inline_data")) {
    return {
      content:
        "看图结论：\n```json\n" +
        JSON.stringify({
          classes: [
            { cls: 1, verdict: "keep", reason: "清晰的二级结构和边界" },
            { cls: 2, verdict: "maybe", reason: "信号较弱但可辨" },
            { cls: 3, verdict: "reject", reason: "模糊 / 冰污染" },
          ],
          advice: "建议保留 class 1 和 2 进入下游（占比高、分辨率好），丢掉 class 3。",
        }) +
        "\n```",
    };
  }
  const toolNameOf = (m) => {
    if (m.role !== "tool" || !m.tool_call_id) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const a = messages[i];
      if (a.role === "assistant" && a.tool_calls) {
        const hit = a.tool_calls.find((t) => t.id === m.tool_call_id);
        if (hit) return hit.function.name;
      }
    }
    return null;
  };
  const last = messages[messages.length - 1];
  if (!last) return { content: "empty" };

  if (last.role === "user") {
    const text = String(last.content ?? "");
    const idMatch = text.match(/id:\s*([A-Za-z0-9_-]+)/);
    if (/搭|流程|pipeline|build/i.test(text)) return { tool_calls: [mockToolCall("call_s0", "get_workflow_state", {})] };
    if (/(分析|判断|judge)/i.test(text) && idMatch) return { tool_calls: [mockToolCall("call_j", "judge_2d_classes", { job_id: idMatch[1] })] };
    if (/画布|哪些任务|state/i.test(text)) return { tool_calls: [mockToolCall("call_s", "get_workflow_state", {})] };
    if (/(更新|update)/i.test(text) && idMatch) return { tool_calls: [mockToolCall("call_u", "update_job", { job_id: idMatch[1], params: { numClasses: 25 } })] };
    return { content: "OK（mock 回复）。要试试「帮我搭一个流程」吗？" };
  }
  if (last.role === "tool") {
    let parsed = {};
    try {
      parsed = JSON.parse(String(last.content));
    } catch {}
    const toolName = toolNameOf(last);
    if (toolName === "create_job") {
      const type = parsed?.detail?.job?.type;
      const id = parsed?.detail?.job?.id;
      if (type === "motioncorr") return { tool_calls: [mockToolCall("call_2", "create_job", { type: "ctffind", connect_from: id })] };
      if (type === "ctffind") return { tool_calls: [mockToolCall("call_3", "create_job", { type: "manualpick", connect_from: id })] };
      if (type === "manualpick") return { tool_calls: [mockToolCall("call_4", "create_job", { type: "class2d", params: { numClasses: 20 } })] };
      if (type === "class2d") {
        return {
          content:
            "DONE-PIPELINE：链已建好 —\n\n- **import → motioncorr → ctffind → manualpick**（挑粒子）\n- 独立的 **class2d**（K=20）\n\n下一步：跑 manualpick 挑坐标，再跑 class2d。",
        };
      }
      return { content: `created ${type}` };
    }
    if (toolName === "get_workflow_state") {
      let lastUser = "";
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          lastUser = String(messages[i].content ?? "");
          break;
        }
      }
      const wantsPipeline = /搭|流程|pipeline|build/i.test(lastUser);
      const imp = parsed?.detail?.jobs?.find((j) => j.type === "import");
      if (wantsPipeline && imp?.id) return { tool_calls: [mockToolCall("call_w", "create_job", { type: "motioncorr", connect_from: imp.id })] };
      return { content: "DONE-STATE：画布状态已在上面（工具卡里），需要我做什么？" };
    }
    if (toolName === "update_job") return { content: "DONE-UPDATE：参数已更新。" };
    if (toolName === "judge_2d_classes") {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role === "assistant" && m.tool_calls) {
          const tc = m.tool_calls.find((t) => t.function.name === "judge_2d_classes");
          if (tc) {
            const args = JSON.parse(tc.function.arguments);
            return { tool_calls: [mockToolCall("call_sel", "select_classes", { job_id: args.job_id, classes: [1, 2] })] };
          }
        }
      }
      return { content: "no judge call found" };
    }
    if (toolName === "select_classes") return { content: "DONE-SELECT：已建 2D Class Selection 任务接住 class 1、2。确认后可以开跑。" };
    return { content: "…" };
  }
  return { content: "…" };
}

const server = createServer((req, res) => {
  const send = (status, obj) => {
    res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "GET" && req.url.includes("/models")) {
    return send(200, { data: [{ id: "mock-chat" }, { id: "mock-vision" }, { id: "mock-large" }] });
  }
  if (req.method === "POST" && req.url.includes("/chat/completions")) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        const body = JSON.parse(raw || "{}");
        const payload = decideTurn(body.messages ?? []);
        console.log(`[mock-llm] turn → ${payload.tool_calls ? payload.tool_calls.map((t) => t.function.name).join("+") : `text(${(payload.content ?? "").length}ch)`}`);
        return send(200, {
          id: "chatcmpl-mock",
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: payload.content ?? "",
                ...(payload.tool_calls?.length ? { tool_calls: payload.tool_calls } : {}),
              },
              finish_reason: payload.tool_calls?.length ? "tool_calls" : "stop",
            },
          ],
          usage: {},
        });
      } catch (err) {
        return send(400, { error: { message: String(err) } });
      }
    });
    return;
  }
  return send(404, { error: { message: "not found" } });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-llm] listening on http://127.0.0.1:${PORT}/v1 (chat/completions + models)`);
});
