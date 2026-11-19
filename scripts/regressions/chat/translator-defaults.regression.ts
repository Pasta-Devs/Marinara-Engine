// Translator defaults: saved defaults seed new chats only, a chat profile's valid translator choices win, and broken
// defaults never block creating a chat. Runs on a fresh database in a temporary folder. After it, the default
// translation prompt and its target language.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChatPresetsStorage } from "../../../packages/server/src/services/storage/chat-presets.storage.js";
import {
  DEFAULT_TRANSLATION_SYSTEM_PROMPT,
  resolveTranslationSystemPrompt,
} from "../../../packages/shared/src/constants/defaults.js";

const storageRoot = mkdtempSync(join(tmpdir(), "marinara-translator-defaults-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const chatPresetStorage = createChatPresetsStorage(db);
  await chatPresetStorage.ensureDefaults();
  // Translator defaults seed new chats only; explicit profile values retain precedence.
  {
    const { createAppSettingsStorage } =
      await import("../../../packages/server/src/services/storage/app-settings.storage.js");
    const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
    const { TRANSLATOR_DEFAULTS_SETTINGS_KEY, normalizeTranslatorSettings } =
      await import("../../../packages/shared/src/utils/translator-defaults.js");
    const { readChatMetadataSecret } = await import("../../../packages/server/src/utils/stored-secrets.js");
    const appSettings = createAppSettingsStorage(db);
    const translatorChats = createChatsStorage(db);
    const createTranslatorChat = (mode: "conversation" | "roleplay" | "game") =>
      translatorChats.create({
        name: "Translator defaults proof",
        mode,
        characterIds: [],
        groupId: null,
        personaId: null,
        personaCharacterId: null,
        promptPresetId: null,
        connectionId: null,
      });
    const oldChat = (await createTranslatorChat("roleplay"))!;
    const oldMetadata = oldChat.metadata;
    const defaults = {
      translationProvider: "ai",
      translationConnectionId: "translator-connection",
      translationInputTargetLang: "English",
      translationOutputTargetLang: "Polish",
      translationInputPrompt: "Input {{targetLanguage}}",
      translationOutputPrompt: "Output {{targetLanguage}}",
      translationDeeplApiKey: "synthetic-key",
      translationDeeplxUrl: "http://localhost:1188",
      autoTranslate: true,
      translateInput: true,
      showInputTranslateButton: true,
      translationDisplayOnly: true,
    };
    await appSettings.set(TRANSLATOR_DEFAULTS_SETTINGS_KEY, JSON.stringify({ ...defaults, summary: "not reusable" }));
    for (const mode of ["conversation", "roleplay", "game"] as const) {
      const created = (await createTranslatorChat(mode))!;
      const metadata = JSON.parse(created.metadata);
      // The inherited DeepL key is stored encrypted and reads back as the saved key.
      assert.match(metadata.translationDeeplApiKey, /^enc:v1:/u, `${mode} stores the inherited DeepL key encrypted`);
      assert.deepEqual(
        {
          ...normalizeTranslatorSettings(metadata),
          translationDeeplApiKey: readChatMetadataSecret(metadata, "translationDeeplApiKey"),
        },
        defaults,
        `${mode} inherits persisted translator defaults`,
      );
      assert.equal(metadata.summary, null, "Unrelated metadata cannot enter through translator defaults");
    }
    assert.equal(
      (await translatorChats.getById(oldChat.id))!.metadata,
      oldMetadata,
      "Saving defaults leaves existing chats unchanged",
    );
    const target = (await createTranslatorChat("roleplay"))!;
    const invalidTranslatorMetadata = {
      autoTranslate: "false",
      translateInput: 0,
      translationConnectionId: false,
      translationOutputTargetLang: 42,
      translationOutputPrompt: [],
      translationProvider: "unsupported",
      translationInputPrompt: "Valid profile prompt",
      enableAgents: false,
    };
    const invalidProfile = (await chatPresetStorage.create({
      name: "Invalid translator overrides",
      mode: "roleplay",
      settings: { metadata: invalidTranslatorMetadata },
    }))!;
    const invalidApplied = JSON.parse((await chatPresetStorage.applyToChat(invalidProfile.id, target.id))!.metadata);
    assert.deepEqual(
      Object.fromEntries(Object.keys(defaults).map((key) => [key, invalidApplied[key]])),
      { ...defaults, translationInputPrompt: "Valid profile prompt" },
      "Invalid profile translator values inherit saved defaults while valid choices still override them",
    );
    assert.equal(invalidApplied.enableAgents, false, "Other profile metadata remains applicable");
    assert.deepEqual(
      (await chatPresetStorage.getById(invalidProfile.id))!.settings.metadata,
      invalidTranslatorMetadata,
      "Applying a profile must not rewrite its saved translator choices",
    );
    const profile = (await chatPresetStorage.create({
      name: "Translator override",
      mode: "roleplay",
      settings: {
        metadata: {
          autoTranslate: false,
          translateInput: false,
          translationConnectionId: "",
          translationOutputTargetLang: "",
          translationOutputPrompt: null,
        },
      },
    }))!;
    const applied = (await chatPresetStorage.applyToChat(profile.id, target.id))!;
    const appliedMetadata = JSON.parse(applied.metadata);
    assert.equal(
      appliedMetadata.translationProvider,
      "ai",
      "An unrelated profile field must not erase translator defaults",
    );
    assert.equal(appliedMetadata.autoTranslate, false);
    assert.equal(appliedMetadata.translateInput, false);
    assert.equal(appliedMetadata.translationConnectionId, "");
    assert.equal(appliedMetadata.translationOutputTargetLang, "");
    assert.equal(appliedMetadata.translationOutputPrompt, null);
    await chatPresetStorage.saveSettings(profile.id, {
      metadata: { translationTargetLang: "Japanese", translationPrompt: null },
    });
    const legacyApplied = JSON.parse((await chatPresetStorage.applyToChat(profile.id, target.id))!.metadata);
    assert.equal(legacyApplied.translationInputTargetLang, "Japanese");
    assert.equal(legacyApplied.translationOutputTargetLang, "Japanese");
    assert.equal(legacyApplied.translationInputPrompt, null);
    await translatorChats.patchMetadata(target.id, { autoTranslate: false, translationConnectionId: "" });
    for (const raw of ["", "{broken", "[]", "null"]) {
      await appSettings.set(TRANSLATOR_DEFAULTS_SETTINGS_KEY, raw);
      const created = (await createTranslatorChat("game"))!;
      assert.deepEqual(
        normalizeTranslatorSettings(JSON.parse(created.metadata)),
        {},
        "Missing or malformed defaults cannot block chat creation",
      );
    }
    const explicitMetadata = JSON.parse((await translatorChats.getById(target.id))!.metadata);
    assert.equal(explicitMetadata.autoTranslate, false);
    assert.equal(explicitMetadata.translationConnectionId, "");
    await appSettings.remove(TRANSLATOR_DEFAULTS_SETTINGS_KEY);
  }
} finally {
  await closeDb?.();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(storageRoot, { recursive: true, force: true });
}

assert.match(DEFAULT_TRANSLATION_SYSTEM_PROMPT, /\{\{targetLanguage\}\}/u);
assert.match(resolveTranslationSystemPrompt(DEFAULT_TRANSLATION_SYSTEM_PROMPT, "Japanese"), /into Japanese/u);
