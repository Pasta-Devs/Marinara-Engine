import assert from "node:assert/strict";
import {
  applyCharacterCardFieldAlternatives,
  cardEntityBelongsToChat,
  cardFieldAlternativesSchema,
} from "../../packages/shared/src/index.js";

const alternative = { id: "alt-1", field: "description" as const, value: "A CHAT DESCRIPTION", chatIds: ["chat-a"] };
assert.equal(cardFieldAlternativesSchema.safeParse([alternative]).success, true);
assert.equal(cardFieldAlternativesSchema.safeParse([alternative, { ...alternative, id: "alt-2" }]).success, false);
assert.equal(cardFieldAlternativesSchema.safeParse([{ ...alternative, field: "system_prompt" }]).success, false);
assert.equal(
  cardFieldAlternativesSchema.safeParse(
    Array.from({ length: 1200 }, (_, index) => ({ ...alternative, id: `alt-${index}`, chatIds: [] })),
  ).success,
  true,
);
const card = {
  name: "A",
  description: "BASE",
  backstory: "LEGACY",
  extensions: {
    backstory: "BASE BACKSTORY",
    cardFieldAlternatives: [alternative, { id: "empty", field: "backstory", value: "", chatIds: ["chat-a"] }],
  },
};
const before = JSON.stringify(card);
const projected = applyCharacterCardFieldAlternatives(card, "chat-a");
assert.equal(projected.description, "A CHAT DESCRIPTION");
assert.equal(projected.extensions.backstory, "");
assert.equal(projected.backstory, "");
assert.equal(JSON.stringify(card), before);
assert.equal(applyCharacterCardFieldAlternatives(card, "chat-b"), card);
assert.equal(cardEntityBelongsToChat({ personaId: "p", characterIds: ["c"] }, "persona", "p"), true);
assert.equal(cardEntityBelongsToChat({ personaId: "p", personaCharacterId: "c" }, "persona", "p"), false);
assert.equal(cardEntityBelongsToChat({ personaCharacterId: "c" }, "character", "c"), true);
assert.equal(
  cardEntityBelongsToChat(
    { mode: "game", metadata: { gameSetupConfig: { personaId: "p", gmCharacterId: "gm", partyCharacterIds: ["pc"] } } },
    "character",
    "gm",
  ),
  true,
);
assert.equal(
  cardEntityBelongsToChat({ mode: "game", metadata: { gameSetupConfig: { personaId: "p" } } }, "persona", "p"),
  true,
);

assert.equal(
  cardEntityBelongsToChat(
    {
      mode: "game",
      metadata: {
        gamePartyCharacterIds: [],
        gameGmCharacterId: "new-gm",
        gameSetupConfig: { gmCharacterId: "old-gm", partyCharacterIds: ["removed"] },
      },
    },
    "character",
    "removed",
  ),
  false,
);
assert.equal(
  cardEntityBelongsToChat(
    { mode: "game", metadata: { gameGmCharacterId: "new-gm", gameSetupConfig: { gmCharacterId: "old-gm" } } },
    "character",
    "old-gm",
  ),
  false,
);

// API, persistence, and real prompt consumers are exercised below after the
// additive schema is registered. The runner supplies a disposable data root.
const { buildApp } = await import("../../packages/server/src/app.js");
const { getDB } = await import("../../packages/server/src/db/connection.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const app = await buildApp();
await app.ready();
try {
  async function request(method: "POST" | "PATCH" | "GET", url: string, payload?: unknown, expected = 200) {
    const response = await app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
    assert.equal(response.statusCode, expected, `${method} ${url}: ${response.body}`);
    return response.json();
  }
  const character = await request("POST", "/api/characters", {
    data: characterDataSchema.parse({ name: "Alternative Subject", description: "BASE DESCRIPTION" }),
  });
  const persona = await request("POST", "/api/characters/personas", {
    name: "Alternative Persona",
    description: "BASE PERSONA",
  });
  const firstChat = await request("POST", "/api/chats", {
    name: "Alternative Alpha",
    mode: "roleplay",
    characterIds: [character.id],
    personaId: persona.id,
  });
  const secondChat = await request("POST", "/api/chats", {
    name: "Alternative Beta",
    mode: "roleplay",
    characterIds: [character.id],
    personaId: persona.id,
  });
  const unrelated = await request("POST", "/api/chats", { name: "Unrelated", mode: "roleplay", characterIds: [] });
  const characterAlternatives = [
    { ...alternative, chatIds: [firstChat.id] },
    { id: "second", field: "appearance", value: "SECOND APPEARANCE", chatIds: [secondChat.id] },
  ];
  await request("PATCH", `/api/characters/${character.id}`, {
    data: { extensions: { cardFieldAlternatives: characterAlternatives } },
  });
  await request("PATCH", `/api/characters/personas/${persona.id}`, {
    cardFieldAlternatives: [
      { id: "persona-alt", field: "description", value: "CHAT PERSONA", chatIds: [firstChat.id] },
    ],
  });
  assert.deepEqual(
    (await request("GET", `/api/characters/${character.id}/card-field-chats`)).map((chat: { id: string }) => chat.id),
    [firstChat.id, secondChat.id],
  );
  assert.deepEqual(
    (await request("GET", `/api/characters/personas/${persona.id}/card-field-chats`)).map(
      (chat: { id: string }) => chat.id,
    ),
    [firstChat.id, secondChat.id],
  );
  await request(
    "PATCH",
    `/api/characters/${character.id}`,
    {
      data: {
        extensions: {
          cardFieldAlternatives: [characterAlternatives[0], { ...characterAlternatives[0], id: "conflict" }],
        },
      },
    },
    400,
  );
  const storage = createCharactersStorage(await getDB());
  assert.equal(JSON.parse((await storage.getById(character.id, firstChat.id))!.data).description, "A CHAT DESCRIPTION");
  assert.equal(JSON.parse((await storage.getById(character.id, secondChat.id))!.data).description, "BASE DESCRIPTION");
  assert.equal(JSON.parse((await storage.getById(character.id, unrelated.id))!.data).description, "BASE DESCRIPTION");
  assert.equal((await storage.getPersona(persona.id, firstChat.id))!.description, "CHAT PERSONA");
  assert.equal((await storage.getPersona(persona.id, secondChat.id))!.description, "BASE PERSONA");
  assert.equal((await storage.getPersona(persona.id))!.description, "BASE PERSONA");
  assert.equal(JSON.parse((await storage.getById(character.id))!.data).description, "BASE DESCRIPTION");
  const duplicated = await request("POST", `/api/characters/${character.id}/duplicate`);
  assert.equal(
    JSON.parse((await storage.getById(duplicated.id))!.data).extensions.cardFieldAlternatives.every(
      (entry: { chatIds: string[] }) => entry.chatIds.length === 0,
    ),
    true,
  );
  const duplicatePersona = await request("POST", `/api/characters/personas/${persona.id}/duplicate`);
  assert.equal(duplicatePersona.cardFieldAlternatives[0].chatIds.length, 0);
  // The real assembler reads the same scoped cards for normal markers,
  // custom macros, and referenced cards. Summary stays library metadata.
  const { CARD_FIELD_KEYS } = await import("../../packages/shared/src/index.js");
  const { resolveChatUserIdentity } = await import("../../packages/server/src/services/chat-user-identity.js");
  const { assemblePrompt } = await import("../../packages/server/src/services/prompt/assembler.js");
  const { buildPromptMacroContext } = await import("../../packages/server/src/services/prompt/macro-context.js");
  const { loadCharacterPromptInfo } =
    await import("../../packages/server/src/services/generation/character-prompt-context.js");
  const allCharacterAlternatives = CARD_FIELD_KEYS.map((field) => ({
    id: `character-${field}`,
    field,
    value: `CHARACTER ALTERNATIVE ${field}`,
    chatIds: [firstChat.id],
  }));
  const allPersonaAlternatives = CARD_FIELD_KEYS.map((field) => ({
    id: `persona-${field}`,
    field,
    value: `PERSONA ALTERNATIVE ${field}`,
    chatIds: [firstChat.id],
  }));
  await request("PATCH", `/api/characters/${character.id}`, {
    data: {
      summary: "BASE SUMMARY METADATA",
      mes_example: "BASE CHARACTER DIALOGUE",
      extensions: { cardFieldAlternatives: allCharacterAlternatives },
    },
  });
  await request("PATCH", `/api/characters/personas/${persona.id}`, {
    summary: "BASE PERSONA SUMMARY METADATA",
    mes_example: "BASE PERSONA DIALOGUE",
    cardFieldAlternatives: allPersonaAlternatives,
  });
  async function assembleFor(chat: typeof firstChat) {
    const identity = await resolveChatUserIdentity(storage, chat);
    const personaFields = {
      personality: identity?.personality,
      backstory: identity?.backstory,
      appearance: identity?.appearance,
      scenario: identity?.scenario,
      example: identity?.mesExample,
    };
    const sections = ["character", "persona"].map((type) => ({
      id: type,
      presetId: "alternative-proof",
      identifier: type,
      name: type,
      content: "",
      role: "system",
      enabled: "true",
      isMarker: "true",
      groupId: null,
      markerConfig: JSON.stringify({ type }),
      injectionPosition: "relative",
      injectionDepth: 0,
      injectionOrder: 0,
      forbidOverrides: "false",
    }));
    const assembled = await assemblePrompt({
      db: await getDB(),
      preset: {
        id: "alternative-proof",
        name: "Alternative proof",
        sectionOrder: JSON.stringify(sections.map((section) => section.id)),
        groupOrder: "[]",
        wrapFormat: "xml",
        parameters: "{}",
        variableGroups: "[]",
        variableValues: "{}",
      },
      sections,
      groups: [],
      choiceBlocks: [],
      chatChoices: {},
      chatId: chat.id,
      characterIds: chat.characterIds,
      personaId: identity?.source === "persona" ? identity.id : null,
      personaName: identity?.name ?? "User",
      personaDescription: identity?.description ?? "",
      personaFields,
      chatMessages: [],
      disableLorebooks: true,
    });
    return { text: assembled.messages.map((message) => message.content).join("\n"), identity, personaFields };
  }
  const scoped = await assembleFor(firstChat);
  for (const field of CARD_FIELD_KEYS.filter((field) => field !== "summary")) {
    assert.ok(scoped.text.includes(`CHARACTER ALTERNATIVE ${field}`), `character marker must use ${field} replacement`);
    assert.ok(scoped.text.includes(`PERSONA ALTERNATIVE ${field}`), `persona marker must use ${field} replacement`);
  }
  assert.doesNotMatch(scoped.text, /BASE DESCRIPTION|BASE PERSONA|ALTERNATIVE summary|SUMMARY METADATA/);
  const other = await assembleFor(secondChat);
  assert.match(other.text, /BASE DESCRIPTION/);
  assert.match(other.text, /BASE PERSONA/);
  assert.doesNotMatch(other.text, /CHARACTER ALTERNATIVE|PERSONA ALTERNATIVE|SUMMARY METADATA/);
  const macroContext = await buildPromptMacroContext({
    db: await getDB(),
    characterIds: [character.id],
    chatId: firstChat.id,
    personaName: scoped.identity!.name,
    personaDescription: scoped.identity!.description,
    personaFields: scoped.personaFields,
  });
  assert.equal(macroContext.characterFields?.description, "CHARACTER ALTERNATIVE description");
  assert.equal(macroContext.characterFields?.example, "CHARACTER ALTERNATIVE mes_example");
  assert.equal(
    (
      await loadCharacterPromptInfo({
        chars: storage,
        characterIds: [character.id],
        chatId: firstChat.id,
        chatMode: "roleplay",
      })
    )[0].appearance,
    "CHARACTER ALTERNATIVE appearance",
  );
  const characterExport = await request("GET", `/api/characters/${character.id}/export`);
  const personaExport = await request("GET", `/api/characters/personas/${persona.id}/export`);
  assert.deepEqual(
    characterExport.data.data.extensions.cardFieldAlternatives.map((entry: { chatIds: string[] }) => entry.chatIds),
    CARD_FIELD_KEYS.map(() => []),
  );
  assert.deepEqual(
    personaExport.data.cardFieldAlternatives.map((entry: { chatIds: string[] }) => entry.chatIds),
    CARD_FIELD_KEYS.map(() => []),
  );
  assert.equal(personaExport.data.cardFieldAlternatives[0].value, allPersonaAlternatives[0].value);
  const importedCharacter = await request("POST", "/api/import/marinara", characterExport);
  const importedPersona = await request("POST", "/api/import/marinara", personaExport);
  assert.equal(importedCharacter.success, true);
  assert.equal(importedPersona.success, true);
  assert.deepEqual(
    JSON.parse((await storage.getById(importedCharacter.id))!.data).extensions.cardFieldAlternatives,
    allCharacterAlternatives.map((entry) => ({ ...entry, chatIds: [] })),
  );
  assert.deepEqual(
    JSON.parse((await storage.getPersona(importedPersona.id))!.cardFieldAlternatives),
    allPersonaAlternatives.map((entry) => ({ ...entry, chatIds: [] })),
  );
  const versions = await request("GET", `/api/characters/personas/${persona.id}/versions`);
  const withAlternatives = versions.find(
    (version: { data: { cardFieldAlternatives?: string } }) =>
      version.data.cardFieldAlternatives === JSON.stringify(allPersonaAlternatives),
  );
  assert.ok(withAlternatives, "current version snapshots include alternatives");
  await request("PATCH", `/api/characters/personas/${persona.id}`, { cardFieldAlternatives: [] });
  const savedVersions = await request("GET", `/api/characters/personas/${persona.id}/versions`);
  const previousAlternatives = savedVersions.find(
    (version: { isCurrent?: boolean; data: { cardFieldAlternatives?: string } }) =>
      !version.isCurrent && version.data.cardFieldAlternatives === JSON.stringify(allPersonaAlternatives),
  );
  assert.ok(previousAlternatives, "editing alternatives must retain the prior version");
  await request("POST", `/api/characters/personas/${persona.id}/versions/${previousAlternatives.id}/restore`);
  assert.deepEqual(JSON.parse((await storage.getPersona(persona.id))!.cardFieldAlternatives), allPersonaAlternatives);
  await request("PATCH", `/api/chats/${firstChat.id}`, { personaCharacterId: character.id });
  const asUser = await resolveChatUserIdentity(storage, {
    ...firstChat,
    personaId: null,
    personaCharacterId: character.id,
  });
  assert.equal(asUser?.description, "CHARACTER ALTERNATIVE description");
  assert.equal(asUser?.mesExample, "CHARACTER ALTERNATIVE mes_example");
  assert.equal(JSON.parse((await storage.getById(character.id))!.data).description, "BASE DESCRIPTION");
  await request("PATCH", `/api/chats/${firstChat.id}`, { characterIds: [], personaId: null });
  assert.equal(JSON.parse((await storage.getById(character.id, firstChat.id))!.data).description, "BASE DESCRIPTION");
  assert.equal((await storage.getPersona(persona.id, firstChat.id))!.description, "BASE PERSONA");
  await request("PATCH", `/api/characters/${character.id}`, { data: { extensions: { cardFieldAlternatives: [] } } });
  assert.deepEqual(JSON.parse((await storage.getById(character.id))!.data).extensions.cardFieldAlternatives, []);
  console.info("Card field alternatives API and immutable storage projection passed.");
} finally {
  await app.close();
}
