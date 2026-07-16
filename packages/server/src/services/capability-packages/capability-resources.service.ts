import type {
  CapabilityCharacterRecord,
  CapabilityLorebookEntryRecord,
  CapabilityLorebookEntrySelection,
  CapabilityResourceHost,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";

type LorebookEntrySource = {
  id: string;
  lorebookId: string;
  name: string;
  content: string;
  description: string;
};

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

export function createCapabilityResourceHost(db: DB): CapabilityResourceHost {
  const characters = createCharactersStorage(db);
  const lorebooks = createLorebooksStorage(db);
  return {
    async listCharacters(characterIds): Promise<CapabilityCharacterRecord[]> {
      const requestedIds = uniqueStrings(characterIds);
      const records = await Promise.all(requestedIds.map((characterId) => characters.getById(characterId)));
      return records.flatMap((record) => (record ? [{ id: record.id, data: record.data }] : []));
    },

    async listEligibleLorebookEntries(
      selection: CapabilityLorebookEntrySelection,
    ): Promise<CapabilityLorebookEntryRecord[]> {
      const selectedLorebookIds = uniqueStrings(selection.lorebookIds);
      const selectedEntryIds = uniqueStrings(selection.entryIds);
      const bookEntries = (await lorebooks.listEntriesByLorebooks(
        selectedLorebookIds,
      )) as unknown as LorebookEntrySource[];
      const directEntries = (await Promise.all(selectedEntryIds.map((entryId) => lorebooks.getEntry(entryId)))).filter(
        (entry): entry is NonNullable<typeof entry> => Boolean(entry),
      ) as unknown as LorebookEntrySource[];
      const requestedEntries = Array.from(
        new Map([...bookEntries, ...directEntries].map((entry) => [entry.id, entry])).values(),
      );
      const eligibleEntries = (await lorebooks.listEligibleEntriesByIds(
        requestedEntries.map((entry) => entry.id),
        {
          excludedLorebookIds: selection.excludedLorebookIds,
          excludedSourceAgentIds: selection.excludedSourceAgentIds,
        },
      )) as unknown as LorebookEntrySource[];
      const eligibleById = new Map(eligibleEntries.map((entry) => [entry.id, entry]));
      const orderedEntries = requestedEntries.flatMap((entry) => eligibleById.get(entry.id) ?? []);
      const books = (await lorebooks.list()) as unknown as Array<{ id: string; name: string }>;
      const bookNameById = new Map(books.map((book) => [book.id, book.name]));

      return orderedEntries.map((entry) => ({
        id: entry.id,
        lorebookId: entry.lorebookId,
        lorebookName: bookNameById.get(entry.lorebookId) ?? "Unknown lorebook",
        name: entry.name,
        content: entry.content,
        description: entry.description,
      }));
    },
  };
}
