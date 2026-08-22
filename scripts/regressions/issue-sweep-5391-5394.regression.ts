import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatSummaryEntry } from "../../packages/shared/src/types/chat.js";
import { getChatSummaryMessageIdsToUnhideAfterDelete } from "../../packages/shared/src/utils/chat-summary-entries.js";
import {
  customLorebookReadBehindRunKey,
  customAgentUsesLorebookBackfill,
  getCustomLorebookBackfillChunk,
  getCustomLorebookBackfillSettings,
  tryClaimCustomLorebookReadBehindRun,
} from "../../packages/server/src/routes/generate/lorebook-keeper-utils.js";
import { parseCharacterCommands } from "../../packages/server/src/services/conversation/character-commands.js";
import {
  ensureLorebookFolderPaths,
  handleProfessorMariCommand,
  MAX_LOREBOOK_FOLDER_PATH_REQUESTS,
} from "../../packages/server/src/services/generation/professor-mari-command-runtime.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const professorMariFolderCommand = parseCharacterCommands(
  '<update_lorebook>{"name":"Arcadia","folders":["Characters/Luna/Background"],"entries":[{"name":"Luna history","path":"Characters/Luna/Background","content":"Born beneath the silver moon."}]}</update_lorebook>',
).commands[0];
assert.equal(professorMariFolderCommand?.type, "update_lorebook");
if (professorMariFolderCommand?.type === "update_lorebook") {
  assert.deepEqual(professorMariFolderCommand.folders, ["Characters/Luna/Background"]);
  assert.equal(professorMariFolderCommand.entries?.[0]?.path, "Characters/Luna/Background");
}

const createdFolders: Array<{ id: string; name: string; parentFolderId: string | null }> = [];
const folderResult = await ensureLorebookFolderPaths(
  {
    async listFolders() {
      return createdFolders;
    },
    async createFolder(_lorebookId: string, input: { name: string; parentFolderId: string | null }) {
      const folder = { id: `folder-${createdFolders.length + 1}`, ...input };
      createdFolders.push(folder);
      return folder;
    },
  },
  "lorebook-1",
  ["Characters/Luna/Background", "Characters/Luna/Relationships"],
);
assert.equal(folderResult.createdCount, 4);
assert.equal(folderResult.folderIds.get("characters/luna/background"), "folder-3");

const strictFolderCommand = parseCharacterCommands(
  '<create_lorebook>{"name":"Strict paths","folders":[{},"Characters/Luna"]}</create_lorebook>',
).commands[0];
assert.equal(strictFolderCommand?.type, "create_lorebook");
if (strictFolderCommand?.type === "create_lorebook") {
  assert.deepEqual(strictFolderCommand.folders, ["Characters/Luna"]);
}

let overLimitWriteCount = 0;
await handleProfessorMariCommand({
  command: {
    type: "create_lorebook",
    name: "Too many folders",
    folders: Array.from({ length: MAX_LOREBOOK_FOLDER_PATH_REQUESTS + 1 }, (_, index) => `Folder ${index}`),
  },
  characterId: null,
  chatId: "chat-1",
  sourceChatMetadata: null,
  isHomeProfessorMariAssistantChat: true,
  db: {} as never,
  stores: {
    chars: {},
    chats: {},
    presets: {},
    lorebooksStore: {
      async create() {
        overLimitWriteCount += 1;
        return null;
      },
      async createEntry() {
        overLimitWriteCount += 1;
        return null;
      },
    },
  },
  sendAssistantAction() {},
});
assert.equal(overLimitWriteCount, 0, "An over-limit folder request must be rejected before lorebook writes");

await handleProfessorMariCommand({
  command: {
    type: "update_lorebook",
    name: "Existing book",
    folders: Array.from({ length: MAX_LOREBOOK_FOLDER_PATH_REQUESTS + 1 }, (_, index) => `Folder ${index}`),
  },
  characterId: null,
  chatId: "chat-1",
  sourceChatMetadata: null,
  isHomeProfessorMariAssistantChat: true,
  db: {} as never,
  stores: {
    chars: {},
    chats: {},
    presets: {},
    lorebooksStore: {
      async list() {
        return [{ id: "lorebook-1", name: "Existing book" }];
      },
      async update() {
        overLimitWriteCount += 1;
      },
      async updateEntry() {
        overLimitWriteCount += 1;
      },
      async createEntry() {
        overLimitWriteCount += 1;
        return null;
      },
    },
  },
  sendAssistantAction() {},
});
assert.equal(overLimitWriteCount, 0, "An over-limit folder request must be rejected before entry moves");

const messages = [
  { id: "user-1", role: "user", content: "First turn" },
  { id: "assistant-1", role: "assistant", content: "First reply" },
  { id: "user-2", role: "user", content: "Second turn" },
  { id: "assistant-2", role: "assistant", content: "Second reply" },
  { id: "user-3", role: "user", content: "Newest turn" },
];
assert.deepEqual(getCustomLorebookBackfillSettings({ lorebookBackfillEnabled: true }), {
  enabled: true,
  chunkSize: 25,
});
assert.equal(
  customAgentUsesLorebookBackfill({
    phase: "post_processing",
    isCustomAgent: true,
    settings: {
      resultType: "lorebook_update",
      lorebookBackfillEnabled: true,
      customCapabilities: { edit_lorebooks: true },
      customAgentPermissionsExplicit: true,
    },
  }),
  true,
);
assert.deepEqual(
  getCustomLorebookBackfillChunk(messages, 0, null, 1)?.messages.map((message) => message.id),
  ["assistant-1"],
);
assert.deepEqual(
  getCustomLorebookBackfillChunk(messages, 0, "assistant-1", 1)?.messages.map((message) => message.id),
  ["assistant-2"],
);
assert.equal(
  getCustomLorebookBackfillChunk(messages, 0, null, 3)?.target.id,
  "assistant-1",
  "Backfill chunk size counts chat messages rather than assistant replies",
);
const visibleMessages = messages.filter((message) => message.id !== "assistant-1");
assert.equal(
  getCustomLorebookBackfillChunk(visibleMessages, 0, "assistant-1", 1, messages)?.target.id,
  "assistant-2",
  "A hidden cursor keeps its position from unfiltered history",
);
assert.equal(
  getCustomLorebookBackfillChunk(visibleMessages, 0, "missing-cursor", 1, messages),
  null,
  "An unknown cursor must not restart backfill",
);

const longGapMessages = [
  ...Array.from({ length: 150 }, (_, index) => ({ id: `user-gap-${index}`, role: "user", content: "Continue" })),
  { id: "assistant-after-gap", role: "assistant", content: "Finally" },
];
assert.equal(getCustomLorebookBackfillChunk(longGapMessages, 0, null, 1)?.messages.length, 1);
assert.equal(getCustomLorebookBackfillChunk(longGapMessages, 0, null, 1)?.target.id, "assistant-after-gap");

const backfillRuns = new Set<string>();
const firstBackfillLease = customLorebookReadBehindRunKey("chat-1", "agent-1", "assistant-1");
const nextBackfillLease = customLorebookReadBehindRunKey("chat-1", "agent-1", "assistant-2");
assert.equal(firstBackfillLease, nextBackfillLease, "The backfill lease must cover the chat and agent, not one target");
assert.equal(tryClaimCustomLorebookReadBehindRun(backfillRuns, firstBackfillLease), true);
assert.equal(tryClaimCustomLorebookReadBehindRun(backfillRuns, nextBackfillLease), false);

const summaryEntries = [
  { id: "source-a", enabled: true, hiddenMessageIds: ["message-a", "message-shared"] },
  { id: "source-b", enabled: true, hiddenMessageIds: ["message-b"] },
  { id: "retained", enabled: true, hiddenMessageIds: ["message-shared", "message-retained"] },
] as ChatSummaryEntry[];
assert.deepEqual(
  getChatSummaryMessageIdsToUnhideAfterDelete(summaryEntries, new Set(["source-a", "source-b"])).sort(),
  ["message-a", "message-b"],
);

const summaryPopoverSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/client/src/components/chat/SummaryPopover.tsx"),
  "utf8",
);
assert.match(summaryPopoverSource, /deleteSummaryEntry\.mutateAsync\(\{ chatId, entryIds \}\)/u);
assert.match(summaryPopoverSource, /new Set\(visiblePersistedEntries\.map\(\(entry\) => entry\.id\)\)/u);

const chatRoutesSource = readFileSync(join(REPOSITORY_ROOT, "packages/server/src/routes/chats.routes.ts"), "utf8");
assert.match(chatRoutesSource, /withChatMetadataPatchQueue\(req\.params\.id,[\s\S]*metadataQueueHeld: true/u);

const retryRouteSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/server/src/routes/generate/retry-agents-route.ts"),
  "utf8",
);
assert.match(retryRouteSource, /toolName === "save_lorebook_entry"/u);
assert.match(
  retryRouteSource,
  /await applyRetryResultEffects\([\s\S]*CUSTOM_LOREBOOK_BACKFILL_CURSOR_KEY/u,
  "Backfill effects must finish before cursor advancement",
);

console.info("Issue sweep #5391/#5394 regression checks passed");
