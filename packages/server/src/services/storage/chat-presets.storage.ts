// ──────────────────────────────────────────────
// Storage: chat settings profiles (legacy table/type names retain "ChatPreset")
// ──────────────────────────────────────────────
// CRUD for the saved chat-settings bundles applied to new chats.
// One profile per mode is marked active and used as the starting state.
import { eq, and, ne, asc } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { chats, chatPresets } from "../../db/schema/index.js";
import { newId, now } from "../../utils/id-generator.js";
import { logger } from "../../lib/logger.js";
import { createChatsStorage, withChatMetadataPatchQueue } from "./chats.storage.js";
import { summaryHidingPatch } from "../../routes/generate/generate-route-utils.js";
import {
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  CHAT_PRESET_EXCLUDED_PACKAGE_METADATA_KEYS,
  CHAT_PROFILE_FOLLOWER_SYNC_KEYS,
  chatFollowsChatPreset,
  TRANSLATOR_DEFAULTS_SETTINGS_KEY,
  TRANSLATOR_SETTINGS_KEYS,
  normalizeTranslatorSettings,
  isRetiredBuiltInAgentId,
  type ChatMode,
  type ChatPresetSettings,
  type CreateChatPresetInput,
  type UpdateChatPresetInput,
} from "@marinara-engine/shared";

import { createAppSettingsStorage } from "./app-settings.storage.js";

const CHAT_MODES: ChatMode[] = ["conversation", "roleplay"];
const EXCLUDED_METADATA_SET = new Set([
  ...CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  ...CHAT_PRESET_EXCLUDED_PACKAGE_METADATA_KEYS,
]);
/** Advanced Memory values tied to one chat's messages and characters; the rest are profile settings. */
const ADVANCED_MEMORY_CHAT_KEYS = ["knowledgeStarts", "knowledgeConfirmed", "narratorCharacterId"];
/**
 * Agents set up for one chat when they are added: knowledge sources, a target lorebook, sprite
 * characters, a prompt template. That setup is not copied to other chats, and without it these agents
 * fall back to another chat's sources or books, so updating other chats leaves them on or off, with
 * their prompt templates, as each chat has them.
 */
const CHAT_SETUP_AGENT_IDS = new Set(["knowledge-retrieval", "knowledge-router", "lorebook-keeper", "expression"]);
/**
 * Settings edited against the chat's connection. Advanced Parameters can send options another provider
 * rejects, such as OpenRouter routing, and image captioning without a value uses the chat's own
 * connection's defaults, so updating other chats changes these only in chats on the profile's connection.
 */
/** `scene…` keys that are Chat Settings a profile carries, unlike the rest of a chat's scene state. */
const PROFILE_SCENE_SETTING_KEYS = new Set(["sceneVideoConnectionId", "sceneVideoFirstFrame"]);
const CONNECTION_SETTING_KEYS = new Set(["chatParameters", "imageCaptioningEnabled", "imageCaptioningConnectionId"]);

function isPresetExcludedMetadataKey(key: string) {
  return (
    EXCLUDED_METADATA_SET.has(key) ||
    // The Illustrator's scene video connection and video first frame are settings, not part of one chat's scene.
    (key.startsWith("scene") && !PROFILE_SCENE_SETTING_KEYS.has(key)) ||
    key.startsWith("multiplayer")
  );
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

function pickAdvancedMemoryKeys(value: unknown, chatOwned: boolean) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => ADVANCED_MEMORY_CHAT_KEYS.includes(key) === chatOwned),
  );
}

function sanitizePresetMetadataValue(key: string, value: unknown) {
  if (key === "chatSettingsHintDismissed") return value === true;
  if (key === "advancedMemory" && isRecord(value)) return pickAdvancedMemoryKeys(value, false);
  if (key === "activeAgentIds") return sanitizePresetAgentIds(value);
  if (key === "agentOverrides" || key === "agentPromptTemplateIds" || key === "customAgentImageSettings") {
    return sanitizePresetAgentMap(value);
  }
  return value;
}

function pickSetUpAgentEntries(value: unknown, setUp: boolean) {
  return Object.fromEntries(
    Object.entries(sanitizePresetAgentMap(value)).filter(([agentId]) => CHAT_SETUP_AGENT_IDS.has(agentId) === setUp),
  );
}

/**
 * A follower's metadata after its profile was saved. Each of CHAT_PROFILE_FOLLOWER_SYNC_KEYS becomes what
 * applying the profile by hand (`applied`) gives it, so a setting the profile has no value for goes back
 * to its default, except where that default comes from the chat's own connection or characters, and
 * except the agents each chat sets up. Every other key stays the chat's own.
 */
function syncFollowerMetadata(
  current: Record<string, unknown>,
  applied: Record<string, unknown>,
  onProfileConnection: boolean,
) {
  const next = { ...current };
  for (const key of CHAT_PROFILE_FOLLOWER_SYNC_KEYS) {
    if (CONNECTION_SETTING_KEYS.has(key) && !onProfileConnection) continue;
    // Without a value, schedules run whenever the chat's own characters have one, so a profile without
    // a value leaves the chat's own choice. Removing a chat's "off" would turn its schedules back on.
    if (key === "conversationSchedulesEnabled" && typeof applied[key] !== "boolean") continue;
    if (Object.prototype.hasOwnProperty.call(applied, key)) next[key] = applied[key];
    else delete next[key];
  }
  // An empty list runs no agents, which is right when the profile's only agents are ones each chat sets up.
  next.activeAgentIds = [
    ...sanitizePresetAgentIds(applied.activeAgentIds).filter((id) => !CHAT_SETUP_AGENT_IDS.has(id)),
    ...sanitizePresetAgentIds(current.activeAgentIds).filter((id) => CHAT_SETUP_AGENT_IDS.has(id)),
  ];
  next.agentPromptTemplateIds = {
    ...pickSetUpAgentEntries(applied.agentPromptTemplateIds, false),
    ...pickSetUpAgentEntries(current.agentPromptTemplateIds, true),
  };
  return next;
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
            .where(and(eq(chatPresets.mode, existing.mode), eq(chatPresets.isDefault, "true")))) as ChatPresetRow[];
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
        const updatedRows = (await tx.select().from(chatPresets).where(eq(chatPresets.id, id))) as ChatPresetRow[];
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
     *
     * `asFollower` refreshes a chat after its profile was saved: it skips a chat that no longer
     * follows the profile and sets only CHAT_PROFILE_FOLLOWER_SYNC_KEYS, as an apply by hand would
     * (Advanced Parameters and image captioning only on the profile's connection, schedules only when
     * the profile has a value, agents minus the ones each chat sets up).
     * Every other key, the connection, the prompt preset and the recent-chat order stay the chat's own.
     */
    async applyToChat(
      presetId: string,
      chatId: string,
      options: { connectionId?: string | null; asFollower?: boolean } = {},
    ) {
      return withChatMetadataPatchQueue(chatId, async () => {
        const preset = await storage.getById(presetId);
        if (!preset) return null;
        const rows = await db.select().from(chats).where(eq(chats.id, chatId));
        const chatRow = rows[0];
        if (!chatRow) return null;
        if (preset.mode !== chatRow.mode) return null;

        const currentMetadata: Record<string, unknown> = (() => {
          try {
            return chatRow.metadata ? JSON.parse(chatRow.metadata) : {};
          } catch {
            return {};
          }
        })();
        if (options.asFollower && !chatFollowsChatPreset(currentMetadata, preset.id)) return null;

        const presetMetadata = (sanitizePresetSettings(preset.settings).metadata ?? {}) as Record<string, unknown>;
        const translatorSettings = normalizeTranslatorSettings(presetMetadata);
        // Filter this application copy; keep the saved profile intact.
        for (const key of TRANSLATOR_SETTINGS_KEYS) delete presetMetadata[key];

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
        if (!Object.prototype.hasOwnProperty.call(presetMetadata, "customAgentImageSettings")) {
          preserved.customAgentImageSettings = sanitizePresetAgentMap(currentMetadata.customAgentImageSettings);
        }
        const ownMemory = pickAdvancedMemoryKeys(currentMetadata.advancedMemory, true);
        if (Object.keys(ownMemory).length > 0) {
          preserved.advancedMemory = { ...pickAdvancedMemoryKeys(presetMetadata.advancedMemory, false), ...ownMemory };
        }
        // Profiles saved before they held window layouts or the video settings leave the chat's own.
        for (const key of ["windowLayout", ...PROFILE_SCENE_SETTING_KEYS]) {
          if (
            !Object.prototype.hasOwnProperty.call(presetMetadata, key) &&
            Object.prototype.hasOwnProperty.call(currentMetadata, key)
          ) {
            preserved[key] = currentMetadata[key];
          }
        }

        const baseDefaults: Record<string, unknown> = {
          ...normalizeTranslatorSettings(await createAppSettingsStorage(db).get(TRANSLATOR_DEFAULTS_SETTINGS_KEY)),
          summary: null,
          tags: [],
          enableAgents: true,
          activeToolIds: [],
          chatSettingsHintDismissed: false,
        };

        const appliedMetadata: Record<string, unknown> = {
          ...baseDefaults,
          ...presetMetadata,
          ...translatorSettings,
          ...preserved,
          appliedChatPresetId: preset.id,
        };
        const newMetadata = options.asFollower
          ? syncFollowerMetadata(
              currentMetadata,
              appliedMetadata,
              (chatRow.connectionId ?? null) === (preset.settings.connectionId ?? null),
            )
          : appliedMetadata;
        // A profile that turns "Hide summarised messages" on or off hides or shows those messages too.
        Object.assign(
          newMetadata,
          await summaryHidingPatch(createChatsStorage(db), chatId, currentMetadata, newMetadata),
        );
        const nextConnectionId =
          options.connectionId !== undefined ? options.connectionId : (preset.settings.connectionId ?? null);

        await db
          .update(chats)
          .set({
            ...(!options.asFollower && {
              connectionId: nextConnectionId,
              promptPresetId: preset.settings.promptPresetId ?? null,
              updatedAt: now(),
            }),
            metadata: JSON.stringify(newMetadata),
          })
          .where(eq(chats.id, chatId));

        const updatedRows = await db.select().from(chats).where(eq(chats.id, chatId));
        return updatedRows[0] ?? null;
      });
    },

    /** After a profile is saved, apply its chat settings to the other chats that follow it. */
    async applyToFollowers(presetId: string, exceptChatId: string | null) {
      const chatIds: string[] = [];
      let failed = 0;
      const preset = await storage.getById(presetId);
      if (!preset) return { chatIds, failed };
      const rows = await db.select().from(chats).where(eq(chats.mode, preset.mode));
      for (const row of rows) {
        if (row.id === exceptChatId || !chatFollowsChatPreset(parseStoredChatMetadata(row.metadata), preset.id))
          continue;
        try {
          if (await storage.applyToChat(preset.id, row.id, { asFollower: true })) chatIds.push(row.id);
        } catch (err) {
          // One chat failing must not hide the chats already updated.
          failed += 1;
          logger.warn(err, "Could not update chat %s from settings profile %s", row.id, preset.id);
        }
      }
      return { chatIds, failed };
    },

    /** Ensure a Default profile exists for every chat mode and exactly one profile is active per mode. */
    async ensureDefaults() {
      for (const mode of CHAT_MODES) {
        await db.transaction(async (tx) => {
          const defaultRows = (await tx
            .select()
            .from(chatPresets)
            .where(and(eq(chatPresets.mode, mode), eq(chatPresets.isDefault, "true")))) as ChatPresetRow[];
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
              : [...activeRows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]!.id;
          if (!activeId) return;

          const ts = now();
          await tx.update(chatPresets).set({ isActive: "false", updatedAt: ts }).where(eq(chatPresets.mode, mode));
          await tx.update(chatPresets).set({ isActive: "true", updatedAt: ts }).where(eq(chatPresets.id, activeId));
        });
      }
    },
  };
  return storage;
}
