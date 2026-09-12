import assert from "node:assert/strict";
import type { Chat } from "../../packages/shared/src/types/chat.js";
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
    summary: "generated history",
  }),
} as unknown as Chat;
const saved = captureChatWizardDefaults(chat, { autonomousMessages: false, characterCommands: true });
assert.deepEqual(saved.characterIds, ["a", "b"]);
assert.equal(saved.connectionId, "connection");
assert.equal(saved.personaId, null);
assert.deepEqual(saved.metadata.activeLorebookIds, ["lore"]);
assert.deepEqual(saved.metadata.presetChoices, { path: "left" });
assert.equal(saved.metadata.autonomousMessages, false);
assert.ok(!Object.hasOwn(saved.metadata, "conversationSetupComplete"));
assert.ok(!Object.hasOwn(saved.metadata, "summary"));
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
