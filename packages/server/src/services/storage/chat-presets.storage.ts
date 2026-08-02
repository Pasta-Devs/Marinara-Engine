// ──────────────────────────────────────────────
// Storage: chat settings profiles (legacy table/type names retain "ChatPreset")
// ──────────────────────────────────────────────
// CRUD for the saved chat-settings bundles applied to new chats.
// One profile per mode is marked active and used as the starting state.
import { eq, and, ne, asc } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { chats, chatPresets } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { withChatMetadataPatchQueue } from "./chats.storage.js";
import {
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  isRetiredBuiltInAgentId,
  type ChatMode,
  type ChatPresetSettings,
  type CreateChatPresetInput,
  type UpdateChatPresetInput,
} from "@marinara-engine/shared";

const CHAT_MODES: ChatMode[] = ["conversation", "roleplay"];
const EXCLUDED_METADATA_SET = new Set(CHAT_PRESET_EXCLUDED_METADATA_KEYS);

function isPresetExcludedMetadataKey(key: string) {
  return EXCLUDED_METADATA_SET.has(key) || key.startsWith("scene");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStoredChatMetadata(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizePresetAgentIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((agentId) => {
    if (typeof agentId !== "string") return [];
    const normalizedAgentId = agentId.trim();
    return normalizedAgentId && !isRetiredBuiltInAgentId(normalizedAgentId) ? [normalizedAgentId] : [];
  });
}

function sanitizePresetAgentMap(value: unknown) {
  if (!isRecord(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [agentId, agentValue] of Object.entries(value)) {
    const normalizedAgentId = agentId.trim();
    if (!normalizedAgentId || isRetiredBuiltInAgentId(normalizedAgentId)) continue;
    out[normalizedAgentId] = agentValue;
  }
  return out;
}

function sanitizePresetMetadataValue(key: string, value: unknown) {
  if (key === "activeAgentIds") return sanitizePresetAgentIds(value);
  if (key === "agentOverrides" || key === "agentPromptTemplateIds") return sanitizePresetAgentMap(value);
  return value;
}

interface ChatPresetRow {
  id: string;
  name: string;
  mode: string;
  isDefault: string;
  isActive: string;
  settings: string;
  createdAt: string;
  updatedAt: string;
}

function rowToPreset(row: ChatPresetRow) {
  let settings: ChatPresetSettings = {};
  try {
    settings = row.settings ? (JSON.parse(row.settings) as ChatPresetSettings) : {};
  } catch {
    settings = {};
  }
  return {
    id: row.id,
    name: row.name,
    mode: row.mode as ChatMode,
    isDefault: row.isDefault === "true",
    isActive: row.isActive === "true",
    settings: sanitizePresetSettings(settings),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Strip chat-specific keys from a metadata object before saving into a profile. */
function sanitizePresetMetadata(metadata: Record<string, unknown> | undefined | null) {
  if (!metadata || typeof metadata !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isPresetExcludedMetadataKey(key)) continue;
    out[key] = sanitizePresetMetadataValue(key, value);
  }
  return out;
}

/** Strip chat-specific keys from a settings object before saving into a profile. */
function sanitizePresetSettings(input: ChatPresetSettings | undefined | null): ChatPresetSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: ChatPresetSettings = {};
  if ("connectionId" in input) out.connectionId = input.connectionId ?? null;
  if ("promptPresetId" in input) out.promptPresetId = input.promptPresetId ?? null;
  if (input.metadata) out.metadata = sanitizePresetMetadata(input.metadata as Record<string, unknown>);
  return out;
}

export function createChatPresetsStorage(db: DB) {
  const storage = {
    async list() {
      const rows = (await db
        .select()
        .from(chatPresets)
        .orderBy(asc(chatPresets.mode), asc(chatPresets.name))) as ChatPresetRow[];
      return rows.map(rowToPreset);
    },

    async listByMode(mode: ChatMode) {
      const rows = (await db
        .select()
        .from(chatPresets)
        .where(eq(chatPresets.mode, mode))
        .orderBy(asc(chatPresets.name))) as ChatPresetRow[];
      return rows.map(rowToPreset);
    },

    async getById(id: string) {
      const rows = (await db.select().from(chatPresets).where(eq(chatPresets.id, id))) as ChatPresetRow[];
      return rows[0] ? rowToPreset(rows[0]) : null;
    },

    async getActive(mode: ChatMode) {
      const rows = (await db
        .select()
        .from(chatPresets)
        .where(and(eq(chatPresets.mode, mode), eq(chatPresets.isActive, "true")))) as ChatPresetRow[];
      return rows[0] ? rowToPreset(rows[0]) : null;
    },

    async getDefault(mode: ChatMode) {
      const rows = (await db
        .select()
        .from(chatPresets)
        .where(and(eq(chatPresets.mode, mode), eq(chatPresets.isDefault, "true")))) as ChatPresetRow[];
      return rows[0] ? rowToPreset(rows[0]) : null;
    },

    async create(input: CreateChatPresetInput) {
      const id = newId();
      const ts = now();
      const cleaned = sanitizePresetSettings(input.settings as ChatPresetSettings);
      await db.insert(chatPresets).values({
        id,
        name: input.name,
        mode: input.mode,
        isDefault: "false",
        isActive: "false",
        settings: JSON.stringify(cleaned),
        createdAt: ts,
        updatedAt: ts,
      });
      return storage.getById(id);
    },

    async update(id: string, data: UpdateChatPresetInput) {
      const existing = await storage.getById(id);
      if (!existing) return null;
      const patch: Record<string, unknown> = { updatedAt: now() };
      // The built-in Default profile keeps its fixed identity even if storage
      // is called outside the HTTP route's user-facing validation.
      if (data.name !== undefined && !existing.isDefault) patch.name = data.name;
      if (data.settings !== undefined) {
        // The Default profile must always have empty settings; refuse to write into it.
        if (existing.isDefault) {
          patch.settings = JSON.stringify({});
        } else {
          patch.settings = JSON.stringify(sanitizePresetSettings(data.settings as ChatPresetSettings));
        }
      }
      await db.update(chatPresets).set(patch).where(eq(chatPresets.id, id));
      return storage.getById(id);
    },

    /** Replace the profile's settings with a sanitized snapshot (used by the Save button). */
    async saveSettings(id: string, settings: ChatPresetSettings) {
      const existing = await storage.getById(id);
      if (!existing) return null;
      if (existing.isDefault) return existing; // never mutate the Default profile's settings
      const cleaned = sanitizePresetSettings(settings);
      await db
        .update(chatPresets)
        .set({ settings: JSON.stringify(cleaned), updatedAt: now() })
        .where(eq(chatPresets.id, id));
      return storage.getById(id);
    },

    async remove(id: string) {
      return db.transaction(async (tx) => {
        const rows = (await tx.select().from(chatPresets).where(eq(chatPresets.id, id))) as ChatPresetRow[];
        const existing = rows[0];
        if (!existing || existing.isDefault === "true") return false;

        await tx.delete(chatPresets).where(eq(chatPresets.id, id));
        if (existing.isActive === "true") {
          const fallbackRows = (await tx
            .select()
            .from(chatPresets)
            .where(
              and(eq(chatPresets.mode, existing.mode), eq(chatPresets.isDefault, "true")),
            )) as ChatPresetRow[];
          const fallback = fallbackRows[0];
          if (fallback) {
            const ts = now();
            await tx
              .update(chatPresets)
              .set({ isActive: "false", updatedAt: ts })
              .where(eq(chatPresets.mode, existing.mode));
            await tx
              .update(chatPresets)
              .set({ isActive: "true", updatedAt: ts })
              .where(eq(chatPresets.id, fallback.id));
          }
        }
        return true;
      });
    },

    async setActive(id: string) {
      return db.transaction(async (tx) => {
        const rows = (await tx.select().from(chatPresets).where(eq(chatPresets.id, id))) as ChatPresetRow[];
        const target = rows[0];
        if (!target) return null;

        const ts = now();
        await tx
          .update(chatPresets)
          .set({ isActive: "false", updatedAt: ts })
          .where(and(eq(chatPresets.mode, target.mode), ne(chatPresets.id, id)));
        await tx.update(chatPresets).set({ isActive: "true", updatedAt: ts }).where(eq(chatPresets.id, id));
        const updatedRows = (await tx
          .select()
          .from(chatPresets)
          .where(eq(chatPresets.id, id))) as ChatPresetRow[];
        return updatedRows[0] ? rowToPreset(updatedRows[0]) : null;
      });
    },

    async duplicate(id: string, newName?: string) {
      const source = await storage.getById(id);
      if (!source) return null;
      return storage.create({
        name: newName ?? `${source.name} Copy`,
        mode: source.mode,
        settings: source.settings,
      });
    },

    /**
     * Replace a chat's profile-controlled settings with those from a profile.
     *
     * Chat-specific keys (sprites, summary, tags, scene prompt, ephemeral
     * lorebook overrides, group scenario, etc.) are preserved from the
     * existing chat metadata. Everything else is reset to the profile's
     * snapshot, with system defaults filled in for keys the profile doesn't
     * specify. Selecting the Default profile therefore resets the chat's
     * profile-controlled settings to their system defaults.
     */
    async applyToChat(presetId: string, chatId: string, options: { connectionId?: string | null } = {}) {
      return withChatMetadataPatchQueue(chatId, async () => {
        const preset = await storage.getById(presetId);
        if (!preset) return null;
        const rows = await db.select().from(chats).where(eq(chats.id, chatId));
        const chatRow = rows[0];
        if (!chatRow) return null;

        const currentMetadata: Record<string, unknown> = (() => {
          try {
            return chatRow.metadata ? JSON.parse(chatRow.metadata) : {};
          } catch {
            return {};
          }
        })();

        const presetMetadata = (preset.settings.metadata ?? {}) as Record<string, unknown>;

        // Preserve only chat-specific (non-profile) metadata keys.
        const preserved: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(currentMetadata)) {
          if (isPresetExcludedMetadataKey(key)) preserved[key] = value;
        }
        if (!Object.prototype.hasOwnProperty.call(presetMetadata, "activeAgentIds")) {
          preserved.activeAgentIds = sanitizePresetAgentIds(currentMetadata.activeAgentIds);
        }
        if (!Object.prototype.hasOwnProperty.call(presetMetadata, "agentOverrides")) {
          preserved.agentOverrides = sanitizePresetAgentMap(currentMetadata.agentOverrides);
        }
        if (!Object.prototype.hasOwnProperty.call(presetMetadata, "agentPromptTemplateIds")) {
          preserved.agentPromptTemplateIds = sanitizePresetAgentMap(currentMetadata.agentPromptTemplateIds);
        }

        const baseDefaults: Record<string, unknown> = {
          summary: null,
          tags: [],
          enableAgents: true,
          activeToolIds: [],
        };

        const newMetadata: Record<string, unknown> = {
          ...baseDefaults,
          ...presetMetadata,
          ...preserved,
          appliedChatPresetId: preset.id,
        };
        const nextConnectionId =
          options.connectionId !== undefined ? options.connectionId : (preset.settings.connectionId ?? null);

        const ts = now();
        await db
          .update(chats)
          .set({
            connectionId: nextConnectionId,
            promptPresetId: preset.settings.promptPresetId ?? null,
            metadata: JSON.stringify(newMetadata),
            updatedAt: ts,
          })
          .where(eq(chats.id, chatId));

        const updatedRows = await db.select().from(chats).where(eq(chats.id, chatId));
        return updatedRows[0] ?? null;
      });
    },

    /** Ensure a Default profile exists for every chat mode and exactly one profile is active per mode. */
    async ensureDefaults() {
      for (const mode of CHAT_MODES) {
        await db.transaction(async (tx) => {
          const defaultRows = (await tx
            .select()
            .from(chatPresets)
            .where(
              and(eq(chatPresets.mode, mode), eq(chatPresets.isDefault, "true")),
            )) as ChatPresetRow[];
          const canonicalDefault = [...defaultRows].sort(
            (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
          )[0];
          let defaultId = canonicalDefault?.id ?? null;
          if (canonicalDefault) {
            if (canonicalDefault.name !== "Default" || canonicalDefault.settings !== "{}") {
              await tx
                .update(chatPresets)
                .set({ name: "Default", settings: JSON.stringify({}) })
                .where(eq(chatPresets.id, canonicalDefault.id));
            }
            const duplicates = defaultRows.filter((row) => row.id !== canonicalDefault.id);
            if (duplicates.length > 0) {
              const duplicateIds = new Set(duplicates.map((row) => row.id));
              const modeChats = await tx.select().from(chats).where(eq(chats.mode, mode));
              for (const chat of modeChats) {
                const metadata = parseStoredChatMetadata(chat.metadata);
                if (!metadata || !duplicateIds.has(String(metadata.appliedChatPresetId ?? ""))) continue;
                await tx
                  .update(chats)
                  .set({
                    metadata: JSON.stringify({ ...metadata, appliedChatPresetId: canonicalDefault.id }),
                  })
                  .where(eq(chats.id, chat.id));
              }
              for (const duplicate of duplicates) {
                await tx.delete(chatPresets).where(eq(chatPresets.id, duplicate.id));
              }
            }
          }
          if (!defaultId) {
            const id = newId();
            const ts = now();
            await tx.insert(chatPresets).values({
              id,
              name: "Default",
              mode,
              isDefault: "true",
              isActive: "false",
              settings: JSON.stringify({}),
              createdAt: ts,
              updatedAt: ts,
            });
            defaultId = id;
          }

          const activeRows = (await tx
            .select()
            .from(chatPresets)
            .where(and(eq(chatPresets.mode, mode), eq(chatPresets.isActive, "true")))) as ChatPresetRow[];
          if (activeRows.length === 1) return;

          const activeId =
            activeRows.length === 0
              ? defaultId
              : [...activeRows].sort(
                  (left, right) => right.updatedAt.localeCompare(left.updatedAt),
                )[0]!.id;
          if (!activeId) return;

          const ts = now();
          await tx
            .update(chatPresets)
            .set({ isActive: "false", updatedAt: ts })
            .where(eq(chatPresets.mode, mode));
          await tx
            .update(chatPresets)
            .set({ isActive: "true", updatedAt: ts })
            .where(eq(chatPresets.id, activeId));
        });
      }
    },
  };
  return storage;
}
