import type { Client, TextBasedChannel } from "discord.js";
import type { DiscordBridgeEngineSyncItem } from "@marinara-engine/shared";
import { getEngineSyncItems, upsertMessageMapping } from "./marinara-api.js";
import { splitDiscordMessageContent } from "./message-splitter.js";
import { formatThreadMessage } from "./thread-message-format.js";
import { logger } from "./logger.js";

interface SyncableThread {
  send(input: { content: string }): Promise<{ id: string }>;
  messages: {
    fetch(messageId: string): Promise<{ id: string; edit(input: { content: string }): Promise<unknown> }>;
  };
}

function isSyncableThread(channel: TextBasedChannel | null): channel is TextBasedChannel & SyncableThread {
  return !!channel && "send" in channel && "messages" in channel;
}

async function fetchThread(client: Client, threadId: string) {
  const channel = await client.channels.fetch(threadId).catch(() => null);
  return isSyncableThread(channel as TextBasedChannel | null) ? (channel as TextBasedChannel & SyncableThread) : null;
}

async function applyCreate(input: { serverUrl: string; item: DiscordBridgeEngineSyncItem; thread: SyncableThread }) {
  const chunks = splitDiscordMessageContent(formatThreadMessage(input.item.message));
  const discordMessageIds: string[] = [];
  for (const chunk of chunks) {
    const sent = await input.thread.send({ content: chunk });
    discordMessageIds.push(sent.id);
  }
  await upsertMessageMapping(input.serverUrl, {
    bindingId: input.item.binding.id,
    marinaraMessageId: input.item.message.id,
    discordMessageIds,
    role: input.item.message.role,
    direction: "engine_to_discord",
    contentHash: input.item.contentHash,
  });
}

async function editOrReplaceChunk(input: {
  thread: SyncableThread;
  messageId: string | undefined;
  content: string;
  marinaraMessageId: string;
  chunkIndex: number;
}) {
  if (!input.messageId) {
    const sent = await input.thread.send({ content: input.content });
    return sent.id;
  }

  try {
    const existing = await input.thread.messages.fetch(input.messageId);
    await existing.edit({ content: input.content });
    return input.messageId;
  } catch (err) {
    logger.warn(
      err,
      `Replacing missing Discord chunk ${input.messageId} for Marinara message ${input.marinaraMessageId} chunk ${
        input.chunkIndex + 1
      }`,
    );
    const sent = await input.thread.send({ content: input.content });
    return sent.id;
  }
}

async function retireExtraChunk(thread: SyncableThread, messageId: string) {
  try {
    const extra = await thread.messages.fetch(messageId);
    await extra.edit({ content: "[removed by Marinara edit]" });
  } catch (err) {
    logger.warn(err, `Skipped missing extra Discord chunk ${messageId} during Marinara edit sync`);
  }
}

async function applyUpdate(input: { serverUrl: string; item: DiscordBridgeEngineSyncItem; thread: SyncableThread }) {
  if (!input.item.mapping) return;

  const chunks = splitDiscordMessageContent(formatThreadMessage(input.item.message));
  const nextDiscordMessageIds: string[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const messageId = await editOrReplaceChunk({
      thread: input.thread,
      messageId: input.item.mapping.discordMessageIds[index],
      content: chunks[index] ?? "",
      marinaraMessageId: input.item.message.id,
      chunkIndex: index,
    });
    nextDiscordMessageIds.push(messageId);
  }

  for (let index = chunks.length; index < input.item.mapping.discordMessageIds.length; index += 1) {
    await retireExtraChunk(input.thread, input.item.mapping.discordMessageIds[index]!);
  }

  await upsertMessageMapping(input.serverUrl, {
    bindingId: input.item.binding.id,
    marinaraMessageId: input.item.message.id,
    discordMessageIds: nextDiscordMessageIds.slice(0, Math.max(chunks.length, 1)),
    role: input.item.message.role,
    direction: "engine_to_discord",
    contentHash: input.item.contentHash,
  });
}

async function applySyncItem(input: { client: Client; serverUrl: string; item: DiscordBridgeEngineSyncItem }) {
  const thread = await fetchThread(input.client, input.item.binding.threadId);
  if (!thread) {
    logger.warn("Discord sync skipped missing thread %s", input.item.binding.threadId);
    return;
  }

  if (input.item.action === "create") {
    await applyCreate({ serverUrl: input.serverUrl, item: input.item, thread });
  } else {
    await applyUpdate({ serverUrl: input.serverUrl, item: input.item, thread });
  }
}

export async function syncEngineMessagesToDiscord(input: { client: Client; serverUrl: string }) {
  const response = await getEngineSyncItems(input.serverUrl);
  for (const item of response.items) {
    try {
      await applySyncItem({ client: input.client, serverUrl: input.serverUrl, item });
    } catch (err) {
      logger.error(err, `Discord sync item failed for Marinara message ${item.message.id}`);
    }
  }
  if (response.items.length > 0) {
    logger.info("Synced %d engine message changes to Discord", response.items.length);
  }
}
