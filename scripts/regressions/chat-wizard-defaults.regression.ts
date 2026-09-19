import assert from "node:assert/strict";
import type { Chat } from "../../packages/shared/src/types/chat.js";
import { normalizeTranslatorSettings } from "../../packages/shared/src/utils/translator-defaults.js";
import {
  captureChatWizardDefaults,
  wizardDefaultsMetadataPatch,
} from "../../packages/client/src/lib/chat-wizard-defaults.js";

const chat = {
  name: "Saved setup",
  connectionId: "connection",
  characterIds: '["a","b","a"]',
  metadata: JSON.stringify({
    activeLorebookIds: ["lore"],
    activeAgentIds: ["agent"],
    chatBackground: "/image.png",
    presetChoices: { path: "left" },
    spriteCharacterIds: ["a"],
    conversationSetupComplete: true,
    autoTranslate: false,
    translationConnectionId: "",
    summary: "generated history",
    advancedMemory: {
      enabled: true,
      maxContextTokens: 12000,
      knowledgeStarts: { a: "source-chat-message" },
      knowledgeConfirmed: true,
    },
    advancedMemoryState: { status: "running", id: "source-chat-job" },
  }),
} as unknown as Chat;
const saved = captureChatWizardDefaults(chat, { autonomousMessages: false, characterCommands: true });
assert.ok(!Object.hasOwn(saved, "name"), "Reusable setup must not capture the conversation name");
assert.deepEqual(saved.characterIds, ["a", "b"]);
assert.equal(saved.connectionId, "connection");
assert.equal(saved.personaId, null);
assert.deepEqual(saved.metadata.activeLorebookIds, ["lore"]);
assert.deepEqual(saved.metadata.presetChoices, { path: "left" });
assert.equal(saved.metadata.autonomousMessages, false);
assert.equal(saved.metadata.autoTranslate, false, "Explicit saved wizard toggles override global translator defaults");
assert.equal(saved.metadata.translationConnectionId, "");
assert.ok(!Object.hasOwn(saved.metadata, "conversationSetupComplete"));
assert.ok(!Object.hasOwn(saved.metadata, "summary"));
assert.ok(!Object.hasOwn(saved.metadata, "advancedMemoryState"));
const memoryDefaults = saved.metadata.advancedMemory as Record<string, unknown>;
assert.equal(memoryDefaults.enabled, true);
assert.equal(memoryDefaults.maxContextTokens, 12000);
assert.deepEqual(memoryDefaults.knowledgeStarts, {});
assert.equal(memoryDefaults.knowledgeConfirmed, false);
const initial = captureChatWizardDefaults({ ...chat, name: "Fresh", metadata: {} });
const reset = wizardDefaultsMetadataPatch(saved, initial);
assert.equal(reset.autonomousMessages, null);
assert.equal(reset.activeLorebookIds, null);
for (const raw of ["{broken", "null", "[]", "42"]) {
  const invalid = captureChatWizardDefaults({ ...chat, metadata: raw, characterIds: raw } as unknown as Chat);
  assert.deepEqual(invalid.metadata, {});
  assert.deepEqual(invalid.characterIds, []);
}
console.log("Wizard snapshots preserve setup choices, reset defaults, and tolerate malformed legacy data.");

assert.deepEqual(
  normalizeTranslatorSettings({
    translationProvider: "ai",
    translationTargetLang: "Polish",
    translationInputTargetLang: "",
    translationPrompt: "Legacy {{targetLanguage}} prompt",
    translationOutputPrompt: null,
    translationConnectionId: "",
    autoTranslate: false,
    translateInput: "true",
    summary: "Must stay with this chat",
  }),
  {
    translationProvider: "ai",
    translationConnectionId: "",
    translationTargetLang: "Polish",
    translationInputTargetLang: "",
    translationOutputTargetLang: "Polish",
    translationPrompt: "Legacy {{targetLanguage}} prompt",
    translationInputPrompt: "Legacy {{targetLanguage}} prompt",
    translationOutputPrompt: null,
    autoTranslate: false,
  },
);
for (const value of [undefined, "{broken", "[]", "42", { translationProvider: "unknown" }]) {
  assert.deepEqual(normalizeTranslatorSettings(value), {});
}
