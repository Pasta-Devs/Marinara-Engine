import { Events, type Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import {
  getThreadMessageMappingByDiscordMessageId,
  getThreadBindingByThreadId,
  triggerChatGeneration,
} from "../core/marinara-api.js";
import { logger } from "../core/logger.js";

const generationQueues = new Map<string, Promise<void>>();

function isNotFoundError(err: unknown) {
  return err instanceof Error && err.message.includes("HTTP 404");
}

async function enqueueGeneration(
  serverUrl: string,
  input: {
    chatId: string;
    userMessage: string;
    bindingId: string;
    discordMessageId: string;
  },
) {
  const { chatId } = input;
  const previous = generationQueues.get(chatId) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await triggerChatGeneration(serverUrl, input);
    });
  generationQueues.set(chatId, next);

  try {
    await next;
  } finally {
    if (generationQueues.get(chatId) === next) {
      generationQueues.delete(chatId);
    }
  }
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

      await enqueueGeneration(config.serverUrl, {
        chatId: binding.chatId,
        userMessage: content,
        bindingId: binding.id,
        discordMessageId: message.id,
      });
      logger.info("Triggered Marinara generation for Discord thread %s chat %s", binding.threadId, binding.chatId);
    })().catch((err) => {
      logger.error(err, "Discord message create sync failed");
    });
  });
}
