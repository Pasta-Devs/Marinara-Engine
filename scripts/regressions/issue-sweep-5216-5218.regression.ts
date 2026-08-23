import assert from "node:assert/strict";
import type { MessageReaction } from "../../packages/shared/src/types/chat.js";
import {
  VIDEO_GENERATION_SOURCES,
  inferImageSource,
  inferVideoSource,
} from "../../packages/shared/src/constants/model-lists.js";
import { USER_REACTOR, removeCharacterReaction } from "../../packages/client/src/lib/reactions.js";
import {
  buildNanoGptVideoUrl,
  normalizeVideoService,
  parseNanoGptVideoModels,
} from "../../packages/server/src/services/video/video-generation.js";

const mixedReaction: MessageReaction = { emoji: "❤️", by: [USER_REACTOR, "character-a", "character-b"] };
assert.deepEqual(removeCharacterReaction([mixedReaction], mixedReaction), [{ emoji: "❤️", by: [USER_REACTOR] }]);

const characterReaction: MessageReaction = {
  emoji: "✨",
  by: ["character-a"],
  segment: 2,
  segmentSpeaker: "Maukie",
};
assert.deepEqual(removeCharacterReaction([characterReaction], characterReaction), []);

const userReaction: MessageReaction = { emoji: "👍", by: [USER_REACTOR] };
assert.strictEqual(removeCharacterReaction([userReaction], userReaction)[0], userReaction);

const nanoGptSource = VIDEO_GENERATION_SOURCES.find((source) => source.id === "nanogpt");
assert.ok(nanoGptSource);
assert.equal(nanoGptSource.defaultBaseUrl, "https://nano-gpt.com/api");
assert.equal(normalizeVideoService("nano-gpt"), "nanogpt");
assert.equal(inferVideoSource("", "https://nano-gpt.com/api"), "nanogpt");
assert.notEqual(inferVideoSource("", "https://nano-gpt.com.example/api"), "nanogpt");
assert.equal(inferImageSource("", "https://nano-gpt.com/api/v1"), "nanogpt");
assert.notEqual(inferImageSource("", "https://attacker-nano-gpt.com.example/api"), "nanogpt");
assert.equal(
  buildNanoGptVideoUrl("https://nano-gpt.com/api/v1", "generate-video"),
  "https://nano-gpt.com/api/generate-video",
);
assert.throws(
  () => buildNanoGptVideoUrl("https://nano-gpt.com.example/api", "generate-video"),
  /official nano-gpt\.com HTTPS endpoint/,
);

assert.deepEqual(
  parseNanoGptVideoModels({
    data: [
      { id: "model-a", name: "Model A" },
      { id: "model-a", name: "Duplicate" },
      { model: "model-b", displayName: "Model B" },
      { name: "Missing id" },
    ],
  }),
  [
    { id: "model-a", name: "Model A" },
    { id: "model-b", name: "Model B" },
  ],
);

console.info("Reaction removal and NanoGPT video provider regressions passed.");
