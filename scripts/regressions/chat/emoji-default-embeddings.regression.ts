// Semantic emoji and sticker picks rank with the chat's Embeddings source when one is set: the message embeds as a
// search, the assets as documents, asset vectors are reused between messages, and a failing source falls back.
import assert from "node:assert/strict";
import { normalizeCustomEmojiSelection } from "../../../packages/shared/src/index.js";
import {
  orderEmojiNames,
  rankCombinedAssetNames,
} from "../../../packages/server/src/routes/generate/conversation-custom-assets.js";
import type { MemoryRecallEmbeddingSource } from "../../../packages/server/src/services/memory-recall.js";

// A toy space: each text points along the axis of the first topic word it mentions.
const topics = ["rain", "cake", "cat"];
const vectorFor = (text: string) => topics.map((topic) => (text.toLowerCase().includes(topic) ? 1 : 0.01));

const calls: { texts: string[]; inputType?: string }[] = [];
const source: MemoryRecallEmbeddingSource = {
  spaceId: "test-space",
  label: "Test embeddings",
  async embed(texts, _signal, inputType) {
    calls.push({ texts, inputType });
    return texts.map(vectorFor);
  },
};

const names = ["happy_cake", "sleepy_cat", "rain_cloud"];
const semantic = normalizeCustomEmojiSelection({ mode: "semantic" });

const ranked = await orderEmojiNames(names, semantic, "It will rain all day", undefined, source);
assert.equal(ranked[0], "rain_cloud");
assert.deepEqual(
  calls.map((call) => call.inputType).sort(),
  ["document", "query"],
  "the message embeds as a search and the assets as documents",
);
assert.deepEqual(calls.find((call) => call.inputType === "query")!.texts, ["It will rain all day"]);

calls.length = 0;
const again = await orderEmojiNames(names, semantic, "Is there cake?", undefined, source);
assert.equal(again[0], "happy_cake");
assert.deepEqual(
  calls.map((call) => call.inputType),
  ["query"],
  "asset vectors from the first message are reused",
);

// The character's own asset still wins a close call against a shared one.
const combined = await rankCombinedAssetNames(["sleepy_cat"], ["rain_cloud"], "the cat is out", undefined, source);
assert.equal(combined![0], "sleepy_cat");

// A source that fails falls back (to the bundled embedder, or random order when it is not installed).
const failing: MemoryRecallEmbeddingSource = { label: "Broken", embed: async () => null };
const fallback = await orderEmojiNames(names, semantic, "rain", undefined, failing);
assert.deepEqual([...fallback].sort(), [...names].sort());

console.log("emoji-default-embeddings regression passed");
