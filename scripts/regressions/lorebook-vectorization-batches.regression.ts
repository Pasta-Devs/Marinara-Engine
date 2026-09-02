import assert from "node:assert/strict";
import type { LorebookEntry } from "@marinara-engine/shared";
import {
  createLorebookEmbeddingBatches,
  DEFAULT_VECTORIZE_BATCH_SIZE,
} from "../../packages/server/src/services/lorebook/embeddings.js";

const entries = Array.from({ length: 72 }, (_, index) => ({
  id: `entry-${index}`,
  name: `Entry ${index}`,
  content: `Content ${index}`,
})) as unknown as LorebookEntry[];
const texts = entries.map((entry) => `embedding text for ${entry.id}`);
const batches = createLorebookEmbeddingBatches(entries, texts);

assert.equal(DEFAULT_VECTORIZE_BATCH_SIZE, 10, "vectorization must use a small default batch size");
assert.deepEqual(
  batches.map((batch) => batch.entries.length),
  [10, 10, 10, 10, 10, 10, 10, 2],
  "a 72-entry lorebook must be split into bounded embedding requests",
);

const persisted = new Map<string, number[]>();
for (const batch of batches) {
  const embeddings = batch.texts.map((text) => [text.length]);
  assert.ok(batch.texts.length <= DEFAULT_VECTORIZE_BATCH_SIZE, "no embedding request may exceed the batch limit");
  for (let index = 0; index < batch.entries.length; index += 1) {
    persisted.set(batch.entries[index]!.id, embeddings[index]!);
  }
}

assert.equal(persisted.size, entries.length, "every entry remains persistable after batching");
assert.deepEqual(persisted.get("entry-71"), ["embedding text for entry-71".length]);

assert.throws(
  () => createLorebookEmbeddingBatches(entries, texts.slice(0, -1)),
  /same length/u,
  "mismatched entry/text arrays must fail before sending partial embedding requests",
);

console.log("Lorebook vectorization batch regression passed.");
