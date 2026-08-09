// Shared deterministic bag-of-words stub embedder for the Professor Mari fetch/
// relevance regressions. A stable vocabulary map gives each distinct token its
// own fixed dimension, so cosine similarity is exactly token overlap with no
// hash collisions. It THROWS rather than wrapping once the vocabulary would
// exceed the dimension count, so the collision-free guarantee can't be silently
// violated by a test that grows the vocabulary past it.
import type { MemoryRecallEmbeddingSource } from "../../../packages/server/src/services/memory-recall.js";

export const BOW_STUB_DIM = 512;

export function createBowStubEmbedder(
  spaceId = "stub-space",
  label = "bow stub embedder",
): MemoryRecallEmbeddingSource {
  const vocabulary = new Map<string, number>();
  const dimensionOf = (token: string): number => {
    let index = vocabulary.get(token);
    if (index === undefined) {
      if (vocabulary.size >= BOW_STUB_DIM) {
        throw new Error(
          `bow-stub-embedder: vocabulary exceeded ${BOW_STUB_DIM} distinct tokens; the collision-free guarantee no longer holds`,
        );
      }
      index = vocabulary.size;
      vocabulary.set(token, index);
    }
    return index;
  };
  const embedOne = (text: string): number[] => {
    const vector = new Array<number>(BOW_STUB_DIM).fill(0);
    for (const token of text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) vector[dimensionOf(token)] += 1;
    const magnitude = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0)) || 1;
    return vector.map((x) => x / magnitude);
  };
  return { spaceId, label, embed: async (texts) => texts.map(embedOne) };
}
