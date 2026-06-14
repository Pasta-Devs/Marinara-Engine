import type { FastifyInstance } from "fastify";
import type { CharacterData } from "@marinara-engine/shared";
import {
  getDiscordBridgeChatContext,
  getDiscordBridgeSetupOptions,
} from "../services/discord-bridge/bridge-context.service.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createChatsStorage } from "../services/storage/chats.storage.js";

export async function discordBridgeRoutes(app: FastifyInstance) {
  const chatsStorage = createChatsStorage(app.db);
  const charactersStorage = createCharactersStorage(app.db);

  app.get("/setup-options", async () => {
    return getDiscordBridgeSetupOptions(chatsStorage, charactersStorage);
  });

  app.get<{ Params: { chatId: string }; Querystring: { messageLimit?: string } }>(
    "/chats/:chatId/context",
    async (req, reply) => {
      const rawLimit = req.query.messageLimit;
      const messageLimit = rawLimit === undefined ? undefined : Number(rawLimit);
      const context = await getDiscordBridgeChatContext(chatsStorage, charactersStorage, req.params.chatId, {
        messageLimit: Number.isFinite(messageLimit) ? messageLimit : undefined,
      });
      if (!context) return reply.status(404).send({ error: "Chat not found" });
      return context;
    },
  );

  app.patch<{
    Params: { characterId: string };
    Body: { updates?: Array<{ field?: string; value?: unknown }> };
  }>("/characters/:characterId/fields", async (req, reply) => {
    const character = await charactersStorage.getById(req.params.characterId);
    if (!character) return reply.status(404).send({ error: "Character not found" });

    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
    if (updates.length === 0) return reply.status(400).send({ error: "No field updates provided" });

    let currentData: CharacterData;
    try {
      currentData = JSON.parse(character.data) as CharacterData;
    } catch {
      return reply.status(500).send({ error: "Character data is not valid JSON" });
    }

    const nextData = { ...currentData };
    const nextExtensions = { ...(currentData.extensions ?? {}) };

    for (const update of updates) {
      if (typeof update.field !== "string" || typeof update.value !== "string") {
        return reply.status(400).send({ error: "Each field update requires a string field and value" });
      }

      if (isCharacterExtensionTextField(update.field)) {
        (nextExtensions as Record<string, unknown>)[update.field] = update.value;
        continue;
      }

      if (isCharacterTopLevelTextField(update.field)) {
        (nextData as Record<string, unknown>)[update.field] = update.value;
        continue;
      }

      return reply.status(400).send({ error: `Unsupported character field: ${update.field}` });
    }

    nextData.extensions = nextExtensions;
    const updated = await charactersStorage.update(req.params.characterId, nextData, undefined, {
      versionSource: "discord-bridge",
      versionReason: "Discord bridge field edit",
      mergeExtensions: false,
    });
    if (!updated) return reply.status(404).send({ error: "Character not found" });
    return updated;
  });
}

const CHARACTER_TOP_LEVEL_TEXT_FIELDS = new Set<keyof CharacterData>([
  "name",
  "creator",
  "character_version",
  "creator_notes",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "system_prompt",
  "post_history_instructions",
]);

const CHARACTER_EXTENSION_TEXT_FIELDS = new Set(["backstory", "appearance"]);

function isCharacterTopLevelTextField(field: string): field is keyof CharacterData {
  return CHARACTER_TOP_LEVEL_TEXT_FIELDS.has(field as keyof CharacterData);
}

function isCharacterExtensionTextField(field: string) {
  return CHARACTER_EXTENSION_TEXT_FIELDS.has(field);
}
