import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileNativeDB } from "../../packages/server/src/db/file-backed-store.js";
import { memoryChunks } from "../../packages/server/src/db/schema/index.js";
import {
  resolveRoleplayChatSummary,
  resolveRoleplayChatSummaryForPrompt,
} from "../../packages/server/src/routes/generate/generate-route-utils.js";
import { injectMemoryRecallContext } from "../../packages/server/src/services/generation/memory-recall-context.js";
import {
  chunkAndEmbedMessages,
  recallMemories,
  type MemoryRecallEmbeddingSource,
} from "../../packages/server/src/services/memory-recall.js";
import { createChatsStorage } from "../../packages/server/src/services/storage/chats.storage.js";

const summaryMetadata = {
  summary: "Settled history.\n\nDiscarded assistant response.",
  summaryEntries: [
    {
      id: "settled-summary",
      origin: "automated",
      content: "Settled history.",
      enabled: true,
      messageIds: ["older-user", "older-assistant"],
      createdAt: "2026-07-29T08:00:00.000Z",
      updatedAt: "2026-07-29T08:00:00.000Z",
    },
    {
      id: "contaminated-summary",
      origin: "automated",
      content: "Discarded assistant response.",
      enabled: true,
      messageIds: ["latest-user", "regenerated-assistant"],
      createdAt: "2026-07-29T10:00:00.000Z",
      updatedAt: "2026-07-29T10:00:00.000Z",
    },
  ],
};

assert.equal(
  resolveRoleplayChatSummary("roleplay", summaryMetadata),
  summaryMetadata.summary,
  "ordinary roleplay generations must retain the complete compiled summary",
);
assert.equal(
  resolveRoleplayChatSummary("roleplay", summaryMetadata, {
    excludeMessageIds: ["regenerated-assistant"],
  }),
  "Settled history.",
  "regeneration must drop every summary entry covering the response being replaced",
);
assert.equal(
  resolveRoleplayChatSummary("roleplay", summaryMetadata, {
    excludeMessageIds: ["older-user", "regenerated-assistant"],
  }),
  null,
  "regeneration must omit the summary block when every entry covers an excluded message",
);
assert.equal(
  resolveRoleplayChatSummary("roleplay", summaryMetadata, {
    excludeMessageIds: ["message-not-covered-by-summary"],
  }),
  summaryMetadata.summary,
  "unrelated regeneration targets must leave the precompiled summary unchanged",
);
assert.equal(
  resolveRoleplayChatSummary(
    "roleplay",
    {
      summary: "Legacy summary without per-message provenance.",
    },
    {
      excludeMessageIds: ["regenerated-assistant"],
    },
  ),
  null,
  "regeneration must omit a legacy summary that cannot prove it excludes the discarded response",
);

const semanticSummaryEntries = [
  {
    id: "manual-anchor",
    origin: "manual",
    content: "Mari wrote down the permanent relationship anchor.",
    enabled: true,
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "relevant-old-summary",
    origin: "automated",
    content: "The dragon pact was sealed beneath the red moon.",
    enabled: true,
    createdAt: "2026-07-02T08:00:00.000Z",
    updatedAt: "2026-07-02T08:00:00.000Z",
  },
  {
    id: "irrelevant-old-summary",
    origin: "automated",
    content: "They spent a quiet afternoon baking bread.",
    enabled: true,
    createdAt: "2026-07-03T08:00:00.000Z",
    updatedAt: "2026-07-03T08:00:00.000Z",
  },
  {
    id: "recent-summary-one",
    origin: "automated",
    content: "They reached the mountain pass.",
    enabled: true,
    createdAt: "2026-07-04T08:00:00.000Z",
    updatedAt: "2026-07-04T08:00:00.000Z",
  },
  {
    id: "recent-summary-two",
    origin: "automated",
    content: "A storm forced them into the same shelter.",
    enabled: true,
    createdAt: "2026-07-05T08:00:00.000Z",
    updatedAt: "2026-07-05T08:00:00.000Z",
  },
];
const semanticSummaryMetadata = {
  summary: semanticSummaryEntries.map((entry) => entry.content).join("\n\n"),
  summaryEntries: semanticSummaryEntries,
  semanticSummaryRetrievalEnabled: true,
};
const semanticSummaryEmbeddingSource: MemoryRecallEmbeddingSource = {
  label: "roleplay summary regression",
  embed: async (texts, _signal, inputType) =>
    texts.map((text) => {
      if (inputType === "query") {
        if (text.includes("dragon pact")) return [1, 0];
        if (text.includes("recipe")) return [0, 1];
        if (text.includes("spacecraft")) return [-1, 0];
        return [0, -1];
      }
      return text.includes("dragon pact") ? [1, 0] : [0, 1];
    }),
};
const selectedSemanticSummary = await resolveRoleplayChatSummaryForPrompt({
  chatMode: "roleplay",
  chatMetadata: semanticSummaryMetadata,
  messages: [{ role: "user", content: "What did the dragon pact require?" }],
  vectorizerAvailable: true,
  embeddingOptions: { embeddingSource: semanticSummaryEmbeddingSource },
});
assert.equal(
  selectedSemanticSummary,
  [
    semanticSummaryEntries[0]!.content,
    semanticSummaryEntries[1]!.content,
    semanticSummaryEntries[3]!.content,
    semanticSummaryEntries[4]!.content,
  ].join("\n\n"),
  "semantic Roleplay summaries must retain manual and recent entries while retrieving only relevant older automatic entries",
);
assert.equal(
  await resolveRoleplayChatSummaryForPrompt({
    chatMode: "roleplay",
    chatMetadata: semanticSummaryMetadata,
    messages: [{ role: "user", content: "What did the dragon pact require?" }],
    vectorizerAvailable: false,
  }),
  semanticSummaryMetadata.summary,
  "Roleplay summary retrieval must keep the complete summary when embeddings are unavailable",
);

const storageDir = mkdtempSync(join(tmpdir(), "marinara-regeneration-context-"));
process.env.FILE_STORAGE_DIR = storageDir;
const db = await createFileNativeDB();
const embeddingSpaceId = "regeneration-regression-space";
const embeddingSource: MemoryRecallEmbeddingSource = {
  label: "regeneration regression",
  spaceId: embeddingSpaceId,
  embed: async (texts) => texts.map(() => [1, 0]),
};

try {
  await db.insert(memoryChunks).values([
    {
      id: "settled-memory",
      chatId: "regen-chat",
      content: "Settled memory.",
      embedding: JSON.stringify([1, 0]),
      embeddingSpaceId,
      messageCount: 5,
      sourceChatId: null,
      firstMessageAt: "2026-07-29T08:00:00.000Z",
      lastMessageAt: "2026-07-29T09:00:00.000Z",
      createdAt: "2026-07-29T09:00:00.000Z",
    },
    {
      id: "contaminated-memory",
      chatId: "regen-chat",
      content: "Latest user prompt and discarded assistant response.",
      embedding: JSON.stringify([1, 0]),
      embeddingSpaceId,
      messageCount: 5,
      sourceChatId: null,
      firstMessageAt: "2026-07-29T09:30:00.000Z",
      lastMessageAt: "2026-07-29T10:00:00.000Z",
      createdAt: "2026-07-29T10:00:00.000Z",
    },
    {
      id: "newer-memory",
      chatId: "regen-chat",
      content: "Anything newer than the regenerated response.",
      embedding: JSON.stringify([1, 0]),
      embeddingSpaceId,
      messageCount: 5,
      sourceChatId: null,
      firstMessageAt: "2026-07-29T10:01:00.000Z",
      lastMessageAt: "2026-07-29T11:00:00.000Z",
      createdAt: "2026-07-29T11:00:00.000Z",
    },
  ]);

  const ordinaryRecall = await recallMemories(db, "Latest user prompt", ["regen-chat"], {
    embeddingSource,
  });
  assert.equal(ordinaryRecall.length, 3, "ordinary recall must continue considering every relevant memory chunk");

  const regenerationRecall = await recallMemories(db, "Latest user prompt", ["regen-chat"], {
    embeddingSource,
    excludeFromMessageAt: "2026-07-29T10:00:00.000Z",
  });
  assert.deepEqual(
    regenerationRecall.map((memory) => memory.content),
    ["Settled memory."],
    "regeneration recall must exclude chunks ending on or after the response being replaced",
  );

  const promptMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  const recalledLines = await injectMemoryRecallContext({
    db,
    messages: promptMessages,
    currentInputMessages: [{ role: "user", content: "Latest user prompt" }],
    chatId: "regen-chat",
    embeddingSource,
    excludeFromMessageAt: "2026-07-29T10:00:00.000Z",
    contextLimit: undefined,
    sendProgress: () => {},
    wrapFormat: "none",
  });
  assert.deepEqual(recalledLines, ["Settled memory."]);
  assert.doesNotMatch(
    promptMessages[0]?.content ?? "",
    /discarded assistant response/u,
    "the injected Memories block must not contain the regenerated response",
  );

  const chatStorage = createChatsStorage(db);
  const editedChat = await chatStorage.create({
    name: "Edited memory regression",
    mode: "roleplay",
    characterIds: [],
    groupId: null,
    personaId: null,
    promptPresetId: null,
    connectionId: null,
  });
  assert.ok(editedChat);

  const originalLine = "Original assistant wording that must be forgotten.";
  const editedLine = "Edited assistant wording that must replace it.";
  const messageRows = [
    { role: "user" as const, content: "Earlier user message one." },
    { role: "assistant" as const, content: "Earlier assistant message one." },
    { role: "user" as const, content: "Earlier user message two." },
    { role: "assistant" as const, content: "Earlier assistant message two." },
    { role: "user" as const, content: "Earlier user message three." },
    { role: "assistant" as const, content: "Recent assistant message one." },
    { role: "user" as const, content: "Recent user message one." },
    { role: "assistant" as const, content: originalLine },
    { role: "user" as const, content: "Recent user message two." },
    { role: "assistant" as const, content: "Final assistant message." },
  ];
  const createdMessages = [];
  for (const [index, message] of messageRows.entries()) {
    const timestamp = `2026-07-30T10:0${index}:00.000Z`;
    createdMessages.push(
      await chatStorage.createMessage(
        {
          chatId: editedChat.id,
          role: message.role,
          characterId: null,
          content: message.content,
        },
        { createdAt: timestamp, updatedAt: timestamp },
      ),
    );
  }

  const swipeMetadataMessage = createdMessages[5]!;
  await chatStorage.updateMessageExtra(swipeMetadataMessage.id, {
    isConversationStart: true,
    conversationStartForCharacterIds: ["new-character"],
    hiddenFromAICharacterIds: ["private-character"],
  });
  await chatStorage.addSwipe(swipeMetadataMessage.id, "Silent alternate response.", true);
  const retainedSwipe = (await chatStorage.getSwipes(swipeMetadataMessage.id)).find((swipe) => swipe.index === 1);
  assert.ok(retainedSwipe);
  const retainedSwipeExtra = JSON.parse(retainedSwipe.extra as string) as Record<string, unknown>;
  assert.equal(retainedSwipeExtra.isConversationStart, true);
  assert.deepEqual(retainedSwipeExtra.conversationStartForCharacterIds, ["new-character"]);
  assert.deepEqual(retainedSwipeExtra.hiddenFromAICharacterIds, ["private-character"]);
  await chatStorage.setActiveSwipe(swipeMetadataMessage.id, 1);
  const switchedMessageExtra = JSON.parse((await chatStorage.getMessage(swipeMetadataMessage.id))!.extra as string) as Record<
    string,
    unknown
  >;
  assert.deepEqual(switchedMessageExtra.conversationStartForCharacterIds, ["new-character"]);
  assert.deepEqual(switchedMessageExtra.hiddenFromAICharacterIds, ["private-character"]);
  assert.equal(switchedMessageExtra.isConversationStart, true);

  await db.insert(memoryChunks).values({
    id: "unaffected-earlier-memory",
    chatId: editedChat.id,
    content: messageRows
      .slice(0, 5)
      .map((message) => message.content)
      .join("\n\n"),
    embedding: JSON.stringify([1, 0]),
    embeddingSpaceId,
    messageCount: 5,
    sourceChatId: null,
    firstMessageAt: "2026-07-30T10:00:00.000Z",
    lastMessageAt: "2026-07-30T10:04:00.000Z",
    createdAt: "2026-07-30T10:04:00.000Z",
  });
  await db.insert(memoryChunks).values({
    id: "stale-edited-memory",
    chatId: editedChat.id,
    content: messageRows
      .slice(5)
      .map((message) => message.content)
      .join("\n\n"),
    embedding: JSON.stringify([1, 0]),
    embeddingSpaceId,
    messageCount: 5,
    sourceChatId: null,
    firstMessageAt: "2026-07-30T10:05:00.000Z",
    lastMessageAt: "2026-07-30T10:09:00.000Z",
    createdAt: "2026-07-30T10:09:00.000Z",
  });

  await chatStorage.updateMessageContent(createdMessages[7]!.id, editedLine);
  const afterEdit = (await db.select().from(memoryChunks)).filter((chunk) => chunk.chatId === editedChat.id);
  assert.deepEqual(
    afterEdit.map((chunk) => chunk.id),
    ["unaffected-earlier-memory"],
    "editing a message must invalidate its native chunk without deleting unaffected earlier chunks",
  );

  await chunkAndEmbedMessages(
    db,
    editedChat.id,
    { userName: "User", characterNames: {} },
    { embeddingSource, readBehindMessageCount: 0 },
  );
  const rebuilt = (await db.select().from(memoryChunks)).filter((chunk) => chunk.chatId === editedChat.id);
  assert.equal(rebuilt.length, 2, "the next memory refresh must rebuild only the invalidated chunk");
  const rebuiltEditedChunk = rebuilt.find((chunk) => chunk.id !== "unaffected-earlier-memory");
  assert.ok(rebuiltEditedChunk);
  assert.ok(rebuiltEditedChunk.content.includes(editedLine));
  assert.ok(
    !rebuiltEditedChunk.content.includes(originalLine),
    "rebuilt Memory Recall context must not contain the superseded message version",
  );
} finally {
  await db._fileStore.close();
  rmSync(storageDir, { recursive: true, force: true });
}

console.info("Regeneration, edited-message, and memory-context regression passed.");
