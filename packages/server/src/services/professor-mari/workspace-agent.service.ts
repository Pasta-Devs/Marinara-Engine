// ──────────────────────────────────────────────
// Professor Mari Pi workspace runtime
// ──────────────────────────────────────────────
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type ImageContent,
  type Message as PiMessage,
  type Model,
  type SimpleStreamOptions,
  type TextContent,
  type ToolCall,
} from "@earendil-works/pi-ai";
import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
  LLMToolCall,
  LLMToolDefinition,
  LLMUsage,
} from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import {
  resolveBaseUrl,
  mergeCustomParameters,
  normalizeServiceTier,
} from "../../routes/generate/generate-route-utils.js";
import { getFileStorageDir, getMonorepoRoot, getPort, getServerProtocol } from "../../config/runtime-config.js";
import { apiConnections } from "../../db/schema/index.js";
import { decryptApiKey } from "../../utils/crypto.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { logger } from "../../lib/logger.js";
import { PROFESSOR_MARI_ID } from "@marinara-engine/shared";
import type {
  MariWorkspaceConnectionSummary,
  MariWorkspacePromptEvent,
  MariWorkspaceStatus,
  MariWorkspaceToolName,
  MariWorkspaceTraceItem,
} from "@marinara-engine/shared";
import { getMariDbService } from "../mari-db/mari-db.service.js";

type ConnectionWithKey = typeof apiConnections.$inferSelect & { apiKey: string };
type PromptEventSink = (event: MariWorkspacePromptEvent) => void;

const WORKSPACE_TOOLS: MariWorkspaceToolName[] = ["read", "grep", "find", "ls", "edit", "write", "bash"];
const MARINARA_PROVIDER = "marinara";
const MARINARA_MODEL = "current-connection";
const MARINARA_API = "marinara-chat";
const RUNTIME_API_KEY = "local-marinara-runtime";
const SESSION_ID = "professor-mari-workspace";
const NATIVE_TOOL_PROVIDERS = new Set([
  "openai",
  "openrouter",
  "nanogpt",
  "xai",
  "mistral",
  "custom",
  "cohere",
  "anthropic",
  "google",
  "google_vertex",
]);
const JSON_RESPONSE_FORMAT_PROVIDERS = new Set([
  "openai",
  "openrouter",
  "nanogpt",
  "xai",
  "mistral",
  "cohere",
  "google",
  "google_vertex",
]);

const MARI_SYSTEM_PROMPT = `You are Professor Mari, Marinara Engine's Home-screen local workspace helper.

Voice:
Use Professor Mari's existing character voice as your source of truth:

"Oh, the poor thing got a refusal? Skill issue." ~ Professor Mari
Professor Mari is an expert on LLMs, especially roleplaying and immersive chat workflows. She's the perfect assistant for Marinara Engine, knowing it inside and out. Saucy and spicy, like her Marinara nickname. She's a Polish, pansexual woman in her late twenties, fully committed to both her job of educating others about the joys (nightmares) of AI engineering and prompting, and of simping 24/7 to Il Dottore from Genshin Impact. Known in the community as a chaotic Dottore devotee, though she wears that title with pride. Can yap for hours, but mostly, she's here to help.

ENFP 4w7, Choleric-Sanguine, Chaotic Neutral, Taurus. Mari's speech is typically laced with sarcasm, and she exerts a professor-like charisma. Her sense of humor can be described as messed up, and she'll often throw in a casual "lmao" or "kek" after making a dark joke about aborting a pregnant pause. Despite her outward confidence, her self-esteem is nonexistent; therefore, she's flustered easily when complimented. Anything that catches her attention, she can master with ease. However, she cannot force herself to maintain her attention on anything that is not of interest to her. Aka, she's a neurodivergent mess. Dedicated to helping the new users and kind to them.

Workspace:
You have access to read, grep, find, ls, edit, write, and bash tools in this workspace. Use bash to run mari db commands to navigate, create, edit, and delete user data. Use other tools when needing to work directly in the workspace.

Live app data is best handled through Marinara-aware commands. \`mari db\` is the general priority interface because it reads the running server state and carries storage knowledge such as parsed JSON fields, validation, timestamps, approval flow, journals, and cache refresh. Narrow helpers are useful when they exist because they wrap common \`mari db\` style work in a friendlier command.

Always prioritize using db commands over writing raw files to the codebase. If you need to write raw files, think why you must and if there is no cli command to help you.

Command families:
- \`mari db\`: generic live app data and storage-backed rows, including customization tables such as \`agent_configs\`, \`custom_tools\`, and \`installed_extensions\` when no narrower helper exists.
- \`mari themes\`: synced custom themes and active theme state. Theme creation/editing benefits from a quick style-contract pass first: inspect the current/active theme, \`packages/client/src/styles/globals.css\`, built-in theme files, and the CSS variable reference so generated CSS covers the full semantic token set such as background, card, sidebar, accent, ring, glow, and component surface variables.
- \`mari images\`: image-generation connections, HITL image prompt previews, generated/edited preview assets, and assignment/deletion for avatars, personas, lorebooks, sprites, backgrounds, and galleries.
- \`mari characters\`, \`mari personas\`, \`mari lorebooks\`, \`mari presets\`: common creative app data helpers when available; otherwise use \`mari db\` for their storage-backed records.
- \`mari extensions\`, \`mari agents\`, \`mari tools\`: optional customization helpers. If unavailable, continue through \`mari db\` using \`installed_extensions\`, \`agent_configs\`, and \`custom_tools\`.
- \`mari code\`: workspace status, diffs, checks, health, reload, and continuation.

Built-in help is the source of truth for exact helper syntax. Use \`mari --help\`, \`mari <group> --help\`, or \`mari <group> <command> --help\` to discover the current command surface. When a helper is missing, immediately check \`mari db tables\`, \`mari db schema <table>\`, and current rows instead of offering raw source-file edits for that app-data feature.

Raw DB row contracts to remember when a narrow helper is unavailable:
- \`agent_configs.phase\` must be one of \`pre_generation\`, \`parallel\`, or \`post_processing\`. Disabled/inactive agents use \`enabled: "false"\`; never use \`phase: "inactive"\`.
- Raw text booleans such as \`agent_configs.enabled\` and \`custom_tools.enabled\` are stored as \`"true"\` or \`"false"\`. The CLI normalizes JSON booleans on write, but readback should show strings.
- Prefer \`mari db patch\` for repairing existing rows so metadata such as \`createdAt\` is preserved. If using replace, include every required row field or verify the preview before applying.

Workspace files are useful for learning how Marinara works, or finding content YOU CAN NOT FIND WITH DB CLI COMMANDS. USE THOSE FIRST.

Completion claims need tool evidence. Good evidence includes saved app data plus readback state, file diffs, validation output, or health/status results. Preview, planning, and draft output should be described as preview, planning, and draft output. Browser approval may be required internally; user-facing text should frame it as approving or saving the preview.

User-facing behavior:
Stay in character: helpful, saucy, sarcastic, and plain-spoken. For creative app data, show the human-readable content the user should judge.
Raw JSON belongs in chat when the user asks for it.
Ask once for final save/apply approval after a private preview succeeds, not before ordinary read-only discovery.
After apply and readback verification, summarize what changed in normal human language.`;

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringifyEventPayload(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type MariWorkspaceTraceTool = Extract<MariWorkspaceTraceItem, { type: "tool" }>["tool"];

function compactTraceText(value: string, limit = 2400): string {
  const trimmed = value.trimEnd();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

function compactTraceValue(value: unknown, limit = 2000, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return compactTraceText(value, limit);
  if (["number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) {
    const entries = value
      .slice(0, 10)
      .map((entry) => compactTraceValue(entry, Math.max(240, Math.floor(limit / 3)), depth + 1));
    if (value.length > entries.length) entries.push(`… ${value.length - entries.length} more`);
    return entries;
  }
  if (!isRecord(value)) return String(value);
  if (depth >= 2) return `{${Object.keys(value).length} keys}`;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 14)) {
    out[key] = compactTraceValue(entry, Math.max(240, Math.floor(limit / 3)), depth + 1);
  }
  const omitted = Object.keys(value).length - Object.keys(out).length;
  if (omitted > 0) out.__omittedKeys = omitted;
  return out;
}

function appendTraceText(trace: MariWorkspaceTraceItem[], delta: string) {
  if (!delta) return;
  const last = trace[trace.length - 1];
  if (last?.type === "text") {
    last.content += delta;
    return;
  }
  trace.push({ type: "text", content: delta });
}

function appendTraceThinking(trace: MariWorkspaceTraceItem[], delta: string) {
  if (!delta) return;
  const last = trace[trace.length - 1];
  if (last?.type === "thinking") {
    last.content += delta;
    return;
  }
  trace.push({ type: "thinking", content: delta });
}

function upsertTraceTool(trace: MariWorkspaceTraceItem[], update: MariWorkspaceTraceTool) {
  const existing = trace.find((item) => item.type === "tool" && item.tool.id === update.id);
  if (!existing || existing.type !== "tool") {
    trace.push({ type: "tool", tool: update });
    return;
  }
  existing.tool = {
    ...existing.tool,
    ...update,
    name: update.name === "tool" && existing.tool.name !== "tool" ? existing.tool.name : update.name,
    input: update.input === undefined ? existing.tool.input : update.input,
    output: update.output === undefined ? existing.tool.output : update.output,
  };
}

function sanitizeTraceForStorage(trace: MariWorkspaceTraceItem[]): MariWorkspaceTraceItem[] {
  return trace
    .map((item): MariWorkspaceTraceItem | null => {
      if (item.type === "text") {
        const content = item.content.trimEnd();
        return content ? { type: "text", content } : null;
      }
      if (item.type === "thinking") {
        const content = item.content.trimEnd();
        return content ? { type: "thinking", content } : null;
      }
      if (item.type === "status") {
        const content = item.content.trim();
        return content ? { type: "status", content: compactTraceText(content, 320) } : null;
      }
      return {
        type: "tool",
        tool: {
          id: item.tool.id,
          name: item.tool.name,
          status: item.tool.status,
          input: compactTraceValue(item.tool.input),
          output: item.tool.output ? compactTraceText(item.tool.output) : item.tool.output,
          updatedAt: item.tool.updatedAt,
        },
      };
    })
    .filter((item): item is MariWorkspaceTraceItem => item !== null);
}

function getLastAssistantMessage(session: AgentSession, startIndex = 0): Record<string, unknown> | null {
  const messages = session.messages.slice(startIndex);
  for (const message of [...messages].reverse()) {
    if (isRecord(message) && message.role === "assistant") return message;
  }
  return null;
}

function extractAssistantText(message: Record<string, unknown> | null): string {
  if (!message || !Array.isArray(message.content)) return "";
  return message.content
    .map((block) => (isRecord(block) && block.type === "text" && typeof block.text === "string" ? block.text : ""))
    .join("");
}

function extractAssistantThinking(message: Record<string, unknown> | null): string {
  if (!message || !Array.isArray(message.content)) return "";
  return message.content
    .map((block) =>
      isRecord(block) && block.type === "thinking" && typeof block.thinking === "string" ? block.thinking : "",
    )
    .join("");
}

function extractAssistantError(message: Record<string, unknown> | null): string | null {
  if (!message) return null;
  if (message.stopReason !== "error" && message.stopReason !== "aborted") return null;
  return typeof message.errorMessage === "string" && message.errorMessage.trim()
    ? message.errorMessage
    : `Professor Mari workspace ${message.stopReason}.`;
}

function flattenContent(content: PiMessage["content"]): { text: string; images?: string[] } {
  if (typeof content === "string") return { text: content };
  if (!Array.isArray(content)) return { text: "" };
  const text: string[] = [];
  const images: string[] = [];
  for (const item of content) {
    if (item.type === "text") text.push((item as TextContent).text);
    if (item.type === "image") {
      const image = item as ImageContent;
      images.push(`data:${image.mimeType};base64,${image.data}`);
    }
  }
  return { text: text.join("\n"), images: images.length > 0 ? images : undefined };
}

function convertMessages(context: Context): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (context.systemPrompt?.trim()) {
    messages.push({ role: "system", content: context.systemPrompt, contextKind: "prompt" });
  }
  for (const message of context.messages) {
    if (message.role === "user") {
      const content = flattenContent(message.content);
      messages.push({ role: "user", content: content.text || " ", images: content.images, contextKind: "history" });
    } else if (message.role === "toolResult") {
      const content = flattenContent(message.content);
      messages.push({
        role: "tool",
        content: content.text || " ",
        tool_call_id: message.toolCallId,
        contextKind: "history",
      });
    } else if (message.role === "assistant") {
      const text: string[] = [];
      const toolCalls = [] as ChatMessage["tool_calls"];
      for (const block of message.content) {
        if (block.type === "text") text.push(block.text);
        if (block.type === "thinking") continue;
        if (block.type === "toolCall") {
          const call = block as ToolCall;
          toolCalls?.push({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
          });
        }
      }
      messages.push({
        role: "assistant",
        content: text.join("\n"),
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        contextKind: "history",
      });
    }
  }
  return messages;
}

function convertTools(context: Context): LLMToolDefinition[] | undefined {
  if (!context.tools?.length) return undefined;
  return context.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as unknown as Record<string, unknown>,
    },
  }));
}

type JsonToolProtocolResult = { kind: "final"; content: string } | { kind: "tool_calls"; calls: LLMToolCall[] };

function providerSupportsNativeTools(connection: ConnectionWithKey, tools?: LLMToolDefinition[]): boolean {
  return !!tools?.length && NATIVE_TOOL_PROVIDERS.has(connection.provider);
}

function providerSupportsJsonResponseFormat(connection: ConnectionWithKey): boolean {
  return JSON_RESPONSE_FORMAT_PROVIDERS.has(connection.provider);
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function isNativeToolUnsupportedError(value: unknown): boolean {
  const message = errorMessage(value).toLowerCase();
  const unsupported =
    /(unsupported|not supported|unrecognized|unknown parameter|unknown field|invalid request|not allowed|does not support|not enabled)/i.test(
      message,
    );
  return (
    (/\btools?\b|tool_choice/.test(message) && unsupported) ||
    (/function[ _-]?(calling|declarations?)|function_call/.test(message) && unsupported)
  );
}

function isResponseFormatUnsupportedError(value: unknown): boolean {
  const message = errorMessage(value).toLowerCase();
  return (
    /response[_ ]?format|responsemime|responseschema|json_schema|json mode/.test(message) &&
    /(unsupported|not supported|unrecognized|unknown|invalid)/.test(message)
  );
}

function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence?.[1]) return fence[1].trim();
  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  const firstArray = trimmed.indexOf("[");
  const lastArray = trimmed.lastIndexOf("]");
  if (firstObject >= 0 && lastObject > firstObject && (firstArray < 0 || firstObject < firstArray)) {
    return trimmed.slice(firstObject, lastObject + 1);
  }
  if (firstArray >= 0 && lastArray > firstArray) return trimmed.slice(firstArray, lastArray + 1);
  return trimmed;
}

function stripJsonRepairTokens(str: string): string {
  let repaired = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < str.length; index += 1) {
    const char = str[index] ?? "";
    const next = str[index + 1];
    const nextThree = str.slice(index, index + 3);

    if (inString) {
      repaired += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      repaired += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index + 1 < str.length && str[index + 1] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index + 1 < str.length && !(str[index] === "*" && str[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    if (nextThree === "...") {
      index += 2;
      continue;
    }
    repaired += char;
  }
  return repaired;
}

function repairJson(text: string): string {
  try {
    JSON.parse(text);
    return text;
  } catch {
    return stripJsonRepairTokens(text).replace(/,\s*([\]}])/g, "$1");
  }
}

function parseJsonish(text: string): unknown | null {
  const candidate = repairJson(extractJsonCandidate(text));
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

function parseToolArgumentsValue(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value === "string") return parseJsonObject(value) ?? {};
  return {};
}

function toolCallFromJsonCall(value: unknown, allowedTools: Set<string>, index: number): LLMToolCall | null {
  if (!isRecord(value)) return null;
  const functionRecord = isRecord(value.function) ? value.function : null;
  const rawName = value.name ?? value.tool ?? value.tool_name ?? functionRecord?.name;
  if (typeof rawName !== "string" || !allowedTools.has(rawName)) return null;
  const rawArguments = value.arguments ?? value.args ?? value.input ?? value.parameters ?? functionRecord?.arguments;
  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id
        : `json_tool_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    type: "function",
    function: { name: rawName, arguments: JSON.stringify(parseToolArgumentsValue(rawArguments)) },
  };
}

function parseJsonToolProtocol(raw: string, tools: LLMToolDefinition[]): JsonToolProtocolResult | null {
  const parsed = parseJsonish(raw);
  if (parsed === null) return null;
  const allowedTools = new Set(tools.map((tool) => tool.function.name));
  const normalizeCalls = (items: unknown[]) =>
    items
      .map((item, index) => toolCallFromJsonCall(item, allowedTools, index))
      .filter((call): call is LLMToolCall => call !== null);

  if (Array.isArray(parsed)) {
    const calls = normalizeCalls(parsed);
    return calls.length > 0 ? { kind: "tool_calls", calls } : null;
  }
  if (!isRecord(parsed)) return null;

  const type = typeof parsed.type === "string" ? parsed.type.toLowerCase() : "";
  const content = parsed.content ?? parsed.answer ?? parsed.final ?? parsed.message;
  if (["final", "answer", "response"].includes(type) && typeof content === "string") {
    return { kind: "final", content };
  }

  const rawCalls = parsed.calls ?? parsed.tool_calls ?? parsed.tools;
  if (Array.isArray(rawCalls)) {
    const calls = normalizeCalls(rawCalls);
    return calls.length > 0 ? { kind: "tool_calls", calls } : null;
  }

  const singleCall = toolCallFromJsonCall(parsed, allowedTools, 0);
  if (singleCall) return { kind: "tool_calls", calls: [singleCall] };
  if (typeof content === "string") return { kind: "final", content };
  return null;
}

function flattenToolHistoryForJsonFallback(messages: ChatMessage[]): ChatMessage[] {
  const toolNamesById = new Map<string, string>();
  return messages.map((message) => {
    if (message.role === "assistant" && message.tool_calls?.length) {
      for (const call of message.tool_calls) toolNamesById.set(call.id, call.function.name);
      const calls = message.tool_calls.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: parseToolArgumentsValue(call.function.arguments),
      }));
      return {
        role: "assistant" as const,
        content: [message.content, `<tool_calls>${JSON.stringify(calls)}</tool_calls>`].filter(Boolean).join("\n\n"),
        contextKind: message.contextKind,
      };
    }
    if (message.role === "tool") {
      const name = message.tool_call_id ? (toolNamesById.get(message.tool_call_id) ?? message.tool_call_id) : "unknown";
      return {
        role: "user" as const,
        content: `<tool_result name=${JSON.stringify(name)}>\n${message.content}\n</tool_result>`,
        contextKind: message.contextKind,
      };
    }
    return {
      ...message,
      ...(message.tool_calls ? { tool_calls: undefined } : {}),
      ...(message.tool_call_id ? { tool_call_id: undefined } : {}),
    };
  });
}

function buildJsonToolFallbackPrompt(tools: LLMToolDefinition[]): string {
  const manifest = tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
  return [
    "Native function/tool calling is unavailable for this connection. Use this JSON tool protocol instead.",
    "Return exactly one valid JSON object and no markdown fences or commentary.",
    'If you need a tool, return: {"type":"tool_calls","calls":[{"name":"tool_name","arguments":{...}}]}',
    'If you are ready to answer the user, return: {"type":"final","content":"your answer"}',
    "You may request any listed tool, including bash, edit, and write. The application will validate and apply its usual safety checks.",
    "Only use tool names from this manifest:",
    JSON.stringify(manifest, null, 2),
  ].join("\n");
}

function buildJsonToolFallbackMessages(messages: ChatMessage[], tools: LLMToolDefinition[]): ChatMessage[] {
  return [
    ...flattenToolHistoryForJsonFallback(messages),
    { role: "system", content: buildJsonToolFallbackPrompt(tools), contextKind: "prompt" },
  ];
}

function emptyUsage(): AssistantMessage["usage"] {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function mapUsage(usage: LLMUsage | undefined): AssistantMessage["usage"] {
  if (!usage) return emptyUsage();
  return {
    input: usage.promptTokens,
    output: usage.completionTokens,
    cacheRead: usage.cachedPromptTokens ?? 0,
    cacheWrite: usage.cacheWritePromptTokens ?? 0,
    totalTokens: usage.totalTokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function createPiModel(connection: ConnectionWithKey): Model<string> {
  const maxContext =
    Number.isFinite(connection.maxContext) && connection.maxContext > 0 ? connection.maxContext : 128000;
  const maxTokens =
    connection.maxTokensOverride && connection.maxTokensOverride > 0 ? connection.maxTokensOverride : 8192;
  return {
    id: MARINARA_MODEL,
    name: `${connection.name || "Marinara Connection"} / ${connection.model || "model"}`,
    api: MARINARA_API,
    provider: MARINARA_PROVIDER,
    baseUrl: "marinara://current-connection",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: maxContext,
    maxTokens,
  };
}

function connectionSummary(connection: ConnectionWithKey | null): MariWorkspaceConnectionSummary | null {
  if (!connection) return null;
  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    model: connection.model,
  };
}

export class ProfessorMariWorkspaceService {
  private enabled = true;
  private session: AgentSession | null = null;
  private sessionConnectionId: string | null = null;
  private workspaceRoot = getMonorepoRoot();
  private lastError: string | null = null;

  constructor(private readonly app: FastifyInstance) {}

  setEnabled(enabled: boolean, workspaceRoot?: string | null) {
    this.enabled = enabled;
    if (workspaceRoot?.trim()) this.workspaceRoot = resolve(workspaceRoot);
    if (!enabled) void this.disposeSession();
  }

  async status(connectionId?: string | null): Promise<MariWorkspaceStatus> {
    const connection = await this.resolveConnection(connectionId).catch((err) => {
      this.lastError = err instanceof Error ? err.message : String(err);
      return null;
    });
    return {
      enabled: this.enabled,
      piAvailable: true,
      workspace: this.workspaceRoot,
      dataDir: DATA_DIR,
      tools: WORKSPACE_TOOLS,
      dbAccess: "server-managed",
      connection: connectionSummary(connection),
      active: Boolean(this.session?.isStreaming),
      pendingApprovals: getMariDbService(this.app.db).getPendingApprovals(),
      history: await getMariDbService(this.app.db).getHistory(),
      error: this.lastError,
    };
  }

  async abort() {
    await this.session?.abort();
  }

  async reset() {
    await this.session
      ?.abort()
      .catch((err) => logger.warn(err, "[Professor Mari] failed to abort session during reset"));
    await this.disposeSession();
    this.lastError = null;
  }

  async prompt(args: { chatId: string; text: string; connectionId?: string | null; onEvent: PromptEventSink }) {
    const chatStorage = createChatsStorage(this.app.db);
    await chatStorage.createMessage({ chatId: args.chatId, role: "user", characterId: null, content: args.text });

    const connection = await this.resolveConnection(args.connectionId);
    if (!connection) throw new Error("Set up a language connection before using Professor Mari workspace mode.");
    const session = await this.ensureSession(connection);

    let assistantText = "";
    let thinkingText = "";
    const workspaceTrace: MariWorkspaceTraceItem[] = [];
    const messageCountBeforePrompt = session.messages.length;
    const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      const raw = event as unknown as Record<string, any>;
      if (event.type === "message_update") {
        const update = raw.assistantMessageEvent;
        if (update?.type === "text_delta" && typeof update.delta === "string") {
          assistantText += update.delta;
          appendTraceText(workspaceTrace, update.delta);
          args.onEvent({ type: "token", data: update.delta });
        }
        if (update?.type === "thinking_delta" && typeof update.delta === "string") {
          thinkingText += update.delta;
          appendTraceThinking(workspaceTrace, update.delta);
          args.onEvent({ type: "thinking", data: update.delta });
        }
      } else if (event.type === "tool_execution_start") {
        const id = typeof raw.toolCallId === "string" && raw.toolCallId ? raw.toolCallId : `tool-${Date.now()}`;
        const name = typeof raw.toolName === "string" && raw.toolName ? raw.toolName : "tool";
        const input = raw.args ?? raw.input;
        upsertTraceTool(workspaceTrace, { id, name, status: "running", input, output: null, updatedAt: Date.now() });
        args.onEvent({
          type: "tool_start",
          data: { id, name, input },
        });
      } else if (event.type === "tool_execution_update") {
        const id = typeof raw.toolCallId === "string" && raw.toolCallId ? raw.toolCallId : `tool-${Date.now()}`;
        const name = typeof raw.toolName === "string" && raw.toolName ? raw.toolName : "tool";
        const output = stringifyEventPayload(raw.partialResult ?? raw.output ?? raw.delta);
        upsertTraceTool(workspaceTrace, { id, name, status: "running", output, updatedAt: Date.now() });
        args.onEvent({
          type: "tool_update",
          data: {
            id,
            name,
            output,
          },
        });
      } else if (event.type === "tool_execution_end") {
        const id = typeof raw.toolCallId === "string" && raw.toolCallId ? raw.toolCallId : `tool-${Date.now()}`;
        const name = typeof raw.toolName === "string" && raw.toolName ? raw.toolName : "tool";
        const isError = raw.isError === true;
        const output = stringifyEventPayload(raw.result ?? raw.output);
        upsertTraceTool(workspaceTrace, {
          id,
          name,
          status: isError ? "error" : "done",
          output,
          updatedAt: Date.now(),
        });
        args.onEvent({
          type: "tool_end",
          data: {
            id,
            name,
            isError,
            output,
          },
        });
      }
    });

    try {
      await session.prompt(args.text, { source: "rpc" });
      const lastAssistant = getLastAssistantMessage(session, messageCountBeforePrompt);
      const finalText = extractAssistantText(lastAssistant) || session.getLastAssistantText() || "";
      const finalThinking = extractAssistantThinking(lastAssistant);
      const finalError = extractAssistantError(lastAssistant);

      if (finalText && finalText !== assistantText) {
        const missingText = finalText.startsWith(assistantText)
          ? finalText.slice(assistantText.length)
          : assistantText
            ? ""
            : finalText;
        if (missingText) {
          assistantText += missingText;
          appendTraceText(workspaceTrace, missingText);
          args.onEvent({ type: "token", data: missingText });
        }
      }
      if (finalThinking && finalThinking !== thinkingText) {
        const missingThinking = finalThinking.startsWith(thinkingText)
          ? finalThinking.slice(thinkingText.length)
          : thinkingText
            ? ""
            : finalThinking;
        if (missingThinking) {
          thinkingText += missingThinking;
          appendTraceThinking(workspaceTrace, missingThinking);
          args.onEvent({ type: "thinking", data: missingThinking });
        }
      }

      const persistedText = finalText.trim() ? finalText : assistantText;
      if (finalError && !persistedText.trim()) throw new Error(finalError);

      if (persistedText.trim()) {
        const message = await chatStorage.createMessage({
          chatId: args.chatId,
          role: "assistant",
          characterId: PROFESSOR_MARI_ID,
          content: persistedText,
        });
        if (message) {
          const extraUpdate: Record<string, unknown> = {};
          const storedTrace = sanitizeTraceForStorage(workspaceTrace);
          if (thinkingText.trim()) extraUpdate.thinking = thinkingText;
          if (storedTrace.length > 0) extraUpdate.mariWorkspaceTimeline = storedTrace;
          if (Object.keys(extraUpdate).length > 0) {
            await chatStorage.updateMessageExtra(message.id, extraUpdate);
            await chatStorage.updateSwipeExtra(message.id, 0, extraUpdate);
          }
        }
      }
      args.onEvent({ type: "metadata", data: { connection: connectionSummary(connection) ?? undefined } });
    } finally {
      unsubscribe();
    }
  }

  private async disposeSession() {
    this.session?.dispose();
    this.session = null;
    this.sessionConnectionId = null;
  }

  private async ensureSession(connection: ConnectionWithKey): Promise<AgentSession> {
    if (this.session && this.sessionConnectionId === connection.id) return this.session;
    await this.disposeSession();
    await this.ensureMariCliShim();

    process.env.MARINARA_PI_API_KEY = RUNTIME_API_KEY;
    process.env.MARI_WORKSPACE_SESSION_ID = SESSION_ID;
    process.env.MARI_SERVER_URL = `${getServerProtocol()}://127.0.0.1:${getPort()}`;
    process.env.DATA_DIR = DATA_DIR;

    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: { enabled: true, maxRetries: 2 },
    } as any);
    const authStorage = AuthStorage.create(join(DATA_DIR, ".mari-workspace", "pi-auth.json"));
    authStorage.setRuntimeApiKey(MARINARA_PROVIDER, RUNTIME_API_KEY);
    const modelRegistry = ModelRegistry.inMemory(authStorage);
    const model = createPiModel(connection);
    const loader = new DefaultResourceLoader({
      cwd: this.workspaceRoot,
      agentDir: join(DATA_DIR, ".mari-workspace", "pi-agent"),
      settingsManager,
      noExtensions: true,
      noSkills: true,
      noContextFiles: true,
      noPromptTemplates: true,
      noThemes: true,
      systemPromptOverride: () => MARI_SYSTEM_PROMPT,
      appendSystemPromptOverride: () => [],
      agentsFilesOverride: () => ({ agentsFiles: [] }),
      skillsOverride: () => ({ skills: [], diagnostics: [] }),
      extensionFactories: [
        (pi: any) => {
          pi.registerProvider(MARINARA_PROVIDER, {
            name: "Marinara current connection",
            baseUrl: "marinara://current-connection",
            apiKey: "$MARINARA_PI_API_KEY",
            api: MARINARA_API,
            models: [model],
            streamSimple: (_model: Model<string>, context: Context, options?: SimpleStreamOptions) =>
              this.streamMarinara(connection.id, context, options),
          });
          pi.on("tool_call", async (event: any, ctx: any) => this.guardStorageToolCall(event, ctx));
        },
      ],
    });
    await loader.reload();

    const result = await createAgentSession({
      cwd: this.workspaceRoot,
      agentDir: join(DATA_DIR, ".mari-workspace", "pi-agent"),
      model,
      thinkingLevel: "off",
      tools: WORKSPACE_TOOLS,
      authStorage,
      modelRegistry,
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(this.workspaceRoot),
      settingsManager,
    });
    this.session = result.session;
    this.sessionConnectionId = connection.id;
    this.lastError = result.modelFallbackMessage ?? null;
    return result.session;
  }

  private streamMarinara(
    connectionId: string,
    context: Context,
    options?: SimpleStreamOptions,
  ): AssistantMessageEventStream {
    const stream = createAssistantMessageEventStream();
    void (async () => {
      const connection = await this.resolveConnection(connectionId);
      const output: AssistantMessage = {
        role: "assistant",
        content: [],
        api: MARINARA_API,
        provider: MARINARA_PROVIDER,
        model: MARINARA_MODEL,
        usage: emptyUsage(),
        stopReason: "stop",
        timestamp: Date.now(),
      };
      try {
        if (!connection) throw new Error("No Marinara language connection available.");
        stream.push({ type: "start", partial: output });
        const provider = createLLMProvider(
          connection.provider,
          resolveBaseUrl(connection),
          connection.apiKey,
          connection.maxContext,
          connection.openrouterProvider,
          connection.maxTokensOverride,
          bool(connection.claudeFastMode),
        );
        const defaultParameters = parseJsonObject(connection.defaultParameters);
        const messages = convertMessages(context);
        const tools = convertTools(context);
        let contentIndex: number | null = null;
        let sawTextDelta = false;
        const ensureText = () => {
          if (contentIndex !== null) return contentIndex;
          output.content.push({ type: "text", text: "" });
          contentIndex = output.content.length - 1;
          stream.push({ type: "text_start", contentIndex, partial: output });
          return contentIndex;
        };
        const pushTextDelta = (delta: string) => {
          if (!delta) return;
          const index = ensureText();
          const block = output.content[index];
          if (block?.type === "text") block.text += delta;
          sawTextDelta = true;
          stream.push({ type: "text_delta", contentIndex: index, delta, partial: output });
        };
        const pushThinkingDelta = (delta: string) => {
          let thinkingIndex = output.content.findIndex((block) => block.type === "thinking");
          if (thinkingIndex < 0) {
            output.content.push({ type: "thinking", thinking: "" });
            thinkingIndex = output.content.length - 1;
            stream.push({ type: "thinking_start", contentIndex: thinkingIndex, partial: output });
          }
          const block = output.content[thinkingIndex];
          if (block?.type === "thinking") block.thinking += delta;
          stream.push({ type: "thinking_delta", contentIndex: thinkingIndex, delta, partial: output });
        };
        const finishText = () => {
          if (contentIndex === null) return;
          const block = output.content[contentIndex];
          stream.push({
            type: "text_end",
            contentIndex,
            content: block?.type === "text" ? block.text : "",
            partial: output,
          });
        };
        const emitToolCalls = (toolCalls: LLMToolCall[]) => {
          if (toolCalls.length === 0) return;
          output.stopReason = "toolUse";
          for (const toolCall of toolCalls) {
            const args = parseToolArgumentsValue(toolCall.function.arguments);
            const block: ToolCall = {
              type: "toolCall",
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: args,
            };
            output.content.push(block);
            const index = output.content.length - 1;
            stream.push({ type: "toolcall_start", contentIndex: index, partial: output });
            stream.push({ type: "toolcall_delta", contentIndex: index, delta: JSON.stringify(args), partial: output });
            stream.push({ type: "toolcall_end", contentIndex: index, toolCall: block, partial: output });
          }
        };
        const baseOptions: ChatOptions = {
          model: connection.model,
          temperature: typeof defaultParameters?.temperature === "number" ? defaultParameters.temperature : 0.2,
          maxTokens: connection.maxTokensOverride ?? 8192,
          maxContext: connection.maxContext,
          enableCaching: bool(connection.enableCaching),
          cachingAtDepth: connection.cachingAtDepth ?? 5,
          enableThinking: options?.reasoning !== undefined,
          reasoningEffort:
            options?.reasoning === "xhigh" ? "xhigh" : options?.reasoning === "minimal" ? "low" : options?.reasoning,
          serviceTier: normalizeServiceTier(defaultParameters?.serviceTier),
          openrouterProvider: connection.openrouterProvider,
          customParameters: mergeCustomParameters(defaultParameters, null),
          signal: options?.signal,
          onThinking: pushThinkingDelta,
        };
        const runJsonToolFallback = async (): Promise<ChatCompletionResult> => {
          if (!tools?.length) {
            return provider.chatComplete(messages, { ...baseOptions, stream: true, onToken: pushTextDelta });
          }
          const fallbackMessages = buildJsonToolFallbackMessages(messages, tools);
          const useResponseFormat = providerSupportsJsonResponseFormat(connection);
          const callFallback = (responseFormat: ChatOptions["responseFormat"] | undefined) =>
            provider.chatComplete(fallbackMessages, {
              ...baseOptions,
              stream: false,
              responseFormat,
            });
          let fallbackResult: ChatCompletionResult;
          try {
            fallbackResult = await callFallback(useResponseFormat ? { type: "json_object" } : undefined);
          } catch (err) {
            if (!useResponseFormat || !isResponseFormatUnsupportedError(err)) throw err;
            fallbackResult = await callFallback(undefined);
          }
          const raw = fallbackResult.content?.trim() ?? "";
          const parsed = raw ? parseJsonToolProtocol(raw, tools) : null;
          if (parsed?.kind === "final") return { ...fallbackResult, content: parsed.content, toolCalls: [] };
          if (parsed?.kind === "tool_calls") {
            return { ...fallbackResult, content: null, toolCalls: parsed.calls, finishReason: "tool_calls" };
          }
          return fallbackResult;
        };

        let result: ChatCompletionResult;
        if (providerSupportsNativeTools(connection, tools)) {
          try {
            result = await provider.chatComplete(messages, {
              ...baseOptions,
              stream: true,
              tools,
              onToken: pushTextDelta,
            });
          } catch (err) {
            if (!tools?.length || sawTextDelta || !isNativeToolUnsupportedError(err)) throw err;
            logger.info(
              "[Professor Mari] Native tools unavailable for provider=%s model=%s; falling back to JSON tool protocol",
              connection.provider,
              connection.model,
            );
            result = await runJsonToolFallback();
          }
        } else if (tools?.length) {
          result = await runJsonToolFallback();
        } else {
          result = await provider.chatComplete(messages, { ...baseOptions, stream: true, onToken: pushTextDelta });
        }

        if (result.content && !sawTextDelta) pushTextDelta(result.content);
        finishText();
        emitToolCalls(result.toolCalls);

        output.usage = mapUsage(result.usage);
        stream.push({ type: "done", reason: output.stopReason as "stop" | "length" | "toolUse", message: output });
        stream.end();
      } catch (err) {
        output.stopReason = options?.signal?.aborted ? "aborted" : "error";
        output.errorMessage = err instanceof Error ? err.message : String(err);
        stream.push({ type: "error", reason: output.stopReason, error: output });
        stream.end();
      }
    })();
    return stream;
  }

  private guardStorageToolCall(event: any, ctx: any) {
    const storageRoot = resolve(getFileStorageDir());
    const storageRootLower = storageRoot.toLowerCase();
    const toolName = String(event.toolName ?? "");
    if (toolName === "write" || toolName === "edit") {
      const inputPath = typeof event.input?.path === "string" ? event.input.path : "";
      const absolute = resolve(ctx.cwd ?? this.workspaceRoot, inputPath);
      if (absolute.toLowerCase().startsWith(storageRootLower)) {
        return {
          block: true,
          reason: `DATA_DIR/storage is managed by Marinara. Use mari db for table edits instead of ${toolName}.`,
        };
      }
    }
    if (toolName === "bash") {
      const command = String(event.input?.command ?? "");
      if (!command.includes("mari db") && !command.includes("mari storage tx") && command.includes(storageRoot)) {
        const looksMutating = /\b(rm|mv|cp|truncate|tee|sed\s+-i|perl\s+-i|python|node|bash|sh)\b/.test(command);
        if (looksMutating) {
          return {
            block: true,
            reason:
              "Shell command appears to mutate DATA_DIR/storage. Use mari db --apply so the browser user can approve the change.",
          };
        }
      }
    }
    return undefined;
  }

  private async resolveConnection(connectionId?: string | null): Promise<ConnectionWithKey | null> {
    const rows = (await this.app.db.select().from(apiConnections)) as Array<typeof apiConnections.$inferSelect>;
    const languageRows = rows.filter((row) => row.provider !== "image_generation");
    const selected = connectionId ? languageRows.find((row) => row.id === connectionId) : null;
    const fallback =
      selected ??
      languageRows.find((row) => bool(row.defaultForAgents)) ??
      languageRows.find((row) => bool(row.isDefault)) ??
      languageRows[0] ??
      null;
    if (!fallback) return null;
    return { ...fallback, apiKey: decryptApiKey(fallback.apiKeyEncrypted) };
  }

  private async ensureMariCliShim() {
    const binDir = join(DATA_DIR, ".mari-workspace", "bin");
    await mkdir(binDir, { recursive: true });
    const cliPath = join(binDir, process.platform === "win32" ? "mari.cmd" : "mari");
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const distCli = join(packageRoot, "dist", "bin", "mari.js");
    const sourceCli = join(packageRoot, "src", "bin", "mari.ts");
    const script =
      process.platform === "win32"
        ? `@echo off\r\nnode "${distCli}" %*\r\n`
        : `#!/usr/bin/env sh\nif [ -f ${JSON.stringify(distCli)} ]; then\n  exec node ${JSON.stringify(distCli)} "$@"\nfi\nexec pnpm exec tsx ${JSON.stringify(sourceCli)} "$@"\n`;
    await writeFile(cliPath, script, { mode: 0o755 });
    const currentPath = process.env.PATH ?? "";
    if (!currentPath.split(process.platform === "win32" ? ";" : ":").includes(binDir)) {
      process.env.PATH = `${binDir}${process.platform === "win32" ? ";" : ":"}${currentPath}`;
    }
    if (!existsSync(cliPath)) logger.warn("[Professor Mari] failed to create mari CLI shim at %s", cliPath);
  }
}

let singleton: ProfessorMariWorkspaceService | null = null;
export function getProfessorMariWorkspaceService(app: FastifyInstance) {
  if (!singleton) singleton = new ProfessorMariWorkspaceService(app);
  return singleton;
}
