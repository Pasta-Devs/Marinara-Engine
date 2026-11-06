import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-empty-setup-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { chats: table, promptPresets, memoryChunks } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { advanceChatSetupDraft, advanceStarredProfileDraft } =
  await import("../../packages/client/src/lib/chat-setup-draft.js");
const { createChatPresetsStorage } = await import("../../packages/server/src/services/storage/chat-presets.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { TRANSLATOR_SETTINGS_KEYS, normalizeTranslatorSettings } = await import("../../packages/shared/src/index.js");
const db = await getDB();
const profiles = createChatPresetsStorage(db);
const storage = createChatsStorage(db);
async function fixture(mode: "conversation" | "roleplay" | "game" = "roleplay") {
  const chat = await storage.create({ name: "New setup", mode, characterIds: [] });
  assert(chat);
  return {
    ...chat,
    connectionId: chat.connectionId ?? null,
    promptPresetId: chat.promptPresetId ?? null,
    metadata: JSON.parse(chat.metadata ?? "{}"),
    characterIds: JSON.parse(chat.characterIds ?? "[]"),
  };
}
try {
  for (const mode of ["conversation", "roleplay", "game"] as const) {
    const initial = await fixture(mode);
    assert.equal(await storage.removeEmptySetupChat(initial.id, initial), true, `${mode}: untouched draft removed`);
    assert.equal(await storage.getById(initial.id), null);
    assert.equal(await storage.removeEmptySetupChat(initial.id, initial), false, "repeat is harmless");
  }
  for (const patch of [
    { name: "Configured title" },
    { connectionId: "chosen-connection" },
    { personaId: "chosen-persona" },
    { personaCharacterId: "chosen-character-identity" },
    { characterIds: JSON.stringify(["chosen-character"]) },
    { folderId: "filed" },
    { groupId: "branch-group" },
    { connectedChatId: "partner" },
    { sortOrder: 5 },
    { metadata: JSON.stringify({ activeLorebookIds: ["selected-book"] }) },
    { promptPresetId: "custom-preset" },
  ]) {
    const initial = await fixture();
    await db.update(table).set(patch).where(eq(table.id, initial.id));
    assert.equal(await storage.removeEmptySetupChat(initial.id, initial), false, JSON.stringify(patch));
    assert(await storage.getById(initial.id), "configured chat retained");
  }
  const withMessage = await fixture();
  await storage.createMessage({ chatId: withMessage.id, role: "system", content: "Meaningful saved content" });
  assert.equal(await storage.removeEmptySetupChat(withMessage.id, withMessage), false, "even system messages retained");
  const withMemory = await fixture();
  await db.insert(memoryChunks).values({
    id: "imported-memory",
    chatId: withMemory.id,
    content: "Imported memories must survive",
    messageCount: 2,
    sourceChatId: "another-chat",
    firstMessageAt: withMemory.createdAt,
    lastMessageAt: withMemory.createdAt,
    createdAt: withMemory.createdAt,
  });
  assert.equal(
    await storage.removeEmptySetupChat(withMemory.id, withMemory),
    false,
    "imported memory is durable content",
  );
  assert(await storage.getById(withMemory.id));
  const withTrash = await fixture();
  const trashed = await storage.createMessage({ chatId: withTrash.id, role: "user", content: "Restorable content" });
  assert(trashed);
  const { createMessageTrashStorage } =
    await import("../../packages/server/src/services/storage/message-trash.storage.js");
  await createMessageTrashStorage(db).trashMessages(withTrash.id, [trashed.id]);
  await storage.removeMessage(trashed.id);
  assert.equal(await storage.removeEmptySetupChat(withTrash.id, withTrash), false, "trash rows are durable content");
  assert(await storage.getById(withTrash.id));
  const wrongId = await fixture();
  assert.equal(await storage.removeEmptySetupChat(wrongId.id, { ...wrongId, id: "another" }), false);
  assert.equal(await storage.removeEmptySetupChat(wrongId.id, { ...wrongId, createdAt: "older" }), false);
  const autoPreset = await fixture();
  await db.insert(promptPresets).values({
    id: "default-preset",
    name: "Default",
    isDefault: "true",
    createdAt: autoPreset.createdAt,
    updatedAt: autoPreset.createdAt,
  });
  await db.update(table).set({ promptPresetId: "default-preset" }).where(eq(table.id, autoPreset.id));
  assert.equal(
    await storage.removeEmptySetupChat(autoPreset.id, autoPreset),
    true,
    "automatic default is not user input",
  );
  const game = await fixture("game");
  await db
    .update(table)
    .set({ metadata: JSON.stringify({ gameId: "existing-world" }) })
    .where(eq(table.id, game.id));
  const gameSnapshot = { ...game, metadata: { gameId: "existing-world" } };
  assert.equal(await storage.removeEmptySetupChat(game.id, gameSnapshot), false, "campaign guard cannot be bypassed");
  const race = await fixture();
  // A transaction already saving a message must commit before cancellation may inspect emptiness.
  let started!: () => void;
  const saved = new Promise<void>((resolve) => {
    started = resolve;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = db.transaction(async () => {
    started();
    await gate;
    await storage.createMessage({ chatId: race.id, role: "user", content: "Saved before cancel" });
  });
  await saved;
  const cancel = storage.removeEmptySetupChat(race.id, race);
  release();
  await write;
  assert.equal(await cancel, false, "queued cancellation sees the committed message");
  assert(await storage.getById(race.id));
  for (const edited of [false, true]) {
    const initial = await fixture();
    await storage.update(initial.id, { connectionId: "automatic-connection" });
    if (edited) {
      await storage.update(initial.id, { name: "Real user title" });
      await storage.patchMetadata(initial.id, { customSystemPrompt: "Real user setting" });
    }
    await storage.patchMetadata(initial.id, { contextMessageLimit: 17 });
    const raw = await storage.getById(initial.id);
    assert(raw);
    const response = { ...initial, ...raw, characterIds: [], metadata: JSON.parse(raw.metadata ?? "{}") };
    const baseline = advanceChatSetupDraft(initial, response, ["connectionId"], ["contextMessageLimit"]);
    assert.equal(baseline.name, initial.name, "automatic response never blesses another writer's name");
    assert.equal(baseline.metadata.customSystemPrompt, undefined, "unrelated user metadata stays outside baseline");
    assert.deepEqual(Object.keys(baseline.metadata.metadataWriteOrdinals), ["contextMessageLimit"]);
    assert.equal(
      await storage.removeEmptySetupChat(initial.id, baseline),
      !edited,
      "automatic defaults are accepted; unrelated real user writes are protected",
    );
  }
  await createAppSettingsStorage(db).set(
    "translator-defaults",
    JSON.stringify({ translationProvider: "ai", translationTargetLang: "pl", translateInput: true }),
  );
  const profile = await profiles.create({
    name: "Starred",
    mode: "roleplay",
    settings: {
      connectionId: "automatic-profile-connection",
      metadata: { contextMessageLimit: 23, enableTools: true },
    },
  });
  assert(profile);
  for (const edited of [false, true]) {
    const initial = await fixture();
    if (edited)
      await storage.patchMetadata(initial.id, {
        summary: "Real user history",
        activeAgentIds: ["user-selected-agent"],
        advancedMemory: { knowledgeConfirmed: true },
      });
    const raw = await profiles.applyToChat(profile.id, initial.id);
    assert(raw);
    const response = { ...initial, ...raw, characterIds: [], metadata: JSON.parse(raw.metadata ?? "{}") };
    // The profile apply endpoint returns the real storage-encoded metadata string.
    const encodedResponse = { ...response, metadata: raw.metadata as unknown as typeof response.metadata };
    const baseline = advanceStarredProfileDraft(initial, encodedResponse, profile);
    assert.equal(baseline.metadata.translationTargetLang, "pl", "installed translator defaults remain automatic");
    assert.equal(baseline.metadata.summary, null, "preserved response history never becomes automatic baseline");
    assert.deepEqual(baseline.metadata.activeAgentIds, [], "preserved user agent selection stays outside baseline");
    assert.equal(baseline.metadata.advancedMemory, undefined, "chat-owned memory setup stays outside baseline");
    assert.equal(await storage.removeEmptySetupChat(initial.id, baseline), !edited, "starred profile ownership guard");
  }
  for (const metadata of [
    { translationProvider: "unrecognized" },
    { translateInput: "true" },
    { translationPrompt: { text: "invalid" } },
    { translationTargetLang: 42 },
    { translationTargetLang: "de" },
  ]) {
    const profile = await profiles.create({
      name: "Translator normalization",
      mode: "roleplay",
      settings: { metadata },
    });
    assert(profile);
    const initial = await fixture();
    const raw = await profiles.applyToChat(profile.id, initial.id);
    assert(raw);
    const response = {
      ...initial,
      ...raw,
      characterIds: [],
      metadata: raw.metadata as unknown as typeof initial.metadata,
    };
    const baseline = advanceStarredProfileDraft(initial, response, profile);
    assert.deepEqual(
      Object.fromEntries(
        TRANSLATOR_SETTINGS_KEYS.filter((key) => key in baseline.metadata).map((key) => [key, baseline.metadata[key]]),
      ),
      normalizeTranslatorSettings(raw.metadata),
      "raw invalid profile values never override the writer's normalized translator settings or legacy back-fill",
    );
    assert.equal(
      await storage.removeEmptySetupChat(initial.id, baseline),
      true,
      "normalized automatic profile remains disposable",
    );
  }
  const participant = await fixture();
  const populated = await storage.update(participant.id, { characterIds: ["auto-selected-participant"] });
  assert(populated);
  const populatedBaseline = advanceChatSetupDraft(
    participant,
    {
      ...participant,
      ...populated,
      characterIds: ["auto-selected-participant"],
      metadata: JSON.parse(populated.metadata ?? "{}"),
    },
    ["characterIds"],
  );
  assert.equal(
    await storage.removeEmptySetupChat(participant.id, populatedBaseline),
    false,
    "even an advanced automatic baseline cannot discard populated participants",
  );
  console.log(
    "Empty setup: all modes, configured/associated chats, memory/messages, defaults, campaign protection, queued writes and automatic-baseline/user-write races passed.",
  );
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
