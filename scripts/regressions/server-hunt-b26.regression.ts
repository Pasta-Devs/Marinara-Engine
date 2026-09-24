import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.LOG_LEVEL = "silent";

const { executeAgent } = await import("../../packages/server/src/services/agents/agent-executor.js");
const { BaseLLMProvider } = await import("../../packages/server/src/services/llm/base-provider.js");
import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import type { AgentContext } from "../../packages/shared/src/types/agent.js";
import type { ResolvedAgent } from "../../packages/server/src/services/agents/agent-pipeline.js";

class RecordingProvider extends BaseLLMProvider {
  prompts: string[] = [];
  constructor(private readonly content = JSON.stringify({ text: "ok" })) {
    super("http://localhost", "");
  }
  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, void, unknown> {
    return;
  }
  override async chatComplete(messages: ChatMessage[]): Promise<ChatCompletionResult> {
    this.prompts.push(messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n"));
    return { content: this.content, toolCalls: [], finishReason: "stop" };
  }
}

const makeAgent = (type: string, resultType: string, settings: Record<string, unknown> = {}): ResolvedAgent => ({
  id: type,
  type,
  name: type,
  phase: "post_processing",
  promptTemplate: `${type} prompt`,
  connectionId: "connection-1",
  settings: { resultType, contextSize: 4, maxTokens: 512, ...settings },
  isCustomAgent: false,
  provider: new RecordingProvider(),
  model: "agent-model",
});

const makeContext = (memory: Record<string, unknown> = {}): AgentContext => ({
  chatId: "server-hunt-b26",
  chatMode: "roleplay",
  recentMessages: [],
  characters: [],
  persona: null,
  memory,
  writableLorebookIds: null,
  chatSummary: null,
  streaming: false,
});

// 1. extractJson must not let a ``` inside a string value of a bare object win.
{
  const value = "Run:\n```js\nfoo()\n```";
  const provider = new RecordingProvider(JSON.stringify({ weather: value }));
  const result = await executeAgent(makeAgent("world-state", "game_state_update"), makeContext(), provider, "m");
  assert.equal(result.success, true, "bare JSON with a fenced string value should parse");
  assert.deepEqual(result.data, { weather: value });

  const fencedProvider = new RecordingProvider('Here [note]:\n```json\n{"weather":"rain"}\n```');
  const fenced = await executeAgent(makeAgent("world-state", "game_state_update"), makeContext(), fencedProvider, "m");
  assert.equal(fenced.success, true, "a fenced response after prose should still parse");
  assert.deepEqual(fenced.data, { weather: "rain" });

  const plainFence = new RecordingProvider('```json\n{"weather":"sun"}\n```');
  const plain = await executeAgent(makeAgent("world-state", "game_state_update"), makeContext(), plainFence, "m");
  assert.deepEqual(plain.data, { weather: "sun" });
}

// 2. CYOA and haptic memory blocks go only to the agents that own them, and
//    malformed stored choices do not throw.
{
  const memory = {
    _lastCyoaChoices: [null, "bad", { label: "A", text: "Open the door" }],
    _connectedDevices: [{ name: "Toy", index: 0, capabilities: ["vibrate"] }],
    _hapticSettings: "intensity: low",
  };
  const other = new RecordingProvider();
  await executeAgent(makeAgent("world-state", "game_state_update"), makeContext(memory), other, "m");
  const otherPrompt = other.prompts.join("\n");
  assert.ok(otherPrompt.length > 0, "non-CYOA agent should have run");
  assert.ok(!otherPrompt.includes("<previous_cyoa_choices>"), "CYOA choices leaked to a non-CYOA agent");
  assert.ok(!otherPrompt.includes("<connected_devices>"), "haptic devices leaked to a non-haptic agent");
  assert.ok(!otherPrompt.includes("<haptic_settings>"), "haptic settings leaked to a non-haptic agent");

  const cyoa = new RecordingProvider(JSON.stringify({ choices: [{ label: "B", text: "Leave" }] }));
  const cyoaResult = await executeAgent(makeAgent("cyoa", "cyoa_choices"), makeContext(memory), cyoa, "m");
  assert.equal(cyoaResult.success, true, `CYOA agent should not fail on malformed stored choices: ${cyoaResult.error}`);
  const cyoaPrompt = cyoa.prompts.join("\n");
  assert.ok(cyoaPrompt.includes("<previous_cyoa_choices>"));
  assert.ok(cyoaPrompt.includes("- A: Open the door"));
  assert.ok(!cyoaPrompt.includes("undefined: undefined"));

  const haptic = new RecordingProvider(JSON.stringify({ commands: [] }));
  await executeAgent(makeAgent("haptic", "haptic_command"), makeContext(memory), haptic, "m");
  const hapticPrompt = haptic.prompts.join("\n");
  assert.ok(hapticPrompt.includes("<connected_devices>"));
  assert.ok(hapticPrompt.includes("<haptic_settings>"));
}

// 3. The custom music folder walk is depth-limited and cached between turns.
{
  const root = mkdtempSync(join(tmpdir(), "marinara-b26-music-"));
  try {
    writeFileSync(join(root, "shallow.mp3"), "");
    let deep = root;
    for (let i = 0; i < 12; i++) deep = join(deep, `d${i}`);
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, "deep.mp3"), "");

    const settings = { musicProvider: "custom", customMusicSource: "folder", customMusicExternalFolder: root };
    const run = async () => {
      const provider = new RecordingProvider(JSON.stringify({ action: "none" }));
      await executeAgent(makeAgent("spotify", "local_music_control", settings), makeContext(), provider, "m");
      return provider.prompts.join("\n");
    };
    const first = await run();
    assert.ok(first.includes('name="Shallow"') || /shallow/i.test(first), "shallow track should be listed");
    assert.ok(!/deep/i.test(first.split("<available_local_music")[1] ?? ""), "walk should stop at the depth limit");

    writeFileSync(join(root, "later.mp3"), "");
    const second = await run();
    assert.ok(!/later/i.test(second), "second turn within the TTL should reuse the cached folder scan");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("server-hunt-b26 regression passed");
