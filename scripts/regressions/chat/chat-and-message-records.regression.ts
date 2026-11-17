// Chats and messages as the app loads them: older messages hydrated, chats normalized for the response, chats sorted
// by recent activity, generation waiting for pending chat metadata saves, and message page cursors.
import assert from "node:assert/strict";
import type { Message } from "../../../packages/shared/src/types/chat.js";
import {
  trackChatMetadataSave,
  waitForPendingChatMetadataSaves,
} from "../../../packages/client/src/lib/chat-metadata-save-barrier.js";
import {
  compareChatsByActivityDesc,
  compareChatsByCreatedAtAsc,
  compareChatsByCreatedAtDesc,
} from "../../../packages/client/src/lib/chat-recency.js";
import { normalizeChatForResponse } from "../../../packages/server/src/routes/chats.routes.js";
import { normalizeHydratedMessage } from "../../../packages/client/src/lib/message-hydration.js";

assert.deepEqual(
  normalizeHydratedMessage({
    id: "legacy-reactions",
    chatId: "chat-legacy",
    role: "assistant",
    content: { reactions: [{ emoji: "💖", count: 1 }] },
    createdAt: "2026-08-09T00:00:00.000Z",
  } as unknown as Message),
  {
    id: "legacy-reactions",
    chatId: "chat-legacy",
    role: "assistant",
    content: "",
    extra: {
      displayText: null,
      isGenerated: true,
      tokenCount: null,
      generationInfo: null,
      reactions: [{ emoji: "💖", count: 1 }],
    },
    createdAt: "2026-08-09T00:00:00.000Z",
    activeSwipeIndex: 0,
  },
);
assert.deepEqual(
  normalizeChatForResponse({
    id: "fresh-chat",
    characterIds: '["character-a","character-b"]',
    metadata: '{"tags":["saved-tag"],"gameNpcs":[]}',
  }),
  {
    id: "fresh-chat",
    characterIds: ["character-a", "character-b"],
    metadata: { tags: ["saved-tag"], gameNpcs: [] },
    personaCharacterId: null,
  },
  "Fresh chat responses must expose parsed tags and character IDs",
);
const olderActiveChat = {
  id: "older-active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastMessageAt: "2026-07-31T10:00:00.000Z",
};
const newerIdleChat = {
  id: "newer-idle",
  createdAt: "2026-07-30T00:00:00.000Z",
  lastMessageAt: "2026-07-30T01:00:00.000Z",
};
assert.deepEqual(
  [newerIdleChat, olderActiveChat].sort(compareChatsByActivityDesc).map((chat) => chat.id),
  ["older-active", "newer-idle"],
  "Recent chat sorting must use last-message activity",
);
assert.deepEqual(
  [olderActiveChat, newerIdleChat].sort(compareChatsByCreatedAtDesc).map((chat) => chat.id),
  ["newer-idle", "older-active"],
  "Newest chat sorting must use creation time",
);
assert.deepEqual(
  [newerIdleChat, olderActiveChat].sort(compareChatsByCreatedAtAsc).map((chat) => chat.id),
  ["older-active", "newer-idle"],
  "Oldest chat sorting must use creation time",
);
const metadataSaveOrder: string[] = [];
let releaseFirstMetadataSave!: () => void;
const firstMetadataSaveBlocker = new Promise<void>((resolve) => {
  releaseFirstMetadataSave = resolve;
});
const firstMetadataSave = trackChatMetadataSave("chat-prose-swipe", async () => {
  await firstMetadataSaveBlocker;
  metadataSaveOrder.push("first");
});
const secondMetadataSave = trackChatMetadataSave("chat-prose-swipe", async () => {
  metadataSaveOrder.push("second");
});
let metadataWaitFinished = false;
const pendingMetadataWait = waitForPendingChatMetadataSaves("chat-prose-swipe").then(() => {
  metadataWaitFinished = true;
});
assert.equal(metadataWaitFinished, false, "swipe generation should remain blocked while preferences are saving");
releaseFirstMetadataSave();
await Promise.all([firstMetadataSave, secondMetadataSave, pendingMetadataWait]);
assert.deepEqual(metadataSaveOrder, ["first", "second"]);

{
  const { parseMessageCursor } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  assert.deepEqual(parseMessageCursor("2026-08-09T12:00:00.000Z|message%7C42"), {
    createdAt: "2026-08-09T12:00:00.000Z",
    id: "message|42",
  });
  assert.equal(parseMessageCursor("2026-08-09T12:00:00.000Z"), null, "bare timestamps are not cursors");
  assert.equal(parseMessageCursor("not-a-date|42"), null, "cursor timestamps must be valid");
  assert.equal(parseMessageCursor("2026-08-09T12:00:00.000Z|%"), null, "cursor ids must be valid URI components");
}
