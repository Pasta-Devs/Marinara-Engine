// ──────────────────────────────────────────────
// LLM Provider — Grok CLI (Subscription via local Grok Build auth)
// ──────────────────────────────────────────────
//
// Routes chat requests through the locally-installed `grok` CLI so users can
// use their SuperGrok / X Premium+ CLI subscription without an xAI API key.
// This provider deliberately runs Grok in one-shot, no-tool mode: Marinara owns
// the prompt pipeline, command parsing, and tool execution.
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BaseLLMProvider, type ChatMessage, type ChatOptions, type LLMUsage } from "../base-provider.js";
import { isDebugAgentsEnabled } from "../../../config/runtime-config.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { DATA_DIR } from "../../../utils/data-dir.js";

const GROK_SCRATCH_DIR = join(DATA_DIR, "grok-cli");
const GROK_ERROR_PREVIEW_CHARS = 2000;
const GROK_REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const GROK_TOKENS_PER_CHAR = 4;

function estimateTokens(text: string): number {
  return Math.ceil(Array.from(text).length / GROK_TOKENS_PER_CHAR);
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
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
  if (message.images?.length) notices.push(`[${message.images.length} image attachment(s) omitted: Grok CLI provider is text-only.]`);
  if (message.files?.length) notices.push(`[${message.files.length} file attachment(s) omitted: Grok CLI provider is text-only.]`);
  if (message.media?.length) notices.push(`[${message.media.length} media attachment(s) omitted: Grok CLI provider is text-only.]`);
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

export class GrokSubscriptionProvider extends BaseLLMProvider {
  async *chat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<string, LLMUsage | void, unknown> {
    const configuredMaxTokens = this.applyMaxTokensCap(options.maxTokens ?? 4096);
    const contextFit = this.fitMessagesToContext(messages, {
      ...options,
      maxTokens: configuredMaxTokens,
      tools: undefined,
      suppressModelParameters: true,
    });
    this.logContextTrim(contextFit, options.model);

    const prompt = buildGrokPrompt(contextFit.messages);
    await mkdir(GROK_SCRATCH_DIR, { recursive: true });

    const debugOverrideEnabled = options.debugMode === true || isDebugAgentsEnabled();
    const args = [
      "--no-auto-update",
      "-p",
      prompt,
      "--output-format",
      "plain",
      "--no-plan",
      "--no-subagents",
      "--no-memory",
      "--disable-web-search",
      "--disallowed-tools",
      "run_terminal_command",
      "--max-turns",
      "1",
      "--cwd",
      GROK_SCRATCH_DIR,
    ];
    if (options.model.trim()) args.push("-m", options.model.trim());

    logger.debug("[grok-subscription] running grok CLI model=%s promptChars=%d", options.model, prompt.length);
    logDebugOverride(debugOverrideEnabled, "[debug/grok-subscription] final prompt:\n%s", prompt);

    const child = spawn("grok", args, {
      cwd: GROK_SCRATCH_DIR,
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
    }, GROK_REQUEST_TIMEOUT_MS);
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
        throw new Error(`Grok CLI request timed out after ${Math.round(GROK_REQUEST_TIMEOUT_MS / 1000)}s.`);
      }
      if (aborted || options.signal?.aborted) {
        throw new Error("Grok CLI request was aborted.");
      }
      if (result.code !== 0) {
        const detail = compactGrokError(stderr, stdout, `grok exited with code ${result.code ?? "unknown"}`);
        throw new Error(
          `Grok CLI request failed: ${detail}. Confirm \`grok\` is installed and \`grok login\` was run by the same OS user/HOME as the Marinara server. HOME=${process.env.HOME ?? "unset"}.`,
        );
      }

      const text = stripAnsi(stdout).trim();
      if (!text) {
        const detail = compactGrokError(stderr, stdout, "empty response");
        throw new Error(`Grok CLI returned no content (${detail}).`);
      }

      yield text;
      const completionTokens = estimateTokens(text);
      const promptTokens = estimateTokens(prompt);
      return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: "stop",
      };
    } catch (err) {
      logger.error(err, "Grok CLI request failed for model %s", options.model);
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

  override async embed(_texts: string[], _model: string, _signal?: AbortSignal): Promise<number[][]> {
    throw new Error(
      "The Grok CLI (Subscription) provider does not support embeddings. Configure a separate embedding connection (OpenAI, Google, or local).",
    );
  }
}
