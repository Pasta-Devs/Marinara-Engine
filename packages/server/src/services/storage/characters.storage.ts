// ──────────────────────────────────────────────
// Storage: Characters, Personas & Groups
// ──────────────────────────────────────────────
import { and, asc, desc, eq, inArray, like, ne, or } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import {
  characters,
  characterCardVersions,
  personas,
  personaCardVersions,
  characterGroups,
  personaGroups,
} from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import {
  PROFESSOR_MARI_ID,
  characterBookSchema,
  characterExtensionsSchema,
  type CharacterData,
  type PersonaCardSnapshot,
  type UpdateCharacterInput,
} from "@marinara-engine/shared";
import { normalizeTimestampOverrides, type TimestampOverrides } from "../import/import-timestamps.js";
import { toPaginatedList } from "../../utils/list-pagination.js";

function resolveTimestamps(overrides?: TimestampOverrides | null) {
  const normalized = normalizeTimestampOverrides(overrides);
  const createdAt = normalized?.createdAt ?? now();
  return {
    createdAt,
    updatedAt: normalized?.updatedAt ?? createdAt,
  };
}

function parseCharacterData(data: string): CharacterData {
  return JSON.parse(data) as CharacterData;
}

function parsePersonaSnapshot(data: string): PersonaCardSnapshot {
  return JSON.parse(data) as PersonaCardSnapshot;
}

function characterDataChanged(current: CharacterData, next: CharacterData) {
  return JSON.stringify(current) !== JSON.stringify(next);
}

function personaSnapshotChanged(current: PersonaCardSnapshot, next: PersonaCardSnapshot) {
  return JSON.stringify(current) !== JSON.stringify(next);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeNestedRecord(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete merged[key];
    } else if (isRecord(value) && isRecord(merged[key])) {
      merged[key] = mergeNestedRecord(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

type CharacterDataUpdate = Partial<CharacterData> | UpdateCharacterInput["data"];
const defaultCharacterExtensions = characterExtensionsSchema.parse({});
const defaultCharacterBook = characterBookSchema.parse({});

function mergeCharacterData(
  current: CharacterData,
  data: CharacterDataUpdate,
  options?: { mergeExtensions?: boolean },
): CharacterData {
  const merged = { ...current, ...data } as CharacterData;
  if ((options?.mergeExtensions ?? true) !== false && isRecord(data.extensions)) {
    merged.extensions = mergeNestedRecord(
      isRecord(current.extensions) ? current.extensions : defaultCharacterExtensions,
      data.extensions,
    ) as CharacterData["extensions"];
  }
  if (isRecord(data.character_book)) {
    merged.character_book = mergeNestedRecord(
      isRecord(current.character_book) ? current.character_book : defaultCharacterBook,
      data.character_book,
    ) as unknown as CharacterData["character_book"];
  }

  return merged;
}

type CharacterRow = typeof characters.$inferSelect;
type CharacterListRow = {
  row: CharacterRow;
  name: string;
  favorite: boolean;
};
type PersonaRow = typeof personas.$inferSelect;
type CharacterListPageOptions = {
  includeBuiltIn?: boolean;
  limit: number;
  offset: number;
  search?: string;
  sort?: string;
  favoriteFilter?: string;
};
type PersonaListPageOptions = {
  limit: number;
  offset: number;
  search?: string;
  sort?: string;
};

function likePattern(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? `%${trimmed}%` : "";
}

function characterOrder(sort: string | undefined) {
  switch (sort) {
    case "oldest":
      return [asc(characters.createdAt), asc(characters.id)];
    case "newest":
      return [desc(characters.createdAt), asc(characters.id)];
    default:
      return [desc(characters.updatedAt), asc(characters.id)];
  }
}

function readCharacterListRow(row: CharacterRow): CharacterListRow {
  try {
    const parsed = parseCharacterData(row.data);
    return {
      row,
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "Unknown",
      favorite: !!parsed.extensions?.fav,
    };
  } catch {
    return { row, name: "Unknown", favorite: false };
  }
}

function sortCharacterRows(rows: CharacterListRow[], sort: string | undefined) {
  switch (sort) {
    case "name-desc":
      return [...rows].sort((a, b) => b.name.localeCompare(a.name) || a.row.id.localeCompare(b.row.id));
    case "name-asc":
      return [...rows].sort((a, b) => a.name.localeCompare(b.name) || a.row.id.localeCompare(b.row.id));
    case "favorites":
      return [...rows].sort((a, b) => {
        const favDiff = Number(b.favorite) - Number(a.favorite);
        if (favDiff !== 0) return favDiff;
        return a.name.localeCompare(b.name) || a.row.id.localeCompare(b.row.id);
      });
    default:
      return rows;
  }
}

function personaOrder(sort: string | undefined) {
  switch (sort) {
    case "name-desc":
      return [desc(personas.name), asc(personas.id)];
    case "newest":
      return [desc(personas.createdAt), asc(personas.id)];
    case "oldest":
      return [asc(personas.createdAt), asc(personas.id)];
    case "name-asc":
    default:
      return [asc(personas.name), asc(personas.id)];
  }
}

function getCharacterSummaryFromRow(row: typeof characters.$inferSelect) {
  try {
    const parsed = parseCharacterData(row.data);
    const extensions =
      parsed.extensions && typeof parsed.extensions === "object"
        ? (parsed.extensions as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "Unknown",
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: extensions.avatarCrop ?? null,
      conversationStatus:
        typeof extensions.conversationStatus === "string" ? extensions.conversationStatus : undefined,
    };
  } catch {
    return {
      id: row.id,
      name: "Unknown",
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: null,
      conversationStatus: undefined,
    };
  }
}

function buildPersonaSnapshot(persona: PersonaRow): PersonaCardSnapshot {
  return {
    name: persona.name ?? "",
    creator: persona.creator ?? "",
    personaVersion: persona.personaVersion?.trim() ? persona.personaVersion : "1.0",
    creatorNotes: persona.creatorNotes ?? "",
    phoneticName: persona.phoneticName ?? "",
    description: persona.description ?? "",
    personality: persona.personality ?? "",
    scenario: persona.scenario ?? "",
    backstory: persona.backstory ?? "",
    appearance: persona.appearance ?? "",
    avatarCrop: persona.avatarCrop ?? "",
    nameColor: persona.nameColor ?? "",
    dialogueColor: persona.dialogueColor ?? "",
    boxColor: persona.boxColor ?? "",
    trackerCardColors: persona.trackerCardColors ?? '{"mode":"chat"}',
    personaStats: persona.personaStats ?? "",
    tags: persona.tags ?? "[]",
    savedStatusOptions: persona.savedStatusOptions ?? "[]",
    convoDisplayName: persona.convoDisplayName ?? "",
    aboutMe: persona.aboutMe ?? "",
    convoBehavior: persona.convoBehavior ?? "",
  };
}

function mergePersonaSnapshot(
  current: PersonaCardSnapshot,
  updates: Partial<PersonaCardSnapshot>,
): PersonaCardSnapshot {
  return {
    ...current,
    ...updates,
    personaVersion: updates.personaVersion !== undefined ? updates.personaVersion : current.personaVersion,
  };
}

function normalizePersonaSnapshot(data: PersonaCardSnapshot): PersonaCardSnapshot {
  return {
    name: data.name ?? "",
    creator: data.creator ?? "",
    personaVersion: data.personaVersion?.trim() ? data.personaVersion : "1.0",
    creatorNotes: data.creatorNotes ?? "",
    phoneticName: data.phoneticName ?? "",
    description: data.description ?? "",
    personality: data.personality ?? "",
    scenario: data.scenario ?? "",
    backstory: data.backstory ?? "",
    appearance: data.appearance ?? "",
    avatarCrop: data.avatarCrop ?? "",
    nameColor: data.nameColor ?? "",
    dialogueColor: data.dialogueColor ?? "",
    boxColor: data.boxColor ?? "",
    trackerCardColors: data.trackerCardColors ?? '{"mode":"chat"}',
    personaStats: data.personaStats ?? "",
    tags: data.tags ?? "[]",
    savedStatusOptions: data.savedStatusOptions ?? "[]",
    convoDisplayName: data.convoDisplayName ?? "",
    aboutMe: data.aboutMe ?? "",
    convoBehavior: data.convoBehavior ?? "",
  };
}

export function createCharactersStorage(db: DB) {
  return {
    // ── Characters ──

    async list() {
      return db.select().from(characters).orderBy(desc(characters.updatedAt));
    },

    async listPage(options: CharacterListPageOptions) {
      const clauses = [];
      if (!options.includeBuiltIn) clauses.push(ne(characters.id, PROFESSOR_MARI_ID));
      const pattern = likePattern(options.search);
      if (pattern) clauses.push(or(like(characters.data, pattern), like(characters.comment, pattern)));
      const whereClause = clauses.length > 0 ? and(...clauses) : undefined;
      const favoriteFilter =
        options.favoriteFilter === "favorites" || options.favoriteFilter === "non-favorites"
          ? options.favoriteFilter
          : "";
      const needsJsonFilteringOrSort =
        !!favoriteFilter || options.sort === "name-asc" || options.sort === "name-desc" || options.sort === "favorites";
      if (needsJsonFilteringOrSort) {
        const rows = await (whereClause
          ? db.select().from(characters).where(whereClause).orderBy(...characterOrder(options.sort))
          : db.select().from(characters).orderBy(...characterOrder(options.sort)));
        const annotatedRows = rows.map(readCharacterListRow);
        const filtered =
          favoriteFilter === "favorites"
            ? annotatedRows.filter((row) => row.favorite)
            : favoriteFilter === "non-favorites"
              ? annotatedRows.filter((row) => !row.favorite)
              : annotatedRows;
        const pagedRows = sortCharacterRows(filtered, options.sort)
          .slice(options.offset, options.offset + options.limit + 1)
          .map(({ row }) => row);
        return toPaginatedList(
          pagedRows,
          options.limit,
          options.offset,
        );
      }
      const rows = await (whereClause
        ? db
            .select()
            .from(characters)
            .where(whereClause)
            .orderBy(...characterOrder(options.sort))
            .limit(options.limit + 1)
            .offset(options.offset)
        : db
            .select()
            .from(characters)
            .orderBy(...characterOrder(options.sort))
            .limit(options.limit + 1)
            .offset(options.offset));
      return toPaginatedList(rows, options.limit, options.offset);
    },

    async listSummariesByIds(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter((id) => id.trim().length > 0)));
      if (uniqueIds.length === 0) return [];
      const rows = await db.select().from(characters).where(inArray(characters.id, uniqueIds));
      return rows.map(getCharacterSummaryFromRow);
    },

    async getById(id: string) {
      const rows = await db.select().from(characters).where(eq(characters.id, id));
      return rows[0] ?? null;
    },

    async listVersions(characterId: string) {
      const rows = await db
        .select()
        .from(characterCardVersions)
        .where(eq(characterCardVersions.characterId, characterId))
        .orderBy(desc(characterCardVersions.createdAt));

      return rows.map((row) => ({
        ...row,
        data: parseCharacterData(row.data),
      }));
    },

    async getVersionById(characterId: string, versionId: string) {
      const rows = await db
        .select()
        .from(characterCardVersions)
        .where(and(eq(characterCardVersions.characterId, characterId), eq(characterCardVersions.id, versionId)));
      const row = rows[0];
      if (!row) return null;
      return {
        ...row,
        data: parseCharacterData(row.data),
      };
    },

    async createVersionSnapshot(
      characterId: string,
      options?: { source?: string; reason?: string; createdAt?: string | null },
    ) {
      const existing = await this.getById(characterId);
      if (!existing) return null;
      const currentData = parseCharacterData(existing.data);
      const timestamp = options?.createdAt ?? now();
      const id = newId();
      await db.insert(characterCardVersions).values({
        id,
        characterId,
        data: JSON.stringify(currentData),
        comment: existing.comment ?? "",
        avatarPath: existing.avatarPath ?? null,
        version: currentData.character_version ?? "",
        source: options?.source ?? "manual",
        reason: options?.reason ?? "",
        createdAt: timestamp,
      });
      return this.getVersionById(characterId, id);
    },

    async create(
      data: CharacterData,
      avatarPath?: string,
      timestampOverrides?: TimestampOverrides | null,
      comment?: string | null,
    ) {
      const id = newId();
      const timestamp = resolveTimestamps(timestampOverrides);
      await db.insert(characters).values({
        id,
        data: JSON.stringify(data),
        comment: comment ?? "",
        avatarPath: avatarPath ?? null,
        spriteFolderPath: null,
        createdAt: timestamp.createdAt,
        updatedAt: timestamp.updatedAt,
      });
      return this.getById(id);
    },

    async update(
      id: string,
      data: CharacterDataUpdate,
      avatarPath?: string,
      options?: {
        updatedAt?: string | null;
        comment?: string | null;
        versionSource?: string | null;
        versionReason?: string | null;
        skipVersionSnapshot?: boolean;
        mergeExtensions?: boolean;
      },
    ) {
      const existing = await this.getById(id);
      if (!existing) return null;
      const currentData = parseCharacterData(existing.data);
      const merged = mergeCharacterData(currentData, data, {
        mergeExtensions: options?.mergeExtensions,
      });
      const nextComment = options?.comment !== undefined ? (options.comment ?? "") : (existing.comment ?? "");
      const nextAvatarPath = avatarPath !== undefined ? avatarPath : existing.avatarPath;
      const shouldSnapshot =
        !options?.skipVersionSnapshot &&
        (characterDataChanged(currentData, merged) ||
          nextComment !== (existing.comment ?? "") ||
          nextAvatarPath !== existing.avatarPath);
      if (shouldSnapshot) {
        await this.createVersionSnapshot(id, {
          source: options?.versionSource ?? "manual",
          reason: options?.versionReason ?? "",
          createdAt: options?.updatedAt ?? null,
        });
      }
      const updatedAt = normalizeTimestampOverrides({
        createdAt: options?.updatedAt,
        updatedAt: options?.updatedAt,
      })?.updatedAt;
      await db
        .update(characters)
        .set({
          data: JSON.stringify(merged),
          ...(options?.comment !== undefined && { comment: nextComment }),
          ...(avatarPath !== undefined && { avatarPath }),
          updatedAt: updatedAt ?? now(),
        })
        .where(eq(characters.id, id));
      return this.getById(id);
    },

    async updateAvatar(id: string, avatarPath: string | null) {
      const existing = await this.getById(id);
      if (!existing) return null;
      if (existing.avatarPath !== avatarPath) {
        await this.createVersionSnapshot(id, {
          source: "manual",
          reason: avatarPath ? "Avatar update" : "Avatar removed",
        });
      }
      await db.update(characters).set({ avatarPath, updatedAt: now() }).where(eq(characters.id, id));
      return this.getById(id);
    },

    async restoreVersion(characterId: string, versionId: string) {
      const version = await this.getVersionById(characterId, versionId);
      if (!version) return null;
      const existing = await this.getById(characterId);
      if (!existing) return null;
      await db
        .update(characters)
        .set({
          data: JSON.stringify(version.data),
          comment: version.comment ?? "",
          avatarPath: version.avatarPath ?? null,
          updatedAt: now(),
        })
        .where(eq(characters.id, characterId));
      return this.getById(characterId);
    },

    async deleteVersion(characterId: string, versionId: string) {
      const version = await this.getVersionById(characterId, versionId);
      if (!version) return false;
      await db
        .delete(characterCardVersions)
        .where(and(eq(characterCardVersions.characterId, characterId), eq(characterCardVersions.id, versionId)));
      return true;
    },

    async remove(id: string) {
      await db.transaction(async (tx) => {
        await tx.delete(characters).where(eq(characters.id, id));
        const groups = await tx.select().from(characterGroups);
        for (const group of groups) {
          let memberIds: string[];
          try {
            memberIds = typeof group.characterIds === "string" ? (JSON.parse(group.characterIds) as string[]) : [];
          } catch {
            continue;
          }
          if (!Array.isArray(memberIds) || !memberIds.includes(id)) continue;
          await tx
            .update(characterGroups)
            .set({
              characterIds: JSON.stringify(memberIds.filter((characterId) => characterId !== id)),
              updatedAt: now(),
            })
            .where(eq(characterGroups.id, group.id));
        }
      });
    },

    async duplicateCharacter(id: string) {
      const source = await this.getById(id);
      if (!source) return null;
      const newCharId = newId();
      const timestamp = now();
      const sourceData = JSON.parse(source.data) as Record<string, unknown>;
      sourceData.name = `${sourceData.name || "Character"} (Copy)`;
      await db.insert(characters).values({
        id: newCharId,
        data: JSON.stringify(sourceData),
        comment: source.comment ?? "",
        avatarPath: source.avatarPath,
        spriteFolderPath: source.spriteFolderPath,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getById(newCharId);
    },

    // ── Personas ──

    async listPersonas() {
      return db.select().from(personas).orderBy(desc(personas.updatedAt));
    },

    async listPersonasPage(options: PersonaListPageOptions) {
      const pattern = likePattern(options.search);
      const whereClause = pattern
        ? or(
            like(personas.name, pattern),
            like(personas.comment, pattern),
            like(personas.creator, pattern),
            like(personas.description, pattern),
            like(personas.personality, pattern),
            like(personas.scenario, pattern),
            like(personas.backstory, pattern),
            like(personas.appearance, pattern),
            like(personas.tags, pattern),
          )
        : undefined;
      const rows = await (whereClause
        ? db
            .select()
            .from(personas)
            .where(whereClause)
            .orderBy(...personaOrder(options.sort))
            .limit(options.limit + 1)
            .offset(options.offset)
        : db
            .select()
            .from(personas)
            .orderBy(...personaOrder(options.sort))
            .limit(options.limit + 1)
            .offset(options.offset));
      return toPaginatedList(rows, options.limit, options.offset);
    },

    async getPersona(id: string) {
      const rows = await db.select().from(personas).where(eq(personas.id, id));
      return rows[0] ?? null;
    },

    async listPersonaVersions(personaId: string) {
      const rows = await db
        .select()
        .from(personaCardVersions)
        .where(eq(personaCardVersions.personaId, personaId))
        .orderBy(desc(personaCardVersions.createdAt));

      return rows.map((row) => ({
        ...row,
        data: parsePersonaSnapshot(row.data),
      }));
    },

    async getPersonaVersionById(personaId: string, versionId: string) {
      const rows = await db
        .select()
        .from(personaCardVersions)
        .where(and(eq(personaCardVersions.personaId, personaId), eq(personaCardVersions.id, versionId)));
      const row = rows[0];
      if (!row) return null;
      return {
        ...row,
        data: parsePersonaSnapshot(row.data),
      };
    },

    async createPersonaVersionSnapshot(
      personaId: string,
      options?: { source?: string; reason?: string; createdAt?: string | null },
    ) {
      const existing = await this.getPersona(personaId);
      if (!existing) return null;
      const currentData = buildPersonaSnapshot(existing);
      const timestamp = options?.createdAt ?? now();
      const id = newId();
      await db.insert(personaCardVersions).values({
        id,
        personaId,
        data: JSON.stringify(currentData),
        comment: existing.comment ?? "",
        avatarPath: existing.avatarPath ?? null,
        version: currentData.personaVersion ?? "",
        source: options?.source ?? "manual",
        reason: options?.reason ?? "",
        createdAt: timestamp,
      });
      return this.getPersonaVersionById(personaId, id);
    },

    async createPersona(
      name: string,
      description: string,
      avatarPath?: string,
      extra?: {
        comment?: string;
        creator?: string;
        personaVersion?: string;
        creatorNotes?: string;
        phoneticName?: string;
        personality?: string;
        scenario?: string;
        backstory?: string;
        appearance?: string;
        nameColor?: string;
        dialogueColor?: string;
        boxColor?: string;
        trackerCardColors?: string;
        personaStats?: string;
        tags?: string;
        savedStatusOptions?: string;
        convoDisplayName?: string;
        aboutMe?: string;
        convoBehavior?: string;
        avatarCrop?: string;
      },
      timestampOverrides?: TimestampOverrides | null,
    ) {
      const id = newId();
      const timestamp = resolveTimestamps(timestampOverrides);
      await db.insert(personas).values({
        id,
        name,
        comment: extra?.comment ?? "",
        creator: extra?.creator ?? "",
        personaVersion: extra?.personaVersion?.trim() ? extra.personaVersion : "1.0",
        creatorNotes: extra?.creatorNotes ?? "",
        phoneticName: extra?.phoneticName ?? "",
        description,
        personality: extra?.personality ?? "",
        scenario: extra?.scenario ?? "",
        backstory: extra?.backstory ?? "",
        appearance: extra?.appearance ?? "",
        avatarPath: avatarPath ?? null,
        avatarCrop: extra?.avatarCrop ?? "",
        isActive: "false",
        nameColor: extra?.nameColor ?? "",
        dialogueColor: extra?.dialogueColor ?? "",
        boxColor: extra?.boxColor ?? "",
        trackerCardColors: extra?.trackerCardColors ?? '{"mode":"chat"}',
        personaStats: extra?.personaStats ?? "",
        tags: extra?.tags ?? "[]",
        savedStatusOptions: extra?.savedStatusOptions ?? "[]",
        convoDisplayName: extra?.convoDisplayName ?? "",
        aboutMe: extra?.aboutMe ?? "",
        convoBehavior: extra?.convoBehavior ?? "",
        createdAt: timestamp.createdAt,
        updatedAt: timestamp.updatedAt,
      });
      return this.getPersona(id);
    },

    async setActivePersona(id: string) {
      return db.transaction(async (tx) => {
        const existing = await tx.select({ id: personas.id }).from(personas).where(eq(personas.id, id));
        if (!existing[0]) return false;
        await tx.update(personas).set({ isActive: "false" });
        await tx.update(personas).set({ isActive: "true", updatedAt: now() }).where(eq(personas.id, id));
        return true;
      });
    },

    async removePersona(id: string) {
      await db.transaction(async (tx) => {
        await tx.delete(personas).where(eq(personas.id, id));
        const groups = await tx.select().from(personaGroups);
        for (const group of groups) {
          let memberIds: string[];
          try {
            memberIds = JSON.parse(group.personaIds) as string[];
          } catch {
            continue;
          }
          if (!Array.isArray(memberIds) || !memberIds.includes(id)) continue;
          await tx
            .update(personaGroups)
            .set({ personaIds: JSON.stringify(memberIds.filter((personaId) => personaId !== id)), updatedAt: now() })
            .where(eq(personaGroups.id, group.id));
        }
      });
    },

    async duplicatePersona(id: string) {
      const source = await this.getPersona(id);
      if (!source) return null;
      const newPId = newId();
      const timestamp = now();
      await db.insert(personas).values({
        id: newPId,
        name: `${source.name || "Persona"} (Copy)`,
        comment: source.comment ?? "",
        creator: source.creator ?? "",
        personaVersion: source.personaVersion?.trim() ? source.personaVersion : "1.0",
        creatorNotes: source.creatorNotes ?? "",
        phoneticName: source.phoneticName ?? "",
        description: source.description ?? "",
        personality: source.personality ?? "",
        scenario: source.scenario ?? "",
        backstory: source.backstory ?? "",
        appearance: source.appearance ?? "",
        avatarPath: source.avatarPath,
        avatarCrop: source.avatarCrop ?? "",
        isActive: "false",
        nameColor: source.nameColor ?? "",
        dialogueColor: source.dialogueColor ?? "",
        boxColor: source.boxColor ?? "",
        trackerCardColors: source.trackerCardColors ?? '{"mode":"chat"}',
        personaStats: source.personaStats ?? "",
        tags: source.tags ?? "[]",
        savedStatusOptions: source.savedStatusOptions ?? "[]",
        convoDisplayName: source.convoDisplayName ?? "",
        aboutMe: source.aboutMe ?? "",
        convoBehavior: source.convoBehavior ?? "",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getPersona(newPId);
    },

    async updatePersona(
      id: string,
      updates: {
        name?: string;
        comment?: string;
        creator?: string;
        personaVersion?: string;
        creatorNotes?: string;
        phoneticName?: string;
        description?: string;
        personality?: string;
        scenario?: string;
        backstory?: string;
        appearance?: string;
        avatarPath?: string | null;
        avatarCrop?: string;
        nameColor?: string;
        dialogueColor?: string;
        boxColor?: string;
        trackerCardColors?: string;
        personaStats?: string;
        tags?: string;
        savedStatusOptions?: string;
        convoDisplayName?: string;
        aboutMe?: string;
        convoBehavior?: string;
      },
      options?: {
        versionSource?: string | null;
        versionReason?: string | null;
        skipVersionSnapshot?: boolean;
      },
    ) {
      const existing = await this.getPersona(id);
      if (!existing) return null;
      const currentData = buildPersonaSnapshot(existing);
      const nextData = mergePersonaSnapshot(currentData, {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.creator !== undefined && { creator: updates.creator }),
        ...(updates.personaVersion !== undefined && { personaVersion: updates.personaVersion }),
        ...(updates.creatorNotes !== undefined && { creatorNotes: updates.creatorNotes }),
        ...(updates.phoneticName !== undefined && { phoneticName: updates.phoneticName }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.personality !== undefined && { personality: updates.personality }),
        ...(updates.scenario !== undefined && { scenario: updates.scenario }),
        ...(updates.backstory !== undefined && { backstory: updates.backstory }),
        ...(updates.appearance !== undefined && { appearance: updates.appearance }),
        ...(updates.avatarCrop !== undefined && { avatarCrop: updates.avatarCrop }),
        ...(updates.nameColor !== undefined && { nameColor: updates.nameColor }),
        ...(updates.dialogueColor !== undefined && { dialogueColor: updates.dialogueColor }),
        ...(updates.boxColor !== undefined && { boxColor: updates.boxColor }),
        ...(updates.trackerCardColors !== undefined && { trackerCardColors: updates.trackerCardColors }),
        ...(updates.personaStats !== undefined && { personaStats: updates.personaStats }),
        ...(updates.tags !== undefined && { tags: updates.tags }),
        ...(updates.savedStatusOptions !== undefined && { savedStatusOptions: updates.savedStatusOptions }),
        ...(updates.convoDisplayName !== undefined && { convoDisplayName: updates.convoDisplayName }),
        ...(updates.aboutMe !== undefined && { aboutMe: updates.aboutMe }),
        ...(updates.convoBehavior !== undefined && { convoBehavior: updates.convoBehavior }),
      });
      const nextComment = updates.comment !== undefined ? updates.comment : (existing.comment ?? "");
      const nextAvatarPath = updates.avatarPath !== undefined ? updates.avatarPath : existing.avatarPath;
      const shouldSnapshot =
        !options?.skipVersionSnapshot &&
        (personaSnapshotChanged(currentData, nextData) ||
          nextComment !== (existing.comment ?? "") ||
          nextAvatarPath !== existing.avatarPath);
      if (shouldSnapshot) {
        await this.createPersonaVersionSnapshot(id, {
          source: options?.versionSource ?? "manual",
          reason: options?.versionReason ?? "",
        });
      }
      const sets: Record<string, unknown> = { updatedAt: now() };
      if (updates.name !== undefined) sets.name = updates.name;
      if (updates.comment !== undefined) sets.comment = updates.comment;
      if (updates.creator !== undefined) sets.creator = updates.creator;
      if (updates.personaVersion !== undefined) sets.personaVersion = updates.personaVersion;
      if (updates.creatorNotes !== undefined) sets.creatorNotes = updates.creatorNotes;
      if (updates.phoneticName !== undefined) sets.phoneticName = updates.phoneticName;
      if (updates.description !== undefined) sets.description = updates.description;
      if (updates.personality !== undefined) sets.personality = updates.personality;
      if (updates.scenario !== undefined) sets.scenario = updates.scenario;
      if (updates.backstory !== undefined) sets.backstory = updates.backstory;
      if (updates.appearance !== undefined) sets.appearance = updates.appearance;
      if (updates.avatarPath !== undefined) sets.avatarPath = updates.avatarPath;
      if (updates.avatarCrop !== undefined) sets.avatarCrop = updates.avatarCrop;
      if (updates.nameColor !== undefined) sets.nameColor = updates.nameColor;
      if (updates.dialogueColor !== undefined) sets.dialogueColor = updates.dialogueColor;
      if (updates.boxColor !== undefined) sets.boxColor = updates.boxColor;
      if (updates.trackerCardColors !== undefined) sets.trackerCardColors = updates.trackerCardColors;
      if (updates.personaStats !== undefined) sets.personaStats = updates.personaStats;
      if (updates.tags !== undefined) sets.tags = updates.tags;
      if (updates.savedStatusOptions !== undefined) sets.savedStatusOptions = updates.savedStatusOptions;
      if (updates.convoDisplayName !== undefined) sets.convoDisplayName = updates.convoDisplayName;
      if (updates.aboutMe !== undefined) sets.aboutMe = updates.aboutMe;
      if (updates.convoBehavior !== undefined) sets.convoBehavior = updates.convoBehavior;
      await db.update(personas).set(sets).where(eq(personas.id, id));
      return this.getPersona(id);
    },

    async restorePersonaVersion(personaId: string, versionId: string) {
      const version = await this.getPersonaVersionById(personaId, versionId);
      if (!version) return null;
      const existing = await this.getPersona(personaId);
      if (!existing) return null;
      const data = normalizePersonaSnapshot(version.data);
      await db
        .update(personas)
        .set({
          name: data.name,
          comment: version.comment ?? "",
          creator: data.creator,
          personaVersion: data.personaVersion,
          creatorNotes: data.creatorNotes,
          phoneticName: data.phoneticName ?? "",
          description: data.description,
          personality: data.personality,
          scenario: data.scenario,
          backstory: data.backstory,
          appearance: data.appearance,
          avatarPath: version.avatarPath ?? null,
          avatarCrop: data.avatarCrop,
          nameColor: data.nameColor,
          dialogueColor: data.dialogueColor,
          boxColor: data.boxColor,
          trackerCardColors: data.trackerCardColors,
          personaStats: data.personaStats,
          tags: data.tags,
          savedStatusOptions: data.savedStatusOptions,
          convoDisplayName: data.convoDisplayName,
          aboutMe: data.aboutMe,
          convoBehavior: data.convoBehavior,
          updatedAt: now(),
        })
        .where(eq(personas.id, personaId));
      return this.getPersona(personaId);
    },

    async deletePersonaVersion(personaId: string, versionId: string) {
      const version = await this.getPersonaVersionById(personaId, versionId);
      if (!version) return false;
      await db
        .delete(personaCardVersions)
        .where(and(eq(personaCardVersions.personaId, personaId), eq(personaCardVersions.id, versionId)));
      return true;
    },

    // ── Character Groups ──

    async listGroups() {
      return db.select().from(characterGroups).orderBy(desc(characterGroups.updatedAt));
    },

    async getGroupById(id: string) {
      const rows = await db.select().from(characterGroups).where(eq(characterGroups.id, id));
      return rows[0] ?? null;
    },

    async createGroup(name: string, description: string, characterIds: string[] = []) {
      const id = newId();
      const timestamp = now();
      await db.insert(characterGroups).values({
        id,
        name,
        description,
        characterIds: JSON.stringify(characterIds),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getGroupById(id);
    },

    async updateGroup(
      id: string,
      updates: { name?: string; description?: string; characterIds?: string[]; avatarPath?: string | null },
    ) {
      const existing = await this.getGroupById(id);
      if (!existing) return null;
      await db
        .update(characterGroups)
        .set({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.characterIds !== undefined && { characterIds: JSON.stringify(updates.characterIds) }),
          ...(updates.avatarPath !== undefined && { avatarPath: updates.avatarPath }),
          updatedAt: now(),
        })
        .where(eq(characterGroups.id, id));
      return this.getGroupById(id);
    },

    async removeGroup(id: string) {
      await db.delete(characterGroups).where(eq(characterGroups.id, id));
    },

    // ── Persona Groups ──

    async listPersonaGroups() {
      return db.select().from(personaGroups).orderBy(desc(personaGroups.updatedAt));
    },

    async getPersonaGroupById(id: string) {
      const rows = await db.select().from(personaGroups).where(eq(personaGroups.id, id));
      return rows[0] ?? null;
    },

    async createPersonaGroup(name: string, description: string, personaIds: string[] = []) {
      const id = newId();
      const timestamp = now();
      await db.insert(personaGroups).values({
        id,
        name,
        description,
        personaIds: JSON.stringify(personaIds),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return this.getPersonaGroupById(id);
    },

    async updatePersonaGroup(id: string, updates: { name?: string; description?: string; personaIds?: string[] }) {
      const existing = await this.getPersonaGroupById(id);
      if (!existing) return null;
      await db
        .update(personaGroups)
        .set({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.personaIds !== undefined && { personaIds: JSON.stringify(updates.personaIds) }),
          updatedAt: now(),
        })
        .where(eq(personaGroups.id, id));
      return this.getPersonaGroupById(id);
    },

    async removePersonaGroup(id: string) {
      await db.delete(personaGroups).where(eq(personaGroups.id, id));
    },
  };
}
