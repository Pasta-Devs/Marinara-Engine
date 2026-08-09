// Guards the relevance-ranked <available_names> list (#4768 phase 3): the names
// Mari sees are ordered by semantic relevance to the current conversation (top-K),
// not alphabetically — and it degrades to the alphabetical list when the embedder
// is unavailable. Uses a real file-native DB + a deterministic stub embedder.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MemoryRecallEmbeddingSource } from "../../packages/server/src/services/memory-recall.js";
import { BOW_STUB_DIM as DIM, createBowStubEmbedder } from "./helpers/bow-stub-embedder.js";

process.env.FILE_STORAGE_DIR = mkdtempSync(join(tmpdir(), "marinara-relevance-"));

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { characters } = await import("../../packages/server/src/db/schema/index.js");
const { createEntityEmbeddingStore } = await import("../../packages/server/src/services/entity-embedding-store.js");
const { resolveProfessorMariPromptContext } = await import(
  "../../packages/server/src/routes/generate/professor-mari-prompt-context.js"
);

// Deterministic, collision-free bag-of-words embedder shared with the other Mari
// fetch regressions (token overlap → exact cosine).
const stubSource = createBowStubEmbedder("stub-space", "relevance regression");

const db = await createFileNativeDB();
const STAMP = "2026-01-01T00:00:00.000Z";
async function insertCharacter(id: string, name: string, description: string) {
  await db.insert(characters).values({
    id,
    data: JSON.stringify({ name, description }),
    comment: "",
    createdAt: STAMP,
    updatedAt: STAMP,
  });
}
// Insertion (creation) order is Dracula, Bob, Zephyr; alphabetical is Bob,
// Dracula, Zephyr — so a first-name of "Bob" proves alphabetical, "Dracula"
// proves either creation-order OR vampire-relevance (disambiguated by context).
await insertCharacter("c1", "Dracula", "an immortal vampire of the undead");
await insertCharacter("c2", "Bob", "a cheerful village baker");
await insertCharacter("c3", "Zephyr", "a wandering wind mage");

// Stub stores for the alphabetical-fallback path (unused when ranking succeeds).
const charsStore = {
  list: async () => [
    { id: "c1", data: JSON.stringify({ name: "Dracula" }) },
    { id: "c2", data: JSON.stringify({ name: "Bob" }) },
    { id: "c3", data: JSON.stringify({ name: "Zephyr" }) },
  ],
  listPersonas: async () => [],
};
const emptyStore = { list: async () => [] };

function firstCharacterName(volatileContext: string): string {
  const block = volatileContext.match(/<available_names type="character">\n([^\n]*)/);
  return (block?.[1] ?? "").split(",")[0]!.trim();
}

// ── Cold library (nothing warmed): must fall back to ALPHABETICAL, not emit an
//    arbitrary creation-order slice mislabeled as relevance-ranked ──
{
  const { volatileContext } = await resolveProfessorMariPromptContext({
    chatMeta: {},
    chars: charsStore,
    lorebooksStore: emptyStore,
    chats: emptyStore,
    presets: emptyStore,
    db,
    queryText: "tell me about the immortal vampire, the undead one",
    embeddingSource: stubSource,
    vectorizerAvailable: true,
  });
  assert.equal(
    firstCharacterName(volatileContext),
    "Bob",
    "with no warmed embeddings the list must be alphabetical (Bob), not creation-order (Dracula)",
  );
}

// Pre-warm embeddings the way a fetch would, under the stub's source id.
const warmStore = createEntityEmbeddingStore(db, stubSource.spaceId);
for (const candidate of await warmStore.listCandidates("character")) {
  const [vector] = await stubSource.embed([candidate.embedText]);
  await warmStore.updateEmbedding("character", candidate.id, vector!, candidate.embedText);
}

// ── Relevance path: a vampire query ranks Dracula first (not alphabetical) ──
{
  const { volatileContext } = await resolveProfessorMariPromptContext({
    chatMeta: {},
    chars: charsStore,
    lorebooksStore: emptyStore,
    chats: emptyStore,
    presets: emptyStore,
    db,
    queryText: "tell me about the immortal vampire, the undead one",
    embeddingSource: stubSource,
    vectorizerAvailable: true,
  });
  assert.equal(firstCharacterName(volatileContext), "Dracula", "the conversation-relevant character must rank first");
}

// ── A different query re-ranks (nothing is re-embedded on the entity side) ──
{
  const { volatileContext } = await resolveProfessorMariPromptContext({
    chatMeta: {},
    chars: charsStore,
    lorebooksStore: emptyStore,
    chats: emptyStore,
    presets: emptyStore,
    db,
    queryText: "a cheerful baker in the village",
    embeddingSource: stubSource,
    vectorizerAvailable: true,
  });
  assert.equal(firstCharacterName(volatileContext), "Bob", "ranking follows the conversation, not a fixed order");
}

// ── Degrade: vectorizer unavailable → the alphabetical list (Bob first) ──
{
  const { volatileContext } = await resolveProfessorMariPromptContext({
    chatMeta: {},
    chars: charsStore,
    lorebooksStore: emptyStore,
    chats: emptyStore,
    presets: emptyStore,
    vectorizerAvailable: false,
  });
  assert.equal(firstCharacterName(volatileContext), "Bob", "with no vectorizer the list is alphabetical");
}

// ── No query text (e.g. an autonomous turn) also degrades to alphabetical ──
{
  const { volatileContext } = await resolveProfessorMariPromptContext({
    chatMeta: {},
    chars: charsStore,
    lorebooksStore: emptyStore,
    chats: emptyStore,
    presets: emptyStore,
    db,
    queryText: "   ",
    embeddingSource: stubSource,
    vectorizerAvailable: true,
  });
  assert.equal(firstCharacterName(volatileContext), "Bob", "an empty query falls back to alphabetical");
}

// ── The query is embedded ONCE across a turn's follow-up passes (memoized) ──
{
  let queryEmbedCalls = 0;
  // Wrap the SAME embedder that warmed the entity vectors, so the query vector
  // shares its token→dimension space (a fresh embedder would use different coords).
  const countingSource: MemoryRecallEmbeddingSource = {
    spaceId: "stub-space",
    label: "counting",
    embed: async (texts) => {
      queryEmbedCalls += 1;
      return stubSource.embed(texts);
    },
  };
  const cache = new Map<string, number[] | null>();
  const buildOnce = () =>
    resolveProfessorMariPromptContext({
      chatMeta: {},
      chars: charsStore,
      lorebooksStore: emptyStore,
      chats: emptyStore,
      presets: emptyStore,
      db,
      queryText: "vampires and the undead lord",
      embeddingSource: countingSource,
      vectorizerAvailable: true,
      queryEmbeddingCache: cache,
    });
  await buildOnce();
  await buildOnce();
  assert.equal(queryEmbedCalls, 1, "the query must be embedded once per turn, reused across follow-up passes");
}

process.stdout.write("Professor Mari relevance-names regression passed.\n");
