import type { DiscordBridgeThreadBinding } from "@marinara-engine/shared";
import { contentHash } from "./content-hash.js";
import {
  getBridgeChatContext,
  listThreadMessageMappings,
  upsertMessageMapping,
} from "./marinara-api.js";
import { splitDiscordMessageContent } from "./message-splitter.js";
import { formatThreadMessage } from "./thread-message-format.js";

export interface FillableDiscordThread {
  send(input: { content: string }): Promise<{ id: string }>;
}

export interface InitialThreadFillResult {
  messageCount: number;
  chunkCount: number;
}

export async function fillThreadFromChatMessages(input: {
  serverUrl: string;
  threadId: string;
  binding: DiscordBridgeThreadBinding;
  thread: FillableDiscordThread;
  messageLimit?: number | "all";
  sendDelayMs?: number;
}): Promise<InitialThreadFillResult> {
  const [context, existingMappings] = await Promise.all([
    getBridgeChatContext(input.serverUrl, input.binding.chatId, input.messageLimit ?? 100),
    listThreadMessageMappings(input.serverUrl, input.threadId),
  ]);
  const mappedMarinaraIds = new Set(existingMappings.map((mapping) => mapping.marinaraMessageId));
  let messageCount = 0;
  let chunkCount = 0;

  for (const message of context.messages) {
    if (mappedMarinaraIds.has(message.id)) continue;

    const chunks = splitDiscordMessageContent(formatThreadMessage(message));
    const sentIds: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      if (input.sendDelayMs && (messageCount > 0 || index > 0)) {
        await delay(input.sendDelayMs);
      }
      const sent = await input.thread.send({ content: chunk });
      sentIds.push(sent.id);
    }

    await upsertMessageMapping(input.serverUrl, {
      bindingId: input.binding.id,
      marinaraMessageId: message.id,
      discordMessageIds: sentIds,
      role: message.role,
      direction: "engine_to_discord",
      contentHash: contentHash(message.content),
    });
    messageCount += 1;
    chunkCount += sentIds.length;
  }

  return { messageCount, chunkCount };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
