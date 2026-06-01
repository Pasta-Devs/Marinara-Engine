import { useMutation } from "@tanstack/react-query";

import type { Chat, Message } from "../../../../engine/contracts/types/chat";
import { storageApi } from "../../../../shared/api/storage-api";
import { downloadBlobFile, downloadTextFile } from "../lib/download";
import type { BulkChatExportFormat } from "../lib/chat-transcript-export";

async function loadChatsForExport(chatIds: string[]) {
  const ids = Array.from(new Set(chatIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) throw new Error("Choose at least one chat to export.");
  return Promise.all(
    ids.map(async (chatId) => {
      const [chat, messages] = await Promise.all([
        storageApi.get<Chat>("chats", chatId).then((chat) => {
          if (!chat) throw new Error("Chat was not found.");
          return chat;
        }),
        storageApi.listChatMessages<Message>(chatId),
      ]);
      return { chat, messages };
    }),
  );
}

/** Export selected chats as native JSON or a ZIP of JSONL/text transcripts. */
export function useBulkExportChats() {
  return useMutation({
    mutationFn: async ({
      chatIds,
      format = "native",
      scope = "selected",
    }: {
      chatIds?: string[];
      format?: BulkChatExportFormat;
      scope?: "selected" | "all";
    }) => {
      const exportIds =
        scope === "all" ? (await storageApi.list<Chat>("chats")).map((chat) => chat.id) : (chatIds ?? []);
      const chats = await loadChatsForExport(exportIds);
      const exportedAt = new Date().toISOString();
      if (format === "jsonl" || format === "text") {
        const [{ buildChatTranscriptZipFiles }, { createStoredZip }] = await Promise.all([
          import("../lib/chat-transcript-export"),
          import("../../../../shared/lib/zip"),
        ]);
        const files = buildChatTranscriptZipFiles(chats, format);
        downloadBlobFile(createStoredZip(files), `chat-transcripts-${format}-${exportedAt.slice(0, 10)}.zip`);
        return;
      }

      downloadTextFile(
        JSON.stringify(
          {
            format: "marinara-chat-bulk",
            version: 1,
            exportedAt,
            count: chats.length,
            chats,
          },
          null,
          2,
        ),
        `marinara-chats-${exportedAt.slice(0, 10)}.json`,
        "application/json;charset=utf-8",
      );
    },
  });
}
