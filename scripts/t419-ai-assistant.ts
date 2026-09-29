/**
 * t419 — the AI assistant bench.
 *
 * Six phases, no real API keys, no real LLM traffic, no world pollution:
 *   A. the provider registry (13 dialects, list parsers, curated lanes)
 *   B. settings persistence + the sanitized DTO + the three-state key dialect
 *   C. the wire adapters (openai/anthropic/gemini request bodies + response
 *      parsers — the pure translation layer, golden-shape asserts)
 *   D. the system prompt's grounding (catalog + pipeline canon + doctrine)
 *   E. the pure tool helpers (param filter, positions, class stats from a
 *      synthesized workdir, the judge verdict parser)
 *   F. the FULL agent loop against an isolated DB and a scripted mock LLM
 *      (global fetch patched in-process): pipeline build → state query →
 *      param update → VLM judge (vision detected on the wire) → class
 *      selection → guards (cycle refusal, delete gates, run guards) →
 *      session persistence + reset.
 *   G. session history (t423): summaries (preview/counts/newest-first,
 *      empty sessions excluded), the active-project pinning law on fetch
 *      and delete, and the delete contract.
 *
 * Run: bun scripts/t419-ai-assistant.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t419-ai-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
// t463 — the built-in SDK lane stays OFF in the bench: the unconfigured
// fallback would otherwise talk to a REAL model and break hermeticity.
process.env.CRYOFLOW_DISABLE_BUILTIN_AI = "1";
// keep the sandbox's EMPIAR bundle out of the seeded import params either way
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

const { AI_PROVIDERS, parseOpenAiModels, parseAnthropicModels, parseGeminiModels, listProviderModels, aiProvider, effectiveBaseUrl } =
  await import("../src/lib/ai/providers");
const { loadAiSettings, applySettingsUpdate, aiSettingsDto, resolveAssistant } = await import("../src/lib/ai/settings");
const { buildOpenAiBody, buildAnthropicBody, buildGeminiBody, parseOpenAiResponse, parseAnthropicResponse, parseGeminiResponse, chatOnce } =
  await import("../src/lib/ai/wire");
const { loadSessions, createSession, latestSessionForProject, listSessionSummaries, saveSession, deleteSession, getSession } =
  await import("../src/lib/ai/sessions");
const { runAiIteration, sessionForActiveProject, deleteSessionForActiveProject } = await import("../src/lib/ai/agent");
const {
  filterParamsForSpec,
  nextPositionFor,
  pickClassStackName,
  classStatsFromWorkdir,
  parseJudgeVerdict,
  executeAiTool,
} = await import("../src/lib/ai/tools");
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");
const { CARD_W } = await import("../src/lib/workflow");
const { db } = await import("../src/lib/db");
const { ensureActiveProject } = await import("../src/lib/seed");

/* ------------------------------------------------------------------ */
/* A. Provider registry                                                 */
/* ------------------------------------------------------------------ */

console.log("A. provider registry");
must(AI_PROVIDERS.length === 15, `15 providers on the market list (got ${AI_PROVIDERS.length})`);
must(new Set(AI_PROVIDERS.map((p) => p.id)).size === AI_PROVIDERS.length, "provider ids unique");
must(
  AI_PROVIDERS.every((p) => ["openai", "anthropic", "gemini", "builtin"].includes(p.flavor)),
  "every provider speaks a known dialect"
);
must(
  AI_PROVIDERS.every((p) => p.custom || p.id === "ollama" || p.id === "builtin" || p.baseUrl.startsWith("https://")),
  "cloud providers ride https (builtin rides no URL at all, ollama is local http)"
);
must(
  parseOpenAiModels({ data: [{ id: "b-model" }, { id: "a-model" }, { id: "a-model" }, { id: "" }, 42] }).join() ===
    "a-model,b-model",
  "openai list parser: dedupe + sort + junk dropped"
);
must(
  parseAnthropicModels({ data: [{ id: "claude-4" }, { id: "claude-3" }] }).join() === "claude-3,claude-4",
  "anthropic list parser"
);
must(
  parseGeminiModels({
    models: [
      { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] },
      { name: "models/text-embedding-3", supportedGenerationMethods: ["embedContent"] },
      { name: "gemini-2.5-pro", supportedGenerationMethods: ["generateContent", "countTokens"] },
    ],
  }).join() === "gemini-2.5-flash,gemini-2.5-pro",
  "gemini list parser: models/ stripped, embeddings filtered"
);
const zhipu = aiProvider("zhipu");
must(zhipu != null && zhipu.supportsModelList === false && zhipu.curatedModels.length > 0, "zhipu answers from the curated list (no endpoint)");
const custom = aiProvider("custom");
must(custom != null && custom.custom && custom.curatedModels.length === 0, "custom provider carries no curated list");
const listNoBase = await listProviderModels("custom", "k", "");
must(listNoBase.models.length === 0 && /base URL/i.test(listNoBase.error ?? ""), "custom without base URL refuses with the fix in the message");
const ollama = aiProvider("ollama");
must(ollama != null && ollama.needsKey === false && effectiveBaseUrl(ollama, "http://192.168.1.5:11434/v1/") === "http://192.168.1.5:11434/v1", "ollama is keyless + baseUrl override wins, trailing slash trimmed");
{
  // t463 — the two new registry entries
  const builtin = aiProvider("builtin");
  must(
    AI_PROVIDERS[0]?.id === "builtin" && builtin != null && builtin.flavor === "builtin" &&
      builtin.needsKey === false && builtin.curatedModels.includes("glm-4-plus") &&
      builtin.supportsModelList === false,
    "builtin: first on the list, keyless SDK lane, glm-4-plus curated"
  );
  const curated = await listProviderModels("builtin", "");
  must(curated.models.includes("glm-4-plus") && curated.source === "builtin", "builtin answers models from the curated lane (no endpoint)");
  const minimax = aiProvider("minimax");
  must(
    minimax != null && minimax.flavor === "openai" && minimax.needsKey === true &&
      minimax.baseUrl === "https://api.minimaxi.com/v1" && minimax.supportsModelList === true &&
      minimax.curatedModels.includes("MiniMax-M2"),
    "minimax: OpenAI-compatible on api.minimaxi.com/v1 with a live listing lane"
  );
}

/* ------------------------------------------------------------------ */
/* B. Settings                                                          */
/* ------------------------------------------------------------------ */

console.log("B. settings");
let settings = loadAiSettings();
must(settings.activeProvider === null && Object.keys(settings.providers).length === 0, "fresh settings are empty");
{
  // t463 — the zero-config builtin fallback + the kill-switch + the DTO synthesis
  const { resolveAssistant: resolve2, builtinLaneDisabled } = await import("../src/lib/ai/settings");
  must(builtinLaneDisabled() === true, "kill-switch reads the env (bench runs with the lane off)");
  must(resolve2() === null, "lane off + nothing configured → null (needsSetup, deterministic bench)");
  delete process.env.CRYOFLOW_DISABLE_BUILTIN_AI;
  const b = resolve2();
  must(
    b != null && b.providerId === "builtin" && b.flavor === "builtin" && b.model === "glm-4-plus" &&
      b.vlmModel === "glm-4-plus" && b.apiKey === "" && b.baseUrl === "",
    "lane on + nothing configured → the builtin identity (zero-config assistant)"
  );
  const dto0 = aiSettingsDto(loadAiSettings());
  must(
    dto0.activeProvider === "builtin" && dto0.providers.builtin?.model === "glm-4-plus" &&
      dto0.providers.builtin?.hasKey === false,
    "empty settings DTO names the derived builtin (badge/当前使用 say what answers)"
  );
  process.env.CRYOFLOW_DISABLE_BUILTIN_AI = "1";
}
{
  const { data, error } = applySettingsUpdate({ provider: "deepseek", apiKey: "sk-test-1234", model: "deepseek-chat", activate: true });
  must(error === undefined && data.activeProvider === "deepseek", "deepseek + key + model activates");
  const dto = aiSettingsDto(loadAiSettings());
  must(dto.providers.deepseek?.hasKey === true && dto.providers.deepseek.keyHint === "••••1234", "DTO: hasKey + last-4 hint");
  must(!JSON.stringify(dto).includes("sk-test-1234"), "the DTO never carries the raw key");
  const rawFile = readFileSync(path.join(DATA_DIR, "ai-settings.json"), "utf8");
  must(rawFile.includes("sk-test-1234"), "the settings FILE holds the key (the 0600 store)");
}
{
  // keep dialect: undefined apiKey keeps the stored one
  applySettingsUpdate({ provider: "deepseek", model: "deepseek-reasoner" });
  settings = loadAiSettings();
  must(settings.providers.deepseek.apiKey === "sk-test-1234" && settings.providers.deepseek.model === "deepseek-reasoner", "undefined key keeps the stored secret; model updates");
  // clear dialect
  applySettingsUpdate({ provider: "deepseek", apiKey: "" });
  must(loadAiSettings().providers.deepseek.apiKey === "", "empty-string key clears");
}
{
  const { error } = applySettingsUpdate({ provider: "openai", activate: true, model: "gpt-4o" }); // no key
  must(typeof error === "string" && /no API key/.test(error), "keyless provider cannot activate (draft + honest error)");
  must(loadAiSettings().activeProvider === "deepseek" || loadAiSettings().activeProvider == null, "active provider unchanged by the draft save");
}
{
  const bad = applySettingsUpdate({ provider: "custom", apiKey: "k", model: "m", baseUrl: "ftp://nope" });
  must(typeof bad.error === "string" && /http/.test(bad.error), "non-http base URL refused");
}

/* ------------------------------------------------------------------ */
/* C. Wire adapters                                                     */
/* ------------------------------------------------------------------ */

console.log("C. wire adapters");
const msgs = [
  { role: "user", content: "hi", at: 1 },
  { role: "assistant", content: "creating", toolCalls: [{ id: "c1", name: "create_job", args: { type: "motioncorr" } }], at: 2 },
  { role: "tool", toolCallId: "c1", name: "create_job", content: "{\"ok\":true}", at: 3 },
  { role: "tool", toolCallId: "c2", name: "connect_jobs", content: "{\"ok\":true}", at: 4 },
] as never[];
{
  const oai = buildOpenAiBody("m", "SYS", msgs, [
    { name: "create_job", description: "d", parameters: { type: "object" } },
  ]) as { messages: { role: string; content?: unknown; tool_calls?: { function: { arguments: string } }[] }[]; tools?: unknown[] };
  must(oai.messages[0].role === "system" && oai.messages[0].content === "SYS", "openai: system rides first");
  const asst = oai.messages[2];
  must(asst.role === "assistant" && asst.tool_calls?.[0].function.arguments === "{\"type\":\"motioncorr\"}", "openai: tool args serialized as a JSON string");
  must(oai.messages[3].role === "tool" && (oai.messages[3] as { tool_call_id?: string }).tool_call_id === "c1", "openai: tool role carries the call id");
  must(Array.isArray(oai.tools) && (oai.tools as { type: string }[])[0].type === "function", "openai: tools wear the function wrapper");
}
{
  const ant = buildAnthropicBody("m", "SYS", msgs, [
    { name: "create_job", description: "d", parameters: { type: "object" } },
  ]) as { system?: string; max_tokens?: number; messages: { role: string; content: unknown }[]; tools?: { name: string; input_schema: unknown }[] };
  must(ant.system === "SYS" && ant.max_tokens === 8192, "anthropic: system param + max_tokens present");
  // consecutive tool results MERGE into one user turn
  const last = ant.messages[ant.messages.length - 1];
  must(last.role === "user" && Array.isArray(last.content) && (last.content as { type: string }[]).every((b) => b.type === "tool_result"), "anthropic: consecutive tool results merge into ONE user message");
  must(ant.tools?.[0].name === "create_job" && ant.tools?.[0].input_schema != null, "anthropic: input_schema dialect");
}
{
  const gem = buildGeminiBody("m", "SYS", msgs, [
    { name: "create_job", description: "d", parameters: { type: "object" } },
  ]) as { system_instruction?: { parts: { text: string }[] }; contents: { role: string; parts: unknown[] }[]; tools?: { functionDeclarations: { name: string }[] }[]; generationConfig?: { maxOutputTokens: number } };
  must(gem.system_instruction?.parts[0].text === "SYS", "gemini: system_instruction");
  const last = gem.contents[gem.contents.length - 1];
  must(last.role === "user" && (last.parts as { functionResponse?: { name: string } }[]).every((p) => p.functionResponse != null), "gemini: functionResponse parts ride a user turn");
  must(gem.tools?.[0].functionDeclarations[0].name === "create_job", "gemini: functionDeclarations dialect");
  must(gem.generationConfig?.maxOutputTokens === 8192, "gemini: generationConfig present");
}
must(
  parseOpenAiResponse({
    choices: [{ message: { content: "done", tool_calls: [{ id: "x", function: { name: "run_job", arguments: "{\"job_id\":\"j1\"}" } }] } }],
  }).toolCalls[0].args.job_id === "j1",
  "openai response: tool args JSON string parsed"
);
must(
  parseAnthropicResponse({
    content: [
      { type: "text", text: "thinking" },
      { type: "tool_use", id: "t1", name: "run_job", input: { job_id: "j2" } },
    ],
  }).toolCalls[0].args.job_id === "j2",
  "anthropic response: tool_use input object parsed"
);
must(
  parseGeminiResponse({
    candidates: [{ content: { parts: [{ text: "ok" }, { functionCall: { name: "run_job", args: { job_id: "j3" } } }] } }],
  }).toolCalls[0].args.job_id === "j3",
  "gemini response: functionCall parsed"
);

/* ------------------------------------------------------------------ */
/* D. System prompt grounding                                           */
/* ------------------------------------------------------------------ */

console.log("D. system prompt");
{
  const sys = buildSystemPrompt({ projectName: "P", projectMode: "spa", projectRemote: null, jobCount: 7 });
  must(sys.includes("motioncorr") && sys.includes("class2d") && sys.includes("postprocess"), "prompt names the pipeline canon");
  must(sys.includes("get_workflow_state"), "prompt teaches the state-first doctrine");
  must(sys.includes("judge_2d_classes"), "prompt teaches the VLM judge");
  must(sys.includes("7 jobs"), "prompt carries the live census");
  // t463 — the two field-failure laws
  must(sys.includes("THE CHAIN LAW") && sys.includes('build_pipeline({ steps: [{ type: "import" }'), "chain law carries the worked build_pipeline example");
  must(sys.includes("导入") && sys.includes("运动校正") && sys.includes("2D分类") && sys.includes("挑选"), "stage phrasebook is bilingual");
  must(sys.includes("QUESTIONS ARE READS"), "advisory questions are reads, not mutations");
  must(sys.includes("auto-inserts the missing"), "prompt tells the model about the extract bridge");
}

/* ------------------------------------------------------------------ */
/* E. Pure tool helpers                                                 */
/* ------------------------------------------------------------------ */

console.log("E. tool helpers");
{
  const { filtered, dropped } = filterParamsForSpec("class2d", { numClasses: 30, miniBatches: 100, evilKey: "x", particleDiameter: { deep: true }, badType: { deep: true } });
  must(filtered.numClasses === 30 && filtered.miniBatches === 100, "param filter keeps schema keys");
  must(dropped.includes("evilKey") && dropped.join(",").includes("particleDiameter(wrong type)"), `param filter names the dropped keys (got ${dropped.join(",")})`);
  const imp = filterParamsForSpec("import", { empiarData: "10017", numClasses: 3 });
  must((imp.filtered as Record<string, unknown>).empiarData === "10017" && imp.dropped.includes("numClasses"), "import keeps empiarData, rejects others");
}
{
  const from = { x: 100, y: 200 };
  const pos = nextPositionFor(from, []);
  must(pos.x === from.x + CARD_W + 100 && Math.abs(pos.y - from.y) <= 20, `nextPositionFor: right of the source (got ${pos.x},${pos.y})`);
  const free = nextPositionFor(null, []);
  must(free.x >= 0 && free.x <= 300 && free.y >= 0 && free.y <= 400, "nextPositionFor: empty canvas places near the origin");
  const far = nextPositionFor(null, [{ x: 1000, y: 50 }, { x: 1020, y: 400 }]);
  must(far.x === 1020 + CARD_W + 100, "nextPositionFor: beyond the rightmost card");
}
must(
  pickClassStackName(["run_it001_classes.mrcs", "run_it003_classes.mrcs", "run_it002_optimiser.star"]) === "run_it003_classes.mrcs" &&
    pickClassStackName(["run_it005_classes.mrcs", "run_it002_unmasked_classes.mrcs"]) === "run_it002_unmasked_classes.mrcs",
  "pickClassStackName: newest iteration, unmasked outranks"
);

/* E2. t463 — the alias ladder + the chain bridge                      */
{
  const { resolveJobTypeKey, typeResolutionNote, normalizeTypeToken } = await import("../src/lib/ai/type-aliases");
  const r = (s: string) => resolveJobTypeKey(s);
  must(r("ctffind").key === "ctffind" && r("ctffind").via === "exact", "exact key passes untouched");
  must(r("Motion_Corr").key === "motioncorr" && r("Motion_Corr").via === "normalized", "case/separator variants normalize to the key");
  must(r("ctf").key === "ctffind" && r("ctf").via === "alias", "alias: ctf → ctffind");
  must(r("CTF").key === "ctffind" && r("CTF").via === "alias", "alias: case-insensitive");
  must(r("导入").key === "import", "alias: 导入 → import");
  must(r("运动").key === "motioncorr" && r("运动校正").key === "motioncorr", "alias: 运动(校正) → motioncorr");
  must(r("挑选").key === "manualpick" && r("自动挑选").key === "autopick", "alias: 挑选 → manualpick, 自动挑选 → autopick");
  must(r("2d分类").key === "class2d" && r("2dclass").key === "class2d" && r("二维分类").key === "class2d", "alias: the many names of class2d");
  must(r("2d分类job").key === "class2d", "normalization strips the job/任务 suffix");
  must(r("motion").key === "motioncorr" && r("pick").key === "manualpick", "alias: the English shorthands models invent");
  must(r("3d精修").key === "refine3d" && r("初始模型").key === "initialmodel" && r("后处理").key === "postprocess", "alias: the downstream SPA stages");
  must(r("class2daverage").key === "class2d" && r("class2daverage").via === "fuzzy", "fuzzy: containment matches");
  must(r("gibberishxyz").key === null && r("").key === null && r("na").key === null, "garbage answers null (never force-matches)");
  must(typeResolutionNote(r("ctffind")) === "" && typeResolutionNote(r("Motion_Corr")) === "", "exact/normalized matches narrate nothing");
  must(typeResolutionNote(r("ctf")) === ' (interpreted "ctf" as ctffind)', "alias matches narrate the interpretation");
  must(normalizeTypeToken(" CTF 任务 ") === "ctf", "normalization: trims, lowercases, strips 任务");
}
{
  const { bridgeBetween, bridgePipelineSteps } = await import("../src/lib/ai/tools");
  must(bridgeBetween("manualpick", "class2d") === "extract", "bridge: pick → classify grows an extract (the port law)");
  must(bridgeBetween("autopick", "class3d") === "extract", "bridge: autopick → class3d too");
  must(bridgeBetween("ctffind", "manualpick") === null, "bridge: already-portable pairs stay untouched");
  must(bridgeBetween("import", "class2d") === null, "bridge: unbridgeable pairs refuse (no false roads)");
  const bridged = bridgePipelineSteps([
    { type: "import" }, { type: "motioncorr" }, { type: "ctffind" }, { type: "manualpick" }, { type: "class2d" },
  ]);
  must(
    bridged.steps.map((s) => s.type).join() === "import,motioncorr,ctffind,manualpick,extract,class2d" &&
      bridged.inserted.length === 1 && bridged.inserted[0].after === "manualpick" && bridged.inserted[0].bridge === "extract",
    "the user's five-stage ask becomes the six-job wired truth"
  );
}


// the synthesized workdir: data star + model star + classes stack
function makeMrcs(slices: number, nx = 32, ny = 32): Buffer {
  const head = Buffer.alloc(1024);
  head.writeInt32LE(nx, 0);
  head.writeInt32LE(ny, 4);
  head.writeInt32LE(slices, 8);
  head.writeInt32LE(2, 12); // mode 2 = float32
  head.writeInt32LE(nx, 28);
  head.writeInt32LE(ny, 32);
  head.writeInt32LE(slices, 36);
  head.writeFloatLE(nx, 40);
  head.writeFloatLE(ny, 44);
  head.writeFloatLE(slices, 48);
  const data = Buffer.alloc(nx * ny * slices * 4);
  for (let z = 0; z < slices; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const v = (z + 1) * 0.25 + (x + y) / (nx + ny);
        data.writeFloatLE(v, (z * ny * nx + y * nx + x) * 4);
      }
    }
  }
  return Buffer.concat([head, data]);
}

const FIXT = path.join(DATA_DIR, "fixture-workdir");
mkdirSync(FIXT, { recursive: true });
{
  const rows: string[] = [];
  for (let i = 0; i < 300; i++) rows.push(`1 mic_${i}.mrcs`);
  for (let i = 0; i < 200; i++) rows.push(`2 mic_${i}.mrcs`);
  for (let i = 0; i < 100; i++) rows.push(`3 mic_${i}.mrcs`);
  writeFileSync(
    path.join(FIXT, "run_it002_data.star"),
    `data_particles\n\nloop_\n_rlnClassNumber #1\n_rlnImageName #2\n${rows.join("\n")}\n\n`
  );
  writeFileSync(
    path.join(FIXT, "run_it002_model.star"),
    `data_model_general\n\n_rlnCurrentResolution 4.2\n_rlnPixelSize 1.0\n\ndata_model_classes\n\nloop_\n_rlnReferenceImage #1\n_rlnClassDistribution #2\n_rlnEstimatedResolution #3\nrun_it002_class001.mrcs 0.5 4.5\nrun_it002_class002.mrcs 0.333 5.2\nrun_it002_class003.mrcs 0.167 9.8\n\n`
  );
  writeFileSync(path.join(FIXT, "run_it002_unmasked_classes.mrcs"), makeMrcs(3));
}
{
  const stats = classStatsFromWorkdir(FIXT);
  must(stats.iteration === 2, `classStats: iteration 2 (got ${stats.iteration})`);
  must(stats.total === 600, `classStats: 600 particles (got ${stats.total})`);
  must(stats.classes.length === 3 && stats.classes[0].count === 300 && Math.abs(stats.classes[0].fraction - 0.5) < 1e-9, "classStats: occupancy 300/600");
  must(stats.classes[0].resolution === 4.5 && stats.classes[2].resolution === 9.8, "classStats: per-class resolution from the model star");
  must(stats.stackFile === "run_it002_unmasked_classes.mrcs", `classStats: the unmasked stack (got ${stats.stackFile})`);
}
{
  const v = parseJudgeVerdict("prose before \n```json\n{\"classes\":[{\"cls\":1,\"verdict\":\"keep\",\"reason\":\"清晰\"},{\"cls\":2,\"verdict\":\"reject\",\"reason\":\"模糊\"}],\"advice\":\"留 1\"}\n```");
  must(v != null && v.classes.length === 2 && v.classes[0].verdict === "keep" && v.advice === "留 1", "judge verdict: fenced JSON parsed");
  const loose = parseJudgeVerdict('{"classes":[{"cls":9,"verdict":"maybe","reason":"x"}],"advice":""}');
  must(loose != null && loose.classes[0].cls === 9, "judge verdict: bare JSON parsed");
  must(parseJudgeVerdict("no json at all") === null, "judge verdict: garbage refuses (null)");
}

/* ------------------------------------------------------------------ */
/* F. Agent E2E — isolated DB + scripted mock LLM                       */
/* ------------------------------------------------------------------ */

console.log("F. agent end-to-end (mock LLM)");

// F1: unconfigured assistant refuses honestly
{
  const r = await runAiIteration({ message: "你好" });
  must(r.needsSetup === true && r.events[0].type === "error", "F1: unconfigured assistant sets needsSetup with the guidance event");
}

// configure the assistant at a mock endpoint
applySettingsUpdate({ provider: "custom", apiKey: "mock-key", model: "mock-chat", baseUrl: "http://127.0.0.1:3999/v1", activate: true });
{
  const a = resolveAssistant();
  must(a != null && a.providerId === "custom" && a.baseUrl === "http://127.0.0.1:3999/v1" && a.vlmModel === "mock-chat", "resolveAssistant: custom identity + vlmModel falls back to the chat model");
}

// the scripted mock LLM (in-process fetch patch)
const MOVED: string[] = [];
function mockToolCall(id: string, name: string, args: unknown) {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}
function decideTurn(messages: { role: string; content?: unknown; tool_calls?: { id?: string; function: { name: string; arguments: string } }[] }[]): {
  content?: string;
  tool_calls?: ReturnType<typeof mockToolCall>[];
} {
  const body = JSON.stringify(messages);
  if (body.includes("data:image/png;base64") || body.includes('"type":"image"') || body.includes("inline_data")) {
    return {
      content:
        "看图结论：\n```json\n" +
        JSON.stringify({
          classes: [
            { cls: 1, verdict: "keep", reason: "清晰的二级结构" },
            { cls: 2, verdict: "maybe", reason: "信号较弱但可辨" },
            { cls: 3, verdict: "reject", reason: "模糊 / 垃圾类" },
          ],
          advice: "建议保留 class 1 和 2，丢掉 3。",
        }) +
        "\n```",
    };
  }
  // resolve a tool message's NAME through the assistant turn that called it
  // (the openai wire carries tool_call_id, not name, on tool messages)
  const toolNameOf = (m: { role: string; tool_call_id?: string }): string | null => {
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
  if (last.role === "user") {
    const text = String(last.content ?? "");
    const idMatch = text.match(/id:\s*([A-Za-z0-9_-]+)/);
    if (/搭|流程|pipeline|build/i.test(text)) return { tool_calls: [mockToolCall("call_s0", "get_workflow_state", {})] }; // the doctrine: state FIRST
    if (/(分析|判断|judge)/i.test(text) && idMatch) return { tool_calls: [mockToolCall("call_j", "judge_2d_classes", { job_id: idMatch[1] })] };
    if (/画布|哪些任务|state/i.test(text)) return { tool_calls: [mockToolCall("call_s", "get_workflow_state", {})] };
    if (/(更新|update)/i.test(text) && idMatch) return { tool_calls: [mockToolCall("call_u", "update_job", { job_id: idMatch[1], params: { numClasses: 25 } })] };
    return { content: "OK" };
  }
  if (last.role === "tool") {
    let parsed: { detail?: { job?: { id?: string; type?: string }; jobs?: { id?: string; type?: string }[] }; ok?: boolean } = {};
    try {
      parsed = JSON.parse(String(last.content));
    } catch {
      /* keep {} */
    }
    const toolName = toolNameOf(last as unknown as { role: string; tool_call_id?: string });
    if (toolName === "create_job") {
      const type = parsed?.detail?.job?.type;
      const id = parsed?.detail?.job?.id;
      if (type === "motioncorr") return { tool_calls: [mockToolCall("call_2", "create_job", { type: "ctffind", connect_from: id })] };
      if (type === "ctffind") return { tool_calls: [mockToolCall("call_3", "create_job", { type: "manualpick", connect_from: id })] };
      if (type === "manualpick") return { tool_calls: [mockToolCall("call_4", "create_job", { type: "class2d", params: { numClasses: 20 } })] };
      if (type === "class2d") return { content: "DONE-PIPELINE：链已建好（import → motioncorr → ctffind → manualpick，外加独立的 class2d K=20）。" };
      return { content: `created ${type}` };
    }
    if (toolName === "get_workflow_state") {
      // the doctrine in action: a PIPELINE request wires its motioncorr off the
      // seeded import; a bare state query just summarizes. Scoped to the LAST
      // user message — earlier turns in the same conversation don't reignite.
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
      return { content: "DONE-STATE" };
    }
    if (toolName === "update_job") return { content: "DONE-UPDATE" };
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
    if (toolName === "select_classes") return { content: "DONE-SELECT：已建 select 任务接住 class 1、2。" };
    return { content: "…" };
  }
  return { content: "…" };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
  const u = String(url);
  if (u.includes("/chat/completions")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const payload = decideTurn(body.messages ?? []);
    MOVED.push(`turn:${payload.tool_calls?.map((t) => t.function.name).join("+") ?? "text"}`);
    return new Response(
      JSON.stringify({
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
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (u.includes("/models")) {
    return new Response(JSON.stringify({ data: [{ id: "mock-chat" }, { id: "mock-vision" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

// the model list through the mock wire
{
  const list = await listProviderModels("custom", "mock-key", "http://127.0.0.1:3999/v1");
  must(list.source === "api" && list.models.join() === "mock-chat,mock-vision", `model listing through the openai dialect (got ${list.models.join()})`);
}

// the active project (fresh DB → the demo seed: import + motioncorr + ctffind + 2 wires)
const active = await ensureActiveProject();
must(active != null, "F: the isolated world has an active project");
const seededJobs = await db.job.count({ where: { projectId: active!.project.id } });
must(seededJobs === 3, `F: the demo seed landed 3 jobs (got ${seededJobs})`);

// F2: the pipeline build — 6 iterations, client-driven (state → import→motioncorr →
// ctffind → manualpick → class2d → final text)
let sessionId = "";
{
  const r1 = await runAiIteration({ message: "帮我搭一个流程" });
  sessionId = r1.sessionId;
  must(r1.needsContinue && r1.events.some((e) => e.type === "tool_call" && e.name === "get_workflow_state"), "F2 iter1: get_workflow_state dispatched (the state-first doctrine)");
  const r2 = await runAiIteration({ sessionId, cont: true });
  must(r2.needsContinue && r2.events.some((e) => e.type === "tool_call" && e.name === "create_job"), "F2 iter2: create_job dispatched off the state");
  const r3 = await runAiIteration({ sessionId, cont: true });
  must(r3.needsContinue && r3.events.some((e) => e.type === "tool_call" && e.name === "create_job"), "F2 iter3: continues after the first tool round");
  const r4 = await runAiIteration({ sessionId, cont: true });
  must(r4.needsContinue, "F2 iter4: still working");
  const r5 = await runAiIteration({ sessionId, cont: true });
  must(r5.needsContinue, "F2 iter5: still working");
  const r6 = await runAiIteration({ sessionId, cont: true });
  must(!r6.needsContinue && r6.events.some((e) => e.type === "assistant_text"), "F6 iter6: the final text lands and the loop ends");
}
{
  const jobs = await db.job.findMany({ where: { projectId: active!.project.id } });
  const motion = jobs.filter((j) => j.type === "motioncorr");
  const ctf = jobs.filter((j) => j.type === "ctffind");
  const pick = jobs.filter((j) => j.type === "manualpick");
  const cls = jobs.filter((j) => j.type === "class2d");
  must(
    motion.length === 2 && ctf.length === 2 && pick.length === 1 && cls.length === 1,
    `F2: agent added motioncorr + ctffind + manualpick + class2d (got ${motion.length}/${ctf.length}/${pick.length}/${cls.length})`
  );
  const clsJob = cls[0];
  const params = JSON.parse(clsJob.params);
  must(params.numClasses === 20, `F2: class2d carried numClasses=20 (got ${params.numClasses})`);
  const edges = await db.edge.findMany({ where: { projectId: active!.project.id } });
  const seededImport = jobs.find((j) => j.type === "import")!;
  const newMotion = motion.find((j) => j.name !== "Motion Correction 1");
  must(newMotion != null && edges.some((e) => e.fromJobId === seededImport.id && e.toJobId === newMotion.id), "F2: the new motioncorr wired off the seeded import");
  const seededCtf = await db.job.findFirst({
    where: { projectId: active!.project.id, type: "ctffind", name: "CTF Estimation 1" },
  });
  const newCtf = ctf.find((j) => j.id !== seededCtf?.id);
  must(newCtf != null && edges.some((e) => e.fromJobId === newMotion!.id && e.toJobId === newCtf.id), "F2: motioncorr → ctffind wire drawn by connect_from");
  must(edges.some((e) => e.fromJobId === newCtf!.id && e.toJobId === pick[0].id), "F2: ctffind → manualpick wire drawn (the port-legal chain)");
  must(!edges.some((e) => e.toJobId === clsJob.id), "F2: the standalone class2d has no incoming wire (honest — nothing port-legal feeds it yet)");
  // position: ctffind lands right of motioncorr
  must(newCtf!.x === newMotion!.x + CARD_W + 100, `F2: auto-position right of the source (got dx=${newCtf!.x - newMotion!.x})`);
}

// F3: the state query
{
  const r1 = await runAiIteration({ sessionId, message: "画布上有哪些任务？" });
  const stateEvent = r1.events.find((e) => e.type === "tool_result" && e.name === "get_workflow_state");
  must(r1.needsContinue && stateEvent != null, "F3: get_workflow_state called");
  const count = await db.job.count({ where: { projectId: active!.project.id } });
  must(Boolean((stateEvent as { summary?: string }).summary?.includes(`${count} jobs`)), `F3: the state summary speaks the live census (${count})`);
  const r2 = await runAiIteration({ sessionId, cont: true });
  must(!r2.needsContinue && r2.events.some((e) => e.type === "assistant_text"), "F3: state turn completes");
}

// F4: the param update
{
  const clsJob = (await db.job.findMany({ where: { projectId: active!.project.id, type: "class2d" } }))[0];
  const r1 = await runAiIteration({ sessionId, message: `更新任务 id: ${clsJob.id} 的参数` });
  must(r1.needsContinue && r1.events.some((e) => e.type === "tool_call" && e.name === "update_job"), "F4: update_job dispatched");
  await runAiIteration({ sessionId, cont: true });
  const after = await db.job.findUnique({ where: { id: clsJob.id } });
  must(JSON.parse(after!.params).numClasses === 25, `F4: numClasses 20 → 25 through the agent (got ${JSON.parse(after!.params).numClasses})`);
}

// F5: the VLM judge + class selection
{
  const clsJob = (await db.job.findMany({ where: { projectId: active!.project.id, type: "class2d" } }))[0];
  // the fixture workdir at the DERIVED path the judge uses (no run record exists)
  const workdir = path.join(DATA_DIR, "relion", active!.project.id, `class2d_${clsJob.id.slice(-8)}`);
  mkdirSync(workdir, { recursive: true });
  writeFileSync(path.join(workdir, "run_it002_data.star"), readFileSync(path.join(FIXT, "run_it002_data.star")));
  writeFileSync(path.join(workdir, "run_it002_model.star"), readFileSync(path.join(FIXT, "run_it002_model.star")));
  writeFileSync(path.join(workdir, "run_it002_unmasked_classes.mrcs"), readFileSync(path.join(FIXT, "run_it002_unmasked_classes.mrcs")));

  const r1 = await runAiIteration({ sessionId, message: `请分析 2D 分类任务 id: ${clsJob.id} 的结果` });
  const judgeResult = r1.events.find((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
  must(r1.needsContinue && judgeResult != null, "F5: judge_2d_classes dispatched");
  const jr = judgeResult as { ok?: boolean; detail?: { judgedClasses?: { cls: number; verdict: string }[]; advice?: string } };
  must(jr.ok === true && (jr.detail?.judgedClasses?.length ?? 0) === 3, "F5: the VLM verdict parsed (3 classes, keep/maybe/reject)");
  must((jr.detail?.judgedClasses ?? []).some((c) => c.cls === 1 && c.verdict === "keep"), "F5: class 1 verdict = keep");
  const r2 = await runAiIteration({ sessionId, cont: true });
  must(r2.needsContinue && r2.events.some((e) => e.type === "tool_call" && e.name === "select_classes"), "F5: select_classes follows the verdict");
  await runAiIteration({ sessionId, cont: true });
  const selectJobs = await db.job.findMany({ where: { projectId: active!.project.id, type: "select2d" } });
  must(selectJobs.length === 1, "F5: one select2d job created");
  const selParams = JSON.parse(selectJobs[0].params);
  must(
    selParams.classStarSelection?.jobId === clsJob.id && selParams.classStarSelection?.classes.join() === "1,2",
    `F5: the selection wired classes [1,2] of the judged job (got ${JSON.stringify(selParams.classStarSelection)})`
  );
  const edges = await db.edge.findMany({ where: { projectId: active!.project.id } });
  must(edges.some((e) => e.fromJobId === clsJob.id && e.toJobId === selectJobs[0].id), "F5: class2d → select2d edge exists");
}

// F6: guards (tool level, deterministic)
{
  const ctx = { projectId: active!.project.id };
  // cycle: a port-legal BACK-EDGE (select2d ⇄ class2d pair both ways legal)
  const clsJob = (await db.job.findMany({ where: { projectId: active!.project.id, type: "class2d" } }))[0];
  const selJob = (await db.job.findMany({ where: { projectId: active!.project.id, type: "select2d" } }))[0];
  must(selJob != null, "F6: the select2d from F5 is present");
  const back = await executeAiTool("connect_jobs", { from_job_id: selJob.id, to_job_id: clsJob.id }, ctx);
  must(back.ok === false && /cycle/i.test(back.summary), `F6: the reverse wire select2d → class2d closes a cycle and refuses (${back.summary.slice(0, 60)})`);
  const self = await executeAiTool("connect_jobs", { from_job_id: clsJob.id, to_job_id: clsJob.id }, ctx);
  must(self.ok === false, "F6: self-edge refused");
  // port-mismatch honesty (the bench's own earlier mistake, now pinned as a contract)
  const ctfNew = (await db.job.findMany({ where: { projectId: active!.project.id, type: "ctffind" } })).find((j) => j.name !== "CTF Estimation 1")!;
  const mismatch = await executeAiTool("connect_jobs", { from_job_id: clsJob.id, to_job_id: ctfNew.id }, ctx);
  must(mismatch.ok === false && /Port mismatch/i.test(mismatch.summary), "F6: class2d → ctffind refused as a port mismatch (RELION pipeline order is the law)");
  // delete gates
  await db.job.update({ where: { id: clsJob.id }, data: { status: "completed" } });
  const refused = await executeAiTool("delete_job", { job_id: clsJob.id }, ctx);
  must(refused.ok === false && /confirm/i.test(refused.summary), "F6: deleting a completed job requires confirm");
  const confirmed = await executeAiTool("delete_job", { job_id: clsJob.id, confirm: true }, ctx);
  must(confirmed.ok === true && !(await db.job.findUnique({ where: { id: clsJob.id } })), "F6: confirmed delete removes the job");
  // run guards
  const ghost = await executeAiTool("run_job", { job_id: "no-such-id" }, ctx);
  must(ghost.ok === false && /not found/.test(ghost.summary), "F6: run on a ghost id refused");
  const cluster = await executeAiTool("run_job", { job_id: ctfNew.id, mode: "cluster" }, ctx);
  must(cluster.ok === false && /no bound cluster/i.test(cluster.summary), "F6: cluster mode on an unbound project names the fix");
  await db.job.update({ where: { id: ctfNew.id }, data: { status: "running" } });
  const running = await executeAiTool("run_job", { job_id: ctfNew.id }, ctx);
  must(running.ok === false && /already running/i.test(running.summary), "F6: run on a running job refuses (double-spawn guard)");
  await db.job.update({ where: { id: ctfNew.id }, data: { status: "idle" } });
}

// F7: session persistence + reset
{
  const sessions = loadSessions();
  const mine = sessions.find((s) => s.id === sessionId);
  must(mine != null && mine.messages.length > 10, `F7: the session persisted (${mine?.messages.length ?? 0} messages)`);
  must(latestSessionForProject(active!.project.id)?.id === sessionId, "F7: latest-for-project rehydration finds it");
  const r = await runAiIteration({ action: "reset" });
  must(Boolean(r.sessionId && r.sessionId !== sessionId), "F7: reset mints a fresh session");
}

// F8: the tool catalog shape the agent gets
{
  const { AI_TOOLS } = await import("../src/lib/ai/tools");
  // t419 shipped 12; t420 grew to 14; t468 added the ledger read (15)
  must(AI_TOOLS.length === 18 && new Set(AI_TOOLS.map((t) => t.name)).size === 18, `F8: 18 unique tools (got ${AI_TOOLS.length})`);
  must(AI_TOOLS.every((t) => t.parameters && typeof t.description === "string"), "F8: every tool wears a schema + description");
}

// F9: t463 — the field shape, replayed verbatim. A model that answers the
// user's「导入 → 运动 → CTF → 挑选 → 2D 分类」with invented keys ("ctf",
// "2dclass", Chinese stage names) still builds the WHOLE chain, wired
// head-to-tail, with the extract bridge grown where RELION's own law
// demands it.
{
  const ctx = { projectId: active!.project.id };
  const before = await db.job.count({ where: { projectId: active!.project.id } });
  const built = await executeAiTool(
    "build_pipeline",
    {
      steps: [
        { type: "导入" },
        { type: "运动" },
        { type: "ctf" },
        { type: "挑选" },
        { type: "2dclass" },
      ],
    },
    ctx
  );
  must(built.ok === true, `F9: the invented-key chain still builds (${built.summary.slice(0, 90)})`);
  must(/interpreted stage names: step 1: "导入" → import/.test(built.summary), "F9: the interpretation is narrated, not silent");
  const created = (built.detail as { jobs?: { id: string; type: string; name: string }[] }).jobs ?? [];
  must(
    created.map((j) => j.type).join() === "import,motioncorr,ctffind,manualpick,extract,class2d",
    `F9: the six-job wired truth (got ${created.map((j) => j.type).join()})`
  );
  must(/auto-inserted extract after manualpick/.test(built.summary), "F9: the bridge is named in the summary");
  must(/fully wired/.test(built.summary), "F9: the chain is fully wired");
  const after = await db.job.count({ where: { projectId: active!.project.id } });
  must(after - before === 6, `F9: exactly six jobs landed (delta ${after - before})`);
  // the wires: consecutive pairs of the created chain
  const edges = await db.edge.findMany({ where: { projectId: active!.project.id } });
  for (let i = 0; i + 1 < created.length; i++) {
    must(
      edges.some((e) => e.fromJobId === created[i].id && e.toJobId === created[i + 1].id),
      `F9: wire ${created[i].type} → ${created[i + 1].type} exists`
    );
  }
  // the create_job path forgives the same way
  const one = await executeAiTool("create_job", { type: "CTF" }, ctx);
  must(one.ok === true && /interpreted "CTF" as ctffind/.test(one.summary), `F9: create_job forgives uppercase aliases (${one.summary.slice(0, 60)})`);
  await executeAiTool("delete_job", { job_id: (one.detail as { job: { id: string } }).job.id, confirm: true }, ctx);
  // and a truly unknown type still refuses honestly
  const junk = await executeAiTool("create_job", { type: "flurb" }, ctx);
  must(junk.ok === false && /unknown job type/i.test(junk.summary), "F9: garbage keys still refuse (the ladder is not a yes-machine)");
}

// G: session history (t423) — summaries, pinning law, delete contract
{
  const pid = active!.project.id;
  const summaries = listSessionSummaries(pid);
  must(summaries.length >= 1, `G1: the F session earns a summary row (${summaries.length} rows)`);
  must(summaries.every((s) => loadSessions().find((x) => x.id === s.id)!.messages.length > 0), "G1: empty sessions never earn a row");
  const fRow = summaries.find((s) => s.id === sessionId);
  must(fRow != null, "G1: the F session is listed");
  must(
    fRow!.preview.length > 0 && fRow!.preview.length <= 96 && !fRow!.preview.startsWith("("),
    `G1: the preview speaks the first user message (${fRow!.preview.slice(0, 40)}…)`
  );
  must(fRow!.toolCount > 0 && fRow!.messageCount === loadSessions().find((x) => x.id === sessionId)!.messages.length, `G1: counts match the transcript (messages ${fRow!.messageCount}, tools ${fRow!.toolCount})`);
  must(summaries.every((s, i) => i === 0 || summaries[i - 1].updatedAt >= s.updatedAt), "G1: newest conversation first");

  // the pinning law: a session from another project does not exist here
  const foreign = createSession("ghost-project");
  saveSession({ ...foreign, messages: [{ role: "user", content: "别项目的悄悄话", at: Date.now() }] });
  const foreignFetch = await sessionForActiveProject(foreign.id);
  must(foreignFetch.session == null && /not found/i.test(foreignFetch.error ?? ""), "G2: a foreign project's session answers not found, never its transcript");
  const ghostFetch = await sessionForActiveProject("ai-no-such-session");
  must(ghostFetch.session == null, "G2: a ghost id answers not found");
  const own = await sessionForActiveProject(sessionId);
  must(own.session?.id === sessionId && own.session.messages.length > 10, "G2: the own session fetches in full (transcript intact)");

  // the delete contract: the pinning law covers deletion too — a foreign
  // session cannot even be deleted through this door (switch projects
  // first); own sessions delete cleanly; ghosts answer not found
  const delForeign = await deleteSessionForActiveProject(foreign.id);
  must(delForeign.ok === false && /not found/i.test(delForeign.error ?? ""), "G3: deleting a foreign session is refused by the pinning law");
  deleteSession(foreign.id); // store-level cleanup of the foreign fixture
  const throwaway = createSession(pid);
  saveSession({ ...throwaway, messages: [{ role: "user", content: "用完即弃的一句", at: Date.now() }] });
  const delOwn = await deleteSessionForActiveProject(throwaway.id);
  must(delOwn.ok === true && getSession(throwaway.id) == null, "G3: an own session deletes through the door");
  const delGhost = await deleteSessionForActiveProject("ai-no-such-session");
  must(delGhost.ok === false && /not found/i.test(delGhost.error ?? ""), "G3: deleting a ghost answers not found");
  must(latestSessionForProject(pid)?.id != null && listSessionSummaries(pid).some((s) => s.id === sessionId), "G3: the F session survives the foreign cleanup");
}

globalThis.fetch = originalFetch;
console.log(`\nt419 AI assistant: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
