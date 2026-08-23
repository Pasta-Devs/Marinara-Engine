import type {
  CapabilityCharacterRecord,
  CapabilityLorebookCreateInput,
  CapabilityLorebookEntryInput,
  CapabilityLorebookEntryRecord,
  CapabilityLorebookEntrySelection,
  CapabilityLorebookRecord,
  CapabilityLorebookUpdateInput,
  CapabilityPersonaCreateInput,
  CapabilityPersonaRecord,
  CapabilityPersonaUpdateInput,
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
      const requestedIds = characterIds ? uniqueStrings(characterIds) : null;
      const records = requestedIds
        ? await Promise.all(requestedIds.map((characterId) => characters.getById(characterId)))
        : await characters.list();
      return records.flatMap((record) =>
        record ? [{ id: record.id, data: record.data, comment: record.comment ?? "" }] : [],
      );
    },

    async listPersonas(personaIds): Promise<CapabilityPersonaRecord[]> {
      const requestedIds = personaIds ? uniqueStrings(personaIds) : null;
      const records = requestedIds
        ? await Promise.all(requestedIds.map((personaId) => characters.getPersona(personaId)))
        : await characters.listPersonas();
      return records.flatMap((record) => (record ? [{ id: record.id, data: record }] : []));
    },

    async listLorebooks(lorebookIds): Promise<CapabilityLorebookRecord[]> {
      const requestedIds = lorebookIds ? uniqueStrings(lorebookIds) : null;
      const records = (
        requestedIds
          ? await Promise.all(requestedIds.map((lorebookId) => lorebooks.getById(lorebookId)))
          : await lorebooks.list()
      ) as Array<({ id: string } & Record<string, unknown>) | null>;
      return Promise.all(
        records
          .flatMap((record) =>
            record ? [{ id: record.id, data: record, entries: lorebooks.listEntries(record.id) }] : [],
          )
          .map(async (record) => ({ ...record, entries: await record.entries })),
      );
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

    // Write surface — thin passthroughs to storage. The capability input types are declared narrowly
    // enough to hand straight to it, so nothing here needs a cast.
    async createPersona(input: CapabilityPersonaCreateInput): Promise<CapabilityPersonaRecord> {
      const record = await characters.createPersona(input.name, input.description, input.avatarPath, {
        comment: input.comment,
        appearance: input.appearance,
        tags: input.tags,
      });
      if (!record) throw new Error("[capability] createPersona failed");
      return { id: record.id, data: record };
    },

    async updatePersona(personaId: string, updates: CapabilityPersonaUpdateInput): Promise<void> {
      await characters.updatePersona(personaId, updates);
    },

    async createLorebook(input: CapabilityLorebookCreateInput): Promise<CapabilityLorebookRecord> {
      const record = (await lorebooks.create(input)) as ({ id: string } & Record<string, unknown>) | null;
      if (!record) throw new Error("[capability] createLorebook failed");
      return { id: record.id, data: record, entries: [] };
    },

    async updateLorebook(lorebookId: string, updates: CapabilityLorebookUpdateInput): Promise<void> {
      await lorebooks.update(lorebookId, updates);
    },

    async bulkCreateLorebookEntries(lorebookId: string, entries: CapabilityLorebookEntryInput[]): Promise<void> {
      await lorebooks.bulkCreateEntries(lorebookId, entries);
    },

    async removeLorebookEntry(entryId: string): Promise<void> {
      await lorebooks.removeEntry(entryId);
    },
  };
}
