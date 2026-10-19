// The chat settings that send chat text to an address outside the app, or hold the key for one (the
// Discord mirror, the DeepLX address, the DeepL key and the haptics device server), stay on the install
// where the user entered them. Chat logs, settings profiles and full profiles are exported without them,
// and importing one never sets them: a chat log or profile made elsewhere must not choose where this
// install sends its chats. Profiles saved on this install still keep them, and a chat, settings profile
// or translator default restored over this install's own keeps its values.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-local-destination-security-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { chatPresetsRoutes } = await import("../../packages/server/src/routes/chat-presets.routes.js");
const { backupRoutes, sanitizeProfileTableRows } = await import("../../packages/server/src/routes/backup.routes.js");
const { importSTChat } = await import("../../packages/server/src/services/import/st-chat.importer.js");
const { createChatPresetsStorage } = await import("../../packages/server/src/services/storage/chat-presets.storage.js");
const { createAppSettingsStorage } = await import("../../packages/server/src/services/storage/app-settings.storage.js");
const { getChatTranslationConfig, TRANSLATOR_DEFAULTS_SETTINGS_KEY } = await import(
  "../../packages/shared/src/index.js"
);
const schema = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(chatPresetsRoutes, { prefix: "/api/chat-presets" });
await app.register(backupRoutes, { prefix: "/api/backup" });
await app.ready();

type Row = Record<string, unknown>;
const outside = {
  discordWebhookUrl: "https://discord.com/api/webhooks/111111111111111111/outsideToken",
  translationDeeplxUrl: "https://translate.outside.example/",
  translationDeeplApiKey: "outside-deepl-key:fx",
  hapticIntifaceUrl: "ws://192.0.2.10:12345",
};
const own = {
  discordWebhookUrl: "https://discord.com/api/webhooks/222222222222222222/ownToken",
  translationDeeplxUrl: "http://127.0.0.1:1188/",
  translationDeeplApiKey: "own-deepl-key:fx",
  hapticIntifaceUrl: "ws://127.0.0.1:12345",
};
// Ordinary settings that travel with chats and profiles as before.
const settings = { autoTranslate: true, translationProvider: "deeplx", contextMessageLimit: 42 };
const destinationKeys = Object.keys(outside);

const assertNoDestinations = (metadata: Row | undefined, where: string) => {
  assert.ok(metadata, `${where}: metadata is missing`);
  for (const key of destinationKeys) assert.equal(metadata[key], undefined, `${where} must not carry ${key}`);
  assert.equal(getChatTranslationConfig("check", metadata).deeplxUrl, undefined, `${where}: translator address`);
};
const assertSettingsKept = (metadata: Row | undefined, where: string) => {
  for (const [key, value] of Object.entries(settings)) assert.equal(metadata?.[key], value, `${where} keeps ${key}`);
};
const chatRow = async (id: string) => ((await db.select().from(schema.chats).where(eq(schema.chats.id, id))) as Row[])[0];
const chatMeta = async (id: string) => JSON.parse(String((await chatRow(id))?.metadata ?? "{}")) as Row;
const presetRow = async (id: string) =>
  ((await db.select().from(schema.chatPresets).where(eq(schema.chatPresets.id, id))) as Row[])[0];
const presetMeta = async (id: string) =>
  (JSON.parse(String((await presetRow(id))?.settings ?? "{}")) as { metadata?: Row }).metadata;
const injectOk = async (options: Record<string, unknown>) => {
  const response = await app.inject(options);
  assert.equal(response.statusCode, 200, response.body);
  return response;
};

try {
  // A chat on this install, with its own outside addresses and ordinary settings.
  const created = await injectOk({
    method: "POST",
    url: "/api/chats",
    payload: { name: "Own chat", mode: "roleplay", characterIds: [] },
  });
  const ownChatId = created.json().id as string;
  await injectOk({ method: "PATCH", url: `/api/chats/${ownChatId}/metadata`, payload: { ...own, ...settings } });
  await injectOk({
    method: "POST",
    url: `/api/chats/${ownChatId}/messages`,
    payload: { role: "user", content: "Hello there." },
  });
  assert.equal((await chatMeta(ownChatId)).discordWebhookUrl, own.discordWebhookUrl, "the owner sets the mirror");

  // ── Chat log: exported without the addresses, and an imported log cannot set them ──
  const exported = (await injectOk({ method: "GET", url: `/api/chats/${ownChatId}/export?format=jsonl` })).body;
  const [headerLine, ...messageLines] = exported.split("\n");
  const header = JSON.parse(headerLine!) as { chat_metadata: { marinara_metadata: Row } };
  assertNoDestinations(header.chat_metadata.marinara_metadata, "an exported chat log");
  assertSettingsKept(header.chat_metadata.marinara_metadata, "an exported chat log");
  assert.doesNotMatch(exported, /ownToken|own-deepl-key/u, "an exported chat log must not contain the owner's keys");

  header.chat_metadata.marinara_metadata = { ...header.chat_metadata.marinara_metadata, ...outside };
  const importedLog = [JSON.stringify(header), ...messageLines].join("\n");
  const imported = (await importSTChat(importedLog, db, {})) as { chatId?: string };
  assert.ok(imported.chatId, JSON.stringify(imported));
  const importedMeta = await chatMeta(imported.chatId);
  assertNoDestinations(importedMeta, "a chat imported from a log");
  assertSettingsKept(importedMeta, "a chat imported from a log");

  // ── Settings profile: a profile saved here keeps the mirror, but files neither carry nor bring it ──
  const presets = createChatPresetsStorage(db);
  const ownProfile = await presets.create({
    name: "Own profile",
    mode: "roleplay",
    settings: { metadata: { ...own, ...settings } },
  });
  assert.equal(
    (await presetMeta(ownProfile.id))?.discordWebhookUrl,
    own.discordWebhookUrl,
    "a profile saved on this install keeps its Discord mirror",
  );
  const profileExport = await injectOk({ method: "GET", url: `/api/chat-presets/${ownProfile.id}/export` });
  assertNoDestinations(profileExport.json().data.settings.metadata, "an exported settings profile");
  assertSettingsKept(profileExport.json().data.settings.metadata, "an exported settings profile");
  assert.doesNotMatch(profileExport.body, /ownToken|own-deepl-key/u);

  const profileImport = await injectOk({
    method: "POST",
    url: "/api/chat-presets/import",
    payload: {
      type: "marinara_chat_settings_profile",
      version: 1,
      exportedAt: new Date(0).toISOString(),
      data: { name: "Shared profile", mode: "roleplay", settings: { metadata: { ...outside, ...settings } } },
    },
  });
  const importedProfileId = profileImport.json().id as string;
  assertNoDestinations(profileImport.json().settings.metadata, "an imported settings profile");
  assertNoDestinations(await presetMeta(importedProfileId), "a stored imported settings profile");
  assertSettingsKept(await presetMeta(importedProfileId), "an imported settings profile");

  const target = await injectOk({
    method: "POST",
    url: "/api/chats",
    payload: { name: "Profile target", mode: "roleplay", characterIds: [] },
  });
  const targetId = target.json().id as string;
  await injectOk({ method: "POST", url: `/api/chat-presets/${importedProfileId}/apply/${targetId}` });
  assertNoDestinations(await chatMeta(targetId), "a chat given an imported settings profile");
  assertSettingsKept(await chatMeta(targetId), "a chat given an imported settings profile");

  // ── Full profile: exported without them; an import brings none and keeps this install's own ──
  const appSettings = createAppSettingsStorage(db);
  await appSettings.set(TRANSLATOR_DEFAULTS_SETTINGS_KEY, JSON.stringify({ ...settings, ...own }));
  const exportedRows = {
    chats: sanitizeProfileTableRows("chats", [(await chatRow(ownChatId))!]),
    chat_presets: sanitizeProfileTableRows("chat_presets", [(await presetRow(ownProfile.id))!]),
    app_settings: sanitizeProfileTableRows(
      "app_settings",
      (await db.select().from(schema.appSettings)) as Row[],
    ).filter((row) => row.key === TRANSLATOR_DEFAULTS_SETTINGS_KEY),
  };
  assertNoDestinations(JSON.parse(String(exportedRows.chats[0]?.metadata)), "a chat in a full profile export");
  assertNoDestinations(
    JSON.parse(String(exportedRows.chat_presets[0]?.settings)).metadata,
    "a settings profile in a full profile export",
  );
  assertNoDestinations(
    JSON.parse(String(exportedRows.app_settings[0]?.value)),
    "translator defaults in a full profile export",
  );
  assert.doesNotMatch(JSON.stringify(exportedRows), /ownToken|own-deepl-key/u);
  assert.equal(
    (await chatMeta(ownChatId)).discordWebhookUrl,
    own.discordWebhookUrl,
    "exporting leaves the stored chat as it was",
  );

  const withOutside = (row: Row, column: string, nested = false): Row => {
    const parsed = JSON.parse(String(row[column])) as Row;
    if (nested) parsed.metadata = { ...(parsed.metadata as Row), ...outside };
    return { ...row, [column]: JSON.stringify(nested ? parsed : { ...parsed, ...outside }) };
  };
  const ownChat = (await chatRow(ownChatId))!;
  const ownPreset = (await presetRow(ownProfile.id))!;
  const fullProfile = await app.inject({
    method: "POST",
    url: "/api/backup/import-profile",
    payload: {
      type: "marinara_profile",
      version: 1,
      exportedAt: new Date(0).toISOString(),
      data: {
        fileStorage: {
          version: 1,
          tables: {
            chats: [
              withOutside({ ...ownChat, id: "profile-new-chat" }, "metadata"),
              // Metadata stored as an object instead of JSON text is read the same way.
              { ...ownChat, id: "profile-object-chat", metadata: { ...outside, ...settings } },
              withOutside(ownChat, "metadata"),
            ],
            chat_presets: [
              withOutside({ ...ownPreset, id: "profile-new-preset", isActive: "true" }, "settings", true),
              withOutside(ownPreset, "settings", true),
            ],
            app_settings: [
              {
                key: TRANSLATOR_DEFAULTS_SETTINGS_KEY,
                value: JSON.stringify({ ...settings, ...outside }),
                updatedAt: new Date(0).toISOString(),
              },
            ],
          },
          files: [],
        },
      },
    },
  });
  assert.equal(fullProfile.statusCode, 200, fullProfile.body);
  assertNoDestinations(await chatMeta("profile-new-chat"), "a new chat from a full profile");
  assertSettingsKept(await chatMeta("profile-new-chat"), "a new chat from a full profile");
  assertNoDestinations(await chatMeta("profile-object-chat"), "a new chat with object metadata");
  assertNoDestinations(await presetMeta("profile-new-preset"), "a new settings profile from a full profile");
  assertSettingsKept(await presetMeta("profile-new-preset"), "a new settings profile from a full profile");
  const restoredChat = await chatMeta(ownChatId);
  const restoredPreset = await presetMeta(ownProfile.id);
  const restoredDefaults = JSON.parse((await appSettings.get(TRANSLATOR_DEFAULTS_SETTINGS_KEY)) ?? "{}") as Row;
  for (const [where, metadata] of [
    ["a chat restored over its own", restoredChat],
    ["a settings profile restored over its own", restoredPreset],
    ["translator defaults restored over their own", restoredDefaults],
  ] as const) {
    for (const [key, value] of Object.entries(own)) assert.equal(metadata?.[key], value, `${where} keeps ${key}`);
    assertSettingsKept(metadata, where);
  }

  const newChat = await injectOk({
    method: "POST",
    url: "/api/chats",
    payload: { name: "After import", mode: "roleplay", characterIds: [] },
  });
  const newChatMeta = await chatMeta(newChat.json().id as string);
  assert.equal(
    getChatTranslationConfig("after", newChatMeta).deeplxUrl,
    own.translationDeeplxUrl,
    "new chats take this install's translator address, not the imported one",
  );
  assert.equal(newChatMeta.discordWebhookUrl, undefined, "new chats get no imported Discord mirror");

  console.info("Chat outside-address import and export regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
