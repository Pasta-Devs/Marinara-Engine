// ──────────────────────────────────────────────
// LLM Provider — OpenCode (local configured providers)
// ──────────────────────────────────────────────
//
// Marinara owns the conversation and tool loop. OpenCode is used as a
// one-shot model gateway through the user's existing local configuration.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createOpencodeClient,
  type FilePartInput,
  type ProviderListResponse,
  type TextPartInput,
} from "@opencode-ai/sdk/v2";
import { BaseLLMProvider, type ChatMessage, type ChatOptions, type LLMUsage } from "../base-provider.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";

const OPENCODE_BINARY = "opencode";
const OPENCODE_SERVER_READY_PREFIX = "opencode server listening";
const OPENCODE_SERVER_START_TIMEOUT_MS = 30_000;
const OPENCODE_SERVER_IDLE_MS = 30_000;
const OPENCODE_ERROR_PREVIEW_CHARS = 2_000;
const OPENCODE_TOKENS_PER_CHAR = 4;
const OPENCODE_DEFAULT_CONTEXT_TOKENS = 128_000;
const OPENCODE_SCRATCH_PREFIX = join(tmpdir(), "marinara-opencode-");
const OPENCODE_SYSTEM_PROMPT =
  "You are Marinara Engine's one-shot chat completion backend. Return exactly one assistant response for the transcript. Do not inspect files, run tools, ask setup questions, or continue beyond the final answer.";

export interface OpenCodeModel {
  id: string;
  name: string;
  context?: number;
  maxOutput?: number;
}

export interface OpenCodeGenerationInput {
  model: string;
  prompt: string;
  parts: Array<TextPartInput | FilePartInput>;
  signal?: AbortSignal;
}

export interface OpenCodeGenerationResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedPromptTokens: number;
  cacheWritePromptTokens: number;
  finishReason: string;
}

export interface OpenCodeProviderRuntime {
  generate(input: OpenCodeGenerationInput): Promise<OpenCodeGenerationResult>;
  listModels(): Promise<OpenCodeModel[]>;
}

interface ParsedOpenCodeModelSlug {
  providerID: string;
  modelID: string;
}

interface OpenCodeServerState {
  child: ChildProcess;
  url: string;
  activeRequests: number;
  idleTimer: NodeJS.Timeout | null;
  closed: boolean;
}

let openCodeScratchDirPromise: Promise<string> | null = null;
let sharedServerState: OpenCodeServerState | null = null;
let sharedServerStartPromise: Promise<OpenCodeServerState> | null = null;

function getOpenCodeScratchDir(): Promise<string> {
  openCodeScratchDirPromise ??= mkdtemp(OPENCODE_SCRATCH_PREFIX);
  return openCodeScratchDirPromise;
}

export function parseOpenCodeModelSlug(value: string | null | undefined): ParsedOpenCodeModelSlug | null {
  const trimmed = value?.trim() ?? "";
  const separator = trimmed.indexOf("/");
  if (separator <= 0 || separator === trimmed.length - 1) return null;
  return {
    providerID: trimmed.slice(0, separator),
    modelID: trimmed.slice(separator + 1),
  };
}

function roleLabel(role: ChatMessage["role"]): string {
  switch (role) {
    case "system":
      return "System";
    case "assistant":
      return "Assistant";
    case "tool":
      return "Tool";
    default:
      return "User";
  }
}

function stringifyToolCalls(message: ChatMessage): string {
  if (!message.tool_calls?.length) return "";
  try {
    return `\n[Assistant tool calls: ${JSON.stringify(message.tool_calls)}]`;
  } catch {
    return "\n[Assistant tool calls omitted because they could not be serialized.]";
  }
}

export function buildOpenCodePrompt(messages: ChatMessage[]): string {
  const transcript = messages
    .map((message) => {
      const label = roleLabel(message.role);
      const toolCallId = message.tool_call_id ? `\n[Tool call id: ${message.tool_call_id}]` : "";
      return `<${label}>\n${message.content?.trim() || "(empty)"}${toolCallId}${stringifyToolCalls(message)}\n</${label}>`;
    })
    .join("\n\n");

  return [
    "You are responding as the assistant for Marinara Engine.",
    "Follow the system and user instructions in the transcript exactly.",
    "Return only the assistant response for the latest user turn. Do not describe these wrapper tags.",
    "",
    transcript,
  ].join("\n");
}

function dataUrl(value: string, mimeType: string): string {
  return value.startsWith("data:") ? value : `data:${mimeType};base64,${value}`;
}

function mimeFromDataUrl(value: string, fallback: string): string {
  const match = /^data:([^;,]+)/i.exec(value);
  return match?.[1] || fallback;
}

export function buildOpenCodeParts(
  messages: ChatMessage[],
  prompt = buildOpenCodePrompt(messages),
): Array<TextPartInput | FilePartInput> {
  const parts: Array<TextPartInput | FilePartInput> = [{ type: "text", text: prompt }];

  messages.forEach((message, messageIndex) => {
    message.images?.forEach((image, attachmentIndex) => {
      const mime = mimeFromDataUrl(image, "image/png");
      parts.push({
        type: "file",
        mime,
        filename: `message-${messageIndex + 1}-image-${attachmentIndex + 1}`,
        url: dataUrl(image, mime),
      });
    });
    message.files?.forEach((file, attachmentIndex) => {
      const mime = file.type || mimeFromDataUrl(file.data, "application/octet-stream");
      parts.push({
        type: "file",
        mime,
        filename: file.filename || `message-${messageIndex + 1}-file-${attachmentIndex + 1}`,
        url: dataUrl(file.data, mime),
      });
    });
    message.media?.forEach((media, attachmentIndex) => {
      parts.push({
        type: "file",
        mime: media.mimeType,
        filename: media.filename || `message-${messageIndex + 1}-${media.kind}-${attachmentIndex + 1}`,
        url: dataUrl(media.data, media.mimeType),
      });
    });
  });

  return parts;
}

export function flattenOpenCodeModels(providerList: ProviderListResponse): OpenCodeModel[] {
  const connected = new Set(providerList.connected);
  const models: OpenCodeModel[] = [];
  const seen = new Set<string>();

  for (const provider of providerList.all) {
    if (!connected.has(provider.id)) continue;
    for (const model of Object.values(provider.models)) {
      const id = `${provider.id}/${model.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      models.push({
        id,
        name: model.name?.trim() || id,
        context: model.limit?.context,
        maxOutput: model.limit?.output,
      });
    }
  }

  return models.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function estimateTokens(text: string): number {
  return Math.ceil(Array.from(text).length / OPENCODE_TOKENS_PER_CHAR);
}

function compactOpenCodeError(error: unknown): string {
  if (error instanceof Error && error.message.trim())
    return error.message.trim().slice(0, OPENCODE_ERROR_PREVIEW_CHARS);
  try {
    return JSON.stringify(error).slice(0, OPENCODE_ERROR_PREVIEW_CHARS);
  } catch {
    return String(error).slice(0, OPENCODE_ERROR_PREVIEW_CHARS);
  }
}

function providerErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;
  const message =
    typeof data?.message === "string" ? data.message : typeof record.message === "string" ? record.message : "";
  const name = typeof record.name === "string" ? record.name : typeof record._tag === "string" ? record._tag : "";
  const detail = message.trim() || compactOpenCodeError(error);
  return name ? `${name}: ${detail}` : detail;
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a loopback port for OpenCode."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function stopOpenCodeProcess(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    const result = spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    if (!result.error && result.status === 0) return;
  }
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Fall back to the direct child below.
    }
  }
  child.kill("SIGTERM");
}

async function startOpenCodeServer(): Promise<OpenCodeServerState> {
  const [port, scratchDir] = await Promise.all([findAvailablePort(), getOpenCodeScratchDir()]);
  const openCodeArgs = ["serve", "--hostname=127.0.0.1", `--port=${port}`];
  const command = process.platform === "win32" ? process.env.ComSpec?.trim() || "cmd.exe" : OPENCODE_BINARY;
  const commandArgs =
    process.platform === "win32" ? ["/d", "/s", "/c", `${OPENCODE_BINARY} ${openCodeArgs.join(" ")}`] : openCodeArgs;
  const child = spawn(command, commandArgs, {
    cwd: scratchDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  });

  return await new Promise<OpenCodeServerState>((resolve, reject) => {
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      stopOpenCodeProcess(child);
      reject(new Error(`OpenCode server startup timed out after ${OPENCODE_SERVER_START_TIMEOUT_MS / 1000}s.`));
    }, OPENCODE_SERVER_START_TIMEOUT_MS);
    timeout.unref?.();

    const appendOutput = (chunk: Buffer) => {
      output = `${output}${chunk.toString("utf8")}`.slice(-OPENCODE_ERROR_PREVIEW_CHARS);
    };
    child.stderr.on("data", appendOutput);
    child.stdout.on("data", (chunk: Buffer) => {
      appendOutput(chunk);
      if (settled) return;
      for (const line of output.split(/\r?\n/)) {
        if (!line.startsWith(OPENCODE_SERVER_READY_PREFIX)) continue;
        const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
        if (!match?.[1]) continue;
        settled = true;
        clearTimeout(timeout);
        const state: OpenCodeServerState = {
          child,
          url: match[1],
          activeRequests: 0,
          idleTimer: null,
          closed: false,
        };
        child.once("exit", (code, signal) => {
          const wasClosed = state.closed;
          state.closed = true;
          if (state.idleTimer) clearTimeout(state.idleTimer);
          if (sharedServerState === state) sharedServerState = null;
          if (!wasClosed && code !== 0 && signal !== "SIGTERM") {
            logger.warn("OpenCode server exited code=%s signal=%s", String(code), signal ?? "none");
          }
        });
        resolve(state);
        return;
      }
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const detail = /ENOENT/i.test(error.message)
        ? "OpenCode is not installed or is not on PATH. Install it with `npm install -g opencode-ai`, then run `opencode` and use /connect."
        : `Failed to start OpenCode: ${error.message}`;
      reject(new Error(detail));
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `OpenCode server exited before startup completed (code ${code ?? "unknown"})${output.trim() ? `: ${output.trim()}` : "."}`,
        ),
      );
    });
  });
}

async function acquireOpenCodeServer(): Promise<OpenCodeServerState> {
  if (!sharedServerState || sharedServerState.closed) {
    sharedServerStartPromise ??= startOpenCodeServer()
      .then((state) => {
        sharedServerState = state;
        return state;
      })
      .finally(() => {
        sharedServerStartPromise = null;
      });
    await sharedServerStartPromise;
  }
  const state = sharedServerState;
  if (!state || state.closed) throw new Error("OpenCode server stopped before the request could start.");
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  state.activeRequests += 1;
  return state;
}

function releaseOpenCodeServer(state: OpenCodeServerState): void {
  state.activeRequests = Math.max(0, state.activeRequests - 1);
  if (state.activeRequests !== 0 || state.closed || state.idleTimer) return;
  state.idleTimer = setTimeout(() => {
    state.idleTimer = null;
    if (state.activeRequests !== 0 || state.closed) return;
    state.closed = true;
    if (sharedServerState === state) sharedServerState = null;
    stopOpenCodeProcess(state.child);
  }, OPENCODE_SERVER_IDLE_MS);
  state.idleTimer.unref?.();
}

async function withOpenCodeClient<T>(
  operation: (client: ReturnType<typeof createOpencodeClient>) => Promise<T>,
): Promise<T> {
  const state = await acquireOpenCodeServer();
  const scratchDir = await getOpenCodeScratchDir();
  const client = createOpencodeClient({
    baseUrl: state.url,
    directory: scratchDir,
    throwOnError: true,
  });
  try {
    return await operation(client);
  } finally {
    releaseOpenCodeServer(state);
  }
}

export const defaultOpenCodeRuntime: OpenCodeProviderRuntime = {
  async listModels() {
    return await withOpenCodeClient(async (client) => {
      const result = await client.provider.list();
      if (!result.data) throw new Error("OpenCode did not return a provider catalog.");
      const models = flattenOpenCodeModels(result.data);
      if (!models.length) {
        throw new Error("OpenCode did not report any connected models. Run `opencode`, use /connect, then try again.");
      }
      return models;
    });
  },

  async generate(input) {
    const parsedModel = parseOpenCodeModelSlug(input.model);
    if (!parsedModel)
      throw new Error("OpenCode models must use the provider/model format. Fetch models and select one.");

    return await withOpenCodeClient(async (client) => {
      const sessionResult = await client.session.create({
        title: "Marinara Engine completion",
        permission: [{ permission: "*", pattern: "*", action: "deny" }],
      });
      const session = sessionResult.data;
      if (!session) throw new Error("OpenCode session creation returned no session.");

      const abortSession = async () => {
        await client.session.abort({ sessionID: session.id }).catch(() => {});
      };
      const onAbort = () => void abortSession();
      input.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        if (input.signal?.aborted) {
          await abortSession();
          throw input.signal.reason instanceof Error ? input.signal.reason : new Error("OpenCode request was aborted.");
        }
        const result = await client.session.prompt(
          {
            sessionID: session.id,
            model: parsedModel,
            system: OPENCODE_SYSTEM_PROMPT,
            parts: input.parts,
          },
          input.signal ? { signal: input.signal } : undefined,
        );
        const response = result.data;
        if (!response) throw new Error("OpenCode returned no response payload.");
        const failure = providerErrorMessage(response.info.error);
        if (failure) throw new Error(`OpenCode provider request failed: ${failure}`);
        const text = response.parts
          .filter((part): part is Extract<(typeof response.parts)[number], { type: "text" }> => part.type === "text")
          .filter((part) => !part.ignored)
          .map((part) => part.text)
          .join("")
          .trim();
        if (!text) throw new Error("OpenCode returned no text content.");
        return {
          text,
          promptTokens: response.info.tokens.input,
          completionTokens: response.info.tokens.output,
          reasoningTokens: response.info.tokens.reasoning,
          cachedPromptTokens: response.info.tokens.cache.read,
          cacheWritePromptTokens: response.info.tokens.cache.write,
          finishReason: response.info.finish || "stop",
        };
      } catch (error) {
        if (input.signal?.aborted) await abortSession();
        throw error;
      } finally {
        input.signal?.removeEventListener("abort", onAbort);
        await client.session.delete({ sessionID: session.id }).catch((error) => {
          logger.debug(error, "Failed to delete completed OpenCode session %s", session.id);
        });
      }
    });
  },
};

export async function fetchOpenCodeModels(
  runtime: OpenCodeProviderRuntime = defaultOpenCodeRuntime,
): Promise<OpenCodeModel[]> {
  return await runtime.listModels();
}

export class OpenCodeProvider extends BaseLLMProvider {
  constructor(
    baseUrl: string,
    apiKey: string,
    maxContext?: number,
    openrouterProvider?: string | null,
    maxTokensOverride?: number | null,
    private readonly runtime: OpenCodeProviderRuntime = defaultOpenCodeRuntime,
  ) {
    super(baseUrl, apiKey, maxContext, openrouterProvider, maxTokensOverride);
  }

  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    if (!parseOpenCodeModelSlug(options.model)) {
      throw new Error("OpenCode models must use the provider/model format. Fetch models and select one.");
    }
    const maxTokens = this.applyMaxTokensCap(options.maxTokens ?? 4096);
    const maxContext = options.maxContext ?? this.maxContextValue ?? OPENCODE_DEFAULT_CONTEXT_TOKENS;
    const contextFit = this.fitMessagesToContext(messages, {
      ...options,
      maxContext,
      maxTokens,
      tools: undefined,
      suppressModelParameters: true,
    });
    this.logContextTrim(contextFit, options.model);
    const prompt = buildOpenCodePrompt(contextFit.messages);
    const debugOverrideEnabled = options.debugMode === true || isDebugAgentsEnabled();
    logger.debug("[opencode] running model=%s promptChars=%d maxContext=%d", options.model, prompt.length, maxContext);
    logDebugOverride(debugOverrideEnabled, "[debug/opencode] final prompt:\n%s", prompt);

    try {
      const result = await this.runtime.generate({
        model: options.model,
        prompt,
        parts: buildOpenCodeParts(contextFit.messages, prompt),
        ...(options.signal ? { signal: options.signal } : {}),
      });
      yield result.text;
      const promptTokens = result.promptTokens || estimateTokens(prompt);
      const completionTokens = result.completionTokens || estimateTokens(result.text);
      return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        completionReasoningTokens: result.reasoningTokens || undefined,
        cachedPromptTokens: result.cachedPromptTokens || undefined,
        cacheWritePromptTokens: result.cacheWritePromptTokens || undefined,
        finishReason: result.finishReason,
      };
    } catch (error) {
      logger.error(error, "OpenCode request failed for model %s", options.model);
      throw error;
    }
  }

  override async embed(_texts: string[], _model: string, _signal?: AbortSignal): Promise<number[][]> {
    throw new Error(
      "The OpenCode provider does not support embeddings. Configure a separate embedding connection (OpenAI, Google, or local).",
    );
  }
}
