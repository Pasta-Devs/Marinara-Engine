// What a settings profile ("Saved Settings") holds (#8957). The Author's Notes belong to one chat, so a profile
// never saves them and applying one, even a profile saved before this change that still holds a note, keeps the
// chat's own. The choices made for the prompt preset's variables are saved with the preset they were made for, and
// reach only a chat that ends up on that preset: by hand, as a follower, or as a scene with its own preset.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-profile-scope-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../packages/server/src/routes/chat-presets.routes.js");
const { createChatPresetsStorage } = await import("../../packages/server/src/services/storage/chat-presets.storage.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { chats } = await import("../../packages/server/src/db/schema/chats.js");
const { chatPresets } = await import("../../packages/server/src/db/schema/chat-presets.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { advanceStarredProfileDraft } = await import("../../packages/client/src/lib/chat-setup-draft.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });
const profiles = createChatPresetsStorage(db);
const chatsStorage = createChatsStorage(db);

type Row = { id: string; promptPresetId: string | null; metadata: string };
const readRow = async (id: string) => ((await db.select().from(chats).where(eq(chats.id, id))) as Row[])[0]!;
const readMeta = async (id: string) => JSON.parse((await readRow(id)).metadata) as Record<string, unknown>;
const inject = async (method: "GET" | "POST" | "PUT", url: string, payload?: unknown) => {
  const response = await app.inject({ method, url, payload: payload as never });
  assert.ok(response.statusCode < 300, `${method} ${url} -> ${response.statusCode} ${response.body}`);
  return response.json();
};
const createChat = async (name: string, promptPresetId: string | null, metadata: Record<string, unknown>) => {
  const id = (await inject("POST", "/api/chats", { name, mode: "roleplay", characterIds: [] })).id as string;
  await db
    .update(chats)
    .set({ promptPresetId, metadata: JSON.stringify({ ...(await readMeta(id)), ...metadata }) })
    .where(eq(chats.id, id));
  return id;
};
const applyByHand = async (profileId: string, chatId: string) => {
  const chat = await inject("POST", `/api/chat-presets/${profileId}/apply/${chatId}`);
  return { promptPresetId: chat.promptPresetId as string | null, meta: JSON.parse(chat.metadata) };
};
/** The snapshot Chat Settings saves into a profile (snapshotCurrentPresetSettings). */
const snapshot = async (chatId: string) => {
  const row = await readRow(chatId);
  const metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  return {
    connectionId: null,
    promptPresetId: row.promptPresetId,
    ...(row.promptPresetId && {
      presetVariables: { presetId: row.promptPresetId, choices: metadata.presetChoices ?? {} },
    }),
    metadata,
  };
};
const insertOldProfile = async (id: string, settings: Record<string, unknown>) => {
  const ts = new Date().toISOString();
  await db.insert(chatPresets).values({
    id,
    name: id,
    mode: "roleplay",
    isDefault: "false",
    isActive: "false",
    settings: JSON.stringify(settings),
    createdAt: ts,
    updatedAt: ts,
  });
};

const darkChoices = { tone: "dark", genres: ["horror", "noir"] };

try {
  // ── Author's Notes stay with the chat ──
  const noteSource = await createChat("Note source", null, {
    authorNotes: "Keep the tone dark.",
    authorNotesDepth: 2,
    contextMessageLimit: 30,
  });
  const noteProfile = await inject("POST", "/api/chat-presets", { name: "Notes", mode: "roleplay", settings: {} });
  const savedNotes = await inject("PUT", `/api/chat-presets/${noteProfile.id}/settings`, await snapshot(noteSource));
  assert.equal(savedNotes.settings.metadata.contextMessageLimit, 30, "the profile still saves chat settings");
  assert.equal("authorNotes" in savedNotes.settings.metadata, false, "the profile leaves out the Author's Notes");
  assert.equal("authorNotesDepth" in savedNotes.settings.metadata, false, "and their depth");
  const created = await inject("POST", "/api/chat-presets", {
    name: "New from chat",
    mode: "roleplay",
    settings: await snapshot(noteSource),
  });
  assert.equal("authorNotes" in created.settings.metadata, false, "a new profile from the chat leaves them out too");

  // A profile saved before the fix still holds a note on disk. Reading, exporting and applying it never use it.
  await insertOldProfile("old-with-note", {
    metadata: { authorNotes: "Old profile note.", authorNotesDepth: 9, contextMessageLimit: 12 },
  });
  const oldRead = await inject("GET", "/api/chat-presets/old-with-note");
  assert.equal("authorNotes" in oldRead.settings.metadata, false, "an old profile's note is not read back");
  const oldExport = await inject("GET", "/api/chat-presets/old-with-note/export");
  assert.equal("authorNotes" in oldExport.data.settings.metadata, false, "or exported");
  const withNote = await createChat("Has a note", null, { authorNotes: "My own note.", authorNotesDepth: 3 });
  const oldApplied = await applyByHand("old-with-note", withNote);
  assert.equal(oldApplied.meta.contextMessageLimit, 12, "the old profile's settings still apply");
  assert.equal(oldApplied.meta.authorNotes, "My own note.", "applying an old profile keeps the chat's Author's Notes");
  assert.equal(oldApplied.meta.authorNotesDepth, 3, "and their depth");
  const withoutNote = await createChat("No note", null, {});
  const noNoteApplied = await applyByHand("old-with-note", withoutNote);
  assert.equal("authorNotes" in noNoteApplied.meta, false, "a chat without a note does not get the old profile's");
  assert.equal("authorNotesDepth" in noNoteApplied.meta, false);
  // Both chats now follow the old profile. Updating them from it keeps each chat's own note, or none.
  const noteFollowers = await profiles.applyToFollowers("old-with-note", null);
  assert.ok(noteFollowers.chatIds.includes(withNote) && noteFollowers.chatIds.includes(withoutNote));
  assert.equal((await readMeta(withNote)).authorNotes, "My own note.", "a follower keeps its Author's Notes");
  assert.equal("authorNotes" in (await readMeta(withoutNote)), false, "and a follower without one gets none");

  // ── Preset variable choices travel with their preset ──
  const source = await createChat("Variables source", "preset-a", { presetChoices: darkChoices });
  const variablesProfile = await inject("POST", "/api/chat-presets", { name: "Dark", mode: "roleplay", settings: {} });
  const savedVariables = await inject(
    "PUT",
    `/api/chat-presets/${variablesProfile.id}/settings`,
    await snapshot(source),
  );
  assert.deepEqual(
    savedVariables.settings.presetVariables,
    { presetId: "preset-a", choices: darkChoices },
    "the profile saves the preset variable choices with their preset",
  );
  assert.equal("presetChoices" in savedVariables.settings.metadata, false, "not as a plain chat setting");

  // Applying by hand moves the chat to the profile's preset and gives it those choices.
  const target = await createChat("Target", "preset-b", { presetChoices: { tone: "light" } });
  const applied = await applyByHand(variablesProfile.id, target);
  assert.equal(applied.promptPresetId, "preset-a");
  assert.deepEqual(applied.meta.presetChoices, darkChoices, "the choices come back with the preset");

  // Exported files leave them out: prompt preset ids are per install, and released versions refuse unknown keys.
  const envelope = await inject("GET", `/api/chat-presets/${variablesProfile.id}/export`);
  assert.equal(envelope.data.settings.promptPresetId, "preset-a");
  assert.equal("presetVariables" in envelope.data.settings, false, "an exported file holds no preset choices");
  const withChoices = structuredClone(envelope);
  withChoices.data.settings.presetVariables = { presetId: "preset-a", choices: darkChoices };
  const imported = await inject("POST", "/api/chat-presets/import", withChoices);
  assert.equal("presetVariables" in imported.settings, false, "and an imported file brings none");

  // Choices made for another preset are never stored or applied: the profile builder switched the preset.
  const switched = await inject("POST", "/api/chat-presets", {
    name: "Switched preset",
    mode: "roleplay",
    settings: { ...(await snapshot(source)), promptPresetId: "preset-b" },
  });
  assert.equal(switched.settings.promptPresetId, "preset-b");
  assert.equal(
    "presetVariables" in switched.settings,
    false,
    "choices for preset A are dropped from a preset B profile",
  );
  const ownChoices = await createChat("Own choices", "preset-c", { presetChoices: { tone: "light" } });
  const switchedApplied = await applyByHand(switched.id, ownChoices);
  assert.equal(switchedApplied.promptPresetId, "preset-b");
  assert.deepEqual(switchedApplied.meta.presetChoices, { tone: "light" }, "preset A's choices are not applied");
  // A stored profile edited by hand to mismatch is cleaned the same way when read.
  await insertOldProfile("mismatched", {
    promptPresetId: "preset-b",
    presetVariables: { presetId: "preset-a", choices: darkChoices },
  });
  assert.equal("presetVariables" in (await inject("GET", "/api/chat-presets/mismatched")).settings, false);
  // Malformed choices are dropped without failing the save.
  const malformed = await inject("PUT", `/api/chat-presets/${switched.id}/settings`, {
    promptPresetId: "preset-a",
    presetVariables: { presetId: "preset-a", choices: { tone: 5 } },
  });
  assert.equal("presetVariables" in malformed.settings, false, "malformed choices are not saved");

  // A profile saved before it held choices leaves the chat's own, even on the same preset.
  await insertOldProfile("old-without-choices", { promptPresetId: "preset-a", metadata: { contextMessageLimit: 8 } });
  const samePreset = await createChat("Same preset", "preset-a", { presetChoices: { tone: "light" } });
  const oldChoicesApplied = await applyByHand("old-without-choices", samePreset);
  assert.deepEqual(oldChoicesApplied.meta.presetChoices, { tone: "light" }, "an old profile keeps the chat's choices");

  // Followers keep their own preset, so they get the choices only when they are on the profile's preset.
  const followerSame = await createChat("Follower on A", "preset-a", { presetChoices: { tone: "light" } });
  const followerOther = await createChat("Follower on Z", "preset-z", { presetChoices: { mood: "calm" } });
  for (const id of [followerSame, followerOther]) {
    await db
      .update(chats)
      .set({ metadata: JSON.stringify({ ...(await readMeta(id)), appliedChatPresetId: variablesProfile.id }) })
      .where(eq(chats.id, id));
  }
  const followers = await profiles.applyToFollowers(variablesProfile.id, null);
  assert.ok(followers.chatIds.includes(followerSame) && followers.chatIds.includes(followerOther));
  assert.deepEqual((await readMeta(followerSame)).presetChoices, darkChoices, "a follower on preset A gets them");
  assert.equal((await readRow(followerOther)).promptPresetId, "preset-z", "a follower keeps its own preset");
  assert.deepEqual((await readMeta(followerOther)).presetChoices, { mood: "calm" }, "and its own choices for it");

  // A scene keeps the prompt preset picked for it; the profile's choices apply only if they were saved for it.
  const sceneOther = await createChat("Scene on S", "preset-s", {});
  const sceneOtherRow = await profiles.applyToChat(variablesProfile.id, sceneOther, { promptPresetId: "preset-s" });
  assert.equal(sceneOtherRow?.promptPresetId, "preset-s");
  assert.equal("presetChoices" in JSON.parse(sceneOtherRow!.metadata), false, "another preset gets none of them");
  const sceneSame = await createChat("Scene on A", "preset-a", {});
  const sceneSameRow = await profiles.applyToChat(variablesProfile.id, sceneSame, { promptPresetId: "preset-a" });
  assert.deepEqual(JSON.parse(sceneSameRow!.metadata).presetChoices, darkChoices, "the same preset gets them");

  // The new-chat wizard's copy of an automatic profile apply matches the server, so an untouched chat stays disposable.
  const fresh = await chatsStorage.create({ name: "New setup", mode: "roleplay", characterIds: [] });
  assert.ok(fresh);
  const initial = {
    ...fresh,
    connectionId: fresh.connectionId ?? null,
    promptPresetId: fresh.promptPresetId ?? null,
    metadata: JSON.parse(fresh.metadata ?? "{}"),
    characterIds: JSON.parse(fresh.characterIds ?? "[]"),
  };
  const profile = (await profiles.getById(variablesProfile.id))!;
  const raw = (await profiles.applyToChat(profile.id, initial.id))!;
  const baseline = advanceStarredProfileDraft(
    initial,
    { ...initial, ...raw, metadata: JSON.parse(raw.metadata) },
    profile,
  );
  assert.deepEqual(baseline.metadata.presetChoices, darkChoices, "the wizard's copy has the profile's choices");
  assert.equal(await chatsStorage.removeEmptySetupChat(initial.id, baseline), true, "and matches the server exactly");

  console.info("Settings profiles leave out Author's Notes and keep preset variable choices with their preset.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
