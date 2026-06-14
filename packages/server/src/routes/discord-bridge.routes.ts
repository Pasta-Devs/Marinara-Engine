import type { FastifyInstance } from "fastify";
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
}
