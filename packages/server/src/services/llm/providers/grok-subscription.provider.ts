// ──────────────────────────────────────────────
// LLM Provider — Grok CLI (Subscription via local Grok Build auth)
// ──────────────────────────────────────────────
//
// Routes chat requests through the locally-installed `grok` CLI so users can
// use their SuperGrok / X Premium+ CLI subscription without an xAI API key.
// This provider deliberately runs Grok in one-shot, no-tool mode: Marinara owns
// the prompt pipeline, command parsing, and tool execution.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BaseLLMProvider, type ChatMessage, type ChatOptions, type LLMUsage } from "../base-provider.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { estimateTextTokens } from "@marinara-engine/shared";

// The scratch cwd must live OUTSIDE any git checkout: the grok CLI walks up
// from its working directory to the nearest repo root and indexes the whole
// working tree on every one-shot call (45k+ file opens and ~10s of startup
// CPU on a full Marinara checkout — paid by every chat AND agent request
// when this lived under DATA_DIR). The OS temp dir is never inside a repo;
// a unique process-local directory prevents another local user from pre-creating
// the cwd or replacing a predictable path with a symlink.
const GROK_SCRATCH_PREFIX = join(tmpdir(), "marinara-grok-cli-");
let grokScratchDirPromise: Promise<string> | null = null;
const GROK_PROMPT_DIR = join(DATA_DIR, "grok-cli-prompts");
const GROK_ERROR_PREVIEW_CHARS = 2000;
const GROK_MODELS_TIMEOUT_MS = 30 * 1000;
const GROK_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
// 32k stays the DEFAULT window: very large roleplay prompts can make the
// local CLI hit its own turn limit, so the conservative floor is kept for
// connections that never touched the setting. It is no longer a hard cap —
// prompts travel via --prompt-file (the inline `-p` argv ceiling is gone),
// so an explicitly configured Max Context Window is honored as-is.
const GROK_CLI_DEFAULT_CONTEXT_TOKENS = 32_000;
const GROK_CLI_MAX_TURNS = 8;
const GROK_CLI_SAFE_HEADLESS_MODEL_ID = "grok-composer-2.5-fast";
const GROK_CLI_SYSTEM_PROMPT =
  "You are Marinara Engine's one-shot chat completion backend. Return exactly one assistant response for the transcript. Do not inspect files, run tools, ask clarifying questions, plan, or continue beyond the final answer.";
const STALE_GROK_CLI_MODEL_IDS = new Set(["grok-build-latest", "grok-build-0.1"]);

function getGrokScratchDir(): Promise<string> {
  grokScratchDirPromise ??= mkdtemp(GROK_SCRATCH_PREFIX);
  return grokScratchDirPromise;
}

export interface GrokCliModel {
  id: string;
  name: string;
  context?: number;
}

interface GrokCliCommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

class GrokCliCommandError extends Error {
  constructor(
    message: string,
    readonly stdout: string,
    readonly stderr: string,
    readonly code: number | null,
  ) {
    super(message);
  }
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function normalizeGrokCliModelForFlag(model: string): string {
  const trimmed = model.trim();
  return STALE_GROK_CLI_MODEL_IDS.has(trimmed) ? "" : trimmed;
}

function normalizeGrokCliContextWindow(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return GROK_CLI_DEFAULT_CONTEXT_TOKENS;
  // No upper clamp on explicit values: --prompt-file delivery removed the
  // transport-size reason for one, so a deliberately configured max context
  // flows through as-is. Oversized values fail soft via the existing
  // "max turns reached" guidance rather than being silently capped.
  return Math.floor(value);
}

function titleCaseModelId(id: string): string {
  return id
    .split(/[-_:/.]+/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function normalizeModelToken(value: string): string | null {
  const token = value
    .trim()
    .replace(/^["'`([{<]+/, "")
    .replace(/[)"'`,\]}>:;]+$/, "");
  return /^grok[a-z0-9._:/-]*$/i.test(token) ? token : null;
}

function isLikelyUnavailableModelLine(line: string): boolean {
  return /\b(no\s+access|access\s+denied|unauthori[sz]ed|forbidden|not\s+available\s+(?:to|for)\s+(?:this\s+)?(?:account|login|user|subscription|plan)|unavailable\s+(?:to|for)\s+(?:this\s+)?(?:account|login|user|subscription|plan)|not\s+enabled\s+(?:for|on)\s+(?:this\s+)?(?:account|login|user|subscription|plan))\b/i.test(
    line,
  );
}

function parseGrokCliModelsOutput(output: string): GrokCliModel[] {
  const models: GrokCliModel[] = [];
  const seen = new Set<string>();
  const addModel = (id: string, label?: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const name = label?.trim() && !/^grok[a-z0-9._:/-]*$/i.test(label.trim()) ? label.trim() : titleCaseModelId(id);
    models.push({ id, name, context: GROK_CLI_DEFAULT_CONTEXT_TOKENS });
  };

  for (const rawLine of stripAnsi(output).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^[-|+\s]+$/.test(line) || /^(available\s+)?models?$/i.test(line)) continue;
    if (isLikelyUnavailableModelLine(line)) continue;

    if (line.includes("|")) {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      const modelCellIndex = cells.findIndex((cell) => normalizeModelToken(cell));
      if (modelCellIndex >= 0) {
        const modelCell = cells[modelCellIndex];
        const id = modelCell ? normalizeModelToken(modelCell) : null;
        if (id) addModel(id, cells.filter((_, index) => index !== modelCellIndex).join(" "));
      }
      continue;
    }

    const tokens = line.split(/\s+/);
    const tokenIndex = tokens.findIndex((token) => normalizeModelToken(token));
    if (tokenIndex < 0) continue;

    const token = tokens[tokenIndex];
    if (!token) continue;
    const id = normalizeModelToken(token);
    if (!id) continue;
    const label = line
      .slice(line.indexOf(token) + token.length)
      .replace(/^\s*[-–—:]\s*/, "")
      .replace(/\s*\(.*?\)\s*/g, " ")
      .trim();
    addModel(id, label);
  }

  return models;
}

function preferHeadlessGrokCliModels(models: GrokCliModel[]): GrokCliModel[] {
  const safeHeadlessModel = models.find((model) => model.id === GROK_CLI_SAFE_HEADLESS_MODEL_ID);
  if (safeHeadlessModel) return [safeHeadlessModel];

  return [...models].sort((a, b) => {
    const aComposer = a.id.toLowerCase().startsWith("grok-composer-") ? 0 : 1;
    const bComposer = b.id.toLowerCase().startsWith("grok-composer-") ? 0 : 1;
    return aComposer - bComposer || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
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

function attachmentNotice(message: ChatMessage): string {
  const notices: string[] = [];
  if (message.images?.length)
    notices.push(`[${message.images.length} image attachment(s) omitted: Grok CLI provider is text-only.]`);
  if (message.files?.length)
    notices.push(`[${message.files.length} file attachment(s) omitted: Grok CLI provider is text-only.]`);
  if (message.media?.length)
    notices.push(`[${message.media.length} media attachment(s) omitted: Grok CLI provider is text-only.]`);
  return notices.length ? `\n${notices.join("\n")}` : "";
}

function buildGrokPrompt(messages: ChatMessage[]): string {
  const transcript = messages
    .map((message) => {
      const content = message.content?.trim() || "(empty)";
      return `<${roleLabel(message.role)}>\n${content}${attachmentNotice(message)}\n</${roleLabel(message.role)}>`;
    })
    .join("\n\n");

  return [
    "You are responding as the assistant for Marinara Engine.",
    "Follow the system/developer/user instructions in the transcript exactly.",
    "Return only the assistant response for the latest user turn. Do not describe these wrapper tags.",
    "",
    transcript,
  ].join("\n");
}

function compactGrokError(stderr: string, stdout: string, fallback: string): string {
  const combined = stripAnsi([stderr, stdout].filter((part) => part.trim()).join("\n")).trim();
  return (combined || fallback).replace(/\s+/g, " ").slice(0, GROK_ERROR_PREVIEW_CHARS);
}

function grokInstallHint(): string {
  return "Confirm `grok` is installed and `grok login` was run by the same OS user/HOME as the Marinara server.";
}

async function runGrokCliCommand(
  args: string[],
  options: { timeoutMs: number; signal?: AbortSignal; timeoutLabel: string },
): Promise<GrokCliCommandResult> {
  const grokScratchDir = await getGrokScratchDir();

  const child = spawn("grok", args, {
    cwd: grokScratchDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let aborted = false;
  let timedOut = false;
  let requestTimer: NodeJS.Timeout | null = null;
  let killTimer: NodeJS.Timeout | null = null;

  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const terminateChild = () => {
    child.kill("SIGTERM");
    if (killTimer) return;
    killTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
    killTimer.unref?.();
  };
  const onAbort = () => {
    aborted = true;
    terminateChild();
  };

  requestTimer = setTimeout(() => {
    timedOut = true;
    terminateChild();
  }, options.timeoutMs);
  requestTimer.unref?.();

  if (options.signal) {
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });

    if (timedOut) {
      throw new GrokCliCommandError(
        `Grok CLI ${options.timeoutLabel} timed out after ${Math.round(options.timeoutMs / 1000)}s.`,
        stdout,
        stderr,
        result.code,
      );
    }
    if (aborted || options.signal?.aborted) {
      throw new GrokCliCommandError(`Grok CLI ${options.timeoutLabel} was aborted.`, stdout, stderr, result.code);
    }
    return { ...result, stdout, stderr };
  } catch (err) {
    if (err instanceof Error && /ENOENT/.test(err.message)) {
      throw new Error(
        "Grok CLI is not installed or not on PATH. Install it with `curl -fsSL https://x.ai/cli/install.sh | bash`, then run `grok login` as the same OS user that starts Marinara.",
      );
    }
    throw err;
  } finally {
    if (requestTimer) clearTimeout(requestTimer);
    if (killTimer) clearTimeout(killTimer);
    if (options.signal) options.signal.removeEventListener("abort", onAbort);
  }
}

export async function fetchGrokCliModels(): Promise<GrokCliModel[]> {
  const result = await runGrokCliCommand(["models"], {
    timeoutMs: GROK_MODELS_TIMEOUT_MS,
    timeoutLabel: "models lookup",
  });
  if (result.code !== 0) {
    const detail = compactGrokError(
      result.stderr,
      result.stdout,
      `grok models exited with code ${result.code ?? "unknown"}`,
    );
    throw new Error(`Failed to fetch Grok CLI models: ${detail}. ${grokInstallHint()}`);
  }

  const models = parseGrokCliModelsOutput([result.stdout, result.stderr].filter((part) => part.trim()).join("\n"));
  if (!models.length) {
    throw new Error("Grok CLI did not return any model IDs. Run `grok models` in a terminal to inspect the output.");
  }
  return preferHeadlessGrokCliModels(models);
}

export class GrokSubscriptionProvider extends BaseLLMProvider {
  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const configuredMaxTokens = this.applyMaxTokensCap(options.maxTokens ?? 4096);
    const maxContext = normalizeGrokCliContextWindow(options.maxContext ?? this.maxContextValue ?? undefined);
    const contextFit = this.fitMessagesToContext(messages, {
      ...options,
      maxContext,
      maxTokens: configuredMaxTokens,
      tools: undefined,
      suppressModelParameters: true,
    });
    this.logContextTrim(contextFit, options.model);

    const prompt = buildGrokPrompt(contextFit.messages);
    const cliModel = normalizeGrokCliModelForFlag(options.model);

    const debugOverrideEnabled = options.debugMode === true || isDebugAgentsEnabled();
    // The prompt goes via --prompt-file rather than an inline `-p` argv string:
    // OS argv limits (128 KiB per exec argument on Linux, ~32 KiB command lines
    // on Windows) kill the spawn once transcripts grow — reachable even under
    // the old 32k-token clamp, since it estimated chars while the OS counts
    // bytes (multibyte-heavy chats). Unique filename because parallel agent and
    // chat requests share the prompt dir; removed after the CLI exits. Keep
    // prompt files outside --cwd so the model's file tools cannot discover the
    // transcript by listing the CLI workspace.
    await mkdir(GROK_PROMPT_DIR, { recursive: true, mode: 0o700 });
    const grokScratchDir = await getGrokScratchDir();
    const promptFile = join(GROK_PROMPT_DIR, `prompt-${randomUUID()}.txt`);
    await writeFile(promptFile, prompt, { encoding: "utf8", mode: 0o600 });
    const args = [
      "--no-auto-update",
      "--prompt-file",
      promptFile,
      "--output-format",
      "plain",
      "--system-prompt-override",
      GROK_CLI_SYSTEM_PROMPT,
      "--no-plan",
      "--no-subagents",
      "--no-memory",
      "--disable-web-search",
      "--disallowed-tools",
      "run_terminal_command",
      "--max-turns",
      String(GROK_CLI_MAX_TURNS),
      "--cwd",
      grokScratchDir,
    ];
    if (cliModel) args.push("-m", cliModel);

    logger.debug(
      "[grok-subscription] running grok CLI model=%s promptChars=%d maxContext=%d",
      cliModel || "(cli default)",
      prompt.length,
      maxContext,
    );
    logDebugOverride(debugOverrideEnabled, "[debug/grok-subscription] final prompt:\n%s", prompt);

    try {
      let result: GrokCliCommandResult;
      try {
        result = await runGrokCliCommand(args, {
          timeoutMs: GROK_REQUEST_TIMEOUT_MS,
          signal: options.signal,
          timeoutLabel: "request",
        });
      } finally {
        await rm(promptFile, { force: true }).catch(() => {});
      }

      if (result.code !== 0) {
        const detail = compactGrokError(
          result.stderr,
          result.stdout,
          `grok exited with code ${result.code ?? "unknown"}`,
        );
        if (cliModel && /unknown model id|couldn'?t set model|run `?grok models`?/i.test(detail)) {
          throw new Error(
            `Selected Grok CLI model "${cliModel}" is not available to this local CLI login. Click "Fetch Models from Grok CLI" and pick ${GROK_CLI_SAFE_HEADLESS_MODEL_ID} when it appears, or clear the model field to use the CLI default. Details: ${detail}`,
          );
        }
        if (/max turns reached/i.test(detail)) {
          throw new Error(
            `Grok CLI hit its headless turn limit after ${GROK_CLI_MAX_TURNS} turns. This usually happens when the CLI receives more context than the local subscription model can complete cleanly. Lower this connection's Max Context Window, leave the model blank, or select ${GROK_CLI_SAFE_HEADLESS_MODEL_ID}. Details: ${detail}`,
          );
        }
        throw new Error(
          `Grok CLI request failed: ${detail}. ${grokInstallHint()} HOME=${process.env.HOME ?? "unset"}.`,
        );
      }

      const text = stripAnsi(result.stdout).trim();
      if (!text) {
        const detail = compactGrokError(result.stderr, result.stdout, "empty response");
        throw new Error(`Grok CLI returned no content (${detail}).`);
      }

      yield text;
      const completionTokens = estimateTextTokens(text);
      const promptTokens = estimateTextTokens(prompt);
      return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: "stop",
      };
    } catch (err) {
      logger.error(err, "Grok CLI request failed for model %s", cliModel || "(cli default)");
      throw err;
    }
  }

  override async embed(_texts: string[], _model: string, _signal?: AbortSignal): Promise<number[][]> {
    throw new Error(
      "The Grok CLI (Subscription) provider does not support embeddings. Configure a separate embedding connection (OpenAI, Google, or local).",
    );
  }
}
