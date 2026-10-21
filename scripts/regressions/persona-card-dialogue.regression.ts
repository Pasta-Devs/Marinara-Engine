import assert from "node:assert/strict";
import { characterDataSchema, resolveMacros } from "../../packages/shared/src/index.js";
const { buildApp } = await import("../../packages/server/src/app.js");
const { getDB } = await import("../../packages/server/src/db/connection.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { resolveChatUserIdentity } = await import("../../packages/server/src/services/chat-user-identity.js");
const { encodePersonaCreate } = await import("../../packages/server/src/services/personas/persona-projector.js");
const { expandMarker } = await import("../../packages/server/src/services/prompt/marker-expander.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const app = await buildApp();
await app.ready();
try {
  const storage = createCharactersStorage(await getDB());
  const encoded = encodePersonaCreate({
    name: "Example Persona",
    description: "PERSONA DESCRIPTION",
    mes_example: 'Example Persona: "Observe {{char}} carefully."',
  });
  const saved = await storage.createPersona(encoded.name, encoded.description, undefined, encoded.extra);
  assert.ok(saved);
  const identity = await resolveChatUserIdentity(storage, { personaId: saved.id });
  assert.equal(identity?.mesExample, 'Example Persona: "Observe {{char}} carefully."');
  const macroCtx = {
    user: "Example Persona",
    char: "Subject",
    characters: ["Subject"],
    variables: {},
    personaFields: { description: identity!.description, example: identity!.mesExample },
  };
  assert.match(resolveMacros("{{persona}}", macroCtx), /Observe Subject carefully/);
  const marker = await expandMarker(
    { type: "persona" },
    {
      db: await getDB(),
      chatId: "dialogue-proof",
      characterIds: [],
      personaName: identity!.name,
      personaDescription: identity!.description,
      personaFields: { example: identity!.mesExample },
      chatMessages: [],
      chatSummary: null,
      wrapFormat: "xml",
      enableAgents: false,
      activeAgentIds: [],
      activeLorebookIds: [],
      macroCtx,
    },
  );
  assert.match(marker.content, /<example_dialogue>/);
  assert.match(marker.content, /Observe Subject carefully/);
  const { injectGameGmPromptRuntime } =
    await import("../../packages/server/src/services/generation/game-gm-prompt-runtime.js");
  const game = await injectGameGmPromptRuntime({
    messages: [],
    chatId: "dialogue-game",
    chat: { personaId: saved.id },
    chatMetadata: {},
    world: null,
    characterIds: [],
    chars: storage,
    chats: { getById: async () => null, updateMetadata: async () => {} },
    selectedGameStateSnapshotPromise: Promise.resolve(null),
    mappedMessages: [],
    personaName: identity!.name,
    resolvePromptMacros: (value) => value,
  });
  assert.match(game.gmCtx.playerCard ?? "", /Example dialogue: Example Persona/);
  assert.match(game.gmCtx.playerCard ?? "", /Observe/);
  await storage.updatePersona(saved.id, {
    summary: "SUMMARY_METADATA_ONLY",
    mes_example: '{{user}}: "PEEK_DIALOGUE {{char}}."\n{{char}}: "Acknowledged."',
  });
  const subject = await storage.create(characterDataSchema.parse({ name: "Subject", description: "A subject." }));
  assert.ok(subject);
  const presets = createPromptsStorage(await getDB());
  const chats = createChatsStorage(await getDB());
  for (const wrapFormat of ["xml", "markdown", "none"] as const) {
    for (const includePersona of [true, false]) {
      const preset = await presets.create({ name: "Persona dialogue preview", wrapFormat });
      assert.ok(preset);
      await presets.createSection({
        presetId: preset.id,
        name: "Identity",
        identifier: "identity",
        content: includePersona
          ? "PEEK_IDENTITY_SECTION {{persona}}"
          : "PEEK_IDENTITY_SECTION Respond as the character.",
        role: "system",
        enabled: true,
        isMarker: false,
        order: 0,
      });
      const chat = await chats.create({
        name: "Persona dialogue preview",
        mode: "roleplay",
        characterIds: [subject.id],
        personaId: saved.id,
        promptPresetId: preset.id,
      });
      assert.ok(chat);
      await chats.patchMetadata(chat.id, { enableAgents: false, enableTools: false, enableMemoryRecall: false });
      await chats.createMessage({ chatId: chat.id, role: "user", content: "Hello." });
      const peek = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/peek-prompt`, payload: {} });
      assert.equal(peek.statusCode, 200, peek.body);
      assert.equal(peek.json().source, "live_preview");
      const text = JSON.stringify(peek.json().messages);
      const context = `${wrapFormat}/${includePersona ? "persona macro" : "fallback"}/peek`;
      assert.match(text, /PEEK_IDENTITY_SECTION/u, `${context}: the preset section reaches the preview`);
      assert.equal(text.split("PEEK_DIALOGUE").length - 1, 1, `${context}: example appears exactly once`);
      assert.match(text, /Example Persona:.*PEEK_DIALOGUE Subject/u, `${context}: speakers resolve`);
      assert.doesNotMatch(text, /\{\{(?:user|char)\}\}|SUMMARY_METADATA_ONLY/u, context);
    }
  }
  const stochasticExample =
    '{{random::PEEK_RANDOM_A::PEEK_RANDOM_B}} {{user}}: "Observe {{char}} with {{proofLabel}}. Straße İ ẞ."';
  const stochasticCases = [
    "persona macro",
    "persona marker",
    "nested character marker",
    "uppercase",
    "lowercase",
    "disabled section",
    "disabled group",
    "selected choice",
    "unselected choice",
    "unused choice",
    "false conditional",
    "false conditional quoted",
    "unused variable quoted",
    "false conditional partial quote",
    "false conditional partial first line",
    "fallback",
  ] as const;
  for (const wrapFormat of ["xml", "markdown", "none"] as const) {
    for (const variant of stochasticCases) {
      await storage.updatePersona(saved.id, {
        mes_example:
          variant === "false conditional partial first line"
            ? `{{user}}: Hello.\n${stochasticExample}`
            : stochasticExample,
      });
      await storage.update(subject.id, {
        description: variant === "nested character marker" ? "CHARACTER_MARKER_SECTION\n{{persona}}" : "A subject.",
      });
      const preset = await presets.create({
        name: `Stochastic persona dialogue: ${variant}`,
        wrapFormat,
        variableValues: {
          proofLabel: "PRESET_CHOICE_REFERENCE",
          ...(variant === "unused variable quoted" ? { unusedIdentity: "{{persona}}" } : {}),
        },
      });
      assert.ok(preset);
      const usesChoice = variant.endsWith("choice");
      if (usesChoice) {
        await presets.createChoiceBlock({
          presetId: preset.id,
          variableName: "identityChoice",
          question: "Include the Persona?",
          options: [
            { id: "include", label: "Include", value: "{{persona}}" },
            { id: "omit", label: "Omit", value: "No Persona chosen." },
          ],
          multiSelect: false,
          randomPick: false,
          separator: ", ",
          displayMode: "auto",
          optionSort: "manual",
        });
      }
      const disabledGroup =
        variant === "disabled group"
          ? await presets.createGroup({ presetId: preset.id, name: "Disabled identity", enabled: false })
          : null;
      await presets.createSection({
        presetId: preset.id,
        name: "Identity",
        identifier: "identity",
        content:
          variant === "selected choice" || variant === "unselected choice"
            ? "{{identityChoice}}"
            : variant.startsWith("false conditional")
              ? "{{#if false}}{{persona}}{{/if}}"
              : variant === "fallback" || variant === "unused choice" || variant === "unused variable quoted"
                ? "Respond as the character."
                : variant === "uppercase" || variant === "lowercase"
                  ? `{{${variant}}}{{persona}}{{/${variant}}}`
                  : "{{persona}}",
        role: "system",
        enabled: variant !== "disabled section",
        groupId: disabledGroup?.id ?? null,
        isMarker: variant === "persona marker" || variant === "nested character marker",
        ...(variant === "persona marker"
          ? { markerConfig: { type: "persona" as const } }
          : variant === "nested character marker"
            ? { markerConfig: { type: "character" as const, characterFields: ["description"] } }
            : {}),
        order: 0,
      });
      await presets.createSection({
        presetId: preset.id,
        name: "Instructions",
        identifier: "instructions",
        content:
          "PEEK_STOCHASTIC_SECTION Respond as {{char}}." +
          (variant === "false conditional quoted" || variant === "unused variable quoted"
            ? '\nQuoted dialogue: PEEK_RANDOM_A Example Persona: "Observe Subject with PRESET_CHOICE_REFERENCE. Straße İ ẞ."'
            : variant === "false conditional partial quote"
              ? "\nQuoted prefix: PEEK_RANDOM_A unrelated text."
              : variant === "false conditional partial first line"
                ? "\nQuoted first line: Example Persona: Hello."
                : ""),
        role: "system",
        enabled: true,
        isMarker: false,
        order: 1,
      });
      const chat = await chats.create({
        name: `Stochastic persona dialogue: ${variant}`,
        mode: "roleplay",
        characterIds: [subject.id],
        personaId: saved.id,
        promptPresetId: preset.id,
      });
      assert.ok(chat);
      await chats.patchMetadata(chat.id, {
        enableAgents: false,
        enableTools: false,
        enableMemoryRecall: false,
        presetChoices: { identityChoice: variant === "unselected choice" ? "No Persona chosen." : "{{persona}}" },
      });
      await chats.createMessage({ chatId: chat.id, role: "user", content: "Hello." });
      const originalRandom = Math.random;
      let randomCalls = 0;
      try {
        Math.random = () => (randomCalls++ % 2 === 0 ? 0 : 0.999);
        const peek = await app.inject({ method: "POST", url: `/api/chats/${chat.id}/peek-prompt`, payload: {} });
        assert.equal(peek.statusCode, 200, peek.body);
        const text = JSON.stringify(peek.json().messages);
        const context = `${wrapFormat}/${variant}/stochastic peek`;
        assert.match(text, /PEEK_STOCHASTIC_SECTION/u, context);
        assert.equal(
          text.match(/PEEK_RANDOM_/giu)?.length ?? 0,
          variant === "false conditional partial quote" ? 2 : 1,
          `${context}: complete dialogue appears once; an unrelated quoted prefix cannot suppress it`,
        );
        assert.equal(
          text.match(/Observe Subject with PRESET_CHOICE_REFERENCE/giu)?.length ?? 0,
          1,
          `${context}: the complete Persona example reaches the model exactly once`,
        );
        assert.match(text, /Example Persona:.*Observe Subject with PRESET_CHOICE_REFERENCE/iu, context);
        if (variant === "uppercase") {
          assert.match(text, /EXAMPLE PERSONA:.*OBSERVE SUBJECT WITH PRESET_CHOICE_REFERENCE/u, context);
          assert.match(text, /STRASSE İ ẞ/u, context);
        }
        if (variant === "lowercase") {
          assert.match(text, /example persona:.*observe subject with preset_choice_reference/u, context);
          assert.match(text, /straße i\u0307 ß/u, context);
        }
        assert.doesNotMatch(text, /\{\{(?:random|user|char|proofLabel)|SUMMARY_METADATA_ONLY/iu, context);
      } finally {
        Math.random = originalRandom;
      }
    }
  }
  console.info("Persona dialogue survives persistence, selected identity, macros, and the assembled persona marker.");
} finally {
  await app.close();
}
