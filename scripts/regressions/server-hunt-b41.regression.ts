import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConnectionFallbackProvider,
  type FallbackConnection,
} from "../../packages/server/src/services/llm/connection-fallback-provider.js";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
} from "../../packages/server/src/services/llm/base-provider.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// 1. chatComplete must not fall back (and re-stream a second reply) once the primary already
//    streamed visible text through onToken before failing.
class StreamThenFailProvider extends BaseLLMProvider {
  calls = 0;
  constructor() {
    super("", "");
  }
  async *chat(): AsyncGenerator<string, LLMUsage | void, unknown> {
    throw new Error("not used");
  }
  override async chatComplete(_messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    this.calls += 1;
    await options.onToken?.("partial primary text");
    throw new Error("stream interrupted mid-body");
  }
}

class CompleteProvider extends BaseLLMProvider {
  calls = 0;
  constructor(private readonly text: string) {
    super("", "");
  }
  async *chat(): AsyncGenerator<string, LLMUsage | void, unknown> {
    throw new Error("not used");
  }
  override async chatComplete(_messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    this.calls += 1;
    await options.onToken?.(this.text);
    return { content: this.text, toolCalls: [], finishReason: "stop" } as ChatCompletionResult;
  }
}

class EmptyThenFailProvider extends BaseLLMProvider {
  constructor() {
    super("", "");
  }
  async *chat(): AsyncGenerator<string, LLMUsage | void, unknown> {
    throw new Error("not used");
  }
  override async chatComplete(_messages: ChatMessage[], options: ChatOptions): Promise<ChatCompletionResult> {
    await options.onToken?.("   ");
    throw new Error("failed before usable output");
  }
}

const fallbackConnection: FallbackConnection = {
  id: "fallback-connection",
  name: "Fallback",
  provider: "custom",
  baseUrl: "https://fallback.example/v1",
  apiKey: "test",
  model: "fallback-model",
} as FallbackConnection;

const noopNotifier = async () => {};

{
  const primary = new StreamThenFailProvider();
  const fallback = new CompleteProvider("fallback reply");
  const provider = new ConnectionFallbackProvider(primary, fallback, fallbackConnection, "agents", noopNotifier);
  let streamed = "";
  await assert.rejects(
    provider.chatComplete([{ role: "user", content: "hi" }], {
      model: "primary-model",
      onToken: (chunk: string) => {
        streamed += chunk;
      },
    } as ChatOptions),
    /stream interrupted mid-body/,
  );
  assert.equal(primary.calls, 1);
  assert.equal(fallback.calls, 0, "fallback must not run after the primary streamed visible output");
  assert.equal(streamed, "partial primary text");
}

{
  // Whitespace-only streamed output is not usable, so the fallback still runs.
  const fallback = new CompleteProvider("fallback reply");
  const provider = new ConnectionFallbackProvider(
    new EmptyThenFailProvider(),
    fallback,
    fallbackConnection,
    "agents",
    noopNotifier,
  );
  const result = await provider.chatComplete([{ role: "user", content: "hi" }], {
    model: "primary-model",
    onToken: () => {},
  } as ChatOptions);
  assert.equal(fallback.calls, 1);
  assert.equal(result.content, "fallback reply");
}

// 2. Codex auth.json refresh must be written atomically (temp file + rename), not truncated in place.
//    The refresh path needs a live token endpoint, so this is a source-text check.
{
  const source = readFileSync(
    join(repoRoot, "packages/server/src/services/llm/openai-chatgpt-auth.ts"),
    "utf8",
  );
  const refreshBody = source.slice(source.indexOf("async function refreshAuth"), source.indexOf("async function loadAuthImpl"));
  assert.ok(refreshBody.length > 0, "refreshAuth not found");
  assert.doesNotMatch(refreshBody, /writeFile\(\s*authFilePath/, "auth.json must not be rewritten in place");
  assert.match(refreshBody, /writeFile\(\s*tmpPath[\s\S]*mode:\s*0o600/, "temp file must be created with mode 0o600");
  assert.match(refreshBody, /rename\(\s*tmpPath,\s*authFilePath\s*\)/, "temp file must be renamed over auth.json");
}

console.log("server-hunt-b41 regression passed");
