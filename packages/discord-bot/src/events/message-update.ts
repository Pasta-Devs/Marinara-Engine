import { Events, type Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import { contentHash } from "../core/content-hash.js";
import {
  getThreadMessageMappingByDiscordMessageId,
  getThreadBindingByThreadId,
  updateChatMessageContent,
  upsertMessageMapping,
} from "../core/marinara-api.js";
import { logger } from "../core/logger.js";

function isNotFoundError(err: unknown) {
  return err instanceof Error && err.message.includes("HTTP 404");
}

export function registerMessageUpdateEvent(client: Client, config: DiscordBridgeConfig) {
  client.on(Events.MessageUpdate, (_oldMessage, newMessage) => {
    void (async () => {
      if (!newMessage.inGuild() || newMessage.author?.bot) return;

      const content = newMessage.content?.trim();
      if (!content) return;

      let binding;
      try {
        binding = await getThreadBindingByThreadId(config.serverUrl, newMessage.channelId);
      } catch (err) {
        if (isNotFoundError(err)) return;
        throw err;
      }

      let mapping;
      try {
        mapping = await getThreadMessageMappingByDiscordMessageId(config.serverUrl, binding.threadId, newMessage.id);
      } catch (err) {
        if (isNotFoundError(err)) return;
        throw err;
      }
      if (!mapping || mapping.direction !== "discord_to_engine" || mapping.role !== "user") return;

      const nextHash = contentHash(content);
      if (mapping.contentHash === nextHash) return;

      await updateChatMessageContent(config.serverUrl, binding.chatId, mapping.marinaraMessageId, content);
      await upsertMessageMapping(config.serverUrl, {
        bindingId: binding.id,
        marinaraMessageId: mapping.marinaraMessageId,
        discordMessageIds: mapping.discordMessageIds,
        role: mapping.role,
        direction: mapping.direction,
        contentHash: nextHash,
      });
      logger.info("Synced Discord edit %s into Marinara message %s", newMessage.id, mapping.marinaraMessageId);
    })().catch((err) => {
      logger.error(err, "Discord message update sync failed");
    });
  });
}
