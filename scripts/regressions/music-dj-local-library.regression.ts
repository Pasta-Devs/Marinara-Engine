// The Music DJ's Game Assets library lists the user's tracks, including generated context music, but never the
// sample a Music & Sound Effects connection test leaves under music/contexts/connection-test/.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentContext } from "../../packages/shared/src/types/agent.js";

const dataDir = process.env.DATA_DIR;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");
process.env.LOG_LEVEL = "silent";
const { buildAssetManifest } = await import("../../packages/server/src/services/game/asset-manifest.service.js");
const { executeAgent } = await import("../../packages/server/src/services/agents/agent-executor.js");
const { BaseLLMProvider } = await import("../../packages/server/src/services/llm/base-provider.js");
type ChatMessage = import("../../packages/server/src/services/llm/base-provider.js").ChatMessage;

for (const path of [
  "music/exploration/calm/forest-walk.mp3",
  "music/contexts/gacha-forge/world-1-sad/generated-0123456789abcdef.mp3",
  "music/contexts/connection-test/0123456789abcdef0123456789abcdef/generated-fedcba9876543210.mp3",
]) {
  mkdirSync(join(dataDir, "game-assets", path, ".."), { recursive: true });
  writeFileSync(join(dataDir, "game-assets", path), "fixture audio");
}
buildAssetManifest();

class RecordingProvider extends BaseLLMProvider {
  prompts: ChatMessage[][] = [];
  constructor() {
    super("http://localhost", "");
  }
  async *chat(): AsyncGenerator<string, void, unknown> {}
  override async chatComplete(messages: ChatMessage[]) {
    this.prompts.push(messages);
    return { content: JSON.stringify({ action: "none" }), toolCalls: [], finishReason: "stop" };
  }
}

const provider = new RecordingProvider();
const context: AgentContext = {
  chatId: "music-dj-library",
  chatMode: "roleplay",
  recentMessages: [{ role: "assistant", content: "Rain drums on the window." }],
  mainResponse: "Rain drums on the window.",
  gameState: null,
  characters: [],
  persona: null,
  memory: {},
  writableLorebookIds: null,
  chatSummary: null,
};
await executeAgent(
  {
    id: "music-dj",
    type: "spotify",
    name: "Music DJ",
    phase: "post_processing",
    promptTemplate: "Pick a track.",
    connectionId: null,
    settings: { musicProvider: "custom" },
    isCustomAgent: false,
  },
  context,
  provider,
  "fixture-model",
);
const prompt = provider.prompts[0]?.map((message) => message.content).join("\n") ?? "";
assert.match(prompt, /path="music\/exploration\/calm\/forest-walk\.mp3"/, "the user's tracks are offered");
assert.match(prompt, /path="music\/contexts\/gacha-forge\//, "generated context music stays in the library");
assert.doesNotMatch(prompt, /connection-test/, "a connection test sample is never offered as a track");
console.info("Music DJ local library regression passed");
