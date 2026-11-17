// Default chat settings profiles: repairing duplicate built-ins leaves one active default, keeps chats' references
// working and can run again, and legacy profile targets still apply. Runs on a fresh database in a temporary folder.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chatPresets, chats } from "../../../packages/server/src/db/schema/index.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-settings-profile-defaults-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  const originalConversationDefault = await chatPresetStorage.getDefault("conversation");
  assert.ok(originalConversationDefault, "Conversation mode must start with a Default settings profile");
  await db
    .update(chatPresets)
    .set({ name: "Broken Default", settings: JSON.stringify({ connectionId: "must-be-reset" }) })
    .where(eq(chatPresets.id, originalConversationDefault.id));
  await db.insert(chatPresets).values({
    id: "duplicate-conversation-default",
    name: "Default Copy",
    mode: "conversation",
    isDefault: "true",
    isActive: "true",
    settings: JSON.stringify({ connectionId: "must-be-reset" }),
    createdAt: "9999-12-31T23:59:59.000Z",
    updatedAt: "9999-12-31T23:59:59.000Z",
  });
  const duplicateDefaultChatId = "duplicate-default-profile-reference";
  await db.insert(chats).values({
    id: duplicateDefaultChatId,
    name: "Duplicate Default profile reference",
    mode: "conversation",
    characterIds: "[]",
    metadata: JSON.stringify({ appliedChatPresetId: "duplicate-conversation-default", preserved: true }),
    sortOrder: 0,
    createdAt: "2026-08-02T06:00:00.000Z",
    updatedAt: "2026-08-02T06:00:00.000Z",
  });
  await chatPresetStorage.ensureDefaults();
  const normalizedConversationProfiles = await chatPresetStorage.listByMode("conversation");
  assert.equal(
    normalizedConversationProfiles.filter((profile) => profile.isDefault).length,
    1,
    "Default settings profile repair must remove duplicate built-ins",
  );
  assert.equal(
    normalizedConversationProfiles.filter((profile) => profile.isActive).length,
    1,
    "Default settings profile repair must leave exactly one active profile",
  );
  assert.deepEqual(await chatPresetStorage.getDefault("conversation"), {
    ...originalConversationDefault,
    name: "Default",
    isActive: true,
    settings: {},
  });
  const reboundDefaultChat = (await db.select().from(chats).where(eq(chats.id, duplicateDefaultChatId)))[0];
  assert.ok(reboundDefaultChat);
  assert.deepEqual(JSON.parse(reboundDefaultChat.metadata), {
    appliedChatPresetId: originalConversationDefault.id,
    preserved: true,
  });
  assert.ok(
    await chatPresetStorage.getById(JSON.parse(reboundDefaultChat.metadata).appliedChatPresetId),
    "Rebound chat profile references must remain resolvable after duplicate cleanup",
  );
  await chatPresetStorage.ensureDefaults();
  assert.equal(
    (await chatPresetStorage.listByMode("conversation")).filter((profile) => profile.isDefault).length,
    1,
    "Default settings profile repair must be idempotent",
  );
  await db.insert(chatPresets).values({
    id: "legacy-branch-profile",
    name: "Legacy branch profile",
    mode: "roleplay",
    isDefault: "false",
    isActive: "false",
    settings: JSON.stringify({
      metadata: {
        enableAgents: false,
        branchName: "Foreign branch",
        branchParentChatId: "foreign-chat",
        branchParentMessageId: "foreign-message",
        branchMessageId: "foreign-copy",
      },
    }),
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
  });
  await db.insert(chats).values({
    id: "legacy-profile-target-chat",
    name: "Legacy profile target",
    mode: "roleplay",
    characterIds: "[]",
    metadata: JSON.stringify({ enableAgents: true }),
    sortOrder: 0,
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-10T09:00:00.000Z",
  });
  const legacyProfileTarget = await chatPresetStorage.applyToChat(
    "legacy-branch-profile",
    "legacy-profile-target-chat",
  );
  assert.ok(legacyProfileTarget, "A same-mode legacy profile must remain applicable");
  const legacyProfileTargetMetadata = JSON.parse(legacyProfileTarget.metadata) as Record<string, unknown>;
  assert.equal(legacyProfileTargetMetadata.enableAgents, false);
  for (const key of ["branchName", "branchParentChatId", "branchParentMessageId", "branchMessageId"]) {
    assert.equal(
      Object.hasOwn(legacyProfileTargetMetadata, key),
      false,
      `Legacy profile application must strip ${key}`,
    );
  }
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}
