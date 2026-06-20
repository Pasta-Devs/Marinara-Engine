// ──────────────────────────────────────────────
// Professor Mari Pi workspace runtime
// ──────────────────────────────────────────────
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import {
  AuthStorage,
  createAgentSession,
  createBashTool,
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
  BaseLLMProvider,
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
  LLMToolCall,
  LLMToolDefinition,
  LLMUsage,
} from "../llm/base-provider.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } from "../llm/local-sidecar.js";
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
import {
  findKnownModel,
  LOCAL_SIDECAR_CONNECTION_ID,
  MODEL_LISTS,
  PROFESSOR_MARI_ID,
  type APIProvider,
} from "@marinara-engine/shared";
import type {
  MariWorkspaceConnectionSummary,
  MariWorkspacePromptEvent,
  MariWorkspaceStatus,
  MariWorkspaceToolName,
  MariWorkspaceTraceItem,
} from "@marinara-engine/shared";
import { getMariDbService } from "../mari-db/mari-db.service.js";
import { getProfessorMariWorkspaceSkillsService } from "./workspace-skills.service.js";
import { sidecarModelService } from "../sidecar/sidecar-model.service.js";

type DbConnectionWithKey = typeof apiConnections.$inferSelect & { apiKey: string };
type WorkspaceConnection = Pick<
  DbConnectionWithKey,
  | "id"
  | "name"
  | "model"
  | "baseUrl"
  | "apiKey"
  | "maxContext"
  | "maxTokensOverride"
  | "defaultParameters"
  | "openrouterProvider"
  | "claudeFastMode"
  | "enableCaching"
  | "cachingAtDepth"
> & { provider: string; isLocalSidecar?: boolean };
type PromptEventSink = (event: MariWorkspacePromptEvent) => void;

const WORKSPACE_TOOLS: MariWorkspaceToolName[] = ["read", "grep", "find", "ls", "edit", "write", "bash"];
const MARINARA_PROVIDER = "marinara";
const MARINARA_MODEL = "current-connection";
const MARINARA_API = "marinara-chat";
const RUNTIME_API_KEY = "local-marinara-runtime";
const SESSION_ID = "professor-mari-workspace";
const JSON_RESPONSE_FORMAT_PROVIDERS = new Set(["custom", "local_sidecar"]);

function isPrivateOrLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "host.docker.internal" ||
    host === "host.containers.internal" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    (!host.includes(".") && !host.includes(":"))
  ) {
    return true;
  }
  if (host === "::" || host === "::1" || host === "0:0:0:0:0:0:0:0" || host === "0:0:0:0:0:0:0:1") return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number.parseInt(ipv4[1] ?? "", 10);
    const b = Number.parseInt(ipv4[2] ?? "", 10);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
}

function isProbablyLocalEndpoint(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false;
  try {
    return isPrivateOrLoopbackHostname(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

function getPathEnvKey(env: NodeJS.ProcessEnv) {
  return Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
}

function normalizePathEntry(entry: string) {
  const normalized = resolve(entry);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function prependPathEntry(env: NodeJS.ProcessEnv, entry: string) {
  const pathKey = getPathEnvKey(env);
  const currentPath = env[pathKey] ?? "";
  const entries = currentPath.split(delimiter).filter(Boolean);
  const normalizedEntry = normalizePathEntry(entry);
  const alreadyPresent = entries.some((candidate) => normalizePathEntry(candidate) === normalizedEntry);
  if (!alreadyPresent) env[pathKey] = [entry, ...entries].join(delimiter);
  return env;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function powershellQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

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
- \`mari wiki\`: read-only Fandom/MediaWiki discovery and page reads. Use \`mari wiki --help\` to find wikis, search pages, read summaries/source/sections, list categories, and search within a page.
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

function appendTraceStatus(trace: MariWorkspaceTraceItem[], content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  const last = trace[trace.length - 1];
  if (last?.type === "status" && last.content === trimmed) return;
  trace.push({ type: "status", content: trimmed });
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

function isLocalSidecarConnection(connection: WorkspaceConnection): boolean {
  return connection.isLocalSidecar === true || connection.id === LOCAL_SIDECAR_CONNECTION_ID;
}

function isLocalCustomOpenAIConnection(connection: WorkspaceConnection): boolean {
  return connection.provider === "custom" && isProbablyLocalEndpoint(connection.baseUrl);
}

function shouldUseGuardedNativeToolAttempt(connection: WorkspaceConnection): boolean {
  return isLocalSidecarConnection(connection) || isLocalCustomOpenAIConnection(connection);
}

function canFallbackToJsonToolProtocol(connection: WorkspaceConnection): boolean {
  return shouldUseGuardedNativeToolAttempt(connection);
}

function providerSupportsNativeTools(_connection: WorkspaceConnection, tools?: LLMToolDefinition[]): boolean {
  // Always attempt provider-native tool calls first. Hosted connections never use
  // the JSON prompt fallback; local sidecar/custom endpoints may fall back only
  // after native tools fail or fake a tool call in text.
  return !!tools?.length;
}

function providerSupportsJsonResponseFormat(connection: WorkspaceConnection): boolean {
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

function parseTaggedParameterValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = parseJsonish(trimmed);
  return parsed ?? trimmed;
}

function toolCallFromTaggedBlock(block: string, allowedTools: Set<string>, index: number): LLMToolCall | null {
  const parsed = parseJsonish(block);
  if (parsed !== null) {
    if (Array.isArray(parsed)) {
      for (const [itemIndex, item] of parsed.entries()) {
        const parsedCall = toolCallFromJsonCall(item, allowedTools, index + itemIndex);
        if (parsedCall) return parsedCall;
      }
    } else {
      const parsedCall = toolCallFromJsonCall(parsed, allowedTools, index);
      if (parsedCall) return parsedCall;
    }
  }

  const functionMatch = block.match(/<function=([a-zA-Z0-9_-]+)>\s*([\s\S]*?)(?:<\/function>|$)/i);
  if (!functionMatch) return null;
  const name = functionMatch[1] ?? "";
  if (!allowedTools.has(name)) return null;
  const body = functionMatch[2] ?? "";
  const args: Record<string, unknown> = {};
  const paramRegex = /<parameter=([^>]+)>\s*([\s\S]*?)\s*<\/parameter>/gi;
  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(body)) !== null) {
    const key = (match[1] ?? "").trim();
    if (!key) continue;
    args[key] = parseTaggedParameterValue(match[2] ?? "");
  }
  return {
    id: `tagged_tool_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

function parseTaggedToolCalls(raw: string, allowedTools: Set<string>): LLMToolCall[] {
  const calls: LLMToolCall[] = [];
  const blockPatterns = [/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi, /<tool_calls>\s*([\s\S]*?)\s*<\/tool_calls>/gi];
  for (const pattern of blockPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(raw)) !== null) {
      const block = match[1] ?? "";
      const parsed = parseJsonish(block);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const call = toolCallFromJsonCall(item, allowedTools, calls.length);
          if (call) calls.push(call);
        }
        continue;
      }
      const call = toolCallFromTaggedBlock(block, allowedTools, calls.length);
      if (call) calls.push(call);
    }
  }
  return calls;
}

function looksLikeToolProtocolText(raw: string): boolean {
  return /<\/?tool_calls?>|"tool_calls"|"type"\s*:\s*"tool_calls"|<function=/i.test(raw);
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

function parseLineToolProtocol(raw: string, allowedTools: Set<string>): JsonToolProtocolResult | null {
  const toolLine = raw.match(/(?:^|\n)\s*TOOL_CALL\s+([a-zA-Z0-9_-]+)\s+([\s\S]*?)\s*$/i);
  if (toolLine) {
    const name = toolLine[1] ?? "";
    if (allowedTools.has(name)) {
      return {
        kind: "tool_calls",
        calls: [
          {
            id: `line_tool_${Date.now()}_0_${Math.random().toString(36).slice(2, 7)}`,
            type: "function",
            function: { name, arguments: JSON.stringify(parseToolArgumentsValue(toolLine[2] ?? "{}")) },
          },
        ],
      };
    }
  }

  const finalLine = raw.match(/(?:^|\n)\s*FINAL\s+([\s\S]+)$/i);
  if (finalLine?.[1]?.trim()) return { kind: "final", content: finalLine[1].trim() };
  return null;
}

function parseJsonToolProtocol(raw: string, tools: LLMToolDefinition[]): JsonToolProtocolResult | null {
  const allowedTools = new Set(tools.map((tool) => tool.function.name));
  const lineProtocol = parseLineToolProtocol(raw, allowedTools);
  if (lineProtocol) return lineProtocol;
  const taggedCalls = parseTaggedToolCalls(raw, allowedTools);
  if (taggedCalls.length > 0) return { kind: "tool_calls", calls: taggedCalls };

  const parsed = parseJsonish(raw);
  if (parsed === null) return null;
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

function normalizeTextToolProtocolResult(
  result: ChatCompletionResult,
  tools: LLMToolDefinition[],
): ChatCompletionResult | null {
  const raw = result.content?.trim();
  if (!raw) return null;
  const parsed = parseJsonToolProtocol(raw, tools);
  if (parsed?.kind === "final") return { ...result, content: parsed.content, toolCalls: [] };
  if (parsed?.kind === "tool_calls") {
    return { ...result, content: null, toolCalls: parsed.calls, finishReason: "tool_calls" };
  }
  return null;
}

function contentClaimsUnexecutedToolUse(content: string | null | undefined): boolean {
  const text = content?.trim();
  if (!text) return false;
  return /\b(?:i(?:'ve| have| just)?\s+(?:asked|requested|called|used|ran|listed|checked|looked|searched|created|added|updated|saved|read|inspected)|asked the system|waiting for (?:the )?(?:data|result|tool)|hang tight|once i see|tool result)\b/i.test(
    text,
  );
}

function latestUserLikelyNeedsTools(messages: ChatMessage[]): boolean {
  const request = getLatestUserContent(messages);
  if (!request) return false;
  const action = /\b(add|create|make|save|insert|update|edit|delete|remove|rename|import|export|list|show|search|find|check|look up|inspect|read|open|change|fix|install|run)\b/i.test(
    request,
  );
  const target = /\b(character|characters|persona|personas|lorebook|lorebooks|chat|chats|preset|presets|theme|themes|file|files|folder|folders|connection|connections|database|db|workspace|storage|list)\b/i.test(
    request,
  );
  return action && (target || /\bmy\b/i.test(request));
}

function shouldFallbackFromNativeText(messages: ChatMessage[], content: string | null | undefined): boolean {
  return contentClaimsUnexecutedToolUse(content) || latestUserLikelyNeedsTools(messages);
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
    "Native function/tool calling is unavailable for this connection. Use this private JSON tool protocol instead.",
    "Your entire assistant response MUST be exactly one valid JSON object. No markdown fences, no XML tags, no prose before/after JSON.",
    'If you need a tool, return: {"type":"tool_calls","calls":[{"name":"tool_name","arguments":{}}]}',
    'If you are ready to answer the user, return: {"type":"final","content":"your answer"}',
    "Do not print shell commands, tool-call tags, or explanations when you intend to use a tool. Put the tool request in JSON so the application can execute it privately.",
    "Never say you asked the system, listed data, checked files, created something, or are waiting for a tool result unless your current response is a tool_calls object.",
    "For requests to add, create, update, delete, inspect, list, search, or change Marinara data/files, use tool_calls first. Do not return final until after tool results are provided.",
    'Emergency fallback for weak local models only: if you cannot obey JSON, output exactly one line: TOOL_CALL tool_name {"arg":"value"} or FINAL your answer.',
    "You may request any listed tool, including bash, edit, and write. The application will validate and apply its usual safety checks.",
    "Only use tool names from this manifest:",
    JSON.stringify(manifest, null, 2),
  ].join("\n");
}

function buildJsonToolFallbackSchema(tools: LLMToolDefinition[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["tool_calls", "final"] },
      content: { type: "string" },
      calls: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string", enum: tools.map((tool) => tool.function.name) },
            arguments: { type: "object" },
          },
          required: ["name", "arguments"],
        },
      },
    },
    required: ["type"],
  };
}

function buildJsonToolFallbackResponseFormats(
  connection: WorkspaceConnection,
  tools: LLMToolDefinition[],
): Array<ChatOptions["responseFormat"] | undefined> {
  if (!providerSupportsJsonResponseFormat(connection)) return [undefined];
  if (isLocalSidecarConnection(connection)) {
    return [{ type: "json_schema", schema: buildJsonToolFallbackSchema(tools) }, { type: "json_object" }, undefined];
  }
  return [{ type: "json_object" }, undefined];
}

function getLatestUserContent(messages: ChatMessage[]): string {
  for (const message of [...messages].reverse()) {
    if (message.role === "user" && message.content.trim()) return message.content.trim();
  }
  return "";
}

function buildJsonToolFallbackMessages(
  messages: ChatMessage[],
  tools: LLMToolDefinition[],
  retryInstruction?: string,
): ChatMessage[] {
  const protocolPrompt = buildJsonToolFallbackPrompt(tools);
  const flattened = flattenToolHistoryForJsonFallback(messages);
  const systemContent = flattened
    .filter((message) => message.role === "system" && message.content.trim())
    .map((message) => message.content.trim())
    .join("\n\n");
  const nonSystemMessages = flattened.filter((message) => message.role !== "system");
  return [
    {
      role: "system",
      content: [
        protocolPrompt,
        systemContent ? `Original assistant instructions still apply inside final.content only:\n${systemContent}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      contextKind: "prompt",
    },
    ...nonSystemMessages,
    {
      role: "user",
      content:
        retryInstruction ??
        "Return the next assistant action for the user's latest request using exactly the JSON protocol above. Do not include anything outside the JSON object.",
      contextKind: "prompt",
    },
  ];
}

function buildJsonToolRepairMessages(
  messages: ChatMessage[],
  tools: LLMToolDefinition[],
  invalidResponse: string,
): ChatMessage[] {
  const latestUser = getLatestUserContent(messages);
  return [
    {
      role: "system",
      content: buildJsonToolFallbackPrompt(tools),
      contextKind: "prompt",
    },
    {
      role: "user",
      content: [
        "The previous assistant response was invalid because it wrote normal prose instead of the private tool protocol.",
        latestUser ? `Latest user request:\n${latestUser}` : "",
        "Previous invalid response:",
        invalidResponse.slice(0, 4000),
        "Convert that intended next action into exactly one valid JSON object now.",
        "If the response claims it asked/listed/checked/read/created/updated anything, it did NOT happen. Return a tool_calls object for the needed tool now.",
        'For character/database inspection, a valid first step is: {"type":"tool_calls","calls":[{"name":"bash","arguments":{"command":"mari db list characters --limit 50 --parsed"}}]}',
        'For a final answer only when no tool is needed, use: {"type":"final","content":"..."}',
      ]
        .filter(Boolean)
        .join("\n\n"),
      contextKind: "prompt",
    },
  ];
}

function requiresStrictToolProtocol(connection: WorkspaceConnection): boolean {
  return canFallbackToJsonToolProtocol(connection);
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

function normalizeCatalogProvider(provider: string): APIProvider | null {
  const normalized = provider.replace(/-/g, "_");
  return normalized in MODEL_LISTS ? (normalized as APIProvider) : null;
}

function resolveMariMaxOutputTokens(connection: WorkspaceConnection) {
  if (connection.maxTokensOverride && connection.maxTokensOverride > 0) {
    return Math.floor(connection.maxTokensOverride);
  }
  if (isLocalSidecarConnection(connection)) return sidecarModelService.getConfig().maxTokens;
  const provider = normalizeCatalogProvider(connection.provider);
  const knownModel = provider ? findKnownModel(provider, connection.model.trim()) : undefined;
  if (knownModel?.maxOutput && knownModel.maxOutput > 0) return Math.floor(knownModel.maxOutput);
  return 8192;
}

function isLengthFinishReason(reason: string | undefined | null) {
  const normalized = String(reason ?? "").toLowerCase();
  return normalized === "length" || normalized === "max_tokens" || normalized === "max_output_tokens";
}

function createPiModel(connection: WorkspaceConnection): Model<string> {
  const maxContext =
    Number.isFinite(connection.maxContext) && connection.maxContext > 0 ? connection.maxContext : 128000;
  const maxTokens = resolveMariMaxOutputTokens(connection);
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

function connectionSummary(connection: WorkspaceConnection | null): MariWorkspaceConnectionSummary | null {
  if (!connection) return null;
  return {
    id: connection.id,
    name: connection.name,
    provider: connection.provider,
    model: connection.model,
  };
}

function createProviderForConnection(connection: WorkspaceConnection): BaseLLMProvider {
  if (isLocalSidecarConnection(connection)) return getLocalSidecarProvider();
  return createLLMProvider(
    connection.provider,
    resolveBaseUrl(connection),
    connection.apiKey,
    connection.maxContext,
    connection.openrouterProvider,
    connection.maxTokensOverride,
    bool(connection.claudeFastMode),
  );
}

function connectionSessionKey(connection: WorkspaceConnection): string {
  if (!isLocalSidecarConnection(connection)) return connection.id;
  return [
    connection.id,
    sidecarModelService.getConfiguredModelRef() ?? "none",
    sidecarModelService.getResolvedBackend(),
    sidecarModelService.getConfig().contextSize,
    sidecarModelService.getConfig().maxTokens,
  ].join(":");
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
    const skillsResponse = await getProfessorMariWorkspaceSkillsService().list().catch((err) => {
      this.lastError = err instanceof Error ? err.message : String(err);
      return { skills: [], diagnostics: [this.lastError ?? "Professor Mari skills unavailable"] };
    });
    return {
      enabled: this.enabled,
      piAvailable: true,
      workspace: this.workspaceRoot,
      dataDir: DATA_DIR,
      tools: WORKSPACE_TOOLS,
      dbAccess: "server-managed",
      connection: connectionSummary(connection),
      skills: skillsResponse.skills.map(({ content: _content, ...summary }) => summary),
      skillDiagnostics: skillsResponse.diagnostics,
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
      } else if (event.type === "compaction_start") {
        const content =
          raw.reason === "manual"
            ? "Compacting workspace history..."
            : "Compacting older workspace history so Mari can keep going...";
        appendTraceStatus(workspaceTrace, content);
        args.onEvent({
          type: "status",
          data: { content, kind: "compaction_start", reason: typeof raw.reason === "string" ? raw.reason : undefined },
        });
      } else if (event.type === "compaction_end") {
        const error = typeof raw.errorMessage === "string" && raw.errorMessage.trim() ? raw.errorMessage.trim() : null;
        const aborted = raw.aborted === true;
        const content = error
          ? `History compaction failed: ${error}`
          : aborted
            ? "History compaction was cancelled."
            : "Older workspace history compacted.";
        appendTraceStatus(workspaceTrace, content);
        args.onEvent({
          type: "status",
          data: {
            content,
            kind: "compaction_end",
            level: error ? "error" : aborted ? "warning" : "info",
            reason: typeof raw.reason === "string" ? raw.reason : undefined,
          },
        });
      } else if (event.type === "auto_retry_start") {
        const content = `Retrying model call after a streaming error (${raw.attempt}/${raw.maxAttempts})...`;
        appendTraceStatus(workspaceTrace, content);
        args.onEvent({ type: "status", data: { content, kind: "retry", level: "warning" } });
      }
    });

    try {
      await session.prompt(args.text, { source: "rpc" });
      const lastAssistant = getLastAssistantMessage(session, messageCountBeforePrompt);
      const finalText = extractAssistantText(lastAssistant) || session.getLastAssistantText() || "";
      const finalThinking = extractAssistantThinking(lastAssistant);
      const finalError = extractAssistantError(lastAssistant);
      const finalStopReason = typeof lastAssistant?.stopReason === "string" ? lastAssistant.stopReason : null;
      if (isLengthFinishReason(finalStopReason)) {
        const content = "Mari hit the model output limit. Ask her to continue and she can pick up from here.";
        appendTraceStatus(workspaceTrace, content);
        args.onEvent({ type: "status", data: { content, kind: "output_limit", level: "warning" } });
      }

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

  private async ensureSession(connection: WorkspaceConnection): Promise<AgentSession> {
    const sessionKey = connectionSessionKey(connection);
    if (this.session && this.sessionConnectionId === sessionKey) return this.session;
    await this.disposeSession();
    const mariCliBinDir = await this.ensureMariCliShim();

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
    const skillResult = await getProfessorMariWorkspaceSkillsService().loadPiSkills();
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
      skillsOverride: () => skillResult,
      extensionFactories: [
        (pi: any) => {
          const bashTool = createBashTool(this.workspaceRoot, {
            spawnHook: ({ command, cwd, env }) => ({
              command,
              cwd,
              env: this.withMariRuntimeEnv({ ...env }, mariCliBinDir),
            }),
          });
          pi.registerTool({
            ...bashTool,
            execute: async (id: string, params: any, signal: AbortSignal, onUpdate: any) =>
              bashTool.execute(id, params, signal, onUpdate),
          });
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
    this.sessionConnectionId = sessionKey;
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
        const provider = createProviderForConnection(connection);
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
          maxTokens: resolveMariMaxOutputTokens(connection),
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
        const runJsonToolFallback = async (invalidNativeResponse?: string | null): Promise<ChatCompletionResult> => {
          if (!canFallbackToJsonToolProtocol(connection)) {
            throw new Error("JSON tool fallback is disabled for hosted Professor Mari connections.");
          }
          if (!tools?.length) {
            return provider.chatComplete(messages, { ...baseOptions, stream: true, onToken: pushTextDelta });
          }
          const responseFormats = buildJsonToolFallbackResponseFormats(connection, tools);
          const structuredCustomParameters = isLocalSidecarConnection(connection)
            ? mergeCustomParameters(baseOptions.customParameters, {
                reasoning_format: "none",
                chat_template_kwargs: { enable_thinking: false },
              })
            : baseOptions.customParameters;
          const callFallback = (
            fallbackMessages: ChatMessage[],
            responseFormat: ChatOptions["responseFormat"] | undefined,
          ) =>
            provider.chatComplete(fallbackMessages, {
              ...baseOptions,
              maxTokens: Math.min(resolveMariMaxOutputTokens(connection), 2048),
              temperature: 0,
              topP: 1,
              topK: 0,
              stream: false,
              responseFormat,
              customParameters: structuredCustomParameters,
            });
          const runAttempt = async (fallbackMessages: ChatMessage[]): Promise<ChatCompletionResult> => {
            let fallbackResult: ChatCompletionResult | null = null;
            let lastResponseFormatError: unknown = null;
            for (const responseFormat of responseFormats) {
              try {
                fallbackResult = await callFallback(fallbackMessages, responseFormat);
                break;
              } catch (err) {
                if (!responseFormat || !isResponseFormatUnsupportedError(err)) throw err;
                lastResponseFormatError = err;
              }
            }
            if (!fallbackResult) {
              if (lastResponseFormatError) throw lastResponseFormatError;
              fallbackResult = await callFallback(fallbackMessages, undefined);
            }
            return fallbackResult;
          };
          const parseFallbackResult = (fallbackResult: ChatCompletionResult): ChatCompletionResult | null => {
            const raw = fallbackResult.content?.trim() ?? "";
            const parsed = raw ? parseJsonToolProtocol(raw, tools) : null;
            if (parsed?.kind === "final") return { ...fallbackResult, content: parsed.content, toolCalls: [] };
            if (parsed?.kind === "tool_calls") {
              return { ...fallbackResult, content: null, toolCalls: parsed.calls, finishReason: "tool_calls" };
            }
            return null;
          };

          const firstMessages = invalidNativeResponse?.trim()
            ? buildJsonToolRepairMessages(messages, tools, invalidNativeResponse)
            : buildJsonToolFallbackMessages(messages, tools);
          const firstResult = await runAttempt(firstMessages);
          const parsedFirst = parseFallbackResult(firstResult);
          if (parsedFirst) return parsedFirst;

          const raw = firstResult.content?.trim() ?? "";
          if (raw) {
            const retryResult = await runAttempt(buildJsonToolRepairMessages(messages, tools, raw));
            const parsedRetry = parseFallbackResult(retryResult);
            if (parsedRetry) return parsedRetry;
          }

          if (requiresStrictToolProtocol(connection) || (raw && looksLikeToolProtocolText(raw))) {
            logger.warn(
              "[Professor Mari] Model did not return a valid tool protocol for provider=%s model=%s",
              connection.provider,
              connection.model,
            );
            return {
              ...firstResult,
              content:
                "The local model answered in normal prose instead of returning a private tool request, so I could not actually run the workspace step. Try again, or use a model/runtime with stronger JSON or tool-call support.",
              toolCalls: [],
              finishReason: "stop",
            };
          }
          return firstResult;
        };

        let result: ChatCompletionResult;
        if (providerSupportsNativeTools(connection, tools)) {
          const allowJsonFallback = canFallbackToJsonToolProtocol(connection);
          try {
            if (shouldUseGuardedNativeToolAttempt(connection)) {
              const nativeResult = await provider.chatComplete(messages, {
                ...baseOptions,
                stream: false,
                tools,
              });
              result = normalizeTextToolProtocolResult(nativeResult, tools ?? []) ?? nativeResult;
              if (allowJsonFallback && !result.toolCalls.length && shouldFallbackFromNativeText(messages, result.content)) {
                result = await runJsonToolFallback(result.content);
              }
            } else {
              result = await provider.chatComplete(messages, {
                ...baseOptions,
                stream: true,
                tools,
                onToken: pushTextDelta,
              });
            }
          } catch (err) {
            if (!tools?.length || sawTextDelta || !isNativeToolUnsupportedError(err) || !allowJsonFallback) throw err;
            logger.info(
              "[Professor Mari] Native tools unavailable for local provider=%s model=%s; falling back to JSON tool protocol",
              connection.provider,
              connection.model,
            );
            result = await runJsonToolFallback();
          }
        } else {
          result = await provider.chatComplete(messages, { ...baseOptions, stream: true, onToken: pushTextDelta });
        }

        if (result.content && !sawTextDelta) pushTextDelta(result.content);
        if (isLengthFinishReason(result.finishReason)) output.stopReason = "length";
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

  private buildLocalSidecarConnection(): WorkspaceConnection {
    const config = sidecarModelService.getConfig();
    const status = sidecarModelService.getStatus();
    return {
      id: LOCAL_SIDECAR_CONNECTION_ID,
      name: "Local Model (sidecar)",
      provider: "local_sidecar",
      model: status.modelDisplayName ?? LOCAL_SIDECAR_MODEL,
      baseUrl: "local-sidecar://runtime",
      apiKey: "local-sidecar",
      maxContext: config.contextSize,
      maxTokensOverride: config.maxTokens,
      defaultParameters: null,
      openrouterProvider: null,
      claudeFastMode: "false",
      enableCaching: "false",
      cachingAtDepth: 5,
      isLocalSidecar: true,
    };
  }

  private async resolveConnection(connectionId?: string | null): Promise<WorkspaceConnection | null> {
    if (connectionId === LOCAL_SIDECAR_CONNECTION_ID) {
      return this.buildLocalSidecarConnection();
    }

    const rows = (await this.app.db.select().from(apiConnections)) as Array<typeof apiConnections.$inferSelect>;
    const languageRows = rows.filter((row) => row.provider !== "image_generation");
    const selected = connectionId ? languageRows.find((row) => row.id === connectionId) : null;
    const fallback =
      selected ??
      languageRows.find((row) => bool(row.defaultForAgents)) ??
      languageRows.find((row) => bool(row.isDefault)) ??
      languageRows[0] ??
      null;
    if (!fallback) {
      return sidecarModelService.getConfiguredModelRef() ? this.buildLocalSidecarConnection() : null;
    }
    return { ...fallback, apiKey: decryptApiKey(fallback.apiKeyEncrypted) };
  }

  private withMariRuntimeEnv(env: NodeJS.ProcessEnv, mariCliBinDir: string) {
    env.MARI_WORKSPACE_SESSION_ID = SESSION_ID;
    env.MARI_SERVER_URL = `${getServerProtocol()}://127.0.0.1:${getPort()}`;
    env.DATA_DIR = DATA_DIR;
    return prependPathEntry(env, mariCliBinDir);
  }

  private async ensureMariCliShim() {
    const binDir = join(DATA_DIR, ".mari-workspace", "bin");
    await mkdir(binDir, { recursive: true });
    const posixCliPath = join(binDir, "mari");
    const cmdCliPath = join(binDir, "mari.cmd");
    const powershellCliPath = join(binDir, "mari.ps1");
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const distCli = join(packageRoot, "dist", "bin", "mari.js");
    const sourceCli = join(packageRoot, "src", "bin", "mari.ts");
    const posixScript = `#!/usr/bin/env sh
DIST_CLI=${shellQuote(distCli)}
SOURCE_CLI=${shellQuote(sourceCli)}
if [ -f "$DIST_CLI" ]; then
  exec node "$DIST_CLI" "$@"
fi
exec pnpm exec tsx "$SOURCE_CLI" "$@"
`;
    const cmdScript = `@echo off\r
setlocal\r
set "DIST_CLI=${distCli}"\r
set "SOURCE_CLI=${sourceCli}"\r
if exist "%DIST_CLI%" (\r
  node "%DIST_CLI%" %*\r
  exit /b %ERRORLEVEL%\r
)\r
pnpm exec tsx "%SOURCE_CLI%" %*\r
exit /b %ERRORLEVEL%\r
`;
    const powershellScript = `$DistCli = ${powershellQuote(distCli)}
$SourceCli = ${powershellQuote(sourceCli)}
if (Test-Path -LiteralPath $DistCli) {
  & node $DistCli @args
  exit $LASTEXITCODE
}
& pnpm exec tsx $SourceCli @args
exit $LASTEXITCODE
`;
    await Promise.all([
      writeFile(posixCliPath, posixScript, { mode: 0o755 }),
      writeFile(cmdCliPath, cmdScript, { mode: 0o755 }),
      writeFile(powershellCliPath, powershellScript, { mode: 0o755 }),
    ]);
    this.withMariRuntimeEnv(process.env, binDir);
    if (!existsSync(posixCliPath) || !existsSync(cmdCliPath) || !existsSync(powershellCliPath)) {
      logger.warn("[Professor Mari] failed to create one or more mari CLI shims at %s", binDir);
    }
    return binDir;
  }
}

let singleton: ProfessorMariWorkspaceService | null = null;
export function getProfessorMariWorkspaceService(app: FastifyInstance) {
  if (!singleton) singleton = new ProfessorMariWorkspaceService(app);
  return singleton;
}
