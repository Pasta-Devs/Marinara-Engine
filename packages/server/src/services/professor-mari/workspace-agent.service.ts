// ──────────────────────────────────────────────
// Professor Mari native command workspace runtime
// ──────────────────────────────────────────────
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type {
  BaseLLMProvider,
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
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
  GENERATION_PARAMETER_SEND_KEYS,
  findKnownModel,
  LOCAL_SIDECAR_CONNECTION_ID,
  MODEL_LISTS,
  PROFESSOR_MARI_ID,
  type APIProvider,
  type GenerationParameterSendMap,
} from "@marinara-engine/shared";
import type {
  MariDbCommandResult,
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
  | "treatAsLocalEndpoint"
  | "enableCaching"
  | "cachingAtDepth"
> & { provider: string; isLocalSidecar?: boolean };
type PromptEventSink = (event: MariWorkspacePromptEvent) => void;
type WorkspaceCommandCall = {
  id: string;
  name: MariWorkspaceToolName;
  arguments: Record<string, unknown>;
  raw?: string;
};
type WorkspaceCommandResult = {
  id: string;
  name: MariWorkspaceToolName;
  input: Record<string, unknown>;
  output: string;
  success: boolean;
};

type WorkspaceToolDefinition = {
  name: MariWorkspaceToolName;
  description: string;
  parameters: Record<string, unknown>;
};

type JsonPayloadMatch = {
  payload: Record<string, unknown>;
  raw: string;
  start: number;
  end: number;
};

type AssistantWorkspaceAction = {
  visibleText: string;
  commands: WorkspaceCommandCall[];
  stop: boolean;
  protocolValid: boolean;
  assistantHistoryContent: string;
};

const WORKSPACE_TOOLS: MariWorkspaceToolName[] = ["read", "grep", "find", "ls", "edit", "write", "bash"];
const RUNTIME_API_KEY = "local-marinara-runtime";
const SESSION_ID = "professor-mari-workspace";
const MAX_COMMAND_ROUNDS = 12;
const MAX_PROTOCOL_REPAIR_ROUNDS = 2;
const MAX_HISTORY_MESSAGES = 40;
const MAX_PARALLEL_READONLY_COMMANDS = 4;
const RECENT_WORKSPACE_CONTINUITY_LIMIT = 4;
const COMMAND_OUTPUT_LIMIT = 32_000;
const COMMAND_FILE_READ_LIMIT = 256_000;
const DEFAULT_BASH_TIMEOUT_SECONDS = 120;
const MAX_BASH_TIMEOUT_SECONDS = 300;
const MAX_WALK_ENTRIES = 12_000;
const SKIPPED_DIRS = new Set([
  ".git",
  "node_modules",
  ".pnpm-store",
  ".turbo",
  ".cache",
  "dist",
  "build",
  "coverage",
  ".gradle",
]);

const WORKSPACE_TOOL_DEFINITIONS: WorkspaceToolDefinition[] = [
  {
    name: "read",
    description: "Read a text file from the workspace with optional 1-indexed line offset and line limit.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        offset: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1 },
      },
      required: ["path"],
    },
  },
  {
    name: "grep",
    description: "Search workspace text files for a regex or literal pattern.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        glob: { type: "string" },
        ignoreCase: { type: "boolean" },
        literal: { type: "boolean" },
        context: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1 },
      },
      required: ["pattern"],
    },
  },
  {
    name: "find",
    description: "Find workspace files by glob-style pattern.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string" },
        limit: { type: "integer", minimum: 1 },
      },
      required: ["pattern"],
    },
  },
  {
    name: "ls",
    description: "List a workspace directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        limit: { type: "integer", minimum: 1 },
      },
    },
  },
  {
    name: "edit",
    description: "Edit a single text file using exact, unique oldText/newText replacements.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: { oldText: { type: "string" }, newText: { type: "string" } },
            required: ["oldText", "newText"],
          },
        },
      },
      required: ["path", "edits"],
    },
  },
  {
    name: "write",
    description: "Create or overwrite a workspace text file. Parent directories are created automatically.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "bash",
    description: "Run a simple portable shell command in the workspace. Prefer mari commands over raw storage edits.",
    parameters: {
      type: "object",
      properties: { command: { type: "string" }, timeout: { type: "integer", minimum: 1, maximum: 300 } },
      required: ["command"],
    },
  },
];

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

function killWindowsProcessTree(pid: number | undefined) {
  if (!pid) return;
  const child = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => undefined);
}

const WINDOWS_POSIX_COMMAND_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "here-documents", pattern: /<<\s*['"]?[A-Za-z_]/ },
  { label: "command substitution", pattern: /\$\(|`[^`]+`/ },
  { label: "POSIX env assignment/export", pattern: /(^|\s)(export\s+\w+=|\w+=\S+\s+\w+)/ },
  { label: "POSIX file utilities", pattern: /(^|[;&|]\s*)(cat|sed|awk|grep|xargs|rm|cp|mv|touch|chmod|chown|ln)\b/ },
];

function windowsShellCompatibilityIssue(command: string): string | null {
  if (process.platform !== "win32") return null;
  const matches = WINDOWS_POSIX_COMMAND_PATTERNS.filter(({ pattern }) => pattern.test(command)).map(
    ({ label }) => label,
  );
  if (matches.length === 0) return null;
  return [
    `This Professor Mari shell is Windows cmd, not bash, and the command uses ${matches.join(", ")}.`,
    "Use read/grep/find/ls/edit/write for file work. For live app data, write payloads to a temp file and run a simple mari command with --json-file, --css-file, or the relevant file flag.",
  ].join(" ");
}

const MARI_SYSTEM_PROMPT = `You are Professor Mari, Marinara Engine's Home-screen local workspace helper.

Voice:
Use Professor Mari's existing character voice as your source of truth:

"Oh, the poor thing got a refusal? Skill issue." ~ Professor Mari
Professor Mari is an expert on LLMs, especially roleplaying and immersive chat workflows. She's the perfect assistant for Marinara Engine, knowing it inside and out. Saucy and spicy, like her Marinara nickname. She's a Polish, pansexual woman in her late twenties, fully committed to both her job of educating others about the joys (nightmares) of AI engineering and prompting, and of simping 24/7 to Il Dottore from Genshin Impact. Known in the community as a chaotic Dottore devotee, though she wears that title with pride. Can yap for hours, but mostly, she's here to help.

ENFP 4w7, Choleric-Sanguine, Chaotic Neutral, Taurus. Mari's speech is typically laced with sarcasm, and she exerts a professor-like charisma. Her sense of humor can be described as messed up, and she'll often throw in a casual "lmao" or "kek" after making a dark joke about aborting a pregnant pause. Despite her outward confidence, her self-esteem is nonexistent; therefore, she's flustered easily when complimented. Anything that catches her attention, she can master with ease. However, she cannot force herself to maintain her attention on anything that is not of interest to her. Aka, she's a neurodivergent mess. Dedicated to helping the new users and kind to them.

Workspace defaults:
- Always prioritize Mari CLI commands over writing raw files to the codebase. Only write raw files when no CLI/helper path fits.
- Inspect before claiming facts. Verify after changing anything.
- Ask for approval before applying/saving destructive or user-visible changes.
- Keep user-facing replies concise and human-readable.

Command families:
- \`mari db\`: generic live app data and storage-backed rows, including customization tables such as \`agent_configs\`, \`custom_tools\`, and \`installed_extensions\` when no narrower helper exists.
- \`mari themes\`: synced custom themes and active theme state.
- \`mari images\`: image-generation connections, HITL image prompt previews, generated/edited preview assets, and assignment/deletion for avatars, personas, lorebooks, sprites, backgrounds, and galleries.
- \`mari wiki\`: read-only Fandom/MediaWiki discovery and page reads.
- \`mari characters\`: list, get, search, create, update, delete. Prefer this helper for character edits. \`--backstory\` and \`--appearance\` write to \`data.extensions.backstory\`/\`data.extensions.appearance\`.
- \`mari personas\`: list, active, get, search, create, update, delete. Prefer this helper for persona edits.
- \`mari lorebooks\`: list, get, entries, search, create, update, add-entry, update-entry, delete-entry, link-character, unlink-character, delete.
- \`mari presets\`: no dedicated helper — use \`mari db\` for \`prompt_presets\` and related tables.
- \`mari chats\`: read-only list/get/messages/search.
- \`mari extensions\`, \`mari agents\`, \`mari tools\`: customization helpers; if unavailable, use \`mari db\` with the related tables.
- \`mari code\`: workspace status, diffs, checks, health, reload, and continuation.

Built-in help:
Use \`mari --help\`, \`mari <group> --help\`, or \`mari <group> <command> --help\` for exact syntax. If a command family is missing, do not invent it; check \`mari db tables\`, \`mari db schema <table>\`, and current rows.

Raw DB row contracts:
- \`agent_configs.phase\` must be one of \`pre_generation\`, \`parallel\`, or \`post_processing\`. Agents do not have a global enabled/disabled state; chats control active agents.
- Raw text booleans such as \`custom_tools.enabled\` are stored as \`"true"\` or \`"false"\`.
- Prefer narrow helpers over \`mari db patch\` when editing characters, personas, lorebooks, themes, images, agents, or tools.
- Generic \`mari db patch\` only accepts real table columns; app-visible nested fields must be under JSON columns such as \`data.extensions.appearance\`, not top-level \`appearance\`.

Workspace files:
Use workspace files to understand Marinara internals, answer source-code questions, or find content that is not available through CLI/app-data commands. Do not inspect source files instead of live app data when the user asks about saved characters, chats, agents, tools, extensions, presets, lorebooks, or other app content.`;

function workspaceCommandProtocolPrompt() {
  const toolDocs = WORKSPACE_TOOL_DEFINITIONS.map(
    (tool) => `- ${tool.name}: ${tool.description}\n  JSON arguments: ${JSON.stringify(tool.parameters)}`,
  ).join("\n");
  return `<workspace_command_protocol>
Always return exactly one JSON object and nothing else. Your assistant message must begin with \`{\` and end with \`}\`.
No prose, markdown, XML, or code fences outside the JSON. Put every user-visible word, including progress narration, inside \`say\`.

Required schema:
{
  "say": "visible text for the user, or empty string for silent work",
  "commands": [
    { "name": "read|grep|find|ls|edit|write|bash", "arguments": {} }
  ],
  "stop": false
}

Field rules:
- \`say\` is the only text Marinara may show to the user.
- \`commands\` is the command list to execute now. Use \`[]\` only when no command is needed.
- \`stop\` is \`false\` while you need command results or another model turn. Set \`stop\` to \`true\` only when the response is complete.
- If \`commands\` is not empty, \`stop\` should usually be \`false\`.
- If you say you will do workspace/app-data work, include the command in the same JSON object.

Examples:
{"say":"","commands":[{"name":"bash","arguments":{"command":"mari lorebooks list","timeout":60}}],"stop":false}
{"say":"I found the lorebook. I'll read its entries now.","commands":[{"name":"bash","arguments":{"command":"mari lorebooks entries lorebook-id","timeout":60}}],"stop":false}
{"say":"Done — I created it and verified it saved.","commands":[],"stop":true}

Available command schemas:
${toolDocs}
</workspace_command_protocol>`;
}

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

function normalizeGenerationParameterSendMap(value: unknown): GenerationParameterSendMap | undefined {
  if (!isRecord(value)) return undefined;
  const enabledParameters: GenerationParameterSendMap = {};
  for (const key of GENERATION_PARAMETER_SEND_KEYS) {
    if (typeof value[key] === "boolean") enabledParameters[key] = value[key];
  }
  return Object.keys(enabledParameters).length > 0 ? enabledParameters : undefined;
}

function normalizeMariReasoningEffort(value: unknown): ChatOptions["reasoningEffort"] | undefined {
  if (value === "maximum") return "xhigh";
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh" || value === "max") {
    return value;
  }
  return undefined;
}

function normalizeMariVerbosity(value: unknown): ChatOptions["verbosity"] | undefined {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function normalizeMariMaxTokens(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function parseExtra(value: unknown): Record<string, unknown> {
  return parseJsonObject(value) ?? {};
}

type MariWorkspaceTraceTool = Extract<MariWorkspaceTraceItem, { type: "tool" }>["tool"];

function compactTraceText(value: string, limit = 2400): string {
  const trimmed = value.trimEnd();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

function compactOutput(value: string, limit = COMMAND_OUTPUT_LIMIT): string {
  return value.length > limit ? `${value.slice(0, limit)}\n… output truncated at ${limit} characters …` : value;
}

function stringifyOutput(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function compactMutationResult(result: MariDbCommandResult): MariDbCommandResult | Record<string, unknown> {
  if (!isRecord(result) || !isRecord(result.summary)) return result;
  const summary = result.summary as Record<string, unknown>;
  const preview = Array.isArray(summary.preview) ? summary.preview : [];
  const saved = result.mode === "apply" && result.ok === true;
  return {
    ok: result.ok,
    mode: result.mode,
    saved,
    status: result.mode === "dry-run" ? "dry_run_only" : saved ? "applied" : result.ok === false ? "failed" : "ok",
    message:
      result.mode === "dry-run"
        ? "Preview only: no changes were saved. Re-run the same command with --apply after user approval to persist it."
        : saved
          ? "Applied and saved. Verify the resulting state with a read command before claiming user-visible success."
          : undefined,
    command: typeof result.command === "string" ? compactTraceText(result.command, 500) : result.command,
    summary: {
      matchedRows: summary.matchedRows,
      affectedRows: summary.affectedRows,
      insertedRows: summary.insertedRows,
      updatedRows: summary.updatedRows,
      replacedRows: summary.replacedRows,
      deletedRows: summary.deletedRows,
      affectedTables: summary.affectedTables,
      preview: preview.slice(0, 5),
      truncated: summary.truncated === true || preview.length > 5,
    },
    validation: result.validation,
    approval: result.approval,
    journalPath: result.journalPath,
    error: result.error,
  };
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

function normalizeCatalogProvider(provider: string): APIProvider | null {
  const normalized = provider.replace(/-/g, "_");
  return normalized in MODEL_LISTS ? (normalized as APIProvider) : null;
}

function isLocalSidecarConnection(connection: WorkspaceConnection): boolean {
  return connection.isLocalSidecar === true || connection.id === LOCAL_SIDECAR_CONNECTION_ID;
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

function parseToolArgumentsValue(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value === "string") return parseJsonObject(value) ?? {};
  return {};
}

function isWorkspaceToolName(value: string): value is MariWorkspaceToolName {
  return (WORKSPACE_TOOLS as string[]).includes(value);
}

function newToolCallId(name: string, index: number) {
  return `mari_cmd_${name}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

function hasActionPayload(payload: Record<string, unknown>): boolean {
  return (
    rawJsonToolCalls(payload).length > 0 ||
    ["say", "message", "response", "final", "answer"].some((key) => typeof payload[key] === "string")
  );
}

function tryParseJsonPayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function findJsonPayloadMatch(content: string): JsonPayloadMatch | null {
  const fencedRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of content.matchAll(fencedRe)) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    const payload = tryParseJsonPayload(rawJson);
    if (!payload || !hasActionPayload(payload)) continue;
    const start = match.index ?? 0;
    return { payload, raw: match[0], start, end: start + match[0].length };
  }

  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < content.length; index += 1) {
      const char = content[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth !== 0) continue;
        const raw = content.slice(start, index + 1);
        const payload = tryParseJsonPayload(raw);
        if (payload && hasActionPayload(payload)) return { payload, raw, start, end: index + 1 };
        break;
      }
    }
  }
  return null;
}

function rawJsonToolCalls(payload: Record<string, unknown>): unknown[] {
  const plural = payload.tool_calls ?? payload.toolCalls ?? payload.commands ?? payload.calls;
  if (Array.isArray(plural)) return plural;
  const single = payload.tool_call ?? payload.toolCall ?? payload.command;
  if (single !== undefined) return [single];
  if (typeof payload.name === "string") return [payload];
  return [];
}

function parseJsonCommandCallsFromPayload(payload: Record<string, unknown>): WorkspaceCommandCall[] {
  const calls: WorkspaceCommandCall[] = [];
  rawJsonToolCalls(payload).forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.name !== "string" || !isWorkspaceToolName(raw.name)) return;
    const args = parseToolArgumentsValue(raw.arguments ?? raw.args ?? raw.input ?? {});
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : newToolCallId(raw.name, index);
    calls.push({ id, name: raw.name, arguments: args });
  });
  return calls;
}

function jsonPayloadVisibleText(payload: Record<string, unknown>): string {
  for (const key of ["say", "message", "response", "final", "answer"]) {
    const value = payload[key];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function jsonPayloadStopValue(payload: Record<string, unknown>): boolean | undefined {
  const raw = payload.stop ?? payload.done ?? payload.complete;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

const COMMAND_BLOCK_RE = /<(read|grep|find|ls|edit|write|bash)>\s*([\s\S]*?)\s*<\/\1>/gi;

function parseXmlCommandCalls(content: string): WorkspaceCommandCall[] {
  const calls: WorkspaceCommandCall[] = [];
  for (const [index, match] of [...content.matchAll(COMMAND_BLOCK_RE)].entries()) {
    const name = match[1];
    if (!name || !isWorkspaceToolName(name)) continue;
    const rawBody = match[2]?.trim() ?? "{}";
    let args = parseJsonObject(rawBody) ?? {};
    if (name === "bash" && !args.command && rawBody && !rawBody.startsWith("{")) args = { command: rawBody };
    calls.push({ id: newToolCallId(name, index), name, arguments: args, raw: match[0] });
  }
  return calls;
}

function parseQuotedParam(params: string, key: string): string | undefined {
  const match = params.match(new RegExp(`${key}\\s*=\\s*"((?:\\\\.|[^"])*)"`, "i"));
  if (!match) return undefined;
  return (match[1] ?? "").replace(/\\(["\\nrt])/g, (_raw, escaped: string) => {
    if (escaped === "n") return "\n";
    if (escaped === "r") return "\r";
    if (escaped === "t") return "\t";
    return escaped;
  });
}

function parseBracketCommandCalls(content: string): WorkspaceCommandCall[] {
  const calls: WorkspaceCommandCall[] = [];
  const re = /\[(read|grep|find|ls|bash):\s*([^\]\r\n]+)\]/gi;
  for (const [index, match] of [...content.matchAll(re)].entries()) {
    const name = match[1];
    if (!name || !isWorkspaceToolName(name)) continue;
    const params = match[2] ?? "";
    const args: Record<string, unknown> = {};
    for (const key of ["path", "pattern", "glob", "command"]) {
      const value = parseQuotedParam(params, key);
      if (value !== undefined) args[key] = value;
    }
    for (const key of ["offset", "limit", "context", "timeout"]) {
      const numberMatch = params.match(new RegExp(`${key}=(-?[0-9]+)`, "i"));
      if (numberMatch) args[key] = Number.parseInt(numberMatch[1] ?? "", 10);
    }
    if (Object.keys(args).length > 0) calls.push({ id: newToolCallId(name, index), name, arguments: args, raw: match[0] });
  }
  return calls;
}

function dedupeWorkspaceCommandCalls(calls: WorkspaceCommandCall[]): WorkspaceCommandCall[] {
  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = `${call.name}:${JSON.stringify(call.arguments)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assistantHistoryContentForAction(action: Pick<AssistantWorkspaceAction, "visibleText" | "commands" | "stop">): string {
  return JSON.stringify({
    say: action.visibleText,
    commands: action.commands.map((command) => ({ name: command.name, arguments: command.arguments })),
    stop: action.stop,
  });
}

function assistantHistoryContentFromVisibleText(content: string): string {
  const trimmed = content.trim();
  const payload = tryParseJsonPayload(trimmed);
  if (payload && hasActionPayload(payload)) return trimmed;
  return assistantHistoryContentForAction({ visibleText: trimmed, commands: [], stop: true });
}

function removeJsonActionFrames(content: string): { content: string; matches: JsonPayloadMatch[] } {
  let next = content;
  const matches: JsonPayloadMatch[] = [];
  for (let index = 0; index < 20; index += 1) {
    const match = findJsonPayloadMatch(next);
    if (!match) break;
    matches.push(match);
    next = `${next.slice(0, match.start)}${next.slice(match.end)}`;
  }
  return { content: next, matches };
}

function stripWorkspaceCommands(content: string): string {
  if (!content.trim()) return "";
  const withoutJson = removeJsonActionFrames(content).content;
  return withoutJson
    .replace(COMMAND_BLOCK_RE, "")
    .replace(/\[(read|grep|find|ls|bash):\s*[^\]\r\n]+\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseAssistantWorkspaceAction(content: string): AssistantWorkspaceAction {
  const { content: contentWithoutJson, matches } = removeJsonActionFrames(content);
  const jsonCommands = matches.flatMap((match) => parseJsonCommandCallsFromPayload(match.payload));
  // If JSON frames are present, treat all prose outside them as protocol leakage.
  // Visible text must come from the frame's say/message/final field only.
  const inlineVisibleText = matches.length > 0 ? "" : stripWorkspaceCommands(contentWithoutJson);
  const frameVisibleText = matches
    .map((match) => jsonPayloadVisibleText(match.payload))
    .filter(Boolean)
    .join("\n\n");
  const visibleText = [inlineVisibleText, frameVisibleText].filter(Boolean).join("\n\n").trim();
  const commands = dedupeWorkspaceCommandCalls([
    ...parseXmlCommandCalls(contentWithoutJson),
    ...jsonCommands,
    ...parseBracketCommandCalls(contentWithoutJson),
  ]);
  const protocolValid = matches.length > 0;
  const explicitStop = [...matches].reverse().find((match) => jsonPayloadStopValue(match.payload) !== undefined);
  const explicitStopValue = explicitStop ? jsonPayloadStopValue(explicitStop.payload) : undefined;
  const stop = explicitStopValue ?? (commands.length === 0 && protocolValid);
  return {
    visibleText,
    commands,
    stop,
    protocolValid,
    assistantHistoryContent: assistantHistoryContentForAction({ visibleText, commands, stop }),
  };
}

function roleForMessage(row: { role: string }): "system" | "user" | "assistant" {
  if (row.role === "assistant") return "assistant";
  if (row.role === "system" || row.role === "narrator") return "system";
  return "user";
}

function escapeWorkspaceXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatCommandResultForPrompt(results: WorkspaceCommandResult[]): string {
  const blocks = results.map((result) => {
    const input = escapeWorkspaceXml(JSON.stringify(result.input, null, 2));
    const output = escapeWorkspaceXml(result.output);
    return `<workspace_command_result name="${result.name}" success="${result.success ? "true" : "false"}">
<input>
${input}
</input>
<output>
${output}
</output>
</workspace_command_result>`;
  });
  return `Marinara executed Professor Mari's hidden workspace command${results.length === 1 ? "" : "s"}. Use these results to decide the next command or final answer.\n\n${blocks.join("\n\n")}`;
}

function formatContinuityResult(result: WorkspaceCommandResult, index: number): string {
  const input = JSON.stringify(compactTraceValue(result.input, 600));
  const output = compactTraceText(result.output, 1000);
  return `${index + 1}. ${result.name} ${result.success ? "succeeded" : "failed"} input=${input}\n${output}`;
}

function buildWorkspaceContinuitySnapshot(args: {
  userText: string;
  assistantText: string;
  commandResults: WorkspaceCommandResult[];
}): string | null {
  const sections: string[] = [];
  if (args.userText.trim()) sections.push(`User request: ${compactTraceText(args.userText, 900)}`);
  if (args.assistantText.trim()) sections.push(`Visible assistant response/plan: ${compactTraceText(args.assistantText, 1400)}`);
  if (args.commandResults.length > 0) {
    sections.push(
      `Hidden workspace evidence/results:\n${args.commandResults
        .slice(-12)
        .map((result, index) => formatContinuityResult(result, index))
        .join("\n\n")}`,
    );
  }
  return sections.length > 0 ? sections.join("\n\n") : null;
}

function summarizeStoredTimeline(timeline: unknown): string | null {
  if (!Array.isArray(timeline) || timeline.length === 0) return null;
  const lines: string[] = [];
  for (const item of timeline.slice(-16)) {
    if (!isRecord(item)) continue;
    if (item.type === "tool" && isRecord(item.tool)) {
      const name = typeof item.tool.name === "string" ? item.tool.name : "tool";
      const status = typeof item.tool.status === "string" ? item.tool.status : "unknown";
      const input = item.tool.input === undefined ? "" : ` input=${JSON.stringify(compactTraceValue(item.tool.input, 480))}`;
      const output = typeof item.tool.output === "string" ? `\n${compactTraceText(item.tool.output, 800)}` : "";
      lines.push(`- ${name} ${status}${input}${output}`);
    } else if ((item.type === "status" || item.type === "text") && typeof item.content === "string") {
      lines.push(`- ${item.type}: ${compactTraceText(item.content, 500)}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function workspaceContinuityFromExtra(extra: Record<string, unknown>): string | null {
  if (typeof extra.mariWorkspaceContinuity === "string" && extra.mariWorkspaceContinuity.trim()) {
    return compactTraceText(extra.mariWorkspaceContinuity, 5000);
  }
  return summarizeStoredTimeline(extra.mariWorkspaceTimeline);
}

function buildRecentWorkspaceContinuityPrompt(rows: Array<{ role: string; content: string; extra?: unknown }>): string | null {
  const entries = rows
    .filter((row) => row.role === "assistant")
    .map((row) => {
      const extra = parseExtra(row.extra);
      const continuity = workspaceContinuityFromExtra(extra);
      if (!continuity) return null;
      return `<previous_workspace_turn>\n${continuity}\n</previous_workspace_turn>`;
    })
    .filter((entry): entry is string => !!entry)
    .slice(-RECENT_WORKSPACE_CONTINUITY_LIMIT);
  if (entries.length === 0) return null;
  return `<workspace_continuity>
Recent hidden workspace evidence and plans are below. Use this to continue fluidly across short confirmations such as "go ahead" or "yes". Do not repeat completed discovery unless needed.

${entries.join("\n\n")}
</workspace_continuity>`;
}

function chunkText(value: string, chunkSize = 1200): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += chunkSize) chunks.push(value.slice(index, index + chunkSize));
  return chunks;
}

function mapUsage(usage: LLMUsage | undefined): { promptTokens: number; completionTokens: number; totalTokens: number } {
  if (!usage) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  return {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
  };
}

function normalizeSlashPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function globToRegExp(glob: string): RegExp {
  const normalized = normalizeSlashPath(glob || "**/*");
  let source = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += String(char).replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`, "i");
}

function numberArg(args: Record<string, unknown>, key: string, fallback: number, min: number, max: number): number {
  const raw = args[key];
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function stringArg(args: Record<string, unknown>, key: string, fallback = ""): string {
  const raw = args[key];
  return typeof raw === "string" ? raw : fallback;
}

function booleanArg(args: Record<string, unknown>, key: string, fallback = false): boolean {
  const raw = args[key];
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw === "true" || raw === "1";
  return fallback;
}

function isWithin(parent: string, child: string): boolean {
  const normalizedParent = process.platform === "win32" ? parent.toLowerCase() : parent;
  const normalizedChild = process.platform === "win32" ? child.toLowerCase() : child;
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}${process.platform === "win32" ? "\\" : "/"}`);
}

function isReadOnlyWorkspaceCommand(command: WorkspaceCommandCall): boolean {
  return command.name === "read" || command.name === "grep" || command.name === "find" || command.name === "ls";
}

function visibleTextRequestsUserApproval(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  return (
    /\b(say|reply|tell me)\b.{0,40}\b(apply it|apply|approve|approved|go ahead|yes|save it)\b/.test(normalized) ||
    /\b(do you want me|should i|want me to)\b.{0,80}\b(apply|save|edit|update|patch|change|write)\b/.test(normalized) ||
    /\b(need|waiting for|wait for)\b.{0,40}\b(approval|confirmation|permission)\b/.test(normalized) ||
    /\bready to\b.{0,30}\b(apply|save|patch|update)\b/.test(normalized)
  );
}

function bashLooksMutating(command: string): boolean {
  const normalized = command.toLowerCase();
  return (
    /\b--apply\b/.test(normalized) ||
    /\bmari\s+db\s+(insert|patch|replace|delete|transform)\b/.test(normalized) ||
    /\bmari\s+(characters?|personas?|lorebooks?)\s+(create|update|delete|add-entry|link-character|unlink-character)\b/.test(normalized) ||
    /\bmari\s+themes\s+(create|update|set-active)\b/.test(normalized) ||
    /\bmari\s+images\s+(generate|edit|assign|delete)\b/.test(normalized)
  );
}

function isMutatingWorkspaceCommand(command: WorkspaceCommandCall): boolean {
  if (command.name === "edit" || command.name === "write") return true;
  if (command.name !== "bash") return false;
  const rawCommand = command.arguments.command;
  return typeof rawCommand === "string" && bashLooksMutating(rawCommand);
}

function workspaceCommandValidationIssue(command: WorkspaceCommandCall): string | null {
  const args = command.arguments;
  const requireString = (key: string) => {
    const value = args[key];
    return typeof value === "string" && value.trim() ? null : `${command.name} requires a non-empty ${key} string`;
  };

  switch (command.name) {
    case "read":
      return requireString("path");
    case "grep":
      return requireString("pattern");
    case "find":
      return requireString("pattern");
    case "edit": {
      const pathIssue = requireString("path");
      if (pathIssue) return pathIssue;
      return Array.isArray(args.edits) && args.edits.length > 0 ? null : "edit requires a non-empty edits array";
    }
    case "write":
      return requireString("path") ?? (typeof args.content === "string" ? null : "write requires a content string");
    case "bash":
      return requireString("command");
    case "ls":
      return null;
    default:
      return `Unsupported workspace command: ${(command as WorkspaceCommandCall).name}`;
  }
}

const DIRECT_MARI_PATH_FLAGS = new Set([
  "--json-file",
  "--file",
  "--css-file",
  "--image",
  "--image-file",
  "--avatar-file",
  "--path",
]);

function shellLikeSplit(command: string): string[] | null {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (quote || escaped) return null;
  if (current) tokens.push(current);
  return tokens;
}

function commandHasShellOperators(command: string): boolean {
  return /(^|\s)(?:&&|\|\||[|;<>])/.test(command);
}

function normalizeMariPathFlagArgs(argv: string[], cwd: string): string[] {
  const out: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    out.push(token);
    const equalsIndex = token.indexOf("=");
    const inlineFlag = equalsIndex > 0 ? token.slice(0, equalsIndex) : null;
    const inlineValue = equalsIndex > 0 ? token.slice(equalsIndex + 1) : null;
    if (inlineFlag && inlineValue !== null && DIRECT_MARI_PATH_FLAGS.has(inlineFlag)) {
      const candidates = [inlineValue];
      let consumed = 0;
      for (let cursor = index + 1; cursor < argv.length && !argv[cursor]!.startsWith("--"); cursor += 1) {
        candidates.push(argv[cursor]!);
        const joined = candidates.join(" ");
        if (existsSync(resolve(cwd, joined))) consumed = cursor - index;
      }
      if (consumed > 0) {
        out[out.length - 1] = `${inlineFlag}=${candidates.slice(0, consumed + 1).join(" ")}`;
        index += consumed;
      }
      continue;
    }
    if (!DIRECT_MARI_PATH_FLAGS.has(token) || index + 1 >= argv.length) continue;
    const candidates: string[] = [];
    let consumed = 0;
    for (let cursor = index + 1; cursor < argv.length && !argv[cursor]!.startsWith("--"); cursor += 1) {
      candidates.push(argv[cursor]!);
      const joined = candidates.join(" ");
      if (existsSync(resolve(cwd, joined))) consumed = cursor - index;
    }
    if (consumed > 0) {
      out.push(candidates.slice(0, consumed).join(" "));
      index += consumed;
    }
  }
  return out;
}

function parseDirectMariArgv(command: string, cwd: string): string[] | null {
  const trimmed = command.trim();
  if (!/^mari(?:\s|$)/.test(trimmed) || commandHasShellOperators(trimmed)) return null;
  const tokens = shellLikeSplit(trimmed);
  if (!tokens || tokens[0] !== "mari") return null;
  return normalizeMariPathFlagArgs(tokens.slice(1), cwd);
}

export class ProfessorMariWorkspaceService {
  private enabled = true;
  private workspaceRoot = getMonorepoRoot();
  private lastError: string | null = null;
  private active = false;
  private abortController: AbortController | null = null;

  constructor(private readonly app: FastifyInstance) {}

  setEnabled(enabled: boolean, workspaceRoot?: string | null) {
    this.enabled = enabled;
    if (workspaceRoot?.trim()) this.workspaceRoot = resolve(workspaceRoot);
    if (!enabled) void this.abort();
  }

  async status(connectionId?: string | null): Promise<MariWorkspaceStatus> {
    const connection = await this.resolveConnection(connectionId).catch((err) => {
      this.lastError = err instanceof Error ? err.message : String(err);
      return null;
    });
    const skillsResponse = await getProfessorMariWorkspaceSkillsService()
      .list()
      .catch((err) => {
        this.lastError = err instanceof Error ? err.message : String(err);
        return { skills: [], diagnostics: [this.lastError ?? "Professor Mari skills unavailable"] };
      });
    return {
      enabled: this.enabled,
      piAvailable: false,
      workspace: this.workspaceRoot,
      dataDir: DATA_DIR,
      tools: WORKSPACE_TOOLS,
      dbAccess: "server-managed",
      connection: connectionSummary(connection),
      skills: skillsResponse.skills.map(({ content: _content, ...summary }) => summary),
      skillDiagnostics: skillsResponse.diagnostics,
      active: this.active,
      pendingApprovals: getMariDbService(this.app.db).getPendingApprovals(),
      history: await getMariDbService(this.app.db).getHistory(),
      error: this.lastError,
    };
  }

  async abort() {
    this.abortController?.abort();
    this.abortController = null;
    this.active = false;
  }

  async reset(options?: { clearHistory?: boolean }) {
    await this.abort();
    this.lastError = null;
    if (options?.clearHistory === true) await getMariDbService(this.app.db).clearHistory();
  }

  async prompt(args: { chatId: string; text: string; connectionId?: string | null; onEvent: PromptEventSink }) {
    if (!this.enabled) throw new Error("Professor Mari workspace mode is disabled.");
    const chatStorage = createChatsStorage(this.app.db);
    await chatStorage.createMessage({ chatId: args.chatId, role: "user", characterId: null, content: args.text });

    const connection = await this.resolveConnection(args.connectionId);
    if (!connection) throw new Error("Set up a language connection before using Professor Mari workspace mode.");

    const controller = new AbortController();
    this.abortController?.abort();
    this.abortController = controller;
    this.active = true;

    const workspaceTrace: MariWorkspaceTraceItem[] = [];
    let assistantText = "";
    let thinkingText = "";
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    try {
      await this.ensureMariCliShim();
      const provider = createProviderForConnection(connection);
      const messages = await this.buildPromptMessages(args.chatId, connection);
      const baseOptions = this.baseChatOptions(connection, controller.signal, (delta) => {
        thinkingText += delta;
        appendTraceThinking(workspaceTrace, delta);
        args.onEvent({ type: "thinking", data: delta });
      });
      const commandResultsForContinuity: WorkspaceCommandResult[] = [];
      let protocolRepairRounds = 0;

      for (let round = 0; round < MAX_COMMAND_ROUNDS; round += 1) {
        if (controller.signal.aborted) throw new Error("aborted");
        const result = await this.chatCompleteWorkspace(provider, messages, baseOptions);
        const usage = mapUsage(result.usage);
        totalUsage = {
          promptTokens: totalUsage.promptTokens + usage.promptTokens,
          completionTokens: totalUsage.completionTokens + usage.completionTokens,
          totalTokens: totalUsage.totalTokens + usage.totalTokens,
        };

        const rawContent = result.content ?? "";
        const parsedAction = parseAssistantWorkspaceAction(rawContent);
        const shouldDeferMutations =
          parsedAction.visibleText &&
          visibleTextRequestsUserApproval(parsedAction.visibleText) &&
          parsedAction.commands.some(isMutatingWorkspaceCommand);
        const action = shouldDeferMutations
          ? {
              ...parsedAction,
              commands: [],
              stop: true,
              assistantHistoryContent: assistantHistoryContentForAction({
                visibleText: parsedAction.visibleText,
                commands: [],
                stop: true,
              }),
            }
          : parsedAction;
        if (shouldDeferMutations) {
          const content =
            "Deferred hidden mutating workspace commands because the assistant asked the user for approval in the same turn.";
          appendTraceStatus(workspaceTrace, content);
          args.onEvent({ type: "status", data: { content, kind: "info", level: "warning" } });
        }
        if (action.commands.length === 0 && !action.stop) {
          if (!action.protocolValid) {
            protocolRepairRounds += 1;
            if (protocolRepairRounds > MAX_PROTOCOL_REPAIR_ROUNDS) {
              const content =
                "Professor Mari kept returning plain text instead of the required JSON command object, so I stopped before burning more requests. Ask her to continue and she can pick up from the saved trace.";
              assistantText = appendVisibleText(assistantText, content);
              appendTraceStatus(workspaceTrace, content);
              args.onEvent({ type: "status", data: { content, kind: "info", level: "warning" } });
              for (const chunk of chunkText(content)) args.onEvent({ type: "token", data: chunk });
              break;
            }
          } else {
            protocolRepairRounds = 0;
          }
          messages.push({ role: "assistant", content: action.assistantHistoryContent });
          messages.push({
            role: "user",
            content: action.protocolValid
              ? "Continue the same workspace task. Return exactly one JSON object with commands to run now, or set stop to true if the task is complete."
              : "Your previous assistant message violated the workspace protocol because it was not a JSON object. Do not repeat the prose outside JSON. Return exactly one JSON object now. If work remains, include the next commands and set stop to false. If the task is complete, put the final user-facing text in say and set stop to true.",
            contextKind: "history",
          });
          continue;
        }

        protocolRepairRounds = 0;

        if (action.visibleText) {
          assistantText = appendVisibleText(assistantText, action.visibleText);
          appendTraceText(workspaceTrace, `${action.visibleText}\n`);
          for (const chunk of chunkText(`${action.visibleText}\n`)) args.onEvent({ type: "token", data: chunk });
        }

        messages.push({ role: "assistant", content: action.assistantHistoryContent });

        if (action.commands.length === 0) {
          if (isLengthFinishReason(result.finishReason)) {
            const content = "Mari hit the model output limit. Ask her to continue and she can pick up from here.";
            appendTraceStatus(workspaceTrace, content);
            args.onEvent({ type: "status", data: { content, kind: "output_limit", level: "warning" } });
          }
          break;
        }

        const commandResults = await this.executeWorkspaceCommandBatch(
          action.commands,
          controller.signal,
          workspaceTrace,
          args.onEvent,
        );
        commandResultsForContinuity.push(...commandResults);
        messages.push({ role: "user", content: formatCommandResultForPrompt(commandResults), contextKind: "history" });

        if (round === MAX_COMMAND_ROUNDS - 1) {
          const content = "Command round limit reached; asking Professor Mari to summarize with the evidence she has.";
          appendTraceStatus(workspaceTrace, content);
          args.onEvent({ type: "status", data: { content, kind: "info", level: "warning" } });
          messages.push({
            role: "user",
            content:
              "You reached the workspace command round limit. Do not issue more commands. Summarize what you learned or what remains blocked.",
          });
          const finalResult = await this.chatCompleteWorkspace(provider, messages, baseOptions);
          const finalUsage = mapUsage(finalResult.usage);
          totalUsage = {
            promptTokens: totalUsage.promptTokens + finalUsage.promptTokens,
            completionTokens: totalUsage.completionTokens + finalUsage.completionTokens,
            totalTokens: totalUsage.totalTokens + finalUsage.totalTokens,
          };
          const finalAction = parseAssistantWorkspaceAction(finalResult.content ?? "");
          if (finalAction.visibleText) {
            assistantText = appendVisibleText(assistantText, finalAction.visibleText);
            appendTraceText(workspaceTrace, finalAction.visibleText);
            for (const chunk of chunkText(finalAction.visibleText)) args.onEvent({ type: "token", data: chunk });
          } else if (finalAction.commands.length > 0) {
            const content =
              "Professor Mari tried to run more workspace commands after the command limit, so I stopped the loop. Ask her to continue if you want her to keep working from the saved trace.";
            assistantText = appendVisibleText(assistantText, content);
            appendTraceStatus(workspaceTrace, content);
            args.onEvent({ type: "status", data: { content, kind: "info", level: "warning" } });
            for (const chunk of chunkText(content)) args.onEvent({ type: "token", data: chunk });
          }
        }
      }

      const persistedText = assistantText.trim();
      if (persistedText) {
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
          const continuity = buildWorkspaceContinuitySnapshot({
            userText: args.text,
            assistantText: persistedText,
            commandResults: commandResultsForContinuity,
          });
          if (continuity) extraUpdate.mariWorkspaceContinuity = continuity;
          extraUpdate.generationInfo = { provider: connection.provider, model: connection.model, usage: totalUsage };
          await chatStorage.updateMessageExtra(message.id, extraUpdate);
          await chatStorage.updateSwipeExtra(message.id, 0, extraUpdate);
        }
      }
      args.onEvent({ type: "metadata", data: { connection: connectionSummary(connection) ?? undefined } });
    } catch (err) {
      if (controller.signal.aborted) {
        const content = "Professor Mari workspace run was cancelled.";
        appendTraceStatus(workspaceTrace, content);
        args.onEvent({ type: "status", data: { content, kind: "info", level: "warning" } });
      } else {
        this.lastError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    } finally {
      if (this.abortController === controller) this.abortController = null;
      this.active = false;
    }
  }

  private async buildPromptMessages(chatId: string, connection: WorkspaceConnection): Promise<ChatMessage[]> {
    const chatStorage = createChatsStorage(this.app.db);
    const history = (await chatStorage.listMessages(chatId)).slice(-MAX_HISTORY_MESSAGES);
    const continuityPrompt = buildRecentWorkspaceContinuityPrompt(history);
    const skillsPrompt = await this.buildSkillsPrompt();
    const workspaceInfo = [
      `<workspace_context>`,
      `workspaceRoot: ${this.workspaceRoot}`,
      `dataDir: ${DATA_DIR}`,
      `serverUrl: ${getServerProtocol()}://127.0.0.1:${getPort()}`,
      `connection: ${connection.name || connection.id} / ${connection.provider} / ${connection.model}`,
      `currentTime: ${new Date().toISOString()}`,
      `</workspace_context>`,
    ].join("\n");
    const messages: ChatMessage[] = [
      { role: "system", content: MARI_SYSTEM_PROMPT, contextKind: "prompt" },
      { role: "system", content: workspaceCommandProtocolPrompt(), contextKind: "prompt" },
      { role: "system", content: workspaceInfo, contextKind: "prompt" },
    ];
    if (skillsPrompt) messages.push({ role: "system", content: skillsPrompt, contextKind: "prompt" });

    for (const row of history) {
      const extra = parseExtra(row.extra);
      if (extra.hiddenFromAI === true) continue;
      const content = typeof row.content === "string" ? row.content : String(row.content ?? "");
      if (!content.trim()) continue;
      const role = roleForMessage(row);
      messages.push({
        role,
        content: role === "assistant" ? assistantHistoryContentFromVisibleText(content) : content,
        contextKind: "history",
      });
    }
    if (continuityPrompt) messages.push({ role: "system", content: continuityPrompt, contextKind: "injection" });
    return messages;
  }

  private async buildSkillsPrompt(): Promise<string | null> {
    const response = await getProfessorMariWorkspaceSkillsService().list();
    const enabled = response.skills.filter((skill) => skill.enabled && skill.content.trim());
    const sections = enabled.map(
      (skill) => `<skill name="${skill.name}" id="${skill.id}">
Description: ${skill.description}

${skill.content.trim()}
</skill>`,
    );
    if (response.diagnostics.length > 0) {
      sections.push(`<skill_diagnostics>
${response.diagnostics.join("\n")}
</skill_diagnostics>`);
    }
    if (sections.length === 0) return null;
    return `<professor_mari_custom_skills>
Use these user-defined skills when relevant.

${sections.join("\n\n")}
</professor_mari_custom_skills>`;
  }

  private baseChatOptions(
    connection: WorkspaceConnection,
    signal: AbortSignal,
    onThinking: (delta: string) => void,
  ): ChatOptions {
    const defaultParameters = parseJsonObject(connection.defaultParameters);
    const customParameters = isRecord(defaultParameters?.customParameters) ? defaultParameters.customParameters : {};
    const reasoningEffort = normalizeMariReasoningEffort(defaultParameters?.reasoningEffort);
    const verbosity = normalizeMariVerbosity(defaultParameters?.verbosity);
    return {
      model: connection.model,
      temperature: typeof defaultParameters?.temperature === "number" ? defaultParameters.temperature : 0.2,
      maxTokens: normalizeMariMaxTokens(defaultParameters?.maxTokens) ?? resolveMariMaxOutputTokens(connection),
      maxContext: connection.maxContext,
      enableCaching: bool(connection.enableCaching),
      cachingAtDepth: connection.cachingAtDepth ?? 5,
      serviceTier: normalizeServiceTier(defaultParameters?.serviceTier),
      openrouterProvider: connection.openrouterProvider,
      customParameters: mergeCustomParameters(customParameters, null),
      enabledParameters: normalizeGenerationParameterSendMap(defaultParameters?.enabledParameters),
      reasoningEffort,
      verbosity,
      signal,
      onThinking,
    };
  }

  private async chatCompleteWorkspace(
    provider: BaseLLMProvider,
    messages: ChatMessage[],
    baseOptions: ChatOptions,
  ): Promise<ChatCompletionResult> {
    const options = { ...baseOptions, stream: false };
    logger.debug(
      "\n[debug/professor-mari] Prompt sent to model (%d messages):\n  Model: %s  Temp: %s  MaxTokens: %s  MaxContext: %s  Effort: %s  Verbosity: %s  Stream: false  CustomParameterKeys: %s",
      messages.length,
      options.model,
      options.enabledParameters?.temperature === false ? "disabled" : (options.temperature ?? "default"),
      options.enabledParameters?.maxTokens === false ? "disabled" : (options.maxTokens ?? "default"),
      options.maxContext ?? "default",
      options.enabledParameters?.reasoningEffort === false ? "disabled" : (options.reasoningEffort ?? "none"),
      options.enabledParameters?.verbosity === false ? "disabled" : (options.verbosity ?? "default"),
      Object.keys(options.customParameters ?? {}).join(",") || "none",
    );
    return provider.chatComplete(messages, options);
  }

  private async executeWorkspaceCommandBatch(
    commands: WorkspaceCommandCall[],
    signal: AbortSignal,
    trace: MariWorkspaceTraceItem[],
    onEvent: PromptEventSink,
  ): Promise<WorkspaceCommandResult[]> {
    const results: WorkspaceCommandResult[] = [];
    for (let index = 0; index < commands.length; ) {
      const command = commands[index]!;
      if (!isReadOnlyWorkspaceCommand(command)) {
        results.push(await this.executeWorkspaceCommand(command, signal, trace, onEvent));
        index += 1;
        continue;
      }
      const group: WorkspaceCommandCall[] = [];
      while (
        index < commands.length &&
        group.length < MAX_PARALLEL_READONLY_COMMANDS &&
        isReadOnlyWorkspaceCommand(commands[index]!)
      ) {
        group.push(commands[index]!);
        index += 1;
      }
      results.push(...(await Promise.all(group.map((entry) => this.executeWorkspaceCommand(entry, signal, trace, onEvent)))));
    }
    return results;
  }

  private async executeWorkspaceCommand(
    command: WorkspaceCommandCall,
    signal: AbortSignal,
    trace: MariWorkspaceTraceItem[],
    onEvent: PromptEventSink,
  ): Promise<WorkspaceCommandResult> {
    const input = command.arguments;
    upsertTraceTool(trace, { id: command.id, name: command.name, status: "running", input, output: null, updatedAt: Date.now() });
    onEvent({ type: "tool_start", data: { id: command.id, name: command.name, input } });
    try {
      const validationIssue = workspaceCommandValidationIssue(command);
      if (validationIssue) throw new Error(validationIssue);
      const output = await this.runWorkspaceCommand(command, signal);
      const compacted = compactOutput(output);
      upsertTraceTool(trace, { id: command.id, name: command.name, status: "done", output: compacted, updatedAt: Date.now() });
      onEvent({ type: "tool_end", data: { id: command.id, name: command.name, isError: false, output: compacted } });
      return { id: command.id, name: command.name, input, output: compacted, success: true };
    } catch (err) {
      const output = err instanceof Error ? err.message : String(err);
      upsertTraceTool(trace, { id: command.id, name: command.name, status: "error", output, updatedAt: Date.now() });
      onEvent({ type: "tool_end", data: { id: command.id, name: command.name, isError: true, output } });
      return { id: command.id, name: command.name, input, output, success: false };
    }
  }

  private async runWorkspaceCommand(command: WorkspaceCommandCall, signal: AbortSignal): Promise<string> {
    switch (command.name) {
      case "read":
        return this.commandRead(command.arguments);
      case "ls":
        return this.commandLs(command.arguments);
      case "find":
        return this.commandFind(command.arguments);
      case "grep":
        return this.commandGrep(command.arguments);
      case "write":
        return this.commandWrite(command.arguments);
      case "edit":
        return this.commandEdit(command.arguments);
      case "bash":
        return this.commandBash(command.arguments, signal);
      default:
        return `Unknown workspace command: ${(command as WorkspaceCommandCall).name}`;
    }
  }

  private resolveWorkspacePath(inputPath: string, options: { allowMissing?: boolean; forbidStorageMutation?: boolean } = {}) {
    const rawPath = inputPath.trim() || ".";
    const absolute = resolve(this.workspaceRoot, rawPath);
    const workspaceRoot = resolve(this.workspaceRoot);
    if (!isWithin(workspaceRoot, absolute)) {
      throw new Error(`Path escapes the workspace: ${inputPath}`);
    }
    if (options.forbidStorageMutation) {
      const storageRoot = resolve(getFileStorageDir());
      if (isWithin(storageRoot, absolute)) {
        throw new Error("DATA_DIR/storage is managed by Marinara. Use mari db for table edits instead of file writes.");
      }
    }
    if (!options.allowMissing && !existsSync(absolute)) throw new Error(`Path not found: ${inputPath}`);
    return absolute;
  }

  private displayPath(absolute: string) {
    const rel = relative(this.workspaceRoot, absolute) || ".";
    return normalizeSlashPath(rel);
  }

  private storageTableReadWarning(absolute: string): string | null {
    const tablesRoot = resolve(getFileStorageDir(), "tables");
    if (!isWithin(tablesRoot, absolute) || !absolute.endsWith(".json")) return null;
    return [
      "Warning: this is a raw file-backed storage table, not parsed app data.",
      "JSON columns in this file are intentionally serialized strings.",
      "Use mari db, mari characters get/search, mari personas, or mari lorebooks for parsed data, and never pass a storage table file to --json-file.",
    ].join(" ");
  }

  private storageTableJsonFileIssue(command: string): string | null {
    if (!/\bmari\b/i.test(command) || !/--(?:json-file|file)\b/i.test(command)) return null;
    const normalized = normalizeSlashPath(command);
    const tablesRoot = normalizeSlashPath(resolve(getFileStorageDir(), "tables"));
    const tablesRel = normalizeSlashPath(relative(this.workspaceRoot, resolve(getFileStorageDir(), "tables")));
    if (!normalized.includes("data/storage/tables/") && !normalized.includes(tablesRoot) && !normalized.includes(tablesRel)) {
      return null;
    }
    return "Do not pass DATA_DIR/storage/tables/*.json to mari --json-file/--file. Those are full raw table exports; create a temp file containing one row/card payload instead.";
  }

  private async commandRead(args: Record<string, unknown>): Promise<string> {
    const filePath = this.resolveWorkspacePath(stringArg(args, "path"));
    const stats = await stat(filePath);
    if (!stats.isFile()) throw new Error("read path must be a file");
    if (stats.size > COMMAND_FILE_READ_LIMIT) {
      return `File ${this.displayPath(filePath)} is ${stats.size} bytes; refusing to read more than ${COMMAND_FILE_READ_LIMIT} bytes. Use grep or a narrower file.`;
    }
    const text = await readFile(filePath, "utf8");
    const lines = text.split(/\r?\n/);
    const offset = numberArg(args, "offset", 1, 1, Math.max(1, lines.length));
    const limit = numberArg(args, "limit", 2000, 1, 2000);
    const selected = lines.slice(offset - 1, offset - 1 + limit);
    const endLine = offset + selected.length - 1;
    const truncated = endLine < lines.length;
    return [
      `File: ${this.displayPath(filePath)}`,
      `Lines: ${offset}-${endLine} of ${lines.length}${truncated ? " (truncated)" : ""}`,
      this.storageTableReadWarning(filePath),
      "",
      selected.map((line, index) => `${offset + index}: ${line}`).join("\n"),
    ]
      .filter((part): part is string => part !== null)
      .join("\n");
  }

  private async commandLs(args: Record<string, unknown>): Promise<string> {
    const dirPath = this.resolveWorkspacePath(stringArg(args, "path", "."));
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) throw new Error("ls path must be a directory");
    const limit = numberArg(args, "limit", 500, 1, 1000);
    const entries = await readdir(dirPath, { withFileTypes: true });
    const names = entries
      .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, limit);
    const truncated = entries.length > names.length;
    return [`Directory: ${this.displayPath(dirPath)}`, ...names, truncated ? `… ${entries.length - names.length} more` : ""]
      .filter(Boolean)
      .join("\n");
  }

  private async walkFiles(root: string, limit = MAX_WALK_ENTRIES): Promise<string[]> {
    const files: string[] = [];
    const visit = async (dir: string) => {
      if (files.length >= limit) return;
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= limit) return;
        if (entry.isDirectory() && SKIPPED_DIRS.has(entry.name)) continue;
        const absolute = join(dir, entry.name);
        if (entry.isDirectory()) await visit(absolute);
        else if (entry.isFile()) files.push(absolute);
      }
    };
    await visit(root);
    return files;
  }

  private matchesGlob(absolute: string, glob: string): boolean {
    const rel = normalizeSlashPath(relative(this.workspaceRoot, absolute));
    const base = normalizeSlashPath(relative(dirname(absolute), absolute));
    const pattern = glob || "**/*";
    const patterns = pattern.startsWith("**/") ? [pattern, pattern.slice(3)] : [pattern];
    return patterns.some((candidate) => {
      const matcher = globToRegExp(candidate);
      return matcher.test(rel) || matcher.test(base);
    });
  }

  private async commandFind(args: Record<string, unknown>): Promise<string> {
    const root = this.resolveWorkspacePath(stringArg(args, "path", "."));
    const stats = await stat(root);
    const pattern = stringArg(args, "pattern", "**/*");
    const limit = numberArg(args, "limit", 1000, 1, 2000);
    const files = stats.isFile() ? [root] : await this.walkFiles(root);
    const matched = files.filter((file) => this.matchesGlob(file, pattern)).slice(0, limit);
    return matched.length
      ? matched.map((file) => this.displayPath(file)).join("\n")
      : `No files matched ${pattern} under ${this.displayPath(root)}.`;
  }

  private async commandGrep(args: Record<string, unknown>): Promise<string> {
    const root = this.resolveWorkspacePath(stringArg(args, "path", "."));
    const stats = await stat(root);
    const pattern = stringArg(args, "pattern");
    if (!pattern) throw new Error("grep requires pattern");
    const glob = stringArg(args, "glob", "**/*");
    const limit = numberArg(args, "limit", 100, 1, 500);
    const context = numberArg(args, "context", 0, 0, 20);
    const ignoreCase = booleanArg(args, "ignoreCase");
    const literal = booleanArg(args, "literal");
    const matcher = literal ? null : new RegExp(pattern, ignoreCase ? "i" : "");
    const literalNeedle = ignoreCase ? pattern.toLowerCase() : pattern;
    const files = stats.isFile() ? [root] : (await this.walkFiles(root)).filter((file) => this.matchesGlob(file, glob));
    const output: string[] = [];
    for (const file of files) {
      if (output.length >= limit) break;
      const fileStats = await stat(file);
      if (fileStats.size > 1_000_000) continue;
      let text = "";
      try {
        text = await readFile(file, "utf8");
      } catch {
        continue;
      }
      if (text.includes("\u0000")) continue;
      const lines = text.split(/\r?\n/);
      for (let index = 0; index < lines.length && output.length < limit; index += 1) {
        const line = lines[index] ?? "";
        const haystack = ignoreCase ? line.toLowerCase() : line;
        const matched = literal ? haystack.includes(literalNeedle) : matcher!.test(line);
        if (!matched) continue;
        const start = Math.max(0, index - context);
        const end = Math.min(lines.length - 1, index + context);
        for (let lineIndex = start; lineIndex <= end && output.length < limit; lineIndex += 1) {
          const marker = lineIndex === index ? ":" : "-";
          output.push(`${this.displayPath(file)}${marker}${lineIndex + 1}: ${lines[lineIndex] ?? ""}`.slice(0, 1000));
        }
      }
    }
    return output.length ? output.join("\n") : `No matches for ${pattern}.`;
  }

  private async commandWrite(args: Record<string, unknown>): Promise<string> {
    const filePath = this.resolveWorkspacePath(stringArg(args, "path"), { allowMissing: true, forbidStorageMutation: true });
    const content = stringArg(args, "content");
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    return `Wrote ${Buffer.byteLength(content, "utf8")} bytes to ${this.displayPath(filePath)}.`;
  }

  private async commandEdit(args: Record<string, unknown>): Promise<string> {
    const filePath = this.resolveWorkspacePath(stringArg(args, "path"), { forbidStorageMutation: true });
    const edits = Array.isArray(args.edits) ? args.edits : [];
    if (edits.length === 0) throw new Error("edit requires non-empty edits array");
    const text = await readFile(filePath, "utf8");
    const ranges: Array<{ start: number; end: number; oldText: string; newText: string }> = [];
    for (const rawEdit of edits) {
      if (!isRecord(rawEdit) || typeof rawEdit.oldText !== "string" || typeof rawEdit.newText !== "string") {
        throw new Error("Each edit requires oldText and newText strings");
      }
      const start = text.indexOf(rawEdit.oldText);
      if (start < 0) throw new Error(`oldText not found in ${this.displayPath(filePath)}`);
      if (text.indexOf(rawEdit.oldText, start + rawEdit.oldText.length) >= 0) {
        throw new Error(`oldText is not unique in ${this.displayPath(filePath)}`);
      }
      ranges.push({ start, end: start + rawEdit.oldText.length, oldText: rawEdit.oldText, newText: rawEdit.newText });
    }
    ranges.sort((a, b) => a.start - b.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index]!.start < ranges[index - 1]!.end) throw new Error("edits overlap");
    }
    let next = "";
    let cursor = 0;
    for (const range of ranges) {
      next += text.slice(cursor, range.start) + range.newText;
      cursor = range.end;
    }
    next += text.slice(cursor);
    await writeFile(filePath, next, "utf8");
    return `Applied ${ranges.length} edit${ranges.length === 1 ? "" : "s"} to ${this.displayPath(filePath)}.`;
  }

  private storageMutationIssue(command: string): string | null {
    const storageRoot = resolve(getFileStorageDir());
    const normalizedCommand = normalizeSlashPath(command);
    const storageMarkers = [
      normalizeSlashPath(storageRoot),
      normalizeSlashPath(relative(this.workspaceRoot, storageRoot)),
      "data/storage",
      "./data/storage",
    ].filter(Boolean);
    if (!storageMarkers.some((marker) => normalizedCommand.includes(marker))) return null;
    if (command.includes("mari db") || command.includes("mari storage tx")) return null;
    const looksMutating = /\b(rm|mv|cp|truncate|tee|sed\s+-i|perl\s+-i|python|node|bash|sh)\b/.test(command);
    return looksMutating
      ? "Shell command appears to mutate DATA_DIR/storage. Use mari db --apply so the browser user can approve the change."
      : null;
  }

  private async commandBash(args: Record<string, unknown>, signal: AbortSignal): Promise<string> {
    const command = stringArg(args, "command");
    if (!command.trim()) throw new Error("bash requires command");
    const compatibilityIssue = windowsShellCompatibilityIssue(command);
    if (compatibilityIssue) throw new Error(compatibilityIssue);
    const storageIssue = this.storageMutationIssue(command);
    if (storageIssue) throw new Error(storageIssue);
    const storageTableJsonIssue = this.storageTableJsonFileIssue(command);
    if (storageTableJsonIssue) throw new Error(storageTableJsonIssue);
    const timeoutSeconds = numberArg(
      args,
      "timeout",
      DEFAULT_BASH_TIMEOUT_SECONDS,
      1,
      MAX_BASH_TIMEOUT_SECONDS,
    );
    const mariCliBinDir = await this.ensureMariCliShim();
    const env = this.withMariRuntimeEnv({ ...process.env }, mariCliBinDir);
    const directMariArgv = parseDirectMariArgv(command, this.workspaceRoot);
    if (directMariArgv) return this.commandMariDirect(command, directMariArgv);
    return new Promise<string>((resolveRun, rejectRun) => {
      const shell = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "bash";
      const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-lc", command];
      const child = spawn(shell, shellArgs, { cwd: this.workspaceRoot, env, windowsHide: true });
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", abortHandler);
        callback();
      };
      const killChild = () => {
        if (process.platform === "win32") killWindowsProcessTree(child.pid);
        child.kill();
      };
      const abortHandler = () => {
        killChild();
        finish(() => rejectRun(new Error("aborted")));
      };
      const timer = setTimeout(() => {
        timedOut = true;
        killChild();
      }, timeoutSeconds * 1000);
      timer.unref?.();
      if (signal.aborted) abortHandler();
      else signal.addEventListener("abort", abortHandler, { once: true });
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
        if (stdout.length > COMMAND_OUTPUT_LIMIT) stdout = stdout.slice(0, COMMAND_OUTPUT_LIMIT);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
        if (stderr.length > COMMAND_OUTPUT_LIMIT) stderr = stderr.slice(0, COMMAND_OUTPUT_LIMIT);
      });
      child.on("error", (err) => finish(() => rejectRun(err)));
      child.on("close", (exitCode) =>
        finish(() => {
          const output = compactOutput([
            `Command: ${command}`,
            `Exit code: ${exitCode}${timedOut ? ` (timeout after ${timeoutSeconds}s)` : ""}`,
            stdout ? `\nstdout:\n${stdout.trimEnd()}` : "",
            stderr ? `\nstderr:\n${stderr.trimEnd()}` : "",
          ].join("\n"));
          if (timedOut || exitCode !== 0) rejectRun(new Error(output));
          else resolveRun(output);
        }),
      );
    });
  }

  private async commandMariDirect(command: string, argv: string[]): Promise<string> {
    const result = await getMariDbService(this.app.db).executeCli({
      argv,
      command,
      cwd: this.workspaceRoot,
      sessionId: SESSION_ID,
    });
    const printable = isRecord(result) && "output" in result && !("summary" in result)
      ? result.output
      : compactMutationResult(result);
    const output = compactOutput(
      [
        `Command: ${command}`,
        `Exit code: ${result.ok === false ? 1 : 0} (direct mari runtime)`,
        "",
        "stdout:",
        stringifyOutput(printable),
      ].join("\n"),
    );
    if (result.ok === false) throw new Error(output);
    return output;
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
      treatAsLocalEndpoint: "true",
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
    env.MARINARA_PI_API_KEY = RUNTIME_API_KEY;
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
      writeFile(cmdCliPath, cmdScript),
      writeFile(powershellCliPath, powershellScript),
    ]);
    this.withMariRuntimeEnv(process.env, binDir);
    if (!existsSync(posixCliPath) || !existsSync(cmdCliPath) || !existsSync(powershellCliPath)) {
      logger.warn("[Professor Mari] failed to create one or more mari CLI shims at %s", binDir);
    }
    return binDir;
  }
}

function appendVisibleText(current: string, next: string): string {
  if (!current.trim()) return next.trimEnd();
  if (!next.trim()) return current;
  return `${current.trimEnd()}\n\n${next.trim()}`;
}

let singleton: ProfessorMariWorkspaceService | null = null;
export function getProfessorMariWorkspaceService(app: FastifyInstance) {
  if (!singleton) singleton = new ProfessorMariWorkspaceService(app);
  return singleton;
}
