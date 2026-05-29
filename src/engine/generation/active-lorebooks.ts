import type { StorageGateway } from "../capabilities/storage";
import { loadChatMessages, requireRecord, resolveGenerationConnection } from "./context";
import { assembleGenerationPrompt, type BudgetSkippedLorebookEntry } from "./prompt-assembly";

export interface ActiveLorebookScanResult {
  entries: Array<{
    id: string;
    name: string;
    content: string;
    keys: string[];
    lorebookId: string;
    order: number;
    constant: boolean;
  }>;
  budgetSkippedEntries: BudgetSkippedLorebookEntry[];
  totalTokens: number;
  totalEntries: number;
}

export async function scanActiveLorebookEntries(
  storage: StorageGateway,
  chatId: string,
): Promise<ActiveLorebookScanResult> {
  const chat = requireRecord(await storage.get("chats", chatId), "Chat");
  const connection = await resolveGenerationConnection(storage, chat, {});
  const storedMessages = await loadChatMessages(storage, chatId);
  const assembly = await assembleGenerationPrompt(storage, {
    chat,
    storedMessages,
    connection,
    request: {},
    latestUserInput: "",
  });
  const entries = assembly.activatedLorebookEntries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    content: entry.content,
    keys: entry.matchedKeys,
    lorebookId: entry.lorebookId,
    order: entry.order,
    constant: entry.constant,
  }));
  return {
    entries,
    budgetSkippedEntries: assembly.budgetSkippedLorebookEntries,
    totalTokens: Math.ceil(entries.reduce((sum, entry) => sum + entry.content.length, 0) / 4),
    totalEntries: entries.length,
  };
}
