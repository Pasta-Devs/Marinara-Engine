import assert from "node:assert/strict";
import type { Persona } from "@marinara-engine/shared";
import { createInputMacroResolverForChat } from "../../packages/client/src/lib/chat-macros.js";

const personas = [
  { id: "legacy", name: "Legacy Default", isActive: true, description: "Legacy details" },
  { id: "explicit", name: "Selected Persona", isActive: false, description: "Selected details" },
] as Persona[];
const characters = [{ id: "character", data: { name: "Character Persona" } }];

for (const mode of ["conversation", "roleplay", "game"]) {
  for (const personaId of [null, "missing"]) {
    const resolve = createInputMacroResolverForChat({ mode, personaId }, characters, personas);
    assert.equal(resolve("I am {{user}} / {{userName}}"), "I am User / User", `${mode}: ${personaId}`);
  }
  for (const persona of personas) {
    const resolve = createInputMacroResolverForChat({ mode, personaId: persona.id }, characters, personas);
    assert.equal(resolve("I am {{user}}"), `I am ${persona.name}`, `${mode}: explicit ${persona.id}`);
  }
  const characterIdentity = createInputMacroResolverForChat(
    { mode, personaId: "explicit", personaCharacterId: "character" },
    characters,
    personas,
  );
  assert.equal(characterIdentity("I am {{user}}"), "I am Character Persona");
  const missingCharacter = createInputMacroResolverForChat(
    { mode, personaId: "explicit", personaCharacterId: "missing" },
    characters,
    personas,
  );
  assert.equal(missingCharacter("I am {{user}}"), "I am User");
}
assert.equal(createInputMacroResolverForChat(null, characters, personas)("{{user}}"), "User");
