import type { StorageGateway } from "../capabilities/storage";
import {
  lorebookActivatedEntryForEvent,
  scanActiveLorebooks,
  type BudgetSkippedLorebookEntry,
  type LorebookSemanticScanStatus,
} from "./active-lorebook-scanner";
import { loadChatMessages, requireRecord } from "./context";
import { loadCharacters, loadPersona } from "./prompt-assembly";

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
  semanticStatus: LorebookSemanticScanStatus;
}

export async function scanActiveLorebookEntries(
  storage: StorageGateway,
  chatId: string,
): Promise<ActiveLorebookScanResult> {
  const chat = requireRecord(await storage.get("chats", chatId), "Chat");
  const storedMessages = await loadChatMessages(storage, chatId);
  const characters = await loadCharacters(storage, chat);
  const persona = await loadPersona(storage, chat);
  const scan = await scanActiveLorebooks({
    storage,
    chat,
    characters,
    persona,
    storedMessages,
    request: {},
    latestUserInput: "",
  });
  const entries = scan.processedLore.includedEntries.map((entry) => {
    const event = lorebookActivatedEntryForEvent(entry);
    return {
      id: event.id,
      name: event.name,
      content: event.content,
      keys: event.matchedKeys,
      lorebookId: event.lorebookId,
      order: event.order,
      constant: event.constant,
    };
  });
  return {
    entries,
    budgetSkippedEntries: scan.budgetSkippedLorebookEntries,
    totalTokens: Math.ceil(entries.reduce((sum, entry) => sum + entry.content.length, 0) / 4),
    totalEntries: entries.length,
    semanticStatus: scan.semanticStatus,
  };
}
