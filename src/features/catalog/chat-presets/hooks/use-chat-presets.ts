// ──────────────────────────────────────────────
// React Query: Chat Preset hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatPresetKeys } from "../query-keys";
import {
  chatPresetSettingsSchema,
  createChatPresetSchema,
} from "../../../../engine/contracts/schemas/chat-preset.schema";
import { chatModeSchema } from "../../../../engine/contracts/schemas/chat.schema";
import { boolish } from "../../../../engine/generation/runtime-records";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";
import { chatKeys } from "../../chats/query-keys";
import type { Chat, ChatMode } from "../../../../engine/contracts/types/chat";
import {
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  type ChatPreset,
  type ChatPresetSettings,
} from "../../../../engine/contracts/types/chat-preset";

export { chatPresetKeys } from "../query-keys";

const EXCLUDED_METADATA_KEYS = new Set<string>(CHAT_PRESET_EXCLUDED_METADATA_KEYS);
const CHAT_PRESET_METADATA_DEFAULTS: Record<string, unknown> = {
  enableAgents: true,
  agentOverrides: {},
  activeAgentIds: [],
  activeToolIds: [],
};

type RawChatPreset = ChatPreset & {
  default?: unknown;
  active?: unknown;
};

type ChatPresetExportPayload = {
  name: string;
  mode: ChatMode;
  settings: ChatPresetSettings;
};

type ChatPresetExportEnvelope = {
  type: "marinara_chat_preset";
  version: 1;
  exportedAt: string;
  data: ChatPresetExportPayload;
};

function parseSettings(value: unknown, mode?: ChatMode | null): ChatPresetSettings {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return sanitizeChatPresetSettings(JSON.parse(value), mode);
    } catch {
      return {};
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return sanitizeChatPresetSettings(value as ChatPresetSettings, mode);
  }
  return {};
}

function normalizeChatPresetFlags<T extends RawChatPreset>(preset: T): T & ChatPreset {
  const mode = chatModeSchema.safeParse(preset.mode).success ? (preset.mode as ChatMode) : null;
  return {
    ...preset,
    isDefault: boolish(preset.isDefault ?? preset.default, false),
    isActive: boolish(preset.isActive ?? preset.active, false),
    settings: parseSettings(preset.settings, mode),
  };
}

export async function listChatPresets(mode?: ChatMode | null): Promise<ChatPreset[]> {
  const presets = (await storageApi.list<RawChatPreset>("chat-presets")).map(normalizeChatPresetFlags);
  return mode ? presets.filter((preset) => preset.mode === mode) : presets;
}

export function findUserStarredChatPreset(
  presets: readonly RawChatPreset[] | null | undefined,
  mode: ChatMode | null,
): ChatPreset | null {
  if (!mode) return null;
  return (
    presets
      ?.map(normalizeChatPresetFlags)
      .find((preset) => preset.mode === mode && preset.isActive && !preset.isDefault) ?? null
  );
}

function isPresetExcludedMetadataKey(key: string): boolean {
  return EXCLUDED_METADATA_KEYS.has(key) || key.startsWith("scene");
}

export function sanitizeChatPresetSettings(
  settings: ChatPresetSettings | null | undefined,
  mode?: ChatMode | null,
): ChatPresetSettings {
  const clean: ChatPresetSettings = {};
  if (!settings) return clean;

  if ("connectionId" in settings) clean.connectionId = settings.connectionId ?? null;
  if (mode !== "conversation" && "promptPresetId" in settings) clean.promptPresetId = settings.promptPresetId ?? null;

  if (settings.metadata && typeof settings.metadata === "object" && !Array.isArray(settings.metadata)) {
    const metadata = Object.fromEntries(
      Object.entries(settings.metadata).filter(([key]) => !isPresetExcludedMetadataKey(key)),
    );
    if (Object.keys(metadata).length > 0) clean.metadata = metadata;
  }

  return chatPresetSettingsSchema.parse(clean);
}

export function createChatPresetExportEnvelope(preset: ChatPreset): ChatPresetExportEnvelope {
  return {
    type: "marinara_chat_preset",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      name: preset.name,
      mode: preset.mode,
      settings: sanitizeChatPresetSettings(preset.settings, preset.mode),
    },
  };
}

function importPayloadFromEnvelope(envelope: unknown): Record<string, unknown> {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw new Error("Invalid chat preset envelope");
  }
  const record = envelope as Record<string, unknown>;
  if (record.type !== "marinara_chat_preset" || !record.data || typeof record.data !== "object") {
    throw new Error("Invalid chat preset envelope");
  }
  const data = record.data as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 120) : "";
  if (!name) throw new Error("Preset name is required");
  const mode = chatModeSchema.parse(data.mode);
  return createChatPresetSchema.parse({
    name,
    mode,
    settings: sanitizeChatPresetSettings(parseSettings(data.settings, mode), mode),
  });
}

async function setOnlyActivePreset(id: string): Promise<ChatPreset> {
  const selected = await storageApi.get<RawChatPreset>("chat-presets", id);
  if (!selected) throw new Error(`Chat preset ${id} was not found`);
  const presets = (await storageApi.list<RawChatPreset>("chat-presets")).map(normalizeChatPresetFlags);
  await Promise.all(
    presets
      .filter((preset) => preset.mode === selected.mode)
      .map((preset) =>
        storageApi.update<ChatPreset>("chat-presets", preset.id, {
          isActive: preset.id === id,
          active: preset.id === id,
        }),
      ),
  );
  return { ...normalizeChatPresetFlags(selected), isActive: true, active: true } as ChatPreset;
}

export function useChatPresets(mode?: ChatMode | null) {
  return useQuery({
    queryKey: chatPresetKeys.list(mode ?? null),
    queryFn: () => listChatPresets(mode),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; settings?: ChatPresetSettings }) =>
      storageApi.update<ChatPreset>("chat-presets", id, {
        ...data,
        ...(data.settings ? { settings: sanitizeChatPresetSettings(data.settings) } : {}),
      } as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useSaveChatPresetSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: ChatPresetSettings }) =>
      storageApi.update<ChatPreset>("chat-presets", id, {
        settings: sanitizeChatPresetSettings(settings) as unknown as Record<string, unknown>,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useDuplicateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const duplicated = await storageCommandsApi.duplicate<ChatPreset>("chat-presets", id);
      return name?.trim()
        ? storageApi.update<ChatPreset>("chat-presets", duplicated.id, { name: name.trim() })
        : duplicated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useSetActiveChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setOnlyActivePreset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useDeleteChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("chat-presets", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useImportChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: unknown) =>
      storageApi.create<ChatPreset>("chat-presets", importPayloadFromEnvelope(envelope)),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

/** Apply a preset's settings to an existing chat. Refetches the chat afterward. */
export function useApplyChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ presetId, chatId }: { presetId: string; chatId: string }) => {
      const [preset, chat] = await Promise.all([
        storageApi.get<ChatPreset>("chat-presets", presetId),
        storageApi.get<Chat>("chats", chatId),
      ]);
      if (!preset) throw new Error(`Chat preset ${presetId} was not found`);
      if (!chat) throw new Error(`Chat ${chatId} was not found`);

      const settings = sanitizeChatPresetSettings(preset.settings, preset.mode);
      const currentMetadata =
        chat.metadata && typeof chat.metadata === "object" && !Array.isArray(chat.metadata) ? chat.metadata : {};
      const preservedMetadata = Object.fromEntries(
        Object.entries(currentMetadata).filter(([key]) => isPresetExcludedMetadataKey(key)),
      );
      const patch: Record<string, unknown> = {
        chatPresetId: presetId,
        metadata: {
          ...CHAT_PRESET_METADATA_DEFAULTS,
          ...(settings.metadata ?? {}),
          ...preservedMetadata,
          appliedChatPresetId: presetId,
        },
      };
      patch.connectionId = "connectionId" in settings ? (settings.connectionId ?? null) : null;
      if (chat.mode === "conversation") {
        patch.promptPresetId = null;
      } else {
        patch.promptPresetId = "promptPresetId" in settings ? (settings.promptPresetId ?? null) : null;
      }
      return storageApi.update<Chat>("chats", chatId, patch);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
