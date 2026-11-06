// The Music DJ's Game Assets library lists the user's tracks, including generated context music, but never the
// sample a Music & Sound Effects connection test leaves under music/contexts/connection-test/. A folder on the
// device chosen for a chat or its character replaces the default folder, and only its tracks are offered (#8901).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentContext } from "../../packages/shared/src/types/agent.js";

const dataDir = process.env.DATA_DIR;
assert.ok(dataDir, "the regression runner provides a throwaway DATA_DIR");
process.env.LOG_LEVEL = "silent";
const { buildAssetManifest } = await import("../../packages/server/src/services/game/asset-manifest.service.js");
const { executeAgent } = await import("../../packages/server/src/services/agents/agent-executor.js");
const { resolveEffectiveAgentSettings } =
  await import("../../packages/server/src/services/generation/agent-resolution.js");
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
const deviceFolders = { default: "", nazuna: "", chat: "" };
for (const name of Object.keys(deviceFolders) as Array<keyof typeof deviceFolders>) {
  deviceFolders[name] = join(dataDir, "device-music", name);
  mkdirSync(deviceFolders[name], { recursive: true });
  writeFileSync(join(deviceFolders[name], `${name}-theme.mp3`), "fixture audio");
}

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
const promptFor = async (settings: Record<string, unknown>) => {
  await executeAgent(
    {
      id: "music-dj",
      type: "spotify",
      name: "Music DJ",
      phase: "post_processing",
      promptTemplate: "Pick a track.",
      connectionId: null,
      settings,
      isCustomAgent: false,
    },
    context,
    provider,
    "fixture-model",
  );
  return (
    provider.prompts
      .at(-1)
      ?.map((message) => message.content)
      .join("\n") ?? ""
  );
};
const prompt = await promptFor({ musicProvider: "custom" });
assert.match(prompt, /path="music\/exploration\/calm\/forest-walk\.mp3"/, "the user's tracks are offered");
assert.match(prompt, /path="music\/contexts\/gacha-forge\//, "generated context music stays in the library");
assert.doesNotMatch(prompt, /connection-test/, "a connection test sample is never offered as a track");

// The default source stays Game Assets; the chat's character, then the chat itself, chooses a device folder.
const musicDjSettings = {
  musicProvider: "custom",
  customMusicSource: "game-assets",
  customMusicExternalFolder: deviceFolders.default,
  customMusicCharacterFolders: { nazuna: deviceFolders.nazuna },
};
const offered = async (chatMetadata: Record<string, unknown>, chatCharacterIds: string[]) => {
  const text = await promptFor(
    resolveEffectiveAgentSettings({ agentType: "spotify", settings: musicDjSettings, chatMetadata, chatCharacterIds }),
  );
  return ["forest-walk", ...Object.keys(deviceFolders).map((name) => `${name}-theme`)].filter((track) =>
    text.includes(`name="${track.replace(/-/g, " ")}"`),
  );
};
assert.deepEqual(await offered({}, ["nazuna"]), ["nazuna-theme"], "a solo chat plays only its character's folder");
assert.deepEqual(
  await offered({ customMusicExternalFolder: deviceFolders.chat }, ["nazuna"]),
  ["chat-theme"],
  "a chat folder plays only that folder",
);
assert.deepEqual(await offered({}, ["nazuna", "keyleth"]), ["forest-walk"], "a group chat keeps the default source");
console.info("Music DJ local library regression passed");
