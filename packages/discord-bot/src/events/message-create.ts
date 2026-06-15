import { Events, type Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import {
  getThreadMessageMappingByDiscordMessageId,
  getThreadBindingByThreadId,
  ingestDiscordUserMessage,
} from "../core/marinara-api.js";
import { logger } from "../core/logger.js";

function isNotFoundError(err: unknown) {
  return err instanceof Error && err.message.includes("HTTP 404");
}

export function registerMessageCreateEvent(client: Client, config: DiscordBridgeConfig) {
  client.on(Events.MessageCreate, (message) => {
    void (async () => {
      if (!message.guildId || message.author.bot) return;

      const content = message.content.trim();
      if (!content) return;

      let binding;
      try {
        binding = await getThreadBindingByThreadId(config.serverUrl, message.channelId);
      } catch (err) {
        if (isNotFoundError(err)) return;
        throw err;
      }

      try {
        await getThreadMessageMappingByDiscordMessageId(config.serverUrl, binding.threadId, message.id);
        return;
      } catch (err) {
        if (!isNotFoundError(err)) throw err;
      }

      const ingested = await ingestDiscordUserMessage(config.serverUrl, binding.threadId, {
        discordMessageId: message.id,
        content,
      });
      logger.info("Synced Discord message %s into Marinara message %s", message.id, ingested.message.id);
    })().catch((err) => {
      logger.error(err, "Discord message create sync failed");
    });
  });
}
