import assert from "node:assert/strict";
import { embedMemoryRecallTexts } from "../../../packages/server/src/services/memory-recall.js";
import { embedSummaryDocuments } from "../../../packages/server/src/services/generation/summary-document-embeddings.js";

// Some providers complete despite cancellation. Their late response must not warm the cache.
const controller = new AbortController();
const reason = new Error("cancelled summary fixture");
let calls = 0;
const source = {
  label: "summary cancellation fixture",
  cacheIdentity: "summary-cancellation-fixture-v1",
  async embed(texts: string[]) {
    calls += 1;
    if (calls === 1) {
      controller.abort(reason);
      return texts.map(() => [1, 0]);
    }
    return texts.map(() => [0, 1]);
  },
};
await assert.rejects(
  embedSummaryDocuments(["Late response summary"], { embeddingSource: source, signal: controller.signal }),
  (error: unknown) => error === reason,
  "a provider result returned after cancellation must be rejected",
);
assert.deepEqual(await embedSummaryDocuments(["Late response summary"], { embeddingSource: source }), [[0, 1]]);
assert.equal(calls, 2, "retry must request fresh embeddings instead of caching the cancelled response");
assert.deepEqual(await embedSummaryDocuments(["Late response summary"], { embeddingSource: source }), [[0, 1]]);
assert.equal(calls, 2, "a successful retry can warm the cache normally");

const localController = new AbortController();
await assert.rejects(
  embedMemoryRecallTexts(["Local late response"], {
    signal: localController.signal,
    localEmbedder: async () => {
      localController.abort();
      return [[1, 0]];
    },
  }),
  { name: "AbortError" },
  "local embedding responses must honor cancellation too",
);
assert.deepEqual(await embedMemoryRecallTexts(["Local successful response"], { localEmbedder: async () => [[0, 1]] }), [
  [0, 1],
]);
console.info("Semantic summary cancellation regression passed.");
